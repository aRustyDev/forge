//! Alignment scoring engine — graph-aware resume↔JD matching.
//!
//! See `docs/src/architecture/retrieval/alignment-scoring.md` for the design.
//! See bead `forge-62kb` for scope.

pub mod config;
pub mod embedding_nn;
pub mod engine;
pub mod level;
pub mod match_types;
pub mod reports;
pub mod result;
pub mod store;

#[cfg(test)]
pub mod test_fixtures;

#[cfg(target_arch = "wasm32")]
pub mod wasm_bindings;

// Task 4: uncomment when ready
// pub use config::{AlignmentConfig, MatchWeights};

// Task 6: uncomment when ready
// pub use embedding_nn::EmbeddingNearestNeighbor;

// Task 12: uncomment when ready
// pub use engine::AlignmentEngine;

// Task 3: uncomment full level exports when ready
pub use level::SkillLevel;
// pub use level::{compute_level_multiplier, LevelMultipliers, SkillLevel};

pub use match_types::MatchType;

pub use result::{
    AlignmentResult, CoverageReport, GapEntry, GapReport, ProvenanceEntry, SkillScore,
    StrengthEntry, StrengthReport, TextRange,
};
