-- Contacts Entity
-- Migration: 020_contacts
-- Adds contacts table and three junction tables for linking contacts
-- to organizations, job descriptions, and resumes with relationship types.

-- Step 1: Create contacts table
CREATE TABLE contacts (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  linkedin TEXT,
  team TEXT,
  dept TEXT,
  notes TEXT,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_name ON contacts(name);

-- Step 2: Contact-Organization junction
CREATE TABLE contact_organizations (
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN (
    'recruiter', 'hr', 'referral', 'peer', 'manager', 'other'
  )),
  PRIMARY KEY (contact_id, organization_id, relationship)
) STRICT;

CREATE INDEX idx_contact_orgs_contact ON contact_organizations(contact_id);
CREATE INDEX idx_contact_orgs_org ON contact_organizations(organization_id);

-- Step 3: Contact-JobDescription junction
CREATE TABLE contact_job_descriptions (
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  job_description_id TEXT NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN (
    'hiring_manager', 'recruiter', 'interviewer', 'referral', 'other'
  )),
  PRIMARY KEY (contact_id, job_description_id, relationship)
) STRICT;

CREATE INDEX idx_contact_jds_contact ON contact_job_descriptions(contact_id);
CREATE INDEX idx_contact_jds_jd ON contact_job_descriptions(job_description_id);

-- Step 4: Contact-Resume junction
CREATE TABLE contact_resumes (
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN (
    'reference', 'recommender', 'other'
  )),
  PRIMARY KEY (contact_id, resume_id, relationship)
) STRICT;

CREATE INDEX idx_contact_resumes_contact ON contact_resumes(contact_id);
CREATE INDEX idx_contact_resumes_resume ON contact_resumes(resume_id);

-- Step 5: Extend note_references to include 'contact'
PRAGMA foreign_keys = OFF;

CREATE TABLE note_references_new (
  note_id TEXT NOT NULL CHECK(typeof(note_id) = 'text' AND length(note_id) = 36)
    REFERENCES user_notes(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'source', 'bullet', 'perspective', 'resume_entry',
    'resume', 'skill', 'organization', 'job_description', 'contact'
  )),
  entity_id TEXT NOT NULL,
  PRIMARY KEY (note_id, entity_type, entity_id)
) STRICT;

INSERT INTO note_references_new SELECT * FROM note_references;
DROP TABLE note_references;
ALTER TABLE note_references_new RENAME TO note_references;
CREATE INDEX idx_note_refs_entity ON note_references(entity_type, entity_id);

PRAGMA foreign_keys = ON;

-- Migration recording handled by the runner; no manual INSERT needed.
