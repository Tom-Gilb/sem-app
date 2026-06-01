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
import { openEml } from '../composables/useEmlExport'

const emit = defineEmits<{
  close: []
  /** Emitted when a cross-agent navigation button is clicked.
   *  App.vue handles this the same way as AgentMenuPanel @select-agent. */
  'select-agent': [id: string]
}>()

// ── Composables ───────────────────────────────────────────────────────────────

const library = useModelLibrary()
const { importFromFile, importLoading: fileExtracting } = useDocumentImport()

// ── Type declarations ─────────────────────────────────────────────────────────

type EntryType = 'F' | 'V' | 'C' | 'R' | 'S'
type PanelMode = 'grid' | 'bring-in' | 'detail'
type ToolMode = 'none' | 'edit-batch' | 'edit-replace' | 'edit-manual' | 'viz-flow' | 'viz-related' | 'viz-3d' | 'sharpen' | 'defect-analysis' | 'improve-attributes'

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
  if (!bringInText.value.trim()) return
  const entry = library.addUserEntry(
    bringInTitle.value,
    bringInCatId.value,
    bringInText.value,
  )
  // Switch to the category that was selected
  selectedCategoryId.value = bringInCatId.value
  mode.value = 'grid'
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
function buildModelExportHtml(model: ModelLibraryEntry, toolLabel: string): string {
  const TYPE_STYLE: Record<string, { bg: string; border: string; badge: string; label: string }> = {
    F: { bg: '#fff7ed', border: '#f97316', badge: 'background:#f97316;color:#fff', label: 'F. Function' },
    V: { bg: '#eff6ff', border: '#3b82f6', badge: 'background:#3b82f6;color:#fff', label: 'V. Value' },
    C: { bg: '#fdf4ff', border: '#c026d3', badge: 'background:#c026d3;color:#fff', label: 'C. Constraint' },
    R: { bg: '#f0f9ff', border: '#0284c7', badge: 'background:#0284c7;color:#fff', label: 'R. Resource' },
    S: { bg: '#f5f3ff', border: '#7c3aed', badge: 'background:#7c3aed;color:#fff', label: 'S. Stakeholder' },
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

  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:820px;padding:16px;color:#0f172a;">',
    // Title block
    `<div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:8px;padding:16px 20px;margin-bottom:16px;">`,
    `<h2 style="margin:0 0 4px 0;color:#f8fafc;font-size:16px;font-weight:800;">${esc(toolLabel)}</h2>`,
    `<p style="margin:0;color:#94a3b8;font-size:12px;font-weight:600;">${esc(model.title)}</p>`,
    `<p style="margin:4px 0 0 0;color:#64748b;font-size:11px;">Category: ${esc(model.exampleSubCategory ?? model.categoryId ?? '')} · ${model.entries.length} entries · SEM App · ${today}</p>`,
    `</div>`,
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
  const html = buildModelExportHtml(model, label)
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

function emailToolExport(): void {
  const model = selectedModel.value
  if (!model) return
  const label = toolMode.value !== 'none' ? TOOL_MODE_LABELS[toolMode.value] : 'Model Detail'
  const html = buildModelExportHtml(model, label)
  const plain = model.entries.map(e => `${e.type}. ${e.description}${e.details ? ' — ' + e.details : ''}`).join('\n')
  openEml(html, `${label} — ${model.title}`, { plainBody: plain })
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

// ── Visualization helpers ──────────────────────────────────────────────────────

interface VizNode { id: string; label: string; type: EntryType | 'stakeholder'; x: number; y: number; w: number; h: number }
interface VizArrow { fromId: string; toId: string; color: string; strokeWidth: number; dashed: boolean; bidir: boolean }

function computeValueFlowLayout(model: ModelLibraryEntry): { nodes: VizNode[]; arrows: VizArrow[] } {
  const nodes: VizNode[] = []
  const arrows: VizArrow[] = []
  const PX = { stakeholderX: 20, fnX: 230, valX: 510, constX: 230 }
  const NODE_W = 160; const NODE_H = 36; const GAP = 12

  // Stakeholders — left column
  const stks = model.stakeholders.slice(0, 6)
  stks.forEach((s, i) => {
    nodes.push({ id: `stk-${i}`, label: s, type: 'stakeholder', x: PX.stakeholderX, y: 50 + i * (NODE_H + GAP), w: NODE_W, h: NODE_H })
  })

  // Functions — center column
  const fns = model.entries.filter(e => e.type === 'F').slice(0, 7)
  fns.forEach((e, i) => {
    nodes.push({ id: `fn-${i}`, label: e.description, type: 'F', x: PX.fnX, y: 50 + i * (NODE_H + GAP), w: NODE_W, h: NODE_H })
  })

  // Values — right column
  const vals = model.entries.filter(e => e.type === 'V').slice(0, 7)
  vals.forEach((e, i) => {
    nodes.push({ id: `val-${i}`, label: e.description, type: 'V', x: PX.valX, y: 50 + i * (NODE_H + GAP), w: NODE_W, h: NODE_H })
  })

  // Constraints + Resources — bottom row (under functions)
  const constrs = model.entries.filter(e => e.type === 'C' || e.type === 'R').slice(0, 4)
  const fnBottom = 50 + Math.max(fns.length, 1) * (NODE_H + GAP) + 20
  constrs.forEach((e, i) => {
    nodes.push({ id: `cr-${i}`, label: e.description, type: e.type as EntryType, x: PX.fnX + i * (NODE_W + 10), y: fnBottom, w: NODE_W, h: NODE_H })
  })

  // Stakeholder → Function arrows (dashed gray)
  for (let si = 0; si < stks.length; si++) {
    for (let fi = 0; fi < Math.min(fns.length, 2); fi++) {
      arrows.push({ fromId: `stk-${si}`, toId: `fn-${fi}`, color: '#94a3b8', strokeWidth: 1.5, dashed: true, bidir: false })
    }
  }

  // Function → Value arrows (solid blue thick)
  for (let fi = 0; fi < fns.length; fi++) {
    const vi = Math.min(fi, vals.length - 1)
    if (vi >= 0) {
      arrows.push({ fromId: `fn-${fi}`, toId: `val-${vi}`, color: '#2563eb', strokeWidth: 2.5, dashed: false, bidir: false })
    }
  }

  // Function → Constraint/Resource arrows (dashed orange thin)
  for (let fi = 0; fi < fns.length; fi++) {
    for (let ci = 0; ci < constrs.length; ci++) {
      arrows.push({ fromId: `fn-${fi}`, toId: `cr-${ci}`, color: '#f97316', strokeWidth: 1, dashed: true, bidir: false })
    }
  }

  return { nodes, arrows }
}

function computeStronglyRelatedLayout(model: ModelLibraryEntry): { nodes: VizNode[]; arrows: VizArrow[] } {
  const nodes: VizNode[] = []
  const arrows: VizArrow[] = []
  const NODE_W = 130; const NODE_H = 32

  const rows = {
    stakeholders: model.stakeholders.slice(0, 5),
    functions:    model.entries.filter(e => e.type === 'F').slice(0, 5),
    values:       model.entries.filter(e => e.type === 'V').slice(0, 5),
    constrs:      model.entries.filter(e => e.type === 'C' || e.type === 'R').slice(0, 5),
  }

  function rowX(count: number, i: number, totalW = 800): number {
    const spacing = totalW / (count + 1)
    return spacing * (i + 1) - NODE_W / 2
  }

  rows.stakeholders.forEach((s, i) => nodes.push({ id: `stk-${i}`, label: s, type: 'stakeholder', x: rowX(rows.stakeholders.length, i), y: 20,  w: NODE_W, h: NODE_H }))
  rows.functions.forEach((e, i)    => nodes.push({ id: `fn-${i}`,  label: e.description, type: 'F', x: rowX(rows.functions.length, i),    y: 120, w: NODE_W, h: NODE_H }))
  rows.values.forEach((e, i)       => nodes.push({ id: `val-${i}`, label: e.description, type: 'V', x: rowX(rows.values.length, i),        y: 220, w: NODE_W, h: NODE_H }))
  rows.constrs.forEach((e, i)      => nodes.push({ id: `cr-${i}`,  label: e.description, type: e.type as EntryType, x: rowX(rows.constrs.length, i), y: 320, w: NODE_W, h: NODE_H }))

  const stk = rows.stakeholders; const fns = rows.functions; const vals = rows.values; const crs = rows.constrs

  // Stakeholder → Function (medium blue, bidirectional)
  for (let si = 0; si < stk.length; si++) {
    const fi = si % Math.max(fns.length, 1)
    if (fi < fns.length) arrows.push({ fromId: `stk-${si}`, toId: `fn-${fi}`, color: '#2563eb', strokeWidth: 2, dashed: false, bidir: true })
  }
  // Function → Value (thick blue)
  for (let fi = 0; fi < fns.length; fi++) {
    const vi = Math.min(fi, vals.length - 1)
    if (vi >= 0) arrows.push({ fromId: `fn-${fi}`, toId: `val-${vi}`, color: '#2563eb', strokeWidth: 3.5, dashed: false, bidir: false })
  }
  // Value → Function feedback (thin dashed blue, bidirectional)
  for (let vi = 0; vi < vals.length; vi++) {
    const fi = vi % Math.max(fns.length, 1)
    if (fi < fns.length) arrows.push({ fromId: `val-${vi}`, toId: `fn-${fi}`, color: '#3b82f6', strokeWidth: 1, dashed: true, bidir: true })
  }
  // Function → Constraint (thin orange)
  for (let fi = 0; fi < fns.length; fi++) {
    for (let ci = 0; ci < crs.length; ci++) {
      arrows.push({ fromId: `fn-${fi}`, toId: `cr-${ci}`, color: '#f97316', strokeWidth: 1.2, dashed: false, bidir: false })
    }
  }

  return { nodes, arrows }
}

const valueFlowLayout  = computed(() => selectedModel.value ? computeValueFlowLayout(selectedModel.value)  : { nodes: [], arrows: [] })
const stronglyRelLayout = computed(() => selectedModel.value ? computeStronglyRelatedLayout(selectedModel.value) : { nodes: [], arrows: [] })

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
  { type: 'F', label: 'F. Functions',    bg: 'bg-orange-50',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-800',  dot: 'bg-orange-400' },
  { type: 'V', label: 'V. Values',       bg: 'bg-blue-50',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-800',      dot: 'bg-blue-400'   },
  { type: 'C', label: 'C. Constraints',  bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', badge: 'bg-fuchsia-100 text-fuchsia-800',dot: 'bg-fuchsia-400'},
  { type: 'R', label: 'R. Resources',    bg: 'bg-sky-50',     border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-800',        dot: 'bg-sky-400'    },
  { type: 'S', label: 'S. Stakeholders', bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-800',  dot: 'bg-violet-400' },
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
          title="Plan Agent — open Plan Agent with this model as context"
          @click="sendToAgent('plan-importer')"
        >
          📄 Plan Agent
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
            <!-- Category row button -->
            <button
              type="button"
              :class="[
                'flex-1 flex items-center gap-2 px-1 py-1.5 text-left text-xs transition-colors duration-150 rounded min-w-0',
                selectedCategoryId === cat.id
                  ? 'text-blue-800 font-semibold'
                  : 'text-slate-600 hover:text-slate-800',
              ]"
              :title="`Browse ${cat.label} — click to view models in this category`"
              @click="selectTopLevelCat(cat.id)"
            >
              <span class="text-sm shrink-0" aria-hidden="true">{{ cat.emoji }}</span>
              <!-- Rename input or label -->
              <template v-if="renamingCategoryId === cat.id">
                <input
                  ref="renameInputRef"
                  v-model="renameInputValue"
                  type="text"
                  class="flex-1 min-w-0 text-xs bg-white border border-blue-400 rounded px-1 py-0.5 outline-none"
                  :aria-label="`Rename category — currently '${cat.label}'`"
                  title="Rename this category — press Enter to save, Escape to cancel"
                  @keydown="handleRenameKeydown"
                  @blur="saveRename"
                  @click.stop
                />
              </template>
              <template v-else>
                <span class="flex-1 min-w-0 truncate">{{ cat.label }}</span>
                <span class="shrink-0 text-[10px] text-slate-400">{{ catCount(cat.id) }}</span>
              </template>
            </button>

            <!-- Rename button -->
            <button
              v-if="cat.isRenameable && renamingCategoryId !== cat.id"
              type="button"
              class="shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-150 text-[10px]"
              :title="`Rename '${cat.label}' — click to edit the category name`"
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
                <div
                  v-else-if="model.source === 'user' && model.analysisStatus === 'error'"
                  class="flex items-center gap-1.5 px-4 py-1.5 bg-orange-50 border-b border-orange-100"
                >
                  <span class="inline-block w-2 h-2 rounded-full bg-orange-500" aria-hidden="true" />
                  <span class="text-[10px] text-orange-700 font-medium">Analysis failed</span>
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
                Paste any text — strategy doc, spec, plan, rough notes — AI converts it to Planguage F./V./C./R./S. entries.
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
              <div v-else class="flex flex-col gap-1.5 max-h-48 overflow-y-auto rounded-xl ring-1 ring-slate-200 bg-white p-3">
                <div v-for="m in batchMatchedEntries" :key="m.idx" class="flex items-start gap-2 text-xs">
                  <PlTypeBadge :entry-type="m.entry.type" class="shrink-0 mt-0.5" show-label />
                  <span v-if="batchAction === 'delete'" class="text-red-600 line-through">{{ m.entry.description }}</span>
                  <template v-else>
                    <span class="text-slate-500 line-through truncate">{{ m.entry.description }}</span>
                    <span class="text-slate-300 mx-1 shrink-0">→</span>
                    <span class="text-slate-800 truncate">{{ batchNewText || '(empty)' }}</span>
                  </template>
                </div>
              </div>
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
              <div v-else class="rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden max-h-64 overflow-y-auto">
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
              </div>
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

          <!-- Value Flow visualization -->
          <ScrollContainer v-if="toolMode === 'viz-flow' && selectedModel" outer-class="flex-1 min-h-0 relative" inner-class="p-5 flex flex-col gap-4">
            <!-- Legend -->
            <div class="flex flex-wrap gap-3 text-[10px] font-semibold">
              <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-slate-400 opacity-60"></span> Stakeholders</span>
              <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-orange-500"></span> Functions</span>
              <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-blue-500"></span> Values</span>
              <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded bg-fuchsia-500"></span> Constraints / <span class="inline-block w-3 h-3 rounded bg-sky-500 ml-1"></span> Resources</span>
              <span class="flex items-center gap-1.5"><span class="inline-block w-5 h-0.5 bg-blue-600"></span> delivers value</span>
              <span class="flex items-center gap-1.5"><span class="inline-block w-5 h-0.5 bg-slate-400 border-dashed"></span> contributes to</span>
            </div>
            <div class="rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden">
              <svg
                viewBox="0 0 900 520"
                class="w-full"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                :aria-label="`Value Flow diagram for ${selectedModel.title}`"
              >
                <defs>
                  <marker id="arrowBlue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#2563eb" />
                  </marker>
                  <marker id="arrowGray" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                  </marker>
                  <marker id="arrowOrange" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#f97316" />
                  </marker>
                </defs>

                <!-- Column header labels -->
                <text x="100" y="20" text-anchor="middle" font-size="11" fill="#64748b" font-weight="600">STAKEHOLDERS</text>
                <text x="390" y="20" text-anchor="middle" font-size="11" fill="#64748b" font-weight="600">FUNCTIONS</text>
                <text x="680" y="20" text-anchor="middle" font-size="11" fill="#64748b" font-weight="600">VALUES</text>

                <!-- Arrows first (behind nodes) -->
                <template v-for="arrow in valueFlowLayout.arrows" :key="`${arrow.fromId}-${arrow.toId}`">
                  <template v-if="valueFlowLayout.nodes.find(n=>n.id===arrow.fromId) && valueFlowLayout.nodes.find(n=>n.id===arrow.toId)">
                    <line
                      :x1="(valueFlowLayout.nodes.find(n=>n.id===arrow.fromId)!.x + valueFlowLayout.nodes.find(n=>n.id===arrow.fromId)!.w)"
                      :y1="(valueFlowLayout.nodes.find(n=>n.id===arrow.fromId)!.y + valueFlowLayout.nodes.find(n=>n.id===arrow.fromId)!.h / 2)"
                      :x2="valueFlowLayout.nodes.find(n=>n.id===arrow.toId)!.x"
                      :y2="(valueFlowLayout.nodes.find(n=>n.id===arrow.toId)!.y + valueFlowLayout.nodes.find(n=>n.id===arrow.toId)!.h / 2)"
                      :stroke="arrow.color"
                      :stroke-width="arrow.strokeWidth"
                      :stroke-dasharray="arrow.dashed ? '4 3' : 'none'"
                      :marker-end="arrow.color === '#2563eb' ? 'url(#arrowBlue)' : arrow.color === '#f97316' ? 'url(#arrowOrange)' : 'url(#arrowGray)'"
                      opacity="0.7"
                    />
                  </template>
                </template>

                <!-- Nodes -->
                <template v-for="node in valueFlowLayout.nodes" :key="node.id">
                  <!-- Node background -->
                  <rect
                    :x="node.x" :y="node.y" :width="node.w" :height="node.h" rx="6"
                    :fill="node.type === 'stakeholder' ? '#e2e8f0' : node.type === 'F' ? '#fed7aa' : node.type === 'V' ? '#bfdbfe' : node.type === 'C' ? '#fdf4ff' : '#f0f9ff'"
                    :stroke="node.type === 'stakeholder' ? '#94a3b8' : node.type === 'F' ? '#f97316' : node.type === 'V' ? '#3b82f6' : node.type === 'C' ? '#c026d3' : '#0284c7'"
                    stroke-width="1.5"
                  />
                  <!-- Type badge (for entries) -->
                  <template v-if="node.type !== 'stakeholder'">
                    <rect :x="node.x + 4" :y="node.y + 4" width="18" height="16" rx="3"
                      :fill="node.type === 'F' ? '#f97316' : node.type === 'V' ? '#3b82f6' : node.type === 'C' ? '#d946ef' : '#0ea5e9'" />
                    <text :x="node.x + 13" :y="node.y + 15" text-anchor="middle" font-size="9" fill="white" font-weight="700">{{ node.type }}</text>
                  </template>
                  <!-- Label -->
                  <text
                    :x="node.type !== 'stakeholder' ? node.x + 26 : node.x + 8"
                    :y="node.y + node.h / 2 + 4"
                    font-size="10"
                    :fill="node.type === 'stakeholder' ? '#475569' : '#1e293b'"
                    font-weight="500"
                  >
                    <tspan>{{ node.label.length > 20 ? node.label.slice(0, 19) + '…' : node.label }}</tspan>
                  </text>
                </template>

                <!-- Empty state -->
                <text v-if="valueFlowLayout.nodes.length === 0" x="450" y="260" text-anchor="middle" font-size="13" fill="#94a3b8">No entries to visualize</text>
              </svg>
            </div>
          </ScrollContainer>

          <!-- Strongly Related visualization -->
          <ScrollContainer v-if="toolMode === 'viz-related' && selectedModel" outer-class="flex-1 min-h-0 relative" inner-class="p-5 flex flex-col gap-4">
            <div class="flex flex-wrap gap-3 text-[10px] font-semibold">
              <span class="flex items-center gap-1"><span class="inline-block w-4" style="height:3px;background:#2563eb"></span> delivers value (thick)</span>
              <span class="flex items-center gap-1"><span class="inline-block w-4 h-px bg-blue-500"></span> ↔ stakeholder influence</span>
              <span class="flex items-center gap-1"><span class="inline-block w-4 h-px bg-orange-500"></span> constrained by</span>
              <span class="flex items-center gap-1"><span class="inline-block w-4 h-px bg-blue-300"></span> feedback</span>
            </div>
            <div class="rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden">
              <svg viewBox="0 0 860 400" class="w-full" xmlns="http://www.w3.org/2000/svg" :aria-label="`Strongly Related diagram for ${selectedModel.title}`" role="img">
                <defs>
                  <marker id="srArrowBlue" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#2563eb"/></marker>
                  <marker id="srArrowBlueBack" markerWidth="7" markerHeight="5" refX="0" refY="2.5" orient="auto"><polygon points="7 0,0 2.5,7 5" fill="#2563eb"/></marker>
                  <marker id="srArrowOrange" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#f97316"/></marker>
                  <marker id="srArrowLightBlue" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0,7 2.5,0 5" fill="#93c5fd"/></marker>
                </defs>

                <!-- Arrows (behind nodes) -->
                <template v-for="arrow in stronglyRelLayout.arrows" :key="`${arrow.fromId}-${arrow.toId}`">
                  <template v-if="stronglyRelLayout.nodes.find(n=>n.id===arrow.fromId) && stronglyRelLayout.nodes.find(n=>n.id===arrow.toId)">
                    <line
                      :x1="stronglyRelLayout.nodes.find(n=>n.id===arrow.fromId)!.x + stronglyRelLayout.nodes.find(n=>n.id===arrow.fromId)!.w/2"
                      :y1="stronglyRelLayout.nodes.find(n=>n.id===arrow.fromId)!.y + stronglyRelLayout.nodes.find(n=>n.id===arrow.fromId)!.h"
                      :x2="stronglyRelLayout.nodes.find(n=>n.id===arrow.toId)!.x + stronglyRelLayout.nodes.find(n=>n.id===arrow.toId)!.w/2"
                      :y2="stronglyRelLayout.nodes.find(n=>n.id===arrow.toId)!.y"
                      :stroke="arrow.color"
                      :stroke-width="arrow.strokeWidth"
                      :stroke-dasharray="arrow.dashed ? '4 3' : 'none'"
                      :marker-end="arrow.color === '#2563eb' ? 'url(#srArrowBlue)' : arrow.color === '#f97316' ? 'url(#srArrowOrange)' : 'url(#srArrowLightBlue)'"
                      :marker-start="arrow.bidir ? (arrow.color === '#2563eb' ? 'url(#srArrowBlueBack)' : '') : ''"
                      opacity="0.75"
                    />
                  </template>
                </template>

                <!-- Nodes -->
                <template v-for="node in stronglyRelLayout.nodes" :key="node.id">
                  <rect :x="node.x" :y="node.y" :width="node.w" :height="node.h" rx="6"
                    :fill="node.type === 'stakeholder' ? '#f1f5f9' : node.type === 'F' ? '#fff7ed' : node.type === 'V' ? '#eff6ff' : node.type === 'C' ? '#fdf4ff' : '#f0f9ff'"
                    :stroke="node.type === 'stakeholder' ? '#94a3b8' : node.type === 'F' ? '#f97316' : node.type === 'V' ? '#3b82f6' : node.type === 'C' ? '#c026d3' : '#0284c7'"
                    stroke-width="1.5" />
                  <text :x="node.x + node.w/2" :y="node.y + node.h/2 + 4" text-anchor="middle" font-size="10"
                    :fill="node.type === 'stakeholder' ? '#64748b' : '#1e293b'" font-weight="500">
                    {{ node.label.length > 17 ? node.label.slice(0, 16) + '…' : node.label }}
                  </text>
                </template>

                <!-- Row labels -->
                <text x="10" y="36" font-size="9" fill="#94a3b8" font-weight="600">STAKEHOLDERS</text>
                <text x="10" y="136" font-size="9" fill="#94a3b8" font-weight="600">FUNCTIONS</text>
                <text x="10" y="236" font-size="9" fill="#94a3b8" font-weight="600">VALUES</text>
                <text x="10" y="336" font-size="9" fill="#94a3b8" font-weight="600">CONSTRAINTS + RESOURCES</text>

                <text v-if="stronglyRelLayout.nodes.length === 0" x="430" y="200" text-anchor="middle" font-size="13" fill="#94a3b8">No entries to visualize</text>
              </svg>
            </div>
          </ScrollContainer>

          <!-- ── 3D MODEL VIEW ─────────────────────────────────────────────── -->
          <ScrollContainer
            v-if="toolMode === 'viz-3d' && selectedModel"
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-5 flex flex-col gap-4"
          >
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
                    :title="`${lvl} level of detail — ${lvl === 'Top' ? 'F entries only' : lvl === 'Medium' ? 'F + V + Stakeholders' : 'All entry types'}`"
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
                    <p class="text-[9px] font-bold text-orange-300 uppercase tracking-widest mb-1">F. Functions</p>
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
                    <p class="text-[9px] font-bold text-violet-300 uppercase tracking-widest mb-1">S. Stakeholders</p>
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
                    <p class="text-[9px] font-bold text-blue-300 uppercase tracking-widest mb-1">V. Values</p>
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
                    <p class="text-[9px] font-bold text-fuchsia-300 uppercase tracking-widest mb-1">C. Constraints</p>
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
                    <p class="text-[9px] font-bold text-sky-300 uppercase tracking-widest mb-1">R. Resources</p>
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
                <span v-else-if="viz3dLevel === 'Medium'" class="text-[9px] text-slate-400 bg-slate-800/80 rounded px-2 py-1">Showing: F · V · S faces</span>
                <span v-else class="text-[9px] text-slate-400 bg-slate-800/80 rounded px-2 py-1">Showing: All 5 entry types</span>
              </div>
            </div>

            <!-- Entry counts legend (3D level-aware) -->
            <div v-if="vizRenderMode === '3d'" class="flex flex-wrap gap-2 text-[10px]">
              <span class="px-2 py-1 rounded bg-orange-100 text-orange-800">F. {{ viz3dFEntries.length }}</span>
              <span v-if="viz3dLevel !== 'Top'" class="px-2 py-1 rounded bg-blue-100 text-blue-800">V. {{ viz3dVEntries.length }}</span>
              <span v-if="viz3dLevel === 'All'" class="px-2 py-1 rounded bg-fuchsia-100 text-fuchsia-800">C. {{ viz3dCEntries.length }}</span>
              <span v-if="viz3dLevel === 'All'" class="px-2 py-1 rounded bg-sky-100 text-sky-800">R. {{ viz3dREntries.length }}</span>
              <span v-if="viz3dLevel !== 'Top'" class="px-2 py-1 rounded bg-violet-100 text-violet-800">S. {{ viz3dSEntries.length }}</span>
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
          </ScrollContainer>

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
                  v-for="d in [{id:'stakeholder',label:'Stakeholder',emoji:'👥',desc:'Add new stakeholders and entries that serve them'},{id:'value',label:'Value',emoji:'📈',desc:'Improve measurable value attributes (V. entries)'},{id:'constraint',label:'Constraint',emoji:'🔒',desc:'Add or refine constraints (C. entries) for the model'}]"
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
                {{ improveDimension === 'stakeholder' ? 'e.g. "Surgical Nurses" — AI will add functions, values, and stakeholders that serve them' : improveDimension === 'value' ? 'e.g. "Better Security" or "Faster response time" — AI adds measurable V. entries and corresponding F. entries' : 'e.g. "For less capital expenditure" or "Within GDPR constraints" — AI adds C. entries and budget-aware alternatives' }}
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
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Version History ({{ selectedModel.versions.length }})</h3>
              <div class="flex flex-col gap-1.5">
                <div
                  v-for="version in [...selectedModel.versions].reverse()"
                  :key="version.id"
                  class="flex items-center gap-3 bg-white rounded-lg ring-1 ring-slate-200 px-4 py-2.5"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-slate-700 truncate">{{ version.name }}</p>
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
                  title="Plan Agent — convert this model to a Planguage plan, analyse problems and improvements"
                  @click="sendToAgent('plan-importer')"
                >
                  <span aria-hidden="true">📄</span>
                  <span>Plan Agent</span>
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
              <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wide">Version History ({{ selectedModel.versions.length }})</h3>
              <div class="flex flex-col gap-1.5">
                <div
                  v-for="version in [...selectedModel.versions].reverse()"
                  :key="version.id"
                  class="flex items-center gap-3 bg-white rounded-lg ring-1 ring-slate-200 px-4 py-2.5"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold text-slate-700 truncate">{{ version.name }}</p>
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
