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
 * Registered chart types: Pie, Sunburst, Treemap, Custom (Gantt), Map (Choropleth)
 * Renderer: SVG (crisper text, smaller module, sufficient for Forge's data volumes)
 */
import * as echarts from 'echarts/core'

// ── Chart types ──────────────────────────────────────────────────
import { PieChart } from 'echarts/charts'
import { SunburstChart } from 'echarts/charts'
import { TreemapChart } from 'echarts/charts'
import { CustomChart } from 'echarts/charts'
import { MapChart } from 'echarts/charts'

// ── Components ───────────────────────────────────────────────────
import { TooltipComponent } from 'echarts/components'
import { LegendComponent } from 'echarts/components'
import { TitleComponent } from 'echarts/components'
import { GridComponent } from 'echarts/components'
import { VisualMapComponent } from 'echarts/components'
import { DatasetComponent } from 'echarts/components'
import { TransformComponent } from 'echarts/components'
import { GraphicComponent } from 'echarts/components' // Phase 63's sunburst center-text label requires this

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
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  GridComponent,
  VisualMapComponent,
  DatasetComponent,
  TransformComponent,
  GraphicComponent,
  SVGRenderer,
])

export { echarts }
