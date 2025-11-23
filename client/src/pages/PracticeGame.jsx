// src/components/PracticeGame.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

/**
 * PracticeGame (compat with chess.js v1 and v2)
 * - Self-contained practice/bot component
 * - No sockets, no redux
 * - Uses chess.js + react-chessboard
 *
 * NOTE: This version includes compatibility helpers to work with both
 * chess.js v1 (game_over(), in_check(), etc.) and v2 (isGameOver(), isCheck()).
 */

const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
const fmt = (ms) => {
    if (ms == null) return '--:--';
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
            score += (p.color === 'w' ? v : -v);
        }
    }
    return score;
}

function legalMovesFor(c) {
    return c.moves({ verbose: true });
}

// very small minimax depth 2 (root -> opponent)
// returns a verbose move object (from,to,promotion,san,...)
function computeBestMoveMiniMax(fenStr, maxDepth = 1, preferRandomness = 0.2) {
    const c = new Chess(fenStr === 'start' ? undefined : fenStr);
    const moves = legalMovesFor(c);
    if (!moves || moves.length === 0) return null;
    if (maxDepth <= 0 || moves.length === 1) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    let bestMove = null;
    let bestScore = -Infinity;
    for (const m of moves) {
        c.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
        const oppMoves = legalMovesFor(c);
        let worstForUs = Infinity;
        if (oppMoves.length === 0) {
            worstForUs = evaluateBoardSimple(c);
        } else {
            for (const om of oppMoves) {
                c.move({ from: om.from, to: om.to, promotion: om.promotion || 'q' });
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
    // chess.js v1: game_over()
    if (typeof chessInstance.game_over === 'function') return chessInstance.game_over();
    // chess.js v2: isGameOver()
    if (typeof chessInstance.isGameOver === 'function') return chessInstance.isGameOver();
    // fallback
    return false;
}

function isInCheck(chessInstance) {
    if (typeof chessInstance.in_check === 'function') return chessInstance.in_check();
    if (typeof chessInstance.isCheck === 'function') return chessInstance.isCheck();
    return false;
}

export default function PracticeGame() {
    // chess state
    const [fen, setFen] = useState('start');
    const chessRef = useRef(new Chess());
    const [moves, setMoves] = useState([]); // array of { from,to,promotion,san,fen,piece,color,captured }
    const [turn, setTurn] = useState('w'); // 'w'|'b'
    const [userColor, setUserColor] = useState('w'); // user chooses color
    const [botColor, setBotColor] = useState('b');
    const [boardFlipped, setBoardFlipped] = useState(false);

    // promotion handling
    const [pendingPromotion, setPendingPromotion] = useState(null); // { from, to, color }

    // clocks (ms)
    const defaultSeconds = 300; // default 5min; you can expose UI to change
    const [tcSeconds, setTcSeconds] = useState(defaultSeconds);
    const [clocks, setClocks] = useState({ w: defaultSeconds * 1000, b: defaultSeconds * 1000 });
    const tickRef = useRef(null);
    const [isRunning, setIsRunning] = useState(false); // clocks running when true
    const lastTickTs = useRef(null);

    // bot settings
    const [isBotGame, setIsBotGame] = useState(false);
    const [botLevel, setBotLevel] = useState('easy'); // easy/medium/hard
    const botThinkTimeoutRef = useRef(null);

    // UI helpers
    const [boardWidth, setBoardWidth] = useState(520);
    useEffect(() => {
        const compute = () => {
            const w = Math.min(630, Math.max(320, Math.floor(window.innerWidth * 0.45)));
            setBoardWidth(w);
        };
        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, []);

    // keep chessRef in sync when fen changes externally
    useEffect(() => {
        try {
            chessRef.current = new Chess(fen === 'start' ? undefined : fen);
            setTurn(chessRef.current.turn());
        } catch (e) {
            chessRef.current = new Chess();
            setTurn('w');
        }
    }, [fen]);

    // start a fresh game vs bot
    const startBotGame = useCallback((opts = {}) => {
        // opts: { userColor: 'w'|'b', level: 'easy'|'medium'|'hard', tcSeconds?: number }
        const colorChoice = opts.userColor || 'w';
        const level = opts.level || 'easy';
        const tc = opts.tcSeconds ?? defaultSeconds;

        setUserColor(colorChoice);
        setBotColor(colorChoice === 'w' ? 'b' : 'w');
        setBotLevel(level);
        setTcSeconds(tc);

        const ms = tc * 1000;
        setClocks({ w: ms, b: ms });

        setMoves([]);
        setFen('start');
        chessRef.current = new Chess();
        setIsBotGame(true);
        setIsRunning(true);
        lastTickTs.current = Date.now();

        // cancel any pending bot think
        if (botThinkTimeoutRef.current) {
            clearTimeout(botThinkTimeoutRef.current);
            botThinkTimeoutRef.current = null;
        }
    }, []);

    const stopBotGame = useCallback(() => {
        setIsBotGame(false);
        setIsRunning(false);
        if (botThinkTimeoutRef.current) {
            clearTimeout(botThinkTimeoutRef.current);
            botThinkTimeoutRef.current = null;
        }
    }, []);

    // clock tick: uses setInterval (250ms)
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

            // only tick the side to move
            const side = chessRef.current.turn(); // 'w' or 'b'
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

    // detect timeouts
    useEffect(() => {
        if (!isBotGame) return;
        if (clocks.w <= 0 || clocks.b <= 0) {
            setIsRunning(false);
        }
    }, [clocks, isBotGame]);

    // Bot thinking: whenever it's bot's turn in a bot game, schedule a move
    useEffect(() => {
        if (!isBotGame) return;
        // if game ended, do nothing
        if (isGameOver(chessRef.current)) return;
        const sideToMove = chessRef.current.turn(); // 'w'|'b'
        if (sideToMove !== botColor) return;

        // schedule bot move after a small thinking delay
        const thinkMs = botLevel === 'easy' ? 350 : botLevel === 'medium' ? 800 : 1400;
        // clear previous
        if (botThinkTimeoutRef.current) {
            clearTimeout(botThinkTimeoutRef.current);
            botThinkTimeoutRef.current = null;
        }
        botThinkTimeoutRef.current = setTimeout(() => {
            try {
                let chosen = null;
                const legal = chessRef.current.moves({ verbose: true }) || [];
                if (legal.length === 0) return;

                if (botLevel === 'easy') {
                    chosen = legal[Math.floor(Math.random() * legal.length)];
                } else if (botLevel === 'medium') {
                    chosen = computeBestMoveMiniMax(chessRef.current.fen(), 1, 0.12) || legal[Math.floor(Math.random() * legal.length)];
                } else {
                    chosen = computeBestMoveMiniMax(chessRef.current.fen(), 2, 0.06) || legal[Math.floor(Math.random() * legal.length)];
                }

                if (!chosen) return;

                // apply the move locally (same logic as user move)
                const m = chessRef.current.move({ from: chosen.from, to: chosen.to, promotion: chosen.promotion || 'q' });
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

                // if game over, stop clocks
                if (isGameOver(chessRef.current)) {
                    setIsRunning(false);
                }
            } catch (e) {
                console.warn('bot error', e);
            }
        }, thinkMs);

        return () => {
            if (botThinkTimeoutRef.current) {
                clearTimeout(botThinkTimeoutRef.current);
                botThinkTimeoutRef.current = null;
            }
        };
    }, [isBotGame, botColor, botLevel, turn, fen]);

    // handle user drops
    const onDrop = useCallback((from, to) => {
        // if not user's turn or game not active, ignore
        if (!isBotGame) return false;
        if (isGameOver(chessRef.current)) return false;
        if (chessRef.current.turn() !== userColor) return false;

        // check promotions
        const legal = chessRef.current.moves({ verbose: true });
        const promotionMatches = legal.filter(m => m.from === from && m.to === to && m.promotion);
        if (promotionMatches.length > 0) {
            // ask user to pick promotion
            setPendingPromotion({ from, to, color: userColor });
            return false;
        }

        const m = chessRef.current.move({ from, to, promotion: 'q' });
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

        // if game over, stop clocks
        if (isGameOver(chessRef.current)) {
            setIsRunning(false);
        }

        return true;
    }, [isBotGame, userColor]);

    // handle promotion choose
    const handlePromotionChoose = (prom) => {
        if (!pendingPromotion) return;
        const { from, to } = pendingPromotion;
        const m = chessRef.current.move({ from, to, promotion: prom || 'q' });
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
        if (isGameOver(chessRef.current)) setIsRunning(false);
    };
    const handlePromotionCancel = () => setPendingPromotion(null);

    // utility actions
    const newGameClick = () => {
        setMoves([]);
        setFen('start');
        chessRef.current = new Chess();
        setTurn('w');
        setIsRunning(false);
        setIsBotGame(false);
        setPendingPromotion(null);
    };

    const resign = () => {
        // simple resign — stop clocks and set game over
        setIsRunning(false);
        // you may want to set some UI state to indicate who won
    };

    const flipBoard = () => setBoardFlipped((v) => !v);

    // simple move list display (last 20)
    const moveRows = useMemo(() => {
        const arr = moves || [];
        const rows = [];
        for (let i = 0; i < arr.length; i += 2) {
            rows.push({
                no: Math.floor(i / 2) + 1,
                white: arr[i] ? arr[i].san || `${arr[i].from}-${arr[i].to}` : '',
                black: arr[i + 1] ? arr[i + 1].san || `${arr[i + 1].from}-${arr[i + 1].to}` : '',
            });
        }
        return rows;
    }, [moves]);

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
            <div className="max-w-6xl mx-auto grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
                {/* BOARD + controls */}
                <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="text-sm text-zinc-300">Practice Mode</div>
                            <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-200">Local</div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button onClick={() => startBotGame({ userColor: 'w', level: 'easy', tcSeconds: defaultSeconds })}
                                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold">New vs Bot (Easy)</button>

                            <button onClick={() => startBotGame({ userColor: 'w', level: 'medium', tcSeconds: defaultSeconds })}
                                className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-sm font-semibold">New vs Bot (Medium)</button>

                            <button onClick={() => startBotGame({ userColor: 'w', level: 'hard', tcSeconds: defaultSeconds })}
                                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-sm font-semibold">New vs Bot (Hard)</button>

                            <button onClick={newGameClick} className="px-3 py-1 rounded border border-white/10 text-sm">Reset</button>
                        </div>
                    </div>

                    <div className="rounded-md bg-zinc-900/80 p-4 ring-1 ring-white/6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="text-sm font-semibold">{isBotGame ? 'You vs Bot' : 'Solo'}</div>
                                <div className="text-xs text-zinc-400">{isBotGame ? `Bot (${botLevel})` : ''}</div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="text-xs text-zinc-300">
                                    <div>White: <span className="font-mono">{fmt(clocks.w)}</span></div>
                                    <div className="mt-1">Black: <span className="font-mono">{fmt(clocks.b)}</span></div>
                                </div>

                                <button onClick={() => setIsRunning((s) => !s)} className="px-3 py-1 rounded bg-white/5 text-sm">
                                    {isRunning ? 'Pause' : 'Run'}
                                </button>

                                <button onClick={flipBoard} className="px-3 py-1 rounded bg-white/5 text-sm">Flip</button>

                                <button onClick={resign} className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-sm">Resign</button>
                            </div>
                        </div>

                        {/* Board */}
                        <div className="flex items-start gap-6">
                            <div>
                                <Chessboard
                                    position={fen}
                                    onPieceDrop={onDrop}
                                    arePiecesDraggable={isBotGame && chessRef.current.turn() === userColor}
                                    boardOrientation={boardFlipped ? (userColor === 'w' ? 'black' : 'white') : (userColor === 'w' ? 'white' : 'black')}
                                    animationDuration={160}
                                    customDarkSquareStyle={{ backgroundColor: '#769656' }}
                                    customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
                                    boardWidth={boardWidth}
                                    customBoardStyle={{ borderRadius: '8px' }}
                                />
                            </div>

                            {/* move list */}
                            <div className="w-40 text-xs text-zinc-300">
                                <div className="font-semibold mb-2">Moves</div>
                                <div className="space-y-1 max-h-[320px] overflow-auto">
                                    {moveRows.map((r) => (
                                        <div key={r.no} className="flex justify-between">
                                            <div className="text-zinc-400 pr-2">{r.no}.</div>
                                            <div className="flex-1">
                                                <div><span className="mr-1 text-white">{r.white}</span></div>
                                                <div className="text-zinc-400 mt-0.5">{r.black}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {moveRows.length === 0 && <div className="text-zinc-500">No moves yet</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: options / status */}
                <aside>
                    <div className="rounded-md bg-zinc-900/80 p-4 ring-1 ring-white/6 space-y-4">
                        <div>
                            <div className="text-sm font-semibold">Settings</div>
                            <div className="mt-2 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs text-zinc-300">Your color</div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setUserColor('w'); setBotColor('b'); }}
                                            className={`px-2 py-1 rounded text-sm ${userColor === 'w' ? 'bg-white text-black' : 'bg-white/5'}`}>White</button>
                                        <button onClick={() => { setUserColor('b'); setBotColor('w'); }}
                                            className={`px-2 py-1 rounded text-sm ${userColor === 'b' ? 'bg-white text-black' : 'bg-white/5'}`}>Black</button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="text-xs text-zinc-300">Difficulty</div>
                                    <select value={botLevel} onChange={(e) => setBotLevel(e.target.value)}
                                        className="bg-white/5 rounded px-2 py-1 text-xs">
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="text-xs text-zinc-300">Time (min)</div>
                                    <input type="number" min={1} max={60} value={tcSeconds}
                                        onChange={(e) => {
                                            const v = Math.max(1, Math.min(60, Number(e.target.value) || defaultSeconds));
                                            setTcSeconds(v);
                                            setClocks({ w: v * 1000, b: v * 1000 });
                                        }}
                                        className="w-20 bg-white/5 rounded px-2 py-1 text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-semibold">Status</div>
                            <div className="mt-2 text-xs text-zinc-300">
                                <div>Turn: <span className="font-medium">{chessRef.current.turn() === 'w' ? 'White' : 'Black'}</span></div>
                                <div className="mt-1">Game Over: <span className="font-medium">{String(isGameOver(chessRef.current))}</span></div>
                                <div className="mt-1">In Check: <span className="font-medium">{String(isInCheck(chessRef.current))}</span></div>
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-semibold">Quick Actions</div>
                            <div className="mt-2 flex flex-col gap-2">
                                <button onClick={() => startBotGame({ userColor, level: botLevel, tcSeconds })} className="px-3 py-2 rounded bg-emerald-600 text-sm font-semibold">Start / Restart Bot Game</button>
                                <button onClick={() => { setIsRunning((s) => !s); }} className="px-3 py-2 rounded bg-white/5 text-sm">Toggle Clock</button>
                                <button onClick={() => { setMoves([]); chessRef.current = new Chess(chessRef.current.fen()); setFen(chessRef.current.fen()); }} className="px-3 py-2 rounded bg-white/5 text-sm">Clear Moves (keep pos)</button>
                                <button onClick={() => { newGameClick(); }} className="px-3 py-2 rounded border border-white/10 text-sm">New Blank Game</button>
                            </div>
                        </div>

                        <div className="text-xs text-zinc-500">
                            This practice mode runs locally and does not use your multiplayer sockets.
                        </div>
                    </div>
                </aside>
            </div>

            {/* simple promotion prompt (inline) */}
            {pendingPromotion && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
                    <div className="bg-zinc-900 p-4 rounded-xl ring-1 ring-white/10 text-center">
                        <div className="text-sm mb-3">Promote pawn to:</div>
                        <div className="flex gap-2 justify-center">
                            {['q', 'r', 'b', 'n'].map((p) => (
                                <button key={p} onClick={() => handlePromotionChoose(p)} className="px-3 py-2 rounded bg-white/5">{p.toUpperCase()}</button>
                            ))}
                            <button onClick={handlePromotionCancel} className="px-3 py-2 rounded border border-white/10">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
