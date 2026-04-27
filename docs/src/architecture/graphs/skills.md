# Skill Graph

> Type: Persistent, curated
> Epic: forge-ucc2 (Skill Graph Data Model & Storage)
> Schema: implemented in migration `052_skill_graph_schema.sql` (forge-7rd7)
> Status: Schema landed; migration of legacy skills (forge-e2js), traversal API (forge-8xjh), and snapshot format (forge-ubxb) in progress.

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
