// src/store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { setToken } from './slices/authSlice';
import gameReducer from './slices/gameSlice';
import { authApi } from './services/authApi';
import socketMiddleware from './socketMiddleware';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    game: gameReducer,
    [authApi.reducerPath]: authApi.reducer,
  },
  middleware: (getDefault) =>
    getDefault({ serializableCheck: false }).concat(authApi.middleware, socketMiddleware),
});

// AUTO-CONNECT ON REFRESH if token exists
const bootToken = localStorage.getItem('token');
if (bootToken) {
  store.dispatch(setToken(bootToken)); // this is redundant if you load token in slice initialState
  // trigger me() to populate user
  store.dispatch(authApi.endpoints.me.initiate());
}
