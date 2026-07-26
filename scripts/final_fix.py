"""
Final fix: Update resolveT to handle missing namespaces AND add missing translation keys.
"""
import os

# Fix the resolveT function in each file to handle missing namespaces
# Change: "if (!obj) return key;" -> let it fall through to the fallback

# And add the missing keys to the reports dict

OLD_IF_NOT_OBJ = """  if (!obj) {
    const lastSeg = key;
    return lastSeg
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s: string) => s.toUpperCase())
      .trim();
  }"""

NEW_IF_NOT_OBJ = """  if (!obj) {
    const parts2 = key.split('.');
    const lastSeg = parts2[parts2.length - 1] || key;
    return lastSeg
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s: string) => s.toUpperCase())
      .trim();
  }"""

# Missing reports keys to add (between "filter" and "downloadPdf" in the reports dict)
OLD_REPORTS_FILTER = """    'filter': 'Filter',
    'downloadPdf': 'Download PDF',"""

NEW_REPORTS_FILTER = """    'filter': 'Filter',
    'contractNoteParser': 'Contract Note Parser',
    'contractNoteParserSub': 'Upload broker PDF or paste text to extract trades',
    'uploadPDF': 'Upload PDF Contract Note',
    'uploadPDFSub': 'Upload a PDF contract note to parse trades',
    'batchUpload': 'Batch Upload (Multi)',
    'batchUploadSub': 'Upload multiple contract notes at once',
    'pasteText': 'Paste Contract Note Text',
    'pasteTextSub': 'Paste contract note text to parse trades',
    'parseText': 'Parse Text',
    'pastePlaceholder': 'Paste contract note text here...',
    'parsingNote': 'Parsing contract note...',
    'extractingText': 'Extracting trade data...',
    'batchProcessing': 'Processing batch...',
    'batchResults': 'Batch Results',
    'resultSummary': '{{succeeded}}/{{total}} files parsed',
    'merged': 'Merged',
    'parseFailed': 'Parse Failed',
    'noTradesDoc': 'No trades found in document',
    'noTradesFound': 'No Trades Found',
    'noTradesPasted': 'No trades could be extracted from the pasted text.',
    'openingPicker': 'Opening file picker...',
    'selectPDFs': 'Select PDF files to upload',
    'processingFile': 'Processing {{current}}/{{total}}: {{filename}}',
    'batchComplete': 'Batch Complete',
    'batchSummary': '{{succeeded}} files succeeded, {{failed}} failed',
    'batchFailed': 'Failed to process batch',
    'exportFailed': 'Export Failed',
    'exportFailedMsg': 'Failed to export file',
    'exportFailedUnexpected': 'Unexpected export error',
    'emptyTitle': 'No Content',
    'emptyMsg': 'No content to parse',
    'analytics': 'Analytics',
    'live': 'LIVE',
    'subtitle': 'Advanced portfolio intelligence',
    'portfolioValue': 'Portfolio Value',
    'totalReturn': 'Total Return',
    'winRate': 'Win Rate',
    'sharpe': 'Sharpe',
    'maxDD': 'Max DD',
    'holdings': 'Holdings',
    'tabPnl': 'P&L',
    'tabPerformance': 'Performance',
    'tabTax': 'Tax',
    'tabHoldings': 'Holdings',
    'tabHistory': 'History',
    'pnlOverTime': 'P&L Over Time',
    'realizedPnl': 'Realized P&L',
    'unrealizedPnl': 'Unrealized P&L',
    'todaysPerformance': "Today's Performance",
    'dayChange': 'Day Change',
    'dayReturn': 'Day Return',
    'monthlyReturns': 'Monthly Returns',
    'riskAndReturn': 'Risk & Return',
    'returnPercent': 'Return %',
    'fromClosed': 'From closed positions',
    'fromOpen': 'From open positions',
    'reportExported': 'Report Exported',
    'reportExportedMsg': 'Report exported as {{format}}',
    'exportError': 'Export Error',
    'exportErrorMsg': 'Could not export report. Try again.',
    'addAlertFor': 'Add price alert for {{symbol}}?',
    'alertAdded': 'Alert Added',
    'dayGainAlertCreated': 'Day gain alert created for {{symbol}}',
    'pnlAlertCreated': 'P&L alert created for {{symbol}}',
    'downloadPdf': 'Download PDF',"""

files = [
    'IPODashboardScreen.test.tsx',
    'ProfileScreen.test.tsx',
    'PlaceOrderScreen.test.tsx',
    'PlaceOrderScreenFrozenFix.test.tsx',
    'CommunityCoursesScreen.test.tsx',
    'MyCoursesScreen.test.tsx',
    'CourseDetailScreen.test.tsx',
    'LearningPathsScreen.test.tsx',
    'ContractNoteUploadScreen.test.tsx',
    'ReportsScreen.test.tsx',
]

test_dir = 'src/__tests__'

# First: Fix the if (!obj) return key; in ALL files
fixed_1 = 0
for fname in files:
    fp = os.path.join(test_dir, fname)
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if OLD_IF_NOT_OBJ in content:
        content = content.replace(OLD_IF_NOT_OBJ, NEW_IF_NOT_OBJ)
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  FIXED (fallback): {fname}')
        fixed_1 += 1
    else:
        print(f'  SKIP (pattern not found): {fname}')

print(f'\nFallback fix: {fixed_1} files updated')

# Second: Add missing reports keys to ContractNoteUploadScreen and ReportsScreen
fixed_2 = 0
for fname in ['ContractNoteUploadScreen.test.tsx', 'ReportsScreen.test.tsx']:
    fp = os.path.join(test_dir, fname)
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if OLD_REPORTS_FILTER in content:
        content = content.replace(OLD_REPORTS_FILTER, NEW_REPORTS_FILTER)
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  FIXED (reports keys): {fname}')
        fixed_2 += 1
    else:
        print(f'  SKIP (pattern not found in reports): {fname}')

# Third: Add 'addFunds' to the profile dict in ProfileScreen.test.tsx
# by adding it to the profile dict
for fname in ['ProfileScreen.test.tsx']:
    fp = os.path.join(test_dir, fname)
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add 'addFunds' key to the profile dict and fix PAN Verification
    old_kv = "'homeWidget': 'Home Widget',"
    new_kv = "'homeWidget': 'Home Widget',\n    'addFunds': 'Add Funds',\n    'panVerification': 'PAN Verification',\n    'aadhaarVerification': 'Aadhaar Verification',\n    'digilocker': 'DigiLocker',\n    'bankLinking': 'Bank Linking',"
    
    if old_kv in content:
        content = content.replace(old_kv, new_kv)
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  FIXED (profile keys): {fname}')
        fixed_2 += 1

print(f'\nKey additions: {fixed_2} files updated')
