-- Migration 047: Rename org_campuses → org_locations, replace flat address fields with address_id FK
--
-- Steps:
-- 1. For each campus with address data, create an addresses row
-- 2. Create org_locations table with address_id FK (replaces flat address/city/state/country/zipcode)
-- 3. Copy data from org_campuses into org_locations, mapping to address_id
-- 4. Recreate source_education to point campus_id FK at org_locations instead of org_campuses
-- 5. Drop org_campuses

-- 1. Insert addresses for campuses that have location data (city or state populated)
--    We use the campus name as the address name since it's descriptive (e.g., "Langley", "Scott")
INSERT INTO addresses (id, name, city, state, zip, country_code, created_at, updated_at)
SELECT
  -- Generate a deterministic UUID-like id from the campus id (prefix swap for traceability)
  'a-loc-' || substr(id, 1, 30),
  name,
  city,
  state,
  zipcode,
  CASE WHEN country IS NOT NULL AND country != '' THEN country ELSE 'US' END,
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM org_campuses
WHERE city IS NOT NULL OR state IS NOT NULL;

-- 2. Create org_locations table
CREATE TABLE org_locations (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'in_person' CHECK (modality IN ('in_person', 'remote', 'hybrid')),
  address_id TEXT REFERENCES addresses(id) ON DELETE SET NULL,
  is_headquarters INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_org_locations_org ON org_locations(organization_id);

-- 3. Copy data from org_campuses → org_locations
--    Map address_id for campuses that had location data
INSERT INTO org_locations (id, organization_id, name, modality, address_id, is_headquarters, created_at)
SELECT
  oc.id,
  oc.organization_id,
  oc.name,
  oc.modality,
  CASE
    WHEN oc.city IS NOT NULL OR oc.state IS NOT NULL
    THEN 'a-loc-' || substr(oc.id, 1, 30)
    ELSE NULL
  END,
  oc.is_headquarters,
  oc.created_at
FROM org_campuses oc;

-- 4. Recreate source_education with campus_id FK pointing at org_locations
--    SQLite doesn't support ALTER FOREIGN KEY, so we must recreate.
--    All 17 columns preserved exactly as-is.

-- 4a. Save source_education data
CREATE TABLE _source_education_backup AS SELECT * FROM source_education;

-- 4b. Drop old table
DROP TABLE source_education;

-- 4c. Recreate with updated FK (campus_id now references org_locations)
--     Preserves original CHECK constraints and column order exactly.
CREATE TABLE source_education (
  source_id TEXT PRIMARY KEY CHECK(typeof(source_id) = 'text' AND length(source_id) = 36)
    REFERENCES sources(id) ON DELETE CASCADE,
  education_type TEXT NOT NULL CHECK (education_type IN ('degree', 'certificate', 'course', 'self_taught')),
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  campus_id TEXT REFERENCES org_locations(id) ON DELETE SET NULL,
  field TEXT,
  start_date TEXT,
  end_date TEXT,
  is_in_progress INTEGER NOT NULL DEFAULT 0,
  credential_id TEXT,
  expiration_date TEXT,
  url TEXT,
  degree_level TEXT CHECK (degree_level IS NULL OR degree_level IN (
    'associate', 'bachelors', 'masters', 'doctoral', 'graduate_certificate'
  )),
  degree_type TEXT,
  certificate_subtype TEXT CHECK (certificate_subtype IS NULL OR certificate_subtype IN (
    'professional', 'vendor', 'completion'
  )),
  gpa TEXT,
  location TEXT,
  edu_description TEXT
) STRICT;

CREATE INDEX idx_source_education_org ON source_education(organization_id);

-- 4d. Restore data
INSERT INTO source_education
SELECT * FROM _source_education_backup;

-- 4e. Cleanup backup
DROP TABLE _source_education_backup;

-- 5. Drop the old table
DROP TABLE org_campuses;
