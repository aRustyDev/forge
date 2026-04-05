import { redirect } from "@sveltejs/kit";
//#region src/routes/logs/+page.ts
var load = () => {
	throw redirect(302, "/config/debug");
};
//#endregion
export { load };
