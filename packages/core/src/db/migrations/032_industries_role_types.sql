-- Forge Resume Builder — Industries & Role Types
-- Migration: 032_industries_role_types
-- Date: 2026-04-05
--
-- Creates lightweight entity tables for industries and role_types (mirrors the domains pattern).
-- Seeds industries from existing organizations.industry free-text values.
-- Adds an industry_id FK column to organizations (free-text column retained as deprecated).

-- Step 1: Create industries table
CREATE TABLE industries (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Step 2: Create role_types table (same structure)
CREATE TABLE role_types (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Step 3: Seed industries from distinct organizations.industry values.
-- Uses the same UUID-v4 generation trick as migration 010_education_org_fk.
INSERT OR IGNORE INTO industries (id, name)
SELECT DISTINCT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
  trim(industry)
FROM organizations
WHERE industry IS NOT NULL AND trim(industry) != '';

-- Step 4: Add industry_id FK column to organizations
ALTER TABLE organizations ADD COLUMN industry_id TEXT REFERENCES industries(id) ON DELETE SET NULL;

-- Step 5: Populate industry_id from matching industry names
UPDATE organizations SET industry_id = (
  SELECT i.id FROM industries i WHERE i.name = trim(organizations.industry)
) WHERE industry IS NOT NULL AND trim(industry) != '';

-- Step 6: Index for FK lookups
CREATE INDEX idx_organizations_industry_id ON organizations(industry_id);
CREATE INDEX idx_industries_name ON industries(name);
CREATE INDEX idx_role_types_name ON role_types(name);
