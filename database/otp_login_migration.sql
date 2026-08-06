-- ============================================================
-- OTP Login Migration
-- Adds otp_login_enabled column to the users table.
-- Citizens can opt in to OTP-based login during registration.
-- When true, the login endpoint sends a 6-digit OTP to email
-- before issuing a JWT session token.
-- ============================================================

-- Add otp_login_enabled column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS otp_login_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Add a comment for documentation
COMMENT ON COLUMN users.otp_login_enabled IS
  'If true, a login OTP email is sent to the user every time they sign in. Set during citizen registration.';
