import { C as escape_html, S as attr, a as ensure_array_like, i as derived, r as bind_props, t as attr_class } from "./server.js";
import { r as LoadingSpinner, t as ConfirmDialog } from "./components.js";
import { t as addToast } from "./toast.svelte.js";
import { t as forge } from "./sdk.js";
//#region ../sdk/src/types.ts
/** All valid clearance levels (ordered: lowest to highest). */
var CLEARANCE_LEVELS = [
	"public",
	"l",
	"confidential",
	"secret",
	"top_secret",
	"q"
];
/** All valid polygraph types. */
var CLEARANCE_POLYGRAPHS = [
	"none",
	"ci",
	"full_scope"
];
/** All valid clearance statuses. */
var CLEARANCE_STATUSES = ["active", "inactive"];
/** All valid clearance types. */
var CLEARANCE_TYPES = ["personnel", "facility"];
/** All valid access programs. */
var CLEARANCE_ACCESS_PROGRAMS = [
	"sci",
	"sap",
	"nato"
];
/** Human-readable labels for clearance levels. */
var CLEARANCE_LEVEL_LABELS = {
	public: "Public Trust",
	confidential: "Confidential",
	secret: "Secret",
	top_secret: "Top Secret (TS)",
	q: "DOE Q",
	l: "DOE L"
};
/** Human-readable labels for polygraph types. */
var CLEARANCE_POLYGRAPH_LABELS = {
	none: "None",
	ci: "CI Polygraph",
	full_scope: "Full Scope (Lifestyle)"
};
/** Human-readable labels for access programs. */
var CLEARANCE_ACCESS_PROGRAM_LABELS = {
	sci: "SCI",
	sap: "SAP",
	nato: "NATO"
};
//#endregion
//#region src/lib/components/OrgCombobox.svelte
function OrgCombobox($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { id = "", organizations = [], aliases = /* @__PURE__ */ new Map(), value = null, placeholder = "-- Select --", disabled = false, oncreate } = $$props;
		let query = "";
		let open = false;
		let listId = `org-combo-${crypto.randomUUID().slice(0, 8)}`;
		let selectedOrg = derived(() => organizations.find((o) => o.id === value) ?? null);
		let displayValue = derived(() => selectedOrg()?.name ?? "");
		derived(() => {
			if (!query.trim()) return organizations;
			const q = query.toLowerCase();
			return organizations.filter((o) => {
				const aliasMatch = aliases?.get(o.id)?.some((a) => a.toLowerCase().includes(q));
				return o.name.toLowerCase().includes(q) || aliasMatch;
			});
		});
		$$renderer.push(`<div${attr_class("combobox svelte-1sszfnh", void 0, { "disabled": disabled })}><div class="combobox-input-wrap svelte-1sszfnh"><input${attr("id", id)} type="text" class="combobox-input svelte-1sszfnh"${attr("value", displayValue())}${attr("placeholder", placeholder)}${attr("disabled", disabled, true)} role="combobox"${attr("aria-expanded", open)} aria-autocomplete="list"${attr("aria-controls", listId)} autocomplete="off"/> `);
		if (value && !disabled) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<button class="combobox-clear svelte-1sszfnh" type="button" title="Clear selection">×</button>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
		bind_props($$props, { value });
	});
}
//#endregion
//#region src/lib/components/SourcesView.svelte
function SourcesView($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		/** Optional: lock this view to a single source type (hides the type filter tabs). */
		let { sourceTypeFilter = void 0 } = $$props;
		const SOURCE_TABS = [
			{
				value: "all",
				label: "All"
			},
			{
				value: "role",
				label: "Roles"
			},
			{
				value: "project",
				label: "Projects"
			},
			{
				value: "education",
				label: "Education"
			},
			{
				value: "clearance",
				label: "Clearances"
			},
			{
				value: "general",
				label: "General"
			}
		];
		let sources = [];
		let organizations = [];
		let activeTab = sourceTypeFilter ?? "all";
		let selectedId = null;
		let editing = false;
		let saving = false;
		let deriving = false;
		let confirmDeleteOpen = false;
		let formTitle = "";
		let formDescription = "";
		let formSourceType = "general";
		let formNotes = "";
		let formOrgId = null;
		let formStartDate = "";
		let formEndDate = "";
		let formIsCurrent = false;
		let formWorkArrangement = "";
		let formEducationType = "certificate";
		let formEduOrgId = null;
		let formField = "";
		let formIsInProgress = false;
		let formCredentialId = "";
		let formExpirationDate = "";
		let formUrl = "";
		let formCampusId = null;
		let campuses = [];
		let sourceSkills = [];
		let allSkills = [];
		let skillSearchQuery = "";
		let showOrgModal = false;
		let newOrgName = "";
		let newOrgType = "education";
		let newOrgWebsite = "";
		let creatingOrg = false;
		let formDegreeLevel = "bachelors";
		let formDegreeType = "";
		let formCertificateSubtype = "vendor";
		let formGpa = "";
		let formEduDescription = "";
		let formIsPersonal = false;
		let formProjectUrl = "";
		let formLevel = "secret";
		let formPolygraph = "";
		let formClearanceStatus = "active";
		let formClearanceType = "personnel";
		let formContinuousInvestigation = false;
		let formAccessPrograms = [];
		const GROUP_OPTIONS = [
			{
				value: "flat",
				label: "Flat"
			},
			{
				value: "by_type",
				label: "By Type"
			},
			{
				value: "by_cert",
				label: "By Cert Type"
			},
			{
				value: "by_issuer",
				label: "By Issuer"
			}
		];
		let eduGroupBy = "by_type";
		const EDU_TYPE_LABELS = {
			degree: "Degrees",
			certificate: "Certificates",
			course: "Courses",
			self_taught: "Self-Taught"
		};
		const CERT_SUBTYPE_LABELS = {
			professional: "Professional",
			vendor: "Vendor",
			completion: "Completion",
			unknown: "Other"
		};
		derived(() => activeTab === "all" ? sources : sources.filter((s) => s.source_type === activeTab));
		derived(() => {
			if (activeTab !== "education" || eduGroupBy === "flat") return null;
			const eduSources = sources.filter((s) => s.source_type === "education");
			const groups = /* @__PURE__ */ new Map();
			for (const s of eduSources) {
				let key;
				let label;
				if (eduGroupBy === "by_type") {
					key = s.education?.education_type ?? "unknown";
					label = EDU_TYPE_LABELS[key] ?? key;
				} else if (eduGroupBy === "by_cert") if (s.education?.education_type !== "certificate") {
					key = "_non_cert";
					label = "Non-Certificates";
				} else {
					key = s.education?.certificate_subtype ?? "unknown";
					label = CERT_SUBTYPE_LABELS[key] ?? key;
				}
				else {
					const orgId = s.education?.organization_id;
					if (orgId) {
						key = orgId;
						label = getOrgName(orgId);
					} else {
						key = "_unknown";
						label = "No Organization";
					}
				}
				if (!groups.has(key)) groups.set(key, {
					label,
					sources: []
				});
				groups.get(key).sources.push(s);
			}
			const entries = [...groups.entries()];
			if (eduGroupBy === "by_type") {
				const order = [
					"degree",
					"certificate",
					"course",
					"self_taught"
				];
				entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
			} else entries.sort((a, b) => a[1].label.localeCompare(b[1].label));
			return entries.map(([key, group]) => ({
				key,
				...group
			}));
		});
		let selectedSource = derived(() => sources.find((s) => s.id === selectedId) ?? null);
		function handleEducationTypeChange(newType) {
			formEducationType = newType;
			if (newType !== "degree") {
				formDegreeLevel = "";
				formDegreeType = "";
				formGpa = "";
			}
			if (newType !== "certificate") formCertificateSubtype = "vendor";
			if (newType !== "degree" && newType !== "course");
			formEduOrgId = null;
		}
		function getOrgName(id) {
			return organizations.find((o) => o.id === id)?.name ?? "Unknown";
		}
		async function deleteSource() {
			if (!selectedId) return;
			confirmDeleteOpen = false;
			const id = selectedId;
			const result = await forge.sources.delete(id);
			if (result.ok) {
				sources = sources.filter((s) => s.id !== id);
				selectedId = null;
				editing = false;
				addToast({
					message: "Source deleted.",
					type: "success"
				});
			} else addToast({
				message: `Failed to delete source: ${result.error.message}`,
				type: "error"
			});
		}
		/** Filter orgs to only those the user has worked at (for role/project dropdowns). */
		let roleFilteredOrgs = derived(() => organizations.filter((o) => sources.some((s) => s.source_type === "role" && s.role?.organization_id === o.id || s.source_type === "project" && s.project?.organization_id === o.id)));
		/** Filter orgs by relevant tags for the current education type + cert subtype. */
		let eduFilteredOrgs = derived(() => {
			if (formEducationType === "degree") return organizations.filter((o) => o.tags?.some((t) => t === "university" || t === "school"));
			if (formEducationType === "certificate") {
				if (formCertificateSubtype === "vendor") return organizations.filter((o) => o.tags?.some((t) => t === "vendor"));
				if (formCertificateSubtype === "professional") return organizations.filter((o) => o.tags?.some((t) => t === "nonprofit" || t === "government" || t === "company"));
				if (formCertificateSubtype === "completion") return organizations.filter((o) => o.tags?.some((t) => t === "platform" || t === "company" || t === "university"));
				return organizations;
			}
			if (formEducationType === "course") return organizations.filter((o) => o.tags?.some((t) => t === "university" || t === "platform" || t === "conference" || t === "company"));
			return organizations;
		});
		let newOrgTags = [];
		function openOrgModal() {
			newOrgName = "";
			newOrgWebsite = "";
			if (formEducationType === "degree") {
				newOrgType = "education";
				newOrgTags = ["university"];
			} else if (formEducationType === "course") {
				newOrgType = "education";
				newOrgTags = ["platform"];
			} else if (formEducationType === "certificate") {
				newOrgType = "company";
				if (formCertificateSubtype === "vendor") newOrgTags = ["company", "vendor"];
				else if (formCertificateSubtype === "professional") newOrgTags = ["company"];
				else newOrgTags = ["company", "platform"];
			} else {
				newOrgType = "company";
				newOrgTags = ["company"];
			}
			showOrgModal = true;
		}
		derived(() => {
			const q = skillSearchQuery.toLowerCase().trim();
			const linkedIds = new Set(sourceSkills.map((s) => s.id));
			let options = allSkills.filter((s) => !linkedIds.has(s.id));
			if (q) options = options.filter((s) => s.name.toLowerCase().includes(q));
			return options.slice(0, 20);
		});
		derived(() => skillSearchQuery.trim().length > 0 && !allSkills.some((s) => s.name.toLowerCase() === skillSearchQuery.trim().toLowerCase()));
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<div class="sources-page svelte-1wpip6v"><div class="list-panel svelte-1wpip6v"><div class="list-header svelte-1wpip6v"><h2 class="svelte-1wpip6v">Sources</h2> <button class="btn-new svelte-1wpip6v">+ New Source</button></div> `);
			if (!sourceTypeFilter) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="filter-tabs svelte-1wpip6v"><!--[-->`);
				const each_array = ensure_array_like(SOURCE_TABS);
				for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
					let tab = each_array[$$index];
					$$renderer.push(`<button${attr_class("filter-tab svelte-1wpip6v", void 0, { "active": activeTab === tab.value })}>${escape_html(tab.label)} <span class="tab-count svelte-1wpip6v">${escape_html(tab.value === "all" ? sources.length : sources.filter((s) => s.source_type === tab.value).length)}</span></button>`);
				}
				$$renderer.push(`<!--]--></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (activeTab === "education") {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="group-bar svelte-1wpip6v"><label for="edu-group" class="svelte-1wpip6v">Group:</label> `);
				$$renderer.select({
					id: "edu-group",
					value: eduGroupBy,
					class: ""
				}, ($$renderer) => {
					$$renderer.push(`<!--[-->`);
					const each_array_1 = ensure_array_like(GROUP_OPTIONS);
					for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
						let opt = each_array_1[$$index_1];
						$$renderer.option({ value: opt.value }, ($$renderer) => {
							$$renderer.push(`${escape_html(opt.label)}`);
						});
					}
					$$renderer.push(`<!--]-->`);
				}, "svelte-1wpip6v");
				$$renderer.push(`</div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="list-loading svelte-1wpip6v">`);
			LoadingSpinner($$renderer, {
				size: "md",
				message: "Loading sources..."
			});
			$$renderer.push(`<!----></div>`);
			$$renderer.push(`<!--]--></div> <div class="editor-panel svelte-1wpip6v">`);
			if (!selectedSource() && !editing) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="editor-empty svelte-1wpip6v"><p>Select a source or create a new one.</p></div>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<div class="editor-content svelte-1wpip6v"><h3 class="editor-heading svelte-1wpip6v">${escape_html(editing ? "New Source" : "Edit Source")}</h3> <div class="form-group svelte-1wpip6v"><label for="source-type" class="svelte-1wpip6v">Type</label> `);
				$$renderer.select({
					id: "source-type",
					value: formSourceType,
					disabled: !editing,
					class: ""
				}, ($$renderer) => {
					$$renderer.option({ value: "general" }, ($$renderer) => {
						$$renderer.push(`General`);
					});
					$$renderer.option({ value: "role" }, ($$renderer) => {
						$$renderer.push(`Role`);
					});
					$$renderer.option({ value: "project" }, ($$renderer) => {
						$$renderer.push(`Project`);
					});
					$$renderer.option({ value: "education" }, ($$renderer) => {
						$$renderer.push(`Education`);
					});
					$$renderer.option({ value: "clearance" }, ($$renderer) => {
						$$renderer.push(`Clearance`);
					});
				}, "svelte-1wpip6v");
				$$renderer.push(`</div> <div class="form-group svelte-1wpip6v"><label for="source-title" class="svelte-1wpip6v">Title <span class="required svelte-1wpip6v">*</span></label> <input id="source-title" type="text"${attr("value", formTitle)} placeholder="e.g. Cloud Migration Project" class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="source-description" class="svelte-1wpip6v">Description <span class="required svelte-1wpip6v">*</span></label> <textarea id="source-description" rows="6" placeholder="Describe what you did, the context, technologies used..." class="svelte-1wpip6v">`);
				const $$body = escape_html(formDescription);
				if ($$body) $$renderer.push(`${$$body}`);
				$$renderer.push(`</textarea></div> `);
				if (formSourceType === "role") {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="form-group svelte-1wpip6v"><label for="role-org" class="svelte-1wpip6v">Organization</label> `);
					$$renderer.select({
						id: "role-org",
						value: formOrgId,
						class: ""
					}, ($$renderer) => {
						$$renderer.option({ value: null }, ($$renderer) => {
							$$renderer.push(`None`);
						});
						$$renderer.push(`<!--[-->`);
						const each_array_5 = ensure_array_like(roleFilteredOrgs());
						for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
							let org = each_array_5[$$index_5];
							$$renderer.option({ value: org.id }, ($$renderer) => {
								$$renderer.push(`${escape_html(org.name)}`);
							});
						}
						$$renderer.push(`<!--]-->`);
					}, "svelte-1wpip6v");
					$$renderer.push(`</div> <div class="form-row svelte-1wpip6v"><div class="form-group svelte-1wpip6v"><label for="role-start" class="svelte-1wpip6v">Start Date</label> <input id="role-start" type="date"${attr("value", formStartDate)} class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="role-end" class="svelte-1wpip6v">End Date</label> <input id="role-end" type="date"${attr("value", formEndDate)} class="svelte-1wpip6v"/></div></div> <div class="form-group svelte-1wpip6v"><label class="svelte-1wpip6v"><input type="checkbox"${attr("checked", formIsCurrent, true)} class="svelte-1wpip6v"/> Currently employed</label></div> <div class="form-group svelte-1wpip6v"><label for="role-arrangement" class="svelte-1wpip6v">Work Arrangement</label> <input id="role-arrangement" type="text"${attr("value", formWorkArrangement)} placeholder="e.g. remote, hybrid, on-site" class="svelte-1wpip6v"/></div>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (formSourceType === "education") {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="form-group svelte-1wpip6v"><label for="edu-type" class="svelte-1wpip6v">Education Type</label> `);
					$$renderer.select({
						id: "edu-type",
						value: formEducationType,
						onchange: (e) => handleEducationTypeChange(e.target.value),
						class: ""
					}, ($$renderer) => {
						$$renderer.option({ value: "degree" }, ($$renderer) => {
							$$renderer.push(`Degree`);
						});
						$$renderer.option({ value: "certificate" }, ($$renderer) => {
							$$renderer.push(`Certificate`);
						});
						$$renderer.option({ value: "course" }, ($$renderer) => {
							$$renderer.push(`Course`);
						});
						$$renderer.option({ value: "self_taught" }, ($$renderer) => {
							$$renderer.push(`Self-Taught`);
						});
					}, "svelte-1wpip6v");
					$$renderer.push(`</div> `);
					if (formEducationType === "degree") {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<div class="form-row svelte-1wpip6v"><div class="form-group svelte-1wpip6v"><label for="edu-degree-level" class="svelte-1wpip6v">Degree Level <span class="required svelte-1wpip6v">*</span></label> `);
						$$renderer.select({
							id: "edu-degree-level",
							value: formDegreeLevel,
							class: ""
						}, ($$renderer) => {
							$$renderer.option({
								value: "",
								disabled: true
							}, ($$renderer) => {
								$$renderer.push(`-- Select Degree Level --`);
							});
							$$renderer.option({ value: "associate" }, ($$renderer) => {
								$$renderer.push(`Associate`);
							});
							$$renderer.option({ value: "bachelors" }, ($$renderer) => {
								$$renderer.push(`Bachelor's`);
							});
							$$renderer.option({ value: "masters" }, ($$renderer) => {
								$$renderer.push(`Master's`);
							});
							$$renderer.option({ value: "doctoral" }, ($$renderer) => {
								$$renderer.push(`Doctoral`);
							});
							$$renderer.option({ value: "graduate_certificate" }, ($$renderer) => {
								$$renderer.push(`Graduate Certificate`);
							});
						}, "svelte-1wpip6v");
						$$renderer.push(`</div> <div class="form-group svelte-1wpip6v"><label for="edu-degree-type" class="svelte-1wpip6v">Degree Type <span class="required svelte-1wpip6v">*</span></label> <input id="edu-degree-type" type="text"${attr("value", formDegreeType)} placeholder="e.g. BS, MS, PhD, MBA" class="svelte-1wpip6v"/></div></div> <div class="form-row svelte-1wpip6v"><div class="form-group svelte-1wpip6v"><label for="edu-org" class="svelte-1wpip6v">Institution</label> <div class="org-select-row svelte-1wpip6v">`);
						OrgCombobox($$renderer, {
							id: "edu-org",
							organizations: eduFilteredOrgs(),
							placeholder: "Search institutions...",
							oncreate: openOrgModal,
							get value() {
								return formEduOrgId;
							},
							set value($$value) {
								formEduOrgId = $$value;
								$$settled = false;
							}
						});
						$$renderer.push(`<!----></div></div> <div class="form-group svelte-1wpip6v"><label for="edu-campus" class="svelte-1wpip6v">Campus</label> <div class="org-select-row svelte-1wpip6v">`);
						$$renderer.select({
							id: "edu-campus",
							value: formCampusId,
							disabled: !formEduOrgId,
							class: ""
						}, ($$renderer) => {
							$$renderer.option({ value: null }, ($$renderer) => {
								$$renderer.push(`${escape_html(formEduOrgId ? "-- Select --" : "Select org first")}`);
							});
							$$renderer.push(`<!--[-->`);
							const each_array_6 = ensure_array_like(campuses);
							for (let $$index_6 = 0, $$length = each_array_6.length; $$index_6 < $$length; $$index_6++) {
								let campus = each_array_6[$$index_6];
								$$renderer.option({ value: campus.id }, ($$renderer) => {
									$$renderer.push(`${escape_html(campus.name)}${escape_html(campus.city ? ` (${campus.city}${campus.state ? `, ${campus.state}` : ""})` : "")}`);
								});
							}
							$$renderer.push(`<!--]-->`);
						}, "svelte-1wpip6v");
						$$renderer.push(` <button class="btn-new-sm svelte-1wpip6v" type="button"${attr("disabled", !formEduOrgId, true)}>+</button></div></div></div> <div class="form-row svelte-1wpip6v"><div class="form-group svelte-1wpip6v"><label for="edu-field" class="svelte-1wpip6v">Field (Major)</label> <input id="edu-field" type="text"${attr("value", formField)} class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="edu-gpa" class="svelte-1wpip6v">GPA</label> <input id="edu-gpa" type="text"${attr("value", formGpa)} placeholder="e.g. 3.8/4.0" class="svelte-1wpip6v"/></div></div> <div class="form-row svelte-1wpip6v"><div class="form-group svelte-1wpip6v"><label for="edu-start" class="svelte-1wpip6v">Start Date</label> <input id="edu-start" type="date"${attr("value", formStartDate)} class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="edu-end" class="svelte-1wpip6v">End Date</label> <input id="edu-end" type="date"${attr("value", formEndDate)} class="svelte-1wpip6v"/></div></div> <div class="form-group svelte-1wpip6v"><label class="svelte-1wpip6v"><input type="checkbox"${attr("checked", formIsInProgress, true)} class="svelte-1wpip6v"/> In progress</label></div> <div class="form-group svelte-1wpip6v"><label for="edu-description" class="svelte-1wpip6v">Description</label> <textarea id="edu-description" rows="3" placeholder="Additional notes about this degree..." class="svelte-1wpip6v">`);
						const $$body_1 = escape_html(formEduDescription);
						if ($$body_1) $$renderer.push(`${$$body_1}`);
						$$renderer.push(`</textarea></div>`);
					} else if (formEducationType === "certificate") {
						$$renderer.push("<!--[1-->");
						$$renderer.push(`<div class="form-group svelte-1wpip6v"><label for="edu-cert-subtype" class="svelte-1wpip6v">Certificate Type <span class="required svelte-1wpip6v">*</span></label> `);
						$$renderer.select({
							id: "edu-cert-subtype",
							value: formCertificateSubtype,
							class: ""
						}, ($$renderer) => {
							$$renderer.option({ value: "professional" }, ($$renderer) => {
								$$renderer.push(`Professional (CISSP, PE, PMP)`);
							});
							$$renderer.option({ value: "vendor" }, ($$renderer) => {
								$$renderer.push(`Vendor (AWS, Azure, CompTIA)`);
							});
							$$renderer.option({ value: "completion" }, ($$renderer) => {
								$$renderer.push(`Completion (Udemy, bootcamp)`);
							});
						}, "svelte-1wpip6v");
						$$renderer.push(`</div> <div class="form-group svelte-1wpip6v"><label for="edu-org" class="svelte-1wpip6v">Issuing Body</label> <div class="org-select-row svelte-1wpip6v">`);
						OrgCombobox($$renderer, {
							id: "edu-org",
							organizations: eduFilteredOrgs(),
							placeholder: "Search issuers...",
							oncreate: openOrgModal,
							get value() {
								return formEduOrgId;
							},
							set value($$value) {
								formEduOrgId = $$value;
								$$settled = false;
							}
						});
						$$renderer.push(`<!----></div></div> <div class="form-group svelte-1wpip6v"><label for="edu-credential" class="svelte-1wpip6v">Credential ID</label> <input id="edu-credential" type="text"${attr("value", formCredentialId)} class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="edu-url" class="svelte-1wpip6v">URL</label> <input id="edu-url" type="url"${attr("value", formUrl)} class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="edu-expiration" class="svelte-1wpip6v">Expiration Date</label> <input id="edu-expiration" type="date"${attr("value", formExpirationDate)} class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="edu-description" class="svelte-1wpip6v">Description</label> <textarea id="edu-description" rows="3" placeholder="Additional notes about this certificate..." class="svelte-1wpip6v">`);
						const $$body_2 = escape_html(formEduDescription);
						if ($$body_2) $$renderer.push(`${$$body_2}`);
						$$renderer.push(`</textarea></div>`);
					} else if (formEducationType === "course") {
						$$renderer.push("<!--[2-->");
						$$renderer.push(`<div class="form-row svelte-1wpip6v"><div class="form-group svelte-1wpip6v"><label for="edu-org" class="svelte-1wpip6v">Institution (Provider)</label> <div class="org-select-row svelte-1wpip6v">`);
						OrgCombobox($$renderer, {
							id: "edu-org",
							organizations: eduFilteredOrgs(),
							placeholder: "Search providers...",
							oncreate: openOrgModal,
							get value() {
								return formEduOrgId;
							},
							set value($$value) {
								formEduOrgId = $$value;
								$$settled = false;
							}
						});
						$$renderer.push(`<!----></div></div> <div class="form-group svelte-1wpip6v"><label for="edu-campus" class="svelte-1wpip6v">Campus / Location</label> <div class="org-select-row svelte-1wpip6v">`);
						$$renderer.select({
							id: "edu-campus",
							value: formCampusId,
							disabled: !formEduOrgId,
							class: ""
						}, ($$renderer) => {
							$$renderer.option({ value: null }, ($$renderer) => {
								$$renderer.push(`${escape_html(formEduOrgId ? "-- Select --" : "Select org first")}`);
							});
							$$renderer.push(`<!--[-->`);
							const each_array_7 = ensure_array_like(campuses);
							for (let $$index_7 = 0, $$length = each_array_7.length; $$index_7 < $$length; $$index_7++) {
								let campus = each_array_7[$$index_7];
								$$renderer.option({ value: campus.id }, ($$renderer) => {
									$$renderer.push(`${escape_html(campus.name)}${escape_html(campus.city ? ` (${campus.city}${campus.state ? `, ${campus.state}` : ""})` : "")}`);
								});
							}
							$$renderer.push(`<!--]-->`);
						}, "svelte-1wpip6v");
						$$renderer.push(` <button class="btn-new-sm svelte-1wpip6v" type="button"${attr("disabled", !formEduOrgId, true)}>+</button></div></div></div> <div class="form-row svelte-1wpip6v"><div class="form-group svelte-1wpip6v"><label for="edu-start" class="svelte-1wpip6v">Start Date</label> <input id="edu-start" type="date"${attr("value", formStartDate)} class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="edu-end" class="svelte-1wpip6v">End Date</label> <input id="edu-end" type="date"${attr("value", formEndDate)} class="svelte-1wpip6v"/></div></div> <div class="form-group svelte-1wpip6v"><label for="edu-url" class="svelte-1wpip6v">URL</label> <input id="edu-url" type="url"${attr("value", formUrl)} class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="edu-description" class="svelte-1wpip6v">Description</label> <textarea id="edu-description" rows="3" placeholder="What you learned, key takeaways..." class="svelte-1wpip6v">`);
						const $$body_3 = escape_html(formEduDescription);
						if ($$body_3) $$renderer.push(`${$$body_3}`);
						$$renderer.push(`</textarea></div>`);
					} else if (formEducationType === "self_taught") {
						$$renderer.push("<!--[3-->");
						$$renderer.push(`<div class="form-group svelte-1wpip6v"><label for="edu-description" class="svelte-1wpip6v">Description <span class="required svelte-1wpip6v">*</span></label> <textarea id="edu-description" rows="6" placeholder="Describe what you learned, resources used, projects built..." class="svelte-1wpip6v">`);
						const $$body_4 = escape_html(formEduDescription);
						if ($$body_4) $$renderer.push(`${$$body_4}`);
						$$renderer.push(`</textarea></div> <div class="form-group svelte-1wpip6v"><label for="edu-url" class="svelte-1wpip6v">URL</label> <input id="edu-url" type="url"${attr("value", formUrl)} class="svelte-1wpip6v"/></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]-->`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (formSourceType === "project") {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="form-group svelte-1wpip6v"><label class="svelte-1wpip6v"><input type="checkbox"${attr("checked", formIsPersonal, true)} class="svelte-1wpip6v"/> Personal project</label></div> `);
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="form-group svelte-1wpip6v"><label for="proj-org" class="svelte-1wpip6v">Organization</label> `);
					$$renderer.select({
						id: "proj-org",
						value: formOrgId,
						class: ""
					}, ($$renderer) => {
						$$renderer.option({ value: null }, ($$renderer) => {
							$$renderer.push(`None`);
						});
						$$renderer.push(`<!--[-->`);
						const each_array_8 = ensure_array_like(roleFilteredOrgs());
						for (let $$index_8 = 0, $$length = each_array_8.length; $$index_8 < $$length; $$index_8++) {
							let org = each_array_8[$$index_8];
							$$renderer.option({ value: org.id }, ($$renderer) => {
								$$renderer.push(`${escape_html(org.name)}`);
							});
						}
						$$renderer.push(`<!--]-->`);
					}, "svelte-1wpip6v");
					$$renderer.push(`</div>`);
					$$renderer.push(`<!--]--> <div class="form-group svelte-1wpip6v"><label for="proj-url" class="svelte-1wpip6v">URL</label> <input id="proj-url" type="url"${attr("value", formProjectUrl)} class="svelte-1wpip6v"/></div> <div class="form-row svelte-1wpip6v"><div class="form-group svelte-1wpip6v"><label for="proj-start" class="svelte-1wpip6v">Start Date</label> <input id="proj-start" type="date"${attr("value", formStartDate)} class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="proj-end" class="svelte-1wpip6v">End Date</label> <input id="proj-end" type="date"${attr("value", formEndDate)} class="svelte-1wpip6v"/></div></div>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (formSourceType === "clearance") {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="form-row svelte-1wpip6v"><div class="form-group svelte-1wpip6v"><label for="clearance-level" class="svelte-1wpip6v">Level <span class="required svelte-1wpip6v">*</span></label> `);
					$$renderer.select({
						id: "clearance-level",
						value: formLevel,
						class: ""
					}, ($$renderer) => {
						$$renderer.push(`<!--[-->`);
						const each_array_9 = ensure_array_like(CLEARANCE_LEVELS);
						for (let $$index_9 = 0, $$length = each_array_9.length; $$index_9 < $$length; $$index_9++) {
							let level = each_array_9[$$index_9];
							$$renderer.option({ value: level }, ($$renderer) => {
								$$renderer.push(`${escape_html(CLEARANCE_LEVEL_LABELS[level])}`);
							});
						}
						$$renderer.push(`<!--]-->`);
					}, "svelte-1wpip6v");
					$$renderer.push(`</div> <div class="form-group svelte-1wpip6v"><label for="clearance-status" class="svelte-1wpip6v">Status</label> `);
					$$renderer.select({
						id: "clearance-status",
						value: formClearanceStatus,
						class: ""
					}, ($$renderer) => {
						$$renderer.push(`<!--[-->`);
						const each_array_10 = ensure_array_like(CLEARANCE_STATUSES);
						for (let $$index_10 = 0, $$length = each_array_10.length; $$index_10 < $$length; $$index_10++) {
							let status = each_array_10[$$index_10];
							$$renderer.option({ value: status }, ($$renderer) => {
								$$renderer.push(`${escape_html(status.charAt(0).toUpperCase() + status.slice(1))}`);
							});
						}
						$$renderer.push(`<!--]-->`);
					}, "svelte-1wpip6v");
					$$renderer.push(`</div></div> <div class="form-row svelte-1wpip6v"><div class="form-group svelte-1wpip6v"><label for="clearance-polygraph" class="svelte-1wpip6v">Polygraph</label> `);
					$$renderer.select({
						id: "clearance-polygraph",
						value: formPolygraph,
						class: ""
					}, ($$renderer) => {
						$$renderer.option({ value: "" }, ($$renderer) => {
							$$renderer.push(`-- None --`);
						});
						$$renderer.push(`<!--[-->`);
						const each_array_11 = ensure_array_like(CLEARANCE_POLYGRAPHS);
						for (let $$index_11 = 0, $$length = each_array_11.length; $$index_11 < $$length; $$index_11++) {
							let poly = each_array_11[$$index_11];
							$$renderer.option({ value: poly }, ($$renderer) => {
								$$renderer.push(`${escape_html(CLEARANCE_POLYGRAPH_LABELS[poly])}`);
							});
						}
						$$renderer.push(`<!--]-->`);
					}, "svelte-1wpip6v");
					$$renderer.push(`</div> <div class="form-group svelte-1wpip6v"><label for="clearance-type" class="svelte-1wpip6v">Type</label> `);
					$$renderer.select({
						id: "clearance-type",
						value: formClearanceType,
						class: ""
					}, ($$renderer) => {
						$$renderer.push(`<!--[-->`);
						const each_array_12 = ensure_array_like(CLEARANCE_TYPES);
						for (let $$index_12 = 0, $$length = each_array_12.length; $$index_12 < $$length; $$index_12++) {
							let ctype = each_array_12[$$index_12];
							$$renderer.option({ value: ctype }, ($$renderer) => {
								$$renderer.push(`${escape_html(ctype.charAt(0).toUpperCase() + ctype.slice(1))}`);
							});
						}
						$$renderer.push(`<!--]-->`);
					}, "svelte-1wpip6v");
					$$renderer.push(`</div></div> <div class="form-group svelte-1wpip6v"><label class="svelte-1wpip6v">Access Programs</label> <div class="checkbox-group svelte-1wpip6v"><!--[-->`);
					const each_array_13 = ensure_array_like(CLEARANCE_ACCESS_PROGRAMS);
					for (let $$index_13 = 0, $$length = each_array_13.length; $$index_13 < $$length; $$index_13++) {
						let prog = each_array_13[$$index_13];
						$$renderer.push(`<label class="checkbox-label svelte-1wpip6v"><input type="checkbox"${attr("checked", formAccessPrograms.includes(prog), true)} class="svelte-1wpip6v"/> ${escape_html(CLEARANCE_ACCESS_PROGRAM_LABELS[prog])}</label>`);
					}
					$$renderer.push(`<!--]--></div></div> <div class="form-group svelte-1wpip6v"><label class="checkbox-label svelte-1wpip6v"><input type="checkbox"${attr("checked", formContinuousInvestigation, true)} class="svelte-1wpip6v"/> Continuous Investigation (CE/CV)</label></div>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <div class="form-group svelte-1wpip6v"><label for="source-notes" class="svelte-1wpip6v">Notes</label> <textarea id="source-notes" rows="3" placeholder="Internal notes about this source..." class="svelte-1wpip6v">`);
				const $$body_5 = escape_html(formNotes);
				if ($$body_5) $$renderer.push(`${$$body_5}`);
				$$renderer.push(`</textarea></div> `);
				if (selectedId && !editing) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<div class="skills-section svelte-1wpip6v"><label class="svelte-1wpip6v">Skills</label> `);
					if (sourceSkills.length > 0) {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<div class="skill-pills svelte-1wpip6v"><!--[-->`);
						const each_array_14 = ensure_array_like(sourceSkills);
						for (let $$index_14 = 0, $$length = each_array_14.length; $$index_14 < $$length; $$index_14++) {
							let skill = each_array_14[$$index_14];
							$$renderer.push(`<span class="skill-pill svelte-1wpip6v">${escape_html(skill.name)} <button class="skill-remove svelte-1wpip6v" title="Remove">×</button></span>`);
						}
						$$renderer.push(`<!--]--></div>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> <div class="skill-add-row svelte-1wpip6v"><input type="text"${attr("value", skillSearchQuery)} placeholder="Search or create skill..." class="svelte-1wpip6v"/> `);
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--></div></div>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <div class="editor-actions svelte-1wpip6v"><button class="btn btn-save svelte-1wpip6v"${attr("disabled", saving, true)}>`);
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`${escape_html(editing ? "Create" : "Save")}`);
				$$renderer.push(`<!--]--></button> `);
				if (!editing && selectedSource()) {
					$$renderer.push("<!--[0-->");
					if (selectedSource().status === "draft" || selectedSource().status === "approved") {
						$$renderer.push("<!--[0-->");
						$$renderer.push(`<button class="btn btn-derive svelte-1wpip6v"${attr("disabled", deriving, true)}>`);
						$$renderer.push("<!--[-1-->");
						$$renderer.push(`Derive Bullets`);
						$$renderer.push(`<!--]--></button>`);
					} else $$renderer.push("<!--[-1-->");
					$$renderer.push(`<!--]--> <button class="btn btn-delete svelte-1wpip6v">Delete</button>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div></div>`);
			}
			$$renderer.push(`<!--]--></div></div> `);
			ConfirmDialog($$renderer, {
				open: confirmDeleteOpen,
				title: "Delete Source",
				message: "Are you sure you want to delete this source? This action cannot be undone.",
				confirmLabel: "Delete",
				onconfirm: deleteSource,
				oncancel: () => confirmDeleteOpen = false,
				destructive: true
			});
			$$renderer.push(`<!----> `);
			if (showOrgModal) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="modal-overlay svelte-1wpip6v" role="presentation"><div class="org-modal svelte-1wpip6v" role="dialog" aria-modal="true" aria-labelledby="org-modal-title"><h3 id="org-modal-title" class="svelte-1wpip6v">New Organization</h3> <div class="form-group svelte-1wpip6v"><label for="new-org-name" class="svelte-1wpip6v">Name *</label> <input id="new-org-name" type="text"${attr("value", newOrgName)} placeholder="e.g. Georgia Tech, CompTIA, Coursera" class="svelte-1wpip6v"/></div> <div class="form-group svelte-1wpip6v"><label for="new-org-type" class="svelte-1wpip6v">Primary Type</label> `);
				$$renderer.select({
					id: "new-org-type",
					value: newOrgType,
					class: ""
				}, ($$renderer) => {
					$$renderer.option({ value: "education" }, ($$renderer) => {
						$$renderer.push(`Education`);
					});
					$$renderer.option({ value: "company" }, ($$renderer) => {
						$$renderer.push(`Company`);
					});
					$$renderer.option({ value: "nonprofit" }, ($$renderer) => {
						$$renderer.push(`Nonprofit`);
					});
					$$renderer.option({ value: "government" }, ($$renderer) => {
						$$renderer.push(`Government`);
					});
					$$renderer.option({ value: "military" }, ($$renderer) => {
						$$renderer.push(`Military`);
					});
					$$renderer.option({ value: "other" }, ($$renderer) => {
						$$renderer.push(`Other`);
					});
				}, "svelte-1wpip6v");
				$$renderer.push(`</div> <div class="form-group svelte-1wpip6v"><label class="svelte-1wpip6v">Tags</label> <div class="tag-checkboxes svelte-1wpip6v"><!--[-->`);
				const each_array_16 = ensure_array_like([
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
					"freelance"
				]);
				for (let $$index_16 = 0, $$length = each_array_16.length; $$index_16 < $$length; $$index_16++) {
					let tag = each_array_16[$$index_16];
					$$renderer.push(`<label class="tag-checkbox svelte-1wpip6v"><input type="checkbox"${attr("checked", newOrgTags.includes(tag), true)} class="svelte-1wpip6v"/> ${escape_html(tag)}</label>`);
				}
				$$renderer.push(`<!--]--></div></div> <div class="form-group svelte-1wpip6v"><label for="new-org-website" class="svelte-1wpip6v">Website</label> <input id="new-org-website" type="url"${attr("value", newOrgWebsite)} placeholder="https://..." class="svelte-1wpip6v"/></div> <div class="modal-actions svelte-1wpip6v"><button class="btn btn-ghost svelte-1wpip6v"${attr("disabled", creatingOrg, true)}>Cancel</button> <button class="btn btn-primary svelte-1wpip6v"${attr("disabled", !newOrgName.trim(), true)}>${escape_html("Create & Select")}</button></div></div></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			$$renderer.push("<!--[-1-->");
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
export { SourcesView as t };
