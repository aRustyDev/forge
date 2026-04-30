# Skill Graph

> Type: Persistent, curated
> Epic: forge-ucc2 (Skill Graph Data Model & Storage)
> Schema: implemented in migration `052_skill_graph_schema.sql` (forge-7rd7)
> Initial population: implemented in migration `053_skill_graph_initial_population.sql` (forge-e2js)
> Traversal API: `SkillGraphTraversal` trait in `forge-core`, `SqlSkillGraphStore` in `forge-sdk` (forge-8xjh)
> Snapshot format: `SkillGraphSnapshot` + container layout in `forge-core`, `build_structural_snapshot` builder in `forge-sdk` (forge-ubxb)
> Status: Schema, initial population, SQL traversal, and structural snapshot landed. HNSW + market-stats payload sections deferred to forge-afyg / forge-c4i5.

## Initial Population

Migration 053 mirrors the legacy `skills` table into `skill_graph_nodes` and seeds an initial hierarchy:

- **Mirror nodes** — one `skill_graph_node` per row in `skills`, reusing the legacy UUID as `id` and recording it in `legacy_skill_id`. Junction tables (`bullet_skills`, `certification_skills`, `source_skills`, `summary_skills`, `perspective_skills`, `resume_skills`, `job_description_skills`, `skill_domains`) JOIN cleanly to either `skills` or `skill_graph_nodes` on the same UUID — no FK churn during the dual-schema period.
- **Category root nodes** — one synthetic `skill_graph_node` per `skill_categories` row, identified by `description = 'category-root:<slug>'` and tagged `category = 'concept'`. They anchor the initial hierarchy without polluting `skill_categories` itself.
- **`parent-of` edges** — emitted from each category root to every skill belonging to that category. `weight = 1.0`, `confidence = 1.0`. Only `parent-of` is materialized; `find_parents` queries by `target_id` rather than mirroring with `child-of` rows. The `child-of` vocabulary remains valid for user-curated assertions where a node is conceptually a child of multiple anchors with different semantics.

The migration is idempotent (existence guards on `legacy_skill_id` and `description`), additive (no rows in `skills` or junction tables are modified), and deterministic.

`alias-of` edges are NOT seeded by this migration — the legacy `skills` schema has no alias data. The extraction pipeline (forge-czgq) will populate alias-of edges as duplicates are discovered.

## Traversal API

The `SkillGraphTraversal` trait (defined in `forge-core::types::skill_graph`) is the single contract every backend honors. The SQL implementation (`SqlSkillGraphStore` in `forge-sdk::db::stores::skill_graph`) backs the server today; the WASM implementation (forge-afyg, in-memory `petgraph` over a snapshot) will back the browser. See [seams.md → Seam 1](../seams.md#seam-1-skill-graph--extraction-pipeline) for the full trait signature and direction conventions.

Backend notes for the SQL implementation:
- Recursive CTEs power `n_hop_neighbors`; both incoming and outgoing edges are walked. Edge-type filtering is parameterized via `json_each(?)` over a JSON array of allowed type strings — no string interpolation, so the call site is injection-safe.
- `find_by_name` first does an exact match on `canonical_name`, then falls back to scanning `aliases` with `EXISTS (SELECT 1 FROM json_each(...))`. Both queries hit indexed columns or use the JSON1 extension that ships with SQLite.
- `co_occurrence_stats(id, Some(window))` parses each edge's `temporal_data` array using `json_extract` and returns only edges with an entry for the requested window. `co_occurrence_stats(id, None)` returns the headline `weight` column on the edge, which conventionally tracks the most recent window.

## Snapshot Format

Distribution format for the global skill graph. Built server-side, uploaded to a CDN, fetched by the browser, cached in IndexedDB, and loaded into the forge-wasm runtime.

The container layout deliberately keeps the heavy binary payload (embeddings, HNSW index) out of the JSON header — encoding `Vec<u8>` as a JSON number array would explode the wire size 4×.

```
┌────────────────────────────────────────────────────────────────────┐
│ MAGIC          (4 bytes)  ASCII "FSGS"                             │
│ FORMAT_VERSION (4 bytes)  big-endian u32 (current: 1)              │
│ HEADER_LEN     (4 bytes)  big-endian u32                           │
│ HEADER         (HEADER_LEN bytes)  UTF-8 JSON — SnapshotHeader     │
│ EMBEDDINGS     (header.embedding_byte_length bytes)                │
│ HNSW_INDEX     (header.hnsw_index_byte_length bytes)               │
└────────────────────────────────────────────────────────────────────┘
```

The JSON header carries metadata, the node array, the edge adjacency list, and a market-stats slot:

```rust
SnapshotHeader {
    metadata: SnapshotMetadata {
        snapshot_id: String, created_at: String,
        skill_count: u32, edge_count: u32,
        embedding_model: Option<String>,    // None when no embeddings present
        embedding_dim: Option<u32>,
    },
    nodes: Vec<SnapshotNode>,                // id, canonical_name, category, aliases, source, confidence
    edges: Vec<SnapshotEdge>,                // source_id, target_id, edge_type, weight, confidence, temporal_data
    market_stats: Vec<MarketStat>,           // populated by forge-c4i5; empty in MVP
    embedding_byte_length: u64,
    hnsw_index_byte_length: u64,
}
```

Embeddings are stored as a contiguous packed array of native-endian f32 bytes, parallel to `nodes` (block `i` is `embeddings[i*dim*4 .. (i+1)*dim*4]`). The MVP requires either ALL or NONE of the nodes carry embeddings.

HNSW_INDEX is opaque to forge-core; the runtime that consumes it (forge-afyg, hnsw_rs / instant-distance / usearch — under research) chooses the on-disk format. Empty in MVP snapshots — the prototype runtime BUILDS the index at load time from the raw embedding payload (see "Runtime loading" below), so the snapshot stays library-agnostic.

**Compatibility:** every reader MUST refuse versions it doesn't know. Bumping `SNAPSHOT_FORMAT_VERSION` is required for any breaking change to the header schema or container layout.

**Size budget:** the bead's acceptance criterion calls for under 25 MB at 10k nodes. Verified by `snapshot_at_10k_nodes_fits_under_25mb` in forge-core (10k nodes × 384-dim f32 embeddings + ~30k edges fits well under the budget without compression). HNSW + market stats will need to be folded in once they exist; the size test should be updated accordingly when those slots are populated.

**ETag-based version checking** is HTTP plumbing rather than a property of this format — it lives at the CDN deployment layer (forge-4a01). Clients use the snapshot's `metadata.snapshot_id` as the cache key.

## Runtime loading (forge-afyg)

The WASM-side `SkillGraphRuntime` (in `crates/forge-wasm/src/skill_graph/runtime.rs`) consumes the snapshot eagerly at construction:

```
SkillGraphRuntime::from_snapshot(bytes: &[u8]) -> Result<Self, ForgeError>
```

After this returns, the runtime owns:

1. `Vec<SnapshotNode>` indexed by internal `NodeIndex` (= position in `header.nodes`).
2. Three `HashMap`s for O(1) entry-point lookups: `canonical_name → idx`, `alias → idx`, `id → idx`.
3. A `petgraph::DiGraph<NodeIndex, EdgeData>` where edges carry `(edge_type, weight, confidence)` so trait methods (`find_related`, `n_hop_neighbors`) can return full `RelatedSkill` / `EdgeRow` rows without re-reading the snapshot.
4. An `Option<HnswIndex>` built from the embedding payload at load time; `None` for structural-only snapshots.

The trait methods follow the same direction conventions as the SQL impl. `co_occurrence_stats` is a prototype seam — it returns empty for known skill ids until forge-c4i5 populates the snapshot's `market_stats` slot.

### HNSW backing impl — prototype

The current `HnswIndex` is a brute-force linear-scan stub (cosine similarity over L2-normalized vectors). It's hidden behind a private module seam (`crates/forge-wasm/src/skill_graph/hnsw.rs`). When the long-term library evaluation completes (hnsw_rs vs instant-distance vs usearch), swapping the impl is a single-file change with no API or downstream churn. The seam exists explicitly because both `hnsw_rs` and `instant-distance` currently require workspace-level `getrandom` rustflags surgery to build for `wasm32-unknown-unknown` — out of scope for the SaaS prototype.

### Measured performance (10k nodes × 384 dim, native release)

| Operation | AC budget | Observed |
|-----------|-----------|----------|
| `from_snapshot` (load + petgraph + HNSW build) | < 500 ms | ~28 ms |
| `search_by_embedding` top-10 | < 50 ms | ~1 ms |
| `search_skills` autocomplete | < 50 ms | < 1 ms |

WASM-release typically lands within 2-3× of native release for tight numerics; all three budgets carry comfortable headroom. See `perf_budgets_at_10k_nodes` in `runtime.rs` for the regression test.

### JS API surface

A `wasm_bindgen`-decorated wrapper (`SkillGraphRuntimeJs`) exposes:

- `SkillGraphRuntime.fromSnapshot(Uint8Array)` — async constructor.
- `runtime.searchSkills(query, top_k)` — substring autocomplete.
- `runtime.searchByEmbedding(query: Float32Array, top_k)` — vector search for callers that already hold an embedding (forge-jsxn).

Results are JSON-encoded strings to keep the WASM↔JS boundary simple. forge-5x2h owns the polished JS API; this is the minimum forge-afyg owes downstream consumers.

## Purpose

Taxonomy, similarity, co-occurrence, normalization, extraction substrate, alignment traversal. This is the backbone graph — all other graphs connect through it.

## Nodes

Logical model:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `canonical_name` | string | Authoritative name ("Kubernetes") |
| `aliases` | string[] | Variant names (["K8s", "kube", "k8s"]) |
| `category` | enum | Skill category (language, framework, platform, methodology, etc.) |
| `description` | text | Optional description for disambiguation |
| `level_descriptors` | JSON | How to interpret years/expertise for this skill |
| `embedding` | Float32Array | 384-dim vector (MiniLM), with embedding_model_version tag |
| `confidence` | float | How well-established in the corpus (0.0-1.0) |
| `source` | enum | `seed` / `extracted` / `curated` / `user-created` |
| `legacy_skill_id` | UUID | Bridge to the pre-graph `skills` table (nullable, populated by forge-e2js migration) |

Implemented DDL (`skill_graph_nodes`):

```sql
CREATE TABLE skill_graph_nodes (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),
  canonical_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'other' REFERENCES skill_categories(slug),
  description TEXT,
  aliases TEXT NOT NULL DEFAULT '[]',          -- JSON array, app-validated
  level_descriptors TEXT,                       -- JSON object, app-validated
  embedding BLOB,                               -- Float32Array packed (384 × 4 = 1536 bytes for MiniLM)
  embedding_model_version TEXT,                 -- e.g., "all-MiniLM-L6-v2@v1"
  confidence REAL NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL DEFAULT 'extracted' CHECK (source IN (
    'seed', 'extracted', 'curated', 'user-created'
  )),
  legacy_skill_id TEXT REFERENCES skills(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_skill_graph_nodes_category    ON skill_graph_nodes(category);
CREATE INDEX idx_skill_graph_nodes_source      ON skill_graph_nodes(source);
CREATE INDEX idx_skill_graph_nodes_legacy_id   ON skill_graph_nodes(legacy_skill_id);
```

Schema notes:
- **STRICT mode + standard SQLite types only** so the same DDL runs unchanged in wa-sqlite (browser/OPFS), rusqlite (server SQLite), and Cloudflare D1. JSON-shaped columns are stored as `TEXT` and validated at the application layer — STRICT forbids the non-standard `JSON` column type.
- **`category` reuses `skill_categories(slug)`** (added in migration 044) to prevent taxonomy divergence between the legacy `skills` table and the graph nodes.
- **`embedding_model_version`** is a free-form tag for now. A model_versions lookup table can be added later if needed without changing this schema.
- **`legacy_skill_id`** is the dual-schema bridge during the migration period (forge-e2js); rows created from extraction or seeding can leave it `NULL`.

## Edges (typed)

Logical model:

| Type | Semantics | Alignment score | Example |
|------|-----------|----------------|---------|
| `alias-of` | Identity — same skill | 1.0 | K8s → Kubernetes |
| `parent-of` | Hierarchy — parent covers child | 0.5 (broad match) | Container Orchestration → Kubernetes |
| `child-of` | Hierarchy — more specific instance | 0.9 (strong match) | Kubernetes → Container Orchestration |
| `prerequisite` | Ordering — needed before | informational | Docker → Kubernetes |
| `related-to` | Lateral — similar purpose, different tool | 0.4 (sibling match) | Terraform → Ansible |
| `co-occurs` | Statistical — frequently appear together | 0.3 (weak signal) | Kubernetes → Helm |
| `platform-for` | Contextual — X-on-Y | informational | AWS → EKS |

Implemented DDL (`skill_graph_edges`):

```sql
CREATE TABLE skill_graph_edges (
  source_id TEXT NOT NULL REFERENCES skill_graph_nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES skill_graph_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN (
    'alias-of', 'parent-of', 'child-of',
    'prerequisite', 'related-to', 'co-occurs', 'platform-for'
  )),
  weight REAL NOT NULL DEFAULT 1.0,
  confidence REAL NOT NULL DEFAULT 1.0,
  temporal_data TEXT,                           -- JSON, used for co-occurs windows
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  PRIMARY KEY (source_id, target_id, edge_type),
  CHECK (source_id <> target_id)
) STRICT;

CREATE INDEX idx_skill_graph_edges_source ON skill_graph_edges(source_id, edge_type);
CREATE INDEX idx_skill_graph_edges_target ON skill_graph_edges(target_id, edge_type);
CREATE INDEX idx_skill_graph_edges_type   ON skill_graph_edges(edge_type);
```

Edge schema notes:
- **Composite PK `(source_id, target_id, edge_type)`** prevents duplicate edges of the same type between the same two nodes, while still allowing a pair to hold multiple edges of *different* types (e.g., `parent-of` + `prerequisite`).
- **Self-loops are rejected** by `CHECK (source_id <> target_id)` — none of the seven edge types are meaningful from a node to itself.
- **`weight` vs `confidence`**: `weight` is the strength of the relationship (most recent window for `co-occurs`, 1.0 for hierarchy); `confidence` is provenance signal (curated edges score higher than statistical ones).
- **Cascade on node deletion** keeps the graph consistent without application-level cleanup. Verified by the SDK migration test suite.

## Temporal Metadata

Co-occurrence edges carry time-windowed weights for job market trend analysis:

```
co-occurs edge: Terraform → Kubernetes
  weights: [
    { window: "2025-Q3", weight: 0.85, jd_count: 120 },
    { window: "2025-Q4", weight: 0.80, jd_count: 135 },
    { window: "2026-Q1", weight: 0.75, jd_count: 148 }
  ]
```

This enables job market epistemology queries without retaining JD text. See [computed.md](computed.md) for the aggregate statistics model.

## Scale

- Current: ~200 skills
- Target: 10k+ (seeded from ESCO + O*NET, grown from usage)
- At 10k: snapshot ~20MB (embeddings 15MB + graph 500KB + HNSW index 5MB)

## Connections to Other Graphs

- **→ Alignment Graph:** provides typed traversal substrate for match scoring
- **→ Extraction Pipeline:** provides HNSW index + alias lookup + adjacency list for candidate matching
- **→ Domain/Archetype Graph:** skill nodes are the leaves that archetype/domain nodes cluster
- **→ Career Target Graph:** skill overlap between aggregate experience and archetype expectations
- **→ Certification Graph:** certs validate specific skills at specific levels
- **→ Organization Graph:** industry context disambiguates skill meaning during extraction

## Curation

See Epic forge-0e9z (Skill Graph Curation & Growth) for seeding strategy, LLM-assisted relationship proposals, and the human review workflow.
