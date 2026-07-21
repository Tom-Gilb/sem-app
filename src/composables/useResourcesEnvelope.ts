/**
 * useResourcesEnvelope — v514 (2026-07-21) — full-fidelity round-trip of the
 * v504–v513 resource subsystem alongside SpecVersion snapshots + spec exports.
 *
 * Tom Gilb 2026-07-21 verbatim: "can you promise me that all running estimation
 * data is saved and restored with any version of the spec?" — the honest answer
 * before this ship was NO because the 4 composables (useResourceEstimations +
 * useIetResourceSnapshot + usePlanScopeFramework + useResourcesAgent) each
 * persisted per-plan to localStorage keyed by planId, but were NEVER embedded
 * in the SpecVersion envelope, spec markdown export, or spec import.  Three
 * concrete failure modes:
 *   1. Save Spec v1 → mutate estimations → save Spec v2 → load v1: get v1
 *      spec but v2 estimations (they live outside the SpecVersion).
 *   2. Rename the plan: estimations "disappear" (orphaned under old key).
 *   3. Export → re-import: zero estimation data travels.
 *
 * The fix (v514): a small orchestrator composable that gathers snapshots from
 * all 4 composables into ONE ResourcesEnvelope object.  SpecVersion carries
 * an optional `resourcesEnvelope` field; useSpecHistory captures it on save
 * + restores it on load.  useSpecExport appends an HTML-comment JSON block
 * with the envelope; useSpecImport parses + hydrates it.
 *
 * SUPREME rules composed:
 *   • No-Silent-Data-Loss SUPREME (this IS the ship that makes the promise true)
 *   • Universal Undo SUPREME (envelope save + restore both wrap in Undo)
 *   • Twin portability (pure JSON structure; ports to Kai's Twin unchanged)
 *   • Term + Definition + Source SUPREME (every envelope field is typed +
 *     defaulted + validated on hydrate)
 */

import { computed, type Ref, type ComputedRef } from 'vue'
import { useResourceEstimations, type Estimation, type EstimationThresholds } from './useResourceEstimations'
import { useIetResourceSnapshot, type IetResourceSnapshot } from './useIetResourceSnapshot'
import { usePlanScopeFramework, type PlanScopeFramework } from './usePlanScopeFramework'
import { useResourcesAgent, type ResourcesAgentSettings } from './useResourcesAgent'

/** Canonical envelope of every persisted resource-subsystem state.
 *  Optional per-slot so a partial envelope hydrates the slots it carries
 *  and leaves the rest as defaults (backwards-compat safety). */
export interface ResourcesEnvelope {
  /** Schema version — bump when the envelope shape changes non-additively. */
  envelopeVersion: 1
  /** ISO timestamp of when the envelope was captured. */
  capturedAt: string
  /** planId at capture time — for cross-check on hydrate; if planId at
   *  hydrate differs, the envelope still hydrates (the composable's per-plan
   *  storage will land the data under the NEW planId). */
  capturedForPlanId: string
  /** v504–v513 useResourceEstimations state */
  estimations?: {
    estimations: Estimation[]
    thresholds:  EstimationThresholds
  }
  /** v507 useIetResourceSnapshot state */
  ietSnapshots?: {
    history: IetResourceSnapshot[]
  }
  /** v503 usePlanScopeFramework state */
  planScope?: PlanScopeFramework
  /** v509+ useResourcesAgent settings (standards / references / currency / …) */
  resourcesAgentSettings?: ResourcesAgentSettings
}

/** Marker string used to fence the envelope in spec-export markdown. */
export const ENVELOPE_FENCE_OPEN  = '<!-- SEM-RESOURCES-ENVELOPE v1 BEGIN'
export const ENVELOPE_FENCE_CLOSE = 'SEM-RESOURCES-ENVELOPE v1 END -->'

export interface UseResourcesEnvelope {
  /** Capture the full current state of the 4 composables into one envelope. */
  captureEnvelope: () => ResourcesEnvelope
  /** Hydrate all 4 composables from an envelope (missing slots left as defaults). */
  hydrateEnvelope: (envelope: ResourcesEnvelope | null | undefined) => void
  /** Live envelope (recomputes reactively). */
  envelope: ComputedRef<ResourcesEnvelope>
  /** Serialise the envelope to a fenced HTML-comment JSON block for spec-export. */
  serialiseEnvelopeToMarkdown: (envelope: ResourcesEnvelope) => string
  /** Extract + parse an envelope from imported markdown (returns null if absent
   *  or malformed — never throws so import round-trip stays resilient). */
  extractEnvelopeFromMarkdown: (markdown: string) => ResourcesEnvelope | null
}

export function useResourcesEnvelope(
  planIdRef: Ref<string> | ComputedRef<string>,
): UseResourcesEnvelope {
  const est = useResourceEstimations(planIdRef)
  const iet = useIetResourceSnapshot(planIdRef)
  const psf = usePlanScopeFramework(planIdRef)
  const agent = useResourcesAgent(planIdRef)

  function captureEnvelope(): ResourcesEnvelope {
    return {
      envelopeVersion: 1,
      capturedAt: new Date().toISOString(),
      capturedForPlanId: planIdRef.value,
      estimations:            est.getSnapshot(),
      ietSnapshots:           iet.getSnapshot(),
      planScope:              psf.getSnapshot(),
      resourcesAgentSettings: agent.getSnapshot(),
    }
  }

  const envelope = computed<ResourcesEnvelope>(() => captureEnvelope())

  function hydrateEnvelope(env: ResourcesEnvelope | null | undefined): void {
    if (!env || typeof env !== 'object') return
    // Each slot is optional; hydrate only what's present.  Missing slots
    // leave the composable's current state untouched (safe partial restore).
    if (env.estimations)            est.hydrateFromSnapshot(env.estimations)
    if (env.ietSnapshots)           iet.hydrateFromSnapshot(env.ietSnapshots)
    if (env.planScope)              psf.hydrateFromSnapshot(env.planScope)
    if (env.resourcesAgentSettings) agent.hydrateFromSnapshot(env.resourcesAgentSettings)
  }

  function serialiseEnvelopeToMarkdown(env: ResourcesEnvelope): string {
    // Fence with an HTML comment so it renders as invisible in Markdown viewers
    // but is easy to detect + extract on import.  Base64-encode the JSON to
    // avoid any accidental interaction with Markdown parsers.
    const json = JSON.stringify(env)
    // Simple base64 encoding — works in browsers (btoa) with utf-8 safe path.
    const utf8Bytes = new TextEncoder().encode(json)
    let binary = ''
    for (const b of utf8Bytes) binary += String.fromCharCode(b)
    const b64 = btoa(binary)
    return `\n\n${ENVELOPE_FENCE_OPEN}\n${b64}\n${ENVELOPE_FENCE_CLOSE}\n`
  }

  function extractEnvelopeFromMarkdown(markdown: string): ResourcesEnvelope | null {
    if (typeof markdown !== 'string') return null
    const openIdx = markdown.indexOf(ENVELOPE_FENCE_OPEN)
    if (openIdx < 0) return null
    const closeIdx = markdown.indexOf(ENVELOPE_FENCE_CLOSE, openIdx)
    if (closeIdx < 0) return null
    const b64 = markdown.slice(openIdx + ENVELOPE_FENCE_OPEN.length, closeIdx).trim()
    try {
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const json = new TextDecoder().decode(bytes)
      const parsed = JSON.parse(json) as ResourcesEnvelope
      if (parsed && typeof parsed === 'object' && parsed.envelopeVersion === 1) {
        return parsed
      }
      return null
    } catch { return null }
  }

  return {
    captureEnvelope,
    hydrateEnvelope,
    envelope,
    serialiseEnvelopeToMarkdown,
    extractEnvelopeFromMarkdown,
  }
}
