import "../../../../chunks/server.js";
import { t as SourcesView } from "../../../../chunks/SourcesView.js";
//#region src/routes/experience/projects/+page.svelte
function _page($$renderer) {
	SourcesView($$renderer, { sourceTypeFilter: "project" });
}
//#endregion
export { _page as default };
