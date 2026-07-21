<!--
  PlTypeIcon.vue — Planguage type glyph dispatcher.
  Renders the correct ratified Planguage Spec Type Glyph (v7, 2026-05-16)
  for any of the 8 canonical entry types.

  8 types: value · function · constraint · solution · stakeholder · evo-step · task · resource
  Colors: VALUE=Violet #7c3aed · FUNCTION=Green #16a34a · CONSTRAINT=Red #dc2626
          SOLUTION=Orange #ea580c · STAKEHOLDER=Blue #2563eb · EVO STEP=Amber #ca8a04
          TASK=Slate #374151 · RESOURCE=Dark Green #166534

  The glyph filter (neon glow) is applied by the PARENT via CSS `filter: drop-shadow(...)`.
  This keeps the icon components colour-pure and the glow logic in the stage-aware context.

  Architecture note: this component is intentionally passive by default — it renders
  but does not interact. Set `interactive` to enable click → glyph-click emit for
  panels (ArrowInfoPanel, GlyphDataPanel, etc.) that need selection behaviour.
  Hover HoverHint is always present (canonical label or caller-supplied override).
  This separation makes the icons reusable in any context without coupling.

  P3 (2026-05-27): Added hover HoverHint (canonical auto-label + `title` override) and
  optional `interactive` prop that emits `glyph-click` — satisfies "All-Glyphs-Have-Hover"
  rule from SEMappHandbook p.25. Wrapper span carries title; inner dispatch is unchanged.

  DD-013 (2026-06-01): Universal double-click rule — EVERY PlTypeIcon opens GlyphDataPanel
  on double-click, regardless of interactive mode.
  Architecture v3 (2026-06-02): TWO-LAYER detection for maximum robustness:
  Layer A — global capture-phase listener in App.vue reads `data-pl-type` via
            Element.closest('[data-pl-type]'). Fires before any child handler.
            Cannot be blocked by stopPropagation on buttons, table cells, etc.
  Layer B — @dblclick on this span as belt-and-suspenders (same outcome).
  Together these layers ensure dblclick works regardless of where in the DOM
  this component is embedded. `no-detail-click` removes `data-pl-type` so
  Layer A skips this icon and Layer B also skips it.

  Spec: F.ValueAccumulationCounter (#15) · Planguage Spec Type Glyphs v7 (2026-05-16).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed } from 'vue'
import PlValueIcon from './PlValueIcon.vue'
import PlFunctionIcon from './PlFunctionIcon.vue'
import PlConstraintIcon from './PlConstraintIcon.vue'
import PlSolutionIcon from './PlSolutionIcon.vue'
import PlStakeholderIcon from './PlStakeholderIcon.vue'
import PlEvoStepIcon from './PlEvoStepIcon.vue'
import PlTaskIcon from './PlTaskIcon.vue'
import PlResourceIcon from './PlResourceIcon.vue'
import { useGlyphPanel } from '../../composables/useGlyphPanel'

/** All 8 canonical Planguage entry types. */
export type PlGlyphType =
  | 'value'
  | 'function'
  | 'constraint'
  | 'solution'
  | 'stakeholder'
  | 'evo-step'
  | 'task'
  | 'resource'

// ── Canonical hover labels (SEMappHandbook p.25 — "All-Glyphs-Have-Hover") ───
// Concise enough for a HoverHint, precise enough to teach Planguage.
// Aligned with Tom Gilb Competitive Engineering (2005) and 10.Standard/ definitions.
const CANONICAL_LABELS: Record<PlGlyphType, string> = {
  'value':       'Value — quantified goal or quality level. Defined by Scale · Meter · Tolerable · Goal. The primary driver of Planguage prioritisation.',
  'function':    'Function — binary system capability: either PRESENT or ABSENT. No thresholds inside. Quality attaches as Values; "how well" is never inside the function definition.',
  'constraint':  'Constraint — hard boundary that must not be violated. Binary or scalar. Budget, regulatory, resource, and logical limits all qualify. Constraints bound the solution space.',
  'solution':    'Solution — candidate design or delivery approach. Evaluated against Values and Constraints. Many solutions may address one stakeholder need; VDT picks the best.',
  'stakeholder': 'Stakeholder — anyone or anything with needs: people, systems, laws, data. Inanimate stakeholders (GDPR, databases) are equally valid per Tom Gilb 2026-05-15.',
  'evo-step':    'Evo Step — one incremental delivery cycle. Delivers measurable stakeholder value. Part of the 9-step Evo Cycle (Gilb EVO 2024, Ch.2, p.19). Never a gate — a workspace view.',
  'task':        'Task — concrete work item implementing a Solution or Evo Step. Tasks are engineering activities; their completion produces deliverable results for stakeholders.',
  'resource':    'Resource — budget, capacity, or material allocated to the plan. Includes time, money, people, and tooling. Consumed by Tasks; constrained by Budget entries.',
}

const props = withDefaults(defineProps<{
  /** The Planguage entry type to render. */
  plType: PlGlyphType
  /** Glyph size passed to every child icon component. sm=20px for inline badges. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Hover HoverHint text. Defaults to the canonical label for this type.
   * Pass a custom string to override (e.g. a project-specific definition).
   */
  title?: string
  /**
   * When true: wrapper becomes a focusable button-role span that emits `glyph-click`.
   * Use in panels (ArrowInfoPanel, GlyphDataPanel) where the glyph is independently
   * selectable. NEVER set inside a <button> parent — that causes nested interactives.
   * Default false (passive rendering — parent handles all click logic).
   */
  interactive?: boolean
  /**
   * DD-013: When true, suppresses the universal double-click → GlyphDataPanel behaviour.
   * Use ONLY when the parent component owns double-click itself (e.g. ValueCounter stage
   * tiles use a timer-based click to open StageInfoPanel — two conflicting panels is
   * wrong UX). Default false — every glyph opens GlyphDataPanel on dblclick.
   */
  noDetailClick?: boolean
}>(), {
  size: 'lg',
  interactive: false,
  noDetailClick: false,
})

const emit = defineEmits<{
  /** Emitted when interactive=true and the glyph is clicked or activated. */
  'glyph-click': [plType: PlGlyphType]
}>()

const { openGlyphPanel } = useGlyphPanel()

/**
 * Resolved HoverHint.
 * DD-013: always appends "· Double-click for detailed icon info" unless
 * noDetailClick suppresses it (parent owns dblclick for its own purpose).
 */
const resolvedTitle = computed(() => {
  const base = props.title ?? CANONICAL_LABELS[props.plType]
  return props.noDetailClick ? base : `${base} · Double-click for Glyph Detail`
})

function handleActivate(): void {
  if (props.interactive) emit('glyph-click', props.plType)
}

/** DD-013: universal double-click → GlyphDataPanel (direct composable call, no bubbling chain). */
function handleDblClick(): void {
  if (!props.noDetailClick) openGlyphPanel(props.plType)
}
</script>

<template>
  <!--
    Wrapper span:
    - Always carries the hover title (passive HoverHint — no JS, zero overhead).
    - In interactive mode: role=button, tabindex=0, cursor-pointer, keyboard-enter/space.
    - In passive mode (default): purely structural, no interaction surface.
    Never add interactive to a PlTypeIcon that is already inside a <button> element.
  -->
  <!--
    data-pl-type: read by App.vue's global capture-phase dblclick listener (Layer A).
    Omitted when noDetailClick=true so Layer A skips this icon entirely.
    @dblclick.prevent: Layer B — belt-and-suspenders for contexts where bubbling works.
  -->
  <span
    class="inline-flex"
    :title="resolvedTitle"
    :data-pl-type="noDetailClick ? undefined : plType"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    :class="interactive ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-current rounded' : ''"
    @click="handleActivate"
    @dblclick.prevent="handleDblClick"
    @keydown.enter="handleActivate"
    @keydown.space.prevent="handleActivate"
  >
    <PlValueIcon       v-if="plType === 'value'"       :size="size" />
    <PlFunctionIcon    v-else-if="plType === 'function'"    :size="size" />
    <PlConstraintIcon  v-else-if="plType === 'constraint'"  :size="size" />
    <PlSolutionIcon    v-else-if="plType === 'solution'"    :size="size" />
    <PlStakeholderIcon v-else-if="plType === 'stakeholder'" :size="size" />
    <PlEvoStepIcon     v-else-if="plType === 'evo-step'"    :size="size" />
    <PlTaskIcon        v-else-if="plType === 'task'"        :size="size" />
    <PlResourceIcon    v-else-if="plType === 'resource'"    :size="size" />
  </span>
</template>
