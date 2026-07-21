<!-- UNIT_TYPE=Widget -->
<!--
 * IdentityStrip.vue — r41 v116 (Tom Gilb 2026-06-17 verbatim "I want all
 * pins or buttons to be organized into clear groups. 1. The permanent,
 * always there pins., 2. Tools for use at this stage (likePenta) and 3.
 * Specific Pins for this particular stage").
 *
 * GROUP 3 · IDENTITY STRIP — surfaces every "what IS this spec right now"
 * affordance in ONE clean horizontal strip.  Replaces the chaotic Plan Crest
 * Row 2 (which had PHI + Spec chip + Version + Deadline + Sharpen badge +
 * Saved-N-min-ago + Spec Story + Planner chip + Scribe chip + tool-launchers
 * all mashed together with mixed sizing and palettes).
 *
 * Pattern: uniform h-9, glyph + text label per Icon-Plus-Text SUPREME, slate
 * pill segments separated by a thin divider.  All affordances click into
 * their canonical detail panel (PHI → SpecHealthStatus, Plan name → SpecModel
 * panel, Version → History, Owner/Planner/Scribe → SpecOwnerPanel with the
 * corresponding tab, Saved → save-now flash, Spec Story → toggle the DNA
 * strip).
 *
 * Emits actions instead of mutating refs directly so the parent owns the
 * surface registry (registerExclusiveSurface compatibility preserved).
 -->
<script setup lang="ts">
import { computed } from 'vue'
import SpecHealthBadge from './SpecHealthBadge.vue'
import PlanGlyph from './icons/PlanGlyph.vue'
import OwnerGlyph from './icons/OwnerGlyph.vue'
import PlannerGlyph from './icons/PlannerGlyph.vue'
import ScribeGlyph from './icons/ScribeGlyph.vue'
import SaveGlyph from './icons/SaveGlyph.vue'
import SpecStoryGlyph from './icons/SpecStoryGlyph.vue'
import ActiveModeButton from './ActiveModeButton.vue'

interface Steward { name?: string; isDefault?: boolean }

const props = defineProps<{
  /** Plan name (the headline) */
  planName?: string
  /** Version string e.g. "0.1" */
  planVersion?: string | number
  /** PHI score 0-100, undefined = no spec */
  phiScore?: number | undefined
  /** PHI threshold for "healthy" */
  phiThreshold?: number
  /** Number of PHI alerts pending */
  phiAlertCount?: number
  /** Stewards by role */
  owners?:   Steward[]
  planners?: Steward[]
  scribes?:  Steward[]
  /**
   * Counts of OTHER stewardship roles — passed from App.vue so the Owner chip
   * HoverHint can spell out how many people are in each role without IdentityStrip
   * having to know the full Steward shape for every role.
   * Tom Gilb 2026-06-19: Owner chip + Spec Responsibilities pointer.
   */
  plannerCount?:   number
  scribeCount?:    number
  architectCount?: number
  ctoCount?:       number
  /** Save state */
  savedLabel?: string
  unsaved?:    boolean
  saveFlash?:  'idle' | 'flash'
  /** Spec Story toggle state */
  specStoryOpen?: boolean
  /** Deadline string ('?' = not set) */
  deadline?: string
  /** Sharpen rounds count */
  sharpenRounds?: number
}>()

const emit = defineEmits<{
  (e: 'open-phi'): void
  (e: 'open-spec'): void
  (e: 'open-history'): void
  (e: 'open-owners'): void
  (e: 'open-planners'): void
  (e: 'open-scribes'): void
  (e: 'save-now'): void
  (e: 'toggle-spec-story'): void
  (e: 'edit-deadline'): void
  /** r41 v233 (Tom Gilb 2026-06-20 verbatim "the model (Contact, Plan,
   *  MOdel etc) is clearly displayed near title, including opportunity
   *  to chanhe mode by clicking it") — Mode chip click → open the
   *  ActiveModePopover (hosted by App.vue). */
  (e: 'open-mode-picker'): void
}>()

const versionLabel = computed(() => {
  if (props.planVersion === undefined || props.planVersion === null) return ''
  const v = String(props.planVersion)
  return v.startsWith('v') ? v : `v${v}`
})

const ownerName = computed(() => props.owners?.[0]?.name ?? '')
const extraOwners = computed(() => Math.max(0, (props.owners?.length ?? 0) - 1))

// r41 v… (Tom Gilb 2026-06-19) — single-Owner chip + Spec Responsibilities pointer.
// Counts for the HoverHint that spells out other-role populations.
const plannerCount   = computed(() => props.plannerCount   ?? 0)
const scribeCount    = computed(() => props.scribeCount    ?? 0)
const architectCount = computed(() => props.architectCount ?? 0)
const ctoCount       = computed(() => props.ctoCount       ?? 0)
const otherRoleCount = computed(() =>
  plannerCount.value + scribeCount.value + architectCount.value + ctoCount.value,
)
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-3 px-3 py-2 bg-slate-900/40 border-y border-white/10 text-white"
    aria-label="Spec identity strip — spec health, spec name, version, stewards, save state, story toggle"
  >
    <!-- ──────── Spec Mode sub-group (r41 v233, Tom Gilb 2026-06-20) ──────
         "the model (Contact, Plan, MOdel etc) is clearly displayed near
         title, including opportunity to chanhe mode by clicking it".  ANSWER
         BANKED 2026-06-16 (`useActiveMode.ts`): 4-mode singleton (Plan /
         Model / Contract / Strategy) with hover-rich-config + click-to-open
         picker.  ActiveModeButton has existed since v147; it was imported
         but NEVER mounted in App.vue — fixed here by mounting in the
         IdentityStrip's leading position so the planner ALWAYS sees the
         current Mode beside the spec identity.  Click emits open-mode-picker;
         App.vue toggles ActiveModePopover. -->
    <div class="shrink-0 flex flex-col gap-0.5">
      <span class="text-[9px] font-bold uppercase tracking-widest leading-none text-white/60 px-1.5 whitespace-nowrap">
        Spec Mode
      </span>
      <ActiveModeButton @click="emit('open-mode-picker')" />
    </div>

    <!-- Group title — r41 v147 (Tom Gilb 2026-06-17 "inside one of 3 bars top
         one"): Process Tools now lives in this top bar via the `end` slot
         after the STORY sub-group, instead of floating as a separate
         absolute-positioned cluster overlaying the stage bar. -->
    <!-- r41 v150 — "Group 3 ·" prefix dropped per Tom Gilb 2026-06-17
         verbatim "anyone can see the level and the name of the area is
         more informative". -->
    <div class="shrink-0 flex flex-col justify-end mr-1 self-end">
      <span class="text-[12px] font-extrabold text-white/85 uppercase tracking-wider leading-none whitespace-nowrap">
        Spec Identity
      </span>
    </div>

    <!-- ──────── Spec Health sub-group ──────── -->
    <!-- Tom Gilb 2026-06-18 verbatim: "'Spec Health'".  Was "📊 Health" —
         renamed to match the panel name it opens (Spec Health Index / PHI). -->
    <div v-if="phiScore !== undefined" class="shrink-0 flex flex-col gap-0.5">
      <span class="text-[9px] font-bold uppercase tracking-widest leading-none text-white/60 px-1.5 whitespace-nowrap">
        Spec Health
      </span>
      <div class="shrink-0 flex items-center gap-1 rounded-2xl bg-slate-800/40 ring-1 ring-white/15 px-1.5 py-1">
        <button
          type="button"
          class="h-10 flex items-center gap-1.5 px-2 rounded-lg bg-white/10 hover:bg-white/20
                 focus:outline-none focus:ring-2 focus:ring-white/60 transition-colors"
          :aria-label="`Plan Health Index: ${phiScore} of 100${phiAlertCount && phiAlertCount > 0 ? ` with ${phiAlertCount} alerts` : ''}`"
          :title="`📊 Plan Health Index: ${phiScore}/100${phiAlertCount && phiAlertCount > 0 ? ` · ${phiAlertCount} pending alert${phiAlertCount === 1 ? '' : 's'}` : ''} — click to review`"
          @click="emit('open-phi')"
        >
          <SpecHealthBadge
            :index="phiScore"
            :threshold="phiThreshold ?? 70"
            :size="22"
            :has-alert="(phiAlertCount ?? 0) > 0"
            :alert-count="phiAlertCount ?? 0"
            class="shrink-0"
          />
        </button>
      </div>
    </div>

    <!-- ──────── Spec Versions sub-group ──────── -->
    <!-- Tom Gilb 2026-06-18 verbatim: "we find a more immediately clear name?
         'Spec Versions'".  Previous label "📐 Naming" named the ACT (naming)
         rather than the CONTENT of the cluster (the spec name + its current
         version + the click-through to all past versions via the History
         panel).  "Spec Versions" matches the chip's `Spec Version <n>` label
         and tells the user "this is the version-and-name cluster". -->
    <div class="shrink-0 flex flex-col gap-0.5">
      <span class="text-[9px] font-bold uppercase tracking-widest leading-none text-white/60 px-1.5 whitespace-nowrap">
        Spec Versions
      </span>
      <div class="shrink-0 flex items-center gap-1 rounded-2xl bg-slate-800/40 ring-1 ring-white/15 px-1.5 py-1">
        <!-- Switch Spec — opens the spec-model panel (browse / rename / switch
             / delete saved specs).  Tom Gilb 2026-06-18 verbatim: "remove
             repitition".  Used to render `{{ planName }}` which duplicated the
             gold title hero above; the button text is now a verb that names
             the action so the duplication is gone.  Plan name still surfaces
             in HoverHint + aria-label for context. -->
        <button
          type="button"
          class="h-10 flex items-center gap-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/20
                 focus:outline-none focus:ring-2 focus:ring-white/60 transition-colors"
          :aria-label="`Switch Spec — current: ${planName ?? '(unnamed)'} — open spec model panel`"
          :title="`Switch Spec — current: ${planName ?? '(unnamed)'} — click to browse, rename, switch or delete saved specs`"
          @click="emit('open-spec')"
        >
          <PlanGlyph size="compact" class="h-3.5 w-auto" aria-hidden="true" />
          <span class="text-xs font-bold leading-none whitespace-nowrap">Switch Spec</span>
        </button>
        <!-- r41 v151 — bare "v" chip text replaced with "Spec Version <n>"
             per Tom Gilb 2026-06-17 verbatim "The V for Version is bad
             (Value?) so the Text 'Spec Version' better". -->
        <button
          v-if="versionLabel"
          type="button"
          class="h-10 flex items-center gap-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 ring-1 ring-white/20
                 text-[11px] font-bold text-white tracking-tight whitespace-nowrap
                 focus:outline-none focus:ring-2 focus:ring-white/60 transition-colors"
          :aria-label="`Spec Version ${versionLabel} — open Past Versions`"
          :title="`📜 Spec Version ${versionLabel} — click to open the Past Versions panel (view + restore any saved version)`"
          @click="emit('open-history')"
        >Spec Version {{ versionLabel }}</button>
        <!-- r41 v151 — Save button MOVED here from the dropped TIME sub-group. -->
        <button
          type="button"
          :class="[
            'h-10 flex items-center gap-1 px-2 rounded-lg text-[11px] font-semibold transition-all',
            'focus:outline-none focus:ring-2 focus:ring-white/60',
            saveFlash === 'flash'
              ? 'bg-emerald-400/95 text-emerald-950 ring-1 ring-emerald-200/70'
              : unsaved
                ? 'bg-amber-400/95 text-amber-950 ring-1 ring-amber-200/70 hover:bg-amber-300'
                : 'bg-white/10 text-white/90 hover:bg-white/25',
          ]"
          :aria-label="saveFlash === 'flash' ? 'Saved just now' : (unsaved ? `${savedLabel} — click to save now` : `${savedLabel || 'Not saved yet'} — click to save now`)"
          :title="saveFlash === 'flash' ? '✓ Saved just now' : (unsaved ? `${savedLabel} — click to save now (you have unsaved changes)` : `${savedLabel || 'Not saved yet'} — click to save now`)"
          @click="emit('save-now')"
        >
          <template v-if="saveFlash === 'flash'">
            <span aria-hidden="true">✓</span><span>Saved</span>
          </template>
          <template v-else>
            <SaveGlyph size="compact" class="h-3.5 w-auto shrink-0" aria-hidden="true" />
            <span>{{ savedLabel || 'Save' }}</span>
          </template>
        </button>
      </div>
    </div>

    <!-- r41 v151 — ⏱ TIME sub-group REMOVED entirely per Tom Gilb 2026-06-17
         verbatim "deadline button is probably irrelevant. Drop it, and then
         the time and icon above, drop".  Deadline button gone.  Save button
         moved into the NAMING sub-group above (where Spec Version lives).
         The `edit-deadline` emit + `deadline` prop are KEPT in the component
         interface for any future surface that wants them; the visible UI
         affordance is gone. -->

    <!-- ──────── Sharpening Cycles sub-group (only when > 0) ──────── -->
    <!-- Tom Gilb 2026-06-18 verbatim: "'Sharpening Cycles'".  Was "🔪 Rounds" —
         "Rounds" was opaque; "Sharpening Cycles" names the action being counted. -->
    <div v-if="sharpenRounds && sharpenRounds > 0" class="shrink-0 flex flex-col gap-0.5">
      <span class="text-[9px] font-bold uppercase tracking-widest leading-none text-white/60 px-1.5 whitespace-nowrap">
        Sharpening Cycles
      </span>
      <div class="shrink-0 flex items-center gap-1 rounded-2xl bg-slate-800/40 ring-1 ring-white/15 px-1.5 py-1">
        <span
          class="h-10 inline-flex items-center gap-1 px-2 rounded-lg
                 bg-amber-400/90 text-amber-950 text-[11px] font-bold"
          :title="`🔪 ${sharpenRounds} sharpening round${sharpenRounds === 1 ? '' : 's'} applied`"
        >
          <span class="text-base leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" aria-hidden="true">🔪</span>
          <span>{{ sharpenRounds }}</span>
        </span>
      </div>
    </div>

    <!-- ──────── Spec Owner sub-group — opens the full Spec Responsibilities ──────── -->
    <!-- Tom Gilb 2026-06-19: "Display the Spec Owner, then hover says other
         responsible people are in the stewards Menu, currently 3 and quite
         possible other responsibilities (Example Architect, CTO) can and will
         be added.  Add those 2 right away." -->
    <div class="shrink-0 flex flex-col gap-0.5">
      <span class="text-[9px] font-bold uppercase tracking-widest leading-none text-white/60 px-1.5 whitespace-nowrap">
        Spec Owner
      </span>
      <div class="shrink-0 flex items-center gap-1 rounded-2xl bg-slate-800/40 ring-1 ring-white/15 px-1.5 py-1">
        <button
          type="button"
          :class="[
            'h-10 flex items-center gap-1 px-2 rounded-lg text-[11px] font-semibold transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-white/60',
            ownerName ? 'bg-amber-400/90 text-amber-950 hover:bg-amber-300'
                      : 'border border-dashed border-white/40 text-white/80 hover:bg-white/10 hover:border-white/70',
          ]"
          :aria-label="ownerName
            ? `Spec Owner: ${ownerName} — open Spec Responsibilities (Owners, Planners, Scribes, Architects, CTOs)`
            : 'Add Spec Owner — open Spec Responsibilities'"
          :title="ownerName
            ? `Spec Owner: ${ownerName}.  Other responsible roles are in the Spec Responsibilities: Planners (${plannerCount}), Scribes (${scribeCount}), Architects (${architectCount}), CTOs (${ctoCount}).  More responsibility types can be added — click to open.`
            : 'No Spec Owner set — click to open the Spec Responsibilities and add Owners, Planners, Scribes, Architects, CTOs.'"
          @click="emit('open-owners')"
        >
          <OwnerGlyph size="compact" class="h-3.5 w-auto shrink-0" aria-hidden="true" />
          <span v-if="ownerName" class="truncate max-w-[120px]">{{ ownerName }}</span>
          <span v-if="ownerName && extraOwners > 0" class="opacity-70">+{{ extraOwners }}</span>
          <span v-if="!ownerName" aria-hidden="true">Add Owner</span>
        </button>
        <!-- "+N more roles filled" hint when any other role has people in it -->
        <span
          v-if="otherRoleCount > 0"
          class="text-[10px] text-white/60 px-1.5 py-0.5 rounded bg-white/5 ring-1 ring-white/10 cursor-pointer hover:bg-white/15"
          :title="`${otherRoleCount} other responsible role chip(s) defined.  Click to open the Spec Responsibilities.`"
          @click="emit('open-owners')"
        >
          +{{ otherRoleCount }} more roles
        </span>
      </div>
    </div>

    <!-- ──────── 🧬 STORY sub-group (Spec Story toggle, pushed right) ──────── -->
    <div class="shrink-0 flex flex-col gap-0.5 ml-auto">
      <span class="text-[9px] font-bold uppercase tracking-widest leading-none text-white/60 px-1.5">
        <span aria-hidden="true">🧬</span> Story
      </span>
      <div class="shrink-0 flex items-center gap-1 rounded-2xl bg-slate-800/40 ring-1 ring-white/15 px-1.5 py-1">
        <button
          type="button"
          :class="[
            'h-10 flex items-center gap-1 px-2.5 rounded-lg text-[11px] font-bold tracking-wide transition-all',
            'focus:outline-none focus:ring-2 focus:ring-white/60',
            specStoryOpen
              ? 'bg-gradient-to-r from-fuchsia-300 to-pink-300 text-fuchsia-950 ring-2 ring-fuchsia-200/90'
              : 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white hover:from-fuchsia-400 hover:to-pink-400',
          ]"
          :aria-label="`Toggle Spec Story (origin, hand-tuning, sharpening, stewards, age)`"
          :aria-pressed="specStoryOpen"
          :title="specStoryOpen ? '🧬 Hide Spec Story — origin, hand-tuning, sharpen rounds, stewards, age' : '🧬 Show Spec Story — origin, hand-tuning, sharpen rounds, stewards, age'"
          @click="emit('toggle-spec-story')"
        >
          <!-- r41 v148 — SpecStoryGlyph (the chain-link icon) dropped per
               Tom Gilb 2026-06-17 verbatim "the icon (chain?) can be
               dropped (I dont think it is useful or intelligible, cannot
               even see it is a chain)".  Text label + caret are enough. -->
          <span>Spec Story</span>
          <span class="text-[9px] leading-none font-extrabold" aria-hidden="true">{{ specStoryOpen ? '▾' : '▸' }}</span>
        </button>
      </div>
    </div>

    <!-- r41 v147 — `end` slot: Process Tools mounts HERE inside the top
         Plan Identity bar per Tom Gilb 2026-06-17 verbatim "inside one of
         3 bars top one".  ml-auto pushes the slotted content to the far
         right of the flex row. -->
    <div class="ml-auto self-end shrink-0">
      <slot name="end" />
    </div>
  </div>
</template>
