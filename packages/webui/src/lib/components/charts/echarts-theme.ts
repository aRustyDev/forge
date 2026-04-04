/**
 * Build an ECharts theme object from CSS custom property values.
 *
 * IMPORTANT: Call this function at render time (inside `onMount`), not at
 * module scope. CSS custom properties are only available after the document
 * has loaded and the `<style>` has been applied. Calling at module scope
 * returns fallback values.
 *
 * The function reads CSS custom properties from `document.documentElement`
 * via `getComputedStyle`. This requires a browser context — it must never
 * be called during SSR.
 *
 * Fallback values are provided for every token so the theme degrades
 * gracefully if a CSS custom property is not defined.
 */
export function buildEChartsTheme(): object {
  const root = getComputedStyle(document.documentElement)

  function token(name: string, fallback: string): string {
    return root.getPropertyValue(name).trim() || fallback
  }

  return {
    // ── Color palette ────────────────────────────────────────────
    color: [
      token('--color-chart-1', '#6c63ff'),
      token('--color-chart-2', '#22c55e'),
      token('--color-chart-3', '#f59e0b'),
      token('--color-chart-4', '#ef4444'),
      token('--color-chart-5', '#06b6d4'),
      token('--color-chart-6', '#8b5cf6'),
      token('--color-chart-7', '#ec4899'),
      token('--color-chart-8', '#14b8a6'),
    ],

    // ── Background ───────────────────────────────────────────────
    backgroundColor: 'transparent',

    // ── Title ────────────────────────────────────────────────────
    title: {
      textStyle: {
        color: token('--text-primary', '#1a1a2e'),
        fontSize: 16,
        fontWeight: 600,
        fontFamily: token('--font-sans', 'Inter, system-ui, sans-serif'),
      },
      subtextStyle: {
        color: token('--text-secondary', '#6b7280'),
        fontSize: 12,
        fontFamily: token('--font-sans', 'Inter, system-ui, sans-serif'),
      },
    },

    // ── Legend ────────────────────────────────────────────────────
    legend: {
      textStyle: {
        color: token('--text-primary', '#1a1a2e'),
        fontFamily: token('--font-sans', 'Inter, system-ui, sans-serif'),
      },
    },

    // ── Tooltip ──────────────────────────────────────────────────
    tooltip: {
      backgroundColor: token('--color-surface', '#ffffff'),
      borderColor: token('--border-primary', '#e5e7eb'),
      textStyle: {
        color: token('--text-primary', '#1a1a2e'),
        fontFamily: token('--font-sans', 'Inter, system-ui, sans-serif'),
      },
    },

    // ── Category Axis ────────────────────────────────────────────
    categoryAxis: {
      axisLine: { lineStyle: { color: token('--border-primary', '#e5e7eb') } },
      axisLabel: { color: token('--text-secondary', '#6b7280') },
      splitLine: { lineStyle: { color: token('--border-subtle', '#f3f4f6') } },
    },

    // ── Value Axis ───────────────────────────────────────────────
    valueAxis: {
      axisLine: { lineStyle: { color: token('--border-primary', '#e5e7eb') } },
      axisLabel: { color: token('--text-secondary', '#6b7280') },
      splitLine: { lineStyle: { color: token('--border-subtle', '#f3f4f6') } },
    },
  }
}
