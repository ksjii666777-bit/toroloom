"""
DIRECT FIXES for remaining test failures:
1. StockDetailScreen: Fix StatusBar mock (was inserted inside useT mock)
2. USStockDetailScreen: Fix StatusBar with barrel-level mock
3. ReportsScreen: Fix key values (wrong camelCase fallback)
4. ProfileScreen: Add panVerification to kyc dict (not profile dict)
"""
import os
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

TEST_DIR = 'src/__tests__'


def fix_stock_detail_screen():
    """Fix the StatusBar mock that was nested inside the useT mock."""
    path = os.path.join(TEST_DIR, 'StockDetailScreen.test.tsx')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find and fix the nested mock issue
    # Current broken code:
    # vi.mock('../hooks/useT', () => ({
    # // Mock StatusBar to fix 'StatusBar.setHidden is not a function'
    # vi.mock('react-native/Libraries/...
    old = """vi.mock('../hooks/useT', () => ({
// Mock StatusBar to fix 'StatusBar.setHidden is not a function'
vi.mock('react-native/Libraries/Components/StatusBar/StatusBar', () => ({
  __esModule: true,
  default: {
    setHidden: vi.fn(),
    setBarStyle: vi.fn(),
    setTranslucent: vi.fn(),
    setBackgroundColor: vi.fn(),
    currentHeight: 0,
  },
}));"""
    
    new = """// Mock StatusBar to fix 'StatusBar.setHidden is not a function'
vi.mock('react-native/Libraries/Components/StatusBar/StatusBar', () => ({
  __esModule: true,
  default: {
    setHidden: vi.fn(),
    setBarStyle: vi.fn(),
    setTranslucent: vi.fn(),
    setBackgroundColor: vi.fn(),
    currentHeight: 0,
  },
}));

vi.mock('../hooks/useT', () => ({"""
    
    if old in content:
        content = content.replace(old, new)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Fixed nested StatusBar mock in StockDetailScreen")
    else:
        print(f"  Could not find nested mock pattern in StockDetailScreen")
        # Try to find where the StatusBar mock is
        pos = content.find('vi.mock(\'../hooks/useT\'')
        if pos >= 0:
            # Check if there's a vi.mock right after it
            after_pos = content.find('vi.mock', pos + 10)
            next_import = content.find("vi.mock('../hooks/useT'", pos + 10)
            if next_import > pos:
                pass  # There might be another useT mock
            print(f"  useT mock at position {pos}")
        print(f"  Checking for any vi.mock nesting...")
        # Find all vi.mock positions
        for m in re.finditer(r'vi\.mock\(', content):
            print(f"    vi.mock at position {m.start()}")


def fix_us_stock_detail():
    """Fix USStockDetailScreen StatusBar issue - use barrel-level mock."""
    path = os.path.join(TEST_DIR, 'USStockDetailScreen.test.tsx')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if there's a useT mock (from finish_line.py adding StatusBar mock)
    # The file was git-restored, then finish_line.py added StatusBar mock
    # Check if StatusBar mock is present
    if 'StatusBar' in content:
        # Find and remove any existing StatusBar mock (internal path or require)
        old_pattern = "// Mock react-native StatusBar"
        start = content.find(old_pattern)
        if start >= 0:
            # Find the end of this mock block
            end_pos = content.find('\n\n', start)
            if end_pos < 0:
                end_pos = content.find('\nimport ', start)
            if end_pos < 0:
                end_pos = len(content)
            content = content[:start] + content[end_pos:]
    
    # Add barrel-level StatusBar mock BEFORE any imports/other mocks
    # First, find the insertion point (after first import or vi.mock)
    lines = content.split('\n')
    first_mock_or_import = -1
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith('vi.mock') or s.startswith('import '):
            first_mock_or_import = i
            break
    
    statusbar_mock = [
        "// Mock StatusBar to fix 'StatusBar.setHidden is not a function'",
        "vi.mock('react-native/Libraries/Components/StatusBar/StatusBar', () => ({",
        "  __esModule: true,",
        "  default: {",
        "    setHidden: vi.fn(),",
        "    setBarStyle: vi.fn(),",
        "    setTranslucent: vi.fn(),",
        "    setBackgroundColor: vi.fn(),",
        "    currentHeight: 0,",
        "  },",
        "}));",
    ]
    
    if first_mock_or_import >= 0:
        # Still handle the max depth issue - add a minimal useRealtimePrice mock
        new_lines = lines[:first_mock_or_import] + statusbar_mock + [''] + lines[first_mock_or_import:]
    else:
        new_lines = statusbar_mock + [''] + lines
    
    content = '\n'.join(new_lines)
    
    # Also need to handle "Maximum update depth exceeded"
    # This is from useRealtimePrice or similar hook in FullscreenChartModal
    # Add a mock for the realtime price hook
    mock_maxdepth = """
// Mock useRealtimePrice to prevent 'Maximum update depth exceeded'
vi.mock('../hooks/useRealtimePrice', () => ({
  default: () => ({
    price: null,
    change: null,
    changePercent: null,
    isLoading: false,
    error: null,
  }),
}));
"""
    # Insert after the StatusBar mock
    lines = content.split('\n')
    sb_pos = -1
    for i, line in enumerate(lines):
        if 'StatusBar' in line and 'vi.mock' in line:
            sb_pos = i
            break
    if sb_pos >= 0:
        lines = lines[:sb_pos + 11] + [mock_maxdepth.strip()] + [''] + lines[sb_pos + 11:]
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    
    print(f"  Fixed USStockDetailScreen - StatusBar + useRealtimePrice mocks")


def fix_reports_key_values():
    """Fix report keys that have camelCase fallback values instead of correct values."""
    path = os.path.join(TEST_DIR, 'ReportsScreen.test.tsx')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix key-value pairs that have wrong values from camelCase fallback
    fixes = {
        "'maxDD': 'Max D D'": "'maxDD': 'Max DD'",
        "'tabPnl': 'Tab Pnl'": "'tabPnl': 'P&L'",
        "'tabPerformance': 'Tab Performance'": "'tabPerformance': 'Performance'",
        "'tabTax': 'Tab Tax'": "'tabTax': 'Tax'",
        "'tabHoldings': 'Tab Holdings'": "'tabHoldings': 'Holdings'",
        "'tabHistory': 'Tab History'": "'tabHistory': 'History'",
        "'pnlOverTime': 'Pnl Over Time'": "'pnlOverTime': 'P&L Over Time'",
        "'realizedPnl': 'Realized Pnl'": "'realizedPnl': 'Realized P&L'",
        "'unrealizedPnl': 'Unrealized Pnl'": "'unrealizedPnl': 'Unrealized P&L'",
        "'todaysPerformance': 'Todays Performance'": "'todaysPerformance': 'Today\\'s Performance'",
        "'fromClosed': 'From Closed'": "'fromClosed': 'From closed positions'",
        "'fromOpen': 'From Open'": "'fromOpen': 'From open positions'",
        "'dayChange': 'Day Change'": "'dayChange': 'Day Change'",
        "'dayReturn': 'Day Return'": "'dayReturn': 'Day Return'",
        "'monthlyReturns': 'Monthly Returns'": "'monthlyReturns': 'Monthly Returns'",
        "'riskAndReturn': 'Risk And Return'": "'riskAndReturn': 'Risk & Return'",
        "'returnPercent': 'Return Percent'": "'returnPercent': 'Return %'",
        "'addAlertFor': 'Add Alert For'": "'addAlertFor': 'Add alert for {symbol}'",
        "'alertAdded': 'Alert Added'": "'alertAdded': 'Alert Added'",
        "'dayGainAlertCreated': 'Day Gain Alert Created'": "'dayGainAlertCreated': 'Day gain alert created for {symbol}'",
        "'pnlAlertCreated': 'Pnl Alert Created'": "'pnlAlertCreated': 'P&L alert created for {symbol}'",
        "'reportExported': 'Report Exported'": "'reportExported': 'Report Exported'",
        "'reportExportedMsg': 'Report Exported Msg'": "'reportExportedMsg': 'Report exported as {format}'",
        "'exportError': 'Export Error'": "'exportError': 'Export Error'",
        "'exportErrorMsg': 'Export Error Msg'": "'exportErrorMsg': 'An error occurred while exporting.'",
        "'capitalGains': 'Capital Gains'": "'capitalGains': 'Capital Gains Tax Summary'",
        "'shortTerm': 'Short Term'": "'shortTerm': 'Short-Term'",
        "'longTerm': 'Long Term'": "'longTerm': 'Long-Term'",
        "'taxRulesTitle': 'Tax Rules Title'": "'taxRulesTitle': 'Tax Rules (India FY 2025-26)'",
        "'section80C': 'Section80 C'": "'section80C': 'Section 80C \\u2014 ELSS'",
        "'tradeStats': 'Trade Stats'": "'tradeStats': 'Trade Statistics'",
    }
    
    changes = 0
    for old_val, new_val in fixes.items():
        if old_val in content:
            content = content.replace(old_val, new_val)
            changes += 1
            print(f"  Fixed: {old_val[:30]}...")
    
    if changes > 0:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Total: {changes} key values updated")
    else:
        print(f"  No fixes needed - checking current values...")
        # Show current values for debugging
        for key in ['tabPnl', 'maxDD', 'pnlOverTime', 'realizedPnl', 'todaysPerformance']:
            for m in re.finditer(rf"'{key}':\s*'([^']*)'", content):
                print(f"    {key}: '{m.group(1)}'")


def fix_profile_kyc():
    """Add panVerification to kyc dict in ProfileScreen test mock."""
    path = os.path.join(TEST_DIR, 'ProfileScreen.test.tsx')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the kyc dict
    start = content.find('const kyc: Record<string, string> = {')
    if start < 0:
        print(f"  kyc dict not found!")
        return
    
    # Find the end of the kyc dict
    brace_count = 0
    found_brace = False
    end = start
    for i in range(start, len(content)):
        if content[i] == '{':
            brace_count += 1
            found_brace = True
        elif content[i] == '}':
            brace_count -= 1
            if found_brace and brace_count == 0:
                end = i + 1
                break
    
    kyc_content = content[start:end]
    
    # Check if panVerification already exists
    if "'panVerification'" in kyc_content:
        print(f"  panVerification already in kyc dict")
        return
    
    # Add panVerification before the closing }
    insert_pos = end - 2  # before "};"
    entry = "    'panVerification': 'PAN Verification',\n"
    content = content[:insert_pos] + entry + content[insert_pos:]
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"  Added panVerification to kyc dict")


# =========================================================================
# MAIN
# =========================================================================
if __name__ == '__main__':
    print("=" * 60)
    print("FINAL DIRECT FIXES")
    print("=" * 60)
    
    print("\n1. StockDetailScreen - Fix nested StatusBar mock")
    fix_stock_detail_screen()
    
    print("\n2. USStockDetailScreen - Fix StatusBar + max depth")
    fix_us_stock_detail()
    
    print("\n3. ReportsScreen - Fix key values")
    fix_reports_key_values()
    
    print("\n4. ProfileScreen - Fix panVerification (add to kyc dict)")
    fix_profile_kyc()
    
    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)
