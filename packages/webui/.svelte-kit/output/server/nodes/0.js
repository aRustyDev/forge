

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "ssr": false,
  "prerender": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.DT13eTSe.js","_app/immutable/chunks/Cq6YUewX.js","_app/immutable/chunks/BvXrL4_q.js","_app/immutable/chunks/Ba95JMqc.js","_app/immutable/chunks/Bxt2mmH1.js","_app/immutable/chunks/Bs0T3UKK.js","_app/immutable/chunks/BEq8CB3B.js","_app/immutable/chunks/B5WQhdW8.js","_app/immutable/chunks/C2cQQkP1.js","_app/immutable/chunks/idVUOa82.js","_app/immutable/chunks/Bx2KRlK0.js","_app/immutable/chunks/CENc9Ayl.js","_app/immutable/chunks/CR6aXpG_.js","_app/immutable/chunks/BWI-ioKV.js"];
export const stylesheets = ["_app/immutable/assets/components.ChQNuYmK.css","_app/immutable/assets/ChainViewModal.C8m8Qanr.css","_app/immutable/assets/0.vchftYx6.css"];
export const fonts = [];
