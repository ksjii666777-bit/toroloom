"""
Add smart fallback to resolveT in all patched test files.
When a key is not found in the dictionary, extract the last segment as readable text.
"""
import os

files = [
    'IPODashboardScreen.test.tsx', 'ProfileScreen.test.tsx',
    'PlaceOrderScreen.test.tsx', 'PlaceOrderScreenFrozenFix.test.tsx',
    'CommunityCoursesScreen.test.tsx', 'MyCoursesScreen.test.tsx',
    'CourseDetailScreen.test.tsx', 'LearningPathsScreen.test.tsx',
    'ContractNoteUploadScreen.test.tsx', 'ReportsScreen.test.tsx',
]

test_dir = 'src/__tests__'
fixed = 0

for fname in files:
    fp = os.path.join(test_dir, fname)
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the line with "  return key;" that closes resolveT
    # and replace with the fallback version
    old_close = '  \n  return key;\n}'
    new_close = '''  
  // Fallback: return last key segment as readable text
  const lastSeg = subKey || key;
  return lastSeg
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s: string) => s.toUpperCase())
    .trim();
}'''
    
    if old_close in content:
        content = content.replace(old_close, new_close)
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  FIXED: {fname}')
        fixed += 1
    else:
        # Try other variations
        # The file might use \r\n line endings
        old_close2 = '  \r\n  return key;\r\n}'
        new_close2 = '''  \r\n  // Fallback: return last key segment as readable text\r\n  const lastSeg = subKey || key;\r\n  return lastSeg\r\n    .replace(/([A-Z])/g, ' $1')\r\n    .replace(/^./, (s: string) => s.toUpperCase())\r\n    .trim();\r\n}'''
        if old_close2 in content:
            content = content.replace(old_close2, new_close2)
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'  FIXED (CRLF): {fname}')
            fixed += 1
        else:
            print(f'  SKIP (not found): {fname}')

print(f'\nFixed {fixed} files')
