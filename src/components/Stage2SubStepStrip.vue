<!-- UNIT_TYPE=Widget -->
<!--
 * Stage2SubStepStrip.vue — four-step sub-stage strip rendered at the top
 * of the Stage 2 (Solutions) view.
 *
 * Tom Gilb 2026-06-21 verbatim: *"I think we need to organize Stage 2 like
 * the others in phases. 2.1 Read in The Planguage Specifications, 2.2
 * Generate Better or additional, or delete, solutions to match the Value
 * Targets primarily, within resources and other constraints, 2.3 Give
 * Planner opportunity to Sharpen, the entire set of spects, 2.4 Give the
 * planner the opportunity to Apply Tools (Like Penta, Multivision, Value
 * Flow) and Agents (Like Munger). After zero or more cycles of Tools or
 * Agents, allow the option of MOving to the next stage (we can come back
 * here, and we can refine with tools and agents at later stages)."*
 *
 * Mirrors Stage1SubStepStrip.vue's pattern verbatim — same visual language,
 * same emit contract, same a11y patterns — so the planner's mental model
 * carries over from Stage 1.
 *
 * IMPORTANT — sub-step REGISTRY (`STAGE2_SUBSTEPS`, `Stage2SubStepKey`,
 * `Stage2SubStepDef`) lives in `src/data/stage2SubSteps.ts` per Vue 3
 * `<script setup>` constraint (cannot have top-level `export const`).
 *
 * Composes with: Stage-Has-A-Purpose SUPREME · Stage 1 sub-step pattern ·
 * Icon-Plus-Text SUPREME · DD-009 Zero-Training UI · MOVE Principle · Twin
 * portability.
 -->
<script setup lang="ts">
import { computed } from 'vue'
import { STAGE2_SUBSTEPS, type Stage2SubStepKey } from '../data/stage2SubSteps'

const props = defineProps<{
  /** The sub-step currently active in Stage 2. */
  current?: Stage2SubStepKey
  /** Sub-steps the planner has already completed in this session (drives
   *  the green "✓ done" badge). */
  done?:    Stage2SubStepKey[]
}>()

const emit = defineEmits<{
  (e: 'go', target: Stage2SubStepKey): void
  (e: 'continue'): void
}>()

const currentKey = computed<Stage2SubStepKey>(() => props.current ?? '2.1')
const doneSet    = computed<Set<Stage2SubStepKey>>(() => new Set(props.done ?? []))

// r41 v280 (Tom Gilb 2026-06-22 verbatim "we also need some persistent
// information about the sub-step we are in, the next sub-step and our ability
// to move on" + earlier "a flashing button should signal the probably first
// step") — compute the first NOT-YET-DONE sub-step.  This drives:
//   (a) animate-pulse + amber ring on that pill (the "where to click next" cue)
//   (b) the "Next: X.Y — Label" chip rendered before the Continue button
// If ALL sub-steps are done, firstUndone is null → no pulse, "Next" chip says
// "Continue to Stage 3".  Composes with: Stage-Has-A-Purpose SUPREME, MOVE
// Principle (probable next action visible at-a-glance), DD-009 Zero-Training UI.
const firstUndone = computed<Stage2SubStepKey | null>(() => {
  for (const step of STAGE2_SUBSTEPS) {
    if (!doneSet.value.has(step.key)) return step.key
  }
  return null
})
const nextLabel = computed<string>(() => {
  if (firstUndone.value === null) return 'Continue to Stage 3'
  const step = STAGE2_SUBSTEPS.find(s => s.key === firstUndone.value)
  return step ? `${step.key} — ${step.label}` : 'Continue to Stage 3'
})

// r41 v402 → v403 (Tom Gilb 2026-06-28 verbatim "it seems we need some
// supreme rule: at any phase of a stage, it needs to be spelled out
// 1. What has been done and has happened. 2. what you can do, if you wan
// to, 3. what action to take to continue, if you do not wan to do the
// potential actions just now (everything can be done later, and/or on a
// new cycle of this stage").  v402 originally shipped NOW/DONE/NEXT but
// the NOW line was PRESCRIPTIVE ("do this NOW") — treats sub-steps as
// commands.  v403 reships as DONE / YOU CAN / CONTINUE per Tom's exact
// framing.  Sub-steps are OFFERINGS not commands; everything is optional;
// stages are cyclic; CONTINUE is the explicit skip-ahead path.  Banked as
// SUPREME-tier rule in CLAUDE.md + memory file
// `rule_done_youcan_continue.md`.
/** Sub-steps already completed in this session — for the ✓ DONE row. */
const doneSteps = computed(() =>
  STAGE2_SUBSTEPS.filter(s => doneSet.value.has(s.key))
)
/** Sub-steps still available — for the ✨ YOU CAN row.  Lists ALL not-yet-
 *  done options in canonical order; the planner picks (or skips via
 *  CONTINUE).  Never marks one as "current/must" — every option is equal. */
const optionalSteps = computed(() =>
  STAGE2_SUBSTEPS.filter(s => !doneSet.value.has(s.key))
)
/** "DONE" body text — comma-joined sub-step keys + labels. */
const doneLine = computed<string>(() => {
  if (doneSteps.value.length === 0) return 'Nothing done yet'
  return doneSteps.value.map(s => `${s.key} ${s.label}`).join(' · ')
})
/** "CONTINUE" body — names the explicit button so the planner sees the
 *  skip-ahead action; reinforces the cyclic-return guarantee. */
const continueLine = 'Press [Continue to Stage 3 →] above — skip the options; you can return any time.'

function stepClass(key: Stage2SubStepKey): string {
  const isFirstUndone = key === firstUndone.value
  // r41 v280 — pulse + amber ring whenever this pill IS the first-undone step
  const pulseClass = isFirstUndone ? 'animate-pulse ring-2 ring-amber-300/80 shadow-amber-200/40 shadow-lg' : ''
  if (key === currentKey.value) {
    return `bg-amber-400/95 text-amber-950 ring-2 ring-amber-200 shadow-md ${pulseClass}`
  }
  if (doneSet.value.has(key)) {
    return 'bg-emerald-500/85 text-emerald-50 hover:bg-emerald-500'
  }
  return `bg-white/10 text-white/70 hover:bg-white/20 ring-1 ring-white/15 ${pulseClass}`
}

function badge(key: Stage2SubStepKey): string {
  if (key === currentKey.value) return '●'
  if (doneSet.value.has(key))   return '✓'
  return ''
}
</script>

<template>
  <div
    class="w-full bg-slate-900/45 border-y border-white/10 text-white"
    aria-label="Stage 2 sub-step strip — Read In Specs, Generate Solutions, Sharpen, Tools and Agents"
  >
  <!-- Row 1 — pill strip (existing behaviour) -->
  <div class="w-full flex flex-wrap items-center gap-2 px-3 py-2">
    <!-- Strip header so the cluster has a visible name -->
    <span class="shrink-0 text-[11px] font-bold uppercase tracking-wider text-white/65 mr-2 whitespace-nowrap">
      Stage 2 Steps
    </span>

    <!-- Four sub-step pills -->
    <button
      v-for="step in STAGE2_SUBSTEPS"
      :key="step.key"
      type="button"
      :class="['shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/40', stepClass(step.key)]"
      :title="`${step.key} — ${step.label}.  ${step.longHint}`"
      :aria-label="`Go to sub-step ${step.key} — ${step.label}`"
      :aria-current="step.key === currentKey ? 'step' : undefined"
      @click="emit('go', step.key)"
    >
      <span class="shrink-0 font-mono font-bold tabular-nums">{{ step.key }}</span>
      <span class="whitespace-nowrap">{{ step.label }}</span>
      <span v-if="badge(step.key)" class="shrink-0 text-[10px] font-bold leading-none ml-0.5">{{ badge(step.key) }}</span>
    </button>

    <!-- r41 v280 (Tom Gilb 2026-06-22) — persistent "Next:" chip naming the
         next probable action so the planner ALWAYS sees what's coming.  When
         all sub-steps are done, the chip says "Continue to Stage 3". -->
    <span
      class="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold bg-white/15 text-amber-100 ring-1 ring-amber-300/40 ml-2"
      :title="firstUndone === null ? 'All Stage 2 sub-steps complete — ready to move on to Stage 3' : `Probable next action: ${nextLabel}.  Click the pulsing pill above to start it.`"
    >
      <span class="text-white/70 uppercase tracking-wider text-[9px]">Next:</span>
      <span>{{ nextLabel }}</span>
    </span>

    <!-- Continue to next stage — Tom 2026-06-21 verbatim "After zero or more
         cycles of Tools or Agents, allow the option of MOving to the next
         stage (we can come back here, and we can refine with tools and
         agents at later stages)".  Always visible so the planner can advance
         whenever they decide they are done; the come-back-anytime hint
         appears in the HoverHint. -->
    <span class="shrink-0 text-white/30 mx-1" aria-hidden="true">→</span>
    <button
      type="button"
      class="shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 bg-indigo-500/90 text-white hover:bg-indigo-500 ring-2 ring-indigo-300/60 shadow-md"
      :title="'Continue to Stage 3 — Sharpen.  You can RETURN to Stage 2 anytime to refine Solutions after later-stage changes uncover new constraints (Tom Gilb 2026-06-21).'"
      aria-label="Continue to Stage 3 — Sharpen. You can return to Stage 2 anytime."
      @click="emit('continue')"
    >
      <span class="whitespace-nowrap">Continue to Stage 3</span>
      <span class="shrink-0" aria-hidden="true">→</span>
    </button>
    <!-- r41 v244 (Tom Gilb 2026-06-21 verbatim, with permission) — strengthened with Velocity-
         of-Learning framing.  Composes with quote_stages_are_cyclic.md SUPREME.  HoverHint uses
         a plain title= (no Vue binding) to avoid nested-quote escaping issues. -->
    <span
      class="shrink-0 text-[9px] italic text-white/55 ml-2 max-w-[300px] leading-tight"
      title="Tom Gilb 2026-06-21 — Stages are cyclic. The purpose is not to achieve the initial Value requirements, but to learn quickly and often (Musk's Velocity of Learning) so the specifications are the best current set of ideas for the realities we encounter."
    >
      Stages are cyclic — return anytime to refine Solutions. <span class="not-italic font-semibold text-white/70">Velocity of Learning</span> over initial-requirement chasing.
    </span>
  </div>

  <!-- Row 2 — r41 v403 (Tom Gilb 2026-06-28 verbatim "it seems we need some
       supreme rule: at any phase of a stage, it needs to be spelled out
       1. What has been done and has happened. 2. what you can do, if you
       wan to, 3. what action to take to continue, if you do not wan to do
       the potential actions just now (everything can be done later, and/or
       on a new cycle of this stage").  Done / You Can / Continue at every
       sub-step SUPREME rule banked in CLAUDE.md + memory file
       `rule_done_youcan_continue.md`.  Sub-steps are offerings, not
       commands.  Everything is optional.  Stages are cyclic. -->
  <div class="w-full px-3 pb-2 pt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px] leading-snug">

    <!-- 1. ✓ DONE — what has been done and has happened -->
    <span class="font-bold text-emerald-300 whitespace-nowrap">✓ DONE:</span>
    <span class="text-white/80">{{ doneLine }}</span>

    <!-- 2. ✨ YOU CAN — what the planner CAN do, if they want to.
         r41 v405 (Tom Gilb 2026-06-28 "THERE ARE 2 2.3 BUTTONS"): redesigned
         to make UNAMBIGUOUS that the pills above are the click surface; this
         row is INFORMATIONAL (italic text, bullets, no button-like styling).
         Each line describes what the pill above does — eliminates the
         "two buttons for the same action" confusion.  Composes with MOVE
         Principle SUPREME (single click path, multiple visibility paths). -->
    <span class="font-bold text-amber-200 whitespace-nowrap self-start">✨ YOU CAN:</span>
    <div class="text-white/85 space-y-0.5">
      <template v-if="optionalSteps.length > 0">
        <p class="text-[11.5px] italic text-white/65 mb-1">
          Click any pill above to start that option (all optional, any order):
        </p>
        <ul class="space-y-0.5 pl-4 list-disc marker:text-white/40">
          <li v-for="s in optionalSteps" :key="s.key" class="leading-snug">
            <span class="text-white/95">{{ s.key }} {{ s.label }}</span>
            <span class="text-white/70"> — {{ s.shortHint }}</span>
          </li>
        </ul>
      </template>
      <span v-else class="italic text-white/60">
        All done — every sub-step in this stage is complete.
      </span>
    </div>

    <!-- 3. ➜ CONTINUE — the skip-ahead path -->
    <span class="font-bold text-indigo-300 whitespace-nowrap">➜ CONTINUE:</span>
    <span class="text-white/95">{{ continueLine }}</span>
  </div>

  <!-- Universal-cycle footer — Tom verbatim: "everything can be done later,
       and/or on a new cycle of this stage".  Composes with Stages-are-Cyclic
       SUPREME. -->
  <p class="px-3 pb-2 text-[10.5px] italic text-white/55 leading-tight">
    Everything is optional. Stages are cyclic — return any time.
  </p>
  </div>
</template>
