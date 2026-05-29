<!-- UNIT_TYPE=Feature -->
<!-- AmuseMeButton.vue — "Fun while waiting?" panel (Amuse Me feature)
     Appears only when isLoading is true. Big gradient button that expands into
     a menu of 8 entertainment/information options for the user to explore
     while the AI generates content.

     Rules observed:
       - ScrollContainer wraps all overflow-y-auto content
       - CloseDot used as the sole close affordance
       - No × / ✕ / SVG cross close buttons
       - Tailwind classes only; scoped <style> for gradient animation only
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import {
  AMUSE_ITEMS,
  PICTURE_THEMES,
  useAmuseMe,
  randomJoke,
  randomNiceThing,
  planProgressText,
  nextStepText,
  stagesUntilSharing,
  pictureUrl,
  type PictureTheme,
} from '../composables/useAmuseMe'
import type { SpecBlock } from '../types/spec'

// ─── Props ────────────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  /** Controls visibility — button only renders when true */
  isLoading: boolean
  /** Current spec block for plan progress content */
  specBlock?: SpecBlock | null
  /** Current planning stage (used for next-step and stages-until-sharing) */
  planningStage?: number
}>(), {
  specBlock: null,
  planningStage: 6,
})

// ─── State ────────────────────────────────────────────────────────────────────

const { isOpen, activeItemId, toggle, selectItem, close } = useAmuseMe()

/** Whether the hover tooltip preview is visible */
const showHoverPreview = ref(false)

/** Snapshot of current joke (refreshed on double-click or item selection) */
const currentJoke = ref(randomJoke())

/** Snapshot of current nice-thing (refreshed on item selection) */
const currentNiceThing = ref(randomNiceThing())

// ─── Computed content ─────────────────────────────────────────────────────────

const planProgress = computed(() => planProgressText(props.specBlock))
const nextStep = computed(() => nextStepText(props.planningStage))
const remainingStages = computed(() => stagesUntilSharing(props.planningStage))

/** Top 3 items shown in the hover tooltip preview */
const previewItems = computed(() => AMUSE_ITEMS.slice(0, 3))

// ─── Picture state ────────────────────────────────────────────────────────────

const activeTheme   = ref<PictureTheme>(PICTURE_THEMES[0])  // default: Beautiful Nature
const pictureSeed   = ref(Math.floor(Math.random() * 99999))
const pictureLoading = ref(false)

const currentPictureUrl = computed(() =>
  pictureUrl(activeTheme.value.keyword, pictureSeed.value)
)

function selectTheme(theme: PictureTheme): void {
  activeTheme.value   = theme
  pictureSeed.value   = Math.floor(Math.random() * 99999)  // new seed = new image
  pictureLoading.value = true
}

function refreshPicture(): void {
  pictureSeed.value   = Math.floor(Math.random() * 99999)
  pictureLoading.value = true
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleDoubleClick(): void {
  currentJoke.value = randomJoke()
  selectItem('glossaryJoke')
}

function handleItemClick(id: string): void {
  // Refresh randomised content each time the relevant item is selected
  if (id === 'glossaryJoke') currentJoke.value = randomJoke()
  if (id === 'niceThings') currentNiceThing.value = randomNiceThing()
  if (id === 'showPictures') {
    pictureSeed.value = Math.floor(Math.random() * 99999)
    pictureLoading.value = true
  }
  selectItem(id)
}
</script>

<template>
  <Transition name="amuse-fade">
    <div v-if="isLoading" class="mt-4 w-full">

      <!-- ── Main trigger button ─────────────────────────────────────────── -->
      <div
        class="relative"
        @mouseenter="showHoverPreview = true"
        @mouseleave="showHoverPreview = false"
      >
        <button
          type="button"
          class="amuse-btn w-full h-16 rounded-2xl text-white font-bold text-lg
                 shadow-lg hover:shadow-xl focus-visible:outline focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-indigo-400
                 transition-shadow"
          aria-label="Fun while waiting? Open amusement menu"
          title="Click for fun options · Double-click for a Planguage joke"
          @click="toggle"
          @dblclick.prevent="handleDoubleClick"
        >
          🎉 Fun while waiting?
        </button>

        <!-- Hover preview tooltip — 3 top items -->
        <Transition name="preview-fade">
          <div
            v-if="showHoverPreview && !isOpen"
            class="absolute left-0 right-0 top-full mt-1 z-50
                   bg-white border border-slate-200 rounded-xl shadow-lg py-2 px-3
                   pointer-events-none"
            role="tooltip"
          >
            <p class="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5 font-semibold">
              Click to explore
            </p>
            <ul class="space-y-1">
              <li
                v-for="item in previewItems"
                :key="item.id"
                class="flex items-center gap-2 text-sm text-slate-600"
              >
                <span aria-hidden="true">{{ item.emoji }}</span>
                <span>{{ item.label }}</span>
              </li>
            </ul>
          </div>
        </Transition>
      </div>

      <!-- ── Full menu panel ─────────────────────────────────────────────── -->
      <Transition name="panel-slide">
        <div
          v-if="isOpen"
          class="mt-2 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
        >
          <!-- Panel header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <span class="text-sm font-semibold text-slate-700">
              🎉 Fun while waiting
            </span>
            <CloseDot
              aria-label="Close Amuse Me panel"
              title="Close"
              variant="on-light"
              @click="close"
            />
          </div>

          <!-- Menu rows — ScrollContainer so all 9 items are reachable on small screens -->
          <ScrollContainer
            outer-class="relative"
            inner-style="max-height: 280px"
            inner-class="divide-y divide-slate-100"
            fade-from="#ffffff"
          >
          <ul class="divide-y divide-slate-100" role="listbox" aria-label="Amusement options">
            <li
              v-for="item in AMUSE_ITEMS"
              :key="item.id"
              role="option"
              :aria-selected="activeItemId === item.id"
              class="flex items-start gap-3 px-4 py-3 cursor-pointer select-none
                     transition-colors hover:bg-indigo-50 active:bg-indigo-100"
              :class="activeItemId === item.id ? 'bg-indigo-50 border-l-2 border-indigo-400' : ''"
              @click="handleItemClick(item.id)"
            >
              <span class="text-xl leading-none mt-0.5 shrink-0" aria-hidden="true">
                {{ item.emoji }}
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium text-slate-800 leading-snug">
                  {{ item.label }}
                </p>
                <p class="text-xs text-slate-500 leading-snug mt-0.5">
                  {{ item.blurb }}
                </p>
              </div>
              <span
                v-if="activeItemId === item.id"
                class="ml-auto text-indigo-500 text-xs font-bold shrink-0 mt-1"
                aria-hidden="true"
              >▶</span>
            </li>
          </ul>
          </ScrollContainer>

          <!-- Content area — shown when an item is selected -->
          <Transition name="content-fade">
            <div v-if="activeItemId" class="border-t border-slate-200 bg-slate-50">

              <!-- ScrollContainer wraps the content area per UI rules -->
              <ScrollContainer
                outer-class="relative"
                inner-style="max-height: 260px"
                inner-class="px-4 py-4"
                fade-from="#f8fafc"
              >

                <!-- glossaryJoke ────────────────────────────────────────── -->
                <div v-if="activeItemId === 'glossaryJoke'">
                  <div class="flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl p-4">
                    <span class="text-3xl leading-none shrink-0" aria-hidden="true">🎭</span>
                    <blockquote class="text-sm text-violet-800 leading-relaxed italic">
                      "{{ currentJoke }}"
                    </blockquote>
                  </div>
                  <p class="text-xs text-slate-400 mt-2 text-right">
                    Click the menu row again for a different joke
                  </p>
                </div>

                <!-- planProgress ─────────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'planProgress'">
                  <div class="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <span class="text-2xl leading-none shrink-0" aria-hidden="true">📈</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
                        Plan Progress to Date
                      </p>
                      <p class="text-sm text-emerald-900 leading-relaxed">
                        {{ planProgress }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- nextStep ────────────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'nextStep'">
                  <div class="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-xl p-4">
                    <span class="text-2xl leading-none shrink-0" aria-hidden="true">➡️</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">
                        What Happens Next
                      </p>
                      <p class="text-sm text-sky-900 leading-relaxed">
                        {{ nextStep }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- niceThings ──────────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'niceThings'">
                  <div class="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4">
                    <span class="text-2xl leading-none shrink-0" aria-hidden="true">❤️</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1">
                        Something Nice to Do
                      </p>
                      <p class="text-sm text-rose-900 leading-relaxed">
                        {{ currentNiceThing }}
                      </p>
                    </div>
                  </div>
                  <p class="text-xs text-slate-400 mt-2 text-right">
                    Click the menu row again for another suggestion
                  </p>
                </div>

                <!-- completionAlert ──────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'completionAlert'">
                  <div class="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                    <span class="text-2xl leading-none shrink-0" aria-hidden="true">🔔</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                        How You'll Know It's Done
                      </p>
                      <p class="text-sm text-green-900 leading-relaxed">
                        When this finishes: a pling sound plays and the ⚡ button flashes.
                        You can safely look away, close this panel, or wander off to do something kind.
                        The app will call you back.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- whyThisMatters ──────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'whyThisMatters'">
                  <div class="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <span class="text-2xl leading-none shrink-0" aria-hidden="true">🔮</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                        Why This Process Matters
                      </p>
                      <p class="text-sm text-amber-900 leading-relaxed">
                        The AI is generating Evo Value Delivery Steps — the heart of Planguage.
                        Each step is a small, deliverable increment that moves at least one Value
                        measurably closer to its Goal, within all Constraints.
                        This turns your specification into an executable delivery plan:
                        not a Gantt chart, but a prioritised sequence of real stakeholder value.
                        Tom Gilb: "Deliver value early and often — measure it honestly."
                      </p>
                    </div>
                  </div>
                </div>

                <!-- untilSharing ────────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'untilSharing'">
                  <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                    <div class="flex items-center gap-2 mb-3">
                      <span class="text-2xl leading-none" aria-hidden="true">📅</span>
                      <p class="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                        Stages Until Sharing
                      </p>
                    </div>
                    <div v-if="remainingStages.length === 0">
                      <p class="text-sm text-indigo-900">
                        You're at the final stage — your plan is ready to export and share!
                      </p>
                    </div>
                    <ol v-else class="space-y-1.5">
                      <li
                        v-for="s in remainingStages"
                        :key="s.stage"
                        class="flex items-start gap-2 text-sm text-indigo-900"
                      >
                        <span class="shrink-0 w-5 h-5 rounded-full bg-indigo-200 text-indigo-700
                                     text-[11px] font-bold flex items-center justify-center mt-0.5">
                          {{ s.stage }}
                        </span>
                        <span class="leading-snug">{{ s.name }}</span>
                      </li>
                    </ol>
                  </div>
                </div>

                <!-- explainMode ─────────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'explainMode'">
                  <div class="flex items-start gap-3 bg-slate-100 border border-slate-300 rounded-xl p-4">
                    <span class="text-2xl leading-none shrink-0" aria-hidden="true">👆</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Explain Any Element
                      </p>
                      <ul class="text-sm text-slate-700 leading-relaxed space-y-2">
                        <li>
                          <strong>Hover</strong> any button — its tooltip will explain what it does.
                        </li>
                        <li>
                          <strong>Double-click</strong> any Planguage glyph (→O→, O--*-->, →●→, etc.)
                          to open its reference card with a full Planguage definition.
                        </li>
                        <li>
                          <strong>Select any term</strong> on screen and press ⌘D to look it up
                          in the Planguage Glossary.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- showPictures ─────────────────────────────────────────── -->
                <!-- Tom 2026-05-29: "at least display a set of pictures, choose
                     between themes like modern art, classical art, sculpture,
                     people, famous landmarks, beautiful nature, nature in Norway" -->
                <div v-else-if="activeItemId === 'showPictures'">
                  <!-- Theme selector pills -->
                  <div class="flex flex-wrap gap-1.5 mb-3">
                    <button
                      v-for="theme in PICTURE_THEMES"
                      :key="theme.id"
                      type="button"
                      :title="`Show ${theme.label} photos`"
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                      :class="activeTheme.id === theme.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'"
                      @click="selectTheme(theme)"
                    >
                      {{ theme.emoji }} {{ theme.label }}
                    </button>
                  </div>

                  <!-- Photo display -->
                  <div class="relative rounded-xl overflow-hidden bg-slate-100 aspect-video">
                    <!-- Loading shimmer -->
                    <div
                      v-if="pictureLoading"
                      class="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse"
                    />
                    <img
                      :key="currentPictureUrl"
                      :src="currentPictureUrl"
                      :alt="`${activeTheme.label} photo from Unsplash`"
                      class="w-full h-full object-cover transition-opacity duration-500"
                      :class="pictureLoading ? 'opacity-0' : 'opacity-100'"
                      @load="pictureLoading = false"
                      @error="pictureLoading = false"
                    />
                  </div>

                  <!-- Caption + refresh -->
                  <div class="flex items-center justify-between mt-2">
                    <p class="text-[10px] text-slate-400">
                      {{ activeTheme.emoji }} {{ activeTheme.label }} · via Unsplash
                    </p>
                    <button
                      type="button"
                      title="Show another picture — loads a different random photo of the same theme"
                      class="text-[11px] text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
                      @click="refreshPicture"
                    >
                      ↺ Next picture
                    </button>
                  </div>
                </div>

              </ScrollContainer>
            </div>
          </Transition>
        </div>
      </Transition>

    </div>
  </Transition>
</template>

<style scoped>
/* Gradient animation for the main trigger button */
.amuse-btn {
  background: linear-gradient(
    135deg,
    theme('colors.indigo.500'),
    theme('colors.violet.500'),
    theme('colors.pink.500'),
    theme('colors.violet.500'),
    theme('colors.indigo.500')
  );
  background-size: 300% 300%;
  animation: gradient-shift 4s ease infinite, pulse-scale 2.5s ease-in-out infinite;
}

@keyframes gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes pulse-scale {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.015); }
}

/* Outer appear/disappear */
.amuse-fade-enter-active,
.amuse-fade-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.amuse-fade-enter-from,
.amuse-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Hover preview tooltip */
.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.15s ease;
}
.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}

/* Panel slide-down */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Content area cross-fade */
.content-fade-enter-active,
.content-fade-leave-active {
  transition: opacity 0.2s ease;
}
.content-fade-enter-from,
.content-fade-leave-to {
  opacity: 0;
}
</style>
