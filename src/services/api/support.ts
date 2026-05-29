import { api } from './client';

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
}

export const supportApi = {
  getFAQs: () => api.get<FAQ[]>('/support/faqs'),

  getFAQ: (faqId: string) =>
    api.get<FAQ>(`/support/faqs/${faqId}`),

  searchFAQs: (query: string) =>
    api.get<FAQ[]>(`/support/faqs/search?q=${encodeURIComponent(query)}`),
};
