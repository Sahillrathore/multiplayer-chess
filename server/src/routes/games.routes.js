// routes/games.routes.js
const express = require("express");
const router = express.Router();
const Game = require("../game/game.model");
const { requireAuth } = require("../auth/authMiddleware");

// GET /games/history?limit=20&skip=0
router.get("/history", requireAuth, async (req, res) => {
  const userId = req.userId; // set by requireAuth from JWT
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = Math.max(0, Number(req.query.skip) || 0);

  const query = { $or: [{ whiteId: req.userDbId }, { blackId: req.userDbId }] };

  const docs = await Game.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select("_id createdAt endedAt result reason timeControl whiteId blackId startFEN moves")
    .lean();

  const items = docs.map(g => ({
    _id: g._id,
    timeControl: g.timeControl,
    startedAt: g.createdAt,
    endedAt: g.endedAt,
    result: g.result,
    youAre: String(g.whiteId) === String(req.userDbId) ? "w" : "b",
    plyCount: g.moves?.length || 0,
  }));

  res.json({ games: items, total: items.length });
});

// GET /games/:id  (full detail for review)
router.get("/:id", requireAuth, async (req, res) => {
  const g = await Game.findById(req.params.id).lean();
  if (!g) return res.status(404).json({ error: "Not found" });

  if (String(g.whiteId) !== String(req.userDbId) && String(g.blackId) !== String(req.userDbId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // We stored fen after every move; send a compact payload for review
  res.json({
    _id: g._id,
    timeControl: g.timeControl,
    startedAt: g.createdAt,
    endedAt: g.endedAt,
    result: g.result,
    startFEN: g.startFEN || "startpos",
    youAre: String(g.whiteId) === String(req.userDbId) ? "w" : "b",
    moves: g.moves?.map(m => ({
      san: m.san, from: m.from, to: m.to, fen: m.fen || null
    })) || [],
    pgn: g.pgn || null,
  });
});

module.exports = router;
