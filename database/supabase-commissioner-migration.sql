-- ============================================================
-- Commissioner Role Migration
-- Run this in your Supabase SQL Editor
-- This migration adds the COMMISSIONER role to the users table
-- without modifying any existing data or constraints
-- ============================================================

-- Step 1: Drop the old role CHECK constraint and recreate with COMMISSIONER added
-- NOTE: PostgreSQL does not support ALTER CHECK directly — we drop and recreate.

-- First, find and drop existing role check constraint on users table
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Recreate with COMMISSIONER added (all original roles preserved)
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'USER',
    'TAMILNADU_CORPORATION',
    'TNEB',
    'POLICE',
    'FIRE_STATION',
    'COLLECTOR',
    'ADMIN',
    'MLA',
    'CM',
    'COMMISSIONER'
  ));

-- Step 2: Add index for COMMISSIONER role queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_users_commissioner ON public.users(role, district)
  WHERE role = 'COMMISSIONER';

-- ============================================================
-- Done! The COMMISSIONER role is now available.
-- 
-- To create a Commissioner account, use the register endpoint
-- with role = "COMMISSIONER" and set the district field.
-- Example: POST /api/auth/register
-- {
--   "name": "Commissioner Name",
--   "email": "commissioner@example.com",
--   "password": "secure_password",
--   "role": "COMMISSIONER",
--   "district": "Madurai"
-- }
-- ============================================================
