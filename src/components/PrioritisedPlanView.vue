<!-- UNIT_TYPE=Widget -->
<!--
/**
 * Renders the full Prioritised Plan export in a clean, white-background layout.
 *
 * Sections:
 *  1. Original Input — the raw Stakes / Ends / Means the user entered
 *  2. Generated Spec — F. / V. / S. cards (mirrors SpecOutput card style)
 *  3. Impact Matrix — HTML table with V/C ratios, ranked solutions highlighted
 *  4. Evo Plan — ordered steps with linked values, effort, and tasks
 *  5. Actions — Start Over button + download as Markdown
 *
 * Spec: S.Evo9.PrioritisedPlanExport
 */
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import type { ImpactMatrix } from '../types/impact'
import { useSharpen } from '../composables/useSharpen'
import SharpenDiffList from './SharpenDiffList.vue'
import { extractAllStakeholders, impactLevel, type StakeholderMatch } from '../utils/stakeholderExtract'
import { useSpecModel } from '../composables/useSpecModel'
import { useSpecAnnotations, type AnnotationType } from '../composables/useSpecAnnotations'
import { useSpecQualityCheck } from '../composables/useSpecQualityCheck'
import { useSpecQuality } from '../composables/useSpecQuality'
import { usePriorityRecord, type PriorityRecord } from '../composables/usePriorityRecord'
import { useTaskSuggestions } from '../composables/useTaskSuggestions'
import PriorityActionButton from './PriorityActionButton.vue'
import EditGlyph from './icons/EditGlyph.vue'

// ── Props + Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  spec: SpecBlock
  originalInput: { stakes: string; ends: string; means: string } | null
  evoSteps: EvoStep[]
  tasksByStep: Record<string, TaskSuggestion[]>
  impactMatrix: ImpactMatrix
  vcRatios: Record<string, number>
  calendarCosts: Record<string, number>
  capitalCosts: Record<string, number>
  planName?: string
  planVersion?: string
  planSavedAt?: string   // ISO timestamp from PlanModel.updatedAt
  /** IDs of entries added/modified by sharpening — shows ✂️ badge on each card */
  sharpenedEntryIds?: string[]
  /** Sharpening summary — total change count + timestamp, shown above spec section */
  sharpenSummary?: { totalChanges: number; at: Date | null } | null
}>()

// ── Sharpening rounds — read directly from singleton; no prop-drilling needed ─

const { rounds: sharpenRounds } = useSharpen()

// ── Task suggestions — fallback for steps with no recorded tasks ──────────────
// If tasksByStep is empty (user skipped the Tasks stage), suggestTasks() generates
// tasks rule-based from the step description so the copy/export never silently omits them.
const { suggestTasks } = useTaskSuggestions()

/** Resolved tasks for a step: recorded tasks if any, else rule-based suggestions. */
function _tasksForStep(step: EvoStep): TaskSuggestion[] {
  const recorded = props.tasksByStep[step.name] ?? []
  return recorded.length > 0 ? recorded : suggestTasks(step)
}

const showChangeDetail = ref(false)

/** Toggle for the "More Info" owner detail card in the Stage 5 identity banner */
const ownerMoreOpen = ref(false)

// Map from entry ID → array of {emoji, label} for every round that touched it.
const entryCategories = computed<Map<string, { emoji: string; label: string }[]>>(() => {
  const map = new Map<string, { emoji: string; label: string }[]>()
  for (const round of sharpenRounds.value) {
    for (const change of round.changes) {
      const existing = map.get(change.id) ?? []
      if (!existing.some(c => c.label === round.category.label)) {
        existing.push({ emoji: round.category.emoji, label: round.category.label })
      }
      map.set(change.id, existing)
    }
  }
  return map
})

const emit = defineEmits<{
  'start-over': []
  'email': []
  /** Open the Spec Editor at an optional tab / entry */
  'open-editor': [{ tab?: 'functions' | 'values' | 'solutions'; entryId?: string }]
  /** Open the Priority Record panel for a specific entry */
  'open-priority': [{ entryId: string; entryType: 'F' | 'V' | 'S'; description?: string }]
  /** Open the "About the Priority Glyph" info modal (DD-002, 2026-05-14 split-button) */
  'open-priority-info': []
  /** Open the "About the Edit Glyph" info modal */
  'open-edit-info': []
  /** Open the Value Flow diagram panel (2026-05-15) */
  'open-value-flow': []
  /** Open the Visualize Panel at a specific tab (2026-05-17) */
  'open-visualise': [{ tab: string }]
  /** Navigate to the Task Decomposition stage (stage 4) */
  'go-to-tasks': []
}>()

// ── Identity stamp — model name + version + date/time ────────────────────────
// Shown in the prominent color bar at the top of the view and in the HTML export.

const identityTitle = computed<string>(() =>
  props.planName ?? 'Prioritised Plan'
)

const identityStamp = computed<string>(() => {
  const ts = props.planSavedAt ?? new Date().toISOString()
  const d  = new Date(ts)
  const date = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const hh   = d.getHours().toString().padStart(2, '0')
  const mm   = d.getMinutes().toString().padStart(2, '0')
  return `${date}  ${hh}:${mm}`
})

// ── Plan owner — read from singleton composable, no prop needed ───────────────

const { currentModel: _planModel, allModels: _allPlanModels } = useSpecModel()

// ── Feature #200: Spec Quality Annotations ────────────────────────────────────

// Re-initialise annotations whenever the active plan model changes
const _planModelId = computed(() => _planModel.value?.id ?? '')
const _ann = computed(() => useSpecAnnotations(_planModelId.value))

/** Shorthand: get annotation for an entry, or null */
function annOf(entryId: string) { return _ann.value.getAnnotation(entryId) }

// ── Feature #199: Priority records — title-strip "Prioritized due to …" chip ──

const _pri = computed(() => usePriorityRecord(_planModelId.value))

/** Get this entry's saved priority record, or null. */
function priorityOf(entryId: string): PriorityRecord | null {
  return _pri.value.getRecord(entryId)
}

/** Compose a short human reason from the record. Falls back through purposes
 *  → source → authority. Truncated to ~60 chars with an ellipsis. */
function priorityReason(entryId: string): string {
  const rec = priorityOf(entryId)
  if (!rec) return ''
  const raw = (rec.purposes || rec.source || rec.authority || '').trim()
  if (!raw) return ''
  const oneLine = raw.replace(/\s+/g, ' ')
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}…` : oneLine
}

/** Flag-dropdown state — tracks which entry's flag form is open */
const openFlagId    = ref<string | null>(null)
const flagType      = ref<AnnotationType | ''>('')
const flagNote      = ref('')
const flagConflict  = ref('')  // free text: "Conflicts with F.X, S.Y" for manual entry

/** Close flag dropdown when entry changes or another entry opens */
watch(openFlagId, () => {
  flagType.value     = ''
  flagNote.value     = ''
  flagConflict.value = ''
})

function openFlag(entryId: string): void {
  if (openFlagId.value === entryId) { openFlagId.value = null; return }
  openFlagId.value = entryId
  const existing = annOf(entryId)
  if (existing) {
    flagType.value     = existing.type
    flagNote.value     = existing.note
    flagConflict.value = existing.conflictsWith.map(c => c.description).join('; ')
  }
}

function applyFlag(entryId: string, entryType: 'F' | 'V' | 'S'): void {
  if (!flagType.value) return
  const conflictsWith = (flagType.value === 'conflicting' && flagConflict.value.trim())
    ? [{ scope: 'same-spec' as const, description: flagConflict.value.trim() }]
    : []
  _ann.value.setAnnotation(entryId, flagType.value as AnnotationType, flagNote.value, conflictsWith)
  openFlagId.value = null
  void entryType // suppress unused warning
}

function clearFlag(entryId: string): void {
  _ann.value.clearAnnotation(entryId)
  openFlagId.value = null
}

/** Annotation type → visual config */
const ANN_CONFIG: Record<AnnotationType, { badge: string; badgeCls: string; flagCls: string; activeCls: string; inactiveCls: string }> = {
  missing:    { badge: '⚠ Missing',     badgeCls: 'bg-orange-100 text-orange-700 border-orange-300', flagCls: 'bg-orange-400/80 text-white', activeCls: 'bg-orange-100 border-orange-400 text-orange-800', inactiveCls: 'bg-white border-gray-200 text-gray-600 hover:border-orange-300' },
  ambiguous:  { badge: '〜 Ambiguous',  badgeCls: 'bg-amber-100 text-amber-700 border-amber-300',   flagCls: 'bg-amber-400/80 text-white',  activeCls: 'bg-amber-100 border-amber-400 text-amber-800',   inactiveCls: 'bg-white border-gray-200 text-gray-600 hover:border-amber-300' },
  misleading: { badge: '⚡ Misleading', badgeCls: 'bg-red-100 text-red-700 border-red-300',         flagCls: 'bg-red-400/80 text-white',    activeCls: 'bg-red-100 border-red-400 text-red-800',         inactiveCls: 'bg-white border-gray-200 text-gray-600 hover:border-red-300' },
  conflicting:{ badge: '⚡ Conflicts',  badgeCls: 'bg-purple-100 text-purple-700 border-purple-300',flagCls: 'bg-purple-400/80 text-white',  activeCls: 'bg-purple-100 border-purple-400 text-purple-800',inactiveCls: 'bg-white border-gray-200 text-gray-600 hover:border-purple-300' },
}

const FLAG_OPTS: Array<{ type: AnnotationType; label: string }> = [
  { type: 'missing',     label: '⚠ Missing' },
  { type: 'ambiguous',   label: '〜 Ambiguous' },
  { type: 'misleading',  label: '⚡ Misleading' },
  { type: 'conflicting', label: '⚡ Conflicts' },
]

// ── Quality Check (AI) ────────────────────────────────────────────────────────

const { loading: qcLoading, error: qcError, lastRunAt: qcLastRunAt, progress: qcProgress, runCheck: _qcRun } = useSpecQualityCheck()

async function runQualityCheck(): Promise<void> {
  if (!_planModel.value) return
  const others = (_allPlanModels.value as Array<{ id: string; name: string; spec: SpecBlock }>)
    .filter(m => m.id !== _planModel.value?.id)
  _qcPreCheckScore.value = scoreSpec(props.spec).score
  const results = await _qcRun(props.spec, _planModel.value.name, others)
  _ann.value.mergeAiAnnotations(results)
}

const qcLastRunLabel = computed<string>(() => {
  if (!qcLastRunAt.value) return ''
  const d = qcLastRunAt.value
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
})

const { scoreSpec } = useSpecQuality()
const _qcPreCheckScore = ref<number | null>(null)

const qcHealthScore = computed<number>(() => scoreSpec(props.spec).score)

const qcDelta = computed<number | null>(() => {
  if (_qcPreCheckScore.value === null || !qcLastRunAt.value) return null
  return qcHealthScore.value - _qcPreCheckScore.value
})

/** One-line owner summary using first owner: "Tom Gilb  ·  Product ownership  ·  Gilb International" */
const ownerLine = computed<string>(() => {
  const o = _planModel.value?.owners?.[0]
  if (!o) return ''
  return [o.name, o.responsibility, o.organization, o.location]
    .filter(Boolean)
    .join('  ·  ')
})

// ── Ranked solutions (descending V/C) ────────────────────────────────────────

const rankedSolutions = computed<string[]>(() =>
  [...props.spec.solutions.map((s) => s.id)].sort((a, b) => {
    const ra = props.vcRatios[a] ?? 0
    const rb = props.vcRatios[b] ?? 0
    return rb - ra
  }),
)

/** Format V/C ratio for display */
function formatVC(solutionId: string): string {
  const ratio = props.vcRatios[solutionId]
  if (ratio === undefined || ratio === null) return '–'
  return Number.isFinite(ratio) ? ratio.toFixed(2) : '∞'
}

/** Rank badge position (1-based) for a solution */
function rankOf(solutionId: string): number {
  return rankedSolutions.value.indexOf(solutionId) + 1
}

/** Total impact sum for a solution (sum of all V×S cells) */
function totalImpact(solutionId: string): number {
  return props.spec.values.reduce((sum, v) => {
    return sum + ((props.impactMatrix[v.id]?.[solutionId]) ?? 0)
  }, 0)
}

// ── Download as HTML (Mac Notes / Pages / Word compatible) ───────────────────
//
// Generates a self-contained HTML document with inline styles — no external CSS.
// Workflow for Mac Notes:
//   Option A  Open the file in Safari → Share (toolbar) → Notes → Save
//   Option B  Open in any browser → ⌘A → ⌘C → paste into a Notes note
//
// The impact matrix uses the same 5-tier colour spec as the IET live table.

function cellBg(v: number): string {
  if (v <= -50) return 'background:#7f1d1d;color:#ffffff'
  if (v < 0)    return 'background:#fecaca;color:#7f1d1d'
  if (v === 0)  return 'background:#f9fafb;color:#9ca3af'
  if (v < 70)   return 'background:#d6d3d1;color:#292524'
  return 'background:#bbf7d0;color:#14532d;font-weight:700'
}

// Safely stringify any field — guards against LLM returning arrays/objects
// where the spec type says string (e.g. s.impact can arrive as an object array).
function _safeStr(val: unknown): string {
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return (val as unknown[]).map(_safeStr).filter(Boolean).join(' · ')
  if (val && typeof val === 'object') {
    const o = val as Record<string, unknown>
    const t = o['text'] ?? o['description'] ?? o['name'] ?? o['value']
    if (t) return _safeStr(t)
    return Object.values(o).map(_safeStr).filter(Boolean).join(' · ')
  }
  return val != null ? String(val) : ''
}

function buildHTMLExport(): string {
  const F   = '-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif'
  const fnt = `font-family:${F}`
  const sols = props.spec.solutions
  const vals = props.spec.values
  const sh   = detectedStakeholders.value

  const fCount = props.spec.functions.length
  const vCount = vals.length
  const sCount = sols.length
  const eCount = props.evoSteps.length
  const topSol = [...sols].sort((a, b) => rankOf(a.id) - rankOf(b.id))[0]

  // ── Helpers ───────────────────────────────────────────────────────────────
  const pill = (text: string, bg: string, color: string) =>
    `<span style="${fnt};display:inline-block;background:${bg};color:${color};border-radius:6px;padding:4px 13px;font-size:11px;font-weight:700;margin:2px 4px 2px 0;letter-spacing:.02em">${text}</span>`

  const secHead = (icon: string, label: string, color: string) =>
    `<div style="${fnt};display:flex;align-items:center;gap:12px;padding:32px 60px 14px">
      <span style="font-size:20px;line-height:1">${icon}</span>
      <span style="font-size:11px;font-weight:800;color:${color};letter-spacing:.14em;text-transform:uppercase">${label}</span>
      <div style="flex:1;height:2px;background:linear-gradient(to right,${color}60,transparent)"></div>
    </div>`

  // ── Cover ─────────────────────────────────────────────────────────────────
  const statBadges = [
    fCount ? pill(`🎯 ${fCount} Functions`, 'rgba(219,234,254,0.22)', '#bfdbfe') : '',
    vCount ? pill(`📊 ${vCount} Values`,    'rgba(167,243,208,0.22)', '#6ee7b7') : '',
    sCount ? pill(`💡 ${sCount} Solutions`, 'rgba(221,214,254,0.22)', '#ddd6fe') : '',
    eCount ? pill(`🔁 ${eCount} Evo Steps`, 'rgba(255,255,255,0.14)', '#e0e7ff') : '',
  ].join('')

  let body = `
<div style="${fnt};background:linear-gradient(150deg,#0f172a 0%,#1e1b4b 40%,#312e81 70%,#4338ca 100%);padding:56px 60px 48px;position:relative;overflow:hidden">
  <div style="position:absolute;top:-80px;right:-80px;width:340px;height:340px;border-radius:50%;background:rgba(99,102,241,0.10)"></div>
  <div style="position:absolute;bottom:-50px;left:80px;width:220px;height:220px;border-radius:50%;background:rgba(139,92,246,0.07)"></div>
  <div style="position:relative">
    <p style="${fnt};font-size:10px;font-weight:800;color:#818cf8;letter-spacing:.22em;text-transform:uppercase;margin:0 0 18px">Evolutionary Priority Plan</p>
    <h1 style="${fnt};font-size:38px;font-weight:900;color:#fff;margin:0 0 14px;line-height:1.08;letter-spacing:-.02em">${identityTitle.value}</h1>
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:${ownerLine.value ? '16px' : '22px'}">
      ${props.planVersion ? `<span style="${fnt};background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.22);border-radius:999px;padding:5px 16px;font-size:12px;font-weight:700;color:#fff">v${props.planVersion}</span>` : ''}
      <span style="${fnt};font-size:13px;color:#a5b4fc">${identityStamp.value}</span>
    </div>
    ${ownerLine.value ? `<div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:24px;padding:10px 18px;background:rgba(255,255,255,0.08);border-radius:10px;border-left:3px solid #818cf8"><span style="font-size:16px">👤</span><span style="${fnt};font-size:13px;color:#c7d2fe;font-weight:500">${ownerLine.value}</span></div>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:6px">${statBadges}</div>
  </div>
</div>`

  // ── Executive summary strip ───────────────────────────────────────────────
  if (topSol) {
    body += `
<div style="${fnt};background:#fff;border-bottom:2px solid #f1f5f9;padding:22px 60px;display:flex;gap:48px;flex-wrap:wrap;align-items:flex-start">
  <div>
    <p style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.12em;margin:0 0 6px">Top-Ranked Solution</p>
    <p style="font-size:15px;font-weight:700;color:#111827;margin:0;max-width:380px;line-height:1.4">${topSol.description}</p>
  </div>
  <div>
    <p style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.12em;margin:0 0 6px">Means Efficiency (V/C)</p>
    <p style="font-size:28px;font-weight:900;color:#15803d;margin:0;line-height:1">${formatVC(topSol.id)}</p>
  </div>
  ${eCount ? `<div><p style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.12em;margin:0 0 6px">Evo Steps</p><p style="font-size:28px;font-weight:900;color:#4f46e5;margin:0;line-height:1">${eCount}</p></div>` : ''}
  ${vCount ? `<div><p style="font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.12em;margin:0 0 6px">Values Tracked</p><p style="font-size:28px;font-weight:900;color:#0891b2;margin:0;line-height:1">${vCount}</p></div>` : ''}
</div>`
  }

  // ── Original Input ────────────────────────────────────────────────────────
  if (props.originalInput) {
    const inp = props.originalInput
    body += secHead('✍️', 'Original Input', '#6b7280')
    body += `<div style="${fnt};margin:0 60px;background:#fff;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden">`
    ;[['Stakes', inp.stakes], ['Ends', inp.ends], ['Means', inp.means]]
      .filter(([, v]) => v)
      .forEach(([k, v], i) => {
        body += `<div style="padding:16px 22px;${i > 0 ? 'border-top:1px solid #f3f4f6' : ''}">
          <p style="${fnt};font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.12em;margin:0 0 5px">${k}</p>
          <p style="${fnt};font-size:14px;color:#1f2937;margin:0;line-height:1.6">${v}</p>
        </div>`
      })
    body += `</div>`
  }

  // ── Functions ─────────────────────────────────────────────────────────────
  if (props.spec.functions.length) {
    body += secHead('🎯', 'Functions', '#2563eb')
    body += `<div style="margin:0 60px;display:flex;flex-direction:column;gap:10px">`
    for (const f of props.spec.functions) {
      const sc = _safeStr(f.successCriteria)
      body += `<div style="${fnt};background:#fff;border-radius:12px;border:1px solid #dbeafe;border-left:5px solid #2563eb;overflow:hidden">
        <div style="padding:16px 20px">
          <p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 ${sc ? '12px' : '0'};line-height:1.5">${f.description}</p>
          ${sc ? `<div style="background:#eff6ff;border-radius:8px;padding:10px 14px">
            <p style="font-size:9px;font-weight:800;color:#1d4ed8;text-transform:uppercase;letter-spacing:.12em;margin:0 0 4px">✓ Success Criteria</p>
            <p style="font-size:12px;color:#1e40af;margin:0;line-height:1.6">${sc}</p>
          </div>` : ''}
          ${f.functionOfValue ? `<p style="font-size:11px;color:#93c5fd;margin:8px 0 0;font-weight:500">For: ${f.functionOfValue}</p>` : ''}
        </div>
      </div>`
    }
    body += `</div>`
  }

  // ── Values ────────────────────────────────────────────────────────────────
  if (vals.length) {
    body += secHead('📊', 'Values', '#16a34a')
    body += `<div style="margin:0 60px;display:flex;flex-direction:column;gap:10px">`
    for (const v of vals) {
      const now    = v.status?.replace(/^Status\s*/i,  '') ?? ''
      const minVal = v.tolerable?.replace(/^Tolerable\s*/i, '') ?? ''
      const goal   = v.goal?.replace(/^Goal\s*/i, '') ?? ''
      body += `<div style="${fnt};background:#fff;border-radius:12px;border:1px solid #dcfce7;border-left:5px solid #16a34a;overflow:hidden">
        <div style="padding:16px 20px">
          <p style="font-size:14px;font-weight:700;color:#111827;margin:0 0 14px;line-height:1.45">${v.description}</p>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:${(v.scale || v.meter) ? '12px' : '0'}">
            <div style="background:${now ? '#fef9c3' : '#f9fafb'};border-radius:8px;padding:10px 12px">
              <p style="font-size:9px;font-weight:800;color:${now ? '#854d0e' : '#9ca3af'};text-transform:uppercase;letter-spacing:.12em;margin:0 0 4px">Now</p>
              <p style="font-size:12px;color:${now ? '#78350f' : '#d1d5db'};margin:0;font-weight:600">${now || '—'}</p>
            </div>
            <div style="background:${minVal ? '#dbeafe' : '#f9fafb'};border-radius:8px;padding:10px 12px">
              <p style="font-size:9px;font-weight:800;color:${minVal ? '#1d4ed8' : '#9ca3af'};text-transform:uppercase;letter-spacing:.12em;margin:0 0 4px">Minimum</p>
              <p style="font-size:12px;color:${minVal ? '#1e3a8a' : '#d1d5db'};margin:0;font-weight:600">${minVal || '—'}</p>
            </div>
            <div style="background:${goal ? '#dcfce7' : '#f9fafb'};border-radius:8px;padding:10px 12px;${goal ? 'border:1px solid #bbf7d0' : ''}">
              <p style="font-size:9px;font-weight:800;color:${goal ? '#15803d' : '#9ca3af'};text-transform:uppercase;letter-spacing:.12em;margin:0 0 4px">🎯 Goal</p>
              <p style="font-size:13px;color:${goal ? '#14532d' : '#d1d5db'};margin:0;font-weight:800">${goal || '—'}</p>
            </div>
          </div>
          ${(v.scale || v.meter) ? `<p style="font-size:11px;color:#6b7280;margin:0">${v.scale ? `<strong style="color:#374151">Scale:</strong> ${v.scale}` : ''}${v.scale && v.meter ? ' &nbsp;·&nbsp; ' : ''}${v.meter ? `<strong style="color:#374151">Meter:</strong> ${v.meter}` : ''}</p>` : ''}
        </div>
      </div>`
    }
    body += `</div>`
  }

  // ── Solutions — sorted by rank ─────────────────────────────────────────────
  if (sols.length) {
    body += secHead('💡', 'Solutions — Ranked by Value/Cost', '#7c3aed')
    body += `<div style="margin:0 60px;display:flex;flex-direction:column;gap:10px">`
    for (const s of [...sols].sort((a, b) => rankOf(a.id) - rankOf(b.id))) {
      const rank   = rankOf(s.id)
      const vc     = formatVC(s.id)
      const top    = rank === 1
      const impact = _safeStr(s.impact)
      body += `<div style="${fnt};background:${top ? '#f0fdf4' : '#fff'};border-radius:12px;border:1px solid ${top ? '#bbf7d0' : '#ede9fe'};border-left:5px solid ${top ? '#16a34a' : '#7c3aed'};overflow:hidden">
        <div style="padding:16px 20px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:${impact ? '12px' : '0'}">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${top ? '#16a34a' : '#7c3aed'};color:#fff;font-size:12px;font-weight:800;flex-shrink:0">${rank}</span>
                ${top ? `<span style="font-size:10px;font-weight:800;color:#15803d;text-transform:uppercase;letter-spacing:.1em;background:#dcfce7;padding:3px 10px;border-radius:999px">🏆 Best Value</span>` : ''}
              </div>
              <p style="font-size:14px;font-weight:${top ? '700' : '600'};color:#111827;margin:0;line-height:1.45">${s.description}</p>
            </div>
            ${vc !== '–' ? `<div style="text-align:center;flex-shrink:0;padding:8px 14px;background:${top ? '#dcfce7' : '#f5f3ff'};border-radius:10px">
              <p style="font-size:9px;font-weight:700;color:${top ? '#15803d' : '#6b7280'};text-transform:uppercase;letter-spacing:.1em;margin:0 0 2px">V/C</p>
              <p style="font-size:24px;font-weight:900;color:${top ? '#15803d' : '#6d28d9'};margin:0;line-height:1">${vc}</p>
            </div>` : ''}
          </div>
          ${impact ? `<div style="background:${top ? 'rgba(22,163,74,0.08)' : '#f5f3ff'};border-radius:8px;padding:10px 14px">
            <p style="font-size:9px;font-weight:800;color:${top ? '#15803d' : '#6d28d9'};text-transform:uppercase;letter-spacing:.12em;margin:0 0 4px">Impact Estimate</p>
            <p style="font-size:12px;color:${top ? '#14532d' : '#4c1d95'};margin:0;line-height:1.6">${impact}</p>
          </div>` : ''}
        </div>
      </div>`
    }
    body += `</div>`
  }

  // ── Value Delivery Table ───────────────────────────────────────────────────
  if (sols.length && vals.length) {
    body += secHead('🎯', 'Value Delivery Table', '#374151')
    const TH  = `background:#1f2937;color:#fff;padding:10px 14px;font-size:12px;text-align:left;white-space:normal;font-weight:700;border:1px solid #374151`
    const THC = `${TH};text-align:center`
    const TD  = `padding:9px 12px;font-size:13px;border:1px solid #e5e7eb;text-align:center;vertical-align:middle`
    const TDL = `padding:9px 14px;font-size:13px;font-weight:600;border:1px solid #e5e7eb;color:#1f2937`
    const TDF = `padding:9px 14px;font-size:12px;font-weight:700;border:1px solid #e5e7eb`
    body += `<div style="${fnt};margin:0 60px;border-radius:14px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);border:1px solid #e5e7eb">
      <table style="border-collapse:collapse;font-family:${F};font-size:13px;width:100%">
        <thead><tr>
          <th style="${TH}">Value / Solution</th>
          ${sols.map(s => `<th style="${THC}">${s.description}<br><span style="font-size:10px;font-weight:500;opacity:.65">Rank #${rankOf(s.id)}</span></th>`).join('')}
        </tr></thead>
        <tbody>${vals.map(v =>
          `<tr><td style="${TDL}">${v.description}</td>${sols.map(s => {
            const vv = props.impactMatrix[v.id]?.[s.id] ?? 0
            return `<td style="${TD};${cellBg(vv)}">${vv}%</td>`
          }).join('')}</tr>`
        ).join('')}</tbody>
        <tfoot>
          <tr><td style="${TDF}">Total Impact</td>${sols.map(s => `<td style="${TD};background:#f9fafb;font-weight:700">${totalImpact(s.id)}</td>`).join('')}</tr>
          <tr><td style="${TDF};color:#1d4ed8">⏱ Calendar (wks)</td>${sols.map(s => `<td style="${TD};background:#eff6ff;color:#1e40af">${props.calendarCosts[s.id] ?? 0}</td>`).join('')}</tr>
          <tr><td style="${TDF};color:#7c3aed">💰 Capital ($k)</td>${sols.map(s => `<td style="${TD};background:#f5f3ff;color:#6d28d9">${props.capitalCosts[s.id] ?? 0}</td>`).join('')}</tr>
          <tr style="border-top:2px solid #374151"><td style="${TDF}">Means Efficiency</td>${sols.map(s => {
            const top = rankOf(s.id) === 1
            return `<td style="${TD};font-weight:700;background:${top ? '#dcfce7' : '#f9fafb'};color:${top ? '#15803d' : '#374151'}">${formatVC(s.id)}<br><span style="font-size:10px;color:${top ? '#16a34a' : '#9ca3af'}">#${rankOf(s.id)}</span></td>`
          }).join('')}</tr>
        </tfoot>
      </table>
    </div>`
  }

  // ── Evo Steps ─────────────────────────────────────────────────────────────
  if (props.evoSteps.length) {
    body += secHead('🔁', 'Evolutionary Steps', '#4f46e5')
    body += `<div style="${fnt};margin:0 60px;position:relative">`
    body += `<div style="position:absolute;left:21px;top:21px;bottom:21px;width:2px;background:linear-gradient(to bottom,#4f46e5,#7c3aed,transparent)"></div>`
    for (const [idx, step] of props.evoSteps.entries()) {
      const tasks = props.tasksByStep[step.name] ?? []
      const lv    = step.linkedValues.map(lv =>
        `<span style="display:inline-block;background:#e0e7ff;color:#4338ca;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:600;margin-right:4px;margin-bottom:2px">${lv}</span>`
      ).join('')
      body += `<div style="display:flex;gap:20px;margin-bottom:14px">
        <div style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(79,70,229,0.35);z-index:1;position:relative">${idx + 1}</div>
        <div style="flex:1;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:14px 18px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px">
            <p style="font-size:14px;font-weight:700;color:#111827;margin:0">${step.name}</p>
            <span style="font-size:11px;font-weight:700;color:#4f46e5;background:#e0e7ff;border-radius:999px;padding:3px 10px;white-space:nowrap">${step.effortPercent}% effort</span>
          </div>
          <p style="font-size:13px;color:#374151;margin:0 0 ${lv ? '10px' : '0'};line-height:1.55">${step.description}</p>
          ${lv ? `<div style="margin-bottom:${tasks.length ? '10px' : '0'}">${lv}</div>` : ''}
          ${tasks.length ? `<div style="background:#f9fafb;border-radius:8px;padding:10px 14px">
            <p style="font-size:9px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.12em;margin:0 0 6px">Tasks</p>
            ${tasks.map(t => `<p style="font-size:12px;color:${t.completed ? '#9ca3af' : '#374151'};${t.completed ? 'text-decoration:line-through;' : ''}margin:0 0 3px;line-height:1.5">
              <span style="color:${t.completed ? '#6ee7b7' : '#d1d5db'};margin-right:5px">${t.completed ? '✓' : '○'}</span>${t.description}${t.effortHours != null ? ` <span style="font-size:11px;color:#9ca3af">(${t.effortHours}h)</span>` : ''}
            </p>`).join('')}
          </div>` : ''}
        </div>
      </div>`
    }
    body += `</div>`
  }

  // ── Stakeholders ──────────────────────────────────────────────────────────
  if (sh.length) {
    body += secHead('👥', 'Stakeholders', '#475569')
    const TH2  = `background:#334155;color:#fff;padding:10px 14px;font-size:12px;text-align:left;white-space:normal;font-weight:700;border:1px solid #475569`
    const TH2C = `${TH2};text-align:center`
    const TD2  = `padding:9px 12px;font-size:13px;border:1px solid #e5e7eb;text-align:center`
    const TD2L = `padding:9px 14px;font-size:13px;font-weight:600;border:1px solid #e5e7eb`
    body += `<div style="${fnt};margin:0 60px;border-radius:14px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);border:1px solid #e5e7eb">
      <table style="border-collapse:collapse;font-family:${F};font-size:13px;width:100%">
        <thead><tr>
          <th style="${TH2}">Stakeholder</th>
          ${vals.map(v => `<th style="${TH2C}">${v.description}</th>`).join('')}
        </tr></thead>
        <tbody>${sh.map((s, i) => {
          const rowBg = i % 2 === 0 ? '' : 'background:#f9fafb;'
          return `<tr>
            <td style="${TD2L};${rowBg}"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.colour};margin-right:8px;vertical-align:middle"></span>${s.name}</td>
            ${vals.map(v => {
              const lv  = impactLevel(vEntryText(v), s)
              const bgs: Record<number, string> = { 0: '#f1f5f9', 1: '#dbeafe', 2: '#fef3c7', 3: '#d1fae5' }
              const cols: Record<number, string> = { 0: '#94a3b8', 1: '#1d4ed8', 2: '#92400e', 3: '#065f46' }
              return `<td style="${TD2};${rowBg}background:${bgs[lv] ?? '#f1f5f9'};color:${cols[lv] ?? '#94a3b8'};${lv >= 2 ? 'font-weight:700;' : ''}">${IMPACT_LABEL[lv]}</td>`
            }).join('')}
          </tr>`
        }).join('')}</tbody>
      </table>
    </div>`
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  body += `
<div style="${fnt};background:#0f172a;padding:22px 60px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:40px">
  <div>
    <p style="font-size:12px;font-weight:700;color:#818cf8;margin:0">SEM · Evolutionary Planning</p>
    <p style="font-size:11px;color:#475569;margin:3px 0 0">Planguage specification standard</p>
  </div>
  <p style="font-size:11px;color:#475569;margin:0">${identityStamp.value}</p>
</div>`

  const title = identityTitle.value
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
</style>
</head>
<body>${body}</body>
</html>`
}

// ── Stakeholders ─────────────────────────────────────────────────────────────
// Auto-detected from V. entry descriptions — same logic as ImpactEstimationView.

const detectedStakeholders = computed<StakeholderMatch[]>(() => {
  // Scan all spec entry descriptions (F. + V. + S.) plus original input text so
  // stakeholders mentioned anywhere in the plan are detected, not just V. descriptions.
  //
  // Bug fix 2026-05-12: do NOT prefix `${e.id}` to the scanned text. Spec IDs
  // like "V.NovelAssetAllocation" split on the period and end up as single
  // capital-letter "words" inside contextual phrases, polluting the matrix
  // with stakeholders such as "Retirement savings V NovelAssetAllocation".
  // Pure description text gives clean stakeholder names.
  const specText = [
    ...props.spec.functions.map(e => e.description),
    ...props.spec.values.map(e => e.description),
    ...props.spec.solutions.map(e => e.description),
    props.originalInput ? `${props.originalInput.stakes} ${props.originalInput.ends} ${props.originalInput.means}` : '',
  ].join(' ')
  return extractAllStakeholders(specText)
})

function vEntryText(v: { id: string; description: string }): string {
  // Bug fix 2026-05-12: drop the `id` prefix here too — IDs add no semantic
  // signal for impact matching and could otherwise let "V" / "S" letters
  // satisfy keyword matches against contextual stakeholders.
  return v.description
}

const IMPACT_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: '–',
  1: 'Low',
  2: 'Medium',
  3: 'High',
}

// ── Section HTML + TSV builders ───────────────────────────────────────────────
// Each section has an HTML builder (rich, coloured) and a TSV builder (plain
// text fallback). Both are written to the clipboard so Keynote/Pages/Notes
// receive styled content while plain-text apps get a tab-separated table.
// Per Keynote table standard: all labels use .description text, not camelCase IDs.

const _FONT = '-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif'
const _TBL  = `border-collapse:collapse;font-family:${_FONT};font-size:13px;width:100%`
const _TD   = 'padding:8px 12px;border:1px solid #e5e7eb;color:#374151;vertical-align:top;white-space:normal'
const _TDA  = `${_TD};background:#f9fafb`  // alternating row tint

function _thStyle(bg: string): string {
  return `background:${bg};color:#ffffff;padding:8px 12px;font-size:12px;font-weight:700;text-align:left;white-space:normal`
}
function _wrap(tableInner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><table style="${_TBL}">${tableInner}</table></body></html>`
}

// ── Functions ────────────────────────────────────────────────────────────────
function buildFunctionsHTML(): string {
  const H = _thStyle('#2563eb')
  let t = `<thead><tr><th style="${H}">Function</th><th style="${H}">Success Criteria</th><th style="${H}">For Value</th></tr></thead><tbody>`
  props.spec.functions.forEach((f, i) => {
    const td = i % 2 === 0 ? _TD : _TDA
    t += `<tr><td style="${td}">${f.description}</td><td style="${td}">${f.successCriteria}</td><td style="${td}">${f.functionOfValue}</td></tr>`
  })
  return _wrap(t + '</tbody>')
}
function buildFunctionsTSV(): string {
  const h = ['Function', 'Success Criteria', 'For Value']
  const rows = props.spec.functions.map((f) => [f.description, f.successCriteria, f.functionOfValue])
  return [h, ...rows].map((r) => r.join('\t')).join('\n')
}

// ── Values ───────────────────────────────────────────────────────────────────
function buildValuesHTML(): string {
  const H = _thStyle('#7c3aed')
  let t = `<thead><tr><th style="${H}">Value</th><th style="${H}">Scale</th><th style="${H}">Meter</th><th style="${H}">Status</th><th style="${H}">Tolerable</th><th style="${H}">Goal</th></tr></thead><tbody>`
  props.spec.values.forEach((v, i) => {
    const td = i % 2 === 0 ? _TD : _TDA
    t += `<tr><td style="${td};font-weight:600">${v.description}</td><td style="${td}">${v.scale}</td><td style="${td}">${v.meter}</td><td style="${td}">${v.status}</td><td style="${td}">${v.tolerable}</td><td style="${td}">${v.goal}</td></tr>`
  })
  return _wrap(t + '</tbody>')
}
function buildValuesTSV(): string {
  const h = ['Value', 'Scale', 'Meter', 'Status', 'Tolerable', 'Goal']
  const rows = props.spec.values.map((v) => [v.description, v.scale, v.meter, v.status, v.tolerable, v.goal])
  return [h, ...rows].map((r) => r.join('\t')).join('\n')
}

// ── Solutions ─────────────────────────────────────────────────────────────────
function buildSolutionsHTML(): string {
  const H = _thStyle('#7c3aed')
  let t = `<thead><tr><th style="${H}">Solution</th><th style="${H}">Impact Estimate</th><th style="${H}">For Function</th></tr></thead><tbody>`
  props.spec.solutions.forEach((s, i) => {
    const td = i % 2 === 0 ? _TD : _TDA
    t += `<tr><td style="${td};font-weight:600">${s.description}</td><td style="${td}">${s.impact}</td><td style="${td}">${s.function}</td></tr>`
  })
  return _wrap(t + '</tbody>')
}
function buildSolutionsTSV(): string {
  const h = ['Solution', 'Impact Estimate', 'For Function']
  const rows = props.spec.solutions.map((s) => [s.description, s.impact, s.function])
  return [h, ...rows].map((r) => r.join('\t')).join('\n')
}

// ── Evo Steps ─────────────────────────────────────────────────────────────────
function buildEvoStepsHTML(): string {
  if (!props.evoSteps.length) return ''
  const H = _thStyle('#4f46e5')
  let t = `<thead><tr><th style="${H};width:32px">#</th><th style="${H}">Step</th><th style="${H}">Description</th><th style="${H}">Linked Values</th><th style="${H};width:72px">Effort %</th></tr></thead><tbody>`
  props.evoSteps.forEach((step, i) => {
    const td = i % 2 === 0 ? _TD : _TDA
    const numStyle = `${td};text-align:center;font-weight:700;color:#4f46e5`
    t += `<tr><td style="${numStyle}">${i + 1}</td><td style="${td};font-weight:600">${step.name}</td><td style="${td}">${step.description}</td><td style="${td};color:#6b7280">${step.linkedValues.join(', ')}</td><td style="${td};text-align:center">${step.effortPercent}%</td></tr>`
  })
  return _wrap(t + '</tbody>')
}
function buildEvoStepsTSV(): string {
  if (!props.evoSteps.length) return ''
  const h = ['#', 'Step', 'Description', 'Linked Values', 'Effort %']
  const rows = props.evoSteps.map((step, i) => [String(i + 1), step.name, step.description, step.linkedValues.join(', '), `${step.effortPercent}%`])
  return [h, ...rows].map((r) => r.join('\t')).join('\n')
}

// ── Stakeholders ──────────────────────────────────────────────────────────────
const IMPACT_BG: Record<0 | 1 | 2 | 3, string> = {
  0: 'background:#f1f5f9;color:#94a3b8',
  1: 'background:#dbeafe;color:#1d4ed8',
  2: 'background:#fef3c7;color:#b45309;font-weight:600',
  3: 'background:#d1fae5;color:#065f46;font-weight:700',
}

function buildStakeholdersHTML(): string {
  const sh = detectedStakeholders.value
  if (!sh.length) return ''
  const H  = _thStyle('#374151')
  const HC = `${H};text-align:center`
  let t = `<thead><tr><th style="${H}">Stakeholder</th>`
  for (const v of props.spec.values) t += `<th style="${HC}">${v.description}</th>`
  t += `</tr></thead><tbody>`
  sh.forEach((s, i) => {
    const rowBg = i % 2 === 0 ? '' : 'background:#f9fafb;'
    const dotStyle = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.colour};margin-right:6px;vertical-align:middle`
    t += `<tr><td style="${_TD};${rowBg}font-weight:600"><span style="${dotStyle}"></span>${s.name}</td>`
    for (const v of props.spec.values) {
      const level = impactLevel(vEntryText(v), s)
      t += `<td style="${_TD};${rowBg}text-align:center;${IMPACT_BG[level]}">${IMPACT_LABEL[level]}</td>`
    }
    t += '</tr>'
  })
  return _wrap(t + '</tbody>')
}
function buildStakeholdersTSV(): string {
  const sh = detectedStakeholders.value
  if (!sh.length) return ''
  const h = ['Stakeholder', ...props.spec.values.map((v) => v.description)]
  const rows = sh.map((s) => [s.name, ...props.spec.values.map((v) => IMPACT_LABEL[impactLevel(vEntryText(v), s)])])
  return [h, ...rows].map((r) => r.join('\t')).join('\n')
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
// Iterates evoSteps in order; for each step uses _tasksForStep() which returns
// recorded tasks when available, falling back to rule-based suggestions so tasks
// are ALWAYS documented even when effortHours/assignee are not yet filled in.
// Colour: slate (#374151) — matches SPEC_COLOURS.task.
function buildTasksHTML(): string {
  if (!props.evoSteps.length) return ''
  const H = _thStyle('#374151')
  let t = `<thead><tr><th style="${H}">Evo Step</th><th style="${H}">Task</th><th style="${H};width:80px">Effort (h)</th><th style="${H};width:120px">Assignee</th><th style="${H};width:60px">Done</th></tr></thead><tbody>`
  let row = 0
  props.evoSteps.forEach(step => {
    const tasks = _tasksForStep(step)
    tasks.forEach((task, ti) => {
      const td = row % 2 === 0 ? _TD : _TDA
      const stepCell = ti === 0
        ? `<td style="${td};font-weight:700;color:#374151;vertical-align:top" rowspan="${tasks.length}">${step.name}</td>`
        : ''
      t += `<tr>${stepCell}<td style="${td}">${task.description}</td><td style="${td};text-align:center">${task.effortHours ?? '—'}</td><td style="${td}">${task.assignee ?? '—'}</td><td style="${td};text-align:center">${task.completed ? '✓' : ''}</td></tr>`
      row++
    })
  })
  return _wrap(t + '</tbody>')
}
function buildTasksTSV(): string {
  if (!props.evoSteps.length) return ''
  const h = ['Evo Step', 'Task', 'Effort (h)', 'Assignee', 'Done']
  const rows: string[][] = []
  props.evoSteps.forEach(step => {
    _tasksForStep(step).forEach(task => {
      rows.push([step.name, task.description, String(task.effortHours ?? ''), task.assignee ?? '', task.completed ? '✓' : ''])
    })
  })
  return [h, ...rows].map(r => r.join('\t')).join('\n')
}

// ── VDT (Value Delivery Table / Impact Matrix) ───────────────────────────────
function buildVDTHTML(): string {
  const sols = props.spec.solutions
  const vals = props.spec.values
  if (!sols.length || !vals.length) return ''

  const H   = _thStyle('#1f2937')
  const HC  = `${H};text-align:center`
  const TDC = `${_TD};text-align:center`
  const TDR = `${_TD};font-weight:600`
  const TDF = `${_TD};font-weight:700;font-size:12px`  // footer rows

  let t = `<thead><tr><th style="${H}">Value / Solution</th>`
  for (const s of sols) t += `<th style="${HC}">${s.description}<br><span style="font-size:10px;font-weight:400;color:#9ca3af">#${rankOf(s.id)}</span></th>`
  t += `</tr></thead><tbody>`

  for (const v of vals) {
    t += `<tr><td style="${TDR}">${v.description}</td>`
    for (const s of sols) {
      const vv = props.impactMatrix[v.id]?.[s.id] ?? 0
      t += `<td style="${TDC};${cellBg(vv)}">${vv}%</td>`
    }
    t += '</tr>'
  }

  t += `</tbody><tfoot>`
  t += `<tr><td style="${TDF}">Total Impact</td>`
  for (const s of sols) t += `<td style="${TDC};background:#f9fafb;font-weight:700">${totalImpact(s.id)}</td>`
  t += `</tr>`

  t += `<tr><td style="${TDF};color:#1d4ed8">⏱ Calendar (wks)</td>`
  for (const s of sols) t += `<td style="${TDC};background:#eff6ff;color:#1e40af">${props.calendarCosts[s.id] ?? 0}</td>`
  t += `</tr>`

  t += `<tr><td style="${TDF};color:#7c3aed">💰 Capital ($k)</td>`
  for (const s of sols) t += `<td style="${TDC};background:#f5f3ff;color:#6d28d9">${props.capitalCosts[s.id] ?? 0}</td>`
  t += `</tr>`

  t += `<tr><td style="${TDF}">Means Efficiency</td>`
  for (const s of sols) {
    const top = rankOf(s.id) === 1
    t += `<td style="${TDC};font-weight:700;background:${top ? '#f0fdf4' : '#f9fafb'};color:${top ? '#15803d' : '#111827'}">`
    t += `${formatVC(s.id)}<br><span style="font-size:10px;color:${top ? '#16a34a' : '#9ca3af'}">#${rankOf(s.id)}</span></td>`
  }
  t += `</tr></tfoot>`

  return _wrap(t)
}

function buildVDTTSV(): string {
  const sols = props.spec.solutions
  const vals = props.spec.values
  if (!sols.length || !vals.length) return ''
  const header = ['Value / Solution', ...sols.map((s) => s.description)]
  const rows = vals.map((v) => [
    v.description,
    ...sols.map((s) => `${props.impactMatrix[v.id]?.[s.id] ?? 0}%`),
  ])
  const footer = [
    ['Total Impact',       ...sols.map((s) => String(totalImpact(s.id)))],
    ['Calendar (wks)',     ...sols.map((s) => String(props.calendarCosts[s.id] ?? 0))],
    ['Capital ($k)',       ...sols.map((s) => String(props.capitalCosts[s.id] ?? 0))],
    ['Means Efficiency',  ...sols.map((s) => formatVC(s.id))],
  ]
  return [header, ...rows, ...footer].map((r) => r.join('\t')).join('\n')
}

// ── Full-plan clipboard HTML ──────────────────────────────────────────────────
// Table-based layout so Keynote / Pages / Notes render colours correctly.
// (div + CSS gradient layouts are ignored by Keynote's paste engine; <table>
//  cell backgrounds and border colours are preserved — same as the VDT copy.)
// buildHTMLExport() stays unchanged and is used only for the file download.

function buildFullPlanClipboardHTML(): string {
  // ── KEYNOTE / PAGES / NOTES TABLE-BASED CLIPBOARD EXPORT ─────────────────
  // Rules: <table> cells only — div CSS gradients and border-radius are ignored
  // by Keynote's paste engine. Solid opaque background colors only (no rgba).
  // Section heading MUST be colspan first-row INSIDE each table (not separate).

  const F   = '-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif'
  const fnt = `font-family:${F}`
  const sols = props.spec.solutions
  const vals = props.spec.values
  const sh   = detectedStakeholders.value

  const BASE = `width:100%;border-collapse:collapse;font-family:${F};font-size:13px;margin-bottom:12px`

  // Column header style (section color, slightly lighter than sec heading)
  const thS = (bg: string, extra = '') =>
    `background:${bg};color:#fff;padding:10px 14px;font-size:11px;font-weight:700;` +
    `text-align:left;white-space:normal;border:1px solid ${bg};${extra}`

  // Data cell: white row / light-gray alternating
  const tdW = `padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b;vertical-align:top;white-space:normal`
  const tdG = `${tdW};background:#f8fafc`
  const td  = (i: number) => (i % 2 === 0 ? tdW : tdG)

  // Section heading — first row, full colspan, darkest shade of section color
  const sec = (emoji: string, label: string, darkBg: string, cols: number) =>
    `<tr><td colspan="${cols}" style="${fnt};background:${darkBg};color:#fff;` +
    `padding:11px 18px;font-size:10px;font-weight:800;letter-spacing:.18em;` +
    `text-transform:uppercase;border:1px solid ${darkBg}">${emoji}  ${label}</td></tr>`

  // Inline badge (solid opaque — rgba drops in Keynote)
  const badge = (text: string, bg: string, color: string) =>
    `<span style="display:inline-block;background:${bg};color:${color};border-radius:4px;` +
    `padding:4px 12px;font-size:11px;font-weight:700;margin-right:6px">${text}</span>`

  const fCount = props.spec.functions.length
  const vCount = vals.length
  const sCount = sols.length
  const cCount = (props.spec.constraints ?? []).length
  const eCount = props.evoSteps.length

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>` +
    `<body style="${fnt};margin:0;padding:20px;background:#f1f5f9">`

  // ── HEADER — 3-row table: accent strip · title/stamp · stats ─────────────
  // The bright accent strip at the top gives the paste a bold visual anchor.
  html +=
    `<table style="${BASE};margin-bottom:0">` +
    `<tr><td style="background:#6366f1;padding:6px 26px;border:1px solid #6366f1">` +
      `<span style="font-size:9px;font-weight:800;color:#fff;letter-spacing:.24em;` +
      `text-transform:uppercase">Evolutionary Priority Plan</span>` +
    `</td></tr></table>` +

    `<table style="${BASE};margin-bottom:0">` +
    `<tr><td style="background:#1e1b4b;padding:26px 26px 18px;border:1px solid #1e1b4b">` +
      `<p style="font-size:30px;font-weight:900;color:#fff;margin:0 0 10px;line-height:1.1">${identityTitle.value}</p>` +
      `<p style="font-size:13px;color:#a5b4fc;margin:0;font-weight:500">${props.planVersion ? `v${props.planVersion}  ·  ` : ''}${identityStamp.value}</p>` +
    `</td></tr></table>`

  if (ownerLine.value) {
    html +=
      `<table style="${BASE};margin-bottom:0">` +
      `<tr><td style="background:#312e81;padding:10px 26px 12px;border:1px solid #312e81">` +
        `<span style="font-size:12px;color:#c7d2fe;font-weight:500">👤  ${ownerLine.value}</span>` +
      `</td></tr></table>`
  }

  html +=
    `<table style="${BASE}">` +
    `<tr><td style="background:#4338ca;padding:11px 26px 14px;border:1px solid #4338ca">` +
      (fCount ? badge(`🎯  ${fCount} Functions`, '#1e3a8a', '#bfdbfe') : '') +
      (vCount ? badge(`📊  ${vCount} Values`,    '#14532d', '#bbf7d0') : '') +
      (sCount ? badge(`💡  ${sCount} Solutions`, '#4c1d95', '#ddd6fe') : '') +
      badge(`🚫  ${cCount} Constraint${cCount !== 1 ? 's' : ''}`, '#7f1d1d', '#fecaca') +
      (eCount ? badge(`🔁  ${eCount} Steps`,     '#1e40af', '#dbeafe') : '') +
    `</td></tr></table>`

  // ── ORIGINAL INPUT ────────────────────────────────────────────────────────
  if (props.originalInput) {
    const inp = props.originalInput
    html += `<table style="${BASE}">` + sec('✍️', 'Original Input', '#374151', 2)
    if (inp.stakes) html += `<tr><th style="${thS('#6b7280', 'width:90px;vertical-align:top')}">Stakes</th><td style="${tdW}">${inp.stakes}</td></tr>`
    if (inp.ends)   html += `<tr><th style="${thS('#6b7280', 'width:90px;vertical-align:top')}">Ends</th><td style="${tdG}">${inp.ends}</td></tr>`
    if (inp.means)  html += `<tr><th style="${thS('#6b7280', 'width:90px;vertical-align:top')}">Means</th><td style="${tdW}">${inp.means}</td></tr>`
    html += `</table>`
  }

  // ── FUNCTIONS ─────────────────────────────────────────────────────────────
  if (props.spec.functions.length) {
    html += `<table style="${BASE}">` + sec('🎯', 'Functions', '#1e3a8a', 3) +
      `<tr>` +
        `<th style="${thS('#2563eb')}">Function</th>` +
        `<th style="${thS('#2563eb')}">Success Criteria</th>` +
        `<th style="${thS('#2563eb')}">For Value</th>` +
      `</tr>`
    props.spec.functions.forEach((f, i) => {
      html += `<tr>` +
        `<td style="${td(i)};font-weight:700">${f.description}</td>` +
        `<td style="${td(i)};color:#2563eb">${_safeStr(f.successCriteria)}</td>` +
        `<td style="${td(i)};color:#6b7280;font-size:12px">${f.functionOfValue}</td>` +
      `</tr>`
    })
    html += `</table>`
  }

  // ── VALUES — Now / Min / Goal columns ────────────────────────────────────
  if (vals.length) {
    html += `<table style="${BASE}">` + sec('📊', 'Values', '#3b0764', 4) +
      `<tr>` +
        `<th style="${thS('#7c3aed')}">Value</th>` +
        `<th style="${thS('#7c3aed')}">Scale / Meter</th>` +
        `<th style="${thS('#7c3aed', 'text-align:center;width:120px')}">Now → Min</th>` +
        `<th style="${thS('#7c3aed', 'text-align:center;width:120px')}">🎯 Goal</th>` +
      `</tr>`
    vals.forEach((v, i) => {
      const scaleMeter = [v.scale, v.meter].filter(Boolean).join(' / ')
      const now  = v.status?.replace(/^Status\s*/i, '') ?? ''
      const min  = v.tolerable?.replace(/^Tolerable\s*/i, '') ?? ''
      const goal = v.goal?.replace(/^Goal\s*/i, '') ?? ''
      const nowMin = [now, min].filter(Boolean).join(' → ')
      html += `<tr>` +
        `<td style="${td(i)};font-weight:700">${v.description}</td>` +
        `<td style="${td(i)};color:#6b7280;font-size:12px">${scaleMeter}</td>` +
        `<td style="${td(i)};text-align:center;background:#fef9c3;color:#854d0e;font-weight:600">${nowMin}</td>` +
        `<td style="${td(i)};text-align:center;background:#dcfce7;color:#14532d;font-weight:800;font-size:14px">${goal}</td>` +
      `</tr>`
    })
    html += `</table>`
  }

  // ── SOLUTIONS — sorted by rank, rank #1 row highlighted ──────────────────
  if (sols.length) {
    const ranked = [...sols].sort((a, b) => rankOf(a.id) - rankOf(b.id))
    html += `<table style="${BASE}">` + sec('💡', 'Solutions — Ranked by Value / Cost', '#3b0764', 4) +
      `<tr>` +
        `<th style="${thS('#7c3aed', 'text-align:center;width:52px')}">Rank</th>` +
        `<th style="${thS('#7c3aed')}">Solution</th>` +
        `<th style="${thS('#7c3aed')}">Impact Estimate</th>` +
        `<th style="${thS('#7c3aed', 'text-align:center;width:80px')}">V/C Score</th>` +
      `</tr>`
    ranked.forEach((s, i) => {
      const rank = rankOf(s.id)
      const top  = rank === 1
      const rb   = top ? 'background:#f0fdf4;' : (i % 2 === 0 ? '' : 'background:#f8fafc;')
      const cb   = `padding:10px 14px;border:1px solid #e2e8f0;vertical-align:top;white-space:normal;${rb}`
      html += `<tr>` +
        `<td style="${cb}text-align:center;font-size:${top ? '16' : '14'}px;font-weight:800;` +
          `color:${top ? '#15803d' : '#7c3aed'}">${top ? '🏆' : rank}</td>` +
        `<td style="${cb}font-weight:${top ? '800' : '600'};color:#111827">${s.description}</td>` +
        `<td style="${cb}font-size:12px;color:#374151">${_safeStr(s.impact)}</td>` +
        `<td style="${cb}text-align:center;font-size:16px;font-weight:900;` +
          `color:${top ? '#15803d' : '#6d28d9'};background:${top ? '#dcfce7' : 'transparent'}">${formatVC(s.id)}</td>` +
      `</tr>`
    })
    html += `</table>`
  }

  // ── CONSTRAINTS — always included, even when empty ────────────────────────
  {
    const cons = props.spec.constraints ?? []
    html += `<table style="${BASE}">` + sec('🚫', `Constraints (${cCount})`, '#7f1d1d', 2)
    if (cons.length) {
      html += `<tr>` +
        `<th style="${thS('#b91c1c')}">Binary Rule (Must…)</th>` +
        `<th style="${thS('#b91c1c')}">Scope · Rationale</th>` +
      `</tr>`
      cons.forEach((c, i) => {
        const scopeRat = [c.scope, c.rationale].filter(Boolean).join('  ·  ')
        html += `<tr>` +
          `<td style="${td(i)};font-weight:600;color:#7f1d1d">${c.description || '—'}</td>` +
          `<td style="${td(i)};color:#374151;font-size:12px">${scopeRat || '—'}</td>` +
        `</tr>`
      })
    } else {
      html += `<tr><td colspan="2" style="${tdW};color:#94a3b8;font-style:italic;text-align:center">` +
        `No constraints defined — add Constraint Specs to bound the solution space` +
      `</td></tr>`
    }
    html += `</table>`
  }

  // ── VALUE DELIVERY TABLE ──────────────────────────────────────────────────
  if (sols.length && vals.length) {
    const vdtInner = buildVDTHTML().match(/<table[^>]*>([\s\S]*)<\/table>/i)?.[1] ?? ''
    if (vdtInner) {
      html += `<table style="${BASE}">` +
        sec('🎯', 'Value Delivery Table', '#111827', sols.length + 1) +
        vdtInner +
        `</table>`
    }
  }

  // ── EVO STEPS — numbered index col + step details ─────────────────────────
  if (props.evoSteps.length) {
    html += `<table style="${BASE}">` + sec('🔁', 'Evolutionary Steps', '#1e1b4b', 5) +
      `<tr>` +
        `<th style="${thS('#4338ca', 'text-align:center;width:38px')}">#</th>` +
        `<th style="${thS('#4338ca')}">Step</th>` +
        `<th style="${thS('#4338ca')}">Description</th>` +
        `<th style="${thS('#4338ca')}">Linked Values</th>` +
        `<th style="${thS('#4338ca', 'text-align:center;width:66px')}">Effort</th>` +
      `</tr>`
    props.evoSteps.forEach((step, i) => {
      html += `<tr>` +
        `<td style="${td(i)};text-align:center;font-size:15px;font-weight:800;` +
          `color:#fff;background:${i % 2 === 0 ? '#4338ca' : '#4f46e5'}">${i + 1}</td>` +
        `<td style="${td(i)};font-weight:700;color:#1e1b4b">${step.name}</td>` +
        `<td style="${td(i)};color:#374151">${step.description}</td>` +
        `<td style="${td(i)};color:#6d28d9;font-size:12px">${step.linkedValues.join('  ·  ')}</td>` +
        `<td style="${td(i)};text-align:center;font-weight:700;color:#4338ca">${step.effortPercent}%</td>` +
      `</tr>`
    })
    html += `</table>`
  }

  // ── STAKEHOLDERS ──────────────────────────────────────────────────────────
  if (sh.length) {
    const IMP_BG:  Record<number, string> = { 0: '#f1f5f9', 1: '#dbeafe', 2: '#fef3c7', 3: '#d1fae5' }
    const IMP_COL: Record<number, string> = { 0: '#94a3b8', 1: '#1d4ed8', 2: '#92400e', 3: '#065f46' }
    const cols = vals.length + 1
    html += `<table style="${BASE}">` + sec('👥', 'Stakeholders', '#1e293b', cols) +
      `<tr>` +
        `<th style="${thS('#334155')}">Stakeholder</th>` +
        vals.map(v => `<th style="${thS('#334155', 'text-align:center')}">${v.description}</th>`).join('') +
      `</tr>`
    sh.forEach((s, i) => {
      html += `<tr>` +
        `<td style="${td(i)};font-weight:600">` +
          `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;` +
            `background:${s.colour};margin-right:7px;vertical-align:middle"></span>${s.name}` +
        `</td>` +
        vals.map(v => {
          const lv  = impactLevel(vEntryText(v), s)
          const bg  = IMP_BG[lv]  ?? '#f1f5f9'
          const col = IMP_COL[lv] ?? '#94a3b8'
          return `<td style="${td(i)};text-align:center;background:${bg};color:${col};${lv >= 2 ? 'font-weight:700;' : ''}">${IMPACT_LABEL[lv]}</td>`
        }).join('') +
      `</tr>`
    })
    html += `</table>`
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  html +=
    `<table style="${BASE};margin-bottom:0">` +
    `<tr><td style="background:#0f172a;padding:12px 26px;border:1px solid #0f172a">` +
      `<span style="font-size:10px;color:#64748b;font-weight:600;letter-spacing:.08em">` +
        `SEM  ·  Evolutionary Planning  ·  ${identityStamp.value}` +
      `</span>` +
    `</td></tr></table>`

  html += `</body></html>`
  return html
}

// ── Rich copy helper ──────────────────────────────────────────────────────────
// Writes text/html + text/plain to the clipboard so apps that understand HTML
// (Keynote, Pages, Notes) receive styled content; plain-text apps get TSV.

const copiedSection = ref<string | null>(null)

async function copyRich(key: string, html: string, tsv: string): Promise<void> {
  if (!html && !tsv) return
  try {
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv],  { type: 'text/plain' }),
        }),
      ])
    } else {
      await navigator.clipboard.writeText(tsv)
    }
  } catch {
    try { await navigator.clipboard.writeText(tsv) } catch { /* silent */ }
  }
  copiedSection.value = key
  setTimeout(() => { if (copiedSection.value === key) copiedSection.value = null }, 2000)
}

// ── Full plan copy ────────────────────────────────────────────────────────────
// Uses the table-based clipboard builder so Keynote / Pages / Notes receive
// real colours. buildHTMLExport() is kept for the file download only.
async function copyFullPlan(): Promise<void> {
  const html = buildFullPlanClipboardHTML()
  // Plain-text fallback: section headers + descriptions
  const lines: string[] = [
    `${identityTitle.value}${props.planVersion ? '  v' + props.planVersion : ''}`,
    '',
    '── Functions ──',
    ...props.spec.functions.map((f) => `${f.description}\n  Success: ${f.successCriteria}`),
    '',
    '── Values ──',
    ...props.spec.values.map((v) => `${v.description}\n  Scale: ${v.scale}  Goal: ${v.goal}`),
    '',
    '── Solutions ──',
    ...props.spec.solutions.map((s) => `${s.description}\n  Impact: ${s.impact}`),
  ]
  const cons = props.spec.constraints ?? []
  if (cons.length) {
    lines.push('', '── Constraints ──')
    cons.forEach((c) => lines.push(`${c.id}: ${c.description}\n  Scope: ${c.scope}`))
  }
  if (props.evoSteps.length) {
    lines.push('', '── Evo Steps ──')
    props.evoSteps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step.name} — ${step.description}`)
      _tasksForStep(step).forEach(t => {
        const effort = t.effortHours != null ? ` (${t.effortHours}h)` : ''
        const assignee = t.assignee ? ` · ${t.assignee}` : ''
        const done = t.completed ? ' ✓' : ''
        lines.push(`   • ${t.description}${effort}${assignee}${done}`)
      })
    })
  }
  await copyRich('plan', html, lines.join('\n'))
}

/** Tracks the filename of the most recent download so the UI can confirm it. */
const lastDownloadedFile = ref<string | null>(null)

function downloadHTML(): void {
  const html = buildHTMLExport()
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const now  = new Date()
  const date = now.toISOString().slice(0, 10)
  const hh   = now.getHours().toString().padStart(2, '0')
  const mm   = now.getMinutes().toString().padStart(2, '0')
  const safeName = (props.planName ?? 'prioritised-plan')
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
  const vSuffix = props.planVersion ? `-v${props.planVersion}` : ''
  const filename = `${safeName}${vSuffix}-${date}-${hh}${mm}.html`
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  lastDownloadedFile.value = filename
}

// ── Email — write rich HTML to clipboard then open Mail ───────────────────────
// We write the same table-based HTML that pastes beautifully into Keynote/Pages.
// Mail.app receives styled tables when the user pastes with ⌘V.
// The plain-text fallback is included for apps that don't accept HTML paste.

function _buildEmailPlainText(): string {
  const lines: string[] = [
    `${identityTitle.value}${props.planVersion ? '  v' + props.planVersion : ''}`,
    ownerLine.value,
    '',
    '── Functions ──',
    ...props.spec.functions.map((f) => `• ${f.description}\n  ${_safeStr(f.successCriteria)}`),
    '',
    '── Values ──',
    ...props.spec.values.map((v) => `• ${v.description}\n  Goal: ${v.goal}`),
    '',
    '── Solutions ──',
    ...props.spec.solutions.map((s) => `• ${s.description}\n  Impact: ${_safeStr(s.impact)}`),
  ]
  const emailCons = props.spec.constraints ?? []
  if (emailCons.length) {
    lines.push('', '── Constraints ──')
    emailCons.forEach((c) => lines.push(`• ${c.id}: ${c.description}\n  Scope: ${c.scope}`))
  }
  if (props.evoSteps.length) {
    lines.push('', '── Evo Plan ──')
    props.evoSteps.forEach((step, i) => lines.push(`${i + 1}. ${step.name} — ${step.description}`))
  }
  return lines.filter((l) => l !== undefined).join('\n')
}

async function onEmailClick(): Promise<void> {
  // Write rich table HTML to clipboard while we still have the user gesture.
  // Mail.app will receive the styled version when the user pastes with ⌘V.
  await copyRich('email', buildFullPlanClipboardHTML(), _buildEmailPlainText())
  emit('email')
}

// Auto-download as soon as the export view mounts — the user clicked
// "Export Prioritised Plan" so the intent is clear; no extra click needed.
// 2026-05-15 fix: deferred one frame via nextTick so the component's initial
// paint completes before the blob-build + click fires. Previously, building
// buildHTMLExport() synchronously in onMounted blocked the browser's first
// paint, leaving the view blank until the download link was clicked.
// A try/catch ensures any failure (e.g. permissions) never collapses the view.
onMounted(() => {
  void nextTick(() => {
    try { downloadHTML() } catch { /* silent — user can click Download manually */ }
  })
})
</script>

<template>
  <div class="w-full max-w-3xl space-y-8 pb-16">

    <!-- ── Model identity banner ── -->
    <div
      class="w-full rounded-2xl overflow-hidden shadow-lg"
      style="background: linear-gradient(135deg, #312e81 0%, #4338ca 60%, #6d28d9 100%)"
      aria-label="Plan identity"
    >
      <div class="px-7 py-5">
        <p class="text-[10px] font-bold text-indigo-300 uppercase tracking-[.14em] mb-1.5">Plan</p>
        <h1 class="text-2xl font-extrabold text-white leading-tight mb-3 break-words">{{ identityTitle }}</h1>
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span
            v-if="planVersion"
            class="inline-flex items-center rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold text-white tracking-wide"
          >
            v{{ planVersion }}
          </span>
          <span class="text-sm text-indigo-200">{{ identityStamp }}</span>
        </div>
        <!-- Spec content summary -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-indigo-200 font-medium">
          <span>{{ spec.functions.length }} Function{{ spec.functions.length !== 1 ? 's' : '' }}</span>
          <span class="opacity-40">·</span>
          <span>{{ spec.values.length }} Value{{ spec.values.length !== 1 ? 's' : '' }}</span>
          <span class="opacity-40">·</span>
          <span>{{ spec.solutions.length }} Solution{{ spec.solutions.length !== 1 ? 's' : '' }}</span>
          <template v-if="evoSteps.length > 0">
            <span class="opacity-40">·</span>
            <span>{{ evoSteps.length }} Evo Step{{ evoSteps.length !== 1 ? 's' : '' }}</span>
          </template>
          <template v-if="sharpenRounds.length > 0">
            <span class="opacity-40">·</span>
            <span>🔪 {{ sharpenRounds.length }} Sharpening Round{{ sharpenRounds.length !== 1 ? 's' : '' }}</span>
          </template>
        </div>
        <!-- Owner line — shown when any owner field is set -->
        <div v-if="ownerLine" class="mt-3 pt-2.5 border-t border-white/10">
          <!-- Row: label · icon · owner line · More Info pin -->
          <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-[.14em] mb-1">Plan Owner · Planner</p>
          <div class="flex items-center gap-1.5">
            <span class="text-sm leading-none opacity-70" aria-hidden="true">👤</span>
            <span class="text-xs text-indigo-200 leading-relaxed">{{ ownerLine }}</span>
            <button
              type="button"
              class="ml-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold
                     transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              :class="ownerMoreOpen
                ? 'bg-white/25 text-white'
                : 'bg-white/10 text-indigo-300 hover:bg-white/20 hover:text-white'"
              @click="ownerMoreOpen = !ownerMoreOpen"
            >
              <span>📌</span>
              <span>{{ ownerMoreOpen ? 'Close' : 'More Info' }}</span>
            </button>
          </div>

          <!-- Expandable owner detail card -->
          <div
            v-if="ownerMoreOpen"
            class="mt-3 rounded-xl px-4 py-3 text-xs space-y-2"
            style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18)"
          >
            <p class="text-[10px] font-bold text-indigo-300 uppercase tracking-[.12em] mb-1">Owner Details</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <!-- Email -->
              <div v-if="_planModel?.owners?.[0]?.email" class="flex items-start gap-1.5">
                <span class="opacity-60 mt-0.5">✉️</span>
                <a
                  :href="`mailto:${_planModel.owners[0].email}`"
                  class="text-indigo-200 hover:text-white underline decoration-indigo-400/50 break-all"
                >{{ _planModel.owners[0].email }}</a>
              </div>
              <!-- Phone -->
              <div v-if="_planModel?.owners?.[0]?.phone" class="flex items-start gap-1.5">
                <span class="opacity-60 mt-0.5">📞</span>
                <a
                  :href="`tel:${_planModel.owners[0].phone}`"
                  class="text-indigo-200 hover:text-white"
                >{{ _planModel.owners[0].phone }}</a>
              </div>
              <!-- Organization -->
              <div v-if="_planModel?.owners?.[0]?.organization" class="flex items-start gap-1.5 sm:col-span-2">
                <span class="opacity-60 mt-0.5">🏢</span>
                <span class="text-indigo-200">{{ _planModel.owners[0].organization }}</span>
              </div>
              <!-- Location -->
              <div v-if="_planModel?.owners?.[0]?.location" class="flex items-start gap-1.5">
                <span class="opacity-60 mt-0.5">📍</span>
                <span class="text-indigo-200">{{ _planModel.owners[0].location }}</span>
              </div>
            </div>
            <!-- Empty state -->
            <p
              v-if="!_planModel?.owners?.[0]?.email && !_planModel?.owners?.[0]?.phone && !_planModel?.owners?.[0]?.organization && !_planModel?.owners?.[0]?.location"
              class="text-indigo-400 italic"
            >No additional contact details — add them in the Owner panel (👤 in the toolbar).</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Edit bar — gallery of entry-type thumbnail cards (2026-05-17 redesign) ── -->
    <!-- Tom: "redesign 2 bars, one for visualization of Plan and the other for management
         of plans, with nice color pictures from each app" — each card has a mini SVG
         mirroring the entry type geometry + canonical type colour. -->
    <div class="rounded-xl border border-amber-200 bg-amber-50 shadow-sm px-4 py-3 space-y-2.5">
      <div class="flex items-center justify-between">
        <p class="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Edit in Spec Editor</p>
        <button
          type="button"
          class="flex items-center gap-1 text-amber-400 hover:text-amber-600 transition-colors normal-case tracking-normal font-normal text-[10px]"
          title="About the Edit Glyph — what [*]→[**] means"
          @click="emit('open-edit-info')"
        >
          <EditGlyph size="compact" class="h-2.5 w-auto" aria-hidden="true" />
          <span>?</span>
        </button>
      </div>

      <!-- Full plan — wide primary button -->
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 min-h-[40px] rounded-lg
               bg-amber-600 text-white text-sm font-semibold
               hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400
               transition-colors duration-150"
        title="Open the Spec Editor for this entire plan"
        @click="emit('open-editor', {})"
      ><EditGlyph size="compact" class="h-3.5 w-auto shrink-0" aria-hidden="true" /> Edit Plan (all entries)</button>

      <!-- Entry type thumbnail gallery — horizontal scroll, no pill (short horizontal strip) -->
      <div class="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1" style="scrollbar-width:none;-ms-overflow-style:none;">

        <!-- Functions (green) — process nodes connected by arrows -->
        <button type="button" title="Edit Functions"
          class="flex-shrink-0 flex flex-col rounded-xl border border-green-200 bg-white
                 hover:border-green-400 hover:shadow-md transition-all duration-150 overflow-hidden w-[90px]
                 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-editor', { tab: 'functions' })">
          <div class="w-full h-[44px] flex items-center justify-center bg-green-50/80">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="2"  y="10" width="22" height="24" rx="3.5" fill="#dcfce7" stroke="#16a34a" stroke-width="1.2"/>
              <rect x="29" y="10" width="22" height="24" rx="3.5" fill="#bbf7d0" stroke="#15803d" stroke-width="2"/>
              <rect x="56" y="10" width="22" height="24" rx="3.5" fill="#dcfce7" stroke="#16a34a" stroke-width="1.2"/>
              <line x1="24" y1="22" x2="28" y2="22" stroke="#4ade80" stroke-width="1.5"/>
              <polygon points="26.5,20.2 29.5,22 26.5,23.8" fill="#4ade80"/>
              <line x1="51" y1="22" x2="55" y2="22" stroke="#16a34a" stroke-width="1.5"/>
              <polygon points="53.5,20.2 56.5,22 53.5,23.8" fill="#16a34a"/>
              <text x="4"   y="26" font-size="7" font-family="system-ui,sans-serif" fill="#14532d" font-weight="800">→O</text>
              <text x="31"  y="26" font-size="7" font-family="system-ui,sans-serif" fill="#14532d" font-weight="800">→O</text>
              <text x="63"  y="26" font-size="7" font-family="system-ui,sans-serif" fill="#14532d" font-weight="800">→</text>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-green-800">Functions</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5">What it does</p>
          </div>
        </button>

        <!-- Values (violet) — paired tolerable/goal progress bars, 3 values -->
        <button type="button" title="Edit Values"
          class="flex-shrink-0 flex flex-col rounded-xl border border-violet-200 bg-white
                 hover:border-violet-400 hover:shadow-md transition-all duration-150 overflow-hidden w-[90px]
                 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-editor', { tab: 'values' })">
          <div class="w-full h-[44px] flex items-center justify-center bg-violet-50/80">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="10" y="2"   width="68" height="5"  rx="2.5" fill="#ede9fe"/>
              <rect x="10" y="2"   width="48" height="5"  rx="2.5" fill="#7c3aed" opacity="0.35"/>
              <rect x="10" y="7.5" width="68" height="7"  rx="3.5" fill="#ede9fe"/>
              <rect x="10" y="7.5" width="56" height="7"  rx="3.5" fill="#7c3aed"/>
              <rect x="10" y="18"  width="68" height="4"  rx="2"   fill="#f5f3ff"/>
              <rect x="10" y="18"  width="30" height="4"  rx="2"   fill="#8b5cf6" opacity="0.35"/>
              <rect x="10" y="22.5" width="68" height="7" rx="3.5" fill="#f5f3ff"/>
              <rect x="10" y="22.5" width="38" height="7" rx="3.5" fill="#8b5cf6"/>
              <rect x="10" y="33"  width="68" height="4"  rx="2"   fill="#ede9fe"/>
              <rect x="10" y="33"  width="62" height="4"  rx="2"   fill="#6d28d9" opacity="0.35"/>
              <rect x="10" y="37.5" width="68" height="5" rx="2.5" fill="#ede9fe"/>
              <rect x="10" y="37.5" width="65" height="5" rx="2.5" fill="#6d28d9"/>
              <text x="1" y="9"  font-size="5" fill="#7c3aed" font-weight="700" font-family="system-ui,sans-serif">V1</text>
              <text x="1" y="27" font-size="5" fill="#8b5cf6" font-weight="700" font-family="system-ui,sans-serif">V2</text>
              <text x="1" y="41" font-size="5" fill="#6d28d9" font-weight="700" font-family="system-ui,sans-serif">V3</text>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-violet-800">Values</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5">Targets & scales</p>
          </div>
        </button>

        <!-- Solutions (orange) — stacked impl boxes converging to value node -->
        <button type="button" title="Edit Solutions"
          class="flex-shrink-0 flex flex-col rounded-xl border border-orange-200 bg-white
                 hover:border-orange-400 hover:shadow-md transition-all duration-150 overflow-hidden w-[90px]
                 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-editor', { tab: 'solutions' })">
          <div class="w-full h-[44px] flex items-center justify-center bg-orange-50/80">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="2"  y="4"  width="40" height="10" rx="2.5" fill="#fff7ed" stroke="#ea580c" stroke-width="1.1"/>
              <rect x="2"  y="17" width="40" height="10" rx="2.5" fill="#ffedd5" stroke="#c2410c" stroke-width="1.6"/>
              <rect x="2"  y="30" width="40" height="10" rx="2.5" fill="#fff7ed" stroke="#ea580c" stroke-width="1.1"/>
              <line x1="42" y1="9"   x2="54" y2="22" stroke="#f97316" stroke-width="1.2"/>
              <line x1="42" y1="22"  x2="54" y2="22" stroke="#c2410c" stroke-width="2.2"/>
              <line x1="42" y1="35"  x2="54" y2="22" stroke="#f97316" stroke-width="1.2"/>
              <polygon points="51.5,20.4 55.5,22 51.5,23.6" fill="#c2410c"/>
              <rect x="56" y="15" width="22" height="14" rx="4" fill="#fff7ed" stroke="#ea580c" stroke-width="1.5"/>
              <text x="3.5" y="11.5" font-size="5.5" font-family="system-ui,sans-serif" fill="#9a3412" font-weight="700">S1</text>
              <text x="3.5" y="24.5" font-size="5.5" font-family="system-ui,sans-serif" fill="#c2410c" font-weight="800">S2</text>
              <text x="3.5" y="37.5" font-size="5.5" font-family="system-ui,sans-serif" fill="#9a3412" font-weight="700">S3</text>
              <text x="60"  y="25.5" font-size="8"   font-family="system-ui,sans-serif" fill="#c2410c" font-weight="800">[S]</text>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-orange-800">Solutions</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5">How we deliver</p>
          </div>
        </button>

        <!-- Constraints (red) — dashed boundary with limit lines -->
        <button type="button" title="Edit Constraints"
          class="flex-shrink-0 flex flex-col rounded-xl border border-red-200 bg-white
                 hover:border-red-400 hover:shadow-md transition-all duration-150 overflow-hidden w-[90px]
                 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-editor', { tab: 'constraints' })">
          <div class="w-full h-[44px] flex items-center justify-center bg-red-50/80">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="4" y="3" width="72" height="38" rx="4" fill="#fef2f2" stroke="#dc2626" stroke-width="1.8" stroke-dasharray="4 2.5"/>
              <line x1="30" y1="8"  x2="30" y2="36" stroke="#fca5a5" stroke-width="1"/>
              <line x1="54" y1="8"  x2="54" y2="36" stroke="#fca5a5" stroke-width="1"/>
              <text x="7"  y="26" font-size="9" font-family="system-ui,sans-serif" fill="#dc2626" font-weight="900">C.</text>
              <text x="33" y="22" font-size="5.5" font-family="system-ui,sans-serif" fill="#b91c1c" font-weight="700">≥ min</text>
              <text x="33" y="30" font-size="5"   font-family="system-ui,sans-serif" fill="#ef4444">floor</text>
              <text x="57" y="22" font-size="5.5" font-family="system-ui,sans-serif" fill="#b91c1c" font-weight="700">≤ max</text>
              <text x="57" y="30" font-size="5"   font-family="system-ui,sans-serif" fill="#ef4444">ceiling</text>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-red-800">Constraints</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5">Hard limits</p>
          </div>
        </button>

        <!-- Stakeholders (blue) — three person silhouettes -->
        <button type="button" title="Stakeholders (via Values tab)"
          class="flex-shrink-0 flex flex-col rounded-xl border border-blue-200 bg-white
                 hover:border-blue-400 hover:shadow-md transition-all duration-150 overflow-hidden w-[90px]
                 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-editor', { tab: 'values' })">
          <div class="w-full h-[44px] flex items-center justify-center bg-blue-50/80">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <circle cx="16" cy="11" r="7.5" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1"/>
              <path d="M2,43 C2,27 30,27 30,43" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1" fill-opacity="0.85"/>
              <circle cx="40" cy="11" r="7.5" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5"/>
              <path d="M26,43 C26,27 54,27 54,43" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5" fill-opacity="0.85"/>
              <circle cx="64" cy="11" r="7.5" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1"/>
              <path d="M50,43 C50,27 78,27 78,43" fill="#bfdbfe" stroke="#3b82f6" stroke-width="1" fill-opacity="0.85"/>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-blue-800">Stakeholders</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5">Wish owners</p>
          </div>
        </button>

        <!-- Tasks (slate) — four checkbox rows -->
        <button type="button" title="Go to Task Decomposition"
          class="flex-shrink-0 flex flex-col rounded-xl border border-slate-200 bg-white
                 hover:border-slate-400 hover:shadow-md transition-all duration-150 overflow-hidden w-[90px]
                 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('go-to-tasks')">
          <div class="w-full h-[44px] flex items-center justify-center bg-slate-50/80">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="3"  y="4"  width="9" height="8"  rx="1.5" fill="none" stroke="#64748b" stroke-width="1.2"/>
              <polyline points="5,8 7.5,11 12,5" fill="none" stroke="#475569" stroke-width="1.6"/>
              <rect x="16" y="5.5" width="60" height="5" rx="1.5" fill="#e2e8f0"/>
              <rect x="3"  y="15" width="9" height="8"  rx="1.5" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.2"/>
              <polyline points="5,19 7.5,22 12,16" fill="none" stroke="#334155" stroke-width="1.6"/>
              <rect x="16" y="16.5" width="60" height="5" rx="1.5" fill="#e2e8f0"/>
              <rect x="3"  y="26" width="9" height="8"  rx="1.5" fill="none" stroke="#cbd5e1" stroke-width="1"/>
              <rect x="16" y="27.5" width="44" height="5" rx="1.5" fill="#f1f5f9"/>
              <rect x="3"  y="36" width="9" height="7"  rx="1.5" fill="none" stroke="#cbd5e1" stroke-width="1"/>
              <rect x="16" y="37"  width="36" height="4" rx="1"   fill="#f1f5f9"/>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-slate-700">Tasks</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5">Decomposed work</p>
          </div>
        </button>

      </div>
    </div>

    <!-- ── Visualize Plan bar — gallery of diagram-type thumbnail cards (2026-05-17 redesign) ── -->
    <!-- Tom: "one for visualization of Plan... with nice color pictures from each app" —
         same thumbnail-card pattern as VisualisePanelModal tab gallery. Each card
         mirrors the actual chart geometry in a 80×44 mini SVG. -->
    <div class="rounded-xl border border-indigo-200 bg-indigo-50/50 shadow-sm px-4 py-3 space-y-2.5">
      <p class="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">Visualize Plan</p>
      <!-- Viz type gallery — horizontal scroll, no pill -->
      <div class="flex gap-2.5 overflow-x-auto -mx-1 px-1 pb-1" style="scrollbar-width:none;-ms-overflow-style:none;">

        <!-- Value Flow — opens full-screen ValueFlowPanel directly.
             Tom 2026-05-19: "remove the half screen value flow option and only have the full screen option."
             Previously emitted open-visualise (→ VisualisePanelModal launcher tab).
             Now emits open-value-flow → App.vue sets valueFlowOpen = true directly. -->
        <button type="button" title="Value Flow — causal chain diagram (full screen)"
          class="flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white
                 hover:border-violet-300 hover:shadow-md transition-all duration-150 overflow-hidden w-[108px]
                 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-value-flow')">
          <div class="w-full h-[48px] flex items-center justify-center bg-gray-50">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="1"  y="6"  width="9" height="32" rx="2" fill="#ddd6fe"/>
              <rect x="14" y="10" width="9" height="24" rx="2" fill="#a5b4fc"/>
              <rect x="27" y="14" width="9" height="16" rx="2" fill="#818cf8"/>
              <rect x="40" y="10" width="9" height="24" rx="2" fill="#6366f1"/>
              <rect x="53" y="6"  width="9" height="32" rx="2" fill="#4338ca"/>
              <rect x="66" y="8"  width="9" height="28" rx="2" fill="#3730a3"/>
              <line x1="10" y1="22" x2="13" y2="22" stroke="#a5b4fc" stroke-width="1.2"/>
              <polygon points="11,20.5 14,22 11,23.5" fill="#a5b4fc"/>
              <line x1="23" y1="22" x2="26" y2="22" stroke="#818cf8" stroke-width="1.2"/>
              <polygon points="24,20.5 27,22 24,23.5" fill="#818cf8"/>
              <line x1="36" y1="22" x2="39" y2="22" stroke="#6366f1" stroke-width="1.2"/>
              <polygon points="37,20.5 40,22 37,23.5" fill="#6366f1"/>
              <line x1="49" y1="22" x2="52" y2="22" stroke="#4338ca" stroke-width="1.2"/>
              <polygon points="50,20.5 53,22 50,23.5" fill="#4338ca"/>
              <line x1="62" y1="22" x2="65" y2="22" stroke="#3730a3" stroke-width="1.2"/>
              <polygon points="63,20.5 66,22 63,23.5" fill="#3730a3"/>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-gray-700">Value Flow</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5 line-clamp-2">Tasks→Solutions→Values→Stakeholders</p>
          </div>
        </button>

        <!-- Efficiency -->
        <button type="button" title="Efficiency — Resources → Solutions → Values"
          class="flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white
                 hover:border-violet-300 hover:shadow-md transition-all duration-150 overflow-hidden w-[108px]
                 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-visualise', { tab: 'efficiency' })">
          <div class="w-full h-[48px] flex items-center justify-center bg-gray-50">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="1"  y="4"  width="13" height="10" rx="2" fill="#f0fdf4" stroke="#4ade80" stroke-width="0.8"/>
              <rect x="1"  y="17" width="13" height="10" rx="2" fill="#f0fdf4" stroke="#86efac" stroke-width="0.8"/>
              <rect x="1"  y="30" width="13" height="10" rx="2" fill="#fef2f2" stroke="#fca5a5" stroke-width="0.8"/>
              <rect x="25" y="1"  width="26" height="13" rx="3" fill="#f0fdf4" stroke="#86efac" stroke-width="1.2"/>
              <rect x="25" y="17" width="26" height="12" rx="3" fill="#fffbeb" stroke="#fcd34d" stroke-width="1.2"/>
              <rect x="25" y="32" width="26" height="11" rx="3" fill="#fef2f2" stroke="#fca5a5" stroke-width="1.2"/>
              <rect x="61" y="5"  width="18" height="8"  rx="4" fill="#f5f3ff" stroke="#a78bfa" stroke-width="0.8"/>
              <rect x="61" y="18" width="18" height="8"  rx="4" fill="#f5f3ff" stroke="#a78bfa" stroke-width="0.8"/>
              <rect x="61" y="31" width="18" height="8"  rx="4" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="0.8"/>
              <line x1="14" y1="9"  x2="25" y2="7.5"  stroke="#166534" stroke-width="1.2" stroke-dasharray="2 1.5"/>
              <line x1="14" y1="22" x2="25" y2="23"   stroke="#166534" stroke-width="1.8" stroke-dasharray="2 1.5"/>
              <line x1="14" y1="35" x2="25" y2="37.5" stroke="#166534" stroke-width="0.9" stroke-dasharray="2 1.5"/>
              <path d="M51 7.5 C56 7.5 56 9 61 9"   stroke="#7c3aed" stroke-width="3"   fill="none" opacity="0.85"/>
              <path d="M51 7.5 C56 7.5 56 22 61 22" stroke="#7c3aed" stroke-width="1"   fill="none" opacity="0.5"/>
              <path d="M51 23  C56 23  56 22 61 22" stroke="#7c3aed" stroke-width="4.5" fill="none" opacity="0.9"/>
              <path d="M51 23  C56 23  56 35 61 35" stroke="#7c3aed" stroke-width="1.5" fill="none" opacity="0.55"/>
              <path d="M51 37.5 C56 37.5 56 35 61 35" stroke="#7c3aed" stroke-width="1" fill="none" opacity="0.4"/>
              <text x="26" y="11"  font-size="4.5" fill="#15803d"  font-weight="700" font-family="system-ui">5.1</text>
              <text x="26" y="27"  font-size="4.5" fill="#b45309"  font-weight="700" font-family="system-ui">2.7</text>
              <text x="26" y="41"  font-size="4.5" fill="#b91c1c"  font-weight="700" font-family="system-ui">1.3</text>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-gray-700">⚡ Efficiency</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5 line-clamp-2">Resources → Solutions (V/C) → Values</p>
          </div>
        </button>

        <!-- Radar -->
        <button type="button" title="Radar — solutions on Adopt/Trial/Assess/Hold rings"
          class="flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white
                 hover:border-violet-300 hover:shadow-md transition-all duration-150 overflow-hidden w-[108px]
                 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-visualise', { tab: 'radar' })">
          <div class="w-full h-[48px] flex items-center justify-center bg-gray-50">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <circle cx="40" cy="22" r="18" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
              <circle cx="40" cy="22" r="12" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
              <circle cx="40" cy="22" r="6"  fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
              <line x1="40" y1="22" x2="40"   y2="4"  stroke="#cbd5e1" stroke-width="0.8"/>
              <line x1="40" y1="22" x2="55.6" y2="13" stroke="#cbd5e1" stroke-width="0.8"/>
              <line x1="40" y1="22" x2="55.6" y2="31" stroke="#cbd5e1" stroke-width="0.8"/>
              <line x1="40" y1="22" x2="40"   y2="40" stroke="#cbd5e1" stroke-width="0.8"/>
              <line x1="40" y1="22" x2="24.4" y2="31" stroke="#cbd5e1" stroke-width="0.8"/>
              <line x1="40" y1="22" x2="24.4" y2="13" stroke="#cbd5e1" stroke-width="0.8"/>
              <polygon points="40,9 52,14 53,32 40,38 26,30 29,12" fill="#6366f1" fill-opacity="0.25" stroke="#6366f1" stroke-width="1.5"/>
              <circle cx="40"  cy="9"  r="2" fill="#6366f1"/>
              <circle cx="52"  cy="14" r="2" fill="#6366f1"/>
              <circle cx="53"  cy="32" r="2" fill="#6366f1"/>
              <circle cx="40"  cy="38" r="2" fill="#6366f1"/>
              <circle cx="26"  cy="30" r="2" fill="#6366f1"/>
              <circle cx="29"  cy="12" r="2" fill="#6366f1"/>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-gray-700">Radar</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5 line-clamp-2">Solutions on Adopt / Trial rings</p>
          </div>
        </button>

        <!-- Architecture -->
        <button type="button" title="Architecture — TOGAF layers"
          class="flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white
                 hover:border-violet-300 hover:shadow-md transition-all duration-150 overflow-hidden w-[108px]
                 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-visualise', { tab: 'arch' })">
          <div class="w-full h-[48px] flex items-center justify-center bg-gray-50">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="2" y="2"  width="76" height="9" rx="2" fill="#fde68a"/>
              <rect x="2" y="13" width="76" height="9" rx="2" fill="#bbf7d0"/>
              <rect x="2" y="24" width="76" height="9" rx="2" fill="#bfdbfe"/>
              <rect x="2" y="35" width="76" height="8" rx="2" fill="#e9d5ff"/>
              <text x="6" y="9"  font-size="5" font-family="system-ui,sans-serif" fill="#92400e" font-weight="600">Business</text>
              <text x="6" y="20" font-size="5" font-family="system-ui,sans-serif" fill="#065f46" font-weight="600">Application</text>
              <text x="6" y="31" font-size="5" font-family="system-ui,sans-serif" fill="#1e40af" font-weight="600">Data</text>
              <text x="6" y="41" font-size="5" font-family="system-ui,sans-serif" fill="#6b21a8" font-weight="600">Technology</text>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-gray-700">Architecture</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5 line-clamp-2">Business / App / Data layers</p>
          </div>
        </button>

        <!-- Dependencies -->
        <button type="button" title="Dependencies — Values · Functions · Solutions with cross-links"
          class="flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white
                 hover:border-violet-300 hover:shadow-md transition-all duration-150 overflow-hidden w-[108px]
                 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-visualise', { tab: 'deps' })">
          <div class="w-full h-[48px] flex items-center justify-center bg-gray-50">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="1"  y="4"  width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
              <rect x="1"  y="14" width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
              <rect x="1"  y="24" width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
              <rect x="1"  y="34" width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
              <rect x="30" y="4"  width="19" height="8" rx="2" fill="#fffbeb" stroke="#fcd34d" stroke-width="0.8"/>
              <rect x="30" y="14" width="19" height="8" rx="2" fill="#fffbeb" stroke="#fcd34d" stroke-width="0.8"/>
              <rect x="30" y="24" width="19" height="8" rx="2" fill="#fffbeb" stroke="#fcd34d" stroke-width="0.8"/>
              <rect x="60" y="4"  width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
              <rect x="60" y="14" width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
              <rect x="60" y="24" width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
              <rect x="60" y="34" width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
              <line x1="20" y1="8"  x2="30" y2="8"  stroke="#c7d2fe" stroke-width="0.8"/>
              <line x1="20" y1="18" x2="30" y2="18" stroke="#c7d2fe" stroke-width="0.8"/>
              <line x1="20" y1="28" x2="30" y2="28" stroke="#c7d2fe" stroke-width="0.8"/>
              <line x1="49" y1="8"  x2="60" y2="8"  stroke="#a7f3d0" stroke-width="0.8"/>
              <line x1="49" y1="18" x2="60" y2="18" stroke="#a7f3d0" stroke-width="0.8"/>
              <line x1="49" y1="28" x2="60" y2="28" stroke="#a7f3d0" stroke-width="0.8"/>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-gray-700">Dependencies</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5 line-clamp-2">V · F · S cross-links</p>
          </div>
        </button>

        <!-- Risk Matrix -->
        <button type="button" title="Risk Matrix — functions by probability × impact"
          class="flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white
                 hover:border-violet-300 hover:shadow-md transition-all duration-150 overflow-hidden w-[108px]
                 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-visualise', { tab: 'risk' })">
          <div class="w-full h-[48px] flex items-center justify-center bg-gray-50">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="14" y="2"  width="19" height="12" rx="2" fill="#d1fae5"/>
              <rect x="35" y="2"  width="19" height="12" rx="2" fill="#fef3c7"/>
              <rect x="56" y="2"  width="19" height="12" rx="2" fill="#fed7aa"/>
              <rect x="14" y="16" width="19" height="12" rx="2" fill="#fef3c7"/>
              <rect x="35" y="16" width="19" height="12" rx="2" fill="#fed7aa"/>
              <rect x="56" y="16" width="19" height="12" rx="2" fill="#fecaca"/>
              <rect x="14" y="30" width="19" height="12" rx="2" fill="#fed7aa"/>
              <rect x="35" y="30" width="19" height="12" rx="2" fill="#fecaca"/>
              <rect x="56" y="30" width="19" height="12" rx="2" fill="#f87171"/>
              <text x="0" y="10"  font-size="4" font-family="system-ui,sans-serif" fill="#059669" font-weight="600">Lo↕</text>
              <text x="0" y="24"  font-size="4" font-family="system-ui,sans-serif" fill="#d97706" font-weight="600">Md</text>
              <text x="0" y="38"  font-size="4" font-family="system-ui,sans-serif" fill="#dc2626" font-weight="600">Hi</text>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-gray-700">Risk Matrix</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5 line-clamp-2">Functions by prob × impact</p>
          </div>
        </button>

        <!-- Finance -->
        <button type="button" title="Finance — value targets: tolerable vs goal"
          class="flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white
                 hover:border-violet-300 hover:shadow-md transition-all duration-150 overflow-hidden w-[108px]
                 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-visualise', { tab: 'finance' })">
          <div class="w-full h-[48px] flex items-center justify-center bg-gray-50">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <rect x="12" y="2"  width="64" height="4" rx="2" fill="#e0e7ff"/>
              <rect x="12" y="2"  width="44" height="4" rx="2" fill="#6366f1" opacity="0.4"/>
              <rect x="12" y="7"  width="64" height="6" rx="3" fill="#e0e7ff"/>
              <rect x="12" y="7"  width="50" height="6" rx="3" fill="#6366f1"/>
              <rect x="12" y="18" width="64" height="4" rx="2" fill="#fce7f3"/>
              <rect x="12" y="18" width="30" height="4" rx="2" fill="#ec4899" opacity="0.4"/>
              <rect x="12" y="23" width="64" height="6" rx="3" fill="#fce7f3"/>
              <rect x="12" y="23" width="36" height="6" rx="3" fill="#ec4899"/>
              <rect x="12" y="34" width="64" height="4" rx="2" fill="#fef3c7"/>
              <rect x="12" y="34" width="52" height="4" rx="2" fill="#f59e0b" opacity="0.4"/>
              <rect x="12" y="39" width="64" height="4" rx="2" fill="#fef3c7"/>
              <rect x="12" y="39" width="56" height="4" rx="2" fill="#f59e0b"/>
              <text x="0" y="8"  font-size="4.5" font-family="system-ui,sans-serif" fill="#6366f1" font-weight="600">V1</text>
              <text x="0" y="27" font-size="4.5" font-family="system-ui,sans-serif" fill="#ec4899" font-weight="600">V2</text>
              <text x="0" y="42" font-size="4.5" font-family="system-ui,sans-serif" fill="#f59e0b" font-weight="600">V3</text>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-gray-700">Finance</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5 line-clamp-2">Tolerable vs goal targets</p>
          </div>
        </button>

        <!-- Swimlane -->
        <button type="button" title="Swimlane — Evo steps × spec entries heat map"
          class="flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white
                 hover:border-violet-300 hover:shadow-md transition-all duration-150 overflow-hidden w-[108px]
                 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 cursor-pointer"
          @click="emit('open-visualise', { tab: 'swimlane' })">
          <div class="w-full h-[48px] flex items-center justify-center bg-gray-50">
            <svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block" aria-hidden="true">
              <text x="1" y="9"  font-size="4" font-family="system-ui,sans-serif" fill="#92400e">S1</text>
              <text x="1" y="20" font-size="4" font-family="system-ui,sans-serif" fill="#065f46">S2</text>
              <text x="1" y="31" font-size="4" font-family="system-ui,sans-serif" fill="#1e40af">S3</text>
              <text x="1" y="42" font-size="4" font-family="system-ui,sans-serif" fill="#6b21a8">S4</text>
              <rect x="12" y="2"  width="15" height="10" rx="1.5" fill="#fde68a"/>
              <rect x="29" y="2"  width="15" height="10" rx="1.5" fill="#fcd34d"/>
              <rect x="46" y="2"  width="15" height="10" rx="1.5" fill="#f59e0b"/>
              <rect x="63" y="2"  width="15" height="10" rx="1.5" fill="#fde68a" opacity="0.5"/>
              <rect x="12" y="14" width="15" height="10" rx="1.5" fill="#bbf7d0"/>
              <rect x="29" y="14" width="15" height="10" rx="1.5" fill="#6ee7b7"/>
              <rect x="46" y="14" width="15" height="10" rx="1.5" fill="#34d399"/>
              <rect x="63" y="14" width="15" height="10" rx="1.5" fill="#6ee7b7"/>
              <rect x="12" y="26" width="15" height="10" rx="1.5" fill="#bfdbfe"/>
              <rect x="29" y="26" width="15" height="10" rx="1.5" fill="#93c5fd"/>
              <rect x="46" y="26" width="15" height="10" rx="1.5" fill="#60a5fa"/>
              <rect x="63" y="26" width="15" height="10" rx="1.5" fill="#93c5fd"/>
              <rect x="12" y="38" width="15" height="6"  rx="1.5" fill="#e9d5ff"/>
              <rect x="29" y="38" width="15" height="6"  rx="1.5" fill="#d8b4fe"/>
              <rect x="46" y="38" width="15" height="6"  rx="1.5" fill="#c084fc"/>
              <rect x="63" y="38" width="15" height="6"  rx="1.5" fill="#d8b4fe"/>
            </svg>
          </div>
          <div class="px-2 pt-1.5 pb-2 text-left">
            <p class="text-[11px] font-bold leading-tight truncate text-gray-700">Swimlane</p>
            <p class="text-[9px] text-gray-400 leading-snug mt-0.5 line-clamp-2">Evo steps × entries heat map</p>
          </div>
        </button>

      </div>
    </div>

    <!-- ── Quality Check strip — Feature #200 ── -->
    <div class="rounded-xl border border-teal-200 bg-teal-50 shadow-sm px-4 py-3 space-y-2">
      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-bold text-teal-800 uppercase tracking-wide">🔍 Spec Quality Check</p>
          <p v-if="qcLastRunAt" class="text-[10px] text-teal-600 mt-0.5">
            Last run {{ qcLastRunLabel }} · {{ _ann.value.totalAnnotations.value }} issue{{ _ann.value.totalAnnotations.value !== 1 ? 's' : '' }} found
            <span class="font-semibold ml-1">· Health {{ qcHealthScore }}%</span>
            <span
              v-if="qcDelta !== null"
              class="ml-1 font-bold"
              :class="qcDelta < 0 ? 'text-red-500' : qcDelta > 0 ? 'text-emerald-600' : 'text-teal-500'"
            >{{ qcDelta > 0 ? '+' : '' }}{{ qcDelta }}%</span>
          </p>
          <p v-else class="text-[10px] text-teal-500 mt-0.5">
            AI detects missing fields, ambiguous or misleading descriptions, and conflicts — within this spec and across all your saved plans
          </p>
          <p v-if="qcError" class="text-[10px] text-red-600 mt-0.5">⚠ {{ qcError }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            v-if="_ann.hasAnyAnnotation.value"
            type="button"
            class="text-[10px] text-red-400 hover:text-red-600 transition-colors"
            title="Clear all quality flags"
            @click="_ann.clearAll()"
          >Clear all</button>
          <button
            type="button"
            :disabled="qcLoading"
            class="relative overflow-hidden px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
            :class="qcLoading
              ? 'bg-teal-600 text-white cursor-wait animate-pulse ring-2 ring-teal-300 ring-offset-1'
              : 'bg-teal-600 text-white hover:bg-teal-700'"
            :title="qcLoading ? `Checking — ${Math.round(qcProgress)}% (synthetic estimate)` : 'Run AI spec quality check'"
            @click="runQualityCheck()"
          >
            <!-- Progress fill — only while checking. Sits behind the label, fills L→R. -->
            <span
              v-if="qcLoading"
              class="absolute inset-y-0 left-0 bg-white/25 transition-[width] duration-300 ease-out pointer-events-none"
              :style="{ width: `${Math.round(qcProgress)}%` }"
              aria-hidden="true"
            ></span>
            <span class="relative">
              {{ qcLoading ? `⏳ Checking… ${Math.round(qcProgress)}%` : '🔍 Run Check' }}
            </span>
          </button>
        </div>
      </div>

      <!-- Annotation summary counts — shown after any check has run -->
      <div v-if="qcLastRunAt" class="flex flex-wrap gap-1.5 pt-0.5">
        <span
          v-for="(opt) in FLAG_OPTS"
          :key="opt.type"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-opacity"
          :class="[
            ANN_CONFIG[opt.type].badgeCls,
            _ann.value.annotationCounts.value[opt.type] === 0 ? 'opacity-35' : ''
          ]"
        >{{ opt.label }} {{ _ann.value.annotationCounts.value[opt.type] }}</span>
      </div>
    </div>

    <!-- ── Copy bar — immediately visible, no scrolling needed ── -->
    <div class="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 space-y-2">
      <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Copy to clipboard</p>

      <!-- Full plan -->
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 min-h-[40px] rounded-lg
               bg-slate-800 text-white text-sm font-semibold
               hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500
               transition-colors duration-150"
        @click="copyFullPlan"
      >
        📋 {{ copiedSection === 'plan' ? '✓ Copied!' : 'Copy Plan (full)' }}
      </button>

      <!-- Section buttons -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          class="flex items-center justify-center min-h-[36px] rounded-lg border border-blue-200
                 bg-blue-50 text-blue-800 text-xs font-semibold
                 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
          @click="copyRich('functions', buildFunctionsHTML(), buildFunctionsTSV())"
        >{{ copiedSection === 'functions' ? '✓ Copied!' : '📘 Functions' }}</button>

        <button
          type="button"
          class="flex items-center justify-center min-h-[36px] rounded-lg border border-emerald-200
                 bg-emerald-50 text-emerald-800 text-xs font-semibold
                 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors"
          @click="copyRich('values', buildValuesHTML(), buildValuesTSV())"
        >{{ copiedSection === 'values' ? '✓ Copied!' : '📗 Values' }}</button>

        <button
          type="button"
          class="flex items-center justify-center min-h-[36px] rounded-lg border border-violet-200
                 bg-violet-50 text-violet-800 text-xs font-semibold
                 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors"
          @click="copyRich('solutions', buildSolutionsHTML(), buildSolutionsTSV())"
        >{{ copiedSection === 'solutions' ? '✓ Copied!' : '📙 Solutions' }}</button>

        <button
          type="button"
          :disabled="!evoSteps.length"
          class="flex items-center justify-center min-h-[36px] rounded-lg border border-indigo-200
                 bg-indigo-50 text-indigo-800 text-xs font-semibold
                 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400
                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          @click="copyRich('evo', buildEvoStepsHTML(), buildEvoStepsTSV())"
        >{{ copiedSection === 'evo' ? '✓ Copied!' : '📊 Evo Steps' }}</button>

        <button
          type="button"
          :disabled="!detectedStakeholders.length"
          class="flex items-center justify-center min-h-[36px] rounded-lg border border-amber-200
                 bg-amber-50 text-amber-800 text-xs font-semibold
                 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400
                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :title="detectedStakeholders.length ? 'Copy stakeholder × value impact matrix' : 'No stakeholders detected in this spec'"
          @click="copyRich('stakeholders', buildStakeholdersHTML(), buildStakeholdersTSV())"
        >{{ copiedSection === 'stakeholders' ? '✓ Copied!' : '👥 Stakeholders' }}</button>

        <button
          type="button"
          :disabled="!evoSteps.length"
          class="flex items-center justify-center min-h-[36px] rounded-lg border border-slate-300
                 bg-slate-50 text-slate-800 text-xs font-semibold
                 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400
                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :title="evoSteps.length ? 'Copy task list grouped by Evo Step' : 'No Evo Steps — tasks require a plan'"
          @click="copyRich('tasks', buildTasksHTML(), buildTasksTSV())"
        >{{ copiedSection === 'tasks' ? '✓ Copied!' : '☑ Tasks' }}</button>

      </div>
    </div>

    <!-- ── 1. Original Input ── -->
    <section
      v-if="originalInput"
      class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      aria-label="Original input"
    >
      <div class="bg-gray-800 px-5 py-3">
        <h2 class="text-sm font-semibold text-white tracking-wide uppercase">Original Input</h2>
      </div>
      <div class="divide-y divide-gray-100">
        <div class="px-5 py-4 grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3">
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">Stakes</span>
          <p class="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{{ originalInput.stakes }}</p>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">Ends</span>
          <p class="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{{ originalInput.ends }}</p>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">Means</span>
          <p class="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{{ originalInput.means }}</p>
        </div>
      </div>
    </section>

    <!-- ── 2. Spec cards ── -->
    <section class="space-y-4" aria-label="Planguage spec">
      <div class="flex flex-wrap items-center gap-2 px-1">
        <h2 class="text-base font-semibold text-gray-800">Spec</h2>
        <!-- Sharpening summary pill — total changes + timestamp -->
        <span
          v-if="sharpenSummary && sharpenSummary.totalChanges > 0"
          class="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5"
          aria-label="Sharpening applied"
        >
          <span aria-hidden="true">✂️</span>
          {{ sharpenSummary.totalChanges }} change{{ sharpenSummary.totalChanges === 1 ? '' : 's' }} sharpened
          <span v-if="sharpenSummary.at" class="text-amber-500 font-normal">
            · {{ new Date(sharpenSummary.at).toLocaleString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}
          </span>
        </span>
        <!-- See Change Detail toggle button -->
        <button
          v-if="sharpenSummary && sharpenSummary.totalChanges > 0 && sharpenRounds?.length"
          type="button"
          class="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 underline underline-offset-2 decoration-amber-300 hover:decoration-amber-500 transition-colors"
          :aria-expanded="showChangeDetail"
          aria-controls="sharpen-detail-panel"
          @click="showChangeDetail = !showChangeDetail"
        >
          {{ showChangeDetail ? 'Hide detail' : 'See change detail' }}
          <svg
            class="w-3 h-3 transition-transform duration-200"
            :class="showChangeDetail ? 'rotate-180' : ''"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <!-- Expandable sharpening diff panel -->
      <div
        v-if="showChangeDetail && sharpenRounds?.length"
        id="sharpen-detail-panel"
        class="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden divide-y divide-amber-100"
      >
        <SharpenDiffList :rounds="sharpenRounds" />
      </div>

      <!-- F. group header + copy + edit -->
      <div class="flex items-center justify-between px-1 pt-1">
        <span class="text-xs font-bold text-green-600 uppercase tracking-wide">Functions</span>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            title="Open Spec Editor — Functions tab"
            @click="emit('open-editor', { tab: 'functions' })"
          ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /> Edit</button>
          <button
            type="button"
            class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
            @click="copyRich('functions', buildFunctionsHTML(), buildFunctionsTSV())"
          >{{ copiedSection === 'functions' ? '✓ Copied!' : '📋 Copy' }}</button>
        </div>
      </div>

      <!-- F. entries — green -->
      <div
        v-for="f in spec.functions"
        :key="f.id"
        class="bg-white rounded-xl border shadow-sm"
        :class="[
          !annOf(f.id)                              && 'border-green-100',
          annOf(f.id)?.type === 'missing'           && 'border-dashed border-orange-300',
          annOf(f.id)?.type === 'ambiguous'         && 'border-amber-300',
          annOf(f.id)?.type === 'misleading'        && 'border-red-300',
          annOf(f.id)?.type === 'conflicting'       && 'border-purple-300',
        ]"
      >
        <div class="bg-green-600 px-4 py-2.5 flex items-center gap-2 rounded-t-xl">
          <span class="text-xs font-bold text-green-100 bg-green-700 rounded px-1.5 py-0.5">F.</span>
          <span class="text-sm font-semibold text-white truncate">{{ f.id }}</span>
          <!-- Annotation badge -->
          <span
            v-if="annOf(f.id)"
            class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none"
            :class="ANN_CONFIG[annOf(f.id)!.type].badgeCls"
          >{{ ANN_CONFIG[annOf(f.id)!.type].badge }}</span>
          <!-- Priority indicator chip — "Prioritized due to {reason}" — shown only when a priority record exists -->
          <span
            v-if="priorityOf(f.id)"
            class="shrink min-w-0 inline-flex items-center gap-1 text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded-full bg-amber-300/95 text-amber-900 border border-amber-200 max-w-[260px] truncate"
            :title="`Prioritized due to: ${priorityReason(f.id) || '(see priority record)'}`"
          >
            <svg viewBox="0 0 24 24" class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="M7 21h10"/><path d="M3 14l3-6 3 6"/><path d="M15 14l3-6 3 6"/><path d="M3 14a3 3 0 0 0 6 0"/><path d="M15 14a3 3 0 0 0 6 0"/><path d="M5 8l7-3 7 3"/></svg>
            <span class="truncate">Prioritized<template v-if="priorityReason(f.id)"> · {{ priorityReason(f.id) }}</template></span>
          </span>
          <!-- Per-entry action buttons (edit + priority + flag) -->
          <div class="ml-auto shrink-0 flex items-center gap-1">
            <button
              type="button"
              class="h-6 px-2 rounded text-[10px] font-semibold
                     bg-white/15 text-white hover:bg-amber-400/80 hover:text-amber-900
                     transition-colors focus:outline-none focus:ring-1 focus:ring-white/60"
              :title="`Edit ${f.id} in Spec Editor`"
              :aria-label="`Edit function ${f.id}`"
              @click="emit('open-editor', { tab: 'functions', entryId: f.id })"
            >✏</button>
            <!-- Priority decision — split-button (DD-002 2026-05-14): glyph half
                 opens "About the Priority Glyph" info modal, action half opens
                 the Priority Record panel. Hover the glyph for a ? hint. -->
            <PriorityActionButton
              label="Edit Priority"
              chrome-class="bg-white/15 text-white"
              rounded-class="rounded"
              height-class="h-6"
              text-size-class="text-[10px]"
              glyph-size-class="h-3.5"
              :action-title="`Record priority decision for ${f.id}`"
              :action-aria-label="`Priority for ${f.id}`"
              @action="emit('open-priority', { entryId: f.id, entryType: 'F', description: f.description })"
              @info="emit('open-priority-info')"
            />
            <button
              type="button"
              class="h-6 px-2 rounded text-[10px] font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-white/60"
              :class="annOf(f.id) ? ANN_CONFIG[annOf(f.id)!.type].flagCls : 'bg-white/15 text-white hover:bg-white/25'"
              :title="annOf(f.id) ? `Flagged: ${ANN_CONFIG[annOf(f.id)!.type].badge} — click to change` : `Flag quality issue for ${f.id}`"
              :aria-label="`Quality flag for ${f.id}`"
              @click="openFlag(f.id)"
            >🚩</button>
          </div>
          <!-- Sharpening badge: ✂️ + category labels -->
          <span
            v-if="sharpenedEntryIds?.includes(f.id)"
            class="flex items-center gap-1 flex-shrink-0"
            aria-label="Sharpened entry"
          >
            <span
              v-for="cat in (entryCategories.get(f.id) ?? [])"
              :key="cat.label"
              class="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-white/20 text-white rounded px-1.5 py-0.5 leading-none whitespace-nowrap"
              :title="`Sharpened by ${cat.label}`"
            >
              <span aria-hidden="true">{{ cat.emoji }}</span>
              {{ cat.label }}
            </span>
            <span v-if="!entryCategories.get(f.id)?.length" class="text-sm leading-none">✂️</span>
          </span>
        </div>
        <div class="px-4 py-3 space-y-2">
          <p :class="[
            'text-sm',
            !annOf(f.id)                              && 'text-gray-800',
            annOf(f.id)?.type === 'missing'           && 'text-gray-400 italic',
            annOf(f.id)?.type === 'ambiguous'         && 'text-gray-800 underline decoration-dashed decoration-amber-500 underline-offset-2',
            annOf(f.id)?.type === 'misleading'        && 'font-bold text-red-700',
            annOf(f.id)?.type === 'conflicting'       && 'text-gray-800 italic',
          ]">{{ f.description }}</p>
          <!-- Conflict refs row -->
          <div v-if="annOf(f.id)?.type === 'conflicting' && annOf(f.id)!.conflictsWith.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="(ref, i) in annOf(f.id)!.conflictsWith"
              :key="i"
              class="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5"
            >
              {{ ref.scope === 'same-spec' ? ref.entryId ?? 'same spec' : ref.specName ?? 'other spec' }} — {{ ref.description.slice(0, 60) }}{{ ref.description.length > 60 ? '…' : '' }}
            </span>
          </div>
          <!-- Annotation note -->
          <p v-if="annOf(f.id)?.note" class="text-[10px] text-gray-500 italic border-l-2 pl-2"
            :class="{
              'border-orange-300': annOf(f.id)?.type === 'missing',
              'border-amber-300': annOf(f.id)?.type === 'ambiguous',
              'border-red-300': annOf(f.id)?.type === 'misleading',
              'border-purple-300': annOf(f.id)?.type === 'conflicting',
            }"
          >{{ annOf(f.id)!.note }}</p>
          <p v-if="f.successCriteria" class="text-xs text-gray-500 border-l-2 border-blue-200 pl-3">
            <span class="font-semibold">Success:</span> {{ f.successCriteria }}
          </p>
        </div>
        <!-- Inline flag form -->
        <div
          v-show="openFlagId === f.id"
          class="border-t border-blue-100 bg-blue-50/50 px-4 py-3 space-y-2.5 rounded-b-xl"
        >
          <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Flag this entry as:</p>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="opt in FLAG_OPTS"
              :key="opt.type"
              type="button"
              class="px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors text-left"
              :class="flagType === opt.type ? ANN_CONFIG[opt.type].activeCls : ANN_CONFIG[opt.type].inactiveCls"
              @click="flagType = opt.type"
            >{{ opt.label }}</button>
          </div>
          <div class="space-y-1">
            <label class="block text-[10px] text-gray-500">Reason / note:</label>
            <input v-model="flagNote" type="text" placeholder="Brief explanation…"
              class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          </div>
          <div v-if="flagType === 'conflicting'" class="space-y-1">
            <label class="block text-[10px] text-gray-500">Conflicts with (entry IDs or plan names):</label>
            <input v-model="flagConflict" type="text" placeholder="e.g. F.DataMinimisation, Patient Privacy Plan"
              class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          </div>
          <div class="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              :disabled="!flagType"
              class="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
              @click="applyFlag(f.id, 'F')"
            >Set Flag</button>
            <button
              v-if="annOf(f.id)"
              type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
              @click="clearFlag(f.id)"
            >Clear</button>
            <button
              type="button"
              class="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
              @click="openFlagId = null"
            >Cancel</button>
          </div>
        </div>
      </div>

      <!-- V. group header + copy + edit -->
      <div class="flex items-center justify-between px-1 pt-2">
        <span class="text-xs font-bold text-violet-600 uppercase tracking-wide">Values</span>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            title="Open Spec Editor — Values tab"
            @click="emit('open-editor', { tab: 'values' })"
          ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /> Edit</button>
          <button
            type="button"
            class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
            @click="copyRich('values', buildValuesHTML(), buildValuesTSV())"
          >{{ copiedSection === 'values' ? '✓ Copied!' : '📋 Copy' }}</button>
        </div>
      </div>

      <!-- V. entries — violet -->
      <div
        v-for="v in spec.values"
        :key="v.id"
        class="bg-white rounded-xl border shadow-sm"
        :class="[
          !annOf(v.id)                              && 'border-violet-100',
          annOf(v.id)?.type === 'missing'           && 'border-dashed border-orange-300',
          annOf(v.id)?.type === 'ambiguous'         && 'border-amber-300',
          annOf(v.id)?.type === 'misleading'        && 'border-red-300',
          annOf(v.id)?.type === 'conflicting'       && 'border-purple-300',
        ]"
      >
        <div class="bg-violet-600 px-4 py-2.5 flex items-center gap-2 rounded-t-xl">
          <span class="text-xs font-bold text-violet-100 bg-violet-700 rounded px-1.5 py-0.5">V.</span>
          <span class="text-sm font-semibold text-white truncate">{{ v.id }}</span>
          <!-- Annotation badge -->
          <span
            v-if="annOf(v.id)"
            class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none"
            :class="ANN_CONFIG[annOf(v.id)!.type].badgeCls"
          >{{ ANN_CONFIG[annOf(v.id)!.type].badge }}</span>
          <!-- Priority indicator chip — "Prioritized due to {reason}" — shown only when a priority record exists -->
          <span
            v-if="priorityOf(v.id)"
            class="shrink min-w-0 inline-flex items-center gap-1 text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded-full bg-amber-300/95 text-amber-900 border border-amber-200 max-w-[260px] truncate"
            :title="`Prioritized due to: ${priorityReason(v.id) || '(see priority record)'}`"
          >
            <svg viewBox="0 0 24 24" class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="M7 21h10"/><path d="M3 14l3-6 3 6"/><path d="M15 14l3-6 3 6"/><path d="M3 14a3 3 0 0 0 6 0"/><path d="M15 14a3 3 0 0 0 6 0"/><path d="M5 8l7-3 7 3"/></svg>
            <span class="truncate">Prioritized<template v-if="priorityReason(v.id)"> · {{ priorityReason(v.id) }}</template></span>
          </span>
          <!-- Per-entry action buttons (edit + priority + flag) -->
          <div class="ml-auto shrink-0 flex items-center gap-1">
            <button
              type="button"
              class="h-6 px-2 rounded text-[10px] font-semibold
                     bg-white/15 text-white hover:bg-amber-400/80 hover:text-amber-900
                     transition-colors focus:outline-none focus:ring-1 focus:ring-white/60"
              :title="`Edit ${v.id} in Spec Editor`"
              :aria-label="`Edit value ${v.id}`"
              @click="emit('open-editor', { tab: 'values', entryId: v.id })"
            >✏</button>
            <!-- Priority decision — split-button (DD-002 2026-05-14). -->
            <PriorityActionButton
              label="Edit Priority"
              chrome-class="bg-white/15 text-white"
              rounded-class="rounded"
              height-class="h-6"
              text-size-class="text-[10px]"
              glyph-size-class="h-3.5"
              :action-title="`Record priority decision for ${v.id}`"
              :action-aria-label="`Priority for ${v.id}`"
              @action="emit('open-priority', { entryId: v.id, entryType: 'V', description: v.description })"
              @info="emit('open-priority-info')"
            />
            <button
              type="button"
              class="h-6 px-2 rounded text-[10px] font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-white/60"
              :class="annOf(v.id) ? ANN_CONFIG[annOf(v.id)!.type].flagCls : 'bg-white/15 text-white hover:bg-white/25'"
              :title="annOf(v.id) ? `Flagged: ${ANN_CONFIG[annOf(v.id)!.type].badge} — click to change` : `Flag quality issue for ${v.id}`"
              :aria-label="`Quality flag for ${v.id}`"
              @click="openFlag(v.id)"
            >🚩</button>
          </div>
          <!-- Sharpening badge: ✂️ + category labels -->
          <span
            v-if="sharpenedEntryIds?.includes(v.id)"
            class="flex items-center gap-1 flex-shrink-0"
            aria-label="Sharpened entry"
          >
            <span
              v-for="cat in (entryCategories.get(v.id) ?? [])"
              :key="cat.label"
              class="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-white/20 text-white rounded px-1.5 py-0.5 leading-none whitespace-nowrap"
              :title="`Sharpened by ${cat.label}`"
            >
              <span aria-hidden="true">{{ cat.emoji }}</span>
              {{ cat.label }}
            </span>
            <span v-if="!entryCategories.get(v.id)?.length" class="text-sm leading-none">✂️</span>
          </span>
        </div>
        <div class="px-4 py-3 space-y-2">
          <p :class="[
            'text-sm',
            !annOf(v.id)                              && 'text-gray-800',
            annOf(v.id)?.type === 'missing'           && 'text-gray-400 italic',
            annOf(v.id)?.type === 'ambiguous'         && 'text-gray-800 underline decoration-dashed decoration-amber-500 underline-offset-2',
            annOf(v.id)?.type === 'misleading'        && 'font-bold text-red-700',
            annOf(v.id)?.type === 'conflicting'       && 'text-gray-800 italic',
          ]">{{ v.description }}</p>
          <!-- Conflict refs row -->
          <div v-if="annOf(v.id)?.type === 'conflicting' && annOf(v.id)!.conflictsWith.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="(ref, i) in annOf(v.id)!.conflictsWith"
              :key="i"
              class="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5"
            >
              {{ ref.scope === 'same-spec' ? ref.entryId ?? 'same spec' : ref.specName ?? 'other spec' }} — {{ ref.description.slice(0, 60) }}{{ ref.description.length > 60 ? '…' : '' }}
            </span>
          </div>
          <!-- Annotation note -->
          <p v-if="annOf(v.id)?.note" class="text-[10px] text-gray-500 italic border-l-2 pl-2"
            :class="{
              'border-orange-300': annOf(v.id)?.type === 'missing',
              'border-amber-300': annOf(v.id)?.type === 'ambiguous',
              'border-red-300': annOf(v.id)?.type === 'misleading',
              'border-purple-300': annOf(v.id)?.type === 'conflicting',
            }"
          >{{ annOf(v.id)!.note }}</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
            <div><span class="font-semibold text-gray-700">Scale: </span>{{ v.scale }}</div>
            <div><span class="font-semibold text-gray-700">Meter: </span>{{ v.meter }}</div>
          </div>
          <div class="flex flex-wrap gap-2 pt-1">
            <span
              v-if="v.status"
              class="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs text-amber-700"
            >
              <span class="font-semibold">Now</span> {{ v.status.replace(/^Status\s*/i, '') }}
            </span>
            <span
              v-if="v.tolerable"
              class="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs text-blue-700"
            >
              <span class="font-semibold">Min</span> {{ v.tolerable.replace(/^Tolerable\s*/i, '') }}
            </span>
            <span
              v-if="v.goal"
              class="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs text-green-700"
            >
              <span class="font-semibold">Goal</span> {{ v.goal.replace(/^Goal\s*/i, '') }}
            </span>
          </div>
        </div>
        <!-- V. inline flag form -->
        <div v-show="openFlagId === v.id" class="border-t border-green-100 bg-green-50/50 px-4 py-3 space-y-2.5 rounded-b-xl">
          <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Flag this entry as:</p>
          <div class="grid grid-cols-2 gap-1.5">
            <button v-for="opt in FLAG_OPTS" :key="opt.type" type="button"
              class="px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors text-left"
              :class="flagType === opt.type ? ANN_CONFIG[opt.type].activeCls : ANN_CONFIG[opt.type].inactiveCls"
              @click="flagType = opt.type">{{ opt.label }}</button>
          </div>
          <div class="space-y-1">
            <label class="block text-[10px] text-gray-500">Reason / note:</label>
            <input v-model="flagNote" type="text" placeholder="Brief explanation…"
              class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          </div>
          <div v-if="flagType === 'conflicting'" class="space-y-1">
            <label class="block text-[10px] text-gray-500">Conflicts with (entry IDs or plan names):</label>
            <input v-model="flagConflict" type="text" placeholder="e.g. F.DataMinimisation, Patient Privacy Plan"
              class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          </div>
          <div class="flex items-center gap-2 pt-0.5">
            <button type="button" :disabled="!flagType"
              class="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
              @click="applyFlag(v.id, 'V')">Set Flag</button>
            <button v-if="annOf(v.id)" type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
              @click="clearFlag(v.id)">Clear</button>
            <button type="button" class="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
              @click="openFlagId = null">Cancel</button>
          </div>
        </div>
      </div>

      <!-- S. group header + copy + edit -->
      <div class="flex items-center justify-between px-1 pt-2">
        <span class="text-xs font-bold text-orange-600 uppercase tracking-wide">Solutions</span>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            title="Open Spec Editor — Solutions tab"
            @click="emit('open-editor', { tab: 'solutions' })"
          ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /> Edit</button>
          <button
            type="button"
            class="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
            @click="copyRich('solutions', buildSolutionsHTML(), buildSolutionsTSV())"
          >{{ copiedSection === 'solutions' ? '✓ Copied!' : '📋 Copy' }}</button>
        </div>
      </div>

      <!-- S. entries — purple -->
      <div
        v-for="s in spec.solutions"
        :key="s.id"
        class="bg-white rounded-xl border shadow-sm"
        :class="[
          !annOf(s.id)                              && 'border-purple-100',
          annOf(s.id)?.type === 'missing'           && 'border-dashed border-orange-300',
          annOf(s.id)?.type === 'ambiguous'         && 'border-amber-300',
          annOf(s.id)?.type === 'misleading'        && 'border-red-300',
          annOf(s.id)?.type === 'conflicting'       && 'border-purple-300',
        ]"
      >
        <div class="bg-orange-600 px-4 py-2.5 flex items-center gap-2 rounded-t-xl">
          <span class="text-xs font-bold text-orange-100 bg-orange-700 rounded px-1.5 py-0.5">S.</span>
          <span class="text-sm font-semibold text-white truncate">{{ s.id }}</span>
          <!-- Annotation badge -->
          <span v-if="annOf(s.id)"
            class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none"
            :class="ANN_CONFIG[annOf(s.id)!.type].badgeCls"
          >{{ ANN_CONFIG[annOf(s.id)!.type].badge }}</span>
          <!-- Priority indicator chip — "Prioritized due to {reason}" — shown only when a priority record exists -->
          <span
            v-if="priorityOf(s.id)"
            class="shrink min-w-0 inline-flex items-center gap-1 text-[10px] font-semibold leading-none px-1.5 py-0.5 rounded-full bg-amber-300/95 text-amber-900 border border-amber-200 max-w-[260px] truncate"
            :title="`Prioritized due to: ${priorityReason(s.id) || '(see priority record)'}`"
          >
            <svg viewBox="0 0 24 24" class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="M7 21h10"/><path d="M3 14l3-6 3 6"/><path d="M15 14l3-6 3 6"/><path d="M3 14a3 3 0 0 0 6 0"/><path d="M15 14a3 3 0 0 0 6 0"/><path d="M5 8l7-3 7 3"/></svg>
            <span class="truncate">Prioritized<template v-if="priorityReason(s.id)"> · {{ priorityReason(s.id) }}</template></span>
          </span>
          <!-- Per-entry action buttons (edit + priority + flag) -->
          <div class="ml-auto shrink-0 flex items-center gap-1">
            <button
              type="button"
              class="h-6 px-2 rounded text-[10px] font-semibold
                     bg-white/15 text-white hover:bg-amber-400/80 hover:text-amber-900
                     transition-colors focus:outline-none focus:ring-1 focus:ring-white/60"
              :title="`Edit ${s.id} in Spec Editor`"
              :aria-label="`Edit solution ${s.id}`"
              @click="emit('open-editor', { tab: 'solutions', entryId: s.id })"
            >✏</button>
            <!-- Priority decision — split-button (DD-002 2026-05-14). -->
            <PriorityActionButton
              label="Edit Priority"
              chrome-class="bg-white/15 text-white"
              rounded-class="rounded"
              height-class="h-6"
              text-size-class="text-[10px]"
              glyph-size-class="h-3.5"
              :action-title="`Record priority decision for ${s.id}`"
              :action-aria-label="`Priority for ${s.id}`"
              @action="emit('open-priority', { entryId: s.id, entryType: 'S', description: s.description })"
              @info="emit('open-priority-info')"
            />
            <button
              type="button"
              class="h-6 px-2 rounded text-[10px] font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-white/60"
              :class="annOf(s.id) ? ANN_CONFIG[annOf(s.id)!.type].flagCls : 'bg-white/15 text-white hover:bg-white/25'"
              :title="annOf(s.id) ? `Flagged: ${ANN_CONFIG[annOf(s.id)!.type].badge} — click to change` : `Flag quality issue for ${s.id}`"
              :aria-label="`Quality flag for ${s.id}`"
              @click="openFlag(s.id)"
            >🚩</button>
          </div>
          <!-- Sharpening badge: ✂️ + category labels -->
          <span
            v-if="sharpenedEntryIds?.includes(s.id)"
            class="flex items-center gap-1 flex-shrink-0"
            aria-label="Sharpened entry"
          >
            <span
              v-for="cat in (entryCategories.get(s.id) ?? [])"
              :key="cat.label"
              class="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-white/20 text-white rounded px-1.5 py-0.5 leading-none whitespace-nowrap"
              :title="`Sharpened by ${cat.label}`"
            >
              <span aria-hidden="true">{{ cat.emoji }}</span>
              {{ cat.label }}
            </span>
            <span v-if="!entryCategories.get(s.id)?.length" class="text-sm leading-none">✂️</span>
          </span>
        </div>
        <div class="px-4 py-3 space-y-2">
          <p :class="[
            'text-sm',
            !annOf(s.id)                              && 'text-gray-800',
            annOf(s.id)?.type === 'missing'           && 'text-gray-400 italic',
            annOf(s.id)?.type === 'ambiguous'         && 'text-gray-800 underline decoration-dashed decoration-amber-500 underline-offset-2',
            annOf(s.id)?.type === 'misleading'        && 'font-bold text-red-700',
            annOf(s.id)?.type === 'conflicting'       && 'text-gray-800 italic',
          ]">{{ s.description }}</p>
          <!-- Conflict refs row -->
          <div v-if="annOf(s.id)?.type === 'conflicting' && annOf(s.id)!.conflictsWith.length" class="flex flex-wrap gap-1.5">
            <span v-for="(ref, i) in annOf(s.id)!.conflictsWith" :key="i"
              class="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5"
            >{{ ref.scope === 'same-spec' ? ref.entryId ?? 'same spec' : ref.specName ?? 'other spec' }} — {{ ref.description.slice(0, 60) }}{{ ref.description.length > 60 ? '…' : '' }}</span>
          </div>
          <!-- Annotation note -->
          <p v-if="annOf(s.id)?.note" class="text-[10px] text-gray-500 italic border-l-2 pl-2"
            :class="{
              'border-orange-300': annOf(s.id)?.type === 'missing',
              'border-amber-300': annOf(s.id)?.type === 'ambiguous',
              'border-red-300': annOf(s.id)?.type === 'misleading',
              'border-purple-300': annOf(s.id)?.type === 'conflicting',
            }"
          >{{ annOf(s.id)!.note }}</p>
          <p v-if="s.impact" class="text-xs text-gray-500">
            <span class="font-semibold">Impact:</span> {{ s.impact }}
          </p>
        </div>
        <!-- S. inline flag form -->
        <div v-show="openFlagId === s.id" class="border-t border-purple-100 bg-purple-50/50 px-4 py-3 space-y-2.5 rounded-b-xl">
          <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Flag this entry as:</p>
          <div class="grid grid-cols-2 gap-1.5">
            <button v-for="opt in FLAG_OPTS" :key="opt.type" type="button"
              class="px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors text-left"
              :class="flagType === opt.type ? ANN_CONFIG[opt.type].activeCls : ANN_CONFIG[opt.type].inactiveCls"
              @click="flagType = opt.type">{{ opt.label }}</button>
          </div>
          <div class="space-y-1">
            <label class="block text-[10px] text-gray-500">Reason / note:</label>
            <input v-model="flagNote" type="text" placeholder="Brief explanation…"
              class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          </div>
          <div v-if="flagType === 'conflicting'" class="space-y-1">
            <label class="block text-[10px] text-gray-500">Conflicts with (entry IDs or plan names):</label>
            <input v-model="flagConflict" type="text" placeholder="e.g. V.UserPrivacy, Patient Privacy Plan"
              class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          </div>
          <div class="flex items-center gap-2 pt-0.5">
            <button type="button" :disabled="!flagType"
              class="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
              @click="applyFlag(s.id, 'S')">Set Flag</button>
            <button v-if="annOf(s.id)" type="button"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
              @click="clearFlag(s.id)">Clear</button>
            <button type="button" class="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
              @click="openFlagId = null">Cancel</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 3. Impact Matrix ── -->
    <section
      v-if="spec.values.length && spec.solutions.length"
      class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      aria-label="Impact estimation matrix"
    >
      <div class="bg-gray-800 px-5 py-3 flex items-center gap-3">
        <h2 class="text-sm font-semibold text-white tracking-wide uppercase flex-1">Impact Matrix &amp; V/C Ratios</h2>
        <button
          type="button"
          class="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors"
          @click="copyRich('vdt', buildVDTHTML(), buildVDTTSV())"
        >{{ copiedSection === 'vdt' ? '✓ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Ranked summary chips — top solutions -->
      <div class="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-100">
        <div
          v-for="(solutionId, idx) in rankedSolutions"
          :key="solutionId"
          class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          :class="idx === 0
            ? 'bg-green-100 text-green-800 border border-green-200'
            : idx === 1
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'"
        >
          <span
            class="flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold"
            :class="idx === 0 ? 'bg-green-500' : idx === 1 ? 'bg-blue-500' : 'bg-gray-400'"
          >#{{ idx + 1 }}</span>
          {{ solutionId }}
          <span class="font-normal opacity-75">V/C {{ formatVC(solutionId) }}</span>
        </div>
      </div>

      <!-- Scrollable table -->
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm border-collapse" aria-label="Impact matrix">
          <thead>
            <tr>
              <th
                class="sticky left-0 bg-gray-50 border-b border-r border-gray-200 px-4 py-2.5 text-left text-xs font-semibold text-gray-600 min-w-[140px]"
              >
                Value / Solution
              </th>
              <th
                v-for="sol in spec.solutions"
                :key="sol.id"
                class="border-b border-gray-200 px-3 py-2.5 text-center text-xs font-semibold text-gray-600 min-w-[90px] whitespace-nowrap"
                :class="rankOf(sol.id) === 1 ? 'bg-green-50' : rankOf(sol.id) === 2 ? 'bg-blue-50' : 'bg-gray-50'"
              >
                <div>{{ sol.id }}</div>
                <div
                  class="text-[10px] font-normal mt-0.5"
                  :class="rankOf(sol.id) === 1 ? 'text-green-600' : 'text-gray-400'"
                >
                  #{{ rankOf(sol.id) }}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(val, rowIdx) in spec.values"
              :key="val.id"
              :class="rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'"
            >
              <td
                class="sticky left-0 bg-inherit border-r border-gray-100 px-4 py-2.5 text-xs font-medium text-gray-800 whitespace-nowrap"
              >
                {{ val.id }}
              </td>
              <td
                v-for="sol in spec.solutions"
                :key="sol.id"
                class="px-3 py-2.5 text-center text-sm font-medium"
                :class="[
                  rankOf(sol.id) === 1 ? 'text-green-700' : 'text-gray-700',
                  (impactMatrix[val.id]?.[sol.id] ?? 0) >= 70
                    ? 'font-semibold'
                    : ''
                ]"
              >
                {{ impactMatrix[val.id]?.[sol.id] ?? 0 }}%
              </td>
            </tr>
          </tbody>
          <tfoot>
            <!-- Total impact row -->
            <tr class="border-t border-gray-200 bg-gray-50">
              <td class="sticky left-0 bg-gray-50 border-r border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600">
                Total Impact
              </td>
              <td
                v-for="sol in spec.solutions"
                :key="sol.id"
                class="px-3 py-2.5 text-center text-sm font-semibold"
                :class="rankOf(sol.id) === 1 ? 'text-green-700' : 'text-gray-700'"
              >
                {{ totalImpact(sol.id) }}
              </td>
            </tr>
            <!-- Calendar / capital cost row -->
            <tr
              v-if="Object.keys(calendarCosts).length || Object.keys(capitalCosts).length"
              class="border-t border-gray-100 bg-gray-50"
            >
              <td class="sticky left-0 bg-gray-50 border-r border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600">
                Costs (time / $k)
              </td>
              <td
                v-for="sol in spec.solutions"
                :key="sol.id"
                class="px-3 py-2.5 text-center text-xs text-gray-600"
              >
                {{ calendarCosts[sol.id] ?? 0 }}w / ${{ capitalCosts[sol.id] ?? 0 }}k
              </td>
            </tr>
            <!-- Means Efficiency row -->
            <tr class="border-t-2 border-gray-300 bg-white">
              <td class="sticky left-0 bg-white border-r border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-800">
                Means Efficiency
              </td>
              <td
                v-for="sol in spec.solutions"
                :key="sol.id"
                class="px-3 py-2.5 text-center"
              >
                <div
                  class="text-sm font-bold"
                  :class="rankOf(sol.id) === 1 ? 'text-green-700' : 'text-gray-800'"
                >
                  {{ formatVC(sol.id) }}
                </div>
                <div
                  class="text-xs mt-0.5"
                  :class="rankOf(sol.id) === 1 ? 'text-green-500 font-semibold' : 'text-gray-400'"
                >
                  #{{ rankOf(sol.id) }}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <!-- ── 4. Evo Plan with tasks ── -->
    <section
      v-if="evoSteps.length"
      class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      aria-label="Evo plan"
    >
      <div class="bg-gray-800 px-5 py-3 flex items-center gap-3">
        <h2 class="text-sm font-semibold text-white tracking-wide uppercase flex-1">Evo Plan</h2>
        <button
          type="button"
          class="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors"
          @click="copyRich('evo', buildEvoStepsHTML(), buildEvoStepsTSV())"
        >{{ copiedSection === 'evo' ? '✓ Copied!' : '📋 Copy Evo Steps' }}</button>
      </div>
      <ol class="divide-y divide-gray-100 list-none m-0 p-0">
        <li
          v-for="(step, idx) in evoSteps"
          :key="step.name"
          class="px-5 py-4"
        >
          <!-- Step header -->
          <div class="flex items-start gap-3">
            <!-- Step number badge -->
            <span
              class="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold mt-0.5"
            >
              {{ idx + 1 }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-gray-900">{{ step.name }}</div>
              <p class="text-sm text-gray-600 mt-0.5 leading-relaxed">{{ step.description }}</p>

              <!-- Linked values + effort -->
              <div class="flex flex-wrap items-center gap-2 mt-2">
                <span
                  v-for="vid in step.linkedValues"
                  :key="vid"
                  class="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700 font-medium"
                >
                  {{ vid }}
                </span>
                <span class="text-xs text-gray-400">·</span>
                <span class="text-xs text-gray-500 font-medium">
                  {{ step.effortPercent }}% effort
                </span>
              </div>

              <!-- Tasks -->
              <ul
                v-if="(tasksByStep[step.name] ?? []).length"
                class="mt-3 space-y-1 list-none m-0 p-0"
              >
                <li
                  v-for="task in tasksByStep[step.name]"
                  :key="task.id"
                  class="flex items-start gap-2"
                >
                  <!-- Checkbox indicator (read-only display) -->
                  <span
                    class="mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center"
                    :class="task.completed
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 bg-white'"
                    aria-hidden="true"
                  >
                    <svg
                      v-if="task.completed"
                      class="w-2.5 h-2.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span
                    class="text-xs leading-relaxed"
                    :class="task.completed ? 'line-through text-gray-400' : 'text-gray-700'"
                  >
                    {{ task.description }}
                    <span
                      v-if="task.effortHours !== null"
                      class="ml-1 text-gray-400"
                    >({{ task.effortHours }}h)</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </li>
      </ol>
    </section>

    <!-- ── 5. Stakeholders ── -->
    <section
      v-if="detectedStakeholders.length"
      class="rounded-2xl border border-slate-200 bg-white overflow-hidden"
    >
      <div class="flex items-center gap-3 px-5 py-3 bg-slate-700">
        <h2 class="text-sm font-semibold text-white tracking-wide uppercase flex-1">Stakeholders</h2>
        <span class="text-xs text-slate-400 hidden sm:block">Detected from Value descriptions</span>
        <button
          type="button"
          class="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors"
          @click="copyRich('stakeholders', buildStakeholdersHTML(), buildStakeholdersTSV())"
        >{{ copiedSection === 'stakeholders' ? '✓ Copied!' : '📋 Copy Stakeholders' }}</button>
      </div>
      <div class="overflow-x-auto p-4">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th class="text-left text-xs font-semibold text-slate-500 py-2 pr-4 whitespace-nowrap">Stakeholder</th>
              <th
                v-for="v in spec.values"
                :key="v.id"
                class="text-center text-xs font-medium text-slate-600 py-2 px-3 border-b border-slate-200"
                style="min-width:80px"
              >{{ v.description }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="sh in detectedStakeholders"
              :key="sh.name"
              class="border-t border-slate-100"
            >
              <td class="py-2.5 pr-4 font-medium text-slate-700 whitespace-nowrap">
                <span
                  class="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                  :style="`background:${sh.colour}`"
                  aria-hidden="true"
                />{{ sh.name }}
              </td>
              <td
                v-for="v in spec.values"
                :key="v.id"
                class="py-2.5 px-3 text-center"
              >
                <span
                  :class="[
                    'inline-block rounded-full text-[10px] font-semibold px-2 py-0.5',
                    impactLevel(vEntryText(v), sh) === 0 ? 'bg-slate-100 text-slate-400' :
                    impactLevel(vEntryText(v), sh) === 1 ? 'bg-blue-100 text-blue-700' :
                    impactLevel(vEntryText(v), sh) === 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700 font-bold'
                  ]"
                >{{ IMPACT_LABEL[impactLevel(vEntryText(v), sh)] }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── 6. Actions ── -->
    <section class="space-y-5 px-1">

      <!-- Where did it go? info strip -->
      <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-1.5 text-sm text-emerald-900">
        <p class="font-semibold text-emerald-800">Where is your plan?</p>
        <p>
          🕐 <strong>Version History</strong> — this plan is saved and can be restored at any time.
          Tap the History button in the navigation bar to browse and restore previous versions.
        </p>
        <p v-if="lastDownloadedFile">
          📥 <strong>Downloads folder</strong> — a copy was automatically saved to your Mac Downloads folder
          as <span class="font-mono text-xs bg-emerald-100 px-1 py-0.5 rounded">{{ lastDownloadedFile }}</span>.
          Open it in Safari to share or print.
        </p>
        <p v-else>
          📥 <strong>Downloads folder</strong> — click "Download HTML" below to save a copy to your Mac Downloads folder.
        </p>
      </div>

      <!-- Download / Email / Start Over -->
      <div class="flex flex-col sm:flex-row gap-3">

        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-150"
          aria-label="Download HTML to Mac Downloads folder"
          title="Saves an HTML file to your Mac Downloads folder — open in Safari to share or print"
          @click="downloadHTML"
        >
          📄 Download HTML
          <span class="text-xs text-gray-400 font-normal">→ Downloads folder</span>
        </button>

        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-lg border border-blue-300 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-800 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-150"
          aria-label="Email this plan"
          title="Copies rich formatted plan to clipboard, then opens Mail — paste with ⌘V for full colour tables"
          @click="onEmailClick"
        >
          ✉️ Email this plan
          <span class="text-xs text-blue-500 font-normal">→ rich tables, paste ⌘V</span>
        </button>

        <button
          type="button"
          class="flex-1 flex items-center justify-center min-h-[44px] rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-150"
          aria-label="Start Over"
          @click="emit('start-over')"
        >
          Start Over
        </button>

      </div>
    </section>

  </div>
</template>
