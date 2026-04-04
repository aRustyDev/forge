import { describe, it, expect } from 'vitest'
import {
  aggregateByState,
  getStateOrgs,
  buildChoroplethOption,
} from '../choropleth-utils'

describe('aggregateByState', () => {
  it('groups JDs by resolved state', () => {
    const jds = [
      { id: '1', title: 'Job A', location: 'San Francisco, CA', organization_name: 'Acme' },
      { id: '2', title: 'Job B', location: 'NYC', organization_name: 'BigCo' },
      { id: '3', title: 'Job C', location: 'Los Angeles, CA', organization_name: 'Acme' },
    ]
    const data = aggregateByState(jds as any)
    const ca = data.stateCounts.find(s => s.name === 'California')!
    expect(ca.value).toBe(2)
    const ny = data.stateCounts.find(s => s.name === 'New York')!
    expect(ny.value).toBe(1)
  })

  it('counts JDs per state correctly', () => {
    const jds = [
      { id: '1', title: 'A', location: 'Austin, TX', organization_name: null },
      { id: '2', title: 'B', location: 'Dallas, TX', organization_name: null },
      { id: '3', title: 'C', location: 'Houston, TX', organization_name: null },
    ]
    const data = aggregateByState(jds as any)
    expect(data.stateCounts[0].value).toBe(3)
    expect(data.stateCounts[0].name).toBe('Texas')
  })

  it('puts "Remote" JDs in unresolvedCount', () => {
    const jds = [
      { id: '1', title: 'A', location: 'Remote', organization_name: null },
      { id: '2', title: 'B', location: 'San Francisco, CA', organization_name: null },
    ]
    const data = aggregateByState(jds as any)
    expect(data.unresolvedCount).toBe(1)
    expect(data.unresolvedJDs).toEqual(['A'])
  })

  it('returns empty stateCounts for all-remote JDs', () => {
    const jds = [
      { id: '1', title: 'A', location: 'Remote', organization_name: null },
      { id: '2', title: 'B', location: 'Anywhere', organization_name: null },
    ]
    const data = aggregateByState(jds as any)
    expect(data.stateCounts).toHaveLength(0)
    expect(data.unresolvedCount).toBe(2)
  })

  it('sorts stateCounts by value descending', () => {
    const jds = [
      { id: '1', title: 'A', location: 'NYC', organization_name: null },
      { id: '2', title: 'B', location: 'San Francisco, CA', organization_name: null },
      { id: '3', title: 'C', location: 'Los Angeles, CA', organization_name: null },
    ]
    const data = aggregateByState(jds as any)
    expect(data.stateCounts[0].name).toBe('California')
    expect(data.stateCounts[0].value).toBe(2)
  })

  it('includes JD titles in stateCount data', () => {
    const jds = [
      { id: '1', title: 'Engineer', location: 'Austin, TX', organization_name: null },
    ]
    const data = aggregateByState(jds as any)
    expect(data.stateCounts[0].jds).toEqual(['Engineer'])
  })

  it('precomputes stateOrgsMap with org names and counts', () => {
    const jds = [
      { id: '1', title: 'A', location: 'San Francisco, CA', organization_name: 'Acme' },
      { id: '2', title: 'B', location: 'Los Angeles, CA', organization_name: 'Acme' },
      { id: '3', title: 'C', location: 'San Jose, CA', organization_name: 'BigCo' },
    ]
    const data = aggregateByState(jds as any)
    const caOrgs = data.stateOrgsMap.get('California')!
    expect(caOrgs).toBeDefined()
    expect(caOrgs[0]).toEqual({ name: 'Acme', count: 2 })
    expect(caOrgs[1]).toEqual({ name: 'BigCo', count: 1 })
  })
})

describe('getStateOrgs', () => {
  it('returns top organizations sorted by count', () => {
    const jds = [
      { id: '1', title: 'A', location: 'San Francisco, CA', organization_name: 'Acme' },
      { id: '2', title: 'B', location: 'Los Angeles, CA', organization_name: 'Acme' },
      { id: '3', title: 'C', location: 'San Jose, CA', organization_name: 'BigCo' },
    ]
    const orgs = getStateOrgs(jds as any, 'California')
    expect(orgs[0]).toEqual({ name: 'Acme', count: 2 })
    expect(orgs[1]).toEqual({ name: 'BigCo', count: 1 })
  })

  it('limits to 5 organizations', () => {
    const jds = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`, title: `Job ${i}`, location: 'Austin, TX',
      organization_name: `Org${i}`,
    }))
    const orgs = getStateOrgs(jds as any, 'Texas')
    expect(orgs.length).toBeLessThanOrEqual(5)
  })

  it('uses "Unknown" for JDs with no organization name', () => {
    const jds = [
      { id: '1', title: 'A', location: 'NYC', organization_name: null },
    ]
    const orgs = getStateOrgs(jds as any, 'New York')
    expect(orgs[0].name).toBe('Unknown')
  })
})

describe('buildChoroplethOption', () => {
  it('produces valid map series option', () => {
    const data = {
      stateCounts: [{ name: 'California', value: 3, jds: [] as string[] }],
      unresolvedCount: 1,
      unresolvedJDs: [] as string[],
      totalJDs: 4,
      stateOrgsMap: new Map(),
    }
    const option = buildChoroplethOption(data) as any
    expect(option.series[0].type).toBe('map')
    expect(option.series[0].map).toBe('USA')
  })

  it('includes visualMap with correct min/max', () => {
    const data = {
      stateCounts: [
        { name: 'California', value: 5, jds: [] as string[] },
        { name: 'Texas', value: 3, jds: [] as string[] },
      ],
      unresolvedCount: 0,
      unresolvedJDs: [] as string[],
      totalJDs: 8,
      stateOrgsMap: new Map(),
    }
    const option = buildChoroplethOption(data) as any
    expect(option.visualMap.min).toBe(0)
    expect(option.visualMap.max).toBe(5)
  })

  it('subtitle shows total and unresolved counts', () => {
    const data = {
      stateCounts: [] as any[],
      unresolvedCount: 3,
      unresolvedJDs: [] as string[],
      totalJDs: 10,
      stateOrgsMap: new Map(),
    }
    const option = buildChoroplethOption(data) as any
    expect(option.title.subtext).toContain('10 total')
    expect(option.title.subtext).toContain('3 remote/unknown')
  })
})
