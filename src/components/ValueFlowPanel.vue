<!--
  ValueFlowPanel.vue — full-screen modal shell for the 6-column causal Value Flow diagram.

  Tom Gilb 2026-05-15: "Value Flow: Thinner allows. The Flow is from Tasks,
  to Evo steps, to Solutions to the Value, to the Function, to the Stakeholders."

  Tom Gilb 2026-05-18: "drop the small screen. Only full screen, and enlarge the
  diagram to fit the screen."
  → Modal now fills the entire viewport (fixed inset-0). No centering wrapper,
    no padding, no rounded corners, no resize handle. The body passes
    fit-container=true to ValueFlowDiagram so the SVG scales proportionally to
    fill the available space after the header and headline banner.

  The diagram content lives in ValueFlowDiagram.vue (shared with VisualisePanelModal).
  This component wraps it in a Teleport + backdrop + full-screen card.

  Universal rules honoured:
    • CloseDot at END of header on dark gradient
    • ScrollContainer body (scroll affordance when diagram taller than viewport)
    • Backdrop + Teleport-to-body for the modal pattern
    • Registered as an exclusive surface from App.vue (z-[486/487])
-->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import type { ImpactMatrix } from '../types/impact'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import ValueFlowDiagram from './ValueFlowDiagram.vue'
import { extractAllStakeholders } from '../utils/stakeholderExtract'
import { exportArtefact } from '../composables/useExportShared'
import {
  renderValueFlowHtml,
  renderValueFlowPlain,
  type ValueFlowExportState,
} from '../composables/useValueFlowExport'

const props = defineProps<{
  spec:          SpecBlock
  evoSteps:      EvoStep[]
  tasksByStep:   Record<string, TaskSuggestion[]>
  /** Forwarded to ValueFlowDiagram — used for Solution→Value edge derivation. */
  impactMatrix?: ImpactMatrix
  /**
   * Optional plan-identity context surfaced in the Export artefact header.
   * Both default to safe strings if the host doesn't pass them — Export still
   * works without these, but the artefact is more useful when they're set.
   */
  planName?:     string
  versionLabel?: string
}>()

const emit = defineEmits<{
  close: []
  /** Propagated from ValueFlowDiagram — open spec editor for this entry. */
  'open-editor': [{ tab: 'functions' | 'values' | 'solutions'; entryId: string }]
  /** Propagated from ValueFlowDiagram — open Spec Direct Relations for this entry. */
  'node-relations-click': [{ tab: 'functions' | 'values' | 'solutions' | 'evo-steps'; entryId: string }]
  /** Propagated from ValueFlowDiagram — user clicked a Task node; navigate to Task Decomposition. */
  'go-to-tasks': []
}>()

// ── Esc key support ───────────────────────────────────────────────────────────
// The modal card is a <div role="dialog">, not a native <dialog> — browsers do
// not fire Esc automatically. A document-level listener is the most reliable
// cross-browser approach (tabindex+focus works but adds a visible focus ring on
// the full-screen card which is visually noisy).
const _onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); emit('close') } }
onMounted  (() => document.addEventListener('keydown', _onKey, { capture: true }))
onUnmounted(() => document.removeEventListener('keydown', _onKey, { capture: true }))

// ── Backdrop dismissal — drag-safe (Tom Gilb 2026-06-20) ─────────────────────
// Tom verbatim: "bug after enlarge value flow I tried to clip and it
// disappeared by itself 2x".  Root cause: the backdrop had a raw `@click=
// "$emit('close')"`.  When the user invokes macOS screen-capture (⌘⇧4 / ⌘⇧5)
// and drags an area-selection over Safari's viewport, the drag's mousedown
// inside the viewport + mouseup at the end of the drag synthesise a click
// on whichever element is under the pointer (often the backdrop).  The
// click handler then fires close, dismissing the Value Flow before the user
// can capture the screenshot.  Same trap is triggered by any wide selection
// drag the user might start on the backdrop and finish elsewhere — text
// selection inside the diagram body, marquee-select inside an embedded
// canvas tool, accessibility tools, etc.
//
// Fix: only treat as a close if mousedown AND mouseup land on the backdrop
// AND the pointer moved < 5 px between them (a genuine tap-click).  Any
// drag of meaningful distance is treated as "user is doing something, not
// dismissing".  Composes with CloseDot rule (explicit CloseDot stays as
// the primary dismissal path), Escape-key support (still binds), Universal
// Undo SUPREME (the only way to "undo" an accidental dismiss is to NOT
// dismiss in the first place — this fix removes the accidental-dismiss
// surface), and Architectural Resilience (defensive backdrop pattern that
// every future modal in SEM App should adopt).
const _bdDown = ref<{ x: number; y: number } | null>(null)
function onBackdropDown(e: MouseEvent) {
  if (e.target !== e.currentTarget) return
  _bdDown.value = { x: e.clientX, y: e.clientY }
}
function onBackdropUp(e: MouseEvent) {
  if (e.target !== e.currentTarget) { _bdDown.value = null; return }
  const start = _bdDown.value
  _bdDown.value = null
  if (!start) return
  const dx = Math.abs(e.clientX - start.x)
  const dy = Math.abs(e.clientY - start.y)
  if (dx < 5 && dy < 5) emit('close')
}

/**
 * Export the Value Flow as a colourful HTML artefact.
 *
 * Tom Gilb 2026-06-22 (verbatim, with screenshot of Value Flow surface):
 *   "no option to export"
 *
 * Sweep target for the Export-Button-on-All-Windows SUPREME rule. Builds a
 * full-model colourful HTML document covering every column of the 6-column
 * causal chain (Tasks → Evo Steps → Solutions → Values → Functions →
 * Stakeholders), then delegates to exportArtefact() which:
 *   1. Writes dual-MIME (HTML + plain) to the clipboard
 *   2. Opens a preview window with 100% of the model
 *   3. Auto-opens Mail per SEM Email Body Standard with LOUD ⌘V cue
 *   4. Shows a confirmation notification
 *
 * Composes with: Colorful HTML Spec Email Rule (SUPREME), SEM Email Body
 * Standard (SUPREME), Auto-Open Email Rule (SUPREME), Mailto-No-Self-To
 * SUPREME (to: '' below).
 */
async function exportValueFlow(): Promise<void> {
  const planName = (props.planName ?? '').trim() || 'Planning Spec'
  const versionLabel = props.versionLabel ?? ''

  // Tasks: union across all evo-step buckets in tasksByStep (the diagram
  // focuses on one step at a time, but the export should carry the full
  // model — every task across every step).
  const taskSeen = new Set<string>()
  const tasks: ValueFlowExportState['tasks'] = []
  for (const stepName of Object.keys(props.tasksByStep ?? {})) {
    for (const t of props.tasksByStep[stepName] ?? []) {
      const key = `${stepName}::${t.id}`
      if (taskSeen.has(key)) continue
      taskSeen.add(key)
      tasks.push({
        id: key,
        name: t.description || '(unnamed task)',
        status: `step: ${stepName}`,
      })
    }
  }

  const evoSteps: ValueFlowExportState['evoSteps'] = (props.evoSteps ?? []).map(
    (s) => ({
      id: s.name,
      name: s.name,
      effortPercent: s.effortPercent,
    }),
  )

  const solutions: ValueFlowExportState['solutions'] = (
    props.spec.solutions ?? []
  ).map((s) => ({
    id: s.id,
    name: s.description || s.id,
    description: s.description && s.description !== s.id ? s.id : undefined,
  }))

  const values: ValueFlowExportState['values'] = (props.spec.values ?? []).map(
    (v) => ({
      id: v.id,
      name: v.description || v.id,
      description: v.description && v.description !== v.id ? v.id : undefined,
    }),
  )

  const functions: ValueFlowExportState['functions'] = (
    props.spec.functions ?? []
  ).map((f) => ({
    id: f.id,
    name: f.description || f.id,
    description: f.description && f.description !== f.id ? f.id : undefined,
  }))

  // Stakeholders: mirror the diagram's extractor for parity with what the
  // planner sees on screen.
  const specText = [
    ...(props.spec.functions ?? []).map(
      (f) => `${f.description} ${f.presenceTest ?? f.successCriteria ?? ''} ${f.functionOfValue}`,
    ),
    ...(props.spec.values ?? []).map(
      (v) => `${v.description} ${v.scale} ${v.valueOfFunction}`,
    ),
    ...(props.spec.solutions ?? []).map(
      (s) => `${s.description} ${s.impact} ${s.function}`,
    ),
    props.spec.stakes ?? '',
  ].join(' ')
  const stakeholders: ValueFlowExportState['stakeholders'] =
    extractAllStakeholders(specText).map((s) => ({
      id: s.name,
      name: s.name,
      accent: s.colour,
    }))

  const state: ValueFlowExportState = {
    planName,
    versionLabel,
    tasks,
    evoSteps,
    solutions,
    values,
    functions,
    stakeholders,
  }
  const htmlText = renderValueFlowHtml(state)
  const plainText = renderValueFlowPlain(state)
  const total =
    tasks.length +
    evoSteps.length +
    solutions.length +
    values.length +
    functions.length +
    stakeholders.length
  const subject = `${planName}${versionLabel ? ' ' + versionLabel : ''} · Value Flow · ${total} ${total === 1 ? 'element' : 'elements'}`
  await exportArtefact({
    htmlText,
    plainText,
    subject,
    artefactName: 'Value Flow',
    // Mailto-No-Self-To SUPREME (Tom Gilb 2026-06-16 verbatim "EMAIL SHARPENING
    // YOU PUT THE MAIN IN THE TO SECTION, SILLY BOY"): when Tom clicks Export
    // on a SEM-App-initiated export, Tom is the SENDER; the recipient is
    // someone else Tom will choose in Mail.app. To: must be EMPTY.  Without
    // this explicit '', useExportShared.ts defaults to Tom@Gilb.com which
    // would make Tom email himself.
    to: '',
  })
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop — drag-safe close (Tom 2026-06-20 "I tried to clip and it
         disappeared by itself 2x"; details in <script> comment above). -->
    <div
      class="fixed inset-0 z-[486] bg-black/40"
      aria-hidden="true"
      @mousedown="onBackdropDown"
      @mouseup="onBackdropUp"
    />

    <!--
      Full-screen card — fills the entire viewport.
      No centering wrapper, no padding, no rounded corners, no resize handle.
      Tom 2026-05-18: "Only full screen, and enlarge the diagram to fit the screen."
    -->
    <div
      class="fixed inset-0 z-[487] flex flex-col bg-white pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Value Flow diagram"
    >
      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <div
        class="flex items-center gap-3 px-5 py-3.5 shrink-0
               bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white"
      >
        <span
          class="text-[15px] font-mono text-indigo-300 select-none shrink-0"
          aria-hidden="true"
        >⟶</span>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-semibold leading-tight truncate">Value Flow</p>
          <!-- Primary value shown here in full-screen since the pulsing headline
               box is hidden in fitContainer mode to give SVG the full vertical space. -->
          <p
            v-if="props.spec.values[0]?.description"
            class="text-[11px] text-red-300 font-semibold leading-tight truncate"
            :title="props.spec.values[0].description"
          >
            ★ {{ props.spec.values[0].description }}
          </p>
          <p v-else class="text-[10px] text-white/55 leading-tight truncate">
            Tasks → Evo Steps → Solutions → Values → Functions → Stakeholders
          </p>
        </div>
        <!-- Export pin (Tom Gilb 2026-06-22 "no option to export") —
             Export-Button-on-All-Windows SUPREME rule sweep target.
             Wired to exportValueFlow() which delegates to exportArtefact() —
             clipboard + preview + auto-open Mail in one click.
             Mailto-No-Self-To SUPREME: handler passes to: '' so Tom (sender)
             does not email himself; recipient chosen in Mail.app. -->
        <button
          type="button"
          class="shrink-0 inline-flex items-center gap-1.5 rounded-md
                 bg-white/10 hover:bg-white/20 active:bg-white/30
                 text-white text-[11px] font-semibold
                 px-2.5 py-1 transition focus:outline-none
                 focus-visible:ring-2 focus-visible:ring-amber-300"
          title="Export · open preview + copy colourful HTML to clipboard + auto-open Mail (Copy / Mail / Preview in one action)"
          aria-label="Export Value Flow"
          @click="exportValueFlow"
        >
          📤 Export
        </button>
        <CloseDot
          variant="on-dark"
          aria-label="Close Value Flow"
          @click="$emit('close')"
        />
      </div>

      <!--
        Body — fills all remaining height after the header.
        overflow-y-auto: when the diagram is taller than the viewport (e.g. many
        stakeholders), scroll vertically rather than shrink the whole diagram.
        ScrollContainer rule (sem-app-ui-rules.md): any overflow-y-auto MUST use
        <ScrollContainer> — adds the visible scroll affordance Tom requested
        (r26d 2026-06-07: "Value flow window does not have the scroll button").
        overflow-x-hidden still applied via inner-class; p-0 keeps diagram flush.
      -->
      <ScrollContainer class="flex-1 min-h-0 bg-slate-50" inner-class="overflow-x-hidden p-0">
        <ValueFlowDiagram
          :spec="props.spec"
          :evo-steps="props.evoSteps"
          :tasks-by-step="props.tasksByStep"
          :impact-matrix="props.impactMatrix"
          :fit-container="true"
          @node-click="emit('open-editor', $event)"
          @node-relations-click="emit('node-relations-click', $event)"
          @go-to-tasks="emit('go-to-tasks')"
        />
      </ScrollContainer>
    </div>
  </Teleport>
</template>
