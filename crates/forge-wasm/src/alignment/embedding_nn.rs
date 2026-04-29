//! Trait abstraction for embedding-based nearest-neighbor search.
//!
//! `SkillGraphRuntime` impl mirrors its inherent `search_by_embedding`
//! method exactly. Tests use `super::test_fixtures::MockEmbeddingNN`.

use forge_core::types::skill_graph::SkillNode;
use forge_core::ForgeError;

use crate::skill_graph::SkillGraphRuntime;

pub trait EmbeddingNearestNeighbor {
    /// Return up to `top_k` nearest neighbors of `query`, sorted descending
    /// by cosine similarity (higher = closer).
    fn search_by_embedding(
        &self,
        query: &[f32],
        top_k: usize,
    ) -> Result<Vec<(SkillNode, f32)>, ForgeError>;
}

impl EmbeddingNearestNeighbor for SkillGraphRuntime {
    fn search_by_embedding(
        &self,
        query: &[f32],
        top_k: usize,
    ) -> Result<Vec<(SkillNode, f32)>, ForgeError> {
        Ok(SkillGraphRuntime::search_by_embedding(self, query, top_k))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::alignment::test_fixtures::{tiny_graph_bytes, MockEmbeddingNN};

    #[test]
    fn skill_graph_runtime_satisfies_trait() {
        let bytes = tiny_graph_bytes();
        let runtime = SkillGraphRuntime::from_snapshot(&bytes).expect("build runtime");
        // Trait-object dispatch must compile.
        let _: &dyn EmbeddingNearestNeighbor = &runtime;
    }

    #[test]
    fn skill_graph_runtime_returns_empty_when_no_embeddings() {
        // tiny_graph() uses structural_only, so the snapshot has no embedding payload.
        // search_by_embedding should return Ok(empty), not Err.
        let bytes = tiny_graph_bytes();
        let runtime = SkillGraphRuntime::from_snapshot(&bytes).expect("build runtime");
        let result = EmbeddingNearestNeighbor::search_by_embedding(&runtime, &[0.0_f32; 384], 5)
            .expect("call must succeed");
        assert!(
            result.is_empty(),
            "structural-only snapshot must produce empty embedding search results"
        );
    }

    #[test]
    fn mock_satisfies_trait() {
        let mock = MockEmbeddingNN::empty();
        let _: &dyn EmbeddingNearestNeighbor = &mock;
        let result = mock.search_by_embedding(&[0.0; 384], 10).unwrap();
        assert!(result.is_empty());
    }
}
