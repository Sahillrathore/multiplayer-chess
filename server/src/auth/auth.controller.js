const bcrypt = require("bcryptjs");
const { sign, verify } = require("../jwt");
const { sendOtpEmail } = require("../mailer");
const User = require("./user.model");
const Otp = require("./otp.model");

// utils
const pub = (u) => ({ id: u.id, email: u.email, provider: u.provider, rating: u.rating });

// JWT protected profile
async function me(req, res) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = verify(token);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    res.json({ user: pub(user) });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// inside module.exports add:
async function guest(req, res) {
  try {
    // create a guest user record with unique placeholder email (sparse unique allowed)
    const tokenSuffix = Math.random().toString(36).slice(2, 9);
    const guestEmail = `guest_${Date.now().toString(36)}_${tokenSuffix}@wechess.local`;

    const user = await User.create({
      email: guestEmail,
      provider: "guest",
      rating: 1200,
    });

    const token = sign({ sub: user.id }); // sign uses auth jwt helper
    res.json({ token, user: { id: user._id, email: user.email, provider: user.provider, rating: user.rating } });
  } catch (err) {
    console.error("[auth.guest] error", err);
    res.status(500).json({ error: "Failed to create guest" });
  }
}

// Google helpers (called by passport strategy)
async function googleSuccessOrCreate(profile) {
  const googleId = profile.id;
  const email = (profile.emails && profile.emails[0]?.value || "").toLowerCase();

  let user = await User.findOne({ googleId });
  if (user) return user;

  if (email) {
    user = await User.findOne({ email });
    if (user) {
      user.googleId = googleId;
      user.provider = "google";
      await user.save();
      return user;
    }
  }

  user = await User.create({ email, provider: "google", googleId });
  return user;
}

module.exports = { me, googleSuccessOrCreate, pub };
