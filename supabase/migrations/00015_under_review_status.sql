-- Migration: 00015_under_review_status.sql
-- Description: Add under_review status and approved_by_position field

-- 1. Add 'under_review' to registration_status
ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'under_review';

-- 2. Add approved_by_position to track the role used during approval
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_by_position TEXT;
