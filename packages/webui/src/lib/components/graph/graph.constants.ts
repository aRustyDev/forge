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
