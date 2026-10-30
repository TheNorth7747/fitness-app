import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type WorkoutRecord } from './api.js'

export interface WeekRange {
  /** 本地时区周一 00:00（含） */
  start: Date
  /** 下周一 00:00（不含） */
  end: Date
}

export interface WeekSummary {
  workoutCount: number
  totalSets: number
  volumeKg: number
  durationSeconds: number
}

export interface MuscleWeekVolume {
  group: MuscleGroup
  sets: number
  baselineSets: number | null
}

export interface WeeklyReport {
  range: WeekRange
  previousRange: WeekRange
  current: WeekSummary
  previous: WeekSummary
  changes: {
    workoutCount: number | null
    totalSets: number | null
    volumeKg: number | null
    durationSeconds: number | null
  }
  muscle: MuscleWeekVolume[]
  baselineAvailable: boolean
}

/** 本地时区的周一 00:00，避免 UTC 日期截断把周界算错 */
export function startOfLocalWeek(value: Date): Date {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const mondayOffset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - mondayOffset)
  return date
}

export function weekRange(reference: Date, offsetWeeks = 0): WeekRange {
  const base = startOfLocalWeek(reference)
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetWeeks * 7)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  return { start, end }
}

export function workoutsInRange(workouts: WorkoutRecord[], range: WeekRange): WorkoutRecord[] {
  const start = range.start.getTime()
  const end = range.end.getTime()
  return workouts.filter((workout) => {
    const completed = new Date(workout.completedAt).getTime()
    return Number.isFinite(completed) && completed >= start && completed < end
  })
}

export function summarizeWeek(workouts: WorkoutRecord[], range: WeekRange): WeekSummary {
  const inWeek = workoutsInRange(workouts, range)
  return inWeek.reduce<WeekSummary>((summary, workout) => {
    const started = new Date(workout.startedAt).getTime()
    const completed = new Date(workout.completedAt).getTime()
    const duration = Number.isFinite(started) && Number.isFinite(completed) ? Math.max(0, completed - started) : 0
    return {
      workoutCount: summary.workoutCount + 1,
      totalSets: summary.totalSets + workout.sets.length,
      volumeKg: summary.volumeKg + workout.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0),
      durationSeconds: summary.durationSeconds + Math.round(duration / 1000),
    }
  }, { workoutCount: 0, totalSets: 0, volumeKg: 0, durationSeconds: 0 })
}

const percentChange = (current: number, previous: number): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null

function muscleSetsFor(workoutList: WorkoutRecord[], exercises: Exercise[]): Record<MuscleGroup, number> {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const totals = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, 0])) as Record<MuscleGroup, number>
  for (const workout of workoutList) {
    for (const set of workout.sets) {
      const group = byId.get(set.exerciseId)?.primaryGroup ?? '其他'
      totals[group] += 1
    }
  }
  return totals
}

export function buildWeeklyReport(workouts: WorkoutRecord[], exercises: Exercise[], reference = new Date()): WeeklyReport {
  const range = weekRange(reference, 0)
  const previousRange = weekRange(reference, -1)
  const current = summarizeWeek(workouts, range)
  const previous = summarizeWeek(workouts, previousRange)

  const currentMuscle = muscleSetsFor(workoutsInRange(workouts, range), exercises)
  const baselineRanges = [-4, -3, -2, -1].map((offset) => weekRange(reference, offset))
  const activeBaselineWeeks = baselineRanges.filter((item) => workoutsInRange(workouts, item).length > 0).length
  const baselineAvailable = activeBaselineWeeks >= 3
  const baselineTotals = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, 0])) as Record<MuscleGroup, number>
  for (const item of baselineRanges) {
    const totals = muscleSetsFor(workoutsInRange(workouts, item), exercises)
    for (const group of MUSCLE_GROUPS) baselineTotals[group] += totals[group]
  }

  return {
    range,
    previousRange,
    current,
    previous,
    changes: {
      workoutCount: percentChange(current.workoutCount, previous.workoutCount),
      totalSets: percentChange(current.totalSets, previous.totalSets),
      volumeKg: percentChange(current.volumeKg, previous.volumeKg),
      durationSeconds: percentChange(current.durationSeconds, previous.durationSeconds),
    },
    muscle: MUSCLE_GROUPS.map((group) => ({
      group,
      sets: currentMuscle[group],
      baselineSets: baselineAvailable ? Math.round((baselineTotals[group] / 4) * 10) / 10 : null,
    })),
    baselineAvailable,
  }
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 分钟'
  if (totalSeconds < 60) return '<1 分钟'
  const minutes = Math.round(totalSeconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`
}

export function toDateTimeLocal(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateTimeLocal(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
