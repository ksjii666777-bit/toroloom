"""
Batch fix: Add `Pressable` to `import { ... } from 'react-native'` in all files
that use Pressable but don't import it.

Usage: python3 scripts/fix-pressable-imports-v2.py < list_of_files.txt
   OR: python3 scripts/fix-pressable-imports-v2.py
       (reads from stdin if no arg provided)

Handles these import variants:
  1. Single-line: import { View, Text } from 'react-native';
  2. Single-line with trailing comma: import { View, Text,} from 'react-native';
  3. Multi-line: import {\n  View, Text,\n} from 'react-native';
  4. No existing react-native import: adds a new import line
"""

import sys, os, re

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXED_COUNT = 0
SKIP_COUNT = 0
ERROR_COUNT = 0

def add_pressable_to_import(content: str) -> str:
    """Add Pressable to the react-native import statement if missing."""
    # Match import { ... } from 'react-native' (single or multi-line)
    pattern = r"(import\s*\{)([^}]*?)(\s*\}\s*from\s*['\"]react-native['\"]\s*;?\s*)"
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        return None

    prefix = match.group(1)   # "import {"
    body = match.group(2)     # the imports inside {}
    suffix = match.group(3)   # "} from 'react-native';"

    # Check if Pressable is already in body
    if re.search(r'\bPressable\b', body):
        return None

    rstrip_body = body.rstrip()
    if rstrip_body.endswith(','):
        # Trailing comma: add Pressable on same line
        new_body = rstrip_body + ' Pressable'
    else:
        # No trailing comma: add comma and Pressable
        new_body = rstrip_body + ', Pressable'

    return prefix + new_body + suffix


def add_new_react_native_import(content: str) -> str:
    """Add a new import { Pressable, View, Text } from 'react-native' line."""
    # Find the last import line to insert after
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import ') and 'from ' in line:
            last_import_idx = i

    insert_line = 'import { View, Text, Pressable } from \'react-native\';'
    
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, insert_line)
    else:
        lines.insert(0, insert_line)
    
    return '\n'.join(lines)


def fix_file(filepath: str) -> bool:
    """Fix a single file. Returns True if fixed, False if skipped."""
    global FIXED_COUNT, SKIP_COUNT, ERROR_COUNT
    
    full_path = filepath if os.path.isabs(filepath) else os.path.join(PROJECT_ROOT, filepath)
    
    if not os.path.exists(full_path):
        print(f"  SKIP (not found): {filepath}")
        SKIP_COUNT += 1
        return False
    
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  ERROR reading: {filepath}: {e}")
        ERROR_COUNT += 1
        return False
    
    # Try adding to existing import
    new_content = add_pressable_to_import(content)
    
    if new_content is None:
        # No existing react-native import - try adding a new one
        if 'Pressable' not in content:
            new_content = add_new_react_native_import(content)
            if new_content == content:
                print(f"  SKIP (no change): {filepath}")
                SKIP_COUNT += 1
                return False
        else:
            print(f"  SKIP (already has Pressable): {filepath}")
            SKIP_COUNT += 1
            return False
    else:
        if new_content == content:
            print(f"  SKIP (no change): {filepath}")
            SKIP_COUNT += 1
            return False
    
    try:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  FIXED: {filepath}")
        FIXED_COUNT += 1
        return True
    except Exception as e:
        print(f"  ERROR writing: {filepath}: {e}")
        ERROR_COUNT += 1
        return False


def main():
    global FIXED_COUNT, SKIP_COUNT, ERROR_COUNT
    
    files = [line.strip() for line in sys.stdin if line.strip()]
    
    if not files:
        print("No files provided. Pipe a list of file paths to stdin.")
        sys.exit(1)
    
    print(f"Processing {len(files)} files...")
    print()
    
    for filepath in files:
        fix_file(filepath)
    
    print()
    print(f"Done: {FIXED_COUNT} fixed, {SKIP_COUNT} skipped, {ERROR_COUNT} errors")


if __name__ == '__main__':
    main()
