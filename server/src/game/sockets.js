// server/src/game/sockets.js
const { Server } = require("socket.io");
const { ORIGINS } = require("../config");
const { verify } = require("../jwt");
const User = require("../auth/user.model");
const { enqueue, dequeuePair, removeFromQueues } = require("./matchmaking");
const {
    games, createGameRoom, tickClocks, applyIncrement, recordMoveToDB, finalizeGameInDB
} = require("./game.service");

// socketUtils exports: setUserSocket, removeUserSocket, getSocketIdForUser, emitToSocketId
const { setUserSocket, removeUserSocket, getSocketIdForUser, emitToSocketId, setIo } = require("./socketUtils");

const pendingResignTimers = new Map(); // key: userId -> timeout id

function attachSocketServer(httpServer) {
    const io = new Server(httpServer, { cors: { origin: ORIGINS, methods: ["GET", "POST"] } });
    
    // auth middleware: verify token and attach user ids to socket
    io.use(async (socket, next) => {
        try {
            setIo(io);
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("Missing token"));
            const payload = verify(token);
            const user = await User.findById(payload.sub).select("_id").lean();
            if (!user) return next(new Error("Invalid token"));
            socket.userId = payload.sub;       // auth-sub (string)
            socket.userDbId = user._id;       // ObjectId

            next();
        } catch (e) {
            console.error("[socket auth] error:", e && e.message);
            next(new Error("Invalid token"));
        }
    });

    io.on("connection", async (socket) => {
        console.log(`[socket] connected: ${socket.id} userId=${socket.userId} userDbId=${socket.userDbId}`);

        // register mapping userId -> socketId
        try {
            setUserSocket(String(socket.userId), socket.id);
        } catch (e) {
            console.warn("[sockets] setUserSocket failed", e && e.message);
        }

        // clear any pending resign timer for this user (they reconnected)
        const t = pendingResignTimers.get(socket.userId);
        if (t) {
            clearTimeout(t);
            pendingResignTimers.delete(socket.userId);
            console.log(`[socket] cleared pending resign timer for user ${socket.userId}`);
        }

        // If user was in an active game, rebind socketId and rejoin room and emit resume
        for (const g of games.values()) {
            if (g.status !== "active") continue;

            // NOTE: g.white.userId / g.black.userId are auth userId strings
            try {
                if (String(g.white.userId) === String(socket.userId)) {
                    g.white.socketId = socket.id;
                    io.sockets.sockets.get(socket.id)?.join(g.id);

                    const oppDoc = await safeFindUserById(g.black.userDbId);
                    const opponentEmail = oppDoc?.email ?? null;

                    console.log(`[resume] resuming for white ${socket.userId} in game ${g.id}, opponentEmail=${opponentEmail}`);
                    io.to(socket.id).emit("game:resume", {
                        gameId: g.id,
                        color: "w",
                        fen: g.chess.fen(),
                        moves: g.moves,
                        turn: g.chess.turn(),
                        clocks: g.clocks,
                        status: g.status,
                        captures: g.captures,
                        opponentId: g.black.userId,
                        opponentEmail,
                    });
                }

                if (String(g.black.userId) === String(socket.userId)) {
                    g.black.socketId = socket.id;
                    io.sockets.sockets.get(socket.id)?.join(g.id);

                    const oppDoc = await safeFindUserById(g.white.userDbId);
                    const opponentEmail = oppDoc?.email ?? null;
                    console.log(oppDoc);
                    
                    console.log(`[resume] resuming for black ${socket.userId} in game ${g.id}, opponentEmail=${opponentEmail}`);
                    io.to(socket.id).emit("game:resume", {
                        gameId: g.id,
                        color: "b",
                        fen: g.chess.fen(),
                        moves: g.moves,
                        turn: g.chess.turn(),
                        clocks: g.clocks,
                        status: g.status,
                        captures: g.captures,
                        opponentId: g.white.userId,
                        opponentEmail,
                    });
                }
            } catch (err) {
                console.error("[resume] error while resuming game", g.id, err);
            }
        }

        // ----------------------------
        // queue:join -> enqueue + maybe match
        // ----------------------------
        function userHasActiveGame(userId) {
            if (!userId) return false;
            for (const g of games.values()) {
                if (g.status !== 'active') continue;
                if (String(g.white.userId) === String(userId) || String(g.black.userId) === String(userId)) return true;
            }
            return false;
        }

        socket.on("queue:join", async ({ timeControl }) => {
            console.log(`[queue:join] from ${socket.userId} timeControl=${timeControl}`);

            if (!timeControl) return socket.emit("error", { code: "BAD_PAYLOAD", message: "timeControl required" });

            // 1) don't let someone join queue if they already have an active game
            if (userHasActiveGame(socket.userId)) {
                console.warn(`[queue:join] user ${socket.userId} attempted to queue while in active game — ignoring`);
                return socket.emit("queue:error", { code: "ALREADY_IN_GAME", message: "You are already in an active game" });
            }

            // 2) Prevent duplicate queue entries for same user (by userId/socketId)
            removeFromQueues(socket.id);
            removeFromQueues(socket.userId);

            // Enqueue
            enqueue(timeControl, { socketId: socket.id, userId: socket.userId, userDbId: socket.userDbId, timeControl });

            // Try to find a pair
            const pair = dequeuePair(timeControl, (item) => {
                if (userHasActiveGame(item.userId)) return false;
                const s = io.sockets.sockets.get(item.socketId);
                if (!s || s.disconnected) return false;
                return true;
            });

            if (!pair) {
                console.log(`[queue] no pair yet for timeControl=${timeControl}`);
                return;
            }

            const [A, B] = pair;
            const room = await createGameRoom(A, B, timeControl);
            console.log(`[match] created room ${room.id} white.user=${room.white.userId} black.user=${room.black.userId}`);

            // ensure sockets join
            io.sockets.sockets.get(room.white.socketId)?.join(room.id);
            io.sockets.sockets.get(room.black.socketId)?.join(room.id);

            // fetch emails etc
            let whiteEmail = null, blackEmail = null;
            try {
                const [wDoc, bDoc] = await Promise.all([
                    safeFindUserById(room.white.userId),
                    safeFindUserById(room.black.userId),
                ]);
                whiteEmail = wDoc?.email ?? null;
                blackEmail = bDoc?.email ?? null;
            } catch (err) {
                whiteEmail = null; blackEmail = null;
            }

            room.white.email = whiteEmail;
            room.black.email = blackEmail;

            // emit match info including opponent id + email
            io.to(room.white.socketId).emit("queue:matched", {
                gameId: room.id,
                color: "w",
                opponent: { id: room.black.userId, email: blackEmail },
            });
            io.to(room.black.socketId).emit("queue:matched", {
                gameId: room.id,
                color: "b",
                opponent: { id: room.white.userId, email: whiteEmail },
            });

            // emit initial state to the room
            emitState(io, room);
        });

        socket.on("queue:leave", () => {
            console.log(`[queue:leave] ${socket.userId}`);
            removeFromQueues(socket.id);
        });

        // ----------------------------
        // moves + draw/resign
        // ----------------------------
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

            if (move.captured) {
                g.captures[side].push(move.captured);
            }

            g.moves.push({ san: move.san, from, to, fen: g.chess.fen() });
            await recordMoveToDB(g, { san: move.san, from: move.from, to: move.to, captured: move.captured || null });

            io.to(g.id).emit("game:move", {
                san: move.san,
                from, to,
                fen: g.chess.fen(),
                moveNo: g.moves.length,
                clocks: g.clocks,
                captured: move.captured || null,
                captures: g.captures,
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

        // ----------------------------
        // disconnect handling with grace period
        // ----------------------------
        socket.on("disconnect", (reason) => {
            console.log(`[socket] disconnect ${socket.id} user=${socket.userId} reason=${reason}`);
            removeFromQueues(socket.id);

            // remove user->socket mapping
            try {
                removeUserSocket(String(socket.userId));
            } catch (e) {
                console.warn("[sockets] removeUserSocket failed", e && e.message);
            }

            const GRACE_MS = 8000; // 8 seconds – tune as you like

            for (const g of games.values()) {
                if (g.status !== "active") continue;

                let side = null;
                if (g.white.socketId === socket.id) side = "w";
                if (g.black.socketId === socket.id) side = "b";
                if (!side) continue;

                if (pendingResignTimers.has(socket.userId)) continue;

                const timer = setTimeout(async () => {
                    const stillMissing =
                        (side === "w" && (!io.sockets.sockets.get(g.white.socketId) || g.white.userId !== socket.userId)) ||
                        (side === "b" && (!io.sockets.sockets.get(g.black.socketId) || g.black.userId !== socket.userId));

                    if (g.status === "active" && stillMissing) {
                        await endGame(io, g, side === "w" ? "RESIGN_WHITE" : "RESIGN_BLACK", "Disconnect");
                    }
                    pendingResignTimers.delete(socket.userId);
                }, GRACE_MS);

                pendingResignTimers.set(socket.userId, timer);
                console.log(`[disconnect] scheduled resign for user ${socket.userId} in ${GRACE_MS}ms`);
            }
        });
    });

    return io;
}

/**
 * emitState: emit canonical game:state to the whole room.
 * includes handy opponent fields for both white/black perspectives:
 * - opponentIdWhite/opponentEmailWhite  => what white should see as opponent
 * - opponentIdBlack/opponentEmailBlack  => what black should see as opponent
 */
function emitState(io, g) {
    const whiteEmail = g.white?.email ?? null;
    const blackEmail = g.black?.email ?? null;
    io.to(g.id).emit("game:state", {
        fen: g.chess.fen(),
        moves: g.moves,
        turn: g.chess.turn(),
        clocks: g.clocks,
        status: g.status,
        captures: g.captures,
        opponentIdWhite: g.black?.userId || null,
        opponentEmailWhite: blackEmail,
        opponentIdBlack: g.white?.userId || null,
        opponentEmailBlack: whiteEmail,
    });
}

async function endGame(io, g, result, reason) {
    if (g.status === "ended") return;
    g.status = "ended";
    const pgn = g.chess.pgn({ maxWidth: 80, newline: "\n" });
    try {
        await finalizeGameInDB(g, result, reason);
    } catch (err) {
        console.error("[endGame] finalizeGameInDB error", err);
    }
    io.to(g.id).emit("game:ended", { result, reason, pgn });
    console.log(`[END] ${g.id} -> ${result} (${reason})`);
}

/**
 * safeFindUserById: helper wrapper for User.findById that returns null (and logs) instead of throwing.
 * ensures .lean() for a plain object
 */
async function safeFindUserById(id) {
    if (!id) return null;
    try {
        const doc = await User.findById(id).select("email").lean();
        return doc || null;
    } catch (err) {
        console.error("[safeFindUserById] error reading user", id, err && err.message);
        return null;
    }
}

module.exports = { attachSocketServer, emitState };
