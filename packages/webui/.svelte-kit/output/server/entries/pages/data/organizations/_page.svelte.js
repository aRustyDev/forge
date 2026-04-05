import { C as escape_html, S as attr, a as ensure_array_like, i as derived } from "../../../../chunks/server.js";
import { r as LoadingSpinner, t as ConfirmDialog } from "../../../../chunks/components.js";
import { t as addToast } from "../../../../chunks/toast.svelte.js";
import { t as forge } from "../../../../chunks/sdk.js";
//#region src/routes/data/organizations/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const ORG_TYPES = [
			"company",
			"nonprofit",
			"government",
			"military",
			"education",
			"volunteer",
			"freelance",
			"other"
		];
		const ALL_TAGS = [
			"company",
			"vendor",
			"platform",
			"university",
			"school",
			"nonprofit",
			"government",
			"military",
			"conference",
			"volunteer",
			"freelance",
			"other"
		];
		const MODALITY_LABELS = {
			in_person: "In Person",
			remote: "Remote",
			hybrid: "Hybrid"
		};
		let organizations = [];
		let selectedId = null;
		let tagFilter = "all";
		let searchQuery = "";
		let editing = false;
		let saving = false;
		let confirmDeleteOpen = false;
		let formName = "";
		let formOrgType = "company";
		let formTags = [];
		let formIndustry = "";
		let formSize = "";
		let formWorked = false;
		let formWebsite = "";
		let formLinkedinUrl = "";
		let formGlassdoorUrl = "";
		let formGlassdoorRating = null;
		let formReputationNotes = "";
		let formNotes = "";
		let formStatus = null;
		let orgCampuses = [];
		let deletingCampusId = null;
		let editingCampusId = null;
		let editCampusName = "";
		let editCampusModality = "in_person";
		let editCampusAddress = "";
		let editCampusCity = "";
		let editCampusState = "";
		let editCampusZipcode = "";
		let editCampusCountry = "";
		let editCampusIsHQ = false;
		let savingCampusEdit = false;
		let orgAliases = [];
		let newAlias = "";
		let groupBy = "flat";
		let filteredOrgs = derived(() => {
			let result = organizations;
			if (tagFilter !== "all") result = result.filter((o) => o.tags?.includes(tagFilter));
			if (searchQuery.trim());
			return result;
		});
		derived(() => {
			if (groupBy === "flat") return null;
			const groups = {};
			for (const org of filteredOrgs()) {
				let key;
				if (groupBy === "by_org_type") key = org.org_type ?? "other";
				else key = org.tags && org.tags.length > 0 ? org.tags[0] : "No tags";
				if (!groups[key]) groups[key] = [];
				groups[key].push(org);
			}
			return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
		});
		let selectedOrg = derived(() => organizations.find((o) => o.id === selectedId) ?? null);
		async function deleteOrg() {
			if (!selectedId) return;
			confirmDeleteOpen = false;
			const id = selectedId;
			const result = await forge.organizations.delete(id);
			if (result.ok) {
				organizations = organizations.filter((o) => o.id !== id);
				selectedId = null;
				editing = false;
				addToast({
					message: "Organization deleted.",
					type: "success"
				});
			} else addToast({
				message: `Failed to delete: ${result.error.message}`,
				type: "error"
			});
		}
		$$renderer.push(`<div class="orgs-page svelte-1a1jqw"><div class="list-panel svelte-1a1jqw"><div class="list-header svelte-1a1jqw"><h2 class="svelte-1a1jqw">All Organizations</h2> <button class="btn-new svelte-1a1jqw">+ New</button></div> <div class="filter-bar svelte-1a1jqw"><input class="search-input svelte-1a1jqw" type="text" placeholder="Search..."${attr("value", searchQuery)}/> `);
		$$renderer.select({
			class: "filter-select",
			value: tagFilter
		}, ($$renderer) => {
			$$renderer.option({ value: "all" }, ($$renderer) => {
				$$renderer.push(`All tags`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(ALL_TAGS);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let t = each_array[$$index];
				$$renderer.option({ value: t }, ($$renderer) => {
					$$renderer.push(`${escape_html(t)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		}, "svelte-1a1jqw");
		$$renderer.push(`</div> <div class="group-bar"><label for="org-group-by">Group by:</label> `);
		$$renderer.select({
			id: "org-group-by",
			value: groupBy
		}, ($$renderer) => {
			$$renderer.option({ value: "flat" }, ($$renderer) => {
				$$renderer.push(`None`);
			});
			$$renderer.option({ value: "by_org_type" }, ($$renderer) => {
				$$renderer.push(`Type`);
			});
			$$renderer.option({ value: "by_tag" }, ($$renderer) => {
				$$renderer.push(`Tag`);
			});
		});
		$$renderer.push(`</div> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="list-loading svelte-1a1jqw">`);
		LoadingSpinner($$renderer, {
			size: "md",
			message: "Loading organizations..."
		});
		$$renderer.push(`<!----></div>`);
		$$renderer.push(`<!--]--></div> <div class="editor-panel svelte-1a1jqw">`);
		if (!selectedOrg() && !editing) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="editor-empty svelte-1a1jqw"><p>Select an organization or create a new one.</p></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="editor-content svelte-1a1jqw"><h3 class="editor-heading svelte-1a1jqw">${escape_html(editing ? "New Organization" : "Edit Organization")}</h3> <div class="form-group svelte-1a1jqw"><label for="org-name" class="svelte-1a1jqw">Name <span class="required svelte-1a1jqw">*</span></label> <input id="org-name" type="text"${attr("value", formName)} placeholder="e.g. Anthropic" class="svelte-1a1jqw"/></div> <div class="form-row svelte-1a1jqw"><div class="form-group svelte-1a1jqw"><label for="org-type" class="svelte-1a1jqw">Primary Type</label> `);
			$$renderer.select({
				id: "org-type",
				value: formOrgType,
				class: ""
			}, ($$renderer) => {
				$$renderer.push(`<!--[-->`);
				const each_array_6 = ensure_array_like(ORG_TYPES);
				for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
					let t = each_array_6[$$index_6];
					$$renderer.option({ value: t }, ($$renderer) => {
						$$renderer.push(`${escape_html(t)}`);
					});
				}
				$$renderer.push(`<!--]-->`);
			}, "svelte-1a1jqw");
			$$renderer.push(`</div> `);
			if (formOrgType !== "education") {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="form-group svelte-1a1jqw"><label for="org-industry" class="svelte-1a1jqw">Industry</label> <input id="org-industry" type="text"${attr("value", formIndustry)} placeholder="e.g. AI Safety" class="svelte-1a1jqw"/></div>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<div class="form-group svelte-1a1jqw"></div>`);
			}
			$$renderer.push(`<!--]--></div> <div class="form-group svelte-1a1jqw"><label class="svelte-1a1jqw">Tags</label> <div class="tag-grid svelte-1a1jqw"><!--[-->`);
			const each_array_7 = ensure_array_like(ALL_TAGS);
			for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
				let tag = each_array_7[$$index_7];
				$$renderer.push(`<label class="tag-check svelte-1a1jqw"><input type="checkbox"${attr("checked", formTags.includes(tag), true)} class="svelte-1a1jqw"/> ${escape_html(tag)}</label>`);
			}
			$$renderer.push(`<!--]--></div></div> <div class="form-row svelte-1a1jqw"><div class="form-group svelte-1a1jqw"><label for="org-size" class="svelte-1a1jqw">Size</label> <input id="org-size" type="text"${attr("value", formSize)} placeholder="e.g. 100-500" class="svelte-1a1jqw"/></div> <div class="form-group svelte-1a1jqw"><label for="org-status" class="svelte-1a1jqw">Status</label> `);
			$$renderer.select({
				id: "org-status",
				value: formStatus,
				class: ""
			}, ($$renderer) => {
				$$renderer.option({ value: null }, ($$renderer) => {
					$$renderer.push(`No status`);
				});
				$$renderer.option({ value: "backlog" }, ($$renderer) => {
					$$renderer.push(`Backlog`);
				});
				$$renderer.option({ value: "researching" }, ($$renderer) => {
					$$renderer.push(`Researching`);
				});
				$$renderer.option({ value: "exciting" }, ($$renderer) => {
					$$renderer.push(`Exciting`);
				});
				$$renderer.option({ value: "interested" }, ($$renderer) => {
					$$renderer.push(`Interested`);
				});
				$$renderer.option({ value: "acceptable" }, ($$renderer) => {
					$$renderer.push(`Acceptable`);
				});
				$$renderer.option({ value: "excluded" }, ($$renderer) => {
					$$renderer.push(`Excluded`);
				});
			}, "svelte-1a1jqw");
			$$renderer.push(`</div></div> <div class="form-group checkbox-group svelte-1a1jqw"><label class="svelte-1a1jqw"><input type="checkbox"${attr("checked", formWorked, true)} class="svelte-1a1jqw"/> I have worked here</label></div> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="form-group svelte-1a1jqw"><label for="org-website" class="svelte-1a1jqw">Website</label> <input id="org-website" type="url"${attr("value", formWebsite)} class="svelte-1a1jqw"/></div> <div class="form-row svelte-1a1jqw"><div class="form-group svelte-1a1jqw"><label for="org-linkedin" class="svelte-1a1jqw">LinkedIn URL</label> <input id="org-linkedin" type="url"${attr("value", formLinkedinUrl)} class="svelte-1a1jqw"/></div> <div class="form-group svelte-1a1jqw"><label for="org-glassdoor" class="svelte-1a1jqw">Glassdoor URL</label> <input id="org-glassdoor" type="url"${attr("value", formGlassdoorUrl)} class="svelte-1a1jqw"/></div></div> <div class="form-group svelte-1a1jqw"><label for="org-rating" class="svelte-1a1jqw">Glassdoor Rating</label> <input id="org-rating" type="number" step="0.1" min="0" max="5"${attr("value", formGlassdoorRating)} class="svelte-1a1jqw"/></div> <div class="form-group svelte-1a1jqw"><label for="org-reputation" class="svelte-1a1jqw">Reputation Notes</label> <textarea id="org-reputation" rows="3" class="svelte-1a1jqw">`);
			const $$body = escape_html(formReputationNotes);
			if ($$body) $$renderer.push(`${$$body}`);
			$$renderer.push(`</textarea></div> <div class="form-group svelte-1a1jqw"><label for="org-notes" class="svelte-1a1jqw">Notes</label> <textarea id="org-notes" rows="3" class="svelte-1a1jqw">`);
			const $$body_1 = escape_html(formNotes);
			if ($$body_1) $$renderer.push(`${$$body_1}`);
			$$renderer.push(`</textarea></div> `);
			if (!editing && selectedOrg()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="campuses-section svelte-1a1jqw"><div class="section-header svelte-1a1jqw"><h4 class="svelte-1a1jqw">Campuses / Locations</h4> <button class="btn-new-sm svelte-1a1jqw">${escape_html("+ Add")}</button></div> `);
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (orgCampuses.length === 0 && true) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<p class="campus-empty svelte-1a1jqw">No campuses defined. Click + Add to create one.</p>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<ul class="campus-list svelte-1a1jqw"><!--[-->`);
					const each_array_9 = ensure_array_like(orgCampuses);
					for (let $$index_9 = 0, $$length = each_array_9.length; $$index_9 < $$length; $$index_9++) {
						let campus = each_array_9[$$index_9];
						if (editingCampusId === campus.id) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<li class="campus-item campus-editing svelte-1a1jqw"><div class="campus-edit-form svelte-1a1jqw"><div class="form-row svelte-1a1jqw"><div class="form-group svelte-1a1jqw"><label for="edit-campus-name" class="svelte-1a1jqw">Name *</label> <input id="edit-campus-name" type="text"${attr("value", editCampusName)} class="svelte-1a1jqw"/></div> <div class="form-group svelte-1a1jqw"><label for="edit-campus-modality" class="svelte-1a1jqw">Modality</label> `);
							$$renderer.select({
								id: "edit-campus-modality",
								value: editCampusModality,
								class: ""
							}, ($$renderer) => {
								$$renderer.option({ value: "in_person" }, ($$renderer) => {
									$$renderer.push(`In Person`);
								});
								$$renderer.option({ value: "remote" }, ($$renderer) => {
									$$renderer.push(`Remote / Online`);
								});
								$$renderer.option({ value: "hybrid" }, ($$renderer) => {
									$$renderer.push(`Hybrid`);
								});
							}, "svelte-1a1jqw");
							$$renderer.push(`</div></div> <div class="form-row svelte-1a1jqw"><div class="form-group svelte-1a1jqw"><label for="edit-campus-address" class="svelte-1a1jqw">Address</label> <input id="edit-campus-address" type="text"${attr("value", editCampusAddress)} class="svelte-1a1jqw"/></div></div> <div class="form-row svelte-1a1jqw"><div class="form-group svelte-1a1jqw"><label for="edit-campus-city" class="svelte-1a1jqw">City</label> <input id="edit-campus-city" type="text"${attr("value", editCampusCity)} class="svelte-1a1jqw"/></div> <div class="form-group svelte-1a1jqw"><label for="edit-campus-state" class="svelte-1a1jqw">State</label> <input id="edit-campus-state" type="text"${attr("value", editCampusState)} class="svelte-1a1jqw"/></div> <div class="form-group svelte-1a1jqw"><label for="edit-campus-zip" class="svelte-1a1jqw">Zip</label> <input id="edit-campus-zip" type="text"${attr("value", editCampusZipcode)} class="svelte-1a1jqw"/></div></div> <div class="form-row svelte-1a1jqw"><div class="form-group svelte-1a1jqw"><label for="edit-campus-country" class="svelte-1a1jqw">Country</label> <input id="edit-campus-country" type="text"${attr("value", editCampusCountry)} class="svelte-1a1jqw"/></div> <div class="form-group checkbox-group svelte-1a1jqw"><label class="svelte-1a1jqw"><input type="checkbox"${attr("checked", editCampusIsHQ, true)} class="svelte-1a1jqw"/> Headquarters</label></div></div> <div class="campus-edit-actions svelte-1a1jqw"><button class="btn btn-save btn-sm svelte-1a1jqw"${attr("disabled", !editCampusName.trim(), true)}>${escape_html("Save")}</button> <button class="btn btn-cancel btn-sm svelte-1a1jqw"${attr("disabled", savingCampusEdit, true)}>Cancel</button></div></div></li>`);
						} else {
							$$renderer.push("<!--[-1-->");
							$$renderer.push(`<li class="campus-item svelte-1a1jqw"><div class="campus-info svelte-1a1jqw" role="button" tabindex="0" title="Click to edit"><span class="campus-name svelte-1a1jqw">${escape_html(campus.name)}</span> `);
							if (campus.is_headquarters) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<span class="campus-hq-badge svelte-1a1jqw">HQ</span>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--> <span class="campus-modality svelte-1a1jqw">${escape_html(MODALITY_LABELS[campus.modality] ?? campus.modality)}</span> `);
							if (campus.city || campus.state || campus.zipcode) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<span class="campus-location svelte-1a1jqw">${escape_html([
									campus.city,
									campus.state,
									campus.zipcode
								].filter(Boolean).join(", "))}</span>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--> `);
							if (campus.address) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<span class="campus-address svelte-1a1jqw">${escape_html(campus.address)}</span>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--></div> <button class="btn-delete-sm svelte-1a1jqw"${attr("disabled", deletingCampusId === campus.id, true)} title="Delete campus">${escape_html(deletingCampusId === campus.id ? "..." : "×")}</button></li>`);
						}
						$$renderer.push(`<!--]-->`);
					}
					$$renderer.push(`<!--]--></ul>`);
				}
				$$renderer.push(`<!--]--></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (!editing && selectedOrg()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="campuses-section svelte-1a1jqw"><div class="section-header svelte-1a1jqw"><h4 class="svelte-1a1jqw">Aliases</h4></div> <div class="alias-add-row svelte-1a1jqw"><input type="text"${attr("value", newAlias)} placeholder="e.g. WGU, USAF" class="svelte-1a1jqw"/> <button class="btn-new-sm svelte-1a1jqw"${attr("disabled", !newAlias.trim(), true)}>${escape_html("+")}</button></div> `);
				if (orgAliases.length > 0) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="alias-pills svelte-1a1jqw"><!--[-->`);
					const each_array_10 = ensure_array_like(orgAliases);
					for (let $$index_10 = 0, $$length = each_array_10.length; $$index_10 < $$length; $$index_10++) {
						let a = each_array_10[$$index_10];
						$$renderer.push(`<span class="alias-pill svelte-1a1jqw">${escape_html(a.alias)} <button class="alias-remove svelte-1a1jqw" title="Remove">×</button></span>`);
					}
					$$renderer.push(`<!--]--></div>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="editor-actions svelte-1a1jqw"><button class="btn btn-save svelte-1a1jqw"${attr("disabled", saving, true)}>`);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`${escape_html(editing ? "Create" : "Save")}`);
			$$renderer.push(`<!--]--></button> `);
			if (!editing && selectedOrg()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<button class="btn btn-delete svelte-1a1jqw">Delete</button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div></div>`);
		}
		$$renderer.push(`<!--]--></div></div> `);
		ConfirmDialog($$renderer, {
			open: confirmDeleteOpen,
			title: "Delete Organization",
			message: "Are you sure you want to delete this organization? This action cannot be undone.",
			confirmLabel: "Delete",
			onconfirm: deleteOrg,
			oncancel: () => confirmDeleteOpen = false,
			destructive: true
		});
		$$renderer.push(`<!---->`);
	});
}
//#endregion
export { _page as default };
