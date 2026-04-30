//! Output types for AlignmentEngine. JSON-serializable via serde.

use serde::{Deserialize, Serialize};

use super::level::SkillLevel;
use super::match_types::MatchType;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AlignmentResult {
    pub resume_id: String,
    pub jd_id: String,
    pub computed_at_ms: u64,
    pub overall_score: f64,
    pub per_skill_scores: Vec<SkillScore>,
    pub gap_report: GapReport,
    pub strength_report: StrengthReport,
    pub coverage_report: CoverageReport,
    pub provenance: Vec<ProvenanceEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SkillScore {
    pub skill_id: String,
    pub score: f64,
    pub raw_score: f64,
    pub level_multiplier: f64,
    pub top_match_type: MatchType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct GapReport {
    pub entries: Vec<GapEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GapEntry {
    pub required_skill_id: String,
    pub severity: f64,
    pub best_match: Option<MatchSummary>,
    pub required_level: Option<SkillLevel>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct StrengthReport {
    pub entries: Vec<StrengthEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StrengthEntry {
    pub skill_id: String,
    pub evidence_count: u32,
    pub top_match_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CoverageReport {
    pub strong: u32,
    pub moderate: u32,
    pub weak: u32,
    pub gap: u32,
    pub total_required: u32,
    pub coverage_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProvenanceEntry {
    pub jd_skill_id: String,
    pub resume_skill_id: Option<String>,
    pub match_type: MatchType,
    pub score: f64,
    pub bullet_id: Option<String>,
    pub span: Option<TextRange>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct TextRange {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MatchSummary {
    pub resume_skill_id: String,
    pub match_type: MatchType,
    pub score: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alignment_result_roundtrips_through_json() {
        let result = AlignmentResult {
            resume_id: "r1".into(),
            jd_id: "jd1".into(),
            computed_at_ms: 1_700_000_000_000,
            overall_score: 0.78,
            per_skill_scores: vec![SkillScore {
                skill_id: "s1".into(),
                score: 0.9,
                raw_score: 1.0,
                level_multiplier: 0.9,
                top_match_type: MatchType::Direct,
            }],
            gap_report: GapReport { entries: vec![] },
            strength_report: StrengthReport { entries: vec![] },
            coverage_report: CoverageReport {
                strong: 1,
                moderate: 0,
                weak: 0,
                gap: 0,
                total_required: 1,
                coverage_pct: 1.0,
            },
            provenance: vec![ProvenanceEntry {
                jd_skill_id: "s1".into(),
                resume_skill_id: Some("s1".into()),
                match_type: MatchType::Direct,
                score: 1.0,
                bullet_id: Some("b1".into()),
                span: Some(TextRange { start: 0, end: 10 }),
            }],
        };
        let json = serde_json::to_string(&result).expect("serialize");
        let back: AlignmentResult = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.overall_score, 0.78);
        assert_eq!(back.per_skill_scores.len(), 1);
        assert_eq!(back.provenance[0].match_type, MatchType::Direct);
    }
}
