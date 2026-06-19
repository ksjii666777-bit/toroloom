# === Toroloom: Redirect cache/temp to E: drive (persistent) ===
[System.Environment]::SetEnvironmentVariable("NODE_ENV_CACHE", "E:\ExpoCache", "User")
[System.Environment]::SetEnvironmentVariable("TMP", "E:\ExpoTemp", "User")
[System.Environment]::SetEnvironmentVariable("TEMP", "E:\ExpoTemp", "User")

# Also set for current session
$env:NODE_ENV_CACHE = "E:\ExpoCache"
$env:TMP = "E:\ExpoTemp"
$env:TEMP = "E:\ExpoTemp"

Write-Host "=== Environment Variables Set ==="
Write-Host "NODE_ENV_CACHE = $env:NODE_ENV_CACHE"
Write-Host "TMP = $env:TMP"
Write-Host "TEMP = $env:TEMP"
Write-Host ""

# Also add to PowerShell profile for future sessions
$profilePath = [System.Environment]::GetFolderPath('MyDocuments') + "\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
# Ensure profile directory exists
$profileDir = Split-Path $profilePath -Parent
if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }

# Check if already in profile
$existing = Get-Content $profilePath -ErrorAction SilentlyContinue
if ($existing -match "NODE_ENV_CACHE") {
    Write-Host "Env vars already in PowerShell profile. Updating..."
    $newContent = @()
    foreach ($line in $existing) {
        if ($line -match 'NODE_ENV_CACHE|TMP.*ExpoTemp|TEMP.*ExpoTemp|Toroloom.*redirect') {
            # skip old lines
        } else {
            $newContent += $line
        }
    }
    $newContent += ""
    $newContent += "# === Toroloom: Redirect cache/temp to E: drive ==="
    $newContent += '${env:NODE_ENV_CACHE} = "E:\ExpoCache"'
    $newContent += '${env:TMP} = "E:\ExpoTemp"'
    $newContent += '${env:TEMP} = "E:\ExpoTemp"'
    $newContent += "# ============================================="
    $newContent | Set-Content $profilePath -Force
} else {
    Add-Content $profilePath -Value "`r`n# === Toroloom: Redirect cache/temp to E: drive ==="
    Add-Content $profilePath -Value '${env:NODE_ENV_CACHE} = "E:\ExpoCache"'
    Add-Content $profilePath -Value '${env:TMP} = "E:\ExpoTemp"'
    Add-Content $profilePath -Value '${env:TEMP} = "E:\ExpoTemp"'
    Add-Content $profilePath -Value "# ============================================="
}
Write-Host "Profile updated: $profilePath"
Write-Host ""

# Create the directories if they don't exist
if (-not (Test-Path "E:\ExpoCache")) { New-Item -ItemType Directory -Path "E:\ExpoCache" -Force | Out-Null; Write-Host "Created E:\ExpoCache" }
if (-not (Test-Path "E:\ExpoTemp")) { New-Item -ItemType Directory -Path "E:\ExpoTemp" -Force | Out-Null; Write-Host "Created E:\ExpoTemp" }
Write-Host ""

Write-Host "=== Verification ==="
Write-Host "Current session NODE_ENV_CACHE = $env:NODE_ENV_CACHE"
Write-Host "Current session TMP = $env:TMP"
Write-Host "Current session TEMP = $env:TEMP"
Write-Host "User-level NODE_ENV_CACHE = $([System.Environment]::GetEnvironmentVariable('NODE_ENV_CACHE', 'User'))"
Write-Host "User-level TMP = $([System.Environment]::GetEnvironmentVariable('TMP', 'User'))"
Write-Host "User-level TEMP = $([System.Environment]::GetEnvironmentVariable('TEMP', 'User'))"
