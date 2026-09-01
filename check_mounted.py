import re, os, glob

os.chdir('C:/Users/Karan/Desktop/New folder/Toroloom/toroloom_repo')

fe_paths = set()
for fn in glob.glob('src/services/**/*.ts', recursive=True):
    with open(fn) as f:
        content = f.read()
    matches = re.findall(r"api\.(?:get|post|put|delete|patch)<[^>]*>\(\s*['\"]([^'\"]+)['\"]", content)
    for p in matches:
        if p.startswith('/api'):
            fe_paths.add(p)
        else:
            fe_paths.add('/api' + p)

with open('backend/src/server.ts') as f:
    server = f.read()

var_to_file = {}
for m in re.finditer(r"import\s+(.+?)\s+from\s+['\"]\.?/?routes/(\w+)['\"]", server):
    names = m.group(1)
    fname = m.group(2)
    for nm in re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\b", names):
        if nm != 'default':
            var_to_file[nm] = fname

mounted = {}
SEP = '\\' if '\\' in glob.glob('backend/src/routes/*.ts')[0] else '/'
for fn in glob.glob('backend/src/routes/*.ts'):
    fname = fn.split(SEP)[-1].replace('.ts', '')
    routes = []
    with open(fn) as f:
        for line in f:
            m = re.match(r"\s*router\.(get|post|put|delete|patch)\(\s*['\"]([^'\"]+)['\"]", line)
            if m:
                routes.append((m.group(1).upper(), m.group(2)))
    mounted[fname] = routes

server_mits = []
for line in server.split('\n'):
    m = re.match(r"\s*app\.use\(['\"]([^'\"]+)['\"]", line)
    if not m:
        continue
    prefix = m.group(1)
    ids = re.findall(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b', line)
    skip = {'app','use','express','path','__dirname','static','join','raw','json',
            'urlencoded','Router','path','Object','require','module','exports',
            'limiter','middleware','function','helmet','cors','text','encoded',
            'cookieParser','logger','compression','corsOptions'}
    candidates = [i for i in ids if i not in skip and not i.endswith('Request') and not i.endswith('Response')]
    router_var = None
    for c in candidates:
        if c.endswith('Routes') or c.endswith('Router'):
            router_var = c
            break
    if not router_var and candidates:
        router_var = candidates[-1]
    server_mits.append((prefix, router_var))

all_backend = set()
for prefix, var in server_mits:
    if not var:
        continue
    fname = var_to_file.get(var)
    if not fname:
        continue
    for method, path in mounted.get(fname, []):
        full = f"{prefix}{path}"
        full = re.sub(r"/+", "/", full)
        all_backend.add(full)
        # Also add variant with trailing / for '' routes
        if path == '/' or path == '':
            all_backend.add(prefix.rstrip('/'))

print(f"Frontend paths: {len(fe_paths)}")
print(f"Backend paths (with / variants): {len(all_backend)}")

missing = []
for p in sorted(fe_paths):
    if p in all_backend:
        continue
    matched = False
    for entry in all_backend:
        # try as exact match first
        regex = re.sub(r":\w+", "[^/]+", entry)
        # also handle empty path = root
        if regex == '':
            regex = '/'
        if re.fullmatch(regex, p):
            matched = True
            break
    if not matched:
        missing.append(p)

print(f"\n=== {len(missing)} frontend paths NOT FOUND in backend routes ===")
for m in missing:
    print(f"  {m}")