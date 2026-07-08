-- Add type column to notifications
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'normal';

-- Insert some seed data for the first profile found
DO $$
DECLARE
    first_profile_id UUID;
BEGIN
    SELECT id INTO first_profile_id FROM profiles LIMIT 1;
    
    IF first_profile_id IS NOT NULL THEN
        INSERT INTO notifications (profile_id, title, message, type, is_read)
        VALUES 
            (first_profile_id, 'Welcome to Atrium', 'This is a normal notification (Blue/Default).', 'normal', false),
            (first_profile_id, 'System Broadcast', 'This is a broadcast message to all users (Purple).', 'broadcast', false),
            (first_profile_id, 'Position Approved', 'Your request for Technical Head has been approved (Green).', 'success', false),
            (first_profile_id, 'Action Required', 'Please complete your profile details (Orange).', 'warning', false),
            (first_profile_id, 'Request Denied', 'Your previous request was rejected (Red).', 'error', false);
    END IF;
END $$;
