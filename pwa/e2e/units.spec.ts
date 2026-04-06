import { test, expect } from '@playwright/test'
import { loadFixture } from './helpers'

test.describe('Unit switching (lbs → kg)', () => {
  test.beforeEach(async ({ page }) => {
    // mid-cycle-bbb has lbs data: squatTM=282.5, benchTM=202.5, bodyWeight=185
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')
  })

  test('workout view shows converted kg weights after switching', async ({ page }) => {
    // Verify lbs values first — warmup at 40%: roundWeight(282.5*0.40) = 112.5 lbs
    await expect(page.getByText('Week 1: Squat')).toBeVisible()
    await expect(page.getByText('112.5 lbs')).toBeVisible()

    // Switch to kg in settings
    await page.getByRole('link', { name: /settings/i }).click()
    await page.getByRole('button', { name: 'kg' }).click()

    // Go back to workout
    await page.getByRole('link', { name: /workout/i }).click()

    // 112.5 lbs → displayRound(112.5, 'kg') = Math.round(112.5 * 0.4536) = Math.round(51.03) = 51
    await expect(page.getByText('51 kg')).toBeVisible()
    // lbs values should no longer appear
    await expect(page.getByText('112.5 lbs')).not.toBeVisible()
  })

  test('settings view shows converted TMs and 1RMs in kg', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click()

    // Verify lbs values: squatTM = 282.5, displayed as-is
    await expect(page.getByText('282.5 lbs')).toBeVisible()
    await expect(page.getByText('1RM: 315 lbs')).toBeVisible()

    // Switch to kg
    await page.getByRole('button', { name: 'kg' }).click()

    // squatTM 282.5 lbs → displayRound(282.5, 'kg') = 128
    await expect(page.getByText('128 kg')).toBeVisible()
    // squat 1RM 315 lbs → displayRound(315, 'kg') = 143
    await expect(page.getByText('1RM: 143 kg')).toBeVisible()

    // lbs labels should be gone
    await expect(page.getByText('282.5 lbs')).not.toBeVisible()
    await expect(page.getByText('1RM: 315 lbs')).not.toBeVisible()
  })

  test('settings body weight displays in kg after switching', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click()

    // bodyWeightLbs = 185 → "185.0 lbs"
    await expect(page.getByText('185.0 lbs')).toBeVisible()

    // Switch to kg
    await page.getByRole('button', { name: 'kg' }).click()

    // 185 lbs → toDisplayWeight(185, 'kg').toFixed(1) = "83.9"
    await expect(page.getByText('83.9 kg')).toBeVisible()
    await expect(page.getByText('185.0 lbs')).not.toBeVisible()
  })

  test('PRs view shows converted e1RM values after switching', async ({ page }) => {
    // Use multi-cycle fixture which has PR data
    await loadFixture(page, 'multi-cycle-with-prs.json')
    await page.goto('/')

    await page.getByRole('link', { name: /prs/i }).click()

    // Best squat AMRAP: 250 lbs x 8 → e1RM = 250*36/(37-8) ≈ 310.34
    // displayRound(310.34, 'lbs') = 310.5 (nearest 0.5)
    await expect(page.getByText('310.5 lbs').first()).toBeVisible()

    // Switch to kg
    await page.getByRole('link', { name: /settings/i }).click()
    await page.getByRole('button', { name: 'kg' }).click()
    await page.getByRole('link', { name: /prs/i }).click()

    // displayRound(310.34, 'kg') = Math.round(140.77) = 141
    await expect(page.getByText('141 kg').first()).toBeVisible()
    await expect(page.getByText('310.5 lbs')).not.toBeVisible()
  })

  test('Wilks section shows converted body weight and totals in kg', async ({ page }) => {
    await loadFixture(page, 'multi-cycle-with-prs.json')
    await page.goto('/')

    await page.getByRole('link', { name: /prs/i }).click()
    await page.getByRole('button', { name: 'Wilks' }).click()

    // bodyWeightLbs=185, total=885 in lbs
    await expect(page.getByText('185 lbs', { exact: true })).toBeVisible()
    await expect(page.getByText('885 lbs total')).toBeVisible()

    // Switch to kg
    await page.getByRole('link', { name: /settings/i }).click()
    await page.getByRole('button', { name: 'kg' }).click()
    await page.getByRole('link', { name: /prs/i }).click()
    await page.getByRole('button', { name: 'Wilks' }).click()

    // 185 lbs → displayRound(185, 'kg') = Math.round(83.91) = 84
    // 885 lbs → displayRound(885, 'kg') = Math.round(401.43) = 401
    await expect(page.getByText('84 kg', { exact: true })).toBeVisible()
    await expect(page.getByText('401 kg total')).toBeVisible()
    await expect(page.getByText('885 lbs total')).not.toBeVisible()
  })
})

test.describe('Onboarding in kg mode', () => {
  test('entering 1RMs in kg stores correct values and shows kg TMs', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/')

    // Select kg
    await page.getByRole('button', { name: 'kg' }).click()

    // Enter 1RMs in kg
    const inputs = page.locator('input[type="number"]')
    await inputs.nth(0).fill('140')  // Squat 140 kg
    await inputs.nth(1).fill('100')  // Bench 100 kg
    await inputs.nth(2).fill('180')  // Deadlift 180 kg
    await inputs.nth(3).fill('70')   // OHP 70 kg

    // TM preview at 90%: 140*0.9=126, 100*0.9=90, 180*0.9=162, 70*0.9=63
    await expect(page.getByText('Training Maxes (90%)')).toBeVisible()
    await expect(page.getByText('126 kg')).toBeVisible()
    await expect(page.getByText('90 kg')).toBeVisible()
    await expect(page.getByText('162 kg')).toBeVisible()
    await expect(page.getByText('63 kg')).toBeVisible()

    // Complete onboarding
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Start Training' }).click()

    // Should be on workout view with kg
    await expect(page.getByText('Week 1: Squat')).toBeVisible()
    // Warmup at 40% of TM: stored TM = toStorageLbs(126, 'kg') ≈ 277.78 lbs
    // prescribedSets: roundWeight(277.78*0.4) = roundWeight(111.11) = 110 lbs
    // displayRound(110, 'kg') = Math.round(49.9) = 50
    await expect(page.getByText('50 kg')).toBeVisible()

    // Verify settings shows kg values
    await page.getByRole('link', { name: /settings/i }).click()
    // TM was stored as toStorageLbs(126, 'kg') ≈ 277.78 lbs
    // displayRound(277.78, 'kg') = Math.round(126.0) = 126
    await expect(page.getByText('126 kg')).toBeVisible()
    await expect(page.getByText('1RM: 140 kg')).toBeVisible()
  })
})

test.describe('History detail shows converted weights', () => {
  test('workout detail view converts set log weights to kg', async ({ page }) => {
    await loadFixture(page, 'multi-cycle-with-prs.json')
    await page.goto('/')

    // First switch to kg
    await page.getByRole('link', { name: /settings/i }).click()
    await page.getByRole('button', { name: 'kg' }).click()

    // Go to history
    await page.getByRole('link', { name: /history/i }).click()

    // Click the most recent Week 3: Squat (first in list, sorted by date desc)
    // Session c2s09 (Feb 17) has AMRAP weight 277.5 lbs
    await page.getByText('Week 3: Squat').first().click()

    // 277.5 lbs → displayRound(277.5, 'kg') = Math.round(125.9) = 126
    await expect(page.getByText(/126 kg/)).toBeVisible()
    await expect(page.getByText('277.5 lbs')).not.toBeVisible()
  })
})
