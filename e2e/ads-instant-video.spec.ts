import { test, expect } from '@playwright/test'

// Needs an ads project that has been generated at least once.
const PROJECT = process.env.E2E_ADS_PROJECT_ID

test.skip(!PROJECT, 'Set E2E_ADS_PROJECT_ID to a generated ads project')

for (const width of [1440, 1180, 1024]) {
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
    await expect(card.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
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

    // The music select's text isn't clipped either: scrollWidth can't see clipping inside a
    // native <select>, so measure the selected option's rendered width with a canvas instead.
    if (width !== 1440) {
      const musicSelect = card.getByLabel('Music track')
      await musicSelect.selectOption('suspenseful') // longest track label: worst case
      const fit = await musicSelect.evaluate((el: HTMLSelectElement) => {
        const style = getComputedStyle(el)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        const label = el.options[el.selectedIndex].text
        return { textWidth: ctx.measureText(label).width, clientWidth: el.clientWidth }
      })
      expect(fit.textWidth).toBeLessThanOrEqual(fit.clientWidth - 32)
    }
  })
}

test('stacks the mobile editor in the brief order at 390px: hook, music, format, colours', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1600 })
  await page.goto(`/ads/${PROJECT}/results`)
  const card = page.getByRole('region', { name: 'Instant Video' })
  await expect(card).toBeVisible()

  const top = async (locator: ReturnType<typeof card.getByLabel>) => {
    const box = await locator.boundingBox()
    if (!box) throw new Error('Element has no box (not visible)')
    return box.y
  }

  const hookTop = await top(card.getByLabel('Hook'))
  const musicTop = await top(card.getByLabel('Music track'))
  const formatTop = await top(card.getByLabel('Format'))
  const coloursTop = await top(card.locator('legend', { hasText: 'Colours' }))

  expect(hookTop).toBeLessThan(musicTop)
  expect(musicTop).toBeLessThan(formatTop)
  expect(formatTop).toBeLessThan(coloursTop)
})
