import { useState } from 'react'
import { displayNameOf, type Exercise, type User } from '../../shared/api'
import {
  clampSets, dayPlanTotals, getPlan, MAX_EXERCISES_PER_GROUP, RECOMMENDED_SETS_MAX, RECOMMENDED_SETS_MIN,
  resolveDayPlan, resolveGroupPlan, type PlanCustomization, type PlanDay, type WorkoutGroup,
} from '../../shared/plans'
import { findExercise, matchExercise } from '../api'
import type { WorkoutDraft } from '../workoutDraft'
import { ExerciseImage } from './ExerciseImage'
import { ExercisePicker } from './ExercisePicker'
import { Icon } from './Icon'

const today = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())

export function HomeScreen({ user, exercises, guest, draft, onStart, onChangePlan, onCustomize, onCustomizationChange, onOpenProfile, onRequireAuth, onDiscardDraft }: {
  user: User
  exercises: Exercise[]
  guest: boolean
  draft: WorkoutDraft | null
  onStart: (day: PlanDay) => void
  onChangePlan: () => void
  onCustomize: (planDayId: string) => void
  onOpenProfile: () => void
  onCustomizationChange: (customization: PlanCustomization) => Promise<void>
  onRequireAuth: () => void
  onDiscardDraft: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [selectionError, setSelectionError] = useState('')
  const [picking, setPicking] = useState<{ group: WorkoutGroup; replaceId: string } | null>(null)
  const plan = getPlan(user.planId ?? 'gym-three', user.legFocus)
  const nextDay = plan.days[user.cyclePosition % plan.days.length]
  const draftDay = draft && draft.planId === plan.id ? plan.days.find((item) => item.id === draft.planDayId) : undefined
  const day = draftDay ?? nextDay
  const planned = resolveDayPlan(day, user.planCustomization, exercises, user.exerciseSelections)
  const totals = dayPlanTotals(day, user.planCustomization, exercises, user.exerciseSelections)
  const customized = Boolean(user.planCustomization?.[day.id] && Object.keys(user.planCustomization[day.id]).length)

  const replaceIn = (group: WorkoutGroup, replaceId: string, exerciseId: string, sets?: number) => {
    const current = resolveGroupPlan(group, user.planCustomization?.[day.id]?.[group.id], exercises, user.exerciseSelections)
    const entries = current.map((item) => ({ id: item.exerciseId === replaceId ? exerciseId : item.exerciseId, sets: item.exerciseId === replaceId ? (sets ?? item.sets) : item.sets }))
    const ids: string[] = []
    const nextSets: Record<string, number> = {}
    for (const entry of entries) {
      if (!entry.id || ids.includes(entry.id)) continue
      ids.push(entry.id)
      nextSets[entry.id] = clampSets(entry.sets)
    }
    return { ...(user.planCustomization ?? {}), [day.id]: { ...(user.planCustomization?.[day.id] ?? {}), [group.id]: { exerciseIds: ids.slice(0, MAX_EXERCISES_PER_GROUP), sets: nextSets } } }
  }

  async function choose(group: WorkoutGroup, replaceId: string, exercise: Exercise) {
    setSaving(true); setSelectionError('')
    try {
      await onCustomizationChange(replaceIn(group, replaceId, exercise.id))
      setPicking(null)
    } catch (reason) {
      setSelectionError(reason instanceof Error ? reason.message : '更换动作失败')
    } finally { setSaving(false) }
  }

  function customize() {
    if (guest) return onRequireAuth()
    onCustomize(day.id)
  }

  return <div className="page home-page">
    <header className="home-header">
      <div><p>{today}</p><h1>{guest ? '准备好，训练者' : `早上好，${displayNameOf(user)}`}</h1></div>
      {guest
        ? <span className="status-dot" title="游客模式"/>
        : <button className="home-avatar" onClick={onOpenProfile} aria-label="打开我的">{user.avatar ? <img src={user.avatar} alt=""/> : <span>{displayNameOf(user).slice(0, 1).toUpperCase()}</span>}</button>}
    </header>
    {guest && <button className="guest-strip" onClick={onRequireAuth}><span>游客模式 · 数据尚未保存</span><strong>去「我的」登录 <Icon name="arrow" size={16}/></strong></button>}
    {!guest && draft && <section className="draft-strip"><div><p className="eyebrow">上次训练未完成</p><strong>{day.name}</strong><span>已完成 {draft.completed.length} 组 · 进度保存在本机</span></div><button onClick={onDiscardDraft}>放弃草稿</button></section>}
    <section className="today-hero">
      <div className="hero-top"><span className="dark-tag">今日训练 · DAY {plan.days.indexOf(day) + 1}</span><span>{plan.shortName}</span></div>
      <div><p>{day.subtitle}</p><h2>{day.name}</h2></div>
      <div className="hero-metrics"><span><strong>{totals.exercises}</strong> 个动作</span><span><strong>{totals.sets}</strong> 总组数</span><span><strong>{RECOMMENDED_SETS_MIN}–{RECOMMENDED_SETS_MAX}</strong> 组/动作</span></div>
      <button className="accent-button" onClick={guest ? onRequireAuth : () => onStart(day)}>{guest ? '登录后开始训练' : draft ? '继续未完成训练' : '开始今日训练'} <Icon name="arrow"/></button>
    </section>
    <section className="section-block">
      <div className="section-title">
        <div><p className="eyebrow">训练安排</p><h2>今天做什么</h2></div>
        <button className="section-action" onClick={customize}>{customized ? '已自定义 · 调整' : '调整动作与组数'}</button>
      </div>
      {customized && <p className="custom-hint">按你的设置执行 · 推荐方案为 {day.groups.reduce((sum, group) => sum + group.totalSets, 0)} 组</p>}
      <div className="workout-list">{planned.map((item) => {
        const exercise = findExercise(exercises, item.exerciseId)
        return <article className="workout-row" key={`${item.groupId}-${item.key}`}>
          <ExerciseImage className="exercise-thumb" src={exercise?.gifUrl} alt={`${item.name}动作演示`} fallback={item.name}/>
          <div><h3>{item.name}</h3><p>{item.groupName} · {item.repRange} 次</p>
            {!guest && <button className="inline-link" disabled={saving} onClick={() => { setSelectionError(''); setPicking({ group: day.groups.find((row) => row.id === item.groupId)!, replaceId: item.exerciseId }) }}>更换动作</button>}
          </div>
          <strong>{item.sets}<small> 组</small></strong>
        </article>
      })}</div>
    </section>
    <button className="text-button" onClick={guest ? onRequireAuth : onChangePlan}>{guest ? '登录后选择并保存你的训练计划' : `当前计划：${plan.name} · 更换`}</button>
    <p className="safety-note">深蹲、卧推、推举等动作不要力竭，保留 1–2 次余力。</p>
    {selectionError && <p className="form-error">{selectionError}</p>}
    {picking && <ExercisePicker
      exercises={exercises}
      groupName={picking.group.name}
      recommendedIds={picking.group.options.map((option) => matchExercise(exercises, option.query)?.id ?? '').filter(Boolean)}
      excludeIds={resolveGroupPlan(picking.group, user.planCustomization?.[day.id]?.[picking.group.id], exercises, user.exerciseSelections).map((item) => item.exerciseId)}
      onPick={(exercise) => choose(picking.group, picking.replaceId, exercise)}
      onClose={() => setPicking(null)}
    />}
  </div>
}
