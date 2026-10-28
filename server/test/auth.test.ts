import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassword, hashToken, newSessionToken, verifyPassword } from '../src/auth.js'

test('password hash is salted and verifiable', async () => {
  const first = await hashPassword('correct horse battery staple')
  const second = await hashPassword('correct horse battery staple')
  assert.notEqual(first, second)
  assert.equal(await verifyPassword('correct horse battery staple', first), true)
  assert.equal(await verifyPassword('wrong password', first), false)
})

test('session tokens are random and only their hash is stable', () => {
  const first = newSessionToken()
  const second = newSessionToken()
  assert.notEqual(first, second)
  assert.equal(hashToken(first), hashToken(first))
  assert.notEqual(hashToken(first), hashToken(second))
  assert.equal(hashToken(first).length, 64)
})
