/**
 * Entity overlay modals — singleton-backed detail views.
 *
 * See README.md in this directory for the pattern convention and
 * guidance on adding new entity overlays.
 */
export { default as JDOverlayModal } from './JDOverlayModal.svelte'
export { default as JDOverlayHost } from './JDOverlayHost.svelte'
export {
  openJDOverlay,
  closeJDOverlay,
  jdOverlayState,
  type JDOverlayInitialData,
} from './jdOverlay.svelte'
