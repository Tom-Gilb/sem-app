/**
 * useEvoCritiquer — AI-powered review of a plan against the 9-step Evo cycle.
 *
 * Health dimensions map to the Evo cycle:
 *   Steps 1-5 (Planning Cycle): Stakeholder Coverage, Values Completeness,
 *     Solutions Linkage, Decomposition Quality, Priority Alignment
 *   Steps 6-9 (Value Delivery Cycle): Develop Tasks, Delivery Clarity,
 *     Measurement Readiness, Learn Loop Quality
 *   Plus: Constraint Coverage (binary+scalar+budgets)
 *
 * Each dimension gets a score 0–100, specific findings, actionable improvement tasks,
 * and references to Tom Gilb's books/talks with URLs.
 *
 * useEvoCritiquer is stateful: stores the last critique result in a module-level ref
 * so it persists across panel mount/unmount. The panel's "Run Analysis" button
 * triggers a fresh AI run.
 *
 * Canonical Evo cycle (Tom Gilb, EVO 2024 book, Chapter 2, p.19):
 *   Steps 1–5: Planning Cycle (Stakeholders, Values, Solutions, Decompose, Prioritize)
 *   Steps 6–9: Value Delivery Cycle (Develop, Deliver, Measure, Learn)
 */

import Anthropic from '@anthropic-ai/sdk'
import { ref } from 'vue'
import { MODEL_ID } from '../config/llm'
import type { SpecBlock } from '../types/spec'
import type { PlanModel } from './useSpecModel'

// ── Public types ──────────────────────────────────────────────────────────────

export type HealthDimensionId =
  | 'stakeholder-coverage'
  | 'values-completeness'
  | 'solutions-linkage'
  | 'decomposition-quality'
  | 'priority-alignment'
  | 'develop-tasks'
  | 'delivery-clarity'
  | 'measure-readiness'
  | 'learn-loop'
  | 'constraint-coverage'

export interface HealthFinding {
  severity: 'critical' | 'major' | 'minor' | 'positive'
  text: string
  entryRef?: string   // e.g. "V.2" or "F.1"
}

export interface ImprovementTask {
  priority: 'now' | 'soon' | 'later'
  task: string        // concrete action sentence
  evoStep: number     // which of the 9 Evo steps (1–9)
}

export interface EvoReference {
  title: string       // e.g. "Competitive Engineering, Ch.5"
  url: string         // real URL
  quote?: string      // short verbatim quote if available
}

export interface HealthDimension {
  id: HealthDimensionId
  label: string
  evoSteps: number[]
  score: number       // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'  // 90+=A, 75+=B, 60+=C, 40+=D, else F
  summary: string
  findings: HealthFinding[]
  tasks: ImprovementTask[]
  references: EvoReference[]
}

export interface EvoStepCritique {
  stepIndex: number     // 1–9
  stepName: string
  phase: 'planning' | 'value-delivery'
  overallScore: number  // 0–100
  summary: string
  findings: HealthFinding[]
  tasks: ImprovementTask[]
}

export interface ValueDeliveryFocus {
  overallScore: number
  developScore: number   // step 6
  deliverScore: number   // step 7
  measureScore: number   // step 8
  learnScore: number     // step 9
  practicalTasks: ImprovementTask[]
  topRisk: string
  goodLooks: string
}

export interface EvoCritiqueResult {
  planId: string
  planTitle: string
  runAt: string           // ISO
  overallScore: number    // weighted average across 10 dimensions
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F'
  executiveSummary: string
  dimensions: HealthDimension[]
  stepCritiques: EvoStepCritique[]
  valueDeliveryFocus: ValueDeliveryFocus
}

// ── Dimension definitions ─────────────────────────────────────────────────────

interface DimensionDef {
  id: HealthDimensionId
  label: string
  evoSteps: number[]
  description: string
}

export const HEALTH_DIMENSION_DEFS: DimensionDef[] = [
  {
    id: 'stakeholder-coverage',
    label: 'Stakeholder Coverage',
    evoSteps: [1],
    description: 'Are all relevant stakeholders identified? Do the values and constraints cover their concerns?',
  },
  {
    id: 'values-completeness',
    label: 'Values Completeness',
    evoSteps: [2],
    description: 'Do Value entries have measurable scales, meters, goals, and tolerables? Are wishes clearly distinguished from goals?',
  },
  {
    id: 'solutions-linkage',
    label: 'Solutions Linkage',
    evoSteps: [3],
    description: 'Are solutions (S. entries) clearly linked to the values they deliver? Are impacts quantified?',
  },
  {
    id: 'decomposition-quality',
    label: 'Decomposition Quality',
    evoSteps: [4],
    description: 'Is the plan decomposed into implementable increments? Are evo steps defined with clear scope?',
  },
  {
    id: 'priority-alignment',
    label: 'Priority Alignment',
    evoSteps: [5],
    description: 'Are items prioritised by value delivery potential within all constraints? Is the priority basis explicit?',
  },
  {
    id: 'develop-tasks',
    label: 'Develop Tasks',
    evoSteps: [6],
    description: 'Are development tasks concrete and actionable? Do they clearly implement specific solutions?',
  },
  {
    id: 'delivery-clarity',
    label: 'Delivery Clarity',
    evoSteps: [7],
    description: 'Is it clear what will be delivered, to whom, and when? Are delivery criteria defined?',
  },
  {
    id: 'measure-readiness',
    label: 'Measurement Readiness',
    evoSteps: [8],
    description: 'Can value delivery be measured after each evo step? Are measurement methods and timing defined?',
  },
  {
    id: 'learn-loop',
    label: 'Learn Loop',
    evoSteps: [9],
    description: 'Is there a mechanism to incorporate learnings back into the spec? Are review cadences planned?',
  },
  {
    id: 'constraint-coverage',
    label: 'Constraint Coverage',
    evoSteps: [2, 5],
    description: 'Are all binary constraints, scalar constraints, budget constraints, and resource constraints captured?',
  },
]

// ── Grade calculation ─────────────────────────────────────────────────────────

export function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

// ── Module-level singleton state ──────────────────────────────────────────────

const critiqueResult  = ref<EvoCritiqueResult | null>(null)
const critiqueLoading = ref(false)
const critiqueError   = ref<string | null>(null)

// ── LLM client ────────────────────────────────────────────────────────────────

function _getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  return new Anthropic({ apiKey: apiKey ?? '', dangerouslyAllowBrowser: true, timeout: 120_000 })
}

// ── JSON extraction helper ────────────────────────────────────────────────────

function _extractJson<T>(text: string): T {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(stripped) as T } catch { /* */ }
  try { return JSON.parse(text.trim()) as T } catch { /* */ }
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (objMatch) { try { return JSON.parse(objMatch[0]) as T } catch { /* */ } }
  throw new Error('Could not extract valid JSON from AI response')
}

// ── Spec serialiser ───────────────────────────────────────────────────────────

function _serializeSpec(spec: SpecBlock): string {
  const lines: string[] = []
  for (const f of spec.functions) {
    lines.push(`F. ${f.id}: ${f.description}`)
    const pt = (f.presenceTest || f.successCriteria)?.trim()
    if (pt) lines.push(`   Presence test: ${pt}`)
    if (f.functionOfValue) lines.push(`   Function of Value: ${f.functionOfValue}`)
  }
  for (const v of spec.values) {
    lines.push(`V. ${v.id}: ${v.description}`)
    if (v.scale) lines.push(`   Scale: ${v.scale}`)
    if (v.meter) lines.push(`   Meter: ${v.meter}`)
    if (v.goal) lines.push(`   Goal: ${v.goal}`)
    if (v.tolerable) lines.push(`   Tolerable: ${v.tolerable}`)
    if (v.status) lines.push(`   Status: ${v.status}`)
  }
  for (const s of spec.solutions) {
    lines.push(`S. ${s.id}: ${s.description}`)
    if (s.impact) lines.push(`   Impact: ${s.impact}`)
  }
  for (const c of spec.constraints ?? []) {
    lines.push(`C. ${c.id}: ${c.description}`)
    if (c.scope) lines.push(`   Scope: ${c.scope}`)
    if (c.rationale) lines.push(`   Rationale: ${c.rationale}`)
  }
  return lines.join('\n') || '(empty spec — no entries)'
}

// ── Shape-safe builders ───────────────────────────────────────────────────────

function _buildDimension(raw: Record<string, unknown>, def: DimensionDef): HealthDimension {
  const score = Math.min(100, Math.max(0, Number(raw.score ?? 50)))
  return {
    id:         def.id,
    label:      def.label,
    evoSteps:   def.evoSteps,
    score,
    grade:      scoreToGrade(score),
    summary:    String(raw.summary ?? ''),
    findings:   _buildFindings(raw.findings),
    tasks:      _buildTasks(raw.tasks),
    references: _buildRefs(raw.references),
  }
}

function _buildFindings(raw: unknown): HealthFinding[] {
  if (!Array.isArray(raw)) return []
  return raw.map(r => ({
    severity: (['critical','major','minor','positive'].includes((r as Record<string,string>).severity)
      ? (r as Record<string,string>).severity
      : 'minor') as HealthFinding['severity'],
    text:     String((r as Record<string,string>).text ?? ''),
    entryRef: (r as Record<string,string>).entryRef ?? undefined,
  }))
}

function _buildTasks(raw: unknown): ImprovementTask[] {
  if (!Array.isArray(raw)) return []
  return raw.map(r => ({
    priority: (['now','soon','later'].includes((r as Record<string,string>).priority)
      ? (r as Record<string,string>).priority
      : 'later') as ImprovementTask['priority'],
    task:     String((r as Record<string,string>).task ?? ''),
    evoStep:  Math.min(9, Math.max(1, Number((r as Record<string,string>).evoStep ?? 1))),
  }))
}

function _buildRefs(raw: unknown): EvoReference[] {
  if (!Array.isArray(raw)) return []
  return raw.map(r => ({
    title: String((r as Record<string,string>).title ?? ''),
    url:   String((r as Record<string,string>).url ?? ''),
    quote: (r as Record<string,string>).quote ?? undefined,
  }))
}

function _buildStepCritique(raw: Record<string, unknown>, stepIdx: number): EvoStepCritique {
  const STEP_NAMES = ['','Stakeholders','Values','Solutions','Decompose','Prioritize','Develop','Deliver','Measure','Learn']
  return {
    stepIndex:    stepIdx,
    stepName:     STEP_NAMES[stepIdx] ?? `Step ${stepIdx}`,
    phase:        stepIdx <= 5 ? 'planning' : 'value-delivery',
    overallScore: Math.min(100, Math.max(0, Number(raw.overallScore ?? 50))),
    summary:      String(raw.summary ?? ''),
    findings:     _buildFindings(raw.findings),
    tasks:        _buildTasks(raw.tasks),
  }
}

// ── Main AI function ──────────────────────────────────────────────────────────

async function runEvoCritique(
  spec: SpecBlock,
  planModel: PlanModel,
  signal?: AbortSignal,
): Promise<void> {
  critiqueLoading.value = true
  critiqueError.value   = null

  const systemPrompt = `You are an expert Evo methodology coach trained on Tom Gilb's Competitive Engineering (2005), \
Value Improvement book (2021), and Evolutionary Project Management (2024 EVO book). \
Review the plan against the 9-step Evo cycle. Be specific, practical, and cite real URLs from gilb.com, \
Wikipedia, or published references. Never fabricate URLs. \
Score each dimension 0–100 honestly — 50 is average, 80 is good, 90+ is excellent. \
Return ONLY valid JSON with no prose or markdown fences.`

  const dimList = HEALTH_DIMENSION_DEFS.map(d =>
    `  - ${d.id} (Evo steps ${d.evoSteps.join(',')}): ${d.description}`,
  ).join('\n')

  const userPrompt = `Review this Planguage plan against the 9-step Evo cycle and return a structured critique.

PLAN TITLE: ${planModel.name}
PLAN VERSION: ${planModel.version}

SPEC ENTRIES:
${_serializeSpec(spec)}

THE 9 EVO STEPS:
  Planning Cycle (steps 1–5):
    1. Stakeholders — identify all who matter, inanimate entities included
    2. Values — measurable value targets with scale, meter, goal, tolerable, wish
    3. Solutions — candidate means with impact estimates
    4. Decompose — break into implementable increments
    5. Prioritize — rank by value delivery within all constraints

  Value Delivery Cycle (steps 6–9):
    6. Develop — implement the prioritized increment
    7. Deliver — release the increment to stakeholders
    8. Measure — collect actual Value entry Status data
    9. Learn — interpret data, update spec, feed back into planning

HEALTH DIMENSIONS TO SCORE:
${dimList}

Return JSON exactly in this shape (no extra fields, no markdown):
{
  "overallScore": <0-100>,
  "executiveSummary": "<2-3 sentence overall assessment>",
  "dimensions": {
    "<dimensionId>": {
      "score": <0-100>,
      "summary": "<1-2 sentence assessment>",
      "findings": [
        { "severity": "critical|major|minor|positive", "text": "...", "entryRef": "V.1" }
      ],
      "tasks": [
        { "priority": "now|soon|later", "task": "...", "evoStep": <1-9> }
      ],
      "references": [
        { "title": "...", "url": "...", "quote": "..." }
      ]
    }
  },
  "stepCritiques": {
    "1": { "overallScore": <0-100>, "summary": "...", "findings": [...], "tasks": [...] },
    "2": { "overallScore": <0-100>, "summary": "...", "findings": [...], "tasks": [...] },
    "3": { "overallScore": <0-100>, "summary": "...", "findings": [...], "tasks": [...] },
    "4": { "overallScore": <0-100>, "summary": "...", "findings": [...], "tasks": [...] },
    "5": { "overallScore": <0-100>, "summary": "...", "findings": [...], "tasks": [...] },
    "6": { "overallScore": <0-100>, "summary": "...", "findings": [...], "tasks": [...] },
    "7": { "overallScore": <0-100>, "summary": "...", "findings": [...], "tasks": [...] },
    "8": { "overallScore": <0-100>, "summary": "...", "findings": [...], "tasks": [...] },
    "9": { "overallScore": <0-100>, "summary": "...", "findings": [...], "tasks": [...] }
  },
  "valueDeliveryFocus": {
    "overallScore": <0-100>,
    "developScore": <0-100>,
    "deliverScore": <0-100>,
    "measureScore": <0-100>,
    "learnScore": <0-100>,
    "topRisk": "<single sentence: the most likely thing to derail value delivery>",
    "goodLooks": "<single sentence: what excellent value delivery looks like for this plan>",
    "practicalTasks": [
      { "priority": "now|soon|later", "task": "...", "evoStep": <6-9> }
    ]
  }
}`

  try {
    const client = _getClient()
    const response = await client.messages.create(
      {
        model: MODEL_ID,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      { signal },
    )

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    type RawResponse = {
      overallScore: number
      executiveSummary: string
      dimensions: Record<string, Record<string, unknown>>
      stepCritiques: Record<string, Record<string, unknown>>
      valueDeliveryFocus: {
        overallScore: number
        developScore: number
        deliverScore: number
        measureScore: number
        learnScore: number
        topRisk: string
        goodLooks: string
        practicalTasks: unknown[]
      }
    }

    const parsed = _extractJson<RawResponse>(text)

    // Build dimensions array from the defs order
    const dimensions: HealthDimension[] = HEALTH_DIMENSION_DEFS.map(def => {
      const raw = parsed.dimensions?.[def.id] ?? {}
      return _buildDimension(raw, def)
    })

    // Compute weighted overall score from dimensions
    const overallScore = dimensions.length > 0
      ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
      : Math.min(100, Math.max(0, Number(parsed.overallScore ?? 50)))

    // Build step critiques 1–9
    const stepCritiques: EvoStepCritique[] = []
    for (let i = 1; i <= 9; i++) {
      const raw = parsed.stepCritiques?.[String(i)] ?? {}
      stepCritiques.push(_buildStepCritique(raw, i))
    }

    // Build value delivery focus
    const vdf = parsed.valueDeliveryFocus ?? {}
    const valueDeliveryFocus: ValueDeliveryFocus = {
      overallScore: Math.min(100, Math.max(0, Number(vdf.overallScore ?? 50))),
      developScore: Math.min(100, Math.max(0, Number(vdf.developScore ?? 50))),
      deliverScore: Math.min(100, Math.max(0, Number(vdf.deliverScore ?? 50))),
      measureScore: Math.min(100, Math.max(0, Number(vdf.measureScore ?? 50))),
      learnScore:   Math.min(100, Math.max(0, Number(vdf.learnScore ?? 50))),
      topRisk:      String(vdf.topRisk ?? ''),
      goodLooks:    String(vdf.goodLooks ?? ''),
      practicalTasks: _buildTasks(vdf.practicalTasks),
    }

    critiqueResult.value = {
      planId:           planModel.id,
      planTitle:        planModel.name,
      runAt:            new Date().toISOString(),
      overallScore,
      overallGrade:     scoreToGrade(overallScore),
      executiveSummary: String(parsed.executiveSummary ?? ''),
      dimensions,
      stepCritiques,
      valueDeliveryFocus,
    }
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') {
      critiqueLoading.value = false
      return
    }
    critiqueError.value = err instanceof Error ? err.message : 'AI analysis failed'
  } finally {
    critiqueLoading.value = false
  }
}

// ── Public composable ─────────────────────────────────────────────────────────

export function useEvoCritiquer() {
  return { critiqueResult, critiqueLoading, critiqueError, runEvoCritique }
}
