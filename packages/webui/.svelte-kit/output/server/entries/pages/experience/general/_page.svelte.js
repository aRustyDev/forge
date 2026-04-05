import "../../../../chunks/server.js";
import { t as SourcesView } from "../../../../chunks/SourcesView.js";
//#region src/routes/experience/general/+page.svelte
function _page($$renderer) {
	SourcesView($$renderer, { sourceTypeFilter: "general" });
}
//#endregion
export { _page as default };
