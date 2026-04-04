-- Organization Tags
-- Migration: 011_org_tags
-- Adds a many-to-many tags table for organizations, replacing the single
-- org_type enum with flexible multi-label tagging.
-- org_type column is kept for backward compatibility but tags are authoritative.

-- Step 1: Create org_tags junction table
CREATE TABLE org_tags (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK (tag IN (
    'company', 'vendor', 'platform', 'university', 'school',
    'nonprofit', 'government', 'military', 'conference',
    'volunteer', 'freelance', 'other'
  )),
  PRIMARY KEY (organization_id, tag)
) STRICT;

CREATE INDEX idx_org_tags_tag ON org_tags(tag);

-- Step 2: Seed tags from existing org_type values
-- Map org_type -> initial tag(s)
INSERT INTO org_tags (organization_id, tag)
  SELECT id, org_type FROM organizations
  WHERE org_type IN ('company', 'nonprofit', 'government', 'military', 'volunteer', 'freelance', 'other');

-- education -> university (most education orgs are universities in this dataset)
INSERT INTO org_tags (organization_id, tag)
  SELECT id, 'university' FROM organizations
  WHERE org_type = 'education';

-- Also tag education orgs as 'company' if they are vendors (e.g., cert issuers)
-- This is a best-effort heuristic; user can adjust via UI.

INSERT INTO _migrations (name) VALUES ('011_org_tags');
