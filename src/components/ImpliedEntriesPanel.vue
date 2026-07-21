<!--
  ImpliedEntriesPanel.vue — "Suggested additions" panel for stage 2 (review).

  PURPOSE
  ───────
  After the parser classifies raw text into chips, this panel appears below the
  three chip sections and proposes ADDITIONAL entries implied by domain
  knowledge.

  TWO TIERS
  ─────────
  Tier 1 — rule-based (impliedHierarchies.ts): instant, zero latency.
  Tier 2 — LLM-powered (useImpliedEntriesAI.ts): fires alongside Tier 1,
    arrives a few seconds later. AI suggestions are badged with ✨ so the
    user can distinguish them from rule-derived ones.

  PROPS
  ─────
  :stakeholders / :values / :means  — current chips (Tier 1 input)
  :ai-suggestions                   — ImpliedEntry[] from useImpliedEntriesAI
  :ai-loading                       — true while the AI call is in-flight
  :ai-error                         — non-empty string if the AI call failed

  INTERACTION
  ───────────
  Each suggestion appears as a tappable chip with a [+] button.
  Click [+] → emits `add` with the group + text.
  The parent (SEMEntryForm.vue) pushes the entry into the correct chips array.
  Because the parent passes live chip arrays as props, suggestions that are
  already added disappear immediately without needing extra state here.

  Closes/hides when:
    • The user clicks the ✕ dismiss button (emits `dismiss`)
    • All suggestions are exhausted (panel hides automatically)
    • AI is still loading but no Tier-1 suggestions remain → panel stays
      visible showing the AI loading indicator

  Tom 2026-05-17: "How is it going with my request earlier today for
  advanced parsing?" — Tier 1 is the implementation; Tier 2 adds the
  LLM layer ("go ahead with tier 2").

  UI RULES COMPLIANCE
  ───────────────────
  • This is an INLINE panel (not a full-screen modal) — no registerExclusiveSurface.
  • CloseDot (on-light) for the dismiss/close button — CloseDot rule applies to ALL closable panels.
  • No ScrollContainer: content is naturally short and never clips.
  • No select-none on body content (Define-by-Selection rule).
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { computeImpliedEntries, type SugGroup, type ImpliedEntry } from '../utils/impliedHierarchies'
import CloseDot from './CloseDot.vue'

const props = defineProps<{
  stakeholders: string[]
  values: string[]
  means: string[]
  /** Tier 2: AI-powered suggestions from useImpliedEntriesAI */
  aiSuggestions?: ImpliedEntry[]
  /** True while the AI call is in-flight */
  aiLoading?: boolean
  /** Non-empty if the AI call failed */
  aiError?: string
}>()

const emit = defineEmits<{
  add: [group: SugGroup, text: string]
  /** Accept every visible suggestion (Tier 1 + Tier 2) in one click. */
  'add-all': [entries: Array<{ group: SugGroup; text: string }>]
  dismiss: []
}>()

// ── Tier 1: rule-based suggestions ──────────────────────────────────────────

const suggestions = computed(() =>
  computeImpliedEntries({
    stakeholders: props.stakeholders,
    values:       props.values,
    means:        props.means,
  })
)

const stakeholderSugs = computed(() => suggestions.value.filter(s => s.group === 'stakeholders'))
const valueSugs       = computed(() => suggestions.value.filter(s => s.group === 'values'))
const meansSugs       = computed(() => suggestions.value.filter(s => s.group === 'means'))

// ── Tier 2: AI suggestions (deduplicated against Tier 1) ────────────────────

const _tier1Keys = computed(() =>
  new Set(suggestions.value.map(s => `${s.group}:${s.text.toLowerCase()}`))
)

const uniqueAiSugs = computed(() =>
  (props.aiSuggestions ?? []).filter(
    s => !_tier1Keys.value.has(`${s.group}:${s.text.toLowerCase()}`)
  )
)

const aiStakeholderSugs = computed(() => uniqueAiSugs.value.filter(s => s.group === 'stakeholders'))
const aiValueSugs       = computed(() => uniqueAiSugs.value.filter(s => s.group === 'values'))
const aiMeansSugs       = computed(() => uniqueAiSugs.value.filter(s => s.group === 'means'))

// ── r41 v397 (Tom Gilb 2026-06-27 verbatim "if I select some implied S E M
// does it recompute to see if those selections imply more factors, I think it
// did before and that is quite elegant, and should be 'announced' (Your
// selections imply yet more factors')") — Cascade announcement.
//
// Recomputation already works because `suggestions` is a Vue computed over
// `props.stakeholders/values/means` and SEMEntryForm pushes accepted chip
// texts into those arrays.  Each acceptance re-fires `computeImpliedEntries`
// against the new chip set; rules that match the freshly-added chip's text
// pattern produce NEW derivations.  v397 adds the announcement Tom remembers:
// a violet banner above the panel reads "✨ Your selections imply N more
// factor(s)" the moment new derivations appear post-acceptance.
//
// Implementation: watch `suggestions` for set-difference between recomputes.
// `_firstRun` flag skips the initial mount fire (we don't want to announce
// the original suggestions as "new"); subsequent fires diff the new key set
// against the previous to count strictly-new derivations.  Items REMOVED
// (the just-accepted chip) don't contribute to the diff because they're not
// in the new set.  Banner dismisses on explicit ✕ OR auto-replaces on next
// cascade event.

type SugKey = string  // `${group}:${text.toLowerCase()}`
function _toKey(s: { group: SugGroup; text: string }): SugKey {
  return `${s.group}:${s.text.toLowerCase()}`
}

const _previousSugKeys = ref<Set<SugKey>>(new Set())
let   _firstSuggestionRun = true
const newDerivationCount = ref<number>(0)

watch(suggestions, (newSugs) => {
  const newKeys = new Set(newSugs.map(_toKey))
  if (!_firstSuggestionRun) {
    let added = 0
    for (const k of newKeys) {
      if (!_previousSugKeys.value.has(k)) added++
    }
    if (added > 0) newDerivationCount.value = added
    // If no new derivations were added but the user did accept something,
    // we leave the previous count visible until the user dismisses or until
    // another cascade fires.  Setting to 0 only when an empty-cascade should
    // NOT clobber an existing announcement is intentional: the planner gets
    // to see the prior announcement until they read + dismiss it.
  }
  _previousSugKeys.value = newKeys
  _firstSuggestionRun = false
})

function dismissCascadeBanner(): void {
  newDerivationCount.value = 0
}

// ── Total: Tier 1 + Tier 2 ──────────────────────────────────────────────────
// Panel stays visible while aiLoading is true (spinner shows) even if
// Tier-1 count is zero.

const total = computed(() => suggestions.value.length + uniqueAiSugs.value.length)
// r41 v54 (Tom Gilb 2026-06-16 verbatim: "as u see there was no implied
// suggestions below the parse") — No-Silent-Data-Loss SUPREME: when neither
// tier finds suggestions AND AI is not loading AND AI did not error, the
// panel previously hid entirely with zero feedback. Tom's domain (17th-
// century ship-naming text) is outside the Tier-1 rule base, and Tier 2
// AI is currently grandfathered/optional. Result: silent disappear.
// Fix: always render the panel during review so the planner sees explicit
// feedback ("Checked — no additional implications found for this input")
// instead of guessing whether the parser even tried. Composes with the
// SEM-teaches-incrementally rule + AI-Max principle.
const showPanel = computed(() => true)
const hasContent = computed(() => total.value > 0 || !!props.aiLoading || !!props.aiError)

/** Flat list of ALL suggestions — used by Accept All. */
const allSuggestions = computed(() =>
  [
    ...suggestions.value,
    ...uniqueAiSugs.value,
  ].map(s => ({ group: s.group, text: s.text }))
)

function acceptAll(): void {
  emit('add-all', allSuggestions.value)
  emit('dismiss')
}

// Colour theme per group — matches the parent chip sections
const GROUP_THEME = {
  stakeholders: { bg: 'bg-indigo-50',  border: 'border-indigo-200', text: 'text-indigo-700',   btn: 'hover:bg-indigo-100 text-indigo-400 hover:text-indigo-700',  dot: 'bg-indigo-500',  aibtn: 'bg-amber-400 group-hover:bg-amber-500' },
  values:       { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700',  btn: 'hover:bg-emerald-100 text-emerald-400 hover:text-emerald-700', dot: 'bg-emerald-500', aibtn: 'bg-amber-400 group-hover:bg-amber-500' },
  means:        { bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700',   btn: 'hover:bg-orange-100 text-orange-400 hover:text-orange-700',   dot: 'bg-orange-500',  aibtn: 'bg-amber-400 group-hover:bg-amber-500' },
} as const

// Labels for each group
const GROUP_LABEL: Record<SugGroup, string> = {
  stakeholders: '👤 Who',
  values:       '📊 How Well',
  means:        '⚙ How',
}
</script>

<template>
  <!-- Hide entirely when no suggestions and AI not loading -->
  <section
    v-if="showPanel"
    class="rounded-xl border border-violet-200 bg-violet-50/60 shadow-sm overflow-hidden"
    aria-labelledby="implied-header"
  >
    <!-- Header -->
    <div
      class="flex items-center gap-2 px-4 py-2.5
             bg-gradient-to-r from-violet-600 to-indigo-600"
    >
      <span class="text-base shrink-0" aria-hidden="true">💡</span>
      <div class="flex-1 min-w-0">
        <p id="implied-header" class="text-white text-[12px] font-semibold leading-tight">
          Suggested additions
          <span v-if="total > 0" class="ml-1 font-normal text-white/60">({{ total }} implied by your input)</span>
          <span v-else-if="aiLoading" class="ml-1 font-normal text-white/60">(checking…)</span>
          <span v-else class="ml-1 font-normal text-white/60">(none additional implied)</span>
        </p>
        <!-- AI loading indicator: subtle pulsing line below the subtitle -->
        <p v-if="aiLoading" class="text-amber-200 text-[10px] leading-tight animate-pulse">
          ✨ AI is looking for more…
        </p>
        <p v-else-if="aiError" class="text-red-300 text-[10px] leading-tight truncate" :title="aiError">
          ✨ AI suggestions failed
        </p>
        <p v-else class="text-white/55 text-[10px] leading-tight">
          Click&nbsp;<strong class="text-white/80">+</strong>&nbsp;to accept · hover any item for reason
        </p>
      </div>
      <!-- Accept All: one click adds every Tier-1 + Tier-2 suggestion and dismisses.
           Disabled while AI is still loading (count would be incomplete). -->
      <button
        v-if="total > 0"
        type="button"
        class="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px]
               font-bold bg-white/20 text-white hover:bg-white/35
               focus:outline-none focus:ring-2 focus:ring-white/60 transition-colors
               disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="!!props.aiLoading"
        :title="props.aiLoading ? 'Wait for AI suggestions before accepting all' : `Accept all ${total} suggestions`"
        aria-label="Accept all suggestions"
        @click="acceptAll"
      >
        <span aria-hidden="true" class="text-base leading-none">+</span>
        <span>All</span>
      </button>
      <CloseDot
        variant="on-dark"
        aria-label="Close this suggestions panel"
        title="Close this suggestions panel"
        @click="emit('dismiss')"
      />
    </div>

    <!-- Body -->
    <div class="px-4 py-3 space-y-3">

      <!-- r41 v397 (Tom Gilb 2026-06-27 verbatim "should be 'announced'
           (Your selections imply yet more factors'") — Cascade announcement
           banner.  Renders when the post-acceptance recompute surfaced at
           least one NEW derivation (set-difference vs previous suggestion
           keys, computed in the `suggestions` watcher above).  Persists
           until the user dismisses or until the next cascade event replaces
           the count — never auto-dismisses on a timer (universal accessibility:
           important messages must persist for any reader to parse). -->
      <div
        v-if="newDerivationCount > 0"
        role="status"
        aria-live="polite"
        class="flex items-center gap-2 px-3 py-2 rounded-lg
               bg-violet-200 border-2 border-violet-500 ring-2 ring-violet-300"
      >
        <span aria-hidden="true" class="text-base leading-none">✨</span>
        <p class="flex-1 text-[13px] font-semibold text-violet-900 leading-snug">
          Your selections imply
          <span class="font-extrabold">{{ newDerivationCount }}</span>
          more factor{{ newDerivationCount === 1 ? '' : 's' }} — see the chips below.
        </p>
        <button
          type="button"
          class="shrink-0 w-6 h-6 flex items-center justify-center rounded-full
                 text-violet-700 hover:bg-violet-300 hover:text-violet-900
                 focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Dismiss cascade announcement"
          title="Dismiss"
          @click="dismissCascadeBanner"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <!-- r41 v54 (Tom Gilb 2026-06-16) — empty-state fallback. Previously this
           panel silently hid (v-if showPanel=false) when neither Tier 1 nor
           Tier 2 found anything. That was a No-Silent-Data-Loss violation:
           the planner could not tell whether the parser even tried. Now the
           panel always renders during review; when nothing was found, this
           reassuring message takes the place of suggestion chips. Composes
           with SEM-teaches-incrementally + AI-Max + DD-009 Interaction
           Disclosure (always-explicit feedback). -->
      <div
        v-if="!hasContent"
        class="flex items-start gap-2 text-[12px] text-violet-700/90 italic"
      >
        <span class="shrink-0 text-base leading-none" aria-hidden="true">✓</span>
        <p>
          Checked — no additional stakeholders, values, or means were implied by your input beyond what you already typed.
          <span class="block text-[11px] not-italic text-violet-600/70 mt-0.5">
            (Implied-suggestions catalogue covers common modern domains — niche or historical input may legitimately have nothing more to add.)
          </span>
        </p>
      </div>


      <!-- Stakeholders -->
      <div v-if="stakeholderSugs.length > 0 || aiStakeholderSugs.length > 0">
        <p class="text-[10px] font-bold uppercase tracking-wide text-indigo-500 mb-1.5">
          {{ GROUP_LABEL.stakeholders }}
        </p>
        <div class="flex flex-wrap gap-1.5">
          <!-- Tier 1: rule-based -->
          <button
            v-for="sug in stakeholderSugs"
            :key="sug.text"
            type="button"
            class="group flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full border text-[12px]
                   transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
            :class="`${GROUP_THEME.stakeholders.bg} ${GROUP_THEME.stakeholders.border} ${GROUP_THEME.stakeholders.text}`"
            :title="sug.why"
            :aria-label="`Add stakeholder: ${sug.text}. ${sug.why}`"
            @click="emit('add', 'stakeholders', sug.text)"
          >
            <span>{{ sug.text }}</span>
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold
                     bg-indigo-500 text-white group-hover:bg-indigo-600 transition-colors"
              aria-hidden="true"
            >+</span>
          </button>
          <!-- Tier 2: AI-powered (amber + button, ✨ prefix on HoverHint) -->
          <button
            v-for="sug in aiStakeholderSugs"
            :key="`ai-${sug.text}`"
            type="button"
            class="group flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full border text-[12px]
                   transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
            :class="`${GROUP_THEME.stakeholders.bg} ${GROUP_THEME.stakeholders.border} ${GROUP_THEME.stakeholders.text}`"
            :title="`✨ AI: ${sug.why}`"
            :aria-label="`Add stakeholder: ${sug.text}. AI suggestion: ${sug.why}`"
            @click="emit('add', 'stakeholders', sug.text)"
          >
            <span class="text-amber-500 shrink-0 leading-none" aria-hidden="true">✨</span>
            <span>{{ sug.text }}</span>
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold
                     text-white transition-colors"
              :class="GROUP_THEME.stakeholders.aibtn"
              aria-hidden="true"
            >+</span>
          </button>
        </div>
      </div>

      <!-- Values -->
      <div v-if="valueSugs.length > 0 || aiValueSugs.length > 0">
        <p class="text-[10px] font-bold uppercase tracking-wide text-emerald-600 mb-1.5">
          {{ GROUP_LABEL.values }}
        </p>
        <div class="flex flex-wrap gap-1.5">
          <!-- Tier 1: rule-based -->
          <button
            v-for="sug in valueSugs"
            :key="sug.text"
            type="button"
            class="group flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full border text-[12px]
                   transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
            :class="`${GROUP_THEME.values.bg} ${GROUP_THEME.values.border} ${GROUP_THEME.values.text}`"
            :title="sug.why"
            :aria-label="`Add value: ${sug.text}. ${sug.why}`"
            @click="emit('add', 'values', sug.text)"
          >
            <span>{{ sug.text }}</span>
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold
                     bg-emerald-500 text-white group-hover:bg-emerald-600 transition-colors"
              aria-hidden="true"
            >+</span>
          </button>
          <!-- Tier 2: AI-powered -->
          <button
            v-for="sug in aiValueSugs"
            :key="`ai-${sug.text}`"
            type="button"
            class="group flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full border text-[12px]
                   transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
            :class="`${GROUP_THEME.values.bg} ${GROUP_THEME.values.border} ${GROUP_THEME.values.text}`"
            :title="`✨ AI: ${sug.why}`"
            :aria-label="`Add value: ${sug.text}. AI suggestion: ${sug.why}`"
            @click="emit('add', 'values', sug.text)"
          >
            <span class="text-amber-500 shrink-0 leading-none" aria-hidden="true">✨</span>
            <span>{{ sug.text }}</span>
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold
                     text-white transition-colors"
              :class="GROUP_THEME.values.aibtn"
              aria-hidden="true"
            >+</span>
          </button>
        </div>
      </div>

      <!-- Means -->
      <div v-if="meansSugs.length > 0 || aiMeansSugs.length > 0">
        <p class="text-[10px] font-bold uppercase tracking-wide text-orange-500 mb-1.5">
          {{ GROUP_LABEL.means }}
        </p>
        <div class="flex flex-wrap gap-1.5">
          <!-- Tier 1: rule-based -->
          <button
            v-for="sug in meansSugs"
            :key="sug.text"
            type="button"
            class="group flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full border text-[12px]
                   transition-all focus:outline-none focus:ring-2 focus:ring-orange-400"
            :class="`${GROUP_THEME.means.bg} ${GROUP_THEME.means.border} ${GROUP_THEME.means.text}`"
            :title="sug.why"
            :aria-label="`Add means: ${sug.text}. ${sug.why}`"
            @click="emit('add', 'means', sug.text)"
          >
            <span>{{ sug.text }}</span>
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold
                     bg-orange-500 text-white group-hover:bg-orange-600 transition-colors"
              aria-hidden="true"
            >+</span>
          </button>
          <!-- Tier 2: AI-powered -->
          <button
            v-for="sug in aiMeansSugs"
            :key="`ai-${sug.text}`"
            type="button"
            class="group flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-full border text-[12px]
                   transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
            :class="`${GROUP_THEME.means.bg} ${GROUP_THEME.means.border} ${GROUP_THEME.means.text}`"
            :title="`✨ AI: ${sug.why}`"
            :aria-label="`Add means: ${sug.text}. AI suggestion: ${sug.why}`"
            @click="emit('add', 'means', sug.text)"
          >
            <span class="text-amber-500 shrink-0 leading-none" aria-hidden="true">✨</span>
            <span>{{ sug.text }}</span>
            <span
              class="w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold
                     text-white transition-colors"
              :class="GROUP_THEME.means.aibtn"
              aria-hidden="true"
            >+</span>
          </button>
        </div>
      </div>

    </div>
  </section>
</template>
