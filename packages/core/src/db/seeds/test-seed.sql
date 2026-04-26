-- Forge Test Seed Data
-- Deterministic IDs: test-{entity}-{NNNN}-0000-0000-000000000000 (36 chars)
-- Idempotent: uses INSERT OR IGNORE throughout.
-- Run after migrations: sqlite3 "$FORGE_DB_PATH" < test-seed.sql
--
-- Coverage:
--   2 organizations (1 HQ w/ address, 1 remote-only) + 1 university
--   3 source_roles (hybrid, remote, contract)
--   4 sources (3 roles + 1 education)
--   6 skills
--   6 bullets (2 per role source)
--   4 perspectives (mixed archetypes/domains/framings)
--   1 profile (fake identity + address)
--   3 archetypes + 2 domains + junctions
--   1 resume with 3 sections (experience, skills, education)
--   2 certifications (with skills)
--   1 credential (clearance)
--   3 answer_bank entries
--   1 job_description (with parsed_sections + skills)
--   All junction tables populated

PRAGMA foreign_keys = ON;

-- ═══════════════════════════════════════════════════════════
-- 1. ADDRESSES
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO addresses (id, name, street_1, city, state, zip, country_code) VALUES
  ('test-adr-0001-0000-0000-000000000000', 'TechCorp HQ', '100 Innovation Way', 'Austin', 'TX', '78701', 'US'),
  ('test-adr-0002-0000-0000-000000000000', 'Home Address', '42 Elm Street', 'Portland', 'OR', '97201', 'US');

-- ═══════════════════════════════════════════════════════════
-- 2. ORGANIZATIONS
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO organizations (id, name, org_type, industry, worked, employment_type, website) VALUES
  ('test-org-0001-0000-0000-000000000000', 'TechCorp Industries', 'company', 'Technology', 1, 'civilian', 'https://techcorp.example.com'),
  ('test-org-0002-0000-0000-000000000000', 'RemoteFirst Inc', 'company', 'Cloud Services', 1, 'contractor', 'https://remotefirst.example.com'),
  ('test-org-0003-0000-0000-000000000000', 'State University', 'education', 'Education', 0, NULL, 'https://stateuniv.example.edu');

-- ═══════════════════════════════════════════════════════════
-- 3. ORG LOCATIONS + TAGS
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO org_locations (id, organization_id, name, modality, address_id, is_headquarters) VALUES
  ('test-loc-0001-0000-0000-000000000000', 'test-org-0001-0000-0000-000000000000', 'Austin HQ', 'hybrid', 'test-adr-0001-0000-0000-000000000000', 1),
  ('test-loc-0002-0000-0000-000000000000', 'test-org-0002-0000-0000-000000000000', 'Remote', 'remote', NULL, 0),
  ('test-loc-0003-0000-0000-000000000000', 'test-org-0003-0000-0000-000000000000', 'Main Campus', 'in_person', NULL, 1);

INSERT OR IGNORE INTO org_tags (organization_id, tag) VALUES
  ('test-org-0001-0000-0000-000000000000', 'company'),
  ('test-org-0002-0000-0000-000000000000', 'company'),
  ('test-org-0003-0000-0000-000000000000', 'university');

-- ═══════════════════════════════════════════════════════════
-- 4. SKILLS
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO skills (id, name, category) VALUES
  ('test-skl-0001-0000-0000-000000000000', 'Python (test)', 'language'),
  ('test-skl-0002-0000-0000-000000000000', 'Kubernetes (test)', 'infrastructure'),
  ('test-skl-0003-0000-0000-000000000000', 'Terraform (test)', 'infrastructure'),
  ('test-skl-0004-0000-0000-000000000000', 'Docker (test)', 'infrastructure'),
  ('test-skl-0005-0000-0000-000000000000', 'TypeScript (test)', 'language'),
  ('test-skl-0006-0000-0000-000000000000', 'Incident Response (test)', 'security');

-- ═══════════════════════════════════════════════════════════
-- 5. SOURCES (3 roles + 1 education)
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO sources (id, title, description, source_type, start_date, end_date, status) VALUES
  ('test-src-0001-0000-0000-000000000000', 'Senior Security Engineer', 'Led cloud security initiatives and incident response for enterprise SaaS platform.', 'role', '2023-01-15', NULL, 'approved'),
  ('test-src-0002-0000-0000-000000000000', 'Infrastructure Engineer', 'Built and maintained Kubernetes clusters and CI/CD pipelines for distributed microservices.', 'role', '2021-06-01', '2022-12-31', 'approved'),
  ('test-src-0003-0000-0000-000000000000', 'DevOps Contractor', 'Short-term contract for Terraform migration and Docker containerization of legacy services.', 'role', '2020-03-01', '2021-05-31', 'approved'),
  ('test-src-0004-0000-0000-000000000000', 'BS Computer Science', 'Bachelor of Science in Computer Science with focus on distributed systems.', 'education', '2016-08-15', '2020-05-15', 'approved');

-- ═══════════════════════════════════════════════════════════
-- 6. SOURCE ROLES (1:1 with role sources)
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO source_roles (source_id, organization_id, start_date, end_date, is_current, work_arrangement) VALUES
  ('test-src-0001-0000-0000-000000000000', 'test-org-0001-0000-0000-000000000000', '2023-01-15', NULL, 1, 'hybrid'),
  ('test-src-0002-0000-0000-000000000000', 'test-org-0002-0000-0000-000000000000', '2021-06-01', '2022-12-31', 0, 'remote'),
  ('test-src-0003-0000-0000-000000000000', 'test-org-0001-0000-0000-000000000000', '2020-03-01', '2021-05-31', 0, 'remote');

-- ═══════════════════════════════════════════════════════════
-- 7. SOURCE EDUCATION (1:1 with education source)
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO source_education (source_id, education_type, organization_id, campus_id, field, start_date, end_date, is_in_progress, degree_level) VALUES
  ('test-src-0004-0000-0000-000000000000', 'degree', 'test-org-0003-0000-0000-000000000000', 'test-loc-0003-0000-0000-000000000000', 'Computer Science', '2016-08-15', '2020-05-15', 0, 'bachelors');

-- ═══════════════════════════════════════════════════════════
-- 8. SOURCE SKILLS (which skills each source used)
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO source_skills (source_id, skill_id) VALUES
  -- Senior Security Engineer: Python, Kubernetes, Incident Response
  ('test-src-0001-0000-0000-000000000000', 'test-skl-0001-0000-0000-000000000000'),
  ('test-src-0001-0000-0000-000000000000', 'test-skl-0002-0000-0000-000000000000'),
  ('test-src-0001-0000-0000-000000000000', 'test-skl-0006-0000-0000-000000000000'),
  -- Infrastructure Engineer: Kubernetes, Docker, Terraform
  ('test-src-0002-0000-0000-000000000000', 'test-skl-0002-0000-0000-000000000000'),
  ('test-src-0002-0000-0000-000000000000', 'test-skl-0004-0000-0000-000000000000'),
  ('test-src-0002-0000-0000-000000000000', 'test-skl-0003-0000-0000-000000000000'),
  -- DevOps Contractor: Terraform, Docker
  ('test-src-0003-0000-0000-000000000000', 'test-skl-0003-0000-0000-000000000000'),
  ('test-src-0003-0000-0000-000000000000', 'test-skl-0004-0000-0000-000000000000');

-- ═══════════════════════════════════════════════════════════
-- 9. BULLETS (2 per role source = 6 total)
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO bullets (id, content, source_content_snapshot, metrics, status, domain) VALUES
  -- Source 1: Senior Security Engineer
  ('test-blt-0001-0000-0000-000000000000',
   'Designed and deployed zero-trust network architecture across 3 AWS regions, reducing lateral movement attack surface by 94%.',
   'Led cloud security initiatives and incident response for enterprise SaaS platform.',
   '94% attack surface reduction', 'approved', 'cloud-security'),
  ('test-blt-0002-0000-0000-000000000000',
   'Led incident response for 12 security events, achieving mean-time-to-containment of 23 minutes vs. industry average of 287 minutes.',
   'Led cloud security initiatives and incident response for enterprise SaaS platform.',
   'MTTC: 23 min vs 287 min industry avg', 'approved', 'incident-response'),
  -- Source 2: Infrastructure Engineer
  ('test-blt-0003-0000-0000-000000000000',
   'Migrated 47 microservices from Docker Compose to Kubernetes, achieving 99.97% uptime with automated rollback on health check failures.',
   'Built and maintained Kubernetes clusters and CI/CD pipelines for distributed microservices.',
   '99.97% uptime, 47 services', 'approved', 'infrastructure'),
  ('test-blt-0004-0000-0000-000000000000',
   'Built GitOps CI/CD pipeline using ArgoCD and Helm, reducing deployment time from 45 minutes to 4 minutes.',
   'Built and maintained Kubernetes clusters and CI/CD pipelines for distributed microservices.',
   'Deploy time: 45 min → 4 min', 'approved', 'devops'),
  -- Source 3: DevOps Contractor
  ('test-blt-0005-0000-0000-000000000000',
   'Containerized 8 legacy Java services with multi-stage Docker builds, reducing image sizes by 73% and startup time by 60%.',
   'Short-term contract for Terraform migration and Docker containerization of legacy services.',
   '73% image size reduction, 60% faster startup', 'approved', 'infrastructure'),
  ('test-blt-0006-0000-0000-000000000000',
   'Authored Terraform modules for AWS VPC, ECS, and RDS provisioning, enabling infrastructure-as-code for 3 development teams.',
   'Short-term contract for Terraform migration and Docker containerization of legacy services.',
   '3 teams onboarded to IaC', 'approved', 'infrastructure');

-- ═══════════════════════════════════════════════════════════
-- 10. BULLET ↔ SOURCE JUNCTIONS
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO bullet_sources (bullet_id, source_id, is_primary) VALUES
  ('test-blt-0001-0000-0000-000000000000', 'test-src-0001-0000-0000-000000000000', 1),
  ('test-blt-0002-0000-0000-000000000000', 'test-src-0001-0000-0000-000000000000', 1),
  ('test-blt-0003-0000-0000-000000000000', 'test-src-0002-0000-0000-000000000000', 1),
  ('test-blt-0004-0000-0000-000000000000', 'test-src-0002-0000-0000-000000000000', 1),
  ('test-blt-0005-0000-0000-000000000000', 'test-src-0003-0000-0000-000000000000', 1),
  ('test-blt-0006-0000-0000-000000000000', 'test-src-0003-0000-0000-000000000000', 1);

-- ═══════════════════════════════════════════════════════════
-- 11. BULLET ↔ SKILL JUNCTIONS
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO bullet_skills (bullet_id, skill_id) VALUES
  -- Bullet 1 (zero-trust): Python, Kubernetes
  ('test-blt-0001-0000-0000-000000000000', 'test-skl-0001-0000-0000-000000000000'),
  ('test-blt-0001-0000-0000-000000000000', 'test-skl-0002-0000-0000-000000000000'),
  -- Bullet 2 (incident response): Incident Response
  ('test-blt-0002-0000-0000-000000000000', 'test-skl-0006-0000-0000-000000000000'),
  -- Bullet 3 (k8s migration): Kubernetes, Docker
  ('test-blt-0003-0000-0000-000000000000', 'test-skl-0002-0000-0000-000000000000'),
  ('test-blt-0003-0000-0000-000000000000', 'test-skl-0004-0000-0000-000000000000'),
  -- Bullet 4 (GitOps): Kubernetes
  ('test-blt-0004-0000-0000-000000000000', 'test-skl-0002-0000-0000-000000000000'),
  -- Bullet 5 (containerization): Docker
  ('test-blt-0005-0000-0000-000000000000', 'test-skl-0004-0000-0000-000000000000'),
  -- Bullet 6 (Terraform): Terraform
  ('test-blt-0006-0000-0000-000000000000', 'test-skl-0003-0000-0000-000000000000');

-- ═══════════════════════════════════════════════════════════
-- 12. ARCHETYPES + DOMAINS + JUNCTION
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO archetypes (id, name, description) VALUES
  ('test-arc-0001-0000-0000-000000000000', 'security-engineer (test)', 'Security-focused engineering roles'),
  ('test-arc-0002-0000-0000-000000000000', 'infrastructure (test)', 'Infrastructure and platform engineering'),
  ('test-arc-0003-0000-0000-000000000000', 'agentic-ai (test)', 'AI agent and automation engineering');

INSERT OR IGNORE INTO domains (id, name, description) VALUES
  ('test-dom-0001-0000-0000-000000000000', 'cloud-security (test)', 'Cloud infrastructure security'),
  ('test-dom-0002-0000-0000-000000000000', 'devops (test)', 'DevOps and platform engineering');

INSERT OR IGNORE INTO archetype_domains (archetype_id, domain_id) VALUES
  ('test-arc-0001-0000-0000-000000000000', 'test-dom-0001-0000-0000-000000000000'),
  ('test-arc-0002-0000-0000-000000000000', 'test-dom-0002-0000-0000-000000000000'),
  ('test-arc-0003-0000-0000-000000000000', 'test-dom-0001-0000-0000-000000000000'),
  ('test-arc-0003-0000-0000-000000000000', 'test-dom-0002-0000-0000-000000000000');

-- ═══════════════════════════════════════════════════════════
-- 13. PERSPECTIVES (4, mixed framings/archetypes)
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO perspectives (id, bullet_id, content, bullet_content_snapshot, target_archetype, domain, framing, status) VALUES
  -- Accomplishment framing of zero-trust bullet, security archetype
  ('test-per-0001-0000-0000-000000000000',
   'test-blt-0001-0000-0000-000000000000',
   'Architected zero-trust network segmentation across 3 AWS regions, eliminating 94% of lateral movement vectors identified in prior red team assessments.',
   'Designed and deployed zero-trust network architecture across 3 AWS regions, reducing lateral movement attack surface by 94%.',
   'security-engineer', 'cloud-security', 'accomplishment', 'approved'),
  -- Responsibility framing of k8s migration bullet, infra archetype
  ('test-per-0002-0000-0000-000000000000',
   'test-blt-0003-0000-0000-000000000000',
   'Owned migration of 47 microservices from Docker Compose to production Kubernetes clusters with automated health-check rollbacks.',
   'Migrated 47 microservices from Docker Compose to Kubernetes, achieving 99.97% uptime with automated rollback on health check failures.',
   'infrastructure', 'devops', 'responsibility', 'approved'),
  -- Context framing of incident response bullet, security archetype
  ('test-per-0003-0000-0000-000000000000',
   'test-blt-0002-0000-0000-000000000000',
   'Served as primary incident commander for production security events, establishing playbooks that reduced mean-time-to-containment to 23 minutes.',
   'Led incident response for 12 security events, achieving mean-time-to-containment of 23 minutes vs. industry average of 287 minutes.',
   'security-engineer', 'cloud-security', 'context', 'approved'),
  -- Accomplishment framing of Terraform bullet, infra archetype
  ('test-per-0004-0000-0000-000000000000',
   'test-blt-0006-0000-0000-000000000000',
   'Delivered reusable Terraform modules for core AWS infrastructure (VPC, ECS, RDS), accelerating 3 teams'' transition to infrastructure-as-code.',
   'Authored Terraform modules for AWS VPC, ECS, and RDS provisioning, enabling infrastructure-as-code for 3 development teams.',
   'infrastructure', 'devops', 'accomplishment', 'approved');

-- ═══════════════════════════════════════════════════════════
-- 14. USER PROFILE
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO user_profile (id, name, email, phone, address_id, salary_minimum, salary_target) VALUES
  ('test-prf-0001-0000-0000-000000000000', 'Alex Testworth', 'alex@test.example.com', '555-0199', 'test-adr-0002-0000-0000-000000000000', 150000, 180000);

INSERT OR IGNORE INTO profile_urls (id, profile_id, key, url, position) VALUES
  ('test-pul-0001-0000-0000-000000000000', 'test-prf-0001-0000-0000-000000000000', 'linkedin', 'https://linkedin.com/in/alextestworth', 0),
  ('test-pul-0002-0000-0000-000000000000', 'test-prf-0001-0000-0000-000000000000', 'github', 'https://github.com/alextestworth', 1);

-- ═══════════════════════════════════════════════════════════
-- 15. SUMMARIES
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO summaries (id, title, role, description) VALUES
  ('test-sum-0001-0000-0000-000000000000', 'Security Engineer Summary', 'Senior Security Engineer',
   'Security engineer with 5+ years building secure cloud infrastructure, specializing in zero-trust architecture and automated incident response. Experienced in Kubernetes security, IaC with Terraform, and DevSecOps pipeline integration.');

-- ═══════════════════════════════════════════════════════════
-- 16. RESUME + SECTIONS + ENTRIES
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO resumes (id, name, target_role, target_employer, archetype, status, summary_id) VALUES
  ('test-rsm-0001-0000-0000-000000000000', 'Security Engineer Resume', 'Senior Security Engineer', 'TechCorp Industries', 'security-engineer', 'draft', 'test-sum-0001-0000-0000-000000000000');

INSERT OR IGNORE INTO resume_sections (id, resume_id, title, entry_type, position) VALUES
  ('test-sec-0001-0000-0000-000000000000', 'test-rsm-0001-0000-0000-000000000000', 'Experience', 'experience', 0),
  ('test-sec-0002-0000-0000-000000000000', 'test-rsm-0001-0000-0000-000000000000', 'Technical Skills', 'skills', 1),
  ('test-sec-0003-0000-0000-000000000000', 'test-rsm-0001-0000-0000-000000000000', 'Education', 'education', 2);

-- Experience entries linked to perspectives
INSERT OR IGNORE INTO resume_entries (id, resume_id, section_id, perspective_id, content, position, source_id) VALUES
  ('test-ent-0001-0000-0000-000000000000', 'test-rsm-0001-0000-0000-000000000000', 'test-sec-0001-0000-0000-000000000000',
   'test-per-0001-0000-0000-000000000000', NULL, 0, 'test-src-0001-0000-0000-000000000000'),
  ('test-ent-0002-0000-0000-000000000000', 'test-rsm-0001-0000-0000-000000000000', 'test-sec-0001-0000-0000-000000000000',
   'test-per-0003-0000-0000-000000000000', NULL, 1, 'test-src-0001-0000-0000-000000000000'),
  ('test-ent-0003-0000-0000-000000000000', 'test-rsm-0001-0000-0000-000000000000', 'test-sec-0001-0000-0000-000000000000',
   'test-per-0002-0000-0000-000000000000', NULL, 2, 'test-src-0002-0000-0000-000000000000');

-- Education entry (no perspective, direct content)
INSERT OR IGNORE INTO resume_entries (id, resume_id, section_id, perspective_id, content, position, source_id) VALUES
  ('test-ent-0004-0000-0000-000000000000', 'test-rsm-0001-0000-0000-000000000000', 'test-sec-0003-0000-0000-000000000000',
   NULL, NULL, 0, 'test-src-0004-0000-0000-000000000000');

-- Skills in the skills section
INSERT OR IGNORE INTO resume_skills (id, section_id, skill_id, position) VALUES
  ('test-rsk-0001-0000-0000-000000000000', 'test-sec-0002-0000-0000-000000000000', 'test-skl-0001-0000-0000-000000000000', 0),
  ('test-rsk-0002-0000-0000-000000000000', 'test-sec-0002-0000-0000-000000000000', 'test-skl-0002-0000-0000-000000000000', 1),
  ('test-rsk-0003-0000-0000-000000000000', 'test-sec-0002-0000-0000-000000000000', 'test-skl-0003-0000-0000-000000000000', 2),
  ('test-rsk-0004-0000-0000-000000000000', 'test-sec-0002-0000-0000-000000000000', 'test-skl-0006-0000-0000-000000000000', 3);

-- ═══════════════════════════════════════════════════════════
-- 17. CERTIFICATIONS + SKILLS
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO certifications (id, short_name, long_name, cert_id, date_earned, in_progress) VALUES
  ('test-crt-0001-0000-0000-000000000000', 'CISSP', 'Certified Information Systems Security Professional', 'CISSP-TEST-001', '2022-06-15', 0),
  ('test-crt-0002-0000-0000-000000000000', 'CKA', 'Certified Kubernetes Administrator', 'CKA-TEST-001', '2021-11-20', 0);

INSERT OR IGNORE INTO certification_skills (certification_id, skill_id) VALUES
  ('test-crt-0001-0000-0000-000000000000', 'test-skl-0006-0000-0000-000000000000'),
  ('test-crt-0002-0000-0000-000000000000', 'test-skl-0002-0000-0000-000000000000'),
  ('test-crt-0002-0000-0000-000000000000', 'test-skl-0004-0000-0000-000000000000');

-- ═══════════════════════════════════════════════════════════
-- 18. CREDENTIALS (clearance)
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO credentials (id, credential_type, label, status, details, issued_date) VALUES
  ('test-crd-0001-0000-0000-000000000000', 'clearance', 'Secret Clearance', 'active',
   '{"level":"secret","investigation_type":"T3","adjudication_date":"2022-01-15"}',
   '2022-01-15');

-- ═══════════════════════════════════════════════════════════
-- 19. ANSWER BANK
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO answer_bank (id, field_kind, label, value) VALUES
  ('test-ans-0001-0000-0000-000000000000', 'authorized_to_work', 'Authorized to work in the US?', 'Yes'),
  ('test-ans-0002-0000-0000-000000000000', 'sponsorship_required', 'Do you require visa sponsorship?', 'No'),
  ('test-ans-0003-0000-0000-000000000000', 'years_of_experience', 'Years of professional experience', '6');

-- ═══════════════════════════════════════════════════════════
-- 20. JOB DESCRIPTION + SKILLS
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO job_descriptions (id, organization_id, title, url, raw_text, status, salary_min, salary_max, location, work_posture, parsed_sections) VALUES
  ('test-jd--0001-0000-0000-000000000000', 'test-org-0001-0000-0000-000000000000',
   'Staff Security Engineer', 'https://jobs.techcorp.example.com/12345',
   'We are looking for a Staff Security Engineer to lead our cloud security practice. You will design zero-trust architectures, lead incident response, and mentor junior engineers. Requirements: 5+ years in security engineering, experience with AWS/GCP, Kubernetes security, Terraform. Nice to have: CISSP, CKA.',
   'analyzing', 160000, 220000, 'Austin, TX (Hybrid)', 'hybrid',
   '{"responsibilities":["Design zero-trust architectures","Lead incident response","Mentor junior engineers"],"requirements":["5+ years security engineering","AWS/GCP experience","Kubernetes security","Terraform"],"nice_to_have":["CISSP","CKA"]}');

INSERT OR IGNORE INTO job_description_skills (job_description_id, skill_id) VALUES
  ('test-jd--0001-0000-0000-000000000000', 'test-skl-0002-0000-0000-000000000000'),
  ('test-jd--0001-0000-0000-000000000000', 'test-skl-0003-0000-0000-000000000000'),
  ('test-jd--0001-0000-0000-000000000000', 'test-skl-0006-0000-0000-000000000000');
