-- Forge Resume Builder -- Education Sub-Type Fields
-- Migration: 009_education_subtype_fields
-- Date: 2026-04-03
--
-- Adds degree_level, degree_type, certificate_subtype, gpa, location,
-- edu_description to source_education for per-type field support.
-- Builds on 002_schema_evolution (source_education table).

ALTER TABLE source_education ADD COLUMN degree_level TEXT
  CHECK (degree_level IS NULL OR degree_level IN (
    'associate', 'bachelors', 'masters', 'doctoral', 'graduate_certificate'
  ));

ALTER TABLE source_education ADD COLUMN degree_type TEXT;

ALTER TABLE source_education ADD COLUMN certificate_subtype TEXT
  CHECK (certificate_subtype IS NULL OR certificate_subtype IN (
    'professional', 'vendor', 'completion'
  ));

ALTER TABLE source_education ADD COLUMN gpa TEXT;

ALTER TABLE source_education ADD COLUMN location TEXT;

ALTER TABLE source_education ADD COLUMN edu_description TEXT;

INSERT INTO _migrations (name) VALUES ('009_education_subtype_fields');
