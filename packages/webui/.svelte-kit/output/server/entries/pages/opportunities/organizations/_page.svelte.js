import { C as escape_html, S as attr, a as ensure_array_like, c as stringify, i as derived, n as attr_style, t as attr_class } from "../../../../chunks/server.js";
import { r as LoadingSpinner } from "../../../../chunks/components.js";
import { t as addToast } from "../../../../chunks/toast.svelte.js";
import { n as friendlyError, t as forge } from "../../../../chunks/sdk.js";
import "../../../../chunks/dist.js";
//#region src/lib/components/kanban/KanbanCard.svelte
function KanbanCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { org, onclick, aliasCount = 0, hqLocation = "" } = $$props;
		const INTEREST_STYLES = {
			exciting: {
				bg: "var(--color-success-subtle)",
				border: "var(--color-success)",
				badge: "var(--color-success-strong)",
				label: "EXCITING"
			},
			interested: {
				bg: "var(--color-info-subtle)",
				border: "var(--color-info)",
				badge: "var(--color-info)",
				label: "INTERESTED"
			},
			acceptable: {
				bg: "var(--color-surface-raised)",
				border: "var(--text-faint)",
				badge: "var(--text-muted)",
				label: "ACCEPTABLE"
			}
		};
		let interest = derived(() => INTEREST_STYLES[org.status ?? ""] ?? null);
		let isExcluded = derived(() => org.status === "excluded");
		$$renderer.push(`<div${attr_class("kanban-card svelte-1pzcx1", void 0, { "excluded": isExcluded() })} role="button" tabindex="0"${attr_style("", {
			background: interest()?.bg ?? "var(--color-surface)",
			"border-left": interest() ? `4px solid ${interest().border}` : `1px solid var(--color-border)`
		})}><div class="card-header svelte-1pzcx1"><span${attr_class("card-name svelte-1pzcx1", void 0, { "strike": isExcluded() })}>${escape_html(org.name)}</span> `);
		if (aliasCount > 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="alias-count svelte-1pzcx1">(${escape_html(aliasCount)})</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (org.worked) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="worked-badge svelte-1pzcx1">Worked</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		if (org.tags && org.tags.length > 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="tag-pills svelte-1pzcx1"><!--[-->`);
			const each_array = ensure_array_like(org.tags);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let tag = each_array[$$index];
				$$renderer.push(`<span class="pill">${escape_html(tag)}</span>`);
			}
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <div class="card-meta svelte-1pzcx1">`);
		if (org.industry) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="meta-text svelte-1pzcx1">${escape_html(org.industry)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (hqLocation) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="meta-text svelte-1pzcx1">${escape_html(hqLocation)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		if (interest()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="badge"${attr_style("", { background: interest().badge })}>${escape_html(interest().label)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/kanban/KanbanColumn.svelte
function KanbanColumn($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { label, accent, items, collapsed = false, onToggleCollapse, onDrop, onCardClick, aliasCountMap = /* @__PURE__ */ new Map(), hqLocationMap = /* @__PURE__ */ new Map() } = $$props;
		let localItems = [];
		if (collapsed) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="column-collapsed svelte-ceg8qx" role="button" tabindex="0"${attr_style("", { "border-top-color": accent })}><span class="collapsed-label svelte-ceg8qx">${escape_html(label)}</span> <span class="collapsed-count svelte-ceg8qx">${escape_html(items.length)}</span></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="column svelte-ceg8qx"${attr_style("", { "border-top-color": accent })}><div class="column-header svelte-ceg8qx"><h3 class="column-label svelte-ceg8qx">${escape_html(label)}</h3> <span class="column-count svelte-ceg8qx">${escape_html(localItems.length)}</span> `);
			if (onToggleCollapse) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<button class="collapse-btn svelte-ceg8qx" title="Collapse">✕</button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="column-body svelte-ceg8qx"><!--[-->`);
			const each_array = ensure_array_like(localItems);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let item = each_array[$$index];
				KanbanCard($$renderer, {
					org: item,
					onclick: () => onCardClick(item.id),
					aliasCount: aliasCountMap.get(item.id) ?? 0,
					hqLocation: hqLocationMap.get(item.id) ?? ""
				});
			}
			$$renderer.push(`<!--]--></div></div>`);
		}
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/kanban/OrgPickerModal.svelte
function OrgPickerModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { open, onclose, onadd } = $$props;
		let allOrgs = [];
		let searchQuery = "";
		let tagFilter = "";
		let adding = null;
		const TAG_OPTIONS = [
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
		let availableOrgs = derived(() => {
			let result = allOrgs.filter((o) => !o.status);
			if (searchQuery.trim());
			return result.sort((a, b) => a.name.localeCompare(b.name));
		});
		if (open) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="modal-overlay svelte-7zahll" role="presentation"><div class="modal-content svelte-7zahll" role="dialog" aria-modal="true" aria-label="Add Organization to Pipeline"><div class="modal-header svelte-7zahll"><h3 class="svelte-7zahll">Add Organization to Pipeline</h3> <button class="close-btn svelte-7zahll">×</button></div> <div class="modal-filters svelte-7zahll"><input type="text" class="search-input svelte-7zahll" placeholder="Search by name..."${attr("value", searchQuery)}/> `);
			$$renderer.select({
				class: "tag-select",
				value: tagFilter
			}, ($$renderer) => {
				$$renderer.option({ value: "" }, ($$renderer) => {
					$$renderer.push(`All tags`);
				});
				$$renderer.push(`<!--[-->`);
				const each_array = ensure_array_like(TAG_OPTIONS);
				for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
					let tag = each_array[$$index];
					$$renderer.option({ value: tag }, ($$renderer) => {
						$$renderer.push(`${escape_html(tag)}`);
					});
				}
				$$renderer.push(`<!--]-->`);
			}, "svelte-7zahll");
			$$renderer.push(`</div> <div class="org-list-scroll svelte-7zahll">`);
			if (availableOrgs().length === 0) {
				$$renderer.push("<!--[1-->");
				$$renderer.push(`<div class="list-empty svelte-7zahll"><p>No available organizations found.${escape_html("")}</p></div>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--[-->`);
				const each_array_1 = ensure_array_like(availableOrgs());
				for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
					let org = each_array_1[$$index_2];
					$$renderer.push(`<button class="picker-card svelte-7zahll"${attr("disabled", adding === org.id, true)}><div class="picker-card-top svelte-7zahll"><span class="picker-name svelte-7zahll">${escape_html(org.name)}</span> `);
					if (org.worked) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<span class="picker-worked svelte-7zahll">Worked</span>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></div> <div class="picker-meta svelte-7zahll">`);
					if (org.industry) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<span>${escape_html(org.industry)}</span>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></div> `);
					if (org.tags && org.tags.length > 0) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<div class="picker-tags svelte-7zahll"><!--[-->`);
						const each_array_2 = ensure_array_like(org.tags);
						for (let $$index_1 = 0, $$length = each_array_2.length; $$index_1 < $$length; $$index_1++) {
							let tag = each_array_2[$$index_1];
							$$renderer.push(`<span class="picker-tag svelte-7zahll">${escape_html(tag)}</span>`);
						}
						$$renderer.push(`<!--]--></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> `);
					if (adding === org.id) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<span class="adding-text svelte-7zahll">Adding...</span>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></button>`);
				}
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></div> <div class="create-section svelte-7zahll">`);
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<button class="create-toggle svelte-7zahll">+ Create New Organization</button>`);
			$$renderer.push(`<!--]--></div></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/kanban/OrgDetailModal.svelte
function OrgDetailModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { org, onclose, onupdate } = $$props;
		const TARGETING_STATUSES = [
			"exciting",
			"interested",
			"acceptable"
		];
		const INTEREST_OPTIONS = [
			{
				value: "exciting",
				label: "Exciting",
				color: "#22c55e"
			},
			{
				value: "interested",
				label: "Interested",
				color: "#3b82f6"
			},
			{
				value: "acceptable",
				label: "Acceptable",
				color: "#9ca3af"
			}
		];
		const COLUMN_LABELS = {
			backlog: "Backlog",
			researching: "Researching",
			exciting: "Targeting",
			interested: "Targeting",
			acceptable: "Targeting",
			excluded: "Excluded"
		};
		let notesValue = "";
		let reputationValue = "";
		let removing = false;
		let isTargeting = derived(() => org ? TARGETING_STATUSES.includes(org.status ?? "") : false);
		let columnLabel = derived(() => org ? COLUMN_LABELS[org.status ?? ""] ?? "Unknown" : "");
		if (org) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="modal-overlay svelte-z9ersk" role="presentation"><div class="modal-content svelte-z9ersk" role="dialog" aria-modal="true" aria-label="Organization Details"><div class="modal-header svelte-z9ersk"><div class="header-left svelte-z9ersk"><h3 class="svelte-z9ersk">${escape_html(org.name)}</h3> <span class="column-indicator svelte-z9ersk">${escape_html(columnLabel())}</span> `);
			if (org.worked) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="worked-badge svelte-z9ersk">Worked</span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <button class="close-btn svelte-z9ersk">×</button></div> <div class="modal-body svelte-z9ersk">`);
			if (isTargeting()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="field-group svelte-z9ersk"><label class="field-label svelte-z9ersk">Interest Level</label> <div class="interest-selector svelte-z9ersk"><!--[-->`);
				const each_array = ensure_array_like(INTEREST_OPTIONS);
				for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
					let opt = each_array[$$index];
					$$renderer.push(`<button${attr_class("interest-btn svelte-z9ersk", void 0, { "active": org.status === opt.value })}${attr_style("", { "--accent": opt.color })}>${escape_html(opt.label)}</button>`);
				}
				$$renderer.push(`<!--]--></div></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (org.tags && org.tags.length > 0) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="field-group svelte-z9ersk"><label class="field-label svelte-z9ersk">Tags</label> <div class="tag-pills svelte-z9ersk"><!--[-->`);
				const each_array_1 = ensure_array_like(org.tags);
				for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
					let tag = each_array_1[$$index_1];
					$$renderer.push(`<span class="tag-pill svelte-z9ersk">${escape_html(tag)}</span>`);
				}
				$$renderer.push(`<!--]--></div></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="info-grid svelte-z9ersk">`);
			if (org.industry) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="info-item svelte-z9ersk"><span class="info-label svelte-z9ersk">Industry</span> <span class="info-value svelte-z9ersk">${escape_html(org.industry)}</span></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (org.size) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="info-item svelte-z9ersk"><span class="info-label svelte-z9ersk">Size</span> <span class="info-value svelte-z9ersk">${escape_html(org.size)}</span></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (org.glassdoor_rating) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="info-item svelte-z9ersk"><span class="info-label svelte-z9ersk">Glassdoor</span> <span class="info-value svelte-z9ersk">${escape_html(org.glassdoor_rating)}/5</span></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="links svelte-z9ersk">`);
			if (org.website) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<a${attr("href", org.website)} target="_blank" rel="noopener" class="detail-link svelte-z9ersk">Website</a>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (org.linkedin_url) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<a${attr("href", org.linkedin_url)} target="_blank" rel="noopener" class="detail-link svelte-z9ersk">LinkedIn</a>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (org.glassdoor_url) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<a${attr("href", org.glassdoor_url)} target="_blank" rel="noopener" class="detail-link svelte-z9ersk">Glassdoor</a>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="field-group svelte-z9ersk"><label class="field-label svelte-z9ersk" for="detail-notes">Notes</label> <textarea id="detail-notes" class="detail-textarea svelte-z9ersk" rows="3" placeholder="Add notes about this organization...">`);
			const $$body = escape_html(notesValue);
			if ($$body) $$renderer.push(`${$$body}`);
			$$renderer.push(`</textarea> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="field-group svelte-z9ersk"><label class="field-label svelte-z9ersk" for="detail-reputation">Reputation Notes</label> <textarea id="detail-reputation" class="detail-textarea svelte-z9ersk" rows="3" placeholder="Reputation, red flags, culture notes...">`);
			const $$body_1 = escape_html(reputationValue);
			if ($$body_1) $$renderer.push(`${$$body_1}`);
			$$renderer.push(`</textarea> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div></div> <div class="modal-footer svelte-z9ersk"><a${attr("href", `/data/organizations?id=${stringify(org.id)}`)} class="btn btn-ghost svelte-z9ersk">Edit Full Details</a> <button class="btn btn-danger svelte-z9ersk"${attr("disabled", removing, true)}>${escape_html("Remove from Pipeline")}</button></div></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/kanban/KanbanBoard.svelte
function KanbanBoard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const COLUMNS = [
			{
				key: "backlog",
				label: "Backlog",
				statuses: ["backlog"],
				accent: "#a5b4fc"
			},
			{
				key: "researching",
				label: "Researching",
				statuses: ["researching"],
				accent: "#fbbf24"
			},
			{
				key: "targeting",
				label: "Targeting",
				statuses: [
					"exciting",
					"interested",
					"acceptable"
				],
				accent: "#22c55e"
			},
			{
				key: "excluded",
				label: "Excluded",
				statuses: ["excluded"],
				accent: "#d1d5db"
			}
		];
		const DROP_STATUS = {
			backlog: "backlog",
			researching: "researching",
			targeting: "interested",
			excluded: "excluded"
		};
		let organizations = [];
		let loading = true;
		let excludedExpanded = false;
		let showPicker = false;
		let detailOrgId = null;
		let aliasCountMap = /* @__PURE__ */ new Map();
		let hqLocationMap = /* @__PURE__ */ new Map();
		let detailOrg = derived(() => organizations.find((o) => o.id === detailOrgId) ?? null);
		let columnData = derived(() => COLUMNS.map((col) => ({
			...col,
			items: organizations.filter((o) => o.status && col.statuses.includes(o.status)).sort((a, b) => a.name.localeCompare(b.name)).map((o) => ({
				...o,
				id: o.id
			}))
		})));
		let hasAnyOrgs = derived(() => organizations.length > 0);
		async function loadOrganizations() {
			loading = true;
			const result = await forge.organizations.list({ limit: 500 });
			if (result.ok) {
				organizations = result.data.filter((o) => o.status);
				loadEnrichmentData(organizations);
			} else addToast({
				message: friendlyError(result.error, "Failed to load organizations"),
				type: "error"
			});
			loading = false;
		}
		async function loadEnrichmentData(orgs) {
			const aliasMap = /* @__PURE__ */ new Map();
			const hqMap = /* @__PURE__ */ new Map();
			const promises = orgs.map(async (org) => {
				try {
					const [aliasRes, campusRes] = await Promise.all([fetch(`/api/organizations/${org.id}/aliases`), fetch(`/api/organizations/${org.id}/campuses`)]);
					if (aliasRes.ok) {
						const aliases = (await aliasRes.json()).data ?? [];
						if (aliases.length > 0) aliasMap.set(org.id, aliases.length);
					}
					if (campusRes.ok) {
						const hq = ((await campusRes.json()).data ?? []).find((c) => c.is_headquarters);
						if (hq && (hq.city || hq.state)) hqMap.set(org.id, [hq.city, hq.state].filter(Boolean).join(", "));
					}
				} catch {}
			});
			await Promise.all(promises);
			aliasCountMap = aliasMap;
			hqLocationMap = hqMap;
		}
		async function handleDrop(columnKey, orgId) {
			if (!orgId) return;
			const newStatus = DROP_STATUS[columnKey];
			if (!newStatus) return;
			const col = COLUMNS.find((c) => c.key === columnKey);
			const org = organizations.find((o) => o.id === orgId);
			if (!col || !org) return;
			if (col.statuses.includes(org.status)) return;
			const oldStatus = org.status;
			organizations = organizations.map((o) => o.id === orgId ? {
				...o,
				status: newStatus
			} : o);
			const result = await forge.organizations.update(orgId, { status: newStatus });
			if (!result.ok) {
				organizations = organizations.map((o) => o.id === orgId ? {
					...o,
					status: oldStatus
				} : o);
				addToast({
					message: friendlyError(result.error, "Failed to update status"),
					type: "error"
				});
			}
		}
		function handleCardClick(orgId) {
			detailOrgId = orgId;
		}
		function handleDetailUpdate() {
			loadOrganizations();
		}
		function handlePickerAdd() {
			loadOrganizations();
		}
		$$renderer.push(`<div class="kanban-page svelte-3oqlmz"><div class="kanban-header svelte-3oqlmz"><h2 class="svelte-3oqlmz">Organization Pipeline</h2> <button class="btn-add svelte-3oqlmz">+ Add Organization</button></div> `);
		if (loading) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="board-loading svelte-3oqlmz">`);
			LoadingSpinner($$renderer, {
				size: "lg",
				message: "Loading pipeline..."
			});
			$$renderer.push(`<!----></div>`);
		} else if (!hasAnyOrgs()) {
			$$renderer.push("<!--[1-->");
			$$renderer.push(`<div class="board-empty svelte-3oqlmz"><p class="svelte-3oqlmz">No organizations in the pipeline yet.</p> <p class="svelte-3oqlmz">Click <strong>+ Add Organization</strong> to start tracking.</p></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="board-columns svelte-3oqlmz"><!--[-->`);
			const each_array = ensure_array_like(columnData());
			for (let i = 0, $$length = each_array.length; i < $$length; i++) {
				let col = each_array[i];
				KanbanColumn($$renderer, {
					label: col.label,
					accent: col.accent,
					items: col.items,
					collapsed: col.key === "excluded" && !excludedExpanded,
					onToggleCollapse: col.key === "excluded" ? () => {
						excludedExpanded = !excludedExpanded;
					} : void 0,
					onDrop: (orgId) => handleDrop(col.key, orgId),
					onCardClick: handleCardClick,
					aliasCountMap,
					hqLocationMap
				});
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div> `);
		OrgPickerModal($$renderer, {
			open: showPicker,
			onclose: () => showPicker = false,
			onadd: handlePickerAdd
		});
		$$renderer.push(`<!----> `);
		OrgDetailModal($$renderer, {
			org: detailOrg(),
			onclose: () => detailOrgId = null,
			onupdate: handleDetailUpdate
		});
		$$renderer.push(`<!---->`);
	});
}
//#endregion
//#region src/routes/opportunities/organizations/+page.svelte
function _page($$renderer) {
	KanbanBoard($$renderer, {});
}
//#endregion
export { _page as default };
