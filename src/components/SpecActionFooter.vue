<!-- UNIT_TYPE=Widget
  SpecActionFooter.vue — Standard "Done Changing" footer bar for all spec-editing panels.

  Standard Close Process (DD-standard-close-2026-06-09):
    · Status badge (left):     🔓 N changes — not yet versioned
                               ✅ Version saved HH:MM
                               🔒 Locked — edits disabled
    · Save Version (button):   explicit mid-session snapshot without closing
    · Lock toggle (button):    🔓 Lock  /  🔒 Unlock — persists via useSpecLock
    · Close (button):          if unsaved changes → "Close + Save Version" (auto-snapshots then closes)
                               otherwise → "Close"

  Mounted in: PentaPanel · SharpenPanel · SpecEditorPanel

  Emits:
    close         — parent should call its own handleClose / handleDone
    save-version  — parent should snapshot current spec via useSpecHistory.addVersion
    toggle-lock   — parent calls lock() or unlock() from useSpecLock
-->
<template>
  <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 bg-slate-50 shrink-0">

    <!-- Left: status badge -->
    <div class="flex items-center min-w-0">
      <span
        v-if="isLocked"
        class="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full whitespace-nowrap"
        title="Spec is locked — editing disabled across all panels. Click Unlock to resume editing."
      >🔒 Locked — edits disabled</span>
      <span
        v-else-if="changeCount > 0"
        class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full whitespace-nowrap"
        :title="`${changeCount} change${changeCount !== 1 ? 's' : ''} applied since last version snapshot. Close will auto-save a version.`"
      >🔓 {{ changeCount }} change{{ changeCount !== 1 ? 's' : '' }} — not yet versioned</span>
      <span
        v-else-if="lastSaved"
        class="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full whitespace-nowrap"
        :title="`Version snapshot saved at ${savedTimeLabel}`"
      >✅ Version saved {{ savedTimeLabel }}</span>
    </div>

    <!-- Right: actions -->
    <div class="flex items-center gap-2 shrink-0">

      <!-- Save Version — explicit mid-session snapshot, no close -->
      <button
        v-if="changeCount > 0 && !isLocked"
        type="button"
        title="Save a version snapshot now — keeps the panel open"
        class="text-[11px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
        @click="$emit('save-version')"
      >
        Save Version
      </button>

      <!-- Lock toggle -->
      <button
        type="button"
        :title="isLocked
          ? 'Unlock spec — re-enable editing across all panels'
          : 'Lock spec — freeze this version; disables all Apply and Commit buttons'"
        class="text-[11px] px-3 py-1.5 rounded-lg border font-semibold transition-colors"
        :class="isLocked
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'"
        @click="$emit('toggle-lock')"
      >{{ isLocked ? '🔒 Unlock' : '🔓 Lock' }}</button>

      <!-- Close — auto-saves version if unsaved changes exist -->
      <button
        type="button"
        :title="closeTitle"
        class="text-[11px] px-4 py-1.5 rounded-lg font-semibold transition-colors"
        :class="changeCount > 0 && !isLocked
          ? 'bg-violet-600 hover:bg-violet-700 text-white'
          : 'bg-slate-200 hover:bg-slate-300 text-slate-700'"
        @click="$emit('close')"
      >{{ closeLabel }}</button>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Number of changes applied since last version snapshot (0 = clean). */
  changeCount: number
  /** Timestamp of the last version snapshot taken from this panel; null if none this session. */
  lastSaved:   Date | null
  /** Whether the spec is globally locked via useSpecLock. */
  isLocked:    boolean
}>()

defineEmits<{
  close:          []
  'save-version': []
  'toggle-lock':  []
}>()

const savedTimeLabel = computed(() =>
  props.lastSaved
    ? props.lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''
)

const closeLabel = computed(() =>
  (props.changeCount > 0 && !props.isLocked) ? 'Close + Save Version' : 'Close'
)

const closeTitle = computed(() => {
  if (props.isLocked) return 'Close panel (spec stays locked)'
  if (props.changeCount > 0)
    return `Close and auto-save a version snapshot (${props.changeCount} change${props.changeCount !== 1 ? 's' : ''} will be preserved)`
  return 'Close panel'
})
</script>
