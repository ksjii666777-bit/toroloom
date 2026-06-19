# ============================================================================
# Toroloom Backend — Production Dockerfile
# ============================================================================
#
# Multi-stage build:
#   Stage 1 (builder) — install all deps + compile TypeScript
#   Stage 2 (runner)  — copy only production artifacts, minimal footprint
#
# Build:
#   docker build -t toroloom-backend -f backend/Dockerfile backend/
#
# Run:
#   docker run -p 3000:3000 --env-file backend/.env toroloom-backend
# ============================================================================

# ──── Stage 1: Builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (for better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

# Compile TypeScript → dist/
RUN npm run build

# Prune dev dependencies (keeps only production deps in node_modules)
RUN npm prune --omit=dev

# ──── Stage 2: Runner ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Create a non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Copy production artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Healthcheck (uses the Express /health endpoint)
# Uses node -e instead of wget because Alpine's busybox wget
# doesn't support --spider.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Switch to non-root user
USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
