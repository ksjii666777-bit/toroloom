/**
 * ============================================================================
 * Toroloom — Contract Note PDF Text Extraction Route
 * ============================================================================
 *
 * Accepts uploaded PDF contract notes (via base64 or multipart), extracts
 * the raw text using pdf-parse, and returns the text for downstream parsing
 * by the client-side tradeLedgerParser.
 *
 * Endpoints:
 *   POST /api/contract-note/parse        — Upload PDF file (multipart)
 *   POST /api/contract-note/parse-base64 — Send PDF as base64 in JSON body
 *
 * Auth: Optional — users can parse contract notes without logging in
 *       (the data never touches user accounts; it's parsed client-side).
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback, MulterError } from 'multer';

// pdf-parse v2 exports a PDFParse class (NOT a function).
// Use destructured require with class instantiation.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFParse } = require('pdf-parse') as { PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string; pages: unknown[]; total: number }>; getInfo(): Promise<{ info: Record<string, string>; metadata: Record<string, string> }> } };

const router = Router();

// ─── Multer Config ─────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new MulterError('LIMIT_UNEXPECTED_FILE', 'pdf'));
    }
  },
});

// ─── Types ─────────────────────────────────────────────────────────────────

interface ParseResponse {
  success: boolean;
  text?: string;
  pages?: number;
  metadata?: Record<string, string | undefined>;
  error?: string;
  warning?: string;
}

interface ParseBase64Body {
  base64: string;
  filename?: string;
}

// ─── POST /api/contract-note/parse (multipart upload) ─────────────────────

router.post(
  '/parse',
  (req: Request, res: Response, next) => {
    upload.single('pdf')(req, res, (err) => {
      if (err) {
        if (err instanceof MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ success: false, error: 'PDF exceeds maximum size of 10 MB' } satisfies ParseResponse);
            return;
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            res.status(400).json({ success: false, error: 'Only PDF files are allowed' } satisfies ParseResponse);
            return;
          }
          res.status(400).json({ success: false, error: `Upload error: ${err.message}` } satisfies ParseResponse);
          return;
        }
        next(err);
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No PDF file uploaded. Use field name "pdf".',
        } satisfies ParseResponse);
        return;
      }

      const parser = new PDFParse({ data: req.file.buffer });
      const result = await parser.getText();
      const text = sanitizeText(result.text);

      if (!text || text.trim().length === 0) {
        const fallbackText = await extractFallbackText(req.file.buffer);
        if (fallbackText) {
          res.json({
            success: true,
            text: fallbackText,
            pages: result.total,
            warning: 'Standard text extraction returned empty. Used fallback OCR-like extraction.',
          } satisfies ParseResponse);
          return;
        }

        res.status(422).json({
          success: false,
          error: 'Could not extract any text from this PDF. The file may be a scanned image (no selectable text).',
        } satisfies ParseResponse);
        return;
      }

      const info = await parser.getInfo();

      res.json({
        success: true,
        text,
        pages: result.total,
        metadata: extractMetadata(info),
      } satisfies ParseResponse);
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: `PDF parsing failed: ${(error as Error).message || 'Unknown error'}`,
      } satisfies ParseResponse);
    }
  },
);

// ─── POST /api/contract-note/parse-base64 (JSON body) ─────────────────────

router.post('/parse-base64', async (req: Request, res: Response) => {
  try {
    const { base64, filename } = req.body as ParseBase64Body;

    if (!base64 || typeof base64 !== 'string') {
      res.status(400).json({
        success: false,
        error: 'base64 field is required and must be a string',
      } satisfies ParseResponse);
      return;
    }

    let buffer: Buffer;
    try {
      const cleaned = base64.replace(/^data:application\/pdf;base64,/, '');
      buffer = Buffer.from(cleaned, 'base64');
    } catch {
      res.status(400).json({
        success: false,
        error: 'Invalid base64 encoding',
      } satisfies ParseResponse);
      return;
    }

    if (buffer.length === 0) {
      res.status(400).json({ success: false, error: 'Empty PDF data' } satisfies ParseResponse);
      return;
    }

    if (buffer.length > 10 * 1024 * 1024) {
      res.status(413).json({ success: false, error: 'PDF exceeds maximum size of 10 MB' } satisfies ParseResponse);
      return;
    }

    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = sanitizeText(result.text);

    if (!text || text.trim().length === 0) {
      const fallbackText = await extractFallbackText(buffer);
      if (fallbackText) {
        res.json({
          success: true,
          text: fallbackText,
          pages: result.total,
          warning: 'Standard text extraction returned empty. Used fallback extraction.',
        } satisfies ParseResponse);
        return;
      }

      res.status(422).json({
        success: false,
        error: 'Could not extract any text from this PDF. The file may be a scanned image.',
      } satisfies ParseResponse);
      return;
    }

    const info = await parser.getInfo();

    console.log(
      `[ContractNote] Parsed PDF${filename ? ` (${filename})` : ''}: ${result.total} page(s), ${text.length} chars`,
    );

    res.json({
      success: true,
      text,
      pages: result.total,
      metadata: extractMetadata(info),
    } satisfies ParseResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: `PDF parsing failed: ${error.message || 'Unknown error'}`,
    } satisfies ParseResponse);
  }
});

// ─── GET /api/contract-note/status ─────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    available: true,
    maxFileSizeMB: 10,
    supportedFormats: ['pdf'],
    engine: 'pdf-parse',
  });
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function sanitizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')      // Collapse spaces/tabs in one pass
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

/**
 * Extract a normalized metadata object from pdf-parse's getInfo() result.
 * The info property contains standard PDF metadata fields (Title, Author, etc.).
 */
function extractMetadata(infoResult: { info?: Record<string, string>; metadata?: Record<string, string> }): ParseResponse['metadata'] {
  const meta = infoResult.info || infoResult.metadata || {};
  return {
    title: meta['Title'] || meta.title,
    author: meta['Author'] || meta.author,
    subject: meta['Subject'] || meta.subject,
    keywords: meta['Keywords'] || meta.keywords,
    creator: meta['Creator'] || meta.creator,
    producer: meta['Producer'] || meta.producer,
    creationDate: meta['CreationDate'] || meta.creationDate,
    modDate: meta['ModDate'] || meta.modDate,
  };
}

async function extractFallbackText(buffer: Buffer): Promise<string | null> {
  try {
    const raw = buffer.toString('latin1');
    const textBits: string[] = [];
    const textPattern = /\(([^)]*)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    let iterations = 0;

    while ((match = textPattern.exec(raw)) !== null) {
      if (++iterations > 50000) break; // Safety guard
      const bit = match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\([0-7]{1,3})/g, (_m: string, oct: string) =>
          String.fromCharCode(parseInt(oct, 8)),
        )
        .replace(/\\(.)/g, '$1');
      if (bit.trim()) {
        textBits.push(bit);
      }
    }

    if (textBits.length < 5) return null;
    return textBits.join(' ');
  } catch {
    return null;
  }
}

export default router;
