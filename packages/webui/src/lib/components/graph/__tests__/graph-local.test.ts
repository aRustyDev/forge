import { describe, it, expect } from 'vitest'
import {
  extractLocalSubgraph,
  prepareLocalNodes,
  prePositionLocalNodes,
} from '../graph.local'
import type { GraphNode, GraphEdge } from '../graph.types'

const nodes: GraphNode[] = [
  { id: 'a', label: 'Center', type: 'source' },
  { id: 'b', label: 'Neighbor 1', type: 'bullet' },
  { id: 'c', label: 'Neighbor 2', type: 'bullet' },
  { id: 'd', label: 'Connected to E', type: 'perspective' },
  { id: 'e', label: 'Two-hop', type: 'perspective' },
  { id: 'f', label: 'Truly Isolated', type: 'source' },
]

const edges: GraphEdge[] = [
  { id: 'e1', source: 'a', target: 'b' },
  { id: 'e2', source: 'a', target: 'c' },
  { id: 'e3', source: 'b', target: 'e' },
  { id: 'e4', source: 'd', target: 'e' },
]

describe('extractLocalSubgraph', () => {
  it('includes center node and direct neighbors', () => {
    const { nodes: subNodes } = extractLocalSubgraph('a', nodes, edges)
    const ids = subNodes.map(n => n.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toContain('c')
  })

  it('excludes nodes beyond 1-hop', () => {
    const { nodes: subNodes } = extractLocalSubgraph('a', nodes, edges)
    const ids = subNodes.map(n => n.id)
    expect(ids).not.toContain('d')
    expect(ids).not.toContain('e')
  })

  it('includes only edges connected to center', () => {
    const { edges: subEdges } = extractLocalSubgraph('a', nodes, edges)
    const edgeIds = subEdges.map(e => e.id)
    expect(edgeIds).toContain('e1')
    expect(edgeIds).toContain('e2')
    expect(edgeIds).not.toContain('e3')
    expect(edgeIds).not.toContain('e4')
  })

  it('handles center with no edges', () => {
    const { nodes: subNodes, edges: subEdges } = extractLocalSubgraph('f', nodes, edges)
    expect(subNodes.length).toBe(1)
    expect(subNodes[0].id).toBe('f')
    expect(subEdges.length).toBe(0)
  })

  it('handles non-existent centerId', () => {
    const { nodes: subNodes, edges: subEdges } = extractLocalSubgraph('z', nodes, edges)
    expect(subNodes.length).toBe(0)
    expect(subEdges.length).toBe(0)
  })
})

describe('prepareLocalNodes', () => {
  const config = { nodeDefaults: { size: 8, color: '#000' } } as any

  it('enlarges center node to 1.5x', () => {
    const prepared = prepareLocalNodes('a', nodes.slice(0, 3), config)
    const center = prepared.find(n => n.id === 'a')!
    expect(center.size).toBe(12)  // 8 * 1.5
  })

  it('does not enlarge neighbor nodes', () => {
    const prepared = prepareLocalNodes('a', nodes.slice(0, 3), config)
    const neighbor = prepared.find(n => n.id === 'b')!
    expect(neighbor.size).toBeUndefined()
  })

  it('sets forceLabel on center node', () => {
    const prepared = prepareLocalNodes('a', nodes.slice(0, 3), config)
    const center = prepared.find(n => n.id === 'a')!
    expect((center as any).forceLabel).toBe(true)
  })
})

describe('prePositionLocalNodes', () => {
  it('places center at (50, 50)', () => {
    const positioned = prePositionLocalNodes('a', nodes.slice(0, 3))
    const center = positioned.find(n => n.id === 'a')!
    expect(center.x).toBe(50)
    expect(center.y).toBe(50)
  })

  it('places neighbors in a circle around center at radius 30', () => {
    const positioned = prePositionLocalNodes('a', nodes.slice(0, 3))
    const neighbors = positioned.filter(n => n.id !== 'a')
    for (const n of neighbors) {
      expect(n.x).toBeDefined()
      expect(n.y).toBeDefined()
      const dist = Math.sqrt((n.x! - 50) ** 2 + (n.y! - 50) ** 2)
      expect(dist).toBeCloseTo(30, 0)
    }
  })

  it('handles single neighbor without errors', () => {
    const positioned = prePositionLocalNodes('a', [nodes[0], nodes[1]])
    expect(positioned.length).toBe(2)
    const neighbor = positioned.find(n => n.id === 'b')!
    expect(neighbor.x).toBeDefined()
    expect(neighbor.y).toBeDefined()
  })
})
