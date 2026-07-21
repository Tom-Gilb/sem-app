<!-- UNIT_TYPE=Glyph -->
<!--
  JustificationGlyph.vue — the [?!"] Q&A Justification pin.

  Planguage keyed notation (Tom Gilb 2026-06-08):
    [?] = Question — what was queried or uncertain
    [!] = Remark   — analysis, assertion, observation
    ["] = Quotation — cited source, reference, evidence
  Combined: [?!"] = "backed by questions, analysis, and citations" = Justification

  Tom Gilb verbatim:
    "There will be a clear pin indicating they're available [?!"]
    (questions, remarks, quotations), which will explain the Glyph when hovered
    over, and will insert the texts when the pin is clicked."

  Rules:
    DD-015 (International): brackets + universal punctuation only — no English letters ✓
    DD-016 (Color Keyed Icon): literal keyed form rendered in colour ✓
    Planguage Glyph-First (DD-011): this IS a new keyed glyph, no stock icon used ✓
    Interaction Disclosure (DD-009): :title fully explains the glyph on hover ✓

  Usage:
    <JustificationGlyph :open="isOpen" @click.stop="toggle" />
    NOTE: caller must use @click.stop to prevent propagation when inside a <label>.
    The component emits 'toggle' (not a DOM click) so the parent controls the stop.
-->

<script setup lang="ts">
const props = defineProps<{
  /** Whether the justification panel is open (active state colouring). */
  open?: boolean
}>()

defineEmits<{
  /** Fired when user clicks the pin — parent shows/hides the justification block. */
  toggle: []
}>()

const tooltip = `[?!"] Q&A Justification
[?] Questions that led to this
[!] Analysis and reasoning
["] Sources and citations
─────────────────────
Click to ${props.open ? 'collapse' : 'show'} justification`
</script>

<template>
  <button
    type="button"
    :title="tooltip"
    :aria-expanded="open ? 'true' : 'false'"
    aria-label="Toggle Q&A Justification"
    class="inline-flex items-center font-mono font-bold leading-none rounded px-1.5 py-0.5
           text-[10px] transition-all duration-150 cursor-pointer select-none flex-shrink-0
           border"
    :class="open
      ? 'bg-indigo-100 text-indigo-700 border-indigo-300 ring-1 ring-inset ring-indigo-200'
      : 'bg-white text-slate-400 border-slate-200 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50'"
    @click.stop="$emit('toggle')"
  ><!--
    [?!"] rendered as monospace text — the literal Planguage keyed notation.
    HTML entity for " inside template content: &quot; inside attr, bare " in content is fine.
  -->[?!&quot;]</button>
</template>
