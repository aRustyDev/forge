/**
 * Choropleth map data aggregation and ECharts option building utilities.
 *
 * Aggregates JDs by US state using the state resolver, precomputes
 * organization breakdown per state for O(1) tooltip lookups, and builds
 * the ECharts map series configuration with continuous indigo visualMap.
 */
import type { EChartsOption } from 'echarts/core'
import { resolveState } from './state-resolver'

/**
 * Aggregated count for a single US state.
 * `name` is the full state name (must match GeoJSON `properties.name`).
 */
export interface StateCount {
  name: string   // full state name (for GeoJSON matching)
  value: number  // count of JDs in this state
  jds: string[]  // JD titles (for tooltip)
}

/**
 * Complete aggregation result from `aggregateByState`.
 * Includes state counts, unresolved JDs, and precomputed org breakdown.
 */
export interface ChoroplethData {
  stateCounts: StateCount[]
  unresolvedCount: number
  unresolvedJDs: string[]   // titles of JDs with unresolvable locations
  totalJDs: number
  /** Precomputed top-5 organizations per state for O(1) tooltip lookups. */
  stateOrgsMap: Map<string, Array<{ name: string; count: number }>>
}

/**
 * Minimal shape of a JD record needed for choropleth aggregation.
 */
interface JDLike {
  id: string
  title: string
  location?: string | null
  organization_name?: string | null
}

/**
 * Aggregate JDs by US state.
 * JDs with unresolvable locations go into the "unresolved" bucket.
 *
 * Precomputes org breakdown per state during aggregation (not on every hover).
 * The tooltip reads from `stateOrgsMap` for O(1) lookup instead of
 * iterating all JDs (O(n)) on each hover.
 */
export function aggregateByState(jds: JDLike[]): ChoroplethData {
  const stateMap = new Map<string, { count: number; jds: string[] }>()
  const stateOrgCountMap = new Map<string, Map<string, number>>()
  const unresolvedJDs: string[] = []

  for (const jd of jds) {
    const state = resolveState(jd.location)
    if (state) {
      const existing = stateMap.get(state) ?? { count: 0, jds: [] }
      existing.count++
      existing.jds.push(jd.title)
      stateMap.set(state, existing)

      // Precompute org counts per state for tooltip (avoids O(n) on each hover)
      if (!stateOrgCountMap.has(state)) stateOrgCountMap.set(state, new Map())
      const orgMap = stateOrgCountMap.get(state)!
      const orgName = jd.organization_name ?? 'Unknown'
      orgMap.set(orgName, (orgMap.get(orgName) ?? 0) + 1)
    } else {
      unresolvedJDs.push(jd.title)
    }
  }

  const stateCounts: StateCount[] = Array.from(stateMap.entries())
    .map(([name, data]) => ({
      name,
      value: data.count,
      jds: data.jds,
    }))
    .sort((a, b) => b.value - a.value)

  // Build precomputed stateOrgsMap: state -> sorted top-5 org list
  const stateOrgsMap = new Map<string, Array<{ name: string; count: number }>>()
  for (const [state, orgMap] of stateOrgCountMap) {
    const orgs = Array.from(orgMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    stateOrgsMap.set(state, orgs)
  }

  return {
    stateCounts,
    unresolvedCount: unresolvedJDs.length,
    unresolvedJDs,
    totalJDs: jds.length,
    stateOrgsMap,
  }
}

/**
 * For a given state, get the top organizations (by JD count).
 *
 * Note: For tooltip rendering, prefer ChoroplethData.stateOrgsMap
 * (precomputed during aggregation) to avoid O(n) on every hover.
 * This function is retained for the selected-state detail panel.
 */
export function getStateOrgs(
  jds: JDLike[],
  stateName: string,
): Array<{ name: string; count: number }> {
  const orgMap = new Map<string, number>()

  for (const jd of jds) {
    const state = resolveState(jd.location)
    if (state !== stateName) continue

    const orgName = jd.organization_name ?? 'Unknown'
    orgMap.set(orgName, (orgMap.get(orgName) ?? 0) + 1)
  }

  return Array.from(orgMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)  // top 5 orgs
}

/**
 * Build ECharts option for the choropleth map.
 * Uses map series with continuous visualMap (indigo color scale).
 *
 * Tooltip reads from precomputed stateOrgsMap for O(1) lookup.
 *
 * visualMap dimensions are swapped for horizontal orientation:
 * `itemWidth: 120` is the length (horizontal extent),
 * `itemHeight: 15` is the thickness. ECharts named these for vertical
 * orientation, so horizontal requires swapping the conceptual meaning.
 */
export function buildChoroplethOption(
  data: ChoroplethData,
): EChartsOption {
  const maxValue = Math.max(...data.stateCounts.map(s => s.value), 1)

  return {
    title: {
      text: 'JD Distribution by State',
      subtext: `${data.totalJDs} total \u2022 ${data.unresolvedCount} remote/unknown`,
      left: 'center',
      top: 10,
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const stateName = params.name
        const count = params.value ?? 0

        if (count === 0 || isNaN(count)) {
          return `<strong>${stateName}</strong><br/>No JDs`
        }

        // Read from precomputed stateOrgsMap instead of iterating all JDs (O(1) vs O(n))
        const orgs = data.stateOrgsMap.get(stateName) ?? []
        const orgLines = orgs
          .map(o => `  ${o.name}: ${o.count}`)
          .join('<br/>')

        return [
          `<strong>${stateName}</strong>`,
          `${count} JD${count !== 1 ? 's' : ''}`,
          orgs.length > 0 ? `<br/>Top orgs:<br/>${orgLines}` : '',
        ].join('<br/>')
      },
    },
    visualMap: {
      type: 'continuous',
      min: 0,
      max: maxValue,
      left: 'left',
      top: 'bottom',
      text: ['High', 'Low'],
      inRange: {
        color: ['#e0e7ff', '#818cf8', '#4f46e5', '#312e81'],
      },
      calculable: false,
      orient: 'horizontal',
      // NOTE: itemWidth and itemHeight names are swapped for horizontal orientation.
      // itemWidth: 120 is the length (horizontal extent), itemHeight: 15 is the thickness.
      itemWidth: 120,
      itemHeight: 15,
    },
    series: [
      {
        type: 'map',
        map: 'USA',
        roam: true,           // enable pan/zoom
        aspectScale: 0.75,    // US map aspect ratio
        layoutCenter: ['50%', '50%'],
        layoutSize: '95%',
        emphasis: {
          label: { show: true, fontSize: 10 },
          itemStyle: {
            areaColor: '#fbbf24',
            borderColor: '#374151',
            borderWidth: 1,
          },
        },
        select: {
          label: { show: true },
          itemStyle: {
            areaColor: '#f59e0b',
          },
        },
        data: data.stateCounts.map(s => ({
          name: s.name,
          value: s.value,
        })),
      },
    ],
  } as EChartsOption
}
