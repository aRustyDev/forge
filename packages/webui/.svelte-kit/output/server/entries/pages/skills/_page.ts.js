import { redirect } from "@sveltejs/kit";
//#region src/routes/skills/+page.ts
var load = () => {
	throw redirect(302, "/data/skills");
};
//#endregion
export { load };
