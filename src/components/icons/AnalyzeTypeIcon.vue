<!--
  AnalyzeTypeIcon.vue — Analyze-spec compound glyph dispatcher.
  Renders the correct [TYPE_ICON]→? compound glyph for any of the 7 supported
  Planguage entry types (generic + 6 typed).

  Dispatch table:
    'generic'     → AnalyzeGenericGlyph      [*]→?
    'function'    → AnalyzeFunctionGlyph     [→O→]→?
    'value'       → AnalyzeValueGlyph        [O--*→]→?
    'stakeholder' → AnalyzeStakeholderGlyph  [←§→]→?
    'task'        → AnalyzeTaskGlyph         [→O→*]→?
    'evo-step'    → AnalyzeEvoStepGlyph      [<→+→]→?
    'resource'    → AnalyzeResourceGlyph     [→O]→?

  Pattern matches PlTypeIcon.vue — same dispatcher architecture, passive by default.

  Spec: Analyze-Spec Compound Glyphs catalog 2026-06-05.
  DD-015 compliance: no English letter abbreviations — all keyed forms are universal.
  DD-011 compliance: every sub-glyph drawn element-by-element to match keyed form.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import AnalyzeGenericGlyph     from './AnalyzeGenericGlyph.vue'
import AnalyzeFunctionGlyph    from './AnalyzeFunctionGlyph.vue'
import AnalyzeValueGlyph       from './AnalyzeValueGlyph.vue'
import AnalyzeStakeholderGlyph from './AnalyzeStakeholderGlyph.vue'
import AnalyzeTaskGlyph        from './AnalyzeTaskGlyph.vue'
import AnalyzeEvoStepGlyph     from './AnalyzeEvoStepGlyph.vue'
import AnalyzeResourceGlyph    from './AnalyzeResourceGlyph.vue'

/** All 7 supported analyze compound glyph types. */
export type AnalyzeGlyphType =
  | 'generic'
  | 'function'
  | 'value'
  | 'stakeholder'
  | 'task'
  | 'evo-step'
  | 'resource'

// ── Canonical hover tooltips — keyed form + semantic query ──────────────────
const TOOLTIP: Record<AnalyzeGlyphType, string> = {
  'generic':     '[*]→? — Analyze any spec entry: query goals, status, and gaps',
  'function':    '[→O→]→? — Analyze Function entries: is this function present, delivering value, and resourced correctly?',
  'value':       '[O--*→]→? — Analyze Value entries: are Goals being reached? What is Status vs Tolerable?',
  'stakeholder': '[←§→]→? — Analyze Stakeholder entries: are all stakeholder flows correct? Who is missing?',
  'task':        '[→O→*]→? — Analyze Task entries: are tasks scoped, traced to Evo Steps, and estimated correctly?',
  'evo-step':    '[<→+→]→? — Analyze Evo Step entries: is this step delivering its Value Goal within Resource budget?',
  'resource':    '[→O]→? — Analyze Resource entries: what is being spent, on what, and is it optimal?',
}

withDefaults(defineProps<{
  /** The Planguage entry type to render the analyze compound glyph for. */
  plType: AnalyzeGlyphType
  /** Glyph size. Default 'lg' (200×96). */
  size?: 'sm' | 'md' | 'lg'
  /** Color scheme for background context. Default 'light'. */
  scheme?: 'light' | 'dark'
}>(), {
  size: 'lg',
  scheme: 'light',
})
</script>

<template>
  <span
    :title="TOOLTIP[plType]"
    style="display:inline-flex;align-items:center;vertical-align:middle;cursor:default"
  >
    <AnalyzeGenericGlyph     v-if="plType === 'generic'"      :size="size" :scheme="scheme" />
    <AnalyzeFunctionGlyph    v-else-if="plType === 'function'"    :size="size" :scheme="scheme" />
    <AnalyzeValueGlyph       v-else-if="plType === 'value'"       :size="size" :scheme="scheme" />
    <AnalyzeStakeholderGlyph v-else-if="plType === 'stakeholder'" :size="size" :scheme="scheme" />
    <AnalyzeTaskGlyph        v-else-if="plType === 'task'"        :size="size" :scheme="scheme" />
    <AnalyzeEvoStepGlyph     v-else-if="plType === 'evo-step'"    :size="size" :scheme="scheme" />
    <AnalyzeResourceGlyph    v-else-if="plType === 'resource'"    :size="size" :scheme="scheme" />
  </span>
</template>
