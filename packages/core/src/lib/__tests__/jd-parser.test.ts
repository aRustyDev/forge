// packages/core/src/lib/__tests__/jd-parser.test.ts

import { describe, it, expect } from 'bun:test'
import { parseRequirements } from '../jd-parser'

describe('parseRequirements', () => {
  it('returns empty for empty input', () => {
    const result = parseRequirements('')
    expect(result.requirements).toEqual([])
    expect(result.overall_confidence).toBe(0)
  })

  it('returns empty for excessively long input (>100k chars)', () => {
    const longText = 'x'.repeat(100_001)
    const result = parseRequirements(longText)
    expect(result.requirements).toEqual([])
    expect(result.overall_confidence).toBe(0)
  })

  it('parses a structured bullet list under a "Requirements" header', () => {
    const jd = `
## About the Role
We are looking for a senior engineer to join our team.

## Requirements
- 5+ years of experience with Python or Go
- Experience designing distributed systems
- Strong knowledge of AWS (EC2, ECS, Lambda)
- Familiarity with CI/CD pipelines (GitHub Actions, Jenkins)
- Excellent communication skills

## Benefits
- Competitive salary
- Health insurance
`
    const result = parseRequirements(jd)

    expect(result.requirements.length).toBe(5)
    expect(result.overall_confidence).toBeGreaterThan(0.7)
    expect(result.requirements[0].text).toContain('Python or Go')
    expect(result.requirements[0].section).toMatch(/requirements/i)
    expect(result.requirements[0].confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('parses a numbered list', () => {
    const jd = `
Qualifications:
1. Bachelor's degree in Computer Science or equivalent
2. 3+ years working with React and TypeScript
3. Experience with SQL databases (PostgreSQL preferred)
4. Understanding of RESTful API design
`
    const result = parseRequirements(jd)

    expect(result.requirements.length).toBe(4)
    expect(result.overall_confidence).toBeGreaterThan(0.7)
    expect(result.requirements[1].text).toContain('React and TypeScript')
  })

  it('handles mixed sections with both required and preferred', () => {
    const jd = `
## Required Qualifications
- BS/MS in Computer Science
- 5+ years building backend services
- Proficiency in Java or Kotlin

## Preferred Qualifications
- Experience with Kafka or RabbitMQ
- Kubernetes certification (CKA/CKAD)
`
    const result = parseRequirements(jd)

    expect(result.requirements.length).toBe(5)
    // Should have requirements from both sections
    const sections = new Set(result.requirements.map(r => r.section))
    expect(sections.size).toBe(2)
  })

  it('assigns lower confidence to prose paragraphs (no section headers)', () => {
    const jd = `We need someone who knows Python and has experience with cloud infrastructure. The ideal candidate will have worked with Docker and Kubernetes in production environments. Strong problem-solving skills are essential.`

    const result = parseRequirements(jd)

    expect(result.requirements.length).toBeGreaterThan(0)
    // Prose gets lower confidence (< 0.5 due to no sections + sentence splitting)
    expect(result.overall_confidence).toBeLessThan(0.5)
  })

  it('deduplicates identical requirements', () => {
    const jd = `
## Requirements
- Experience with Python
- Knowledge of AWS

## Qualifications
- Experience with Python
- Familiarity with Docker
`
    const result = parseRequirements(jd)

    const pythonReqs = result.requirements.filter(r =>
      r.text.toLowerCase().includes('experience with python'),
    )
    expect(pythonReqs.length).toBe(1)
  })

  it('filters out very short lines', () => {
    const jd = `
## Requirements
- Python
- Go
- Experience designing and operating large-scale distributed systems
`
    const result = parseRequirements(jd)

    // "Python" and "Go" are < 10 chars, should be filtered
    expect(result.requirements.length).toBe(1)
    expect(result.requirements[0].text).toContain('distributed systems')
  })

  it('handles "What you will need" style headers', () => {
    const jd = `
## What You'll Need
- Strong background in machine learning
- Experience with PyTorch or TensorFlow
- Published research is a plus
`
    const result = parseRequirements(jd)

    expect(result.requirements.length).toBe(3)
    expect(result.overall_confidence).toBeGreaterThan(0.7)
  })

  it('stops parsing at non-requirement sections', () => {
    const jd = `
## Responsibilities
- Design and implement APIs
- Mentor junior engineers

## About Us
We are a fast-growing startup building the future of AI.
Our mission is to democratize machine learning.
`
    const result = parseRequirements(jd)

    // "About Us" content should not appear as requirements
    const hasAboutUs = result.requirements.some(r => r.text.includes('fast-growing'))
    expect(hasAboutUs).toBe(false)
  })

  it('scores responsibility-section requirements lower than requirement-section (M4)', () => {
    const jd = `
## Requirements
- 5+ years of experience with Python or Go

## Responsibilities
- Design and implement APIs
- Mentor junior engineers
`
    const result = parseRequirements(jd)

    const reqItems = result.requirements.filter(r => r.section?.match(/requirements/i))
    const respItems = result.requirements.filter(r => r.section?.match(/responsibilities/i))

    expect(reqItems.length).toBeGreaterThan(0)
    expect(respItems.length).toBeGreaterThan(0)

    // Requirement-section items should have higher confidence (0.9) than responsibility-section (0.7)
    for (const item of reqItems) {
      expect(item.confidence).toBeGreaterThanOrEqual(0.9)
    }
    for (const item of respItems) {
      expect(item.confidence).toBeLessThanOrEqual(0.7)
    }
  })

  it('handles "Nice to Have" (no s) header variant (G4)', () => {
    const jd = `
## Nice to Have
- Experience with GraphQL and federation
- Familiarity with event-driven architecture
`
    const result = parseRequirements(jd)
    expect(result.requirements.length).toBe(2)
  })

  it('handles "Nice-to-Have" (hyphenated) header variant (G4)', () => {
    const jd = `
## Nice-to-Have
- Experience with GraphQL and federation
- Familiarity with event-driven architecture
`
    const result = parseRequirements(jd)
    expect(result.requirements.length).toBe(2)
  })
})
