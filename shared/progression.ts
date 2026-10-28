import type { WorkoutRecord, WorkoutSetInput } from './api.js'

export interface RepRange {
  min: number
  max: number
}

export interface ExerciseSessionPoint {
  workoutId: string
  completedAt: string
  sets: WorkoutSetInput[]
  bestWeight: number
  bestReps: number
  e1rm: number | null
  volume: number
}

export interface ExerciseTrend {
  key: string
  name: string
  points: ExerciseSessionPoint[]
  bestWeight: number
  bestReps: number
  bestE1rm: number | null
  last: ExerciseSessionPoint
}

export interface Recommendation {
  hasHistory: boolean
  weightKg: number
  reps: number
  reason: string
  increaseLoad: boolean
  previousSets: WorkoutSetInput[]
  targetMin: number
  targetMax: number
}

export interface PersonalRecord {
  exerciseKey: string
  exerciseName: string
  kind: 'e1rm' | 'reps'
  value: number
  previous: number | null
}

export interface WorkoutSummary {
  workoutId: string
  durationMinutes: number
  totalSets: number
  exerciseCount: number
  volumeKg: number
  prs: PersonalRecord[]
  nextDayName: string
}

export function parseRepRange(range: string): RepRange {
  const match = range.match(/(\d+)\s*[–—-]\s*(\d+)/)
  if (!match) return { min: 8, max: 12 }
  const min = Number(match[1])
  const max = Number(match[2])
  return min <= max ? { min, max } : { min: max, max: min }
}

export function estimatedOneRepMax(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg <= 0 || reps < 1 || reps > 30) return null
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

const setsFor = (workout: WorkoutRecord, exerciseKey: string) =>
  workout.sets.filter((set) => set.exerciseKey === exerciseKey).sort((a, b) => a.setNumber - b.setNumber)

const sessionPoint = (workout: WorkoutRecord, sets: WorkoutSetInput[]): ExerciseSessionPoint => {
  const weighted = sets.filter((set) => set.weightKg > 0)
  const e1rms = weighted.map((set) => estimatedOneRepMax(set.weightKg, set.reps)).filter((value): value is number => value !== null)
  return {
    workoutId: workout.id,
    completedAt: workout.completedAt,
    sets,
    bestWeight: sets.reduce((best, set) => Math.max(best, set.weightKg), 0),
    bestReps: sets.reduce((best, set) => Math.max(best, set.reps), 0),
    e1rm: e1rms.length ? Math.max(...e1rms) : null,
    volume: sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0),
  }
}

export function latestExerciseSession(workouts: WorkoutRecord[], exerciseKey: string): ExerciseSessionPoint | null {
  const sorted = [...workouts].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
  for (const workout of sorted) {
    const sets = setsFor(workout, exerciseKey)
    if (sets.length) return sessionPoint(workout, sets)
  }
  return null
}

export function recommendNextSet(
  workouts: WorkoutRecord[],
  exerciseKey: string,
  repRange: string,
  incrementKg = 2.5,
): Recommendation {
  const range = parseRepRange(repRange)
  const last = latestExerciseSession(workouts, exerciseKey)
  if (!last) {
    return {
      hasHistory: false,
      weightKg: 0,
      reps: range.min,
      reason: '第一次训练这个动作，先用能稳定完成的重量建立基线。',
      increaseLoad: false,
      previousSets: [],
      targetMin: range.min,
      targetMax: range.max,
    }
  }

  const loaded = last.bestWeight > 0
  const maxReps = last.bestReps
  const allAtTop = last.sets.every((set) => set.reps >= range.max)
  const belowRange = last.sets.some((set) => set.reps < range.min)

  if (loaded && allAtTop) {
    const nextWeight = Math.round((last.bestWeight + incrementKg) * 2) / 2
    return {
      hasHistory: true,
      weightKg: nextWeight,
      reps: range.min,
      reason: `上次全部达到 ${range.max} 次，建议加 ${incrementKg} kg，次数回到 ${range.min} 次。`,
      increaseLoad: true,
      previousSets: last.sets,
      targetMin: range.min,
      targetMax: range.max,
    }
  }

  if (belowRange) {
    return {
      hasHistory: true,
      weightKg: last.bestWeight,
      reps: range.min,
      reason: `上次有组低于 ${range.min} 次，保持重量，先把次数补足。`,
      increaseLoad: false,
      previousSets: last.sets,
      targetMin: range.min,
      targetMax: range.max,
    }
  }

  if (!loaded && allAtTop) {
    return {
      hasHistory: true,
      weightKg: 0,
      reps: range.max,
      reason: `徒手动作已稳定达到 ${range.max} 次，建议换更难变式或增加负重。`,
      increaseLoad: false,
      previousSets: last.sets,
      targetMin: range.min,
      targetMax: range.max,
    }
  }

  const nextReps = Math.min(range.max, maxReps + 1)
  return {
    hasHistory: true,
    weightKg: last.bestWeight,
    reps: nextReps,
    reason: `上次最高 ${maxReps} 次，保持重量，这次先冲 ${nextReps} 次。`,
    increaseLoad: false,
    previousSets: last.sets,
    targetMin: range.min,
    targetMax: range.max,
  }
}

export function suggestedSetValues(recommendation: Recommendation, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const previous = recommendation.previousSets[index]
    return {
      weightKg: recommendation.increaseLoad ? recommendation.weightKg : previous?.weightKg ?? recommendation.weightKg,
      reps: recommendation.reps,
    }
  })
}

export function buildExerciseTrends(workouts: WorkoutRecord[]): ExerciseTrend[] {
  const byKey = new Map<string, { name: string; points: ExerciseSessionPoint[] }>()
  for (const workout of workouts) {
    const keys = new Set(workout.sets.map((set) => set.exerciseKey))
    for (const key of keys) {
      const sets = setsFor(workout, key)
      if (!sets.length) continue
      const entry = byKey.get(key) ?? { name: sets[0].exerciseName, points: [] }
      entry.name = sets[0].exerciseName
      entry.points.push(sessionPoint(workout, sets))
      byKey.set(key, entry)
    }
  }
  return Array.from(byKey.entries()).map(([key, entry]) => {
    const points = entry.points.sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
    const e1rms = points.map((point) => point.e1rm).filter((value): value is number => value !== null)
    return {
      key,
      name: entry.name,
      points,
      bestWeight: Math.max(...points.map((point) => point.bestWeight)),
      bestReps: Math.max(...points.map((point) => point.bestReps)),
      bestE1rm: e1rms.length ? Math.max(...e1rms) : null,
      last: points[points.length - 1],
    }
  }).sort((a, b) => new Date(b.last.completedAt).getTime() - new Date(a.last.completedAt).getTime())
}

export function buildWorkoutSummary(workout: WorkoutRecord, priorWorkouts: WorkoutRecord[], nextDayName: string): WorkoutSummary {
  const keys = new Set(workout.sets.map((set) => set.exerciseKey))
  const prs: PersonalRecord[] = []
  for (const key of keys) {
    const current = sessionPoint(workout, setsFor(workout, key))
    const previous = priorWorkouts
      .filter((item) => item.id !== workout.id)
      .filter((item) => item.sets.some((set) => set.exerciseKey === key))
      .map((item) => sessionPoint(item, setsFor(item, key)))
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]

    if (current.e1rm !== null) {
      const priorBest = previous?.e1rm ?? null
      if (priorBest !== null && current.e1rm > priorBest + 0.05) {
        prs.push({ exerciseKey: key, exerciseName: current.sets[0].exerciseName, kind: 'e1rm', value: current.e1rm, previous: priorBest })
      }
    } else if (previous) {
      if (current.bestReps > previous.bestReps) {
        prs.push({ exerciseKey: key, exerciseName: current.sets[0].exerciseName, kind: 'reps', value: current.bestReps, previous: previous.bestReps })
      }
    }
  }
  const started = new Date(workout.startedAt).getTime()
  const completed = new Date(workout.completedAt).getTime()
  return {
    workoutId: workout.id,
    durationMinutes: Math.max(1, Math.round((completed - started) / 60_000)),
    totalSets: workout.sets.length,
    exerciseCount: keys.size,
    volumeKg: Math.round(workout.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0)),
    prs,
    nextDayName,
  }
}
