// Usage: node scripts/hash-password.mjs '<password>'  → prints a PBKDF2 hash for ADMIN_PASSWORD_HASH.
import { webcrypto as crypto } from 'node:crypto'

const pw = process.argv[2]
if (!pw || pw.length < 12) {
  console.error('Password minimal 12 karakter. Usage: node scripts/hash-password.mjs "<password>"')
  process.exit(1)
}
const b64url = (u) => Buffer.from(u).toString('base64url')
const salt = crypto.getRandomValues(new Uint8Array(16))
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits'])
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256)
console.log(`pbkdf2$100000$${b64url(salt)}$${b64url(new Uint8Array(bits))}`)
