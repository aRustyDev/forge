/**
 * Prompt templates for AI derivation.
 *
 * Each function renders a complete prompt string ready for submission to the
 * Claude Code CLI.  Template versions are embedded in the output so callers
 * can log which template produced a given response.
 */

// ---------------------------------------------------------------------------
// Source -> Bullet
// ---------------------------------------------------------------------------

export const SOURCE_TO_BULLET_TEMPLATE_VERSION = 'source-to-bullet-v1'

/**
 * Render the source-to-bullet derivation prompt.
 *
 * @param description - The free-text source description to decompose.
 * @returns The fully rendered prompt string.
 */
export function renderSourceToBulletPrompt(description: string): string {
  return `You are a resume content assistant. Given a source description of work performed,
decompose it into factual bullet points. Each bullet must:
- State only facts present in the source description
- Include specific technologies, tools, or methods mentioned
- Include quantitative metrics if present in the source
- NOT infer, embellish, or add context not explicitly stated

Source description:
---
${description}
---

Respond with a JSON object:
{
  "bullets": [
    {
      "content": "factual bullet text",
      "technologies": ["tech1", "tech2"],
      "metrics": "quantitative metric if present, null otherwise"
    }
  ]
}`
}

// ---------------------------------------------------------------------------
// Bullet -> Perspective
// ---------------------------------------------------------------------------

export const BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION = 'bullet-to-perspective-v1'

/**
 * Render the bullet-to-perspective derivation prompt.
 *
 * @param content      - The bullet's content text.
 * @param technologies - Technologies associated with the bullet.
 * @param metrics      - Quantitative metrics (may be null).
 * @param archetype    - Target role archetype (e.g. "agentic-ai").
 * @param domain       - Target domain (e.g. "ai_ml").
 * @param framing      - Framing style: "accomplishment" | "responsibility" | "context".
 * @returns The fully rendered prompt string.
 */
export function renderBulletToPerspectivePrompt(
  content: string,
  technologies: string[],
  metrics: string | null,
  archetype: string,
  domain: string,
  framing: string,
): string {
  const techList = technologies.length > 0 ? technologies.join(', ') : '(none)'
  const metricsText = metrics ?? '(none)'

  return `You are a resume content assistant. Given a factual bullet point, reframe it
for a target role archetype. The reframing must:
- Only use facts present in the original bullet
- Emphasize aspects relevant to the target archetype
- NOT add claims, technologies, outcomes, or context not in the bullet
- Use active voice, concise phrasing

Original bullet:
---
${content}
Technologies: ${techList}
Metrics: ${metricsText}
---

Target archetype: ${archetype}
Target domain: ${domain}
Framing style: ${framing} (accomplishment | responsibility | context)

Respond with a JSON object:
{
  "content": "reframed bullet text",
  "reasoning": "brief explanation of what was emphasized and why"
}`
}

// ---------------------------------------------------------------------------
// JD -> Skill Extraction
// ---------------------------------------------------------------------------

export const JD_SKILL_EXTRACTION_TEMPLATE_VERSION = 'jd-skill-extraction-v1'

/**
 * Render the JD skill extraction prompt.
 *
 * Confidence ranges:
 * - >= 0.8: explicitly required skills
 * - 0.5-0.7: preferred/nice-to-have skills
 * - 0.3-0.5: implied skills (mentioned in context but not as a requirement)
 *
 * Valid categories: language, framework, tool, platform, methodology,
 * domain, soft_skill, certification, other.
 *
 * @param rawText - The full job description text to extract skills from.
 * @returns The fully rendered prompt string.
 */
export function renderJDSkillExtractionPrompt(rawText: string): string {
  return `You are a technical recruiter assistant. Given a job description, extract the
technical skills, tools, technologies, and competencies that are required or preferred
for the role. For each skill, provide:
- The skill name (normalized: proper casing, common abbreviation)
- A category (one of: language, framework, tool, platform, methodology, domain, soft_skill, certification, other)
- A confidence score (0.0 to 1.0) indicating how clearly the JD states this is required

Rules:
- Extract specific technologies, not vague terms (e.g., "Python" not "programming")
- Use the most common/recognized name for each skill (e.g., "Kubernetes" not "K8s", "AWS" not "Amazon Web Services")
- Include both required and preferred/nice-to-have skills
- Set confidence >= 0.8 for explicitly required skills
- Set confidence 0.5-0.7 for preferred/nice-to-have skills
- Set confidence 0.3-0.5 for implied skills (mentioned in context but not as a requirement)
- Do NOT extract generic job requirements (e.g., "communication skills", "team player") unless they are specifically technical competencies
- Do NOT extract years of experience as skills
- Do NOT extract degree requirements as skills

Job description:
---
${rawText}
---

Respond with a JSON object:
{
  "skills": [
    {
      "name": "skill name",
      "category": "language | framework | tool | platform | methodology | domain | soft_skill | certification | other",
      "confidence": 0.9
    }
  ]
}`
}
