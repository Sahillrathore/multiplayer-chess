const mongoose = require("mongoose");

const MoveSchema = new mongoose.Schema({
  san: String,
  from: String,
  to: String,
  fen: String,
  ts: { type: Date, default: Date.now },
}, { _id: false });

const GameSchema = new mongoose.Schema({
  timeControl: { type: String, required: true }, // e.g., "300+0"
  whiteId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  blackId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  result: String,        // "WHITE_WIN", "DRAW", etc.
  reason: String,
  startFEN: { type: String, default: "startpos" },
  endFEN: String,
  pgn: String,
  moves: [MoveSchema],
}, { timestamps: true });

module.exports = mongoose.model("Game", GameSchema);
