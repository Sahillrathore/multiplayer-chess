// server/src/auth/auth.routes.js
const express = require('express');
const router = express.Router();
const passport = require('./google'); // your passport setup
const { sign } = require('../jwt');
const { me } = require('./auth.controller');

router.get("/me", me);

router.get("/google", (req, res, next) => {
  // Accept redirect path from query (e.g. /join/<token>) and forward as state
  const redirect = req.query.redirect || '/';
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: encodeURIComponent(redirect),
  })(req, res, next);
});

router.get("/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/auth/google/fail" }),
  (req, res) => {
    // Issue JWT token
    const token = sign({ sub: req.user.id });

    // Get the redirect from state (passport returns it in req.query.state)
    const rawState = req.query.state || req.query.redirect || '/';
    const redirectPath = rawState ? decodeURIComponent(rawState) : '/';

    // Ensure it starts with "/" for safety
    const safePath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;

    // Redirect the browser to FRONTEND /auth/callback with redirect query and token in hash
    // Example: https://your-frontend.com/auth/callback?redirect=/join/abc#token=ey...
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?redirect=${encodeURIComponent(safePath)}#token=${token}`;
    res.redirect(redirectUrl);
  }
);

module.exports = router;
