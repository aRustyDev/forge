import "../../../../chunks/index-server.js";
import { C as escape_html, S as attr, a as ensure_array_like } from "../../../../chunks/server.js";
import { n as EmptyState, r as LoadingSpinner, t as ConfirmDialog } from "../../../../chunks/components.js";
import { t as addToast } from "../../../../chunks/toast.svelte.js";
import { n as friendlyError, t as forge } from "../../../../chunks/sdk.js";
//#region src/routes/resumes/templates/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const ENTRY_TYPE_LABELS = {
			experience: "Experience",
			skills: "Skills",
			education: "Education",
			projects: "Projects",
			clearance: "Clearance",
			presentations: "Presentations",
			certifications: "Certifications",
			awards: "Awards",
			freeform: "Freeform"
		};
		let templates = [];
		let loading = true;
		let showForm = false;
		let deleteTarget = null;
		async function loadTemplates() {
			loading = true;
			const result = await forge.templates.list();
			if (result.ok) templates = result.data;
			else addToast({
				message: friendlyError(result.error),
				type: "error"
			});
			loading = false;
		}
		async function handleDelete() {
			if (!deleteTarget) return;
			const result = await forge.templates.delete(deleteTarget.id);
			if (result.ok) {
				addToast({
					message: `Template "${deleteTarget.name}" deleted`,
					type: "success"
				});
				deleteTarget = null;
				await loadTemplates();
			} else {
				addToast({
					message: friendlyError(result.error),
					type: "error"
				});
				deleteTarget = null;
			}
		}
		$$renderer.push(`<div class="templates-page svelte-dozngn"><div class="page-header svelte-dozngn"><div><h1 class="page-title svelte-dozngn">Templates</h1> <p class="subtitle svelte-dozngn">Reusable resume section layouts</p></div> <button class="btn btn-primary svelte-dozngn"${attr("disabled", showForm, true)}>+ Create Template</button></div> `);
		if (loading) {
			$$renderer.push("<!--[0-->");
			LoadingSpinner($$renderer, {});
		} else if (templates.length === 0) {
			$$renderer.push("<!--[2-->");
			EmptyState($$renderer, {
				title: "No templates yet",
				description: "Create a template to define reusable resume section layouts."
			});
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="template-list svelte-dozngn"><!--[-->`);
			const each_array_2 = ensure_array_like(templates);
			for (let $$index_3 = 0, $$length = each_array_2.length; $$index_3 < $$length; $$index_3++) {
				let template = each_array_2[$$index_3];
				$$renderer.push(`<div class="template-card svelte-dozngn"><div class="template-header svelte-dozngn"><div class="template-title svelte-dozngn"><h3 class="svelte-dozngn">${escape_html(template.name)}</h3> `);
				if (template.is_builtin) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="badge badge-builtin svelte-dozngn">Built-in</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div> <div class="template-actions svelte-dozngn"><button class="btn btn-sm svelte-dozngn">Edit</button> <button class="btn btn-sm btn-danger svelte-dozngn"${attr("disabled", template.is_builtin, true)}${attr("title", template.is_builtin ? "Built-in templates cannot be deleted" : "Delete template")}>Delete</button></div></div> `);
				if (template.description) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<p class="template-desc svelte-dozngn">${escape_html(template.description)}</p>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <div class="template-sections svelte-dozngn"><!--[-->`);
				const each_array_3 = ensure_array_like(template.sections);
				for (let i = 0, $$length = each_array_3.length; i < $$length; i++) {
					let section = each_array_3[i];
					$$renderer.push(`<span class="section-tag svelte-dozngn">${escape_html(i + 1)}. ${escape_html(section.title)} <small class="svelte-dozngn">(${escape_html(ENTRY_TYPE_LABELS[section.entry_type] ?? section.entry_type)})</small></span>`);
				}
				$$renderer.push(`<!--]--></div></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div> `);
		if (deleteTarget) {
			$$renderer.push("<!--[0-->");
			ConfirmDialog($$renderer, {
				title: "Delete Template",
				message: `Are you sure you want to delete "${deleteTarget.name}"?`,
				confirmLabel: "Delete",
				onconfirm: handleDelete,
				oncancel: () => deleteTarget = null
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
export { _page as default };
