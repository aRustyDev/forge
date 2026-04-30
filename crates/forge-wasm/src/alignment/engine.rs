//! AlignmentEngine — orchestrates per-skill match-type evaluation,
//! aggregates scores, and assembles the AlignmentResult.

use std::collections::HashSet;

use forge_core::types::skill_graph::SkillGraphTraversal;
use forge_core::ForgeError;
use serde::{Deserialize, Serialize};

use super::config::AlignmentConfig;
use super::embedding_nn::EmbeddingNearestNeighbor;
use super::level::{compute_level_multiplier, SkillLevel};
use super::match_types::{
    alias_match, cert_match, child_match, co_occurrence_match, direct_match, embedding_match,
    parent_match, sibling_match, MatchHit, MatchType,
};
use super::reports::{build_coverage, build_gap, build_strength};
use super::result::{AlignmentResult, ProvenanceEntry, SkillScore, TextRange};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeAlignmentInput {
    pub resume_id: String,
    pub skills: Vec<ResumeSkillRef>,
    /// Skills validated by resume's certifications. Pre-resolved upstream
    /// from cert→skill junction tables (no `EdgeType::Validates` exists in
    /// the graph today).
    pub validated_skill_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeSkillRef {
    pub skill_id: String,
    pub level: Option<SkillLevel>,
    pub evidence: Vec<EvidencePointer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidencePointer {
    pub bullet_id: Option<String>,
    pub span: Option<TextRange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JdAlignmentInput {
    pub jd_id: String,
    pub skills: Vec<JdSkillRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JdSkillRef {
    pub skill_id: String,
    pub required_level: Option<SkillLevel>,
    /// Optional pre-fetched embedding for the JD skill. When `None`, the
    /// embedding match type is skipped for this skill.
    pub embedding: Option<Vec<f32>>,
}

pub struct AlignmentEngine<'a> {
    graph: &'a dyn SkillGraphTraversal,
    embed_nn: &'a dyn EmbeddingNearestNeighbor,
    config: AlignmentConfig,
}

impl<'a> AlignmentEngine<'a> {
    pub fn new(
        graph: &'a dyn SkillGraphTraversal,
        embed_nn: &'a dyn EmbeddingNearestNeighbor,
    ) -> Self {
        Self {
            graph,
            embed_nn,
            config: AlignmentConfig::default(),
        }
    }

    pub fn with_config(mut self, config: AlignmentConfig) -> Self {
        self.config = config;
        self
    }

    pub fn align(
        &self,
        resume: &ResumeAlignmentInput,
        jd: &JdAlignmentInput,
    ) -> Result<AlignmentResult, ForgeError> {
        let resume_skill_ids: HashSet<String> =
            resume.skills.iter().map(|s| s.skill_id.clone()).collect();
        let validated: HashSet<String> = resume.validated_skill_ids.iter().cloned().collect();

        let weights = &self.config.weights;
        let mut per_skill_scores = Vec::with_capacity(jd.skills.len());
        let mut provenance = Vec::new();

        for jd_skill in &jd.skills {
            let mut hits: Vec<MatchHit> = Vec::new();

            if let Some(h) = direct_match(&jd_skill.skill_id, &resume_skill_ids, weights) {
                hits.push(h);
            }
            if let Some(h) =
                alias_match(&jd_skill.skill_id, &resume_skill_ids, self.graph, weights)?
            {
                hits.push(h);
            }
            if let Some(h) = cert_match(&jd_skill.skill_id, &validated, weights) {
                hits.push(h);
            }
            if let Some(h) =
                child_match(&jd_skill.skill_id, &resume_skill_ids, self.graph, weights)?
            {
                hits.push(h);
            }
            if let Some(h) =
                parent_match(&jd_skill.skill_id, &resume_skill_ids, self.graph, weights)?
            {
                hits.push(h);
            }
            if let Some(h) =
                sibling_match(&jd_skill.skill_id, &resume_skill_ids, self.graph, weights)?
            {
                hits.push(h);
            }
            if let Some(emb) = &jd_skill.embedding {
                if let Some(h) = embedding_match(
                    emb,
                    &resume_skill_ids,
                    self.embed_nn,
                    weights,
                    self.config.embedding_similarity_min,
                    self.config.embedding_top_k,
                )? {
                    hits.push(h);
                }
            }
            if let Some(h) =
                co_occurrence_match(&jd_skill.skill_id, &resume_skill_ids, self.graph, weights)?
            {
                hits.push(h);
            }

            let top_hit = hits.iter().cloned().max_by(|a, b| {
                a.raw_score
                    .partial_cmp(&b.raw_score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            let resume_level = top_hit.as_ref().and_then(|h| {
                resume
                    .skills
                    .iter()
                    .find(|s| s.skill_id == h.resume_skill_id)
                    .and_then(|s| s.level)
            });

            let level_mult = compute_level_multiplier(
                resume_level,
                jd_skill.required_level,
                &self.config.level_multipliers,
            );

            let raw = top_hit.as_ref().map(|h| h.raw_score).unwrap_or(0.0);
            let score = raw * level_mult;
            let top_match_type = top_hit
                .as_ref()
                .map(|h| h.match_type)
                .unwrap_or(MatchType::Direct);

            per_skill_scores.push(SkillScore {
                skill_id: jd_skill.skill_id.clone(),
                score,
                raw_score: raw,
                level_multiplier: level_mult,
                top_match_type,
            });

            // Emit ALL hits as provenance — debuggability over compactness.
            for h in &hits {
                let evidence = resume
                    .skills
                    .iter()
                    .find(|s| s.skill_id == h.resume_skill_id)
                    .and_then(|s| s.evidence.first())
                    .cloned();
                provenance.push(ProvenanceEntry {
                    jd_skill_id: jd_skill.skill_id.clone(),
                    resume_skill_id: Some(h.resume_skill_id.clone()),
                    match_type: h.match_type,
                    score: h.raw_score,
                    bullet_id: evidence.as_ref().and_then(|e| e.bullet_id.clone()),
                    span: evidence.as_ref().and_then(|e| e.span),
                });
            }
        }

        let total = per_skill_scores.len() as f64;
        let overall = if total > 0.0 {
            per_skill_scores.iter().map(|s| s.score).sum::<f64>() / total
        } else {
            0.0
        };

        let gap_report = build_gap(&per_skill_scores, jd, &self.config);
        let strength_report = build_strength(resume, &per_skill_scores);
        let coverage_report = build_coverage(&per_skill_scores, &self.config);

        Ok(AlignmentResult {
            resume_id: resume.resume_id.clone(),
            jd_id: jd.jd_id.clone(),
            computed_at_ms: now_ms(),
            overall_score: overall,
            per_skill_scores,
            gap_report,
            strength_report,
            coverage_report,
            provenance,
        })
    }
}

fn now_ms() -> u64 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Date::now() as u64
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::alignment::test_fixtures::{tiny_graph_bytes, MockEmbeddingNN};
    use crate::skill_graph::SkillGraphRuntime;

    fn fixture() -> SkillGraphRuntime {
        let bytes = tiny_graph_bytes();
        SkillGraphRuntime::from_snapshot(&bytes).expect("runtime")
    }

    #[test]
    fn align_full_path_with_alias_child_parent_sibling_hits() {
        let runtime = fixture();
        let nn = MockEmbeddingNN::empty();
        let engine = AlignmentEngine::new(&runtime, &nn);

        // Resume has k8s (alias of kubernetes), k3s (child of kubernetes),
        // container-orch (parent of kubernetes), pulumi (sibling of terraform).
        let resume = ResumeAlignmentInput {
            resume_id: "r1".into(),
            skills: vec![
                ResumeSkillRef {
                    skill_id: "k8s".into(),
                    level: Some(SkillLevel::Senior),
                    evidence: vec![],
                },
                ResumeSkillRef {
                    skill_id: "k3s".into(),
                    level: None,
                    evidence: vec![],
                },
                ResumeSkillRef {
                    skill_id: "container-orch".into(),
                    level: None,
                    evidence: vec![],
                },
                ResumeSkillRef {
                    skill_id: "pulumi".into(),
                    level: None,
                    evidence: vec![],
                },
            ],
            validated_skill_ids: vec![],
        };
        let jd = JdAlignmentInput {
            jd_id: "jd1".into(),
            skills: vec![
                JdSkillRef {
                    skill_id: "kubernetes".into(),
                    required_level: Some(SkillLevel::Senior),
                    embedding: None,
                },
                JdSkillRef {
                    skill_id: "terraform".into(),
                    required_level: None,
                    embedding: None,
                },
            ],
        };

        let result = engine.align(&resume, &jd).unwrap();
        assert_eq!(result.per_skill_scores.len(), 2);

        // kubernetes: alias (1.0) wins over child (0.9) and parent (0.5).
        // Level: resume k8s = Senior, JD = Senior → meets = 1.0 multiplier.
        // Final score: 1.0.
        let kube = result
            .per_skill_scores
            .iter()
            .find(|s| s.skill_id == "kubernetes")
            .unwrap();
        assert_eq!(kube.top_match_type, MatchType::Alias);
        assert!((kube.raw_score - 1.0).abs() < 1e-6);
        assert!((kube.level_multiplier - 1.0).abs() < 1e-6);
        assert!((kube.score - 1.0).abs() < 1e-6);

        // terraform: sibling (0.4). Level: resume pulumi = None, JD = None →
        // missing = 0.8 multiplier. Final score: 0.4 * 0.8 = 0.32.
        let tf = result
            .per_skill_scores
            .iter()
            .find(|s| s.skill_id == "terraform")
            .unwrap();
        assert_eq!(tf.top_match_type, MatchType::Sibling);
        assert!((tf.raw_score - 0.4).abs() < 1e-6);
        assert!((tf.level_multiplier - 0.8).abs() < 1e-6);
        assert!((tf.score - 0.32).abs() < 1e-6);

        // overall = (1.0 + 0.32) / 2 = 0.66.
        assert!((result.overall_score - 0.66).abs() < 1e-6);

        // Provenance: 3 hits for kubernetes (alias, child, parent) +
        // 1 hit for terraform (sibling) = 4 entries.
        assert_eq!(result.provenance.len(), 4);
        assert!(result
            .provenance
            .iter()
            .any(|p| p.jd_skill_id == "kubernetes" && p.match_type == MatchType::Alias));
        assert!(result
            .provenance
            .iter()
            .any(|p| p.jd_skill_id == "kubernetes" && p.match_type == MatchType::Child));
        assert!(result
            .provenance
            .iter()
            .any(|p| p.jd_skill_id == "kubernetes" && p.match_type == MatchType::Parent));
        assert!(result
            .provenance
            .iter()
            .any(|p| p.jd_skill_id == "terraform" && p.match_type == MatchType::Sibling));
    }

    #[test]
    fn align_with_no_matches_yields_zero_overall() {
        let runtime = fixture();
        let nn = MockEmbeddingNN::empty();
        let engine = AlignmentEngine::new(&runtime, &nn);

        let resume = ResumeAlignmentInput {
            resume_id: "r-empty".into(),
            skills: vec![ResumeSkillRef {
                skill_id: "python".into(),
                level: None,
                evidence: vec![],
            }],
            validated_skill_ids: vec![],
        };
        let jd = JdAlignmentInput {
            jd_id: "jd-empty".into(),
            skills: vec![JdSkillRef {
                skill_id: "kubernetes".into(),
                required_level: None,
                embedding: None,
            }],
        };

        let result = engine.align(&resume, &jd).unwrap();
        assert_eq!(result.per_skill_scores.len(), 1);
        let entry = &result.per_skill_scores[0];
        assert_eq!(entry.raw_score, 0.0);
        assert_eq!(entry.score, 0.0);
        assert!(result.provenance.is_empty(), "no hits → no provenance");
        // gap_count should be 1 (python doesn't match kubernetes).
        assert_eq!(result.gap_report.entries.len(), 1);
    }

    #[test]
    fn align_with_cert_validation_fires_cert_match() {
        let runtime = fixture();
        let nn = MockEmbeddingNN::empty();
        let engine = AlignmentEngine::new(&runtime, &nn);

        let resume = ResumeAlignmentInput {
            resume_id: "r-cert".into(),
            skills: vec![],
            validated_skill_ids: vec!["kubernetes".into()],
        };
        let jd = JdAlignmentInput {
            jd_id: "jd-cert".into(),
            skills: vec![JdSkillRef {
                skill_id: "kubernetes".into(),
                required_level: None,
                embedding: None,
            }],
        };

        let result = engine.align(&resume, &jd).unwrap();
        let entry = &result.per_skill_scores[0];
        assert_eq!(entry.top_match_type, MatchType::Cert);
        assert!((entry.raw_score - 0.95).abs() < 1e-6);
    }

    #[test]
    #[cfg(not(debug_assertions))]
    fn perf_budget_typical_resume_vs_jd() {
        use crate::alignment::test_fixtures::build_large_graph_bytes;
        use std::time::Instant;

        let bytes = build_large_graph_bytes(1000);
        let runtime = SkillGraphRuntime::from_snapshot(&bytes).expect("build runtime");
        let nn = MockEmbeddingNN::empty();
        let engine = AlignmentEngine::new(&runtime, &nn);

        // 100-skill resume — half overlap with JD, half not.
        let resume = ResumeAlignmentInput {
            resume_id: "r-perf".into(),
            skills: (0..100)
                .map(|i| ResumeSkillRef {
                    skill_id: format!("skill-{i}"),
                    level: Some(SkillLevel::Mid),
                    evidence: vec![],
                })
                .collect(),
            validated_skill_ids: vec![],
        };

        // 50-skill JD — first 50 overlap with resume (direct hits guaranteed).
        let jd = JdAlignmentInput {
            jd_id: "jd-perf".into(),
            skills: (0..50)
                .map(|i| JdSkillRef {
                    skill_id: format!("skill-{i}"),
                    required_level: Some(SkillLevel::Senior),
                    embedding: None,
                })
                .collect(),
        };

        let start = Instant::now();
        let result = engine.align(&resume, &jd).expect("align must succeed");
        let elapsed = start.elapsed();

        assert_eq!(result.per_skill_scores.len(), 50);
        assert!(
            elapsed.as_millis() < 100,
            "alignment must complete in <100ms; got {}ms",
            elapsed.as_millis()
        );
    }
}
