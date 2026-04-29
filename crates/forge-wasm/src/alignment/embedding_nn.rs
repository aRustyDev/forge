//! Trait abstraction for embedding-based nearest-neighbor search.
//! Concrete `SkillGraphRuntime` impl lands in Task 6.

use forge_core::types::skill_graph::SkillNode;
use forge_core::ForgeError;

pub trait EmbeddingNearestNeighbor {
    /// Return up to `top_k` nearest neighbors of `query`, sorted descending
    /// by cosine similarity (higher = closer).
    fn search_by_embedding(
        &self,
        query: &[f32],
        top_k: usize,
    ) -> Result<Vec<(SkillNode, f32)>, ForgeError>;
}
