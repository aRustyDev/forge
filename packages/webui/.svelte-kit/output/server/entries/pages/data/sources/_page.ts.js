import { redirect } from "@sveltejs/kit";
//#region src/routes/data/sources/+page.ts
var load = () => {
	throw redirect(302, "/experience/roles");
};
//#endregion
export { load };
