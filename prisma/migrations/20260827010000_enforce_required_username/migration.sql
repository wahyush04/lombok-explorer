-- =========================================================================
-- Migration: 20260827010000_enforce_required_username
-- Safe Data Backfill and NOT NULL constraint enforcement for User.username
-- =========================================================================

-- 1. Ensure username column exists (safe fallback if not already added)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'username'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "username" TEXT;
    END IF;
END $$;

-- 2. Backfill existing NULL or empty usernames from email
UPDATE "users"
SET "username" = LOWER(
    REGEXP_REPLACE(
        SPLIT_PART("email", '@', 1),
        '[^a-zA-Z0-9_]',
        '_',
        'g'
    )
)
WHERE "username" IS NULL OR "username" = '';

-- 3. Ensure length >= 3 and valid format for any edge cases
UPDATE "users"
SET "username" = 'user_' || SUBSTRING(REPLACE("id", '-', ''), 1, 8)
WHERE "username" IS NULL OR LENGTH("username") < 3;

-- 4. Clean leading or trailing underscores
UPDATE "users"
SET "username" = TRIM(BOTH '_' FROM "username")
WHERE "username" LIKE '_%' OR "username" LIKE '%_';

-- Re-check length after trimming
UPDATE "users"
SET "username" = 'user_' || SUBSTRING(REPLACE("id", '-', ''), 1, 8)
WHERE LENGTH("username") < 3;

-- 5. Resolve duplicate usernames by appending unique ID suffixes
DO $$
DECLARE
    r RECORD;
    new_uname TEXT;
BEGIN
    FOR r IN (
        SELECT id, username
        FROM (
            SELECT id, username, ROW_NUMBER() OVER(PARTITION BY username ORDER BY "createdAt" ASC) as rn
            FROM "users"
        ) t
        WHERE t.rn > 1
    ) LOOP
        new_uname := SUBSTRING(r.username, 1, 20) || '_' || SUBSTRING(REPLACE(r.id, '-', ''), 1, 6);
        UPDATE "users" SET "username" = new_uname WHERE id = r.id;
    END LOOP;
END $$;

-- 6. Enforce NOT NULL on username column
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- 7. Ensure Unique Index on username exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 'users' AND indexname = 'users_username_key'
    ) THEN
        CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
    END IF;
END $$;
