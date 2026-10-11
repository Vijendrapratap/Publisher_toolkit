import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'

const fixture = (name: string) => path.join(__dirname, 'fixtures', name)
const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true })

test('add a book, make ad images, and find them on the book page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Local mode')).toBeVisible()
  await page.getByRole('link', { name: /Ads Creative/ }).first().click()
  await expect(page).toHaveURL(/\/ads$/)
  await expect(page.getByRole('heading', { name: 'Your books' })).toBeVisible()

  // Add a book by cover upload
  await page.getByRole('link', { name: 'Add a book' }).first().click()
  await page.getByRole('tab', { name: 'Upload a cover' }).click()
  await page.locator('#frontCover').setInputFiles(fixture('cover.png'))
  await page.getByLabel('Book title').fill('The Lazy Developer')
  await page.getByLabel('Author').fill('Jane Coder')
  await page.getByRole('button', { name: 'Add this book' }).click()

  // Project page: three rows, nothing made yet
  await expect(page).toHaveURL(/\/ads\/books\/[^/]+$/)
  const bookUrl = page.url()
  await expect(page.getByRole('heading', { name: 'The Lazy Developer' })).toBeVisible()
  for (const row of ['A+ images for Amazon', 'Video ad', 'Ad images']) {
    await expect(page.getByRole('heading', { name: row })).toBeVisible()
  }
  await shot(page, 'book-project-empty')

  // Make ad images only
  const adRow = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Ad images' }) })
  await adRow.getByRole('button', { name: 'Create' }).click()
  await expect(page).toHaveURL(/\/ads\/[^/]+\/configure$/)
  const configureUrl = page.url()

  // Every choice shows up straight away in the live preview of the real ad.
  const preview = page.getByTestId('ad-preview').locator(':scope > div')
  await page.getByRole('radiogroup', { name: 'Style' }).getByRole('radio', { name: /Bold/ }).click()
  await expect(preview).toHaveCSS('background-color', 'rgb(159, 18, 57)')
  await page.getByRole('radiogroup', { name: 'Badge on the ad' }).getByRole('radio', { name: 'Pre-order' }).click()
  await expect(preview).toContainText('PRE-ORDER NOW')
  await page.getByRole('radiogroup', { name: 'Badge on the ad' }).getByRole('radio', { name: /Write your own/ }).click()
  await page.getByLabel('Your badge').fill('Book club pick')
  await expect(preview).toContainText('BOOK CLUB PICK')
  await page.getByRole('radio', { name: '1200×628' }).click()
  await expect(preview).toHaveCSS('width', '1200px')
  await shot(page, 'configure')

  await page.getByRole('button', { name: /Generate Image Ads/ }).click()
  await expect(page).toHaveURL(/\/results$/, { timeout: 120_000 })
  const resultsUrl = page.url()

  // The badge you wrote is kept.
  await page.goto(configureUrl)
  await expect(page.getByLabel('Your badge')).toHaveValue('BOOK CLUB PICK')
  await page.goto(resultsUrl)
  await expect(page.getByRole('img', { name: /ad, 300×250/ }).first()).toBeVisible()

  // Results page: per-tile download stays inside its (overflow-hidden) tile
  const tileDownload = page.getByRole('link', { name: 'Download', exact: true }).first()
  await tileDownload.scrollIntoViewIfNeeded()
  await expect(tileDownload).toBeInViewport({ ratio: 1 })

  // Lightbox
  await page.getByRole('button', { name: /^Preview .*ad, 300×250/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close preview' }).click()

  // Copy edits survive a reload
  await page.getByLabel('Headline').first().fill('Ship less. Read more.')
  await page.getByRole('button', { name: 'Save copy' }).first().click()
  await expect(page.getByText('Copy saved')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Headline').first()).toHaveValue('Ship less. Read more.')

  // ZIP download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download all (.zip)' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('the-lazy-developer-ad-creatives.zip')

  // Back to the book: the ad images are saved in their row, other rows untouched
  await page.getByRole('link', { name: 'The Lazy Developer' }).first().click()
  await expect(page).toHaveURL(bookUrl)
  await expect(adRow.getByRole('link', { name: 'View' })).toBeVisible()
  await expect(adRow.getByRole('button', { name: 'Create new' })).toBeVisible()
  const aplusRow = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'A+ images for Amazon' }) })
  await expect(aplusRow.getByText(/Not made yet/)).toBeVisible()
  await shot(page, 'book-project-with-ads')

  // The grid shows one card for this book, summarising what exists
  await page.getByRole('link', { name: 'Your books' }).click()
  await expect(page.getByRole('link', { name: /The Lazy Developer/ }).first()).toContainText('Ad images')

  // Home: the recent card opens the book's project page
  await page.goto('/')
  await page.getByRole('link', { name: /The Lazy Developer/ }).first().click()
  await expect(page).toHaveURL(bookUrl)
})

test('coming-soon services and unknown projects have designed states', async ({ page }) => {
  await page.goto('/trailer')
  await expect(page.getByRole('heading', { name: 'Trailer Video' })).toBeVisible()
  await expect(page.getByText('Coming soon').first()).toBeVisible()

  await page.goto('/ads/not-a-real-project/results')
  await expect(page.getByRole('heading', { name: 'We couldn’t find that page' })).toBeVisible()
})
