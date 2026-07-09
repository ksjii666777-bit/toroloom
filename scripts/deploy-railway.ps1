# ============================================================================
# Toroloom — Railway Deployment Setup Script (PowerShell)
# ============================================================================
#
# Usage:
#   .\scripts\deploy-railway.ps1
#
# This script guides you through setting up Toroloom on Railway.
# Prerequisites:
#   - Railway account (https://railway.app)
#   - GitHub repo connected to Railway
#   - Railway CLI installed: npm i -g @railway/cli
# ============================================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Toroloom Railway Deployment Setup"          -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ──── Step 1: JWT Secret ────────────────────────────────────────────────────
Write-Host "Step 1: Generate JWT_SECRET" -ForegroundColor Yellow
$jwtSecret = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
Write-Host "  Your JWT_SECRET: $jwtSecret" -ForegroundColor Green
Write-Host "  Copy this value - you'll need it for Railway Variables." -ForegroundColor Gray
Write-Host ""

# ──── Step 2: Environment Variables ─────────────────────────────────────────
Write-Host "Step 2: Environment Variables to set in Railway Dashboard" -ForegroundColor Yellow
Write-Host "  Go to your Railway project → Backend service → Variables tab"
Write-Host ""
Write-Host "  Add these variables:" -ForegroundColor White
Write-Host "  ┌──────────────────────────┬─────────────────────────────────────┐"
Write-Host "  │ Variable                 │ Value                              │"
Write-Host "  ├──────────────────────────┼─────────────────────────────────────┤"
Write-Host "  │ JWT_SECRET               │ (use the generated secret above)   │"
Write-Host "  │ NODE_ENV                 │ production                         │"
Write-Host "  │ STORAGE_BACKEND          │ postgres                           │"
Write-Host "  │ BROKER                   │ mock                               │"
Write-Host "  │ DATA_SOURCE              │ mock                               │"
Write-Host "  │ CLUSTER_MODE             │ 0                                  │"
Write-Host "  │ SUBSCRIPTION_GATING_ENABLED │ false                           │"
Write-Host "  └──────────────────────────┴─────────────────────────────────────┘"
Write-Host ""

# ──── Step 3: PostgreSQL ───────────────────────────────────────────────────
Write-Host "Step 3: Add PostgreSQL" -ForegroundColor Yellow
Write-Host "  In Railway Dashboard:"
Write-Host "    1. Click '+ New' → 'Database' → 'PostgreSQL'"
Write-Host "    2. Railway will auto-inject DATABASE_URL into your backend"
Write-Host "    3. Update STORAGE_BACKEND to 'postgres' (already set above)"
Write-Host ""
Write-Host "  The schema migration runs automatically on first startup."
Write-Host "  Tables are created via PostgreSQLStorage.migrate()."
Write-Host ""

# ──── Step 4: Redis (Optional) ─────────────────────────────────────────────
Write-Host "Step 4: Add Redis (Optional - for caching)" -ForegroundColor Yellow
Write-Host "  Railway Pro plan required for Redis plugin."
Write-Host "  In Railway Dashboard:"
Write-Host "    1. Click '+ New' → 'Database' → 'Redis'"
Write-Host "    2. Railway auto-injects RAILWAY_REDIS_URL into your backend"
Write-Host ""
Write-Host "  The cacheService.ts automatically detects RAILWAY_REDIS_URL"
Write-Host "  and enables Redis caching for analytics endpoints."
Write-Host ""

# ──── Step 5: Verify Deployment ────────────────────────────────────────────
Write-Host "Step 5: Verify Deployment" -ForegroundColor Yellow
Write-Host "  After deploying, test the health endpoint:"
Write-Host "    curl https://YOUR-SERVICE.up.railway.app/health"
Write-Host ""
Write-Host "  Expected response:"
Write-Host '    {"status":"ok","broker":"mock","storageBackend":"postgres","storageHealthy":true}'
Write-Host ""

# ──── Step 6: Deploy Commands (Railway CLI) ───────────────────────────────
Write-Host "Step 6: Railway CLI Commands (if you prefer CLI over Dashboard)" -ForegroundColor Yellow
Write-Host "  # Login"
Write-Host "  railway login"
Write-Host ""
Write-Host "  # Link to project"
Write-Host "  railway link"
Write-Host ""
Write-Host "  # Set environment variables"
Write-Host "  railway variables set JWT_SECRET=$jwtSecret"
Write-Host "  railway variables set NODE_ENV=production"
Write-Host "  railway variables set STORAGE_BACKEND=postgres"
Write-Host "  railway variables set BROKER=mock"
Write-Host "  railway variables set DATA_SOURCE=mock"
Write-Host "  railway variables set CLUSTER_MODE=0"
Write-Host ""
Write-Host "  # Deploy"
Write-Host "  railway up"
Write-Host ""
Write-Host "  # View logs"
Write-Host "  railway logs"
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!"                              -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
