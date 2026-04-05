import { n as onDestroy } from "../../../chunks/index-server.js";
import { C as escape_html, S as attr, a as ensure_array_like, c as stringify, i as derived, n as attr_style, t as attr_class, u as html } from "../../../chunks/server.js";
import { i as StatusBadge, n as EmptyState, r as LoadingSpinner, t as ConfirmDialog } from "../../../chunks/components.js";
import { t as addToast } from "../../../chunks/toast.svelte.js";
import { n as friendlyError, r as isDevMode, t as forge } from "../../../chunks/sdk.js";
import "../../../chunks/chain-view.svelte.js";
import { i as ViewToggle, n as setViewMode, r as GenericKanban, t as getViewMode } from "../../../chunks/viewMode.svelte.js";
import "../../../chunks/dist.js";
import { EditorView } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
//#region src/lib/debug.svelte.ts
function debugState(label, stateGetter) {
	if (!isDevMode()) return;
}
//#endregion
//#region src/lib/components/resume/HeaderEditor.svelte
function HeaderEditor($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { header, resumeId, onSave } = $$props;
		header.tagline;
		$$renderer.push(`<div class="header-editor"><div class="header-display svelte-gdd610"><div class="header-display-top svelte-gdd610"><h2 class="header-name svelte-gdd610">${escape_html(header.name)}</h2></div> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<div class="tagline-row svelte-gdd610">`);
		if (header.tagline) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<p class="header-tagline svelte-gdd610">${escape_html(header.tagline)}</p>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<p class="header-tagline placeholder svelte-gdd610">No tagline set</p>`);
		}
		$$renderer.push(`<!--]--> <button class="btn btn-sm btn-ghost svelte-gdd610">Edit Tagline</button></div>`);
		$$renderer.push(`<!--]--> <div class="header-contact svelte-gdd610">`);
		if (header.location) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span>${escape_html(header.location)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (header.email) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span>${escape_html(header.email)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (header.phone) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span>${escape_html(header.phone)}</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (header.linkedin) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<a${attr("href", header.linkedin)} target="_blank" rel="noopener" class="svelte-gdd610">LinkedIn</a>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (header.github) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<a${attr("href", header.github)} target="_blank" rel="noopener" class="svelte-gdd610">GitHub</a>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (header.website) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<a${attr("href", header.website)} target="_blank" rel="noopener" class="svelte-gdd610">Website</a>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		if (header.clearance) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<p class="header-clearance svelte-gdd610">${escape_html(header.clearance)}</p>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <a href="/config/profile" class="edit-profile-link svelte-gdd610">Edit contact info in Profile</a></div></div>`);
	});
}
//#endregion
//#region src/lib/components/resume/AddSectionDropdown.svelte
function AddSectionDropdown($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const ENTRY_TYPES = [
			{
				value: "experience",
				label: "Experience",
				defaultTitle: "Experience"
			},
			{
				value: "skills",
				label: "Skills",
				defaultTitle: "Technical Skills"
			},
			{
				value: "education",
				label: "Education",
				defaultTitle: "Education"
			},
			{
				value: "projects",
				label: "Projects",
				defaultTitle: "Selected Projects"
			},
			{
				value: "clearance",
				label: "Clearance",
				defaultTitle: "Security Clearance"
			},
			{
				value: "presentations",
				label: "Presentations",
				defaultTitle: "Presentations"
			},
			{
				value: "certifications",
				label: "Certifications",
				defaultTitle: "Certifications"
			},
			{
				value: "awards",
				label: "Awards",
				defaultTitle: "Awards"
			},
			{
				value: "freeform",
				label: "Custom (Freeform)",
				defaultTitle: "Custom Section"
			}
		];
		let { existingTypes, onSelect } = $$props;
		derived(() => {
			const existing = new Set(existingTypes);
			const notPresent = ENTRY_TYPES.filter((t) => !existing.has(t.value));
			const present = ENTRY_TYPES.filter((t) => existing.has(t.value));
			return [...notPresent, ...present];
		});
		$$renderer.push(`<div class="add-section-container svelte-s7c4jj"><button class="btn btn-add-section svelte-s7c4jj">+ Add Section</button> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/resume/DragNDropView.svelte
function DragNDropView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { ir, resumeId, onUpdate, onAddEntry, onAddSection, onDeleteSection, onRenameSection, onMoveSection } = $$props;
		let editingEntryId = null;
		let editContent = "";
		let editSaving = false;
		let editingSectionId = null;
		let editSectionTitle = "";
		let tooltipEntry = null;
		let tooltipPosition = {
			x: 0,
			y: 0
		};
		let dndBullets = {};
		let sortedSections = derived(() => [...ir.sections].sort((a, b) => a.display_order - b.display_order));
		$$renderer.push(`<div class="dnd-view svelte-sogx7s">`);
		HeaderEditor($$renderer, {
			header: ir.header,
			resumeId,
			onSave: onUpdate
		});
		$$renderer.push(`<!----> <!--[-->`);
		const each_array = ensure_array_like(sortedSections());
		for (let i = 0, $$length = each_array.length; i < $$length; i++) {
			let section = each_array[i];
			$$renderer.push(`<div class="dnd-section svelte-sogx7s"><div class="section-header svelte-sogx7s">`);
			if (editingSectionId === section.id) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<input class="section-title-input svelte-sogx7s"${attr("value", editSectionTitle)}/>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<h3 class="dnd-section-title svelte-sogx7s">${escape_html(section.title)}</h3>`);
			}
			$$renderer.push(`<!--]--> <span class="entry-type-badge svelte-sogx7s">${escape_html(section.type)}</span> <div class="section-controls svelte-sogx7s">`);
			if (i > 0) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<button class="btn btn-xs btn-ghost svelte-sogx7s" title="Move up">▲</button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (i < sortedSections().length - 1) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<button class="btn btn-xs btn-ghost svelte-sogx7s" title="Move down">▼</button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <button class="btn btn-xs btn-ghost btn-section-delete svelte-sogx7s" title="Delete section">✕</button></div></div> `);
			if (section.type === "experience") {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<!--[-->`);
				const each_array_1 = ensure_array_like(section.items);
				for (let $$index_2 = 0, $$length = each_array_1.length; $$index_2 < $$length; $$index_2++) {
					let item = each_array_1[$$index_2];
					if (item.kind === "experience_group") {
						$$renderer.push("<!--[0-->");
						const group = item;
						$$renderer.push(`<div class="experience-group svelte-sogx7s"><h4 class="org-name svelte-sogx7s">${escape_html(group.organization)}</h4> <!--[-->`);
						const each_array_2 = ensure_array_like(group.subheadings);
						for (let $$index_1 = 0, $$length = each_array_2.length; $$index_1 < $$length; $$index_1++) {
							let sub = each_array_2[$$index_1];
							$$renderer.push(`<div class="subheading svelte-sogx7s"><div class="subheading-header svelte-sogx7s"><span class="role-title svelte-sogx7s">${escape_html(sub.title)}</span> <span class="date-range svelte-sogx7s">${escape_html(sub.date_range)}</span></div> <div class="bullet-list svelte-sogx7s"><!--[-->`);
							const each_array_3 = ensure_array_like(dndBullets[sub.id] ?? []);
							for (let $$index = 0, $$length = each_array_3.length; $$index < $$length; $$index++) {
								let bullet = each_array_3[$$index];
								$$renderer.push(`<div${attr_class("bullet-item svelte-sogx7s", void 0, { "cloned": bullet.is_cloned })} role="listitem">`);
								if (editingEntryId === bullet.entry_id) {
									$$renderer.push("<!--[0-->");
									$$renderer.push(`<textarea class="bullet-edit-textarea svelte-sogx7s"${attr("rows", 3)}>`);
									const $$body = escape_html(editContent);
									if ($$body) $$renderer.push(`${$$body}`);
									$$renderer.push(`</textarea> <div class="bullet-edit-actions svelte-sogx7s"><button class="btn btn-sm btn-primary svelte-sogx7s"${attr("disabled", editSaving, true)}>${escape_html("Save")}</button> <button class="btn btn-sm btn-ghost svelte-sogx7s">Cancel</button></div>`);
								} else {
									$$renderer.push("<!--[-1-->");
									$$renderer.push(`<span class="drag-handle svelte-sogx7s">☰</span> <span class="bullet-content svelte-sogx7s">${escape_html(bullet.content)}</span> <div class="bullet-actions svelte-sogx7s">`);
									if (bullet.is_cloned) {
										$$renderer.push("<!--[0-->");
										$$renderer.push(`<span class="clone-badge svelte-sogx7s">Edited</span> <button class="btn btn-xs btn-ghost svelte-sogx7s" title="Reset to reference">Reset</button>`);
									} else $$renderer.push("<!--[-1-->");
									$$renderer.push(`<!--]--> <button class="btn btn-xs btn-ghost svelte-sogx7s">Edit</button></div>`);
								}
								$$renderer.push(`<!--]--></div>`);
							}
							$$renderer.push(`<!--]--></div> `);
							if (onAddEntry && sub.source_id) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<button class="btn btn-xs btn-add-role svelte-sogx7s"${attr("title", `Add a bullet from ${stringify(sub.title)}`)}>+ Add from this role</button>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--></div>`);
						}
						$$renderer.push(`<!--]--></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				}
				$$renderer.push(`<!--]-->`);
			} else if (section.type === "skills") {
				$$renderer.push("<!--[1-->");
				$$renderer.push(`<!--[-->`);
				const each_array_4 = ensure_array_like(section.items);
				for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
					let item = each_array_4[$$index_4];
					if (item.kind === "skill_group") {
						$$renderer.push("<!--[0-->");
						const skillGroup = item;
						$$renderer.push(`<div class="skill-categories svelte-sogx7s"><!--[-->`);
						const each_array_5 = ensure_array_like(skillGroup.categories);
						for (let $$index_3 = 0, $$length = each_array_5.length; $$index_3 < $$length; $$index_3++) {
							let cat = each_array_5[$$index_3];
							$$renderer.push(`<div class="skill-category svelte-sogx7s"><strong>${escape_html(cat.label)}:</strong> ${escape_html(cat.skills.join(", "))}</div>`);
						}
						$$renderer.push(`<!--]--></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				}
				$$renderer.push(`<!--]-->`);
			} else if (section.type === "education") {
				$$renderer.push("<!--[2-->");
				$$renderer.push(`<!--[-->`);
				const each_array_6 = ensure_array_like(section.items);
				for (let $$index_5 = 0, $$length = each_array_6.length; $$index_5 < $$length; $$index_5++) {
					let item = each_array_6[$$index_5];
					if (item.kind === "education") {
						$$renderer.push("<!--[0-->");
						const edu = item;
						$$renderer.push(`<div class="education-item svelte-sogx7s"><div class="edu-header svelte-sogx7s"><span class="edu-institution svelte-sogx7s">${escape_html(edu.institution)}</span> <span class="edu-date svelte-sogx7s">${escape_html(edu.date)}</span></div> <span class="edu-degree svelte-sogx7s">${escape_html(edu.degree)}</span></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				}
				$$renderer.push(`<!--]-->`);
			} else if (section.type === "certifications") {
				$$renderer.push("<!--[3-->");
				$$renderer.push(`<!--[-->`);
				const each_array_7 = ensure_array_like(section.items);
				for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
					let item = each_array_7[$$index_7];
					if (item.kind === "certification_group") {
						$$renderer.push("<!--[0-->");
						const certGroup = item;
						$$renderer.push(`<!--[-->`);
						const each_array_8 = ensure_array_like(certGroup.categories);
						for (let $$index_6 = 0, $$length = each_array_8.length; $$index_6 < $$length; $$index_6++) {
							let cat = each_array_8[$$index_6];
							$$renderer.push(`<div class="cert-category svelte-sogx7s"><strong>${escape_html(cat.label)}:</strong> ${escape_html(cat.certs.map((c) => c.name).join(", "))}</div>`);
						}
						$$renderer.push(`<!--]-->`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				}
				$$renderer.push(`<!--]-->`);
			} else if (section.type === "projects") {
				$$renderer.push("<!--[4-->");
				$$renderer.push(`<!--[-->`);
				const each_array_9 = ensure_array_like(section.items);
				for (let $$index_9 = 0, $$length = each_array_9.length; $$index_9 < $$length; $$index_9++) {
					let item = each_array_9[$$index_9];
					if (item.kind === "project") {
						$$renderer.push("<!--[0-->");
						const proj = item;
						$$renderer.push(`<div class="project-item svelte-sogx7s"><div class="project-header svelte-sogx7s"><span class="project-name svelte-sogx7s">${escape_html(proj.name)}</span> `);
						if (proj.date) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<span class="project-date svelte-sogx7s">${escape_html(proj.date)}</span>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></div> <!--[-->`);
						const each_array_10 = ensure_array_like(proj.bullets);
						for (let $$index_8 = 0, $$length = each_array_10.length; $$index_8 < $$length; $$index_8++) {
							let bullet = each_array_10[$$index_8];
							$$renderer.push(`<div${attr_class("bullet-item svelte-sogx7s", void 0, { "cloned": bullet.is_cloned })}><span class="bullet-content svelte-sogx7s">${escape_html(bullet.content)}</span></div>`);
						}
						$$renderer.push(`<!--]--></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				}
				$$renderer.push(`<!--]-->`);
			} else if (section.type === "summary") {
				$$renderer.push("<!--[5-->");
				$$renderer.push(`<!--[-->`);
				const each_array_11 = ensure_array_like(section.items);
				for (let $$index_10 = 0, $$length = each_array_11.length; $$index_10 < $$length; $$index_10++) {
					let item = each_array_11[$$index_10];
					if (item.kind === "summary") {
						$$renderer.push("<!--[0-->");
						const summary = item;
						$$renderer.push(`<p class="summary-text svelte-sogx7s">${escape_html(summary.content)}</p>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				}
				$$renderer.push(`<!--]-->`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--[-->`);
				const each_array_12 = ensure_array_like(section.items);
				for (let $$index_12 = 0, $$length = each_array_12.length; $$index_12 < $$length; $$index_12++) {
					let item = each_array_12[$$index_12];
					$$renderer.push(`<div class="generic-item svelte-sogx7s">`);
					if ("content" in item) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<p>${escape_html(item.content)}</p>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> `);
					if ("bullets" in item && Array.isArray(item.bullets)) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<!--[-->`);
						const each_array_13 = ensure_array_like(item.bullets);
						for (let $$index_11 = 0, $$length = each_array_13.length; $$index_11 < $$length; $$index_11++) {
							let bullet = each_array_13[$$index_11];
							$$renderer.push(`<div class="bullet-item svelte-sogx7s"><span class="bullet-content svelte-sogx7s">${escape_html(bullet.content)}</span></div>`);
						}
						$$renderer.push(`<!--]-->`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></div>`);
				}
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--> `);
			if (onAddEntry) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<button class="btn btn-sm btn-add-entry svelte-sogx7s">+ Add Entry</button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--> `);
		if (onAddSection) {
			$$renderer.push("<!--[0-->");
			AddSectionDropdown($$renderer, {
				existingTypes: ir.sections.map((s) => s.type),
				onSelect: (entryType, title) => onAddSection(entryType, title)
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		if (tooltipEntry?.source_chain) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="provenance-tooltip svelte-sogx7s"${attr_style(`left: ${stringify(tooltipPosition.x)}px; top: ${stringify(tooltipPosition.y)}px;`)}><div class="tooltip-row svelte-sogx7s"><strong class="svelte-sogx7s">Source:</strong> <span class="tooltip-label svelte-sogx7s">${escape_html(tooltipEntry.source_chain.source_title)}</span> <button class="tooltip-link svelte-sogx7s">→</button></div> <div class="tooltip-row svelte-sogx7s"><strong class="svelte-sogx7s">Bullet:</strong> <span class="tooltip-label svelte-sogx7s">${escape_html(tooltipEntry.source_chain.bullet_preview)}</span> <button class="tooltip-link svelte-sogx7s">→</button></div> <div class="tooltip-row svelte-sogx7s"><strong class="svelte-sogx7s">Perspective:</strong> <span class="tooltip-label svelte-sogx7s">${escape_html(tooltipEntry.source_chain.perspective_preview)}</span> <button class="tooltip-link svelte-sogx7s">→</button></div> `);
			if (tooltipEntry.is_cloned) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="tooltip-row tooltip-cloned svelte-sogx7s">Content has been manually edited</div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/resume/OverrideBanner.svelte
function OverrideBanner($$renderer, $$props) {
	let { isStale, hasOverride, onRegenerate, onReset } = $$props;
	if (hasOverride) {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div${attr_class("override-banner svelte-hp5b12", void 0, {
			"stale": isStale,
			"current": !isStale
		})}>`);
		if (isStale) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="banner-message svelte-hp5b12"><span class="banner-icon svelte-hp5b12">⚠</span> <span>The structured resume has been updated since this override was saved. The text below may not reflect recent changes.</span></div> <div class="banner-actions svelte-hp5b12"><button class="banner-btn banner-regenerate svelte-hp5b12">Regenerate</button> <button class="banner-btn banner-reset svelte-hp5b12">Reset to Generated</button></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="banner-message svelte-hp5b12"><span class="banner-icon-info svelte-hp5b12">ℹ</span> <span>Showing manual override. Edits here will not update the structured resume data.</span></div> <div class="banner-actions svelte-hp5b12"><button class="banner-btn banner-reset svelte-hp5b12">Reset to Generated</button></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
	} else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]-->`);
}
//#endregion
//#region src/lib/components/resume/MarkdownView.svelte
function MarkdownView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { ir, override, overrideUpdatedAt, resumeUpdatedAt, resumeId, onOverrideChange } = $$props;
		let editorView = void 0;
		let previewHtml = "";
		let editable = false;
		let activeTab = "preview";
		let saving = false;
		const editableCompartment = new Compartment();
		const readOnlyCompartment = new Compartment();
		let isOverride = derived(() => override !== null);
		let isStale = derived(() => isOverride() && overrideUpdatedAt !== null && resumeUpdatedAt > overrideUpdatedAt);
		derived(() => override ?? compileMarkdown(ir));
		function escMd(s) {
			return s;
		}
		function compileMarkdown(doc) {
			const lines = [];
			lines.push(`# ${escMd(doc.header.name)}`);
			if (doc.header.tagline) lines.push(escMd(doc.header.tagline));
			const contact = [];
			if (doc.header.location) contact.push(escMd(doc.header.location));
			if (doc.header.email) contact.push(escMd(doc.header.email));
			if (doc.header.phone) contact.push(escMd(doc.header.phone));
			if (doc.header.linkedin) contact.push(`[LinkedIn](${doc.header.linkedin})`);
			if (doc.header.github) contact.push(`[GitHub](${doc.header.github})`);
			if (doc.header.website) contact.push(`[Website](${doc.header.website})`);
			if (contact.length > 0) lines.push(contact.join(" | "));
			lines.push("");
			for (const section of doc.sections) {
				lines.push(...renderSection(section));
				lines.push("");
			}
			return lines.join("\n").trimEnd() + "\n";
		}
		function renderSection(section) {
			const lines = [];
			lines.push(`## ${escMd(section.title)}`);
			lines.push("");
			switch (section.type) {
				case "summary":
					for (const item of section.items) if (item.kind === "summary") lines.push(escMd(item.content));
					break;
				case "experience":
					for (const item of section.items) if (item.kind === "experience_group") {
						const g = item;
						lines.push(`### ${escMd(g.organization)}`);
						for (const sub of g.subheadings) {
							lines.push(`**${escMd(sub.title)}** | ${escMd(sub.date_range)}`);
							for (const b of sub.bullets) lines.push(`- ${escMd(b.content)}`);
							lines.push("");
						}
					}
					break;
				case "skills":
					for (const item of section.items) if (item.kind === "skill_group") for (const cat of item.categories) lines.push(`**${escMd(cat.label)}**: ${cat.skills.map((s) => escMd(s)).join(", ")}`);
					break;
				case "education":
					for (const item of section.items) if (item.kind === "education") {
						const e = item;
						lines.push(`**${escMd(e.institution)}**`);
						lines.push(`${escMd(e.degree)} | ${escMd(e.date)}`);
						lines.push("");
					}
					break;
				case "projects":
					for (const item of section.items) if (item.kind === "project") {
						const p = item;
						const dateSuffix = p.date ? ` | ${escMd(p.date)}` : "";
						lines.push(`### ${escMd(p.name)}${dateSuffix}`);
						for (const b of p.bullets) lines.push(`- ${escMd(b.content)}`);
						lines.push("");
					}
					break;
				case "certifications":
					for (const item of section.items) if (item.kind === "certification_group") for (const cat of item.categories) lines.push(`**${escMd(cat.label)}**: ${cat.certs.map((c) => escMd(c.name)).join(", ")}`);
					break;
				case "clearance":
					for (const item of section.items) if (item.kind === "clearance") lines.push(escMd(item.content));
					break;
				case "presentations":
					for (const item of section.items) if (item.kind === "presentation") {
						const pr = item;
						const venueDate = [pr.venue, pr.date].filter(Boolean).join(", ");
						lines.push(`### ${escMd(pr.title)}${venueDate ? ` | ${escMd(venueDate)}` : ""}`);
						for (const b of pr.bullets) lines.push(`- ${escMd(b.content)}`);
						lines.push("");
					}
					break;
				default:
					for (const item of section.items) if ("content" in item && typeof item.content === "string") lines.push(`- ${escMd(item.content)}`);
					break;
			}
			return lines;
		}
		onDestroy(() => {
			editorView?.destroy();
		});
		function toggleEditable(enable) {
			editable = enable;
			editorView?.dispatch({ effects: [editableCompartment.reconfigure(EditorView.editable.of(enable)), readOnlyCompartment.reconfigure(EditorState.readOnly.of(!enable))] });
		}
		async function handleRegenerate() {
			saving = true;
			try {
				const freshContent = compileMarkdown(ir);
				const result = await forge.resumes.updateMarkdownOverride(resumeId, freshContent);
				if (result.ok) {
					addToast({
						message: "Markdown regenerated from IR",
						type: "success"
					});
					await onOverrideChange();
				} else addToast({
					message: friendlyError(result.error),
					type: "error"
				});
			} finally {
				saving = false;
			}
		}
		async function handleReset() {
			saving = true;
			try {
				const result = await forge.resumes.updateMarkdownOverride(resumeId, null);
				if (result.ok) {
					addToast({
						message: "Override cleared, showing generated content",
						type: "success"
					});
					toggleEditable(false);
					await onOverrideChange();
				} else addToast({
					message: friendlyError(result.error),
					type: "error"
				});
			} finally {
				saving = false;
			}
		}
		$$renderer.push(`<div class="markdown-view svelte-1b8z9o8">`);
		OverrideBanner($$renderer, {
			isStale: isStale(),
			hasOverride: isOverride(),
			onRegenerate: handleRegenerate,
			onReset: handleReset
		});
		$$renderer.push(`<!----> <div class="tab-bar svelte-1b8z9o8"><div class="tab-group svelte-1b8z9o8"><button${attr_class("tab svelte-1b8z9o8", void 0, { "active": activeTab === "edit" })}>Edit</button> <button${attr_class("tab svelte-1b8z9o8", void 0, { "active": activeTab === "preview" })}>Preview</button></div> <div class="tab-actions svelte-1b8z9o8">`);
		if (isOverride() || editable) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<button class="btn btn-sm btn-primary svelte-1b8z9o8"${attr("disabled", saving, true)}>${escape_html(saving ? "Saving..." : "Save")}</button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div> <div class="content-pane svelte-1b8z9o8">`);
		if (activeTab === "edit") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="editor-pane svelte-1b8z9o8"></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="preview-pane svelte-1b8z9o8">${html(previewHtml)}</div>`);
		}
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
//#region src/lib/components/resume/LatexView.svelte
function LatexView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { ir, override, overrideUpdatedAt, resumeUpdatedAt, resumeId, onOverrideChange } = $$props;
		let editorView = void 0;
		let previewHtml = "";
		let editable = false;
		let activeTab = "preview";
		let saving = false;
		const editableCompartment = new Compartment();
		const readOnlyCompartment = new Compartment();
		let isOverride = derived(() => override !== null);
		let isStale = derived(() => isOverride() && overrideUpdatedAt !== null && resumeUpdatedAt > overrideUpdatedAt);
		derived(() => override ?? generateLatexPlaceholder(ir));
		function generateLatexPlaceholder(doc) {
			const lines = [];
			lines.push("% Auto-generated LaTeX preview from resume IR");
			lines.push("% Enable editing and save to create an override");
			lines.push("\\documentclass[letterpaper,11pt]{article}");
			lines.push("\\begin{document}");
			lines.push("");
			lines.push(`\\section*{${escLatex(doc.header.name)}}`);
			if (doc.header.tagline) lines.push(`\\textit{${escLatex(doc.header.tagline)}}`);
			const contact = [];
			if (doc.header.location) contact.push(escLatex(doc.header.location));
			if (doc.header.email) contact.push(escLatex(doc.header.email));
			if (doc.header.phone) contact.push(escLatex(doc.header.phone));
			if (contact.length > 0) lines.push(contact.join(" $\\cdot$ "));
			lines.push("");
			for (const section of doc.sections) {
				lines.push(`\\section{${escLatex(section.title)}}`);
				for (const item of section.items) if (item.kind === "experience_group") {
					lines.push("\\resumeSubHeadingListStart");
					for (const sub of item.subheadings) {
						lines.push(`\\resumeSubheading{${escLatex(item.organization)}}{}{${escLatex(sub.title)}}{${escLatex(sub.date_range)}}`);
						lines.push("\\resumeItemListStart");
						for (const b of sub.bullets) lines.push(`\\resumeItem{${escLatex(b.content)}}`);
						lines.push("\\resumeItemListEnd");
					}
					lines.push("\\resumeSubHeadingListEnd");
				} else if (item.kind === "summary") lines.push(escLatex(item.content));
				else if (item.kind === "skill_group") for (const cat of item.categories) lines.push(`\\textbf{${escLatex(cat.label)}}: ${cat.skills.map((s) => escLatex(s)).join(", ")}`);
				else if (item.kind === "education") lines.push(`\\resumeSubheading{${escLatex(item.institution)}}{}{${escLatex(item.degree)}}{${escLatex(item.date)}}`);
				else if (item.kind === "project") {
					lines.push(`\\resumeProjectHeading{${escLatex(item.name)}}{${item.date ? escLatex(item.date) : ""}}`);
					if (item.bullets.length > 0) {
						lines.push("\\resumeItemListStart");
						for (const b of item.bullets) lines.push(`\\resumeItem{${escLatex(b.content)}}`);
						lines.push("\\resumeItemListEnd");
					}
				} else if (item.kind === "certification_group") for (const cat of item.categories) lines.push(`\\textbf{${escLatex(cat.label)}}: ${cat.certs.map((c) => escLatex(c.name)).join(", ")}`);
				else if (item.kind === "clearance") lines.push(escLatex(item.content));
				else if (item.kind === "presentation") {
					lines.push(`\\resumeProjectHeading{${escLatex(item.title)}}{${item.date ? escLatex(item.date) : ""}}`);
					if (item.bullets.length > 0) {
						lines.push("\\resumeItemListStart");
						for (const b of item.bullets) lines.push(`\\resumeItem{${escLatex(b.content)}}`);
						lines.push("\\resumeItemListEnd");
					}
				}
				lines.push("");
			}
			lines.push("\\end{document}");
			return lines.join("\n");
		}
		function escLatex(s) {
			return s.replace(/\\/g, "\\textbackslash{}").replace(/[&%$#_{}~^]/g, (m) => "\\" + m);
		}
		onDestroy(() => {
			editorView?.destroy();
		});
		function toggleEditable(enable) {
			editable = enable;
			editorView?.dispatch({ effects: [editableCompartment.reconfigure(EditorView.editable.of(enable)), readOnlyCompartment.reconfigure(EditorState.readOnly.of(!enable))] });
		}
		async function handleRegenerate() {
			saving = true;
			try {
				const freshContent = generateLatexPlaceholder(ir);
				const result = await forge.resumes.updateLatexOverride(resumeId, freshContent);
				if (result.ok) {
					addToast({
						message: "LaTeX regenerated from IR",
						type: "success"
					});
					await onOverrideChange();
				} else addToast({
					message: friendlyError(result.error),
					type: "error"
				});
			} finally {
				saving = false;
			}
		}
		async function handleReset() {
			saving = true;
			try {
				const result = await forge.resumes.updateLatexOverride(resumeId, null);
				if (result.ok) {
					addToast({
						message: "Override cleared, showing generated content",
						type: "success"
					});
					toggleEditable(false);
					await onOverrideChange();
				} else addToast({
					message: friendlyError(result.error),
					type: "error"
				});
			} finally {
				saving = false;
			}
		}
		$$renderer.push(`<div class="latex-view svelte-1jdcdqn">`);
		OverrideBanner($$renderer, {
			isStale: isStale(),
			hasOverride: isOverride(),
			onRegenerate: handleRegenerate,
			onReset: handleReset
		});
		$$renderer.push(`<!----> <div class="tab-bar svelte-1jdcdqn"><div class="tab-group svelte-1jdcdqn"><button${attr_class("tab svelte-1jdcdqn", void 0, { "active": activeTab === "edit" })}>Edit</button> <button${attr_class("tab svelte-1jdcdqn", void 0, { "active": activeTab === "preview" })}>Preview</button></div> <div class="tab-actions svelte-1jdcdqn">`);
		if (isOverride() || editable) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<button class="btn btn-sm btn-primary svelte-1jdcdqn"${attr("disabled", saving, true)}>${escape_html(saving ? "Saving..." : "Save")}</button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div> <div class="content-pane svelte-1jdcdqn">`);
		if (activeTab === "edit") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="editor-pane svelte-1jdcdqn"></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="preview-pane svelte-1jdcdqn">${html(previewHtml)}</div>`);
		}
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
//#region src/lib/components/resume/PdfView.svelte
function PdfView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { resumeId, ir } = $$props;
		onDestroy(() => {});
		$$renderer.push(`<div class="pdf-view svelte-lych7d">`);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="pdf-empty svelte-lych7d"><p class="pdf-empty-text svelte-lych7d">Click "Generate PDF" to compile your resume to PDF using tectonic.</p> <button class="btn btn-primary svelte-lych7d">Generate PDF</button></div>`);
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/resume/SkillsPicker.svelte
function SkillsPicker($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { resumeId, sectionId, onClose, onUpdate } = $$props;
		let allSkills = [];
		derived(() => {
			const groups = /* @__PURE__ */ new Map();
			for (const skill of allSkills) {
				const cat = skill.category ?? "Other";
				if (!groups.has(cat)) groups.set(cat, []);
				groups.get(cat).push(skill);
			}
			return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
		});
		$$renderer.push(`<div class="modal-overlay svelte-1mkblg0" role="presentation"><div class="skills-picker-modal svelte-1mkblg0" role="dialog" aria-modal="true" aria-label="Select Skills"><div class="picker-header svelte-1mkblg0"><h3 class="svelte-1mkblg0">Select Skills</h3> <button class="btn btn-sm btn-ghost svelte-1mkblg0">Close</button></div> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<p class="loading-text svelte-1mkblg0">Loading skills...</p>`);
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
//#region src/lib/components/resume/SourcePicker.svelte
function SourcePicker($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { resumeId, sectionId, sourceType, onClose, onUpdate } = $$props;
		$$renderer.push(`<div class="modal-overlay svelte-xlqyaf" role="presentation"><div class="source-picker-modal svelte-xlqyaf" role="dialog" aria-modal="true" aria-label="Select Source"><div class="picker-header svelte-xlqyaf"><h3 class="svelte-xlqyaf">Select ${escape_html(sourceType === "education" ? "Education" : sourceType === "project" ? "Project" : "Clearance")}</h3> <button class="btn btn-sm btn-ghost svelte-xlqyaf">Close</button></div> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<p class="loading-text svelte-xlqyaf">Loading sources...</p>`);
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
//#region src/lib/components/SummaryPicker.svelte
function SummaryPicker($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Called when the user picks a summary. `id` is the summary to link, or null to skip. */
		let { open, onpick, oncancel } = $$props;
		let summaries = [];
		derived(() => summaries.filter((s) => s.is_template));
		derived(() => summaries.filter((s) => !s.is_template));
		if (open) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="overlay svelte-1jes5im"><div class="picker-dialog svelte-1jes5im"><div class="picker-header svelte-1jes5im"><h2 class="picker-title svelte-1jes5im">Pick a Summary</h2> <button class="btn btn-primary btn-sm svelte-1jes5im">Create New</button></div> <div class="picker-body svelte-1jes5im">`);
			$$renderer.push("<!--[0-->");
			LoadingSpinner($$renderer, {});
			$$renderer.push(`<!--]--></div> <div class="picker-footer svelte-1jes5im"><button class="btn btn-ghost btn-sm svelte-1jes5im">Cancel</button> <button class="btn btn-ghost btn-sm svelte-1jes5im">Skip</button></div></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/kanban/ResumeKanbanCard.svelte
function ResumeKanbanCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { resume, onclick } = $$props;
		let isApproved = derived(() => resume.status === "approved");
		let isArchived = derived(() => resume.status === "archived");
		let isRejected = derived(() => resume.status === "rejected");
		$$renderer.push(`<div${attr_class("kanban-card svelte-x2wfqm", void 0, {
			"archived": isArchived(),
			"rejected": isRejected()
		})} role="button" tabindex="0"><div class="card-header svelte-x2wfqm"><span class="card-title svelte-x2wfqm">${escape_html(resume.name)}</span> `);
		if (isApproved()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="approved-check svelte-x2wfqm" title="Approved">✓</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> <span class="target-role svelte-x2wfqm">${escape_html(resume.target_role)}</span> <span class="target-employer svelte-x2wfqm">${escape_html(resume.target_employer)}</span> <div class="card-meta svelte-x2wfqm"><span class="archetype-badge svelte-x2wfqm">${escape_html(resume.archetype)}</span> `);
		if (resume.section_count !== void 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<span class="section-count svelte-x2wfqm">${escape_html(resume.section_count)} sections</span>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
//#region src/lib/components/filters/ResumeFilterBar.svelte
function ResumeFilterBar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { filters, onchange } = $$props;
		let archetypes = [];
		let employers = [];
		function handleChange() {
			onchange();
		}
		$$renderer.push(`<div class="filter-bar svelte-15xascy">`);
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
		}, "svelte-15xascy");
		$$renderer.push(` `);
		$$renderer.select({
			class: "field-select",
			value: filters.target_employer,
			onchange: handleChange
		}, ($$renderer) => {
			$$renderer.option({ value: "" }, ($$renderer) => {
				$$renderer.push(`All Employers`);
			});
			$$renderer.push(`<!--[-->`);
			const each_array_1 = ensure_array_like(employers);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let emp = each_array_1[$$index_1];
				$$renderer.option({ value: emp }, ($$renderer) => {
					$$renderer.push(`${escape_html(emp)}`);
				});
			}
			$$renderer.push(`<!--]-->`);
		}, "svelte-15xascy");
		$$renderer.push(` <input type="text" class="field-input svelte-15xascy" placeholder="Search resumes..."${attr("value", filters.search)}/></div>`);
	});
}
//#endregion
//#region src/routes/resumes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const VIEW_TABS = [
			{
				value: "dnd",
				label: "DragNDrop"
			},
			{
				value: "markdown",
				label: "Markdown"
			},
			{
				value: "latex",
				label: "LaTeX"
			},
			{
				value: "pdf",
				label: "PDF"
			}
		];
		let archetypeNames = [];
		async function loadArchetypes() {
			const result = await forge.archetypes.list({ limit: 200 });
			if (result.ok) archetypeNames = result.data.map((a) => a.name);
		}
		loadArchetypes();
		const SECTION_LABELS = {
			summary: "Summary",
			experience: "Experience",
			skills: "Skills",
			education: "Education",
			projects: "Projects",
			certifications: "Certifications",
			clearance: "Clearance",
			presentations: "Presentations",
			awards: "Awards",
			custom: "Custom"
		};
		let resumes = [];
		let selectedResumeId = null;
		let resumeDetail = null;
		let gapAnalysis = null;
		let loading = true;
		let detailLoading = false;
		let gapLoading = false;
		let viewMode = getViewMode("resumes");
		function handleViewChange(mode) {
			viewMode = mode;
			setViewMode("resumes", mode);
		}
		const RESUME_COLUMNS = [
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
		let resumeBoardFilters = {};
		let boardFilteredResumes = derived(() => {
			let result = resumes;
			if (resumeBoardFilters.archetype) result = result.filter((r) => r.archetype === resumeBoardFilters.archetype);
			if (resumeBoardFilters.target_employer) result = result.filter((r) => r.target_employer === resumeBoardFilters.target_employer);
			if (resumeBoardFilters.search) {
				const q = resumeBoardFilters.search.toLowerCase();
				result = result.filter((r) => r.name.toLowerCase().includes(q) || r.target_role.toLowerCase().includes(q));
			}
			return result;
		});
		async function handleResumeBoardDrop(itemId, newStatus) {
			const result = await forge.resumes.update(itemId, { status: newStatus });
			if (!result.ok) {
				addToast({
					type: "error",
					message: friendlyError(result.error, "Status update failed")
				});
				throw new Error("Status update failed");
			}
			resumes = resumes.map((r) => r.id === itemId ? {
				...r,
				status: newStatus
			} : r);
			addToast({
				type: "success",
				message: `Resume moved to ${newStatus.replace("_", " ")}`
			});
		}
		let showCreateForm = false;
		let createForm = {
			name: "",
			target_role: "",
			target_employer: "",
			archetype: ""
		};
		let creating = false;
		let selectedTemplateId = null;
		let availableTemplates = [];
		let templatesLoaded = false;
		let showSummaryPicker = false;
		let pendingResumeId = null;
		let showEditForm = false;
		let editForm = {
			name: "",
			target_role: "",
			target_employer: "",
			archetype: ""
		};
		let saving = false;
		let pickerModal = {
			open: false,
			sectionId: "",
			entryType: "",
			sourceId: null,
			sourceLabel: null
		};
		let availablePerspectives = [];
		let pickerLoading = false;
		let pickerArchetypeFilter = "";
		let pickerDomainFilter = "";
		let skillsPickerSectionId = null;
		let sourcePickerState = null;
		let freeformInput = "";
		let freeformSaving = false;
		let deleteConfirm = false;
		let deleting = false;
		let activeViewTab = "dnd";
		let ir = null;
		let irLoading = false;
		let irError = null;
		debugState("resumes", () => ({
			loading,
			detailLoading,
			selectedResumeId,
			hasDetail: !!resumeDetail,
			resumeCount: resumes.length
		}));
		let filteredPickerPerspectives = derived(() => {
			let result = availablePerspectives;
			if (pickerArchetypeFilter) result = result.filter((p) => p.target_archetype === pickerArchetypeFilter);
			if (pickerDomainFilter) result = result.filter((p) => p.domain?.toLowerCase().includes(pickerDomainFilter.toLowerCase()));
			if (resumeDetail) {
				const existingPerspectiveIds = new Set(resumeDetail.sections.flatMap((s) => s.entries).filter((e) => e.perspective_id).map((e) => e.perspective_id));
				result = result.filter((p) => !existingPerspectiveIds.has(p.id));
			}
			return result;
		});
		derived(() => {
			return [...new Set(availablePerspectives.map((p) => p.domain).filter(Boolean))].sort();
		});
		async function loadResumes() {
			loading = true;
			try {
				const result = await forge.resumes.list();
				if (result.ok) resumes = result.data;
				else addToast({
					message: friendlyError(result.error),
					type: "error"
				});
			} catch (e) {
				addToast({
					message: "Failed to load resumes",
					type: "error"
				});
			} finally {
				loading = false;
			}
		}
		async function loadTemplates() {
			if (templatesLoaded) return;
			const result = await forge.templates.list();
			if (result.ok) availableTemplates = result.data;
			templatesLoaded = true;
		}
		async function loadResumeDetail(id) {
			detailLoading = true;
			try {
				const result = await forge.resumes.get(id);
				if (result.ok) resumeDetail = result.data;
				else addToast({
					message: friendlyError(result.error),
					type: "error"
				});
			} catch (e) {
				addToast({
					message: "Failed to load resume details",
					type: "error"
				});
			} finally {
				detailLoading = false;
			}
		}
		async function loadGapAnalysis(id) {
			gapLoading = true;
			gapAnalysis = null;
			try {
				const result = await forge.resumes.gaps(id);
				if (result.ok) gapAnalysis = result.data;
			} catch {} finally {
				gapLoading = false;
			}
		}
		async function loadIR(id) {
			irLoading = true;
			irError = null;
			try {
				const result = await forge.resumes.ir(id);
				if (result.ok) ir = result.data;
				else irError = friendlyError(result.error, "Failed to load IR");
			} catch (e) {
				irError = "Failed to load resume IR";
			} finally {
				irLoading = false;
			}
		}
		async function handleIRUpdate() {
			if (selectedResumeId) await Promise.all([loadIR(selectedResumeId), loadResumeDetail(selectedResumeId)]);
		}
		let openDropdown = null;
		function selectResume(id) {
			selectedResumeId = id;
			showCreateForm = false;
			showEditForm = false;
			const url = new URL(window.location.href);
			url.searchParams.set("id", id);
			history.replaceState(history.state, "", url.toString());
			loadResumeDetail(id);
			loadGapAnalysis(id);
			loadIR(id);
		}
		function deselectResume() {
			selectedResumeId = null;
			resumeDetail = null;
			gapAnalysis = null;
			ir = null;
			irError = null;
			activeViewTab = "dnd";
			showEditForm = false;
		}
		async function handleSummaryPick(summaryId) {
			showSummaryPicker = false;
			if (pendingResumeId && summaryId) {
				const result = await forge.resumes.update(pendingResumeId, { summary_id: summaryId });
				if (!result.ok) addToast({
					message: friendlyError(result.error, "Failed to link summary"),
					type: "error"
				});
			}
			await loadResumes();
			if (pendingResumeId) selectResume(pendingResumeId);
			pendingResumeId = null;
			addToast({
				message: "Resume created",
				type: "success"
			});
		}
		function handleSummaryCancel() {
			showSummaryPicker = false;
			loadResumes();
			if (pendingResumeId) selectResume(pendingResumeId);
			pendingResumeId = null;
			addToast({
				message: "Resume created (no summary linked)",
				type: "success"
			});
		}
		async function handleDelete() {
			if (!selectedResumeId) return;
			deleting = true;
			try {
				const result = await forge.resumes.delete(selectedResumeId);
				if (result.ok) {
					addToast({
						message: "Resume deleted",
						type: "success"
					});
					deselectResume();
					await loadResumes();
				} else addToast({
					message: friendlyError(result.error),
					type: "error"
				});
			} catch (e) {
				addToast({
					message: "Failed to delete resume",
					type: "error"
				});
			} finally {
				deleting = false;
				deleteConfirm = false;
			}
		}
		async function openPicker(sectionId, entryType, sourceId, sourceLabel) {
			switch (entryType) {
				case "skills":
					skillsPickerSectionId = sectionId;
					return;
				case "education":
					sourcePickerState = {
						sectionId,
						sourceType: "education"
					};
					return;
				case "projects":
					sourcePickerState = {
						sectionId,
						sourceType: "project"
					};
					return;
				case "clearance":
					sourcePickerState = {
						sectionId,
						sourceType: "clearance"
					};
					return;
				case "freeform":
					pickerModal = {
						open: true,
						sectionId,
						entryType,
						sourceId: null,
						sourceLabel: null
					};
					freeformInput = "";
					return;
				default:
					pickerModal = {
						open: true,
						sectionId,
						entryType,
						sourceId: sourceId ?? null,
						sourceLabel: sourceLabel ?? null
					};
					pickerArchetypeFilter = "";
					pickerDomainFilter = "";
					pickerLoading = true;
					try {
						const filter = {
							status: "approved",
							limit: 500
						};
						if (sourceId) filter.source_id = sourceId;
						const result = await forge.perspectives.list(filter);
						if (result.ok) availablePerspectives = result.data;
						else addToast({
							message: friendlyError(result.error),
							type: "error"
						});
					} catch (e) {
						addToast({
							message: "Failed to load perspectives",
							type: "error"
						});
					} finally {
						pickerLoading = false;
					}
					return;
			}
		}
		async function handleAddSection(entryType, title) {
			if (!selectedResumeId) return;
			const position = (ir?.sections ?? []).length;
			const result = await forge.resumes.createSection(selectedResumeId, {
				title,
				entry_type: entryType,
				position
			});
			if (result.ok) {
				addToast({
					message: `Section "${title}" added`,
					type: "success"
				});
				await handleIRUpdate();
			} else addToast({
				message: friendlyError(result.error),
				type: "error"
			});
		}
		async function handleDeleteSection(sectionId) {
			if (!selectedResumeId) return;
			const result = await forge.resumes.deleteSection(selectedResumeId, sectionId);
			if (result.ok) {
				addToast({
					message: "Section deleted",
					type: "success"
				});
				await handleIRUpdate();
			} else addToast({
				message: friendlyError(result.error),
				type: "error"
			});
		}
		async function handleRenameSection(sectionId, newTitle) {
			if (!selectedResumeId) return;
			const result = await forge.resumes.updateSection(selectedResumeId, sectionId, { title: newTitle });
			if (result.ok) {
				addToast({
					message: "Section renamed",
					type: "success"
				});
				await handleIRUpdate();
			} else addToast({
				message: friendlyError(result.error),
				type: "error"
			});
		}
		async function handleMoveSection(sectionId, direction) {
			if (!selectedResumeId || !ir) return;
			const sections = [...ir.sections].sort((a, b) => a.display_order - b.display_order);
			const idx = sections.findIndex((s) => s.id === sectionId);
			if (idx < 0) return;
			const swapIdx = direction === "up" ? idx - 1 : idx + 1;
			if (swapIdx < 0 || swapIdx >= sections.length) return;
			const currentPos = sections[idx].display_order;
			const swapPos = sections[swapIdx].display_order;
			await Promise.all([forge.resumes.updateSection(selectedResumeId, sections[idx].id, { position: swapPos }), forge.resumes.updateSection(selectedResumeId, sections[swapIdx].id, { position: currentPos })]);
			await handleIRUpdate();
		}
		function truncate(text, max = 120) {
			if (text.length <= max) return text;
			return text.slice(0, max) + "...";
		}
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			if (viewMode === "board" && !selectedResumeId && !showCreateForm) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="resumes-board-header svelte-1e587sz"><h1 class="page-title svelte-1e587sz">Resumes</h1> <div class="board-header-actions svelte-1e587sz"><button class="btn btn-primary svelte-1e587sz">+ New Resume</button> `);
				ViewToggle($$renderer, {
					mode: viewMode,
					onchange: handleViewChange
				});
				$$renderer.push(`<!----></div></div> `);
				{
					function filterBar($$renderer) {
						ResumeFilterBar($$renderer, {
							onchange: () => {},
							get filters() {
								return resumeBoardFilters;
							},
							set filters($$value) {
								resumeBoardFilters = $$value;
								$$settled = false;
							}
						});
					}
					function cardContent($$renderer, resume) {
						ResumeKanbanCard($$renderer, {
							resume,
							onclick: () => selectResume(resume.id)
						});
					}
					GenericKanban($$renderer, {
						columns: RESUME_COLUMNS,
						items: boardFilteredResumes(),
						onDrop: handleResumeBoardDrop,
						loading,
						emptyMessage: "No resumes yet. Create your first resume to get started.",
						defaultCollapsed: "archived",
						sortItems: (a, b) => a.name.localeCompare(b.name),
						filterBar,
						cardContent,
						$$slots: {
							filterBar: true,
							cardContent: true
						}
					});
				}
				$$renderer.push(`<!---->`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<div class="resumes-page svelte-1e587sz"><div class="left-panel svelte-1e587sz">`);
				if (loading) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="loading-container svelte-1e587sz">`);
					LoadingSpinner($$renderer, {
						size: "lg",
						message: "Loading resumes..."
					});
					$$renderer.push(`<!----></div>`);
				} else if (!selectedResumeId && !showCreateForm) {
					$$renderer.push("<!--[1-->");
					$$renderer.push(`<div class="panel-header svelte-1e587sz"><h1 class="page-title svelte-1e587sz">Resumes</h1> <div class="board-header-actions svelte-1e587sz"><button class="btn btn-primary svelte-1e587sz">+ New Resume</button> `);
					ViewToggle($$renderer, {
						mode: viewMode,
						onchange: handleViewChange
					});
					$$renderer.push(`<!----></div></div> `);
					if (resumes.length === 0) {
						$$renderer.push("<!--[0-->");
						EmptyState($$renderer, {
							title: "No resumes yet",
							description: "Create your first resume to start building tailored applications.",
							action: "New Resume",
							onaction: () => {
								showCreateForm = true;
								loadTemplates();
							}
						});
					} else {
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<div class="resume-list svelte-1e587sz"><!--[-->`);
						const each_array = ensure_array_like(resumes);
						for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
							let resume = each_array[$$index];
							$$renderer.push(`<div class="resume-card svelte-1e587sz" role="button" tabindex="0"><div class="resume-card-header svelte-1e587sz"><span class="resume-name svelte-1e587sz">${escape_html(resume.name)}</span> <div class="resume-card-actions svelte-1e587sz">`);
							StatusBadge($$renderer, { status: resume.status });
							$$renderer.push(`<!----> <div class="dropdown svelte-1e587sz"><button class="btn btn-sm btn-download svelte-1e587sz">Download</button> `);
							if (openDropdown === resume.id) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<div class="dropdown-menu svelte-1e587sz"><button class="svelte-1e587sz">PDF</button> <button class="svelte-1e587sz">Markdown</button> <button class="svelte-1e587sz">LaTeX</button> <button class="svelte-1e587sz">JSON (IR)</button></div>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--></div></div></div> <div class="resume-card-meta svelte-1e587sz"><span class="meta-item">${escape_html(resume.target_role)}</span> `);
							if (resume.target_employer) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<span class="meta-sep svelte-1e587sz">at</span> <span class="meta-item">${escape_html(resume.target_employer)}</span>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--></div> <div class="resume-card-archetype svelte-1e587sz"><span class="archetype-tag svelte-1e587sz">${escape_html(resume.archetype)}</span></div></div>`);
						}
						$$renderer.push(`<!--]--></div>`);
					}
					$$renderer.push(`<!--]-->`);
				} else if (showCreateForm && !selectedResumeId) {
					$$renderer.push("<!--[2-->");
					$$renderer.push(`<div class="panel-header svelte-1e587sz"><h1 class="page-title svelte-1e587sz">New Resume</h1> <button class="btn btn-ghost svelte-1e587sz">Cancel</button></div> <form class="form-card svelte-1e587sz"><div class="form-field svelte-1e587sz"><label for="create-name" class="svelte-1e587sz">Name</label> <input id="create-name" type="text"${attr("value", createForm.name)} placeholder="e.g. Anthropic - Security Engineer" required="" class="svelte-1e587sz"/></div> <div class="form-field svelte-1e587sz"><label for="create-role" class="svelte-1e587sz">Target Role</label> <input id="create-role" type="text"${attr("value", createForm.target_role)} placeholder="e.g. Security Engineer" required="" class="svelte-1e587sz"/></div> <div class="form-field svelte-1e587sz"><label for="create-employer" class="svelte-1e587sz">Target Employer</label> <input id="create-employer" type="text"${attr("value", createForm.target_employer)} placeholder="e.g. Anthropic" required="" class="svelte-1e587sz"/></div> <div class="form-field svelte-1e587sz"><label for="create-archetype" class="svelte-1e587sz">Archetype</label> `);
					$$renderer.select({
						id: "create-archetype",
						value: createForm.archetype,
						required: true,
						class: ""
					}, ($$renderer) => {
						$$renderer.option({
							value: "",
							disabled: true
						}, ($$renderer) => {
							$$renderer.push(`Select archetype...`);
						});
						$$renderer.push(`<!--[-->`);
						const each_array_1 = ensure_array_like(archetypeNames);
						for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
							let arch = each_array_1[$$index_1];
							$$renderer.option({ value: arch }, ($$renderer) => {
								$$renderer.push(`${escape_html(arch)}`);
							});
						}
						$$renderer.push(`<!--]-->`);
					}, "svelte-1e587sz");
					$$renderer.push(`</div> <div class="form-field svelte-1e587sz"><label class="svelte-1e587sz">Template (optional)</label> <div class="template-picker svelte-1e587sz"><button type="button"${attr_class("template-option svelte-1e587sz", void 0, { "selected": selectedTemplateId === null })}><span class="template-option-name svelte-1e587sz">Blank Resume</span> <span class="template-option-desc svelte-1e587sz">Start with no sections</span></button> <!--[-->`);
					const each_array_2 = ensure_array_like(availableTemplates);
					for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
						let tmpl = each_array_2[$$index_2];
						$$renderer.push(`<button type="button"${attr_class("template-option svelte-1e587sz", void 0, { "selected": selectedTemplateId === tmpl.id })}><span class="template-option-name svelte-1e587sz">${escape_html(tmpl.name)} `);
						if (tmpl.is_builtin) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<span class="badge-sm svelte-1e587sz">Built-in</span>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></span> <span class="template-option-desc svelte-1e587sz">${escape_html(tmpl.sections.length)} section${escape_html(tmpl.sections.length === 1 ? "" : "s")} `);
						if (tmpl.description) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`— ${escape_html(tmpl.description)}`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></span></button>`);
					}
					$$renderer.push(`<!--]--></div></div> <div class="form-actions svelte-1e587sz"><button class="btn btn-primary svelte-1e587sz" type="submit"${attr("disabled", creating, true)}>${escape_html("Create Resume")}</button></div></form>`);
				} else if (selectedResumeId) {
					$$renderer.push("<!--[3-->");
					$$renderer.push(`<div class="panel-header svelte-1e587sz"><button class="btn btn-ghost btn-back svelte-1e587sz">← Back</button> <div class="header-actions svelte-1e587sz">`);
					if (!showEditForm) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<button class="btn btn-secondary svelte-1e587sz">Edit</button> <button class="btn btn-secondary svelte-1e587sz">Save as Template</button>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> <button class="btn btn-danger svelte-1e587sz">Delete</button></div></div> `);
					if (detailLoading) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<div class="loading-container svelte-1e587sz">`);
						LoadingSpinner($$renderer, { message: "Loading resume..." });
						$$renderer.push(`<!----></div>`);
					} else if (resumeDetail) {
						$$renderer.push("<!--[1-->");
						if (showEditForm) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<form class="form-card svelte-1e587sz"><div class="form-field svelte-1e587sz"><label for="edit-name" class="svelte-1e587sz">Name</label> <input id="edit-name" type="text"${attr("value", editForm.name)} required="" class="svelte-1e587sz"/></div> <div class="form-field svelte-1e587sz"><label for="edit-role" class="svelte-1e587sz">Target Role</label> <input id="edit-role" type="text"${attr("value", editForm.target_role)} required="" class="svelte-1e587sz"/></div> <div class="form-field svelte-1e587sz"><label for="edit-employer" class="svelte-1e587sz">Target Employer</label> <input id="edit-employer" type="text"${attr("value", editForm.target_employer)} required="" class="svelte-1e587sz"/></div> <div class="form-field svelte-1e587sz"><label for="edit-archetype" class="svelte-1e587sz">Archetype</label> `);
							$$renderer.select({
								id: "edit-archetype",
								value: editForm.archetype,
								required: true,
								class: ""
							}, ($$renderer) => {
								$$renderer.push(`<!--[-->`);
								const each_array_3 = ensure_array_like(archetypeNames);
								for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
									let arch = each_array_3[$$index_3];
									$$renderer.option({ value: arch }, ($$renderer) => {
										$$renderer.push(`${escape_html(arch)}`);
									});
								}
								$$renderer.push(`<!--]-->`);
							}, "svelte-1e587sz");
							$$renderer.push(`</div> <div class="form-actions svelte-1e587sz"><button class="btn btn-ghost svelte-1e587sz" type="button">Cancel</button> <button class="btn btn-primary svelte-1e587sz" type="submit"${attr("disabled", saving, true)}>${escape_html("Save Changes")}</button></div></form>`);
						} else {
							$$renderer.push("<!--[-1-->");
							$$renderer.push(`<div class="resume-header-card svelte-1e587sz"><div class="resume-header-top svelte-1e587sz"><h2 class="resume-title svelte-1e587sz">${escape_html(resumeDetail.name)}</h2> `);
							StatusBadge($$renderer, { status: resumeDetail.status });
							$$renderer.push(`<!----></div> <div class="resume-header-details svelte-1e587sz"><span class="detail-item svelte-1e587sz"><strong class="svelte-1e587sz">Role:</strong> ${escape_html(resumeDetail.target_role)}</span> <span class="detail-item svelte-1e587sz"><strong class="svelte-1e587sz">Employer:</strong> ${escape_html(resumeDetail.target_employer)}</span> <span class="detail-item svelte-1e587sz"><strong class="svelte-1e587sz">Archetype:</strong> <span class="archetype-tag svelte-1e587sz">${escape_html(resumeDetail.archetype)}</span></span></div></div>`);
						}
						$$renderer.push(`<!--]--> <div class="view-tabs-container svelte-1e587sz"><div class="view-tabs svelte-1e587sz"><!--[-->`);
						const each_array_4 = ensure_array_like(VIEW_TABS);
						for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
							let tab = each_array_4[$$index_4];
							$$renderer.push(`<button${attr_class("view-tab svelte-1e587sz", void 0, { "active": activeViewTab === tab.value })}>${escape_html(tab.label)}</button>`);
						}
						$$renderer.push(`<!--]--></div> <div class="view-content svelte-1e587sz">`);
						if (irLoading) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<div class="loading-container svelte-1e587sz">`);
							LoadingSpinner($$renderer, { message: "Compiling resume..." });
							$$renderer.push(`<!----></div>`);
						} else if (irError) {
							$$renderer.push("<!--[1-->");
							$$renderer.push(`<div class="view-error svelte-1e587sz"><p>${escape_html(irError)}</p> <button class="btn btn-secondary svelte-1e587sz">Retry</button></div>`);
						} else if (ir) {
							$$renderer.push("<!--[2-->");
							if (activeViewTab === "dnd") {
								$$renderer.push("<!--[0-->");
								DragNDropView($$renderer, {
									ir,
									resumeId: selectedResumeId,
									onUpdate: handleIRUpdate,
									onAddEntry: (sectionId, entryType, sourceId, sourceLabel) => openPicker(sectionId, entryType, sourceId, sourceLabel),
									onAddSection: handleAddSection,
									onDeleteSection: handleDeleteSection,
									onRenameSection: handleRenameSection,
									onMoveSection: handleMoveSection
								});
							} else if (activeViewTab === "markdown") {
								$$renderer.push("<!--[1-->");
								MarkdownView($$renderer, {
									ir,
									override: resumeDetail.markdown_override ?? null,
									overrideUpdatedAt: resumeDetail.markdown_override_updated_at ?? null,
									resumeUpdatedAt: resumeDetail.updated_at,
									resumeId: selectedResumeId,
									onOverrideChange: async () => {
										await loadResumeDetail(selectedResumeId);
									}
								});
							} else if (activeViewTab === "latex") {
								$$renderer.push("<!--[2-->");
								LatexView($$renderer, {
									ir,
									override: resumeDetail.latex_override ?? null,
									overrideUpdatedAt: resumeDetail.latex_override_updated_at ?? null,
									resumeUpdatedAt: resumeDetail.updated_at,
									resumeId: selectedResumeId,
									onOverrideChange: async () => {
										await loadResumeDetail(selectedResumeId);
									}
								});
							} else if (activeViewTab === "pdf") {
								$$renderer.push("<!--[3-->");
								PdfView($$renderer, {
									resumeId: selectedResumeId,
									ir
								});
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]-->`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--></div></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div> <div class="right-panel svelte-1e587sz">`);
				if (!selectedResumeId) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="gap-placeholder svelte-1e587sz"><p class="gap-placeholder-text svelte-1e587sz">Select a resume to view gap analysis</p></div>`);
				} else if (gapLoading) {
					$$renderer.push("<!--[1-->");
					$$renderer.push(`<div class="loading-container svelte-1e587sz">`);
					LoadingSpinner($$renderer, { message: "Analyzing gaps..." });
					$$renderer.push(`<!----></div>`);
				} else if (gapAnalysis) {
					$$renderer.push("<!--[2-->");
					$$renderer.push(`<div class="gap-panel svelte-1e587sz"><h3 class="gap-title svelte-1e587sz">Gap Analysis</h3> `);
					if (gapAnalysis.coverage_summary) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<div class="coverage-summary svelte-1e587sz"><div class="coverage-stat svelte-1e587sz"><span class="coverage-number svelte-1e587sz">${escape_html(gapAnalysis.coverage_summary.perspectives_included)}</span> <span class="coverage-label svelte-1e587sz">Entries</span></div> <div class="coverage-stat svelte-1e587sz"><span class="coverage-number svelte-1e587sz">${escape_html(gapAnalysis.coverage_summary.domains_represented.length)}</span> <span class="coverage-label svelte-1e587sz">Domains</span></div></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> `);
					if (gapAnalysis.gaps.length === 0) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<div class="gap-all-good svelte-1e587sz"><p>No gaps identified. Coverage looks good.</p></div>`);
					} else {
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`<div class="gap-list svelte-1e587sz"><!--[-->`);
						const each_array_5 = ensure_array_like(gapAnalysis.gaps);
						for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
							let gap = each_array_5[$$index_5];
							$$renderer.push(`<div class="gap-item svelte-1e587sz"><div class="gap-item-header svelte-1e587sz"><span class="gap-type-badge svelte-1e587sz">${escape_html(gap.type.replace(/_/g, " "))}</span></div> <p class="gap-description svelte-1e587sz">${escape_html(gap.description)}</p> `);
							if (gap.recommendation) {
								$$renderer.push("<!--[0-->");
								$$renderer.push(`<p class="gap-recommendation svelte-1e587sz">${escape_html(gap.recommendation)}</p>`);
							} else $$renderer.push("<!--[-1-->");
							$$renderer.push(`<!--]--></div>`);
						}
						$$renderer.push(`<!--]--></div>`);
					}
					$$renderer.push(`<!--]--></div>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<div class="gap-placeholder svelte-1e587sz"><p class="gap-placeholder-text svelte-1e587sz">Gap analysis unavailable</p></div>`);
				}
				$$renderer.push(`<!--]--></div></div>`);
			}
			$$renderer.push(`<!--]--> `);
			if (skillsPickerSectionId && selectedResumeId) {
				$$renderer.push("<!--[0-->");
				SkillsPicker($$renderer, {
					resumeId: selectedResumeId,
					sectionId: skillsPickerSectionId,
					onClose: () => skillsPickerSectionId = null,
					onUpdate: handleIRUpdate
				});
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (sourcePickerState && selectedResumeId) {
				$$renderer.push("<!--[0-->");
				SourcePicker($$renderer, {
					resumeId: selectedResumeId,
					sectionId: sourcePickerState.sectionId,
					sourceType: sourcePickerState.sourceType,
					onClose: () => sourcePickerState = null,
					onUpdate: handleIRUpdate
				});
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (pickerModal.open && pickerModal.entryType === "freeform") {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="modal-overlay svelte-1e587sz" role="presentation"><div class="modal svelte-1e587sz" role="dialog" aria-modal="true" aria-label="Add Freeform Entry"><div class="modal-header svelte-1e587sz"><h3 class="svelte-1e587sz">Add Freeform Content</h3> <button class="btn btn-ghost svelte-1e587sz">Close</button></div> <div class="freeform-body svelte-1e587sz"><textarea class="freeform-textarea svelte-1e587sz" placeholder="Enter text content..."${attr("rows", 5)}>`);
				const $$body = escape_html(freeformInput);
				if ($$body) $$renderer.push(`${$$body}`);
				$$renderer.push(`</textarea> <div class="freeform-actions svelte-1e587sz"><button class="btn btn-ghost svelte-1e587sz">Cancel</button> <button class="btn btn-primary svelte-1e587sz"${attr("disabled", !freeformInput.trim() || freeformSaving, true)}>${escape_html("Add Entry")}</button></div></div></div></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (pickerModal.open && pickerModal.entryType !== "freeform") {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="modal-overlay svelte-1e587sz" role="presentation"><div class="modal svelte-1e587sz" role="dialog" aria-modal="true" aria-label="Add Entry"><div class="modal-header svelte-1e587sz"><h3 class="svelte-1e587sz">`);
				if (pickerModal.sourceLabel) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`Add bullet — ${escape_html(pickerModal.sourceLabel)}`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`Add Entry to ${escape_html(SECTION_LABELS[pickerModal.entryType] ?? pickerModal.entryType)}`);
				}
				$$renderer.push(`<!--]--></h3> <button class="btn btn-ghost svelte-1e587sz">Close</button></div> <div class="picker-filters svelte-1e587sz">`);
				$$renderer.select({
					value: pickerArchetypeFilter,
					"aria-label": "Filter by archetype",
					class: ""
				}, ($$renderer) => {
					$$renderer.option({ value: "" }, ($$renderer) => {
						$$renderer.push(`All archetypes`);
					});
					$$renderer.push(`<!--[-->`);
					const each_array_6 = ensure_array_like(archetypeNames);
					for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
						let arch = each_array_6[$$index_6];
						$$renderer.option({ value: arch }, ($$renderer) => {
							$$renderer.push(`${escape_html(arch)}`);
						});
					}
					$$renderer.push(`<!--]-->`);
				}, "svelte-1e587sz");
				$$renderer.push(` <input type="text" placeholder="Filter by domain..."${attr("value", pickerDomainFilter)} aria-label="Filter by domain" class="svelte-1e587sz"/></div> <div class="picker-list svelte-1e587sz">`);
				if (pickerLoading) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="loading-container svelte-1e587sz">`);
					LoadingSpinner($$renderer, { message: "Loading perspectives..." });
					$$renderer.push(`<!----></div>`);
				} else if (filteredPickerPerspectives().length === 0) {
					$$renderer.push("<!--[1-->");
					$$renderer.push(`<p class="picker-empty svelte-1e587sz">No matching perspectives available.</p>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--[-->`);
					const each_array_7 = ensure_array_like(filteredPickerPerspectives());
					for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
						let perspective = each_array_7[$$index_7];
						$$renderer.push(`<button class="picker-item svelte-1e587sz"><div class="picker-item-content svelte-1e587sz">${escape_html(truncate(perspective.content, 200))}</div> <div class="picker-item-meta svelte-1e587sz">`);
						if (perspective.target_archetype) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<span class="archetype-tag svelte-1e587sz">${escape_html(perspective.target_archetype)}</span>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> `);
						if (perspective.domain) {
							$$renderer.push("<!--[0-->");
							$$renderer.push(`<span class="domain-tag svelte-1e587sz">${escape_html(perspective.domain)}</span>`);
						} else $$renderer.push("<!--[-1-->");
						$$renderer.push(`<!--]--> <span class="framing-tag svelte-1e587sz">${escape_html(perspective.framing)}</span></div></button>`);
					}
					$$renderer.push(`<!--]-->`);
				}
				$$renderer.push(`<!--]--></div></div></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			ConfirmDialog($$renderer, {
				open: deleteConfirm,
				title: "Delete Resume",
				message: "Are you sure you want to delete this resume? This cannot be undone.",
				confirmLabel: deleting ? "Deleting..." : "Delete",
				onconfirm: handleDelete,
				oncancel: () => {
					deleteConfirm = false;
				}
			});
			$$renderer.push(`<!----> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			SummaryPicker($$renderer, {
				open: showSummaryPicker,
				onpick: handleSummaryPick,
				oncancel: handleSummaryCancel
			});
			$$renderer.push(`<!---->`);
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
export { _page as default };
