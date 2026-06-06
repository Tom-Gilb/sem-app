<!-- UNIT_TYPE=Widget -->
<!--
  PlanModelPanel.vue — BACKWARD-COMPAT SHIM (Plan→Spec Phase 2, r93, 2026-06-05).

  This file used to contain the active implementation; that has moved to
  `SpecModelPanel.vue`.  This shim re-exports the new component under the
  legacy `PlanModelPanel` name so any consumer that still imports
  `./components/PlanModelPanel.vue` continues to work without code change.

  Active call sites have been migrated to `SpecModelPanel` directly.
  This shim will be removed in Phase 5 of the Plan→Spec refactor once a
  60-day soak confirms zero remaining external consumers.
-->
<script lang="ts">
export { default } from './SpecModelPanel.vue'
</script>
