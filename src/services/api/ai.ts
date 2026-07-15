import { api } from './client';
import type { AIInsight } from '../../types';

export interface AIProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  model: string;
  active: boolean;
  endpoint?: string;
}

export interface AIStatusResponse {
  configured: boolean;
  activeProvider: string;
  availableProviders: AIProviderInfo[];
}

export const aiApi = {
  getInsights: (stockId?: string) => {
    let path = '/ai/insights';
    if (stockId) path += `?stockId=${stockId}`;
    return api.get<AIInsight[]>(path);
  },

  getInsight: (insightId: string) =>
    api.get<AIInsight>(`/ai/insights/${insightId}`),

  analyze: (symbol: string) =>
    api.post<AIInsight>('/ai/analyze', { symbol }),

  /** Get AI provider status from backend */
  getStatus: () =>
    api.get<AIStatusResponse>('/ai/status'),
};
