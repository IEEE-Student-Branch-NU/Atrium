-- ============================================================
-- IEEE SBNU Event Portal — NextAuth Migration
-- Migration: 00003_nextauth_migration.sql
-- ============================================================
-- This migration decouples profiles from Supabase's auth.users.
-- Auth is now handled by NextAuth (Auth.js v5) directly.
-- Supabase remains as the database only.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Add password_hash column for email/password users
-- ────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN profiles.password_hash IS 'bcrypt hash of user password. NULL for Google OAuth-only users.';


-- ────────────────────────────────────────────────────────────
-- 2. Drop the auth.users trigger (NextAuth manages user creation)
-- ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;


-- ────────────────────────────────────────────────────────────
-- 3. Decouple profiles from auth.users
--    Remove the FK constraint so profiles can be managed independently
-- ────────────────────────────────────────────────────────────

-- The FK is part of the PK definition (id UUID PRIMARY KEY REFERENCES auth.users)
-- We need to drop and recreate the PK without the FK
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;


-- ────────────────────────────────────────────────────────────
-- 4. Ensure defaults are in place for self-managed profiles
-- ────────────────────────────────────────────────────────────

ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
