import { test, expect } from '@playwright/test'

// Needs an ads project that has been generated at least once.
const PROJECT = process.env.E2E_ADS_PROJECT_ID

test.skip(!PROJECT, 'Set E2E_ADS_PROJECT_ID to a generated ads project')

for (const width of [1440, 1024]) {
  test(`results page fits at ${width}px and the hook edits the preview`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/ads/${PROJECT}/results`)
    const card = page.getByRole('region', { name: 'Instant Video' })
    await expect(card).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    const hook = card.getByLabel('Hook')
    await hook.fill('A brand new hook line')
    await card.getByRole('button', { name: '1. Hook' }).click()
    // Input values are not text content, so this only matches the player's frame.
    await expect(card).toContainText('A brand new hook line')
    await expect(card.getByRole('button', { name: 'Save' })).toBeEnabled()
    await expect(page.getByText(/remotion|hyperframe/i)).toHaveCount(0)

    // Nothing in the card is clipped: every button/input's content fits its box.
    const clipped = await card.evaluate((root) =>
      [...root.querySelectorAll('button, input:not([type="color"]):not([type="file"]), select')]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => (el as HTMLElement).innerText || (el as HTMLInputElement).value)
    )
    expect(clipped).toEqual([])

    // The two columns are balanced: the empty space under the shorter column is small.
    const columns = card.locator('[data-column]')
    await expect(columns).toHaveCount(2)
    if (width >= 1024) {
      const [a, b] = await columns.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
      expect(Math.min(a, b) / Math.max(a, b)).toBeGreaterThan(0.6)
    }
  })
}
