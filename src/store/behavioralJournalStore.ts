import { create } from 'zustand';
import { JournalEntry, BehaviorMetrics, WeeklyReport, EmotionalState, TradingMistake } from '../types';

// ── Mock Data ──────────────────────────────────────────────
const ALL_EMOTIONS: EmotionalState[] = ['calm', 'anxious', 'excited', 'fearful', 'frustrated', 'overconfident', 'neutral'];
const ALL_MISTAKES: TradingMistake[] = [
  'no_stop_loss', 'fomo_entry', 'revenge_trade', 'over_leveraged',
  'deviated_from_plan', 'held_too_long', 'cut_winner_early',
  'chased_price', 'averaged_down', 'impulsive_entry',
];
const MISTAKE_LABELS: Record<TradingMistake, string> = {
  no_stop_loss: 'No Stop Loss',
  fomo_entry: 'FOMO Entry',
  revenge_trade: 'Revenge Trade',
  over_leveraged: 'Over Leveraged',
  deviated_from_plan: 'Deviated from Plan',
  held_too_long: 'Held Too Long',
  cut_winner_early: 'Cut Winner Early',
  chased_price: 'Chased Price',
  averaged_down: 'Averaged Down',
  impulsive_entry: 'Impulsive Entry',
};

function h(hours: number): number { return hours * 3600000; }

const now = Date.now();

export const mockJournalEntries: JournalEntry[] = [
  {
    id: 'je_1', date: new Date(now - h(2)).toISOString(), symbol: 'RELIANCE', direction: 'long',
    entryPrice: 2840, exitPrice: 2890, quantity: 50, pnl: 2500, pnlPercent: 1.76,
    holdingPeriod: '4h', emotionalState: 'calm', mistakes: [], planCompliance: 100,
    notes: 'Clean breakout trade on volume. Entered at resistance breakout, exited near target.',
    setupType: 'breakout', exitReason: 'target', tags: ['RELIANCE', 'breakout'],
  },
  {
    id: 'je_2', date: new Date(now - h(5)).toISOString(), symbol: 'TCS', direction: 'long',
    entryPrice: 3910, exitPrice: 3880, quantity: 20, pnl: -600, pnlPercent: -0.77,
    holdingPeriod: '2h', emotionalState: 'frustrated', mistakes: ['no_stop_loss', 'held_too_long'],
    planCompliance: 60, notes: 'Did not set stop loss. Watched it fall hoping for recovery. Should have cut early.',
    setupType: 'pullback', exitReason: 'manual', tags: ['TCS', 'mistake'],
  },
  {
    id: 'je_3', date: new Date(now - h(8)).toISOString(), symbol: 'HDFCBANK', direction: 'long',
    entryPrice: 1670, exitPrice: 1685, quantity: 30, pnl: 450, pnlPercent: 0.90,
    holdingPeriod: '6h', emotionalState: 'calm', mistakes: [], planCompliance: 100,
    notes: 'Steady move up. Followed the plan perfectly.',
    setupType: 'trend_follow', exitReason: 'target', tags: ['HDFCBANK'],
  },
  {
    id: 'je_4', date: new Date(now - h(12)).toISOString(), symbol: 'SBIN', direction: 'long',
    entryPrice: 775, exitPrice: 790, quantity: 100, pnl: 1500, pnlPercent: 1.94,
    holdingPeriod: '1d', emotionalState: 'excited', mistakes: ['cut_winner_early'],
    planCompliance: 80, notes: 'Good trade but exited too early. Could have ridden the trend longer.',
    setupType: 'breakout', exitReason: 'manual', tags: ['SBIN', 'profit'],
  },
  {
    id: 'je_5', date: new Date(now - h(24)).toISOString(), symbol: 'INFY', direction: 'short',
    entryPrice: 1580, exitPrice: 1605, quantity: 40, pnl: -1000, pnlPercent: -1.58,
    holdingPeriod: '3h', emotionalState: 'anxious', mistakes: ['fomo_entry', 'over_leveraged', 'impulsive_entry'],
    planCompliance: 30, notes: 'Felt pressure to recover losses. Entered a short without proper setup. Got stopped out quickly. Classic revenge trade pattern.',
    setupType: 'breakdown', exitReason: 'stop_loss', tags: ['INFY', 'revenge', 'mistake'],
  },
  {
    id: 'je_6', date: new Date(now - h(30)).toISOString(), symbol: 'BHARTIARTL', direction: 'long',
    entryPrice: 1330, exitPrice: 1345, quantity: 60, pnl: 900, pnlPercent: 1.13,
    holdingPeriod: '1d', emotionalState: 'neutral', mistakes: [], planCompliance: 90,
    notes: 'Solid trade. Position sizing was right. Will take more setups like this.',
    setupType: 'trend_follow', exitReason: 'target', tags: ['BHARTIARTL'],
  },
  {
    id: 'je_7', date: new Date(now - h(48)).toISOString(), symbol: 'RELIANCE', direction: 'long',
    entryPrice: 2860, exitPrice: 2830, quantity: 30, pnl: -900, pnlPercent: -1.05,
    holdingPeriod: '5h', emotionalState: 'fearful', mistakes: ['averaged_down', 'deviated_from_plan'],
    planCompliance: 20, notes: 'Panic averaged down when price dropped against me. Doubled position without analysis. Emotional trading at its worst.',
    setupType: 'pullback', exitReason: 'stop_loss', tags: ['RELIANCE', 'mistake'],
  },
  {
    id: 'je_8', date: new Date(now - h(72)).toISOString(), symbol: 'ITC', direction: 'long',
    entryPrice: 475, exitPrice: 480, quantity: 80, pnl: 400, pnlPercent: 1.05,
    holdingPeriod: '2d', emotionalState: 'calm', mistakes: [], planCompliance: 100,
    notes: 'Slow and steady. Patience paid off.',
    setupType: 'swing', exitReason: 'target', tags: ['ITC'],
  },
  {
    id: 'je_9', date: new Date(now - h(96)).toISOString(), symbol: 'WIPRO', direction: 'short',
    entryPrice: 460, exitPrice: 445, quantity: 50, pnl: 750, pnlPercent: 1.63,
    holdingPeriod: '1d', emotionalState: 'calm', mistakes: [], planCompliance: 95,
    notes: 'Clean trade. Waited for the right entry and managed risk well.',
    setupType: 'breakdown', exitReason: 'target', tags: ['WIPRO'],
  },
  {
    id: 'je_10', date: new Date(now - h(120)).toISOString(), symbol: 'BAJFINANCE', direction: 'long',
    entryPrice: 6800, exitPrice: 6750, quantity: 10, pnl: -500, pnlPercent: -0.74,
    holdingPeriod: '3h', emotionalState: 'overconfident', mistakes: ['over_leveraged', 'chased_price'],
    planCompliance: 40, notes: 'Got overconfident after winning streak. Entered a large position without waiting for confirmation. Chased the price up.',
    setupType: 'breakout', exitReason: 'stop_loss', tags: ['BAJFINANCE', 'mistake'],
  },
];

// ── Computations ───────────────────────────────────────────
function computeMetrics(entries: JournalEntry[]): BehaviorMetrics {
  const trades = entries.length;
  const wins = entries.filter(e => e.pnl > 0);
  const losses = entries.filter(e => e.pnl < 0);
  const totalPnl = entries.reduce((s, e) => s + e.pnl, 0);

  const mistakeFreq = {} as Record<TradingMistake, number>;
  for (const m of ALL_MISTAKES) mistakeFreq[m] = 0;
  for (const e of entries) for (const m of e.mistakes) mistakeFreq[m] = (mistakeFreq[m] || 0) + 1;

  const emotionBreakdown = {} as Record<EmotionalState, number>;
  for (const em of ALL_EMOTIONS) emotionBreakdown[em] = 0;
  for (const e of entries) emotionBreakdown[e.emotionalState] = (emotionBreakdown[e.emotionalState] || 0) + 1;

  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let winStreak = 0, loseStreak = 0, maxWinStreak = 0, maxLoseStreak = 0, peak = 0, drawdown = 0;
  for (const e of sorted) {
    if (e.pnl > 0) { winStreak++; loseStreak = 0; maxWinStreak = Math.max(maxWinStreak, winStreak); }
    else { loseStreak++; winStreak = 0; maxLoseStreak = Math.max(maxLoseStreak, loseStreak); }
    peak = Math.max(peak, totalPnl);
    drawdown = Math.max(drawdown, peak - totalPnl);
  }

  return {
    totalTrades: trades,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: trades > 0 ? (wins.length / trades) * 100 : 0,
    avgPnl: trades > 0 ? totalPnl / trades : 0,
    avgWin: wins.length > 0 ? wins.reduce((s, e) => s + e.pnl, 0) / wins.length : 0,
    avgLoss: losses.length > 0 ? Math.abs(losses.reduce((s, e) => s + e.pnl, 0)) / losses.length : 0,
    profitFactor: losses.length > 0
      ? Math.abs(wins.reduce((s, e) => s + e.pnl, 0) / losses.reduce((s, e) => s + e.pnl, 0))
      : wins.length > 0 ? Infinity : 0,
    maxConsecutiveWins: maxWinStreak,
    maxConsecutiveLosses: maxLoseStreak,
    maxDrawdown: drawdown,
    planComplianceRate: trades > 0 ? entries.reduce((s, e) => s + e.planCompliance, 0) / trades : 0,
    mistakeFrequency: mistakeFreq,
    emotionalBreakdown: emotionBreakdown,
    bestDay: wins.length > 0 ? wins.reduce((best, e) => e.pnl > (best?.pnl || 0) ? e : best, wins[0]).date : null,
    worstDay: losses.length > 0 ? losses.reduce((worst, e) => e.pnl < (worst?.pnl || 0) ? e : worst, losses[0]).date : null,
  };
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function generateWeeklyReports(entries: JournalEntry[]): WeeklyReport[] {
  const weeks = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const ws = getWeekStart(new Date(e.date));
    if (!weeks.has(ws)) weeks.set(ws, []);
    weeks.get(ws)!.push(e);
  }

  const reports: WeeklyReport[] = [];
  for (const [ws, weekEntries] of weeks) {
    const metrics = computeMetrics(weekEntries);
    const topMistakeEntry = Object.entries(metrics.mistakeFrequency)
      .sort(([, a], [, b]) => b - a)[0];
    const topEmotion = Object.entries(metrics.emotionalBreakdown)
      .sort(([, a], [, b]) => b - a)[0];

    let improvementTip = 'Great week! Keep following your plan consistently.';
    if (metrics.planComplianceRate < 70) {
      improvementTip = 'Focus on plan compliance this week. Write your plan before each trade.';
    } else if (metrics.profitFactor < 1.5 && metrics.totalTrades > 5) {
      improvementTip = 'Your risk-reward ratio needs work. Aim for at least 1:2 risk-reward on every trade.';
    } else if (metrics.maxConsecutiveLosses > 3) {
      improvementTip = 'After 3 consecutive losses, take a break. Step away and reset your mental state.';
    }

    reports.push({
      weekStart: ws,
      weekEnd: getWeekEnd(ws),
      metrics,
      topMistake: topMistakeEntry ? MISTAKE_LABELS[topMistakeEntry[0] as TradingMistake] : 'None',
      dominantEmotion: topEmotion ? topEmotion[0] : 'neutral',
      improvementTip,
      journalEntries: weekEntries.map(e => e.id),
    });
  }

  return reports.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
}

// ── Store ──────────────────────────────────────────────────
interface BehaviorJournalState {
  entries: JournalEntry[];
  reports: WeeklyReport[];
  allMetrics: BehaviorMetrics;
  showEntryModal: boolean;
  editingEntry: JournalEntry | null;

  addEntry: (entry: Omit<JournalEntry, 'id'>) => void;
  deleteEntry: (id: string) => void;
  getReports: () => WeeklyReport[];
  recompute: () => void;
  setShowEntryModal: (show: boolean) => void;
  setEditingEntry: (entry: JournalEntry | null) => void;
  getFilteredEntries: (period: 'all' | 'week' | 'month') => JournalEntry[];
}

export const useBehaviorJournalStore = create<BehaviorJournalState>((set, get) => {
  const initialMetrics = computeMetrics(mockJournalEntries);
  const initialReports = generateWeeklyReports(mockJournalEntries);

  return {
    entries: mockJournalEntries,
    reports: initialReports,
    allMetrics: initialMetrics,
    showEntryModal: false,
    editingEntry: null,

    addEntry: (entryData) => {
      const newEntry: JournalEntry = {
        ...entryData,
        id: `je_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      };
      set((state) => {
        const updated = [newEntry, ...state.entries];
        return {
          entries: updated,
          allMetrics: computeMetrics(updated),
          reports: generateWeeklyReports(updated),
        };
      });
    },

    deleteEntry: (id) => {
      set((state) => {
        const updated = state.entries.filter(e => e.id !== id);
        return {
          entries: updated,
          allMetrics: computeMetrics(updated),
          reports: generateWeeklyReports(updated),
        };
      });
    },

    getReports: () => get().reports,

    recompute: () => {
      set((state) => ({
        allMetrics: computeMetrics(state.entries),
        reports: generateWeeklyReports(state.entries),
      }));
    },

    setShowEntryModal: (show) => set({ showEntryModal: show }),
    setEditingEntry: (entry) => set({ editingEntry: entry }),

    getFilteredEntries: (period) => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      return get().entries.filter(e => {
        const d = new Date(e.date);
        if (period === 'week') return d >= startOfWeek;
        if (period === 'month') return d >= startOfMonth;
        return true;
      });
    },
  };
});

export { MISTAKE_LABELS, ALL_EMOTIONS, ALL_MISTAKES };
