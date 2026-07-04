-- 00004_invisible_superadmin.sql

-- 1. Create the invisible superadmins table
CREATE TABLE IF NOT EXISTS public.superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hashed_email TEXT UNIQUE NOT NULL,
  passphrase_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Drop the visible is_super_admin column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_super_admin;

-- 3. Seed the 4 superadmins (using the default passphrase "ieee_sudo_2026")
-- The hashed_emails are BCRYPT hashes of the emails, requiring ZERO environment variables to verify!
INSERT INTO public.superadmins (hashed_email, passphrase_hash)
VALUES
  -- 24btm040@nirmauni.ac.in (Priyansh)
  ('$2b$10$9LZcwzV2mja7bJesxetZgOHwHyVQysudQh9uJZ2M6FqOsTAO4MHU.', '$2b$12$7tMfmA4DmwXgtiLjW3Ia4e/A0sq6SC7cgRLxzFeUOSAT899oh3Onm'),
  
  -- ieee@nirmauni.ac.in (IEEE Official)
  ('$2b$10$kAFBRm3Cgv0bFPskXdN4eOORRQAykWhNqrED/EN0YZmkfOtahD51.', '$2b$12$7tMfmA4DmwXgtiLjW3Ia4e/A0sq6SC7cgRLxzFeUOSAT899oh3Onm'),
  
  -- 24btm032@nirmauni.ac.in (Vraj)
  ('$2b$10$YXYLYHRrssDSvi0GnCNfQ.x.byllvUR9rY6CTgkd2eg1zhPRnLTRa', '$2b$12$7tMfmA4DmwXgtiLjW3Ia4e/A0sq6SC7cgRLxzFeUOSAT899oh3Onm'),
  
  -- manisha.shah@nirmauni.ac.in (Faculty Mentor)
  ('$2b$10$KbwIEXuF.tQDu0NLWqCVyeYcNDk7/2hQnImeIJ7aE58/WTZvnw.xe', '$2b$12$7tMfmA4DmwXgtiLjW3Ia4e/A0sq6SC7cgRLxzFeUOSAT899oh3Onm')
ON CONFLICT (hashed_email) DO NOTHING;

-- 4. Enable RLS but don't add any public policies (only Service Role can access)
ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;
