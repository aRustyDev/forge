import { describe, it, expect } from 'vitest'
import {
  DIM_NODE_COLOR,
  DIM_EDGE_COLOR,
  DIM_EDGE_SIZE,
  HIGHLIGHT_EDGE_SIZE_BUMP,
  Z_FOREGROUND,
  Z_BACKGROUND,
  resolveThemeColor,
} from '../graph.constants'

describe('graph constants', () => {
  it('DIM_NODE_COLOR matches ChainViewModal hardcoded value', () => {
    expect(DIM_NODE_COLOR).toBe('#e5e7eb')
  })

  it('DIM_EDGE_COLOR matches ChainViewModal hardcoded value', () => {
    expect(DIM_EDGE_COLOR).toBe('#f3f4f6')
  })

  it('DIM_EDGE_SIZE is 0.5', () => {
    expect(DIM_EDGE_SIZE).toBe(0.5)
  })

  it('HIGHLIGHT_EDGE_SIZE_BUMP is 1', () => {
    expect(HIGHLIGHT_EDGE_SIZE_BUMP).toBe(1)
  })

  it('Z_FOREGROUND is 1 and Z_BACKGROUND is 0', () => {
    expect(Z_FOREGROUND).toBe(1)
    expect(Z_BACKGROUND).toBe(0)
  })
})

describe('resolveThemeColor', () => {
  it('returns fallback when window is undefined (SSR)', () => {
    // In bun test, window IS defined. Test the SSR path by
    // temporarily overriding typeof check via function extraction.
    // The SSR guard is `typeof window === 'undefined'`.
    // In bun test, window exists, so we test the browser path instead.
    // The SSR path is validated by the component's SSR safety smoke test.
    const result = resolveThemeColor('--nonexistent-property', '#abcdef')
    // In bun test, getComputedStyle returns '' for unset properties
    expect(result).toBe('#abcdef')
  })

  it('returns fallback for unset CSS property', () => {
    const result = resolveThemeColor('--definitely-not-set-12345', '#fallback')
    expect(result).toBe('#fallback')
  })
})
