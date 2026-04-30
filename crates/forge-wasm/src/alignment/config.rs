//! Alignment scoring configuration. Default weights match the architecture
//! doc; callers can override before recompiling so forge-c4i5 or future
//! tuning beads can experiment.

use super::level::LevelMultipliers;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MatchWeights {
    pub direct: f64,
    pub alias: f64,
    pub cert: f64,
    pub child: f64,
    pub parent: f64,
    pub sibling: f64,
    pub embedding_max: f64,
    pub co_occurrence: f64,
}

impl Default for MatchWeights {
    fn default() -> Self {
        Self {
            direct: 1.0,
            alias: 1.0,
            cert: 0.95,
            child: 0.9,
            parent: 0.5,
            sibling: 0.4,
            embedding_max: 1.0,
            co_occurrence: 0.3,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct AlignmentConfig {
    pub weights: MatchWeights,
    pub level_multipliers: LevelMultipliers,
    pub gap_threshold: f64,
    pub strong_threshold: f64,
    pub embedding_similarity_min: f64,
    pub embedding_top_k: usize,
}

impl Default for AlignmentConfig {
    fn default() -> Self {
        Self {
            weights: MatchWeights::default(),
            level_multipliers: LevelMultipliers::default(),
            gap_threshold: 0.4,
            strong_threshold: 0.8,
            embedding_similarity_min: 0.7,
            embedding_top_k: 20,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_weights_match_architecture_doc() {
        let w = MatchWeights::default();
        assert_eq!(w.direct, 1.0);
        assert_eq!(w.alias, 1.0);
        assert_eq!(w.cert, 0.95);
        assert_eq!(w.child, 0.9);
        assert_eq!(w.parent, 0.5);
        assert_eq!(w.sibling, 0.4);
        assert_eq!(w.embedding_max, 1.0);
        assert_eq!(w.co_occurrence, 0.3);
    }

    #[test]
    fn default_thresholds() {
        let c = AlignmentConfig::default();
        assert_eq!(c.gap_threshold, 0.4);
        assert_eq!(c.strong_threshold, 0.8);
        assert_eq!(c.embedding_similarity_min, 0.7);
        assert_eq!(c.embedding_top_k, 20);
    }
}
