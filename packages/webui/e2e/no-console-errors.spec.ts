import { test, expect } from '@playwright/test'

const PAGES_TO_CHECK = [
  '/',
  '/resumes',
  '/resumes/summaries',
  '/data/notes',
  '/data/contacts',
  '/data/organizations',
  '/data/bullets',
  '/data/domains',
  '/opportunities/job-descriptions',
  '/experience/roles',
  '/config/profile',
]

test.describe('No Console Errors', () => {
  for (const path of PAGES_TO_CHECK) {
    test(`${path}: no Svelte errors on load`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('Svelte')) {
          errors.push(msg.text())
        }
      })

      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      expect(errors).toEqual([])
    })
  }
})
