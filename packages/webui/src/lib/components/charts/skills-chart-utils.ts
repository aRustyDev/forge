import type { EChartsOption } from 'echarts'
import type { Skill, Bullet, Perspective } from '@forge/sdk'

// ── Types ────────────────────────────────────────────────────────────────

export interface SunburstChild {
  name: string
  value: number
}

export interface SunburstDataItem {
  name: string
  children: SunburstChild[]
}

export interface PieDataItem {
  name: string
  value: number
}

// ── Color Resolution ─────────────────────────────────────────────────────

/**
 * Resolve a CSS custom property value at render time.
 * ECharts cannot interpret `var(--token)` strings directly.
 * Must be called in browser context (onMount, event handler), never at module scope.
 *
 * [STYLE] Use `resolveTokenColor('--color-text')` for ECharts config values.
 * Direct CSS var strings (`var(--...)`) cannot be used in ECharts options --
 * ECharts expects resolved color strings (#hex, rgb(), etc.), not CSS functions.
 */
export function resolveTokenColor(token: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback
}

/** Build resolved domain color map. Call at render time, not module scope. */
export function buildDomainColors(): Record<string, string> {
  return {
    security:       resolveTokenColor('--color-chart-1', '#6c63ff'),
    cloud:          resolveTokenColor('--color-chart-2', '#22c55e'),
    ai_ml:          resolveTokenColor('--color-chart-3', '#f59e0b'),
    infrastructure: resolveTokenColor('--color-chart-4', '#ef4444'),
    data:           resolveTokenColor('--color-chart-5', '#06b6d4'),
    general:        resolveTokenColor('--color-chart-6', '#8b5cf6'),
    devops:         resolveTokenColor('--color-chart-7', '#ec4899'),
    unassigned:     resolveTokenColor('--color-chart-8', '#14b8a6'),
  }
}

// ── Skills Sunburst ──────────────────────────────────────────────────────

/**
 * Build ECharts sunburst data from skills + bullets.
 *
 * Since the SDK's Bullet type includes a `technologies: string[]` field
 * (which maps to bullet_technologies), we count technology references
 * per skill name. Usage = bullet technology count.
 */
export function buildSkillsSunburstData(
  skills: Skill[],
  bullets: Bullet[],
): SunburstDataItem[] {
  // Build a map: skill name (lowercased) -> count of bullets referencing it
  const techCounts = new Map<string, number>()
  for (const bullet of bullets) {
    for (const tech of bullet.technologies) {
      const key = tech.toLowerCase()
      techCounts.set(key, (techCounts.get(key) ?? 0) + 1)
    }
  }

  // Group skills by category
  const categories = new Map<string, Array<{ name: string; value: number }>>()
  for (const skill of skills) {
    const cat = skill.category ?? 'uncategorized'
    if (!categories.has(cat)) categories.set(cat, [])
    const usage = techCounts.get(skill.name.toLowerCase()) ?? 0
    categories.get(cat)!.push({
      name: skill.name,
      value: Math.max(usage, 1),  // minimum 1 so unused skills still appear
    })
  }

  // Convert to ECharts sunburst format
  return Array.from(categories.entries()).map(([category, children]) => ({
    name: category,
    children: children.sort((a, b) => b.value - a.value),
  }))
}

/** Get children for a specific category from sunburst data. */
export function getCategoryChildren(
  categoryName: string,
  data: SunburstDataItem[],
): SunburstChild[] {
  return data.find(d => d.name === categoryName)?.children ?? []
}

/** Build full sunburst ECharts option (all categories visible). */
export function buildSunburstOption(
  data: SunburstDataItem[],
  totalSkills: number,
): EChartsOption {
  return {
    title: {
      text: 'Skills by Category',
      left: 'center',
      top: 10,
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.treePathInfo?.length === 1) return ''
        const path = params.treePathInfo
          ?.map((p: any) => p.name)
          .filter(Boolean)
          .join(' > ')
        return `${path}<br/>Usage: <strong>${params.value}</strong>`
      },
    },
    series: [
      {
        type: 'sunburst',
        data: data,
        radius: ['20%', '90%'],
        center: ['50%', '55%'],
        sort: 'desc',
        emphasis: {
          focus: 'ancestor',
        },
        levels: [
          {},  // root
          {
            r0: '20%',
            r: '50%',
            itemStyle: { borderWidth: 2, borderColor: '#fff' },
            label: {
              rotate: 'tangential',
              fontSize: 11,
              fontWeight: 600,
            },
          },
          {
            r0: '50%',
            r: '90%',
            itemStyle: { borderWidth: 1, borderColor: '#fff' },
            label: {
              position: 'outside',
              fontSize: 9,
              padding: 2,
              silent: false,
            },
          },
        ],
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '50%',
        style: {
          text: `${totalSkills}\nskills`,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 700,
          fill: '#374151',
        },
      },
    ],
  }
}

/** Build drill-down pie option for a single category. */
export function buildDrillDownOption(
  categoryName: string,
  children: SunburstChild[],
): EChartsOption {
  return {
    title: {
      text: categoryName,
      subtext: 'Click center to go back',
      left: 'center',
      top: 10,
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: ['25%', '75%'],
        center: ['50%', '55%'],
        data: children.map(c => ({ name: c.name, value: c.value })),
        label: { show: true, fontSize: 10 },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
        },
      },
    ],
    graphic: [
      {
        type: 'circle',
        left: 'center',
        top: 'middle',
        shape: { r: 40 },
        style: { fill: 'transparent' },
        onclick: () => {
          // Reset handled by component state, not by graphic element
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '50%',
        style: {
          text: 'Back',
          textAlign: 'center',
          fontSize: 12,
          fill: '#6c63ff',
          cursor: 'pointer',
        },
      },
    ],
  }
}

// ── Domain-Archetype Breakout ────────────────────────────────────────────

/**
 * Build nested pie data from perspectives.
 * Groups by domain (inner ring) then target_archetype (outer ring).
 */
export function buildDomainArchetypeData(
  perspectives: Perspective[],
): { inner: PieDataItem[]; outer: PieDataItem[] } {
  const groups = new Map<string, Map<string, number>>()

  for (const p of perspectives) {
    const domain = p.domain ?? 'unassigned'
    const archetype = p.target_archetype ?? 'unassigned'

    if (!groups.has(domain)) groups.set(domain, new Map())
    const archetypes = groups.get(domain)!
    archetypes.set(archetype, (archetypes.get(archetype) ?? 0) + 1)
  }

  const inner: PieDataItem[] = []
  const outer: PieDataItem[] = []

  for (const [domain, archetypes] of groups) {
    let domainTotal = 0
    for (const [archetype, count] of archetypes) {
      outer.push({ name: `${archetype}`, value: count })
      domainTotal += count
    }
    inner.push({ name: domain, value: domainTotal })
  }

  return { inner, outer }
}

/** Build ECharts option for the domain-archetype nested pie. */
export function buildDomainArchetypeOption(
  inner: PieDataItem[],
  outer: PieDataItem[],
): EChartsOption {
  return {
    title: {
      text: 'Perspectives by Domain & Archetype',
      left: 'center',
      top: 10,
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 10,
      top: 50,
      bottom: 20,
      data: inner.map(d => d.name),
    },
    series: [
      {
        name: 'Domain',
        type: 'pie',
        radius: ['0%', '40%'],
        center: ['40%', '55%'],
        label: {
          position: 'inner',
          fontSize: 11,
          fontWeight: 600,
        },
        data: inner,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
        },
      },
      {
        name: 'Archetype',
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['40%', '55%'],
        label: {
          fontSize: 9,
          formatter: '{b}: {c}',
        },
        data: outer,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
        },
      },
    ],
  }
}
