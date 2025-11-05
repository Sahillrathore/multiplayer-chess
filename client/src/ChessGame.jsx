// ChessGame.jsx
import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
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
    opponentEmail,
  } = useSelector((s) => s.game);
  const { token, user } = useSelector((s) => s.auth);
  const isAuthed = !!token;

  // local: history & selected review meta
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [selectedGameMeta, setSelectedGameMeta] = useState(null);

  // local: override fen when user seeks a past move
  const [overrideFen, setOverrideFen] = useState(null);
  // track currently selected moveIndex (-1 means start position)
  const [selectedMoveIndex, setSelectedMoveIndex] = useState(-1);

  // keep previous moves length to detect new incoming move and reset override
  const prevMovesLenRef = useRef((moves && moves.length) || 0);

  // live display clocks derived from server bases (should return { w: ms, b: ms })
  const displayClocks = useRealtimeClocks();

  const timeControlStr = useMemo(() => `${tcSeconds}+0`, [tcSeconds]);
  const chess = useMemo(() => new Chess(fen === 'start' ? undefined : fen), [fen]);

  // Build move rows for display: each row contains moveNo, whiteSan, blackSan, whiteFen, blackFen
  const moveRows = useMemo(() => {
    const arr = moves || [];
    const rows = [];
    for (let i = 0; i < arr.length; i += 2) {
      rows.push({
        moveNo: Math.floor(i / 2) + 1,
        white: arr[i] ? (arr[i].san || '') : '',
        whiteFen: arr[i] ? arr[i].fen || null : null,
        black: arr[i + 1] ? (arr[i + 1].san || '') : '',
        blackFen: arr[i + 1] ? arr[i + 1].fen || null : null,
        whiteIndex: i,
        blackIndex: i + 1,
      });
    }
    return rows;
  }, [moves]);

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

  // Reset overrideFen when new move arrives (so board follows live)
  useEffect(() => {
    const prevLen = prevMovesLenRef.current;
    const curLen = (moves && moves.length) || 0;
    if (curLen > prevLen) {
      // new move pushed -> clear any override and selection
      setOverrideFen(null);
      setSelectedMoveIndex(-1);
    }
    prevMovesLenRef.current = curLen;
  }, [moves]);

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
  const isQueueing = useSelector((s) => s.game.queueing);

  const findMatch = () => {
    if (!isAuthed) return alert('Please sign in first.');
    if (isQueueing || status === 'active') return;
    dispatch(queueStart());
    dispatch(socketQueueJoin({ timeControl: timeControlStr }));
  };

  const cancelQueue = () => {
    dispatch(queueStop());
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

  // move seek handlers
  const seekToMoveIndex = (idx) => {
    if (idx < 0) {
      setOverrideFen(null);
      setSelectedMoveIndex(-1);
      return;
    }
    const m = (moves && moves[idx]) || null;
    if (m && m.fen) {
      setOverrideFen(m.fen);
      setSelectedMoveIndex(idx);
    } else {
      // if fen is not available, attempt to compute fen client-side (less reliable)
      // compute from starting FEN by replaying moves up to idx
      try {
        const c = new Chess();
        for (let i = 0; i <= idx; i++) {
          const mv = moves[i];
          if (!mv) break;
          // we expect moves to contain from/to/promotion
          if (mv.from && mv.to) {
            c.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
          } else if (mv.san) {
            c.move(mv.san);
          }
        }
        setOverrideFen(c.fen());
        setSelectedMoveIndex(idx);
      } catch (e) {
        // fallback: do nothing
        console.warn('seek compute failed', e);
      }
    }
  };

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

  // position shown on board: overrideFen if set else live fen
  const shownPosition = overrideFen ?? fen;

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
        <div className="grid gap-12 md:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
          {/* LEFT: board */}
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 blur opacity-50" />
            <div className="relative rounded-2xl bg-zinc-900/90 ring-1 ring-white/10 p-4 md:p-6">
              {/* header row */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-semibold">O</div>
                  <div className="text-sm font-semibold">{opponentEmail || 'Opponent'}</div>
                </div>
                <div className="text-sm text-zinc-300">{statusText}</div>
                <div className={`rounded-md px-3 py-1 text-sm font-mono ${turn === 'w' ? 'bg-black/10 text-emerald-300' : 'bg-black/30 text-zinc-200'}`}>
                  {color === 'w' ? fmt(displayClocks?.b) : fmt(displayClocks?.w)}
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
                    position={shownPosition}
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

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold">{user?.email || 'You'}</div>
                      <div className="text-xs text-zinc-400">({color === 'w' ? 'White' : 'Black'})</div>
                    </div>

                    <div className={`rounded-md px-3 py-1 text-sm font-mono ${turn === 'b' ? 'bg-black/10 text-emerald-300' : 'bg-black/30 text-zinc-200'}`}>
                      {color === 'w' ? fmt(displayClocks?.w) : fmt(displayClocks?.b)}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: Moves list + controls + history */}
          <div className="space-y-4">
            {/* controls panel */}
            <div className="rounded-2xl bg-[#1f1f1f] ring-1 ring-white/10 p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => dispatch(setSidebarTab('new'))} className="px-2 py-1 rounded bg-white/5 text-xs">New</button>
                  <button onClick={() => dispatch(setSidebarTab('games'))} className="px-2 py-1 rounded bg-white/5 text-xs">Games</button>
                </div>
                <div className="text-xs text-zinc-400">{isAuthed ? (connected ? 'Connected' : 'Connecting…') : 'Not signed in'}</div>
              </div>

              {/* Time control + Start */}
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <select value={tcSeconds} onChange={(e) => dispatch(setTimeControl(Number(e.target.value)))} className="rounded-xl border border-white/10 bg-black px-2 py-1 text-xs">
                    <option value={60}>1 min</option>
                    <option value={180}>3 min</option>
                    <option value={300}>5 min</option>
                    <option value={600}>10 min</option>
                  </select>
                  <button onClick={findMatch} disabled={!isAuthed || status === 'active' || isQueueing} className="rounded-xl px-3 py-1 bg-emerald-600 text-xs disabled:opacity-60">Start Game</button>
                  {isQueueing && <button onClick={cancelQueue} className="rounded-xl px-3 py-1 bg-rose-600 text-xs">Cancel</button>}
                </div>
              </div>

              {/* Moves list */}
              <div className="rounded-xl bg-zinc-900/70 p-3 ring-1 ring-white/5 max-h-[48vh] overflow-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-zinc-200">Moves</div>
                  <div className="text-xs text-zinc-400">Moves: {(moves && moves.length) || 0}</div>
                </div>

                <ol className="text-sm leading-6 space-y-1">
                  {moveRows.length === 0 && <li className="text-xs text-zinc-400">No moves yet</li>}
                  {moveRows.map((r) => (
                    <li key={r.moveNo} className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center">
                      {/* move number: click to go to start of that move (white's start) */}
                      <button
                        onClick={() => seekToMoveIndex(r.whiteIndex)}
                        className={`text-left text-xs px-2 py-1 rounded ${selectedMoveIndex === r.whiteIndex || selectedMoveIndex === r.blackIndex ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-300 hover:bg-white/5'}`}
                        title={`Go to move ${r.moveNo}`}
                      >
                        {r.moveNo}.
                      </button>

                      {/* white move */}
                      <button
                        onClick={() => seekToMoveIndex(r.whiteIndex)}
                        className={`text-left text-xs px-2 py-1 rounded ${selectedMoveIndex === r.whiteIndex ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-300 hover:bg-white/5'}`}
                        title={r.white}
                      >
                        {r.white || '—'}
                      </button>

                      {/* black move */}
                      <button
                        onClick={() => seekToMoveIndex(r.blackIndex)}
                        className={`text-left text-xs px-2 py-1 rounded ${selectedMoveIndex === r.blackIndex ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-300 hover:bg-white/5'}`}
                        title={r.black}
                      >
                        {r.black || '—'}
                      </button>
                    </li>
                  ))}
                </ol>

                {/* "Back to live" quick button */}
                <div className="mt-3 text-right">
                  <button onClick={() => seekToMoveIndex(-1)} className="text-xs px-2 py-1 rounded bg-white/5">Back to live</button>
                </div>
              </div>
            </div>

            {/* History / Games panel (kept minimal) */}
            <div className="relative rounded-2xl bg-zinc-900/70 ring-1 ring-white/10 backdrop-blur-xl p-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-200">Your Games</h2>
              {historyLoading && <div className="text-xs text-zinc-400">Loading…</div>}
              {historyError && <div className="text-xs text-rose-400">Error: {historyError}</div>}
              <div className="space-y-2 max-h-36 overflow-auto">
                {history.length === 0 && !historyLoading && <div className="text-xs text-zinc-400">No games yet.</div>}
                {history.map((g) => (
                  <div key={g._id} className="flex items-center justify-between gap-2 rounded-md bg-white/2 p-2">
                    <div className="text-xs text-zinc-200">
                      <div className="font-semibold">{g.timeControl}</div>
                      <div className="text-zinc-400 text-[11px]">{new Date(g.startedAt).toLocaleString()}</div>
                      <div className="text-zinc-400 text-[11px]">Result: {g.result || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openReviewOnBoard(g)} className="rounded-md px-3 py-1 text-xs bg-indigo-600/70 font-semibold">Review</button>
                    </div>
                  </div>
                ))}
              </div>

              {reviewing && (
                <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
                  Viewing a past game (review mode). Close the review to return to live play.
                </div>
              )}
            </div>
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
              <button onClick={cancelQueue} className="rounded-xl px-4 py-2 bg-rose-500 hover:bg-rose-500/90 font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
