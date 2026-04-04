let isOpen = $state(false)
let highlightNode = $state<string | null>(null)

/** Open the chain view modal, optionally highlighting a specific graph node. */
export function openChainView(nodeKey?: string) {
  highlightNode = nodeKey ?? null
  isOpen = true
}

/** Close the chain view modal and clear the highlight target. */
export function closeChainView() {
  isOpen = false
  highlightNode = null
}

/**
 * Reactive state object for chain view modal.
 * Properties are getters that read $state runes reactively.
 *
 * Usage:
 *   import { chainViewState } from '$lib/stores/chain-view.svelte'
 *   // In template: {#if chainViewState.isOpen}
 *   // In script: chainViewState.highlightNode
 */
export const chainViewState = {
  get isOpen() { return isOpen },
  get highlightNode() { return highlightNode },
}
