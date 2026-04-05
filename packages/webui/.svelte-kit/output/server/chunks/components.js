import { C as escape_html, a as ensure_array_like, i as derived, n as attr_style, t as attr_class } from "./server.js";
import { n as getToasts, r as removeToast } from "./toast.svelte.js";
//#region src/lib/components/Toast.svelte
function Toast($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { message, type = "info", duration = 4e3, onclose } = $$props;
		let visible = false;
		const colorMap = {
			success: "var(--color-success)",
			error: "var(--color-danger)",
			info: "var(--color-info)"
		};
		$$renderer.push(`<div${attr_class("toast svelte-1cpok13", void 0, { "visible": visible })} role="alert"${attr_style("", { background: colorMap[type] })}><span class="message svelte-1cpok13">${escape_html(message)}</span> <button class="close svelte-1cpok13" aria-label="Dismiss notification">×</button></div>`);
	});
}
//#endregion
//#region src/lib/components/ToastContainer.svelte
function ToastContainer($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let toasts = derived(getToasts);
		$$renderer.push(`<div class="toast-container svelte-cqwvc2" aria-live="polite"><!--[-->`);
		const each_array = ensure_array_like(toasts());
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let toast = each_array[$$index];
			Toast($$renderer, {
				message: toast.message,
				type: toast.type,
				onclose: () => removeToast(toast.id)
			});
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/StatusBadge.svelte
function StatusBadge($$renderer, $$props) {
	let { status } = $$props;
	const colorMap = {
		draft: "var(--text-muted)",
		approved: "var(--color-success)",
		in_review: "var(--color-warning)",
		rejected: "var(--color-danger)",
		deriving: "var(--color-info)",
		archived: "var(--text-faint)",
		interested: "var(--text-muted)",
		analyzing: "var(--color-info)",
		applied: "#6366f1",
		interviewing: "#a855f7",
		offered: "var(--color-success)",
		withdrawn: "#f97316",
		closed: "#374151"
	};
	const labelMap = {
		draft: "Draft",
		approved: "Approved",
		in_review: "In Review",
		rejected: "Rejected",
		deriving: "Deriving",
		archived: "Archived",
		interested: "Interested",
		analyzing: "Analyzing",
		applied: "Applied",
		interviewing: "Interviewing",
		offered: "Offered",
		withdrawn: "Withdrawn",
		closed: "Closed"
	};
	let color = derived(() => colorMap[status] ?? "var(--text-muted)");
	let label = derived(() => labelMap[status] ?? status);
	let pulsing = derived(() => status === "deriving");
	$$renderer.push(`<span${attr_class("badge svelte-12nqn7t", void 0, { "pulsing": pulsing() })}${attr_style("", { background: color() })}>${escape_html(label())}</span>`);
}
//#endregion
//#region src/lib/components/LoadingSpinner.svelte
function LoadingSpinner($$renderer, $$props) {
	let { size = "md", message } = $$props;
	const sizeMap = {
		sm: "16px",
		md: "24px",
		lg: "32px"
	};
	let dimension = derived(() => sizeMap[size] ?? sizeMap.md);
	$$renderer.push(`<div class="spinner-wrapper svelte-ds7hcv"><div class="spinner svelte-ds7hcv" role="status" aria-label="Loading"${attr_style("", {
		width: dimension(),
		height: dimension()
	})}></div> `);
	if (message) {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<p class="message svelte-ds7hcv">${escape_html(message)}</p>`);
	} else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></div>`);
}
//#endregion
//#region src/lib/components/EmptyState.svelte
function EmptyState($$renderer, $$props) {
	let { title, description, action, onaction } = $$props;
	$$renderer.push(`<div class="empty-state svelte-13862ru"><h3 class="title svelte-13862ru">${escape_html(title)}</h3> <p class="description svelte-13862ru">${escape_html(description)}</p> `);
	if (action && onaction) {
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<button class="btn btn-primary">${escape_html(action)}</button>`);
	} else $$renderer.push("<!--[-1-->");
	$$renderer.push(`<!--]--></div>`);
}
//#endregion
//#region src/lib/components/ConfirmDialog.svelte
function ConfirmDialog($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { open, title, message, confirmLabel = "Delete", cancelLabel = "Cancel", onconfirm, oncancel, destructive = true } = $$props;
		if (open) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="modal-overlay" role="presentation"><div class="modal-dialog modal-dialog--confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message"><h3 id="confirm-title" class="dialog-title svelte-7e0w24">${escape_html(title)}</h3> <p id="confirm-message" class="dialog-message svelte-7e0w24">${escape_html(message)}</p> <div class="form-actions" style="justify-content: flex-end;"><button class="btn btn-ghost">${escape_html(cancelLabel)}</button> <button${attr_class("btn", void 0, {
				"btn-danger": destructive,
				"btn-primary": !destructive
			})}>${escape_html(confirmLabel)}</button></div></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
export { ToastContainer as a, StatusBadge as i, EmptyState as n, LoadingSpinner as r, ConfirmDialog as t };
