/** A single navigation link (no children). */
export interface NavItem {
  href: string
  label: string
}

/** A collapsible group of navigation links. */
export interface NavGroup {
  label: string
  prefix: string
  children: NavItem[]
}

/** A top-level navigation entry: either a standalone link or a group. */
export type NavEntry = NavItem | NavGroup

/** Type guard: returns true if the entry is a NavGroup (has children). */
export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry
}

export const navigation: NavEntry[] = [
  { href: '/', label: 'Dashboard' },
  {
    label: 'Experience',
    prefix: '/experience',
    children: [
      { href: '/experience/roles', label: 'Roles' },
      { href: '/experience/projects', label: 'Projects' },
      { href: '/experience/education', label: 'Education' },
      { href: '/experience/general', label: 'General' },
    ],
  },
  {
    label: 'Qualifications',
    prefix: '/qualifications',
    children: [
      { href: '/qualifications/credentials', label: 'Credentials' },
      { href: '/qualifications/certifications', label: 'Certifications' },
    ],
  },
  {
    label: 'Data',
    prefix: '/data',
    children: [
      { href: '/data/bullets', label: 'Bullets' },
      { href: '/data/skills', label: 'Skills' },
      { href: '/data/contacts', label: 'Contacts' },
      { href: '/data/organizations', label: 'Organizations' },
      { href: '/data/domains', label: 'Domains' },
      { href: '/data/notes', label: 'Notes' },
    ],
  },
  {
    label: 'Opportunities',
    prefix: '/opportunities',
    children: [
      { href: '/opportunities/organizations', label: 'Organizations' },
      { href: '/opportunities/job-descriptions', label: 'Job Descriptions' },
    ],
  },
  {
    label: 'Resumes',
    prefix: '/resumes',
    children: [
      { href: '/resumes', label: 'Builder' },
      { href: '/resumes/summaries', label: 'Summaries' },
      { href: '/resumes/templates', label: 'Templates' },
    ],
  },
  // Config nav group removed — all config access through profile menu
]
