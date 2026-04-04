import { describe, expect, it } from 'bun:test'
import {
  renderSourceToBulletPrompt,
  renderBulletToPerspectivePrompt,
  SOURCE_TO_BULLET_TEMPLATE_VERSION,
  BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION,
} from '../prompts'

describe('renderSourceToBulletPrompt', () => {
  const description =
    'Led a team of 4 engineers to migrate cloud forensics platform from ELK to AWS OpenSearch. ' +
    'Reduced mean incident response time by 40%. Used Terraform for infrastructure.'

  it('includes the source description verbatim', () => {
    const prompt = renderSourceToBulletPrompt(description)
    expect(prompt).toContain(description)
  })

  it('includes the JSON response schema', () => {
    const prompt = renderSourceToBulletPrompt(description)
    expect(prompt).toContain('"bullets"')
    expect(prompt).toContain('"content"')
    expect(prompt).toContain('"technologies"')
    expect(prompt).toContain('"metrics"')
  })

  it('includes the system instruction about factual content only', () => {
    const prompt = renderSourceToBulletPrompt(description)
    expect(prompt).toContain('NOT infer, embellish, or add context')
  })

  it('wraps description in --- delimiters', () => {
    const prompt = renderSourceToBulletPrompt(description)
    const lines = prompt.split('\n')
    const dashLines = lines
      .map((l, i) => ({ line: l.trim(), idx: i }))
      .filter(({ line }) => line === '---')
    // Should have exactly two --- delimiters
    expect(dashLines.length).toBe(2)
  })

  it('handles empty description', () => {
    const prompt = renderSourceToBulletPrompt('')
    expect(prompt).toContain('---\n\n---')
  })

  it('template version constant is set', () => {
    expect(SOURCE_TO_BULLET_TEMPLATE_VERSION).toBe('source-to-bullet-v1')
  })
})

describe('renderBulletToPerspectivePrompt', () => {
  const content = 'Led 4-engineer team migrating cloud forensics platform from ELK to AWS OpenSearch'
  const technologies = ['ELK', 'AWS OpenSearch']
  const metrics = '4 engineers, 6 months'
  const archetype = 'agentic-ai'
  const domain = 'ai_ml'
  const framing = 'accomplishment'

  it('includes the bullet content', () => {
    const prompt = renderBulletToPerspectivePrompt(
      content, technologies, metrics, archetype, domain, framing,
    )
    expect(prompt).toContain(content)
  })

  it('includes technologies as comma-separated list', () => {
    const prompt = renderBulletToPerspectivePrompt(
      content, technologies, metrics, archetype, domain, framing,
    )
    expect(prompt).toContain('Technologies: ELK, AWS OpenSearch')
  })

  it('includes metrics', () => {
    const prompt = renderBulletToPerspectivePrompt(
      content, technologies, metrics, archetype, domain, framing,
    )
    expect(prompt).toContain('Metrics: 4 engineers, 6 months')
  })

  it('includes archetype, domain, and framing', () => {
    const prompt = renderBulletToPerspectivePrompt(
      content, technologies, metrics, archetype, domain, framing,
    )
    expect(prompt).toContain('Target archetype: agentic-ai')
    expect(prompt).toContain('Target domain: ai_ml')
    expect(prompt).toContain('Framing style: accomplishment')
  })

  it('shows "(none)" for empty technologies array', () => {
    const prompt = renderBulletToPerspectivePrompt(
      content, [], metrics, archetype, domain, framing,
    )
    expect(prompt).toContain('Technologies: (none)')
  })

  it('shows "(none)" for null metrics', () => {
    const prompt = renderBulletToPerspectivePrompt(
      content, technologies, null, archetype, domain, framing,
    )
    expect(prompt).toContain('Metrics: (none)')
  })

  it('includes the JSON response schema', () => {
    const prompt = renderBulletToPerspectivePrompt(
      content, technologies, metrics, archetype, domain, framing,
    )
    expect(prompt).toContain('"content"')
    expect(prompt).toContain('"reasoning"')
  })

  it('includes the instruction about not adding claims', () => {
    const prompt = renderBulletToPerspectivePrompt(
      content, technologies, metrics, archetype, domain, framing,
    )
    expect(prompt).toContain('NOT add claims, technologies, outcomes, or context not in the bullet')
  })

  it('template version constant is set', () => {
    expect(BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION).toBe('bullet-to-perspective-v1')
  })
})
