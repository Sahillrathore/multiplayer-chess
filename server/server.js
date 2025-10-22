// server.js (Node 18+)
// npm i express socket.io chess.js
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");

const app = express();
const server = http.createServer(app);

// ⚠️ Set this to your frontend origin(s)
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5174", "http://localhost:3000"],
        methods: ["GET", "POST"],
    },
});

const queues = new Map(); // key: timeControl string, val: Array<QueueItem>
const games = new Map();  // key: gameId, val: GameRoom

function enqueue(timeControl, item) {
    if (!queues.has(timeControl)) queues.set(timeControl, []);
    queues.get(timeControl).push(item);
}
function dequeuePair(timeControl) {
    const q = queues.get(timeControl) || [];
    if (q.length >= 2) {
        const a = q.shift();
        const b = q.shift();
        return [a, b];
    }
    return null;
}
function makeGameId() {
    return Math.random().toString(36).slice(2, 10);
}
function parseTC(tc) {
    const [base, inc] = tc.split("+").map(Number);
    return { base, inc }; // seconds
}
function now() { return Date.now(); }
function startClocks(tc) {
    const ms = tc.base * 1000;
    return { w: ms, b: ms };
}
function activeSide(g) {
    return g.chess.turn(); // 'w' or 'b'
}
function tickClocks(g) {
    if (g.status !== "active") return;
    const elapsed = now() - g.turnStamp;
    if (activeSide(g) === "w") g.clocks.w = Math.max(0, g.clocks.w - elapsed);
    else g.clocks.b = Math.max(0, g.clocks.b - elapsed);
    g.turnStamp = now();
}
function applyIncrement(g, side) {
    g.clocks[side] += g.tc.inc * 1000;
}
function emitState(g) {
    io.to(g.id).emit("game:state", {
        fen: g.chess.fen(),
        moves: g.moves,
        turn: g.chess.turn(),
        clocks: g.clocks,
        status: g.status,
    });
}
function endGame(g, result, reason) {
    if (g.status === "ended") return;
    g.status = "ended";
    const pgn = g.chess.pgn({ maxWidth: 80, newline: "\n" });
    io.to(g.id).emit("game:ended", { result, reason, pgn });
    console.log(`[END] ${g.id} -> ${result} (${reason})`);
}

io.on("connection", (socket) => {
    console.log("[SOCKET] connected", socket.id);

    socket.on("queue:join", ({ userId, timeControl }) => {
        if (!userId || !timeControl) {
            socket.emit("error", { code: "BAD_PAYLOAD", message: "userId & timeControl required" });
            return;
        }
        console.log(`[QUEUE] ${socket.id} user=${userId} tc=${timeControl} joined`);
        enqueue(timeControl, { socketId: socket.id, userId, timeControl });

        // Try match
        const pair = dequeuePair(timeControl);
        if (!pair) return;

        const [A, B] = pair;
        const gameId = makeGameId();
        const tc = parseTC(timeControl);
        const chess = new Chess();

        // randomize colors
        const AisWhite = Math.random() < 0.5;
        const white = AisWhite ? A : B;
        const black = AisWhite ? B : A;

        const room = {
            id: gameId,
            chess,
            status: "active",
            white: { socketId: white.socketId, userId: white.userId, color: "w" },
            black: { socketId: black.socketId, userId: black.userId, color: "b" },
            tc,
            clocks: startClocks(tc),
            turnStamp: now(),
            moves: [],
            drawOfferedBy: null,
        };

        games.set(gameId, room);

        io.sockets.sockets.get(white.socketId)?.join(gameId);
        io.sockets.sockets.get(black.socketId)?.join(gameId);

        io.to(white.socketId).emit("queue:matched", { gameId, color: "w", opponent: room.black.userId });
        io.to(black.socketId).emit("queue:matched", { gameId, color: "b", opponent: room.white.userId });

        console.log(`[MATCH] game=${gameId} white=${room.white.userId} black=${room.black.userId} tc=${timeControl}`);
        emitState(room);
    });

    socket.on("queue:leave", () => {
        // remove from any queue
        for (const [tc, arr] of queues) {
            const idx = arr.findIndex(q => q.socketId === socket.id);
            if (idx !== -1) {
                arr.splice(idx, 1);
                console.log(`[QUEUE] ${socket.id} left tc=${tc}`);
            }
        }
    });

    // server.js (only showing the move handler with extra logs)
    socket.on("game:move", ({ gameId, from, to, promotion }) => {
        const g = games.get(gameId);
        if (!g || g.status !== "active") return;

        const side = g.chess.turn(); // 'w' or 'b'
        const playerSocket = side === "w" ? g.white.socketId : g.black.socketId;
        if (playerSocket !== socket.id) {
            console.log(`[MOVE] rejected NOT_YOUR_TURN game=${gameId} sid=${socket.id} expected=${playerSocket}`);
            socket.emit("error", { code: "NOT_YOUR_TURN", message: "Wait for your turn" });
            return;
        }

        tickClocks(g);
        if ((side === "w" && g.clocks.w <= 0) || (side === "b" && g.clocks.b <= 0)) {
            endGame(g, side === "w" ? "TIMEOUT_WHITE" : "TIMEOUT_BLACK", "Timeout");
            return;
        }

        const move = g.chess.move({ from, to, promotion });
        if (!move) {
            console.log(`[MOVE] rejected ILLEGAL_MOVE game=${gameId} ${from}-${to}`);
            socket.emit("error", { code: "ILLEGAL_MOVE", message: "Illegal move" });
            return;
        }

        applyIncrement(g, side);
        g.moves.push({ san: move.san, from, to, fen: g.chess.fen() });
        io.to(g.id).emit("game:move", {
            san: move.san, from, to, fen: g.chess.fen(), moveNo: g.moves.length, clocks: g.clocks
        });

        if (g.chess.isCheckmate()) { endGame(g, side === "w" ? "WHITE_WIN" : "BLACK_WIN", "Checkmate"); return; }
        if (g.chess.isDraw()) { endGame(g, "DRAW", "Draw (stalemate/insufficient/50-move/repetition)"); return; }

        g.turnStamp = Date.now();
        emitState(g);
    });

    socket.on("game:offerDraw", ({ gameId }) => {
        const g = games.get(gameId);
        console.log(g);
        
        if (!g || g.status !== "active") return;
        const side = socket.id === g.white.socketId ? "w" : socket.id === g.black.socketId ? "b" : null;
        if (!side) return;
        g.drawOfferedBy = side;
        const other = side === "w" ? g.black.socketId : g.white.socketId;
        io.to(other).emit("game:drawOffered", { by: side });
    });

    socket.on("game:acceptDraw", ({ gameId }) => {
        const g = games.get(gameId);
        if (!g || g.status !== "active") return;
        endGame(g, "DRAW", "Agreed draw");
    });

    socket.on("game:resign", ({ gameId }) => {
        const g = games.get(gameId);
        if (!g || g.status !== "active") return;
        const side = socket.id === g.white.socketId ? "w" : socket.id === g.black.socketId ? "b" : null;
        if (!side) return;
        endGame(g, side === "w" ? "RESIGN_WHITE" : "RESIGN_BLACK", "Resignation");
    });

    socket.on("disconnect", () => {
        console.log("[SOCKET] disconnected", socket.id);
        // remove from queues
        for (const arr of queues.values()) {
            const idx = arr.findIndex(q => q.socketId === socket.id);
            if (idx !== -1) arr.splice(idx, 1);
        }
        // simple: resign if in active game
        for (const g of games.values()) {
            if (g.status !== "active") continue;
            if (g.white.socketId === socket.id) endGame(g, "RESIGN_WHITE", "Disconnect");
            if (g.black.socketId === socket.id) endGame(g, "RESIGN_BLACK", "Disconnect");
        }
    });
});

const PORT = 4000;
server.listen(PORT, () => {
    console.log(`Realtime server on http://localhost:${PORT}`);
});
