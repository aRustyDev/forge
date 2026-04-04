-- Job Description Resumes Junction
-- Migration: 026_job_description_resumes
-- Links resumes to job descriptions for application tracking.
-- Many-to-many: one resume can target multiple JDs, one JD can have multiple resume versions.

CREATE TABLE job_description_resumes (
  job_description_id TEXT NOT NULL REFERENCES job_descriptions(id) ON DELETE CASCADE,
  resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (job_description_id, resume_id)
) STRICT;

CREATE INDEX idx_jd_resumes_jd ON job_description_resumes(job_description_id);
CREATE INDEX idx_jd_resumes_resume ON job_description_resumes(resume_id);

INSERT INTO _migrations (name) VALUES ('026_job_description_resumes');
