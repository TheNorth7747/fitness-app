import { useState } from 'react'
import type { Exercise } from '../../shared/api'
import {
  clampSets, MAX_EXERCISES_PER_GROUP, recommendedGroupPlan, resolveGroupPlan, RECOMMENDED_SETS_MAX,
  RECOMMENDED_SETS_MIN, SETS_MAX, SETS_MIN, type GroupCustomization, type PlanDay, type WorkoutGroup,
} from '../../shared/plans'
import { matchExercise } from '../../shared/exercises'
import { ExerciseImage } from './ExerciseImage'
import { ExercisePicker } from './ExercisePicker'
import { Icon } from './Icon'

type DayEntry = Record<string, GroupCustomization>

/** 单个训练日的动作与组数编辑器：推荐方案始终作为对照展示 */
export function PlanDayEditor({ day, exercises, entry, selections, onChange }: {
  day: PlanDay
  exercises: Exercise[]
  entry: DayEntry | undefined
  selections: Record<string, string>
  onChange: (next: DayEntry | undefined) => void
}) {
  const [picking, setPicking] = useState<{ group: WorkoutGroup; replaceId?: string } | null>(null)
  const [notice, setNotice] = useState('')

  function write(group: WorkoutGroup, next: GroupCustomization | null) {
    setNotice('')
    const copy = { ...(entry ?? {}) }
    if (next) copy[group.id] = next
    else delete copy[group.id]
    onChange(Object.keys(copy).length ? copy : undefined)
  }

  const currentOf = (group: WorkoutGroup) => resolveGroupPlan(group, entry?.[group.id], exercises, selections)
  const recommendedOf = (group: WorkoutGroup) => recommendedGroupPlan(group, exercises, selections)

  function commit(group: WorkoutGroup, items: { id: string; sets: number }[]) {
    const ids: string[] = []
    const sets: Record<string, number> = {}
    for (const item of items) {
      if (!item.id || ids.includes(item.id)) continue
      if (ids.length >= MAX_EXERCISES_PER_GROUP) break
      ids.push(item.id)
      sets[item.id] = clampSets(item.sets)
    }
    write(group, { exerciseIds: ids, sets })
  }

  function changeSets(group: WorkoutGroup, id: string, delta: number) {
    const current = currentOf(group)
    commit(group, current.map((item) => ({ id: item.exerciseId, sets: item.exerciseId === id ? item.sets + delta : item.sets })))
  }

  function remove(group: WorkoutGroup, id: string) {
    const current = currentOf(group)
    if (current.length <= 1) { setNotice('每组至少保留一个动作。'); return }
    commit(group, current.filter((item) => item.exerciseId !== id).map((item) => ({ id: item.exerciseId, sets: item.sets })))
  }

  function addExercise(group: WorkoutGroup, exercise: Exercise) {
    const current = currentOf(group)
    if (current.some((item) => item.exerciseId === exercise.id)) { setPicking(null); return }
    if (current.length >= MAX_EXERCISES_PER_GROUP) { setNotice(`一组最多 ${MAX_EXERCISES_PER_GROUP} 个动作。`); setPicking(null); return }
    const target = picking?.replaceId
    const next = target
      ? current.map((item) => (item.exerciseId === target ? { id: exercise.id, sets: item.sets } : { id: item.exerciseId, sets: item.sets }))
      : [...current.map((item) => ({ id: item.exerciseId, sets: item.sets })), { id: exercise.id, sets: RECOMMENDED_SETS_MIN }]
    commit(group, next)
    setPicking(null)
  }

  if (!exercises.length) return <p className="history-hint">动作库加载中，加载完成后即可调整动作与组数。</p>

  return <>
    <div className="editor-groups">{day.groups.map((group) => {
      const current = currentOf(group)
      const reference = recommendedOf(group)
      const isCustom = Boolean(entry?.[group.id])
      return <section className={`editor-card ${isCustom ? 'customized' : ''}`} key={group.id}>
        <div className="editor-card-head">
          <div><h2>{group.name}</h2><p>推荐 {reference.length} 个动作 · {reference.reduce((sum, item) => sum + item.sets, 0)} 组 · {group.repRange} 次</p></div>
          {isCustom ? <button className="editor-reset" onClick={() => write(group, null)}>恢复推荐</button> : <span className="editor-badge">推荐</span>}
        </div>
        <div className="editor-reference"><Icon name="spark" size={15}/><span>{reference.map((item) => `${item.name} ${item.sets} 组`).join(' · ')}</span></div>
        <div className="editor-chosen">
          {current.map((item) => {
            const exercise = exercises.find((row) => row.id === item.exerciseId)
            return <div className="editor-chosen-row" key={`${item.exerciseId}-${item.key}`}>
              <ExerciseImage className="editor-thumb" src={exercise?.gifUrl} alt={`${item.name}演示`} fallback={item.name}/>
              <span className="editor-option-copy"><strong>{item.name}</strong><small>{item.groupName} · {item.repRange} 次</small></span>
              <div className="editor-stepper">
                <button onClick={() => changeSets(group, item.exerciseId, -1)} disabled={item.sets <= SETS_MIN} aria-label={`${item.name} 减少一组`}>−</button>
                <strong>{item.sets}<small>组</small></strong>
                <button onClick={() => changeSets(group, item.exerciseId, 1)} disabled={item.sets >= SETS_MAX} aria-label={`${item.name} 增加一组`}>+</button>
              </div>
              <div className="editor-row-actions">
                <button onClick={() => setPicking({ group, replaceId: item.exerciseId })}><Icon name="swap" size={14}/>更换</button>
                <button onClick={() => remove(group, item.exerciseId)}><Icon name="close" size={14}/>移除</button>
              </div>
            </div>
          })}
        </div>
        <button className="editor-add" onClick={() => { setNotice(''); setPicking({ group }) }} disabled={current.length >= MAX_EXERCISES_PER_GROUP}>
          <Icon name="plus" size={16}/>从动作库添加
        </button>
        <p className="editor-card-foot">当前 <strong>{current.length}</strong> 个动作 · <strong>{current.reduce((sum, item) => sum + item.sets, 0)}</strong> 组 · 建议每动作 {RECOMMENDED_SETS_MIN}–{RECOMMENDED_SETS_MAX} 组</p>
      </section>
    })}</div>

    {notice && <p className="editor-notice">{notice}</p>}

    {picking && <ExercisePicker
      exercises={exercises}
      groupName={picking.group.name}
      recommendedIds={picking.group.options.map((option) => matchExercise(exercises, option.query)?.id ?? '').filter(Boolean)}
      excludeIds={picking.replaceId ? [] : currentOf(picking.group).map((item) => item.exerciseId)}
      onPick={(exercise) => addExercise(picking.group, exercise)}
      onClose={() => setPicking(null)}
    />}
  </>
}
