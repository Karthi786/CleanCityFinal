-- ============================================================
-- Migration: Add Live Photo Capture columns to public.issues
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE public.issues 
  ADD COLUMN IF NOT EXISTS captured_image_url TEXT,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
