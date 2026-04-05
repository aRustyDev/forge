import { redirect } from "@sveltejs/kit";
//#region src/routes/data/summaries/+page.ts
var load = () => {
	throw redirect(302, "/resumes/summaries");
};
//#endregion
export { load };
