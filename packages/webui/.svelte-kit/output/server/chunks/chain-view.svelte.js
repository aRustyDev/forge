import "./server.js";
//#region src/lib/stores/chain-view.svelte.ts
var isOpen = false;
var highlightNode = null;
/** Close the chain view modal and clear the highlight target. */
function closeChainView() {
	isOpen = false;
	highlightNode = null;
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
var chainViewState = {
	get isOpen() {
		return isOpen;
	},
	get highlightNode() {
		return highlightNode;
	}
};
//#endregion
export { closeChainView as n, chainViewState as t };
