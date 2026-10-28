import { buildApp } from './app.js'
import { createPool, migrate } from './db.js'

const port = Number(process.env.PORT) || 8787
const pool = createPool()

try {
  await migrate(pool)
  const app = await buildApp(pool)
  await app.listen({ port, host: '0.0.0.0' })
} catch (error) {
  console.error('Fitday server failed to start:', error)
  await pool.end()
  process.exit(1)
}
