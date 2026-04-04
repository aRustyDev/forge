import { describe, it, expect } from 'vitest'
import { mergeConfig, DEFAULT_GRAPH_CONFIG, DENSE_GRAPH_CONFIG, TREE_GRAPH_CONFIG, SMALL_GRAPH_CONFIG } from '../graph.config'

describe('mergeConfig', () => {
  it('returns defaults when no override provided', () => {
    const config = mergeConfig()
    expect(config).toEqual(DEFAULT_GRAPH_CONFIG)
  })

  it('returns a copy, not a reference to DEFAULT_GRAPH_CONFIG', () => {
    const config = mergeConfig()
    config.forces.gravity = 999
    expect(DEFAULT_GRAPH_CONFIG.forces.gravity).toBe(1)
  })

  it('shallow-merges nested forces without losing defaults', () => {
    const config = mergeConfig({ forces: { gravity: 5 } })
    expect(config.forces.gravity).toBe(5)
    expect(config.forces.scalingRatio).toBe(10)  // preserved from default
    expect(config.forces.slowDown).toBe(1)        // preserved from default
    expect(config.forces.iterations).toBe(100)    // preserved from default
  })

  it('shallow-merges nodeDefaults without losing defaults', () => {
    const config = mergeConfig({ nodeDefaults: { size: 12 } })
    expect(config.nodeDefaults.size).toBe(12)
    expect(config.nodeDefaults.color).toBe('#6b7280')  // preserved from default
  })

  it('shallow-merges edgeDefaults without losing defaults', () => {
    const config = mergeConfig({ edgeDefaults: { type: 'line' } })
    expect(config.edgeDefaults.type).toBe('line')
    expect(config.edgeDefaults.color).toBe('#94a3b8')  // preserved from default
    expect(config.edgeDefaults.size).toBe(1)            // preserved from default
  })

  it('merges colorMap additively', () => {
    const config = mergeConfig({ colorMap: { source: '#ff0000' } })
    expect(config.colorMap).toEqual({ source: '#ff0000' })
  })

  it('merges edgeColorMap additively', () => {
    const config = mergeConfig({ edgeColorMap: { matching: '#00ff00', drifted: '#ff0000' } })
    expect(config.edgeColorMap).toEqual({ matching: '#00ff00', drifted: '#ff0000' })
  })

  it('overrides top-level scalars', () => {
    const config = mergeConfig({ layout: 'circular', labelThreshold: 10 })
    expect(config.layout).toBe('circular')
    expect(config.labelThreshold).toBe(10)
    expect(config.enableDrag).toBe(true)  // unchanged default
  })

  it('overrides boolean flags', () => {
    const config = mergeConfig({ enableDrag: false, enableZoom: false, enableEdgeEvents: false })
    expect(config.enableDrag).toBe(false)
    expect(config.enableZoom).toBe(false)
    expect(config.enableEdgeEvents).toBe(false)
  })

  it('handles undefined partial gracefully', () => {
    const config = mergeConfig(undefined)
    expect(config).toEqual(DEFAULT_GRAPH_CONFIG)
  })

  it('handles empty object partial', () => {
    const config = mergeConfig({})
    expect(config).toEqual(DEFAULT_GRAPH_CONFIG)
  })

  it('works with DENSE_GRAPH_CONFIG preset', () => {
    const config = mergeConfig(DENSE_GRAPH_CONFIG)
    expect(config.forces.gravity).toBe(3)
    expect(config.forces.scalingRatio).toBe(5)
    expect(config.forces.slowDown).toBe(2)
    expect(config.forces.iterations).toBe(100)  // preserved from default
  })

  it('works with TREE_GRAPH_CONFIG preset', () => {
    const config = mergeConfig(TREE_GRAPH_CONFIG)
    expect(config.forces.gravity).toBe(0.5)
    expect(config.forces.scalingRatio).toBe(20)
    expect(config.forces.slowDown).toBe(1)
  })

  it('works with SMALL_GRAPH_CONFIG preset', () => {
    const config = mergeConfig(SMALL_GRAPH_CONFIG)
    expect(config.forces.iterations).toBe(50)
    expect(config.forces.gravity).toBe(1)
  })
})
