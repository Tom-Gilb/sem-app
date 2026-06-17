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
}

withDefaults(defineProps<Props>(), {
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
})

const emit = defineEmits<{
  'open-find':       []
  'undo':            []
  'redo':            []
  'open-search-term':[]
  'open-settings':   []
  'open-sos':        []
  'open-mic':        []
  'open-read':       []
  'open-books':      []
  'open-agents':     []
  'open-actions':    []
}>()
</script>

<template>
  <div class="absolute top-1.5 right-1 flex items-end justify-end gap-2 pr-0.5 max-w-[calc(100%-260px)]">
    <!-- Group title — Level 1 identity -->
    <div
      class="shrink-0 flex flex-col gap-0.5 mr-1 self-end"
      :class="variant === 'post-spec' ? '' : ''"
      aria-hidden="true"
    >
      <span
        class="text-[9px] font-bold uppercase tracking-widest leading-none"
        :class="variant === 'post-spec' ? 'text-white/40' : 'text-slate-400'"
      >
        Always Available
      </span>
      <span
        class="text-[11px] font-extrabold uppercase tracking-wider leading-none whitespace-nowrap"
        :class="variant === 'post-spec' ? 'text-white/85' : 'text-slate-700'"
      >
        Level 1 · Process Tools
      </span>
    </div>

    <!-- CONTROLS sub-pill — slate background, h-10 buttons -->
    <div
      class="shrink-0 flex items-center gap-1 rounded-2xl bg-slate-700/40 ring-1 ring-white/15 px-1.5 py-1"
      aria-label="App controls"
    >
      <!-- 🔍 Find — opens command palette -->
      <button
        type="button"
        class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg
               bg-slate-700/80 text-white hover:bg-slate-600 ring-1 ring-slate-400/60 hover:ring-slate-300
               focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
        aria-label="Find — open command palette (Cmd+F)"
        title="🔍 Find · ⌘F — open the Actions / command palette.  Type anywhere to filter every reachable affordance in SEM App."
        @click="emit('open-find')"
      >
        <span class="text-base leading-none" aria-hidden="true">🔍</span>
        <span class="text-[10px] font-bold leading-none tracking-wide">Find</span>
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
