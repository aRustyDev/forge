//! Bullet → Perspective derivation prompt (v1).
//!
//! Reframes a factual bullet point for a target role archetype.
//! Port of `packages/core/src/ai/prompts.ts:renderBulletToPerspectivePrompt`.

use super::RenderedPrompt;

pub const TEMPLATE_VERSION: &str = "bullet-to-perspective-v1";

const SYSTEM: &str = "You are a resume content assistant. Given a factual bullet point, reframe it
for a target role archetype. The reframing must:
- Only use facts present in the original bullet
- Emphasize aspects relevant to the target archetype
- NOT add claims, technologies, outcomes, or context not in the bullet
- Use active voice, concise phrasing";

/// Render the bullet-to-perspective derivation prompt.
pub fn render(
    content: &str,
    technologies: &[String],
    metrics: Option<&str>,
    archetype: &str,
    domain: &str,
    framing: &str,
) -> RenderedPrompt {
    let tech_list = if technologies.is_empty() {
        "(none)".to_string()
    } else {
        technologies.join(", ")
    };
    let metrics_text = metrics.unwrap_or("(none)");

    let user = format!(
        r#"Original bullet:
---
{content}
Technologies: {tech_list}
Metrics: {metrics_text}
---

Target archetype: {archetype}
Target domain: {domain}
Framing style: {framing} (accomplishment | responsibility | context)

Respond with a JSON object:
{{
  "content": "reframed bullet text",
  "reasoning": "brief explanation of what was emphasized and why"
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
    fn render_includes_all_inputs() {
        let prompt = render(
            "Built CI/CD pipeline",
            &["GitLab".to_string(), "Terraform".to_string()],
            Some("reduced deploy time by 40%"),
            "platform-engineer",
            "infrastructure",
            "accomplishment",
        );
        assert!(prompt.user.contains("Built CI/CD pipeline"));
        assert!(prompt.user.contains("GitLab, Terraform"));
        assert!(prompt.user.contains("reduced deploy time by 40%"));
        assert!(prompt.user.contains("platform-engineer"));
        assert!(prompt.user.contains("infrastructure"));
        assert!(prompt.user.contains("accomplishment"));
    }

    #[test]
    fn render_empty_technologies_shows_none() {
        let prompt = render("Test bullet", &[], None, "arch", "domain", "context");
        assert!(prompt.user.contains("(none)"));
    }

    #[test]
    fn render_null_metrics_shows_none() {
        let prompt = render("Test", &["Python".into()], None, "a", "d", "f");
        assert!(prompt.user.contains("Metrics: (none)"));
    }

    #[test]
    fn render_sets_template_version() {
        let prompt = render("x", &[], None, "a", "d", "f");
        assert_eq!(prompt.template_version, "bullet-to-perspective-v1");
    }
}
