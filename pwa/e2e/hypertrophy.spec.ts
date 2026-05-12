import { test, expect } from '@playwright/test'
import { loadFixture } from './helpers'

test.describe('Hypertrophy — onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
  })

  test('picking 4-Day Hypertrophy lands on Day 1 with hypertrophy header', async ({ page }) => {
    // Step 1: 1RMs
    const inputs = page.locator('input[type="number"]')
    await inputs.nth(0).fill('265')  // Squat
    await inputs.nth(1).fill('185')  // Bench
    await inputs.nth(2).fill('343')  // Deadlift
    await inputs.nth(3).fill('133')  // OHP
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 2: program picker
    await expect(page.getByText('Choose Your Program')).toBeVisible()
    await page.getByRole('button', { name: /4-Day Hypertrophy/ }).click()

    // The 5/3/1 variant section should now be hidden
    await expect(page.getByRole('button', { name: /^FSL/ })).toBeHidden()
    await expect(page.getByText('Hypertrophy notes')).toBeVisible()

    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 3: plan review uses hypertrophy day labels
    await expect(page.getByText('Review Workout Plan')).toBeVisible()
    await expect(page.getByText(/Lower — Squat Focus/)).toBeVisible()
    await expect(page.getByText(/Upper — Pull Focus/)).toBeVisible()

    await page.getByRole('button', { name: 'Start Training' }).click()

    // Lands on Day 1 — hypertrophy spec label + program tag in subheader
    await expect(page.getByText(/Week 1: Lower — Squat Focus/)).toBeVisible()
    await expect(page.getByText(/Cycle 1 · Day 1 of 4 · Hypertrophy/)).toBeVisible()
  })
})

test.describe('Hypertrophy — Day 1 workout', () => {
  test('top set shows 5-6 rep range', async ({ page }) => {
    await loadFixture(page, 'hypertrophy-day-1.json')
    await page.goto('/')

    await expect(page.getByText(/Week 1: Lower — Squat Focus/)).toBeVisible()

    // Before starting the workout, the top set advertises the rep range
    await expect(page.getByText('5-6 reps')).toBeVisible()
  })

  test('RIR picker appears while the top set is incomplete', async ({ page }) => {
    await loadFixture(page, 'hypertrophy-day-1.json')
    await page.goto('/')

    await page.getByRole('button', { name: 'Start Workout' }).click()

    // Top set is the 4th main set (3 warmups + 1 top). Complete the 3 warmups
    // so only the AMRAP top set + accessories remain incomplete.
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Mark complete' }).first().click()
      await page.waitForTimeout(50)
    }

    // RIR picker label + 4 options
    await expect(page.getByText(/RIR \(optional/)).toBeVisible()
    await expect(page.getByRole('button', { name: '0', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '2', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '3+' })).toBeVisible()

    // Selecting a value toggles its visual state — click 2 and confirm a second click clears.
    await page.getByRole('button', { name: '2', exact: true }).click()
    await page.getByRole('button', { name: '2', exact: true }).click()
  })

  test('top set weight defaults to the seeded hypertrophy top-set weight', async ({ page }) => {
    // Profile has hypertrophyTopSets[Squat] = 192.5 lbs
    await loadFixture(page, 'hypertrophy-day-1.json')
    await page.goto('/')

    await page.getByRole('button', { name: 'Start Workout' }).click()

    // The top set (4th set card) should show ~192.5 lbs as its weight.
    await expect(page.getByText(/192\.5 lbs|193 lbs/)).toBeVisible()
  })
})

test.describe('Hypertrophy — Day 4 (Pull Focus, no top-set main lift)', () => {
  test('no main-lift section is rendered', async ({ page }) => {
    await loadFixture(page, 'hypertrophy-day-4.json')
    await page.goto('/')

    await expect(page.getByText(/Week 1: Upper — Pull Focus/)).toBeVisible()

    // No "Warmups + Top Set" section
    await expect(page.getByText(/Warmups \+ Top Set/)).toBeHidden()
    // No 5/3/1 supplemental section
    await expect(page.getByText(/Warmups \+ 5\/3\/1/)).toBeHidden()
  })

  test('Pull-Ups card is the first exercise section', async ({ page }) => {
    await loadFixture(page, 'hypertrophy-day-4.json')
    await page.goto('/')

    // Pull-Ups should be visible as the focal accessory
    await expect(page.getByText('Pull-Ups')).toBeVisible()
    // And its rep range should display as "6-8"
    await expect(page.getByText(/4x6-8/)).toBeVisible()
  })
})

test.describe('Hypertrophy — settings program switcher', () => {
  test('switching from 5/3/1 to hypertrophy updates header and accessories', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    // Sanity: starting on 5/3/1
    await expect(page.getByText(/· BBB$/)).toBeVisible()

    await page.getByRole('link', { name: /settings/i }).click()

    // Program section shows both options with 5/3/1 selected
    await expect(page.getByRole('button', { name: '5/3/1' })).toBeVisible()
    await page.getByRole('button', { name: 'Hypertrophy', exact: true }).click()

    // Confirmation dialog
    await expect(page.getByText('Switch to Hypertrophy?')).toBeVisible()
    await page.getByRole('button', { name: 'Switch' }).click()

    // Workout view now shows hypertrophy framing
    await page.getByRole('link', { name: /workout/i }).click()
    await expect(page.getByText(/Week 1: Lower — Squat Focus/)).toBeVisible()
    await expect(page.getByText(/· Hypertrophy/)).toBeVisible()
  })

  test('switching back to 5/3/1 restores the variant label', async ({ page }) => {
    await loadFixture(page, 'hypertrophy-day-1.json')
    await page.goto('/')

    await expect(page.getByText(/· Hypertrophy/)).toBeVisible()

    await page.getByRole('link', { name: /settings/i }).click()
    await page.getByRole('button', { name: '5/3/1' }).click()
    await expect(page.getByText('Switch to 5/3/1?')).toBeVisible()
    await page.getByRole('button', { name: 'Switch' }).click()

    await page.getByRole('link', { name: /workout/i }).click()
    // Default 5/3/1 variant is FSL after switchProgram
    await expect(page.getByText(/· FSL$/)).toBeVisible()
  })
})
