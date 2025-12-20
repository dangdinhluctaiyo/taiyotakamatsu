-- Add passcode column to staff table for quick QR login
-- Run this SQL in Supabase Dashboard > SQL Editor

ALTER TABLE staff ADD COLUMN IF NOT EXISTS passcode TEXT;

-- Create index for faster passcode lookups
CREATE INDEX IF NOT EXISTS idx_staff_passcode ON staff(passcode);
