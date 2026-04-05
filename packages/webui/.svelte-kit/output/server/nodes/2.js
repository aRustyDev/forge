

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/config/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/2._6pSsxNo.js","_app/immutable/chunks/Bs0T3UKK.js","_app/immutable/chunks/Cq6YUewX.js","_app/immutable/chunks/idVUOa82.js"];
export const stylesheets = [];
export const fonts = [];
