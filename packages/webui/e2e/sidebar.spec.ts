import { test, expect } from '@playwright/test'

test.describe('Sidebar', () => {
  test('sidebar remains visible when scrolling content', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('.sidebar')
    await expect(sidebar).toBeVisible()

    // Scroll the content area
    await page.locator('.content').evaluate(el => el.scrollTop = 500)
    await page.waitForTimeout(200)

    // Sidebar should still be visible
    await expect(sidebar).toBeVisible()

    // Sidebar should be at top of viewport
    const box = await sidebar.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeLessThanOrEqual(10) // Near top of viewport
  })
})
