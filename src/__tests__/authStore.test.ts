/**
 * ============================================================================
 * Toroloom — Auth Store Tests
 * ============================================================================
 *
 * Tests the auth store: login, logout, signup, loadStoredAuth,
 * and balance updates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';

describe('AuthStore — Initial State', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isLoggedIn: false,
      isLoading: false,
    });
  });

  it('starts logged out', () => {
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('starts not loading', () => {
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

describe('AuthStore — Login', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isLoggedIn: false,
      isLoading: false,
    });
  });

  it('sets loading state during login', async () => {
    const loginPromise = useAuthStore.getState().login('test@test.com', 'password');
    expect(useAuthStore.getState().isLoading).toBe(true);
    await loginPromise;
  });

  it('logs in and sets user state on success', async () => {
    const result = await useAuthStore.getState().login('rahul@email.com', 'password123');
    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(state.user).not.toBeNull();
    expect(state.token).not.toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('returns false for failed login', async () => {
    // Mock the authApi.login to reject
    const { authApi } = await import('../services/api/auth');
    (authApi.login as any).mockRejectedValueOnce(new Error('Network error'));

    // Clear the state so mock fallback is not triggered
    useAuthStore.setState({
      user: null,
      token: null,
      isLoggedIn: false,
      isLoading: false,
    });

    const result = await useAuthStore.getState().login('', '');
    expect(result).toBe(false);
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });
});

describe('AuthStore — Signup', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isLoggedIn: false,
      isLoading: false,
    });
  });

  it('sets loading state during signup', async () => {
    const signupPromise = useAuthStore.getState().signup('Test', 'test@test.com', '9999999999', 'password');
    expect(useAuthStore.getState().isLoading).toBe(true);
    await signupPromise;
  });

  it('registers and logs in on success', async () => {
    const result = await useAuthStore.getState().signup('Rahul', 'rahul@email.com', '9876543210', 'password123');
    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(state.user).not.toBeNull();
    expect(state.user?.name).toBe('Rahul');
    expect(state.isLoading).toBe(false);
  });
});

describe('AuthStore — Logout', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', name: 'Test', email: 'test@test.com', phone: '9999999999', kycStatus: 'verified', balance: 1000, createdAt: '2025-01-01' },
      token: 'mock-token',
      isLoggedIn: true,
      isLoading: false,
    });
  });

  it('clears user and token on logout', async () => {
    await useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });
});

describe('AuthStore — Balance Updates', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 'u1', name: 'Test', email: 'test@test.com', phone: '9999999999', kycStatus: 'verified', balance: 50000, createdAt: '2025-01-01' },
      token: 'token',
      isLoggedIn: true,
      isLoading: false,
    });
  });

  it('adds funds to balance', () => {
    useAuthStore.getState().updateBalance(10000);
    expect(useAuthStore.getState().user?.balance).toBe(60000);
  });

  it('deducts from balance', () => {
    useAuthStore.getState().updateBalance(-5000);
    expect(useAuthStore.getState().user?.balance).toBe(45000);
  });

  it('does nothing when user is null', () => {
    useAuthStore.setState({ user: null });
    useAuthStore.getState().updateBalance(1000);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('AuthStore — LoadStoredAuth', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isLoggedIn: false,
      isLoading: false,
    });
  });

  it('does nothing when no stored auth exists', async () => {
    await useAuthStore.getState().loadStoredAuth();
    const state = useAuthStore.getState();
    expect(state.isLoggedIn).toBe(false);
  });
});
