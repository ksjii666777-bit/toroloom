#!/usr/bin/env python3
"""
============================================================================
Toroloom — Auto I18N Conversion Script
============================================================================

Scans all .tsx screen files for hardcoded user-facing strings and either:
  1. Reports them (dry-run / audit mode)
  2. Generates locale key stubs for manual migration

Usage:
    python scripts/auto-i18n-convert.py --mode audit                # list unconverted screens
    python scripts/auto-i18n-convert.py --mode audit --output report.txt
    python scripts/auto-i18n-convert.py --mode stubs                # generate key stubs
============================================================================
"""

import os
import re
import sys
from pathlib import Path
from collections import defaultdict

# ─── Fix Windows encoding ──────────────────────────────────────────────────
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # type: ignore

# ─── Config ─────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SEARCH_DIRS = [
    PROJECT_ROOT / "src" / "screens",
    PROJECT_ROOT / "src" / "components",
]
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', 'storybook-static', 'backend'}
LOCALE_EN = PROJECT_ROOT / "src" / "i18n" / "locales" / "en.ts"

# ─── Tokens for colored output (cross-platform) ────────────────────────────
CHECK = "[OK]"
CROSS = "[  ]"
WARN_S = "[..]"

# ─── Regex Patterns ────────────────────────────────────────────────────────

# Match <Text>content</Text> — only if content doesn't contain JSX {}
TEXT_CONTENT_RE = re.compile(
    r'<Text[^>]*>'
    r'(?P<content>[A-Za-z][A-Za-z0-9\s.,!?@#$%^&*()\-_=+\[\]|;:\'"<>/`~]{2,}?)'
    r'</Text>'
)

# Match title="..." subtitle="..." placeholder="..." label="..." header="..." description="..."
STRING_PROP_RE = re.compile(
    r'(?:title|subtitle|placeholder|label|header|description|cancelText|confirmText'
    r'|buttonText|okText|doneText)='
    r'"([A-Za-z][A-Za-z0-9\s.,!?@#$%^&*()\-_=+\[\]{}|;:\'"<>/`~]{2,}?)"'
)

# Alert.alert('Title', ...)
ALERT_TITLE_RE = re.compile(
    r"Alert\.alert\(\s*'([^']{3,}?)'"
)

# <Card [title="..."] ...>
CARD_TITLE_RE = re.compile(
    r'<Card\s[^>]*title="([A-Za-z][A-Za-z0-9\s.,!?@#$%^&*()\-_=+\[\]{}|;:\'"<>/`~]{2,}?)"'
)

# useT import check (any relative path depth)
USET_IMPORT_RE = re.compile(r"from\s+['\"]\.\./hooks/useT['\"]")
USET_IMPORT_DEEP_RE = re.compile(r"from\s+['\"](\.\./)+hooks/useT['\"]")


def find_tsx_files(search_dirs: list) -> list[Path]:
    """Recursively find all .tsx files under given directories."""
    files = []
    for d in search_dirs:
        if not d.exists():
            continue
        for root, dirnames, filenames in os.walk(d):
            dirnames[:] = [x for x in dirnames if x not in SKIP_DIRS and not x.startswith('.')]
            for f in filenames:
                if f.endswith('.tsx'):
                    files.append(Path(root) / f)
    return sorted(files)


def read_file(path: Path) -> str:
    try:
        return path.read_text(encoding='utf-8')
    except Exception:
        return ''


def has_use_t(content: str) -> bool:
    """Check if file already imports useT (any depth)."""
    return bool(USET_IMPORT_RE.search(content) or USET_IMPORT_DEEP_RE.search(content))


def extract_component_name(content: str) -> str:
    """Extract main component function name."""
    m = re.search(r'export default function (\w+)', content)
    if m:
        return m.group(1)
    m = re.search(r'function (\w+)', content)
    if m:
        return m.group(1)
    return 'Unknown'


def extract_hardcoded_strings(content: str) -> dict:
    """Extract all hardcoded user-facing strings from a .tsx file content."""
    results = {
        'text_content': [],
        'string_props': [],
        'alert_titles': [],
        'card_titles': [],
    }

    for m in TEXT_CONTENT_RE.finditer(content):
        txt = m.group('content').strip()
        if len(txt) >= 3 and not txt.startswith('{') and not txt.startswith('$'):
            # Skip if it looks like a CSS class or data attribute
            if not txt.startswith('.') and not txt.startswith('#'):
                results['text_content'].append(txt)

    for m in STRING_PROP_RE.finditer(content):
        results['string_props'].append(m.group(1))

    for m in ALERT_TITLE_RE.finditer(content):
        txt = m.group(1).strip()
        if len(txt) >= 3:
            results['alert_titles'].append(txt)

    for m in CARD_TITLE_RE.finditer(content):
        results['card_titles'].append(m.group(1))

    return results


def detect_namespace(file_path: Path) -> str:
    """Detect which locale namespace a screen belongs to."""
    p = str(file_path).lower()
    if 'education' in p or 'course' in p or 'lesson' in p or 'glossary' in p:
        return 'education'
    if 'trade' in p or 'trading' in p or 'fno' in p or 'option' in p or 'strategy' in p:
        return 'trading'
    if 'market' in p:
        return 'market'
    if 'profile' in p or 'setting' in p or 'more' in p:
        return 'profile'
    if 'auth' in p or 'login' in p or 'signup' in p:
        return 'auth'
    if 'portfolio' in p:
        return 'portfolio'
    if 'watchlist' in p:
        return 'watchlist'
    if 'community' in p or 'chat' in p:
        return 'community'
    if 'notification' in p:
        return 'notifications'
    if 'kyc' in p:
        return 'kyc'
    if 'ai' in p:
        return 'ai'
    if 'admin' in p or 'coupon' in p:
        return 'profile'
    if 'calculat' in p:
        return 'calculators'
    if 'subscription' in p or 'premium' in p:
        return 'subscription'
    if 'risk' in p:
        return 'risk'
    if 'certificate' in p:
        return 'education'
    if 'home' in p or 'tab' in p:
        return 'home'
    if 'snaptrade' in p or 'broker' in p:
        return 'profile'
    return 'app'


def generate_key_name(txt: str, used_keys: set) -> str:
    """Generate a camelCase key from a string, avoiding duplicates."""
    # Remove special chars that aren't letters/numbers/spaces
    key = re.sub(r'[^a-zA-Z0-9\s]', '', txt)
    words = key.strip().split()
    if not words:
        return 'unknown'

    result = words[0].lower()
    for w in words[1:]:
        if w:
            result += w[0].upper() + w[1:] if len(w) > 1 else w.upper()

    if len(result) > 45:
        result = result[:45]

    base = result
    counter = 1
    while result in used_keys:
        result = f"{base}_{counter}"
        counter += 1
    used_keys.add(result)
    return result


# ─── Audit Mode ─────────────────────────────────────────────────────────────


def audit_mode(output_file: str = None):
    """Scan all screens and report I18N status."""
    all_files = find_tsx_files(SEARCH_DIRS)
    unconverted = []
    converted_count = 0
    total_strings = 0

    lines = []
    lines.append("=" * 72)
    lines.append("  Toroloom -- I18N Conversion Audit Report")
    lines.append("=" * 72)
    lines.append("")

    for f in all_files:
        content = read_file(f)
        if not content.strip():
            continue

        comp = extract_component_name(content)
        is_done = has_use_t(content)
        strings = extract_hardcoded_strings(content)
        count = sum(len(v) for v in strings.values())

        if is_done:
            converted_count += 1
            if count > 0:
                lines.append(f"  {CHECK} {f.relative_to(PROJECT_ROOT)} ({comp}) -- {count} leftover strings")
            continue

        if count == 0:
            continue

        unconverted.append((f, comp, strings))
        total_strings += count
        ns = detect_namespace(f)

        lines.append(f"  {CROSS} {f.relative_to(PROJECT_ROOT)}")
        lines.append(f"         Component: {comp}  |  Namespace: {ns}")

        cats = [
            ('Text content', strings['text_content']),
            ('Title/subtitle props', strings['string_props']),
            ('Alert titles', strings['alert_titles']),
            ('Card titles', strings['card_titles']),
        ]
        for label, items in cats:
            if items:
                lines.append(f"         {WARN_S} {label} ({len(items)}):")
                for item in items[:8]:
                    d = item[:70] + '...' if len(item) > 70 else item
                    lines.append(f"            - \"{d}\"")
                if len(items) > 8:
                    lines.append(f"            ... +{len(items) - 8} more")

    lines.append("")
    lines.append("-" * 72)
    lines.append(f"  Summary")
    lines.append(f"     Already converted:     {converted_count}")
    lines.append(f"     Needs conversion:      {len(unconverted)}")
    lines.append(f"     Total hardcoded strings: {total_strings}")
    lines.append("-" * 72)

    if unconverted:
        ranked = sorted(unconverted,
                        key=lambda x: sum(len(v) for v in x[2].values()),
                        reverse=True)
        lines.append("")
        lines.append("  Top screens needing most work:")
        for i, (f, comp, strings) in enumerate(ranked[:15], 1):
            c = sum(len(v) for v in strings.values())
            lines.append(f"     {i:2d}. {f.relative_to(PROJECT_ROOT)} ({c} strings)")

    lines.append("")

    output = '\n'.join(lines)
    if output_file:
        Path(output_file).write_text(output, encoding='utf-8')
        print(f"\nReport written to: {output_file}")
    else:
        print(output)


# ─── Stub Generation Mode ──────────────────────────────────────────────────


def stubs_mode():
    """Generate locale key stubs for unconverted screens."""
    all_files = find_tsx_files(SEARCH_DIRS)
    generated = defaultdict(list)
    existing_keys = set()
    en_content = read_file(LOCALE_EN)
    for m in re.finditer(r"^\s+(\w[\w]+):\s*'", en_content, re.MULTILINE):
        existing_keys.add(m.group(1))
    used_keys = existing_keys.copy()

    found = 0

    for f in all_files:
        content = read_file(f)
        if not content.strip() or has_use_t(content):
            continue

        strings = extract_hardcoded_strings(content)
        count = sum(len(v) for v in strings.values())
        if count == 0:
            continue

        ns = detect_namespace(f)
        found += 1

        all_texts = []
        for items in strings.values():
            all_texts.extend(items)

        for txt in all_texts:
            key = generate_key_name(txt, used_keys)
            val = txt.replace("'", "\\'")
            generated[ns].append((key, val))

    if not generated:
        print("No unconverted screens found with extractable strings.")
        return

    stub_path = PROJECT_ROOT / "src" / "i18n" / "generated_keys_stub.ts"
    with open(stub_path, 'w', encoding='utf-8') as f:
        f.write("// ==================================================================\n")
        f.write("// AUTO-GENERATED LOCALE KEY STUBS\n")
        f.write("// Copy these keys into en.ts + hi.ts, translate, then delete this file.\n")
        f.write("// Generated by: scripts/auto-i18n-convert.py --mode stubs\n")
        f.write("// ==================================================================\n\n")
        f.write("/* eslint-disable */\n")
        f.write("// @ts-nocheck\n\n")
        f.write("const generatedStubs = {\n")
        for ns in sorted(generated.keys()):
            entries = generated[ns]
            f.write(f"  // -- {ns} ({len(entries)} keys) --\n")
            for key, val in entries:
                f.write(f"  {key}: '{val}',\n")
        f.write("};\n\n")
        f.write("export default generatedStubs;\n")

    total_keys = sum(len(v) for v in generated.values())
    print(f"\nGenerated {total_keys} key stubs across {len(generated)} namespaces")
    print(f"Stub file: {stub_path.relative_to(PROJECT_ROOT)}")
    print("Next: Copy keys into en.ts, translate in hi.ts, then convert screens.")


# ─── CLI ────────────────────────────────────────────────────────────────────


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Toroloom Auto I18N Tool')
    parser.add_argument('--mode', choices=['audit', 'stubs'], default='audit',
                        help='audit=report, stubs=generate locale key stubs')
    parser.add_argument('--output', '-o', type=str, default=None,
                        help='Output file for audit report')

    args = parser.parse_args()

    if args.mode == 'audit':
        audit_mode(output_file=args.output)
    elif args.mode == 'stubs':
        stubs_mode()


if __name__ == '__main__':
    main()
