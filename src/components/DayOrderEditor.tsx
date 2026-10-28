import { useState } from 'react'
import type { PlanDay } from '../../shared/plans'
import { Icon } from './Icon'

/** 调整训练日顺序：Day 1 练什么、Day 2 练什么，由你决定 */
export function DayOrderEditor({ days, order, onChange }: {
  days: PlanDay[]
  order: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ordered = order.length ? order.map((id) => days.find((day) => day.id === id)!).filter(Boolean) : days

  function move(from: number, to: number) {
    if (to < 0 || to >= ordered.length) return
    const ids = ordered.map((day) => day.id)
    const next = [...ids]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return <section className="day-order">
    <button className="day-order-toggle" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
      <span><strong>循环顺序</strong><small>{ordered.map((day) => day.name.split(' · ')[0]).join(' → ')}</small></span>
      <span className={`day-order-caret ${open ? 'open' : ''}`}><Icon name="arrow" size={16}/></span>
    </button>
    {open && <div className="day-order-list">
      {ordered.map((day, index) => <div className="day-order-row" key={day.id}>
        <span className="day-order-index">DAY {index + 1}</span>
        <span className="day-order-name">{day.name}</span>
        <span className="day-order-actions">
          <button onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`${day.name} 上移`}>↑</button>
          <button onClick={() => move(index, index + 1)} disabled={index === ordered.length - 1} aria-label={`${day.name} 下移`}>↓</button>
        </span>
      </div>)}
      <p className="day-order-hint">上下移动即可改每天练什么部位，循环按这个顺序推进。</p>
    </div>}
  </section>
}
