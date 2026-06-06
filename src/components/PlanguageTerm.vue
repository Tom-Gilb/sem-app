<!-- UNIT_TYPE=Widget -->
<!--
  PlanguageTerm — wraps a Planguage field label with a hover/focus tooltip
  carrying the CANONICAL Glossary definition.

  History:
    - Feature #11 (original): "Explain This" Hover Tooltips with inline term
      definitions (Scale, Meter, Goal, Tolerable, Wish, etc.).
    - 2026-06-06 (Tom Gilb): the original inline definitions were paraphrased
      and in some cases WRONG (Goal was defined as "ideal target value" — the
      canonical Glossary definition is "committed promise"). Refactor: the
      component now sources from `usePlanguageTerms.PLANGUAGE_TERMS` for the
      terms that exist there (Tolerable, Goal, Wish, Stretch, Target,
      Constraint, Ambition, PercentageImpact), falling back to the original
      inline TERM_DEFINITIONS for the secondary terms (Scale, Meter, Status,
      Function, Value, Solution) until those receive their own Glossary
      treatment.

  Tom Gilb 2026-06-06 (verbatim): "Consider now, I ask, putting these terms
  in the tool, with the definition when you hover over a term like Goal. Do It."

  Composes with:
    - Planguage Glossary Definitions in Tools rule (memory file)
    - Spell-out-Type-Names rule
    - No-Generic-Icon-Libraries / DD-011

  Usage:
    <PlanguageTerm term="Goal" />
    <PlanguageTerm term="Tolerable" class="text-amber-700" />
    <PlanguageTerm term="Wish" :show-icon="false" />
-->
<template>
  <span class="planguage-term-wrapper relative inline-block">
    <span
      :id="labelId"
      ref="termAnchorEl"
      :aria-describedby="tooltipId"
      tabindex="0"
      class="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-2 hover:decoration-slate-700"
      :class="props.class"
      @mouseenter="onShow"
      @mouseleave="show = false"
      @focus="onShow"
      @blur="show = false"
    >
      {{ term }}<span
        v-if="showIcon && keyedIcon"
        class="font-mono text-[0.82em] opacity-70 ml-0.5"
        aria-hidden="true"
      >{{ keyedIcon }}</span>
    </span>
    <!-- Tom Gilb 2026-06-06 bug fix: tooltip was using absolute + left-1/2 + -translate-x-1/2,
         which overflows the viewport when the term sits near the right edge of the window
         (Tom's screenshot: WISH definition cut off at window border).  Now teleported to body
         + fixed-positioned via getBoundingClientRect, with clamp() keeping the box inside the
         viewport on both sides. -->
    <Teleport to="body">
      <span
        v-if="show && tooltipText"
        :id="tooltipId"
        role="tooltip"
        class="pointer-events-none fixed z-[10000]
               min-w-[18rem] max-w-md rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg whitespace-normal leading-snug"
        :style="tooltipStyle"
      >
        <span v-if="roleText" class="block text-amber-200 font-bold text-[10px] uppercase tracking-wide mb-0.5">
          {{ conceptNumber ? `${term} ${keyedIcon || ''} · ${conceptNumber}` : term }}
        </span>
        <span v-if="roleText" class="block text-white/90 font-semibold text-[11px] mb-1">
          {{ roleText }}
        </span>
        {{ tooltipText }}
      </span>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { PLANGUAGE_TERMS } from '../composables/usePlanguageTerms'

const props = withDefaults(defineProps<{
  /** The Planguage term to display (e.g. "Goal", "Tolerable", "Scale"). */
  term: string
  /** Additional classes forwarded to the visible label span. */
  class?: string
  /** Show the canonical Planguage keyed icon (>, >>, >?, @, !, %.→) next to the term. Default true. */
  showIcon?: boolean
}>(), {
  showIcon: true,
})

/**
 * Fallback definitions for terms that don't (yet) have a frozen Glossary entry
 * in `usePlanguageTerms.PLANGUAGE_TERMS`.  These should migrate to that
 * composable once their Glossary files are wired up.  Paraphrased — do NOT
 * treat as authoritative.
 */
const FALLBACK_TERM_DEFS: Record<string, string> = {
  Scale:    'The measurable dimension being tracked (e.g. %, count, seconds, $). The unit of measure attached to a Value or Resource entry.',
  Meter:   'How and when the Scale will be measured. The instrument or process that produces the Status reading.',
  Status:   'Current measured value (Now). The baseline against which Targets are compared.',
  Function: 'What the system DOES — an action or capability. Functions are binary (present / absent), unlike Values which are scalar.',
  Value:   'Why the Function matters — the measurable benefit it delivers. Quantified on a Scale of Measure.',
  Solution: 'How the Function is implemented — the technical approach. Estimated by its Impact on Values and its Cost in Resources.',
}

/** Lookup the canonical Glossary entry by term name (if present). */
const canonical = computed(() => {
  const map: Record<string, keyof typeof PLANGUAGE_TERMS> = {
    Tolerable:           'Tolerable',
    Goal:                'Goal',
    Wish:                'Wish',
    Stretch:             'Stretch',
    Target:              'Target',
    Constraint:          'Constraint',
    Ambition:            'Ambition',
    'Percentage Impact': 'PercentageImpact',
    PercentageImpact:    'PercentageImpact',
    IET:                 'PercentageImpact',
  }
  const key = map[props.term]
  return key ? PLANGUAGE_TERMS[key] : null
})

const tooltipText = computed(() => {
  if (canonical.value) return canonical.value.tooltipFull
  return FALLBACK_TERM_DEFS[props.term] ?? ''
})

const keyedIcon = computed(() => canonical.value?.keyedIcon ?? '')
const roleText = computed(() => canonical.value?.role ?? '')
const conceptNumber = computed(() => canonical.value?.conceptNumber ?? '')

const show = ref(false)
const termAnchorEl = ref<HTMLElement | null>(null)
const tooltipStyle = ref<Record<string, string>>({})

// Compute viewport-clamped position when tooltip shows.
// Tom Gilb 2026-06-06 bug fix: prior implementation used CSS-only centred
// positioning that overflowed the viewport on right-edge terms.
function onShow(): void {
  show.value = true
  const anchor = termAnchorEl.value
  if (!anchor) return
  // nextTick / rAF so the teleported tooltip is in DOM and measurable.
  requestAnimationFrame(() => {
    const rect = anchor.getBoundingClientRect()
    const TOOLTIP_W = 384  // matches max-w-md (24rem ≈ 384px) — safe upper bound
    const MARGIN    = 8
    // Default: centre horizontally on the term, but clamp into viewport.
    const desiredLeft = rect.left + rect.width / 2 - TOOLTIP_W / 2
    const maxLeft     = window.innerWidth - TOOLTIP_W - MARGIN
    const clampedLeft = Math.max(MARGIN, Math.min(desiredLeft, maxLeft))
    // Default: above the term; if there's no room above, drop below.
    const TOOLTIP_H = 120  // approximate; clamp handles overflow either way
    const placeAbove = rect.top - TOOLTIP_H - MARGIN > 0
    const top = placeAbove ? rect.top - TOOLTIP_H - MARGIN : rect.bottom + MARGIN
    tooltipStyle.value = {
      left: `${clampedLeft}px`,
      top:  `${top}px`,
    }
  })
}

// Unique IDs for aria wiring
const uid = Math.random().toString(36).slice(2, 8)
const labelId = `planguage-label-${uid}`
const tooltipId = `planguage-tooltip-${uid}`
</script>
