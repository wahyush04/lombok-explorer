# Lombok Explorer API

> Production-ready, high-performance RESTful API backend platform for Lombok tourism, smart itinerary generation with TSP route optimization, rule-based recommendation engine, live weather integration, financial expense tracking, travel journals, and packing checklists.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%20LTS-green.svg?logo=node.js)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-darkblue.svg?logo=prisma)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg?logo=mysql)](https://www.mysql.com/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg?logo=express)](https://expressjs.com/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0.3-brightgreen.svg?logo=openapi-initiative)](https://swagger.io/specification/)
[![Vitest](https://img.shields.io/badge/Tests-236%20Passed-success.svg?logo=vitest)](https://vitest.dev/)
[![Coverage](https://img.shields.io/badge/Coverage->90%25-brightgreen.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-blue.svg?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

**Lombok Explorer API** is an enterprise-grade, comprehensive backend service tailored for exploring the island of Lombok, West Nusa Tenggara (NTB), Indonesia. Built following clean architecture, domain-driven module separation, and contract-first OpenAPI 3.0 principles, this API powers rich travel mobile and web applications with intelligent travel planning capabilities.

### Key Highlights
- **Smart Itinerary Engine**: Multi-day scheduling powered by Geographic Clustering and Nearest-Neighbor Traveling Salesperson Problem (TSP) optimization.
- **Rule-Based Recommendation Engine**: Multi-criteria destination matching combining user favorites history, review ratings, logarithmic popularity scaling, and Haversine geospatial proximity.
- **Live Weather Integration**: Real-time meteorological forecasting via WeatherAPI.com with an automated 10-minute in-memory caching layer and provider abstraction.
- **Enterprise Security & Reliability**: Helmet security headers, CORS origin whitelisting, multi-tier rate limiting, Prisma SQL injection immunity, bcrypt password hashing, non-root Docker execution, and fail-fast Zod environment validation.

---

## Features

| Feature Domain | Capabilities |
|---|---|
| 🔐 **Authentication & Users** | Register, Login, JWT Access/Refresh Token rotation, Logout revocation, Role-Based Access Control (`USER`, `ADMIN`), User Profile preferences. |
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
- **Language**: Strict TypeScript 5.6
- **Database**: MySQL 8.0
- **ORM & Query Builder**: Prisma ORM 5.22
- **Validation**: Zod 3.23
- **Authentication**: JWT (jsonwebtoken) & bcrypt (10 salt rounds)
- **Security**: Helmet, CORS, Express-Rate-Limit
- **Logging**: Pino & Pino-Http with structured JSON output and sensitive data redaction
- **Documentation**: OpenAPI 3.0.3 & Swagger UI Express
- **File Upload**: Multer (5MB limit, image MIME enforcement)
- **Testing**: Vitest 3.2 & Supertest (236 tests, >90% coverage)
- **Containerization**: Docker (Multi-stage Alpine Linux, 524MB) & Docker Compose

---

## Architecture

```
                                  ┌────────────────────────────────┐
                                  │      Client (Web / Mobile)     │
                                  └───────────────┬────────────────┘
                                                  │ HTTP / JSON
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │       Reverse Proxy / ALB      │
                                  │   (Rate Limiting & SSL Term)   │
                                  └───────────────┬────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Lombok Explorer Express App                                    │
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                     Global Middleware                                      │  │
│  │   RequestId (UUIDv4) ──► Helmet ──► CORS ──► RateLimit ──► PinoLogger ──► JsonParser (2MB)  │  │
│  └──────────────────────────────────────────────┬─────────────────────────────────────────────┘  │
│                                                 │                                                │
│         ┌───────────────────────────────────────┴───────────────────────────────────────┐        │
│         ▼                                                                               ▼        │
│  ┌──────────────┐                                                                ┌────────────┐  │
│  │ /api/docs    │ (Swagger UI OpenAPI Documentation)                             │ /health    │  │
│  └──────────────┘                                                                │ /health/rd │  │
│                                                                                  └────────────┘  │
│         ┌───────────────────────────────────────────────────────────────────────────────┐        │
│         │                         Versioned Router (/api/v1/*)                          │        │
│         └───────┬──────────────┬──────────────┬──────────────┬──────────────┬───────────┘        │
│                 │              │              │              │              │                    │
│                 ▼              ▼              ▼              ▼              ▼                    │
│           ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐              │
│           │   Auth    │  │Destinatio.│  │Itineraries│  │ Recommen. │  │  Weather  │ ...          │
│           └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘              │
│                 │              │              │              │              │                    │
│                 ▼              ▼              ▼              ▼              ▼                    │
│           ┌───────────────────────────────────────────────────────────────────────┐              │
│           │                       Service Layer (Business Logic)                  │              │
│           │  ItineraryGeneratorService (TSP) │ RuleBasedRecommendationService     │              │
│           │  WeatherService (10m Cache)      │ StorageService (Provider Swappable)│              │
│           └───────────────────────────────────┬───────────────────────────────────┘              │
│                                               │                                                  │
│                                               ▼                                                  │
│           ┌───────────────────────────────────────────────────────────────────────┐              │
│           │                     Repository Layer (Prisma Client)                  │              │
│           │       (Strict Pagination, Selected Fields, Anti-N+1 Queries)          │              │
│           └───────────────────────────────────┬───────────────────────────────────┘              │
└───────────────────────────────────────────────┼──────────────────────────────────────────────────┘
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │      MySQL 8.0 Database   │
                                  │   (17 Relational Models)  │
                                  └───────────────────────────┘
```

---

## Project Structure

```
lombok-explorer/
├── assets/
│   └── image/                     # Stored user-uploaded media files
├── prisma/
│   ├── migrations/                # Version-controlled SQL migration files
│   ├── schema.prisma              # Database schema definition (17 models)
│   └── seed.ts                    # Authentic Lombok tourism dataset seeder
├── src/
│   ├── app.ts                     # Express application factory & middleware chain
│   ├── server.ts                  # Server bootstrap & graceful shutdown handler
│   ├── common/
│   │   ├── constants/             # HTTP status codes & Error code enums
│   │   ├── errors/                # Custom AppError hierarchy (BadRequest, NotFound, etc.)
│   │   ├── middleware/            # Auth, Error, Logger, RateLimit, Validate, NotFound
│   │   ├── types/                 # Express Request augmentation & Pagination types
│   │   └── utils/                 # Response envelope builder, Pino logger, Async handler
│   ├── config/
│   │   ├── config.ts              # Centralized immutable configuration object
│   │   └── env.ts                 # Zod environment variable schema & validator
│   ├── database/
│   │   └── prisma.ts              # Prisma client singleton & connection lifecycle
│   ├── modules/
│   │   ├── auth/                  # Authentication, JWT rotation, User management
│   │   ├── categories/            # Tourism categories with cached counts
│   │   ├── checklists/            # Travel packing checklists & progress tracking
│   │   ├── destinations/          # Destination catalog, Geospatial search & filters
│   │   ├── expenses/              # Financial expense tracker & budget calculations
│   │   ├── favorites/             # User bookmarks & favorite management
│   │   ├── health/                # Probes: /health, /health/ready, /health/live
│   │   ├── itineraries/           # Itinerary CRUD & Smart AI Generator (TSP Engine)
│   │   ├── journals/              # Travel diary journals (soft-delete enabled)
│   │   ├── recommendations/       # Rule-based destination recommendation engine
│   │   ├── reviews/               # Ratings & reviews with automatic destination avg
│   │   ├── storage/               # Pluggable Storage Service (Local / Cloud)
│   │   └── weather/               # Live WeatherAPI.com integration & caching
│   └── routes/
│       ├── index.ts               # Version router aggregator (/api/v1, /v1, /api/v2)
│       ├── v1/v1.routes.ts        # Canonical API v1 route definitions
│       └── v2/v2.routes.ts        # Extensible API v2 foundation
├── tests/
│   ├── api-contract-matrix.test.ts # OpenAPI status code matrix verification
│   ├── api-versioning.test.ts     # Multi-version routing tests
│   ├── auth.test.ts               # Authentication integration test suite
│   ├── destinations.test.ts       # Destinations & geospatial test suite
│   ├── health.test.ts             # Health, readiness, and liveness probe tests
│   ├── performance.test.ts        # Pagination, caching, and N+1 query tests
│   ├── security.test.ts           # Helmet, CORS, rate limiting, SQLi tests
│   ├── storage.test.ts            # Image upload & MIME filtering tests
│   ├── unit/                      # Unit test suites (TSP, Budget, Scoring, Zod)
│   └── weather.test.ts            # Weather API & caching tests
├── docker-compose.yml             # Container orchestration (Backend + MySQL)
├── Dockerfile                     # Multi-stage production container build
├── openapi.yaml                   # OpenAPI 3.0.3 specification contract
├── package.json                   # Project dependencies & scripts
├── tsconfig.json                  # Strict TypeScript configuration
└── vitest.config.ts               # Vitest test runner & coverage configuration
```

---

## Requirements

Ensure the following tools are installed on your machine before setup:
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher
- **MySQL Server**: `v8.0` or **Docker Desktop**

---

## Installation

```bash
# 1. Clone repository
git clone https://github.com/wahyu/lombok-explorer.git
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
| `DATABASE_URL` | `string` | *Required* | MySQL connection string: `mysql://root:root@localhost:3306/lombok_explorer` |
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
npx prisma generate

# 2. Push schema to database (or run migrations)
npx prisma db push

# 3. Seed database with 35+ Lombok destinations, categories, culinary & accommodations
npx prisma db seed
```

> **Default Seed Accounts:**
> - **Demo Traveler**: `traveler@lombokexplorer.com` / `Password123!` (Role: `USER`)
> - **System Admin**: `admin@lombokexplorer.com` / `Password123!` (Role: `ADMIN`)

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

## API Documentation

The API comes with built-in interactive OpenAPI 3.0 documentation:

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

## Authentication

The API uses **JWT Token Rotation** for secure stateless authentication:

1. **Register / Login**: Send credentials to `POST /api/v1/auth/login`. Receive an `accessToken` (15m) and `refreshToken` (7d).
2. **Access Protected Endpoints**: Include the token in the `Authorization` header:
   ```http
   Authorization: Bearer <your_access_token>
   ```
3. **Token Refresh**: When the access token expires, send `POST /api/v1/auth/refresh` with `{ "refreshToken": "<token>" }` to receive a new pair.
4. **Logout**: Send `POST /api/v1/auth/logout` to revoke the active refresh token.

---

## Testing

The project includes an extensive automated test suite covering unit tests, integration tests, security tests, and OpenAPI contract validation:

```bash
# Run all 236 test cases
npm test

# Run tests in watch mode
npm run test:watch

# Run test coverage report
npm run test:coverage
```

### Test Coverage Breakdown
- **Unit Tests**: Financial math, TSP route planning heuristics, recommendation scoring rules, Zod validators.
- **Integration Tests**: Auth token rotation, Destination queries, Category caches, Review calculations, Itinerary transactions.
- **API Matrix Tests**: Full verification of HTTP 200, 201, 400, 401, 403, 404, 409, 413, and 500 status codes.
- **Total Test Files**: 29 test suites (**100% Passing**).

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
- [x] **Phase 19–25**: Pluggable Image Storage, Enterprise Security (Helmet, Multi-tier Rate Limiting), Vitest 236-Test Suite, Multi-Stage Docker Containerization, API Versioning (`/api/v1`), Performance Caching, Production Probes.
- [ ] **Phase 27+ (Future Extensions)**:
  - [ ] AI Deep Learning Recommendation Service (`AIRecommendationService` with embeddings)
  - [ ] Accommodations & Homestay Booking Integration
  - [ ] Sasak Culinary Directory & Halal Restaurant Locator
  - [ ] Payment Gateway Webhooks (Midtrans / Xendit integration)

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
- Email: `support@lombokexplorer.com`
- Website: [https://lombokexplorer.com](https://lombokexplorer.com)
- Location: Mataram, Lombok, Nusa Tenggara Barat, Indonesia
