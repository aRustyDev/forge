/**
 * Dimmed color for non-selected nodes during selection highlighting.
 * Matches the existing ChainViewModal value at line 338.
 */
export const DIM_NODE_COLOR = '#e5e7eb'

/**
 * Dimmed color for non-connected edges during selection highlighting.
 * Matches the existing ChainViewModal value at line 355.
 */
export const DIM_EDGE_COLOR = '#f3f4f6'

/**
 * Dimmed edge size during selection highlighting.
 */
export const DIM_EDGE_SIZE = 0.5

/**
 * Selection highlight: connected edges get +1 size bump.
 * Matches ChainViewModal edgeReducer at line 353.
 */
export const HIGHLIGHT_EDGE_SIZE_BUMP = 1

/**
 * Z-index layers for selection highlighting.
 */
export const Z_FOREGROUND = 1
export const Z_BACKGROUND = 0

/**
 * Minimum edge rendering size. Prevents invisible edges.
 */
export const MIN_EDGE_SIZE = 0.5

/**
 * Maximum edge rendering size. Prevents oversized edges.
 */
export const MAX_EDGE_SIZE = 5

/**
 * Default edge size when no weight is provided.
 */
export const DEFAULT_EDGE_SIZE = 1

/**
 * Compute edge display size from weight.
 * Clamps to [MIN_EDGE_SIZE, MAX_EDGE_SIZE] to prevent invisible or oversized edges.
 * Returns DEFAULT_EDGE_SIZE for undefined or NaN weights.
 */
export function edgeSizeFromWeight(weight: number | undefined): number {
  if (weight === undefined || isNaN(weight)) return DEFAULT_EDGE_SIZE
  return Math.max(MIN_EDGE_SIZE, Math.min(MAX_EDGE_SIZE, weight))
}

/**
 * Resolve a CSS custom property value from the document root.
 * Returns the fallback if running in SSR or the property is not set.
 *
 * Usage: resolveThemeColor('--graph-node-default', '#6b7280')
 */
export function resolveThemeColor(property: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim()
  return value || fallback
}
