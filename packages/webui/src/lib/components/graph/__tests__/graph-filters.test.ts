import { describe, it, expect } from 'vitest'
import {
  createDefaultFilterState,
  nodePassesFilter,
  filterToSearchParams,
  searchParamsToFilter,
} from '../graph.filters'
import type { GraphNode } from '../graph.types'

describe('nodePassesFilter', () => {
  const node: GraphNode = {
    id: '1', label: 'Test', type: 'source',
    status: 'draft', domain: 'security', archetype: 'DevSecOps',
  }

  it('passes all filters when filter state is empty (default)', () => {
    const filter = createDefaultFilterState()
    expect(nodePassesFilter(node, filter)).toBe(true)
  })

  it('filters by node type', () => {
    const filter = createDefaultFilterState()
    filter.nodeTypes = new Set(['bullet'])
    expect(nodePassesFilter(node, filter)).toBe(false)
  })

  it('passes when node type is in the active set', () => {
    const filter = createDefaultFilterState()
    filter.nodeTypes = new Set(['source', 'bullet'])
    expect(nodePassesFilter(node, filter)).toBe(true)
  })

  it('applies AND logic across categories', () => {
    const filter = createDefaultFilterState()
    filter.nodeTypes = new Set(['source'])
    filter.statuses = new Set(['approved'])
    expect(nodePassesFilter(node, filter)).toBe(false)  // status mismatch
  })

  it('ignores categories with empty sets', () => {
    const filter = createDefaultFilterState()
    filter.nodeTypes = new Set(['source'])
    filter.statuses = new Set()  // empty = show all
    expect(nodePassesFilter(node, filter)).toBe(true)
  })

  it('fails node without status field when status filter is active', () => {
    const nodeNoStatus: GraphNode = { id: '2', label: 'No Status', type: 'bullet' }
    const filter = createDefaultFilterState()
    filter.statuses = new Set(['draft'])
    expect(nodePassesFilter(nodeNoStatus, filter)).toBe(false)
  })

  it('filters by domain', () => {
    const filter = createDefaultFilterState()
    filter.domains = new Set(['cloud'])
    expect(nodePassesFilter(node, filter)).toBe(false)  // node is 'security'
  })

  it('filters by archetype', () => {
    const filter = createDefaultFilterState()
    filter.archetypes = new Set(['DevSecOps'])
    expect(nodePassesFilter(node, filter)).toBe(true)
  })
})

describe('createDefaultFilterState', () => {
  it('returns all empty sets', () => {
    const state = createDefaultFilterState()
    expect(state.nodeTypes.size).toBe(0)
    expect(state.statuses.size).toBe(0)
    expect(state.domains.size).toBe(0)
    expect(state.archetypes.size).toBe(0)
  })

  it('returns a new object each call', () => {
    const a = createDefaultFilterState()
    const b = createDefaultFilterState()
    expect(a).not.toBe(b)
    expect(a.nodeTypes).not.toBe(b.nodeTypes)
  })
})

describe('URL serialization', () => {
  it('round-trips filter state through URL params', () => {
    const filter = createDefaultFilterState()
    filter.nodeTypes = new Set(['source', 'bullet'])
    filter.statuses = new Set(['draft'])

    const params = filterToSearchParams(filter)
    const restored = searchParamsToFilter(params)

    expect(restored.nodeTypes).toEqual(new Set(['source', 'bullet']))
    expect(restored.statuses).toEqual(new Set(['draft']))
    expect(restored.domains.size).toBe(0)
    expect(restored.archetypes.size).toBe(0)
  })

  it('omits empty categories from URL', () => {
    const filter = createDefaultFilterState()
    const params = filterToSearchParams(filter)
    expect(params.toString()).toBe('')
  })

  it('handles single value', () => {
    const filter = createDefaultFilterState()
    filter.domains = new Set(['security'])
    const params = filterToSearchParams(filter)
    expect(params.get('domain')).toBe('security')
  })

  it('handles whitespace in param values', () => {
    const params = new URLSearchParams('types= source , bullet ')
    const filter = searchParamsToFilter(params)
    expect(filter.nodeTypes).toEqual(new Set(['source', 'bullet']))
  })

  it('handles empty param value', () => {
    const params = new URLSearchParams('types=')
    const filter = searchParamsToFilter(params)
    expect(filter.nodeTypes.size).toBe(0)
  })
})
