-- Forge Resume Builder -- Resume Templates
-- Migration: 008_resume_templates
-- Date: 2026-03-31
--
-- Creates resume_templates table for reusable section layouts.
-- Seeds three built-in templates.
-- Builds on 007_job_descriptions.

-- Step 1: Create resume_templates table
CREATE TABLE resume_templates (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  name TEXT NOT NULL,
  description TEXT,
  sections TEXT NOT NULL,     -- JSON array of section definitions
  is_builtin INTEGER NOT NULL DEFAULT 0,  -- 1 for seeded templates, 0 for user-created
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Step 2: Seed built-in templates

-- Standard Tech Resume
-- NOTE: entry_type is 'education', not 'certifications'. The title is a naming convention.
-- For structured certification rendering (CertificationGroup), create a separate section
-- with entry_type = 'certifications'.
INSERT INTO resume_templates (id, name, description, sections, is_builtin) VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'Standard Tech Resume',
  'Classic layout for software engineering and technical roles. Summary, experience, skills, education, projects.',
  '[
    {"title": "Summary", "entry_type": "freeform", "position": 0},
    {"title": "Experience", "entry_type": "experience", "position": 1},
    {"title": "Technical Skills", "entry_type": "skills", "position": 2},
    {"title": "Education & Certifications", "entry_type": "education", "position": 3},
    {"title": "Selected Projects", "entry_type": "projects", "position": 4}
  ]',
  1
);

-- Academic CV
INSERT INTO resume_templates (id, name, description, sections, is_builtin) VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'Academic CV',
  'Extended format for academic and research positions. Education first, then research, publications, presentations.',
  '[
    {"title": "Education", "entry_type": "education", "position": 0},
    {"title": "Research Experience", "entry_type": "experience", "position": 1},
    {"title": "Publications", "entry_type": "projects", "position": 2},
    {"title": "Presentations", "entry_type": "presentations", "position": 3},
    {"title": "Technical Skills", "entry_type": "skills", "position": 4},
    {"title": "Awards", "entry_type": "awards", "position": 5}
  ]',
  1
);

-- Federal Resume
-- NOTE: entry_type is 'education', not 'certifications'. The title is a naming convention.
-- For structured certification rendering (CertificationGroup), create a separate section
-- with entry_type = 'certifications'.
INSERT INTO resume_templates (id, name, description, sections, is_builtin) VALUES (
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  'Federal Resume',
  'Detailed format for US government positions. Includes security clearance section and extended experience detail.',
  '[
    {"title": "Summary of Qualifications", "entry_type": "freeform", "position": 0},
    {"title": "Security Clearance", "entry_type": "clearance", "position": 1},
    {"title": "Professional Experience", "entry_type": "experience", "position": 2},
    {"title": "Technical Competencies", "entry_type": "skills", "position": 3},
    {"title": "Education & Certifications", "entry_type": "education", "position": 4},
    {"title": "Selected Projects", "entry_type": "projects", "position": 5}
  ]',
  1
);

-- Step 3: Register migration
INSERT INTO _migrations (name) VALUES ('008_resume_templates');
