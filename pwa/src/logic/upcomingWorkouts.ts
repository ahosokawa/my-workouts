import type {
  AccessoryExercise,
  MainLift,
  PrescribedSet,
  ProgramVariant,
  SupplementalOverride,
  UserProfile,
} from '../types'
import {
  MainLift as ML,
  ProgramType,
  liftDisplayName,
} from '../types'
import { prescribedSets } from './calculator'
import {
  hypertrophyDayLabel,
  hypertrophyMainSets,
  mainLiftForDay,
  topSetRepRange,
} from './hypertrophyCalculator'
import { getAccessories, getHypertrophyAccessories } from './accessories'

export interface UpcomingWorkout {
  week: number
  day: number
  lift: MainLift | null
  title: string
  variant?: ProgramVariant
  mainSets: PrescribedSet[]
  supplementalSets: PrescribedSet[]
  supplementalDisplayName?: string
  accessories: AccessoryExercise[]
}

function trainingMaxFor(profile: UserProfile, lift: MainLift): number {
  switch (lift) {
    case ML.Squat: return profile.squatTM
    case ML.BenchPress: return profile.benchTM
    case ML.Deadlift: return profile.deadliftTM
    case ML.ShoulderPress: return profile.pressTM
  }
}

function buildOne(
  profile: UserProfile,
  week: number,
  day: number,
  customAccessories: Record<number, AccessoryExercise[]> | null,
  customSupplemental: Record<number, SupplementalOverride> | null,
): UpcomingWorkout {
  const programType = profile.programType ?? ProgramType.FiveThreeOne
  const isHypertrophy = programType === ProgramType.Hypertrophy
  const lift = mainLiftForDay(programType, day, profile.dayOrder)
  const accessoriesSlot = lift ?? ML.ShoulderPress

  if (isHypertrophy) {
    const accessories =
      customAccessories?.[accessoriesSlot] ?? getHypertrophyAccessories(accessoriesSlot)
    let mainSets: PrescribedSet[] = []
    if (lift) {
      const topSetLbs = profile.hypertrophyTopSets?.[lift]
      if (topSetLbs && topSetLbs > 0) {
        const range = topSetRepRange(lift)
        mainSets = hypertrophyMainSets(topSetLbs, range.min, range.max)
      }
    }
    return {
      week,
      day,
      lift,
      title: hypertrophyDayLabel(day),
      mainSets,
      supplementalSets: [],
      accessories,
    }
  }

  if (!lift) {
    return {
      week,
      day,
      lift: null,
      title: '',
      mainSets: [],
      supplementalSets: [],
      accessories: [],
    }
  }

  const variant = profile.currentVariant ?? 'fsl'
  const suppOverride = customSupplemental?.[lift] ?? null
  const tm = trainingMaxFor(profile, lift)
  const all = prescribedSets(tm, week, variant, suppOverride?.trainingMaxLbs)
  const mainSets = all.filter((s) => !s.isSupplemental)
  const supplementalSets = all.filter((s) => s.isSupplemental)
  const supplementalDisplayName = suppOverride?.exercise.name ?? liftDisplayName(lift)
  const accessories = customAccessories?.[lift] ?? getAccessories(lift)

  return {
    week,
    day,
    lift,
    title: liftDisplayName(lift),
    variant,
    mainSets,
    supplementalSets,
    supplementalDisplayName,
    accessories,
  }
}

/** Build the prescription for every workout from tomorrow through the final day of the current cycle.
 *  Returns [] when the cycle is complete, during a deload interlude, or when today is the last day. */
export function getUpcomingWorkouts(
  profile: UserProfile,
  customAccessories: Record<number, AccessoryExercise[]> | null,
  customSupplemental: Record<number, SupplementalOverride> | null,
): UpcomingWorkout[] {
  if (profile.isCycleComplete) return []
  if (profile.isDeloading) return []

  const cycleWeeks = profile.cycleWeeks ?? 3
  const DAYS_PER_WEEK = 4

  let day = profile.currentDay + 1
  let week = profile.currentWeek
  if (day > DAYS_PER_WEEK) {
    day = 1
    week += 1
  }
  if (week > cycleWeeks) return []

  const out: UpcomingWorkout[] = []
  for (let w = week; w <= cycleWeeks; w++) {
    const startDay = w === week ? day : 1
    for (let d = startDay; d <= DAYS_PER_WEEK; d++) {
      out.push(buildOne(profile, w, d, customAccessories, customSupplemental))
    }
  }
  return out
}
