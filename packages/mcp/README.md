# @forge/mcp -- Forge MCP Server

Machine-to-machine interface between AI clients (Claude Desktop, Claude Code, Cursor, Windsurf) and the Forge resume builder.

## Overview

The Forge MCP server exposes the full Forge resume-building workflow as MCP tools and resources. It wraps the `@forge/sdk` client library, translating between MCP protocol messages and SDK method calls. The server communicates over STDIO transport and requires a running Forge HTTP server (`@forge/core`).

## Prerequisites

- **Forge HTTP server** running (`bun run packages/core/src/index.ts` or `just api`)
- **Bun runtime** (v1.0+)
- **`@forge/sdk`** workspace dependency (already configured in the monorepo)

## Installation

```bash
# From the monorepo root
bun install
```

## Configuration

### Claude Code

```bash
claude mcp add forge -- bun run --cwd /path/to/forge/packages/mcp src/index.ts
```

Or add to `.claude/settings.json` at project root:

```json
{
  "mcpServers": {
    "forge": {
      "command": "bun",
      "args": ["run", "packages/mcp/src/index.ts"],
      "env": {
        "FORGE_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "forge": {
      "command": "bun",
      "args": ["run", "--cwd", "/absolute/path/to/forge/packages/mcp", "src/index.ts"],
      "env": {
        "FORGE_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FORGE_API_URL` | `http://localhost:3000` | Forge HTTP API base URL |
| `FORGE_MCP_DEBUG` | (unset) | Set to any value to enable verbose success logging to stderr |

## Transport

**STDIO only** (current). The server communicates over stdin/stdout using the MCP protocol. SSE and Streamable HTTP transports are planned for future phases.

## Tool Reference (57 tools)

### Tier 0: Diagnostics (1 tool)

| Tool | Description |
|------|-------------|
| `forge_health` | Check connectivity to Forge server |

### Tier 1: Core Workflow (20 tools)

| Tool | Description |
|------|-------------|
| `forge_search_sources` | Search experience sources by type, status, text |
| `forge_search_bullets` | Search bullets by domain, status, source, text |
| `forge_search_perspectives` | Search perspectives by archetype, domain, framing, status |
| `forge_get_source` | Get a single source by ID |
| `forge_get_bullet` | Get a single bullet by ID |
| `forge_get_perspective` | Get a perspective with full provenance chain |
| `forge_list_resumes` | List all resumes with pagination |
| `forge_derive_bullets` | AI-derive bullets from a source |
| `forge_derive_perspective` | AI-derive perspectives from a bullet |
| `forge_approve_bullet` | Approve a bullet (pending_review -> approved) |
| `forge_reject_bullet` | Reject a bullet (pending_review -> rejected) |
| `forge_approve_perspective` | Approve a perspective |
| `forge_reject_perspective` | Reject a perspective |
| `forge_create_resume` | Create a resume, optionally from template |
| `forge_add_resume_entry` | Add an approved perspective to a resume section |
| `forge_create_resume_section` | Create a section in a resume |
| `forge_gap_analysis` | Analyze domain coverage gaps in a resume |
| `forge_align_resume` | Score resume alignment against a job description |
| `forge_match_requirements` | Find matching perspectives for a JD |
| `forge_export_resume` | Export resume as JSON, markdown, or HTML |

### Tier 2: Data Management (18 tools)

| Tool | Description | Feature Flag |
|------|-------------|--------------|
| `forge_create_source` | Create experience source (polymorphic: role/project/education/clearance/general) | -- |
| `forge_create_organization` | Create an organization | -- |
| `forge_create_summary` | Create a resume summary paragraph | -- |
| `forge_create_skill` | Create a skill entry | -- |
| `forge_update_resume_header` | Set resume header fields (headline, contact override) | -- |
| `forge_set_resume_summary` | Link a summary to a resume | -- |
| `forge_update_profile` | Update user profile (singleton) | -- |
| `forge_ingest_job_description` | Store a job description with embedding status | -- |
| `forge_extract_jd_skills` | AI skill extraction from a JD | Phase 62 |
| `forge_tag_jd_skill` | Associate a skill with a JD | Phase 62 |
| `forge_untag_jd_skill` | Remove skill association from a JD | Phase 62 |
| `forge_link_resume_to_jd` | Link a resume to a job description | Phase 60 |
| `forge_unlink_resume_from_jd` | Remove resume-JD link | Phase 60 |
| `forge_review_pending` | Get items awaiting human review | sdk.review |
| `forge_check_drift` | Detect stale content and embeddings | sdk.integrity |
| `forge_search_organizations` | Search organizations by name, type, status, tag | -- |
| `forge_search_job_descriptions` | Search JDs by status, organization, text | -- |
| `forge_search_summaries` | Search summaries by template flag or text | -- |

### Tier 3: Refinement (18 tools)

| Tool | Description | Feature Flag |
|------|-------------|--------------|
| `forge_update_bullet` | Edit bullet content, metrics, domain, notes | -- |
| `forge_update_perspective` | Edit perspective content, domain, framing, notes | -- |
| `forge_update_resume_entry` | Edit resume entry (copy-on-write, null resets) | -- |
| `forge_update_source` | Update source content or metadata | -- |
| `forge_update_summary` | Edit summary content or metadata | -- |
| `forge_remove_resume_entry` | Remove entry from resume (perspective preserved) | -- |
| `forge_reorder_resume_entries` | Reorder entries by position | sdk.resumes.reorderEntries |
| `forge_add_resume_skill` | Add skill to resume section | -- |
| `forge_remove_resume_skill` | Remove skill from resume section | -- |
| `forge_reorder_resume_skills` | Reorder skills by position | -- |
| `forge_reopen_bullet` | Reopen rejected bullet for re-review | -- |
| `forge_reopen_perspective` | Reopen rejected perspective for re-review | -- |
| `forge_clone_summary` | Duplicate a summary for variations | -- |
| `forge_trace_chain` | Get full provenance chain (perspective -> bullet -> source) | -- |
| `forge_save_as_template` | Save resume structure as reusable template | -- |
| `forge_update_job_description` | Update JD status, text, or notes | -- |
| `forge_create_note` | Create note with entity references (non-atomic) | sdk.notes |
| `forge_search_notes` | Search notes by content or title | sdk.notes |

## Resources (7)

| URI | Description |
|-----|-------------|
| `forge://profile` | User profile |
| `forge://archetypes` | Career archetypes |
| `forge://domains` | Skill domain taxonomy |
| `forge://templates` | Resume templates |
| `forge://resume/{id}` | Resume with sections and entries |
| `forge://resume/{id}/ir` | Resume intermediate representation |
| `forge://job/{id}` | Job description |

## Feature Flags

Some tools depend on SDK methods that may not yet be implemented. The server detects available methods at startup and only registers tools whose dependencies are satisfied.

| Feature | Tools Affected | Dependency |
|---------|---------------|------------|
| Phase 60: JD-Resume Linkage | `forge_link_resume_to_jd`, `forge_unlink_resume_from_jd` | `sdk.jobDescriptions.linkResume`, `unlinkResume` |
| Phase 62: JD Skill Extraction | `forge_extract_jd_skills`, `forge_tag_jd_skill`, `forge_untag_jd_skill` | `sdk.jobDescriptions.extractSkills`, `addSkill`, `removeSkill` |
| Reorder Entries | `forge_reorder_resume_entries` | `sdk.resumes.reorderEntries` (not yet in SDK) |
| Review Queue | `forge_review_pending` | `sdk.review.pending` |
| Integrity Check | `forge_check_drift` | `sdk.integrity.drift` |
| Notes | `forge_create_note`, `forge_search_notes` | `sdk.notes.create`, `list`, `addReference` |

At startup, the server logs which tools are feature-flagged off:

```
[forge:mcp] Feature-flagged tools (not registered):
  - forge_link_resume_to_jd, forge_unlink_resume_from_jd (Phase 60)
  - forge_extract_jd_skills, forge_tag_jd_skill, forge_untag_jd_skill (Phase 62)
  - forge_reorder_resume_entries (SDK missing reorderEntries -- feature-flagged off)
```

When all dependencies are satisfied:

```
[forge:mcp] All 57 tools registered (no feature flags active)
```

## Known Deviations

### Non-atomic note creation

`forge_create_note` creates the note first, then attaches entity references in a loop via `sdk.notes.addReference()`. If a reference attachment fails, the note still exists and the response includes a `_warnings` array. This is a known deviation from the spec, which implies atomic creation. The SDK does not currently support `references[]` in `CreateNote`.

### Copy-on-write resume entries

`forge_update_resume_entry` supports setting `content` to `null` to reset a copy-on-write override back to the original perspective text.

## Response Truncation

Responses exceeding 50KB are automatically truncated to prevent degraded AI reasoning quality. Truncated responses include `_truncated: true` and a `_message` field suggesting pagination or more specific filters.

## Troubleshooting

### "Cannot reach Forge server -- is it running?"

The Forge HTTP server is not running. Start it with:

```bash
bun run packages/core/src/index.ts
# or: just api
```

### "SDK method signature mismatch"

The `@forge/sdk` version may be incompatible with the MCP server. Ensure both packages are from the same monorepo version:

```bash
bun install  # from monorepo root
```

### "Response truncated"

The response exceeded 50KB. Use `offset` and `limit` parameters for pagination, or apply more specific filters to reduce the result set.

### Feature-flagged tools not appearing

Check the server startup logs (stderr) for feature flag messages. If a tool depends on Phase 60, Phase 62, or other SDK features not yet implemented, it will not be registered. See the Feature Flags section above.
