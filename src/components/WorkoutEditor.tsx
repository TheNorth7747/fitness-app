import { useState } from 'react'
import type { WorkoutRecord, WorkoutSetInput, WorkoutUpdateInput } from '../../shared/api'
import { fromDateTimeLocal, toDateTimeLocal } from '../../shared/analytics'
import { BackButton } from './BackButton'
import { Icon } from './Icon'

export function WorkoutEditor({ workout, onSave, onClose }: {
  workout: WorkoutRecord
  onSave: (input: WorkoutUpdateInput) => Promise<void>
  onClose: () => void
}) {
  const [startedAt, setStartedAt] = useState(toDateTimeLocal(workout.startedAt))
  const [completedAt, setCompletedAt] = useState(toDateTimeLocal(workout.completedAt))
  const [sets, setSets] = useState<WorkoutSetInput[]>(workout.sets.map((set) => ({ ...set })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateSet(index: number, field: 'reps' | 'weightKg', value: number) {
    setSets((current) => current.map((set, position) => position === index ? { ...set, [field]: value } : set))
  }

  async function submit() {
    const started = fromDateTimeLocal(startedAt)
    const completed = fromDateTimeLocal(completedAt)
    if (!started || !completed) return setError('请填写有效的训练时间')
    if (new Date(completed).getTime() < new Date(started).getTime()) return setError('结束时间不能早于开始时间')
    if (sets.some((set) => set.reps < 1 || set.reps > 100 || set.weightKg < 0 || set.weightKg > 1000)) {
      return setError('次数需为 1–100，重量需为 0–1000 kg')
    }
    setSaving(true); setError('')
    try {
      await onSave({ startedAt: started, completedAt: completed, sets })
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试')
    } finally { setSaving(false) }
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <article className="data-editor" onClick={(event) => event.stopPropagation()}>
      <div className="sheet-topbar">
        <BackButton label="返回数据" onClick={onClose} compact/>
        <button className="icon-button" onClick={onClose} aria-label="关闭历史编辑"><Icon name="close"/></button>
      </div>
      <p className="eyebrow">历史纠错</p>
      <h2>{workout.planDayName}</h2>
      <p className="data-editor-hint">修正错误重量、次数或训练时间，保存后统计会立即重算。</p>

      <div className="edit-time-grid">
        <label>开始时间<input type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)}/></label>
        <label>结束时间<input type="datetime-local" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)}/></label>
      </div>

      <div className="edit-set-list">
        {sets.map((set, index) => <div className="edit-set-row" key={`${set.exerciseKey}-${set.setNumber}-${index}`}>
          <div><strong>{set.exerciseName}</strong><small>第 {set.setNumber} 组</small></div>
          <label>kg<input type="number" min="0" max="1000" step="0.5" value={set.weightKg} onChange={(event) => updateSet(index, 'weightKg', Number(event.target.value))}/></label>
          <label>次<input type="number" min="1" max="100" value={set.reps} onChange={(event) => updateSet(index, 'reps', Number(event.target.value))}/></label>
        </div>)}
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="data-editor-actions">
        <button className="secondary" onClick={onClose} disabled={saving}>取消</button>
        <button className="primary" onClick={submit} disabled={saving}>{saving ? '正在保存…' : '保存修正'}</button>
      </div>
    </article>
  </div>
}
