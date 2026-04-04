-- Forge Resume Builder — Renderer & Entity Tables
-- Migration: 003_renderer_and_entities
-- Date: 2026-03-29
--
-- Adds resume renderer columns (header, markdown/LaTeX overrides),
-- creates editable domain and archetype entity tables with seed data,
-- and adds status tracking to organizations.
-- Builds on 002_schema_evolution.

-- Step 1: Add renderer columns to resumes
ALTER TABLE resumes ADD COLUMN header TEXT;
ALTER TABLE resumes ADD COLUMN markdown_override TEXT;
ALTER TABLE resumes ADD COLUMN markdown_override_updated_at TEXT;
ALTER TABLE resumes ADD COLUMN latex_override TEXT;
ALTER TABLE resumes ADD COLUMN latex_override_updated_at TEXT;

-- Step 2: Create domains table
CREATE TABLE domains (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Step 3: Create archetypes table
CREATE TABLE archetypes (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Step 4: Create archetype_domains junction table
CREATE TABLE archetype_domains (
  archetype_id TEXT NOT NULL REFERENCES archetypes(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (archetype_id, domain_id)
) STRICT;

-- Step 5: Seed domains
INSERT INTO domains (id, name, description) VALUES
  ('d0000001-0000-4000-8000-000000000001', 'systems_engineering', 'Architecture, distributed systems, and infrastructure design'),
  ('d0000001-0000-4000-8000-000000000002', 'software_engineering', 'Application development, code quality, and software lifecycle'),
  ('d0000001-0000-4000-8000-000000000003', 'security', 'Information security, offensive/defensive operations, and compliance'),
  ('d0000001-0000-4000-8000-000000000004', 'devops', 'CI/CD, automation, observability, and platform engineering'),
  ('d0000001-0000-4000-8000-000000000005', 'ai_ml', 'Machine learning, AI systems, and data engineering'),
  ('d0000001-0000-4000-8000-000000000006', 'leadership', 'Team leadership, mentoring, cross-functional coordination');

-- Step 6: Seed archetypes
INSERT INTO archetypes (id, name, description) VALUES
  ('a0000001-0000-4000-8000-000000000001', 'agentic-ai', 'AI/ML engineer building autonomous systems and intelligent agents'),
  ('a0000001-0000-4000-8000-000000000002', 'infrastructure', 'Infrastructure and platform engineer focused on scalable systems'),
  ('a0000001-0000-4000-8000-000000000003', 'security-engineer', 'Security engineer spanning offensive, defensive, and compliance domains'),
  ('a0000001-0000-4000-8000-000000000004', 'solutions-architect', 'Solutions architect bridging business needs with technical design'),
  ('a0000001-0000-4000-8000-000000000005', 'public-sector', 'Public sector engineer with clearance and government systems experience'),
  ('a0000001-0000-4000-8000-000000000006', 'hft', 'High-frequency trading systems engineer focused on ultra-low latency');

-- Step 7: Seed archetype_domains from ARCHETYPE_EXPECTED_DOMAINS
-- agentic-ai: ai_ml, software_engineering, leadership
INSERT INTO archetype_domains (archetype_id, domain_id)
  SELECT a.id, d.id FROM archetypes a, domains d
  WHERE a.name = 'agentic-ai' AND d.name IN ('ai_ml', 'software_engineering', 'leadership');

-- infrastructure: systems_engineering, devops, software_engineering
INSERT INTO archetype_domains (archetype_id, domain_id)
  SELECT a.id, d.id FROM archetypes a, domains d
  WHERE a.name = 'infrastructure' AND d.name IN ('systems_engineering', 'devops', 'software_engineering');

-- security-engineer: security, systems_engineering, devops
INSERT INTO archetype_domains (archetype_id, domain_id)
  SELECT a.id, d.id FROM archetypes a, domains d
  WHERE a.name = 'security-engineer' AND d.name IN ('security', 'systems_engineering', 'devops');

-- solutions-architect: systems_engineering, software_engineering, leadership
INSERT INTO archetype_domains (archetype_id, domain_id)
  SELECT a.id, d.id FROM archetypes a, domains d
  WHERE a.name = 'solutions-architect' AND d.name IN ('systems_engineering', 'software_engineering', 'leadership');

-- public-sector: security, systems_engineering, leadership
INSERT INTO archetype_domains (archetype_id, domain_id)
  SELECT a.id, d.id FROM archetypes a, domains d
  WHERE a.name = 'public-sector' AND d.name IN ('security', 'systems_engineering', 'leadership');

-- hft: systems_engineering, software_engineering
INSERT INTO archetype_domains (archetype_id, domain_id)
  SELECT a.id, d.id FROM archetypes a, domains d
  WHERE a.name = 'hft' AND d.name IN ('systems_engineering', 'software_engineering');

-- Step 8: Add status to organizations
ALTER TABLE organizations ADD COLUMN status TEXT CHECK (status IN (
  'interested', 'review', 'targeting', 'excluded'
));

-- Step 9: Rename work_history -> experience in resume_entries
UPDATE resume_entries SET section = 'experience' WHERE section = 'work_history';

-- Step 10: Register migration
INSERT INTO _migrations (name) VALUES ('003_renderer_and_entities');
