export interface DraftSetValue {
  reps: number
  weightKg: number
}

export interface WorkoutDraft {
  version: 1
  userId: string
  planId: string
  planDayId: string
  planDayName: string
  startedAt: string
  values: Record<string, DraftSetValue>
  completed: string[]
  updatedAt: string
}

const storageKey = (userId: string) => `fitday.workout-draft.${userId}`

export function loadWorkoutDraft(userId: string): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const draft = JSON.parse(raw) as WorkoutDraft
    if (draft.version !== 1 || draft.userId !== userId || !draft.planDayId || !draft.startedAt) return null
    return {
      ...draft,
      values: draft.values ?? {},
      completed: Array.isArray(draft.completed) ? draft.completed : [],
    }
  } catch {
    return null
  }
}

export function saveWorkoutDraft(draft: WorkoutDraft) {
  try { localStorage.setItem(storageKey(draft.userId), JSON.stringify(draft)) }
  catch { /* Storage can be unavailable in private browsing. */ }
}

export function clearWorkoutDraft(userId: string) {
  try { localStorage.removeItem(storageKey(userId)) }
  catch { /* Nothing else to clear. */ }
}
