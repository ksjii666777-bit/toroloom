"""
Final fixes to get to 0 test failures:
1. Add StatusBar mock to StockDetailScreen + USStockDetailScreen (safe approach)
2. Fix any remaining ReportsScreen/ProfileScreen issues
3. Check all 6 files are passing
"""
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

TEST_DIR = 'src/__tests__'


def add_statusbar_mock(test_path):
    """Add StatusBar mock using the specific internal module path (no require/async)."""
    with open(test_path, 'r', encoding='utf-8') as f:
        content = f.read()

    mock_code = """// Mock StatusBar to fix 'StatusBar.setHidden is not a function'
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
"""

    # Check if already has a StatusBar mock
    if 'setHidden' in content and 'vi.mock' in content:
        print(f"  StatusBar mock already present")
        # Check if it's the right kind (no require)
        if 'require' in content and 'react-native' in content.split('require')[0]:
            print(f"  But uses require() - will be replaced")
        else:
            return True

    lines = content.split('\n')
    
    # Find a good insertion point - after the first vi.mock or import
    insert_after = -1
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith('vi.mock') or s.startswith('import '):
            if insert_after < i:
                insert_after = i
    
    if insert_after >= 0:
        # Insert after the last vi.mock/import line
        new_lines = lines[:insert_after + 1] + [mock_code.strip()] + [''] + lines[insert_after + 1:]
    else:
        # Insert at top after header
        new_lines = [mock_code.strip(), ''] + lines

    with open(test_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))
    
    print(f"  Added StatusBar mock (safe internal path approach)")
    return True


def fix_reports_remaining(test_path):
    """Add any additional missing report keys."""
    with open(test_path, 'r', encoding='utf-8') as f:
        content = f.read()

    keys = [
        ("'allowance': 'Allowance'", "'deductions': 'Deductions'"),
    ]
    
    # Check for specific missing keys by running the test and looking at errors
    print(f"  ReportsScreen: verify keys are present")
    content_lower = content.lower()
    for key in ['tabPnl', 'maxDD', 'pnlOverTime', 'realizedPnl', 'todaysPerformance',
                'capitalGains', 'shortTerm', 'taxRulesTitle', 'section80C', 'tradeStats']:
        if key in content_lower:
            pass  # key exists
        else:
            print(f"  WARNING: '{key}' not found!")
    
    return True


def fix_profile_remaining(test_path):
    """Add any additional missing profile keys."""
    with open(test_path, 'r', encoding='utf-8') as f:
        content = f.read()

    content_lower = content.lower()
    for key in ['panVerification', 'dpId']:
        if key in content_lower:
            pass
        else:
            print(f"  WARNING: '{key}' not found!")
    
    return True


# =========================================================================
# MAIN
# =========================================================================
if __name__ == '__main__':
    print("=" * 60)
    print("Adding StatusBar mocks + final fixes")
    print("=" * 60)
    
    for test_file in ['StockDetailScreen.test.tsx', 'USStockDetailScreen.test.tsx']:
        test_path = os.path.join(TEST_DIR, test_file)
        print(f"\n[{test_file}]")
        add_statusbar_mock(test_path)
    
    print(f"\n[ReportsScreen.test.tsx]")
    fix_reports_remaining(os.path.join(TEST_DIR, 'ReportsScreen.test.tsx'))
    
    print(f"\n[ProfileScreen.test.tsx]")
    fix_profile_remaining(os.path.join(TEST_DIR, 'ProfileScreen.test.tsx'))
    
    print("\nDone!")
