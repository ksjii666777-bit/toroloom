import json, sys

r = json.load(sys.stdin)
for f in r:
    msgs = [x for x in f.get('messages', []) if 'exhaustive-deps' in (x.get('ruleId') or '')]
    if msgs:
        fp = f.get('filePath', '')
        fn = fp.split('Toroloom')[-1] if 'Toroloom' in fp else fp
        print(f'\n=== {fn} ===')
        for m in msgs:
            k = 'MISS' if 'unnecessary' not in m.get('message', '') else 'UNNE'
            print(f'  L{m["line"]} [{k}] {m["message"][:200]}')
