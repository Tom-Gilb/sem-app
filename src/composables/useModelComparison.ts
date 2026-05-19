// UNIT_TYPE=Hook
// useModelComparison — Multi-model comparison composable
//
// Two comparison modes:
//   1. Differences — analyse 2+ Plan Models across 8 diff criteria:
//      types · text · value levels · impact · sequences · financials · duration · effort
//   2. VDT — Value Decision Table where candidate models are the Solutions/Means columns
//      and a Planguage-defined Criteria Model's V entries are the evaluation rows.
//      Cells can be scored manually (click-to-edit) or auto-scored by AI in one call.
//
// Architecture: module-level singleton state (same pattern as useSharpen/useSpeaker).

import { ref, readonly } from 'vue'
import Anthropic from '@anthropic-ai/sdk'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock } from '../types/spec'
import type { PlanModel } from './usePlanModel'

// ── Diff criterion definitions ────────────────────────────────────────────────

export type DiffCriterion =
  | 'types'
  | 'text'
  | 'values'
  | 'impact'
  | 'sequences'
  | 'financials'
  | 'duration'
  | 'effort'

export interface DiffCriterionDef {
  key: DiffCriterion
  icon: string
  label: string
  description: string
}

export const DIFF_CRITERIA: DiffCriterionDef[] = [
  { key: 'types',      icon: '📐', label: 'Types',         description: 'F / V / S entry counts per model' },
  { key: 'text',       icon: '📝', label: 'Text',          description: 'Description differences for matching IDs' },
  { key: 'values',     icon: '⬆️', label: 'Value Levels',  description: 'Scale / meter / goal / tolerable changes' },
  { key: 'impact',     icon: '💥', label: 'Impact',        description: 'Solution impact statement differences' },
  { key: 'sequences',  icon: '🔢', label: 'Sequences',     description: 'Entry ordering / position changes' },
  { key: 'financials', icon: '💰', label: 'Financials',    description: 'Cost, budget, revenue-related entries' },
  { key: 'duration',   icon: '⏱️', label: 'Duration',      description: 'Time, deadline, schedule entries' },
  { key: 'effort',     icon: '💪', label: 'Effort',        description: 'Capacity, workload, resource entries' },
]

// ── Result types ──────────────────────────────────────────────────────────────

export interface ComparisonSlot {
  planModel: PlanModel
  /** Display label: "Name v0.3" */
  label: string
}

export interface TypeCountRow {
  type: string
  counts: number[]   // one per slot
  hasDiff: boolean
}

export interface TextDiffRow {
  id: string
  entryType: 'F' | 'V' | 'S'
  values: string[]   // description per slot (empty string if absent)
  hasDiff: boolean
}

export interface ValueDiffRow {
  id: string
  field: string      // e.g. "V.Uptime — goal"
  values: string[]   // field value per slot
  hasDiff: boolean
}

export interface SequenceRow {
  position: number
  entryIds: Array<string | null>  // entry ID at this position per slot (null = slot has fewer entries)
  hasDiff: boolean
}

export interface VDTScore {
  score: number        // 0–10
  rationale: string
  isWinner: boolean
}

export interface VDTRow {
  criterionId: string
  description: string
  scale: string
  goal: string
  scores: VDTScore[]  // one per candidate slot
  winnerIndex: number  // -1 if tied or all-zero
}

export interface VDTResult {
  rows: VDTRow[]
  modelLabels: string[]
  winCounts: number[]
  overallWinnerIndex: number
}

// ── Keyword lists for filtered diff criteria ──────────────────────────────────

const FINANCE_KW = ['cost', 'budget', 'revenue', 'roi', 'profit', 'spend', 'financial', 'price', 'fee', 'expense', 'fund', 'capital', 'cash', 'earning', 'invest', 'billing', 'monetary', 'rate']
const DURATION_KW = ['time', 'duration', 'deadline', 'week', 'month', 'day', 'quarter', 'year', 'date', 'timeline', 'schedule', 'period', 'phase', 'sprint', 'cycle', 'latency', 'response', 'elapsed', 'sla', 'frequency']
const EFFORT_KW   = ['effort', 'hour', 'capacity', 'workload', 'person', 'team', 'resource', 'bandwidth', 'task', 'complexity', 'skill', 'velocity', 'headcount', 'staff', 'developer', 'engineer', 'labour', 'labor']

function _hasKeyword(text: string, kw: string[]): boolean {
  const l = text.toLowerCase()
  return kw.some((k) => l.includes(k))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Union of all (id, entryType) pairs across a set of SpecBlocks. */
function _unionIds(specs: SpecBlock[]): { id: string; entryType: 'F' | 'V' | 'S' }[] {
  const seen = new Map<string, 'F' | 'V' | 'S'>()
  for (const spec of specs) {
    for (const f of spec.functions) seen.set(f.id, 'F')
    for (const v of spec.values)    seen.set(v.id, 'V')
    for (const s of spec.solutions) seen.set(s.id, 'S')
  }
  return [...seen.entries()].map(([id, entryType]) => ({ id, entryType }))
}

function _getDesc(spec: SpecBlock, id: string, t: 'F' | 'V' | 'S'): string {
  if (t === 'F') return spec.functions.find((f) => f.id === id)?.description ?? ''
  if (t === 'V') return spec.values.find((v) => v.id === id)?.description ?? ''
  return spec.solutions.find((s) => s.id === id)?.description ?? ''
}

function _stripFences(text: string): string {
  return text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
}

// ── Diff computations (pure functions — safe to call from computed()) ─────────

export function computeTypesDiff(slots: ComparisonSlot[]): TypeCountRow[] {
  const fC = slots.map((s) => s.planModel.spec.functions.length)
  const vC = slots.map((s) => s.planModel.spec.values.length)
  const sC = slots.map((s) => s.planModel.spec.solutions.length)
  const tot = slots.map((_, i) => fC[i] + vC[i] + sC[i])
  return [
    { type: 'Functions (F)', counts: fC,  hasDiff: new Set(fC).size  > 1 },
    { type: 'Values (V)',    counts: vC,  hasDiff: new Set(vC).size  > 1 },
    { type: 'Solutions (S)', counts: sC,  hasDiff: new Set(sC).size  > 1 },
    { type: 'Total',         counts: tot, hasDiff: new Set(tot).size > 1 },
  ]
}

export function computeTextDiff(slots: ComparisonSlot[]): TextDiffRow[] {
  const specs = slots.map((s) => s.planModel.spec)
  return _unionIds(specs).map(({ id, entryType }) => {
    const values = specs.map((spec) => _getDesc(spec, id, entryType))
    const filled = values.filter((v) => v !== '')
    return { id, entryType, values, hasDiff: filled.length > 0 && new Set(filled).size > 1 }
  })
}

export function computeValuesDiff(slots: ComparisonSlot[]): ValueDiffRow[] {
  const specs = slots.map((s) => s.planModel.spec)
  const vIds = [...new Set(specs.flatMap((spec) => spec.values.map((v) => v.id)))]
  const fields = ['scale', 'meter', 'goal', 'tolerable', 'status'] as const
  const rows: ValueDiffRow[] = []
  for (const id of vIds) {
    for (const field of fields) {
      const values = specs.map((spec) => {
        const v = spec.values.find((v) => v.id === id)
        return v ? (v[field] ?? '') : ''
      })
      const filled = values.filter((v) => v !== '')
      const hasDiff = filled.length > 0 && new Set(filled).size > 1
      if (hasDiff) rows.push({ id, field: `${id} — ${field}`, values, hasDiff })
    }
  }
  return rows
}

export function computeImpactDiff(slots: ComparisonSlot[]): TextDiffRow[] {
  const specs = slots.map((s) => s.planModel.spec)
  const sIds = [...new Set(specs.flatMap((spec) => spec.solutions.map((s) => s.id)))]
  return sIds.map((id) => {
    const values = specs.map((spec) => spec.solutions.find((s) => s.id === id)?.impact ?? '')
    const filled = values.filter((v) => v !== '')
    return { id, entryType: 'S' as const, values, hasDiff: filled.length > 0 && new Set(filled).size > 1 }
  })
}

export function computeSequencesDiff(slots: ComparisonSlot[]): SequenceRow[] {
  const allEntries = slots.map((s) => {
    const spec = s.planModel.spec
    return [
      ...spec.functions.map((f) => f.id),
      ...spec.values.map((v) => v.id),
      ...spec.solutions.map((s) => s.id),
    ]
  })
  const maxLen = Math.max(...allEntries.map((e) => e.length), 0)
  return Array.from({ length: maxLen }, (_, i) => {
    const entryIds = allEntries.map((entries) => entries[i] ?? null)
    const nonNull = entryIds.filter((id): id is string => id !== null)
    return { position: i + 1, entryIds, hasDiff: nonNull.length > 0 && new Set(nonNull).size > 1 }
  })
}

function _filterDiff(slots: ComparisonSlot[], kw: string[]): TextDiffRow[] {
  const specs = slots.map((s) => s.planModel.spec)
  const matching = _unionIds(specs).filter(({ id, entryType }) =>
    specs.some((spec) => _hasKeyword(_getDesc(spec, id, entryType), kw)),
  )
  return matching.map(({ id, entryType }) => {
    const values = specs.map((spec) => _getDesc(spec, id, entryType))
    const filled = values.filter((v) => v !== '')
    return { id, entryType, values, hasDiff: filled.length > 0 && new Set(filled).size > 1 }
  })
}

export function computeFinancialsDiff(slots: ComparisonSlot[]): TextDiffRow[] { return _filterDiff(slots, FINANCE_KW) }
export function computeDurationDiff(slots: ComparisonSlot[]): TextDiffRow[]   { return _filterDiff(slots, DURATION_KW) }
export function computeEffortDiff(slots: ComparisonSlot[]): TextDiffRow[]     { return _filterDiff(slots, EFFORT_KW) }

// ── VDT computation ───────────────────────────────────────────────────────────

export function createEmptyVDT(criteriaModel: PlanModel, candidateSlots: ComparisonSlot[]): VDTResult {
  const modelLabels = candidateSlots.map((s) => s.label)
  const rows: VDTRow[] = criteriaModel.spec.values.map((v) => ({
    criterionId: v.id,
    description: v.description,
    scale: v.scale,
    goal: v.goal ?? '',
    scores: modelLabels.map(() => ({ score: 0, rationale: '', isWinner: false })),
    winnerIndex: -1,
  }))
  return { rows, modelLabels, winCounts: modelLabels.map(() => 0), overallWinnerIndex: -1 }
}

function _recalcVDTWinners(result: VDTResult): VDTResult {
  const winCounts = result.modelLabels.map(() => 0)
  const rows = result.rows.map((row) => {
    const max = Math.max(...row.scores.map((s) => s.score))
    const tops = row.scores.reduce<number[]>((a, s, i) => (s.score === max && max > 0 ? [...a, i] : a), [])
    const wi = tops.length === 1 ? tops[0] : -1
    if (wi >= 0) winCounts[wi]++
    return {
      ...row,
      scores: row.scores.map((s, i) => ({ ...s, isWinner: i === wi && max > 0 })),
      winnerIndex: wi,
    }
  })
  const maxW = Math.max(...winCounts, 0)
  const topW = winCounts.reduce<number[]>((a, w, i) => (w === maxW && maxW > 0 ? [...a, i] : a), [])
  return { ...result, rows, winCounts, overallWinnerIndex: topW.length === 1 ? topW[0] : -1 }
}

export function updateVDTScore(
  result: VDTResult,
  rowIndex: number,
  modelIndex: number,
  score: number,
  rationale: string,
): VDTResult {
  const rows = result.rows.map((row, ri) => {
    if (ri !== rowIndex) return row
    return {
      ...row,
      scores: row.scores.map((s, mi) =>
        mi === modelIndex ? { ...s, score: Math.max(0, Math.min(10, score)), rationale } : s,
      ),
    }
  })
  return _recalcVDTWinners({ ...result, rows })
}

// ── Module-level state ────────────────────────────────────────────────────────

const _slots          = ref<ComparisonSlot[]>([])
const _mode           = ref<'differences' | 'vdt'>('differences')
const _activeCriteria = ref<DiffCriterion[]>(['types'])
const _criteriaModel  = ref<PlanModel | null>(null)
const _vdtResult      = ref<VDTResult | null>(null)
const _vdtLoading     = ref(false)
const _vdtError       = ref('')

// ── Public actions ────────────────────────────────────────────────────────────

export function addComparisonSlot(planModel: PlanModel): void {
  if (_slots.value.some((s) => s.planModel.id === planModel.id)) return
  _slots.value = [..._slots.value, { planModel, label: `${planModel.name} v${planModel.version}` }]
  if (_criteriaModel.value) {
    _vdtResult.value = createEmptyVDT(_criteriaModel.value, _candidateSlots())
  }
}

export function removeComparisonSlot(id: string): void {
  _slots.value = _slots.value.filter((s) => s.planModel.id !== id)
  if (_criteriaModel.value?.id === id) _criteriaModel.value = null
  if (_criteriaModel.value) {
    _vdtResult.value = createEmptyVDT(_criteriaModel.value, _candidateSlots())
  } else {
    _vdtResult.value = null
  }
}

export function setComparisonMode(mode: 'differences' | 'vdt'): void {
  _mode.value = mode
}

/**
 * Select exactly one diff criterion. Clicking the already-selected criterion is
 * a no-op (there must always be exactly one active). Clicking any other criterion
 * switches to it immediately — radio-button semantics, one view at a time.
 */
export function selectDiffCriterion(key: DiffCriterion): void {
  _activeCriteria.value = [key]
}

/** Designate a loaded model as the Criteria Model for VDT mode. */
export function setCriteriaModelForVDT(model: PlanModel): void {
  _criteriaModel.value = model
  _vdtResult.value = createEmptyVDT(model, _candidateSlots())
}

/** Update a single VDT cell manually. */
export function updateVDTCell(rowIndex: number, modelIndex: number, score: number, rationale: string): void {
  if (!_vdtResult.value) return
  _vdtResult.value = updateVDTScore(_vdtResult.value, rowIndex, modelIndex, score, rationale)
}

/** Auto-score all VDT cells via a single AI call. */
export async function runAutoScore(): Promise<void> {
  if (!_criteriaModel.value) return
  const candidates = _candidateSlots()
  if (candidates.length === 0) return

  _vdtLoading.value = true
  _vdtError.value = ''

  try {
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      await new Promise((r) => setTimeout(r, 1200))
      // Mock: fill with random-ish scores based on string lengths
      let result = _vdtResult.value ?? createEmptyVDT(_criteriaModel.value, candidates)
      result.rows.forEach((_, ri) => {
        candidates.forEach((_, mi) => {
          const score = ((ri + mi * 3 + 5) % 10) + 1
          result = updateVDTScore(result, ri, mi, score, 'Mock rationale.')
        })
      })
      _vdtResult.value = result
      return
    }

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
    const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
    if (!apiKey && !isLocal) throw new Error('VITE_ANTHROPIC_API_KEY not set')
    const client = new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 90_000 })

    const criteriaLines = _criteriaModel.value.spec.values
      .map((v) => `${v.id}: ${v.description} | Scale: ${v.scale} | Goal: ${v.goal ?? ''} | Tolerable: ${v.tolerable ?? ''}`)
      .join('\n')

    const candidateLines = candidates
      .map((slot) => {
        const sols = slot.planModel.spec.solutions
          .map((s) => `  ${s.id}: ${s.description} — ${s.impact ?? ''}`)
          .join('\n')
        return `Plan: ${slot.label}\nSolutions:\n${sols}`
      })
      .join('\n\n---\n\n')

    const prompt = `You are a Planguage Value Decision Table scorer. Evaluate each candidate plan against each Planguage criterion.

Criteria (V entries from Criteria Model "${_criteriaModel.value.name} v${_criteriaModel.value.version}"):
${criteriaLines}

Candidate Plans:
${candidateLines}

Score each (criterion × plan) pair: how well do this plan's solutions address this criterion?
0 = not addressed, 10 = fully and excellently addressed.

Return ONLY valid JSON — no prose, no code fences:
{
  "scores": {
    "<criterion_id>": {
      "<plan_label>": { "score": <0-10>, "rationale": "<one sentence max 15 words>" }
    }
  }
}`

    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No AI response')

    const parsed = JSON.parse(_stripFences(textBlock.text)) as {
      scores: Record<string, Record<string, { score: number; rationale: string }>>
    }

    let result = _vdtResult.value ?? createEmptyVDT(_criteriaModel.value, candidates)
    for (const [criterionId, planScores] of Object.entries(parsed.scores)) {
      const ri = result.rows.findIndex((r) => r.criterionId === criterionId)
      if (ri < 0) continue
      for (const [planLabel, { score, rationale }] of Object.entries(planScores)) {
        const mi = result.modelLabels.indexOf(planLabel)
        if (mi < 0) continue
        result = updateVDTScore(result, ri, mi, score, rationale)
      }
    }
    _vdtResult.value = result
  } catch (err) {
    _vdtError.value = err instanceof Error ? err.message : 'AI scoring failed'
  } finally {
    _vdtLoading.value = false
  }
}

export function clearComparison(): void {
  _slots.value = []
  _mode.value = 'differences'
  _activeCriteria.value = ['types']
  _criteriaModel.value = null
  _vdtResult.value = null
  _vdtLoading.value = false
  _vdtError.value = ''
}

function _candidateSlots(): ComparisonSlot[] {
  return _criteriaModel.value
    ? _slots.value.filter((s) => s.planModel.id !== _criteriaModel.value!.id)
    : _slots.value
}

// ── Composable export ─────────────────────────────────────────────────────────

export function useModelComparison() {
  return {
    slots:          readonly(_slots),
    mode:           readonly(_mode),
    activeCriteria: readonly(_activeCriteria),
    criteriaModel:  readonly(_criteriaModel),
    vdtResult:      readonly(_vdtResult),
    vdtLoading:     readonly(_vdtLoading),
    vdtError:       readonly(_vdtError),
    DIFF_CRITERIA,
    addComparisonSlot,
    removeComparisonSlot,
    setComparisonMode,
    selectDiffCriterion,
    setCriteriaModelForVDT,
    updateVDTCell,
    runAutoScore,
    clearComparison,
    computeTypesDiff,
    computeTextDiff,
    computeValuesDiff,
    computeImpactDiff,
    computeSequencesDiff,
    computeFinancialsDiff,
    computeDurationDiff,
    computeEffortDiff,
  }
}
