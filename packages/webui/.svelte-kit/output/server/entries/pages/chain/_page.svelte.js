import "../../../chunks/server.js";
import { t as ChainViewModal } from "../../../chunks/ChainViewModal.js";
//#region src/routes/chain/+page.svelte
function _page($$renderer) {
	$$renderer.push(`<div class="chain-page svelte-o98i4a"><h1 class="page-title svelte-o98i4a">Chain View</h1> <p class="page-description svelte-o98i4a">Interactive provenance graph: Source → Bullet → Perspective</p> `);
	ChainViewModal($$renderer, { isModal: false });
	$$renderer.push(`<!----></div>`);
}
//#endregion
export { _page as default };
