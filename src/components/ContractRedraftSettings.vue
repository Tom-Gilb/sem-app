<!-- UNIT_TYPE=Component -->
<!--
 * ContractRedraftSettings.vue — settings dialog for the Contract Redraft feature.
 *
 * Tom Gilb 2026-07-02: *"We need to start with the idea of Contract Redraft
 * Settings, default Settings. 1. Which Standards to Apply. 2. Which Policies
 * to Apply. 3. Which Structures To Apply."*
 *
 * Layout — vertical scroll of 7 sections:
 *   1. Standards (multi-check grouped by category)
 *   2. Policies (multi-check with underlying-rule HoverHints)
 *   3. Structure (radio: Current Redlined vs Planguage Restructured)
 *   4. Safety Locks (multi-check, defaults ON)
 *   5. Autonomy Level (radio)
 *   6. CHI Weights (expert-only slider row)
 *   7. Custom URLs (extend the standards list)
 *
 * Composes with:
 *   • ScrollContainer SUPREME (max-h-[80vh] with internal overflow-y-auto)
 *   • CloseDot SUPREME (all three affordances: header dot + backdrop + ESC)
 *   • MOVE Principle SUPREME (all options visible at-a-glance per section)
 *   • Icon-Plus-Text SUPREME (every action button + label + glyph)
 *   • Spell-out-Type-Names SUPREME (no abbreviations)
 *   • Universal Undo SUPREME (Reset to Defaults is one-click reversible)
 *   • DD-009 Zero-Training UI (every checkbox carries a plain-English HoverHint)
 *   • accessibility_tom.md (min 32px hit targets; text-sm minimum)
 -->
<script setup lang="ts">
import { computed } from 'vue'
import { useContractRedraft } from '../composables/useContractRedraft'
import { useBackdropHardening } from '../composables/useBackdropHardening'
import { useGraphmetrixCoupling } from '../composables/useGraphmetrixCoupling'
import { GRAPHMETRIX_NODE_LABELS } from '../types/graphmetrix'
import {
  REDRAFT_STANDARDS,
  REDRAFT_POLICIES,
  REDRAFT_SAFETY_LOCKS,
} from '../types/contractRedraft'
import type {
  StandardId,
  PolicyId,
  SafetyLockId,
  StructureOption,
  AutonomyLevel,
  ContractHealthDimensionId,
} from '../types/contractRedraft'
import CloseDot from './CloseDot.vue'

/**
 * r41 v441 (Tom Gilb 2026-07-02 verbatim *"I think that instead of this fail,
 * we should simply get a selection of files to redraft, and its title is
 * already there, the last one is most probable. Ill try to set it up but
 * this is annoying"*) — Section 0 contract picker.  Parent passes the
 * store's contracts list + which id is current + a select handler so the
 * user can switch contracts INSIDE the dialog without having to abort +
 * navigate + reopen.  Default selection: the currently-active contract if
 * it has clauses; else the most-recently-updated contract that has
 * clauses (best guess at "the last one Tom was working on").
 */
export interface RedraftCandidateContract {
  id:                string
  title:             string
  clauseCount:       number
  entryCount:        number
  updatedAt:         string
  /** r41 v442 — MAX of `lastParsedAt` across all clauses (from r41 v402).
   *  Empty string when the contract has never been analysed.  Used as the
   *  primary sort key so the "immediately last contract analysed" surfaces
   *  as the suggested default. */
  lastAnalysedAt:    string
  parseStatus:       string
  isCurrent:         boolean
}

const props = defineProps<{
  open:            boolean
  /** All contracts in the store (parent passes so this dialog stays a
   *  pure presentation component + easy to test).  When empty, the picker
   *  shows a friendly "no parsed contracts yet" message. */
  candidates:      RedraftCandidateContract[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'generate'): void   // r41 v438 — parent fires the actual redraft call
  /** r41 v441 — parent switches selectedContract to this id. */
  (e: 'select-contract', id: string): void
  /** r41 v443 — parent dumps sem-app localStorage to a JSON file for forensics. */
  (e: 'dump-diagnostic'): void
}>()

// r41 v467 — backdrop hardening.  Shared composable applied to prevent
// accidental modal close from cursor drift / drag / trackpad two-finger
// click landing in the 24px margin around the content.
const { onBackdropPointerDown, onBackdropPointerUp, onContentPointerDown } = useBackdropHardening(() => emit('close'))

// The IMMEDIATELY LAST CONTRACT ANALYSED — Tom Gilb 2026-07-02 v442 verbatim
// *"Picking the right one should be simplified by stating that the default
// is the immediately last contract analysed"*.  Primary sort key is
// `lastAnalysedAt` (max clause `lastParsedAt` — see ContractHub compute).
// Falls back to the currently-active contract when nothing has been analysed
// yet, so the dialog never shows an empty state.
const suggestedDefault = computed<RedraftCandidateContract | null>(() => {
  const analysed = props.candidates.filter(c => c.clauseCount > 0 && c.lastAnalysedAt)
  if (analysed.length > 0) {
    const sorted = [...analysed].sort((a, b) => (a.lastAnalysedAt < b.lastAnalysedAt ? 1 : -1))
    return sorted[0]
  }
  // No contract has ever been analysed — fall back to any with clauses
  const withClauses = props.candidates.filter(c => c.clauseCount > 0)
  if (withClauses.length > 0) return withClauses[0]
  return props.candidates.find(c => c.isCurrent) ?? null
})

const currentCandidate = computed<RedraftCandidateContract | null>(() =>
  props.candidates.find(c => c.isCurrent) ?? null,
)

const currentCanRedraft = computed<boolean>(() =>
  (currentCandidate.value?.clauseCount ?? 0) > 0,
)

// r41 v444 (Tom Gilb 2026-07-02 verbatim *"it is illogical to even offer a
// zero contract for rewriting"*) — filter zero-clause contracts out of the
// picker list.  They're kept in the parent's full `candidates` array (so
// the header still shows N total for context) but never rendered as
// selectable rows.  The empty-state fallback + amber warning banner still
// fire on top of this filter, so a user with a zero-clause current-selection
// still sees the WHY.
const redraftableCandidates = computed<RedraftCandidateContract[]>(() =>
  props.candidates.filter(c => c.clauseCount > 0),
)

const { settings, updateSettings, resetToDefaults } = useContractRedraft()

// r41 v459 (Tom Gilb 2026-07-02 verbatim *"can we do default standards
// setting are the last ones used. (and say so)"*) — persistence already
// works via useContractRedraft's _loadSettings/_saveSettings; the missing
// piece is EXPLICIT SURFACING at the top of the dialog so a Navy officer
// (audience) understands why the checkboxes are pre-populated.  Banner
// distinguishes shipped-default vs modified-by-user + names the
// timestamp + offers Reset-to-defaults inline.
const _stamp = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const day = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en-US', { month: 'short' })
  const yr  = d.getFullYear()
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${mon} ${yr} ${hh}:${mm}`
}

// True when the user has actually modified settings from the shipped
// defaults (updatedAt more than 1 minute after createdAt — the initial
// _saveSettings call on first load stamps both nearly-identically).
const settingsAreModified = computed<boolean>(() => {
  const s = settings.value
  const created = new Date(s.createdAt).getTime()
  const updated = new Date(s.updatedAt).getTime()
  return isFinite(created) && isFinite(updated) && (updated - created) > 60_000
})

const settingsLastUsedLabel = computed<string>(() => _stamp(settings.value.updatedAt))

// Which selected standards/policies to name in the banner subtitle so
// the officer sees at-a-glance what will be applied without expanding
// sections 1 + 2.
const activeStandardsSummary = computed<string>(() => {
  const s = settings.value
  const stds = (s.standards ?? []).length
  const pols = (s.policies ?? []).length
  const locks = (s.safetyLocks ?? []).length
  const parts = []
  parts.push(`${stds} standard${stds === 1 ? '' : 's'}`)
  parts.push(`${pols} polic${pols === 1 ? 'y' : 'ies'}`)
  parts.push(`${locks} safety lock${locks === 1 ? '' : 's'}`)
  parts.push(`autonomy: ${s.autonomy}`)
  return parts.join(' · ')
})

// r41 v437a — Graphmetrix TrinityX coupling settings + reference count.
const graphmetrix = useGraphmetrixCoupling()

function toggleGraphmetrixEnabled(): void {
  graphmetrix.updateSettings({ enabled: !graphmetrix.settings.value.enabled })
}
function setGraphmetrixInstanceUrl(url: string): void {
  graphmetrix.updateSettings({ instanceUrl: url.trim() })
}
function toggleGraphmetrixIncludeInRedraft(): void {
  graphmetrix.updateSettings({ includeInRedraft: !graphmetrix.settings.value.includeInRedraft })
}
function toggleGraphmetrixIncludeInAppendix(): void {
  graphmetrix.updateSettings({ includeInAppendixA3: !graphmetrix.settings.value.includeInAppendixA3 })
}
function toggleGraphmetrixAutoSuggest(): void {
  graphmetrix.updateSettings({ autoSuggestOnParse: !graphmetrix.settings.value.autoSuggestOnParse })
}
function setGraphmetrixAutoAccept(value: number): void {
  graphmetrix.updateSettings({ autoAcceptConfidence: Math.max(0, Math.min(100, value)) })
}
const graphmetrixNodeBreakdown = computed(() => graphmetrix.countByNodeType())
const graphmetrixTotalReferences = computed(() => graphmetrix.references.value.length)

// ── Standards grouped by category for the UI ─────────────────────────────────

const standardsByCategory = computed(() => {
  const groups: Record<string, typeof REDRAFT_STANDARDS> = {}
  for (const s of REDRAFT_STANDARDS) {
    if (!groups[s.category]) groups[s.category] = []
    groups[s.category].push(s)
  }
  return groups
})

const CATEGORY_LABELS: Record<string, string> = {
  'style':         'Drafting Style',
  'us-federal':    'US Federal',
  'us-dod':        'US Department of Defense',
  'us-navy':       'US Navy',
  'international': 'International',
  'professional':  'Professional Bodies',
  'custom':        'Custom',
}

// ── Toggle helpers ───────────────────────────────────────────────────────────

function toggleStandard(id: StandardId): void {
  const current = settings.value.standards
  const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
  updateSettings({ standards: next })
}

function toggleP(id: PolicyId): void {
  const current = settings.value.policies
  const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
  updateSettings({ policies: next })
}

function toggleLock(id: SafetyLockId): void {
  const current = settings.value.safetyLocks
  const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
  updateSettings({ safetyLocks: next })
}

function setStructure(id: StructureOption): void {
  updateSettings({ structure: id })
}

function setAutonomy(id: AutonomyLevel): void {
  updateSettings({ autonomy: id })
}

function setChiWeight(dim: ContractHealthDimensionId, value: number): void {
  const next = { ...settings.value.chiWeights, [dim]: value }
  updateSettings({ chiWeights: next })
}

const chiTotal = computed(() => {
  const w = settings.value.chiWeights
  return Object.values(w).reduce((s, v) => s + v, 0)
})

// ── Custom standards URL ─────────────────────────────────────────────────────

function addCustomStandardUrl(url: string): void {
  const trimmed = url.trim()
  if (!trimmed) return
  const next = [...settings.value.customStandardsUrls, trimmed]
  updateSettings({ customStandardsUrls: next })
}

function removeCustomStandardUrl(url: string): void {
  const next = settings.value.customStandardsUrls.filter(u => u !== url)
  updateSettings({ customStandardsUrls: next })
}

// ── ESC handler ───────────────────────────────────────────────────────────────

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && props.open) emit('close')
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[610] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Contract Redraft Settings"
    >
      <!-- Backdrop — r41 v467 hardened: requires pointerdown+pointerup
           BOTH on backdrop; drag from content won't close. -->
      <div
        class="fixed inset-0 bg-black/40 backdrop-blur-sm"
        @pointerdown="onBackdropPointerDown"
        @pointerup="onBackdropPointerUp"
      />

      <!-- Modal panel -->
      <div
        class="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        @pointerdown="onContentPointerDown"
      >
        <!-- Header -->
        <div class="shrink-0 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 text-white">
          <div class="shrink-0 w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg" aria-hidden="true">
            <span class="font-mono font-bold text-sm">⟲</span>
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-bold tracking-wide">Contract Redraft Settings</h2>
            <p class="text-xs text-white/70">Choose which standards, policies, and structure to apply — plus safety locks and autonomy level.</p>
          </div>
          <CloseDot
            variant="on-dark"
            size="lg"
            title="Close Contract Redraft Settings"
            ariaLabel="Close settings"
            @click="emit('close')"
          />
        </div>

        <!-- r41 v459 (Tom Gilb 2026-07-02 verbatim *"can we do default
             standards setting are the last ones used. (and say so)"*) —
             explicit last-used banner.  Persistence already works via
             _loadSettings; this section SAYS SO to the audience (Navy
             officer) so they understand why the checkboxes are pre-
             populated + can Reset in one click if they want a fresh
             start.  Composes with:
             • DD-009 Zero-Training UI SUPREME (state is named, not
               guessed)
             • No-Silent-Data-Loss SUPREME (persistence is loud, not
               silent)
             • MOVE Principle SUPREME (Reset visible at-a-glance, no
               menu-dive)
             • Universal Undo SUPREME (Reset is one click, reversible
               by re-selecting)
             • Audience-Declaration (Navy officer sees exactly what will
               be applied without expanding sections 1 + 2 first)
             Two variants: modified (uses "Last used" language +
             timestamp + Reset button); shipped-default (uses "First
             time — showing the shipped defaults" language). -->
        <div
          class="shrink-0 mx-6 mt-3 -mb-2 px-4 py-3 rounded-lg flex items-start gap-3"
          :class="settingsAreModified
            ? 'bg-indigo-50 border border-indigo-200 text-indigo-900'
            : 'bg-slate-50 border border-slate-200 text-slate-700'"
        >
          <span aria-hidden="true" class="text-lg leading-none mt-0.5">{{ settingsAreModified ? '↻' : '✱' }}</span>
          <div class="flex-1 min-w-0 leading-snug">
            <p class="text-[12px] font-bold">
              <template v-if="settingsAreModified">Showing your last-used settings — from {{ settingsLastUsedLabel }}.</template>
              <template v-else>First time on this machine — showing the shipped defaults.</template>
            </p>
            <p class="text-[11px] mt-0.5"
               :class="settingsAreModified ? 'text-indigo-700' : 'text-slate-500'">
              {{ activeStandardsSummary }}<span v-if="settingsAreModified"> · Adjust below or press Reset to start fresh.</span><span v-else> · Adjust below to fit this contract.</span>
            </p>
          </div>
          <button
            v-if="settingsAreModified"
            type="button"
            class="shrink-0 px-2.5 py-1 rounded-lg bg-white border border-indigo-300 hover:bg-indigo-100 text-indigo-800 text-[11px] font-bold"
            title="Reset all settings to the shipped defaults.  Universal Undo compatible — you can re-select your prior choices if you change your mind."
            @click="resetToDefaults"
          >Reset to defaults</button>
        </div>

        <!-- Scrollable body.  r41 v439 — switched from <ScrollContainer> to
             raw overflow-y-auto per the ScrollContainer SUPREME rule's
             "centered-card + Teleport + multiple shrink-0 siblings" edge
             case (Tom Gilb 2026-07-02 verbatim *"tried new rewrite contract
             button, it had none in it said, but the title was indianapolis"*
             — settings body rendered blank because ScrollContainer's
             auto-h-full failed to engage inside the flex-col centered
             modal with two shrink-0 siblings).  Raw pattern is the
             SUPREME-approved fallback for this specific layout. -->
        <div class="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-8">

          <!-- 0 · CONTRACT PICKER — Tom Gilb 2026-07-02 v441.
               Section 0 (top of dialog) — pick which contract to redraft.
               Prevents the "click Generate Redraft → error: no clauses"
               friction Tom flagged.  Lists all contracts with clauses,
               most-recent first.  Current selection is highlighted. -->
          <section aria-labelledby="rd-picker-heading">
            <div class="flex items-baseline justify-between mb-3 gap-3">
              <h3 id="rd-picker-heading" class="text-sm font-bold text-slate-800">Which Contract to Redraft</h3>
              <span class="text-[10px] text-slate-400 ml-auto">{{ redraftableCandidates.length }} redraftable</span>
              <!-- r41 v443 — Diagnostic dump button.  Downloads every
                   sem-app-owned localStorage key + value to a JSON file so
                   we can inspect whether entries are truly gone or just
                   miscounted.  For forensic recovery + bug reports. -->
              <button
                type="button"
                class="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-300"
                title="⚠ DIAGNOSTIC — downloads every sem-app localStorage key + raw value to a JSON file (with byte sizes and parse errors).  Use this if entry counts look wrong, so we can inspect what's actually stored.  Filename: sem-app-localStorage-DIAGNOSTIC-<timestamp>.json in ~/Downloads/"
                @click="emit('dump-diagnostic')"
              >
                <span aria-hidden="true">⬇</span>
                <span>Dump raw localStorage</span>
              </button>
            </div>

            <!-- Warning banner when the currently-selected contract has no clauses -->
            <div
              v-if="!currentCanRedraft && candidates.length > 0"
              class="mb-3 p-3 rounded-lg bg-amber-50 border-l-4 border-amber-500"
            >
              <p class="text-[11px] text-amber-900 font-semibold">
                ⚠ The currently-active contract has no parsed clauses — the redraft needs a parsed contract to work from.
              </p>
              <p class="text-[10px] text-amber-800 mt-1">
                Below are all contracts in your store that have parsed clauses.
                <span v-if="suggestedDefault">
                  The immediately last contract analysed — <strong>{{ suggestedDefault.title }}</strong>
                  ({{ suggestedDefault.clauseCount }} clauses · {{ suggestedDefault.entryCount }} Planguage entries) —
                  is the recommended pick.
                </span>
                Click any row to switch to that contract, then click Generate Redraft.
              </p>
            </div>

            <!-- Suggested-default hint even when the current contract IS redraftable, so
                 the "immediately last contract analysed" rule is always transparent. -->
            <div
              v-else-if="currentCanRedraft && suggestedDefault && suggestedDefault.id !== currentCandidate?.id"
              class="mb-3 p-3 rounded-lg bg-indigo-50 border-l-4 border-indigo-400"
            >
              <p class="text-[10px] text-indigo-800">
                ℹ The immediately last contract analysed is <strong>{{ suggestedDefault.title }}</strong>
                (not the currently-selected one).  Click its row below to switch, or continue with the current selection.
              </p>
            </div>

            <!-- Empty state — no contracts have clauses at all -->
            <div
              v-if="candidates.length === 0 || candidates.every(c => c.clauseCount === 0)"
              class="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center"
            >
              <p class="text-xs text-slate-600">
                No parsed contracts yet.
                <br />
                <span class="text-[10px] text-slate-500">Import a contract first, run parse, then come back to redraft.</span>
              </p>
            </div>

            <!-- Contract list — only redraftable rows shown (v444). -->
            <div v-else class="space-y-1.5">
              <label
                v-for="c in redraftableCandidates"
                :key="c.id"
                class="flex items-start gap-3 cursor-pointer p-2.5 rounded-lg border transition-colors"
                :class="c.isCurrent
                  ? 'border-indigo-500 bg-indigo-50'
                  : (c.id === suggestedDefault?.id ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 hover:border-slate-300')"
              >
                <input
                  type="radio"
                  name="rd-contract-picker"
                  :checked="c.isCurrent"
                  class="mt-1 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  @change="emit('select-contract', c.id)"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold text-slate-800 truncate">{{ c.title || '(untitled contract)' }}</p>
                  <p class="text-[10px] text-slate-500 mt-0.5">
                    <span class="text-emerald-700 font-semibold">
                      {{ c.clauseCount }} clause{{ c.clauseCount === 1 ? '' : 's' }}
                    </span>
                    · {{ c.entryCount }} Planguage {{ c.entryCount === 1 ? 'entry' : 'entries' }}
                    · {{ c.parseStatus }}
                    <span v-if="c.lastAnalysedAt" class="text-emerald-700 font-semibold"> · analysed {{ c.lastAnalysedAt.slice(0, 16).replace('T', ' ') }}</span>
                  </p>
                </div>
                <!-- r41 v442 — suggested-default badge FIRST, then current badge (they can co-occur) -->
                <span
                  v-if="c.id === suggestedDefault?.id"
                  class="shrink-0 self-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white whitespace-nowrap"
                  title="Suggested default — this is the immediately last contract analysed"
                >LAST ANALYSED</span>
                <span
                  v-if="c.isCurrent"
                  class="shrink-0 self-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white"
                >CURRENT</span>
              </label>
            </div>
          </section>

          <!-- 1 · STANDARDS -->
          <section aria-labelledby="rd-standards-heading">
            <div class="flex items-baseline justify-between mb-3">
              <h3 id="rd-standards-heading" class="text-sm font-bold text-slate-800">1 · Which Standards to Apply</h3>
              <span class="text-[10px] text-slate-400">{{ settings.standards.length }} selected</span>
            </div>
            <p class="text-[11px] text-slate-500 mb-3">Public, externally-cited authorities.  Every selected standard's rules feed the redraft prompt AND get cited in Appendix A5 (Corrections).</p>
            <div v-for="(list, cat) in standardsByCategory" :key="cat" class="mb-4">
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{{ CATEGORY_LABELS[cat] ?? cat }}</p>
              <div class="space-y-1.5">
                <label
                  v-for="s in list"
                  :key="s.id"
                  class="flex items-start gap-2.5 cursor-pointer group"
                  :title="s.authorityUrl ? `Standard authority: ${s.authorityUrl}` : `Standard: ${s.label}`"
                >
                  <input
                    type="checkbox"
                    :checked="settings.standards.includes(s.id)"
                    class="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    @change="toggleStandard(s.id)"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-xs font-semibold text-slate-800 group-hover:text-teal-700">{{ s.label }}</p>
                    <p v-if="s.authorityUrl" class="text-[10px] text-slate-500 truncate">{{ s.authorityUrl }}</p>
                  </div>
                </label>
              </div>
            </div>
          </section>

          <!-- 2 · POLICIES -->
          <section aria-labelledby="rd-policies-heading">
            <div class="flex items-baseline justify-between mb-3">
              <h3 id="rd-policies-heading" class="text-sm font-bold text-slate-800">2 · Which Policies to Apply</h3>
              <span class="text-[10px] text-slate-400">{{ settings.policies.length }} selected</span>
            </div>
            <p class="text-[11px] text-slate-500 mb-3">Organisational rules — softer than external standards.  Every selected policy is a Planguage-precision assertion applied during redraft.</p>
            <div class="space-y-1.5">
              <label
                v-for="p in REDRAFT_POLICIES"
                :key="p.id"
                class="flex items-start gap-2.5 cursor-pointer group"
                :title="p.underlyingRule ? `Underlying SUPREME rule: ${p.underlyingRule}` : `Policy: ${p.label}`"
              >
                <input
                  type="checkbox"
                  :checked="settings.policies.includes(p.id)"
                  class="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  @change="toggleP(p.id)"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-semibold text-slate-800 group-hover:text-teal-700">{{ p.label }}</p>
                  <p v-if="p.underlyingRule" class="text-[10px] text-slate-500">↳ {{ p.underlyingRule }}</p>
                </div>
              </label>
            </div>
          </section>

          <!-- 3 · STRUCTURE -->
          <section aria-labelledby="rd-structure-heading">
            <h3 id="rd-structure-heading" class="text-sm font-bold text-slate-800 mb-3">3 · Which Structure to Apply</h3>
            <div class="space-y-2">
              <label
                class="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors"
                :class="settings.structure === 'current-redlined' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'"
              >
                <input
                  type="radio"
                  name="rd-structure"
                  :checked="settings.structure === 'current-redlined'"
                  class="mt-1 h-4 w-4 border-slate-300 text-teal-600 focus:ring-teal-500"
                  @change="setStructure('current-redlined')"
                />
                <div>
                  <p class="text-sm font-semibold text-slate-800">Current Structure (Redlined)</p>
                  <p class="text-xs text-slate-600 mt-1">Mirror the original clause order + content.  Insert corrections inline as redlines (strikethrough old, insert new).  Familiar to any legal reviewer.  Best for amendment review.</p>
                </div>
              </label>
              <label
                class="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors"
                :class="settings.structure === 'planguage-restructured' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'"
              >
                <input
                  type="radio"
                  name="rd-structure"
                  :checked="settings.structure === 'planguage-restructured'"
                  class="mt-1 h-4 w-4 border-slate-300 text-teal-600 focus:ring-teal-500"
                  @change="setStructure('planguage-restructured')"
                />
                <div>
                  <p class="text-sm font-semibold text-slate-800">Planguage Structure (Restructured)</p>
                  <p class="text-xs text-slate-600 mt-1">Body mirrors original sequence but every clause is numbered AND tagged with a Mnemonic Tag; capitalised terms rendered in Planguage Mnemonic style.  Appendices A1-A6 appended (Terminology Glossary · Policies · Related Documents · Contract Quality Summary · Corrections · Remaining Defects).</p>
                </div>
              </label>
            </div>
          </section>

          <!-- 4 · SAFETY LOCKS -->
          <section aria-labelledby="rd-safety-heading">
            <div class="flex items-baseline justify-between mb-3">
              <h3 id="rd-safety-heading" class="text-sm font-bold text-slate-800">4 · What NOT to Change (Safety Locks)</h3>
              <span class="text-[10px] text-slate-400">{{ settings.safetyLocks.length }} of {{ REDRAFT_SAFETY_LOCKS.length }} engaged</span>
            </div>
            <p class="text-[11px] text-slate-500 mb-3">Redraft-forbidden zones.  Every lock generates a hard constraint in the AI prompt; violations trigger a reject in the pipeline.  All defaults ON.</p>
            <div class="space-y-1.5">
              <label
                v-for="lock in REDRAFT_SAFETY_LOCKS"
                :key="lock.id"
                class="flex items-start gap-2.5 cursor-pointer group"
                :title="lock.hoverHint"
              >
                <input
                  type="checkbox"
                  :checked="settings.safetyLocks.includes(lock.id)"
                  class="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  @change="toggleLock(lock.id)"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-semibold text-slate-800 group-hover:text-red-700">🔒 {{ lock.label }}</p>
                  <p class="text-[10px] text-slate-500">{{ lock.hoverHint }}</p>
                </div>
              </label>
            </div>
          </section>

          <!-- 5 · AUTONOMY LEVEL -->
          <section aria-labelledby="rd-autonomy-heading">
            <h3 id="rd-autonomy-heading" class="text-sm font-bold text-slate-800 mb-3">5 · Autonomy Level</h3>
            <div class="space-y-2">
              <label
                v-for="level in [
                  { id: 'advisory' as const,     title: 'Advisory',      blurb: 'Flag defects + suggest corrections.  No rewrite.  Legal reviews and applies manually.' },
                  { id: 'suggested' as const,    title: 'Suggested',     blurb: 'Rewrites proposed inline; user accepts / rejects per correction.  Default.' },
                  { id: 'full-redraft' as const, title: 'Full Redraft',  blurb: 'Apply all suggested corrections + generate the full A1-A6 appendix.  Human approves the whole artefact.' },
                ]"
                :key="level.id"
                class="flex items-start gap-3 cursor-pointer p-2.5 rounded-lg border transition-colors"
                :class="settings.autonomy === level.id ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'"
              >
                <input
                  type="radio"
                  name="rd-autonomy"
                  :checked="settings.autonomy === level.id"
                  class="mt-1 h-4 w-4 border-slate-300 text-teal-600 focus:ring-teal-500"
                  @change="setAutonomy(level.id)"
                />
                <div>
                  <p class="text-xs font-semibold text-slate-800">{{ level.title }}</p>
                  <p class="text-[11px] text-slate-600">{{ level.blurb }}</p>
                </div>
              </label>
            </div>
          </section>

          <!-- 6 · CHI WEIGHTS -->
          <section aria-labelledby="rd-chi-heading">
            <div class="flex items-baseline justify-between mb-3">
              <h3 id="rd-chi-heading" class="text-sm font-bold text-slate-800">6 · Contract Health Score — Weights</h3>
              <span
                class="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full"
                :class="chiTotal === 100 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'"
              >Total: {{ chiTotal }} / 100</span>
            </div>
            <p class="text-[11px] text-slate-500 mb-3">Advanced — rebalances the Contract Health Score 0-100.  Six dimensions, sum should be 100.  Non-experts leave the defaults alone.</p>
            <div class="space-y-2">
              <div
                v-for="dim in [
                  { id: 'precision' as const,               label: 'Precision (Presence Tests)' },
                  { id: 'measurement' as const,             label: 'Measurement (Scale + Target)' },
                  { id: 'stakeholder-coverage' as const,    label: 'Stakeholder Coverage' },
                  { id: 'bounded-scope' as const,           label: 'Bounded Scope (Anti-Infinity-Trap)' },
                  { id: 'standards-conformance' as const,   label: 'Standards Conformance' },
                  { id: 'structural-completeness' as const, label: 'Structural Completeness' },
                ]"
                :key="dim.id"
                class="flex items-center gap-3"
              >
                <label class="text-[11px] font-semibold text-slate-700 flex-1 min-w-0">{{ dim.label }}</label>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  :value="settings.chiWeights[dim.id]"
                  class="w-32"
                  @input="setChiWeight(dim.id, parseInt(($event.target as HTMLInputElement).value, 10))"
                />
                <span class="text-[11px] font-bold text-slate-700 tabular-nums w-8 text-right">{{ settings.chiWeights[dim.id] }}</span>
              </div>
            </div>
          </section>

          <!-- 7 · CUSTOM URLS -->
          <section aria-labelledby="rd-custom-heading">
            <h3 id="rd-custom-heading" class="text-sm font-bold text-slate-800 mb-3">7 · Custom Standards URLs</h3>
            <p class="text-[11px] text-slate-500 mb-3">Add your own standards / policies / playbooks by URL.  Every URL gets cited in Appendix A5 alongside the built-in standards.</p>
            <div class="space-y-2">
              <div v-for="url in settings.customStandardsUrls" :key="url" class="flex items-center gap-2">
                <span class="flex-1 min-w-0 text-xs text-slate-700 truncate">{{ url }}</span>
                <button
                  type="button"
                  class="shrink-0 text-[10px] text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded"
                  title="Remove this custom standard URL"
                  @click="removeCustomStandardUrl(url)"
                >
                  Remove
                </button>
              </div>
              <div class="flex items-center gap-2 pt-1">
                <input
                  type="url"
                  placeholder="https://your-org.example/contracting-standards.pdf"
                  class="flex-1 min-w-0 text-xs px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-400"
                  @keydown.enter.prevent="e => { addCustomStandardUrl((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = '' }"
                />
                <button
                  type="button"
                  class="shrink-0 px-3 py-1.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                  title="Add this URL to the custom standards list — press Enter or click"
                  @click="(e) => {
                    const input = (e.target as HTMLElement).closest('div')?.querySelector('input[type=url]') as HTMLInputElement | null
                    if (input) { addCustomStandardUrl(input.value); input.value = '' }
                  }"
                >
                  Add URL
                </button>
              </div>
            </div>
          </section>

          <!-- 8 · GRAPHMETRIX TRINITYX COUPLING -->
          <section aria-labelledby="rd-graphmetrix-heading">
            <div class="flex items-baseline justify-between mb-3">
              <h3 id="rd-graphmetrix-heading" class="text-sm font-bold text-slate-800">8 · Graphmetrix TrinityX Coupling</h3>
              <span class="text-[10px] text-slate-400">{{ graphmetrixTotalReferences }} link{{ graphmetrixTotalReferences === 1 ? '' : 's' }}</span>
            </div>
            <p class="text-[11px] text-slate-500 mb-3">Couple Contract entries to live technical drawings, specifications, P&amp;IDs, 3D models, ontology concepts, and other engineering artefacts hosted in a Graphmetrix TrinityX graph platform.  Every linked artefact appears as a clickable badge in the redraft body and is listed in Appendix A3.  US Navy pilots use Graphmetrix widely — enable this to align contract deliverables with the digital twin of the actual system of concern.</p>

            <!-- Master switch -->
            <label
              class="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 mb-3 transition-colors"
              :class="graphmetrix.settings.value.enabled ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'"
            >
              <input
                type="checkbox"
                :checked="graphmetrix.settings.value.enabled"
                class="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                @change="toggleGraphmetrixEnabled"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-800">Enable Graphmetrix Coupling</p>
                <p class="text-[11px] text-slate-600 mt-1">Master switch.  When off, all references remain in storage but no coupling logic runs and no badges surface in the redraft output.</p>
              </div>
            </label>

            <!-- Instance URL -->
            <div class="mb-3">
              <label class="block text-[11px] font-semibold text-slate-700 mb-1">Graphmetrix Instance URL</label>
              <input
                type="url"
                :value="graphmetrix.settings.value.instanceUrl"
                :disabled="!graphmetrix.settings.value.enabled"
                class="w-full text-xs px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="https://graphmetrix.com"
                @change="setGraphmetrixInstanceUrl(($event.target as HTMLInputElement).value)"
              />
              <p class="text-[10px] text-slate-500 mt-1">Default: <code>https://graphmetrix.com</code>.  Override for private customer / Navy-program instances.</p>
            </div>

            <!-- Behaviour toggles -->
            <div class="space-y-1.5">
              <label
                class="flex items-start gap-2.5 cursor-pointer group"
                :title="'When ON, every Contract entry with linked Graphmetrix references renders those references as clickable badges in the redraft body itself (not just in Appendix A3).'"
              >
                <input
                  type="checkbox"
                  :checked="graphmetrix.settings.value.includeInRedraft"
                  :disabled="!graphmetrix.settings.value.enabled"
                  class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  @change="toggleGraphmetrixIncludeInRedraft"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-semibold text-slate-800 group-hover:text-indigo-700" :class="{'opacity-50': !graphmetrix.settings.value.enabled}">Embed Graphmetrix badges inline in the redraft body</p>
                  <p class="text-[10px] text-slate-500">Every linked drawing / spec / P&amp;ID renders as a clickable chip next to the clause that references it.</p>
                </div>
              </label>

              <label
                class="flex items-start gap-2.5 cursor-pointer group"
                :title="'When ON, every Graphmetrix-linked artefact appears in Appendix A3 (Related Documents) with URI + node type + revision.'"
              >
                <input
                  type="checkbox"
                  :checked="graphmetrix.settings.value.includeInAppendixA3"
                  :disabled="!graphmetrix.settings.value.enabled"
                  class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  @change="toggleGraphmetrixIncludeInAppendix"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-semibold text-slate-800 group-hover:text-indigo-700" :class="{'opacity-50': !graphmetrix.settings.value.enabled}">List Graphmetrix references in Appendix A3 (Related Documents)</p>
                  <p class="text-[10px] text-slate-500">A3 becomes the machine-readable index of every linked artefact — the primary artefact for legal + engineering cross-reference.</p>
                </div>
              </label>

              <label
                class="flex items-start gap-2.5 cursor-pointer group"
                :title="'Phase 2 feature — Sonnet identifies references to drawings / specs in the clause text and queries the Graphmetrix instance for matching nodes.  Off by default because it requires API reachability.'"
              >
                <input
                  type="checkbox"
                  :checked="graphmetrix.settings.value.autoSuggestOnParse"
                  :disabled="!graphmetrix.settings.value.enabled"
                  class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  @change="toggleGraphmetrixAutoSuggest"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-semibold text-slate-800 group-hover:text-indigo-700" :class="{'opacity-50': !graphmetrix.settings.value.enabled}">Auto-suggest links during parse <span class="text-[9px] font-normal text-amber-600">Phase 2</span></p>
                  <p class="text-[10px] text-slate-500">AI identifies "the drawings" / "Schedule A" / spec references and queries Graphmetrix for candidate nodes.  Requires API reachability.</p>
                </div>
              </label>
            </div>

            <!-- Auto-accept confidence slider -->
            <div v-if="graphmetrix.settings.value.enabled && graphmetrix.settings.value.autoSuggestOnParse" class="mt-3 pt-3 border-t border-slate-100">
              <label class="block text-[11px] font-semibold text-slate-700 mb-1">Auto-accept threshold: {{ graphmetrix.settings.value.autoAcceptConfidence }}%</label>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                :value="graphmetrix.settings.value.autoAcceptConfidence"
                class="w-full"
                @input="setGraphmetrixAutoAccept(parseInt(($event.target as HTMLInputElement).value, 10))"
              />
              <p class="text-[10px] text-slate-500 mt-1">AI-suggested links with confidence ≥ threshold auto-accept.  Below threshold, links queue for review before being applied.</p>
            </div>

            <!-- Node-type breakdown (only shown when there are references) -->
            <div v-if="graphmetrixTotalReferences > 0" class="mt-4 pt-3 border-t border-slate-100">
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Current Coupling Breakdown</p>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(count, nodeType) in graphmetrixNodeBreakdown"
                  :key="nodeType"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200"
                >
                  <span>{{ GRAPHMETRIX_NODE_LABELS[nodeType] ?? nodeType }}</span>
                  <span class="tabular-nums font-bold">{{ count }}</span>
                </span>
              </div>
            </div>
          </section>

        </div>

        <!-- Footer -->
        <div class="shrink-0 flex items-center gap-3 px-6 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
            title="Reset all Contract Redraft Settings to the shipped defaults (Universal Undo compatible)"
            @click="resetToDefaults"
          >
            <span aria-hidden="true">↺</span>
            <span>Reset to Defaults</span>
          </button>
          <div class="flex-1" />
          <span class="text-[10px] text-slate-400">Settings save automatically.</span>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors"
            title="Close Contract Redraft Settings without generating a redraft (settings persist automatically)."
            @click="emit('close')"
          >
            <span>Close</span>
          </button>
          <!-- r41 v438 — Generate Redraft button.  Parent (ContractHub) fires
               the per-clause Sonnet orchestrator + assembles the result +
               opens the Result panel.
               r41 v441 — button now disabled when the currently-selected
               contract has no clauses.  Section 0 picker at the top of the
               dialog shows redraftable options with a big amber warning
               explaining what to do. -->
          <button
            type="button"
            :disabled="!currentCanRedraft"
            class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300"
            :class="currentCanRedraft
              ? 'bg-indigo-600 hover:bg-indigo-700'
              : 'bg-slate-300 cursor-not-allowed'"
            :title="currentCanRedraft
              ? 'Generate a full Contract Redraft with current settings.  Fan-out to Sonnet per-clause (5 in parallel).  Assembles Executive Summary + Contract Health Score + Appendices A1-A6 + redrafted body.  Duration ~ (clause count × 30s) / 5 for typical contracts.'
              : 'Generate Redraft — disabled: the currently-selected contract has no parsed clauses.  Pick a contract with clauses in Section 0 above, or import + parse a contract first.'"
            @click="currentCanRedraft ? emit('generate') : void 0"
          >
            <span aria-hidden="true" class="font-mono">⟲</span>
            <span>Generate Redraft</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
