// auth/requireAuth.js
// CommonJS, Node 18+
// Depends on: ../jwt (exporting verify(token)) and ./user.model (Mongoose)

const { verify } = require("../jwt");
const User = require("./user.model");

/**
 * Extract bearer token from:
 *  - Authorization: Bearer <token>
 *  - Cookie: access_token=<token>  (optional)
 */
function getToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (h && typeof h === "string" && h.startsWith("Bearer ")) {
    return h.slice("Bearer ".length).trim();
  }
  // Optional cookie support
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }
  return null;
}

/**
 * Strict guard. 401 when missing/invalid.
 * Attaches: req.userId (string), req.userDbId (ObjectId), req.user (lean POJO)
 */
async function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let payload;
    try {
      payload = verify(token); // should throw on invalid/expired
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await User.findById(payload.sub)
      .select("_id email name role") // select what you need
      .lean();

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // attach to request
    req.userId = String(payload.sub);
    req.userDbId = user._id;
    req.user = user;
    return next();
  } catch (err) {
    console.error("[requireAuth]", err);
    return res.status(500).json({ error: "Auth check failed" });
  }
}

/**
 * Soft guard. If token is present and valid, attaches req.user*;
 * otherwise continues without user (no 401).
 */
async function optionalAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return next();

    let payload;
    try {
      payload = verify(token);
    } catch {
      // ignore invalid token in optional mode
      return next();
    }

    const user = await User.findById(payload.sub)
      .select("_id email name role")
      .lean();
    if (user) {
      req.userId = String(payload.sub);
      req.userDbId = user._id;
      req.user = user;
    }
    return next();
  } catch (err) {
    console.error("[optionalAuth]", err);
    return next(); // never block
  }
}

/**
 * Role guard (use after requireAuth).
 * Example: app.get("/admin", requireAuth, requireRole("admin"), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole };
