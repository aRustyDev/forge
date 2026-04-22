-- 049_jd_parsed_fields.sql
-- M5a: Add parser-derived columns to job_descriptions

ALTER TABLE job_descriptions ADD COLUMN parsed_sections TEXT;
ALTER TABLE job_descriptions ADD COLUMN work_posture TEXT;
ALTER TABLE job_descriptions ADD COLUMN parsed_locations TEXT;
ALTER TABLE job_descriptions ADD COLUMN salary_period TEXT;
