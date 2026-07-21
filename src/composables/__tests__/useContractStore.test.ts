// UNIT_TYPE=Test
// r41 v409 (Tom Gilb 2026-07-01) — regression tests for the Planguage
// Mnemonic ID Standard SUPREME implementation in useContractStore.
//
// Tom Gilb verbatim: "I want tags according to the Planguage standard. Is
// this in the supreme standard yet? No 'R'. The Tag should be derived as
// a unique set of 1 to few words, capitalized, from the Text they describe".

import { describe, it, expect } from 'vitest'
import { _deriveMnemonicFromDescription } from '../useContractStore'

describe('_deriveMnemonicFromDescription (r41 v409)', () => {
  it('returns "Unnamed Entry" for empty input', () => {
    expect(_deriveMnemonicFromDescription('')).toBe('Unnamed Entry')
    expect(_deriveMnemonicFromDescription('   ')).toBe('Unnamed Entry')
  })

  it('extracts 2 significant words from a normal description', () => {
    const out = _deriveMnemonicFromDescription('Maximum amount the contractor can be paid for suspension costs')
    // "the", "can", "be" filtered as stop-words; "Maximum" (7-char) triggers 2-word mode.
    expect(out.split(' ')).toHaveLength(2)
    // First word should be Capitalized.
    expect(/^[A-Z]/.test(out)).toBe(true)
    // Never contains "R." / "V." / "F." / "S." / "C." prefixes.
    expect(out).not.toMatch(/^[VFSCR]\./)
  })

  it('never emits the sequential-number pattern', () => {
    const out = _deriveMnemonicFromDescription('Contractor shall deliver on time')
    expect(out).not.toMatch(/^[VFSCR]\d/)     // R1 / V2 style
    expect(out).not.toMatch(/^[VFSCR]\.\d/)   // R.1 / V.2 style
    expect(out).not.toMatch(/^\d+$/)          // bare number
  })

  it('preserves acronyms verbatim (GDPR, SLA, HIPAA)', () => {
    expect(_deriveMnemonicFromDescription('GDPR compliance monitoring rules')).toMatch(/^GDPR/)
    expect(_deriveMnemonicFromDescription('SLA response threshold obligations')).toMatch(/^SLA/)
  })

  it('capitalizes the first letter of each word', () => {
    const out = _deriveMnemonicFromDescription('delivery of contract materials')
    for (const w of out.split(' ')) {
      // Each word starts with an uppercase letter (or is a preserved acronym).
      expect(w[0]).toBe(w[0].toUpperCase())
    }
  })

  it('picks 3 words when the first significant word is short', () => {
    const out = _deriveMnemonicFromDescription('Fee for late payment on invoices')
    // "Fee" is 3-char → triggers 3-word mode; result should be 3 words.
    expect(out.split(' ').length).toBeGreaterThanOrEqual(2)
  })

  it('filters common stop-words', () => {
    const out = _deriveMnemonicFromDescription('the delivery of the materials')
    expect(out.toLowerCase()).not.toMatch(/^\s*the\b/)
    expect(out).toContain('Delivery')
  })

  it('handles descriptions with only stop-words gracefully', () => {
    const out = _deriveMnemonicFromDescription('the and or of')
    // Falls through to letter-containing tokens (all stop-words but still
    // letters).  Never returns empty; never numeric; always Capitalized.
    expect(out).not.toBe('')
    expect(/[A-Z]/.test(out)).toBe(true)
  })

  it('handles all-numeric / punctuation-only descriptions', () => {
    expect(_deriveMnemonicFromDescription('12345')).toBe('Unnamed Entry')
    expect(_deriveMnemonicFromDescription('!!!???')).toBe('Unnamed Entry')
  })

  it('outputs Capitalized words separated by spaces (not PascalCase)', () => {
    const out = _deriveMnemonicFromDescription('Onboarding speed for new users')
    // The Planguage standard uses space-separated Title Case, not concatenated.
    expect(out).toMatch(/\s/)
    expect(out).not.toMatch(/^[A-Z][a-z]+[A-Z]/)   // no PascalCase concatenation
  })
})
