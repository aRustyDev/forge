import { describe, it, expect } from 'vitest'
import {
  computeJDSkillAlignment,
  buildRadarOption,
  buildFallbackBarOption,
} from '../jd-radar-utils'

describe('computeJDSkillAlignment', () => {
  it('returns matchPercentage 100 and empty categories for no JD skills', () => {
    const result = computeJDSkillAlignment([], [], [])
    expect(result.matchPercentage).toBe(100)
    expect(result.categories).toHaveLength(0)
    expect(result.totalJDSkills).toBe(0)
    expect(result.totalMatched).toBe(0)
  })

  it('returns matchPercentage 100 when all JD skills match user skills', () => {
    const jdSkills = [
      { id: 's1', name: 'Python', category: 'languages' },
      { id: 's2', name: 'AWS', category: 'cloud' },
    ]
    const allSkills = [...jdSkills]
    const bullets = [
      { technologies: ['Python', 'AWS', 'Docker'] },
    ]
    const result = computeJDSkillAlignment(jdSkills as any, allSkills as any, bullets as any)
    expect(result.matchPercentage).toBe(100)
    expect(result.totalMatched).toBe(2)
  })

  it('returns matchPercentage 0 when no JD skills match', () => {
    const jdSkills = [
      { id: 's1', name: 'Rust', category: 'languages' },
      { id: 's2', name: 'GCP', category: 'cloud' },
    ]
    const allSkills = [...jdSkills]
    const bullets = [
      { technologies: ['Python', 'AWS'] },
    ]
    const result = computeJDSkillAlignment(jdSkills as any, allSkills as any, bullets as any)
    expect(result.matchPercentage).toBe(0)
    expect(result.totalMatched).toBe(0)
  })

  it('groups by category and counts matched/gap skills correctly', () => {
    const jdSkills = [
      { id: 's1', name: 'Python', category: 'languages' },
      { id: 's2', name: 'Go', category: 'languages' },
      { id: 's3', name: 'AWS', category: 'cloud' },
      { id: 's4', name: 'GCP', category: 'cloud' },
    ]
    const allSkills = [...jdSkills]
    const bullets = [
      { technologies: ['Python', 'AWS'] },
    ]
    const result = computeJDSkillAlignment(jdSkills as any, allSkills as any, bullets as any)
    expect(result.matchPercentage).toBe(50)
    expect(result.totalMatched).toBe(2)
    expect(result.totalJDSkills).toBe(4)

    const langs = result.categories.find(c => c.category === 'languages')!
    expect(langs.jdCount).toBe(2)
    expect(langs.matchedCount).toBe(1)
    expect(langs.matchedSkills).toEqual(['Python'])
    expect(langs.gapSkills).toEqual(['Go'])

    const cloud = result.categories.find(c => c.category === 'cloud')!
    expect(cloud.jdCount).toBe(2)
    expect(cloud.matchedCount).toBe(1)
    expect(cloud.matchedSkills).toEqual(['AWS'])
    expect(cloud.gapSkills).toEqual(['GCP'])
  })

  it('uses case-insensitive matching', () => {
    const jdSkills = [{ id: 's1', name: 'Python', category: 'languages' }]
    const allSkills = [...jdSkills]
    const bullets = [{ technologies: ['python'] }]
    const result = computeJDSkillAlignment(jdSkills as any, allSkills as any, bullets as any)
    expect(result.matchPercentage).toBe(100)
    expect(result.totalMatched).toBe(1)
  })

  it('groups null category under "uncategorized"', () => {
    const jdSkills = [{ id: 's1', name: 'WidgetTool', category: null }]
    const allSkills = [...jdSkills]
    const bullets: any[] = []
    const result = computeJDSkillAlignment(jdSkills as any, allSkills as any, bullets)
    expect(result.categories[0].category).toBe('uncategorized')
  })

  it('sorts categories by jdCount descending', () => {
    const jdSkills = [
      { id: 's1', name: 'Python', category: 'languages' },
      { id: 's2', name: 'AWS', category: 'cloud' },
      { id: 's3', name: 'GCP', category: 'cloud' },
      { id: 's4', name: 'Azure', category: 'cloud' },
    ]
    const allSkills = [...jdSkills]
    const result = computeJDSkillAlignment(jdSkills as any, allSkills as any, [])
    expect(result.categories[0].category).toBe('cloud')
    expect(result.categories[0].jdCount).toBe(3)
    expect(result.categories[1].category).toBe('languages')
    expect(result.categories[1].jdCount).toBe(1)
  })
})

describe('buildRadarOption', () => {
  it('produces option with correct indicator count', () => {
    const alignment = {
      categories: [
        { category: 'cloud', jdCount: 3, matchedCount: 2, jdSkills: [], matchedSkills: [], gapSkills: [] },
        { category: 'languages', jdCount: 2, matchedCount: 1, jdSkills: [], matchedSkills: [], gapSkills: [] },
        { category: 'devops', jdCount: 1, matchedCount: 0, jdSkills: [], matchedSkills: [], gapSkills: [] },
      ],
      totalJDSkills: 6,
      totalMatched: 3,
      matchPercentage: 50,
    }
    const option = buildRadarOption(alignment) as any
    expect(option.radar.indicator).toHaveLength(3)
    expect(option.series[0].data).toHaveLength(2) // two polygon series
  })

  it('includes graphic text with match percentage', () => {
    const alignment = {
      categories: [
        { category: 'a', jdCount: 1, matchedCount: 1, jdSkills: [], matchedSkills: [], gapSkills: [] },
        { category: 'b', jdCount: 1, matchedCount: 0, jdSkills: [], matchedSkills: [], gapSkills: [] },
        { category: 'c', jdCount: 1, matchedCount: 0, jdSkills: [], matchedSkills: [], gapSkills: [] },
      ],
      totalJDSkills: 3,
      totalMatched: 1,
      matchPercentage: 33,
    }
    const option = buildRadarOption(alignment) as any
    const percentText = option.graphic[0]
    expect(percentText.style.text).toBe('33%')
    expect(percentText.style.fill).toBe('#ef4444') // red for < 50%
  })
})

describe('buildFallbackBarOption', () => {
  it('produces valid stacked bar option with match percentage', () => {
    const alignment = {
      categories: [
        { category: 'cloud', jdCount: 3, matchedCount: 2, jdSkills: [], matchedSkills: [], gapSkills: [] },
      ],
      totalJDSkills: 3,
      totalMatched: 2,
      matchPercentage: 67,
    }
    const option = buildFallbackBarOption(alignment) as any
    expect(option.series).toHaveLength(2) // Matched + Gap stacked
    expect(option.series[0].name).toBe('Matched')
    expect(option.series[1].name).toBe('Gap')
    expect(option.graphic[0].style.text).toBe('67% match')
  })
})
