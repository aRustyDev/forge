import { i as derived } from "../../../../chunks/server.js";
import { r as LoadingSpinner } from "../../../../chunks/components.js";
import "../../../../chunks/toast.svelte.js";
import "../../../../chunks/sdk.js";
//#region src/routes/opportunities/job-descriptions/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let jds = [];
		let selectedId = null;
		let statusFilter = "all";
		let searchText = "";
		derived(() => {
			let result = jds;
			if (statusFilter !== "all") result = result.filter((jd) => jd.status === statusFilter);
			if (searchText.trim());
			return result;
		});
		derived(() => jds.find((jd) => jd.id === selectedId) ?? null);
		$$renderer.push(`<div class="jd-page svelte-1d754oo">`);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="loading-container svelte-1d754oo">`);
		LoadingSpinner($$renderer, {});
		$$renderer.push(`<!----></div>`);
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
export { _page as default };
