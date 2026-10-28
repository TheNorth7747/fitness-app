import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { z } from 'zod'
import type pg from 'pg'
import { clampSets, dayOptionKeys, getPlan, getPlans, isLibraryKey, MAX_EXERCISES_PER_GROUP, orderedDays, RECOMMENDED_SETS_MIN, SETS_MAX, SETS_MIN, type LegFocus, type PlanCustomization, type TrainingPlan } from '../../shared/plans.js'
import { AVATAR_MAX_BYTES, DISPLAY_NAME_MAX, type User, type WorkoutRecord } from '../../shared/api.js'
import { hashPassword, hashToken, newSessionToken, verifyPassword } from './auth.js'

const COOKIE_NAME = 'fitday_session'
const SESSION_DAYS = Math.max(1, Math.min(90, Number(process.env.SESSION_DAYS) || 30))

interface UserRow {
  id: string
  username: string
  display_name: string | null
  avatar: string | null
  plan_id: string | null
  leg_focus: LegFocus
  cycle_position: number
  exercise_selections: Record<string, string>
  plan_customization: PlanCustomization
  plan_day_order: string[]
}

const USER_COLUMNS = 'id, username, display_name, avatar, plan_id, leg_focus, cycle_position, exercise_selections, plan_customization, plan_day_order'

const toUser = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name ?? '',
  avatar: row.avatar ?? '',
  planId: row.plan_id,
  legFocus: row.leg_focus,
  cyclePosition: row.cycle_position,
  exerciseSelections: row.exercise_selections ?? {},
  planCustomization: row.plan_customization ?? {},
  planDayOrder: Array.isArray(row.plan_day_order) ? row.plan_day_order : [],
})
const setSessionCookie = (reply: FastifyReply, token: string) => {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

const registerSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{4,20}$/, '账号需为 4–20 位字母、数字或下划线'),
  password: z.string().min(8, '密码至少需要 8 位').max(64, '密码不能超过 64 位'),
  confirmPassword: z.string().min(8, '请再次输入密码').max(64, '密码不能超过 64 位'),
  displayName: z.string().trim().max(DISPLAY_NAME_MAX, `昵称不能超过 ${DISPLAY_NAME_MAX} 个字`).optional(),
})

const profileSchema = z.object({
  displayName: z.string().trim().max(DISPLAY_NAME_MAX, `昵称不能超过 ${DISPLAY_NAME_MAX} 个字`),
  avatar: z.string().max(AVATAR_MAX_BYTES, '头像文件过大').refine(
    (value) => value === '' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
    '头像格式不支持',
  ),
})

const loginSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_]{4,20}$/, '请输入正确的账号和密码'),
  password: z.string().min(1).max(64, '请输入正确的账号和密码'),
})

const workoutSchema = z.object({
  planDayId: z.string().min(1).max(80),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  sets: z.array(z.object({
    exerciseKey: z.string().min(1).max(100),
    exerciseId: z.string().min(1).max(100),
    exerciseName: z.string().min(1).max(120),
    setNumber: z.number().int().min(1).max(30),
    reps: z.number().int().min(1).max(100),
    weightKg: z.number().min(0).max(1000),
  })).min(1).max(120),
})

export async function buildApp(pool: pg.Pool): Promise<FastifyInstance> {
  const app = Fastify({ logger: true, trustProxy: true })
  await app.register(cookie)
  await app.register(rateLimit, { max: 160, timeWindow: '1 minute' })

  async function currentUser(request: FastifyRequest): Promise<UserRow | null> {
    const token = request.cookies[COOKIE_NAME]
    if (!token) return null
    const result = await pool.query<UserRow>(
      `SELECT u.id, u.username, u.display_name, u.avatar, u.plan_id, u.leg_focus, u.cycle_position, u.exercise_selections, u.plan_customization, u.plan_day_order
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [hashToken(token)],
    )
    return result.rows[0] ?? null
  }

  async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<UserRow | null> {
    const user = await currentUser(request)
    if (!user) { await reply.code(401).send({ message: '登录状态已失效，请重新登录' }); return null }
    return user
  }

  app.get('/api/health', async () => {
    await pool.query('SELECT 1')
    return { ok: true }
  })

  app.get('/api/plans', async () => ({ plans: getPlans() }))

  app.get('/api/auth/me', async (request) => {
    const user = await currentUser(request)
    return { user: user ? toUser(user) : null }
  })

  app.post('/api/auth/register', { config: { rateLimit: { max: 12, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? '提交内容不完整' })
    const { username, password, confirmPassword } = parsed.data
    const displayName = (parsed.data.displayName ?? '').trim().slice(0, DISPLAY_NAME_MAX)
    if (confirmPassword !== password) return reply.code(400).send({ message: '两次输入的密码不一致' })
    if (password.length < 8) return reply.code(400).send({ message: '密码至少需要 8 位' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const id = randomUUID()
      const passwordHash = await hashPassword(password)
      const inserted = await client.query<UserRow>(
        `INSERT INTO users (id, username, username_normalized, password_hash, display_name)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${USER_COLUMNS}`,
        [id, username, username.toLowerCase(), passwordHash, displayName || null],
      )
      const token = newSessionToken()
      await client.query(
        'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + ($3 || \' days\')::interval)',
        [hashToken(token), id, String(SESSION_DAYS)],
      )
      await client.query('COMMIT')
      setSessionCookie(reply, token)
      return reply.code(201).send({ user: toUser(inserted.rows[0]) })
    } catch (error) {
      await client.query('ROLLBACK')
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ message: '这个账号已被使用，请换一个' })
      throw error
    } finally { client.release() }
  })

  app.post('/api/auth/login', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: '请输入正确的账号和密码' })
    const result = await pool.query<UserRow & { password_hash: string }>(
      `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE username_normalized = $1`,
      [parsed.data.username.toLowerCase()],
    )
    const row = result.rows[0]
    if (!row || !(await verifyPassword(parsed.data.password, row.password_hash))) return reply.code(401).send({ message: '账号或密码错误' })
    const token = newSessionToken()
    await pool.query(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + ($3 || \' days\')::interval)',
      [hashToken(token), row.id, String(SESSION_DAYS)],
    )
    setSessionCookie(reply, token)
    return { user: toUser(row) }
  })

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[COOKIE_NAME]
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
    reply.clearCookie(COOKIE_NAME, { path: '/' })
    return reply.code(204).send()
  })

  const customizationSchema = z.record(z.string(), z.record(z.string(), z.object({
    exerciseIds: z.array(z.string().min(1).max(40)).min(1).max(MAX_EXERCISES_PER_GROUP),
    sets: z.record(z.string(), z.number().int().min(0).max(99)),
  })))

  /** 只保留属于当前计划的训练日与动作组；动作去重，组数夹紧 */
  function sanitizeCustomization(raw: PlanCustomization | undefined, planId: string, legFocus: LegFocus): PlanCustomization {
    const plan = getPlan(planId, legFocus)
    const clean: PlanCustomization = {}
    for (const day of plan.days) {
      const groups = raw?.[day.id]
      if (!groups) continue
      for (const group of day.groups) {
        const custom = groups[group.id]
        if (!custom?.exerciseIds?.length) continue
        const ids = Array.from(new Set(custom.exerciseIds)).slice(0, MAX_EXERCISES_PER_GROUP)
        const sets: Record<string, number> = {}
        for (const id of ids) sets[id] = clampSets(custom.sets?.[id] ?? RECOMMENDED_SETS_MIN)
        clean[day.id] = { ...(clean[day.id] ?? {}), [group.id]: { exerciseIds: ids, sets } }
      }
    }
    return clean
  }

  /** 训练日顺序只接受当前计划训练日的一个排列 */
  function sanitizeDayOrder(raw: unknown, plan: TrainingPlan): string[] {
    if (!Array.isArray(raw)) return []
    const ids = raw.filter((item): item is string => typeof item === 'string')
    const allowed = new Set(plan.days.map((day) => day.id))
    const unique = Array.from(new Set(ids)).filter((id) => allowed.has(id))
    return unique.length === plan.days.length ? unique : []
  }

  app.put('/api/me/plan', async (request, reply) => {
    const user = await requireUser(request, reply)
    if (!user) return
    const parsed = z.object({
      planId: z.string(),
      legFocus: z.enum(['quads', 'glutes']),
      customization: customizationSchema.optional(),
      dayOrder: z.array(z.string().min(1).max(80)).optional(),
    }).safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: '请选择有效的训练计划' })
    const plan = getPlans(parsed.data.legFocus).find((item) => item.id === parsed.data.planId)
    if (!plan) return reply.code(400).send({ message: '训练计划不存在' })
    const customization = sanitizeCustomization(parsed.data.customization, plan.id, parsed.data.legFocus)
    const updated = await pool.query<UserRow>(
      `UPDATE users SET plan_id = $1, leg_focus = $2, cycle_position = 0, exercise_selections = '{}'::jsonb, plan_customization = $3::jsonb, plan_day_order = $4::jsonb WHERE id = $5
       RETURNING ${USER_COLUMNS}`,
      [plan.id, parsed.data.legFocus, JSON.stringify(customization), JSON.stringify(sanitizeDayOrder(parsed.data.dayOrder, plan)), user.id],
    )
    return { user: toUser(updated.rows[0]) }
  })

  app.put('/api/me/plan-customization', async (request, reply) => {
    const user = await requireUser(request, reply)
    if (!user) return
    if (!user.plan_id) return reply.code(400).send({ message: '请先选择训练计划' })
    const parsed = z.object({ customization: customizationSchema }).safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: `自定义内容格式不正确，组数需在 ${SETS_MIN}–${SETS_MAX} 之间` })
    const clean = sanitizeCustomization(parsed.data.customization, user.plan_id, user.leg_focus)
    const updated = await pool.query<UserRow>(
      `UPDATE users SET plan_customization = $1::jsonb WHERE id = $2
       RETURNING ${USER_COLUMNS}`,
      [JSON.stringify(clean), user.id],
    )
    return { user: toUser(updated.rows[0]) }
  })

  app.put('/api/me/plan-day-order', async (request, reply) => {
    const user = await requireUser(request, reply)
    if (!user) return
    if (!user.plan_id) return reply.code(400).send({ message: '请先选择训练计划' })
    const parsed = z.object({ dayOrder: z.array(z.string().min(1).max(80)) }).safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: '训练日顺序格式不正确' })
    const plan = getPlan(user.plan_id, user.leg_focus)
    const order = sanitizeDayOrder(parsed.data.dayOrder, plan)
    const updated = await pool.query<UserRow>(
      `UPDATE users SET plan_day_order = $1::jsonb WHERE id = $2
       RETURNING ${USER_COLUMNS}`,
      [JSON.stringify(order), user.id],
    )
    return { user: toUser(updated.rows[0]) }
  })

  app.put('/api/me/profile', async (request, reply) => {
    const user = await requireUser(request, reply)
    if (!user) return
    const parsed = profileSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues[0]?.message ?? '资料内容不正确' })
    const updated = await pool.query<UserRow>(
      `UPDATE users SET display_name = $1, avatar = $2 WHERE id = $3
       RETURNING ${USER_COLUMNS}`,
      [parsed.data.displayName.trim() || null, parsed.data.avatar || null, user.id],
    )
    return { user: toUser(updated.rows[0]) }
  })

  app.get('/api/me/workouts', async (request, reply) => {
    const user = await requireUser(request, reply)
    if (!user) return
    const result = await pool.query<{
      id: string; plan_id: string; plan_day_id: string; started_at: Date; completed_at: Date;
      exercise_key: string; exercise_id: string; exercise_name: string; set_number: number; reps: string; weight_kg: string
    }>(
      `SELECT w.id, w.plan_id, w.plan_day_id, w.started_at, w.completed_at,
              s.exercise_key, s.exercise_id, s.exercise_name, s.set_number, s.reps, s.weight_kg
       FROM workouts w JOIN workout_sets s ON s.workout_id = w.id
       WHERE w.user_id = $1 ORDER BY w.completed_at DESC, s.set_number ASC LIMIT 3000`,
      [user.id],
    )
    const grouped = new Map<string, WorkoutRecord>()
    for (const row of result.rows) {
      if (!grouped.has(row.id)) {
        const plan = getPlan(row.plan_id, user.leg_focus)
        const day = plan.days.find((item) => item.id === row.plan_day_id)
        grouped.set(row.id, {
          id: row.id, planDayId: row.plan_day_id, planName: plan.name, planDayName: day?.name ?? '训练记录',
          startedAt: row.started_at.toISOString(), completedAt: row.completed_at.toISOString(), sets: [],
        })
      }
      grouped.get(row.id)!.sets.push({
        exerciseKey: row.exercise_key, exerciseId: row.exercise_id, exerciseName: row.exercise_name,
        setNumber: row.set_number, reps: Number(row.reps), weightKg: Number(row.weight_kg),
      })
    }
    return { workouts: Array.from(grouped.values()) }
  })

  app.post('/api/me/workouts', async (request, reply) => {
    const user = await requireUser(request, reply)
    if (!user) return
    const parsed = workoutSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: '训练数据不完整或格式不正确' })
    if (!user.plan_id) return reply.code(400).send({ message: '请先选择训练计划' })
    const plan = getPlan(user.plan_id, user.leg_focus)
    const day = orderedDays(plan, user.plan_day_order).find((item) => item.id === parsed.data.planDayId)
    if (!day) return reply.code(400).send({ message: '训练日与当前计划不匹配' })
    // 计划内动作键，或从动作库自选的 lib:<id> 键
    const allowedKeys = dayOptionKeys(day)
    if (parsed.data.sets.some((set) => !allowedKeys.has(set.exerciseKey) && !isLibraryKey(set.exerciseKey))) {
      return reply.code(400).send({ message: '训练动作与当前计划不匹配' })
    }
    if (new Date(parsed.data.completedAt).getTime() < new Date(parsed.data.startedAt).getTime()) return reply.code(400).send({ message: '训练时间不正确' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const workoutId = randomUUID()
      await client.query(
        'INSERT INTO workouts (id, user_id, plan_id, plan_day_id, started_at, completed_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [workoutId, user.id, plan.id, day.id, parsed.data.startedAt, parsed.data.completedAt],
      )
      for (const set of parsed.data.sets) {
        await client.query(
          `INSERT INTO workout_sets (id, workout_id, exercise_key, exercise_id, exercise_name, set_number, reps, weight_kg)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [randomUUID(), workoutId, set.exerciseKey, set.exerciseId, set.exerciseName, set.setNumber, set.reps, set.weightKg],
        )
      }
      const nextPosition = (user.cycle_position + 1) % orderedDays(plan, user.plan_day_order).length
      const updated = await client.query<UserRow>(
        `UPDATE users SET cycle_position = $1 WHERE id = $2
         RETURNING id, username, plan_id, leg_focus, cycle_position, exercise_selections, plan_customization`,
        [nextPosition, user.id],
      )
      await client.query('COMMIT')
      const record: WorkoutRecord = {
        id: workoutId, planName: plan.name, planDayName: day.name, planDayId: day.id,
        startedAt: parsed.data.startedAt, completedAt: parsed.data.completedAt, sets: parsed.data.sets,
      }
      return reply.code(201).send({ workout: record, user: toUser(updated.rows[0]) })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  })

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)
    if ((error as { statusCode?: number }).statusCode === 429) return reply.code(429).send({ message: '操作过于频繁，请稍后再试' })
    if (((error as { statusCode?: number }).statusCode ?? 500) < 500) return reply.code(400).send({ message: '请求内容格式不正确' })
    return reply.code(500).send({ message: '服务器暂时无法处理请求' })
  })

  return app
}
