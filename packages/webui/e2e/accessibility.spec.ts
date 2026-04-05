import { test, expect } from '@playwright/test'

test.describe('Accessibility', () => {
  test('ViewToggle has radiogroup role', async ({ page }) => {
    await page.goto('/resumes')
    await page.waitForLoadState('networkidle')

    const toggle = page.locator('[role="radiogroup"]')
    await expect(toggle).toBeVisible()

    const radios = toggle.locator('[role="radio"]')
    expect(await radios.count()).toBeGreaterThanOrEqual(2)
  })

  test('TabBar uses div with tablist (not nav)', async ({ page }) => {
    await page.goto('/data/domains')
    await page.waitForLoadState('networkidle')

    const tablist = page.locator('[role="tablist"]')
    await expect(tablist).toBeVisible()

    // Should be a div, not a nav
    const tagName = await tablist.evaluate(el => el.tagName.toLowerCase())
    expect(tagName).toBe('div')

    // Tabs should have role="tab"
    const tabs = tablist.locator('[role="tab"]')
    expect(await tabs.count()).toBeGreaterThanOrEqual(2)
  })

  test('Kanban columns have list/listitem roles', async ({ page }) => {
    await page.goto('/opportunities/job-descriptions')
    await page.waitForLoadState('networkidle')

    // Switch to board view if not already
    const boardBtn = page.locator('[role="radio"][aria-checked="false"]').first()
    if (await boardBtn.isVisible()) {
      await boardBtn.click()
    }

    await page.waitForTimeout(500)

    // Column bodies should have role="list"
    const lists = page.locator('[role="list"]')
    expect(await lists.count()).toBeGreaterThan(0)
  })
})
