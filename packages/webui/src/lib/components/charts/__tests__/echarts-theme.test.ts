import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── DOM mocks for bun test (no jsdom) ────────────────────────────
// buildEChartsTheme() calls getComputedStyle(document.documentElement).
// We provide a minimal mock that returns empty strings for unset
// CSS custom properties (matching jsdom/happy-dom behavior).

const cssProperties = new Map<string, string>()

const mockDocumentElement = {
  style: {
    setProperty(name: string, value: string) {
      cssProperties.set(name, value)
    },
    removeProperty(name: string) {
      cssProperties.delete(name)
    },
  },
}

const mockGetComputedStyle = () => ({
  getPropertyValue(name: string): string {
    return cssProperties.get(name) ?? ''
  },
})

// Install mocks if not in a browser/jsdom environment
const needsMock = typeof globalThis.document === 'undefined'

if (needsMock) {
  ;(globalThis as any).document = { documentElement: mockDocumentElement }
  ;(globalThis as any).getComputedStyle = mockGetComputedStyle
}

// Import AFTER mocks are installed
const { buildEChartsTheme } = await import('../echarts-theme')

describe('buildEChartsTheme', () => {
  beforeEach(() => {
    cssProperties.clear()
  })

  it('returns an object with required keys', () => {
    const theme = buildEChartsTheme() as Record<string, any>
    expect(theme).toHaveProperty('color')
    expect(theme).toHaveProperty('backgroundColor')
    expect(theme).toHaveProperty('title')
    expect(theme).toHaveProperty('legend')
    expect(theme).toHaveProperty('tooltip')
    expect(theme).toHaveProperty('categoryAxis')
    expect(theme).toHaveProperty('valueAxis')
  })

  it('color palette has 8 entries', () => {
    const theme = buildEChartsTheme() as Record<string, any>
    expect(theme.color).toHaveLength(8)
  })

  it('uses fallback values when CSS properties are not set', () => {
    // No CSS custom properties are set, so fallbacks are used
    const theme = buildEChartsTheme() as Record<string, any>
    expect(theme.color[0]).toBe('#6c63ff')
    expect(theme.color[1]).toBe('#22c55e')
    expect(theme.color[2]).toBe('#f59e0b')
    expect(theme.color[3]).toBe('#ef4444')
    expect(theme.color[4]).toBe('#06b6d4')
    expect(theme.color[5]).toBe('#8b5cf6')
    expect(theme.color[6]).toBe('#ec4899')
    expect(theme.color[7]).toBe('#14b8a6')
  })

  it('background is transparent', () => {
    const theme = buildEChartsTheme() as Record<string, any>
    expect(theme.backgroundColor).toBe('transparent')
  })

  it('title style uses fallback colors', () => {
    const theme = buildEChartsTheme() as Record<string, any>
    expect(theme.title.textStyle.color).toBe('#1a1a2e')
    expect(theme.title.textStyle.fontSize).toBe(16)
    expect(theme.title.textStyle.fontWeight).toBe(600)
    expect(theme.title.subtextStyle.color).toBe('#6b7280')
    expect(theme.title.subtextStyle.fontSize).toBe(12)
  })

  it('tooltip style uses fallback colors', () => {
    const theme = buildEChartsTheme() as Record<string, any>
    expect(theme.tooltip.backgroundColor).toBe('#ffffff')
    expect(theme.tooltip.borderColor).toBe('#e5e7eb')
    expect(theme.tooltip.textStyle.color).toBe('#1a1a2e')
  })

  it('axis styles use fallback colors', () => {
    const theme = buildEChartsTheme() as Record<string, any>
    expect(theme.categoryAxis.axisLine.lineStyle.color).toBe('#e5e7eb')
    expect(theme.categoryAxis.axisLabel.color).toBe('#6b7280')
    expect(theme.categoryAxis.splitLine.lineStyle.color).toBe('#f3f4f6')
    expect(theme.valueAxis.axisLine.lineStyle.color).toBe('#e5e7eb')
    expect(theme.valueAxis.axisLabel.color).toBe('#6b7280')
  })

  it('reads CSS custom properties when set', () => {
    // Set a CSS custom property
    cssProperties.set('--color-chart-1', '#ff0000')
    const theme = buildEChartsTheme() as Record<string, any>
    expect(theme.color[0]).toBe('#ff0000')
  })

  it('legend style uses fallback font', () => {
    const theme = buildEChartsTheme() as Record<string, any>
    expect(theme.legend.textStyle.color).toBe('#1a1a2e')
    expect(theme.legend.textStyle.fontFamily).toBe('Inter, system-ui, sans-serif')
  })
})
