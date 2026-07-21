// UNIT_TYPE=Test
// r41 v395 (Tom Gilb 2026-07-01 verbatim "Contract Theater: the case og
// untitled is unsatisfactory. You should extract some kind of Tag and or
// Paragraph info to make it intelligible") — regression tests for the
// heading-derivation helper that replaces the literal "Untitled" fallback
// with an intelligible short label extracted from the clause's own raw text.

import { describe, it, expect } from 'vitest'
import { _deriveClauseHeading, _isBadHeading, bestClauseHeading } from '../useContractParser'

describe('_deriveClauseHeading (r41 v395)', () => {
  it('returns "Untitled clause" when rawText is empty', () => {
    expect(_deriveClauseHeading('', '?')).toBe('Untitled clause')
  })

  it('strips a leading numeric token duplicating the separately-parsed number', () => {
    const raw = '3.2 Delivery Terms\nThe Supplier shall deliver by 30 June 2026.'
    expect(_deriveClauseHeading(raw, '3.2')).toBe('Delivery Terms')
  })

  it('strips an "Article IV" leading token', () => {
    const raw = 'Article IV. Governing Law\nThis contract is governed by English law.'
    expect(_deriveClauseHeading(raw, 'Article IV')).toBe('Governing Law')
  })

  it('strips a section-symbol prefix', () => {
    const raw = '§ 12  Termination for Cause\nEither party may terminate for material breach.'
    expect(_deriveClauseHeading(raw, '§ 12')).toBe('Termination for Cause')
  })

  it('recovers by peeking at the second line when the first is a bare number token', () => {
    const raw = '3.2\nDelivery Terms\nThe Supplier shall deliver by 30 June 2026.'
    expect(_deriveClauseHeading(raw, '3.2')).toBe('Delivery Terms')
  })

  it('caps a long run-on first sentence at 60 chars on a word boundary', () => {
    const raw = 'The Supplier shall use reasonable commercial endeavours to ensure that all deliverables are provided.'
    const out = _deriveClauseHeading(raw, '?')
    expect(out.length).toBeLessThanOrEqual(61)   // 60 chars + ellipsis
    expect(out.endsWith('…')).toBe(true)
    // Must never cut mid-word (the char before the ellipsis must be a letter,
    // and the last WORD must be complete — check by ensuring the word before
    // the ellipsis is a real prefix of the source).
    const withoutEllipsis = out.replace(/…$/, '').trim()
    expect(raw.startsWith(withoutEllipsis)).toBe(true)
  })

  it('prefers the first sentence over a run-on paragraph', () => {
    const raw = 'Confidentiality applies. All information shared by either party under this agreement shall be treated as confidential and shall not be disclosed to any third party without prior written consent, except as required by applicable law or regulatory order.'
    const out = _deriveClauseHeading(raw, '?')
    expect(out).toBe('Confidentiality applies')
  })

  it('falls back to a two-word mnemonic for pathological input', () => {
    // Numbers-only body — no letter words in a "meaningful" position.
    const raw = '?????????????'
    expect(_deriveClauseHeading(raw, '?')).toBe('Untitled clause')
  })

  it('uses "Clause <number>" as an absolute-last fallback when only the number is known', () => {
    // Extremely short input that produces no viable headline text.
    const raw = ' a '
    expect(_deriveClauseHeading(raw, '5')).toBe('Clause 5')
  })

  it('strips a "(a)" alphabetic sub-clause token', () => {
    const raw = '(a) Notice of Default\nParty shall provide written notice.'
    expect(_deriveClauseHeading(raw, '(a)')).toBe('Notice of Default')
  })

  it('strips a "Schedule A —" prefix', () => {
    const raw = 'Schedule A — Fees and Charges\nAll fees are payable within 30 days.'
    expect(_deriveClauseHeading(raw, 'Schedule A')).toBe('Fees and Charges')
  })

  it('trims trailing punctuation from the derived headline', () => {
    const raw = 'Force Majeure:\nNeither party shall be liable for delays caused by acts of God.'
    const out = _deriveClauseHeading(raw, '?')
    expect(out).toBe('Force Majeure')
  })
})

describe('_isBadHeading (r41 v396)', () => {
  it('recognises empty / whitespace / undefined / null', () => {
    expect(_isBadHeading(undefined)).toBe(true)
    expect(_isBadHeading(null)).toBe(true)
    expect(_isBadHeading('')).toBe(true)
    expect(_isBadHeading('   ')).toBe(true)
  })
  it('recognises the literal placeholder strings', () => {
    expect(_isBadHeading('Untitled')).toBe(true)
    expect(_isBadHeading('untitled')).toBe(true)
    expect(_isBadHeading('Untitled clause')).toBe(true)
    expect(_isBadHeading('(Untitled)')).toBe(true)
    expect(_isBadHeading('no title')).toBe(true)
    expect(_isBadHeading('None')).toBe(true)
    expect(_isBadHeading('null')).toBe(true)
    expect(_isBadHeading('undefined')).toBe(true)
  })
  it('accepts real headings', () => {
    expect(_isBadHeading('Delivery Terms')).toBe(false)
    expect(_isBadHeading('Governing Law')).toBe(false)
    expect(_isBadHeading('Force Majeure')).toBe(false)
    // A real heading that happens to CONTAIN "untitled" mid-string stays good.
    expect(_isBadHeading('An Untitled Work Provision')).toBe(false)
  })
})

describe('bestClauseHeading (r41 v396)', () => {
  it('returns the stored heading when it is meaningful', () => {
    const cl = { heading: 'Delivery Terms', rawText: '3.2 Delivery Terms\nSupplier shall deliver.', number: '3.2' }
    expect(bestClauseHeading(cl)).toBe('Delivery Terms')
  })
  it('derives from rawText when heading is literally "Untitled" (retroactive rescue)', () => {
    const cl = { heading: 'Untitled', rawText: 'Article IV. Governing Law\nThis contract is governed by English law.', number: 'Article IV' }
    expect(bestClauseHeading(cl)).toBe('Governing Law')
  })
  it('derives from rawText when heading is empty', () => {
    const cl = { heading: '', rawText: 'Force Majeure:\nNeither party shall be liable for delays.', number: '?' }
    expect(bestClauseHeading(cl)).toBe('Force Majeure')
  })
  it('falls back to Clause <number> when rawText yields nothing', () => {
    const cl = { heading: 'Untitled clause', rawText: ' ', number: '5' }
    expect(bestClauseHeading(cl)).toBe('Clause 5')
  })
})
