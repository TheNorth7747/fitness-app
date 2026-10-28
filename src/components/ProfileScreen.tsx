import { useEffect, useState } from 'react'
import { displayNameOf, type User, type WorkoutRecord } from '../../shared/api'
import { buildExerciseTrends, type ExerciseTrend } from '../../shared/progression'
import { getPlan, orderedDays, RECOMMENDED_SETS_MAX, RECOMMENDED_SETS_MIN } from '../../shared/plans'
import { api } from '../api'
import { ProfileEditor } from './ProfileEditor'
import { BackButton } from './BackButton'
import { Icon } from './Icon'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const shortDate = (iso: string) => new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(iso))
const fullDate = (iso: string) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const exportStamp = () => new Date().toISOString().slice(0, 10)
const exportNow = () => new Date().toISOString()

function TrendChart({ trend, large = false }: { trend: ExerciseTrend; large?: boolean }) {
  const points = trend.points.slice(-8)
  const values = points.map((point) => point.e1rm ?? point.bestReps)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || 1
  const width = large ? 300 : 116
  const height = large ? 108 : 30
  const path = points.map((_, index) => {
    const x = points.length === 1 ? width / 2 : 4 + index / (points.length - 1) * (width - 8)
    const y = points.length === 1 ? height / 2 : height - 5 - ((values[index] - min) / spread) * (height - 10)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return <svg className={large ? 'trend-chart large' : 'trend-chart'} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${trend.name} 最近 ${points.length} 次训练趋势`}>
    <polyline points={path} fill="none" stroke="currentColor" strokeWidth={large ? 2 : 1.8} strokeLinejoin="round" strokeLinecap="round"/>
    {points.length === 1 && <circle cx={width / 2} cy={height / 2} r={large ? 4 : 2.5} fill="currentColor"/>}
    {large && points.length > 1 && points.map((point, index) => {
      const coordinate = path.split(' ')[index].split(',').map(Number)
      return <circle key={point.workoutId} cx={coordinate[0]} cy={coordinate[1]} r="3" fill="currentColor"/>
    })}
  </svg>
}

export function ProfileScreen({ user, onChangePlan, onCustomize, onProfileChange, onLogout }: { user: User; onChangePlan: () => void; onCustomize: () => void; onProfileChange: (displayName: string, avatar: string) => Promise<void>; onLogout: () => void }) {
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTrend, setSelectedTrend] = useState<ExerciseTrend | null>(null)
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(() => (window as Window & { __fitdayInstallPrompt?: Event }).__fitdayInstallPrompt as BeforeInstallPromptEvent | undefined ?? null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)
  const [editingProfile, setEditingProfile] = useState(false)

  useEffect(() => {
    let active = true
    api.workouts().then((result) => { if (active) setWorkouts(result.workouts) }).catch((reason) => { if (active) setError(reason.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const target = window as Window & { __fitdayInstallPrompt?: Event }
    const handlePrompt = () => {
      if (target.__fitdayInstallPrompt) setInstallPrompt(target.__fitdayInstallPrompt as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => { setInstalled(true); setInstallPrompt(null) }
    window.addEventListener('fitday-install-available', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('fitday-install-available', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const plan = getPlan(user.planId ?? 'gym-three', user.legFocus)
  const volume = workouts.reduce((sum, workout) => sum + workout.sets.reduce((inner, set) => inner + set.reps * set.weightKg, 0), 0)
  const trends = buildExerciseTrends(workouts)

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    ;(window as Window & { __fitdayInstallPrompt?: Event }).__fitdayInstallPrompt = undefined
    setInstallPrompt(null)
  }

  function exportData() {
    const payload = {
      format: 'fitday-export',
      version: 1,
      exportedAt: exportNow(),
      account: {
        username: user.username,
        planId: user.planId,
        planName: plan.name,
        legFocus: user.legFocus,
        cyclePosition: user.cyclePosition,
        exerciseSelections: user.exerciseSelections,
      },
      workouts,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `fitday-${user.username}-${exportStamp()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <div className="page profile-page">
    <header className="profile-header">
      <button className="avatar avatar-button" onClick={() => setEditingProfile(true)} aria-label="编辑头像与昵称">
        {user.avatar ? <img src={user.avatar} alt=""/> : <span>{displayNameOf(user).slice(0, 1).toUpperCase()}</span>}
        <span className="avatar-edit"><Icon name="camera" size={14}/></span>
      </button>
      <div><p className="eyebrow">我的训练</p><h1>{displayNameOf(user)}</h1>{user.displayName && <p className="profile-username">@{user.username}</p>}</div>
      <button className="icon-button" onClick={() => setEditingProfile(true)} aria-label="编辑资料"><Icon name="edit"/></button>
    </header>
    <section className="stats-grid"><div><strong>{workouts.length}</strong><span>累计训练</span></div><div><strong>{workouts.reduce((sum, item) => sum + item.sets.length, 0)}</strong><span>完成组数</span></div><div><strong>{Math.round(volume)}</strong><span>累计容量 kg</span></div></section>

    <section className="section-block"><div className="section-title"><h2>当前计划</h2></div><button className="current-plan" onClick={onChangePlan}><span><small>{plan.location === 'gym' ? '健身房' : '居家'} · {plan.days.length} 天循环</small><strong>{plan.name}</strong><span>下一站：{orderedDays(plan, user.planDayOrder)[user.cyclePosition % plan.days.length].name}</span></span><Icon name="arrow"/></button>
      <div className="plan-actions">
        <button className="secondary" onClick={onCustomize}><Icon name="spark" size={16}/>自定义动作与组数</button>
        <button className="secondary" onClick={onChangePlan}>更换计划</button>
      </div>
      <p className="plan-custom-hint">{Object.keys(user.planCustomization ?? {}).length ? '已保存自定义方案，训练时按你的设置执行。' : `推荐每个动作 ${RECOMMENDED_SETS_MIN}–${RECOMMENDED_SETS_MAX} 组，可在自定义里调整。`}</p>
    </section>

    {loading && <p className="history-hint">正在整理训练历史…</p>}
    {!loading && trends.length > 0 && <section className="section-block progress-section"><div className="section-title"><div><p className="eyebrow">最近 8 次</p><h2>力量进展</h2></div><span>{trends.length} 个动作</span></div>
      <div className="trend-list">{trends.slice(0, 5).map((trend) => <button className="trend-card" key={trend.key} onClick={() => setSelectedTrend(trend)}>
        <div className="trend-copy"><strong>{trend.name}</strong><span>{trend.bestE1rm ? `最佳预估 1RM ${trend.bestE1rm} kg` : `最佳 ${trend.bestReps} 次`}</span><small>最近 {trend.last.bestWeight > 0 ? `${trend.last.bestWeight} kg × ` : ''}{trend.last.bestReps} 次 · {shortDate(trend.last.completedAt)}</small></div>
        {trend.points.length > 1 ? <TrendChart trend={trend}/> : <span className="trend-baseline">基线</span>}
      </button>)}</div>
    </section>}

    <section className="section-block"><div className="section-title"><h2>最近训练</h2><span>{workouts.length} 条</span></div>{error && <p className="form-error">{error}</p>}{!error && !loading && workouts.length === 0 && <div className="empty-history"><strong>第一条记录，等你完成。</strong><p>训练保存后会出现在这里。</p></div>}
      <div className="history-list">{workouts.map((workout) => {
        const expanded = expandedWorkout === workout.id
        const workoutVolume = workout.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0)
        const exerciseNames = Array.from(new Set(workout.sets.map((set) => set.exerciseName)))
        return <article key={workout.id} className={expanded ? 'expanded' : ''}><button className="history-toggle" onClick={() => setExpandedWorkout(expanded ? null : workout.id)}><div><strong>{workout.planDayName}</strong><p>{fullDate(workout.completedAt)} · {workout.sets.length} 组{workoutVolume > 0 ? ` · ${Math.round(workoutVolume)} kg` : ''}</p></div><span>{expanded ? '收起' : '详情'}</span></button>
          {expanded && <div className="history-detail">{exerciseNames.map((name) => {
            const sets = workout.sets.filter((set) => set.exerciseName === name)
            const best = sets.reduce((top, set) => set.weightKg > top.weightKg || (set.weightKg === top.weightKg && set.reps > top.reps) ? set : top, sets[0])
            return <div key={name}><span>{name}</span><strong>{sets.length} 组</strong><small>最佳 {best.weightKg > 0 ? `${best.weightKg} kg × ` : ''}{best.reps} 次</small></div>
          })}</div>}
        </article>
      })}</div>
    </section>

    <section className="section-block profile-tools">
      <div className="section-title"><h2>数据与应用</h2></div>
      {!installed && installPrompt && <button className="utility-row" onClick={installApp}><span><Icon name="install"/><span><strong>安装到手机桌面</strong><small>全屏打开，像原生应用一样使用</small></span></span><span>安装</span></button>}
      <button className="utility-row" onClick={exportData} disabled={loading}><span><Icon name="download"/><span><strong>导出我的数据</strong><small>JSON 文件，包含计划和全部训练记录</small></span></span><Icon name="arrow" size={18}/></button>
    </section>

    <button className="logout-button" onClick={onLogout}><Icon name="logout"/>退出登录</button>
    <p className="attribution">Fitday v1.6.0<br/>动作数据：hasaneyldrm/exercises-dataset<br/>媒体：© Gym visual · 计划参考：B站好人松松</p>

    {editingProfile && <ProfileEditor user={user} onSave={async (displayName, avatar) => { await onProfileChange(displayName, avatar); setEditingProfile(false) }} onClose={() => setEditingProfile(false)}/>}
    {selectedTrend && <div className="modal-backdrop" onClick={() => setSelectedTrend(null)}><article className="exercise-modal trend-detail" onClick={(event) => event.stopPropagation()}>
      <div className="sheet-topbar"><BackButton label="返回我的" onClick={() => setSelectedTrend(null)}/><button className="icon-button" onClick={() => setSelectedTrend(null)} aria-label="关闭趋势详情"><Icon name="close"/></button></div>
      <p className="eyebrow">动作趋势</p><h2>{selectedTrend.name}</h2>
      <div className="trend-hero"><div><strong>{selectedTrend.bestE1rm ?? '—'}<small>{selectedTrend.bestE1rm ? ' kg 预估 1RM' : ''}</small></strong><span>历史最佳</span></div><div><strong>{selectedTrend.bestWeight}<small> kg</small></strong><span>最大重量</span></div><div><strong>{selectedTrend.bestReps}<small> 次</small></strong><span>最高次数</span></div></div>
      <TrendChart trend={selectedTrend} large/>
      <div className="trend-sessions">{selectedTrend.points.slice(-8).reverse().map((point) => <div key={point.workoutId}><span>{shortDate(point.completedAt)}</span><strong>{point.bestWeight > 0 ? `${point.bestWeight} kg × ` : ''}{point.bestReps} 次</strong><small>{point.e1rm ? `e1RM ${point.e1rm} kg` : `${point.sets.length} 组`}</small></div>)}</div>
      <div className="sheet-footer"><button className="secondary full" onClick={() => setSelectedTrend(null)}><Icon name="back" size={17}/>返回我的</button></div>
    </article></div>}
  </div>
}
