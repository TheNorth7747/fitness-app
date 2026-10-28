import { useState } from 'react'
import type { User } from '../../shared/api'
import {
  clampSets, getPlan, RECOMMENDED_SETS_MAX, RECOMMENDED_SETS_MIN, recommendedGroupPlan, resolveGroupPlan,
  SETS_MAX, SETS_MIN, type GroupCustomization, type PlanCustomization, type PlannedExercise, type WorkoutGroup,
} from '../../shared/plans'
import { BackButton } from './BackButton'
import { Icon } from './Icon'

const setsLabel = (items: PlannedExercise[]) => items.map((item) => `${item.option.nameZh} ${item.sets} 组`).join(' · ')

export function PlanEditorScreen({ user, initialDayId, onSave, onClose }: {
  user: User
  initialDayId?: string
  onSave: (customization: PlanCustomization) => Promise<void>
  onClose: () => void
}) {
  const plan = getPlan(user.planId ?? 'gym-three', user.legFocus)
  const [dayId, setDayId] = useState(initialDayId ?? plan.days[0].id)
  const [draft, setDraft] = useState<PlanCustomization>(() => JSON.parse(JSON.stringify(user.planCustomization ?? {})) as PlanCustomization)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const day = plan.days.find((item) => item.id === dayId) ?? plan.days[0]

  const recommended = new Map(day.groups.map((group) => [group.id, recommendedGroupPlan(group, user.exerciseSelections)]))
  const currentDay = day.groups.flatMap((group) => resolveGroupPlan(group, draft[day.id]?.[group.id], user.exerciseSelections))
  const totals = {
    exercises: currentDay.length,
    sets: currentDay.reduce((sum, item) => sum + item.sets, 0),
    recommendedSets: day.groups.reduce((sum, group) => sum + group.totalSets, 0),
  }

  const currentOf = (group: WorkoutGroup) => resolveGroupPlan(group, draft[day.id]?.[group.id], user.exerciseSelections)
  const customOf = (group: WorkoutGroup) => draft[day.id]?.[group.id]

  function write(group: WorkoutGroup, next: GroupCustomization | null) {
    setNotice('')
    setDraft((current) => {
      const dayEntry = { ...(current[day.id] ?? {}) }
      if (next) dayEntry[group.id] = next
      else delete dayEntry[group.id]
      const copy = { ...current }
      if (Object.keys(dayEntry).length) copy[day.id] = dayEntry
      else delete copy[day.id]
      return copy
    })
  }

  function toggle(group: WorkoutGroup, key: string) {
    const current = currentOf(group)
    const keys = current.map((item) => item.option.key)
    if (keys.includes(key)) {
      if (keys.length <= 1) { setNotice('每组至少保留一个动作；想换动作请先添加新的再移除旧的。'); return }
      const nextKeys = keys.filter((item) => item !== key)
      write(group, { optionKeys: nextKeys, sets: Object.fromEntries(current.filter((item) => nextKeys.includes(item.option.key)).map((item) => [item.option.key, item.sets])) })
      return
    }
    const sets = Object.fromEntries(current.map((item) => [item.option.key, item.sets]))
    const fallback = recommended.get(group.id)?.find((item) => item.option.key === key)?.sets ?? RECOMMENDED_SETS_MIN
    sets[key] = sets[key] ?? fallback
    write(group, { optionKeys: [...keys, key], sets })
  }

  function changeSets(group: WorkoutGroup, key: string, delta: number) {
    const current = currentOf(group)
    const sets = Object.fromEntries(current.map((item) => [item.option.key, item.sets]))
    sets[key] = clampSets((sets[key] ?? RECOMMENDED_SETS_MIN) + delta)
    write(group, { optionKeys: current.map((item) => item.option.key), sets })
  }

  async function save() {
    setSaving(true); setError('')
    try { await onSave(draft) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试') }
    finally { setSaving(false) }
  }

  return <main className="plan-editor">
    <header className="editor-header">
      <BackButton label="返回" onClick={onClose}/>
      <div><p className="eyebrow">自定义训练</p><h1>动作与组数</h1></div>
      <span className="editor-total"><strong>{totals.sets}</strong><small>总组数</small></span>
    </header>

    <div className="editor-days" role="tablist" aria-label="选择训练日">
      {plan.days.map((item, index) => <button key={item.id} role="tab" aria-selected={item.id === day.id} className={item.id === day.id ? 'active' : ''} onClick={() => { setDayId(item.id); setNotice('') }}>
        <span>DAY {index + 1}</span><strong>{item.name}</strong>
      </button>)}
    </div>

    <p className="editor-intro">每个动作默认 {RECOMMENDED_SETS_MIN}–{RECOMMENDED_SETS_MAX} 组，自然训练者更容易恢复。推荐方案标注在每张卡片里，改动只影响你自己。</p>

    <div className="editor-groups">{day.groups.map((group) => {
      const current = currentOf(group)
      const reference = recommended.get(group.id) ?? []
      const activeKeys = current.map((item) => item.option.key)
      const isCustom = Boolean(customOf(group))
      return <section className={`editor-card ${isCustom ? 'customized' : ''}`} key={group.id}>
        <div className="editor-card-head">
          <div><h2>{group.name}</h2><p>推荐 {reference.length} 个动作 · {reference.reduce((sum, item) => sum + item.sets, 0)} 组</p></div>
          {isCustom ? <button className="editor-reset" onClick={() => write(group, null)}>恢复推荐</button> : <span className="editor-badge">推荐</span>}
        </div>
        <div className="editor-reference"><Icon name="spark" size={15}/><span>{setsLabel(reference)}</span></div>
        <div className="editor-options">{group.options.map((option) => {
          const chosen = activeKeys.includes(option.key)
          const sets = current.find((item) => item.option.key === option.key)?.sets ?? 0
          const recommendedSets = reference.find((item) => item.option.key === option.key)?.sets
          return <div className={`editor-option ${chosen ? 'chosen' : ''}`} key={option.key}>
            <button className="editor-option-main" onClick={() => toggle(group, option.key)} aria-pressed={chosen}>
              <span className={`editor-check ${chosen ? 'on' : ''}`}>{chosen ? <Icon name="check" size={14}/> : null}</span>
              <span className="editor-option-copy"><strong>{option.nameZh}</strong><small>{recommendedSets ? `推荐 ${recommendedSets} 组` : '可选动作'}</small></span>
            </button>
            {chosen && <div className="editor-stepper">
              <button onClick={() => changeSets(group, option.key, -1)} disabled={sets <= SETS_MIN} aria-label={`${option.nameZh} 减少一组`}>−</button>
              <strong>{sets}<small>组</small></strong>
              <button onClick={() => changeSets(group, option.key, 1)} disabled={sets >= SETS_MAX} aria-label={`${option.nameZh} 增加一组`}>+</button>
            </div>}
          </div>
        })}</div>
        <p className="editor-card-foot">当前 <strong>{current.length}</strong> 个动作 · <strong>{current.reduce((sum, item) => sum + item.sets, 0)}</strong> 组</p>
      </section>
    })}</div>

    {notice && <p className="editor-notice">{notice}</p>}
    {error && <p className="form-error">{error}</p>}

    <div className="editor-footer">
      <div className="editor-footer-meta"><span>本日 {totals.exercises} 个动作 · {totals.sets} 组</span><small>推荐 {totals.recommendedSets} 组</small></div>
      <div className="editor-footer-actions">
        <button className="secondary" onClick={() => { setDraft({}); setNotice('已恢复全部推荐方案') }}>全部恢复推荐</button>
        <button className="primary" onClick={save} disabled={saving}>{saving ? '正在保存…' : '保存自定义'}</button>
      </div>
    </div>
  </main>
}
