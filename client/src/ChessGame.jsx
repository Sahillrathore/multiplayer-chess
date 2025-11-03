// ChessGame.jsx
import { useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { FiPlusSquare, FiGrid, FiUsers, FiChevronDown, FiClock } from 'react-icons/fi';
import GameReview from './components/GameReview';

import { setTimeControl, setSidebarTab, setReviewing } from '../src/store/slices/gameSlice';
import { socketQueueJoin, socketOfferDraw, socketResign, socketSendMove } from '../src/store/socketActions';
import useRealtimeClocks from '../src/hooks/useRealtimeClocks';
import { logout as logoutAction } from '../src/store/slices/authSlice';
// import { useMeQuery } from '../src/store/services/authApi'; // optional if you set it up

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
const fmt = (ms) => {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${pad2(s)}`;
};
const glyph = (type, color) => {
  const mapW = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
  const mapB = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const t = (type || 'p').toLowerCase();
  return color === 'w' ? mapW[t] : mapB[t];
};

export default function ChessGame() {
  const dispatch = useDispatch();

  const {
    connected, gameId, color, status, fen, moves, turn, captures,
    tcSeconds, sidebarTab, reviewing,
  } = useSelector((s) => s.game);
  const token = useSelector((s) => s.auth.token);
  const isAuthed = !!token;

  // (optional) if you wired RTK Query's me endpoint
  // const { data: meData } = useMeQuery(undefined, { skip: !isAuthed });
  // const userEmail = meData?.email;

  // live display clocks derived from server bases
  const displayClocks = useRealtimeClocks();

  const timeControlStr = useMemo(() => `${tcSeconds}+0`, [tcSeconds]);
  const chess = useMemo(() => new Chess(fen === 'start' ? undefined : fen), [fen]);
  const moveLog = useMemo(
    () => (moves || []).map((m, i) => `${i % 2 === 0 ? 'White' : 'Black'}: ${m.san || ''}`),
    [moves]
  );

  const statusText = useMemo(() => {
    if (!isAuthed) return 'Sign in to play';
    if (status !== 'active') return status === 'ended' ? 'Game Over' : 'Press Start Game';
    return `${turn === 'w' ? 'White' : 'Black'} to move`;
  }, [isAuthed, status, turn]);

  // emits (no socket in component)
  const findMatch = () => {
    if (!isAuthed) return alert('Please sign in first.');
    console.log('si');
    
    dispatch(socketQueueJoin({ timeControl: timeControlStr }));
  };
  const offerDraw = () => gameId && dispatch(socketOfferDraw({ gameId }));
  const resign = () => gameId && dispatch(socketResign({ gameId }));
  const logout = () => dispatch(logoutAction());

  const onDrop = useCallback(
    (from, to) => {
      if (status !== 'active' || !gameId) return false;
      if (color !== turn) return false;
      const test = new Chess(fen === 'start' ? undefined : fen);
      const mv = test.move({ from, to, promotion: 'q' });
      if (!mv) return false;
      dispatch(socketSendMove({ gameId, from, to, promotion: mv.promotion || 'q' }));
      return true;
    },
    [status, gameId, color, turn, fen, dispatch]
  );

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 relative overflow-hidden">
      {/* bg visuals like your original... */}

      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        {/* top status */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs sm:text-sm text-zinc-300">
            {isAuthed ? (connected ? 'Connected' : 'Connecting…') : 'Not signed in'} · {status} · You are {color ?? '—'} · TC {timeControlStr}
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">
              W: {fmt(displayClocks.w)} · B: {fmt(displayClocks.b)}
            </div>
            {isAuthed ? (
              <>
                <div className="hidden sm:block rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-200">
                  {'Player'}
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
          {/* LEFT: board */}
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 blur opacity-50" />
            <div className="relative rounded-2xl bg-zinc-900/90 ring-1 ring-white/10 p-4 md:p-6">
              <div className={`mb-3 text-center text-base md:text-lg font-semibold ${status === 'active' && chess.in_check ? 'text-rose-400' : 'text-zinc-200'}`}>
                {statusText}
              </div>

              {/* captured by opponent */}
              <div className="mb-2 flex flex-wrap items-center gap-1 text-xl opacity-80">
                {(color === 'w' ? captures.b : captures.w).map((t, i) => (
                  <span key={`oc-${i}`}>{glyph(t, color === 'w' ? 'w' : 'b')}</span>
                ))}
              </div>

              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
                arePiecesDraggable={isAuthed && status === 'active' && color === turn}
                boardOrientation={color === 'b' ? 'black' : 'white'}
                animationDuration={200}
                customBoardStyle={{ borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}
                customDarkSquareStyle={{ backgroundColor: '#769656' }}
                customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
              />

              {/* captured by you */}
              <div className="mt-2 flex flex-wrap items-center gap-1 text-xl">
                {(color === 'w' ? captures.w : captures.b).map((t, i) => (
                  <span key={`yc-${i}`}>{glyph(t, color === 'w' ? 'b' : 'w')}</span>
                ))}
              </div>

              {/* controls under board */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="relative">
                  <select
                    value={tcSeconds}
                    onChange={(e) => dispatch(setTimeControl(Number(e.target.value)))}
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
                    ${isAuthed ? 'bg-emerald-500 hover:bg-emerald-500/90' : 'bg-emerald-500/50 cursor-not-allowed'}`}
                >
                  Start Game
                </button>

                <button
                  onClick={offerDraw}
                  disabled={!gameId || status !== 'active'}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition
                    ${!gameId || status !== 'active' ? 'bg-amber-500/50 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-500/90'}`}
                >
                  Offer Draw
                </button>

                <button
                  onClick={resign}
                  disabled={!gameId || status !== 'active'}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition
                    ${!gameId || status !== 'active' ? 'bg-rose-500/50 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-500/90'}`}
                >
                  Resign
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: sidebar */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#1f1f1f] ring-1 ring-white/10 p-2 flex items-center gap-2">
              <button
                onClick={() => dispatch(setSidebarTab('new'))}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm
                  ${sidebarTab === 'new' ? 'bg-[#2a2a2a] text-white' : 'text-zinc-300 hover:bg-white/5'}`}
                title="New Game"
              >
                <FiPlusSquare /> <span className="hidden sm:inline">New Game</span>
              </button>
              <button
                onClick={() => dispatch(setSidebarTab('games'))}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm
                  ${sidebarTab === 'games' ? 'bg-[#2a2a2a] text-white' : 'text-zinc-300 hover:bg-white/5'}`}
                title="Games"
              >
                <FiGrid /> <span className="hidden sm:inline">Games</span>
              </button>
              <button
                onClick={() => dispatch(setSidebarTab('players'))}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm
                  ${sidebarTab === 'players' ? 'bg-[#2a2a2a] text-white' : 'text-zinc-300 hover:bg-white/5'}`}
                title="Players"
              >
                <FiUsers /> <span className="hidden sm:inline">Players</span>
              </button>
            </div>

            {sidebarTab === 'new' && (
              <div className="relative">
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 blur opacity-40" />
                <div className="relative rounded-2xl bg-zinc-900/70 ring-1 ring-white/10 backdrop-blur-xl p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <FiClock className="opacity-80" /> Time Control
                    </div>
                    <div className="flex items-center gap-1 text-zinc-400 text-xs">
                      {tcSeconds === 600 ? '10 min (Rapid)' :
                       tcSeconds === 300 ? '5 min (Blitz)' :
                       tcSeconds === 180 ? '3 min (Blitz)' : '1 min (Bullet)'} <FiChevronDown />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[60, 180, 300, 600].map((s) => (
                      <button
                        key={s}
                        onClick={() => dispatch(setTimeControl(s))}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition
                          ${tcSeconds === s
                            ? 'border-indigo-400/60 bg-white/10 text-white ring-2 ring-indigo-500/40'
                            : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'}`}
                      >
                        {s === 60 ? '1 min' : s === 180 ? '3 min' : s === 300 ? '5 min' : '10 min'}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={findMatch}
                      disabled={!isAuthed}
                      className={`w-full rounded-xl px-4 py-3 text-sm font-extrabold shadow-lg transition
                        ${isAuthed ? 'bg-[#7cc44e] text-[#1b2314] hover:bg-[#86cf57]' : 'bg-[#7cc44e]/60 text-[#1b2314]/60 cursor-not-allowed'}`}
                    >
                      Start Game
                    </button>
                  </div>
                </div>
              </div>
            )}

            {sidebarTab === 'games' && (
              <div className="relative">
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 blur opacity-30" />
                <div className="relative rounded-2xl bg-zinc-900/70 ring-1 ring-white/10 backdrop-blur-xl p-4">
                  <h2 className="mb-2 text-sm font-semibold text-zinc-200">Your Games</h2>

                  {!isAuthed && <div className="text-xs text-zinc-400">Sign in to see your game history.</div>}

                  {/* You can drop in your RTK Query getHistory list here */}
                  {/* Example: <GamesList onReview={(g)=>dispatch(setReviewing(true))} /> */}

                  {reviewing && (
                    <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
                      Viewing a past game (review mode). Start a new game to return to live play.
                    </div>
                  )}
                </div>
              </div>
            )}

            {sidebarTab === 'players' && (
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
