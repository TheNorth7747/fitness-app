import type { LegFocus, PlanCustomization } from './plans.js'

export interface User {
  id: string
  username: string
  /** 昵称，用于问候与头像旁展示；未设置时回退账号名 */
  displayName: string
  /** 头像 data URL，为空时显示首字母占位 */
  avatar: string
  planId: string | null
  legFocus: LegFocus
  cyclePosition: number
  exerciseSelections: Record<string, string>
  planCustomization: PlanCustomization
  /** 训练日顺序（planDayId 列表）；为空表示使用计划默认顺序 */
  planDayOrder: string[]
}

export const DISPLAY_NAME_MAX = 24
export const AVATAR_MAX_BYTES = 300_000

/** 展示名优先用昵称，未设置时回退账号名 */
export const displayNameOf = (user: Pick<User, 'displayName' | 'username'>) =>
  user.displayName?.trim() || user.username

export const MUSCLE_GROUPS = ['胸', '背', '肩', '手臂', '腿', '臀', '核心', '有氧', '其他'] as const
export type MuscleGroup = typeof MUSCLE_GROUPS[number]

export const EQUIPMENT_GROUPS = ['自重', '哑铃', '杠铃', '绳索', '器械', '弹力带', '壶铃', '其他'] as const
export type EquipmentGroup = typeof EQUIPMENT_GROUPS[number]

export interface Exercise {
  id: string
  name: string
  nameZh: string
  category: string
  equipment: string
  target: string
  primaryGroup: MuscleGroup
  equipmentGroup: EquipmentGroup
  gifUrl: string
  attribution: string
  instructions: string[]
}

export interface WorkoutSetInput {
  exerciseKey: string
  exerciseId: string
  exerciseName: string
  setNumber: number
  reps: number
  weightKg: number
}

export interface WorkoutInput {
  planDayId: string
  startedAt: string
  completedAt: string
  sets: WorkoutSetInput[]
}

export interface WorkoutRecord extends WorkoutInput {
  id: string
  planName: string
  planDayName: string
}

/** 历史记录纠错只允许改时间与组次，训练所属计划/训练日保持不变 */
export type WorkoutUpdateInput = Omit<WorkoutInput, 'planDayId'>
