import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('pending cards link to correct tabs', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check if pending cards exist (they only show when there are pending items)
    const pendingCards = page.locator('.pending-card')
    const count = await pendingCards.count()

    if (count >= 2) {
      // First card should link to bullets
      const firstHref = await pendingCards.nth(0).getAttribute('href')
      expect(firstHref).toContain('tab=bullets')

      // Second card should link to perspectives
      const secondHref = await pendingCards.nth(1).getAttribute('href')
      expect(secondHref).toContain('tab=perspectives')
    }
  })
})
