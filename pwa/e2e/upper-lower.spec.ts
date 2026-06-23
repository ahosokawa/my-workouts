import { test, expect } from '@playwright/test'
import { loadFixture } from './helpers'

test.describe('4-Day Upper/Lower — onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')
  })

  test('picking Upper/Lower lands on Day 1 (Upper A = Bench) with its header', async ({ page }) => {
    // Step 1: 1RMs
    const inputs = page.locator('input[type="number"]')
    await inputs.nth(0).fill('265')  // Squat
    await inputs.nth(1).fill('185')  // Bench
    await inputs.nth(2).fill('343')  // Deadlift
    await inputs.nth(3).fill('133')  // OHP
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 2: program picker — choose Upper/Lower
    await expect(page.getByText('Choose Your Program')).toBeVisible()
    await page.getByRole('button', { name: /4-Day Upper\/Lower/ }).click()

    // Top-set-engine program: the 5/3/1 variant section is hidden, engine notes are shown
    await expect(page.getByRole('button', { name: /^FSL/ })).toBeHidden()
    await expect(page.getByText('4-Day Upper/Lower notes')).toBeVisible()

    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 3: plan review uses Upper/Lower day labels (in training order)
    await expect(page.getByText('Review Workout Plan')).toBeVisible()
    await expect(page.getByText(/Upper A — Chest\/Horizontal/)).toBeVisible()
    await expect(page.getByText(/Lower B — Hinge/)).toBeVisible()

    await page.getByRole('button', { name: 'Start Training' }).click()

    // Lands on Day 1 = Upper A (Bench top set), with the program tag in the subheader
    await expect(page.getByText(/Week 1: Upper A — Chest\/Horizontal/)).toBeVisible()
    await expect(page.getByText(/Cycle 1 · Day 1 of 4 · 4-Day Upper\/Lower/)).toBeVisible()
  })
})

test.describe('4-Day Upper/Lower — Day 1 (Upper A, Bench top set)', () => {
  test('Bench top set shows a 5-6 rep range and Pull-Ups accessory', async ({ page }) => {
    await loadFixture(page, 'upper-lower-day-1.json')
    await page.goto('/')

    await expect(page.getByText(/Week 1: Upper A — Chest\/Horizontal/)).toBeVisible()
    // Top set advertises the rep range before starting
    await expect(page.getByText('5-6 reps')).toBeVisible()
    // Pull-Ups is the focal pull accessory on Upper A
    await expect(page.getByText('Pull-Ups')).toBeVisible()
  })

  test('top set weight defaults to the seeded Bench top-set weight', async ({ page }) => {
    // Fixture seeds hypertrophyTopSets[Bench=2] = 135 lbs
    await loadFixture(page, 'upper-lower-day-1.json')
    await page.goto('/')

    await page.getByRole('button', { name: 'Start Workout' }).click()
    await expect(page.getByText(/135 lbs/)).toBeVisible()
  })
})

test.describe('4-Day Upper/Lower — Day 3 (Upper B, OHP top set)', () => {
  test('unlike hypertrophy, the OHP/Upper-B day HAS a top-set main lift', async ({ page }) => {
    await loadFixture(page, 'upper-lower-day-3.json')
    await page.goto('/')

    await expect(page.getByText(/Week 1: Upper B — Back\/Vertical/)).toBeVisible()
    // A top-set main section is rendered for Overhead Press...
    await expect(page.getByText(/Warmups \+ Top Set – Overhead Press/)).toBeVisible()
    // ...with the widened 5-8 OHP rep range
    await expect(page.getByText('5-8 reps')).toBeVisible()
    // Upper B accessories present
    await expect(page.getByText('Chest-Supported DB Row')).toBeVisible()
  })
})

test.describe('4-Day Upper/Lower — settings program switcher', () => {
  test('switching from 5/3/1 to Upper/Lower updates the header', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    await expect(page.getByText(/· BBB$/)).toBeVisible()

    await page.getByRole('link', { name: /settings/i }).click()
    await page.getByRole('button', { name: 'Upper/Lower', exact: true }).click()

    await expect(page.getByText('Switch to 4-Day Upper/Lower?')).toBeVisible()
    await page.getByRole('button', { name: 'Switch' }).click()

    // Day 1 of Upper/Lower is Upper A (Bench), with the program tag
    await page.getByRole('link', { name: /workout/i }).click()
    await expect(page.getByText(/Week 1: Upper A — Chest\/Horizontal/)).toBeVisible()
    await expect(page.getByText(/· 4-Day Upper\/Lower/)).toBeVisible()
  })
})
