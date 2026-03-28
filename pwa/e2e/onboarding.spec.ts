import { test, expect } from '@playwright/test'

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
  })

  test('shows onboarding when no profile exists', async ({ page }) => {
    await expect(page.getByText('My Workouts')).toBeVisible()
    await expect(page.getByText(/Enter your current one-rep maxes/)).toBeVisible()
  })

  test('Continue button is disabled until all 1RMs are entered', async ({ page }) => {
    const continueBtn = page.getByRole('button', { name: 'Continue' })
    await expect(continueBtn).toBeDisabled()

    // Inputs don't have htmlFor, so locate by preceding label text
    const inputs = page.locator('input[type="number"]')
    await inputs.nth(0).fill('315')  // Squat
    await inputs.nth(1).fill('225')  // Bench
    await inputs.nth(2).fill('405')  // Deadlift
    await expect(continueBtn).toBeDisabled()

    await inputs.nth(3).fill('155')  // OHP
    await expect(continueBtn).toBeEnabled()
  })

  test('shows training max preview at 90%', async ({ page }) => {
    const inputs = page.locator('input[type="number"]')
    await inputs.nth(0).fill('300')
    await inputs.nth(1).fill('200')
    await inputs.nth(2).fill('400')
    await inputs.nth(3).fill('150')

    await expect(page.getByText('Training Maxes (90%)')).toBeVisible()
    // 300 * 0.9 = 270
    await expect(page.getByText('270 lbs')).toBeVisible()
  })

  test('full onboarding creates profile and lands on workout view', async ({ page }) => {
    const inputs = page.locator('input[type="number"]')
    await inputs.nth(0).fill('315')
    await inputs.nth(1).fill('225')
    await inputs.nth(2).fill('405')
    await inputs.nth(3).fill('155')

    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 2: accessories review
    await expect(page.getByText('Review Accessories')).toBeVisible()
    await page.getByRole('button', { name: 'Start Training' }).click()

    // Should land on workout view
    await expect(page.getByText('Week 1: Squat')).toBeVisible()
    await expect(page.getByText(/Cycle 1 · Day 1 of 4/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start Workout' })).toBeVisible()
  })
})
