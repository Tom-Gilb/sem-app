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
import { useContractStore } from '../composables/useContractStore'
import { useContractParser } from '../composables/useContractParser'
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

const showImport = ref(false)
const importTitle       = ref('')
const importType        = ref<ContractType>('service-agreement')
const importPartyAName  = ref('')
const importPartyARole  = ref<'obligor' | 'obligee' | 'both'>('obligee')
const importPartyBName  = ref('')
const importPartyBRole  = ref<'obligor' | 'obligee' | 'both'>('obligor')
const importText        = ref('')
const importStep        = ref<1 | 2>(1)  // 1=metadata, 2=paste text

function openImport(): void {
  importTitle.value = ''
  importType.value = 'service-agreement'
  importPartyAName.value = ''
  importPartyBName.value = ''
  importText.value = ''
  importStep.value = 1
  showImport.value = true
}

function cancelImport(): void {
  showImport.value = false
}

const importLoading = ref(false)
const importError   = ref<string | null>(null)

async function doImport(): Promise<void> {
  if (!importTitle.value.trim() || !importText.value.trim()) return
  importLoading.value = true
  importError.value   = null

  const parties: ContractParty[] = []
  if (importPartyAName.value.trim()) {
    parties.push({
      id:           `party-${Date.now()}-a`,
      name:         importPartyAName.value.trim(),
      abbreviation: _initials(importPartyAName.value),
      role:         importPartyARole.value,
    })
  }
  if (importPartyBName.value.trim()) {
    parties.push({
      id:           `party-${Date.now()}-b`,
      name:         importPartyBName.value.trim(),
      abbreviation: _initials(importPartyBName.value),
      role:         importPartyBRole.value,
    })
  }

  const contract = store.createContract(
    importTitle.value.trim(),
    importType.value,
    parties,
  )
  store.updateContract(contract.id, {
    rawImportText: importText.value.trim(),
    parseStatus:   'splitting',
  })
  selectedId.value  = contract.id
  showImport.value  = false

  try {
    const clauses = await parser.splitIntoClauses(importText.value.trim())
    store.setClauses(contract.id, clauses)
    store.updateContract(contract.id, { parseStatus: 'parsing' })
    // Auto-parse all clauses sequentially (avoids rate limit hammering)
    await _parseAllClauses(contract.id, clauses, parties)
    store.updateContract(contract.id, { parseStatus: 'complete' })
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
  <!-- Full-screen teal surface — z-[600] (below SelectionDefiner z-[10100]) -->
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[600] flex flex-col bg-slate-50"
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
          <CloseDot variant="on-dark" ariaLabel="Close Contracts mode" @click="emit('close')" />
        </div>
      </div>

      <!-- ── Tab bar (detail view only) ────────────────────────────────────── -->
      <div v-if="selectedContract" class="shrink-0 flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200">
        <button
          v-for="tab in (['clauses', 'entries', 'matrix', 'export'] as const)"
          :key="tab"
          type="button"
          :title="`Switch to ${tab} view`"
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
                <div v-if="selectedContract.clauses.length === 0" class="px-3 py-8 text-center">
                  <p class="text-xs text-slate-400">
                    <span v-if="selectedContract.parseStatus === 'splitting'">Splitting clauses…</span>
                    <span v-else-if="selectedContract.parseStatus === 'empty'">Paste contract text to begin</span>
                    <span v-else>No clauses found</span>
                  </p>
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
      <Teleport v-if="showImport" to="body">
        <div class="fixed inset-0 z-[700] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="cancelImport" />
          <div class="relative z-[701] w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <!-- Import modal header -->
            <div class="px-5 py-4 bg-gradient-to-r from-teal-700 to-emerald-600 flex items-center gap-3">
              <span class="text-white font-bold text-sm">📋 Import Contract</span>
              <div class="ml-auto">
                <CloseDot variant="on-dark" ariaLabel="Cancel import" @click="cancelImport" />
              </div>
            </div>

            <!-- Step indicator -->
            <div class="flex border-b border-slate-200">
              <div
                v-for="step in [1, 2] as const"
                :key="step"
                class="flex-1 py-2 text-center text-xs font-bold transition-colors"
                :class="importStep === step ? 'text-teal-700 border-b-2 border-teal-600' : 'text-slate-400'"
              >
                Step {{ step }}: {{ step === 1 ? 'Contract Details' : 'Paste Text' }}
              </div>
            </div>

            <!-- Step 1: metadata -->
            <div v-if="importStep === 1" class="p-5 space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Contract title *</label>
                <input
                  v-model="importTitle"
                  type="text"
                  placeholder="e.g. ACME Service Agreement 2026"
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Contract type</label>
                <select
                  v-model="importType"
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option v-for="(label, key) in CONTRACT_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Party A name</label>
                  <input v-model="importPartyAName" type="text" placeholder="e.g. Acme Corp Ltd" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Party A role</label>
                  <select v-model="importPartyARole" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="obligee">Obligee (receiver)</option>
                    <option value="obligor">Obligor (provider)</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Party B name</label>
                  <input v-model="importPartyBName" type="text" placeholder="e.g. GlobalSupply Ltd" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Party B role</label>
                  <select v-model="importPartyBRole" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="obligor">Obligor (provider)</option>
                    <option value="obligee">Obligee (receiver)</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
              <div class="flex justify-end pt-2">
                <button
                  type="button"
                  :disabled="!importTitle.trim()"
                  class="px-5 py-2 bg-teal-700 hover:bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-all"
                  @click="importStep = 2"
                >Next → Paste Text</button>
              </div>
            </div>

            <!-- Step 2: paste contract text -->
            <div v-else-if="importStep === 2" class="p-5 space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Contract text *</label>
                <p class="text-[11px] text-slate-500 mb-2">Paste the full contract or the relevant sections. SEM will split it into clauses and convert each to Planguage automatically.</p>
                <textarea
                  v-model="importText"
                  rows="10"
                  placeholder="Paste contract text here…"
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none leading-relaxed"
                />
              </div>
              <p v-if="importError" class="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">⚠ {{ importError }}</p>
              <div class="flex items-center justify-between pt-2">
                <button type="button" class="text-xs text-slate-500 hover:text-slate-700" @click="importStep = 1">← Back</button>
                <button
                  type="button"
                  :disabled="!importText.trim() || importLoading"
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
