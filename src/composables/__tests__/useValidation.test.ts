// Spec: V.FormValidationCoverage — must cover ≥ 85% of defined validation scenarios
// Scenarios: each field empty, each field below min-length, each field above max-length, all-valid

import { useValidation } from '../useValidation'

const VALID = {
  stakes: 'As a product manager',
  ends: 'I want to achieve 90% user retention',
  means: 'By implementing a loyalty rewards programme',
}

const LONG = 'a'.repeat(501)
const SHORT = 'ab' // 2 chars — below min of 3

describe('useValidation', () => {
  // ── Empty field scenarios ───────────────────────────────────────────────

  it('shows error when stakes is empty', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: '', ends: VALID.ends, means: VALID.means })
    expect(errors.value.stakes).toBeTruthy()
    expect(errors.value.ends).toBe('')
    expect(errors.value.means).toBe('')
  })

  it('shows error when ends is empty', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: VALID.stakes, ends: '', means: VALID.means })
    expect(errors.value.stakes).toBe('')
    expect(errors.value.ends).toBeTruthy()
    expect(errors.value.means).toBe('')
  })

  it('shows error when means is empty', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: VALID.stakes, ends: VALID.ends, means: '' })
    expect(errors.value.stakes).toBe('')
    expect(errors.value.ends).toBe('')
    expect(errors.value.means).toBeTruthy()
  })

  it('shows errors when all fields are empty', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: '', ends: '', means: '' })
    expect(errors.value.stakes).toBeTruthy()
    expect(errors.value.ends).toBeTruthy()
    expect(errors.value.means).toBeTruthy()
  })

  it('treats whitespace-only as empty', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: '   ', ends: VALID.ends, means: VALID.means })
    expect(errors.value.stakes).toBeTruthy()
  })

  // ── Below min-length scenarios ──────────────────────────────────────────

  it('shows error when stakes is below min-length', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: SHORT, ends: VALID.ends, means: VALID.means })
    expect(errors.value.stakes).toBeTruthy()
    expect(errors.value.stakes).toContain('3')
  })

  it('shows error when ends is below min-length', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: VALID.stakes, ends: SHORT, means: VALID.means })
    expect(errors.value.ends).toBeTruthy()
    expect(errors.value.ends).toContain('3')
  })

  it('shows error when means is below min-length', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: VALID.stakes, ends: VALID.ends, means: SHORT })
    expect(errors.value.means).toBeTruthy()
    expect(errors.value.means).toContain('3')
  })

  // ── Above max-length scenarios ──────────────────────────────────────────

  it('shows error when stakes exceeds max-length', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: LONG, ends: VALID.ends, means: VALID.means })
    expect(errors.value.stakes).toBeTruthy()
    expect(errors.value.stakes).toContain('500')
  })

  it('shows error when ends exceeds max-length', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: VALID.stakes, ends: LONG, means: VALID.means })
    expect(errors.value.ends).toBeTruthy()
    expect(errors.value.ends).toContain('500')
  })

  it('shows error when means exceeds max-length', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: VALID.stakes, ends: VALID.ends, means: LONG })
    expect(errors.value.means).toBeTruthy()
    expect(errors.value.means).toContain('500')
  })

  // ── Valid submission ────────────────────────────────────────────────────

  it('returns no errors when all fields are valid', () => {
    const { validate, errors, isValid } = useValidation()
    const result = validate(VALID)
    expect(result).toBe(true)
    expect(errors.value.stakes).toBe('')
    expect(errors.value.ends).toBe('')
    expect(errors.value.means).toBe('')
    expect(isValid.value).toBe(true)
  })

  it('accepts a value of exactly min-length (3 chars)', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: 'abc', ends: VALID.ends, means: VALID.means })
    expect(errors.value.stakes).toBe('')
  })

  it('accepts a value of exactly max-length (500 chars)', () => {
    const { validate, errors } = useValidation()
    validate({ stakes: 'a'.repeat(500), ends: VALID.ends, means: VALID.means })
    expect(errors.value.stakes).toBe('')
  })

  // ── State management ────────────────────────────────────────────────────

  it('clears errors on clearErrors()', () => {
    const { validate, clearErrors, errors } = useValidation()
    validate({ stakes: '', ends: '', means: '' })
    expect(errors.value.stakes).toBeTruthy()
    clearErrors()
    expect(errors.value.stakes).toBe('')
    expect(errors.value.ends).toBe('')
    expect(errors.value.means).toBe('')
  })

  it('returns false from validate() when any field is invalid', () => {
    const { validate } = useValidation()
    expect(validate({ stakes: '', ends: VALID.ends, means: VALID.means })).toBe(false)
  })

  // ── isValid initial state ───────────────────────────────────────────────

  it('isValid is true before any validate() call (no errors set yet)', () => {
    // Spec: V.EvoStep1.FormCoverage — isValid reflects error state; initial state has no errors
    const { isValid } = useValidation()
    expect(isValid.value).toBe(true)
  })

  it('isValid is false after validate() with invalid input', () => {
    // Spec: V.FormValidationCoverage — isValid must reflect current error state
    const { validate, isValid } = useValidation()
    validate({ stakes: '', ends: VALID.ends, means: VALID.means })
    expect(isValid.value).toBe(false)
  })

  it('isValid becomes true again after clearErrors()', () => {
    // Spec: V.EvoStep1.FormCoverage — clearErrors resets all errors; isValid must follow
    const { validate, clearErrors, isValid } = useValidation()
    validate({ stakes: '', ends: '', means: '' })
    expect(isValid.value).toBe(false)
    clearErrors()
    expect(isValid.value).toBe(true)
  })
})
