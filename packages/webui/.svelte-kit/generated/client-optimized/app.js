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
	() => import('./nodes/35')
];

export const server_loads = [];

export const dictionary = {
		"/": [3],
		"/archetypes": [4],
		"/bullets": [5],
		"/chain": [6],
		"/config/debug": [7,[2]],
		"/config/export": [8,[2]],
		"/config/profile": [9,[2]],
		"/config/templates": [10,[2]],
		"/data/bullets": [11],
		"/data/contacts": [12],
		"/data/domains": [13],
		"/data/notes": [14],
		"/data/organizations": [15],
		"/data/skills": [16],
		"/data/sources": [17],
		"/data/summaries": [18],
		"/derivation": [19],
		"/domains": [20],
		"/experience/clearances": [21],
		"/experience/education": [22],
		"/experience/general": [23],
		"/experience/projects": [24],
		"/experience/roles": [25],
		"/logs": [26],
		"/notes": [27],
		"/opportunities/job-descriptions": [28],
		"/opportunities/organizations": [29],
		"/organizations": [30],
		"/resumes": [31],
		"/resumes/summaries": [32],
		"/resumes/templates": [33],
		"/skills": [34],
		"/sources": [35]
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