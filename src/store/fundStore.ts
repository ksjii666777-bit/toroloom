import { create } from 'zustand';
import { format } from 'date-fns';

// ============ Types ============

export interface FundTransaction {
  id: string;
  type: 'add' | 'withdraw';
  amount: number;
  method: string;
  account?: string;
  status: 'completed' | 'pending' | 'failed';
  transactionId: string;
  timestamp: string;
  dateLabel: string;
}

interface FundState {
  transactions: FundTransaction[];
  addTransaction: (tx: Omit<FundTransaction, 'id' | 'timestamp' | 'dateLabel'>) => void;
}

// ============ Helpers ============

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function _makeDateLabel(): string {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const _yesterday = format(new Date(now.getTime() - 86400000), 'yyyy-MM-dd');
  // Compare against stored dates to determine label
  return today;
}

function labelForDate(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return format(date, 'EEEE');
  return format(date, 'dd MMM yyyy');
}

// ============ Seed Data ============

const seedTransactions: FundTransaction[] = [
  {
    id: 'seed_1' as const,
    type: 'add' as const,
    amount: 50000,
    method: 'UPI',
    status: 'completed' as const,
    transactionId: 'TXNSEED001',
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    dateLabel: '',
  },
  {
    id: 'seed_2' as const,
    type: 'withdraw' as const,
    amount: 10000,
    method: 'HDFC Bank',
    account: 'XXXX1234',
    status: 'completed' as const,
    transactionId: 'WDRSEED001',
    timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    dateLabel: '',
  },
  {
    id: 'seed_3' as const,
    type: 'add' as const,
    amount: 25000,
    method: 'Net Banking',
    status: 'completed' as const,
    transactionId: 'TXNSEED002',
    timestamp: new Date(Date.now() - 86400000 * 10).toISOString(),
    dateLabel: '',
  },
  {
    id: 'seed_4' as const,
    type: 'add' as const,
    amount: 100000,
    method: 'UPI',
    status: 'completed' as const,
    transactionId: 'TXNSEED003',
    timestamp: new Date(Date.now() - 86400000 * 15).toISOString(),
    dateLabel: '',
  },
  {
    id: 'seed_5' as const,
    type: 'withdraw' as const,
    amount: 5000,
    method: 'ICICI Bank',
    account: 'XXXX5678',
    status: 'completed' as const,
    transactionId: 'WDRSEED002',
    timestamp: new Date(Date.now() - 86400000 * 20).toISOString(),
    dateLabel: '',
  },
].map(tx => ({ ...tx, dateLabel: labelForDate(tx.timestamp) }));

// ============ Store ============

export const useFundStore = create<FundState>((set) => ({
  transactions: seedTransactions,

  addTransaction: (tx) =>
    set((state) => {
      const timestamp = new Date().toISOString();
      const transaction: FundTransaction = {
        ...tx,
        id: generateId(),
        timestamp,
        dateLabel: labelForDate(timestamp),
      };
      return {
        transactions: [transaction, ...state.transactions],
      };
    }),
}));
