import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';


import GameReview from './components/GameReview';
import Sidebar from './components/Sidebar';
import PromotionPrompt from './components/PromotionPrompt';
import { authGuest, joinChallenge, fetchGameDetails } from '../src/store/services/challenges'; // adjust path
import { useParams } from "react-router-dom";
import { setTimeControl, setSidebarTab, setReviewing, queueStart, queueStop } from '../src/store/slices/gameSlice';

import {
  socketQueueJoin,
  socketOfferDraw,
  socketResign,
  socketSendMove,
} from '../src/store/socketActions';
import useRealtimeClocks from '../src/hooks/useRealtimeClocks';
import { logout as logoutAction } from '../src/store/slices/authSlice';
import TimeControlSelect from './components/TimeControlSelect';

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

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [selectedGameMeta, setSelectedGameMeta] = useState(null);

  // promotion flow
  const [pendingPromotion, setPendingPromotion] = useState(null); // { from, to, color }
  // override fen when seeking
  const [overrideFen, setOverrideFen] = useState(null);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState(-1);
  const prevMovesLenRef = useRef((moves && moves.length) || 0);
  const prevSelectedMoveIndexRef = useRef(selectedMoveIndex);

  // responsive board width
  const [boardWidth, setBoardWidth] = useState(520);

  // sounds (refs to Audio objects)
  const moveSoundRef = useRef(null);
  const captureSoundRef = useRef(null);
  const checkSoundRef = useRef(null);
  const rewindSoundRef = useRef(null);
  const gameEndSoundRef = useRef(null);

  const displayClocks = useRealtimeClocks();
  const timeControlStr = useMemo(() => `${tcSeconds}+0`, [tcSeconds]);
  const chess = useMemo(() => new Chess(fen === 'start' ? undefined : fen), [fen]);

  // Build move rows for display and also include glyphs where possible
  const moveRows = useMemo(() => {
    const arr = moves || [];
    const rows = [];
    for (let i = 0; i < arr.length; i += 2) {
      const w = arr[i] || null;
      const b = arr[i + 1] || null;

      const wGlyph = w ? (w.piece ? glyph(w.piece, w.color) : '') : '';
      const bGlyph = b ? (b.piece ? glyph(b.piece, b.color) : '') : '';

      rows.push({
        moveNo: Math.floor(i / 2) + 1,
        white: w ? (w.san || '') : '',
        whiteFen: w ? w.fen || null : null,
        black: b ? (b.san || '') : '',
        blackFen: b ? b.fen || null : null,
        whiteIndex: i,
        blackIndex: i + 1,
        whiteGlyph: wGlyph,
        blackGlyph: bGlyph,
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

  const { gameId: routeGameId } = useParams(); // rename variable to avoid conflict with state.gameId
  useEffect(() => {
    let cancelled = false;
    async function loadGameFromServer(id) {
      try {
        const g = await fetchGameDetails(id); // GET /games/:id
        if (cancelled) return;
        // g: { _id, timeControl, youAre, moves, startFEN, pgn, whiteId, blackId }
        const payload = {
          gameId: id,
          color: g.youAre || (g.whiteId && String(g.whiteId) === String(user?.id) ? "w" : "b"),
          fen: g.startFEN || "start",
          moves: g.moves || [],
          clocks: { w: Number(g.timeControl?.split("+")[0] || 300) * 1000, b: Number(g.timeControl?.split("+")[0] || 300) * 1000 },
          turn: "w",
          status: "active",
          opponent: {
            id: g.youAre === "w" ? g.blackId : g.whiteId,
            email: null // server / socket will emit opponentEmail; optional: extend /games/:id to include emails
          }
        };
        dispatch(resumeGame(payload));
      } catch (e) {
        console.warn("[play route] fetchGameDetails failed", e);
      }
    }

    if (routeGameId) {
      // if Redux already has this gameId and status active, don't re-fetch
      if (gameId !== routeGameId) {
        loadGameFromServer(routeGameId);
      }
    }
    return () => { cancelled = true; };
  }, [routeGameId, dispatch]);


  // ------------------ Sound setup ------------------
  useEffect(() => {

    const base = '/sounds';
    moveSoundRef.current = new Audio(`${base}/move.mp3`);
    captureSoundRef.current = new Audio(`${base}/capture.mp3`);
    checkSoundRef.current = new Audio(`${base}/check.mp3`);
    rewindSoundRef.current = new Audio(`${base}/move.mp3`);
    gameEndSoundRef.current = new Audio(`${base}/gameend.mp3`);

    // Preload
    [moveSoundRef, captureSoundRef, checkSoundRef, rewindSoundRef, gameEndSoundRef].forEach(r => {
      try { if (r.current) r.current.preload = 'auto'; } catch (e) { }
    });
  }, []);

  // ------------------ Responsive board width ------------------
  useEffect(() => {
    const compute = () => {
      const w = Math.min(630, Math.max(360, Math.floor(window.innerWidth * 0.45)));
      setBoardWidth(w);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // Reset overrideFen when new move arrives (so board follows live)
  useEffect(() => {
    const prevLen = prevMovesLenRef.current;
    const curLen = (moves && moves.length) || 0;

    // when a new move is received from server (live play)
    if (curLen > prevLen) {
      // play sounds for the incoming move (determine capture/check)
      const last = moves[curLen - 1];
      if (last) {
        // capture
        if (last.captured) {
          try { captureSoundRef.current?.play(); } catch (e) { }
        } else {
          try { moveSoundRef.current?.play(); } catch (e) { }
        }
        // check: create a chess position from the move's fen (if available)
        if (last.fen) {
          try {
            const c = new Chess(last.fen);
            // After a move, the side to move is the side NOT just moved.
            // If that side is in check -> the previous move gave check.
            if (c.in_check()) {
              try { checkSoundRef.current?.play(); } catch (e) { }
            }
          } catch (e) { console.log(e) }
        }
      }

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

  /**
   * Helper: check if a move from->to is a promotion (based on current fen)
   * returns array of possible promotions (['q','r','b','n']) or [].
   */
  const availablePromotionsForMove = useCallback((from, to, fenPosition) => {
    try {
      const t = new Chess(fenPosition === 'start' ? undefined : fenPosition);
      const legal = t.moves({ verbose: true });
      const matches = legal.filter(m => m.from === from && m.to === to && m.promotion);
      if (matches.length > 0) {
        return ['q', 'r', 'b', 'n'];
      }
      return [];
    } catch (e) {
      return [];
    }
  }, []);

  // onPieceDrop callback for react-chessboard:
  const onDrop = useCallback(
    (from, to) => {
      if (status !== 'active' || !gameId) return false;
      if (color !== turn) return false;

      const test = new Chess(fen === 'start' ? undefined : fen);
      const promotions = availablePromotionsForMove(from, to, fen);
      if (promotions.length > 0) {
        // open our custom UI and DO NOT let the board perform its promotion
        setPendingPromotion({ from, to, color });
        return false; // important: stop the board's default handling
      }

      // normal move path
      const mv = test.move({ from, to, promotion: 'q' });
      if (!mv) return false;
      dispatch(socketSendMove({ gameId, from, to, promotion: mv.promotion || 'q' }));
      return true;
    },
    [status, gameId, color, turn, fen, dispatch, availablePromotionsForMove]
  );

  // when user chooses promotion from our prompt
  const handlePromotionChoose = (prom) => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    dispatch(socketSendMove({ gameId, from, to, promotion: prom || 'q' }));
    setPendingPromotion(null);
  };
  const handlePromotionCancel = () => {
    setPendingPromotion(null);
  };

  // ------------------ Seek / rewind sound ------------------
  function seekToMoveIndex(idx) {
    // play rewind sound when user moves to a previous or different move
    try { rewindSoundRef.current?.play(); } catch (e) { }

    if (idx < 0) {
      setOverrideFen(null);
      setSelectedMoveIndex(-1);
      prevSelectedMoveIndexRef.current = -1;
      return;
    }
    const m = (moves && moves[idx]) || null;
    if (m && m.fen) {
      setOverrideFen(m.fen);
      setSelectedMoveIndex(idx);
      prevSelectedMoveIndexRef.current = idx;
    } else {
      try {
        const c = new Chess();
        for (let i = 0; i <= idx; i++) {
          const mv = moves[i];
          if (!mv) break;
          if (mv.from && mv.to) {
            c.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
          } else if (mv.san) {
            c.move(mv.san);
          }
        }
        setOverrideFen(c.fen());
        setSelectedMoveIndex(idx);
        prevSelectedMoveIndexRef.current = idx;
      } catch (e) {
        console.warn('seek compute failed', e);
      }
    }
  }

  const openReviewOnBoard = (gameMeta) => {
    setSelectedGameMeta(gameMeta);
    dispatch(setReviewing(true));
    dispatch(setSidebarTab('games'));
  };
  const closeReview = () => {
    setSelectedGameMeta(null);
    dispatch(setReviewing(false));
  };

  // ------------------ last move highlighting ------------------
  const shownPosition = overrideFen ?? fen;
  const lastMove = useMemo(() => {
    if (selectedMoveIndex >= 0) return moves && moves[selectedMoveIndex] ? moves[selectedMoveIndex] : null;
    if (!moves || moves.length === 0) return null;
    return moves[moves.length - 1];
  }, [moves, selectedMoveIndex]);

  const customSquareStyles = useMemo(() => {
    const styles = {};
    if (lastMove && lastMove.from) {
      styles[lastMove.from] = {
        background:
          'linear-gradient(90deg, rgba(16,185,129,0.18), rgba(16,185,129,0.08))',
        boxShadow: 'inset 0 0 0 3px rgba(16,185,129,0.08)',
      };
    }
    if (lastMove && lastMove.to) {
      styles[lastMove.to] = {
        background:
          'linear-gradient(90deg, rgba(34,211,238,0.16), rgba(34,211,238,0.06))',
        boxShadow: 'inset 0 0 0 3px rgba(34,211,238,0.06)',
      };
    }
    return styles;
  }, [lastMove]);

  // ------------------ Game end modal ------------------
  const [showGameEndModal, setShowGameEndModal] = useState(false);
  const [gameEndMessage, setGameEndMessage] = useState('Game Over');

  // open game end modal when status transitions to 'ended'
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== 'ended' && status === 'ended') {
      // build a friendly message if possible (you can enhance by using game meta)
      const last = moves && moves.length ? moves[moves.length - 1] : null;
      const msg = 'Game Over';
      setGameEndMessage(msg);
      setShowGameEndModal(true);
      try { gameEndSoundRef.current?.play(); } catch (e) { }
    }
    prevStatusRef.current = status;
  }, [status, moves]);

  // close modal
  const closeGameEndModal = () => setShowGameEndModal(false);

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 relative overflow-hidden">
      <div className="absolute w-72 h-72 bg-purple-600/20 blur-3xl rounded-full -top-20 -left-20 animate-"></div>
      <div className="absolute w-72 h-72 bg-blue-600/30 blur-3xl rounded-full -bottom-10 -right-10"></div>

      <div className="mx-auto max-w-[68rem] sm:px-4 py-6 md:py-3">
        <div className="grid gap-12">
          {/* LEFT: board */}
          <div className="relative flex sm:flex-row flex-col gap-2 w-full">
            <div className="absolute -inset-0.5 rounded-md bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 blur opacity-50" />
            <div className="relative sm:rounded-xl bg-black ring-1 ring-white/10 p-1 sm:p-4 md:p-6 md:py-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-base uppercase font-semibold">{opponentEmail?.slice(0, 1) || "O"}</div>
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
                    customSquareStyles={customSquareStyles}
                    boardWidth={boardWidth}
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

            {/* RIGHT: Sidebar component */}
            <Sidebar
              tcSeconds={tcSeconds}
              isAuthed={isAuthed}
              status={status}
              isQueueing={isQueueing}
              findMatch={findMatch}
              cancelQueue={cancelQueue}
              moveRows={moveRows}
              movesCount={(moves && moves.length) || 0}
              selectedMoveIndex={selectedMoveIndex}
              seekToMoveIndex={seekToMoveIndex}
              history={history}
              historyLoading={historyLoading}
              historyError={historyError}
              openReviewOnBoard={openReviewOnBoard}
              reviewing={reviewing}
              gameId={gameId}
              offerDraw={offerDraw}
              resign={resign}
            />
          </div>


        </div>
      </div>

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

      {/* promotion prompt overlay */}
      <PromotionPrompt
        visible={!!pendingPromotion}
        color={pendingPromotion?.color || 'w'}
        onChoose={handlePromotionChoose}
        onCancel={handlePromotionCancel}
      />

      {/* Game end modal */}
      {showGameEndModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900/95 ring-1 ring-white/10 p-6 text-center">
            <h3 className="text-lg font-bold mb-2">{gameEndMessage}</h3>
            <p className="text-sm text-zinc-300 mb-4">The game has ended.</p>
            <div className="flex justify-center gap-3">
              <button onClick={closeGameEndModal} className="rounded-xl px-4 py-2 bg-emerald-600 hover:bg-emerald-500 font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
