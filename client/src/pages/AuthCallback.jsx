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
        // parse token from hash (#token=...)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const token = hashParams.get('token');

        if (!token) {
          window.location.replace('/auth'); // or '/login'
          return;
        }

        // Store token (authSlice.setToken also saves to localStorage)
        dispatch(setToken(token));

        // Optionally fetch user profile (so store has user on arrival)
        try {
          const meResult = await dispatch(authApi.endpoints.me.initiate()).unwrap();
          if (meResult) {
            if (meResult.user) dispatch(setUser(meResult.user));
            else if (meResult.email || meResult.id) dispatch(setUser(meResult));
          }
        } catch (e) {
          console.warn('[AuthCallback] failed to fetch /auth/me', e);
        }

        // Determine final redirect: priority -> query 'redirect' -> localStorage.postAuthRedirect -> '/'
        const qs = new URLSearchParams(window.location.search);
        const redirectParam = qs.get('redirect') || null;
        const localRedirect = localStorage.getItem('postAuthRedirect') || null;

        let finalRedirect = redirectParam || localRedirect || '/';
        if (!finalRedirect.startsWith('/')) finalRedirect = '/' + finalRedirect;
        if (localRedirect) localStorage.removeItem('postAuthRedirect');

        // Remove token from URL (so it's not visible in history)
        // Replace current history entry with the same path without hash
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);

        // Navigate to final destination
        window.location.replace(finalRedirect);
      } catch (err) {
        console.error('[AuthCallback] unexpected error', err);
        window.location.replace('/auth');
      }
    })();
  }, [dispatch]);

  return null;
}
