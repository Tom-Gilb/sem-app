/**
 * usePlanImporter — Universal Planguage plan converter + improvement loop.
 *
 * Accepts any text input (business brief, strategy doc, rough notes, uploaded file).
 * Converts it to structured Planguage F./V./C./R./S. entries, then analyses for
 * problems and inconsistencies. User can accept AI improvement suggestions OR
 * type their own commands (e.g. "simplify V.3", "add missing values",
 * "make the goal more ambitious", "innovate around F.2").
 * Each improvement creates a new PlanVersion — full history preserved.
 *
 * Singleton, localStorage key 'sem-plan-importer-v1'.
 */

import Anthropic from '@anthropic-ai/sdk'
import { ref, computed } from 'vue'
import { MODEL_ID } from '../config/llm'

// ── Public types ──────────────────────────────────────────────────────────────

export interface PlanguagizedEntry {
  id: string           // e.g. "F.1", "V.3"
  type: 'F' | 'V' | 'C' | 'R' | 'S'
  tag: string          // same as id, e.g. "F.1"
  description: string
  /** For V: "Scale: X · Meter: Y · Goal: Z · Tolerable: W · Wish: Q"
      For C: constraint statement
      For R: resource description */
  details?: string
  sourceText?: string  // snippet of original text this was derived from
  confidence: 'high' | 'medium' | 'low'
}

export interface PlanProblem {
  id: string
  severity: 'critical' | 'major' | 'minor' | 'opportunity'
  category: 'missing-field' | 'ambiguity' | 'inconsistency' | 'gap' | 'improvement'
  entryRef?: string    // e.g. "V.2" — null if plan-wide
  description: string  // what the problem is
  suggestion: string   // concrete suggestion to fix it
  applied: boolean     // true if user applied this suggestion
}

export interface PlanVersion {
  id: string
  versionNumber: number
  label: string        // "Original" | "After AI Suggestions" | user command text
  entries: PlanguagizedEntry[]
  problems: PlanProblem[]
  overallScore: number // 0-100 quality score
  createdAt: string    // ISO
  changeCommand?: string   // the command that produced this version
  changeType: 'original' | 'ai-improve' | 'user-command'
}

export interface ImportedPlan {
  id: string
  title: string
  originalText: string
  versions: PlanVersion[]
  currentVersionId: string
  importStatus: 'idle' | 'importing' | 'analysing' | 'done' | 'error'
  importError?: string
  improvingStatus: 'idle' | 'improving' | 'error'
  improvingError?: string
  createdAt: number
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-plan-importer-v1'

// ── Module-level singleton state ──────────────────────────────────────────────

const plans = ref<ImportedPlan[]>([])
const selectedPlanId = ref<string | null>(null)
const _abortController = ref<AbortController | null>(null)

// ── Computed ──────────────────────────────────────────────────────────────────

const selectedPlan = computed<ImportedPlan | null>(
  () => plans.value.find(p => p.id === selectedPlanId.value) ?? null,
)

const currentVersion = computed<PlanVersion | null>(() => {
  const plan = selectedPlan.value
  if (!plan) return null
  return plan.versions.find(v => v.id === plan.currentVersionId) ?? plan.versions[0] ?? null
})

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
    sourceText: raw.sourceText != null ? String(raw.sourceText) : undefined,
    confidence: (['high','medium','low'].includes(String(raw.confidence)) ? raw.confidence : 'medium') as PlanguagizedEntry['confidence'],
  }
}

function _buildProblem(raw: Record<string, unknown>, idx: number): PlanProblem {
  return {
    id: `problem-${idx}-${Date.now()}`,
    severity: (['critical','major','minor','opportunity'].includes(String(raw.severity)) ? raw.severity : 'minor') as PlanProblem['severity'],
    category: (['missing-field','ambiguity','inconsistency','gap','improvement'].includes(String(raw.category)) ? raw.category : 'improvement') as PlanProblem['category'],
    entryRef: raw.entryRef != null ? String(raw.entryRef) : undefined,
    description: String(raw.description ?? ''),
    suggestion: String(raw.suggestion ?? ''),
    applied: false,
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

function savePlans(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.value))
}

function loadPlans(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ImportedPlan[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        plans.value = parsed
        // Restore idle/error statuses (don't restore in-progress states)
        for (const p of plans.value) {
          if (p.importStatus === 'importing' || p.importStatus === 'analysing') {
            p.importStatus = 'error'
            p.importError = 'Import interrupted — please retry'
          }
          if (p.improvingStatus === 'improving') {
            p.improvingStatus = 'error'
            p.improvingError = 'Improvement interrupted — please retry'
          }
        }
        return
      }
    }
  } catch {
    // ignore parse errors — fall through to empty
  }
  plans.value = []
}

// ── Pre-loaded sample plans ───────────────────────────────────────────────────

function _buildSampleHotelPlan(): ImportedPlan {
  const now = new Date().toISOString()
  const entries: PlanguagizedEntry[] = [
    { id: 'F.1', type: 'F', tag: 'F.1', description: 'Carbon Monitoring', details: undefined, sourceText: 'reduce carbon emissions by 50% by 2030', confidence: 'high' },
    { id: 'F.2', type: 'F', tag: 'F.2', description: 'EV Charging', details: undefined, sourceText: 'EV charging', confidence: 'high' },
    { id: 'F.3', type: 'F', tag: 'F.3', description: 'Local Sourcing', details: undefined, sourceText: 'local sourcing', confidence: 'medium' },
    { id: 'V.1', type: 'V', tag: 'V.1', description: 'CO₂ Reduction', details: 'Scale: % reduction vs baseline · Meter: Annual carbon audit · Goal: 50% by 2030 · Tolerable: 30% by 2030', sourceText: 'reduce carbon emissions by 50% by 2030', confidence: 'high' },
    { id: 'V.2', type: 'V', tag: 'V.2', description: 'Guest Experience', details: 'Scale: Rating 1–5 · Meter: Guest survey score · Goal: ≥4.8 · Tolerable: ≥4.5', sourceText: 'maintaining 5-star guest experience ratings above 4.8/5', confidence: 'high' },
    { id: 'C.1', type: 'C', tag: 'C.1', description: 'Must comply with EU Green Deal regulations', details: 'Regulatory compliance constraint — binary', sourceText: 'comply with EU Green Deal regulations', confidence: 'high' },
    { id: 'R.1', type: 'R', tag: 'R.1', description: 'Green Initiatives Budget', details: '€2M over 3 years for sustainability initiatives', sourceText: 'Budget for green initiatives: €2M over 3 years', confidence: 'high' },
  ]
  const problems: PlanProblem[] = [
    { id: 'p1', severity: 'major', category: 'missing-field', entryRef: 'V.1', description: 'V.1 CO₂ Reduction is missing a Meter — how will carbon emissions be measured in practice?', suggestion: 'Add Meter: "Third-party carbon audit report, annual" to V.1', applied: false },
    { id: 'p2', severity: 'minor', category: 'ambiguity', entryRef: 'F.3', description: 'F.3 Local Sourcing is vague — no measurable target for what percentage of sourcing must be local', suggestion: 'Either move the quantitative target to a V. entry (e.g. V.3: Local Sourcing Rate, Scale: % spend, Goal: ≥60%) or add a detail to F.3', applied: false },
    { id: 'p3', severity: 'minor', category: 'gap', entryRef: undefined, description: 'No Stakeholder (S.) entry for hotel guests, who are directly affected by both sustainability actions and experience targets', suggestion: 'Add S.1: Guests — with linked values V.2 Guest Experience', applied: false },
  ]
  const version: PlanVersion = {
    id: 'v1-hotel',
    versionNumber: 1,
    label: 'Original',
    entries,
    problems,
    overallScore: 68,
    createdAt: now,
    changeType: 'original',
  }
  return {
    id: 'sample-hotel',
    title: 'Hotel CO₂ Reduction Strategy',
    originalText: 'The Grand Alpine Hotel aims to reduce carbon emissions by 50% by 2030 while maintaining 5-star guest experience ratings above 4.8/5. We must comply with EU Green Deal regulations. Budget for green initiatives: €2M over 3 years. We want to be the most sustainable luxury hotel in the Alps. Solutions include solar panels, EV charging, local sourcing, and staff training.',
    versions: [version],
    currentVersionId: 'v1-hotel',
    importStatus: 'done',
    improvingStatus: 'idle',
    createdAt: 1,
  }
}

function _buildSampleHabitPlan(): ImportedPlan {
  const now = new Date().toISOString()
  const entries: PlanguagizedEntry[] = [
    { id: 'F.1', type: 'F', tag: 'F.1', description: 'Habit Tracking', details: undefined, sourceText: 'habit tracking', confidence: 'high' },
    { id: 'F.2', type: 'F', tag: 'F.2', description: 'Reminder System', details: undefined, sourceText: 'reminders', confidence: 'high' },
    { id: 'F.3', type: 'F', tag: 'F.3', description: 'Social Sharing', details: undefined, sourceText: 'social sharing', confidence: 'high' },
    { id: 'F.4', type: 'F', tag: 'F.4', description: 'Offline Mode', details: undefined, sourceText: 'Must work offline', confidence: 'high' },
    { id: 'V.1', type: 'V', tag: 'V.1', description: 'User Acquisition', details: 'Scale: Total registered users · Meter: App analytics dashboard · Goal: 100K · Tolerable: 50K', sourceText: 'Target: 100K users year 1', confidence: 'high' },
    { id: 'V.2', type: 'V', tag: 'V.2', description: 'Load Performance', details: 'Scale: App launch time in seconds · Meter: P95 cold start time · Goal: ≤2s · Tolerable: ≤3s', sourceText: 'under 2s load', confidence: 'high' },
    { id: 'V.3', type: 'V', tag: 'V.3', description: 'Revenue', details: 'Scale: Monthly recurring revenue USD · Meter: Stripe MRR dashboard · Goal: $499K/mo · Tolerable: $100K/mo', sourceText: 'Revenue from premium subscription at $4.99/month', confidence: 'medium' },
    { id: 'C.1', type: 'C', tag: 'C.1', description: 'Must comply with WCAG 2.1 AA accessibility standard', details: 'All UI components must pass WCAG 2.1 Level AA automated and manual tests', sourceText: 'accessible to all users including disabled users', confidence: 'high' },
    { id: 'R.1', type: 'R', tag: 'R.1', description: 'Year 1 Revenue Target', details: '$499K annually (100K users × $4.99/mo × 12 months theoretical maximum)', sourceText: 'Revenue from premium subscription at $4.99/month', confidence: 'low' },
  ]
  const problems: PlanProblem[] = [
    { id: 'p1', severity: 'major', category: 'missing-field', entryRef: 'V.1', description: 'V.1 User Acquisition is missing a Meter — analytics dashboard is named but the specific metric (DAU? registered?) is not defined', suggestion: 'Add Meter: "Registered users count, App Store Connect + backend analytics, measured weekly"', applied: false },
    { id: 'p2', severity: 'minor', category: 'ambiguity', entryRef: 'C.1', description: 'C.1 accessibility constraint scope is unclear — does it apply to the entire app, or just specific screens?', suggestion: 'Specify Scope: "All public-facing screens including onboarding, habit entry, and dashboard" for C.1', applied: false },
  ]
  const version: PlanVersion = {
    id: 'v1-habit',
    versionNumber: 1,
    label: 'Original',
    entries,
    problems,
    overallScore: 74,
    createdAt: now,
    changeType: 'original',
  }
  return {
    id: 'sample-habit',
    title: 'Mobile Habit Tracker App Brief',
    originalText: "We're building a mobile app to help users build better daily habits. Key features: habit tracking, reminders, streaks, social sharing. Must work offline. Target: 100K users year 1. The app must be fast (under 2s load), beautiful, and accessible to all users including disabled users. Revenue from premium subscription at $4.99/month.",
    versions: [version],
    currentVersionId: 'v1-habit',
    importStatus: 'done',
    improvingStatus: 'idle',
    createdAt: 2,
  }
}

// ── Boot: load from localStorage ──────────────────────────────────────────────

loadPlans()
// Auto-select the first plan so the panel is never blank when plans exist.
// loadPlans() restores the plans array but does NOT restore selectedPlanId
// (not persisted), so without this, MODE B renders with selectedPlan=null
// and all content branches are skipped → blank white panel body.
if (plans.value.length > 0 && selectedPlanId.value === null) {
  selectedPlanId.value = plans.value[0].id
}

// ── Plan mutation helpers ─────────────────────────────────────────────────────

function _updatePlan(id: string, patch: Partial<ImportedPlan>): void {
  const idx = plans.value.findIndex(p => p.id === id)
  if (idx === -1) return
  plans.value[idx] = { ...plans.value[idx], ...patch }
  savePlans()
}

// ── Main AI flow: import text → convert → analyse ─────────────────────────────

async function importAndConvert(text: string, signal?: AbortSignal): Promise<void> {
  const planId = `plan-${Date.now()}`
  const newPlan: ImportedPlan = {
    id: planId,
    title: 'Untitled Plan',
    originalText: text,
    versions: [],
    currentVersionId: '',
    importStatus: 'importing',
    improvingStatus: 'idle',
    createdAt: Date.now(),
  }
  plans.value = [newPlan, ...plans.value]
  selectedPlanId.value = planId
  savePlans()

  try {
    const client = _getClient()

    // ── STEP 1: Convert ──────────────────────────────────────────────────────

    const convertSystem = `You are an expert Planguage analyst trained in Tom Gilb's Competitive Engineering. Convert any input text into structured Planguage entries. Rules: F. entries are BINARY (present or absent) — description is a bare-noun capability; V. entries have Scale/Meter/Goal/Tolerable (all required); C. entries use "Must [not]..." form; R. entries describe budgets/quantities; S. entries are stakeholder-specific capabilities. Be thorough — extract ALL implied values and constraints, not just explicit ones. Return ONLY valid JSON.`

    const convertUser = `Convert this text to Planguage entries:

${text}

Return JSON exactly:
{
  "title": "<extracted or inferred plan title>",
  "entries": [
    { "type": "F|V|C|R|S", "tag": "F.1", "description": "...", "details": "<for V: Scale/Meter/Goal/Tolerable; for C: constraint; for R: budget>", "sourceText": "<snippet>", "confidence": "high|medium|low" }
  ]
}`

    const convertResp = await client.messages.create(
      { model: MODEL_ID, max_tokens: 4096, system: convertSystem, messages: [{ role: 'user', content: convertUser }] },
      { signal },
    )

    const convertText = convertResp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    type ConvertResult = { title: string; entries: Record<string, unknown>[] }
    const convertParsed = _extractJson<ConvertResult>(convertText)
    const entries = (convertParsed.entries ?? []).map((e, i) => _buildEntry(e as Record<string, unknown>, i))
    const title = String(convertParsed.title ?? 'Imported Plan')

    _updatePlan(planId, { title, importStatus: 'analysing' })

    // ── STEP 2: Analyse ──────────────────────────────────────────────────────

    const analyseSystem = `You are a Planguage quality critic. Analyse the converted plan for: missing required fields, vague/unmeasurable values (V. without Scale or Goal), functions that are actually values, constraints that are vague, missing constraint coverage, internal inconsistencies between entries, and improvement opportunities. Score overall quality 0-100. Return ONLY valid JSON.`

    const entriesSummary = entries.map(e => `${e.tag}: ${e.description}${e.details ? ' — ' + e.details : ''}`).join('\n')
    const analyseUser = `Analyse these Planguage entries for quality problems:

${entriesSummary}

Return JSON exactly:
{
  "overallScore": <0-100>,
  "problems": [
    { "severity": "critical|major|minor|opportunity", "category": "missing-field|ambiguity|inconsistency|gap|improvement", "entryRef": "V.2 or null", "description": "...", "suggestion": "..." }
  ]
}`

    const analyseResp = await client.messages.create(
      { model: MODEL_ID, max_tokens: 2048, system: analyseSystem, messages: [{ role: 'user', content: analyseUser }] },
      { signal },
    )

    const analyseText = analyseResp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    type AnalyseResult = { overallScore: number; problems: Record<string, unknown>[] }
    const analyseParsed = _extractJson<AnalyseResult>(analyseText)
    const problems = (analyseParsed.problems ?? []).map((p, i) => _buildProblem(p as Record<string, unknown>, i))
    const overallScore = Math.min(100, Math.max(0, Number(analyseParsed.overallScore ?? 50)))

    const version: PlanVersion = {
      id: `v1-${planId}`,
      versionNumber: 1,
      label: 'Original',
      entries,
      problems,
      overallScore,
      createdAt: new Date().toISOString(),
      changeType: 'original',
    }

    _updatePlan(planId, {
      title,
      versions: [version],
      currentVersionId: version.id,
      importStatus: 'done',
    })
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') {
      _updatePlan(planId, { importStatus: 'error', importError: 'Import cancelled' })
      return
    }
    _updatePlan(planId, {
      importStatus: 'error',
      importError: err instanceof Error ? err.message : 'AI conversion failed',
    })
  }
}

// ── Improve with a user command ───────────────────────────────────────────────

async function improveWithCommand(planId: string, command: string, signal?: AbortSignal): Promise<void> {
  const plan = plans.value.find(p => p.id === planId)
  if (!plan) return
  const baseVersion = plan.versions.find(v => v.id === plan.currentVersionId) ?? plan.versions[plan.versions.length - 1]
  if (!baseVersion) return

  _updatePlan(planId, { improvingStatus: 'improving', improvingError: undefined })

  try {
    const client = _getClient()

    const system = `You are an expert Planguage improver. Apply the improvement command to the plan. Preserve entries not mentioned in the command. For "simplify": reduce jargon, tighten descriptions. For "innovate": add ambitious new value entries and solutions. For specific entry edits: target only that entry. Return the complete updated entry list as JSON.`

    const entriesJson = JSON.stringify(baseVersion.entries, null, 2)
    const user = `Apply this improvement command to the Planguage plan:

Command: ${command}

Current entries:
${entriesJson}

Return JSON exactly:
{
  "entries": [ ...same shape as input... ],
  "changeLabel": "<label describing what changed, e.g. 'After simplification'>"
}`

    const resp = await client.messages.create(
      { model: MODEL_ID, max_tokens: 4096, system, messages: [{ role: 'user', content: user }] },
      { signal },
    )

    const text = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    type ImproveResult = { entries: Record<string, unknown>[]; changeLabel: string }
    const parsed = _extractJson<ImproveResult>(text)
    const newEntries = (parsed.entries ?? []).map((e, i) => _buildEntry(e as Record<string, unknown>, i))
    const changeLabel = String(parsed.changeLabel ?? command)

    // Re-analyse the improved version
    const analyseSystem = `You are a Planguage quality critic. Analyse the entries for problems. Score 0-100. Return ONLY valid JSON.`
    const entriesSummary = newEntries.map(e => `${e.tag}: ${e.description}${e.details ? ' — ' + e.details : ''}`).join('\n')
    const analyseResp = await client.messages.create(
      { model: MODEL_ID, max_tokens: 1024, system: analyseSystem, messages: [{ role: 'user', content: `Analyse these:\n${entriesSummary}\n\nReturn: { "overallScore": <0-100>, "problems": [{ "severity": "...", "category": "...", "entryRef": "...", "description": "...", "suggestion": "..." }] }` }] },
      { signal },
    )
    const analyseText = analyseResp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    type AnalyseResult = { overallScore: number; problems: Record<string, unknown>[] }
    let newProblems: PlanProblem[] = []
    let newScore = 70
    try {
      const analyseParsed = _extractJson<AnalyseResult>(analyseText)
      newProblems = (analyseParsed.problems ?? []).map((p, i) => _buildProblem(p as Record<string, unknown>, i))
      newScore = Math.min(100, Math.max(0, Number(analyseParsed.overallScore ?? 70)))
    } catch {
      // fallback — keep empty problems
    }

    const versionNumber = (plan.versions.length ?? 0) + 1
    const newVersion: PlanVersion = {
      id: `v${versionNumber}-${planId}-${Date.now()}`,
      versionNumber,
      label: changeLabel,
      entries: newEntries,
      problems: newProblems,
      overallScore: newScore,
      createdAt: new Date().toISOString(),
      changeCommand: command,
      changeType: 'user-command',
    }

    const currentPlan = plans.value.find(p => p.id === planId)
    if (!currentPlan) return
    const updatedVersions = [...currentPlan.versions, newVersion]
    _updatePlan(planId, {
      versions: updatedVersions,
      currentVersionId: newVersion.id,
      improvingStatus: 'idle',
    })
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'AbortError') {
      _updatePlan(planId, { improvingStatus: 'idle' })
      return
    }
    _updatePlan(planId, {
      improvingStatus: 'error',
      improvingError: err instanceof Error ? err.message : 'AI improvement failed',
    })
  }
}

// ── Apply a specific PlanProblem suggestion ───────────────────────────────────

async function applySuggestion(planId: string, problem: PlanProblem): Promise<void> {
  const plan = plans.value.find(p => p.id === planId)
  if (!plan) return

  // Mark the problem as applied in the current version
  const currentPlan = plans.value.find(p => p.id === planId)
  if (!currentPlan) return
  const versionIdx = currentPlan.versions.findIndex(v => v.id === currentPlan.currentVersionId)
  if (versionIdx === -1) return

  const updatedVersions = [...currentPlan.versions]
  const updatedProblems = updatedVersions[versionIdx].problems.map(p =>
    p.id === problem.id ? { ...p, applied: true } : p,
  )
  updatedVersions[versionIdx] = { ...updatedVersions[versionIdx], problems: updatedProblems }
  _updatePlan(planId, { versions: updatedVersions })

  // Apply via the improve command with the suggestion text
  await improveWithCommand(planId, `Apply this suggestion: ${problem.suggestion}`)
}

// ── Plan management ───────────────────────────────────────────────────────────

function removePlan(id: string): void {
  plans.value = plans.value.filter(p => p.id !== id)
  if (selectedPlanId.value === id) {
    selectedPlanId.value = plans.value[0]?.id ?? null
  }
  savePlans()
}

function selectPlan(id: string | null): void {
  selectedPlanId.value = id
}

/**
 * Restore a specific version of a plan as the active view, without discarding
 * the version history.  Used by HistoryPanel to jump to any past snapshot.
 */
function setCurrentVersion(planId: string, versionId: string): void {
  const plan = plans.value.find(p => p.id === planId)
  if (!plan) return
  const versionExists = plan.versions.some(v => v.id === versionId)
  if (!versionExists) return
  plan.currentVersionId = versionId
  selectedPlanId.value  = planId
  savePlans()
}

function cancelImport(): void {
  _abortController.value?.abort()
  _abortController.value = null
}

// ── Load sample plans ─────────────────────────────────────────────────────────

function loadSampleHotel(): void {
  const existing = plans.value.find(p => p.id === 'sample-hotel')
  if (!existing) {
    plans.value = [_buildSampleHotelPlan(), ...plans.value]
    savePlans()
  }
  selectedPlanId.value = 'sample-hotel'
}

function loadSampleHabit(): void {
  const existing = plans.value.find(p => p.id === 'sample-habit')
  if (!existing) {
    plans.value = [_buildSampleHabitPlan(), ...plans.value]
    savePlans()
  }
  selectedPlanId.value = 'sample-habit'
}

// ── Public composable ─────────────────────────────────────────────────────────

export function usePlanImporter() {
  return {
    plans,
    selectedPlanId,
    selectedPlan,
    currentVersion,
    importAndConvert,
    improveWithCommand,
    applySuggestion,
    removePlan,
    selectPlan,
    setCurrentVersion,
    cancelImport,
    loadSampleHotel,
    loadSampleHabit,
    savePlans,
    loadPlans,
  }
}
