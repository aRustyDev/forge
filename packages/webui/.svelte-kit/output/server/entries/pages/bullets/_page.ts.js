import { redirect } from "@sveltejs/kit";
//#region src/routes/bullets/+page.ts
var load = () => {
	throw redirect(302, "/data/bullets");
};
//#endregion
export { load };
