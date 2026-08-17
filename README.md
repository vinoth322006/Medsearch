# 🧬 MedSearch — PubMed Semantic Search

A production-grade web application for biomedical researchers to search PubMed/PMC using **natural-language semantic search** (powered by NCBI's public LitSense 2.0 API). It includes full user authentication, role-based access, advanced bookmarking, search history, and an admin analytics dashboard.

---

## ✨ Core Features

*   **Semantic Search:** Uses AI to understand the *meaning* of a query, not just keywords, returning highly relevant PubMed articles.
*   **Authentication & Security:** Secure JWT-based auth (short-lived access + rotating HttpOnly refresh cookies), rate limiting, and brute-force protection.
*   **User Workspaces:** Registered users can view their search history, re-run past queries, and bookmark articles.
*   **Admin Dashboard:** A dedicated interface for administrators to view system health, aggregated search metrics, active user counts, and popular queries.
*   **Privacy First:** Admins cannot view raw query text or bookmark contents of individual users by default, ensuring researcher privacy.

---

## 🏗️ Architecture & Tech Stack

This is a modern full-stack application. The codebase is separated into `client` (frontend) and `server` (backend), but unified in production via Docker.

### 💻 Frontend (`/client`)
*   **Framework:** React 18 with TypeScript, built with Vite.
*   **Routing:** React Router v6.
*   **Styling:** Custom, highly polished, accessible CSS (no heavy frameworks).
*   **State & API:** Custom React hooks, strictly typed API calls.

### ⚙️ Backend (`/server`)
*   **Runtime:** Node.js 20+ with Express & TypeScript.
*   **Database:** PostgreSQL (managed via Prisma ORM).
*   **Cache:** Redis (ioredis) for heavy query caching and rate limiting.
*   **Validation:** Zod for strict runtime schema validation.
*   **Security:** Helmet, Express-Rate-Limit, bcryptjs.

### 🚀 Production Infrastructure
*   **Unified Container:** A multi-stage Docker build that compiles the React app and Express app into a **single Node.js container** (Express serves the API and static React files).
*   **Proxy:** Caddy Server for automatic HTTPS / Let's Encrypt SSL termination.

---

## 🚀 Quick Start (Local Development)

Follow these steps to run the application locally for development.

### Prerequisites
*   Node.js 20+
*   Docker (for running the local database and cache)

### 1. Start the Database & Cache
We use Docker Compose to spin up local instances of PostgreSQL and Redis.
```bash
docker compose up -d
```
*(This starts `postgres:16-alpine` on port 5432 and `redis:7-alpine` on port 6379).*

### 2. Configure the Backend
Navigate to the server directory, set up the environment, and seed the database.
```bash
cd server
cp .env.example .env
npm install

# Apply database schema
npx prisma migrate dev --name init

# Create the initial Admin user
npm run seed

# Start the development server (runs on port 4000)
npm run dev
```

### 3. Configure the Frontend
Open a new terminal window for the client.
```bash
cd client
cp .env.example .env.local
npm install

# Start the Vite development server (runs on port 5173)
npm run dev
```

Open `http://localhost:5173` in your browser. You can search immediately as an anonymous user.

### 🔑 Seeded Admin Account
The `npm run seed` command creates a default admin account so you can view the dashboard.
*   **Email:** `admin@medsearch.local`
*   **Password:** `AdminPass!2024`
*(Change this immediately in the Profile page).*

---

## 🌍 Production Deployment

MedSearch is fully configured for automated deployment to an AWS EC2 instance. 

We have a dedicated, highly-detailed guide for production deployment. Please see:
👉 **[DEPLOYMENT.md](./DEPLOYMENT.md)**

---

## 🔌 External API Integrations

MedSearch acts as a fast, intelligent wrapper around NCBI's infrastructure. It is designed to be highly respectful of NCBI's servers.

*   **LitSense 2.0:** Used for semantic retrieval. We enforce a **global 1 request/sec limit** across all users to protect our IP from being banned by NCBI.
*   **E-utilities (esummary):** Used to fetch rich metadata (authors, journal, publication date) for the PMIDs returned by LitSense.
*   **Aggressive Caching:** All LitSense search results are cached in Redis for 20 minutes. All E-utilities metadata is cached for 30 days (as article metadata rarely changes).

---

## ⚙️ Environment Variables

### `server/.env` (Backend)
| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://medisearch:medisearch_dev@localhost:5432/medisearch?schema=public` | Prisma Postgres URL |
| `REDIS_URL` | yes | `redis://localhost:6379` | Redis connection string |
| `PORT` | no | `4000` | Backend port |
| `NODE_ENV` | yes | `development` | `development` or `production` |
| `JWT_ACCESS_SECRET` | yes | `<random 32+ bytes>` | Signs short-lived access tokens |
| `JWT_REFRESH_SECRET` | yes | `<random 32+ bytes>` | Signs refresh tokens |
| `ACCESS_TOKEN_TTL` | no | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | no | `30` | Refresh token lifetime in days |
| `CORS_ORIGIN` | yes | `http://localhost:5173` | Allowed frontend origin (use HTTPS domain in prod) |

### `client/.env.local` (Frontend)
| Variable | Required | Example | Description |
|---|---|---|---|
| `VITE_API_BASE` | yes | `http://localhost:4000` | Backend API base URL. Leave empty in production so it uses relative paths. |

---

## 🧪 Testing & Linting

```bash
# Backend
cd server
npm run lint
npm run typecheck
npm test

# Frontend
cd client
npm run lint
npm run typecheck
```
