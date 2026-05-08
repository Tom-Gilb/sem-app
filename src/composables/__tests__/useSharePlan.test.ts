// UNIT_TYPE=Test
// Tests for useSharePlan composable (Feature #7)

import { describe, it, expect } from 'vitest'
import { useSharePlan } from '../useSharePlan'
import type { SpecBlock } from '../../types/spec'

const minimalSpec: SpecBlock = {
  functions: [
    {
      id: 'F.Test',
      type: 'Function',
      level: 'Product',
      description: 'Test function',
      successCriteria: 'It works',
      functionOfValue: 'V.Test',
    },
  ],
  values: [
    {
      id: 'V.Test',
      type: 'Value',
      level: 'Product',
      description: 'Test value',
      scale: '% passing',
      meter: 'Automated tests',
      status: 'pre-build',
      tolerable: '70%',
      goal: '90%',
      valueOfFunction: 'F.Test',
    },
  ],
  solutions: [
    {
      id: 'S.Test',
      type: 'Solution',
      level: 'Product',
      description: 'Test solution',
      impact: 'V.Test ~90%',
      function: 'F.Test',
    },
  ],
}

describe('useSharePlan', () => {
  it('encodeState produces a URL with ?plan= param', () => {
    const { encodeState } = useSharePlan()
    const url = encodeState(minimalSpec)
    expect(url).toContain('?plan=')
  })

  it('encodeState URL starts with window.location.origin', () => {
    const { encodeState } = useSharePlan()
    const url = encodeState(minimalSpec)
    // In test env (no real window), falls back to http://localhost
    expect(url).toMatch(/^https?:\/\//)
  })

  it('qrUrl contains correct API host and encoded URL', () => {
    const { encodeState, qrUrl } = useSharePlan()
    const planUrl = encodeState(minimalSpec)
    const qr = qrUrl(planUrl)
    expect(qr).toContain('api.qrserver.com')
    expect(qr).toContain('create-qr-code')
    expect(qr).toContain(encodeURIComponent(planUrl))
  })

  it('round-trip: encode then decode gives same spec', () => {
    const { encodeState, decodeState } = useSharePlan()
    const url = encodeState(minimalSpec)
    const decoded = decodeState(url)
    expect(decoded).not.toBeNull()
    expect(decoded?.spec.functions[0].id).toBe('F.Test')
    expect(decoded?.spec.values[0].goal).toBe('90%')
    expect(decoded?.spec.solutions[0].description).toBe('Test solution')
  })

  it('decodeState returns null for an invalid URL', () => {
    const { decodeState } = useSharePlan()
    expect(decodeState('http://localhost?notaplan=abc')).toBeNull()
    expect(decodeState('not-a-url')).toBeNull()
  })
})
