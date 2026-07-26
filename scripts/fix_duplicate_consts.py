"""
Simple script to remove duplicate const declarations from patched test files.
Keeps the LAST occurrence of each const name (the one closest to the vi.mock call).
"""
import os

FILES = [
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

NS_NAMES = ['ipos', 'profile', 'trading', 'education', 'reports', 'time', 'errors', 'extra']
FUNC_NAMES = ['resolveT']

def deduplicate_file(filepath):
    """Remove duplicate const and function declarations, keeping the LAST occurrence."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Strategy: find all occurrences of each const/function name
    # and remove all but the LAST occurrence.
    # We do this by tracking which lines to keep.
    
    # First pass: find positions of all declarations
    decl_positions = {}  # name -> [line_indices]
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        for ns_name in NS_NAMES:
            if stripped.startswith(f'const {ns_name} =') or stripped.startswith(f'const {ns_name}:'):
                if ns_name not in decl_positions:
                    decl_positions[ns_name] = []
                decl_positions[ns_name].append(i)
        
        for func_name in FUNC_NAMES:
            if stripped.startswith(f'function {func_name}('):
                if func_name not in decl_positions:
                    decl_positions[func_name] = []
                decl_positions[func_name].append(i)
    
    # Build set of line indices to remove (all but the LAST for each name)
    lines_to_remove = set()
    
    for name, positions in decl_positions.items():
        if len(positions) > 1:
            # Remove all but the last occurrence
            for pos in positions[:-1]:
                lines_to_remove.add(pos)
    
    if not lines_to_remove:
        print(f'  No duplicates in {os.path.basename(filepath)}')
        return False
    
    # For each line to remove, we need to remove the ENTIRE code block
    # (const blocks span multiple lines from declaration to ;)
    # Strategy: remove lines from the declaration line through to the end of the block.
    ranges_to_remove = []
    
    for pos in sorted(lines_to_remove):
        stripped = lines[pos].strip()
        
        # Determine the type of declaration
        is_const = any(stripped.startswith(f'const {n} =') or stripped.startswith(f'const {n}:') for n in NS_NAMES)
        is_func = any(stripped.startswith(f'function {n}(') for n in FUNC_NAMES)
        
        if is_const:
            # Find the end of this const block
            # It ends at "};" on its own line
            end_pos = pos
            while end_pos < len(lines):
                if lines[end_pos].strip() == '};' or lines[end_pos].strip() == '};':
                    break
                end_pos += 1
            ranges_to_remove.append((pos, end_pos + 1))  # +1 to include the }; line
        
        elif is_func:
            # Find the end of this function (brace matching)
            brace_depth = 0
            end_pos = pos
            started = False
            while end_pos < len(lines):
                for ch in lines[end_pos]:
                    if ch == '{':
                        brace_depth += 1
                        started = True
                    elif ch == '}':
                        brace_depth -= 1
                        if started and brace_depth == 0:
                            break
                if started and brace_depth == 0:
                    break
                end_pos += 1
            ranges_to_remove.append((pos, end_pos + 1))
    
    # Apply removals in reverse order (to preserve line numbers)
    ranges_to_remove.sort(key=lambda r: r[0], reverse=True)
    
    for start, end in ranges_to_remove:
        # Mark removed lines
        for i in range(start, end):
            if i < len(lines):
                lines[i] = None  # Mark for removal
    
    # Filter out None lines
    new_lines = [l for l in lines if l is not None]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print(f'  Fixed {os.path.basename(filepath)} - removed {len(ranges_to_remove)} blocks')
    return True


def main():
    test_dir = 'src/__tests__'
    fixed = 0
    
    for filename in FILES:
        filepath = os.path.join(test_dir, filename)
        if not os.path.exists(filepath):
            print(f'  NOT FOUND: {filepath}')
            continue
        if deduplicate_file(filepath):
            fixed += 1
    
    print(f'\nDone: {fixed} files fixed')


if __name__ == '__main__':
    main()
