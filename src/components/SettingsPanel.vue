<!-- UNIT_TYPE=Panel -->
<!--
/**
 * SettingsPanel — the SEM App settings modal Tom requested long-ago and
 * finally ratified 2026-06-03 with the binding directive:
 *   *"draft one and put all the useful ideas in you can think about, and
 *    ten let me list some: Setting: Ultra Light, or Pro SEM, Default Pro
 *    Sem. Settings: collect maximum feedback data from use of this app, Do
 *    not collect any feedback data"*
 *
 * Plus the AI-Max SUPREME principle (Tom 2026-06-03) — settings include AI
 * assistance level (default Maximum) per the universal "impressive help,
 * not simplified AI access" directive.
 *
 * Sidebar nav of 9 sections; each section renders the relevant settings as
 * radios / toggles / numeric inputs / selects.  Every control has a :title
 * (Interaction Disclosure DD-009) explaining what it does + when it matters.
 *
 * Rules complied with:
 *   - Single-Surface: caller registers `settingsOpen` exclusive surface
 *   - ScrollContainer: both sidebar + main pane wrapped
 *   - CloseDot: header end-of-flex
 *   - Planguage-Glyph-First: no inline SVG icons (emoji + text labels)
 *   - Interaction Disclosure: every control has :title
 *
 * v1: settings persist + UI works.  Components consume settings as they are
 * wired in subsequent iterations.  Each "live" setting will be marked in
 * its row when its consumer is shipped.
 */
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import { useSettings } from '../composables/useSettings'
import { SETTINGS_SECTIONS } from '../data/settings'
import type { Settings } from '../data/settings'

defineEmits<{
  close: []
}>()

const { settings, setOne, resetAll, exportJson, importJson } = useSettings()

// ── Section navigation ───────────────────────────────────────────────────────
const activeSectionId = ref<string>('mode')

// ── Import/export UX ─────────────────────────────────────────────────────────
const showImport = ref(false)
const importText = ref('')
const importError = ref('')
function onImportConfirm(): void {
  if (importJson(importText.value)) {
    importText.value = ''
    importError.value = ''
    showImport.value = false
  } else {
    importError.value = 'Invalid JSON or schema mismatch.'
  }
}
function onExportCopy(): void {
  if (navigator.clipboard) navigator.clipboard.writeText(exportJson()).catch(() => { /* ignore */ })
}

// ── Reset confirm ────────────────────────────────────────────────────────────
function onResetConfirm(): void {
  if (confirm('Reset ALL settings to defaults?  Cannot be undone.')) {
    resetAll()
  }
}

// ── Type-safe setter helper for the template ─────────────────────────────────
// Vue template can't infer the generic K easily; wrap to coerce.
function set<K extends keyof Settings>(key: K, value: Settings[K]): void {
  setOne(key, value)
}

// ── "Live" marker — which settings are actually consumed by other components
// today vs queued for wiring.  Settings panel shows a small badge for each
// row so users know what's effective vs scaffold-only.
const LIVE_SETTINGS = new Set<keyof Settings>([
  // Today: nothing is live yet — every setting persists but is not consumed.
  // As components are wired, add their setting keys here.
])
function isLive(key: keyof Settings): boolean {
  return LIVE_SETTINGS.has(key)
}

// ── Counters for footer ──────────────────────────────────────────────────────
const liveCount = computed<number>(() => LIVE_SETTINGS.size)
const totalSettingsCount = Object.keys(settings.value).length

// ── Script-side option constants (avoid embedded-quote parse errors that
//    bit us 2026-06-03 when v-for inline arrays carried double-quoted help
//    text inside double-quoted attributes). ───────────────────────────────────
type TelLevel = 'none' | 'standard' | 'maximum'
const TELEMETRY_OPTIONS: Array<{ v: TelLevel; label: string; help: string }> = [
  { v: 'none',     label: 'None (default)', help: 'Do not collect any feedback data.  Tom verbatim.' },
  { v: 'standard', label: 'Standard',       help: 'Event counts only (e.g., counting when FEED ME! is opened).  No content, no PII.' },
  { v: 'maximum',  label: 'Maximum',        help: 'Tom verbatim — collect maximum feedback data from use of this app.  Events plus anonymised content samples.' },
]
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-slate-700 to-slate-900 text-white">
          <span class="text-2xl leading-none" aria-hidden="true">⚙</span>
          <div class="flex-1 min-w-0">
            <h2 id="settings-title" class="text-base font-bold">SEM Settings</h2>
            <p class="text-[11px] text-slate-300 mt-0.5">
              Mode · AI · Privacy · Evo defaults · Visual · Workflow · Export · Collab · Diagnostics
              <span class="text-amber-300 ml-2">· v1: {{ liveCount }}/{{ totalSettingsCount }} live, rest persist but not yet consumed</span>
            </p>
          </div>
          <CloseDot @click="$emit('close')" />
        </header>

        <!-- Body — sidebar + main pane -->
        <div class="flex-1 flex min-h-0">

          <!-- Sidebar — Tom 2026-06-03: "setting left pane does not scroll".
               Was passing sizing via `class=` directly which lands on the wrapper
               but ScrollContainer expects sizing on `outer-class` (the prop that
               gets `min-h-0` for the flex shrink that triggers inner overflow).
               Adding 9 sections worth of content exceeds modal height; without
               min-h-0 the inner overflow-y-auto cannot activate. -->
          <ScrollContainer
            outer-class="w-56 flex-shrink-0 border-r border-slate-200 bg-slate-50 min-h-0"
            inner-class="p-2 space-y-0.5"
          >
            <button
              v-for="sec in SETTINGS_SECTIONS"
              :key="sec.id"
              type="button"
              class="w-full text-left rounded-lg px-3 py-2 transition-colors"
              :class="sec.id === activeSectionId
                ? 'bg-white shadow-sm ring-1 ring-slate-300'
                : 'hover:bg-white/70'"
              :title="`${sec.label} — ${sec.description}`"
              @click="activeSectionId = sec.id"
            >
              <div class="flex items-center gap-2">
                <div class="w-1 h-3.5 rounded-full bg-gradient-to-b" :class="sec.accent" aria-hidden="true" />
                <span class="text-[12px] font-semibold text-slate-800">{{ sec.label }}</span>
              </div>
              <p class="text-[10px] text-slate-500 leading-snug ml-3 mt-0.5">{{ sec.description }}</p>
            </button>
          </ScrollContainer>

          <!-- Main pane -->
          <ScrollContainer outer-class="flex-1 min-h-0" inner-class="p-6 space-y-6">

            <!-- ── Mode ───────────────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'mode'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Mode</h3>
              <p class="text-[11px] text-slate-500 mb-4">Tom 2026-06-03: <em>"Ultra Light, or Pro SEM, Default Pro Sem"</em></p>

              <fieldset class="space-y-2">
                <legend class="sr-only">App mode</legend>
                <label
                  v-for="opt in [
                    { v: 'pro-sem' as const,    label: 'Pro SEM (default)', help: 'Full toolkit — every panel, every Evo Tool, every audit trail.  Recommended for serious Evo planning.' },
                    { v: 'ultra-light' as const, label: 'Ultra Light',       help: 'Minimal UI — fewer options, smaller panels.  For quick spec exploration without the full machinery.' },
                  ]"
                  :key="opt.v"
                  class="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:bg-slate-50"
                  :class="settings.mode === opt.v ? 'border-violet-300 bg-violet-50/40' : ''"
                  :title="opt.help"
                >
                  <input
                    type="radio"
                    :checked="settings.mode === opt.v"
                    name="mode"
                    class="mt-1 accent-violet-600"
                    @change="set('mode', opt.v)"
                  />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">{{ opt.label }}</p>
                    <p class="text-[11px] text-slate-600">{{ opt.help }}</p>
                  </div>
                </label>
              </fieldset>
            </section>

            <!-- ── AI Assistance ──────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'ai'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">AI Assistance</h3>
              <p class="text-[11px] text-slate-500 mb-4">
                AI-Max SUPREME principle (Tom 2026-06-03): <em>"Maximize AI assistance everywhere... WE want impressive help, not simplified ai access."</em>
                All AI work happens via Claudian or deterministic spec-derivation — never via in-app API call.
              </p>

              <!-- OFFLINE MODE — Tom 2026-06-03: "I would like to be about to run
                   my app successfully even when you claudian lock me out". When
                   ON: all AI / Claudian calls disabled; app uses deterministic
                   logic + manual entry + previously-cached data only.  Sits at
                   the TOP of the AI section because it's the master kill-switch. -->
              <div class="rounded-xl border-2 p-3 mb-4"
                :class="settings.offlineMode ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'"
              >
                <label class="flex items-start gap-2 cursor-pointer"
                  title="When ON: disables every AI/Claudian call across the SEM App. The app remains fully usable for manual planning and review — Sharp Interview shows typed-only answers, FEED ME! reads existing data, no Evo plan generation. Use this when Claudian is rate-limited / locked out / offline. Tom 2026-06-03 standing requirement: SEM App must work without AI."
                >
                  <input
                    type="checkbox"
                    :checked="settings.offlineMode"
                    class="mt-1 accent-amber-600 h-4 w-4"
                    @change="set('offlineMode', !settings.offlineMode); if (settings.offlineMode) set('aiAssistanceLevel', 'off')"
                  />
                  <div>
                    <p class="text-sm font-bold text-amber-900">
                      <span aria-hidden="true">🛟</span> Offline / Local-Only Mode
                      <span class="text-[9px] uppercase font-bold px-1 py-px rounded bg-amber-200 text-amber-800 ml-1">trust-rebuild</span>
                    </p>
                    <p class="text-[11px] text-slate-700 mt-0.5">
                      Master kill-switch: disables every AI / Claudian call across the SEM App so it works when Claudian is rate-limited, locked out, or unreachable. Manual entry, deterministic logic, and previously-cached data remain fully usable.  Tom 2026-06-03 standing requirement.
                    </p>
                    <p v-if="settings.offlineMode" class="text-[11px] text-amber-800 font-semibold mt-1.5">
                      ✓ AI is currently OFF.  Sharp Interview shows typed answers only; FEED ME! reads existing data; no Evo plan generation; no Claudian prompts copied to clipboard.
                    </p>
                  </div>
                </label>
              </div>

              <div class="space-y-4">
                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-fuchsia-700 mb-1">AI Level
                    <span v-if="settings.offlineMode" class="text-[9px] font-normal text-amber-700 normal-case ml-1">(forced OFF — disable Offline Mode above to change)</span>
                  </legend>
                  <div class="flex gap-2 flex-wrap">
                    <button
                      v-for="lvl in ['off', 'standard', 'maximum'] as const"
                      :key="lvl"
                      type="button"
                      class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize"
                      :class="settings.aiAssistanceLevel === lvl
                        ? 'bg-fuchsia-600 text-white border-fuchsia-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                      :title="lvl === 'off'
                        ? 'No AI suggestions or auto-derivations anywhere.  Manual input only.'
                        : lvl === 'standard'
                          ? 'AI suggestions on opt-in surfaces only.'
                          : 'AI suggestions, defaults, and derivations on every input surface (default).'"
                      @click="set('aiAssistanceLevel', lvl)"
                    >{{ lvl }}{{ lvl === 'maximum' ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <label class="flex items-start gap-2 cursor-pointer" :title="'Show the &quot;Why this matters&quot; rationale below every AI-derived suggestion.'">
                  <input type="checkbox" :checked="settings.showAIRationales" class="mt-1 accent-fuchsia-600" @change="set('showAIRationales', !settings.showAIRationales)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Show AI rationales inline</p>
                    <p class="text-[11px] text-slate-600">Below every suggestion, show the "Why this matters" explanation grounded in Evo theory.</p>
                  </div>
                </label>

                <label class="flex items-start gap-2 cursor-pointer" :title="'When opening Sharp Interview, derive suggestions from the current plan (v2 — not yet live).'">
                  <input type="checkbox" :checked="settings.autoDerivePlanAwareSuggestions" class="mt-1 accent-fuchsia-600" @change="set('autoDerivePlanAwareSuggestions', !settings.autoDerivePlanAwareSuggestions)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Auto-derive plan-aware suggestions <span class="text-[9px] uppercase font-bold px-1 py-px rounded bg-amber-100 text-amber-700 ml-1">v2 — not yet live</span></p>
                    <p class="text-[11px] text-slate-600">Derive Sharp Interview suggestions from the live plan (step.linkedSolutions, V. status, cycle length) instead of generic templates.</p>
                  </div>
                </label>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-fuchsia-700 mb-1">Suggestion count per question</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button
                      v-for="n in [2, 3, 5, 10] as const"
                      :key="n"
                      type="button"
                      class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                      :class="settings.sharpSuggestionCount === n
                        ? 'bg-fuchsia-600 text-white border-fuchsia-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                      :title="`Show ${n} AI-suggested answers per Sharp Interview question (default 3).`"
                      @click="set('sharpSuggestionCount', n)"
                    >{{ n }}{{ n === 3 ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-fuchsia-700 mb-1">Default Sharp Interview selection mode</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button
                      v-for="m in [
                        { v: 'mixed' as const,       label: 'Mixed (default)' },
                        { v: 'all' as const,         label: 'All' },
                        { v: 'typed-only' as const,  label: 'Typed only' },
                        { v: 'ticked-only' as const, label: 'Ticked only' },
                      ]"
                      :key="m.v"
                      type="button"
                      class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                      :class="settings.defaultSharpSelectionMode === m.v
                        ? 'bg-fuchsia-600 text-white border-fuchsia-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                      :title="`Default mode applied to new Sharp Interview questions.`"
                      @click="set('defaultSharpSelectionMode', m.v)"
                    >{{ m.label }}</button>
                  </div>
                </fieldset>
              </div>
            </section>

            <!-- ── Sharpening Processes ──────────────────────────────────── -->
            <section v-show="activeSectionId === 'sharpening'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Sharpening Processes</h3>
              <p class="text-[11px] text-slate-500 mb-4">
                Tom 2026-06-03 verbatim: <em>"Sharpening Processes (SEM and EVO separately).  Options 1. Collect Project Data on all Answers, 2. Apply Feedback data to next sharpening (to make it smarter and more tailored to the Plan and Planner preferences)"</em>
              </p>

              <!-- SEM Sharpening (Stage 3 — Sharpen the spec) -->
              <div class="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-3 mb-4">
                <h4 class="text-xs font-bold uppercase tracking-wide text-amber-800 mb-2">SEM Sharpening <span class="text-[10px] font-normal normal-case text-amber-700">(Stage 3 — spec sharpening)</span></h4>
                <label class="flex items-start gap-2 cursor-pointer mb-2" title="Capture every answer + every accept/reject decision in this project's sharpening, so future sharpening sessions can learn from the data.">
                  <input type="checkbox" :checked="settings.semSharpeningCollectData" class="mt-1 accent-amber-600" @change="set('semSharpeningCollectData', !settings.semSharpeningCollectData)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Collect Project Data on all Answers</p>
                    <p class="text-[11px] text-slate-600">Records typed answers, ticked suggestions, accept/reject decisions per (project, spec entry, question).  Data stays local; not telemetry.</p>
                  </div>
                </label>
                <label class="flex items-start gap-2 cursor-pointer" title="Feed the collected sharpening history back into the suggestion generator, so subsequent sharpening sessions are tailored to the plan's history and the Planner's preferences.">
                  <input type="checkbox" :checked="settings.semSharpeningApplyFeedback" class="mt-1 accent-amber-600" @change="set('semSharpeningApplyFeedback', !settings.semSharpeningApplyFeedback)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Apply Feedback data to next sharpening</p>
                    <p class="text-[11px] text-slate-600">Subsequent sharpening sessions read past answers + preferences and adapt suggestions accordingly (smarter, more tailored to this Plan + Planner).</p>
                  </div>
                </label>
              </div>

              <!-- Evo Sharpening (Sharpen Next Step — the new Sharp Interview) -->
              <div class="rounded-xl border-2 border-rose-200 bg-rose-50/40 p-3">
                <h4 class="text-xs font-bold uppercase tracking-wide text-rose-800 mb-2">Evo Sharpening <span class="text-[10px] font-normal normal-case text-rose-700">(Sharpen Next Step — the Evo Sharp Interview, 12 categories × 36 questions)</span></h4>
                <label class="flex items-start gap-2 cursor-pointer mb-2" title="Capture every answer + every ticked suggestion + every selection-mode choice across Evo Sharpening for this project.">
                  <input type="checkbox" :checked="settings.evoSharpeningCollectData" class="mt-1 accent-rose-600" @change="set('evoSharpeningCollectData', !settings.evoSharpeningCollectData)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Collect Project Data on all Answers</p>
                    <p class="text-[11px] text-slate-600">Records typed Planner answers, ticked AI suggestions, selection modes per (project, step, question).  Data stays local.</p>
                  </div>
                </label>
                <label class="flex items-start gap-2 cursor-pointer" title="Use the collected Evo Sharp Interview history to make the next interview's suggestions smarter and tailored to this plan + this planner's pattern.">
                  <input type="checkbox" :checked="settings.evoSharpeningApplyFeedback" class="mt-1 accent-rose-600" @change="set('evoSharpeningApplyFeedback', !settings.evoSharpeningApplyFeedback)" />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">Apply Feedback data to next sharpening</p>
                    <p class="text-[11px] text-slate-600">Subsequent Sharp Interview sessions adapt suggestions to the patterns of past answers — fewer rejected suggestions, more relevant prompts, planner-voice-aware.</p>
                  </div>
                </label>
              </div>

              <p class="text-[10px] text-slate-400 mt-3 italic">Default: all four ON.  Per AI-Max principle (default to maximum helpfulness, user can opt out).</p>
            </section>

            <!-- ── Telemetry ──────────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'telemetry'">
              <h3 class="text-sm font-bold text-slate-800 mb-1">Privacy &amp; Telemetry</h3>
              <p class="text-[11px] text-slate-500 mb-4">
                Tom 2026-06-03 explicitly named two endpoints: <em>"collect maximum feedback data"</em> and <em>"Do not collect any feedback data"</em>.  Defaults to <strong>None</strong> — privacy by default.
              </p>

              <fieldset class="space-y-2 mb-4">
                <legend class="text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">Telemetry level</legend>
                <label
                  v-for="opt in TELEMETRY_OPTIONS"
                  :key="opt.v"
                  class="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:bg-slate-50"
                  :class="settings.telemetryLevel === opt.v ? 'border-slate-400 bg-slate-100/60' : ''"
                  :title="opt.help"
                >
                  <input
                    type="radio"
                    :checked="settings.telemetryLevel === opt.v"
                    name="telemetryLevel"
                    class="mt-1 accent-slate-700"
                    @change="set('telemetryLevel', opt.v)"
                  />
                  <div>
                    <p class="text-sm font-semibold text-slate-800">{{ opt.label }}</p>
                    <p class="text-[11px] text-slate-600">{{ opt.help }}</p>
                  </div>
                </label>
              </fieldset>

              <label class="flex items-start gap-2 cursor-pointer mb-2" :title="'Send anonymous error reports when the app crashes.  Separate from telemetry.'">
                <input type="checkbox" :checked="settings.allowErrorReports" class="mt-1 accent-slate-700" @change="set('allowErrorReports', !settings.allowErrorReports)" />
                <p class="text-sm text-slate-800">Allow anonymous error reports <span class="text-[11px] text-slate-500">(separate from telemetry)</span></p>
              </label>
              <label class="flex items-start gap-2 cursor-pointer" :title="'Capture session screen recordings for debugging.  Very intrusive — opt-in only.'">
                <input type="checkbox" :checked="settings.allowSessionRecordings" class="mt-1 accent-slate-700" @change="set('allowSessionRecordings', !settings.allowSessionRecordings)" />
                <p class="text-sm text-slate-800">Allow session recordings for debugging <span class="text-[11px] text-amber-700">(intrusive — opt-in only)</span></p>
              </label>
            </section>

            <!-- ── Evo Defaults ───────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'evo'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Evo Defaults</h3>

              <fieldset class="mb-4">
                <legend class="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">Default cycle length for new plans</legend>
                <div class="flex gap-2 flex-wrap">
                  <button
                    v-for="cl in [
                      { v: 'day' as const,     label: 'Day (~8h)' },
                      { v: 'week' as const,    label: 'Week (~40h, default)' },
                      { v: 'month' as const,   label: 'Month (~160h)' },
                      { v: 'quarter' as const, label: 'Quarter (~480h)' },
                    ]"
                    :key="cl.v"
                    type="button"
                    class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                    :class="settings.defaultCycleLength === cl.v
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                    :title="`Default Evo cycle length applied to new plans.  Overridable per-plan via EvoCycleLengthPicker.`"
                    @click="set('defaultCycleLength', cl.v)"
                  >{{ cl.label }}</button>
                </div>
              </fieldset>

              <label class="block mb-3" :title="'Stamped as reviewedBy when you approve / reject FEED ME! actions.'">
                <span class="text-sm font-semibold text-slate-800">Default reviewer name</span>
                <input type="text" :value="settings.defaultReviewerName" class="mt-1 w-64 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" @input="(e) => set('defaultReviewerName', (e.target as HTMLInputElement).value)" />
              </label>

              <label class="block mb-3" :title="'How many days after a step delivery to capture lagging measures (FEED ME! Last Step in Paris).'">
                <span class="text-sm font-semibold text-slate-800">Default lagging-measurement window (days)</span>
                <input type="number" :value="settings.defaultLaggingWindowDays" min="1" max="90" class="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400" @input="(e) => set('defaultLaggingWindowDays', parseInt((e.target as HTMLInputElement).value) || 7)" />
              </label>

              <label class="flex items-start gap-2 cursor-pointer mb-3" :title="'When a new Evo Step is generated, automatically open the Sharpen Next Step interview for it.'">
                <input type="checkbox" :checked="settings.autoOpenSharpOnNewStep" class="mt-1 accent-amber-600" @change="set('autoOpenSharpOnNewStep', !settings.autoOpenSharpOnNewStep)" />
                <p class="text-sm text-slate-800">Auto-open Sharpen Next Step for new steps</p>
              </label>

              <fieldset>
                <legend class="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">Default risk tolerance (for Skunkworks)</legend>
                <div class="flex gap-2 flex-wrap">
                  <button
                    v-for="r in ['low', 'medium', 'high'] as const"
                    :key="r"
                    type="button"
                    class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize"
                    :class="settings.defaultRiskTolerance === r
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                    :title="`Default risk tolerance applied to Skunkworks idea generation prompts.`"
                    @click="set('defaultRiskTolerance', r)"
                  >{{ r }}{{ r === 'medium' ? ' (default)' : '' }}</button>
                </div>
              </fieldset>
            </section>

            <!-- ── Visualization ──────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'visual'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Visualization</h3>

              <div class="space-y-4">
                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Theme</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button v-for="t in ['light', 'dark', 'auto'] as const" :key="t" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize" :class="settings.theme === t ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Theme: ${t === 'auto' ? 'follows system' : t}`" @click="set('theme', t)">{{ t }}{{ t === 'auto' ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Density</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button v-for="d in ['compact', 'comfortable', 'spacious'] as const" :key="d" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize" :class="settings.density === d ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Padding density across tables, lists, and panels.`" @click="set('density', d)">{{ d }}{{ d === 'comfortable' ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Animation level</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button v-for="a in ['full', 'reduced', 'none'] as const" :key="a" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize" :class="settings.animationLevel === a ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Animation level — reduced respects prefers-reduced-motion.`" @click="set('animationLevel', a)">{{ a }}{{ a === 'full' ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Font scale</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button v-for="n in [90, 100, 110, 125] as const" :key="n" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors" :class="settings.fontScalePercent === n ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Font scale ${n}%.`" @click="set('fontScalePercent', n)">{{ n }}%{{ n === 100 ? ' (default)' : '' }}</button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-1">Colour-blindness mode</legend>
                  <div class="flex gap-2 flex-wrap">
                    <button v-for="c in ['none', 'deuteranopia', 'protanopia', 'tritanopia'] as const" :key="c" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors capitalize" :class="settings.colorBlindMode === c ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Colour filter for colour-blind users.`" @click="set('colorBlindMode', c)">{{ c }}</button>
                  </div>
                </fieldset>
              </div>
            </section>

            <!-- ── Workflow ────────────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'workflow'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Workflow</h3>
              <label class="block mb-3" :title="'Seconds between auto-saves (0 = manual save only).'">
                <span class="text-sm font-semibold text-slate-800">Auto-save interval (seconds)</span>
                <input type="number" :value="settings.autoSaveIntervalSeconds" min="0" max="3600" class="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" @input="(e) => set('autoSaveIntervalSeconds', parseInt((e.target as HTMLInputElement).value) || 0)" />
                <span class="text-[11px] text-slate-500 ml-2">(0 = manual only)</span>
              </label>
              <label class="flex items-start gap-2 cursor-pointer mb-2" :title="'Confirm before destructive ops (Clear All, Reset, Discard).'">
                <input type="checkbox" :checked="settings.confirmBeforeDestructive" class="mt-1 accent-sky-600" @change="set('confirmBeforeDestructive', !settings.confirmBeforeDestructive)" />
                <p class="text-sm text-slate-800">Confirm before destructive operations</p>
              </label>
              <label class="flex items-start gap-2 cursor-pointer mb-2" :title="'Show toast notifications on save / completion / errors.'">
                <input type="checkbox" :checked="settings.showToasts" class="mt-1 accent-sky-600" @change="set('showToasts', !settings.showToasts)" />
                <p class="text-sm text-slate-800">Show toast notifications</p>
              </label>
              <label class="flex items-start gap-2 cursor-pointer" :title="'Remind me to capture lagging measures (~7d after step delivery).'">
                <input type="checkbox" :checked="settings.enableLaggingMeasureReminders" class="mt-1 accent-sky-600" @change="set('enableLaggingMeasureReminders', !settings.enableLaggingMeasureReminders)" />
                <p class="text-sm text-slate-800">Enable lagging-measure reminders</p>
              </label>
            </section>

            <!-- ── Export ──────────────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'export'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Export</h3>
              <fieldset class="mb-4">
                <legend class="text-xs font-bold uppercase tracking-wide text-pink-700 mb-1">Default export format</legend>
                <div class="flex gap-2 flex-wrap">
                  <button v-for="f in ['html', 'markdown', 'json', 'tsv'] as const" :key="f" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors uppercase" :class="settings.defaultExportFormat === f ? 'bg-pink-600 text-white border-pink-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`Default format for export buttons.`" @click="set('defaultExportFormat', f)">{{ f }}{{ f === 'html' ? ' (default)' : '' }}</button>
                </div>
              </fieldset>
              <label class="flex items-start gap-2 cursor-pointer mb-3" :title="'Include audit trail (Source + Reason) in every export.'">
                <input type="checkbox" :checked="settings.includeAuditTrailInExports" class="mt-1 accent-pink-600" @change="set('includeAuditTrailInExports', !settings.includeAuditTrailInExports)" />
                <p class="text-sm text-slate-800">Always include audit trail (Source + Reason) in exports</p>
              </label>
              <label class="block" :title="'Default sender address for email exports.'">
                <span class="text-sm font-semibold text-slate-800">Default email sender</span>
                <input type="email" :value="settings.defaultEmailFrom" class="mt-1 w-72 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-pink-400" @input="(e) => set('defaultEmailFrom', (e.target as HTMLInputElement).value)" />
              </label>
            </section>

            <!-- ── Collaboration ──────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'collab'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Collaboration</h3>
              <label class="block mb-3" :title="'Default plan-owner name stamped onto new plans.'">
                <span class="text-sm font-semibold text-slate-800">Default plan owner</span>
                <input type="text" :value="settings.defaultPlanOwner" class="mt-1 w-72 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400" @input="(e) => set('defaultPlanOwner', (e.target as HTMLInputElement).value)" />
              </label>
              <fieldset>
                <legend class="text-xs font-bold uppercase tracking-wide text-cyan-700 mb-1">Twin (Kai's industrial app) sharing</legend>
                <div class="flex gap-2 flex-wrap">
                  <button v-for="m in [
                    { v: 'manual' as const, label: 'Manual (default)' },
                    { v: 'auto' as const,   label: 'Auto-share' },
                    { v: 'off' as const,    label: 'Off' },
                  ]" :key="m.v" type="button" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors" :class="settings.twinShareMode === m.v ? 'bg-cyan-600 text-white border-cyan-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'" :title="`How to share plans with Tom's Twin (Kai's industrial app).`" @click="set('twinShareMode', m.v)">{{ m.label }}</button>
                </div>
              </fieldset>
            </section>

            <!-- ── Diagnostics ────────────────────────────────────────────── -->
            <section v-show="activeSectionId === 'diagnostics'">
              <h3 class="text-sm font-bold text-slate-800 mb-3">Diagnostics</h3>
              <label class="flex items-start gap-2 cursor-pointer mb-2" :title="'Show developer hints in tooltips (e.g., which composable backs each panel).'">
                <input type="checkbox" :checked="settings.showDevHints" class="mt-1 accent-slate-700" @change="set('showDevHints', !settings.showDevHints)" />
                <p class="text-sm text-slate-800">Show developer hints in tooltips</p>
              </label>
              <label class="flex items-start gap-2 cursor-pointer" :title="'Log AI-suggestion resolution failures to console (helps debug LLM drift).'">
                <input type="checkbox" :checked="settings.logAIResolutionFailures" class="mt-1 accent-slate-700" @change="set('logAIResolutionFailures', !settings.logAIResolutionFailures)" />
                <p class="text-sm text-slate-800">Log AI-suggestion resolution failures to console</p>
              </label>
            </section>

            <!-- Import / Export / Reset always visible at the bottom -->
            <section class="border-t border-slate-200 pt-4">
              <h4 class="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">Backup &amp; Reset</h4>
              <div class="flex gap-2 flex-wrap">
                <button type="button" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50" title="Copy all settings as JSON to clipboard" @click="onExportCopy">Export to clipboard</button>
                <button type="button" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50" title="Paste JSON to restore settings" @click="showImport = !showImport">{{ showImport ? 'Cancel import' : 'Import from JSON' }}</button>
                <button type="button" class="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100" title="Reset all settings to defaults — cannot be undone" @click="onResetConfirm">Reset all to defaults</button>
              </div>
              <div v-if="showImport" class="mt-3">
                <textarea v-model="importText" rows="4" placeholder="Paste settings JSON here" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <div class="flex items-center gap-2 mt-2">
                  <button type="button" class="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-800" @click="onImportConfirm">Apply</button>
                  <p v-if="importError" class="text-xs text-red-700">{{ importError }}</p>
                </div>
              </div>
            </section>
          </ScrollContainer>
        </div>

      </div>
    </div>
  </Teleport>
</template>
