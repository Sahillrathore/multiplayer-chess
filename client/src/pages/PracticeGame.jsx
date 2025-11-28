// src/components/PracticeGame.jsx
import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
    useCallback,
} from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

/**
 * PracticeGame (compat with chess.js v1 and v2)
 * - Self-contained practice/bot component
 * - No sockets, no redux
 * - Uses chess.js + react-chessboard
 */

const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
const fmt = (ms) => {
    if (ms == null) return "--:--";
    if (ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${pad2(s)}`;
};

function evaluateBoardSimple(c) {
    const pieceVal = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    const board = c.board();
    let score = 0;
    for (let r = 0; r < board.length; r++) {
        for (let f = 0; f < board[r].length; f++) {
            const p = board[r][f];
            if (!p) continue;
            const v = pieceVal[p.type] || 0;
            score += p.color === "w" ? v : -v;
        }
    }
    return score;
}

function legalMovesFor(c) {
    return c.moves({ verbose: true });
}

// tiny minimax
function computeBestMoveMiniMax(fenStr, maxDepth = 1, preferRandomness = 0.2) {
    const c = new Chess(fenStr === "start" ? undefined : fenStr);
    const moves = legalMovesFor(c);
    if (!moves || moves.length === 0) return null;
    if (maxDepth <= 0 || moves.length === 1) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    let bestMove = null;
    let bestScore = -Infinity;

    for (const m of moves) {
        c.move({ from: m.from, to: m.to, promotion: m.promotion || "q" });

        const oppMoves = legalMovesFor(c);
        let worstForUs = Infinity;

        if (oppMoves.length === 0) {
            worstForUs = evaluateBoardSimple(c);
        } else {
            for (const om of oppMoves) {
                c.move({ from: om.from, to: om.to, promotion: om.promotion || "q" });
                const val = evaluateBoardSimple(c);
                if (val < worstForUs) worstForUs = val;
                c.undo();
            }
        }

        c.undo();

        let score = -worstForUs;
        if (Math.random() < preferRandomness) score -= Math.random() * 30;

        if (score > bestScore) {
            bestScore = score;
            bestMove = m;
        }
    }
    return bestMove;
}

/* ----------------------
   Compatibility helpers
   ---------------------- */

function isGameOver(chessInstance) {
    if (typeof chessInstance.game_over === "function") return chessInstance.game_over();
    if (typeof chessInstance.isGameOver === "function") return chessInstance.isGameOver();
    return false;
}

function isInCheck(chessInstance) {
    if (typeof chessInstance.in_check === "function") return chessInstance.in_check();
    if (typeof chessInstance.isCheck === "function") return chessInstance.isCheck();
    return false;
}

// Time control options (in seconds)
const TIME_CONTROLS = [
    { label: "1 min", value: 60 },
    { label: "3 min", value: 180 },
    { label: "5 min", value: 300 },
    { label: "10 min", value: 600 },
];

export default function PracticeGame() {
    // chess state
    const [fen, setFen] = useState("start");
    const chessRef = useRef(new Chess());
    const [moves, setMoves] = useState([]);
    const [turn, setTurn] = useState("w");
    const [userColor, setUserColor] = useState("w");
    const [botColor, setBotColor] = useState("b");
    const [boardFlipped, setBoardFlipped] = useState(false);

    // promotion
    const [pendingPromotion, setPendingPromotion] = useState(null);

    // default 5min
    const defaultSeconds = 300;
    const [tcSeconds, setTcSeconds] = useState(defaultSeconds);
    const [clocks, setClocks] = useState({
        w: defaultSeconds * 1000,
        b: defaultSeconds * 1000,
    });
    const tickRef = useRef(null);
    const [isRunning, setIsRunning] = useState(false);
    const lastTickTs = useRef(null);

    // bot
    const [isBotGame, setIsBotGame] = useState(false);
    const [botLevel, setBotLevel] = useState("easy");
    const botThinkTimeoutRef = useRef(null);

    // sounds
    const moveSoundRef = useRef(null);
    const gameOverSoundRef = useRef(null);

    const playMoveSound = () => {
        try {
            if (moveSoundRef.current) {
                moveSoundRef.current.currentTime = 0;
                moveSoundRef.current.play();
            }
        } catch (e) { }
    };

    const playGameOverSound = () => {
        try {
            if (gameOverSoundRef.current) {
                gameOverSoundRef.current.currentTime = 0;
                gameOverSoundRef.current.play();
            }
        } catch (e) { }
    };

    // responsive board width
    const [boardWidth, setBoardWidth] = useState(480);
    useEffect(() => {
        const compute = () => {
            const vw = window.innerWidth;
            const isMobile = vw < 768;
            const size = isMobile
                ? Math.min(vw - 32, 420)
                : Math.min(640, Math.floor(vw * 0.45));
            setBoardWidth(size);
        };
        compute();
        window.addEventListener("resize", compute);
        return () => window.removeEventListener("resize", compute);
    }, []);

    // keep chessRef in sync when fen changes
    useEffect(() => {
        try {
            chessRef.current = new Chess(fen === "start" ? undefined : fen);
            setTurn(chessRef.current.turn());
        } catch (e) {
            chessRef.current = new Chess();
            setTurn("w");
        }
    }, [fen]);

    // start game vs bot
    const startBotGame = useCallback(
        (opts = {}) => {
            const colorChoice = opts.userColor || userColor || "w";
            const level = opts.level || botLevel || "easy";
            const tc = opts.tcSeconds ?? tcSeconds ?? defaultSeconds;

            setUserColor(colorChoice);
            setBotColor(colorChoice === "w" ? "b" : "w");
            setBotLevel(level);
            setTcSeconds(tc);

            const ms = tc * 1000;
            setClocks({ w: ms, b: ms });

            setMoves([]);
            setFen("start");
            chessRef.current = new Chess();
            setIsBotGame(true);
            setIsRunning(true);
            lastTickTs.current = Date.now();

            if (botThinkTimeoutRef.current) {
                clearTimeout(botThinkTimeoutRef.current);
                botThinkTimeoutRef.current = null;
            }
        },
        [botLevel, tcSeconds, userColor]
    );

    const stopBotGame = useCallback(() => {
        setIsBotGame(false);
        setIsRunning(false);
        if (botThinkTimeoutRef.current) {
            clearTimeout(botThinkTimeoutRef.current);
            botThinkTimeoutRef.current = null;
        }
    }, []);

    // clocks
    useEffect(() => {
        if (!isRunning) {
            if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
            }
            lastTickTs.current = null;
            return;
        }
        lastTickTs.current = Date.now();
        tickRef.current = setInterval(() => {
            const now = Date.now();
            const prev = lastTickTs.current || now;
            const diff = now - prev;
            lastTickTs.current = now;

            const side = chessRef.current.turn();
            setClocks((c) => {
                const next = { ...c };
                next[side] = Math.max(0, next[side] - diff);
                return next;
            });
        }, 250);

        return () => {
            if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
            }
            lastTickTs.current = null;
        };
    }, [isRunning]);

    // detect timeout
    useEffect(() => {
        if (!isBotGame) return;
        if (clocks.w <= 0 || clocks.b <= 0) {
            setIsRunning(false);
            playGameOverSound();
        }
    }, [clocks, isBotGame]);

    // bot thinking
    useEffect(() => {
        if (!isBotGame) return;
        if (isGameOver(chessRef.current)) return;

        const sideToMove = chessRef.current.turn();
        if (sideToMove !== botColor) return;

        const thinkMs =
            botLevel === "easy" ? 350 : botLevel === "medium" ? 800 : 1400;

        if (botThinkTimeoutRef.current) {
            clearTimeout(botThinkTimeoutRef.current);
            botThinkTimeoutRef.current = null;
        }

        botThinkTimeoutRef.current = setTimeout(() => {
            try {
                let chosen = null;
                const legal = chessRef.current.moves({ verbose: true }) || [];
                if (legal.length === 0) return;

                if (botLevel === "easy") {
                    chosen = legal[Math.floor(Math.random() * legal.length)];
                } else if (botLevel === "medium") {
                    chosen =
                        computeBestMoveMiniMax(chessRef.current.fen(), 1, 0.12) ||
                        legal[Math.floor(Math.random() * legal.length)];
                } else {
                    chosen =
                        computeBestMoveMiniMax(chessRef.current.fen(), 2, 0.06) ||
                        legal[Math.floor(Math.random() * legal.length)];
                }

                if (!chosen) return;

                const m = chessRef.current.move({
                    from: chosen.from,
                    to: chosen.to,
                    promotion: chosen.promotion || "q",
                });
                if (!m) return;

                const nextMove = {
                    from: m.from,
                    to: m.to,
                    promotion: m.promotion || null,
                    san: m.san || null,
                    fen: chessRef.current.fen(),
                    piece: m.piece,
                    color: m.color,
                    captured: m.captured || null,
                };

                setMoves((arr) => [...arr, nextMove]);
                setFen(chessRef.current.fen());
                setTurn(chessRef.current.turn());
                playMoveSound();

                if (isGameOver(chessRef.current)) {
                    setIsRunning(false);
                    playGameOverSound();
                }
            } catch (e) {
                console.warn("bot error", e);
            }
        }, thinkMs);

        return () => {
            if (botThinkTimeoutRef.current) {
                clearTimeout(botThinkTimeoutRef.current);
                botThinkTimeoutRef.current = null;
            }
        };
    }, [isBotGame, botColor, botLevel, turn, fen]);

    // handle user drop
    const onDrop = useCallback(
        (from, to) => {
            if (!isBotGame) return false;
            if (isGameOver(chessRef.current)) return false;
            if (chessRef.current.turn() !== userColor) return false;

            const legal = chessRef.current.moves({ verbose: true });
            const promotionMatches = legal.filter(
                (m) => m.from === from && m.to === to && m.promotion
            );
            if (promotionMatches.length > 0) {
                setPendingPromotion({ from, to, color: userColor });
                return false;
            }

            const m = chessRef.current.move({ from, to, promotion: "q" });
            if (!m) return false;

            const moveObj = {
                from: m.from,
                to: m.to,
                promotion: m.promotion || null,
                san: m.san || null,
                fen: chessRef.current.fen(),
                piece: m.piece,
                color: m.color,
                captured: m.captured || null,
            };

            setMoves((arr) => [...arr, moveObj]);
            setFen(chessRef.current.fen());
            setTurn(chessRef.current.turn());
            playMoveSound();

            if (isGameOver(chessRef.current)) {
                setIsRunning(false);
                playGameOverSound();
            }

            return true;
        },
        [isBotGame, userColor]
    );

    // promotion choose
    const handlePromotionChoose = (prom) => {
        if (!pendingPromotion) return;
        const { from, to } = pendingPromotion;
        const m = chessRef.current.move({ from, to, promotion: prom || "q" });
        setPendingPromotion(null);
        if (!m) return;
        const moveObj = {
            from: m.from,
            to: m.to,
            promotion: m.promotion || null,
            san: m.san || null,
            fen: chessRef.current.fen(),
            piece: m.piece,
            color: m.color,
            captured: m.captured || null,
        };
        setMoves((arr) => [...arr, moveObj]);
        setFen(chessRef.current.fen());
        setTurn(chessRef.current.turn());
        playMoveSound();
        if (isGameOver(chessRef.current)) {
            setIsRunning(false);
            playGameOverSound();
        }
    };
    const handlePromotionCancel = () => setPendingPromotion(null);

    // utility
    const newGameClick = () => {
        setMoves([]);
        setFen("start");
        chessRef.current = new Chess();
        setTurn("w");
        setIsRunning(false);
        setIsBotGame(false);
        setPendingPromotion(null);
    };

    const resign = () => {
        setIsRunning(false);
        playGameOverSound();
        // if you want: set some "result" state here
    };

    const flipBoard = () => setBoardFlipped((v) => !v);

    // moves in rows
    const moveRows = useMemo(() => {
        const arr = moves || [];
        const rows = [];
        for (let i = 0; i < arr.length; i += 2) {
            rows.push({
                no: Math.floor(i / 2) + 1,
                white: arr[i]
                    ? arr[i].san || `${arr[i].from}-${arr[i].to}`
                    : "",
                black: arr[i + 1]
                    ? arr[i + 1].san || `${arr[i + 1].from}-${arr[i + 1].to}`
                    : "",
            });
        }
        return rows;
    }, [moves]);

    const gameOver = isGameOver(chessRef.current);
    const inCheck = isInCheck(chessRef.current);
    const currentTurnLabel =
        chessRef.current.turn() === "w" ? "White to move" : "Black to move";

    // helper to show current time control like "5 min"
    const currentTcLabel =
        TIME_CONTROLS.find((t) => t.value === tcSeconds)?.label ||
        `${Math.round(tcSeconds / 60)} min`;

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#050510] via-[#050816] to-black text-zinc-100 px-4 py-6 pt-0 flex items-center justify-center">
            {/* sounds (place move.mp3 & game-over.mp3 in /public/sounds) */}
            <audio
                ref={moveSoundRef}
                src="/sounds/move.mp3"
                preload="auto"
            />
            <audio
                ref={gameOverSoundRef}
                src="/sounds/gameend.mp3"
                preload="auto"
            />

            <div className="w-full max-w-7xl rounded-3xl border-white/10 bg-black/55 backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.9)] p-4 md:p-6 lg:pt-4 lg:p-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.9fr)]">
                {/* LEFT: board + main controls */}
                <div className="flex flex-col gap-2">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-500 text-lg font-bold shadow-[0_0_25px_rgba(129,140,248,0.7)]">
                                    ♟
                                </span>
                                <h1 className="text-lg md:text-xl font-semibold">
                                    Practice Game
                                </h1>
                            </div>
                           
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300 border border-emerald-500/40">
                                {isBotGame ? "Bot game running" : "Idle practice"}
                            </span>
                            
                        </div>
                    </div>

                    {/* Board + controls */}
                    <div className="rounded-xl bg-zinc-950/80 border border-white/10 p-3 md:p-4 flex flex-col md:flex-row gap-4">
                        {/* Board section */}
                        <div className="flex flex-col items-center gap-3">
                            {/* Top player label */}
                            <div className="flex w-full items-center justify-between text-[11px] md:text-xs text-zinc-300">
                                <span className="font-medium">
                                    {userColor === "w" ? "Bot (Black)" : "You (Black)"}
                                </span>
                                <span className="font-mono">
                                    {userColor === "w" ? fmt(clocks.b) : fmt(clocks.w)}
                                </span>
                            </div>

                            <Chessboard
                                position={fen}
                                onPieceDrop={onDrop}
                                arePiecesDraggable={
                                    isBotGame && chessRef.current.turn() === userColor
                                }
                                boardOrientation={
                                    boardFlipped
                                        ? userColor === "w"
                                            ? "black"
                                            : "white"
                                        : userColor === "w"
                                            ? "white"
                                            : "black"
                                }
                                animationDuration={200}
                                customDarkSquareStyle={{ backgroundColor: "#769656" }}
                                customLightSquareStyle={{ backgroundColor: "#eeeed2" }}
                                boardWidth={boardWidth}
                                customBoardStyle={{
                                    borderRadius: 10,
                                    boxShadow:
                                        "0 0 40px rgba(0,0,0,0.8), 0 0 30px rgba(15,23,42,0.8)",
                                }}
                            />

                            {/* Bottom player label */}
                            <div className="flex w-full items-center justify-between text-[11px] md:text-xs text-zinc-300">
                                <span className="font-medium">
                                    {userColor === "w" ? "You (White)" : "Bot (White)"}
                                </span>
                                <span className="font-mono">
                                    {userColor === "w" ? fmt(clocks.w) : fmt(clocks.b)}
                                </span>
                            </div>

                            {/* Status bar */}
                            <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl bg-zinc-950/80 border border-white/10 px-3 md:px-4 py-2">
                                <div className="flex items-center gap-2 text-xs md:text-sm">
                                    <span
                                        className={`inline-block h-2 w-2 rounded-full ${gameOver
                                            ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]"
                                            : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)]"
                                            }`}
                                    />
                                    <span className="font-medium">
                                        {gameOver
                                            ? "Game over"
                                            : inCheck
                                                ? "Check!"
                                                : currentTurnLabel}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] md:text-xs text-zinc-400">
                                    <span>
                                        White:{" "}
                                        <span className="font-mono text-zinc-100">
                                            {fmt(clocks.w)}
                                        </span>
                                    </span>
                                    <span className="mx-1 opacity-40">•</span>
                                    <span>
                                        Black:{" "}
                                        <span className="font-mono text-zinc-100">
                                            {fmt(clocks.b)}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>


                    </div>
                </div>

                {/* RIGHT: settings & quick actions */}
                <aside className="flex flex-col gap-4">
                    <div className="rounded-xl bg-zinc-950/80 border border-white/10 p-4 space-y-4">
                        {/* Color + difficulty */}
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-100">
                                Game setup
                            </h2>
                            <p className="mt-1 text-[11px] text-zinc-500">
                                Choose your side, difficulty and time before starting.
                            </p>

                            <div className="mt-3 space-y-3">
                                {/* Color */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-zinc-300">Your color</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setUserColor("w");
                                                setBotColor("b");
                                            }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${userColor === "w"
                                                ? "bg-white text-black border-white"
                                                : "bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10"
                                                }`}
                                        >
                                            White
                                        </button>
                                        <button
                                            onClick={() => {
                                                setUserColor("b");
                                                setBotColor("w");
                                            }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${userColor === "b"
                                                ? "bg-white text-black border-white"
                                                : "bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10"
                                                }`}
                                        >
                                            Black
                                        </button>
                                    </div>
                                </div>

                                {/* Difficulty */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-zinc-300">Difficulty</span>
                                    <select
                                        value={botLevel}
                                        onChange={(e) => setBotLevel(e.target.value)}
                                        className="rounded-xl bg-zinc-900 border border-white/10 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-400"
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>

                                {/* Time control */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-zinc-300">Time control</span>
                                    <select
                                        value={tcSeconds}
                                        onChange={(e) => {
                                            const v = Number(e.target.value) || defaultSeconds;
                                            setTcSeconds(v);
                                            setClocks({ w: v * 1000, b: v * 1000 });
                                        }}
                                        className="rounded-xl bg-zinc-900 border border-white/10 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-400"
                                    >
                                        {TIME_CONTROLS.map((tc) => (
                                            <option key={tc.value} value={tc.value}>
                                                {tc.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Quick actions */}
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-100">
                                Controls
                            </h2>
                            <div className="mt-3 flex flex-col gap-2">
                                <button
                                    onClick={() =>
                                        startBotGame({
                                            userColor,
                                            level: botLevel,
                                            tcSeconds,
                                        })
                                    }
                                    className="w-full rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 py-2 text-xs font-semibold shadow-[0_0_24px_rgba(16,185,129,0.8)] hover:brightness-110 transition"
                                >
                                    Start / Restart Bot Game
                                </button>

                                <button
                                    onClick={() => setIsRunning((s) => !s)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs hover:bg-white/10 transition"
                                >
                                    {isRunning ? "Pause Clock" : "Resume Clock"}
                                </button>

                                <button
                                    onClick={newGameClick}
                                    className="w-full rounded-xl border border-white/10 bg-transparent py-2 text-xs hover:bg-white/5 transition"
                                >
                                    New blank board
                                </button>

                                <button
                                    onClick={stopBotGame}
                                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition"
                                >
                                    Stop bot game
                                </button>
                            </div>

                            {/* Small controls under board (mobile-friendly) */}
                            <div className="flex flex- items-center mt-4 justify-center gap-2 text-xs md:text-sm">
                                <button
                                    onClick={() => setIsRunning((s) => !s)}
                                    className="rounded-full w-full border border-white/15 bg-white/5 px-3 py-1.5 hover:bg-white/10 transition text-xs"
                                >
                                    {isRunning ? "Pause Clock" : "Start Clock"}
                                </button>
                                <button
                                    onClick={flipBoard}
                                    className="rounded-full w-full border border-white/15 bg-white/5 px-3 py-1.5 hover:bg-white/10 transition text-xs"
                                >
                                    Flip Board
                                </button>
                                <button
                                    onClick={resign}
                                    className="rounded-full w-full bg-gradient-to-r from-rose-600 to-red-500 px-3 py-1.5 text-xs font-semibold shadow-[0_0_18px_rgba(248,113,113,0.6)] hover:brightness-110 transition"
                                >
                                    Resign
                                </button>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="rounded-2xl bg-black/40 border border-white/10 px-3 py-2 text-[11px] text-zinc-300">
                            <div>
                                Turn:{" "}
                                <span className="font-medium">
                                    {chessRef.current.turn() === "w" ? "White" : "Black"}
                                </span>
                            </div>
                            <div className="mt-1">
                                Game over:{" "}
                                <span className="font-medium">
                                    {gameOver ? "Yes" : "No"}
                                </span>
                            </div>
                            <div className="mt-1">
                                In check:{" "}
                                <span className="font-medium">
                                    {inCheck ? "Yes" : "No"}
                                </span>
                            </div>
                        </div>

                        {/* Move list */}
                        <div className="w-full md:w-48 lg:w-52 rounded-2xl bg-black/40 border border-white/10 p-3 flex flex-col text-xs">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-zinc-100">Moves</span>
                                <span className="text-[10px] text-zinc-500">
                                    {moves.length} ply
                                </span>
                            </div>
                            <div className="flex-1 space-y-1 max-h-[200px] overflow-auto pr-1 custom-scroll">
                                {moveRows.length === 0 && (
                                    <div className="text-[11px] text-zinc-500 italic">
                                        No moves yet.
                                    </div>
                                )}
                                {moveRows.map((r) => (
                                    <div
                                        key={r.no}
                                        className="flex items-start gap-1 rounded-lg px-1 py-0.5 hover:bg-white/5"
                                    >
                                        <div className="w-6 text-right text-[11px] text-zinc-500">
                                            {r.no}.
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[11px] text-zinc-100">
                                                {r.white || "—"}
                                            </div>
                                            <div className="text-[11px] text-zinc-400">
                                                {r.black || "—"}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => {
                                    setMoves([]);
                                    chessRef.current = new Chess(chessRef.current.fen());
                                    setFen(chessRef.current.fen());
                                }}
                                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 py-1.5 text-[11px] hover:bg-white/10 transition"
                            >
                                Clear moves (keep position)
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Promotion modal */}
            {pendingPromotion && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
                    <div className="rounded-2xl bg-zinc-950 border border-white/10 px-5 py-4 text-center shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                        <div className="text-sm font-medium mb-3">
                            Promote pawn to:
                        </div>
                        <div className="flex gap-2 justify-center mb-3">
                            {["q", "r", "b", "n"].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => handlePromotionChoose(p)}
                                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition"
                                >
                                    {p.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handlePromotionCancel}
                            className="px-3 py-1.5 rounded-xl border border-white/15 bg-transparent text-xs text-zinc-300 hover:bg-white/5 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
