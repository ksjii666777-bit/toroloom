/**
 * ============================================================================
 * Toroloom — Cross-File Isolation Test: AuditTrail File A
 * ============================================================================
 *
 * Appends events to the auditTrail singleton, then calls _clearForTesting()
 * in afterAll. If the cleanup is missing or broken, File B will inherit
 * these events and its assertions will fail.
 *
 * Run with File B in the same vitest process:
 *   npx vitest run --config vitest.cross-file.config.ts \
 *     src/__tests__/auditCrossFileA.test.ts \
 *     src/__tests__/auditCrossFileB.test.ts
 *
 * Environment:
 *   Uses in-memory storage (no DB required).
 * ============================================================================
 */

import { describe, it, expect, afterAll } from 'vitest';
import { auditTrail } from '../services/auditTrail';

const USER_A = 'audit_cross_file_user_a';

describe('Cross-File Isolation — AuditTrail File A', () => {
  afterAll(async () => {
    // CRITICAL: Clear the audit trail singleton so File B starts with
    // an empty audit log. Without this, File B inherits File A's events.
    await auditTrail._clearForTesting();
  });

  it('should append events to the audit trail', async () => {
    const event1 = await auditTrail.append({
      userId: USER_A,
      eventType: 'ORDER_EXECUTION',
      data: { symbol: 'RELIANCE', quantity: 10, price: 2890 },
    });
    expect(event1).toBeDefined();
    expect(event1.userId).toBe(USER_A);
    expect(event1.eventType).toBe('ORDER_EXECUTION');

    const event2 = await auditTrail.append({
      userId: USER_A,
      eventType: 'LOCKDOWN_TRIGGERED',
      data: { reason: 'Daily loss limit breached', loss: -60_000 },
    });
    expect(event2).toBeDefined();
    expect(event2.eventType).toBe('LOCKDOWN_TRIGGERED');
  });

  it('should have 2 events in the audit trail for File A', async () => {
    const events = await auditTrail.getEvents({ userId: USER_A });
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe('LOCKDOWN_TRIGGERED');
    expect(events[1].eventType).toBe('ORDER_EXECUTION');
  });

  it('should have a valid hash chain', async () => {
    const valid = await auditTrail.verifyIntegrity();
    expect(valid).toBe(true);
  });
});
