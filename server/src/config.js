require("dotenv").config();

const ORIGINS = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);

module.exports = {
  PORT: process.env.PORT || 4000,
  ORIGINS: ORIGINS.length ? ORIGINS : ["http://localhost:5173", "http://localhost:3000"],
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES: process.env.JWT_EXPIRES,
  SMTP: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM
  },
  GOOGLE: {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
};
