# Runtime Model

> Epic: forge-6r2y (Skill Graph Browser Runtime)
> Status: Design

## Overview

Skill intelligence runs in two modes: server-side (build-time, full capability) and browser-side (runtime, snapshot-based). The architecture is a distillation pattern — LLM knowledge gets compressed into graph structures and embeddings that run cheaply on the client.

```
BUILD TIME (server, LLM, batch)          RUNTIME (browser, CPU, realtime)
┌─────────────────────────────┐          ┌──────────────────────────────┐
│ Curate skill taxonomy       │          │ Load graph snapshot          │
│ Generate embeddings         │  ──→     │ Load HNSW index              │
│ Propose relationships       │ snapshot │ Load small embedding model   │
│ Validate via human review   │          │ Extract → Match → Align      │
│ Build HNSW index            │          │                              │
└─────────────────────────────┘          └──────────────────────────────┘
```

## Server (Build-Time)

- Full graph in SQLite/HelixDB
- LLM-assisted curation (batch, not realtime) — propose edges, validate skills
- Embedding generation (can use larger models than browser)
- HNSW index building (one-time, included in snapshot)
- Snapshot serialization and upload to CDN (Cloudflare R2)
- Curation review queue processing

## Browser (Runtime)

### Stack

| Component | Library | Size | Role |
|-----------|---------|------|------|
| Embedding model | transformers.js (all-MiniLM-L6-v2) | ~80MB WASM/WebGPU | Embed query text |
| HNSW index | usearch-js or hnswlib.js | Scales with corpus | Nearest-neighbor lookup |
| Graph structure | Plain JS Map/Set | ~50KB at 10k nodes | Relationship traversal |
| Fuzzy string match | fuse.js or custom trigram | Tiny | Alias/abbreviation matching |
| Storage | IndexedDB | N/A | Cache snapshots between sessions |

### Snapshot Lifecycle

1. Server builds snapshot via `forge_sdk::db::stores::skill_graph::build_structural_snapshot(conn, snapshot_id)` (forge-ubxb).
2. Future: forge-afyg packs the embedding payload and HNSW blob into the binary sections of the same `SkillGraphSnapshot` container.
3. Encode to bytes via `SkillGraphSnapshot::encode()` (custom container — see `graphs/skills.md` for byte layout).
4. Upload to Cloudflare R2 (or equivalent CDN). The CDN's ETag header drives client cache validation.
5. Browser checks ETag on load. If new: download full snapshot → store in IndexedDB keyed by `metadata.snapshot_id` → decode via `SkillGraphSnapshot::decode()` → rebuild in-memory structures.
6. If cached: load from IndexedDB directly.
7. Future: delta/diff-based sync for incremental updates (snapshot version bumps required).

### Snapshot Budget (at 10k skills)

| Component | Size | Status |
|-----------|------|--------|
| Embeddings (10k × 384 × 4 bytes, raw bytes) | ~15MB | Format slot ready (forge-ubxb), payload deferred to forge-afyg |
| Graph structure (JSON header: nodes + typed edges + market stats) | ~3MB | Implemented (forge-ubxb) |
| HNSW index (pre-built, opaque blob) | ~5MB | Format slot ready, payload deferred to forge-afyg |
| **Total budget** | **<25MB** | Verified at 10k synthetic nodes with simulated embeddings |

Acceptable for initial download, cached in IndexedDB thereafter. Compression (gzip/brotli) at the CDN layer would further reduce wire size; not part of the format itself.

### Snapshot Composition

The skill snapshot may include non-skill data needed for runtime operations:
- Org/Industry context (for extraction disambiguation)
- Cert → skill validation mappings (for alignment scoring)
- Archetype → skill expectations (for Career Target, future)

Decision: include in one snapshot (larger, self-contained, full offline) vs separate snapshots (smaller, more requests, partial offline). Recommend: single snapshot for v1, separate per graph for v2.

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Snapshot load from IndexedDB | < 500ms | Deserialization + in-memory structure build |
| Snapshot download from CDN | network-dependent | ~20MB, cached after first download |
| Embedding model init (first load) | 2-5s | WASM compilation, one-time per session |
| Single text embedding | ~50ms | After model init |
| HNSW search (top-k at 10k) | < 50ms | Pre-built index |
| Full JD extraction | < 500ms | All 4 extractors + RRF fusion |
| Alignment scoring (resume vs JD) | < 100ms | Graph traversal + scoring |
| Skill autocomplete (per keystroke) | < 50ms | Embed + HNSW + fuzzy |
| Memory footprint | < 150MB | Model (~80MB) + snapshot (~20MB) + runtime overhead |

## Performance Optimizations

- **WebGPU:** If available, embedding is ~10x faster. Detect and prefer.
- **Web Worker:** Extraction pipeline MUST run in a Web Worker to avoid blocking UI thread.
- **Service Worker:** Could pre-cache snapshot for true offline support (future).
- **Lazy model loading:** Don't load embedding model until first extraction is requested.
- **HNSW warm-up:** Pre-load HNSW index on snapshot load, before first query.

## Offline Capability

After initial snapshot download + embedding model cache:
- Extraction: fully offline
- Alignment scoring: fully offline
- Skill search/autocomplete: fully offline
- New skill submission: queued, synced when online
- Snapshot updates: checked when online, stale snapshot still functional
