// src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setToken, setUser } from '../store/slices/authSlice';
import { authApi } from '../store/services/authApi';

export default function AuthCallback() {
  const dispatch = useDispatch();

  useEffect(() => {
    (async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const token = hash.get('token');

        if (!token) {
          window.location.replace('/login');
          return;
        }

        // 1) store token in redux + localStorage (authSlice handles localStorage)
        dispatch(setToken(token));

        // 2) request server profile (uses prepareHeaders -> will read token from localStorage)
        //    We use dispatch(authApi.endpoints.me.initiate()) so the result is cached for useMeQuery hooks
        try {
          const meResult = await dispatch(authApi.endpoints.me.initiate()).unwrap();
          // meResult shape depends on your API; adjust below if necessary
          console.log(meResult);
          
          if (meResult && meResult.user) {
            dispatch(setUser(meResult.user));
          } else if (meResult && meResult.email) {
            // fallback if your /me returns the user object directly (no wrapper)
            dispatch(setUser(meResult));
          }
        } catch (meErr) {
          // profile fetch failed — still continue but log for debugging
          console.warn('Failed to fetch /auth/me after OAuth callback:', meErr);
        }

        // 3) navigate home
        window.location.replace('/');
      } catch (err) {
        console.error('Auth callback error:', err);
        window.location.replace('/login');
      }
    })();
  }, [dispatch]);

  return null;
}
