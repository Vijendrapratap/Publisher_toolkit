import { expect, test } from '@playwright/test'
import path from 'node:path'

const fixture = (name: string) => path.join(__dirname, 'fixtures', name)

test('the header shows the credit balance and links to the credits page', async ({ page }) => {
  await page.goto('/ads')
  const chip = page.getByRole('link', { name: /credits$/ })
  await expect(chip).toBeVisible()
  await chip.click()
  await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible()
  await expect(page.getByText('Welcome credits')).toBeVisible()
})

test('generating ads lowers the balance by the goal price', async ({ page }) => {
  const balance = async () => {
    const chip = page.getByRole('link', { name: /^\d+ credits$/ })
    await expect(chip).toBeVisible()
    return Number((await chip.getAttribute('aria-label'))!.split(' ')[0])
  }

  // Same upload → details → configure steps as e2e/ads.spec.ts (default goal: Image Ads).
  await page.goto('/ads/new')
  const before = await balance()
  // The form opens on the Product URL tab, so switch to PDF upload first.
  await page.getByRole('button', { name: 'Upload PDF (Optional)' }).click()
  await page.locator('#pdf').setInputFiles(fixture('sample-book.pdf'))
  await page.getByRole('button', { name: 'Upload and continue' }).click()
  await expect(page).toHaveURL(/\/ads\/[^/]+\/upload$/)
  if (await page.getByText('Add one to continue').isVisible()) {
    await page.locator('#frontCover').setInputFiles(fixture('cover.png'))
  } else {
    await page.getByRole('button', { name: 'Replace cover' }).click()
    await page.locator('#frontCover').setInputFiles(fixture('cover.png'))
  }
  await page.getByLabel('Title').fill('Credits Test')
  await page.getByLabel('Author').fill('Jane Coder')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await expect(page).toHaveURL(/\/configure$/)
  await expect(page.getByRole('button', { name: /· 3 credits/ })).toBeVisible()
  await page.getByRole('button', { name: /· 3 credits/ }).click()
  await expect(page).toHaveURL(/\/results$/, { timeout: 120_000 })

  await page.reload()
  expect(before - (await balance())).toBe(3)
})
