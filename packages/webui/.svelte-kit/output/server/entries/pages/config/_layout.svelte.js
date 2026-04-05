import "../../../chunks/server.js";
//#region src/routes/config/+layout.svelte
function _layout($$renderer, $$props) {
	let { children } = $$props;
	children($$renderer);
	$$renderer.push(`<!---->`);
}
//#endregion
export { _layout as default };
