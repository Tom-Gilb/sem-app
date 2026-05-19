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
  • No CloseDot: dismiss is an item-level ✕, not a window-close affordance.
  • No ScrollContainer: content is naturally short and never clips.
  • No select-none on body content (Define-by-Selection rule).
-->
<script setup lang="ts">
import { computed } from 'vue'
import { computeImpliedEntries, type SugGroup, type ImpliedEntry } from '../utils/impliedHierarchies'

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

// ── Total: Tier 1 + Tier 2 ──────────────────────────────────────────────────
// Panel stays visible while aiLoading is true (spinner shows) even if
// Tier-1 count is zero.

const total = computed(() => suggestions.value.length + uniqueAiSugs.value.length)
const showPanel = computed(() => total.value > 0 || !!props.aiLoading)

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
          <span class="ml-1 font-normal text-white/60">({{ total }} implied by your input)</span>
        </p>
        <!-- AI loading indicator: subtle pulsing line below the subtitle -->
        <p v-if="aiLoading" class="text-amber-200 text-[10px] leading-tight animate-pulse">
          ✨ AI is looking for more…
        </p>
        <p v-else-if="aiError" class="text-red-300 text-[10px] leading-tight truncate" :title="aiError">
          ✨ AI suggestions failed
        </p>
        <p v-else class="text-white/55 text-[10px] leading-tight">
          Click&nbsp;<strong class="text-white/80">+</strong>&nbsp;to accept · hover for reason · dismiss to hide
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
      <button
        type="button"
        class="shrink-0 w-6 h-6 flex items-center justify-center rounded-full
               text-white/60 hover:text-white hover:bg-white/20
               focus:outline-none focus:ring-2 focus:ring-white/60 transition-colors"
        aria-label="Dismiss suggestions"
        title="Dismiss suggestions"
        @click="emit('dismiss')"
      >
        <span aria-hidden="true" class="text-sm leading-none">✕</span>
      </button>
    </div>

    <!-- Body -->
    <div class="px-4 py-3 space-y-3">

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
          <!-- Tier 2: AI-powered (amber + button, ✨ prefix on tooltip) -->
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
