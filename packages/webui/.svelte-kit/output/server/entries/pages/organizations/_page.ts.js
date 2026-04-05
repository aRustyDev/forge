import { redirect } from "@sveltejs/kit";
//#region src/routes/organizations/+page.ts
var load = () => {
	throw redirect(302, "/opportunities/organizations");
};
//#endregion
export { load };
