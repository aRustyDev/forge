-- Forge Resume Builder -- User Profile
-- Migration: 005_user_profile
-- Date: 2026-03-30
--
-- Creates a user_profile table for global contact information.
-- Seeds the profile from the first resume's header JSON (if any).
-- Builds on 004_resume_sections.

-- Step 1: Create user_profile table
CREATE TABLE user_profile (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  linkedin TEXT,
  github TEXT,
  website TEXT,
  clearance TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Step 2: Seed profile from first resume with a non-null header
-- Uses json_extract to pull fields from the header JSON blob.
-- The COALESCE chain falls through: header JSON name -> resumes.name -> 'User'.
INSERT INTO user_profile (id, name, email, phone, location, linkedin, github, website, clearance)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  COALESCE(json_extract(header, '$.name'), resumes.name, 'User'),
  json_extract(header, '$.email'),
  json_extract(header, '$.phone'),
  json_extract(header, '$.location'),
  json_extract(header, '$.linkedin'),
  json_extract(header, '$.github'),
  json_extract(header, '$.website'),
  json_extract(header, '$.clearance')
FROM resumes
WHERE header IS NOT NULL
ORDER BY created_at ASC
LIMIT 1;

-- Step 3: If no resume existed, insert a placeholder
INSERT OR IGNORE INTO user_profile (id, name)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'User'
WHERE NOT EXISTS (SELECT 1 FROM user_profile);

-- Step 4: Register migration
INSERT INTO _migrations (name) VALUES ('005_user_profile');
