-- Add signup contact and terms-consent fields without changing existing user records.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
