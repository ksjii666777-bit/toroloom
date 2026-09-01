import re, os, glob

os.chdir('C:/Users/Karan/Desktop/New folder/Toroloom/toroloom_repo')

with open('backend/src/server.ts') as f:
    server = f.read()

# Show all mounts
for line in server.split('\n'):
    m = re.match(r"\s*app\.use\(['\"]([^'\"]+)['\"]", line)
    if m:
        # Get the last identifier
        ids = re.findall(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b', line)
        print(f"  prefix={m.group(1):40s}  last_id={ids[-1]}")

# Check what /api/auth/login resolves to
print("\n--- /api/auth/login check ---")
m = re.search(r"app\.use\(['\"]/api/auth['\"].*?authRoutes\)", server)
if m:
    print("auth mount line:", m.group(0)[:120])