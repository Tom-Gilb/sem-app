<!-- UNIT_TYPE=Widget -->
<!--
 * PlanIdentityBand.vue — r41 v92 (Tom Gilb 2026-06-16 "go phase 2")
 *
 * Reusable identity strip surfaced INSIDE the header of every analysis /
 * sharpening / critique panel that operates on a current spec.  Tells the
 * planner at-a-glance WHICH plan the panel is reasoning about, plus offers
 * a History picker to switch to another snapshot without leaving the panel.
 *
 * Origin: r41 v91 baked the pattern into StrategyAgentPanel; this is the
 * Phase-2 extraction.  Mounted (Phase 2 sweep) into IncorruptiblePanel,
 * ElonPanel, MariaAgentBoard, EvoCritiquerPanel, SharpenPanel.
 *
 * Five identity fields (Tom verbatim 2026-06-16):
 *   1. Plan name              ← headline; always renders ((unnamed plan))
 *   2. Owner                  ← optional, hides when empty
 *   3. Version                ← optional, hides when empty
 *   4. Spec generated date    ← optional, hides when empty
 *   5. Switch Plan dropdown   ← always renders the picker pin
 *
 * Theme prop lets each parent panel tint the band in its own brand colour
 * (orange = Strategy, red = Incorruptible, sky = Elon, violet = Maria,
 * indigo = Evo Critiquer, amber = Sharpen).  No hard-coded colour here.
 *
 * Rules: DD-017 (high contrast on dark band), MOVE Principle (all 5 fields
 * visible), accessibility_tom.md (text-white on dark = readable for 85-yo).
 -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSpecHistory } from '../composables/useSpecHistory'
import ScrollContainer from './ScrollContainer.vue'

const props = defineProps<{
  /** Plan / project name — headline.  Falls back to `fallbackName` (or "(unnamed
   *  plan)") when empty. */
  planName?: string
  /** Owner name(s) — joined string.  Hidden when empty. */
  planOwner?: string
  /** Version label e.g. "v0.1".  Hidden when empty. */
  planVersion?: string
  /** ISO timestamp of when this spec was generated.  Hidden when empty. */
  generatedAt?: string
  /**
   * r41 v392 (Tom Gilb 2026-07-01 verbatim *"ref 'unnamed plan'. We are in
   * contracts agent mode so the correct term is Contact Name. I expect you to
   * derive the name (as with the same contract in other modes)"*) — mode-aware
   * label. Callers pass "Plan" (default) or "Contract" / "Model" / "Strategy"
   * to override the small-caps label on the name headline, the fallback text
   * when the name is empty, and the "Switch Plan" picker-pin text.  One prop
   * drives all three strings so the band feels native inside every mode.
   */
  entityLabel?: string
  /**
   * Optional explicit override for the fallback text when `planName` is empty.
   * When omitted, defaults to `(unnamed <entityLabel lowercased>)`.
   */
  fallbackName?: string
  /**
   * r41 v398 (Tom Gilb 2026-07-01 verbatim *"same title duplicated"*, screenshot
   * of Contracts mode showing CONTRACT name in the top strip AND repeated
   * verbatim in the identity band beneath) — when the parent surface already
   * carries the entity name in its own header, `hideName` suppresses the
   * headline in the band while KEEPING the picker pin (`Switch <Entity>`) and
   * any owner / version / generatedAt chips.  Composes with No-Silent-Removal
   * SUPREME (band survives; only the redundant name is hidden) + MOVE Principle
   * (Switch pin stays visible for one-click switching).
   */
  hideName?: boolean
  /**
   * Tailwind class tuple for the band's colour scheme.  Each consumer panel
   * supplies its own brand-aligned colours, allowing the band to feel native
   * inside the parent header instead of grafted on.
   */
  theme?: {
    /** band background, e.g. 'bg-orange-700' */
    bg?: string
    /** band top border vs row-1 above, e.g. 'border-orange-500' */
    borderTop?: string
    /** label small-caps colour, e.g. 'text-orange-100' */
    label?: string
    /** picker pin border + hover ring, e.g. 'border-orange-300' */
    pickerBorder?: string
  }
}>()

const emit = defineEmits<{
  /** Selected history snapshot — parent should route to onHistoryRestore(). */
  (e: 'select-history', versionId: string): void
}>()

const { history } = useSpecHistory()

// r41 v460 (Tom Gilb 2026-07-02 pre-demo item 1) — helper: does a
// SpecVersion carry any real content?  A zero-entry version is either a
// Restored placeholder from the v443/v452-diagnosed Restore-mechanism
// bug OR a genuinely-empty snapshot Tom took before typing anything;
// either way it is noise in the picker.  Composes with v453 landing-grid
// filter + v456 audience-declaration (Vice Admiral clicks a Restored
// entry expecting content, gets 0 → trust death).
function _versionHasContent(v: { spec?: { functions?: unknown[]; values?: unknown[]; stakeholders?: unknown[]; constraints?: unknown[]; resources?: unknown[] } }): boolean {
  const s = v.spec ?? {}
  const total =
    (Array.isArray(s.functions)    ? s.functions.length    : 0) +
    (Array.isArray(s.values)       ? s.values.length       : 0) +
    (Array.isArray(s.stakeholders) ? s.stakeholders.length : 0) +
    (Array.isArray(s.constraints)  ? s.constraints.length  : 0) +
    (Array.isArray(s.resources)    ? s.resources.length    : 0)
  return total > 0
}

const showEmptyHistoryVersions = ref(false)

const historyOptionsAll = computed(() => history.value.map((v) => ({
  id: v.id,
  label: v.specName || v.planName || '(unnamed)',
  version: v.label,
  timestamp: v.timestamp,
  summary: v.summary,
  dateLabel: new Date(v.timestamp).toLocaleString('en-US', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }),
  hasContent: _versionHasContent(v),
})))

const historyOptionsFilledOnly = computed(() => historyOptionsAll.value.filter(o => o.hasContent))
const historyOptionsEmpty      = computed(() => historyOptionsAll.value.filter(o => !o.hasContent))
const historyOptions           = computed(() => showEmptyHistoryVersions.value ? historyOptionsAll.value : historyOptionsFilledOnly.value)

const historyPickerOpen = ref(false)

function onPickHistory(versionId: string) {
  emit('select-history', versionId)
  historyPickerOpen.value = false
}

const generatedAtLabel = computed(() => {
  if (!props.generatedAt) return ''
  try {
    const d = new Date(props.generatedAt)
    return d.toLocaleString('en-US', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ''
  }
})

// Resolved theme — caller-supplied tokens with sensible orange defaults so
// callers can omit `theme` entirely if they want the Strategy-Agent palette.
const themeBg          = computed(() => props.theme?.bg          ?? 'bg-orange-700')
const themeBorderTop   = computed(() => props.theme?.borderTop   ?? 'border-orange-500')
const themeLabel       = computed(() => props.theme?.label       ?? 'text-orange-100')
const themePickerBorder = computed(() => props.theme?.pickerBorder ?? 'border-orange-300')

// r41 v392 — mode-aware label strings.  Default "Plan" keeps the legacy
// behaviour verbatim; passing "Contract" (or "Model" / "Strategy") retitles
// the headline label, the empty-name fallback, and the picker-pin text.
const entityLabel   = computed(() => props.entityLabel?.trim() || 'Plan')
const entityLower   = computed(() => entityLabel.value.toLowerCase())
const nameHeadline  = computed(() => props.planName?.trim() || props.fallbackName || `(unnamed ${entityLower.value})`)
const nameTitleHint = computed(() => props.planName?.trim() || `(no ${entityLower.value} name set)`)
</script>

<template>
  <div
    class="flex items-center gap-2 flex-wrap px-5 py-2 text-[11px] border-t text-white"
    :class="[themeBg, themeBorderTop]"
    aria-label="Plan identity band"
  >
    <!-- Plan / Contract / Model name (headline) — label driven by entityLabel prop.
         r41 v398 — suppressed via `hideName` when the parent surface already carries
         the entity name in its own header (avoids the "same title duplicated" bug). -->
    <template v-if="!hideName">
      <span class="font-bold uppercase tracking-wide text-[9px]" :class="themeLabel">{{ entityLabel }}:</span>
      <span
        class="font-bold text-white text-sm leading-tight"
        :title="nameTitleHint"
      >{{ nameHeadline }}</span>
    </template>

    <!-- Owner -->
    <span v-if="planOwner" class="font-bold uppercase tracking-wide text-[9px] ml-3" :class="themeLabel">Owner:</span>
    <span v-if="planOwner" class="text-white font-semibold">{{ planOwner }}</span>

    <!-- Version -->
    <span v-if="planVersion" class="font-bold uppercase tracking-wide text-[9px] ml-3" :class="themeLabel">Version:</span>
    <span v-if="planVersion" class="text-white font-mono font-semibold">{{ planVersion }}</span>

    <!-- Spec generated date / time -->
    <span v-if="generatedAtLabel" class="font-bold uppercase tracking-wide text-[9px] ml-3" :class="themeLabel">Spec:</span>
    <span v-if="generatedAtLabel" class="text-white">{{ generatedAtLabel }}</span>

    <!-- History picker -->
    <div class="ml-auto relative">
      <button
        type="button"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold border border-white/30 transition-colors"
        :title="`Choose another ${entityLabel} / Spec from history to operate on instead — click to open the picker`"
        :aria-expanded="historyPickerOpen"
        @click="historyPickerOpen = !historyPickerOpen"
      >
        <span class="font-mono leading-none">↻</span>
        <span>Switch {{ entityLabel }}</span>
        <span class="text-[9px]" :class="themeLabel">({{ historyOptions.length }})</span>
        <span class="text-[9px]">{{ historyPickerOpen ? '▲' : '▼' }}</span>
      </button>

      <!-- Dropdown -->
      <div
        v-if="historyPickerOpen"
        class="absolute right-0 top-full mt-1 w-[420px] max-w-[90vw] bg-white text-slate-800 rounded-lg shadow-2xl border z-10 overflow-hidden"
        :class="themePickerBorder"
        role="menu"
        aria-label="Past Versions picker — select another plan or spec version"
      >
        <div class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <span class="text-xs font-bold text-slate-800">Switch {{ entityLabel }} / Spec Version</span>
          <span class="text-[10px] text-slate-500 ml-auto">{{ historyOptions.length }} with content</span>
        </div>
        <!-- r41 v460 (Tom Gilb 2026-07-02 pre-demo item 1) — hide the
             zero-content Restored placeholders + abandoned-import
             versions by default; expose a toggle so nothing is silently
             removed (No-Silent-Removal SUPREME).  Same reveal pattern
             as the v453 landing-grid filter. -->
        <div
          v-if="historyOptionsEmpty.length > 0"
          class="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[10px] text-amber-900 flex items-center justify-between gap-2"
        >
          <span><strong>{{ historyOptionsEmpty.length }} empty version{{ historyOptionsEmpty.length === 1 ? '' : 's' }} hidden</strong> (zero-entry placeholders — usually from the Restore-mechanism issue Claudian is tracking).</span>
          <button
            type="button"
            class="shrink-0 px-2 py-0.5 rounded bg-white border border-amber-300 hover:bg-amber-100 text-[10px] font-semibold"
            @click.stop="showEmptyHistoryVersions = !showEmptyHistoryVersions"
          >{{ showEmptyHistoryVersions ? 'Hide' : 'Show ' + historyOptionsEmpty.length }}</button>
        </div>
        <ScrollContainer outer-class="max-h-80" inner-class="">
          <div v-if="historyOptions.length === 0" class="px-3 py-4 text-xs text-slate-500 italic">
            No history yet — versions appear here after the first generation or save.
          </div>
          <button
            v-for="opt in historyOptions"
            :key="opt.id"
            type="button"
            class="w-full text-left px-3 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors"
            :title="`Switch to ${opt.label} — ${opt.version} · ${opt.dateLabel}`"
            @click="onPickHistory(opt.id)"
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-slate-800 flex-1 min-w-0 truncate">{{ opt.label }}</span>
              <span class="text-[10px] font-mono text-slate-700 bg-slate-100 rounded px-1.5 py-0.5 shrink-0">{{ opt.version }}</span>
            </div>
            <div class="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
              <span>{{ opt.dateLabel }}</span>
              <span class="text-slate-400">·</span>
              <span class="truncate">{{ opt.summary }}</span>
            </div>
          </button>
        </ScrollContainer>
      </div>
    </div>
  </div>
</template>
