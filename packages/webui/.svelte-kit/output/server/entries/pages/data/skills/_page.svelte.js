import { C as escape_html, S as attr, a as ensure_array_like, i as derived } from "../../../../chunks/server.js";
import { r as LoadingSpinner } from "../../../../chunks/components.js";
import "../../../../chunks/toast.svelte.js";
import "../../../../chunks/sdk.js";
//#region src/routes/data/sources/SkillsView.svelte
function SkillsView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const CATEGORIES = [
			"ai_ml",
			"cloud",
			"database",
			"devops",
			"frameworks",
			"general",
			"language",
			"languages",
			"os",
			"security",
			"tools"
		];
		let skills = [];
		let selectedId = null;
		let categoryFilter = "all";
		let searchQuery = "";
		let formName = "";
		let formCategory = "general";
		let formNotes = "";
		let groupBy = "flat";
		let filteredSkills = derived(() => {
			let result = skills;
			if (categoryFilter !== "all") result = result.filter((s) => s.category === categoryFilter);
			if (searchQuery.trim());
			return result;
		});
		derived(() => {
			if (groupBy !== "by_category") return null;
			const groups = {};
			for (const skill of filteredSkills()) {
				const cat = skill.category ?? "general";
				if (!groups[cat]) groups[cat] = [];
				groups[cat].push(skill);
			}
			return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
		});
		let selectedSkill = derived(() => skills.find((s) => s.id === selectedId) ?? null);
		$$renderer.push(`<div class="skills-page svelte-gh03ov"><div class="list-panel svelte-gh03ov"><div class="list-header svelte-gh03ov"><h2 class="svelte-gh03ov">Skills</h2> <button class="btn-new svelte-gh03ov">+ New</button></div> <div class="filter-bar svelte-gh03ov"><input type="text" class="search-input svelte-gh03ov" placeholder="Search skills..."${attr("value", searchQuery)}/> `);
		$$renderer.select({
			class: "filter-select",
			value: categoryFilter
		}, ($$renderer) => {
			$$renderer.option({ value: "all" }, ($$renderer) => {
				$$renderer.push(`All categories`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(CATEGORIES);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let cat = each_array[$$index];
				$$renderer.option({ value: cat }, ($$renderer) => {
					$$renderer.push(`${escape_html(cat.replace(/_/g, " "))}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		}, "svelte-gh03ov");
		$$renderer.push(`</div> <div class="group-bar svelte-gh03ov"><label for="skill-group-by">Group by:</label> `);
		$$renderer.select({
			id: "skill-group-by",
			value: groupBy,
			class: ""
		}, ($$renderer) => {
			$$renderer.option({ value: "flat" }, ($$renderer) => {
				$$renderer.push(`None`);
			});
			$$renderer.option({ value: "by_category" }, ($$renderer) => {
				$$renderer.push(`Category`);
			});
		}, "svelte-gh03ov");
		$$renderer.push(`</div> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="list-loading svelte-gh03ov">`);
		LoadingSpinner($$renderer, {
			size: "md",
			message: "Loading skills..."
		});
		$$renderer.push(`<!----></div>`);
		$$renderer.push(`<!--]--></div> <div class="editor-panel svelte-gh03ov">`);
		if (!selectedSkill() && true) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="editor-empty svelte-gh03ov"><p>Select a skill or create a new one.</p></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="editor-content svelte-gh03ov"><div class="editor-header svelte-gh03ov"><h3 class="editor-heading svelte-gh03ov">${escape_html("Skill Details")}</h3> `);
			if (selectedSkill()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<button class="btn btn-edit svelte-gh03ov">Edit</button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div> <div class="form-group svelte-gh03ov"><label for="skill-name" class="svelte-gh03ov">Name <span class="required svelte-gh03ov">*</span></label> <input id="skill-name" type="text"${attr("value", formName)} placeholder="e.g. Kubernetes"${attr("disabled", true, true)} class="svelte-gh03ov"/></div> <div class="form-group svelte-gh03ov"><label for="skill-category" class="svelte-gh03ov">Category</label> `);
			$$renderer.select({
				id: "skill-category",
				value: formCategory,
				disabled: true,
				class: ""
			}, ($$renderer) => {
				$$renderer.push(`<!--[-->`);
				const each_array_4 = ensure_array_like(CATEGORIES);
				for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
					let cat = each_array_4[$$index_4];
					$$renderer.option({ value: cat }, ($$renderer) => {
						$$renderer.push(`${escape_html(cat.replace(/_/g, " "))}`);
					});
				}
				$$renderer.push(`<!--]-->`);
			}, "svelte-gh03ov");
			$$renderer.push(`</div> <div class="form-group svelte-gh03ov"><label for="skill-notes" class="svelte-gh03ov">Notes</label> <textarea id="skill-notes" rows="3" placeholder="Proficiency level, years of experience, context..."${attr("disabled", true, true)} class="svelte-gh03ov">`);
			const $$body = escape_html(formNotes);
			if ($$body) $$renderer.push(`${$$body}`);
			$$renderer.push(`</textarea></div> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
//#region src/routes/data/skills/+page.svelte
function _page($$renderer) {
	$$renderer.push(`<div class="skills-page-wrapper svelte-1tsudjs">`);
	SkillsView($$renderer, {});
	$$renderer.push(`<!----></div>`);
}
//#endregion
export { _page as default };
