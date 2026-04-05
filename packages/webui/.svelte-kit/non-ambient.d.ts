
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/archetypes" | "/bullets" | "/chain" | "/config" | "/config/debug" | "/config/debug/api" | "/config/debug/events" | "/config/debug/prompts" | "/config/debug/ui" | "/config/export" | "/config/profile" | "/config/templates" | "/data" | "/data/bullets" | "/data/contacts" | "/data/domains" | "/data/notes" | "/data/organizations" | "/data/skills" | "/data/sources" | "/data/summaries" | "/derivation" | "/domains" | "/experience" | "/experience/clearances" | "/experience/education" | "/experience/general" | "/experience/projects" | "/experience/roles" | "/logs" | "/notes" | "/opportunities" | "/opportunities/job-descriptions" | "/opportunities/organizations" | "/organizations" | "/resumes" | "/resumes/summaries" | "/resumes/templates" | "/skills" | "/sources";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/archetypes": Record<string, never>;
			"/bullets": Record<string, never>;
			"/chain": Record<string, never>;
			"/config": Record<string, never>;
			"/config/debug": Record<string, never>;
			"/config/debug/api": Record<string, never>;
			"/config/debug/events": Record<string, never>;
			"/config/debug/prompts": Record<string, never>;
			"/config/debug/ui": Record<string, never>;
			"/config/export": Record<string, never>;
			"/config/profile": Record<string, never>;
			"/config/templates": Record<string, never>;
			"/data": Record<string, never>;
			"/data/bullets": Record<string, never>;
			"/data/contacts": Record<string, never>;
			"/data/domains": Record<string, never>;
			"/data/notes": Record<string, never>;
			"/data/organizations": Record<string, never>;
			"/data/skills": Record<string, never>;
			"/data/sources": Record<string, never>;
			"/data/summaries": Record<string, never>;
			"/derivation": Record<string, never>;
			"/domains": Record<string, never>;
			"/experience": Record<string, never>;
			"/experience/clearances": Record<string, never>;
			"/experience/education": Record<string, never>;
			"/experience/general": Record<string, never>;
			"/experience/projects": Record<string, never>;
			"/experience/roles": Record<string, never>;
			"/logs": Record<string, never>;
			"/notes": Record<string, never>;
			"/opportunities": Record<string, never>;
			"/opportunities/job-descriptions": Record<string, never>;
			"/opportunities/organizations": Record<string, never>;
			"/organizations": Record<string, never>;
			"/resumes": Record<string, never>;
			"/resumes/summaries": Record<string, never>;
			"/resumes/templates": Record<string, never>;
			"/skills": Record<string, never>;
			"/sources": Record<string, never>
		};
		Pathname(): "/" | "/archetypes" | "/bullets" | "/chain" | "/config/debug" | "/config/debug/api" | "/config/debug/events" | "/config/debug/prompts" | "/config/debug/ui" | "/config/export" | "/config/profile" | "/config/templates" | "/data/bullets" | "/data/contacts" | "/data/domains" | "/data/notes" | "/data/organizations" | "/data/skills" | "/data/sources" | "/data/summaries" | "/derivation" | "/domains" | "/experience/clearances" | "/experience/education" | "/experience/general" | "/experience/projects" | "/experience/roles" | "/logs" | "/notes" | "/opportunities/job-descriptions" | "/opportunities/organizations" | "/organizations" | "/resumes" | "/resumes/summaries" | "/resumes/templates" | "/skills" | "/sources";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.svg" | "/geo/us-states.json" | string & {};
	}
}