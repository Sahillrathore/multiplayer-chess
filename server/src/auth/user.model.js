const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, lowercase: true, unique: true, sparse: true },
  passwordHash: String,        // for email/password users
  provider: { type: String, enum: ["password", "google", "guest"], required: true },
  googleId: { type: String, unique: true, sparse: true },
  rating: { type: Number, default: 1200 },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
