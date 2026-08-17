# ── Stage 1: Build the Vite React app ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# In production, the Nginx reverse proxy handles /api → backend,
# so the frontend talks to the same origin (empty base or "/").
ENV VITE_API_BASE=""
RUN npm run build

# ── Stage 2: Serve with Nginx ────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default Nginx site
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/medsearch.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
