# Lombok Explorer API

> Production-ready, high-performance RESTful API backend platform for Lombok tourism, smart itinerary generation with TSP route optimization, rule-based recommendation engine, live weather integration, financial expense tracking, travel journals, packing checklists, and enterprise-grade administrative portal.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%20LTS-green.svg?logo=node.js)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-darkblue.svg?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg?logo=postgresql)](https://www.postgresql.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg?logo=express)](https://expressjs.com/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0.3-brightgreen.svg?logo=openapi-initiative)](https://swagger.io/specification/)
[![Vitest](https://img.shields.io/badge/Tests-501%20Passed-success.svg?logo=vitest)](https://vitest.dev/)
[![Coverage](https://img.shields.io/badge/Coverage->90%25-brightgreen.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-blue.svg?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

**Lombok Explorer API** is an enterprise-grade, comprehensive backend service tailored for exploring the island of Lombok, West Nusa Tenggara (NTB), Indonesia. Built following clean architecture, domain-driven module separation, and contract-first OpenAPI 3.0 principles, this API powers rich travel mobile and web applications with intelligent travel planning capabilities and a full-featured administration suite.

### Key Highlights
- **Smart Itinerary Engine**: Multi-day scheduling powered by Geographic Clustering and Nearest-Neighbor Traveling Salesperson Problem (TSP) optimization.
- **Rule-Based Recommendation Engine**: Multi-criteria destination matching combining user favorites history, review ratings, logarithmic popularity scaling, and Haversine geospatial proximity.
- **Live Weather Integration**: Real-time meteorological forecasting via WeatherAPI.com with an automated 10-minute in-memory caching layer and provider abstraction.
- **Enterprise Administration**: Dedicated Administrative Portal (`/api/v1/admin/*`) featuring granular RBAC, sensitive action audit logging, review moderation, destination gallery management, and content lifecycle state transitions.
- **Enterprise Security & Reliability**: Helmet security headers, CORS origin whitelisting, multi-tier rate limiting (with dedicated Admin Auth rate limiter), Prisma SQL injection immunity, bcrypt password hashing (12 rounds), non-root Docker execution, and fail-fast Zod environment validation.

---

## Features

| Feature Domain | Capabilities |
|---|---|
| 🔐 **Authentication & Users** | Register, Login, JWT Access/Refresh Token rotation, Logout revocation, Role-Based Access Control (`USER`, `ADMIN`), User Profile preferences. |
| 🛡️ **Admin Portal Management** | Dedicated administrative namespace (`/api/v1/admin/*`), KPI Dashboard analytics, full-lifecycle Destination/Category/Culinary/Accommodation CRUD, bulk status & deletion, Review moderation, User suspension, and comprehensive Audit Logs. |
| 🏝️ **Destinations Catalog** | 35+ seeded Lombok attractions, Haversine nearby search, full-text search, category filtering, difficulty level, entrance fee range, average ratings. |
| 🏷️ **Categories** | 13 categories (Beach, Waterfall, Mountain, Gili Islands, Sasak Culture, Surfing, Diving, etc.) with dynamic destination counts and in-memory caching. |
| ❤️ **Favorites** | User-isolated bookmarking, duplicate prevention with database unique constraints, paginated listing. |
| ⭐ **Reviews & Ratings** | 1–5 star rating reviews with photo attachments, ownership authorization, automatic real-time destination average rating and count recalculation via database aggregation. |
| 🗺️ **Itinerary Management** | 3-tier relational model (`Itinerary` -> `ItineraryDay` -> `ItineraryItem`), multi-day support, custom activities, costs, and atomic database transactions (`prisma.$transaction`). |
| 🧠 **Smart Itinerary Generator** | Generates realistic multi-day travel itineraries based on start location, dates, budget, group size, transportation mode, travel style, and pace (`RELAXED`, `BALANCED`, `INTENSE`). |
| 🎯 **Personalized Recommendations** | Rule-based scoring engine ranking destinations based on user travel style, category affinity, previous high-rated reviews, and geographic distance. |
| ⛅ **Weather Service** | Provider abstraction (`IWeatherProvider`), live WeatherAPI.com client, in-memory TTL caching (10 minutes), coordinate-based and region-based weather lookups. |
| 💰 **Expense & Budget Tracking** | Itinerary financial management, expense categorization (`TRANSPORT`, `ACCOMMODATION`, `FOOD`, `ACTIVITY`, `SHOPPING`, `OTHER`), total expenses, remaining budget, and cost-per-person calculation. |
| 📓 **Travel Journals** | Rich travel diary entries with location tags and photo arrays, soft delete protection, public/private visibility control. |
| 📋 **Packing Checklists** | Category-based packing lists with interactive item toggles and automatic completion percentage calculation. |
| 🖼️ **Image & File Storage** | Provider abstraction (`IStorageProvider`), `LocalStorageProvider` (`assets/image/`), `CloudStorageProvider` stub, MIME type filtering, UUID file naming, and CORS static asset serving. |
| 🚦 **Production Observability** | Root `GET /health` (`{"status":"ok"}`), Kubernetes readiness probe `GET /health/ready` (DB ping), liveness probe `GET /health/live`, graceful shutdown with connection draining, and Pino structured logging with `X-Request-ID`. |

---

## Tech Stack

- **Runtime**: Node.js 22 LTS
- **Framework**: Express.js 4.21
- **Language**: Strict TypeScript 5.7
- **Database**: PostgreSQL 16
- **ORM & Query Builder**: Prisma ORM 5.22
- **Validation**: Zod 3.24
- **Authentication**: JWT (jsonwebtoken) & bcrypt (12 salt rounds)
- **Security**: Helmet, CORS, Express-Rate-Limit
- **Logging**: Pino & Pino-Http with structured JSON output and sensitive data redaction
- **Documentation**: OpenAPI 3.0.3 & Swagger UI Express (Public & Admin specs)
- **File Upload**: Multer (5MB limit, image MIME enforcement)
- **Testing**: Vitest 3.2 & Supertest (501+ tests across 47 suites, 100% Passing)
- **Containerization**: Docker (Multi-stage Alpine Linux, 524MB) & Docker Compose

---

## Requirements

Ensure the following tools are installed on your machine before setup:
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher
- **PostgreSQL Database Server**: `v16` or **Docker Desktop**

---

## Installation

```bash
# 1. Clone repository
git clone https://github.com/wahyush04/lombok-explorer.git
cd lombok-explorer

# 2. Install dependencies
npm ci

# 3. Create environment configuration
cp .env.example .env
```

---

## Environment Variables

Configure your `.env` file according to your local environment:

| Variable | Type | Default | Description |
|---|---|---|---|
| `NODE_ENV` | `string` | `development` | Runtime environment (`development`, `test`, `production`) |
| `PORT` | `number` | `8080` | Port number for the HTTP server |
| `HOST` | `string` | `0.0.0.0` | Host IP address to bind to |
| `API_PREFIX` | `string` | `/api/v1` | Primary API routing prefix |
| `DATABASE_URL` | `string` | *Required* | PostgreSQL connection string: `postgresql://root:root@localhost:5432/lombok_explorer?schema=public` |
| `JWT_ACCESS_SECRET` | `string` | *Required (min 16 chars)* | Secret key for signing short-lived Access JWTs |
| `JWT_ACCESS_EXPIRES_IN` | `string` | `15m` | Access token lifespan |
| `JWT_REFRESH_SECRET` | `string` | *Required (min 16 chars)* | Secret key for signing long-lived Refresh JWTs |
| `JWT_REFRESH_EXPIRES_IN` | `string` | `7d` | Refresh token lifespan |
| `CORS_ORIGIN` | `string` | `*` | Allowed CORS origin (comma-separated or `*`) |
| `RATE_LIMIT_WINDOW_MS` | `number` | `900000` | Rate limiting window in milliseconds (15 min) |
| `RATE_LIMIT_MAX` | `number` | `100` | Max requests per IP within the rate limit window |
| `LOG_LEVEL` | `string` | `debug` | Pino log level (`debug`, `info`, `warn`, `error`) |
| `WEATHER_API_KEY` | `string` | `e98c7ab33f...` | WeatherAPI.com API token |
| `WEATHER_API_BASE_URL` | `string` | `https://api.weatherapi.com/v1` | WeatherAPI base URL |
| `WEATHER_CACHE_TTL_SECONDS` | `number` | `600` | In-memory cache TTL for weather lookups (seconds) |

---

## Database Setup

```bash
# 1. Generate Prisma Client
npm run prisma:generate

# 2. Run migrations
npm run prisma:migrate

# 3. Seed database with authentic Lombok destinations, categories, culinary & accommodations
npm run prisma:seed
```

---

## Running the Project

```bash
# Development Mode (Hot-Reload with tsx)
npm run dev

# Production Build
npm run build

# Start Production Server
npm start
```

---

## Admin API

The **Admin API** (`/api/v1/admin/*`) is a secured, isolated backend subsystem designed exclusively for platform administrators to manage content, monitor analytics, audit sensitive operations, and oversee community feedback.

### 1. Role Requirement & Authorization Policy
- **Mandatory Role**: Access to all endpoints under `/api/v1/admin/*` strictly requires an account with `role: ADMIN` and an `ACTIVE` status.
- **Backend Enforcement**: Authorization is enforced directly at the HTTP server layer using the `authenticate` and `requireAdmin` (`authenticateAdmin`) middleware chain. Never rely solely on frontend client routing for protection.
- **Access Denial**: Standard traveler accounts (`role: USER`) attempting to access any admin endpoint will be immediately rejected with `403 Forbidden` (`ADMIN_ACCESS_REQUIRED`). Unauthenticated requests are rejected with `401 Unauthorized` (`TOKEN_MISSING`).

### 2. Cara Login Admin (Authentication Workflow)
Administrators authenticate via the dedicated admin login endpoint:

```http
POST /api/v1/admin/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "YourAdminSecurePassword!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "user": {
      "id": "usr_admin_01",
      "name": "Platform Administrator",
      "email": "admin@example.com",
      "role": "ADMIN",
      "status": "ACTIVE"
    }
  }
}
```

> **Security Note on Admin Login:**
> - The admin login endpoint is protected by a dedicated strict rate limiter (`adminAuthLimiter` - maximum 5 requests per 15 minutes in production) to mitigate brute-force and credential-stuffing attempts.
> - Passwords are never returned in responses or stored in audit logs.

### 3. Authentication & Bearer Header
To access protected admin endpoints, attach the received `accessToken` to the HTTP `Authorization` header:

```http
Authorization: Bearer <your_admin_access_token>
```

When the access token expires (15-minute lifespan), refresh the session using:
```http
POST /api/v1/admin/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<your_refresh_token>"
}
```

### 4. Interactive Admin Swagger UI
The Admin API is documented via a dedicated OpenAPI 3.0.3 specification (`openapi-admin.yaml`):

- **Admin Swagger UI**: [`http://localhost:8080/api/docs/admin`](http://localhost:8080/api/docs/admin) *(Alias: [`/docs/admin`](http://localhost:8080/docs/admin))*
- **Admin OpenAPI JSON Spec**: [`http://localhost:8080/api/docs/admin/json`](http://localhost:8080/api/docs/admin/json)
- **Admin OpenAPI YAML Spec**: [`http://localhost:8080/api/docs/admin/yaml`](http://localhost:8080/api/docs/admin/yaml)

> **Testing via Swagger UI**: Click the green **Authorize** button at the top right of the Swagger UI and paste your admin `accessToken` to test all administrative endpoints interactively.

### 5. Standardized Endpoint Groups (9 Tags)

| Tag / Group | Primary Endpoints | Description |
|---|---|---|
| 🔐 **`Admin Authentication`** | `POST /auth/login`<br>`POST /auth/refresh`<br>`GET /auth/me`<br>`POST /auth/logout` | Administrator session lifecycle, token refresh, profile inspection, and session revocation. |
| 📊 **`Admin Dashboard`** | `GET /dashboard` | Real-time platform KPI metrics (total users, destinations, categories, restaurants, accommodations, reviews, pending reviews, itineraries) with date range filters. |
| 🏝️ **`Admin Destinations`** | `GET /destinations`<br>`POST /destinations`<br>`GET /destinations/:id`<br>`PUT /destinations/:id`<br>`DELETE /destinations/:id`<br>`PATCH /destinations/:id/status`<br>`POST /destinations/bulk-delete`<br>`POST /destinations/bulk-status`<br>`POST/PUT/DELETE /destinations/:id/images` | Full destination management, multi-filter search, gallery image uploads, bulk batch operations, and status transitions (`DRAFT`, `PUBLISHED`, `ARCHIVED`). |
| 🏷️ **`Admin Categories`** | `GET /categories`<br>`POST /categories`<br>`GET /categories/:id`<br>`PUT /categories/:id`<br>`DELETE /categories/:id`<br>`PATCH /categories/:id/status` | Master category management with safe destination reassignment mechanism (`?reassignTo=<categoryId>`). |
| 🍽️ **`Admin Restaurants`** | `GET /restaurants`<br>`POST /restaurants`<br>`GET /restaurants/:id`<br>`PUT /restaurants/:id`<br>`DELETE /restaurants/:id`<br>`PATCH /restaurants/:id/status` | Culinary directory management, cuisine filtering, halal certification tracking, and status controls. |
| 🏨 **`Admin Accommodations`** | `GET /accommodations`<br>`POST /accommodations`<br>`GET /accommodations/:id`<br>`PUT /accommodations/:id`<br>`DELETE /accommodations/:id`<br>`PATCH /accommodations/:id/status` | Lodging, resort, villa, hotel, and homestay directory management with amenities and pricing filters. |
| 👥 **`Admin Users`** | `GET /users`<br>`GET /users/:id`<br>`PUT /users/:id`<br>`DELETE /users/:id`<br>`PATCH /users/:id/status` | User directory management, role promotion/demotion, account suspension/activation (`ACTIVE`, `SUSPENDED`, `INACTIVE`), and soft delete. |
| ⭐ **`Admin Reviews`** | `GET /reviews`<br>`GET /reviews/:id`<br>`DELETE /reviews/:id`<br>`PATCH /reviews/:id/moderate` | Community review moderation queue (`APPROVED`, `PENDING`, `REJECTED`) with automatic destination rating recalculation. |
| 📜 **`Admin Audit Logs`** | `GET /audit-logs`<br>`GET /audit-logs/:id` | Immutable security audit trail recording all sensitive mutations (`action`, `entity`, `before`, `after`, `ipAddress`, `userAgent`) with automated sensitive data redaction. |

---

## API Documentation (Public)

- **Swagger UI Interactive Explorer**: [`http://localhost:8080/api/docs`](http://localhost:8080/api/docs)
- **Raw OpenAPI JSON Spec**: [`http://localhost:8080/api/docs/json`](http://localhost:8080/api/docs/json)
- **Raw OpenAPI YAML Spec**: [`http://localhost:8080/api/docs/yaml`](http://localhost:8080/api/docs/yaml)
- **Root Service Discovery**: [`http://localhost:8080/`](http://localhost:8080/)

### Standard Response Envelopes

#### Success Response (200 / 201)
```json
{
  "success": true,
  "message": "Destinations retrieved successfully",
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 35,
    "totalPages": 4
  }
}
```

#### Error Response (4xx / 5xx)
```json
{
  "success": false,
  "message": "Destination 'dest_invalid_id' not found",
  "errorCode": "DESTINATION_NOT_FOUND",
  "details": null
}
```

---

## Testing

The project includes an extensive automated test suite covering unit tests, integration tests, security tests, and OpenAPI contract validation:

```bash
# Run all 501+ test cases
npm test

# Run tests in watch mode
npm run test:watch

# Run test coverage report
npm run test:coverage
```

### Test Coverage Breakdown
- **Unit Tests**: Financial math, TSP route planning heuristics, recommendation scoring rules, Zod validators.
- **Integration Tests**: Auth token rotation, Destination queries, Category caches, Review calculations, Itinerary transactions.
- **Admin Matrix Tests**: 10 administrative modules, RBAC matrices, security boundary probes, CRUD lifecycles, and audit logging.
- **API Matrix Tests**: Full verification of HTTP 200, 201, 400, 401, 403, 404, 409, 413, 429, and 500 status codes.
- **Total Test Files**: 47 test suites (**100% Passing**).

---

## Code Quality

```bash
# Format code with Prettier
npm run format

# Run ESLint validation
npm run lint

# Typecheck TypeScript compilation
npm run build
```

---

## Docker

Deploy the application effortlessly with Docker and Docker Compose:

```bash
# Start backend and database services in background
docker compose up -d

# View real-time container logs
docker compose logs -f backend

# Rebuild container image after changes
docker compose build

# Stop containers and networks
docker compose down
```

---

## Deployment

### Production Checklist
1. Set `NODE_ENV=production` in production environment.
2. Provide a strong, cryptographically secure `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (at least 32 characters).
3. Set specific domain origins in `CORS_ORIGIN` (e.g. `https://lombokexplorer.com`).
4. Set up an AWS ALB, Google Cloud Load Balancer, or Nginx reverse proxy pointing to container port `8080`.
5. Configure health check probes:
   - **Liveness Probe**: `GET /health/live` (Interval: 15s)
   - **Readiness Probe**: `GET /health/ready` (Interval: 10s)

---

## Roadmap

- [x] **Phase 0–6**: OpenAPI 3.0 Contract, Express TypeScript Foundation, Zod Validation, Pino Logging, Swagger UI.
- [x] **Phase 7–12**: JWT Authentication Rotation, Destinations Geospatial Search, Categories, User Favorites, Reviews & Rating Recalculation.
- [x] **Phase 13–18**: 3-Level Itinerary Transactions, Smart Itinerary AI Generator (TSP), Rule-Based Recommendations, WeatherAPI Integration, Expense Breakdown, Travel Journals, Packing Checklists.
- [x] **Phase 19–25**: Pluggable Image Storage, Enterprise Security (Helmet, Multi-tier Rate Limiting), Vitest 501-Test Suite, Multi-Stage Docker Containerization, API Versioning (`/api/v1`), Performance Caching, Production Probes.
- [x] **Admin Suite (Phases 1–21)**: Dedicated Admin Namespace, Dashboard Metrics, Content CRUDs, Bulk Operations, Audit Logs, Review Moderation, Admin Security (12 Pillars), Admin Swagger Documentation, Response Consistency.

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/amazing-feature`.
3. Commit your changes: `git commit -m 'feat: add amazing feature'`.
4. Run tests and linting: `npm test && npm run lint`.
5. Push to the branch: `git push origin feature/amazing-feature`.
6. Open a Pull Request.

---

## License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## Author

**Lombok Explorer Engineering Team**
- Email: `wahyush04@gmail.com`
- Location: Mataram, Lombok, Nusa Tenggara Barat, Indonesia
