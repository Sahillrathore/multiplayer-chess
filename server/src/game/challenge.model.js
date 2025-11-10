// server/src/game/challenge.model.js
const mongoose = require("mongoose");

const ChallengeSchema = new mongoose.Schema({
  inviteToken: { type: String, index: true, unique: true, required: true },
  inviterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  inviterEmail: { type: String },
  timeControl: { type: String, required: true }, // e.g. "300+0"
  status: { type: String, enum: ["pending", "accepted", "expired", "cancelled"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  meta: { type: Object },
}, { timestamps: true });

module.exports = mongoose.model("Challenge", ChallengeSchema);
