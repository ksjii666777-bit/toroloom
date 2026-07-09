/**
 * ============================================================================
 * Toroloom — KYC Routes Integration Tests
 * ============================================================================
 *
 * Tests all endpoints in backend/src/routes/kyc.ts:
 *
 *   POST   /api/kyc/pan/verify         — Verify PAN number
 *   POST   /api/kyc/aadhaar/otp         — Send Aadhaar OTP
 *   POST   /api/kyc/aadhaar/verify      — Verify Aadhaar OTP
 *   POST   /api/kyc/digilocker/auth     — Get DigiLocker auth URL
 *   POST   /api/kyc/digilocker/fetch    — Fetch DigiLocker documents
 *   GET    /api/kyc/status              — Get current KYC state
 *   POST   /api/kyc/complete            — Complete KYC
 *   POST   /api/kyc/reset               — Reset KYC
 *   POST   /api/kyc/bank/verify-ifsc    — Verify IFSC code
 *   POST   /api/kyc/bank/verify-account — Verify bank account
 *   POST   /api/kyc/bank/link           — Link bank account
 *   GET    /api/kyc/bank/linked         — Get linked banks
 *   POST   /api/kyc/bank/remove         — Remove linked bank
 *   POST   /api/kyc/bank/set-primary    — Set primary bank
 *
 * ============================================================================
 */

vi.hoisted(() => {
  process.env.BROKER = 'mock';
  process.env.DATA_SOURCE = 'mock';
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import { generateToken } from '../middleware/auth';
import { resetKycService } from '../services/kyc';

// ──── Route imports ─────────────────────────────────────────────────────────

import kycRoutes from '../routes/kyc';

// ──── Constants ─────────────────────────────────────────────────────────────

const TEST_USER_ID = 'test_user_kyc_routes';
const TEST_TOKEN = generateToken({ userId: TEST_USER_ID, email: 'kyc@toroloom.com' });

// Note: KYC routes do NOT use authMiddleware, but some access req.user.userId.
// We add a custom middleware in the test server to set req.user.

// ──── Helpers ───────────────────────────────────────────────────────────────

type ReqOptions = {
  method?: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
};

function request(opts: ReqOptions): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: opts.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...opts.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          let body: any;
          try {
            body = data ? JSON.parse(data) : undefined;
          } catch {
            body = data;
          }
          resolve({ status: res.statusCode!, body });
        });
      },
    );
    req.on('error', reject);

    if (opts.body) {
      req.write(JSON.stringify(opts.body));
    }
    req.end();
  });
}

function get(path: string, headers?: Record<string, string>) {
  return request({ method: 'GET', path, headers });
}

function post(path: string, body?: any, headers?: Record<string, string>) {
  return request({ method: 'POST', path, body, headers });
}

/** Helper: create a complete KYC setup (PAN + Aadhaar) for "complete" tests */
async function setupFullKyc(userId: string) {
  // Verify PAN
  const panRes = await post('/api/kyc/pan/verify', { panNumber: 'XYZAB9012H' }, { 'x-user-id': userId });
  if (panRes.status !== 200) throw new Error(`PAN verify failed: ${panRes.body.error}`);

  // Send Aadhaar OTP
  const otpRes = await post('/api/kyc/aadhaar/otp', { aadhaarNumber: '234567891011', consent: true }, { 'x-user-id': userId });
  if (otpRes.status !== 200) throw new Error(`Aadhaar OTP failed: ${otpRes.body.error}`);

  // Verify Aadhaar OTP
  const verifyRes = await post('/api/kyc/aadhaar/verify', { referenceId: otpRes.body.referenceId, otp: '123456' }, { 'x-user-id': userId });
  if (verifyRes.status !== 200) throw new Error(`Aadhaar verify failed: ${verifyRes.body.error}`);
}

// ──── Server ────────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // KYC routes access req.user.userId without authMiddleware.
  // We add a mock middleware that sets req.user from a custom header.
  app.use((req: any, _res: any, next: any) => {
    const userId = req.headers['x-user-id'] || TEST_USER_ID;
    req.user = { userId, email: 'kyc@toroloom.com' };
    next();
  });

  app.use('/api/kyc', kycRoutes);

  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const port = (server.address() as any).port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

beforeEach(() => {
  resetKycService();
});

// ============================================================================
// POST /api/kyc/pan/verify
// ============================================================================

describe('POST /api/kyc/pan/verify', () => {
  it('returns 400 when panNumber is missing', async () => {
    const { status, body } = await post('/api/kyc/pan/verify', {});
    expect(status).toBe(400);
    expect(body.error).toContain('PAN number is required');
  });

  it('returns INVALID for malformed PAN', async () => {
    const { status, body } = await post('/api/kyc/pan/verify', { panNumber: 'INVALID' });
    expect(status).toBe(400);
    expect(body.isVerified).toBe(false);
    expect(body.status).toBe('INVALID');
    expect(body.panNumber).toBe('INVALID');
  });

  it('verifies a valid known PAN', async () => {
    const { status, body } = await post('/api/kyc/pan/verify', { panNumber: 'XYZAB9012H' });

    expect(status).toBe(200);
    expect(body.isVerified).toBe(true);
    expect(body.status).toBe('VALID');
    expect(body.panNumber).toBe('XYZAB9012H');
    expect(body.fullName).toBe('VIKRAM REDDY');
    expect(body.nameOnPan).toBe('VIKRAM REDDY');
    expect(body.category).toBe('Individual');
    expect(body.lastUpdated).toBeDefined();
  });

  it('verifies another valid PAN', async () => {
    const { status, body } = await post('/api/kyc/pan/verify', { panNumber: 'DEFGH7890J' });

    expect(status).toBe(200);
    expect(body.isVerified).toBe(true);
    expect(body.fullName).toBe('ARUN KUMAR');
  });

  it('returns NOT_FOUND for valid format PAN not in mock database', async () => {
    const { status, body } = await post('/api/kyc/pan/verify', { panNumber: 'PAAAP9999P' });

    expect(status).toBe(200);
    expect(body.isVerified).toBe(false);
    expect(body.status).toBe('NOT_FOUND');
    expect(body.fullName).toBe('');
  });

  it('normalizes lowercase PAN to uppercase', async () => {
    const { body } = await post('/api/kyc/pan/verify', { panNumber: 'xyzab9012h' });
    expect(body.isVerified).toBe(true);
    expect(body.panNumber).toBe('XYZAB9012H');
  });

  it('normalizes PAN with spaces and hyphens', async () => {
    const { body } = await post('/api/kyc/pan/verify', { panNumber: '  XYZAB-9012H  ' });
    expect(body.isVerified).toBe(true);
    expect(body.panNumber).toBe('XYZAB9012H');
  });
});

// ============================================================================
// POST /api/kyc/aadhaar/otp
// ============================================================================

describe('POST /api/kyc/aadhaar/otp', () => {
  it('returns 400 when aadhaarNumber is missing', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/otp', { consent: true });
    expect(status).toBe(400);
    expect(body.error).toContain('Aadhaar number is required');
  });

  it('returns 400 when consent is false', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/otp', { aadhaarNumber: '234567891011', consent: false });
    expect(status).toBe(400);
    expect(body.error).toContain('consent is required');
  });

  it('returns 400 when consent is missing', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/otp', { aadhaarNumber: '234567891011' });
    expect(status).toBe(400);
    expect(body.error).toContain('consent is required');
  });

  it('sends OTP for valid Aadhaar with consent and returns masked Aadhaar', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/otp', {
      aadhaarNumber: '234567891011',
      consent: true,
    });

    expect(status).toBe(200);
    expect(body.referenceId).toBeDefined();
    expect(body.referenceId).toContain('AADHAAR_OTP_');
    expect(body.message).toContain('OTP sent');
    expect(body.expiresAt).toBeDefined();
    // Masked Aadhaar: all but last 4 chars are X
    expect(body.maskedAadhaar).toBe('XXXXXXXX1011');
  });

  it('sends OTP for Aadhaar with spaces in number', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/otp', {
      aadhaarNumber: '2345 6789 1011',
      consent: true,
    });
    expect(status).toBe(200);
    expect(body.referenceId).toBeDefined();
  });

  it('returns 400 for invalid Aadhaar format (starts with 0/1)', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/otp', {
      aadhaarNumber: '123456789012',
      consent: true,
    });
    expect(status).toBe(400);
    expect(body.error).toContain('Invalid Aadhaar number format');
  });

  it('returns 400 for short Aadhaar number', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/otp', {
      aadhaarNumber: '2345678901',
      consent: true,
    });
    expect(status).toBe(400);
    expect(body.error).toContain('Invalid Aadhaar number format');
  });

  it('generates unique reference IDs for sequential calls', async () => {
    const r1 = await post('/api/kyc/aadhaar/otp', { aadhaarNumber: '345678901212', consent: true });
    const r2 = await post('/api/kyc/aadhaar/otp', { aadhaarNumber: '456789012323', consent: true });
    expect(r1.body.referenceId).not.toBe(r2.body.referenceId);
  });
});

// ============================================================================
// POST /api/kyc/aadhaar/verify
// ============================================================================

describe('POST /api/kyc/aadhaar/verify', () => {
  it('returns 400 when referenceId is missing', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/verify', { otp: '123456' });
    expect(status).toBe(400);
    expect(body.error).toContain('referenceId and otp');
  });

  it('returns 400 when otp is missing', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/verify', { referenceId: 'ref_1' });
    expect(status).toBe(400);
    expect(body.error).toContain('referenceId and otp');
  });

  it('returns 400 when otp is not 6 digits', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/verify', { referenceId: 'ref_1', otp: 'abc' });
    expect(status).toBe(400);
    expect(body.error).toContain('6-digit');
  });

  it('verifies OTP successfully with correct code (123456)', async () => {
    const otpRes = await post('/api/kyc/aadhaar/otp', { aadhaarNumber: '234567891011', consent: true });
    expect(otpRes.status).toBe(200);

    const { status, body } = await post('/api/kyc/aadhaar/verify', {
      referenceId: otpRes.body.referenceId,
      otp: '123456',
    });
    expect(status).toBe(200);
    expect(body.isVerified).toBe(true);
    expect(body.lastFourDigits).toBe('3456');
    expect(body.yearOfBirth).toBeDefined();
    expect(body.gender).toBeDefined();
    expect(body.state).toBeDefined();
    expect(body.message).toContain('verified successfully');
  });

  it('rejects wrong OTP', async () => {
    const otpRes = await post('/api/kyc/aadhaar/otp', { aadhaarNumber: '345678901212', consent: true });

    const { status, body } = await post('/api/kyc/aadhaar/verify', {
      referenceId: otpRes.body.referenceId,
      otp: '000000',
    });
    // Service returns result object (not throw) for wrong OTP
    expect(status).toBe(200);
    expect(body.isVerified).toBe(false);
    expect(body.message).toContain('Invalid OTP');
  });

  it('rejects expired/invalid reference ID', async () => {
    const { status, body } = await post('/api/kyc/aadhaar/verify', {
      referenceId: 'AADHAAR_OTP_9999999999_999',
      otp: '123456',
    });
    // Service returns result object (not throw) for invalid ref ID
    expect(status).toBe(200);
    expect(body.isVerified).toBe(false);
    expect(body.message).toContain('Invalid or expired reference ID');
  });

  it('consumes the OTP after first successful use (cannot reuse)', async () => {
    const otpRes = await post('/api/kyc/aadhaar/otp', { aadhaarNumber: '567890123434', consent: true });

    // First use — success
    const r1 = await post('/api/kyc/aadhaar/verify', { referenceId: otpRes.body.referenceId, otp: '123456' });
    expect(r1.status).toBe(200);
    expect(r1.body.isVerified).toBe(true);

    // Second use — should fail (OTP consumed)
    const r2 = await post('/api/kyc/aadhaar/verify', { referenceId: otpRes.body.referenceId, otp: '123456' });
    // Service returns result object (isVerified: false) — not throw
    expect(r2.status).toBe(200);
    expect(r2.body.isVerified).toBe(false);
    expect(r2.body.message).toContain('Invalid or expired reference ID');
  });
});

// ============================================================================
// POST /api/kyc/digilocker/auth
// ============================================================================

describe('POST /api/kyc/digilocker/auth', () => {
  it('returns an auth URL with reference ID', async () => {
    const { status, body } = await post('/api/kyc/digilocker/auth', {}, { 'x-user-id': TEST_USER_ID });

    expect(status).toBe(200);
    expect(body.authUrl).toBeDefined();
    expect(body.authUrl).toContain('digilocker.gov.in');
    expect(body.authUrl).toContain('state=' + body.referenceId);
    expect(body.referenceId).toContain('DL_');
  });

  it('generates unique reference IDs for sequential calls', async () => {
    const r1 = await post('/api/kyc/digilocker/auth', {}, { 'x-user-id': 'user-1' });
    const r2 = await post('/api/kyc/digilocker/auth', {}, { 'x-user-id': 'user-2' });
    expect(r1.body.referenceId).not.toBe(r2.body.referenceId);
  });
});

// ============================================================================
// POST /api/kyc/digilocker/fetch
// ============================================================================

describe('POST /api/kyc/digilocker/fetch', () => {
  it('returns 400 when referenceId is missing', async () => {
    const { status, body } = await post('/api/kyc/digilocker/fetch', {});
    expect(status).toBe(400);
    expect(body.error).toContain('referenceId');
  });

  it('fetches and returns 3 verified documents', async () => {
    const auth = await post('/api/kyc/digilocker/auth', {}, { 'x-user-id': 'doc-user' });
    expect(auth.status).toBe(200);

    const { status, body } = await post('/api/kyc/digilocker/fetch', {
      referenceId: auth.body.referenceId,
    }, { 'x-user-id': 'doc-user' });

    expect(status).toBe(200);
    expect(body.isVerified).toBe(true);
    expect(body.documents).toHaveLength(3);
    expect(body.message).toContain('Documents fetched');
  });

  it('returns Aadhaar, PAN, and Voter ID documents with correct issuer names', async () => {
    const auth = await post('/api/kyc/digilocker/auth', {}, { 'x-user-id': 'doc-types' });
    const { body } = await post('/api/kyc/digilocker/fetch', { referenceId: auth.body.referenceId }, { 'x-user-id': 'doc-types' });

    expect(body.documents[0].name).toBe('Aadhaar Card');
    expect(body.documents[1].name).toBe('PAN Card');
    expect(body.documents[2].name).toBe('Voter ID');
    expect(body.documents[0].issuerName).toBe('Unique Identification Authority of India');
    expect(body.documents[1].issuerName).toBe('Income Tax Department');
  });

  it('each document has all required fields', async () => {
    const auth = await post('/api/kyc/digilocker/auth', {}, { 'x-user-id': 'doc-fields' });
    const { body } = await post('/api/kyc/digilocker/fetch', { referenceId: auth.body.referenceId }, { 'x-user-id': 'doc-fields' });

    for (const doc of body.documents) {
      expect(doc.id).toBeDefined();
      expect(doc.name).toBeDefined();
      expect(doc.issuerId).toBeDefined();
      expect(doc.issuerName).toBeDefined();
      expect(doc.documentType).toBeDefined();
      expect(doc.issuedAt).toBeDefined();
      expect(doc.uri).toBeDefined();
    }
  });
});

// ============================================================================
// GET /api/kyc/status
// ============================================================================

describe('GET /api/kyc/status', () => {
  it('returns pending KYC for new user', async () => {
    const { status, body } = await get('/api/kyc/status', { 'x-user-id': 'new-user' });

    expect(status).toBe(200);
    expect(body.overallKycStatus).toBe('pending');
    expect(body.steps).toBeDefined();
    expect(Array.isArray(body.steps)).toBe(true);
    expect(body.userId).toBe('new-user');
  });

  it('shows panVerified after PAN verification', async () => {
    await post('/api/kyc/pan/verify', { panNumber: 'XYZAB9012H' }, { 'x-user-id': 'status-user' });

    const { body } = await get('/api/kyc/status', { 'x-user-id': 'status-user' });
    expect(body.panVerified).toBe(true);
    expect(body.panNumber).toBe('XYZAB9012H');
    expect(body.panName).toBe('VIKRAM REDDY');
  });
});

// ============================================================================
// POST /api/kyc/complete
// ============================================================================

describe('POST /api/kyc/complete', () => {
  it('returns 400 when PAN is not verified', async () => {
    const { status, body } = await post('/api/kyc/complete', {}, { 'x-user-id': 'no-pan-user' });
    expect(status).toBe(400);
    expect(body.error).toContain('PAN verification is required');
  });

  it('returns 400 when Aadhaar is not verified', async () => {
    await post('/api/kyc/pan/verify', { panNumber: 'XYZAB9012H' }, { 'x-user-id': 'no-aadhaar-user' });

    const { status, body } = await post('/api/kyc/complete', {}, { 'x-user-id': 'no-aadhaar-user' });
    expect(status).toBe(400);
    expect(body.error).toContain('Aadhaar verification is required');
  });

  it('completes KYC when PAN and Aadhaar are verified', async () => {
    await setupFullKyc('complete-user');

    const { status, body } = await post('/api/kyc/complete', {}, { 'x-user-id': 'complete-user' });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.state.overallKycStatus).toBe('verified');
    expect(body.state.panVerified).toBe(true);
    expect(body.state.aadhaarVerified).toBe(true);
    expect(body.state.completedAt).toBeDefined();
  });
});

// ============================================================================
// POST /api/kyc/reset
// ============================================================================

describe('POST /api/kyc/reset', () => {
  it('resets KYC state for a user', async () => {
    await setupFullKyc('reset-user');

    // Verify KYC is complete
    await post('/api/kyc/complete', {}, { 'x-user-id': 'reset-user' });

    // Reset
    const { status, body } = await post('/api/kyc/reset', {}, { 'x-user-id': 'reset-user' });
    expect(status).toBe(200);
    expect(body.success).toBe(true);

    // Status should be pending again
    const state = await get('/api/kyc/status', { 'x-user-id': 'reset-user' });
    expect(state.body.overallKycStatus).toBe('pending');
  });

  it('does not affect other users KYC state', async () => {
    await setupFullKyc('user-a');
    await post('/api/kyc/pan/verify', { panNumber: 'DEFGH7890J' }, { 'x-user-id': 'user-b' });

    await post('/api/kyc/reset', {}, { 'x-user-id': 'user-a' });

    const stateA = await get('/api/kyc/status', { 'x-user-id': 'user-a' });
    const stateB = await get('/api/kyc/status', { 'x-user-id': 'user-b' });

    expect(stateA.body.overallKycStatus).toBe('pending');
    expect(stateA.body.panVerified).toBeUndefined();
    expect(stateB.body.panVerified).toBe(true);
  });
});

// ============================================================================
// POST /api/kyc/bank/verify-ifsc
// ============================================================================

describe('POST /api/kyc/bank/verify-ifsc', () => {
  it('returns 400 when ifsc is missing', async () => {
    const { status, body } = await post('/api/kyc/bank/verify-ifsc', {});
    expect(status).toBe(400);
    expect(body.error).toContain('IFSC code is required');
  });

  it('returns 400 for invalid IFSC format', async () => {
    const { status, body } = await post('/api/kyc/bank/verify-ifsc', { ifsc: 'XYZ' });
    expect(status).toBe(400);
    expect(body.isValid).toBe(false);
    expect(body.error).toContain('Invalid IFSC format');
  });

  it('verifies valid IFSC code (HDFC)', async () => {
    const { status, body } = await post('/api/kyc/bank/verify-ifsc', { ifsc: 'HDFC0001234' });

    expect(status).toBe(200);
    expect(body.isValid).toBe(true);
    expect(body.ifsc).toBe('HDFC0001234');
    expect(body.bankName).toBe('HDFC Bank');
    expect(body.branch).toBe('Andheri West');
    expect(body.city).toBe('Mumbai');
    expect(body.state).toBe('Maharashtra');
    expect(body.contact).toBe('1800-202-6161');
    expect(body.micrCode).toBeDefined();
  });

  it('verifies valid IFSC code (ICICI)', async () => {
    const { status, body } = await post('/api/kyc/bank/verify-ifsc', { ifsc: 'ICIC0005678' });

    expect(status).toBe(200);
    expect(body.isValid).toBe(true);
    expect(body.bankName).toBe('ICICI Bank');
    expect(body.branch).toBe('Koramangala');
  });

  it('returns isValid:false for IFSC not in database', async () => {
    const { status, body } = await post('/api/kyc/bank/verify-ifsc', { ifsc: 'ABCD0001234' });

    expect(status).toBe(200);
    expect(body.isValid).toBe(false);
    expect(body.bankName).toBe('');
    expect(body.ifsc).toBe('ABCD0001234');
  });

  it('normalizes IFSC to uppercase', async () => {
    const { body } = await post('/api/kyc/bank/verify-ifsc', { ifsc: 'hdfc0001234' });
    expect(body.isValid).toBe(true);
    expect(body.ifsc).toBe('HDFC0001234');
  });
});

// ============================================================================
// POST /api/kyc/bank/verify-account
// ============================================================================

describe('POST /api/kyc/bank/verify-account', () => {
  it('returns 400 when required fields are missing', async () => {
    const { status, body } = await post('/api/kyc/bank/verify-account', {});
    expect(status).toBe(400);
    expect(body.error).toContain('ifsc, accountNumber, and accountHolderName');
  });

  it('returns 400 when only ifsc is provided', async () => {
    const { status, body } = await post('/api/kyc/bank/verify-account', { ifsc: 'HDFC0001234' });
    expect(status).toBe(400);
    expect(body.error).toContain('accountNumber');
  });

  it('verifies account with valid details and matching name', async () => {
    const { status, body } = await post('/api/kyc/bank/verify-account', {
      ifsc: 'HDFC0001234',
      accountNumber: '123456789012345678',
      accountHolderName: 'RAHUL SHARMA',
    });

    expect(status).toBe(200);
    expect(body.isValid).toBe(true);
    expect(body.bankName).toBe('HDFC Bank');
    expect(body.accountHolderName).toBe('RAHUL SHARMA');
    expect(body.nameMatchScore).toBe(95);
    expect(body.message).toContain('verified successfully');
  });

  it('returns isValid:false for name not matching bank records', async () => {
    const { body } = await post('/api/kyc/bank/verify-account', {
      ifsc: 'HDFC0001234',
      accountNumber: '123456789012345678',
      accountHolderName: 'UNKNOWN NAME',
    });

    expect(body.isValid).toBe(false);
    expect(body.message).toContain('does not match bank records');
  });

  it('returns error for invalid IFSC', async () => {
    const { body } = await post('/api/kyc/bank/verify-account', {
      ifsc: 'INVALID',
      accountNumber: '123456789012345678',
      accountHolderName: 'RAHUL SHARMA',
    });

    expect(body.isValid).toBe(false);
    expect(body.message).toContain('Invalid IFSC code');
  });

  it('returns error for short account number', async () => {
    const { body } = await post('/api/kyc/bank/verify-account', {
      ifsc: 'HDFC0001234',
      accountNumber: '12345',
      accountHolderName: 'RAHUL SHARMA',
    });

    expect(body.isValid).toBe(false);
    expect(body.message).toContain('Account number must be');
  });
});

// ============================================================================
// POST /api/kyc/bank/link
// ============================================================================

describe('POST /api/kyc/bank/link', () => {
  it('returns 400 when required fields are missing', async () => {
    const { status, body } = await post('/api/kyc/bank/link', {}, { 'x-user-id': TEST_USER_ID });
    expect(status).toBe(400);
    expect(body.error).toContain('bankName, accountNumber, ifsc, and accountHolderName');
  });

  it('links a bank account and returns masked details', async () => {
    const { status, body } = await post('/api/kyc/bank/link', {
      bankName: 'HDFC Bank',
      accountNumber: '123456789012345678',
      ifsc: 'HDFC0001234',
      accountHolderName: 'RAHUL SHARMA',
      accountType: 'savings',
      isPrimary: true,
    }, { 'x-user-id': TEST_USER_ID });

    expect(status).toBe(200);
    expect(body.id).toBeDefined();
    expect(body.bankName).toBe('HDFC Bank');
    expect(body.accountNumber).toBe('XXXX5678'); // Masked: last 4 digits
    expect(body.ifsc).toBe('HDFC0001234');
    expect(body.accountHolderName).toBe('RAHUL SHARMA');
    expect(body.accountType).toBe('savings');
    expect(body.isPrimary).toBe(true);
    expect(body.verified).toBe(true);
    expect(body.linkedAt).toBeDefined();
  });

  it('defaults accountType to savings when not provided', async () => {
    const { body } = await post('/api/kyc/bank/link', {
      bankName: 'ICICI Bank',
      accountNumber: '987654321098765432',
      ifsc: 'ICIC0005678',
      accountHolderName: 'PRIYA PATEL',
    }, { 'x-user-id': TEST_USER_ID });

    expect(body.accountType).toBe('savings');
    expect(body.isPrimary).toBe(false);
  });

  it('defaults isPrimary to false when not provided', async () => {
    const { body } = await post('/api/kyc/bank/link', {
      bankName: 'SBI',
      accountNumber: '1111222233334444',
      ifsc: 'SBIN0001234',
      accountHolderName: 'ARUN KUMAR',
    }, { 'x-user-id': TEST_USER_ID });

    expect(body.isPrimary).toBe(false);
  });

  it('sets linked bank as primary and un-primaries others', async () => {
    // Link first bank as primary
    await post('/api/kyc/bank/link', {
      bankName: 'HDFC Bank', accountNumber: '111111111111', ifsc: 'HDFC0001234',
      accountHolderName: 'RAHUL SHARMA', isPrimary: true,
    }, { 'x-user-id': 'primary-user' });

    // Link second bank as primary — first should be un-primarized
    await post('/api/kyc/bank/link', {
      bankName: 'ICICI Bank', accountNumber: '222222222222', ifsc: 'ICIC0005678',
      accountHolderName: 'RAHUL SHARMA', isPrimary: true,
    }, { 'x-user-id': 'primary-user' });

    const { body } = await get('/api/kyc/bank/linked', { 'x-user-id': 'primary-user' });
    expect(body).toHaveLength(2);
    const first = body.find((b: any) => b.bankName === 'HDFC Bank');
    const second = body.find((b: any) => b.bankName === 'ICICI Bank');
    expect(first.isPrimary).toBe(false);
    expect(second.isPrimary).toBe(true);
  });
});

// ============================================================================
// GET /api/kyc/bank/linked
// ============================================================================

describe('GET /api/kyc/bank/linked', () => {
  it('returns empty array when no banks linked', async () => {
    const { status, body } = await get('/api/kyc/bank/linked', { 'x-user-id': 'no-banks-user' });
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('returns linked banks after linking', async () => {
    await post('/api/kyc/bank/link', {
      bankName: 'HDFC Bank', accountNumber: '123456789012', ifsc: 'HDFC0001234',
      accountHolderName: 'RAHUL SHARMA', isPrimary: true,
    }, { 'x-user-id': 'list-user' });

    await post('/api/kyc/bank/link', {
      bankName: 'ICICI Bank', accountNumber: '987654321098', ifsc: 'ICIC0005678',
      accountHolderName: 'RAHUL SHARMA',
    }, { 'x-user-id': 'list-user' });

    const { body } = await get('/api/kyc/bank/linked', { 'x-user-id': 'list-user' });
    expect(body).toHaveLength(2);
    expect(body[0].bankName).toBe('HDFC Bank');
    expect(body[1].bankName).toBe('ICICI Bank');
  });
});

// ============================================================================
// POST /api/kyc/bank/remove
// ============================================================================

describe('POST /api/kyc/bank/remove', () => {
  it('returns 400 when accountId is missing', async () => {
    const { status, body } = await post('/api/kyc/bank/remove', {}, { 'x-user-id': TEST_USER_ID });
    expect(status).toBe(400);
    expect(body.error).toContain('accountId');
  });

  it('removes a linked bank account', async () => {
    // Link a bank
    const link = await post('/api/kyc/bank/link', {
      bankName: 'HDFC Bank', accountNumber: '123456789012', ifsc: 'HDFC0001234',
      accountHolderName: 'RAHUL SHARMA', isPrimary: true,
    }, { 'x-user-id': 'remove-user' });
    const accountId = link.body.id;

    // Remove it
    const { status, body } = await post('/api/kyc/bank/remove', { accountId }, { 'x-user-id': 'remove-user' });
    expect(status).toBe(200);
    expect(body.success).toBe(true);

    // Verify it's gone
    const { body: linked } = await get('/api/kyc/bank/linked', { 'x-user-id': 'remove-user' });
    expect(linked).toHaveLength(0);
  });
});

// ============================================================================
// POST /api/kyc/bank/set-primary
// ============================================================================

describe('POST /api/kyc/bank/set-primary', () => {
  it('returns 400 when accountId is missing', async () => {
    const { status, body } = await post('/api/kyc/bank/set-primary', {}, { 'x-user-id': TEST_USER_ID });
    expect(status).toBe(400);
    expect(body.error).toContain('accountId');
  });

  it('sets a bank account as primary', async () => {
    // Link two banks
    const link1 = await post('/api/kyc/bank/link', {
      bankName: 'HDFC Bank', accountNumber: '111111111111', ifsc: 'HDFC0001234',
      accountHolderName: 'RAHUL SHARMA', isPrimary: true,
    }, { 'x-user-id': 'primary-set-user' });

    const link2 = await post('/api/kyc/bank/link', {
      bankName: 'ICICI Bank', accountNumber: '222222222222', ifsc: 'ICIC0005678',
      accountHolderName: 'RAHUL SHARMA',
    }, { 'x-user-id': 'primary-set-user' });

    // Set second account as primary
    const { status, body } = await post('/api/kyc/bank/set-primary', {
      accountId: link2.body.id,
    }, { 'x-user-id': 'primary-set-user' });

    expect(status).toBe(200);
    expect(body.isPrimary).toBe(true);

    // First account should no longer be primary
    const { body: linked } = await get('/api/kyc/bank/linked', { 'x-user-id': 'primary-set-user' });
    const first = linked.find((b: any) => b.id === link1.body.id);
    const second = linked.find((b: any) => b.id === link2.body.id);
    expect(first.isPrimary).toBe(false);
    expect(second.isPrimary).toBe(true);
  });

  it('returns 404 for non-existent account', async () => {
    const { status, body } = await post('/api/kyc/bank/set-primary', {
      accountId: 'nonexistent_id',
    }, { 'x-user-id': TEST_USER_ID });

    expect(status).toBe(404);
    expect(body.error).toContain('not found');
  });
});
