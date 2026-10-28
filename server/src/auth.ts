import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = stored.split('$')
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false
  const storedHash = Buffer.from(hashHex, 'hex')
  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), storedHash.length) as Buffer
  return storedHash.length === derived.length && timingSafeEqual(storedHash, derived)
}

export const newSessionToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
