const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema({
  email: { type: String, lowercase: true, index: true, required: true },
  code: { type: String, required: true },
  // TTL: expires 5 minutes after creation
  createdAt: { type: Date, default: Date.now, expires: 300 },
});

module.exports = mongoose.model("Otp", OtpSchema);
