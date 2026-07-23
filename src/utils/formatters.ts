import { format, differenceInDays, formatDistanceToNow } from 'date-fns';

export const formatCurrency = (amount: number, compact: boolean = false): string => {
  if (compact) {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatChange = (change: number, percent: number): string => {
  const arrow = change >= 0 ? '▲' : '▼';
  return `${arrow} ${Math.abs(change).toFixed(2)} (${Math.abs(percent).toFixed(2)}%)`;
};

export const formatPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN').format(num);
};

export const formatDate = (dateStr: string, pattern: string = 'dd MMM yyyy'): string => {
  return format(new Date(dateStr), pattern);
};

export const formatTimeAgo = (dateStr: string): string => {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
};

export const formatTimestamp = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = differenceInDays(now, date);
  
  if (diffDays === 0) return `Today ${format(date, 'hh:mm a')}`;
  if (diffDays === 1) return `Yesterday ${format(date, 'hh:mm a')}`;
  if (diffDays < 7) return format(date, 'EEEE hh:mm a');
  return format(date, 'dd MMM yyyy');
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const formatCompactNumber = (num: number): string => {
  if (num >= 10000000) return `${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(2)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const formatRelativeTime = (dateStr: string): string => {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
};

export const formatVolume = (volume: string): string => {
  return volume;
};

export const formatMarketCap = (cap: string): string => {
  return cap;
};

/**
 * Returns a relative time string from a Date (e.g., "just now", "3m ago", "2h ago", "1d ago").
 * Use this for live-updating timestamps where you want short, mobile-friendly labels.
 */
export const timeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const getChangeColor = (isPositive: boolean): string => {
  return isPositive ? '#00C853' : '#FF1744';
};

export const getGradientForChange = (isPositive: boolean): [string, string] => {
  return isPositive ? ['#00C853', '#009624'] : ['#FF1744', '#D50000'];
};
