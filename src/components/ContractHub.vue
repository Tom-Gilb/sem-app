<!--
  ContractHub.vue — Contracts mode: third major SEM surface (alongside Plans + Models).

  Two internal views managed by selectedContractId ref:
    null  → landing: list of all contracts + "Import New Contract" flow
    <id>  → detail:  full clause browser, Planguage entries, obligation matrix, export

  Color scheme: teal (distinct from Plan indigo/violet and Model slate).
  Entry type badges: F.=orange · V.=blue · C.=red · R.=emerald · S.=violet · Task=slate

  Rules satisfied:
    ScrollContainer rule — all scrollable areas wrapped in ScrollContainer.
    CloseDot rule — close button uses CloseDot (on-dark, end of header).
    Single-Surface rule — caller registers 'contracts' with registerExclusiveSurface.
    Define-by-Selection rule — no select-none on body content.
    DD-009 Zero-Training UI — all interactive elements have :title.
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed, watch } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import EditGlyph from './icons/EditGlyph.vue'
import { useContractStore } from '../composables/useContractStore'
import { useContractParser } from '../composables/useContractParser'
import { useDocumentImport } from '../composables/useDocumentImport'
import { useContractLibrary } from '../composables/useContractLibrary'
import type { ContractLibraryEntry } from '../composables/useContractLibrary'
import type {
  ContractModel,
  ContractClause,
  PlanguageContractEntry,
  ContractEntryType,
  ContractType,
  ContractParty,
} from '../types/contractTypes'

const emit = defineEmits<{ 'close': [] }>()

// ── Store + parser ────────────────────────────────────────────────────────────

const store  = useContractStore()
const parser = useContractParser()

// ── Navigation ────────────────────────────────────────────────────────────────

/** null = landing (all contracts), string = contract detail view */
const selectedId    = ref<string | null>(store.currentId.value)
const selectedClauseId = ref<string | null>(null)
const activeTab     = ref<'clauses' | 'entries' | 'matrix' | 'export'>('clauses')

watch(selectedId, (id) => {
  store.setCurrentContract(id)
  selectedClauseId.value = null
  activeTab.value = 'clauses'
})

const selectedContract = computed<ContractModel | null>(() =>
  selectedId.value
    ? store.contracts.value.find(c => c.id === selectedId.value) ?? null
    : null
)

const selectedClause = computed<ContractClause | null>(() =>
  selectedContract.value?.clauses.find(cl => cl.id === selectedClauseId.value) ?? null
)

// ── Import flow ───────────────────────────────────────────────────────────────

// ── Import flow — simplified single-step (Tom 2026-05-29) ────────────────────
// "This window is not useful. I have all that data in the contract. The parsing
//  needs to find it for me. I just need to import the contract file from url,
//  my mac or to paste it in, as in the sem planning."
// Step 1 (metadata form) removed. User pastes text; title auto-extracted from
// first meaningful line; parties auto-detected by the LLM parser.

const showImport = ref(false)
const importTitle = ref('')
const importText  = ref('')
const importType  = ref<ContractType>('other')

function openImport(): void {
  importTitle.value = ''
  importText.value  = ''
  importType.value  = 'other'
  importLoading.value = false
  importError.value   = null
  clearImport()
  showImport.value  = true
}

function cancelImport(): void {
  showImport.value = false
}

/** Auto-extract a title from the first non-empty line of the contract text. */
function _extractTitle(text: string): string {
  const first = text.split('\n').map(l => l.trim()).find(l => l.length > 2) ?? 'Imported Contract'
  return first.length > 80 ? first.slice(0, 77) + '…' : first
}

const importLoading = ref(false)
const importError   = ref<string | null>(null)

// ── File import — PDF / DOCX / plain text ────────────────────────────────────
const { importFromFile, importLoading: fileExtracting, importError: fileExtractError, clearImport } = useDocumentImport()
/** Ref to the hidden <input type="file"> so we can trigger it programmatically. */
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerFileInput(): void {
  clearImport()
  importError.value = null
  fileInputRef.value?.click()
}

/**
 * Handle file selection: extract text via useDocumentImport, fill importText,
 * then auto-submit for analysis — no paste step needed.
 * Supports: PDF (.pdf), Word (.docx), Markdown, HTML, CSV, plain text.
 */
async function handleFileImport(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0]
  // Reset immediately so the same file can be re-imported after an error
  input.value = ''
  if (!file) return
  const text = await importFromFile(file)
  if (!text) return  // fileExtractError shown in template
  importText.value = text
  // Auto-title from filename (without extension) if user hasn't typed one
  if (!importTitle.value.trim()) {
    importTitle.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  }
}

// ── Contract Library ──────────────────────────────────────────────────────────

const library = useContractLibrary()

/** Separate useDocumentImport instance for library uploads (own loading/error state). */
const { importFromFile: libImportFromFile, importLoading: libExtracting } = useDocumentImport()

const libOpen           = ref(false)
const libFileInputRef   = ref<HTMLInputElement | null>(null)
/** Inline rename: tracks which user entry is being renamed. */
const libRenamingId     = ref<string | null>(null)
const libRenameDraft    = ref('')

/** Load a library entry into the import form and close the library panel. */
function loadFromLibrary(entry: ContractLibraryEntry): void {
  importTitle.value = entry.title
  importText.value  = entry.text
  importType.value  = entry.contractType
  libOpen.value     = false
}

function triggerLibFileInput(): void {
  libFileInputRef.value?.click()
}

async function handleLibFileImport(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0]
  input.value = ''
  if (!file) return
  const text = await libImportFromFile(file)
  if (!text) return
  const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
  library.addUserEntry(title, text, 'other')
}

function startRename(entry: ContractLibraryEntry): void {
  libRenamingId.value  = entry.id
  libRenameDraft.value = entry.title
}

function commitRename(): void {
  if (libRenamingId.value) {
    library.renameUserEntry(libRenamingId.value, libRenameDraft.value)
  }
  libRenamingId.value = null
}

async function doImport(): Promise<void> {
  const rawText = importText.value.trim()
  if (!rawText) return
  importLoading.value = true
  importError.value   = null

  // Title: user-provided OR auto-extracted from first meaningful line.
  // Parties: left empty — the LLM parser detects party labels from context
  // (obligation tags like "SUPPLIER", "CLIENT" appear in the clause text).
  const title: string = importTitle.value.trim() || _extractTitle(rawText)
  const contract = store.createContract(title, importType.value, [])
  store.updateContract(contract.id, {
    rawImportText: rawText,
    parseStatus:   'splitting',
  })
  selectedId.value  = contract.id
  showImport.value  = false

  try {
    let clauses = await parser.splitIntoClauses(rawText)

    // Fallback: if the LLM found no clause structure (e.g. historical documents,
    // unusual formatting), split by double-newline so something is always analysed.
    if (clauses.length === 0) {
      const paras = rawText.split(/\n{2,}/).map((p: string) => p.trim()).filter((p: string) => p.length > 20)
      if (paras.length > 0) {
        clauses = paras.map((p: string, i: number): ContractClause => ({
          id:          `para-${Date.now()}-${i}`,
          number:      `§${i + 1}`,
          heading:     p.split('\n')[0].slice(0, 70).trim() || `Paragraph ${i + 1}`,
          rawText:     p,
          entries:     [],
          parseStatus: 'pending',
        }))
      }
    }

    store.setClauses(contract.id, clauses)
    store.updateContract(contract.id, { parseStatus: clauses.length > 0 ? 'parsing' : 'complete' })
    if (clauses.length > 0) {
      await _parseAllClauses(contract.id, clauses, [])
      store.updateContract(contract.id, { parseStatus: 'complete' })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    store.updateContract(contract.id, { parseStatus: 'error', parseError: msg })
    importError.value = msg
  } finally {
    importLoading.value = false
  }
}

async function _parseAllClauses(
  contractId: string,
  clauses:    ContractClause[],
  parties:    ContractParty[],
): Promise<void> {
  for (const clause of clauses) {
    store.setClauseParseStatus(contractId, clause.id, 'parsing')
    try {
      const entries = await parser.parseClause(
        clause,
        parties,
        (type: ContractEntryType) => store.nextTag(contractId, type),
      )
      store.setClauseEntries(contractId, clause.id, entries, 'done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Parse failed'
      store.setClauseEntries(contractId, clause.id, [], 'error', msg)
    }
  }
}

/** Parse (or re-parse) a single clause on demand. */
async function reparseClause(clause: ContractClause): Promise<void> {
  if (!selectedContract.value) return
  const contract = selectedContract.value
  store.setClauseParseStatus(contract.id, clause.id, 'parsing')
  try {
    const entries = await parser.parseClause(
      clause,
      contract.parties,
      (type: ContractEntryType) => store.nextTag(contract.id, type),
    )
    store.setClauseEntries(contract.id, clause.id, entries, 'done')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parse failed'
    store.setClauseEntries(contract.id, clause.id, [], 'error', msg)
  }
}

// ── Entries filter ────────────────────────────────────────────────────────────

const entryFilter = ref<ContractEntryType | 'all'>('all')

const filteredEntries = computed<PlanguageContractEntry[]>(() => {
  const entries = store.allEntries.value
  if (entryFilter.value === 'all') return entries
  return entries.filter(e => e.type === entryFilter.value)
})

// ── Export ────────────────────────────────────────────────────────────────────

const copiedExport = ref(false)

function buildExportHtml(): string {
  const c = selectedContract.value
  if (!c) return ''
  const entries = store.allEntries.value

  const badge = (type: ContractEntryType) =>
    `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;
     background:${TYPE_COLORS[type].bg};color:${TYPE_COLORS[type].text}">${type}.</span>`

  const rows = entries.map(e => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 10px;white-space:nowrap">${badge(e.type)} ${e.tag}</td>
      <td style="padding:8px 10px;font-size:11px;color:#334155">${e.obligatedParty ?? '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#1e293b">${e.description}</td>
      <td style="padding:8px 10px;font-size:11px;color:#64748b">${e.isAmbiguous ? '⚠ ' + (e.ambiguityNote ?? 'Ambiguous') : '✓'}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${c.title} — Planguage Analysis</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;background:#f8fafc">
<h1 style="color:#0f766e;font-size:20px;margin-bottom:4px">${c.title}</h1>
<p style="color:#64748b;font-size:13px;margin-bottom:20px">${c.subtitle ?? c.contractType} · Parties: ${c.parties.map(p => p.abbreviation).join(', ')}</p>
<table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px #0001">
  <thead><tr style="background:#0f766e;color:white">
    <th style="padding:10px;text-align:left;font-size:12px;white-space:nowrap">Type · Tag</th>
    <th style="padding:10px;text-align:left;font-size:12px">Party</th>
    <th style="padding:10px;text-align:left;font-size:12px">Obligation</th>
    <th style="padding:10px;text-align:left;font-size:12px">Ambiguity</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<p style="margin-top:12px;font-size:11px;color:#94a3b8">
  Generated by SEM App · Contracts mode · ${new Date().toLocaleDateString()}
</p>
</body></html>`
}

async function copyExport(): Promise<void> {
  const html = buildExportHtml()
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })
    ])
    copiedExport.value = true
    setTimeout(() => { copiedExport.value = false }, 2500)
  } catch {
    // Fallback: copy as plain text
    await navigator.clipboard.writeText(buildObligationText())
    copiedExport.value = true
    setTimeout(() => { copiedExport.value = false }, 2500)
  }
}

function buildObligationText(): string {
  const c = selectedContract.value
  if (!c) return ''
  return store.allEntries.value
    .map(e => `${e.tag}\t${e.obligatedParty ?? 'ALL'}\t${e.description}`)
    .join('\n')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('').slice(0, 8)
}

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  'service-agreement': 'Service Agreement',
  'sla':               'Service Level Agreement',
  'nda':               'Non-Disclosure Agreement',
  'employment':        'Employment Contract',
  'procurement':       'Procurement Contract',
  'partnership':       'Partnership Agreement',
  'lease':             'Lease Agreement',
  'license':           'License Agreement',
  'other':             'Contract',
}

/**
 * TYPE_COLORS — all Tailwind class strings are STATIC complete strings (never
 * built by runtime string-splitting) so Tailwind JIT can scan and compile them.
 *
 * tw          — badge pill: bg + text + border (used for tag pills everywhere)
 * entryCardCls — clause-detail card border + background
 * activeTw    — entries-filter active-button state (darker bg)
 * textBorder  — text + border only (used when card already has bg-white)
 */
const TYPE_COLORS: Record<ContractEntryType, {
  bg: string; text: string
  tw: string
  entryCardCls: string
  activeTw: string
  textBorder: string
}> = {
  F:    { bg: '#fff7ed', text: '#c2410c',
          tw:           'bg-orange-50 text-orange-700 border-orange-200',
          entryCardCls: 'border-orange-200 bg-orange-50',
          activeTw:     'bg-orange-200 text-orange-700 border-orange-200',
          textBorder:   'text-orange-700 border-orange-200' },
  V:    { bg: '#eff6ff', text: '#1d4ed8',
          tw:           'bg-blue-50 text-blue-700 border-blue-200',
          entryCardCls: 'border-blue-200 bg-blue-50',
          activeTw:     'bg-blue-200 text-blue-700 border-blue-200',
          textBorder:   'text-blue-700 border-blue-200' },
  C:    { bg: '#fef2f2', text: '#dc2626',
          tw:           'bg-red-50 text-red-700 border-red-200',
          entryCardCls: 'border-red-200 bg-red-50',
          activeTw:     'bg-red-200 text-red-700 border-red-200',
          textBorder:   'text-red-700 border-red-200' },
  R:    { bg: '#ecfdf5', text: '#059669',
          tw:           'bg-emerald-50 text-emerald-700 border-emerald-200',
          entryCardCls: 'border-emerald-200 bg-emerald-50',
          activeTw:     'bg-emerald-200 text-emerald-700 border-emerald-200',
          textBorder:   'text-emerald-700 border-emerald-200' },
  S:    { bg: '#f5f3ff', text: '#7c3aed',
          tw:           'bg-violet-50 text-violet-700 border-violet-200',
          entryCardCls: 'border-violet-200 bg-violet-50',
          activeTw:     'bg-violet-200 text-violet-700 border-violet-200',
          textBorder:   'text-violet-700 border-violet-200' },
  Task: { bg: '#f8fafc', text: '#475569',
          tw:           'bg-slate-50 text-slate-600 border-slate-200',
          entryCardCls: 'border-slate-200 bg-slate-50',
          activeTw:     'bg-slate-200 text-slate-600 border-slate-200',
          textBorder:   'text-slate-600 border-slate-200' },
}

/** Safe helper — avoids TypeScript cast for 'all' in entry filter button loop. */
function typeColorActive(type: 'all' | ContractEntryType): string {
  if (type === 'all') return 'bg-slate-800 text-white border-slate-800'
  return TYPE_COLORS[type].activeTw
}

const PARSE_STATUS_LABEL: Record<string, string> = {
  empty:     'No content',
  raw:       'Text imported',
  splitting: 'Splitting into clauses…',
  parsing:   'Extracting obligations…',
  complete:  'Analysis complete',
  error:     'Error',
  pending:   'Pending',
  done:      'Done',
}
</script>

<template>
  <!-- Full-screen teal surface — z-[600] (below SelectionDefiner z-[10100]).
       translateZ(0) forces GPU compositing so this layer correctly sits above
       the Plan Crest (z-[300]) in Safari, which otherwise renders the shimmer-
       animated Plan Crest in a separate GPU pass above non-composited fixed
       elements regardless of CSS z-index. -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[600] flex flex-col bg-slate-50"
      style="transform: translateZ(0);"
      role="dialog"
      aria-modal="true"
      aria-label="Contracts — Planguage Contract Analysis"
    >
      <!-- ── Header ─────────────────────────────────────────────────────────── -->
      <div class="shrink-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 shadow-lg">
        <!-- Back to landing -->
        <button
          v-if="selectedId"
          type="button"
          title="Back to all contracts"
          aria-label="Back to contracts list"
          class="shrink-0 text-white/70 hover:text-white text-xl leading-none transition-colors"
          @click="selectedId = null"
        >←</button>

        <!-- Icon + title -->
        <div class="shrink-0 w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg" aria-hidden="true">📋</div>
        <div class="flex-1 min-w-0">
          <span class="text-white font-bold text-sm tracking-wide">
            CONTRACTS
          </span>
          <span v-if="selectedContract" class="text-white/60 text-xs ml-2 truncate">
            · {{ selectedContract.title }}
          </span>
          <span v-else class="text-white/60 text-xs ml-2">
            · Planguage Contract Analysis
          </span>
        </div>

        <!-- Status badge (when in detail view) -->
        <span
          v-if="selectedContract"
          class="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white/90"
        >
          {{ PARSE_STATUS_LABEL[store.overallParseStatus.value] ?? store.overallParseStatus.value }}
        </span>

        <!-- CloseDot -->
        <div class="ml-auto shrink-0">
          <CloseDot
            variant="on-dark"
            title="Close Contracts — return to main workspace"
            ariaLabel="Close Contracts mode"
            @click="emit('close')"
          />
        </div>
      </div>

      <!-- ── Tab bar (detail view only) ────────────────────────────────────── -->
      <div v-if="selectedContract" class="shrink-0 flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200">
        <button
          v-for="tab in (['clauses', 'entries', 'matrix', 'export'] as const)"
          :key="tab"
          type="button"
          :title="tab === 'clauses'  ? 'Clauses — browse each clause and see its extracted Planguage obligations'
                : tab === 'entries'  ? 'Entries — all Planguage entries across the contract, filterable by type (F./V./C./R./S.)'
                : tab === 'matrix'   ? 'Matrix — party × obligation type grid showing which party owes which obligations'
                :                     'Export — copy a colorful HTML table to paste into Keynote, Numbers, or Mail'"
          class="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          :class="activeTab === tab
            ? 'bg-teal-700 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100'"
          @click="activeTab = tab"
        >
          {{ tab === 'clauses' ? '📄 Clauses' : tab === 'entries' ? '📊 Entries' : tab === 'matrix' ? '🗂 Matrix' : '⬇ Export' }}
        </button>
        <span class="ml-auto text-[11px] text-slate-400 tabular-nums">
          {{ store.allEntries.value.length }} entries ·
          {{ selectedContract.clauses.length }} clauses
        </span>
      </div>

      <!-- ── Body ───────────────────────────────────────────────────────────── -->

      <!-- ════════════════════ LANDING: all contracts ════════════════════════ -->
      <template v-if="!selectedId">
        <ScrollContainer
          outer-class="flex-1 min-h-0 relative"
          inner-class="px-6 py-6 max-w-4xl mx-auto w-full"
          inner-style="max-height: calc(100vh - 64px);"
          :no-pill="false"
        >
          <!-- Top row: heading + new button -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-xl font-bold text-slate-800">Your Contracts</h1>
              <p class="text-sm text-slate-500 mt-0.5">Import any contract and convert it to clear, measurable Planguage</p>
            </div>
            <button
              type="button"
              title="Import a new contract — paste text to convert to Planguage"
              aria-label="Import new contract"
              class="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all text-sm"
              @click="openImport"
            >
              <span aria-hidden="true">+</span> New Contract
            </button>
          </div>

          <!-- Empty state -->
          <div v-if="store.contracts.value.length === 0" class="flex flex-col items-center py-20 gap-4 text-center">
            <div class="text-6xl" aria-hidden="true">📋</div>
            <h2 class="text-lg font-bold text-slate-700">No contracts yet</h2>
            <p class="text-sm text-slate-500 max-w-xs">
              Import any contract — SLA, NDA, service agreement — and SEM converts it into
              measurable Planguage obligations, identifying vague language automatically.
            </p>
            <button
              type="button"
              title="Import your first contract — paste or upload contract text; SEM converts it to Planguage obligations automatically"
              class="mt-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-bold rounded-xl shadow transition-all text-sm"
              @click="openImport"
            >Import your first contract</button>
          </div>

          <!-- Contract cards grid -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              v-for="contract in store.contracts.value"
              :key="contract.id"
              class="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer p-5"
              :title="`Open ${contract.title}`"
              @click="selectedId = contract.id"
            >
              <!-- Card header -->
              <div class="flex items-start justify-between gap-2 mb-3">
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-slate-800 text-sm truncate group-hover:text-teal-700 transition-colors">
                    {{ contract.title }}
                  </p>
                  <p class="text-[11px] text-slate-500 mt-0.5">
                    {{ CONTRACT_TYPE_LABELS[contract.contractType] ?? contract.contractType }}
                    <span v-if="contract.effectiveDate"> · {{ contract.effectiveDate }}</span>
                  </p>
                </div>
                <span
                  class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                  :class="contract.parseStatus === 'complete' ? 'bg-emerald-100 text-emerald-700'
                         : contract.parseStatus === 'error'    ? 'bg-red-100 text-red-700'
                         : contract.parseStatus === 'empty'    ? 'bg-slate-100 text-slate-500'
                         :                                        'bg-amber-100 text-amber-700'"
                >{{ contract.parseStatus }}</span>
              </div>

              <!-- Parties -->
              <div v-if="contract.parties.length" class="flex gap-1.5 mb-3 flex-wrap">
                <span
                  v-for="p in contract.parties"
                  :key="p.id"
                  class="text-[10px] font-semibold px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full"
                >{{ p.abbreviation }}</span>
              </div>

              <!-- Entry type count pills -->
              <div class="flex gap-1.5 flex-wrap">
                <span
                  v-for="type in (['F', 'V', 'C', 'R', 'S', 'Task'] as ContractEntryType[])"
                  :key="type"
                  class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                  :class="TYPE_COLORS[type].tw"
                >
                  {{ type }}. {{ contract.clauses.flatMap(cl => cl.entries).filter(e => e.type === type).length }}
                </span>
              </div>
            </div>
          </div>
        </ScrollContainer>
      </template>

      <!-- ════════════════════ DETAIL VIEW ══════════════════════════════════ -->
      <template v-else-if="selectedContract">

        <!-- ── CLAUSES TAB ──────────────────────────────────────────────── -->
        <template v-if="activeTab === 'clauses'">
          <div class="flex-1 min-h-0 flex">

            <!-- Clause list sidebar -->
            <div class="w-64 shrink-0 border-r border-slate-200 flex flex-col bg-white">
              <div class="shrink-0 px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Clauses</span>
                <span class="text-[10px] text-slate-400">{{ selectedContract.clauses.length }}</span>
              </div>
              <ScrollContainer
                outer-class="flex-1 min-h-0 relative"
                inner-class="py-1"
                inner-style="max-height: calc(100vh - 160px);"
                :no-pill="true"
              >
                <!-- Empty state for no clauses yet -->
                <div v-if="selectedContract.clauses.length === 0" class="px-3 py-6 text-center space-y-3">
                  <div v-if="selectedContract.parseStatus === 'splitting' || selectedContract.parseStatus === 'parsing'">
                    <p class="text-xs text-teal-600 font-medium">⏳ Analysing…</p>
                  </div>
                  <template v-else-if="selectedContract.parseStatus === 'error'">
                    <p class="text-xs font-semibold text-red-600">⚠ Analysis failed</p>
                    <p class="text-[10px] text-red-500 leading-relaxed">{{ selectedContract.parseError }}</p>
                    <button
                      type="button"
                      title="Re-import this contract and try again"
                      class="mt-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                      @click="openImport"
                    >↩ Re-import</button>
                  </template>
                  <template v-else>
                    <p class="text-[11px] text-slate-500 font-medium">No clauses extracted</p>
                    <p class="text-[10px] text-slate-400 leading-relaxed">The document may use an unusual layout or be a scanned image with no text layer.</p>
                    <button
                      type="button"
                      title="Go back and re-import — try pasting the text manually"
                      class="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                      @click="openImport"
                    >↩ Re-import</button>
                  </template>
                </div>
                <button
                  v-for="clause in selectedContract.clauses"
                  :key="clause.id"
                  type="button"
                  :title="`${clause.number} — ${clause.heading} · ${clause.entries.length} entries`"
                  class="w-full text-left px-3 py-2.5 border-b border-slate-50 transition-colors text-xs"
                  :class="selectedClauseId === clause.id
                    ? 'bg-teal-50 border-l-2 border-l-teal-500 text-teal-800'
                    : 'hover:bg-slate-50 text-slate-700'"
                  @click="selectedClauseId = clause.id"
                >
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono text-[10px] text-slate-400 shrink-0">{{ clause.number }}</span>
                    <span
                      class="shrink-0 w-1.5 h-1.5 rounded-full"
                      :class="clause.parseStatus === 'done'    ? 'bg-emerald-400'
                             : clause.parseStatus === 'parsing' ? 'bg-amber-400 animate-pulse'
                             : clause.parseStatus === 'error'   ? 'bg-red-400'
                             :                                     'bg-slate-200'"
                      :title="clause.parseStatus"
                    />
                  </div>
                  <div class="font-semibold mt-0.5 leading-tight truncate">{{ clause.heading }}</div>
                  <div class="text-[10px] text-slate-400 mt-0.5">{{ clause.entries.length }} entries</div>
                </button>
              </ScrollContainer>
            </div>

            <!-- Clause detail -->
            <div class="flex-1 min-w-0 flex flex-col">
              <!-- No clause selected -->
              <div v-if="!selectedClause" class="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <div class="text-4xl mb-3" aria-hidden="true">←</div>
                  <p class="text-sm text-slate-500">Select a clause to see its raw text and extracted Planguage entries</p>
                </div>
              </div>

              <!-- Clause detail content -->
              <template v-else>
                <div class="shrink-0 px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="font-bold text-slate-800 text-sm">{{ selectedClause.number }} — {{ selectedClause.heading }}</p>
                    <p class="text-[11px] text-slate-500">{{ selectedClause.entries.length }} Planguage entries extracted</p>
                  </div>
                  <button
                    type="button"
                    :title="selectedClause.parseStatus === 'parsing' ? 'Parsing…' : 'Re-parse this clause with AI'"
                    :disabled="selectedClause.parseStatus === 'parsing'"
                    class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    :class="selectedClause.parseStatus === 'parsing'
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-teal-700 text-white hover:bg-teal-600'"
                    @click="reparseClause(selectedClause)"
                  >
                    {{ selectedClause.parseStatus === 'parsing' ? '⏳ Parsing…' : '🔄 Re-parse' }}
                  </button>
                </div>

                <ScrollContainer
                  outer-class="flex-1 min-h-0 relative"
                  inner-class="px-5 py-4 space-y-5"
                  inner-style="max-height: calc(100vh - 210px);"
                  :no-pill="false"
                >
                  <!-- Raw text -->
                  <div>
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Raw clause text</p>
                    <div class="bg-slate-50 rounded-xl p-4 text-xs text-slate-700 leading-relaxed border border-slate-200 whitespace-pre-wrap font-mono">{{ selectedClause.rawText }}</div>
                  </div>

                  <!-- Parsed entries -->
                  <div v-if="selectedClause.entries.length > 0">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Planguage entries</p>
                    <div class="space-y-3">
                      <div
                        v-for="entry in selectedClause.entries"
                        :key="entry.id"
                        class="rounded-xl border p-4 space-y-2"
                        :class="TYPE_COLORS[entry.type].entryCardCls"
                      >
                        <div class="flex items-center gap-2 flex-wrap">
                          <span
                            class="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                            :class="TYPE_COLORS[entry.type].tw"
                          >{{ entry.tag }}</span>
                          <span v-if="entry.obligatedParty" class="text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">{{ entry.obligatedParty }}</span>
                          <span v-if="entry.isAmbiguous" class="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full" :title="entry.ambiguityNote">⚠ Ambiguous</span>
                          <span class="ml-auto text-[10px] text-slate-400">{{ entry.confidence }} confidence</span>
                        </div>
                        <p class="text-sm font-semibold text-slate-800">{{ entry.description }}</p>

                        <!-- V. fields -->
                        <div v-if="entry.type === 'V'" class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <template v-for="field in ['scale','meter','goal','tolerable','wish']" :key="field">
                            <template v-if="(entry as any)[field]">
                              <span class="text-slate-500 font-medium capitalize">{{ field }}:</span>
                              <span class="text-slate-800">{{ (entry as any)[field] }}</span>
                            </template>
                          </template>
                        </div>

                        <!-- C. field -->
                        <p v-if="entry.type === 'C' && entry.constraintText" class="text-xs text-red-700 font-medium">
                          {{ entry.constraintText }}
                        </p>

                        <!-- Ambiguity note -->
                        <p v-if="entry.isAmbiguous && entry.ambiguityNote" class="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200">
                          ⚠ {{ entry.ambiguityNote }}
                        </p>

                        <!-- Raw source -->
                        <p class="text-[10px] text-slate-400 italic border-t border-slate-100 pt-2 leading-relaxed">
                          "{{ entry.rawSource }}"
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Parse error -->
                  <div v-if="selectedClause.parseStatus === 'error'" class="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p class="text-sm text-red-700 font-semibold">Parse error</p>
                    <p class="text-xs text-red-600 mt-1">{{ selectedClause.parseError }}</p>
                  </div>

                  <!-- Pending / empty -->
                  <div v-if="selectedClause.entries.length === 0 && selectedClause.parseStatus === 'done'" class="text-center py-6 text-sm text-slate-400">
                    No obligations found in this clause
                  </div>
                </ScrollContainer>
              </template>
            </div>
          </div>
        </template>

        <!-- ── ENTRIES TAB ──────────────────────────────────────────────── -->
        <template v-else-if="activeTab === 'entries'">
          <div class="shrink-0 flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200">
            <button
              v-for="type in (['all', 'F', 'V', 'C', 'R', 'S', 'Task'] as const)"
              :key="type"
              type="button"
              :title="`Show ${type === 'all' ? 'all entry types' : type + '. entries only'}`"
              class="px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors"
              :class="entryFilter === type
                ? typeColorActive(type)
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'"
              @click="entryFilter = type"
            >
              {{ type === 'all' ? 'All' : type + '.' }}
              <span class="ml-1 opacity-70">{{ type === 'all' ? store.allEntries.value.length : store.entryCounts.value[type as ContractEntryType] }}</span>
            </button>
          </div>
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="px-4 py-3"
            inner-style="max-height: calc(100vh - 170px);"
            :no-pill="false"
          >
            <div class="space-y-2">
              <div
                v-for="entry in filteredEntries"
                :key="entry.id"
                class="bg-white rounded-xl border p-4 space-y-1.5"
                :class="TYPE_COLORS[entry.type].textBorder"
              >
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded-full border" :class="TYPE_COLORS[entry.type].tw">{{ entry.tag }}</span>
                  <span v-if="entry.obligatedParty" class="text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">{{ entry.obligatedParty }}</span>
                  <span v-if="entry.isAmbiguous" class="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠ Ambiguous</span>
                  <span class="ml-auto text-[10px] text-slate-400 font-mono">{{ selectedContract.clauses.find(cl => cl.id === entry.clauseRef)?.number ?? '' }}</span>
                </div>
                <p class="text-sm text-slate-800 font-semibold">{{ entry.description }}</p>
                <div v-if="entry.type === 'V'" class="text-xs text-slate-600 space-y-0.5">
                  <span v-if="entry.goal" class="mr-3">Goal: <strong>{{ entry.goal }}</strong></span>
                  <span v-if="entry.tolerable" class="mr-3">Tolerable: {{ entry.tolerable }}</span>
                  <span v-if="entry.meter">Meter: {{ entry.meter }}</span>
                </div>
                <p v-if="entry.ambiguityNote" class="text-[11px] text-amber-700 italic">⚠ {{ entry.ambiguityNote }}</p>
              </div>
              <p v-if="filteredEntries.length === 0" class="text-center py-12 text-sm text-slate-400">
                No {{ entryFilter === 'all' ? '' : entryFilter + '.' }} entries yet
              </p>
            </div>
          </ScrollContainer>
        </template>

        <!-- ── MATRIX TAB ───────────────────────────────────────────────── -->
        <template v-else-if="activeTab === 'matrix'">
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="px-4 py-4"
            inner-style="max-height: calc(100vh - 130px);"
            :no-pill="false"
          >
            <p class="text-xs text-slate-500 mb-4">Party × obligation type matrix. Each cell shows entries where that party is obligated.</p>
            <div class="overflow-x-auto">
              <table class="min-w-full border-collapse text-xs bg-white rounded-xl overflow-hidden shadow-sm">
                <thead>
                  <tr class="bg-teal-700 text-white">
                    <th class="p-3 text-left font-bold whitespace-nowrap">Party</th>
                    <th v-for="type in (['F','V','C','R','S','Task'] as ContractEntryType[])" :key="type" class="p-3 text-center font-bold">{{ type }}.</th>
                    <th class="p-3 text-center font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(party, partyKey) in store.obligationMatrix.value"
                    :key="partyKey"
                    class="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td class="p-3 font-bold text-teal-700 whitespace-nowrap">
                      {{ selectedContract.parties.find(p => p.abbreviation === partyKey)?.name ?? partyKey }}
                      <span class="ml-1 text-[10px] text-slate-400 font-normal">({{ partyKey }})</span>
                    </td>
                    <td
                      v-for="type in (['F','V','C','R','S','Task'] as ContractEntryType[])"
                      :key="type"
                      class="p-3 text-center"
                    >
                      <span
                        v-if="(party[type]?.length ?? 0) > 0"
                        class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold"
                        :class="TYPE_COLORS[type].tw"
                      >{{ party[type]!.length }}</span>
                      <span v-else class="text-slate-200">—</span>
                    </td>
                    <td class="p-3 text-center font-bold text-slate-700">
                      {{ Object.values(party).reduce((acc, arr) => acc + (arr?.length ?? 0), 0) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ScrollContainer>
        </template>

        <!-- ── EXPORT TAB ───────────────────────────────────────────────── -->
        <template v-else-if="activeTab === 'export'">
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="px-6 py-6 max-w-2xl mx-auto w-full space-y-6"
            inner-style="max-height: calc(100vh - 130px);"
            :no-pill="false"
          >
            <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 class="text-base font-bold text-slate-800">Export as Colorful HTML Table</h2>
              <p class="text-sm text-slate-500">Copy a rich HTML table with all Planguage entries — color-coded by type. Paste directly into Keynote, Numbers, or Mail.</p>
              <button
                type="button"
                title="Copy rich HTML table to clipboard — paste into Keynote or Numbers"
                class="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-bold rounded-xl shadow transition-all text-sm"
                @click="copyExport"
              >
                {{ copiedExport ? '✅ Copied!' : '📋 Copy HTML Table' }}
              </button>
            </div>

            <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
              <h2 class="text-base font-bold text-slate-800">Summary</h2>
              <div class="grid grid-cols-3 gap-3">
                <div
                  v-for="type in (['F', 'V', 'C', 'R', 'S', 'Task'] as ContractEntryType[])"
                  :key="type"
                  class="rounded-xl border p-3 text-center"
                  :class="TYPE_COLORS[type].tw"
                >
                  <p class="text-2xl font-bold">{{ store.entryCounts.value[type] }}</p>
                  <p class="text-[11px] font-semibold mt-0.5">{{ type === 'F' ? 'Functions' : type === 'V' ? 'Values' : type === 'C' ? 'Constraints' : type === 'R' ? 'Resources' : type === 'S' ? 'Stakeholder duties' : 'Tasks' }}</p>
                </div>
              </div>
              <div class="flex gap-3 flex-wrap pt-1">
                <span class="text-sm text-slate-600">
                  <strong>{{ store.allEntries.value.filter(e => e.isAmbiguous).length }}</strong> ambiguous entries
                </span>
                <span class="text-sm text-slate-600">
                  <strong>{{ selectedContract.clauses.length }}</strong> clauses
                </span>
                <span class="text-sm text-slate-600">
                  <strong>{{ selectedContract.parties.length }}</strong> parties
                </span>
              </div>
            </div>
          </ScrollContainer>
        </template>

      </template>

      <!-- ════ IMPORT MODAL ════════════════════════════════════════════════ -->
      <!-- Import modal — simplified single step (Tom 2026-05-29).
           No metadata form: just paste the text. Title auto-extracted from
           the first line. Parties auto-detected by the LLM parser. -->
      <Teleport v-if="showImport" to="body">
        <div class="fixed inset-0 z-[700] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="cancelImport" />
          <div class="relative z-[701] w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <!-- Modal header -->
            <div class="px-5 py-4 bg-gradient-to-r from-teal-700 to-emerald-600 flex items-center gap-3">
              <span class="text-white font-bold text-sm">📋 Import Contract</span>
              <div class="ml-auto">
                <CloseDot variant="on-dark" ariaLabel="Cancel import" @click="cancelImport" />
              </div>
            </div>

            <!-- Single-step paste form -->
            <div class="p-5 space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Contract title
                  <span class="font-normal text-slate-400">(optional — auto-read from first line)</span>
                </label>
                <input
                  v-model="importTitle"
                  type="text"
                  placeholder="Leave blank to auto-extract from the contract text"
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <!-- ── Library picker ──────────────────────────────────────── -->
              <div class="rounded-xl border border-teal-200 overflow-hidden">
                <!-- Toggle bar -->
                <button
                  type="button"
                  title="Contract library — load a sample or upload your own · single-click to expand"
                  class="w-full flex items-center gap-2 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 transition-colors text-xs font-bold text-teal-800 select-none"
                  @click="libOpen = !libOpen"
                >
                  <span>📚 Contract Library</span>
                  <span class="font-normal text-teal-500">({{ library.allEntries.value.length }})</span>
                  <span class="ml-auto text-teal-400 text-[10px]">{{ libOpen ? '▲ hide' : '▼ show' }}</span>
                </button>

                <!-- Expanded library list -->
                <div v-if="libOpen" class="border-t border-teal-100">
                  <!-- Scrollable entry list -->
                  <div class="max-h-44 overflow-y-auto divide-y divide-slate-100">
                    <div
                      v-for="entry in library.allEntries.value"
                      :key="entry.id"
                      class="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 group"
                    >
                      <!-- Source badge -->
                      <span
                        class="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        :class="entry.source === 'built-in'
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-violet-100 text-violet-700'"
                      >{{ entry.source === 'built-in' ? 'Built-in' : 'Mine' }}</span>

                      <!-- Title / rename input -->
                      <input
                        v-if="libRenamingId === entry.id"
                        v-model="libRenameDraft"
                        type="text"
                        class="flex-1 min-w-0 text-xs border border-teal-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
                        @keydown.enter.prevent="commitRename"
                        @keydown.esc.prevent="libRenamingId = null"
                        @blur="commitRename"
                      />
                      <span v-else class="flex-1 min-w-0 text-xs text-slate-700 truncate">{{ entry.title }}</span>

                      <!-- Rename (user only) -->
                      <button
                        v-if="entry.source === 'user' && libRenamingId !== entry.id"
                        type="button"
                        title="Rename this library entry"
                        class="shrink-0 text-[10px] text-slate-400 hover:text-slate-600 px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        @click="startRename(entry)"
                      ><EditGlyph size="compact" aria-label="Rename this library entry" /></button>

                      <!-- Load button -->
                      <button
                        type="button"
                        :title="`Load '${entry.title}' into the import form`"
                        class="shrink-0 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                        @click="loadFromLibrary(entry)"
                      >Load</button>

                      <!-- Delete (user only) -->
                      <button
                        v-if="entry.source === 'user'"
                        type="button"
                        title="Remove from library — cannot be undone"
                        class="shrink-0 text-[10px] text-red-400 hover:text-red-600 px-1 transition-colors"
                        @click="library.removeUserEntry(entry.id)"
                      >✕</button>
                    </div>
                  </div>

                  <!-- Upload-to-library row -->
                  <div class="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                    <input
                      ref="libFileInputRef"
                      type="file"
                      accept=".pdf,.docx,.txt,.md,.markdown,.rtf,.html,.htm,.csv"
                      class="sr-only"
                      @change="handleLibFileImport"
                    />
                    <button
                      type="button"
                      title="Upload a contract file to your library — saved for future sessions. Supported: PDF, Word, Markdown, plain text."
                      class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-dashed text-[11px] transition-colors focus:outline-none focus:ring-1 focus:ring-teal-400"
                      :class="libExtracting
                        ? 'border-slate-200 text-slate-400 cursor-wait'
                        : 'border-teal-300 text-teal-600 hover:border-teal-500 hover:bg-teal-50'"
                      :disabled="libExtracting"
                      @click="triggerLibFileInput"
                    >
                      <span v-if="libExtracting">⏳ Uploading…</span>
                      <span v-else>+ Upload to library</span>
                    </button>
                    <span class="text-[10px] text-slate-400">PDF · Word · Markdown · text</span>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Contract text *</label>
                <p class="text-[11px] text-slate-500 mb-2">
                  Paste your contract, or import a file — PDF, Word (.docx), Markdown, HTML, or plain text.
                  SEM splits it into clauses and converts each to Planguage automatically.
                  Party names, types, and obligations are detected from the text.
                </p>

                <!-- File import row — sits above the textarea -->
                <div class="flex items-center gap-2 mb-2">
                  <!-- Hidden file input — triggered by button below -->
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.markdown,.rtf,.html,.htm,.csv"
                    class="sr-only"
                    :disabled="importLoading || fileExtracting"
                    @change="handleFileImport"
                  />
                  <button
                    type="button"
                    title="Import file — single-click to open a file picker. Supported: PDF (.pdf), Word (.docx), Markdown (.md), HTML, CSV, plain text. Text is extracted and filled into the contract field automatically."
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-teal-400"
                    :class="fileExtracting
                      ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-wait'
                      : 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100'"
                    :disabled="importLoading || fileExtracting"
                    @click="triggerFileInput"
                  >
                    <svg v-if="fileExtracting" class="w-3 h-3 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span>{{ fileExtracting ? 'Extracting…' : '📂 Import file (PDF / Word / text)' }}</span>
                  </button>
                  <span class="text-[10px] text-slate-400">or paste below</span>
                </div>

                <!-- File extraction error -->
                <p v-if="fileExtractError" class="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200 mb-2">⚠ {{ fileExtractError }}</p>

                <textarea
                  v-model="importText"
                  rows="10"
                  placeholder="Paste contract text here — or use Import file above for PDF / Word / text files.&#10;SEM will find the parties, extract obligations, and identify vague language automatically."
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none leading-relaxed"
                  :class="importText ? 'border-teal-300' : ''"
                />
                <p v-if="importText" class="text-[10px] text-slate-400 mt-1 tabular-nums">
                  {{ importText.trim().split(/\s+/).filter(Boolean).length }} words
                </p>
              </div>
              <p v-if="importError" class="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">⚠ {{ importError }}</p>
              <div class="flex justify-end pt-2">
                <button
                  type="button"
                  :disabled="!importText.trim() || importLoading"
                  title="Analyse contract — SEM splits into clauses and extracts Planguage obligations, identifying parties and vague language automatically"
                  class="px-5 py-2 bg-teal-700 hover:bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-all inline-flex items-center gap-2"
                  @click="doImport"
                >
                  <span v-if="importLoading">⏳ Analysing…</span>
                  <span v-else>🔍 Analyse Contract</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

    </div>
  </Teleport>
</template>
