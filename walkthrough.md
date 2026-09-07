# Lombok Explorer — Production-Ready Dual Localization Architecture

This walkthrough summarizes the architectural analysis, design, and full implementation of the **Dual Localization System** for the Lombok Explorer backend, supporting both:
1. **System & UI Messages Localization** (API responses, validation errors, error handling, feed, notifications).
2. **Content & Data Localization** (Entities: `Destination`, `Category`, `Restaurant`, `Accommodation`, `ItineraryTemplate`).

---

## 1. Architectural Overview & Design Principles

```
                              ┌─────────────────────────┐
                              │     Client Request      │
                              │ Accept-Language: en-US  │
                              └────────────┬────────────┘
                                           │
                                           ▼
                              ┌─────────────────────────┐
                              │    localeMiddleware     │
                              │   - RFC 2616 Q-Factor   │
                              │   - Normalizes: en-US   │
                              │   - Sets Vary Header    │
                              └────────────┬────────────┘
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
      ┌───────────────────────────────┐           ┌───────────────────────────────┐
      │ 1. System/UI Localization     │           │ 2. Content/Data Localization  │
      │    (Dictionary Files)         │           │    (PostgreSQL Translation)   │
      ├───────────────────────────────┤           ├───────────────────────────────┤
      │ • src/i18n/locales/id-ID/*.ts │           │ • Normalized *Translation tbl │
      │ • src/i18n/locales/en-US/*.ts │           │ • @@unique([entityId, locale])│
      │ • Parameterized interpolation │           │ • Transparent field fallback  │
      │ • In-memory, zero DB queries  │           │ • Public: flat DTO (no arrays)│
      │ • Zod stable validation codes │           │ • Admin: translations + meta  │
      └───────────────────────────────┘           └───────────────────────────────┘
```

### Key Tenets
1. **Zero Database Polling for UI/Error Text**: System messages, validation strings, and auth errors are managed in version-controlled TypeScript dictionary files under `src/i18n/locales/`, not in PostgreSQL.
2. **Zero Breaking Changes for Android**: The Android app consumes flat DTOs (`name`, `description`, etc.) with transparent field-level fallback. Translation arrays are never leaked to Android endpoints.
3. **Admin Transparency**: CMS editors receive `translations`, `availableLocales`, and `missingLocales` to identify missing translations and manage content per locale without complex relational overhead.
4. **Zero Data Loss**: Existing columns on parent tables (`destinations.name`, `categories.description`, etc.) remain intact as canonical defaults. The non-destructive SQL migration safely seeds default `id-ID` translation rows directly from existing data.

---

## 2. Database Schema & Migration (`prisma/schema.prisma`)

### Translation Models
Five normalized translation models were added with composite unique constraints and locale indexes:

```prisma
model CategoryTranslation {
  id          String   @id @default(uuid())
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  locale      String   // 'id-ID', 'en-US'
  name        String
  description String   @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([categoryId, locale])
  @@index([locale])
  @@map("category_translations")
}

model DestinationTranslation {
  id               String      @id @default(uuid())
  destinationId    String
  destination      Destination @relation(fields: [destinationId], references: [id], onDelete: Cascade)
  locale           String      // 'id-ID', 'en-US'
  name             String
  shortDescription String?     @db.Text
  description      String      @db.Text
  address          String?     @db.Text
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  @@unique([destinationId, locale])
  @@index([locale])
  @@map("destination_translations")
}

model RestaurantTranslation {
  id           String     @id @default(uuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  locale       String     // 'id-ID', 'en-US'
  name         String
  description  String     @db.Text
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@unique([restaurantId, locale])
  @@index([locale])
  @@map("restaurant_translations")
}

model AccommodationTranslation {
  id              String        @id @default(uuid())
  accommodationId String
  accommodation   Accommodation @relation(fields: [accommodationId], references: [id], onDelete: Cascade)
  locale          String        // 'id-ID', 'en-US'
  name            String
  description     String        @db.Text
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([accommodationId, locale])
  @@index([locale])
  @@map("accommodation_translations")
}

model ItineraryTemplateTranslation {
  id                String            @id @default(uuid())
  templateId        String
  template          ItineraryTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  locale            String            // 'id-ID', 'en-US'
  title             String
  description       String?           @db.Text
  transportPaceNote String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@unique([templateId, locale])
  @@index([locale])
  @@map("itinerary_template_translations")
}
```

### Non-Destructive Migration Script
Located at [`prisma/migrations/20260907150000_add_localization_tables/migration.sql`](file:///c:/Users/Wahyu/Documents/Depelopment/backend/lombok-explorer/prisma/migrations/20260907150000_add_localization_tables/migration.sql):
- Creates all 5 tables with foreign keys `ON DELETE CASCADE`.
- Creates composite unique indexes `(entity_id, locale)` and single-column indexes on `locale`.
- Migrates existing records into `id-ID` translations automatically:
  ```sql
  INSERT INTO "destination_translations" ("id", "destinationId", "locale", "name", "shortDescription", "description", "address", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), "id", 'id-ID', "name", "shortDescription", "description", "address", NOW(), NOW()
  FROM "destinations"
  ON CONFLICT ("destinationId", "locale") DO NOTHING;
  ```
- Leaves `en-US` empty for editor management without hallucinated/machine-translated data.

---

## 3. System & UI Message Localization Architecture

### 1. Locale Resolution (`src/i18n/locale-resolver.ts`)
- Implements RFC 2616 language negotiation with quality weights (`Accept-Language: en-US,en;q=0.9,id;q=0.8`).
- Normalizes aliases: `id`, `in`, `id-ID` $\rightarrow$ `id-ID`; `en`, `en-US`, `en-GB` $\rightarrow$ `en-US`.
- Defaults to `id-ID` when header is omitted, malformed, or contains unsupported languages.

### 2. Locale Middleware (`src/common/middleware/locale.middleware.ts`)
- Mounted globally in [`src/app.ts`](file:///c:/Users/Wahyu/Documents/Depelopment/backend/lombok-explorer/src/app.ts).
- Populates `req.locale` on the Express request.
- Automatically appends `Vary: Accept-Language` header to support intermediate caching & CDNs.

### 3. Translation Service & Dictionary Files (`src/i18n/`)
- Dictionaries structured modularly:
  - `src/i18n/locales/id-ID/`: `common.ts`, `auth.ts`, `validation.ts`, `destination.ts`, `feed.ts`, `notification.ts`.
  - `src/i18n/locales/en-US/`: Equivalent English translations.
- Parameterized placeholders supported: `{field}`, `{min}`, `{max}`, `{name}`, etc.
- In-memory retrieval with fallback from requested locale to `id-ID`.

### 4. Localized Validation & Error Handling
- [`src/common/middleware/validate.middleware.ts`](file:///c:/Users/Wahyu/Documents/Depelopment/backend/lombok-explorer/src/common/middleware/validate.middleware.ts):
  Maps Zod errors to stable codes (`REQUIRED_FIELD`, `INVALID_EMAIL`, `MIN_LENGTH`, `MAX_LENGTH`, `INVALID_ENUM`, `INVALID_UUID`, `INVALID_TYPE`) with localized field error messages and a structured `errors: FieldValidationError[]` array.
- [`src/common/middleware/error.middleware.ts`](file:///c:/Users/Wahyu/Documents/Depelopment/backend/lombok-explorer/src/common/middleware/error.middleware.ts):
  Translates standard error codes into user-friendly messages while retaining HTTP status codes and masking sensitive internal error traces.
- Standard response format:
  ```json
  {
    "success": false,
    "code": "VALIDATION_ERROR",
    "errorCode": "VALIDATION_ERROR",
    "message": "Data yang dikirimkan tidak valid",
    "data": null,
    "errors": [
      {
        "field": "email",
        "code": "INVALID_EMAIL",
        "message": "Format email tidak valid"
      }
    ],
    "details": ["email: Format email tidak valid"]
  }
  ```

---

## 4. Public & Android API Content Fallback

### 1. Transparent Fallback Utility (`src/i18n/content-fallback.util.ts`)
```typescript
resolveLocalizedFields(requestedLocale, translations, fallbackEntity, ['name', 'description'])
```
Implements 3-tier field-level fallback:
1. Requested locale value (e.g. `en-US`), if present and non-empty.
2. Default locale value (`id-ID`), if present and non-empty.
3. Canonical column value on the parent entity table.

### 2. Android Consumption
Android clients continue consuming the identical flat model:
```json
{
  "success": true,
  "code": "DESTINATION_RETRIEVED",
  "message": "Destination retrieved successfully",
  "data": {
    "id": "dest_001",
    "name": "Kuta Beach Lombok",
    "description": "Comprehensive English overview...",
    "categoryName": "Beaches & Islands"
  }
}
```
If an English translation has not yet been authored for a destination, the endpoint seamlessly supplies Indonesian text for that field without throwing an error or omitting the item.

### 3. Search Localization (`src/modules/destinations/destinations.search.ts`)
Search filters check both parent canonical columns and `destination_translations` rows:
```sql
OR EXISTS (
  SELECT 1 FROM destination_translations dt
  WHERE dt."destinationId" = d.id
    AND (dt.name ILIKE '%...%' OR dt.description ILIKE '%...%')
)
```
Users can search in English or Indonesian and receive relevant matching destinations.

### 4. Cache Partitioning
In-memory caches are partitioned by locale (e.g., `featured:${limit}:${locale}`, `categories:${locale}`) so changing the `Accept-Language` header immediately returns correctly localized results without cache pollution.

---

## 5. Admin CMS Translation Management

All 5 admin modules (`destinations`, `categories`, `restaurants`, `accommodations`, `itinerary-templates`) support explicit translation management:

### 1. Input Schemas
Accept an optional `translations: [...]` array during creation or update:
```json
{
  "name": "Pantai Kuta",
  "description": "Deskripsi bahasa Indonesia...",
  "translations": [
    {
      "locale": "en-US",
      "name": "Kuta Beach Lombok",
      "description": "English description of Kuta beach..."
    }
  ]
}
```

### 2. Response DTOs
Admin responses include translation details and locale completeness metadata:
```json
{
  "id": "dest_001",
  "name": "Pantai Kuta",
  "translations": [
    { "locale": "id-ID", "name": "Pantai Kuta", "description": "..." },
    { "locale": "en-US", "name": "Kuta Beach Lombok", "description": "..." }
  ],
  "availableLocales": ["id-ID", "en-US"],
  "missingLocales": []
}
```
CMS editors can instantly filter and detect untranslated entities via `missingLocales`.

---

## 6. Verification & Automated Test Results

### 1. Static Type Checking
Executed `npx tsc --noEmit` across the entire codebase:
- **Result**: `0 errors` (Clean exit).

### 2. Automated Test Suites (37 tests across 6 suites)
```
 ✓ tests/unit/content-fallback.test.ts (5 tests)
   - English translation matching
   - Field-level fallback to id-ID on null/missing fields
   - Fallback to parent canonical field when both requested & id-ID are missing
   - Direct id-ID translation retrieval
   - Safe handling of empty/undefined translation arrays

 ✓ tests/unit/i18n.test.ts (9 tests)
   - RFC 2616 Accept-Language quality factor parsing (e.g. en-US,en;q=0.9,id;q=0.8)
   - Normalization of language variants (id, in -> id-ID; en, en-GB -> en-US)
   - Fallback to id-ID on missing/invalid headers
   - In-memory placeholder parameter interpolation ({field}, {min}, {name})

 ✓ tests/unit/admin-translation-dto.test.ts (5 tests)
   - Destination translation mapping and availableLocales / missingLocales calculation
   - Category translation mapping and completeness verification
   - Restaurant translation mapping
   - Accommodation translation mapping
   - ItineraryTemplate translation mapping

 ✓ tests/integration/system-localization.test.ts (5 tests)
   - Automatic injection of Vary: Accept-Language response header
   - 404 Route Not Found error in Indonesian by default
   - 404 Route Not Found error in English with Accept-Language: en-US
   - Zod validation errors with stable codes and Indonesian messages
   - Zod validation errors with stable codes and English messages

 ✓ tests/error-handler.test.ts (9 tests)
   - NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError, BadRequestError
   - Error code propagation and localization integration

 ✓ tests/response-util.test.ts (4 tests)
   - sendSuccess, sendCreated, sendPaginated, sendActionSuccess with stable code
```

---

## 7. OpenAPI / Swagger Documentation

Both specifications updated:
- [`openapi.yaml`](file:///c:/Users/Wahyu/Documents/Depelopment/backend/lombok-explorer/openapi.yaml):
  - Documented `AcceptLanguageHeader` in `components.parameters`.
  - Documented `code` and `FieldValidationError` array in `ErrorResponse`.
- [`openapi-admin.yaml`](file:///c:/Users/Wahyu/Documents/Depelopment/backend/lombok-explorer/openapi-admin.yaml):
  - Documented `AcceptLanguageHeader` in `components.parameters`.
  - Documented `DestinationTranslationDto`, `CategoryTranslationDto`, `RestaurantTranslationDto`, `AccommodationTranslationDto`, and `ItineraryTemplateTranslationDto`.
