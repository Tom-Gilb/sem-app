<!-- UNIT_TYPE=Panel -->
<!--
  AutoDboPanel — Design By Objectives workspace.

  Tom Gilb 2026-06-07: "Auto-DBO: I want to create a new tool, which is specialised
  in Design, finding Solutions. The designs will not immediately be adopted in the
  Master Planguage specs. They must be approved and saved. We should be able to
  speculatively edit the Master Planguage spec (without changing it officially, yet)."

  Named after Lech Krzanik's Apple II Forth tool built for Tom Gilb, circa 1978.
  Reference: [Krzanik] in bibliography.

  Four tabs:
    Library   — list of all Solution Versions; create / fork / delete / approve
    Workshop  — speculative editor for the active version's Solutions
    Sharpen   — 9 DBO sharpening dimensions with Claudian prompt builder
    Compare   — IET matrix: versions × Values

  Rules complied with:
    - Single-Surface rule — App.vue registers autoDboOpen with registerExclusiveSurface
    - CloseDot rule — <CloseDot size="lg"> at END of header flex + backdrop + Escape
    - ScrollContainer rule — tab content wrapped in <ScrollContainer>
    - MOVE principle — Library tab has Create button at top AND instructions visible
    - Planguage-Glyph-First — uses PlSolutionIcon
    - Banned-Scrum-Vocabulary — no sprint/backlog/story/velocity
    - Top-and-Bottom Navigation Mirror — nav in Compare tab mirrored
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import PlSolutionIcon from './icons/PlSolutionIcon.vue'
import {
  useAutoDbo,
} from '../composables/useAutoDbo'
import Anthropic from '@anthropic-ai/sdk'
import { MODEL_ID } from '../config/llm'
import SharpenDiffList from './SharpenDiffList.vue'
import type { SharpenChangedEntry, SharpenRound } from '../composables/useSharpen'
import {
  DBO_SHARPEN_DIMENSIONS,
  DBO_SHARPEN_DIMENSION_KEYS,
  SOLUTION_VERSION_STATUS_META,
  SOLUTION_VERSION_PURPOSE_LABELS,
  type SolutionVersion,
  type SolutionVersionPurpose,
  type DboSharpenDimension,
} from '../types/autoDbo'
import type { SpecBlock, SEntry } from '../types/spec'

// ── Props & Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  open: boolean
  /** The current master spec — used as the source for new version snapshots */
  masterSpec: SpecBlock | null
}>()

const emit = defineEmits<{
  close: []
  /** Emitted when user approves a version — caller should apply to currentSpec */
  'approve-to-master': [specSnapshot: SpecBlock]
  /** Emitted when user saves a Design Version as a brand-new plan with a different title + stewards */
  'save-as-new-plan': [payload: { spec: SpecBlock; planName: string; planOwners: string[] }]
}>()

// ── Tab state ─────────────────────────────────────────────────────────────────

type DboTab = 'library' | 'workshop' | 'sharpen' | 'compare'
const activeTab = ref<DboTab>('library')

// ── Composable ────────────────────────────────────────────────────────────────

const {
  versions,
  activeVersion,
  draftCount,
  approvedCount,
  createVersion,
  forkVersion,
  updateVersion,
  deleteVersion,
  setActiveVersion,
  approveVersion,
  deprecateVersion,
  addSharpenRecord,
  setImpactEstimate,
} = useAutoDbo()

// ── Panel cleanup on close ────────────────────────────────────────────────────

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    showNewForm.value = false
    showForkForm.value = false
    sharpenSelectedDim.value = null
    approveNote.value = ''
    compareSelectedIds.value = []
    showSaveAsNewPlanForm.value = false
    saveAsNewPlanTitle.value    = ''
    saveAsNewPlanOwners.value   = ''
    dboSelectedChips.value = []
  }
})

// ── Library tab state ─────────────────────────────────────────────────────────

const showNewForm   = ref(false)
const showForkForm  = ref(false)
const forkSourceId  = ref<string | null>(null)
const filterStatus  = ref<'all' | 'draft' | 'approved' | 'deprecated'>('all')

const newForm = ref({
  name:           '',
  purpose:        'thought-experiment' as SolutionVersionPurpose,
  purposeCustom:  '',
  description:    '',
})

const forkForm = ref({
  name:          '',
  purpose:       'thought-experiment' as SolutionVersionPurpose,
  purposeCustom: '',
  description:   '',
})

const filteredVersions = computed(() =>
  filterStatus.value === 'all'
    ? versions.value
    : versions.value.filter(v => v.status === filterStatus.value),
)

function handleCreate(): void {
  if (!props.masterSpec) return
  if (!newForm.value.name.trim()) return
  createVersion(props.masterSpec, {
    name:          newForm.value.name.trim(),
    purpose:       newForm.value.purpose,
    purposeCustom: newForm.value.purposeCustom,
    description:   newForm.value.description,
  })
  newForm.value = { name: '', purpose: 'thought-experiment', purposeCustom: '', description: '' }
  showNewForm.value = false
  activeTab.value = 'workshop'
}

function handleFork(fromId: string): void {
  forkSourceId.value = fromId
  const source = versions.value.find(v => v.id === fromId)
  forkForm.value = {
    name:          `Fork of ${source?.name ?? ''}`,
    purpose:       source?.purpose ?? 'thought-experiment',
    purposeCustom: source?.purposeCustom ?? '',
    description:   '',
  }
  showForkForm.value = true
}

function submitFork(): void {
  if (!forkSourceId.value || !forkForm.value.name.trim()) return
  forkVersion(forkSourceId.value, {
    name:          forkForm.value.name.trim(),
    purpose:       forkForm.value.purpose,
    purposeCustom: forkForm.value.purposeCustom,
    description:   forkForm.value.description,
  })
  showForkForm.value = false
  forkSourceId.value = null
  activeTab.value = 'workshop'
}

function openWorkshop(id: string): void {
  setActiveVersion(id)
  activeTab.value = 'workshop'
}

function openSharpen(id: string): void {
  setActiveVersion(id)
  activeTab.value = 'sharpen'
}

const deleteConfirmId = ref<string | null>(null)
function confirmDelete(id: string): void { deleteConfirmId.value = id }
function doDelete(id: string): void { deleteVersion(id); deleteConfirmId.value = null }

const approveNote     = ref('')
const approveTargetId = ref<string | null>(null)
function startApprove(id: string): void { approveTargetId.value = id; approveNote.value = '' }
function submitApprove(): void {
  if (!approveTargetId.value) return
  const snapshot = approveVersion(approveTargetId.value, approveNote.value)
  if (snapshot) emit('approve-to-master', snapshot)
  approveTargetId.value = null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Workshop tab state ────────────────────────────────────────────────────────

// Editing a Solution entry in the active version
const editingSolutionId = ref<string | null>(null)
const editForm = ref<Partial<SEntry>>({})

function startEditSolution(s: SEntry): void {
  editingSolutionId.value = s.id
  editForm.value = { ...s }
}

function saveSolution(): void {
  if (!activeVersion.value || !editingSolutionId.value) return
  const snap: SpecBlock = JSON.parse(JSON.stringify(activeVersion.value.specSnapshot))
  const idx = snap.solutions.findIndex(s => s.id === editingSolutionId.value)
  if (idx >= 0) snap.solutions[idx] = { ...snap.solutions[idx], ...editForm.value } as SEntry
  updateVersion(activeVersion.value.id, { specSnapshot: snap })
  editingSolutionId.value = null
}

function cancelEditSolution(): void { editingSolutionId.value = null }

const showAddSolution = ref(false)
const addSolutionForm = ref<Partial<SEntry>>({
  id: '', type: 'Solution', level: 'Product', description: '', impact: '', function: '',
})

function submitAddSolution(): void {
  if (!activeVersion.value || !addSolutionForm.value.id?.trim()) return
  const snap: SpecBlock = JSON.parse(JSON.stringify(activeVersion.value.specSnapshot))
  snap.solutions.push({
    id:          addSolutionForm.value.id!.trim(),
    type:        'Solution',
    level:       addSolutionForm.value.level ?? 'Product',
    description: addSolutionForm.value.description ?? '',
    impact:      addSolutionForm.value.impact ?? '',
    function:    addSolutionForm.value.function ?? '',
  })
  updateVersion(activeVersion.value.id, { specSnapshot: snap })
  addSolutionForm.value = { id: '', type: 'Solution', level: 'Product', description: '', impact: '', function: '' }
  showAddSolution.value = false
}

function removeSolution(sId: string): void {
  if (!activeVersion.value) return
  const snap: SpecBlock = JSON.parse(JSON.stringify(activeVersion.value.specSnapshot))
  snap.solutions = snap.solutions.filter(s => s.id !== sId)
  updateVersion(activeVersion.value.id, { specSnapshot: snap })
}

// ── Sharpen tab state ─────────────────────────────────────────────────────────

const sharpenSelectedDim = ref<DboSharpenDimension | null>(null)
const sharpenAppliedNote = ref('')
const sharpenCopied      = ref<false | 'version' | 'changes'>(false)

// ── Save-as-New-Plan form state ───────────────────────────────────────────────
// Tom 2026-06-07: "I suspect that we need an option to store a design version
// as a distinct new plan with different title and stewards."
// Emits 'save-as-new-plan' → App.vue calls onHistoryRestore(spec, null, planName, planOwners).
const showSaveAsNewPlanForm = ref(false)
const saveAsNewPlanTitle    = ref('')
const saveAsNewPlanOwners   = ref('')   // comma-separated string → string[] on submit

function submitSaveAsNewPlan(): void {
  const v = activeVersion.value
  if (!v || !saveAsNewPlanTitle.value.trim()) return
  const owners = saveAsNewPlanOwners.value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  emit('save-as-new-plan', {
    spec:       JSON.parse(JSON.stringify(v.specSnapshot)),
    planName:   saveAsNewPlanTitle.value.trim(),
    planOwners: owners,
  })
  // Reset the form — App.vue will close the panel and switch plan context
  showSaveAsNewPlanForm.value = false
  saveAsNewPlanTitle.value    = ''
  saveAsNewPlanOwners.value   = ''
}

const sharpenDimMeta = computed(() =>
  sharpenSelectedDim.value ? DBO_SHARPEN_DIMENSIONS[sharpenSelectedDim.value] : null,
)

// ── DBO sharpening Q&A engine (standalone — same API connection, DBO-specialized prompts) ──
// Tom 2026-06-07: "The same internet access... I want specialised logic for design."
// Uses the same Anthropic SDK + VITE_ANTHROPIC_API_KEY path as useSharpen.ts, but
// with prompts that focus specifically on Solution design trade-offs per DBO dimension.
// Local state — does NOT share the useSharpen singleton, so Stage 2 and Auto-DBO
// never conflict.

type DboInterviewPhase = 'idle' | 'questions' | 'answering' | 'refining'
const dboPhase        = ref<DboInterviewPhase>('idle')
const dboQuestions    = ref<{ text: string; suggestions: string[] }[]>([])
const dboAnswers      = ref<string[]>([])
const dboLoading      = ref(false)
const dboSharpenError = ref('')

// Multi-chip selection state — tracks which chips are active per question.
// Separate from dboAnswers so the user can also type freely in the textarea.
// Tom 2026-06-07: "we should be able to answer with multiple suggested answers."
const dboSelectedChips = ref<string[][]>([])

// Reset answers AND chip selection when a new question set arrives
watch(dboQuestions, (qs) => {
  if (qs.length > 0) {
    dboAnswers.value      = qs.map(() => '')
    dboSelectedChips.value = qs.map(() => [])
  }
})

/**
 * Toggle a suggestion chip for a given question.
 * Multi-select: clicking a chip adds it to the answer; clicking again removes it.
 * Selected chips are joined with ". " and written to dboAnswers[qi].
 * The textarea remains editable — if the user types directly, the chip set may
 * diverge from the textarea but the textarea (source of truth) wins on submit.
 */
function toggleDboChip(qi: number, chip: string): void {
  // Ensure the per-question chip array exists
  if (!dboSelectedChips.value[qi]) dboSelectedChips.value[qi] = []
  const chips = dboSelectedChips.value[qi]
  const idx = chips.indexOf(chip)
  if (idx >= 0) {
    chips.splice(idx, 1)   // deselect
  } else {
    chips.push(chip)       // select
  }
  // Rebuild the answer from selected chips (period-separated for readability)
  dboAnswers.value[qi] = chips.join('. ')
}

// ── DBO loading amuse state (Rule 8: spinner + elapsed + % bar + rotating facts) ─

const DBO_AMUSE_FACTS = [
  '"Good design is a lot like clear thinking made visual." — Edward Tufte',
  'Tom Gilb\'s Auto-DBO method was first implemented in Forth on an Apple II by Lech Krzanik, circa 1978.',
  'Design By Objectives: optimise Solutions against quantified Value targets — not against gut feel.',
  '"The function of good software is to make the complex appear simple." — Grady Booch',
  'A good Solution description names a specific mechanism — not just an intent.',
  'Impact estimates in DBO are directional (±%), not precise commitments — precision comes after delivery.',
  '"It is not enough to do your best; you must know what to do, and then do your best." — W. Edwards Deming',
  'Constraint-compliant solutions only: DBO never proposes designs that violate C. entries.',
  'Sharpening a design dimension means asking: what specific change makes this Solution better on this axis?',
  '"Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away." — Antoine de Saint-Exupéry',
] as const

const dboElapsed      = ref(0)
const dboPct          = ref(0)
const dboAmuseIdx     = ref(0)
let   _dboTimer: ReturnType<typeof setInterval> | null = null
let   _dboAmuseTimer: ReturnType<typeof setInterval> | null = null

function _startAmuseTimers(): void {
  dboElapsed.value  = 0
  dboPct.value      = 0
  dboAmuseIdx.value = Math.floor(Math.random() * DBO_AMUSE_FACTS.length)
  _dboTimer = setInterval(() => {
    dboElapsed.value++
    // Asymptotic progress: approaches 95% but never reaches it until done
    dboPct.value = Math.round(95 * (1 - Math.exp(-dboElapsed.value / 18)))
  }, 1000)
  _dboAmuseTimer = setInterval(() => {
    dboAmuseIdx.value = (dboAmuseIdx.value + 1) % DBO_AMUSE_FACTS.length
  }, 10_000)  // Tom 2026-06-09: 10s card advance
}

function _stopAmuseTimers(): void {
  if (_dboTimer)      { clearInterval(_dboTimer);      _dboTimer      = null }
  if (_dboAmuseTimer) { clearInterval(_dboAmuseTimer); _dboAmuseTimer = null }
  dboPct.value = 100
}

// Wire timers to dboLoading
watch(dboLoading, (isLoading) => {
  if (isLoading) _startAmuseTimers()
  else           _stopAmuseTimers()
})

/** Same client factory as useSharpen — supports VITE_ANTHROPIC_API_KEY or local Ollama env. */
function _dboGetClient(): Anthropic {
  const apiKey  = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  const isLocal = !!(import.meta.env.VITE_OLLAMA_MODEL || import.meta.env.VITE_OLLAMA_BASE_URL)
  if (!apiKey && !isLocal) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: apiKey ?? 'local', dangerouslyAllowBrowser: true, timeout: 90_000 })
}

/** Robust JSON extractor — mirrors useSharpen._extractJson. */
function _dboExtractJson<T>(text: string): T {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(stripped) as T } catch { /* fall through */ }
  try { return JSON.parse(text.trim()) as T } catch { /* fall through */ }
  const obj = stripped.match(/\{[\s\S]*\}/)
  if (obj) { try { return JSON.parse(obj[0]) as T } catch { /* fall through */ } }
  const arr = stripped.match(/\[[\s\S]*\]/)
  if (arr) { try { return JSON.parse(arr[0]) as T } catch { /* fall through */ } }
  throw new Error(`AI response not valid Planguage Representation:\n${text.slice(0, 300)}`)
}

/** Serialise a Design Version's key spec data for AI context. */
function _dboSpecContext(v: NonNullable<typeof activeVersion.value>): string {
  const sol = v.specSnapshot.solutions.map(s =>
    `S.${s.id}: ${s.description}${s.impact ? ` [impact: ${s.impact}]` : ''}`,
  ).join('\n') || '(no solutions yet)'
  const val = v.specSnapshot.values.map(vv =>
    `V.${vv.id}: ${vv.description} [Tolerable: ${vv.tolerable} | Goal: ${vv.goal}]`,
  ).join('\n') || '(none)'
  const con = (v.specSnapshot.constraints ?? []).map(c =>
    `C.${c.id}: ${c.description}`,
  ).join('\n') || '(none)'
  return `SOLUTIONS (design target — what we are sharpening):\n${sol}\n\nVALUES (master spec — do not violate Tolerables):\n${val}\n\nCONSTRAINTS (hard limits — non-negotiable):\n${con}`
}

/**
 * Normalise a solution ID for fuzzy matching:
 * strips the "S." Planguage prefix (the AI context shows "S.{id}" so the AI
 * often includes it in returned JSON), lowercases, and collapses whitespace/punctuation.
 * Used to match AI-returned IDs back to canonical spec IDs.
 */
function _normSolId(id: string): string {
  return (id ?? '').replace(/^S\./, '').toLowerCase().replace(/[\s_\-]+/g, '')
}

/**
 * Compute a SharpenChangedEntry[] diff between old Solutions and the AI-refined set.
 * Only tracks description + impact (the two content fields DBO sharpening touches).
 * Mirrors the useSharpen._diffToEntries pattern so SharpenDiffList can render it.
 *
 * ID matching is 3-tier (robust against AI prefix/case drift):
 *   Tier 1 — exact match on the raw id string
 *   Tier 2 — strip "S." prefix (AI often copies the Planguage notation from context)
 *   Tier 3 — whitespace + case normalised match (handles "CabinExperience" vs "cabin experience")
 */
function _dboDiffSolutions(
  oldSpec: SpecBlock,
  newSolutions: Array<Record<string, string>>,
): SharpenChangedEntry[] {
  // Build all three lookup maps from the canonical spec IDs
  const oldMapExact = new Map(oldSpec.solutions.map(s => [s.id, s]))
  const oldMapStrip = new Map(oldSpec.solutions.map(s => [s.id.replace(/^S\./, ''), s]))
  const oldMapNorm  = new Map(oldSpec.solutions.map(s => [_normSolId(s.id), s]))

  const entries: SharpenChangedEntry[] = []
  for (const ns of newSolutions) {
    const rawId = ns.id ?? ''
    const old = oldMapExact.get(rawId)
           ?? oldMapStrip.get(rawId)
           ?? oldMapStrip.get(rawId.replace(/^S\./, ''))
           ?? oldMapNorm.get(_normSolId(rawId))
    // Resolve the ID — prefer the canonical spec ID over whatever the AI returned
    const resolvedId = old ? old.id : rawId.replace(/^S\./, '').trim()
    const after = { description: ns.description ?? '', impact: ns.impact ?? '' }
    if (!old) {
      entries.push({ id: resolvedId, status: 'added', entryType: 'S', after, before: null, changedFields: [] })
    } else {
      const before = { description: old.description ?? '', impact: old.impact ?? '' }
      const changedFields = (Object.keys(after) as Array<keyof typeof after>).filter(
        f => before[f] !== after[f],
      )
      if (changedFields.length > 0) {
        entries.push({ id: resolvedId, status: 'modified', entryType: 'S', after, before, changedFields })
      }
    }
  }
  return entries
}

/** Convert a DboSharpenRecord to the SharpenRound shape SharpenDiffList expects. */
function _dboRecordToRound(h: { dimension: DboSharpenDimension; suggestions: string[]; changes?: SharpenChangedEntry[] }): SharpenRound {
  const meta = DBO_SHARPEN_DIMENSIONS[h.dimension]
  return {
    category: { key: h.dimension, emoji: meta.keyedIcon, label: meta.label, hint: meta.prompt },
    questions: [],
    answers:   h.suggestions,
    changes:   h.changes ?? [],
  }
}

/** Phase 1 — Generate DBO-specific design questions for the selected dimension. */
async function startDboSharpen(): Promise<void> {
  const dim = sharpenSelectedDim.value
  const v   = activeVersion.value
  if (!dim || !v) return

  dboPhase.value        = 'questions'
  dboLoading.value      = true
  dboSharpenError.value = ''
  dboQuestions.value    = []

  const meta = DBO_SHARPEN_DIMENSIONS[dim]
  const prompt = `You are a Planguage Design-By-Objectives (DBO) specialist helping a designer sharpen Solution designs.

DESIGN VERSION: "${v.name}" (${v.versionNumber})
Version purpose: ${SOLUTION_VERSION_PURPOSE_LABELS[v.purpose]}${v.purposeCustom ? ` — ${v.purposeCustom}` : ''}

${_dboSpecContext(v)}

DBO SHARPENING DIMENSION: ${meta.label}
Design goal: ${meta.prompt}

Generate exactly 3–5 targeted questions to help the designer improve the SOLUTIONS above for the "${meta.label}" dimension.
For each question, provide 3–4 short suggestion options (≤10 words each) representing realistic design choices.

Requirements:
- Questions must be SPECIFIC to these Solutions — no generic boilerplate
- Focus on design decisions: mechanisms, trade-offs, implementation approaches, named technologies
- Do NOT ask about Values or Constraints — those are fixed; focus on Solution design choices
- Each question must reveal something currently vague, missing, or improvable in the Solutions
- Suggestions must be concrete design options (e.g. "use Redis caching layer", "parallelize via worker pool")
- Keep each question under 20 words

Return ONLY valid JSON — no prose, no code fences:
{"questions":[{"text":"...","suggestions":["...","...","..."]}]}`

  try {
    const client   = _dboGetClient()
    const response = await client.messages.create({
      model:      MODEL_ID,
      max_tokens: 1024,
      messages:   [{ role: 'user', content: prompt }],
    })
    const tb = response.content.find(b => b.type === 'text')
    if (!tb || tb.type !== 'text') throw new Error('No response from AI')
    const raw = _dboExtractJson<unknown>(tb.text)
    const qs: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as Record<string, unknown>)?.questions)
        ? (raw as Record<string, unknown>).questions as unknown[]
        : []
    if (qs.length === 0) throw new Error('AI returned no questions — check API key or retry')
    dboQuestions.value = qs.map(item => {
      if (typeof item === 'string') return { text: item, suggestions: [] }
      const q = item as { text?: string; suggestions?: string[] }
      return {
        text:        q.text ?? String(item),
        suggestions: Array.isArray(q.suggestions) ? q.suggestions : [],
      }
    })
    dboPhase.value = 'answering'
  } catch (err) {
    dboSharpenError.value = err instanceof Error ? err.message : 'Failed to generate questions'
    dboPhase.value = 'idle'
  } finally {
    dboLoading.value = false
  }
}

/** Phase 2 — Submit answers → AI returns refined Solutions → update Design Version snapshot. */
async function submitDboAnswers(): Promise<void> {
  const v   = activeVersion.value
  const dim = sharpenSelectedDim.value
  if (!v || !dim) return

  dboPhase.value        = 'refining'
  dboLoading.value      = true
  dboSharpenError.value = ''

  const meta = DBO_SHARPEN_DIMENSIONS[dim]
  const qa   = dboQuestions.value
    .map((q, i) => `Q: ${q.text}\nA: ${(dboAnswers.value[i] ?? '').trim() || '(no answer)'}`)
    .join('\n\n')

  const prompt = `You are a Planguage Design-By-Objectives (DBO) specialist. Improve the Solutions in a Design Version based on the designer's answers to "${meta.label}" sharpening questions.

DESIGN VERSION: "${v.name}" (${v.versionNumber})
${_dboSpecContext(v)}

DBO DIMENSION: ${meta.label} — ${meta.prompt}

Designer's answers:
${qa}

Return an improved Solutions list. Rules:
1. Return ONLY valid JSON — no markdown, no prose:
   {"solutions":[{"id":"...","type":"S","level":"Product","description":"...","impact":"...","function":""}]}
2. CRITICAL — IDs: copy each "id" field EXACTLY as shown in the SOLUTIONS list above (e.g. if the input says "S.CabinExperience" then the JSON "id" is "CabinExperience" — the bare string AFTER "S.", no prefix). Preserve ALL existing IDs; never remove entries.
3. Add new entries if the designer's answers reveal unaddressed design needs (choose a short camelCase id without "S." prefix).
4. CRITICAL — Constraints: every solution MUST comply with every C. entry — violating a Constraint is a disqualifying error.
5. Make descriptions SPECIFIC and NAMED — if the designer named a technology, vendor, or mechanism, use it. Do NOT return the same description as the input — that would mean zero improvement.
6. "impact" field: express the ${meta.label} benefit concisely (e.g. "reduces effort by ~40%", "eliminates S3-dependency failure mode"). Update this field meaningfully.
7. Keep "type":"S", "level":"Product", "function":"" unless the designer's answers specify otherwise.`

  try {
    const client   = _dboGetClient()
    const response = await client.messages.create({
      model:      MODEL_ID,
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    })
    const tb = response.content.find(b => b.type === 'text')
    if (!tb || tb.type !== 'text') throw new Error('No response from AI')

    type RawSol = Record<string, string>
    const raw     = _dboExtractJson<{ solutions?: RawSol[] }>(tb.text)
    const refined = Array.isArray(raw.solutions) ? raw.solutions : null
    if (!refined || refined.length === 0) throw new Error('AI returned no solutions — check prompt or retry')

    // ── Normalise AI-returned IDs back to canonical spec IDs ─────────────────
    // The AI context shows solutions as "S.{id}" which causes the AI to return
    // the "S." prefix in JSON despite explicit instructions to omit it.
    // _normSolId() strips the prefix + normalises case/whitespace for matching.
    // This ensures the diff always compares against the right canonical ID.
    const canonicalByNorm = new Map(v.specSnapshot.solutions.map(s => [_normSolId(s.id), s.id]))
    const normalizedRefined = refined.map(s => {
      const bare        = (s.id ?? '').replace(/^S\./, '').trim()
      const canonicalId = canonicalByNorm.get(_normSolId(bare)) ?? bare
      return { ...s, id: canonicalId }
    })
    // ──────────────────────────────────────────────────────────────────────────

    // ── Compute structured diff BEFORE overwriting the snapshot ──────────────
    // Uses the same SharpenChangedEntry shape as useSharpen so SharpenDiffList
    // can render the DBO changes identically to Stage 2 sharpening.
    const changedEntries = _dboDiffSolutions(v.specSnapshot, normalizedRefined)
    // ──────────────────────────────────────────────────────────────────────────

    // Merge into snapshot — only replace solutions; preserve Functions/Values/Constraints
    const updatedSnapshot: SpecBlock = {
      ...JSON.parse(JSON.stringify(v.specSnapshot)),
      solutions: normalizedRefined as unknown as SpecBlock['solutions'],
    }
    updateVersion(v.id, { specSnapshot: updatedSnapshot })

    addSharpenRecord(v.id, {
      dimension:          dim,
      appliedAt:          new Date().toISOString(),
      suggestions:        dboAnswers.value,
      appliedSuggestions: changedEntries.map(c =>
        c.status === 'added'
          ? `ADDED · S.${c.id}: ${c.after.description}${c.after.impact ? ` [impact: ${c.after.impact}]` : ''}`
          : `MODIFIED · S.${c.id} (${c.changedFields.join(' + ')}): ${c.after.description}`,
      ),
      changes: changedEntries,   // ← structured diff for SharpenDiffList
      notes:   sharpenAppliedNote.value,
    })

    sharpenAppliedNote.value = ''
    dboAnswers.value         = []
    dboQuestions.value       = []
    dboPhase.value           = 'idle'
  } catch (err) {
    dboSharpenError.value = err instanceof Error ? err.message : 'Failed to refine design — retry'
    dboPhase.value = 'answering'  // allow retry without losing answers
  } finally {
    dboLoading.value = false
  }
}

// ── Compare tab state ─────────────────────────────────────────────────────────

const compareSelectedIds = ref<string[]>([])

const compareVersions = computed<SolutionVersion[]>(() =>
  compareSelectedIds.value
    .map(id => versions.value.find(v => v.id === id))
    .filter((v): v is SolutionVersion => v !== undefined),
)

const compareValues = computed(() => props.masterSpec?.values ?? [])

function toggleCompareVersion(id: string): void {
  const idx = compareSelectedIds.value.indexOf(id)
  if (idx >= 0) compareSelectedIds.value.splice(idx, 1)
  else compareSelectedIds.value.push(id)
}

function getCellEstimate(versionId: string, valueId: string): string {
  const v = versions.value.find(x => x.id === versionId)
  if (!v) return ''
  return v.impactEstimates.find(c => c.valueId === valueId)?.impactEstimate ?? ''
}

function setCellEstimate(versionId: string, valueId: string, val: string): void {
  setImpactEstimate(versionId, valueId, { impactEstimate: val })
}

// ── Clipboard helper ──────────────────────────────────────────────────────────
// Replaces bare navigator.clipboard.writeText(...).catch(() => {}) which fails
// silently in Safari when clipboard permission is denied or focus is wrong.
// Two-tier: modern Clipboard API first, then the reliable textarea execCommand
// fallback. Both are synchronous w.r.t. the original user-gesture event, so
// Safari's gesture-gating passes. Returns true if copy succeeded.

function _clipboardWrite(text: string): boolean {
  // Tier 1 — modern Clipboard API (async, but fires in user-gesture context)
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => _clipboardFallback(text))
    return true
  }
  // Tier 2 — synchronous execCommand fallback (works in all browsers)
  return _clipboardFallback(text)
}

function _clipboardFallback(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { /* ignore */ }
  document.body.removeChild(ta)
  return ok
}

// ── Library-tab export feedback ───────────────────────────────────────────────
// Tracks which (versionId, type) was most recently copied so buttons can flash
// "Copied! ✓" — the same pattern as sharpenCopied in the Sharpen action bar.
const libraryCopied = ref<{ id: string; type: 'version' | 'changes' } | null>(null)
let _libCopiedTimer: ReturnType<typeof setTimeout> | null = null

function _showLibraryCopied(id: string, type: 'version' | 'changes'): void {
  if (_libCopiedTimer) clearTimeout(_libCopiedTimer)
  libraryCopied.value = { id, type }
  _libCopiedTimer = setTimeout(() => { libraryCopied.value = null }, 2200)
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportVersion(v: SolutionVersion): void {
  const lines: string[] = [
    `AUTO-DBO Solution Version: ${v.name} (${v.versionNumber})`,
    `Status: ${SOLUTION_VERSION_STATUS_META[v.status].label} | Purpose: ${SOLUTION_VERSION_PURPOSE_LABELS[v.purpose]}`,
    `Created: ${formatDate(v.dateCreated)} | Modified: ${formatDate(v.dateModified)}`,
    v.description ? `\nDescription: ${v.description}` : '',
    '',
    '── Solutions ──────────────────────────────────────────────────────────',
    ...v.specSnapshot.solutions.map(s =>
      `S.${s.id} [${s.level}]: ${s.description}\n  Impact: ${s.impact || '—'}\n  Function: ${s.function || '—'}`,
    ),
    '',
    '── Sharpening History ─────────────────────────────────────────────────',
    ...v.sharpeningHistory.map(h =>
      `[${DBO_SHARPEN_DIMENSIONS[h.dimension].label}] ${new Date(h.appliedAt).toLocaleDateString()}: ${h.notes || '(no notes)'}`,
    ),
  ]
  _clipboardWrite(lines.filter(Boolean).join('\n'))
}

/** Export only the changes (appliedSuggestions) from all sharpening rounds — not the whole plan. */
function exportChanges(v: SolutionVersion): void {
  const totalChanges = v.sharpeningHistory.reduce((n, h) => n + h.appliedSuggestions.length, 0)
  const lines: string[] = [
    `DBO CHANGES REPORT — ${v.name} (${v.versionNumber})`,
    `Exported: ${formatDate(new Date().toISOString())}`,
    `Total rounds: ${v.sharpeningHistory.length}  |  Total changes: ${totalChanges}`,
    '─'.repeat(60),
    '',
  ]
  for (const h of [...v.sharpeningHistory].reverse()) {
    const label = DBO_SHARPEN_DIMENSIONS[h.dimension].label
    const added    = h.appliedSuggestions.filter(s => s.startsWith('ADDED')).length
    const modified = h.appliedSuggestions.filter(s => s.startsWith('MODIFIED')).length
    lines.push(`[${label}] — ${formatDate(h.appliedAt)}`)
    lines.push(`  ${added} added · ${modified} modified`)
    if (h.notes) lines.push(`  Notes: ${h.notes}`)
    lines.push('')
    for (const change of h.appliedSuggestions) {
      lines.push(`  • ${change}`)
    }
    lines.push('')
  }
  _clipboardWrite(lines.join('\n'))
}

// ── Tab meta ──────────────────────────────────────────────────────────────────

const tabs: { id: DboTab; label: string; title: string }[] = [
  { id: 'library',  label: 'Library',   title: 'All Solution Versions — create, fork, approve, delete' },
  { id: 'workshop', label: 'Workshop',  title: 'Speculative editor — edit Solutions in active version without changing master' },
  { id: 'sharpen',  label: 'Sharpen',   title: '9 DBO sharpening dimensions — Claudian-assisted design improvement' },
  { id: 'compare',  label: 'Compare',   title: 'IET comparison matrix — versions vs Values' },
]
</script>

<template>
  <!-- Backdrop -->
  <div
    v-if="open"
    class="fixed inset-0 z-[600] bg-black/40 backdrop-blur-sm"
    @click="emit('close')"
  />

  <!-- Panel -->
  <!-- @wheel.stop prevents scroll events from reaching the body (background scroll-through bug).
       The ScrollContainer inside still receives wheel events because stopPropagation only
       blocks bubbling PAST this element, not from children to this element. -->
  <div
    v-if="open"
    class="fixed inset-y-0 right-0 z-[700] flex w-full max-w-4xl flex-col bg-white shadow-2xl"
    role="dialog"
    aria-label="Auto-DBO — Design By Objectives"
    @wheel.stop
  >
    <!-- ── Header ────────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-3 border-b border-slate-200 bg-slate-900 px-5 py-3">
      <PlSolutionIcon class="h-6 w-6 shrink-0 text-orange-400" />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-[15px] font-extrabold text-white">Auto-DBO</span>
          <span class="rounded bg-orange-500/20 px-1.5 py-0.5 font-mono text-[9px] text-orange-300">Design By Objectives</span>
          <span
            v-if="draftCount > 0 || approvedCount > 0"
            class="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] text-slate-300"
          >{{ draftCount }} draft{{ draftCount !== 1 ? 's' : '' }} · {{ approvedCount }} approved</span>
        </div>
        <p class="mt-0.5 text-[9px] text-slate-400">
          Named after Lech Krzanik's Apple II Forth tool built for Tom Gilb, 1978
        </p>
      </div>
      <CloseDot size="lg" title="Close Auto-DBO" aria-label="Close Auto-DBO" @click="emit('close')" />
    </div>

    <!-- ── Tab Bar ───────────────────────────────────────────────────────── -->
    <div class="flex border-b border-slate-200 bg-slate-50 px-4">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :title="tab.title"
        class="relative border-b-2 px-4 py-2.5 text-[12px] font-semibold transition-colors"
        :class="activeTab === tab.id
          ? 'border-orange-500 text-orange-700'
          : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ── Tab Content ───────────────────────────────────────────────────── -->
    <!-- flex-1 min-h-0: ScrollContainer auto-injects h-full on inner div when min-h-0
         is present → overflow-y-auto has a bounded height to scroll against.
         overflow-hidden was wrong here — it prevented the auto-inject and broke scroll. -->
    <ScrollContainer class="flex-1 min-h-0">

      <!-- ════════════════════════════════════════════════════════════════════
           TAB: LIBRARY
           ════════════════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'library'" class="p-5">

        <!-- Toolbar -->
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <button
            class="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow hover:bg-orange-700 disabled:opacity-40"
            title="Create a new Design Version — snapshots the current master spec"
            :disabled="!masterSpec"
            @click="showNewForm = !showNewForm; showForkForm = false"
          >
            <span class="font-mono">[*]</span> New Version
          </button>
          <!-- Filter -->
          <select
            v-model="filterStatus"
            class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600"
            title="Filter versions by status"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="deprecated">Deprecated</option>
          </select>
          <span class="text-[11px] text-slate-400">{{ filteredVersions.length }} version{{ filteredVersions.length !== 1 ? 's' : '' }}</span>
        </div>

        <!-- New Version Form -->
        <div v-if="showNewForm" class="mb-4 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
          <p class="mb-3 text-[12px] font-bold text-orange-800">New Design Version (snapshot from master spec)</p>
          <div class="grid gap-3">
            <div>
              <label class="mb-1 block text-[10px] font-semibold text-slate-600">Version name *</label>
              <input
                v-model="newForm.name"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="e.g. Offshore Option · AI-First Approach · Minimal Viable Design"
              />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-[10px] font-semibold text-slate-600">Purpose</label>
                <select v-model="newForm.purpose" class="w-full rounded-lg border border-slate-200 px-2 py-2 text-[11px]">
                  <option v-for="(label, key) in SOLUTION_VERSION_PURPOSE_LABELS" :key="key" :value="key">{{ label }}</option>
                </select>
              </div>
              <div v-if="newForm.purpose === 'custom'">
                <label class="mb-1 block text-[10px] font-semibold text-slate-600">Custom purpose</label>
                <input v-model="newForm.purposeCustom" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px]" placeholder="Describe the purpose..." />
              </div>
            </div>
            <div>
              <label class="mb-1 block text-[10px] font-semibold text-slate-600">Description (optional)</label>
              <textarea
                v-model="newForm.description"
                rows="2"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] resize-none"
                placeholder="What design hypothesis does this version explore?"
              />
            </div>
            <div class="flex gap-2">
              <button
                class="rounded-lg bg-orange-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-orange-700 disabled:opacity-40"
                :disabled="!newForm.name.trim()"
                @click="handleCreate"
              >Create &amp; Open Workshop</button>
              <button
                class="rounded-lg border border-slate-200 px-4 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50"
                @click="showNewForm = false"
              >Cancel</button>
            </div>
          </div>
        </div>

        <!-- Fork Form -->
        <div v-if="showForkForm" class="mb-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <p class="mb-2 text-[12px] font-bold text-blue-800">Fork Design Version</p>
          <p class="mb-3 text-[11px] text-blue-700 leading-relaxed bg-blue-100/60 rounded-lg px-3 py-2">
            A Fork creates an <strong>independent copy</strong> of this version's Solutions — you can edit, experiment, and sharpen it freely without changing the original.
            Use forks to explore competing design directions in parallel (e.g. "offshore option" vs "in-house build").
            When a fork proves better, approve it as the Master Spec.
          </p>
          <div class="grid gap-3">
            <div>
              <label class="mb-1 block text-[10px] font-semibold text-slate-600">Name for fork *</label>
              <input v-model="forkForm.name" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px]" />
            </div>
            <div>
              <label class="mb-1 block text-[10px] font-semibold text-slate-600">Purpose</label>
              <select v-model="forkForm.purpose" class="w-full rounded-lg border border-slate-200 px-2 py-2 text-[11px]">
                <option v-for="(label, key) in SOLUTION_VERSION_PURPOSE_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-[10px] font-semibold text-slate-600">Description (optional)</label>
              <textarea v-model="forkForm.description" rows="2" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] resize-none" placeholder="What will this fork explore differently?" />
            </div>
            <div class="flex gap-2">
              <button class="rounded-lg bg-blue-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40" :disabled="!forkForm.name.trim()" @click="submitFork">Fork &amp; Open Workshop</button>
              <button class="rounded-lg border border-slate-200 px-4 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50" @click="showForkForm = false">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="filteredVersions.length === 0" class="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
          <PlSolutionIcon class="mx-auto mb-3 h-10 w-10 text-orange-300" />
          <p class="text-[13px] font-semibold text-slate-500">No Solution Versions yet</p>
          <p class="mt-1 text-[11px] text-slate-400">Create a version to start exploring design alternatives without changing the master spec.</p>
          <p class="mt-2 text-[10px] italic text-slate-300">Named after Lech Krzanik's Auto-DBO tool, Apple II, 1978</p>
        </div>

        <!-- Version cards -->
        <div v-else class="space-y-3">
          <div
            v-for="v in filteredVersions"
            :key="v.id"
            class="rounded-xl border border-slate-200 bg-white shadow-sm"
            :class="{ 'ring-2 ring-orange-400': v.id === activeVersion?.id }"
          >
            <div class="flex items-start gap-3 px-4 py-3">
              <div class="flex-1 min-w-0">
                <!-- Name row -->
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-mono text-[10px] text-slate-400">{{ v.versionNumber }}</span>
                  <span class="text-[13px] font-bold text-slate-800">{{ v.name }}</span>
                  <!-- Status badge -->
                  <span
                    class="rounded px-1.5 py-0.5 text-[9px] font-semibold border"
                    :class="[SOLUTION_VERSION_STATUS_META[v.status].colorClass, SOLUTION_VERSION_STATUS_META[v.status].bgClass, SOLUTION_VERSION_STATUS_META[v.status].borderClass]"
                  >{{ SOLUTION_VERSION_STATUS_META[v.status].label }}</span>
                  <!-- Purpose badge -->
                  <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
                    {{ SOLUTION_VERSION_PURPOSE_LABELS[v.purpose] }}{{ v.purpose === 'custom' && v.purposeCustom ? `: ${v.purposeCustom}` : '' }}
                  </span>
                  <span v-if="v.forkedFromName" class="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-500">↳ fork of {{ v.forkedFromName }}</span>
                </div>
                <!-- Description -->
                <p v-if="v.description" class="mt-1 text-[11px] text-slate-500 line-clamp-2">{{ v.description }}</p>
                <!-- Meta row -->
                <div class="mt-1.5 flex flex-wrap gap-3 text-[9px] text-slate-400">
                  <span>{{ formatDate(v.dateCreated) }}</span>
                  <span>{{ v.specSnapshot.solutions.length }} Solution{{ v.specSnapshot.solutions.length !== 1 ? 's' : '' }}</span>
                  <span v-if="v.sharpeningHistory.length > 0">{{ v.sharpeningHistory.length }} sharpen{{ v.sharpeningHistory.length !== 1 ? 'ings' : 'ing' }}</span>
                  <!-- Total change count from structured diff (shows 0 for old records without changes field) -->
                  <span
                    v-if="v.sharpeningHistory.length > 0"
                    class="font-semibold"
                    :class="v.sharpeningHistory.flatMap(h => h.changes ?? []).length > 0 ? 'text-emerald-600' : 'text-slate-400'"
                  >{{ v.sharpeningHistory.flatMap(h => h.changes ?? []).length }} change{{ v.sharpeningHistory.flatMap(h => h.changes ?? []).length !== 1 ? 's' : '' }}</span>
                  <span v-if="v.approvedAt" class="text-emerald-600">Approved {{ formatDate(v.approvedAt) }}</span>
                </div>
              </div>

              <!-- Action column -->
              <div class="flex flex-col gap-1 shrink-0">
                <button
                  title="Open in Workshop — edit this version's Solutions speculatively"
                  class="rounded-lg bg-orange-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-orange-700"
                  @click="openWorkshop(v.id)"
                >Workshop</button>
                <button
                  title="Open in Sharpen — apply DBO sharpening to this version"
                  class="rounded-lg bg-amber-500 px-3 py-1 text-[10px] font-semibold text-white hover:bg-amber-600"
                  @click="openSharpen(v.id)"
                >Sharpen</button>
                <button
                  title="Fork — create a new version based on this one"
                  class="rounded-lg bg-blue-500 px-3 py-1 text-[10px] font-semibold text-white hover:bg-blue-600"
                  @click="handleFork(v.id)"
                >Fork</button>
              </div>
            </div>

            <!-- Bottom action row -->
            <div class="flex items-center gap-2 border-t border-slate-100 px-4 py-2">
              <!-- Approve -->
              <template v-if="v.status === 'draft'">
                <button
                  v-if="approveTargetId !== v.id"
                  title="Approve — apply this version's Solutions to the master spec"
                  class="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700 hover:bg-emerald-100"
                  @click="startApprove(v.id)"
                >✓ Approve to Master</button>
                <template v-else>
                  <input
                    v-model="approveNote"
                    class="flex-1 rounded border border-slate-200 px-2 py-1 text-[10px]"
                    placeholder="Approval note (optional)"
                  />
                  <button class="rounded-lg bg-emerald-600 px-2 py-1 text-[9px] font-semibold text-white" @click="submitApprove">Confirm Approve</button>
                  <button class="rounded-lg border border-slate-200 px-2 py-1 text-[9px] text-slate-500" @click="approveTargetId = null">Cancel</button>
                </template>
              </template>
              <!-- Export (full version) -->
              <button
                title="Export full version — copy Solutions and sharpening Past Versions as plain text"
                class="rounded-lg border px-2 py-1 text-[9px] font-semibold transition-colors"
                :class="libraryCopied?.id === v.id && libraryCopied?.type === 'version'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
                @click="exportVersion(v); _showLibraryCopied(v.id, 'version')"
              >{{ libraryCopied?.id === v.id && libraryCopied?.type === 'version' ? 'Copied! ✓' : 'Export [*]' }}</button>
              <!-- Export Changes (delta only — visible once sharpening has been done) -->
              <button
                v-if="v.sharpeningHistory.length > 0"
                title="Export Changes — copy only the sharpening delta (what changed) to clipboard"
                class="rounded-lg border px-2 py-1 text-[9px] font-semibold transition-colors"
                :class="libraryCopied?.id === v.id && libraryCopied?.type === 'changes'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100'"
                @click="exportChanges(v); _showLibraryCopied(v.id, 'changes')"
              >{{ libraryCopied?.id === v.id && libraryCopied?.type === 'changes' ? 'Copied! ✓' : 'Export Changes' }}</button>
              <!-- Deprecate -->
              <button
                v-if="v.status === 'draft'"
                title="Deprecate — archive without deleting"
                class="rounded-lg border border-slate-200 px-2 py-1 text-[9px] text-slate-400 hover:bg-slate-50"
                @click="deprecateVersion(v.id)"
              >Archive</button>
              <!-- Delete -->
              <button
                v-if="deleteConfirmId !== v.id"
                title="Delete this version permanently"
                class="ml-auto rounded-lg border border-red-200 px-2 py-1 text-[9px] text-red-500 hover:bg-red-50"
                @click="confirmDelete(v.id)"
              >Delete</button>
              <template v-else>
                <span class="ml-auto text-[9px] text-red-600 font-semibold">Confirm delete?</span>
                <button class="rounded-lg bg-red-600 px-2 py-1 text-[9px] font-semibold text-white" @click="doDelete(v.id)">Yes, Delete</button>
                <button class="rounded-lg border border-slate-200 px-2 py-1 text-[9px] text-slate-500" @click="deleteConfirmId = null">Cancel</button>
              </template>
            </div>
          </div>
        </div>

        <!-- Compare selection shortcut -->
        <div v-if="filteredVersions.length >= 2" class="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p class="text-[10px] text-slate-500">
            Want to compare versions side-by-side? Switch to the
            <button class="font-semibold text-orange-600 underline" @click="activeTab = 'compare'">Compare tab</button>
            to build an IET matrix.
          </p>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════
           TAB: WORKSHOP (speculative editor)
           ════════════════════════════════════════════════════════════════════ -->
      <div v-else-if="activeTab === 'workshop'" class="p-5">

        <!-- No active version -->
        <div v-if="!activeVersion" class="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
          <p class="text-[13px] font-semibold text-slate-500">No version open in Workshop</p>
          <p class="mt-1 text-[11px] text-slate-400">Go to Library and click "Workshop" on a version.</p>
          <button class="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-[12px] font-semibold text-white" @click="activeTab = 'library'">← Go to Library</button>
        </div>

        <template v-else>
          <!-- ── Version header + spec tags + action bar ────────────────────── -->
          <!-- MOVE principle: all actions visible without hunting.
               Spec context shown as compact tags (not a full grid) so Solutions
               get the space they deserve. -->
          <div class="mb-4 rounded-xl border border-orange-200 bg-orange-50/40 px-4 pt-3 pb-2">

            <!-- Name / status row -->
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <span class="font-mono text-[10px] text-orange-400">{{ activeVersion.versionNumber }}</span>
              <span class="text-[14px] font-bold text-orange-900">{{ activeVersion.name }}</span>
              <span
                class="rounded border px-1.5 py-0.5 text-[9px] font-semibold"
                :class="[SOLUTION_VERSION_STATUS_META[activeVersion.status].colorClass, SOLUTION_VERSION_STATUS_META[activeVersion.status].bgClass, SOLUTION_VERSION_STATUS_META[activeVersion.status].borderClass]"
              >{{ SOLUTION_VERSION_STATUS_META[activeVersion.status].label }}</span>
              <span class="text-[9px] text-orange-600 italic">Speculative — not applied to master until Approved</span>
            </div>

            <!-- Spec context tags — compact chips replacing the old full-grid.
                 Each chip shows just the ID + goal number so the user can see
                 the target constraints at a glance without losing screen space. -->
            <div class="mb-3 flex flex-wrap items-center gap-1.5">
              <span class="self-center pr-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Spec context:</span>
              <!-- Value tags -->
              <span
                v-for="vv in activeVersion.specSnapshot.values"
                :key="vv.id"
                :title="`Value: ${vv.description} | Tolerable: ${vv.tolerable || '—'} | Goal: ${vv.goal || '—'}`"
                class="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-mono text-[9px]"
              >
                <span class="font-semibold text-violet-700">V·{{ vv.id }}</span>
                <span v-if="vv.goal" class="text-slate-400">{{ vv.goal }}</span>
              </span>
              <!-- Constraint tags -->
              <span
                v-for="c in (activeVersion.specSnapshot.constraints ?? [])"
                :key="c.id"
                :title="`Constraint: ${c.description}`"
                class="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[9px] font-semibold text-red-600"
              >C·{{ c.id }}</span>
              <!-- Function count tag -->
              <span
                v-if="(activeVersion.specSnapshot.functions ?? []).length > 0"
                :title="(activeVersion.specSnapshot.functions ?? []).map((f: { id: string }) => `F.${f.id}`).join(', ')"
                class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-semibold text-emerald-700"
              >{{ (activeVersion.specSnapshot.functions ?? []).length }} Function{{ (activeVersion.specSnapshot.functions ?? []).length !== 1 ? 's' : '' }}</span>
            </div>

            <!-- Action bar — every option visible, no scroll, no hunting -->
            <div class="flex flex-wrap items-center gap-2 border-t border-orange-100 pt-2">
              <span class="self-center text-[9px] font-semibold text-slate-400">Your options:</span>
              <button
                class="rounded-lg bg-amber-500 px-3 py-1 text-[10px] font-semibold text-white hover:bg-amber-600"
                title="Apply a DBO sharpening dimension — Claudian generates targeted design questions then refines Solutions based on your answers"
                @click="activeTab = 'sharpen'"
              >🔪 Sharpen</button>
              <button
                v-if="activeVersion.status === 'draft'"
                class="rounded-lg bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700"
                title="Approve to Master — applies this version's Solutions to the live master spec (irreversible until next version)"
                @click="startApprove(activeVersion.id); activeTab = 'library'"
              >✓ Approve to Master</button>
              <button
                class="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                title="Export full version — copies Solutions + sharpening Past Versions as plain text to clipboard"
                @click="exportVersion(activeVersion)"
              >Export [*]</button>
              <button
                class="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[10px] text-slate-500 hover:bg-slate-50"
                title="Back to Library — see all Design Versions"
                @click="activeTab = 'library'"
              >← Library</button>
            </div>
          </div>

          <!-- Solutions editor (editable) -->
          <div>
            <div class="mb-2 flex items-center justify-between">
              <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Solutions in this version ({{ activeVersion.specSnapshot.solutions.length }})
              </p>
              <button
                class="rounded-lg bg-orange-500 px-3 py-1 text-[10px] font-semibold text-white hover:bg-orange-600"
                title="Add a new Solution entry to this design version"
                @click="showAddSolution = !showAddSolution"
              >+ Add Solution</button>
            </div>

            <!-- Add Solution form -->
            <div v-if="showAddSolution" class="mb-3 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
              <p class="mb-2 text-[11px] font-bold text-orange-800">New Solution Entry</p>
              <div class="grid gap-2">
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="mb-1 block text-[9px] font-semibold text-slate-500">Solution ID *</label>
                    <input v-model="addSolutionForm.id" class="w-full rounded border border-slate-200 px-2 py-1.5 text-[11px]" placeholder="e.g. OffshoreOption" />
                  </div>
                  <div>
                    <label class="mb-1 block text-[9px] font-semibold text-slate-500">Level</label>
                    <select v-model="addSolutionForm.level" class="w-full rounded border border-slate-200 px-2 py-1.5 text-[11px]">
                      <option v-for="l in ['Business','Stakeholder','Product','Solution','Evo','To-Do']" :key="l" :value="l">{{ l }}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="mb-1 block text-[9px] font-semibold text-slate-500">Description</label>
                  <textarea v-model="addSolutionForm.description" rows="2" class="w-full rounded border border-slate-200 px-2 py-1.5 text-[11px] resize-none" placeholder="How does this Solution deliver the Function?" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="mb-1 block text-[9px] font-semibold text-slate-500">Impact on Values</label>
                    <input v-model="addSolutionForm.impact" class="w-full rounded border border-slate-200 px-2 py-1.5 text-[11px]" placeholder="e.g. V.Revenue ~+40%" />
                  </div>
                  <div>
                    <label class="mb-1 block text-[9px] font-semibold text-slate-500">Implements Function</label>
                    <input v-model="addSolutionForm.function" class="w-full rounded border border-slate-200 px-2 py-1.5 text-[11px]" placeholder="e.g. [[F.DeliverCabinExperience]]" />
                  </div>
                </div>
                <div class="flex gap-2">
                  <button class="rounded-lg bg-orange-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40" :disabled="!addSolutionForm.id?.trim()" @click="submitAddSolution">Add Solution</button>
                  <button class="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] text-slate-500" @click="showAddSolution = false">Cancel</button>
                </div>
              </div>
            </div>

            <!-- Solution list -->
            <div v-if="activeVersion.specSnapshot.solutions.length === 0" class="rounded-lg border-2 border-dashed border-orange-200 p-6 text-center">
              <p class="text-[12px] text-slate-400">No Solutions in this version yet — add one or use Sharpen to generate suggestions</p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="s in activeVersion.specSnapshot.solutions"
                :key="s.id"
                class="rounded-xl border border-slate-200 bg-white"
              >
                <!-- View mode -->
                <div v-if="editingSolutionId !== s.id" class="px-4 py-3">
                  <div class="flex items-start gap-2">
                    <div class="flex-1 min-w-0">
                      <p class="font-mono text-[10px] font-bold text-orange-600">S.{{ s.id }}
                        <span class="ml-1 font-sans text-[9px] font-normal text-slate-400">[{{ s.level }}]</span>
                      </p>
                      <p class="mt-0.5 text-[12px] text-slate-800">{{ s.description }}</p>
                      <div class="mt-1 flex flex-wrap gap-3 text-[9px] text-slate-400">
                        <span v-if="s.impact">Impact: {{ s.impact }}</span>
                        <span v-if="s.function">Function: {{ s.function }}</span>
                      </div>
                    </div>
                    <div class="flex gap-1 shrink-0">
                      <button title="Edit this Solution" class="rounded px-2 py-1 text-[9px] text-slate-500 hover:bg-slate-100" @click="startEditSolution(s)">Edit</button>
                      <button title="Remove this Solution from this version" class="rounded px-2 py-1 text-[9px] text-red-400 hover:bg-red-50" @click="removeSolution(s.id)">Remove</button>
                    </div>
                  </div>
                </div>
                <!-- Edit mode -->
                <div v-else class="px-4 py-3">
                  <div class="grid gap-2">
                    <div>
                      <label class="mb-1 block text-[9px] font-semibold text-slate-500">Description</label>
                      <textarea v-model="editForm.description" rows="2" class="w-full rounded border border-slate-200 px-2 py-1.5 text-[11px] resize-none" />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <label class="mb-1 block text-[9px] font-semibold text-slate-500">Impact on Values</label>
                        <input v-model="editForm.impact" class="w-full rounded border border-slate-200 px-2 py-1.5 text-[11px]" />
                      </div>
                      <div>
                        <label class="mb-1 block text-[9px] font-semibold text-slate-500">Level</label>
                        <select v-model="editForm.level" class="w-full rounded border border-slate-200 px-2 py-1.5 text-[11px]">
                          <option v-for="l in ['Business','Stakeholder','Product','Solution','Evo','To-Do']" :key="l" :value="l">{{ l }}</option>
                        </select>
                      </div>
                    </div>
                    <div class="flex gap-2">
                      <button class="rounded-lg bg-orange-600 px-3 py-1.5 text-[11px] font-semibold text-white" @click="saveSolution">Save Changes</button>
                      <button class="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] text-slate-500" @click="cancelEditSolution">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════
           TAB: SHARPEN
           ════════════════════════════════════════════════════════════════════ -->
      <div v-else-if="activeTab === 'sharpen'" class="p-5">

        <div v-if="!activeVersion" class="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
          <p class="text-[13px] font-semibold text-slate-500">Select a version in Library first</p>
          <button class="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-[12px] font-semibold text-white" @click="activeTab = 'library'">← Go to Library</button>
        </div>

        <template v-else>
          <!-- Active version chip -->
          <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5">
            <span class="font-mono text-[10px] text-orange-400">{{ activeVersion.versionNumber }}</span>
            <span class="text-[12px] font-bold text-orange-800">{{ activeVersion.name }}</span>
          </div>

          <!-- 9-Dimension Grid -->
          <div class="mb-4 grid grid-cols-3 gap-3">
            <button
              v-for="dim in DBO_SHARPEN_DIMENSION_KEYS"
              :key="dim"
              :title="DBO_SHARPEN_DIMENSIONS[dim].description + ' — click to build Claudian prompt'"
              class="rounded-xl border-2 p-3 text-left transition-all"
              :class="[
                DBO_SHARPEN_DIMENSIONS[dim].bgClass,
                DBO_SHARPEN_DIMENSIONS[dim].borderClass,
                sharpenSelectedDim === dim ? 'ring-2 ring-orange-400 shadow-md' : 'hover:shadow-sm',
              ]"
              @click="sharpenSelectedDim = sharpenSelectedDim === dim ? null : dim"
            >
              <div class="mb-1 font-mono text-[11px] font-bold" :class="DBO_SHARPEN_DIMENSIONS[dim].colorClass">
                {{ DBO_SHARPEN_DIMENSIONS[dim].keyedIcon }}
              </div>
              <div class="text-[10px] font-semibold" :class="DBO_SHARPEN_DIMENSIONS[dim].colorClass">
                {{ DBO_SHARPEN_DIMENSIONS[dim].label }}
              </div>
              <div class="mt-0.5 text-[9px] text-slate-500 line-clamp-2">
                {{ DBO_SHARPEN_DIMENSIONS[dim].description }}
              </div>
              <div
                v-if="activeVersion.sharpeningHistory.some(h => h.dimension === dim)"
                class="mt-1 text-[8px] font-semibold text-emerald-600"
              >✓ sharpened</div>
            </button>
          </div>

          <!-- Sharpening Q&A interview (same engine as Stage 2 Sharpen) -->
          <div v-if="sharpenSelectedDim && sharpenDimMeta" class="rounded-xl border border-slate-200 bg-slate-50 p-4">

            <!-- Header + Start button (idle state) -->
            <div class="mb-3 flex items-center justify-between gap-3">
              <p class="text-[12px] font-bold" :class="sharpenDimMeta.colorClass">
                {{ sharpenDimMeta.keyedIcon }} {{ sharpenDimMeta.label }}
              </p>
              <button
                v-if="dboPhase === 'idle'"
                class="rounded-lg bg-orange-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-orange-700"
                title="Generate targeted sharpening questions for this Design Version"
                @click="startDboSharpen"
              >Generate Questions</button>
            </div>

            <!-- Loading states (Rule 8: spinner + elapsed + % bar + amuse facts) -->
            <div
              v-if="(dboPhase === 'questions' || dboPhase === 'refining') && dboLoading"
              class="py-5 space-y-3"
            >
              <!-- Spinner + label + elapsed -->
              <div class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4 shrink-0 text-orange-500" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
                <p class="text-[11px] font-semibold text-slate-700">
                  {{ dboPhase === 'questions' ? 'Generating design questions' : 'Refining Design Version spec' }}
                </p>
                <span class="text-[10px] text-slate-400 font-mono">{{ dboElapsed }}s</span>
              </div>

              <!-- Asymptotic % progress bar -->
              <div class="mx-auto w-64 rounded-full bg-slate-200 h-1.5 overflow-hidden">
                <div
                  class="h-full rounded-full bg-orange-500 transition-all duration-1000"
                  :style="{ width: `${dboPct}%` }"
                />
              </div>
              <p class="text-center text-[9px] text-slate-400 font-mono">{{ dboPct }}%</p>

              <!-- Rotating DBO design facts -->
              <div class="mx-3 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 min-h-[56px] flex items-center justify-center transition-all duration-700">
                <p class="text-[10px] text-orange-800 text-center leading-relaxed italic">
                  {{ DBO_AMUSE_FACTS[dboAmuseIdx] }}
                </p>
              </div>

              <!-- Dot navigation -->
              <div class="flex items-center justify-center gap-1.5">
                <button
                  v-for="(_, fi) in DBO_AMUSE_FACTS"
                  :key="fi"
                  type="button"
                  class="rounded-full transition-all"
                  :class="fi === dboAmuseIdx ? 'w-3 h-1.5 bg-orange-500' : 'w-1.5 h-1.5 bg-slate-300 hover:bg-orange-300'"
                  :title="`Fact ${fi + 1}`"
                  @click="dboAmuseIdx = fi"
                />
              </div>
            </div>

            <!-- Error -->
            <div
              v-if="dboSharpenError"
              class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-700"
            >⚠️ {{ dboSharpenError }}</div>

            <!-- Q&A interview cards (answering phase) -->
            <template v-if="dboPhase === 'answering' && dboQuestions.length > 0">
              <!-- Multi-select hint -->
              <p class="mb-3 text-[10px] text-slate-500 italic">
                Tap one or more chips to combine design directions — or type your own answer.
                Unanswered questions are sent as "(no answer)" and the AI skips them gracefully.
              </p>

              <div class="space-y-4 mb-4">
                <div
                  v-for="(q, qi) in dboQuestions"
                  :key="qi"
                  class="rounded-lg border p-3 transition-colors"
                  :class="dboAnswers[qi]?.trim()
                    ? 'border-orange-200 bg-white'
                    : 'border-slate-200 bg-slate-50/60'"
                >
                  <!-- Question text + answered indicator -->
                  <div class="flex items-start gap-2 mb-2">
                    <span
                      class="shrink-0 mt-0.5 rounded-full text-[8px] font-bold w-4 h-4 flex items-center justify-center"
                      :class="dboAnswers[qi]?.trim() ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'"
                    >{{ qi + 1 }}</span>
                    <p class="text-[11px] font-semibold text-slate-800 leading-snug">{{ q.text }}</p>
                  </div>

                  <!-- Multi-select suggestion chips (Tom 2026-06-07: "answer with multiple suggested answers") -->
                  <div v-if="q.suggestions.length > 0" class="mb-2 flex flex-wrap gap-1.5">
                    <button
                      v-for="(s, si) in q.suggestions"
                      :key="si"
                      type="button"
                      class="rounded-full border px-2.5 py-0.5 text-[9px] transition-colors"
                      :class="(dboSelectedChips[qi] ?? []).includes(s)
                        ? 'border-orange-400 bg-orange-100 text-orange-800 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-orange-300 hover:bg-orange-50'"
                      :title="`${(dboSelectedChips[qi] ?? []).includes(s) ? 'Deselect' : 'Add'}: ${s}`"
                      @click="toggleDboChip(qi, s)"
                    >{{ s }}</button>
                  </div>

                  <!-- Free-form answer textarea (editable at any time) -->
                  <textarea
                    v-model="dboAnswers[qi]"
                    rows="2"
                    class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                    :placeholder="`Your answer to question ${qi + 1} (type freely or combine chips above)…`"
                  />
                </div>
              </div>

              <!-- Notes -->
              <div class="mb-3">
                <label class="mb-1 block text-[9px] font-semibold text-slate-500">Notes (optional)</label>
                <input
                  v-model="sharpenAppliedNote"
                  class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[10px]"
                  placeholder="Describe what this sharpening session changed or explored…"
                />
              </div>

              <!-- Submit answers — disabled only when ALL questions are unanswered -->
              <button
                class="rounded-lg bg-orange-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-orange-700 disabled:opacity-40"
                :disabled="dboAnswers.every(a => !a.trim())"
                title="Submit answers — AI will refine this Design Version's Solutions. Unanswered questions are handled gracefully."
                @click="submitDboAnswers"
              >Submit Answers &amp; Refine Spec</button>
            </template>

          </div>

          <!-- Sharpening history -->
          <div v-if="activeVersion.sharpeningHistory.length > 0" class="mt-4">
            <p class="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Sharpening History ({{ activeVersion.sharpeningHistory.length }})</p>
            <div class="space-y-2">
              <div
                v-for="h in [...activeVersion.sharpeningHistory].reverse()"
                :key="h.id"
                class="rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="rounded px-1.5 py-0.5 text-[9px] font-semibold border"
                    :class="[DBO_SHARPEN_DIMENSIONS[h.dimension].colorClass, DBO_SHARPEN_DIMENSIONS[h.dimension].bgClass, DBO_SHARPEN_DIMENSIONS[h.dimension].borderClass]"
                  >{{ DBO_SHARPEN_DIMENSIONS[h.dimension].label }}</span>
                  <span class="text-[9px] text-slate-400">{{ new Date(h.appliedAt).toLocaleString() }}</span>
                </div>
                <p v-if="h.notes" class="mt-1 text-[10px] text-slate-500">{{ h.notes }}</p>
              </div>
            </div>

            <!-- ── What now? action bar ─────────────────────────────────────────
                 Visible whenever ≥1 sharpening round has completed.
                 MOVE principle: every next-step option must be visible without hunting.
            ──────────────────────────────────────────────────────────────────── -->
            <div class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <!-- Status row -->
              <div class="flex items-center gap-2 mb-3">
                <span class="text-emerald-600 text-[13px]">✓</span>
                <p class="text-[11px] font-semibold text-emerald-800">
                  {{ activeVersion.sharpeningHistory.length }} sharpening round{{ activeVersion.sharpeningHistory.length !== 1 ? 's' : '' }} complete
                </p>
                <span class="ml-auto text-[9px] text-emerald-600 bg-emerald-100 rounded px-2 py-0.5 font-semibold">
                  Auto-saved ✓
                </span>
              </div>

              <!-- Changes diff — same SharpenDiffList component as Stage 2 sharpening -->
              <div class="mb-3 rounded-lg bg-white border border-emerald-200 overflow-hidden">
                <!-- Totals header -->
                <div class="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-emerald-100 bg-emerald-50/40">
                  <span class="text-[9px] font-bold uppercase tracking-wide text-slate-500">Changes across all rounds</span>
                  <span
                    v-if="activeVersion.sharpeningHistory.flatMap(h => h.changes ?? []).filter(c => c.status === 'added').length > 0"
                    class="rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-0.5 border border-emerald-300"
                  >+{{ activeVersion.sharpeningHistory.flatMap(h => h.changes ?? []).filter(c => c.status === 'added').length }} added</span>
                  <span
                    v-if="activeVersion.sharpeningHistory.flatMap(h => h.changes ?? []).filter(c => c.status === 'modified').length > 0"
                    class="rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 border border-amber-300"
                  >~ {{ activeVersion.sharpeningHistory.flatMap(h => h.changes ?? []).filter(c => c.status === 'modified').length }} modified</span>
                  <span
                    v-if="activeVersion.sharpeningHistory.flatMap(h => h.changes ?? []).length === 0"
                    class="text-[9px] text-slate-400 italic"
                  >no changes recorded yet (run sharpening to see diff)</span>
                </div>

                <!-- SharpenDiffList — identical rendering to Stage 2 -->
                <SharpenDiffList
                  :rounds="[...activeVersion.sharpeningHistory].reverse().map(_dboRecordToRound)"
                />
              </div>

              <!-- Primary actions -->
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">

                <!-- Approve to Master Spec -->
                <div>
                  <template v-if="approveTargetId === activeVersion.id">
                    <input
                      v-model="approveNote"
                      class="w-full mb-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px]"
                      placeholder="Approval note (optional)…"
                      @keyup.enter="submitApprove"
                    />
                    <div class="flex gap-1">
                      <button class="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700" title="Confirm: apply this version's Solutions to the master spec" @click="submitApprove">Confirm Approve</button>
                      <button class="rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] text-slate-500 hover:bg-slate-50" @click="approveTargetId = null">Cancel</button>
                    </div>
                  </template>
                  <button
                    v-else
                    class="w-full rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-700 text-left"
                    title="Approve this Design Version — applies its Solutions to the master spec (replaces current Solutions)"
                    @click="startApprove(activeVersion.id)"
                  >
                    <span class="block text-[9px] font-normal text-emerald-200 mb-0.5">Best option → promote design</span>
                    Approve to Master Spec
                  </button>
                </div>

                <!-- Go to Workshop — view / edit the sharpened Solutions -->
                <button
                  class="rounded-lg bg-orange-100 border border-orange-300 px-3 py-2 text-[11px] font-semibold text-orange-800 hover:bg-orange-200 text-left"
                  title="Open Workshop tab to inspect and manually edit the sharpened Solutions"
                  @click="activeTab = 'workshop'"
                >
                  <span class="block text-[9px] font-normal text-orange-500 mb-0.5">Inspect the improved design</span>
                  Open in Workshop
                </button>

                <!-- Export whole version -->
                <button
                  class="rounded-lg bg-slate-100 border border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 text-left"
                  title="Copy this version's full Solutions and sharpening Past Versions as plain text to clipboard"
                  @click="exportVersion(activeVersion); sharpenCopied = 'version'; setTimeout(() => sharpenCopied = false, 2000)"
                >
                  <span class="block text-[9px] font-normal text-slate-400 mb-0.5">Full version</span>
                  {{ sharpenCopied === 'version' ? 'Copied! ✓' : 'Export Version' }}
                </button>

                <!-- Export changes only -->
                <button
                  class="rounded-lg bg-orange-50 border border-orange-300 px-3 py-2 text-[11px] font-semibold text-orange-800 hover:bg-orange-100 text-left"
                  title="Copy only the list of changes made by sharpening — not the full plan"
                  @click="exportChanges(activeVersion); sharpenCopied = 'changes'; setTimeout(() => sharpenCopied = false, 2000)"
                >
                  <span class="block text-[9px] font-normal text-orange-400 mb-0.5">Delta only</span>
                  {{ sharpenCopied === 'changes' ? 'Copied! ✓' : 'Export Changes' }}
                </button>

              </div>

              <!-- Secondary: keep original / save as new plan / keep sharpening -->
              <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200">
                <button
                  class="text-[10px] text-slate-500 hover:text-slate-700 underline underline-offset-2"
                  title="Go back to Library — continue working with existing versions, or discard this one"
                  @click="activeTab = 'library'"
                >Back to Library (keep original)</button>
                <span class="text-slate-300 text-[10px]">·</span>
                <button
                  class="text-[10px] text-blue-600 hover:text-blue-800 underline underline-offset-2 font-semibold"
                  title="Save this Design Version as a brand-new independent plan with a different title and stewards"
                  @click="showSaveAsNewPlanForm = !showSaveAsNewPlanForm"
                >Save as New Plan…</button>
                <span class="text-slate-300 text-[10px]">·</span>
                <span class="text-[10px] text-slate-400">Or sharpen another dimension above ↑</span>
              </div>

              <!-- Save as New Plan form — inline below action bar -->
              <div v-if="showSaveAsNewPlanForm" class="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <p class="mb-1.5 text-[12px] font-bold text-blue-800">Save Design Version as New Plan</p>
                <p class="mb-3 text-[11px] text-blue-700 leading-relaxed bg-blue-100/50 rounded-lg px-3 py-2">
                  Creates a <strong>brand-new plan session</strong> from this version's spec snapshot — with a fresh title and stewards.
                  The original version stays in the DBO Library unchanged.
                  Use this when a design exploration reveals a genuinely new plan direction worth pursuing independently.
                </p>
                <div class="grid gap-3">
                  <div>
                    <label class="mb-1 block text-[10px] font-semibold text-slate-600">New plan title *</label>
                    <input
                      v-model="saveAsNewPlanTitle"
                      class="w-full rounded-lg border border-slate-200 px-3 py-2 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="e.g. Offshore Design Initiative · AI-First Platform v2"
                      @keyup.enter="submitSaveAsNewPlan"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-[10px] font-semibold text-slate-600">
                      Stewards (optional — comma-separated)
                    </label>
                    <input
                      v-model="saveAsNewPlanOwners"
                      class="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="e.g. Tom Gilb, Kai Gilb, Maria Larsen"
                    />
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="rounded-lg bg-blue-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                      :disabled="!saveAsNewPlanTitle.trim()"
                      title="Load this Design Version's spec as a new independent plan — App will switch plan context"
                      @click="submitSaveAsNewPlan"
                    >Save as New Plan</button>
                    <button
                      class="rounded-lg border border-slate-200 px-4 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50"
                      @click="showSaveAsNewPlanForm = false; saveAsNewPlanTitle = ''; saveAsNewPlanOwners = ''"
                    >Cancel</button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </template>
      </div>

      <!-- ════════════════════════════════════════════════════════════════════
           TAB: COMPARE (IET Matrix)
           ════════════════════════════════════════════════════════════════════ -->
      <div v-else-if="activeTab === 'compare'" class="p-5">

        <!-- Version selector -->
        <div class="mb-4">
          <p class="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Select Versions to Compare</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="v in versions"
              :key="v.id"
              :title="v.description || v.name"
              class="rounded-full border px-3 py-1 text-[10px] font-semibold transition-all"
              :class="compareSelectedIds.includes(v.id)
                ? 'border-orange-500 bg-orange-500 text-white'
                : 'border-slate-200 text-slate-600 hover:border-orange-300'"
              @click="toggleCompareVersion(v.id)"
            >{{ v.versionNumber }} · {{ v.name }}</button>
          </div>
        </div>

        <div v-if="compareVersions.length === 0" class="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
          <p class="text-[12px] text-slate-400">Select two or more versions above to build the comparison matrix</p>
        </div>

        <!-- IET Matrix -->
        <div v-else-if="compareValues.length === 0" class="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
          <p class="text-[12px] text-slate-400">No Values in the master spec — add Values first to use the comparison matrix</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th class="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[10px] font-semibold text-slate-600 w-40">
                  Value
                </th>
                <th
                  v-for="v in compareVersions"
                  :key="v.id"
                  class="border border-slate-200 bg-orange-50 px-3 py-2 text-center text-[10px] font-semibold text-orange-700"
                >
                  <div>{{ v.versionNumber }}</div>
                  <div class="font-normal text-orange-500 truncate max-w-[120px]">{{ v.name }}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="val in compareValues"
                :key="val.id"
                class="hover:bg-violet-50/30"
              >
                <td class="border border-slate-200 bg-white px-3 py-2">
                  <p class="font-mono text-[9px] text-violet-600">{{ val.id }}</p>
                  <p class="text-[10px] text-slate-700 line-clamp-2">{{ val.description }}</p>
                  <p class="text-[9px] text-slate-400">Goal: {{ val.goal || '—' }}</p>
                </td>
                <td
                  v-for="ver in compareVersions"
                  :key="ver.id"
                  class="border border-slate-200 bg-white px-2 py-1 text-center"
                >
                  <input
                    :value="getCellEstimate(ver.id, val.id)"
                    class="w-full rounded border border-transparent bg-transparent px-1 py-1 text-center text-[11px] text-slate-700 focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-200"
                    :title="`Impact of ${ver.name} on ${val.id} — enter estimate (e.g. +30%, 2x, negligible)`"
                    placeholder="—"
                    @change="setCellEstimate(ver.id, val.id, ($event.target as HTMLInputElement).value)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <p class="mt-2 text-[9px] text-slate-400">Click a cell to enter an impact estimate for that version on that Value (e.g. +30%, 2×, negligible, unknown)</p>
        </div>

        <!-- Bottom navigation mirror (DD-014) -->
        <div v-if="compareVersions.length > 0" class="mt-6 border-t border-slate-100 pt-4">
          <button class="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] text-slate-500 hover:bg-slate-50" @click="activeTab = 'library'">← Back to Library</button>
        </div>
      </div>

    </ScrollContainer>
  </div>
</template>
