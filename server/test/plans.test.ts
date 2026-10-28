import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { distributeSets, getPlan, getPlans } from '../../shared/plans.js'

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
