import { i as derived } from "../../chunks/server.js";
import { r as LoadingSpinner } from "../../chunks/components.js";
import "../../chunks/sdk.js";
import "../../chunks/navigation.js";
//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let pendingBullets = 0;
		let pendingPerspectives = 0;
		derived(() => pendingBullets === 0 && pendingPerspectives === 0);
		$$renderer.push(`<div class="dashboard svelte-1uha8ag"><h1 class="page-title svelte-1uha8ag">Dashboard</h1> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="loading-container svelte-1uha8ag">`);
		LoadingSpinner($$renderer, {
			size: "lg",
			message: "Loading dashboard..."
		});
		$$renderer.push(`<!----></div>`);
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
export { _page as default };
