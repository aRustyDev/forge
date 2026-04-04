/**
 * Gantt chart data transformation and ECharts option building utilities.
 *
 * Transforms JD (JobDescription) records into Gantt chart items and builds
 * the ECharts custom series configuration with renderItem for two-shape
 * group bars (solid rect + dashed right edge for active items).
 *
 * Status colors reuse the accent colors from Phase 61's pipeline definitions.
 */
import type { EChartsOption } from 'echarts/core'

/**
 * A single item in the Gantt chart.
 * Represents one JD as a horizontal bar from startDate to endDate,
 * colored by pipeline status.
 *
 * - `isActive = true`: status is non-terminal (bar extends to "now", dashed right edge).
 * - `isActive = false`: status is terminal (bar ends at `updated_at`, solid right edge).
 */
export interface GanttItem {
  id: string
  title: string
  orgName: string | null
  status: string
  startDate: Date
  endDate: Date      // updated_at for terminal, now for active
  isActive: boolean  // true if status is non-terminal
  color: string
}

/**
 * Status-to-color mapping for Gantt bars.
 * Colors match Phase 61 pipeline column accent values.
 */
export const STATUS_COLORS: Record<string, string> = {
  discovered:   '#a5b4fc',  // light purple
  analyzing:    '#60a5fa',  // blue
  applying:     '#fbbf24',  // amber
  applied:      '#818cf8',  // indigo
  interviewing: '#a78bfa',  // purple
  offered:      '#22c55e',  // green
  rejected:     '#f87171',  // red
  withdrawn:    '#fb923c',  // orange
  closed:       '#d1d5db',  // dark gray
}

/**
 * Terminal statuses — JDs with these statuses have a fixed end date
 * (updated_at) and a solid right edge on the Gantt bar.
 */
export const TERMINAL_STATUSES = new Set(['rejected', 'withdrawn', 'closed'])

/**
 * Minimal shape of a JD record needed for Gantt transformation.
 * Matches the fields available on JobDescriptionWithOrg from the SDK.
 */
interface JDLike {
  id: string
  title: string
  status: string
  created_at: string
  updated_at: string
  organization_name?: string | null
}

/**
 * Transform JD list into Gantt chart items.
 * Sorts by created_at descending (newest first).
 *
 * - Titles longer than 30 chars are truncated with "...".
 * - Active JDs use `new Date()` as endDate; terminal JDs use `updated_at`.
 * - Each item is colored by its status via STATUS_COLORS.
 */
export function buildGanttItems(jds: JDLike[], now: Date = new Date()): GanttItem[] {

  return jds
    .map(jd => {
      const isActive = !TERMINAL_STATUSES.has(jd.status)
      return {
        id: jd.id,
        title: jd.title.length > 30 ? jd.title.slice(0, 30) + '...' : jd.title,
        orgName: jd.organization_name ?? null,
        status: jd.status,
        startDate: new Date(jd.created_at),
        endDate: isActive ? now : new Date(jd.updated_at),
        isActive,
        color: STATUS_COLORS[jd.status] ?? '#d1d5db',
      }
    })
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
}

/**
 * Build ECharts option for the Gantt chart.
 *
 * Uses custom series with renderItem for two-shape group bars:
 * - Solid rect for the bar body.
 * - Dashed vertical line on the right edge (active items only).
 *   Do NOT use lineDash on the rect itself — ECharts SVG renderer
 *   applies it to all four edges, not just one.
 *
 * Tooltip uses params.value[0] (explicit category index from the data array)
 * for item lookup, NOT params.dataIndex. When dataZoom filtering is active,
 * params.dataIndex may not correspond to the visible item index.
 *
 * dataZoom uses filterMode: 'weakFilter' (not 'none'). 'weakFilter' correctly
 * evaluates both X and Y dimensions for custom series data.
 */
export function buildGanttOption(items: GanttItem[]): EChartsOption {
  const categories = items.map(item => {
    const label = item.orgName
      ? `${item.title}\n${item.orgName}`
      : item.title
    return label
  })

  // Compute time range with 5% padding (or 1 day fallback for same-date items)
  const allDates = items.flatMap(i => [i.startDate, i.endDate])
  const minTime = Math.min(...allDates.map(d => d.getTime()))
  const maxTime = Math.max(...allDates.map(d => d.getTime()))
  const padding = (maxTime - minTime) * 0.05 || 86400000 // 5% padding or 1 day

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        // Use params.value[0] (the explicit category index from the data array)
        // instead of params.dataIndex for robust item lookup in custom series.
        const item = items[params.value[0]]
        if (!item) return ''
        const start = item.startDate.toLocaleDateString()
        const end = item.isActive ? 'ongoing' : item.endDate.toLocaleDateString()
        const days = Math.ceil(
          (item.endDate.getTime() - item.startDate.getTime()) / 86400000
        )
        return [
          `<strong>${item.title}</strong>`,
          item.orgName ? item.orgName : '',
          `Status: ${item.status}`,
          `${start} — ${end} (${days} days)`,
        ].filter(Boolean).join('<br/>')
      },
    },
    grid: {
      left: '20%',
      right: '5%',
      top: '5%',
      bottom: items.length > 10 ? '15%' : '10%',
    },
    xAxis: {
      type: 'time',
      min: minTime - padding,
      max: maxTime + padding,
      axisLabel: {
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'category',
      data: categories,
      inverse: true,   // newest at top
      axisLabel: {
        fontSize: 10,
        width: 150,
        overflow: 'truncate',
      },
    },
    dataZoom: items.length > 10
      ? [
          {
            type: 'slider',
            yAxisIndex: 0,
            right: 0,
            width: 20,
            startValue: 0,
            endValue: 9,
            filterMode: 'weakFilter',
          },
        ]
      : [],
    series: [
      {
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const categoryIndex = api.value(0)
          const start = api.coord([api.value(1), categoryIndex])
          const end = api.coord([api.value(2), categoryIndex])
          const height = api.size([0, 1])[1] * 0.6
          const item = items[categoryIndex]
          const barWidth = Math.max(end[0] - start[0], 4) // min 4px width

          // Two-shape group: solid rect for bar body + dashed line on right edge.
          // ECharts SVG renderer applies lineDash to the entire shape border,
          // not just one edge, so a single rect with lineDash won't work.
          const children: any[] = [
            {
              type: 'rect',
              shape: {
                x: start[0],
                y: start[1] - height / 2,
                width: barWidth,
                height: height,
                r: 3,
              },
              style: {
                fill: item?.color ?? '#d1d5db',
              },
            },
          ]

          // Dashed right edge for active items
          if (item?.isActive) {
            children.push({
              type: 'line',
              shape: {
                x1: start[0] + barWidth,
                y1: start[1] - height / 2,
                x2: start[0] + barWidth,
                y2: start[1] + height / 2,
              },
              style: {
                stroke: item.color,
                lineWidth: 2,
                lineDash: [4, 4],
              },
            })
          }

          return {
            type: 'group',
            children,
          }
        },
        encode: {
          x: [1, 2],
          y: 0,
        },
        data: items.map((item, index) => [
          index,
          item.startDate.getTime(),
          item.endDate.getTime(),
        ]),
      },
    ],
  } as EChartsOption
}

/**
 * Generate mock Gantt items for development and testing.
 * Not for production use — produces deterministic-ish data with all 9 statuses.
 */
export function generateMockGanttItems(count: number = 8): GanttItem[] {
  const statuses = [
    'discovered', 'analyzing', 'applying', 'applied',
    'interviewing', 'offered', 'rejected', 'withdrawn', 'closed',
  ]
  const companies = [
    'Cloudflare', 'Acme Corp', 'BigTech Inc', 'Startup Co',
    'MegaCorp', 'CloudSec', 'DataFlow', 'CyberGuard',
  ]
  const titles = [
    'Sr Security Engineer', 'DevOps Lead', 'Cloud Architect',
    'Platform Engineer', 'Staff SRE', 'Security Architect',
    'Infrastructure Lead', 'DevSecOps Manager',
  ]

  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const daysAgo = 90 - i * 10 + Math.floor(Math.random() * 10)
    const startDate = new Date(now.getTime() - daysAgo * 86400000)
    const status = statuses[i % statuses.length]
    const isActive = !TERMINAL_STATUSES.has(status)
    const duration = (30 + Math.random() * 30) * 86400000
    // Clamp terminal item endDate to now — mock data should not produce future dates.
    const endDate = isActive
      ? now
      : new Date(Math.min(startDate.getTime() + duration, Date.now()))

    return {
      id: `mock-${i}`,
      title: titles[i % titles.length],
      orgName: companies[i % companies.length],
      status,
      startDate,
      endDate,
      isActive,
      color: STATUS_COLORS[status] ?? '#d1d5db',
    }
  })
}
