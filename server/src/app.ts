import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { z } from 'zod'
import type pg from 'pg'
import { clampSets, dayOptionKeys, getPlan, getPlans, RECOMMENDED_SETS_MIN, recommendedGroupPlan, SETS_MAX, SETS_MIN, type LegFocus, type PlanCustomization } from '../../shared/plans.js'
import type { User, WorkoutRecord } from '../../shared/api.js'
import { hashPassword, hashToken, newSessionToken, verifyPassword } from './auth.js'

const COOKIE_NAME = 'fitday_session'
const SESSION_DAYS = Math.max(1, Math.min(90, Number(process.env.SESSION_DAYS) || 30))

interface UserRow {
  id: string
  username: string
  plan_id: string | null
  leg_focus: LegFocus
  cycle_position: number
  exercise_selections: Record<string, string>
  plan_customization: PlanCustomization
}

const toUser = (row: UserRow): User => ({ id: row.id, username: row.username, planId: row.plan_id, legFocus: row.leg_focus, cyclePosition: row.cycle_position, exerciseSelections: row.exercise_selections ?? {}, planCustomization: row.plan_customization ?? {} })
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
      `SELECT u.id, u.username, u.plan_id, u.leg_focus, u.cycle_position, u.exercise_selections, u.plan_customization
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
    if (confirmPassword !== password) return reply.code(400).send({ message: '两次输入的密码不一致' })
    if (password.length < 8) return reply.code(400).send({ message: '密码至少需要 8 位' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const id = randomUUID()
      const passwordHash = await hashPassword(password)
      const inserted = await client.query<UserRow>(
        `INSERT INTO users (id, username, username_normalized, password_hash)
         VALUES ($1, $2, $3, $4) RETURNING id, username, plan_id, leg_focus, cycle_position, exercise_selections, plan_customization`,
        [id, username, username.toLowerCase(), passwordHash],
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
    const result = await pool.query<{ id: string; username: string; password_hash: string; plan_id: string | null; leg_focus: LegFocus; cycle_position: number; exercise_selections: Record<string, string>; plan_customization: PlanCustomization }>(
      'SELECT id, username, password_hash, plan_id, leg_focus, cycle_position, exercise_selections, plan_customization FROM users WHERE username_normalized = $1',
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

  app.put('/api/me/plan', async (request, reply) => {
    const user = await requireUser(request, reply)
    if (!user) return
    const parsed = z.object({ planId: z.string(), legFocus: z.enum(['quads', 'glutes']) }).safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: '请选择有效的训练计划' })
    const plan = getPlans(parsed.data.legFocus).find((item) => item.id === parsed.data.planId)
    if (!plan) return reply.code(400).send({ message: '训练计划不存在' })
    const updated = await pool.query<UserRow>(
      `UPDATE users SET plan_id = $1, leg_focus = $2, cycle_position = 0, exercise_selections = '{}'::jsonb, plan_customization = '{}'::jsonb WHERE id = $3
       RETURNING id, username, plan_id, leg_focus, cycle_position, exercise_selections, plan_customization`,
      [plan.id, parsed.data.legFocus, user.id],
    )
    return { user: toUser(updated.rows[0]) }
  })

  app.put('/api/me/exercise-selection', async (request, reply) => {
    const user = await requireUser(request, reply)
    if (!user) return
    const parsed = z.object({
      planDayId: z.string().min(1).max(80),
      groupId: z.string().min(1).max(80),
      optionKey: z.string().min(1).max(80),
      replaceKey: z.string().min(1).max(80).optional(),
    }).safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: '动作选择数据不正确' })
    if (!user.plan_id) return reply.code(400).send({ message: '请先选择训练计划' })
    const plan = getPlan(user.plan_id, user.leg_focus)
    const day = plan.days.find((item) => item.id === parsed.data.planDayId)
    const group = day?.groups.find((item) => item.id === parsed.data.groupId)
    if (!day || !group || !group.options.some((option) => option.key === parsed.data.optionKey)) {
      return reply.code(400).send({ message: '该动作不属于当前训练日' })
    }
    const recommended = recommendedGroupPlan(group, user.exercise_selections)
    const existing = user.plan_customization?.[day.id]?.[group.id]
    const base = existing
      ? existing.optionKeys.map((key) => ({ key, sets: existing.sets?.[key] ?? 0 }))
      : recommended.map((item) => ({ key: item.option.key, sets: item.sets }))
    const baseKeys = base.map((item) => item.key)
    const replaceIndex = parsed.data.replaceKey ? baseKeys.indexOf(parsed.data.replaceKey) : -1
    const nextKeys = [...baseKeys]
    if (replaceIndex >= 0) nextKeys[replaceIndex] = parsed.data.optionKey
    else nextKeys.unshift(parsed.data.optionKey)
    const deduped = Array.from(new Set(nextKeys))
    const nextSets: Record<string, number> = {}
    for (const item of base) nextSets[item.key] = item.sets
    if (!nextSets[parsed.data.optionKey]) {
      nextSets[parsed.data.optionKey] = recommended.find((item) => item.option.key === parsed.data.optionKey)?.sets ?? RECOMMENDED_SETS_MIN
    }
    const cleanedSets: Record<string, number> = {}
    for (const key of deduped) cleanedSets[key] = clampSets(nextSets[key] ?? RECOMMENDED_SETS_MIN)
    const nextCustomization: PlanCustomization = {
      ...(user.plan_customization ?? {}),
      [day.id]: {
        ...(user.plan_customization?.[day.id] ?? {}),
        [group.id]: { optionKeys: deduped, sets: cleanedSets },
      },
    }
    const updated = await pool.query<UserRow>(
      `UPDATE users SET exercise_selections = exercise_selections || $1::jsonb, plan_customization = $2::jsonb WHERE id = $3
       RETURNING id, username, plan_id, leg_focus, cycle_position, exercise_selections, plan_customization`,
      [JSON.stringify({ [group.id]: parsed.data.optionKey }), JSON.stringify(nextCustomization), user.id],
    )
    return { user: toUser(updated.rows[0]) }
  })

  app.put('/api/me/plan-customization', async (request, reply) => {
    const user = await requireUser(request, reply)
    if (!user) return
    if (!user.plan_id) return reply.code(400).send({ message: '请先选择训练计划' })
    const parsed = z.object({
      customization: z.record(z.string(), z.record(z.string(), z.object({
        optionKeys: z.array(z.string().min(1).max(80)).min(1).max(6),
        sets: z.record(z.string(), z.number().int().min(0).max(99)),
      }))),
    }).safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: `自定义内容格式不正确，组数需在 ${SETS_MIN}–${SETS_MAX} 之间` })

    const plan = getPlan(user.plan_id, user.leg_focus)
    const clean: PlanCustomization = {}
    for (const [dayId, groups] of Object.entries(parsed.data.customization)) {
      const day = plan.days.find((item) => item.id === dayId)
      if (!day) continue
      for (const [groupId, custom] of Object.entries(groups)) {
        const group = day.groups.find((item) => item.id === groupId)
        if (!group) continue
        const allowed = new Set(group.options.map((option) => option.key))
        const keys = Array.from(new Set(custom.optionKeys)).filter((key) => allowed.has(key))
        if (!keys.length) continue
        const sets: Record<string, number> = {}
        for (const key of keys) sets[key] = clampSets(custom.sets[key] ?? RECOMMENDED_SETS_MIN)
        clean[dayId] = { ...(clean[dayId] ?? {}), [groupId]: { optionKeys: keys, sets } }
      }
    }
    const updated = await pool.query<UserRow>(
      `UPDATE users SET plan_customization = $1::jsonb WHERE id = $2
       RETURNING id, username, plan_id, leg_focus, cycle_position, exercise_selections, plan_customization`,
      [JSON.stringify(clean), user.id],
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
    const day = plan.days.find((item) => item.id === parsed.data.planDayId)
    if (!day) return reply.code(400).send({ message: '训练日与当前计划不匹配' })
    const allowedKeys = dayOptionKeys(day)
    if (parsed.data.sets.some((set) => !allowedKeys.has(set.exerciseKey))) {
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
      const nextPosition = (user.cycle_position + 1) % plan.days.length
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
