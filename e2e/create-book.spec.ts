import { test, expect } from '@playwright/test'

// Each style card shows what the style looks like: a sample picture for picture
// books, a small real puzzle for puzzle books.
test('every book style shows a sample you can see before choosing it', async ({ page }) => {
  await page.goto('/create-book/new')
  const styles = page.getByRole('radiogroup', { name: 'Style' })

  for (const type of [/Children's Book/, /Coloring Book & Pages/, /Story Book/]) {
    await page.getByRole('button', { name: type }).click()
    const pictures = styles.getByRole('img')
    await expect(pictures.first()).toBeVisible()
    expect(await pictures.count()).toBe(await styles.getByRole('radio').count())
    for (const picture of await pictures.all()) {
      await expect(picture).toHaveJSProperty('complete', true)
      expect(await picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    }
  }

  await page.getByRole('button', { name: /Games & Puzzle Book/ }).click()
  await expect(styles.getByTestId('puzzle-sample')).toHaveCount(await styles.getByRole('radio').count())

  const second = styles.getByRole('radio').nth(1)
  await second.click()
  await expect(second).toHaveAttribute('aria-checked', 'true')
  await expect(styles.getByRole('radio').first()).toHaveAttribute('aria-checked', 'false')
})
