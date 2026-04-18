import { test, expect } from '@playwright/test'
import { loadFixture } from './helpers'

test.describe('Cycle completion screen', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ page }) => {
    await loadFixture(page, 'cycle-complete-fsl.json')
    await page.goto('/')
  })

  test('renders cycle complete screen', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Cycle \d+ Complete/ })).toBeVisible()
  })

  test('Start button at bottom is reachable via scroll on small viewport', async ({ page }) => {
    const startBtn = page.getByRole('button', { name: /^Start (Cycle \d+|Deload Week|TM Test Week)$/ })
    await expect(startBtn).toHaveCount(1)

    await startBtn.scrollIntoViewIfNeeded()
    await expect(startBtn).toBeInViewport()
  })
})
