<!--
  UNIT_TYPE=Component

  ContractAnalysisTheatre — full-height, lawyerly, live "case log" surface that
  replaces the compact banner + basic loading state during a contract parse.

  r41 v391 2026-07-01 — Tom Gilb verbatim *"I also want more visibility into
  exactly what the contacts agent is doing. There is only a sliver of a window.
  Please design an elegant display of the phases of contract analysis, to
  impress a lawyer"*.

  Design layout (top to bottom):

    1. PHASE TIMELINE — four named phases as a horizontal ribbon
       (Ingest · Clause Discovery · Obligation Extraction · Ready for Review).
       Each phase renders its Roman numeral, name in small-caps serif, short
       sub-label, and a status glyph (pending ○ / active pulse ● / done ✓).
       The active phase is the one the analyser is currently working through.

    2. CASE LOG — the theatre's main surface, two columns:
       LEFT (60 %): Live activity — big headline verb of what the AI is doing
       right now, followed by the newest 6 clauses being processed OR
       extracted, each with mono clause number, heading, and a preview
       (raw text during PARSE) or the extracted Planguage entries with
       full-word type chips per the Spell-out-Type-Names SUPREME rule.
       RIGHT (40 %): Analysis Metrics — big-number cards for clauses,
       obligations, ambiguities, standards violations, elapsed, plus a
       credibility strip naming model + prompt-cache + concurrency + Contracts
       Mode configuration in play.

    3. CLAUSE STRIP — one small tile per clause forming a horizontal ledger.
       Filled teal when done, amber pulsing when in-flight, muted stone when
       pending.  A 38-clause Indianapolis-class contract shows 38 tiles —
       the planner can see progress at a glance across the whole document.

    4. CANCEL ACTION — Icon-Plus-Text SUPREME button.  Same abort semantics
       as the existing banner (stop the loop between clauses).

    5. AMUSE CARD — kept as a small footer strip inside the theatre for
       Rule-8 compliance (loading state must have amuse content); replaces
       the standalone amuse block in the previous loading-state surface.

  Composes with (all SUPREME rules the parent honours are preserved):
    - Icon-Plus-Text SUPREME (every phase pill has glyph + text)
    - International Icons DD-015 (Roman numerals + universal glyphs, no
      English-letter abbreviations)
    - Spell-out-Type-Names SUPREME (Function / Value / Constraint / Resource
      / Solution / Task — never F. / V. / etc.)
    - Colorful Exports Rule (canonical Planguage type colors on chips)
    - MOVE Principle (every option visible; no menu-dive)
    - accessibility_tom.md (universal — generous type, high contrast on
      white, big touch targets, verbal feedback over silent action)
    - DD-009 Zero-Training UI (no learned vocabulary; every affordance
      spelled out with a HoverHint per Banned-Word `tooltip` -> `HoverHint`)
    - Honest Loading Hint Copy SUPREME (real time ranges — "typically 60-180s;
      large contracts can take 3-5 minutes (AI model processing, not network)")
    - Loading-State Rule 8 (spinner + elapsed + % + amuse — all four present)
    - Universal Undo SUPREME (Cancel is reversible — Re-import is one click)
    - Conjunction-of-Technologies SUPREME (visibly dramatises the AI's work
      against the Planguage discipline + the Contracts Mode standards axis)
    - Twin portability (pure Vue + Tailwind; no DOM tricks; ports cleanly)

  This component is READ-ONLY on the contract data — every input arrives via
  props.  Handlers are emitted for the parent to actuate (`abort`, `advance-
  amuse`).
-->

<script setup lang="ts">
import { computed } from 'vue'
import type { ContractClause } from '../types/contractTypes'
// r41 v396 — shared best-heading helper so pre-v395-stored clauses (which
// carry a literal `heading = "Untitled"` from earlier fallbacks) still get
// an intelligible label rendered from their rawText.
import { bestClauseHeading } from '../composables/useContractParser'

interface AmuseCard {
  emoji: string
  title: string
  text:  string
  ref:   string
}

interface Props {
  parseStatus:            'splitting' | 'parsing' | 'complete' | 'error' | 'pending' | string
  clauses:                ContractClause[]
  liveSplittingClauses:   ContractClause[]
  parsingClauses:         ContractClause[]
  recentDoneClauses:      ContractClause[]
  contractElapsed:        number       // seconds
  contractRealProgress:   number       // 0-100
  contractClausesDone:    number
  contractClausesTotal:   number
  isAnalysing:            boolean
  amuseCards:             readonly AmuseCard[]
  amuseIdx:               number
  amuseActive:            boolean
  amuseFinishing:         boolean
  amuseCountdown:         number
  cancellable:            boolean
  contractTitle:          string
  /** Human-readable Contracts Mode config summary — e.g. "4 axes: Sharpen ON ·
   *  Standards: gilb-planguage · Presentation: managers · Purposes: strict-
   *  analytical, change-log".  Optional; when absent the strip renders a
   *  compact "Config active" placeholder. */
  modeConfigSummary?:     string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'abort'): void
  (e: 'advance-amuse'): void
  (e: 'jump-amuse', i: number): void
  (e: 'extend-amuse'): void
  // r41 v399 (Tom Gilb 2026-07-01 verbatim "I cannot see how to set these
  // values, it should be visible here too. 'Adjust Contract Agent Options'")
  // — Adjust-Contract-Agent-Options affordance in the Analyser Configuration
  // strip.  Parent (ContractHub) relays to open Settings on the Contracts
  // Mode section — same wiring the header chip already uses.
  (e: 'adjust-options'): void
}>()

/** The four canonical named phases.  Roman numerals are language-neutral per
 *  DD-015 International Icons.  Sub-labels give lawyerly precision. */
type PhaseId = 'ingest' | 'discovery' | 'extraction' | 'review'
interface PhaseSpec {
  id:        PhaseId
  roman:     string       // Roman numeral for the pill medallion
  name:      string       // small-caps serif label
  subLabel:  string       // one-line human explanation
  activeVerb:string       // "Reading…" style verb when this phase is active
}

const PHASES: readonly PhaseSpec[] = [
  { id: 'ingest',     roman: 'I',   name: 'Ingest',                subLabel: 'Receive and stage the raw contract text',                        activeVerb: 'Ingesting the contract document…' },
  { id: 'discovery',  roman: 'II',  name: 'Clause Discovery',      subLabel: 'Identify each numbered obligation and semantic boundary',        activeVerb: 'Reading contract text and marking clause boundaries…' },
  { id: 'extraction', roman: 'III', name: 'Obligation Extraction', subLabel: 'Convert each clause into structured Planguage obligations',      activeVerb: 'Extracting structured obligations, ambiguities, and standards findings…' },
  { id: 'review',     roman: 'IV',  name: 'Ready for Review',      subLabel: 'Present the obligations matrix for planner review',              activeVerb: 'Compiling the final obligations matrix for review…' },
] as const

/** Which phase is currently in flight, based on parseStatus. */
const activePhaseId = computed<PhaseId>(() => {
  if (props.parseStatus === 'splitting') return 'discovery'
  if (props.parseStatus === 'parsing')   return 'extraction'
  if (props.parseStatus === 'complete')  return 'review'
  if (props.parseStatus === 'error')     return 'review'
  return 'ingest'
})

/** Per-phase status for the ribbon: 'pending' / 'active' / 'done'. */
function phaseStatus(id: PhaseId): 'pending' | 'active' | 'done' {
  const order: readonly PhaseId[] = ['ingest', 'discovery', 'extraction', 'review']
  const activeIdx = order.indexOf(activePhaseId.value)
  const myIdx     = order.indexOf(id)
  if (myIdx < activeIdx) return 'done'
  if (myIdx === activeIdx) return 'active'
  return 'pending'
}

/** Current active phase's headline verb — surfaced as the big Case Log title. */
const activeVerb = computed(() => {
  const p = PHASES.find(x => x.id === activePhaseId.value)
  return p?.activeVerb ?? 'Working…'
})

/** Total obligations extracted so far (sum across every done clause). */
const totalObligations = computed(() =>
  props.clauses.reduce((sum, cl) => sum + (cl.entries?.length ?? 0), 0)
)

/** Ambiguities flagged so far. */
const totalAmbiguities = computed(() =>
  props.clauses.reduce((sum, cl) =>
    sum + (cl.entries?.filter(e => e.isAmbiguous).length ?? 0), 0)
)

/** Standards violations flagged so far.  Undefined `standardsViolations`
 *  simply counts as zero. */
const totalStandardsFindings = computed(() =>
  props.clauses.reduce((sum, cl) =>
    sum + (cl.entries?.reduce((s, e) =>
      s + (Array.isArray(e.standardsViolations) ? e.standardsViolations.length : 0), 0) ?? 0), 0)
)

/** mm:ss elapsed format. */
const elapsedFormatted = computed(() => {
  const s = Math.max(0, Math.floor(props.contractElapsed))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm.toString().padStart(1, '0')}:${ss.toString().padStart(2, '0')}`
})

/**
 * Spelled-out full type word per Spell-out-Type-Names SUPREME.
 *
 * r41 v433 (Tom Gilb 2026-07-02 verbatim *"something wrong, lots of solutions
 * below left but only 2 counted above, the counting must be wrong, and maybe
 * for more than solutions"*).  Root cause: this local `entryTypeWord` in
 * ContractAnalysisTheatre.vue had NOT been swept when v427 reassigned
 * S = Stakeholder (was S = Solution pre-v427) nor when v430 added 'Sol' =
 * Solution.  Result: Stakeholder entries (type='S') showed as "Solution" in
 * the Case Log pills, and real Solution entries (type='Sol') showed the raw
 * 'Sol' string through the default fallback.  Counter row at the top of the
 * Theatre uses a DIFFERENT code path (CONTRACT_ENTRY_FULL in ContractHub.vue)
 * which was correctly updated, so Tom saw the mismatch: pills claiming
 * "Solution" everywhere but the count showing only 2.  Fix aligns this local
 * mapping with the store's canonical labels.
 */
function entryTypeWord(t: string): string {
  switch (t) {
    case 'F':    return 'Function'
    case 'V':    return 'Value'
    case 'C':    return 'Constraint'
    case 'R':    return 'Resource'
    case 'Sol':  return 'Solution'
    case 'S':    return 'Stakeholder'
    case 'Task': return 'Task'
    default:     return t
  }
}
/**
 * Canonical Planguage type color chips.
 *
 * r41 v433 — same v427/v430 sweep as `entryTypeWord`: 'S' was orange
 * (Solution's colour) and needs to switch to blue (Stakeholder's canonical
 * colour matching CONTRACT_FILTER_GLYPHS `#2563eb`).  New 'Sol' entry takes
 * the orange chip (matching CONTRACT_FILTER_GLYPHS `#ea580c`).
 */
function entryTypeChipClass(t: string): string {
  switch (t) {
    case 'F':    return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
    case 'V':    return 'bg-violet-50 text-violet-800 ring-1 ring-violet-200'
    case 'C':    return 'bg-red-50 text-red-800 ring-1 ring-red-200'
    case 'R':    return 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
    case 'Sol':  return 'bg-orange-50 text-orange-800 ring-1 ring-orange-200'
    case 'S':    return 'bg-blue-50 text-blue-800 ring-1 ring-blue-200'
    case 'Task': return 'bg-slate-100 text-slate-800 ring-1 ring-slate-300'
    default:     return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
  }
}

/** Per-clause tile class in the bottom clause ledger. */
function clauseTileClass(cl: ContractClause): string {
  if (cl.parseStatus === 'done')    return 'bg-teal-500'
  if (cl.parseStatus === 'error')   return 'bg-red-400'
  if (cl.parseStatus === 'parsing') return 'bg-amber-400 animate-pulse'
  return 'bg-stone-200'
}

/** Show up to 60 tiles inline; contracts with more than that get a "+N more"
 *  suffix so the ledger doesn't sprawl across two lines. */
const visibleClauseTiles = computed(() => props.clauses.slice(0, 60))
const overflowClauseCount = computed(() => Math.max(0, props.clauses.length - 60))

/** The current amuse card (Rule 8 compliance — spinner MUST include amuse). */
const currentAmuse = computed<AmuseCard | null>(() => {
  if (props.amuseCards.length === 0) return null
  return props.amuseCards[props.amuseIdx % props.amuseCards.length]
})
</script>

<template>
  <section
    class="w-full h-full flex flex-col bg-stone-50"
    aria-label="Contract analysis theatre — live phase-by-phase view of AI activity"
  >
    <!-- ── 1 · PHASE TIMELINE RIBBON ─────────────────────────────────────── -->
    <div class="shrink-0 px-6 pt-5 pb-4 bg-white border-b border-stone-200">
      <div class="flex items-center gap-3">
        <p class="shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500" style="font-family: Georgia, 'Times New Roman', serif;">
          Case Analysis
        </p>
        <div class="flex-1 h-px bg-stone-200" aria-hidden="true" />
        <p class="shrink-0 text-[10px] font-semibold text-teal-700 tabular-nums flex items-center gap-1.5">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          <span class="uppercase tracking-widest">Live · {{ elapsedFormatted }}</span>
        </p>
      </div>
      <p
        v-if="contractTitle"
        class="mt-1 text-lg font-bold text-stone-800 truncate"
        style="font-family: Georgia, 'Times New Roman', serif;"
        :title="contractTitle"
      >{{ contractTitle }}</p>

      <!-- Phase ribbon -->
      <div class="mt-4 flex items-stretch gap-2">
        <template v-for="(phase, idx) in PHASES" :key="phase.id">
          <!-- Phase pill -->
          <div
            class="flex-1 flex flex-col gap-1 px-3 py-2.5 rounded-xl border transition-all"
            :class="[
              phaseStatus(phase.id) === 'active'
                ? 'bg-teal-50 border-teal-300 shadow-sm ring-2 ring-teal-200/60'
                : phaseStatus(phase.id) === 'done'
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-white border-stone-200'
            ]"
            :aria-current="phaseStatus(phase.id) === 'active' ? 'step' : undefined"
            :title="`Phase ${phase.roman} · ${phase.name} — ${phase.subLabel}. Status: ${phaseStatus(phase.id)}.`"
          >
            <div class="flex items-center gap-2">
              <!-- Roman numeral medallion -->
              <span
                class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                :class="[
                  phaseStatus(phase.id) === 'active'
                    ? 'bg-teal-600 text-white'
                    : phaseStatus(phase.id) === 'done'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 text-stone-500'
                ]"
                style="font-family: Georgia, 'Times New Roman', serif;"
                aria-hidden="true"
              >{{ phase.roman }}</span>
              <span
                class="min-w-0 text-[11px] font-bold uppercase tracking-[0.16em] truncate"
                style="font-family: Georgia, 'Times New Roman', serif;"
                :class="[
                  phaseStatus(phase.id) === 'active'
                    ? 'text-teal-800'
                    : phaseStatus(phase.id) === 'done'
                      ? 'text-emerald-800'
                      : 'text-stone-500'
                ]"
              >{{ phase.name }}</span>
              <!-- Status glyph (Icon-Plus-Text SUPREME: glyph accompanied by text) -->
              <span
                class="ml-auto text-[13px] leading-none"
                aria-hidden="true"
              >
                <template v-if="phaseStatus(phase.id) === 'done'">
                  <span class="text-emerald-700">✓</span>
                </template>
                <template v-else-if="phaseStatus(phase.id) === 'active'">
                  <span class="inline-block w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                </template>
                <template v-else>
                  <span class="text-stone-300">○</span>
                </template>
              </span>
            </div>
            <p class="text-[10px] text-stone-500 leading-snug line-clamp-2">{{ phase.subLabel }}</p>
          </div>
          <!-- Connector arrow between pills (not after last) -->
          <div v-if="idx < PHASES.length - 1" class="self-center text-stone-300" aria-hidden="true">›</div>
        </template>
      </div>
    </div>

    <!-- ── 2 · CASE LOG — two columns (activity + metrics) ───────────────── -->
    <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 px-6 py-4 overflow-hidden">

      <!-- LEFT · Live activity -->
      <div class="min-h-0 flex flex-col bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <!-- Card header -->
        <div class="shrink-0 px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-white to-stone-50">
          <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-400" style="font-family: Georgia, 'Times New Roman', serif;">
            Case Log · Live
          </p>
          <p class="mt-1 text-base font-bold text-stone-800 leading-snug flex items-center gap-2">
            <svg class="shrink-0 h-4 w-4 text-teal-500 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{{ activeVerb }}</span>
          </p>
          <p class="mt-1 text-[11px] text-stone-500 leading-relaxed">
            <!-- r41 v398 (Tom Gilb 2026-07-01 verbatim "taking a long time, and
                 longer than advertised here. Of course doing it right and
                 impressively is more important than time.") — Honest Loading
                 Hint Copy SUPREME update: the previous "typically 60-180s" was
                 misleading for the class of contract Tom is analysing.  A
                 20-clause Indianapolis-class contract with Sonnet + prompt
                 caching + 5 in parallel routinely runs 3-5 minutes.  Widened
                 the typical band + acknowledged that we prioritise
                 thoroughness over speed per Tom's stated preference. -->
            {{ contractElapsed }}s elapsed · typically 2–5 minutes across all clauses (AI model processing, not network) · long contracts can take longer — we prioritise doing it right over doing it fast.
          </p>
        </div>

        <!-- Activity feed -->
        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">

          <!-- SPLITTING phase — live clauses appearing -->
          <template v-if="parseStatus === 'splitting'">
            <template v-if="liveSplittingClauses.length > 0">
              <!-- r41 v406 — ✨ removed per Planguage-Glyph-First SUPREME. -->
              <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 flex items-center gap-2">
                <span>Clauses discovered so far · {{ liveSplittingClauses.length }} and counting</span>
              </p>
              <ul class="space-y-2">
                <li
                  v-for="(cl, i) in [...liveSplittingClauses].reverse().slice(0, 8)"
                  :key="cl.id"
                  class="flex items-start gap-3 p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/40"
                  :class="i === 0 ? 'ring-2 ring-emerald-300/60' : ''"
                >
                  <span class="shrink-0 mt-0.5 inline-flex items-center justify-center px-1.5 h-5 rounded-md bg-white border border-emerald-200 text-[10px] font-mono font-bold text-emerald-800 tabular-nums">
                    {{ liveSplittingClauses.length - i }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="text-[12px] font-semibold text-stone-800 leading-snug">
                      <span class="font-mono text-emerald-700">{{ cl.number }}</span>
                      <span class="text-stone-400 mx-1.5">·</span>
                      <span>{{ bestClauseHeading(cl) }}</span>
                    </p>
                    <p class="mt-0.5 text-[11px] text-stone-500 leading-snug line-clamp-2">
                      {{ cl.rawText.slice(0, 180) }}{{ cl.rawText.length > 180 ? '…' : '' }}
                    </p>
                  </div>
                </li>
              </ul>
            </template>
            <template v-else>
              <!-- r41 v406 — 📄 removed per Planguage-Glyph-First SUPREME. -->
              <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700 flex items-center gap-2">
                <span>Reading contract text · looking for clause boundaries</span>
              </p>
              <p class="text-[11px] text-stone-500 italic font-mono leading-relaxed line-clamp-4 bg-stone-50 p-3 rounded-lg border border-stone-100">
                Waiting for the first clause to close in the LLM stream — typically 5-15 s after start.
              </p>
            </template>
          </template>

          <!-- PARSING phase — in-flight + just-extracted -->
          <template v-else-if="parseStatus === 'parsing'">
            <!-- In-flight -->
            <div v-if="parsingClauses.length > 0">
              <!-- r41 v406 — 🟡 removed per Planguage-Glyph-First SUPREME. -->
              <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 flex items-center gap-2">
                <span>Extracting now · {{ parsingClauses.length }} in parallel</span>
              </p>
              <ul class="mt-2 space-y-2">
                <li
                  v-for="cl in parsingClauses.slice(0, 5)"
                  :key="cl.id"
                  class="flex items-start gap-3 p-2.5 rounded-lg border border-amber-100 bg-amber-50/40"
                >
                  <span class="shrink-0 mt-1 inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                  <div class="min-w-0 flex-1">
                    <p class="text-[12px] font-semibold text-stone-800 leading-snug">
                      <span class="font-mono text-amber-700">{{ cl.number }}</span>
                      <span class="text-stone-400 mx-1.5">·</span>
                      <span>{{ bestClauseHeading(cl) }}</span>
                    </p>
                    <p class="mt-0.5 text-[11px] text-stone-500 leading-snug line-clamp-2">
                      {{ cl.rawText.slice(0, 200) }}{{ cl.rawText.length > 200 ? '…' : '' }}
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Just-extracted -->
            <div v-if="recentDoneClauses.length > 0">
              <!-- r41 v406 — ✅ removed per Planguage-Glyph-First SUPREME. -->
              <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 flex items-center gap-2 mt-3">
                <span>Just extracted · newest first</span>
              </p>
              <ul class="mt-2 space-y-2">
                <li
                  v-for="(cl, i) in recentDoneClauses.slice(0, 4)"
                  :key="cl.id"
                  class="p-2.5 rounded-lg border border-emerald-100 bg-white"
                  :class="i === 0 ? 'ring-2 ring-emerald-300/60' : ''"
                >
                  <p class="text-[12px] font-semibold text-stone-800 leading-snug">
                    <span class="font-mono text-emerald-700">{{ cl.number }}</span>
                    <span class="text-stone-400 mx-1.5">·</span>
                    <span>{{ bestClauseHeading(cl) }}</span>
                  </p>
                  <p v-if="cl.entries.length === 0" class="mt-1 text-[11px] italic text-stone-400">
                    (no discrete obligations extracted from this clause)
                  </p>
                  <ul v-else class="mt-1.5 flex flex-wrap gap-1.5">
                    <li
                      v-for="e in cl.entries.slice(0, 6)"
                      :key="e.id"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                      :class="entryTypeChipClass(e.type)"
                      :title="`${entryTypeWord(e.type)} — ${e.description}`"
                    >
                      <span>{{ entryTypeWord(e.type) }}</span>
                      <span class="font-normal text-stone-600 truncate max-w-[160px]">· {{ e.description }}</span>
                    </li>
                    <li v-if="cl.entries.length > 6" class="text-[10px] italic text-stone-400 self-center">
                      + {{ cl.entries.length - 6 }} more
                    </li>
                  </ul>
                </li>
              </ul>
            </div>

            <p
              v-if="parsingClauses.length === 0 && recentDoneClauses.length === 0"
              class="text-[11px] text-stone-500 italic"
            >
              Preparing to extract — the next batch of 5 clauses will begin momentarily.
            </p>
          </template>

          <!-- COMPLETE / ERROR / other -->
          <template v-else>
            <p class="text-[11px] text-stone-500">
              {{ parseStatus === 'complete' ? 'Analysis complete.'
                 : parseStatus === 'error'  ? 'Analysis stopped.'
                 : 'Standing by.' }}
            </p>
          </template>
        </div>
      </div>

      <!-- RIGHT · Metrics + credibility + amuse.
           r41 v426 (Tom Gilb 2026-07-01 verbatim *"the dark box at bottom is
           cut off text"*).  The parent grid at line 328 caps the column with
           `overflow-hidden`.  Previously this right column had NO overflow
           rule, so when the credibility strip's "Contracts Mode: …" summary
           text wrapped long (4 purposes + several standards + Presentation +
           Sharpening = up to 15 line-fragments), the bottom of the strip got
           clipped inside the parent's hidden overflow.  Fix: `overflow-y-auto`
           on the right column so it scrolls internally.  Matches the LEFT
           column's pattern at line 331/359.  Composes with No-Silent-Data-
           Loss SUPREME (silent clipping IS silent data loss — the config
           summary was being hidden without a scrollbar hint), MOVE Principle
           (all config axes reachable at-a-glance via scroll), Universal
           accessibility (no reader should have to guess at hidden content). -->
      <div class="min-h-0 flex flex-col gap-4 overflow-y-auto">

        <!-- Metric cards (2×2 grid) -->
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-2xl bg-white border border-stone-200 shadow-sm p-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400" style="font-family: Georgia, 'Times New Roman', serif;">Clauses</p>
            <!-- r41 v424 (Tom Gilb 2026-07-01 verbatim *"I would like to add
                 a count of the the clauses as they are discovered, so we have
                 a sense of progress"*).  During Phase II Discovery the total
                 is unknown, so surface the LIVE running count of clauses
                 streamed in so far (`liveSplittingClauses.length`) with a
                 "and counting" caption.  During Phase III Extraction and
                 beyond, revert to the extracted/total ratio so the planner
                 sees how many have been fully processed.  Composes with
                 Honest Loading Hint Copy SUPREME (real numbers, real
                 progress), MOVE Principle (count visible without menu-dive),
                 Conjunction-of-Technologies SUPREME (visibly shows the AI's
                 streaming work). -->
            <template v-if="parseStatus === 'splitting'">
              <p class="mt-1 text-2xl font-bold text-teal-700 tabular-nums leading-none">
                {{ liveSplittingClauses.length }}<span class="text-base text-stone-400 font-medium"> discovered</span>
              </p>
              <p class="text-[10px] text-stone-500 mt-1">scanning contract for clause boundaries…</p>
            </template>
            <template v-else>
              <p class="mt-1 text-2xl font-bold text-teal-700 tabular-nums leading-none">
                {{ contractClausesDone }}<span class="text-base text-stone-400 font-medium"> / {{ contractClausesTotal || '?' }}</span>
              </p>
              <p class="text-[10px] text-stone-500 mt-1">extracted from {{ contractClausesTotal }} discovered</p>
            </template>
          </div>
          <div class="rounded-2xl bg-white border border-stone-200 shadow-sm p-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400" style="font-family: Georgia, 'Times New Roman', serif;">Obligations</p>
            <p class="mt-1 text-2xl font-bold text-emerald-700 tabular-nums leading-none">{{ totalObligations }}</p>
            <p class="text-[10px] text-stone-500 mt-1">Planguage entries extracted</p>
          </div>
          <div class="rounded-2xl bg-white border border-stone-200 shadow-sm p-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400" style="font-family: Georgia, 'Times New Roman', serif;">Ambiguities</p>
            <p
              class="mt-1 text-2xl font-bold tabular-nums leading-none"
              :class="totalAmbiguities > 0 ? 'text-amber-700' : 'text-stone-400'"
            >{{ totalAmbiguities }}</p>
            <p class="text-[10px] text-stone-500 mt-1">flagged for review</p>
          </div>
          <div class="rounded-2xl bg-white border border-stone-200 shadow-sm p-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400" style="font-family: Georgia, 'Times New Roman', serif;">Standards Findings</p>
            <p
              class="mt-1 text-2xl font-bold tabular-nums leading-none"
              :class="totalStandardsFindings > 0 ? 'text-red-700' : 'text-stone-400'"
            >{{ totalStandardsFindings }}</p>
            <p class="text-[10px] text-stone-500 mt-1">violations across active axes</p>
          </div>
        </div>

        <!-- Real progress bar with % -->
        <div class="rounded-2xl bg-white border border-stone-200 shadow-sm p-3">
          <div class="flex items-baseline justify-between">
            <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500" style="font-family: Georgia, 'Times New Roman', serif;">Progress</p>
            <p class="text-sm font-bold text-teal-700 tabular-nums">{{ contractRealProgress }}%</p>
          </div>
          <div class="mt-2 h-2 bg-teal-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
              :style="{ width: contractRealProgress + '%' }"
              role="progressbar"
              :aria-valuenow="contractRealProgress"
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>

        <!-- Credibility strip -->
        <div class="rounded-2xl bg-stone-800 text-stone-100 p-3 space-y-1">
          <div class="flex items-center gap-2">
            <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400" style="font-family: Georgia, 'Times New Roman', serif;">
              Analyser Configuration
            </p>
            <!-- r41 v399 (Tom Gilb 2026-07-01 verbatim "I cannot see how to set
                 these values, it should be visible here too. 'Adjust Contract
                 Agent Options'") — Adjust-Options pin in the credibility strip
                 itself.  Emits `adjust-options`; parent (ContractHub) relays to
                 open Settings on the Contracts Mode section — same wiring the
                 header chip already uses.  Composes with MOVE Principle (option
                 visible next to what it adjusts, no menu-dive), Icon-Plus-Text
                 SUPREME (glyph + text, spelled-out button label), DD-009 Zero-
                 Training UI (HoverHint names what opens), Tom-Repeats-Himself
                 SUPREME (banked exact wording verbatim). -->
            <button
              type="button"
              class="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-700 hover:bg-stone-600 text-[10px] font-semibold ring-1 ring-stone-500 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
              title="Adjust Contract Agent Options — open Settings on the Contracts Mode section to change Sharpening · Standards · Presentation · Purposes. Takes effect on the next Re-parse."
              aria-label="Adjust Contract Agent Options"
              @click="emit('adjust-options')"
            >
              <span aria-hidden="true">⚙</span>
              <span>Adjust Contract Agent Options</span>
            </button>
          </div>
          <div class="flex flex-wrap gap-1.5 mt-1.5">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-700 text-[10px] font-semibold ring-1 ring-stone-600">
              <span class="text-emerald-300">◆</span>
              <span>Sonnet</span>
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-700 text-[10px] font-semibold ring-1 ring-stone-600">
              <span class="text-teal-300">⚡</span>
              <span>Prompt Cache Active</span>
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-700 text-[10px] font-semibold ring-1 ring-stone-600">
              <span class="text-amber-300">▦</span>
              <span>5 in Parallel</span>
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-700 text-[10px] font-semibold ring-1 ring-stone-600">
              <span class="text-violet-300">§</span>
              <span>Planguage Discipline</span>
            </span>
          </div>
          <p v-if="modeConfigSummary" class="text-[10px] text-stone-300 mt-2 leading-relaxed">
            <span class="text-stone-500">Contracts Mode:</span> {{ modeConfigSummary }}
          </p>
          <p v-else class="text-[10px] text-stone-400 italic mt-2">
            Contracts Mode 4-axis config active — Sharpening · Standards · Presentation · Purpose.
          </p>
        </div>

        <!-- Cancel action (Icon-Plus-Text SUPREME) -->
        <div v-if="cancellable" class="pt-1">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-[11px] font-semibold
                   bg-white border border-red-300 text-red-700 hover:bg-red-50 transition-colors
                   focus:outline-none focus:ring-2 focus:ring-red-300"
            title="Cancel Import — stops the parse loop after the currently-executing clause finishes (~20-30s wait). Already-parsed clauses are kept. Re-import or Resume to continue."
            aria-label="Cancel contract import"
            @click="emit('abort')"
          >
            <span aria-hidden="true">✕</span>
            <span>Cancel Import</span>
          </button>
        </div>

        <!-- Amuse card (Loading-State Rule 8 element 4) -->
        <div
          v-if="currentAmuse && amuseActive"
          class="rounded-2xl bg-white border border-stone-200 shadow-sm p-3 flex flex-col"
        >
          <div class="flex items-start gap-2">
            <span class="text-lg leading-none shrink-0" aria-hidden="true">{{ currentAmuse.emoji }}</span>
            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700 truncate" style="font-family: Georgia, 'Times New Roman', serif;">
                {{ currentAmuse.title }}
              </p>
              <p class="mt-1 text-[11px] text-stone-600 leading-relaxed line-clamp-4">
                {{ currentAmuse.text }}
              </p>
              <p class="mt-1 text-[10px] text-stone-400 italic truncate">— {{ currentAmuse.ref }}</p>
            </div>
          </div>
          <!-- Amuse pager dots -->
          <div class="mt-2 flex items-center gap-1 justify-center">
            <button
              v-for="(_, i) in amuseCards"
              :key="i"
              type="button"
              class="w-1.5 h-1.5 rounded-full transition-colors"
              :class="i === amuseIdx ? 'bg-violet-500' : 'bg-stone-300 hover:bg-stone-400'"
              :aria-label="`Jump to insight ${i + 1} of ${amuseCards.length}`"
              :title="`Contract insight ${i + 1} of ${amuseCards.length}: ${amuseCards[i].title} — click to jump`"
              @click="emit('jump-amuse', i)"
            />
          </div>
          <!-- Extend Amuse when finishing -->
          <button
            v-if="amuseFinishing"
            type="button"
            class="mt-2 mx-auto inline-flex items-center gap-1 px-2 h-6 rounded-md text-[10px] font-semibold
                   bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 animate-pulse"
            :title="`Extend the insight carousel — auto-closes in ${amuseCountdown}s.`"
            @click="emit('extend-amuse')"
          >
            <span aria-hidden="true">↺</span>
            <span>Keep Amusing Me · {{ amuseCountdown }}s</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ── 3 · CLAUSE LEDGER (bottom strip) ──────────────────────────────── -->
    <div v-if="clauses.length > 0" class="shrink-0 px-6 pb-4 pt-2 bg-white border-t border-stone-200">
      <div class="flex items-center gap-3">
        <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500" style="font-family: Georgia, 'Times New Roman', serif;">
          Clause Ledger
        </p>
        <div class="flex-1 flex items-center gap-[3px] flex-wrap">
          <span
            v-for="(cl, i) in visibleClauseTiles"
            :key="cl.id"
            class="inline-block h-2.5 w-2.5 rounded-sm transition-colors"
            :class="clauseTileClass(cl)"
            :title="`Clause ${i + 1} · ${cl.number} — ${bestClauseHeading(cl)} · ${cl.parseStatus}`"
            aria-hidden="true"
          />
          <span v-if="overflowClauseCount > 0" class="text-[10px] text-stone-400 font-semibold tabular-nums ml-1">
            + {{ overflowClauseCount }} more
          </span>
        </div>
        <p class="shrink-0 text-[10px] text-stone-500 tabular-nums font-semibold">
          {{ contractClausesDone }} / {{ contractClausesTotal }}
        </p>
      </div>
    </div>
  </section>
</template>
