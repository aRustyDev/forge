# Computed Graphs & Persistent Aggregates

> Status: Design

## Alignment Graph (computed, optionally stored for SaaS)

### Purpose

Resume ↔ JD matching via skill overlap. Forms when you connect JD requirements to resume skills via the Skill Graph. Computed on demand, but results are stored for SaaS users to enable tracking over time.

### Storage

- **OSS:** Computed results stored in browser wa-sqlite (persisted across sessions, lost on browser data clear)
- **SaaS:** Synced to D1 for multi-device access and historical tracking

```sql
alignment_results (
  id TEXT PRIMARY KEY,
  resume_id TEXT,
  jd_id TEXT,
  computed_at TIMESTAMP,
  overall_score REAL,
  gap_report JSON,
  strength_report JSON,
  coverage_report JSON
)

career_target_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_at TIMESTAMP,
  target_archetype_id TEXT,
  interest_weights JSON,
  prioritized_gaps JSON,
  skill_demand_context JSON  -- market stats at time of snapshot
)
```

Storing alignment results enables: "My resume matched this JD at 0.72 in January, 0.85 after I added K8s experience."
Storing career target snapshots enables: interest epistemology — "My targets shifted from DevOps → Security → ML Research."

### Structure

```
JD Required Skills              Resume Skills
[Kubernetes, expert]   ─match─→  [Kubernetes, 5yr]  ←── Bullet ←── Source/Role
[AWS, 5yr]            ─match─→  [AWS, 7yr]          ←── Bullet ←── Source/Role
[Python, 3yr]         ─gap───→  (no match)
[Terraform, any]      ─match─→  [Terraform, 2yr]    ←── Bullet ←── Source/Role
```

### Feedback Loop

Alignment results feed BACK into the persistent Skill Graph:
- Co-occurrence observations (which skills appear in the same JD?)
- Relationship reinforcement (sibling match confirms related-to edge)
- Confidence updates (frequently-matched skills gain confidence)

See [retrieval/alignment-scoring.md](../retrieval/alignment-scoring.md) for the scoring algorithm.

---

## Job Market Epistemology (persistent global aggregate)

### Purpose

Track how skill demand evolves over time. This is PERSISTENT and GLOBAL — not ephemeral or per-user. Published as part of the global skill graph snapshot on CDN.

### Computation Model

Two data sources feed market stats:

**Server-side (baseline):** Server scrapes job boards (JobSpy, public feeds), runs extraction, aggregates stats. This provides a consistent baseline independent of user contributions.

**Federated (user contributions, optional):** Browser extraction produces anonymized skill tuples `{skill_ids, industry_id, archetype_id, dedup_key}` during JD ingestion. On sync, these POST to server. Server deduplicates via `dedup_key = hash(normalize(org_name) + normalize(role_title) + posting_quarter)` and aggregates.

Server combines both sources into `skill_demand_stats`, published in the next global snapshot.

### Data Model

```sql
skill_demand_stats:
  skill_id        FK → skill_graph_nodes
  time_window     TEXT ("2026-Q1")
  industry_id     FK (nullable — for cross-industry breakdown)
  archetype_id    FK (nullable — for cross-archetype breakdown)
  jd_count        INT (JDs mentioning this skill in this window)
  co_occurrence   JSON ({skill_id: count})
  avg_level_req   FLOAT (normalized from level signals)
  source_jd_count INT (total JDs processed in this window)
```

### How It Works

When a JD is ingested and skills are extracted:
1. Determine time window (quarterly)
2. For each extracted skill: increment `jd_count` for the window
3. For each skill pair: increment co-occurrence counts
4. Record level signal if present
5. Increment `source_jd_count`

The JD text can be retained or deleted — the statistical signal persists independently.

### Query Examples

- "Terraform demand trend over last 4 quarters" → `jd_count / source_jd_count` per window
- "What skills are rising in cybersecurity JDs?" → filter by industry, sort by growth rate
- "Pulumi vs Terraform in DevOps JDs" → compare `jd_count` trends for both
- "What's the average experience level required for Kubernetes?" → `avg_level_req` trend

### Scale Requirements

- Meaningful signals at 500+ JDs
- Degrades gracefully below that (fewer windows, wider confidence intervals)
- At high volume (10k+ JDs): per-industry and per-archetype breakdowns become reliable

### Connection to Career Target Graph

Job market stats inform Career Target prioritization:
- "Python demand is rising in your target archetype" → increase priority
- "Terraform demand declining in this industry" → decrease priority
- Market-aware weighting layer on top of interest weighting
