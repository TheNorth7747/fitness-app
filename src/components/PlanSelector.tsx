import { useState } from 'react'
import { getPlans, type LegFocus } from '../../shared/plans'
import { api } from '../api'
import type { User } from '../../shared/api'
import { BackButton } from './BackButton'
import { Icon } from './Icon'

export function PlanSelector({ initialPlan, onComplete, onCancel }: { initialPlan?: string | null; onComplete: (user: User) => void; onCancel?: () => void }) {
  const [location, setLocation] = useState<'gym' | 'home'>('gym')
  const [focus, setFocus] = useState<LegFocus>('quads')
  const [selected, setSelected] = useState(initialPlan ?? 'gym-three')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const plans = getPlans(focus).filter((plan) => plan.location === location)

  async function confirm() {
    setLoading(true); setError('')
    try { onComplete((await api.selectPlan(selected, focus)).user) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '保存计划失败') }
    finally { setLoading(false) }
  }

  return <main className="plan-screen">
    {onCancel && <div className="screen-toolbar"><BackButton label="返回我的" onClick={onCancel}/></div>}
    <header className="page-header"><p className="eyebrow">你的训练起点</p><h1>选一个能坚持的<br/>计划。</h1><p>按循环日推进，不用被星期几绑住。</p></header>
    <div className="segmented large"><button className={location === 'gym' ? 'active' : ''} onClick={() => { setLocation('gym'); setSelected('gym-three') }}>健身房</button><button className={location === 'home' ? 'active' : ''} onClick={() => { setLocation('home'); setSelected('home-three') }}>居家</button></div>
    <section className="plan-list">
      {plans.map((plan, index) => <button key={plan.id} className={`plan-option ${selected === plan.id ? 'selected' : ''}`} onClick={() => setSelected(plan.id)}>
        <span className="plan-index">0{index + 1}</span><span className="plan-copy"><strong>{plan.name}</strong><small>{plan.description}</small><span>{plan.days.length} 天循环 · {plan.level}</span></span><span className="radio"><Icon name="check" size={16}/></span>
      </button>)}
    </section>
    <section className="focus-section"><h2>腿臀日侧重</h2><p>每轮加入腘绳肌训练，不收集性别信息。</p><div className="choice-row"><button className={focus === 'quads' ? 'selected' : ''} onClick={() => setFocus('quads')}>股四头肌</button><button className={focus === 'glutes' ? 'selected' : ''} onClick={() => setFocus('glutes')}>臀大肌</button></div></section>
    {error && <p className="form-error">{error}</p>}
    <button className="primary full plan-confirm" onClick={confirm} disabled={loading}>{loading ? '保存中…' : '用这个计划开始'}<Icon name="arrow"/></button>
    <p className="attribution">计划参考：B站好人松松《健身 Excel 超级套表》</p>
  </main>
}
