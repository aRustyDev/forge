import { C as escape_html, S as attr, a as ensure_array_like, t as attr_class } from "../../chunks/server.js";
import { t as page } from "../../chunks/state.js";
import { a as ToastContainer } from "../../chunks/components.js";
import { t as ChainViewModal } from "../../chunks/ChainViewModal.js";
import { n as closeChainView, t as chainViewState } from "../../chunks/chain-view.svelte.js";
function init() {}
init();
//#endregion
//#region src/lib/nav.ts
/** Type guard: returns true if the entry is a NavGroup (has children). */
function isNavGroup(entry) {
	return "children" in entry;
}
var navigation = [
	{
		href: "/",
		label: "Dashboard"
	},
	{
		label: "Experience",
		prefix: "/experience",
		children: [
			{
				href: "/experience/roles",
				label: "Roles"
			},
			{
				href: "/experience/projects",
				label: "Projects"
			},
			{
				href: "/experience/education",
				label: "Education"
			},
			{
				href: "/experience/clearances",
				label: "Clearances"
			},
			{
				href: "/experience/general",
				label: "General"
			}
		]
	},
	{
		label: "Data",
		prefix: "/data",
		children: [
			{
				href: "/data/bullets",
				label: "Bullets"
			},
			{
				href: "/data/skills",
				label: "Skills"
			},
			{
				href: "/data/contacts",
				label: "Contacts"
			},
			{
				href: "/data/organizations",
				label: "Organizations"
			},
			{
				href: "/data/domains",
				label: "Domains"
			},
			{
				href: "/data/notes",
				label: "Notes"
			}
		]
	},
	{
		label: "Opportunities",
		prefix: "/opportunities",
		children: [{
			href: "/opportunities/organizations",
			label: "Organizations"
		}, {
			href: "/opportunities/job-descriptions",
			label: "Job Descriptions"
		}]
	},
	{
		label: "Resumes",
		prefix: "/resumes",
		children: [
			{
				href: "/resumes",
				label: "Builder"
			},
			{
				href: "/resumes/summaries",
				label: "Summaries"
			},
			{
				href: "/resumes/templates",
				label: "Templates"
			}
		]
	},
	{
		label: "Config",
		prefix: "/config",
		children: [
			{
				href: "/config/profile",
				label: "Profile"
			},
			{
				href: "/config/export",
				label: "Export"
			},
			{
				href: "/config/debug",
				label: "Debug (Logs)"
			}
		]
	}
];
//#endregion
//#region src/routes/+layout.svelte
function _layout($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { children } = $$props;
		let expanded = {};
		function isActive(href) {
			if (href === "/" || href === "/resumes") return page.url.pathname === href;
			return page.url.pathname.startsWith(href);
		}
		function isGroupActive(group) {
			return page.url.pathname.startsWith(group.prefix);
		}
		$$renderer.push(`<div class="app svelte-12qhfyh"><nav class="sidebar svelte-12qhfyh"><div class="logo svelte-12qhfyh"><h2 class="svelte-12qhfyh">Forge</h2></div> <ul class="nav-list svelte-12qhfyh"><!--[-->`);
		const each_array = ensure_array_like(navigation);
		for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
			let entry = each_array[$$index_1];
			if (isNavGroup(entry)) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<li class="nav-group svelte-12qhfyh"><button${attr_class("group-label svelte-12qhfyh", void 0, { "group-active": isGroupActive(entry) })}><span>${escape_html(entry.label)}</span> <span${attr_class("chevron svelte-12qhfyh", void 0, { "open": expanded[entry.prefix] })}>▸</span></button> `);
				if (expanded[entry.prefix]) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<ul class="group-children svelte-12qhfyh"><!--[-->`);
					const each_array_1 = ensure_array_like(entry.children);
					for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
						let child = each_array_1[$$index];
						$$renderer.push(`<li class="svelte-12qhfyh"><a${attr("href", child.href)}${attr_class("svelte-12qhfyh", void 0, { "active": isActive(child.href) })}>${escape_html(child.label)}</a></li>`);
					}
					$$renderer.push(`<!--]--></ul>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></li>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<li><a${attr("href", entry.href)}${attr_class("top-link svelte-12qhfyh", void 0, { "active": isActive(entry.href) })}>${escape_html(entry.label)}</a></li>`);
			}
			$$renderer.push(`<!--]-->`);
		}
		$$renderer.push(`<!--]--></ul></nav> <main class="content svelte-12qhfyh">`);
		children($$renderer);
		$$renderer.push(`<!----></main></div> `);
		ToastContainer($$renderer, {});
		$$renderer.push(`<!----> `);
		if (chainViewState.isOpen) {
			$$renderer.push("<!--[0-->");
			ChainViewModal($$renderer, {
				highlightNode: chainViewState.highlightNode,
				isModal: true,
				onClose: closeChainView
			});
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
export { _layout as default };
