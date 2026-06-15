-- ============================================================
-- CM Role Migration — MakkalSevi
-- Run this ONCE in your Supabase SQL Editor before using CM accounts.
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Step 1: Drop the existing role CHECK constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Re-add with CM included
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'USER',
    'TAMILNADU_CORPORATION',
    'TNEB',
    'POLICE',
    'FIRE_STATION',
    'COLLECTOR',
    'ADMIN',
    'MLA',
    'CM'
  ));

-- ============================================================
-- Done! CM accounts can now be created and approved.
-- ============================================================
