# Forge Resume Builder

> **Forge is a SaaS product + OSS distribution**, not a solo/personal tool. The current single-user local deployment is the MVP/dogfooding phase. All architectural decisions must account for multi-tenancy, auth, feature flags, observability, and data isolation. Do not make decisions that paint the project into a single-user corner.

## Project Structure

- `packages/core/` — HTTP API server (Bun, Hono, SQLite)
- `packages/sdk/` — TypeScript SDK for the API
- `packages/mcp/` — MCP server (67 tools, stdio for Claude Code, HTTP :5174 for web UI)
- `packages/webui/` — Svelte frontend (:5173)
- `packages/extension/` — Browser extension (Chrome + Firefox MV3)
- `packages/cli/` — CLI tool
- `data/forge.db` — SQLite database

## Development

**Use Docker for all development.** The containerized stack is the default workflow — it provides isolated data, consistent environment, and Traefik routing. Do not use bare `just dev` unless specifically debugging host-level issues.

```bash
# Docker (default — use this)
just docker dev         # Dev stack: hot-reload, forge.localhost (:80/:8080)
just docker dev-helix   # Dev + HelixDB (both storage backends)
just docker test        # Ephemeral: build → seed → test → teardown
just docker test-seed   # Test stack with seed data, leave running
just docker prod        # Production simulation (compiled build)
just docker down        # Stop all containers
just docker logs [svc]  # Follow container logs
just docker shell       # Interactive container shell
just docker test-shell  # Shell into running test container
just docker reset [env] # Wipe data for env (dev/test/prod)

# Host-local (only when needed)
just dev          # Start API + MCP + WebUI directly
just test         # Run all tests
just test-core    # Core tests only
just migrate      # Run DB migrations
```

## Plans & Specs Location

All design specs and implementation plans live in `.claude/plans/`:

- **Forge development** (UI/UX, data models, features, bugs): `.claude/plans/forge-resume-builder/`
  - Design specs: `refs/specs/YYYY-MM-DD-<topic>.md`
  - Phased plans: `phase/<number>-<name>.md`
  - Feature requests & bugs: `.feats/mcp/` or `.feats/<category>/`
- **Non-Forge topics** get their own subdirectory: `.claude/plans/<topic-name>/`

Never put specs or plans in `docs/superpowers/` — that path is a superpowers skill default that should be overridden.

## UI Shared Components

See `.claude/rules/ui-shared-components.md` for required component usage (PageWrapper, SplitPanel, TabBar, etc.).

## Extension (Cross-Browser)

See `.claude/rules/extension-cross-browser.md` for dual-browser build rules, manifest parity, and content script constraints.

## MLFlow / Telemetry

- MLFlow at `http://127.0.0.1:5000` (NOT `localhost` — AirPlay steals :5000 on IPv6)
- Telemetry proxy: `just telemetry` (mitmproxy on :8888)
- See `.claude/plans/claude-code-telemetry/` for design

## Storage Abstraction

- EntityLifecycleManager (ELM) abstracts all data access
- SQLite adapter: default, used for local dev
- HelixDB adapter: production target, requires Docker (`just docker dev`)
- Switch via `FORGE_STORAGE=helix HELIX_URL=http://localhost:6969`


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
