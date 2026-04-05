import "../../../../chunks/index-server.js";
import { C as escape_html, S as attr, a as ensure_array_like, o as head, t as attr_class } from "../../../../chunks/server.js";
import "../../../../chunks/sdk.js";
//#region src/routes/config/export/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let resumes = [];
		let selectedResumeId = "";
		let format = "pdf";
		const entityTypes = [
			{
				key: "sources",
				label: "Sources"
			},
			{
				key: "bullets",
				label: "Bullets"
			},
			{
				key: "perspectives",
				label: "Perspectives"
			},
			{
				key: "skills",
				label: "Skills"
			},
			{
				key: "organizations",
				label: "Organizations"
			},
			{
				key: "summaries",
				label: "Summaries"
			},
			{
				key: "job_descriptions",
				label: "Job Descriptions"
			}
		];
		let selectedEntities = Object.fromEntries(entityTypes.map((e) => [e.key, true]));
		let exportingData = false;
		let exportingDump = false;
		head("gl34jm", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>Export | Forge</title>`);
			});
		});
		$$renderer.push(`<div class="page svelte-gl34jm"><h1 class="svelte-gl34jm">Export</h1> <section class="export-section svelte-gl34jm"><h2 class="svelte-gl34jm">Export Resume</h2> <p>Download a resume in your preferred format.</p> <div class="export-form svelte-gl34jm"><label>Resume `);
		$$renderer.select({ value: selectedResumeId }, ($$renderer) => {
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(resumes);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let resume = each_array[$$index];
				$$renderer.option({ value: resume.id }, ($$renderer) => {
					$$renderer.push(`${escape_html(resume.name)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		});
		$$renderer.push(`</label> <label>Format <div class="format-selector svelte-gl34jm"><!--[-->`);
		const each_array_1 = ensure_array_like([
			"pdf",
			"markdown",
			"latex",
			"json"
		]);
		for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
			let fmt = each_array_1[$$index_1];
			$$renderer.push(`<button${attr_class("format-btn svelte-gl34jm", void 0, { "active": format === fmt })}>${escape_html(fmt.toUpperCase())}</button>`);
		}
		$$renderer.push(`<!--]--></div></label> <button class="btn btn-primary svelte-gl34jm"${attr("disabled", true, true)}>${escape_html("Download")}</button> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></section> <section class="export-section svelte-gl34jm"><h2 class="svelte-gl34jm">Export Data</h2> <p>Download entity data as a JSON bundle for backup or portability.</p> <div class="entity-checkboxes svelte-gl34jm"><!--[-->`);
		const each_array_2 = ensure_array_like(entityTypes);
		for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
			let entity = each_array_2[$$index_2];
			$$renderer.push(`<label class="checkbox-label svelte-gl34jm"><input type="checkbox"${attr("checked", selectedEntities[entity.key], true)}/> ${escape_html(entity.label)}</label>`);
		}
		$$renderer.push(`<!--]--></div> <div class="entity-actions svelte-gl34jm"><button class="btn btn-sm svelte-gl34jm">Select All</button> <button class="btn btn-sm svelte-gl34jm">Deselect All</button></div> <button class="btn btn-primary svelte-gl34jm"${attr("disabled", exportingData, true)}>${escape_html("Download Data")}</button> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section> <section class="export-section svelte-gl34jm"><h2 class="svelte-gl34jm">Database Backup</h2> <p>Download a full SQL dump of the database. This includes all tables,
      data, and schema definitions. The dump can be re-imported with <code class="svelte-gl34jm">sqlite3 forge.db &lt; dump.sql</code>.</p> <button class="btn btn-primary svelte-gl34jm"${attr("disabled", exportingDump, true)}>${escape_html("Download SQL Dump")}</button> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section></div>`);
	});
}
//#endregion
export { _page as default };
