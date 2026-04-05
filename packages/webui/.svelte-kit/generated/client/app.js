export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21'),
	() => import('./nodes/22'),
	() => import('./nodes/23'),
	() => import('./nodes/24'),
	() => import('./nodes/25'),
	() => import('./nodes/26'),
	() => import('./nodes/27'),
	() => import('./nodes/28'),
	() => import('./nodes/29'),
	() => import('./nodes/30'),
	() => import('./nodes/31'),
	() => import('./nodes/32'),
	() => import('./nodes/33'),
	() => import('./nodes/34'),
	() => import('./nodes/35'),
	() => import('./nodes/36'),
	() => import('./nodes/37'),
	() => import('./nodes/38'),
	() => import('./nodes/39'),
	() => import('./nodes/40')
];

export const server_loads = [];

export const dictionary = {
		"/": [4],
		"/archetypes": [5],
		"/bullets": [6],
		"/chain": [7],
		"/config/debug": [8,[2,3]],
		"/config/debug/api": [9,[2,3]],
		"/config/debug/events": [10,[2,3]],
		"/config/debug/prompts": [11,[2,3]],
		"/config/debug/ui": [12,[2,3]],
		"/config/export": [13,[2]],
		"/config/profile": [14,[2]],
		"/config/templates": [15,[2]],
		"/data/bullets": [16],
		"/data/contacts": [17],
		"/data/domains": [18],
		"/data/notes": [19],
		"/data/organizations": [20],
		"/data/skills": [21],
		"/data/sources": [22],
		"/data/summaries": [23],
		"/derivation": [24],
		"/domains": [25],
		"/experience/clearances": [26],
		"/experience/education": [27],
		"/experience/general": [28],
		"/experience/projects": [29],
		"/experience/roles": [30],
		"/logs": [31],
		"/notes": [32],
		"/opportunities/job-descriptions": [33],
		"/opportunities/organizations": [34],
		"/organizations": [35],
		"/resumes": [36],
		"/resumes/summaries": [37],
		"/resumes/templates": [38],
		"/skills": [39],
		"/sources": [40]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';