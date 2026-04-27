-- Forge Resume Builder — Skill Graph Schema (forge-7rd7)
-- Migration: 052_skill_graph_schema
-- Date: 2026-04-27
--
-- Foundational schema for the typed skill graph (Epic forge-ucc2). Adds two
-- new tables alongside the existing `skills` lookup table:
--
--   skill_graph_nodes — canonical skill entries with aliases, level descriptors,
--                       embeddings, and provenance (seed/extracted/curated/user).
--   skill_graph_edges — typed relationships between nodes (alias-of, parent-of,
--                       child-of, prerequisite, related-to, co-occurs,
--                       platform-for) with weights, confidence, and optional
--                       temporal data (used for co-occurs windowed weights).
--
-- Migration of existing `skills` rows into `skill_graph_nodes` is handled in a
-- separate task (forge-e2js). This migration only creates the schema; the
-- existing skills table remains untouched and operational. A nullable
-- `legacy_skill_id` FK on the new node table provides the bridge that the
-- migration task will populate.
--
-- Type compatibility: STRICT mode tables, standard SQLite types only
-- (TEXT/INTEGER/REAL/BLOB) so the same DDL runs unchanged in wa-sqlite (browser
-- via OPFS), rusqlite (server SQLite), and Cloudflare D1.
--
-- JSON-shaped columns (aliases, level_descriptors, temporal_data) are stored as
-- TEXT. Validation lives at the application layer; STRICT mode forbids the
-- non-standard JSON column type.

-- ============================================================================
-- skill_graph_nodes
-- ============================================================================

CREATE TABLE skill_graph_nodes (
  id TEXT PRIMARY KEY CHECK(typeof(id) = 'text' AND length(id) = 36),

  -- Authoritative display name. Unique to enforce single canonical entry per
  -- skill concept (variant spellings live in `aliases` or as alias-of edges).
  canonical_name TEXT NOT NULL UNIQUE,

  -- Reuses the existing skill_categories lookup table (created in
  -- migration 044) to avoid taxonomy divergence between the legacy `skills`
  -- table and the new graph nodes.
  category TEXT NOT NULL DEFAULT 'other' REFERENCES skill_categories(slug),

  -- Optional disambiguating description ("Apache Spark" vs "Spark NLP").
  description TEXT,

  -- JSON array of variant strings stored on the node for fast UI access:
  -- ["K8s", "kube", "k8s"]. Exact-match alias lookups go through the
  -- application layer's normalized index. Authoritative cross-canonical
  -- aliasing uses `alias-of` edges instead.
  aliases TEXT NOT NULL DEFAULT '[]',

  -- JSON object describing how to interpret years/expertise levels for this
  -- skill (e.g., { "junior": "<2y", "senior": ">=5y", "ladders": [...] }).
  level_descriptors TEXT,

  -- Float32Array (384-dim MiniLM by default) packed as raw bytes.
  -- 384 floats × 4 bytes = 1536 bytes per row.
  embedding BLOB,

  -- String identifier of the embedding model that produced `embedding`
  -- (e.g., "all-MiniLM-L6-v2@v1"). Plain TEXT for now — a model_versions
  -- lookup table can be added later if needed.
  embedding_model_version TEXT,

  -- 0.0–1.0: how well-established this skill is in the corpus.
  confidence REAL NOT NULL DEFAULT 1.0,

  -- Provenance: where this node came from.
  source TEXT NOT NULL DEFAULT 'extracted' CHECK (source IN (
    'seed', 'extracted', 'curated', 'user-created'
  )),

  -- Bridge to the legacy `skills` table during the dual-schema period.
  -- Populated by migration forge-e2js. Nullable so new nodes that don't
  -- correspond to a legacy skill row can exist freely.
  legacy_skill_id TEXT REFERENCES skills(id) ON DELETE SET NULL,

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX idx_skill_graph_nodes_category    ON skill_graph_nodes(category);
CREATE INDEX idx_skill_graph_nodes_source      ON skill_graph_nodes(source);
CREATE INDEX idx_skill_graph_nodes_legacy_id   ON skill_graph_nodes(legacy_skill_id);

-- ============================================================================
-- skill_graph_edges
-- ============================================================================

CREATE TABLE skill_graph_edges (
  source_id TEXT NOT NULL REFERENCES skill_graph_nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES skill_graph_nodes(id) ON DELETE CASCADE,

  -- Edge type vocabulary. Numeric semantics for alignment scoring live in the
  -- alignment engine (Epic forge-etam), not in the schema:
  --   alias-of      identity (same skill)
  --   parent-of     this node is a parent of target (target is more specific)
  --   child-of      this node is a child of target (target is more general)
  --   prerequisite  this node is needed before target
  --   related-to    lateral similarity (different tool, similar purpose)
  --   co-occurs     statistical co-occurrence in the corpus
  --   platform-for  contextual host/platform relationship
  edge_type TEXT NOT NULL CHECK (edge_type IN (
    'alias-of', 'parent-of', 'child-of',
    'prerequisite', 'related-to', 'co-occurs', 'platform-for'
  )),

  -- 0.0–1.0 strength of the relationship. Semantics vary by edge type:
  -- co-occurs uses the most recent window weight, hierarchy edges use 1.0.
  weight REAL NOT NULL DEFAULT 1.0,

  -- 0.0–1.0 confidence in the edge itself (provenance signal, not strength).
  confidence REAL NOT NULL DEFAULT 1.0,

  -- JSON array of windowed measurements, used primarily for co-occurs:
  --   [{ "window": "2026-Q1", "weight": 0.75, "jd_count": 148 }, ...]
  -- NULL for non-temporal edges.
  temporal_data TEXT,

  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  -- Composite key prevents duplicate edges of the same type between two nodes.
  -- A pair can still hold multiple edges of different types
  -- (e.g., parent-of AND prerequisite).
  PRIMARY KEY (source_id, target_id, edge_type),

  -- Self-loops are nonsensical for every edge type in the vocabulary.
  CHECK (source_id <> target_id)
) STRICT;

-- Traversal indexes. The composite (col, edge_type) form lets typed traversal
-- queries (e.g., "all children of X") use the index directly.
CREATE INDEX idx_skill_graph_edges_source ON skill_graph_edges(source_id, edge_type);
CREATE INDEX idx_skill_graph_edges_target ON skill_graph_edges(target_id, edge_type);
CREATE INDEX idx_skill_graph_edges_type   ON skill_graph_edges(edge_type);
