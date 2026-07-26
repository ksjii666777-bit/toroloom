"""
Fix resolveT function in all patched test files.
Two fixes:
1. Regex: /{(\w+)}/g -> /{{(\w+)}}/g (match double braces)
2. Check plural FIRST when count !== 1, then fall back to singular
"""
import os

# The OLD resolveT body (between "function resolveT" and closing "}")
# We need to replace everything between the function signature and the closing "}"

OLD_BODY = """  
  // Check for direct match
  if (subKey in obj && typeof obj[subKey] === 'string') {
    let result: string = obj[subKey];
    if (params) {
      result = result.replace(/\\{(\\w+)\\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
    }
    return result;
  }
  
  // Check for plural variant
  if (params && params.count !== undefined) {
    const pluralKey = subKey + '_plural';
    if (pluralKey in obj && typeof obj[pluralKey] === 'string') {
      let result: string = obj[pluralKey];
      result = result.replace(/\\{(\\w+)\\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
      return result;
    }
  }
  
  return key;
"""

NEW_BODY = """  
  // Check for plural variant FIRST when count !== 1
  if (params && params.count !== undefined && params.count !== 1) {
    const pluralKey = subKey + '_plural';
    if (pluralKey in obj && typeof obj[pluralKey] === 'string') {
      let result: string = obj[pluralKey];
      result = result.replace(/\\{\\{(\\w+)\\}\\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
      return result;
    }
  }
  
  // Fall back to singular
  if (subKey in obj && typeof obj[subKey] === 'string') {
    let result: string = obj[subKey];
    if (params) {
      result = result.replace(/\\{\\{(\\w+)\\}\\}/g, (_: string, p: string) => String(params[p] ?? `{{${p}}}`));
    }
    return result;
  }
  
  return key;
"""

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
fixed = 0

for filename in files:
    fp = os.path.join(test_dir, filename)
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if OLD_BODY in content:
        content = content.replace(OLD_BODY, NEW_BODY)
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  FIXED: {filename}')
        fixed += 1
    else:
        # Try with escaped braces (in case the file has different escaping)
        print(f'  SKIP (pattern not found): {filename}')

print(f'\nFixed {fixed} files')
