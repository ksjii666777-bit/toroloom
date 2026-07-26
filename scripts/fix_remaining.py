"""
Fix remaining issues:
1. Remove orphaned braces in StockDetailScreen (parse error)
2. Fix USStockDetailScreen StatusBar mock
3. Add missing ReportScreen keys (tabPnl, maxDD, etc.)
4. Fix ProfileScreen (DP ID, PAN Verification)
"""
import re
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

TEST_DIR = 'src/__tests__'


def fix_stock_detail_parse(test_path: str):
    """Remove orphaned closing braces in StockDetailScreen test file."""
    if not os.path.exists(test_path):
        print(f"  SKIP: {test_path} not found")
        return

    with open(test_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    
    # Find and remove orphaned braces pattern: "}\n  });\n});" after "}));"
    # This is at lines 38-41 currently
    new_lines = []
    skip_next_orphans = 0
    for i, line in enumerate(lines):
        # Check if we're in the orphaned braces section
        if skip_next_orphans > 0:
            skip_next_orphans -= 1
            continue
        if i < len(lines) - 2:
            # Look for: blank line, then "    }", then "  });", then "});"
            if (line.strip() == '' and 
                i+1 < len(lines) and lines[i+1].strip() == '}' and
                i+2 < len(lines) and lines[i+2].strip() == '});' and
                i+3 < len(lines) and lines[i+3].strip() == '});'):
                # Check if preceding line is "}));" - these are orphaned
                if i > 0 and lines[i-1].strip() == '}));':
                    # Skip this blank line + 3 orphan lines
                    skip_next_orphans = 4
                    # Also look back to see if there was a beforeEach hook we added
                    # that got lost
                    print(f"  Removing orphaned braces at lines {i+1}-{i+3}")
                    continue
        
        new_lines.append(line)

    new_content = '\n'.join(new_lines)
    
    # Also fix: replace require-based StatusBar mock with beforeEach approach
    # Find "// Mock react-native StatusBar" block and replace it
    old_mock_pattern = "// Mock react-native StatusBar"
    new_mock = """// Mock react-native StatusBar
beforeEach(() => {
  try {
    const { StatusBar } = require('react-native');
    if (StatusBar) {
      StatusBar.setHidden = vi.fn();
      StatusBar.setBarStyle = vi.fn();
      StatusBar.setTranslucent = vi.fn();
      StatusBar.setBackgroundColor = vi.fn();
    }
  } catch {}
});
"""
    
    if old_mock_pattern in new_content:
        # Find the start and end of the old mock
        start = new_content.find(old_mock_pattern)
        # Find the next vi.mock or beforeEach or import or blank line after it
        after_start = start + len(old_mock_pattern.split('\n')[0])
        end = new_content.find('\nvi.mock', start)
        if end < 0:
            end = new_content.find('\nimport ', start)
            if end >= 0:
                # Check if there's a beforeEach we added
                end_of_block = new_content.find('\n\n', start)
                if end_of_block > start and (end_of_block < end or end < 0):
                    end = end_of_block
        
        if end > start:
            new_content = new_content[:start] + new_mock + new_content[end:]
            print(f"  Replaced StatusBar mock with beforeEach approach")
        else:
            print(f"  Could not find end of StatusBar mock block")
    else:
        # Maybe the file already has the beforeEach approach
        if 'beforeEach' in new_content and 'StatusBar.setHidden = vi.fn()' in new_content:
            print(f"  StatusBar mock already uses beforeEach approach")
        else:
            print(f"  '// Mock react-native StatusBar' not found")

    with open(test_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"  Done fixing {test_path}")


def fix_us_stock_detail(test_path: str):
    """Replace require()-based StatusBar mock with simpler beforeEach approach."""
    if not os.path.exists(test_path):
        print(f"  SKIP: {test_path} not found")
        return

    with open(test_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the old vi.mock('react-native', ...) block
    old_start = content.find("vi.mock('react-native'")
    if old_start < 0:
        print(f"  vi.mock('react-native') not found")
        return

    # Find the end of the vi.mock block (the closing "});")
    search_pos = old_start
    # The block looks like:
    # vi.mock('react-native', () => {
    #   const RN = require('react-native');
    #   RN.StatusBar = { ... };
    #   return RN;
    # });
    # Find the matching "});" or "));"
    end_markers = ['});\n', '));\n', '})()\n']
    end_pos = -1
    for marker in end_markers:
        pos = content.find(marker, search_pos)
        # There might be multiple, find the RIGHT one
        if pos > old_start:
            # Check if there's another one after it
            pos2 = content.find(marker, pos + 1)
            if pos2 > pos:
                pos = pos2  # Use the LAST one
            # Now check the lines around pos
            end_pos = pos + len(marker)
            print(f"  Found vi.mock end marker at position {end_pos}")
            break

    if end_pos < 0:
        # Try to find the end by counting braces
        depth = 0
        started = False
        end_pos = len(content)
        for i in range(old_start, len(content)):
            ch = content[i]
            if ch == '(' and content[max(0,i-1):i+6] == 'vi.mock':
                started = True
            if started:
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth <= 0 and content[max(0,i-1):i+2] in [',\n}', ')})']:
                        # Check if we're at the right closing
                        end_pos = i + 1
                        break
        print(f"  Using brace-counting to find end at position {end_pos}")

    # Extract content before and after the vi.mock block
    before = content[:old_start]
    after = content[end_pos:]

    # Create new StatusBar setup
    new_mock = """// Mock react-native StatusBar
beforeEach(() => {
  try {
    const { StatusBar } = require('react-native');
    if (StatusBar) {
      StatusBar.setHidden = vi.fn();
      StatusBar.setBarStyle = vi.fn();
      StatusBar.setTranslucent = vi.fn();
      StatusBar.setBackgroundColor = vi.fn();
    }
  } catch {}
});
"""

    new_content = before.rstrip() + '\n' + new_mock + '\n' + after.lstrip()
    
    # Also remove any duplicate "// Mock react-native StatusBar" comments
    # by checking if there are multiple
    count = new_content.count("// Mock react-native StatusBar")
    if count > 1:
        # Find and remove duplicates (keep only the first one)
        first_pos = new_content.find("// Mock react-native StatusBar")
        second_pos = new_content.find("// Mock react-native StatusBar", first_pos + 10)
        if second_pos > first_pos:
            # Find the end of the duplicate block
            end_dup = new_content.find('\n\n', second_pos)
            if end_dup > second_pos:
                # Check if this is a beforeEach or a require-based block
                between = new_content[second_pos:end_dup]
                new_content = new_content[:second_pos] + new_content[end_dup:]
                print(f"  Removed duplicate StatusBar mock block")

    with open(test_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"  Fixed {test_path}")


def fix_profile_screen(test_path: str):
    """Fix ProfileScreen test file - add missing dpId and panVerification keys."""
    if not os.path.exists(test_path):
        print(f"  SKIP: {test_path} not found")
        return

    with open(test_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if 'dpId' is in the profile dict
    if "'dpId'" not in content:
        # Find the profile dict and add the key
        dict_start = content.find("const profile: Record<string, string> = {")
        if dict_start >= 0:
            dict_end = content.find("};", dict_start)
            if dict_end > dict_start:
                insert = "    'dpId': 'DP ID',\n    'panVerification': 'PAN Verification',\n"
                content = content[:dict_end] + insert + content[dict_end:]
                with open(test_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"  Added missing dpId and panVerification keys")
                return
    
    # If dpId is already there but panVerification is not
    if "'dpId'" in content and "'panVerification'" not in content:
        dict_end = content.find("};", content.find("const profile:"))
        insert = "    'panVerification': 'PAN Verification',\n"
        content = content[:dict_end] + insert + content[dict_end:]
        with open(test_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Added missing panVerification key")
        return

    print(f"  Keys already present")


def fix_reports_screen(test_path: str):
    """Add missing report keys that exist in screen but not in en.ts."""
    if not os.path.exists(test_path):
        print(f"  SKIP: {test_path} not found")
        return

    with open(test_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Keys that are in the screen but might be missing from the mock
    # because they don't exist in en.ts
    missing_checks = {
        'tabPnl': 'P&L',
        'tabPerformance': 'Performance', 
        'tabTax': 'Tax',
        'tabHoldings': 'Holdings',
        'tabHistory': 'History',
        'maxDD': 'Max DD',
        'winRate': 'Win Rate',
        'sharpe': 'Sharpe',
        'pnlOverTime': 'P&L Over Time',
        'realizedPnl': 'Realized P&L',
        'unrealizedPnl': 'Unrealized P&L',
        'fromClosed': 'From closed positions',
        'fromOpen': 'From open positions',
        'todaysPerformance': "Today's Performance",
        'dayChange': 'Day Change',
        'dayReturn': 'Day Return',
        'monthlyReturns': 'Monthly Returns',
        'riskAndReturn': 'Risk & Return',
        'returnPercent': 'Return %',
    }

    # Find the reports dict
    dict_start = content.find("const reports: Record<string, string> = {")
    if dict_start < 0:
        print(f"  reports dict not found")
        return

    dict_end = content.find("};", dict_start)
    if dict_end <= dict_start:
        print(f"  Could not find end of reports dict")
        return

    # Find existing keys in the dict
    dict_content = content[dict_start:dict_end]
    existing_keys = set()
    for m in re.finditer(r"'(\w+)'", dict_content):
        existing_keys.add(m.group(1))

    # Find missing keys
    to_add = []
    for key, val in missing_checks.items():
        if key not in existing_keys:
            to_add.append((key, val))

    if to_add:
        # Escape single quotes in values
        entries = []
        for key, val in to_add:
            escaped_val = val.replace("'", "\\'")
            entries.append(f"    '{key}': '{escaped_val}'")
        
        insert = "\n" + ",\n".join(entries) + ",\n"
        content = content[:dict_end] + insert + content[dict_end:]
        
        with open(test_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Added {len(to_add)} missing keys to reports dict: {', '.join(k for k,v in to_add)}")
    else:
        print(f"  All required keys already present")


# =========================================================================
# MAIN
# =========================================================================
if __name__ == '__main__':
    print("=" * 60)
    print("Fixing remaining test failures")
    print("=" * 60)
    
    print("\n--- StockDetailScreen parse error ---")
    fix_stock_detail_parse(os.path.join(TEST_DIR, 'StockDetailScreen.test.tsx'))
    
    print("\n--- USStockDetailScreen StatusBar mock ---")
    fix_us_stock_detail(os.path.join(TEST_DIR, 'USStockDetailScreen.test.tsx'))
    
    print("\n--- ReportsScreen missing keys ---")
    fix_reports_screen(os.path.join(TEST_DIR, 'ReportsScreen.test.tsx'))
    
    print("\n--- ProfileScreen missing keys ---")
    fix_profile_screen(os.path.join(TEST_DIR, 'ProfileScreen.test.tsx'))
    
    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)
