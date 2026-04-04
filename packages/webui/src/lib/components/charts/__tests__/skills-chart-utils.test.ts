import { describe, it, expect } from 'vitest'
import {
  buildSkillsSunburstData,
  buildDomainArchetypeData,
  getCategoryChildren,
  buildSunburstOption,
  buildDrillDownOption,
  buildDomainArchetypeOption,
} from '../skills-chart-utils'

// ── buildSkillsSunburstData ──────────────────────────────────────────

describe('buildSkillsSunburstData', () => {
  it('groups skills by category', () => {
    const skills = [
      { id: '1', name: 'Terraform', category: 'cloud', notes: null },
      { id: '2', name: 'AWS', category: 'cloud', notes: null },
      { id: '3', name: 'Python', category: 'languages', notes: null },
    ]
    const bullets = [
      { id: 'b1', technologies: ['terraform', 'aws'] },
    ] as any[]
    const data = buildSkillsSunburstData(skills as any, bullets)

    expect(data).toHaveLength(2)  // cloud, languages
    const cloudCat = data.find(d => d.name === 'cloud')
    expect(cloudCat?.children).toHaveLength(2)
  })

  it('assigns minimum value of 1 to unused skills', () => {
    const skills = [{ id: '1', name: 'Haskell', category: 'languages', notes: null }]
    const bullets: any[] = []
    const data = buildSkillsSunburstData(skills as any, bullets)

    expect(data[0].children[0].value).toBe(1)
  })

  it('counts bullet technology references correctly', () => {
    const skills = [{ id: '1', name: 'Python', category: 'languages', notes: null }]
    const bullets = [
      { id: 'b1', technologies: ['python'] },
      { id: 'b2', technologies: ['python', 'rust'] },
      { id: 'b3', technologies: ['go'] },
    ] as any[]
    const data = buildSkillsSunburstData(skills as any, bullets)

    const langCat = data.find(d => d.name === 'languages')
    expect(langCat?.children[0].value).toBe(2)  // python appears in b1, b2
  })

  it('handles skills with null category as "uncategorized"', () => {
    const skills = [{ id: '1', name: 'Misc', category: null, notes: null }]
    const data = buildSkillsSunburstData(skills as any, [])
    expect(data[0].name).toBe('uncategorized')
  })

  it('returns empty array for no skills', () => {
    const data = buildSkillsSunburstData([], [])
    expect(data).toHaveLength(0)
  })

  it('case-insensitive technology matching', () => {
    const skills = [{ id: '1', name: 'Python', category: 'languages', notes: null }]
    const bullets = [
      { id: 'b1', technologies: ['PYTHON'] },
      { id: 'b2', technologies: ['python'] },
    ] as any[]
    const data = buildSkillsSunburstData(skills as any, bullets)
    expect(data[0].children[0].value).toBe(2)
  })
})

// ── buildDomainArchetypeData ─────────────────────────────────────────

describe('buildDomainArchetypeData', () => {
  it('groups perspectives by domain and archetype', () => {
    const perspectives = [
      { domain: 'security', target_archetype: 'security_engineer' },
      { domain: 'security', target_archetype: 'security_engineer' },
      { domain: 'security', target_archetype: 'devsecops' },
      { domain: 'cloud', target_archetype: 'cloud_engineer' },
    ] as any[]
    const { inner, outer } = buildDomainArchetypeData(perspectives)

    expect(inner).toHaveLength(2)  // security, cloud
    const secDomain = inner.find(d => d.name === 'security')
    expect(secDomain?.value).toBe(3)

    expect(outer).toHaveLength(3)  // security_engineer, devsecops, cloud_engineer
  })

  it('handles null domain/archetype as "unassigned"', () => {
    const perspectives = [
      { domain: null, target_archetype: null },
    ] as any[]
    const { inner, outer } = buildDomainArchetypeData(perspectives)
    expect(inner[0].name).toBe('unassigned')
    expect(outer[0].name).toBe('unassigned')
  })

  it('returns empty arrays for no perspectives', () => {
    const { inner, outer } = buildDomainArchetypeData([])
    expect(inner).toHaveLength(0)
    expect(outer).toHaveLength(0)
  })

  it('sums domain totals correctly across multiple archetypes', () => {
    const perspectives = [
      { domain: 'cloud', target_archetype: 'sre' },
      { domain: 'cloud', target_archetype: 'devops' },
      { domain: 'cloud', target_archetype: 'sre' },
    ] as any[]
    const { inner } = buildDomainArchetypeData(perspectives)
    expect(inner[0].value).toBe(3)
  })
})

// ── getCategoryChildren ──────────────────────────────────────────────

describe('getCategoryChildren', () => {
  it('returns children for an existing category', () => {
    const data = [
      { name: 'cloud', children: [{ name: 'AWS', value: 5 }] },
    ]
    const children = getCategoryChildren('cloud', data)
    expect(children).toHaveLength(1)
    expect(children[0].name).toBe('AWS')
  })

  it('returns empty array for nonexistent category', () => {
    const children = getCategoryChildren('nonexistent', [])
    expect(children).toHaveLength(0)
  })
})

// ── Option builders ──────────────────────────────────────────────────

describe('buildSunburstOption', () => {
  it('returns option with sunburst series type', () => {
    const data = [{ name: 'cloud', children: [{ name: 'AWS', value: 3 }] }]
    const option = buildSunburstOption(data, 1)
    expect((option.series as any[])[0].type).toBe('sunburst')
  })

  it('includes graphic element with total skill count', () => {
    const option = buildSunburstOption([], 42)
    const graphic = option.graphic as any[]
    expect(graphic[0].style.text).toContain('42')
  })

  it('has title "Skills by Category"', () => {
    const option = buildSunburstOption([], 0)
    expect((option.title as any).text).toBe('Skills by Category')
  })
})

describe('buildDrillDownOption', () => {
  it('returns option with pie series type', () => {
    const children = [{ name: 'AWS', value: 5 }]
    const option = buildDrillDownOption('cloud', children)
    expect((option.series as any[])[0].type).toBe('pie')
  })

  it('uses category name as title', () => {
    const option = buildDrillDownOption('security', [])
    expect((option.title as any).text).toBe('security')
  })

  it('includes "Back" graphic text', () => {
    const option = buildDrillDownOption('cloud', [])
    const graphic = option.graphic as any[]
    const backText = graphic.find(g => g.style?.text === 'Back')
    expect(backText).toBeDefined()
  })
})

describe('buildDomainArchetypeOption', () => {
  it('returns option with two pie series (Domain + Archetype)', () => {
    const inner = [{ name: 'security', value: 3 }]
    const outer = [{ name: 'devsecops', value: 2 }]
    const option = buildDomainArchetypeOption(inner, outer)
    const series = option.series as any[]
    expect(series).toHaveLength(2)
    expect(series[0].name).toBe('Domain')
    expect(series[1].name).toBe('Archetype')
  })

  it('inner series has smaller radius than outer', () => {
    const option = buildDomainArchetypeOption([], [])
    const series = option.series as any[]
    // Inner: ['0%', '40%'], Outer: ['45%', '75%']
    expect(series[0].radius[1]).toBe('40%')
    expect(series[1].radius[0]).toBe('45%')
  })

  it('includes scrollable vertical legend', () => {
    const option = buildDomainArchetypeOption([{ name: 'sec', value: 1 }], [])
    expect((option.legend as any).type).toBe('scroll')
    expect((option.legend as any).orient).toBe('vertical')
  })
})
