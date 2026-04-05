import { redirect } from "@sveltejs/kit";
//#region src/routes/domains/+page.ts
var load = () => {
	throw redirect(302, "/data/domains");
};
//#endregion
export { load };
