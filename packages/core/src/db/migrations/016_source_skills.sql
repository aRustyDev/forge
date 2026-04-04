-- Source Skills Junction
-- Migration: 016_source_skills
-- Links skills to sources for reference/filtering.
-- Skills describe what technologies/tools were used in each experience.

CREATE TABLE source_skills (
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, skill_id)
) STRICT;

CREATE INDEX idx_source_skills_source ON source_skills(source_id);
CREATE INDEX idx_source_skills_skill ON source_skills(skill_id);

INSERT INTO _migrations (name) VALUES ('016_source_skills');
