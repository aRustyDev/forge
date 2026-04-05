import { C as escape_html, S as attr, a as ensure_array_like, i as derived, t as attr_class } from "../../../../chunks/server.js";
import { t as page } from "../../../../chunks/state.js";
import { n as EmptyState, r as LoadingSpinner, t as ConfirmDialog } from "../../../../chunks/components.js";
import { t as addToast } from "../../../../chunks/toast.svelte.js";
import { n as friendlyError, t as forge } from "../../../../chunks/sdk.js";
import "../../../../chunks/navigation.js";
//#region src/routes/data/domains/DomainsView.svelte
function DomainsView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let domains = [];
		let loading = true;
		let editingId = null;
		let editName = "";
		let editDescription = "";
		let saving = false;
		let deleteConfirm = false;
		let deleteTarget = null;
		async function loadDomains() {
			loading = true;
			const result = await forge.domains.list({ limit: 200 });
			if (result.ok) domains = result.data;
			else addToast(friendlyError(result.error, "Failed to load domains"), "error");
			loading = false;
		}
		loadDomains();
		async function handleDelete() {
			if (!deleteTarget) return;
			const result = await forge.domains.delete(deleteTarget.id);
			if (result.ok) {
				addToast(`Domain '${deleteTarget.name}' deleted`, "success");
				deleteConfirm = false;
				deleteTarget = null;
				await loadDomains();
			} else {
				addToast(friendlyError(result.error, "Cannot delete domain"), "error");
				deleteConfirm = false;
				deleteTarget = null;
			}
		}
		function isReferenced(domain) {
			return domain.perspective_count > 0 || domain.archetype_count > 0;
		}
		$$renderer.push(`<div class="domains-page svelte-dchkz5"><div class="page-header svelte-dchkz5"><div><h1 class="page-title svelte-dchkz5">Domains</h1> <p class="subtitle svelte-dchkz5">Experience domains used by perspectives and archetypes</p></div> <button class="btn btn-primary svelte-dchkz5">${escape_html("+ Add Domain")}</button></div> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (loading) {
			$$renderer.push("<!--[0-->");
			LoadingSpinner($$renderer, {});
		} else if (domains.length === 0) {
			$$renderer.push("<!--[1-->");
			EmptyState($$renderer, { message: "No domains found. Create one to get started." });
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<table class="domains-table svelte-dchkz5"><thead><tr><th class="svelte-dchkz5">Name</th><th class="svelte-dchkz5">Description</th><th class="svelte-dchkz5">Perspectives</th><th class="svelte-dchkz5">Archetypes</th><th class="svelte-dchkz5">Actions</th></tr></thead><tbody class="svelte-dchkz5"><!--[-->`);
			const each_array = ensure_array_like(domains);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let domain = each_array[$$index];
				if (editingId === domain.id) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<tr class="editing-row svelte-dchkz5"><td class="svelte-dchkz5"><input type="text"${attr("value", editName)} class="form-input compact svelte-dchkz5"/></td><td class="svelte-dchkz5"><input type="text"${attr("value", editDescription)} class="form-input compact svelte-dchkz5"/></td><td class="svelte-dchkz5">${escape_html(domain.perspective_count)}</td><td class="svelte-dchkz5">${escape_html(domain.archetype_count)}</td><td class="actions svelte-dchkz5"><button class="btn btn-sm btn-primary svelte-dchkz5"${attr("disabled", saving, true)}>${escape_html("Save")}</button> <button class="btn btn-sm btn-ghost svelte-dchkz5">Cancel</button></td></tr>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<tr class="svelte-dchkz5"><td class="domain-name svelte-dchkz5">${escape_html(domain.name)}</td><td class="domain-desc svelte-dchkz5">${escape_html(domain.description ?? "--")}</td><td class="count svelte-dchkz5">${escape_html(domain.perspective_count)}</td><td class="count svelte-dchkz5">${escape_html(domain.archetype_count)}</td><td class="actions svelte-dchkz5"><button class="btn btn-sm btn-ghost svelte-dchkz5">Edit</button> <button class="btn btn-sm btn-danger svelte-dchkz5"${attr("disabled", isReferenced(domain), true)}${attr("title", isReferenced(domain) ? "Cannot delete: referenced by perspectives or archetypes" : "Delete domain")}>Delete</button></td></tr>`);
				}
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></tbody></table>`);
		}
		$$renderer.push(`<!--]--></div> `);
		if (deleteConfirm && deleteTarget) {
			$$renderer.push("<!--[0-->");
			ConfirmDialog($$renderer, {
				title: "Delete Domain",
				message: `Are you sure you want to delete '${deleteTarget.name}'? This cannot be undone.`,
				onconfirm: handleDelete,
				oncancel: () => {
					deleteConfirm = false;
					deleteTarget = null;
				}
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/routes/data/domains/ArchetypesView.svelte
function ArchetypesView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let archetypes = [];
		let allDomains = [];
		let loading = true;
		let editingId = null;
		let editName = "";
		let editDescription = "";
		let saving = false;
		let expandedId = null;
		let expandedDomains = [];
		let deleteConfirm = false;
		let deleteTarget = null;
		async function loadArchetypes() {
			loading = true;
			const [archResult, domResult] = await Promise.all([forge.archetypes.list({ limit: 200 }), forge.domains.list({ limit: 200 })]);
			if (archResult.ok) archetypes = archResult.data;
			else addToast(friendlyError(archResult.error, "Failed to load archetypes"), "error");
			if (domResult.ok) allDomains = domResult.data;
			loading = false;
		}
		loadArchetypes();
		function isDomainAssociated(domainId) {
			return expandedDomains.some((d) => d.id === domainId);
		}
		async function handleDelete() {
			if (!deleteTarget) return;
			const result = await forge.archetypes.delete(deleteTarget.id);
			if (result.ok) {
				addToast(`Archetype '${deleteTarget.name}' deleted`, "success");
				deleteConfirm = false;
				deleteTarget = null;
				if (expandedId === deleteTarget?.id) expandedId = null;
				await loadArchetypes();
			} else {
				addToast(friendlyError(result.error, "Cannot delete archetype"), "error");
				deleteConfirm = false;
				deleteTarget = null;
			}
		}
		function isReferenced(arch) {
			return arch.resume_count > 0 || arch.perspective_count > 0;
		}
		$$renderer.push(`<div class="archetypes-page svelte-nq2tlk"><div class="page-header svelte-nq2tlk"><div><h1 class="page-title svelte-nq2tlk">Archetypes</h1> <p class="subtitle svelte-nq2tlk">Resume targeting profiles and their domain mappings</p></div> <button class="btn btn-primary svelte-nq2tlk">${escape_html("+ Add Archetype")}</button></div> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (loading) {
			$$renderer.push("<!--[0-->");
			LoadingSpinner($$renderer, {});
		} else if (archetypes.length === 0) {
			$$renderer.push("<!--[1-->");
			EmptyState($$renderer, { message: "No archetypes found. Create one to get started." });
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<table class="archetypes-table svelte-nq2tlk"><thead><tr><th class="svelte-nq2tlk">Name</th><th class="svelte-nq2tlk">Description</th><th class="svelte-nq2tlk">Domains</th><th class="svelte-nq2tlk">Resumes</th><th class="svelte-nq2tlk">Perspectives</th><th class="svelte-nq2tlk">Actions</th></tr></thead><tbody class="svelte-nq2tlk"><!--[-->`);
			const each_array = ensure_array_like(archetypes);
			for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
				let arch = each_array[$$index_1];
				if (editingId === arch.id) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<tr class="editing-row svelte-nq2tlk"><td class="svelte-nq2tlk"><input type="text"${attr("value", editName)} class="form-input compact svelte-nq2tlk"/></td><td class="svelte-nq2tlk"><input type="text"${attr("value", editDescription)} class="form-input compact svelte-nq2tlk"/></td><td class="count svelte-nq2tlk">${escape_html(arch.domain_count)}</td><td class="count svelte-nq2tlk">${escape_html(arch.resume_count)}</td><td class="count svelte-nq2tlk">${escape_html(arch.perspective_count)}</td><td class="actions svelte-nq2tlk"><button class="btn btn-sm btn-primary svelte-nq2tlk"${attr("disabled", saving, true)}>${escape_html("Save")}</button> <button class="btn btn-sm btn-ghost svelte-nq2tlk">Cancel</button></td></tr>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<tr${attr_class("svelte-nq2tlk", void 0, { "expanded": expandedId === arch.id })}><td class="arch-name svelte-nq2tlk" role="button" tabindex="0"><span class="expand-arrow svelte-nq2tlk">${escape_html(expandedId === arch.id ? "▼" : "▶")}</span> ${escape_html(arch.name)}</td><td class="arch-desc svelte-nq2tlk">${escape_html(arch.description ?? "--")}</td><td class="count svelte-nq2tlk">${escape_html(arch.domain_count)}</td><td class="count svelte-nq2tlk">${escape_html(arch.resume_count)}</td><td class="count svelte-nq2tlk">${escape_html(arch.perspective_count)}</td><td class="actions svelte-nq2tlk"><button class="btn btn-sm btn-ghost svelte-nq2tlk">Edit</button> <button class="btn btn-sm btn-danger svelte-nq2tlk"${attr("disabled", isReferenced(arch), true)}${attr("title", isReferenced(arch) ? "Cannot delete: referenced by resumes or perspectives" : "Delete archetype")}>Delete</button></td></tr>`);
				}
				$$renderer.push(`<!--]--> `);
				if (expandedId === arch.id && editingId !== arch.id) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<tr class="domain-panel-row svelte-nq2tlk"><td colspan="6" class="svelte-nq2tlk"><div class="domain-panel svelte-nq2tlk"><h4 class="svelte-nq2tlk">Associated Domains</h4> `);
					{
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<div class="domain-checkboxes svelte-nq2tlk"><!--[-->`);
						const each_array_1 = ensure_array_like(allDomains);
						for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
							let domain = each_array_1[$$index];
							$$renderer.push(`<label class="domain-checkbox svelte-nq2tlk"><input type="checkbox"${attr("checked", isDomainAssociated(domain.id), true)} class="svelte-nq2tlk"/> <span class="domain-checkbox-label svelte-nq2tlk">${escape_html(domain.name.replace(/_/g, " "))}</span></label>`);
						}
						$$renderer.push(`<!--]--></div>`);
					}
					$$renderer.push(`<!--]--></div></td></tr>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></tbody></table>`);
		}
		$$renderer.push(`<!--]--></div> `);
		if (deleteConfirm && deleteTarget) {
			$$renderer.push("<!--[0-->");
			ConfirmDialog($$renderer, {
				title: "Delete Archetype",
				message: `Are you sure you want to delete '${deleteTarget.name}'? This will also remove all domain associations.`,
				onconfirm: handleDelete,
				oncancel: () => {
					deleteConfirm = false;
					deleteTarget = null;
				}
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/routes/data/domains/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const TABS = [{
			value: "domains",
			label: "Domains"
		}, {
			value: "archetypes",
			label: "Archetypes"
		}];
		let activeTab = derived(() => page.url.searchParams.get("tab") ?? "domains");
		$$renderer.push(`<div class="domains-container svelte-1s0awrz"><div class="tab-bar svelte-1s0awrz"><!--[-->`);
		const each_array = ensure_array_like(TABS);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let tab = each_array[$$index];
			$$renderer.push(`<button${attr_class("tab-btn svelte-1s0awrz", void 0, { "active": activeTab() === tab.value })}>${escape_html(tab.label)}</button>`);
		}
		$$renderer.push(`<!--]--></div> <div class="tab-content svelte-1s0awrz">`);
		if (activeTab() === "archetypes") {
			$$renderer.push("<!--[0-->");
			ArchetypesView($$renderer, {});
		} else {
			$$renderer.push("<!--[-1-->");
			DomainsView($$renderer, {});
		}
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
export { _page as default };
