<script setup lang="ts">
/**
 * IlluminationSettingsPanel — Phase 3 of the Illumination AI design.
 *
 * Tom Gilb 2026-06-15 verbatim (Phase 3 mandate):
 *   *"We have an 'Illumination Settings' panel where we allow them to set
 *    Preferences (like 'Always Give Me An Ontology Diagram', 'I like historical
 *    background', 'I want deepest possible insights'). This panel is tied to a
 *    specific Plan/Spec Owner or Planner, by default the ones named for the
 *    current plan."*
 *
 * Side drawer launched from the ⚙ pin in the ⌘I picker header.  Overrides the
 * GLOBAL Illumination defaults (r41 v29 Settings panel) per Plan-Owner /
 * Planner.  Effective preferences = personal-override OR global default per
 * field (see useIlluminationPreferences.effective()).
 *
 * Composes with all the same SUPREME rules as the underlying composable plus:
 *   - CloseDot rule (CloseDot + backdrop click + Escape — three escape routes)
 *   - r41 v25 (no stranded HoverHints across scroll / mouseleave / Esc)
 *   - American English Standard
 *   - HoverHint (not "tooltip")
 */

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import CloseDot from './CloseDot.vue'
import { useIlluminationPreferences, type IlluminateTab, type IlluminationDepth } from '../composables/useIlluminationPreferences'

const props = defineProps<{
  open:      boolean
  planId:    string
  ownerName: string
}>()

const emit = defineEmits<{
  (e: 'close'):           void
  /** Fires whenever a preference changes so the picker can react live. */
  (e: 'changed'):         void
}>()

const { effective, getOverride, setOne, clearOverride, allProfiles } = useIlluminationPreferences()

// Local snapshot of the effective preferences for binding to UI controls.
// Re-derived whenever the open prop or planId/ownerName changes.
const eff = computed(() => effective(props.planId, props.ownerName))

// Has this user actually saved any personal preferences (vs. using all defaults)?
const hasPersonalOverride = computed<boolean>(() => {
  const o = getOverride(props.planId, props.ownerName)
  if (!o) return false
  return Object.keys(o).some(k => k !== 'lastSavedAt')
})

function set<K extends keyof ReturnType<typeof effective>>(key: K, value: ReturnType<typeof effective>[K]): void {
  // Map back to the override shape (drop the lastSavedAt synthetic field).
  if (key === 'lastSavedAt') return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setOne(props.planId, props.ownerName, key as any, value as any)
  emit('changed')
}

function resetAll(): void {
  if (!confirm('Reset all personal Illumination preferences for this profile?\n\nYou will fall back to the global defaults from Settings → Illumination AI.')) return
  clearOverride(props.planId, props.ownerName)
  emit('changed')
}

// ── HoverHint dismiss safety (matches r41 v25 pattern on PlanguageUniverse) ──
function _onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.open) {
    const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return
    emit('close')
  }
}
onMounted(() => document.addEventListener('keydown', _onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', _onKey))

// Format the last-saved time for the footer.
const lastSavedDisplay = computed<string>(() => {
  if (!eff.value.lastSavedAt) return 'never (using global defaults)'
  const d = new Date(eff.value.lastSavedAt)
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
})

// Tab options (kept local — never imported from another component to avoid
// circular type imports between picker ↔ this panel).
const TAB_OPTIONS: Array<{ v: IlluminateTab; label: string }> = [
  { v: 'define',   label: '📖 Define' },
  { v: 'diagram',  label: '📐 Diagram' },
  { v: 'pictures', label: '🎨 Pictures' },
  { v: 'universe', label: '🌌 Universe' },
  { v: 'books',    label: '📚 Books' },
  { v: 'twin',     label: '🧠 Ask Twin' },
]

const DEPTH_OPTIONS: Array<{ v: IlluminationDepth; label: string; tip: string }> = [
  { v: 'short',    label: '⚡ Short',    tip: 'Glance card only — one sentence + CTAs.  Fastest path.' },
  { v: 'standard', label: '📖 Standard', tip: 'Glance + primary entry on expand.  Default.' },
  { v: 'deep',     label: '🔬 Deep',     tip: 'Tom verbatim (I want deepest possible insights).  Pre-expand + Twin always-on + history included.' },
]

// Re-emit changed whenever the underlying owner/plan changes so the picker re-reads.
watch(() => `${props.planId}:${props.ownerName}`, () => emit('changed'))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[2000] flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="illumination-settings-title"
    >
      <!-- Backdrop (click to dismiss — CloseDot rule mandates) -->
      <div
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        @click="emit('close')"
      ></div>

      <!-- Right-side drawer -->
      <aside
        class="relative bg-white shadow-2xl border-l-2 border-violet-200 w-full max-w-md flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <header class="px-5 py-3 border-b-2 border-violet-200 bg-gradient-to-r from-amber-50 via-orange-50 to-violet-50 flex items-center gap-2 shrink-0">
          <span class="text-2xl">⚙</span>
          <div class="flex-1 min-w-0">
            <h2 id="illumination-settings-title" class="text-base font-extrabold text-slate-800 leading-tight">
              Illumination Settings
            </h2>
            <p class="text-[11px] text-slate-600 leading-tight mt-0.5 truncate">
              For <strong>{{ ownerName || '(no owner)' }}</strong> on plan <strong>{{ planId || '(no plan)' }}</strong>
            </p>
          </div>
          <CloseDot size="lg" aria-label="Close Illumination Settings" @click="emit('close')" />
        </header>

        <!-- Body -->
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">

          <!-- Personal-override banner -->
          <div
            class="rounded-lg p-3 border text-xs"
            :class="hasPersonalOverride
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-slate-50 border-slate-300 text-slate-700'"
          >
            <p v-if="hasPersonalOverride">
              ✓ <strong>{{ ownerName }}</strong> has personal preferences saved.  These override the global defaults from Settings → Illumination AI.
            </p>
            <p v-else>
              No personal preferences yet — <strong>{{ ownerName }}</strong> is using the global defaults from Settings → Illumination AI.  Change any control below to start saving personal preferences.
            </p>
          </div>

          <!-- Default tab -->
          <fieldset class="rounded-lg border-2 border-amber-200 bg-amber-50/40 p-3">
            <legend class="text-xs font-bold text-amber-900 px-1">Default tab on open</legend>
            <p class="text-[10px] text-slate-600 mb-2">Which tab the ⌘I picker lands on when this user first opens it.</p>
            <select
              :value="eff.defaultTab"
              class="w-full text-xs px-2 py-1.5 border-2 border-amber-300 rounded bg-white"
              title="Pick the tab the ⌘I picker should open to for this profile."
              @change="set('defaultTab', ($event.target as HTMLSelectElement).value as IlluminateTab)"
            >
              <option v-for="t in TAB_OPTIONS" :key="t.v" :value="t.v">{{ t.label }}</option>
            </select>
          </fieldset>

          <!-- Glance card -->
          <label class="flex items-start gap-2 cursor-pointer rounded-lg p-2 hover:bg-amber-50">
            <input
              type="checkbox"
              :checked="eff.showGlanceCard"
              class="mt-0.5"
              title="When on, the Define tab opens with a short definition + CTAs.  When off, the full Glossary entry is visible immediately."
              @change="set('showGlanceCard', ($event.target as HTMLInputElement).checked)"
            />
            <div class="text-xs">
              <div class="font-bold text-amber-900">Show the GLANCE card first</div>
              <div class="text-[10px] text-slate-600">One short definition + Want-to-know-more + Sharp-Enough CTAs before full reveal.</div>
            </div>
          </label>

          <!-- Auto-fire Twin -->
          <label class="flex items-start gap-2 cursor-pointer rounded-lg p-2 hover:bg-amber-50">
            <input
              type="checkbox"
              :checked="eff.autoFireTwin"
              class="mt-0.5"
              title="Auto-fire Tom Gilb Consultant Twin 800 ms after the user pauses typing — drives Twin discovery (r93ppp)."
              @change="set('autoFireTwin', ($event.target as HTMLInputElement).checked)"
            />
            <div class="text-xs">
              <div class="font-bold text-amber-900">Auto-fire Twin Consultant search</div>
              <div class="text-[10px] text-slate-600">800 ms after the user pauses typing.</div>
            </div>
          </label>

          <!-- Always diagram first -->
          <label class="flex items-start gap-2 cursor-pointer rounded-lg p-2 hover:bg-amber-50">
            <input
              type="checkbox"
              :checked="eff.alwaysDiagramFirst"
              class="mt-0.5"
              title='Tom Gilb 2026-06-15 verbatim example preference: "Always Give Me An Ontology Diagram". When on, the picker auto-switches to 📐 Diagram whenever the concept has a mermaid block.'
              @change="set('alwaysDiagramFirst', ($event.target as HTMLInputElement).checked)"
            />
            <div class="text-xs">
              <div class="font-bold text-amber-900">Always show ontology diagram first</div>
              <div class="text-[10px] text-slate-600 italic">Tom verbatim example: "Always Give Me An Ontology Diagram".</div>
            </div>
          </label>

          <!-- Depth -->
          <fieldset class="rounded-lg border-2 border-amber-200 bg-amber-50/40 p-3">
            <legend class="text-xs font-bold text-amber-900 px-1">Illumination depth</legend>
            <p class="text-[10px] text-slate-600 mb-2">How much to reveal by default for this user.</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="d in DEPTH_OPTIONS"
                :key="d.v"
                type="button"
                class="text-xs px-2 py-1 rounded border-2 font-semibold"
                :class="eff.depth === d.v
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'"
                :title="d.tip"
                @click="set('depth', d.v)"
              >{{ d.label }}</button>
            </div>
          </fieldset>

          <!-- Include history -->
          <label class="flex items-start gap-2 cursor-pointer rounded-lg p-2 hover:bg-amber-50">
            <input
              type="checkbox"
              :checked="eff.includeHistory"
              class="mt-0.5"
              title='Tom Gilb 2026-06-15 verbatim example preference: "I like historical background". When on, Twin AI prompts include relevant Planguage evolution + Gilb-book lineage context.'
              @change="set('includeHistory', ($event.target as HTMLInputElement).checked)"
            />
            <div class="text-xs">
              <div class="font-bold text-amber-900">Include historical background in Twin answers</div>
              <div class="text-[10px] text-slate-600 italic">Tom verbatim example: "I like historical background".</div>
            </div>
          </label>

          <!-- Classifier lens -->
          <label class="flex items-start gap-2 cursor-pointer rounded-lg p-2 hover:bg-amber-50">
            <input
              type="checkbox"
              :checked="eff.showClassifierLens"
              class="mt-0.5"
              title="Phase 2 classifier shows a primary-lens chip on the glance card (📋 Requirements / 🔁 Processes / 🎨 Design / 🔬 QA / 🗺 Management / 💰 Finance) + a suggested-tab nudge.  Toggle off to hide both."
              @change="set('showClassifierLens', ($event.target as HTMLInputElement).checked)"
            />
            <div class="text-xs">
              <div class="font-bold text-amber-900">Show classifier lens + suggested-tab nudge</div>
              <div class="text-[10px] text-slate-600">Phase 2 primary-lens chip on the glance card.</div>
            </div>
          </label>

          <!-- Twin timeout -->
          <fieldset class="rounded-lg border-2 border-amber-200 bg-amber-50/40 p-3">
            <legend class="text-xs font-bold text-amber-900 px-1">Twin Consultant timeout</legend>
            <p class="text-[10px] text-slate-600 mb-2">Maximum seconds to wait for Twin response before showing the timeout state.  0 = no timeout (wait indefinitely).</p>
            <input
              type="number"
              min="0"
              max="120"
              :value="eff.twinTimeoutSeconds"
              class="w-24 text-xs px-2 py-1.5 border-2 border-amber-300 rounded bg-white"
              title="Per-Owner Twin response timeout in seconds.  Default 30 s.  0 = wait indefinitely."
              @change="set('twinTimeoutSeconds', Number(($event.target as HTMLInputElement).value) || 0)"
            />
            <span class="text-[10px] text-slate-500 ml-2">seconds</span>
          </fieldset>

          <!-- Email address -->
          <fieldset class="rounded-lg border-2 border-amber-200 bg-amber-50/40 p-3">
            <legend class="text-xs font-bold text-amber-900 px-1">Preferred email for session sends</legend>
            <p class="text-[10px] text-slate-600 mb-2">Default recipient for the Phase 5 "📧 Email everything / Email the following" buttons.  Falls back to global Settings → Export defaultEmailFrom.</p>
            <input
              type="email"
              :value="eff.preferredEmailAddress"
              class="w-full text-xs px-2 py-1.5 border-2 border-amber-300 rounded bg-white"
              placeholder="Tom@Gilb.com"
              title="Per-Owner default email recipient for Illumination session sends."
              @change="set('preferredEmailAddress', ($event.target as HTMLInputElement).value)"
            />
          </fieldset>
        </div>

        <!-- Footer -->
        <footer class="px-5 py-3 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center gap-2 flex-wrap">
          <span class="text-[10px] text-slate-500 italic flex-1">
            Saved {{ lastSavedDisplay }}
            <span v-if="allProfiles.length > 1" class="ml-2">· {{ allProfiles.length }} profiles total</span>
          </span>
          <button
            v-if="hasPersonalOverride"
            type="button"
            class="px-3 py-1 rounded-md text-[11px] font-semibold text-rose-700 hover:bg-rose-100 border border-rose-200 bg-white"
            title="Clear all personal preferences for this profile — fall back to the global defaults from Settings → Illumination AI.  Confirmation required."
            @click="resetAll"
          >↺ Reset to global defaults</button>
          <button
            type="button"
            class="px-3 py-1 rounded-md text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 shadow"
            title="Close the Illumination Settings drawer.  Changes auto-save as you toggle controls — no Save button needed."
            @click="emit('close')"
          >Done</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
