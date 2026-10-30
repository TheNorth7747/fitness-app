import assert from 'node:assert/strict'
import test from 'node:test'
import type { Exercise, MuscleGroup, WorkoutRecord, WorkoutSetInput } from '../../shared/api.js'
import {
  buildWeeklyReport,
  formatDuration,
  fromDateTimeLocal,
  startOfLocalWeek,
  summarizeWeek,
  toDateTimeLocal,
  weekRange,
  workoutsInRange,
} from '../../shared/analytics.js'

const exercise = (id: string, group: MuscleGroup = '胸'): Exercise => ({
  id,
  name: id,
  nameZh: id,
  category: 'test',
  equipment: 'body weight',
  target: 'test',
  primaryGroup: group,
  equipmentGroup: '自重',
  gifUrl: '',
  attribution: '',
  instructions: [],
})

const set = (exerciseId: string, reps = 10, weightKg = 40, setNumber = 1): WorkoutSetInput => ({
  exerciseKey: exerciseId,
  exerciseId,
  exerciseName: exerciseId,
  setNumber,
  reps,
  weightKg,
})

const workout = (id: string, completed: Date, sets: WorkoutSetInput[], durationMinutes = 60): WorkoutRecord => ({
  id,
  planDayId: 'g3-chest',
  planName: '健身房三分化',
  planDayName: '胸 · 肩 · 三头',
  startedAt: new Date(completed.getTime() - durationMinutes * 60_000).toISOString(),
  completedAt: completed.toISOString(),
  sets,
})

test('local week starts Monday and ends next Monday', () => {
  const sunday = new Date(2026, 9, 25, 18, 0)
  const monday = startOfLocalWeek(sunday)
  assert.equal(monday.getDay(), 1)
  assert.equal(monday.getDate(), 19)
  assert.equal(monday.getHours(), 0)

  const range = weekRange(new Date(2026, 9, 30, 12, 0))
  assert.equal(range.start.getDate(), 26)
  assert.equal(range.end.getDate(), 2)
  assert.equal(range.end.getMonth(), 10)
})

test('week filtering respects local Monday boundary', () => {
  const reference = new Date(2026, 9, 30, 12, 0)
  const range = weekRange(reference)
  const sunday = workout('sun', new Date(2026, 10, 1, 23, 59), [set('bench')])
  const nextMonday = workout('mon', new Date(2026, 10, 2, 0, 0), [set('bench')])
  const result = workoutsInRange([sunday, nextMonday], range)
  assert.deepEqual(result.map((item) => item.id), ['sun'])
})

test('summary counts workouts, sets, volume and duration', () => {
  const workoutA = workout('a', new Date(2026, 9, 27, 10, 0), [set('bench', 10, 40, 1), set('bench', 8, 40, 2)], 45)
  const workoutB = workout('b', new Date(2026, 9, 29, 10, 0), [set('row', 12, 30, 1)], 30)
  const summary = summarizeWeek([workoutA, workoutB], weekRange(new Date(2026, 9, 30, 12, 0)))
  assert.deepEqual(summary, { workoutCount: 2, totalSets: 3, volumeKg: 1080, durationSeconds: 4500 })
})

test('weekly report compares previous week and classifies muscle sets', () => {
  const reference = new Date(2026, 9, 30, 12, 0)
  const current = workout('current', new Date(2026, 9, 27, 10, 0), [set('bench', 10, 50, 1), set('squat', 8, 80, 2)])
  const previous = workout('previous', new Date(2026, 9, 20, 10, 0), [set('bench', 10, 50, 1)])
  const report = buildWeeklyReport(
    [current, previous],
    [exercise('bench', '胸'), exercise('squat', '腿')],
    reference,
  )
  assert.equal(report.current.workoutCount, 1)
  assert.equal(report.current.totalSets, 2)
  assert.equal(report.previous.totalSets, 1)
  assert.equal(report.changes.totalSets, 100)
  assert.equal(report.changes.workoutCount, 0)
  assert.equal(report.muscle.find((item) => item.group === '胸')?.sets, 1)
  assert.equal(report.muscle.find((item) => item.group === '腿')?.sets, 1)
  assert.equal(report.muscle.find((item) => item.group === '背')?.sets, 0)
  assert.equal(report.baselineAvailable, false)
})

test('baseline requires three active weeks and averages four calendar weeks', () => {
  const reference = new Date(2026, 9, 30, 12, 0)
  const current = workout('current', new Date(2026, 9, 27, 10, 0), [set('bench', 10, 40, 1)])
  const priorWeeks = [1, 2, 3].map((week) => workout(
    `w${week}`,
    new Date(2026, 9, 27 - week * 7, 10, 0),
    [set('bench', 10, 40, 1), set('bench', 10, 40, 2)],
  ))
  const report = buildWeeklyReport([current, ...priorWeeks], [exercise('bench', '胸')], reference)
  assert.equal(report.baselineAvailable, true)
  const chest = report.muscle.find((item) => item.group === '胸')
  assert.equal(chest?.sets, 1)
  assert.equal(chest?.baselineSets, 1.5)
})

test('unknown exercises fall back to the other muscle group', () => {
  const reference = new Date(2026, 9, 30, 12, 0)
  const report = buildWeeklyReport(
    [workout('current', new Date(2026, 9, 27, 10, 0), [set('missing')])],
    [],
    reference,
  )
  assert.equal(report.muscle.find((item) => item.group === '其他')?.sets, 1)
})

test('duration and datetime-local helpers keep display values stable', () => {
  assert.equal(formatDuration(0), '0 分钟')
  assert.equal(formatDuration(30), '<1 分钟')
  assert.equal(formatDuration(59 * 60), '59 分钟')
  assert.equal(formatDuration(90 * 60), '1 小时 30 分')
  assert.equal(formatDuration(120 * 60), '2 小时')
  const iso = new Date(2026, 9, 30, 9, 5).toISOString()
  assert.equal(fromDateTimeLocal(toDateTimeLocal(iso)), iso)
})
