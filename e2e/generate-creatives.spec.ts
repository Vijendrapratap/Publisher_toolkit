import { test, expect } from '@playwright/test'
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright'
import path from 'node:path'

test.beforeAll(async () => {
  await clerkSetup()
})

test('publisher uploads a book and generates creatives', async ({ page }) => {
  await setupClerkTestingToken({ page })

  await page.goto('/dashboard/books/new')
  await page.setInputFiles('input[name="pdf"]', path.join(__dirname, 'fixtures/sample-book.pdf'))
  await page.click('button[type="submit"]')

  await page.waitForURL(/\/dashboard\/books\/.+/)
  await page.click('text=Generate creatives')

  await expect(page.locator('img[alt="meta_feed_1080x1080"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('text=Download meta_feed_1080x1080')).toBeVisible()
})
