/* global __GOOGLE_CLIENT_ID__ */
// Injected by vite.config.js (VITE_GOOGLE_CLIENT_ID, or GOOGLE_CLIENT_ID from backend/.env)
export const GOOGLE_CLIENT_ID = typeof __GOOGLE_CLIENT_ID__ === 'string' ? __GOOGLE_CLIENT_ID__ : ''
