"""
Add Pressable to import { ... } from 'react-native' for files listed on stdin.
Usage: python3 scripts/fix-pressable-imports.py < filelist.txt
Or pipe from another command.
"""

import sys
import re
import os

files = [line.strip() for line in sys.stdin if line.strip()]
files = sorted(set(files))

print(f"Processing {len(files)} files...")

count = 0
for filepath in files:
    filepath = filepath.replace('\\', '/')
    
    if not os.path.exists(filepath):
        print(f"  SKIP (not found): {filepath}")
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the react-native import
    import_match = re.search(
        r"(import\s*\{)([^}]*)(\}\s*from\s*['\"]react-native['\"])",
        content, re.DOTALL
    )
    if not import_match:
        print(f"  SKIP (no react-native import): {filepath}")
        continue
    
    prefix = import_match.group(1)
    body = import_match.group(2)
    suffix = import_match.group(3)
    
    if 'Pressable' in body:
        continue  # Already imported
    
    # Add Pressable - find the last item and add a comma + Pressable
    body_stripped = body.strip()
    body_rstrip = body.rstrip()
    
    if body_rstrip.endswith(','):
        new_body = body_rstrip + '\n  Pressable'
    else:
        # Remove trailing whitespace, add comma and Pressable
        new_body = body_rstrip.rstrip(',') + ',\n  Pressable'
    
    new_content = content.replace(import_match.group(0), prefix + new_body + suffix)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    count += 1
    print(f"  ✓ FIXED: {filepath}")

print(f"\nFixed {count} files")
