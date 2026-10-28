import type { EquipmentGroup, Exercise, MuscleGroup, User, WorkoutInput, WorkoutRecord } from '../shared/api'
import type { LegFocus, PlanCustomization } from '../shared/plans'

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || '网络请求失败，请稍后重试')
  return data as T
}

export const api = {
  me: () => request<{ user: User | null }>('/api/auth/me'),
  register: (username: string, password: string, confirmPassword: string) =>
    request<{ user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, confirmPassword }) }),
  login: (username: string, password: string) =>
    request<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  selectPlan: (planId: string, legFocus: LegFocus) =>
    request<{ user: User }>('/api/me/plan', { method: 'PUT', body: JSON.stringify({ planId, legFocus }) }),
  saveWorkout: (workout: WorkoutInput) =>
    request<{ workout: WorkoutRecord; user: User }>('/api/me/workouts', { method: 'POST', body: JSON.stringify(workout) }),
  workouts: () => request<{ workouts: WorkoutRecord[] }>('/api/me/workouts'),
  selectExercise: (planDayId: string, groupId: string, optionKey: string, replaceKey?: string) =>
    request<{ user: User }>('/api/me/exercise-selection', { method: 'PUT', body: JSON.stringify({ planDayId, groupId, optionKey, replaceKey }) }),
  savePlanCustomization: (customization: PlanCustomization) =>
    request<{ user: User }>('/api/me/plan-customization', { method: 'PUT', body: JSON.stringify({ customization }) }),
}

interface DatasetExercise {
  id: string
  name: string
  nameZh?: string
  category: string
  equipment: string
  target: string
  gifUrl?: string
  gif_url?: string
  attribution: string
  instruction_steps?: Record<string, string[]>
  instructions?: string[] | Record<string, string>
}

const DATASET_URL = '/data/exercises.json?v=3'
const MEDIA_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/'

const categoryLabels: Record<string, string> = {
  'upper arms': '上臂', 'upper legs': '大腿', back: '背部', waist: '腰腹', chest: '胸部',
  shoulders: '肩部', 'lower legs': '小腿', 'lower arms': '前臂', cardio: '有氧', neck: '颈部',
}
const equipmentLabels: Record<string, string> = {
  'body weight': '自重', dumbbell: '哑铃', cable: '绳索', barbell: '杠铃', 'leverage machine': '器械',
  band: '弹力带', 'smith machine': '史密斯机', kettlebell: '壶铃', weighted: '负重',
  'stability ball': '瑞士球', 'ez barbell': '曲杆', other: '其他', 'sled machine': '倒蹬机',
  'bosu ball': '波速球', 'medicine ball': '药球', 'olympic barbell': '奥林匹克杠铃',
  'resistance band': '弹力带', roller: '健腹轮', 'trap bar': '六角杠', 'upper body ergometer': '上肢功率车',
  'stationary bike': '固定单车', 'skierg machine': '滑雪机', hammer: '锤式器械',
  'elliptical machine': '椭圆机', 'stepmill machine': '登楼机', 'wheel roller': '健腹轮', rope: '绳索',
  assisted: '辅助器械', tire: '轮胎',
}
const targetLabels: Record<string, string> = {
  abs: '腹肌', biceps: '肱二头肌', triceps: '肱三头肌', chest: '胸大肌', pectorals: '胸大肌',
  'latissimus dorsi': '背阔肌', lats: '背阔肌', 'upper back': '上背', 'lower back': '下背', glutes: '臀大肌',
  quads: '股四头肌', hamstrings: '腘绳肌', calves: '小腿', shoulders: '三角肌', delts: '三角肌',
  'rear deltoids': '三角肌后束', 'front deltoids': '三角肌前束', 'side deltoids': '三角肌中束',
  forearms: '前臂', traps: '斜方肌', abductors: '髋外展肌', adductors: '髋内收肌',
  'cardiovascular system': '心肺', spine: '脊柱', 'serratus anterior': '前锯肌',
  'levator scapulae': '肩胛提肌', 'hip flexors': '髂腰肌',
}

const muscleGroupFor = (item: DatasetExercise): MuscleGroup => {
  const category = item.category.toLowerCase()
  const target = item.target.toLowerCase()
  if (category === 'cardio' || target.includes('cardiovascular')) return '有氧'
  if (target.includes('glute') || target.includes('abductor')) return '臀'
  if (category === 'chest' || target.includes('pectoral') || target.includes('serratus')) return '胸'
  if (category === 'back' || /\b(lats?|upper back|lower back|spine|traps?)\b/.test(target)) return '背'
  if (category === 'shoulders' || category === 'neck' || /delt|shoulder|scapula|neck/.test(target)) return '肩'
  if (category.includes('arms') || /biceps?|triceps?|forearms?/.test(target)) return '手臂'
  if (category.includes('legs') || /quads?|hamstrings?|calves|adductors?/.test(target)) return '腿'
  if (category === 'waist' || /abs|obliques?|hip flexors?/.test(target)) return '核心'
  return '其他'
}

const equipmentGroupFor = (equipment: string): EquipmentGroup => {
  const value = equipment.toLowerCase()
  if (value === 'body weight') return '自重'
  if (value === 'dumbbell') return '哑铃'
  if (/barbell|trap bar/.test(value)) return '杠铃'
  if (value === 'cable' || value === 'rope') return '绳索'
  if (value === 'band' || value === 'resistance band') return '弹力带'
  if (value === 'kettlebell') return '壶铃'
  if (/machine|lever|sled|ergometer|bike|elliptical|stepmill|assisted|hammer|smith/.test(value)) return '器械'
  return '其他'
}

async function fetchDataset(url: string): Promise<DatasetExercise[]> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('动作库暂时无法加载，请刷新后重试')
  return await response.json() as DatasetExercise[]
}

export async function loadExercises(): Promise<Exercise[]> {
  let data = await fetchDataset(DATASET_URL)
  // Devices that still hold a pre-localization cache would render English names.
  // Detect the thin coverage and pull a cache-busted copy instead of showing it.
  const localized = data.filter((item) => typeof item.nameZh === 'string' && item.nameZh.trim()).length
  if (localized < data.length * 0.9) data = await fetchDataset(`${DATASET_URL}&refresh=${Date.now()}`)
  return data.map((item) => {
    const media = item.gifUrl ?? item.gif_url ?? ''
    const textSteps = Array.isArray(item.instructions)
      ? item.instructions
      : item.instructions?.zh?.split(/\r?\n/).filter(Boolean) ?? []
    return {
      id: item.id,
      name: item.name,
      nameZh: item.nameZh || item.name,
      category: categoryLabels[item.category] ?? item.category,
      equipment: equipmentLabels[item.equipment] ?? item.equipment,
      target: targetLabels[item.target] ?? item.target,
      primaryGroup: muscleGroupFor(item),
      equipmentGroup: equipmentGroupFor(item.equipment),
      gifUrl: media.startsWith('http') || media.startsWith('/') ? media : media ? `${MEDIA_BASE}${media}` : '',
      attribution: item.attribution || '© Gym visual — https://gymvisual.com/',
      instructions: item.instruction_steps?.zh?.length ? item.instruction_steps.zh : textSteps,
    }
  })
}

export function matchExercise(exercises: Exercise[], query: string) {
  const normalized = query.toLowerCase()
  return exercises.find((item) => item.name.toLowerCase() === normalized)
    ?? exercises.find((item) => item.name.toLowerCase().includes(normalized))
    ?? exercises.find((item) => normalized.split(' ').every((word) => item.name.toLowerCase().includes(word)))
}
