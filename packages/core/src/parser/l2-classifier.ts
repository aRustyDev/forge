import type { Section, ClassifiedSection, SectionCategory } from './types'

interface KeywordEntry {
  word: string
  weight: number
}

const TAXONOMY: Record<SectionCategory, KeywordEntry[]> = {
  responsibilities: [
    { word: 'responsibilities', weight: 3 },
    { word: 'what you will do', weight: 3 },
    { word: "what you'll do", weight: 3 },
    { word: 'key responsibilities', weight: 3 },
    { word: 'main responsibilities', weight: 3 },
    { word: 'role responsibilities', weight: 2 },
    { word: 'duties', weight: 2 },
    { word: 'you will', weight: 1 },
    { word: 'your role', weight: 1 },
    { word: 'day to day', weight: 1 },
  ],
  requirements: [
    { word: 'requirements', weight: 3 },
    { word: 'qualifications', weight: 3 },
    { word: 'required qualifications', weight: 3 },
    { word: 'minimum qualifications', weight: 3 },
    { word: 'must have', weight: 2 },
    { word: 'must-have', weight: 2 },
    { word: 'what we are looking for', weight: 3 },
    { word: "what we're looking for", weight: 3 },
    { word: 'what you need', weight: 2 },
    { word: "what you'll need", weight: 2 },
    { word: "what you'll bring", weight: 2 },
    { word: 'skills & competencies', weight: 2 },
    { word: 'years of experience', weight: 1 },
    { word: 'years experience', weight: 1 },
    { word: 'proficiency', weight: 1 },
    { word: 'experience with', weight: 0.5 },
  ],
  preferred: [
    { word: 'preferred qualifications', weight: 3 },
    { word: 'desired qualifications', weight: 3 },
    { word: 'nice to have', weight: 3 },
    { word: 'nice-to-have', weight: 3 },
    { word: 'strong candidates', weight: 3 },
    { word: 'strong candidate', weight: 2 },
    { word: 'preferred', weight: 2 },
    { word: 'bonus', weight: 2 },
    { word: 'ideally', weight: 1 },
    { word: 'a plus', weight: 1 },
    { word: 'is a plus', weight: 2 },
    { word: 'strong plus', weight: 2 },
  ],
  description: [
    { word: 'about the role', weight: 3 },
    { word: 'about this role', weight: 3 },
    { word: 'position summary', weight: 3 },
    { word: 'role overview', weight: 3 },
    { word: 'overview', weight: 2 },
    { word: 'position overview', weight: 3 },
    { word: 'the role', weight: 1 },
    { word: 'join our', weight: 2 },
    { word: 'we are seeking', weight: 2 },
    { word: 'we are looking for', weight: 2 },
    { word: 'ideal candidate', weight: 2 },
    { word: 'looking for a', weight: 2 },
    { word: 'to join', weight: 1 },
    { word: 'we offer', weight: 1 },
  ],
  location: [
    { word: 'location', weight: 3 },
    { word: 'locations', weight: 3 },
    { word: 'office location', weight: 3 },
    { word: 'work location', weight: 3 },
    { word: 'based in', weight: 1 },
    { word: 'office', weight: 0.5 },
  ],
  compensation: [
    { word: 'compensation', weight: 3 },
    { word: 'salary', weight: 3 },
    { word: 'annual salary', weight: 3 },
    { word: 'pay range', weight: 3 },
    { word: 'base salary', weight: 3 },
    { word: 'compensation and benefits', weight: 2 },
    { word: 'total compensation', weight: 3 },
    { word: 'per year', weight: 1 },
    { word: 'annually', weight: 1 },
    { word: '/yr', weight: 1 },
    { word: '/hr', weight: 1 },
  ],
  benefits: [
    { word: 'benefits', weight: 3 },
    { word: 'perks', weight: 3 },
    { word: 'what we offer', weight: 3 },
    { word: 'our benefits', weight: 3 },
    { word: 'health insurance', weight: 1 },
    { word: '401k', weight: 1 },
    { word: '401(k)', weight: 1 },
    { word: 'paid time off', weight: 1 },
    { word: 'pto', weight: 1 },
    { word: 'equity', weight: 0.5 },
  ],
  about_company: [
    { word: 'about us', weight: 3 },
    { word: 'about the company', weight: 3 },
    { word: 'about the team', weight: 3 },
    { word: 'who we are', weight: 3 },
    { word: 'our mission', weight: 2 },
    { word: 'our values', weight: 2 },
    { word: 'our culture', weight: 2 },
    { word: 'company overview', weight: 3 },
    { word: 'company description', weight: 3 },
    { word: 'about anthropic', weight: 3 },
    { word: "mission is", weight: 1 },
  ],
  eeo: [
    { word: 'equal opportunity', weight: 3 },
    { word: 'equal employment', weight: 3 },
    { word: 'eeo', weight: 3 },
    { word: 'do not discriminate', weight: 2 },
    { word: 'affirmative action', weight: 2 },
    { word: 'regardless of race', weight: 2 },
    { word: 'nondiscrimination', weight: 2 },
    { word: 'protected veteran', weight: 1 },
  ],
}

const ALL_CATEGORIES: SectionCategory[] = [
  'responsibilities', 'requirements', 'preferred', 'description',
  'location', 'compensation', 'benefits', 'about_company', 'eeo',
]

function countOccurrences(text: string, word: string): number {
  let count = 0
  let pos = 0
  while ((pos = text.indexOf(word, pos)) !== -1) {
    count++
    pos += word.length
  }
  return count
}

function scoreSection(section: Section, category: SectionCategory): number {
  const keywords = TAXONOMY[category]
  let score = 0

  const headingLower = section.heading?.toLowerCase() ?? ''
  const bodyLower = section.text.toLowerCase()

  for (const { word, weight } of keywords) {
    // Heading matches weighted 3x
    if (headingLower.includes(word)) {
      score += weight * 3
    }
    // Body matches
    score += countOccurrences(bodyLower, word) * weight
  }

  // Boost $ detection for compensation — only when heading supports it.
  // Without heading signal, $ in body could just be salary mentioned in a description.
  if (category === 'compensation' && headingLower) {
    const salaryPattern = /\$\s*[\d,]+/g
    const headingMatches = headingLower.match(salaryPattern)?.length ?? 0
    const bodyMatches = bodyLower.match(salaryPattern)?.length ?? 0
    score += headingMatches * 3 + bodyMatches * 2
  }

  return score
}

function scoreToConfidence(score: number, hasHeadingSignal: boolean): number {
  if (score === 0) return 0.3
  if (hasHeadingSignal && score >= 6) return 0.95
  if (hasHeadingSignal && score >= 3) return 0.9
  if (score >= 6) return 0.8
  if (score >= 3) return 0.65
  if (score >= 1) return 0.5
  return 0.3
}

export function classifySections(sections: Section[]): ClassifiedSection[] {
  return sections.map(section => {
    let bestCategory: SectionCategory = 'description'
    let bestScore = 0

    for (const category of ALL_CATEGORIES) {
      const score = scoreSection(section, category)
      if (score > bestScore) {
        bestScore = score
        bestCategory = category
      }
    }

    const hasHeadingSignal = section.heading !== null &&
      TAXONOMY[bestCategory].some(k =>
        section.heading!.toLowerCase().includes(k.word)
      )

    const confidence = scoreToConfidence(bestScore, hasHeadingSignal)

    return {
      ...section,
      category: bestCategory,
      confidence,
    }
  })
}
