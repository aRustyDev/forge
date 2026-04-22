-- 046_profile_addresses_urls.sql
-- Create shared addresses table and profile_urls table.
-- Migrate existing profile location/linkedin/github/website into new tables.
-- Drop old columns from user_profile.

-- 1. Create addresses table
CREATE TABLE addresses (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL,
  street_1 TEXT,
  street_2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country_code TEXT DEFAULT 'US',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- 2. Create profile_urls table
CREATE TABLE profile_urls (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  profile_id TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE(profile_id, key)
) STRICT;
CREATE INDEX idx_profile_urls_profile ON profile_urls(profile_id);

-- 3. Add address_id FK to user_profile (before dropping columns)
ALTER TABLE user_profile ADD COLUMN address_id TEXT REFERENCES addresses(id);

-- 4. Migrate existing location -> addresses table
INSERT INTO addresses (id, name, created_at, updated_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  location,
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM user_profile
WHERE location IS NOT NULL AND location != '';

-- 5. Link profile to newly created address
UPDATE user_profile SET address_id = (
  SELECT a.id FROM addresses a
  WHERE a.name = user_profile.location
  LIMIT 1
)
WHERE location IS NOT NULL AND location != '';

-- 6. Migrate linkedin, github, website -> profile_urls
INSERT INTO profile_urls (id, profile_id, key, url, position, created_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  id, 'linkedin', linkedin, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM user_profile WHERE linkedin IS NOT NULL AND linkedin != '';

INSERT INTO profile_urls (id, profile_id, key, url, position, created_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  id, 'github', github, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM user_profile WHERE github IS NOT NULL AND github != '';

INSERT INTO profile_urls (id, profile_id, key, url, position, created_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  id, 'blog', website, 2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM user_profile WHERE website IS NOT NULL AND website != '';

-- 7. Drop old columns (SQLite requires table rebuild)
CREATE TABLE user_profile_new (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address_id TEXT REFERENCES addresses(id),
  salary_minimum INTEGER,
  salary_target INTEGER,
  salary_stretch INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

INSERT INTO user_profile_new (id, name, email, phone, address_id, salary_minimum, salary_target, salary_stretch, created_at, updated_at)
SELECT id, name, email, phone, address_id, salary_minimum, salary_target, salary_stretch, created_at, updated_at
FROM user_profile;

DROP TABLE user_profile;
ALTER TABLE user_profile_new RENAME TO user_profile;
