/**
 * Data Visualization Acceptance Tests (Phase 79)
 *
 * Verifies chart theming, token usage, dark mode fixes,
 * and component correctness per the Design System spec.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const WEBUI_SRC = join(import.meta.dir, '..')
const CHARTS_DIR = join(WEBUI_SRC, 'lib', 'components', 'charts')
const COMPONENTS_DIR = join(WEBUI_SRC, 'lib', 'components')

function read(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('Data Visualization Acceptance Tests', () => {
  describe('79.1: echarts-theme.ts uses correct tokens', () => {
    const theme = read(join(CHARTS_DIR, 'echarts-theme.ts'))

    test('does NOT reference --border-primary (nonexistent token)', () => {
      expect(theme).not.toContain('--border-primary')
    })

    test('does NOT reference --border-subtle (nonexistent token)', () => {
      expect(theme).not.toContain('--border-subtle')
    })

    test('uses --color-border for axis/tooltip borders', () => {
      expect(theme).toContain('--color-border')
    })

    test('uses --color-surface-sunken for split/grid lines', () => {
      expect(theme).toContain('--color-surface-sunken')
    })
  })

  describe('79.2: Chart components use --text-* tokens (not --font-size-*)', () => {
    const chartFiles = [
      'JDSkillRadar.svelte',
      'CompensationBulletGraph.svelte',
      'SkillsSunburst.svelte',
      'ApplicationGantt.svelte',
      'RoleChoropleth.svelte',
    ]

    for (const file of chartFiles) {
      const filePath = join(CHARTS_DIR, file)
      if (!existsSync(filePath)) continue

      test(`${file}: no --font-size-* references`, () => {
        const content = read(filePath)
        expect(content).not.toMatch(/--font-size-(sm|xs|base|lg|xl)/)
      })
    }
  })

  describe('79.3: EChart loading overlay supports dark mode', () => {
    const echart = read(join(CHARTS_DIR, 'EChart.svelte'))

    test('maskColor does NOT hardcode rgba(255, 255, 255', () => {
      expect(echart).not.toContain("maskColor: 'rgba(255, 255, 255")
      expect(echart).not.toContain('maskColor: "rgba(255, 255, 255')
    })

    test('maskColor resolves --color-surface token', () => {
      expect(echart).toContain('--color-surface')
    })
  })

  describe('79.5: Dashboard pending card links', () => {
    const dashboard = read(join(WEBUI_SRC, 'routes', '+page.svelte'))

    test('has a link to tab=bullets for pending bullets', () => {
      expect(dashboard).toContain('tab=bullets')
    })

    test('has a link to tab=perspectives for pending perspectives', () => {
      expect(dashboard).toContain('tab=perspectives')
    })

    test('perspectives link is distinct from bullets link', () => {
      const bulletsLinks = (dashboard.match(/tab=bullets/g) || []).length
      const perspectivesLinks = (dashboard.match(/tab=perspectives/g) || []).length
      expect(bulletsLinks).toBe(1)
      expect(perspectivesLinks).toBe(1)
    })
  })

  describe('79.6: RenderViewport placeholder exists', () => {
    test('RenderViewport.svelte exists', () => {
      expect(existsSync(join(COMPONENTS_DIR, 'RenderViewport.svelte'))).toBe(true)
    })

    test('has format prop', () => {
      const content = read(join(COMPONENTS_DIR, 'RenderViewport.svelte'))
      expect(content).toContain("format: 'markdown' | 'latex' | 'pdf'")
    })

    test('exported from barrel', () => {
      const barrel = read(join(COMPONENTS_DIR, 'index.ts'))
      expect(barrel).toContain('RenderViewport')
    })
  })
})
