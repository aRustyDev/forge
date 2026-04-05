<!--
  EChart.svelte — Reusable ECharts wrapper component.

  Handles initialization, reactive option updates, responsive resizing,
  theme integration (light/dark), loading state, and cleanup.

  Usage:
    <EChart option={chartOption} height="400px" />
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { echarts } from './echarts-registry'
  import { buildEChartsTheme } from './echarts-theme'
  import type { EChartsOption, ECharts } from 'echarts/core'

  let {
    /** ECharts configuration object. Reactive — changes trigger setOption(). */
    option,
    /** CSS height for the chart container. */
    height = '400px',
    /** CSS width for the chart container. */
    width = '100%',
    /** When true, shows ECharts' built-in loading spinner overlay. */
    loading = false,
    /** When true, setOption() replaces entire option instead of merging. */
    notMerge = false,
    /** Map of ECharts event names to handlers. Each calls chart.on(). */
    onChartEvent,
  }: {
    option: EChartsOption
    height?: string
    width?: string
    loading?: boolean
    notMerge?: boolean
    onChartEvent?: Record<string, (params: any) => void>
  } = $props()

  let chartEl: HTMLDivElement
  /** Chart instance as $state so $effect can track null -> initialized transition. */
  let chart = $state<ECharts | null>(null)
  let resizeObserver: ResizeObserver | null = null
  let themeObserver: MutationObserver | null = null
  let mediaQuery: MediaQueryList | null = null

  // ── Initialization ──────────────────────────────────────────────

  // The $effect watching `option` (below) handles the initial setOption
  // when `chart` transitions from null to initialized. No redundant
  // setOption call needed in onMount.
  onMount(() => {
    const theme = buildEChartsTheme()
    chart = echarts.init(chartEl, theme, { renderer: 'svg' })

    // ── Event forwarding ──────────────────────────────────────
    if (onChartEvent) {
      for (const [eventName, handler] of Object.entries(onChartEvent)) {
        chart.on(eventName, handler)
      }
    }

    // Loading spinner color from CSS token, not hardcoded
    if (loading) {
      chart.showLoading('default', {
        text: '',
        color: getComputedStyle(chartEl).getPropertyValue('--color-primary').trim() || '#6c63ff',
        maskColor: (() => { const s = getComputedStyle(chartEl).getPropertyValue('--color-surface').trim(); return s ? s.replace(')', ', 0.7)').replace('rgb(', 'rgba(') : 'rgba(255,255,255,0.7)'; })(),
      })
    }

    // ── Responsive resize ───────────────────────────────────────
    resizeObserver = new ResizeObserver(() => {
      chart?.resize()
    })
    resizeObserver.observe(chartEl)

    // ── Theme change listener (data-theme attribute) ────────────
    themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-theme'
        ) {
          rebuildWithTheme()
          break
        }
      }
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    // ── OS-level dark/light mode detection ────────────────────
    // matchMedia listener detects OS-level dark/light switches that
    // do not change the data-theme attribute (when theme is set to "system").
    if (typeof matchMedia !== 'undefined') {
      mediaQuery = matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', rebuildWithTheme)
    }
  })

  // ── Reactive option updates ─────────────────────────────────────

  $effect(() => {
    if (chart) {
      chart.setOption(option, notMerge)
    }
  })

  // ── Loading state ───────────────────────────────────────────────

  $effect(() => {
    if (!chart) return
    if (loading) {
      chart.showLoading('default', {
        text: '',
        color: getComputedStyle(chartEl).getPropertyValue('--color-primary').trim() || '#6c63ff',
        maskColor: (() => { const s = getComputedStyle(chartEl).getPropertyValue('--color-surface').trim(); return s ? s.replace(')', ', 0.7)').replace('rgb(', 'rgba(') : 'rgba(255,255,255,0.7)'; })(),
      })
    } else {
      chart.hideLoading()
    }
  })

  // ── Theme rebuild ───────────────────────────────────────────────

  /**
   * Rebuild the chart with a fresh theme. Called when data-theme attribute
   * changes or OS dark/light preference changes.
   *
   * Sequence: disconnect resize observer -> capture current option ->
   * dispose chart -> rebuild theme -> re-init -> re-apply option ->
   * re-register event handlers -> reconnect resize observer.
   *
   * The resize observer is disconnected before dispose to avoid race
   * conditions where the observer fires on a disposed chart.
   */
  function rebuildWithTheme() {
    if (!chart) return
    const currentOption = chart.getOption()

    // Disconnect resize observer before dispose to avoid race conditions
    resizeObserver?.disconnect()

    chart.dispose()

    const theme = buildEChartsTheme()
    chart = echarts.init(chartEl, theme, { renderer: 'svg' })
    chart.setOption(currentOption as EChartsOption)

    // Re-register event handlers after re-init
    if (onChartEvent) {
      for (const [eventName, handler] of Object.entries(onChartEvent)) {
        chart.on(eventName, handler)
      }
    }

    // Reconnect resize observer
    resizeObserver?.observe(chartEl)
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  onDestroy(() => {
    resizeObserver?.disconnect()
    themeObserver?.disconnect()
    mediaQuery?.removeEventListener('change', rebuildWithTheme)
    chart?.dispose()
    chart = null
  })
</script>

<div
  bind:this={chartEl}
  class="echart-container"
  style:height
  style:width
></div>

<style>
  .echart-container {
    min-height: 200px;
  }
</style>
