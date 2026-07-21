<!-- UNIT_TYPE=Widget -->
<!--
 * StageTaskWorkspace.vue — reusable task-centric workspace card per Stage-
 * Has-A-Purpose SUPREME (Tom Gilb 2026-06-21 verbatim: *"the main idea in
 * stg 2 is generating more and better solutions, for the values, resources,
 * constraints"* + *"I do not know what the planguage spec are there, no
 * one asked for them, they are under the hood. WE can see them if we want
 * by using tools."*).
 *
 * v417 (2026-07-01 audit-backlog item #2 — Stage 1 task-centric workspace):
 * this generic component IS the pattern items #5-9 (Stages 6/7/8/9/10) will
 * inherit. One component renders any stage's task-centric workspace given
 * its purpose sentence + action pin registry.
 *
 * Design (per Stage-Has-A-Purpose SUPREME + memory rule
 * rule_stage_has_a_purpose.md):
 *   - Purpose sentence at top — plain English, ONE line, names the stage's
 *     PRIMARY job (e.g. Stage 1: "Capture stakeholders + values, so Stage 2
 *     can propose solutions")
 *   - Action pins as prominent CTA row — each pin has glyph + short label +
 *     HoverHint describing what it does + optional badge (count / warning)
 *   - Under-the-hood strip — small footer noting "View spec anytime via
 *     Spec Editor" (Zero-Training UI reminder that infrastructure is a
 *     click away, not the primary surface)
 *
 * Composes with:
 *   - Stage-Has-A-Purpose SUPREME (rule_stage_has_a_purpose.md)
 *   - Stages-are-Cyclic SUPREME (every stage is revisitable — no
 *     terminal states)
 *   - Done/You-Can/Continue SUPREME (action pins are OFFERINGS, not
 *     commands; planner picks)
 *   - MOVE Principle SUPREME (action pins visible at-a-glance)
 *   - Icon-Plus-Text SUPREME (glyph + label per pin)
 *   - AI-Max SUPREME (Generate-* pins are AI-driven starters, not blank
 *     text fields)
 *   - No-Silent-Removal SUPREME (this component is ADDITIVE; existing
 *     sub-step strips + progress banners are preserved)
 *   - Twin portability — pure Vue SFC generic; ports verbatim
 -->
<script setup lang="ts" generic="A extends string">
import { computed } from 'vue'

/** One task action a planner can pick from the workspace card. */
interface StageAction<AK extends string> {
  /** Stable key for @action emit + Vue v-for tracking. */
  key:       AK
  /** Short glyph (emoji or 1-char) — Icon-Plus-Text SUPREME.  Language-neutral. */
  glyph:     string
  /** ≤ 5-word action verb (e.g. "Generate Values"). */
  label:     string
  /** ≤ 12-word one-line action framing (e.g. "AI generates Value entries per Stakeholder"). */
  shortHint: string
  /** Verbatim HoverHint (2-3 sentences) — DD-009 Zero-Training UI. */
  longHint:  string
  /** Optional badge shown next to label (e.g. "(3 done)", "12 candidates"). */
  badge?:    string
  /** Optional visual tone override — 'primary' amber highlight, 'ai' indigo, 'secondary' slate default. */
  tone?:     'primary' | 'ai' | 'secondary'
  /** When true, pin is disabled with a HoverHint explaining why. */
  disabled?: boolean
  /** When disabled — the plain-English reason.  Rendered as the HoverHint. */
  disabledReason?: string
}

const props = defineProps<{
  /** Stage number 1-11.  Used in aria-label + Continue button naming. */
  stageNum: number
  /** Short display name of the stage (e.g. "Stakes", "Solutions", "Evo Steps"). */
  stageName: string
  /** Primary purpose sentence — Stage-Has-A-Purpose SUPREME.  ≤ 25 words. */
  purpose: string
  /** Optional subtitle / hint below the purpose (e.g. Ries or Gilb citation). */
  subtitle?: string
  /** Ordered array of action pins. */
  actions: readonly StageAction<A>[]
  /** Optional "Under the hood" reminder text — defaults to a Zero-Training UI framing. */
  underTheHood?: string
}>()

const emit = defineEmits<{
  /** Fires when the planner clicks any action pin. */
  (e: 'action', key: A): void
}>()

// Default under-the-hood copy — Zero-Training UI reminder that spec is
// infrastructure, not the primary surface (Stage-Has-A-Purpose SUPREME).
const underTheHoodText = computed<string>(() =>
  props.underTheHood ??
  'Your Planguage spec is under the hood — open any time via the Spec Editor pin. This workspace is the task surface.'
)

function toneClasses(tone: StageAction<A>['tone']): string {
  switch (tone) {
    case 'primary':
      // AI-Max primary CTA — high-contrast amber/orange
      return 'bg-gradient-to-br from-amber-500 to-orange-500 text-white ring-2 ring-amber-300 shadow-md hover:from-amber-600 hover:to-orange-600'
    case 'ai':
      // AI-generated content pin — indigo (matches AI-Max chip family)
      return 'bg-indigo-600 text-white ring-2 ring-indigo-300 shadow-md hover:bg-indigo-700'
    default:
      // Secondary / neutral — slate default with border
      return 'bg-white text-slate-800 ring-1 ring-slate-300 shadow-sm hover:bg-slate-50 hover:ring-slate-400'
  }
}

function onClick(a: StageAction<A>): void {
  if (a.disabled) return
  emit('action', a.key)
}
</script>

<template>
  <section
    class="w-full max-w-3xl mx-auto mt-4 mb-3 rounded-2xl ring-1 ring-amber-300/70 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/50 px-5 py-4 shadow-sm"
    role="region"
    :aria-label="`Stage ${stageNum} · ${stageName} — task-centric workspace`"
  >
    <!-- Header — stage identity + purpose sentence -->
    <header class="mb-3">
      <p class="text-[11px] font-bold text-amber-900 uppercase tracking-[0.14em] mb-1">
        Stage {{ stageNum }} · {{ stageName }}
      </p>
      <p class="text-[15px] leading-snug text-slate-900 font-semibold">
        {{ purpose }}
      </p>
      <p
        v-if="subtitle"
        class="text-[11px] italic text-slate-600 mt-1 leading-snug"
      >
        {{ subtitle }}
      </p>
    </header>

    <!-- Action pin grid — the CORE of the task-centric workspace. -->
    <ul
      class="grid gap-2.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 list-none"
      :aria-label="`Stage ${stageNum} actions`"
    >
      <li
        v-for="a in actions"
        :key="a.key"
      >
        <button
          type="button"
          :disabled="a.disabled"
          :class="[
            'w-full text-left rounded-xl px-3.5 py-3 flex items-start gap-2.5 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300',
            a.disabled
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed ring-1 ring-slate-200'
              : toneClasses(a.tone),
          ]"
          :title="a.disabled
            ? (a.disabledReason ?? 'Not available yet — complete an earlier action first.')
            : `${a.label} — ${a.shortHint}.  ${a.longHint}`"
          :aria-label="a.disabled
            ? `${a.label} (unavailable): ${a.disabledReason ?? 'unavailable'}`
            : `${a.label} — ${a.shortHint}`"
          @click="onClick(a)"
        >
          <span
            aria-hidden="true"
            class="shrink-0 text-2xl leading-none mt-0.5"
          >{{ a.glyph }}</span>
          <span class="flex-1 min-w-0">
            <span class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[13px] font-bold leading-tight">{{ a.label }}</span>
              <span
                v-if="a.badge"
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/80 text-slate-700 ring-1 ring-slate-300/70"
              >{{ a.badge }}</span>
            </span>
            <span class="block text-[11.5px] mt-0.5 leading-snug"
                  :class="a.disabled ? 'text-slate-400' : (a.tone === 'primary' || a.tone === 'ai' ? 'text-white/85' : 'text-slate-600')"
            >{{ a.shortHint }}</span>
          </span>
        </button>
      </li>
    </ul>

    <!-- Under-the-hood footer — Zero-Training UI reminder + Stages-are-Cyclic
         reassurance so planner never feels locked out of infrastructure. -->
    <footer class="mt-3 pt-2 border-t border-amber-200/60 flex items-start gap-2 text-[10.5px] text-slate-600 italic leading-snug">
      <span aria-hidden="true" class="shrink-0 mt-0.5">🔧</span>
      <span>{{ underTheHoodText }} · Stages are cyclic — return anytime.</span>
    </footer>
  </section>
</template>
