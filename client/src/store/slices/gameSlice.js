import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connected: false,
  gameId: null,
  color: null,            // 'w' | 'b'
  status: 'idle',         // 'idle' | 'active' | 'ended'
  fen: 'start',
  moves: [],
  turn: 'w',
  clocks: { w: 300000, b: 300000 },
  captures: { w: [], b: [] },

  // UI-only bits
  tcSeconds: 300,
  sidebarTab: 'new',      // 'new' | 'games' | 'players'
  reviewing: false,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
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

    // ---- server -> client reducers (authoritative) ----
    queueMatched(state, action) {
      const { gameId, color } = action.payload;
      state.gameId = gameId;
      state.color = color;
      state.status = 'active';
      state.fen = 'start';
      state.moves = [];
      state.turn = 'w';
      state.captures = { w: [], b: [] };
      const ms = state.tcSeconds * 1000;
      state.clocks = { w: ms, b: ms };
      state.reviewing = false;
    },
    resumeGame(state, action) {
      const { gameId, color, fen, moves = [], clocks, turn, status = 'active', captures } = action.payload;
      state.gameId = gameId;
      state.color = color;
      state.status = status;
      state.fen = fen;
      state.moves = moves;
      state.clocks = clocks || { w: 300000, b: 300000 };
      state.turn = turn || 'w';
      state.captures = captures || { w: [], b: [] };
      state.reviewing = false;
    },
    syncState(state, action) {
      const { fen, moves = [], clocks = { w: 300000, b: 300000 }, turn = 'w', status = 'active', captures } = action.payload;
      state.fen = fen;
      state.moves = moves;
      state.clocks = clocks;
      state.turn = turn;
      state.status = status;
      if (captures) state.captures = captures;
    },
    applyMove(state, action) {
      const { fen, clocks, captures } = action.payload;
      state.fen = fen;
      state.clocks = clocks;
      state.turn = state.turn === 'w' ? 'b' : 'w';
      if (captures) state.captures = captures;
    },
    endGame(state, action) {
      state.status = 'ended';
      // optional: store last PGN/result if you want
    },
  },
});

export const {
  setConnected, setTimeControl, setSidebarTab, setReviewing,
  queueMatched, resumeGame, syncState, applyMove, endGame
} = gameSlice.actions;

export default gameSlice.reducer;
