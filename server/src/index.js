// server/src/index.js
const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

require("./auth/google"); // initialize passport strategy (side-effect import)
const { connectDB } = require("./db");
const { PORT = 4000, ORIGINS = [] } = require("./config");
const authRoutes = require("./auth/auth.routes");
const gamesRoutes = require("./routes/games.routes");
const { attachSocketServer } = require("./game/sockets");

// Initialize DB once (ok in serverless—runs on cold start)
connectDB().catch((err) => {
  console.error("DB connection failed:", err);
});

const app = express();

// CORS / parsers
app.use(
  cors({
    origin: ORIGINS,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Routes
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/test", (_req, res) => res.json({ message: "API is working" }));
app.use("/auth", authRoutes);
app.use("/games", gamesRoutes);

// Export the Express app for Vercel serverless
module.exports = app;

// ---- Local-only server (for dev or non-Vercel hosting) ----
// Vercel sets process.env.VERCEL = '1' in serverless runtime.
// Socket.io (long-lived websockets) is NOT supported in Node serverless functions.
// Run this branch locally or on a traditional VM/container host.
if (require.main === module && process.env.VERCEL !== "1") {
  const server = http.createServer(app);
  attachSocketServer(server); // start your socket server only in long-lived envs
  server.listen(PORT, () =>
    console.log(`API + Realtime on http://localhost:${PORT}`)
  );
}
