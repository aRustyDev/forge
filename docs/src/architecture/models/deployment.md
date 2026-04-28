# Deployment Architecture

> Status: Design (2026-04-27)
> Related: [runtime.md](runtime.md), [sync.md](sync.md)
> Migration: [mvp-2.0-browser-first.md](../../migrations/mvp-2.0-browser-first.md)

## Design Principle

**Browser-first, server-optional.** The browser is the primary runtime. The server is an optional enhancement for SaaS users. OSS and SaaS share the same WASM application — SaaS is a superset of functionality, primarily around managed persistence and premium data.

```
ALL USERS (OSS baseline):
  Browser WASM app (CDN-hosted)
  + wa-sqlite/OPFS (local private data)
  + Global skill graph snapshot from CDN (public, free)
  + Embedding model (WASM/WebGPU)
  + Self-hostable Hono API (optional, for power users)

SAAS USERS (superset):
  Everything above
  + D1 for private user data (persistent, authenticated)
  + HelixDB on Vercel behind CF ZeroTrust (graph queries, analytics)
  + Turso diff sync per-session (batched, not per-query)
  + Server-side analytics, wrapped 3rd-party APIs, premium data
  + Managed sync between browser ↔ SaaS

EXTENSION:
  Defaults to browser-local DB (same-origin wa-sqlite)
  + Configurable: override to self-hosted Hono API
  + Sync Service for browser ↔ SaaS (not extension ↔ SaaS directly)
```

## Topology

```
                    ┌─────────────────────────────────┐
                    │         CDN / R2                 │
                    │  - WASM app bundle               │
                    │  - Global skill graph snapshot    │
                    │    (nodes + edges + embeddings    │
                    │     + HNSW + market stats)       │
                    │  - Embedding model files          │
                    └──────────────┬───────────────────┘
                                   │ download (unauthenticated)
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                        BROWSER                                │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────┐ │
│  │ WASM App     │  │ wa-sqlite     │  │ Embedding Model   │ │
│  │ (Forge UI)   │  │ (OPFS)        │  │ (transformers.js) │ │
│  │              │  │               │  │                   │ │
│  │              │  │ Private data: │  │ - Skill embedding │ │
│  │              │  │ - sources     │  │ - Bullet embedding│ │
│  │              │  │ - bullets     │  │ - JD embedding    │ │
│  │              │  │ - resumes     │  │                   │ │
│  │              │  │ - JDs         │  │ HNSW Index        │ │
│  │              │  │ - alignments  │  │ (in-memory)       │ │
│  │              │  │ - career tgt  │  │                   │ │
│  │              │  │ - mutation log│  │                   │ │
│  │              │  │               │  │                   │ │
│  │              │  │ Global data:  │  │                   │ │
│  │              │  │ - skill graph │  │                   │ │
│  │              │  │ - market stats│  │                   │ │
│  └──────┬───────┘  └───────┬───────┘  └─────────┬─────────┘ │
│         │                  │                    │            │
│  ┌──────┴──────────────────┴────────────────────┴─────────┐  │
│  │              ELM (Storage Abstraction)                  │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐  │  │
│  │  │ BrowserStore    │  │ RemoteStore (SaaS only)     │  │  │
│  │  │ (wa-sqlite)     │  │ (HTTP → Server API)        │  │  │
│  │  └─────────────────┘  └──────────────┬──────────────┘  │  │
│  └──────────────────────────────────────┼─────────────────┘  │
│                                         │                    │
│  ┌──────────────────────────────────────┼─────────────────┐  │
│  │           Extension (same-origin)    │                 │  │
│  │  Default: reads/writes wa-sqlite     │                 │  │
│  │  Override: configurable to Hono API  │                 │  │
│  └──────────────────────────────────────┼─────────────────┘  │
└─────────────────────────────────────────┼────────────────────┘
                                          │ authenticated
                                          │ (SaaS only)
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (SaaS only)                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ Hono API     │  │ D1           │  │ HelixDB           │ │
│  │ (also self-  │  │ (per-user    │  │ (Vercel, behind   │ │
│  │  hostable    │  │  private     │  │  CF ZeroTrust)    │ │
│  │  for OSS)    │  │  data)       │  │                   │ │
│  │              │  │              │  │ - Global skill    │ │
│  │ Endpoints:   │  │ Synced from  │  │   graph (mutable) │ │
│  │ - sync       │  │ browser via  │  │ - Cross-user      │ │
│  │ - curation   │  │ CRDT merge   │  │   analytics       │ │
│  │ - analytics  │  │              │  │ - LLM curation    │ │
│  │ - 3rd party  │  │              │  │   pipeline        │ │
│  │   API proxy  │  │              │  │ - Market stats    │ │
│  │              │  │              │  │   aggregation     │ │
│  └──────────────┘  └──────────────┘  └───────────────────┘ │
│                                                             │
│  ┌──────────────┐                                           │
│  │ Turso        │ Session sync layer (not per-user DB)      │
│  │              │ Per-session diff between browser ↔ D1     │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## Snapshot Distribution (CDN)

The global skill graph reaches the browser through a CDN-hosted snapshot file. The snapshot format is defined in `forge-core::types::skill_graph::SkillGraphSnapshot` (forge-ubxb) — see [graphs/skills.md → Snapshot Format](../graphs/skills.md#snapshot-format) for the on-disk byte layout.

**Build-and-publish pipeline:**
1. Server-side curation pipeline (forge-c4i5) updates the canonical graph in HelixDB / SQLite.
2. A scheduled or change-triggered job calls `build_structural_snapshot(conn, snapshot_id)` and (eventually) `pack_embeddings + pack_hnsw` from forge-afyg to produce a complete `SkillGraphSnapshot`.
3. `SkillGraphSnapshot::encode()` produces the binary file.
4. Upload to Cloudflare R2 under a versioned key, e.g. `snapshots/skill-graph/<snapshot_id>.bin` plus a `latest` pointer.
5. CF caches the file at the edge and serves an ETag computed from the file body.

**Client fetch pattern:**
1. Browser reads the cached `snapshot_id` (if any) from IndexedDB.
2. Issues `GET /snapshots/skill-graph/latest` with `If-None-Match: <etag>`.
3. CF returns `304 Not Modified` (cache hit) or `200` with the new body.
4. On `200`, decode → write to IndexedDB → swap into the runtime.

The `snapshot_id` doubles as the IndexedDB cache key. Format-version mismatches (`SNAPSHOT_FORMAT_VERSION` bumps) trigger a full re-fetch — the decoder rejects unknown versions before touching the rest of the payload.

## Storage Mapping

### What lives where

| Data | Browser (wa-sqlite) | CDN (R2) | D1 (SaaS) | HelixDB (SaaS) |
|------|--------------------:|:--------:|:---------:|:--------------:|
| User's relational data (sources, bullets, resumes, JDs, orgs) | Primary | — | Sync backup | — |
| User's private skill annotations | Primary | — | Sync backup | — |
| User's private vectors (bullet/JD embeddings) | Primary (sqlite-vec) | — | — | — |
| Alignment results | Primary | — | Sync backup | — |
| Career Target snapshots | Primary | — | Sync backup | — |
| Mutation log (CRDT operations) | Primary | — | Consumed on sync | — |
| Global skill graph (nodes + edges) | Loaded from snapshot | Snapshot | — | Mutable source of truth |
| Global skill embeddings + HNSW | Loaded from snapshot | Snapshot | — | — |
| Global market stats | Loaded from snapshot | Snapshot | — | Aggregation engine |
| WASM app bundle | — | Served | — | — |
| Embedding model files | Cached | Served | — | — |
| LLM curation state | — | — | — | Primary |
| Cross-user analytics | — | — | — | Primary |

### Database selection rationale

| Store | Why this DB | Alternative considered |
|-------|-------------|----------------------|
| **wa-sqlite (OPFS)** | Full SQLite compat — same schema as server. Runs in browser. OPFS gives persistent storage. sqlite-vec for vectors. | sql.js (no OPFS), Dexie (no SQL), PGlite (heavier) |
| **D1** | CF-native, per-user data, cheap at rest, pay-per-query. No per-user DB overhead. | Turso per-user (cost), Supabase (heavier) |
| **HelixDB** | Native graph queries for the global skill graph. Advanced traversal. Behind CF ZeroTrust. | SQLite with recursive CTEs (slower for multi-hop) |
| **Turso** | Session sync layer — not per-user persistence. Embedded replicas for efficient diff sync. | Custom CRDT sync over D1 directly (more code) |
| **R2** | Static file hosting, CDN-cached, cheap. Perfect for snapshots and app bundles. | S3 (not CF-native), GCS |

## OSS vs SaaS Feature Matrix

| Feature | OSS (free) | SaaS (paid) |
|---------|:----------:|:-----------:|
| Full Forge UI | Yes | Yes |
| Local data storage (wa-sqlite) | Yes | Yes |
| Global skill graph | Yes (snapshot) | Yes (snapshot + live queries) |
| Skill extraction (browser) | Yes | Yes |
| Alignment scoring | Yes | Yes |
| Resume builder | Yes | Yes |
| Extension | Yes | Yes |
| Self-hostable Hono API | Yes | Included |
| Multi-device sync | No (browser-local only) | Yes (CRDT via D1) |
| Backup/restore | Manual export/import | Automatic |
| Advanced graph queries (HelixDB) | No | Yes |
| LLM-powered curation suggestions | No | Yes |
| Market intelligence (premium) | Basic (public snapshot) | Full (real-time, industry-segmented) |
| Wrapped 3rd-party APIs | No | Yes |
| Cross-user analytics | No | Yes |
| Priority support | No | Yes |

## Zero-Knowledge Encryption (future)

Design the seams now, implement later:
- **Seam:** All user data flowing browser → server passes through an encryption layer
- **SaaS server data is NOT user-specific** — it's global (market stats, analytics, curated graph)
- **User-specific data** on the server (D1) CAN be encrypted client-side before sync
- **Key management:** browser holds the key, server never sees plaintext user data
- **Implication:** server can't query user data for features (acceptable — all user-facing features run in browser)
- **Exception:** anonymized market stat contributions (skill tuples) are NOT encrypted (they're aggregate, not personal)

## Self-Hosted OSS Deployment

For power users who want server features without SaaS:

```
Docker / docker-compose:
  ├── Hono API (serves static app + API endpoints)
  ├── SQLite (data persistence)
  └── Optional: HelixDB container (graph queries)
```

`just docker run` already supports this pattern. The browser-first architecture doesn't break self-hosting — it just means the self-hosted server is used for sync/backup rather than as the primary data store.
