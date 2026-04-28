-- Forge Resume Builder — Skill Graph Initial Population (forge-e2js)
-- Migration: 053_skill_graph_initial_population
-- Date: 2026-04-27
--
-- Populates the empty skill_graph_nodes / skill_graph_edges tables (created in
-- migration 052) from existing data:
--
--   1. One skill_graph_node per row in `skills`. The node REUSES the legacy
--      skill UUID as its own id, which means `legacy_skill_id = id` and the
--      junction tables (bullet_skills, certification_skills, source_skills,
--      summary_skills, perspective_skills, resume_skills, job_description_skills,
--      skill_domains) can be JOINed naturally to either table during the
--      transition. The legacy `skills` table is left untouched and operational.
--
--   2. One "category root" skill_graph_node per row in `skill_categories`. These
--      synthetic nodes anchor the hierarchy ("Languages" parent of "Python",
--      "Rust", etc.). Category root canonical_name uses the display_name; their
--      own category column is set to 'concept' since categories themselves are
--      conceptual groupings.
--
--   3. One `parent-of` edge per (category_root → skill_node) pair, derived from
--      the `skills.category` FK to `skill_categories.slug`. Only `parent-of` is
--      stored; `find_parents` queries by target_id rather than mirroring with
--      `child-of` rows. This keeps the populated graph consistent and avoids
--      double-storage. User-curated `child-of` edges remain valid in the
--      vocabulary for cases where a node is conceptually a child of multiple
--      anchors with different semantics.
--
-- Alias-of edges: the legacy `skills` schema has no alias data (no aliases
-- column), so no alias-of edges are emitted by this migration. Future work
-- (forge-czgq extraction pipeline) will populate alias-of edges as duplicates
-- are discovered.
--
-- This migration is purely additive — no rows in `skills` or any junction
-- table are modified, so all existing FKs continue to resolve.

-- ============================================================================
-- Step 1: Materialize one graph node per existing skill.
-- ============================================================================
--
-- legacy_skill_id is set to the same UUID, marking these nodes as migrated.
-- source = 'seed' since these were curated/seeded historically.
-- aliases defaults to '[]' (no alias data in the legacy schema).

INSERT INTO skill_graph_nodes (
  id, canonical_name, category, source, legacy_skill_id
)
SELECT
  s.id,
  s.name,
  s.category,
  'seed',
  s.id
FROM skills s
WHERE NOT EXISTS (
  -- Idempotent: a re-run on a partially-populated graph is a no-op for skills
  -- already mirrored. Match on legacy_skill_id since canonical_name UNIQUE
  -- could legitimately collide across both tables.
  SELECT 1 FROM skill_graph_nodes n WHERE n.legacy_skill_id = s.id
);

-- ============================================================================
-- Step 2: Materialize one synthetic "category root" graph node per skill_categories row.
-- ============================================================================
--
-- These anchor the hierarchy. They get fresh UUIDs (no legacy_skill_id) and
-- category = 'concept' since they describe groupings, not concrete skills.
-- canonical_name uses the human-readable display_name ("Languages", not "language")
-- so traversal output reads cleanly. We tag them via the description column so
-- they can be filtered out later if needed (e.g., "WHERE description = 'category-root: language'").

INSERT INTO skill_graph_nodes (
  id, canonical_name, category, description, source
)
SELECT
  -- Same v4-shaped UUID generator pattern used by migration 044.
  lower(
    hex(randomblob(4)) || '-' ||
    hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' ||
    hex(randomblob(6))
  ),
  c.display_name,
  'concept',
  'category-root:' || c.slug,
  'seed'
FROM skill_categories c
WHERE NOT EXISTS (
  -- Idempotent: skip categories that already have a root node.
  SELECT 1 FROM skill_graph_nodes n
  WHERE n.description = 'category-root:' || c.slug
);

-- ============================================================================
-- Step 3: Emit parent-of edges from category roots to skill nodes.
-- ============================================================================
--
-- weight = 1.0 (full hierarchy edge), confidence = 1.0 (deterministic from
-- legacy schema). INSERT OR IGNORE makes this idempotent against the
-- composite (source_id, target_id, edge_type) PK.

INSERT OR IGNORE INTO skill_graph_edges (
  source_id, target_id, edge_type, weight, confidence
)
SELECT
  root.id,
  node.id,
  'parent-of',
  1.0,
  1.0
FROM skill_graph_nodes node
JOIN skill_categories sc       ON sc.slug = node.category
JOIN skill_graph_nodes root    ON root.description = 'category-root:' || sc.slug
WHERE node.legacy_skill_id IS NOT NULL  -- only real skills, not other category roots
  AND node.id <> root.id;               -- defensive: never self-loop
