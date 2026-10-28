import { useState } from 'react'
import type { Exercise, User } from '../../shared/api'
import { dayPlanTotals, getPlan, orderedDays, RECOMMENDED_SETS_MAX, RECOMMENDED_SETS_MIN, type PlanCustomization } from '../../shared/plans'
import { BackButton } from './BackButton'
import { DayOrderEditor } from './DayOrderEditor'
import { PlanDayEditor } from './PlanDayEditor'

export function PlanEditorScreen({ user, exercises, initialDayId, onSave, onClose }: {
  user: User
  exercises: Exercise[]
  initialDayId?: string
  onSave: (customization: PlanCustomization, dayOrder: string[]) => Promise<void>
  onClose: () => void
}) {
  const plan = getPlan(user.planId ?? 'gym-three', user.legFocus)
  const [dayId, setDayId] = useState(initialDayId ?? plan.days[0].id)
  const [draft, setDraft] = useState<PlanCustomization>(() => JSON.parse(JSON.stringify(user.planCustomization ?? {})) as PlanCustomization)
  const [dayOrder, setDayOrder] = useState<string[]>(user.planDayOrder ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const days = orderedDays(plan, dayOrder)
  const day = days.find((item) => item.id === dayId) ?? days[0]

  const totals = dayPlanTotals(day, draft, exercises, user.exerciseSelections)
  const recommendedSets = day.groups.reduce((sum, group) => sum + group.totalSets, 0)
  const customizedDays = Object.keys(draft).filter((id) => Object.keys(draft[id] ?? {}).length).length

  async function save() {
    setSaving(true); setError('')
    try { await onSave(draft, dayOrder) }
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
      {days.map((item, index) => <button key={item.id} role="tab" aria-selected={item.id === day.id} className={item.id === day.id ? 'active' : ''} onClick={() => setDayId(item.id)}>
        <span>DAY {index + 1}</span><strong>{item.name}</strong>
      </button>)}
    </div>

    <DayOrderEditor days={plan.days} order={dayOrder} onChange={setDayOrder}/>

    <p className="editor-intro">每个动作默认 {RECOMMENDED_SETS_MIN}–{RECOMMENDED_SETS_MAX} 组，自然训练者更容易恢复。想要更多选择就点「从动作库添加」，1,324 个动作都能加进来。</p>

    <PlanDayEditor
      day={day}
      exercises={exercises}
      entry={draft[day.id]}
      selections={user.exerciseSelections}
      onChange={(next) => setDraft((current) => {
        const copy = { ...current }
        if (next) copy[day.id] = next
        else delete copy[day.id]
        return copy
      })}
    />

    {error && <p className="form-error">{error}</p>}

    <div className="editor-footer">
      <div className="editor-footer-meta">
        <span>{day.name} · {totals.exercises} 个动作 · {totals.sets} 组</span>
        <small>推荐 {recommendedSets} 组{customizedDays ? ` · 已改 ${customizedDays} 天` : ''}</small>
      </div>
      <div className="editor-footer-actions">
        <button className="secondary" onClick={() => setDraft({})}>全部恢复推荐</button>
        <button className="primary" onClick={save} disabled={saving}>{saving ? '正在保存…' : '保存自定义'}</button>
      </div>
    </div>
  </main>
}
