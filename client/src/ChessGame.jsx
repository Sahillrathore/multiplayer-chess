// ChessGame.jsx
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { FiPlusSquare, FiGrid, FiUsers, FiChevronDown, FiClock } from 'react-icons/fi';
import GameReview from './components/GameReview';

import { setTimeControl, setSidebarTab, setReviewing, queueStart, queueStop } from '../src/store/slices/gameSlice';

import {
  socketQueueJoin,
  socketOfferDraw,
  socketResign,
  socketSendMove,
  // socketLeaveQueue // optional - include in your socketActions if available
} from '../src/store/socketActions';
import useRealtimeClocks from '../src/hooks/useRealtimeClocks';
import { logout as logoutAction } from '../src/store/slices/authSlice';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
const fmt = (ms) => {
  if (ms == null) return '--:--';
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
    // OPTIONAL: If you store opponent email/username in state, use it here:
    opponentEmail,
  } = useSelector((s) => s.game);
  const { token, user } = useSelector((s) => s.auth);
  const isAuthed = !!token;

  // local: history & selected review meta
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [selectedGameMeta, setSelectedGameMeta] = useState(null);

  // live display clocks derived from server bases (should return { w: ms, b: ms })
  const displayClocks = useRealtimeClocks();

  const timeControlStr = useMemo(() => `${tcSeconds}+0`, [tcSeconds]);
  const chess = useMemo(() => new Chess(fen === 'start' ? undefined : fen), [fen]);
  const moveLog = useMemo(
    () => (moves || []).map((m, i) => `${i % 2 === 0 ? 'White' : 'Black'}: ${m.san || ''}`),
    [moves]
  );

  const statusText = useMemo(() => {
    if (!isAuthed) return 'Sign in to play';
    if (status === 'queueing') return 'Matching…';
    if (status !== 'active') return status === 'ended' ? 'Game Over' : 'Press Start Game';
    return `${turn === 'w' ? 'White' : 'Black'} to move`;
  }, [isAuthed, status, turn]);

  // fetch history when games tab opens
  useEffect(() => {
    if (sidebarTab !== 'games' || !isAuthed) return;

    let abort = false;
    const ctrl = new AbortController();

    async function load() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await fetch(`${API_BASE}/games/history?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch history');
        if (abort) return;
        setHistory(Array.isArray(json.games) ? json.games : []);
      } catch (err) {
        if (!abort) setHistoryError(err.message || 'Failed to load');
      } finally {
        if (!abort) setHistoryLoading(false);
      }
    }

    load();
    return () => { abort = true; ctrl.abort(); };
  }, [sidebarTab, isAuthed, token]);

  // send join queue
  const findMatch = () => {
    if (!isAuthed) return alert('Please sign in first.');
    // guard: avoid double-queueing or queuing while active
    if (isQueueing || status === 'active') return;
    // show the modal immediately + set status to queueing
    dispatch(queueStart());
    // emit socket join
    dispatch(socketQueueJoin({ timeControl: timeControlStr }));
  };


  const cancelQueue = () => {
    // hide modal immediately
    dispatch(queueStop());
    // tell server to remove from queue (middleware listens to this action)
    dispatch({ type: 'socket/leaveQueue' });
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

  // review open/close handlers
  const openReviewOnBoard = (gameMeta) => {
    setSelectedGameMeta(gameMeta);
    dispatch(setReviewing(true));
    dispatch(setSidebarTab('games'));
  };
  const closeReview = () => {
    setSelectedGameMeta(null);
    dispatch(setReviewing(false));
  };

  // modal: show queue modal while queued
  // const isQueueing = status === 'queueing';
  const isQueueing = useSelector((s) => s.game.queueing);

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        {/* top status */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs sm:text-sm text-zinc-300">
            {isAuthed ? (connected ? 'Connected' : 'Connecting…') : 'Not signed in'} · {status} · You are {color ?? '—'} · TC {timeControlStr}
          </div>

        </div>

        <div className="grid gap-12 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          {/* LEFT: board or review */}
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 blur opacity-50" />
            <div className="relative rounded-2xl bg-zinc-900/90 ring-1 ring-white/10 p-4 md:p-6">
              {/* TOP ROW: Opponent name + opponent timer */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-semibold">
                    { /* avatar placeholder */}O
                  </div>
                  <div className="text-sm font-semibold">{opponentEmail || 'Opponent'}</div>
                </div>

                <div className="text-sm text-zinc-300">{statusText}</div>

                {/* Opponent timer: show the correct clock depending on who is white/black */}
                <div className={`rounded-md px-3 py-1 text-sm font-mono ${turn === 'w' ? 'bg-black/10 text-emerald-300' : 'bg-black/30 text-zinc-200'}`}>
                  {/* The hook returns clocks keyed by color (w/b) typically. We map them to the displayed players: */}
                  {color === 'w' /* you are white - opponent is black */ ? fmt(displayClocks?.b) : fmt(displayClocks?.w)}
                </div>
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-1 text-xl opacity-80">
                {(color === 'w' ? captures.b : captures.w).map((t, i) => (
                  <span key={`oc-${i}`}>{glyph(t, color === 'w' ? 'w' : 'b')}</span>
                ))}
              </div>

              {reviewing && selectedGameMeta ? (
                <GameReview token={token} gameMeta={selectedGameMeta} onClose={closeReview} />
              ) : (
                <>
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

                  <div className="mt-2 flex flex-wrap items-center gap-1 text-xl">
                    {(color === 'w' ? captures.w : captures.b).map((t, i) => (
                      <span key={`yc-${i}`}>{glyph(t, color === 'w' ? 'b' : 'w')}</span>
                    ))}
                  </div>

                  {/* BOTTOM ROW: player (you) and your timer */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold">{user?.email || 'You'}</div>
                      <div className="text-xs text-zinc-400">({color === 'w' ? 'White' : 'Black'})</div>
                    </div>

                    <div className={`rounded-md px-3 py-1 text-sm font-mono ${turn === 'b' ? 'bg-black/10 text-emerald-300' : 'bg-black/30 text-zinc-200'}`}>
                      {color === 'w' /* you're white, so your clock is w */ ? fmt(displayClocks?.w) : fmt(displayClocks?.b)}
                    </div>
                  </div>

                  {/* controls under board */}
                  <div className="mt-5 flex flex-wrap items-center gap-3">
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
                      disabled={!isAuthed || status === 'active' || status === 'queueing'}
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
                </>
              )}
            </div>
          </div>

          {/* RIGHT: sidebar (unchanged) */}
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

            {/* New / Games / Players panels (same as your code) */}
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
                      // disabled={!isAuthed}
                      disabled={!isAuthed || status === 'active' || isQueueing}
                      className={`w-full rounded-xl px-4 py-3 text-sm disabled:cursor-not-allowed font-extrabold shadow-lg transition
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

                  {isAuthed && (
                    <>
                      {historyLoading && <div className="text-xs text-zinc-400">Loading…</div>}
                      {historyError && <div className="text-xs text-rose-400">Error: {historyError}</div>}

                      <div className="mt-2 space-y-2 max-h-72 overflow-auto">
                        {history.length === 0 && !historyLoading && <div className="text-xs text-zinc-400">No games yet.</div>}
                        {history.map((g) => (
                          <div key={g._id} className="flex items-center justify-between gap-2 rounded-md bg-white/2 p-2">
                            <div className="text-xs text-zinc-200">
                              <div className="font-semibold">{g.timeControl}</div>
                              <div className="text-zinc-400 text-[11px]">{new Date(g.startedAt).toLocaleString()}</div>
                              <div className="text-zinc-400 text-[11px]">Result: {g.result || '—'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openReviewOnBoard(g)}
                                className="rounded-md px-3 py-1 text-xs bg-indigo-600/70 font-semibold"
                              >
                                Review
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {reviewing && (
                    <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
                      Viewing a past game (review mode). Close the review to return to live play.
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

      {/* Queue / Matching Modal */}
      {isQueueing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900/95 ring-1 ring-white/10 p-6 text-center">
            <div className="text-lg font-bold mb-2">Searching for an opponent…</div>
            <div className="text-sm text-zinc-400 mb-6">We're matching you with an opponent for <span className="font-semibold">{timeControlStr}</span>.</div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={cancelQueue}
                className="rounded-xl px-4 py-2 bg-rose-500 hover:bg-rose-500/90 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
