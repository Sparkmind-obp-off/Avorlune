const PATTERNS: [RegExp, string][] = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/pbkdf2\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+/g, '[hash]'],
  [/#t=[A-Za-z0-9_.-]+/g, '#t=[token]'],
  [/([?&](?:s|sig|token|t)=)[^&\s]+/gi, '$1[redacted]'],
  [/\b[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{20,}\b/g, '[token]'],
  [/\+?\d[\d\s-]{8,}\d/g, '[phone]'],
]

/** Remove emails, phone numbers, tokens, signatures and password hashes from free text. */
export function redact(input: string): string {
  let out = input
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep)
  return out.slice(0, 300)
}

/** Structured log line. Only pass non-sensitive fields; string values are redacted defensively. */
export function logEvent(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) safe[k] = typeof v === 'string' ? redact(v) : v
  const line = JSON.stringify({ level, event, ...safe })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}
