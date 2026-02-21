# Prometheus Agent - Docker Image
# Includes OpenClaw + Prometheus plugin + DBC tools

FROM node:20-slim AS builder

WORKDIR /app

# Copy OpenClaw (peer dependency)
COPY openclaw/ ./openclaw/
RUN cd openclaw && npm install --production

# Copy and build Prometheus plugin
COPY package.json tsconfig.json ./
COPY src/ ./src/
COPY contracts/ ./contracts/
COPY skills/ ./skills/

RUN npm install
RUN npm run build

# --- Runtime stage ---
FROM node:20-slim

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/openclaw.plugin.json ./
COPY --from=builder /app/contracts/compiled ./contracts/compiled
COPY --from=builder /app/skills ./skills

# Copy OpenClaw runtime
COPY --from=builder /app/openclaw ./openclaw

# Create data directory
RUN mkdir -p /app/data

# Environment
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "const s=require('fs').readFileSync('/app/data/status.json','utf-8');const d=JSON.parse(s);process.exit(d.alive?0:1)" || exit 1

# Run OpenClaw with Prometheus plugin
CMD ["node", "openclaw/dist/index.js", "--plugin", "./dist/index.js"]
