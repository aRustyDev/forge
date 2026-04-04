import type { EChartsOption } from 'echarts'
import type { Skill, Bullet, Perspective } from '@forge/sdk'

// ── Types ────────────────────────────────────────────────────────────────

export interface TreemapNode {
  name: string
  value: number
  children?: TreemapNode[]
  itemStyle?: { color?: string }
  perspectiveCount?: number   // type-safe tooltip data for domains treemap
  bulletCount?: number        // type-safe tooltip data (reserved for future use)
}

// ── Skills Treemap ───────────────────────────────────────────────────────

/**
 * Build treemap data: skills grouped by category, sized by bullet technology count.
 */
export function buildSkillsTreemapData(
  skills: Skill[],
  bullets: Bullet[],
): TreemapNode[] {
  // Count technology references across all bullets
  const techCounts = new Map<string, number>()
  for (const bullet of bullets) {
    for (const tech of bullet.technologies) {
      const key = tech.toLowerCase()
      techCounts.set(key, (techCounts.get(key) ?? 0) + 1)
    }
  }

  // Group skills by category
  const categories = new Map<string, TreemapNode[]>()
  for (const skill of skills) {
    const cat = skill.category ?? 'uncategorized'
    if (!categories.has(cat)) categories.set(cat, [])

    const usage = techCounts.get(skill.name.toLowerCase()) ?? 0
    categories.get(cat)!.push({
      name: skill.name,
      value: Math.max(usage, 1),  // minimum 1 so unused skills appear
    })
  }

  // Convert to treemap hierarchy, sorted by total value descending
  return Array.from(categories.entries())
    .map(([category, children]) => ({
      name: category,
      value: children.reduce((sum, c) => sum + c.value, 0),
      children: children.sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => b.value - a.value)
}

/** Build ECharts option for the skills treemap. */
export function buildSkillsTreemapOption(data: TreemapNode[]): EChartsOption {
  return {
    title: {
      text: 'Skills Usage Treemap',
      subtext: 'Sized by bullet reference count, grouped by category',
      left: 'center',
      top: 10,
    },
    tooltip: {
      formatter: (params: any) => {
        const path = params.treePathInfo
          ?.map((p: any) => p.name)
          .filter(Boolean)
          .join(' > ')
        return `${path}<br/>References: <strong>${params.value}</strong>`
      },
    },
    series: [
      {
        type: 'treemap',
        data: data,
        width: '95%',
        height: '80%',
        top: 60,
        roam: false,
        nodeClick: 'zoomToNode',
        breadcrumb: {
          show: true,
          top: 35,
          left: 'center',
          itemStyle: {
            color: '#f9fafb',
            borderColor: '#e5e7eb',
            textStyle: { color: '#374151', fontSize: 11 },
          },
        },
        levels: [
          {
            // Category level
            itemStyle: {
              borderWidth: 2,
              borderColor: '#fff',
              gapWidth: 2,
            },
            upperLabel: {
              show: true,
              height: 20,
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              textShadowBlur: 2,
              textShadowColor: 'rgba(0,0,0,0.3)',
            },
            colorSaturation: [0.4, 0.7],
          },
          {
            // Skill level
            itemStyle: {
              borderWidth: 1,
              borderColor: '#fff',
              gapWidth: 1,
            },
            label: {
              show: true,
              fontSize: 10,
              formatter: '{b}',
            },
            colorSaturation: [0.3, 0.6],
            colorMappingBy: 'value',
          },
        ],
        colorMappingBy: 'index',
      },
    ],
  }
}

// ── Bullets Treemap ──────────────────────────────────────────────────────

/**
 * Build treemap data: bullets grouped by primary source, sized by perspective count.
 */
export function buildBulletsTreemapData(
  bullets: Bullet[],
  perspectiveCounts: Map<string, number>,
): TreemapNode[] {
  // Group bullets by primary source
  const sourceGroups = new Map<string, { title: string; bullets: TreemapNode[] }>()

  for (const bullet of bullets) {
    const primarySource = bullet.sources?.find(s => s.is_primary)
    const sourceTitle = primarySource?.title ?? 'No Source'
    const sourceId = primarySource?.id ?? '_no_source'

    if (!sourceGroups.has(sourceId)) {
      sourceGroups.set(sourceId, { title: sourceTitle, bullets: [] })
    }

    const perspCount = perspectiveCounts.get(bullet.id) ?? 0
    sourceGroups.get(sourceId)!.bullets.push({
      name: bullet.content.length > 60
        ? bullet.content.slice(0, 57) + '...'
        : bullet.content,
      value: Math.max(perspCount, 1),  // minimum 1 for bullets with no perspectives
    })
  }

  return Array.from(sourceGroups.values())
    .map(({ title, bullets }) => ({
      name: title,
      value: bullets.reduce((sum, b) => sum + b.value, 0),
      children: bullets.sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => b.value - a.value)
}

/** Build ECharts option for the bullets treemap. */
export function buildBulletsTreemapOption(data: TreemapNode[]): EChartsOption {
  return {
    title: {
      text: 'Bullets by Source',
      subtext: 'Sized by perspective count, grouped by primary source',
      left: 'center',
      top: 10,
    },
    tooltip: {
      formatter: (params: any) => {
        const name = params.data?.name ?? params.name
        const truncated = name.length > 100 ? name.slice(0, 97) + '...' : name
        return `${truncated}<br/>Perspectives: <strong>${params.value}</strong>`
      },
    },
    series: [
      {
        type: 'treemap',
        data: data,
        width: '95%',
        height: '80%',
        top: 60,
        roam: false,
        nodeClick: 'zoomToNode',
        breadcrumb: {
          show: true,
          top: 35,
          left: 'center',
        },
        levels: [
          {
            // Source level
            itemStyle: {
              borderWidth: 2,
              borderColor: '#fff',
              gapWidth: 2,
            },
            upperLabel: {
              show: true,
              height: 22,
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              textShadowBlur: 2,
              textShadowColor: 'rgba(0,0,0,0.3)',
            },
            colorSaturation: [0.4, 0.7],
          },
          {
            // Bullet level
            itemStyle: {
              borderWidth: 1,
              borderColor: '#fff',
              gapWidth: 1,
            },
            label: {
              show: true,
              fontSize: 9,
              formatter: (params: any) => {
                const name = params.data?.name ?? ''
                return name.length > 30 ? name.slice(0, 27) + '...' : name
              },
            },
            colorSaturation: [0.3, 0.6],
            colorMappingBy: 'value',
          },
        ],
        colorMappingBy: 'index',
      },
    ],
  }
}

// ── Domains Treemap ──────────────────────────────────────────────────────

/**
 * Build treemap data: domains sized by perspective count.
 *
 * The `domain` field exists on `Perspective`, not `Bullet`.
 * This function accepts only perspectives and groups by `p.domain`.
 */
export function buildDomainsTreemapData(
  perspectives: Perspective[],
): TreemapNode[] {
  const domainCounts = new Map<string, { perspectiveCount: number }>()

  for (const p of perspectives) {
    const domain = p.domain ?? 'unassigned'
    if (!domainCounts.has(domain)) {
      domainCounts.set(domain, { perspectiveCount: 0 })
    }
    domainCounts.get(domain)!.perspectiveCount++
  }

  return Array.from(domainCounts.entries())
    .map(([domain, counts]) => ({
      name: domain,
      value: counts.perspectiveCount,
      perspectiveCount: counts.perspectiveCount,
    }))
    .sort((a, b) => b.value - a.value) as TreemapNode[]
}

/** Build ECharts option for the domains treemap. */
export function buildDomainsTreemapOption(data: TreemapNode[]): EChartsOption {
  return {
    title: {
      text: 'Domain Coverage',
      subtext: 'Sized by perspective count',
      left: 'center',
      top: 10,
    },
    tooltip: {
      formatter: (params: any) => {
        const d = params.data
        const pCount = d?.perspectiveCount ?? 0
        return `<strong>${params.name}</strong><br/>
                Perspectives: ${pCount}`
      },
    },
    series: [
      {
        type: 'treemap',
        data: data,
        width: '95%',
        height: '80%',
        top: 60,
        roam: false,
        nodeClick: false,  // single level — no drill-down
        breadcrumb: { show: false },
        label: {
          show: true,
          fontSize: 14,
          fontWeight: 600,
          formatter: '{b}\n{c}',
          color: '#fff',
          textShadowBlur: 2,
          textShadowColor: 'rgba(0,0,0,0.3)',
        },
        itemStyle: {
          borderWidth: 2,
          borderColor: '#fff',
          gapWidth: 2,
        },
        levels: [
          {
            colorSaturation: [0.4, 0.7],
          },
        ],
        colorMappingBy: 'index',
      },
    ],
  }
}
