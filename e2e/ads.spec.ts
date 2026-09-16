import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

const fixture = (name: string) => path.join(__dirname, 'fixtures', name)
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true })

test('publisher creates ads end to end in local mode', async ({ page }) => {
  // Hub
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Every tool your book needs to find its readers.' })).toBeVisible()
  await expect(page.getByText('Local mode')).toBeVisible()
  await shot(page, 'hub-light')

  // Into Ads Creative
  await page.getByRole('link', { name: /Ads Creative/ }).first().click()
  await expect(page).toHaveURL(/\/ads$/)
  await page.getByRole('link', { name: /New (ad )?project/ }).first().click()

  // Upload
  await page.locator('#pdf').setInputFiles(fixture('sample-book.pdf'))
  await expect(page.getByText('sample-book.pdf')).toBeVisible()
  await page.getByRole('button', { name: 'Upload and continue' }).click()
  await expect(page).toHaveURL(/\/ads\/[^/]+\/upload$/)
  await expect(page.getByRole('heading', { name: 'Book details' })).toBeVisible()

  // Always use the known-good cover so rendering is deterministic.
  if (await page.getByText('Add one to continue').isVisible()) {
    await page.locator('#frontCover').setInputFiles(fixture('cover.png'))
  } else {
    await page.getByRole('button', { name: 'Replace cover' }).click()
    await page.locator('#frontCover').setInputFiles(fixture('cover.png'))
  }
  await page.getByLabel('Title').fill('The Lazy Developer')
  await page.getByLabel('Author').fill('Jane Coder')
  await page.getByLabel('Blurb').fill('A story about shipping less code and loving it.')
  await page.getByRole('button', { name: 'Save and continue' }).click()

  // Configure
  await expect(page).toHaveURL(/\/configure$/)
  // "Bold" is both a tone and a template, so scope each pick to its group.
  await page.getByRole('radiogroup', { name: 'Copy tone' }).getByRole('radio', { name: /Punchy/ }).click()
  await page.getByRole('radiogroup', { name: 'Design template' }).getByRole('radio', { name: /Bold/ }).click()
  await expect(page.getByRole('checkbox', { name: /Meta/ })).toHaveAttribute('aria-checked', 'true')
  await shot(page, 'configure-light')
  await page.getByRole('button', { name: 'Generate creatives' }).click()

  // Generate → Results
  await expect(page.getByRole('heading', { name: 'Creating your ads' })).toBeVisible()
  await expect(page).toHaveURL(/\/results$/, { timeout: 120_000 })
  await expect(page.getByRole('img', { name: 'Meta ad, 1080×1080' }).first()).toBeVisible()
  await expect(page.getByRole('img', { name: 'Google ad, 728×90' }).first()).toBeVisible()
  await expect(page.getByRole('img', { name: 'Amazon ad, 300×250' }).first()).toBeVisible()
  // Per-tile Download link must not be pushed outside its (overflow-hidden) tile.
  const tileDownload = page.getByRole('link', { name: 'Download', exact: true }).first()
  await tileDownload.scrollIntoViewIfNeeded()
  await expect(tileDownload).toBeInViewport({ ratio: 1 })
  await shot(page, 'results-light')

  // Lightbox
  await page.getByRole('button', { name: 'Preview Meta ad, 1080×1080' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close preview' }).click()

  // Edit copy
  const headline = page.getByLabel('Headline').first()
  await headline.fill('Ship less. Read more.')
  await page.getByRole('button', { name: 'Save copy' }).first().click()
  await expect(page.getByText('Copy saved')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Headline').first()).toHaveValue('Ship less. Read more.')

  // Push (simulated)
  await page.getByRole('button', { name: 'Connect & push' }).first().click()
  await expect(page.getByText(/Receipt sim_[a-z0-9]{8} · simulated/)).toBeVisible()

  // ZIP download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download all (.zip)' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('the-lazy-developer-ad-creatives.zip')

  // Resume: project link on the hub goes straight back to Results
  await page.goto('/')
  await page.getByRole('link', { name: /The Lazy Developer/ }).first().click()
  await expect(page).toHaveURL(/\/results$/)

  // Dark theme and mobile screenshots of the key screens.
  // Light is the app's default and the OS preference is deliberately not read,
  // so dark comes from the saved choice the theme toggle writes.
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await shot(page, 'results-dark')
  await page.goto('/')
  await shot(page, 'hub-dark')
  await page.setViewportSize({ width: 400, height: 860 })
  await shot(page, 'hub-mobile-dark')
})

test('coming-soon services and unknown projects have designed states', async ({ page }) => {
  await page.goto('/trailer')
  await expect(page.getByRole('heading', { name: 'Trailer Video' })).toBeVisible()
  await expect(page.getByText('Coming soon').first()).toBeVisible()

  await page.goto('/ads/not-a-real-project/results')
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page' })).toBeVisible()
})
