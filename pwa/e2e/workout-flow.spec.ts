import { test, expect } from '@playwright/test'
import { loadFixture, loadFixtureOnce } from './helpers'

test.describe('Full workout flow', () => {
  test('start workout, complete all sets, finish, appears in history', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    await expect(page.getByText('Week 1: Squat')).toBeVisible()
    await page.getByRole('button', { name: 'Start Workout' }).click()
    await expect(page.getByText('Elapsed')).toBeVisible()

    // Complete all "Mark complete" buttons iteratively
    // BBB: 3 warmup + 3 working + 5 supplemental = 11 main + accessory sets
    // Sections auto-collapse when all sets done, so we may need to expand them
    while (true) {
      // Expand any collapsed sections
      const collapsed = page.locator('button[aria-expanded="false"]')
      const collapsedCount = await collapsed.count()
      if (collapsedCount > 0) {
        await collapsed.first().click()
        await page.waitForTimeout(50)
      }

      const markComplete = page.getByRole('button', { name: 'Mark complete' })
      const count = await markComplete.count()
      if (count === 0) break

      await markComplete.first().click()
      await page.waitForTimeout(50)
    }

    // Click Finish Workout
    await page.getByRole('button', { name: 'Finish Workout' }).click()

    // Confirm in the dialog (use exact match to avoid matching "Finish Workout")
    await expect(page.getByText('Finish Workout?')).toBeVisible()
    await page.getByRole('button', { name: 'Finish', exact: true }).click()

    // Should advance to next day (Day 2 = Bench Press)
    await expect(page.getByText('Week 1: Bench Press')).toBeVisible()

    // Navigate to history
    await page.getByRole('link', { name: /history/i }).click()

    // The workout should appear in history
    await expect(page.getByText('Week 1: Squat')).toBeVisible()
  })

  test('AMRAP reps are recorded', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    await page.getByRole('button', { name: 'Start Workout' }).click()

    // Complete the 5 pre-AMRAP sets (3 warmup + 2 working)
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Mark complete' }).first().click()
      await page.waitForTimeout(50)
    }

    // The AMRAP stepper should be visible now with + and − buttons
    // Default is 5 reps for week 1; increment to 8
    const plusBtn = page.getByRole('button', { name: '+', exact: true })
    await expect(plusBtn).toBeVisible()
    await plusBtn.click()
    await plusBtn.click()
    await plusBtn.click()

    // Complete the AMRAP set
    await page.getByRole('button', { name: 'Mark complete' }).first().click()

    // Should show "8 reps" for the completed AMRAP
    await expect(page.locator('text=8 reps')).toBeVisible()
  })
})

test.describe('Active workout persistence', () => {
  test('workout state survives tab navigation', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    await page.getByRole('button', { name: 'Start Workout' }).click()
    await page.getByRole('button', { name: 'Mark complete' }).first().click()

    // Navigate to settings and back
    await page.getByRole('link', { name: /settings/i }).click()
    await expect(page.getByText('Current Cycle')).toBeVisible()

    await page.getByRole('link', { name: /workout/i }).click()

    // Workout still active
    await expect(page.getByText('Elapsed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark incomplete' }).first()).toBeVisible()
  })

  test('workout state survives page reload', async ({ page }) => {
    // Use loadFixtureOnce so addInitScript doesn't overwrite on reload
    await loadFixtureOnce(page, 'mid-cycle-bbb.json', '/')

    await page.getByRole('button', { name: 'Start Workout' }).click()
    await expect(page.getByText('Elapsed')).toBeVisible()
    await page.getByRole('button', { name: 'Mark complete' }).first().click()
    await expect(page.getByRole('button', { name: 'Mark incomplete' }).first()).toBeVisible()

    // Reload the page — localStorage should persist the active workout
    await page.reload()

    // Workout should still be active
    await expect(page.getByText('Elapsed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark incomplete' }).first()).toBeVisible()
  })
})
