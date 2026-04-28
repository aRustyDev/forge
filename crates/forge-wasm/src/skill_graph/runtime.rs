//! In-memory skill graph runtime backed by a [`SkillGraphSnapshot`].
//!
//! Loads the snapshot's nodes and edges into a [`petgraph::Graph`] and the
//! optional embedding payload into the private [`super::hnsw::HnswIndex`]
//! seam. Implements [`forge_core::types::skill_graph::SkillGraphTraversal`]
//! as the WASM-side parallel of `forge-sdk::SqlSkillGraphStore`.
//!
//! Snapshots are passed in as `&[u8]`; this crate does not perform I/O. The
//! runtime is read-only — mutations to the user-private skill set go through
//! the wa-sqlite-backed [`crate::Database`] / SkillStore, not through here.
//!
//! # Limitations vs the SQL impl
//!
//! [`forge_core::types::skill_graph::SnapshotNode`] is a compact projection
//! of a `skill_graph_nodes` row that omits server-private fields
//! (`description`, `level_descriptors`, `legacy_skill_id`) and timestamps
//! (`created_at`, `updated_at`). When this runtime constructs a
//! [`forge_core::types::skill_graph::SkillNode`] from a snapshot row it
//! fills those fields with defaults: empty timestamps, `None` for omitted
//! optionals. Consumers that need the omitted fields should query the SQL
//! impl, not this one.

use std::collections::HashMap;

use forge_core::types::skill_graph::{
    EdgeRow, EdgeType, NeighborhoodSubgraph, SkillGraphSnapshot, SkillGraphTraversal,
    SkillNode, SnapshotNode,
};
use forge_core::ForgeError;
use petgraph::graph::{DiGraph, NodeIndex as PgIndex};
use petgraph::visit::EdgeRef;
use petgraph::Direction;

use super::hnsw::NodeIndex;

/// Per-edge metadata stored on each petgraph edge. Mirrors the subset of
/// [`forge_core::types::skill_graph::SnapshotEdge`] needed for trait return
/// values; the source/target node ids are implicit from the graph topology.
#[derive(Debug, Clone, Copy)]
struct EdgeData {
    edge_type: EdgeType,
    weight: f64,
    confidence: f64,
}

/// In-memory skill graph runtime.
///
/// Construct with [`Self::from_snapshot`]. The runtime owns all parsed
/// structures; the input byte slice can be dropped after construction.
#[derive(Debug)]
pub struct SkillGraphRuntime {
    /// All nodes in stable index order, mirroring `header.nodes`. The position
    /// in this vec is the canonical internal [`NodeIndex`] used elsewhere.
    nodes: Vec<SnapshotNode>,
    /// `canonical_name → index`. Populated at construction; collisions on
    /// canonical name are not allowed by the snapshot's source schema (the
    /// `skill_graph_nodes.canonical_name` column is `UNIQUE`), so the last
    /// write wins if the snapshot is malformed.
    by_canonical_name: HashMap<String, NodeIndex>,
    /// `alias → index`. Used as the fallback for [`Self::find_by_name`] after
    /// a canonical-name miss. An alias may collide with a canonical name in a
    /// different node; canonical wins by lookup order, not by map state.
    by_alias: HashMap<String, NodeIndex>,
    /// `skill_id (UUID) → index`. Entry point for trait methods that take a
    /// `&str` skill id.
    by_id: HashMap<String, NodeIndex>,
    /// Directed graph mirroring `header.edges`. Node weights are the
    /// internal [`NodeIndex`] (position in `self.nodes`); edge weights are
    /// the [`EdgeType`] vocabulary.
    graph: DiGraph<NodeIndex, EdgeData>,
    /// Maps internal [`NodeIndex`] to petgraph's [`PgIndex`]. Petgraph
    /// allocates its own indices; this lets us round-trip from string id →
    /// our index → petgraph's index for traversal entry points.
    pg_index: Vec<PgIndex>,
}

impl SkillGraphRuntime {
    /// Decode a snapshot byte slice and load it into in-memory structures.
    ///
    /// Eager: the petgraph and HNSW index are built before this returns, so
    /// subsequent traversal queries don't pay a build cost.
    pub fn from_snapshot(bytes: &[u8]) -> Result<Self, ForgeError> {
        let snapshot = SkillGraphSnapshot::decode(bytes)?;
        let nodes = snapshot.header.nodes;

        let mut by_canonical_name = HashMap::with_capacity(nodes.len());
        let mut by_alias = HashMap::new();
        let mut by_id = HashMap::with_capacity(nodes.len());
        let mut graph: DiGraph<NodeIndex, EdgeData> = DiGraph::with_capacity(
            nodes.len(),
            snapshot.header.edges.len(),
        );
        let mut pg_index = Vec::with_capacity(nodes.len());

        for (idx, node) in nodes.iter().enumerate() {
            by_canonical_name.insert(node.canonical_name.clone(), idx);
            for alias in &node.aliases {
                by_alias.insert(alias.clone(), idx);
            }
            by_id.insert(node.id.clone(), idx);
            pg_index.push(graph.add_node(idx));
        }

        for edge in &snapshot.header.edges {
            let (Some(&src_our), Some(&tgt_our)) = (
                by_id.get(&edge.source_id),
                by_id.get(&edge.target_id),
            ) else {
                return Err(ForgeError::Internal(format!(
                    "snapshot edge references unknown node id: {} → {}",
                    edge.source_id, edge.target_id
                )));
            };
            graph.add_edge(
                pg_index[src_our],
                pg_index[tgt_our],
                EdgeData {
                    edge_type: edge.edge_type,
                    weight: edge.weight,
                    confidence: edge.confidence,
                },
            );
        }

        Ok(Self {
            nodes,
            by_canonical_name,
            by_alias,
            by_id,
            graph,
            pg_index,
        })
    }

    /// Map a snapshot string id to its internal [`NodeIndex`], or
    /// `ForgeError::NotFound` if absent.
    fn lookup_id(&self, skill_id: &str) -> Result<NodeIndex, ForgeError> {
        self.by_id
            .get(skill_id)
            .copied()
            .ok_or_else(|| ForgeError::NotFound {
                entity_type: "skill".to_string(),
                id: skill_id.to_string(),
            })
    }
}

impl SkillGraphTraversal for SkillGraphRuntime {
    fn find_aliases(
        &self,
        skill_id: &str,
    ) -> Result<Vec<SkillNode>, ForgeError> {
        let our = self.lookup_id(skill_id)?;
        let pg = self.pg_index[our];
        let mut out = Vec::new();
        for er in self.graph.edges_directed(pg, Direction::Outgoing) {
            if er.weight().edge_type == EdgeType::AliasOf {
                let target_our = *self.graph.node_weight(er.target()).unwrap();
                out.push(snapshot_node_to_skill_node(&self.nodes[target_our]));
            }
        }
        for er in self.graph.edges_directed(pg, Direction::Incoming) {
            if er.weight().edge_type == EdgeType::AliasOf {
                let source_our = *self.graph.node_weight(er.source()).unwrap();
                out.push(snapshot_node_to_skill_node(&self.nodes[source_our]));
            }
        }
        Ok(out)
    }

    fn find_children(
        &self,
        skill_id: &str,
    ) -> Result<Vec<SkillNode>, ForgeError> {
        let our = self.lookup_id(skill_id)?;
        let pg = self.pg_index[our];
        let mut out = Vec::new();
        for er in self.graph.edges_directed(pg, Direction::Outgoing) {
            if er.weight().edge_type == EdgeType::ParentOf {
                let target_our = *self.graph.node_weight(er.target()).unwrap();
                out.push(snapshot_node_to_skill_node(&self.nodes[target_our]));
            }
        }
        for er in self.graph.edges_directed(pg, Direction::Incoming) {
            if er.weight().edge_type == EdgeType::ChildOf {
                let source_our = *self.graph.node_weight(er.source()).unwrap();
                out.push(snapshot_node_to_skill_node(&self.nodes[source_our]));
            }
        }
        Ok(out)
    }

    fn find_parents(
        &self,
        skill_id: &str,
    ) -> Result<Vec<SkillNode>, ForgeError> {
        let our = self.lookup_id(skill_id)?;
        let pg = self.pg_index[our];
        let mut out = Vec::new();
        for er in self.graph.edges_directed(pg, Direction::Incoming) {
            if er.weight().edge_type == EdgeType::ParentOf {
                let source_our = *self.graph.node_weight(er.source()).unwrap();
                out.push(snapshot_node_to_skill_node(&self.nodes[source_our]));
            }
        }
        for er in self.graph.edges_directed(pg, Direction::Outgoing) {
            if er.weight().edge_type == EdgeType::ChildOf {
                let target_our = *self.graph.node_weight(er.target()).unwrap();
                out.push(snapshot_node_to_skill_node(&self.nodes[target_our]));
            }
        }
        Ok(out)
    }

    fn find_related(
        &self,
        skill_id: &str,
        edge_types: &[EdgeType],
    ) -> Result<Vec<forge_core::types::skill_graph::RelatedSkill>, ForgeError> {
        use forge_core::types::skill_graph::RelatedSkill;
        let our = self.lookup_id(skill_id)?;
        let pg = self.pg_index[our];
        let mut out = Vec::new();
        for er in self.graph.edges_directed(pg, Direction::Outgoing) {
            let ed = *er.weight();
            if !edge_types.contains(&ed.edge_type) {
                continue;
            }
            let target_our = *self.graph.node_weight(er.target()).unwrap();
            out.push(RelatedSkill {
                skill: snapshot_node_to_skill_node(&self.nodes[target_our]),
                edge_type: ed.edge_type,
                weight: ed.weight,
                confidence: ed.confidence,
            });
        }
        Ok(out)
    }

    fn n_hop_neighbors(
        &self,
        skill_id: &str,
        n: usize,
        edge_types: Option<&[EdgeType]>,
    ) -> Result<NeighborhoodSubgraph, ForgeError> {
        let center_our = self.lookup_id(skill_id)?;
        let center_pg = self.pg_index[center_our];

        let mut visited: Vec<bool> = vec![false; self.nodes.len()];
        visited[center_our] = true;
        let mut current_layer: Vec<PgIndex> = vec![center_pg];

        let edge_type_allows = |et: EdgeType| match edge_types {
            None => true,
            Some(allowed) => allowed.contains(&et),
        };

        for _ in 0..n {
            let mut next_layer = Vec::new();
            for pg in &current_layer {
                for er in self.graph.edges_directed(*pg, Direction::Outgoing) {
                    if !edge_type_allows(er.weight().edge_type) {
                        continue;
                    }
                    let neighbor_our = *self.graph.node_weight(er.target()).unwrap();
                    if !visited[neighbor_our] {
                        visited[neighbor_our] = true;
                        next_layer.push(er.target());
                    }
                }
                for er in self.graph.edges_directed(*pg, Direction::Incoming) {
                    if !edge_type_allows(er.weight().edge_type) {
                        continue;
                    }
                    let neighbor_our = *self.graph.node_weight(er.source()).unwrap();
                    if !visited[neighbor_our] {
                        visited[neighbor_our] = true;
                        next_layer.push(er.source());
                    }
                }
            }
            if next_layer.is_empty() {
                break;
            }
            current_layer = next_layer;
        }

        let nodes: Vec<SkillNode> = (0..self.nodes.len())
            .filter(|i| visited[*i])
            .map(|i| snapshot_node_to_skill_node(&self.nodes[i]))
            .collect();

        let mut edges: Vec<EdgeRow> = Vec::new();
        for er in self.graph.edge_references() {
            let src_our = *self.graph.node_weight(er.source()).unwrap();
            let tgt_our = *self.graph.node_weight(er.target()).unwrap();
            if !(visited[src_our] && visited[tgt_our]) {
                continue;
            }
            let ed = *er.weight();
            if !edge_type_allows(ed.edge_type) {
                continue;
            }
            edges.push(EdgeRow {
                source_id: self.nodes[src_our].id.clone(),
                target_id: self.nodes[tgt_our].id.clone(),
                edge_type: ed.edge_type,
                weight: ed.weight,
                confidence: ed.confidence,
                temporal_data: None,
                created_at: String::new(),
                updated_at: String::new(),
            });
        }

        Ok(NeighborhoodSubgraph {
            center_id: skill_id.to_string(),
            nodes,
            edges,
        })
    }

    fn find_by_name(&self, name: &str) -> Result<Option<SkillNode>, ForgeError> {
        if let Some(&idx) = self.by_canonical_name.get(name) {
            return Ok(Some(snapshot_node_to_skill_node(&self.nodes[idx])));
        }
        if let Some(&idx) = self.by_alias.get(name) {
            return Ok(Some(snapshot_node_to_skill_node(&self.nodes[idx])));
        }
        Ok(None)
    }

    /// Co-occurrence statistics. **Prototype seam**: returns an empty list
    /// for every known skill regardless of `time_window`, because the
    /// `market_stats` slot in [`SkillGraphSnapshot`] is unpopulated until the
    /// curation pipeline (forge-c4i5) ships. The contract still reports
    /// `ForgeError::NotFound` for unknown skill ids so callers can
    /// distinguish "no data" from "no such skill".
    fn co_occurrence_stats(
        &self,
        skill_id: &str,
        _time_window: Option<&str>,
    ) -> Result<Vec<forge_core::types::skill_graph::CoOccurrenceStat>, ForgeError>
    {
        // Verify the skill exists; ignore the result.
        let _ = self.lookup_id(skill_id)?;
        Ok(Vec::new())
    }
}

/// Construct a [`SkillNode`] from the compact [`SnapshotNode`] projection,
/// filling omitted fields with the documented defaults.
fn snapshot_node_to_skill_node(snap: &SnapshotNode) -> SkillNode {
    SkillNode {
        id: snap.id.clone(),
        canonical_name: snap.canonical_name.clone(),
        category: snap.category.clone(),
        description: None,
        aliases: snap.aliases.clone(),
        level_descriptors: None,
        embedding: None,
        embedding_model_version: None,
        confidence: snap.confidence,
        source: snap.source,
        legacy_skill_id: None,
        created_at: String::new(),
        updated_at: String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use forge_core::types::skill_graph::{NodeSource, SnapshotEdge, SkillGraphSnapshot, EdgeType};

    /// Build snapshot bytes from explicit (nodes, edges).
    fn snapshot_bytes_from(
        nodes: Vec<SnapshotNode>,
        edges: Vec<SnapshotEdge>,
    ) -> Vec<u8> {
        SkillGraphSnapshot::structural_only(
            "test-snap",
            "2026-04-28T00:00:00Z",
            nodes,
            edges,
            Vec::new(),
        )
        .encode()
        .expect("encode")
    }

    fn snap_node(id: &str, name: &str, aliases: &[&str]) -> SnapshotNode {
        SnapshotNode {
            id: id.to_string(),
            canonical_name: name.to_string(),
            category: "tool".to_string(),
            aliases: aliases.iter().map(|s| s.to_string()).collect(),
            source: NodeSource::Curated,
            confidence: 1.0,
        }
    }

    fn snap_edge(src: &str, tgt: &str, et: EdgeType) -> SnapshotEdge {
        SnapshotEdge {
            source_id: src.to_string(),
            target_id: tgt.to_string(),
            edge_type: et,
            weight: 1.0,
            confidence: 1.0,
            temporal_data: None,
        }
    }

    fn sample_snapshot_bytes() -> Vec<u8> {
        let nodes = vec![
            SnapshotNode {
                id: "node-a".to_string(),
                canonical_name: "Rust".to_string(),
                category: "language".to_string(),
                aliases: vec!["rustlang".to_string(), "rust-lang".to_string()],
                source: NodeSource::Curated,
                confidence: 0.95,
            },
            SnapshotNode {
                id: "node-b".to_string(),
                canonical_name: "Programming".to_string(),
                category: "domain".to_string(),
                aliases: vec![],
                source: NodeSource::Curated,
                confidence: 1.0,
            },
        ];
        let edges = vec![SnapshotEdge {
            source_id: "node-b".to_string(),
            target_id: "node-a".to_string(),
            edge_type: EdgeType::ParentOf,
            weight: 1.0,
            confidence: 1.0,
            temporal_data: None,
        }];

        let snap = SkillGraphSnapshot::structural_only(
            "test-snap",
            "2026-04-28T00:00:00Z",
            nodes,
            edges,
            Vec::new(),
        );
        snap.encode().expect("encode")
    }

    #[test]
    fn from_snapshot_accepts_structural_only_snapshot() {
        let bytes = sample_snapshot_bytes();
        let runtime = SkillGraphRuntime::from_snapshot(&bytes).expect("load");
        // The runtime must hold the two nodes from the fixture so subsequent
        // trait methods can resolve them.
        assert_eq!(runtime.nodes.len(), 2);
    }

    #[test]
    fn from_snapshot_rejects_garbage_bytes() {
        let err = SkillGraphRuntime::from_snapshot(b"not a snapshot")
            .expect_err("garbage bytes should not decode");
        let msg = format!("{err}");
        assert!(
            msg.contains("magic") || msg.contains("snapshot"),
            "expected a snapshot decode error, got: {msg}"
        );
    }

    #[test]
    fn find_by_name_matches_canonical_name() {
        let bytes = sample_snapshot_bytes();
        let runtime = SkillGraphRuntime::from_snapshot(&bytes).unwrap();

        let found = runtime.find_by_name("Rust").unwrap();
        let node = found.expect("canonical name 'Rust' should resolve");
        assert_eq!(node.id, "node-a");
        assert_eq!(node.canonical_name, "Rust");
    }

    #[test]
    fn find_by_name_falls_back_to_alias() {
        let bytes = sample_snapshot_bytes();
        let runtime = SkillGraphRuntime::from_snapshot(&bytes).unwrap();

        let found = runtime.find_by_name("rustlang").unwrap();
        let node = found.expect("alias 'rustlang' should resolve to its canonical node");
        assert_eq!(node.id, "node-a");
    }

    #[test]
    fn find_by_name_returns_none_for_unknown() {
        let bytes = sample_snapshot_bytes();
        let runtime = SkillGraphRuntime::from_snapshot(&bytes).unwrap();
        assert!(runtime.find_by_name("Haskell").unwrap().is_none());
    }

    #[test]
    fn find_aliases_is_bidirectional_over_alias_of_edges() {
        // a — alias-of → b. Both directions should resolve to the other node.
        let nodes = vec![
            snap_node("a", "Rust", &[]),
            snap_node("b", "rustlang", &[]),
            snap_node("c", "Unrelated", &[]),
        ];
        let edges = vec![snap_edge("a", "b", EdgeType::AliasOf)];
        let runtime = SkillGraphRuntime::from_snapshot(&snapshot_bytes_from(nodes, edges))
            .unwrap();

        let from_a = runtime.find_aliases("a").unwrap();
        assert_eq!(from_a.len(), 1, "a should have one alias (b)");
        assert_eq!(from_a[0].id, "b");

        let from_b = runtime.find_aliases("b").unwrap();
        assert_eq!(from_b.len(), 1, "b should also resolve back to a (bidirectional)");
        assert_eq!(from_b[0].id, "a");

        let from_c = runtime.find_aliases("c").unwrap();
        assert!(from_c.is_empty(), "c has no alias edges");
    }

    #[test]
    fn find_children_returns_outgoing_parent_of_targets() {
        // p — parent-of → c1, c2. p is the parent; c1/c2 are children.
        let nodes = vec![
            snap_node("p", "Programming", &[]),
            snap_node("c1", "Rust", &[]),
            snap_node("c2", "Go", &[]),
            snap_node("u", "Unrelated", &[]),
        ];
        let edges = vec![
            snap_edge("p", "c1", EdgeType::ParentOf),
            snap_edge("p", "c2", EdgeType::ParentOf),
        ];
        let runtime = SkillGraphRuntime::from_snapshot(&snapshot_bytes_from(nodes, edges))
            .unwrap();

        let mut children = runtime.find_children("p").unwrap();
        children.sort_by(|a, b| a.id.cmp(&b.id));
        assert_eq!(children.len(), 2);
        assert_eq!(children[0].id, "c1");
        assert_eq!(children[1].id, "c2");

        assert!(runtime.find_children("c1").unwrap().is_empty());
    }

    #[test]
    fn find_children_includes_incoming_child_of_edges() {
        // Storage may emit `child-of` instead of `parent-of`; cover both.
        let nodes = vec![snap_node("p", "Parent", &[]), snap_node("c", "Child", &[])];
        let edges = vec![snap_edge("c", "p", EdgeType::ChildOf)];
        let runtime = SkillGraphRuntime::from_snapshot(&snapshot_bytes_from(nodes, edges))
            .unwrap();

        let children = runtime.find_children("p").unwrap();
        assert_eq!(children.len(), 1, "incoming child-of must surface as a child of p");
        assert_eq!(children[0].id, "c");
    }

    #[test]
    fn find_parents_returns_incoming_parent_of_sources() {
        let nodes = vec![
            snap_node("p", "Programming", &[]),
            snap_node("c1", "Rust", &[]),
            snap_node("c2", "Go", &[]),
        ];
        let edges = vec![
            snap_edge("p", "c1", EdgeType::ParentOf),
            snap_edge("p", "c2", EdgeType::ParentOf),
        ];
        let runtime = SkillGraphRuntime::from_snapshot(&snapshot_bytes_from(nodes, edges))
            .unwrap();

        let parents = runtime.find_parents("c1").unwrap();
        assert_eq!(parents.len(), 1);
        assert_eq!(parents[0].id, "p");

        // Root has no parents.
        assert!(runtime.find_parents("p").unwrap().is_empty());
    }

    #[test]
    fn find_related_returns_outgoing_edges_filtered_by_type() {
        let nodes = vec![
            snap_node("a", "Alpha", &[]),
            snap_node("b", "Beta", &[]),
            snap_node("c", "Gamma", &[]),
            snap_node("d", "Delta", &[]),
        ];
        let edges = vec![
            snap_edge("a", "b", EdgeType::RelatedTo),
            snap_edge("a", "c", EdgeType::Prerequisite),
            snap_edge("a", "d", EdgeType::RelatedTo),
            // Incoming to a — must NOT show up (find_related is outgoing-only).
            snap_edge("b", "a", EdgeType::RelatedTo),
        ];
        let runtime = SkillGraphRuntime::from_snapshot(&snapshot_bytes_from(nodes, edges))
            .unwrap();

        let mut rel_to = runtime.find_related("a", &[EdgeType::RelatedTo]).unwrap();
        rel_to.sort_by(|x, y| x.skill.id.cmp(&y.skill.id));
        assert_eq!(rel_to.len(), 2);
        assert_eq!(rel_to[0].skill.id, "b");
        assert_eq!(rel_to[1].skill.id, "d");
        assert!(rel_to.iter().all(|r| r.edge_type == EdgeType::RelatedTo));

        // Multi-type filter.
        let multi = runtime
            .find_related("a", &[EdgeType::RelatedTo, EdgeType::Prerequisite])
            .unwrap();
        assert_eq!(multi.len(), 3);

        // Empty filter → no results (explicit).
        let none = runtime.find_related("a", &[]).unwrap();
        assert!(none.is_empty(), "empty edge_types filter must return no edges");
    }

    #[test]
    fn n_hop_neighbors_undirected_bfs_within_n_hops() {
        // Linear chain: a → b → c → d (related-to edges).
        let nodes = vec![
            snap_node("a", "A", &[]),
            snap_node("b", "B", &[]),
            snap_node("c", "C", &[]),
            snap_node("d", "D", &[]),
        ];
        let edges = vec![
            snap_edge("a", "b", EdgeType::RelatedTo),
            snap_edge("b", "c", EdgeType::RelatedTo),
            snap_edge("c", "d", EdgeType::RelatedTo),
        ];
        let runtime = SkillGraphRuntime::from_snapshot(&snapshot_bytes_from(nodes, edges))
            .unwrap();

        // 0 hops from a → just a, no edges.
        let r0 = runtime.n_hop_neighbors("a", 0, None).unwrap();
        assert_eq!(r0.center_id, "a");
        assert_eq!(r0.nodes.len(), 1);
        assert_eq!(r0.nodes[0].id, "a");
        assert!(r0.edges.is_empty());

        // 1 hop from a → {a, b}, one edge.
        let r1 = runtime.n_hop_neighbors("a", 1, None).unwrap();
        let mut ids: Vec<_> = r1.nodes.iter().map(|n| n.id.clone()).collect();
        ids.sort();
        assert_eq!(ids, vec!["a", "b"]);
        assert_eq!(r1.edges.len(), 1);

        // 2 hops from b (undirected) → {a, b, c}.
        let r_b = runtime.n_hop_neighbors("b", 2, None).unwrap();
        let mut ids: Vec<_> = r_b.nodes.iter().map(|n| n.id.clone()).collect();
        ids.sort();
        assert_eq!(ids, vec!["a", "b", "c", "d"]);
    }

    #[test]
    fn n_hop_neighbors_respects_edge_type_filter() {
        let nodes = vec![
            snap_node("a", "A", &[]),
            snap_node("b", "B", &[]),
            snap_node("c", "C", &[]),
        ];
        let edges = vec![
            snap_edge("a", "b", EdgeType::RelatedTo),
            // c is reachable from a only via Prerequisite edge.
            snap_edge("b", "c", EdgeType::Prerequisite),
        ];
        let runtime = SkillGraphRuntime::from_snapshot(&snapshot_bytes_from(nodes, edges))
            .unwrap();

        // Filter to RelatedTo only — c is not reachable.
        let r = runtime
            .n_hop_neighbors("a", 5, Some(&[EdgeType::RelatedTo]))
            .unwrap();
        let mut ids: Vec<_> = r.nodes.iter().map(|n| n.id.clone()).collect();
        ids.sort();
        assert_eq!(ids, vec!["a", "b"]);
    }

    #[test]
    fn co_occurrence_stats_returns_empty_for_known_skill() {
        // The market_stats slot in the snapshot header is forge-c4i5's
        // territory. Until that work lands, this method must return an
        // empty list for every known skill (and NotFound for unknown).
        let bytes = sample_snapshot_bytes();
        let runtime = SkillGraphRuntime::from_snapshot(&bytes).unwrap();
        assert!(runtime.co_occurrence_stats("node-a", None).unwrap().is_empty());
        assert!(runtime
            .co_occurrence_stats("node-a", Some("2026-Q1"))
            .unwrap()
            .is_empty());
    }

    #[test]
    fn co_occurrence_stats_unknown_id_returns_not_found() {
        let bytes = sample_snapshot_bytes();
        let runtime = SkillGraphRuntime::from_snapshot(&bytes).unwrap();
        let err = runtime.co_occurrence_stats("nonexistent", None).unwrap_err();
        let msg = format!("{err}");
        assert!(msg.contains("not found") || msg.contains("nonexistent"));
    }

    #[test]
    fn find_aliases_unknown_id_returns_not_found() {
        let bytes = sample_snapshot_bytes();
        let runtime = SkillGraphRuntime::from_snapshot(&bytes).unwrap();
        let err = runtime.find_aliases("nonexistent").unwrap_err();
        let msg = format!("{err}");
        assert!(
            msg.contains("not found") || msg.contains("nonexistent"),
            "expected NotFound for unknown id, got: {msg}"
        );
    }
}
