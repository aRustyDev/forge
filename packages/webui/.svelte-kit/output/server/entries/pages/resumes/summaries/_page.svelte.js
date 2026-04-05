import { i as derived } from "../../../../chunks/server.js";
import { r as LoadingSpinner, t as ConfirmDialog } from "../../../../chunks/components.js";
import { t as addToast } from "../../../../chunks/toast.svelte.js";
import { n as friendlyError, t as forge } from "../../../../chunks/sdk.js";
//#region src/routes/resumes/summaries/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let summaries = [];
		let confirmDeleteId = null;
		let editing = null;
		derived(() => summaries.filter((s) => s.is_template));
		derived(() => summaries.filter((s) => !s.is_template));
		async function deleteSummary(id) {
			const result = await forge.summaries.delete(id);
			if (result.ok) {
				summaries = summaries.filter((s) => s.id !== id);
				confirmDeleteId = null;
				if (editing === id) editing = null;
				addToast({
					message: "Summary deleted",
					type: "success"
				});
			} else addToast({
				message: friendlyError(result.error, "Failed to delete"),
				type: "error"
			});
		}
		$$renderer.push(`<div class="summaries-page svelte-1t5vtwk"><div class="page-header svelte-1t5vtwk"><div><h1 class="page-title svelte-1t5vtwk">Summaries</h1> <p class="subtitle svelte-1t5vtwk">Reusable professional summaries and templates</p></div> <button class="btn btn-primary svelte-1t5vtwk">+ New Summary</button></div> `);
		$$renderer.push("<!--[0-->");
		LoadingSpinner($$renderer, {});
		$$renderer.push(`<!--]--> `);
		ConfirmDialog($$renderer, {
			open: confirmDeleteId !== null,
			title: "Delete Summary",
			message: "Are you sure? This will detach this summary from any linked resumes.",
			onconfirm: () => confirmDeleteId && deleteSummary(confirmDeleteId),
			oncancel: () => confirmDeleteId = null
		});
		$$renderer.push(`<!----></div>`);
	});
}
//#endregion
export { _page as default };
