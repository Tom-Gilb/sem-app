/**
 * useDecisionMapper — AI-powered decision analysis using Planguage.
 *
 * User describes a decision (e.g. "Should we build or buy?"). AI creates:
 *   - Options (3-5 alternatives)
 *   - Criteria (V. and C. Planguage entries defining success)
 *   - Decision matrix (options × criteria with scores 0-100)
 *   - Planguage model of each option (what F./V./C./R. entries it implies)
 *   - Recommendation with rationale
 *   - Comparison with an external plan (optional)
 *
 * Singleton, localStorage key 'sem-decision-mapper-v1'.
 */

import Anthropic from '@anthropic-ai/sdk'
import { ref, computed } from 'vue'
import { MODEL_ID } from '../config/llm'
import { CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT } from '../config/planguagePrompt'

// ── Public types ──────────────────────────────────────────────────────────────

export interface PlanguagizedEntry {
  id: string
  type: 'F' | 'V' | 'C' | 'R' | 'S'
  tag: string
  description: string
  details?: string
  confidence: 'high' | 'medium' | 'low'
}

export interface DecisionCriterion {
  id: string
  label: string               // e.g. "Total Cost of Ownership"
  type: 'value' | 'constraint'  // V. or C. in Planguage
  weight: number              // 0-1, value criteria weights sum to 1
  description: string
  scale?: string              // Planguage Scale for value criteria
  direction: 'higher-better' | 'lower-better'
}

export interface DecisionOption {
  id: string
  label: string               // e.g. "Build Internally"
  description: string         // 2-3 sentence summary
  scores: Record<string, number>          // criterionId → 0-100 score
  constraintsMet: Record<string, boolean> // constraintCriterionId → true/false
  planguageEntries: PlanguagizedEntry[]   // F/V/C/R specific to this option
  pros: string[]                          // top 3 pros
  cons: string[]                          // top 3 cons
  feasibilityScore: number     // 0-100
  valueScore: number           // weighted score across value criteria
  recommendation: string       // 2-sentence assessment of this option
}

export interface DecisionModel {
  id: string
  title: string
  question: string             // the decision question
  context: string              // background provided by user
  criteria: DecisionCriterion[]
  options: DecisionOption[]
  recommendation: string       // AI's recommended option with full rationale
  recommendedOptionId: string
  planguageModel: PlanguagizedEntry[]  // the decision SPACE as F./V./C. entries
  comparisonText?: string      // external plan text loaded for comparison
  comparisonAnalysis?: string  // how each option affects the external plan
  analysisStatus: 'idle' | 'analysing' | 'done' | 'error'
  analysisError?: string
  redoStatus: 'idle' | 'redoing' | 'done' | 'error'
  createdAt: number
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-decision-mapper-v1'

// ── Module-level singleton state ──────────────────────────────────────────────

const decisions = ref<DecisionModel[]>([])
const selectedDecisionId = ref<string | null>(null)
const _abortController = ref<AbortController | null>(null)

// ── Computed ──────────────────────────────────────────────────────────────────

const selectedDecision = computed<DecisionModel | null>(
  () => decisions.value.find(d => d.id === selectedDecisionId.value) ?? null,
)

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

// ── Entry builder ─────────────────────────────────────────────────────────────

function _buildEntry(raw: Record<string, unknown>, idx: number): PlanguagizedEntry {
  const type = (['F','V','C','R','S'].includes(String(raw.type)) ? raw.type : 'F') as PlanguagizedEntry['type']
  const tag = String(raw.tag ?? `${type}.${idx + 1}`)
  return {
    id: tag,
    type,
    tag,
    description: String(raw.description ?? ''),
    details: raw.details != null ? String(raw.details) : undefined,
    confidence: (['high','medium','low'].includes(String(raw.confidence)) ? raw.confidence : 'medium') as PlanguagizedEntry['confidence'],
  }
}

// ── Model builder from raw AI response ───────────────────────────────────────

type RawCriterion = {
  id: string; label: string; type: string; weight: number
  description: string; scale?: string; direction: string
}
type RawOption = {
  id: string; label: string; description: string
  scores: Record<string, number>; constraintsMet: Record<string, boolean>
  planguageEntries: Record<string, unknown>[]
  pros: string[]; cons: string[]; feasibilityScore: number
  valueScore: number; recommendation: string
}
type RawDecision = {
  title: string
  criteria: RawCriterion[]
  options: RawOption[]
  recommendation: string
  recommendedOptionId: string
  planguageModel: Record<string, unknown>[]
}

function _buildDecisionFromRaw(raw: RawDecision, question: string, context: string, id: string): DecisionModel {
  const criteria: DecisionCriterion[] = (raw.criteria ?? []).map(c => ({
    id: String(c.id ?? ''),
    label: String(c.label ?? ''),
    type: (c.type === 'constraint' ? 'constraint' : 'value') as DecisionCriterion['type'],
    weight: Math.min(1, Math.max(0, Number(c.weight ?? 0.2))),
    description: String(c.description ?? ''),
    scale: c.scale != null ? String(c.scale) : undefined,
    direction: (c.direction === 'lower-better' ? 'lower-better' : 'higher-better') as DecisionCriterion['direction'],
  }))

  const options: DecisionOption[] = (raw.options ?? []).map(o => ({
    id: String(o.id ?? ''),
    label: String(o.label ?? ''),
    description: String(o.description ?? ''),
    scores: o.scores ?? {},
    constraintsMet: o.constraintsMet ?? {},
    planguageEntries: (o.planguageEntries ?? []).map((e, i) => _buildEntry(e as Record<string, unknown>, i)),
    pros: Array.isArray(o.pros) ? o.pros.map(String) : [],
    cons: Array.isArray(o.cons) ? o.cons.map(String) : [],
    feasibilityScore: Math.min(100, Math.max(0, Number(o.feasibilityScore ?? 50))),
    valueScore: Math.min(100, Math.max(0, Number(o.valueScore ?? 50))),
    recommendation: String(o.recommendation ?? ''),
  }))

  return {
    id,
    title: String(raw.title ?? question.slice(0, 60)),
    question,
    context,
    criteria,
    options,
    recommendation: String(raw.recommendation ?? ''),
    recommendedOptionId: String(raw.recommendedOptionId ?? ''),
    planguageModel: (raw.planguageModel ?? []).map((e, i) => _buildEntry(e as Record<string, unknown>, i)),
    analysisStatus: 'done',
    redoStatus: 'idle',
    createdAt: Date.now(),
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

function _saveDecisions(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions.value))
}

function _loadDecisions(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DecisionModel[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        decisions.value = parsed
        // Reset in-progress states
        for (const d of decisions.value) {
          if (d.analysisStatus === 'analysing') {
            d.analysisStatus = 'error'
            d.analysisError = 'Analysis interrupted — please retry'
          }
          if (d.redoStatus === 'redoing') {
            d.redoStatus = 'error'
          }
        }
        // Auto-select first decision so DecisionMapperPanel never shows a blank
        // body (selectedDecision is null when selectedDecisionId is null).
        if (selectedDecisionId.value === null) {
          selectedDecisionId.value = decisions.value[0].id
        }
        return
      }
    }
  } catch {
    // fall through to empty
  }
  decisions.value = []
}

function _updateDecision(id: string, patch: Partial<DecisionModel>): void {
  const idx = decisions.value.findIndex(d => d.id === id)
  if (idx === -1) return
  decisions.value[idx] = { ...decisions.value[idx], ...patch }
  _saveDecisions()
}

// ── Pre-loaded sample decisions ───────────────────────────────────────────────

function _buildSampleBuildVsBuy(): DecisionModel {
  const criteria: DecisionCriterion[] = [
    { id: 'time-to-market', label: 'Time to Market', type: 'value', weight: 0.25, description: 'How quickly can this option be operational?', scale: 'Months to production', direction: 'lower-better' },
    { id: 'total-cost', label: 'Total 3-Year Cost', type: 'value', weight: 0.30, description: 'Total cost of ownership over 3 years including licensing, dev, ops', scale: 'USD thousands', direction: 'lower-better' },
    { id: 'feature-fit', label: 'Feature Fit', type: 'value', weight: 0.25, description: 'How well does the option cover required Planguage-style planning features?', scale: 'Score 0-100', direction: 'higher-better' },
    { id: 'customisability', label: 'Customisability', type: 'value', weight: 0.20, description: 'Can the option be extended for domain-specific needs?', scale: 'Score 0-100', direction: 'higher-better' },
    { id: 'gdpr', label: 'GDPR Compliance', type: 'constraint', weight: 0, description: 'Must be fully GDPR compliant for EU customer data', scale: undefined, direction: 'higher-better' },
  ]
  const options: DecisionOption[] = [
    {
      id: 'build',
      label: 'Build Internally',
      description: 'Develop the platform from scratch using internal engineering resources. Full control over features and data architecture.',
      scores: { 'time-to-market': 30, 'total-cost': 85, 'feature-fit': 95, 'customisability': 100 },
      constraintsMet: { 'gdpr': true },
      planguageEntries: [
        { id: 'F.1', type: 'F', tag: 'F.1', description: 'Custom Platform Development', confidence: 'high' },
        { id: 'V.1', type: 'V', tag: 'V.1', description: 'Development Timeline', details: 'Scale: Months · Goal: ≤18 · Tolerable: ≤24', confidence: 'medium' },
      ],
      pros: ['Maximum feature control', 'Full data sovereignty', 'Perfectly tailored to Planguage methodology'],
      cons: ['Longest time to value (12-18 months)', 'Highest upfront cost', 'Requires dedicated engineering team'],
      feasibilityScore: 70,
      valueScore: 77,
      recommendation: 'Build offers maximum control but incurs the highest cost and longest delivery timeline. Only viable if no existing solution meets Planguage needs.',
    },
    {
      id: 'buy',
      label: 'Buy Existing Solution',
      description: 'License an existing enterprise planning platform and configure it for Planguage use. Fastest time to value.',
      scores: { 'time-to-market': 90, 'total-cost': 35, 'feature-fit': 62, 'customisability': 45 },
      constraintsMet: { 'gdpr': true },
      planguageEntries: [
        { id: 'F.1', type: 'F', tag: 'F.1', description: 'Licensed Platform Deployment', confidence: 'high' },
        { id: 'C.1', type: 'C', tag: 'C.1', description: 'Must support export of planning data in open format', confidence: 'high' },
      ],
      pros: ['Fastest deployment (2-4 months)', 'Lower total cost', 'Vendor support included'],
      cons: ['Limited Planguage-specific customisation', 'Vendor lock-in risk', 'Feature gaps in methodology support'],
      feasibilityScore: 95,
      valueScore: 56,
      recommendation: 'Buy is fastest and most affordable but may not fully support Planguage methodology without significant workarounds.',
    },
    {
      id: 'hybrid',
      label: 'Hybrid: SaaS Core + Custom Extensions',
      description: 'License a SaaS planning platform as the foundation and build custom Planguage-specific extensions on top of its API.',
      scores: { 'time-to-market': 65, 'total-cost': 60, 'feature-fit': 85, 'customisability': 80 },
      constraintsMet: { 'gdpr': true },
      planguageEntries: [
        { id: 'F.1', type: 'F', tag: 'F.1', description: 'SaaS Platform Integration', confidence: 'high' },
        { id: 'F.2', type: 'F', tag: 'F.2', description: 'Custom Extension Layer', confidence: 'high' },
        { id: 'V.1', type: 'V', tag: 'V.1', description: 'Feature Coverage', details: 'Scale: % of required features covered · Goal: ≥90% · Tolerable: ≥75%', confidence: 'medium' },
      ],
      pros: ['Balanced cost and speed (6-9 months)', 'Good feature fit with extensions', 'Lower risk than full build'],
      cons: ['Dependency on SaaS vendor API stability', 'Moderate complexity in two-layer architecture', 'Integration maintenance overhead'],
      feasibilityScore: 82,
      valueScore: 74,
      recommendation: 'Hybrid provides the best balance — fast enough to deliver value within 9 months while supporting Planguage customisation through extensions.',
    },
  ]
  return {
    id: 'sample-build-vs-buy',
    title: 'Build vs Buy vs Hybrid for Core Platform',
    question: 'Should we build our core planning platform internally, buy an existing solution, or adopt a hybrid approach?',
    context: 'Mid-size consultancy, 50 staff, $800K annual IT budget, 18-month delivery horizon, needs to support Planguage-style planning.',
    criteria,
    options,
    recommendation: 'The Hybrid approach is recommended. It balances speed (6-9 months vs 18 months for Build) with feature fit (85/100 vs 62/100 for Buy). The SaaS core reduces infrastructure risk while custom extensions preserve the Planguage methodology support that makes the platform uniquely valuable. This option also scores highest on feasibility (82/100) given the team size and budget.',
    recommendedOptionId: 'hybrid',
    planguageModel: [
      { id: 'F.1', type: 'F', tag: 'F.1', description: 'Platform Delivery', confidence: 'high' },
      { id: 'F.2', type: 'F', tag: 'F.2', description: 'Custom Extension Layer', confidence: 'high' },
      { id: 'V.1', type: 'V', tag: 'V.1', description: 'Delivery Time', details: 'Scale: Months to production · Goal: ≤12 · Tolerable: ≤18', confidence: 'high' },
      { id: 'C.1', type: 'C', tag: 'C.1', description: 'Must be GDPR compliant', confidence: 'high' },
    ],
    analysisStatus: 'done',
    redoStatus: 'idle',
    createdAt: 1,
  }
}

function _buildSampleSaasVsSelfHosted(): DecisionModel {
  const criteria: DecisionCriterion[] = [
    { id: 'data-control', label: 'Data Control', type: 'value', weight: 0.35, description: 'Degree of control over where data is stored and processed', scale: 'Score 0-100', direction: 'higher-better' },
    { id: 'operational-cost', label: 'Operational Cost', type: 'value', weight: 0.25, description: 'Annual operational cost excluding initial setup', scale: 'USD thousands/year', direction: 'lower-better' },
    { id: 'scalability', label: 'Scalability', type: 'value', weight: 0.20, description: 'Ease of scaling capacity as the organisation grows', scale: 'Score 0-100', direction: 'higher-better' },
    { id: 'compliance-coverage', label: 'Compliance Coverage', type: 'value', weight: 0.20, description: 'Breadth of regulatory compliance built-in', scale: 'Score 0-100', direction: 'higher-better' },
    { id: 'data-residency', label: 'Data Residency', type: 'constraint', weight: 0, description: 'Must meet data residency requirements (financial sector)', scale: undefined, direction: 'higher-better' },
  ]
  const options: DecisionOption[] = [
    {
      id: 'saas',
      label: 'SaaS (Cloud-Hosted)',
      description: 'Deploy on a public cloud SaaS platform. Vendor manages infrastructure and compliance.',
      scores: { 'data-control': 30, 'operational-cost': 85, 'scalability': 95, 'compliance-coverage': 70 },
      constraintsMet: { 'data-residency': false },
      planguageEntries: [
        { id: 'C.1', type: 'C', tag: 'C.1', description: 'Must verify SaaS vendor data residency commitments in EU', confidence: 'medium' },
      ],
      pros: ['Lowest operational cost', 'Automatic scaling', 'Vendor handles updates and patches'],
      cons: ['Data residency risk for financial data', 'Limited control over data location', 'Vendor dependency'],
      feasibilityScore: 60,
      valueScore: 57,
      recommendation: 'SaaS fails the data residency constraint — not viable unless vendor provides contractual EU data residency guarantees.',
    },
    {
      id: 'self-hosted',
      label: 'Self-Hosted (On-Premises)',
      description: 'Deploy entirely on the organisation\'s own data centre infrastructure. Maximum data control.',
      scores: { 'data-control': 100, 'operational-cost': 30, 'scalability': 40, 'compliance-coverage': 85 },
      constraintsMet: { 'data-residency': true },
      planguageEntries: [
        { id: 'F.1', type: 'F', tag: 'F.1', description: 'On-Premises Infrastructure Management', confidence: 'high' },
        { id: 'V.1', type: 'V', tag: 'V.1', description: 'Infrastructure Uptime', details: 'Scale: % availability · Goal: ≥99.9% · Tolerable: ≥99.5%', confidence: 'medium' },
      ],
      pros: ['Full data sovereignty', 'Meets all data residency requirements', 'Highest compliance coverage'],
      cons: ['Highest operational cost (staff + hardware)', 'Limited scalability without major capex', 'Requires dedicated ops team'],
      feasibilityScore: 75,
      valueScore: 58,
      recommendation: 'Self-hosted fully satisfies data residency but at the highest operational cost. Feasible given existing on-prem infrastructure.',
    },
    {
      id: 'managed-private',
      label: 'Managed Private Cloud',
      description: 'Dedicated private cloud infrastructure managed by a specialised provider with financial-sector compliance expertise.',
      scores: { 'data-control': 85, 'operational-cost': 60, 'scalability': 75, 'compliance-coverage': 95 },
      constraintsMet: { 'data-residency': true },
      planguageEntries: [
        { id: 'F.1', type: 'F', tag: 'F.1', description: 'Managed Private Cloud Provisioning', confidence: 'high' },
        { id: 'C.1', type: 'C', tag: 'C.1', description: 'Must select provider with ISO 27001 and SOC 2 Type II certification', confidence: 'high' },
      ],
      pros: ['Meets data residency requirements', 'Better scalability than on-prem', 'Highest compliance coverage from specialised provider'],
      cons: ['Higher cost than SaaS', 'Vendor dependency (though more controllable)', 'Provider selection risk'],
      feasibilityScore: 88,
      valueScore: 81,
      recommendation: 'Managed Private Cloud is the recommended option — it satisfies data residency, offers strong compliance coverage, and is more scalable than on-prem at a manageable cost premium over SaaS.',
    },
  ]
  return {
    id: 'sample-deployment',
    title: 'SaaS vs Self-Hosted Deployment',
    question: 'Should we deploy on SaaS (cloud-hosted), self-hosted on premises, or a managed private cloud?',
    context: 'Financial services firm, 200 staff, strict data residency requirements, existing on-prem infrastructure.',
    criteria,
    options,
    recommendation: 'Managed Private Cloud is recommended. It is the only option that satisfies both the data residency constraint and delivers strong scalability and compliance coverage. While more expensive than SaaS, the constraint violation disqualifies SaaS, and Managed Private Cloud is more scalable and cost-effective than full on-prem.',
    recommendedOptionId: 'managed-private',
    planguageModel: [
      { id: 'F.1', type: 'F', tag: 'F.1', description: 'Deployment Infrastructure Provisioning', confidence: 'high' },
      { id: 'V.1', type: 'V', tag: 'V.1', description: 'Data Control Level', details: 'Scale: Control score 0-100 · Goal: ≥80 · Tolerable: ≥60', confidence: 'high' },
      { id: 'V.2', type: 'V', tag: 'V.2', description: 'Operational Cost', details: 'Scale: USD thousands/year · Goal: ≤$300K · Tolerable: ≤$500K', confidence: 'medium' },
      { id: 'C.1', type: 'C', tag: 'C.1', description: 'Must meet data residency requirements for EU financial data', confidence: 'high' },
    ],
    analysisStatus: 'done',
    redoStatus: 'idle',
    createdAt: 2,
  }
}

// ── Boot: load from localStorage ──────────────────────────────────────────────

_loadDecisions()

// ── Main AI flow: analyse a decision ─────────────────────────────────────────

async function analyseDecision(question: string, context: string, signal?: AbortSignal): Promise<void> {
  const decisionId = `decision-${Date.now()}`
  const newDecision: DecisionModel = {
    id: decisionId,
    title: question.slice(0, 60),
    question,
    context,
    criteria: [],
    options: [],
    recommendation: '',
    recommendedOptionId: '',
    planguageModel: [],
    analysisStatus: 'analysing',
    redoStatus: 'idle',
    createdAt: Date.now(),
  }
  decisions.value = [newDecision, ...decisions.value]
  selectedDecisionId.value = decisionId
  _saveDecisions()

  try {
    const client = _getClient()
    // r41 v271 (Tom Gilb 2026-06-21 "sweep the rest"): canonical primer imported.
    const system = `You are an expert decision analyst trained in Tom Gilb's Planguage and Competitive Engineering.

== DECISION-MAPPER INPUT FORMAT (input shape for this caller) ==
The input is a decision question + context. Build a structured decision
model: 3-5 options · 4-8 criteria (mix of V. value criteria and C.
constraints) · score each option × criterion (0-100) · build a Planguage
model of the decision space · recommend the best option with rationale.

${CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT}

== DECISION-MAPPER SPECIFIC NOTES ==
- V. criteria carry Scale + Direction (higher/lower better) per the canonical V. parameter set.
- C. criteria are binary met/not-met constraints starting with "Must" / "Must not".
- Each option becomes a Planguage Solution (per the 26-parameter inventory in the canonical) — populate at least Tier 1 fields.
- Return ONLY valid JSON — no prose, no fences.`

    const user = `Analyse this decision:

Question: ${question}
Context: ${context}

Return JSON exactly:
{
  "title": "<short decision title>",
  "criteria": [
    { "id": "<slug>", "label": "<label>", "type": "value|constraint", "weight": <0-1>, "description": "...", "scale": "<optional scale>", "direction": "higher-better|lower-better" }
  ],
  "options": [
    {
      "id": "<slug>", "label": "<option name>", "description": "<2-3 sentences>",
      "scores": { "<criterionId>": <0-100> },
      "constraintsMet": { "<constraintCriterionId>": true|false },
      "planguageEntries": [ { "type": "F|V|C|R", "tag": "F.1", "description": "...", "details": "...", "confidence": "high|medium|low" } ],
      "pros": ["...", "...", "..."],
      "cons": ["...", "...", "..."],
      "feasibilityScore": <0-100>,
      "valueScore": <0-100>,
      "recommendation": "<2-sentence assessment>"
    }
  ],
  "recommendation": "<full rationale for the recommended option>",
  "recommendedOptionId": "<id of recommended option>",
  "planguageModel": [ { "type": "F|V|C|R", "tag": "F.1", "description": "...", "details": "...", "confidence": "high|medium|low" } ]
}`

    const resp = await client.messages.create(
      { model: MODEL_ID, max_tokens: 6144, system, messages: [{ role: 'user', content: user }] },
      { signal },
    )

    const text = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    const parsed = _extractJson<RawDecision>(text)
    const built = _buildDecisionFromRaw(parsed, question, context, decisionId)
    _updateDecision(decisionId, built)
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') {
      _updateDecision(decisionId, { analysisStatus: 'error', analysisError: 'Analysis cancelled' })
      return
    }
    _updateDecision(decisionId, {
      analysisStatus: 'error',
      analysisError: err instanceof Error ? err.message : 'AI analysis failed',
    })
  }
}

// ── Redo decision with new instructions ───────────────────────────────────────

async function redoDecision(id: string, instructions: string, signal?: AbortSignal): Promise<void> {
  const decision = decisions.value.find(d => d.id === id)
  if (!decision) return
  _updateDecision(id, { redoStatus: 'redoing' })

  try {
    const client = _getClient()
    const system = `You are re-analysing a decision model based on new instructions. Apply the instructions to update the analysis — e.g. if told to "add a cost constraint", add it; if told to "consider a new option X", add it; if told to "weight innovation higher", adjust weights. Return the full updated model as JSON.`

    const currentJson = JSON.stringify({
      criteria: decision.criteria,
      options: decision.options.map(o => ({ id: o.id, label: o.label, description: o.description, scores: o.scores, constraintsMet: o.constraintsMet, pros: o.pros, cons: o.cons, feasibilityScore: o.feasibilityScore, valueScore: o.valueScore })),
      recommendedOptionId: decision.recommendedOptionId,
    }, null, 2)

    const user = `Re-analyse this decision with the following new instructions:

Instructions: ${instructions}

Original question: ${decision.question}
Original context: ${decision.context}

Current model:
${currentJson}

Return the full updated model in the same JSON format as before.`

    const resp = await client.messages.create(
      { model: MODEL_ID, max_tokens: 6144, system, messages: [{ role: 'user', content: user }] },
      { signal },
    )

    const text = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    const parsed = _extractJson<RawDecision>(text)
    const built = _buildDecisionFromRaw(parsed, decision.question, decision.context, id)
    _updateDecision(id, { ...built, redoStatus: 'done' })
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') {
      _updateDecision(id, { redoStatus: 'idle' })
      return
    }
    _updateDecision(id, { redoStatus: 'error' })
  }
}

// ── Compare with an external plan ─────────────────────────────────────────────

async function compareWithPlan(id: string, planText: string, signal?: AbortSignal): Promise<void> {
  const decision = decisions.value.find(d => d.id === id)
  if (!decision) return
  _updateDecision(id, { comparisonText: planText })

  try {
    const client = _getClient()
    const system = `Given a decision model and an external plan text, analyse how each decision option would affect the external plan. Would the option advance or hinder the plan's F./V./C. entries? Return a structured comparison with per-option assessment. Return ONLY valid JSON.`

    const optionsSummary = decision.options.map(o => `${o.label}: ${o.description}`).join('\n')
    const user = `Compare these decision options against this external plan:

DECISION QUESTION: ${decision.question}

OPTIONS:
${optionsSummary}

EXTERNAL PLAN TEXT:
${planText}

Return JSON:
{
  "comparisonAnalysis": "<multi-paragraph comparison text showing how each option advances or hinders the plan's goals, one section per option>"
}`

    const resp = await client.messages.create(
      { model: MODEL_ID, max_tokens: 2048, system, messages: [{ role: 'user', content: user }] },
      { signal },
    )

    const text = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    type CompareResult = { comparisonAnalysis: string }
    const parsed = _extractJson<CompareResult>(text)
    _updateDecision(id, { comparisonAnalysis: String(parsed.comparisonAnalysis ?? '') })
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') return
    // Non-fatal — log only
    console.error('[useDecisionMapper] compareWithPlan error:', err)
  }
}

// ── Decision management ───────────────────────────────────────────────────────

function removeDecision(id: string): void {
  decisions.value = decisions.value.filter(d => d.id !== id)
  if (selectedDecisionId.value === id) {
    selectedDecisionId.value = decisions.value[0]?.id ?? null
  }
  _saveDecisions()
}

function selectDecision(id: string | null): void {
  selectedDecisionId.value = id
}

function loadSampleBuildVsBuy(): void {
  const existing = decisions.value.find(d => d.id === 'sample-build-vs-buy')
  if (!existing) {
    decisions.value = [_buildSampleBuildVsBuy(), ...decisions.value]
    _saveDecisions()
  }
  selectedDecisionId.value = 'sample-build-vs-buy'
}

function loadSampleDeployment(): void {
  const existing = decisions.value.find(d => d.id === 'sample-deployment')
  if (!existing) {
    decisions.value = [_buildSampleSaasVsSelfHosted(), ...decisions.value]
    _saveDecisions()
  }
  selectedDecisionId.value = 'sample-deployment'
}

// ── Public composable ─────────────────────────────────────────────────────────

export function useDecisionMapper() {
  return {
    decisions,
    selectedDecisionId,
    selectedDecision,
    analyseDecision,
    redoDecision,
    compareWithPlan,
    removeDecision,
    selectDecision,
    loadSampleBuildVsBuy,
    loadSampleDeployment,
  }
}
