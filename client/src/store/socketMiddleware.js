// src/store/socketMiddleware.js
import { io } from 'socket.io-client';
import {
  setConnected, queueMatched, queueStop, resumeGame, syncState, applyMove, endGame
} from './slices/gameSlice';

let socket = null;
let lastToken = null;

function connect(store, token) {
  if (!token) return;
  if (socket) socket.disconnect();

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

  // IMPORTANT: match your server’s CORS, path, and transports
  socket = io(API_BASE, {
    path: '/socket.io',              // change if your server uses a custom path
    transports: ['websocket'],       // add 'polling' if needed: ['websocket','polling']
    withCredentials: true,           // if your server uses cookies
    auth: { token },                 // server will read token from handshake
  });

  // --- logs so you SEE what's going on ---
  socket.on('connect', () => {
    console.log('[socket] connected', socket.id);
    store.dispatch(setConnected(true));
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] connect_error', err?.message || err);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[socket] disconnected', reason);
    store.dispatch(setConnected(false));
  });

  // ---- server -> client events (dispatch into game slice) ----
  socket.on('queue:matched', (payload) => {
    console.log('[socket] event queue:matched', payload);
    store.dispatch(queueMatched(payload));
  });

  socket.on('game:resume', (payload) => {
    console.log('[socket] event game:resume', payload);
    store.dispatch(resumeGame(payload));
  });

  socket.on('game:state', (payload) => {
    // payload should include: { fen, moves, clocks, turn, status, captures }
    // console.log('[socket] event game:state', payload);
    store.dispatch(syncState(payload));
  });

  socket.on('game:move', (payload) => {
    // payload should include: { fen, clocks, captures }
    // console.log('[socket] event game:move', payload);
    store.dispatch(applyMove(payload));
  });

  socket.on('queue:error', (payload) => {
    console.warn('[socket] queue:error', payload);
    store.dispatch(queueStop());
    // optionally show a toast: payload.message
  });

  socket.on('game:ended', (payload) => {
    console.log('[socket] event game:ended', payload);
    store.dispatch(endGame(payload));
  });

  socket.on('error', (e) => console.warn('[socket] server error', e));
}

const socketMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  // 1) Connect when token changes (login) or on boot (see store/index.js step)
  if (action.type === 'auth/setToken') {
    lastToken = action.payload;
    connect(store, lastToken);
  }

  // 2) Disconnect when logging out
  if (action.type === 'auth/logout') {
    if (socket) socket.disconnect();
    socket = null;
    lastToken = null;
    store.dispatch(setConnected(false));
  }

  // 3) Intercept socket/* emits
  if (socket) {
    switch (action.type) {
      case 'socket/queueJoin': {
        const { timeControl } = action.payload; // e.g., "300+0"
        console.log('[socket] emit queue:join', { timeControl });
        socket.emit('queue:join', { timeControl });
        break;
      }
      case 'socket/offerDraw': {
        const { gameId } = action.payload;
        console.log('[socket] emit game:offerDraw', { gameId });
        socket.emit('game:offerDraw', { gameId });
        break;
      }
      case 'socket/resign': {
        const { gameId } = action.payload;
        console.log('[socket] emit game:resign', { gameId });
        socket.emit('game:resign', { gameId });
        break;
      }
      case 'socket/sendMove': {
        const { gameId, from, to, promotion } = action.payload;
        console.log('[socket] emit game:move', { gameId, from, to, promotion });
        socket.emit('game:move', { gameId, from, to, promotion });
        break;
      }
      default:
        break;
    }
  } else {
    // Helpful warning if you try to emit before connecting
    if (action.type.startsWith('socket/')) {
      console.warn('[socket] not connected — did auth/setToken run?');
    }
  }

  return result;
};

export default socketMiddleware;
