// src/store/services/authApi.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE = import.meta.env.VITE_API_BASE;

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers) => {
      const t = localStorage.getItem('token');
      if (t) headers.set('authorization', `Bearer ${t}`);
      return headers;
    },
  }),
  endpoints: (builder) => ({
    requestOtp: builder.mutation({
      query: (body) => ({ url: '/auth/email/request-otp', method: 'POST', body }),
    }),
    signup: builder.mutation({
      query: (body) => ({ url: '/auth/email/signup', method: 'POST', body }),
    }),
    login: builder.mutation({
      query: (body) => ({ url: '/auth/email/login', method: 'POST', body }),
    }),
    me: builder.query({
      query: () => '/auth/me',
    }),
  }),
});

export const {
  useRequestOtpMutation,
  useSignupMutation,
  useLoginMutation,
  useMeQuery,
} = authApi;
