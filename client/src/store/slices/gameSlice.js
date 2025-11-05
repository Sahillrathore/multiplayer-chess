// src/store/slices/gameSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connected: false,
  gameId: null,
  color: null,            // 'w' | 'b'
  status: 'idle',         // 'idle' | 'active' | 'ended'
  queueing: false,        // true while waiting in queue/matching
  fen: 'start',
  moves: [],
  turn: 'w',
  clocks: { w: 300000, b: 300000 },
  captures: { w: [], b: [] },

  // opponent info
  opponentId: null,
  opponentEmail: null,

  // UI-only bits
  tcSeconds: 300,
  sidebarTab: 'new',      // 'new' | 'games' | 'players'
  reviewing: false,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    // UI small reducers
    setConnected(state, action) {
      state.connected = action.payload;
    },
    setTimeControl(state, action) {
      state.tcSeconds = action.payload;
    },
    setSidebarTab(state, action) {
      state.sidebarTab = action.payload;
    },
    setReviewing(state, action) {
      state.reviewing = action.payload;
    },

    queueStart(state) {
      // mark UI as queueing and set a dedicated status
      state.queueing = true;
      state.status = 'queueing'; // was 'idle' — now explicit
    },
    queueStop(state) {
      state.queueing = false;
      // only revert status if we were in queueing state (don't touch active/ended)
      if (state.status === 'queueing') state.status = 'idle';
    },

    // ---- server -> client reducers (authoritative) ----
    // match made -> start a new active game
    queueMatched(state, action) {
      // payload shape may be:
      // { gameId, color, opponent: { id, email }, clocks? }
      // OR older shapes: { gameId, color, opponentId, opponentEmail }
      const payload = action.payload || {};
      const gameId = payload.gameId ?? null;
      const color = payload.color ?? null;

      // safe read opponent info (support nested or top-level fields)
      const opponentObj = payload.opponent || {};
      const opponentId = opponentObj.id ?? payload.opponentId ?? null;
      const opponentEmail = opponentObj.email ?? payload.opponentEmail ?? null;

      state.gameId = gameId;
      state.color = color;
      state.status = 'active';
      state.queueing = false;
      state.fen = 'start';
      state.moves = [];
      state.turn = 'w';
      state.captures = { w: [], b: [] };

      // server may include initial clocks in payload; if not, compute from tcSeconds
      if (payload.clocks && typeof payload.clocks === 'object') {
        state.clocks = payload.clocks;
      } else {
        const ms = state.tcSeconds * 1000;
        state.clocks = { w: ms, b: ms };
      }

      state.reviewing = false;
      state.opponentId = opponentId;
      state.opponentEmail = opponentEmail;
    },

    // resume a running/ongoing game (server authoritative snapshot)
    resumeGame(state, action) {
      const payload = action.payload || {};
      const {
        gameId,
        color,
        fen,
        moves = [],
        clocks,
        turn,
        status = 'active',
        captures,
      } = payload;

      // support both nested and top-level opponent fields
      const opponentObj = payload.opponent || {};
      const opponentId = opponentObj.id ?? payload.opponentId ?? null;
      const opponentEmail = opponentObj.email ?? payload.opponentEmail ?? null;

      state.gameId = gameId ?? state.gameId;
      state.color = color ?? state.color;
      state.status = status;
      state.fen = fen ?? state.fen;
      state.moves = moves;
      state.clocks = clocks || state.clocks || { w: 300000, b: 300000 };
      state.turn = turn || state.turn || 'w';
      state.captures = captures || state.captures || { w: [], b: [] };
      state.reviewing = false;
      state.queueing = false;
      state.opponentId = opponentId;
      state.opponentEmail = opponentEmail;
    },

    // periodic sync of game state (moves/clocks)
    syncState(state, action) {
      const payload = action.payload || {};
      const {
        fen,
        moves = [],
        clocks = state.clocks || { w: 300000, b: 300000 },
        turn = 'w',
        status = 'active',
        captures,
      } = payload;

      state.fen = fen ?? state.fen;
      state.moves = moves;
      state.clocks = clocks;
      state.turn = turn;
      state.status = status;
      if (captures) state.captures = captures;

      // accept updated opponent info (either nested or top-level)
      const opponentObj = payload.opponent || {};
      if (opponentObj.id !== undefined) state.opponentId = opponentObj.id;
      if (payload.opponentId !== undefined) state.opponentId = payload.opponentId;
      if (opponentObj.email !== undefined) state.opponentEmail = opponentObj.email;
      if (payload.opponentEmail !== undefined) state.opponentEmail = payload.opponentEmail;
    },

    // move applied by server
    applyMove(state, action) {
      const payload = action.payload || {};
      const { fen, clocks, captures } = payload;
      if (fen) state.fen = fen;
      if (clocks) state.clocks = clocks;
      // flip turn (server is authoritative about whose move it is, but we keep a simple flip)
      state.turn = state.turn === 'w' ? 'b' : 'w';
      if (captures) state.captures = captures;
    },

    endGame(state, action) {
      state.status = 'ended';
      state.queueing = false;
      // keep opponent info so user can see it; optionally clear it
    },

    // clear opponent info (call when leaving room or fully exiting)
    clearOpponent(state) {
      state.opponentId = null;
      state.opponentEmail = null;
    },
  },
});

export const {
  setConnected,
  setTimeControl,
  setSidebarTab,
  setReviewing,
  queueStart,
  queueStop,
  queueMatched,
  resumeGame,
  syncState,
  applyMove,
  endGame,
  clearOpponent,
} = gameSlice.actions;

export default gameSlice.reducer;
