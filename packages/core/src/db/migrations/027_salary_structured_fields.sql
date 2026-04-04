-- Structured Salary Fields
-- Migration: 027_salary_structured_fields
-- Adds salary_min/salary_max INTEGER columns to job_descriptions.
-- Adds salary_minimum/salary_target/salary_stretch to user_profile.
-- salary_range TEXT is preserved for free-text display.

-- Step 1: Add structured salary columns to job_descriptions
ALTER TABLE job_descriptions ADD COLUMN salary_min INTEGER;
ALTER TABLE job_descriptions ADD COLUMN salary_max INTEGER;

-- Step 2: Add salary expectation columns to user_profile
ALTER TABLE user_profile ADD COLUMN salary_minimum INTEGER;
ALTER TABLE user_profile ADD COLUMN salary_target INTEGER;
ALTER TABLE user_profile ADD COLUMN salary_stretch INTEGER;
