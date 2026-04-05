import { C as escape_html, a as ensure_array_like, n as attr_style, t as attr_class } from "./server.js";
import { r as LoadingSpinner } from "./components.js";
import "./dist.js";
//#region src/lib/components/ViewToggle.svelte
function ViewToggle($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { mode, onchange } = $$props;
		$$renderer.push(`<div class="view-toggle svelte-14yz30v"><button${attr_class("toggle-btn svelte-14yz30v", void 0, { "active": mode === "list" })}>List</button> <button${attr_class("toggle-btn svelte-14yz30v", void 0, { "active": mode === "board" })}>Board</button></div>`);
	});
}
//#endregion
//#region src/lib/components/kanban/GenericKanbanColumn.svelte
function GenericKanbanColumn($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { column, items, cardContent, collapsed = false, onToggleCollapse, onDrop } = $$props;
		let localItems = [];
		if (collapsed) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="column-collapsed svelte-1v8xupo" role="button" tabindex="0"${attr_style("", { "border-top-color": column.accent })}><span class="collapsed-label svelte-1v8xupo">${escape_html(column.label)}</span> <span class="collapsed-count svelte-1v8xupo">${escape_html(items.length)}</span></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="column svelte-1v8xupo"${attr_style("", { "border-top-color": column.accent })}><div class="column-header svelte-1v8xupo"><h3 class="column-label svelte-1v8xupo">${escape_html(column.label)}</h3> <span class="column-count svelte-1v8xupo">${escape_html(localItems.length)}</span> `);
			if (onToggleCollapse) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<button class="collapse-btn svelte-1v8xupo" title="Collapse">✕</button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="column-body svelte-1v8xupo"><!--[-->`);
			const each_array = ensure_array_like(localItems);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let item = each_array[$$index];
				$$renderer.push(`<div class="kanban-card-wrapper svelte-1v8xupo">`);
				cardContent($$renderer, item);
				$$renderer.push(`<!----></div>`);
			}
			$$renderer.push(`<!--]--></div></div>`);
		}
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/kanban/GenericKanban.svelte
function GenericKanban($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Unique key for this column (used as drop target identifier) */
		/** Display label */
		/** Status values that map to this column */
		/** Default status to set when dropping into this column (first entry in statuses[] if omitted) */
		/** Accent color (CSS color value) for column header border */
		let { columns, items, onDrop, loading = false, loadingMessage = "Loading...", emptyMessage = "No items yet.", filterBar, cardContent, defaultCollapsed = "", sortItems = (a, b) => {
			const aVal = Object.values(a).find((v, i) => i > 1 && typeof v === "string") ?? "";
			const bVal = Object.values(b).find((v, i) => i > 1 && typeof v === "string") ?? "";
			return aVal.localeCompare(bVal);
		} } = $$props;
		let collapsedColumns = {};
		let columnState = /* @__PURE__ */ new Map();
		function toggleCollapse(key) {
			collapsedColumns[key] = !collapsedColumns[key];
		}
		async function handleDrop(columnKey, itemId) {
			const col = columns.find((c) => c.key === columnKey);
			if (!col) return;
			const newStatus = col.dropStatus ?? col.statuses[0];
			if ((columnState.get(columnKey) ?? []).some((i) => i.id === itemId)) return;
			const item = items.find((i) => i.id === itemId);
			if (!item) return;
			const previousStatus = item.status;
			item.status = newStatus;
			const grouped = /* @__PURE__ */ new Map();
			for (const c of columns) {
				const cItems = items.filter((i) => c.statuses.includes(i.status)).sort(sortItems);
				grouped.set(c.key, cItems);
			}
			columnState = grouped;
			try {
				await onDrop(itemId, newStatus);
			} catch {
				item.status = previousStatus;
				const reverted = /* @__PURE__ */ new Map();
				for (const c of columns) {
					const cItems = items.filter((i) => c.statuses.includes(i.status)).sort(sortItems);
					reverted.set(c.key, cItems);
				}
				columnState = reverted;
			}
		}
		if (loading) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="board-loading svelte-1ohlvc6">`);
			LoadingSpinner($$renderer, { message: loadingMessage });
			$$renderer.push(`<!----></div>`);
		} else if (items.length === 0) {
			$$renderer.push("<!--[1-->");
			$$renderer.push(`<div class="board-empty svelte-1ohlvc6"><p class="svelte-1ohlvc6">${escape_html(emptyMessage)}</p></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			if (filterBar) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="board-filter-bar svelte-1ohlvc6">`);
				filterBar($$renderer);
				$$renderer.push(`<!----></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="board-columns svelte-1ohlvc6"><!--[-->`);
			const each_array = ensure_array_like(columns);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let col = each_array[$$index];
				GenericKanbanColumn($$renderer, {
					column: col,
					items: columnState.get(col.key) ?? [],
					cardContent,
					collapsed: collapsedColumns[col.key] ?? false,
					onToggleCollapse: () => toggleCollapse(col.key),
					onDrop: (itemId) => handleDrop(col.key, itemId)
				});
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]-->`);
	});
}
function getViewMode(entity) {
	return "list";
}
function setViewMode(entity, mode) {}
//#endregion
export { ViewToggle as i, setViewMode as n, GenericKanban as r, getViewMode as t };
