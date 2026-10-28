import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  clampSets, dayOptionKeys, dayPlanTotals, distributeSets, getPlan, getPlans, isLibraryKey, MAX_EXERCISES_PER_GROUP,
  moveDay, orderedDays, recommendedCount, recommendedGroupPlan, resolveDayPlan, resolveGroupPlan, RECOMMENDED_SETS_MAX, RECOMMENDED_SETS_MIN,
  SETS_MAX, SETS_MIN, type WorkoutGroup,
} from '../../shared/plans.js'

test('offers four selectable plans across gym and home', () => {
  const plans = getPlans()
  assert.equal(plans.length, 4)
  assert.ok(plans.some((plan) => plan.location === 'home'))
  assert.deepEqual(plans.map((plan) => plan.days.length), [3, 4, 4, 3])
})

test('leg focus changes only the intended primary group', () => {
  const quads = getPlan('gym-three', 'quads').days[2].groups[0]
  const glutes = getPlan('gym-three', 'glutes').days[2].groups[0]
  assert.equal(quads.name, '股四头肌')
  assert.equal(glutes.name, '臀大肌')
  assert.notEqual(quads.options[0].query, glutes.options[0].query)
})

test('distributes total sets without duplicating them', () => {
  assert.deepEqual(distributeSets(8, 1), [8])
  assert.deepEqual(distributeSets(10, 2), [5, 5])
  assert.deepEqual(distributeSets(10, 3), [4, 3, 3])
  assert.equal(distributeSets(7, 3).reduce((sum, value) => sum + value, 0), 7)
})

test('every workout group follows the source selection rules', () => {
  for (const plan of getPlans()) {
    for (const day of plan.days) {
      for (const group of day.groups) {
        assert.ok(group.selectMin >= 1)
        assert.ok(group.selectMax >= group.selectMin)
        assert.ok(group.options.length >= group.selectMin)
        assert.ok(group.totalSets >= group.selectMin)
      }
    }
  }
})

test('every plan option resolves to a real bundled exercise', async () => {
  const raw = await readFile(new URL('../../public/data/exercises.json', import.meta.url), 'utf8')
  const exercises = JSON.parse(raw) as Array<{ name: string; nameZh: string; instructions: string[]; gifUrl: string }>
  const names = new Set(exercises.map((item) => item.name.toLowerCase()))
  for (const plan of getPlans()) {
    for (const day of plan.days) {
      for (const group of day.groups) {
        for (const option of group.options) {
          assert.equal(names.has(option.query.toLowerCase()), true, `${option.nameZh} (${option.query}) 不在动作数据中`)
        }
      }
    }
  }
  assert.equal(exercises.every((item) => item.instructions.length > 0), true)
  assert.equal(exercises.every((item) => /[\u4e00-\u9fff]/.test(item.nameZh ?? '')), true)
  assert.equal(exercises.every((item) => !/(undefined|\[object)/.test(item.nameZh ?? '')), true)
  assert.equal(exercises.every((item) => item.gifUrl.startsWith('/media/exercises/')), true)
  // Media is downloaded on demand by scripts/fetch-media.py and intentionally not
  // committed, so only verify the files when a local mirror exists.
  const mediaDir = new URL('../../public/media/exercises/', import.meta.url)
  if (existsSync(mediaDir)) {
    assert.equal(exercises.every((item) => existsSync(new URL(`../../public${item.gifUrl}`, import.meta.url))), true)
  }
})

const fakeExercises = (group: WorkoutGroup) => group.options.map((option, index) => ({
  id: `${group.id}-${index}`,
  name: option.query,
  nameZh: option.nameZh,
  category: '测试', equipment: '测试', target: '测试',
  primaryGroup: '其他' as const, equipmentGroup: '其他' as const,
  gifUrl: '', attribution: '', instructions: [],
}))

test('every recommended exercise lands in the 4-5 set range', () => {
  for (const focus of ['quads', 'glutes'] as const) {
    for (const plan of getPlans(focus)) {
      for (const day of plan.days) {
        const exercises = day.groups.flatMap(fakeExercises)
        const items = resolveDayPlan(day, undefined, exercises)
        for (const item of items) {
          assert.ok(item.sets >= RECOMMENDED_SETS_MIN && item.sets <= RECOMMENDED_SETS_MAX,
            `${plan.id}/${day.id}/${item.name} 推荐 ${item.sets} 组，不在 ${RECOMMENDED_SETS_MIN}-${RECOMMENDED_SETS_MAX} 组`)
          assert.ok(item.name.length > 0)
        }
        for (const group of day.groups) {
          const planned = recommendedGroupPlan(group, exercises)
          assert.equal(planned.length, recommendedCount(group))
          assert.equal(planned.reduce((sum, item) => sum + item.sets, 0), group.totalSets)
          assert.ok(planned.length >= group.selectMin)
          assert.ok(planned.length <= group.selectMax)
        }
      }
    }
  }
})

test('recommended plan keeps the plan option key so history stays stable', () => {
  const group = getPlan('gym-three', 'quads').days[0].groups[0]
  const exercises = fakeExercises(group)
  const planned = recommendedGroupPlan(group, exercises)
  assert.deepEqual(planned.map((item) => item.key), group.options.slice(0, planned.length).map((option) => option.key))
  assert.deepEqual(planned.map((item) => item.exerciseId), exercises.slice(0, planned.length).map((item) => item.id))
})

test('customization accepts any library exercise and keeps its own key', () => {
  const day = getPlan('gym-three', 'quads').days[0]
  const group = day.groups[0]
  const exercises = fakeExercises(group)
  const outside = { ...exercises[0], id: 'lib-0001', name: 'cable chest fly', nameZh: '绳索夹胸' }

  const custom = resolveGroupPlan(group, { exerciseIds: [outside.id], sets: { [outside.id]: 3 } }, [...exercises, outside])
  assert.equal(custom.length, 1)
  assert.equal(custom[0].name, '绳索夹胸')
  assert.equal(custom[0].sets, 3)
  assert.equal(custom[0].key, `lib:${outside.id}`)

  const mixed = resolveGroupPlan(group, { exerciseIds: [exercises[0].id, outside.id], sets: { [exercises[0].id]: 5, [outside.id]: 4 } }, [...exercises, outside])
  assert.equal(mixed.length, 2)
  assert.equal(mixed[0].key, group.options[0].key)
  assert.equal(mixed[1].key, `lib:${outside.id}`)
  assert.equal(mixed.reduce((sum, item) => sum + item.sets, 0), 9)
})

test('customization falls back to the recommended plan on invalid input', () => {
  const group = getPlan('gym-three', 'quads').days[0].groups[0]
  const exercises = fakeExercises(group)
  const fallback = recommendedGroupPlan(group, exercises)

  // 动作库里不存在的 id 会被忽略，整组为空时回退推荐
  assert.equal(resolveGroupPlan(group, { exerciseIds: ['ghost'], sets: {} }, exercises).length, fallback.length)
  assert.equal(resolveGroupPlan(group, { exerciseIds: [], sets: {} }, exercises).length, fallback.length)
  assert.equal(resolveGroupPlan(group, undefined, exercises).length, fallback.length)

  // 组数越界会被夹紧，缺失组数回退到 4 组
  const clamped = resolveGroupPlan(group, { exerciseIds: [exercises[0].id], sets: { [exercises[0].id]: 99 } }, exercises)
  assert.equal(clamped[0].sets, SETS_MAX)
  const missing = resolveGroupPlan(group, { exerciseIds: [exercises[0].id], sets: {} }, exercises)
  assert.equal(missing[0].sets, RECOMMENDED_SETS_MIN)
  assert.equal(clampSets(0.4), SETS_MIN)
  // 超过上限的动作会被截断
  const tooMany = resolveGroupPlan(group, { exerciseIds: exercises.map((item) => item.id), sets: {} }, exercises)
  assert.ok(tooMany.length <= MAX_EXERCISES_PER_GROUP)
})

test('day totals follow the customization and stay consistent', () => {
  const day = getPlan('gym-three', 'quads').days[0]
  const group = day.groups[0]
  const exercises = day.groups.flatMap(fakeExercises)
  const base = dayPlanTotals(day, undefined, exercises)
  assert.equal(base.sets, day.groups.reduce((sum, item) => sum + item.totalSets, 0))
  assert.equal(base.exercises, resolveDayPlan(day, undefined, exercises).length)

  const customization = { [day.id]: { [group.id]: { exerciseIds: [exercises[0].id], sets: { [exercises[0].id]: 4 } } } }
  const editedItems = resolveDayPlan(day, customization, exercises)
  const edited = dayPlanTotals(day, customization, exercises)
  assert.equal(edited.sets, editedItems.reduce((sum, item) => sum + item.sets, 0))
  assert.equal(edited.exercises, editedItems.length)
  const restVolume = day.groups.slice(1).reduce((sum, item) => sum + item.totalSets, 0)
  assert.equal(edited.sets, 4 + restVolume)
})

test('training day order only accepts a full permutation of the plan days', () => {
  const plan = getPlan('gym-three', 'quads')
  const natural = plan.days.map((day) => day.id)
  assert.deepEqual(orderedDays(plan, []), plan.days)
  assert.deepEqual(orderedDays(plan, null), plan.days)
  // 合法排列
  const rotated = [...natural.slice(1), natural[0]]
  assert.deepEqual(orderedDays(plan, rotated).map((day) => day.id), rotated)
  // 重复、缺失、未知 id 一律回退自然顺序
  assert.deepEqual(orderedDays(plan, [natural[0], natural[0], natural[1]]), plan.days)
  assert.deepEqual(orderedDays(plan, natural.slice(0, 2)), plan.days)
  assert.deepEqual(orderedDays(plan, [...natural.slice(1), 'ghost']), plan.days)
  // 上下移动
  assert.deepEqual(moveDay(natural, 0, 2), [natural[1], natural[2], natural[0]])
  assert.deepEqual(moveDay(natural, 2, 0), [natural[2], natural[0], natural[1]])
  assert.deepEqual(moveDay(natural, 1, 1), natural)
  assert.deepEqual(moveDay(natural, -1, 0), natural)
  assert.deepEqual(moveDay(natural, 0, 9), natural)
})

test('library keys are accepted when a workout is saved', () => {
  const day = getPlan('gym-three', 'quads').days[0]
  const keys = dayOptionKeys(day)
  assert.ok(keys.size > 0)
  assert.equal(isLibraryKey('lib:0017'), true)
  assert.equal(isLibraryKey('lat-pulldown'), false)
})

test('distributed sets never lose a set', () => {
  for (const total of [4, 5, 7, 8, 10, 12, 15]) {
    for (const count of [1, 2, 3]) {
      const parts = distributeSets(total, count)
      assert.equal(parts.length, count)
      assert.equal(parts.reduce((sum, item) => sum + item, 0), total)
      assert.ok(Math.max(...parts) - Math.min(...parts) <= 1)
    }
  }
})
