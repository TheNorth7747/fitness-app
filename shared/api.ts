import type { LegFocus } from './plans.js'

export interface User {
  id: string
  username: string
  planId: string | null
  legFocus: LegFocus
  cyclePosition: number
  exerciseSelections: Record<string, string>
}

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
