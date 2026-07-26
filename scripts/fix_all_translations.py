"""
Fix ALL translation-related test failures by:
1. Reading actual i18n values from src/i18n/locales/en.ts
2. Adding complete useT mocks to all failing test files
3. Adding StatusBar mock for StockDetailScreen + USStockDetailScreen
"""
import re
import os
import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

TEST_DIR = 'src/__tests__'
EN_TS_PATH = 'src/i18n/locales/en.ts'


def parse_en_ts() -> dict:
    """Parse the en.ts i18n file to extract all namespace -> {key: value} mappings."""
    if not os.path.exists(EN_TS_PATH):
        print(f"  WARN: en.ts not found at {EN_TS_PATH}")
        return {}

    with open(EN_TS_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove TypeScript type annotations and const/export stuff
    # Find the object pattern: ns_name: { key: 'value', ... }
    result = {}

    # Find all top-level namespace blocks like "reports: {" or "education: {"
    # Pattern: at line start or after comma: ns: {
    # Only match lines where the value is a flat object (not nested objects),
    # which means the opening brace is on the SAME line as the key
    ns_pattern = re.compile(r'^\s*(\w+)\s*:\s*\{', re.MULTILINE)
    for ns_match in ns_pattern.finditer(content):
        ns_name = ns_match.group(1)
        # Find the matching closing brace
        start = ns_match.end() - 1  # position of '{'
        depth = 1
        end = start + 1
        while end < len(content) and depth > 0:
            ch = content[end]
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
            end += 1

        ns_content = content[start:end]

        # Extract all key: 'value' or key: "value" pairs
        kv_pairs = {}
        kv_pattern = re.compile(r"^\s*(\w+)\s*:\s*'([^']*)'", re.MULTILINE)
        # Also match "value" style
        kv_pattern2 = re.compile(r'^\s*(\w+)\s*:\s*"([^"]*)"', re.MULTILINE)

        for m in kv_pattern.finditer(ns_content):
            kv_pairs[m.group(1)] = m.group(2)
        for m in kv_pattern2.finditer(ns_content):
            kv_pairs[m.group(1)] = m.group(2)

        result[ns_name] = kv_pairs

    return result


def esc(val: str) -> str:
    """Escape single quotes and backslashes for TypeScript string literal."""
    return val.replace("\\", "\\\\").replace("'", "\\'")


def extract_keys_from_source(source_path: str) -> dict:
    """Extract all t('ns.key') calls from a source file, grouped by namespace."""
    if not os.path.exists(source_path):
        print(f"  WARN: source not found: {source_path}")
        return {}
    with open(source_path, 'r', encoding='utf-8') as f:
        content = f.read()
    namespaced_keys = {}
    for m in re.finditer(r"t\(\s*['\"]([a-zA-Z_][a-zA-Z0-9_.]*)['\"]", content):
        full_key = m.group(1)
        parts = full_key.split('.', 1)
        if len(parts) == 2:
            ns = parts[0]
            if ns not in namespaced_keys:
                namespaced_keys[ns] = set()
            namespaced_keys[ns].add(full_key)
    return namespaced_keys


def get_value_from_en(ns: str, key: str, en_data: dict) -> str:
    """Get the actual translation value from en.ts, with camelCase fallback."""
    if ns in en_data and key in en_data[ns]:
        return en_data[ns][key]
    # Fallback: convert camelCase to Title Case
    result = re.sub(r'([A-Z])', r' \1', key)
    result = result[0].upper() + result[1:] if result else key
    return result.strip()


def add_complete_useT_mock(test_path: str, source_path: str, en_data: dict):
    """Add a complete useT mock with ALL namespaces to a test file."""
    if not os.path.exists(test_path):
        print(f"  SKIP (not found): {test_path}")
        return False

    with open(test_path, 'r', encoding='utf-8') as f:
        content = f.read()

    all_ns_keys = extract_keys_from_source(source_path)
    if not all_ns_keys:
        print(f"  No translation keys found in source - skipping")
        return False

    total_keys = sum(len(v) for v in all_ns_keys.values())
    print(f"  Found {total_keys} keys across {len(all_ns_keys)} namespaces in source")

    dict_blocks = []
    ns_var_names = {}
    for ns_name in sorted(all_ns_keys.keys()):
        var_name = ns_name
        ns_var_names[ns_name] = var_name
        keys = sorted(all_ns_keys[ns_name])
        entries = []
        for full_key in keys:
            key_name = full_key.split('.', 1)[1]
            val = get_value_from_en(ns_name, key_name, en_data)
            entries.append(f"    '{key_name}': '{esc(val)}',")
        dict_block = f"const {var_name}: Record<string, string> = {{\n" + '\n'.join(entries) + "\n};"
        dict_blocks.append(dict_block)

    lines = []
    lines.append("")
    lines.append("// ==================== Mock useT hook ====================")
    lines.extend(dict_blocks)
    lines.append("")
    lines.append("const translations: Record<string, any> = {")
    for ns_name in sorted(ns_var_names.keys()):
        lines.append(f"  {ns_name},")
    lines.append("};")
    lines.append("")
    lines.append("""
function resolveT(key: string, params?: Record<string, any>): string {
  const parts = key.split('.');
  const rootNs = parts[0];
  const subKey = parts.slice(1).join('.');

  const obj = translations[rootNs];
  if (!obj) {
    const parts2 = key.split('.');
    const lastSeg = parts2[parts2.length - 1] || key;
    return lastSeg
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s: string) => s.toUpperCase())
      .trim();
  }

  if (params && params.count !== undefined && params.count !== 1) {
    const pluralKey = subKey + '_plural';
    if (pluralKey in obj && typeof obj[pluralKey] === 'string') {
      let result: string = obj[pluralKey];
      result = result.replace(/\\{\\{(\\w+)\\}\\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
      return result;
    }
  }

  if (subKey in obj && typeof obj[subKey] === 'string') {
    let result: string = obj[subKey];
    if (params) {
      result = result.replace(/\\{\\{(\\w+)\\}\\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
    }
    return result;
  }

  const lastSeg = parts[parts.length - 1] || key;
  return lastSeg
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s: string) => s.toUpperCase())
    .trim();
}
""")
    lines.append("""
vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
  default: () => ({
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));
""")

    mock_code = '\n'.join(lines)

    file_lines = content.split('\n')

    # Find the last import or vi.mock line
    last_mock_or_import_line = -1
    for i, line in enumerate(file_lines):
        stripped = line.strip()
        if stripped.startswith('import ') or stripped.startswith('vi.mock'):
            last_mock_or_import_line = i

    if last_mock_or_import_line >= 0:
        insert_line = last_mock_or_import_line + 1
    else:
        insert_line = 0
        for i, line in enumerate(file_lines):
            if line.strip().startswith('/*') or line.strip().startswith('//'):
                insert_line = i + 1
            elif line.strip() == '' and insert_line == i:
                insert_line = i + 1
            else:
                break

    new_lines = file_lines[:insert_line] + [mock_code, ''] + file_lines[insert_line:]
    new_content = "\n".join(new_lines)

    with open(test_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"  Added useT mock ({total_keys} keys, {len(all_ns_keys)} namespaces)")
    return True


def add_status_bar_mock(test_path: str, en_data: dict):
    """Add a StatusBar mock to fix 'StatusBar.setHidden is not a function' error.
    
    Also adds a useT mock for USStockDetailScreen (which doesn't have one).
    """
    if not os.path.exists(test_path):
        print(f"  SKIP (not found): {test_path}")
        return

    with open(test_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if StatusBar is already handled
    if 'StatusBar' in content and ('setHidden' in content):
        print(f"  StatusBar mock already present")
        return

    # Check if the file already has a useT mock
    has_useT = 'vi.mock.*useT' in content or 'resolveT' in content or 'useT' in content

    mock_code = """
// Mock react-native StatusBar to fix 'StatusBar.setHidden is not a function'
vi.mock('react-native', () => {
  const RN = require('react-native');
  RN.StatusBar = {
    setHidden: vi.fn(),
    setBarStyle: vi.fn(),
    setTranslucent: vi.fn(),
    setBackgroundColor: vi.fn(),
    currentHeight: 0,
  };
  return RN;
});
"""

    file_lines = content.split('\n')

    # Insert right after the first existing mock (vi.mock) or at top
    insert_line = -1
    for i, line in enumerate(file_lines):
        if line.strip().startswith('vi.mock') or line.strip().startswith('import '):
            insert_line = i + 1
            break

    if insert_line < 0:
        # No mocks or imports, insert after file header
        insert_line = 0
        for i, line in enumerate(file_lines):
            if line.strip().startswith('/*') or line.strip().startswith('//'):
                insert_line = i + 1
            else:
                break

    new_lines = file_lines[:insert_line] + [mock_code.strip(), ''] + file_lines[insert_line:]
    new_content = "\n".join(new_lines)

    with open(test_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"  Added StatusBar mock")


# =========================================================================
# MAIN
# =========================================================================
if __name__ == '__main__':
    print("=" * 60)
    print("Step 1: Parsing en.ts for actual translation values")
    print("=" * 60)

    en_data = parse_en_ts()
    ns_found = sorted(en_data.keys())
    total_entries = sum(len(v) for v in en_data.values())
    print(f"  Found {len(en_data)} namespaces ({total_entries} entries total):")
    for ns in ns_found:
        print(f"    - {ns}: {len(en_data[ns])} entries")

    print("\n" + "=" * 60)
    print("Step 2: Adding complete useT mocks")
    print("=" * 60)

    files_to_fix = [
        ('ContractNoteUploadScreen.test.tsx', 'src/screens/reports/ContractNoteUploadScreen.tsx'),
        ('ReportsScreen.test.tsx', 'src/screens/reports/ReportsScreen.tsx'),
        ('CourseDetailScreen.test.tsx', 'src/screens/education/CourseDetailScreen.tsx'),
        ('ProfileScreen.test.tsx', 'src/screens/profile/ProfileScreen.tsx'),
        ('StockDetailScreen.test.tsx', 'src/screens/stock/StockDetailScreen.tsx'),
        ('USStockDetailScreen.test.tsx', 'src/screens/stock/USStockDetailScreen.tsx'),
    ]

    for test_file, source_path in files_to_fix:
        test_path = os.path.join(TEST_DIR, test_file)
        print(f"\n[{test_file}]")
        add_complete_useT_mock(test_path, source_path, en_data)

    print("\n" + "=" * 60)
    print("Step 3: Adding StatusBar mocks to StockDetailScreen + USStockDetailScreen")
    print("=" * 60)

    for test_file in ['StockDetailScreen.test.tsx', 'USStockDetailScreen.test.tsx']:
        test_path = os.path.join(TEST_DIR, test_file)
        print(f"\n[{test_file}]")
        add_status_bar_mock(test_path, en_data)

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)
