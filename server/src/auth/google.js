const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { GOOGLE } = require("../config");
const { googleSuccessOrCreate } = require("./auth.controller");

passport.use(new GoogleStrategy({
  clientID: GOOGLE.clientID,
  clientSecret: GOOGLE.clientSecret,
  callbackURL: GOOGLE.callbackURL,
}, async (_at, _rt, profile, done) => {
  try { const user = await googleSuccessOrCreate(profile); done(null, user); }
  catch (e) { done(e); }
}));

module.exports = passport;
