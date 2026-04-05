import { C as escape_html, S as attr, a as ensure_array_like, c as stringify, i as derived, t as attr_class } from "../../../../chunks/server.js";
import { r as LoadingSpinner, t as ConfirmDialog } from "../../../../chunks/components.js";
import { t as addToast } from "../../../../chunks/toast.svelte.js";
import { t as forge } from "../../../../chunks/sdk.js";
//#region src/routes/data/notes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let notes = [];
		let selectedId = null;
		let searchQuery = "";
		let editing = false;
		let saving = false;
		let confirmDeleteOpen = false;
		let formTitle = "";
		let formContent = "";
		derived(() => {
			if (!searchQuery.trim()) return notes;
			const q = searchQuery.toLowerCase();
			return notes.filter((n) => n.content.toLowerCase().includes(q) || n.title && n.title.toLowerCase().includes(q));
		});
		let selectedNote = derived(() => notes.find((n) => n.id === selectedId) ?? null);
		async function deleteNote() {
			if (!selectedId) return;
			confirmDeleteOpen = false;
			const id = selectedId;
			const result = await forge.notes.delete(id);
			if (result.ok) {
				notes = notes.filter((n) => n.id !== id);
				selectedId = null;
				editing = false;
				addToast({
					message: "Note deleted.",
					type: "success"
				});
			} else addToast({
				message: `Failed to delete note: ${result.error.message}`,
				type: "error"
			});
		}
		$$renderer.push(`<div class="notes-page svelte-q6e4dz"><div class="list-panel svelte-q6e4dz"><div class="list-header svelte-q6e4dz"><h2 class="svelte-q6e4dz">Notes</h2> <button class="btn-new svelte-q6e4dz">+ New</button></div> <div class="filter-bar svelte-q6e4dz"><input type="text" class="search-input svelte-q6e4dz" placeholder="Search notes..."${attr("value", searchQuery)}/></div> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="list-loading svelte-q6e4dz">`);
		LoadingSpinner($$renderer, {
			size: "md",
			message: "Loading notes..."
		});
		$$renderer.push(`<!----></div>`);
		$$renderer.push(`<!--]--></div> <div class="editor-panel svelte-q6e4dz">`);
		if (!selectedNote() && !editing) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="editor-empty svelte-q6e4dz"><p>Select a note or create a new one.</p></div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="editor-content svelte-q6e4dz"><h3 class="editor-heading svelte-q6e4dz">${escape_html(editing ? "New Note" : "Edit Note")}</h3> <div class="form-group svelte-q6e4dz"><label for="note-title" class="svelte-q6e4dz">Title</label> <input id="note-title" type="text"${attr("value", formTitle)} placeholder="Optional title" class="svelte-q6e4dz"/></div> <div class="form-group svelte-q6e4dz"><label for="note-content" class="svelte-q6e4dz">Content <span class="required svelte-q6e4dz">*</span></label> <textarea id="note-content" rows="10" placeholder="Write your note..." class="svelte-q6e4dz">`);
			const $$body = escape_html(formContent);
			if ($$body) $$renderer.push(`${$$body}`);
			$$renderer.push(`</textarea></div> `);
			if (selectedNote()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="references-section svelte-q6e4dz"><h4 class="svelte-q6e4dz">Linked Entities</h4> `);
				if (!selectedNote().references || selectedNote().references.length === 0) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<p class="no-refs svelte-q6e4dz">No linked entities.</p>`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`<div class="ref-list svelte-q6e4dz"><!--[-->`);
					const each_array_2 = ensure_array_like(selectedNote().references);
					for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
						let ref = each_array_2[$$index_2];
						$$renderer.push(`<div class="ref-item svelte-q6e4dz"><span${attr_class(`ref-tag ref-${stringify(ref.entity_type)}`, "svelte-q6e4dz")}>${escape_html(ref.entity_type)}</span> <span class="ref-id svelte-q6e4dz">${escape_html(ref.entity_id.slice(0, 8))}...</span> <button class="btn btn-sm btn-danger svelte-q6e4dz">Unlink</button></div>`);
					}
					$$renderer.push(`<!--]--></div>`);
				}
				$$renderer.push(`<!--]--> `);
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<button class="btn btn-sm btn-add svelte-q6e4dz">+ Link Entity</button>`);
				$$renderer.push(`<!--]--></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="editor-actions svelte-q6e4dz"><button class="btn btn-save svelte-q6e4dz"${attr("disabled", saving, true)}>`);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`${escape_html(editing ? "Create" : "Save")}`);
			$$renderer.push(`<!--]--></button> `);
			if (!editing && selectedNote()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<button class="btn btn-delete svelte-q6e4dz">Delete</button>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div></div>`);
		}
		$$renderer.push(`<!--]--></div></div> `);
		ConfirmDialog($$renderer, {
			open: confirmDeleteOpen,
			title: "Delete Note",
			message: "Are you sure you want to delete this note? This action cannot be undone.",
			confirmLabel: "Delete",
			onconfirm: deleteNote,
			oncancel: () => confirmDeleteOpen = false,
			destructive: true
		});
		$$renderer.push(`<!---->`);
	});
}
//#endregion
export { _page as default };
