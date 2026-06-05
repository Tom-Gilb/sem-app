<!-- UNIT_TYPE=Panel -->
<!--
/**
 * EvoStepImprovement — Tom Gilb's second Evo Tool (2026-06-03).
 *
 * Tom verbatim:
 *   *"a separate Evo Tool section for (not at bottom of sharpening as in SEM,
 *     separate): 'Evo Step Improvement'.  It suggests 1 or more strong ideas,
 *     the 'Evo Planner' (note the term) suggest their best shot at a 'crazy'
 *     possibility.  It analyzes critically.  Offers 1 or 5 better ideas.,
 *     Then a separate sub tool 'Daring and Wild Evo Ideas' (designed to
 *     improve the result by 2x to 10X, at higher risks and costs), sort of
 *     'Skunkworks' (call it that)."*
 *
 * UX:
 *   - Step picker (dropdown) selects which Evo Step
 *   - Empty state with two actions: "Generate via Claudian" (copies prompt
 *     to clipboard) + "Load Example Ideas" (mock seed for demo)
 *   - Populated state shows 3 sections in order:
 *       1. CRAZY IDEA — the Evo Planner's bold first shot
 *       2. CRITIQUE — critical analysis of the crazy idea
 *       3. BETTER IDEAS — 1-5 ranked, safer refinements
 *       4. SKUNKWORKS — 1-3 Daring and Wild Evo Ideas (2x-10x at higher risk)
 *   - Paste area accepts JSON output from Claudian
 *   - Footer: Clear, Export, Regenerate
 *
 * "Evo Planner" term used verbatim per Tom's instruction to "note the term".
 *
 * Rules complied with: Single-Surface, ScrollContainer, CloseDot,
 * Planguage-Glyph-First, Interaction Disclosure, Banned-Scrum-Vocabulary,
 * Loading-State (n/a — no async ops in v1).
 */
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import PlEvoStepIcon from './icons/PlEvoStepIcon.vue'
import VDTProjectionMini from './VDTProjectionMini.vue'
import ConstraintRelaxationList from './ConstraintRelaxationList.vue'
import SourceBadge from './SourceBadge.vue'
import { useEvoStepImprovement } from '../composables/useEvoStepImprovement'
import { buildClaudianPrompt, type ImprovementIdea } from '../data/evoStepImprovement'
import type { EvoStep } from '../types/evo-plan'

const props = defineProps<{
  /** All Evo Steps from useEvoPlan — populates the step picker. */
  steps: EvoStep[]
  /** Stable plan identifier (plan model name) for localStorage scoping. */
  planId?: string
}>()

defineEmits<{
  close: []
}>()

// ── Step selection ───────────────────────────────────────────────────────────
const selectedStepName = ref<string>(props.steps[0]?.name ?? '')

watch(
  () => props.steps,
  (newSteps) => {
    if (!newSteps.some(s => s.name === selectedStepName.value)) {
      selectedStepName.value = newSteps[0]?.name ?? ''
    }
  },
)

const selectedStep = computed<EvoStep | undefined>(() =>
  props.steps.find(s => s.name === selectedStepName.value),
)

// ── Ideas state ──────────────────────────────────────────────────────────────
const planIdRef = computed(() => props.planId ?? 'default')
const { ideas, lastError, loadMock, pasteIdeas, clear } =
  useEvoStepImprovement(planIdRef, selectedStep)

// ── Generate via Claudian (clipboard copy of prompt) ─────────────────────────
const copyFlash = ref(false)
function onGenerateViaClaudian(): void {
  if (!selectedStep.value) return
  const prompt = buildClaudianPrompt(selectedStep.value)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(prompt).then(() => {
      copyFlash.value = true
      setTimeout(() => { copyFlash.value = false }, 2000)
    }).catch(() => { /* ignore */ })
  }
  // Also reveal the paste area so Tom knows where to put the result
  showPaste.value = true
}

// ── Paste-back area ──────────────────────────────────────────────────────────
const showPaste = ref(false)
const pasteText = ref<string>('')
function onPaste(): void {
  if (pasteIdeas(pasteText.value)) {
    pasteText.value = ''
    showPaste.value = false
  }
  // On failure: lastError ref is set by pasteIdeas; UI surfaces it below.
}

// ── Clear with confirm ───────────────────────────────────────────────────────
function onClearConfirm(): void {
  if (!selectedStep.value) return
  if (confirm(`Clear all improvement ideas for "${selectedStep.value.name}"?`)) {
    clear()
  }
}

// ── Visual helpers — impact multiplier badge colour ──────────────────────────
function multiplierColor(m: number): string {
  if (m >= 5) return 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300'
  if (m >= 2) return 'bg-amber-100 text-amber-700 border-amber-300'
  if (m >= 1.5) return 'bg-emerald-100 text-emerald-700 border-emerald-300'
  return 'bg-slate-100 text-slate-600 border-slate-300'
}

// ── Idea-card category badge ─────────────────────────────────────────────────
function categoryBadge(idea: ImprovementIdea): { label: string; classes: string } {
  switch (idea.category) {
    case 'crazy':
      return { label: 'Crazy', classes: 'bg-purple-100 text-purple-700 border-purple-300' }
    case 'skunkworks':
      return { label: 'Skunkworks', classes: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300' }
    default:
      return { label: 'Better', classes: 'bg-emerald-100 text-emerald-700 border-emerald-300' }
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[500] bg-slate-900/70 flex items-stretch justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evo-improvement-title"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">

        <!-- Header -->
        <header class="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white">
          <PlEvoStepIcon size="md" :no-detail-click="true" />
          <div class="flex-1 min-w-0">
            <h2 id="evo-improvement-title" class="text-base font-bold">Evo Step Improvement</h2>
            <p class="text-[11px] text-fuchsia-100 mt-0.5">
              The <span class="font-semibold">Evo Planner</span> proposes a crazy first shot, critiques it,
              offers 1–5 better ideas, plus Skunkworks 2×–10× daring shots
            </p>
          </div>

          <!-- Step picker -->
          <label class="flex items-center gap-2 text-xs text-fuchsia-50">
            <span class="font-semibold">Step:</span>
            <select
              v-model="selectedStepName"
              class="text-sm text-slate-900 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/50 max-w-[260px]"
              title="Pick which Evo Step to generate improvement ideas for. Ideas persist per step."
              aria-label="Select Evo Step"
            >
              <option v-for="step in steps" :key="step.name" :value="step.name">
                {{ step.name }}
              </option>
            </select>
          </label>

          <CloseDot @click="$emit('close')" />
        </header>

        <!-- Body -->
        <ScrollContainer class="flex-1" inner-class="p-5 space-y-5">

          <!-- No-step empty state -->
          <div v-if="!selectedStep" class="text-center text-slate-500 py-12">
            <p>No Evo Step selected — pick one above, or generate an Evo plan first.</p>
          </div>

          <!-- Empty ideas state — two CTAs -->
          <div
            v-else-if="!ideas"
            class="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50"
          >
            <PlEvoStepIcon size="lg" :no-detail-click="true" class="mx-auto opacity-50 mb-3" />
            <h3 class="text-base font-bold text-slate-700 mb-1">No ideas yet for this step</h3>
            <p class="text-xs text-slate-500 mb-5 max-w-md mx-auto">
              The Evo Planner needs to think.  Either invoke Claudian (the recommended path —
              the AI work happens in your local Claude Code session, not in this app), or load
              an example set so you can see the layout.
            </p>
            <div class="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                class="px-4 py-2 rounded-lg bg-fuchsia-600 text-white text-sm font-bold hover:bg-fuchsia-700 transition-colors"
                :title="`Copies a structured Evo Planner prompt for &quot;${selectedStep.name}&quot; to the clipboard. Paste it into Claudian; paste the JSON result back here.`"
                @click="onGenerateViaClaudian"
              >
                {{ copyFlash ? '✓ Prompt copied to clipboard' : 'Generate via Claudian' }}
              </button>
              <button
                type="button"
                class="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors"
                title="Loads a generic mock idea set so you can see how the panel looks when populated. Persists per step until you Clear."
                @click="loadMock"
              >
                Load Example Ideas
              </button>
            </div>
          </div>

          <!-- Populated state -->
          <template v-else>

            <!-- CRAZY IDEA + CRITIQUE -->
            <section v-if="ideas.crazyIdea" class="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-fuchsia-50 overflow-hidden">
              <header class="px-4 py-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white flex items-center gap-2 flex-wrap">
                <span class="text-[10px] font-bold uppercase tracking-wider bg-white/20 rounded px-1.5 py-0.5">Crazy First Shot</span>
                <h3 class="text-sm font-bold flex-1 min-w-0">{{ ideas.crazyIdea.title }}</h3>
                <!-- Source-layer badge — Tom 2026-06-03 Conjunction-of-Technologies principle -->
                <SourceBadge v-if="ideas.crazyIdea.provenance" :provenance="ideas.crazyIdea.provenance" size="compact" />
                <span
                  class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                  :class="multiplierColor(ideas.crazyIdea.estimatedImpactMultiplier)"
                  :title="`Estimated impact multiplier: ${ideas.crazyIdea.estimatedImpactMultiplier}× the current step`"
                >{{ ideas.crazyIdea.estimatedImpactMultiplier }}×</span>
              </header>
              <div class="p-4 space-y-3">
                <p class="text-sm text-slate-800 leading-relaxed">{{ ideas.crazyIdea.description }}</p>
                <p class="text-xs text-slate-700 italic"><span class="font-semibold not-italic">Why:</span> {{ ideas.crazyIdea.rationale }}</p>

                <VDTProjectionMini
                  v-if="ideas.crazyIdea.vdtProjection"
                  :projection="ideas.crazyIdea.vdtProjection"
                />

                <ConstraintRelaxationList
                  v-if="ideas.crazyIdea.constraintRelaxations && ideas.crazyIdea.constraintRelaxations.length > 0"
                  :relaxations="ideas.crazyIdea.constraintRelaxations"
                />

                <div class="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <p class="font-bold text-red-700 mb-1">Risks</p>
                    <ul class="space-y-0.5 text-slate-700 list-disc list-inside">
                      <li v-for="(r, i) in ideas.crazyIdea.risks" :key="i">{{ r }}</li>
                    </ul>
                  </div>
                  <div>
                    <p class="font-bold text-amber-700 mb-1">Costs</p>
                    <ul class="space-y-0.5 text-slate-700 list-disc list-inside">
                      <li v-for="(c, i) in ideas.crazyIdea.costs" :key="i">{{ c }}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- CRITIQUE block -->
              <div v-if="ideas.crazyCritique" class="px-4 py-3 bg-purple-100/60 border-t border-purple-300">
                <p class="text-[10px] font-bold uppercase tracking-wider text-purple-700 mb-1">Evo Planner critique</p>
                <p class="text-xs text-slate-800 leading-relaxed">{{ ideas.crazyCritique }}</p>
              </div>
            </section>

            <!-- BETTER IDEAS -->
            <section v-if="ideas.betterIdeas.length > 0">
              <div class="flex items-center gap-2 mb-3">
                <div class="w-1.5 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" aria-hidden="true" />
                <h3 class="text-sm font-bold text-slate-800">Better Ideas</h3>
                <p class="text-[11px] text-slate-500">{{ ideas.betterIdeas.length }} ranked refinement{{ ideas.betterIdeas.length === 1 ? '' : 's' }} — safer, more practical</p>
              </div>
              <div class="space-y-2.5">
                <article
                  v-for="idea in ideas.betterIdeas"
                  :key="idea.id"
                  class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <header class="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      class="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center"
                      :title="`Ranked #${idea.rank}`"
                    >#{{ idea.rank }}</span>
                    <h4 class="text-sm font-bold text-slate-800 flex-1 min-w-0">{{ idea.title }}</h4>
                    <SourceBadge v-if="idea.provenance" :provenance="idea.provenance" size="compact" />
                    <span
                      class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                      :class="multiplierColor(idea.estimatedImpactMultiplier)"
                      :title="`Estimated impact multiplier: ${idea.estimatedImpactMultiplier}× the current step`"
                    >{{ idea.estimatedImpactMultiplier }}×</span>
                    <span
                      class="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border"
                      :class="categoryBadge(idea).classes"
                    >{{ categoryBadge(idea).label }}</span>
                  </header>
                  <p class="text-xs text-slate-700 leading-relaxed mb-2">{{ idea.description }}</p>
                  <p class="text-[11px] text-slate-600 italic mb-2"><span class="font-semibold not-italic">Why:</span> {{ idea.rationale }}</p>

                  <VDTProjectionMini
                    v-if="idea.vdtProjection"
                    :projection="idea.vdtProjection"
                  />

                  <ConstraintRelaxationList
                    v-if="idea.constraintRelaxations && idea.constraintRelaxations.length > 0"
                    :relaxations="idea.constraintRelaxations"
                  />

                  <div class="grid grid-cols-2 gap-3 text-[11px] mt-2">
                    <div>
                      <p class="font-semibold text-red-700 mb-0.5">Risks</p>
                      <ul class="space-y-0.5 text-slate-600 list-disc list-inside">
                        <li v-for="(r, i) in idea.risks" :key="i">{{ r }}</li>
                      </ul>
                    </div>
                    <div>
                      <p class="font-semibold text-amber-700 mb-0.5">Costs</p>
                      <ul class="space-y-0.5 text-slate-600 list-disc list-inside">
                        <li v-for="(c, i) in idea.costs" :key="i">{{ c }}</li>
                      </ul>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <!-- SKUNKWORKS — Daring and Wild Evo Ideas.
                 Tom 2026-06-03: "SKUNKWORKS: Daring and Wild Evo Ideas" (uppercase
                 prefix with colon).  "Focus on Radical shift in tradeoffs (more
                 risk, more resources, relax known constraints).  Give options in
                 terms of VDT/IET.  Explore and iterate." -->
            <section v-if="ideas.skunkworksIdeas.length > 0" class="rounded-2xl border-2 border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 to-pink-50 overflow-hidden">
              <header class="px-4 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white">
                <div class="flex items-center gap-2">
                  <span class="text-2xl leading-none" aria-hidden="true">⚡</span>
                  <div class="flex-1">
                    <h3 class="text-base font-extrabold tracking-wide">SKUNKWORKS: Daring and Wild Evo Ideas</h3>
                    <p class="text-[10px] text-fuchsia-100 mt-0.5">
                      Radical shift in tradeoffs · accept more risk · allocate more resources · relax known constraints · expressed in VDT/IET terms
                    </p>
                  </div>
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg bg-white/15 text-white text-[11px] font-semibold hover:bg-white/25 border border-white/30 transition-colors"
                    title="Iterate the Skunkworks set — copy a fresh Evo Planner prompt to clipboard. Paste new JSON when ready; the panel will overwrite the current ideas with the new batch."
                    @click="onGenerateViaClaudian"
                  >Iterate ↻</button>
                </div>
              </header>
              <div class="p-4 space-y-3">
                <article
                  v-for="idea in ideas.skunkworksIdeas"
                  :key="idea.id"
                  class="rounded-xl border border-fuchsia-200 bg-white p-3 shadow-sm"
                >
                  <header class="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      class="flex-shrink-0 w-6 h-6 rounded-full bg-fuchsia-100 text-fuchsia-700 text-xs font-bold flex items-center justify-center"
                      :title="`Skunkworks rank #${idea.rank}`"
                    >#{{ idea.rank }}</span>
                    <h4 class="text-sm font-bold text-slate-800 flex-1 min-w-0">{{ idea.title }}</h4>
                    <SourceBadge v-if="idea.provenance" :provenance="idea.provenance" size="compact" />
                    <span
                      class="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                      :class="multiplierColor(idea.estimatedImpactMultiplier)"
                    >{{ idea.estimatedImpactMultiplier }}×</span>
                  </header>
                  <p class="text-xs text-slate-700 leading-relaxed mb-2">{{ idea.description }}</p>
                  <p class="text-[11px] text-slate-600 italic mb-2"><span class="font-semibold not-italic">Why:</span> {{ idea.rationale }}</p>

                  <!-- VDT/IET projection — Tom 2026-06-03: "Give options in terms of VDT/IET" -->
                  <VDTProjectionMini
                    v-if="idea.vdtProjection"
                    :projection="idea.vdtProjection"
                  />

                  <!-- Constraint relaxations — the Skunkworks signature -->
                  <ConstraintRelaxationList
                    v-if="idea.constraintRelaxations && idea.constraintRelaxations.length > 0"
                    :relaxations="idea.constraintRelaxations"
                  />

                  <div class="grid grid-cols-2 gap-3 text-[11px] mt-2">
                    <div>
                      <p class="font-semibold text-red-700 mb-0.5">Risks (elevated)</p>
                      <ul class="space-y-0.5 text-slate-600 list-disc list-inside">
                        <li v-for="(r, i) in idea.risks" :key="i">{{ r }}</li>
                      </ul>
                    </div>
                    <div>
                      <p class="font-semibold text-amber-700 mb-0.5">Costs (elevated)</p>
                      <ul class="space-y-0.5 text-slate-600 list-disc list-inside">
                        <li v-for="(c, i) in idea.costs" :key="i">{{ c }}</li>
                      </ul>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <!-- Meta -->
            <p class="text-[10px] text-slate-400 text-right">
              Generated by {{ ideas.generatedBy }} ·
              <time :datetime="new Date(ideas.generatedAt).toISOString()">{{ new Date(ideas.generatedAt).toLocaleString() }}</time>
            </p>
          </template>

          <!-- Paste area — visible after Generate-via-Claudian or always when populated -->
          <section v-if="selectedStep && (showPaste || ideas)" class="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h4 class="text-xs font-bold text-slate-700 mb-1">Paste ideas from Claudian</h4>
            <p class="text-[11px] text-slate-500 mb-2">Paste the JSON output from Claudian below.  The structure is validated minimally before saving.</p>
            <textarea
              v-model="pasteText"
              rows="4"
              placeholder='{"betterIdeas": [...], "skunkworksIdeas": [...]}'
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400 focus:border-fuchsia-400"
              aria-label="Paste JSON from Claudian"
            />
            <div class="flex items-center gap-2 mt-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white text-xs font-bold hover:bg-fuchsia-700 transition-colors"
                title="Validate and store the pasted JSON as the current step's improvement set"
                @click="onPaste"
              >Paste &amp; Save</button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors"
                title="Hide the paste area"
                @click="showPaste = false; pasteText = ''"
              >Cancel</button>
              <p v-if="lastError" class="text-xs text-red-700 ml-2">{{ lastError }}</p>
            </div>
          </section>
        </ScrollContainer>

        <!-- Footer -->
        <footer
          v-if="ideas && selectedStep"
          class="flex items-center gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs"
        >
          <span class="text-slate-600">
            {{ ideas.betterIdeas.length }} better · {{ ideas.skunkworksIdeas.length }} skunkworks
          </span>
          <div class="flex-1" />
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 transition-colors text-xs font-medium"
            title="Clear all ideas for this step (cannot be undone)"
            @click="onClearConfirm"
          >Clear</button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white text-xs font-bold hover:bg-fuchsia-700 transition-colors"
            title="Copy a fresh Evo Planner prompt to the clipboard so you can regenerate via Claudian"
            @click="onGenerateViaClaudian"
          >{{ copyFlash ? '✓ Copied' : 'Regenerate via Claudian' }}</button>
        </footer>

      </div>
    </div>
  </Teleport>
</template>
