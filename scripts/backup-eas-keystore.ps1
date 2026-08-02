# ============================================================================
# Toroloom — EAS Android Keystore Backup Helper (Windows PowerShell)
# ============================================================================
# Purpose:
#   The Android signing keystore for com.toroloom.app is managed by EAS
#   (Expo Application Services). If the keystore is lost, Google Play will
#   never accept a new release under the same package ID again. This script
#   downloads the keystore + credentials and stores them in a safe local
#   folder so the release can always be updated.
#
# Run (from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts/backup-eas-keystore.ps1
#
# Pre-requisites:
#   - Node.js + npm installed
#   - EAS CLI available (installs automatically if missing)
#   - You are logged in to Expo (eas login) with owner hgdghdghh
# ============================================================================

$ErrorActionPreference = 'Stop'
$BACKUP_DIR = Join-Path $PWD 'store/keystore-backup'

Write-Host ''
Write-Host '==================================================' -ForegroundColor Cyan
Write-Host ' TOROLOOM — EAS ANDROID KEYSTORE BACKUP' -ForegroundColor Cyan
Write-Host '==================================================' -ForegroundColor Cyan
Write-Host ''

# 1. Ensure EAS CLI is available
Write-Host '[1/4] Checking EAS CLI...' -ForegroundColor Yellow
$easCli = Get-Command npx -ErrorAction SilentlyContinue
if (-not $easCli) {
    Write-Error 'Node.js/npm not found. Install Node.js first.'
    exit 1
}

# 2. Create backup folder
Write-Host '[2/4] Creating backup folder...' -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

# 3. Download credentials (interactive — follow the prompts)
Write-Host '[3/4] Opening EAS credentials manager...' -ForegroundColor Yellow
Write-Host '      Select: Android -> Keystore -> "Download keystore from Expo servers"' -ForegroundColor Green
Write-Host '      Save the .jks file + the printed credentials into:' -ForegroundColor Green
Write-Host "      $BACKUP_DIR" -ForegroundColor Green
Write-Host ''
npx eas-cli credentials --platform android

# 4. Post-backup guidance
Write-Host ''
Write-Host '[4/4] DONE.' -ForegroundColor Green
Write-Host ''
Write-Host 'What should now be in the backup folder:' -ForegroundColor Cyan
Write-Host '  1. <project>.jks            — the actual signing keystore' -ForegroundColor White
Write-Host '  2. A credentials JSON/text  — keystore password, key alias, key password' -ForegroundColor White
Write-Host ''
Write-Host 'CRITICAL SAFETY RULES:' -ForegroundColor Red
Write-Host '  - Store these OFFLINE (USB drive / password manager / cloud vault).' -ForegroundColor Red
Write-Host '  - NEVER commit the .jks or passwords to git.' -ForegroundColor Red
Write-Host '  - The .gitignore already excludes keystore files — verify:' -ForegroundColor Yellow
Write-Host "    $BACKUP_DIR" -ForegroundColor Yellow
Write-Host ''
Write-Host 'Verification (optional but recommended):' -ForegroundColor Cyan
Write-Host '  keytool -list -keystore store\keystore-backup\<file>.jks -storepass <password>' -ForegroundColor White
Write-Host '  -> should print the certificate fingerprints (SHA1/SHA256) matching Play Console.' -ForegroundColor White
Write-Host ''
