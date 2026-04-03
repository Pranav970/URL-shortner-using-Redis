# URL-shortner-using-Redis
Build a fully working URL shortener that can handle high read/write traffic, supports fast redirection.

<img width="2048" height="1181" alt="image" src="https://github.com/user-attachments/assets/fd502888-6938-4b20-a59f-72c9cc6a2fab" />

<img width="2048" height="976" alt="image" src="https://github.com/user-attachments/assets/89149ac1-83a8-4e78-8755-3a90b8dbb1a8" />

# 🔗 URL Shortener — Production-Ready System Design Project

A scalable URL shortening service built with **Node.js**, **PostgreSQL**, and **Redis** — fully containerised with Docker Compose. Designed as a resume-worthy system design project demonstrating real-world backend engineering practices.

---

## 📐 System Architecture

```
Clients (User1, User2)
        │
        ▼
  Load Balancer (nginx / cloud LB)
        │
        ▼
  Node.js App Servers  ──────────────────────────────────────────┐
        │                                                         │
        ├── POST /api/urls ──► URL Generation Service             │
        │        │                    │                           │
        │        ▼                    ▼                           │
        │   Validate URL         PostgreSQL (source of truth)     │
        │   Generate Code        (urls table, clicks table)       │
        │   Write to DB                                           │
        │   Prime Redis Cache                                     │
        │                                                         │
        └── GET /:shortCode ──► Redirect Service (hot path)       │
                 │                    │                           │
                 ▼                    │                           │
           Redis Cache ◄──────────────┘                          │
           (cache-aside)         DB fallback on miss              │
                 │                                                │
                 └──► 302 Redirect ──────────────────────────────►│
                      + async click tracking                      │
                                                                  │
  Analytics Service ◄───────────────────────────────────────────-┘
  Background Cleanup Job (deletes expired URLs hourly)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Short code generation | `nanoid` (base62, 7 chars) | 3.5 trillion combinations; URL-safe; no external dependency |
| Collision handling | Retry loop (up to 5x, growing length) | Simple, safe, avoids distributed locks |
| Redirect caching | Redis cache-aside (TTL = min(expiry, 24h)) | Sub-millisecond redirects; DB only on cold miss |
| Click tracking | Fire-and-forget async | Redirect latency unaffected by analytics writes |
| Expiry enforcement | DB `expires_at` + matching Redis TTL | Dual enforcement; no stale redirects possible |
| Redirect type | HTTP 302 (temporary) | Ensures analytics always fire; expiry works correctly |
| Cleanup | Hourly background job | Keeps DB lean; 1-day grace period for cache to expire naturally |

---

## 🏗 Project Structure

```
url-shortener/
├── src/
│   ├── config/
│   │   ├── index.js          # Central env-var config
│   │   ├── database.js       # PostgreSQL pool + helpers
│   │   └── redis.js          # ioredis client + helpers
│   ├── controllers/
│   │   ├── url.controller.js     # HTTP handlers (thin layer)
│   │   └── health.controller.js  # Liveness + readiness probes
│   ├── services/
│   │   ├── url.service.js        # Business logic: create, resolve, list
│   │   ├── analytics.service.js  # Click tracking + aggregation
│   │   └── cleanup.service.js    # Background expired-URL deletion
│   ├── repositories/
│   │   ├── url.repository.js         # All SQL for urls table
│   │   └── analytics.repository.js   # All SQL for clicks table
│   ├── middleware/
│   │   ├── validate.js        # Zod schema validation
│   │   ├── rateLimiter.js     # Redis-backed rate limiting
│   │   ├── requestLogger.js   # Morgan → Winston
│   │   └── errorHandler.js    # Global error + 404 handling
│   ├── routes/
│   │   ├── url.routes.js       # /api/urls
│   │   ├── analytics.routes.js # /api/analytics
│   │   ├── health.routes.js    # /health
│   │   └── redirect.routes.js  # /:shortCode (catch-all)
│   ├── models/
│   │   └── url.model.js        # Type definitions + constants
│   ├── utils/
│   │   ├── shortCode.js        # nanoid generation + alias validation
│   │   ├── urlValidator.js     # URL safety checks + Zod schema
│   │   └── logger.js           # Winston structured logger
│   ├── app.js                  # Express app setup (no listen)
│   └── server.js               # Entry point + graceful shutdown
├── migrations/
│   ├── 001_create_urls.sql     # Schema + indexes
│   └── 002_seed_data.sql       # Sample data
├── scripts/
│   └── migrate.js              # Migration runner
├── tests/
│   ├── url.service.test.js     # Unit tests (mocked deps)
│   ├── urlValidator.test.js    # Validator unit tests
│   └── api.integration.test.js # Full HTTP integration tests
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Quick Start (Docker — one command)

```bash
# 1. Clone and enter the project
git clone https://github.com/YOUR_USERNAME/url-shortener.git
cd url-shortener

# 2. Copy and configure environment
cp .env.example .env
# Edit .env and set DB_PASSWORD and BASE_URL at minimum

# 3. Start everything (app + postgres + redis + run migrations)
docker compose up --build

# The API is now live at http://localhost:3000
```

Docker Compose will:
1. Start PostgreSQL and Redis
2. Run database migrations automatically (via the `migrate` service)
3. Start the Node.js application

---

## 💻 Local Development (without Docker)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your local DB/Redis credentials

# Run migrations
npm run migrate

# Start in development mode (auto-restart on changes)
npm run dev
```

---

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run a single test file
npx jest tests/url.service.test.js --verbose
```

Tests use Jest and Supertest. All external dependencies (PostgreSQL, Redis) are mocked — no real services needed to run tests.

---

## 📡 API Reference

### Base URL
```
http://localhost:3000
```

---

### Create Short URL
```http
POST /api/urls
Content-Type: application/json
```

**Request body:**
```json
{
  "originalUrl": "https://www.example.com/very/long/path?with=params",
  "customAlias": "my-link",        // optional, 3-50 alphanumeric chars
  "expiresInDays": 30,             // optional, default 365
  "title": "My Example Link"       // optional
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "shortCode": "my-link",
    "shortUrl": "http://localhost:3000/my-link",
    "originalUrl": "https://www.example.com/very/long/path?with=params",
    "title": "My Example Link",
    "expiresAt": "2025-05-01T00:00:00.000Z",
    "createdAt": "2024-05-01T12:00:00.000Z"
  }
}
```

**Error responses:**

| Status | Cause |
|--------|-------|
| `400`  | Invalid URL format or blocked hostname |
| `409`  | Custom alias already taken |
| `422`  | Validation failed (missing/invalid fields) |
| `429`  | Rate limit exceeded |

---

### Redirect to Original URL
```http
GET /:shortCode
```

Returns `302 Found` with `Location` header set to the original URL.

Includes `X-Cache: HIT` or `X-Cache: MISS` header for cache diagnostics.

```bash
curl -L http://localhost:3000/my-link
# → redirects to https://www.example.com/very/long/path?with=params
```

---

### List All URLs (Paginated)
```http
GET /api/urls?page=1&limit=20
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "short_code": "my-link",
      "original_url": "https://example.com/...",
      "title": "My Example Link",
      "click_count": 123,
      "expires_at": "2025-05-01T00:00:00.000Z",
      "is_active": true,
      "created_at": "2024-05-01T12:00:00.000Z",
      "shortUrl": "http://localhost:3000/my-link"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

---

### Get URL Info / Metadata
```http
GET /api/urls/:shortCode
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "short_code": "my-link",
    "original_url": "https://example.com/...",
    "title": "My Example Link",
    "click_count": 123,
    "expires_at": "2025-05-01T00:00:00.000Z",
    "is_active": true,
    "created_at": "2024-05-01T12:00:00.000Z",
    "shortUrl": "http://localhost:3000/my-link",
    "isExpired": false
  }
}
```

---

### Deactivate / Delete a Short URL
```http
DELETE /api/urls/:shortCode
```

Soft-deletes the URL (sets `is_active = false`) and invalidates its Redis cache entry.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Short URL 'my-link' has been deactivated"
}
```

---

### Get Click Analytics for a URL
```http
GET /api/analytics/:shortCode
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "shortCode": "my-link",
    "originalUrl": "https://example.com/...",
    "clickCount": 123,
    "realtimeCount": 125,
    "analytics": {
      "totalClicks": 123,
      "clicksByDay": [
        { "day": "2024-04-25T00:00:00.000Z", "count": 18 },
        { "day": "2024-04-26T00:00:00.000Z", "count": 31 }
      ],
      "topReferrers": [
        { "referer": "https://twitter.com", "count": 45 },
        { "referer": "Direct", "count": 78 }
      ]
    }
  }
}
```

---

### System-Wide Analytics
```http
GET /api/analytics
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "totalUrls": 1042,
    "activeUrls": 998,
    "totalClicks": 284921,
    "clicksLast24h": 3821,
    "clicksLast7d": 22104
  }
}
```

---

### Health Checks
```http
GET /health          # Liveness — fast process check
GET /health/ready    # Readiness — verifies DB + Redis connectivity
```

**Liveness `200 OK`:**
```json
{ "status": "ok", "timestamp": "2024-05-01T12:00:00.000Z" }
```

**Readiness `200 OK`:**
```json
{
  "status": "ok",
  "timestamp": "2024-05-01T12:00:00.000Z",
  "checks": {
    "postgres": "ok",
    "redis": "ok"
  }
}
```

Returns `503 Service Unavailable` if any dependency is down.

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `BASE_URL` | `http://localhost:3000` | Public base URL (used in shortUrl responses) |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `SHORT_CODE_LENGTH` | `7` | Default short code length |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `url_shortener` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | *(required)* | Database password |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_TTL` | `86400` | Default cache TTL in seconds (24h) |
| `RATE_LIMIT_MAX` | `60` | Max API requests per minute |
| `REDIRECT_RATE_LIMIT_MAX` | `120` | Max redirects per minute |
| `DEFAULT_EXPIRATION_DAYS` | `365` | Default URL expiry when none specified |
| `CLEANUP_INTERVAL_MS` | `3600000` | Cleanup job interval (1 hour) |
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Winston log level |

---

## 🔒 Security Features

- **Helmet.js** — security headers (XSS, clickjacking, MIME sniffing protection)
- **SSRF prevention** — blocks localhost, 127.x, 10.x, 172.16-31.x, 192.168.x URLs
- **Input validation** — Zod schemas on all POST bodies; URL-length limits
- **Rate limiting** — Redis-backed sliding window; separate limits for API vs redirects
- **SQL injection prevention** — parameterised queries throughout
- **Body size limits** — 10kb max on JSON payloads
- **Non-root Docker user** — container runs as `appuser`, not root

---

## 🚢 Production Deployment Tips

1. **Set `BASE_URL`** to your actual domain: `https://sho.rt`
2. **Use a secrets manager** (AWS Secrets Manager, Vault) for `DB_PASSWORD`
3. **Add nginx** in front for TLS termination and additional rate limiting
4. **Enable PostgreSQL SSL**: set `DB_SSL=true`
5. **Scale horizontally**: Redis is the shared state — multiple app instances work out of the box
6. **Monitor** `/health/ready` with your load balancer health check
7. **Set Redis `maxmemory-policy allkeys-lru`** (already set in docker-compose) to prevent OOM

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (LTS) |
| Framework | Express 4 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Validation | Zod |
| Short code generation | nanoid (base62) |
| Logging | Winston + Morgan |
| Rate limiting | express-rate-limit + rate-limit-redis |
| Security headers | Helmet |
| Testing | Jest + Supertest |
| Containerisation | Docker + Docker Compose |

---

## 📊 Performance Characteristics

- **Redirect latency (cache hit):** ~1–3ms (Redis only)
- **Redirect latency (cache miss):** ~5–15ms (Redis + PostgreSQL)
- **Short code space:** 62^7 ≈ 3.5 trillion combinations at length 7
- **Database indexes:** `short_code` (unique), `expires_at`, `created_at`, composite `(url_id, clicked_at)`
- **Click tracking:** fully async — zero impact on redirect response time

---

## 📄 License

MIT — free to use, fork, and extend.
README
echo "README done"
