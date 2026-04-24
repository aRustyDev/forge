//! JD Skill Extraction prompt (v1).
//!
//! Extracts technical skills from a job description.
//! Port of `packages/core/src/ai/prompts.ts:renderJDSkillExtractionPrompt`.

use super::RenderedPrompt;

pub const TEMPLATE_VERSION: &str = "jd-skill-extraction-v1";

const SYSTEM: &str = "You are a technical recruiter assistant. Given a job description, extract the
technical skills, tools, technologies, and competencies that are required or preferred
for the role. For each skill, provide:
- The skill name (normalized: proper casing, common abbreviation)
- A category (one of: language, framework, tool, platform, methodology, domain, soft_skill, certification, other)
- A confidence score (0.0 to 1.0) indicating how clearly the JD states this is required

Rules:
- Extract specific technologies, not vague terms (e.g., \"Python\" not \"programming\")
- Use the most common/recognized name for each skill (e.g., \"Kubernetes\" not \"K8s\", \"AWS\" not \"Amazon Web Services\")
- Include both required and preferred/nice-to-have skills
- Set confidence >= 0.8 for explicitly required skills
- Set confidence 0.5-0.7 for preferred/nice-to-have skills
- Set confidence 0.3-0.5 for implied skills (mentioned in context but not as a requirement)
- Do NOT extract generic job requirements (e.g., \"communication skills\", \"team player\") unless they are specifically technical competencies
- Do NOT extract years of experience as skills
- Do NOT extract degree requirements as skills";

/// Render the JD skill extraction prompt.
pub fn render(raw_text: &str) -> RenderedPrompt {
    let user = format!(
        r#"Job description:
---
{raw_text}
---

Respond with a JSON object:
{{
  "skills": [
    {{
      "name": "skill name",
      "category": "language | framework | tool | platform | methodology | domain | soft_skill | certification | other",
      "confidence": 0.9
    }}
  ]
}}"#
    );

    RenderedPrompt {
        system: SYSTEM.to_string(),
        user,
        template_version: TEMPLATE_VERSION,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_includes_jd_text() {
        let prompt = render("We are looking for a Senior Rust developer...");
        assert!(prompt.user.contains("Senior Rust developer"));
    }

    #[test]
    fn render_sets_template_version() {
        let prompt = render("test");
        assert_eq!(prompt.template_version, "jd-skill-extraction-v1");
    }

    #[test]
    fn render_system_contains_extraction_instructions() {
        let prompt = render("test");
        assert!(prompt.system.contains("technical recruiter assistant"));
    }

    #[test]
    fn render_user_contains_category_list() {
        let prompt = render("test");
        assert!(prompt.user.contains("language"));
        assert!(prompt.user.contains("framework"));
        assert!(prompt.user.contains("methodology"));
    }

    #[test]
    fn render_user_contains_confidence_guidance() {
        let prompt = render("test");
        assert!(prompt.user.contains("0.9"));
    }
}
