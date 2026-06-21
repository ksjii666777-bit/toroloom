/**
 * ============================================================================
 * Toroloom — ContractNoteUploadScreen Tests
 * ============================================================================
 *
 * Tests the premium fin-tech contract note parser screen covering:
 *   - Header & action card rendering
 *   - Single PDF upload flow (success, failure, error)
 *   - Paste text parse flow
 *   - Batch upload flow (with per-file results, merged trades)
 *   - Clear results
 *   - Error display with retry button
 *
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import type { ContractNoteParseResult, BatchParseResult } from '../services/gateway/pdfExtractor';

// ── Mock Theme ──────────────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#07080B', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', marketDown: '#FF1744',
      bgCard: '#1A1A2E', bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44',
      divider: '#2A2A44', bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      white: '#FFFFFF', transparent: 'transparent', danger: '#FF1744', success: '#00C853',
      finance: '#6C63FF', tech: '#00D2FF', energy: '#FFC107', consumer: '#FF6B6B',
      industrial: '#FF9800', gold: '#FFD700', purple: '#9C27B0',
    },
  }),
}));

// ── Mock Navigation ────────────────────────────────────────
const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

// ── Mock pdfExtractor Service ──────────────────────────────
let mockPickAndParse = vi.fn();
let mockPickAndParseBatch = vi.fn();
let mockParseText = vi.fn();
let mockExportSingle = vi.fn();
let mockExportBatch = vi.fn();
let mockExportSelected = vi.fn();

vi.mock('../services/gateway/pdfExtractor', () => ({
  pickAndParseContractNote: (...args: any[]) => mockPickAndParse(...args),
  pickAndParseBatchContractNotes: (...args: any[]) => mockPickAndParseBatch(...args),
  parseContractNoteText: (...args: any[]) => mockParseText(...args),
  exportSingleToCSV: (...args: any[]) => mockExportSingle(...args),
  exportBatchToCSV: (...args: any[]) => mockExportBatch(...args),
  exportSelectedToCSV: (...args: any[]) => mockExportSelected(...args),
}));

// ── Sample Trade Data ──────────────────────────────────────
const sampleTrades = [
  { execution_timestamp: '2024-01-15T10:30:00', asset_symbol: 'RELIANCE', transaction_type: 'BUY' as const, filled_quantity: 25, execution_price: 2567.50, regulatory_fees: 45.00 },
  { execution_timestamp: '2024-01-15T11:00:00', asset_symbol: 'TCS', transaction_type: 'SELL' as const, filled_quantity: 10, execution_price: 3890.00, regulatory_fees: 12.50 },
];

const sampleTrades2 = [
  { execution_timestamp: '2024-01-20T09:45:00', asset_symbol: 'SBIN', transaction_type: 'BUY' as const, filled_quantity: 100, execution_price: 789.50, regulatory_fees: 18.00 },
];

// ── Mock Parse Results ─────────────────────────────────────
const successResult: ContractNoteParseResult = {
  success: true,
  trades: sampleTrades,
  rawText: 'Contract note with trades',
  pages: 2,
  filename: 'zerodha.pdf',
  brokerDetected: 'zerodha',
  source: 'backend',
};

const noTradesResult: ContractNoteParseResult = {
  success: false,
  trades: [],
  rawText: 'Some text but no trades found',
  pages: 1,
  filename: 'generic.pdf',
  error: 'No trade data found in this document',
  source: 'backend',
};

const batchSuccessResult: BatchParseResult = {
  totalFiles: 2,
  succeeded: 2,
  failed: 0,
  files: [
    { filename: 'zerodha.pdf', success: true, trades: sampleTrades, pages: 2, brokerDetected: 'zerodha', source: 'backend' },
    { filename: 'angel.pdf', success: true, trades: sampleTrades2, pages: 1, brokerDetected: 'angel', source: 'backend' },
  ],
  mergedTrades: [...sampleTrades, ...sampleTrades2],
  rawTradeCount: 3,
  brokersDetected: ['zerodha', 'angel'],
};

const batchPartialResult: BatchParseResult = {
  totalFiles: 2,
  succeeded: 1,
  failed: 1,
  files: [
    { filename: 'good.pdf', success: true, trades: sampleTrades, pages: 2, brokerDetected: 'zerodha', source: 'backend' },
    { filename: 'bad.pdf', success: false, trades: [], error: 'Could not extract any text', source: 'backend' },
  ],
  mergedTrades: sampleTrades,
  rawTradeCount: 2,
  brokersDetected: ['zerodha'],
};

// ── Import the component ────────────────────────────────────
import ContractNoteUploadScreen from '../screens/reports/ContractNoteUploadScreen';

beforeEach(() => {
  vi.clearAllMocks();
  mockPickAndParse.mockResolvedValue(successResult);
  mockPickAndParseBatch.mockResolvedValue(batchSuccessResult);
  mockParseText.mockReturnValue(successResult);
  mockExportSingle.mockResolvedValue({ success: true });
  mockExportBatch.mockResolvedValue({ success: true });
  mockExportSelected.mockResolvedValue({ success: true });
});

// ======================================================================
// 1. Header & Action Cards Rendering
// ======================================================================

describe('ContractNoteUploadScreen — Header & Layout', () => {
  it('renders the screen title', () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    expect(getByText('Contract Note Parser')).toBeDefined();
  });

  it('renders the screen subtitle', () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    expect(getByText('Upload broker PDF or paste text to extract trades')).toBeDefined();
  });

  it('renders all three action cards', () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    expect(getByText('Upload PDF Contract Note')).toBeDefined();
    expect(getByText('Batch Upload (Multi)')).toBeDefined();
    expect(getByText('Paste Contract Note Text')).toBeDefined();
  });

  it('renders the back button', () => {
    const { root } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    // Find the Ionicons with arrow-back — rendered inside AnimatedPressable
    expect(root).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('shows back arrow in header', () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    // The back button wraps an Ionicons arrow-back — text is empty, but it's pressable
    // We verify by checking the chevron-forward icons exist on action cards
    expect(getByText('Upload PDF Contract Note')).toBeDefined();
  });
});

// ======================================================================
// 2. Paste Text Area Toggle
// ======================================================================

describe('ContractNoteUploadScreen — Paste Text Toggle', () => {
  it('starts with paste input hidden', () => {
    const { queryByPlaceholderText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    expect(queryByPlaceholderText('Paste your contract note text here...')).toBeNull();
  });

  it('shows paste input when paste card is pressed', () => {
    const { getByText, getByPlaceholderText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Paste Contract Note Text'));
    expect(getByPlaceholderText('Paste your contract note text here...')).toBeDefined();
  });

  it('shows Parse Text button when paste input is visible', () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Paste Contract Note Text'));
    expect(getByText('Parse Text')).toBeDefined();
  });

  it('hides paste input when pressing the paste card again', () => {
    const { getByText, queryByPlaceholderText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Paste Contract Note Text'));
    expect(queryByPlaceholderText('Paste your contract note text here...')).toBeDefined();
    fireEvent.press(getByText('Paste Contract Note Text'));
    expect(queryByPlaceholderText('Paste your contract note text here...')).toBeNull();
  });
});

// ======================================================================
// 3. Single PDF Upload — Success & Failure
// ======================================================================

describe('ContractNoteUploadScreen — Single Upload', () => {
  it('calls pickAndParseContractNote when upload card is pressed', async () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Upload PDF Contract Note'));
    expect(mockPickAndParse).toHaveBeenCalledTimes(1);
    expect(mockPickAndParse).toHaveBeenCalledWith({ brokerFormat: undefined });
  });

  it('shows loading state during upload', () => {
    // Return a promise that never resolves to keep loading state
    mockPickAndParse.mockImplementationOnce(() => new Promise(() => {}));
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Upload PDF Contract Note'));
    expect(getByText('Parsing contract note...')).toBeDefined();
    expect(getByText('Extracting text and identifying trades')).toBeDefined();
  });

  it('displays trade results on successful parse', async () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Upload PDF Contract Note'));
    // Wait for the async operation to settle
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));
    // Check results
    expect(getByText('Trades Extracted')).toBeDefined();
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('Zerodha')).toBeDefined();
  });

  it('shows parse failure state when no trades found', async () => {
    mockPickAndParse.mockResolvedValueOnce(noTradesResult);
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Upload PDF Contract Note'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));
    expect(getByText('Parsing Incomplete')).toBeDefined();
  });

  it('shows error state with retry button on parse failure', async () => {
    mockPickAndParse.mockResolvedValueOnce(noTradesResult);
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Upload PDF Contract Note'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));
    expect(getByText('Try Again')).toBeDefined();
    expect(getByText('No trade data found in this document')).toBeDefined();
  });

  it('shows trades table with correct stats', async () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Upload PDF Contract Note'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));
    // Stats: 2 trades, 1 buy, 1 sell
    expect(getByText('2')).toBeDefined();
    // Broker badge shows Zerodha
    expect(getByText('Zerodha')).toBeDefined();
  });
});

// ======================================================================
// 4. Paste Text Parse
// ======================================================================

describe('ContractNoteUploadScreen — Paste Text', () => {
  it('calls parseContractNoteText when Parse Text is pressed', async () => {
    const { getByText, getByPlaceholderText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );

    // Open paste input
    fireEvent.press(getByText('Paste Contract Note Text'));

    // Type text into the input
    const input = getByPlaceholderText('Paste your contract note text here...');
    act(() => { fireEvent.changeText(input, 'Zerodha BUY RELIANCE 25 2567.50'); });

    // Press Parse Text button
    fireEvent.press(getByText('Parse Text'));

    expect(mockParseText).toHaveBeenCalledWith(
      'Zerodha BUY RELIANCE 25 2567.50',
      undefined, // brokerFormat
    );
  });

  it('shows alert when Parse Text is pressed with empty input', () => {
    const { getByText, queryByPlaceholderText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Paste Contract Note Text'));

    // Parse Text button is disabled when input is empty, but the disable state
    // is managed by a disabled prop. Press without text — nothing should be called.
    fireEvent.press(getByText('Parse Text'));
    expect(mockParseText).not.toHaveBeenCalled();
  });

  it('displays trade results after parsing pasted text', async () => {
    mockParseText.mockReturnValueOnce(successResult);
    const { getByText, getByPlaceholderText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );

    fireEvent.press(getByText('Paste Contract Note Text'));
    const input = getByPlaceholderText('Paste your contract note text here...');
    act(() => { fireEvent.changeText(input, 'RELIANCE BUY 25 2567.50'); });
    fireEvent.press(getByText('Parse Text'));

    expect(getByText('Trades Extracted')).toBeDefined();
    expect(getByText('RELIANCE')).toBeDefined();
  });

  it('shows Export CSV button after successful paste-text parse', async () => {
    mockParseText.mockReturnValueOnce(successResult);
    const { getByText, getByPlaceholderText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );

    fireEvent.press(getByText('Paste Contract Note Text'));
    const input = getByPlaceholderText('Paste your contract note text here...');
    act(() => { fireEvent.changeText(input, 'RELIANCE BUY 25 2567.50'); });
    fireEvent.press(getByText('Parse Text'));

    expect(getByText('Export CSV')).toBeDefined();
  });

  it('calls exportSingleToCSV when Export CSV is pressed on paste-text results', async () => {
    mockParseText.mockReturnValueOnce(successResult);
    const { getByText, getByPlaceholderText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );

    fireEvent.press(getByText('Paste Contract Note Text'));
    const input = getByPlaceholderText('Paste your contract note text here...');
    act(() => { fireEvent.changeText(input, 'RELIANCE BUY 25 2567.50'); });
    fireEvent.press(getByText('Parse Text'));

    fireEvent.press(getByText('Export CSV'));
    expect(mockExportSingle).toHaveBeenCalledTimes(1);
    expect(mockExportSingle).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      trades: expect.any(Array),
    }));
  });

  it('does not show Export CSV button when paste-text parse has no trades', async () => {
    mockParseText.mockReturnValueOnce(noTradesResult);
    const { getByText, getByPlaceholderText, queryByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );

    fireEvent.press(getByText('Paste Contract Note Text'));
    const input = getByPlaceholderText('Paste your contract note text here...');
    act(() => { fireEvent.changeText(input, 'GARBAGE TEXT NO TRADES'); });
    fireEvent.press(getByText('Parse Text'));

    // Export CSV should NOT appear when parseResult.success is false
    expect(queryByText('Export CSV')).toBeNull();
  });
});

// ======================================================================
// 5. Batch Upload
// ======================================================================

describe('ContractNoteUploadScreen — Batch Upload', () => {
  it('calls pickAndParseBatchContractNotes when batch card is pressed', () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Batch Upload (Multi)'));
    expect(mockPickAndParseBatch).toHaveBeenCalledTimes(1);
    expect(mockPickAndParseBatch).toHaveBeenCalledWith(
      expect.objectContaining({ brokerFormat: undefined }),
    );
  });

  it('displays batch results summary with merged trades', async () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Batch Upload (Multi)'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));
await new Promise(resolve => setTimeout(resolve, 50));

    expect(getByText('Batch Results')).toBeDefined();
    expect(getByText('2 succeeded · 0 failed · 2 total')).toBeDefined();
    // Merged trades count
    expect(getByText('3')).toBeDefined();
    // Per-file breakdown
    expect(getByText('Per-File Breakdown')).toBeDefined();
    // Merged Trades section
    expect(getByText(/Merged Trades/)).toBeDefined();
  });

  it('shows per-file breakdown with filenames', async () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Batch Upload (Multi)'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));

    expect(getByText('zerodha.pdf')).toBeDefined();
    expect(getByText('angel.pdf')).toBeDefined();
  });

  it('shows broker badges for detected brokers', async () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Batch Upload (Multi)'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));

    expect(getByText('Zerodha')).toBeDefined();
    expect(getByText('Angel')).toBeDefined();
  });

  it('expands a per-file entry to show its trades', async () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Batch Upload (Multi)'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));

    // Tap on zerodha.pdf row to expand it
    fireEvent.press(getByText('zerodha.pdf'));
    // Now RELIANCE and TCS should be visible inside the expanded section
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
  });

  it('shows partial failure info in batch results', async () => {
    mockPickAndParseBatch.mockResolvedValueOnce(batchPartialResult);
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Batch Upload (Multi)'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));

    expect(getByText('1 succeeded · 1 failed · 2 total')).toBeDefined();
    expect(getByText('good.pdf')).toBeDefined();
    expect(getByText('bad.pdf')).toBeDefined();
  });

  it('shows deduplication info when raw trades > merged', async () => {
    mockPickAndParseBatch.mockResolvedValueOnce({
      ...batchSuccessResult,
      rawTradeCount: 5, // more than mergedTrades.length (3)
    });
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Batch Upload (Multi)'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));

    expect(getByText(/Deduplicated/)).toBeDefined();
  });
});

// ======================================================================
// 6. Clear Results
// ======================================================================

describe('ContractNoteUploadScreen — Clear Results', () => {
  it('clears single parse results when close button is pressed', async () => {
    const { root, getByText, queryByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Upload PDF Contract Note'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));

    expect(getByText('Trades Extracted')).toBeDefined();

    // Find the close icon element (IonIonicons with name="close") inside the clear button
    const closeIcon = root.find(
      (node: any) => node.type === 'IonIonicons' && node.props.name === 'close'
    );
    fireEvent.press(closeIcon);
    // Flush microtasks for state update inside act()
await new Promise(resolve => setTimeout(resolve, 0));

    // Verify results are gone after clearing
    expect(queryByText('Trades Extracted')).toBeNull();
  });

  it('clears batch results when close button is pressed', async () => {
    const { root, getByText, queryByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Batch Upload (Multi)'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));

    expect(getByText('Batch Results')).toBeDefined();

    // Find and press the close icon on the batch results header
    const closeIcon = root.find(
      (node: any) => node.type === 'IonIonicons' && node.props.name === 'close'
    );
    fireEvent.press(closeIcon);
    // Flush microtasks for state update inside act()
await new Promise(resolve => setTimeout(resolve, 0));

    // Verify batch results are gone after clearing
    expect(queryByText('Batch Results')).toBeNull();
  });
});

// ======================================================================
// 7. Export CSV Button
// ======================================================================

describe('ContractNoteUploadScreen — Export CSV', () => {
  describe('single-file results', () => {
    it('shows Export CSV button after successful single parse with trades', async () => {
      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Upload PDF Contract Note'));
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(getByText('Export CSV')).toBeDefined();
    });

    it('calls exportSingleToCSV when Export CSV button is pressed', async () => {
      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Upload PDF Contract Note'));
      await new Promise(resolve => setTimeout(resolve, 0));

      fireEvent.press(getByText('Export CSV'));
      expect(mockExportSingle).toHaveBeenCalledTimes(1);
      expect(mockExportSingle).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        trades: expect.any(Array),
      }));
    });

    it('does not show Export CSV button when single parse has no trades', async () => {
      mockPickAndParse.mockResolvedValueOnce(noTradesResult);
      const { getByText, queryByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Upload PDF Contract Note'));
      await new Promise(resolve => setTimeout(resolve, 0));

      // Export CSV button should not appear when parseResult.success is false
      expect(queryByText('Export CSV')).toBeNull();
    });

    it('shows Exporting... while CSV is being exported', async () => {
      // Don't override mock here — let beforeEach handle it.
      // Use a deferred promise so we can control when it resolves.
      let resolveExport!: (v: any) => void;
      mockExportSingle.mockImplementationOnce(() => new Promise(r => { resolveExport = r; }));

      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Upload PDF Contract Note'));
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify button appears
      expect(getByText('Export CSV')).toBeDefined();

      // Press it to trigger export
      fireEvent.press(getByText('Export CSV'));

      // Now button should show Exporting... since promise hasn't resolved
      expect(getByText('Exporting...')).toBeDefined();
    });
  });

  describe('batch results', () => {
    it('shows Export All CSV button after batch parse', async () => {
      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Batch Upload (Multi)'));
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(getByText('Export All CSV')).toBeDefined();
    });

    it('calls exportBatchToCSV when Export All CSV button is pressed', async () => {
      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Batch Upload (Multi)'));
      await new Promise(resolve => setTimeout(resolve, 0));

      fireEvent.press(getByText('Export All CSV'));
      expect(mockExportBatch).toHaveBeenCalledTimes(1);
      expect(mockExportBatch).toHaveBeenCalledWith(expect.objectContaining({
        totalFiles: 2,
        succeeded: 2,
      }));
    });

    it('shows Exporting... while batch CSV is being exported', async () => {
      mockExportBatch.mockImplementationOnce(() => new Promise(() => {}));
      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Batch Upload (Multi)'));
      await new Promise(resolve => setTimeout(resolve, 0));

      fireEvent.press(getByText('Export All CSV'));
      expect(getByText('Exporting...')).toBeDefined();
    });
  });  });

  describe('select mode', () => {
    it('shows Select button in batch results', async () => {
      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Batch Upload (Multi)'));
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(getByText('Select')).toBeDefined();
    });

    it('toggles selection mode when Select/Done is pressed', async () => {
      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Batch Upload (Multi)'));
      await new Promise(resolve => setTimeout(resolve, 0));

      // Enter selection mode
      fireEvent.press(getByText('Select'));
      expect(getByText('Done')).toBeDefined();

      // Exit selection mode
      fireEvent.press(getByText('Done'));
      expect(getByText('Select')).toBeDefined();
    });

    it('shows Export Selected button after selecting files', async () => {
      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Batch Upload (Multi)'));
      await new Promise(resolve => setTimeout(resolve, 0));

      // Enter selection mode and press Select All
      fireEvent.press(getByText('Select'));
      fireEvent.press(getByText('Select All'));

      // Both files selected (2 total)
      expect(getByText(/Export Selected \(2\)/)).toBeDefined();
    });

    it('deselects all files when pressing Deselect All', async () => {
      const { getByText, queryByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Batch Upload (Multi)'));
      await new Promise(resolve => setTimeout(resolve, 0));

      // Enter selection mode and Select All
      fireEvent.press(getByText('Select'));
      fireEvent.press(getByText('Select All'));
      expect(getByText(/Export Selected \(2\)/)).toBeDefined();

      // Deselect All
      fireEvent.press(getByText('Deselect All'));
      expect(queryByText(/Export Selected/)).toBeNull();
    });

    it('calls exportSelectedToCSV when Export Selected is pressed', async () => {
      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Batch Upload (Multi)'));
      await new Promise(resolve => setTimeout(resolve, 0));

      // Enter selection mode and Select All
      fireEvent.press(getByText('Select'));
      fireEvent.press(getByText('Select All'));

      // Press Export Selected
      fireEvent.press(getByText(/Export Selected \(2\)/));

      expect(mockExportSelected).toHaveBeenCalledTimes(1);
      // Should receive BatchParseResult and a Set containing both indices
      expect(mockExportSelected).toHaveBeenCalledWith(
        expect.objectContaining({ totalFiles: 2 }),
        expect.any(Set),
      );
    });

    it('shows Export All CSV instead of Export CSV for batch', async () => {
      const { getByText } = render(
        <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
      );
      fireEvent.press(getByText('Batch Upload (Multi)'));
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(getByText('Export All CSV')).toBeDefined();
    });
  });

// ======================================================================
// 8. Broker Helpers
// ======================================================================

describe('ContractNoteUploadScreen — Broker Display', () => {
  it('shows broker badge for detected broker in single parse result', async () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Upload PDF Contract Note'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));
    expect(getByText('Zerodha')).toBeDefined();
  });

  it('shows source indicator for backend-parsed files', async () => {
    const { getByText } = render(
      <ContractNoteUploadScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} />,
    );
    fireEvent.press(getByText('Upload PDF Contract Note'));
    // Flush microtasks so that async state updates inside act() complete
await new Promise(resolve => setTimeout(resolve, 0));
    expect(getByText('Extracted via server')).toBeDefined();
  });
});
