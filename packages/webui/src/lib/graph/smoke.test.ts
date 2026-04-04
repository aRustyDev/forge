import Graph from 'graphology'
import { describe, it, expect } from 'vitest'
import type { GraphNode, GraphEdge } from '../components/graph/graph.types'

describe('graphology smoke test', () => {
  it('creates a graph with nodes and edges', () => {
    const graph = new Graph()
    graph.addNode('a', { label: 'Node A', x: 0, y: 0, size: 10, color: '#6c63ff' })
    graph.addNode('b', { label: 'Node B', x: 1, y: 1, size: 10, color: '#3b82f6' })
    graph.addEdge('a', 'b', { type: 'arrow' })

    expect(graph.order).toBe(2)
    expect(graph.size).toBe(1)
    expect(graph.hasEdge('a', 'b')).toBe(true)
  })

  it('builds a graph from GraphNode[] and GraphEdge[] types', () => {
    const nodes: GraphNode[] = [
      { id: 'src-1', label: 'Source A', type: 'source', size: 12, color: '#6c63ff' },
      { id: 'bul-1', label: 'Bullet A', type: 'bullet', size: 8, color: '#3b82f6' },
      { id: 'per-1', label: 'Perspective A', type: 'perspective', size: 6, color: '#10b981' },
    ]

    const edges: GraphEdge[] = [
      { id: 'e1', source: 'src-1', target: 'bul-1', weight: 2 },
      { id: 'e2', source: 'bul-1', target: 'per-1', weight: 1 },
    ]

    const graph = new Graph({ type: 'directed', multi: false })

    for (const node of nodes) {
      graph.addNode(node.id, {
        ...node,
        label: node.label,
        x: node.x ?? Math.random() * 100,
        y: node.y ?? Math.random() * 100,
        size: node.size ?? 8,
        color: node.color ?? '#6b7280',
        nodeType: node.type,
        type: 'circle',
      })
    }

    for (const edge of edges) {
      graph.addEdge(edge.source, edge.target, {
        size: edge.weight ?? 1,
        color: '#94a3b8',
        type: 'arrow',
      })
    }

    expect(graph.order).toBe(3)
    expect(graph.size).toBe(2)

    // Verify spread ordering: Sigma type is 'circle', not 'source'
    expect(graph.getNodeAttribute('src-1', 'type')).toBe('circle')
    expect(graph.getNodeAttribute('src-1', 'nodeType')).toBe('source')

    // Verify color resolution
    expect(graph.getNodeAttribute('src-1', 'color')).toBe('#6c63ff')
    expect(graph.getNodeAttribute('bul-1', 'color')).toBe('#3b82f6')
  })
})
