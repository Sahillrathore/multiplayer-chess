// game.service.js

const { Chess } = require("chess.js");
const Game = require("./game.model");

const games = new Map(); // live rooms in memory

function makeId() { return Math.random().toString(36).slice(2, 10); }
function parseTC(tc) { const [b, i] = tc.split("+").map(Number); return { base: b, inc: i }; }
const now = () => Date.now();
function startClocks(tc) { const ms = tc.base * 1000; return { w: ms, b: ms }; }
function activeSide(g) { return g.chess.turn(); }
function tickClocks(g) {
  if (g.status !== "active") return;
  const elapsed = now() - g.turnStamp;
  if (activeSide(g) === "w") g.clocks.w = Math.max(0, g.clocks.w - elapsed);
  else g.clocks.b = Math.max(0, g.clocks.b - elapsed);
  g.turnStamp = now();
}
function applyIncrement(g, side) { g.clocks[side] += g.tc.inc * 1000; }

async function createGameRoom(a, b, timeControl) {
  const id = makeId();
  const tc = parseTC(timeControl);
  const chess = new Chess();

  const aIsWhite = Math.random() < 0.5;
  const white = aIsWhite ? a : b;
  const black = aIsWhite ? b : a;

  // Persist game header immediately
  const gameDoc = await Game.create({
    timeControl,
    whiteId: white.userDbId,
    blackId: black.userDbId,
    startFEN: "startpos",
  });

  const room = {
    id,
    gameDbId: gameDoc._id,
    chess,
    status: "active",
    white: { socketId: white.socketId, userId: white.userId, color: "w" },
    black: { socketId: black.socketId, userId: black.userId, color: "b" },
    tc,
    clocks: startClocks(tc),
    turnStamp: now(),
    moves: [],
    captures: { w: [], b: [] }, // <- store captured piece types per capturer ('p','n','b','r','q','k' rarely)
    drawOfferedBy: null,
  };
  games.set(id, room);
  return room;
}

async function recordMoveToDB(room, move) {
  await Game.updateOne(
    { _id: room.gameDbId },
    { $push: { moves: { san: move.san, from: move.from, to: move.to, fen: room.chess.fen() } } }
  );
}

async function finalizeGameInDB(room, result, reason) {
  await Game.updateOne(
    { _id: room.gameDbId },
    { $set: { endedAt: new Date(), result, reason, endFEN: room.chess.fen(), pgn: room.chess.pgn({ maxWidth: 80, newline: "\n" }) } }
  );
}

module.exports = {
  games,
  createGameRoom,
  tickClocks,
  applyIncrement,
  recordMoveToDB,
  finalizeGameInDB,
};
