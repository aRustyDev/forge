# Seams (Interface Boundaries)

> Status: Design

## Overview

Seams are the interface boundaries between subsystems. Each seam defines what crosses the boundary, in which direction, and what contract must hold. Understanding seams prevents coupling and enables parallel development.

## Seam 1: Skill Graph ↔ Extraction Pipeline

**Direction:** Bidirectional

**Graph → Pipeline:**
- HNSW index over embeddings (for similarity search)
- Alias lookup table (canonical name → all aliases)
- Adjacency list (for graph contextual traversal)
- Typed traversal API: `SkillGraphTraversal` trait — see contract below

**Pipeline → Graph:**
- Confirmed skill extractions (reinforce node confidence)
- New skill candidates (HNSW misses, queued for curation)
- Co-occurrence observations (update temporal edge weights)

**Contract:** Graph schema must be stable before pipeline development begins. Pipeline depends on the traversal API, not internal graph representation.

### Trait: `SkillGraphTraversal`

Defined in `forge-core::types::skill_graph` (forge-8xjh). The SQL backend `SqlSkillGraphStore` lives in `forge-sdk::db::stores::skill_graph`; the in-memory backend will live in `forge-wasm::skill_graph` (forge-afyg).

```rust
pub trait SkillGraphTraversal {
    fn find_aliases(&self, skill_id: &str) -> Result<Vec<SkillNode>, ForgeError>;
    fn find_children(&self, skill_id: &str) -> Result<Vec<SkillNode>, ForgeError>;
    fn find_parents(&self, skill_id: &str) -> Result<Vec<SkillNode>, ForgeError>;
    fn find_related(&self, skill_id: &str, edge_types: &[EdgeType]) -> Result<Vec<RelatedSkill>, ForgeError>;
    fn n_hop_neighbors(&self, skill_id: &str, n: usize, edge_types: Option<&[EdgeType]>) -> Result<NeighborhoodSubgraph, ForgeError>;
    fn find_by_name(&self, name: &str) -> Result<Option<SkillNode>, ForgeError>;
    fn co_occurrence_stats(&self, skill_id: &str, time_window: Option<&str>) -> Result<Vec<CoOccurrenceStat>, ForgeError>;
}
```

Direction conventions (load-bearing for downstream consumers):
- `find_aliases` is **bidirectional** — alias-of edges resolve regardless of which end `skill_id` sits on.
- `find_children` follows `parent-of` outbound from `skill_id` AND `child-of` inbound to it. Only one direction needs to be materialized in storage; the trait abstracts the choice. (Initial population at forge-e2js materializes only `parent-of`.)
- `find_parents` is the inverse of `find_children`.
- `find_related` returns OUTGOING edges only — the precise primitive when callers care about edge direction.
- `n_hop_neighbors` is **undirected** — both incoming and outgoing edges are followed. `edge_types = None` follows every type.
- `find_by_name` matches `canonical_name` first, then falls back to scanning the JSON `aliases` column for an exact entry match.
- `co_occurrence_stats(id, None)` returns the headline `weight` from each `co-occurs` edge (most-recent window by convention). `co_occurrence_stats(id, Some(window))` parses each edge's `temporal_data` JSON and returns only edges with an entry for that window, using the windowed weight + jd_count.

Adding a new `EdgeType` variant requires updating: (1) the SQL `CHECK` constraint in migration 052, (2) the `EdgeType` enum in forge-core, (3) the trait's documented direction conventions if the new type breaks any existing assumption, (4) the alignment scoring weights (Seam 3).

## Seam 2: Extraction ↔ Entity-Specific Strategies

**Direction:** Pipeline framework → Entity strategy plugins

The RRF pipeline framework is shared. Entity-specific strategies plug in as:
- Text chunking strategy (how to split the input)
- Pattern set (which regex patterns to use)
- Context signals (industry, archetype, section type)
- Confidence thresholds (certs = high auto-accept, free text = low)

JD extraction ≠ bullet extraction ≠ cert extraction ≠ free text extraction.

**Contract:** Each entity strategy implements a common interface: `chunk(text) → chunks[]`, `patterns() → Pattern[]`, `context() → ContextSignals`.

## Seam 3: Skill Graph ↔ Alignment Scoring

**Direction:** Graph → Scoring (read-only traversal)

- Edge types have numeric semantics: alias=1.0, child=0.9, parent=0.5, sibling=0.4, co-occurs=0.3
- Graph provides typed traversal API
- Scoring assigns weights based on edge types and level signals
- Graph does NOT compute alignment — it provides the traversal substrate

**Contract:** Alignment scoring depends on `edge_type` enum values and traversal API. Adding a new edge type requires updating the scoring weights.

## Seam 4: Embedding Space ↔ Graph Space

**Direction:** Parallel, resolved by RRF

- Embeddings: "nearby in meaning" (continuous similarity)
- Graph: "nearby in structure" (discrete relationships)
- Sometimes agree: K8s and Docker are close in both
- Sometimes diverge: Python and JavaScript are close in embeddings but have no graph edge

**Resolution:** The RRF fusion combines both signals. Each gets a vote. The fused score is more robust than either alone.

**Implication:** Don't try to make embeddings and graph agree — they capture different information. Let RRF handle the disagreement.

## Seam 5: Persistent Graph ↔ Computed Alignment Graph

**Direction:** Persistent → Computed (read), Computed → Persistent (write-back)

- Skill Graph: persistent, curated, evolving
- Alignment Graph: ephemeral, computed per resume×JD pair
- Alignment results can feed BACK: co-occurrence signals, relationship reinforcement, confidence updates
- This feedback loop flows through the Curation Workflow (Epic 4), not directly

**Contract:** Alignment never writes directly to the skill graph. It produces observation events that the curation pipeline processes.

## Seam 6: Server Graph ↔ Browser Snapshot

**Direction:** Server → Browser (snapshot push), Browser → Server (write-back API)

- Server: full, mutable graph in SQLite/HelixDB
- Browser: read-only snapshot in IndexedDB
- Snapshot format: nodes + edges + embeddings + pre-built HNSW index
- Version checking via ETag prevents unnecessary re-downloads

**Writes flow:**
1. Browser extraction produces new skill candidate
2. POST to server API with candidate data
3. Server curation pipeline processes (auto-accept or queue for review)
4. Graph updates
5. Next snapshot build includes the change
6. Browser detects new snapshot version on next check

**Contract:** Browser never assumes its snapshot is current. All mutations go through the server. Snapshot staleness is acceptable (eventually consistent).

**Implementation (forge-lu5s, 2026-04-28):**
- `crates/forge-wasm/src/adapter.rs` — `WaSqliteAdapter::open(filename)` opens an IDB-backed wa-sqlite database and runs all 51 Forge migrations (`forge_core::migrations::MIGRATIONS`, lifted from forge-sdk during this bead).
- `crates/forge-wasm/src/database.rs` — typed `Statement` API (prepare / bind_* / step / column_* / reset / finalize) plus a `Transaction` guard with `with_transaction(closure)` helper. exec_batch is the canonical multi-statement path; the forge-nst6 PoC's `query` is preserved for harness inspection.
- `crates/forge-wasm/src/stores/skill.rs` — first vertical-slice store (create / get / list / update / delete / list_categories). Junction-table methods (`get_with_domains`, `link_domain`) deferred to a successor bead.
- VFS: `IDBBatchAtomicVFS` (NOT OPFS) — wa-sqlite@1.0.0 npm constraint, see forge-n89p for the OPFS migration trigger.
- Spec: `.claude/plans/forge-resume-builder/refs/specs/2026-04-28-browserstore-adapter-vertical-slice.md`. Plan: same path with `-plan.md` suffix.

## Seam 7: Browser DB ↔ SaaS Sync

**Direction:** Bidirectional (CRDT merge)

- Browser wa-sqlite maintains a mutation log (CRDT operations)
- On sync: push operation log to server → server merges into D1 → server returns remote operations → browser applies
- Conflict resolution: LWW per field (default), OR-Set for collections (skill tags, resume entries), LSeq for ordering (section positions)
- Turso session layer provides efficient diffing between browser state and D1 state

**Contract:** All mutations are captured as CRDT operations. Server never modifies user data outside of merge operations. Browser is the source of truth during a session; D1 is the source of truth between sessions.

See [models/sync.md](models/sync.md) for protocol details.

## Seam 8: Extension ↔ Browser DB

**Direction:** Extension reads/writes browser-local wa-sqlite (default)

- Extension and web app share the same origin → same wa-sqlite instance
- Extension reads: user profile, existing orgs, existing JDs (for dedup during capture)
- Extension writes: new JDs, new orgs, extracted skills
- No API calls needed in default mode

**Override mode:** User configures extension to talk to self-hosted Hono API instead of browser-local DB. Extension detects config and routes accordingly.

**Contract:** Extension never talks directly to SaaS server. For SaaS sync, the browser app is the intermediary (extension → browser DB → sync service → D1).

## Seam 9: Encryption Layer (future)

**Direction:** Wraps all browser → server data flow

- All user data passing from browser to server goes through an encryption layer
- Server stores encrypted blobs — can route and timestamp but not read
- CRDT merge works on metadata (timestamps, actor IDs) without decrypting payloads
- Market stats contributions are NOT encrypted (anonymous aggregate tuples)
- Key management: browser holds the key, never transmitted to server

**Contract:** Design the interface now (encrypt/decrypt functions wrapping the sync payload). Implement zero-knowledge later. Current implementation: passthrough (no-op encryption).
