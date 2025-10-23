const bcrypt = require("bcryptjs");
const { sign, verify } = require("../jwt");
const { sendOtpEmail } = require("../mailer");
const User = require("./user.model");
const Otp = require("./otp.model");

// utils
const pub = (u) => ({ id: u.id, email: u.email, provider: u.provider, rating: u.rating });

// 1) Request OTP
async function requestOtp(req, res) {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email required" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await Otp.create({ email: email.toLowerCase(), code });
  try {
    await sendOtpEmail(email, code);
  } catch (e) {
    console.error("sendOtpEmail failed", e);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
  res.json({ ok: true });
}

// 2) Signup (verify OTP + set password)
async function signup(req, res) {
  const { email, otp, password } = req.body || {};
  if (!email || !otp || !password) return res.status(400).json({ error: "email, otp, password required" });

  const found = await Otp.findOne({ email: email.toLowerCase(), code: otp });
  if (!found) return res.status(400).json({ error: "Invalid or expired OTP" });
  await Otp.deleteMany({ email: email.toLowerCase() }); // consume OTPS

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(400).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email: email.toLowerCase(), passwordHash, provider: "password" });
  const token = sign({ sub: user.id });
  res.json({ token, user: pub(user) });
}

// 3) Login (email/password)
async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const user = await User.findOne({ email: email.toLowerCase(), provider: "password" });
  if (!user) return res.status(400).json({ error: "No such user" });
  const ok = await bcrypt.compare(password, user.passwordHash || "");
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = sign({ sub: user.id });
  res.json({ token, user: pub(user) });
}

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

module.exports = { requestOtp, signup, login, me, googleSuccessOrCreate, pub };
