# =============================================================================
# MedSearch — Unified Dockerfile (Express serves API + React SPA)
# =============================================================================
# Builds both client and server into a single lean container.
# Result: ONE process serves everything — no separate Nginx container needed.
# =============================================================================

# ── Stage 1: Build React client ──────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ .

# Empty VITE_API_BASE → relative URLs → same-origin requests
ENV VITE_API_BASE=""
RUN npm run build

# ── Stage 2: Build Express server ────────────────────────────────────
FROM node:20-alpine AS server-builder

WORKDIR /server
COPY server/package.json server/package-lock.json ./
COPY server/prisma ./prisma/
RUN npm ci
RUN npx prisma generate

COPY server/tsconfig.json ./
COPY server/src ./src/
RUN npm run build

# ── Stage 3: Production runner ───────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install production server deps only
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema + generated client
COPY --from=server-builder /server/prisma ./prisma/
COPY --from=server-builder /server/node_modules/.prisma ./node_modules/.prisma
COPY --from=server-builder /server/node_modules/@prisma ./node_modules/@prisma

# Copy compiled Express server
COPY --from=server-builder /server/dist ./dist/

# Copy built React SPA into /app/public (Express serves this in production)
COPY --from=client-builder /client/dist ./public/

# Non-root user for security
RUN addgroup -S medsearch && adduser -S medsearch -G medsearch
USER medsearch

EXPOSE 4000

# Run migrations then start Express (serves both API + frontend)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
