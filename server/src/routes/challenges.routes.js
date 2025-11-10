// server/src/routes/challenges.routes.js
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../auth/authMiddleware");
const Challenge = require("../game/challenge.model");
const User = require("../auth/user.model");
const { createGameRoom } = require("../game/game.service");
const { nanoid } = require("nanoid"); // add to package.json if missing
const { getSocketIdForUser, emitToSocketId } = require("../game/socketUtils");

const INVITE_TTL_HOURS = 1;

function makeInviteToken() {
    // short friendly token
    return nanoid(8);
}

// create challenge (auth required)
router.post("/", requireAuth, async (req, res) => {
    try {
        const { timeControl } = req.body;
        if (!timeControl) return res.status(400).json({ error: "timeControl required" });

        const inviterId = req.userId;      // set by requireAuth
        const inviterDbId = req.userDbId;  // if your middleware sets this
        const inviterDoc = await User.findById(inviterDbId).select("email").lean();

        const token = makeInviteToken();
        const expiresAt = new Date(Date.now() + (INVITE_TTL_HOURS * 60 * 60 * 1000));

        const ch = await Challenge.create({
            inviteToken: token,
            inviterId: inviterDbId,
            inviterEmail: inviterDoc?.email || null,
            timeControl,
            expiresAt,
        });

        const link = `${process.env.FRONTEND_URL || "http://localhost:3000"}/join/${token}`;
        res.json({ inviteToken: token, link, expiresAt });
    } catch (err) {
        console.error("[challenges.create] error", err);
        res.status(500).json({ error: "Failed to create challenge" });
    }
});

// preview challenge
router.get("/:token", async (req, res) => {
    try {
        const ch = await Challenge.findOne({ inviteToken: req.params.token }).lean();
        if (!ch) return res.status(404).json({ error: "Not found" });
        if (ch.expiresAt < new Date() || ch.status !== "pending") {
            return res.status(410).json({ error: "Invite not available" });
        }
        res.json({
            inviteToken: ch.inviteToken,
            inviterEmail: ch.inviterEmail,
            timeControl: ch.timeControl,
            expiresAt: ch.expiresAt,
        });
    } catch (err) {
        console.error("[challenges.get] error", err);
        res.status(500).json({ error: "Failed to fetch challenge" });
    }
});

// join challenge (auth required — callers should ensure token exists or call guest flow first)
// POST /challenges/:token/join
router.post("/:token/join", requireAuth, async (req, res) => {
    try {
        const token = req.params.token;
        const ch = await Challenge.findOne({ inviteToken: token });
        if (!ch) return res.status(404).json({ error: "Invite not found" });
        if (ch.status !== "pending" || (ch.expiresAt && ch.expiresAt < new Date())) {
            return res.status(410).json({ error: "Invite not available" });
        }

        if (String(ch.inviterId) === String(req.userDbId)) {
            return res.status(400).json({ error: "Cannot join your own invite" });
        }

        // Attempt to get current socket ids (may be null)
        const inviterSocketId = getSocketIdForUser(String(ch.inviterId));
        const joinerSocketId = getSocketIdForUser(String(req.userId)) || null;

        const a = { socketId: inviterSocketId, userId: String(ch.inviterId), userDbId: ch.inviterId, timeControl: ch.timeControl };
        const b = { socketId: joinerSocketId, userId: String(req.userId), userDbId: req.userDbId, timeControl: ch.timeControl };

        // create the room (persists Game and returns in-memory room)
        const room = await createGameRoom(a, b, ch.timeControl);

        // set invite accepted
        ch.status = "accepted";
        await ch.save();

        // fetch emails for clarity
        const [whiteEmailDoc, blackEmailDoc] = await Promise.all([
            User.findById(room.white.userDbId).select("email").lean(),
            User.findById(room.black.userDbId).select("email").lean(),
        ]);
        const whiteEmail = whiteEmailDoc?.email ?? null;
        const blackEmail = blackEmailDoc?.email ?? null;
        room.white.email = whiteEmail;
        room.black.email = blackEmail;

        // determine joiner's color & opponent
        const yourColor = String(room.white.userId) === String(req.userId) ? "w" : "b";
        const opponent = yourColor === "w"
            ? { id: room.black.userId, email: blackEmail }
            : { id: room.white.userId, email: whiteEmail };

        // emit queue:matched to both sockets if available (use socketUtils.emitToSocketId)
        try {
            if (room.white.socketId) emitToSocketId(room.white.socketId, "queue:matched", { gameId: room.id, color: "w", opponent: { id: room.black.userId, email: blackEmail } });
            if (room.black.socketId) emitToSocketId(room.black.socketId, "queue:matched", { gameId: room.id, color: "b", opponent: { id: room.white.userId, email: whiteEmail } });
        } catch (e) {
            console.warn("[challenges.join] emitToSocketId warning", e && e.message);
        }

        // Return both room.id (short in-memory id) and the persistent DB id
        res.json({
            gameId: room.id,            // room id used by sockets/in-memory set
            gameDbId: room.gameDbId,    // MongoDB _id of the persisted Game document (ObjectId)
            yourColor,
            opponent,
        });
    } catch (err) {
        console.error("[challenges.join] error", err);
        res.status(500).json({ error: "Failed to join invite" });
    }
});

module.exports = router;
