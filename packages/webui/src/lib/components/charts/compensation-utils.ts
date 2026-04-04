/**
 * Compensation Bullet Graph Utilities
 *
 * Pure functions for building an ECharts option that renders a bullet graph
 * comparing a JD's salary range against the user's salary expectations.
 *
 * Key pattern: ECharts does not support range bars via `encode`. This module
 * uses a stacked bar trick: an invisible spacer bar from 0 to salary_min,
 * then a visible bar of width (salary_max - salary_min) stacked on top.
 */

import type { EChartsOption } from 'echarts/core'

// ── Interfaces ──────────────────────────────────────────────────────

/** User's salary expectation tiers. All nullable (user may not have set them). */
export interface SalaryExpectations {
  /** Floor: won't accept below this. */
  minimum: number | null
  /** Ideal salary. */
  target: number | null
  /** Aspirational / stretch target. */
  stretch: number | null
}

/** JD salary range (structured numeric values). */
export interface JDSalary {
  min: number | null
  max: number | null
}

/** Combined data needed to build the compensation chart. */
export interface CompensationData {
  jdSalary: JDSalary
  expectations: SalaryExpectations
  jdTitle: string
}

// ── Utility Functions ───────────────────────────────────────────────

/**
 * Determine chart X-axis range from available data.
 * Includes padding (10%) on both sides to prevent bars from touching edges.
 * Returns [0, 200000] as a sensible default when no values are provided.
 */
export function computeAxisRange(data: CompensationData): [number, number] {
  const values: number[] = []

  if (data.jdSalary.min != null) values.push(data.jdSalary.min)
  if (data.jdSalary.max != null) values.push(data.jdSalary.max)
  if (data.expectations.minimum != null) values.push(data.expectations.minimum)
  if (data.expectations.target != null) values.push(data.expectations.target)
  if (data.expectations.stretch != null) values.push(data.expectations.stretch)

  if (values.length === 0) return [0, 200000]

  const min = Math.min(...values)
  const max = Math.max(...values)
  const padding = (max - min) * 0.1 || 20000

  return [Math.max(0, min - padding), max + padding]
}

/**
 * Format a dollar amount for display.
 * Values >= 1000 are shown as "$Xk" (e.g., "$150k").
 * Values < 1000 are shown with locale formatting.
 */
export function formatSalary(value: number): string {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}k`
  }
  return `$${value.toLocaleString()}`
}

/**
 * Determine JD bar color based on midpoint vs. salary expectations.
 *
 * Red:    midpoint < minimum (below floor)
 * Amber:  midpoint >= minimum but < target
 * Green:  midpoint >= target and <= stretch
 * Blue:   midpoint > stretch (above aspirational)
 * Gray:   no expectations set (neutral)
 */
export function getJDBarColor(midpoint: number, expectations: SalaryExpectations): string {
  if (expectations.minimum != null && midpoint < expectations.minimum) return '#ef4444'
  if (expectations.target != null && midpoint < expectations.target) return '#f59e0b'
  if (expectations.stretch != null && midpoint <= expectations.stretch) return '#22c55e'
  if (expectations.stretch != null && midpoint > expectations.stretch) return '#6c63ff'
  return '#374151'  // neutral when no expectations set
}

/**
 * Build ECharts option for the compensation bullet graph.
 *
 * Uses stacked bar trick: invisible spacer (0 to jdMin) + visible range
 * bar (jdMin to jdMax). Background bands via markArea represent salary
 * tiers; dashed reference lines via markLine show exact threshold values.
 *
 * When only one of salary_min/salary_max is provided, the other defaults
 * to the same value, producing a zero-width bar (point marker).
 */
export function buildCompensationOption(data: CompensationData): EChartsOption {
  const [axisMin, axisMax] = computeAxisRange(data)
  const { expectations, jdSalary } = data

  const jdMin = jdSalary.min ?? jdSalary.max ?? 0
  const jdMax = jdSalary.max ?? jdSalary.min ?? 0
  const jdMidpoint = (jdMin + jdMax) / 2
  const barColor = getJDBarColor(jdMidpoint, expectations)

  // Build markArea bands for expectations
  const markAreaData: any[] = []
  const markLineData: any[] = []

  if (expectations.minimum != null) {
    // Band 1: below minimum (light red)
    markAreaData.push([
      { xAxis: axisMin, itemStyle: { color: 'rgba(239, 68, 68, 0.06)' } },
      { xAxis: expectations.minimum },
    ])
    markLineData.push({
      xAxis: expectations.minimum,
      label: { formatter: `Min\n${formatSalary(expectations.minimum)}`, position: 'start' },
      lineStyle: { type: 'dashed', color: '#ef4444', width: 1 },
    })
  }

  if (expectations.minimum != null && expectations.target != null) {
    // Band 2: minimum to target (light amber)
    markAreaData.push([
      { xAxis: expectations.minimum, itemStyle: { color: 'rgba(245, 158, 11, 0.08)' } },
      { xAxis: expectations.target },
    ])
  }

  if (expectations.target != null) {
    markLineData.push({
      xAxis: expectations.target,
      label: { formatter: `Target\n${formatSalary(expectations.target)}`, position: 'start' },
      lineStyle: { type: 'dashed', color: '#f59e0b', width: 1 },
    })
  }

  if (expectations.target != null && expectations.stretch != null) {
    // Band 3: target to stretch (light green)
    markAreaData.push([
      { xAxis: expectations.target, itemStyle: { color: 'rgba(34, 197, 94, 0.10)' } },
      { xAxis: expectations.stretch },
    ])
  }

  if (expectations.stretch != null) {
    markLineData.push({
      xAxis: expectations.stretch,
      label: { formatter: `Stretch\n${formatSalary(expectations.stretch)}`, position: 'start' },
      lineStyle: { type: 'dashed', color: '#22c55e', width: 1 },
    })

    // Band 4: above stretch (very light green)
    markAreaData.push([
      { xAxis: expectations.stretch, itemStyle: { color: 'rgba(34, 197, 94, 0.06)' } },
      { xAxis: axisMax },
    ])
  }

  return {
    tooltip: {
      trigger: 'item',
      formatter: () => {
        const parts = [`<strong>${data.jdTitle}</strong>`]
        if (jdMin !== jdMax) {
          parts.push(`Salary: ${formatSalary(jdMin)} - ${formatSalary(jdMax)}`)
          parts.push(`Midpoint: ${formatSalary(jdMidpoint)}`)
        } else {
          parts.push(`Salary: ${formatSalary(jdMin)}`)
        }
        return parts.join('<br/>')
      },
    },
    grid: {
      left: '5%',
      right: '5%',
      top: '20%',
      bottom: '25%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      min: axisMin,
      max: axisMax,
      axisLabel: {
        formatter: (val: number) => formatSalary(val),
      },
    },
    yAxis: {
      type: 'category',
      data: [data.jdTitle],
      axisLabel: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        // Invisible spacer bar: 0 to jdMin
        type: 'bar',
        stack: 'salary',
        data: [jdMin],
        barWidth: 24,
        itemStyle: { color: 'transparent' },
        emphasis: { disabled: true },
        tooltip: { show: false },
      },
      {
        // Visible range bar: jdMin to jdMax
        type: 'bar',
        stack: 'salary',
        data: [jdMax - jdMin],
        barWidth: 24,
        itemStyle: { color: barColor, borderRadius: 3 },
        markArea: {
          silent: true,
          data: markAreaData,
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: markLineData,
        },
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 5,
        style: {
          text: 'Compensation',
          fontSize: 14,
          fontWeight: 600,
          fill: '#374151',
        },
      },
    ],
  } as EChartsOption
}
