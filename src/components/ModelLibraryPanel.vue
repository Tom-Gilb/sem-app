<!--
  ModelLibraryPanel.vue — Domain Model Library panel.

  Full-screen panel (z-[600]) presenting:
    - 18 built-in Planguage domain models across 6 example sub-categories
    - User-defined top-level categories (My Models, Our Models, custom)
    - "Bring in Models" flow: paste text → AI converts to Planguage entries
    - Sharpen section: apply AI improvement commands to user model entries

  Three internal modes:
    grid       — category-filtered card grid; browse and select models.
    bring-in   — form to paste text and import a new model (AI-powered).
    detail     — entry browser for a selected model; copy Planguage; sharpen.

  UI Rules satisfied:
    ScrollContainer rule — all scrollable areas wrapped in ScrollContainer.
    CloseDot rule — close button uses CloseDot (on-dark, end of header).
    Single-Surface rule — caller registers 'modelLibrary' with registerExclusiveSurface.
    Define-by-Selection rule — no select-none on body content.
    DD-009 Zero-Training UI — all interactive elements have :title.
    Interaction Disclosure rule — multi-mode elements disclose all modes in title.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import EditGlyph from './icons/EditGlyph.vue'
import PlTypeBadge from './icons/PlTypeBadge.vue'
import PlanguageDiagram from './PlanguageDiagram.vue'  // v485 — shared viz engine
import { renderLayoutToSvgString } from '../composables/useValueFlowLayout'
import type { VizMode } from '../composables/useValueFlowLayout'
import {
  useModelLibrary,
  formatModelAsPlanguage,
  CATEGORIES_META,
  BOUNDARY_TYPES,
} from '../composables/useModelLibrary'
import type {
  ModelCategory,
  ModelLibraryEntry,
  ModelCategoryDef,
  ModelEntry,
  BoundaryType,
} from '../composables/useModelLibrary'
import { useDocumentImport } from '../composables/useDocumentImport'
import { exportEmail } from '../composables/useExportShared'
import { useToast } from '../composables/useToast'

const emit = defineEmits<{
  close: []
  /** Emitted when a cross-agent navigation button is clicked.
   *  App.vue handles this the same way as AgentMenuPanel @select-agent. */
  'select-agent': [id: string]
}>()

// ── Composables ───────────────────────────────────────────────────────────────

const library = useModelLibrary()
const { importFromFile, importLoading: fileExtracting } = useDocumentImport()
const { showToast } = useToast()

// ── Type declarations ─────────────────────────────────────────────────────────

type EntryType = 'F' | 'V' | 'C' | 'R' | 'S'
type PanelMode = 'grid' | 'bring-in' | 'detail'
type ToolMode = 'none' | 'edit-batch' | 'edit-replace' | 'edit-manual' | 'viz-flow' | 'viz-related' | 'viz-3d' | 'viz-city' | 'viz-sun' | 'viz-star' | 'viz-focus' | 'viz-accordion' | 'viz-ring' | 'viz-ribbon' | 'sharpen' | 'defect-analysis' | 'improve-attributes'

// ── Panel mode ────────────────────────────────────────────────────────────────

const mode = ref<PanelMode>('grid')

// ── Sidebar state ─────────────────────────────────────────────────────────────

/** Selected top-level categoryId (null = 'examples' collapsed state using selectedSubCat). */
const selectedCategoryId  = ref<string>('examples')
/** Selected sub-category within 'examples'. */
const selectedSubCat      = ref<ModelCategory>('organizational')
/** Whether the 'examples' row is expanded to show sub-category items. */
const examplesExpanded    = ref(true)

/** Currently selected model id (for detail mode). */
const selectedModelId     = ref<string | null>(null)

/** Category currently being renamed (id). */
const renamingCategoryId  = ref<string | null>(null)
const renameInputValue    = ref('')
const renameInputRef      = ref<HTMLInputElement | null>(null)

// ── Bring-in form state ───────────────────────────────────────────────────────

const bringInTitle    = ref('')
const bringInCatId    = ref('my-models')
const bringInText     = ref('')
const fileInputRef    = ref<HTMLInputElement | null>(null)

// ── Detail / sharpen state ────────────────────────────────────────────────────

const copiedId               = ref<string | null>(null)
const sharpenCommand         = ref('')
const sharpenLoading         = ref(false)
const sharpenSuccess         = ref(false)
const sharpenError           = ref<string | null>(null)
/** Whether the "Specific Model Analysis Tools" dropdown is open. */
const specificToolsOpen      = ref(false)

const toolMode = ref<ToolMode>('none')

// v485 (2026-07-20) — Tom "extract".  The Value Flow + Strongly Related
// visualisations moved to <PlanguageDiagram> (composables/useValueFlowLayout).
// This panel keeps ONLY the scroll wrappers + scroll-% pills; the diagram +
// drill-down + prefix-strip + click-highlight all live in the shared component.
// See TWIN-PORTABILITY-PORTFOLIO.md Pattern #18 (proposed).
const vizFlowScrollEl     = ref<HTMLDivElement | null>(null)
const vizRelatedScrollEl  = ref<HTMLDivElement | null>(null)
const viz3dScrollEl       = ref<HTMLDivElement | null>(null)
const vizCityScrollEl     = ref<HTMLDivElement | null>(null)  // v486
const vizSunScrollEl      = ref<HTMLDivElement | null>(null)  // v489
const vizStarScrollEl     = ref<HTMLDivElement | null>(null)  // v489
const vizFocusScrollEl    = ref<HTMLDivElement | null>(null)  // v490
const vizAccordionScrollEl= ref<HTMLDivElement | null>(null)  // v490
const vizRingScrollEl     = ref<HTMLDivElement | null>(null)  // v490
const vizRibbonScrollEl   = ref<HTMLDivElement | null>(null)  // v490
const vizFlowScrollPct    = ref(100)
const vizRelatedScrollPct = ref(100)
const viz3dScrollPct      = ref(100)
const vizCityScrollPct    = ref(100)  // v486
const vizSunScrollPct     = ref(100)  // v489
const vizStarScrollPct    = ref(100)  // v489
const vizFocusScrollPct   = ref(100)  // v490
const vizAccordionScrollPct = ref(100)// v490
const vizRingScrollPct    = ref(100)  // v490
const vizRibbonScrollPct  = ref(100)  // v490
type VizKind = 'flow' | 'related' | '3d' | 'city' | 'sun' | 'star' | 'focus' | 'accordion' | 'ring' | 'ribbon'
function updateVizScrollPct(kind: VizKind): void {
  const el = ({
    flow:      vizFlowScrollEl,
    related:   vizRelatedScrollEl,
    '3d':      viz3dScrollEl,
    city:      vizCityScrollEl,
    sun:       vizSunScrollEl,
    star:      vizStarScrollEl,
    focus:     vizFocusScrollEl,
    accordion: vizAccordionScrollEl,
    ring:      vizRingScrollEl,
    ribbon:    vizRibbonScrollEl,
  }[kind] as { value: HTMLDivElement | null }).value
  if (!el) return
  const { scrollHeight, clientHeight } = el
  const pctShown = scrollHeight > 0 ? Math.min(100, Math.round((clientHeight / scrollHeight) * 100)) : 100
  const target = ({
    flow:      vizFlowScrollPct,
    related:   vizRelatedScrollPct,
    '3d':      viz3dScrollPct,
    city:      vizCityScrollPct,
    sun:       vizSunScrollPct,
    star:      vizStarScrollPct,
    focus:     vizFocusScrollPct,
    accordion: vizAccordionScrollPct,
    ring:      vizRingScrollPct,
    ribbon:    vizRibbonScrollPct,
  }[kind] as { value: number })
  target.value = pctShown
}
watch(toolMode, async (m) => {
  const map: Partial<Record<ToolMode, VizKind>> = {
    'viz-flow': 'flow', 'viz-related': 'related', 'viz-3d': '3d',
    'viz-city': 'city', 'viz-sun': 'sun', 'viz-star': 'star',
    'viz-focus': 'focus', 'viz-accordion': 'accordion', 'viz-ring': 'ring', 'viz-ribbon': 'ribbon',
  }
  const kind = map[m]
  if (kind) {
    await nextTick(); await nextTick()
    updateVizScrollPct(kind)
  }
})

// Defect analysis tool state
const defectBoundaryType  = ref<BoundaryType>('our-org')
const defectRunning       = ref(false)
const defectError         = ref<string | null>(null)

// Improve attributes tool state
const improveDimension    = ref<'stakeholder' | 'value' | 'constraint'>('stakeholder')
const improveSpec         = ref('')
const improveCount        = ref<1 | 3 | 10>(3)
const improveRunning      = ref(false)
const improveError        = ref<string | null>(null)
const improveAppliedId    = ref<string | null>(null)

// Batch change tool
const batchTypes   = ref(new Set<EntryType>(['F', 'V', 'C', 'R', 'S']))
const batchKeyword = ref('')
const batchAction  = ref<'replace' | 'delete'>('replace')
const batchNewText = ref('')
const batchScope   = ref<'description' | 'details' | 'both'>('description')
const batchApplied = ref(false)

// Find & replace tool
const findText           = ref('')
const replaceText        = ref('')
const findScope          = ref<'description' | 'details' | 'both'>('both')
const findCaseSensitive  = ref(false)
const findReplaceApplied = ref(false)

// Manual edit tool
const editTypes    = ref(new Set<EntryType>(['F', 'V', 'C', 'R', 'S']))
const editKeyword  = ref('')
const editDrafts   = ref(new Map<number, { description: string; details?: string }>())
const editApplied  = ref(false)

// Abort controller for AI calls
let _abortController: AbortController | null = null

// ── Derived data ──────────────────────────────────────────────────────────────

const selectedModel = computed<ModelLibraryEntry | null>(() =>
  selectedModelId.value
    ? library.allEntries.value.find(e => e.id === selectedModelId.value) ?? null
    : null,
)

/** The currently active model (the implied cross-agent analysis target). */
const activeModel = computed<ModelLibraryEntry | null>(() =>
  library.activeModelId.value
    ? library.allEntries.value.find(e => e.id === library.activeModelId.value) ?? null
    : null,
)

/** Models shown in the grid depending on selected category/sub-cat. */
const filteredModels = computed<ModelLibraryEntry[]>(() => {
  if (selectedCategoryId.value === 'examples') {
    return library.allEntries.value.filter(
      e => e.categoryId === 'examples' && e.exampleSubCategory === selectedSubCat.value,
    )
  }
  return library.allEntries.value.filter(e => e.categoryId === selectedCategoryId.value)
})

/** Count of models for a top-level category. */
function catCount(catId: string): number {
  if (catId === 'examples') {
    return library.allEntries.value.filter(e => e.categoryId === 'examples').length
  }
  return library.allEntries.value.filter(e => e.categoryId === catId).length
}

/** Count of models for an examples sub-category. */
function subCatCount(subCat: ModelCategory): number {
  return library.allEntries.value.filter(
    e => e.categoryId === 'examples' && e.exampleSubCategory === subCat,
  ).length
}

function getCatMeta(cat: ModelCategory) {
  return CATEGORIES_META.find(c => c.id === cat)!
}

/** Non-examples categories available in the Bring-in form dropdown. */
const bringInCategoryOptions = computed<ModelCategoryDef[]>(() =>
  library.categoryDefs.value.filter(c => c.id !== 'examples'),
)

// ── Sidebar actions ───────────────────────────────────────────────────────────

function selectTopLevelCat(catId: string): void {
  selectedCategoryId.value = catId
  mode.value = 'grid'
  selectedModelId.value = null
  cancelRename()
}

function selectSubCat(subCat: ModelCategory): void {
  selectedCategoryId.value = 'examples'
  selectedSubCat.value = subCat
  mode.value = 'grid'
  selectedModelId.value = null
  cancelRename()
}

function toggleExamples(): void {
  examplesExpanded.value = !examplesExpanded.value
}

function startRename(cat: ModelCategoryDef): void {
  if (!cat.isRenameable) return
  renamingCategoryId.value = cat.id
  renameInputValue.value = cat.label
  nextTick(() => renameInputRef.value?.focus())
}

function saveRename(): void {
  if (!renamingCategoryId.value) return
  library.renameCategory(renamingCategoryId.value, renameInputValue.value)
  cancelRename()
}

function cancelRename(): void {
  renamingCategoryId.value = null
  renameInputValue.value = ''
}

function handleRenameKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter')  { e.preventDefault(); saveRename() }
  if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
}

function addNewCategory(): void {
  const def = library.addCategory('New Category')
  // Immediately select and put into rename mode
  selectedCategoryId.value = def.id
  mode.value = 'grid'
  selectedModelId.value = null
  nextTick(() => startRename(def))
}

function deleteCategory(cat: ModelCategoryDef): void {
  const count = catCount(cat.id)
  if (count > 0) {
    const ok = confirm(`Delete "${cat.label}" with ${count} model${count === 1 ? '' : 's'}? Models will be lost.`)
    if (!ok) return
    // Remove entries in this category
    library.allEntries.value
      .filter(e => e.categoryId === cat.id && e.source === 'user')
      .forEach(e => library.removeUserEntry(e.id))
  }
  library.removeCategory(cat.id)
  if (selectedCategoryId.value === cat.id) {
    selectedCategoryId.value = 'examples'
    selectedSubCat.value = 'organizational'
  }
}

// ── Grid actions ──────────────────────────────────────────────────────────────

function viewModel(id: string): void {
  selectedModelId.value = id
  // Viewing a model makes it the implied analysis target for cross-agent tools.
  library.setActiveModel(id)
  mode.value = 'detail'
  toolMode.value = 'none'
  sharpenCommand.value = ''
  sharpenSuccess.value = false
  sharpenError.value = null
  specificToolsOpen.value = false
}

/**
 * Navigate to a cross-agent tool with the current model as implied context.
 * Sets activeModelId first so the target agent can pick it up.
 */
function sendToAgent(agentId: string): void {
  if (selectedModelId.value) {
    library.setActiveModel(selectedModelId.value)
  }
  emit('select-agent', agentId)
}

function backToGrid(): void {
  selectedModelId.value = null
  mode.value = 'grid'
  toolMode.value = 'none'
  _abortController?.abort()
}

async function copyPlanguage(entry: ModelLibraryEntry): Promise<void> {
  const text = formatModelAsPlanguage(entry)
  await navigator.clipboard.writeText(text).catch(() => { /* clipboard not available */ })
  copiedId.value = entry.id
  setTimeout(() => { copiedId.value = null }, 2500)
}

function openBringIn(): void {
  bringInTitle.value = ''
  bringInText.value  = ''
  // Default to first non-examples cat
  bringInCatId.value = bringInCategoryOptions.value[0]?.id ?? 'my-models'
  mode.value = 'bring-in'
  selectedModelId.value = null
}

// ── Bring-in actions ──────────────────────────────────────────────────────────

function triggerUpload(): void {
  fileInputRef.value?.click()
}

async function handleFileUpload(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0]
  input.value = ''
  if (!file) return
  const text = await importFromFile(file)
  if (!text) return
  bringInText.value  = text
  if (!bringInTitle.value) {
    bringInTitle.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  }
}

async function submitBringIn(): Promise<void> {
  // v475 (2026-07-20) — Tom "nothing happens" report.  Headless probe proved
  // the flow works in a clean session but Tom's live browser showed no
  // response.  Root-fix pattern: (a) SURFACE the success so the click is
  // never silently "nothing" (MOVE + No-Silent-Data-Loss); (b) TRAP the
  // synchronous path in try/catch so a `library.addUserEntry` throw (e.g.
  // localStorage full, malformed prior entry) surfaces a red notification
  // instead of dying under water.
  if (!bringInText.value.trim()) return
  let entry: ModelLibraryEntry
  try {
    entry = library.addUserEntry(
      bringInTitle.value,
      bringInCatId.value,
      bringInText.value,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    showToast(`❌ Could not save model — ${msg}`, 6000)
    return
  }
  // Switch to the category that was selected
  selectedCategoryId.value = bringInCatId.value
  mode.value = 'grid'
  // v475 — plain-English confirmation.  "Analyzing" is American English per
  // the American English Standard (existing British "Analysing" strings in
  // this file are pre-existing debt not swept in this ship).
  showToast('✓ Model saved. Analyzing text into Planguage in the background…', 4000)
  // Kick off analysis in background
  _abortController = new AbortController()
  await library.analyseModelText(entry.id, _abortController.signal)
}

function triggerAnalyse(modelId: string): void {
  _abortController = new AbortController()
  library.analyseModelText(modelId, _abortController.signal)
}

// ── Sharpen actions ───────────────────────────────────────────────────────────

const SHARPEN_PILLS = ['Simplify', 'Add Values', 'Tighten Constraints', 'Make More Specific']

function fillSharpenPill(pill: string): void {
  sharpenCommand.value = pill
}

async function runSharpen(): Promise<void> {
  if (!selectedModel.value || !sharpenCommand.value.trim()) return
  sharpenLoading.value = true
  sharpenSuccess.value = false
  sharpenError.value   = null
  _abortController = new AbortController()
  try {
    await library.sharpenModel(selectedModel.value.id, sharpenCommand.value, _abortController.signal)
    sharpenSuccess.value = true
    setTimeout(() => { sharpenSuccess.value = false }, 3000)
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== 'AbortError') {
      sharpenError.value = err instanceof Error ? err.message : 'Sharpen failed'
    }
  } finally {
    sharpenLoading.value = false
  }
}

// ── Entry count helpers ───────────────────────────────────────────────────────

function countByType(entry: ModelLibraryEntry, type: EntryType): number {
  return entry.entries.filter(e => e.type === type).length
}

// ── Specific Model Analysis Tools ─────────────────────────────────────────────

const TOOL_MODE_LABELS: Record<ToolMode, string> = {
  'none':              '',
  'edit-batch':        '🔧 Batch Change Entries',
  'edit-replace':      '🔍 Find & Replace',
  'edit-manual':       '✏️ Manual Edit List',
  'viz-flow':          '📊 Value Flow',
  'viz-related':       '🔗 Strongly Related',
  'viz-3d':            '🧊 Model Visualizer (3D · 2D)',
  'viz-city':          '🏙 Isometric City (pseudo-3D · rotatable)',
  'viz-sun':           '☀ Radial Sunburst (concentric rings)',
  'viz-star':          '✨ Constellation Map (star clusters)',
  'viz-focus':         '🎯 Focus + Context (fade unrelated)',
  'viz-accordion':     '📚 Layered Accordion (5 stripes)',
  'viz-ring':          '💫 Focus Ring (concentric neighbours)',
  'viz-ribbon':        '📅 Time Ribbon (horizontal lanes)',
  'sharpen':           '✂️ Sharpen Model',
  'defect-analysis':   '🔬 Model Defect Analysis',
  'improve-attributes': '✨ Improve Model Attributes',
}

const batchMatchedEntries = computed<Array<{idx: number; entry: ModelEntry}>>(() => {
  if (!selectedModel.value) return []
  return selectedModel.value.entries
    .map((e, idx) => ({ idx, entry: e }))
    .filter(({ entry }) => {
      if (!batchTypes.value.has(entry.type)) return false
      const kw = batchKeyword.value.trim().toLowerCase()
      if (kw) {
        const hay = (entry.description + ' ' + (entry.details ?? '')).toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
})

const findReplacePreview = computed<Array<{
  idx: number; field: 'description' | 'details'; original: string; result: string
}>>(() => {
  if (!selectedModel.value || !findText.value.trim()) return []
  const escaped = findText.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const flags = findCaseSensitive.value ? 'g' : 'gi'
  const out: Array<{idx: number; field: 'description' | 'details'; original: string; result: string}> = []
  for (const [idx, entry] of selectedModel.value.entries.entries()) {
    if (findScope.value !== 'details') {
      const re = new RegExp(escaped, flags)
      if (re.test(entry.description)) {
        out.push({ idx, field: 'description', original: entry.description, result: entry.description.replace(new RegExp(escaped, flags), replaceText.value) })
      }
    }
    if (findScope.value !== 'description' && entry.details) {
      const re2 = new RegExp(escaped, flags)
      if (re2.test(entry.details)) {
        out.push({ idx, field: 'details', original: entry.details, result: entry.details.replace(new RegExp(escaped, flags), replaceText.value) })
      }
    }
  }
  return out
})

const editFilteredEntries = computed<Array<{idx: number; entry: ModelEntry}>>(() => {
  if (!selectedModel.value) return []
  return selectedModel.value.entries
    .map((e, idx) => ({ idx, entry: e }))
    .filter(({ entry }) => {
      if (!editTypes.value.has(entry.type)) return false
      const kw = editKeyword.value.trim().toLowerCase()
      if (kw) {
        const hay = (entry.description + ' ' + (entry.details ?? '')).toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
})

function openTool(mode: ToolMode): void {
  specificToolsOpen.value = false
  toolMode.value = mode
  if (mode === 'edit-manual') initEditDrafts()
  // Reset applied flags
  batchApplied.value = false
  findReplaceApplied.value = false
  editApplied.value = false
}

function closeTool(): void {
  toolMode.value = 'none'
}

// ── Model display export (Copy + Email) ───────────────────────────────────
//    Tom 2026-05-31: "copy, we need copy this display, and email this display
//    on all model displays"
//    Twin-portable: buildModelExportHtml is a pure function (no Vue API).

/** Visual feedback ref — shows ✓ on the Copy button for 2s after copy. */
const copiedToolExport = ref(false)

/**
 * Build a colorful HTML email / clipboard export for the currently displayed
 * model tool view. Follows the Colorful Exports Rule: colored HTML table,
 * never pure text.
 *
 * @param model     The active ModelLibraryEntry.
 * @param toolLabel Human-readable label from TOOL_MODE_LABELS (or 'Model Detail').
 */
/**
 * v488 (2026-07-20) — Map a viz toolMode to the shared engine's VizMode.
 * Returns null for non-viz modes (email export falls back to entry table only).
 */
function _toolModeToVizMode(m: ToolMode): VizMode | null {
  switch (m) {
    case 'viz-flow':    return 'sankey-focus'
    case 'viz-related': return 'strongly-related'
    case 'viz-city':    return 'isometric-city'
    case 'viz-sun':     return 'sunburst'          // v489
    case 'viz-star':    return 'constellation'     // v489
    case 'viz-focus':    return 'focus-context'     // v490
    case 'viz-accordion':return 'layered-accordion' // v490
    case 'viz-ring':     return 'focus-ring'        // v490
    case 'viz-ribbon':   return 'time-ribbon'       // v490
    default:            return null   // viz-3d + non-viz modes: no shared-engine SVG
  }
}

function buildModelExportHtml(model: ModelLibraryEntry, toolLabel: string, vizMode: VizMode | null = null): string {
  const TYPE_STYLE: Record<string, { bg: string; border: string; badge: string; label: string }> = {
    F: { bg: '#fff7ed', border: '#f97316', badge: 'background:#f97316;color:#fff', label: 'Function' },
    V: { bg: '#eff6ff', border: '#3b82f6', badge: 'background:#3b82f6;color:#fff', label: 'Value' },
    C: { bg: '#fdf4ff', border: '#c026d3', badge: 'background:#c026d3;color:#fff', label: 'Constraint' },
    R: { bg: '#f0f9ff', border: '#0284c7', badge: 'background:#0284c7;color:#fff', label: 'Resource' },
    S: { bg: '#f5f3ff', border: '#7c3aed', badge: 'background:#7c3aed;color:#fff', label: 'Stakeholder' },
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const today = new Date().toISOString().slice(0, 10)

  const rows = model.entries.map(e => {
    const st = TYPE_STYLE[e.type] ?? { bg: '#f8fafc', border: '#94a3b8', badge: 'background:#94a3b8;color:#fff', label: e.type }
    return [
      `<tr style="background:${st.bg};border-left:4px solid ${st.border}">`,
      `<td style="padding:6px 10px;white-space:nowrap;">`,
      `<span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;${st.badge}">${esc(e.type)}.</span>`,
      `</td>`,
      `<td style="padding:6px 10px;font-size:12px;color:#1e293b;">${esc(e.description)}</td>`,
      `<td style="padding:6px 10px;font-size:11px;color:#64748b;">${esc(e.details ?? '')}</td>`,
      `</tr>`,
    ].join('')
  }).join('')

  // Category row label — group entries by type with a divider row
  const groupedRows = (['F', 'V', 'C', 'R', 'S'] as const).map(t => {
    const entries = model.entries.filter(e => e.type === t)
    if (entries.length === 0) return ''
    const st = TYPE_STYLE[t]
    const header = `<tr><td colspan="3" style="padding:4px 10px 2px;background:#f1f5f9;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.08em;">${st.label} (${entries.length})</td></tr>`
    const entryRows = entries.map(e =>
      `<tr style="background:${st.bg};border-left:4px solid ${st.border}">` +
      `<td style="padding:6px 10px;white-space:nowrap;"><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;${st.badge}">${esc(e.type)}.</span></td>` +
      `<td style="padding:6px 10px;font-size:12px;color:#1e293b;">${esc(e.description)}</td>` +
      `<td style="padding:6px 10px;font-size:11px;color:#64748b;">${esc(e.details ?? '')}</td>` +
      `</tr>`
    ).join('')
    return header + entryRows
  }).join('')

  // v488 — for viz modes, render the actual diagram SVG.  Email clients
  // (Mail.app, Gmail, Outlook 2018+) all render inline SVG.  CSS 3D
  // transforms are stripped — isometric-city recipients see the flat
  // 2D layout, which is honest (rotation only exists in the live app).
  const vizSvg = vizMode
    ? [
        `<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;">`,
        `<p style="margin:0 0 8px 0;color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${esc(toolLabel)} — diagram</p>`,
        renderLayoutToSvgString(
          { title: model.title, stakeholders: model.stakeholders, entries: model.entries },
          vizMode,
        ),
        // v493 — per-mode explanatory note carried into the email so recipients
        // see the SAME contextual guidance as in-app users.  Currently: iso-city
        // + time-ribbon; extend as new modes ship contextual notes.
        vizMode === 'isometric-city'
          ? `<p style="margin:8px 0 0 0;color:#94a3b8;font-size:10px;font-style:italic;">Isometric City rotation is an interactive feature of the SEM App; the embedded diagram above is the flat 2D layout.  Open the model in SEM App to explore in pseudo-3D.</p>`
          : vizMode === 'time-ribbon'
          ? `<p style="margin:8px 0 0 0;color:#94a3b8;font-size:10px;font-style:italic;">Time Ribbon: entries plotted left-to-right per lane.  MVP uses entry index order.  When r93jjj Qualifiers Phase 2 populates temporal Qualifiers per entry, this diagram automatically shows real time positions.</p>`
          : '',
        `</div>`,
      ].join('')
    : ''

  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:820px;padding:16px;color:#0f172a;">',
    // Title block
    `<div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:8px;padding:16px 20px;margin-bottom:16px;">`,
    `<h2 style="margin:0 0 4px 0;color:#f8fafc;font-size:16px;font-weight:800;">${esc(toolLabel)}</h2>`,
    `<p style="margin:0;color:#94a3b8;font-size:12px;font-weight:600;">${esc(model.title)}</p>`,
    `<p style="margin:4px 0 0 0;color:#64748b;font-size:11px;">Category: ${esc(model.exampleSubCategory ?? model.categoryId ?? '')} · ${model.entries.length} entries · SEM App · ${today}</p>`,
    `</div>`,
    // v488 — diagram SVG for viz modes (above the entry table)
    vizSvg,
    // Entry table
    `<table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">`,
    `<thead><tr style="background:#1e293b;"><th style="padding:8px 10px;text-align:left;color:#e2e8f0;font-size:11px;font-weight:700;">Type</th>`,
    `<th style="padding:8px 10px;text-align:left;color:#e2e8f0;font-size:11px;font-weight:700;">Description</th>`,
    `<th style="padding:8px 10px;text-align:left;color:#e2e8f0;font-size:11px;font-weight:700;">Details</th></tr></thead>`,
    `<tbody>${groupedRows || rows}</tbody>`,
    `</table>`,
    `<p style="margin:12px 0 0;color:#94a3b8;font-size:10px;">Generated by SEM App — ${toolLabel} · ${today}</p>`,
    `</div>`,
  ].join('')
}

async function copyToolExport(): Promise<void> {
  const model = selectedModel.value
  if (!model) return
  const label = toolMode.value !== 'none' ? TOOL_MODE_LABELS[toolMode.value] : 'Model Detail'
  const vizMode = _toolModeToVizMode(toolMode.value)  // v488
  const html = buildModelExportHtml(model, label, vizMode)
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) }),
    ])
  } catch {
    // Fallback: copy as text
    const text = model.entries.map(e => `${e.type}. ${e.description}${e.details ? ' — ' + e.details : ''}`).join('\n')
    await navigator.clipboard.writeText(text)
  }
  copiedToolExport.value = true
  setTimeout(() => { copiedToolExport.value = false }, 2000)
}

async function emailToolExport(): Promise<void> {
  const model = selectedModel.value
  if (!model) return
  const label = toolMode.value !== 'none' ? TOOL_MODE_LABELS[toolMode.value] : 'Model Detail'
  const vizMode = _toolModeToVizMode(toolMode.value)  // v488
  const html  = buildModelExportHtml(model, label, vizMode)
  const plain = model.entries.map(e => `${e.type}. ${e.description}${e.details ? ' — ' + e.details : ''}`).join('\n')
  // v491 (2026-07-21) — Tom "constellations, email, 1. did not put in
  // tom@gilb.com".  Tom's workflow here IS to self-email visualizations for
  // review + archival; Model Library exports pre-populate To: Tom@Gilb.com
  // as a convenience.  This is an intentional exception to Mailto-No-Self-To
  // SUPREME (which binds SharpenExport + other flows where Tom sends
  // externally); Tom explicitly asked for the pre-fill here on 2026-07-21.
  await exportEmail(html, `${label} — ${model.title}`, label, 'Tom@Gilb.com', plain)
}

// ── Computed results for new analysis tools ───────────────────────────────

const currentDefectResult = computed(() =>
  selectedModelId.value ? library.defectResults.value.get(selectedModelId.value) ?? null : null
)
const currentImprovementResult = computed(() =>
  selectedModelId.value ? library.improvementResults.value.get(selectedModelId.value) ?? null : null
)

// ── Defect analysis actions ───────────────────────────────────────────────

async function runDefectAnalysis(): Promise<void> {
  if (!selectedModel.value) return
  defectRunning.value = true
  defectError.value = null
  _abortController = new AbortController()
  try {
    await library.runDefectAnalysis(selectedModel.value.id, defectBoundaryType.value, _abortController.signal)
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== 'AbortError') {
      defectError.value = err instanceof Error ? err.message : 'Analysis failed'
    }
  } finally {
    defectRunning.value = false
  }
}

// ── Improve attributes actions ────────────────────────────────────────────

async function runImproveAnalysis(): Promise<void> {
  if (!selectedModel.value || !improveSpec.value.trim()) return
  improveRunning.value = true
  improveError.value = null
  improveAppliedId.value = null
  _abortController = new AbortController()
  try {
    await library.runImprovementAnalysis(
      selectedModel.value.id,
      improveDimension.value,
      improveSpec.value,
      improveCount.value,
      _abortController.signal,
    )
  } catch (err: unknown) {
    if ((err as { name?: string }).name !== 'AbortError') {
      improveError.value = err instanceof Error ? err.message : 'Analysis failed'
    }
  } finally {
    improveRunning.value = false
  }
}

function applyImprovement(suggestionId: string): void {
  if (!selectedModel.value || !currentImprovementResult.value) return
  const suggestion = currentImprovementResult.value.suggestions.find(s => s.id === suggestionId)
  if (!suggestion) return
  library.applyImprovementSuggestion(selectedModel.value.id, suggestion)
  improveAppliedId.value = suggestionId
}

function restoreVersion(versionId: string): void {
  if (!selectedModel.value) return
  if (!confirm('Restore this version? A snapshot of the current state will be saved first.')) return
  library.restoreModelVersion(selectedModel.value.id, versionId)
}

// ── Static class maps for boundaries ─────────────────────────────────────

const BOUNDARY_HEADER_CLASS: Record<BoundaryType, string> = {
  'our-org':       'bg-blue-100 text-blue-800 border-blue-300',
  'product-line':  'bg-amber-100 text-amber-800 border-amber-300',
  'national':      'bg-blue-100 text-blue-800 border-blue-300',
  'international': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'universe':      'bg-violet-100 text-violet-800 border-violet-300',
}
const BOUNDARY_RING_FILL: Record<BoundaryType, string> = {
  'our-org':       '#d1fae5',
  'product-line':  '#fef3c7',
  'national':      '#dbeafe',
  'international': '#e0e7ff',
  'universe':      '#f1f5f9',
}
const BOUNDARY_RING_STROKE: Record<BoundaryType, string> = {
  'our-org':       '#059669',
  'product-line':  '#d97706',
  'national':      '#2563eb',
  'international': '#4338ca',
  'universe':      '#7c3aed',
}
const SEVERITY_CLASS: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700 border-rose-300',
  major:    'bg-orange-100 text-orange-700 border-orange-300',
  minor:    'bg-amber-100 text-amber-700 border-amber-300',
  info:     'bg-blue-100 text-blue-700 border-blue-300',
}
const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-rose-500',
  major:    'bg-orange-500',
  minor:    'bg-amber-400',
  info:     'bg-blue-400',
}

function toggleBatchType(t: EntryType): void {
  const s = new Set(batchTypes.value)
  if (s.has(t)) s.delete(t)
  else s.add(t)
  batchTypes.value = s
}

function toggleEditType(t: EntryType): void {
  const s = new Set(editTypes.value)
  if (s.has(t)) s.delete(t)
  else s.add(t)
  editTypes.value = s
}

function applyBatchChange(): void {
  if (!selectedModel.value) return
  const targets = new Set(batchMatchedEntries.value.map(m => m.idx))
  let newEntries: ModelEntry[]
  if (batchAction.value === 'delete') {
    newEntries = selectedModel.value.entries.filter((_, i) => !targets.has(i))
  } else {
    newEntries = selectedModel.value.entries.map((entry, i) => {
      if (!targets.has(i)) return entry
      const updated = { ...entry }
      if (batchScope.value !== 'details')      updated.description = batchNewText.value
      if (batchScope.value !== 'description')  updated.details     = batchNewText.value || undefined
      return updated
    })
  }
  library.replaceModelEntries(selectedModel.value.id, newEntries)
  batchApplied.value = true
  setTimeout(() => { batchApplied.value = false }, 3000)
}

function applyFindReplace(): void {
  if (!selectedModel.value || findReplacePreview.value.length === 0) return
  const changeMap = new Map<number, { description?: string; details?: string }>()
  for (const ch of findReplacePreview.value) {
    const existing = changeMap.get(ch.idx) ?? {}
    if (ch.field === 'description') existing.description = ch.result
    else                            existing.details      = ch.result
    changeMap.set(ch.idx, existing)
  }
  const newEntries = selectedModel.value.entries.map((entry, i) => {
    const ch = changeMap.get(i)
    return ch ? { ...entry, ...ch } : entry
  })
  library.replaceModelEntries(selectedModel.value.id, newEntries)
  findReplaceApplied.value = true
  findText.value = ''
  setTimeout(() => { findReplaceApplied.value = false }, 3000)
}

function initEditDrafts(): void {
  const m = new Map<number, { description: string; details?: string }>()
  if (!selectedModel.value) { editDrafts.value = m; return }
  for (const [i, e] of selectedModel.value.entries.entries()) {
    m.set(i, { description: e.description, details: e.details })
  }
  editDrafts.value = m
}

function applyManualEdits(): void {
  if (!selectedModel.value) return
  const newEntries = selectedModel.value.entries.map((entry, i) => {
    const draft = editDrafts.value.get(i)
    return draft ? { ...entry, description: draft.description, details: draft.details } : entry
  })
  library.replaceModelEntries(selectedModel.value.id, newEntries)
  editApplied.value = true
  setTimeout(() => { editApplied.value = false }, 3000)
}

// ── Visualization helpers ─────────────────────────────────────────────────────
// v485 (2026-07-20) — All viz layout code EXTRACTED to
// `src/composables/useValueFlowLayout.ts` (pure functions, Twin-portable) +
// `src/components/PlanguageDiagram.vue` (SVG + drill-down + click-highlight).
// This panel only holds the scroll wrappers + Copy/Mail chrome; the diagram
// mounts via `<PlanguageDiagram :model="..." mode="sankey-focus|strongly-related" />`.

// ── Tailwind class maps (static strings — no JIT runtime concatenation) ───────

const CAT_HEADER_CLASS: Record<ModelCategory, string> = {
  organizational: 'bg-gradient-to-r from-slate-700 to-slate-600',
  project:        'bg-gradient-to-r from-amber-700 to-amber-600',
  product:        'bg-gradient-to-r from-orange-700 to-orange-600',
  national:       'bg-gradient-to-r from-blue-700 to-blue-600',
  international:  'bg-gradient-to-r from-indigo-700 to-indigo-600',
  software:       'bg-gradient-to-r from-violet-700 to-violet-600',
}

const CAT_BUTTON_CLASS: Record<ModelCategory, string> = {
  organizational: 'bg-slate-700 hover:bg-slate-800 text-white',
  project:        'bg-amber-600 hover:bg-amber-700 text-white',
  product:        'bg-orange-600 hover:bg-orange-700 text-white',
  national:       'bg-blue-600 hover:bg-blue-700 text-white',
  international:  'bg-indigo-600 hover:bg-indigo-700 text-white',
  software:       'bg-violet-600 hover:bg-violet-700 text-white',
}

const TYPE_BADGE_CLASS: Record<EntryType, string> = {
  F: 'bg-orange-100 text-orange-800',
  V: 'bg-blue-100 text-blue-800',
  C: 'bg-fuchsia-100 text-fuchsia-800',
  R: 'bg-sky-100 text-sky-800',
  S: 'bg-violet-100 text-violet-800',
}

const ENTRY_TYPES: EntryType[] = ['F', 'V', 'C', 'R', 'S']

// ── Model Quality Score helpers ────────────────────────────────────────────

function qualityRowClass(score: number): string {
  if (score >= 80) return 'bg-blue-50 text-blue-700'
  if (score >= 60) return 'bg-amber-50 text-amber-700'
  return 'bg-orange-50 text-orange-700'
}

function qualityScoreLabel(score: number): string {
  if (score >= 80) return '★ Good'
  if (score >= 60) return '◑ Fair'
  return '▲ Needs work'
}

// ── Model Visualizer state (3D + 2D modes) ───────────────────────────────────
// vizRenderMode: top-level render mode selector.
//   '3d'         — CSS 3D cube with 6 entry-type faces (rotating or static)
//   '2d-simple'  — flat SVG node map: coloured circles/rects per entry, grouped by type
//   '2d-colored' — Kanban-style card columns, one column per entry type, colorised
type VizRenderMode = '3d' | '2d-simple' | '2d-colored'
const vizRenderMode = ref<VizRenderMode>('3d')

const viz3dLevel    = ref<'Top' | 'Medium' | 'All'>('Medium')
const viz3dRotating = ref(false)
const viz3dAngle    = ref(20)
let   viz3dTimer: ReturnType<typeof setInterval> | null = null

watch(viz3dRotating, (on) => {
  if (on) {
    viz3dTimer = setInterval(() => { viz3dAngle.value = (viz3dAngle.value + 0.5) % 360 }, 16)
  } else {
    if (viz3dTimer) { clearInterval(viz3dTimer); viz3dTimer = null }
  }
})

onUnmounted(() => { if (viz3dTimer) clearInterval(viz3dTimer) })

// All entries by type — used by all three render modes
const vizAllFEntries = computed(() => (selectedModel.value?.entries ?? []).filter(e => e.type === 'F'))
const vizAllVEntries = computed(() => (selectedModel.value?.entries ?? []).filter(e => e.type === 'V'))
const vizAllCEntries = computed(() => (selectedModel.value?.entries ?? []).filter(e => e.type === 'C'))
const vizAllREntries = computed(() => (selectedModel.value?.entries ?? []).filter(e => e.type === 'R'))
const vizAllSEntries = computed(() => (selectedModel.value?.entries ?? []).filter(e => e.type === 'S'))

// Entry sub-sets for each cube face (respects level-of-detail for 3D mode)
const viz3dFEntries = computed(() => vizAllFEntries.value)
const viz3dVEntries = computed(() =>
  viz3dLevel.value === 'Top' ? [] : vizAllVEntries.value)
const viz3dCEntries = computed(() =>
  viz3dLevel.value === 'All' ? vizAllCEntries.value : [])
const viz3dREntries = computed(() =>
  viz3dLevel.value === 'All' ? vizAllREntries.value : [])
const viz3dSEntries = computed(() =>
  viz3dLevel.value !== 'Top' ? vizAllSEntries.value : [])

// 2D mode: columns config — defines display order and colour tokens
// Pure data — Twin-portable (no Vue API).
const VIZ2D_COLS = [
  { type: 'F', label: 'Functions',    bg: 'bg-orange-50',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-800',  dot: 'bg-orange-400' },
  { type: 'V', label: 'Values',       bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-800',      dot: 'bg-blue-400'   },
  { type: 'C', label: 'Constraints',  bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', badge: 'bg-fuchsia-100 text-fuchsia-800',dot: 'bg-fuchsia-400'},
  { type: 'R', label: 'Resources',    bg: 'bg-sky-50',     border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-800',        dot: 'bg-sky-400'    },
  { type: 'S', label: 'Stakeholders', bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-800',  dot: 'bg-violet-400' },
] as const

function viz2dEntries(type: string) {
  switch (type) {
    case 'F': return vizAllFEntries.value
    case 'V': return vizAllVEntries.value
    case 'C': return vizAllCEntries.value
    case 'R': return vizAllREntries.value
    case 'S': return vizAllSEntries.value
    default: return []
  }
}

// 2D Simple: SVG layout constants.
// Nodes are arranged in a radial/row layout per type-group.
// Each node is 140×28px; 8px gap; 5 cols max per row.
const VIZ2D_NODE_W = 148
const VIZ2D_NODE_H = 28
const VIZ2D_GAP    = 8
const VIZ2D_COL_W  = VIZ2D_NODE_W + VIZ2D_GAP

// SVG node dot colour per type (small circle left of label).
const VIZ2D_DOT: Record<string, string> = {
  F: '#f97316', V: '#3b82f6', C: '#d946ef', R: '#0ea5e9', S: '#8b5cf6',
}

// Helper: CSS face style (pure function, no Vue dependency — Twin-portable)
function faceStyle(transform: string): Record<string, string> {
  return {
    position:           'absolute',
    inset:              '0',
    transform,
    backfaceVisibility: 'hidden',
    display:            'flex',
    flexDirection:      'column',
    alignItems:         'center',
    justifyContent:     'flex-start',
    padding:            '12px 8px',
    borderRadius:       '8px',
    overflow:           'hidden',
  }
}
</script>

<template>
  <!-- Full-screen panel — z-[600] sits above all major surfaces -->
  <div
    class="fixed inset-0 z-[600] bg-slate-50 flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-label="Model Library"
  >

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700 shrink-0">
      <span class="text-2xl" aria-hidden="true">🗂️</span>
      <div class="flex-1 min-w-0">
        <h2 class="text-base font-bold text-white leading-tight tracking-tight">Model Library</h2>
        <p class="text-[11px] text-white/60 leading-tight mt-0.5">Planguage domain models — Examples, My Models, Our Models, and custom categories</p>
      </div>
      <CloseDot
        variant="on-dark"
        aria-label="Close Model Library"
        title="Close — return to the main planning workspace"
        @click="emit('close')"
      />
    </div>

    <!-- ── Active Model Context Banner ─────────────────────────────────── -->
    <!-- Persistent when any model is set as the implied analysis target.
         Visible across all three panel modes (grid, bring-in, detail). -->
    <div
      v-if="activeModel"
      class="flex items-center gap-2.5 px-5 py-2 bg-teal-700 border-b border-teal-600 shrink-0"
    >
      <span class="text-base shrink-0" aria-hidden="true">📌</span>
      <span class="text-xs font-semibold text-white/90 flex-1 min-w-0 truncate">
        We are using: <span class="text-white font-bold">{{ activeModel.title }}</span>
      </span>
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          class="flex items-center gap-1 text-[10px] font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded px-2 py-1 transition-colors duration-150"
          title="Map Stakeholders — open Stakeholder Mapper with this model as context"
          @click="sendToAgent('stakeholder-mapper')"
        >
          👥 Map Stakeholders
        </button>
        <button
          type="button"
          class="flex items-center gap-1 text-[10px] font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded px-2 py-1 transition-colors duration-150"
          title="Evo Health Check — open Evo Critiquer with this model as context"
          @click="sendToAgent('evo-step-critique')"
        >
          📊 Evo Check
        </button>
        <button
          type="button"
          class="flex items-center gap-1 text-[10px] font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded px-2 py-1 transition-colors duration-150"
          title="Spec Agent — open Spec Agent with this model as context"
          @click="sendToAgent('plan-importer')"
        >
          📄 Spec Agent
        </button>
        <button
          type="button"
          class="flex items-center gap-1 text-[10px] font-medium bg-white/10 hover:bg-white/20 text-white/70 rounded px-2 py-1 transition-colors duration-150"
          title="Clear active model — remove this model as the implied analysis target"
          @click="library.setActiveModel(null)"
        >
          ✕ Clear
        </button>
      </div>
    </div>

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div class="flex-1 flex overflow-hidden">

      <!-- ── LEFT SIDEBAR ───────────────────────────────────────────────── -->
      <div class="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">

        <ScrollContainer
          outer-class="flex-1 min-h-0 relative"
          inner-class="py-2"
        >

          <!-- ── Examples of Models (collapsible) ────────────────────────── -->
          <button
            type="button"
            class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            title="Examples of Models — click to expand or collapse the 6 built-in sub-categories"
            @click="toggleExamples"
          >
            <span class="text-base shrink-0" aria-hidden="true">📚</span>
            <span class="flex-1 min-w-0 truncate">Examples of Models</span>
            <span
              :class="['shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center bg-slate-100 text-slate-500']"
            >{{ catCount('examples') }}</span>
            <span class="shrink-0 text-slate-400 text-[10px]" aria-hidden="true">{{ examplesExpanded ? '▾' : '▸' }}</span>
          </button>

          <!-- Sub-category rows -->
          <template v-if="examplesExpanded">
            <button
              v-for="subCat in CATEGORIES_META"
              :key="subCat.id"
              type="button"
              :class="[
                'w-full flex items-center gap-2 pl-7 pr-3 py-2 text-left text-xs transition-colors duration-150',
                selectedCategoryId === 'examples' && selectedSubCat === subCat.id
                  ? 'border-l-2 border-blue-500 bg-blue-50 text-blue-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50',
              ]"
              :title="`Browse ${subCat.label} example models`"
              @click="selectSubCat(subCat.id as ModelCategory)"
            >
              <span class="text-sm shrink-0" aria-hidden="true">{{ subCat.emoji }}</span>
              <span class="flex-1 min-w-0 truncate">{{ subCat.label }}</span>
              <span class="shrink-0 text-[10px] text-slate-400">{{ subCatCount(subCat.id as ModelCategory) }}</span>
            </button>
          </template>

          <!-- Divider -->
          <div class="h-px bg-slate-100 mx-3 my-1" />

          <!-- ── My Models ─────────────────────────────────────────────── -->
          <div
            v-for="cat in library.categoryDefs.value.filter(c => c.id !== 'examples')"
            :key="cat.id"
            :class="[
              'flex items-center gap-1 px-2 py-1 transition-colors duration-150',
              selectedCategoryId === cat.id
                ? 'border-l-2 border-blue-500 bg-blue-50'
                : '',
            ]"
          >
            <!-- v481 (2026-07-20) — RENAME MODE: input rendered as a TOP-LEVEL sibling
                 of the row, NOT inside the `<button>`.  Nesting an `<input>` inside a
                 `<button>` is invalid HTML — Safari refuses focus, blur fires on the
                 outer button not the inner input, and typed keystrokes go nowhere.
                 That was the real root cause of Tom's "could not name category" (v480
                 shipped the pencil label + dblclick but the input itself was still
                 broken). -->
            <template v-if="renamingCategoryId === cat.id">
              <span class="text-sm shrink-0 pl-1" aria-hidden="true">{{ cat.emoji }}</span>
              <input
                ref="renameInputRef"
                v-model="renameInputValue"
                type="text"
                class="flex-1 min-w-0 text-xs bg-white border-2 border-blue-500 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300"
                :aria-label="`Rename category — currently '${cat.label}'`"
                title="Type the new category name — press Enter to save · Escape to cancel"
                @keydown="handleRenameKeydown"
                @blur="saveRename"
              />
              <button
                type="button"
                class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 text-xs font-bold"
                title="Save the new category name — same as pressing Enter"
                @mousedown.prevent
                @click.stop="saveRename"
              >✓</button>
              <button
                type="button"
                class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs"
                title="Cancel rename — same as pressing Escape"
                @mousedown.prevent
                @click.stop="cancelRename"
              >✕</button>
            </template>

            <!-- v481 — BROWSE MODE: standard row with label + pencil + delete.  Pencil
                 is icon-only per Icon-Plus-Text SUPREME's "inside-component micro-button
                 next to a labelled parent" narrow exemption (v480's "Rename" text label
                 crowded the sidebar).  Discoverability comes from (a) HoverHint spelling
                 out both modes; (b) double-click on the row also opens rename. -->
            <template v-else>
              <button
                type="button"
                :class="[
                  'flex-1 flex items-center gap-2 px-1 py-1.5 text-left text-xs transition-colors duration-150 rounded min-w-0',
                  selectedCategoryId === cat.id
                    ? 'text-blue-800 font-semibold'
                    : 'text-slate-600 hover:text-slate-800',
                ]"
                :title="cat.isRenameable
                  ? `Browse ${cat.label} — single-click to view models · double-click to rename this category`
                  : `Browse ${cat.label} — click to view models in this category`"
                @click="selectTopLevelCat(cat.id)"
                @dblclick.stop="cat.isRenameable ? startRename(cat) : null"
              >
                <span class="text-sm shrink-0" aria-hidden="true">{{ cat.emoji }}</span>
                <span class="flex-1 min-w-0 truncate">{{ cat.label }}</span>
                <span class="shrink-0 text-[10px] text-slate-400">{{ catCount(cat.id) }}</span>
              </button>

              <!-- Rename pencil (icon-only micro-button, exempt per Icon-Plus-Text SUPREME) -->
              <button
                v-if="cat.isRenameable"
                type="button"
                class="shrink-0 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors duration-150"
                :title="`Rename '${cat.label}' — click this pencil (or double-click the row) to change the category name`"
                @click.stop="startRename(cat)"
              >
                <EditGlyph size="compact" aria-label="Rename category" />
              </button>

              <!-- Delete button (only user-created — not 'my-models'/'our-models') -->
              <button
                v-if="cat.id !== 'my-models' && cat.id !== 'our-models' && !cat.isBuiltin"
                type="button"
                class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150 text-[10px]"
                :title="`Delete '${cat.label}' category — removes the category and all models in it`"
                @click.stop="deleteCategory(cat)"
              >
                ✕
              </button>
            </template>
          </div>

          <!-- Divider -->
          <div class="h-px bg-slate-100 mx-3 my-1" />

          <!-- + New Category -->
          <button
            type="button"
            class="w-full flex items-center justify-center gap-1.5 mx-3 py-2 text-xs text-slate-500 border-2 border-dashed border-slate-200 rounded-lg hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-150"
            style="width: calc(100% - 24px);"
            title="Add a new custom category — click to create and name it"
            @click="addNewCategory"
          >
            <span aria-hidden="true">+</span>
            <span>New Category</span>
          </button>

        </ScrollContainer>

        <!-- Divider -->
        <div class="h-px bg-slate-200 mx-3" />

        <!-- + Bring in Models — always at very bottom of sidebar -->
        <div class="p-3">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg px-3 py-2.5 transition-colors duration-150"
            title="Bring in Models — paste any text and AI converts it to Planguage entries"
            @click="openBringIn"
          >
            <span aria-hidden="true">+</span>
            <span>Bring in Models</span>
          </button>
        </div>

      </div>

      <!-- ── MAIN CONTENT AREA ───────────────────────────────────────────── -->
      <div class="flex-1 min-w-0 flex flex-col">

        <!-- MODE A: Grid -->
        <template v-if="mode === 'grid'">
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-5"
          >
            <!-- Empty state -->
            <div
              v-if="filteredModels.length === 0"
              class="flex flex-col items-center justify-center py-16 text-slate-400"
            >
              <span class="text-4xl mb-3" aria-hidden="true">📭</span>
              <p class="text-sm font-medium">No models yet</p>
              <p class="text-xs mt-1 mb-4">Use "Bring in Models" to add one</p>
              <button
                type="button"
                class="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg px-4 py-2 transition-colors duration-150"
                title="Bring in Models — paste any text and AI converts it to Planguage entries"
                @click="openBringIn"
              >
                <span aria-hidden="true">+</span>
                <span>Bring in Models</span>
              </button>
            </div>

            <!-- Card grid -->
            <div
              v-else
              class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              <div
                v-for="model in filteredModels"
                :key="model.id"
                class="flex flex-col rounded-xl overflow-hidden ring-1 ring-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <!-- Card header -->
                <div
                  :class="[
                    'px-4 py-3 flex items-center gap-2',
                    model.categoryId === 'examples' && model.exampleSubCategory
                      ? CAT_HEADER_CLASS[model.exampleSubCategory]
                      : 'bg-gradient-to-r from-blue-700 to-blue-600',
                  ]"
                >
                  <span
                    v-if="model.categoryId === 'examples' && model.exampleSubCategory"
                    class="text-lg shrink-0"
                    aria-hidden="true"
                  >{{ getCatMeta(model.exampleSubCategory).emoji }}</span>
                  <span v-else class="text-lg shrink-0" aria-hidden="true">📄</span>
                  <span class="text-sm font-bold text-white truncate flex-1 min-w-0">{{ model.title }}</span>

                  <!-- Category badge -->
                  <span
                    v-if="model.categoryId === 'examples'"
                    class="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-teal-500/30 text-white/90 rounded px-1.5 py-0.5"
                  >Example</span>
                  <span
                    v-else-if="model.categoryId === 'my-models'"
                    class="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-blue-500/30 text-white/90 rounded px-1.5 py-0.5"
                  >Mine</span>
                  <span
                    v-else-if="model.categoryId === 'our-models'"
                    class="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-purple-500/30 text-white/90 rounded px-1.5 py-0.5"
                  >Ours</span>
                  <span
                    v-else
                    class="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-violet-500/30 text-white/90 rounded px-1.5 py-0.5"
                  >{{ library.categoryDefs.value.find(c => c.id === model.categoryId)?.label ?? 'Custom' }}</span>
                </div>

                <!-- Analysis status indicator (user models only) -->
                <div
                  v-if="model.source === 'user' && model.analysisStatus === 'analysing'"
                  class="flex items-center gap-1.5 px-4 py-1.5 bg-amber-50 border-b border-amber-100"
                >
                  <span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
                  <span class="text-[10px] text-amber-700 font-medium">Analysing…</span>
                </div>
                <!-- v480 (2026-07-20) — Tom "analysis failed, and I cannot name the model
                     category" — the prior strip said "Analysis failed" with NO error message
                     and NO way to retry.  Now: dot + label + actual error message (truncated
                     to keep card layout) + Retry pin per Icon-Plus-Text SUPREME. -->
                <div
                  v-else-if="model.source === 'user' && model.analysisStatus === 'error'"
                  class="flex flex-col gap-1 px-4 py-1.5 bg-orange-50 border-b border-orange-100"
                >
                  <div class="flex items-center gap-2">
                    <span class="inline-block w-2 h-2 rounded-full bg-orange-500 shrink-0" aria-hidden="true" />
                    <span class="text-[10px] text-orange-700 font-medium">Analysis failed</span>
                    <button
                      type="button"
                      class="ml-auto shrink-0 flex items-center gap-1 px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-semibold transition-colors duration-150"
                      title="Retry analysis — runs the AI extraction again on this model's text"
                      @click.stop="triggerAnalyse(model.id)"
                    >
                      <span aria-hidden="true">↻</span>
                      <span>Retry</span>
                    </button>
                  </div>
                  <p
                    v-if="model.analysisError"
                    class="text-[10px] text-orange-800 leading-snug break-words"
                    :title="model.analysisError"
                  >{{ model.analysisError.length > 220 ? model.analysisError.slice(0, 220) + '…' : model.analysisError }}</p>
                </div>

                <!-- Model Quality Score (if defect analysis has been run) -->
                <div
                  v-if="library.defectResults.value.has(model.id)"
                  class="flex items-center gap-2 px-4 py-1.5 border-b border-slate-100"
                  :class="qualityRowClass(library.defectResults.value.get(model.id)!.overallScore)"
                >
                  <span class="text-[10px] font-bold">
                    {{ qualityScoreLabel(library.defectResults.value.get(model.id)!.overallScore) }}
                  </span>
                  <span class="text-[10px]">Quality</span>
                  <span class="ml-auto text-[10px] font-bold tabular-nums">
                    {{ library.defectResults.value.get(model.id)!.overallScore }}/100
                  </span>
                </div>

                <!-- Card body -->
                <div class="flex-1 flex flex-col p-4 gap-3">
                  <p class="text-xs text-slate-600 leading-relaxed">{{ model.description }}</p>

                  <!-- Entry type counts -->
                  <div v-if="model.entries.length > 0" class="flex flex-wrap gap-1">
                    <template v-for="t in ENTRY_TYPES" :key="t">
                      <!-- DD-010: colour glyph replaces text letter badge -->
                      <span
                        v-if="countByType(model, t) > 0"
                        class="inline-flex items-center gap-0.5"
                        :title="`${countByType(model, t)} ${t === 'F' ? 'Function' : t === 'V' ? 'Value' : t === 'C' ? 'Constraint' : t === 'R' ? 'Resource' : 'Solution'} entries`"
                      >
                        <PlTypeBadge :entry-type="t" />
                        <span class="text-[10px] font-mono text-slate-500">×{{ countByType(model, t) }}</span>
                      </span>
                    </template>
                  </div>
                  <div v-else-if="model.source === 'user'" class="flex items-center gap-1">
                    <span class="text-[10px] text-slate-400 italic">
                      {{
                        model.analysisStatus === 'analysing'
                          ? 'Analysing text into Planguage…'
                          : model.analysisStatus === 'done'
                          ? 'Ready'
                          : 'Text model — not yet analysed'
                      }}
                    </span>
                  </div>

                  <!-- Stakeholder chips (max 3 + overflow) -->
                  <div v-if="model.stakeholders.length > 0" class="flex flex-wrap gap-1">
                    <span
                      v-for="(s, i) in model.stakeholders.slice(0, 3)"
                      :key="i"
                      class="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5"
                    >{{ s }}</span>
                    <span
                      v-if="model.stakeholders.length > 3"
                      class="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5"
                      :title="model.stakeholders.slice(3).join(', ')"
                    >+{{ model.stakeholders.length - 3 }} more</span>
                  </div>
                </div>

                <!-- Card footer -->
                <div class="px-4 pb-4 flex gap-2 items-center">
                  <button
                    type="button"
                    :class="[
                      'flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all duration-150',
                      model.categoryId === 'examples' && model.exampleSubCategory
                        ? CAT_BUTTON_CLASS[model.exampleSubCategory]
                        : 'bg-blue-600 hover:bg-blue-700',
                    ]"
                    :title="`View ${model.title} — browse Planguage entries and copy`"
                    @click="viewModel(model.id)"
                  >
                    View →
                  </button>
                  <button
                    v-if="model.source === 'user'"
                    type="button"
                    class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors duration-150 text-xs font-bold"
                    title="Delete this model — cannot be undone"
                    @click="library.removeUserEntry(model.id)"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </ScrollContainer>
        </template>

        <!-- MODE B: Bring in Models form -->
        <template v-else-if="mode === 'bring-in'">
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-6 max-w-2xl mx-auto w-full"
          >
            <!-- Back link -->
            <button
              type="button"
              class="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors duration-150 px-2 py-1 rounded hover:bg-slate-100 mb-6"
              title="Back to Model Library grid — discard this form"
              @click="mode = 'grid'"
            >
              ← Back to Library
            </button>

            <h3 class="text-base font-bold text-slate-800 mb-5">Bring in a Model</h3>

            <!-- Title -->
            <div class="flex flex-col gap-1.5 mb-4">
              <label class="text-xs font-semibold text-slate-600" for="bring-in-title">
                Title <span class="font-normal text-slate-400">(optional — AI will suggest from text)</span>
              </label>
              <input
                id="bring-in-title"
                v-model="bringInTitle"
                type="text"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="e.g. Customer Portal Strategy"
                title="Title for this model — leave blank for AI to suggest one from your text"
              />
            </div>

            <!-- Category dropdown -->
            <div class="flex flex-col gap-1.5 mb-4">
              <label class="text-xs font-semibold text-slate-600" for="bring-in-cat">
                Add to category
              </label>
              <select
                id="bring-in-cat"
                v-model="bringInCatId"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                title="Choose which category this model will appear in"
              >
                <option
                  v-for="cat in bringInCategoryOptions"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.emoji }} {{ cat.label }}
                </option>
              </select>
            </div>

            <!-- Model text -->
            <div class="flex flex-col gap-1.5 mb-4">
              <label class="text-xs font-semibold text-slate-600" for="bring-in-text">
                Model text
              </label>
              <p class="text-[11px] text-slate-400 -mt-1">
                Paste any text — strategy doc, spec, plan, rough notes — AI converts it to Planguage Function / Value / Constraint / Resource / Solution Specs.
              </p>
              <textarea
                id="bring-in-text"
                v-model="bringInText"
                rows="10"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono resize-y"
                placeholder="Paste your text here…"
                title="Paste any text — AI will convert it to structured Planguage entries"
              />
            </div>

            <!-- OR import from file -->
            <div class="flex items-center gap-3 mb-6">
              <div class="flex-1 h-px bg-slate-200" />
              <span class="text-xs text-slate-400">OR</span>
              <div class="flex-1 h-px bg-slate-200" />
            </div>
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg px-3 py-3 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-150 mb-6"
              :disabled="fileExtracting"
              title="Import from file — supports .txt, .md, and PDF files"
              @click="triggerUpload"
            >
              <span aria-hidden="true">{{ fileExtracting ? '⏳' : '📎' }}</span>
              <span>{{ fileExtracting ? 'Importing…' : 'Import from file (.txt, .md, .pdf)' }}</span>
            </button>
            <input
              ref="fileInputRef"
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              class="hidden"
              aria-label="Upload model file to import as text"
              @change="handleFileUpload"
            />

            <!-- Submit -->
            <button
              type="button"
              :disabled="!bringInText.trim()"
              :class="[
                'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all duration-150',
                bringInText.trim()
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed',
              ]"
              title="Analyse and Import — AI converts your text to Planguage entries and saves the model"
              @click="submitBringIn"
            >
              <span aria-hidden="true">▶</span>
              <span>Analyse &amp; Import</span>
            </button>
          </ScrollContainer>
        </template>

        <!-- MODE C: Detail view -->
        <template v-else-if="mode === 'detail' && selectedModel">
          <!-- Detail header -->
          <div class="flex items-center gap-3 px-5 py-3 bg-white border-b border-slate-200 shrink-0">
            <button
              type="button"
              class="shrink-0 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors duration-150 px-2 py-1 rounded hover:bg-slate-100"
              title="Back to model grid — return to category browser"
              @click="backToGrid"
            >
              ← Back
            </button>
            <div class="flex-1 min-w-0">
              <span class="text-sm font-bold text-slate-800 truncate block">{{ selectedModel.title }}</span>
              <span
                v-if="selectedModel.categoryId === 'examples' && selectedModel.exampleSubCategory"
                class="text-[10px] text-slate-400"
              >{{ getCatMeta(selectedModel.exampleSubCategory).emoji }} {{ getCatMeta(selectedModel.exampleSubCategory).label }}</span>
              <span v-else class="text-[10px] text-slate-400">
                {{ library.categoryDefs.value.find(c => c.id === selectedModel.categoryId)?.emoji }}
                {{ library.categoryDefs.value.find(c => c.id === selectedModel.categoryId)?.label }}
              </span>
            </div>
            <!-- Copy as colored HTML table — Colorful Exports Rule -->
            <button
              type="button"
              :class="[
                'shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                copiedToolExport
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ]"
              title="Copy Model — copies a colored HTML table of all Planguage entries; paste into Mail, Notes, Keynote etc."
              @click="copyToolExport"
            >
              <span aria-hidden="true">{{ copiedToolExport ? '✓' : '📋' }}</span>
              <span>{{ copiedToolExport ? 'Copied!' : 'Copy' }}</span>
            </button>
            <!-- Email via .eml draft -->
            <button
              type="button"
              class="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold
                     bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all duration-150"
              title="Email Model — opens Mail.app with this model's Planguage entries as a colored table pre-filled in the email body"
              @click="emailToolExport"
            >
              <span aria-hidden="true">📧</span>
              <span>Mail</span>
            </button>
          </div>

          <!-- Quality indicator in detail header -->
          <div
            v-if="currentDefectResult"
            class="flex items-center gap-3 px-4 py-2 border-b shrink-0"
            :class="qualityRowClass(currentDefectResult.overallScore)"
          >
            <span class="text-xs font-bold">{{ qualityScoreLabel(currentDefectResult.overallScore) }} — Quality Score</span>
            <span class="text-xs tabular-nums font-bold ml-auto">{{ currentDefectResult.overallScore }}/100</span>
            <span class="text-[10px]">{{ currentDefectResult.defects.length }} defects</span>
            <button
              type="button"
              class="text-[10px] underline ml-1"
              title="Open defect analysis for this model — view full breakdown of issues"
              @click="openTool('defect-analysis')"
            >View →</button>
          </div>

          <!-- Tool header bar — shown when a specific tool is open.
               Tom 2026-05-31: "I cannot see the name of the specific modelling tool here,
               this needs to be clear in every display or analysis (general design rule)"
               Tool name is now prominent (large bold, dark) with model name below. -->
          <div
            v-if="toolMode !== 'none' && selectedModel"
            class="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-900 shrink-0"
          >
            <button
              type="button"
              class="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 rounded px-2 py-1.5 transition-colors duration-150 shrink-0"
              title="Back to model detail — close this tool and return to the model entry view"
              @click="closeTool"
            >← Back</button>
            <!-- Prominent tool name + model sub-label -->
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-black text-white leading-tight">{{ TOOL_MODE_LABELS[toolMode] }}</h3>
              <p class="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{{ selectedModel.title }}</p>
            </div>
            <!-- Copy + Email export buttons — Tom 2026-05-31: "copy this display, email this display on all model displays" -->
            <button
              type="button"
              :class="[
                'shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                copiedToolExport
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-600 text-slate-200 hover:bg-slate-500',
              ]"
              :title="`Copy ${TOOL_MODE_LABELS[toolMode]} — copies a colored HTML table of this model's entries to clipboard`"
              @click="copyToolExport"
            >
              <span aria-hidden="true">{{ copiedToolExport ? '✓' : '📋' }}</span>
              {{ copiedToolExport ? 'Copied!' : 'Copy' }}
            </button>
            <button
              type="button"
              class="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
                     bg-slate-600 text-slate-200 hover:bg-slate-500 transition-colors"
              :title="`Email ${TOOL_MODE_LABELS[toolMode]} — opens Mail.app with this model's colored entry table pre-filled`"
              @click="emailToolExport"
            >
              <span aria-hidden="true">📧</span> Mail
            </button>
            <!-- v491 (2026-07-21) — Tom "closing radial sunburst did not go back
                 to previous state (choice of visualization) all close should revert
                 to state before it was opened".  Fixed: this CloseDot now RESTORES
                 the previous state (closes the current tool → returns to model
                 detail view with the "Specific Model Analysis Tools" dropdown
                 available), NOT destructively exits the whole Model Library.
                 The Model Library's OWN top-level CloseDot at line ~1046 handles
                 "exit Library entirely" — this sub-header CloseDot handles ONLY
                 "close this tool".  v484 initial ship emitted `close` which
                 was over-reach.  New universal rule banked: **CloseDot on any
                 sub-panel must revert to the state BEFORE that sub-panel opened,
                 never destructively skip past intermediate states.** -->
            <CloseDot
              variant="on-dark"
              size="lg"
              aria-label="Close this tool and return to the model detail view"
              title="Close — return to the model detail view (the Specific Model Analysis Tools menu).  To exit the Model Library entirely, use the CloseDot at the top of the Library panel."
              @click="closeTool"
            />
          </div>

          <!-- Batch Change Entries tool -->
          <ScrollContainer v-if="toolMode === 'edit-batch' && selectedModel" outer-class="flex-1 min-h-0 relative" inner-class="p-5 flex flex-col gap-4 max-w-2xl mx-auto w-full">
            <!-- Type filter chips -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-slate-600">Target entry types</label>
              <div class="flex gap-2 flex-wrap">
                <!-- DD-010: colour glyph filter buttons — ring shows selected state -->
                <button v-for="t in ENTRY_TYPES" :key="t" type="button"
                  :class="['inline-flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-150',
                           batchTypes.has(t) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-400']"
                  :title="`Toggle ${t === 'F' ? 'Function' : t === 'V' ? 'Value' : t === 'C' ? 'Constraint' : t === 'R' ? 'Resource' : 'Solution'}. entries — click to include or exclude from batch operation`"
                  @click="toggleBatchType(t)"><PlTypeBadge :entry-type="t" /></button>
              </div>
            </div>
            <!-- Keyword filter -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-slate-600">Keyword filter <span class="font-normal text-slate-400">(optional — matches description or details)</span></label>
              <input v-model="batchKeyword" type="text" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="e.g. 'quality' — leave blank to match all entries of selected types"
                title="Keyword filter — only entries containing this text will be affected" />
            </div>
            <!-- Action selector -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-slate-600">Action</label>
              <div class="flex gap-3">
                <label class="flex items-center gap-1.5 text-xs cursor-pointer" title="Replace matching entries with new text">
                  <input type="radio" v-model="batchAction" value="replace" class="text-blue-600" /> Replace text
                </label>
                <label class="flex items-center gap-1.5 text-xs cursor-pointer" title="Delete all matching entries from the model">
                  <input type="radio" v-model="batchAction" value="delete" class="text-red-600" /> Delete entries
                </label>
              </div>
            </div>
            <!-- Replace fields (only when action = replace) -->
            <template v-if="batchAction === 'replace'">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-bold text-slate-600">Replace with</label>
                <input v-model="batchNewText" type="text" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="New text to use for the matched entries"
                  title="Replacement text — this replaces the description or details of matched entries" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-bold text-slate-600">Apply to</label>
                <div class="flex gap-3">
                  <label v-for="s in [{v:'description',l:'Description'},{v:'details',l:'Details'},{v:'both',l:'Both'}]" :key="s.v"
                    class="flex items-center gap-1.5 text-xs cursor-pointer" :title="`Apply replacement to ${s.l.toLowerCase()} field of matched entries`">
                    <input type="radio" v-model="batchScope" :value="s.v" class="text-blue-600" /> {{ s.l }}
                  </label>
                </div>
              </div>
            </template>
            <!-- Preview -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <p class="text-xs font-bold text-slate-600">Preview <span class="font-normal text-slate-400">({{ batchMatchedEntries.length }} entries matched)</span></p>
              </div>
              <div v-if="batchMatchedEntries.length === 0" class="text-xs text-slate-400 italic py-2">No entries match the current filter</div>
              <ScrollContainer v-else outer-class="max-h-48 rounded-xl ring-1 ring-slate-200 bg-white" inner-class="flex flex-col gap-1.5 p-3">
                <div v-for="m in batchMatchedEntries" :key="m.idx" class="flex items-start gap-2 text-xs">
                  <PlTypeBadge :entry-type="m.entry.type" class="shrink-0 mt-0.5" show-label />
                  <span v-if="batchAction === 'delete'" class="text-red-600 line-through">{{ m.entry.description }}</span>
                  <template v-else>
                    <span class="text-slate-500 line-through truncate">{{ m.entry.description }}</span>
                    <span class="text-slate-300 mx-1 shrink-0">→</span>
                    <span class="text-slate-800 truncate">{{ batchNewText || '(empty)' }}</span>
                  </template>
                </div>
              </ScrollContainer>
            </div>
            <!-- Apply button -->
            <div class="flex items-center gap-3">
              <button type="button"
                :disabled="batchMatchedEntries.length === 0"
                :class="['flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150', batchMatchedEntries.length > 0 ? (batchAction === 'delete' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white') : 'bg-slate-100 text-slate-400 cursor-not-allowed']"
                :title="`Apply batch ${batchAction === 'delete' ? 'deletion' : 'replacement'} to ${batchMatchedEntries.length} entries`"
                @click="applyBatchChange">
                <span>{{ batchAction === 'delete' ? '🗑️' : '✓' }}</span>
                <span>{{ batchAction === 'delete' ? `Delete ${batchMatchedEntries.length} entries` : `Apply to ${batchMatchedEntries.length} entries` }}</span>
              </button>
              <p v-if="batchApplied" class="text-xs text-blue-700 font-medium">Changes applied ✓</p>
            </div>
          </ScrollContainer>

          <!-- Find & Replace tool -->
          <ScrollContainer v-if="toolMode === 'edit-replace' && selectedModel" outer-class="flex-1 min-h-0 relative" inner-class="p-5 flex flex-col gap-4 max-w-2xl mx-auto w-full">
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-bold text-slate-600">Find</label>
                <input v-model="findText" type="text" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="Text to search for…"
                  title="Text to find across all entry descriptions and details" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-bold text-slate-600">Replace with</label>
                <input v-model="replaceText" type="text" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="Replacement text…"
                  title="Text to substitute in place of the found text" />
              </div>
            </div>
            <div class="flex items-center gap-6">
              <div class="flex gap-3">
                <label v-for="s in [{v:'both',l:'All fields'},{v:'description',l:'Description only'},{v:'details',l:'Details only'}]" :key="s.v"
                  class="flex items-center gap-1.5 text-xs cursor-pointer" :title="`Search in ${s.l}`">
                  <input type="radio" v-model="findScope" :value="s.v" class="text-blue-600" /> {{ s.l }}
                </label>
              </div>
              <label class="flex items-center gap-1.5 text-xs cursor-pointer" title="Case-sensitive search — toggle to match exact capitalisation">
                <input type="checkbox" v-model="findCaseSensitive" class="text-blue-600 rounded" /> Case-sensitive
              </label>
            </div>
            <!-- Preview table -->
            <div v-if="findText.trim()" class="flex flex-col gap-2">
              <p class="text-xs font-bold text-slate-600">{{ findReplacePreview.length }} match{{ findReplacePreview.length === 1 ? '' : 'es' }} found</p>
              <div v-if="findReplacePreview.length === 0" class="text-xs text-slate-400 italic">No matches found for "{{ findText }}"</div>
              <ScrollContainer v-else outer-class="rounded-xl ring-1 ring-slate-200 bg-white max-h-64">
                <table class="w-full text-xs">
                  <thead class="bg-slate-50 border-b border-slate-200">
                    <tr><th class="px-3 py-2 text-left font-semibold text-slate-500">Field</th><th class="px-3 py-2 text-left font-semibold text-slate-500">Original</th><th class="px-3 py-2 text-left font-semibold text-slate-500">Result</th></tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="(ch, i) in findReplacePreview" :key="i">
                      <td class="px-3 py-2 text-slate-400 shrink-0 whitespace-nowrap">{{ ch.field }}</td>
                      <td class="px-3 py-2 text-orange-600 font-mono">{{ ch.original }}</td>
                      <td class="px-3 py-2 text-blue-700 font-mono">{{ ch.result }}</td>
                    </tr>
                  </tbody>
                </table>
              </ScrollContainer>
            </div>
            <div class="flex items-center gap-3">
              <button type="button"
                :disabled="findReplacePreview.length === 0"
                :class="['flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150', findReplacePreview.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed']"
                :title="`Apply ${findReplacePreview.length} replacements across all matched entries`"
                @click="applyFindReplace">
                ✓ Apply {{ findReplacePreview.length }} replacement{{ findReplacePreview.length === 1 ? '' : 's' }}
              </button>
              <p v-if="findReplaceApplied" class="text-xs text-blue-700 font-medium">Replacements applied ✓</p>
            </div>
          </ScrollContainer>

          <!-- Manual Edit List tool -->
          <ScrollContainer v-if="toolMode === 'edit-manual' && selectedModel" outer-class="flex-1 min-h-0 relative" inner-class="p-5 flex flex-col gap-4">
            <!-- Filters -->
            <div class="flex items-center gap-4 flex-wrap">
              <div class="flex gap-1.5">
                <!-- DD-010: colour glyph filter buttons -->
                <button v-for="t in ENTRY_TYPES" :key="t" type="button"
                  :class="['inline-flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-150',
                           editTypes.has(t) ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-400']"
                  :title="`Toggle ${t === 'F' ? 'Function' : t === 'V' ? 'Value' : t === 'C' ? 'Constraint' : t === 'R' ? 'Resource' : 'Solution'}. entries`"
                  @click="toggleEditType(t)"><PlTypeBadge :entry-type="t" /></button>
              </div>
              <input v-model="editKeyword" type="text" class="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="Filter by keyword…" title="Filter by keyword — only matching entries shown" />
            </div>
            <!-- Editable entry rows -->
            <div v-if="editFilteredEntries.length === 0" class="text-xs text-slate-400 italic py-4 text-center">No entries match the current filter</div>
            <div v-else class="flex flex-col gap-2">
              <div
                v-for="{idx, entry} in editFilteredEntries"
                :key="idx"
                class="flex flex-col gap-1.5 rounded-xl bg-white ring-1 ring-slate-200 px-4 py-3"
              >
                <div class="flex items-center gap-2 mb-1">
                  <PlTypeBadge :entry-type="entry.type" class="shrink-0" show-label />
                  <span class="text-[10px] text-slate-400">Entry {{ idx + 1 }}</span>
                </div>
                <input
                  :value="editDrafts.get(idx)?.description ?? entry.description"
                  type="text"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 transition font-medium"
                  placeholder="Entry description…"
                  :title="`Edit description for ${entry.type}. entry ${idx + 1}`"
                  @input="(e) => { const d = editDrafts.get(idx) ?? { description: entry.description, details: entry.details }; d.description = (e.target as HTMLInputElement).value; editDrafts.value = new Map(editDrafts.value.set(idx, d)) }"
                />
                <input
                  v-if="entry.details !== undefined || editDrafts.get(idx)?.details"
                  :value="editDrafts.get(idx)?.details ?? entry.details ?? ''"
                  type="text"
                  class="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-400 transition"
                  placeholder="Details (Scale · Goal · …)"
                  :title="`Edit details for ${entry.type}. entry ${idx + 1} — Scale, Goal, Tolerable etc.`"
                  @input="(e) => { const d = editDrafts.get(idx) ?? { description: entry.description, details: entry.details }; d.details = (e.target as HTMLInputElement).value || undefined; editDrafts.value = new Map(editDrafts.value.set(idx, d)) }"
                />
              </div>
            </div>
            <div class="flex items-center gap-3 sticky bottom-0 bg-slate-50/95 backdrop-blur py-3 -mx-5 px-5 border-t border-slate-200 mt-2">
              <button type="button"
                :class="['flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150', editFilteredEntries.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed']"
                :disabled="editFilteredEntries.length === 0"
                title="Save All — apply all edits to the model"
                @click="applyManualEdits">
                ✓ Save All Changes
              </button>
              <p v-if="editApplied" class="text-xs text-blue-700 font-medium">Changes saved ✓</p>
              <span class="ml-auto text-xs text-slate-400">{{ editFilteredEntries.length }} entries shown</span>
            </div>
          </ScrollContainer>

          <!-- Value Flow — v485: rendered by shared <PlanguageDiagram> component.
               Parent owns the scroll wrapper + scroll-% pill (r93t fallback); the
               component owns the SVG + drill-down + click-highlight + prefix-strip. -->
          <div
            v-if="toolMode === 'viz-flow' && selectedModel"
            ref="vizFlowScrollEl"
            class="flex-1 min-h-0 overflow-y-auto relative"
            @scroll="updateVizScrollPct('flow')"
          >
            <div
              v-if="vizFlowScrollPct < 100"
              class="pointer-events-none sticky top-2 float-right mr-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-800/80 text-white text-[10px] font-semibold px-2.5 py-1 shadow-md"
              :aria-label="`${vizFlowScrollPct}% of Value Flow diagram visible — scroll to see more`"
              title="Percentage of the Value Flow diagram currently visible — scroll down to reveal more"
            >
              <span aria-hidden="true">↕</span>
              <span>{{ vizFlowScrollPct }}% shown</span>
            </div>
            <div class="p-5">
              <PlanguageDiagram :model="selectedModel" mode="sankey-focus" />
            </div>
          </div>

          <!-- Strongly Related — v485: rendered by shared <PlanguageDiagram>. -->
          <div
            v-if="toolMode === 'viz-related' && selectedModel"
            ref="vizRelatedScrollEl"
            class="flex-1 min-h-0 overflow-y-auto relative"
            @scroll="updateVizScrollPct('related')"
          >
            <div
              v-if="vizRelatedScrollPct < 100"
              class="pointer-events-none sticky top-2 float-right mr-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-800/80 text-white text-[10px] font-semibold px-2.5 py-1 shadow-md"
              :aria-label="`${vizRelatedScrollPct}% of Strongly Related diagram visible — scroll to see more`"
              title="Percentage of the Strongly Related diagram currently visible — scroll down to reveal more"
            >
              <span aria-hidden="true">↕</span>
              <span>{{ vizRelatedScrollPct }}% shown</span>
            </div>
            <div class="p-5">
              <PlanguageDiagram :model="selectedModel" mode="strongly-related" />
            </div>
          </div>

          <!-- Isometric City — v486: pseudo-3D rotatable Planguage city.  Tom Gilb
               2026-07-20 verbatim "In my dreams it would be pseudo 3D, and visually
               rotatable" — same shared <PlanguageDiagram> engine, different mode. -->
          <div
            v-if="toolMode === 'viz-city' && selectedModel"
            ref="vizCityScrollEl"
            class="flex-1 min-h-0 overflow-y-auto relative"
            @scroll="updateVizScrollPct('city')"
          >
            <div
              v-if="vizCityScrollPct < 100"
              class="pointer-events-none sticky top-2 float-right mr-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-800/80 text-white text-[10px] font-semibold px-2.5 py-1 shadow-md"
              :aria-label="`${vizCityScrollPct}% of Isometric City visible — scroll to see more`"
              title="Percentage of the Isometric City visible — scroll down to reveal more"
            >
              <span aria-hidden="true">↕</span>
              <span>{{ vizCityScrollPct }}% shown</span>
            </div>
            <div class="p-5 pb-16 min-h-[720px] bg-gradient-to-b from-sky-50 via-white to-slate-100">
              <PlanguageDiagram :model="selectedModel" mode="isometric-city" />
            </div>
          </div>

          <!-- Radial Sunburst — v489 (Tom's design brief pick ②) — concentric rings. -->
          <div
            v-if="toolMode === 'viz-sun' && selectedModel"
            ref="vizSunScrollEl"
            class="flex-1 min-h-0 overflow-y-auto relative"
            @scroll="updateVizScrollPct('sun')"
          >
            <div
              v-if="vizSunScrollPct < 100"
              class="pointer-events-none sticky top-2 float-right mr-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-800/80 text-white text-[10px] font-semibold px-2.5 py-1 shadow-md"
              :aria-label="`${vizSunScrollPct}% of Radial Sunburst visible — scroll to see more`"
              title="Percentage of the Radial Sunburst visible — scroll down to reveal more"
            >
              <span aria-hidden="true">↕</span>
              <span>{{ vizSunScrollPct }}% shown</span>
            </div>
            <div class="p-5 pb-8 bg-gradient-to-br from-amber-50 via-white to-yellow-50">
              <PlanguageDiagram :model="selectedModel" mode="sunburst" />
            </div>
          </div>

          <!-- Constellation Map — v489 (Tom's design brief pick ④) — star clusters on dark bg. -->
          <div
            v-if="toolMode === 'viz-star' && selectedModel"
            ref="vizStarScrollEl"
            class="flex-1 min-h-0 overflow-y-auto relative bg-slate-950"
            @scroll="updateVizScrollPct('star')"
          >
            <div
              v-if="vizStarScrollPct < 100"
              class="pointer-events-none sticky top-2 float-right mr-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-100/90 text-slate-900 text-[10px] font-semibold px-2.5 py-1 shadow-md"
              :aria-label="`${vizStarScrollPct}% of Constellation Map visible — scroll to see more`"
              title="Percentage of the Constellation Map visible — scroll down to reveal more"
            >
              <span aria-hidden="true">↕</span>
              <span>{{ vizStarScrollPct }}% shown</span>
            </div>
            <div class="p-5 pb-8">
              <PlanguageDiagram :model="selectedModel" mode="constellation" />
            </div>
          </div>

          <!-- Focus + Context — v490 (Tom's design brief pick ①) — sankey layout with fade-unrelated on click -->
          <div
            v-if="toolMode === 'viz-focus' && selectedModel"
            ref="vizFocusScrollEl"
            class="flex-1 min-h-0 overflow-y-auto relative"
            @scroll="updateVizScrollPct('focus')"
          >
            <div
              v-if="vizFocusScrollPct < 100"
              class="pointer-events-none sticky top-2 float-right mr-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-800/80 text-white text-[10px] font-semibold px-2.5 py-1 shadow-md"
              :aria-label="`${vizFocusScrollPct}% of Focus + Context visible — scroll to see more`"
              title="Percentage of Focus + Context visible — scroll down to reveal more"
            >
              <span aria-hidden="true">↕</span>
              <span>{{ vizFocusScrollPct }}% shown</span>
            </div>
            <div class="p-5">
              <PlanguageDiagram :model="selectedModel" mode="focus-context" />
            </div>
          </div>

          <!-- Layered Accordion — v490 (Tom's design brief pick ⑤) — 5 horizontal stripes -->
          <div
            v-if="toolMode === 'viz-accordion' && selectedModel"
            ref="vizAccordionScrollEl"
            class="flex-1 min-h-0 overflow-y-auto relative"
            @scroll="updateVizScrollPct('accordion')"
          >
            <div
              v-if="vizAccordionScrollPct < 100"
              class="pointer-events-none sticky top-2 float-right mr-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-800/80 text-white text-[10px] font-semibold px-2.5 py-1 shadow-md"
              :aria-label="`${vizAccordionScrollPct}% of Layered Accordion visible — scroll to see more`"
              title="Percentage of Layered Accordion visible — scroll down to reveal more"
            >
              <span aria-hidden="true">↕</span>
              <span>{{ vizAccordionScrollPct }}% shown</span>
            </div>
            <div class="p-5 pb-8 bg-gradient-to-b from-white via-slate-50 to-white">
              <PlanguageDiagram :model="selectedModel" mode="layered-accordion" />
            </div>
          </div>

          <!-- Focus Ring — v490 (Tom's design brief pick ⑥) — chosen node at centre + concentric neighbours -->
          <div
            v-if="toolMode === 'viz-ring' && selectedModel"
            ref="vizRingScrollEl"
            class="flex-1 min-h-0 overflow-y-auto relative"
            @scroll="updateVizScrollPct('ring')"
          >
            <div
              v-if="vizRingScrollPct < 100"
              class="pointer-events-none sticky top-2 float-right mr-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-800/80 text-white text-[10px] font-semibold px-2.5 py-1 shadow-md"
              :aria-label="`${vizRingScrollPct}% of Focus Ring visible — scroll to see more`"
              title="Percentage of Focus Ring visible — scroll down to reveal more"
            >
              <span aria-hidden="true">↕</span>
              <span>{{ vizRingScrollPct }}% shown</span>
            </div>
            <div class="p-5 pb-8 bg-gradient-radial from-blue-50 to-white">
              <PlanguageDiagram :model="selectedModel" mode="focus-ring" />
            </div>
          </div>

          <!-- Time Ribbon — v490 (Tom's design brief pick ⑧) — horizontal timeline lanes -->
          <div
            v-if="toolMode === 'viz-ribbon' && selectedModel"
            ref="vizRibbonScrollEl"
            class="flex-1 min-h-0 overflow-y-auto relative"
            @scroll="updateVizScrollPct('ribbon')"
          >
            <div
              v-if="vizRibbonScrollPct < 100"
              class="pointer-events-none sticky top-2 float-right mr-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-800/80 text-white text-[10px] font-semibold px-2.5 py-1 shadow-md"
              :aria-label="`${vizRibbonScrollPct}% of Time Ribbon visible — scroll to see more`"
              title="Percentage of Time Ribbon visible — scroll down to reveal more"
            >
              <span aria-hidden="true">↕</span>
              <span>{{ vizRibbonScrollPct }}% shown</span>
            </div>
            <div class="p-5 pb-8 bg-gradient-to-r from-white via-slate-50 to-white">
              <p class="text-[10px] text-slate-500 italic mb-2">
                Time Ribbon: entries plotted left-to-right per lane.  Real time positions arrive when r93jjj Qualifiers Phase 2 populates temporal Qualifiers per entry; MVP uses entry index order.
              </p>
              <PlanguageDiagram :model="selectedModel" mode="time-ribbon" />
            </div>
          </div>

          <!-- ── 3D MODEL VIEW — v482: same r93t fallback -->
          <div
            v-if="toolMode === 'viz-3d' && selectedModel"
            ref="viz3dScrollEl"
            class="flex-1 min-h-0 overflow-y-auto relative"
            @scroll="updateVizScrollPct('3d')"
          >
            <div
              v-if="viz3dScrollPct < 100"
              class="pointer-events-none sticky top-2 float-right mr-2 z-10 inline-flex items-center gap-1 rounded-full bg-slate-800/80 text-white text-[10px] font-semibold px-2.5 py-1 shadow-md"
              :aria-label="`${viz3dScrollPct}% of 3D Model View visible — scroll to see more`"
              title="Percentage of the 3D Model View currently visible — scroll down to reveal more"
            >
              <span aria-hidden="true">↕</span>
              <span>{{ viz3dScrollPct }}% shown</span>
            </div>
            <div class="p-5 flex flex-col gap-4">
            <!-- Header controls -->
            <div class="flex items-center gap-3 flex-wrap">
              <!-- Title + model name -->
              <div class="flex items-center gap-2 min-w-0">
                <h3 class="text-sm font-bold text-slate-800 shrink-0">
                  {{ vizRenderMode === '3d' ? '🧊 3D View' : vizRenderMode === '2d-simple' ? '📐 2D Simple' : '🎨 2D Colored' }}
                </h3>
                <span class="text-xs text-slate-500 truncate">{{ selectedModel.title }}</span>
              </div>

              <!-- Render mode selector: [🧊 3D] [📐 Simple] [🎨 Colored] -->
              <div class="flex gap-1 shrink-0">
                <button type="button"
                  v-for="opt in ([
                    { mode: '3d',         label: '🧊 3D',      tip: '3D cube view — each face shows one Planguage entry type; rotate or stay static' },
                    { mode: '2d-simple',  label: '📐 Simple',  tip: '2D Simple — minimalist node map on dark canvas, grouped by entry type in columns' },
                    { mode: '2d-colored', label: '🎨 Colored', tip: '2D Colored — Kanban column board, one column per Planguage entry type, light background' },
                  ] as { mode: VizRenderMode; label: string; tip: string }[])"
                  :key="opt.mode"
                  :class="['text-[10px] px-2 py-1 rounded font-semibold transition-colors', vizRenderMode === opt.mode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']"
                  :title="opt.tip"
                  @click="vizRenderMode = opt.mode"
                >{{ opt.label }}</button>
              </div>

              <!-- 3D-only controls -->
              <div v-if="vizRenderMode === '3d'" class="ml-auto flex items-center gap-2 shrink-0">
                <!-- Level of detail -->
                <div class="flex gap-1">
                  <button
                    v-for="lvl in (['Top', 'Medium', 'All'] as const)"
                    :key="lvl"
                    type="button"
                    :class="['text-[10px] px-2 py-1 rounded font-semibold transition-colors', viz3dLevel === lvl ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']"
                    :title="`${lvl} level of detail — ${lvl === 'Top' ? 'Function entries only' : lvl === 'Medium' ? 'Function + Value + Stakeholders' : 'All entry types'}`"
                    @click="viz3dLevel = lvl"
                  >{{ lvl }}</button>
                </div>
                <!-- Rotate toggle -->
                <button
                  type="button"
                  :class="['text-[10px] px-2 py-1 rounded font-semibold transition-colors', viz3dRotating ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']"
                  :title="viz3dRotating ? 'Pause rotation — freeze the 3D cube in place' : 'Start rotation — auto-rotate the 3D model cube at 0.5° per frame'"
                  @click="viz3dRotating = !viz3dRotating"
                >{{ viz3dRotating ? '⏸ Pause' : '▶ Rotate' }}</button>
              </div>
            </div>

            <!-- ── 3D stage (only in 3D render mode) ──────────────────────────── -->
            <div v-if="vizRenderMode === '3d'" class="relative w-full flex items-center justify-center bg-slate-900 rounded-xl overflow-hidden" style="height:420px">
              <div style="perspective:900px; perspective-origin:50% 40%;">
                <div
                  :style="{
                    transformStyle: 'preserve-3d',
                    transform: `rotateX(-18deg) rotateY(${viz3dAngle}deg)`,
                    transition: viz3dRotating ? 'none' : 'transform 0.4s ease',
                    width: '280px',
                    height: '280px',
                    position: 'relative',
                  }"
                >
                  <!-- Face: FRONT — Functions (F) -->
                  <div :style="faceStyle('translateZ(140px)')" class="flex flex-col items-center justify-center gap-1 bg-orange-900/80 border border-orange-500/40">
                    <p class="text-[9px] font-bold text-orange-300 uppercase tracking-widest mb-1">Functions</p>
                    <div
                      v-for="(e, i) in viz3dFEntries.slice(0, 6)"
                      :key="i"
                      class="w-full px-2 py-0.5 rounded text-[8px] text-orange-100 bg-orange-800/50 truncate text-center"
                    >
                      {{ e.description.slice(0, 30) }}
                    </div>
                    <p v-if="viz3dFEntries.length > 6" class="text-[8px] text-orange-400">+{{ viz3dFEntries.length - 6 }} more</p>
                  </div>
                  <!-- Face: BACK — Stakeholders (S) -->
                  <div :style="faceStyle('rotateY(180deg) translateZ(140px)')" class="flex flex-col items-center justify-center gap-1 bg-violet-900/80 border border-violet-500/40">
                    <p class="text-[9px] font-bold text-violet-300 uppercase tracking-widest mb-1">Stakeholders</p>
                    <div
                      v-for="(e, i) in viz3dSEntries.slice(0, 6)"
                      :key="i"
                      class="w-full px-2 py-0.5 rounded text-[8px] text-violet-100 bg-violet-800/50 truncate text-center"
                    >
                      {{ e.description.slice(0, 30) }}
                    </div>
                    <p v-if="viz3dSEntries.length > 6" class="text-[8px] text-violet-400">+{{ viz3dSEntries.length - 6 }} more</p>
                  </div>
                  <!-- Face: RIGHT — Values (V) -->
                  <div :style="faceStyle('rotateY(90deg) translateZ(140px)')" class="flex flex-col items-center justify-center gap-1 bg-blue-900/80 border border-blue-500/40">
                    <p class="text-[9px] font-bold text-blue-300 uppercase tracking-widest mb-1">Values</p>
                    <div
                      v-for="(e, i) in viz3dVEntries.slice(0, 6)"
                      :key="i"
                      class="w-full px-2 py-0.5 rounded text-[8px] text-blue-100 bg-blue-800/50 truncate text-center"
                    >
                      {{ e.description.slice(0, 30) }}
                    </div>
                    <p v-if="viz3dVEntries.length > 6" class="text-[8px] text-blue-400">+{{ viz3dVEntries.length - 6 }} more</p>
                  </div>
                  <!-- Face: LEFT — Constraints (C) -->
                  <div :style="faceStyle('rotateY(-90deg) translateZ(140px)')" class="flex flex-col items-center justify-center gap-1 bg-fuchsia-900/80 border border-fuchsia-500/40">
                    <p class="text-[9px] font-bold text-fuchsia-300 uppercase tracking-widest mb-1">Constraints</p>
                    <div
                      v-for="(e, i) in viz3dCEntries.slice(0, 6)"
                      :key="i"
                      class="w-full px-2 py-0.5 rounded text-[8px] text-fuchsia-100 bg-fuchsia-800/50 truncate text-center"
                    >
                      {{ e.description.slice(0, 30) }}
                    </div>
                    <p v-if="viz3dCEntries.length > 6" class="text-[8px] text-fuchsia-400">+{{ viz3dCEntries.length - 6 }} more</p>
                  </div>
                  <!-- Face: TOP — Resources (R) -->
                  <div :style="faceStyle('rotateX(90deg) translateZ(140px)')" class="flex flex-col items-center justify-center gap-1 bg-sky-900/80 border border-sky-500/40">
                    <p class="text-[9px] font-bold text-sky-300 uppercase tracking-widest mb-1">Resources</p>
                    <div
                      v-for="(e, i) in viz3dREntries.slice(0, 4)"
                      :key="i"
                      class="w-full px-2 py-0.5 rounded text-[8px] text-sky-100 bg-sky-800/50 truncate text-center"
                    >
                      {{ e.description.slice(0, 30) }}
                    </div>
                    <p v-if="viz3dREntries.length > 4" class="text-[8px] text-sky-400">+{{ viz3dREntries.length - 4 }} more</p>
                  </div>
                  <!-- Face: BOTTOM — Summary -->
                  <div :style="faceStyle('rotateX(-90deg) translateZ(140px)')" class="flex flex-col items-center justify-center gap-2 bg-slate-800/80 border border-slate-600/40">
                    <p class="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Model Summary</p>
                    <p class="text-[8px] text-slate-400 text-center px-2">
                      {{ selectedModel.entries.length }} entries across
                      {{ [viz3dFEntries.length > 0 && 'F', viz3dVEntries.length > 0 && 'V', viz3dCEntries.length > 0 && 'C', viz3dREntries.length > 0 && 'R', viz3dSEntries.length > 0 && 'S'].filter(Boolean).length }} types
                    </p>
                  </div>
                </div>
              </div>
              <!-- Level hint overlay -->
              <div class="absolute bottom-3 left-3 flex gap-2">
                <span v-if="viz3dLevel === 'Top'" class="text-[9px] text-slate-400 bg-slate-800/80 rounded px-2 py-1">Showing: Functions face</span>
                <span v-else-if="viz3dLevel === 'Medium'" class="text-[9px] text-slate-400 bg-slate-800/80 rounded px-2 py-1">Showing: Function · Value · Solution faces</span>
                <span v-else class="text-[9px] text-slate-400 bg-slate-800/80 rounded px-2 py-1">Showing: All 5 entry types</span>
              </div>
            </div>

            <!-- Entry counts legend (3D level-aware) -->
            <div v-if="vizRenderMode === '3d'" class="flex flex-wrap gap-2 text-[10px]">
              <span class="px-2 py-1 rounded bg-orange-100 text-orange-800">{{ viz3dFEntries.length }} Functions</span>
              <span v-if="viz3dLevel !== 'Top'" class="px-2 py-1 rounded bg-blue-100 text-blue-800">{{ viz3dVEntries.length }} Values</span>
              <span v-if="viz3dLevel === 'All'" class="px-2 py-1 rounded bg-fuchsia-100 text-fuchsia-800">{{ viz3dCEntries.length }} Constraints</span>
              <span v-if="viz3dLevel === 'All'" class="px-2 py-1 rounded bg-sky-100 text-sky-800">{{ viz3dREntries.length }} Resources</span>
              <span v-if="viz3dLevel !== 'Top'" class="px-2 py-1 rounded bg-violet-100 text-violet-800">{{ viz3dSEntries.length }} Stakeholders</span>
            </div>

            <!-- ── 2D Simple: dark node-map (5 type columns, same canvas feel as 3D) -->
            <template v-if="vizRenderMode === '2d-simple'">
              <div class="relative w-full bg-slate-900 rounded-xl overflow-hidden flex gap-2 p-4" style="min-height:380px">
                <div
                  v-for="col in VIZ2D_COLS"
                  :key="col.type"
                  class="flex-1 flex flex-col gap-1 min-w-0"
                >
                  <!-- Column type header -->
                  <div class="flex items-center gap-1.5 mb-1">
                    <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: VIZ2D_DOT[col.type] }" />
                    <span class="text-[9px] font-bold uppercase tracking-widest truncate" :style="{ color: VIZ2D_DOT[col.type] }">{{ col.label }}</span>
                  </div>
                  <!-- Entry count badge -->
                  <span class="text-[8px] text-slate-500 mb-0.5">{{ viz2dEntries(col.type).length }} entries</span>
                  <!-- Entry nodes -->
                  <div
                    v-for="(entry, i) in viz2dEntries(col.type).slice(0, 12)"
                    :key="entry.id ?? i"
                    class="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] leading-tight text-slate-200 bg-slate-800/70 border border-slate-700/50 truncate"
                    :title="entry.description"
                  >
                    <span class="inline-block w-1.5 h-1.5 rounded-full shrink-0 opacity-80" :style="{ background: VIZ2D_DOT[col.type] }" />
                    <span class="truncate">{{ entry.description.slice(0, 32) }}</span>
                  </div>
                  <p v-if="viz2dEntries(col.type).length > 12" class="text-[8px] mt-0.5" :style="{ color: VIZ2D_DOT[col.type] + 'aa' }">+{{ viz2dEntries(col.type).length - 12 }} more</p>
                </div>
              </div>
              <!-- Simple entry count legend -->
              <div class="flex flex-wrap gap-2 text-[10px]">
                <span v-for="col in VIZ2D_COLS" :key="col.type" :class="['px-2 py-1 rounded', col.badge]">
                  {{ col.type }}. {{ viz2dEntries(col.type).length }}
                </span>
              </div>
            </template>

            <!-- ── 2D Colored: Kanban column board (light bg, card-per-entry) ────── -->
            <template v-if="vizRenderMode === '2d-colored'">
              <div class="flex gap-3 overflow-x-auto pb-2" style="min-height:380px">
                <div
                  v-for="col in VIZ2D_COLS"
                  :key="col.type"
                  :class="['flex flex-col gap-1.5 rounded-xl border p-3 min-w-[160px] max-w-[200px]', col.bg, col.border]"
                  style="flex: 1 1 160px;"
                >
                  <!-- Column header -->
                  <div class="flex items-center justify-between mb-1">
                    <span :class="['text-[10px] font-bold uppercase tracking-wide', col.badge.split(' ').find((c: string) => c.startsWith('text-')) ?? 'text-slate-700']">{{ col.label }}</span>
                    <span :class="['text-[10px] font-bold px-1.5 py-0.5 rounded-full', col.badge]">{{ viz2dEntries(col.type).length }}</span>
                  </div>
                  <!-- Entry cards -->
                  <div
                    v-for="(entry, i) in viz2dEntries(col.type).slice(0, 15)"
                    :key="entry.id ?? i"
                    :class="['px-2 py-1.5 rounded-lg border text-[10px] leading-tight text-slate-700 bg-white/70 shadow-sm', col.border]"
                    :title="entry.description"
                  >
                    <div class="flex items-start gap-1">
                      <span class="inline-block w-1.5 h-1.5 rounded-full mt-0.5 shrink-0" :style="{ background: VIZ2D_DOT[col.type] }" />
                      <span>{{ entry.description.slice(0, 48) }}</span>
                    </div>
                  </div>
                  <p v-if="viz2dEntries(col.type).length > 15" :class="['text-[9px] font-semibold mt-1', col.badge.split(' ').find((c: string) => c.startsWith('text-')) ?? 'text-slate-600']">+{{ viz2dEntries(col.type).length - 15 }} more</p>
                </div>
              </div>
            </template>
            </div>
          </div>

          <!-- Sharpen tool mode -->
          <ScrollContainer v-if="toolMode === 'sharpen' && selectedModel && selectedModel.source === 'user'" outer-class="flex-1 min-h-0 relative" inner-class="p-5 max-w-2xl mx-auto w-full flex flex-col gap-3">
            <p class="text-xs text-slate-500">Apply AI improvement commands to refine this model's Planguage entries.</p>
            <!-- Quick pills -->
            <div class="flex flex-wrap gap-2">
              <button v-for="pill in SHARPEN_PILLS" :key="pill" type="button"
                :class="['text-xs rounded-full px-3 py-1.5 font-medium transition-colors duration-150 border', sharpenCommand === pill ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600']"
                :title="`${pill} — click to fill the command box, then press Sharpen to apply`"
                @click="fillSharpenPill(pill)">{{ pill }}</button>
            </div>
            <div class="flex gap-2">
              <input v-model="sharpenCommand" type="text" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 transition"
                placeholder="Or type a custom improvement command…"
                title="Improvement command — describe how to improve this model, then click Sharpen"
                @keydown.enter="runSharpen" />
              <button type="button"
                :disabled="sharpenLoading || !sharpenCommand.trim()"
                :class="['shrink-0 flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150', sharpenLoading || !sharpenCommand.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white']"
                title="Sharpen — apply the improvement command to this model using AI"
                @click="runSharpen">
                <span>{{ sharpenLoading ? '⏳' : '▶' }}</span>
                <span>{{ sharpenLoading ? 'Improving…' : 'Sharpen' }}</span>
              </button>
            </div>
            <p v-if="sharpenSuccess" class="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">Model sharpened ✓</p>
            <p v-else-if="sharpenError" class="text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2">{{ sharpenError }}</p>
            <p v-if="selectedModel.source !== 'user'" class="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Sharpen is only available for user-added models. Built-in examples cannot be modified.</p>
          </ScrollContainer>

          <!-- ── DEFECT ANALYSIS TOOL ──────────────────────────────────────────── -->
          <ScrollContainer
            v-if="toolMode === 'defect-analysis' && selectedModel"
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-5 flex flex-col gap-5"
          >
            <!-- Boundary type selector -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-slate-600">Declared System Boundary</label>
              <p class="text-[11px] text-slate-400 -mt-1">Select the scope of this model. Entries that belong outside this boundary will be flagged as violations.</p>
              <div class="grid grid-cols-5 gap-2">
                <button
                  v-for="bt in BOUNDARY_TYPES"
                  :key="bt.id"
                  type="button"
                  :class="[
                    'flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-[10px] font-semibold border-2 transition-all duration-150',
                    defectBoundaryType === bt.id
                      ? BOUNDARY_HEADER_CLASS[bt.id] + ' ring-2 ring-offset-1'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400',
                  ]"
                  :title="`${bt.label} — ${bt.description}`"
                  @click="defectBoundaryType = bt.id"
                >
                  <span class="text-xl" aria-hidden="true">{{ bt.emoji }}</span>
                  <span class="text-center leading-tight">{{ bt.label }}</span>
                </button>
              </div>
              <p class="text-[10px] text-slate-500 italic">{{ BOUNDARY_TYPES.find(b => b.id === defectBoundaryType)?.description }}</p>
            </div>

            <!-- Run button -->
            <div class="flex items-center gap-3">
              <button
                type="button"
                :disabled="defectRunning"
                :class="[
                  'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150',
                  defectRunning ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white',
                ]"
                title="Run Defect Analysis — AI analyses this model for inconsistencies, missing elements, and boundary violations"
                @click="runDefectAnalysis"
              >
                <span aria-hidden="true">{{ defectRunning ? '⏳' : '🔬' }}</span>
                <span>{{ defectRunning ? 'Analysing…' : 'Run Defect Analysis' }}</span>
              </button>
              <p v-if="defectError" class="text-xs text-orange-600">{{ defectError }}</p>
            </div>

            <!-- ── Elegant Boundary Diagram ────────────────────────────────────── -->
            <div v-if="currentDefectResult" class="flex flex-col gap-3">
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">System Boundary Diagram</h3>
              <div class="rounded-2xl bg-slate-900 p-4 flex flex-col items-center">
                <svg viewBox="0 0 560 420" class="w-full max-w-xl" xmlns="http://www.w3.org/2000/svg" role="img" :aria-label="`Boundary diagram for ${selectedModel.title} — ${defectBoundaryType} scope`">
                  <!-- Background -->
                  <rect width="560" height="420" fill="#0f172a" rx="12" />

                  <!-- Universe ring (outermost) -->
                  <circle cx="280" cy="220" r="190"
                    :fill="currentDefectResult.boundaryType === 'universe' ? '#1e1b4b' : '#0f172a'"
                    :stroke="currentDefectResult.boundaryType === 'universe' ? '#7c3aed' : '#312e81'"
                    :stroke-width="currentDefectResult.boundaryType === 'universe' ? 3 : 1"
                    stroke-dasharray="6 3"
                  />
                  <text x="280" y="38" text-anchor="middle" font-size="9" fill="#7c3aed" font-weight="600" opacity="0.9">🌌 UNIVERSE</text>

                  <!-- International ring -->
                  <circle cx="280" cy="220" r="155"
                    :fill="currentDefectResult.boundaryType === 'international' ? '#1e1b4b' : 'transparent'"
                    :stroke="currentDefectResult.boundaryType === 'international' ? '#4338ca' : '#3730a3'"
                    :stroke-width="currentDefectResult.boundaryType === 'international' ? 2.5 : 1"
                    stroke-dasharray="5 3"
                  />
                  <text x="280" y="72" text-anchor="middle" font-size="9" fill="#6366f1" font-weight="600" opacity="0.9">🌐 INTERNATIONAL</text>

                  <!-- National ring -->
                  <circle cx="280" cy="220" r="118"
                    :fill="currentDefectResult.boundaryType === 'national' ? '#172554' : 'transparent'"
                    :stroke="currentDefectResult.boundaryType === 'national' ? '#2563eb' : '#1e40af'"
                    :stroke-width="currentDefectResult.boundaryType === 'national' ? 2.5 : 1"
                    stroke-dasharray="4 3"
                  />
                  <text x="280" y="107" text-anchor="middle" font-size="9" fill="#60a5fa" font-weight="600" opacity="0.9">🌍 NATIONAL</text>

                  <!-- Product Line ring -->
                  <circle cx="280" cy="220" r="82"
                    :fill="currentDefectResult.boundaryType === 'product-line' ? '#1c1003' : 'transparent'"
                    :stroke="currentDefectResult.boundaryType === 'product-line' ? '#d97706' : '#92400e'"
                    :stroke-width="currentDefectResult.boundaryType === 'product-line' ? 2.5 : 1"
                    stroke-dasharray="3 3"
                  />
                  <text x="280" y="143" text-anchor="middle" font-size="9" fill="#fbbf24" font-weight="600" opacity="0.9">📦 PRODUCT LINE</text>

                  <!-- Our Org ring -->
                  <circle cx="280" cy="220" r="50"
                    :fill="currentDefectResult.boundaryType === 'our-org' ? '#172554' : 'transparent'"
                    :stroke="currentDefectResult.boundaryType === 'our-org' ? '#2563eb' : '#1e40af'"
                    :stroke-width="currentDefectResult.boundaryType === 'our-org' ? 2.5 : 1"
                  />
                  <text x="280" y="173" text-anchor="middle" font-size="9" fill="#60a5fa" font-weight="600" opacity="0.9">🏢 OUR ORG</text>

                  <!-- System Core (center) -->
                  <circle cx="280" cy="220" r="26" fill="#1e293b" stroke="#94a3b8" stroke-width="1.5" />
                  <text x="280" y="216" text-anchor="middle" font-size="7" fill="#e2e8f0" font-weight="700">
                    {{ selectedModel.title.slice(0, 12) }}{{ selectedModel.title.length > 12 ? '…' : '' }}
                  </text>
                  <text x="280" y="225" text-anchor="middle" font-size="6" fill="#94a3b8">SYSTEM</text>

                  <!-- In-boundary entry dots (blue, inside the selected ring) -->
                  <template v-for="(idx, i) in currentDefectResult.inBoundaryIndices.slice(0, 12)" :key="`in-${idx}`">
                    <circle
                      :cx="280 + (30 + (i % 4) * 10) * Math.cos((i * 67 * Math.PI) / 180)"
                      :cy="220 + (30 + (i % 4) * 10) * Math.sin((i * 67 * Math.PI) / 180)"
                      r="5"
                      fill="#2563eb"
                      opacity="0.9"
                      :title="`In-boundary: ${selectedModel.entries[idx]?.type ?? '?'}. ${selectedModel.entries[idx]?.description ?? ''}`"
                    />
                    <text
                      :x="280 + (30 + (i % 4) * 10) * Math.cos((i * 67 * Math.PI) / 180)"
                      :y="220 + (30 + (i % 4) * 10) * Math.sin((i * 67 * Math.PI) / 180) + 3.5"
                      text-anchor="middle" font-size="5" fill="#0f172a" font-weight="700"
                    >{{ selectedModel.entries[idx]?.type ?? '' }}</text>
                  </template>

                  <!-- Out-of-boundary dots (orange, OUTSIDE the selected ring) -->
                  <template v-for="(idx, i) in currentDefectResult.outOfBoundaryIndices.slice(0, 8)" :key="`out-${idx}`">
                    <circle
                      :cx="280 + (currentDefectResult.boundaryType === 'our-org' ? 68 : currentDefectResult.boundaryType === 'product-line' ? 100 : currentDefectResult.boundaryType === 'national' ? 136 : currentDefectResult.boundaryType === 'international' ? 172 : 200) * Math.cos((i * 45 * Math.PI) / 180)"
                      :cy="220 + (currentDefectResult.boundaryType === 'our-org' ? 68 : currentDefectResult.boundaryType === 'product-line' ? 100 : currentDefectResult.boundaryType === 'national' ? 136 : currentDefectResult.boundaryType === 'international' ? 172 : 200) * Math.sin((i * 45 * Math.PI) / 180)"
                      r="6"
                      fill="#f97316"
                      opacity="0.9"
                    />
                    <text
                      :x="280 + (currentDefectResult.boundaryType === 'our-org' ? 68 : currentDefectResult.boundaryType === 'product-line' ? 100 : currentDefectResult.boundaryType === 'national' ? 136 : currentDefectResult.boundaryType === 'international' ? 172 : 200) * Math.cos((i * 45 * Math.PI) / 180)"
                      :y="220 + (currentDefectResult.boundaryType === 'our-org' ? 68 : currentDefectResult.boundaryType === 'product-line' ? 100 : currentDefectResult.boundaryType === 'national' ? 136 : currentDefectResult.boundaryType === 'international' ? 172 : 200) * Math.sin((i * 45 * Math.PI) / 180) + 3.5"
                      text-anchor="middle" font-size="5" fill="white" font-weight="700"
                    >{{ selectedModel.entries[idx]?.type ?? '?' }}</text>
                  </template>

                  <!-- ⚠ violation warning triangle (if any out-of-boundary) -->
                  <text v-if="currentDefectResult.outOfBoundaryIndices.length > 0" x="500" y="50" font-size="18" fill="#f97316">⚠</text>
                  <text v-if="currentDefectResult.outOfBoundaryIndices.length > 0" x="500" y="65" text-anchor="middle" font-size="8" fill="#f97316">{{ currentDefectResult.outOfBoundaryIndices.length }} violation{{ currentDefectResult.outOfBoundaryIndices.length === 1 ? '' : 's' }}</text>

                  <!-- Legend -->
                  <circle cx="30" cy="390" r="4" fill="#2563eb" />
                  <text x="38" y="394" font-size="8" fill="#94a3b8">In boundary</text>
                  <circle cx="110" cy="390" r="4" fill="#f97316" />
                  <text x="118" y="394" font-size="8" fill="#94a3b8">Out of boundary</text>
                  <text x="280" y="394" text-anchor="middle" font-size="8" fill="#475569">Boundary: {{ BOUNDARY_TYPES.find(b => b.id === currentDefectResult.boundaryType)?.label }}</text>
                  <text x="530" y="394" text-anchor="middle" font-size="8" :fill="currentDefectResult.overallScore >= 80 ? '#2563eb' : currentDefectResult.overallScore >= 60 ? '#fbbf24' : '#f97316'">Score: {{ currentDefectResult.overallScore }}/100</text>
                </svg>
              </div>

              <!-- Summary -->
              <div :class="['rounded-xl px-4 py-3 text-sm border', currentDefectResult.overallScore >= 80 ? 'bg-blue-50 border-blue-200 text-blue-800' : currentDefectResult.overallScore >= 60 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-orange-50 border-orange-200 text-orange-800']">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-bold text-lg">{{ currentDefectResult.overallScore }}/100</span>
                  <span class="text-xs font-semibold">Model Health Score</span>
                </div>
                <p class="text-xs">{{ currentDefectResult.summary }}</p>
              </div>

              <!-- Defects list -->
              <div v-if="currentDefectResult.defects.length > 0" class="flex flex-col gap-2">
                <h3 class="text-xs font-bold text-slate-600 uppercase tracking-wide">{{ currentDefectResult.defects.length }} Defect{{ currentDefectResult.defects.length === 1 ? '' : 's' }} Found</h3>
                <div class="flex flex-col gap-2">
                  <div
                    v-for="defect in currentDefectResult.defects"
                    :key="defect.id"
                    :class="['rounded-xl bg-white ring-1 px-4 py-3 flex flex-col gap-1.5', defect.severity === 'critical' ? 'ring-rose-200' : defect.severity === 'major' ? 'ring-orange-200' : defect.severity === 'minor' ? 'ring-amber-200' : 'ring-blue-200']"
                  >
                    <div class="flex items-center gap-2">
                      <span :class="['shrink-0 w-2 h-2 rounded-full', SEVERITY_DOT[defect.severity]]" />
                      <span :class="['shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border', SEVERITY_CLASS[defect.severity]]">{{ defect.severity }}</span>
                      <span v-if="defect.entryRef" class="shrink-0 text-[9px] font-bold text-slate-500">Entry {{ defect.entryRef.index + 1 }} ({{ defect.entryRef.type }}.)</span>
                      <span class="text-xs font-semibold text-slate-800 truncate">{{ defect.title }}</span>
                    </div>
                    <p class="text-xs text-slate-600 leading-relaxed">{{ defect.description }}</p>
                    <div class="flex items-start gap-1.5 bg-slate-50 rounded-lg px-3 py-2">
                      <span class="shrink-0 text-slate-400 text-xs">💡</span>
                      <p class="text-xs text-slate-700 leading-relaxed">{{ defect.suggestion }}</p>
                    </div>
                    <p v-if="defect.suggestedBoundary" class="text-[10px] text-indigo-600">
                      Suggested boundary for this entry: {{ BOUNDARY_TYPES.find(b => b.id === defect.suggestedBoundary)?.label }}
                    </p>
                  </div>
                </div>
              </div>
              <div v-else class="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-xl ring-1 ring-blue-200 text-xs text-blue-800 font-semibold">
                <span>✓</span><span>No defects found — model is clean within the {{ BOUNDARY_TYPES.find(b => b.id === currentDefectResult.boundaryType)?.label }} boundary</span>
              </div>
            </div>
          </ScrollContainer>

          <!-- ── IMPROVE MODEL ATTRIBUTES TOOL ─────────────────────────────────── -->
          <ScrollContainer
            v-if="toolMode === 'improve-attributes' && selectedModel"
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-5 flex flex-col gap-5"
          >
            <!-- Dimension selector -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-slate-600">Improvement Dimension</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="d in [{id:'stakeholder',label:'Stakeholder',emoji:'👥',desc:'Add new stakeholders and entries that serve them'},{id:'value',label:'Value',emoji:'📈',desc:'Improve measurable value attributes (Value Specs)'},{id:'constraint',label:'Constraint',emoji:'🔒',desc:'Add or refine Constraint Specs for the model'}]"
                  :key="d.id"
                  type="button"
                  :class="[
                    'flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-semibold border-2 transition-all duration-150',
                    improveDimension === d.id
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-purple-400',
                  ]"
                  :title="`${d.label} dimension — ${d.desc}`"
                  @click="improveDimension = d.id as 'stakeholder' | 'value' | 'constraint'"
                >
                  <span class="text-xl" aria-hidden="true">{{ d.emoji }}</span>
                  <span>{{ d.label }}</span>
                  <span class="text-[9px] font-normal text-center leading-tight opacity-70">{{ d.desc }}</span>
                </button>
              </div>
            </div>

            <!-- Specification input -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold text-slate-600">
                {{ improveDimension === 'stakeholder' ? 'For which stakeholder/group?' : improveDimension === 'value' ? 'What value improvement goal?' : 'What constraint or resource limit?' }}
              </label>
              <p class="text-[11px] text-slate-400 -mt-1">
                {{ improveDimension === 'stakeholder' ? 'e.g. "Surgical Nurses" — AI will add Function Specs, Value Specs, and stakeholders that serve them' : improveDimension === 'value' ? 'e.g. "Better Security" or "Faster response time" — AI adds measurable Value Specs and corresponding Function Specs' : 'e.g. "For less capital expenditure" or "Within GDPR constraints" — AI adds Constraint Specs and budget-aware alternatives' }}
              </p>
              <input
                v-model="improveSpec"
                type="text"
                class="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                :placeholder="improveDimension === 'stakeholder' ? 'e.g. Surgical Nurses, Hospital Administrators, Patient Family Members…' : improveDimension === 'value' ? 'e.g. Better Security, Faster Load Time, Higher Patient Satisfaction…' : 'e.g. For less capital expenditure, Within GDPR, Under 3-month delivery timeline…'"
                title="Specification — describe what you want to improve (stakeholder group, value goal, or constraint)"
                @keydown.enter="runImproveAnalysis"
              />
            </div>

            <!-- Count selector -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-bold text-slate-600">Number of suggestions</label>
              <div class="flex gap-2">
                <button v-for="n in [1, 3, 10]" :key="n" type="button"
                  :class="['rounded-lg px-4 py-2 text-xs font-semibold border-2 transition-all duration-150', improveCount === n ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-400']"
                  :title="`Generate ${n} improvement suggestion${n > 1 ? 's' : ''} — each becomes an optional new model version`"
                  @click="improveCount = n as 1 | 3 | 10"
                >{{ n === 1 ? '1 — Single Version' : n === 3 ? '3 — Top 3' : '10 — Top 10' }}</button>
              </div>
            </div>

            <!-- Run button -->
            <div class="flex items-center gap-3">
              <button
                type="button"
                :disabled="improveRunning || !improveSpec.trim()"
                :class="[
                  'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150',
                  improveRunning || !improveSpec.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white',
                ]"
                title="Generate Improvement Suggestions — AI creates new model versions with improvements in the selected dimension"
                @click="runImproveAnalysis"
              >
                <span aria-hidden="true">{{ improveRunning ? '⏳' : '✨' }}</span>
                <span>{{ improveRunning ? `Generating ${improveCount} suggestion${improveCount > 1 ? 's' : ''}…` : `Generate ${improveCount} Suggestion${improveCount > 1 ? 's' : ''}` }}</span>
              </button>
              <p v-if="improveError" class="text-xs text-orange-600">{{ improveError }}</p>
            </div>

            <!-- Suggestion cards -->
            <div v-if="currentImprovementResult" class="flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  {{ currentImprovementResult.suggestions.length }} Suggestion{{ currentImprovementResult.suggestions.length === 1 ? '' : 's' }}
                  — {{ currentImprovementResult.dimension }} dimension — "{{ currentImprovementResult.specification }}"
                </h3>
              </div>
              <div class="flex flex-col gap-4">
                <div
                  v-for="suggestion in currentImprovementResult.suggestions"
                  :key="suggestion.id"
                  :class="['rounded-2xl bg-white ring-2 p-5 flex flex-col gap-3', suggestion.rank === 1 ? 'ring-purple-400' : 'ring-slate-200']"
                >
                  <!-- Suggestion header -->
                  <div class="flex items-start gap-3">
                    <div :class="['shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white', suggestion.rank === 1 ? 'bg-purple-600' : 'bg-slate-400']">
                      {{ suggestion.rank }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-bold text-slate-800">{{ suggestion.title }}</p>
                        <span v-if="suggestion.rank === 1" class="shrink-0 text-[9px] font-bold bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">⭐ Best</span>
                      </div>
                      <p class="text-xs text-slate-500 mt-0.5 leading-relaxed">{{ suggestion.rationale }}</p>
                    </div>
                  </div>

                  <!-- New stakeholders -->
                  <div v-if="suggestion.newStakeholders.length > 0" class="flex flex-col gap-1.5">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">New Stakeholders to add</p>
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="s in suggestion.newStakeholders"
                        :key="s"
                        class="text-[10px] font-medium bg-teal-50 text-teal-700 rounded-full px-2.5 py-1 ring-1 ring-teal-200"
                      >+ {{ s }}</span>
                    </div>
                  </div>

                  <!-- New entries -->
                  <div v-if="suggestion.newEntries.length > 0" class="flex flex-col gap-1">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">New Planguage Entries to add</p>
                    <div class="flex flex-col gap-1">
                      <div
                        v-for="(entry, i) in suggestion.newEntries"
                        :key="i"
                        class="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2"
                      >
                        <PlTypeBadge :entry-type="entry.type" class="shrink-0 mt-0.5" show-label />
                        <div class="flex-1 min-w-0">
                          <p class="text-xs font-medium text-slate-800">{{ entry.description }}</p>
                          <p v-if="entry.details" class="text-[10px] text-slate-500 mt-0.5">{{ entry.details }}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Impact + Trade-offs -->
                  <div class="grid grid-cols-2 gap-3">
                    <div class="bg-blue-50 rounded-xl px-3 py-2.5">
                      <p class="text-[9px] font-bold text-blue-600 uppercase tracking-wide mb-1">Impact</p>
                      <p class="text-xs text-blue-800">{{ suggestion.impactSummary }}</p>
                    </div>
                    <div class="bg-amber-50 rounded-xl px-3 py-2.5">
                      <p class="text-[9px] font-bold text-amber-600 uppercase tracking-wide mb-1">Trade-offs</p>
                      <p class="text-xs text-amber-800">{{ suggestion.tradeOffs }}</p>
                    </div>
                  </div>

                  <!-- Apply button -->
                  <div class="flex items-center gap-3 pt-1 border-t border-slate-100">
                    <button
                      v-if="selectedModel.source === 'user'"
                      type="button"
                      :disabled="improveAppliedId === suggestion.id"
                      :class="[
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150',
                        improveAppliedId === suggestion.id
                          ? 'bg-blue-100 text-blue-700 cursor-default'
                          : 'bg-purple-600 hover:bg-purple-700 text-white',
                      ]"
                      :title="`Apply '${suggestion.title}' as a new model version — adds new entries and stakeholders, saves current state first`"
                      @click="applyImprovement(suggestion.id)"
                    >
                      <span aria-hidden="true">{{ improveAppliedId === suggestion.id ? '✓' : '▶' }}</span>
                      <span>{{ improveAppliedId === suggestion.id ? 'Applied as new version ✓' : 'Apply as New Version' }}</span>
                    </button>
                    <p v-if="selectedModel.source !== 'user'" class="text-[10px] text-amber-600 italic">Apply is only available for user models — built-in examples cannot be modified</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Version history (if model has versions) -->
            <div v-if="selectedModel.source === 'user' && selectedModel.versions && selectedModel.versions.length > 0" class="flex flex-col gap-2 pt-2 border-t border-slate-200">
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Past Versions ({{ selectedModel.versions.length }})</h3>
              <div class="flex flex-col gap-1.5">
                <div
                  v-for="version in [...selectedModel.versions].reverse()"
                  :key="version.id"
                  class="flex items-center gap-3 bg-white rounded-lg ring-1 ring-slate-200 px-4 py-2.5"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-slate-700 truncate">{{ version.name }}</p>
                    <!-- Tom 2026-06-03: Owner with Plan Title in Restore headings.
                         Owner shown on every version row; falls back to selectedModel.owners
                         (which are model-scoped, shared across versions). -->
                    <p
                      class="text-[10px] font-semibold truncate leading-snug"
                      :class="(selectedModel.owners && selectedModel.owners.length > 0) ? 'text-indigo-600' : 'text-slate-400 italic'"
                      :title="(selectedModel.owners && selectedModel.owners.length > 0)
                        ? `Owners: ${selectedModel.owners.map(o => o.name).join(', ')}`
                        : 'No owner recorded for this model — add via the 🔑 chip on the Spec Title.'"
                    >
                      {{ (selectedModel.owners && selectedModel.owners.length > 0)
                        ? `🔑 ${selectedModel.owners.map(o => o.name).join(', ')}`
                        : '🔑 owner not recorded' }}
                    </p>
                    <p class="text-[10px] text-slate-400">{{ version.entries.length }} entries · {{ version.stakeholders.length }} stakeholders · <span class="capitalize">{{ version.source }}</span></p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 text-xs text-slate-500 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors duration-150 font-medium"
                    :title="`Restore version '${version.name}' — current state will be saved as a snapshot first`"
                    @click="restoreVersion(version.id)"
                  >
                    ↩ Restore
                  </button>
                </div>
              </div>
            </div>
          </ScrollContainer>

          <!-- Normal detail view (toolMode === 'none') -->
          <ScrollContainer
            v-if="toolMode === 'none'"
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-5 flex flex-col gap-4"
          >
            <!-- Description -->
            <p class="text-sm text-slate-600 leading-relaxed">{{ selectedModel.description }}</p>

            <!-- Stakeholders -->
            <div v-if="selectedModel.stakeholders.length > 0" class="flex flex-col gap-2">
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Stakeholders</h3>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(s, i) in selectedModel.stakeholders"
                  :key="i"
                  class="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-1 font-medium"
                >{{ s }}</span>
              </div>
            </div>

            <!-- ── Local Analysis Actions ──────────────────────────────────── -->
            <!-- "We are using this model" confirmed, with direct cross-agent buttons.
                 Active model is auto-set when this view is opened (viewModel call). -->
            <div class="rounded-xl bg-teal-50 ring-1 ring-teal-200 p-4 flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <span class="text-base" aria-hidden="true">📌</span>
                <div>
                  <p class="text-xs font-bold text-teal-800 leading-tight">We are using: {{ selectedModel.title }}</p>
                  <p class="text-[10px] text-teal-600 leading-tight mt-0.5">This model is the implied target for all analysis tools below</p>
                </div>
              </div>

              <!-- 2×2 action button grid -->
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-3 py-2.5 text-xs font-semibold transition-colors duration-150"
                  title="Map Stakeholders — analyse who the stakeholders are for this model, with AI-drafted attribute profiles (Power, Influence, Urgency, etc.)"
                  @click="sendToAgent('stakeholder-mapper')"
                >
                  <span aria-hidden="true">👥</span>
                  <span>Map Stakeholders</span>
                </button>
                <button
                  type="button"
                  class="flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-3 py-2.5 text-xs font-semibold transition-colors duration-150"
                  title="Evo Health Check — review this model against the 9-step Evo cycle with per-step critique and value delivery focus"
                  @click="sendToAgent('evo-step-critique')"
                >
                  <span aria-hidden="true">📊</span>
                  <span>Evo Health Check</span>
                </button>
                <button
                  type="button"
                  class="flex items-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white px-3 py-2.5 text-xs font-semibold transition-colors duration-150"
                  title="Spec Agent — convert this model to a Planguage spec, analyse problems and improvements"
                  @click="sendToAgent('plan-importer')"
                >
                  <span aria-hidden="true">📄</span>
                  <span>Spec Agent</span>
                </button>
                <button
                  type="button"
                  class="flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-2.5 text-xs font-semibold transition-colors duration-150"
                  title="Decision Mapper — analyse decision options for this model using Planguage criteria"
                  @click="sendToAgent('decisions')"
                >
                  <span aria-hidden="true">🎯</span>
                  <span>Decision Mapper</span>
                </button>
                <!-- Tom Gilb 2026-06-11: "for sure also a tool in the Model mode, so duplicate
                     it there". Incorruptible (Eric Ries 2026) runs in MODEL MODE here — Accept Fix
                     is preview-only; host shows a toast directing user to save as custom model. -->
                <button
                  type="button"
                  class="flex items-center gap-2 rounded-lg bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 hover:from-slate-800 hover:via-indigo-800 hover:to-slate-800 text-white px-3 py-2.5 text-xs font-semibold transition-colors duration-150 ring-1 ring-indigo-700 col-span-2"
                  title="Incorruptible Agent (Eric Ries 2026) — Health Check this model for short-term-thinking patterns: Quarterly Tyranny, Stakeholder Monoculture, Mission Drift, Founder-Vision Erosion, Innovation-Budget Predation, Governance Hole."
                  @click="sendToAgent('incorruptible-model')"
                >
                  <span aria-hidden="true">⚖️</span>
                  <span>Incorruptible · Health Check</span>
                </button>
                <!-- r93aa — Incorruptible Sharpening from outside the Agent (Tom 2026-06-11). -->
                <button
                  type="button"
                  class="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-700 via-orange-700 to-amber-700 hover:from-amber-600 hover:via-orange-600 hover:to-amber-600 text-white px-3 py-2.5 text-xs font-semibold transition-colors duration-150 ring-1 ring-orange-800 col-span-2"
                  title="Incorruptible Sharpening (Eric Ries 2026 Q&A) — run the question-and-answer flow on this model. Six categories × 2 questions × 3 AI-suggested starter answers. Probes context the deterministic engine cannot infer; synthesises fixes via the standard Accept-Fix pipeline (preview-only on models)."
                  @click="sendToAgent('incorruptible-sharpen-model')"
                >
                  <span aria-hidden="true">🔪</span>
                  <span>Incorruptible Sharpening · Q&amp;A</span>
                </button>
              </div>

              <!-- Specific Model Analysis Tools button + dropdown shell -->
              <div class="relative">
                <button
                  type="button"
                  class="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-teal-300 hover:border-teal-500 hover:bg-teal-100 text-teal-700 px-3 py-2 text-xs font-semibold transition-colors duration-150"
                  title="Specific Model Analysis Tools — open additional analysis tools tailored to this model type (single-click to expand, double-click to open full tools panel)"
                  @click="specificToolsOpen = !specificToolsOpen"
                >
                  <span aria-hidden="true">🔧</span>
                  <span>Specific Model Analysis Tools</span>
                  <span class="text-[10px]" aria-hidden="true">{{ specificToolsOpen ? '▴' : '▾' }}</span>
                </button>

                <!-- Specific Model Analysis Tools dropdown -->
                <div
                  v-if="specificToolsOpen"
                  class="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl ring-1 ring-slate-200 shadow-lg z-10 overflow-hidden"
                  role="menu"
                >
                  <!-- Edit Model category -->
                  <div class="px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">✏️ Edit Model</p>
                  </div>
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Batch Change Entries — filter entries by type and keyword, then replace text or delete in bulk"
                    @click="openTool('edit-batch')">
                    <span>🔧</span><span class="font-medium">Batch Change Entries</span><span class="ml-auto text-slate-400 text-[10px]">bulk ops</span>
                  </button>
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Find &amp; Replace — find any text across all entry descriptions and details and replace it"
                    @click="openTool('edit-replace')">
                    <span>🔍</span><span class="font-medium">Find &amp; Replace</span><span class="ml-auto text-slate-400 text-[10px]">text swap</span>
                  </button>
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Manual Edit List — filter entries by type or keyword and edit each one inline"
                    @click="openTool('edit-manual')">
                    <span>✏️</span><span class="font-medium">Manual Edit List</span><span class="ml-auto text-slate-400 text-[10px]">row editor</span>
                  </button>

                  <!-- Visualize Model category -->
                  <div class="px-3 py-2 bg-slate-50 border-t border-b border-slate-100">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">📊 Visualize Model</p>
                  </div>
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Value Flow — see how Stakeholders flow into Functions which deliver Values, with Constraints at the bottom"
                    @click="openTool('viz-flow')">
                    <span>📊</span><span class="font-medium">Value Flow</span><span class="ml-auto text-slate-400 text-[10px]">SVG layout</span>
                  </button>
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Strongly Related — hierarchical relationship graph with arrow thickness proportional to importance and bidirectional feedback arrows"
                    @click="openTool('viz-related')">
                    <span>🔗</span><span class="font-medium">Strongly Related</span><span class="ml-auto text-slate-400 text-[10px]">relationship graph</span>
                  </button>
                  <!-- v486 — Isometric City (Tom's pseudo-3D rotatable dream) -->
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Isometric City — pseudo-3D rotatable Planguage city.  Stakeholders are towers, Functions are warehouses, Values are beacons, Constraints are walls, Resources are depots.  Drag horizontally to rotate; use the slider for precise angle control."
                    @click="openTool('viz-city')">
                    <span>🏙</span><span class="font-medium">Isometric City</span><span class="ml-auto text-slate-400 text-[10px]">pseudo-3D · rotatable</span>
                  </button>
                  <!-- v489 — Radial Sunburst (design brief pick ②) -->
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Radial Sunburst — concentric rings around your model.  Stakeholders in the inner ring, Values in the next ring out, Functions in the third ring, Constraints and Resources in the outermost ring.  Click any node to drill down."
                    @click="openTool('viz-sun')">
                    <span>☀</span><span class="font-medium">Radial Sunburst</span><span class="ml-auto text-slate-400 text-[10px]">concentric rings</span>
                  </button>
                  <!-- v489 — Constellation Map (design brief pick ④) -->
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Constellation Map — star clusters on a dark starmap background.  Stakeholders top-left, Values top-right, Functions centre, Constraints bottom-left, Resources bottom-right.  Thin orbital lines connect related entries.  Click any star to drill down."
                    @click="openTool('viz-star')">
                    <span>✨</span><span class="font-medium">Constellation Map</span><span class="ml-auto text-slate-400 text-[10px]">star clusters</span>
                  </button>
                  <!-- v490 — Focus + Context (design brief pick ①) -->
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Focus + Context — same 3-column Sankey layout as Value Flow, but clicking any node fades unrelated nodes to 22% opacity so the focus + its connected neighbours stand out.  Click again on the drill-down Close pin to un-focus."
                    @click="openTool('viz-focus')">
                    <span>🎯</span><span class="font-medium">Focus + Context</span><span class="ml-auto text-slate-400 text-[10px]">fade unrelated</span>
                  </button>
                  <!-- v490 — Layered Accordion (design brief pick ⑤) -->
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Layered Accordion — five horizontal stripes (Stakeholders / Functions / Values / Constraints / Resources) top to bottom.  Each stripe carries its own entries left-to-right.  Great for scanning the model type-by-type."
                    @click="openTool('viz-accordion')">
                    <span>📚</span><span class="font-medium">Layered Accordion</span><span class="ml-auto text-slate-400 text-[10px]">5 stripes</span>
                  </button>
                  <!-- v490 — Focus Ring (design brief pick ⑥) -->
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Focus Ring — first Function at centre (large), Values on inner ring, Stakeholders on middle ring, Constraints and Resources on outer ring.  Spokes connect the focus to its direct value neighbours.  Click any node to drill down."
                    @click="openTool('viz-ring')">
                    <span>💫</span><span class="font-medium">Focus Ring</span><span class="ml-auto text-slate-400 text-[10px]">concentric neighbours</span>
                  </button>
                  <!-- v490 — Time Ribbon (design brief pick ⑧) -->
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Time Ribbon — horizontal timeline with five lanes.  Entries within a lane arranged left-to-right by index (MVP: no real time positions yet).  When r93jjj Qualifiers Phase 2 populates temporal Qualifiers per entry, this mode automatically shows real time evolution.  Click any bar to drill down."
                    @click="openTool('viz-ribbon')">
                    <span>📅</span><span class="font-medium">Time Ribbon</span><span class="ml-auto text-slate-400 text-[10px]">horizontal lanes</span>
                  </button>
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 transition-colors duration-150 text-left"
                    title="Model Visualizer — 3D rotating/static cube · 2D Simple node map · 2D Colored Kanban board. Switch modes with the top selector bar."
                    @click="openTool('viz-3d')">
                    <span>🧊</span><span class="font-medium">Model Visualizer</span><span class="ml-auto text-slate-400 text-[10px]">3D · 2D Simple · 2D Colored</span>
                  </button>

                  <!-- Sharpen Model category -->
                  <div class="px-3 py-2 bg-slate-50 border-t border-b border-slate-100">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">✂️ Sharpen Model</p>
                  </div>
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-800 transition-colors duration-150 text-left"
                    title="Sharpen Model — apply AI improvement commands to refine this model's entries (Simplify, Add Values, Tighten Constraints, Make More Specific)"
                    @click="openTool('sharpen')">
                    <span>✂️</span><span class="font-medium">AI Sharpen</span><span class="ml-auto text-slate-400 text-[10px]">improve entries</span>
                  </button>
                  <!-- Analyse Model category -->
                  <div class="px-3 py-2 bg-slate-50 border-t border-b border-slate-100">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">🔬 Analyse Model</p>
                  </div>
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-800 transition-colors duration-150 text-left"
                    title="Model Defect Analysis — find inconsistencies, missing elements, and boundary violations in this model with an elegant boundary diagram"
                    @click="openTool('defect-analysis')">
                    <span>🔬</span><span class="font-medium">Model Defect Analysis</span><span class="ml-auto text-slate-400 text-[10px]">find issues</span>
                  </button>
                  <button type="button" class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-800 transition-colors duration-150 text-left"
                    title="Improve Model Attributes — AI generates improvement suggestions in Stakeholder, Value, or Constraint dimensions with new model versions"
                    @click="openTool('improve-attributes')">
                    <span>✨</span><span class="font-medium">Improve Model Attributes</span><span class="ml-auto text-slate-400 text-[10px]">AI suggestions</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- User model: analysing state -->
            <div
              v-if="selectedModel.source === 'user' && selectedModel.analysisStatus === 'analysing'"
              class="flex items-center gap-2 px-4 py-3 bg-amber-50 rounded-xl ring-1 ring-amber-200"
            >
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" aria-hidden="true" />
              <span class="text-sm text-amber-800 font-medium">Analysing your text into Planguage…</span>
            </div>

            <!-- User model: idle or error — show raw text + analyse button -->
            <div
              v-else-if="selectedModel.source === 'user' && (selectedModel.analysisStatus === 'idle' || selectedModel.analysisStatus === 'error') && selectedModel.userText"
              class="flex flex-col gap-2"
            >
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Model Text</h3>
                <button
                  type="button"
                  class="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors duration-150 px-2 py-1 rounded hover:bg-blue-50"
                  title="Analyse Now — run AI to convert this text to structured Planguage entries"
                  @click="triggerAnalyse(selectedModel.id)"
                >
                  <span aria-hidden="true">🔄</span>
                  <span>Analyse Now</span>
                </button>
              </div>
              <p
                v-if="selectedModel.analysisStatus === 'error'"
                class="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2"
              >
                Analysis failed: {{ selectedModel.analysisError ?? 'Unknown error' }}
              </p>
              <pre class="text-xs text-slate-700 bg-white rounded-xl ring-1 ring-slate-200 p-4 whitespace-pre-wrap leading-relaxed font-mono">{{ selectedModel.userText }}</pre>
            </div>

            <!-- Planguage entries (built-in or successfully analysed user models) -->
            <div v-if="selectedModel.entries.length > 0" class="flex flex-col gap-2">
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Planguage Entries</h3>
              <div class="flex flex-col gap-2">
                <div
                  v-for="(entry, i) in selectedModel.entries"
                  :key="i"
                  class="flex flex-col gap-0.5 rounded-lg bg-white ring-1 ring-slate-200 px-4 py-3"
                >
                  <div class="flex items-start gap-2">
                    <!-- DD-010: colour glyph + spelled-out label (universal label rule) -->
                    <PlTypeBadge :entry-type="entry.type" class="shrink-0 mt-0.5" show-label />
                    <span class="text-xs text-slate-800 font-medium leading-relaxed">{{ entry.description }}</span>
                  </div>
                  <p v-if="entry.details" class="text-[11px] text-slate-500 leading-relaxed pl-8">{{ entry.details }}</p>
                </div>
              </div>
            </div>

            <!-- ── Sharpen section (user models only) ───────────────────── -->
            <div
              v-if="selectedModel.source === 'user'"
              class="flex flex-col gap-3 border-t border-slate-200 pt-4 mt-2"
            >
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Sharpen this model</h3>

              <!-- Quick pills -->
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="pill in SHARPEN_PILLS"
                  :key="pill"
                  type="button"
                  :class="[
                    'text-xs rounded-full px-3 py-1.5 font-medium transition-colors duration-150 border',
                    sharpenCommand === pill
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-600',
                  ]"
                  :title="`${pill} — click to fill the command box, then press Sharpen to apply`"
                  @click="fillSharpenPill(pill)"
                >
                  {{ pill }}
                </button>
              </div>

              <!-- Custom command row -->
              <div class="flex gap-2">
                <input
                  v-model="sharpenCommand"
                  type="text"
                  class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Or type a custom improvement command…"
                  title="Improvement command — describe how to improve this model, then click Sharpen"
                  @keydown.enter="runSharpen"
                />
                <button
                  type="button"
                  :disabled="sharpenLoading || !sharpenCommand.trim()"
                  :class="[
                    'shrink-0 flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150',
                    sharpenLoading || !sharpenCommand.trim()
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white',
                  ]"
                  title="Sharpen — apply the improvement command to this model's Planguage entries using AI"
                  @click="runSharpen"
                >
                  <span aria-hidden="true">{{ sharpenLoading ? '⏳' : '▶' }}</span>
                  <span>{{ sharpenLoading ? 'Improving…' : 'Sharpen' }}</span>
                </button>
              </div>

              <!-- Sharpen status -->
              <p
                v-if="sharpenSuccess"
                class="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2"
              >
                Model sharpened ✓
              </p>
              <p
                v-else-if="sharpenError"
                class="text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2"
              >
                {{ sharpenError }}
              </p>
            </div>

            <!-- ── Version History (user models with versions) ──────────────────── -->
            <div
              v-if="selectedModel.source === 'user' && selectedModel.versions && selectedModel.versions.length > 0"
              class="flex flex-col gap-2 border-t border-slate-200 pt-4 mt-2"
            >
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Past Versions ({{ selectedModel.versions.length }})</h3>
              <div class="flex flex-col gap-1.5">
                <div
                  v-for="version in [...selectedModel.versions].reverse()"
                  :key="version.id"
                  class="flex items-center gap-3 bg-white rounded-lg ring-1 ring-slate-200 px-4 py-2.5"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-slate-700 truncate">{{ version.name }}</p>
                    <!-- Tom 2026-06-03: Owner with Plan Title in Restore headings. -->
                    <p
                      class="text-[10px] font-semibold truncate leading-snug"
                      :class="(selectedModel.owners && selectedModel.owners.length > 0) ? 'text-indigo-600' : 'text-slate-400 italic'"
                      :title="(selectedModel.owners && selectedModel.owners.length > 0)
                        ? `Owners: ${selectedModel.owners.map(o => o.name).join(', ')}`
                        : 'No owner recorded for this model.'"
                    >
                      {{ (selectedModel.owners && selectedModel.owners.length > 0)
                        ? `🔑 ${selectedModel.owners.map(o => o.name).join(', ')}`
                        : '🔑 owner not recorded' }}
                    </p>
                    <p class="text-[10px] text-slate-400">{{ version.entries.length }} entries · {{ version.stakeholders.length }} stakeholders</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 text-xs text-slate-500 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors duration-150 font-medium"
                    :title="`Restore version '${version.name}' — saves current state as snapshot first`"
                    @click="restoreVersion(version.id)"
                  >
                    ↩ Restore
                  </button>
                </div>
              </div>
            </div>

          </ScrollContainer>
        </template>

      </div>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <div class="shrink-0 bg-slate-50 border-t border-slate-200 py-2 text-center">
      <p class="text-[10px] text-slate-400 leading-tight">
        Domain models in Planguage — browse, bring in, sharpen, and load into SEM for analysis
      </p>
    </div>

  </div>
</template>
