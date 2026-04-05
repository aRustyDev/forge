//#region ../sdk/src/resources/archetypes.ts
var ArchetypesResource = class {
	constructor(request, requestList) {
		this.request = request;
		this.requestList = requestList;
	}
	create(input) {
		return this.request("POST", "/api/archetypes", input);
	}
	list(params) {
		const p = {};
		if (params?.offset !== void 0) p.offset = String(params.offset);
		if (params?.limit !== void 0) p.limit = String(params.limit);
		return this.requestList("GET", "/api/archetypes", Object.keys(p).length > 0 ? p : void 0);
	}
	get(id) {
		return this.request("GET", `/api/archetypes/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/archetypes/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/archetypes/${id}`);
	}
	listDomains(archetypeId) {
		return this.request("GET", `/api/archetypes/${archetypeId}/domains`);
	}
	addDomain(archetypeId, domainId) {
		return this.request("POST", `/api/archetypes/${archetypeId}/domains`, { domain_id: domainId });
	}
	removeDomain(archetypeId, domainId) {
		return this.request("DELETE", `/api/archetypes/${archetypeId}/domains/${domainId}`);
	}
};
//#endregion
//#region ../sdk/src/resources/bullets.ts
function toParams$8(filter) {
	if (!filter) return void 0;
	const out = {};
	for (const [k, v] of Object.entries(filter)) if (v !== void 0 && v !== null) out[k] = String(v);
	return Object.keys(out).length > 0 ? out : void 0;
}
var BulletsResource = class {
	constructor(request, requestList) {
		this.request = request;
		this.requestList = requestList;
	}
	list(filter) {
		return this.requestList("GET", "/api/bullets", toParams$8(filter));
	}
	get(id) {
		return this.request("GET", `/api/bullets/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/bullets/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/bullets/${id}`);
	}
	approve(id) {
		return this.request("PATCH", `/api/bullets/${id}/approve`);
	}
	reject(id, input) {
		return this.request("PATCH", `/api/bullets/${id}/reject`, input);
	}
	reopen(id) {
		return this.request("PATCH", `/api/bullets/${id}/reopen`);
	}
	/** Submit a draft bullet for review (draft -> in_review). */
	submit(id) {
		return this.request("PATCH", `/api/bullets/${id}/submit`);
	}
	derivePerspectives(id, input) {
		return this.request("POST", `/api/bullets/${id}/derive-perspectives`, input);
	}
	/** List all skills linked to this bullet. */
	listSkills(bulletId) {
		return this.request("GET", `/api/bullets/${bulletId}/skills`);
	}
	/** Link an existing skill or create a new one and link it. */
	addSkill(bulletId, input) {
		return this.request("POST", `/api/bullets/${bulletId}/skills`, input);
	}
	/** Unlink a skill from this bullet. */
	removeSkill(bulletId, skillId) {
		return this.request("DELETE", `/api/bullets/${bulletId}/skills/${skillId}`);
	}
	/** List sources associated with this bullet (with is_primary flag). */
	listSources(bulletId) {
		return this.request("GET", `/api/bullets/${bulletId}/sources`);
	}
};
//#endregion
//#region ../sdk/src/debug.ts
/**
* SDK Debug Store — structured logging and ring buffer for Forge SDK requests.
*/
/**
* Detect dev mode across Vite (browser/SvelteKit) and Bun (CLI/tests).
*
* Detection paths:
* 1. Vite: `import.meta.env.DEV` is injected at build time and is `true` in dev mode.
* 2. Bun/Node.js: Falls back to `process.env.NODE_ENV !== 'production'`.
* 3. FORGE_DEBUG override: `process.env.FORGE_DEBUG === 'true'` forces dev mode on
*    even in production builds (useful for one-off CLI debugging).
*/
function isDevMode() {
	try {
		if (typeof import.meta !== "undefined" && true) return false;
	} catch {}
	if (typeof process !== "undefined" && process.env) return process.env.NODE_ENV !== "production" || process.env.FORGE_DEBUG === "true";
	return false;
}
/**
* Ring buffer that captures SDK request/response log entries for debugging.
* Access via `forge.debug` on a ForgeClient instance.
*
* The store operates as a FIFO ring buffer: when entries exceed `maxSize`,
* the oldest entries are evicted first. When `enabled` is false, `push()`
* is a no-op but query methods still work on any existing entries.
*/
var DebugStore = class {
	/** Whether the store is accepting new entries. */
	enabled;
	/** Whether to log entries to console.debug. */
	logToConsole;
	/** Whether to capture request/response bodies. */
	logPayloads;
	/** Maximum number of entries before oldest are evicted. */
	maxSize;
	entries_ = [];
	constructor(options) {
		if (typeof options === "boolean") {
			this.enabled = options;
			this.logToConsole = options;
			this.logPayloads = false;
			this.maxSize = 100;
		} else if (options) {
			this.enabled = true;
			this.logToConsole = options.logToConsole ?? true;
			this.logPayloads = options.logPayloads ?? false;
			this.maxSize = options.storeSize ?? 100;
		} else {
			const dev = isDevMode();
			this.enabled = dev;
			this.logToConsole = dev;
			this.logPayloads = false;
			this.maxSize = 100;
		}
	}
	/** Push a log entry to the ring buffer. Evicts oldest entry if at capacity (FIFO). */
	push(entry) {
		if (!this.enabled) return;
		this.entries_.push(entry);
		if (this.entries_.length > this.maxSize) this.entries_.shift();
	}
	/** Remove all entries from the buffer. */
	clear() {
		this.entries_ = [];
	}
	/** Get all entries in chronological order (oldest first). Returns a shallow copy. */
	getAll() {
		return [...this.entries_];
	}
	/** Get only error entries (where ok === false). */
	getErrors() {
		return this.entries_.filter((e) => e.ok === false);
	}
	/** Get entries matching a path prefix (e.g., '/api/resumes'). */
	getByPath(pathPrefix) {
		return this.entries_.filter((e) => e.path.startsWith(pathPrefix));
	}
	/** Get entries slower than the given threshold in milliseconds. */
	getSlow(thresholdMs) {
		return this.entries_.filter((e) => e.duration_ms !== void 0 && e.duration_ms > thresholdMs);
	}
};
//#endregion
//#region ../sdk/src/resources/domains.ts
var DomainsResource = class {
	constructor(request, requestList) {
		this.request = request;
		this.requestList = requestList;
	}
	create(input) {
		return this.request("POST", "/api/domains", input);
	}
	list(params) {
		const p = {};
		if (params?.offset !== void 0) p.offset = String(params.offset);
		if (params?.limit !== void 0) p.limit = String(params.limit);
		return this.requestList("GET", "/api/domains", Object.keys(p).length > 0 ? p : void 0);
	}
	get(id) {
		return this.request("GET", `/api/domains/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/domains/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/domains/${id}`);
	}
};
//#endregion
//#region ../sdk/src/resources/integrity.ts
var IntegrityResource = class {
	constructor(request) {
		this.request = request;
	}
	drift() {
		return this.request("GET", "/api/integrity/drift");
	}
};
//#endregion
//#region ../sdk/src/resources/notes.ts
function toParams$7(filter) {
	if (!filter) return void 0;
	const out = {};
	for (const [k, v] of Object.entries(filter)) if (v !== void 0 && v !== null) out[k] = String(v);
	return Object.keys(out).length > 0 ? out : void 0;
}
var NotesResource = class {
	constructor(request, requestList) {
		this.request = request;
		this.requestList = requestList;
	}
	create(input) {
		return this.request("POST", "/api/notes", input);
	}
	list(filter) {
		return this.requestList("GET", "/api/notes", toParams$7(filter));
	}
	get(id) {
		return this.request("GET", `/api/notes/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/notes/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/notes/${id}`);
	}
	addReference(noteId, input) {
		return this.request("POST", `/api/notes/${noteId}/references`, input);
	}
	removeReference(noteId, entityType, entityId) {
		return this.request("DELETE", `/api/notes/${noteId}/references/${entityType}/${entityId}`);
	}
};
//#endregion
//#region ../sdk/src/resources/organizations.ts
function toParams$6(filter) {
	if (!filter) return void 0;
	const out = {};
	for (const [k, v] of Object.entries(filter)) if (v !== void 0 && v !== null) out[k] = String(v);
	return Object.keys(out).length > 0 ? out : void 0;
}
var OrganizationsResource = class {
	constructor(request, requestList) {
		this.request = request;
		this.requestList = requestList;
	}
	create(input) {
		return this.request("POST", "/api/organizations", input);
	}
	list(filter) {
		return this.requestList("GET", "/api/organizations", toParams$6(filter));
	}
	get(id) {
		return this.request("GET", `/api/organizations/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/organizations/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/organizations/${id}`);
	}
};
//#endregion
//#region ../sdk/src/resources/perspectives.ts
function toParams$5(filter) {
	if (!filter) return void 0;
	const out = {};
	for (const [k, v] of Object.entries(filter)) if (v !== void 0 && v !== null) out[k] = String(v);
	return Object.keys(out).length > 0 ? out : void 0;
}
var PerspectivesResource = class {
	constructor(request, requestList) {
		this.request = request;
		this.requestList = requestList;
	}
	list(filter) {
		return this.requestList("GET", "/api/perspectives", toParams$5(filter));
	}
	get(id) {
		return this.request("GET", `/api/perspectives/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/perspectives/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/perspectives/${id}`);
	}
	approve(id) {
		return this.request("PATCH", `/api/perspectives/${id}/approve`);
	}
	reject(id, input) {
		return this.request("PATCH", `/api/perspectives/${id}/reject`, input);
	}
	reopen(id) {
		return this.request("PATCH", `/api/perspectives/${id}/reopen`);
	}
};
//#endregion
//#region ../sdk/src/resources/resumes.ts
function toParams$4(filter) {
	if (!filter) return void 0;
	const out = {};
	for (const [k, v] of Object.entries(filter)) if (v !== void 0 && v !== null) out[k] = String(v);
	return Object.keys(out).length > 0 ? out : void 0;
}
var ResumesResource = class {
	constructor(request, requestList, baseUrl = "", debug) {
		this.request = request;
		this.requestList = requestList;
		this.baseUrl = baseUrl;
		this.debug = debug;
	}
	create(input) {
		return this.request("POST", "/api/resumes", input);
	}
	list(pagination) {
		return this.requestList("GET", "/api/resumes", toParams$4(pagination));
	}
	get(id) {
		return this.request("GET", `/api/resumes/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/resumes/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/resumes/${id}`);
	}
	addEntry(resumeId, input) {
		return this.request("POST", `/api/resumes/${resumeId}/entries`, input);
	}
	listEntries(resumeId) {
		return this.request("GET", `/api/resumes/${resumeId}/entries`);
	}
	updateEntry(resumeId, entryId, input) {
		return this.request("PATCH", `/api/resumes/${resumeId}/entries/${entryId}`, input);
	}
	removeEntry(resumeId, entryId) {
		return this.request("DELETE", `/api/resumes/${resumeId}/entries/${entryId}`);
	}
	createSection(resumeId, input) {
		return this.request("POST", `/api/resumes/${resumeId}/sections`, input);
	}
	listSections(resumeId) {
		return this.request("GET", `/api/resumes/${resumeId}/sections`);
	}
	updateSection(resumeId, sectionId, input) {
		return this.request("PATCH", `/api/resumes/${resumeId}/sections/${sectionId}`, input);
	}
	deleteSection(resumeId, sectionId) {
		return this.request("DELETE", `/api/resumes/${resumeId}/sections/${sectionId}`);
	}
	addSkill(resumeId, sectionId, skillId) {
		return this.request("POST", `/api/resumes/${resumeId}/sections/${sectionId}/skills`, { skill_id: skillId });
	}
	listSkills(resumeId, sectionId) {
		return this.request("GET", `/api/resumes/${resumeId}/sections/${sectionId}/skills`);
	}
	removeSkill(resumeId, sectionId, skillId) {
		return this.request("DELETE", `/api/resumes/${resumeId}/sections/${sectionId}/skills/${skillId}`);
	}
	reorderSkills(resumeId, sectionId, skills) {
		return this.request("PATCH", `/api/resumes/${resumeId}/sections/${sectionId}/skills/reorder`, { skills });
	}
	gaps(id) {
		return this.request("GET", `/api/resumes/${id}/gaps`);
	}
	ir(id) {
		return this.request("GET", `/api/resumes/${id}/ir`);
	}
	updateHeader(id, header) {
		return this.request("PATCH", `/api/resumes/${id}/header`, header);
	}
	updateMarkdownOverride(id, content) {
		return this.request("PATCH", `/api/resumes/${id}/markdown-override`, { content });
	}
	updateLatexOverride(id, content) {
		return this.request("PATCH", `/api/resumes/${id}/latex-override`, { content });
	}
	async pdf(id, latex) {
		const path = `/api/resumes/${id}/pdf`;
		const method = "POST";
		const start = performance.now();
		try {
			const headers = {};
			const body = latex ? JSON.stringify({ latex }) : void 0;
			if (body) headers["Content-Type"] = "application/json";
			const response = await fetch(`${this.baseUrl}${path}`, {
				method,
				headers,
				body
			});
			const duration = Math.round(performance.now() - start);
			if (response.ok) {
				const blob = await response.blob();
				if (this.debug?.logToConsole) console.debug(`[forge:sdk] ← ${method} ${path} ${response.status} ${duration}ms ok (${blob.size} bytes PDF)`);
				return {
					ok: true,
					data: blob
				};
			}
			const error = (await response.json()).error ?? {
				code: "UNKNOWN_ERROR",
				message: `HTTP ${response.status}`
			};
			if (this.debug?.logToConsole) console.debug(`[forge:sdk] ← ${method} ${path} ${response.status} ${duration}ms ERROR ${error.code}`);
			return {
				ok: false,
				error
			};
		} catch (err) {
			if (this.debug?.logToConsole) console.debug(`[forge:sdk] ✗ ${method} ${path} NETWORK_ERROR`);
			return {
				ok: false,
				error: {
					code: "NETWORK_ERROR",
					message: String(err)
				}
			};
		}
	}
	saveAsTemplate(resumeId, input) {
		return this.request("POST", `/api/resumes/${resumeId}/save-as-template`, input);
	}
	/** List JDs linked to a resume. */
	listJobDescriptions(resumeId) {
		return this.request("GET", `/api/resumes/${resumeId}/job-descriptions`);
	}
};
//#endregion
//#region ../sdk/src/resources/review.ts
var ReviewResource = class {
	constructor(request) {
		this.request = request;
	}
	pending() {
		return this.request("GET", "/api/review/pending");
	}
};
//#endregion
//#region ../sdk/src/resources/profile.ts
var ProfileResource = class {
	constructor(request) {
		this.request = request;
	}
	/** Get the user profile. */
	get() {
		return this.request("GET", "/api/profile");
	}
	/** Update profile fields. Only provided fields are modified. */
	update(data) {
		return this.request("PATCH", "/api/profile", data);
	}
};
//#endregion
//#region ../sdk/src/resources/skills.ts
var SkillsResource = class {
	constructor(request) {
		this.request = request;
	}
	list(filter) {
		let path = "/api/skills";
		const params = [];
		if (filter?.category) params.push(`category=${encodeURIComponent(filter.category)}`);
		if (filter?.limit) params.push(`limit=${filter.limit}`);
		if (params.length > 0) path += `?${params.join("&")}`;
		return this.request("GET", path);
	}
	create(input) {
		return this.request("POST", "/api/skills", input);
	}
};
//#endregion
//#region ../sdk/src/resources/sources.ts
/**
* Serialize filter + pagination params into a Record<string, string> suitable
* for `requestList`.  Drops undefined values.
*/
function toParams$3(filter) {
	if (!filter) return void 0;
	const out = {};
	for (const [k, v] of Object.entries(filter)) if (v !== void 0 && v !== null) out[k] = String(v);
	return Object.keys(out).length > 0 ? out : void 0;
}
var SourcesResource = class {
	constructor(request, requestList) {
		this.request = request;
		this.requestList = requestList;
	}
	create(input) {
		return this.request("POST", "/api/sources", input);
	}
	list(filter) {
		return this.requestList("GET", "/api/sources", toParams$3(filter));
	}
	get(id) {
		return this.request("GET", `/api/sources/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/sources/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/sources/${id}`);
	}
	deriveBullets(id) {
		return this.request("POST", `/api/sources/${id}/derive-bullets`);
	}
};
//#endregion
//#region ../sdk/src/resources/job-descriptions.ts
function toParams$2(filter) {
	if (!filter) return void 0;
	const out = {};
	for (const [k, v] of Object.entries(filter)) if (v !== void 0 && v !== null) out[k] = String(v);
	return Object.keys(out).length > 0 ? out : void 0;
}
var JobDescriptionsResource = class {
	constructor(request, requestList) {
		this.request = request;
		this.requestList = requestList;
	}
	create(input) {
		return this.request("POST", "/api/job-descriptions", input);
	}
	list(filter) {
		return this.requestList("GET", "/api/job-descriptions", toParams$2(filter));
	}
	get(id) {
		return this.request("GET", `/api/job-descriptions/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/job-descriptions/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/job-descriptions/${id}`);
	}
	/** List all skills linked to a job description. */
	listSkills(jdId) {
		return this.request("GET", `/api/job-descriptions/${jdId}/skills`);
	}
	/** Link a skill to a job description. Pass skill_id to link existing, or name to create+link. */
	addSkill(jdId, input) {
		return this.request("POST", `/api/job-descriptions/${jdId}/skills`, input);
	}
	/** Remove a skill link from a job description. */
	removeSkill(jdId, skillId) {
		return this.request("DELETE", `/api/job-descriptions/${jdId}/skills/${skillId}`);
	}
	/** List resumes linked to a JD. */
	listResumes(jdId) {
		return this.request("GET", `/api/job-descriptions/${jdId}/resumes`);
	}
	/** Link a resume to a JD. Idempotent: re-linking returns 200 with existing data. */
	linkResume(jdId, resumeId) {
		return this.request("POST", `/api/job-descriptions/${jdId}/resumes`, { resume_id: resumeId });
	}
	/** Unlink a resume from a JD. Idempotent: unlinking a nonexistent link returns 204. */
	unlinkResume(jdId, resumeId) {
		return this.request("DELETE", `/api/job-descriptions/${jdId}/resumes/${resumeId}`);
	}
};
//#endregion
//#region ../sdk/src/resources/templates.ts
/**
* SDK resource for resume template CRUD.
*
* Converts `is_builtin` between server format (0|1) and SDK format (boolean).
*/
var TemplatesResource = class {
	constructor(request) {
		this.request = request;
	}
	async list() {
		const result = await this.request("GET", "/api/templates");
		if (result.ok) result.data = result.data.map(this.deserialize);
		return result;
	}
	async get(id) {
		const result = await this.request("GET", `/api/templates/${id}`);
		if (result.ok) result.data = this.deserialize(result.data);
		return result;
	}
	async create(input) {
		const result = await this.request("POST", "/api/templates", input);
		if (result.ok) result.data = this.deserialize(result.data);
		return result;
	}
	async update(id, input) {
		const result = await this.request("PATCH", `/api/templates/${id}`, input);
		if (result.ok) result.data = this.deserialize(result.data);
		return result;
	}
	delete(id) {
		return this.request("DELETE", `/api/templates/${id}`);
	}
	/**
	* Convert server is_builtin (0|1) to boolean.
	*
	* The server returns `is_builtin` as `0 | 1` (SQLite INTEGER). The deserializer
	* converts to boolean for the SDK consumer. Using `any` on the parameter is
	* cleaner than `as any` on the output.
	*/
	deserialize(template) {
		return {
			...template,
			is_builtin: Boolean(template.is_builtin)
		};
	}
};
//#endregion
//#region ../sdk/src/resources/export.ts
var ExportResource = class {
	constructor(request, baseUrl) {
		this.request = request;
		this.baseUrl = baseUrl;
	}
	/** Export a resume as JSON (returns the full IR document). */
	async resumeAsJson(id) {
		return this.request("GET", `/api/export/resume/${id}?format=json`);
	}
	/**
	* Download a resume as a binary blob (PDF, Markdown, or LaTeX).
	*
	* Uses raw `fetch()` instead of `this.request()` because the response
	* is not a JSON envelope — it is the raw file content.
	*/
	async downloadResume(id, format) {
		try {
			const response = await fetch(`${this.baseUrl}/api/export/resume/${id}?format=${format}`);
			if (!response.ok) try {
				return {
					ok: false,
					error: (await response.json()).error ?? {
						code: "EXPORT_FAILED",
						message: `HTTP ${response.status}`
					}
				};
			} catch {
				return {
					ok: false,
					error: {
						code: "EXPORT_FAILED",
						message: `HTTP ${response.status}: ${response.statusText}`
					}
				};
			}
			return {
				ok: true,
				data: await response.blob()
			};
		} catch (err) {
			return {
				ok: false,
				error: {
					code: "NETWORK_ERROR",
					message: String(err)
				}
			};
		}
	}
	/** Export entity data as a JSON bundle. */
	async exportData(entities) {
		return this.request("GET", `/api/export/data?entities=${entities.join(",")}`);
	}
	/**
	* Download a full database dump as SQL text.
	*
	* Uses raw `fetch()` because the response is SQL text, not JSON.
	*/
	async dumpDatabase() {
		try {
			const response = await fetch(`${this.baseUrl}/api/export/dump`);
			if (!response.ok) try {
				return {
					ok: false,
					error: (await response.json()).error ?? {
						code: "DUMP_FAILED",
						message: `HTTP ${response.status}`
					}
				};
			} catch {
				return {
					ok: false,
					error: {
						code: "DUMP_FAILED",
						message: `HTTP ${response.status}: ${response.statusText}`
					}
				};
			}
			return {
				ok: true,
				data: await response.blob()
			};
		} catch (err) {
			return {
				ok: false,
				error: {
					code: "NETWORK_ERROR",
					message: String(err)
				}
			};
		}
	}
};
//#endregion
//#region ../sdk/src/resources/summaries.ts
/**
* Convert filter + pagination into query string params.
* Boolean `is_template` is converted to "1"/"0" for SQLite INTEGER columns.
*/
function toParams$1(filter, pagination) {
	const out = {};
	if (filter) for (const [k, v] of Object.entries(filter)) {
		if (v === void 0 || v === null) continue;
		if (k === "is_template" && typeof v === "boolean") out[k] = v ? "1" : "0";
		else out[k] = String(v);
	}
	if (pagination?.offset !== void 0) out.offset = String(pagination.offset);
	if (pagination?.limit !== void 0) out.limit = String(pagination.limit);
	return Object.keys(out).length > 0 ? out : void 0;
}
var SummariesResource = class {
	constructor(request, requestList) {
		this.request = request;
		this.requestList = requestList;
	}
	create(input) {
		return this.request("POST", "/api/summaries", input);
	}
	list(filter) {
		const { offset, limit, ...rest } = filter ?? {};
		return this.requestList("GET", "/api/summaries", toParams$1(rest, {
			offset,
			limit
		}));
	}
	get(id) {
		return this.request("GET", `/api/summaries/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/summaries/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/summaries/${id}`);
	}
	clone(id) {
		return this.request("POST", `/api/summaries/${id}/clone`);
	}
	/** Toggle the is_template flag atomically. Returns the updated summary. */
	toggleTemplate(id) {
		return this.request("POST", `/api/summaries/${id}/toggle-template`);
	}
	/** List resumes linked to a summary via summary_id, with pagination. */
	linkedResumes(id, params) {
		return this.requestList("GET", `/api/summaries/${id}/linked-resumes`, toParams$1(void 0, params));
	}
};
//#endregion
//#region ../sdk/src/resources/contacts.ts
function toParams(filter) {
	if (!filter) return void 0;
	const out = {};
	for (const [k, v] of Object.entries(filter)) if (v !== void 0 && v !== null) out[k] = String(v);
	return Object.keys(out).length > 0 ? out : void 0;
}
var ContactsResource = class {
	constructor(request, requestList) {
		this.request = request;
		this.requestList = requestList;
	}
	create(input) {
		return this.request("POST", "/api/contacts", input);
	}
	list(filter) {
		return this.requestList("GET", "/api/contacts", toParams(filter));
	}
	get(id) {
		return this.request("GET", `/api/contacts/${id}`);
	}
	update(id, input) {
		return this.request("PATCH", `/api/contacts/${id}`, input);
	}
	delete(id) {
		return this.request("DELETE", `/api/contacts/${id}`);
	}
	listOrganizations(contactId) {
		return this.request("GET", `/api/contacts/${contactId}/organizations`);
	}
	linkOrganization(contactId, orgId, relationship) {
		return this.request("POST", `/api/contacts/${contactId}/organizations`, {
			organization_id: orgId,
			relationship
		});
	}
	unlinkOrganization(contactId, orgId, relationship) {
		return this.request("DELETE", `/api/contacts/${contactId}/organizations/${orgId}/${encodeURIComponent(relationship)}`);
	}
	listJobDescriptions(contactId) {
		return this.request("GET", `/api/contacts/${contactId}/job-descriptions`);
	}
	linkJobDescription(contactId, jdId, relationship) {
		return this.request("POST", `/api/contacts/${contactId}/job-descriptions`, {
			job_description_id: jdId,
			relationship
		});
	}
	unlinkJobDescription(contactId, jdId, relationship) {
		return this.request("DELETE", `/api/contacts/${contactId}/job-descriptions/${jdId}/${encodeURIComponent(relationship)}`);
	}
	listResumes(contactId) {
		return this.request("GET", `/api/contacts/${contactId}/resumes`);
	}
	linkResume(contactId, resumeId, relationship) {
		return this.request("POST", `/api/contacts/${contactId}/resumes`, {
			resume_id: resumeId,
			relationship
		});
	}
	unlinkResume(contactId, resumeId, relationship) {
		return this.request("DELETE", `/api/contacts/${contactId}/resumes/${resumeId}/${encodeURIComponent(relationship)}`);
	}
	/** List contacts linked to an organization. Call from org context. */
	listByOrganization(orgId) {
		return this.request("GET", `/api/organizations/${orgId}/contacts`);
	}
	/** List contacts linked to a job description. Call from JD context. */
	listByJobDescription(jdId) {
		return this.request("GET", `/api/job-descriptions/${jdId}/contacts`);
	}
	/** List contacts linked to a resume. Call from resume context. */
	listByResume(resumeId) {
		return this.request("GET", `/api/resumes/${resumeId}/contacts`);
	}
};
//#endregion
//#region ../sdk/src/client.ts
var ForgeClient = class {
	baseUrl;
	/** Debug store for programmatic inspection of SDK requests. */
	debug;
	/** Source CRUD + deriveBullets. */
	sources;
	/** Bullet listing, status transitions, derivePerspectives. */
	bullets;
	/** Perspective listing, status transitions. */
	perspectives;
	/** Resume CRUD, entry management, gaps, export. */
	resumes;
	/** Review queue. */
	review;
	/** Organization CRUD. */
	organizations;
	/** User notes CRUD + references. */
	notes;
	/** Integrity / drift detection. */
	integrity;
	/** Domain CRUD. */
	domains;
	/** Archetype CRUD + domain associations. */
	archetypes;
	/** User profile (contact info). */
	profile;
	/** Skills CRUD. */
	skills;
	/** Job description CRUD. */
	jobDescriptions;
	/** Resume template CRUD. */
	templates;
	/** Export: resume downloads, data bundles, database dump. */
	export;
	/** Summaries CRUD + clone. */
	summaries;
	/** Contact CRUD + relationship management. */
	contacts;
	constructor(options) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, "");
		if (typeof options.debug === "boolean" || typeof options.debug === "object") this.debug = new DebugStore(options.debug);
		else this.debug = new DebugStore();
		const req = this.request.bind(this);
		const reqList = this.requestList.bind(this);
		this.sources = new SourcesResource(req, reqList);
		this.bullets = new BulletsResource(req, reqList);
		this.perspectives = new PerspectivesResource(req, reqList);
		this.resumes = new ResumesResource(req, reqList, this.baseUrl, this.debug);
		this.review = new ReviewResource(req);
		this.organizations = new OrganizationsResource(req, reqList);
		this.notes = new NotesResource(req, reqList);
		this.integrity = new IntegrityResource(req);
		this.domains = new DomainsResource(req, reqList);
		this.archetypes = new ArchetypesResource(req, reqList);
		this.profile = new ProfileResource(req);
		this.skills = new SkillsResource(req);
		this.jobDescriptions = new JobDescriptionsResource(req, reqList);
		this.templates = new TemplatesResource(req);
		this.export = new ExportResource(req, this.baseUrl);
		this.summaries = new SummariesResource(req, reqList);
		this.contacts = new ContactsResource(req, reqList);
	}
	/**
	* Single-entity request.
	*
	* 1. Build the full URL from baseUrl + path.
	* 2. Set Content-Type only when a body is provided.
	* 3. Handle 204 No Content (DELETE responses).
	* 4. Unwrap the standard `{ data }` / `{ error }` envelope.
	* 5. Catch network errors and non-JSON error responses.
	* 6. Log request/response to debug store and console.debug.
	*/
	async request(method, path, body) {
		const start = performance.now();
		const bodySize = body !== void 0 ? JSON.stringify(body).length : void 0;
		if (this.debug.enabled && this.debug.logToConsole) console.debug(`[forge:sdk] → ${method} ${path}`);
		try {
			const headers = {};
			if (body !== void 0) headers["Content-Type"] = "application/json";
			const response = await fetch(`${this.baseUrl}${path}`, {
				method,
				headers,
				body: body !== void 0 ? JSON.stringify(body) : void 0
			});
			const duration = performance.now() - start;
			const requestId = response.headers.get("X-Request-Id") ?? void 0;
			if (response.status === 204) {
				const entry = {
					timestamp: (/* @__PURE__ */ new Date()).toISOString(),
					direction: "response",
					method,
					path,
					status: 204,
					duration_ms: Math.round(duration * 10) / 10,
					ok: true,
					request_id: requestId,
					request_body_size: bodySize
				};
				this.logResponse(entry);
				return {
					ok: true,
					data: void 0
				};
			}
			let json;
			let rawText;
			try {
				rawText = await response.text();
				json = JSON.parse(rawText);
			} catch {
				const entry = {
					timestamp: (/* @__PURE__ */ new Date()).toISOString(),
					direction: "response",
					method,
					path,
					status: response.status,
					duration_ms: Math.round(duration * 10) / 10,
					ok: false,
					error_code: "UNKNOWN_ERROR",
					error_message: `HTTP ${response.status}: non-JSON response`,
					request_id: requestId,
					payload_size: rawText?.length,
					request_body_size: bodySize
				};
				this.logResponse(entry);
				return {
					ok: false,
					error: {
						code: "UNKNOWN_ERROR",
						message: `HTTP ${response.status}: non-JSON response`
					}
				};
			}
			if (!response.ok) {
				const errorObj = json.error ?? {
					code: "UNKNOWN_ERROR",
					message: `HTTP ${response.status}`
				};
				const entry = {
					timestamp: (/* @__PURE__ */ new Date()).toISOString(),
					direction: "response",
					method,
					path,
					status: response.status,
					duration_ms: Math.round(duration * 10) / 10,
					ok: false,
					error_code: errorObj.code,
					error_message: errorObj.message,
					request_id: requestId,
					payload_size: rawText?.length,
					request_body_size: bodySize,
					...this.debug.logPayloads ? {
						request_body: body,
						response_body: rawText && rawText.length <= 10240 ? json : void 0
					} : {}
				};
				this.logResponse(entry);
				return {
					ok: false,
					error: errorObj
				};
			}
			const entry = {
				timestamp: (/* @__PURE__ */ new Date()).toISOString(),
				direction: "response",
				method,
				path,
				status: response.status,
				duration_ms: Math.round(duration * 10) / 10,
				ok: true,
				request_id: requestId,
				payload_size: rawText?.length,
				request_body_size: bodySize,
				...this.debug.logPayloads ? {
					request_body: body,
					response_body: rawText && rawText.length <= 10240 ? json : void 0
				} : {}
			};
			this.logResponse(entry);
			return {
				ok: true,
				data: json.data
			};
		} catch (err) {
			const duration = performance.now() - start;
			const entry = {
				timestamp: (/* @__PURE__ */ new Date()).toISOString(),
				direction: "error",
				method,
				path,
				duration_ms: Math.round(duration * 10) / 10,
				ok: false,
				error_code: "NETWORK_ERROR",
				error_message: String(err),
				request_body_size: bodySize
			};
			if (this.debug.enabled && this.debug.logToConsole) console.debug(`[forge:sdk] ✗ ${method} ${path} NETWORK_ERROR (${(entry.error_message ?? "").slice(0, 80)})`);
			this.debug.push(entry);
			return {
				ok: false,
				error: {
					code: "NETWORK_ERROR",
					message: String(err)
				}
			};
		}
	}
	/**
	* List / paginated request.
	*
	* Serializes `params` as a query string appended to `path`, then unwraps
	* the `{ data, pagination }` envelope. Logs request/response to debug store.
	*/
	async requestList(method, path, params) {
		const start = performance.now();
		if (this.debug.enabled && this.debug.logToConsole) {
			const qs = params && Object.keys(params).length > 0 ? `?${new URLSearchParams(params).toString()}` : "";
			console.debug(`[forge:sdk] → ${method} ${path}${qs}`);
		}
		try {
			let url = `${this.baseUrl}${path}`;
			if (params && Object.keys(params).length > 0) {
				const qs = new URLSearchParams(params).toString();
				url += `?${qs}`;
			}
			const response = await fetch(url, { method });
			const duration = performance.now() - start;
			const requestId = response.headers.get("X-Request-Id") ?? void 0;
			let json;
			let rawText;
			try {
				rawText = await response.text();
				json = JSON.parse(rawText);
			} catch {
				const entry = {
					timestamp: (/* @__PURE__ */ new Date()).toISOString(),
					direction: "response",
					method,
					path,
					status: response.status,
					duration_ms: Math.round(duration * 10) / 10,
					ok: false,
					error_code: "UNKNOWN_ERROR",
					error_message: `HTTP ${response.status}: non-JSON response`,
					request_id: requestId,
					payload_size: rawText?.length
				};
				this.logResponse(entry);
				return {
					ok: false,
					error: {
						code: "UNKNOWN_ERROR",
						message: `HTTP ${response.status}: non-JSON response`
					}
				};
			}
			if (!response.ok) {
				const errorObj = json.error ?? {
					code: "UNKNOWN_ERROR",
					message: `HTTP ${response.status}`
				};
				const entry = {
					timestamp: (/* @__PURE__ */ new Date()).toISOString(),
					direction: "response",
					method,
					path,
					status: response.status,
					duration_ms: Math.round(duration * 10) / 10,
					ok: false,
					error_code: errorObj.code,
					error_message: errorObj.message,
					request_id: requestId,
					payload_size: rawText?.length
				};
				this.logResponse(entry);
				return {
					ok: false,
					error: errorObj
				};
			}
			const pagination = json.pagination;
			const entry = {
				timestamp: (/* @__PURE__ */ new Date()).toISOString(),
				direction: "response",
				method,
				path,
				status: response.status,
				duration_ms: Math.round(duration * 10) / 10,
				ok: true,
				request_id: requestId,
				payload_size: rawText?.length,
				pagination_total: pagination?.total,
				pagination_offset: pagination?.offset,
				pagination_limit: pagination?.limit
			};
			this.logResponse(entry);
			return {
				ok: true,
				data: json.data,
				pagination
			};
		} catch (err) {
			const duration = performance.now() - start;
			const entry = {
				timestamp: (/* @__PURE__ */ new Date()).toISOString(),
				direction: "error",
				method,
				path,
				duration_ms: Math.round(duration * 10) / 10,
				ok: false,
				error_code: "NETWORK_ERROR",
				error_message: String(err)
			};
			if (this.debug.enabled && this.debug.logToConsole) console.debug(`[forge:sdk] ✗ ${method} ${path} NETWORK_ERROR (${String(err).slice(0, 80)})`);
			this.debug.push(entry);
			return {
				ok: false,
				error: {
					code: "NETWORK_ERROR",
					message: String(err)
				}
			};
		}
	}
	/** Log a response entry to console.debug and push to the debug store. */
	logResponse(entry) {
		if (this.debug.enabled && this.debug.logToConsole) {
			const status = entry.ok ? "ok" : `ERROR ${entry.error_code}`;
			const rid = entry.request_id ? ` [${entry.request_id}]` : "";
			console.debug(`[forge:sdk] ← ${entry.method} ${entry.path} ${entry.status} ${entry.duration_ms}ms${rid} ${status}`);
		}
		this.debug.push(entry);
	}
};
//#endregion
//#region src/lib/sdk.ts
var forge = new ForgeClient({
	baseUrl: "",
	debug: true
});
if (typeof window !== "undefined" && isDevMode()) window.forge = forge;
/**
* Convert an API error to a user-friendly message.
* Detects when the API server is unreachable and shows a helpful hint.
*/
function friendlyError(error, fallback) {
	if (error.code === "NETWORK_ERROR" || error.code === "UNKNOWN_ERROR" && (error.message.includes("non-JSON") || error.message.includes("502"))) return "Cannot connect to the Forge API server. Start it with: just api";
	return fallback ? `${fallback}: ${error.message}` : error.message;
}
//#endregion
export { friendlyError as n, isDevMode as r, forge as t };
