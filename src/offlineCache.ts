import type { User } from '../shared/api'

const KEY = 'fitday.last-user'

export function cacheUser(user: User) {
  try { localStorage.setItem(KEY, JSON.stringify(user)) }
  catch { /* Private browsing can disable storage. */ }
}

export function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const user = JSON.parse(raw) as User
    return user && typeof user.id === 'string' && typeof user.username === 'string' ? user : null
  } catch {
    return null
  }
}

export function clearCachedUser() {
  try { localStorage.removeItem(KEY) }
  catch { /* Nothing else to clear. */ }
}
