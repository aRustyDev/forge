import { C as escape_html, S as attr, a as ensure_array_like, c as stringify, i as derived, t as attr_class } from "../../../../chunks/server.js";
import { i as StatusBadge, n as EmptyState, r as LoadingSpinner, t as ConfirmDialog } from "../../../../chunks/components.js";
import { t as addToast } from "../../../../chunks/toast.svelte.js";
import { n as friendlyError, t as forge } from "../../../../chunks/sdk.js";
import { i as ViewToggle, n as setViewMode, r as GenericKanban, t as getViewMode } from "../../../../chunks/viewMode.svelte.js";
//#region src/lib/components/DerivePerspectivesDialog.svelte
function DerivePerspectivesDialog($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { bulletId, onclose, onderive } = $$props;
		let canDerive = derived(() => false);
		$$renderer.push(`<div class="dialog-overlay svelte-6fn0hw" role="presentation"><div class="dialog svelte-6fn0hw" role="dialog" aria-modal="true" aria-label="Derive Perspectives"><div class="dialog-header svelte-6fn0hw"><h3 class="svelte-6fn0hw">Derive Perspectives</h3> <button class="close-btn svelte-6fn0hw">×</button></div> <div class="dialog-body svelte-6fn0hw">`);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="loading-container svelte-6fn0hw">`);
		LoadingSpinner($$renderer, {
			size: "md",
			message: "Loading options..."
		});
		$$renderer.push(`<!----></div>`);
		$$renderer.push(`<!--]--></div> <div class="dialog-actions svelte-6fn0hw"><button class="btn btn-ghost svelte-6fn0hw">Cancel</button> <button class="btn btn-primary svelte-6fn0hw"${attr("disabled", !canDerive(), true)}>`);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`Derive`);
		$$renderer.push(`<!--]--></button></div></div></div>`);
	});
}
//#endregion
//#region src/lib/components/BulletDetailModal.svelte
function BulletDetailModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { bulletId, onclose, onupdate } = $$props;
		let bulletSkills = [];
		let allSkills = [];
		let skillSearch = "";
		let showDeriveDialog = false;
		let showDeleteConfirm = false;
		derived(() => {
			if (!skillSearch.trim()) return [];
			const q = skillSearch.toLowerCase();
			const linkedIds = new Set(bulletSkills.map((s) => s.id));
			return allSkills.filter((s) => !linkedIds.has(s.id) && s.name.toLowerCase().includes(q)).slice(0, 10);
		});
		derived(() => {
			if (!skillSearch.trim()) return false;
			const q = skillSearch.trim().toLowerCase();
			return !allSkills.some((s) => s.name.toLowerCase() === q);
		});
		async function deleteBullet() {
			const res = await forge.bullets.delete(bulletId);
			if (res.ok) {
				addToast({
					message: "Bullet deleted",
					type: "success"
				});
				onupdate();
				onclose();
			} else {
				showDeleteConfirm = false;
				if (res.error.code === "CONFLICT") addToast({
					message: "Cannot delete bullet with existing perspectives. Delete its perspectives first.",
					type: "error"
				});
				else addToast({
					message: friendlyError(res.error, "Delete failed"),
					type: "error"
				});
			}
		}
		async function onDeriveComplete() {
			const res = await forge.perspectives.list({
				bullet_id: bulletId,
				limit: 200
			});
			if (res.ok) res.data;
			onupdate();
		}
		$$renderer.push(`<div class="modal-overlay svelte-1kcac2m" role="presentation"><div class="modal-content svelte-1kcac2m" role="dialog" aria-modal="true" aria-label="Bullet Details">`);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="loading-container svelte-1kcac2m">`);
		LoadingSpinner($$renderer, {
			size: "lg",
			message: "Loading bullet..."
		});
		$$renderer.push(`<!----></div>`);
		$$renderer.push(`<!--]--></div></div> `);
		if (showDeriveDialog) {
			$$renderer.push("<!--[0-->");
			DerivePerspectivesDialog($$renderer, {
				bulletId,
				onclose: () => showDeriveDialog = false,
				onderive: onDeriveComplete
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		ConfirmDialog($$renderer, {
			open: showDeleteConfirm,
			title: "Delete Bullet",
			message: "Are you sure you want to delete this bullet? This cannot be undone.",
			confirmLabel: "Delete",
			onconfirm: deleteBullet,
			oncancel: () => showDeleteConfirm = false
		});
		$$renderer.push(`<!---->`);
	});
}
//#endregion
//#region src/lib/components/kanban/BulletKanbanCard.svelte
function BulletKanbanCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { bullet, onclick } = $$props;
		let contentPreview = derived(() => bullet.content.length > 80 ? bullet.content.slice(0, 80) + "..." : bullet.content);
		let isRejected = derived(() => bullet.status === "rejected");
		let isArchived = derived(() => bullet.status === "archived");
		$$renderer.push(`<div${attr_class("kanban-card svelte-1y35m51", void 0, {
			"rejected": isRejected(),
			"archived": isArchived()
		})} role="button" tabindex="0"><p class="card-content svelte-1y35m51">${escape_html(contentPreview())}</p> `);
		if (bullet.domain) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="domain-badge svelte-1y35m51">${escape_html(bullet.domain)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (bullet.technologies && bullet.technologies.length > 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="tech-pills svelte-1y35m51"><!--[-->`);
			const each_array = ensure_array_like(bullet.technologies.slice(0, 3));
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let tech = each_array[$$index];
				$$renderer.push(`<span class="pill svelte-1y35m51">${escape_html(tech)}</span>`);
			}
			$$renderer.push(`<!--]--> `);
			if (bullet.technologies.length > 3) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="pill pill-neutral svelte-1y35m51">+${escape_html(bullet.technologies.length - 3)}</span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/kanban/PerspectiveKanbanCard.svelte
function PerspectiveKanbanCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { perspective, onclick } = $$props;
		let contentPreview = derived(() => perspective.content.length > 80 ? perspective.content.slice(0, 80) + "..." : perspective.content);
		let isRejected = derived(() => perspective.status === "rejected");
		let isArchived = derived(() => perspective.status === "archived");
		$$renderer.push(`<div${attr_class("kanban-card svelte-14vji6l", void 0, {
			"rejected": isRejected(),
			"archived": isArchived()
		})} role="button" tabindex="0"><p class="card-content svelte-14vji6l">${escape_html(contentPreview())}</p> <div class="badge-row svelte-14vji6l">`);
		if (perspective.target_archetype) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="pill svelte-14vji6l">${escape_html(perspective.target_archetype)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (perspective.domain) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="pill pill-neutral svelte-14vji6l">${escape_html(perspective.domain)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <span class="framing-badge svelte-14vji6l">${escape_html(perspective.framing)}</span></div></div>`);
	});
}
//#endregion
//#region src/lib/components/filters/BulletFilterBar.svelte
function BulletFilterBar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { filters, onchange } = $$props;
		let sources = [];
		let domains = [];
		function handleChange() {
			onchange();
		}
		$$renderer.push(`<div class="filter-bar svelte-8bnmiz">`);
		$$renderer.select({
			class: "field-select",
			value: filters.source,
			onchange: handleChange
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`All Sources`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(sources);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let src = each_array[$$index];
				$$renderer.option({ value: src.id }, ($$renderer) => {
					$$renderer.push(`${escape_html(src.title)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		}, "svelte-8bnmiz");
		$$renderer.push(` `);
		$$renderer.select({
			class: "field-select",
			value: filters.domain,
			onchange: handleChange
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`All Domains`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array_1 = ensure_array_like(domains);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let domain = each_array_1[$$index_1];
				$$renderer.option({ value: domain }, ($$renderer) => {
					$$renderer.push(`${escape_html(domain)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		}, "svelte-8bnmiz");
		$$renderer.push(` <input type="text" class="field-input svelte-8bnmiz" placeholder="Search bullets..."${attr("value", filters.search)}/></div>`);
	});
}
//#endregion
//#region src/lib/components/filters/PerspectiveFilterBar.svelte
function PerspectiveFilterBar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { filters, onchange } = $$props;
		let archetypes = [];
		let domains = [];
		function handleChange() {
			onchange();
		}
		$$renderer.push(`<div class="filter-bar svelte-jd3n57">`);
		$$renderer.select({
			class: "field-select",
			value: filters.archetype,
			onchange: handleChange
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`All Archetypes`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(archetypes);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let arch = each_array[$$index];
				$$renderer.option({ value: arch }, ($$renderer) => {
					$$renderer.push(`${escape_html(arch)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		}, "svelte-jd3n57");
		$$renderer.push(` `);
		$$renderer.select({
			class: "field-select",
			value: filters.domain,
			onchange: handleChange
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`All Domains`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array_1 = ensure_array_like(domains);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let domain = each_array_1[$$index_1];
				$$renderer.option({ value: domain }, ($$renderer) => {
					$$renderer.push(`${escape_html(domain)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		}, "svelte-jd3n57");
		$$renderer.push(` `);
		$$renderer.select({
			class: "field-select",
			value: filters.framing,
			onchange: handleChange
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`All Framings`);
			});
			$$renderer.option({ value: "accomplishment" }, ($$renderer) => {
				$$renderer.push(`Accomplishment`);
			});
			$$renderer.option({ value: "responsibility" }, ($$renderer) => {
				$$renderer.push(`Responsibility`);
			});
			$$renderer.option({ value: "context" }, ($$renderer) => {
				$$renderer.push(`Context`);
			});
		}, "svelte-jd3n57");
		$$renderer.push(` <input type="text" class="field-input svelte-jd3n57" placeholder="Search perspectives..."${attr("value", filters.search)}/></div>`);
	});
}
//#endregion
//#region src/routes/data/sources/BulletsView.svelte
function BulletsView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let contentType = "bullet";
		let items = [];
		let loading = true;
		let searchQuery = "";
		let statusFilter = "all";
		let viewMode = getViewMode("bullets");
		function handleViewChange(mode) {
			viewMode = mode;
			setViewMode(contentType === "bullet" ? "bullets" : "perspectives", mode);
		}
		const BULLET_COLUMNS = [
			{
				key: "draft",
				label: "Draft",
				statuses: ["draft"],
				accent: "#a5b4fc"
			},
			{
				key: "in_review",
				label: "In Review",
				statuses: ["in_review"],
				accent: "#fbbf24"
			},
			{
				key: "approved",
				label: "Approved",
				statuses: ["approved"],
				accent: "#22c55e"
			},
			{
				key: "rejected",
				label: "Rejected",
				statuses: ["rejected"],
				accent: "#ef4444"
			},
			{
				key: "archived",
				label: "Archived",
				statuses: ["archived"],
				accent: "#d1d5db"
			}
		];
		const PERSPECTIVE_COLUMNS = [
			{
				key: "draft",
				label: "Draft",
				statuses: ["draft"],
				accent: "#a5b4fc"
			},
			{
				key: "in_review",
				label: "In Review",
				statuses: ["in_review"],
				accent: "#fbbf24"
			},
			{
				key: "approved",
				label: "Approved",
				statuses: ["approved"],
				accent: "#22c55e"
			},
			{
				key: "rejected",
				label: "Rejected",
				statuses: ["rejected"],
				accent: "#ef4444"
			},
			{
				key: "archived",
				label: "Archived",
				statuses: ["archived"],
				accent: "#d1d5db"
			}
		];
		let bulletBoardFilters = {};
		let perspectiveBoardFilters = {};
		let boardFilteredItems = derived(() => {
			if (contentType === "bullet") {
				let result = items;
				if (bulletBoardFilters.domain) result = result.filter((b) => b.domain === bulletBoardFilters.domain);
				if (bulletBoardFilters.search) {
					const q = bulletBoardFilters.search.toLowerCase();
					result = result.filter((b) => b.content.toLowerCase().includes(q));
				}
				return result;
			} else {
				let result = items;
				if (perspectiveBoardFilters.archetype) result = result.filter((p) => p.target_archetype === perspectiveBoardFilters.archetype);
				if (perspectiveBoardFilters.domain) result = result.filter((p) => p.domain === perspectiveBoardFilters.domain);
				if (perspectiveBoardFilters.framing) result = result.filter((p) => p.framing === perspectiveBoardFilters.framing);
				if (perspectiveBoardFilters.search) {
					const q = perspectiveBoardFilters.search.toLowerCase();
					result = result.filter((p) => p.content.toLowerCase().includes(q));
				}
				return result;
			}
		});
		async function handleBoardDrop(itemId, newStatus) {
			if (contentType === "bullet") {
				const result = await forge.bullets.update(itemId, { status: newStatus });
				if (!result.ok) {
					addToast({
						type: "error",
						message: friendlyError(result.error, "Status update failed")
					});
					throw new Error("Status update failed");
				}
				items = items.map((i) => i.id === itemId ? result.data : i);
				addToast({
					type: "success",
					message: `Bullet moved to ${newStatus.replace("_", " ")}`
				});
			} else {
				const result = await forge.perspectives.update(itemId, { status: newStatus });
				if (!result.ok) {
					addToast({
						type: "error",
						message: friendlyError(result.error, "Status update failed")
					});
					throw new Error("Status update failed");
				}
				items = items.map((i) => i.id === itemId ? result.data : i);
				addToast({
					type: "success",
					message: `Perspective moved to ${newStatus.replace("_", " ")}`
				});
			}
		}
		let detailBulletId = null;
		let rejectModal = {
			open: false,
			type: "bullet",
			id: "",
			reason: ""
		};
		let filteredItems = derived(() => {
			let result = items;
			if (statusFilter !== "all") result = result.filter((i) => i.status === statusFilter);
			if (searchQuery.trim());
			return result;
		});
		async function loadItems() {
			loading = true;
			items = [];
			if (contentType === "bullet") {
				const result = await forge.bullets.list({ limit: 500 });
				if (result.ok) items = result.data;
				else addToast({
					message: friendlyError(result.error, "Failed to load bullets"),
					type: "error"
				});
			} else if (contentType === "perspective") {
				const result = await forge.perspectives.list({ limit: 500 });
				if (result.ok) items = result.data;
				else addToast({
					message: friendlyError(result.error, "Failed to load perspectives"),
					type: "error"
				});
			}
			loading = false;
		}
		function truncate(text, max = 200) {
			if (text.length <= max) return text;
			return text.slice(0, max) + "...";
		}
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<div class="bullets-page svelte-12zb2mk"><div class="page-header-row svelte-12zb2mk"><div><h1 class="page-title svelte-12zb2mk">Content Atoms</h1> <p class="subtitle svelte-12zb2mk">Unified view of bullets and perspectives</p></div> `);
			ViewToggle($$renderer, {
				mode: viewMode,
				onchange: handleViewChange
			});
			$$renderer.push(`<!----></div> <div class="controls svelte-12zb2mk"><div class="type-tabs svelte-12zb2mk"><!--[-->`);
			const each_array = ensure_array_like([{
				value: "bullet",
				label: "Bullets"
			}, {
				value: "perspective",
				label: "Perspectives"
			}]);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let tab = each_array[$$index];
				$$renderer.push(`<button${attr_class("type-tab svelte-12zb2mk", void 0, { "active": contentType === tab.value })}>${escape_html(tab.label)}</button>`);
			}
			$$renderer.push(`<!--]--></div> <input type="text" class="search-input svelte-12zb2mk" placeholder="Search content..."${attr("value", searchQuery)}/> `);
			$$renderer.select({
				class: "status-select",
				value: statusFilter
			}, ($$renderer) => {
				$$renderer.option({ value: "all" }, ($$renderer) => {
					$$renderer.push(`All statuses`);
				});
				$$renderer.option({ value: "in_review" }, ($$renderer) => {
					$$renderer.push(`In Review`);
				});
				$$renderer.option({ value: "approved" }, ($$renderer) => {
					$$renderer.push(`Approved`);
				});
				$$renderer.option({ value: "rejected" }, ($$renderer) => {
					$$renderer.push(`Rejected`);
				});
				$$renderer.option({ value: "draft" }, ($$renderer) => {
					$$renderer.push(`Draft`);
				});
				$$renderer.option({ value: "archived" }, ($$renderer) => {
					$$renderer.push(`Archived`);
				});
			}, "svelte-12zb2mk");
			$$renderer.push(`</div> `);
			if (viewMode === "board") {
				$$renderer.push("<!--[0-->");
				if (contentType === "bullet") {
					$$renderer.push("<!--[0-->");
					{
						function filterBar($$renderer) {
							BulletFilterBar($$renderer, {
								onchange: () => {},
								get filters() {
									return bulletBoardFilters;
								},
								set filters($$value) {
									bulletBoardFilters = $$value;
									$$settled = false;
								}
							});
						}
						function cardContent($$renderer, bullet) {
							BulletKanbanCard($$renderer, {
								bullet,
								onclick: () => detailBulletId = bullet.id
							});
						}
						GenericKanban($$renderer, {
							columns: BULLET_COLUMNS,
							items: boardFilteredItems(),
							onDrop: handleBoardDrop,
							loading,
							emptyMessage: "No bullets yet. Create sources and derive bullets to populate this board.",
							defaultCollapsed: "archived",
							sortItems: (a, b) => a.content.localeCompare(b.content),
							filterBar,
							cardContent,
							$$slots: {
								filterBar: true,
								cardContent: true
							}
						});
					}
				} else {
					$$renderer.push("<!--[-1-->");
					{
						function filterBar($$renderer) {
							PerspectiveFilterBar($$renderer, {
								onchange: () => {},
								get filters() {
									return perspectiveBoardFilters;
								},
								set filters($$value) {
									perspectiveBoardFilters = $$value;
									$$settled = false;
								}
							});
						}
						function cardContent($$renderer, perspective) {
							PerspectiveKanbanCard($$renderer, {
								perspective,
								onclick: () => detailBulletId = perspective.bullet_id
							});
						}
						GenericKanban($$renderer, {
							columns: PERSPECTIVE_COLUMNS,
							items: boardFilteredItems(),
							onDrop: handleBoardDrop,
							loading,
							emptyMessage: "No perspectives yet. Derive perspectives from approved bullets.",
							defaultCollapsed: "archived",
							sortItems: (a, b) => a.content.localeCompare(b.content),
							filterBar,
							cardContent,
							$$slots: {
								filterBar: true,
								cardContent: true
							}
						});
					}
				}
				$$renderer.push(`<!--]-->`);
			} else {
				$$renderer.push("<!--[-1-->");
				if (loading) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="loading-container svelte-12zb2mk">`);
					LoadingSpinner($$renderer, {
						size: "lg",
						message: `Loading ${stringify(contentType)}s...`
					});
					$$renderer.push(`<!----></div>`);
				} else if (filteredItems().length === 0) {
					$$renderer.push("<!--[1-->");
					EmptyState($$renderer, {
						title: `No ${stringify(contentType)}s found`,
						description: "No items match the current filters."
					});
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<div class="item-list svelte-12zb2mk"><!--[-->`);
					const each_array_1 = ensure_array_like(filteredItems());
					for (let $$index_3 = 0, $$length = each_array_1.length; $$index_3 < $$length; $$index_3++) {
						let item = each_array_1[$$index_3];
						$$renderer.push(`<div class="item-card svelte-12zb2mk" style="cursor: pointer;"><div class="item-header svelte-12zb2mk"><p class="item-content svelte-12zb2mk">${escape_html(truncate(item.content, 200))}</p> `);
						StatusBadge($$renderer, { status: item.status });
						$$renderer.push(`<!----></div> `);
						if (contentType === "bullet") {
							$$renderer.push("<!--[0-->");
							if (item.sources?.length > 0) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<div class="meta-row svelte-12zb2mk"><span class="meta-label svelte-12zb2mk">Sources:</span> <!--[-->`);
								const each_array_2 = ensure_array_like(item.sources);
								for (let $$index_1 = 0, $$length = each_array_2.length; $$index_1 < $$length; $$index_1++) {
									let src = each_array_2[$$index_1];
									$$renderer.push(`<span${attr_class("source-tag svelte-12zb2mk", void 0, { "primary": src.is_primary })}>${escape_html(src.title)}</span>`);
								}
								$$renderer.push(`<!--]--></div>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--> `);
							if (item.technologies?.length > 0) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<div class="tech-tags svelte-12zb2mk"><!--[-->`);
								const each_array_3 = ensure_array_like(item.technologies);
								for (let $$index_2 = 0, $$length = each_array_3.length; $$index_2 < $$length; $$index_2++) {
									let tech = each_array_3[$$index_2];
									$$renderer.push(`<span class="tech-tag svelte-12zb2mk">${escape_html(tech)}</span>`);
								}
								$$renderer.push(`<!--]--></div>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]-->`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> `);
						if (contentType === "perspective") {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<div class="perspective-meta svelte-12zb2mk">`);
							if (item.target_archetype) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<span class="meta-tag archetype svelte-12zb2mk">${escape_html(item.target_archetype)}</span>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--> `);
							if (item.domain) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<span class="meta-tag domain svelte-12zb2mk">${escape_html(item.domain)}</span>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--> <span class="meta-tag framing svelte-12zb2mk">${escape_html(item.framing)}</span></div>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> `);
						if (item.rejection_reason) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<p class="rejection-reason svelte-12zb2mk">Reason: ${escape_html(item.rejection_reason)}</p>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> <div class="item-actions svelte-12zb2mk">`);
						if (item.status === "in_review") {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<button class="btn btn-approve svelte-12zb2mk">Approve</button> <button class="btn btn-reject svelte-12zb2mk">Reject</button>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> `);
						if (item.status === "rejected") {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<button class="btn btn-reopen svelte-12zb2mk">Reopen</button>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></div></div>`);
					}
					$$renderer.push(`<!--]--></div>`);
				}
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--></div> `);
			if (rejectModal.open) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="modal-overlay svelte-12zb2mk" role="presentation"><div class="modal svelte-12zb2mk" role="dialog" aria-modal="true" aria-label="Reject Item"><div class="modal-header svelte-12zb2mk"><h3 class="svelte-12zb2mk">Reject ${escape_html(rejectModal.type)}</h3> <button class="btn btn-ghost svelte-12zb2mk">Close</button></div> <div class="modal-body svelte-12zb2mk"><div class="form-group svelte-12zb2mk"><label for="reject-reason" class="svelte-12zb2mk">Reason <span class="required svelte-12zb2mk">*</span></label> <textarea id="reject-reason" rows="4" placeholder="Why is this being rejected?" class="svelte-12zb2mk">`);
				const $$body = escape_html(rejectModal.reason);
				if ($$body) $$renderer.push(`${$$body}`);
				$$renderer.push(`</textarea></div> <div class="modal-actions svelte-12zb2mk"><button class="btn btn-ghost svelte-12zb2mk">Cancel</button> <button class="btn btn-danger svelte-12zb2mk">Reject</button></div></div></div></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (detailBulletId) {
				$$renderer.push("<!--[0-->");
				BulletDetailModal($$renderer, {
					bulletId: detailBulletId,
					onclose: () => detailBulletId = null,
					onupdate: () => loadItems()
				});
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]-->`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
	});
}
//#endregion
//#region src/routes/data/bullets/+page.svelte
function _page($$renderer) {
	$$renderer.push(`<div class="bullets-page-wrapper svelte-1fxsqv">`);
	BulletsView($$renderer, {});
	$$renderer.push(`<!----></div>`);
}
//#endregion
export { _page as default };
