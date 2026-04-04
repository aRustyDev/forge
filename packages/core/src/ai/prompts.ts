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
