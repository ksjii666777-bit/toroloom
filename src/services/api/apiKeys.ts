import { api } from './client';

export interface ApiKeyResponse {
  id: string;
  name: string;
  maskedKey: string;
  /** Full key — only present on creation */
  key?: string;
  createdAt: string;
  expiresAt: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  scopes: string[];
  ipRestrict: string | null;
  message?: string;
}

export interface ApiKeyListResponse {
  keys: ApiKeyResponse[];
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expiresInDays?: number;
  ipRestrict?: string;
}

export const apiKeyApi = {
  /** List all API keys for the current user */
  list: () => api.get<ApiKeyListResponse>('/user/api-keys'),

  /** Create a new API key */
  create: (data: CreateApiKeyRequest) =>
    api.post<ApiKeyResponse>('/user/api-keys', data),

  /** Revoke an API key */
  revoke: (id: string) =>
    api.put<{ id: string; isActive: boolean; message: string }>(`/user/api-keys/${id}`, { isActive: false }),

  /** Permanently delete an API key */
  delete: (id: string) =>
    api.delete(`/user/api-keys/${id}`),
};
