import { redirect } from "@sveltejs/kit";
//#region src/routes/config/templates/+page.ts
var load = () => {
	throw redirect(302, "/resumes/templates");
};
//#endregion
export { load };
