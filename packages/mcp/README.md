# @forge/mcp -- Forge MCP Server

Machine-to-machine interface between AI clients (Claude Desktop, Claude Code, Cursor, Windsurf) and the Forge resume builder.

## Quick Start

```bash
# Prerequisites: Forge HTTP server must be running
bun run packages/core/src/index.ts  # or: just api

# Start the MCP server
bun run packages/mcp/src/index.ts   # or: just mcp
```

## Transport

**STDIO only** (current). The server communicates over stdin/stdout using the MCP protocol. SSE and Streamable HTTP transports are planned for future phases.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FORGE_API_URL` | `http://localhost:3000` | Forge HTTP API base URL |
| `FORGE_MCP_DEBUG` | (unset) | Set to any value to enable verbose success logging to stderr |

## Tools

### Tier 0: Diagnostics (1 tool)
- `forge_health` -- Check Forge server connectivity

### Tier 1: Core Workflow (20 tools)
- **Search (3):** `forge_search_sources`, `forge_search_bullets`, `forge_search_perspectives`
- **Get (3):** `forge_get_source`, `forge_get_bullet`, `forge_get_perspective`
- **List (1):** `forge_list_resumes`
- **Derive (2):** `forge_derive_bullets`, `forge_derive_perspective`
- **Review (4):** `forge_approve_bullet`, `forge_reject_bullet`, `forge_approve_perspective`, `forge_reject_perspective`
- **Assembly (3):** `forge_create_resume`, `forge_add_resume_entry`, `forge_create_resume_section`
- **Analysis (3):** `forge_gap_analysis`, `forge_align_resume`, `forge_match_requirements`
- **Export (1):** `forge_export_resume`

**Total: 21 tools**

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

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "forge": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/packages/mcp/src/index.ts"],
      "env": {
        "FORGE_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Claude Code

Add to `.claude/settings.json` at project root:

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

## Prerequisites

- Forge HTTP server running (`bun run packages/core/src/index.ts`)
- `@forge/sdk` workspace dependency (already configured)
- Bun runtime
