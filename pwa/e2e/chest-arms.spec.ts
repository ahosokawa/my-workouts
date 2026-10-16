import { test, expect, type Page } from '@playwright/test'
import { loadFixtureOnce } from './helpers'

async function state(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('my-workouts-storage')!).state)
}
async function activate(page: Page) {
  await loadFixtureOnce(page, 'upper-lower-day-1.json', '/')
  const before = await state(page)
  await page.getByRole('link', { name: /settings/i }).click()
  const family = page.getByRole('group', {name:'Upper/Lower',exact:true})
  await expect(family.getByRole('button',{name:'Upper/Lower — Top Set',exact:true})).toHaveAttribute('aria-pressed','true')
  await family.getByRole('button', { name: 'Upper/Lower — Hypertrophy', exact: true }).click()
  await page.getByRole('button', { name: 'Switch', exact: true }).click()
  await page.getByRole('link', { name: /workout/i }).click()
  await expect(page.getByRole('heading', {name:'Week 1: Upper A — Chest'})).toBeVisible()
  return before
}

test.use({ viewport: {width: 390,height:844} })

test('additive selection, manual weight, RIR, warmups, partial save and history snapshot on mobile', async ({page}) => {
  const before = await activate(page)
  await page.getByRole('button', {name:'Start Workout'}).click()
  // First working row has a weight input and a reps input; warmups use labeled inputs.
  const working = page.locator('input[placeholder="lbs"]').first()
  await working.fill('135')
  await page.locator('input[placeholder="reps"]').first().fill('8')
  await page.getByLabel('Bench Press set 1 RIR', {exact:true}).selectOption('2')
  await page.getByText('Good form on every working set').first().click()
  await page.getByRole('button',{name:'Mark complete',exact:true}).first().click()
  await page.getByLabel('Bench Press warm-up 1 weight').fill('65')
  const checks = page.locator('input[type=checkbox]')
  await checks.nth(1).check()
  await page.reload()
  await expect(page.getByLabel('Bench Press set 1 RIR', {exact:true})).toHaveValue('2')
  let current = await state(page)
  expect(current.activeWorkout.accWeights['Bench Press-0']).toBe('135')
  expect(current.activeWorkout.accReps['Bench Press-0']).toBe('8')
  expect(current.activeWorkout.prescription[0].sets).toBe(3)
  expect(current.activeWorkout.warmups).toContain('ca-bench-0')
  expect(current.sessions).toEqual(before.sessions)
  await page.getByRole('button',{name:'Finish Workout'}).scrollIntoViewIfNeeded()
  const box = await page.getByRole('button',{name:'Finish Workout'}).boundingBox()
  expect(box!.y + box!.height).toBeLessThan(844 - 45)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button',{name:'Finish Workout'}).click()
  await page.getByRole('button',{name:'Finish',exact:true}).click()
  current = await state(page)
  expect(current.sessions.slice(0,-1)).toEqual(before.sessions)
  expect(current.setLogs.slice(0,before.setLogs.length)).toEqual(before.setLogs)
  const saved = current.sessions.at(-1)
  expect(saved.dayLabel).toBe('Upper A — Chest')
  expect(saved.workingSetsCompleted).toBe(false)
  const sets = current.setLogs.filter((l: {sessionId:string}) => l.sessionId === saved.id)
  expect(sets.filter((l: {isWarmup:boolean}) => !l.isWarmup)).toHaveLength(17)
  expect(sets.find((l: {exerciseName:string,isWarmup:boolean,setIndex:number}) => l.exerciseName==='Bench Press'&&!l.isWarmup&&l.setIndex===0)).toMatchObject({weight:135,actualReps:8,rir:2,isCompleted:true})
  await page.getByRole('link',{name:/history/i}).click()
  await page.getByText('Week 1: Upper A — Chest').click()
  await expect(page.getByRole('heading',{name:'Week 1: Upper A — Chest'})).toBeVisible()
  await expect(page.getByText('8 reps · RIR 2')).toBeVisible()
})

test('optional OHP is off, enabled explicitly, and bodyweight stores BW plus added once', async ({page}) => {
  await activate(page)
  await page.getByRole('button',{name:'Upper B',exact:true}).click()
  await expect(page.getByText('Include optional Overhead Press (2 sets)')).toBeVisible()
  await page.getByRole('button',{name:'Start Workout'}).click()
  let current = await state(page)
  expect(current.activeWorkout.prescription).toHaveLength(6)
  expect(current.activeWorkout.prescription.some((e:{name:string})=>e.name==='Overhead Press')).toBe(false)
  // Dips: existing convention is TOTAL BW + added; only added load is edited.
  await page.locator('input[placeholder="0"]').first().fill('10')
  current = await state(page)
  expect(current.activeWorkout.accWeights['Dips-0']).toBe('190')
  await page.reload()
  await expect(page.locator('input[placeholder="0"]').first()).toHaveValue('10')
  // Restart from the isolated fixture for the enabled case.
  await activate(page)
  await page.getByRole('button',{name:'Upper B',exact:true}).click()
  await page.getByText('Include optional Overhead Press (2 sets)').click()
  await page.getByRole('button',{name:'Start Workout'}).click()
  current = await state(page)
  expect(current.activeWorkout.prescription.at(-1)).toMatchObject({name:'Overhead Press',sets:2,repRangeMin:6,repRangeMax:10})
})

test('complete working sets unlock an optional suggestion without applying it', async ({page}) => {
  await activate(page)
  await page.getByRole('button',{name:'Start Workout'}).click()
  const current = await state(page)
  for (const ex of current.activeWorkout.prescription) {
    const section = page.locator('div.rounded-xl.overflow-hidden').filter({has:page.getByRole('heading',{name:ex.name,exact:true})})
    const weightInput = section.locator('input[placeholder="lbs"]').first()
    if (await weightInput.count()) await weightInput.fill(ex.name === 'Bench Press' ? '135' : '20')
    await section.locator('input[placeholder="reps"]').first().fill(String(ex.repRangeMax))
    await section.getByText('Good form on every working set').click()
    for (const select of await section.getByRole('combobox').all()) await select.selectOption('2')
    for (let i=0;i<ex.sets;i++) await section.getByRole('button',{name:'Mark complete',exact:true}).first().click()
  }
  await page.getByRole('button',{name:'Finish Workout'}).click()
  await page.getByRole('button',{name:'Finish',exact:true}).click()
  const saved = await state(page)
  expect(saved.sessions.at(-1).workingSetsCompleted).toBe(true)
  // Simulate the next week's occurrence using isolated fixture storage.
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('my-workouts-storage')!)
    Object.assign(data.state.profile,{currentWeek:2,currentDay:1,completedDaysThisWeek:[]})
    localStorage.setItem('my-workouts-storage',JSON.stringify(data))
  })
  await page.reload()
  await expect(page.getByText('Eligible next load: 140 lbs. Optional: enter it manually when ready.')).toBeVisible()
  await page.getByRole('button',{name:'Start Workout'}).click()
  const next = await state(page)
  expect(next.activeWorkout.accWeights['Bench Press-0']).toBe('135')
  expect(next.activeWorkout.completedMain).toEqual([])
})

test('active prescriptions, units and BW stay pinned when live settings drift', async ({page}) => {
  await activate(page)
  await page.getByRole('button',{name:'Start Workout'}).click()
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('my-workouts-storage')!)
    data.state.customAccessories[2][0].sets=1
    data.state.customAccessories[2][0].name='Different Bench'
    data.state.profile.units='kg'
    data.state.profile.bodyWeightLbs=200
    data.state.profile.currentDay=3
    localStorage.setItem('my-workouts-storage',JSON.stringify(data))
  })
  await page.reload()
  await expect(page.getByRole('heading',{name:'Week 1: Upper A — Chest'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Bench Press',exact:true})).toBeVisible()
  await expect(page.getByLabel('Bench Press set 3 RIR',{exact:true})).toBeVisible()
  await expect(page.getByText('BW 180 +').first()).toBeVisible()
  await expect(page.locator('input[placeholder="lbs"]').first()).toBeVisible()
})

test('new program cycle completion offers a reduced week or next cycle without TM progression', async ({page}) => {
  await activate(page)
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('my-workouts-storage')!)
    data.state.profile.isCycleComplete=true
    localStorage.setItem('my-workouts-storage',JSON.stringify(data))
  })
  await page.reload()
  await expect(page.getByRole('heading',{name:/Cycle \d+ Complete/})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Top-Set Progress'})).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'New Training Maxes'})).toHaveCount(0)
  await expect(page.getByText('Half-volume movement guide; working weights remain your choice')).toBeVisible()
  const before = await state(page)
  await page.getByRole('button',{name:'Skip Go straight to next cycle'}).click()
  await page.getByRole('button',{name:/^Start Cycle/}).click()
  await expect(page.getByRole('heading',{name:'Week 1: Upper A — Chest'})).toBeVisible()
  const after = await state(page)
  expect(after.profile.benchTM).toBe(before.profile.benchTM)
  expect(after.profile.cycleNumber).toBe(before.profile.cycleNumber+1)
})
