import { useEffect, useMemo, useState } from 'react'
import type { Exercise, User, WorkoutRecord, WorkoutUpdateInput } from '../../shared/api'
import { buildWeeklyReport, formatDuration } from '../../shared/analytics'
import { buildExerciseTrends, type ExerciseTrend } from '../../shared/progression'
import { api } from '../api'
import { BackButton } from './BackButton'
import { Icon } from './Icon'
import { TrendChart } from './TrendChart'
import { WorkoutEditor } from './WorkoutEditor'

const shortDate = (iso: string) => new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(iso))
const fullDate = (iso: string) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const exportStamp = () => new Date().toISOString().slice(0, 10)
const exportNow = () => new Date().toISOString()

function ChangeBadge({ value, current }: { value: number | null; current: number }) {
  const label = value === null ? (current > 0 ? '新增' : '—') : value === 0 ? '持平' : `${value > 0 ? '+' : ''}${value}%`
  const tone = value === null ? (current > 0 ? 'new' : 'flat') : value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  return <span className={`change-badge ${tone}`}>{label}</span>
}

export function DataScreen({ user, exercises, onGoHome }: { user: User; exercises: Exercise[]; onGoHome: () => void }) {
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTrend, setSelectedTrend] = useState<ExerciseTrend | null>(null)
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null)
  const [editingWorkout, setEditingWorkout] = useState<WorkoutRecord | null>(null)
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    let active = true
    api.workouts().then((result) => {
      if (active) setWorkouts(result.workouts)
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : '训练数据加载失败')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const report = useMemo(() => buildWeeklyReport(workouts, exercises), [workouts, exercises])
  const trends = useMemo(() => buildExerciseTrends(workouts), [workouts])
  const rangeLabel = useMemo(() => {
    const format = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })
    const lastDay = new Date(report.range.end.getTime() - 1)
    return `${format.format(report.range.start)} – ${format.format(lastDay)}`
  }, [report.range])

  const muscleRows = report.muscle.filter((item) => item.group !== '其他' || item.sets > 0)
  const peakSets = Math.max(1, ...muscleRows.map((item) => Math.max(item.sets, item.baselineSets ?? 0)))
  const trainedGroups = muscleRows.filter((item) => item.sets > 0).length
  const untrainedGroups = muscleRows.filter((item) => item.group !== '有氧' && item.sets === 0).map((item) => item.group)

  async function saveWorkout(id: string, input: WorkoutUpdateInput) {
    const result = await api.updateWorkout(id, input)
    setWorkouts((current) => current
      .map((workout) => workout.id === id ? result.workout : workout)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()))
  }

  async function deleteWorkout(workout: WorkoutRecord) {
    if (!window.confirm(`删除 ${fullDate(workout.completedAt)} 的「${workout.planDayName}」？删除后无法恢复。`)) return
    setDeletingId(workout.id); setError('')
    try {
      await api.deleteWorkout(workout.id)
      setWorkouts((current) => current.filter((item) => item.id !== workout.id))
      if (expandedWorkout === workout.id) setExpandedWorkout(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败，请稍后重试')
    } finally { setDeletingId('') }
  }

  function exportData() {
    const payload = {
      format: 'fitday-export',
      version: 1,
      exportedAt: exportNow(),
      account: {
        username: user.username,
        planId: user.planId,
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

  return <div className="page data-page">
    <header className="data-header">
      <div><p className="eyebrow">训练数据</p><h1>本周复盘</h1><span>{rangeLabel}</span></div>
      <button className="icon-button" onClick={exportData} disabled={loading || !workouts.length} aria-label="导出训练数据"><Icon name="download"/></button>
    </header>

    {loading && <p className="history-hint data-loading">正在整理本周训练…</p>}
    {error && !loading && <p className="form-error">{error}</p>}
    {!loading && workouts.length === 0 && <section className="data-empty">
      <span className="data-empty-icon"><Icon name="chart" size={26}/></span>
      <h2>先完成一次训练</h2>
      <p>完成后的组数、容量和肌群分布会自动出现在这里，不需要额外记录。</p>
      <button className="primary" onClick={onGoHome}>去今日训练</button>
    </section>}

    {!loading && workouts.length > 0 && <>
      <section className="week-hero">
        <div className="week-hero-top">
          <div><p>本周训练</p><strong>{report.current.workoutCount}<small> 次</small></strong></div>
          <ChangeBadge value={report.changes.workoutCount} current={report.current.workoutCount}/>
        </div>
        <div className="week-metrics">
          <div><strong>{report.current.totalSets}</strong><span>完成组数</span><ChangeBadge value={report.changes.totalSets} current={report.current.totalSets}/></div>
          <div><strong>{Math.round(report.current.volumeKg)}</strong><span>训练容量 kg</span><ChangeBadge value={report.changes.volumeKg} current={report.current.volumeKg}/></div>
          <div><strong>{formatDuration(report.current.durationSeconds)}</strong><span>训练时长</span><ChangeBadge value={report.changes.durationSeconds} current={report.current.durationSeconds}/></div>
        </div>
      </section>

      <section className="section-block data-muscle-section">
        <div className="section-title">
          <div><p className="eyebrow">本周分布</p><h2>肌群训练组数</h2></div>
          <span>{trainedGroups}/{muscleRows.length} 个分类</span>
        </div>
        <div className="data-panel muscle-panel">
          {muscleRows.map((item) => {
            const width = item.sets > 0 ? Math.max(2, item.sets / peakSets * 100) : 0
            const baseline = item.baselineSets === null ? null : item.baselineSets / peakSets * 100
            return <div className={`muscle-row ${item.sets === 0 ? 'untrained' : ''}`} key={item.group}>
              <span>{item.group}</span>
              <div className="muscle-track">
                <span className="muscle-fill" style={{ width: `${width}%` }}/>
                {baseline !== null && baseline > 0 && <i className="muscle-baseline" style={{ left: `${Math.min(100, baseline)}%` }}/>}
              </div>
              <strong>{item.sets}<small> 组</small></strong>
            </div>
          })}
          <p className="muscle-caption">
            {report.baselineAvailable ? '竖线为近 4 周周均；只统计动作归属，不代表精确肌肉激活。' : '历史不足 3 周，暂不显示周均基线。'}
          </p>
          {untrainedGroups.length > 0 && <p className="muscle-insight"><Icon name="spark" size={14}/>本周未训练：{untrainedGroups.join('、')}</p>}
        </div>
      </section>

      {trends.length > 0 && <section className="section-block">
        <div className="section-title"><div><p className="eyebrow">最近 8 次</p><h2>力量进展</h2></div><span>{trends.length} 个动作</span></div>
        <div className="trend-list">{trends.slice(0, 6).map((trend) => <button className="trend-card" key={trend.key} onClick={() => setSelectedTrend(trend)}>
          <div className="trend-copy"><strong>{trend.name}</strong><span>{trend.bestE1rm ? `最佳预估 1RM ${trend.bestE1rm} kg` : `最佳 ${trend.bestReps} 次`}</span><small>最近 {trend.last.bestWeight > 0 ? `${trend.last.bestWeight} kg × ` : ''}{trend.last.bestReps} 次 · {shortDate(trend.last.completedAt)}</small></div>
          {trend.points.length > 1 ? <TrendChart trend={trend}/> : <span className="trend-baseline">基线</span>}
        </button>)}</div>
      </section>}

      <section className="section-block">
        <div className="section-title"><h2>最近训练</h2><span>{workouts.length} 条</span></div>
        <div className="history-list">{workouts.map((workout) => {
          const expanded = expandedWorkout === workout.id
          const workoutVolume = workout.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0)
          const exerciseNames = Array.from(new Set(workout.sets.map((set) => set.exerciseName)))
          return <article key={workout.id} className={expanded ? 'expanded' : ''}>
            <button className="history-toggle" onClick={() => setExpandedWorkout(expanded ? null : workout.id)}><div><strong>{workout.planDayName}</strong><p>{fullDate(workout.completedAt)} · {workout.sets.length} 组{workoutVolume > 0 ? ` · ${Math.round(workoutVolume)} kg` : ''}</p></div><span>{expanded ? '收起' : '详情'}</span></button>
            {expanded && <div className="history-detail">{exerciseNames.map((name) => {
              const sets = workout.sets.filter((set) => set.exerciseName === name)
              const best = sets.reduce((top, set) => set.weightKg > top.weightKg || (set.weightKg === top.weightKg && set.reps > top.reps) ? set : top, sets[0])
              return <div key={name}><span>{name}</span><strong>{sets.length} 组</strong><small>最佳 {best.weightKg > 0 ? `${best.weightKg} kg × ` : ''}{best.reps} 次</small></div>
            })}</div>}
            {expanded && <div className="history-actions">
              <button className="secondary" onClick={() => setEditingWorkout(workout)}><Icon name="edit" size={15}/>编辑记录</button>
              <button className="danger-link" disabled={deletingId === workout.id} onClick={() => void deleteWorkout(workout)}>{deletingId === workout.id ? '正在删除…' : '删除'}</button>
            </div>}
          </article>
        })}</div>
      </section>
    </>}

    {editingWorkout && <WorkoutEditor key={editingWorkout.id} workout={editingWorkout} onSave={(input) => saveWorkout(editingWorkout.id, input)} onClose={() => setEditingWorkout(null)}/>}

    {selectedTrend && <div className="modal-backdrop" onClick={() => setSelectedTrend(null)}><article className="exercise-modal trend-detail" onClick={(event) => event.stopPropagation()}>
      <div className="sheet-topbar"><BackButton label="返回数据" onClick={() => setSelectedTrend(null)}/><button className="icon-button" onClick={() => setSelectedTrend(null)} aria-label="关闭趋势详情"><Icon name="close"/></button></div>
      <p className="eyebrow">动作趋势</p><h2>{selectedTrend.name}</h2>
      <div className="trend-hero"><div><strong>{selectedTrend.bestE1rm ?? '—'}<small>{selectedTrend.bestE1rm ? ' kg 预估 1RM' : ''}</small></strong><span>历史最佳</span></div><div><strong>{selectedTrend.bestWeight}<small> kg</small></strong><span>最大重量</span></div><div><strong>{selectedTrend.bestReps}<small> 次</small></strong><span>最高次数</span></div></div>
      <TrendChart trend={selectedTrend} large/>
      <div className="trend-sessions">{selectedTrend.points.slice(-8).reverse().map((point) => <div key={point.workoutId}><span>{shortDate(point.completedAt)}</span><strong>{point.bestWeight > 0 ? `${point.bestWeight} kg × ` : ''}{point.bestReps} 次</strong><small>{point.e1rm ? `e1RM ${point.e1rm} kg` : `${point.sets.length} 组`}</small></div>)}</div>
      <div className="sheet-footer"><button className="secondary full" onClick={() => setSelectedTrend(null)}><Icon name="back" size={17}/>返回数据</button></div>
    </article></div>}
  </div>
}

export function GuestData({ onLogin }: { onLogin: () => void }) {
  return <div className="page data-page">
    <header className="data-header"><div><p className="eyebrow">训练数据</p><h1>本周复盘</h1><span>登录后统计你的训练</span></div></header>
    <section className="data-empty">
      <span className="data-empty-icon"><Icon name="chart" size={26}/></span>
      <h2>数据从一次训练开始</h2>
      <p>登录后可查看本周训练次数、组数、容量、肌群分布与力量趋势。</p>
      <button className="primary" onClick={onLogin}>去登录</button>
    </section>
  </div>
}
