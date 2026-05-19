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

test.describe('Reorder the week', () => {
  test('picking a lift switches the prescription and persists across reload', async ({ page }) => {
    // mid-cycle-bbb.json is week 1 / day 1 — a fresh week, no days done yet.
    await loadFixtureOnce(page, 'mid-cycle-bbb.json', '/')

    // Defaults to the first lift of the week, with the next-workout picker shown.
    await expect(page.getByText('Week 1: Squat')).toBeVisible()
    await expect(page.getByText('Up next — pick a lift')).toBeVisible()

    // Switch the next workout to Bench Press (day 2).
    await page.getByRole('button', { name: 'BP', exact: true }).click()
    await expect(page.getByText('Week 1: Bench Press')).toBeVisible()
    await expect(page.getByText(/Day 2 of 4/)).toBeVisible()

    // The selection is persisted — it survives a reload.
    await page.reload()
    await expect(page.getByText('Week 1: Bench Press')).toBeVisible()
  })

  test('finishing a reordered workout marks it done and auto-advances within the week', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    // Start the week with Bench instead of Squat.
    await page.getByRole('button', { name: 'BP', exact: true }).click()
    await expect(page.getByText('Week 1: Bench Press')).toBeVisible()

    await page.getByRole('button', { name: 'Start Workout' }).click()
    await expect(page.getByText('Elapsed')).toBeVisible()

    // Complete every set (expanding auto-collapsed sections as needed).
    while (true) {
      const collapsed = page.locator('button[aria-expanded="false"]')
      if ((await collapsed.count()) > 0) {
        await collapsed.first().click()
        await page.waitForTimeout(50)
        continue
      }
      const markComplete = page.getByRole('button', { name: 'Mark complete' })
      if ((await markComplete.count()) === 0) break
      await markComplete.first().click()
      await page.waitForTimeout(50)
    }

    await page.getByRole('button', { name: 'Finish Workout' }).click()
    await page.getByRole('button', { name: 'Finish', exact: true }).click()

    // The week did NOT roll over — still week 1. The next workout auto-selects
    // the lowest remaining day (Squat, day 1).
    await expect(page.getByText('Week 1: Squat')).toBeVisible()

    // Bench is now marked done in the picker and can't be re-selected.
    const benchChip = page.getByRole('button', { name: 'BP ✓' })
    await expect(benchChip).toBeVisible()
    await expect(benchChip).toBeDisabled()
  })

  test('an in-progress workout keeps its lift when the profile day drifts', async ({ page }) => {
    // Fresh week (week 1 / day 1). Start the week with Bench instead of Squat.
    await loadFixtureOnce(page, 'mid-cycle-bbb.json', '/')
    await page.getByRole('button', { name: 'BP', exact: true }).click()
    await expect(page.getByText('Week 1: Bench Press')).toBeVisible()

    // Start the workout — its day + lift are pinned at this moment.
    await page.getByRole('button', { name: 'Start Workout' }).click()
    await expect(page.getByText('Elapsed')).toBeVisible()

    // Simulate a mid-workout profile mutation (a cloud-sync pull or a Settings
    // action) that moves currentDay back to day 1 (Squat). The in-progress
    // activeWorkout is left untouched.
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('my-workouts-storage')!)
      data.state.profile.currentDay = 1
      localStorage.setItem('my-workouts-storage', JSON.stringify(data))
    })
    await page.reload()

    // The workout is still active AND still pinned to Bench Press — it did not
    // silently re-point to Squat.
    await expect(page.getByText('Elapsed')).toBeVisible()
    await expect(page.getByText('Week 1: Bench Press')).toBeVisible()
    await expect(page.getByText(/Day 2 of 4/)).toBeVisible()
  })
})
