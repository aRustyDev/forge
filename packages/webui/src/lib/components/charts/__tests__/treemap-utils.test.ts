import { describe, it, expect } from 'vitest'
import {
  buildSkillsTreemapData,
  buildBulletsTreemapData,
  buildDomainsTreemapData,
  buildSkillsTreemapOption,
  buildBulletsTreemapOption,
  buildDomainsTreemapOption,
} from '../treemap-utils'

// ── Skills Treemap ────────────────────────────────────────────────────

describe('buildSkillsTreemapData', () => {
  it('groups skills by category', () => {
    const skills = [
      { id: '1', name: 'Terraform', category: 'cloud' },
      { id: '2', name: 'AWS', category: 'cloud' },
      { id: '3', name: 'Python', category: 'languages' },
    ]
    const bullets = [
      { id: 'b1', technologies: ['terraform', 'aws'] },
    ] as any[]
    const data = buildSkillsTreemapData(skills as any, bullets)

    expect(data).toHaveLength(2)  // cloud, languages
    const cloud = data.find(d => d.name === 'cloud')
    expect(cloud?.children).toHaveLength(2)
  })

  it('sizes skills by bullet technology reference count', () => {
    const skills = [{ id: '1', name: 'Python', category: 'languages' }]
    const bullets = [
      { id: 'b1', technologies: ['python'] },
      { id: 'b2', technologies: ['python'] },
      { id: 'b3', technologies: ['go'] },
    ] as any[]
    const data = buildSkillsTreemapData(skills as any, bullets)

    const lang = data.find(d => d.name === 'languages')
    expect(lang?.children?.[0].value).toBe(2)
  })

  it('assigns minimum value of 1 to skills with no references', () => {
    const skills = [{ id: '1', name: 'Haskell', category: 'languages' }]
    const data = buildSkillsTreemapData(skills as any, [])
    expect(data[0].children?.[0].value).toBe(1)
  })

  it('puts null-category skills under "uncategorized"', () => {
    const skills = [{ id: '1', name: 'Misc', category: null }]
    const data = buildSkillsTreemapData(skills as any, [])
    expect(data[0].name).toBe('uncategorized')
  })

  it('sorts categories and skills by value descending', () => {
    const skills = [
      { id: '1', name: 'A', category: 'small' },
      { id: '2', name: 'B', category: 'big' },
    ]
    const bullets = [
      { id: 'b1', technologies: ['b'] },
      { id: 'b2', technologies: ['b'] },
      { id: 'b3', technologies: ['b'] },
    ] as any[]
    const data = buildSkillsTreemapData(skills as any, bullets)
    expect(data[0].name).toBe('big')
  })

  it('returns empty array for no skills', () => {
    const data = buildSkillsTreemapData([], [])
    expect(data).toHaveLength(0)
  })

  it('computes category value as sum of children', () => {
    const skills = [
      { id: '1', name: 'A', category: 'cat' },
      { id: '2', name: 'B', category: 'cat' },
    ]
    const bullets = [
      { id: 'b1', technologies: ['a'] },
      { id: 'b2', technologies: ['b'] },
    ] as any[]
    const data = buildSkillsTreemapData(skills as any, bullets)
    // A: 1 ref, B: 1 ref -> category total = 2
    expect(data[0].value).toBe(2)
  })
})

// ── Bullets Treemap ───────────────────────────────────────────────────

describe('buildBulletsTreemapData', () => {
  it('groups bullets by primary source', () => {
    const bullets = [
      { id: 'b1', content: 'Built CI/CD pipeline', sources: [{ id: 's1', title: 'DevOps Role', is_primary: true }] },
      { id: 'b2', content: 'Deployed Kubernetes', sources: [{ id: 's1', title: 'DevOps Role', is_primary: true }] },
      { id: 'b3', content: 'Wrote Python scripts', sources: [{ id: 's2', title: 'SWE Role', is_primary: true }] },
    ] as any[]
    const counts = new Map([['b1', 3], ['b2', 1], ['b3', 5]])

    const data = buildBulletsTreemapData(bullets, counts)
    expect(data).toHaveLength(2)

    const devops = data.find(d => d.name === 'DevOps Role')
    expect(devops?.children).toHaveLength(2)
  })

  it('sizes bullets by perspective count', () => {
    const bullets = [
      { id: 'b1', content: 'Big bullet', sources: [{ id: 's1', title: 'Src', is_primary: true }] },
    ] as any[]
    const counts = new Map([['b1', 7]])

    const data = buildBulletsTreemapData(bullets, counts)
    expect(data[0].children?.[0].value).toBe(7)
  })

  it('assigns minimum value of 1 to bullets with no perspectives', () => {
    const bullets = [
      { id: 'b1', content: 'Orphan bullet', sources: [{ id: 's1', title: 'Src', is_primary: true }] },
    ] as any[]
    const data = buildBulletsTreemapData(bullets, new Map())
    expect(data[0].children?.[0].value).toBe(1)
  })

  it('truncates long bullet content to 60 chars', () => {
    const longContent = 'A'.repeat(100)
    const bullets = [
      { id: 'b1', content: longContent, sources: [{ id: 's1', title: 'Src', is_primary: true }] },
    ] as any[]
    const data = buildBulletsTreemapData(bullets, new Map())
    expect(data[0].children?.[0].name.length).toBeLessThanOrEqual(60)
    expect(data[0].children?.[0].name).toContain('...')
  })

  it('handles bullets with no primary source', () => {
    const bullets = [
      { id: 'b1', content: 'No source', sources: [] },
    ] as any[]
    const data = buildBulletsTreemapData(bullets, new Map())
    expect(data[0].name).toBe('No Source')
  })

  it('sorts source groups by total value descending', () => {
    const bullets = [
      { id: 'b1', content: 'A', sources: [{ id: 's1', title: 'Small', is_primary: true }] },
      { id: 'b2', content: 'B', sources: [{ id: 's2', title: 'Big', is_primary: true }] },
    ] as any[]
    const counts = new Map([['b1', 1], ['b2', 10]])
    const data = buildBulletsTreemapData(bullets, counts)
    expect(data[0].name).toBe('Big')
  })
})

// ── Domains Treemap ───────────────────────────────────────────────────

describe('buildDomainsTreemapData', () => {
  it('counts perspectives per domain', () => {
    const perspectives = [
      { domain: 'security' },
      { domain: 'security' },
      { domain: 'cloud' },
    ] as any[]
    const data = buildDomainsTreemapData(perspectives)

    const security = data.find(d => d.name === 'security')
    expect(security?.value).toBe(2)

    const cloud = data.find(d => d.name === 'cloud')
    expect(cloud?.value).toBe(1)
  })

  it('handles null domain as "unassigned"', () => {
    const perspectives = [{ domain: null }] as any[]
    const data = buildDomainsTreemapData(perspectives)
    expect(data[0].name).toBe('unassigned')
  })

  it('sorts domains by total count descending', () => {
    const perspectives = [
      { domain: 'small' },
      { domain: 'big' },
      { domain: 'big' },
      { domain: 'big' },
    ] as any[]
    const data = buildDomainsTreemapData(perspectives)
    expect(data[0].name).toBe('big')
  })

  it('returns empty array for no data', () => {
    const data = buildDomainsTreemapData([])
    expect(data).toHaveLength(0)
  })

  it('attaches perspectiveCount for tooltip', () => {
    const perspectives = [{ domain: 'sec' }, { domain: 'sec' }] as any[]
    const data = buildDomainsTreemapData(perspectives)
    expect((data[0] as any).perspectiveCount).toBe(2)
  })
})

// ── Option builders ──────────────────────────────────────────────────

describe('buildSkillsTreemapOption', () => {
  it('returns option with treemap series type', () => {
    const data = [{ name: 'cloud', value: 3, children: [{ name: 'AWS', value: 3 }] }]
    const option = buildSkillsTreemapOption(data)
    expect((option.series as any[])[0].type).toBe('treemap')
  })

  it('enables nodeClick zoomToNode', () => {
    const option = buildSkillsTreemapOption([])
    expect((option.series as any[])[0].nodeClick).toBe('zoomToNode')
  })

  it('shows breadcrumb', () => {
    const option = buildSkillsTreemapOption([])
    expect((option.series as any[])[0].breadcrumb.show).toBe(true)
  })

  it('has two levels (category + skill)', () => {
    const option = buildSkillsTreemapOption([])
    expect((option.series as any[])[0].levels).toHaveLength(2)
  })
})

describe('buildBulletsTreemapOption', () => {
  it('returns option with treemap series type', () => {
    const option = buildBulletsTreemapOption([])
    expect((option.series as any[])[0].type).toBe('treemap')
  })

  it('has title "Bullets by Source"', () => {
    const option = buildBulletsTreemapOption([])
    expect((option.title as any).text).toBe('Bullets by Source')
  })

  it('enables nodeClick zoomToNode', () => {
    const option = buildBulletsTreemapOption([])
    expect((option.series as any[])[0].nodeClick).toBe('zoomToNode')
  })
})

describe('buildDomainsTreemapOption', () => {
  it('returns option with treemap series type', () => {
    const option = buildDomainsTreemapOption([])
    expect((option.series as any[])[0].type).toBe('treemap')
  })

  it('disables nodeClick (no drill-down)', () => {
    const option = buildDomainsTreemapOption([])
    expect((option.series as any[])[0].nodeClick).toBe(false)
  })

  it('hides breadcrumb', () => {
    const option = buildDomainsTreemapOption([])
    expect((option.series as any[])[0].breadcrumb.show).toBe(false)
  })

  it('has title "Domain Coverage"', () => {
    const option = buildDomainsTreemapOption([])
    expect((option.title as any).text).toBe('Domain Coverage')
  })

  it('has single level', () => {
    const option = buildDomainsTreemapOption([])
    expect((option.series as any[])[0].levels).toHaveLength(1)
  })
})
