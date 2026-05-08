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
    hint: 'novel or creative alternatives, disruption potential, differentiation, unconventional approaches, moonshot options',
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
   * F: description, successCriteria
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

/**
 * Flat list of all entry IDs that were added or modified across any
 * sharpening round. Used by SpecOutput to show the 🔪 badge.
 */
const _sharpenedEntryIds = ref<string[]>([])

// ── Helpers ───────────────────────────────────────────────────────────────

function _getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 90_000 })
}

/** Strip Markdown code fences from an LLM response before JSON.parse(). */
function _stripFences(text: string): string {
  return text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
}

/** Serialise a SpecBlock to a compact readable text for the AI prompt. */
function _specToText(spec: SpecBlock): string {
  const lines: string[] = []
  for (const f of spec.functions) {
    lines.push(`F. ${f.id}: ${f.description}`)
    lines.push(`   Success criteria: ${f.successCriteria}`)
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
      fields: { description: f.description, successCriteria: f.successCriteria ?? '' },
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
      description:     f.description,
      successCriteria: f.successCriteria ?? '',
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
- Output ONLY a valid JSON array — no prose, no numbering, no code fences
- Each element must match: { "text": "...", "suggestions": ["...", "...", "..."] }
- Example: [{"text": "What is the maximum budget envelope?", "suggestions": ["Under £10K", "£10K–£50K", "No hard limit yet"]}, ...]`

    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from AI')

    const parsed = JSON.parse(_stripFences(textBlock.text)) as unknown[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
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
export async function submitSharpenAnswers(spec: SpecBlock, answers: string[]): Promise<SpecBlock | null> {
  if (!_currentCategory.value) return null
  const category = _currentCategory.value

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

    const qa = _currentQuestions.value
      .map((q, i) => `Q: ${q.text}\nA: ${(answers[i] ?? '').trim() || '(no answer provided)'}`)
      .join('\n\n')

    const prompt = `You are a Planguage spec sharpener. Update the following Planguage specification by incorporating new information revealed by a ${category.label} sharpening interview.

Current spec:
${specText}

Sharpening dimension: ${category.label}
Dimension focus: ${category.hint}

Planner's answers:
${qa}

Rules for the updated spec:
1. Return ONLY a valid JSON object — no markdown code fences, no prose.
2. Match this TypeScript interface exactly:
{
  "functions": [ /* FEntry[] */ ],
  "values":    [ /* VEntry[] */ ],
  "solutions": [ /* SEntry[] */ ]
}
Where:
FEntry  { id, type, level, description, successCriteria, functionOfValue }
VEntry  { id, type, level, description, scale, meter, status, tolerable, goal, valueOfFunction }
SEntry  { id, type, level, description, impact, function }
3. Sharpen the spec: update, add, or refine entries to incorporate the ${category.label} insights.
4. Preserve all existing entries unless the answers directly indicate they should be updated.
5. All five V. measurement fields (scale, meter, status, tolerable, goal) must remain populated and non-empty.
6. F.successCriteria must remain a binary capability test — what the system does, not how well. No numbers or percentages in successCriteria.
7. Keep id values stable unless a rename is clearly warranted by the content change.
8. If the answers reveal a new F./V./S. entry is needed, add it with a consistent id.`

    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from AI')

    const refined = JSON.parse(_stripFences(textBlock.text)) as SpecBlock

    // Validate minimal structure
    if (!Array.isArray(refined.functions) || !Array.isArray(refined.values) || !Array.isArray(refined.solutions)) {
      throw new Error('Refined spec is missing required arrays')
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
    _error.value = err instanceof Error ? err.message : 'Failed to sharpen spec — please retry'
    _phase.value = 'answering'   // allow retry without losing answers
    return null
  } finally {
    _loading.value = false
  }
}

/** Cancel the current sharpening round without discarding completed rounds. */
export function cancelSharpen(): void {
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
    SHARPEN_CATEGORIES,
    startSharpen,
    submitSharpenAnswers,
    cancelSharpen,
    resetSharpen,
  }
}
