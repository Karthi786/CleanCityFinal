-- ====================================================================
-- Migration: Citizen Registration and Email Verification Setup
-- ====================================================================

-- 1. Add new columns to public.users table (backward-compatible)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS constituency TEXT,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create indexes for users table (if they don't already exist)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON public.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_district ON public.users(district);
CREATE INDEX IF NOT EXISTS idx_users_constituency ON public.users(constituency);

-- 3. Create OTPS table for verification
CREATE TABLE IF NOT EXISTS public.otps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  otp_hash         TEXT NOT NULL,
  attempts         INTEGER NOT NULL DEFAULT 0,
  resends          INTEGER NOT NULL DEFAULT 0,
  registration_data JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  last_resend_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for OTP lookups
CREATE INDEX IF NOT EXISTS idx_otps_email ON public.otps(email);

-- Ensure service role can access OTPS table (RLS configuration)
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access - otps"
  ON public.otps FOR ALL USING (true);
