CREATE TABLE portal_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    actor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    summary TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portal_activity_branch ON portal_activity_log(branch_id);
CREATE INDEX idx_portal_activity_created ON portal_activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE portal_activity_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read portal activity log
CREATE POLICY "Authenticated users can read portal activity" ON portal_activity_log
  FOR SELECT TO authenticated USING (true);

-- Allow service role to insert
CREATE POLICY "Service role can insert portal activity" ON portal_activity_log
  FOR INSERT TO service_role WITH CHECK (true);
