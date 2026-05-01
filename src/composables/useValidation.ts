// UNIT_TYPE=Hook
// useValidation — field-level validation for the SEM entry form
// Rules: required (non-empty after trim), min-length 3, max-length 500
// Spec: S.EvoStep1.ComposableImpl / V.FormValidationCoverage

import { computed, ref } from 'vue'

export type FieldName = 'stakes' | 'ends' | 'means'

export type ValidationErrors = Record<FieldName, string>

const FIELD_LABELS: Record<FieldName, string> = {
  stakes: 'Stakes',
  ends: 'Ends',
  means: 'Means',
}

const MIN_LENGTH = 3
const MAX_LENGTH = 500

function validateField(name: FieldName, value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return `${FIELD_LABELS[name]} is required.`
  }
  if (trimmed.length < MIN_LENGTH) {
    return `${FIELD_LABELS[name]} must be at least ${MIN_LENGTH} characters.`
  }
  if (trimmed.length > MAX_LENGTH) {
    return `${FIELD_LABELS[name]} must be ${MAX_LENGTH} characters or fewer.`
  }
  return ''
}

/**
 * Composable for validating SEM entry form fields (Stakes, Ends, Means).
 *
 * Each call creates an isolated reactive error state — instances do not share state.
 * Validation rules per field: required (non-empty after trim), min-length 3, max-length 500.
 *
 * @returns {{ errors, isValid, validate, clearErrors }}
 *   - errors: reactive record of per-field error messages (empty string = no error)
 *   - isValid: computed boolean — true when all three error strings are empty
 *   - validate(fields): runs all field rules; returns true if all fields pass
 *   - clearErrors(): resets all error messages to empty string
 *
 * Preconditions: `fields` passed to validate() must contain keys stakes, ends, means.
 * Errors: extra keys in `fields` are ignored; no exception is thrown for unknown keys.
 */
export function useValidation() {
  const errors = ref<ValidationErrors>({ stakes: '', ends: '', means: '' })

  const isValid = computed(
    () =>
      errors.value.stakes === '' &&
      errors.value.ends === '' &&
      errors.value.means === '',
  )

  function validate(fields: Record<FieldName, string>): boolean {
    errors.value.stakes = validateField('stakes', fields.stakes)
    errors.value.ends = validateField('ends', fields.ends)
    errors.value.means = validateField('means', fields.means)
    return isValid.value
  }

  function clearErrors() {
    errors.value = { stakes: '', ends: '', means: '' }
  }

  return {
    errors,
    isValid,
    validate,
    clearErrors,
  }
}
