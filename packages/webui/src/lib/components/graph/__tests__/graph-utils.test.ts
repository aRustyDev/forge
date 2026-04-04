import { describe, it, expect, vi } from 'vitest'
import { getEdgeMidpoint } from '../graph.utils'

function createMockSigma(
  nodeDisplayData: Record<string, { x: number; y: number } | undefined>
) {
  return {
    getNodeDisplayData: vi.fn((nodeId: string) => nodeDisplayData[nodeId] ?? undefined),
    graphToViewport: vi.fn(({ x, y }: { x: number; y: number }) => ({
      x: x * 2,  // simple transform for testing
      y: y * 2,
    })),
  } as any
}

function createMockGraph(edges: Record<string, [string, string]>) {
  return {
    extremities: vi.fn((edgeId: string) => {
      const result = edges[edgeId]
      if (!result) throw new Error(`Edge not found: ${edgeId}`)
      return result
    }),
  } as any
}

describe('getEdgeMidpoint', () => {
  it('returns viewport midpoint when both nodes have display data', () => {
    const sigma = createMockSigma({
      nodeA: { x: 10, y: 20 },
      nodeB: { x: 30, y: 40 },
    })
    const graph = createMockGraph({ edge1: ['nodeA', 'nodeB'] })

    const result = getEdgeMidpoint(sigma, graph, 'edge1')

    expect(result).toEqual({ x: 40, y: 60 })  // midpoint (20,30) * 2
    expect(sigma.graphToViewport).toHaveBeenCalledWith({ x: 20, y: 30 })
  })

  it('returns null when source node has no display data', () => {
    const sigma = createMockSigma({
      nodeA: undefined,
      nodeB: { x: 30, y: 40 },
    })
    const graph = createMockGraph({ edge1: ['nodeA', 'nodeB'] })

    expect(getEdgeMidpoint(sigma, graph, 'edge1')).toBeNull()
  })

  it('returns null when target node has no display data', () => {
    const sigma = createMockSigma({
      nodeA: { x: 10, y: 20 },
      nodeB: undefined,
    })
    const graph = createMockGraph({ edge1: ['nodeA', 'nodeB'] })

    expect(getEdgeMidpoint(sigma, graph, 'edge1')).toBeNull()
  })

  it('returns null for non-existent edge ID', () => {
    const sigma = createMockSigma({})
    const graph = createMockGraph({})

    expect(getEdgeMidpoint(sigma, graph, 'nonexistent')).toBeNull()
  })
})
