-- ============================================================
-- Petition Feature Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Petitions table — stores citizen petition data (separate from issues)
CREATE TABLE IF NOT EXISTS public.petitions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  original_description TEXT NOT NULL,
  language             TEXT NOT NULL CHECK (language IN ('en', 'ta')),
  input_method         TEXT NOT NULL DEFAULT 'text' CHECK (input_method IN ('text', 'voice')),
  generated_subject    TEXT,
  generated_petition   TEXT,
  key_points           JSONB DEFAULT '[]',
  location             TEXT,
  duration             TEXT,
  requested_action     TEXT,
  edited_petition      TEXT,
  ai_model_used        TEXT DEFAULT 'google/gemma-4-26b-a4b-it:free',
  status               TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('DRAFT', 'SUBMITTED')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_petitions_user ON public.petitions(user_id);
CREATE INDEX IF NOT EXISTS idx_petitions_status ON public.petitions(status);
CREATE INDEX IF NOT EXISTS idx_petitions_created ON public.petitions(created_at DESC);

-- Row Level Security
ALTER TABLE public.petitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access - petitions"
  ON public.petitions FOR ALL USING (true);

-- Auto-update updated_at (reuses existing trigger function)
CREATE TRIGGER petitions_updated_at
  BEFORE UPDATE ON public.petitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
