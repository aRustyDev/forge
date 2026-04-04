-- Organization Aliases
-- Migration: 015_org_aliases
-- Adds an aliases table for case-insensitive search by shorthand names.
-- e.g. "WGU" -> Western Governors University, "USAF" -> United States Air Force

CREATE TABLE org_aliases (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alias TEXT NOT NULL COLLATE NOCASE,
  UNIQUE(organization_id, alias)
) STRICT;

CREATE INDEX idx_org_aliases_alias ON org_aliases(alias COLLATE NOCASE);
CREATE INDEX idx_org_aliases_org ON org_aliases(organization_id);

INSERT INTO _migrations (name) VALUES ('015_org_aliases');
