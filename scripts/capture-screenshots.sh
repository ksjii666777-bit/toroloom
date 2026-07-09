#!/usr/bin/env bash
# =============================================================================
# Toroloom — App Store Screenshot Capture Pipeline
# =============================================================================
# Orchestrates automated screenshot capture for App Store and Google Play
# Store listings using Maestro E2E flows.
#
# Prerequisites:
#   1. Maestro CLI installed (https://maestro.mobile.dev)
#   2. Android emulator running (Pixel 6 Pro API 34 recommended)
#   3. Expo dev server running (npx expo start)
#   4. Backend API accessible
#
# Usage:
#   ./scripts/capture-screenshots.sh                  # Default (Android capture + resize for both stores)
#   ./scripts/capture-screenshots.sh --android-only    # Android capture only (skip iOS resize)
#   ./scripts/capture-screenshots.sh --clean           # Clean output dir first
#
# Output:
#   store/screenshots/android/  — Resized for Google Play Console
#   store/screenshots/ios/      — Resized for App Store Connect
#   store/screenshots/raw/      — Original uncropped screenshots from Maestro
#
# App Store required sizes:
#   - 6.7" iPhone: 1290 × 2796 px  (iPhone 14/15 Pro Max)
#   - 6.5" iPhone: 1284 × 2778 px  (iPhone 14/15 Plus)
#   - 5.5" iPhone: 1242 × 2208 px  (iPhone 8 Plus)
#   - 6.9" iPhone: 1320 × 2868 px  (iPhone 17 Pro Max)
#
# Google Play required sizes:
#   - Phone: 1080 × 1920 px (9:16) minimum
#
# iOS Capture: To capture on iOS simulator, run Maestro directly:
#   maestro test .maestro/flows/screenshots/capture.yaml --app-id host.exp.Exponent
# Then use this script with --ios-only to resize the outputs.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Config ──────────────────────────────────────────────────────────────────
MAESTRO_OUTPUT_DIR="$PROJECT_DIR/.maestro/screenshots"
STORE_SCREENSHOTS_DIR="$PROJECT_DIR/store/screenshots"
RAW_DIR="$STORE_SCREENSHOTS_DIR/raw"
IOS_DIR="$STORE_SCREENSHOTS_DIR/ios"
ANDROID_DIR="$STORE_SCREENSHOTS_DIR/android"

# Toroloom dark theme background color (matches app's actual design)
BG_COLOR="#0B0F19"

# App Store sizes (iPhone)
declare -A IOS_SIZES
IOS_SIZES["iPhone-6-7"]="1290x2796"   # iPhone 14/15 Pro Max
IOS_SIZES["iPhone-6-5"]="1284x2778"   # iPhone 14/15 Plus
IOS_SIZES["iPhone-5-5"]="1242x2208"   # iPhone 8 Plus

# Google Play sizes
ANDROID_SIZE="1080x1920"

# Logging
log()   { echo "  → $1"; }
info()  { echo ""; echo "==> $1"; echo ""; }
error() { echo "  ✗ $1" >&2; }

# ── Parse args ──────────────────────────────────────────────────────────────
CAPTURE_ANDROID=true
RESIZE_IOS=true
CLEAN_OUTPUT=false

for arg in "$@"; do
  case "$arg" in
    --android-only) RESIZE_IOS=false ;;
    --clean) CLEAN_OUTPUT=true ;;
    --help)
      echo "Usage: $0 [--android-only] [--clean]"
      echo ""
      echo "  --android-only     Skip iOS resize step (use when capturing Android screenshots only)"
      echo "  --clean            Remove previous output before capturing"
      echo ""
      echo "For iOS capture, run Maestro directly with iOS appId, then use --android-only"
      echo "to resize only the iOS outputs:"
      echo "  maestro test .maestro/flows/screenshots/capture.yaml --app-id host.exp.Exponent"
      echo "  $0 --android-only"
      exit 0
      ;;
  esac
done

# ── Pre-flight checks ───────────────────────────────────────────────────────
info "Pre-flight checks"

if ! command -v maestro &> /dev/null; then
  error "Maestro CLI not found. Install: curl -Ls https://get.maestro.mobile.dev | bash"
  exit 1
fi

# Detect ImageMagick (supports both v6 `convert` and v7 `magick`)
CONVERT_CMD=""
if command -v magick &> /dev/null; then
  CONVERT_CMD="magick"
elif command -v convert &> /dev/null; then
  CONVERT_CMD="convert"
fi

if [ -z "$CONVERT_CMD" ]; then
  log "ImageMagick not found — resize step will be skipped."
  log "Install: brew install imagemagick"
  SKIP_RESIZE=true
else
  SKIP_RESIZE=false
  log "ImageMagick: found ($CONVERT_CMD)"
fi

log "Maestro: $(maestro --version)"

# ── Clean previous output ──────────────────────────────────────────────────
if [ "$CLEAN_OUTPUT" = true ]; then
  info "Cleaning output directories"
  rm -rf "$RAW_DIR" "$IOS_DIR" "$ANDROID_DIR"
  log "Cleaned $STORE_SCREENSHOTS_DIR"
fi

mkdir -p "$RAW_DIR" "$IOS_DIR" "$ANDROID_DIR"

# ── Step 1: Capture screenshots via Maestro (Android) ───────────────────────
info "Step 1: Capturing screenshots via Maestro"

# Start fresh by removing previous Maestro screenshots
rm -f "$MAESTRO_OUTPUT_DIR"/*.png

log "Running Maestro screenshot flow on Android emulator..."
log "  appId: host.exp.exponent (Expo Go)"
maestro test "$PROJECT_DIR/.maestro/flows/screenshots/capture.yaml" \
  --app-id host.exp.exponent \
  --env TEST_EMAIL="test@toroloom.com" \
  --env TEST_PASSWORD="password123"

# ── Step 2: Copy raw screenshots ────────────────────────────────────────────
info "Step 2: Copying raw screenshots"

if [ -d "$MAESTRO_OUTPUT_DIR" ]; then
  cp "$MAESTRO_OUTPUT_DIR"/*.png "$RAW_DIR"/ 2>/dev/null || true
  RAW_COUNT=$(ls -1 "$RAW_DIR"/*.png 2>/dev/null | wc -l)
  log "Copied $RAW_COUNT screenshots to store/screenshots/raw/"
else
  RAW_COUNT=0
  log "No screenshots found in $MAESTRO_OUTPUT_DIR"
  log "Make sure your emulator/device is running and Maestro can connect."
fi

if [ "$RAW_COUNT" -eq 0 ]; then
  error "No screenshots captured — nothing to resize. Exiting."
  exit 1
fi

# ── Step 3: Resize for App Store (iOS) ──────────────────────────────────────
if [ "$RESIZE_IOS" = true ] && [ "$SKIP_RESIZE" = false ]; then
  info "Step 3: Resizing for App Store (iOS)"

  for size_name in "${!IOS_SIZES[@]}"; do
    size="${IOS_SIZES[$size_name]}"
    dest_dir="$IOS_DIR/$size_name"
    mkdir -p "$dest_dir"

    for screenshot in "$RAW_DIR"/*.png; do
      filename=$(basename "$screenshot")
      output="$dest_dir/${filename%.png}-${size_name}.png"

      "$CONVERT_CMD" "$screenshot" \
        -resize "${size}^" \
        -gravity center \
        -extent "$size" \
        -background "$BG_COLOR" \
        "$output"
    done

    IOS_COUNT=$(ls -1 "$dest_dir" | wc -l)
    log "iOS $size_name ($size): $IOS_COUNT screenshots"
  done
elif [ "$SKIP_RESIZE" = true ]; then
  log "iOS resize skipped — ImageMagick not installed"
fi

# ── Step 4: Resize for Google Play (Android)────────────────────────────────
if [ "$SKIP_RESIZE" = false ]; then
  info "Step 4: Resizing for Google Play (Android)"

  for screenshot in "$RAW_DIR"/*.png; do
    filename=$(basename "$screenshot")
    output="$ANDROID_DIR/$filename"

    "$CONVERT_CMD" "$screenshot" \
      -resize "${ANDROID_SIZE}^" \
      -gravity center \
      -extent "$ANDROID_SIZE" \
      -background "$BG_COLOR" \
      "$output"
  done

  ANDROID_COUNT=$(ls -1 "$ANDROID_DIR" | wc -l)
  log "Android ($ANDROID_SIZE): $ANDROID_COUNT screenshots"
else
  log "Android resize skipped — ImageMagick not installed"
fi

# ── Step 5: Generate summary ────────────────────────────────────────────────
info "Step 5: Summary"

echo ""
echo "  ┌────────────────────────────────────────────────────────────┐"
echo "  │              Screenshot Capture Complete 🎉               │"
echo "  ├────────────────────────────────────────────────────────────┤"
echo "  │  Raw:        store/screenshots/raw/                       │"
echo "  │  iOS:        store/screenshots/ios/                       │"
echo "  │  Android:    store/screenshots/android/                   │"
echo "  │                                                           │"
echo "  │  Next steps:                                              │"
echo "  │  1. Review screenshots in store/screenshots/raw/          │"
echo "  │  2. Crop/retouch any screenshots that need polish         │"
echo "  │  3. Upload to App Store Connect / Google Play Console     │"
echo "  │                                                           │"
echo "  │  Tip: For multi-language screenshots, run this script     │"
echo "  │  with different emulator locales:                         │"
echo "  │    adb shell setprop persist.sys.locale hi-IN             │"
echo "  │    ./scripts/capture-screenshots.sh                       │"
echo "  └────────────────────────────────────────────────────────────┘"
echo ""
