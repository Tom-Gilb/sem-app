// UNIT_TYPE=Hook
//
// useEvoStepImprovement.ts — load / save the ImprovementSet for an Evo Step.
//
// v1: localStorage-backed.  Single source of truth per (planId, stepName).
// v2: vault-file or Supabase-blob backed so ideas persist across machines
//     and travel with the spec on export.
//
// Architecture: pure file-read pattern per the Claude-Code-as-AI-Layer rule.
// The composable NEVER calls an AI provider.  Real ideas come from Claudian
// invoked by Tom, who pastes the resulting JSON into the panel.
//
// Defensive: corrupted localStorage entries → returns mock seed rather than
// crashing the panel.

import { ref, watch, type Ref } from 'vue'
import type { EvoStep } from '../types/evo-plan'
import {
  type ImprovementSet,
  storageKey,
  buildMockIdeas,
} from '../data/evoStepImprovement'

/** Reads a stored ImprovementSet, or returns null on missing / corrupt. */
function readSet(planId: string, stepName: string): ImprovementSet | null {
  try {
    const raw = localStorage.getItem(storageKey(planId, stepName))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as ImprovementSet
  } catch {
    return null
  }
}

/** Writes an ImprovementSet — silent on quota errors (rare). */
function writeSet(planId: string, stepName: string, set: ImprovementSet): void {
  try {
    localStorage.setItem(storageKey(planId, stepName), JSON.stringify(set))
  } catch {
    // Quota exceeded / private mode — in-memory ref still holds the data.
  }
}

/** Removes the stored ImprovementSet for one (plan, step). */
function clearSet(planId: string, stepName: string): void {
  try {
    localStorage.removeItem(storageKey(planId, stepName))
  } catch {
    // Ignore.
  }
}

/**
 * Composable: reactive ImprovementSet for one (plan, step) tuple.
 *
 * @param planId   - Stable identifier for the current plan
 * @param stepRef  - Ref to the currently-selected EvoStep
 *
 * Returns:
 *   - ideas      : reactive ref<ImprovementSet | null> — null when no ideas yet
 *   - hasIdeas   : reactive computed boolean
 *   - loadMock   : populates with mock seed (for demo / first-look UX)
 *   - pasteIdeas : parses a pasted JSON string and stores it
 *   - clear      : removes all ideas for the current step
 */
export function useEvoStepImprovement(
  planId: Ref<string>,
  stepRef: Ref<EvoStep | undefined>,
) {
  const ideas = ref<ImprovementSet | null>(
    stepRef.value ? readSet(planId.value, stepRef.value.name) : null,
  )
  /** Last paste-parse error message — surfaced in UI when paste fails. */
  const lastError = ref<string>('')

  // Re-load when the (plan, step) tuple changes
  watch(
    () => [planId.value, stepRef.value?.name ?? ''] as const,
    ([plan, name]) => {
      ideas.value = name ? readSet(plan, name) : null
      lastError.value = ''
    },
  )

  /** Populates the current step with mock seed data so the UI is alive on
   *  first open.  Persists to localStorage so the mock survives reloads. */
  function loadMock(): void {
    if (!stepRef.value) return
    const seed = buildMockIdeas(stepRef.value)
    ideas.value = seed
    writeSet(planId.value, stepRef.value.name, seed)
    lastError.value = ''
  }

  /** Parses a pasted JSON string (the output of the Claudian prompt) and
   *  stores it as the current ImprovementSet.  Returns true on success.
   *
   *  Defensive: validates the JSON shape minimally before storing.  Sets
   *  `lastError` with a human-readable message on failure so the UI can
   *  surface it.
   */
  function pasteIdeas(jsonText: string): boolean {
    if (!stepRef.value) {
      lastError.value = 'No Evo Step selected.'
      return false
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText.trim())
    } catch (err) {
      lastError.value = `Could not parse JSON: ${err instanceof Error ? err.message : String(err)}`
      return false
    }
    if (typeof parsed !== 'object' || parsed === null) {
      lastError.value = 'Pasted content is not a JSON object.'
      return false
    }
    const p = parsed as Partial<ImprovementSet>
    if (!Array.isArray(p.betterIdeas)) {
      lastError.value = 'JSON is missing required field "betterIdeas" (must be an array).'
      return false
    }
    // Force the stepName to match the selected step (in case the LLM emitted
    // a different name) so the storage key is consistent.
    const set: ImprovementSet = {
      stepName: stepRef.value.name,
      generatedAt: Date.now(),
      generatedBy: 'claudian',
      crazyIdea: p.crazyIdea ?? null,
      crazyCritique: p.crazyCritique ?? '',
      betterIdeas: p.betterIdeas,
      skunkworksIdeas: Array.isArray(p.skunkworksIdeas) ? p.skunkworksIdeas : [],
    }
    ideas.value = set
    writeSet(planId.value, stepRef.value.name, set)
    lastError.value = ''
    return true
  }

  /** Removes all ideas for the current step (with no confirm — caller's job). */
  function clear(): void {
    if (!stepRef.value) return
    clearSet(planId.value, stepRef.value.name)
    ideas.value = null
    lastError.value = ''
  }

  return {
    ideas,
    lastError,
    loadMock,
    pasteIdeas,
    clear,
  }
}
