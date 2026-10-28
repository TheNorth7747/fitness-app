import type { WorkoutSummary } from '../../shared/progression'
import { Icon } from './Icon'

export function WorkoutSummaryScreen({ summary, onDone, onHome }: { summary: WorkoutSummary; onDone: () => void; onHome: () => void }) {
  return <main className="summary-screen">
    <section className="summary-hero">
      <span className="summary-check"><Icon name="check" size={30}/></span>
      <p className="eyebrow">训练完成</p>
      <h1>又完成<br/>一次积累。</h1>
      <p>{summary.nextDayName ? `下一站：${summary.nextDayName}` : '保持节奏，下一次继续。'}</p>
    </section>
    <section className="summary-stats">
      <div><strong>{summary.durationMinutes}</strong><span>分钟</span></div>
      <div><strong>{summary.totalSets}</strong><span>完成组数</span></div>
      <div><strong>{summary.volumeKg}</strong><span>训练容量 kg</span></div>
    </section>
    <section className="summary-prs">
      <div className="section-title"><div><p className="eyebrow">本次亮点</p><h2>{summary.prs.length ? '新的个人记录' : '稳定完成'}</h2></div><span>{summary.prs.length} 项</span></div>
      {summary.prs.length ? <div className="pr-list">{summary.prs.map((record) => <article key={`${record.exerciseKey}-${record.kind}`}><span><Icon name="spark" size={18}/></span><div><strong>{record.exerciseName}</strong><p>{record.kind === 'e1rm' ? '预估 1RM' : '单组次数'}提升</p></div><div className="pr-value"><strong>{record.value}{record.kind === 'e1rm' ? ' kg' : ' 次'}</strong><small>此前 {record.previous ?? '—'}</small></div></article>)}</div>
        : <p className="summary-empty">没有打破记录也没关系。按计划完成 {summary.exerciseCount} 个动作，本身就是有效训练。</p>}
    </section>
    <div className="summary-actions">
      <button className="primary full" onClick={onDone}>查看训练记录</button>
      <button className="text-button" onClick={onHome}>回到首页</button>
    </div>
  </main>
}
