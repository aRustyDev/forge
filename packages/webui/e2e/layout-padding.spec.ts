import { test, expect } from '@playwright/test'

const FLOW_PAGES = [
  { path: '/', name: 'Dashboard' },
  { path: '/resumes', name: 'Resumes' },
  { path: '/resumes/summaries', name: 'Summaries' },
  { path: '/resumes/templates', name: 'Templates' },
  { path: '/data/domains', name: 'Domains' },
  { path: '/data/bullets', name: 'Bullets' },
  { path: '/experience/roles', name: 'Roles' },
]

const APP_PAGES = [
  { path: '/data/notes', name: 'Notes' },
  { path: '/data/contacts', name: 'Contacts' },
  { path: '/data/organizations', name: 'Organizations' },
  { path: '/opportunities/job-descriptions', name: 'Job Descriptions' },
]

test.describe('Layout Padding Consistency', () => {
  for (const page of FLOW_PAGES) {
    test(`FlowPage ${page.name}: has .content padding`, async ({ page: p }) => {
      await p.goto(page.path)
      await p.waitForLoadState('networkidle')
      const padding = await p.locator('.content').evaluate(el =>
        getComputedStyle(el).paddingLeft
      )
      // .content should have padding (from --content-padding token)
      expect(parseInt(padding)).toBeGreaterThan(0)
    })
  }

  for (const page of APP_PAGES) {
    test(`AppPage ${page.name}: uses PageWrapper (edge-to-edge)`, async ({ page: p }) => {
      await p.goto(page.path)
      await p.waitForLoadState('networkidle')
      // PageWrapper cancels the content padding with negative margin
      const wrapper = p.locator('.page-wrapper')
      await expect(wrapper).toBeVisible()
    })
  }
})
