import { redirect } from "@sveltejs/kit";
//#region src/routes/archetypes/+page.ts
var load = () => {
	throw redirect(302, "/data/domains?tab=archetypes");
};
//#endregion
export { load };
