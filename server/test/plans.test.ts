import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  clampSets, dayPlanTotals, distributeSets, getPlan, getPlans, recommendedCount, recommendedGroupPlan,
  resolveDayPlan, resolveGroupPlan, RECOMMENDED_SETS_MAX, RECOMMENDED_SETS_MIN, SETS_MAX, SETS_MIN,
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

test('every recommended exercise lands in the 4-5 set range', () => {
  for (const focus of ['quads', 'glutes'] as const) {
    for (const plan of getPlans(focus)) {
      for (const day of plan.days) {
        const items = resolveDayPlan(day, undefined, {})
        for (const item of items) {
          assert.ok(item.sets >= RECOMMENDED_SETS_MIN && item.sets <= RECOMMENDED_SETS_MAX,
            `${plan.id}/${day.id}/${item.option.key} 推荐 ${item.sets} 组，不在 ${RECOMMENDED_SETS_MIN}-${RECOMMENDED_SETS_MAX} 组`)
        }
        for (const group of day.groups) {
          const planned = recommendedGroupPlan(group)
          assert.equal(planned.length, recommendedCount(group))
          assert.equal(planned.reduce((sum, item) => sum + item.sets, 0), group.totalSets)
          assert.ok(planned.length >= group.selectMin)
          assert.ok(planned.length <= group.selectMax)
        }
      }
    }
  }
})

test('customization chooses exercises and sets, and falls back on invalid input', () => {
  const day = getPlan('gym-three', 'quads').days[0]
  const group = day.groups[0]
  const first = group.options[0].key
  const second = group.options[1].key

  const custom = resolveGroupPlan(group, { optionKeys: [second], sets: { [second]: 3 } })
  assert.deepEqual(custom.map((item) => item.option.key), [second])
  assert.equal(custom[0].sets, 3)

  const extended = resolveGroupPlan(group, { optionKeys: [first, second], sets: { [first]: 2, [second]: 2 } })
  assert.equal(extended.length, 2)
  assert.equal(extended.reduce((sum, item) => sum + item.sets, 0), 4)

  // Unknown exercise key, unknown set count and out-of-range values all fall back safely.
  const bogus = resolveGroupPlan(group, { optionKeys: ['nope'], sets: {} })
  assert.ok(bogus.length >= 1)
  const missingSets = resolveGroupPlan(group, { optionKeys: [second], sets: {} })
  assert.ok(missingSets[0].sets >= RECOMMENDED_SETS_MIN)
  const tooMany = resolveGroupPlan(group, { optionKeys: [second], sets: { [second]: 99 } })
  assert.equal(tooMany[0].sets, SETS_MAX)
  assert.equal(clampSets(0.4), SETS_MIN)

  const empty = resolveGroupPlan(group, { optionKeys: [], sets: {} })
  assert.equal(empty.length, recommendedGroupPlan(group).length)
})

test('day totals follow the customization and stay consistent', () => {
  const day = getPlan('gym-three', 'quads').days[0]
  const group = day.groups[0]
  const base = dayPlanTotals(day, undefined, {})
  assert.equal(base.sets, day.groups.reduce((sum, item) => sum + item.totalSets, 0))
  assert.equal(base.exercises, resolveDayPlan(day, undefined, {}).length)

  const customization = { [day.id]: { [group.id]: { optionKeys: [group.options[0].key], sets: { [group.options[0].key]: 4 } } } }
  const edited = dayPlanTotals(day, customization, {})
  const editedItems = resolveDayPlan(day, customization, {})
  assert.equal(edited.sets, editedItems.reduce((sum, item) => sum + item.sets, 0))
  assert.equal(edited.exercises, editedItems.length)
  // Only one group changed, so the rest still contributes its recommended volume.
  const restVolume = day.groups.slice(1).reduce((sum, item) => sum + item.totalSets, 0)
  assert.equal(edited.sets, 4 + restVolume)
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
