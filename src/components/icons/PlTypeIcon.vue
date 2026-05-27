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
  Hover tooltip is always present (canonical label or caller-supplied override).
  This separation makes the icons reusable in any context without coupling.

  P3 (2026-05-27): Added hover tooltip (canonical auto-label + `title` override) and
  optional `interactive` prop that emits `glyph-click` — satisfies "All-Glyphs-Have-Hover"
  rule from SEMappHandbook p.25. Wrapper span carries title; inner dispatch is unchanged.

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
// Concise enough for a tooltip, precise enough to teach Planguage.
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
  /** Glyph size passed to every child icon component. */
  size?: 'md' | 'lg' | 'xl'
  /**
   * Hover tooltip text. Defaults to the canonical label for this type.
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
}>(), {
  size: 'lg',
  interactive: false,
})

const emit = defineEmits<{
  /** Emitted when interactive=true and the glyph is clicked or activated. */
  'glyph-click': [plType: PlGlyphType]
}>()

/** Resolved tooltip: caller override → canonical auto-label. */
const resolvedTitle = computed(() => props.title ?? CANONICAL_LABELS[props.plType])

function handleActivate(): void {
  if (props.interactive) emit('glyph-click', props.plType)
}
</script>

<template>
  <!--
    Wrapper span:
    - Always carries the hover title (passive tooltip — no JS, zero overhead).
    - In interactive mode: role=button, tabindex=0, cursor-pointer, keyboard-enter/space.
    - In passive mode (default): purely structural, no interaction surface.
    Never add interactive to a PlTypeIcon that is already inside a <button> element.
  -->
  <span
    class="inline-flex"
    :title="resolvedTitle"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    :class="interactive ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-current rounded' : ''"
    @click="handleActivate"
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
