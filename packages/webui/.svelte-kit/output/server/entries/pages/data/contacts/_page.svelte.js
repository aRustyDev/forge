import { i as derived } from "../../../../chunks/server.js";
import { r as LoadingSpinner } from "../../../../chunks/components.js";
import "../../../../chunks/toast.svelte.js";
import "../../../../chunks/sdk.js";
//#region src/routes/data/contacts/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let contacts = [];
		let selectedId = null;
		let searchText = "";
		derived(() => {
			if (!searchText.trim()) return contacts;
			const q = searchText.toLowerCase();
			return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
		});
		derived(() => contacts.find((c) => c.id === selectedId) ?? null);
		$$renderer.push(`<div class="contacts-page svelte-y6ou9j">`);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="loading-container svelte-y6ou9j">`);
		LoadingSpinner($$renderer, {});
		$$renderer.push(`<!----></div>`);
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
export { _page as default };
