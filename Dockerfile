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

# Build-time args for Firebase (passed via --build-arg in docker compose build)
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN=""
ARG VITE_FIREBASE_PROJECT_ID=""
ARG VITE_FIREBASE_STORAGE_BUCKET=""
ARG VITE_FIREBASE_MESSAGING_SENDER_ID=""
ARG VITE_FIREBASE_APP_ID=""

# Expose as ENV so Vite picks them up at build time
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

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

# OpenSSL is required by Prisma to detect the engine variant
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Install production server deps only
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema + generated client + engines from builder
COPY --from=server-builder /server/prisma ./prisma/
COPY --from=server-builder /server/node_modules/.prisma ./node_modules/.prisma
COPY --from=server-builder /server/node_modules/@prisma ./node_modules/@prisma

# Re-generate Prisma client as root (ensures engine binaries have correct permissions)
RUN npx prisma generate

# Copy compiled Express server
COPY --from=server-builder /server/dist ./dist/

# Copy built React SPA into /app/public (Express serves this in production)
COPY --from=client-builder /client/dist ./public/

# Non-root user for security (server runs as this user)
RUN addgroup -S medsearch && adduser -S medsearch -G medsearch
RUN chown -R medsearch:medsearch /app

EXPOSE 4000

# Migrations run as root (needs write to engines), then server starts as medsearch
CMD ["sh", "-c", "npx prisma migrate deploy && su -s /bin/sh medsearch -c 'node dist/server.js'"]

