import { test, expect } from '@playwright/test'

test.describe('New Button Consistency', () => {
  const PAGES_WITH_NEW_BUTTON = [
    { path: '/data/notes', name: 'Notes' },
    { path: '/data/organizations', name: 'Organizations' },
    { path: '/data/contacts', name: 'Contacts' },
  ]

  for (const page of PAGES_WITH_NEW_BUTTON) {
    test(`${page.name}: "+ New" button is visible and uses primary color`, async ({ page: p }) => {
      await p.goto(page.path)
      await p.waitForLoadState('networkidle')

      const newBtn = p.locator('button:has-text("+ New")').first()
      await expect(newBtn).toBeVisible()

      // Should use --color-primary (not --color-info)
      const bgColor = await newBtn.evaluate(el => getComputedStyle(el).backgroundColor)
      // Just verify it's not the info blue (#3b82f6 / rgb(59, 130, 246))
      expect(bgColor).not.toContain('59, 130, 246')
    })
  }

  test('Notes: clicking "+ New" shows editor', async ({ page }) => {
    await page.goto('/data/notes')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("+ New")')
    // Editor panel should appear (no state_unsafe_mutation error)
    // Check that a textarea or input appears in the detail panel
    await expect(page.locator('.split-detail textarea, .split-detail input').first()).toBeVisible({ timeout: 3000 })
  })

  test('Contacts: clicking "+ New" shows editor', async ({ page }) => {
    await page.goto('/data/contacts')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("+ New")')
    // Editor should appear without state_unsafe_mutation
    await expect(page.locator('.split-detail input').first()).toBeVisible({ timeout: 3000 })
  })

  test('JD: clicking "+ New" shows editor (no state_unsafe_mutation)', async ({ page }) => {
    await page.goto('/opportunities/job-descriptions')
    await page.waitForLoadState('networkidle')

    // Listen for console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.click('button:has-text("+ New")')
    await page.waitForTimeout(1000)

    // Should NOT have state_unsafe_mutation error
    const hasMutationError = errors.some(e => e.includes('state_unsafe_mutation'))
    expect(hasMutationError).toBe(false)
  })

  test('Summaries: "+ New Summary" does NOT create DB record before save', async ({ page }) => {
    await page.goto('/resumes/summaries')
    await page.waitForLoadState('networkidle')

    // Count current summaries
    const countBefore = await page.locator('.summary-card, .padded-entry').count()

    // Click new
    await page.click('button:has-text("New")')
    await page.waitForTimeout(500)

    // Cancel without saving
    const cancelBtn = page.locator('button:has-text("Cancel")')
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click()
    } else {
      // Press Escape
      await page.keyboard.press('Escape')
    }

    // Reload and verify count didn't change
    await page.reload()
    await page.waitForLoadState('networkidle')
    const countAfter = await page.locator('.summary-card, .padded-entry').count()
    expect(countAfter).toBe(countBefore)
  })
})
