-- Create equipment_sets table for storing equipment set data
-- Run this SQL in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS equipment_sets (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  product_ids INTEGER[] DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE equipment_sets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (you can restrict later if needed)
CREATE POLICY "Allow all operations on equipment_sets" ON equipment_sets
  FOR ALL USING (true);

-- Create index for faster code lookups
CREATE INDEX IF NOT EXISTS idx_equipment_sets_code ON equipment_sets(code);
