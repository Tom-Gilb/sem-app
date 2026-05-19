<!-- UNIT_TYPE=Panel -->
<!-- HandTunedBreakdownPanel — Plan authorship deep-dive.
     Opened by clicking the Hand-Tuned chapter in the Plan Story strip.
     Tom 2026-05-12: "just for fun If we click on the Hand tuning, the
     breakdown of different activities can be given! This is interesting
     in these ai days!"

     The panel celebrates the user's actual authorship work and lays out
     exactly how the You-vs-AI split came to be:

       1. Big hero bar (huge 🤖↔✋ split bar with animated fill)
       2. Origin baseline row — what the spec source contributes
       3. Per-activity rows — sharpen rounds, priority decisions, manual
          edits, annotations — each with emoji + count + points + a mini
          bar showing relative contribution to YOUR total
       4. Running tally + final percentage
       5. "Grow your share" tip — concrete next action to tilt the bar
          further toward You

     Compact modal (max-w-2xl). Backdrop click + Esc + CloseDot all close.
     Not a "major full-screen surface" per CLAUDE.md — it's a contextual
     disclosure with no workflow of its own, so skip exclusive registration. -->

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { PlanModel } from '../composables/usePlanModel'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

const props = defineProps<{
  planModel: PlanModel
  /** Live counts for the four interaction kinds — passed in from the
   *  Plan Story strip so we share the SAME numbers it's showing. */
  sharpenRounds: number
  priorityRecords: number
  manualEdits: number
  annotationCount: number
}>()

const emit = defineEmits<{ close: [] }>()

// ── Same fair-authorship model as PlanDNAStrip (kept in sync) ─────────────────
const baseline = computed<number>(() => {
  const s = props.planModel.specSource
  if (s === 'manual')   return 80
  if (s === 'imported') return 30
  return 50
})
const baselineLabel = computed<string>(() => {
  const s = props.planModel.specSource
  if (s === 'manual')   return 'You typed this from scratch'
  if (s === 'imported') return 'You loaded an existing plan'
  return 'You prompted, AI drafted'
})
const baselineEmoji = computed<string>(() => {
  const s = props.planModel.specSource
  if (s === 'manual')   return '👥'        // Your team — humans together, typed from scratch (Tom 2026-05-12 twelfth pass: brain unclear, swapped for group-of-humans)
  if (s === 'imported') return '📥'
  return '✨'                                // AI sparkle — modern universal AI glyph
})

type Row = {
  key: string
  emoji: string
  label: string
  count: number
  weight: number     // points per occurrence
  points: number     // count × weight
  note: string       // 1-line context for the activity
}

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  if (props.sharpenRounds > 0) out.push({
    key: 'sharpen',
    emoji: '🔪',
    label: 'Sharpen rounds',
    count: props.sharpenRounds,
    weight: 5,
    points: props.sharpenRounds * 5,
    note: 'Each round = many human decisions (which question to answer, accept/reject each change)',
  })
  if (props.priorityRecords > 0) out.push({
    key: 'priority',
    emoji: '🎯',
    label: 'Priority decisions',
    count: props.priorityRecords,
    weight: 3,
    points: props.priorityRecords * 3,
    note: 'Explicit human curation — you ranked or chose what mattered',
  })
  if (props.manualEdits > 0) out.push({
    key: 'edit',
    emoji: '⌨️',
    label: 'Manual edits',
    count: props.manualEdits,
    weight: 2,
    points: props.manualEdits * 2,
    note: 'You typed changes into the spec yourself',
  })
  if (props.annotationCount > 0) out.push({
    key: 'flag',
    emoji: '🏷️',
    label: 'Annotations',
    count: props.annotationCount,
    weight: 1,
    points: props.annotationCount * 1,
    note: 'Quality flags / notes you attached to entries',
  })
  return out
})

const totalTilt    = computed(() => rows.value.reduce((s, r) => s + r.points, 0))
const handTunedPct = computed(() => Math.min(100, Math.max(0, baseline.value + totalTilt.value)))
const aiPct        = computed(() => 100 - handTunedPct.value)

const handTunedTint = computed(() => {
  if (handTunedPct.value >= 60) return 'text-emerald-300'
  if (handTunedPct.value >= 30) return 'text-amber-300'
  return 'text-rose-300'
})

const handTunedHeadline = computed(() => {
  if (handTunedPct.value >= 80) return 'You\'ve made this plan your own.'
  if (handTunedPct.value >= 60) return 'Heavy human steering — well-tuned.'
  if (handTunedPct.value >= 40) return 'Co-authored — a true partnership.'
  if (handTunedPct.value >= 20) return 'Lightly tuned — the AI did most of the typing.'
  return 'AI-heavy — your fingerprint is just starting to show.'
})

/** What to do next to grow YOUR share. */
const growTip = computed<{ emoji: string; text: string }>(() => {
  if (handTunedPct.value >= 90) return {
    emoji: '🏆',
    text: 'You\'ve nearly maxed your share. Sharpen one more round to lock it at 100%.',
  }
  if (props.sharpenRounds === 0) return {
    emoji: '🔪',
    text: 'Run a Sharpen round (+5 You per round) — the highest-leverage way to tilt the bar.',
  }
  if (props.priorityRecords === 0) return {
    emoji: '🎯',
    text: 'Record a priority decision (+3 You) to show which values matter most.',
  }
  if (props.manualEdits < 3) return {
    emoji: '✍️',
    text: 'Hand-edit a few entries (+2 You each) to put your voice into the spec wording.',
  }
  return {
    emoji: '✨',
    text: 'Another sharpen round (+5) or priority decision (+3) keeps the needle moving.',
  }
})

// ── Esc closes the panel ──────────────────────────────────────────────────────
function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}
onMounted(() => window.addEventListener('keydown', _onKey))
onUnmounted(() => window.removeEventListener('keydown', _onKey))
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[640] bg-black/60 backdrop-blur-sm"
      aria-hidden="true"
      data-handtuned-breakdown
      @click="emit('close')"
    ></div>

    <!-- Centered modal card -->
    <div
      class="fixed inset-0 z-[641] flex items-center justify-center px-4 py-8 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="handtuned-breakdown-title"
      data-handtuned-breakdown
    >
      <div
        class="pointer-events-auto w-full max-w-2xl flex flex-col overflow-hidden
               rounded-2xl shadow-2xl ring-1 ring-white/20
               bg-gradient-to-br from-indigo-900 via-violet-900 to-fuchsia-900 text-white"
      >
        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-black/20 shrink-0">
          <span class="text-2xl leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" aria-hidden="true">📖</span>
          <div class="flex-1 min-w-0">
            <h2 id="handtuned-breakdown-title" class="text-base font-bold tracking-tight truncate">
              Plan Authorship Breakdown
            </h2>
            <p class="text-[11px] text-white/70 truncate">
              Who really wrote this plan — you, or the AI?
            </p>
          </div>
          <CloseDot variant="on-dark" aria-label="Close Plan Authorship Breakdown" @click="emit('close')" />
        </div>

        <!-- Body — scrollable per Universal Scroll Rule -->
        <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="px-5 py-5 space-y-5">

          <!-- ── HERO BAR — big animated You-vs-AI split ───────────────── -->
          <div class="rounded-xl bg-white/5 ring-1 ring-white/15 p-4">
            <div class="flex items-baseline justify-between mb-2">
              <span class="text-[11px] uppercase tracking-[0.18em] font-bold text-white/60">Authorship split</span>
              <span :class="['text-xs font-semibold', handTunedTint]">{{ handTunedHeadline }}</span>
            </div>
            <!-- Tom 2026-05-12 (seventh pass): "the 2 robot symbols are not
                 clear … Brain or person -> improved results chart". Initial
                 swap put 🧠 on the You side. Tom 2026-05-12 (twelfth pass):
                 "the brain icon is not clear enough, could be a football,
                 Maybe enlarge or replace, replace could be a human or set
                 of humans (Family)". Resolved by going to 👥 (busts in
                 silhouette = team of humans) — reads as the human
                 planning team behind the plan, sharper than a brain at
                 any size, and impossible to mistake for a football. The
                 bar tells the story: AI magic ↔ human team. -->
            <!-- Hero-bar endpoint emojis at text-5xl (48 px) with strong
                 drop-shadows; the bar itself stays h-6 (24 px) but the
                 endpoints now read as dramatic faces of the AI vs You
                 contest. -->
            <!-- Tom 2026-05-12 (sixteenth pass — corrected reading of
                 fifteenth): "i am less concerned with the size=importance,
                 I was concerned with visibility and intelligibility". Hero-
                 bar BOTH endpoints at PARITY — visibility-driven, no
                 hierarchy signaling. Equal partners on a dramatically-
                 readable bar. Tom 2026-05-12 (Option B "drama"): bumped
                 text-7xl (72 px) → text-[7rem] (112 px) for both — the
                 emoji are now the unmistakable headline of the panel. -->
            <div class="flex items-center gap-4">
              <span class="text-[7rem] leading-none shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]" aria-hidden="true">✨</span>
              <div
                class="relative h-6 flex-1 rounded-full overflow-hidden bg-violet-600/80 ring-2 ring-white/20"
                role="meter"
                :aria-valuenow="handTunedPct"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuetext="`${handTunedPct} percent hand-tuned by you, ${aiPct} percent AI-authored`"
              >
                <span
                  class="absolute inset-y-0 right-0 bg-gradient-to-l from-amber-300 via-amber-200 to-emerald-300 transition-all duration-700"
                  :style="{ width: `${handTunedPct}%` }"
                  aria-hidden="true"
                ></span>
                <!-- Center divider marker -->
                <span class="absolute inset-y-0 left-1/2 w-px bg-white/30" aria-hidden="true"></span>
              </div>
              <span class="text-[7rem] leading-none shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]" aria-hidden="true">👥</span>
            </div>
            <!-- Labels under the bar — emoji at text-2xl (24 px) anchors
                 the percentages instead of fading into the typography. -->
            <div class="flex items-center justify-between mt-3 text-base font-extrabold">
              <span class="flex items-center gap-1.5 text-violet-200">
                <!-- Tom 2026-05-12 (sixteenth pass — corrected reading of
                     fifteenth): "I was concerned with visibility and
                     intelligibility", NOT importance. Under-bar glyphs at
                     PARITY — equal partners, both clearly readable. Tom
                     2026-05-12 (Option B "drama"): bumped text-3xl (30 px)
                     → text-5xl (48 px) for both. -->
                <span class="text-5xl leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" aria-hidden="true">✨</span>
                {{ aiPct }}% AI
              </span>
              <span :class="['flex items-center gap-1.5', handTunedTint]">
                {{ handTunedPct }}% You
                <span class="text-5xl leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" aria-hidden="true">👥</span>
              </span>
            </div>
          </div>

          <!-- ── ORIGIN baseline ─────────────────────────────────────────── -->
          <div>
            <div class="text-[11px] uppercase tracking-[0.18em] font-bold text-white/60 mb-2">
              Origin baseline
            </div>
            <div class="flex items-center gap-3 rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2.5">
              <span class="text-3xl leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" aria-hidden="true">{{ baselineEmoji }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold">{{ baselineLabel }}</div>
                <div class="text-[11px] text-white/55">
                  Every plan's authorship starts from how it was born — even when AI drafted, you prompted it.
                </div>
              </div>
              <span class="text-sm font-extrabold text-amber-200 shrink-0">+{{ baseline }} You</span>
            </div>
          </div>

          <!-- ── YOUR INTERACTIONS — per-activity rows ──────────────────── -->
          <div>
            <div class="flex items-baseline justify-between mb-2">
              <span class="text-[11px] uppercase tracking-[0.18em] font-bold text-white/60">
                Your interactions
              </span>
              <span class="text-[11px] text-white/55">
                tilts on top of baseline
              </span>
            </div>

            <div v-if="rows.length === 0"
                 class="rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-3 text-sm text-white/70 italic">
              No interactions yet — the bar is still at the origin baseline. Sharpen, decide, edit, or flag to tilt it toward You.
            </div>

            <ul v-else class="space-y-1.5">
              <li
                v-for="r in rows"
                :key="r.key"
                class="flex items-center gap-3 rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2.5"
                :title="r.note"
              >
                <span class="text-3xl leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" aria-hidden="true">{{ r.emoji }}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline gap-1.5">
                    <span class="text-sm font-semibold">{{ r.label }}</span>
                    <span class="text-[11px] text-white/55">× {{ r.count }} @ +{{ r.weight }}</span>
                  </div>
                  <div class="text-[11px] text-white/55 truncate">{{ r.note }}</div>
                  <!-- Mini contribution bar — shows this row's share of YOUR tilt -->
                  <div class="mt-1 h-1 rounded-full overflow-hidden bg-white/10">
                    <span
                      class="block h-full bg-gradient-to-r from-amber-300 to-emerald-300 transition-all duration-500"
                      :style="{ width: totalTilt > 0 ? `${(r.points / totalTilt) * 100}%` : '0%' }"
                      aria-hidden="true"
                    ></span>
                  </div>
                </div>
                <span class="text-sm font-extrabold text-amber-200 shrink-0">+{{ r.points }}</span>
              </li>
            </ul>
          </div>

          <!-- ── TOTAL ───────────────────────────────────────────────────── -->
          <div class="rounded-lg bg-emerald-500/15 ring-1 ring-emerald-300/40 px-3 py-3">
            <div class="flex items-center justify-between text-sm">
              <span class="font-semibold text-emerald-100">Total = baseline + interactions</span>
              <span class="font-extrabold text-emerald-200 text-base">
                {{ baseline }} + {{ totalTilt }} = {{ Math.min(100, baseline + totalTilt) }}% You
              </span>
            </div>
            <div v-if="baseline + totalTilt > 100"
                 class="text-[11px] text-emerald-200/80 mt-1 italic">
              (Capped at 100% — you've maxed out the You side of the bar.)
            </div>
          </div>

          <!-- ── GROW YOUR SHARE tip ─────────────────────────────────────── -->
          <div class="rounded-lg bg-gradient-to-r from-amber-500/15 to-fuchsia-500/15 ring-1 ring-amber-300/30 px-3 py-3">
            <div class="flex items-start gap-3">
              <span class="text-3xl leading-none shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" aria-hidden="true">{{ growTip.emoji }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-[11px] uppercase tracking-[0.18em] font-bold text-amber-200/85 mb-0.5">
                  Tip — grow your share
                </div>
                <div class="text-sm leading-snug text-white/90">{{ growTip.text }}</div>
              </div>
            </div>
          </div>

          <!-- ── Weighting key (collapsed-feeling, end-of-doc) ───────────── -->
          <details class="text-[11px] text-white/55">
            <summary class="cursor-pointer hover:text-white/80 select-none">
              How are the weights chosen?
            </summary>
            <p class="mt-2 leading-relaxed">
              Each kind of human act counts for a different number of percentage points
              because each represents a different intensity of human decision-making:
            </p>
            <ul class="mt-2 space-y-0.5 pl-4 list-disc">
              <li><b class="text-amber-200">Sharpen round +5</b> — many decisions per round (each question, each accept/reject).</li>
              <li><b class="text-amber-200">Priority decision +3</b> — explicit ranking / curation.</li>
              <li><b class="text-amber-200">Manual edit +2</b> — you typed words into the spec.</li>
              <li><b class="text-amber-200">Annotation +1</b> — a flag or short note.</li>
            </ul>
            <p class="mt-2 leading-relaxed italic">
              Tilts add to your origin baseline (50 / 80 / 30 for AI-drafted / manual / imported). The bar is capped at 100%.
            </p>
          </details>

        </ScrollContainer>
      </div>
    </div>
  </Teleport>
</template>
