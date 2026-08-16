# MedSearch — PubMed Semantic Search (Corporate Build)

A production-grade web application for biomedical researchers to search PubMed/PMC
using **natural-language semantic search** (powered by NCBI's public LitSense 2.0 API),
with authentication, role-based access, bookmarking, search history, and admin analytics.

This is a real full-stack application — a Node/Express + PostgreSQL + Redis backend and a
Vite + React + TypeScript frontend that consumes it. Sessions, users, bookmarks, and history
all persist in a real database.

---

## Architecture

```
Medsearch/
├── server/                 # Express + TypeScript + Prisma + PostgreSQL + Redis
│   ├── src/
│   │   ├── config/         # env-based configuration
│   │   ├── db/             # prisma client + seed
│   │   ├── cache/          # redis cache wrapper
│   │   ├── external/       # LitSense + E-utilities clients (rate-limited, cached)
│   │   ├── middleware/     # auth, rate-limit, error handling, csrf
│   │   ├── routes/         # auth, search, bookmarks, history, account, admin
│   │   ├── services/       # business logic
│   │   ├── utils/          # logger, tokens, hashing
│   │   └── server.ts
│   └── prisma/schema.prisma
├── client/                # Vite + React + TS
│   └── src/
│       ├── api/           # typed API client
│       ├── context/       # auth context
│       ├── components/    # reusable UI
│       └── pages/         # Search, Bookmarks, History, Profile, Admin, Login, Signup
├── docker-compose.yml     # PostgreSQL + Redis for local dev
└── README.md
```

### Tech choices
- **Backend**: Node 20+, Express, TypeScript, Prisma (PostgreSQL), Redis (ioredis),
  bcrypt, JWT (short-lived access + rotating httpOnly refresh cookie), zod validation,
  helmet, pino structured logging, express-rate-limit.
- **Frontend**: Vite, React 18, TypeScript, React Router, accessible components with
  visible focus states, ARIA labels, keyboard nav, and sufficient color contrast.
- **External APIs**: NCBI LitSense 2.0 (semantic retrieval) + NCBI E-utilities
  (esummary for article metadata), both server-side rate-limited and cached in Redis.

---

## Quick start (local dev)

### Prerequisites
- Node.js 20+ (tested on Node 24)
- Docker (for PostgreSQL + Redis) — or running instances of your own

### 1. Start PostgreSQL + Redis
```powershell
docker compose up -d
```
(Uses `postgres:16-alpine` on `:5432` and `redis:7-alpine` on `:6379`.)

### 2. Configure backend
```powershell
cd server
Copy-Item .env.example .env   # then edit secrets
npm install
npx prisma migrate dev --name init
npm run seed                  # creates an admin user (see below)
npm run dev                   # http://localhost:4000
```

### 3. Configure frontend
```powershell
cd client
Copy-Item .env.example .env.local
npm install
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173 — the search bar is the first thing you see; no login wall.

### Seeded admin account
- Email: `admin@medsearch.local`
- Password: `AdminPass!2024`  (change immediately in the Profile page)

Override with env vars `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` before running `npm run seed`.

---

## Environment variables

### `server/.env`
| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://medisearch:medisearch_dev@localhost:5432/medisearch?schema=public` | Prisma Postgres URL |
| `REDIS_URL` | yes | `redis://localhost:6379` | Redis for caching + rate-limit counters |
| `PORT` | no | `4000` | backend port |
| `NODE_ENV` | yes | `development` | dev/staging/production |
| `JWT_ACCESS_SECRET` | yes | `<random 32+ bytes>` | signs short-lived access tokens |
| `JWT_REFRESH_SECRET` | yes | `<random 32+ bytes>` | signs refresh tokens (db-hashed too) |
| `ACCESS_TOKEN_TTL` | no | `15m` | access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | no | `30` | refresh token lifetime in days |
| `LITSENSE_BASE_URL` | no | `https://www.ncbi.nlm.nih.gov/research/litsense-api/api/` | retrieval backend |
| `LITSENSE_TIMEOUT_MS` | no | `8000` | per-request timeout |
| `LITSENSE_MIN_INTERVAL_MS` | no | `1000` | global throttle (1 req/sec shared) |
| `EUTILS_BASE_URL` | no | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/` | article metadata |
| `EUTILS_API_KEY` | no | `<ncbi api key>` | raises E-utilities rate limit; optional |
| `EUTILS_TIMEOUT_MS` | no | `8000` | per-request timeout |
| `EUTILS_MIN_INTERVAL_MS` | no | `334` (no key) / `100` (with key) | E-utilities throttle |
| `SEARCH_CACHE_TTL_SEC` | no | `1200` | LitSense result cache TTL (20 min default) |
| `META_CACHE_TTL_SEC` | no | `2592000` | metadata cache TTL (30 days; effectively permanent) |
| `ANON_IP_RATE_LIMIT_PER_MIN` | no | `12` | anonymous per-IP search quota |
| `AUTH_RATE_LIMIT_PER_MIN` | no | `30` | authenticated per-user search quota |
| `LOGIN_MAX_ATTEMPTS` | no | `5` | brute-force lockout threshold |
| `LOGIN_LOCKOUT_MIN` | no | `15` | lockout duration after threshold |
| `CORS_ORIGIN` | no | `http://localhost:5173` | allowed frontend origin |
| `SEED_ADMIN_EMAIL` | no | `admin@medsearch.local` | seed admin email |
| `SEED_ADMIN_PASSWORD` | no | `AdminPass!2024` | seed admin password |
| `LOG_LEVEL` | no | `info` | pino log level |

### `client/.env.local`
| Variable | Required | Example | Description |
|---|---|---|---|
| `VITE_API_BASE` | yes | `http://localhost:4000` | backend base URL |

---

## Access tiers

| Tier | Search | Bookmarks | History | Admin |
|---|---|---|---|---|
| Anonymous | yes (lower per-IP quota) | no | no | no |
| Registered | yes | yes (folder/tag optional) | yes (re-runnable) | no |
| Admin | yes | yes | yes | yes — users + analytics |

Anonymous users see a low-friction "sign up to save this" prompt only **after** their first
search — never a signup wall before they can try the product.

---

## Privacy defaults (open decision — flagged, not silently assumed)

By default, **admins cannot see another user's raw search query text or bookmark contents**.
The admin dashboard shows **aggregate/anonymized** activity:

- Total searches over time, most-common query terms (top-N across all users, not attributed),
  active-user counts (DAU/WAU/MAU), anonymous-vs-authenticated split, system health.

If the client requires per-user raw query visibility, set `ADMIN_CAN_VIEW_USER_QUERIES=true`
in `server/.env`; a dedicated, explicitly-labeled "view raw queries for this user" endpoint
then becomes available. This is **off by default** to respect researcher privacy.

---

## External dependency notes (LitSense 2.0)

- Global server-side rate limiter (**1 req/sec shared across all users**) protects NCBI's
  per-IP limit. Anonymous traffic is further throttled per-IP to protect the shared budget.
- Aggressive Redis caching for identical queries (default 20 min TTL).
- Graceful degradation: on LitSense timeout/failure, the app returns cached results if
  available plus a clear "search is degraded" notice; it never returns an unhandled 500.
- Article metadata (title/authors/journal/date) is fetched via E-utilities `esummary`
  (batched, up to 200 PMIDs/call), cached long-term (metadata doesn't change).

---

## Out of scope (flag if the client wants these — not built proactively)
- Custom search index / embedding model (this app is intentionally a reliable layer over
  NCBI's existing LitSense infrastructure).
- Payment/billing.
- Multi-tenant org support beyond `user` / `admin` roles.
- Mobile native apps (responsive web is the target).

---

## Run lint + typecheck
```powershell
cd server ; npm run lint ; npm run typecheck
cd ..\client ; npm run lint ; npm run typecheck
```

## Run tests
Smoke/integration tests:
```powershell
cd server ; npm test
```
