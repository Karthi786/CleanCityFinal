-- Run this in your Supabase SQL Editor to migrate existing data and constraints

-- 1. Update existing data
UPDATE public.users SET role = 'TAMILNADU_CORPORATION' WHERE role = 'MADURAI_CORPORATION';
UPDATE public.users SET department = 'TAMILNADU_CORPORATION' WHERE department = 'MADURAI_CORPORATION';
UPDATE public.issues SET department = 'TAMILNADU_CORPORATION' WHERE department = 'MADURAI_CORPORATION';

-- 2. Update Constraints (dropping the old ones and adding the new ones)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('USER','TAMILNADU_CORPORATION','TNEB','POLICE','FIRE_STATION','COLLECTOR','ADMIN'));

ALTER TABLE public.issues DROP CONSTRAINT IF EXISTS issues_department_check;
ALTER TABLE public.issues ADD CONSTRAINT issues_department_check CHECK (department IN ('TAMILNADU_CORPORATION','TNEB','POLICE','FIRE_STATION'));
