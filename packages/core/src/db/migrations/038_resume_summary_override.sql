-- Forge Resume Builder — Resume Summary Override
-- Migration: 038_resume_summary_override
-- Date: 2026-04-05
--
-- Adds two nullable columns to the `resumes` table supporting the
-- Resume Summary Card feature (T95.2):
--
--   summary_override               — local-to-this-resume summary text
--                                    that takes precedence over the linked
--                                    summaries.description when rendering
--   summary_override_updated_at    — mirrors the pattern of
--                                    markdown_override_updated_at and
--                                    latex_override_updated_at on the
--                                    same table
--
-- The existing `resumes.summary_id` FK (added in an earlier migration)
-- becomes load-bearing with this change: the IR compiler now reads it to
-- produce ResumeDocument.summary. Override + summary_id together express
-- "this resume started from template X but has local edits on top".
--
-- Additive, idempotent, no data migration. Existing resumes keep their
-- current (null) summary_id and get null override values by default.

ALTER TABLE resumes ADD COLUMN summary_override TEXT;
ALTER TABLE resumes ADD COLUMN summary_override_updated_at TEXT;
