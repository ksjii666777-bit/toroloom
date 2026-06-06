import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { mockUser } from '../constants/mockData';
import { authApi } from '../services/api';
import { analytics } from '../services/analytics';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, phone: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateBalance: (amount: number) => void;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoggedIn: false,
  isLoading: false,

  loadStoredAuth: async () => {
    try {
      const storedToken = await AsyncStorage.getItem('toroloom_token');
      const storedUser = await AsyncStorage.getItem('toroloom_user');
      if (storedToken && storedUser) {
        const user = JSON.parse(storedUser);
        set({ user, token: storedToken, isLoggedIn: true });

        // Silently refresh profile from backend
        authApi.getProfile().then(profile => {
          set({ user: profile });
          AsyncStorage.setItem('toroloom_user', JSON.stringify(profile));
        }).catch(() => {
          // Backend unavailable – use cached data
        });
      }
    } catch { /* ignore */ }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(email, password);
      await AsyncStorage.setItem('toroloom_token', res.token);
      await AsyncStorage.setItem('toroloom_user', JSON.stringify(res.user));
      set({ user: res.user, token: res.token, isLoggedIn: true, isLoading: false });
      analytics.logEvent('login', { method: 'email' });
      analytics.setUserId(res.user.id);
      return true;
    } catch {
      // Backend unavailable — fall back to mock login
      if (email && password) {
        set({ user: mockUser, token: 'mock-token', isLoggedIn: true, isLoading: false });
        analytics.logEvent('login', { method: 'email' });
        return true;
      }
      set({ isLoading: false });
      return false;
    }
  },

  signup: async (name, email, phone, password) => {
    set({ isLoading: true });
    try {
      const res = await authApi.signup(name, email, phone, password);
      await AsyncStorage.setItem('toroloom_token', res.token);
      await AsyncStorage.setItem('toroloom_user', JSON.stringify(res.user));
      set({ user: res.user, token: res.token, isLoggedIn: true, isLoading: false });
      analytics.logEvent('signup', { method: 'email' });
      analytics.setUserId(res.user.id);
      return true;
    } catch {
      // Backend unavailable — fall back to mock
      const mockUserData = { ...mockUser, name, email, phone };
      set({ user: mockUserData, token: 'mock-token', isLoggedIn: true, isLoading: false });
      analytics.logEvent('signup', { method: 'email' });
      return true;
    }
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['toroloom_token', 'toroloom_user']);
    set({ user: null, token: null, isLoggedIn: false });
    analytics.logEvent('logout', {});
    analytics.reset();
  },

  updateBalance: (amount) => set((state) => ({
    user: state.user ? { ...state.user, balance: state.user.balance + amount } : null,
  })),
}));
