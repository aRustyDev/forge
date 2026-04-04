-- Education Organization FK
-- Migration: 010_education_org_fk
-- Replaces text institution/issuing_body with organization_id FK.
-- Data migration: creates orgs from existing text values, then links them.

-- Step 1: Add organization_id column to source_education
ALTER TABLE source_education ADD COLUMN organization_id TEXT
  REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_source_education_org ON source_education(organization_id);

-- Step 2: Create organizations from unique institution values that don't already exist
INSERT OR IGNORE INTO organizations (id, name, org_type, created_at, updated_at)
  SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    institution,
    CASE education_type
      WHEN 'degree' THEN 'education'
      WHEN 'course' THEN 'education'
      ELSE 'company'
    END,
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  FROM source_education
  WHERE institution IS NOT NULL AND institution != ''
  AND institution NOT IN (SELECT name FROM organizations);

-- Step 3: Create organizations from unique issuing_body values that don't already exist
INSERT OR IGNORE INTO organizations (id, name, org_type, created_at, updated_at)
  SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
    issuing_body,
    'company',
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  FROM source_education
  WHERE issuing_body IS NOT NULL AND issuing_body != ''
  AND issuing_body NOT IN (SELECT name FROM organizations);

-- Step 4: Link education sources to orgs by institution name
UPDATE source_education SET organization_id = (
  SELECT o.id FROM organizations o
  WHERE o.name = source_education.institution
  LIMIT 1
)
WHERE institution IS NOT NULL AND institution != '';

-- Step 5: For certificates with issuing_body but no institution match, link by issuing_body
UPDATE source_education SET organization_id = (
  SELECT o.id FROM organizations o
  WHERE o.name = source_education.issuing_body
  LIMIT 1
)
WHERE organization_id IS NULL
  AND issuing_body IS NOT NULL AND issuing_body != '';

-- Note: institution and issuing_body columns are kept for now (SQLite cannot drop columns
-- conditionally). They become legacy — the application reads organization_id instead.
-- A future table rebuild migration can remove them.

INSERT INTO _migrations (name) VALUES ('010_education_org_fk');
