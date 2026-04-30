//! Test fixtures shared across alignment tests. Not gated on a feature flag
//! because `mod.rs` declares it `#[cfg(test)]`.

use forge_core::types::skill_graph::{
    EdgeType, NodeSource, SkillGraphSnapshot, SkillNode, SnapshotEdge, SnapshotNode,
};
use forge_core::ForgeError;

use super::embedding_nn::EmbeddingNearestNeighbor;

// NOTE: EmbeddingNearestNeighbor doesn't exist yet (Task 6 creates it). For
// Task 5, we define the trait LOCALLY here as a placeholder so this file
// compiles. Task 6 will move the trait to embedding_nn.rs and we'll update
// this file's `use` to point at it.

/// Build a tiny synthetic snapshot covering every traversal needed by the
/// match-type tests. Nodes:
///
/// - "kubernetes" — parent "container-orch" (via parent-of edge from
///   container-orch → kubernetes), child "k3s" (via child-of from
///   kubernetes → k3s), sibling "docker-swarm" (via related-to),
///   alias "k8s" (via AliasOf edge).
/// - "container-orch" — parent of "kubernetes" via ParentOf.
/// - "k3s" — child of "kubernetes" via ChildOf.
/// - "docker-swarm" — related-to "kubernetes".
/// - "k8s" — alias of "kubernetes" via AliasOf edge (a separate canonical node).
/// - "terraform" — related-to "pulumi".
/// - "pulumi" — for sibling tests with terraform.
pub fn tiny_graph() -> SkillGraphSnapshot {
    let nodes = vec![
        snapshot_node("kubernetes", "Kubernetes", &[]),
        snapshot_node("container-orch", "Container Orchestration", &[]),
        snapshot_node("k3s", "K3s", &[]),
        snapshot_node("docker-swarm", "Docker Swarm", &[]),
        snapshot_node("k8s", "K8s", &[]),
        snapshot_node("terraform", "Terraform", &[]),
        snapshot_node("pulumi", "Pulumi", &[]),
    ];
    let edges = vec![
        // AliasOf edges link two canonical nodes (both must be real graph nodes).
        edge("kubernetes", "k8s", EdgeType::AliasOf),
        edge("container-orch", "kubernetes", EdgeType::ParentOf),
        edge("k3s", "kubernetes", EdgeType::ChildOf),
        edge("kubernetes", "docker-swarm", EdgeType::RelatedTo),
        edge("terraform", "pulumi", EdgeType::RelatedTo),
    ];
    SkillGraphSnapshot::structural_only(
        "test-snapshot-1".to_string(),
        "2026-04-28T00:00:00Z".to_string(),
        nodes,
        edges,
        Vec::new(), // market_stats empty
    )
}

fn snapshot_node(id: &str, canonical_name: &str, aliases: &[&str]) -> SnapshotNode {
    SnapshotNode {
        id: id.into(),
        canonical_name: canonical_name.into(),
        category: "general".into(),
        aliases: aliases.iter().map(|s| (*s).to_string()).collect(),
        source: NodeSource::Curated,
        confidence: 1.0,
    }
}

fn edge(source: &str, target: &str, edge_type: EdgeType) -> SnapshotEdge {
    SnapshotEdge {
        source_id: source.into(),
        target_id: target.into(),
        edge_type,
        weight: 1.0,
        confidence: 1.0,
        temporal_data: None,
    }
}

/// Encode the tiny graph to bytes for `SkillGraphRuntime::from_snapshot`.
pub fn tiny_graph_bytes() -> Vec<u8> {
    tiny_graph()
        .encode()
        .expect("tiny_graph must encode cleanly")
}

/// Materialize a SkillNode from a SnapshotNode in the tiny graph by id.
/// Returns None if the id isn't in the snapshot. Defaults the heavy fields
/// (description, level_descriptors, embedding, etc.) to None / empty,
/// matching how SkillGraphRuntime reconstructs SkillNodes from
/// SnapshotNodes (see crates/forge-wasm/src/skill_graph/runtime.rs).
pub fn find_node_by_id(snap: &SkillGraphSnapshot, id: &str) -> Option<SkillNode> {
    let node = snap.header.nodes.iter().find(|n| n.id == id)?;
    Some(SkillNode {
        id: node.id.clone(),
        canonical_name: node.canonical_name.clone(),
        category: node.category.clone(),
        description: None,
        aliases: node.aliases.clone(),
        level_descriptors: None,
        embedding: None,
        embedding_model_version: None,
        confidence: node.confidence,
        source: node.source,
        legacy_skill_id: None,
        created_at: String::new(),
        updated_at: String::new(),
    })
}

/// Mock impl of `EmbeddingNearestNeighbor` returning canned `(SkillNode,
/// similarity)` results. Tests construct with `MockEmbeddingNN::with(...)`
/// or `MockEmbeddingNN::empty()`.
pub struct MockEmbeddingNN {
    canned: Vec<(SkillNode, f32)>,
}

impl MockEmbeddingNN {
    pub fn empty() -> Self {
        Self { canned: vec![] }
    }
    pub fn with(canned: Vec<(SkillNode, f32)>) -> Self {
        Self { canned }
    }
}

impl EmbeddingNearestNeighbor for MockEmbeddingNN {
    fn search_by_embedding(
        &self,
        _query: &[f32],
        top_k: usize,
    ) -> Result<Vec<(SkillNode, f32)>, ForgeError> {
        Ok(self.canned.iter().take(top_k).cloned().collect())
    }
}

/// Build a synthetic snapshot with `node_count` nodes named `skill-0`,
/// `skill-1`, … and a sparse set of edges so the graph is non-trivial:
///
/// - Every 10 nodes form a parent chain (skill-0 → skill-10 → skill-20 …
///   via `ParentOf` outgoing from the lower-indexed node).
/// - Adjacent nodes within each chain group are siblings (`RelatedTo`).
///
/// Used by the alignment perf regression test.
pub fn build_large_graph_bytes(node_count: usize) -> Vec<u8> {
    let nodes: Vec<SnapshotNode> = (0..node_count)
        .map(|i| SnapshotNode {
            id: format!("skill-{i}"),
            canonical_name: format!("Skill {i}"),
            category: "general".into(),
            aliases: vec![],
            source: NodeSource::Curated,
            confidence: 1.0,
        })
        .collect();
    let mut edges: Vec<SnapshotEdge> = Vec::new();
    for i in 0..node_count {
        // ParentOf chain along multiples of 10.
        if i % 10 == 0 && i + 10 < node_count {
            edges.push(SnapshotEdge {
                source_id: format!("skill-{i}"),
                target_id: format!("skill-{}", i + 10),
                edge_type: EdgeType::ParentOf,
                weight: 1.0,
                confidence: 1.0,
                temporal_data: None,
            });
        }
        // RelatedTo sibling between consecutive nodes within a chain group.
        if i + 1 < node_count && (i + 1) % 10 != 0 {
            edges.push(SnapshotEdge {
                source_id: format!("skill-{i}"),
                target_id: format!("skill-{}", i + 1),
                edge_type: EdgeType::RelatedTo,
                weight: 0.5,
                confidence: 1.0,
                temporal_data: None,
            });
        }
    }
    SkillGraphSnapshot::structural_only(
        "perf-test-snapshot".to_string(),
        "2026-04-28T00:00:00Z".to_string(),
        nodes,
        edges,
        Vec::new(),
    )
    .encode()
    .expect("large graph must encode")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tiny_graph_has_seven_nodes_and_five_edges() {
        let snap = tiny_graph();
        assert_eq!(snap.header.nodes.len(), 7);
        assert_eq!(snap.header.edges.len(), 5);
    }

    #[test]
    fn tiny_graph_encodes_decodes() {
        let bytes = tiny_graph_bytes();
        assert!(!bytes.is_empty(), "encoded snapshot must have content");
        // Decode round-trip is exercised by SkillGraphRuntime tests in skill_graph/runtime.rs.
    }

    #[test]
    fn find_node_by_id_materializes_skill_node() {
        let snap = tiny_graph();
        let kube = find_node_by_id(&snap, "kubernetes").expect("kubernetes must exist");
        assert_eq!(kube.id, "kubernetes");
        assert_eq!(kube.canonical_name, "Kubernetes");
        assert!(kube.aliases.is_empty());
        assert!(kube.description.is_none());
        assert!(kube.embedding.is_none());
    }

    #[test]
    fn find_node_by_id_returns_none_for_missing() {
        let snap = tiny_graph();
        assert!(find_node_by_id(&snap, "does-not-exist").is_none());
    }

    #[test]
    fn mock_embedding_nn_returns_canned_results() {
        let snap = tiny_graph();
        let kube = find_node_by_id(&snap, "kubernetes").unwrap();
        let nn = MockEmbeddingNN::with(vec![(kube, 0.92)]);
        let hits = nn.search_by_embedding(&[0.0_f32; 384], 5).unwrap();
        assert_eq!(hits.len(), 1);
        assert!((hits[0].1 - 0.92).abs() < 1e-6);
    }

    #[test]
    fn mock_empty_returns_empty_vec() {
        let nn = MockEmbeddingNN::empty();
        let hits = nn.search_by_embedding(&[0.0; 384], 10).unwrap();
        assert!(hits.is_empty());
    }
}
