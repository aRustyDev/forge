import { redirect } from "@sveltejs/kit";
//#region src/routes/derivation/+page.ts
var load = () => {
	throw redirect(302, "/chain");
};
//#endregion
export { load };
