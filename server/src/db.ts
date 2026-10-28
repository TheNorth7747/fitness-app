import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg

export const createPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export async function migrate(pool: pg.Pool) {
  const schemaPath = fileURLToPath(new URL('../../database/schema.sql', import.meta.url))
  const schema = await readFile(schemaPath, 'utf8')
  await pool.query(schema)
}
