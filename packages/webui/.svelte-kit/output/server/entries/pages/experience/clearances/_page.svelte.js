import "../../../../chunks/server.js";
import { t as SourcesView } from "../../../../chunks/SourcesView.js";
//#region src/routes/experience/clearances/+page.svelte
function _page($$renderer) {
	SourcesView($$renderer, { sourceTypeFilter: "clearance" });
}
//#endregion
export { _page as default };
