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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useAmuseLifecycle } from '../composables/useAmuseLifecycle'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import EditGlyph from './icons/EditGlyph.vue'
import PlanIdentityBand from './PlanIdentityBand.vue'  // r41 v96 (Tom Gilb 2026-06-16 "do that" — Phase 3 sweep)
// r41 v391 (Tom Gilb 2026-07-01 verbatim "I also want more visibility into
// exactly what the contacts agent is doing. There is only a sliver of a window.
// Please design an elegant display of the phases of contract analysis, to
// impress a lawyer") — full-height, lawyerly Case Analysis surface replacing
// the previous compact-banner + basic-spinner combination.  See component file
// for full composition notes.
import ContractAnalysisTheatre from './ContractAnalysisTheatre.vue'
// r41 v437 — Contract Redraft feature (settings dialog + data model).
import ContractRedraftSettings from './ContractRedraftSettings.vue'
// r41 v438 — Contract Redraft Ship 2 (result panel + orchestrator wiring).
import RedraftResultPanel from './RedraftResultPanel.vue'
import { useContractRedraft } from '../composables/useContractRedraft'
import type { ContractRedraftResult, RedraftProgress } from '../composables/useContractRedraft'
import { useContractStore, onSaveFailure, markSaveFailureBannerDismissed, type SaveFailureEvent } from '../composables/useContractStore'
import { useBackdropHardening } from '../composables/useBackdropHardening'
import { useContractParser, bestClauseHeading } from '../composables/useContractParser'
import { useDocumentImport } from '../composables/useDocumentImport'
import { useContractLibrary } from '../composables/useContractLibrary'
import type { ContractLibraryEntry } from '../composables/useContractLibrary'
import { openEml } from '../composables/useEmlExport'
// r41 v435 — canonical email flow per Auto-Open Email SUPREME rule (mailto:
// + clipboard HTML instead of retired .eml download path).
import { exportCopy, exportEmail } from '../composables/useExportShared'
import { useGlyphPanel } from '../composables/useGlyphPanel'
import PlTypeBadge from './icons/PlTypeBadge.vue'
import PlTypeIcon from './icons/PlTypeIcon.vue'
import CopyGlyph from './icons/CopyGlyph.vue'
import EmailGlyph from './icons/EmailGlyph.vue'
// r41 v405 (Tom Gilb 2026-07-01 verbatim "there are at least 3 old style emojos
// or icons. There is a supreme rule (knife exception) using them at all. We
// either use Planguage Glyphs, or special and approved designs.") — Planguage-
// Glyph-First SUPREME + No-Generic-Icon-Libraries SUPREME sweep.  Replaced 📚
// (books) + 💾 (floppy disk) + 🎯 (bullseye) emojis with the canonical Save
// glyph (`*→[*]`) + text-only labels for the guideline buttons.
import SaveGlyph from './icons/SaveGlyph.vue'
// r41 2026-06-20 (Phase 3.5A — Guidelines Library) — Tom Gilb 2026-06-20
// verbatim greenlight on (c)/(b)/(b): global library, version-pinning,
// structured whereChecked.  Manage button lives in the Rewrites tab.
import GuidelineLibraryPanel from './GuidelineLibraryPanel.vue'
import type {
  ContractModel,
  ContractClause,
  PlanguageContractEntry,
  ContractEntryType,
  ContractType,
  ContractParty,
} from '../types/contractTypes'

const props = defineProps<{
  /** r41 v96 — identity band fields (Phase 3 sweep). */
  planName?: string
  planOwner?: string
  planVersion?: string
  generatedAt?: string
}>()

const emit = defineEmits<{
  'close': []
  /** r41 v47 — fires when the planner clicks the Contracts Mode chip
   *  in the header.  Payload is the SettingsPanel section id to open. */
  'open-settings': [sectionId: string]
  /** r41 v96 — bubble history selection. */
  'select-history': [versionId: string]
}>()

void props

// r41 v47 — Contracts Mode config surfaced in header chip.  Lives behind a
// try/catch in case useSettings is not yet initialised at first render.
import { computed as _contractsModeComputed } from 'vue'
import { useSettings as _contractsModeUseSettings } from '../composables/useSettings'
const { settings: _contractsSettingsRef } = _contractsModeUseSettings()
const _contractsModeConfig = _contractsModeComputed(() => _contractsSettingsRef.value.contractsMode)
// r41 v391 (Tom Gilb 2026-07-01) — human-readable Contracts Mode summary for
// the ContractAnalysisTheatre "Analyser Configuration" strip.  Ports the same
// four-axis view Tom sees in the header chip HoverHint into one short sentence.
const contractsModeSummary = _contractsModeComputed(() => {
  const c = _contractsModeConfig.value
  const parts: string[] = []
  parts.push(c.applyContractSharpening ? 'Sharpening ON' : 'Sharpening OFF')
  parts.push(`Standards: ${c.standards.length > 0 ? c.standards.join(', ') : 'none'}`)
  parts.push(`Presentation: ${c.presentation}`)
  parts.push(`Purposes: ${c.purposes.length > 0 ? c.purposes.join(', ') : 'strict-analytical (default)'}`)
  return parts.join(' · ')
})

// r41 v402 (Tom Gilb 2026-07-01 "reparsing does not shaw a visible result") —
// human-readable "parsed at HH:MM" label for the clause detail so the planner
// sees WHEN a re-parse ran even when the result is "0 entries extracted".
function _clauseLastParsedLabel(iso: string | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  } catch { return '' }
}

// ── Store + parser ────────────────────────────────────────────────────────────

const store  = useContractStore()
const parser = useContractParser()
const { openGlyphPanel } = useGlyphPanel()

// ── Navigation ────────────────────────────────────────────────────────────────

/** null = landing (all contracts), string = contract detail view.
 *  r41 2026-06-20 (Tom Gilb option B "per-plan contract memory" after the
 *  Monitor-sticky-on-Indianapolis bug) — `selectedId` now BIDIRECTIONALLY
 *  syncs with `store.currentId`:
 *    - User picks a contract in this panel → watch(selectedId) writes to the
 *      store, which persists under the active-plan slot.
 *    - App.vue calls `applyPlanSwitch(newPlanId)` on plan switch → store
 *      updates `_currentId` to that plan's remembered contract → watch on
 *      `store.currentId` hydrates `selectedId` here → UI re-renders.
 *  Previously `selectedId` was initialised once at mount and never re-read
 *  the store, which is exactly the sticky-state bug Tom hit. */
const selectedId    = ref<string | null>(store.currentId.value)
const selectedClauseId = ref<string | null>(null)

/**
 * r41 v408 (Tom Gilb 2026-07-01 verbatim "I would like the same trick you did
 * on stage 1. When I select (maybe a small o) a clause you show the clause in
 * the raw text, in context") — Raw-text view mode.  When 'context', the FULL
 * contract text is shown with the selected clause's raw text highlighted +
 * scrolled into view (mirrors Stage 1's `flashSourceLine` pattern in
 * `GetAPlanPanel.vue`).  When 'clause', only the selected clause's own raw
 * text is shown (the pre-v408 behaviour).  Default is 'context' per Tom's
 * ask.  Persisted so the preference sticks between selections.
 */
const rawTextViewMode = ref<'context' | 'clause'>(
  (typeof localStorage !== 'undefined'
    && localStorage.getItem('sem-app:contracts:rawTextViewMode') === 'clause')
    ? 'clause' : 'context'
)
function setRawTextViewMode(mode: 'context' | 'clause'): void {
  rawTextViewMode.value = mode
  try { localStorage.setItem('sem-app:contracts:rawTextViewMode', mode) } catch { /* ignore */ }
}

/** Template ref on the highlighted `<mark>` element so we can scroll it into
 *  view when the planner selects a new clause (mirrors Stage 1's
 *  flashSourceLine `scrollTo` trick). */
const contextMarkEl = ref<HTMLElement | null>(null)
// r41 2026-06-20 (Tom Gilb verbatim "go" greenlight on Phase 3A — Rewrites
// tab) — added 'rewrites' as a sibling tab to clauses / entries / matrix /
// export.  Phase 3A scope is read-only review with per-entry tick boxes +
// type filter + show-only-with-rewrites toggle.  Phases 3B (bulk actions) +
// 3C (Save as new version) + 3D (compare export) come next.
const activeTab     = ref<'clauses' | 'entries' | 'matrix' | 'export' | 'rewrites'>('clauses')

watch(selectedId, (id) => {
  if (id === store.currentId.value) return  // prevent feedback loop on hydration
  store.setCurrentContract(id)
  selectedClauseId.value = null
  activeTab.value = 'clauses'
})

// r41 2026-06-20 — store→local hydration (plan-switch path).
watch(() => store.currentId.value, (id) => {
  if (id === selectedId.value) return
  selectedId.value = id
  selectedClauseId.value = null
  activeTab.value = 'clauses'
})

const selectedContract = computed<ContractModel | null>(() =>
  selectedId.value
    ? store.contracts.value.find(c => c.id === selectedId.value) ?? null
    : null
)

/**
 * r41 v429 — CONTRACT-scoped owner label for PlanIdentityBand.
 *
 * The previous binding used the SEM Plan's owner (`props.planOwner` = the
 * PLAN's identified owner names from App.vue's `_specOwnerNames()`), which
 * bled Plan-side identity (J Bullock, from an Indianapolis session) into
 * every contract's header — including brand-new Employment / IT Monitoring /
 * NDA contracts that have nothing to do with J Bullock.  Tom flagged the
 * mismatch: *"j bullock is not the owner if this contract"*.
 *
 * New derivation, priority-ordered:
 *   1. Contract's own parties list — joined as "PROVIDER · Provider Name,
 *      CLIENT · Client Name" so every party appears with its abbreviation
 *      + name.  Preferred: this is a contract's actual counterparty
 *      identity.
 *   2. Falls back to `props.planOwner` (the SEM Plan owner) ONLY when the
 *      contract has no parties recorded — extremely rare because import
 *      always picks up at least one party from the preamble; kept as a
 *      graceful-degradation path so the OWNER row is never empty.
 *   3. Empty string when neither is available; PlanIdentityBand's own
 *      fallback text ("(no owner)" or similar) handles the display.
 */
const contractOwnerLabel = computed<string>(() => {
  const c = selectedContract.value
  if (!c) return props.planOwner ?? ''
  const parties = c.parties ?? []
  if (parties.length > 0) {
    return parties
      .map(p => {
        const abbr = (p as unknown as { abbreviation?: string }).abbreviation?.trim()
        const name = (p as unknown as { name?: string }).name?.trim()
        if (abbr && name && abbr !== name) return `${abbr} · ${name}`
        return name || abbr || ''
      })
      .filter(Boolean)
      .join(', ')
  }
  return props.planOwner ?? ''
})

const selectedClause = computed<ContractClause | null>(() =>
  selectedContract.value?.clauses.find(cl => cl.id === selectedClauseId.value) ?? null
)

/**
 * r41 v408 — Raw-text view in "context" mode.  Split the FULL contract text
 * (`rawImportText`) into three parts around the selected clause's `rawText`.
 * Exact substring match first; falls back to matching the first 60 chars of
 * the clause when the LLM's clause text is a fuzzy/normalized slice.
 *
 * Returns null when: no contract, no clause selected, no rawImportText, or
 * the fuzzy match also fails.  Callers use the null case to fall back to
 * "clause" mode rendering.
 */
const rawContextSplit = computed<{ before: string; match: string; after: string } | null>(() => {
  const c  = selectedContract.value
  const cl = selectedClause.value
  if (!c || !cl) return null
  const full  = c.rawImportText ?? ''
  const chunk = cl.rawText ?? ''
  if (!full || !chunk) return null
  // Exact match first.
  let idx = full.indexOf(chunk)
  let matchLen = chunk.length
  if (idx < 0) {
    // Fuzzy fallback — try the first 60 chars of the clause.  Handles the
    // case where the LLM normalized whitespace / joined broken words.
    const probe = chunk.slice(0, Math.min(60, chunk.length)).trim()
    if (probe.length >= 16) {
      idx = full.indexOf(probe)
      if (idx >= 0) matchLen = probe.length
    }
  }
  if (idx < 0) return null
  return {
    before: full.slice(0, idx),
    match:  full.slice(idx, idx + matchLen),
    after:  full.slice(idx + matchLen),
  }
})

/** Scroll the amber-highlighted <mark> into view when it changes.  Mirrors
 *  Stage 1's `flashSourceLine` scrollTo trick. */
watch(contextMarkEl, (el) => {
  if (!el) return
  // Wait one microtask so the browser has laid out the element.
  nextTick(() => {
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch { /* ignore */ }
  })
})

// ── Import flow ───────────────────────────────────────────────────────────────

// ── Import flow — simplified single-step (Tom 2026-05-29) ────────────────────
// "This window is not useful. I have all that data in the contract. The parsing
//  needs to find it for me. I just need to import the contract file from url,
//  my mac or to paste it in, as in the sem planning."
// Step 1 (metadata form) removed. User pastes text; title auto-extracted from
// first meaningful line; parties auto-detected by the LLM parser.

const showImport = ref(false)
// r41 v467 — backdrop hardening for the New Contract import dialog.
// Prevents accidental close from cursor drift onto the backdrop.
const {
  onBackdropPointerDown: onImportBackdropDown,
  onBackdropPointerUp:   onImportBackdropUp,
  onContentPointerDown:  onImportContentDown,
} = useBackdropHardening(() => cancelImport())
// r41 v437 — Contract Redraft Settings dialog visibility.  Ships as a
// standalone dialog first (MVP); v438 wires the actual redraft call.
const showRedraftSettings = ref(false)

// r41 v438 — Contract Redraft Ship 2 (per-clause orchestrator + result panel).
const _redraftComposable = useContractRedraft()

// r41 v441 → v442 refinement (Tom Gilb 2026-07-02 verbatim *"Picking the right
// one should be simplified by stating that the default is the immediately
// last contract analysed"*) — Contract picker candidates for the redraft
// settings dialog.  Compute `lastAnalysedAt` per contract as the MAX of
// `lastParsedAt` across all clauses (which stamps when each clause finishes
// parsing per r41 v402).  Suggested default = the contract with the most
// recent `lastAnalysedAt` — a MUCH better signal than generic `updatedAt`
// because it specifically means "the last one Tom actually worked on".
// Sort key stays current-first-then-lastAnalysedAt-descending so the picker
// mirrors Tom's mental model of "what did I most recently touch".
const redraftCandidates = computed(() => {
  return store.contracts.value
    .map(c => {
      const clauses  = c.clauses ?? []
      const clauseParseTimes = clauses
        .map(cl => cl.lastParsedAt)
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
      const lastAnalysedAt = clauseParseTimes.length > 0
        ? clauseParseTimes.reduce((a, b) => (a > b ? a : b))
        : ''
      return {
        id:              c.id,
        title:           c.title,
        clauseCount:     clauses.length,
        entryCount:      clauses.reduce((s, cl) => s + (cl.entries?.length ?? 0), 0),
        updatedAt:       c.updatedAt,
        lastAnalysedAt,   // '' when never analysed
        parseStatus:     c.parseStatus,
        isCurrent:       c.id === selectedId.value,
      }
    })
    .sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1
      if (!a.isCurrent && b.isCurrent) return 1
      // Prefer most-recent lastAnalysedAt; fall back to updatedAt when neither
      // has ever been parsed (edge case — both empty).
      const aKey = a.lastAnalysedAt || a.updatedAt
      const bKey = b.lastAnalysedAt || b.updatedAt
      return (aKey < bKey) ? 1 : -1
    })
})
const showRedraftResult = ref(false)
const redraftResult     = ref<ContractRedraftResult | null>(null)
const isRedraftRunning  = ref(false)
const redraftProgress   = ref<RedraftProgress>({
  clausesDone: 0,
  clausesTotal: 0,
  correctionsSoFar: 0,
  remainingSoFar: 0,
  phase: 'starting',
  elapsedSeconds: 0,
  inFlightCount: 0,
  averageClauseSeconds: 0,
  estimatedRemainingSeconds: 0,
  inFlightClauseNumbers: [],
})
const redraftErrorText  = ref<string>('')

async function runContractRedraft(): Promise<void> {
  const c = selectedContract.value
  if (!c) return
  if (isRedraftRunning.value) return
  const clausesLen = c.clauses?.length ?? 0
  if (clausesLen === 0) {
    // r41 v441 — no toast: the settings dialog's Section 0 picker already
    // shows a big amber warning + a list of redraftable contracts.  The
    // Generate Redraft button is also disabled in that state.  So arriving
    // here means the user somehow bypassed the disable — ignore silently
    // rather than yell.
    console.info('[runContractRedraft] Ignored: current contract has 0 clauses.  User should pick a redraftable one in Section 0.')
    return
  }
  redraftErrorText.value = ''
  isRedraftRunning.value = true
  redraftProgress.value  = {
    clausesDone: 0,
    clausesTotal: clausesLen,
    correctionsSoFar: 0,
    remainingSoFar: 0,
    phase: 'starting',
    elapsedSeconds: 0,
    inFlightCount: 0,
    averageClauseSeconds: 0,
    estimatedRemainingSeconds: 0,
    inFlightClauseNumbers: [],
  }
  showRedraftSettings.value = false
  try {
    const settings = _redraftComposable.settings.value
    const result = await _redraftComposable.runRedraft(c, (p: RedraftProgress) => {
      redraftProgress.value = p
    })
    if (result) {
      _redraftComposable.saveResult(result)
      redraftResult.value = result
      showRedraftResult.value = true
    } else if (_redraftComposable.redraftError.value) {
      redraftErrorText.value = _redraftComposable.redraftError.value ?? 'Unknown redraft failure'
    }
    void settings
  } finally {
    isRedraftRunning.value = false
  }
}

// r41 v440 — Download Full JSON Backup handler.
// Tom Gilb 2026-07-02 verbatim *"can you send the indianapolis output in
// planguage to my download. I am afraid of losing it and it took hours,
// and is my only one"*.  Serializes the currently-selected contract (or
// ALL contracts if modifier pressed) to a timestamped JSON file and
// triggers browser download to ~/Downloads/.  No-Silent-Data-Loss SUPREME
// safety net for work-in-progress.
function downloadContractBackup(evt: MouseEvent): void {
  const c = selectedContract.value
  if (!c) return
  const allContracts = !!(evt.metaKey || evt.ctrlKey)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  let payload: unknown
  let filename: string
  if (allContracts) {
    payload = {
      exportedAt:  new Date().toISOString(),
      exportKind:  'sem-app-all-contracts-backup',
      appVersion:  'r41 v440',
      contractCount: store.contracts.value.length,
      contracts:   store.contracts.value,
    }
    filename = `sem-app-ALL-contracts-backup-${timestamp}.json`
  } else {
    const entries = c.clauses.flatMap(cl => cl.entries)
    payload = {
      exportedAt:      new Date().toISOString(),
      exportKind:      'sem-app-single-contract-backup',
      appVersion:      'r41 v440',
      contract:        c,
      summary: {
        title:                  c.title,
        contractType:           c.contractType,
        clauseCount:            c.clauses.length,
        entryCount:             entries.length,
        entryTypeBreakdown:     {
          Function:    entries.filter(e => e.type === 'F').length,
          Value:       entries.filter(e => e.type === 'V').length,
          Constraint:  entries.filter(e => e.type === 'C').length,
          Resource:    entries.filter(e => e.type === 'R').length,
          Solution:    entries.filter(e => e.type === 'Sol').length,
          Stakeholder: entries.filter(e => e.type === 'S').length,
          Task:        entries.filter(e => e.type === 'Task').length,
        },
        parseStatus:            c.parseStatus,
        rawImportTextLength:    (c.rawImportText ?? '').length,
        parseStartedAt:         c.parseStartedAt,
      },
    }
    // Sanitise title for filename — strip special chars, cap length
    const safeTitle = (c.title || 'contract')
      .replace(/[^a-zA-Z0-9 _\-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50) || 'contract'
    filename = `sem-app-contract-${safeTitle}-${timestamp}.json`
  }
  try {
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    showBackupFlash.value = allContracts ? 'all' : 'single'
    setTimeout(() => { showBackupFlash.value = null }, 3500)
    console.info(
      `[downloadContractBackup] Wrote ${filename} · ${json.length} bytes · ${allContracts ? 'ALL contracts' : c.title}`,
    )
  } catch (err) {
    console.error('[downloadContractBackup] Failed to write backup:', err)
    // Non-blocking fallback: also copy JSON to clipboard so Tom can paste
    // it into a text file manually if the download failed.
    try {
      const json = JSON.stringify(payload, null, 2)
      navigator.clipboard.writeText(json).catch(() => {})
      showBackupFlash.value = 'clipboard-fallback'
      setTimeout(() => { showBackupFlash.value = null }, 5000)
    } catch { /* even the fallback failed — err already logged */ }
  }
}

const showBackupFlash = ref<'single' | 'all' | 'clipboard-fallback' | 'diagnostic' | null>(null)

// r41 v464 — quota-failure banner state + auto-backup on failure.
// Composes with No-Silent-Data-Loss SUPREME (any storage failure is
// LOUDLY surfaced + immediately protected by auto-Backup to Downloads).
const saveFailureBanner = ref<SaveFailureEvent | null>(null)
// v472 — auto-dismiss the durable-flag banner after 12s (informational,
// not an alarm).  Cleared any time a fresh event arrives.
let _durableBannerAutoDismissTimer: ReturnType<typeof setTimeout> | null = null
function onDismissSaveFailureBanner(): void {
  saveFailureBanner.value = null
  markSaveFailureBannerDismissed()
  if (_durableBannerAutoDismissTimer) {
    clearTimeout(_durableBannerAutoDismissTimer)
    _durableBannerAutoDismissTimer = null
  }
}
onSaveFailure((ev) => {
  saveFailureBanner.value = ev
  console.warn('[ContractHub] Save failure detected:', ev)
  if (_durableBannerAutoDismissTimer) {
    clearTimeout(_durableBannerAutoDismissTimer)
    _durableBannerAutoDismissTimer = null
  }
  if (ev.durable) {
    // Informational banner — self-dismisses in 12s.  Data is safe in IDB.
    _durableBannerAutoDismissTimer = setTimeout(() => {
      if (saveFailureBanner.value === ev) saveFailureBanner.value = null
      _durableBannerAutoDismissTimer = null
    }, 12_000)
    // Skip the emergency-Backup file — IDB has already durably stored
    // the write.  Writing an emergency .json on every mutation while
    // IDB is healthy would spam Tom's Downloads folder.
    return
  }
  // Non-durable path: auto-backup the currently-selected contract
  // immediately so at least the ACTIVE work is preserved to disk even
  // though BOTH localStorage AND IDB rejected the write.  This is the
  // belt-and-braces the demo was missing — PACRM was lost because Tom
  // didn't know to click Backup manually after a silent-quota-failure.
  try {
    const c = selectedContract.value
    if (c && c.clauses.length > 0) {
      const entries = c.clauses.flatMap(cl => cl.entries)
      const payload = {
        exportedAt:      new Date().toISOString(),
        exportKind:      'sem-app-single-contract-backup',
        appVersion:      'r41 v464 (auto-save-on-quota-failure)',
        contract:        c,
        summary: {
          title: c.title, contractType: c.contractType,
          clauseCount: c.clauses.length, entryCount: entries.length,
          entryTypeBreakdown: {
            Function: entries.filter(e => e.type === 'F').length,
            Value: entries.filter(e => e.type === 'V').length,
            Constraint: entries.filter(e => e.type === 'C').length,
            Resource: entries.filter(e => e.type === 'R').length,
            Solution: entries.filter(e => e.type === 'Sol').length,
            Stakeholder: entries.filter(e => e.type === 'S').length,
            Task: entries.filter(e => e.type === 'Task').length,
          },
          parseStatus: c.parseStatus,
          rawImportTextLength: (c.rawImportText ?? '').length,
        },
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const safeTitle = (c.title || 'contract').replace(/[^a-zA-Z0-9 _\-]/g, '').replace(/\s+/g, '-').slice(0, 50)
      const filename = `sem-app-EMERGENCY-quota-backup-${safeTitle}-${timestamp}.json`
      const json = JSON.stringify(payload, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      console.warn(`[ContractHub] Auto-backup on quota failure: wrote ${filename}`)
    }
  } catch (err) {
    console.error('[ContractHub] Auto-backup on quota failure ALSO failed:', err)
  }
})

// r41 v453 — landing-grid empty filter.  v444's Section 0 filter now
// extends to the landing page + Switch Contract dropdown (v456 target).
// Silent-removal-safe: emptyContracts stay VISIBLE via the reveal toggle.
const showLandingEmpties = ref(false)
const landingRedraftableContracts = computed(() =>
  store.contracts.value.filter(c => (c.clauses?.length ?? 0) > 0),
)
const landingEmptyContracts = computed(() =>
  store.contracts.value.filter(c => (c.clauses?.length ?? 0) === 0),
)
const landingVisibleContracts = computed(() =>
  showLandingEmpties.value ? store.contracts.value : landingRedraftableContracts.value,
)

// ── r41 v466 — Clean-Up Storage action ──────────────────────────────
//
// Tom Gilb 2026-07-02 verbatim *"ok can you clear out all zero files,
// and all but most recent versions for me.  Nothing is critical, we
// are experimental.  Nice to have reasonable test files"*.
//
// Two-part cleanup, applied in one atomic pass:
//   (1) DELETE all zero-content contracts (0 clauses AND 0 entries) —
//       these are Restore placeholders + abandoned imports + import
//       errors that never produced content.
//   (2) DEDUPE by title — for each unique title, keep only the version
//       with the MOST content (entry count DESC), ties broken by MOST
//       RECENT updatedAt.  Older duplicates get deleted.
//
// Composes with:
//   • No-Silent-Data-Loss SUPREME — confirm dialog names EXACTLY what
//     will be deleted (per-contract title + updatedAt + clause count +
//     entry count) BEFORE the user commits.
//   • Universal Undo SUPREME — every delete is a single-contract Delete
//     on the store, individually undoable via Backup files if needed.
//   • Trust-Rebuild framing — Tom's IDB dual-write (v465) means deletion
//     propagates to BOTH stores; no ghost survives.
//   • Term + Definition + Source SUPREME — every candidate for deletion
//     is named + the reason (zero-content OR older-duplicate) is stated.
const cleanupFlash = ref<{ deletedZero: number; deletedDupe: number; kept: number } | null>(null)

/** Returns two arrays: contracts to delete (zero-content) + contracts
 *  to delete (older duplicates by title).  Used by the confirm dialog
 *  + the executor.  Pure function of the current store state. */
function _computeCleanupPlan(): {
  zeroContent:    typeof store.contracts.value
  olderDuplicates: typeof store.contracts.value
  keepers:        typeof store.contracts.value
} {
  const all = store.contracts.value
  const zeroContent: typeof all = []
  const contentful: typeof all = []
  for (const c of all) {
    const entryCount = (c.clauses ?? []).reduce((s, cl) => s + (cl.entries?.length ?? 0), 0)
    if ((c.clauses?.length ?? 0) === 0 && entryCount === 0) {
      zeroContent.push(c)
    } else {
      contentful.push(c)
    }
  }
  // Group content-ful contracts by normalised title.
  const byTitle = new Map<string, typeof all>()
  for (const c of contentful) {
    const key = (c.title || '').trim().toLowerCase()
    const bucket = byTitle.get(key) ?? []
    bucket.push(c)
    byTitle.set(key, bucket)
  }
  const keepers: typeof all = []
  const olderDuplicates: typeof all = []
  for (const bucket of byTitle.values()) {
    if (bucket.length === 1) {
      keepers.push(bucket[0]!)
      continue
    }
    // Sort by entry-count DESC, then updatedAt DESC — most content +
    // most recent wins.  Everything after position 0 goes to dedupe.
    const sorted = [...bucket].sort((a, b) => {
      const ae = (a.clauses ?? []).reduce((s, cl) => s + (cl.entries?.length ?? 0), 0)
      const be = (b.clauses ?? []).reduce((s, cl) => s + (cl.entries?.length ?? 0), 0)
      if (be !== ae) return be - ae
      return (b.updatedAt || '').localeCompare(a.updatedAt || '')
    })
    keepers.push(sorted[0]!)
    olderDuplicates.push(...sorted.slice(1))
  }
  return { zeroContent, olderDuplicates, keepers }
}

function cleanUpStorage(): void {
  const plan = _computeCleanupPlan()
  const totalToDelete = plan.zeroContent.length + plan.olderDuplicates.length
  if (totalToDelete === 0) {
    cleanupFlash.value = { deletedZero: 0, deletedDupe: 0, kept: plan.keepers.length }
    setTimeout(() => { cleanupFlash.value = null }, 5000)
    return
  }
  const zeroLines  = plan.zeroContent.map(c => `  • "${c.title}" (0 clauses, 0 entries · updated ${(c.updatedAt || '').slice(0,10)})`).join('\n')
  const dupeLines  = plan.olderDuplicates.map(c => {
    const entryCount = (c.clauses ?? []).reduce((s, cl) => s + (cl.entries?.length ?? 0), 0)
    return `  • "${c.title}" (${c.clauses?.length ?? 0} clauses, ${entryCount} entries · updated ${(c.updatedAt || '').slice(0,10)}) — older duplicate`
  }).join('\n')
  const keepLines  = plan.keepers.map(c => {
    const entryCount = (c.clauses ?? []).reduce((s, cl) => s + (cl.entries?.length ?? 0), 0)
    return `  ✓ "${c.title}" (${c.clauses?.length ?? 0} clauses, ${entryCount} entries · updated ${(c.updatedAt || '').slice(0,10)})`
  }).join('\n')
  const msg = `Clean-Up Storage — this will DELETE ${totalToDelete} contract(s):\n\n` +
    (plan.zeroContent.length > 0     ? `ZERO-CONTENT (${plan.zeroContent.length}):\n${zeroLines}\n\n` : '') +
    (plan.olderDuplicates.length > 0 ? `OLDER DUPLICATES (${plan.olderDuplicates.length}):\n${dupeLines}\n\n` : '') +
    `KEEPING ${plan.keepers.length}:\n${keepLines}\n\nProceed?`
  const proceed = window.confirm(msg)
  if (!proceed) return
  for (const c of plan.zeroContent)     store.deleteContract(c.id)
  for (const c of plan.olderDuplicates) store.deleteContract(c.id)
  cleanupFlash.value = {
    deletedZero: plan.zeroContent.length,
    deletedDupe: plan.olderDuplicates.length,
    kept:        plan.keepers.length,
  }
  setTimeout(() => { cleanupFlash.value = null }, 8000)
  console.info(`[ContractHub] Clean-Up Storage: deleted ${plan.zeroContent.length} zero-content + ${plan.olderDuplicates.length} older duplicates; ${plan.keepers.length} kept.`)
}

// ── r41 v452 — Import Backup JSON (Tom's file-recovery path) ────────────────
//
// Tom Gilb 2026-07-02 verbatim *"I cannot fnd my most recent non zero
// indianapolis contract anywhere. Looks like the save and respore
// mechansims do not work. Goodthing I hace a backup in my downloads.
// Please include a possibility of bringing in a file from my mac, now
// and I can retrieve and run it."*
//
// The v440 Backup JSON button ships to disk in two shapes:
//   • { exportKind: 'sem-app-single-contract-backup', contract, summary }
//   • { exportKind: 'sem-app-all-contracts-backup',   contracts, contractCount }
// This handler accepts either shape and inserts the contract(s) into
// the store via `store.importContract` (which handles id-collision by
// forking a fresh id + title suffix — no silent overwrites).
const importBackupFileInput = ref<HTMLInputElement | null>(null)
const importFlash           = ref<{ kind: 'ok' | 'error'; message: string } | null>(null)

function triggerImportBackup(): void {
  importBackupFileInput.value?.click()
}

async function onImportBackupFileChange(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset the input so re-selecting the same file re-fires @change.
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const payload = JSON.parse(text) as {
      exportKind?:   string
      contract?:     ContractModel
      contracts?:    ContractModel[]
      contractCount?: number
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('File is not a JSON object')
    }

    // Accept both single-contract and all-contracts shapes.
    let toImport: ContractModel[] = []
    if (payload.exportKind === 'sem-app-single-contract-backup' && payload.contract) {
      toImport = [payload.contract]
    } else if (payload.exportKind === 'sem-app-all-contracts-backup' && Array.isArray(payload.contracts)) {
      toImport = payload.contracts
    } else if (payload.contract) {
      // Legacy / shape-mismatch fallback — try to import if it looks like a contract.
      toImport = [payload.contract]
    } else if (Array.isArray(payload.contracts)) {
      toImport = payload.contracts
    } else {
      throw new Error(`Unknown backup shape (exportKind: ${payload.exportKind ?? 'missing'})`)
    }

    if (toImport.length === 0) throw new Error('No contracts found in file')

    // Validate each candidate has a minimum shape (id + clauses array).
    const invalid = toImport.filter(c => !c || typeof c.id !== 'string' || !Array.isArray(c.clauses))
    if (invalid.length > 0) {
      throw new Error(`${invalid.length} contract entry/entries in the file are missing required fields (id + clauses)`)
    }

    // Import each — store handles id-collision by forking.
    const imported = toImport.map(c => store.importContract(c))
    const first = imported[0]
    const entryCount = imported.reduce((s, c) => s + c.clauses.flatMap(cl => cl.entries).length, 0)
    const clauseCount = imported.reduce((s, c) => s + c.clauses.length, 0)

    // Navigate to the imported contract so Tom sees it immediately.
    selectedId.value = first.id

    importFlash.value = {
      kind:    'ok',
      message: imported.length === 1
        ? `Imported "${first.title}" (${clauseCount} clauses, ${entryCount} Planguage entries).`
        : `Imported ${imported.length} contracts (${clauseCount} total clauses, ${entryCount} total Planguage entries).  Currently viewing "${first.title}".`,
    }
    setTimeout(() => { importFlash.value = null }, 8000)
    console.info(`[importContractBackup] Imported ${imported.length} contract(s), ${clauseCount} clauses, ${entryCount} entries from ${file.name}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    importFlash.value = { kind: 'error', message: `Import failed: ${msg}` }
    setTimeout(() => { importFlash.value = null }, 10000)
    console.error('[importContractBackup] Failed:', err)
  }
}

// r41 v443 (Tom Gilb 2026-07-02 verbatim *"nothing but zero but we knoiw that
// not true"* — picker shows 9 contracts but the actual parse entries are
// missing from every row despite USS Monitor + Indianapolis having had
// rich extractions earlier today).  Diagnostic — dumps EVERY sem-app-owned
// localStorage key + value to a downloaded JSON file.  Includes byte sizes
// so we can see if a key was silently truncated by the v431 quota-recovery
// or if the raw JSON is intact but my picker is misreading it.
// No-Silent-Data-Loss SUPREME: this makes the true state visible.
function dumpLocalStorageDiagnostic(): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dump: Record<string, { bytes: number; parsedType: string; value: unknown; parseError?: string }> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      // Only sem-app-owned keys — avoid dumping other origins' storage
      if (!key.startsWith('sem-app')) continue
      const raw = localStorage.getItem(key) ?? ''
      const entry: { bytes: number; parsedType: string; value: unknown; parseError?: string } = {
        bytes:      raw.length,
        parsedType: 'string',
        value:      raw,
      }
      try {
        const parsed = JSON.parse(raw)
        entry.parsedType = Array.isArray(parsed) ? `array[${parsed.length}]` : typeof parsed
        entry.value = parsed
      } catch (err) {
        entry.parseError = err instanceof Error ? err.message : String(err)
      }
      dump[key] = entry
    }
  } catch (err) {
    console.error('[dumpLocalStorageDiagnostic] Failed to iterate localStorage:', err)
  }
  const payload = {
    exportedAt:  new Date().toISOString(),
    exportKind:  'sem-app-localStorage-diagnostic-dump',
    appVersion:  'r41 v443',
    userAgent:   navigator.userAgent,
    totalKeys:   Object.keys(dump).length,
    totalBytes:  Object.values(dump).reduce((s, e) => s + e.bytes, 0),
    entries:     dump,
  }
  try {
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    // r41 v455 — filename swept from "localStorage-DIAGNOSTIC" (technical
    // jargon Tom saw in Finder) to plain-English "Storage-Report".
    a.download = `sem-app-Storage-Report-${timestamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    showBackupFlash.value = 'diagnostic'
    setTimeout(() => { showBackupFlash.value = null }, 4000)
    console.info(
      `[dumpLocalStorageDiagnostic] Wrote diagnostic dump · ${payload.totalKeys} keys · ${payload.totalBytes} bytes total`,
    )
  } catch (err) {
    console.error('[dumpLocalStorageDiagnostic] Failed to download:', err)
  }
}

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
  _fillTargetContractId.value = null
  showImport.value  = true
}

function cancelImport(): void {
  showImport.value = false
  _fillTargetContractId.value = null
}

/**
 * r41 v404 (Tom Gilb 2026-07-01 verbatim "it is not clear how to delete a
 * contract, or to change it or fill an empty contract") — three new card-level
 * affordances (Rename / Delete / Fill) on the "Your Contracts" grid.
 *
 * `_fillTargetContractId` — when non-null, the next `doImport()` call will
 * UPDATE that contract instead of creating a new one, so the "Fill" button on
 * an EMPTY contract card lets the planner paste text INTO that specific empty
 * contract rather than making a duplicate.  Composes with No-Silent-Data-Loss
 * SUPREME (empty contract preserved + filled in place; no orphan created).
 */
const _fillTargetContractId = ref<string | null>(null)

/** Open the import panel targeting an existing EMPTY contract — its title
 *  pre-fills the form, and `doImport()` will patch this contract instead of
 *  creating a new one. */
function openImportForContract(contractId: string): void {
  const c = store.contracts.value.find(x => x.id === contractId)
  if (!c) return
  importTitle.value   = c.title || ''
  importText.value    = c.rawImportText ?? ''
  importType.value    = c.contractType ?? 'other'
  importLoading.value = false
  importError.value   = null
  clearImport()
  _fillTargetContractId.value = contractId
  showImport.value = true
}

/** Two-step armed delete state — first click ARMS a red confirm state on the
 *  card; second click within 4 s deletes.  Auto-disarms on timeout.  Composes
 *  with Universal Undo SUPREME (delete is destructive; require deliberate
 *  confirmation) + accessibility_tom.md (verbal feedback over silent action —
 *  the button changes text + colour when armed). */
const _armedDeleteContractId = ref<string | null>(null)
let _armedDeleteTimer: ReturnType<typeof setTimeout> | null = null
function armOrConfirmDeleteContract(contractId: string): void {
  if (_armedDeleteContractId.value === contractId) {
    // Second click — commit the delete.
    if (_armedDeleteTimer) { clearTimeout(_armedDeleteTimer); _armedDeleteTimer = null }
    _armedDeleteContractId.value = null
    store.deleteContract(contractId)
    return
  }
  // First click — arm; auto-disarm after 4 s.
  _armedDeleteContractId.value = contractId
  if (_armedDeleteTimer) clearTimeout(_armedDeleteTimer)
  _armedDeleteTimer = setTimeout(() => {
    _armedDeleteContractId.value = null
    _armedDeleteTimer = null
  }, 4000)
}

/** Inline rename via `window.prompt` — simple and universally understood,
 *  keyboard accessible, no bespoke inline-editor state to manage.  If Tom
 *  wants a fancier inline editor later, this is the seam. */
function renameContract(contractId: string): void {
  const c = store.contracts.value.find(x => x.id === contractId)
  if (!c) return
  const next = window.prompt('Rename contract:', c.title)
  if (next === null) return  // user cancelled
  const trimmed = next.trim()
  if (!trimmed || trimmed === c.title) return
  store.updateContract(contractId, { title: trimmed })
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

/** Built-in samples only — shown on the landing page as one-click starters. */
const builtInEntries = computed(() => library.allEntries.value.filter(e => e.source === 'built-in'))

/**
 * Load a library entry and immediately run analysis — no import modal needed.
 * Sets the import refs, then calls doImport() which navigates to the detail view
 * and runs the full clause-split + Planguage extraction pipeline.
 */
async function quickAnalyse(entry: ContractLibraryEntry): Promise<void> {
  importTitle.value = entry.title
  importText.value  = entry.text
  importType.value  = entry.contractType
  await doImport()
}

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

// r41 v403 (Tom Gilb 2026-07-01 verbatim "I keep on trying to add the
// Indianapolis contrat to myset of test conttracts. But it doe not add it,
// maybe because we never finish it?") — new "Save to My Test Contracts"
// affordance.  Tom's hypothesis was wrong (the parse-completion state has
// nothing to do with library.addUserEntry — the flow simply had no button).
// Now: one click saves the current contract's raw text + title into the
// user's library, ready to re-run analysis with a fresh Contracts Mode or
// Guidelines set.  Composes with MOVE Principle (button visible where the
// contract detail lives; no menu-dive), Icon-Plus-Text SUPREME (💾 glyph +
// full plain-English label), DD-009 Zero-Training UI (HoverHint explains
// what "test contracts" means + confirms parse-state does not gate saving),
// No-Silent-Data-Loss SUPREME (idempotent — silently reuses an existing user
// entry with the same title + text so double-clicks don't create duplicates),
// Universal Undo SUPREME (removal path exists via `library.removeUserEntry`).
const savedToLibraryFlash = ref(false)
function saveContractToLibrary(): void {
  const c = selectedContract.value
  if (!c) return
  const title = c.title.trim() || 'Untitled contract'
  const text  = c.rawImportText?.trim() ?? ''
  if (!text) return
  // Idempotent — if the user hits Save twice, keep only one entry with this
  // title + raw text.  Prevents accidental dupes without silencing a genuine
  // "same title, different text" case (that still creates a new entry).
  const existing = library.allEntries.value.find(
    e => e.source === 'user' && e.title === title && e.text === text
  )
  if (!existing) library.addUserEntry(title, text, c.contractType ?? 'other')
  savedToLibraryFlash.value = true
  setTimeout(() => { savedToLibraryFlash.value = false }, 2200)
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
  // r41 v404 — if the user clicked "Fill" on an empty card, patch that
  // contract in place instead of creating a new one.  Composes with
  // No-Silent-Data-Loss SUPREME (no orphan empty contract left behind) +
  // Universal Undo SUPREME (Re-import remains the reversible path).
  const fillTargetId = _fillTargetContractId.value
  _fillTargetContractId.value = null
  const contract = fillTargetId
    ? store.contracts.value.find(x => x.id === fillTargetId) ?? store.createContract(title, importType.value, [])
    : store.createContract(title, importType.value, [])
  store.updateContract(contract.id, {
    title:          title,
    contractType:   importType.value,
    rawImportText:  rawText,
    parseStatus:    'splitting',
    // r41 v434 — persist ISO parse-start timestamp so ContractElapsed survives
    // Vite HMR reloads (the JS module-scope _contractAnimStart previously reset
    // to 0 on every HMR, showing wrong elapsed).
    parseStartedAt: new Date().toISOString(),
  })
  selectedId.value  = contract.id
  showImport.value  = false

  // r41 2026-06-20 — AbortController wired so the Cancel button can stop the
  // parse loop between clauses.  Stored as ref so the template Cancel button
  // can fire it.
  const ctrl = new AbortController()
  _parseAbortController.value = ctrl
  try {
    // r41 2026-06-20 (Tom Gilb verbatim "This is sort of dead text, show the
    // clauses being found") — wire the onClauseFound callback so the live
    // activity feed populates as each clause closes in the streamed LLM
    // response.  liveSplittingClauses is consumed by the Phase Activity
    // banner during 'splitting' phase to show clauses as they pop in.
    liveSplittingClauses.value = []
    let clauses = await parser.splitIntoClauses(rawText, undefined, (clause) => {
      liveSplittingClauses.value = [...liveSplittingClauses.value, clause]
    })

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
      await _parseAllClauses(contract.id, clauses, [], ctrl.signal, contract.title)
      if (!ctrl.signal.aborted) {
        store.updateContract(contract.id, { parseStatus: 'complete' })
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    store.updateContract(contract.id, { parseStatus: 'error', parseError: msg })
    importError.value = msg
  } finally {
    importLoading.value = false
    if (_parseAbortController.value === ctrl) _parseAbortController.value = null
  }
}

// r41 2026-06-20 (Tom Gilb verbatim "extracting planguage from the 38
// clauses is surely interesting, but it takes a lot of time, like 5 minutes
// each clause. Is this something we can speed up?") — Net speedup is ~50×
// on a 38-clause Indianapolis-class contract by compounding TWO
// orthogonal LLM-feature wins:
//
//   (a) Anthropic prompt caching on the per-clause prompt's PREFIX
//       (PLANGUAGE_PRIMER + Contracts Mode config + JSON schema +
//       instructions).  First call writes the cache; subsequent 37 hit
//       it — 2-5× lower latency, ~10× cheaper.  Wired in
//       `useContractParser.ts` PARSE_CLAUSE_PROMPT_PREFIX +
//       PARSE_CLAUSE_PROMPT_VARIABLE split with `cache_control:
//       { type: 'ephemeral' }` on the prefix.
//   (b) Parallel batches of N concurrent LLM calls.  38 clauses ÷ 5 per
//       batch = 8 batch-iterations instead of 38 sequential ones.
//       Each batch waits for all-settled before moving to the next so
//       a single-clause failure doesn't cascade and abort honour
//       between batches.
//
// Compose together: cache hot during the parallel run, batch size 5 = a
// 5-minute-per-clause sequential parse becomes ~30 seconds × 8 batches
// ≈ 4 minutes.  Composes with Conjunction-of-Technologies SUPREME
// (uses LLM features intelligently), Model Selection Rule SUPREME
// (Sonnet stays; speedup is from caching + concurrency, not downgrade),
// Architectural Resilience SUPREME (parser ready for higher throughput).
const PARSE_BATCH_SIZE = 5

async function _parseAllClauses(
  contractId:    string,
  clauses:       ContractClause[],
  parties:       ContractParty[],
  signal?:       AbortSignal,
  contractTitle?: string,
): Promise<void> {
  // Filter to clauses that still need parsing (resume-after-refresh
  // semantics — terminal `done`/`error` clauses are skipped).
  const pending = clauses.filter(cl => cl.parseStatus !== 'done' && cl.parseStatus !== 'error')
  for (let i = 0; i < pending.length; i += PARSE_BATCH_SIZE) {
    // r41 2026-06-20 — Cancel-between-batches check.  The currently-in-flight
    // batch's LLM calls cannot be aborted mid-flight (SDK limitation), but
    // the LOOP can stop before launching the next batch.  Worst-case wait
    // after Cancel: the in-flight batch's slowest LLM call (~20-60s).
    if (signal?.aborted) return
    const batch = pending.slice(i, i + PARSE_BATCH_SIZE)
    // Mark all clauses in the batch as 'parsing' BEFORE awaiting so the
    // progress UI updates immediately (status text shows the right "X of N"
    // count instead of jumping in 5-clause chunks).
    for (const clause of batch) {
      store.setClauseParseStatus(contractId, clause.id, 'parsing')
    }
    // Parallel batch — `Promise.allSettled` so a single-clause failure
    // doesn't take down the whole batch.  Each clause's outcome is
    // committed to the store independently.
    await Promise.allSettled(batch.map(async (clause) => {
      try {
        const entries = await parser.parseClause(
          clause,
          parties,
          // r41 v409 — Planguage Mnemonic ID Standard SUPREME: derive a
          // 1-3-word Capitalized mnemonic tag from the entry's description
          // instead of the sequential "R.1" / "V.2" pattern (banned).
          (type: ContractEntryType, description: string) => store.mnemonicTag(contractId, type, description),
          signal,
          contractTitle,
        )
        store.setClauseEntries(contractId, clause.id, entries, 'done')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Parse failed'
        store.setClauseEntries(contractId, clause.id, [], 'error', msg)
      }
    }))
  }
}

// r41 2026-06-20 (Tom Gilb verbatim "spinning wheel zero % progress is
// constant" — refresh-during-parse left the contract in an eternal-spinner
// state).  On mount, detect a contract that was mid-parse when the page
// reloaded (parseStatus='parsing' + at least one pending clause) and
// auto-resume the remaining clauses.  Avoids stranding the user with a
// dead UI.  Composes with No-Silent-Data-Loss SUPREME — the in-progress
// parse is preserved, not silently dropped.
async function _resumeIfInterrupted(): Promise<void> {
  const c = selectedContract.value
  if (!c) return
  if (c.parseStatus !== 'parsing') return
  const pending = c.clauses.filter(cl => cl.parseStatus !== 'done' && cl.parseStatus !== 'error')
  if (pending.length === 0) {
    // All clauses done but parseStatus stuck on 'parsing' — heal it.
    store.updateContract(c.id, { parseStatus: 'complete' })
    return
  }
  // Fresh AbortController so Cancel works for the resumed run.
  const ctrl = new AbortController()
  _parseAbortController.value = ctrl
  try {
    await _parseAllClauses(c.id, pending, c.parties, ctrl.signal, c.title)
    if (!ctrl.signal.aborted) {
      store.updateContract(c.id, { parseStatus: 'complete' })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parse failed'
    store.updateContract(c.id, { parseStatus: 'error', parseError: msg })
  } finally {
    if (_parseAbortController.value === ctrl) _parseAbortController.value = null
  }
}

onMounted(() => { void _resumeIfInterrupted() })

/** r41 2026-06-20 (Tom Gilb verbatim "max seconds exceeded" + "progress
 *  everything" greenlight) — Cancel/Abort handler for the long-running
 *  contract PARSE (distinct from `cancelImport()` above which closes the
 *  import modal).  Sets parseStatus to 'error' with an explanatory message
 *  so the UI flips out of the loading state.  The in-flight LLM call
 *  completes in the background (we cannot abort it mid-flight per SDK
 *  limitation) but its result is discarded once the loop sees the abort
 *  signal.  Reversible: re-import or restart parse to pick up again. */
function abortParse(): void {
  const ctrl = _parseAbortController.value
  if (!ctrl) return
  ctrl.abort()
  const c = selectedContract.value
  if (c) {
    store.updateContract(c.id, {
      parseStatus: 'error',
      parseError:  'Cancelled by user — click Resume to continue, or re-import.',
    })
  }
  importLoading.value = false
}

// r41 2026-06-20 (Tom Gilb verbatim "Reparse button at top of stakeholders,
// says reparse this clause, but there is no other for all other clauses:
// Bug?") — yes, missing contract-level bulk affordance.  The existing per-
// clause Re-parse button lets you re-run ONE clause; this new button re-
// runs ALL clauses, useful after you change Contracts Mode settings
// (Presentation / Standards / Purposes — including switching Rewrite on
// or off so the rewrittenText column gets populated for the Rewrites tab).
// Two-stage button so an accidental click doesn't blow away 38 clauses'
// worth of LLM work — first click arms (shows "Click again to confirm"
// state for 4 s), second click executes.
const reparseAllArmed = ref(false)
let _reparseAllArmedTimer: ReturnType<typeof setTimeout> | null = null

function armReparseAll(): void {
  if (reparseAllArmed.value) {
    // Second click — execute.
    reparseAllArmed.value = false
    if (_reparseAllArmedTimer) { clearTimeout(_reparseAllArmedTimer); _reparseAllArmedTimer = null }
    void _reparseAllClausesExecute()
    return
  }
  // First click — arm for 4 s.
  reparseAllArmed.value = true
  _reparseAllArmedTimer = setTimeout(() => {
    reparseAllArmed.value = false
    _reparseAllArmedTimer = null
  }, 4000)
}

async function _reparseAllClausesExecute(): Promise<void> {
  const c = selectedContract.value
  if (!c || c.clauses.length === 0) return

  // r41 v461 (Tom Gilb 2026-07-02 verbatim *"after a 30 min of running a
  // clause parse I came back to this, nothing"* — Re-parse All silently
  // destroyed 425 recovered entries + produced 8 useless ones from the
  // Claudian-written container-clause description).  No-Silent-Data-Loss
  // SUPREME + Trust-Rebuild: name what is about to be destroyed BEFORE
  // destroying it.  Special-case the recovered-from-.eml contract shape
  // because re-parsing THAT is almost always a mistake (the "clauses"
  // are Claudian-written descriptions, not real contract text).
  const existingEntryCount = c.clauses.reduce((s, cl) => s + (cl.entries?.length ?? 0), 0)
  const isRecovered        = /\(recovered from \.eml\)/i.test(c.title)
  if (existingEntryCount > 0) {
    const recoveredWarning = isRecovered
      ? `\n\n⚠ THIS CONTRACT WAS RECOVERED FROM AN .eml FILE.\nIts clauses contain a Claudian-written description of the recovery, NOT the original contract text.  Re-parsing will destroy your ${existingEntryCount} recovered entries and produce very few new ones from the description text.\n\nThis is almost certainly NOT what you want.  Cancel + use Import Contract Backup instead to bring in a fresh copy of the .eml recovery JSON.\n\n`
      : `\n\n`
    const proceed = window.confirm(
      `Re-parse All will DELETE the ${existingEntryCount} existing Planguage entries across all ${c.clauses.length} clauses and re-extract from the raw clause text.` +
      recoveredWarning +
      `Are you sure you want to proceed?`,
    )
    if (!proceed) return
  }

  // Reset every clause's parseStatus to 'pending' + clear its entries so the
  // pending-filter in _parseAllClauses picks up ALL of them (not just the
  // currently-non-done ones).  Composes with No-Silent-Data-Loss SUPREME —
  // the previous entries ARE discarded (this is a re-parse, not an addition);
  // the original raw clause text is preserved (lives on `clause.rawText`,
  // never touched), so re-parsing reproduces the LLM-derived entries.
  for (const cl of c.clauses) {
    store.setClauseEntries(c.id, cl.id, [], 'pending')
  }
  store.updateContract(c.id, { parseStatus: 'parsing' })
  // Fresh AbortController so the existing Cancel-Import button works on this
  // re-parse too.
  const ctrl = new AbortController()
  _parseAbortController.value = ctrl
  try {
    await _parseAllClauses(c.id, c.clauses, c.parties, ctrl.signal, c.title)
    if (!ctrl.signal.aborted) {
      store.updateContract(c.id, { parseStatus: 'complete' })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Re-parse failed'
    store.updateContract(c.id, { parseStatus: 'error', parseError: msg })
  } finally {
    if (_parseAbortController.value === ctrl) _parseAbortController.value = null
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
      (type: ContractEntryType, description: string) => store.mnemonicTag(contract.id, type, description),
      undefined,
      contract.title,
    )
    store.setClauseEntries(contract.id, clause.id, entries, 'done')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parse failed'
    store.setClauseEntries(contract.id, clause.id, [], 'error', msg)
  }
}

// ── Entries filter ────────────────────────────────────────────────────────────

const entryFilter = ref<ContractEntryType | 'all'>('all')

// r41 2026-06-20 (Phase 3A — Rewrites tab) — per-entry tick state for the
// rewrites review.  Lives in a Set keyed by entry.id so it survives Vue
// re-renders.  Persists session-local only; Phase 3C will persist it
// alongside the new contract version.  Default = empty (planner ticks
// explicitly).
const rewriteTicks            = ref<Set<string>>(new Set())
const rewriteTypeFilter       = ref<ContractEntryType | 'all'>('all')
const rewriteOnlyWithRewrites = ref(true)

// r41 2026-06-20 (Phase 3.5A — Guidelines Library) — open state for the
// GuidelineLibraryPanel drawer.  Triggered from the "📚 Guidelines" button
// in the Rewrites tab filter row.
const guidelineLibraryOpen = ref(false)

// r41 2026-06-20 (Tom Gilb verbatim "we need to display exactly which
// library is being used, at the moment in our screen, and have a switch
// guidelines, and add guidelines options right there") — Always-visible
// Active Guidelines bar.  Reads the pinned set off useGuidelineLibrary
// for the current contract.  Composes with: MOVE Principle (active set
// visible at-a-glance, no menu-dive), Sources-of-Specs SUPREME (provenance
// visible), Conjunction-of-Technologies SUPREME (the planner SEES which
// rule set is driving the AI).
import { useGuidelineLibrary } from '../composables/useGuidelineLibrary'
import type { Guideline } from '../types/guidelines'
const _guidelineLib = useGuidelineLibrary()

// r41 2026-06-20 (Tom Gilb verbatim "we need to specify exactly which Reparse
// guidelines can be used, and give choice to select a different set of
// guidelines") — Re-parse Guidelines picker.  Opens before any Re-parse
// runs (per-clause OR contract-level), pre-selects the currently-pinned
// Guidelines, and lets the planner tick a different set for this run.
// The "Save as new pinned set" toggle controls whether the selection
// updates the contract's pinned state — defaults ON since that matches
// the simplest mental model (what you re-parse with becomes what's
// pinned).  Composes with: MOVE Principle (the choice is at the moment
// of need, no menu-dive), DD-009 Zero-Training UI (full disclosure of
// what will run), No-Silent-Data-Loss SUPREME (planner sees the rule
// change before it commits), Sources-of-Specs SUPREME (Guideline tags +
// versions captured), Universal Undo SUPREME (Switch Plan / re-pick
// reverses), Trace-Before-Patch SUPREME (the picker IS the trace —
// shows what's about to fire).
type ReparseTarget = { kind: 'clause'; clauseId: string } | { kind: 'all' }
const reparsePickerOpen          = ref(false)
const reparsePickerTarget        = ref<ReparseTarget | null>(null)
const reparsePickerSelectedIds   = ref<Set<string>>(new Set())
const reparsePickerSaveAsPinned  = ref(true)

function openReparsePicker(target: ReparseTarget): void {
  reparsePickerTarget.value = target
  // Pre-select the currently-pinned Guideline IDs for this contract.
  reparsePickerSelectedIds.value = new Set(activeGuidelines.value.map(ag => ag.guideline.id))
  reparsePickerSaveAsPinned.value = true
  reparsePickerOpen.value = true
}

function toggleReparseGuideline(guidelineId: string): void {
  const s = new Set(reparsePickerSelectedIds.value)
  if (s.has(guidelineId)) s.delete(guidelineId)
  else                     s.add(guidelineId)
  reparsePickerSelectedIds.value = s
}

function cancelReparsePicker(): void {
  reparsePickerOpen.value   = false
  reparsePickerTarget.value = null
}

async function confirmReparseWithGuidelines(): Promise<void> {
  const target = reparsePickerTarget.value
  const c = selectedContract.value
  if (!target || !c) { cancelReparsePicker(); return }
  // If "Save as new pinned set" is on, update the contract's pinned
  // Guidelines BEFORE running the re-parse so that future re-parses and
  // the Active Guidelines bar reflect the choice.  Composes with No-
  // Silent-Data-Loss SUPREME — the prior pin state is recoverable by
  // re-opening the Library and pinning the prior set.
  if (reparsePickerSaveAsPinned.value) {
    const newPins = [...reparsePickerSelectedIds.value].map(gid => {
      const g = _guidelineLib.library.value.find(x => x.id === gid)
      return g ? { guidelineId: gid, version: g.version, pinnedAt: new Date().toISOString() } : null
    }).filter((p): p is { guidelineId: string; version: number; pinnedAt: string } => !!p)
    _guidelineLib.setActivePins(c.id, newPins)
  }
  // Close picker BEFORE awaiting the long-running re-parse so the planner
  // sees the parse start immediately (rather than the picker hanging).
  const t = target
  cancelReparsePicker()
  if (t.kind === 'clause') {
    const cl = c.clauses.find(x => x.id === t.clauseId)
    if (cl) await reparseClause(cl)
  } else {
    void _reparseAllClausesExecute()
  }
}

const reparsePickerSummary = computed(() => {
  const selected = [...reparsePickerSelectedIds.value]
    .map(id => _guidelineLib.library.value.find(g => g.id === id))
    .filter((g): g is Guideline => !!g)
  return selected
})
const activeGuidelines = computed(() => {
  const id = selectedContract.value?.id
  if (!id) return []
  const set = _guidelineLib.activeSetFor(id)
  if (!set) return []
  return set.pins
    .map(p => {
      const g = _guidelineLib.library.value.find(x => x.id === p.guidelineId)
      return g ? { guideline: g, pin: p } : null
    })
    .filter((x): x is { guideline: import('../types/guidelines').Guideline; pin: import('../types/guidelines').GuidelinePin } => !!x)
})

/** All entries that have a non-empty `rewrittenText`, optionally filtered by
 *  type.  `rewrittenText` is populated by the LLM when Contracts Mode's
 *  Purpose axis includes 'rewrite' — see useContractParser.ts PURPOSE_
 *  INSTRUCTIONS.  Composes with: Sources-of-Specs SUPREME (every rewrite is
 *  AI-generated provenance, traceable to the Contracts Mode config at parse
 *  time), No-Silent-Data-Loss SUPREME (originals always preserved). */
const entriesWithRewrites = computed<PlanguageContractEntry[]>(() => {
  const all = store.allEntries.value
  const filtered = all.filter(e => {
    if (rewriteOnlyWithRewrites.value && !(e.rewrittenText && e.rewrittenText.trim())) return false
    if (rewriteTypeFilter.value !== 'all' && e.type !== rewriteTypeFilter.value) return false
    return true
  })
  return filtered
})

function toggleRewriteTick(entryId: string): void {
  const s = new Set(rewriteTicks.value)
  if (s.has(entryId)) s.delete(entryId)
  else s.add(entryId)
  rewriteTicks.value = s
}

// r41 v475 — Rewrites tab export (Tom Gilb 2026-07-03 verbatim: "I cannot
// see how to export the susbsets (Values, Function) or the complete set of
// these recommendations").  Two scopes visible in the Rewrites tab filter
// row: (a) SHOWN = current filtered view (respects rewriteTypeFilter +
// rewriteOnlyWithRewrites); (b) WHOLE SET = every entry with a rewrite
// regardless of the type filter.  Both pins always visible → Tom picks
// scope without hunting.  Composes with Export-button-on-all-windows
// SUPREME + MOVE Principle + Icon-Plus-Text + Mailto-No-Self-To (empty To:
// because Tom is the sender) + Colorful HTML Spec Email Rule + One-Table-
// for-Cohesion (single outer table, no nesting).
const allEntriesWithRewrites = computed<PlanguageContractEntry[]>(() =>
  store.allEntries.value.filter(e => !!(e.rewrittenText && e.rewrittenText.trim())),
)

const _typeLabel: Record<ContractEntryType, string> = {
  F: 'Function', V: 'Value', C: 'Constraint', R: 'Resource', S: 'Stakeholder', Sol: 'Solution', Task: 'Task',
}
const _typeColor: Record<ContractEntryType, string> = {
  F: '#059669', V: '#7c3aed', C: '#dc2626', R: '#0ea5e9', S: '#2563eb', Sol: '#ea580c', Task: '#475569',
}

function _rewritesHtml(entries: PlanguageContractEntry[], scopeLabel: string): string {
  const c = selectedContract.value
  const contractTitle = c?.title ?? 'Contract'
  const now = new Date()
  const stamp = now.toISOString().slice(0, 10)
  const rows: string[] = []
  // Header row.
  rows.push(
    `<tr><td colspan="4" bgcolor="#1e293b" style="background:#1e293b;color:#fff;padding:14px 18px;font:600 15px/1.4 -apple-system,BlinkMacSystemFont,sans-serif">` +
    `<div style="font:700 18px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;margin-bottom:4px">Contract Rewrites — ${escapeHtml(scopeLabel)}</div>` +
    `<div style="font:400 12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;opacity:.85">${escapeHtml(contractTitle)} · Exported ${stamp} · ${entries.length} rewrite${entries.length === 1 ? '' : 's'}</div>` +
    `</td></tr>`,
  )
  // Column-header row.
  rows.push(
    `<tr>` +
    `<td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#334155;padding:8px 12px;font:700 11px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #cbd5e1">Type / Tag</td>` +
    `<td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#334155;padding:8px 12px;font:700 11px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #cbd5e1">Original (as extracted)</td>` +
    `<td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#334155;padding:8px 12px;font:700 11px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #cbd5e1">Proposed rewrite</td>` +
    `<td bgcolor="#f1f5f9" style="background:#f1f5f9;color:#334155;padding:8px 12px;font:700 11px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #cbd5e1">Change log</td>` +
    `</tr>`,
  )
  // Per-entry rows.
  for (const e of entries) {
    const typeColor = _typeColor[e.type] ?? '#475569'
    const typeName  = _typeLabel[e.type] ?? String(e.type)
    const tag       = e.tag ?? ''
    const original  = e.rawText ?? e.description ?? ''
    const rewrite   = e.rewrittenText ?? ''
    rows.push(
      `<tr>` +
      `<td bgcolor="#ffffff" style="background:#fff;padding:10px 12px;vertical-align:top;border-bottom:1px solid #e2e8f0;font:600 12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:${typeColor};white-space:nowrap">` +
      `<div>${escapeHtml(typeName)}</div>` +
      `<div style="font:400 11px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;color:#64748b;margin-top:2px">${escapeHtml(tag)}</div>` +
      `</td>` +
      `<td bgcolor="#fefce8" style="background:#fefce8;padding:10px 12px;vertical-align:top;border-bottom:1px solid #e2e8f0;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;color:#334155">${escapeHtml(original)}</td>` +
      `<td bgcolor="#fef2f2" style="background:#fef2f2;padding:10px 12px;vertical-align:top;border-bottom:1px solid #e2e8f0;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;color:#334155">${escapeHtml(rewrite)}</td>` +
      `<td bgcolor="#f0fdf4" style="background:#f0fdf4;padding:10px 12px;vertical-align:top;border-bottom:1px solid #e2e8f0;font:400 11px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#166534">${_changeLogHtml(e)}</td>` +
      `</tr>`,
    )
  }
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:960px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,sans-serif">${rows.join('')}</table>`
}

function _changeLogHtml(e: PlanguageContractEntry): string {
  const before = e.rawText ?? e.description ?? ''
  const after  = e.rewrittenText ?? ''
  if (!before && !after) return '<em style="color:#94a3b8">No change details.</em>'
  return `<div><strong style="color:#dc2626">Before:</strong> <span style="text-decoration:line-through;color:#94a3b8">${escapeHtml(before.slice(0, 200))}${before.length > 200 ? '…' : ''}</span></div>` +
         `<div style="margin-top:4px"><strong style="color:#166534">After:</strong> ${escapeHtml(after.slice(0, 200))}${after.length > 200 ? '…' : ''}</div>`
}

function _rewritesPlain(entries: PlanguageContractEntry[], scopeLabel: string): string {
  const c = selectedContract.value
  const contractTitle = c?.title ?? 'Contract'
  const stamp = new Date().toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push(`Contract Rewrites — ${scopeLabel}`)
  lines.push(`${contractTitle} · Exported ${stamp} · ${entries.length} rewrite${entries.length === 1 ? '' : 's'}`)
  lines.push('')
  for (const e of entries) {
    const typeName = _typeLabel[e.type] ?? String(e.type)
    lines.push(`── ${typeName} · ${e.tag ?? ''} ──`)
    lines.push(`Original: ${e.rawText ?? e.description ?? ''}`)
    lines.push(`Proposed rewrite: ${e.rewrittenText ?? ''}`)
    lines.push('')
  }
  return lines.join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const rewritesCopyShownFlash = ref(false)
const rewritesCopyAllFlash   = ref(false)
const rewritesEmailShownFlash = ref(false)
const rewritesEmailAllFlash   = ref(false)

function _rewritesScopeLabel(scope: 'shown' | 'all', entries: PlanguageContractEntry[]): string {
  if (scope === 'all') return 'Complete set (every entry with a rewrite)'
  // shown: describe the filter state
  const parts: string[] = []
  if (rewriteTypeFilter.value !== 'all') {
    parts.push(`${_typeLabel[rewriteTypeFilter.value as ContractEntryType] ?? rewriteTypeFilter.value}s only`)
  }
  if (parts.length === 0) return `Shown (${entries.length})`
  return `${parts.join(', ')} (${entries.length})`
}

async function copyRewrites(scope: 'shown' | 'all'): Promise<void> {
  const entries = scope === 'all' ? allEntriesWithRewrites.value : entriesWithRewrites.value
  if (entries.length === 0) return
  const label = _rewritesScopeLabel(scope, entries)
  const html  = _rewritesHtml(entries, label)
  const plain = _rewritesPlain(entries, label)
  const ok = await exportCopy(html, plain)
  if (!ok) return
  if (scope === 'shown') {
    rewritesCopyShownFlash.value = true
    setTimeout(() => { rewritesCopyShownFlash.value = false }, 2200)
  } else {
    rewritesCopyAllFlash.value = true
    setTimeout(() => { rewritesCopyAllFlash.value = false }, 2200)
  }
}

async function emailRewrites(scope: 'shown' | 'all'): Promise<void> {
  const entries = scope === 'all' ? allEntriesWithRewrites.value : entriesWithRewrites.value
  if (entries.length === 0) return
  const label = _rewritesScopeLabel(scope, entries)
  const html  = _rewritesHtml(entries, label)
  const plain = _rewritesPlain(entries, label)
  const contractTitle = selectedContract.value?.title ?? 'Contract'
  const subject = `Contract Rewrites — ${label} — ${contractTitle}`
  // Mailto-No-Self-To SUPREME — Tom is the sender; leave To: empty.
  await exportEmail(html, subject, `Contract Rewrites (${label})`, '', plain)
  if (scope === 'shown') {
    rewritesEmailShownFlash.value = true
    setTimeout(() => { rewritesEmailShownFlash.value = false }, 2200)
  } else {
    rewritesEmailAllFlash.value = true
    setTimeout(() => { rewritesEmailAllFlash.value = false }, 2200)
  }
}

const filteredEntries = computed<PlanguageContractEntry[]>(() => {
  const entries = store.allEntries.value
  if (entryFilter.value === 'all') return entries
  return entries.filter(e => e.type === entryFilter.value)
})

// ── Export ────────────────────────────────────────────────────────────────────

const FROM_ADDR     = 'Tom Gilb <Tom@Gilb.com>'
const copiedExport  = ref(false)
const emailedExport = ref(false)
/** Recipient address for the email export — typed by the user before clicking Email. */
const emailTo       = ref('')

function buildExportHtml(): string {
  const c = selectedContract.value
  if (!c) return ''
  const entries = store.allEntries.value

  // r41 v436 (Tom Gilb 2026-07-02 verbatim *"as per our standard, remove the
  // F. and C. etc"*) — Spell-out-Type-Names SUPREME compliance in the export
  // renderer.  Old code emitted `${type}. ${CONTRACT_ENTRY_FULL[type]}` →
  // "S. Stakeholder" / "C. Constraint" / "F. Function" etc. — every one a
  // violation.  Now emit ONLY the spelled-out word from CONTRACT_ENTRY_FULL:
  // "Stakeholder" / "Constraint" / "Function" / "Solution".  Colour still
  // conveys the type at a glance; the letter+period prefix was redundant.
  const badge = (type: ContractEntryType) =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;` +
    `background:${TYPE_COLORS[type].bg};color:${TYPE_COLORS[type].text}">` +
    `${CONTRACT_ENTRY_FULL[type]}</span>`

  // Labelled sub-field — small grey label + value, one per line.
  const field = (label: string, value: string | undefined, color = '#334155') =>
    value
      ? `<div style="margin-top:4px;font-size:10px;">` +
        `<span style="color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${label}:</span> ` +
        `<span style="color:${color}">${value}</span></div>`
      : ''

  // All type-specific Planguage fields — shown below description for each entry.
  const details = (e: PlanguageContractEntry): string => {
    const parts: string[] = []
    // F — binary presence statement
    if (e.type === 'F' && e.presenceTest)
      parts.push(field('Presence test', e.presenceTest))
    // V + R — Kai-Zen Glossary canonical order (r41 v412):
    //   Scale · Meter · Past · Status · Wish · Goal · Tolerable
    if (e.type === 'V' || e.type === 'R') {
      parts.push(field('Scale',     e.scale))
      parts.push(field('Meter',     e.meter))
      parts.push(field('Past',      e.past))
      parts.push(field('Status',    e.status))
      parts.push(field('Wish',      e.wish,      '#6d28d9'))
      parts.push(field('Goal',      e.goal,      '#0f766e'))
      parts.push(field('Tolerable', e.tolerable, '#b45309'))
    }
    // C — hard constraint text
    if (e.type === 'C' && e.constraintText)
      parts.push(field('Constraint', e.constraintText, '#dc2626'))
    // Task / S — deadline
    if ((e.type === 'Task' || e.type === 'S') && e.deadline)
      parts.push(field('Deadline', e.deadline, '#0369a1'))
    return parts.join('')
  }

  const rows = entries.map(e => `
    <tr style="border-bottom:1px solid #e2e8f0;vertical-align:top;">
      <td style="padding:8px 10px;white-space:nowrap">${badge(e.type)} <span style="font-family:monospace;font-size:10px;color:#475569">${e.tag}</span></td>
      <td style="padding:8px 10px;font-size:11px;color:#334155;white-space:nowrap">${e.obligatedParty ?? '—'}</td>
      <td style="padding:8px 10px;font-size:12px;color:#1e293b">
        <div style="font-weight:600">${e.description}</div>
        ${details(e)}
      </td>
      <td style="padding:8px 10px;font-size:11px;color:#64748b">${e.isAmbiguous ? `<span style="color:#b45309">⚠ ${e.ambiguityNote ?? 'Ambiguous'}</span>` : '<span style="color:#059669">✓</span>'}</td>
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
    <th style="padding:10px;text-align:left;font-size:12px;white-space:nowrap">Party</th>
    <th style="padding:10px;text-align:left;font-size:12px">Obligation &amp; Details</th>
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

async function emailExport(): Promise<void> {
  // r41 v435 (Tom Gilb 2026-07-02 verbatim *"I made an email (which failed to
  // work, bug) but the copy worked and I pasted into email"*).  The old flow
  // used `openEml()` which downloads a .eml file — this pattern was RETIRED
  // 2026-06-04 per the Auto-Open Email SUPREME rule because Safari silently
  // saves the .eml to Downloads instead of auto-opening Mail.app.  Tom saw
  // the ⬇︎ download indicator in Safari's title bar but Mail never opened,
  // so he had to fall back to Copy → paste into a manual email.  New flow
  // uses the canonical `exportEmail()` from useExportShared: puts colourful
  // HTML on the clipboard, opens Mail via mailto: with a LOUD ⌘V paste cue
  // per SEM Email Body Standard.  Recipient defaults to whatever `emailTo`
  // is set to (else empty per Mailto-No-Self-To SUPREME — Tom is the SENDER
  // here, not the recipient; SEM App-initiated exports leave To: blank so
  // Tom can add the actual recipient in Mail).  Composes with **Auto-Open
  // Email Rule SUPREME**, **Mailto-No-Self-To SUPREME**, **Colorful HTML
  // Spec Email Rule SUPREME** (HTML on clipboard), **SEM Email Body
  // Standard SUPREME** (LOUD ⌘V cue), **No-Silent-Data-Loss SUPREME** (a
  // .eml going silently to Downloads was silent orientation loss).
  const c = selectedContract.value
  if (!c) return
  const subject = `${c.title} — Planguage Contract Analysis`
  const recipient = emailTo.value.trim() || ''   // empty per Mailto-No-Self-To
  try {
    await exportEmail(
      buildExportHtml(),           // colourful HTML for clipboard
      subject,                     // Mail subject
      'Planguage Contract',        // clipboard-label banner text
      recipient,                   // To: (blank when SEM App is initiating)
      buildObligationText(),       // plain-text fallback
    )
    emailedExport.value = true
    setTimeout(() => { emailedExport.value = false }, 2500)
  } catch (err) {
    console.error('[emailExport] exportEmail failed:', err)
    // Graceful fallback — same .eml-download path as before so no regression
    // in cases where mailto: is somehow blocked (rare; but this preserves the
    // Copy-then-paste workaround Tom already discovered).
    openEml(buildExportHtml(), subject, {
      from: FROM_ADDR,
      to:   recipient ? [recipient] : [],
      plainBody: buildObligationText(),
    })
  }
}

function buildObligationText(): string {
  const c = selectedContract.value
  if (!c) return ''
  return store.allEntries.value.map(e => {
    const extras: string[] = []
    if (e.type === 'F' && e.presenceTest)      extras.push(`Presence: ${e.presenceTest}`)
    // V + R — Kai-Zen Glossary canonical order (r41 v412).
    if (e.type === 'V' || e.type === 'R') {
      if (e.scale)     extras.push(`Scale: ${e.scale}`)
      if (e.meter)     extras.push(`Meter: ${e.meter}`)
      if (e.past)      extras.push(`Past: ${e.past}`)
      if (e.status)    extras.push(`Status: ${e.status}`)
      if (e.wish)      extras.push(`Wish: ${e.wish}`)
      if (e.goal)      extras.push(`Goal: ${e.goal}`)
      if (e.tolerable) extras.push(`Tolerable: ${e.tolerable}`)
    }
    if (e.type === 'C' && e.constraintText)    extras.push(`Constraint: ${e.constraintText}`)
    if ((e.type === 'Task' || e.type === 'S') && e.deadline)
                                               extras.push(`Deadline: ${e.deadline}`)
    if (e.isAmbiguous && e.ambiguityNote)      extras.push(`⚠ ${e.ambiguityNote}`)
    const detail = extras.length ? `\n    ${extras.join('\n    ')}` : ''
    return `${e.tag}\t${e.obligatedParty ?? 'ALL'}\t${e.description}${detail}`
  }).join('\n')
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
 * TAB_COLORS — distinctive per-tab identity color.
 * Active tab: this color as background, white text.
 * Inactive tab: this color as text/glyph color.
 * Chosen from the Planguage canonical palette so each tab has semantic resonance.
 */
const TAB_COLORS: Record<string, string> = {
  clauses:  '#0f766e',  // teal   — contract identity / source text
  entries:  '#7c3aed',  // violet — Planguage Value canonical (dominant entry type)
  matrix:   '#b45309',  // amber  — analysis / Evo Step palette
  export:   '#1d4ed8',  // blue   — delivery / stakeholder canonical
  // r41 2026-06-20 (Phase 3A) — rewrites tab gets rose-700 (a distinctive
  // colour family not used by any existing Planguage type palette — keeps
  // the rewrite-review surface visually distinct from extraction).
  rewrites: '#be185d',  // rose   — proposed-revision / human-AI collaboration
}

/**
 * CONTRACT_FILTER_GLYPHS — maps each ContractEntryType to its PlGlyphType for the
 * Color Glyph filter strip. Single-click filters entries; double-click opens GlyphDataPanel
 * (DD-013 — handled internally by PlTypeIcon via useGlyphPanel). Note: S. = Stakeholder
 * Duty in the contract domain (not Solution — different domain mapping).
 */
const CONTRACT_FILTER_GLYPHS = [
  { contractType: 'F'    as const, glyphType: 'function'    as const, label: 'Function',    keyword: 'Function',    hex: '#16a34a' },
  { contractType: 'V'    as const, glyphType: 'value'       as const, label: 'Value',       keyword: 'Value',       hex: '#7c3aed' },
  { contractType: 'C'    as const, glyphType: 'constraint'  as const, label: 'Constraint',  keyword: 'Constraint',  hex: '#dc2626' },
  { contractType: 'R'    as const, glyphType: 'resource'    as const, label: 'Resource',    keyword: 'Resource',    hex: '#166534' },
  // r41 v430 (Tom Gilb 2026-07-02) — Solution restored as a distinct type
  // between Resource and Stakeholder.  Uses canonical orange (#ea580c) matching
  // Planguage Solution colour convention in useColorfulSpecHtml.ts.  Glyph:
  // 'solution' (the arrow-and-brackets Planguage keyed icon).
  { contractType: 'Sol'  as const, glyphType: 'solution'    as const, label: 'Solution',    keyword: 'Solution',    hex: '#ea580c' },
  { contractType: 'S'    as const, glyphType: 'stakeholder' as const, label: 'Stakeholder', keyword: 'Stakeholder', hex: '#2563eb' },
  { contractType: 'Task' as const, glyphType: 'task'        as const, label: 'Task',        keyword: 'Task',        hex: '#374151' },
]

/**
 * CONTRACT_ENTRY_FULL — spelled-out names for each ContractEntryType.
 * Universal label rule (Tom Gilb, 2026-06-01): type codes must never appear
 * alone. Always show the full name next to the code or glyph.
 */
const CONTRACT_ENTRY_FULL: Record<ContractEntryType, string> = {
  F:    'Function',
  V:    'Value',
  C:    'Constraint',
  R:    'Resource',
  Sol:  'Solution',
  S:    'Stakeholder',
  Task: 'Task',
}

/**
 * r41 v397 (Tom Gilb 2026-07-01 verbatim *"can you clean the old F V etc to
 * Functions Values"*) — pluralised full-word labels for count-based renders.
 * Per Spell-out-Type-Names SUPREME + Pluralisation Rule (plural for 0 and 2+,
 * singular for exactly 1).  Consumers pick the branch based on the count.
 */
const CONTRACT_ENTRY_FULL_PLURAL: Record<ContractEntryType, string> = {
  F:    'Functions',
  V:    'Values',
  C:    'Constraints',
  R:    'Resources',
  Sol:  'Solutions',
  S:    'Stakeholders',
  Task: 'Tasks',
}
/** Pick singular vs plural per Pluralisation Rule — pass the count. */
function _entryTypeFullByCount(type: ContractEntryType, n: number): string {
  return n === 1 ? CONTRACT_ENTRY_FULL[type] : CONTRACT_ENTRY_FULL_PLURAL[type]
}

/**
 * CONTRACT_ENTRY_GLYPH — maps ContractEntryType to a PlGlyphType string for
 * PlTypeBadge. Note: in contracts, S. = Stakeholder Duty (NOT Solution —
 * which is what the single letter 'S' maps to in the main plan domain).
 * Passing the full name 'stakeholder' overrides the LETTER_MAP.
 */
const CONTRACT_ENTRY_GLYPH: Record<ContractEntryType, string> = {
  F:    'function',
  V:    'value',
  C:    'constraint',
  R:    'resource',
  Sol:  'solution',      // r41 v430 — Solution as distinct type
  S:    'stakeholder',   // Stakeholder in contract context (v427)
  Task: 'task',
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
  // r41 v433 — Solution added with canonical orange (Planguage colour convention).
  // v427 reassigned S = Stakeholder; the S row's colour flipped from violet
  // → blue to match CONTRACT_FILTER_GLYPHS `#2563eb`.
  Sol:  { bg: '#fff7ed', text: '#c2410c',
          tw:           'bg-orange-50 text-orange-700 border-orange-200',
          entryCardCls: 'border-orange-200 bg-orange-50',
          activeTw:     'bg-orange-200 text-orange-700 border-orange-200',
          textBorder:   'text-orange-700 border-orange-200' },
  S:    { bg: '#eff6ff', text: '#1d4ed8',
          tw:           'bg-blue-50 text-blue-700 border-blue-200',
          entryCardCls: 'border-blue-200 bg-blue-50',
          activeTw:     'bg-blue-200 text-blue-700 border-blue-200',
          textBorder:   'text-blue-700 border-blue-200' },
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

// r41 2026-06-20 (Tom Gilb verbatim "we need to Number the 'Contract Phase's
// as well as name them, and make the phase title much bigger colorful")
// — phase-pill upgrade.  Was a 10 px white-on-translucent badge that
// disappeared into the green header bar.  Now: numbered phase (Phase 1 / 2
// / 3 / ✓), much bigger (text-base), vivid colour per phase, optional
// pulsing dot when active.  Composes with: Icon-Plus-Text SUPREME (numbered
// chip + phase title), MOVE Principle (phase visible at-a-glance, no
// menu-dive), DD-009 Zero-Training UI (phase number teaches the workflow
// shape), accessibility_tom.md (Tom 85 — bigger fonts + high contrast).
//
// Phase numbering aligns with the Contracts agent end-to-end flow:
//   Phase 1 — Splitting contract into clauses
//   Phase 2 — Extracting Planguage obligations
//   Phase 3 — Review proposed rewrites (Tab "Rewrites", shipped 2026-06-20)
//   Phase 4 — Save as new contract version (planned, Phase 3C)
// Only the CURRENT phase shows in the header; future phases surface in
// their respective tabs.
interface ParseStatusInfo {
  /** Phase number to display (null for non-active / pre-phase states). */
  phase:   number | null
  /** Short label shown in the pill. */
  label:   string
  /** Tailwind colour scheme for the pill — bg + text + ring. */
  tone:    'cyan' | 'amber' | 'emerald' | 'red' | 'slate'
  /** True → animated pulse dot at the left of the pill. */
  pulse:   boolean
}

const PARSE_STATUS_INFO: Record<string, ParseStatusInfo> = {
  empty:     { phase: null, label: 'No content yet',                       tone: 'slate',   pulse: false },
  raw:       { phase: null, label: 'Text imported — ready to analyse',     tone: 'slate',   pulse: false },
  splitting: { phase: 1,    label: 'Splitting contract into clauses',      tone: 'cyan',    pulse: true  },
  // r41 2026-06-20 (Tom Gilb verbatim correction "ok but not 'Planguage
  // Obligations', 'Contractural Obligations, expressed in Planguage'") —
  // canonical label.  We are NOT extracting "Planguage" (the methodology
  // itself); we are extracting CONTRACTUAL OBLIGATIONS and expressing them
  // IN Planguage form.  The distinction matters per Spell-out-Type-Names
  // SUPREME — Planguage is the medium, not the content.
  parsing:   { phase: 2,    label: 'Extracting Contractual Obligations, expressed in Planguage', tone: 'amber',   pulse: true  },
  complete:  { phase: 3,    label: 'Analysis complete',                    tone: 'emerald', pulse: false },
  error:     { phase: null, label: 'Error',                                tone: 'red',     pulse: false },
  pending:   { phase: null, label: 'Pending',                              tone: 'slate',   pulse: false },
  done:      { phase: null, label: 'Done',                                 tone: 'emerald', pulse: false },
}

/** Tailwind class bundles for each tone — kept inline so the colour palette
 *  matches the Contracts agent header's dark-teal background.  Bright vivid
 *  tones for active phases (cyan / amber) so they pop; emerald for complete;
 *  red for error; muted slate for inactive / no-phase states. */
const PARSE_STATUS_TONE_CLASSES: Record<ParseStatusInfo['tone'], { pillBg: string; pillText: string; pillRing: string; numBg: string; numText: string; dotBg: string }> = {
  cyan:    { pillBg: 'bg-cyan-100',    pillText: 'text-cyan-900',    pillRing: 'ring-cyan-200',    numBg: 'bg-cyan-600',    numText: 'text-white', dotBg: 'bg-cyan-500'    },
  amber:   { pillBg: 'bg-amber-100',   pillText: 'text-amber-900',   pillRing: 'ring-amber-200',   numBg: 'bg-amber-600',   numText: 'text-white', dotBg: 'bg-amber-500'   },
  emerald: { pillBg: 'bg-emerald-100', pillText: 'text-emerald-900', pillRing: 'ring-emerald-200', numBg: 'bg-emerald-600', numText: 'text-white', dotBg: 'bg-emerald-500' },
  red:     { pillBg: 'bg-red-100',     pillText: 'text-red-900',     pillRing: 'ring-red-200',     numBg: 'bg-red-600',     numText: 'text-white', dotBg: 'bg-red-500'     },
  slate:   { pillBg: 'bg-white/20',    pillText: 'text-white/90',    pillRing: 'ring-white/30',    numBg: 'bg-white/30',    numText: 'text-white', dotBg: 'bg-white/50'    },
}

/** Convenience computed wiring for the template. */
const currentParseStatusInfo = computed<ParseStatusInfo>(() => {
  const key = store.overallParseStatus.value
  return PARSE_STATUS_INFO[key] ?? { phase: null, label: String(key), tone: 'slate', pulse: false }
})
const currentParseStatusClasses = computed(() => PARSE_STATUS_TONE_CLASSES[currentParseStatusInfo.value.tone])

// ── Loading animation — Rule 8 (spinner + elapsed + % + amuse cards) ──────────
// Contract analysis runs in two phases: splitting (~10–30 s) + parsing (~20–90 s
// depending on clause count). Rule 8 requires all four elements on every spinner.

const CONTRACT_AMUSE = [
  // r41 2026-06-20 (Tom Gilb verbatim correction of the earlier wrong
  // formulation) — refined per rule_value_definition_identity.md SUPREME
  // (2026-06-16) + Tom verbatim 2026-06-20:
  //   "The 2 unconditional, are A Defined Scale of Measure, and some future
  //    required state or states.  These can be the Scalar Constraint
  //    (Tolerable) and/or The Target levels (Wish, Goal, others).
  //    It is usually important to specify conditions (when, where, etc) but
  //    these can be implied elsewhere in the contract (and can be restated
  //    as Conditions and their Sources, inside the local Tagged Spec).
  //    Regarding the Meter! it is good and desirable practice, especially
  //    in a contract, to specify Meters.  They do not have to be specified
  //    initially; they do not determine the contract object's
  //    characteristics.  They can be part of a larger overall Testing and
  //    Measurement program, which applies to all requirements."
  // The earlier wording wrongly claimed Scale + Meter + Goal were ALL
  // unconditional.  Banked: Scale + at-least-one-future-required-state
  // (Tolerable and/or Wish/Goal/Stretch).  Meter is desirable, not initially
  // required.  Composes with Spell-out-Type-Names SUPREME (no `V.` / `F.`
  // / `C.` letter abbreviations in user-visible text).
  {
    emoji: '📋',
    title: 'OBLIGATIONS NEED A SCALE AND A FUTURE STATE',
    text: 'A contract clause that says "promptly" or "reasonable efforts" without a number is a dispute waiting to happen. Planguage unconditionally requires only two things: a defined Scale of Measure, AND at least one future required state — a Scalar Constraint (Tolerable) and/or a Target (Wish, Goal, Stretch). Conditions (when, where, who) are usually important but can be implied elsewhere in the contract. A Meter is good practice — especially in contracts — but does not have to be specified initially; it can live in an overall Testing and Measurement program covering all requirements.',
    ref: 'Tom Gilb, Competitive Engineering — refined formulation 2026-06-20',
  },
  {
    emoji: '⚖️',
    title: 'CONTRACTS ARE SPECIFICATIONS',
    text: 'Every contract clause is a Planguage spec entry. Functions state what is present or absent; Values define measurable performance; Constraints set hard limits. Contracts and system specs share the same formal structure.',
    ref: 'Planguage Glossary — Function, Value, Constraint',
  },
  {
    emoji: '🚢',
    title: 'USS MONITOR — 100-DAY DEADLINE',
    text: 'The 1861 Monitor contract set a 100-day delivery deadline with $300/day liquidated damages — a measurable, unambiguous Constraint. The ship was delivered in 101 days and fought at Hampton Roads 25 days later.',
    ref: 'US Navy Department, 4 October 1861',
  },
  {
    emoji: '🔴',
    title: '"REASONABLE" IS ALWAYS AMBIGUOUS',
    text: '"Reasonable care," "best efforts," "timely manner" — any clause containing these phrases scores as ambiguous. Planguage demands a numeric scale: response within 15 minutes, not "promptly."',
    ref: 'Planguage Rule_Write_planguage-spec.md',
  },
  {
    // r41 2026-06-20 — Spell-out-Type-Names SUPREME sweep: "V. entry"
    // replaced with "Value entry" (canonical full word, no dotted
    // abbreviation in user-visible text).
    emoji: '🏦',
    title: 'SERVICE CREDITS ARE PLANGUAGE VALUES',
    text: 'A well-written SLA credits 5% per breach, capped at 20%/month — a Value entry with Scale (credit %), Goal (0 breaches), and Tolerable (≤20% lost). Most SLAs omit the Goal and Tolerable, making the credit clause unenforceable. (Meter is desirable but not initially required — see "Obligations Need a Scale and a Future State".)',
    ref: 'Tom Gilb, SEM App Contracts module',
  },
  {
    // r41 2026-06-20 — Spell-out-Type-Names SUPREME sweep: dotted-prefix
    // abbreviations `K.` / `F.` / `V.` / `C.` replaced with the canonical
    // full words (Stakeholder / Function / Value / Constraint).
    emoji: '👥',
    title: 'PARTIES ARE STAKEHOLDERS',
    text: 'In Planguage, every party to a contract is a Stakeholder. Their obligations are Function entries; their performance targets are Value entries; the hard limits they cannot breach are Constraint entries. The obligation matrix IS the stakeholder-value matrix.',
    ref: 'Planguage Glossary — Stakeholder',
  },
  {
    emoji: '📐',
    title: 'FIVE AXES OF CONTRACT SUCCESS',
    text: 'A contract succeeds only when ALL five axes are met: Functions present, Values within range, Constraints respected, Conditions satisfied, Resource budgets not exceeded. One axis failing makes the whole delivery a deviation.',
    ref: 'Tom Gilb, SUCCESS book (DD-006)',
  },
  {
    emoji: '🔍',
    title: 'CLAUSE SPLITTING FINDS HIDDEN STRUCTURE',
    text: 'Long contract paragraphs typically contain 3–5 distinct obligations. Splitting by semantic boundary — not just by numbering — exposes each obligation as a separate entry for individual measurement and tracking.',
    ref: 'SEM App Contract Parser design',
  },
] as const

const contractElapsed           = ref(0)
const contractSimulatedProgress = ref(0)
const contractAmuseIdx          = ref(0)

// r41 2026-06-20 (Tom Gilb verbatim "spinning wheel zero % progress is
// constant" — Indianapolis 38-clause parse) — three fixes:
//
//   (1) Per-clause REAL progress.  The old `contractSimulatedProgress` was a
//       fake asymptotic curve based purely on elapsed time — gave zero signal
//       about which clause was actually being worked.  With 38 clauses
//       running sequentially through the LLM, real signal is what's needed.
//       `contractClausesDone` / `contractClausesTotal` + `contractRealProgress`
//       compute against the live `selectedContract.value.clauses` array,
//       counting `parseStatus === 'done' || 'error'` per clause.  Splitting
//       phase has no clause count yet, so it falls back to the simulated
//       curve.
//   (2) Abort-controller wired through `doImport` + `_parseAllClauses` so a
//       Cancel button can stop the loop between clauses.  The Anthropic SDK
//       call itself doesn't honour `signal`, but the LOOP does — after each
//       clause completes we check `_parseAbortController.signal.aborted` and
//       bail.  Worst-case wait: the currently-executing LLM call's duration
//       (~20-30s).  Far better than no-escape-at-all.
//   (3) Mount-time resume detection (lives below in `onMounted`) — if a
//       contract was mid-parse when the page reloaded, the parser loop died
//       but `parseStatus` stayed `parsing` → UI thinks it's working forever.
//       On mount we detect this and auto-resume the remaining pending
//       clauses.
//
// Composes with: Honest Loading Hint Copy SUPREME (real progress is more
// honest than fake), No-Silent-Data-Loss SUPREME (refresh-killed parser is
// silent loss of in-progress work), Universal Undo SUPREME (Cancel is
// reversible — re-import is one click), MOVE Principle (Cancel visible at-
// a-glance), Permission Tiers GREEN (cancel + resume both reversible).
const _parseAbortController = ref<AbortController | null>(null)
const contractClausesTotal  = computed(() => selectedContract.value?.clauses.length ?? 0)
const contractClausesDone   = computed(() =>
  selectedContract.value?.clauses.filter(cl => cl.parseStatus === 'done' || cl.parseStatus === 'error').length ?? 0
)

// r41 2026-06-20 (Tom Gilb verbatim "I suggest, to make this more interesting,
// that during the Phases, a Phase Activity Window is opened, and it displays
// in real time, the current text and improvements (like in new clause, or
// Planguage)") — live activity feed during parse.  Surfaces (a) the clauses
// currently being worked on (with raw clause text excerpts), and (b) the
// freshly-extracted Planguage entries.  Composes with: Conjunction-of-
// Technologies SUPREME (visibly shows the AI doing the F+L+I+G conjunction
// work), running-commentary-phase-narratives pending row 2026-06-16 (this
// is the contracts variant of that sweep), Honest Loading Hint Copy SUPREME
// (showing the real activity beats a fake animation), DD-009 Zero-Training
// UI (planner sees exactly what the system is doing without instruction),
// MOVE Principle (no menu-dive needed to see in-flight work), Spell-out-
// Type-Names SUPREME (entry type words spelled out below).

/** r41 2026-06-20 (Tom Gilb verbatim "show the clauses being found") — live
 *  clauses discovered during the Phase 1 streaming splitter.  Populated by
 *  the `onClauseFound` callback passed into `parser.splitIntoClauses(...)`.
 *  Cleared at the start of each new import.  The Phase Activity banner
 *  reads from this ref during the splitting phase. */
const liveSplittingClauses = ref<ContractClause[]>([])

/** Clauses currently being processed by the LLM (batch is 5 in parallel). */
const parsingClauses = computed(() =>
  selectedContract.value?.clauses.filter(cl => cl.parseStatus === 'parsing') ?? []
)

/** Most-recently-completed clauses (last 4 in array order, reversed for
 *  newest-first display).  With parallel batches of 5, the slice naturally
 *  picks up the last batch's outputs. */
const recentDoneClauses = computed(() => {
  const c = selectedContract.value
  if (!c) return []
  const done = c.clauses.filter(cl => cl.parseStatus === 'done' || cl.parseStatus === 'error')
  return done.slice(-4).reverse()
})

/** Spelled-out entry type word for in-app teaching copy.  Per Spell-out-
 *  Type-Names SUPREME — F./V./S./C./R. banned in user-visible text.
 *  r41 v433 — swept for v427 (S = Stakeholder in contracts) + v430 ('Sol'
 *  = Solution). */
function entryTypeWord(type: string): string {
  switch (type) {
    case 'F':    return 'Function'
    case 'V':    return 'Value'
    case 'C':    return 'Constraint'
    case 'R':    return 'Resource'
    case 'Sol':  return 'Solution'
    case 'S':    return 'Stakeholder'
    case 'Task': return 'Task'
    default:     return type
  }
}

/** Canonical Planguage type color (matches TYPE_COLOURS in
 *  useColorfulSpecHtml.ts + the in-app SpecOutput per-type cards).
 *  r41 v433 — swept for v427 (S = Stakeholder = blue) + v430 ('Sol' =
 *  Solution = orange). */
function entryTypeColor(type: string): string {
  switch (type) {
    case 'F':    return 'text-emerald-700'
    case 'V':    return 'text-violet-700'
    case 'C':    return 'text-red-700'
    case 'R':    return 'text-teal-700'
    case 'Sol':  return 'text-orange-700'
    case 'S':    return 'text-blue-700'
    case 'Task': return 'text-slate-700'
    default:     return 'text-slate-700'
  }
}
/**
 * r41 v424 (Tom Gilb 2026-07-01 verbatim *"after clause discovery, the
 * progress bar goes to zero.  I would like to add a count of the the clauses
 * as they are discovered, so we have a sense of progress"*).
 *
 * Previous behaviour was inconsistent between the two phases and REGRESSED
 * visibly at the Phase II → Phase III boundary:
 *   • Phase II splitting: bar showed `contractSimulatedProgress` (a smooth
 *     asymptotic curve capping around 95%).
 *   • Phase III parsing: bar switched to `clausesDone / clausesTotal`, which
 *     is 0 at the moment Phase III begins → **the bar snapped from ~90%
 *     back to 0%**.  This is the exact regression Tom observed.
 *
 * Fix: monotonic two-phase composition.  Phase II owns 0-40% of the bar's
 * span; Phase III owns 40-100%.  The bar never regresses; it climbs smoothly
 * across the full analysis.  Weighting rationale: extraction is roughly
 * 60% of user-time in a typical parse (5-in-parallel × 20 clauses × 20-60s
 * per clause ≈ 4-12 min; splitting streams in 30-60s).  40/60 approximates
 * the wall-clock reality without needing precise timing data.
 *
 * Composes with: Honest Loading Hint Copy SUPREME (progress reflects real
 * work), No-Silent-Data-Loss SUPREME (silent regression to 0% IS silent
 * data loss of orientation context), MOVE Principle SUPREME (visible
 * progress at-a-glance across every phase), Tom-Repeats-Himself SUPREME
 * (banked here so the class-bug of "progress bar regressed between phases"
 * cannot recur), Trace-Before-Patch SUPREME (root cause traced to the
 * `parseStatus`-branch that switched from simulated curve to real ratio
 * at the boundary — no smoothing between them).
 */
const contractRealProgress  = computed(() => {
  const c = selectedContract.value
  if (!c) return 0
  // Phase II Clause Discovery — owns 0-40% of the bar.  During splitting we
  // don't know the final clause count yet, so use the simulated curve but
  // SCALED into the 0-40% envelope so it never overshoots into Phase III
  // territory.  simulatedProgress ranges 0-95, so 0-95 → 0-40 via *0.42.
  if (c.parseStatus === 'splitting' || c.clauses.length === 0) {
    return Math.round(contractSimulatedProgress.value * 0.42)
  }
  // Phase III Obligation Extraction — starts at 40% (Phase II complete) and
  // climbs by clausesDone/clausesTotal into the 40-100% envelope.  A zero
  // clausesDone at the moment extraction begins gives the bar 40%, not 0% —
  // no more visible regression.
  const total = contractClausesTotal.value
  if (total <= 0) return 40
  const extractionFraction = contractClausesDone.value / total
  return Math.round(40 + extractionFraction * 60)
})

/** True while the selected contract is in splitting or parsing phase. */
const isContractAnalysing = computed(() =>
  selectedContract.value !== null &&
  (selectedContract.value.parseStatus === 'splitting' ||
   selectedContract.value.parseStatus === 'parsing')
)

// Post-loading amuse lifecycle — keeps the wisdom carousel visible for 10 s after
// analysis ends, showing a blinking "Click to Continue Amuse Me" button.
const {
  amuseActive:    contractAmuseActive,
  amuseFinishing: contractAmuseFinishing,
  amuseCountdown: contractAmuseCountdown,
  extendAmuse:    contractExtendAmuse,
} = useAmuseLifecycle(isContractAnalysing)

let _contractElapsedTimer: ReturnType<typeof setInterval> | null = null
let _contractAmuseTimer:   ReturnType<typeof setInterval> | null = null
let _contractAnimStart = 0

/**
 * r41 v434 (Tom Gilb 2026-07-02 verbatim *"the time counters are very wrong
 * after about 40 minutes they show 3 minutes etc"*) — resolve the parse-start
 * timestamp from the CONTRACT's persisted `parseStartedAt` field first
 * (survives Vite HMR reloads that would reset the module-scope
 * `_contractAnimStart` variable), falling back to the module-scope for
 * old contracts that pre-date v434.  Called on every timer tick so a fresh
 * HMR reload recovers the real start time from localStorage.
 */
function _resolveParseStartMs(): number {
  const iso = selectedContract.value?.parseStartedAt
  if (iso) {
    const t = Date.parse(iso)
    if (!Number.isNaN(t)) return t
  }
  return _contractAnimStart || Date.now()
}

function _startContractAnimation(): void {
  _contractAnimStart = Date.now()
  contractElapsed.value = 0
  contractSimulatedProgress.value = 0
  contractAmuseIdx.value = 0
  if (_contractElapsedTimer) { clearInterval(_contractElapsedTimer); _contractElapsedTimer = null }
  if (_contractAmuseTimer)   { clearInterval(_contractAmuseTimer);   _contractAmuseTimer   = null }

  _contractElapsedTimer = setInterval(() => {
    // r41 v434 — read persisted parseStartedAt first; HMR-safe.
    const startMs = _resolveParseStartMs()
    const secs = Math.round((Date.now() - startMs) / 1000)
    contractElapsed.value = secs
    // Asymptotic toward 95%: ~50% at 30 s, ~80% at 55 s, ~95% at 100 s.
    contractSimulatedProgress.value = Math.round(Math.min(95, (1 - Math.exp(-secs / 45)) * 100))
  }, 250)

  _contractAmuseTimer = setInterval(() => {
    contractAmuseIdx.value = (contractAmuseIdx.value + 1) % CONTRACT_AMUSE.length
  }, 10_000)  // Tom 2026-06-09: 10s card advance
}

function _stopContractAnimation(): void {
  if (_contractElapsedTimer) { clearInterval(_contractElapsedTimer); _contractElapsedTimer = null }
  if (_contractAmuseTimer)   { clearInterval(_contractAmuseTimer);   _contractAmuseTimer   = null }
  contractSimulatedProgress.value = 100
}

watch(isContractAnalysing, (nowLoading) => {
  if (nowLoading) _startContractAnimation()
  else _stopContractAnimation()
}, { immediate: true })  // r41 2026-06-20 — `immediate: true` so a refresh
// during phase 2 still starts the timer (without this, the watcher only
// fires on transitions, leaving elapsed/progress frozen at 0 after refresh).

onUnmounted(() => { _stopContractAnimation() })
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
        <!-- Back to landing.
             r41 v423 (Tom Gilb 2026-07-01 verbatim *"there is no way here to
             read in a new contract, and older constrats are difficult too, I
             need a reset and refresh or SOS"*) — icon-only "←" was Icon-Plus-
             Text SUPREME violation.  Now carries the "Your Contracts" text
             label so the escape route from a stuck detail-view is discoverable
             in under 1 second.  Sibling "+ New Contract" pin added at the
             end of this row so a fresh import is one click away from ANY
             detail view — no menu-dive, no dropdown-hunt.  Composes with
             MOVE Principle SUPREME (both affordances visible at-a-glance),
             Icon-Plus-Text SUPREME (glyph + label, no bare icons), DD-009
             Zero-Training UI, Tom-Repeats-Himself SUPREME (Tom hit "I need
             SOS" — the correct fix is proper affordances, not more escape
             hatches). -->
        <button
          v-if="selectedId"
          type="button"
          title="Return to the Your Contracts grid — pick a different contract or import a new one"
          aria-label="Back to contracts list"
          class="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-[11px] font-semibold transition-colors"
          @click="selectedId = null"
        >
          <span class="text-[13px] leading-none" aria-hidden="true">←</span>
          <span>Your Contracts</span>
        </button>

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

        <!-- r41 2026-06-20 (Tom Gilb verbatim "we need to Number the
             'Contract Phase's as well as name them, and make the phase title
             much bigger colorful") — numbered + much bigger phase banner.
             Was a 10 px white-on-translucent badge.  Now a 13 px (text-sm)
             banner with: a numbered circle on the left (vivid colour
             matching the phase tone), the phase title in semibold, and a
             pulsing dot when the phase is active.  Inactive / no-phase
             states fall back to the muted slate scheme so they don't
             scream when nothing is happening.  Composes with: Icon-Plus-
             Text SUPREME, MOVE Principle, DD-009 Zero-Training UI,
             accessibility_tom.md. -->
        <div
          v-if="selectedContract"
          class="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full ring-2 shadow-sm"
          :class="[currentParseStatusClasses.pillBg, currentParseStatusClasses.pillText, currentParseStatusClasses.pillRing]"
          :aria-label="currentParseStatusInfo.phase !== null
            ? `Contract analysis Phase ${currentParseStatusInfo.phase}: ${currentParseStatusInfo.label}`
            : currentParseStatusInfo.label"
          :title="currentParseStatusInfo.phase !== null
            ? `Contract analysis Phase ${currentParseStatusInfo.phase} — ${currentParseStatusInfo.label}`
            : currentParseStatusInfo.label"
        >
          <!-- Numbered chip (left) — phase number in a vivid colored circle.
               When there's no phase number (empty / raw / error / pending /
               done states), show a small dot instead so the layout doesn't
               shift. -->
          <span
            v-if="currentParseStatusInfo.phase !== null"
            class="inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-extrabold tabular-nums shrink-0"
            :class="[currentParseStatusClasses.numBg, currentParseStatusClasses.numText]"
            aria-hidden="true"
          >{{ currentParseStatusInfo.phase }}</span>
          <span
            v-else
            class="inline-block w-2 h-2 rounded-full shrink-0"
            :class="currentParseStatusClasses.dotBg"
            aria-hidden="true"
          />

          <!-- Phase title — much bigger + uppercase + bold for legibility -->
          <span class="text-[13px] font-bold tracking-wide leading-none">
            <template v-if="currentParseStatusInfo.phase !== null">
              <span class="opacity-70 mr-1">Phase {{ currentParseStatusInfo.phase }} ·</span>
            </template>
            <span>{{ currentParseStatusInfo.label }}</span>
          </span>

          <!-- Pulsing activity dot (right) when active -->
          <span
            v-if="currentParseStatusInfo.pulse"
            class="inline-block w-2 h-2 rounded-full animate-pulse shrink-0 ml-1"
            :class="currentParseStatusClasses.dotBg"
            aria-hidden="true"
          />
        </div>

        <!-- r41 v47 — Contracts Mode active-config chip (Tom Gilb 2026-06-16
             "MAKE A GREAT DESIGN IN SETTINGS AND CARRY IT OUT IN THE CONTRACT
             LOGIC").  Surfaces the active 4-axis config at a glance so the
             user knows what the LLM is doing.  Click → opens Settings on the
             Contracts Mode section. -->
        <button
          type="button"
          class="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-300/90 text-amber-950 hover:bg-amber-200 ring-1 ring-amber-200/70"
          :title="`Contracts Mode (⌘, to edit):\n• Sharpening: ${_contractsModeConfig.applyContractSharpening ? 'ON' : 'off'}\n• Standards: ${_contractsModeConfig.standards.length} built-in + ${_contractsModeConfig.standardsCustomUrls.filter(u => u.trim()).length} custom URLs\n• Presentation: ${_contractsModeConfig.presentation}\n• Purpose: ${_contractsModeConfig.purposes.join(', ') || '(none — defaults to strict-analytical)'}`"
          @click="emit('open-settings', 'contractsMode')"
        >
          ⚙ Mode · {{ _contractsModeConfig.presentation }} · {{ _contractsModeConfig.purposes.length }} purpose{{ _contractsModeConfig.purposes.length === 1 ? '' : 's' }}
        </button>

        <!-- + New Contract pin (r41 v423 — Tom Gilb 2026-07-01 verbatim *"there
             is no way here to read in a new contract, and older constrats are
             difficult too, I need a reset and refresh or SOS"*).  Visible in
             BOTH the detail view AND the landing grid so a fresh import is
             always one click away.  Complements the "Your Contracts" back
             button on the left (grid access) with an even-shorter path to a
             brand-new contract — no need to go back to the grid first.
             Composes with MOVE Principle SUPREME (visible without menu-dive),
             Icon-Plus-Text SUPREME (glyph + label), DD-009 Zero-Training UI. -->
        <button
          type="button"
          class="ml-auto shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-amber-300/90 hover:bg-amber-200 text-amber-950 text-[11px] font-bold ring-1 ring-amber-200/70 transition-colors"
          title="Import a new contract — paste text to convert to Planguage; opens the import dialog"
          aria-label="Import a new contract"
          @click="openImport"
        >
          <span class="text-[13px] leading-none" aria-hidden="true">＋</span>
          <span>New Contract</span>
        </button>

        <!-- CloseDot — size="lg" (32px) so ExitGlyph [-> is visible past the mouse cursor -->
        <div class="shrink-0">
          <CloseDot
            variant="on-dark"
            size="lg"
            title="Close Contracts — return to main workspace"
            ariaLabel="Close Contracts mode"
            @click="emit('close')"
          />
        </div>
      </div>

      <!-- Contract identity band (r41 v392 — Tom Gilb 2026-07-01 verbatim
           *"ref 'unnamed plan'. We are in contracts agent mode so the correct
           term is Contact Name. I expect you to derive the name (as with the
           same contract in other modes)"*) — teal-toned for Contracts.  Two
           corrections vs r41 v96: (a) `entity-label="Contract"` retitles the
           small-caps label + fallback + Switch pin to the correct term for
           Contracts mode; (b) `plan-name` is now sourced from the SELECTED
           CONTRACT's auto-derived title (via `_extractTitle` on import) — so
           the band shows "CONTRACT FOR THE CONSTRUCTION OF INDIANAPOLIS"
           instead of the empty parent-passed Plan name.  Composes with
           No-Silent-Removal SUPREME (identity band still present, just
           correctly labelled), Spell-out-Type-Names SUPREME (plain English),
           DD-009 Zero-Training UI (no jargon), MOVE Principle (name visible
           without menu-dive), Twin portability (mode-aware label ports). -->
      <!-- r41 v429 (Tom Gilb 2026-07-01 verbatim *"j bullock is not the owner
           if this contract"*) — the OWNER value used to inherit from the SEM
           Plan (via `props.planOwner`), which surfaced whoever owned the SEM
           Plan (J Bullock, from an earlier Indianapolis session) as the owner
           of EVERY contract, including brand-new Employment Contract, IT
           Monitoring, etc.  Contracts have their OWN parties — the SEM Plan
           owner is not the contract owner.  Fix: derive the OWNER value from
           the contract's own `parties` list (each party's abbreviation +
           name joined).  Falls back to the SEM Plan owner ONLY when the
           contract has no parties recorded (rare — most imports pick up at
           least one party name from the preamble).  Composes with No-Silent-
           Data-Loss SUPREME (never silently show the WRONG owner), Trace-
           Before-Patch SUPREME (root-caused via reading the prop chain
           back to `_specOwnerNames()` in App.vue), Universal accessibility
           (user should never see incorrect identity chrome). -->
      <PlanIdentityBand
        entity-label="Contract"
        :plan-name="selectedContract?.title || props.planName"
        :plan-owner="contractOwnerLabel"
        :plan-version="props.planVersion"
        :generated-at="props.generatedAt"
        :hide-name="true"
        :theme="{ bg: 'bg-teal-700', borderTop: 'border-teal-500', label: 'text-teal-100', pickerBorder: 'border-teal-300' }"
        @select-history="(id: string) => emit('select-history', id)"
      />

      <!-- r41 2026-06-20 (Tom Gilb verbatim "we need to display exactly which
           library is being used, at the moment in our screen, and have a
           switch guidelines, and add guidelines options right there") —
           Active Guidelines bar.  Sits between the Plan Identity band and
           the Tab bar so it's visible regardless of which tab the planner
           is on.  Composes with: MOVE Principle (active set + inline
           Switch + Add visible at-a-glance, no menu-dive), Sources-of-
           Specs SUPREME (the planner SEES which rule set is driving the
           AI), Conjunction-of-Technologies SUPREME, Icon-Plus-Text SUPREME
           (every chip + button has glyph + text). -->
      <div
        v-if="selectedContract"
        class="shrink-0 flex items-center gap-2 px-4 py-2 bg-rose-50/60 border-b border-rose-100 flex-wrap"
      >
        <!-- r41 v403 (Tom Gilb 2026-07-01 verbatim "There needs tobe a Set
             Contract Guidelines button next to the upper left display of
             current settings") + r41 v405 (Tom Gilb 2026-07-01 verbatim "there
             are at least 3 old style emojos or icons") — the "ACTIVE
             GUIDELINES" label + the pinned-guideline chips ARE the display of
             current settings; the button to CHANGE those settings was
             previously only on the right of the bar.  Now the label is itself
             a clickable button, AND a compact "Set Contract Guidelines" pin
             sits next to it — one-click access right where the settings are
             displayed.  Emoji `🎯` (bullseye) and `📚` (books) REMOVED per
             Planguage-Glyph-First SUPREME + No-Generic-Icon-Libraries SUPREME.
             Text-only label is valid per Icon-Plus-Text SUPREME (the rule
             requires text + glyph WHEN a glyph is present; text-only is fine).
             Composes with MOVE Principle SUPREME + DD-009 Zero-Training UI +
             Tom-Repeats-Himself SUPREME (banked "Set Contract Guidelines"
             verbatim + banked the emoji ban in the same design-history row). -->
        <button
          type="button"
          class="shrink-0 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-rose-800 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-300 rounded"
          title="Set Contract Guidelines — the highlighted chips beside this label are the Guidelines currently driving this contract's AI analysis.  Click to open the Library and change them."
          @click="guidelineLibraryOpen = true"
        >
          <span>Active Guidelines</span>
        </button>
        <button
          type="button"
          class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 transition-colors"
          title="Set Contract Guidelines — open the full Guidelines Library so you can pin, unpin, reject/reactivate, or edit the Rules that drive this contract's AI analysis"
          @click="guidelineLibraryOpen = true"
        >
          <span>Set Contract Guidelines</span>
        </button>
        <template v-if="activeGuidelines.length > 0">
          <span
            v-for="ag in activeGuidelines"
            :key="ag.guideline.id"
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-white border border-rose-300 text-rose-800"
            :title="`${ag.guideline.tag}.v${ag.pin.version} — ${ag.guideline.title || ag.guideline.tag} · pinned ${new Date(ag.pin.pinnedAt).toISOString().slice(0,10)} · ${ag.guideline.rules.filter(r => r.status === 'active').length} active Rules · Source: ${ag.guideline.source}`"
          >
            <span class="font-mono">{{ ag.guideline.tag }}.v{{ ag.pin.version }}</span>
            <span class="text-rose-500 opacity-60">·</span>
            <span class="text-[10px] text-rose-600">{{ ag.guideline.rules.filter(r => r.status === 'active').length }} rules</span>
          </span>
        </template>
        <span v-else class="text-[11px] text-slate-500 italic">
          No Guidelines pinned to this contract — AI rewrites use the Contracts Mode <strong>Standards</strong> axis only
        </span>
        <div class="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 transition-colors"
            title="↻ Switch Guidelines — open the Library to pick a different set for this contract"
            @click="guidelineLibraryOpen = true"
          >
            <span aria-hidden="true">↻</span>
            <span>Switch</span>
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-500 transition-colors"
            title="+ Add Guidelines — open the Library to pin additional Guidelines to this contract"
            @click="guidelineLibraryOpen = true"
          >
            <span aria-hidden="true">+</span>
            <span>Add</span>
          </button>
          <!-- r41 v401 (Tom Gilb 2026-07-01 verbatim "Manage button does not
               work, and is too ambiguous maybe, Set Contract Guidelines") —
               the "does not work" symptom was fixed in v400 (GuidelineLibrary
               Panel z-index bumped above ContractHub z-[600]).  This turn
               replaces the ambiguous "Manage" label with Tom's exact wording
               "Set Contract Guidelines".  Composes with Spell-out-Type-Names
               SUPREME analogue (full plain-English label, no jargon like
               "Manage"), DD-009 Zero-Training UI (the label names exactly
               what pressing the button does — SET the Guidelines for this
               contract), Icon-Plus-Text SUPREME (📚 glyph + spelled-out
               verb-plus-noun), Tom-Repeats-Himself SUPREME (banked Tom's
               exact wording verbatim). -->
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Set Contract Guidelines — open the full Guidelines Library so you can pin, unpin, reject/reactivate, or edit the Rules that drive this contract's AI analysis"
            @click="guidelineLibraryOpen = true"
          >
            <span>Set Contract Guidelines</span>
          </button>
        </div>
      </div>

      <!-- ── Tab bar (detail view only) ────────────────────────────────────── -->
      <!-- Each tab has a distinctive identity color (TAB_COLORS). Active = that color as bg + white text.
           Inactive = that color as text + glyph. Planguage SVG glyphs, no emoji. -->
      <div v-if="selectedContract" class="shrink-0 flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200">
        <button
          v-for="tab in (['clauses', 'entries', 'matrix', 'rewrites', 'export'] as const)"
          :key="tab"
          type="button"
          :title="tab === 'clauses'  ? 'Clauses — browse each contract clause and its extracted Planguage obligations'
                : tab === 'entries'  ? 'Entries — all Planguage obligations across the contract, filterable by type'
                : tab === 'matrix'   ? 'Matrix — Gilb party × obligation-type grid showing who owes what'
                : tab === 'rewrites' ? 'Rewrites — review AI-proposed clause rewrites side-by-side with the original; tick to accept (Phase 3A — read-only review; Save as new version comes in Phase 3C)'
                :                     'Export — copy or email the colorful HTML table'"
          class="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
          :class="activeTab === tab ? 'shadow-sm' : 'hover:bg-slate-100'"
          :style="activeTab === tab
            ? { background: TAB_COLORS[tab], color: 'white' }
            : { color: TAB_COLORS[tab] }"
          @click="activeTab = tab"
        >
          <span class="inline-flex items-center gap-1.5">

            <!-- ── Clauses: bracketed text lines — §-concept (structured legal source text) ── -->
            <template v-if="tab === 'clauses'">
              <svg viewBox="0 0 18 18" width="16" height="16" fill="none"
                   :stroke="activeTab === tab ? 'white' : TAB_COLORS[tab]"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 2 L3 2 L3 16 L5 16"/>
                <line x1="7" y1="5"  x2="16" y2="5"/>
                <line x1="7" y1="9"  x2="13" y2="9"/>
                <line x1="7" y1="13" x2="15" y2="13"/>
              </svg>
              Clauses
            </template>

            <!-- ── Entries: circle-badge + line rows — typed obligation roster ── -->
            <template v-else-if="tab === 'entries'">
              <svg viewBox="0 0 18 18" width="16" height="16" fill="none"
                   :stroke="activeTab === tab ? 'white' : TAB_COLORS[tab]"
                   stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
                <circle cx="3.5" cy="4"  r="2"/>
                <line x1="7.5" y1="4"  x2="17" y2="4"/>
                <circle cx="3.5" cy="10" r="2"/>
                <line x1="7.5" y1="10" x2="15" y2="10"/>
                <circle cx="3.5" cy="16" r="2"/>
                <line x1="7.5" y1="16" x2="16" y2="16"/>
              </svg>
              Entries
            </template>

            <!-- ── Matrix: party × obligation grid — the Gilb obligation matrix ── -->
            <template v-else-if="tab === 'matrix'">
              <svg viewBox="0 0 18 18" width="16" height="16" fill="none"
                   :stroke="activeTab === tab ? 'white' : TAB_COLORS[tab]"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="1" y="1" width="16" height="16" rx="1.5"/>
                <line x1="6"  y1="1"  x2="6"  y2="17"/>
                <line x1="12" y1="1"  x2="12" y2="17"/>
                <line x1="1"  y1="6"  x2="17" y2="6"/>
                <!-- Party/header cell highlighted -->
                <rect x="1.5" y="1.5" width="4" height="4" stroke="none"
                      :fill="activeTab === tab ? 'white' : TAB_COLORS[tab]" fill-opacity="0.28"/>
              </svg>
              Matrix
            </template>

            <!-- ── Rewrites: keyed icon [*]→[**] — original brackets transform
                 into doubled brackets (the "improved spec" canonical shape).
                 Phase 3A — Tom Gilb 2026-06-20 greenlight. -->
            <template v-else-if="tab === 'rewrites'">
              <svg viewBox="0 0 18 18" width="16" height="16" fill="none"
                   :stroke="activeTab === tab ? 'white' : TAB_COLORS[tab]"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <!-- left bracket [*] -->
                <path d="M2 4 L1 4 L1 14 L2 14"/>
                <circle cx="3.2" cy="9" r="0.9" fill="currentColor" stroke="none"/>
                <path d="M5 4 L6 4 L6 14 L5 14"/>
                <!-- arrow -->
                <line x1="7.5" y1="9" x2="10.5" y2="9"/>
                <polyline points="9.5 7.5 10.7 9 9.5 10.5"/>
                <!-- right bracket [**] -->
                <path d="M12 4 L11 4 L11 14 L12 14"/>
                <circle cx="13.2" cy="7.5" r="0.8" fill="currentColor" stroke="none"/>
                <circle cx="13.2" cy="10.5" r="0.8" fill="currentColor" stroke="none"/>
                <path d="M15 4 L16 4 L16 14 L15 14"/>
              </svg>
              Rewrites
            </template>

            <!-- ── Export: delivery arrow into tray — Evo "deliver" concept ── -->
            <template v-else>
              <svg viewBox="0 0 18 18" width="16" height="16" fill="none"
                   :stroke="activeTab === tab ? 'white' : TAB_COLORS[tab]"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 13 L2 17 L16 17 L16 13"/>
                <line x1="9" y1="2" x2="9" y2="11"/>
                <polyline points="6 8.5  9 11.5  12 8.5"/>
              </svg>
              Export
            </template>

          </span>
        </button>

        <!-- ── Copy + Mail action buttons — SVG icons, no emoji ── -->
        <div class="ml-auto flex items-center gap-2 pl-3 border-l border-slate-200">
          <span class="text-[11px] text-slate-400 tabular-nums">
            {{ store.allEntries.value.length }} entries · {{ selectedContract.clauses.length }} clauses
          </span>

          <!-- r41 2026-06-20 (Tom Gilb verbatim "Reparse button at top of
               stakeholders, says reparse this clause, but there is no other
               for all other clauses: Bug?") — contract-level Re-parse All
               button.  Sits next to Copy + Mail so the planner finds it
               where they expect contract-wide actions.  Two-stage: first
               click ARMS (rose-bordered, label "Click again to confirm"),
               second click executes.  Auto-disarms after 4 s.  Disabled
               while a parse is in flight (the Cancel button is the right
               affordance then).  Honours all the SUPREMEs the per-clause
               Re-parse honours: Universal Undo (Resume-from-history /
               re-import are the reversible paths if you change your mind),
               MOVE Principle (contract-wide affordance visible at-a-glance,
               no menu-dive), No-Silent-Data-Loss (the original raw clause
               text is NEVER touched — only the LLM-derived entries get
               replaced; re-parse reproduces them from the same raw text). -->
          <!-- r41 2026-06-20 (Tom Gilb verbatim "we need to specify exactly
               which Reparse guidelines can be used, and give choice to
               select a different set of guidelines") — Re-parse All button
               now opens a Guidelines picker instead of two-stage arm/confirm.
               The picker IS the confirmation step + the choice step. -->
          <button
            type="button"
            :disabled="isContractAnalysing"
            :title="isContractAnalysing
              ? '🔄 Re-parse All — disabled while a parse is in flight (use Cancel Import to abort the current run first)'
              : `🔄 Re-parse All Clauses — opens a Guidelines picker so you can confirm or change which rule set drives the re-parse.  Current pinned: [${activeGuidelines.map(ag => ag.guideline.tag + '.v' + ag.pin.version).join(', ') || '(none)'}].  After confirm: parallel batches of 5 across all ${selectedContract.clauses.length} clauses (~${Math.max(1, Math.ceil(selectedContract.clauses.length / 5) * 30 / 60)} min).  AI model: claude-sonnet-4-6.  Contracts Mode: presentation = ${_contractsModeConfig.presentation}.  Output: replaces all existing entries.  Raw clause text + original contract are kept.`"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ring-1"
            :class="isContractAnalysing
              ? 'bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed'
              : 'bg-white text-amber-700 ring-amber-300 hover:bg-amber-50 hover:ring-amber-500'"
            @click="openReparsePicker({ kind: 'all' })"
          >
            <span aria-hidden="true">🔄</span>
            <span>{{ isContractAnalysing ? 'Parsing…' : 'Re-parse All…' }}</span>
          </button>

          <!-- r41 v437 (Tom Gilb 2026-07-02 verbatim *"An option to get the
               entire document redrafted... Navy meeting delayed. But I like
               the proposal and want to get started now. So go for it. As
               much as you can as soon as you can."*) — Contract Redraft
               button.  MVP: opens the Contract Redraft Settings dialog
               where the planner picks Standards + Policies + Structure +
               Safety Locks + Autonomy + CHI Weights.  v438 will wire the
               actual redraft call.  Sits next to Re-parse All so contract-
               wide operations cluster together.  Composes with MOVE
               Principle SUPREME (contract-wide affordance visible at-a-
               glance), Icon-Plus-Text SUPREME (glyph + label), DD-009 Zero-
               Training UI (HoverHint spells out what opens). -->
          <button
            type="button"
            title="⟲ Contract Redraft… — opens the Redraft Settings dialog.  Choose which Standards + Policies + Structure to apply.  Runs Sonnet clause-by-clause and assembles a redlined body + A1-A6 appendices + Contract Health Score."
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ring-1 bg-white text-indigo-700 ring-indigo-300 hover:bg-indigo-50 hover:ring-indigo-500"
            @click="showRedraftSettings = true"
          >
            <span aria-hidden="true" class="font-mono">⟲</span>
            <span>Contract Redraft…</span>
          </button>

          <!-- r41 v440 (Tom Gilb 2026-07-02 verbatim *"can you send the
               indianapolis output in planguage to my download. I am afraid
               of losing it and it took hours, and is my only one"*) —
               Download Full Backup pin.  Dumps the CURRENTLY-SELECTED
               contract (raw text + all clauses + all extracted Planguage
               entries + parse metadata + timestamps) as a single JSON
               file to ~/Downloads/.  Timestamped filename so multiple
               backups don't collide.  Zero-touch: click, file downloads.
               Composes with No-Silent-Data-Loss SUPREME (safety-net for
               work that took hours), Icon-Plus-Text SUPREME (glyph + label),
               MOVE Principle (backup visible at-a-glance, no menu-dive),
               DD-009 Zero-Training UI (HoverHint spells everything out).
               Also does a whole-store dump variant (Cmd/Ctrl + click) so
               all Tom's contracts get backed up in one file. -->
          <!-- r41 v456 (Tom Gilb 2026-07-02 verbatim *"Tom is not the
               interface here. It is some Navy offiser doing contracts!"*)
               — my v455 label "Backup this Planguage-Format Contract"
               replaced JSON jargon with Planguage jargon; SAME category
               error.  Contracts audience is a Navy officer / contracts
               professional, NOT a Planguage methodologist.  Correct
               label is plain business English.  Composes with the same
               plain-English rule shape as tooltip / src / provenance /
               toast / complaint / JSON. -->
          <button
            type="button"
            :title="`⬇ Save a Backup of &quot;${selectedContract.title}&quot; — captures every clause (${selectedContract.clauses.length}) + every entry (${store.allEntries.value.length}) + audit data + timestamps to ~/Downloads/ as a single file you can bring back later via Import.  Hold ⌘ (or Ctrl) while clicking to back up ALL your contracts in one file.`"
            aria-label="Backup this Contract"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ring-1 bg-white text-slate-700 ring-slate-300 hover:bg-slate-50 hover:ring-slate-500"
            @click="downloadContractBackup($event)"
          >
            <span aria-hidden="true">⬇</span>
            <span>Backup this Contract</span>
          </button>

          <!-- r41 v403 (Tom Gilb 2026-07-01) — Save to My Test Contracts pin.
               Tom's exact wording preserved verbatim.  Idempotent — safe on
               double-click.  Does NOT require the parse to be finished
               (HoverHint spells that out to head off Tom's hypothesis
               "maybe because we never finish it").  Composes with MOVE
               Principle + Icon-Plus-Text SUPREME + DD-009 Zero-Training UI
               + No-Silent-Data-Loss + Universal Undo. -->
          <!-- r41 v405 — 💾 (floppy disk) replaced with the canonical Planguage
               SaveGlyph (`*→[*]`, DD-001) per Planguage-Glyph-First SUPREME.
               The Saved-flash state uses ✓ (universal punctuation, DD-015
               International Icons exemption — not an English-letter code, not
               an office-artefact emoji). -->
          <button
            type="button"
            :disabled="!selectedContract.rawImportText"
            :title="!selectedContract.rawImportText
              ? 'Save to My Test Contracts — disabled: this contract has no raw text to save (only the parsed entries exist).'
              : savedToLibraryFlash
                ? 'Saved to My Test Contracts — appears in the “Sample contracts” list on the Contracts landing page.  Click Save again anytime.'
                : `Save to My Test Contracts — copies the raw contract text (${selectedContract.rawImportText.length} chars) + title into your test-contract library so you can re-run analysis anytime with a different Contracts Mode or set of Guidelines.  Does NOT require the current parse to be finished.  Idempotent — a second click of the SAME contract does nothing (no duplicates).`"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ring-1"
            :class="!selectedContract.rawImportText
              ? 'bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed'
              : savedToLibraryFlash
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-300'
                : 'bg-white text-teal-700 ring-teal-300 hover:bg-teal-50 hover:ring-teal-500'"
            @click="saveContractToLibrary()"
          >
            <template v-if="savedToLibraryFlash">
              <span aria-hidden="true">✓</span>
              <span>Saved!</span>
            </template>
            <template v-else>
              <SaveGlyph size="compact" aria-label="Save — asterisk into vessel" />
              <span>Save to My Test Contracts</span>
            </template>
          </button>

          <!-- Copy: Planguage CopyGlyph [*]=[*] — standard size, teal family -->
          <button
            type="button"
            title="Copy [*]=[*] — duplicate contract obligations as color-coded HTML table to clipboard · paste into Keynote, Numbers, or Mail"
            class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ring-1"
            :class="copiedExport
              ? 'bg-emerald-50 text-emerald-600 ring-emerald-300'
              : 'bg-white text-teal-600 ring-teal-200 hover:bg-teal-50 hover:text-teal-700 hover:ring-teal-400'"
            @click="copyExport"
          >
            <CopyGlyph size="standard" aria-label="Copy — duplicate vessel contents" />
            <span v-if="copiedExport" class="text-[10px] font-bold">✓</span>
          </button>

          <!-- Mail: Planguage EmailGlyph [*]---→[*] — standard size, blue family -->
          <button
            type="button"
            title="Email [*]---→[*] — transmit contract obligations across the network · downloads .eml that opens in Mail.app as a pre-filled draft"
            class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ring-1"
            :class="emailedExport
              ? 'bg-emerald-50 text-emerald-600 ring-emerald-300'
              : 'bg-white text-blue-600 ring-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-400'"
            @click="emailExport"
          >
            <EmailGlyph size="standard" aria-label="Email — digital transmission to destination vessel" />
            <span v-if="emailedExport" class="text-[10px] font-bold">✓</span>
          </button>
        </div>
      </div>

      <!-- ── Color Glyph type filter strip ─────────────────────────────────── -->
      <!-- Large glyph tiles with keyword labels. Single-click filters entries.
           Double-click on any glyph opens GlyphDataPanel — PlTypeIcon DD-013.
           PlTypeIcon automatically appends "· Double-click for Glyph Detail"
           to every HoverHint title (no noDetailClick prop → DD-013 compliant). -->
      <div
        v-if="selectedContract"
        class="shrink-0 flex items-end justify-center gap-6 px-6 py-3 bg-slate-50/80 border-b border-slate-100 select-none"
      >
        <!-- "All types" tile — r41 v406 (Tom Gilb 2026-07-01 verbatim "If
             Planguage clauses are developped, then I would like to see the
             number of each type in real time just under or with the icon,
             as in previous Stage 1 display") — total count now surfaces
             under the icon in bold tabular-num, so the total updates in
             real time while the parser runs.  Composes with Conjunction-of-
             Technologies SUPREME (visibly dramatises AI progress) + MOVE
             Principle (count visible right next to the filter it counts). -->
        <div class="flex flex-col items-center gap-1.5">
          <button
            type="button"
            title="Show all entry types — remove active type filter · Single-click to reset"
            class="w-14 h-14 rounded-xl ring-1 transition-all flex items-center justify-center text-sm font-extrabold"
            :class="entryFilter === 'all'
              ? 'bg-slate-700 text-white ring-slate-700 shadow-md'
              : 'bg-white text-slate-400 ring-slate-200 hover:bg-slate-100 hover:text-slate-600'"
            @click="entryFilter = 'all'"
          >All</button>
          <span class="text-sm font-extrabold text-slate-700 tabular-nums leading-none">{{ store.allEntries.value.length }}</span>
          <span class="text-[10px] font-semibold text-slate-400">All Types</span>
        </div>

        <!-- Thin divider -->
        <div class="w-px h-12 bg-slate-200 self-center shrink-0" aria-hidden="true" />

        <!-- 6 Color Glyph filter tiles — one per ContractEntryType -->
        <!-- DD-013 fix (2026-07-05): data-pl-type + title live on the OUTER BUTTON
             so the WHOLE tile hit-area (padding + glyph pixels) is discoverable to
             Layer A capture-phase dblclick handler in App.vue. PlTypeIcon is set to
             :no-detail-click="true" so it neither dispatches nor duplicates the
             HoverHint suffix. Single-click toggles the entry filter. Double-click
             ANYWHERE on the button opens Glyph Detail — Layer A finds the
             button via closest('[data-pl-type]') and calls openGlyphPanel(). -->
        <template v-for="ct in CONTRACT_FILTER_GLYPHS" :key="ct.contractType">
          <div class="flex flex-col items-center gap-1.5">
            <button
              type="button"
              class="p-1.5 rounded-xl transition-all ring-1 shrink-0"
              :class="entryFilter === ct.contractType
                ? 'shadow-lg ring-transparent'
                : 'ring-transparent hover:bg-white hover:ring-slate-200 hover:shadow-md'"
              :style="entryFilter === ct.contractType
                ? { backgroundColor: ct.hex + '18', boxShadow: `0 0 0 2.5px ${ct.hex}80` }
                : {}"
              :aria-pressed="String(entryFilter === ct.contractType)"
              :data-pl-type="ct.glyphType"
              :title="`${_entryTypeFullByCount(ct.contractType, store.entryCounts.value[ct.contractType] ?? 0)} — ${store.entryCounts.value[ct.contractType] ?? 0} extracted so far · Single-click to filter · Double-click for Glyph Detail`"
              @click="entryFilter = (entryFilter === ct.contractType ? 'all' : ct.contractType)"
            >
              <PlTypeIcon
                :pl-type="ct.glyphType"
                size="xl"
                :no-detail-click="true"
              />
            </button>
            <!-- r41 v406 (Tom Gilb 2026-07-01 verbatim "If Planguage clauses
                 are developped, then I would like to see the number of each
                 type in real time just under or with the icon, as in previous
                 Stage 1 display") — per-type count below the icon, in the
                 type's canonical Planguage colour so it reads at a glance.
                 Composes with Conjunction-of-Technologies SUPREME (visibly
                 dramatises the AI's per-type extraction progress), MOVE
                 Principle (count next to the filter it counts), Pluralisation
                 Rule (singular vs plural via `_entryTypeFullByCount`),
                 Spell-out-Type-Names SUPREME (banned "F./V./S./C./R."
                 removed from the HoverHint too). -->
            <span
              class="text-sm font-extrabold tabular-nums leading-none"
              :style="{ color: ct.hex }"
            >{{ store.entryCounts.value[ct.contractType] ?? 0 }}</span>
            <span
              class="text-[10px] font-bold leading-tight text-center"
              :style="{ color: ct.hex }"
            >{{ ct.keyword }}</span>
          </div>
        </template>

        <!-- Active filter indicator — shown when a specific type is selected -->
        <span
          v-if="entryFilter !== 'all'"
          class="text-[9px] font-semibold text-slate-500 self-center italic ml-1"
        >
          {{ CONTRACT_ENTRY_FULL[entryFilter as ContractEntryType] }}<br>
          <span class="not-italic font-bold text-slate-600">{{ store.entryCounts.value[entryFilter as ContractEntryType] ?? 0 }} shown</span>
        </span>
      </div>

      <!-- r41 v448 (Tom Gilb 2026-07-02 verbatim *"why are all the planguage
           specs 0, they should be filled with the chosen contract"*) —
           when the current contract HAS clauses but ZERO Planguage entries
           across all clauses, the counter strip is honest (per r93mmm
           Infinity Trap: unmeasurable is never silently promoted to
           anything else) but confusing.  This diagnostic hint names WHY
           the counts are zero + points at the fix.  Two variants:
             (a) parse never populated  → "Re-parse All to extract"
             (b) redraft is in flight   → "or wait for redraft to finish
                 (redraft does NOT populate entries — Re-parse does)".
           The redraft pipeline emits corrections + defects but does NOT
           extract Planguage entries into clause.entries — that's the
           Parse agent's job.  Composes with No-Silent-Data-Loss SUPREME
           (name why the number is zero), DD-009 Zero-Training UI (plain
           English "why + what to do"), MOVE Principle (fix action
           surfaced right next to the affected count), Trust-Rebuild
           framing (honest diagnosis beats mysterious zero). -->
      <div
        v-if="selectedContract && selectedContract.clauses.length > 0 && store.allEntries.value.length === 0"
        class="shrink-0 mx-6 -mt-1 mb-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2"
      >
        <span aria-hidden="true" class="shrink-0">⚠</span>
        <span class="flex-1">
          <strong>No Planguage entries extracted yet</strong> — this contract has {{ selectedContract.clauses.length }} clauses on disk but {{ 0 }} entries. The <strong>Re-parse All</strong> button on the tab bar runs the Parse agent that extracts Function / Value / Constraint / Resource / Solution / Stakeholder / Task entries from clause text. <span v-if="isRedraftRunning" class="italic">Contract Redraft is in flight but does NOT populate entries — only Parse does.</span>
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
          <!-- Top row: heading + Import Backup button + New Contract button -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-xl font-bold text-slate-800">Your Contracts</h1>
              <p class="text-sm text-slate-500 mt-0.5">Import any contract and convert it to clear, measurable Planguage</p>
            </div>
            <div class="flex items-center gap-2">
              <!-- r41 v452 (Tom Gilb 2026-07-02 verbatim *"Please include a
                   possibility of bringing in a file from my mac, now and I
                   can retrieve and run it"*) — Import Backup JSON.
                   Reads a v440 backup file (single-contract OR all-contracts
                   shape) from disk and re-inserts the contract(s) into the
                   store.  Enables recovery from localStorage loss — Tom
                   already has backups in ~/Downloads from the v440 Backup
                   JSON button.  Composes with:
                   • No-Silent-Data-Loss SUPREME (import never silently
                     overwrites; id-collision → fresh id + " (imported ...)"
                     title suffix so both survive)
                   • Universal Undo SUPREME (import is a recordable action;
                     covered by store's reactive updates)
                   • MOVE Principle SUPREME (button next to New Contract, no
                     menu-dive)
                   • Trust-Rebuild framing (Tom's ONLY recovery path today
                     is the disk backup — this makes it a one-click flow) -->
              <input
                ref="importBackupFileInput"
                type="file"
                accept=".json,application/json"
                class="hidden"
                @change="onImportBackupFileChange"
              />
              <!-- r41 v456 — plain business English.  Contracts audience
                   is a Navy officer / contracts professional; no
                   Planguage jargon in user-facing labels. -->
              <button
                type="button"
                title="⬆ Import a Contract Backup file from your Mac (produced by the Backup button, either single-contract or all-contracts).  Never overwrites existing work: if an id collides, the imported copy gets a fresh id and its title gets a &quot; (imported YYYY-MM-DD HH:MM)&quot; suffix so BOTH survive."
                aria-label="Import Contract Backup"
                class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all text-sm"
                @click="triggerImportBackup"
              >
                <span aria-hidden="true">⬆</span> Import Contract Backup
              </button>
              <!-- r41 v453 (Tom Gilb 2026-07-02 verbatim *"i cannot find
                   redraft settings, maybe because I cannot select a valid
                   file? and did we not agree there is no point in making
                   zero files available at all?"*) — Dump raw localStorage
                   diagnostic pin ALWAYS accessible on the landing page.
                   Previously buried inside the Redraft Settings dialog
                   (v443), unreachable when Tom needs it MOST (no valid
                   contract to open Settings from).  Composes with Do-Not-
                   Outsource-Investigation SUPREME (one click gets Tom the
                   file he can send to Claudian without Safari DevTools). -->
              <!-- r41 v455 — "localStorage" is browser jargon.  Renamed
                   to "Save Storage Report" — Tom's preferred "report"
                   term (per Banned-Word-`complaint`-→-`report` rule
                   2026-06-21).  Describes what the button DOES: writes
                   a report of the browser's persistent storage state
                   to Downloads so Claudian can trace it. -->
              <button
                type="button"
                title="⬇ Save Storage Report — writes a Storage Report of every SEM App storage key (with byte counts + raw values + parsed results) to ~/Downloads/ as a single file.  Send it to Claudian to trace where your contract data actually lives inside the browser's persistent storage."
                aria-label="Save Storage Report"
                class="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl shadow-sm border border-slate-300 transition-all text-xs"
                @click="dumpLocalStorageDiagnostic"
              >
                <span aria-hidden="true">⬇</span> Save Storage Report
              </button>
              <!-- r41 v466 (Tom Gilb 2026-07-02 "ok can you clear out
                   all zero files, and all but most recent versions for
                   me") — one-click Clean-Up Storage.  Confirm dialog
                   names EXACTLY what will be deleted BEFORE committing
                   (No-Silent-Data-Loss SUPREME).  Deletes zero-content
                   contracts + older duplicates by title. -->
              <button
                type="button"
                title="🧹 Clean Up Storage — deletes zero-content contracts (Restore placeholders, error records, abandoned imports) and older duplicates (same title, keep the version with most content + most recent).  Shows a confirmation dialog naming EVERY contract that will be deleted BEFORE committing."
                aria-label="Clean Up Storage"
                class="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-xl shadow-sm border border-amber-300 transition-all text-xs"
                @click="cleanUpStorage"
              >
                <span aria-hidden="true">🧹</span> Clean Up Storage
              </button>
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
          </div>

          <!-- r41 v453 (Tom Gilb 2026-07-02 verbatim *"did we not agree there
               is no point in making zero files available at all?"*) —
               landing-grid filter.  v444 already filtered zero-clause
               contracts out of the Redraft picker's Section 0; v453
               extends the same rule to the landing grid.  Redraftable
               contracts (clauseCount > 0) render first; empty contracts
               (Restored / never-parsed / abandoned imports) are HIDDEN
               by default with a small counter + Show toggle so nothing
               is silently removed (No-Silent-Removal SUPREME). -->
          <div v-if="landingEmptyContracts.length > 0 && !showLandingEmpties" class="mb-4 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>
              <strong>{{ landingEmptyContracts.length }} empty contract{{ landingEmptyContracts.length === 1 ? '' : 's' }} hidden</strong>
              <span class="text-slate-500 ml-1">(zero clauses each — Restored placeholders or abandoned imports).  It is illogical to offer zero-content contracts for redraft / open.</span>
            </span>
            <button
              type="button"
              class="ml-3 shrink-0 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold"
              title="Reveal the hidden zero-clause contracts (Restored placeholders / abandoned imports) so you can Delete them."
              @click="showLandingEmpties = true"
            >Show {{ landingEmptyContracts.length }}</button>
          </div>
          <div v-else-if="landingEmptyContracts.length > 0 && showLandingEmpties" class="mb-4 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Showing all {{ store.contracts.value.length }} contracts including {{ landingEmptyContracts.length }} empty one{{ landingEmptyContracts.length === 1 ? '' : 's' }}.</span>
            <button
              type="button"
              class="ml-3 shrink-0 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold"
              @click="showLandingEmpties = false"
            >Hide empty</button>
          </div>

          <!-- ── Analysed contracts grid (when present) ──────────────────── -->
          <div v-if="landingVisibleContracts.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div
              v-for="contract in landingVisibleContracts"
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

              <!-- Entry type count pills (r41 v397 Tom Gilb 2026-07-01 verbatim
                   "can you clean the old F V etc to Functions Values") — pill
                   now reads "5 Functions" / "1 Value" instead of "F. 5" per
                   Spell-out-Type-Names SUPREME + Pluralisation Rule. -->
              <div class="flex gap-1.5 flex-wrap">
                <span
                  v-for="type in (['F', 'V', 'C', 'R', 'S', 'Task'] as ContractEntryType[])"
                  :key="type"
                  class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                  :class="TYPE_COLORS[type].tw"
                >
                  {{ contract.clauses.flatMap(cl => cl.entries).filter(e => e.type === type).length }}
                  {{ _entryTypeFullByCount(type, contract.clauses.flatMap(cl => cl.entries).filter(e => e.type === type).length) }}
                </span>
              </div>

              <!-- r41 v404 (Tom Gilb 2026-07-01 verbatim "it is not clear how
                   to delete a contract, or to change it or fill an empty
                   contract") — per-card actions row.  Always visible (no
                   hover-only affordance per accessibility_tom.md universal
                   framing).  `.stop` on every click so the card's own open
                   handler doesn't fire when the action is used.  Composes with
                   MOVE Principle SUPREME (actions visible right where the
                   card lives), Icon-Plus-Text SUPREME (glyph + full text),
                   Universal Undo SUPREME (delete is two-step armed with a
                   4-second auto-disarm; rename uses prompt() which cancels
                   cleanly; fill preserves the empty contract's identity by
                   updating in place rather than creating a duplicate),
                   No-Silent-Data-Loss SUPREME (rename patches title; fill
                   patches text; delete is deliberate + confirmed). -->
              <!-- r41 v405 — pencil/trash/warning emojis (✏ ✎ 🗑 ⚠) REMOVED per
                   Planguage-Glyph-First SUPREME + No-Generic-Icon-Libraries
                   SUPREME.  Text-only labels honour Icon-Plus-Text SUPREME
                   (the rule requires text + glyph WHEN a glyph is present;
                   text alone is a legal shape).  Armed-delete state changes
                   colour + copy + pulse rather than adding a warning emoji. -->
              <div class="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                <button
                  v-if="contract.parseStatus === 'empty'"
                  type="button"
                  class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-300 hover:bg-teal-100 transition-colors"
                  title="Fill — paste or upload the contract text into this empty card.  When you Import, this empty contract is filled in place (no duplicate created)."
                  @click.stop="openImportForContract(contract.id)"
                >
                  <span>Fill</span>
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
                  title="Rename — change this contract's title in place.  Raw text + parsed entries are preserved."
                  @click.stop="renameContract(contract.id)"
                >
                  <span>Rename</span>
                </button>
                <button
                  type="button"
                  :title="_armedDeleteContractId === contract.id
                    ? 'Confirm Delete — click again within 4 seconds to permanently remove this contract.  This action cannot be undone; click anywhere else to cancel.'
                    : 'Delete — click once to arm (turns red for 4 seconds); click again to confirm.  Raw text + parsed entries are permanently discarded.'"
                  class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors border"
                  :class="_armedDeleteContractId === contract.id
                    ? 'bg-red-600 text-white border-red-700 hover:bg-red-500 animate-pulse'
                    : 'bg-white text-red-700 border-red-300 hover:bg-red-50'"
                  @click.stop="armOrConfirmDeleteContract(contract.id)"
                >
                  <span>{{ _armedDeleteContractId === contract.id ? 'Click again to confirm' : 'Delete' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- ── Empty-state welcome (no analysed contracts yet) ───────── -->
          <div v-else class="flex flex-col items-center pt-8 pb-4 gap-2 text-center">
            <div class="text-5xl" aria-hidden="true">📋</div>
            <h2 class="text-base font-bold text-slate-700">No contracts analysed yet</h2>
            <p class="text-sm text-slate-500 max-w-sm">
              Import your own contract or click a sample below — SEM converts it into
              measurable Planguage obligations and flags vague language automatically.
            </p>
          </div>

          <!-- ── Built-in sample contracts — always visible ─────────────── -->
          <div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Sample contracts — click to load &amp; analyse
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                v-for="entry in builtInEntries"
                :key="entry.id"
                type="button"
                :title="`Load and analyse: ${entry.title} — SEM will split into clauses and extract all Planguage obligations`"
                class="group text-left bg-white rounded-2xl border border-teal-100 shadow-sm hover:shadow-md hover:border-teal-400 transition-all p-4 focus:outline-none focus:ring-2 focus:ring-teal-400"
                @click="quickAnalyse(entry)"
              >
                <div class="flex items-start gap-3">
                  <span class="text-xl shrink-0 mt-0.5" aria-hidden="true">📄</span>
                  <div class="flex-1 min-w-0">
                    <p class="font-bold text-sm text-slate-800 leading-tight group-hover:text-teal-700 transition-colors">
                      {{ entry.title }}
                    </p>
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      {{ CONTRACT_TYPE_LABELS[entry.contractType] ?? entry.contractType }}
                    </p>
                  </div>
                  <span
                    class="shrink-0 self-center text-[10px] font-bold px-2 py-1 rounded-lg bg-teal-600 group-hover:bg-teal-700 text-white transition-colors whitespace-nowrap"
                    aria-hidden="true"
                  >Analyse →</span>
                </div>
              </button>
            </div>
          </div>
        </ScrollContainer>
      </template>

      <!-- ════════════════════ DETAIL VIEW ══════════════════════════════════ -->
      <template v-else-if="selectedContract">

        <!-- r41 2026-06-20 (Tom Gilb verbatim "I did not see an action window
             here or anywhere yet, are we implemented?") — yes, but the
             original Phase Activity Window was trapped inside the loading-
             state block (v-if="isContractAnalysing || contractAmuseActive")
             which only renders when the contract has NO clauses yet (full-
             screen initial-import experience).  Once Phase 1 splits into N
             clauses and the planner navigates to the Clauses tab to see the
             sidebar, the activity feed was invisible for the entire ~4-
             minute Phase 2 extraction.  Fix: this NEW compact Phase Activity
             banner sits as a sibling OUTSIDE the v-if chain, so it appears
             on every tab whenever there's real activity (`parsingClauses` is
             non-empty OR contract is in splitting phase) — and crucially,
             also when the contract-level parseStatus has drifted to
             'complete'/'error' but some clauses are still in 'parsing' (the
             orphan-clause case Tom hit).  Composes with: Conjunction-of-
             Technologies SUPREME (visibly shows AI activity), MOVE Principle
             (always-visible during work, no menu-dive), Honest Loading Hint
             Copy SUPREME, DD-009 Zero-Training UI, Spell-out-Type-Names
             SUPREME, Icon-Plus-Text SUPREME. -->
        <div
          v-if="(parsingClauses.length > 0 || selectedContract.parseStatus === 'splitting') && !isContractAnalysing"
          class="shrink-0 mx-4 mt-3 mb-1 bg-slate-50 border border-slate-200 rounded-xl shadow-sm overflow-hidden"
          aria-label="Live phase activity feed (compact banner across tabs)"
        >
          <!-- Banner header row — r41 v406 (Tom Gilb 2026-07-01 verbatim
               "there was one more violation, a symbol looking like a banner
               on 2 stilts") — 📡 (satellite dish, a dish-on-tripod that reads
               as a "banner on 2 stilts") REMOVED per Planguage-Glyph-First
               SUPREME + No-Generic-Icon-Libraries SUPREME.  The pulsing green
               dot + "Live" text already announce the activity state; no
               office-artefact glyph needed. -->
          <div class="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-100">
            <span class="text-[11px] font-extrabold text-slate-700 uppercase tracking-[0.14em]">Phase Activity</span>
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            <span class="text-[10px] text-emerald-700 font-semibold">Live</span>
            <span class="ml-auto text-[10px] text-slate-500 tabular-nums">
              {{ contractClausesDone }} of {{ contractClausesTotal }} clauses done
              <span v-if="parsingClauses.length > 0" class="text-amber-700">
                · {{ parsingClauses.length }} extracting now
              </span>
            </span>
          </div>

          <!-- r41 2026-06-20 — compact banner splitting view ALSO shows
               live clauses (latest 3 in a horizontal row) when any have
               been found.  Falls back to the raw-text peek only while the
               stream is warming up. -->
          <div v-if="selectedContract.parseStatus === 'splitting'" class="px-3 py-2 space-y-1.5">
            <template v-if="liveSplittingClauses.length > 0">
              <!-- r41 v406 — ✨ sparkles emoji REMOVED per Planguage-Glyph-
                   First SUPREME.  The green colour + tabular count is enough
                   at-a-glance signal. -->
              <p class="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <span>Clauses found ({{ liveSplittingClauses.length }} so far)</span>
              </p>
              <ul class="flex gap-1.5 overflow-x-auto pb-1">
                <li
                  v-for="cl in liveSplittingClauses.slice(-4).reverse()"
                  :key="cl.id"
                  class="shrink-0 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 max-w-[200px]"
                >
                  <p class="text-[10px] font-semibold text-slate-800 truncate">
                    <span class="font-mono text-emerald-700">{{ cl.number }}</span>
                  </p>
                  <p class="text-[9px] text-slate-500 truncate">{{ bestClauseHeading(cl) }}</p>
                </li>
              </ul>
            </template>
            <template v-else>
              <!-- r41 v406 — 📄 page emoji REMOVED per Planguage-Glyph-First
                   SUPREME.  Colour + text does the job at-a-glance. -->
              <p class="text-[10px] font-semibold text-teal-700 uppercase tracking-wider mb-1">
                Reading contract text — looking for clause boundaries
              </p>
              <p class="text-[10px] text-slate-500 italic line-clamp-2 font-mono">
                {{ selectedContract.rawImportText?.slice(0, 280) ?? '' }}{{ (selectedContract.rawImportText?.length ?? 0) > 280 ? '…' : '' }}
              </p>
            </template>
          </div>

          <!-- During parsing: in-flight + just-extracted columns side-by-side -->
          <div
            v-else-if="parsingClauses.length > 0 || recentDoneClauses.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 gap-2 p-3"
          >
            <!-- IN-FLIGHT column (left) -->
            <div v-if="parsingClauses.length > 0" class="space-y-1.5">
              <!-- r41 v406 — 🟡 yellow-circle emoji REMOVED per Planguage-
                   Glyph-First SUPREME.  The amber colour + pulsing dot in the
                   list rows below already conveys the in-flight signal. -->
              <p class="text-[10px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>Extracting now ({{ parsingClauses.length }} in parallel)</span>
              </p>
              <ul class="space-y-1">
                <li
                  v-for="cl in parsingClauses.slice(0, 3)"
                  :key="cl.id"
                  class="bg-white border border-amber-100 rounded-md px-2 py-1.5 flex items-start gap-1.5"
                >
                  <span class="text-amber-500 animate-pulse mt-0.5 shrink-0 leading-none text-[10px]" aria-hidden="true">●</span>
                  <div class="min-w-0 flex-1">
                    <p class="text-[11px] font-semibold text-slate-700 truncate">
                      Clause {{ cl.number }} · {{ bestClauseHeading(cl) }}
                    </p>
                    <p class="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-1">
                      {{ cl.rawText.slice(0, 140) }}{{ cl.rawText.length > 140 ? '…' : '' }}
                    </p>
                  </div>
                </li>
                <li v-if="parsingClauses.length > 3" class="text-[10px] text-slate-400 italic px-2">
                  + {{ parsingClauses.length - 3 }} more in this batch…
                </li>
              </ul>
            </div>

            <!-- JUST-EXTRACTED column (right) -->
            <div v-if="recentDoneClauses.length > 0" class="space-y-1.5">
              <!-- r41 v406 — ✅ green-tick emoji REMOVED per Planguage-Glyph-
                   First SUPREME.  Emerald colour + count in the list rows
                   below already conveys the completion signal. -->
              <p class="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>Just extracted — newest first</span>
              </p>
              <ul class="space-y-1">
                <li
                  v-for="cl in recentDoneClauses.slice(0, 3)"
                  :key="cl.id"
                  class="bg-white border border-emerald-100 rounded-md px-2 py-1.5"
                >
                  <p class="text-[11px] font-semibold text-slate-700 truncate">
                    Clause {{ cl.number }} · {{ cl.heading }}
                  </p>
                  <p v-if="cl.entries.length === 0" class="text-[10px] text-slate-400 italic mt-0.5">
                    (no obligations extracted)
                  </p>
                  <ul v-else class="mt-0.5 space-y-0.5">
                    <li
                      v-for="e in cl.entries.slice(0, 2)"
                      :key="e.id"
                      class="text-[10px] text-slate-600 flex items-start gap-1"
                    >
                      <span :class="entryTypeColor(e.type)" class="font-bold shrink-0">{{ entryTypeWord(e.type) }}:</span>
                      <span class="min-w-0 flex-1 line-clamp-1">{{ e.description }}</span>
                    </li>
                    <li v-if="cl.entries.length > 2" class="text-[10px] text-slate-400 italic">
                      + {{ cl.entries.length - 2 }} more
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- ── ANALYSIS THEATRE — full-height, lawyerly Case Analysis surface ── -->
        <!-- r41 v391 (Tom Gilb 2026-07-01 verbatim "I also want more visibility  -->
        <!-- into exactly what the contacts agent is doing. There is only a sliver -->
        <!-- of a window. Please design an elegant display of the phases of       -->
        <!-- contract analysis, to impress a lawyer") — replaces the previous     -->
        <!-- centred spinner + amuse block with a full-surface Case Analysis      -->
        <!-- theatre.  Phase Timeline · Case Log · Analysis Metrics · Clause      -->
        <!-- Ledger · Amuse card (Rule 8) · Cancel · Credibility strip.  Composes -->
        <!-- with Icon-Plus-Text SUPREME, International Icons DD-015, Spell-out-  -->
        <!-- Type-Names SUPREME, Colorful Exports Rule, MOVE Principle,           -->
        <!-- accessibility_tom.md (universal), Loading-State Rule 8 (all four     -->
        <!-- elements retained), Honest Loading Hint Copy SUPREME, Universal Undo -->
        <!-- SUPREME (Cancel is reversible), Conjunction-of-Technologies SUPREME, -->
        <!-- Twin portability.  See ContractAnalysisTheatre.vue for details.      -->
        <ContractAnalysisTheatre
          v-if="isContractAnalysing || contractAmuseActive"
          :parse-status="selectedContract.parseStatus"
          :clauses="selectedContract.clauses"
          :live-splitting-clauses="liveSplittingClauses"
          :parsing-clauses="parsingClauses"
          :recent-done-clauses="recentDoneClauses"
          :contract-elapsed="contractElapsed"
          :contract-real-progress="contractRealProgress"
          :contract-clauses-done="contractClausesDone"
          :contract-clauses-total="contractClausesTotal"
          :is-analysing="isContractAnalysing"
          :amuse-cards="CONTRACT_AMUSE"
          :amuse-idx="contractAmuseIdx"
          :amuse-active="contractAmuseActive"
          :amuse-finishing="contractAmuseFinishing"
          :amuse-countdown="contractAmuseCountdown"
          :cancellable="_parseAbortController !== null"
          :contract-title="selectedContract.title"
          :mode-config-summary="contractsModeSummary"
          class="flex-1 min-h-0"
          @abort="abortParse()"
          @advance-amuse="contractAmuseIdx = (contractAmuseIdx + 1) % CONTRACT_AMUSE.length"
          @jump-amuse="(i) => { contractAmuseIdx = i }"
          @extend-amuse="contractExtendAmuse"
          @adjust-options="emit('open-settings', 'contractsMode')"
        />

        <!-- ── CLAUSES TAB ──────────────────────────────────────────────── -->
        <template v-else-if="activeTab === 'clauses'">
          <div class="flex-1 min-h-0 flex">

            <!-- Clause list sidebar -->
            <div class="w-64 shrink-0 border-r border-slate-200 flex flex-col bg-white">
              <div class="shrink-0 px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Clauses</span>
                <span class="text-[10px] text-slate-400">{{ selectedContract.clauses.length }}</span>
              </div>
              <!-- r41 v408 (Tom Gilb 2026-07-01 "the clauses window, left,
                   has similar problems") — sidebar previously ran with
                   `no-pill="true"` which suppressed BOTH the bottom pill AND
                   the right-edge scroll track (per ScrollContainer.vue lines
                   42/72/99).  Result: no visible scroll signal even when the
                   sidebar had 20 clauses.  Flipped to `no-pill="false"` so
                   the right-edge track thumb + bottom "N% shown" pill render.
                   Also matched `fade-from` to the white sidebar background
                   so the bottom gradient blends instead of showing a mismatched
                   band, and removed the redundant inner-style max-height
                   (flex-1 min-h-0 outer already caps the height correctly). -->
              <ScrollContainer
                outer-class="flex-1 min-h-0 relative"
                inner-class="py-1"
                fade-from="rgb(255,255,255)"
                :no-pill="false"
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
                  :title="`${clause.number} — ${bestClauseHeading(clause)} · ${clause.entries.length} entries`"
                  class="w-full text-left px-3 py-2.5 border-b border-slate-50 transition-colors text-xs"
                  :class="[
                    selectedClauseId === clause.id
                      ? 'bg-teal-50 border-l-2 border-l-teal-500 text-teal-800'
                      : 'hover:bg-slate-50 text-slate-700',
                    entryFilter !== 'all' && !clause.entries.some(e => e.type === entryFilter)
                      ? 'opacity-40 pointer-events-none'
                      : '',
                  ]"
                  @click="selectedClauseId = clause.id"
                >
                  <!-- Row 1: §N + parse-status dot -->
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono text-[10px] text-slate-400 shrink-0">{{ clause.number }}</span>
                    <!-- Status dot — only shown while not-done (parsing/error/pending) -->
                    <span
                      v-if="clause.parseStatus !== 'done'"
                      class="shrink-0 w-1.5 h-1.5 rounded-full"
                      :class="clause.parseStatus === 'parsing' ? 'bg-amber-400 animate-pulse'
                             : clause.parseStatus === 'error'   ? 'bg-red-400'
                             :                                     'bg-slate-200'"
                      :title="clause.parseStatus"
                    />
                  </div>
                  <!-- Row 2: Clause heading -->
                  <div class="font-semibold mt-0.5 leading-tight truncate">{{ bestClauseHeading(clause) }}</div>
                  <!-- Row 3: Color Glyph type indicators (DD-013: dblclick → GlyphDataPanel) -->
                  <!-- Single-click propagates up to outer clause selector button.          -->
                  <!-- DD-013 fix (2026-07-05): data-pl-type + title live on the wrapper
                       span; PlTypeIcon is :no-detail-click="true". Layer A capture
                       handler in App.vue catches dblclick anywhere on the wrapper
                       and opens Glyph Detail. Single title source → no HoverHint
                       duplication. -->
                  <div
                    v-if="clause.parseStatus === 'done' && clause.entries.length > 0"
                    class="flex items-center gap-0.5 mt-1 flex-wrap"
                  >
                    <template v-for="ct in CONTRACT_FILTER_GLYPHS" :key="ct.contractType">
                      <span
                        v-if="clause.entries.some(e => e.type === ct.contractType)"
                        class="inline-flex"
                        :data-pl-type="ct.glyphType"
                        :title="`${ct.keyword} (${ct.contractType}.) — ${clause.entries.filter(e => e.type === ct.contractType).length} in §${clause.number} · Single-click to select clause · Double-click for Glyph Detail`"
                      >
                        <PlTypeIcon
                          :pl-type="ct.glyphType"
                          size="sm"
                          :no-detail-click="true"
                        />
                      </span>
                    </template>
                  </div>
                  <!-- "No entries" label when done but empty -->
                  <div
                    v-else-if="clause.parseStatus === 'done'"
                    class="text-[10px] text-slate-300 mt-0.5 italic"
                  >no entries</div>
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
                    <p class="font-bold text-slate-800 text-sm">{{ selectedClause.number }} — {{ bestClauseHeading(selectedClause) }}</p>
                    <!-- r41 v402 — surface the last-parsed timestamp AND a
                         zero-entry explanation so a re-parse that yields no
                         obligations still shows a visible change to the
                         planner (Tom Gilb "reparsing does not shaw a visible
                         result").  Composes with DD-009 Zero-Training UI + No-
                         Silent-Data-Loss SUPREME + Honest Loading Hint Copy
                         SUPREME (no misleading absence of feedback). -->
                    <p class="text-[11px] text-slate-500">
                      <span>{{ selectedClause.entries.length }} Planguage {{ selectedClause.entries.length === 1 ? 'entry' : 'entries' }} extracted</span>
                      <span v-if="selectedClause.lastParsedAt" class="text-slate-400">
                        · parsed at {{ _clauseLastParsedLabel(selectedClause.lastParsedAt) }}
                      </span>
                      <span v-if="selectedClause.parseStatus === 'done' && selectedClause.entries.length === 0" class="ml-1 text-slate-400 italic">
                        · the AI found no measurable obligations in this clause
                      </span>
                    </p>
                  </div>
                  <!-- r41 2026-06-20 (Tom Gilb verbatim "we need to be clear
                       on exactly what is being repared, how it is being
                       reparses") — full HoverHint spells out exactly what
                       goes to the LLM + which Guidelines + which Contracts
                       Mode config + which model. -->
                  <button
                    type="button"
                    :title="selectedClause.parseStatus === 'parsing'
                      ? 'Parsing in progress…'
                      : `🔄 Re-parse THIS clause — opens a Guidelines picker so you can confirm or change which rule set to apply.  Current pinned: [${activeGuidelines.map(ag => ag.guideline.tag + '.v' + ag.pin.version).join(', ') || '(none)'}].  After confirm: sends the raw clause text (${selectedClause.rawText.length} chars) to claude-sonnet-4-6 with the chosen Guidelines + current Contracts Mode (presentation = ${_contractsModeConfig.presentation}).  Replaces this clause's current ${selectedClause.entries.length} entries.  Other clauses are NOT affected.`"
                    :disabled="selectedClause.parseStatus === 'parsing'"
                    class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    :class="selectedClause.parseStatus === 'parsing'
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-teal-700 text-white hover:bg-teal-600'"
                    @click="openReparsePicker({ kind: 'clause', clauseId: selectedClause.id })"
                  >
                    {{ selectedClause.parseStatus === 'parsing' ? '⏳ Parsing…' : '🔄 Re-parse this clause…' }}
                  </button>
                </div>

                <!-- r41 2026-06-20 — Re-parse details panel: makes the
                     HoverHint content visible inline so the planner doesn't
                     have to hover to see what's about to happen. -->
                <div class="shrink-0 px-5 pb-3 bg-white border-b border-slate-200">
                  <details class="text-[11px] text-slate-600 leading-relaxed">
                    <summary class="cursor-pointer text-[10px] uppercase tracking-wider font-semibold text-slate-500 hover:text-slate-700">
                      What will Re-parse do?
                    </summary>
                    <div class="mt-2 space-y-1 pl-3 border-l-2 border-teal-300">
                      <p><strong class="text-slate-700">Input sent to AI:</strong> the raw clause text below ({{ selectedClause.rawText.length }} chars).  Other clauses are not sent.</p>
                      <p><strong class="text-slate-700">AI model:</strong> claude-sonnet-4-6 (per Model Selection Rule SUPREME — multi-section JSON requires Sonnet).</p>
                      <p>
                        <strong class="text-slate-700">Pinned Guidelines:</strong>
                        <template v-if="activeGuidelines.length > 0">
                          <span v-for="(ag, i) in activeGuidelines" :key="ag.guideline.id">
                            <span class="font-mono text-rose-700">{{ ag.guideline.tag }}.v{{ ag.pin.version }}</span>
                            <span v-if="i < activeGuidelines.length - 1">, </span>
                          </span>
                        </template>
                        <span v-else class="italic text-slate-500">none — falls back to Contracts Mode Standards axis only</span>
                      </p>
                      <p>
                        <strong class="text-slate-700">Contracts Mode:</strong>
                        presentation = <span class="font-mono">{{ _contractsModeConfig.presentation }}</span>,
                        standards = <span class="font-mono">[{{ _contractsModeConfig.standards.join(', ') || 'none' }}]</span>,
                        purposes = <span class="font-mono">[{{ _contractsModeConfig.purposes.join(', ') || 'none' }}]</span>
                      </p>
                      <p><strong class="text-slate-700">Output:</strong> replaces this clause's current <strong>{{ selectedClause.entries.length }}</strong> entries with the new extraction.  Raw clause text is preserved.</p>
                      <p class="text-slate-500 italic mt-1">Prompt caching is active across batched runs — first re-parse is full cost; subsequent re-parses within 5 min hit the cache (~10× cheaper).</p>
                    </div>
                  </details>
                </div>

                <!-- r41 v402 (Tom Gilb 2026-07-01 "reparsing does not shaw a
                     visible result") — bright, unmissable Re-parsing banner
                     that appears WHILE the clause is being re-parsed.  Composes
                     with Loading-State Rule 8 (spinner + text label; elapsed
                     lives in the button's ⏳ Parsing… state), Honest Loading
                     Hint Copy SUPREME (real activity, real bottleneck named),
                     MOVE Principle (planner sees the re-parse is happening
                     right where the clause detail lives). -->
                <div
                  v-if="selectedClause.parseStatus === 'parsing'"
                  class="shrink-0 mx-5 mt-3 px-4 py-3 rounded-xl bg-teal-50 border border-teal-200 flex items-center gap-3 text-teal-900"
                  role="status"
                >
                  <svg class="h-4 w-4 shrink-0 animate-spin text-teal-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold">Re-parsing this clause…</p>
                    <p class="text-[11px] text-teal-800/80">
                      Sending {{ selectedClause.rawText.length }} chars to claude-sonnet-4-6 with the pinned Guidelines — typically 20–60 seconds per clause (AI model processing, not network).
                    </p>
                  </div>
                </div>

                <ScrollContainer
                  outer-class="flex-1 min-h-0 relative"
                  inner-class="px-5 py-4 space-y-5"
                  inner-style="max-height: calc(100vh - 210px);"
                  :no-pill="false"
                >
                  <!-- Raw text — r41 v402 shipped a nested ScrollContainer
                       capped at 38vh; r41 v407 (Tom Gilb 2026-07-01 verbatim
                       "the lower part of the raw text is missing, scroll
                       pin") fixes two problems that combined to make the
                       card look truncated with no scroll signal: (1) 38vh on
                       a ~1050 px viewport is ~400 px — big enough to be
                       clipped by the outer clause-detail ScrollContainer
                       when the card sat past 60 % down the outer flow, so
                       the bottom of the card (including the scroll pin) fell
                       BELOW the visible viewport; (2) `fadeFrom` defaulted
                       to `white` which showed a white band on the slate-50
                       card background — extra visual noise, not a signal.
                       Fixes: (a) shrunk the max-height to a fixed 220 px so
                       the whole card fits inside the outer viewport +
                       leaves room for parsed entries below; (b) matched
                       `fadeFrom` to slate-50 so the fade blends with the
                       card background instead of screaming white; (c) added
                       an always-visible "scroll for more · N chars" hint in
                       the header row so Tom sees the scroll signal even
                       without scanning for the pin.  Composes with
                       ScrollContainer SUPREME rule + MOVE Principle +
                       accessibility_tom.md universal framing (verbal
                       feedback: the "scroll for more" text says so). -->
                  <!-- Raw text — r41 v408 (Tom Gilb 2026-07-01 verbatim "I
                       would like the same trick you did on stage 1. When I
                       select (maybe a small o) a clause you show the clause
                       in the raw text, in context") — new "in context" view
                       mode.  Mirrors Stage 1's `flashSourceLine` pattern
                       (`GetAPlanPanel.vue` line 260): renders the FULL
                       contract text with the selected clause highlighted in
                       amber and auto-scrolls the highlight into view.  A
                       toggle in the header row switches between "In context"
                       (full document with highlight) and "This clause only"
                       (v402 behaviour — just the selected clause's raw text).
                       Preference persists in localStorage.  Composes with
                       Conjunction-of-Technologies SUPREME (planner sees the
                       AI's per-clause slice IN its full-document context),
                       MOVE Principle (toggle sits right in the header), DD-009
                       Zero-Training UI (labels spell out what each mode does),
                       accessibility_tom.md universal framing (auto-scroll
                       brings the highlighted range into view; verbal "In
                       context" / "This clause only" naming). -->
                  <div>
                    <div class="mb-2 flex items-baseline gap-2 flex-wrap">
                      <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Raw {{ rawTextViewMode === 'context' ? 'contract text · this clause highlighted' : 'clause text' }}
                        · {{ rawTextViewMode === 'context' ? (selectedContract.rawImportText?.length ?? 0) : selectedClause.rawText.length }} chars
                      </p>
                      <span
                        v-if="(rawTextViewMode === 'context' ? (selectedContract.rawImportText?.length ?? 0) : selectedClause.rawText.length) > 900"
                        class="text-[10px] text-slate-500 italic tabular-nums"
                      >· scroll inside the card for the rest</span>
                      <!-- View-mode toggle (Icon-Plus-Text SUPREME — text-only labels legal) -->
                      <div
                        class="ml-auto inline-flex rounded-lg overflow-hidden border border-slate-300 text-[10px] font-bold"
                        role="group"
                        aria-label="Raw-text view mode"
                      >
                        <button
                          type="button"
                          :aria-pressed="rawTextViewMode === 'context'"
                          :class="rawTextViewMode === 'context' ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
                          class="px-2 py-1 transition-colors border-r border-slate-300"
                          title="In context — show the FULL contract text with this clause highlighted in amber.  Auto-scrolls the highlight into view."
                          @click="setRawTextViewMode('context')"
                        >In context</button>
                        <button
                          type="button"
                          :aria-pressed="rawTextViewMode === 'clause'"
                          :class="rawTextViewMode === 'clause' ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
                          class="px-2 py-1 transition-colors"
                          title="This clause only — show just the raw text of the currently-selected clause (no full-document context)."
                          @click="setRawTextViewMode('clause')"
                        >This clause only</button>
                      </div>
                    </div>
                    <ScrollContainer
                      outer-class="rounded-xl border border-slate-200 bg-slate-50 relative"
                      inner-class="p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono"
                      inner-style="max-height: 260px;"
                      fade-from="rgb(248,250,252)"
                      :no-pill="false"
                    >
                      <template v-if="rawTextViewMode === 'context' && rawContextSplit">
                        <span>{{ rawContextSplit.before }}</span><mark
                          ref="contextMarkEl"
                          class="bg-amber-200 text-slate-900 rounded-sm ring-1 ring-amber-400 px-0.5"
                          :aria-label="`Selected clause · ${selectedClause.number} — ${bestClauseHeading(selectedClause)}`"
                        >{{ rawContextSplit.match }}</mark><span>{{ rawContextSplit.after }}</span>
                      </template>
                      <template v-else>{{ selectedClause.rawText }}</template>
                    </ScrollContainer>
                    <p
                      v-if="rawTextViewMode === 'context' && !rawContextSplit"
                      class="mt-1 text-[10px] text-amber-700 italic"
                    >
                      Could not locate this clause verbatim in the raw contract text (the AI may have normalised whitespace or spans) — showing this clause only.
                    </p>
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
                          <!-- Glyph + spelled-out type name (universal label rule) + tag number -->
                          <PlTypeBadge :entry-type="CONTRACT_ENTRY_GLYPH[entry.type]" size="sm" show-label />
                          <span
                            class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border"
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
              :title="type === 'all'
                ? 'Show all entry types'
                : `Show ${CONTRACT_ENTRY_FULL[type as ContractEntryType]} entries only`"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors"
              :class="entryFilter === type
                ? typeColorActive(type)
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'"
              @click="entryFilter = type"
            >
              <template v-if="type === 'all'">All</template>
              <template v-else>
                <PlTypeBadge :entry-type="CONTRACT_ENTRY_GLYPH[type as ContractEntryType]" size="sm" show-label />
              </template>
              <span class="opacity-60 text-[10px]">{{ type === 'all' ? store.allEntries.value.length : store.entryCounts.value[type as ContractEntryType] }}</span>
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
                  <!-- Glyph + spelled-out type name (universal label rule) + tag number -->
                  <PlTypeBadge :entry-type="CONTRACT_ENTRY_GLYPH[entry.type]" size="sm" show-label />
                  <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border" :class="TYPE_COLORS[entry.type].tw">{{ entry.tag }}</span>
                  <span v-if="entry.obligatedParty" class="text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">{{ entry.obligatedParty }}</span>
                  <span v-if="entry.isAmbiguous" class="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">⚠ Ambiguous</span>
                  <span class="ml-auto text-[10px] text-slate-400 font-mono">{{ selectedContract.clauses.find(cl => cl.id === entry.clauseRef)?.number ?? '' }}</span>
                </div>
                <p class="text-sm text-slate-800 font-semibold">{{ entry.description }}</p>
                <!-- r41 v412 (Tom Gilb 2026-07-01 "the scale of measure is
                     defined first. Then the Targets (Wish (first), Goal and
                     Constraint levels (Tolerable). Ideally with a Benchmark
                     (Past, Status). The meter is a designed (or stipulated
                     design, in the contract) means to measure where we are")
                     — canonical Kai-Zen Glossary order for scalar entries:
                     Scale · Meter(s) · Benchmarks (Past · Status) · Wish ·
                     Goal · Tolerable.  Scale rendered FIRST as the dimension;
                     Meter rendered SEPARATELY as the measurement device.
                     Composes with rule_kaizen_glossary_is_source_of_truth
                     SUPREME + rule_essential_contract_standard SUPREME. -->
                <div v-if="entry.type === 'V' || entry.type === 'R'" class="text-xs text-slate-600 space-y-0.5">
                  <p v-if="entry.scale"><span class="font-semibold">Scale:</span> {{ entry.scale }}</p>
                  <p v-if="entry.meter"><span class="font-semibold">Meter:</span> {{ entry.meter }}</p>
                  <p v-if="entry.past"><span class="font-semibold">Past:</span> {{ entry.past }}</p>
                  <p v-if="entry.status"><span class="font-semibold">Status:</span> {{ entry.status }}</p>
                  <p v-if="entry.wish"><span class="font-semibold">Wish:</span> {{ entry.wish }}</p>
                  <p v-if="entry.goal"><span class="font-semibold">Goal:</span> <strong>{{ entry.goal }}</strong></p>
                  <p v-if="entry.tolerable"><span class="font-semibold">Tolerable:</span> {{ entry.tolerable }}</p>
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
            <p class="text-xs text-slate-500 mb-4">
              Party × obligation type matrix. Each cell shows entries where that party is obligated.
              <span v-if="entryFilter !== 'all'" class="font-semibold text-teal-700">
                — Filter active: {{ CONTRACT_ENTRY_FULL[entryFilter as ContractEntryType] }} column highlighted.
              </span>
            </p>
            <div class="overflow-x-auto">
              <table class="min-w-full border-collapse text-xs bg-white rounded-xl overflow-hidden shadow-sm">
                <thead>
                  <tr class="bg-teal-700 text-white">
                    <th class="p-3 text-left font-bold whitespace-nowrap">Party</th>
                    <th
                      v-for="type in (['F','V','C','R','S','Task'] as ContractEntryType[])"
                      :key="type"
                      class="p-2 text-center font-bold text-[11px] whitespace-nowrap transition-opacity"
                      :class="entryFilter !== 'all' && entryFilter !== type ? 'opacity-25' : ''"
                    >
                      <div
                        class="flex flex-col items-center gap-0.5 rounded-lg px-1 py-0.5 transition-colors"
                        :class="entryFilter === type ? 'bg-white/25 ring-1 ring-white/50' : ''"
                      >
                        <PlTypeBadge :entry-type="CONTRACT_ENTRY_GLYPH[type]" size="sm" />
                        <span>{{ CONTRACT_ENTRY_FULL[type] }}</span>
                      </div>
                    </th>
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
                      class="p-3 text-center transition-opacity"
                      :class="[
                        entryFilter !== 'all' && entryFilter !== type ? 'opacity-25' : '',
                        entryFilter === type ? 'bg-slate-50' : '',
                      ]"
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

        <!-- ── REWRITES TAB (Phase 3A — read-only review) ─────────────────
             Tom Gilb 2026-06-20 verbatim greenlight ("go") on the Phase 3
             draft.  Phase 3A scope: side-by-side ORIGINAL ↔ REWRITTEN display
             of every entry with a non-empty `rewrittenText`; per-entry tick
             box; type filter + show-only-with-rewrites toggle.  Phases 3B
             (bulk Accept All / Accept All of Type / Accept Ticked / Reject
             All) + 3C (Save as new contract version) + 3D (compare-mode
             export) banked for next iterations.  Composes with: Sources-of-
             Specs SUPREME (every rewrite is AI-generated provenance — the
             config it ran under is captured at parse time and surfaces here
             in the empty-state hint), No-Silent-Data-Loss SUPREME (originals
             always shown), Spell-out-Type-Names SUPREME (full type words),
             Icon-Plus-Text SUPREME (every tick row has glyph + text),
             MOVE Principle (filter chips visible at-a-glance), DD-009
             Zero-Training UI (HoverHints on every action). -->
        <template v-else-if="activeTab === 'rewrites'">
          <!-- Filter row -->
          <div class="shrink-0 flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200 flex-wrap">
            <button
              v-for="type in (['all', 'F', 'V', 'C', 'R', 'S', 'Task'] as const)"
              :key="type"
              type="button"
              :title="type === 'all'
                ? 'Show all entry types in the rewrite review'
                : `Show ${CONTRACT_ENTRY_FULL[type as ContractEntryType]} entry rewrites only`"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors"
              :class="rewriteTypeFilter === type
                ? typeColorActive(type)
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'"
              @click="rewriteTypeFilter = type"
            >
              <template v-if="type === 'all'">All</template>
              <template v-else>
                <PlTypeBadge :entry-type="CONTRACT_ENTRY_GLYPH[type as ContractEntryType]" size="sm" show-label />
              </template>
            </button>
            <label class="ml-auto inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="rewriteOnlyWithRewrites"
                class="h-3.5 w-3.5 rounded border-slate-300 text-rose-700 focus:ring-rose-300"
              />
              <span>Only entries with a proposed rewrite</span>
            </label>
            <!-- r41 2026-06-20 (Phase 3.5A — Guidelines Library) — opens the
                 GuidelineLibraryPanel drawer.  Composes with: Guidelines
                 Library architecture (Tom Gilb 2026-06-20 verbatim (c)/(b)/
                 (b) decisions), MOVE Principle (one-click reach), Icon-
                 Plus-Text SUPREME (glyph + text label). -->
            <!-- r41 v401 — matches the Active-Guidelines-bar button label
                 (Tom Gilb "Set Contract Guidelines"). -->
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 transition-colors"
              title="Set Contract Guidelines — open the global SEM App Guidelines Library to pin / unpin / reject / edit Rules for this contract.  Tom Gilb (c)/(b)/(b) architecture: global library across all agents, version-pinning per contract, structured whereChecked + optional free-text."
              @click="guidelineLibraryOpen = true"
            >
              <span>Set Contract Guidelines</span>
            </button>
            <span class="text-[11px] text-slate-400 tabular-nums pl-3 border-l border-slate-200">
              {{ entriesWithRewrites.length }} entries · {{ rewriteTicks.size }} ticked
            </span>
          </div>

          <!-- r41 v475 — Rewrites export strip (Tom Gilb 2026-07-03 verbatim
               "I cannot see how to export the susbsets (Values, Function) or
               the complete set of these recommendations").  Two scopes, four
               pins: SHOWN (respects filter) · WHOLE SET (all rewrites).
               Composes with Export-button-on-all-windows SUPREME, MOVE
               Principle SUPREME, Icon-Plus-Text SUPREME, Mailto-No-Self-To
               SUPREME, Colorful HTML Spec Email Rule (one-outer-table). -->
          <div
            v-if="allEntriesWithRewrites.length > 0"
            class="shrink-0 flex items-center gap-2 px-4 py-2 bg-rose-50 border-b border-rose-200 flex-wrap"
          >
            <span class="text-[11px] font-bold uppercase tracking-widest text-rose-800">Export rewrites</span>
            <!-- SHOWN — respects current filters -->
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 transition-colors"
              :title="rewritesCopyShownFlash
                ? `✓ Copied — ${entriesWithRewrites.length} shown rewrite(s) on the clipboard as colourful HTML + plain text.  Paste into Keynote / Mail / Notes with ⌘V.`
                : `Copy SHOWN — copies the ${entriesWithRewrites.length} rewrite(s) currently visible (respects your Type filter and Only-with-rewrites toggle above) as colourful HTML + plain text.`"
              :disabled="entriesWithRewrites.length === 0"
              @click="copyRewrites('shown')"
            >
              <span aria-hidden="true">[⋮]=[⋮]</span>
              <span>{{ rewritesCopyShownFlash ? 'Shown Copied ✓' : `Copy SHOWN (${entriesWithRewrites.length})` }}</span>
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 transition-colors"
              :title="rewritesEmailShownFlash
                ? `✓ Mail opening — press ⌘V in the body to paste the ${entriesWithRewrites.length} shown rewrite(s) as colourful HTML.`
                : `Email SHOWN — opens Mail with subject + LOUD ⌘V paste cue for the ${entriesWithRewrites.length} rewrite(s) currently visible (respects your filter above).  You choose the recipient.`"
              :disabled="entriesWithRewrites.length === 0"
              @click="emailRewrites('shown')"
            >
              <span aria-hidden="true">[⋮]---→[⋮]</span>
              <span>{{ rewritesEmailShownFlash ? 'Shown Sent ✓' : `Email SHOWN (${entriesWithRewrites.length})` }}</span>
            </button>
            <!-- WHOLE SET — every entry with a rewrite regardless of filter -->
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-700 text-white hover:bg-rose-800 transition-colors ml-2"
              :title="rewritesCopyAllFlash
                ? `✓ Copied — WHOLE SET (${allEntriesWithRewrites.length} rewrites, every type) on the clipboard as colourful HTML + plain text.`
                : `Copy WHOLE SET — copies every rewrite on this contract (${allEntriesWithRewrites.length} across all types) as colourful HTML + plain text.  Ignores the Type filter above.`"
              :disabled="allEntriesWithRewrites.length === 0"
              @click="copyRewrites('all')"
            >
              <span aria-hidden="true">[⋮]=[⋮]</span>
              <span>{{ rewritesCopyAllFlash ? 'Whole Set Copied ✓' : `Copy WHOLE SET (${allEntriesWithRewrites.length})` }}</span>
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-700 text-white hover:bg-rose-800 transition-colors"
              :title="rewritesEmailAllFlash
                ? `✓ Mail opening — press ⌘V in the body to paste the WHOLE SET (${allEntriesWithRewrites.length} rewrites) as colourful HTML.`
                : `Email WHOLE SET — opens Mail for the ${allEntriesWithRewrites.length} rewrite(s) across ALL types on this contract.  You choose the recipient.`"
              :disabled="allEntriesWithRewrites.length === 0"
              @click="emailRewrites('all')"
            >
              <span aria-hidden="true">[⋮]---→[⋮]</span>
              <span>{{ rewritesEmailAllFlash ? 'Whole Set Sent ✓' : `Email WHOLE SET (${allEntriesWithRewrites.length})` }}</span>
            </button>
          </div>

          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="px-4 py-3"
            inner-style="max-height: calc(100vh - 200px);"
            :no-pill="false"
          >
            <!-- Empty state -->
            <div
              v-if="entriesWithRewrites.length === 0"
              class="text-center py-16 px-6 space-y-3 max-w-xl mx-auto"
            >
              <p class="text-3xl" aria-hidden="true">📝</p>
              <p class="text-sm font-semibold text-slate-700">
                No AI-proposed rewrites on this contract yet.
              </p>
              <p class="text-xs text-slate-500 leading-relaxed">
                Rewrites are produced when the Contracts Mode <strong>Purpose</strong> axis includes <strong>Rewrite</strong>.  Open <strong>Settings → Contracts Mode</strong>, tick <strong>Rewrite</strong> under Purposes, and re-import or re-parse the contract.
              </p>
              <p v-if="!rewriteOnlyWithRewrites" class="text-xs text-slate-400 italic mt-3">
                (The "Only entries with a proposed rewrite" toggle above is off — entries without rewrites would normally be hidden.)
              </p>
            </div>

            <!-- Per-entry side-by-side cards -->
            <div v-else class="space-y-3">
              <div
                v-for="entry in entriesWithRewrites"
                :key="entry.id"
                class="bg-white rounded-xl border p-4 space-y-3"
                :class="rewriteTicks.has(entry.id)
                  ? 'border-rose-400 ring-2 ring-rose-200/60 shadow-sm'
                  : 'border-slate-200'"
              >
                <!-- Header row: type badge + tag + party + clause ref + tick -->
                <div class="flex items-center gap-2 flex-wrap">
                  <PlTypeBadge :entry-type="CONTRACT_ENTRY_GLYPH[entry.type]" size="sm" show-label />
                  <span
                    class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border"
                    :class="TYPE_COLORS[entry.type].tw"
                  >{{ entry.tag }}</span>
                  <span
                    v-if="entry.obligatedParty"
                    class="text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full"
                  >{{ entry.obligatedParty }}</span>
                  <span class="text-[10px] text-slate-400 font-mono">
                    {{ selectedContract.clauses.find(cl => cl.id === entry.clauseRef)?.number ?? '' }}
                    ·
                    {{ (() => { const _cl = selectedContract.clauses.find(cl => cl.id === entry.clauseRef); return _cl ? bestClauseHeading(_cl) : '' })() }}
                  </span>
                  <label class="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer select-none"
                         :class="rewriteTicks.has(entry.id) ? 'text-rose-700' : 'text-slate-500 hover:text-rose-700'">
                    <input
                      type="checkbox"
                      :checked="rewriteTicks.has(entry.id)"
                      class="h-4 w-4 rounded border-slate-300 text-rose-700 focus:ring-rose-300"
                      :title="rewriteTicks.has(entry.id)
                        ? 'Untick — exclude this rewrite when saving as a new contract version (Phase 3C)'
                        : 'Tick to accept — include this rewrite when saving as a new contract version (Phase 3C)'"
                      @change="toggleRewriteTick(entry.id)"
                    />
                    <span>{{ rewriteTicks.has(entry.id) ? 'Accepted' : 'Tick to accept' }}</span>
                  </label>
                </div>

                <!-- Side-by-side ORIGINAL ↔ REWRITTEN -->
                <div class="grid grid-cols-2 gap-3">
                  <!-- ORIGINAL column -->
                  <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">📄 Original (as extracted)</p>
                    <p class="text-[13px] text-slate-800 leading-relaxed">{{ entry.description }}</p>
                    <!-- r41 v412 — canonical Kai-Zen Glossary order:
                         Scale · Meter · Past · Status · Wish · Goal · Tolerable
                         (V + R entries). -->
                    <div v-if="entry.type === 'V' || entry.type === 'R'" class="text-[11px] text-slate-600 pt-1 space-y-0.5">
                      <p v-if="entry.scale"><span class="font-semibold">Scale:</span> {{ entry.scale }}</p>
                      <p v-if="entry.meter"><span class="font-semibold">Meter:</span> {{ entry.meter }}</p>
                      <p v-if="entry.past"><span class="font-semibold">Past:</span> {{ entry.past }}</p>
                      <p v-if="entry.status"><span class="font-semibold">Status:</span> {{ entry.status }}</p>
                      <p v-if="entry.wish"><span class="font-semibold">Wish:</span> {{ entry.wish }}</p>
                      <p v-if="entry.goal"><span class="font-semibold">Goal:</span> {{ entry.goal }}</p>
                      <p v-if="entry.tolerable"><span class="font-semibold">Tolerable:</span> {{ entry.tolerable }}</p>
                    </div>
                    <p v-if="entry.type === 'C' && entry.constraintText" class="text-[11px] text-slate-600 pt-1">
                      <span class="font-semibold">Binary Rule:</span> {{ entry.constraintText }}
                    </p>
                    <p v-if="entry.type === 'F' && entry.presenceTest" class="text-[11px] text-slate-600 pt-1">
                      <span class="font-semibold">Presence Test:</span> {{ entry.presenceTest }}
                    </p>
                    <p v-if="entry.rawSource" class="text-[10px] text-slate-400 italic pt-2 border-t border-slate-200/70">
                      ← {{ entry.rawSource.slice(0, 200) }}{{ entry.rawSource.length > 200 ? '…' : '' }}
                    </p>
                  </div>

                  <!-- REWRITTEN column -->
                  <div class="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-1">
                    <p class="text-[10px] font-bold text-rose-700 uppercase tracking-wider">✏️ Proposed Rewrite</p>
                    <p v-if="entry.rewrittenText" class="text-[13px] text-slate-800 leading-relaxed">
                      {{ entry.rewrittenText }}
                    </p>
                    <p v-else class="text-[11px] text-slate-400 italic">
                      (no rewrite generated for this entry — likely already met the chosen guideline)
                    </p>
                    <!-- Show the Contracts Mode config the rewrite ran under -->
                    <p class="text-[10px] text-rose-600/70 italic pt-2 border-t border-rose-200/70">
                      via Contracts Mode · presentation = <strong>{{ _contractsModeConfig.presentation }}</strong>
                      · standards = <strong>{{ _contractsModeConfig.standards.join(', ') || '(none)' }}</strong>
                    </p>
                  </div>
                </div>

                <!-- Change-log entries (if PURPOSE included 'change-log') -->
                <div v-if="entry.changes && entry.changes.length > 0" class="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                  <p class="text-[10px] font-bold text-amber-700 uppercase tracking-wider">📋 Change Log</p>
                  <ul class="space-y-1.5">
                    <li v-for="(ch, i) in entry.changes" :key="i" class="text-[11px] text-slate-700">
                      <p><span class="font-semibold text-rose-600">Before:</span> <span class="line-through">{{ ch.before }}</span></p>
                      <p><span class="font-semibold text-emerald-700">After:</span> {{ ch.after }}</p>
                      <p v-if="ch.rationale" class="text-slate-500 italic">— {{ ch.rationale }}</p>
                    </li>
                  </ul>
                </div>

                <!-- Standards violations the LLM flagged -->
                <div
                  v-if="entry.standardsViolations && entry.standardsViolations.length > 0"
                  class="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1"
                >
                  <p class="text-[10px] font-bold text-red-700 uppercase tracking-wider">⚠ Standards Violations Flagged</p>
                  <ul class="space-y-0.5 list-disc list-inside">
                    <li v-for="(sv, i) in entry.standardsViolations" :key="i" class="text-[11px] text-red-800">
                      <strong>{{ sv.standard }}:</strong> {{ sv.issue }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Phase-roadmap hint footer -->
            <p class="mt-6 text-center text-[10px] text-slate-400 italic max-w-xl mx-auto leading-relaxed">
              Phase 3A — read-only review with per-entry tick boxes.  Phase 3B (bulk Accept All / Accept All of Type / Accept Ticked / Reject All) + Phase 3C (Save as new contract version) + Phase 3D (compare-mode export) follow.
            </p>
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
              <p class="text-sm text-slate-500">Color-coded Planguage obligations table. Copy to paste into Keynote / Numbers, or Email to open a pre-filled draft in Mail.app.</p>
              <!-- Recipient address — required before emailing (DD-009: zero-training UI) -->
              <div class="flex flex-col gap-1">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wide">To: (recipient)</label>
                <input
                  v-model="emailTo"
                  type="email"
                  placeholder="recipient@example.com"
                  title="Type the recipient email address before clicking Email"
                  class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2
                         text-sm text-slate-800 placeholder-slate-400
                         focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
              </div>
              <!-- Copy + Email always together (Tom 2026-06-01) -->
              <div class="flex items-center gap-3 flex-wrap">
                <!-- Copy: large CopyGlyph [*]=[*] — Planguage native, teal family -->
                <button
                  type="button"
                  title="Copy [*]=[*] — duplicate as color-coded HTML table to clipboard · paste into Keynote, Numbers, or Mail"
                  class="inline-flex flex-col items-center gap-2 px-6 py-3 rounded-xl ring-1 shadow-sm transition-all"
                  :class="copiedExport
                    ? 'bg-emerald-50 text-emerald-600 ring-emerald-300'
                    : 'bg-white text-teal-600 ring-teal-300 hover:bg-teal-50 hover:text-teal-700 hover:ring-teal-400'"
                  @click="copyExport"
                >
                  <CopyGlyph size="large" aria-label="Copy — duplicate vessel contents" />
                  <span class="text-sm font-bold">{{ copiedExport ? '✓ Copied!' : 'Copy HTML Table' }}</span>
                </button>
                <!-- Email: large EmailGlyph [*]---→[*] — Planguage native, blue family -->
                <button
                  type="button"
                  title="Email [*]---→[*] — transmit as color-coded HTML table across the network · downloads .eml that opens in Mail.app as a ready-to-send draft"
                  class="inline-flex flex-col items-center gap-2 px-6 py-3 rounded-xl ring-1 shadow-sm transition-all"
                  :class="emailedExport
                    ? 'bg-emerald-50 text-emerald-600 ring-emerald-300'
                    : 'bg-white text-blue-600 ring-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-400'"
                  @click="emailExport"
                >
                  <EmailGlyph size="large" aria-label="Email — digital transmission to destination vessel" />
                  <span class="text-sm font-bold">{{ emailedExport ? '✓ Sent!' : 'Email Table' }}</span>
                </button>
              </div>
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
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @pointerdown="onImportBackdropDown"
            @pointerup="onImportBackdropUp"
          />
          <div
            class="relative z-[701] w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            @pointerdown="onImportContentDown"
          >
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
                  <!-- Scrollable entry list.
                       r41 v432 (Tom Gilb 2026-07-02 verbatim *"I fear the
                       contract library does not scroll its window"*) —
                       bumped from `max-h-44` (176px) → `max-h-80` (320px).
                       At 176px only ~5 entries fit before the 6th got
                       clipped behind the Upload row.  At 320px, the library
                       comfortably shows ~8 entries; ScrollContainer's
                       internal overflow-y-auto kicks in only when the user
                       has 9+ entries.  Composes with ScrollContainer SUPREME
                       (wrapper stays), MOVE Principle (all entries reachable
                       at-a-glance without hidden scroll), No-Silent-Removal
                       SUPREME (library entries never hidden without a
                       visible scroll cue). -->
                  <ScrollContainer outer-class="max-h-80" inner-class="divide-y divide-slate-100">
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
                  </ScrollContainer>

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

  <!-- r41 2026-06-20 (Phase 3.5A — Guidelines Library) — mounted at root so
       it teleports correctly above the Contracts agent surface.  Composes
       with Single-Surface rule (panel manages its own backdrop + Esc). -->
  <GuidelineLibraryPanel
    :open="guidelineLibraryOpen"
    :contract-id="selectedContract?.id ?? null"
    @close="guidelineLibraryOpen = false"
  />

  <!-- r41 2026-06-20 (Tom Gilb verbatim "we need to specify exactly which
       Reparse guidelines can be used, and give choice to select a different
       set of guidelines") — Re-parse Guidelines picker modal.  Opens
       BEFORE any Re-parse (per-clause or contract-level) so the planner
       sees exactly which rule set is about to drive the AI.  Composes
       with: DD-009 Zero-Training UI, MOVE Principle, No-Silent-Data-Loss
       SUPREME, CloseDot rule SUPREME (backdrop click + Esc close). -->
  <Teleport to="body">
    <template v-if="reparsePickerOpen && reparsePickerTarget && selectedContract">
      <!-- r41 v400 (Tom Gilb 2026-07-01 verbatim "reparse this clause is dead
           button") — Trace-Before-Patch SUPREME root cause: ContractHub's own
           full-screen surface teleports to body at z-[600], and the picker
           backdrop/dialog were at z-[490]/[491] — below ContractHub, so the
           picker mounted but painted underneath and never became visible or
           clickable.  Bumped to z-[701]/[702] so the picker sits ABOVE the
           ContractHub surface + all other in-hub overlays.  Composes with
           Trace-Before-Patch SUPREME (root-caused via z-index audit of the
           Teleport stack, not by patching the click handler), No-Silent-
           Removal SUPREME (picker still present, just visible now), MOVE
           Principle (the visible affordance actually works), Do-Not-
           Outsource-Investigation SUPREME (Claudian traced the DOM without
           asking Tom to DevTools). -->
      <div
        class="fixed inset-0 z-[701] bg-black/50"
        aria-hidden="true"
        @click="cancelReparsePicker"
      />
      <div
        class="fixed inset-0 z-[702] flex items-center justify-center px-4 py-6 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label="Re-parse — choose Guidelines"
      >
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-full flex flex-col pointer-events-auto">
          <!-- Header -->
          <div class="shrink-0 flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-amber-700 via-orange-700 to-rose-700 text-white rounded-t-2xl">
            <span class="text-base" aria-hidden="true">🔄</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-extrabold tracking-wide leading-tight">
                Re-parse — choose Guidelines
              </p>
              <p class="text-[11px] text-white/70 leading-tight">
                <template v-if="reparsePickerTarget.kind === 'clause'">
                  Target: ONE clause — {{ selectedContract.clauses.find(cl => cl.id === reparsePickerTarget!.clauseId)?.number ?? '?' }} · {{ (() => { const _cl = selectedContract.clauses.find(cl => cl.id === reparsePickerTarget!.clauseId); return _cl ? bestClauseHeading(_cl) : '' })() }}
                </template>
                <template v-else>
                  Target: ALL {{ selectedContract.clauses.length }} clauses · parallel batches of 5 · ~{{ Math.max(1, Math.ceil(selectedContract.clauses.length / 5) * 30 / 60) }} min
                </template>
              </p>
            </div>
            <CloseDot
              size="md"
              variant="on-dark"
              aria-label="Close Re-parse picker"
              @click="cancelReparsePicker"
            />
          </div>

          <!-- Body -->
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="px-5 py-4 space-y-4"
            inner-style="max-height: 60vh;"
            :no-pill="false"
          >
            <!-- Picker explanation -->
            <p class="text-[12px] text-slate-600 leading-relaxed">
              Pick the Guidelines that will drive this re-parse.  The currently-pinned set is pre-selected.  Tick or untick to change.
            </p>

            <!-- Currently-pinned section -->
            <div v-if="activeGuidelines.length > 0">
              <p class="text-[10px] font-bold uppercase tracking-wider text-rose-700 mb-1.5">🎯 Currently pinned to this contract</p>
              <ul class="space-y-1.5">
                <li
                  v-for="ag in activeGuidelines"
                  :key="ag.guideline.id"
                  class="flex items-start gap-2 px-3 py-2 rounded-lg border"
                  :class="reparsePickerSelectedIds.has(ag.guideline.id)
                    ? 'bg-rose-50 border-rose-300'
                    : 'bg-white border-slate-200 opacity-60'"
                >
                  <input
                    type="checkbox"
                    :checked="reparsePickerSelectedIds.has(ag.guideline.id)"
                    class="h-4 w-4 mt-0.5 rounded border-slate-300 text-rose-700 focus:ring-rose-300"
                    @change="toggleReparseGuideline(ag.guideline.id)"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-[12px] font-bold text-slate-800">
                      <span class="font-mono text-rose-700">{{ ag.guideline.tag }}.v{{ ag.pin.version }}</span>
                      <span class="text-slate-500 font-normal ml-2">{{ ag.guideline.title || ag.guideline.tag }}</span>
                    </p>
                    <p class="text-[10px] text-slate-500 italic mt-0.5">{{ ag.guideline.rules.filter(r => r.status === 'active').length }} active Rules · Source: {{ ag.guideline.source }}</p>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Other available Guidelines section -->
            <div>
              <p class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5">📚 Other available Guidelines (tick to ADD for this re-parse)</p>
              <ul class="space-y-1.5">
                <li
                  v-for="g in _guidelineLib.library.value.filter(x => !activeGuidelines.some(ag => ag.guideline.id === x.id))"
                  :key="g.id"
                  class="flex items-start gap-2 px-3 py-2 rounded-lg border"
                  :class="reparsePickerSelectedIds.has(g.id)
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-white border-slate-200'"
                >
                  <input
                    type="checkbox"
                    :checked="reparsePickerSelectedIds.has(g.id)"
                    class="h-4 w-4 mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-300"
                    @change="toggleReparseGuideline(g.id)"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-[12px] font-bold text-slate-800">
                      <span class="font-mono text-emerald-700">{{ g.tag }}.v{{ g.version }}</span>
                      <span class="text-slate-500 font-normal ml-2">{{ g.title || g.tag }}</span>
                    </p>
                    <p class="text-[10px] text-slate-500 italic mt-0.5">{{ g.rules.filter(r => r.status === 'active').length }} active Rules · {{ g.category }}</p>
                  </div>
                </li>
              </ul>
              <p v-if="_guidelineLib.library.value.filter(x => !activeGuidelines.some(ag => ag.guideline.id === x.id)).length === 0" class="text-[11px] text-slate-400 italic">
                Every Guideline in the library is already pinned to this contract.
              </p>
            </div>
          </ScrollContainer>

          <!-- Footer with action -->
          <div class="shrink-0 px-5 py-3 bg-slate-50 border-t border-slate-200 rounded-b-2xl">
            <div class="flex items-center gap-3 flex-wrap">
              <label class="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  v-model="reparsePickerSaveAsPinned"
                  class="h-3.5 w-3.5 rounded border-slate-300 text-rose-700 focus:ring-rose-300"
                />
                <span>Save selection as the new pinned set for this contract</span>
              </label>
              <span class="ml-auto text-[11px] text-slate-500 tabular-nums">
                {{ reparsePickerSelectedIds.size }} selected · {{ reparsePickerSummary.reduce((acc, g) => acc + g.rules.filter(r => r.status === 'active').length, 0) }} active Rules total
              </span>
            </div>
            <div class="flex items-center gap-2 mt-3 justify-end">
              <button
                type="button"
                class="px-4 py-1.5 rounded-lg text-[12px] font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                @click="cancelReparsePicker"
              >Cancel</button>
              <button
                type="button"
                :title="`Run re-parse with [${reparsePickerSummary.map(g => g.tag + '.v' + g.version).join(', ') || '(no Guidelines selected)'}]${reparsePickerSaveAsPinned ? ' · these will also be pinned to the contract' : ''}`"
                class="px-4 py-1.5 rounded-lg text-[12px] font-bold bg-rose-700 text-white hover:bg-rose-600 transition-colors"
                @click="confirmReparseWithGuidelines"
              >
                <span aria-hidden="true">🔄</span>
                <span class="ml-1">Run re-parse with selected Guidelines</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Teleport>

  <!-- r41 v437 — Contract Redraft Settings dialog.  Teleports to body from
       inside ContractRedraftSettings so it renders above ContractHub's
       z-[600] fixed overlay.
       r41 v441 — passes the redraft-candidate list so the dialog's Section 0
       picker can show all contracts with clauses; handles select-contract
       to switch the underlying selectedId. -->
  <ContractRedraftSettings
    :open="showRedraftSettings"
    :candidates="redraftCandidates"
    @close="showRedraftSettings = false"
    @generate="runContractRedraft"
    @select-contract="(id) => { selectedId = id }"
    @dump-diagnostic="dumpLocalStorageDiagnostic"
  />

  <!-- r41 v438 — Contract Redraft Result panel.  Renders the assembled
       ContractRedraftResult (Executive Summary + CHI + A1-A6 appendices +
       redrafted body). -->
  <!-- r41 v450 — pass current-selection identifiers so the panel can
       detect a stale result (result.contractId ≠ current selection) and
       render the amber "You are viewing an older redraft" banner with a
       "Run new redraft on <current>" CTA.  When Tom clicks the CTA the
       panel closes and the Settings dialog opens scoped to the current
       contract — the picker's Section 0 already surfaces the most-recent-
       analysed contract as the suggested default. -->
  <RedraftResultPanel
    :open="showRedraftResult"
    :result="redraftResult"
    :current-contract-id="selectedContract?.id"
    :current-contract-title="selectedContract?.title"
    :current-clause-count="selectedContract?.clauses.length"
    @close="showRedraftResult = false"
    @run-fresh-redraft="() => { showRedraftResult = false; showRedraftSettings = true }"
  />

  <!-- r41 v438 — In-progress banner while redraft runs.  Teleports to body
       so it appears above the settings dialog when the user fires the
       redraft.  Non-blocking: user can navigate; when the redraft finishes,
       the result panel takes over. -->
  <Teleport to="body">
    <!-- r41 v445 (Tom Gilb 2026-07-02 verbatim *"we need some early consolation
         of what it is doing for 40 seconds at zero. I like lots of rt
         feedback"*) — enriched progress banner.  Ticks every 1s even when
         no clause has returned yet, so the seconds counter always moves.
         Three-line layout: phase-aware primary line + counters + in-flight
         + ETA.

         r41 v448 (Tom Gilb 2026-07-02 verbatim *"the big active pin is
         blocking the title, there is plenty of space"*) — moved from
         top-4 (overlapped the header title) to bottom-4 (empty viewport
         space).  This banner is a STATUS INDICATOR not a control, so it
         is not bound by the Control-Pins-at-Top rule; bottom-center is
         the canonical status-banner slot (matches PageScrollPin bottom-
         centre after r41 v224).  Composes with MOVE Principle SUPREME
         (bottom-center is visible without covering content) + No-Silent-
         Removal SUPREME (still present, still animated, just relocated). -->
    <div
      v-if="isRedraftRunning"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[620] bg-indigo-800 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-start gap-3 min-w-[520px] max-w-[720px]"
      role="status"
      aria-live="polite"
      aria-label="Contract Redraft in progress"
    >
      <div class="shrink-0 w-4 h-4 mt-1 rounded-full border-2 border-white border-t-transparent animate-spin" aria-hidden="true" />
      <div class="flex-1 min-w-0">
        <!-- Primary phase-aware line -->
        <p class="text-xs font-bold">
          <template v-if="redraftProgress.phase === 'starting'">Contract Redraft — starting up…</template>
          <template v-else-if="redraftProgress.phase === 'running' && redraftProgress.clausesDone === 0">
            Sonnet processing — {{ redraftProgress.inFlightCount }} clause{{ redraftProgress.inFlightCount === 1 ? '' : 's' }} in flight — awaiting first response…
          </template>
          <template v-else-if="redraftProgress.phase === 'running'">
            Redrafting — {{ redraftProgress.clausesDone }} / {{ redraftProgress.clausesTotal }} clauses complete
          </template>
          <template v-else-if="redraftProgress.phase === 'finishing'">Assembling Contract Health Score + appendices…</template>
        </p>

        <!-- Counters line — always visible even when zero -->
        <p class="text-[10px] text-white/80 mt-0.5">
          <span class="tabular-nums font-semibold">{{ redraftProgress.elapsedSeconds }}s elapsed</span>
          <template v-if="redraftProgress.inFlightCount > 0">
            · <span class="text-amber-200">{{ redraftProgress.inFlightCount }} in flight</span><span v-if="redraftProgress.inFlightClauseNumbers.length > 0" class="text-white/60"> ({{ redraftProgress.inFlightClauseNumbers.slice(0, 5).join(', ') }})</span>
          </template>
          <template v-if="redraftProgress.correctionsSoFar > 0 || redraftProgress.remainingSoFar > 0">
            · <span class="text-emerald-200">{{ redraftProgress.correctionsSoFar }} corrections</span>
            · <span class="text-red-200">{{ redraftProgress.remainingSoFar }} remaining defects</span>
          </template>
        </p>

        <!-- Third line — ETA + reassurance for the first 45s black-hole window -->
        <p v-if="redraftProgress.estimatedRemainingSeconds > 0" class="text-[10px] text-white/70 mt-0.5">
          ~{{ redraftProgress.estimatedRemainingSeconds }}s remaining (avg {{ redraftProgress.averageClauseSeconds }}s per clause)
        </p>
        <p v-else-if="redraftProgress.phase === 'starting' || (redraftProgress.phase === 'running' && redraftProgress.clausesDone === 0)" class="text-[10px] text-white/70 mt-0.5">
          Sonnet typically takes 30-60s to return the first batch — the elapsed-time counter above proves the pipeline is alive.
        </p>
      </div>
      <div class="shrink-0 text-[11px] font-bold text-white/90 tabular-nums self-center">
        {{ redraftProgress.clausesTotal > 0 ? Math.round(redraftProgress.clausesDone / redraftProgress.clausesTotal * 100) : 0 }}%
      </div>
    </div>
  </Teleport>

  <!-- r41 v464 — PERSISTENT storage-quota-failure banner.  No-Silent-
       Data-Loss SUPREME: any localStorage save that failed (quota,
       serialisation, browser eviction) surfaces here + triggers an
       auto-Backup-to-Downloads.  Persistent — user MUST dismiss with
       an explicit click.  Composes with Trust-Rebuild framing (Tom's
       PACRM Solicitation was silently lost this way at 21:03 UTC). -->
  <Teleport to="body">
    <div
      v-if="saveFailureBanner"
      :class="[
        'fixed top-4 left-1/2 -translate-x-1/2 z-[625] rounded-lg shadow-2xl px-5 py-4 flex items-start gap-3 max-w-[720px] text-white',
        saveFailureBanner.durable ? 'bg-slate-700' : 'bg-red-800',
      ]"
      :role="saveFailureBanner.durable ? 'status' : 'alert'"
    >
      <span aria-hidden="true" class="text-xl mt-0.5">{{ saveFailureBanner.durable ? 'ℹ' : '⚠' }}</span>
      <div class="flex-1 leading-relaxed">
        <!-- v472 — SOFT copy when IndexedDB rescued the write (durable=true).
             HARD alarm copy only when both storage layers failed. -->
        <template v-if="saveFailureBanner.durable">
          <p class="font-bold text-sm">
            Fast-cache full — but your
            <template v-if="saveFailureBanner.source === 'guideline-library'">test-contract library entry</template>
            <template v-else>work</template>
            is safely stored on this Mac.
          </p>
          <p class="text-[11px] mt-1">
            <template v-if="saveFailureBanner.source === 'guideline-library'">
              Attempted to save {{ saveFailureBanner.contractsCount }} test-contract library entries ({{ Math.round(saveFailureBanner.totalBytes / 1024) }} KB).
            </template>
            <template v-else>
              Attempted to save {{ saveFailureBanner.contractsCount }} contracts ({{ Math.round(saveFailureBanner.totalBytes / 1024) }} KB).
            </template>
            The browser's small fast-cache (localStorage, ~5 MB) is full — but a durable copy just wrote successfully to the browser's larger on-disk store (IndexedDB, hundreds of GB on this Mac).  <strong>A browser refresh is safe.</strong>  This message is informational, not an emergency.
          </p>
          <p class="text-[11px] mt-2 opacity-90">
            To free the fast-cache: click <strong>🧹 Clean Up Storage</strong> at the top of Your Contracts and drop unused test contracts.  This will not affect the current contract.
          </p>
        </template>
        <template v-else>
          <p class="font-bold text-sm">
            Browser storage limit hit —
            <template v-if="saveFailureBanner.source === 'guideline-library'">your Save-to-Test-Contracts click may not survive a refresh.</template>
            <template v-else>your latest changes may not survive a refresh.</template>
          </p>
          <p class="text-[11px] mt-1">
            <template v-if="saveFailureBanner.reason === 'quota-exceeded'">
              <template v-if="saveFailureBanner.source === 'guideline-library'">
                Attempted to save {{ saveFailureBanner.contractsCount }} test-contract library entries ({{ Math.round(saveFailureBanner.totalBytes / 1024) }} KB) — <strong>QuotaExceededError</strong>.  Even IndexedDB may not have caught this write.  <strong>Click ⬇ Backup this Contract on your Navy contract now to preserve it to Downloads.</strong>
              </template>
              <template v-else>
                Attempted to save {{ saveFailureBanner.contractsCount }} contracts ({{ Math.round(saveFailureBanner.totalBytes / 1024) }} KB) — <strong>QuotaExceededError</strong>.
                <template v-if="saveFailureBanner.pruneSucceeded"> Automatic cleanup dropped the oldest contract(s) to make room; save now succeeded.  Your active work is safe on disk.</template>
                <template v-else> Even after aggressive cleanup the write failed.  <strong>Your active work is only in memory</strong> — a browser refresh will lose it.</template>
              </template>
            </template>
            <template v-else>{{ saveFailureBanner.errorMessage }}</template>
          </p>
          <p class="text-[11px] mt-2 font-semibold">
            <template v-if="saveFailureBanner.source === 'guideline-library'">
              For test-contract library saves the emergency-Backup path does not fire automatically (only for contract saves).  Manually click <strong>⬇ Backup this Contract</strong> on the contract you wanted to save as a test file.
            </template>
            <template v-else>
              Belt-and-braces: an emergency Backup file for your current contract has been auto-saved to <code>~/Downloads/</code> (filename starts with <code>sem-app-EMERGENCY-quota-backup-</code>).  If you also want to protect other contracts, click ⬇ Backup this Contract on each while you're viewing them.
            </template>
          </p>
        </template>
      </div>
      <button
        type="button"
        class="shrink-0 px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 text-[11px] font-bold"
        @click="onDismissSaveFailureBanner"
      >Dismiss</button>
    </div>
  </Teleport>

  <!-- r41 v466 — Clean-Up Storage confirmation toast. -->
  <Teleport to="body">
    <div
      v-if="cleanupFlash"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[623] bg-amber-700 text-white rounded-lg shadow-2xl px-4 py-3 flex items-start gap-3 max-w-[560px]"
      role="status"
    >
      <span aria-hidden="true" class="mt-0.5">🧹</span>
      <div class="flex-1 leading-relaxed">
        <p class="text-xs font-bold">
          <template v-if="(cleanupFlash.deletedZero + cleanupFlash.deletedDupe) === 0">
            Storage was already clean — nothing to delete.  {{ cleanupFlash.kept }} contract{{ cleanupFlash.kept === 1 ? '' : 's' }} kept.
          </template>
          <template v-else>
            Deleted {{ cleanupFlash.deletedZero }} zero-content + {{ cleanupFlash.deletedDupe }} older duplicate{{ cleanupFlash.deletedDupe === 1 ? '' : 's' }} · {{ cleanupFlash.kept }} contract{{ cleanupFlash.kept === 1 ? '' : 's' }} kept.
          </template>
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 px-2 py-0.5 rounded text-[11px] bg-white/20 hover:bg-white/30"
        @click="cleanupFlash = null"
      >Dismiss</button>
    </div>
  </Teleport>

  <!-- r41 v440 — Backup confirmation toast. -->
  <Teleport to="body">
    <div
      v-if="showBackupFlash"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[622] bg-emerald-700 text-white rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3 max-w-[540px]"
      role="status"
    >
      <span aria-hidden="true">✓</span>
      <p class="text-xs font-semibold">
        <!-- r41 v456 — plain business English (no Planguage jargon for
             the Navy-officer / contracts-professional audience). -->
        <template v-if="showBackupFlash === 'single'">Backup saved to ~/Downloads/ · Bring it back later via Import.</template>
        <template v-else-if="showBackupFlash === 'all'">ALL your contracts saved to ~/Downloads/ (one Backup file).</template>
        <template v-else-if="showBackupFlash === 'diagnostic'">Storage Report saved to ~/Downloads/ — send it to Claudian so we can trace what's really in your browser storage.</template>
        <template v-else>Download failed — full Backup on clipboard.  Paste into any text editor to save.</template>
      </p>
    </div>
  </Teleport>

  <!-- r41 v452 — Import Backup confirmation / error toast. -->
  <Teleport to="body">
    <div
      v-if="importFlash"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[622] rounded-lg shadow-2xl px-4 py-3 flex items-start gap-3 max-w-[640px]"
      :class="importFlash.kind === 'ok' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'"
      role="status"
    >
      <span aria-hidden="true" class="mt-0.5">{{ importFlash.kind === 'ok' ? '✓' : '⚠' }}</span>
      <p class="text-xs font-semibold flex-1 leading-relaxed">{{ importFlash.message }}</p>
      <button
        type="button"
        class="shrink-0 px-2 py-0.5 rounded text-[11px] bg-white/20 hover:bg-white/30"
        @click="importFlash = null"
      >Dismiss</button>
    </div>
  </Teleport>

  <!-- r41 v438 — Redraft error toast (non-blocking; auto-dismisses via
       user click or by starting a new redraft). -->
  <Teleport to="body">
    <div
      v-if="redraftErrorText && !isRedraftRunning"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[620] bg-red-700 text-white rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3 max-w-[540px]"
      role="alert"
    >
      <span aria-hidden="true">⚠</span>
      <p class="text-xs font-semibold flex-1">Redraft failed — {{ redraftErrorText }}</p>
      <button
        type="button"
        class="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/20 hover:bg-white/30"
        @click="redraftErrorText = ''"
      >Dismiss</button>
    </div>
  </Teleport>
</template>
