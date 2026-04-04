import { describe, it, expect } from 'vitest'
import type { GraphNode, GraphEdge, GraphConfig, GraphViewProps } from '../graph.types'

describe('GraphNode', () => {
  it('accepts minimal node', () => {
    const node: GraphNode = { id: '1', label: 'Test', type: 'source' }
    expect(node.id).toBe('1')
    expect(node.label).toBe('Test')
    expect(node.type).toBe('source')
  })

  it('accepts node with optional position and size', () => {
    const node: GraphNode = { id: '1', label: 'Test', type: 'source', x: 10, y: 20, size: 15 }
    expect(node.x).toBe(10)
    expect(node.y).toBe(20)
    expect(node.size).toBe(15)
  })

  it('accepts node with explicit color', () => {
    const node: GraphNode = { id: '1', label: 'Test', type: 'source', color: '#ff0000' }
    expect(node.color).toBe('#ff0000')
  })

  it('accepts node with custom metadata via index signature', () => {
    const node: GraphNode = {
      id: '1', label: 'Test', type: 'source',
      entityId: 'abc', status: 'approved', domain: 'engineering',
    }
    expect(node.entityId).toBe('abc')
    expect(node.status).toBe('approved')
    expect(node.domain).toBe('engineering')
  })
})

describe('GraphEdge', () => {
  it('accepts minimal edge', () => {
    const edge: GraphEdge = { id: 'e1', source: '1', target: '2' }
    expect(edge.source).toBe('1')
    expect(edge.target).toBe('2')
  })

  it('accepts edge with optional fields', () => {
    const edge: GraphEdge = {
      id: 'e1', source: '1', target: '2',
      label: 'derives', weight: 2, type: 'matching', color: '#00ff00',
    }
    expect(edge.weight).toBe(2)
    expect(edge.type).toBe('matching')
  })

  it('accepts edge with custom metadata', () => {
    const edge: GraphEdge = {
      id: 'e1', source: '1', target: '2',
      drifted: true, isPrimary: false,
    }
    expect(edge.drifted).toBe(true)
  })
})

describe('GraphConfig shape', () => {
  it('accepts a full config object', () => {
    const config: GraphConfig = {
      layout: 'forceatlas2',
      forces: { gravity: 1, scalingRatio: 10, slowDown: 1 },
      nodeDefaults: { size: 8, color: '#6b7280' },
      edgeDefaults: { color: '#94a3b8', size: 1, type: 'arrow' },
      colorMap: { source: '#ff0000' },
      edgeColorMap: { matching: '#00ff00' },
      labelThreshold: 6,
      enableDrag: true,
      enableZoom: true,
      enableEdgeEvents: true,
      zIndex: true,
    }
    expect(config.layout).toBe('forceatlas2')
  })

  it('accepts circular and random layout values', () => {
    const circular: GraphConfig['layout'] = 'circular'
    const random: GraphConfig['layout'] = 'random'
    expect(circular).toBe('circular')
    expect(random).toBe('random')
  })
})

describe('GraphViewProps shape', () => {
  it('accepts minimal props (nodes + edges)', () => {
    const props: GraphViewProps = {
      nodes: [{ id: '1', label: 'Test', type: 'source' }],
      edges: [{ id: 'e1', source: '1', target: '2' }],
    }
    expect(props.nodes).toHaveLength(1)
    expect(props.edges).toHaveLength(1)
  })

  it('accepts all optional callback props', () => {
    const props: GraphViewProps = {
      nodes: [],
      edges: [],
      config: { layout: 'circular' },
      highlightNode: 'node-1',
      onNodeClick: (_id, _data) => {},
      onNodeHover: (_id, _data) => {},
      onEdgeClick: (_id, _data) => {},
      onEdgeHover: (_id) => {},
      onStageClick: () => {},
    }
    expect(props.highlightNode).toBe('node-1')
  })
})
