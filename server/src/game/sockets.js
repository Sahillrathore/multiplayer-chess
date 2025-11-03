//sockets.js

const { Server } = require("socket.io");
const { ORIGINS } = require("../config");
const { verify } = require("../jwt");
const User = require("../auth/user.model");
const { enqueue, dequeuePair, removeFromQueues } = require("./matchmaking");
const {
    games, createGameRoom, tickClocks, applyIncrement, recordMoveToDB, finalizeGameInDB
} = require("./game.service");

const pendingResignTimers = new Map(); // key: userId -> timeout id

function attachSocketServer(httpServer) {
    const io = new Server(httpServer, { cors: { origin: ORIGINS, methods: ["GET", "POST"] } });

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("Missing token"));
            const payload = verify(token);
            const user = await User.findById(payload.sub).select("_id");
            if (!user) return next(new Error("Invalid token"));
            socket.userId = payload.sub;       // string
            socket.userDbId = user._id;        // ObjectId
            next();
        } catch (e) { next(new Error("Invalid token")); }
    });

    io.on("connection", (socket) => {

        const t = pendingResignTimers.get(socket.userId);
        if (t) {
            clearTimeout(t);
            pendingResignTimers.delete(socket.userId);
        }

        // if user was in an active game, rebind socketId and rejoin room
        for (const g of games.values()) {
            if (g.status !== "active") continue;
            if (g.white.userId === socket.userId) {
                g.white.socketId = socket.id;
                io.sockets.sockets.get(socket.id)?.join(g.id);
                // emitState(io, g);
                // send a *direct* resume event with color + all state
                io.to(socket.id).emit("game:resume", {
                    gameId: g.id, color: "w",
                    fen: g.chess.fen(), moves: g.moves, turn: g.chess.turn(),
                    clocks: g.clocks, status: g.status, captures: g.captures
                });
            }
            if (g.black.userId === socket.userId) {
                g.black.socketId = socket.id;
                io.sockets.sockets.get(socket.id)?.join(g.id);
                // emitState(io, g);
                io.to(socket.id).emit("game:resume", {
                    gameId: g.id, color: "b",
                    fen: g.chess.fen(), moves: g.moves, turn: g.chess.turn(),
                    clocks: g.clocks, status: g.status, captures: g.captures
                });
            }
        }

        socket.on("queue:join", async ({ timeControl }) => {
            console.log('join req');
            
            if (!timeControl) return socket.emit("error", { code: "BAD_PAYLOAD", message: "timeControl required" });

            enqueue(timeControl, { socketId: socket.id, userId: socket.userId, userDbId: socket.userDbId, timeControl });

            const pair = dequeuePair(timeControl);
            if (!pair) return;

            const [A, B] = pair;
            const room = await createGameRoom(A, B, timeControl);

            io.sockets.sockets.get(room.white.socketId)?.join(room.id);
            io.sockets.sockets.get(room.black.socketId)?.join(room.id);

            io.to(room.white.socketId).emit("queue:matched", { gameId: room.id, color: "w", opponent: room.black.userId });
            io.to(room.black.socketId).emit("queue:matched", { gameId: room.id, color: "b", opponent: room.white.userId });

            emitState(io, room);
        });

        socket.on("queue:leave", () => removeFromQueues(socket.id));

        socket.on("game:move", async ({ gameId, from, to, promotion }) => {
            const g = games.get(gameId);
            if (!g || g.status !== "active") return;

            const side = g.chess.turn();
            const expectedSocket = side === "w" ? g.white.socketId : g.black.socketId;
            if (expectedSocket !== socket.id) {
                socket.emit("error", { code: "NOT_YOUR_TURN", message: "Wait for your turn" });
                return;
            }

            tickClocks(g);
            if ((side === "w" && g.clocks.w <= 0) || (side === "b" && g.clocks.b <= 0)) {
                return endGame(io, g, side === "w" ? "TIMEOUT_WHITE" : "TIMEOUT_BLACK", "Timeout");
            }

            const move = g.chess.move({ from, to, promotion });
            if (!move) return socket.emit("error", { code: "ILLEGAL_MOVE", message: "Illegal move" });

            applyIncrement(g, side);

            // capture tray update
            // move.captured is like 'p','n','b','r','q','k' (lowercase type of the piece that got captured)
            if (move.captured) {
                g.captures[side].push(move.captured);
            }

            g.moves.push({ san: move.san, from, to, fen: g.chess.fen() });
            // await recordMoveToDB(g, { san: move.san, from, to });
            await recordMoveToDB(g, { san: move.san, from, to, captured: move.captured || null });

            io.to(g.id).emit("game:move", {
                // san: move.san, from, to, fen: g.chess.fen(), moveNo: g.moves.length, clocks: g.clocks
                san: move.san,
                from, to,
                fen: g.chess.fen(),
                moveNo: g.moves.length,
                clocks: g.clocks,
                captured: move.captured || null,
                captures: g.captures, // <- echo updated trays for snappy UI
            });

            if (g.chess.isCheckmate()) return endGame(io, g, side === "w" ? "WHITE_WIN" : "BLACK_WIN", "Checkmate");
            if (g.chess.isDraw()) return endGame(io, g, "DRAW", "Draw (stalemate/insufficient/50-move/repetition)");

            g.turnStamp = Date.now();
            emitState(io, g);
        });

        socket.on("game:offerDraw", ({ gameId }) => {
            const g = games.get(gameId);
            if (!g || g.status !== "active") return;
            const side = socket.id === g.white.socketId ? "w" : socket.id === g.black.socketId ? "b" : null;
            if (!side) return;
            g.drawOfferedBy = side;
            const other = side === "w" ? g.black.socketId : g.white.socketId;
            io.to(other).emit("game:drawOffered", { by: side });
        });

        socket.on("game:acceptDraw", async ({ gameId }) => {
            const g = games.get(gameId);
            if (!g || g.status !== "active") return;
            await endGame(io, g, "DRAW", "Agreed draw");
        });

        socket.on("game:resign", async ({ gameId }) => {
            const g = games.get(gameId);
            if (!g || g.status !== "active") return;
            const side = socket.id === g.white.socketId ? "w" : socket.id === g.black.socketId ? "b" : null;
            if (!side) return;
            await endGame(io, g, side === "w" ? "RESIGN_WHITE" : "RESIGN_BLACK", "Resignation");
        });

        socket.on("disconnect", (reason) => {
            // Remove from queues immediately
            removeFromQueues(socket.id);

            // If they were in a game, schedule a delayed resign to allow reconnection
            const GRACE_MS = 8000; // 8 seconds – tune as you like

            for (const g of games.values()) {
                if (g.status !== "active") continue;

                let side = null;
                if (g.white.socketId === socket.id) side = "w";
                if (g.black.socketId === socket.id) side = "b";
                if (!side) continue;

                // If a timer already exists for this user, don't schedule again
                if (pendingResignTimers.has(socket.userId)) continue;

                const timer = setTimeout(async () => {
                    // If user hasn't reconnected and updated their socketId, resign them
                    const stillMissing =
                        (side === "w" && (!io.sockets.sockets.get(g.white.socketId) || g.white.userId !== socket.userId)) ||
                        (side === "b" && (!io.sockets.sockets.get(g.black.socketId) || g.black.userId !== socket.userId));

                    if (g.status === "active" && stillMissing) {
                        await endGame(io, g, side === "w" ? "RESIGN_WHITE" : "RESIGN_BLACK", "Disconnect");
                    }
                    pendingResignTimers.delete(socket.userId);
                }, GRACE_MS);

                pendingResignTimers.set(socket.userId, timer);
            }
        });
    });

    return io;
}

function emitState(io, g) {
    io.to(g.id).emit("game:state", {
        fen: g.chess.fen(),
        moves: g.moves,
        turn: g.chess.turn(),
        clocks: g.clocks,
        status: g.status,
        captures: g.captures, // <- send trays
    });
}

async function endGame(io, g, result, reason) {
    if (g.status === "ended") return;
    g.status = "ended";
    const pgn = g.chess.pgn({ maxWidth: 80, newline: "\n" });
    await finalizeGameInDB(g, result, reason);
    io.to(g.id).emit("game:ended", { result, reason, pgn });
    console.log(`[END] ${g.id} -> ${result} (${reason})`);
}

module.exports = { attachSocketServer };
