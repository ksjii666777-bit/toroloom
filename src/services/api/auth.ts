import { api } from './client';
import type { User } from '../../types';

export interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }, { skipAuth: true }),

  signup: (name: string, email: string, phone: string, password: string) =>
    api.post<AuthResponse>('/auth/signup', { name, email, phone, password }, { skipAuth: true }),

  getProfile: () => api.get<User>('/auth/profile'),

  updateProfile: (data: { name?: string; phone?: string }) =>
    api.put<User>('/auth/profile', data),

  /** Record a referral source for the currently authenticated user */
  recordReferral: (source: string) =>
    api.post<{ success: boolean; message: string }>('/auth/referral', { source }),
};
