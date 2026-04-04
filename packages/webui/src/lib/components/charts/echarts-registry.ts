/**
 * Centralized ECharts chart type and component registration.
 *
 * All chart types and components are imported from tree-shakeable paths
 * (`echarts/core`, `echarts/charts`, `echarts/components`, `echarts/renderers`)
 * and registered once here. Consumer modules import the configured `echarts`
 * instance from this module instead of from `echarts` directly.
 *
 * Adding a new chart type (e.g., `BarChart` for J3) requires a single import
 * + `use()` entry here. No other files change.
 *
 * Import pattern for consumers:
 *   import { echarts } from '$lib/components/charts/echarts-registry'
 *
 * Registered chart types: Pie, Sunburst, Treemap, Custom (Gantt), Map (Choropleth),
 *   Radar (Phase 65 JD skill alignment), Bar (Phase 65 fallback + Phase 66 compensation)
 * Renderer: SVG (crisper text, smaller module, sufficient for Forge's data volumes)
 */
import * as echarts from 'echarts/core'

// ── Chart types ──────────────────────────────────────────────────
import { PieChart } from 'echarts/charts'
import { SunburstChart } from 'echarts/charts'
import { TreemapChart } from 'echarts/charts'
import { CustomChart } from 'echarts/charts'
import { MapChart } from 'echarts/charts'
import { RadarChart } from 'echarts/charts'
import { BarChart } from 'echarts/charts'

// ── Components ───────────────────────────────────────────────────
import { TooltipComponent } from 'echarts/components'
import { LegendComponent } from 'echarts/components'
import { TitleComponent } from 'echarts/components'
import { GridComponent } from 'echarts/components'
import { VisualMapComponent } from 'echarts/components'
import { DatasetComponent } from 'echarts/components'
import { TransformComponent } from 'echarts/components'
import { GraphicComponent } from 'echarts/components' // Phase 63's sunburst center-text label requires this
import { RadarComponent } from 'echarts/components' // Phase 65: radar coordinate system for skill alignment
import { MarkAreaComponent, MarkLineComponent } from 'echarts/components' // Phase 66: compensation chart bands/lines
import { DataZoomComponent } from 'echarts/components' // Phase 67: Gantt chart Y-axis scrolling

// ── Renderer ─────────────────────────────────────────────────────
// SVG chosen over Canvas for better text rendering and smaller module size.
// Sufficient for Forge's summary-level data volumes.
import { SVGRenderer } from 'echarts/renderers'

// ── Register all ─────────────────────────────────────────────────
echarts.use([
  PieChart,
  SunburstChart,
  TreemapChart,
  CustomChart,
  MapChart,
  RadarChart,
  BarChart,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  GridComponent,
  VisualMapComponent,
  DatasetComponent,
  TransformComponent,
  GraphicComponent,
  RadarComponent,
  MarkAreaComponent,
  MarkLineComponent,
  DataZoomComponent,
  SVGRenderer,
])

export { echarts }
