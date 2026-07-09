-- Enable Realtime for profiles and memberships
-- This allows the Next.js client to listen for changes via websockets

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE memberships;
