/**
 * jdOverlay store — singleton state for the JD overlay modal.
 *
 * Usage:
 *   import { openJDOverlay, closeJDOverlay, jdOverlayState } from '$lib/components/overlays'
 *
 *   // Open with just an ID (modal will show a spinner while fetching)
 *   openJDOverlay(jdId)
 *
 *   // Open with pre-fetched fields for instant placeholder paint
 *   openJDOverlay(jdId, { title, status, organization_name, location, salary_range })
 *
 * The store follows the project convention established by chain-view.svelte.ts:
 * module-level $state variables + mutator functions + an exported getter object
 * so consumers read reactively via jdOverlayState.jdId / jdOverlayState.initialData.
 */
import type { JobDescriptionWithOrg, Skill } from '@forge/sdk'

/** Subset of JD fields a consumer can pass for instant placeholder rendering. */
export type JDOverlayInitialData = Partial<JobDescriptionWithOrg> & {
  skills?: Skill[]
}

let jdId = $state<string | null>(null)
let initialData = $state<JDOverlayInitialData | undefined>(undefined)

/**
 * Open the JD overlay modal for the given JD id.
 *
 * If the modal is already open for a different JD, it is replaced (no stacking
 * — there is only one modal instance globally). Optional initialData lets the
 * caller pass fields they already have (e.g. from a JDLink list row) so the
 * modal paints immediately while canonical data is fetched in the background.
 */
export function openJDOverlay(id: string, data?: JDOverlayInitialData): void {
  jdId = id
  initialData = data
}

/** Close the JD overlay modal and clear any pre-fetched data. */
export function closeJDOverlay(): void {
  jdId = null
  initialData = undefined
}

/**
 * Reactive state object for the JD overlay modal.
 * Properties are getters that read $state runes reactively.
 *
 * Usage:
 *   import { jdOverlayState } from '$lib/components/overlays'
 *   // In template: {#if jdOverlayState.jdId !== null}
 *   // In script: jdOverlayState.initialData
 */
export const jdOverlayState = {
  get jdId() { return jdId },
  get initialData() { return initialData },
}
