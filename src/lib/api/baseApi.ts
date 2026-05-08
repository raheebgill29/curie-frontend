import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
  reducerPath: 'curioApi',
  baseQuery: fetchBaseQuery({
    baseUrl:
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'https://api.curi-intelligence.com/',
  }),
  tagTypes: ['health', 'toy', 'parents', 'children', 'curriculum', 'sessions', 'auth'],
  endpoints: () => ({}),
});
