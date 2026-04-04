-- Job Description Skills Junction
-- Migration: 018_job_description_skills
-- Links skills to job descriptions for requirement tracking.
-- Skills describe what technologies/tools the JD requires.

CREATE TABLE job_description_skills (
  job_description_id TEXT NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (job_description_id, skill_id)
) STRICT;

CREATE INDEX idx_jd_skills_jd ON job_description_skills(job_description_id);
CREATE INDEX idx_jd_skills_skill ON job_description_skills(skill_id);

INSERT INTO _migrations (name) VALUES ('018_job_description_skills');
