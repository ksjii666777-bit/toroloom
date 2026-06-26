/**
 * ============================================================================
 * Toroloom — Mock Data Service
 * ============================================================================
 *
 * Centralized mock data for funds-related screens (Withdraw, Transfer, UPI).
 *
 * Previously, each screen defined its own hardcoded data inline.
 * Now all mock data lives here, making it easy to:
 *   - Replace with real API data in the future
 *   - Keep data consistent across screens
 *   - Update data in one place
 *
 * ============================================================================
 */

// ──── Bank Account Types ───────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  isPrimary: boolean;
}

export interface UPILinkedAccount {
  upiId: string;
  bankName: string;
  accountNumber: string;
  isPrimary: boolean;
}

export interface UPIContact {
  name: string;
  upiId: string;
  avatar: string;
}

export interface InternalAccount {
  id: string;
  label: string;
  type: string;
  balance: number;
}

// ──── Bank Accounts ────────────────────────────────────────────────────────

export const LINKED_BANKS: BankAccount[] = [
  { id: '1', bankName: 'HDFC Bank', accountNumber: 'XXXX1234', ifsc: 'HDFC0001234', isPrimary: true },
  { id: '2', bankName: 'ICICI Bank', accountNumber: 'XXXX5678', ifsc: 'ICIC0005678', isPrimary: false },
];

// ──── Internal Accounts (Trading + Demat) ──────────────────────────────────

export const INTERNAL_ACCOUNTS: InternalAccount[] = [
  { id: 'trading', label: 'Trading Account', type: 'Trading', balance: 2500000 },
  { id: 'demats', label: 'Demat Account', type: 'Demat', balance: 0 },
];

// ──── UPI Accounts ─────────────────────────────────────────────────────────

export const LINKED_UPI_ACCOUNTS: UPILinkedAccount[] = [
  { upiId: 'rahul@hdfc', bankName: 'HDFC Bank', accountNumber: 'XXXX1234', isPrimary: true },
  { upiId: 'rahul.sharma@paytm', bankName: 'Paytm Payments Bank', accountNumber: 'XXXX5678', isPrimary: false },
  { upiId: 'rahul@icici', bankName: 'ICICI Bank', accountNumber: 'XXXX9012', isPrimary: false },
];

export const RECENT_UPI_CONTACTS: UPIContact[] = [
  { name: 'Priya Patel', upiId: 'priya@paytm', avatar: 'P' },
  { name: 'Amit Singh', upiId: 'amit@hdfc', avatar: 'A' },
  { name: 'Neha Gupta', upiId: 'neha@icici', avatar: 'N' },
];

// ──── Amount Presets ───────────────────────────────────────────────────────

export const WITHDRAW_PRESETS = [5000, 10000, 25000, 50000] as const;

export const TRANSFER_PRESETS = [1000, 5000, 10000, 25000] as const;

export const UPI_PRESETS = [500, 1000, 2000, 5000] as const;
