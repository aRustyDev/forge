import { n as onDestroy } from "./index-server.js";
import { C as escape_html, S as attr, i as derived, n as attr_style } from "./server.js";
import "./state.js";
import { r as LoadingSpinner } from "./components.js";
import "./sdk.js";
import "./chain-view.svelte.js";
import "graphology";
//#region src/lib/graph/types.ts
var NODE_COLORS = {
	source: "#6c63ff",
	bullet: "#3b82f6",
	perspective: "#10b981",
	resume_entry: "#f59e0b"
};
//#endregion
//#region src/lib/components/ChainViewModal.svelte
function ChainViewModal($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** @param highlightNode — graph node key to highlight on open (e.g. "source-550e8400-...") */
		/** @param isModal — when true, renders with modal chrome; when false, renders inline */
		/** @param onClose — callback invoked when the modal is dismissed */
		let { highlightNode = null, isModal = true, onClose } = $$props;
		let sigmaInstance = null;
		let selectedNodeData = null;
		let searchQuery = "";
		let sourceTypeFilter = "all";
		let statusFilter = "all";
		let archetypeFilter = "all";
		let allBullets = [];
		let allPerspectives = [];
		let nodeCount = 0;
		let edgeCount = 0;
		let driftedCount = 0;
		derived(() => selectedNodeData?.type === "bullet" ? allPerspectives.filter((p) => p.bullet_id === selectedNodeData.id) : []);
		derived(() => selectedNodeData?.type === "source" ? allBullets.filter((b) => b.sources?.some((s) => s.id === selectedNodeData.id)) : []);
		derived(() => selectedNodeData?.type === "perspective" ? allBullets.find((b) => {
			const persp = allPerspectives.find((p) => p.id === selectedNodeData.id);
			return persp ? b.id === persp.bullet_id : false;
		}) ?? null : null);
		onDestroy(() => {
			if (sigmaInstance) {
				sigmaInstance.kill();
				sigmaInstance = null;
			}
		});
		function chainContent($$renderer) {
			$$renderer.push(`<div class="controls svelte-j4rmdn"><input type="text" class="search-input svelte-j4rmdn" placeholder="Search nodes by content..."${attr("value", searchQuery)}/> `);
			$$renderer.select({
				class: "filter-select",
				value: sourceTypeFilter
			}, ($$renderer) => {
				$$renderer.option({ value: "all" }, ($$renderer) => {
					$$renderer.push(`All source types`);
				});
				$$renderer.option({ value: "role" }, ($$renderer) => {
					$$renderer.push(`Roles`);
				});
				$$renderer.option({ value: "project" }, ($$renderer) => {
					$$renderer.push(`Projects`);
				});
				$$renderer.option({ value: "education" }, ($$renderer) => {
					$$renderer.push(`Education`);
				});
				$$renderer.option({ value: "clearance" }, ($$renderer) => {
					$$renderer.push(`Clearances`);
				});
				$$renderer.option({ value: "general" }, ($$renderer) => {
					$$renderer.push(`General`);
				});
			}, "svelte-j4rmdn");
			$$renderer.push(` `);
			$$renderer.select({
				class: "filter-select",
				value: statusFilter
			}, ($$renderer) => {
				$$renderer.option({ value: "all" }, ($$renderer) => {
					$$renderer.push(`All statuses`);
				});
				$$renderer.option({ value: "draft" }, ($$renderer) => {
					$$renderer.push(`Draft`);
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
				$$renderer.option({ value: "archived" }, ($$renderer) => {
					$$renderer.push(`Archived`);
				});
			}, "svelte-j4rmdn");
			$$renderer.push(` `);
			$$renderer.select({
				class: "filter-select",
				value: archetypeFilter
			}, ($$renderer) => {
				$$renderer.option({ value: "all" }, ($$renderer) => {
					$$renderer.push(`All archetypes`);
				});
				$$renderer.option({ value: "agentic-ai" }, ($$renderer) => {
					$$renderer.push(`Agentic AI`);
				});
				$$renderer.option({ value: "infrastructure" }, ($$renderer) => {
					$$renderer.push(`Infrastructure`);
				});
				$$renderer.option({ value: "security-engineer" }, ($$renderer) => {
					$$renderer.push(`Security Engineer`);
				});
				$$renderer.option({ value: "solutions-architect" }, ($$renderer) => {
					$$renderer.push(`Solutions Architect`);
				});
				$$renderer.option({ value: "public-sector" }, ($$renderer) => {
					$$renderer.push(`Public Sector`);
				});
				$$renderer.option({ value: "hft" }, ($$renderer) => {
					$$renderer.push(`HFT`);
				});
			}, "svelte-j4rmdn");
			$$renderer.push(`</div> <div class="stats-bar svelte-j4rmdn"><span class="stat"><strong>${escape_html(nodeCount)}</strong> nodes</span> <span class="stat"><strong>${escape_html(edgeCount)}</strong> edges</span> `);
			if (driftedCount > 0) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<span class="stat drift-stat svelte-j4rmdn"><strong>${escape_html(driftedCount)}</strong> drifted</span>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="legend svelte-j4rmdn"><span class="legend-item svelte-j4rmdn"><span class="legend-dot svelte-j4rmdn"${attr_style("", { background: NODE_COLORS.source })}></span> Source</span> <span class="legend-item svelte-j4rmdn"><span class="legend-dot svelte-j4rmdn"${attr_style("", { background: NODE_COLORS.bullet })}></span> Bullet</span> <span class="legend-item svelte-j4rmdn"><span class="legend-dot svelte-j4rmdn"${attr_style("", { background: NODE_COLORS.perspective })}></span> Perspective</span> <span class="legend-item svelte-j4rmdn"><span class="legend-dot svelte-j4rmdn"${attr_style("", { background: NODE_COLORS.resume_entry })}></span> Entry</span> <span class="legend-divider svelte-j4rmdn">|</span> <span class="legend-item svelte-j4rmdn"><span class="legend-line svelte-j4rmdn"${attr_style("", { background: "#94a3b8" })}></span> Matching</span> <span class="legend-item svelte-j4rmdn"><span class="legend-line svelte-j4rmdn"${attr_style("", { background: "#ef4444" })}></span> Drifted</span></div></div> `);
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="loading-container svelte-j4rmdn">`);
			LoadingSpinner($$renderer, {
				size: "lg",
				message: "Building chain graph..."
			});
			$$renderer.push(`<!----></div>`);
			$$renderer.push(`<!--]-->`);
		}
		if (isModal) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="chain-modal-backdrop svelte-j4rmdn" tabindex="-1"><div class="chain-modal-content svelte-j4rmdn" role="dialog" aria-modal="true" aria-labelledby="chain-modal-title"><div class="chain-modal-header svelte-j4rmdn"><h2 id="chain-modal-title" class="svelte-j4rmdn">Chain View</h2> <button class="modal-close-btn svelte-j4rmdn">Close</button></div> `);
			chainContent($$renderer);
			$$renderer.push(`<!----></div></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			chainContent($$renderer);
		}
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
export { ChainViewModal as t };
