// src/pages/AuthCallback.jsx
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setToken } from '../store/slices/authSlice';

export default function AuthCallback() {
  const dispatch = useDispatch();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('token');
    if (token) {
      dispatch(setToken(token));
      window.location.replace('/');
    } else {
      window.location.replace('/login');
    }
  }, [dispatch]);

  return null;
}
