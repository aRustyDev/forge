<!-- migrated from: docs/superpowers/plans/2026-03-24-skills-gap-tracker.md -->
# Skills Gap Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a skills inventory and per-job gap analysis system that enables quick JD-to-skills comparison and surfaces the most impactful gaps to close.

**Architecture:** Two-layer markdown system. A single `skills-inventory.md` file (8 domain tables with tier/years/demand columns) and per-job `*-gaps.md` files in `analysis/` (three-bucket match/adjacent/gap assessments). No code — pure structured markdown.

**Tech Stack:** Markdown, manual maintenance

**Spec:** `docs/superpowers/specs/2026-03-24-skills-gap-tracker-design.md`

---

### Task 1: Create Skills Inventory — Structure and Resume-based Seed

**Files:**
- Create: `skills-inventory.md` (project root: `/Users/adam/notes/zettelkasten/proj/job-hunting/skills-inventory.md`)

**Source data for seeding:**
- Anthropic resume: `/Users/adam/notes/zettelkasten/proj/job-hunting/applications/anthropic/cybersec-rl/resume.md`
- TRM Labs resume: `/Users/adam/notes/zettelkasten/proj/job-hunting/applications/trm-labs/applied-ai-eng/resume.md`
- Check for any additional resume versions in `/Users/adam/notes/zettelkasten/proj/job-hunting/applications/*/` directories
- Certifications: extract from Education & Certifications sections of both resumes (GIAC, AWS, CompTIA, ISC2, HuggingFace courses)

- [ ] **Step 1: Read both resumes and extract all skills**

Scan Technical Skills sections, experience bullet keywords, certifications, and project descriptions from both resumes. Build a deduplicated master list.

- [ ] **Step 2: Assign tiers and years to each skill**

For each skill, determine:
- `tier`: based on how it appears in resume (core job duty = production, mentioned in passing = practiced, certs/courses only = learning, not present = none)
- `years`: estimate from role dates where the skill was used

- [ ] **Step 3: Write `skills-inventory.md` with all 8 domain group tables**

Create the file with the following structure per the spec:
- Header with tier definitions
- 8 domain tables: AI/ML, Security, Languages, Infrastructure, Data Systems, Platforms & Cloud, Research & Methodology, Soft Skills & Context
- Each row: Skill | Tier | Years | Demand (set demand to 0 for now — Task 2 will back-fill)

Use canonical JD naming per the spec (e.g., "Go" not "golang", "Kubernetes" not "K8s").

- [ ] **Step 4: Verify completeness**

Cross-check the inventory against both resume Technical Skills sections. Confirm no skill from either resume is missing. Add any skills that appear in experience bullets but not in Technical Skills sections (e.g., "Packer", "Linkerd").

---

### Task 2: Back-fill Demand Counts from Existing JDs

**Files:**
- Modify: `skills-inventory.md`

**Source data:**
- All 7 JD files in `/Users/adam/notes/zettelkasten/proj/job-hunting/jobs/`:
  - `1482e677-...md` — Anthropic: Research Engineer, Cybersecurity RL
  - `20d23fb1-...md` — Anthropic: Sr/Staff SWE, Autonomous Agent Infrastructure
  - `7e00be96-...md` — TRM Labs: Applied AI Engineer
  - `b5c15828-...md` — Anthropic: SWE Public Sector
  - `cbd35b26-...md` — Anthropic: Solutions Architect, Applied AI
  - `cc4acb0a-...md` — CyberCoders: AI Systems Engineer
  - `e587b1db-...md` — Anthropic: Infrastructure Engineer, Sandboxing

- [ ] **Step 1: Read each JD and extract required/preferred skills**

For each of the 7 JDs, list all skills mentioned as required or preferred. Map each to its canonical inventory name.

- [ ] **Step 2: Add any new skills discovered in JDs but missing from inventory**

If a JD requests a skill not yet in the inventory (e.g., HPC, InfiniBand, TensorRT, Blockchain), add it with the appropriate tier (likely `none` or `learning`) and years.

- [ ] **Step 3: Tally demand counts**

For each skill in the inventory, count how many of the 7 JDs request it. Update the Demand column accordingly.

- [ ] **Step 4: Verify demand totals**

Spot-check: Python should appear in most/all JDs (demand ~7). HPC should appear in ~1. Kubernetes should appear in several. Fix any miscounts.

---

### Task 3: Generate Gap Analysis — Anthropic Cybersec RL

**Files:**
- Create: `/Users/adam/notes/zettelkasten/proj/job-hunting/analysis/anthropic-cybersec-rl-gaps.md`
- Modify: `skills-inventory.md` (only if new skills discovered)

**Source data:**
- JD: `/Users/adam/notes/zettelkasten/proj/job-hunting/jobs/1482e677-12de-4f97-9938-8f178f0095b4.md`
- Inventory: `skills-inventory.md`
- Existing analysis for reference: `/Users/adam/notes/zettelkasten/proj/job-hunting/analysis/anthropic-cybersec-rl-skills-map.md`

- [ ] **Step 1: Read JD and extract all required/preferred skills**

- [ ] **Step 2: Look up each skill in inventory, classify as Match / Adjacent / Gap**

Apply bucket definitions from spec:
- Match: inventory tier meets or exceeds JD requirement
- Adjacent: related experience, frameable but not direct
- Gap: inventory tier clearly below JD requirement

- [ ] **Step 3: Assign effort tags to Adjacent and Gap skills**

Use: `quick-win` / `medium` / `deep`

- [ ] **Step 4: Write bridge notes for all Adjacent skills**

Explain how existing experience can be framed toward the requirement.

- [ ] **Step 5: Write gap file using spec template**

Include: Job ID, date, overall fit score, three tables, notes section. Note: the Gap table must include a Demand column (current count from inventory). The Adjacent table does not have a Demand column but does have an Effort column and a Bridge column.

- [ ] **Step 6: Update inventory demand counts and add new skills**

For every skill in this JD (Match, Adjacent, and Gap alike), confirm its demand count in the inventory has been incremented by 1 for this JD. Add any new skills with demand = 1.

---

### Task 4: Generate Gap Analysis — TRM Labs Applied AI Engineer

**Files:**
- Create: `/Users/adam/notes/zettelkasten/proj/job-hunting/analysis/trm-labs-applied-ai-eng-gaps.md`
- Modify: `skills-inventory.md` (only if new skills discovered)

**Source data:**
- JD: `/Users/adam/notes/zettelkasten/proj/job-hunting/jobs/7e00be96-fd36-4a55-9ff6-c3d876c5fd4e.md`
- Inventory: `skills-inventory.md`

- [ ] **Step 1: Read JD and extract all required/preferred skills**
- [ ] **Step 2: Look up each skill in inventory, classify as Match / Adjacent / Gap**
- [ ] **Step 3: Assign effort tags to Adjacent and Gap skills**
- [ ] **Step 4: Write bridge notes for all Adjacent skills** — required for every Adjacent skill; explain how existing experience frames toward the requirement
- [ ] **Step 5: Write gap file using spec template** — Gap table must include Demand column; Adjacent table has Effort + Bridge columns but no Demand column
- [ ] **Step 6: Update inventory demand counts and add new skills** — for every skill in this JD (Match, Adjacent, and Gap alike), increment demand by 1. Add any new skills with demand = 1.

---

### Task 5: Generate Gap Analysis — CyberCoders AI Systems Engineer

**Files:**
- Create: `/Users/adam/notes/zettelkasten/proj/job-hunting/analysis/cybercoders-ai-systems-eng-gaps.md`
- Modify: `skills-inventory.md` (only if new skills discovered)

**Source data:**
- JD: `/Users/adam/notes/zettelkasten/proj/job-hunting/jobs/cc4acb0a-58c9-4660-964d-b21bdd6bd463.md`
- Inventory: `skills-inventory.md`

- [ ] **Step 1: Read JD and extract all required/preferred skills**
- [ ] **Step 2: Look up each skill in inventory, classify as Match / Adjacent / Gap**
- [ ] **Step 3: Assign effort tags to Adjacent and Gap skills**
- [ ] **Step 4: Write bridge notes for all Adjacent skills** — required for every Adjacent skill; explain how existing experience frames toward the requirement
- [ ] **Step 5: Write gap file using spec template** — Gap table must include Demand column; Adjacent table has Effort + Bridge columns but no Demand column
- [ ] **Step 6: Update inventory demand counts and add new skills** — for every skill in this JD (Match, Adjacent, and Gap alike), increment demand by 1. Add any new skills with demand = 1.

---

### Task 6: Generate Gap Analyses — Remaining 4 Anthropic Roles

**Files:**
- Create: `/Users/adam/notes/zettelkasten/proj/job-hunting/analysis/anthropic-agent-infra-gaps.md`
- Create: `/Users/adam/notes/zettelkasten/proj/job-hunting/analysis/anthropic-swe-public-sector-gaps.md`
- Create: `/Users/adam/notes/zettelkasten/proj/job-hunting/analysis/anthropic-solutions-architect-gaps.md`
- Create: `/Users/adam/notes/zettelkasten/proj/job-hunting/analysis/anthropic-infra-sandboxing-gaps.md`
- Modify: `skills-inventory.md` (only if new skills discovered)

**Source data:**
- JDs:
  - `20d23fb1-...md` — Sr/Staff SWE, Autonomous Agent Infrastructure
  - `b5c15828-...md` — SWE Public Sector
  - `cbd35b26-...md` — Solutions Architect, Applied AI
  - `e587b1db-...md` — Infrastructure Engineer, Sandboxing
- Inventory: `skills-inventory.md`

- [ ] **Step 1: For each JD, read and extract all required/preferred skills**
- [ ] **Step 2: For each JD, classify skills as Match / Adjacent / Gap**
- [ ] **Step 3: For each JD, assign effort tags to Adjacent and Gap skills, and write bridge notes for every Adjacent skill** — bridge notes are required, not optional; explain how existing experience frames toward each requirement
- [ ] **Step 4: Write all 4 gap files using spec template** — Gap table must include Demand column; Adjacent table has Effort + Bridge columns but no Demand column
- [ ] **Step 5: Update inventory demand counts and add new skills** — for every skill in each JD (Match, Adjacent, and Gap alike), increment demand by 1. Add any new skills with demand = 1.

---

### Task 7: Validate Inventory Demand Counts and Final Review

**Files:**
- Modify: `skills-inventory.md` (corrections only)

- [ ] **Step 1: Cross-check demand counts**

For each skill with demand > 0, verify the count matches the number of gap files that reference it. Fix any discrepancies.

- [ ] **Step 2: Run "What should I learn next?" query**

Sort inventory by demand descending, filter to `none` or `learning` tier. Output the top 10 highest-demand gaps. Verify the results make intuitive sense given the 7 JDs analyzed.

- [ ] **Step 3: Run "What am I strongest in?" query**

Sort inventory by tier descending, then years descending. Output the top 10. Verify these match the user's actual strongest areas.

- [ ] **Step 4: Run "Can I apply for this?" query**

Pick one gap file. Apply the spec's apply-signal criteria: majority of required skills in Match, no `deep` effort gaps or adjacents in required skills = strong signal. Most required in Adjacent with `quick-win`/`medium` effort = weaker signal. Any required with `deep` gap or adjacent = red flag. Verify the gap file structure supports answering this question clearly.

- [ ] **Step 5: Spot-check one gap file against its JD**

Pick any gap file, re-read its source JD, and verify every required/preferred skill from the JD appears in one of the three buckets. Confirm no skill was missed.
