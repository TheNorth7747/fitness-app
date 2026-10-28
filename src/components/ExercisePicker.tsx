import { useMemo, useState } from 'react'
import { EQUIPMENT_GROUPS, MUSCLE_GROUPS, type EquipmentGroup, type Exercise, type MuscleGroup } from '../../shared/api'
import { searchExercises } from '../../shared/exercises'
import { BackButton } from './BackButton'
import { ExerciseImage } from './ExerciseImage'
import { Icon } from './Icon'

const PAGE_SIZE = 40

/**
 * 从完整动作库挑动作。
 * 第一级：本组推荐 / 肌群；第二级：肌群下的器械过滤 + 动作列表。搜索直接出结果。
 */
export function ExercisePicker({ exercises, groupName, recommendedIds, excludeIds, onPick, onClose }: {
  exercises: Exercise[]
  groupName: string
  recommendedIds: string[]
  excludeIds: string[]
  onPick: (exercise: Exercise) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null)
  const [equipment, setEquipment] = useState<EquipmentGroup | '全部'>('全部')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds])
  const recommended = useMemo(
    () => recommendedIds.map((id) => exercises.find((item) => item.id === id)).filter((item): item is Exercise => Boolean(item)),
    [exercises, recommendedIds],
  )
  const muscleCounts = useMemo(() => {
    const counts = new Map<MuscleGroup, number>()
    for (const item of exercises) {
      if (excluded.has(item.id)) continue
      counts.set(item.primaryGroup, (counts.get(item.primaryGroup) ?? 0) + 1)
    }
    return counts
  }, [exercises, excluded])

  const results = useMemo(() => {
    const base = muscle
      ? exercises.filter((item) => item.primaryGroup === muscle && (equipment === '全部' || item.equipmentGroup === equipment))
      : searchExercises(exercises, query)
    return base.filter((item) => !excluded.has(item.id))
  }, [exercises, muscle, equipment, query, excluded])

  const equipmentCounts = useMemo(() => {
    const counts = new Map<EquipmentGroup, number>()
    if (!muscle) return counts
    for (const item of exercises) {
      if (item.primaryGroup !== muscle || excluded.has(item.id)) continue
      counts.set(item.equipmentGroup, (counts.get(item.equipmentGroup) ?? 0) + 1)
    }
    return counts
  }, [exercises, muscle, excluded])

  function pickMuscle(next: MuscleGroup) {
    setMuscle(next)
    setEquipment('全部')
    setVisible(PAGE_SIZE)
  }

  function back() {
    if (muscle) { setMuscle(null); setVisible(PAGE_SIZE); return }
    if (query) { setQuery(''); return }
    onClose()
  }

  const shown = results.slice(0, visible)

  return <div className="modal-backdrop picker-backdrop" onClick={onClose}>
    <section className="picker-sheet" onClick={(event) => event.stopPropagation()}>
      <div className="picker-top">
        <BackButton label={muscle ? '肌群' : '返回'} onClick={back} compact/>
        <div className="picker-title"><p className="eyebrow">{groupName}</p><h2>{muscle ? `${muscle}部动作` : '选择动作'}</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="关闭动作选择"><Icon name="close"/></button>
      </div>

      <div className="search-field picker-search">
        <Icon name="search" size={16}/>
        <input value={query} onChange={(event) => { setQuery(event.target.value); setMuscle(null); setVisible(PAGE_SIZE) }} placeholder="搜索中文名、英文名或器械" aria-label="搜索动作"/>
        {query && <button onClick={() => setQuery('')} aria-label="清空搜索"><Icon name="close" size={14}/></button>}
      </div>

      {!muscle && !query && <>
        {recommended.length > 0 && <div className="picker-block">
          <p className="picker-block-title">本组推荐</p>
          <div className="picker-list">{recommended.map((item) => <button key={item.id} className="picker-row" onClick={() => onPick(item)}>
            <ExerciseImage className="picker-thumb" src={item.gifUrl} alt={`${item.nameZh}演示`} fallback={item.nameZh}/>
            <span className="picker-copy"><strong>{item.nameZh}</strong><small>{item.primaryGroup} · {item.equipmentGroup}</small></span>
            <Icon name="plus" size={18}/>
          </button>)}</div>
        </div>}
        <div className="picker-block">
          <p className="picker-block-title">按肌群浏览 · 共 {exercises.length} 个动作</p>
          <div className="muscle-grid picker-muscles">
            {MUSCLE_GROUPS.filter((item) => (muscleCounts.get(item) ?? 0) > 0).map((item) => <button className="muscle-tile" key={item} onClick={() => pickMuscle(item)}>
              <span className="muscle-copy"><strong>{item}</strong><small>{muscleCounts.get(item)} 个动作</small></span>
              <Icon name="arrow" size={16}/>
            </button>)}
          </div>
        </div>
      </>}

      {(muscle || query) && <>
        {muscle && <div className="filter-row"><span>器械</span><div className="filter-scroll">
          <button className={equipment === '全部' ? 'selected' : ''} onClick={() => { setEquipment('全部'); setVisible(PAGE_SIZE) }}>全部</button>
          {EQUIPMENT_GROUPS.filter((item) => (equipmentCounts.get(item) ?? 0) > 0).map((item) => <button key={item} className={equipment === item ? 'selected' : ''} onClick={() => { setEquipment(item); setVisible(PAGE_SIZE) }}>{item}<small>{equipmentCounts.get(item)}</small></button>)}
        </div></div>}
        <p className="result-count">{results.length} 个动作{results.length > 40 ? ' · 下滑加载更多' : ''}</p>
        {results.length === 0 && <p className="history-hint">换个关键词，或返回上层换个肌群。</p>}
        <div className="picker-list">{shown.map((item) => <button key={item.id} className="picker-row" onClick={() => onPick(item)}>
          <ExerciseImage className="picker-thumb" src={item.gifUrl} alt={`${item.nameZh}演示`} fallback={item.nameZh}/>
          <span className="picker-copy"><strong>{item.nameZh}</strong><small>{item.primaryGroup} · {item.equipmentGroup} · {item.equipment}</small></span>
          <Icon name="plus" size={18}/>
        </button>)}</div>
        {results.length > visible && <button className="secondary full" onClick={() => setVisible((current) => current + PAGE_SIZE)}>加载更多动作</button>}
      </>}
    </section>
  </div>
}
