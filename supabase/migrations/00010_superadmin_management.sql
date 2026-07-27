-- 00010_superadmin_management.sql

-- 1. Truncate existing superadmins to avoid type collision and cleanly re-seed
TRUNCATE TABLE public.superadmins;

-- 2. Drop hashed_email and add email
ALTER TABLE public.superadmins DROP COLUMN hashed_email;
ALTER TABLE public.superadmins ADD COLUMN email TEXT UNIQUE NOT NULL;

-- 3. Re-seed the 4 default superadmins using plaintext emails
-- The passphrase hash remains the same for 'ieee-sbnu-nirma'
INSERT INTO public.superadmins (email, passphrase_hash)
VALUES
  ('24btm040@nirmauni.ac.in', '$2b$12$W/qLjgVu0UU.nQXjOOQkOu62lQFtKbtuAZJqfuyBm99wqZ/oRe/Rq'),
  ('ieee@nirmauni.ac.in', '$2b$12$W/qLjgVu0UU.nQXjOOQkOu62lQFtKbtuAZJqfuyBm99wqZ/oRe/Rq'),
  ('24btm032@nirmauni.ac.in', '$2b$12$W/qLjgVu0UU.nQXjOOQkOu62lQFtKbtuAZJqfuyBm99wqZ/oRe/Rq'),
  ('manisha.shah@nirmauni.ac.in', '$2b$12$W/qLjgVu0UU.nQXjOOQkOu62lQFtKbtuAZJqfuyBm99wqZ/oRe/Rq');
