import { redirect } from "@sveltejs/kit";
//#region src/routes/notes/+page.ts
var load = () => {
	throw redirect(302, "/data/notes");
};
//#endregion
export { load };
