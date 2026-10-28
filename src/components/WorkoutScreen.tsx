import { useEffect, useMemo, useState } from 'react'
import { distributeSets, getPlan, selectedOptions, type PlanDay, type WorkoutGroup } from '../../shared/plans'
import type { Exercise, User, WorkoutRecord, WorkoutSetInput } from '../../shared/api'
import { recommendNextSet, suggestedSetValues, buildWorkoutSummary, type Recommendation, type WorkoutSummary } from '../../shared/progression'
import { api, matchExercise } from '../api'
import type { DraftSetValue, WorkoutDraft } from '../workoutDraft'
import { BackButton } from './BackButton'
import { ExerciseImage } from './ExerciseImage'
import { Icon } from './Icon'

const incrementFor = (group: WorkoutGroup) => /股四头肌|臀大肌|腘绳肌|后侧链/.test(group.name) ? 5 : 2.5
const nowIso = () => new Date().toISOString()

export function WorkoutScreen({ user, day, startedAt, draft, exercises, offline, onClose, onDraftChange, onComplete }: {
  user: User
  day: PlanDay
  startedAt: string
  draft: WorkoutDraft | null
  exercises: Exercise[]
  offline: boolean
  onClose: () => void
  onDraftChange: (draft: WorkoutDraft | null) => void
  onComplete: (user: User, summary: WorkoutSummary) => void
}) {
  const plan = getPlan(user.planId ?? 'gym-three', user.legFocus)
  const items = useMemo(() => day.groups.flatMap((group) => {
    const options = selectedOptions(group, user.exerciseSelections)
    const counts = distributeSets(group.totalSets, options.length)
    return options.map((option, index) => ({ group, option, sets: counts[index], exercise: matchExercise(exercises, option.query) }))
  }), [day, exercises, user.exerciseSelections])
  const total = items.reduce((sum, item) => sum + item.sets, 0)
  const validSetKeys = useMemo(() => new Set(items.flatMap((item) => Array.from({ length: item.sets }, (_, index) => `${item.option.key}-${index}`))), [items])
  const [values, setValues] = useState<Record<string, DraftSetValue>>(() => draft?.values ?? {})
  const [completed, setCompleted] = useState<Set<string>>(() => new Set((draft?.completed ?? []).filter((key) => validSetKeys.has(key))))
  const [history, setHistory] = useState<WorkoutRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyUnavailable, setHistoryUnavailable] = useState(false)
  const [rest, setRest] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const recommendations = useMemo(() => new Map(items.map((item) => [
    `${item.option.key}-group`,
    recommendNextSet(history, item.option.key, item.group.repRange, incrementFor(item.group)),
  ])), [history, items])

  useEffect(() => {
    let active = true
    api.workouts().then((result) => {
      if (!active) return
      setHistory(result.workouts)
      if (!draft) {
        setValues((current) => {
          if (Object.keys(current).length) return current
          const seeded: Record<string, DraftSetValue> = {}
          for (const item of items) {
            const recommendation = recommendNextSet(result.workouts, item.option.key, item.group.repRange, incrementFor(item.group))
            suggestedSetValues(recommendation, item.sets).forEach((value, index) => {
              seeded[`${item.option.key}-${index}`] = value
            })
          }
          return seeded
        })
      }
    }).catch(() => { if (active) setHistoryUnavailable(true) }).finally(() => { if (active) setHistoryLoading(false) })
    return () => { active = false }
  }, [draft, items])

  function recommendationFor(item: typeof items[number]): Recommendation {
    return recommendations.get(`${item.option.key}-group`) ?? recommendNextSet([], item.option.key, item.group.repRange)
  }

  function valueFor(key: string, fallback: DraftSetValue): DraftSetValue {
    return values[key] ?? fallback
  }

  function persist(nextValues: Record<string, DraftSetValue>, nextCompleted: Set<string>) {
    onDraftChange({
      version: 1,
      userId: user.id,
      planId: plan.id,
      planDayId: day.id,
      planDayName: day.name,
      startedAt,
      values: nextValues,
      completed: Array.from(nextCompleted),
      updatedAt: nowIso(),
    })
  }

  function update(key: string, field: keyof DraftSetValue, value: number, fallback: DraftSetValue) {
    const next = { ...values, [key]: { ...valueFor(key, fallback), [field]: Math.max(0, value) } }
    setValues(next)
    persist(next, completed)
  }

  function completeSet(key: string, seconds: number, fallback: DraftSetValue) {
    const nextValues = values[key] ? values : { ...values, [key]: fallback }
    const nextCompleted = new Set(completed).add(key)
    setValues(nextValues)
    setCompleted(nextCompleted)
    persist(nextValues, nextCompleted)
    setRest(seconds)
    if (navigator.vibrate) navigator.vibrate(30)
  }

  useEffect(() => {
    if (rest <= 0) return
    const timer = window.setTimeout(() => setRest((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [rest])

  async function finish() {
    setSaving(true); setError('')
    const sets: WorkoutSetInput[] = items.flatMap((item) => Array.from({ length: item.sets }, (_, index) => {
      const key = `${item.option.key}-${index}`
      const value = values[key] ?? { reps: 10, weightKg: 0 }
      return { exerciseKey: item.option.key, exerciseId: item.exercise?.id ?? item.option.key, exerciseName: item.option.nameZh, setNumber: index + 1, reps: value.reps, weightKg: value.weightKg }
    }))
    try {
      const result = await api.saveWorkout({ planDayId: day.id, startedAt, completedAt: nowIso(), sets })
      const nextPlan = getPlan(result.user.planId ?? plan.id, result.user.legFocus)
      const nextDay = nextPlan.days[result.user.cyclePosition % nextPlan.days.length]
      const summary = buildWorkoutSummary(result.workout, history, nextDay.name)
      onDraftChange(null)
      onComplete(result.user, summary)
    } catch (reason) { setError(`${reason instanceof Error ? reason.message : '保存训练失败'}，进度已留在本机`) }
    finally { setSaving(false) }
  }

  return <main className="workout-screen">
    <header className="workout-header"><BackButton label="退出" onClick={onClose} compact/><div><strong>{day.name}</strong><span>{completed.size} / {total} 组</span></div><span className="live-tag">训练中</span></header>
    <div className="progress-track"><span style={{ width: `${completed.size / total * 100}%` }}/></div>
    <div className="workout-content">
      {offline && <p className="workout-offline">离线模式 · 进度暂存在本机，联网后需要再次点击保存。</p>}
      <p className="eyebrow">{plan.name}</p><h1>保持节奏，<br/>完成每一组。</h1>
      {historyLoading && <p className="history-hint">正在读取上次训练，重量会自动预填。</p>}
      {items.map((item) => {
        const recommendation = recommendationFor(item)
        const lastBest = recommendation.previousSets.reduce((best, set) => set.reps > best.reps ? set : best, recommendation.previousSets[0])
        return <section className="exercise-session" key={item.option.key}>
          <div className="session-title"><ExerciseImage src={item.exercise?.gifUrl} alt={`${item.option.nameZh}动作演示`} fallback={item.option.nameZh}/><div><h2>{item.option.nameZh}</h2><p>{item.group.repRange} 次 · 休息 {Math.round(item.group.restSeconds / 60)} 分钟</p></div><strong>{item.sets} 组</strong></div>
          <div className="recommendation-line"><Icon name="spark" size={15}/><span>{historyUnavailable ? '暂时读不到历史成绩，先按自己熟悉的重量记录。' : recommendation.reason}</span></div>
          {lastBest && <p className="last-performance">上次最佳：{lastBest.weightKg > 0 ? `${lastBest.weightKg} kg × ` : ''}{lastBest.reps} 次</p>}
          <div className="set-labels"><span>组次</span><span>重量 kg</span><span>次数</span><span>完成</span></div>
          {Array.from({ length: item.sets }, (_, index) => {
            const key = `${item.option.key}-${index}`
            const done = completed.has(key)
            const suggested = suggestedSetValues(recommendation, item.sets)[index] ?? { reps: 10, weightKg: 0 }
            const value = valueFor(key, suggested)
            return <div className={`set-row ${done ? 'done' : ''}`} key={key}><span>{index + 1}</span><input type="number" min="0" step="0.5" aria-label={`第 ${index + 1} 组重量`} value={value.weightKg} disabled={done} onChange={(e) => update(key, 'weightKg', Number(e.target.value), suggested)}/><input type="number" min="1" max="100" aria-label={`第 ${index + 1} 组次数`} value={value.reps} disabled={done} onChange={(e) => update(key, 'reps', Number(e.target.value), suggested)}/><button className="set-check" aria-label={`完成第 ${index + 1} 组`} disabled={done} onClick={() => completeSet(key, item.group.restSeconds, value)}><Icon name="check"/></button></div>
          })}
        </section>
      })}
      {error && <p className="form-error">{error}</p>}
      <p className="draft-note">进度已自动保存在这台设备，退出后可继续。</p>
      <button className="primary full finish-button" disabled={completed.size !== total || saving} onClick={finish}>{saving ? '正在保存…' : completed.size === total ? '完成并保存训练' : `还剩 ${total - completed.size} 组`}</button>
    </div>
    {rest > 0 && <aside className="rest-overlay"><p>组间休息</p><strong>{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}</strong><span>下一组，保持动作质量。</span><button onClick={() => setRest(0)}>跳过休息</button></aside>}
  </main>
}
