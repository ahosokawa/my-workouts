import { Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const EMPTY_ACTIVE_WORKOUT = {
  isActive: false,
  startTime: null,
  completedMain: [],
  completedAccessory: [],
  amrapReps: 0,
  accWeights: {},
  accReps: {},
  mainWeights: {},
  mainReps: {},
  lastSetTime: null,
  showRestTimer: false,
}

/**
 * Load a test fixture JSON file into localStorage before navigating.
 * The fixture format matches the app's export format (version 1).
 * This converts it to Zustand's persist format and injects it.
 */
export async function loadFixture(page: Page, fixtureName: string) {
  const fixturePath = path.join(__dirname, '..', 'test-fixtures', fixtureName)
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))

  const zustandState = {
    state: {
      profile: fixture.profile,
      sessions: fixture.sessions ?? [],
      setLogs: fixture.setLogs ?? [],
      wilksEntries: fixture.wilksEntries ?? [],
      activeWorkout: EMPTY_ACTIVE_WORKOUT,
      customAccessories: fixture.customAccessories ?? null,
      savedExercises: fixture.savedExercises ?? [],
    },
    version: 0,
  }

  await page.addInitScript((data) => {
    localStorage.setItem('my-workouts-storage', JSON.stringify(data))
  }, zustandState)
}

/**
 * Like loadFixture, but sets localStorage via evaluate after navigating.
 * Use this when you need localStorage to NOT be overwritten on reload.
 */
export async function loadFixtureOnce(page: Page, fixtureName: string, url: string) {
  const fixturePath = path.join(__dirname, '..', 'test-fixtures', fixtureName)
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))

  const zustandState = {
    state: {
      profile: fixture.profile,
      sessions: fixture.sessions ?? [],
      setLogs: fixture.setLogs ?? [],
      wilksEntries: fixture.wilksEntries ?? [],
      activeWorkout: EMPTY_ACTIVE_WORKOUT,
      customAccessories: fixture.customAccessories ?? null,
      savedExercises: fixture.savedExercises ?? [],
    },
    version: 0,
  }

  // Navigate first to get a page context, set localStorage, then reload
  await page.goto(url)
  await page.evaluate((data) => {
    localStorage.setItem('my-workouts-storage', JSON.stringify(data))
  }, zustandState)
  await page.reload()
}
