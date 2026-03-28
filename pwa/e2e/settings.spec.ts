import { test, expect } from '@playwright/test'
import { loadFixture } from './helpers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.describe('Export/Import roundtrip', () => {
  test('export then import restores data', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    // Navigate to settings
    await page.getByRole('link', { name: /settings/i }).click()

    // Export backup — triggers a download
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Export Backup/i }).click()
    const download = await downloadPromise
    const exportPath = path.join(__dirname, 'temp-export.json')
    await download.saveAs(exportPath)

    const exportedJson = fs.readFileSync(exportPath, 'utf-8')
    const exported = JSON.parse(exportedJson)
    expect(exported.version).toBe(1)
    expect(exported.profile.currentVariant).toBe('bbb')
    expect(exported.profile.cycleNumber).toBe(2)

    // Reset all data
    await page.getByRole('button', { name: /Reset All Data/i }).click()
    await expect(page.getByText('Reset All Data?')).toBeVisible()
    await page.getByRole('button', { name: 'Reset Everything' }).click()

    // Should be on onboarding now
    await expect(page.getByText('My Workouts')).toBeVisible()
    await expect(page.getByText(/Enter your current one-rep maxes/)).toBeVisible()

    // Navigate to settings via URL (tab bar not visible during onboarding)
    await page.goto('/#/settings')

    // Import the backup via file chooser
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /Import Backup/i }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(exportPath)

    // Confirm import
    await expect(page.getByText('Import Backup?')).toBeVisible()
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    // Should see success message
    await expect(page.getByText('Import successful!')).toBeVisible()

    // Navigate to workout — should be back to BBB cycle 2
    await page.getByRole('link', { name: /workout/i }).click()
    await expect(page.getByText('Week 1: Squat')).toBeVisible()
    await expect(page.getByText(/· BBB$/)).toBeVisible()

    // Cleanup
    fs.unlinkSync(exportPath)
  })
})

test.describe('Reset', () => {
  test('Reset All shows onboarding', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    await page.getByRole('link', { name: /settings/i }).click()
    await page.getByRole('button', { name: /Reset All Data/i }).click()
    await page.getByRole('button', { name: 'Reset Everything' }).click()

    await expect(page.getByText('My Workouts')).toBeVisible()
    await expect(page.getByText(/Enter your current one-rep maxes/)).toBeVisible()
  })

  test('Reset Cycle keeps profile but resets to week 1 day 1', async ({ page }) => {
    await loadFixture(page, 'mid-cycle-bbb.json')
    await page.goto('/')

    await page.getByRole('link', { name: /settings/i }).click()
    await page.getByRole('button', { name: /Reset Cycle/i }).click()
    await expect(page.getByText('Reset Cycle?')).toBeVisible()
    // The confirm button says "Reset" — use exact match to not conflict with "Reset Everything"
    await page.getByRole('button', { name: 'Reset', exact: true }).click()

    // Navigate to workout — should be week 1 day 1
    await page.getByRole('link', { name: /workout/i }).click()
    await expect(page.getByText('Week 1: Squat')).toBeVisible()
    await expect(page.getByText(/Day 1 of 4/)).toBeVisible()
  })
})
