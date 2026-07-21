// UNIT_TYPE=Test
// Tests for SEMEntryForm.vue — Change 3: Wish + Stakeholder fields
//
// SKIPPED 2026-06-09: The component was redesigned from a three-textarea layout
// (separate #sem-stakes / #sem-ends / #sem-means + an explicit #sem-wish panel
// toggled by button[aria-controls="wish-fields"]) to a single NLP textarea
// (#sem-raw-input) + review stage chip flow. The "Add Wish" panel and its
// associated fields (#sem-wish, #sem-wish-stakeholder) do not exist in the
// current component. All tests in this file are skipped pending a redesign of
// the Wish feature for the chip-based UI, or the decision to remove it.

import { describe, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SEMEntryForm from '../SEMEntryForm.vue'

vi.mock('../../composables/useVoice', () => ({
  useVoice: () => ({
    isListening: { value: false },
    isSpeaking: { value: false },
    voiceError: { value: '' },
    speechSupported: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}))

describe.skip('SEMEntryForm — Change 3: Wish fields', () => {
  it('renders ⭐ Add Wish toggle button', () => {
    // SKIPPED — button[aria-controls="wish-fields"] no longer exists in the redesigned component
    mount(SEMEntryForm)
  })

  it('Wish toggle button meets 44px touch target (min-h-[44px])', () => {
    // SKIPPED — see above
  })

  it('Wish input panel is hidden by default', () => {
    // SKIPPED — see above
  })

  it('clicking toggle shows the Wish input panel', () => {
    // SKIPPED — see above
  })

  it('toggle label changes to "Hide Wish" when open', () => {
    // SKIPPED — see above
  })

  it('Wish input panel contains Wish value and Stakeholder fields', () => {
    // SKIPPED — see above
  })

  it('submit payload includes wish when Wish is filled', () => {
    // SKIPPED — see above
  })

  it('submit payload includes wishStakeholder when both fields filled', () => {
    // SKIPPED — see above
  })

  it('submit payload does not include wish when panel is closed', () => {
    // SKIPPED — see above
  })
})
