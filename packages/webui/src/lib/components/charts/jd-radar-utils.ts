/**
 * JD Skill Alignment Radar Chart Utilities
 *
 * Pure functions for computing JD-to-user skill alignment and
 * generating ECharts radar/bar chart options.
 *
 * User skills are derived from bullet technologies (bullet_technologies
 * junction). JD skills come from job_description_skills junction.
 * Skills are matched by name (case-insensitive).
 */

import type { EChartsOption } from 'echarts/core'

// ── Interfaces ──────────────────────────────────────────────────────

/** Per-category comparison between JD requirements and user skills. */
export interface CategoryComparison {
  /** Skill category name (e.g., "languages", "cloud"). */
  category: string
  /** Number of JD-required skills in this category. */
  jdCount: number
  /** Number of JD-required skills the user has (matched). */
  matchedCount: number
  /** Names of all JD-required skills in this category. */
  jdSkills: string[]
  /** Names of matched skills (user has these). */
  matchedSkills: string[]
  /** Names of unmatched skills (user does not have these). */
  gapSkills: string[]
}

/** Aggregated skill alignment result across all categories. */
export interface JDSkillAlignment {
  /** Per-category breakdown, sorted by jdCount descending. */
  categories: CategoryComparison[]
  /** Total number of JD-required skills across all categories. */
  totalJDSkills: number
  /** Total number of matched skills across all categories. */
  totalMatched: number
  /** Overall match percentage (0-100). 100 when no JD skills tagged. */
  matchPercentage: number
}

// Minimal shape expected from SDK entities — avoids importing full types
// to keep this module decoupled from the SDK.
interface SkillLike {
  id: string
  name: string
  category: string | null
}

interface BulletLike {
  technologies: string[]
}

// ── Computation ─────────────────────────────────────────────────────

/**
 * Compare JD-required skills against the user's skill inventory.
 *
 * User skills are derived from bullet technologies (bullet_technologies
 * junction). JD skills come from job_description_skills junction.
 * Skills are matched by name (case-insensitive).
 *
 * Categories with zero JD-required skills do not appear as axes.
 * The chart is JD-centric — only categories present in the JD's skill
 * set are shown.
 */
export function computeJDSkillAlignment(
  jdSkills: SkillLike[],
  allSkills: SkillLike[],
  bullets: BulletLike[],
): JDSkillAlignment {
  // Build a set of user's skill names (from bullet technologies)
  const userSkillNames = new Set<string>()
  for (const bullet of bullets) {
    for (const tech of bullet.technologies) {
      userSkillNames.add(tech.toLowerCase())
    }
  }

  // Build a map: skill id -> skill (for category lookup)
  const skillById = new Map(allSkills.map(s => [s.id, s]))

  // Group JD skills by category, compare against user skills
  const categoryMap = new Map<string, CategoryComparison>()

  for (const jdSkill of jdSkills) {
    const fullSkill = skillById.get(jdSkill.id) ?? jdSkill
    const category = fullSkill.category ?? 'uncategorized'

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        jdCount: 0,
        matchedCount: 0,
        jdSkills: [],
        matchedSkills: [],
        gapSkills: [],
      })
    }

    const cat = categoryMap.get(category)!
    cat.jdCount++
    cat.jdSkills.push(fullSkill.name)

    if (userSkillNames.has(fullSkill.name.toLowerCase())) {
      cat.matchedCount++
      cat.matchedSkills.push(fullSkill.name)
    } else {
      cat.gapSkills.push(fullSkill.name)
    }
  }

  const categories = Array.from(categoryMap.values())
    .sort((a, b) => b.jdCount - a.jdCount)

  const totalJDSkills = categories.reduce((sum, c) => sum + c.jdCount, 0)
  const totalMatched = categories.reduce((sum, c) => sum + c.matchedCount, 0)
  const matchPercentage = totalJDSkills === 0
    ? 100
    : Math.round((totalMatched / totalJDSkills) * 100)

  return { categories, totalJDSkills, totalMatched, matchPercentage }
}

// ── ECharts Option Builders ─────────────────────────────────────────

/**
 * Build ECharts radar option for JD skill alignment.
 *
 * Requires 3+ categories for a meaningful polygon. Each radar axis
 * represents a skill category; its max value equals the number of
 * JD-required skills in that category. Two overlaid polygons show
 * JD requirements (purple) vs. user skills (green). A center text
 * graphic shows the overall match percentage with color coding:
 * green >= 75%, amber >= 50%, red < 50%.
 */
export function buildRadarOption(alignment: JDSkillAlignment): EChartsOption {
  const categories = alignment.categories
  const maxValues = categories.map(c => c.jdCount)

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const seriesName = params.seriesName
        return categories
          .map((cat, i) => {
            const matched = cat.matchedSkills.join(', ') || 'none'
            const gaps = cat.gapSkills.join(', ') || 'none'
            if (seriesName === 'JD Requirements') {
              return `<strong>${cat.category}</strong>: ${cat.jdCount} skill${cat.jdCount !== 1 ? 's' : ''}<br/>${cat.jdSkills.join(', ')}`
            }
            return `<strong>${cat.category}</strong>: ${cat.matchedCount}/${cat.jdCount}<br/>Matched: ${matched}<br/>Gaps: ${gaps}`
          })
          .join('<br/><br/>')
      },
    },
    legend: {
      data: ['JD Requirements', 'Your Skills'],
      bottom: 10,
    },
    radar: {
      indicator: categories.map(c => ({
        name: `${c.category}\n(${c.matchedCount}/${c.jdCount})`,
        max: c.jdCount,
      })),
      center: ['50%', '50%'],
      radius: '65%',
      axisName: {
        fontSize: 11,
        color: '#6b7280',
      },
      splitNumber: 4,
      splitArea: {
        areaStyle: {
          color: ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.04)'],
        },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            name: 'JD Requirements',
            value: categories.map(c => c.jdCount),
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { width: 2, color: '#6c63ff' },
            areaStyle: { color: 'rgba(108, 99, 255, 0.12)' },
            itemStyle: { color: '#6c63ff' },
          },
          {
            name: 'Your Skills',
            value: categories.map(c => c.matchedCount),
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { width: 2, color: '#22c55e' },
            areaStyle: { color: 'rgba(34, 197, 94, 0.25)' },
            itemStyle: { color: '#22c55e' },
          },
        ],
      },
    ],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '46%',
        style: {
          text: `${alignment.matchPercentage}%`,
          textAlign: 'center',
          fontSize: 28,
          fontWeight: 700,
          fill: alignment.matchPercentage >= 75 ? '#22c55e'
            : alignment.matchPercentage >= 50 ? '#f59e0b'
            : '#ef4444',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '53%',
        style: {
          text: 'match',
          textAlign: 'center',
          fontSize: 11,
          fill: '#6b7280',
        },
      },
    ],
  } as EChartsOption
}

/**
 * Fallback bar chart option for < 3 categories.
 *
 * A radar chart with fewer than 3 axes renders as a line (2 axes) or
 * a point (1 axis), which is uninformative. This function produces a
 * horizontal stacked bar chart showing matched vs. gap counts per
 * category, with a match percentage label.
 */
export function buildFallbackBarOption(alignment: JDSkillAlignment): EChartsOption {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: ['Matched', 'Gap'],
      bottom: 10,
    },
    grid: {
      left: '15%',
      right: '10%',
      top: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'value',
      name: 'Skills',
    },
    yAxis: {
      type: 'category',
      data: alignment.categories.map(c => c.category),
    },
    series: [
      {
        name: 'Matched',
        type: 'bar',
        stack: 'total',
        data: alignment.categories.map(c => c.matchedCount),
        itemStyle: { color: '#22c55e' },
      },
      {
        name: 'Gap',
        type: 'bar',
        stack: 'total',
        data: alignment.categories.map(c => c.jdCount - c.matchedCount),
        itemStyle: { color: '#e5e7eb' },
      },
    ],
    graphic: [
      {
        type: 'text',
        right: '10%',
        top: 5,
        style: {
          text: `${alignment.matchPercentage}% match`,
          fontSize: 14,
          fontWeight: 600,
          fill: '#374151',
        },
      },
    ],
  } as EChartsOption
}
