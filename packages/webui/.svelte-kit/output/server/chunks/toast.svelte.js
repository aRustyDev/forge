import "./server.js";
//#region src/lib/stores/toast.svelte.ts
var toasts = [];
function addToast(opts) {
	const id = crypto.randomUUID();
	toasts.push({
		id,
		message: opts.message,
		type: opts.type ?? "info"
	});
	setTimeout(() => removeToast(id), opts.duration ?? 4e3);
}
function removeToast(id) {
	toasts = toasts.filter((t) => t.id !== id);
}
function getToasts() {
	return toasts;
}
//#endregion
export { getToasts as n, removeToast as r, addToast as t };
