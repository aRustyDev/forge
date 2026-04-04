/**
 * Svelte 5 debug utilities for component state tracing.
 *
 * These helpers log state changes and effect executions to console.debug,
 * which is hidden by default in Chrome DevTools (enable 'Verbose' level).
 * All helpers are no-ops when isDevMode() returns false.
 *
 * Must be a .svelte.ts file because it uses $effect (a Svelte 5 rune that
 * requires the Svelte compiler).
 */
import { isDevMode } from '@forge/sdk'

/**
 * Log a snapshot of component state every time any of the accessed reactive
 * values change.
 *
 * @param label - Prefix for the console.debug output, e.g. 'resumes'
 * @param stateGetter - A function that returns an object of state values to log.
 *                      Svelte's reactivity system tracks which $state vars this
 *                      function reads, so the effect re-runs whenever they change.
 *
 * @example
 * ```svelte
 * <script>
 *   import { debugState } from '$lib/debug.svelte'
 *   let loading = $state(true)
 *   let selectedId = $state<string | null>(null)
 *   debugState('resumes', () => ({ loading, selectedId }))
 * </script>
 * ```
 *
 * Output:
 * ```
 * [forge:resumes] { loading: true, selectedId: null }
 * [forge:resumes] { loading: false, selectedId: null }
 * [forge:resumes] { loading: false, selectedId: "abc-123" }
 * ```
 */
export function debugState(label: string, stateGetter: () => Record<string, unknown>): void {
  if (!isDevMode()) return
  $effect(() => {
    console.debug(`[forge:${label}]`, stateGetter())
  })
}

/**
 * Wrap an effect with debug logging that fires when the effect executes.
 *
 * In dev mode, logs a message before running the effect function.
 * In production, just runs the effect directly with no wrapper overhead.
 *
 * @param label - Descriptive name for this effect, e.g. 'fetch-resume-detail'
 * @param fn - The effect function. May return a cleanup function.
 *
 * @example
 * ```svelte
 * <script>
 *   import { tracedEffect } from '$lib/debug.svelte'
 *   let selectedId = $state<string | null>(null)
 *   tracedEffect('fetch-detail', () => {
 *     if (selectedId) fetchDetail(selectedId)
 *   })
 * </script>
 * ```
 *
 * Output:
 * ```
 * [forge:effect] fetch-detail fired
 * ```
 */
export function tracedEffect(label: string, fn: () => void | (() => void)): void {
  if (isDevMode()) {
    $effect(() => {
      console.debug(`[forge:effect] ${label} fired`)
      return fn()
    })
  } else {
    $effect(fn)
  }
}
