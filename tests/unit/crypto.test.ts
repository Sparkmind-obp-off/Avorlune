import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../server/lib/crypto'
import { signProjectToken, verifyProjectToken } from '../../server/lib/projectToken'

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const h = await hashPassword('s3cret-passphrase', 10_000)
    expect(h.startsWith('pbkdf2$10000$')).toBe(true)
    expect(await verifyPassword('s3cret-passphrase', h)).toBe(true)
    expect(await verifyPassword('wrong', h)).toBe(false)
  })
  it('rejects malformed hashes and excessive iteration counts', async () => {
    expect(await verifyPassword('x', 'plain')).toBe(false)
    expect(await verifyPassword('x', 'pbkdf2$999999999$aa$bb')).toBe(false)
  })
})

describe('project access token', () => {
  const secret = 'k'.repeat(64)
  it('round-trips claims', async () => {
    const { token } = await signProjectToken(secret, 'p-1', 1)
    expect(await verifyProjectToken(secret, token)).toMatchObject({ projectId: 'p-1', version: 1 })
  })
  it('rejects expired tokens', async () => {
    const now = Math.floor(Date.now() / 1000)
    const { token } = await signProjectToken(secret, 'p-1', 1, 60, now - 120)
    expect(await verifyProjectToken(secret, token, now)).toBeNull()
  })
  it('rejects tampered tokens and wrong secrets', async () => {
    const { token } = await signProjectToken(secret, 'p-1', 1)
    const [p, s] = token.split('.')
    const forged = Buffer.from(Buffer.from(p, 'base64url').toString().replace('p-1', 'p-2')).toString('base64url')
    expect(await verifyProjectToken(secret, `${forged}.${s}`)).toBeNull()
    expect(await verifyProjectToken('other'.repeat(13), token)).toBeNull()
    expect(await verifyProjectToken(secret, 'garbage')).toBeNull()
  })
})
