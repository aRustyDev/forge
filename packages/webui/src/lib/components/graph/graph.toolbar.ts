import type Sigma from 'sigma'

/**
 * Zoom the camera in with animation.
 */
export function zoomIn(sigma: Sigma): void {
  sigma.getCamera().animatedZoom({ duration: 200 })
}

/**
 * Zoom the camera out with animation.
 */
export function zoomOut(sigma: Sigma): void {
  sigma.getCamera().animatedUnzoom({ duration: 200 })
}

/**
 * Reset the camera to show all nodes.
 */
export function fitToScreen(sigma: Sigma): void {
  sigma.getCamera().animatedReset({ duration: 300 })
}

/**
 * Toggle fullscreen on the graph container element.
 * No-op if Fullscreen API is not available.
 */
export function toggleFullscreen(container: HTMLElement): void {
  if (!document.fullscreenEnabled) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    container.requestFullscreen()
  }
}

/**
 * Check if the keyboard event originates from an input/textarea/select
 * to avoid hijacking typing.
 */
export function isInputFocused(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
