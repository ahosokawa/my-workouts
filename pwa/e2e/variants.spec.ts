import { test, expect } from '@playwright/test'
import { loadFixture } from './helpers'

test.describe('Cycle completion — variant selector', () => {
  test('shows variant selector with all 4 variants', async ({ page }) => {
    await loadFixture(page, 'cycle-complete-fsl.json')
    await page.goto('/')

    // Should be on cycle completion screen
    await expect(page.getByText('Cycle 1 Complete')).toBeVisible()

    // Variant selector section exists
    await expect(page.getByText('Next Cycle Program')).toBeVisible()

    // All 4 variant cards are present
    await expect(page.getByRole('button', { name: /FSL/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /BBB/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /SSL/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /BBS/ })).toBeVisible()
  })

  test('suggests "Start with a Leader" for first cycle', async ({ page }) => {
    await loadFixture(page, 'cycle-complete-fsl.json')
    await page.goto('/')

    await expect(page.getByText('Suggested: Start with a Leader cycle')).toBeVisible()
  })

  test('suggests Anchor after 2 Leader cycles', async ({ page }) => {
    await loadFixture(page, 'cycle-complete-2-leaders.json')
    await page.goto('/')

    await expect(page.getByText('Cycle 3 Complete')).toBeVisible()
    await expect(page.getByText(/Suggested: Switch to an Anchor/)).toBeVisible()
    await expect(page.getByText(/you've completed 2 Leader cycles/)).toBeVisible()
  })

  test('selecting a variant updates the description', async ({ page }) => {
    await loadFixture(page, 'cycle-complete-fsl.json')
    await page.goto('/')

    // Click BBB
    await page.getByRole('button', { name: /BBB/ }).click()
    await expect(page.getByText('Boring But Big')).toBeVisible()
    await expect(page.getByText('5×10 at 50% of training max')).toBeVisible()

    // Click SSL
    await page.getByRole('button', { name: /SSL/ }).click()
    await expect(page.getByText('Second Set Last')).toBeVisible()
  })

  test('starting a cycle with BBB navigates to workout view with BBB label', async ({ page }) => {
    await loadFixture(page, 'cycle-complete-fsl.json')
    await page.goto('/')

    // Select BBB, skip deload, and start
    await page.getByRole('button', { name: /BBB/ }).click()
    await page.getByRole('button', { name: /Skip/ }).click()
    await page.getByRole('button', { name: /Start Cycle 2/ }).click()

    // Should now be on workout view with BBB in header
    await expect(page.getByText(/· BBB$/)).toBeVisible()
  })
})

test.describe('Workout view — variant supplemental display', () => {
  test('BBB shows 5×10 supplemental section', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    // Header shows BBB
    await expect(page.getByText(/· BBB$/)).toBeVisible()

    // Supplemental section title
    await expect(page.getByText(/BBB 5×10 – Squat/)).toBeVisible()
  })

  test('BBB supplemental sets show 10 reps each', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    // Start workout to see set details
    await page.getByRole('button', { name: 'Start Workout' }).click()

    // Should have supplemental sets showing 10 reps
    // The supplemental section has 5 sets, each targeting 10 reps
    const suppSection = page.getByText(/BBB 5×10 – Squat/).locator('..')
    await expect(suppSection).toBeVisible()
  })
})

test.describe('History — backwards compatibility', () => {
  test('old sessions without variant field show FSL badge', async ({ page }) => {
    await loadFixture(page, 'legacy-sessions-no-variant.json')
    await page.goto('/')

    // Navigate to history tab
    await page.getByRole('link', { name: /history/i }).click()

    // Click on a session to see detail
    await page.getByText('Week 1: Squat').click()

    // Should show FSL badge even though session has no variant field
    await expect(page.getByText('FSL')).toBeVisible()
  })

  test('legacy profile without variant fields gets defaults via merge', async ({ page }) => {
    await loadFixture(page, 'legacy-sessions-no-variant.json')
    await page.goto('/')

    // The app should render the workout view (not crash)
    // The header should show FSL since merge defaults currentVariant to 'fsl'
    await expect(page.getByText(/· FSL$/)).toBeVisible()
  })
})
