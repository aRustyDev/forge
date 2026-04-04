# Forge MCP Server — Design Spec

**Date:** 2026-04-03
**Status:** Draft
**Package:** `@forge/mcp`
**Transport:** STDIO (v1), SSE/Streamable HTTP (future)
**Primary Consumer:** Claude Code → Claude Desktop → other MCP clients
**Interface Layer:** MCP Server → `@forge/sdk` → HTTP API → `@forge/core`

## Design Principles

1. **SDK delegation** — Every MCP tool delegates to `@forge/sdk`. No direct DB or service access.
2. **AI reasoning stays with client** — MCP returns structured data. The calling AI does the thinking.
3. **Programmatic alignment** — Embedding-based similarity for JD↔Resume matching. No LLM needed.
4. **Resources for context, tools for actions** — Static/slow-changing reference data as resources; parameterized queries and mutations as tools.

---

## MCP Resources

Resources provide ambient context that the AI client loads without explicit tool calls.

| URI Pattern | SDK Method | Returns | Update Frequency |
|---|---|---|---|
| `forge://profile` | `sdk.profile.get()` | UserProfile (name, contact, clearance) | Rarely changes |
| `forge://archetypes` | `sdk.archetypes.list()` | Archetype[] with domain associations | Config-level, rarely |
| `forge://domains` | `sdk.domains.list()` | Domain[] (skill domain taxonomy) | Config-level, rarely |
| `forge://templates` | `sdk.templates.list()` | ResumeTemplate[] (section structures) | Occasionally |
| `forge://resume/{id}` | `sdk.resumes.get(id)` | ResumeWithEntries (sections, entries, snapshots) | Per-session working state |
| `forge://resume/{id}/chain` | `sdk.resumes.ir(id)` | ResumeDocument IR (compiled view) | Changes as entries are added |
| `forge://job/{id}` | `sdk.jobDescriptions.get(id)` | JobDescriptionWithOrg (title, raw_text, status) | Set once, read many |

### Resource Subscriptions

The MCP server should support `resources/subscribe` for `forge://resume/{id}` so the client gets notified when resume state changes (entries added/removed/reordered).

---

## MCP Tools

### Tier 1: Core Resume Workflow

These tools support the primary flow: JD → find matches → build resume → check alignment → export.

#### `forge_search_sources`
Search experience sources by employer, type, date range, status.
```
Parameters:
  source_type?: 'role' | 'project' | 'education' | 'clearance' | 'general'
  status?: 'draft' | 'approved' | 'deriving'
  search?: string (full-text on title + description)
  limit?: number (default 20)
Returns: Source[] with extension data (role/project/education/clearance fields)
SDK: sdk.sources.list(filter)
```

#### `forge_search_bullets`
Search bullet inventory by domain, status, source, content.
```
Parameters:
  domain?: string
  status?: 'draft' | 'pending_review' | 'approved' | 'rejected'
  source_id?: string
  search?: string (full-text on content)
  limit?: number (default 20)
Returns: Bullet[] with source titles and technologies
SDK: sdk.bullets.list(filter)
```

#### `forge_search_perspectives`
Search perspectives by archetype, domain, framing, status.
```
Parameters:
  archetype?: string
  domain?: string
  framing?: 'accomplishment' | 'responsibility' | 'context'
  status?: 'approved' (typically only want approved for resume building)
  search?: string
  limit?: number (default 20)
Returns: Perspective[] with bullet and source chain
SDK: sdk.perspectives.list(filter)
```

#### `forge_derive_bullets`
Trigger AI bullet derivation from a source. Returns generated bullets in pending_review status.
```
Parameters:
  source_id: string (required)
Returns: Bullet[] (newly derived, status=pending_review)
SDK: sdk.sources.deriveBullets(source_id)
Note: This calls Forge's AI module (Claude CLI). The MCP CLIENT is not doing the reasoning here — Forge's derivation service handles it. This is acceptable because bullet derivation is a structured extraction task, not a reasoning task that benefits from conversation context.
```

#### `forge_derive_perspective`
Trigger AI perspective derivation from an approved bullet.
```
Parameters:
  bullet_id: string (required)
  archetype: string (required — target archetype slug)
  domain: string (required — target domain slug)
Returns: Perspective (newly derived, status=pending_review)
SDK: sdk.bullets.derivePerspectives(bullet_id, {archetype, domain})
Note: Same rationale as derive_bullets — structured reframing, not reasoning.
```

#### `forge_approve_bullet`
Approve a bullet (pending_review → approved).
```
Parameters:
  bullet_id: string (required)
Returns: Bullet (updated)
SDK: sdk.bullets.approve(bullet_id)
```

#### `forge_reject_bullet`
Reject a bullet with reason (pending_review → rejected).
```
Parameters:
  bullet_id: string (required)
  reason: string (required)
Returns: Bullet (updated)
SDK: sdk.bullets.reject(bullet_id, {reason})
```

#### `forge_approve_perspective`
Approve a perspective (pending_review → approved).
```
Parameters:
  perspective_id: string (required)
Returns: Perspective (updated)
SDK: sdk.perspectives.approve(perspective_id)
```

#### `forge_reject_perspective`
Reject a perspective with reason.
```
Parameters:
  perspective_id: string (required)
  reason: string (required)
Returns: Perspective (updated)
SDK: sdk.perspectives.reject(perspective_id, {reason})
```

#### `forge_create_resume`
Create a new resume, optionally from a template.
```
Parameters:
  name: string (required)
  target_role: string (required)
  target_employer: string (required)
  archetype: string (required — archetype slug)
  template_id?: string (creates with predefined sections)
Returns: Resume (or ResumeWithEntries if template used)
SDK: sdk.templates.createResumeFromTemplate() or sdk.resumes.create()
```

#### `forge_add_resume_entry`
Add an approved perspective to a resume section.
```
Parameters:
  resume_id: string (required)
  section_id: string (required)
  perspective_id: string (required)
  position?: number
Returns: ResumeEntry
SDK: sdk.resumes.addEntry(resume_id, {section_id, perspective_id, position})
```

#### `forge_create_resume_section`
Create a section in a resume (experience, skills, education, etc).
```
Parameters:
  resume_id: string (required)
  title: string (required — e.g., "Professional Experience", "Technical Skills")
  entry_type: 'experience' | 'skills' | 'education' | 'projects' | 'certifications' | 'clearance' | 'presentations' | 'awards' | 'custom'
  position?: number
Returns: ResumeSectionEntity
SDK: sdk.resumes.createSection(resume_id, {title, entry_type, position})
```

#### `forge_gap_analysis`
Get domain coverage gaps for a resume vs. its archetype's expected domains.
```
Parameters:
  resume_id: string (required)
Returns: GapAnalysis {covered_domains, missing_domains, thin_domains, entry_count_by_domain}
SDK: sdk.resumes.gaps(resume_id)
```

#### `forge_export_resume`
Export resume in specified format.
```
Parameters:
  resume_id: string (required)
  format: 'json' | 'markdown' | 'latex' | 'pdf'
Returns: ResumeDocument (json) | string (markdown/latex) | Blob (pdf)
SDK: sdk.export.resumeAsJson() or sdk.export.downloadResume()
```

#### `forge_align_resume` (NEW — requires embedding service)
Programmatic JD↔Resume alignment using embedding similarity.
```
Parameters:
  job_description_id: string (required)
  resume_id: string (required)
Returns: AlignmentReport {
  overall_score: number (0-1),
  requirement_matches: Array<{
    requirement: string,
    best_match: {entry_id, perspective_content, similarity: number} | null,
    verdict: 'strong' | 'adjacent' | 'gap',
  }>,
  unmatched_entries: Array<{entry_id, content}>,  // resume noise
  summary: {matched: number, adjacent: number, gaps: number, total: number}
}
SDK: sdk.alignment.score(jd_id, resume_id)  // NEW SDK method
```

---

### Tier 2: Data Management

Tools for populating and maintaining the data that feeds resume building.

#### `forge_create_source`
Create a new experience source.
```
Parameters:
  title: string (required)
  description: string (required)
  source_type: 'role' | 'project' | 'education' | 'clearance' | 'general' (required)
  start_date?: string
  end_date?: string
  notes?: string
  # Type-specific extension fields:
  organization_id?: string (for role/project/education)
  is_current?: boolean (for role)
  work_arrangement?: string (for role)
  education_type?: 'degree' | 'certificate' | 'course' | 'self_taught' (for education)
  degree_level?: string (for education)
  field?: string (for education)
  level?: string (for clearance)
  polygraph?: string (for clearance)
Returns: Source with extension data
SDK: sdk.sources.create(input)
```

#### `forge_create_organization`
Create an organization (employer, school, project org).
```
Parameters:
  name: string (required)
  org_type: 'employer' | 'school' | 'project_org' | 'certification_body' | 'other' (required)
  industry?: string
  website?: string
  location?: string
  status?: OrganizationStatus
  notes?: string
Returns: Organization
SDK: sdk.organizations.create(input)
```

#### `forge_ingest_job_description`
Create/store a job description.
```
Parameters:
  title: string (required)
  raw_text: string (required — full JD text)
  organization_id?: string
  url?: string
  status?: 'interested' | 'analyzing' | 'applied' | ... (default 'interested')
  salary_range?: string
  location?: string
  notes?: string
Returns: JobDescriptionWithOrg
SDK: sdk.jobDescriptions.create(input)
```

#### `forge_create_summary`
Create a resume summary.
```
Parameters:
  title: string (required)
  role?: string
  tagline?: string
  description?: string
  is_template?: boolean
Returns: Summary
SDK: sdk.summaries.create(input)
```

#### `forge_create_skill`
Create a skill entry.
```
Parameters:
  name: string (required)
  category?: string
Returns: Skill
SDK: sdk.skills.create(input)
```

#### `forge_update_resume_header`
Set resume header fields (headline, contact override).
```
Parameters:
  resume_id: string (required)
  header: {headline?, name?, email?, phone?, location?, linkedin?, github?, website?}
Returns: Resume
SDK: sdk.resumes.updateHeader(resume_id, header)
```

#### `forge_set_resume_summary`
Link a summary to a resume.
```
Parameters:
  resume_id: string (required)
  summary_id: string (required)
Returns: Resume
SDK: sdk.resumes.update(resume_id, {summary_id})
```

#### `forge_review_pending`
Get all bullets and perspectives awaiting review.
```
Parameters: none
Returns: ReviewQueue {bullets: Bullet[], perspectives: Perspective[]}
SDK: sdk.review.pending()
```

#### `forge_check_drift`
Detect stale content snapshots in the derivation chain.
```
Parameters: none
Returns: DriftedEntity[] {entity_type, entity_id, snapshot_value, current_value}
SDK: sdk.integrity.drift()
```

#### `forge_search_organizations`
Search organizations by name, type, status, tags.
```
Parameters:
  search?: string
  org_type?: string
  status?: OrganizationStatus
  limit?: number (default 20)
Returns: Organization[]
SDK: sdk.organizations.list(filter)
```

#### `forge_search_job_descriptions`
Search job descriptions by status, organization.
```
Parameters:
  status?: JobDescriptionStatus
  organization_id?: string
  search?: string
  limit?: number (default 20)
Returns: JobDescriptionWithOrg[]
SDK: sdk.jobDescriptions.list(filter)
```

#### `forge_search_summaries`
Search summaries.
```
Parameters:
  is_template?: boolean
  search?: string
  limit?: number (default 20)
Returns: Summary[]
SDK: sdk.summaries.list(filter)
```

---

### Tier 3: Refinement & Assembly

Tools for fine-tuning resume content and structure.

#### `forge_update_bullet`
Edit bullet content.
```
Parameters:
  bullet_id: string (required)
  content?: string
  metrics?: string
  domain?: string
  notes?: string
Returns: Bullet
SDK: sdk.bullets.update(bullet_id, input)
```

#### `forge_update_perspective`
Edit perspective content.
```
Parameters:
  perspective_id: string (required)
  content?: string
  domain?: string
  framing?: 'accomplishment' | 'responsibility' | 'context'
  notes?: string
Returns: Perspective
SDK: sdk.perspectives.update(perspective_id, input)
```

#### `forge_remove_resume_entry`
Remove an entry from a resume section.
```
Parameters:
  resume_id: string (required)
  entry_id: string (required)
Returns: void
SDK: sdk.resumes.removeEntry(resume_id, entry_id)
```

#### `forge_reorder_resume_entries`
Reorder entries within a resume.
```
Parameters:
  resume_id: string (required)
  entries: Array<{id: string, position: number}>
Returns: void
SDK: sdk.resumes.reorderEntries(resume_id, entries)
```

#### `forge_add_resume_skill`
Add a skill to a resume section.
```
Parameters:
  resume_id: string (required)
  section_id: string (required)
  skill_id: string (required)
Returns: ResumeSkill
SDK: sdk.resumes.addSkill(resume_id, section_id, skill_id)
```

#### `forge_remove_resume_skill`
Remove a skill from a resume section.
```
Parameters:
  resume_id: string (required)
  section_id: string (required)
  skill_id: string (required)
Returns: void
SDK: sdk.resumes.removeSkill(resume_id, section_id, skill_id)
```

#### `forge_reorder_resume_skills`
Reorder skills within a section.
```
Parameters:
  resume_id: string (required)
  section_id: string (required)
  skills: Array<{skill_id: string, position: number}>
Returns: void
SDK: sdk.resumes.reorderSkills(resume_id, section_id, skills)
```

#### `forge_trace_chain`
Get full provenance chain for a perspective (perspective → bullet → source).
```
Parameters:
  perspective_id: string (required)
Returns: PerspectiveWithChain {perspective, bullet, source}
SDK: sdk.perspectives.get(perspective_id)  // returns chain by default
```

#### `forge_save_as_template`
Save a resume's section structure as a reusable template.
```
Parameters:
  resume_id: string (required)
  name: string (required)
  description?: string
Returns: ResumeTemplate
SDK: sdk.resumes.saveAsTemplate(resume_id, {name, description})
```

#### `forge_update_job_description`
Update JD status or content.
```
Parameters:
  job_description_id: string (required)
  status?: JobDescriptionStatus
  raw_text?: string
  notes?: string
Returns: JobDescriptionWithOrg
SDK: sdk.jobDescriptions.update(id, input)
```

#### `forge_reopen_bullet`
Reopen a rejected bullet for re-review.
```
Parameters:
  bullet_id: string (required)
Returns: Bullet
SDK: sdk.bullets.reopen(bullet_id)
```

#### `forge_reopen_perspective`
Reopen a rejected perspective for re-review.
```
Parameters:
  perspective_id: string (required)
Returns: Perspective
SDK: sdk.perspectives.reopen(perspective_id)
```

#### `forge_clone_summary`
Duplicate a summary for variation.
```
Parameters:
  summary_id: string (required)
Returns: Summary (new copy)
SDK: sdk.summaries.clone(summary_id)
```

#### `forge_create_note`
Attach a note to any entity.
```
Parameters:
  title?: string
  content: string (required)
  references?: Array<{entity_type, entity_id}>
Returns: UserNote
SDK: sdk.notes.create(input) + sdk.notes.addReference() for each ref
```

#### `forge_update_source`
Update a source's content.
```
Parameters:
  source_id: string (required)
  title?: string
  description?: string
  notes?: string
  start_date?: string
  end_date?: string
Returns: Source
SDK: sdk.sources.update(id, input)
```

---

## Embedding Service Design (NEW — `@forge/core`)

### Overview

A new `EmbeddingService` in `@forge/core` that computes and stores vector embeddings for semantic similarity search and JD↔Resume alignment scoring.

### Model

`all-MiniLM-L6-v2` via `@xenova/transformers` (transformers.js)
- 384-dimensional vectors
- ~80MB model (downloaded once, cached locally)
- Runs entirely local in Bun/Node — no API calls
- ~50ms per embedding

### Schema Addition (migration 017)

```sql
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,  -- 'bullet', 'perspective', 'jd_requirement', 'source'
  entity_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,  -- SHA256 of embedded text (for staleness detection)
  vector BLOB NOT NULL,        -- Float32Array serialized as bytes (384 * 4 = 1536 bytes)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_embeddings_type ON embeddings(entity_type);
```

### Service API

```typescript
class EmbeddingService {
  // Embed and store a single entity
  embed(entityType: string, entityId: string, text: string): Promise<Result<void>>

  // Embed on write — called automatically by bullet/perspective/JD services
  onBulletCreated(bullet: Bullet): Promise<void>
  onPerspectiveCreated(perspective: Perspective): Promise<void>
  onJDCreated(jd: JobDescription, requirements: string[]): Promise<void>

  // Similarity search
  findSimilar(queryText: string, entityType: string, threshold?: number, limit?: number):
    Promise<Result<Array<{entity_id: string, similarity: number}>>>

  // JD ↔ Resume alignment (the main API)
  alignResume(jdId: string, resumeId: string):
    Promise<Result<AlignmentReport>>

  // JD ↔ Bullet/Perspective matching
  matchRequirements(jdId: string, entityType: 'bullet' | 'perspective', threshold?: number):
    Promise<Result<RequirementMatchReport>>

  // Staleness check (content changed since embedding)
  checkStale(): Promise<Result<StaleEmbedding[]>>

  // Re-embed stale entries
  refreshStale(): Promise<Result<number>>  // returns count refreshed
}
```

### AlignmentReport Type

```typescript
interface AlignmentReport {
  job_description_id: string
  resume_id: string
  overall_score: number  // 0.0 - 1.0 weighted average
  requirement_matches: RequirementMatch[]
  unmatched_entries: UnmatchedEntry[]  // resume entries with no requirement match (noise)
  summary: {
    strong: number    // similarity > 0.75
    adjacent: number  // 0.50 - 0.75
    gaps: number      // < 0.50 or no match
    total_requirements: number
    total_entries: number
  }
}

interface RequirementMatch {
  requirement_text: string
  requirement_index: number
  best_match: {
    entry_id: string
    perspective_id: string
    perspective_content: string
    similarity: number
  } | null
  verdict: 'strong' | 'adjacent' | 'gap'
}

interface UnmatchedEntry {
  entry_id: string
  perspective_content: string
  best_requirement_similarity: number  // highest similarity to any requirement
}
```

### Integration Points

- `BulletService.createBullet()` → calls `embeddingService.onBulletCreated()`
- `PerspectiveService.createPerspective()` → calls `embeddingService.onPerspectiveCreated()`
- `JobDescriptionService.create()` → calls `embeddingService.onJDCreated()`
- `EmbeddingService.alignResume()` → called by MCP tool `forge_align_resume`
- `IntegrityService.getDriftedEntities()` → extended to include stale embeddings

### JD Requirement Parsing

For `onJDCreated`, the service needs to split raw JD text into individual requirements. For v1:

```typescript
function parseRequirements(rawText: string): string[] {
  // Split on bullet points, numbered lists, or line breaks in requirements/qualifications sections
  // Return individual requirement strings
  // Confidence score per requirement (is this actually a requirement or just prose?)
}
```

This is the component that gets the confidence-gated LLM fallback later:
- High confidence (structured list, clear bullet points) → parse programmatically
- Low confidence (prose paragraphs, ambiguous) → flag for LLM or manual review

---

## JD Ingestion Pipeline Design

### v1: Structured Text Input

```
User provides raw JD text
  → forge_ingest_job_description(title, raw_text, org_id?, url?)
  → JD stored in job_descriptions table
  → Programmatic requirement parser extracts requirement strings
  → Each requirement embedded and stored in embeddings table
  → Ready for alignment scoring
```

### v2 (future): Crawl + Extract

```
User provides URL
  → Template-based scraper (Greenhouse, Lever, LinkedIn, Workday templates)
  → Extracts: title, description, requirements, qualifications, salary, location
  → Confidence score on extraction quality
  → If confidence < threshold → flag for LLM extraction or manual review
  → Same downstream pipeline as v1
```

### Scraper Templates (future)

```typescript
interface ScraperTemplate {
  name: string           // 'greenhouse', 'lever', 'linkedin', etc.
  urlPattern: RegExp     // Match URL to template
  selectors: {
    title: string        // CSS/XPath selector
    description: string
    requirements: string
    qualifications: string
    salary?: string
    location?: string
  }
  parser: (html: string) => ParsedJD
}
```

---

## Tool Count Summary

| Tier | Count | Purpose |
|---|---|---|
| Tier 1: Core Workflow | 15 | Search, derive, approve, assemble, align, export |
| Tier 2: Data Management | 13 | Create entities, review queue, drift check |
| Tier 3: Refinement | 14 | Update, reorder, trace, clone, notes |
| **Total** | **42** | |
| Resources | **7** | Ambient context |

---

## Implementation Notes

### STDIO Transport

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ForgeClient } from '@forge/sdk'

const sdk = new ForgeClient({ baseUrl: 'http://localhost:3000' })
const server = new McpServer({ name: 'forge', version: '1.0.0' })

// Register tools
server.tool('forge_search_sources', schema, async (params) => {
  const result = await sdk.sources.list(params)
  return { content: [{ type: 'text', text: JSON.stringify(result) }] }
})

// Register resources
server.resource('forge://profile', async () => {
  const result = await sdk.profile.get()
  return { contents: [{ uri: 'forge://profile', text: JSON.stringify(result.data) }] }
})

const transport = new StdioServerTransport()
await server.connect(transport)
```

### Prerequisite

The Forge HTTP server (`@forge/core`) must be running for the MCP server to function, since the MCP server delegates through the SDK which calls the HTTP API.

### Error Handling

All SDK methods return `Result<T>`. The MCP server maps errors:
- `NOT_FOUND` → tool returns error with descriptive message
- `VALIDATION_ERROR` → tool returns error with field-level details
- `CONFLICT` → tool returns error explaining the constraint
- `AI_ERROR` / `GATEWAY_TIMEOUT` → tool returns error suggesting retry
