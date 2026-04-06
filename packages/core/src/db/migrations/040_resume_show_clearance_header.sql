-- Forge Resume Builder — Resume Header Clearance Toggle
-- Migration: 040_resume_show_clearance_header
-- Date: 2026-04-05
--
-- Adds a per-resume toggle for showing the clearance one-liner in the
-- resume header. Default is 1 (show). Users can hide it for resumes
-- targeting non-cleared roles.

ALTER TABLE resumes ADD COLUMN show_clearance_in_header INTEGER NOT NULL DEFAULT 1;
