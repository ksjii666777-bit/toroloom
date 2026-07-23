#!/usr/bin/env python3
"""Fix unescaped apostrophes in transcript text strings in courseContent.ts"""
import re, sys
from pathlib import Path

filepath = Path(__file__).parent.parent / 'src' / 'constants' / 'courseContent.ts'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
fixed_count = 0

for i, line in enumerate(lines):
    stripped = line.strip()
    # Only process lines containing text: ' in transcript entries
    if "text: '" not in stripped:
        continue
    
    # Find the text: ' portion
    idx = stripped.find("text: '")
    if idx < 0:
        continue
    
    start_content = idx + len("text: '")
    # Find the closing quote-comma
    end_idx = stripped.rfind("',")
    if end_idx <= start_content:
        continue
    
    inner = stripped[start_content:end_idx]
    # Check if there are unescaped single quotes
    # Walk through character by character
    new_inner = []
    j = 0
    modified = False
    while j < len(inner):
        if inner[j] == '\\' and j + 1 < len(inner) and inner[j+1] == "'":
            # Already escaped - keep as-is
            new_inner.append(inner[j])
            new_inner.append(inner[j+1])
            j += 2
        elif inner[j] == "'":
            # Unescaped quote - add backslash before it
            new_inner.append('\\')
            new_inner.append("'")
            j += 1
            modified = True
            fixed_count += 1
        else:
            new_inner.append(inner[j])
            j += 1
    
    if modified:
        # Find positions in original (whitespace-preserving) line
        leading_spaces = len(line) - len(line.lstrip())
        orig_start = leading_spaces + start_content
        orig_end = leading_spaces + end_idx
        
        lines[i] = line[:orig_start] + ''.join(new_inner) + line[orig_end:]

if fixed_count > 0:
    result = '\n'.join(lines)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(result)
    print(f"Fixed {fixed_count} unescaped apostrophes")
else:
    print("No unescaped apostrophes found")
