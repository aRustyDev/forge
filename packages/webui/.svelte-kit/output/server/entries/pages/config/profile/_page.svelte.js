import { n as onDestroy } from "../../../../chunks/index-server.js";
import "../../../../chunks/server.js";
import "../../../../chunks/toast.svelte.js";
import "../../../../chunks/sdk.js";
//#region src/routes/config/profile/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		onDestroy(() => {});
		$$renderer.push(`<div class="page-header svelte-3x59bl"><h1 class="svelte-3x59bl">Profile</h1> <p class="page-subtitle svelte-3x59bl">Your contact information, shared across all resumes.</p></div> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="loading svelte-3x59bl">Loading profile...</div>`);
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
export { _page as default };
