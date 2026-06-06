/**
 * ============================================================================
 * Toroloom — Cross-File Isolation Test: AuditTrail File B
 * ============================================================================
 *
 * Verifies that after File A runs and calls _clearForTesting() in its afterAll,
 * this file starts with a completely clean auditTrail singleton.
 *
 * If File A's afterAll did NOT call _clearForTesting(), this file would
 * inherit File A's 2 events and the isolation assertions below would fail.
 *
 * Run with File A in the same vitest process:
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

const USER_B = 'audit_cross_file_user_b';

describe('Cross-File Isolation — AuditTrail File B', () => {
  afterAll(async () => {
    // Clean up after ourselves
    await auditTrail._clearForTesting();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Isolation assertions — these fail if File A's events leaked
  // ═══════════════════════════════════════════════════════════════════════════

  it('should start with an empty audit trail (no events from File A)', async () => {
    const events = await auditTrail.getEvents();
    expect(events).toHaveLength(0);
  });

  it('should have a snapshot showing zero total events', async () => {
    const snapshot = await auditTrail.snapshot();
    expect(snapshot.totalEvents).toBe(0);
    expect(snapshot.firstEventTime).toBeNull();
    expect(snapshot.lastEventTime).toBeNull();
    expect(snapshot.latestHash).toBeNull();
  });

  it('should verify integrity on an empty trail', async () => {
    const valid = await auditTrail.verifyIntegrity();
    expect(valid).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Independent operation — File B appends its own events
  // ═══════════════════════════════════════════════════════════════════════════

  it('should append its own events independently', async () => {
    const event = await auditTrail.append({
      userId: USER_B,
      eventType: 'AUTH_LOGIN',
      data: { ip: '192.168.1.1' },
    });
    expect(event).toBeDefined();
    expect(event.userId).toBe(USER_B);
    expect(event.eventType).toBe('AUTH_LOGIN');
  });

  it('should have exactly 1 event (none from File A)', async () => {
    const events = await auditTrail.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].userId).toBe(USER_B);
  });

  it('should have a valid hash chain for its own events', async () => {
    const valid = await auditTrail.verifyIntegrity();
    expect(valid).toBe(true);
  });
});
