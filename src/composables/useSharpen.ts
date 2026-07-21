// UNIT_TYPE=Hook
// useSharpen — Sharpening Cycles composable
// After an initial spec is generated, the planner can iterate through
// targeted sharpening dimensions (Finance, Constraints, etc.) until the
// spec is considered "sharp enough" to proceed to Evo planning.
//
// Architecture: module-level shared state so the same sharpen session is
// visible from both the inline SharpenPanel (Stage 1) and the nav-bar
// SharpenDropdown (stages 2+). Mirrors the singleton pattern in useSpeaker.

import Anthropic from '@anthropic-ai/sdk'
import { ref, readonly } from 'vue'
import { MODEL_ID } from '../config/llm'
import { CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT } from '../config/planguagePrompt'
import type { SpecBlock } from '../types/spec'

// ── Category definitions ───────────────────────────────────────────────────

export interface SharpenCategory {
  key: string
  emoji: string
  label: string
  /** The dimension hint passed to the AI to focus its questions and refinements. */
  hint: string
}

export const SHARPEN_CATEGORIES: SharpenCategory[] = [
  {
    key: 'finance',
    emoji: '💰',
    label: 'Finance',
    hint: 'costs, ROI, budget envelope, revenue impact, financial trade-offs, payback period',
  },
  {
    key: 'constraints',
    emoji: '🚧',
    label: 'Constraints',
    hint: 'technical limits, legal/regulatory boundaries, resource caps, hard dependencies, things we cannot change',
  },
  {
    key: 'time',
    emoji: '⏳',
    label: 'Time Horizons',
    hint: 'short-term milestones (weeks), mid-term phases (quarters), long-term vision (years), deadlines, phasing',
  },
  {
    key: 'aspects',
    emoji: '🧩',
    label: 'Aspects',
    hint: 'Where (geography/scope), Who (actors/users), What (deliverables/outputs), If (conditions/triggers), How (mechanism/approach)',
  },
  {
    key: 'systems',
    emoji: '🏗️',
    label: 'Systems Level',
    hint: 'dependencies on other systems, integrations, ecosystem effects, architectural trade-offs, upstream/downstream impacts',
  },
  {
    key: 'innovative',
    emoji: '💡',
    label: 'Innovative',
    hint: 'novel or creative alternatives that COMPLY with all existing constraints; disruption potential, differentiation, unconventional approaches, moonshot options — but only ones achievable within the C. entries already in the spec; name specific technologies, vendors, or mechanisms the planner has not yet considered',
  },
  {
    key: 'competitive',
    emoji: '⚔️',
    label: 'Competitive',
    hint: 'market position, rival approaches, unique advantages, what competitors do/cannot do, differentiation claims',
  },
  {
    key: 'stakeholders',
    emoji: '👥',
    label: 'Stakeholders',
    hint: 'who is affected, who decides, who wins, who might resist, hidden or overlooked stakeholders, power dynamics',
  },
  {
    key: 'risks',
    emoji: '⚠️',
    label: 'Risks',
    hint: 'failure modes, key assumptions that must hold, mitigations, worst-case scenarios, what would make this fail',
  },
  {
    key: 'metrics',
    emoji: '📊',
    label: 'Metrics',
    hint: 'measurement rigour, KPI gaps, harder or more specific scale/meter definitions, baselines, leading vs lagging indicators',
  },
  {
    key: 'usability',
    emoji: '🖐️',
    label: 'Usability',
    hint: 'user experience, cognitive load, task flow, accessibility (WCAG), onboarding friction, error recovery, interaction clarity, mobile usability, mental models, first-use success rate, learnability, satisfaction, discoverability, screen-reader support',
  },
  {
    key: 'security',
    emoji: '🔒',
    label: 'Security',
    hint: 'authentication, authorisation, data privacy, threat surfaces, input validation, injection risks, secrets management, audit trails, encryption at rest and in transit, OWASP top 10, compliance requirements (GDPR, SOC2), breach scenarios, least-privilege principle, dependency vulnerabilities',
  },
  {
    key: 'teamwork',
    emoji: '🤝',
    label: 'Teamwork',
    hint: 'mob programming potential, parallel workstreams, role clarity, knowledge silos, pair-work opportunities, review gates, communication overhead, dependency blocking, collective ownership, onboarding new contributors, bus-factor reduction, asynchronous collaboration, decision-making authority',
  },
  {
    key: 'visualise',
    emoji: '🗺️',
    label: 'Visualise',
    hint: '_modal_', // special key — SharpenPanel opens VisualisePanelModal directly, no AI call
  },
]

// ── Change tracking ────────────────────────────────────────────────────────

/** One entry that was added or modified by a sharpening round. */
export interface SharpenChangedEntry {
  id: string
  status: 'added' | 'modified'
  /** Entry type — used for colour-coding in the diff view. */
  entryType: 'F' | 'V' | 'S'
  /**
   * Field values captured from the spec AFTER sharpening.
   * F: description, presenceTest
   * V: description, scale, meter, tolerable, goal
   * S: description, impact
   */
  after: Record<string, string>
  /**
   * Field values captured BEFORE sharpening.
   * null for 'added' entries (no prior state exists).
   */
  before: Record<string, string> | null
  /**
   * Names of fields where before[field] !== after[field].
   * Empty for 'added' entries (all fields are new).
   */
  changedFields: string[]
}

/**
 * A sharpening question with AI-generated answer suggestions.
 * Suggestions are short option phrases (≤10 words) the planner can click to
 * pre-fill their answer textarea — they are helpful starting points, not
 * exhaustive. The planner may still type a free-form answer.
 */
export interface SharpenQuestion {
  text: string
  suggestions: string[]
}

// ── Shared state ──────────────────────────────────────────────────────────

export type SharpenPhase = 'idle' | 'questions' | 'answering' | 'refining'

export interface SharpenRound {
  category: SharpenCategory
  questions: SharpenQuestion[]
  answers: string[]
  /** Entries added or modified by this round (populated after submitSharpenAnswers). */
  changes: SharpenChangedEntry[]
}

const _phase            = ref<SharpenPhase>('idle')
const _currentCategory  = ref<SharpenCategory | null>(null)
const _currentQuestions = ref<SharpenQuestion[]>([])
const _rounds           = ref<SharpenRound[]>([])
const _loading          = ref(false)
const _error            = ref('')

/** Loading state for the open-question answer-fetch sub-flow. */
const _openQLoading = ref(false)
const _openQError   = ref('')

/** Loading / error state for the planner-suggestion action sub-flow. */
const _plannerActionLoading = ref(false)
const _plannerActionError   = ref('')

/**
 * Flat list of all entry IDs that were added or modified across any
 * sharpening round. Used by SpecOutput to show the 🔪 badge.
 */
const _sharpenedEntryIds = ref<string[]>([])

/**
 * Active AbortController for the in-flight LLM fetch.
 * Replaced on every startSharpen call; aborted by cancelSharpen().
 */
let _abortController: AbortController | null = null

// ── Helpers ───────────────────────────────────────────────────────────────

function _getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
  if (!apiKey && !isLocal) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 90_000 })
}

/**
 * Extract and parse a JSON value from an LLM response.
 * Handles: direct JSON, markdown code fences, prose prefix/suffix wrapping the JSON.
 * Tries {…} object extraction first, then […] array extraction as fallback.
 * Mirrors the robust extractor in useEvoPlannerAPI.ts.
 */
function _extractJson<T>(text: string): T {
  // 1. Strip fences and try direct parse
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(stripped) as T } catch { /* fall through */ }
  // 2. Try the original trimmed text (no fences to strip)
  try { return JSON.parse(text.trim()) as T } catch { /* fall through */ }
  // 3. Extract first {...} block (object responses)
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (objMatch) { try { return JSON.parse(objMatch[0]) as T } catch { /* fall through */ } }
  // 4. Extract first [...] block (array responses)
  const arrMatch = stripped.match(/\[[\s\S]*\]/)
  if (arrMatch) { try { return JSON.parse(arrMatch[0]) as T } catch { /* fall through */ } }
  throw new Error(`LLM response is not valid JSON:\n${text.slice(0, 300)}`)
}

/** Serialise a SpecBlock to a compact readable text for the AI prompt. */
function _specToText(spec: SpecBlock): string {
  const lines: string[] = []
  for (const f of spec.functions) {
    lines.push(`F. ${f.id}: ${f.description}`)
    lines.push(`   Presence test: ${f.presenceTest || f.successCriteria || ''}`)
  }
  for (const v of spec.values) {
    lines.push(`V. ${v.id}: ${v.description}`)
    lines.push(`   Scale: ${v.scale}`)
    lines.push(`   Meter: ${v.meter}`)
    lines.push(`   Tolerable: ${v.tolerable}  Goal: ${v.goal}`)
  }
  for (const s of spec.solutions) {
    lines.push(`S. ${s.id}: ${s.description}`)
    lines.push(`   Impact: ${s.impact}`)
  }
  for (const c of spec.constraints ?? []) {
    lines.push(`C. ${c.id}: ${c.description}`)
    if (c.scope)     lines.push(`   Scope: ${c.scope}`)
    if (c.rationale) lines.push(`   Rationale: ${c.rationale}`)
  }
  return lines.join('\n')
}

/**
 * Compute which entries were added or modified by comparing a before/after
 * pair of SpecBlocks. Captures full before/after field snapshots so the UI
 * can render a precise word-level diff for every changed field.
 */
function _diffToEntries(before: SpecBlock, after: SpecBlock): SharpenChangedEntry[] {
  // Build a map: id → { entryType, fields } from the BEFORE spec
  type BeforeEntry = { type: 'F' | 'V' | 'S'; fields: Record<string, string> }
  const beforeMap = new Map<string, BeforeEntry>()

  before.functions.forEach(f =>
    beforeMap.set(f.id, {
      type: 'F',
      fields: { description: f.description, presenceTest: f.presenceTest ?? f.successCriteria ?? '' },
    }),
  )
  before.values.forEach(v =>
    beforeMap.set(v.id, {
      type: 'V',
      fields: {
        description: v.description,
        scale:       v.scale,
        meter:       v.meter,
        tolerable:   v.tolerable,
        goal:        v.goal,
      },
    }),
  )
  before.solutions.forEach(s =>
    beforeMap.set(s.id, {
      type: 'S',
      fields: { description: s.description, impact: s.impact ?? '' },
    }),
  )

  const entries: SharpenChangedEntry[] = []

  function _check(
    id: string,
    entryType: 'F' | 'V' | 'S',
    afterFields: Record<string, string>,
  ): void {
    const prior = beforeMap.get(id)
    if (!prior) {
      // Brand-new entry — no before state
      entries.push({ id, status: 'added', entryType, after: afterFields, before: null, changedFields: [] })
      return
    }
    // Existing entry — compare field by field
    const changedFields = Object.keys(afterFields).filter(
      key => (prior.fields[key] ?? '') !== (afterFields[key] ?? ''),
    )
    if (changedFields.length > 0) {
      entries.push({
        id, status: 'modified', entryType,
        after: afterFields, before: prior.fields, changedFields,
      })
    }
  }

  after.functions.forEach(f =>
    _check(f.id, 'F', {
      description: f.description,
      presenceTest: f.presenceTest ?? f.successCriteria ?? '',
    }),
  )
  after.values.forEach(v =>
    _check(v.id, 'V', {
      description: v.description,
      scale:       v.scale,
      meter:       v.meter,
      tolerable:   v.tolerable,
      goal:        v.goal,
    }),
  )
  after.solutions.forEach(s =>
    _check(s.id, 'S', {
      description: s.description,
      impact:      s.impact ?? '',
    }),
  )

  return entries
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Ask the AI to generate 3–5 targeted questions for the chosen sharpening
 * dimension.  Sets phase → 'questions' during the call, 'answering' on success.
 */
export async function startSharpen(spec: SpecBlock, category: SharpenCategory): Promise<void> {
  // r41 v225 (Tom Gilb 2026-06-19 verbatim "i selected sharp innovative and it
  // did not do it, bug, it circle back to sharpen, fix bug") — the previous
  // concurrency guard SILENTLY returned when phase was not 'idle' (e.g. user
  // was mid-answering from a prior category, or a stuck/orphaned phase from
  // a previous session).  Click → no-op → user sees nothing change → looks
  // exactly like "circles back to sharpen".  Fix: HONOR the new click.
  // Abort whatever is in-flight, reset phase to idle, clear questions, and
  // proceed with the new category.  The planner's most recent click wins.
  // Composes with: MOVE Principle (no silent UI), No-Dodging-Ambiguous-Bugs
  // SUPREME (silent-return = ambiguous bug class — banked under the same rule
  // that caught the v201 / v213 auto-emit "modal closed before grid rendered"
  // failure mode), Universal Undo SUPREME (Apply-on-Sharpen is undoable so
  // aborting a round in progress is safe).
  if (_phase.value !== 'idle' || _loading.value) {
    // Cancel previous fetch + reset state so the new round starts clean.
    _abortController?.abort()
    _loading.value = false
    _phase.value = 'idle'
    _currentQuestions.value = []
    // Allow Vue a tick to render the reset before continuing.
    await new Promise<void>((r) => setTimeout(r, 0))
  }

  // Cancel any previous in-flight fetch before starting a new one
  _abortController?.abort()
  _abortController = new AbortController()
  const signal = _abortController.signal

  _loading.value = true
  _error.value = ''
  _currentCategory.value = category
  _phase.value = 'questions'
  _currentQuestions.value = []

  try {
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise((r) => setTimeout(r, 800))
      _currentQuestions.value = [
        {
          text: `What is the budget envelope for "${category.label}" considerations?`,
          suggestions: ['Under £10K', '£10K–£50K', 'No hard limit yet', 'To be defined next sprint'],
        },
        {
          text: `Are there any hard constraints from a ${category.label} perspective?`,
          suggestions: ['Regulatory compliance required', 'Fixed deadline, no flex', 'No hard constraints yet'],
        },
        {
          text: `What would success look like specifically for the ${category.label} dimension?`,
          suggestions: ['Measurable KPI hit within 90 days', 'Stakeholder sign-off', 'Zero regressions on existing users'],
        },
      ]
      _phase.value = 'answering'
      return
    }

    const client = _getClient()
    const specText = _specToText(spec)

    // NOTE: response_format: json_object (enforced by ollamaAdapter) requires the
    // model to output a JSON *object*, not a bare array. Wrapping the questions
    // array inside {"questions":[…]} satisfies that constraint and prevents
    // llama-family models from entering a generation loop when asked for a bare [].
    const prompt = `You are a Planguage spec sharpener. A planner has a Planguage specification and wants to sharpen it by exploring the "${category.label}" dimension.

Current spec:
${specText}

Dimension to sharpen: ${category.label}
Focus on: ${category.hint}

Generate exactly 3–5 concise, targeted questions to help sharpen this spec's ${category.label} aspects.
For each question, also provide 3–4 short answer suggestions (≤10 words each) that represent plausible options a planner might choose.

Rules:
- Questions must be SPECIFIC to this spec's content, not generic boilerplate
- Each question must probe something currently vague, missing, or under-specified
- Ask about real decisions, not obvious things already stated
- Keep each question under 20 words
- Suggestions should be realistic option phrases — helpful starting points, not exhaustive lists
- CONSTRAINT AWARENESS — existing C. entries in the spec are hard, non-negotiable boundaries. Do NOT ask about or suggest approaches in your question suggestions that would violate any C. entry. The planner already decided those limits; asking them to reconsider a constraint is out of scope here.
- Output ONLY a valid JSON object — no prose, no code fences:
{"questions":[{"text":"...","suggestions":["...","...","..."]}]}
- Example: {"questions":[{"text":"What is the maximum budget envelope?","suggestions":["Under £10K","£10K–£50K","No hard limit yet"]}]}`

    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      signal,
    })

    // Bail out silently if cancelled while the fetch was in flight
    if (signal.aborted) return

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from AI')

    // Accept {"questions":[…]} wrapper (preferred — works with json_object mode)
    // or a bare array (legacy graceful fallback).
    const raw = _extractJson<unknown>(textBlock.text)
    const parsed: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as Record<string, unknown>)?.questions)
        ? (raw as Record<string, unknown>).questions as unknown[]
        : []
    if (parsed.length === 0) {
      throw new Error('AI returned an unexpected format for questions')
    }
    // Normalise: accept both {text, suggestions} objects and bare strings (graceful fallback)
    const questions: SharpenQuestion[] = parsed.map((item) => {
      if (typeof item === 'string') return { text: item, suggestions: [] }
      const q = item as { text?: string; suggestions?: string[] }
      return { text: q.text ?? String(item), suggestions: Array.isArray(q.suggestions) ? q.suggestions : [] }
    })
    _currentQuestions.value = questions
    _phase.value = 'answering'
  } catch (err) {
    // AbortError means cancelSharpen() fired — don't overwrite phase or show an error
    if (err instanceof Error && err.name === 'AbortError') return
    _error.value = err instanceof Error ? err.message : 'Failed to generate sharpening questions'
    _phase.value = 'idle'
  } finally {
    _loading.value = false
  }
}

/**
 * Submit the planner's answers and ask the AI to refine the spec accordingly.
 * Returns the updated SpecBlock on success, null on error.
 * Automatically records the completed round (with change tracking) in _rounds.
 */
/**
 * An extra question-answer pair contributed by the open-question sub-flow.
 * Appended verbatim to the QA block sent to the refining prompt.
 */
export interface ExtraQAPair {
  question: string
  answer: string
}

export async function submitSharpenAnswers(
  spec: SpecBlock,
  answers: string[],
  extraQA?: ExtraQAPair[],
): Promise<SpecBlock | null> {
  if (!_currentCategory.value) return null
  const category = _currentCategory.value

  // r41 v410 (Tom Gilb 2026-06-28 verbatim "it goes in a loop of risks even
  // after I say enough" with screenshot of Stage 2 SharpenPanel showing
  // *"Updating your plan with 1 Risks insight... (step 2 of 2) ~82% · ~4s
  // remaining"* progress bar that wouldn't stop on either "Sharp Enough"
  // or "Cancel round" click).  Trace-Before-Patch SUPREME diagnosis: the
  // refining `client.messages.create()` call was NOT receiving the abort
  // signal — compare with `startSharpen()` at line 422 which DOES pass
  // `signal`.  Result: `cancelSharpen()` aborted the controller, but the
  // refining fetch was completely unbound from it; the fetch ran to
  // completion (60-180 s on Sonnet), pushed a round into `_rounds`, and
  // the progress bar kept showing "Updating your plan with N Risks
  // insights" because nothing changed `phase.value` from 'refining'.
  // Tom saw a never-stopping bar and called it a "loop of risks" —
  // because every time the orphaned fetch finally completed, another
  // round could start (or appear to start) before the panel state
  // re-synced.  Fix: reuse the SAME `_abortController` that `startSharpen`
  // already created — bind its signal to this fetch + check
  // `signal.aborted` after the await + treat AbortError as a silent
  // bail-out + restore phase to 'idle' on cancellation.  Composes with:
  // Trace-Before-Patch SUPREME (the single missing `signal` param is the
  // textbook one-line cause behind a "loop" symptom — patching the loop
  // itself would have missed it) + Tom-Repeats-Himself SUPREME (v225
  // banked the "circles back to sharpen" pattern in `startSharpen`; this
  // is the same shape — cancel that doesn't actually cancel — at the
  // refining sibling) + No-Silent-Data-Loss SUPREME (the planner's
  // implicit "stop now" intent must be honoured — silent fetch-keeps-
  // running is the same trust violation as silent data drop) + MOVE
  // Principle (Cancel round + Sharp Enough are visible affordances; they
  // must actually do what they claim).
  const _signal = _abortController?.signal

  _loading.value = true
  _error.value = ''
  _phase.value = 'refining'

  try {
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise((r) => setTimeout(r, 1000))
      // Mock: no spec changes, record empty changes
      _rounds.value.push({ category, questions: _currentQuestions.value, answers, changes: [] })
      _phase.value = 'idle'
      _currentCategory.value = null
      _currentQuestions.value = []
      return spec   // mock: return unchanged spec
    }

    const client = _getClient()
    const specText = _specToText(spec)

    const mainQA = _currentQuestions.value
      .map((q, i) => `Q: ${q.text}\nA: ${(answers[i] ?? '').trim() || '(no answer provided)'}`)
      .join('\n\n')
    const extraQAText = (extraQA ?? [])
      .map(pair => `Q: ${pair.question}\nA: ${pair.answer}`)
      .join('\n\n')
    const qa = [mainQA, extraQAText].filter(s => s.trim()).join('\n\n')

    // r41 v271 (Tom Gilb 2026-06-21 "sweep the rest"): canonical primer imported.
    // This prompt UPDATES Planguage entries based on sharpening Q&A — so the
    // full Planguage discipline (F-vs-Meter, V-parameter-rich, Solution
    // 26-parameter, Qualifier framework, Infinity Trap, etc.) flows in
    // automatically rather than being hand-rolled per prompt.
    const prompt = `You are a Planguage spec sharpener.

== SPEC-SHARPENING INPUT FORMAT (input shape for this caller) ==
You are given an existing Planguage SPEC plus the planner's ANSWERS from a
${category.label} sharpening interview. Update the spec by incorporating the
new information revealed by those answers — preserving every existing entry,
sharpening fields with new specifics, and adding any newly-revealed entries.

Current spec:
${specText}

Sharpening dimension: ${category.label}
Dimension focus: ${category.hint}

Planner's answers:
${qa}

${CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT}

== SPEC-SHARPENING SPECIFIC RULES ==
1. Return ONLY a valid JSON object — no markdown code fences, no prose.
2. Output EXACTLY this JSON shape — three arrays:
{
  "functions": [ /* FEntry[] — return ALL existing entries, never drop one */ ],
  "values":    [ /* VEntry[] — return ALL existing entries, never drop one */ ],
  "solutions": [ /* SEntry[] — return ALL existing entries, never drop one; ≥1 required */ ]
}
3. Do NOT include a "constraints" key — constraints are managed separately and preserved automatically.
4. CRITICAL — Preserve ALL existing F., V., and S. entries. Only update specific fields the planner's answers directly improve. Never remove an entry.
5. CRITICAL — Constraints are HARD REQUIREMENTS. Every C. entry in the spec above is a non-negotiable boundary. Every S. entry you write MUST comply with ALL C. entries. Do NOT generate any solution that violates a constraint — even as an option or note.
6. Keep id values stable unless a rename is clearly warranted by content change (still per canonical id mnemonic discipline above).
7. For the ${category.label} dimension specifically: drive SPECIFIC, NAMED outputs. If the planner names a technology, vendor, mechanism, or approach, incorporate that exact thing by name into the relevant entry.`

    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
      signal: _signal,    // r41 v410 — bind to the abort controller startSharpen created
    })

    // r41 v410 — Bail out silently if cancelSharpen() fired while the fetch was
    // in flight (matches the established startSharpen pattern at line 430).
    if (_signal?.aborted) return null

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from AI')

    const refined = _extractJson<SpecBlock>(textBlock.text)

    // Validate minimal structure
    if (!Array.isArray(refined.functions) || !Array.isArray(refined.values) || !Array.isArray(refined.solutions)) {
      throw new Error('Refined spec is missing required arrays')
    }

    // Robustness guards — the sharpen prompt only asks for F/V/S.
    // If the LLM returns empty arrays for critical entry types, fall back to the
    // original rather than producing a plan that the Evo Planner will reject.
    //
    // Functions: empty is permitted (constraint-only specs) — keep as-is.
    // Solutions: empty is a problem (Evo Planner requires ≥1 S. entry).
    //   Fall back to original solutions and warn so the user knows why.
    // Values:    empty is unusual but survivable — keep as-is.
    if (refined.solutions.length === 0 && spec.solutions.length > 0) {
      console.warn('[useSharpen] Sharpen returned 0 solutions — falling back to original solutions. ' +
        'The sharpening dimension may have caused the LLM to drop S. entries. ' +
        'Review the sharpened spec before planning.')
      refined.solutions = spec.solutions
    }

    // Constraints — the sharpen prompt never asks the LLM to return C. entries,
    // so the refined spec always lacks a constraints array.  Carry the original
    // constraints forward so they are not silently dropped after every sharpen round.
    if (!Array.isArray(refined.constraints) || refined.constraints.length === 0) {
      refined.constraints = spec.constraints ?? []
    }

    // Normalise level field — local LLM often writes "high"/"medium"/"low" instead
    // of Planguage scope levels.  Coerce any invalid value to "Product".
    const VALID_LEVELS = new Set(['Business', 'Stakeholder', 'Product', 'Solution', 'Evo', 'To-Do', 'Personal'])
    for (const entry of [...refined.functions, ...refined.values, ...refined.solutions] as Array<Record<string, unknown>>) {
      if (typeof entry.level !== 'string' || !VALID_LEVELS.has(entry.level)) entry.level = 'Product'
    }

    // Compute which entries changed
    const changes = _diffToEntries(spec, refined)

    // Record this round
    _rounds.value.push({ category, questions: _currentQuestions.value, answers, changes })

    // Update the global list of sharpened entry IDs (deduplicated)
    const changedIds = changes.map((c) => c.id)
    const existing = new Set(_sharpenedEntryIds.value)
    for (const id of changedIds) existing.add(id)
    _sharpenedEntryIds.value = [...existing]

    // Reset for the next round
    _phase.value = 'idle'
    _currentCategory.value = null
    _currentQuestions.value = []

    return refined
  } catch (err) {
    // r41 v410 — AbortError means cancelSharpen() fired mid-flight; silently
    // release phase to 'idle' (NOT 'answering') so the panel doesn't trap the
    // planner at the answers form for a retry they didn't ask for.  Matches
    // the established startSharpen AbortError handling at line 456.
    if (err instanceof Error && err.name === 'AbortError') {
      _phase.value = 'idle'
      _currentCategory.value = null
      _currentQuestions.value = []
      return null
    }
    _error.value = err instanceof Error ? err.message : 'Failed to sharpen spec — please retry'
    _phase.value = 'answering'   // allow retry without losing answers
    return null
  } finally {
    _loading.value = false
  }
}

/**
 * Fetch 3 AI-generated answer options for a planner's open critical question.
 * Called from the open-question sub-flow in SharpenPanel.
 * Pass `previousAnswers` when the planner clicks "suggest more" so the AI
 * avoids repeating options already shown.
 */
export async function fetchOpenAnswers(
  spec: SpecBlock,
  category: SharpenCategory,
  question: string,
  previousAnswers?: string[],
): Promise<string[]> {
  _openQLoading.value = true
  _openQError.value   = ''
  try {
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise(r => setTimeout(r, 700))
      return [
        `Define explicit acceptance criteria with all key stakeholders before starting.`,
        `Prototype fast, validate with real users within the first sprint.`,
        `Set a measurable baseline now so improvement is objectively trackable.`,
      ]
    }

    const client   = _getClient()
    const specText = _specToText(spec)
    const prevCtx  = previousAnswers && previousAnswers.length > 0
      ? `\n\nThe planner found these previously suggested answers unsatisfactory:\n${previousAnswers.map((a, i) => `${i + 1}. ${a}`).join('\n')}\nProvide 3 DIFFERENT and BETTER alternatives.`
      : ''

    const prompt = `You are a Planguage spec sharpener. A planner has asked a critical question about the "${category.label}" dimension of their specification.

Spec context:
${specText}

Dimension: ${category.label} — ${category.hint}

Planner's critical question: "${question}"${prevCtx}

Provide exactly 3 concise, specific, actionable answer options that directly address the question in the context of the spec above.

Rules:
- Each answer must be a complete, specific response — not a question or vague suggestion
- 1–2 sentences max per answer
- Make them concrete and directly applicable to this spec
- Do not repeat any previously shown answers

Return ONLY a JSON object matching exactly: {"answers":["...","...","..."]}`

    const response = await client.messages.create({
      model:      MODEL_ID,
      max_tokens: 512,
      messages:   [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from AI')

    const raw = _extractJson<unknown>(textBlock.text)
    const arr: string[] = Array.isArray((raw as Record<string, unknown>)?.answers)
      ? (raw as Record<string, unknown>).answers as string[]
      : Array.isArray(raw) ? raw as string[] : []
    if (arr.length === 0) throw new Error('AI returned no answer options')
    return arr.slice(0, 3)
  } catch (err) {
    _openQError.value = err instanceof Error ? err.message : 'Failed to get answer options'
    return []
  } finally {
    _openQLoading.value = false
  }
}

/**
 * What the planner wants the AI to do with their typed suggestion.
 *   analyze    — critique / strengths / gaps
 *   better-one — suggest one better alternative
 *   better-five — suggest five better alternatives
 *   sharper    — rewrite as a tighter Planguage statement
 */
export type PlannerSuggestionMode = 'analyze' | 'better-one' | 'better-five' | 'sharper'

/**
 * Run one of the four planner-suggestion AI actions.
 * Returns an array of result strings (1 for analyze/sharper/better-one, 5 for better-five).
 * Uses its own _plannerActionLoading / _plannerActionError refs so it never conflicts
 * with the main sharpening progress bar.
 */
export async function processPlannerSuggestion(
  spec: SpecBlock,
  category: SharpenCategory,
  question: string,
  suggestion: string,
  mode: PlannerSuggestionMode,
): Promise<string[]> {
  _plannerActionLoading.value = true
  _plannerActionError.value   = ''
  try {
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise(r => setTimeout(r, 700))
      if (mode === 'analyze') {
        return [`This suggestion addresses the ${category.label} dimension well. It would benefit from more specificity around measurable outcomes and a clear timeline. The core idea is sound but needs quantification to meet Planguage standards.`]
      }
      if (mode === 'sharper') {
        return [`${suggestion.trim()} — measured by [specific metric], with tolerable level [X] and goal level [Y], reviewed [cadence].`]
      }
      const count = mode === 'better-five' ? 5 : 1
      return Array.from({ length: count }, (_, i) =>
        `Alternative ${i + 1}: implement a measurable ${category.label} improvement with explicit acceptance criteria and a named owner.`,
      )
    }

    const client   = _getClient()
    const specText = _specToText(spec)
    const count    = mode === 'better-five' ? 5 : 1

    let prompt: string
    if (mode === 'analyze') {
      prompt = `You are a Planguage spec expert. Analyze the planner's suggestion in the context of a ${category.label} sharpening exercise.

Spec:
${specText}

Dimension: ${category.label} — ${category.hint}
Question asked: "${question}"
Planner's suggestion: "${suggestion}"

Write a concise analysis (3–5 sentences) covering:
- Strengths of the suggestion
- Gaps or risks that need addressing
- Whether it meets Planguage precision standards (measurable, specific, owned)

Return ONLY a JSON object: {"results":["<full analysis>"]}`

    } else if (mode === 'sharper') {
      prompt = `You are a Planguage spec expert. Rewrite the following planner suggestion as a sharper, more precise Planguage-style statement.

Spec:
${specText}

Dimension: ${category.label} — ${category.hint}
Original question: "${question}"
Original suggestion: "${suggestion}"

Rules:
- Preserve the intent exactly
- Make it measurable and specific (add scale/meter hints if missing)
- Add ownership or review cadence where appropriate
- Keep it to 1–2 sentences

Return ONLY a JSON object: {"results":["<sharpened statement>"]}`

    } else {
      // better-one or better-five
      prompt = `You are a Planguage spec expert. Suggest ${count} better alternative${count > 1 ? 's' : ''} to the planner's idea for the ${category.label} dimension.

Spec:
${specText}

Dimension: ${category.label} — ${category.hint}
Question: "${question}"
Planner's current suggestion: "${suggestion || '(none yet — generate fresh ideas)'}"

Provide ${count} alternative${count > 1 ? 's' : ''} that:
- Directly address the question
- Are more specific, measurable, or actionable than the original
- Follow Planguage precision (concrete, owned, time-bounded where possible)
- Are 1–2 sentences each

Return ONLY a JSON object: {"results":["...","..."]}`
    }

    const response = await client.messages.create({
      model:      MODEL_ID,
      max_tokens: mode === 'better-five' ? 1024 : 512,
      messages:   [{ role: 'user', content: prompt }],
    })
    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from AI')

    const raw = _extractJson<unknown>(textBlock.text)
    const arr: string[] = Array.isArray((raw as Record<string, unknown>)?.results)
      ? (raw as Record<string, unknown>).results as string[]
      : Array.isArray(raw) ? raw as string[] : []
    if (arr.length === 0) throw new Error('AI returned no results')
    return arr
  } catch (err) {
    _plannerActionError.value = err instanceof Error ? err.message : 'Failed to process suggestion'
    return []
  } finally {
    _plannerActionLoading.value = false
  }
}

/** Cancel the current sharpening round without discarding completed rounds. */
export function cancelSharpen(): void {
  // Abort any in-flight fetch so it cannot overwrite phase after cancellation
  _abortController?.abort()
  _abortController = null
  _phase.value = 'idle'
  _currentCategory.value = null
  _currentQuestions.value = []
  _loading.value = false
  _error.value = ''
}

/** Full reset — clears all rounds and change tracking. Call when a new spec is generated. */
export function resetSharpen(): void {
  cancelSharpen()
  _rounds.value = []
  _sharpenedEntryIds.value = []
}

// ── Composable export (readonly reactive state + functions) ────────────────

export function useSharpen() {
  return {
    phase:              readonly(_phase),
    currentCategory:    readonly(_currentCategory),
    /** Reactive list of SharpenQuestion objects (each has .text + .suggestions[]) */
    currentQuestions:   readonly(_currentQuestions),
    rounds:             readonly(_rounds),
    loading:            readonly(_loading),
    error:              readonly(_error),
    sharpenedEntryIds:  readonly(_sharpenedEntryIds),
    /** Loading state for the open-question answer-fetch sub-flow. */
    openQLoading:            readonly(_openQLoading),
    /** Error state for the open-question answer-fetch sub-flow. */
    openQError:              readonly(_openQError),
    /** Loading state for the planner-suggestion action sub-flow. */
    plannerActionLoading:    readonly(_plannerActionLoading),
    /** Error state for the planner-suggestion action sub-flow. */
    plannerActionError:      readonly(_plannerActionError),
    SHARPEN_CATEGORIES,
    startSharpen,
    submitSharpenAnswers,
    fetchOpenAnswers,
    processPlannerSuggestion,
    cancelSharpen,
    resetSharpen,
  }
}
