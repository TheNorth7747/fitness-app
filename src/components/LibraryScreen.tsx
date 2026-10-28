import { useMemo, useRef, useState } from 'react'
import { EQUIPMENT_GROUPS, MUSCLE_GROUPS, type EquipmentGroup, type Exercise, type MuscleGroup } from '../../shared/api'
import { matchExercise } from '../api'
import { BackButton } from './BackButton'
import { ExerciseImage } from './ExerciseImage'
import { Icon } from './Icon'

const GROUP_META: Record<MuscleGroup, { caption: string; cue: string }> = {
  胸: { caption: '推与夹胸', cue: '保持肩胛稳定，先用可控重量完成全程动作。' },
  背: { caption: '下拉与划船', cue: '先沉肩，再用肘部带动重量，避免耸肩借力。' },
  肩: { caption: '推举与平举', cue: '动作幅度以肩关节舒适为准，不要用腰部甩起重量。' },
  手臂: { caption: '二头与三头', cue: '固定上臂位置，让目标肌肉完成主要发力。' },
  腿: { caption: '蹲、拉与提踵', cue: '膝盖跟随脚尖方向，保持足底稳定。' },
  臀: { caption: '髋伸与外展', cue: '用臀部主动伸髋，避免腰部过度代偿。' },
  核心: { caption: '稳定与旋转', cue: '保持腰背中立，先控制动作再追求次数。' },
  有氧: { caption: '心肺与耐力', cue: '按体感控制强度，能保持稳定节奏比冲快更重要。' },
  其他: { caption: '综合与康复', cue: '先确认动作轨迹和关节舒适度，再逐步增加负荷。' },
}

const FEATURED = [
  'barbell bench press', 'barbell full squat', 'barbell deadlift', 'cable pulldown', 'cable low seated row',
  'dumbbell seated shoulder press', 'dumbbell lateral raise', 'dumbbell biceps curl', 'cable pushdown',
  'sled 45° leg press (side pov)', 'lever lying leg curl', 'weighted front plank', 'push-up', 'barbell romanian deadlift',
]
const RECENT_KEY = 'fitday.recent-exercises'
const PAGE_SIZE = 30

function readRecent() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 6) : []
  } catch { return [] }
}

export function LibraryScreen({ exercises, loading, error, onRetry }: { exercises: Exercise[]; loading: boolean; error: string; onRetry: () => void }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<MuscleGroup | '全部'>('全部')
  const [equipment, setEquipment] = useState<EquipmentGroup | '全部'>('全部')
  const [target, setTarget] = useState('全部')
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [showAll, setShowAll] = useState(false)
  const [recentIds, setRecentIds] = useState<string[]>(readRecent)
  const detailRef = useRef<HTMLElement | null>(null)

  const groupCounts = useMemo(() => {
    const counts = new Map<MuscleGroup, number>()
    for (const item of exercises) counts.set(item.primaryGroup, (counts.get(item.primaryGroup) ?? 0) + 1)
    return counts
  }, [exercises])
  const activeGroups = MUSCLE_GROUPS.filter((item) => (groupCounts.get(item) ?? 0) > 0)
  const equipmentCounts = useMemo(() => {
    const counts = new Map<EquipmentGroup, number>()
    for (const item of exercises) {
      if (group !== '全部' && item.primaryGroup !== group) continue
      counts.set(item.equipmentGroup, (counts.get(item.equipmentGroup) ?? 0) + 1)
    }
    return counts
  }, [exercises, group])
  const activeEquipmentGroups = EQUIPMENT_GROUPS.filter((item) => (equipmentCounts.get(item) ?? 0) > 0)
  const equipmentOptions: Array<EquipmentGroup | '全部'> = ['全部', ...activeEquipmentGroups]
  const targetCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of exercises) {
      if (group !== '全部' && item.primaryGroup !== group) continue
      if (equipment !== '全部' && item.equipmentGroup !== equipment) continue
      counts.set(item.target, (counts.get(item.target) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [exercises, group, equipment])

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    const basics = new Map(FEATURED.map((name, index) => [name.toLowerCase(), index]))
    return exercises.filter((item) => {
      if (group !== '全部' && item.primaryGroup !== group) return false
      if (equipment !== '全部' && item.equipmentGroup !== equipment) return false
      if (target !== '全部' && item.target !== target) return false
      if (!normalizedQuery) return true
      return `${item.nameZh} ${item.name} ${item.target} ${item.equipment} ${item.category} ${item.primaryGroup} ${item.instructions.join(' ')}`.toLowerCase().includes(normalizedQuery)
    }).sort((a, b) => {
      if (normalizedQuery) {
        const score = (item: Exercise) => {
          const zh = item.nameZh.toLowerCase()
          const en = item.name.toLowerCase()
          if (zh === normalizedQuery || en === normalizedQuery) return 0
          if (zh.startsWith(normalizedQuery) || en.startsWith(normalizedQuery)) return 1
          if (zh.includes(normalizedQuery) || en.includes(normalizedQuery)) return 2
          return 3
        }
        return score(a) - score(b) || a.nameZh.localeCompare(b.nameZh, 'zh-CN')
      }
      const aFeatured = basics.get(a.name.toLowerCase()) ?? 999
      const bFeatured = basics.get(b.name.toLowerCase()) ?? 999
      return aFeatured - bFeatured || a.nameZh.localeCompare(b.nameZh, 'zh-CN')
    })
  }, [exercises, group, equipment, target, normalizedQuery])

  const browsing = Boolean(normalizedQuery) || showAll || group !== '全部' || equipment !== '全部' || target !== '全部'
  const featured = useMemo(() => {
    const found = FEATURED.map((queryName) => matchExercise(exercises, queryName)).filter((item): item is Exercise => Boolean(item))
    return Array.from(new Map(found.map((item) => [item.id, item])).values()).slice(0, 8)
  }, [exercises])
  const recent = useMemo(() => recentIds.map((id) => exercises.find((item) => item.id === id)).filter((item): item is Exercise => Boolean(item)), [recentIds, exercises])
  const related = useMemo(() => {
    if (!selected) return []
    const sameTarget = exercises.filter((item) => item.id !== selected.id && item.primaryGroup === selected.primaryGroup && item.target === selected.target)
    const sameGroup = exercises.filter((item) => item.id !== selected.id && item.primaryGroup === selected.primaryGroup)
    return Array.from(new Map([...sameTarget, ...sameGroup].map((item) => [item.id, item])).values()).slice(0, 5)
  }, [exercises, selected])

  function openExercise(item: Exercise) {
    setSelected(item)
    const next = [item.id, ...recentIds.filter((id) => id !== item.id)].slice(0, 6)
    setRecentIds(next)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* Recent history is optional. */ }
  }

  function openRelated(item: Exercise) {
    openExercise(item)
    requestAnimationFrame(() => detailRef.current?.scrollTo({ top: 0 }))
  }

  function pickGroup(next: MuscleGroup) {
    setGroup(next); setShowAll(false); setQuery(''); setEquipment('全部'); setTarget('全部'); setVisible(PAGE_SIZE)
  }

  function pickEquipment(next: EquipmentGroup | '全部') {
    setEquipment(next); setTarget('全部'); setVisible(PAGE_SIZE)
  }

  function pickTarget(next: string) {
    setTarget(next); setVisible(PAGE_SIZE)
  }

  function clearFilters() {
    setGroup('全部'); setEquipment('全部'); setTarget('全部'); setQuery(''); setShowAll(false); setVisible(PAGE_SIZE)
  }

  /** Peel one level off the hierarchy so "返回" always undoes the last choice. */
  function stepBack() {
    if (target !== '全部') { setTarget('全部'); setVisible(PAGE_SIZE); return }
    if (equipment !== '全部') { setEquipment('全部'); setVisible(PAGE_SIZE); return }
    if (normalizedQuery) { setQuery(''); setVisible(PAGE_SIZE); return }
    clearFilters()
  }

  const backLabel = target !== '全部' ? '全部目标' : equipment !== '全部' ? '全部器械' : normalizedQuery ? '清除搜索' : group !== '全部' ? '所有肌群' : '动作库首页'

  const activeGroupMeta = group === '全部' ? null : GROUP_META[group]

  return <div className="page library-page">
    <header className="library-header">
      <div><p className="eyebrow">EXERCISE LIBRARY</p><h1>动作库</h1><p>{exercises.length ? `${exercises.length} 个动作 · 中文名称与分步教学` : '开源动作数据与中文分步说明'}</p></div>
      <span className="library-total"><strong>{exercises.length || '—'}</strong><small>动作</small></span>
    </header>

    <div className="search-field">
      <Icon name="search" size={19}/>
      <input aria-label="搜索动作" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE) }} placeholder="搜中文、英文或肌群，如：卧推"/>
      {query && <button onClick={() => setQuery('')} aria-label="清空搜索"><Icon name="close" size={16}/></button>}
    </div>

    {loading && <div className="empty-state"><strong>正在加载动作库…</strong><p>首次加载需要读取动作数据。</p></div>}
    {error && <div className="empty-state"><strong>{error}</strong><button className="secondary" onClick={onRetry}>重新加载</button></div>}

    {!loading && !error && !browsing && <>
      <div className="quick-searches"><span>常用搜索</span>{['卧推', '深蹲', '划船', '硬拉', '提踵'].map((term) => <button key={term} onClick={() => setQuery(term)}>{term}</button>)}</div>
      <section className="library-section">
        <div className="section-title"><div><p className="eyebrow">BY MUSCLE</p><h2>按肌群浏览</h2></div><span>{activeGroups.length} 个分类</span></div>
        <div className="muscle-grid">{activeGroups.map((item, index) => <button className="muscle-tile" key={item} onClick={() => pickGroup(item)} data-group={item}>
          <span className="muscle-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="muscle-copy"><strong>{item}</strong><small>{GROUP_META[item].caption}</small></span>
          <span className="muscle-count">{groupCounts.get(item)}</span>
        </button>)}</div>
        <button className="all-exercises" onClick={() => { setShowAll(true); setVisible(PAGE_SIZE) }}><span>浏览全部动作</span><small>{exercises.length} 个</small><Icon name="arrow" size={17}/></button>
      </section>
      {recent.length > 0 && <section className="library-section">
        <div className="section-title"><h2>最近浏览</h2><span>本机记录</span></div>
        <div className="recent-row">{recent.map((item) => <button key={item.id} onClick={() => openExercise(item)}><ExerciseImage src={item.gifUrl} alt={`${item.nameZh}动作演示`} fallback={item.nameZh}/><span>{item.nameZh}</span></button>)}</div>
      </section>}
      <section className="library-section">
        <div className="section-title"><div><p className="eyebrow">START HERE</p><h2>推荐先学</h2></div><span>基础复合动作</span></div>
        <div className="exercise-list">{featured.map((item) => <ExerciseRow key={item.id} item={item} onClick={() => openExercise(item)}/>)}</div>
      </section>
    </>}

    {!loading && !error && browsing && <>
      <div className="library-toolbar">
        <BackButton label="返回" onClick={stepBack}/>
        <div className="library-location">
          <strong>{group === '全部' ? (normalizedQuery ? '搜索结果' : '全部动作') : group}</strong>
          <span>{backLabel} · {filtered.length} 个</span>
        </div>
      </div>
      {group !== '全部' && activeGroupMeta && <div className="group-heading"><div><h2>{group}动作</h2><p>{activeGroupMeta.caption}</p></div><span>{filtered.length}</span></div>}
      {normalizedQuery && <p className="search-summary">“{query.trim()}” 的搜索结果 · {filtered.length} 个</p>}

      <div className="filter-stack">
        <div className="filter-row"><span>器械</span><div className="filter-scroll">{equipmentOptions.map((item) => <button key={item} className={equipment === item ? 'selected' : ''} onClick={() => pickEquipment(item)}>{item}{item !== '全部' && (equipmentCounts.get(item) ?? 0) > 0 ? <small>{equipmentCounts.get(item)}</small> : null}</button>)}</div></div>
        {group !== '全部' && targetCounts.length > 1 && <div className="filter-row"><span>目标</span><div className="filter-scroll"><button className={target === '全部' ? 'selected' : ''} onClick={() => pickTarget('全部')}>全部</button>{targetCounts.slice(0, 12).map(([name, count]) => <button key={name} className={target === name ? 'selected' : ''} onClick={() => pickTarget(name)}>{name}<small>{count}</small></button>)}</div></div>}
      </div>

      {filtered.length === 0 && <div className="empty-state"><strong>没有找到匹配动作</strong><p>试试更短的关键词，或清除筛选。</p><button className="secondary" onClick={clearFilters}>清除筛选</button></div>}
      {filtered.length > 0 && <>
        <div className="result-count"><span>显示 {Math.min(visible, filtered.length)} / {filtered.length}</span>{target !== '全部' || equipment !== '全部' ? <button onClick={() => { setTarget('全部'); setEquipment('全部') }}>清除筛选</button> : null}</div>
        <div className="exercise-list">{filtered.slice(0, visible).map((item) => <ExerciseRow key={item.id} item={item} onClick={() => openExercise(item)}/>)}</div>
        {visible < filtered.length && <button className="load-more" onClick={() => setVisible((count) => count + PAGE_SIZE)}>加载更多动作 <span>{filtered.length - visible}</span></button>}
      </>}
    </>}

    {selected && <div className="modal-backdrop learn-backdrop" onClick={() => setSelected(null)}>
      <article className="exercise-modal learn-modal" ref={detailRef} onClick={(event) => event.stopPropagation()}>
        <header className="learn-head">
          <div className="learn-head-top">
            <BackButton label="返回列表" onClick={() => setSelected(null)} compact/>
            <button className="icon-button" onClick={() => setSelected(null)} aria-label="关闭详情"><Icon name="close"/></button>
          </div>
          <div className="learn-head-title"><p className="eyebrow">动作学习</p><h2>{selected.nameZh}</h2><p className="learn-en">{selected.name}</p></div>
        </header>
        <div className="learn-media"><ExerciseImage src={selected.gifUrl} alt={`${selected.nameZh}动作演示`} fallback={selected.nameZh}/></div>
        <div className="learn-tags"><span>{selected.primaryGroup}</span><span>{selected.target}</span><span>{selected.equipment}</span></div>
        <section className="learn-section"><div className="learn-section-title"><h3>动作步骤</h3><span>{selected.instructions.length} 步</span></div><ol>{selected.instructions.map((step, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol></section>
        <aside className="learn-cue"><Icon name="spark" size={18}/><div><strong>练习提示</strong><p>{GROUP_META[selected.primaryGroup].cue}</p></div></aside>
        {related.length > 0 && <section className="learn-section related-section"><div className="learn-section-title"><h3>同部位动作</h3><span>继续学习</span></div><div className="related-list">{related.map((item) => <button key={item.id} onClick={() => openRelated(item)}><ExerciseImage src={item.gifUrl} alt={`${item.nameZh}动作演示`} fallback={item.nameZh}/><span>{item.nameZh}<small>{item.equipment}</small></span><Icon name="arrow" size={16}/></button>)}</div></section>}
        <a className="learn-attribution" href="https://gymvisual.com/" target="_blank" rel="noreferrer">{selected.attribution}</a>
        <div className="learn-footer"><button className="secondary full" onClick={() => setSelected(null)}><Icon name="back" size={17}/>返回动作列表</button></div>
      </article>
    </div>}
  </div>
}

function ExerciseRow({ item, onClick }: { item: Exercise; onClick: () => void }) {
  return <button className="exercise-row" onClick={onClick}>
    <ExerciseImage src={item.gifUrl} alt={`${item.nameZh}动作演示`} fallback={item.nameZh}/>
    <span className="exercise-row-copy"><strong>{item.nameZh}</strong><small>{item.name}</small><span>{item.primaryGroup} · {item.target} · {item.equipment}</span></span>
    <Icon name="arrow" size={18}/>
  </button>
}
