import { describe, it, expect } from 'vitest'
import { buildSearchIndex, scoreMatch, searchNodes } from '../graph.search'
import type { SearchEntry } from '../graph.search'

// Mock graph object for buildSearchIndex tests
function createMockGraph(nodes: Record<string, Record<string, unknown>>) {
  return {
    forEachNode: (callback: (nodeId: string, attrs: Record<string, unknown>) => void) => {
      for (const [id, attrs] of Object.entries(nodes)) {
        callback(id, attrs)
      }
    },
  } as any
}

describe('buildSearchIndex', () => {
  it('builds entries from graphology node attributes', () => {
    const graph = createMockGraph({
      '1': {
        fullLabel: 'Raytheon PCFE Migration Project',
        slug: 'src:raytheon-pcfe',
        searchContent: 'Led cloud migration for radar systems',
        nodeType: 'source',
      },
    })

    const index = buildSearchIndex(graph)
    expect(index).toHaveLength(1)
    expect(index[0]).toEqual({
      nodeId: '1',
      label: 'Raytheon PCFE Migration Project',
      slug: 'src:raytheon-pcfe',
      content: 'Led cloud migration for radar systems',
      type: 'source',
    })
  })

  it('falls back to label when fullLabel is missing', () => {
    const graph = createMockGraph({
      '1': { label: 'Fallback Label', nodeType: 'bullet' },
    })

    const index = buildSearchIndex(graph)
    expect(index[0].label).toBe('Fallback Label')
  })

  it('handles missing attributes gracefully', () => {
    const graph = createMockGraph({
      '1': {},
    })

    const index = buildSearchIndex(graph)
    expect(index[0]).toEqual({
      nodeId: '1',
      label: '',
      slug: '',
      content: '',
      type: '',
    })
  })
})

describe('scoreMatch', () => {
  const entry: SearchEntry = {
    nodeId: '1',
    label: 'Raytheon PCFE Migration Project',
    slug: 'src:raytheon-pcfe',
    content: 'Led cloud migration for radar systems',
    type: 'source',
  }

  it('scores exact slug match highest', () => {
    expect(scoreMatch('src:raytheon-pcfe', entry)).toBe(100)
  })

  it('scores label starts-with highly', () => {
    expect(scoreMatch('Raytheon', entry)).toBe(80)
  })

  it('scores slug starts-with', () => {
    expect(scoreMatch('src:', entry)).toBe(70)
  })

  it('scores label contains', () => {
    expect(scoreMatch('PCFE', entry)).toBe(50)
  })

  it('scores content contains lowest', () => {
    expect(scoreMatch('radar', entry)).toBe(20)
  })

  it('returns 0 for no match', () => {
    expect(scoreMatch('kubernetes', entry)).toBe(0)
  })

  it('is case-insensitive', () => {
    expect(scoreMatch('raytheon', entry)).toBe(80)
    expect(scoreMatch('SRC:RAYTHEON-PCFE', entry)).toBe(100)
  })

  it('returns 0 for empty query', () => {
    expect(scoreMatch('', entry)).toBe(0)
    expect(scoreMatch('   ', entry)).toBe(0)
  })
})

describe('searchNodes', () => {
  const index: SearchEntry[] = [
    {
      nodeId: '1',
      label: 'Raytheon PCFE Migration Project',
      slug: 'src:raytheon-pcfe',
      content: 'Led cloud migration for radar systems',
      type: 'source',
    },
    {
      nodeId: '2',
      label: 'Built AI taxonomy pipeline',
      slug: 'blt:built-ai',
      content: 'Designed ML classification pipeline',
      type: 'bullet',
    },
    {
      nodeId: '3',
      label: 'DevSecOps Security Lead',
      slug: 'psp:devsecops-sec',
      content: 'Security-focused perspective',
      type: 'perspective',
    },
  ]

  it('returns results sorted by score descending', () => {
    const results = searchNodes('src', index)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].nodeId).toBe('1')  // slug starts with 'src'
  })

  it('returns empty array for empty query', () => {
    expect(searchNodes('', index)).toEqual([])
    expect(searchNodes('   ', index)).toEqual([])
  })

  it('limits results to maxResults', () => {
    const results = searchNodes('e', index, 2)
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('returns multiple matches sorted by relevance', () => {
    const results = searchNodes('security', index)
    expect(results[0].nodeId).toBe('3')  // label contains 'Security'
  })

  it('includes score in results', () => {
    const results = searchNodes('src:raytheon-pcfe', index)
    expect(results[0].score).toBe(100)
  })
})
