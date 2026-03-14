-- =============================================================================
-- CleanMadurai — Points & Contribution System Migration
-- Run this entire script in the Supabase SQL Editor.
-- All statements use IF NOT EXISTS — safe to run multiple times.
-- =============================================================================

-- ── 1. users table: add all points & counter columns ─────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS reports_points               INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaign_participated_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaign_created_points      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points                 INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reports_resolved             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaigns_participated       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaigns_organized          INTEGER DEFAULT 0;

-- ── 2. campaigns table: flag to prevent duplicate creator reward ──────────────
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS creator_points_awarded BOOLEAN DEFAULT FALSE;

-- ── 3. campaign_registrations: track confirmation + point status ──────────────
ALTER TABLE public.campaign_registrations
  ADD COLUMN IF NOT EXISTS participation_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS points_given            BOOLEAN DEFAULT FALSE;

-- ── 4. Verify columns exist ───────────────────────────────────────────────────
-- Run this SELECT to confirm all columns are present:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN (
    'reports_points', 'campaign_participated_points', 'campaign_created_points',
    'total_points', 'reports_resolved', 'campaigns_participated', 'campaigns_organized'
  );
