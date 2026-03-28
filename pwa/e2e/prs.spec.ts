import { test, expect } from '@playwright/test'
import { loadFixture } from './helpers'

test.describe('PRs view', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixture(page, 'multi-cycle-with-prs.json')
    await page.goto('/')
    await page.getByRole('link', { name: /prs/i }).click()
  })

  test('Est. 1RM tab shows lift PRs', async ({ page }) => {
    // Section heading (rendered uppercase via CSS, but text content is mixed case)
    await expect(page.getByText('Estimated 1RM')).toBeVisible()
    await expect(page.getByText('Squat').first()).toBeVisible()
    await expect(page.getByText('Bench Press').first()).toBeVisible()
    await expect(page.getByText('Deadlift').first()).toBeVisible()
  })

  test('shows best AMRAP sets section', async ({ page }) => {
    await expect(page.getByText('Best AMRAP Sets')).toBeVisible()
  })

  test('Wilks tab shows score', async ({ page }) => {
    await page.getByRole('button', { name: 'Wilks' }).click()

    // Should show "Current Wilks Score" heading
    await expect(page.getByText('Current Wilks Score')).toBeVisible()
    // Latest score is 270.0
    await expect(page.getByText('270.0').first()).toBeVisible()
  })

  test('clicking a lift navigates to e1RM chart', async ({ page }) => {
    // Click on Squat row (the first one in Estimated 1RM section)
    const squatRow = page.getByText('Squat').first()
    await squatRow.click()

    // Should navigate to chart view with back link
    await expect(page.getByText('← Personal Records')).toBeVisible()
  })
})

test.describe('PRs empty state', () => {
  test('shows empty state with no AMRAP data', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')
    await page.getByRole('link', { name: /prs/i }).click()

    await expect(page.getByText('No PRs Yet')).toBeVisible()
    await expect(page.getByText(/Complete AMRAP sets/)).toBeVisible()
  })
})
