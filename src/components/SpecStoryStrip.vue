<!-- UNIT_TYPE=Widget -->
<!-- PlanDNAStrip — Plan Story strip.
     A single-line ribbon of "story chapters" telling the provenance and
     authoring history of the active plan: where it came from, how much of it
     YOU shaped vs the AI, how often it was sharpened, who its stewards are,
     and how old it is.

     Tom 2026-05-12 (fourth pass): "I have no idea what human touch means
     and 0%, please as asked for redesign this imaginatively excitingly
     usefully". The previous strip was a left-aligned middle-dot
     enumeration (`AI draft · sharpened 2× · 12 entries · 3 manual edits
     · Human Touch ~0%`) — dense, abbreviated, and the "Human Touch ~0%"
     phrase carried no inherent meaning at first read.

     Redesign:
       1. Each datum is now a self-contained STORY CHAPTER card with a big
          emoji (24 px), an uppercase eyebrow ("ORIGIN" / "HAND-TUNED" /
          "SHARPENED" / "STEWARDS" / "AGE"), a primary value, and a one-
          line explainer in muted text so the meaning is obvious without
          hovering for a HoverHint.
       2. Cards are spread EVENLY across the bar via `justify-around` —
          dead-centre on small viewports, naturally distributed on wide
          ones (Tom: "The story elements can be spread and centred").
       3. "Human Touch %" is gone. In its place: a 🤖↔✋ split bar showing
          the ratio of AI authoring (system-generated content + automatic
          sharpening) to YOUR hand-tuning (manual edits + priority records +
          annotations). 0% reads as "🤖 AI 100% · 0% You" which is
          instantly comprehensible: this plan is currently all-AI; every
          edit you make pulls the needle toward you. -->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { PlanModel } from '../composables/useSpecModel'
import { useSpecAnnotations } from '../composables/useSpecAnnotations'
import { usePriorityRecord } from '../composables/usePriorityRecord'
import HandTunedBreakdownPanel from './HandTunedBreakdownPanel.vue'
import CloseDot from './CloseDot.vue'

const props = defineProps<{ planModel: PlanModel }>()
const emit  = defineEmits<{
  (e: 'close'): void
  (e: 'edit-stewards'): void
}>()

// ── Outside-click auto-dismiss ───────────────────────────────────────────────
// Tom 2026-05-12: "Plan story has no close button, all such windows should
// is the universal rule, in any case it should disappear when anything is
// done elsewhere". The strip is already registered as an exclusive surface
// (App.vue: registerExclusiveSurface('planDNA', planDNAOpen)) so opening
// any OTHER major surface already collapses it. This handler adds the
// missing case: ANY mousedown outside the strip — clicking a SEM input,
// pressing a header button, focusing the editor — auto-dismisses. The
// toggle button itself is excluded by stable test-id so clicking it still
// flips the strip normally (otherwise outside-close would race the toggle).
const rootEl = ref<HTMLElement | null>(null)
const onDocMouseDown = (ev: MouseEvent) => {
  const t = ev.target as Element | null
  if (!t || !rootEl.value) return
  if (rootEl.value.contains(t)) return                                    // click inside the strip itself
  if (t.closest('[data-testid="plancrest-story-toggle"]')) return         // the toggle button — let its own handler run
  if (t.closest('[data-handtuned-breakdown]')) return                     // child panel (Hand-Tuned breakdown modal) opened FROM the strip
  emit('close')
}
onMounted(()        => document.addEventListener('mousedown', onDocMouseDown, true))
onBeforeUnmount(()  => document.removeEventListener('mousedown', onDocMouseDown, true))

// ── Hand-Tuned breakdown panel — opens on chapter click ──────────────────
// Tom 2026-05-12: "just for fun If we click on the Hand tuning, the breakdown
// of different activities can be given! This is interesting in these ai days!"
const breakdownOpen = ref(false)

// ── Sibling composables ───────────────────────────────────────────────────────
const { totalAnnotations } = useSpecAnnotations(computed(() => props.planModel.id).value)
const { records }          = usePriorityRecord(computed(() => props.planModel.id).value)

// ── Raw metrics ───────────────────────────────────────────────────────────────
const totalPeople = computed(() =>
  (props.planModel.owners?.length   ?? 0) +
  (props.planModel.planners?.length ?? 0) +
  (props.planModel.scribes?.filter(s => s.name && !s.isDefault).length ?? 0),
)

const daysActive = computed(() => {
  const ms = Date.now() - new Date(props.planModel.createdAt).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
})

const manualEdits     = computed(() => props.planModel.manualEditCount ?? 0)
const sharpenRounds   = computed(() => props.planModel.sharpenRounds ?? 0)
const priorityRecords = computed(() => records.value.length)
const annotationCount = computed(() => totalAnnotations.value)

// ── ORIGIN chapter ────────────────────────────────────────────────────────────
const origin = computed<{ emoji: string; value: string; tint: string; subtitle: string }>(() => {
  const s = props.planModel.specSource
  if (s === 'imported') return {
    emoji: '📥', value: 'Imported', tint: 'text-sky-200',
    subtitle: 'Loaded from a saved plan model',
  }
  if (s === 'manual')   return {
    emoji: '✋', value: 'Hand-built', tint: 'text-emerald-200',
    subtitle: 'Typed from scratch by you',
  }
  return {
    emoji: '✨', value: 'AI draft', tint: 'text-violet-200',
    subtitle: 'Generated by AI, refined by you',
  }
})

// ── HAND-TUNED chapter — the You-vs-AI split bar ──────────────────────────────
/**
 * Fair authorship model. Tom 2026-05-12: "I recall using sharpening and
 * planned actively making choices, that is not ai, it is human tuning,
 * Please look into this in more depth and dont take all the credit!".
 *
 * Two corrections to the previous unfair formula:
 *
 *  (1) BASELINE depends on origin. Even when the AI drafts a spec, the
 *      human PROMPTED that draft. Treating that as 0% You is wrong.
 *        ai-generated  →  50% You baseline (you prompted, AI drafted)
 *        manual        →  80% You baseline (you typed it from scratch)
 *        imported      →  30% You baseline (you found / chose this plan)
 *
 *  (2) WEIGHTS reflect actual human work. A sharpen round is many human
 *      decisions: choosing which question to answer, accepting/rejecting
 *      each suggestion. The old formula counted it as +2 of a 132-signal
 *      denominator — basically rounding error. New weights:
 *        sharpenRound      = +5  (significant guided refinement)
 *        priorityDecision  = +3  (explicit human curation)
 *        manualEdit        = +2  (literal hand-typing)
 *        annotation        = +1  (flag / note)
 *
 * Capped at 100, floored at 0. Each interaction tilts the bar toward You
 * from the origin baseline, so 0% is now reserved for "imported plan, no
 * interactions yet" — and the moment you sharpen or make a decision, the
 * needle moves visibly.
 */
const baseline = computed<number>(() => {
  const s = props.planModel.specSource
  if (s === 'manual')   return 80
  if (s === 'imported') return 30
  return 50  // ai-generated — you prompted it
})

const tiltBreakdown = computed<{ label: string; pts: number }[]>(() => {
  const out: { label: string; pts: number }[] = []
  if (sharpenRounds.value > 0) {
    const pts = sharpenRounds.value * 5
    out.push({ label: `${sharpenRounds.value} sharpen round${sharpenRounds.value === 1 ? '' : 's'} (+${pts})`, pts })
  }
  if (priorityRecords.value > 0) {
    const pts = priorityRecords.value * 3
    out.push({ label: `${priorityRecords.value} priority decision${priorityRecords.value === 1 ? '' : 's'} (+${pts})`, pts })
  }
  if (manualEdits.value > 0) {
    const pts = manualEdits.value * 2
    out.push({ label: `${manualEdits.value} manual edit${manualEdits.value === 1 ? '' : 's'} (+${pts})`, pts })
  }
  if (annotationCount.value > 0) {
    const pts = annotationCount.value * 1
    out.push({ label: `${annotationCount.value} annotation${annotationCount.value === 1 ? '' : 's'} (+${pts})`, pts })
  }
  return out
})

const totalTilt = computed<number>(() =>
  tiltBreakdown.value.reduce((sum, t) => sum + t.pts, 0),
)

const handTunedPct = computed<number>(() =>
  Math.min(100, Math.max(0, baseline.value + totalTilt.value)),
)
const aiPct = computed<number>(() => 100 - handTunedPct.value)

const handTunedTint = computed(() => {
  if (handTunedPct.value >= 60) return 'text-emerald-200'
  if (handTunedPct.value >= 30) return 'text-amber-200'
  return 'text-rose-200'
})

/** Plain-English narrative of what produced this score. */
const handTunedNarrative = computed<string>(() => {
  const parts: string[] = []
  // Origin baseline
  if (props.planModel.specSource === 'manual') parts.push('You typed this from scratch')
  else if (props.planModel.specSource === 'imported') parts.push('You loaded this plan')
  else parts.push('AI drafted from your prompt')
  // Interactions
  if (sharpenRounds.value > 0)   parts.push(`sharpened ${sharpenRounds.value}×`)
  if (priorityRecords.value > 0) parts.push(`${priorityRecords.value} decision${priorityRecords.value === 1 ? '' : 's'}`)
  if (manualEdits.value > 0)     parts.push(`${manualEdits.value} edit${manualEdits.value === 1 ? '' : 's'}`)
  if (annotationCount.value > 0) parts.push(`${annotationCount.value} flag${annotationCount.value === 1 ? '' : 's'}`)
  return parts.join(' · ')
})

// ── SHARPENED chapter ─────────────────────────────────────────────────────────
const sharpened = computed<{ value: string; subtitle: string }>(() => {
  if (sharpenRounds.value === 0) return {
    value: 'None yet', subtitle: 'Sharpen to harden the plan',
  }
  return {
    value: `${sharpenRounds.value} round${sharpenRounds.value === 1 ? '' : 's'}`,
    subtitle: sharpenRounds.value === 1
      ? 'One refinement pass applied'
      : `${sharpenRounds.value} refinement passes applied`,
  }
})

// ── STEWARDS chapter ──────────────────────────────────────────────────────────
const stewards = computed<{ value: string; subtitle: string }>(() => {
  const n = totalPeople.value
  if (n === 0) return {
    value: 'Unowned', subtitle: 'Tap a chip above to assign',
  }
  return {
    value: `${n} ${n === 1 ? 'person' : 'people'}`,
    subtitle: 'Owners + Planners + Scribes',
  }
})

// ── AGE chapter ───────────────────────────────────────────────────────────────
const age = computed<{ value: string; subtitle: string }>(() => {
  if (daysActive.value === 0) return {
    value: 'Today', subtitle: `Started ${new Date(props.planModel.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
  }
  const v = daysActive.value === 1 ? '1 day' : `${daysActive.value} days`
  return {
    value: v,
    subtitle: `Started ${new Date(props.planModel.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
  }
})

// ── HoverHint — explains the math + breakdown in plain English ─────────────────
const handTunedTooltip = computed<string>(() => {
  const originLabel = props.planModel.specSource === 'manual'
    ? 'Manual origin (+80 You baseline — you typed it from scratch)'
    : props.planModel.specSource === 'imported'
      ? 'Imported origin (+30 You baseline — you found/loaded it)'
      : 'AI-drafted origin (+50 You baseline — you prompted, AI drafted)'
  const tiltLines = tiltBreakdown.value.length
    ? tiltBreakdown.value.map(t => `+ ${t.label}`).join('\n')
    : '(no interactions yet — sharpen, decide, or edit to tilt the bar toward you)'
  return `Hand-Tuned: ${handTunedPct.value}% You · ${aiPct.value}% AI

${originLabel}
${tiltLines}

Sharpen rounds count strongly (+5 each) because each round is many human decisions. Priority decisions = +3, manual edits = +2, annotations = +1.`
})
</script>

<template>
  <!-- Plan Story strip — five chapters spread evenly across the bar.
       `justify-around` gives every chapter equal breathing room left + right
       (Tom: "spread and centred"); `flex-wrap` keeps it usable on narrow
       viewports without horizontal scroll. -->
  <div
    ref="rootEl"
    class="flex flex-wrap items-stretch justify-around gap-x-3 gap-y-2 py-2 mt-1
           border-t border-white/15 select-none"
    aria-label="Spec Story — origin, hand-tuning, sharpening, stewards, age"
  >
    <!-- ── Chapter 1: ORIGIN ─────────────────────────────────────────── -->
    <div class="flex items-center gap-2.5 min-w-[10rem]" :title="origin.subtitle">
      <span class="text-2xl leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" aria-hidden="true">{{ origin.emoji }}</span>
      <div class="flex flex-col leading-tight min-w-0">
        <span class="text-[9px] uppercase tracking-[0.18em] font-bold text-white/55">Origin</span>
        <span :class="['text-[13px] font-bold truncate', origin.tint]">{{ origin.value }}</span>
        <span class="text-[10px] text-white/55 truncate">{{ origin.subtitle }}</span>
      </div>
    </div>

    <!-- ── Chapter 2: HAND-TUNED (the You-vs-AI split bar) ──────────────
         This card replaces the opaque "Human Touch ~0%" label. It shows
         the ratio as a literal split bar with 🤖 on the AI side and ✋
         on the You side, percentages on both ends so the meaning is
         instantly obvious without ever needing a HoverHint.
         Tom 2026-05-12 (sixth pass): clicking this chapter now opens the
         HandTunedBreakdownPanel with the full per-activity breakdown — a
         delightful look at exactly which acts produced the score. -->
    <button
      type="button"
      class="group flex items-center gap-2.5 min-w-[14rem] rounded-lg px-1.5 -mx-1.5 py-1 -my-1
             hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300/60 transition-colors text-left"
      :title="handTunedTooltip + '\n\nClick for full breakdown.'"
      aria-label="Open Plan Authorship Breakdown"
      data-testid="handtuned-chapter-button"
      @click="breakdownOpen = true"
    >
      <!-- Tom 2026-05-12 (tenth pass): "a paragraph symbol (law paragraphs)".
           § (U+00A7, the section / Silcrow sign) is THE canonical legal-
           paragraph symbol — used in German/European law as "§ 17 of the
           Code…", universally recognised as "binding clause / formal
           requirement". Replaces 📄 (generic page) for sharper "law
           stakeholder" meaning. Sequence now: 👤§ → 📈 — stakeholder +
           their binding clause Impacts → improved results curve. § styled
           as bold amber-100 typographic glyph to harmonise with the
           Impacts arrow without colour-cloning it. -->
      <div class="flex items-center gap-0.5 shrink-0 leading-none" aria-hidden="true">
        <span class="text-xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">👤</span>
        <span class="text-amber-100 font-extrabold text-xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] -ml-0.5">§</span>
        <span class="text-amber-300 font-bold text-base mx-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">→</span>
        <span class="text-2xl drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">📈</span>
      </div>
      <div class="flex flex-col leading-tight min-w-0 flex-1">
        <span class="text-[9px] uppercase tracking-[0.18em] font-bold text-white/55 flex items-center gap-1">
          Hand-Tuned
          <span class="text-amber-300/80 group-hover:text-amber-200 transition-colors normal-case tracking-normal font-medium text-[9px]" aria-hidden="true">▸ details</span>
        </span>
        <!-- The visual split bar: amber-green for You, violet for AI.
             Left end = ✨ (modern universal AI glyph — Google, ChatGPT, every
             AI tool uses sparkles, not 🤖); right end = 👥 (the planning
             team — replaces the previous 🧠 which Tom 2026-05-12 (twelfth
             pass) called "not clear enough, could be a football"). The
             👥 (busts in silhouette = group of humans) reads as the
             collaborative human team behind the plan — planning is
             rarely solo, and the You-share is really the team's
             collective hand-tuning. Bigger + clearer than a brain at
             small sizes, AND distinct from the chapter's 👤 (single
             person stakeholder) so the bar's two emoji don't visually
             clone any other glyph on the row. Endpoint emojis bumped
             from text-base (16 px) to text-lg (18 px) for extra clarity,
             and the bar h-2.5 stays for balance; drop-shadow keeps the
             bright-yellow ✨ from fading into the violet track. -->
        <div class="flex items-center gap-1.5 mt-1">
          <!-- Tom 2026-05-12 (sixteenth pass — corrected reading of
               fifteenth): "i am less concerned with the size=importance,
               I was concerned with visibility and intelligibility". The
               brief was always visibility (the brain was unclear, the
               sparkle was too small), not visual-hierarchy signaling.
               Both endpoints sit at PARITY — equal partners, no hierarchy
               implied. Glyph size is a legibility device only (taste rule
               #16). Tom 2026-05-12 (Option B "drama"): bumped from
               text-2xl (24 px) → text-4xl (36 px) for both endpoints. -->
          <span class="text-4xl leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" aria-hidden="true">✨</span>
          <div
            class="relative h-2.5 flex-1 rounded-full overflow-hidden bg-violet-500/70 ring-1 ring-white/20 min-w-[60px]"
            role="meter"
            :aria-valuenow="handTunedPct"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuetext="`${handTunedPct} percent hand-tuned by you, ${aiPct} percent AI-authored`"
          >
            <span
              class="absolute inset-y-0 right-0 bg-gradient-to-l from-amber-300 via-amber-200 to-emerald-300 transition-all duration-500"
              :style="{ width: `${handTunedPct}%` }"
              aria-hidden="true"
            ></span>
          </div>
          <span class="text-4xl leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" aria-hidden="true">👥</span>
        </div>
        <!-- Percentages directly under the bar — colour-coded to match the
             two ends so meaning is obvious without reading the eyebrow. -->
        <div class="flex items-center justify-between text-[10px] leading-none mt-0.5">
          <span class="text-violet-200 font-semibold">{{ aiPct }}% AI</span>
          <span :class="['font-semibold', handTunedTint]">{{ handTunedPct }}% You</span>
        </div>
        <!-- Narrative subtitle — explains in plain English WHAT produced
             this score so the percentage is never an opaque number. Tom
             2026-05-12: "I recall using sharpening and planned actively
             making choices … dont take all the credit". -->
        <span class="text-[10px] text-white/55 truncate" :title="handTunedNarrative">
          {{ handTunedNarrative }}
        </span>
      </div>
    </button>

    <!-- ── Chapter 3: SHARPENED ─────────────────────────────────────────── -->
    <div class="flex items-center gap-2.5 min-w-[10rem]" :title="sharpened.subtitle">
      <span class="text-2xl leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" aria-hidden="true">🔪</span>
      <div class="flex flex-col leading-tight min-w-0">
        <span class="text-[9px] uppercase tracking-[0.18em] font-bold text-white/55">Sharpened</span>
        <span :class="['text-[13px] font-bold truncate', sharpenRounds > 0 ? 'text-amber-200' : 'text-white/65']">
          {{ sharpened.value }}
        </span>
        <span class="text-[10px] text-white/55 truncate">{{ sharpened.subtitle }}</span>
      </div>
    </div>

    <!-- ── Chapter 4: STEWARDS ──────────────────────────────────────────────
         Tom 2026-05-14: "STEWARDS IN PLAN STORY, WE HAVE TO CLICK AND GO TO
         SETTING STEWARDS" — Stewards chapter is now a button that opens the
         Plan Responsibilities panel directly. No more navigating-to-settings. -->
    <button
      type="button"
      class="group flex items-center gap-2.5 min-w-[10rem] rounded-lg px-1.5 -mx-1.5 py-1 -my-1
             hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-300/60
             transition-colors text-left cursor-pointer"
      :title="stewards.subtitle + ' — click to add or edit Stewards'"
      aria-label="Manage Spec Stewards (Owners, Planners, Scribes)"
      @click="emit('edit-stewards')"
    >
      <span class="text-2xl leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" aria-hidden="true">👥</span>
      <div class="flex flex-col leading-tight min-w-0">
        <span class="text-[9px] uppercase tracking-[0.18em] font-bold text-white/55 flex items-center gap-1">
          Stewards
          <span class="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] normal-case tracking-normal font-medium text-sky-200/80" aria-hidden="true">edit ✎</span>
        </span>
        <span :class="['text-[13px] font-bold truncate', totalPeople > 0 ? 'text-sky-200' : 'text-white/65 group-hover:text-sky-200']">
          {{ stewards.value }}
        </span>
        <span class="text-[10px] text-white/55 truncate">{{ stewards.subtitle }}</span>
      </div>
    </button>

    <!-- ── Chapter 5: AGE ──────────────────────────────────────────────── -->
    <div class="flex items-center gap-2.5 min-w-[9rem]" :title="age.subtitle">
      <span class="text-2xl leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" aria-hidden="true">⏱️</span>
      <div class="flex flex-col leading-tight min-w-0">
        <span class="text-[9px] uppercase tracking-[0.18em] font-bold text-white/55">Age</span>
        <span class="text-[13px] font-bold truncate text-indigo-200">{{ age.value }}</span>
        <span class="text-[10px] text-white/55 truncate">{{ age.subtitle }}</span>
      </div>
    </div>

    <!-- ── Close pin ─────────────────────────────────────────────────────
         Tom 2026-05-12: "Plan story has no close button, all such windows
         should — that is the universal rule". CloseDot at the rightmost
         position per the universal Close-Button rule (position rule:
         CloseDot MUST sit at the END of its parent flex header). Uses
         `on-dark` variant because the strip lives on the indigo Plan Crest
         gradient. -->
    <div class="flex items-center shrink-0 self-center">
      <CloseDot variant="on-dark" aria-label="Close Plan Story" @click="emit('close')" />
    </div>
  </div>

  <!-- ── Authorship breakdown panel (opens when user clicks Hand-Tuned) -->
  <HandTunedBreakdownPanel
    v-if="breakdownOpen"
    :plan-model="planModel"
    :sharpen-rounds="sharpenRounds"
    :priority-records="priorityRecords"
    :manual-edits="manualEdits"
    :annotation-count="annotationCount"
    @close="breakdownOpen = false"
  />
</template>
