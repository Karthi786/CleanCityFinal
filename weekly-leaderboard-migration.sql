-- ============================================================
-- MakkalSevi — Weekly Leaderboard & Citizen Dashboard Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add weekly points tracking columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS weekly_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_points_week TEXT DEFAULT NULL;

-- weekly_points       = points earned this current ISO week
-- weekly_points_week  = ISO week string e.g. "2026-W24" when points were recorded
-- Both reset each week (handled by backend logic on award)

-- 2. Allow MLA role in users (if constraint exists without it)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('USER','TAMILNADU_CORPORATION','TNEB','POLICE','FIRE_STATION','COLLECTOR','ADMIN','MLA'));

-- 3. Index for weekly leaderboard queries
CREATE INDEX IF NOT EXISTS idx_users_weekly_points ON public.users(weekly_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_weekly_week ON public.users(weekly_points_week);

-- ============================================================
-- Done! Weekly leaderboard columns are ready.
-- ============================================================
