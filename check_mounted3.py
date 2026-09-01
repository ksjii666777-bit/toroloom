import re, glob

all_backend = set()
for fn in glob.glob('backend/src/routes/*.ts'):
    fname = fn.split('\\')[-1].replace('.ts', '')
    with open(fn) as f:
        for line in f:
            m = re.match(r"\s*router\.(get|post|put|delete|patch)\(\s*['\"]([^'\"]+)['\"]", line)
            if m:
                all_backend.add(fname + ':' + m.group(2))

print('Total backend mounted routes:', len(all_backend))
for r in sorted(all_backend):
    if 'auth' in r or 'login' in r or 'signup' in r:
        print(' ', r)

# Now full prefix paths
all_paths = set()
with open('backend/src/server.ts') as f:
    for line in f:
        m = re.match(r"\s*app\.use\(['\"]([^'\"]+)['\"]", line)
        if m:
            prefix = m.group(1)
            ids = re.findall(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b', line)
            last = ids[-1]
            # Map last -> file
            fname = last.replace('Routes', '').lower()
            # Use simple lookup
            for r in all_backend:
                if r.startswith(fname + ':'):
                    inner = r.split(':', 1)[1]
                    full = f"{prefix}{inner}"
                    full = re.sub(r"/+", "/", full)
                    all_paths.add(full)

print('Total full paths:', len(all_paths))
for r in sorted(all_paths)[:30]:
    print(' ', r)