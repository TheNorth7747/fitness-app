import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildExerciseTrends,
  buildWorkoutSummary,
  estimatedOneRepMax,
  parseRepRange,
  recommendNextSet,
  suggestedSetValues,
  type WorkoutRecord,
} from '../../shared/progression.js'
import type { WorkoutSetInput } from '../../shared/api.js'

const set = (reps: number, weightKg: number, index = 1): WorkoutSetInput => ({
  exerciseKey: 'bench-press', exerciseId: '0025', exerciseName: '杠铃卧推', setNumber: index, reps, weightKg,
})

const workout = (id: string, completedAt: string, sets: WorkoutSetInput[]): WorkoutRecord => ({
  id, planDayId: 'g3-chest', planName: '健身房三分化', planDayName: '胸 · 肩 · 三头',
  startedAt: new Date(new Date(completedAt).getTime() - 3_600_000).toISOString(), completedAt, sets,
})

test('parses common rep range punctuation', () => {
  assert.deepEqual(parseRepRange('6–12'), { min: 6, max: 12 })
  assert.deepEqual(parseRepRange('8-15 次'), { min: 8, max: 15 })
  assert.deepEqual(parseRepRange('12-8'), { min: 8, max: 12 })
  assert.deepEqual(parseRepRange('unknown'), { min: 8, max: 12 })
})

test('Epley estimate ignores unloaded and unrealistic sets', () => {
  assert.equal(estimatedOneRepMax(100, 5), 116.7)
  assert.equal(estimatedOneRepMax(0, 10), null)
  assert.equal(estimatedOneRepMax(50, 31), null)
})

test('first session establishes a baseline without inventing load', () => {
  const recommendation = recommendNextSet([], 'bench-press', '6–12')
  assert.equal(recommendation.hasHistory, false)
  assert.equal(recommendation.weightKg, 0)
  assert.equal(recommendation.reps, 6)
  assert.equal(recommendation.increaseLoad, false)
})

test('double progression adds load only after every set reaches the top', () => {
  const history = [workout('w1', '2026-10-20T10:00:00Z', [set(12, 40, 1), set(12, 40, 2), set(12, 40, 3)])]
  const recommendation = recommendNextSet(history, 'bench-press', '6–12')
  assert.equal(recommendation.increaseLoad, true)
  assert.equal(recommendation.weightKg, 42.5)
  assert.equal(recommendation.reps, 6)
  assert.match(recommendation.reason, /加 2\.5 kg/)
  assert.deepEqual(suggestedSetValues(recommendation, 3), [
    { weightKg: 42.5, reps: 6 }, { weightKg: 42.5, reps: 6 }, { weightKg: 42.5, reps: 6 },
  ])
})

test('mid-range performance keeps weight and asks for one more rep', () => {
  const history = [workout('w1', '2026-10-20T10:00:00Z', [set(9, 40, 1), set(10, 40, 2)])]
  const recommendation = recommendNextSet(history, 'bench-press', '6–12')
  assert.equal(recommendation.increaseLoad, false)
  assert.equal(recommendation.weightKg, 40)
  assert.equal(recommendation.reps, 11)
})

test('a missed set never increases load', () => {
  const history = [workout('w1', '2026-10-20T10:00:00Z', [set(5, 50, 1), set(10, 50, 2)])]
  const recommendation = recommendNextSet(history, 'bench-press', '6–12')
  assert.equal(recommendation.increaseLoad, false)
  assert.equal(recommendation.weightKg, 50)
  assert.equal(recommendation.reps, 6)
  assert.match(recommendation.reason, /低于 6 次/)
})

test('bodyweight progression advances reps instead of load', () => {
  const history = [workout('w1', '2026-10-20T10:00:00Z', [set(12, 0, 1), set(12, 0, 2)])]
  const recommendation = recommendNextSet(history, 'bench-press', '6–12')
  assert.equal(recommendation.increaseLoad, false)
  assert.equal(recommendation.weightKg, 0)
  assert.equal(recommendation.reps, 12)
  assert.match(recommendation.reason, /更难变式/)
})

test('summary reports only genuine records and calculates session totals', () => {
  const prior = workout('w1', '2026-10-20T10:00:00Z', [set(10, 40, 1), set(10, 40, 2)])
  const current = workout('w2', '2026-10-22T10:00:00Z', [set(10, 42.5, 1), set(8, 42.5, 2)])
  const summary = buildWorkoutSummary(current, [current, prior], '腿臀 · 腹')
  assert.equal(summary.totalSets, 2)
  assert.equal(summary.durationMinutes, 60)
  assert.equal(summary.volumeKg, 765)
  assert.equal(summary.nextDayName, '腿臀 · 腹')
  assert.equal(summary.prs.length, 1)
  assert.equal(summary.prs[0].kind, 'e1rm')
  assert.equal(summary.prs[0].previous, 53.3)
})

test('exercise trends are chronological and keep the best metrics', () => {
  const older = workout('w1', '2026-10-20T10:00:00Z', [set(10, 40, 1)])
  const newer = workout('w2', '2026-10-22T10:00:00Z', [set(8, 45, 1), set(6, 45, 2)])
  const trends = buildExerciseTrends([newer, older])
  assert.equal(trends.length, 1)
  assert.equal(trends[0].name, '杠铃卧推')
  assert.deepEqual(trends[0].points.map((point) => point.workoutId), ['w1', 'w2'])
  assert.equal(trends[0].bestWeight, 45)
  assert.equal(trends[0].bestE1rm, 57)
})
