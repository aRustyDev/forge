import Graph from 'graphology'
import { describe, it, expect } from 'vitest'

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
})
