<!--
  ProcessToolsStrip.vue — r41 v141 (Tom Gilb 2026-06-17 "keep working, real
  progress").

  LEVEL 1 · PROCESS TOOLS — own top-level component matching its
  conceptual rank on the autonomy axis (Process Tools = mechanical,
  Stage Tools = semantic, Agents = autonomous collaborators).  Until
  v141 this group was ~200 lines of inline cluster markup DUPLICATED
  across pre-spec + post-spec right-pin clusters in App.vue.

  TWO VARIANTS:
   - variant="post-spec" — shows Find · Undo · Redo · Search Term · Settings · SOS
                         + Books · Agents · Actions
   - variant="pre-spec"  — shows Find · Search Term · Settings · SOS
                         + Mic · Speaker · Actions
                         (no Undo/Redo — nothing to undo yet; Mic/Speaker
                         are accessibility-critical pre-spec per Tom 2026-05-13)

  Composes with: Icon-Plus-Text SUPREME · MOVE Principle · DD-009
  Zero-Training UI · accessibility_tom.md · Twin portability.
-->
<script setup lang="ts">
interface Props {
  variant: 'pre-spec' | 'post-spec'
  /** Undo button enabled state (post-spec only). */
  canUndo?:    boolean
  /** Redo button enabled state (post-spec only). */
  canRedo?:    boolean
  /** Last undo entry label for HoverHint (post-spec). */
  undoLabel?:  string
  undoSource?: string
  undoTime?:   string
  /** Voice dictation state (pre-spec only). */
  dictationActive?:    boolean
  dictationSupported?: boolean
  /** Speaker state (pre-spec only). */
  speaking?:        boolean
  speakerSupported?: boolean
  /** Agents menu open state (post-spec only). */
  agentMenuOpen?: boolean
  /** Actions menu open state. */
  menuOpen?: boolean
  /** r41 2026-06-20 — Export pin enabled state.  Post-spec → always enabled
   *  (the full Spec is exportable).  Pre-spec → enabled when there's
   *  something the user has typed/imported on the current window worth
   *  exporting (form state, imported contract text, etc.).  When disabled,
   *  the pin shows a HoverHint explaining there's nothing to export yet. */
  canExport?: boolean
  /** r41 v228 — true when the Plan Crest is currently collapsed (Focus Mode).
   *  Drives the Focus pin's icon + label so it self-describes its state. */
  focusModeActive?: boolean
  /** v528 (2026-07-21) — count of Values + Solutions currently in the spec.
   *  Drives the small live badge on the Resources pin: "any Value + any
   *  Solution implies estimation of resources" (Tom Gilb 2026-07-21).  When
   *  > 0, the pin shows the count so the planner sees at a glance how many
   *  entries currently imply resource cost.  Undefined / 0 → no badge. */
  resourceImplyingCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  canUndo: false,
  canRedo: false,
  undoLabel:          '',
  undoSource:         '',
  undoTime:           '',
  dictationActive:    false,
  dictationSupported: true,
  speaking:           false,
  speakerSupported:   true,
  agentMenuOpen:      false,
  menuOpen:           false,
  canExport:          false,
  focusModeActive:    false,
  resourceImplyingCount: 0,
})
// Silence unused warning — props IS used in template (auto-unwrapped) but
// TS+ESLint want a runtime reference.
void props

const emit = defineEmits<{
  'open-find':       []
  'undo':            []
  'redo':            []
  'open-search-term':[]
  'open-settings':   []
  'refresh':         []
  'open-sos':        []
  'open-mic':        []
  'open-read':       []
  'open-books':      []
  'open-agents':     []
  'open-actions':    []
  // v528 (2026-07-21) — Resources agent glance-pin at title-bar level.
  // Redundant with AgentsStrip's Resources pin but visible even when the
  // AgentsStrip scrolls off (title bar area is always in view).
  'open-resources':  []
  'open-demos':      []
  /** r41 2026-06-20 (Tom Gilb verbatim "need export on this window, as
   *  standard for every window, right") — Export pin emit.  Composes with
   *  the Export-button-on-all-windows rule SUPREME (memory:
   *  rule_export_button_on_all_windows.md, 2026-06-06): full-model
   *  colorful HTML preview + clipboard HTML+plain + auto-open Mail to
   *  Tom@Gilb.com per SEM Email Body Standard.  Handler lives in App.vue
   *  so it can dispatch to the right exporter (full-spec post-spec; current
   *  window's draft data pre-spec). */
  'open-export':     []
  /** r41 v228 (Tom Gilb 2026-06-20) — explicit "Scroll Away menus" pin.
   *  Toggles Focus Mode: hides the Plan Crest bands (IdentityStrip +
   *  StageToolsStrip + AgentsStrip) into a thin restore strip; main
   *  content broadens.  Bound to App.vue `focusModeToggle()` + ⌘. shortcut. */
  'toggle-focus':    []
}>()
</script>

<template>
  <!-- r41 v147 — outer container no longer absolute; component is now
       slotted INTO the IdentityStrip's `end` slot per Tom Gilb 2026-06-17
       verbatim "inside one of 3 bars top one".  Sits in normal flex flow
       at the right edge of the Plan Identity bar via the slot wrapper's
       ml-auto. -->
  <div class="flex items-end justify-end gap-2">
    <!-- r41 v221 (Tom Gilb 2026-06-20 verbatim "PROCESS TOOLS overlap"
         regression) — the aria-hidden "Process Tools" label was bleeding
         through behind the pin pills at narrow viewports (the IdentityStrip
         parent uses flex-wrap; the slot wrapper would push the label onto a
         visual row that overlapped the pills' z-stack).  Label DROPPED — it
         was aria-hidden so screen readers never used it, and each pin pill
         already carries its own aria-label ("App controls" / "Tools") plus
         every button has a visible text label per Icon-Plus-Text SUPREME.
         No semantic loss; overlap structurally eliminated.  r41 v150
         framing-drop rationale ("anyone can see the level and the name of
         the area is more informative") extends here — the area is named by
         its content, not by a header. -->

    <!-- CONTROLS sub-pill — slate background, h-10 buttons -->
    <div
      class="shrink-0 flex items-center gap-1 rounded-2xl bg-slate-700/40 ring-1 ring-white/15 px-1.5 py-1"
      aria-label="App controls"
    >
      <!-- 🔍 Find Tool — opens command palette.  r41 v149 (Tom Gilb 2026-06-17
           "find needs find Tool, since find is very close to ill and search").
           Renamed Find → Find Tool to disambiguate from the adjacent Search
           Term button (which looks up Planguage terms / Gilb illustrations).
           Find Tool = find a TOOL/AFFORDANCE; Search Term = find a TERM. -->
      <button
        type="button"
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               bg-slate-700/80 text-white hover:bg-slate-600 ring-1 ring-slate-400/60 hover:ring-slate-300
               focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
        aria-label="Find Tool — open command palette (Cmd+F)"
        title="🔍 Find Tool · ⌘F — open the Actions / command palette.  Type anywhere to filter every reachable affordance / tool / button in SEM App.  Use this when you know a feature exists but cannot remember where it lives."
        @click="emit('open-find')"
      >
        <span class="text-base leading-none" aria-hidden="true">🔍</span>
        <span class="text-[10px] font-bold leading-none tracking-wide whitespace-nowrap">Find Tool</span>
      </button>

      <!-- ↶ Undo — post-spec only -->
      <button
        v-if="variant === 'post-spec'"
        type="button"
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               bg-slate-700/80 text-white hover:bg-slate-600 ring-1 ring-slate-400/60 hover:ring-slate-300
               focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all
               disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700/80"
        :disabled="!canUndo"
        :aria-label="canUndo ? `Undo last action: ${undoLabel}` : 'Nothing to undo'"
        :title="canUndo
          ? `↶ Undo · ⌘Z — Undo last action: ${undoLabel} (${undoSource}, ${undoTime})`
          : '↶ Undo · ⌘Z — Nothing to undo yet. Every Apply / Save / Accept is recorded automatically.'"
        @click="emit('undo')"
      >
        <span class="text-base leading-none" aria-hidden="true">↶</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Undo</span>
      </button>

      <!-- ↷ Redo — post-spec only -->
      <button
        v-if="variant === 'post-spec'"
        type="button"
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               bg-slate-700/80 text-white hover:bg-slate-600 ring-1 ring-slate-400/60 hover:ring-slate-300
               focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all
               disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700/80"
        :disabled="!canRedo"
        :aria-label="canRedo ? 'Redo last undone action' : 'Nothing to redo'"
        :title="canRedo
          ? '↷ Redo · ⌘⇧Z — Redo the action you just undid'
          : '↷ Redo · ⌘⇧Z — Nothing to redo. Click Undo first, then Redo replays it.'"
        @click="emit('redo')"
      >
        <span class="text-base leading-none" aria-hidden="true">↷</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Redo</span>
      </button>

      <!-- 💡 Search Term — Illumination + Information + Illustrations finder (⌘I) -->
      <button
        type="button"
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               bg-gradient-to-br from-violet-500 to-amber-500 text-white
               hover:from-violet-400 hover:to-amber-400 ring-1 ring-white/40
               focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all"
        aria-label="Open Search Term — Illumination, Information, Illustrations finder (Cmd+I)"
        title="💡 Search Term · ⌘I — 4,363 Tom Gilb book illustrations + Planguage Glossary in one searchable panel."
        @click="emit('open-search-term')"
      >
        <span class="text-base leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" aria-hidden="true">💡</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Search Term</span>
      </button>

      <!-- ⚙ Settings -->
      <button
        type="button"
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               bg-amber-500/90 text-white hover:bg-amber-400 ring-1 ring-amber-300/60
               focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all"
        aria-label="Open SEM Settings panel (Cmd+,)"
        title="⚙ Settings · ⌘, — Mode · AI level · Illumination AI defaults · Privacy · Evo defaults · Visual · Workflow · Export · Collab · Diagnostics"
        @click="emit('open-settings')"
      >
        <span class="text-base leading-none" aria-hidden="true">⚙</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Settings</span>
      </button>

      <!-- 🔄 Refresh — Tom Gilb 2026-06-19 verbatim "SOS is emergency drastic,
           so simple refresh of a plan has to be outside it".  Non-destructive
           page reload with cache-bust query so no stale Vue HMR state
           survives.  Equivalent to ⌘R but easier to find than the keyboard
           shortcut.  Lives BETWEEN Settings and SOS so the destructive SOS
           pin stays at the far right where the planner expects it. -->
      <button
        type="button"
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               bg-sky-500/85 text-white hover:bg-sky-400 ring-1 ring-sky-300/60
               focus:outline-none focus:ring-2 focus:ring-sky-300 transition-all"
        aria-label="Refresh — reload the SEM App with a clean cache (Cmd+R equivalent)"
        title="🔄 Refresh — non-destructive page reload (equivalent to ⌘R).  Bumps a cache-bust query so no stale module state survives.  Use this when the UI feels off and you want a clean refresh.  NOT destructive — your spec data is safe."
        @click="emit('refresh')"
      >
        <span class="text-base leading-none" aria-hidden="true">🔄</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Refresh</span>
      </button>

      <!-- r41 v229 (Tom Gilb 2026-06-20 refinement: "I like the idea that
           the menus do not disappear, they scroll up, out of the way, but
           we inituitively know that and can bring them down by a simple
           scroll") — Focus-Mode toggle pin DROPPED.  The Plan Crest is now
           in-flow at the top of the page; scrolling up = menus visible,
           scrolling down = menus go out of view.  No explicit pin needed
           because the scroll IS the mechanism.  Composes with MOVE
           (scrolling is the universal "find the menus" gesture) +
           No-Silent-Removal (menus still always in DOM). -->

      <!-- 🆘 SOS -->
      <button
        type="button"
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               bg-red-600/80 text-white hover:bg-red-500 ring-1 ring-red-400/60 hover:ring-red-300
               focus:outline-none focus:ring-2 focus:ring-red-300 transition-all"
        aria-label="SOS — open reset menu (Blank Canvas, Save & Stop, Rollback, Close stuck UI)"
        title="🆘 SOS — Blank Canvas / Save &amp; Stop / Cancel Changes / Close stuck UI"
        @click="emit('open-sos')"
      >
        <span class="text-base leading-none" aria-hidden="true">🆘</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">SOS</span>
      </button>
    </div>

    <!-- Vertical separator between CONTROLS and TOOLS pills -->
    <span class="shrink-0 h-8 w-px bg-white/25" aria-hidden="true" />

    <!-- TOOLS sub-pill -->
    <div
      class="shrink-0 flex items-center gap-1 rounded-2xl bg-slate-700/40 ring-1 ring-white/15 px-1.5 py-1"
      aria-label="Tools"
    >
      <!-- 🎤 Mic — pre-spec only -->
      <button
        v-if="variant === 'pre-spec'"
        type="button"
        :class="[
          'h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg transition-all',
          'focus:outline-none focus:ring-2 focus:ring-rose-300',
          dictationActive
            ? 'bg-rose-500/90 text-white hover:bg-rose-500 ring-1 ring-rose-300/60'
            : 'bg-slate-700/80 text-white hover:bg-slate-600 ring-1 ring-slate-400/60',
          !dictationSupported && 'opacity-40 cursor-not-allowed',
        ]"
        :disabled="!dictationSupported"
        :aria-label="dictationActive ? 'Turn off dictation' : 'Turn on dictation'"
        :title="dictationActive ? '🎤 Mic ON — click to stop voice dictation' : (dictationSupported ? '🎤 Mic — click to start voice dictation into any text field' : '🎤 Mic unavailable on this browser')"
        @click="emit('open-mic')"
      >
        <span class="text-base leading-none" aria-hidden="true">🎤</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">{{ dictationActive ? 'On' : 'Mic' }}</span>
      </button>

      <!-- 🔊 Speaker — pre-spec only -->
      <button
        v-if="variant === 'pre-spec'"
        type="button"
        :class="[
          'h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg transition-all',
          'focus:outline-none focus:ring-2 focus:ring-cyan-300',
          speaking
            ? 'bg-cyan-500/90 text-white hover:bg-cyan-500 ring-1 ring-cyan-300/60'
            : 'bg-slate-700/80 text-white hover:bg-slate-600 ring-1 ring-slate-400/60',
          !speakerSupported && 'opacity-40 cursor-not-allowed',
        ]"
        :disabled="!speakerSupported"
        :aria-label="speaking ? 'Stop reading aloud' : 'Read aloud'"
        :title="speaking ? '🔊 Speaker ON — click to stop reading' : (speakerSupported ? '🔊 Speaker — read the current plan content aloud (text-to-speech)' : '🔊 Speaker unavailable on this browser')"
        @click="emit('open-read')"
      >
        <span class="text-base leading-none" aria-hidden="true">🔊</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">{{ speaking ? 'On' : 'Read' }}</span>
      </button>

      <!-- 🎬 Demos — universally reachable per Tom Gilb 2026-06-18 verbatim
           "I cannot find any clips or other demo".  Was previously gated to
           Stage 1 mock-no-spec only; now lives in the Process Tools strip so
           every stage + every spec state can reach the catalog.  MOVE Principle. -->
      <button
        type="button"
        :class="variant === 'post-spec'
          ? 'h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg bg-indigo-500/90 text-white hover:bg-indigo-400 ring-1 ring-indigo-300/60 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all'
          : 'h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 ring-1 ring-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all'"
        aria-label="Demos — catalog of per-stage / per-tool / per-agent recorded replays"
        title="🎬 Demos — opens the Demos catalog: pick a Stage, a Tool, or an Agent and watch a recorded replay of it in action.  (Demo = PASSIVE replay.  For an interactive learn-by-doing experience use 🧙 Guided.  For a UI walkthrough use ? Tour.)"
        @click="emit('open-demos')"
      >
        <span class="text-base leading-none" aria-hidden="true">🎬</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Demos</span>
      </button>

      <!-- 📤 Export — Tom Gilb 2026-06-20 verbatim "need export on this
           window, as standard for every window, right".  Composes with the
           Export-button-on-all-windows rule SUPREME (memory:
           rule_export_button_on_all_windows.md, 2026-06-06).  Universal,
           appears on every window because Process Tools is slotted into
           the top Plan Identity bar.  In post-spec state, fires the
           full-spec export path (colorful HTML preview + clipboard +
           Mail.app).  In pre-spec state, fires the draft-export path
           (whatever the current window has — form state, imported text,
           etc.) when something is present; otherwise disabled with a
           HoverHint explaining there's nothing to export yet.  Icon-Plus-
           Text SUPREME honoured (glyph 📤 + text label "Export"). -->
      <button
        type="button"
        :class="[
          'h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg transition-all',
          'focus:outline-none focus:ring-2 focus:ring-emerald-300',
          variant === 'post-spec'
            ? 'bg-emerald-500/90 text-white hover:bg-emerald-400 ring-1 ring-emerald-300/60'
            : 'bg-emerald-600 text-white hover:bg-emerald-500 ring-1 ring-emerald-400/60',
          !canExport && 'opacity-40 cursor-not-allowed hover:bg-emerald-500/90',
        ]"
        :disabled="!canExport"
        :aria-label="canExport
          ? 'Export — full-model colorful HTML preview + clipboard + opens Mail.app to Tom@Gilb.com'
          : 'Export — nothing to export yet on this window'"
        :title="canExport
          ? '📤 Export — opens a 100%-of-the-model colorful HTML preview, copies HTML + plain to the clipboard, and auto-opens Mail.app pre-filled with the SEM Email Body Standard (LOUD ⌘V cue).'
          : '📤 Export — nothing to export from this window yet.  Type or import some content first.'"
        @click="canExport && emit('open-export')"
      >
        <span class="text-base leading-none" aria-hidden="true">📤</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Export</span>
      </button>

      <!-- 📚 Books — post-spec only -->
      <button
        v-if="variant === 'post-spec'"
        type="button"
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               bg-amber-500/90 text-white hover:bg-amber-400 ring-1 ring-amber-300/60
               focus:outline-none focus:ring-2 focus:ring-amber-300 transition-all"
        aria-label="Open BookKaleidoscope — Tom Gilb's 48 books"
        title="📚 Books — Tom Gilb's 48 books as a tile mosaic of covers + sample illustrations.  Click any cover to open it on Tom Gilb Consultant Twin (free, no login)."
        @click="emit('open-books')"
      >
        <span class="text-base leading-none" aria-hidden="true">📚</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Books</span>
      </button>

      <!-- 🦾 Agents — post-spec only -->
      <button
        v-if="variant === 'post-spec'"
        type="button"
        :aria-expanded="agentMenuOpen"
        aria-haspopup="true"
        aria-label="Open Agent Menu"
        title="🦾 Agents — Maria (Board governance) · Contracts (Planguage analysis) · Models (Plan library) — single-click to open"
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               transition-all focus:outline-none focus:ring-2 focus:ring-emerald-300"
        :class="agentMenuOpen
          ? 'bg-emerald-300 text-emerald-900 ring-2 ring-emerald-200'
          : 'bg-emerald-500/80 text-emerald-50 hover:bg-emerald-500'"
        @click="emit('open-agents')"
      >
        <span class="text-base leading-none" aria-hidden="true">🦾</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Agents</span>
      </button>

      <!-- 📐 Resources — v528 (Tom Gilb 2026-07-21) — glance-pin at title-bar
           level.  Opens the top-level Resources agent (settings · standards ·
           references · extrapolation · per-resource Sharpening).  Redundant
           with AgentsStrip's Resources pin but always visible in the title
           bar even when the AgentsStrip is off-screen.  Live badge shows
           count of Values + Solutions currently implying resource cost. -->
      <button
        type="button"
        aria-label="Open Resources agent"
        :title="`📐 Resources — Central estimation agent · every Value + every Solution implies resource cost · settings · standards · currency · extrapolation · per-resource Sharpening.  ${props.resourceImplyingCount && props.resourceImplyingCount > 0 ? `${props.resourceImplyingCount} entr${props.resourceImplyingCount === 1 ? 'y' : 'ies'} in the current spec imply resource cost — no numeric estimation events yet.  Click to enter estimates.  ` : ''}Opens the Resources Agent panel.`"
        class="relative h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300
               bg-indigo-500/85 text-indigo-50 hover:bg-indigo-500"
        @click="emit('open-resources')"
      >
        <span class="text-base leading-none" aria-hidden="true">📐</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Resources</span>
        <!-- Live badge: count of Values + Solutions implying resource cost -->
        <span
          v-if="props.resourceImplyingCount && props.resourceImplyingCount > 0"
          class="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-indigo-900 text-[9px] font-extrabold flex items-center justify-center leading-none"
          :title="`${props.resourceImplyingCount} Value+Solution entr${props.resourceImplyingCount === 1 ? 'y' : 'ies'} imply resource cost`"
        >{{ props.resourceImplyingCount }}</span>
      </button>

      <!-- ⚡ Actions — both variants -->
      <button
        type="button"
        :aria-expanded="menuOpen"
        aria-haspopup="true"
        aria-label="Open Actions menu (Cmd+A)"
        title="⚡ Actions · ⌘A — every reachable affordance in SEM App as a searchable command palette.  Type to filter."
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               transition-all focus:outline-none focus:ring-2 focus:ring-amber-300"
        :class="menuOpen
          ? 'bg-amber-300 text-amber-900 ring-2 ring-amber-200'
          : 'bg-amber-400/90 text-amber-900 hover:bg-amber-400'"
        @click="emit('open-actions')"
      >
        <span class="text-base leading-none" aria-hidden="true">⚡</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Actions</span>
      </button>
    </div>
  </div>
</template>
