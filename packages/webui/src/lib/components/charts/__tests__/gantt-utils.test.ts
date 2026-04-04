import { describe, it, expect } from 'vitest'
import {
  buildGanttItems,
  buildGanttOption,
  generateMockGanttItems,
  STATUS_COLORS,
  TERMINAL_STATUSES,
} from '../gantt-utils'

describe('buildGanttItems', () => {
  const now = new Date('2026-04-03T12:00:00Z')

  it('sorts JDs by created_at descending (newest first)', () => {
    const jds = [
      { id: '1', title: 'Old', status: 'applied', created_at: '2026-01-01', updated_at: '2026-02-01', organization_name: null },
      { id: '2', title: 'New', status: 'applied', created_at: '2026-03-01', updated_at: '2026-03-15', organization_name: null },
    ]
    const items = buildGanttItems(jds as any, now)
    expect(items[0].title).toBe('New')
    expect(items[1].title).toBe('Old')
  })

  it('truncates titles longer than 30 characters', () => {
    const jds = [
      { id: '1', title: 'A'.repeat(35), status: 'applied', created_at: '2026-01-01', updated_at: '2026-02-01', organization_name: null },
    ]
    const items = buildGanttItems(jds as any, now)
    expect(items[0].title).toBe('A'.repeat(30) + '...')
  })

  it('sets isActive true for non-terminal statuses', () => {
    const activeStatuses = ['discovered', 'analyzing', 'applying', 'applied', 'interviewing', 'offered']
    for (const status of activeStatuses) {
      const jds = [{ id: '1', title: 'Test', status, created_at: '2026-01-01', updated_at: '2026-02-01', organization_name: null }]
      const items = buildGanttItems(jds as any, now)
      expect(items[0].isActive).toBe(true)
    }
  })

  it('sets isActive false for rejected, withdrawn, closed', () => {
    for (const status of ['rejected', 'withdrawn', 'closed']) {
      const jds = [{ id: '1', title: 'Test', status, created_at: '2026-01-01', updated_at: '2026-02-01', organization_name: null }]
      const items = buildGanttItems(jds as any, now)
      expect(items[0].isActive).toBe(false)
    }
  })

  it('uses current date as endDate for active JDs', () => {
    const jds = [
      { id: '1', title: 'Test', status: 'applied', created_at: '2026-01-01', updated_at: '2026-02-01', organization_name: null },
    ]
    const items = buildGanttItems(jds as any, now)
    expect(items[0].endDate.getTime()).toBe(now.getTime())
  })

  it('uses updated_at as endDate for terminal JDs', () => {
    const jds = [
      { id: '1', title: 'Test', status: 'rejected', created_at: '2026-01-01', updated_at: '2026-02-15T00:00:00Z', organization_name: null },
    ]
    const items = buildGanttItems(jds as any, now)
    expect(items[0].endDate.getTime()).toBe(new Date('2026-02-15T00:00:00Z').getTime())
  })

  it('maps status to correct color from STATUS_COLORS', () => {
    const jds = [
      { id: '1', title: 'Test', status: 'offered', created_at: '2026-01-01', updated_at: '2026-02-01', organization_name: null },
    ]
    const items = buildGanttItems(jds as any, now)
    expect(items[0].color).toBe('#22c55e')
  })

  it('handles JDs with no organization name', () => {
    const jds = [
      { id: '1', title: 'Test', status: 'applied', created_at: '2026-01-01', updated_at: '2026-02-01', organization_name: null },
    ]
    const items = buildGanttItems(jds as any, now)
    expect(items[0].orgName).toBeNull()
  })
})

describe('buildGanttOption', () => {
  const makeItems = (count: number): any[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `${i}`,
      title: `Job ${i}`,
      orgName: `Org ${i}`,
      status: 'applied',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-01'),
      isActive: true,
      color: '#818cf8',
    }))

  it('produces valid ECharts option with custom series', () => {
    const option = buildGanttOption(makeItems(3)) as any
    expect(option.series[0].type).toBe('custom')
    expect(option.series[0].data).toHaveLength(3)
  })

  it('includes dataZoom when item count > 10', () => {
    const option = buildGanttOption(makeItems(12)) as any
    expect(option.dataZoom).toHaveLength(1)
    expect(option.dataZoom[0].filterMode).toBe('weakFilter')
  })

  it('omits dataZoom when item count <= 10', () => {
    const option = buildGanttOption(makeItems(8)) as any
    expect(option.dataZoom).toHaveLength(0)
  })

  it('omits dataZoom when item count is exactly 10 (boundary)', () => {
    const option = buildGanttOption(makeItems(10)) as any
    expect(option.dataZoom).toHaveLength(0)
  })

  it('sets yAxis.inverse = true (newest at top)', () => {
    const option = buildGanttOption(makeItems(3)) as any
    expect(option.yAxis.inverse).toBe(true)
  })

  it('computes time axis range with 5% padding', () => {
    const items = makeItems(1)
    const option = buildGanttOption(items) as any
    const startTime = items[0].startDate.getTime()
    const endTime = items[0].endDate.getTime()
    expect(option.xAxis.min).toBeLessThan(startTime)
    expect(option.xAxis.max).toBeGreaterThan(endTime)
  })
})

describe('generateMockGanttItems', () => {
  it('produces the requested number of items', () => {
    expect(generateMockGanttItems(5)).toHaveLength(5)
    expect(generateMockGanttItems(12)).toHaveLength(12)
  })

  it('items have valid dates and status colors', () => {
    const items = generateMockGanttItems(8)
    for (const item of items) {
      expect(item.startDate).toBeInstanceOf(Date)
      expect(item.endDate).toBeInstanceOf(Date)
      expect(item.startDate.getTime()).toBeLessThanOrEqual(item.endDate.getTime())
      expect(item.color).toBeTruthy()
      expect(STATUS_COLORS[item.status] ?? '#d1d5db').toBe(item.color)
    }
  })

  it('covers all 9 statuses (including withdrawn and closed) with 12 items', () => {
    const items = generateMockGanttItems(12)
    const statuses = new Set(items.map(i => i.status))
    const allStatuses = [
      'discovered', 'analyzing', 'applying', 'applied',
      'interviewing', 'offered', 'rejected', 'withdrawn', 'closed',
    ]
    for (const status of allStatuses) {
      expect(statuses.has(status)).toBe(true)
    }
  })
})
