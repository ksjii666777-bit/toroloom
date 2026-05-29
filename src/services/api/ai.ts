import { api } from './client';
import type { AIInsight } from '../../types';

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
};
