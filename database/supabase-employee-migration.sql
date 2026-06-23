-- ============================================================
-- Employee System Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run — all statements use IF NOT EXISTS / IF EXISTS
-- ============================================================

-- 1. Add dept_role column to distinguish Department Head vs Employee
--    Existing department users (TAMILNADU_CORPORATION, TNEB, POLICE) default to 'HEAD'
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dept_role TEXT DEFAULT 'HEAD'
    CHECK (dept_role IN ('HEAD', 'EMPLOYEE'));

-- 2. Extend the role CHECK constraint to allow 'EMPLOYEE'
--    Supabase requires dropping and recreating named constraints
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'USER', 'TAMILNADU_CORPORATION', 'TNEB', 'POLICE',
    'FIRE_STATION', 'COLLECTOR', 'ADMIN', 'MLA', 'CM',
    'COMMISSIONER', 'EMPLOYEE'
  ));

-- 3. Add employee assignment fields to issues table
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS assigned_employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_employee_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_date TIMESTAMPTZ;

-- 4. Add work_remarks column so employees can add completion notes
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS work_remarks TEXT;

-- 5. Indexes for efficient employee queries
CREATE INDEX IF NOT EXISTS idx_issues_assigned_employee ON public.issues(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_users_dept_role ON public.users(dept_role);
CREATE INDEX IF NOT EXISTS idx_users_employee_dept ON public.users(role, department) WHERE role = 'EMPLOYEE';

-- ============================================================
-- Done! Existing data is fully preserved.
-- Next: restart your backend server.
-- ============================================================
