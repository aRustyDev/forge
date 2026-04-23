# ADR: Rust Crate Selection

**Date**: 2026-04-23
**Status**: Accepted
**Context**: forge-dw4 stubs complete; selecting production dependencies for R0 implementation.

## Decisions

### 1. SQLite: rusqlite (with `bundled` feature)

**Chosen**: `rusqlite` ~0.32
**Rejected**: sqlx (async overhead unnecessary), diesel (ORM overhead, macro complexity)

**Rationale**: Forge is a single-user desktop/local application. The TS version
uses bun:sqlite (sync). rusqlite is the direct equivalent — sync, mature, proven
for desktop apps. The `bundled` feature statically links libsqlite3, eliminating
system dependency issues.

Row mapping: manual `row.get()` calls into struct fields, or a helper macro.
No compile-time query checking needed (the TS version doesn't have it either).

### 2. LLM Client: reqwest + serde (thin wrapper)

**Chosen**: Custom wrapper (~200 LOC) using `reqwest` + `serde_json` + `tokio`
**Rejected**: anthropic-rs / claude-rs (no mature official SDK as of 2025)

**Rationale**: The Anthropic API is stable and well-documented. A thin wrapper
gives better control over request/response types, retries, and streaming.
Lives in `forge-ai` crate, isolated from business logic.

### 3. LaTeX/PDF: pdflatex subprocess

**Chosen**: `std::process::Command` calling pdflatex/lualatex
**Rejected**: tectonic (100MB+ binary bloat), typst (template rewrite needed)

**Rationale**: The TS version already uses pdflatex subprocess and it works.
Resume templates are simple — no exotic TeX packages needed. Keep the proven
pattern. If portability becomes important, wrap in Docker.

### 4. Configuration: figment

**Chosen**: `figment` ~0.10
**Rationale**: User decision. Supports layered config (env → file → CLI),
type-safe deserialization, profiles (dev/prod). Standard choice in Rust.

### 5. Async Runtime: tokio (binary crates only)

**Chosen**: `tokio` with `full` features in forge-server, forge-mcp, forge-cli
**Not used in**: forge-core (no I/O), forge-sdk (sync rusqlite)

**Rationale**: Library code (forge-sdk) is sync — rusqlite is sync, and
single-user apps don't benefit from async DB access. Async only at the
binary boundary: axum (async), reqwest (async for LLM calls), MCP protocol.

forge-sdk services are sync. The axum server wraps them in
`tokio::task::spawn_blocking()` if needed.

### 6. Error Handling: thiserror (libraries) + anyhow (binaries)

**Chosen**: `thiserror` in forge-core and forge-sdk for typed errors;
`anyhow` in forge-server, forge-mcp, forge-cli for top-level error handling.

**Rationale**: thiserror generates From impls for error conversion
(rusqlite::Error → ForgeError). anyhow provides ergonomic `?` in main()
and route handlers without defining error types.

### 7. HTTP Server: axum

**Chosen**: `axum` ~0.8 (already in workspace)
**Rationale**: De facto standard for Rust web servers. Extractors map
cleanly to forge-sdk types. Tower middleware ecosystem.

### 8. CLI: clap

**Chosen**: `clap` ~4 with `derive` feature (already in workspace)
**Rationale**: Standard. Derive macro for struct-based arg parsing.

### 9. Logging: tracing

**To add**: `tracing` + `tracing-subscriber`
**Rationale**: De facto standard. Structured logging, spans, async-aware.
Used by axum and tokio internally.

### 10. ID Generation: uuid

**To add**: `uuid` with `v4` feature
**Rationale**: All entity IDs are UUIDs stored as TEXT. Matches TS
`crypto.randomUUID()` usage.

## Dependency Summary

| Crate | forge-core | forge-sdk | forge-ai | forge-server | forge-mcp | forge-cli |
|-------|-----------|-----------|----------|-------------|-----------|-----------|
| serde | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| serde_json | ✓ | ✓ | ✓ | | | |
| chrono | ✓ | | | | | |
| rusqlite | | ✓ | | | | |
| thiserror | ✓ | ✓ | ✓ | | | |
| uuid | | ✓ | | | | |
| reqwest | | | ✓ | | | |
| tokio | | | ✓ | ✓ | ✓ | ✓ |
| axum | | | | ✓ | | |
| clap | | | | | | ✓ |
| figment | | | | ✓ | ✓ | ✓ |
| tracing | | ✓ | ✓ | ✓ | ✓ | ✓ |
| anyhow | | | | ✓ | ✓ | ✓ |
