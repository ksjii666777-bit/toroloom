import os
import re

project_root = r"C:\Users\Karan\Desktop\New folder\Toroloom"

# Map of files to their specific fixes (file relative path -> list of (pattern_type, old_string, new_string))
# pattern_type: 'simple' for key={i}, 'idx' for key={idx}, 'gi' for key={gi}

fixes = {
    # Static skeleton arrays - use prefix-based keys
    "src/screens/tabs/WatchlistScreen.tsx": [
        ("simple", r"[\d+]\s*\.map\s*\(\s*i\s*\)\s*=>\s*<SkeletonCard\s+key={i}", 
         lambda m: m.group(0).replace("key={i}", "key={`skel_${i}`}")),
    ],
    "src/screens/tabs/MarketsScreen.tsx": [
        ("simple", r"[\d+]\s*\.map\s*\(\s*i\s*\)\s*=>\s*<SkeletonCard\s+key={i}",
         lambda m: m.group(0).replace("key={i}", "key={`skel_${i}`}")),
    ],
    "src/screens/tabs/PortfolioScreen.tsx": [
        ("simple", r"[\d+]\s*\.map\s*\(\s*i\s*\)\s*=>\s*<SkeletonCard\s+key={i}",
         lambda m: m.group(0).replace("key={i}", "key={`skel_${i}`}")),
    ],
}

def fix_file(filepath, patterns):
    """Apply fixes to a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for pattern_type, old, new in patterns:
        if pattern_type == 'simple':
            if old in content:
                content = content.replace(old, new)
                print(f"  Fixed: {os.path.basename(filepath)}")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Count remaining key={i} patterns
import glob

tsx_files = glob.glob(os.path.join(project_root, "src/**/*.tsx"), recursive=True)

remaining = []
for fp in tsx_files:
    rel = os.path.relpath(fp, project_root)
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    # Find key={i}, key={idx}, key={gi}, key={_i} patterns
    matches = re.findall(r'key=\{(i|idx|_i|_idx|gi)\}', content)
    if matches:
        for m in matches:
            remaining.append((rel, m))
            print(f"  {rel}: key={{{m}}}")

print(f"\nTotal remaining: {len(remaining)}")

# Write remaining list to a file for reference
with open(os.path.join(project_root, "remaining_keys.txt"), 'w') as f:
    for filepath, key_type in remaining:
        f.write(f"{filepath}: key={{{key_type}}}\n")
