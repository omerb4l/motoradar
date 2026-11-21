// Swap these for a real .env-driven config (e.g. expo-constants + app.config.ts)
// once environments diverge (dev / staging / prod).
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';
