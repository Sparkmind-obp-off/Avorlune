import { describe, expect, it } from 'vitest'
import { PROJECT_STATUSES, REFERENCE_PATTERN, TRANSITIONS, canTransition, formatIDR, generateReference, inquirySchema } from '../../shared/domain'
import { validInquiry } from '../helpers/app'

describe('status transitions', () => {
  it('follows the documented happy path', () => {
    const path = ['inquiry', 'qualifying', 'quoted', 'awaiting_payment', 'queued', 'producing', 'internal_review', 'customer_review', 'approved', 'delivered'] as const
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true)
  })
  it('supports the revision loop', () => {
    expect(canTransition('customer_review', 'revision')).toBe(true)
    expect(canTransition('revision', 'producing')).toBe(true)
  })
  it('rejects skips and backwards moves', () => {
    expect(canTransition('inquiry', 'producing')).toBe(false)
    expect(canTransition('inquiry', 'delivered')).toBe(false)
    expect(canTransition('delivered', 'producing')).toBe(false)
    expect(canTransition('approved', 'cancelled')).toBe(false)
  })
  it('terminal states have no exits and every target is a known status', () => {
    expect(TRANSITIONS.delivered).toEqual([])
    expect(TRANSITIONS.cancelled).toEqual([])
    for (const s of PROJECT_STATUSES) for (const t of TRANSITIONS[s]) expect(PROJECT_STATUSES).toContain(t)
  })
})

describe('public reference', () => {
  it('matches the non-sequential human-readable pattern', () => {
    const ref = generateReference((n) => crypto.getRandomValues(new Uint8Array(n)))
    expect(ref).toMatch(REFERENCE_PATTERN)
  })
  it('is effectively unique across many draws', () => {
    const set = new Set(Array.from({ length: 2000 }, () => generateReference((n) => crypto.getRandomValues(new Uint8Array(n)))))
    expect(set.size).toBe(2000)
  })
})

describe('inquiry validation', () => {
  it('accepts a valid inquiry', () => {
    expect(inquirySchema.safeParse(validInquiry()).success).toBe(true)
  })
  it('requires consent and rights confirmation', () => {
    expect(inquirySchema.safeParse(validInquiry({ consent: false })).success).toBe(false)
    expect(inquirySchema.safeParse(validInquiry({ rightsConfirmed: false })).success).toBe(false)
  })
  it('validates contact by method', () => {
    expect(inquirySchema.safeParse(validInquiry({ contactValue: 'not-an-email' })).success).toBe(false)
    expect(inquirySchema.safeParse(validInquiry({ contactMethod: 'whatsapp', contactValue: '+62 812 3456 7890' })).success).toBe(true)
    expect(inquirySchema.safeParse(validInquiry({ contactMethod: 'whatsapp', contactValue: 'abc' })).success).toBe(false)
  })
  it('requires a date for specific deadlines', () => {
    expect(inquirySchema.safeParse(validInquiry({ deadlinePreference: 'specific_date' })).success).toBe(false)
    expect(inquirySchema.safeParse(validInquiry({ deadlinePreference: 'specific_date', deadlineDate: '2030-01-15' })).success).toBe(true)
  })
  it('rejects non-http reference links and too many links', () => {
    expect(inquirySchema.safeParse(validInquiry({ referenceLinks: ['javascript:alert(1)'] })).success).toBe(false)
    expect(inquirySchema.safeParse(validInquiry({ referenceLinks: Array(6).fill('https://example.test') })).success).toBe(false)
  })
  it('rejects a filled honeypot', () => {
    expect(inquirySchema.safeParse(validInquiry({ website: 'spam.example' })).success).toBe(false)
  })
})

describe('money', () => {
  it('formats integer IDR minor units', () => {
    expect(formatIDR(2500000).replace(/\s/g, ' ')).toMatch(/Rp\s?2\.500\.000/)
  })
})
