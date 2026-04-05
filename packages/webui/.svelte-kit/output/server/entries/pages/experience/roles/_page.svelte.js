import "../../../../chunks/server.js";
import { t as SourcesView } from "../../../../chunks/SourcesView.js";
//#region src/routes/experience/roles/+page.svelte
function _page($$renderer) {
	SourcesView($$renderer, { sourceTypeFilter: "role" });
}
//#endregion
export { _page as default };
