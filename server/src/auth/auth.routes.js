const express = require("express");
const router = express.Router();
const passport = require("./google");
const { requestOtp, signup, login, me } = require("./auth.controller");
const { sign } = require("../jwt");

// JSON body
router.use(express.json());

// Email flows
router.post("/email/request-otp", requestOtp);
router.post("/email/signup", signup);
router.post("/email/login", login);
router.get("/me", me);

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/auth/google/fail" }),
  (req, res) => {
    const token = sign({ sub: req.user.id });
    const redirect = new URL("http://localhost:5173/auth/callback"); // change for your FE
    res.redirect(`${redirect.toString()}#token=${token}`);
  }
);
router.get("/google/fail", (_req, res) => res.status(401).send("Google auth failed"));

module.exports = router;
