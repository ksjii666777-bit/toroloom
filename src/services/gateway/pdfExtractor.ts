/**
 * ============================================================================
 * Toroloom — PDF Contract Note Extractor Service
 * ============================================================================
 *
 * Handles the complete flow of picking a PDF contract note from the device,
 * uploading it to the backend for text extraction, and piping the result
 * into the tradeLedgerParser for structured trade parsing.
 *
 * Usage:
 *   import { pickAndParseContractNote } from
 *     '../../services/gateway/pdfExtractor';
 *
 *   const result = await pickAndParseContractNote();
 *   if (result.success) {
 *     console.log(result.trades);       // ParsedTrade[]
 *     console.log(result.pages);        // Number of PDF pages
 *   }
 *
 * ============================================================================
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from '../api/client';
import { parseContractNote } from './tradeLedgerParser';
import type { ParsedTrade } from '../../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ContractNoteParseResult {
  success: boolean;
  trades: ParsedTrade[];
  rawText?: string;
  pages?: number;
  filename?: string;
  brokerDetected?: string;
  error?: string;
  /** How the text was obtained: 'backend' | 'fallback_local' */
  source?: 'backend' | 'fallback_local';
}

export interface ContractNoteParseOptions {
  /** Broker format hint (e.g. 'zerodha', 'angel', 'icici_direct') */
  brokerFormat?: string;
  /** Show system file picker (default: true) */
  showPicker?: boolean;
  /** Pre-loaded PDF URI (skip picker) */
  preloadedUri?: string;
  /** Progress callback for batch processing (current, total, filename) */
  onProgress?: (current: number, total: number, filename: string) => void;
}

/**
 * Result of a file export operation.
 */
export interface ExportResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * A single file's result in a batch parse operation.
 */
export interface BatchFileResult {
  filename: string;
  success: boolean;
  trades: ParsedTrade[];
  pages?: number;
  brokerDetected?: string;
  error?: string;
  source?: 'backend' | 'fallback_local';
}

/**
 * Aggregate result from batch-processing multiple PDF contract notes.
 */
export interface BatchParseResult {
  /** Total files submitted */
  totalFiles: number;
  /** Number of files that parsed successfully (at least 1 trade found) */
  succeeded: number;
  /** Number of files that failed or returned 0 trades */
  failed: number;
  /** Per-file breakdown */
  files: BatchFileResult[];
  /** Merged, deduplicated trades across all files */
  mergedTrades: ParsedTrade[];
  /** Total raw trade count before dedup */
  rawTradeCount: number;
  /** Broker formats detected across files */
  brokersDetected: string[];
}

// ─── Core Public API ───────────────────────────────────────────────────────

/**
 * Open the device file picker, let the user select a PDF contract note,
 * upload it to the backend for text extraction, parse the text into
 * structured trades via tradeLedgerParser, and return the results.
 *
 * This is the primary entry point for the contract note upload flow.
 */
export async function pickAndParseContractNote(
  options: ContractNoteParseOptions = {},
): Promise<ContractNoteParseResult> {
  const { brokerFormat, showPicker = true, preloadedUri } = options;

  // ── Step 1: Pick the PDF file ──────────────────────────────────
  let pdfUri: string;
  let pdfName: string | undefined;

  if (preloadedUri) {
    pdfUri = preloadedUri;
    pdfName = 'contract_note.pdf';
  } else if (showPicker) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { success: false, trades: [], error: 'User cancelled file selection' };
      }

      const asset = result.assets[0];
      pdfUri = asset.uri;
      pdfName = asset.name || 'contract_note.pdf';
    } catch (error: any) {
      return {
        success: false,
        trades: [],
        error: `File picker error: ${error.message || 'Unknown error'}`,
      };
    }
  } else {
    return { success: false, trades: [], error: 'No PDF URI provided and picker disabled' };
  }

  // ── Step 2: Read the PDF as base64 ────────────────────────────
  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(pdfUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (error: any) {
    return {
      success: false,
      trades: [],
      error: `Failed to read PDF file: ${error.message || 'File system error'}`,
    };
  }

  // ── Step 3: Upload to backend for text extraction ────────────
  try {
    const response = await api.post<BackendParseResponse>(
      '/contract-note/parse-base64',
      { base64, filename: pdfName },
      { skipAuth: true }, // No auth needed for document parsing
    );

    const rawText = response.text;
    const pages = response.pages;

    if (!rawText || rawText.trim().length === 0) {
      return {
        success: false,
        trades: [],
        rawText: '',
        pages,
        filename: pdfName,
        error: 'Backend returned empty text from PDF. The file may be a scanned image.',
      };
    }

    // ── Step 4: Parse the extracted text into trades ────────────
    const trades = parseContractNote(rawText, brokerFormat);

    // Detect which broker format was matched
    const brokerDetected = detectBrokerFromText(rawText);

    return {
      success: trades.length > 0,
      trades,
      rawText,
      pages,
      filename: pdfName,
      brokerDetected,
      source: 'backend',
    };
  } catch (error: any) {
    // ── Step 3b: Backend unavailable — use local fallback ──────
    // Try parsing the raw base64 as text (some PDFs have plaintext content
    // that pdf-parse would extract, but we can try a basic local fallback)
    const fallbackText = await fallbackLocalExtract(pdfUri);

    if (fallbackText) {
      const trades = parseContractNote(fallbackText, brokerFormat);
      const brokerDetected = detectBrokerFromText(fallbackText);

      if (trades.length > 0) {
        return {
          success: true,
          trades,
          rawText: fallbackText,
          filename: pdfName,
          brokerDetected,
          source: 'fallback_local',
          error: undefined,
        };
      }
    }

    return {
      success: false,
      trades: [],
      error: `Failed to parse PDF: ${error.message || 'Backend unavailable'}. ` +
        'Make sure the backend server is running.',
    };
  }
}

/**
 * Open the device file picker in multi-select mode, process several PDF
 * contract notes sequentially, and return merged results with per-file
 * breakdown.
 *
 * Each file is processed through the same backend extraction + parser
 * pipeline as the single-file flow. Results are merged and deduplicated
 * by trade ID (or timestamp + symbol combination).
 *
 * Processing order: files are picked (multi-select) then processed in
 * parallel batches to minimize total wait time.
 */
export async function pickAndParseBatchContractNotes(
  options: ContractNoteParseOptions = {},
): Promise<BatchParseResult> {
  const { brokerFormat } = options;

  // ── Step 1: Pick multiple PDFs ────────────────────────────────
  let assets: DocumentPicker.DocumentPickerAsset[];

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return {
        totalFiles: 0,
        succeeded: 0,
        failed: 0,
        files: [],
        mergedTrades: [],
        rawTradeCount: 0,
        brokersDetected: [],
      };
    }

    assets = result.assets;
  } catch (error: any) {
    return {
      totalFiles: 1,
      succeeded: 0,
      failed: 1,
      files: [{ filename: 'unknown', success: false, trades: [], error: `Picker error: ${error.message || 'Unknown'}` }],
      mergedTrades: [],
      rawTradeCount: 0,
      brokersDetected: [],
    };
  }

  // ── Step 2: Process all files sequentially ───────────────────
  // Sequential processing avoids rate limits and gives clean progress
  // reporting. Each file goes through the full backend pipeline.
  const fileResults: BatchFileResult[] = [];
  const allTrades: ParsedTrade[] = [];
  const brokerSet = new Set<string>();

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const displayName = asset.name || `file_${i + 1}.pdf`;

    // Report progress before processing each file
    options.onProgress?.(i + 1, assets.length, displayName);

    const singleResult = await pickAndParseContractNote({
      brokerFormat,
      showPicker: false,
      preloadedUri: asset.uri,
    });

    fileResults.push({
      filename: singleResult.filename || displayName,
      success: singleResult.success,
      trades: singleResult.trades,
      pages: singleResult.pages,
      brokerDetected: singleResult.brokerDetected,
      error: singleResult.error,
      source: singleResult.source,
    });

    if (singleResult.brokerDetected) brokerSet.add(singleResult.brokerDetected);
    allTrades.push(...singleResult.trades);
  }

  // ── Step 3: Deduplicate merged trades ────────────────────────
  const mergedTrades = deduplicateTrades(allTrades);

  const succeeded = fileResults.filter(r => r.success).length;
  const failed = fileResults.filter(r => !r.success).length;

  return {
    totalFiles: assets.length,
    succeeded,
    failed,
    files: fileResults,
    mergedTrades,
    rawTradeCount: allTrades.length,
    brokersDetected: Array.from(brokerSet),
  };
}

/**
 * Parse a pre-loaded raw text string (e.g. from an email attachment or
 * pasted text) directly through the tradeLedgerParser without uploading.
 */
export function parseContractNoteText(
  text: string,
  brokerFormat?: string,
): ContractNoteParseResult {
  if (!text || text.trim().length === 0) {
    return { success: false, trades: [], error: 'Empty text provided' };
  }

  const trades = parseContractNote(text, brokerFormat);
  const brokerDetected = detectBrokerFromText(text);

  return {
    success: trades.length > 0,
    trades,
    rawText: text,
    brokerDetected,
    source: 'fallback_local',
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Detect which broker format the text matches by scanning for brand names.
 */
function detectBrokerFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('zerodha')) return 'zerodha';
  if (lower.includes('angel broking') || lower.includes('angel one')) return 'angel';
  if (lower.includes('groww') || lower.includes('nextbillion')) return 'groww';
  if (lower.includes('icici direct') || lower.includes('icici securities')) return 'icici_direct';
  if (lower.includes('hdfc securities') || lower.includes('hdfcsec')) return 'hdfc_securities';
  if (lower.includes('kotak') && (lower.includes('securities') || lower.includes('mahindra'))) return 'kotak_securities';
  return undefined;
}

/**
 * Deduplicate an array of parsed trades by (timestamp + symbol + type).
 * Keeps the first occurrence and discards exact duplicates.
 */
function deduplicateTrades(trades: ParsedTrade[]): ParsedTrade[] {
  const seen = new Set<string>();
  return trades.filter(t => {
    const key = `${t.execution_timestamp}|${t.asset_symbol}|${t.transaction_type}|${t.filled_quantity}|${t.execution_price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fallback local extraction — tries to read the file as plain text
 * in case the PDF is actually a text file or has embedded text.
 */
async function fallbackLocalExtract(uri: string): Promise<string | null> {
  try {
    // Try reading as UTF-8 (works for some simple PDFs with embedded text)
    const text = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Check if the extracted content has any recognizable trade data
    if (text && text.length > 50) {
      // Remove PDF binary garbage and keep only readable text
      const cleaned = text
        .replace(/[^\x20-\x7E\n\r]/g, ' ')   // Remove non-printable chars
        .replace(/\s+/g, ' ')                  // Collapse whitespace
        .trim();

      // Check if cleaned text has timestamp patterns
      if (/\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}/.test(cleaned)) {
        return cleaned;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── CSV Export Helpers ────────────────────────────────────────────────────

/** CSV-escape a field value */
function csvField(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV row from values */
function csvRow(...vals: (string | number)[]): string {
  return vals.map(v => csvField(v)).join(',') + '\n';
}

/** Generate a unique filename with timestamp */
function generateFilename(extension: string, prefix: string = 'ContractNotes'): string {
  const date = new Date().toISOString().slice(0, 10);
  const time = Date.now().toString(36).slice(-6).toUpperCase();
  return `${prefix}_${date}_${time}.${extension}`;
}

/**
 * Share a file via the OS share sheet.
 */
async function shareFile(filePath: string, mimeType: string): Promise<ExportResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { success: false, error: 'Sharing is not available on this device' };
    }
    await Sharing.shareAsync(filePath, { mimeType });
    return { success: true, path: filePath };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error sharing file';
    return { success: false, error: msg };
  }
}

// ─── Public Export API ───────────────────────────────────────────────────────

/**
 * Export a single-file parse result as a CSV file and open the OS share sheet.
 *
 * The CSV contains:
 *   - A header row with summary metadata (trades, broker, source)
 *   - One row per parsed trade
 *   - Raw extracted text in a reference section
 */
export async function exportSingleToCSV(
  result: ContractNoteParseResult,
): Promise<ExportResult> {
  try {
    let csv = '';

    // ── File Summary ──
    csv += 'Toroloom Contract Notes - Parse Results\n';
    csv += csvRow('Generated', new Date().toLocaleString('en-IN'));
    csv += csvRow('Filename', result.filename || 'N/A');
    csv += csvRow('Status', result.success ? 'Success' : 'Failed');
    csv += csvRow('Trades Found', result.trades.length);
    if (result.brokerDetected) csv += csvRow('Broker', brokerLabel(result.brokerDetected));
    if (result.pages) csv += csvRow('Pages', result.pages);
    csv += csvRow('Source', result.source === 'backend' ? 'Server extraction' : 'Local fallback');
    if (result.error) csv += csvRow('Error', result.error);
    csv += '\n';

    // ── Trades Table ──
    csv += '=== TRADES ===\n';
    csv += csvRow('Timestamp', 'Symbol', 'Type', 'Quantity', 'Price', 'Fees', 'Exchange', 'Trade ID');
    for (const t of result.trades) {
      csv += csvRow(
        t.execution_timestamp,
        t.asset_symbol,
        t.transaction_type,
        t.filled_quantity,
        t.execution_price.toFixed(2),
        t.regulatory_fees.toFixed(2),
        t.exchange || '',
        t.trade_id || '',
      );
    }

    // ── Raw Text Reference ──
    if (result.rawText) {
      csv += '\n';
      csv += '=== RAW TEXT ===\n';
      // Truncate very long raw text to 10k chars to keep CSV manageable
      const truncated = result.rawText.length > 10000
        ? result.rawText.slice(0, 10000) + `\n[... truncated, original length: ${result.rawText.length} chars]`
        : result.rawText;
      csv += truncated + '\n';
    }

    // ── Write to file and share ──
    const filename = generateFilename('csv', 'ContractNote');
    const cacheDir = (FileSystem as { cacheDirectory?: string }).cacheDirectory ?? '.';
    const filePath = `${cacheDir}/${filename}`;

    await FileSystem.writeAsStringAsync(filePath, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return await shareFile(filePath, 'text/csv');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error generating CSV';
    return { success: false, error: msg };
  }
}

/**
 * Export merged batch parse results as a CSV file and open the OS share sheet.
 *
 * The CSV contains:
 *   - A header row with batch summary metadata
 *   - One row per merged trade (deduplicated)
 *   - A per-file breakdown section with source file info
 */
export async function exportBatchToCSV(
  batchResult: BatchParseResult,
): Promise<ExportResult> {
  return internalExportBatchCSV(batchResult);
}

/**
 * Export only the selected files from a batch result as a CSV file.
 *
 * Same format as exportBatchToCSV but only includes data from files whose
 * indices are in the `selectedIndices` set.
 */
export async function exportSelectedToCSV(
  batchResult: BatchParseResult,
  selectedIndices: Set<number>,
): Promise<ExportResult> {
  return internalExportBatchCSV(batchResult, selectedIndices);
}

/**
 * Internal: generate batch CSV, optionally filtering to selected file indices.
 */
async function internalExportBatchCSV(
  batchResult: BatchParseResult,
  selectedIndices?: Set<number>,
): Promise<ExportResult> {
  const files = selectedIndices
    ? batchResult.files.filter((_, i) => selectedIndices.has(i))
    : batchResult.files;

  // Collect trades from selected files
  const selectedTrades: ParsedTrade[] = [];
  for (const f of files) {
    selectedTrades.push(...f.trades);
  }

  try {
    let csv = '';

    // ── Batch Summary ──
    csv += 'Toroloom Contract Notes - Batch Results' + (selectedIndices ? ' (Selected Files)' : '') + '\n';
    csv += csvRow('Generated', new Date().toLocaleString('en-IN'));
    csv += csvRow('Files Selected', selectedIndices ? files.length : batchResult.totalFiles);
    csv += csvRow('Files Processed', batchResult.totalFiles);
    csv += csvRow('Succeeded', batchResult.succeeded);
    csv += csvRow('Failed', batchResult.failed);
    csv += csvRow('Total Trades (selected)', selectedTrades.length);
    csv += csvRow('Brokers Detected', batchResult.brokersDetected.join(', ') || 'None');
    csv += '\n';

    // ── Selected Trades ──
    csv += '=== SELECTED TRADES ===\n';
    csv += csvRow('Timestamp', 'Symbol', 'Type', 'Quantity', 'Price', 'Fees', 'Exchange', 'Trade ID', 'Source File');
    for (const f of files) {
      for (const t of f.trades) {
        csv += csvRow(
          t.execution_timestamp,
          t.asset_symbol,
          t.transaction_type,
          t.filled_quantity,
          t.execution_price.toFixed(2),
          t.regulatory_fees.toFixed(2),
          t.exchange || '',
          t.trade_id || '',
          f.filename,
        );
      }
    }
    csv += '\n';

    // ── Per-File Trade Details ──
    csv += '=== PER-FILE TRADE DETAILS ===\n';
    for (const f of files) {
      if (f.trades.length === 0) continue;
      csv += `\n--- ${f.filename} ---\n`;
      csv += csvRow('Timestamp', 'Symbol', 'Type', 'Quantity', 'Price', 'Fees');
      for (const t of f.trades) {
        csv += csvRow(
          t.execution_timestamp,
          t.asset_symbol,
          t.transaction_type,
          t.filled_quantity,
          t.execution_price.toFixed(2),
          t.regulatory_fees.toFixed(2),
        );
      }
    }

    // ── Write to file and share ──
    const filename = selectedIndices
      ? generateFilename('csv', 'ContractNotes_Selected')
      : generateFilename('csv');
    const cacheDir = (FileSystem as { cacheDirectory?: string }).cacheDirectory ?? '.';
    const filePath = `${cacheDir}/${filename}`;

    await FileSystem.writeAsStringAsync(filePath, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return await shareFile(filePath, 'text/csv');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error generating CSV';
    return { success: false, error: msg };
  }
}



// ─── Helper for broker labels (also used in CSV export) ───────────────────

/** Convert a broker key to a human-readable label */
function brokerLabel(broker: string): string {
  return broker
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Backend API Response Type ────────────────────────────────────────────

interface BackendParseResponse {
  success: boolean;
  text: string;
  pages?: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modDate?: string;
  };
  warning?: string;
}
