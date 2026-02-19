---
paths:
  - "data/**/*.db"
  - "data/**/*.sqlite*"
  - "**/*.sql"
  - ".claude/scratch/**"
---

# Resume & Jobs Database Rules

This file describes how to interact with `data/resume.sqlite.db`, the resume bullet, career data, and job tracking store.

## Purpose

This database stores structured career data optimized for:
1. **Resume Generation** - Bullet-centric design where individual accomplishment bullets are the atomic unit
2. **Job Tracking** - Store job listings, track applications, detect duplicates, analyze skill gaps
3. **Contact Management** - Track recruiters, hiring managers, and professional contacts

## Database Location

```
data/resume.sqlite.db
```

---

## Resume Entities

### Primary Tables

| Table | Purpose |
|-------|---------|
| `bullets` | Core accomplishment statements with framing and status |
| `organizations` | Companies/organizations (both worked for and prospective) |
| `roles` | Job titles/positions at organizations |
| `skills` | Technical and soft skills |
| `resumes` | Generated resume definitions |
| `projects` | Personal/professional projects |
| `education` | Degrees, certificates, courses |
| `research` | Research projects |
| `publications` | Papers, articles, presentations |
| `events` | Conferences, talks, workshops |
| `awards` | Recognition and honors |
| `languages` | Language proficiencies |
| `clearances` | Security clearances |

### Resume Junction Tables

| Junction | Links |
|----------|-------|
| `bullet_roles` | Bullets ↔ Roles (has `is_primary` flag) |
| `bullet_skills` | Bullets ↔ Skills |
| `bullet_projects` | Bullets ↔ Projects |
| `bullet_education` | Bullets ↔ Education |
| `bullet_research` | Bullets ↔ Research |
| `bullet_publications` | Bullets ↔ Publications |
| `bullet_events` | Bullets ↔ Events |
| `bullet_awards` | Bullets ↔ Awards |
| `resume_bullets` | Resumes ↔ Bullets (has `position`, `section`) |
| `project_roles` | Projects ↔ Roles |
| `project_skills` | Projects ↔ Skills |
| `research_roles` | Research ↔ Roles |
| `award_roles` | Awards ↔ Roles |
| `award_education` | Awards ↔ Education |
| `clearance_roles` | Clearances ↔ Roles |

---

## Job Tracking Entities

### Organizations (Unified)

The `organizations` table stores both employers you've worked for AND companies you're tracking for job applications. Key fields:

| Field | Purpose |
|-------|---------|
| `worked` | TRUE for past/current employers, FALSE for prospective companies |
| `org_type` | company, nonprofit, government, military, education, volunteer, freelance, other |
| `employment_type` | civilian, contractor, military_active, military_reserve, volunteer, intern (for worked=TRUE) |
| `glassdoor_rating` | Numeric rating for reputation tracking |
| `reputation_notes` | General reputation observations |
| `turnover_notes` | Notes on turnover/stability |

Related tables:
- `organization_benefits` - PTO, equity, health, education, retirement benefits
- `organization_flags` - Red flags (high_turnover, startup_risk, culture_concerns, etc.)
- `organization_contacts` - Junction to contacts at this organization

### Jobs

| Table | Purpose |
|-------|---------|
| `jobs` | Job listings with deduplication support |
| `job_sources` | Where jobs were found (LinkedIn, Indeed, etc.) with scrape tracking |
| `job_skills` | Skills required/preferred with quantity ranges |
| `job_flags` | Red flags specific to listings (lowball_compensation, vague_requirements, etc.) |
| `job_changes` | Change history for tracking job description updates |
| `job_contacts` | Contacts associated with jobs |

#### Job Deduplication

Jobs support three deduplication approaches:
1. **Same source + external_id** - Exact match within a source
2. **content_hash** - Hash of normalized description for fuzzy matching
3. **canonical_job_id** - Manual linking of duplicates to a canonical job

### Applications

| Table | Purpose |
|-------|---------|
| `applications` | Application records with outcome tracking |
| `application_events` | Timeline of events (interviews, screens, etc.) with timing metrics |
| `application_documents` | Resumes, cover letters, portfolios submitted |
| `application_notes` | Structured notes (feedback, concerns, learnings) |
| `application_contacts` | Contacts involved in this application |

#### Application Status Flow

```
applied → recruiter_screen → phone_screen → coding_interview →
system_design_interview → technical_interview → onsite →
team_match → offer → negotiation → accepted/rejected/withdrawn/ghosted
```

### Contacts

| Table | Purpose |
|-------|---------|
| `contacts` | Global contacts table (recruiters, hiring managers, referrals, etc.) |
| `organization_contacts` | Links contacts to organizations |
| `job_contacts` | Links contacts to specific jobs |
| `application_contacts` | Links contacts to applications |

---

## Enum Values

### Bullet Status
- `draft` - Initial creation, needs review
- `accepted` - Approved for use in resumes

### Bullet Framing
- `ai_ml` - AI/ML engineering focus
- `devops` - DevOps/platform engineering focus
- `leadership` - Management/leadership focus
- `security` - Security/forensics focus
- `software_engineering` - General software engineering
- `systems_engineering` - Infrastructure/systems focus

### Skill Categories
- `methodology` - Practices (CI/CD, Threat Hunting, MLOps)
- `language` - Programming languages (Python, Bash, Go)
- `platform` - Platforms (Kubernetes, Docker, Linux)
- `tool` - Specific tools (Terraform, Splunk, Ansible)
- `cloud` - Cloud providers (AWS, GCP, Azure)
- `framework` - Frameworks (MCP, FastAPI)

### Job Level
- `intern`, `entry`, `junior`, `mid`, `senior`, `staff`, `principal`, `distinguished`, `fellow`
- `lead`, `manager`, `director`, `vp`, `c_level`, `unknown`

### Job Status
- `active` - Currently posted
- `saved` - Saved for later
- `applied` - Application submitted
- `closed` - No longer accepting
- `filled`, `expired`, `duplicate`, `not_interested`

### Skill Requirement Level
- `required` - Must have
- `preferred` - Nice to have
- `nice_to_have` - Bonus
- `unknown` - Not specified

### Organization Flag Types
- `high_turnover`, `startup_risk`, `culture_concerns`, `financial_instability`, `legal_issues`, `layoff_history`, `other`

### Job Flag Types
- `lowball_compensation`, `vague_requirements`, `scope_mismatch`, `process_red_flag`, `unrealistic_expectations`, `keyword_stuffing`, `bait_and_switch`, `other`

---

## Built-in Views

### Resume Views
| View | Purpose |
|------|---------|
| `status_summary` | Count bullets by status |
| `framing_summary` | Count accepted bullets by framing |
| `draft_bullets` | All bullets with status='draft' |
| `unused_bullets` | Accepted bullets not in any resume |
| `skill_bullet_coverage` | Skills ranked by bullet count |
| `military_service` | Formatted military service history |

### Job Tracking Views
| View | Purpose |
|------|---------|
| `job_skill_coverage` | Jobs with required/preferred skill coverage percentages |
| `job_skill_demand` | Skills ranked by frequency in job listings |
| `application_pipeline` | Application counts and timing by status |
| `organization_success_rates` | Success rates and timing by company |
| `stale_jobs` | Jobs not seen in 14+ days |
| `potential_duplicates` | Jobs with same title/org or matching content_hash |
| `interview_timing` | Interview timing patterns by company and stage |
| `skill_gaps` | Skills required by jobs you're interested in but missing bullets for |

---

## Workflows

### Adding Jobs from JobSpy

```sql
-- 1. Create or find organization
INSERT OR IGNORE INTO organizations (name, worked)
VALUES ('Company Name', FALSE);

-- 2. Insert job
INSERT INTO jobs (
    organization_id, title, level, location, is_remote,
    salary_min, salary_max, description, date_posted, interest_level
) VALUES (
    (SELECT id FROM organizations WHERE name = 'Company Name'),
    'Senior AI Engineer', 'senior', 'Remote', TRUE,
    200000, 250000, '...description...', '2024-01-15', 4
);

-- 3. Add source
INSERT INTO job_sources (job_id, source, external_id, url, is_primary)
VALUES (last_insert_rowid(), 'linkedin', 'abc123', 'https://...', TRUE);

-- 4. Link skills
INSERT INTO job_skills (job_id, skill_id, requirement_level, quantity_min, quantity_max, quantity_unit)
SELECT last_insert_rowid(), id, 'required', 3, 5, 'years'
FROM skills WHERE name = 'Python';
```

### Tracking Applications

```sql
-- 1. Create application
INSERT INTO applications (job_id, applied_date, resume_id)
VALUES (123, date('now'), 1);

-- 2. Log events
INSERT INTO application_events (
    application_id, status, event_date, interview_type, duration_minutes, notes
) VALUES (
    last_insert_rowid(), 'phone_screen', date('now'), 'video', 30, 'Initial screen with recruiter'
);

-- 3. Update application status
UPDATE applications
SET current_status = 'phone_screen', current_status_date = date('now')
WHERE id = 123;
```

### Finding Skill Gaps

```sql
-- Skills required by interesting jobs that you don't have bullets for
SELECT * FROM skill_gaps;

-- Check your coverage for a specific job
SELECT * FROM job_skill_coverage WHERE job_id = 123;
```

### Deduplicating Jobs

```sql
-- Find potential duplicates
SELECT * FROM potential_duplicates;

-- Mark as duplicate of canonical job
UPDATE jobs SET canonical_job_id = 100, status = 'duplicate' WHERE id = 101;
```

---

## Common Queries

### Find bullets for a specific role
```sql
SELECT b.* FROM bullets b
JOIN bullet_roles br ON b.id = br.bullet_id
WHERE br.role_id = ? AND b.status = 'accepted';
```

### Get full bullet context
```sql
SELECT
  b.id, b.content, b.framing, b.status,
  GROUP_CONCAT(DISTINCT s.name) as skills,
  GROUP_CONCAT(DISTINCT o.name || ' - ' || r.title) as roles
FROM bullets b
LEFT JOIN bullet_skills bs ON b.id = bs.bullet_id
LEFT JOIN skills s ON bs.skill_id = s.id
LEFT JOIN bullet_roles br ON b.id = br.bullet_id
LEFT JOIN roles r ON br.role_id = r.id
LEFT JOIN organizations o ON r.organization_id = o.id
WHERE b.id = ?
GROUP BY b.id;
```

### Jobs matching your skill profile
```sql
SELECT j.*, jsc.required_coverage_pct, jsc.preferred_coverage_pct
FROM jobs j
JOIN job_skill_coverage jsc ON j.id = jsc.job_id
WHERE j.status = 'active'
  AND j.salary_min >= 200000
ORDER BY jsc.required_coverage_pct DESC;
```

### Application timeline for a job
```sql
SELECT ae.status, ae.event_date, ae.days_since_applied, ae.notes
FROM application_events ae
JOIN applications a ON ae.application_id = a.id
WHERE a.job_id = ?
ORDER BY ae.event_date;
```

---

## Best Practices

### Resume Data
1. **Always link bullets to roles** - Every bullet needs at least one role via `bullet_roles`
2. **Tag with skills** - Link bullets to skills for filtering and gap analysis
3. **Use framing consistently** - Choose the framing that best represents the bullet's angle
4. **Draft first, accept later** - New bullets start as draft for review

### Job Tracking
1. **Set interest_level** - Rate 1-5 to filter skill gap analysis
2. **Track sources** - Always create job_sources records for deduplication
3. **Log events** - Record application events for timing analysis
4. **Flag concerns** - Use job_flags and organization_flags for red flags
5. **Link contacts** - Associate contacts with jobs/applications for relationship tracking

---

## Integration with MCP Servers

### cv-forge
Export data to cv-forge JSON format for PDF generation. Map:
- `organizations` + `roles` (where worked=TRUE) → experience entries
- `bullets` via `resume_bullets` → role bullet points
- `education` → education entries
- `skills` → skills section

### linkedin-mcp
Can import LinkedIn profile data to cross-validate:
- Job history matches `organizations` + `roles`
- Skills match `skills` table
- Education matches `education` table

### jobspy
Search job listings and store results:
1. Search for jobs matching criteria
2. Insert into `jobs` table with `organization_id`
3. Link skills via `job_skills`
4. Track sources via `job_sources`
5. Use `skill_gaps` view to identify skills to develop
