import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { AuthUser, login as loginRequest, signup as signupRequest } from '@/services/api/authApi';
import { disconnectSocket } from '@/services/socket/socketClient';

const TOKEN_KEY = 'motoradar.authToken';
const USER_KEY = 'motoradar.authUser';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isHydrating: boolean;
  isSubmitting: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isHydrating: true,
  isSubmitting: false,
  error: null,

  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      if (token && userJson) {
        set({ token, user: JSON.parse(userJson) as AuthUser });
      }
    } catch (err) {
      console.warn('Auth store hydration warning:', err);
      // Clean up potentially corrupted stored state
      set({ user: null, token: null });
    } finally {
      set({ isHydrating: false });
    }
  },

  login: async (email, password) => {
    set({ isSubmitting: true, error: null });
    try {
      const { user, token } = await loginRequest({ email, password });
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, token),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
      ]);
      set({ user, token, isSubmitting: false });
    } catch (err) {
      set({ isSubmitting: false, error: err instanceof Error ? err.message : 'Login failed' });
      throw err;
    }
  },

  signup: async (username, email, password) => {
    set({ isSubmitting: true, error: null });
    try {
      const { user, token } = await signupRequest({ username, email, password });
      await Promise.all([
        SecureStore.setItemAsync(TOKEN_KEY, token),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
      ]);
      set({ user, token, isSubmitting: false });
    } catch (err) {
      set({ isSubmitting: false, error: err instanceof Error ? err.message : 'Signup failed' });
      throw err;
    }
  },

  logout: async () => {
    disconnectSocket();
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
    set({ user: null, token: null });
  },

  clearError: () => set({ error: null }),
}));
