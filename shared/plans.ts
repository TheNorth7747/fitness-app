export type LegFocus = 'quads' | 'glutes'

export interface ExerciseOption {
  key: string
  nameZh: string
  query: string
}

export interface WorkoutGroup {
  id: string
  name: string
  selectMin: number
  selectMax: number
  totalSets: number
  repRange: string
  restSeconds: number
  options: ExerciseOption[]
}

export interface PlanDay {
  id: string
  name: string
  subtitle: string
  groups: WorkoutGroup[]
}

export interface TrainingPlan {
  id: string
  name: string
  shortName: string
  location: 'gym' | 'home'
  level: string
  description: string
  days: PlanDay[]
}

const ex = (key: string, nameZh: string, query: string): ExerciseOption => ({ key, nameZh, query })
const group = (
  id: string,
  name: string,
  totalSets: number,
  options: ExerciseOption[],
  selectMin = 1,
  selectMax = 2,
  repRange = '6–12',
  restSeconds = 150,
): WorkoutGroup => ({ id, name, selectMin, selectMax, totalSets, repRange, restSeconds, options })

const backGroups = (prefix: string, withBiceps = true) => [
  group(`${prefix}-pulldown`, '垂直拉', 8, [
    ex('lat-pulldown', '高位下拉', 'cable pulldown'),
    ex('pull-up', '器械辅助引体', 'assisted pull-up'),
    ex('assisted-pull-up', '弹力带辅助引体', 'band assisted pull-up'),
  ]),
  group(`${prefix}-row`, '水平拉', 8, [
    ex('cable-row', '坐姿绳索划船', 'cable low seated row'),
    ex('barbell-row', '杠铃俯身划船', 'barbell bent over row'),
    ex('dumbbell-row', '单臂哑铃划船', 'dumbbell bent over row'),
  ]),
  ...(withBiceps ? [group(`${prefix}-biceps`, '肱二头', 8, [
    ex('dumbbell-curl', '哑铃弯举', 'dumbbell biceps curl'),
    ex('barbell-curl', '杠铃弯举', 'barbell curl'),
    ex('hammer-curl', '锤式弯举', 'dumbbell hammer curl'),
  ], 1, 2, '8–12', 120)] : []),
]

const chestGroups = (prefix: string, withTriceps = true) => [
  group(`${prefix}-chest`, '胸部推', 10, [
    ex('bench-press', '杠铃卧推', 'barbell bench press'),
    ex('dumbbell-bench', '哑铃卧推', 'dumbbell bench press'),
    ex('machine-chest-press', '器械推胸', 'lever chest press'),
  ], 2, 3),
  group(`${prefix}-shoulder`, '肩前中束', 5, [
    ex('shoulder-press', '哑铃推举', 'dumbbell seated shoulder press'),
    ex('lateral-raise', '哑铃侧平举', 'dumbbell lateral raise'),
    ex('front-raise', '哑铃前平举', 'dumbbell front raise'),
  ], 1, 1, '8–12', 120),
  ...(withTriceps ? [group(`${prefix}-triceps`, '肱三头', 5, [
    ex('triceps-pushdown', '绳索下压', 'cable pushdown'),
    ex('overhead-triceps', '颈后臂屈伸', 'barbell seated overhead triceps extension'),
    ex('close-grip-bench', '窄距卧推', 'barbell close-grip bench press'),
  ], 1, 1, '8–12', 120)] : []),
]

const legGroups = (prefix: string, focus: LegFocus = 'quads', includeAbs = true) => {
  const primary = focus === 'glutes'
    ? group(`${prefix}-primary`, '臀大肌', 8, [
      ex('hip-thrust', '杠铃臀桥', 'barbell glute bridge'),
      ex('glute-bridge', '臀桥', 'low glute bridge on floor'),
      ex('bulgarian-split', '哑铃单腿分腿蹲', 'dumbbell single leg split squat'),
    ])
    : group(`${prefix}-primary`, '股四头肌', 8, [
      ex('squat', '杠铃深蹲', 'barbell full squat'),
      ex('leg-press', '倒蹬', 'sled 45° leg press (side pov)'),
      ex('leg-extension', '腿屈伸', 'lever leg extension'),
    ])
  return [
    primary,
    group(`${prefix}-posterior`, '腘绳肌与后侧链', 8, [
      ex('romanian-deadlift', '罗马尼亚硬拉', 'barbell romanian deadlift'),
      ex('leg-curl', '腿弯举', 'lever lying leg curl'),
      ex('deadlift', '传统硬拉', 'barbell deadlift'),
    ]),
    ...(includeAbs ? [group(`${prefix}-abs`, '腹部', 8, [
      ex('plank', '平板支撑', 'weighted front plank'),
      ex('hanging-leg-raise', '悬垂举腿', 'hanging leg raise'),
      ex('crunch', '卷腹', 'crunch floor'),
    ], 1, 2, '8–15', 90)] : []),
  ]
}

const gymThreeDays = (focus: LegFocus = 'quads'): PlanDay[] => [
  { id: 'g3-back', name: '背 · 肩后束 · 二头', subtitle: '拉力训练日', groups: [
    ...backGroups('g3-back'),
    group('g3-rear-delt', '肩后束', 6, [ex('rear-delt-fly', '俯身反向飞鸟', 'dumbbell reverse fly'), ex('face-pull', '绳索面拉', 'cable rear delt row (with rope)')], 1, 1, '10–15', 120),
  ] },
  { id: 'g3-chest', name: '胸 · 肩 · 三头', subtitle: '推力训练日', groups: chestGroups('g3-chest') },
  { id: 'g3-legs', name: '腿臀 · 腹', subtitle: focus === 'glutes' ? '本轮侧重臀大肌' : '本轮侧重股四头肌', groups: legGroups('g3-legs', focus) },
]

export const getPlans = (focus: LegFocus = 'quads'): TrainingPlan[] => [
  {
    id: 'gym-three', name: '健身房三分化', shortName: '三分化', location: 'gym', level: '掌握基础动作后',
    description: '推拉腿循环，每周建议完成 3–5 次训练，均衡覆盖全身。', days: gymThreeDays(focus),
  },
  {
    id: 'gym-four-shoulders', name: '四分化 · 肩单练', shortName: '肩部侧重', location: 'gym', level: '有一定训练经验',
    description: '将肩部单独安排一天，提高前、中、后束训练量。', days: [
      { id: 'g4s-back', name: '背 · 二头', subtitle: 'Day 1', groups: backGroups('g4s-back') },
      { id: 'g4s-chest', name: '胸 · 三头', subtitle: 'Day 2', groups: chestGroups('g4s-chest') },
      { id: 'g4s-legs', name: '腿臀 · 腹', subtitle: 'Day 3', groups: legGroups('g4s-legs', focus) },
      { id: 'g4s-shoulders', name: '肩部专项', subtitle: 'Day 4', groups: [
        group('g4s-front', '肩前束', 8, [ex('shoulder-press', '哑铃推举', 'dumbbell seated shoulder press'), ex('front-raise', '哑铃前平举', 'dumbbell front raise')], 2, 2, '8–12', 120),
        group('g4s-side', '肩中束', 8, [ex('lateral-raise', '哑铃侧平举', 'dumbbell lateral raise'), ex('upright-row', '杠铃提拉', 'barbell upright row')], 1, 2, '10–15', 120),
        group('g4s-rear', '肩后束', 8, [ex('rear-delt-fly', '俯身反向飞鸟', 'dumbbell reverse fly'), ex('face-pull', '绳索面拉', 'cable rear delt row (with rope)')], 1, 2, '10–15', 120),
      ] },
    ],
  },
  {
    id: 'gym-four-arms', name: '四分化 · 手臂单练', shortName: '手臂侧重', location: 'gym', level: '有一定训练经验',
    description: '将大臂与腹部单独安排一天，强化手臂训练。', days: [
      { id: 'g4a-back', name: '背 · 肩后束', subtitle: 'Day 1', groups: [...backGroups('g4a-back', false), group('g4a-rear', '肩后束', 6, [ex('rear-delt-fly', '俯身反向飞鸟', 'dumbbell reverse fly'), ex('face-pull', '绳索面拉', 'cable rear delt row (with rope)')])] },
      { id: 'g4a-chest', name: '胸 · 肩', subtitle: 'Day 2', groups: chestGroups('g4a-chest', false) },
      { id: 'g4a-legs', name: '腿臀', subtitle: 'Day 3', groups: legGroups('g4a-legs', focus, false) },
      { id: 'g4a-arms', name: '大臂 · 腹', subtitle: 'Day 4', groups: [
        group('g4a-biceps', '肱二头', 8, [ex('dumbbell-curl', '哑铃弯举', 'dumbbell biceps curl'), ex('barbell-curl', '杠铃弯举', 'barbell curl'), ex('hammer-curl', '锤式弯举', 'dumbbell hammer curl')], 2, 2, '8–12', 120),
        group('g4a-triceps', '肱三头', 8, [ex('triceps-pushdown', '绳索下压', 'cable pushdown'), ex('overhead-triceps', '颈后臂屈伸', 'barbell seated overhead triceps extension')], 2, 2, '8–12', 120),
        group('g4a-abs', '腹部', 8, [ex('plank', '平板支撑', 'weighted front plank'), ex('crunch', '卷腹', 'crunch floor')], 1, 2, '8–15', 90),
      ] },
    ],
  },
  {
    id: 'home-three', name: '居家三分化', shortName: '居家训练', location: 'home', level: '不建议零基础直接开始',
    description: '使用哑铃、弹力带和卧推凳完成三分化循环。', days: [
      { id: 'h3-back', name: '背 · 二头', subtitle: '居家拉力日', groups: [
        group('h3-pulldown', '垂直拉', 8, [ex('band-assisted-pull', '弹力带辅助引体', 'band assisted pull-up'), ex('band-pulldown', '弹力带下拉', 'band close-grip pulldown')]),
        group('h3-row', '水平拉', 8, [ex('dumbbell-row', '单臂哑铃划船', 'dumbbell bent over row'), ex('band-row', '弹力带划船', 'resistance band seated straight back row')]),
        group('h3-biceps', '肱二头', 8, [ex('dumbbell-curl', '哑铃弯举', 'dumbbell biceps curl'), ex('band-curl', '弹力带弯举', 'resistance band seated biceps curl')], 1, 2, '8–12', 120),
      ] },
      { id: 'h3-chest', name: '胸 · 肩 · 三头', subtitle: '居家推力日', groups: [
        group('h3-chest-main', '胸部推', 10, [ex('push-up', '俯卧撑', 'push-up'), ex('dumbbell-bench', '哑铃卧推', 'dumbbell bench press'), ex('band-press', '弹力带单臂推胸', 'band one arm twisting chest press')], 2, 3, '8–12'),
        group('h3-shoulders', '肩部', 5, [ex('shoulder-press', '哑铃推举', 'dumbbell seated shoulder press'), ex('lateral-raise', '哑铃侧平举', 'dumbbell lateral raise')], 1, 1, '8–12', 120),
        group('h3-triceps', '肱三头', 5, [ex('band-triceps', '弹力带臂屈伸', 'band side triceps extension'), ex('bench-dip', '凳上臂屈伸', 'bench dip (knees bent)')], 1, 1, '8–12', 120),
      ] },
      { id: 'h3-legs', name: '腿臀 · 腹', subtitle: '居家下肢日', groups: [
        group('h3-primary', focus === 'glutes' ? '臀大肌' : '股四头肌', 8, focus === 'glutes'
          ? [ex('glute-bridge', '臀桥', 'low glute bridge on floor'), ex('band-hip-abduction', '弹力带髋外展', 'resistance band seated hip abduction')]
          : [ex('goblet-squat', '高脚杯深蹲', 'dumbbell goblet squat'), ex('walking-lunge', '哑铃箭步蹲', 'walking lunge')]),
        group('h3-posterior', '后侧链', 8, [ex('dumbbell-rdl', '哑铃罗马尼亚硬拉', 'dumbbell stiff leg deadlift'), ex('band-rdl', '弹力带硬拉', 'band stiff leg deadlift')]),
        group('h3-abs', '腹部', 8, [ex('plank', '平板支撑', 'weighted front plank'), ex('crunch', '卷腹', 'crunch floor')], 1, 2, '8–15', 90),
      ] },
    ],
  },
]

export const getPlan = (planId: string, focus: LegFocus = 'quads') =>
  getPlans(focus).find((plan) => plan.id === planId) ?? getPlans(focus)[0]

export const selectedOptions = (group: WorkoutGroup, selections: Record<string, string> = {}) => {
  const chosen = group.options.find((option) => option.key === selections[group.id])
  const rest = group.options.filter((option) => option.key !== chosen?.key)
  return [chosen, ...rest].filter((option) => option !== undefined).slice(0, group.selectMin) as ExerciseOption[]
}

export const distributeSets = (total: number, count: number) => {
  const base = Math.floor(total / count)
  const remainder = total % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}
