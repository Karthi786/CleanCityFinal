-- ============================================================
-- CleanMadurai — Supabase Schema Setup
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create users table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'USER'
                CHECK (role IN ('USER','MADURAI_CORPORATION','TNEB','POLICE','FIRE_STATION','COLLECTOR','ADMIN')),
  department  TEXT,
  verification_status TEXT NOT NULL DEFAULT 'approved'
                CHECK (verification_status IN ('approved','pending_verification','rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create issues table
CREATE TABLE IF NOT EXISTS public.issues (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  description          TEXT NOT NULL,
  category             TEXT NOT NULL
                         CHECK (category IN ('Waste','Water','Electricity','Roads','Law & Order','Fire')),
  department           TEXT NOT NULL
                         CHECK (department IN ('MADURAI_CORPORATION','TNEB','POLICE','FIRE_STATION')),
  latitude             DOUBLE PRECISION,
  longitude            DOUBLE PRECISION,
  location_name        TEXT,
  image_url            TEXT,
  completion_image_url TEXT,
  status               TEXT NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED')),
  priority_score       INTEGER NOT NULL DEFAULT 0,
  supports_count       INTEGER NOT NULL DEFAULT 0,
  reported_by_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reported_by_name     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Index for common queries
CREATE INDEX IF NOT EXISTS idx_issues_department ON public.issues(department);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_reported_by ON public.issues(reported_by_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON public.issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_verification ON public.users(verification_status);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 4. Updated_at trigger for issues
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Row Level Security (RLS) — Optional, backend uses service_role which bypasses RLS
-- Enable for extra safety:
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (backend uses this)
CREATE POLICY "Service role full access - users"
  ON public.users FOR ALL USING (true);

CREATE POLICY "Service role full access - issues"
  ON public.issues FOR ALL USING (true);

-- ============================================================
-- Done! Your tables are ready.
-- Next: fill in .env with SUPABASE_URL and SUPABASE_SERVICE_KEY
-- ============================================================

-- ============================================================
-- 6. Reviews table — run this after initial setup
-- ============================================================
CREATE TABLE IF NOT EXISTS public.issue_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name   TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_issue ON public.issue_reviews(issue_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.issue_reviews(user_id);

ALTER TABLE public.issue_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access - reviews"
  ON public.issue_reviews FOR ALL USING (true);
