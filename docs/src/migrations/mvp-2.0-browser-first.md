# Migration: MVP 2.0 — Browser-First Architecture

> Status: Planning
> Goal: CF-deployed minimal browser-first example ASAP, then iterate
> Self-destruct: Delete this file when migration is complete

## Overview

Migrate from the current server-first architecture (Hono API as primary, browser as thin client) to browser-first (wa-sqlite as primary, server as optional SaaS enhancement).

The goal is a working CF deployment as fast as possible, then iterating on features.

## Current State (MVP 1.0)

```
Browser (Svelte) ──HTTP──→ Hono API ──→ SQLite (server)
Extension ──HTTP──→ Hono API
MCP Server ──HTTP──→ Hono API
```

- All data lives on server
- Browser is a thin client making API calls
- No offline capability
- Self-hosted only (no cloud deployment)

## Target State (MVP 2.0)

```
Browser (WASM) ──→ wa-sqlite (OPFS, local)
                ──→ CDN (global snapshot)
                ──→ Server API (SaaS sync only)
Extension ──→ wa-sqlite (same-origin, default)
           ──→ Hono API (configurable override)
```

## Phases

### Phase 1: ELM BrowserStore Adapter

**What:** Create a `WaSqliteAdapter` that implements the same ELM interface as `SqliteAdapter` but targets browser wa-sqlite.

**Changes:**
- New package or module: `packages/core/src/adapters/wa-sqlite/`
- Same repository interfaces, different storage backend
- Migration runner that works in browser (apply migrations to wa-sqlite)
- All existing SQL queries must work in wa-sqlite (verify compat)

**Docs to update:** `models/runtime.md` — add BrowserStore adapter details

**Done when:** Can run the full Forge data layer in a browser tab with wa-sqlite, no server.

### Phase 2: Dual-Mode Application

**What:** Application logic works with either BrowserStore or RemoteStore, selected at startup.

**Changes:**
- ELM initialization accepts a store type config
- OSS mode: `BrowserStore` (wa-sqlite, OPFS)
- SaaS mode: `BrowserStore` + `RemoteStore` (browser-local for reads, server for sync)
- Self-hosted mode: `RemoteStore` only (existing behavior, Hono API)
- Svelte app detects mode and initializes accordingly

**Docs to update:** `models/deployment.md` — dual-mode configuration

**Done when:** Same app binary works in all three modes.

### Phase 3: CF Deployment (MVP 2.0 ship target)

**What:** Minimal CF deployment — static app on R2/Pages, global snapshot on R2.

**Changes:**
- Build pipeline: Svelte app → WASM bundle → CF Pages
- Global skill graph snapshot: build + upload to R2
- Embedding model files: cache on R2 or reference HuggingFace CDN
- No SaaS features yet — pure OSS browser-local experience
- Domain setup (forge.arusty.dev or similar)

**Docs to update:** `models/deployment.md` — CF deployment specifics

**Done when:** Anyone can visit the URL and use Forge with browser-local storage.

### Phase 4: D1 + Sync (SaaS foundation)

**What:** Authenticated users get D1-backed persistence with CRDT sync.

**Changes:**
- D1 database provisioned per-tenant namespace
- CF Workers auth layer (CF Access / JWT)
- Sync endpoint on Hono API (CF Worker)
- CRDT operation log in browser wa-sqlite
- Push/pull sync protocol implementation

**Docs to update:** `models/sync.md` — implementation details, `seams.md` — Seam 7 details

**Done when:** SaaS user can use Forge on two devices and data syncs.

### Phase 5: HelixDB + Premium Features

**What:** Connect HelixDB for advanced graph queries, market intelligence, LLM curation.

**Changes:**
- HelixDB deployment on Vercel behind CF ZeroTrust
- Global skill graph curation pipeline (server-side)
- Market stats aggregation from federated contributions
- Premium API endpoints (analytics, 3rd-party data)

**Docs to update:** `graphs/computed.md` — market stats pipeline, `models/deployment.md` — HelixDB details

**Done when:** SaaS users get market intelligence and advanced graph features.

### Phase 6: Extension Sync Service

**What:** Extension syncs with browser-local DB by default, configurable for self-hosted.

**Changes:**
- Extension reads/writes same-origin wa-sqlite (no API calls needed)
- Configuration option for self-hosted Hono API override
- Sync Service mediates extension ↔ SaaS (browser is the intermediary)

**Docs to update:** `seams.md` — Seam 8 details

**Done when:** Extension works in both OSS and SaaS modes.

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| wa-sqlite OPFS browser compat | Blocks Phase 1 | Test in Chrome, Firefox, Safari early. Fallback: IndexedDB via sql.js |
| CRDT complexity | Delays Phase 4 | Start with LWW-only (simplest CRDT), add OR-Set for collections later |
| wa-sqlite query compat with server SQLite | Blocks Phase 1 | Run existing test suite against wa-sqlite adapter early |
| CDN snapshot size growth | Degrades OSS UX | Delta sync (Phase 5+), lazy loading, compression |
| D1 cold start latency | SaaS UX issue | Turso session cache layer |

## Cleanup (post-migration)

When all phases are complete:
- [ ] Delete this file
- [ ] Update `models/runtime.md` to remove "migration in progress" notes
- [ ] Update `models/deployment.md` to mark as "current" not "target"
- [ ] Archive any temporary compatibility shims
- [ ] Update CLAUDE.md to reflect browser-first as default
