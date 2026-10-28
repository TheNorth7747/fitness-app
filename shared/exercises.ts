import type { Exercise, MuscleGroup } from './api.js'

/** 按英文原名匹配动作库条目：完全匹配优先，其次包含，最后逐词包含。 */
export function matchExercise(exercises: Exercise[], query: string): Exercise | undefined {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return undefined
  return exercises.find((item) => item.name.toLowerCase() === normalized)
    ?? exercises.find((item) => item.name.toLowerCase().includes(normalized))
    ?? exercises.find((item) => normalized.split(' ').every((word) => item.name.toLowerCase().includes(word)))
}

export function findExercise(exercises: Exercise[], id: string): Exercise | undefined {
  if (!id) return undefined
  return exercises.find((item) => item.id === id)
}

/** 计划动作组名 → 打开动作库时默认落脚的肌群。 */
export function defaultMuscleForGroup(groupName: string): MuscleGroup {
  if (/垂直拉|水平拉|背|引体|划船/.test(groupName)) return '背'
  if (/胸/.test(groupName)) return '胸'
  if (/肩/.test(groupName)) return '肩'
  if (/二头|三头|臂|弯举|臂屈伸/.test(groupName)) return '手臂'
  if (/臀/.test(groupName)) return '臀'
  if (/股四|腿|深蹲|硬拉|后侧链|腘绳/.test(groupName)) return '腿'
  if (/腹|核心/.test(groupName)) return '核心'
  return '其他'
}

/** 搜索：中文名、英文原名、肌群、器械与步骤内容。 */
export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return exercises
  return exercises.filter((item) => (
    item.nameZh.toLowerCase().includes(normalized)
    || item.name.toLowerCase().includes(normalized)
    || item.primaryGroup.includes(normalized)
    || item.equipmentGroup.includes(normalized)
    || item.target.toLowerCase().includes(normalized)
  ))
}
