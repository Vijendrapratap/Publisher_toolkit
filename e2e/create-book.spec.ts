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

test('picking a book type on the dashboard does not ask for it again', async ({ page }) => {
  await page.goto('/create-book')
  await page.getByRole('link', { name: /Coloring Book & Pages/ }).click()
  await expect(page).toHaveURL(/\/create-book\/new\?type=coloring$/)

  // The choice is kept and shown once, with a way to change it — not the four cards again.
  await expect(page.getByRole('heading', { name: /Choose What Kind of Book/ })).toHaveCount(0)
  await expect(page.getByText('Coloring Book & Pages', { exact: true })).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Style' }).getByRole('radio').first()).toContainText('Bold Lines for Kids')

  await page.getByRole('button', { name: 'Change book type' }).click()
  await expect(page.getByRole('heading', { name: /Choose What Kind of Book/ })).toBeVisible()
})

test('starting without a type still lets you choose one', async ({ page }) => {
  await page.goto('/create-book/new?type=not-a-type')
  await expect(page.getByRole('heading', { name: /Choose What Kind of Book/ })).toBeVisible()
})
