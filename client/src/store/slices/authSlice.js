// src/store/slices/authSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    // Retrieve token and user from localStorage
    token: localStorage.getItem('token'),
    user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null, // 👈 FIX 1: Load user from localStorage
    status: localStorage.getItem('token') ? 'authenticated' : 'idle',
    error: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setToken(state, action) {
            state.token = action.payload;
            state.status = 'authenticated';
            state.error = null;
            localStorage.setItem('token', action.payload);
        },
        setUser(state, action) {
            state.user = action.payload;
            // 👈 FIX 2: Save user to localStorage
            if (action.payload) {
                localStorage.setItem('user', JSON.stringify(action.payload));
            } else {
                localStorage.removeItem('user');
            }
        },
        setAuthError(state, action) {
            state.error = action.payload || 'Auth error';
            state.status = 'error';
        },
        logout(state) {
            state.token = null;
            state.user = null;
            state.status = 'idle';
            state.error = null;
            localStorage.removeItem('token');
            localStorage.removeItem('user'); // 👈 FIX 3: Remove user on logout
        },
    },
});

export const { setToken, setUser, setAuthError, logout } = authSlice.actions;
export default authSlice.reducer;