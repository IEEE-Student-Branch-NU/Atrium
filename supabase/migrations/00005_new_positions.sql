-- ============================================================
-- IEEE SBNU Event Portal — Add New Positions
-- Migration: 00005_new_positions.sql
-- ============================================================

-- Add new positions to all branches
INSERT INTO positions (branch_id, name)
SELECT id, 'Web Master' FROM branches
ON CONFLICT (branch_id, name) DO NOTHING;

INSERT INTO positions (branch_id, name)
SELECT id, 'Treasurer' FROM branches
ON CONFLICT (branch_id, name) DO NOTHING;

INSERT INTO positions (branch_id, name)
SELECT id, 'Technical Associate' FROM branches
ON CONFLICT (branch_id, name) DO NOTHING;

INSERT INTO positions (branch_id, name)
SELECT id, 'Marketing Associate' FROM branches
ON CONFLICT (branch_id, name) DO NOTHING;

-- Grant some basic permissions (e.g. view_members) to them
INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name IN ('Web Master', 'Treasurer', 'Technical Associate', 'Marketing Associate')
  AND perm.name IN ('view_members')
ON CONFLICT (position_id, permission_id) DO NOTHING;

-- Web Master and Treasurer could also get create_events
INSERT INTO position_permissions (position_id, permission_id)
SELECT p.id, perm.id
FROM positions p
CROSS JOIN permissions perm
WHERE p.name IN ('Web Master', 'Treasurer')
  AND perm.name IN ('create_events')
ON CONFLICT (position_id, permission_id) DO NOTHING;
