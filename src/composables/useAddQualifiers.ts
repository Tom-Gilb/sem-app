// useAddQualifiers.ts — Stage 3.3 Add Qualifiers process.
//
// Tom Gilb 2026-06-27 verbatim: *"the add qualifiers stage does not offer
// any process for doing that. I suggest 2 rounds. 1. A default set of
// qualifiers for everything (when, who, where etc). Then the opportunity to
// modify some of thise, then a third round for additional Levels (for any
// Tolerable and Any Target) to add different conditions and levels."*
//
// Tom Gilb 2026-06-27 (option pick): **C — hybrid: instant mechanical
// defaults visible immediately + AI analysis refines them in place.**
//
// Architectural realisation of the banked SUPREME-tier rules:
//   - r93jjj Qualifiers Are First-Class
//   - r93kkk Multi-Set + CRITICAL + Two-Trigger UX (Phase 2 — Round 3)
//   - r93lll ASPECTS book grounding (3 condition classes: time/place/event)
//   - r93mmm INFINITY TRAP Rule (this is the cure)
//
// Composes with: AI-Max + Conjunction-of-Technologies + Universal Undo
// + Honest Loading Hint Copy + Canonical Planguage Extractor (imports
// CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT).

import { ref, computed, type Ref } from 'vue'
import Anthropic from '@anthropic-ai/sdk'
import { CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT } from '../config/planguagePrompt'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock, VEntry, REntry, ConditionSet, PlanguageQualifier } from '../types/spec'

// Module-private client cache — mirrors useSDK.ts + useGenerateSolutions.ts.
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    if (!apiKey) {
      throw new Error('VITE_ANTHROPIC_API_KEY is not set — Stage 3.3 AI-refined qualifiers require the AI key.')
    }
    _client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
      timeout: 180_000,
    })
  }
  return _client
}

/** Bare-minimum mechanical defaults — instant, no AI call.  Project-wide
 *  same seed: every V/R entry gets the same triplet so Round 1 surface lights
 *  up the moment the planner clicks 3.3.  These get OVERWRITTEN per-entry by
 *  the AI refinement pass that runs in background. */
function buildMechanicalDefaultSet(entryId: string, idx: number): ConditionSet {
  return {
    id: `${entryId}.defaultSet`,
    tag: `${entryId.split('.').slice(1).join('.')}.Defaults`.slice(0, 40) || `Set${idx + 1}`,
    critical: false,
    qualifiers: [
      { tag: 'CurrentYear',      classification: 'time',  value: 'this calendar year' },
      { tag: 'PrimaryScope',     classification: 'place', value: 'primary market / system scope of this plan' },
      { tag: 'NormalOperations', classification: 'event', value: 'normal operating conditions (not failure / not exceptional)' },
    ],
    source: 'template',
    rationale: 'Mechanical default — AI analysis pending.  Edit in Round 2 to scope precisely.',
  }
}

/** Identify every V + R entry — every scalar spec needs Qualifiers per
 *  r93jjj.  Returns flat list of {id, label, kind} for UI rendering. */
export function listScalarEntries(spec: SpecBlock | null | undefined): Array<{ id: string; label: string; kind: 'value' | 'resource'; entry: VEntry | REntry }> {
  if (!spec) return []
  const out: Array<{ id: string; label: string; kind: 'value' | 'resource'; entry: VEntry | REntry }> = []
  for (const v of (spec.values ?? [])) {
    out.push({ id: v.id, label: v.description || v.id, kind: 'value',    entry: v })
  }
  for (const r of (spec.resources ?? [])) {
    out.push({ id: r.id, label: r.description || r.id, kind: 'resource', entry: r })
  }
  return out
}

/** Build the instant mechanical-defaults map.  Synchronous, no I/O. */
export function buildMechanicalDefaults(spec: SpecBlock | null | undefined): Map<string, ConditionSet> {
  const map = new Map<string, ConditionSet>()
  if (!spec) return map
  const entries = listScalarEntries(spec)
  entries.forEach((e, idx) => {
    map.set(e.id, buildMechanicalDefaultSet(e.id, idx))
  })
  return map
}

/** Build the AI prompt — focused Qualifier generation, NOT spec rewrite. */
function buildAIPrompt(spec: SpecBlock, entries: Array<{ id: string; entry: VEntry | REntry; kind: 'value' | 'resource' }>): string {
  const planTitle = spec.name ?? '(unnamed plan)'
  const planContext = [
    spec.stakes ? `Stakes: ${spec.stakes.slice(0, 800)}` : '',
    spec.ends   ? `Ends: ${spec.ends.slice(0, 800)}`     : '',
    spec.means  ? `Means: ${spec.means.slice(0, 800)}`   : '',
  ].filter(Boolean).join('\n')

  const entriesBlock = entries.map(e => {
    const ent = e.entry
    const lines = [
      `### ${e.id} (${e.kind.toUpperCase()})`,
      `Description: ${ent.description ?? ''}`,
      `Scale: ${(ent as VEntry).scale ?? (ent as REntry).scale ?? ''}`,
      `Meter: ${(ent as VEntry).meter ?? (ent as REntry).meter ?? ''}`,
    ]
    return lines.filter(Boolean).join('\n')
  }).join('\n\n')

  return `You are a Planguage Qualifier consultant.  The planner has a spec for the plan titled "${planTitle}".  Your task: for EACH listed scalar entry below, propose a default ConditionSet — a triplet of Qualifiers (time / place / event) that bound the scope of the entry's measurement.  These defaults will populate Round 1 of Stage 3.3 Add Qualifiers; the planner edits in Round 2.

${CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT}

## Plan context (use to ground each entry's qualifiers):
${planContext}

## Scalar entries (one ConditionSet per entry):
${entriesBlock}

## Output schema — return ONLY this JSON, no prose:
{
  "conditionSets": [
    {
      "entryId": "V.OrR.Id",
      "set": {
        "id": "V.OrR.Id.defaultSet",
        "tag": "Mnemonic.Tag.For.Set",
        "critical": false,
        "qualifiers": [
          { "tag": "Q1.2026",          "classification": "time",  "value": "January-March 2026" },
          { "tag": "EU.PrimaryMarket", "classification": "place", "value": "EU primary market" },
          { "tag": "NormalOps",        "classification": "event", "value": "normal operating conditions, no incident active" }
        ],
        "rationale": "Why these qualifiers fit this entry per plan context",
        "source": "derived-from-plan"
      }
    }
  ]
}

Generate EXACTLY ${entries.length} ConditionSet(s), one per entry above.  Tags are 1-3-word mnemonic (per Planguage ID Standard) — concrete and entry-relevant, NOT generic ("CurrentYear" is bad; "Q1.2026.LaunchWindow" is good).  Mark critical=true ONLY for entries where the spec context names a life-safety or mission-critical concern.`
}

/** Parse the AI response into a Map<entryId, ConditionSet>. */
function parseAIResponse(rawText: string): Map<string, ConditionSet> {
  const out = new Map<string, ConditionSet>()
  const jsonStart = rawText.indexOf('{')
  const jsonEnd   = rawText.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < 0) return out
  const slice = rawText.slice(jsonStart, jsonEnd + 1)
  try {
    const parsed = JSON.parse(slice) as { conditionSets?: Array<{ entryId: string; set: ConditionSet }> }
    if (!Array.isArray(parsed.conditionSets)) return out
    for (const { entryId, set } of parsed.conditionSets) {
      if (!entryId || !set) continue
      const qualifiers: PlanguageQualifier[] = Array.isArray(set.qualifiers)
        ? set.qualifiers.map(q => ({
            tag:            q.tag ?? '',
            classification: (q.classification === 'time' || q.classification === 'place' || q.classification === 'event') ? q.classification : 'time',
            value:          q.value ?? '',
            rationale:      q.rationale,
          }))
        : []
      out.set(entryId, {
        id:         set.id ?? `${entryId}.defaultSet`,
        tag:        set.tag ?? `${entryId}.Defaults`,
        critical:   !!set.critical,
        qualifiers,
        rationale:  set.rationale,
        source:     'derived-from-plan',
      })
    }
  } catch {
    // Parse failure — caller sees error state.
  }
  return out
}

export interface UseAddQualifiersReturn {
  /** Per-entry defaults map — `mechanical` populates instantly, `ai` overwrites
   *  per-entry as the AI analysis completes. */
  defaults: Ref<Map<string, ConditionSet>>
  /** True while the AI analysis is running. */
  isAIRefining: Ref<boolean>
  /** Seconds elapsed in the current AI call (drives PlanguageProgressWindow). */
  aiElapsed: Ref<number>
  /** Last AI error message — empty when none. */
  aiError: Ref<string>
  /** Source of each entry's default — 'mechanical' (pre-AI) or 'ai' (post-AI refinement). */
  defaultSource: Ref<Map<string, 'mechanical' | 'ai'>>
  /** Count of entries that have been AI-refined (UI progress signal). */
  refinedCount: Ref<number>
  /** Total scalar entries needing qualifiers. */
  totalCount: Ref<number>
  /** Kick off Round 1: populates mechanical defaults instantly, then fires AI in background. */
  startRound1: () => Promise<void>
  /** Round 2: edit a specific entry's set (planner-driven, not automatic). */
  updateSet: (entryId: string, updated: ConditionSet) => void
  /** Cancel an in-flight AI call. */
  cancelAI: () => void
  /** Reset all state for a fresh round. */
  reset: () => void
}

export function useAddQualifiers(spec: Ref<SpecBlock | null | undefined>): UseAddQualifiersReturn {
  const defaults = ref<Map<string, ConditionSet>>(new Map())
  const defaultSource = ref<Map<string, 'mechanical' | 'ai'>>(new Map())
  const isAIRefining = ref(false)
  const aiElapsed = ref(0)
  const aiError = ref('')
  let _timer: number | null = null
  let _abort: AbortController | null = null

  const totalCount = computed<number>(() => listScalarEntries(spec.value).length)
  const refinedCount = computed<number>(() => {
    let n = 0
    for (const src of defaultSource.value.values()) if (src === 'ai') n++
    return n
  })

  async function startRound1(): Promise<void> {
    if (!spec.value) { aiError.value = 'No spec loaded.'; return }
    // 1. Instant mechanical defaults — visible the moment 3.3 opens.
    const mech = buildMechanicalDefaults(spec.value)
    defaults.value = new Map(mech)
    const srcMap = new Map<string, 'mechanical' | 'ai'>()
    for (const id of mech.keys()) srcMap.set(id, 'mechanical')
    defaultSource.value = srcMap

    if (totalCount.value === 0) {
      aiError.value = 'No Values or Resources in this spec yet.  Generate them at Stages 1.4 / 1.5 first.'
      return
    }

    // 2. Kick off AI refinement in background.
    isAIRefining.value = true
    aiError.value = ''
    aiElapsed.value = 0
    if (_timer !== null) clearInterval(_timer)
    _timer = window.setInterval(() => { aiElapsed.value++ }, 1000)
    _abort = new AbortController()
    try {
      const entries = listScalarEntries(spec.value).map(e => ({ id: e.id, entry: e.entry, kind: e.kind }))
      const client = getClient()
      const prompt = buildAIPrompt(spec.value, entries)
      const resp = await client.messages.create(
        {
          model: MODEL_ID,
          max_tokens: 6144,
          messages: [{ role: 'user', content: prompt }],
        },
        { signal: _abort.signal },
      )
      const text = resp.content
        .map((c: { type: string; text?: string }) => (c.type === 'text' ? (c.text ?? '') : ''))
        .join('\n')
      const aiMap = parseAIResponse(text)
      // Merge: AI sets OVERWRITE mechanical for matched entryIds.
      const merged = new Map(defaults.value)
      const newSrc = new Map(defaultSource.value)
      for (const [entryId, set] of aiMap) {
        merged.set(entryId, set)
        newSrc.set(entryId, 'ai')
      }
      defaults.value = merged
      defaultSource.value = newSrc
      if (aiMap.size === 0) {
        aiError.value = 'AI response could not be parsed.  Mechanical defaults remain — edit in Round 2.'
      }
    } catch (e) {
      const msg = (e instanceof Error) ? e.message : String(e)
      if (msg.includes('aborted')) aiError.value = 'AI refinement cancelled.  Mechanical defaults remain.'
      else                          aiError.value = `AI call failed: ${msg}.  Mechanical defaults remain.`
    } finally {
      isAIRefining.value = false
      if (_timer !== null) { clearInterval(_timer); _timer = null }
      _abort = null
    }
  }

  function updateSet(entryId: string, updated: ConditionSet): void {
    const m = new Map(defaults.value)
    m.set(entryId, updated)
    defaults.value = m
    // Edits flip the source to 'ai' (planner-edited = no longer mechanical).
    const s = new Map(defaultSource.value)
    s.set(entryId, 'ai')
    defaultSource.value = s
  }

  function cancelAI(): void {
    if (_abort) _abort.abort()
  }

  function reset(): void {
    defaults.value = new Map()
    defaultSource.value = new Map()
    isAIRefining.value = false
    aiElapsed.value = 0
    aiError.value = ''
    if (_timer !== null) { clearInterval(_timer); _timer = null }
    if (_abort) _abort.abort()
    _abort = null
  }

  return {
    defaults,
    defaultSource,
    isAIRefining,
    aiElapsed,
    aiError,
    refinedCount,
    totalCount,
    startRound1,
    updateSet,
    cancelAI,
    reset,
  }
}
