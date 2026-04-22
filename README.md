# Forge

Self-hosted resume builder and job application toolkit.

## What is Forge?

Forge helps you manage your career data — experience, skills, bullets, perspectives — and build targeted resumes. It includes:

- **Core API** — HTTP server (Bun + Hono + SQLite)
- **SDK** — TypeScript client library
- **MCP Server** — 67 tools for Claude Code integration
- **Web UI** — Svelte frontend for managing everything
- **Browser Extension** — Capture job listings and auto-fill applications (Chrome + Firefox)

## Quick Start

```bash
# Install dependencies
bun install

# Start all services (API :3000, MCP :5174, WebUI :5173)
just dev
```

## Browser Extension

The Forge Job Tools extension captures job descriptions from LinkedIn and Workday, and auto-fills application forms using your Forge profile data.

Install from:
- [Chrome Web Store](#) (coming soon)
- [Firefox Add-ons](#) (coming soon)

Or load from source: `packages/extension/dist/chrome/` or `packages/extension/dist/firefox/`

## Project Structure

```
packages/
  core/       — HTTP API server (Bun, Hono, SQLite)
  sdk/        — TypeScript SDK for the API
  mcp/        — MCP server (67 tools)
  webui/      — Svelte frontend
  extension/  — Browser extension (Chrome + Firefox)
```

## Development

```bash
just dev          # Start API + MCP + WebUI
just api          # Start only the API server
just webui        # Start only the WebUI
just pack-extension  # Build + zip extension for store submission
```

## License

MIT
