/**
 * useIlluminatePurposes — Phase 4 of the Illumination AI design.
 *
 * Tom Gilb 2026-06-15 verbatim (Phase 4 mandate):
 *   *"5. A 'Your Purposes' menu, asks for their reasons for this inquiry
 *    (giving some options and a place to key or say), then based on that,
 *    the Tool guides them through useful material, until their Illumination
 *    is 'Sharp Enough'."*
 *
 * Singleton reactive state holding:
 *   - the currently-active purpose (or null = no purpose set)
 *   - free-text override when the planner picks "Other"
 *   - position within the recommended sequence (so the picker can show the
 *     NEXT recommended tab as a subtle nudge)
 *
 * Composes with:
 *   - r41 v27 6-tab IA
 *   - r41 v28 glance card (a third CTA "What's my purpose?" lives here)
 *   - r41 v33 Phase 5 session log (purpose recorded as session metadata)
 *   - Universal Undo SUPREME (purpose changes are non-destructive UI state)
 *   - American English Standard
 *   - HoverHint (not "tooltip")
 */

import { ref, computed } from 'vue'
import { ILLUMINATE_PURPOSES, purposeById, type IlluminatePurpose, type IlluminateTab } from '../data/illuminatePurposes'

interface PurposeState {
  purposeId:   string | null   // null = no purpose selected
  freeText:    string          // populated when purposeId === 'other'
  sequenceIdx: number          // how far through the sequence we are
}

const _state = ref<PurposeState>({
  purposeId:   null,
  freeText:    '',
  sequenceIdx: 0,
})

export function useIlluminatePurposes() {

  function setPurpose(purposeId: string | null, freeText: string = ''): void {
    _state.value = {
      purposeId,
      freeText:    freeText.trim(),
      sequenceIdx: 0,
    }
  }

  function clearPurpose(): void {
    _state.value = { purposeId: null, freeText: '', sequenceIdx: 0 }
  }

  /** Advance the sequence pointer by one (called when the planner clicks the
   *  recommended-next-tab nudge or progresses through the sequence). */
  function advanceSequence(): void {
    const p = purposeById(_state.value.purposeId)
    if (!p) return
    _state.value.sequenceIdx = Math.min(_state.value.sequenceIdx + 1, p.sequence.length - 1)
  }

  /** Reset the sequence pointer to start (called when the planner picks a
   *  different tab manually, signalling they want to restart the flow). */
  function rewindSequence(): void {
    _state.value.sequenceIdx = 0
  }

  const purpose = computed<IlluminatePurpose | null>(() => purposeById(_state.value.purposeId))
  const freeText = computed<string>(() => _state.value.freeText)
  const sequenceIdx = computed<number>(() => _state.value.sequenceIdx)
  const currentTabInSequence = computed<IlluminateTab | null>(() => {
    if (!purpose.value) return null
    return purpose.value.sequence[_state.value.sequenceIdx] ?? null
  })
  const nextTabInSequence = computed<IlluminateTab | null>(() => {
    if (!purpose.value) return null
    return purpose.value.sequence[_state.value.sequenceIdx + 1] ?? null
  })
  const isAtSequenceEnd = computed<boolean>(() => {
    if (!purpose.value) return false
    return _state.value.sequenceIdx >= purpose.value.sequence.length - 1
  })

  /** When a tab activates, sync the sequence pointer to that tab if it's in
   *  the recommended sequence — keeps the "next tab" nudge accurate when the
   *  planner deviates and then re-aligns. */
  function syncSequenceToTab(tab: IlluminateTab): void {
    const p = purpose.value
    if (!p) return
    const idx = p.sequence.indexOf(tab)
    if (idx >= 0) _state.value.sequenceIdx = idx
  }

  return {
    setPurpose,
    clearPurpose,
    advanceSequence,
    rewindSequence,
    syncSequenceToTab,
    purpose,
    freeText,
    sequenceIdx,
    currentTabInSequence,
    nextTabInSequence,
    isAtSequenceEnd,
    ALL_PURPOSES: ILLUMINATE_PURPOSES,
  }
}
