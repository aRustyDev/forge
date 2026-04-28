# Skills Gap Tracker — Design Spec

## Problem

Gap data is scattered across files (`critical-gaps.md`, `insights.md`, per-role `*-skills-map.md`), employer-specific, and not queryable. Each new JD analysis starts from scratch rather than comparing against a known skills baseline. There is no way to answer "which gaps appear most often across jobs I care about?" without manually scanning multiple files.

## Solution

A two-layer system: a single skills inventory (source of truth for "what I know") and per-job gap analysis files (source of truth for "how I match job X").

## Layer 1: Skills Inventory

**File:** `/Users/adam/notes/zettelkasten/proj/job-hunting/skills-inventory.md`

### Structure

One table per domain group. Each skill has four columns:

| Column | Type | Description |
|--------|------|-------------|
| Skill | string | Name as JDs typically reference it |
| Tier | enum | `none` / `learning` / `practiced` / `production` |
| Years | number | Approximate years of experience |
| Demand | number | Count of analyzed JDs requesting this skill |

### Tier Definitions

- **none** — no experience, haven't touched it
- **learning** — coursework, certs, tutorials, or side projects only
- **practiced** — used professionally but not a core responsibility
- **production** — core part of my job, shipped/operated in production

### Domain Groups

1. **AI/ML** — PyTorch, TensorFlow, MLOps, LLM Agents, RAG, Prompt Engineering, MCP, RL, Model Evaluation, Fine-tuning, Context Engineering, Agent Architectures, Graph-based Memory Systems
2. **Security** — DFIR, Threat Hunting, Malware Analysis, Red Team, SIEM (Splunk, Elastic), Cloud Security, MITRE ATT&CK, Incident Response, Vulnerability Research
3. **Languages** — Python, Rust, Go, TypeScript, SQL, Bash, PowerShell
4. **Infrastructure** — Kubernetes, Helm, Docker, Terraform, Terragrunt, Ansible, CI/CD, Air-gapped Deployments, HPC, GPU Clusters, InfiniBand/RoCEv2
5. **Data Systems** — Graph Databases, Streaming Platforms, SQL Databases, CockroachDB, PostgreSQL
6. **Platforms & Cloud** — AWS, GCP, Azure, SageMaker, Vertex AI, Run.AI
7. **Research & Methodology** — Experiment Design, Hypothesis-driven Development, Technical Writing/Reports, Literature Review, Dataset Collection, Dataset Discovery, Dataset Refinement/Cleaning, Exploratory Data Analysis, Data Pipeline Design
8. **Soft Skills & Context** — Stakeholder communication, cleared environments, customer-facing delivery, mentoring, delivering in regulated/bureaucratic environments

### Skill Naming

Always use the most common JD phrasing as the canonical name (e.g., "Go" not "golang", "Kubernetes" not "K8s"). When a JD uses a variant, map it to the existing canonical name rather than creating a new row.

### Seeding

Initial population pulls from: current resume (all versions), certifications, and all previously analyzed JDs. Back-fill demand counts from all previously analyzed JDs during the initial seed so the inventory is immediately queryable. After seeding, the inventory is maintained through the per-job analysis workflow.

## Layer 2: Per-Job Gap Analysis Files

**Location:** `/Users/adam/notes/zettelkasten/proj/job-hunting/analysis/<employer>-<role-slug>-gaps.md`

**Naming examples:**
- `trm-labs-applied-ai-eng-gaps.md`
- `cybercoders-ai-systems-eng-gaps.md`
- `anthropic-cybersec-rl-gaps.md`

### Structure

The `Inventory Tier` column uses the format `tier / Ny` (e.g., `production / 5y`) combining the tier and years from the inventory.

```markdown
# Gap Analysis: <Role Title> — <Employer>

**Job ID:** <uuid from jobs/ directory, or N/A if not yet entered>
**Date:** <YYYY-MM-DD>
**Overall Fit:** <X/10>

## Match

| Skill | Inventory Tier | JD Requirement Level |
|-------|---------------|---------------------|
| ... | production / 5y | Required/Preferred |

## Adjacent

| Skill | Inventory Tier | JD Asks For | Effort | Bridge |
|-------|---------------|-------------|--------|--------|
| ... | practiced / 2y | What JD wants | quick-win/medium/deep | How to frame existing experience |

## Gap

| Skill | Inventory Tier | JD Asks For | Effort | Demand |
|-------|---------------|-------------|--------|--------|
| ... | none / 0y | Required/Preferred | quick-win/medium/deep | N |

## Notes

Free-form observations about fit, positioning strategy, or red flags.
```

### Effort Tags

- **quick-win** — a weekend project, online cert, or tutorial away
- **medium** — a few weeks of focused study or a substantial side project
- **deep** — months of real production experience needed; cannot be shortcut

### Bucket Definitions

- **Match** — inventory tier meets or exceeds what the JD asks for
- **Adjacent** — you have related experience that can be framed toward the requirement, but it's not a direct match
- **Gap** — inventory tier is clearly below what the JD requires

## Update Flow

### New JD Analysis

1. Read the JD, extract all required and preferred skills
2. Look up each skill in the inventory — classify as match, adjacent, or gap
3. Add any skills not yet in the inventory (new rows, current tier, demand = 0)
4. Write the gap analysis file (three buckets + effort tags + bridge notes)
5. Increment demand count in the inventory for every skill in this JD (match, adjacent, and gap alike)

### Learning Something New

When a course, cert, project, or new role changes your proficiency:
- Update the relevant skill's tier and/or years in the inventory
- No retroactive updates to old gap files — they are point-in-time snapshots

### Querying

- **"What should I learn next?"** — Sort inventory by demand descending, filter to `none` or `learning` tier. Highest demand gaps are the priority.
- **"Can I apply for this?"** — Generate gap file. Strong signal to apply: majority of required skills are in Match, no `deep` effort gaps or adjacents in required skills. Weaker signal: most required skills are Adjacent with `quick-win` or `medium` effort and plausible bridges. Red flag: any required skill has a `deep` gap or a `deep` adjacent.
- **"What am I strongest in?"** — Sort inventory by tier descending, then years descending. This is the positioning core.

## Migration

### Replaced

- `critical-gaps.md` (`/Users/adam/notes/job-hunting/notes/critical-gaps.md`) — replaced by the inventory's demand-sorted gap view. Stop updating; leave in place as archive.

### Archived

- Existing `*-skills-map.md` files in `analysis/` — superseded by gap files. Old files remain as historical reference.

### Unchanged

- `insights.md` — addresses resume positioning, a different concern from skills tracking
- Existing per-job analysis files (`*-resume-review.rN.md`, `*-candidate-spec.md`, etc.) — complementary, not overlapping
- Job metadata files in `jobs/` — unchanged, gap files reference them by UUID
