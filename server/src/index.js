const http = require("http");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("./auth/google"); // initialize strategy
const { connectDB } = require("./db");
const { PORT, ORIGINS } = require("./config");
const authRoutes = require("./auth/auth.routes");
const gamesRoutes = require("./routes/games.routes");
const { attachSocketServer } = require("./game/sockets");

(async () => {
  await connectDB();

  const app = express();
  app.use(cors({ origin: ORIGINS, credentials: true }));
  app.use(cookieParser());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRoutes);
  app.use("/games", gamesRoutes);

  const server = http.createServer(app);
  attachSocketServer(server);

  server.listen(PORT, () => console.log(`API + Realtime on http://localhost:${PORT}`));
})();
