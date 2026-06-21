/**
 * ============================================================================
 * Toroloom Contract Note Route — Integration Tests
 * ============================================================================
 *
 * Tests the PDF contract note parsing endpoints:
 *   POST /api/contract-note/parse        — Multipart upload
 *   POST /api/contract-note/parse-base64 — Base64-encoded PDF
 *   GET  /api/contract-note/status       — Service status
 *
 * Uses pdfkit to generate in-memory test PDFs with known trade data,
 * then verifies pdf-parse extracts the expected text.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/contractNote.int.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import PDFDocument from 'pdfkit';

import contractNoteRoutes from '../routes/contractNote';

// ─── PDF Generation Helpers ───────────────────────────────────────────────

/**
 * Generate a PDF buffer containing the given text using pdfkit.
 * The PDF is created in-memory (no filesystem writes).
 */
function createPdfBuffer(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(11).text(text, 50, 100, {
      width: 500,
      align: 'left',
      lineGap: 4,
    });

    doc.end();
  });
}

/** Sample Zerodha-style contract note trade data */
const ZERODHA_TRADE_DATA = `
Zerodha Broking Ltd.
Contract Note

Trade Date: 15-01-2024
Settlement No: SETTLE001

Scrip Name    | Buy/Sell | Quantity | Rate    | Amount
RELIANCE      | BUY      | 25       | 2567.50 | 64187.50
TCS           | SELL     | 10       | 3890.00 | 38900.00
INFY          | BUY      | 50       | 1467.30 | 73365.00
HDFCBANK      | SELL     | 15       | 1678.90 | 25183.50

Brokerage: 125.00
STT: 45.00
Other Charges: 12.50
Total: 64187.50
`;

/** Sample Angel One-style contract note trade data */
const ANGEL_TRADE_DATA = `
Angel One Ltd.
Contract Note

Trade Date: 20-01-2024
Order No: ORD2024001

Symbol      | B/S | Qty | Price   | Value
SBIN        | B   | 100 | 789.50  | 78950.00
BAJFINANCE  | S   | 30  | 6789.00 | 203670.00
ICICIBANK   | B   | 75  | 1089.30 | 81697.50
WIPRO       | S   | 40  | 456.70  | 18268.00

Total Turnover: 382585.50
Brokerage: 0.00
`;

/** A simple non-trade PDF (should return empty trades but parse successfully) */
const GENERIC_TEXT = 'This is just a generic document with no trade data.';

// ─── Multipart Request Builder ────────────────────────────────────────────

interface MultipartPayload {
  body: Buffer;
  contentType: string;
}

/**
 * Build a multipart/form-data request body for a single file field.
 */
function buildMultipart(fieldName: string, filename: string, fileBuffer: Buffer, contentType: string): MultipartPayload {
  const boundary = '----TestBoundary' + Math.random().toString(36).slice(2);
  const header =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n` +
    `\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(header, 'latin1'),
    fileBuffer,
    Buffer.from(footer, 'latin1'),
  ]);

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

// ─── HTTP Request Helpers ─────────────────────────────────────────────────

type ReqOptions = {
  method?: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
};

function request(opts: ReqOptions): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
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
          resolve({ status: res.statusCode!, body, headers: res.headers });
        });
      },
    );
    req.on('error', reject);

    if (opts.body) {
      // If body is a Buffer (multipart), write it directly
      if (Buffer.isBuffer(opts.body)) {
        req.write(opts.body);
      } else {
        req.write(JSON.stringify(opts.body));
      }
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

// ─── Server ───────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  // 20 MB limit to accommodate oversized PDF tests (10 MB buffer → ~13.3 MB base64)
  app.use(express.json({ limit: '20mb' }));
  app.use('/api/contract-note', contractNoteRoutes);

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

// ============================================================================
// 1. POST /api/contract-note/parse-base64
// ============================================================================

describe('POST /api/contract-note/parse-base64', () => {
  it('should parse a valid PDF with Zerodha trade data', async () => {
    const pdfBuffer = await createPdfBuffer(ZERODHA_TRADE_DATA);
    const base64 = pdfBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', { base64, filename: 'zerodha.pdf' });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.text).toBe('string');
    expect(body.text).toContain('Zerodha');
    expect(body.text).toContain('RELIANCE');
    expect(body.text).toContain('2567.50');
    expect(typeof body.pages).toBe('number');
    expect(body.pages).toBeGreaterThanOrEqual(1);
    expect(body.metadata).toBeDefined();
  });

  it('should parse a valid PDF with Angel One trade data', async () => {
    const pdfBuffer = await createPdfBuffer(ANGEL_TRADE_DATA);
    const base64 = pdfBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', { base64, filename: 'angel.pdf' });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.text).toContain('Angel One');
    expect(body.text).toContain('SBIN');
    expect(body.text).toContain('789.50');
    expect(body.pages).toBeGreaterThanOrEqual(1);
  });

  it('should parse a PDF with generic text (non-trade)', async () => {
    const pdfBuffer = await createPdfBuffer(GENERIC_TEXT);
    const base64 = pdfBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', { base64, filename: 'generic.pdf' });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.text).toContain('generic document');
    expect(body.pages).toBeGreaterThanOrEqual(1);
  });

  it('should reject empty base64 field', async () => {
    const { status, body } = await post('/api/contract-note/parse-base64', { base64: '' });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('base64');
  });

  it('should reject missing base64 field', async () => {
    const { status, body } = await post('/api/contract-note/parse-base64', { filename: 'test.pdf' });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('base64');
  });

  it('should return 500 when base64 decodes to non-PDF garbage', async () => {
    // Buffer.from() doesn't throw on invalid base64 — it silently ignores
    // invalid characters. The resulting garbage buffer then fails pdf-parse.
    const { status, body } = await post('/api/contract-note/parse-base64', { base64: '!!!not-base64!!!' });

    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain('PDF parsing failed');
  });

  it('should reject data URL prefix that decodes to empty buffer', async () => {
    const { status, body } = await post('/api/contract-note/parse-base64', {
      base64: 'data:application/pdf;base64,',
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('should accept data URL prefixed PDF with valid content', async () => {
    const pdfBuffer = await createPdfBuffer('Valid PDF with data URL prefix');
    const rawBase64 = pdfBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', {
      base64: `data:application/pdf;base64,${rawBase64}`,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.text).toContain('Valid PDF');
  });

  it('should handle a PDF with multi-page trade data and return page count', async () => {
    // Create a 2-page PDF by adding text beyond one page
    const longText = Array.from({ length: 80 }, (_, i) =>
      `Trade ${i + 1}: SYMBOL${i} BUY ${i + 1} ${(Math.random() * 2000 + 100).toFixed(2)}`,
    ).join('\n');

    const pdfBuffer = await createPdfBuffer(longText);
    const base64 = pdfBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', { base64 });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.text).toContain('SYMBOL');
    expect(body.pages).toBeGreaterThanOrEqual(1);
    expect(body.text.length).toBeGreaterThan(200);
  });

  it('should return 500 when pdf-parse throws on non-PDF binary data', async () => {
    // Create a PDF with no text (only an image placeholder - not possible with pdfkit,
    // but we can simulate by sending a non-PDF that's valid base64)
    const nonPdfBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    const base64 = nonPdfBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', { base64 });

    // pdf-parse throws on non-PDF data since it can't parse the stream.
    // The catch block wraps this as a 500.
    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain('PDF parsing failed');
  });

  it('should reject base64 that decodes to oversized PDF (>10 MB)', async () => {
    // Create a buffer slightly larger than 10 MB
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
    const base64 = largeBuffer.toString('base64');

    const { status, body } = await post('/api/contract-note/parse-base64', { base64 });
    // Note: the JSON body must be under the express.json() limit.
    // A 10 MB buffer encodes to ~13.3 MB base64, so the test app's
    // JSON limit is increased to 20 MB in beforeAll to accommodate this.

    expect(status).toBe(413);
    expect(body.success).toBe(false);
    expect(body.error).toContain('10 MB');
  });
});

// ============================================================================
// 2. POST /api/contract-note/parse (multipart upload)
// ============================================================================

describe('POST /api/contract-note/parse (multipart)', () => {
  it('should parse a valid PDF uploaded via multipart', async () => {
    const pdfBuffer = await createPdfBuffer(ZERODHA_TRADE_DATA);
    const { body: multipartBody, contentType } = buildMultipart('pdf', 'contract.pdf', pdfBuffer, 'application/pdf');

    const { status, body } = await post('/api/contract-note/parse', multipartBody, {
      'Content-Type': contentType,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.text).toContain('Zerodha');
    expect(body.text).toContain('RELIANCE');
    expect(body.pages).toBeGreaterThanOrEqual(1);
  });

  it('should reject when no file is uploaded', async () => {
    // Send empty JSON body — no file field present
    const { status, body } = await post('/api/contract-note/parse', {});

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('No PDF file');
  });

  it('should reject when a non-PDF file is uploaded with wrong content-type', async () => {
    const textBuffer = Buffer.from('This is not a PDF', 'utf-8');
    const { body: multipartBody, contentType } = buildMultipart('pdf', 'document.txt', textBuffer, 'text/plain');

    const { status, body } = await post('/api/contract-note/parse', multipartBody, {
      'Content-Type': contentType,
    });

    // multer's fileFilter should reject
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('PDF');
  });

  it('should handle Angel One trade data via multipart upload', async () => {
    const pdfBuffer = await createPdfBuffer(ANGEL_TRADE_DATA);
    const { body: multipartBody, contentType } = buildMultipart('pdf', 'angel.pdf', pdfBuffer, 'application/pdf');

    const { status, body } = await post('/api/contract-note/parse', multipartBody, {
      'Content-Type': contentType,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.text).toContain('Angel One');
    expect(body.text).toContain('SBIN');
    expect(body.pages).toBeGreaterThanOrEqual(1);
  });

  it('should return metadata when PDF contains metadata', async () => {
    // pdfkit doesn't set metadata by default, but pdf-parse returns what it can
    const pdfBuffer = await createPdfBuffer('Metadata test PDF');
    const { body: multipartBody, contentType } = buildMultipart('pdf', 'meta.pdf', pdfBuffer, 'application/pdf');

    const { status, body } = await post('/api/contract-note/parse', multipartBody, {
      'Content-Type': contentType,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // pdfkit PDFs should at least have some metadata
    expect(body.metadata).toBeDefined();
    expect(body.metadata).toHaveProperty('producer');
    expect(body.metadata).toHaveProperty('creator');
  });
});

// ============================================================================
// 3. GET /api/contract-note/status
// ============================================================================

describe('GET /api/contract-note/status', () => {
  it('should return service status with expected shape', async () => {
    const { status, body } = await get('/api/contract-note/status');

    expect(status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.maxFileSizeMB).toBe(10);
    expect(body.supportedFormats).toEqual(['pdf']);
    expect(body.engine).toBe('pdf-parse');
  });

  it('should be reachable without authentication', async () => {
    const { status } = await get('/api/contract-note/status');
    expect(status).toBe(200);
  });

  it('should be reachable without any special headers', async () => {
    const { status } = await get('/api/contract-note/status', {});
    expect(status).toBe(200);
  });
});
