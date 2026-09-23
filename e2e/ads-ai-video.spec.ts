import { test, expect } from '@playwright/test'

const PROJECT = process.env.E2E_ADS_PROJECT_ID
test.skip(!PROJECT, 'Set E2E_ADS_PROJECT_ID to a generated ads project')

test('the cyan button opens an editable AI video prompt', async ({ page }) => {
  await page.goto(`/ads/${PROJECT}/results`)
  await page.getByRole('button', { name: 'Generate with AI' }).click()
  const panel = page.getByRole('region', { name: 'AI Video' })
  await expect(panel).toBeVisible()

  await panel.getByRole('button', { name: /Write the video prompt/ }).click()
  const firstPrompt = panel.getByLabel('Shot 1 prompt')
  await expect(firstPrompt).not.toHaveValue('', { timeout: 60_000 })

  await firstPrompt.fill('Slow push-in on the cover while golden light sweeps across it')
  await expect(panel.getByRole('button', { name: 'Generate AI video' })).toBeEnabled()
  await expect(panel.getByText(/Estimated ≈ \$\d+\.\d\d/)).toBeVisible()
})
