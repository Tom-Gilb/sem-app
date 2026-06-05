<!-- GetAPlanPanel.vue — "Get A Plan" unified entry point.
     Three tabs:
       📄 Read In      — paste text / URL / file upload → AI parse → use/sharpen/add-to
       🕐 From History — browse plan models + spec versions → load or restore
       🔀 Merge Plans  — multi-select any combination + free text → AI merge → use/sharpen/add-to
     Emits:
       imported(spec)              — replace current plan with spec
       imported-and-sharpen(spec)  — replace + open SharpenPanel immediately
       add-to(spec)                — merge spec into existing live plan
       load-model(model)           — activate a saved PlanModel from history
       restore-version(version)    — restore a saved SpecVersion from history
       close                       — dismiss modal -->

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { openEml } from '../composables/useEmlExport'
import {
  planInputLoading,
  planInputError,
  planInputProgress,
  mergeLoading,
  mergeError,
  extractFromUrl,
  extractFromFile,
  parseAsPlanguage,
  mergePlansAsPlanguage,
  type PlanInputMode,
} from '../composables/useSpecInput'
import { useSpecModel, type PlanModel } from '../composables/useSpecModel'
import { useSpecHistory, type SpecVersion } from '../composables/useSpecHistory'
import type { SpecBlock } from '../types/spec'
import LoadingProgress from './LoadingProgress.vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import AmuseMeButton from './AmuseMeButton.vue'
// DD-001 (2026-05-13).
import SaveGlyph from './icons/SaveGlyph.vue'
import GetGlyph from './icons/GetGlyph.vue'

const props = defineProps<{
  /** True when a live spec is already loaded. Used to warn about replacement. */
  hasCurrentPlan?: boolean
}>()

const emit = defineEmits<{
  imported:              [spec: SpecBlock]
  'imported-and-sharpen': [spec: SpecBlock]
  'add-to':              [spec: SpecBlock]
  'load-model':          [model: PlanModel]
  'restore-version':     [version: SpecVersion]
  close:                 []
}>()

// ── Top-level tab ──────────────────────────────────────────────────────────────

type TopTab = 'read-in' | 'from-history' | 'merge'
const topTab = ref<TopTab>('read-in')

function switchTab(t: TopTab): void {
  topTab.value = t
  readInParsed.value   = null
  mergeParsed.value    = null
  planInputError.value = ''
  mergeError.value     = ''
  showFullSpec.value   = false
  copySpecDone.value   = false
}

// ── History data ──────────────────────────────────────────────────────────────

const { allModels }  = useSpecModel()
const { history }    = useSpecHistory()

// ── TAB 1: Read In ─────────────────────────────────────────────────────────────

const readInMode      = ref<PlanInputMode>('text')
const pastedText      = ref('')
const urlInput        = ref('')
const selectedFile    = ref<File | null>(null)
const fileInputRef    = ref<HTMLInputElement | null>(null)

function triggerFilePicker(): void {
  fileInputRef.value?.click()
}
const readInParsed    = ref<SpecBlock | null>(null)
const showFullSpec    = ref(false)
const copySpecDone    = ref(false)
let _copySpecTimer: ReturnType<typeof setTimeout> | null = null

function selectReadInMode(m: PlanInputMode): void {
  readInMode.value     = m
  readInParsed.value   = null
  planInputError.value = ''
  showFullSpec.value   = false
  copySpecDone.value   = false
}

function handleFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  selectedFile.value   = input.files?.[0] ?? null
  readInParsed.value   = null
  planInputError.value = ''
}

async function handleReadInParse(): Promise<void> {
  planInputError.value    = ''
  readInParsed.value      = null
  planInputLoading.value  = true
  planInputProgress.value = ''

  try {
    if (readInMode.value === 'text') {
      if (!pastedText.value.trim()) { planInputError.value = 'Paste some text to parse.'; return }
      readInParsed.value = await parseAsPlanguage(pastedText.value.trim())
    } else if (readInMode.value === 'url') {
      if (!urlInput.value.trim()) { planInputError.value = 'Enter a URL.'; return }
      const text = await extractFromUrl(urlInput.value.trim())
      readInParsed.value = await parseAsPlanguage(text)
    } else {
      if (!selectedFile.value) { planInputError.value = 'Choose a file.'; return }
      const { text, isPdf, pdfBase64 } = await extractFromFile(selectedFile.value)
      readInParsed.value = await parseAsPlanguage(text, { isPdf, pdfBase64 })
    }

    if (!readInParsed.value) {
      planInputError.value =
        'Could not extract a Planguage spec from this content. ' +
        'Try adding more detail, or paste a longer section of the document.'
    }
    // No scroll needed — success shows the result view at the TOP of the panel.
  } catch (err) {
    planInputError.value = err instanceof Error ? err.message : 'An unexpected error occurred.'
  } finally {
    planInputLoading.value  = false
    planInputProgress.value = ''
  }
}

function handleReadInUse():       void { if (readInParsed.value) emit('imported', readInParsed.value) }
function handleReadInSharpen():   void { if (readInParsed.value) emit('imported-and-sharpen', readInParsed.value) }
function handleReadInAddTo():     void { if (readInParsed.value) emit('add-to', readInParsed.value) }

/** Go back to the input form from the results view. */
function resetReadIn(): void {
  readInParsed.value   = null
  planInputError.value = ''
  showFullSpec.value   = false
  copySpecDone.value   = false
}

/** Build a plain-text summary of the extracted spec for clipboard copy. */
function _buildSpecPlainText(spec: SpecBlock): string {
  const lines: string[] = ['Extracted Planguage Spec', '']
  spec.functions.forEach(f => {
    lines.push(`F. ${f.id}  ${f.description}`)
    if (f.successCriteria) lines.push(`   ✓ ${f.successCriteria}`)
  })
  if (spec.functions.length) lines.push('')
  spec.values.forEach(v => {
    lines.push(`V. ${v.id}  ${v.description}`)
    if (v.scale)     lines.push(`   Scale:     ${v.scale}`)
    if (v.meter)     lines.push(`   Meter:     ${v.meter}`)
    if (v.status)    lines.push(`   Status:    ${v.status}`)
    if (v.tolerable) lines.push(`   Tolerable: ${v.tolerable}`)
    if (v.goal)      lines.push(`   Goal:      ${v.goal}`)
  })
  if (spec.values.length) lines.push('')
  spec.solutions.forEach(s => {
    lines.push(`S. ${s.id}  ${s.description}`)
    if (s.impact) lines.push(`   Impact: ${s.impact}`)
  })
  return lines.join('\n').trim()
}

async function copyExtractedSpec(): Promise<void> {
  if (!readInParsed.value) return
  try {
    await navigator.clipboard.writeText(_buildSpecPlainText(readInParsed.value))
  } catch { /* silently ignore clipboard permission errors */ }
  copySpecDone.value = true
  if (_copySpecTimer) clearTimeout(_copySpecTimer)
  _copySpecTimer = setTimeout(() => { copySpecDone.value = false }, 10_000)
}

// ── TAB 2: From History ────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return iso }
}

function fmtTs(ts: number): string {
  try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return String(ts) }
}

// ── TAB 2: From History — type-safe click handlers (no casts in template) ──────

/** Called from template v-for: load a plan model (cast safely in script) */
function handleHistoryLoadModel(raw: unknown): void {
  emit('load-model', raw as PlanModel)
}

/** Called from template v-for: restore a spec version (cast safely in script) */
function handleHistoryRestoreVersion(raw: unknown): void {
  emit('restore-version', raw as SpecVersion)
}

// ── TAB 3: Merge Plans ─────────────────────────────────────────────────────────

/** IDs of selected plan models for merge */
const mergeModelIds    = ref<Set<string>>(new Set())
/** IDs of selected spec versions for merge */
const mergeVersionIds  = ref<Set<string>>(new Set())
const mergeFreeText    = ref('')
const mergeParsed      = ref<SpecBlock | null>(null)
const scrollMergeRef   = ref<InstanceType<typeof ScrollContainer> | null>(null)

/** Human-readable labels of the sources selected at the time "Merge" was clicked */
const mergeSourceLabels = ref<string[]>([])

/** Snapshot of the live spec at the moment merging started (to compute a diff) */
const mergeBeforeSpec = ref<SpecBlock | null>(null)

/** Per-entry diff: new entries (in merged but not in before-spec, by ID) */
const mergeDiffNew = computed<{ id: string; entryType: 'F' | 'V' | 'S'; description: string }[]>(() => {
  if (!mergeParsed.value || !mergeBeforeSpec.value) return []
  const beforeIds = new Set([
    ...mergeBeforeSpec.value.functions.map(e => e.id),
    ...mergeBeforeSpec.value.values.map(e => e.id),
    ...mergeBeforeSpec.value.solutions.map(e => e.id),
  ])
  return [
    ...mergeParsed.value.functions.filter(e => !beforeIds.has(e.id)).map(e => ({ id: e.id, entryType: 'F' as const, description: e.description })),
    ...mergeParsed.value.values.filter(e => !beforeIds.has(e.id)).map(e => ({ id: e.id, entryType: 'V' as const, description: e.description })),
    ...mergeParsed.value.solutions.filter(e => !beforeIds.has(e.id)).map(e => ({ id: e.id, entryType: 'S' as const, description: e.description })),
  ]
})

const mergeDiffCounts = computed(() => {
  const spec = mergeParsed.value
  if (!spec) return { F: 0, V: 0, S: 0, total: 0 }
  return {
    F: spec.functions.length,
    V: spec.values.length,
    S: spec.solutions.length,
    total: spec.functions.length + spec.values.length + spec.solutions.length,
  }
})

function toggleMergeModel(id: string): void {
  const next = new Set(mergeModelIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  mergeModelIds.value = next
}

function toggleMergeVersion(id: string): void {
  const next = new Set(mergeVersionIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  mergeVersionIds.value = next
}

const mergeSelectionCount = computed(() =>
  mergeModelIds.value.size + mergeVersionIds.value.size + (mergeFreeText.value.trim() ? 1 : 0),
)

function _serializeModel(m: PlanModel): string {
  return `Plan Model: "${m.name}" v${m.version} (updated ${fmtDate(m.updatedAt)})\n` +
         JSON.stringify(m.spec, null, 2)
}

function _serializeVersion(sv: SpecVersion): string {
  return `Spec Version: "${sv.label}" — ${sv.summary} (${fmtTs(sv.timestamp)})\n` +
         JSON.stringify(sv.spec, null, 2)
}

async function handleMerge(): Promise<void> {
  mergeError.value        = ''
  mergeParsed.value       = null
  mergeSourceLabels.value = []
  mergeBeforeSpec.value   = props.hasCurrentPlan ? null : null  // reset

  const inputs: string[] = []
  const labels: string[] = []

  for (const m of allModels.value) {
    if (mergeModelIds.value.has(m.id)) {
      inputs.push(_serializeModel(m as PlanModel))
      labels.push(`📋 ${(m as PlanModel).name} v${(m as PlanModel).version}`)
    }
  }
  for (const sv of history.value) {
    if (mergeVersionIds.value.has(sv.id)) {
      inputs.push(_serializeVersion(sv))
      labels.push(`🕐 ${sv.label} (${fmtTs(sv.timestamp)})`)
    }
  }
  if (mergeFreeText.value.trim()) {
    inputs.push(mergeFreeText.value.trim())
    labels.push('📝 Free text')
  }

  if (!inputs.length) {
    mergeError.value = 'Select at least one source or add some text before merging.'
    return
  }

  mergeSourceLabels.value = labels

  mergeParsed.value = await mergePlansAsPlanguage(inputs)

  if (!mergeParsed.value && !mergeError.value) {
    mergeError.value = 'Could not merge the selected sources into a valid spec. Try adding more content.'
  } else if (mergeParsed.value) {
    await nextTick()
    const el = scrollMergeRef.value?.el
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
}

function handleMergeUse():     void { if (mergeParsed.value) emit('imported', mergeParsed.value) }
function handleMergeSharpen(): void { if (mergeParsed.value) emit('imported-and-sharpen', mergeParsed.value) }
function handleMergeAddTo():   void { if (mergeParsed.value) emit('add-to', mergeParsed.value) }

// ── Export: Copy & Email as colored HTML tables ────────────────────────────────
// Colorful Exports Rule (2026-05-26): every export MUST be a colored HTML table.
// Pattern mirrors PrioritisedPlanView.vue copyRich() / buildFullPlanClipboardHTML().
// Inline styles only — sanitizers strip external <style> blocks.

const _EF  = '-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif'
const _ETB = `border-collapse:collapse;font-family:${_EF};font-size:13px;width:100%;margin-bottom:16px`
const _ETD = 'padding:8px 12px;border:1px solid #e5e7eb;color:#374151;vertical-align:top;white-space:normal'
const _ETA = `${_ETD};background:#f9fafb`

function _eEsc(s: string | undefined | null): string {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function _eTH(bg: string): string {
  return `background:${bg};color:#fff;padding:8px 12px;font-size:12px;font-weight:700;text-align:left;white-space:normal`
}
function _eNow(): string {
  const d = new Date()
  return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
function _eReadInSource(): string {
  if (readInMode.value === 'url')  return `URL: ${urlInput.value}`
  if (readInMode.value === 'file') return `File: ${selectedFile.value?.name ?? 'unknown'}`
  return 'Pasted text'
}

function _eHeaderTable(title: string, detail: string, source: string, ts: string): string {
  return `<table style="${_ETB}"><tbody>
    <tr>
      <td style="background:#0f172a;color:#f1f5f9;padding:10px 14px;font-size:15px;font-weight:700;letter-spacing:-0.01em">
        SEM — ${_eEsc(title)}
      </td>
      <td style="background:#0f172a;color:#94a3b8;padding:10px 14px;font-size:11px;text-align:right;white-space:nowrap;vertical-align:middle">
        ${_eEsc(ts)}
      </td>
    </tr>
    <tr>
      <td style="background:#1e293b;color:#cbd5e1;padding:6px 14px;font-size:11px">${_eEsc(detail)}</td>
      <td style="background:#1e293b;color:#64748b;padding:6px 14px;font-size:11px;text-align:right;white-space:nowrap">
        Source: ${_eEsc(source)}
      </td>
    </tr>
  </tbody></table>`
}

function _eFTable(spec: SpecBlock): string {
  if (!spec.functions.length) return ''
  const H = _eTH('#1d4ed8')
  let t = `<table style="${_ETB}">
    <caption style="text-align:left;padding:4px 0;font-size:11px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.05em">
      F. Functions (${spec.functions.length})
    </caption>
    <thead><tr>
      <th style="${H}">F. Function</th>
      <th style="${H}">Presence Test</th>
      <th style="${H}">For Value</th>
    </tr></thead><tbody>`
  spec.functions.forEach((f, i) => {
    const td = i % 2 === 0 ? _ETD : _ETA
    const pt = _eEsc(f.presenceTest ?? f.successCriteria)
    t += `<tr>
      <td style="${td};font-weight:600">${_eEsc(f.description)}</td>
      <td style="${td}">${pt}</td>
      <td style="${td}">${_eEsc(f.functionOfValue)}</td>
    </tr>`
  })
  return t + '</tbody></table>'
}

function _eVTable(spec: SpecBlock): string {
  if (!spec.values.length) return ''
  const H = _eTH('#6d28d9')
  let t = `<table style="${_ETB}">
    <caption style="text-align:left;padding:4px 0;font-size:11px;font-weight:700;color:#6d28d9;text-transform:uppercase;letter-spacing:.05em">
      V. Values (${spec.values.length})
    </caption>
    <thead><tr>
      <th style="${H}">V. Value</th>
      <th style="${H}">Scale</th>
      <th style="${H}">Meter</th>
      <th style="${H}">Status</th>
      <th style="${H}">Tolerable</th>
      <th style="${H}">Goal</th>
    </tr></thead><tbody>`
  spec.values.forEach((v, i) => {
    const td = i % 2 === 0 ? _ETD : _ETA
    t += `<tr>
      <td style="${td};font-weight:600">${_eEsc(v.description)}</td>
      <td style="${td}">${_eEsc(v.scale)}</td>
      <td style="${td}">${_eEsc(v.meter)}</td>
      <td style="${td}">${_eEsc(v.status)}</td>
      <td style="${td}">${_eEsc(v.tolerable)}</td>
      <td style="${td}">${_eEsc(v.goal)}</td>
    </tr>`
  })
  return t + '</tbody></table>'
}

function _eSTable(spec: SpecBlock): string {
  if (!spec.solutions.length) return ''
  const H = _eTH('#c2410c')
  let t = `<table style="${_ETB}">
    <caption style="text-align:left;padding:4px 0;font-size:11px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:.05em">
      S. Solutions (${spec.solutions.length})
    </caption>
    <thead><tr>
      <th style="${H}">S. Solution</th>
      <th style="${H}">Impact</th>
      <th style="${H}">For Function</th>
    </tr></thead><tbody>`
  spec.solutions.forEach((s, i) => {
    const td = i % 2 === 0 ? _ETD : _ETA
    t += `<tr>
      <td style="${td};font-weight:600">${_eEsc(s.description)}</td>
      <td style="${td}">${_eEsc(s.impact)}</td>
      <td style="${td}">${_eEsc(s.function)}</td>
    </tr>`
  })
  return t + '</tbody></table>'
}

function _eOrigTable(rawText: string, sourceLabel: string): string {
  if (!rawText.trim()) return ''
  const H = _eTH('#374151')
  return `<table style="${_ETB}">
    <caption style="text-align:left;padding:4px 0;font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em">
      Original Input — ${_eEsc(sourceLabel)}
    </caption>
    <thead><tr><th style="${H}">Original Text</th></tr></thead>
    <tbody><tr>
      <td style="${_ETD};white-space:pre-wrap;font-family:monospace;font-size:11px;max-width:600px">${_eEsc(rawText)}</td>
    </tr></tbody>
  </table>`
}

function _eWrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:${_EF};padding:16px;background:#fff;max-width:900px">${body}</body></html>`
}

type ExportSection = 'all' | 'F' | 'V' | 'S'

// ── Read In export builders ────────────────────────────────────────────────────
function _buildReadInHtml(spec: SpecBlock, section: ExportSection, ts: string): string {
  const source = _eReadInSource()
  const counts = `${spec.functions.length}F · ${spec.values.length}V · ${spec.solutions.length}S`
  const detail = section === 'all' ? `Parse Results — ${counts}` :
    section === 'F' ? `Functions (${spec.functions.length})` :
    section === 'V' ? `Values (${spec.values.length})` :
                      `Solutions (${spec.solutions.length})`
  let body = _eHeaderTable('Parse Results', detail, source, ts)
  if (section === 'all' || section === 'F') body += _eFTable(spec)
  if (section === 'all' || section === 'V') body += _eVTable(spec)
  if (section === 'all' || section === 'S') body += _eSTable(spec)
  const rawText = readInMode.value === 'text' ? pastedText.value : ''
  body += _eOrigTable(rawText, source)
  return _eWrap(body)
}

function _buildReadInTsv(spec: SpecBlock, section: ExportSection, ts: string): string {
  const source = _eReadInSource()
  const lines: string[] = [`SEM Parse Results · ${ts} · Source: ${source}`, '']
  if (section === 'all' || section === 'F') {
    lines.push('── Functions ──')
    spec.functions.forEach(f => {
      lines.push(`F. ${f.description}`)
      const pt = f.presenceTest ?? f.successCriteria
      if (pt) lines.push(`   Presence test: ${pt}`)
      if (f.functionOfValue) lines.push(`   For value: ${f.functionOfValue}`)
    })
    lines.push('')
  }
  if (section === 'all' || section === 'V') {
    lines.push('── Values ──')
    spec.values.forEach(v => {
      lines.push(`V. ${v.description}`)
      if (v.scale)     lines.push(`   Scale:     ${v.scale}`)
      if (v.meter)     lines.push(`   Meter:     ${v.meter}`)
      if (v.tolerable) lines.push(`   Tolerable: ${v.tolerable}`)
      if (v.goal)      lines.push(`   Goal:      ${v.goal}`)
    })
    lines.push('')
  }
  if (section === 'all' || section === 'S') {
    lines.push('── Solutions ──')
    spec.solutions.forEach(s => {
      lines.push(`S. ${s.description}`)
      if (s.impact) lines.push(`   Impact: ${s.impact}`)
    })
  }
  if (readInMode.value === 'text' && pastedText.value.trim()) {
    lines.push('', '── Original Input ──', pastedText.value)
  }
  return lines.join('\n').trim()
}

// ── Merge export builders ──────────────────────────────────────────────────────
function _buildMergeHtml(spec: SpecBlock, section: ExportSection, ts: string): string {
  const source = mergeSourceLabels.value.join(' · ') || 'Merge'
  const counts = `${spec.functions.length}F · ${spec.values.length}V · ${spec.solutions.length}S`
  const detail = section === 'all' ? `Merge Results — ${counts}` :
    section === 'F' ? `Functions (${spec.functions.length})` :
    section === 'V' ? `Values (${spec.values.length})` :
                      `Solutions (${spec.solutions.length})`
  let body = _eHeaderTable('Merge Results', detail, source, ts)
  if (section === 'all' || section === 'F') body += _eFTable(spec)
  if (section === 'all' || section === 'V') body += _eVTable(spec)
  if (section === 'all' || section === 'S') body += _eSTable(spec)
  if (mergeFreeText.value.trim()) body += _eOrigTable(mergeFreeText.value, 'Free text input')
  return _eWrap(body)
}

function _buildMergeTsv(spec: SpecBlock, section: ExportSection, ts: string): string {
  const source = mergeSourceLabels.value.join(' · ') || 'Merge'
  const lines: string[] = [`SEM Merge Results · ${ts} · Sources: ${source}`, '']
  if (section === 'all' || section === 'F') {
    lines.push('── Functions ──')
    spec.functions.forEach(f => {
      lines.push(`F. ${f.description}`)
      const pt = f.presenceTest ?? f.successCriteria
      if (pt) lines.push(`   Presence test: ${pt}`)
      if (f.functionOfValue) lines.push(`   For value: ${f.functionOfValue}`)
    })
    lines.push('')
  }
  if (section === 'all' || section === 'V') {
    lines.push('── Values ──')
    spec.values.forEach(v => {
      lines.push(`V. ${v.description}`)
      if (v.scale)     lines.push(`   Scale:     ${v.scale}`)
      if (v.meter)     lines.push(`   Meter:     ${v.meter}`)
      if (v.tolerable) lines.push(`   Tolerable: ${v.tolerable}`)
      if (v.goal)      lines.push(`   Goal:      ${v.goal}`)
    })
    lines.push('')
  }
  if (section === 'all' || section === 'S') {
    lines.push('── Solutions ──')
    spec.solutions.forEach(s => {
      lines.push(`S. ${s.description}`)
      if (s.impact) lines.push(`   Impact: ${s.impact}`)
    })
  }
  if (mergeFreeText.value.trim()) {
    lines.push('', '── Free text input ──', mergeFreeText.value)
  }
  return lines.join('\n').trim()
}

// ── Rich clipboard writer ──────────────────────────────────────────────────────
// Writes text/html + text/plain together: HTML-capable apps (Mail, Keynote, Pages,
// Notes) receive styled colored tables; plain-text apps get TSV fallback.
const copiedExport = ref<string | null>(null)
let _exportTimer: ReturnType<typeof setTimeout> | null = null

async function _copyRich(key: string, html: string, tsv: string): Promise<void> {
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
  copiedExport.value = key
  if (_exportTimer) clearTimeout(_exportTimer)
  _exportTimer = setTimeout(() => { copiedExport.value = null }, 4000)
}

async function copyReadIn(section: ExportSection): Promise<void> {
  if (!readInParsed.value) return
  const ts = _eNow()
  await _copyRich(`ri-${section}`, _buildReadInHtml(readInParsed.value, section, ts), _buildReadInTsv(readInParsed.value, section, ts))
}

async function emailReadIn(): Promise<void> {
  if (!readInParsed.value) return
  const ts   = _eNow()
  const spec = readInParsed.value
  const subj = `SEM Parse Results — ${spec.functions.length}F ${spec.values.length}V ${spec.solutions.length}S · ${ts}`
  openEml(_buildReadInHtml(spec, 'all', ts), subj)
}

async function copyMerge(section: ExportSection): Promise<void> {
  if (!mergeParsed.value) return
  const ts = _eNow()
  await _copyRich(`mg-${section}`, _buildMergeHtml(mergeParsed.value, section, ts), _buildMergeTsv(mergeParsed.value, section, ts))
}

async function emailMerge(): Promise<void> {
  if (!mergeParsed.value) return
  const ts   = _eNow()
  const spec = mergeParsed.value
  const subj = `SEM Merge Results — ${spec.functions.length}F ${spec.values.length}V ${spec.solutions.length}S · ${ts}`
  openEml(_buildMergeHtml(spec, 'all', ts), subj)
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel -->
    <div
      class="fixed inset-0 z-[510] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Get A Plan"
    >
      <div class="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto max-h-[90vh]">

        <!-- ── Header ── -->
        <div class="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-t-2xl flex-shrink-0">
          <div class="flex items-center gap-2 text-white">
            <GetGlyph size="standard" class="h-4 w-auto" aria-hidden="true" />
            <h2 class="text-sm font-semibold text-white tracking-wide">Get a Spec</h2>
          </div>
          <!-- Close — universal CloseDot per "Universal Close-Button Rule" -->
          <CloseDot
            variant="on-dark"
            aria-label="Close Get A Plan"
            @click="emit('close')"
          />
        </div>

        <!-- ── Top-level tab bar ── -->
        <div
          class="flex border-b border-slate-200 bg-slate-50 flex-shrink-0 px-2 pt-2 gap-1"
          role="tablist"
          aria-label="Plan source"
        >
          <button
            v-for="tab in ([
              { key: 'read-in',      icon: '📄', label: 'Read In' },
              { key: 'from-history', icon: '🕐', label: 'From History' },
              { key: 'merge',        icon: '🔀', label: 'Merge Plans' },
            ] as const)"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="topTab === tab.key"
            :class="[
              'flex items-center gap-1.5 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 -mb-px',
              topTab === tab.key
                ? 'border-indigo-500 text-indigo-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60',
            ]"
            @click="switchTab(tab.key)"
          >
            <span aria-hidden="true">{{ tab.icon }}</span>
            {{ tab.label }}
          </button>
        </div>

        <!-- ══════════════════════════════════════════════════════════════
             TAB 1 — READ IN
        ═══════════════════════════════════════════════════════════════ -->
        <template v-if="topTab === 'read-in'">
          <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full p-5 space-y-5">

            <!-- ═══ RESULTS VIEW — shown at the TOP as soon as parse succeeds ═══ -->
            <!-- No scrolling needed: swapping the form for the result means the  -->
            <!-- result is always the first thing visible when loading stops.      -->
            <template v-if="readInParsed && !planInputLoading">

              <!-- Back-link — lets user re-parse without closing the panel -->
              <button
                type="button"
                class="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                @click="resetReadIn"
              >
                <span aria-hidden="true">←</span> Parse another document
              </button>

              <div class="space-y-4">

                <!-- ✅ count banner -->
                <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span class="text-lg shrink-0" aria-hidden="true">✅</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-emerald-800 font-medium">
                      Extracted
                      <strong>{{ readInParsed.functions.length }}F</strong> ·
                      <strong>{{ readInParsed.values.length }}V</strong> ·
                      <strong>{{ readInParsed.solutions.length }}S</strong>
                      — all included when you import below
                    </p>
                    <p v-if="readInParsed.stakes" class="text-xs text-emerald-700 mt-0.5 truncate">
                      Stakes: {{ readInParsed.stakes }}
                    </p>
                  </div>
                </div>

                <!-- ── Action buttons — immediately below the banner so they are always visible ── -->
                <div class="space-y-2">
                  <button
                    v-if="props.hasCurrentPlan"
                    type="button"
                    class="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl
                           bg-emerald-600 text-white text-sm font-semibold
                           hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 transition-colors"
                    @click="handleReadInAddTo"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                    Add to current plan
                    <span class="text-emerald-200 text-xs font-normal">(keeps existing entries)</span>
                  </button>
                  <div class="flex gap-3">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1.5 min-h-[48px] rounded-xl text-sm font-semibold
                             focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
                      :class="props.hasCurrentPlan
                        ? 'bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-400'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-400'"
                      @click="handleReadInUse"
                    >
                      <span aria-hidden="true">{{ props.hasCurrentPlan ? '↩' : '✓' }}</span>
                      {{ props.hasCurrentPlan ? 'Replace current plan' : 'Use this spec' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1.5 min-h-[48px]
                             rounded-xl bg-amber-500 text-white text-sm font-semibold
                             hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 transition-colors"
                      @click="handleReadInSharpen"
                    >
                      <span aria-hidden="true">🔪</span> Use + Sharpen
                    </button>
                  </div>
                </div>

                <!-- ── Copy & Email export ── -->
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Copy &amp; Email Parse Results</p>

                  <!-- All-3 row -->
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg
                             bg-slate-800 text-white text-xs font-semibold
                             hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
                             transition-colors"
                      title="Copy all 3 components (Functions + Values + Solutions) as a colored HTML table — paste with ⌘V in Mail, Keynote, or Notes. Includes original input text and timestamp."
                      :aria-label="copiedExport === 'ri-all' ? 'Copied!' : 'Copy all 3 components as colored HTML tables'"
                      @click="copyReadIn('all')"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'ri-all' ? '✓' : '📋' }}</span>
                      {{ copiedExport === 'ri-all' ? 'Copied!' : 'Copy All · F + V + S' }}
                    </button>
                    <button
                      type="button"
                      class="flex items-center justify-center gap-1.5 px-4 min-h-[40px] rounded-lg
                             bg-indigo-600 text-white text-xs font-semibold
                             hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1
                             transition-colors"
                      title="Copy all results to clipboard as colored tables, then open Mail.app — paste with ⌘V in the email body for full-color tables. Subject line includes entry counts and timestamp."
                      :aria-label="copiedExport === 'ri-email' ? 'Copied — Mail opening' : 'Email all parse results'"
                      @click="emailReadIn"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'ri-email' ? '✓' : '✉️' }}</span>
                      {{ copiedExport === 'ri-email' ? 'Opening Mail…' : 'Mail All' }}
                    </button>
                  </div>

                  <!-- Individual component row -->
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-blue-300 bg-blue-50 text-blue-700 text-xs font-semibold
                             hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy Functions only (${readInParsed?.functions.length ?? 0} entries) as a colored blue HTML table — paste with ⌘V. Includes original input and timestamp.`"
                      :aria-label="copiedExport === 'ri-F' ? 'Functions copied' : 'Copy Functions only'"
                      @click="copyReadIn('F')"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'ri-F' ? '✓' : 'F.' }}</span>
                      {{ copiedExport === 'ri-F' ? 'Copied' : 'Functions' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-violet-300 bg-violet-50 text-violet-700 text-xs font-semibold
                             hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy Values only (${readInParsed?.values.length ?? 0} entries) as a colored violet HTML table — paste with ⌘V. Includes Scale, Meter, Tolerable, Goal, original input, and timestamp.`"
                      :aria-label="copiedExport === 'ri-V' ? 'Values copied' : 'Copy Values only'"
                      @click="copyReadIn('V')"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'ri-V' ? '✓' : 'V.' }}</span>
                      {{ copiedExport === 'ri-V' ? 'Copied' : 'Values' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-orange-300 bg-orange-50 text-orange-700 text-xs font-semibold
                             hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy Solutions only (${readInParsed?.solutions.length ?? 0} entries) as a colored orange HTML table — paste with ⌘V. Includes Impact, For Function, original input, and timestamp.`"
                      :aria-label="copiedExport === 'ri-S' ? 'Solutions copied' : 'Copy Solutions only'"
                      @click="copyReadIn('S')"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'ri-S' ? '✓' : 'S.' }}</span>
                      {{ copiedExport === 'ri-S' ? 'Copied' : 'Solutions' }}
                    </button>
                  </div>

                  <!-- Confirmation hint -->
                  <p
                    v-if="copiedExport?.startsWith('ri-')"
                    class="text-[11px] text-emerald-600 text-center"
                    role="status"
                    aria-live="polite"
                  >
                    ✓ Copied — paste with ⌘V in Mail, Keynote, or Notes for full-color tables
                  </p>
                </div>

                <!-- ── Preview (supplementary — below the CTAs) ── -->
                <div class="border-t border-slate-100 pt-3 space-y-3">

                  <!-- Preview toggle + copy -->
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors
                             focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      :class="showFullSpec
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'"
                      @click="showFullSpec = !showFullSpec"
                    >
                      <span aria-hidden="true">{{ showFullSpec ? '▾' : '▸' }}</span>
                      {{ showFullSpec ? 'Hide entries' : 'Preview all entries' }}
                    </button>
                    <button
                      type="button"
                      class="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors
                             focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      :class="copySpecDone
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'"
                      :aria-label="copySpecDone ? 'Copied' : 'Copy extracted spec to clipboard'"
                      @click="copyExtractedSpec"
                    >
                      <span aria-hidden="true">{{ copySpecDone ? '✓' : '📋' }}</span>
                      {{ copySpecDone ? 'Copied' : 'Copy' }}
                    </button>
                  </div>

                  <!-- Full spec list (expanded) -->
                  <ScrollContainer v-if="showFullSpec" outer-class="rounded-xl border border-slate-200 bg-slate-50 relative" inner-class="p-3 space-y-3" inner-style="max-height: 16rem" :no-pill="true">
                    <!-- Functions -->
                    <div v-if="readInParsed.functions.length">
                      <p class="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-1.5">Functions ({{ readInParsed.functions.length }})</p>
                      <div class="space-y-2">
                        <div v-for="f in readInParsed.functions" :key="f.id" class="text-xs">
                          <div class="flex items-start gap-2">
                            <span class="shrink-0 font-mono font-bold text-green-600 w-[90px]">{{ f.id }}</span>
                            <span class="text-slate-700">{{ f.description }}</span>
                          </div>
                          <p v-if="f.successCriteria" class="ml-[98px] text-slate-400 mt-0.5">✓ {{ f.successCriteria }}</p>
                        </div>
                      </div>
                    </div>
                    <!-- Values -->
                    <div v-if="readInParsed.values.length">
                      <p class="text-[10px] font-bold text-violet-600 uppercase tracking-wide mb-1.5">Values ({{ readInParsed.values.length }})</p>
                      <div class="space-y-2">
                        <div v-for="v in readInParsed.values" :key="v.id" class="text-xs">
                          <div class="flex items-start gap-2">
                            <span class="shrink-0 font-mono font-bold text-violet-600 w-[90px]">{{ v.id }}</span>
                            <span class="text-slate-700">{{ v.description }}</span>
                          </div>
                          <div class="ml-[98px] mt-0.5 space-y-0.5 text-[11px] text-slate-500">
                            <p v-if="v.scale">📐 {{ v.scale }}</p>
                            <p v-if="v.tolerable">🟡 Tolerable: {{ v.tolerable }}</p>
                            <p v-if="v.goal">⭐ Goal: {{ v.goal }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <!-- Solutions -->
                    <div v-if="readInParsed.solutions.length">
                      <p class="text-[10px] font-bold text-orange-600 uppercase tracking-wide mb-1.5">Solutions ({{ readInParsed.solutions.length }})</p>
                      <div class="space-y-1.5">
                        <div v-for="s in readInParsed.solutions" :key="s.id" class="flex items-start gap-2 text-xs">
                          <span class="shrink-0 font-mono font-bold text-orange-600 w-[90px]">{{ s.id }}</span>
                          <span class="text-slate-700">{{ s.description }}</span>
                        </div>
                      </div>
                    </div>
                  </ScrollContainer>

                  <!-- Compact cross-type preview (collapsed) — shows F + V + S so all types are visible -->
                  <div v-else class="space-y-1">
                    <div v-for="f in readInParsed.functions.slice(0, 2)" :key="f.id" class="flex items-start gap-2 text-xs text-slate-600">
                      <span class="shrink-0 font-mono text-green-600 font-semibold w-[86px]">{{ f.id }}</span>
                      <span class="truncate">{{ f.description }}</span>
                    </div>
                    <div v-for="v in readInParsed.values.slice(0, 2)" :key="v.id" class="flex items-start gap-2 text-xs text-slate-600">
                      <span class="shrink-0 font-mono text-violet-600 font-semibold w-[86px]">{{ v.id }}</span>
                      <span class="truncate">{{ v.description }}</span>
                    </div>
                    <div v-for="s in readInParsed.solutions.slice(0, 1)" :key="s.id" class="flex items-start gap-2 text-xs text-slate-600">
                      <span class="shrink-0 font-mono text-orange-500 font-semibold w-[86px]">{{ s.id }}</span>
                      <span class="truncate">{{ s.description }}</span>
                    </div>
                    <p class="text-[11px] text-slate-400 italic pt-0.5">
                      ▸ Preview all entries above to see complete spec
                    </p>
                  </div>

                </div>
              </div>
            </template>

            <!-- ═══ INPUT FORM — shown while no result is available ═══ -->
            <template v-else>

              <!-- Format availability grid -->
              <div class="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p class="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1.5">✅ Supported</p>
                  <ul class="space-y-0.5 text-[11px] text-slate-600 leading-relaxed">
                    <li>PDF <span class="text-slate-400">(.pdf)</span></li>
                    <li>Word <span class="text-slate-400">(.docx)</span></li>
                    <li>Plain text <span class="text-slate-400">(.txt · .md)</span></li>
                    <li>HTML <span class="text-slate-400">(.html)</span></li>
                    <li>CSV <span class="text-slate-400">(.csv)</span></li>
                    <li>RTF <span class="text-slate-400">(.rtf)</span></li>
                    <li>Any pasted text</li>
                    <li>Public web URLs</li>
                    <li>Google Docs / Sheets / Slides <span class="text-slate-400">("anyone with link")</span></li>
                  </ul>
                </div>
                <div>
                  <p class="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1.5">❌ Not available</p>
                  <ul class="space-y-0.5 text-[11px] text-slate-600 leading-relaxed">
                    <li>.doc <span class="text-slate-400">→ save as .docx</span></li>
                    <li>PowerPoint <span class="text-slate-400">→ export as PDF</span></li>
                    <li>Excel <span class="text-slate-400">→ save as CSV</span></li>
                    <li>Keynote / Pages <span class="text-slate-400">→ export as PDF</span></li>
                    <li>Private URLs <span class="text-slate-400">→ paste content instead</span></li>
                  </ul>
                </div>
              </div>

              <!-- Input mode sub-tabs -->
              <div class="flex rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1" role="tablist" aria-label="Input mode">
                <button
                  v-for="(tab, i) in ([
                    { key: 'text', icon: '📝', label: 'Paste text' },
                    { key: 'url',  icon: '🔗', label: 'URL' },
                    { key: 'file', icon: '📄', label: 'Upload file' },
                  ] as const)"
                  :key="i"
                  type="button"
                  role="tab"
                  :aria-selected="readInMode === tab.key"
                  :class="[
                    'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                    readInMode === tab.key
                      ? 'bg-white shadow-sm text-indigo-700 border border-indigo-100'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/60',
                  ]"
                  @click="selectReadInMode(tab.key)"
                >
                  <span aria-hidden="true">{{ tab.icon }}</span>
                  {{ tab.label }}
                </button>
              </div>

              <!-- Paste text -->
              <div v-if="readInMode === 'text'" class="space-y-2">
                <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wide" for="plan-paste">
                  Plan content
                </label>
                <textarea
                  id="plan-paste"
                  v-model="pastedText"
                  rows="10"
                  class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                         resize-y placeholder:text-slate-400 font-mono"
                  placeholder="Paste your plan, strategy doc, project brief, meeting notes, OKRs, roadmap — any text…"
                  :disabled="planInputLoading"
                />
                <p class="text-xs text-slate-400">Works with any plain text: Word copy-paste, PDF copy-paste, Notion export, email, slides notes…</p>
                <div v-if="pastedText.trim()" class="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs text-indigo-700">
                  <span aria-hidden="true">👇</span>
                  Text ready — click <strong>Parse as Planguage Spec</strong> below.
                </div>
              </div>

              <!-- URL -->
              <div v-else-if="readInMode === 'url'" class="space-y-3">
                <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wide" for="plan-url">
                  Page URL
                </label>
                <input
                  id="plan-url"
                  v-model="urlInput"
                  type="url"
                  class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                         placeholder:text-slate-400"
                  placeholder="https://…"
                  :disabled="planInputLoading"
                  @keydown.enter="handleReadInParse"
                />
                <div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 space-y-1">
                  <p><strong>Works best with:</strong> public web pages, Confluence/Notion public links, GitHub READMEs, Google Docs (published to web).</p>
                  <p><strong>Behind a login?</strong> Copy-paste the content into the text tab instead.</p>
                </div>
              </div>

              <!-- File upload -->
              <div v-else class="space-y-3">
                <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Choose file</p>

                <!-- Hidden real file input — triggered by the button below -->
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,.rtf,.html,.htm,.csv"
                  class="sr-only"
                  :disabled="planInputLoading"
                  @change="handleFileChange"
                />

                <!-- Explicit Browse button — always visible, always clickable -->
                <button
                  type="button"
                  class="w-full flex items-center justify-center gap-3 min-h-[56px] rounded-xl
                         border-2 border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold text-sm
                         hover:bg-indigo-100 hover:border-indigo-500
                         active:scale-[0.98] transition-all duration-150
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
                         disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Click to open the Mac file picker and choose a PDF, Word, Text, Markdown, HTML or CSV file"
                  :disabled="planInputLoading"
                  @click="triggerFilePicker"
                >
                  <span class="text-2xl leading-none" aria-hidden="true">📂</span>
                  <span>{{ selectedFile ? 'Change file…' : 'Browse for file on Mac…' }}</span>
                </button>

                <!-- Selected file chip -->
                <div
                  v-if="selectedFile"
                  class="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200"
                >
                  <span class="text-2xl leading-none shrink-0" aria-hidden="true">📄</span>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-indigo-800 truncate">{{ selectedFile.name }}</p>
                    <p class="text-xs text-slate-400">
                      {{ (selectedFile.size / 1024).toFixed(0) }} KB · {{ selectedFile.name.split('.').pop()?.toUpperCase() }}
                    </p>
                  </div>
                </div>

                <p class="text-xs text-slate-400">Supports: PDF · Word (.docx) · Text · Markdown · HTML · CSV</p>
              </div>

              <!-- Replace warning -->
              <div
                v-if="props.hasCurrentPlan"
                class="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                role="alert"
              >
                <span class="flex-shrink-0 text-base" aria-hidden="true">⚠️</span>
                <div>
                  <p class="font-semibold">This will replace your current live plan.</p>
                  <p class="text-xs text-amber-700 mt-0.5">
                    Save first
                    (<span class="inline-flex items-center gap-1 align-middle"><SaveGlyph size="compact" class="inline-block h-3 w-auto -mt-0.5" /> Save now</span>)
                    if you want to keep it. Archived history is not affected.
                  </p>
                </div>
              </div>

              <!-- Parse button -->
              <button
                type="button"
                class="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl
                       bg-indigo-600 text-white text-sm font-semibold
                       hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
                       transition-colors"
                :disabled="planInputLoading"
                @click="handleReadInParse"
              >
                <template v-if="planInputLoading">
                  <div class="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                  {{ planInputProgress || 'Processing…' }}
                </template>
                <template v-else>
                  <span aria-hidden="true">🔍</span>
                  Parse as Planguage Spec
                </template>
              </button>

              <LoadingProgress
                :loading="planInputLoading"
                :label="planInputProgress || 'Processing…'"
                :baseline="35"
                hint="can take up to 60s for large documents"
                color="indigo"
              />
              <!-- AmuseMeButton: plan parsing / URL extraction can take 30–60s -->
              <AmuseMeButton :is-loading="planInputLoading" class="w-full mt-2" />

              <!-- Error message — shown in the input form so it's in context with the Parse button -->
              <p v-if="planInputError" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3" role="alert">
                {{ planInputError }}
              </p>

            </template>

          </ScrollContainer>
        </template>

        <!-- ══════════════════════════════════════════════════════════════
             TAB 2 — FROM HISTORY
        ═══════════════════════════════════════════════════════════════ -->
        <template v-else-if="topTab === 'from-history'">
          <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full p-5 space-y-6">

            <!-- Plan Models section -->
            <div>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Plan Models</p>
              <div v-if="allModels.length === 0" class="text-sm text-slate-400 italic">No saved plan models yet.</div>
              <div v-else class="space-y-2">
                <div
                  v-for="model in allModels"
                  :key="model.id"
                  class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-800 truncate">{{ model.name }}</p>
                    <p class="text-xs text-slate-400 mt-0.5">
                      v{{ model.version }}
                      · {{ model.spec.functions.length }}F {{ model.spec.values.length }}V {{ model.spec.solutions.length }}S
                      · {{ fmtDate(model.updatedAt) }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg
                           bg-indigo-600 text-white text-xs font-semibold
                           hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1
                           transition-colors"
                    @click="handleHistoryLoadModel(model)"
                  >
                    <span aria-hidden="true">↩</span> Load Plan
                  </button>
                </div>
              </div>
            </div>

            <!-- Spec Versions section -->
            <div>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Spec Versions</p>
              <div v-if="history.length === 0" class="text-sm text-slate-400 italic">No saved spec versions yet.</div>
              <div v-else class="space-y-2">
                <div
                  v-for="sv in history"
                  :key="sv.id"
                  class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-violet-200 hover:bg-violet-50/30 transition-colors"
                >
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-800">
                      <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 mr-1.5">{{ sv.label }}</span>
                      {{ fmtTs(sv.timestamp) }}
                    </p>
                    <p class="text-xs text-slate-400 mt-0.5 truncate">{{ sv.summary }}</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg
                           bg-violet-600 text-white text-xs font-semibold
                           hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                           transition-colors"
                    @click="handleHistoryRestoreVersion(sv)"
                  >
                    <span aria-hidden="true">↩</span> Restore
                  </button>
                </div>
              </div>
            </div>

          </ScrollContainer>
        </template>

        <!-- ══════════════════════════════════════════════════════════════
             TAB 3 — MERGE PLANS
        ═══════════════════════════════════════════════════════════════ -->
        <template v-else>
          <ScrollContainer ref="scrollMergeRef" outer-class="flex-1 min-h-0 relative" inner-class="h-full p-5 space-y-5">

            <!-- Explainer -->
            <div class="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
              <span class="text-base shrink-0" aria-hidden="true">🔀</span>
              <div>
                <p class="font-semibold mb-0.5">Merge any combination of saved plans, spec versions, and free text.</p>
                <p class="text-sky-700">The AI deduplicates, resolves contradictions, and synthesises a single Planguage spec. Great for combining an old plan with meeting notes, or merging two competing specs.</p>
              </div>
            </div>

            <!-- Plan Models selection -->
            <div v-if="allModels.length > 0">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Plan Models</p>
              <div class="space-y-1.5">
                <label
                  v-for="model in allModels"
                  :key="model.id"
                  class="flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-colors"
                  :class="mergeModelIds.has(model.id)
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    :checked="mergeModelIds.has(model.id)"
                    @change="toggleMergeModel(model.id)"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-800 truncate">{{ model.name }}</p>
                    <p class="text-xs text-slate-400">v{{ model.version }} · {{ fmtDate(model.updatedAt) }}</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Spec Versions selection -->
            <div v-if="history.length > 0">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Spec Versions</p>
              <div class="space-y-1.5">
                <label
                  v-for="sv in history"
                  :key="sv.id"
                  class="flex items-center gap-3 rounded-xl border px-4 py-2.5 cursor-pointer transition-colors"
                  :class="mergeVersionIds.has(sv.id)
                    ? 'border-violet-300 bg-violet-50'
                    : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30'"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-400"
                    :checked="mergeVersionIds.has(sv.id)"
                    @change="toggleMergeVersion(sv.id)"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-800">
                      <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 mr-1.5">{{ sv.label }}</span>
                      {{ fmtTs(sv.timestamp) }}
                    </p>
                    <p class="text-xs text-slate-400 truncate">{{ sv.summary }}</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- No saved items nudge -->
            <div
              v-if="allModels.length === 0 && history.length === 0"
              class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 text-center"
            >
              No saved plans or spec versions yet.<br>
              <span class="text-xs text-slate-400">Add free text below to merge from scratch, or save some plans first.</span>
            </div>

            <!-- Free text input -->
            <div class="space-y-2">
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wide" for="merge-text">
                Add free text (optional)
              </label>
              <textarea
                id="merge-text"
                v-model="mergeFreeText"
                rows="5"
                class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent
                       resize-y placeholder:text-slate-400 font-mono"
                placeholder="Paste meeting notes, email threads, additional plan text, or any free-form content to merge in…"
                :disabled="mergeLoading"
              />
            </div>

            <!-- Selection count badge -->
            <div v-if="mergeSelectionCount > 0" class="flex items-center gap-2 text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
              <span aria-hidden="true">✓</span>
              <strong>{{ mergeSelectionCount }} source{{ mergeSelectionCount !== 1 ? 's' : '' }}</strong> selected for merge
            </div>

            <!-- Merge button -->
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl
                     bg-gradient-to-r from-violet-600 to-sky-600 text-white text-sm font-semibold
                     hover:from-violet-700 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2
                     transition-all shadow-md shadow-violet-200/60"
              :disabled="mergeLoading || mergeSelectionCount === 0"
              @click="handleMerge"
            >
              <template v-if="mergeLoading">
                <div class="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                Merging…
              </template>
              <template v-else>
                <span aria-hidden="true">🔀</span>
                Merge {{ mergeSelectionCount > 0 ? `${mergeSelectionCount} source${mergeSelectionCount !== 1 ? 's' : ''}` : 'Plans' }}
              </template>
            </button>

            <LoadingProgress
              :loading="mergeLoading"
              label="Merging sources…"
              :baseline="40"
              hint="can take up to 90s for many sources"
              color="indigo"
            />
            <!-- AmuseMeButton: merging multiple plans can take 30–90s -->
            <AmuseMeButton :is-loading="mergeLoading" class="w-full mt-2" />

            <p v-if="mergeError" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3" role="alert">
              {{ mergeError }}
            </p>

            <!-- ── Merge results ── -->
            <template v-if="mergeParsed && !mergeLoading">
              <div class="border-t border-slate-100 pt-5 space-y-4">

                <!-- Header -->
                <div class="flex items-center gap-2">
                  <span class="text-xl" aria-hidden="true">✅</span>
                  <p class="text-sm font-bold text-slate-800">Merge complete</p>
                </div>

                <!-- Sources that contributed -->
                <div>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Sources merged</p>
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="(label, i) in mergeSourceLabels"
                      :key="i"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                             bg-violet-100 text-violet-800 border border-violet-200"
                    >
                      {{ label }}
                    </span>
                  </div>
                </div>

                <!-- F / V / S count grid -->
                <div>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Spec entry counts</p>
                  <div class="grid grid-cols-3 gap-2">
                    <div class="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5 text-center">
                      <p class="text-2xl font-black text-blue-700 leading-none">{{ mergeDiffCounts.F }}</p>
                      <p class="text-[10px] text-blue-500 font-semibold mt-1 uppercase tracking-wide">Functions</p>
                    </div>
                    <div class="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2.5 text-center">
                      <p class="text-2xl font-black text-indigo-700 leading-none">{{ mergeDiffCounts.V }}</p>
                      <p class="text-[10px] text-indigo-500 font-semibold mt-1 uppercase tracking-wide">Values</p>
                    </div>
                    <div class="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2.5 text-center">
                      <p class="text-2xl font-black text-violet-700 leading-none">{{ mergeDiffCounts.S }}</p>
                      <p class="text-[10px] text-violet-500 font-semibold mt-1 uppercase tracking-wide">Solutions</p>
                    </div>
                  </div>
                </div>

                <!-- New entries (vs current plan) — only when there was a plan before -->
                <div v-if="mergeDiffNew.length > 0">
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                    New entries not in your current plan ({{ mergeDiffNew.length }})
                  </p>
                  <div class="space-y-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div
                      v-for="entry in mergeDiffNew.slice(0, 6)"
                      :key="entry.id"
                      class="flex items-start gap-2 text-xs"
                    >
                      <span
                        class="shrink-0 font-mono font-bold"
                        :class="{
                          'text-blue-600': entry.entryType === 'F',
                          'text-indigo-600': entry.entryType === 'V',
                          'text-violet-600': entry.entryType === 'S',
                        }"
                      >{{ entry.id }}</span>
                      <span class="text-emerald-800 truncate">{{ entry.description }}</span>
                    </div>
                    <p v-if="mergeDiffNew.length > 6" class="text-xs text-emerald-600 italic">
                      + {{ mergeDiffNew.length - 6 }} more new entries…
                    </p>
                  </div>
                </div>

                <!-- Full entry preview -->
                <div>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Preview of merged spec</p>
                  <div class="space-y-1">
                    <div
                      v-for="f in mergeParsed.functions.slice(0, 2)"
                      :key="f.id"
                      class="flex items-start gap-2 text-xs text-slate-600 py-1 border-b border-slate-100"
                    >
                      <span class="shrink-0 font-mono text-blue-500 font-semibold w-[80px]">{{ f.id }}</span>
                      <span class="truncate">{{ f.description }}</span>
                    </div>
                    <div
                      v-for="v in mergeParsed.values.slice(0, 2)"
                      :key="v.id"
                      class="flex items-start gap-2 text-xs text-slate-600 py-1 border-b border-slate-100"
                    >
                      <span class="shrink-0 font-mono text-indigo-500 font-semibold w-[80px]">{{ v.id }}</span>
                      <span class="truncate">{{ v.description }}</span>
                    </div>
                    <div
                      v-for="s in mergeParsed.solutions.slice(0, 1)"
                      :key="s.id"
                      class="flex items-start gap-2 text-xs text-slate-600 py-1"
                    >
                      <span class="shrink-0 font-mono text-violet-500 font-semibold w-[80px]">{{ s.id }}</span>
                      <span class="truncate">{{ s.description }}</span>
                    </div>
                    <p v-if="mergeDiffCounts.total > 5" class="text-xs text-slate-400 italic pt-1">
                      + {{ mergeDiffCounts.total - 5 }} more entries in merged spec…
                    </p>
                  </div>
                </div>

                <!-- Action buttons -->
                <div class="space-y-2 pt-1">
                  <button
                    v-if="props.hasCurrentPlan"
                    type="button"
                    class="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-xl
                           bg-emerald-600 text-white text-sm font-semibold
                           hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 transition-colors"
                    title="Merge the result into your existing live plan — new entries are added alongside existing ones. No existing entries are removed."
                    @click="handleMergeAddTo"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                    Add to current plan
                    <span class="text-emerald-200 text-xs font-normal">(keeps existing entries)</span>
                  </button>
                  <div class="flex gap-3">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1.5 min-h-[48px] rounded-xl text-sm font-semibold
                             focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors"
                      :class="props.hasCurrentPlan
                        ? 'bg-slate-600 text-white hover:bg-slate-700 focus:ring-slate-400'
                        : 'bg-violet-600 text-white hover:bg-violet-700 focus:ring-violet-400'"
                      :title="props.hasCurrentPlan
                        ? 'Replace your current live plan with the merged spec — your existing entries will be overwritten.'
                        : 'Load the merged spec as your live plan and start working with it.'"
                      @click="handleMergeUse"
                    >
                      <span aria-hidden="true">{{ props.hasCurrentPlan ? '↩' : '✓' }}</span>
                      {{ props.hasCurrentPlan ? 'Replace current plan' : 'Use merged spec' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1.5 min-h-[48px]
                             rounded-xl bg-amber-500 text-white text-sm font-semibold
                             hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 transition-colors"
                      title="Load the merged spec and immediately open the Sharpen panel to refine and improve it with AI."
                      @click="handleMergeSharpen"
                    >
                      <span aria-hidden="true">🔪</span> Use + Sharpen
                    </button>
                  </div>
                </div>

                <!-- ── Copy & Email export ── -->
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Copy &amp; Email Merge Results</p>

                  <!-- All-3 row -->
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1.5 min-h-[40px] rounded-lg
                             bg-slate-800 text-white text-xs font-semibold
                             hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
                             transition-colors"
                      title="Copy all 3 merged components (Functions + Values + Solutions) as a colored HTML table — paste with ⌘V in Mail, Keynote, or Notes. Includes source labels and timestamp."
                      :aria-label="copiedExport === 'mg-all' ? 'Copied!' : 'Copy all 3 merged components as colored HTML tables'"
                      @click="copyMerge('all')"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'mg-all' ? '✓' : '📋' }}</span>
                      {{ copiedExport === 'mg-all' ? 'Copied!' : 'Copy All · F + V + S' }}
                    </button>
                    <button
                      type="button"
                      class="flex items-center justify-center gap-1.5 px-4 min-h-[40px] rounded-lg
                             bg-violet-600 text-white text-xs font-semibold
                             hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                             transition-colors"
                      title="Copy all merge results to clipboard as colored tables, then open Mail.app — paste with ⌘V in the email body for full-color tables. Subject includes entry counts and timestamp."
                      :aria-label="copiedExport === 'mg-email' ? 'Copied — Mail opening' : 'Email all merge results'"
                      @click="emailMerge"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'mg-email' ? '✓' : '✉️' }}</span>
                      {{ copiedExport === 'mg-email' ? 'Opening Mail…' : 'Mail All' }}
                    </button>
                  </div>

                  <!-- Individual component row -->
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-blue-300 bg-blue-50 text-blue-700 text-xs font-semibold
                             hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy merged Functions only (${mergeParsed?.functions.length ?? 0} entries) as a colored blue HTML table — paste with ⌘V. Includes source labels and timestamp.`"
                      :aria-label="copiedExport === 'mg-F' ? 'Functions copied' : 'Copy merged Functions only'"
                      @click="copyMerge('F')"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'mg-F' ? '✓' : 'F.' }}</span>
                      {{ copiedExport === 'mg-F' ? 'Copied' : 'Functions' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-violet-300 bg-violet-50 text-violet-700 text-xs font-semibold
                             hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy merged Values only (${mergeParsed?.values.length ?? 0} entries) as a colored violet HTML table — paste with ⌘V. Includes Scale, Meter, Tolerable, Goal, source labels, and timestamp.`"
                      :aria-label="copiedExport === 'mg-V' ? 'Values copied' : 'Copy merged Values only'"
                      @click="copyMerge('V')"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'mg-V' ? '✓' : 'V.' }}</span>
                      {{ copiedExport === 'mg-V' ? 'Copied' : 'Values' }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 flex items-center justify-center gap-1 min-h-[36px] rounded-lg
                             border border-orange-300 bg-orange-50 text-orange-700 text-xs font-semibold
                             hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1
                             transition-colors"
                      :title="`Copy merged Solutions only (${mergeParsed?.solutions.length ?? 0} entries) as a colored orange HTML table — paste with ⌘V. Includes Impact, For Function, source labels, and timestamp.`"
                      :aria-label="copiedExport === 'mg-S' ? 'Solutions copied' : 'Copy merged Solutions only'"
                      @click="copyMerge('S')"
                    >
                      <span aria-hidden="true">{{ copiedExport === 'mg-S' ? '✓' : 'S.' }}</span>
                      {{ copiedExport === 'mg-S' ? 'Copied' : 'Solutions' }}
                    </button>
                  </div>

                  <!-- Confirmation hint -->
                  <p
                    v-if="copiedExport?.startsWith('mg-')"
                    class="text-[11px] text-emerald-600 text-center"
                    role="status"
                    aria-live="polite"
                  >
                    ✓ Copied — paste with ⌘V in Mail, Keynote, or Notes for full-color tables
                  </p>
                </div>

              </div>
            </template>

          </ScrollContainer>
        </template>

      </div>
    </div>
  </Teleport>
</template>
