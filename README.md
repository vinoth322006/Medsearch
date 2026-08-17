# 🧬 MedSearch — PubMed Semantic Search

A production-grade web application for biomedical researchers to search PubMed/PMC using **natural-language semantic search** (powered by NCBI's public Semantic Engine API). It includes full user authentication, role-based access, advanced bookmarking, search history, and an admin analytics dashboard.

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



## 🌍 Production Deployment

MedSearch is fully configured for automated deployment to an AWS EC2 instance. 

We have a dedicated, highly-detailed guide for production deployment. Please see:
👉 **[DEPLOYMENT.md](./DEPLOYMENT.md)**

---

## 🔌 External API Integrations

MedSearch acts as a fast, intelligent wrapper around NCBI's infrastructure. It is designed to be highly respectful of NCBI's servers.

*   **Semantic Engine:** Used for semantic retrieval. We enforce a **global 1 request/sec limit** across all users to protect our IP from being banned by NCBI.
*   **E-utilities (esummary):** Used to fetch rich metadata (authors, journal, publication date) for the PMIDs returned by SemanticEngine.
*   **Aggressive Caching:** All SemanticEngine search results are cached in Redis for 20 minutes. All E-utilities metadata is cached for 30 days (as article metadata rarely changes).



## 🔐 Access Tiers

| Tier | Search | Bookmarks | History | Admin |
|---|---|---|---|---|
| Anonymous | yes (lower per-IP quota) | no | no | no |
| Registered | yes | yes (folder/tag optional) | yes (re-runnable) | no |
| Admin | yes | yes | yes | yes — users + analytics |

Anonymous users see a low-friction "sign up to save this" prompt only **after** their first search — never a signup wall before they can try the product.

---

## 🛡️ Privacy Defaults

By default, **admins cannot see another user's raw search query text or bookmark contents**.
The admin dashboard shows **aggregate/anonymized** activity:

- Total searches over time, most-common query terms (top-N across all users, not attributed), active-user counts (DAU/WAU/MAU), anonymous-vs-authenticated split, system health.

If the client requires per-user raw query visibility, set `ADMIN_CAN_VIEW_USER_QUERIES=true` in `server/.env`; a dedicated, explicitly-labeled "view raw queries for this user" endpoint then becomes available. This is **off by default** to respect researcher privacy.

---

## 🚫 Out of Scope
*   Custom search index / embedding model (this app is intentionally a reliable layer over NCBI's existing SemanticEngine infrastructure).
*   Payment/billing.
*   Multi-tenant org support beyond `user` / `admin` roles.
*   Mobile native apps (responsive web is the target).

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
