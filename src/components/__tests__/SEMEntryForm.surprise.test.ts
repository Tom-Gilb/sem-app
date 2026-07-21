// UNIT_TYPE=Test
// Tests for SEMEntryForm.vue — Feature #37: "Surprise Me" Random Spec

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SEMEntryForm from '../SEMEntryForm.vue'

// Mock useVoice to avoid browser API issues in test environment
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

describe('SEMEntryForm.vue — Surprise Me (Feature #37)', () => {
  // ── Button presence ───────────────────────────────────────────────────────

  it('"Surprise me" button is present with correct aria-label', () => {
    const wrapper = mount(SEMEntryForm)
    // Component uses aria-label="Surprise me" (not "Fill with a random SEM example")
    const btn = wrapper.find('button[aria-label="Surprise me"]')
    expect(btn.exists()).toBe(true)
  })

  it('"Surprise me" button has h-11 class', () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Surprise me"]')
    expect(btn.classes()).toContain('h-11')
  })

  it('"Surprise me" button text contains "Surprise"', () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Surprise me"]')
    expect(btn.text()).toContain('Surprise')
  })

  // ── Clicking transitions to review stage ──────────────────────────────────
  // NOTE 2026-06-09: The component redesign replaced separate #sem-stakes / #sem-ends /
  // #sem-means textareas with a single #sem-raw-input textarea + NLP parser. Clicking
  // Surprise Me fills rawInput then calls parseInput() which transitions to the review
  // stage (stage === 'review'). The input stage block (incl. #sem-raw-input) is hidden;
  // the review stage block (incl. Generate Spec button) becomes visible.

  it('clicking the button transitions to review stage (Generate Spec visible)', async () => {
    const wrapper = mount(SEMEntryForm)
    const btn = wrapper.find('button[aria-label="Surprise me"]')
    await btn.trigger('click')

    // After Surprise Me → parseInput() fires → stage = 'review'
    expect(wrapper.find('[aria-label="Parse my input"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Generate Spec"]').exists()).toBe(true)
  })

  // ── Tests SKIPPED: stale from pre-redesign component ─────────────────────
  // The following tests referenced #sem-stakes / #sem-ends / #sem-means (separate
  // textareas) and a "One-liner mode" button that no longer exist after the
  // component was rebuilt with NLP single-textarea + review-stage flow (2026-06).

  it.skip('clicking multiple times always produces non-empty content', async () => {
    // SKIPPED 2026-06-09: After the first Surprise Me click, stage transitions to
    // 'review' which hides the Surprise Me button (it's inside v-if="stage==='input'").
    // The test loop cannot click the button a second time. Rewrite against the new
    // review-stage chip structure if randomness validation is needed.
  })

  it.skip('clicking multiple times can produce different stakes values (randomness check)', async () => {
    // SKIPPED 2026-06-09: Same reason as above — button hidden after first click in
    // review stage. Also references #sem-stakes which no longer exists.
  })

  it.skip('mode is set to "sem" after clicking Surprise me', async () => {
    // SKIPPED 2026-06-09: The "One-liner mode" button (aria-label="One-liner mode")
    // and the associated mode state no longer exist in the redesigned component.
  })

  // ── Templates row is closed after click ───────────────────────────────────

  it('closes templates row if open when Surprise me is clicked', async () => {
    const wrapper = mount(SEMEntryForm)

    // Open templates — button now uses aria-label="Templates"
    await wrapper.find('button[aria-label="Templates"]').trigger('click')
    expect(wrapper.findAll('button[aria-label*="Apply"]').length).toBeGreaterThan(0)

    // Click Surprise Me — triggers parseInput() → stage = 'review', hiding all input-stage content
    await wrapper.find('button[aria-label="Surprise me"]').trigger('click')

    // Templates row is now hidden (stage switched to review, entire input stage hidden)
    expect(wrapper.findAll('button[aria-label*="Apply"]').length).toBe(0)
  })
})
