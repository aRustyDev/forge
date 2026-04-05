import "../../../../chunks/server.js";
import { t as SourcesView } from "../../../../chunks/SourcesView.js";
//#region src/routes/experience/education/+page.svelte
function _page($$renderer) {
	SourcesView($$renderer, { sourceTypeFilter: "education" });
}
//#endregion
export { _page as default };
