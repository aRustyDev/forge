import { describe, it, expect } from 'vitest'
import {
  computeAxisRange,
  formatSalary,
  getJDBarColor,
  buildCompensationOption,
} from '../compensation-utils'

describe('computeAxisRange', () => {
  it('includes padding around min/max values', () => {
    const data = {
      jdSalary: { min: 150000, max: 200000 },
      expectations: { minimum: null, target: null, stretch: null },
      jdTitle: 'Test',
    }
    const [min, max] = computeAxisRange(data)
    expect(min).toBeLessThan(150000)
    expect(max).toBeGreaterThan(200000)
  })

  it('returns default range when no values provided', () => {
    const data = {
      jdSalary: { min: null, max: null },
      expectations: { minimum: null, target: null, stretch: null },
      jdTitle: 'Test',
    }
    const [min, max] = computeAxisRange(data)
    expect(min).toBe(0)
    expect(max).toBe(200000)
  })
})

describe('formatSalary', () => {
  it('formats 150000 as "$150k"', () => {
    expect(formatSalary(150000)).toBe('$150k')
  })

  it('formats 75000 as "$75k"', () => {
    expect(formatSalary(75000)).toBe('$75k')
  })
})

describe('getJDBarColor', () => {
  const expectations = { minimum: 120000, target: 160000, stretch: 200000 }

  it('returns red when midpoint is below minimum', () => {
    expect(getJDBarColor(100000, expectations)).toBe('#ef4444')
  })

  it('returns amber when midpoint is between minimum and target', () => {
    expect(getJDBarColor(140000, expectations)).toBe('#f59e0b')
  })

  it('returns green when midpoint is between target and stretch', () => {
    expect(getJDBarColor(180000, expectations)).toBe('#22c55e')
  })

  it('returns blue when midpoint is above stretch', () => {
    expect(getJDBarColor(250000, expectations)).toBe('#6c63ff')
  })

  it('returns neutral gray when no expectations are set', () => {
    expect(getJDBarColor(150000, { minimum: null, target: null, stretch: null })).toBe('#374151')
  })
})

describe('buildCompensationOption', () => {
  it('produces option with two stacked bar series', () => {
    const data = {
      jdSalary: { min: 150000, max: 200000 },
      expectations: { minimum: 120000, target: 160000, stretch: 200000 },
      jdTitle: 'Sr Engineer',
    }
    const option = buildCompensationOption(data) as any
    expect(option.series).toHaveLength(2)
    expect(option.series[0].itemStyle.color).toBe('transparent') // invisible spacer
    expect(option.series[0].data[0]).toBe(150000) // spacer height = jdMin
    expect(option.series[1].data[0]).toBe(50000) // visible bar = jdMax - jdMin
  })

  it('includes markArea bands when expectations are set', () => {
    const data = {
      jdSalary: { min: 150000, max: 200000 },
      expectations: { minimum: 120000, target: 160000, stretch: 200000 },
      jdTitle: 'Test',
    }
    const option = buildCompensationOption(data) as any
    expect(option.series[1].markArea.data.length).toBeGreaterThan(0)
  })

  it('omits markArea bands when expectations are null', () => {
    const data = {
      jdSalary: { min: 150000, max: 200000 },
      expectations: { minimum: null, target: null, stretch: null },
      jdTitle: 'Test',
    }
    const option = buildCompensationOption(data) as any
    expect(option.series[1].markArea.data).toHaveLength(0)
    expect(option.series[1].markLine.data).toHaveLength(0)
  })

  it('includes markLine reference lines for min/target/stretch', () => {
    const data = {
      jdSalary: { min: 150000, max: 200000 },
      expectations: { minimum: 120000, target: 160000, stretch: 200000 },
      jdTitle: 'Test',
    }
    const option = buildCompensationOption(data) as any
    expect(option.series[1].markLine.data).toHaveLength(3) // min, target, stretch
  })

  it('handles single salary value (min only)', () => {
    const data = {
      jdSalary: { min: 150000, max: null },
      expectations: { minimum: null, target: null, stretch: null },
      jdTitle: 'Test',
    }
    const option = buildCompensationOption(data) as any
    expect(option.series[0].data[0]).toBe(150000)
    expect(option.series[1].data[0]).toBe(0) // zero-width range
  })

  it('handles single salary value (max only)', () => {
    const data = {
      jdSalary: { min: null, max: 200000 },
      expectations: { minimum: null, target: null, stretch: null },
      jdTitle: 'Test',
    }
    const option = buildCompensationOption(data) as any
    expect(option.series[0].data[0]).toBe(200000)
    expect(option.series[1].data[0]).toBe(0)
  })

  it('includes Band 4 (above stretch) markArea when stretch is set', () => {
    const data = {
      jdSalary: { min: 150000, max: 200000 },
      expectations: { minimum: 120000, target: 160000, stretch: 200000 },
      jdTitle: 'Test',
    }
    const option = buildCompensationOption(data) as any
    // 4 bands: below min, min-target, target-stretch, above stretch
    expect(option.series[1].markArea.data).toHaveLength(4)
    const band4 = option.series[1].markArea.data[3]
    expect(band4[0].xAxis).toBe(200000) // stretch value
    expect(band4[0].itemStyle.color).toBe('rgba(34, 197, 94, 0.06)')
  })
})
