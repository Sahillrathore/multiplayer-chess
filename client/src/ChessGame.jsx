// ChessGame.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { io } from "socket.io-client";
import { FiPlusSquare, FiGrid, FiUsers, FiChevronDown, FiClock } from "react-icons/fi";

// ---- CONFIG
const API_BASE = "http://localhost:4000";
// const timeControl = "120+0"; // OLD: not used anymore (we build it from selected dropdown)

function getToken() {
  return localStorage.getItem("token");
}
function clearToken() {
  localStorage.removeItem("token");
}

export default function ChessGame() {
  // socket in a ref so we can recreate on login/logout
  const socketRef = useRef(null);

  // auth/user
  const [token, setToken] = useState(getToken());
  const isAuthed = !!token;
  const [user, setUser] = useState(null);

  // server/game state
  const [connected, setConnected] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [color, setColor] = useState(null); // 'w' | 'b'
  const [status, setStatus] = useState("idle"); // 'idle' | 'active' | 'ended'
  const [fen, setFen] = useState("start");
  const [moves, setMoves] = useState([]);
  const [turn, setTurn] = useState("w");
  const [clocks, setClocks] = useState({ w: 300000, b: 300000 });

  // --- UI: time control dropdown (in seconds). default 5 min
  const [tcSeconds, setTcSeconds] = useState(300);
  const timeControlStr = useMemo(() => `${tcSeconds}+0`, [tcSeconds]);

  // Sidebar tab
  const [sideTab, setSideTab] = useState("new");

  // Past games (lightweight, safe if your API isn't there yet)
  const [pastGames, setPastGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [gamesErr, setGamesErr] = useState("");

  // optional “review” flag, so loading a past game doesn’t interfere with live play
  const [reviewing, setReviewing] = useState(false);

  const loadPastGames = useCallback(async () => {
    if (!isAuthed) return;
    setLoadingGames(true);
    setGamesErr("");
    try {
      // adjust to your real endpoint/shape
      const res = await fetch(`${API_BASE}/games/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch games");
      setPastGames(Array.isArray(data.games) ? data.games : []);
    } catch (e) {
      setGamesErr(e.message);
      setPastGames([]);
    } finally {
      setLoadingGames(false);
    }
  }, [isAuthed, token]);

  useEffect(() => {
    if (sideTab === "games") loadPastGames();
  }, [sideTab, loadPastGames]);

  // Preview a historical game on the board safely
  const previewGame = useCallback((g) => {
    try {
      const temp = new Chess();
      if (g?.pgn) {
        temp.loadPgn(g.pgn);
      } else if (g?.fen) {
        temp.load(g.fen);
      } else {
        return;
      }
      setFen(temp.fen());
      setMoves(temp.history({ verbose: true }) || []);
      setTurn(temp.turn());
      setStatus("idle");       // keep live flow untouched
      setGameId(null);         // ensure buttons reflect not-in-game
      setReviewing(true);
    } catch (e) {
      console.warn("Failed to preview game:", e);
    }
  }, [setFen, setMoves, setTurn, setStatus, setGameId]);

  // When you start a new game, exit review mode
  useEffect(() => {
    if (status === "active") setReviewing(false);
  }, [status]);


  const chess = useMemo(() => new Chess(), []);
  const moveLog = useMemo(
    () => moves.map((m, i) => `${i % 2 === 0 ? "White" : "Black"}: ${m.san}`),
    [moves]
  );

  // fetch user (optional)
  useEffect(() => {
    let ignore = false;
    async function loadMe() {
      if (!token) { setUser(null); return; }
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!ignore) setUser(res.ok ? data.user : null);
      } catch {
        if (!ignore) setUser(null);
      }
    }
    loadMe();
    return () => { ignore = true; };
  }, [token]);

  // create/destroy socket on token change
  useEffect(() => {
    if (!token) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      setConnected(false);
      return;
    }

    const s = io(API_BASE, { transports: ["websocket"], auth: { token } });
    socketRef.current = s;

    s.on("connect", () => setConnected(true));

    s.on("queue:matched", ({ gameId, color }) => {
      setGameId(gameId);
      setColor(color);
      setStatus("active");
      try { chess.reset(); } catch { }
      setFen(chess.fen());
      setMoves([]);
      setTurn("w");
    });

    s.on("game:state", ({ fen, moves, clocks, turn, status }) => {
      try { chess.load(fen); } catch { }
      setFen(fen);
      setMoves(moves || []);
      setClocks(clocks || { w: 300000, b: 300000 });
      setTurn(turn || chess.turn());
      setStatus(status || "active");
    });

    s.on("game:move", ({ fen, clocks }) => {
      try { chess.load(fen); } catch { }
      setFen(fen);
      setClocks(clocks);
      setTurn(chess.turn());
    });

    s.on("game:ended", ({ result, reason, pgn }) => {
      setStatus("ended");
      alert(`${result} — ${reason}\n\n${pgn}`);
    });

    s.on("game:drawOffered", ({ by }) => {
      const accept = window.confirm(`Opponent offered a draw. Accept?`);
      if (accept && gameId) s.emit("game:acceptDraw", { gameId });
    });

    s.on("error", (e) => console.warn("[server-error]", e));

    return () => {
      s.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  // actions
  const findMatch = () => {
    if (!isAuthed) return alert("Please sign in first.");
    // send same payload key; only value is built from dropdown
    socketRef.current?.emit("queue:join", { timeControl: timeControlStr });
  };
  const offerDraw = () => gameId && socketRef.current?.emit("game:offerDraw", { gameId });
  const resign = () => gameId && socketRef.current?.emit("game:resign", { gameId });
  const logout = () => {
    clearToken();
    setToken(null);
    setUser(null);
    setGameId(null);
    setStatus("idle");
    setMoves([]);
    setFen("start");
    setColor(null);
  };

  // Drag-drop
  const onDrop = useCallback(
    (sourceSquare, targetSquare) => {
      if (status !== "active" || !gameId) return false;
      if (color !== turn) return false;
      const test = new Chess(fen);
      const mv = test.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!mv) return false;

      socketRef.current?.emit("game:move", {
        gameId, from: sourceSquare, to: targetSquare, promotion: mv.promotion || "q",
      });
      return true;
    },
    [status, gameId, color, turn, fen]
  );

  const statusText = useMemo(() => {
    if (!isAuthed) return "Sign in to play";
    if (status !== "active") return status === "ended" ? "Game Over" : "Press Start Game";
    return `${turn === "w" ? "White" : "Black"} to move`;
  }, [isAuthed, status, turn]);

  // ------------------ UI ------------------
  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 relative overflow-hidden">
      {/* ambient gradients + grid like AuthPage */}
      <div className="pointer-events-none absolute -inset-40 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,.18),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(244,63,94,.15),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(250,204,21,.12),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(255,255,255,0.06)_25%,rgba(255,255,255,0.06)_26%,transparent_27%,transparent_74%,rgba(255,255,255,0.06)_75%,rgba(255,255,255,0.06)_76%,transparent_77%),linear-gradient(90deg,transparent_24%,rgba(255,255,255,0.06)_25%,rgba(255,255,255,0.06)_26%,transparent_27%,transparent_74%,rgba(255,255,255,0.06)_75%,rgba(255,255,255,0.06)_76%,transparent_77%)] bg-[size:48px_48px] opacity-30" />

      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        {/* top status bar */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs sm:text-sm text-zinc-300">
            {isAuthed ? (connected ? "Connected" : "Connecting…") : "Not signed in"} · {status} · You are {color ?? "—"} · TC {timeControlStr}
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">
              W: {Math.ceil(clocks.w / 1000)}s · B: {Math.ceil(clocks.b / 1000)}s
            </div>
            {isAuthed ? (
              <>
                <div className="hidden sm:block rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-200">
                  {user?.email || "Player"}
                </div>
                <button
                  onClick={logout}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                >
                  Logout
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
              >
                Login
              </a>
            )}
          </div>
        </div>

        <div className="grid gap-12 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          {/* LEFT: Board card */}
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 blur opacity-50" />
            <div className="relative rounded-2xl bg-zinc-900/70 ring-1 ring-white/10 backdrop-blur-xl p-4 md:p-6">
              <div className={`mb-3 text-center text-base md:text-lg font-semibold ${status === "active" && chess.inCheck() ? "text-rose-400" : "text-zinc-200"}`}>
                {statusText}
              </div>

              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
                arePiecesDraggable={isAuthed && status === "active" && color === turn}
                boardOrientation={color === "b" ? "black" : "white"}
                animationDuration={200}
                customBoardStyle={{ borderRadius: "10px", boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}
                // chess.com-like colors
                customDarkSquareStyle={{ backgroundColor: "#769656" }}
                customLightSquareStyle={{ backgroundColor: "#eeeed2" }}
              />

              {/* controls under board */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {/* time dropdown */}
                <div className="relative">
                  <select
                    value={tcSeconds}
                    onChange={(e) => setTcSeconds(Number(e.target.value))}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 outline-none focus:ring-2 focus:ring-indigo-500/60"
                    title="Select time control"
                  >
                    <option value={60}>1 min (Bullet)</option>
                    <option value={180}>3 min (Blitz)</option>
                    <option value={300}>5 min (Blitz)</option>
                    <option value={600}>10 min (Rapid)</option>
                  </select>
                </div>

                <button
                  onClick={findMatch}
                  disabled={!isAuthed}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition
                    ${isAuthed ? "bg-emerald-500 hover:bg-emerald-500/90" : "bg-emerald-500/50 cursor-not-allowed"}`}
                >
                  Start Game
                </button>

                <button
                  onClick={offerDraw}
                  disabled={!gameId || status !== "active"}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition
                    ${!gameId || status !== "active"
                      ? "bg-amber-500/50 cursor-not-allowed"
                      : "bg-amber-500 hover:bg-amber-500/90"}`}
                >
                  Offer Draw
                </button>

                <button
                  onClick={resign}
                  disabled={!gameId || status !== "active"}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition
                    ${!gameId || status !== "active"
                      ? "bg-rose-500/50 cursor-not-allowed"
                      : "bg-rose-500 hover:bg-rose-500/90"}`}
                >
                  Resign
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Sidebar like chess.com */}
          <div className="space-y-4">
            {/* ---- Tab bar ---- */}
            <div className="rounded-2xl bg-[#1f1f1f] ring-1 ring-white/10 p-2 flex items-center gap-2">
              <button
                onClick={() => setSideTab("new")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm
        ${sideTab === "new" ? "bg-[#2a2a2a] text-white" : "text-zinc-300 hover:bg-white/5"}`}
                title="New Game"
              >
                <FiPlusSquare /> <span className="hidden sm:inline">New Game</span>
              </button>
              <button
                onClick={() => setSideTab("games")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm
        ${sideTab === "games" ? "bg-[#2a2a2a] text-white" : "text-zinc-300 hover:bg-white/5"}`}
                title="Games"
              >
                <FiGrid /> <span className="hidden sm:inline">Games</span>
              </button>
              <button
                onClick={() => setSideTab("players")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm
        ${sideTab === "players" ? "bg-[#2a2a2a] text-white" : "text-zinc-300 hover:bg-white/5"}`}
                title="Players"
              >
                <FiUsers /> <span className="hidden sm:inline">Players</span>
              </button>
            </div>

            {/* ---- NEW GAME panel (your original controls) ---- */}
            {sideTab === "new" && (
              <>
                {/* Mode card */}
                <div className="relative">
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 blur opacity-40" />
                  <div className="relative rounded-2xl bg-zinc-900/70 ring-1 ring-white/10 backdrop-blur-xl p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <FiClock className="opacity-80" /> Time Control
                      </div>
                      <div className="flex items-center gap-1 text-zinc-400 text-xs">
                        {tcSeconds === 600 ? "10 min (Rapid)" :
                          tcSeconds === 300 ? "5 min (Blitz)" :
                            tcSeconds === 180 ? "3 min (Blitz)" : "1 min (Bullet)"} <FiChevronDown />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[60, 180, 300, 600].map((s) => (
                        <button
                          key={s}
                          onClick={() => setTcSeconds(s)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition
                  ${tcSeconds === s
                              ? "border-indigo-400/60 bg-white/10 text-white ring-2 ring-indigo-500/40"
                              : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"}`}
                        >
                          {s === 60 ? "1 min" : s === 180 ? "3 min" : s === 300 ? "5 min" : "10 min"}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4">
                      <button
                        onClick={findMatch}
                        disabled={!isAuthed}
                        className={`w-full rounded-xl px-4 py-3 text-sm font-extrabold shadow-lg transition
                ${isAuthed ? "bg-[#7cc44e] text-[#1b2314] hover:bg-[#86cf57]" : "bg-[#7cc44e]/60 text-[#1b2314]/60 cursor-not-allowed"}`}
                      >
                        Start Game
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={offerDraw}
                        disabled={!gameId || status !== "active"}
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition
                ${!gameId || status !== "active"
                            ? "bg-amber-500/50 cursor-not-allowed"
                            : "bg-amber-500 hover:bg-amber-500/90"}`}
                      >
                        Custom Challenge
                      </button>
                      <button
                        onClick={resign}
                        disabled={!gameId || status !== "active"}
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition
                ${!gameId || status !== "active"
                            ? "bg-rose-500/50 cursor-not-allowed"
                            : "bg-rose-500 hover:bg-rose-500/90"}`}
                      >
                        Play a Friend
                      </button>
                    </div>

                    <button
                      type="button"
                      className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10"
                    >
                      Tournaments
                    </button>
                  </div>
                </div>

                {/* Player strip */}
                <div className="rounded-2xl bg-zinc-900/70 ring-1 ring-white/10 backdrop-blur-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-300">
                      {user?.email || "You"} {color ? `(${color === "w" ? "White" : "Black"})` : ""}
                    </div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs">
                      {Math.ceil((color === "w" ? clocks.w : clocks.b) / 1000)}s
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ---- GAMES panel ---- */}
            {sideTab === "games" && (
              <div className="relative">
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 blur opacity-30" />
                <div className="relative rounded-2xl bg-zinc-900/70 ring-1 ring-white/10 backdrop-blur-xl p-4">
                  <h2 className="mb-2 text-sm font-semibold text-zinc-200">Your Games</h2>

                  {!isAuthed && (
                    <div className="text-xs text-zinc-400">Sign in to see your game history.</div>
                  )}

                  {isAuthed && (
                    <>
                      {loadingGames && <div className="text-xs text-zinc-400">Loading…</div>}
                      {gamesErr && <div className="text-xs text-rose-400">{gamesErr}</div>}

                      <div className="mt-2 max-h-[460px] overflow-y-auto space-y-2">
                        {(!loadingGames && pastGames.length === 0) && (
                          <div className="text-xs text-zinc-400 italic">No games yet</div>
                        )}

                        {pastGames.map((g) => (
                          <div
                            key={g.id || g._id || `${g.startedAt}-${g.result}`}
                            className="rounded-xl border border-white/10 bg-white/5 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-zinc-300">
                                {g.opponent?.name || "Opponent"} · {g.result || "—"} · {(g.timeControl || "").toString()}
                              </div>
                              <button
                                onClick={() => previewGame(g)}
                                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"
                              >
                                Load on board
                              </button>
                            </div>
                            {g.startedAt && (
                              <div className="mt-1 text-[11px] text-zinc-500">
                                {new Date(g.startedAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {reviewing && (
                        <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
                          Viewing a past game on the board (review mode). Start a new game to return to live play.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ---- PLAYERS placeholder ---- */}
            {sideTab === "players" && (
              <div className="rounded-2xl bg-zinc-900/70 ring-1 ring-white/10 backdrop-blur-xl p-4">
                <div className="text-xs text-zinc-400">Players list coming soon.</div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
