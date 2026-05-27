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

  Architecture note: this component is intentionally passive — it renders but does not
  interact. Navigation, pinning, and click handling belong to the parent (ValueCounter).
  This separation makes the icons reusable in ArrowInfoPanel, tooltips, exports, etc.

  Spec: F.ValueAccumulationCounter (#15) · Planguage Spec Type Glyphs v7 (2026-05-16).
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
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

withDefaults(defineProps<{
  plType: PlGlyphType
  size?: 'md' | 'lg' | 'xl'
}>(), {
  size: 'lg',
})
</script>

<template>
  <PlValueIcon       v-if="plType === 'value'"       :size="size" />
  <PlFunctionIcon    v-else-if="plType === 'function'"    :size="size" />
  <PlConstraintIcon  v-else-if="plType === 'constraint'"  :size="size" />
  <PlSolutionIcon    v-else-if="plType === 'solution'"    :size="size" />
  <PlStakeholderIcon v-else-if="plType === 'stakeholder'" :size="size" />
  <PlEvoStepIcon     v-else-if="plType === 'evo-step'"    :size="size" />
  <PlTaskIcon        v-else-if="plType === 'task'"        :size="size" />
  <PlResourceIcon    v-else-if="plType === 'resource'"    :size="size" />
</template>
