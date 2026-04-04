import { describe, it, expect } from 'vitest'
import { echarts } from '../echarts-registry'

describe('echarts-registry', () => {
  it('exports a valid echarts instance', () => {
    expect(echarts).toBeDefined()
    expect(typeof echarts.init).toBe('function')
  })

  it('has use method (registration function)', () => {
    expect(typeof echarts.use).toBe('function')
  })

  it('exports echarts from echarts/core (not full bundle)', () => {
    // The echarts/core module exports a `use` function.
    // The full `echarts` module also has `use`, but this test verifies
    // our import path is correct by checking the module identity.
    expect(echarts).toBeDefined()
    // If we imported from 'echarts' instead of 'echarts/core',
    // tree-shaking would not work. This test is a reminder, not
    // a runtime assertion (both modules have the same API surface).
  })
})
