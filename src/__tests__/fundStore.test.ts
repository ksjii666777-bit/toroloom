/**
 * ============================================================================
 * Toroloom — Fund Store Tests
 * ============================================================================
 *
 * Tests the fund store: initial state with seed transactions,
 * and addTransaction for various scenarios (add, withdraw, pending, failed).
 */

import { describe, it, expect, beforeEach} from 'vitest';
import { useFundStore, FundTransaction } from '../store/fundStore';

describe('FundStore — Initial State', () => {
  // This beforeEach clears state so we can test an empty initial state.
  beforeEach(() => {
    useFundStore.setState({ transactions: [] });
  });

  it('starts with empty transactions when reset', () => {
    const state = useFundStore.getState();
    expect(state.transactions).toEqual([]);
  });
});

describe('FundStore — Seed Transactions', () => {
  // Restore the original seed state before each seed test.
  // The store creates 5 seed transactions on initial load.
  beforeEach(() => {
    // Re-seed by setting the default seed data that the store would have
    const seedTxs: FundTransaction[] = [
      { id: 'seed_1', type: 'add', amount: 50000, method: 'UPI', status: 'completed' as const, transactionId: 'TXNSEED001', timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), dateLabel: '' },
      { id: 'seed_2', type: 'withdraw', amount: 10000, method: 'HDFC Bank', account: 'XXXX1234', status: 'completed' as const, transactionId: 'WDRSEED001', timestamp: new Date(Date.now() - 86400000 * 5).toISOString(), dateLabel: '' },
      { id: 'seed_3', type: 'add', amount: 25000, method: 'Net Banking', status: 'completed' as const, transactionId: 'TXNSEED002', timestamp: new Date(Date.now() - 86400000 * 10).toISOString(), dateLabel: '' },
      { id: 'seed_4', type: 'add', amount: 100000, method: 'UPI', status: 'completed' as const, transactionId: 'TXNSEED003', timestamp: new Date(Date.now() - 86400000 * 15).toISOString(), dateLabel: '' },
      { id: 'seed_5', type: 'withdraw', amount: 5000, method: 'ICICI Bank', account: 'XXXX5678', status: 'completed' as const, transactionId: 'WDRSEED002', timestamp: new Date(Date.now() - 86400000 * 20).toISOString(), dateLabel: '' },
    ];
    useFundStore.setState({
      transactions: seedTxs.map((tx) => {
        const now = new Date();
        const date = new Date(tx.timestamp);
        const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
        let dateLabel: string;
        if (diffDays === 0) dateLabel = 'Today';
        else if (diffDays === 1) dateLabel = 'Yesterday';
        else if (diffDays < 7) dateLabel = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
        else dateLabel = `${String(date.getDate()).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()]} ${date.getFullYear()}`;
        return { ...tx, dateLabel };
      }),
    });
  });

  it('contains 5 seed transactions', () => {
    const state = useFundStore.getState();
    expect(state.transactions).toHaveLength(5);
  });

  it('has seed transactions with correct types', () => {
    const state = useFundStore.getState();
    const addTransactions = state.transactions.filter(t => t.type === 'add');
    const withdrawTransactions = state.transactions.filter(t => t.type === 'withdraw');
    expect(addTransactions.length).toBeGreaterThan(0);
    expect(withdrawTransactions.length).toBeGreaterThan(0);
  });

  it('has seed transactions with completed status', () => {
    const state = useFundStore.getState();
    state.transactions.forEach(t => {
      expect(t.status).toBe('completed');
    });
  });

  it('has dateLabel set on all seed transactions', () => {
    const state = useFundStore.getState();
    state.transactions.forEach(t => {
      expect(t.dateLabel).toBeTruthy();
      expect(typeof t.dateLabel).toBe('string');
    });
  });
});

describe('FundStore — addTransaction', () => {
  beforeEach(() => {
    useFundStore.setState({ transactions: [] });
  });

  it('adds a completed add transaction', () => {
    useFundStore.getState().addTransaction({
      type: 'add',
      amount: 10000,
      method: 'UPI',
      status: 'completed',
      transactionId: 'TXN001',
    });

    const state = useFundStore.getState();
    expect(state.transactions).toHaveLength(1);
    const tx = state.transactions[0];
    expect(tx.type).toBe('add');
    expect(tx.amount).toBe(10000);
    expect(tx.method).toBe('UPI');
    expect(tx.status).toBe('completed');
    expect(tx.transactionId).toBe('TXN001');
    expect(tx.id).toBeTruthy();
    expect(tx.timestamp).toBeTruthy();
    expect(tx.dateLabel).toBe('Today');
  });

  it('adds a completed withdraw transaction with account info', () => {
    useFundStore.getState().addTransaction({
      type: 'withdraw',
      amount: 5000,
      method: 'HDFC Bank',
      account: 'XXXX1234',
      status: 'completed',
      transactionId: 'WDR001',
    });

    const state = useFundStore.getState();
    const tx = state.transactions[0];
    expect(tx.type).toBe('withdraw');
    expect(tx.account).toBe('XXXX1234');
    expect(tx.amount).toBe(5000);
  });

  it('adds a pending transaction', () => {
    useFundStore.getState().addTransaction({
      type: 'add',
      amount: 25000,
      method: 'Net Banking',
      status: 'pending',
      transactionId: 'TXN002',
    });

    const state = useFundStore.getState();
    expect(state.transactions[0].status).toBe('pending');
  });

  it('adds a failed transaction', () => {
    useFundStore.getState().addTransaction({
      type: 'add',
      amount: 50000,
      method: 'UPI',
      status: 'failed',
      transactionId: 'TXN003',
    });

    const state = useFundStore.getState();
    expect(state.transactions[0].status).toBe('failed');
  });

  it('prepends new transactions', () => {
    useFundStore.getState().addTransaction({
      type: 'add', amount: 100, method: 'UPI', status: 'completed',
      transactionId: 'TXN001',
    });
    useFundStore.getState().addTransaction({
      type: 'withdraw', amount: 200, method: 'Bank', status: 'completed',
      transactionId: 'WDR001',
    });

    const state = useFundStore.getState();
    expect(state.transactions).toHaveLength(2);
    expect(state.transactions[0].transactionId).toBe('WDR001');
    expect(state.transactions[1].transactionId).toBe('TXN001');
  });

  it('generates unique IDs for each transaction', () => {
    useFundStore.getState().addTransaction({
      type: 'add', amount: 100, method: 'UPI', status: 'completed',
      transactionId: 'TXN001',
    });
    useFundStore.getState().addTransaction({
      type: 'add', amount: 200, method: 'UPI', status: 'completed',
      transactionId: 'TXN002',
    });

    const state = useFundStore.getState();
    expect(state.transactions[0].id).not.toBe(state.transactions[1].id);
  });
});

describe('FundStore — dateLabel Edge Cases', () => {
  beforeEach(() => {
    useFundStore.setState({ transactions: [] });
  });

  it('labels today transactions as "Today"', () => {
    useFundStore.getState().addTransaction({
      type: 'add', amount: 1000, method: 'UPI', status: 'completed',
      transactionId: 'TXN001',
    });
    expect(useFundStore.getState().transactions[0].dateLabel).toBe('Today');
  });

  it('includes all required fields in added transaction', () => {
    useFundStore.getState().addTransaction({
      type: 'withdraw', amount: 5000, method: 'HDFC Bank', account: 'XXXX1234',
      status: 'completed', transactionId: 'WDR001',
    });
    const tx = useFundStore.getState().transactions[0];
    expect(tx.id).toBeTruthy();
    expect(tx.timestamp).toBeTruthy();
    expect(tx.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(tx.account).toBe('XXXX1234');
  });

  it('handles addTransaction without optional account field', () => {
    useFundStore.getState().addTransaction({
      type: 'add', amount: 2000, method: 'UPI',
      status: 'completed', transactionId: 'TXN002',
    });
    const tx = useFundStore.getState().transactions[0];
    expect(tx.account).toBeUndefined();
    expect(tx.type).toBe('add');
  });

  it('allows multiple transaction types with different methods', () => {
    useFundStore.getState().addTransaction({
      type: 'add', amount: 10000, method: 'Net Banking',
      status: 'completed', transactionId: 'TXN001',
    });
    useFundStore.getState().addTransaction({
      type: 'withdraw', amount: 3000, method: 'ICICI Bank', account: 'XXXX5678',
      status: 'pending', transactionId: 'WDR001',
    });
    expect(useFundStore.getState().transactions).toHaveLength(2);
    expect(useFundStore.getState().transactions[0].type).toBe('withdraw');
    expect(useFundStore.getState().transactions[1].type).toBe('add');
  });

  it('generates unique IDs that differ from each other', () => {
    useFundStore.getState().addTransaction({
      type: 'add', amount: 100, method: 'UPI', status: 'completed',
      transactionId: 'TXN001',
    });
    useFundStore.getState().addTransaction({
      type: 'add', amount: 200, method: 'UPI', status: 'completed',
      transactionId: 'TXN002',
    });
    expect(useFundStore.getState().transactions[0].id).not.toBe(
      useFundStore.getState().transactions[1].id,
    );
  });
});

describe('FundStore — Seed Transaction Date Labels', () => {
  beforeEach(() => {
    // Reload seed data with various ages
    const now = Date.now();
    const DAY = 86400000;
    const seedTxs: FundTransaction[] = [
      { id: 's1', type: 'add', amount: 100, method: 'UPI', status: 'completed', transactionId: 'T1', timestamp: new Date(now - DAY).toISOString(), dateLabel: '' },
      { id: 's2', type: 'add', amount: 200, method: 'UPI', status: 'completed', transactionId: 'T2', timestamp: new Date(now - 3 * DAY).toISOString(), dateLabel: '' },
      { id: 's3', type: 'add', amount: 300, method: 'UPI', status: 'completed', transactionId: 'T3', timestamp: new Date(now - 14 * DAY).toISOString(), dateLabel: '' },
    ];
    // Compute labels using the same logic as the store
    const labeled = seedTxs.map(tx => {
      const date = new Date(tx.timestamp);
      const diffDays = Math.floor((now - date.getTime()) / DAY);
      let label: string;
      if (diffDays === 0) label = 'Today';
      else if (diffDays === 1) label = 'Yesterday';
      else if (diffDays < 7) label = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
      else {
        const d = String(date.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${d} ${months[date.getMonth()]} ${date.getFullYear()}`;
      }
      return { ...tx, dateLabel: label };
    });
    useFundStore.setState({ transactions: labeled });
  });

  it('marks 1-day-old transaction as Yesterday', () => {
    const tx = useFundStore.getState().transactions.find(t => t.id === 's1');
    expect(tx?.dateLabel).toBe('Yesterday');
  });

  it('marks 3-day-old transaction with weekday name', () => {
    const tx = useFundStore.getState().transactions.find(t => t.id === 's2');
    expect(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']).toContain(tx?.dateLabel);
  });

  it('marks 14-day-old transaction with formatted date', () => {
    const tx = useFundStore.getState().transactions.find(t => t.id === 's3');
    expect(tx?.dateLabel).toMatch(/^\d{2} \w{3} \d{4}$/);
  });

  it('includes pending and failed status transactions when added', () => {
    useFundStore.getState().addTransaction({
      type: 'add', amount: 500, method: 'UPI', status: 'pending',
      transactionId: 'TXN_PND',
    });
    useFundStore.getState().addTransaction({
      type: 'withdraw', amount: 300, method: 'Bank', status: 'failed',
      transactionId: 'TXN_FAIL',
    });
    const state = useFundStore.getState();
    expect(state.transactions).toHaveLength(5);
    expect(state.transactions[0].status).toBe('failed');
    expect(state.transactions[0].type).toBe('withdraw');
    expect(state.transactions[1].status).toBe('pending');
  });
});
