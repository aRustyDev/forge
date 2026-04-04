-- Organization Campuses
-- Migration: 013_org_campuses
-- Adds a campuses table linked to organizations for structured location data.
-- Each campus has a name, location/address, and modality (in-person/remote/hybrid).

CREATE TABLE org_campuses (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'in_person' CHECK (modality IN ('in_person', 'remote', 'hybrid')),
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_org_campuses_org ON org_campuses(organization_id);

-- Add campus_id FK to source_education
ALTER TABLE source_education ADD COLUMN campus_id TEXT REFERENCES org_campuses(id) ON DELETE SET NULL;

INSERT INTO _migrations (name) VALUES ('013_org_campuses');
