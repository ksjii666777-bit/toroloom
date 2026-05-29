/**
 * ============================================================================
 * Toroloom Risk Engine — "Financial Bodyguard"
 * ============================================================================
 *
 * This is the single most critical system in Toroloom. It enforces:
 *
 * 1. **Hard Risk Lockdown Protocol**: When MTM loss breaches the daily loss
 *    limit, the system instantly freezes the UI and blocks all non-exit actions.
 *
 * 2. **The Exit Exception**: During lockdown, ONLY SQUARE_OFF/liquidation
 *    actions are permitted. Buy, Add, and Modify are systematically rejected.
 *
 * 3. **Setting Isolation (Time-Lock)**: Once a lockdown is triggered, risk
 *    configurations enter a read-only frozen state for exactly 24 hours.
 *
 * 4. **Atomic State Machine**: All state transitions are guarded by a
 *    ReadWrite lock pattern, ensuring thread-safe concurrent access.
 *
 * 5. **Pluggable Persistence**: If configured with a StorageEngine, risk
 *    profiles are persisted to the database after every mutation. On first
 *    access after restart, the profile is loaded from storage.
 *
 * Architecture:
 *   Route Layer  ──>  RiskEngine.evaluate()  ──>  [ALLOWED | BLOCKED]
 *       │                                              │
 *       │                                        OrderExecutionPipeline
 *       │                                              │
 *       └───────────────────────────────────────── Broker
 */

import type { StorageEngine } from '../storage/types';
import {
  RiskProfile,
  RiskLimits,
  LockdownState,
  LockdownStatus,
  DailyMTM,
  RiskEvaluation,
  RiskDecision,
  OrderRiskContext,
  OrderActionType,
  DEFAULT_RISK_LIMITS,
} from './types';

const LOCKDOWN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ==================== ReadWrite Lock ====================

class ReadWriteLock {
  private readers = 0;
  private writer = false;
  private readerQueue: Array<() => void> = [];
  private writerQueue: Array<() => void> = [];

  async acquireRead(): Promise<void> {
    if (!this.writer && this.writerQueue.length === 0) {
      this.readers++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.readerQueue.push(resolve);
    });
  }

  releaseRead(): void {
    this.readers--;
    if (this.readers === 0 && this.writerQueue.length > 0) {
      const next = this.writerQueue.shift()!;
      this.writer = true;
      next();
    }
  }

  async acquireWrite(): Promise<void> {
    if (!this.writer && this.readers === 0) {
      this.writer = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this.writerQueue.push(resolve);
    });
  }

  releaseWrite(): void {
    this.writer = false;
    if (this.writerQueue.length > 0) {
      const next = this.writerQueue.shift()!;
      this.writer = true;
      next();
    } else {
      while (this.readerQueue.length > 0) {
        const next = this.readerQueue.shift()!;
        this.readers++;
        next();
      }
    }
  }
}

// ==================== Risk Engine ====================

export class RiskEngine {
  /**
   * In-memory risk profile cache. This is the fast path for reads.
   * The StorageEngine (if configured) is the source of truth for persistence.
   */
  private profiles = new Map<string, RiskProfile>();

  /**
   * Per-user ReadWrite locks for atomic state transitions.
   */
  private userLocks = new Map<string, ReadWriteLock>();

  /**
   * Optional StorageEngine for persisting profiles across restarts.
   * Set via configureStorage() during server startup.
   */
  private storage: StorageEngine | null = null;

  /**
   * Tracks the most recent persist promise per user so tests can
   * await completion before asserting against the database.
   */
  private pendingPersists = new Map<string, Promise<void>>();

  /**
   * Configure the engine with a StorageEngine for profile persistence.
   * Call once during server startup.
   */
  configureStorage(storage: StorageEngine): void {
    this.storage = storage;
  }

  /**
   * Pre-load a user's risk profile from storage into the in-memory cache.
   * Call during session initialization or login.
   * If no persisted profile exists, creates and saves a default one.
   */
  async loadProfileFromStorage(userId: string): Promise<RiskProfile> {
    if (!this.storage) {
      return this.getProfile(userId);
    }

    const persisted = await this.storage.loadRiskProfile(userId);
    if (persisted) {
      const reconciled = this.reconcileLockdownState(persisted);
      this.profiles.set(userId, reconciled);
      return reconciled;
    }

    // No persisted profile — create default and save it
    const profile = this.createDefaultProfile(userId);
    this.profiles.set(userId, profile);
    await this.storage.saveRiskProfile(profile);
    return profile;
  }

  /**
   * Persist the current in-memory profile for a user to storage.
   * This is called after every state mutation when storage is configured.
   */
  /**
   * Persist the current in-memory profile for a user to storage.
   * Errors are logged but not thrown — the in-memory state is always
   * authoritative. The async callers (recordTradeAsync) explicitly await
   * this to guarantee durability; sync callers fire-and-forget.
   */
  private async persistProfile(userId: string): Promise<void> {
    if (!this.storage) return;
    try {
      const profile = this.profiles.get(userId);
      if (profile) {
        const promise = this.storage.saveRiskProfile(profile).then(
          () => { this.pendingPersists.delete(userId); },
          () => { this.pendingPersists.delete(userId); },
        );
        this.pendingPersists.set(userId, promise);
        await promise;
      }
    } catch (error) {
      console.error(`[RiskEngine] Failed to persist profile for ${userId}:`, error);
    }
  }

  /**
   * Wait for all pending persist operations to complete.
   * Used by integration tests to ensure DB state is consistent before
   * asserting against the database.
   */
  async drain(userId?: string): Promise<void> {
    if (userId) {
      const promise = this.pendingPersists.get(userId);
      if (promise) await promise;
    } else {
      const promises = Array.from(this.pendingPersists.values());
      if (promises.length > 0) await Promise.all(promises);
    }
  }

  private getLock(userId: string): ReadWriteLock {
    let lock = this.userLocks.get(userId);
    if (!lock) {
      lock = new ReadWriteLock();
      this.userLocks.set(userId, lock);
    }
    return lock;
  }

  /**
   * Get or create a risk profile for a user.
   * If storage is configured but the profile isn't cached, it's loaded
   * from storage on first access. This method is kept synchronous to
   * preserve backward compatibility — call loadProfileFromStorage()
   * during initialization instead.
   */
  getProfile(userId: string): RiskProfile {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = this.createDefaultProfile(userId);
      this.profiles.set(userId, profile);
    }
    return this.reconcileLockdownState(profile);
  }

  private createDefaultProfile(userId: string): RiskProfile {
    return {
      userId,
      limits: { ...DEFAULT_RISK_LIMITS },
      lockdown: {
        status: LockdownStatus.NONE,
        triggeredAt: null,
        liftsAt: null,
        triggerLoss: null,
        breachedLimit: null,
      },
      today: {
        date: new Date().toISOString().split('T')[0],
        realizedPnL: 0,
        unrealizedPnL: 0,
        peakValue: 0,
        totalCharges: 0,
        tradeCount: 0,
      },
      portfolioValueAtOpen: 0,
      settingsFrozen: false,
      settingsFrozenUntil: null,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Core evaluation method — the heart of the Financial Bodyguard.
   *
   * Every order attempt flows through here BEFORE reaching the broker.
   * Returns a RiskEvaluation that the route layer MUST respect.
   *
   * Uses read-lock: multiple concurrent evaluations are allowed,
   * but will wait if a write operation (recordTradeAsync) is in progress.
   */
  async evaluateAsync(
    userId: string,
    context: OrderRiskContext,
  ): Promise<RiskEvaluation> {
    const lock = this.getLock(userId);
    await lock.acquireRead();
    try {
      return this.evaluate(userId, context);
    } finally {
      lock.releaseRead();
    }
  }

  /**
   * Synchronous evaluate (for backward compatibility).
   */
  evaluate(
    userId: string,
    context: OrderRiskContext,
  ): RiskEvaluation {
    const profile = this.getProfile(userId);

    this.rotateDailyIfNeeded(profile);

    if (this.isExitAction(context)) {
      return {
        allowed: true,
        decision: RiskDecision.EXIT_ALLOWED,
        message: 'Exit action approved — protecting your capital.',
        currentState: this.snapshotState(profile),
      };
    }

    if (
      profile.lockdown.status === LockdownStatus.ACTIVE ||
      profile.lockdown.status === LockdownStatus.COOLDOWN
    ) {
      if (this.isLockdownExpired(profile)) {
        this.releaseLockdown(profile);
        this.persistProfile(profile.userId); // fire-and-forget
      } else {
        return {
          allowed: false,
          decision: RiskDecision.BLOCKED_LOCKDOWN,
          message: `🔒 System Lockdown Active. Only exit/square-off orders are permitted. ` +
                   `Lockdown lifts at ${new Date(profile.lockdown.liftsAt!).toLocaleTimeString()}.`,
          currentState: this.snapshotState(profile),
        };
      }
    }

    const currentLoss = profile.today.realizedPnL + profile.today.unrealizedPnL;
    const absLoss = Math.abs(currentLoss);

    if (absLoss >= profile.limits.dailyLossLimit && currentLoss < 0) {
      this.triggerLockdown(profile, absLoss, 'daily_loss');
      this.persistProfile(profile.userId);
      return {
        allowed: false,
        decision: RiskDecision.BLOCKED_LOSS_LIMIT,
        message: `🔒 Daily loss limit of ₹${profile.limits.dailyLossLimit.toLocaleString()} reached. ` +
                 `System locked. Only exit orders allowed for 24 hours.`,
        currentState: this.snapshotState(profile),
      };
    }

    if (profile.portfolioValueAtOpen > 0) {
      const lossPercent = (absLoss / profile.portfolioValueAtOpen) * 100;
      if (lossPercent >= profile.limits.dailyLossPercentLimit && currentLoss < 0) {
        this.triggerLockdown(profile, absLoss, 'daily_loss_percent');
        this.persistProfile(profile.userId);
        return {
          allowed: false,
          decision: RiskDecision.BLOCKED_LOSS_LIMIT,
          message: `🔒 Daily loss limit of ${profile.limits.dailyLossPercentLimit}% reached. ` +
                   `System locked. Only exit orders allowed for 24 hours.`,
          currentState: this.snapshotState(profile),
        };
      }
    }

    if (
      context.actionType === OrderActionType.BUY &&
      context.price &&
      context.quantity
    ) {
      const orderValue = context.price * context.quantity;
      const maxPosValue =
        profile.portfolioValueAtOpen *
        (profile.limits.maxPositionSizePercent / 100);

      if (orderValue > maxPosValue) {
        return {
          allowed: false,
          decision: RiskDecision.BLOCKED_POSITION_SIZE,
          message: `Order value of ₹${orderValue.toLocaleString()} exceeds max position size of ` +
                   `₹${maxPosValue.toLocaleString()} (${profile.limits.maxPositionSizePercent}% of portfolio).`,
          currentState: this.snapshotState(profile),
        };
      }
    }

    return {
      allowed: true,
      decision: RiskDecision.ALLOWED,
      message: 'Risk check passed. Proceeding with order.',
      currentState: this.snapshotState(profile),
    };
  }

  /**
   * Update MTM after a trade is executed.
   * Synchronous version for backward compatibility.
   * In production with storage configured, prefer recordTradeAsync().
   */
  recordTrade(
    userId: string,
    pnlImpact: number,
    charges: number,
    isRealized: boolean,
  ): void {
    const profile = this.getProfile(userId);
    this.rotateDailyIfNeeded(profile);

    if (isRealized) {
      profile.today.realizedPnL += pnlImpact;
    } else {
      profile.today.unrealizedPnL += pnlImpact;
    }

    profile.today.totalCharges += charges;
    profile.today.tradeCount += 1;

    const currentValue = profile.portfolioValueAtOpen +
      profile.today.realizedPnL +
      profile.today.unrealizedPnL;
    profile.today.peakValue = Math.max(profile.today.peakValue, currentValue);

    const currentLoss = profile.today.realizedPnL + profile.today.unrealizedPnL;
    const absLoss = Math.abs(currentLoss);
    if (
      absLoss >= profile.limits.dailyLossLimit && currentLoss < 0 &&
      profile.lockdown.status === LockdownStatus.NONE
    ) {
      this.triggerLockdown(profile, absLoss, 'daily_loss');
    }

    profile.updatedAt = new Date().toISOString();
    this.persistProfile(userId);
  }

  /**
   * Atomic version of recordTrade with WriteLock protection.
   * This is the thread-safe version used by OrderExecutionPipeline.
   * Persists to storage after the trade is recorded.
   */
  async recordTradeAsync(
    userId: string,
    pnlImpact: number,
    charges: number,
    isRealized: boolean,
  ): Promise<void> {
    const lock = this.getLock(userId);
    await lock.acquireWrite();
    try {
      this.recordTrade(userId, pnlImpact, charges, isRealized);
      // recordTrade already calls persistProfile fire-and-forget,
      // but we await here to guarantee durability for async callers
      await this.persistProfile(userId);
    } finally {
      lock.releaseWrite();
    }
  }

  /**
   * Update the daily unrealized P&L (from real-time WebSocket ticks).
   */
  updateUnrealizedPnL(userId: string, unrealizedPnL: number): void {
    const profile = this.getProfile(userId);
    this.rotateDailyIfNeeded(profile);

    profile.today.unrealizedPnL = unrealizedPnL;

    const currentLoss = profile.today.realizedPnL + profile.today.unrealizedPnL;
    const absLoss = Math.abs(currentLoss);

    if (currentLoss < 0 && absLoss >= profile.limits.dailyLossLimit) {
      if (profile.lockdown.status === LockdownStatus.NONE) {
        this.triggerLockdown(profile, absLoss, 'daily_loss');
      }
    } else {
      if (profile.lockdown.status !== LockdownStatus.NONE) {
        this.releaseLockdown(profile);
      }
    }

    profile.updatedAt = new Date().toISOString();
    this.persistProfile(userId);
  }

  /**
   * Update the portfolio opening value (called at market start).
   */
  setPortfolioValue(userId: string, value: number): void {
    const profile = this.getProfile(userId);
    this.rotateDailyIfNeeded(profile);
    profile.portfolioValueAtOpen = value;
    profile.updatedAt = new Date().toISOString();
    this.persistProfile(userId);
  }

  /**
   * Update risk limits. Blocked if settings are frozen (lockdown + 24h).
   */
  updateLimits(userId: string, newLimits: Partial<RiskLimits>): {
    success: boolean;
    message: string;
  } {
    const profile = this.getProfile(userId);
    this.rotateDailyIfNeeded(profile);

    if (profile.settingsFrozen) {
      return {
        success: false,
        message: `⚠️ Risk settings are frozen until ${new Date(profile.settingsFrozenUntil!).toLocaleString()}. ` +
                 `This is a 24-hour protective lock triggered by the Financial Bodyguard.`,
      };
    }

    Object.assign(profile.limits, newLimits);
    profile.updatedAt = new Date().toISOString();
    this.persistProfile(userId);

    return {
      success: true,
      message: 'Risk limits updated successfully.',
    };
  }

  /**
   * Reset today's MTM (called when a new trading day starts).
   */
  resetDaily(userId: string): void {
    const profile = this.getProfile(userId);
    profile.today = {
      date: new Date().toISOString().split('T')[0],
      realizedPnL: 0,
      unrealizedPnL: 0,
      peakValue: 0,
      totalCharges: 0,
      tradeCount: 0,
    };
    profile.portfolioValueAtOpen = 0;
    profile.updatedAt = new Date().toISOString();
    this.persistProfile(userId);
  }

  /**
   * Full state snapshot for API responses.
   */
  getState(userId: string): RiskProfile {
    return this.reconcileLockdownState(this.getProfile(userId));
  }

  // ──────────────────── Private Helpers ────────────────────

  private isExitAction(context: OrderRiskContext): boolean {
    if (
      context.actionType === OrderActionType.SQUARE_OFF ||
      context.actionType === OrderActionType.CANCEL
    ) {
      return true;
    }
    if (
      context.actionType === OrderActionType.SELL &&
      context.currentPosition !== undefined &&
      context.currentPosition.quantity > 0
    ) {
      return true;
    }
    return false;
  }

  private triggerLockdown(
    profile: RiskProfile,
    loss: number,
    breachedLimit: 'daily_loss' | 'daily_loss_percent',
  ): void {
    const now = new Date();
    const liftsAt = new Date(now.getTime() + LOCKDOWN_DURATION_MS);

    profile.lockdown = {
      status: LockdownStatus.ACTIVE,
      triggeredAt: now.toISOString(),
      liftsAt: liftsAt.toISOString(),
      triggerLoss: loss,
      breachedLimit,
    };

    profile.settingsFrozen = true;
    profile.settingsFrozenUntil = liftsAt.toISOString();
    profile.updatedAt = now.toISOString();
  }

  private releaseLockdown(profile: RiskProfile): void {
    profile.lockdown = {
      status: LockdownStatus.NONE,
      triggeredAt: null,
      liftsAt: null,
      triggerLoss: null,
      breachedLimit: null,
    };
    profile.settingsFrozen = false;
    profile.settingsFrozenUntil = null;
    profile.updatedAt = new Date().toISOString();
  }

  private isLockdownExpired(profile: RiskProfile): boolean {
    if (!profile.lockdown.liftsAt) return true;
    return Date.now() >= new Date(profile.lockdown.liftsAt).getTime();
  }

  private reconcileLockdownState(profile: RiskProfile): RiskProfile {
    if (
      (profile.lockdown.status === LockdownStatus.ACTIVE ||
        profile.lockdown.status === LockdownStatus.COOLDOWN) &&
      this.isLockdownExpired(profile)
    ) {
      this.releaseLockdown(profile);
    }
    return profile;
  }

  private rotateDailyIfNeeded(profile: RiskProfile): void {
    const today = new Date().toISOString().split('T')[0];
    if (profile.today.date !== today) {
      profile.today = {
        date: today,
        realizedPnL: 0,
        unrealizedPnL: 0,
        peakValue: 0,
        totalCharges: 0,
        tradeCount: 0,
      };
      profile.portfolioValueAtOpen = 0;
    }
  }

  private snapshotState(profile: RiskProfile) {
    const currentLoss = profile.today.realizedPnL + profile.today.unrealizedPnL;
    const lossPercent = profile.portfolioValueAtOpen > 0
      ? (Math.abs(currentLoss) / profile.portfolioValueAtOpen) * 100
      : 0;

    return {
      lockdown: profile.lockdown.status,
      dailyLoss: currentLoss,
      dailyLossPercent: Math.round(lossPercent * 100) / 100,
      settingsFrozen: profile.settingsFrozen,
    };
  }
}

// Singleton — single RiskEngine instance for the entire server
export const riskEngine = new RiskEngine();
