-- Add type column to notifications
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'normal';

-- Insert some seed data for a specific profile
-- Replace the UUID below with your actual user ID!
DO $$
DECLARE
    -- REPLACE THE DUMMY UUID BELOW WITH YOUR ACTUAL USER ID
    target_profile_id UUID := '00000000-0000-0000-0000-000000000000'; 
BEGIN
    -- Only insert if they replaced the ID with a real UUID
    IF target_profile_id != '00000000-0000-0000-0000-000000000000' THEN
        INSERT INTO notifications (profile_id, title, message, type, is_read)
        VALUES 
            (target_profile_id, 'Welcome to Atrium', 'This is a normal notification (Blue/Default).', 'normal', false),
            (target_profile_id, 'System Broadcast', 'This is a broadcast message to all users (Purple).', 'broadcast', false),
            (target_profile_id, 'Position Approved', 'Your request for Technical Head has been approved (Green).', 'success', false),
            (target_profile_id, 'Action Required', 'Please complete your profile details (Orange).', 'warning', false),
            (target_profile_id, 'Request Denied', 'Your previous request was rejected (Red).', 'error', false);
    END IF;
END $$;
