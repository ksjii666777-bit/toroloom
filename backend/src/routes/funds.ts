import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { mockUser } from '../data/mockData';

// ============ Types ============

interface FundTransaction {
  id: string;
  type: 'add' | 'withdraw' | 'transfer' | 'upi';
  amount: number;
  method: string;
  account?: string;
  status: 'completed' | 'pending' | 'failed';
  transactionId: string;
  timestamp: string;
}

interface UserFundData {
  balance: number;
  transactions: FundTransaction[];
}

// ============ In-Memory Storage ============

const fundStore: Record<string, UserFundData> = {
  user_1: {
    balance: mockUser.balance,
    transactions: [
      {
        id: 'seed_1',
        type: 'add',
        amount: 50000,
        method: 'UPI',
        status: 'completed',
        transactionId: 'TXNSEED001',
        timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
      {
        id: 'seed_2',
        type: 'withdraw',
        amount: 10000,
        method: 'HDFC Bank',
        account: 'XXXX1234',
        status: 'completed',
        transactionId: 'WDRSEED001',
        timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'seed_3',
        type: 'add',
        amount: 25000,
        method: 'Net Banking',
        status: 'completed',
        transactionId: 'TXNSEED002',
        timestamp: new Date(Date.now() - 86400000 * 10).toISOString(),
      },
      {
        id: 'seed_4',
        type: 'add',
        amount: 100000,
        method: 'UPI',
        status: 'completed',
        transactionId: 'TXNSEED003',
        timestamp: new Date(Date.now() - 86400000 * 15).toISOString(),
      },
      {
        id: 'seed_5',
        type: 'withdraw',
        amount: 5000,
        method: 'ICICI Bank',
        account: 'XXXX5678',
        status: 'completed',
        transactionId: 'WDRSEED002',
        timestamp: new Date(Date.now() - 86400000 * 20).toISOString(),
      },
    ],
  },
};

// ============ Helpers ============

function getFundData(userId: string): UserFundData {
  if (!fundStore[userId]) {
    fundStore[userId] = { balance: 0, transactions: [] };
  }
  return fundStore[userId];
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function generateTransactionId(type: 'add' | 'withdraw' | 'transfer' | 'upi'): string {
  const prefixMap: Record<string, string> = {
    add: 'TXN',
    withdraw: 'WDR',
    transfer: 'TRF',
    upi: 'UPI',
  };
  const prefix = prefixMap[type] || 'TXN';
  return prefix + Date.now().toString(36).toUpperCase();
}

// ============ Router ============

const router = Router();
router.use(authMiddleware);

// GET /api/funds/balance
router.get('/balance', (req: Request, res: Response) => {
  const data = getFundData(req.user!.userId);
  res.json({
    balance: data.balance,
    userId: req.user!.userId,
  });
});

// GET /api/funds/transactions
router.get('/transactions', (req: Request, res: Response) => {
  const data = getFundData(req.user!.userId);
  const { type, limit } = req.query;

  let filtered = data.transactions;

  if (type === 'add' || type === 'withdraw') {
    filtered = filtered.filter(tx => tx.type === type);
  }

  if (limit) {
    const parsedLimit = parseInt(limit as string, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      filtered = filtered.slice(0, parsedLimit);
    }
  }

  res.json({
    transactions: filtered,
    total: filtered.length,
  });
});

// POST /api/funds/add
router.post('/add', (req: Request, res: Response) => {
  const { amount, method } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ error: 'A valid positive amount is required' });
    return;
  }

  if (amount < 500) {
    res.status(400).json({ error: 'Minimum add amount is ₹500' });
    return;
  }

  if (amount > 500000) {
    res.status(400).json({ error: 'Maximum add amount is ₹5,00,000 per transaction' });
    return;
  }

  if (!method || typeof method !== 'string') {
    res.status(400).json({ error: 'Payment method is required' });
    return;
  }

  const data = getFundData(req.user!.userId);
  const transactionId = generateTransactionId('add');

  const transaction: FundTransaction = {
    id: generateId(),
    type: 'add',
    amount,
    method,
    status: 'completed',
    transactionId,
    timestamp: new Date().toISOString(),
  };

  data.balance += amount;
  data.transactions.unshift(transaction);

  res.status(201).json({
    message: 'Funds added successfully',
    transaction,
    newBalance: data.balance,
  });
});

// POST /api/funds/withdraw
router.post('/withdraw', (req: Request, res: Response) => {
  const { amount, method, account } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ error: 'A valid positive amount is required' });
    return;
  }

  if (amount < 500) {
    res.status(400).json({ error: 'Minimum withdrawal amount is ₹500' });
    return;
  }

  if (!method || typeof method !== 'string') {
    res.status(400).json({ error: 'Bank account method is required' });
    return;
  }

  const data = getFundData(req.user!.userId);

  if (amount > data.balance) {
    res.status(400).json({ error: 'Insufficient balance for withdrawal' });
    return;
  }

  const transactionId = generateTransactionId('withdraw');

  const transaction: FundTransaction = {
    id: generateId(),
    type: 'withdraw',
    amount,
    method,
    account: account || undefined,
    status: 'completed',
    transactionId,
    timestamp: new Date().toISOString(),
  };

  data.balance -= amount;
  data.transactions.unshift(transaction);

  res.status(201).json({
    message: 'Withdrawal processed successfully',
    transaction,
    newBalance: data.balance,
  });
});

// POST /api/funds/transfer
router.post('/transfer', (req: Request, res: Response) => {
  const { amount, type: transferType, fromAccount, toAccount, bankId, bankName, accountNumber } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ error: 'A valid positive amount is required' });
    return;
  }

  if (amount < 100) {
    res.status(400).json({ error: 'Minimum transfer amount is ₹100' });
    return;
  }

  const isInternal = transferType === 'internal';

  if (isInternal) {
    if (!fromAccount || !toAccount) {
      res.status(400).json({ error: 'Source and destination accounts are required' });
      return;
    }
    if (fromAccount === toAccount) {
      res.status(400).json({ error: 'Source and destination accounts must be different' });
      return;
    }
  } else {
    if (!bankName) {
      res.status(400).json({ error: 'Bank account details are required for external transfers' });
      return;
    }
  }

  const data = getFundData(req.user!.userId);

  if (amount > data.balance) {
    res.status(400).json({ error: 'Insufficient balance for transfer' });
    return;
  }

  const transactionId = generateTransactionId('transfer');
  const method = isInternal ? `Internal Transfer (${fromAccount} → ${toAccount})` : bankName;

  const transaction: FundTransaction = {
    id: generateId(),
    type: 'transfer',
    amount,
    method,
    account: isInternal ? toAccount : (accountNumber || undefined),
    status: 'completed',
    transactionId,
    timestamp: new Date().toISOString(),
  };

  data.balance -= amount;
  data.transactions.unshift(transaction);

  res.status(201).json({
    message: 'Transfer processed successfully',
    transaction,
    newBalance: data.balance,
  });
});

// POST /api/funds/upi/pay
router.post('/upi/pay', (req: Request, res: Response) => {
  const { amount, payeeUPI, fromUPI } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ error: 'A valid positive amount is required' });
    return;
  }

  if (amount < 1) {
    res.status(400).json({ error: 'Minimum UPI payment amount is ₹1' });
    return;
  }

  if (amount > 100000) {
    res.status(400).json({ error: 'Maximum UPI transaction limit is ₹1,00,000 per transaction' });
    return;
  }

  if (!payeeUPI || typeof payeeUPI !== 'string' || !payeeUPI.includes('@')) {
    res.status(400).json({ error: 'A valid payee UPI ID is required (e.g., name@bank)' });
    return;
  }

  if (!fromUPI || typeof fromUPI !== 'string') {
    res.status(400).json({ error: 'Source UPI ID is required' });
    return;
  }

  const data = getFundData(req.user!.userId);

  if (amount > data.balance) {
    res.status(400).json({ error: 'Insufficient balance for this payment' });
    return;
  }

  const transactionId = generateTransactionId('upi');

  const transaction: FundTransaction = {
    id: generateId(),
    type: 'upi',
    amount,
    method: `UPI (${fromUPI})`,
    account: payeeUPI,
    status: 'completed',
    transactionId,
    timestamp: new Date().toISOString(),
  };

  data.balance -= amount;
  data.transactions.unshift(transaction);

  res.status(201).json({
    message: 'UPI payment successful',
    transaction,
    newBalance: data.balance,
  });
});

export default router;
