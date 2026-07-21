<!-- UNIT_TYPE=Widget -->
<!--
 * SourcePin — per-field source attribution indicator (Tom Gilb 2026-06-09).
 *
 * A tiny inline widget placed at the right of a field label or field value
 * in the Penta editor. Displays a [←] keyed icon (Planguage: source flows
 * INTO the spec from outside). Always visible; color indicates attribution state.
 *
 * DD-011: no generic SVG — uses keyed text [←] (Planguage Glyph-First).
 * DD-015: [←] is a universal symbol, not a Latin letter abbreviation.
 * DD-017: inline card uses white/light background so colored text is readable.
 * MOVE principle: always visible (not hidden behind menu), tiny so never clutter.
 *
 * Smart positioning: card flips LEFT when near the right viewport edge so it
 * never clips. Direction is evaluated on each open.
 *
 * "Source: will always be specified explicitly or implied from editing or
 *  AI change activity." — Tom Gilb Planguage rule.
-->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import CloseDot from './CloseDot.vue'
import type { FieldSource } from '../types/spec'

const props = defineProps<{
  /** The source attribution data for this field. Null/undefined = no source recorded yet. */
  fieldSource?: FieldSource | null
  /** Field name for display in HoverHint — e.g. "Scale", "Meter", "Goal" */
  fieldName: string
}>()

const expanded  = ref(false)
const openLeft  = ref(false)   // true → card opens LEFTWARD (near right edge of viewport)
const buttonRef = ref<HTMLButtonElement | null>(null)

// Click-outside dismissal — any click outside the SourcePin widget closes the card.
// Without this, an open card can sit at z-50 and silently block clicks on Apply Changes
// and other buttons below it in the panel. (Bug found 2026-06-09.)
function onDocClick(e: MouseEvent) {
  if (!expanded.value) return
  const root = (e.target as HTMLElement).closest('[data-sourcepin]')
  if (!root) expanded.value = false
}
onMounted(() => document.addEventListener('click', onDocClick, { capture: true }))
onUnmounted(() => document.removeEventListener('click', onDocClick, { capture: true }))

function toggleExpanded() {
  if (!expanded.value) {
    // Decide direction before opening — flip LEFT when < 290px remains to the right.
    // 290px is the max-width of the card plus a small safety margin.
    const el = buttonRef.value
    if (el) {
      const rect = el.getBoundingClientRect()
      openLeft.value = (window.innerWidth - rect.right) < 300
    }
  }
  expanded.value = !expanded.value
}

function closeCard() {
  expanded.value = false
}

/** Format ISO timestamp to human-readable YYYY-MM-DD HH:mm */
function formatTimestamp(iso: string): string {
  try {
    const d    = new Date(iso)
    const yyyy = d.getFullYear()
    const mm   = String(d.getMonth() + 1).padStart(2, '0')
    const dd   = String(d.getDate()).padStart(2, '0')
    const hh   = String(d.getHours()).padStart(2, '0')
    const min  = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`
  } catch {
    return iso
  }
}

const tooltipText = computed<string>(() => {
  if (!props.fieldSource) {
    return `${props.fieldName}: No source recorded — click Apply Changes to stamp source`
  }
  const fs = props.fieldSource
  const parts: string[] = [`Source: ${fs.source}`, `Type: ${fs.sourceType}`]
  if (fs.tool) parts.push(`Tool: ${fs.tool}`)
  parts.push(formatTimestamp(fs.timestamp))
  return parts.join(' · ')
})

/** Color class: violet when source known, amber when unknown. */
const pinColor = computed<string>(() =>
  props.fieldSource ? 'text-violet-500' : 'text-amber-400'
)

/** Source type badge background color */
function sourceTypeBg(t: 'human' | 'ai' | 'system'): string {
  if (t === 'human')  return 'background:#ede9fe; color:#5b21b6'   // violet-100 / violet-800
  if (t === 'ai')     return 'background:#d1fae5; color:#065f46'   // emerald-100 / emerald-800
  return                     'background:#e2e8f0; color:#475569'   // slate-200 / slate-600
}

/** Inline style for the card — position RIGHT or LEFT of the pin button. */
const cardPositionStyle = computed<string>(() =>
  openLeft.value
    ? 'right:1.5rem; left:auto;'
    : 'left:1.5rem; right:auto;'
)
</script>

<template>
  <!-- inline-flex so it sits flush after a label without breaking layout -->
  <span class="relative inline-flex items-center" data-sourcepin>
    <!-- The always-visible [←] pin — styled as a small pill so it's visible even in amber/no-source state.
         Tom Gilb 2026-06-09: "I cannot see even a blank source and I think I should see that"
         Amber pill = no source recorded yet.  Violet pill = source known. -->
    <button
      ref="buttonRef"
      type="button"
      class="inline-flex items-center leading-none select-none focus:outline-none focus:ring-1 rounded-sm border transition-colors"
      :class="fieldSource
        ? 'bg-violet-50 border-violet-300 text-violet-600 hover:bg-violet-100'
        : 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'"
      :title="tooltipText"
      style="font-size:11px; font-family:monospace; font-weight:700; padding:1px 4px; line-height:1.4; cursor:pointer;"
      :aria-label="`Source pin for ${fieldName} — ${fieldSource ? 'source recorded' : 'no source yet'}`"
      @click.stop="toggleExpanded"
    >
      [←]
    </button>

    <!-- Inline expanded source card — DD-017: white background for colored text -->
    <span
      v-if="expanded && fieldSource"
      class="absolute z-50 top-0 rounded-lg shadow-xl border border-violet-200"
      :style="`background:#ffffff; min-width:220px; max-width:290px; padding:10px 12px 8px 12px; ${cardPositionStyle}`"
      role="tooltip"
      aria-live="polite"
    >
      <!-- Header row: field name + CloseDot -->
      <span class="flex items-center justify-between mb-2">
        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
          {{ fieldName }} · Source
        </span>
        <CloseDot
          size="md"
          aria-label="Close source detail"
          title="Close source detail [→"
          @click="closeCard"
        />
      </span>

      <!-- Source name — the full label, e.g. "SEM Stage 1, Based on User Script, 9Jun26 19:04" -->
      <span class="block text-sm font-semibold text-slate-800 mb-1 leading-snug">
        {{ fieldSource.source }}
      </span>

      <!-- Source type badge -->
      <span
        class="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold mb-1"
        :style="sourceTypeBg(fieldSource.sourceType)"
      >
        {{ fieldSource.sourceType }}
      </span>

      <!-- AI tool name (if AI-generated) -->
      <span v-if="fieldSource.tool" class="block text-[11px] text-slate-500 mb-1">
        Tool: <span class="font-medium text-slate-700">{{ fieldSource.tool }}</span>
      </span>

      <!-- Timestamp -->
      <span class="block text-[10px] text-slate-400 mt-1 font-mono">
        {{ formatTimestamp(fieldSource.timestamp) }}
      </span>
    </span>

    <!-- Expanded "no source" card — prompt to apply changes -->
    <span
      v-if="expanded && !fieldSource"
      class="absolute z-50 top-0 rounded-lg shadow-xl border border-amber-200"
      :style="`background:#fffbeb; min-width:220px; max-width:280px; padding:10px 12px 8px 12px; ${cardPositionStyle}`"
      role="tooltip"
      aria-live="polite"
    >
      <span class="flex items-center justify-between mb-2">
        <span class="text-[11px] font-bold text-amber-700 uppercase tracking-wide">
          {{ fieldName }} · No Source
        </span>
        <CloseDot
          size="md"
          aria-label="Close source detail"
          title="Close source detail [→"
          @click="closeCard"
        />
      </span>
      <span class="block text-[11px] text-amber-800 leading-snug">
        No source recorded yet. Edit this field and click
        <strong>Apply Changes</strong> to stamp the source automatically.
      </span>
      <span class="block text-[10px] text-amber-500 mt-1.5">
        Planguage rule: "Source: will always be specified explicitly or implied
        from editing or AI change activity."
      </span>
    </span>
  </span>
</template>
