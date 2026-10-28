import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { api, loadExercises } from './api'
import type { Exercise, User } from '../shared/api'
import { getPlan, orderedDays, type PlanDay } from '../shared/plans'
import type { WorkoutSummary } from '../shared/progression'
import { BottomNav, type Tab } from './components/BottomNav'
import { GuestProfile } from './components/GuestProfile'
import { HomeScreen } from './components/HomeScreen'
import { LibraryScreen } from './components/LibraryScreen'
import { PlanEditorScreen } from './components/PlanEditorScreen'
import { PlanSelector } from './components/PlanSelector'
import { ProfileScreen } from './components/ProfileScreen'
import { WorkoutScreen } from './components/WorkoutScreen'
import { WorkoutSummaryScreen } from './components/WorkoutSummaryScreen'
import { cacheUser, clearCachedUser, readCachedUser } from './offlineCache'
import { clearWorkoutDraft, loadWorkoutDraft, saveWorkoutDraft, type WorkoutDraft } from './workoutDraft'

const GUEST_USER: User = {
  id: 'guest',
  username: '训练者',
  displayName: '',
  avatar: '',
  planId: 'gym-three',
  legFocus: 'quads',
  cyclePosition: 0,
  exerciseSelections: {},
  planCustomization: {},
  planDayOrder: [],
}

function App() {
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [changingPlan, setChangingPlan] = useState(false)
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState('')
  const [activeDay, setActiveDay] = useState<{ day: PlanDay; startedAt: string } | null>(null)
  const [draft, setDraft] = useState<WorkoutDraft | null>(null)
  const [summary, setSummary] = useState<WorkoutSummary | null>(null)
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseLoading, setExerciseLoading] = useState(true)
  const [exerciseError, setExerciseError] = useState('')

  const fetchExercises = useCallback(() => {
    setExerciseLoading(true); setExerciseError('')
    loadExercises().then(setExercises).catch((reason) => setExerciseError(reason.message)).finally(() => setExerciseLoading(false))
  }, [])

  useEffect(() => {
    let active = true
    api.me().then((result) => {
      if (!active) return
      setUser(result.user)
      if (result.user) cacheUser(result.user)
      else clearCachedUser()
      setDraft(result.user ? loadWorkoutDraft(result.user.id) : null)
    }).catch(() => {
      if (!active) return
      if (!navigator.onLine) {
        const cached = readCachedUser()
        if (cached) {
          setUser(cached)
          setDraft(loadWorkoutDraft(cached.id))
          setOffline(true)
        }
      } else setUser(null)
    }).finally(() => { if (active) setChecking(false) })
    loadExercises().then((list) => { if (active) setExercises(list) }).catch((reason) => { if (active) setExerciseError(reason.message) }).finally(() => { if (active) setExerciseLoading(false) })
    const goOffline = () => setOffline(true)
    const goOnline = () => { setOffline(false); window.location.reload() }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      active = false
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  function applyUser(next: User | null) {
    setUser(next)
    if (next) cacheUser(next)
    else clearCachedUser()
  }

  function requireAuth(message = '登录或注册后即可开始训练，并保存你的计划与记录。') {
    setAuthNotice(message)
    setTab('profile')
  }

  function beginWorkout(day: PlanDay) {
    if (!user) return
    const currentPlan = getPlan(user.planId ?? 'gym-three', user.legFocus)
    const draftDay = draft?.planId === currentPlan.id ? currentPlan.days.find((item) => item.id === draft.planDayId) : undefined
    if (draft && draftDay) {
      setActiveDay({ day: draftDay, startedAt: draft.startedAt })
      return
    }
    clearWorkoutDraft(user.id)
    setDraft(null)
    setActiveDay({ day, startedAt: new Date().toISOString() })
  }

  function discardDraft() {
    if (!user) return
    if (!window.confirm('放弃这次未完成的训练？已记录的组数会从本机删除。')) return
    clearWorkoutDraft(user.id)
    setDraft(null)
  }

  function requestPlanChange() {
    if (draft && !window.confirm('更换计划会放弃当前未完成的训练，继续吗？')) return
    if (draft && user) clearWorkoutDraft(user.id)
    if (draft) setDraft(null)
    setChangingPlan(true)
  }

  function handleDraftChange(next: WorkoutDraft | null) {
    if (!user) return
    setDraft(next)
    if (next) saveWorkoutDraft(next)
    else clearWorkoutDraft(user.id)
  }

  if (checking) return <main className="app-loading"><div className="brand-mark">F<span>·</span></div><p>正在恢复你的训练进度</p></main>
  if (summary) return <WorkoutSummaryScreen summary={summary} onDone={() => { setSummary(null); setTab('profile') }} onHome={() => { setSummary(null); setTab('home') }}/>
  if (user && editingDayId) return <PlanEditorScreen user={user} exercises={exercises} initialDayId={editingDayId} onSave={async (customization, dayOrder) => {
    const result = await api.savePlanCustomization(customization)
    applyUser(dayOrder.length ? (await api.saveDayOrder(dayOrder)).user : result.user)
    setEditingDayId(null)
  }} onClose={() => setEditingDayId(null)}/>
  if (user && (!user.planId || changingPlan)) return <PlanSelector initialPlan={user.planId} exercises={exercises} onCancel={user.planId ? () => setChangingPlan(false) : undefined} onComplete={(next) => { applyUser(next); setChangingPlan(false); setAuthNotice(''); setDraft(null); if (next.id) clearWorkoutDraft(next.id); setTab('home') }}/>
  if (user && activeDay) return <WorkoutScreen user={user} day={activeDay.day} startedAt={activeDay.startedAt} draft={draft} exercises={exercises} offline={offline} onClose={() => setActiveDay(null)} onDraftChange={handleDraftChange} onComplete={(next, workoutSummary) => { applyUser(next); setDraft(null); setActiveDay(null); setSummary(workoutSummary) }}/>

  const displayUser = user ?? GUEST_USER
  return <div className={offline ? 'app-shell offline' : 'app-shell'}>
    {offline && <div className="offline-banner" role="status">离线模式 · 训练进度暂存本机，联网后请再次保存</div>}
    <main className="app-main" key={tab}>
      {tab === 'home' && <HomeScreen user={displayUser} guest={!user} draft={user ? draft : null} exercises={exercises} onStart={beginWorkout} onChangePlan={requestPlanChange} onRequireAuth={() => requireAuth()} onDiscardDraft={discardDraft} onCustomize={(planDayId) => setEditingDayId(planDayId)} onOpenProfile={() => setTab('profile')} onCustomizationChange={async (customization) => {
        if (!user) return requireAuth()
        const result = await api.savePlanCustomization(customization)
        applyUser(result.user)
      }}/>}
      {tab === 'library' && <LibraryScreen exercises={exercises} loading={exerciseLoading} error={exerciseError} onRetry={fetchExercises}/>}
      {tab === 'profile' && (user
        ? <ProfileScreen user={user} onChangePlan={requestPlanChange} onCustomize={() => { const plan = getPlan(user.planId ?? 'gym-three', user.legFocus); setEditingDayId(orderedDays(plan, user.planDayOrder)[user.cyclePosition % plan.days.length].id) }} onProfileChange={async (displayName, avatar) => { const result = await api.saveProfile(displayName, avatar); applyUser(result.user) }} onLogout={async () => {
          try { await api.logout() } catch { /* Offline logout still clears this device. */ }
          clearWorkoutDraft(user.id); applyUser(null); setDraft(null); setActiveDay(null); setChangingPlan(false); setTab('profile')
        }}/>
        : <GuestProfile notice={authNotice} onAuthenticated={(next) => { applyUser(next); setDraft(loadWorkoutDraft(next.id)); setAuthNotice(''); setTab(next.planId ? 'home' : 'profile') }}/>)}
    </main>
    <BottomNav active={tab} onChange={(next) => { setTab(next); if (next !== 'profile') setAuthNotice('') }}/>
  </div>
}

export default App
