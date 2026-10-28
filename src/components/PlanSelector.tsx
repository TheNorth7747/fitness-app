import { useState } from 'react'
import type { Exercise, User } from '../../shared/api'
import { dayPlanTotals, getPlan, getPlans, orderedDays, RECOMMENDED_SETS_MAX, RECOMMENDED_SETS_MIN, type LegFocus, type PlanCustomization } from '../../shared/plans'
import { api } from '../api'
import { BackButton } from './BackButton'
import { Icon } from './Icon'
import { DayOrderEditor } from './DayOrderEditor'
import { PlanDayEditor } from './PlanDayEditor'

export function PlanSelector({ initialPlan, exercises, onComplete, onCancel }: {
  initialPlan?: string | null
  exercises: Exercise[]
  onComplete: (user: User) => void
  onCancel?: () => void
}) {
  const [step, setStep] = useState<'plan' | 'setup'>('plan')
  const [location, setLocation] = useState<'gym' | 'home'>('gym')
  const [focus, setFocus] = useState<LegFocus>('quads')
  const [selected, setSelected] = useState(initialPlan ?? 'gym-three')
  const [dayIndex, setDayIndex] = useState(0)
  const [customization, setCustomization] = useState<PlanCustomization>({})
  const [dayOrder, setDayOrder] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const plans = getPlans(focus).filter((plan) => plan.location === location)
  const plan = getPlan(selected, focus)
  const days = orderedDays(plan, dayOrder)
  const day = days[dayIndex] ?? days[0]
  const totals = dayPlanTotals(day, customization, exercises, {})

  function choosePlan(planId: string) {
    setSelected(planId)
    setCustomization({})
    setDayOrder([])
  }

  function toSetup() {
    setDayIndex(0)
    setError('')
    setStep('setup')
  }

  function updateDay(next: Record<string, { exerciseIds: string[]; sets: Record<string, number> }> | undefined) {
    setCustomization((current) => {
      const copy = { ...current }
      if (next) copy[day.id] = next
      else delete copy[day.id]
      return copy
    })
  }

  async function confirm() {
    setLoading(true); setError('')
    try { onComplete((await api.selectPlan(selected, focus, customization, dayOrder)).user) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '保存计划失败') }
    finally { setLoading(false) }
  }

  if (step === 'plan') return <main className="plan-screen">
    {onCancel && <div className="screen-toolbar"><BackButton label="返回我的" onClick={onCancel}/></div>}
    <header className="page-header"><p className="eyebrow">你的训练起点</p><h1>选一个能坚持的<br/>计划。</h1><p>按循环日推进，不用被星期几绑住。</p></header>
    <div className="segmented large"><button className={location === 'gym' ? 'active' : ''} onClick={() => { setLocation('gym'); choosePlan('gym-three') }}>健身房</button><button className={location === 'home' ? 'active' : ''} onClick={() => { setLocation('home'); choosePlan('home-three') }}>居家</button></div>
    <section className="plan-list">
      {plans.map((planItem, index) => <button key={planItem.id} className={`plan-option ${selected === planItem.id ? 'selected' : ''}`} onClick={() => choosePlan(planItem.id)}>
        <span className="plan-index">0{index + 1}</span><span className="plan-copy"><strong>{planItem.name}</strong><small>{planItem.description}</small><span>{planItem.days.length} 天循环 · {planItem.level}</span></span><span className="radio"><Icon name="check" size={16}/></span>
      </button>)}
    </section>
    <section className="focus-section"><h2>腿臀日侧重</h2><p>每轮加入腘绳肌训练，不收集性别信息。</p><div className="choice-row"><button className={focus === 'quads' ? 'selected' : ''} onClick={() => setFocus('quads')}>股四头肌</button><button className={focus === 'glutes' ? 'selected' : ''} onClick={() => setFocus('glutes')}>臀大肌</button></div></section>
    {error && <p className="form-error">{error}</p>}
    <button className="primary full plan-confirm" onClick={toSetup}>下一步：安排动作 <Icon name="arrow"/></button>
    <p className="attribution">计划参考：B站好人松松《健身 Excel 超级套表》</p>
  </main>

  const customDays = Object.keys(customization).filter((id) => Object.keys(customization[id] ?? {}).length).length
  return <main className="plan-editor">
    <header className="editor-header">
      <BackButton label="换计划" onClick={() => setStep('plan')}/>
      <div><p className="eyebrow">第 2 / 2 步 · {plan.shortName}</p><h1>安排动作与组数</h1></div>
      <span className="editor-total"><strong>{totals.sets}</strong><small>总组数</small></span>
    </header>

    <div className="editor-days" role="tablist" aria-label="选择训练日">
      {days.map((item, index) => <button key={item.id} role="tab" aria-selected={index === dayIndex} className={index === dayIndex ? 'active' : ''} onClick={() => setDayIndex(index)}>
        <span>DAY {index + 1}</span><strong>{item.name}</strong>
      </button>)}
    </div>

    <DayOrderEditor days={plan.days} order={dayOrder} onChange={setDayOrder}/>

    <p className="editor-intro">每个动作默认 {RECOMMENDED_SETS_MIN}–{RECOMMENDED_SETS_MAX} 组，已经按自然训练者的恢复能力排好。想换就点「从动作库添加」，不满意还能全部恢复推荐。</p>

    <PlanDayEditor day={day} exercises={exercises} entry={customization[day.id]} selections={{}} onChange={updateDay}/>

    {error && <p className="form-error">{error}</p>}

    <div className="editor-footer">
      <div className="editor-footer-meta">
        <span>{day.name} · {totals.exercises} 个动作 · {totals.sets} 组</span>
        <small>{customDays ? `已调整 ${customDays} 天` : '当前全部为推荐方案'}</small>
      </div>
      <div className="editor-footer-actions">
        <button className="secondary" onClick={() => setCustomization({})}>全部恢复推荐</button>
        <button className="primary" onClick={confirm} disabled={loading}>{loading ? '正在保存…' : '用这个计划开始'}</button>
      </div>
    </div>
  </main>
}
