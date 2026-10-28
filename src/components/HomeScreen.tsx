import { useState } from 'react'
import { getPlan, distributeSets, selectedOptions, type PlanDay, type WorkoutGroup } from '../../shared/plans'
import type { Exercise, User } from '../../shared/api'
import { matchExercise } from '../api'
import type { WorkoutDraft } from '../workoutDraft'
import { BackButton } from './BackButton'
import { ExerciseImage } from './ExerciseImage'
import { Icon } from './Icon'

const today = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())

export function HomeScreen({ user, exercises, guest, draft, onStart, onChangePlan, onChangeExercise, onRequireAuth, onDiscardDraft }: {
  user: User
  exercises: Exercise[]
  guest: boolean
  draft: WorkoutDraft | null
  onStart: (day: PlanDay) => void
  onChangePlan: () => void
  onChangeExercise: (planDayId: string, groupId: string, optionKey: string) => Promise<void>
  onRequireAuth: () => void
  onDiscardDraft: () => void
}) {
  const [replacing, setReplacing] = useState<WorkoutGroup | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectionError, setSelectionError] = useState('')
  const plan = getPlan(user.planId ?? 'gym-three', user.legFocus)
  const nextDay = plan.days[user.cyclePosition % plan.days.length]
  const draftDay = draft && draft.planId === plan.id ? plan.days.find((item) => item.id === draft.planDayId) : undefined
  const day = draftDay ?? nextDay
  const totalSets = day.groups.reduce((sum, item) => sum + item.totalSets, 0)
  const totalExercises = day.groups.reduce((sum, item) => sum + item.selectMin, 0)

  async function choose(group: WorkoutGroup, optionKey: string) {
    setSaving(true); setSelectionError('')
    try { await onChangeExercise(day.id, group.id, optionKey); setReplacing(null) }
    catch (reason) { setSelectionError(reason instanceof Error ? reason.message : '更换动作失败') }
    finally { setSaving(false) }
  }

  return <div className="page home-page">
    <header className="home-header"><div><p>{today}</p><h1>{guest ? '准备好，训练者' : `早上好，${user.username}`}</h1></div><span className="status-dot" title={guest ? '游客模式' : '计划已同步'}/></header>
    {guest && <button className="guest-strip" onClick={onRequireAuth}><span>游客模式 · 数据尚未保存</span><strong>去「我的」登录 <Icon name="arrow" size={16}/></strong></button>}
    {!guest && draft && <section className="draft-strip"><div><p className="eyebrow">上次训练未完成</p><strong>{day.name}</strong><span>已完成 {draft.completed.length} 组 · 进度保存在本机</span></div><button onClick={onDiscardDraft}>放弃草稿</button></section>}
    <section className="today-hero">
      <div className="hero-top"><span className="dark-tag">今日训练 · DAY {plan.days.indexOf(day) + 1}</span><span>{plan.shortName}</span></div>
      <div><p>{day.subtitle}</p><h2>{day.name}</h2></div>
      <div className="hero-metrics"><span><strong>{totalExercises}</strong> 个动作</span><span><strong>{totalSets}</strong> 总组数</span><span><strong>60–90</strong> 分钟</span></div>
      <button className="accent-button" onClick={guest ? onRequireAuth : () => onStart(day)}>{guest ? '登录后开始训练' : draft ? '继续未完成训练' : '开始今日训练'} <Icon name="arrow"/></button>
    </section>
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">训练安排</p><h2>今天做什么</h2></div><span>{day.groups.length} 个动作组</span></div>
      <div className="workout-list">{day.groups.flatMap((item) => {
        const options = selectedOptions(item, user.exerciseSelections)
        const counts = distributeSets(item.totalSets, options.length)
        return options.map((option, index) => {
          const exercise = matchExercise(exercises, option.query)
          return <article className="workout-row" key={`${item.id}-${option.key}`}>
            <ExerciseImage className="exercise-thumb" src={exercise?.gifUrl} alt={`${option.nameZh}动作演示`} fallback={option.nameZh}/>
            <div><h3>{option.nameZh}</h3><p>{item.name} · {item.repRange} 次</p><button className="inline-link" onClick={guest ? onRequireAuth : () => { setReplacing(item); setSelectionError('') }}>更换动作</button></div>
            <strong>{counts[index]}<small> 组</small></strong>
          </article>
        })
      })}</div>
    </section>
    <button className="text-button" onClick={guest ? onRequireAuth : onChangePlan}>{guest ? '登录后选择并保存你的训练计划' : `当前计划：${plan.name} · 更换`}</button>
    <p className="safety-note">深蹲、卧推、推举等动作不要力竭，保留 1–2 次余力。</p>
    {replacing && <div className="modal-backdrop" onClick={() => setReplacing(null)}>
      <section className="choice-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="choice-sheet-top"><BackButton label="返回首页" onClick={() => setReplacing(null)} compact/><button className="icon-button" onClick={() => setReplacing(null)} aria-label="关闭动作选择"><Icon name="close"/></button></div>
        <div className="choice-sheet-head"><div><p className="eyebrow">更换动作组</p><h2>{replacing.name}</h2></div></div>
        <p>选择后会保存到你的账号，下一轮继续保持。</p>
        {replacing.options.map((option) => <button key={option.key} className={user.exerciseSelections[replacing.id] === option.key || (!user.exerciseSelections[replacing.id] && replacing.options[0]?.key === option.key) ? 'selected' : ''} disabled={saving} onClick={() => choose(replacing, option.key)}><span><strong>{option.nameZh}</strong><small>{option.query}</small></span><Icon name="check" size={18}/></button>)}
        {selectionError && <p className="form-error">{selectionError}</p>}
      </section>
    </div>}
  </div>
}
