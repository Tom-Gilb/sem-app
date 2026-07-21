<!-- UNIT_TYPE=Feature -->
<!-- AmuseMeButton.vue — "Fun while waiting?" panel (Amuse Me feature)
     Redesigned 2026-06-02 (Tom: "pictures are cut off / menu too dominating
     after item chosen / fun relegated to bottom"):

     NEW LAYOUT:
       Closed    → big gradient "Fun while waiting?" button
       Open, no item → compact 2-column tile grid (quick scan, no scroll)
       Open, item selected →
           (1) Content area — PRIMARY, occupies most of the panel
           (2) Compact horizontal pill nav — SECONDARY, slim row at bottom

     Key changes vs prior design:
       - Full-item menu list GONE when item is selected (no more domination)
       - Content moves to TOP of panel — "fun" is no longer at the bottom
       - Pictures use aspect-video with no max-height clip — never cut off
       - Tile grid replaces tall scrollable list for initial item selection

     Rules observed:
       - ScrollContainer only where genuinely long content risks overflow
       - CloseDot used as the sole close affordance
       - No × / ✕ / SVG cross close buttons
       - Tailwind classes only; scoped <style> for gradient animation only
-->

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import {
  AMUSE_ITEMS,
  PICTURE_THEMES,
  useAmuseMe,
  activateLinger,
  startLingerFadeOut,
  extendLinger,
  lingerCountdown,
  lingerFinishing,
  randomJoke,
  randomNiceThing,
  planProgressText,
  nextStepText,
  stagesUntilSharing,
  pictureUrl,
  GLOSSARY_JOKES,  // r41 v51 — fallback jokes when picture service fails
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

const { isOpen, activeItemId, lingerVisible, toggle, selectItem, close } = useAmuseMe()

watch(() => props.isLoading, (loading) => {
  if (loading) {
    activateLinger()
  } else {
    startLingerFadeOut()
  }
}, { immediate: true })

const showHoverPreview = ref(false)
const currentJoke      = ref(randomJoke())
const currentNiceThing = ref(randomNiceThing())

// ─── Computed content ─────────────────────────────────────────────────────────

const planProgress    = computed(() => planProgressText(props.specBlock))
const nextStep        = computed(() => nextStepText(props.planningStage))
const remainingStages = computed(() => stagesUntilSharing(props.planningStage))
const previewItems    = computed(() => AMUSE_ITEMS.slice(0, 3))

// ─── Picture state ────────────────────────────────────────────────────────────

const activeTheme    = ref<PictureTheme>(PICTURE_THEMES[0])
const pictureSeed    = ref(Math.floor(Math.random() * 99999))
const pictureLoading = ref(false)
// r41 v51 — picture-failed fallback state.  When loremflickr returns 4xx/5xx
// or the network is unreachable, swap in a glossary joke card instead of a
// blank placeholder (Tom Gilb 2026-06-16: "there is no point in blank at all").
const pictureFailed  = ref(false)
const fallbackJoke   = computed<string>(() => {
  // Pull a stable joke per seed so the same picture-attempt doesn't flicker
  // between jokes if Vue re-renders the slot.
  return GLOSSARY_JOKES[pictureSeed.value % GLOSSARY_JOKES.length]
})

const currentPictureUrl = computed(() =>
  pictureUrl(activeTheme.value.keyword, pictureSeed.value)
)

function selectTheme(theme: PictureTheme): void {
  activeTheme.value    = theme
  pictureSeed.value    = Math.floor(Math.random() * 99999)
  pictureLoading.value = true
  pictureFailed.value  = false  // r41 v51 — give the new theme a fresh try
}

function refreshPicture(): void {
  pictureSeed.value    = Math.floor(Math.random() * 99999)
  pictureLoading.value = true
  pictureFailed.value  = false  // r41 v51 — fresh fetch attempt
}

// ─── Auto-advance picture every 10 s (Tom 2026-06-10 — "amuse photos do not change every 10 seconds") ──
// Runs only while isLoading=true AND the showPictures item is active.
let _pictureAutoTimer: ReturnType<typeof setInterval> | null = null

function _startPictureTimer(): void {
  if (_pictureAutoTimer) return
  _pictureAutoTimer = setInterval(() => {
    if (activeItemId.value === 'showPictures') refreshPicture()
  }, 10_000)
}

function _stopPictureTimer(): void {
  if (_pictureAutoTimer) {
    clearInterval(_pictureAutoTimer)
    _pictureAutoTimer = null
  }
}

watch(() => props.isLoading, (loading) => {
  if (loading) _startPictureTimer()
  else _stopPictureTimer()
}, { immediate: true })

onUnmounted(_stopPictureTimer)

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleDoubleClick(): void {
  currentJoke.value = randomJoke()
  selectItem('glossaryJoke')
}

function handleItemClick(id: string): void {
  if (id === 'glossaryJoke') currentJoke.value = randomJoke()
  if (id === 'niceThings')   currentNiceThing.value = randomNiceThing()
  if (id === 'showPictures') {
    pictureSeed.value    = Math.floor(Math.random() * 99999)
    pictureLoading.value = true
  }
  selectItem(id)
}

/** Label shown in the compact header when an item is active */
const activeItemLabel = computed((): string => {
  const item = AMUSE_ITEMS.find(i => i.id === activeItemId.value)
  return item ? `${item.emoji} ${item.label}` : '🎉 Fun while waiting'
})
</script>

<template>
  <Transition name="amuse-fade">
    <div v-if="lingerVisible" class="mt-4 w-full">

      <!-- ── Post-loading Continue offer ──────────────────────────────────── -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="lingerFinishing && !isLoading"
          class="mb-2 flex flex-col items-center gap-1"
        >
          <button
            type="button"
            class="animate-pulse rounded-full bg-indigo-600/90 hover:bg-indigo-700 px-5 py-2
                   text-sm font-bold text-white shadow-md
                   focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
            title="Continue Amuse Me — click to keep Fun While Waiting open; otherwise it disappears when the countdown reaches zero"
            @click="extendLinger"
          >
            ✨ Click to Continue Amuse Me
          </button>
          <p class="text-[10px] text-slate-400 tabular-nums">
            Disappearing in {{ lingerCountdown }}s if you don't click
          </p>
        </div>
      </Transition>

      <!-- ── CLOSED STATE: big gradient trigger button ─────────────────── -->
      <!-- Shown only when panel is fully closed AND no item is active.       -->
      <!-- Once the user has picked something, the panel stays open.          -->
      <template v-if="!isOpen && !activeItemId">
        <div
          class="relative"
          @mouseenter="showHoverPreview = true"
          @mouseleave="showHoverPreview = false"
        >
          <button
            type="button"
            class="amuse-btn w-full h-14 rounded-2xl text-white font-bold text-base
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

          <!-- Hover preview HoverHint — 3 top items -->
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
      </template>

      <!-- ── OPEN STATE: content-first panel ────────────────────────────── -->
      <!-- Panel always mounts when isOpen OR when an item is active         -->
      <!-- (activeItemId persists the open state even after toggle=false).   -->
      <Transition name="panel-slide">
        <div
          v-if="isOpen || activeItemId"
          class="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden mt-2"
        >

          <!-- Compact header: always shows current activity or title -->
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <span class="text-sm font-semibold text-slate-700 truncate mr-2">
              {{ activeItemId ? activeItemLabel : '🎉 Fun while waiting' }}
            </span>
            <CloseDot
              aria-label="Close Amuse Me panel"
              title="Close"
              variant="on-light"
              @click="close"
            />
          </div>

          <!-- ══ NO ITEM SELECTED: 2-column tile picker ══════════════════ -->
          <!-- Compact grid — all 9 items visible at a glance, no scroll.   -->
          <div
            v-if="!activeItemId"
            class="p-3 grid grid-cols-2 gap-2"
          >
            <button
              v-for="item in AMUSE_ITEMS"
              :key="item.id"
              type="button"
              :title="`${item.label} — ${item.blurb}`"
              class="flex items-center gap-2.5 px-3 py-3 rounded-xl text-left
                     bg-slate-50 hover:bg-indigo-50 border border-slate-100
                     hover:border-indigo-200 hover:shadow-sm transition-all duration-150"
              @click="handleItemClick(item.id)"
            >
              <span class="text-2xl leading-none shrink-0" aria-hidden="true">{{ item.emoji }}</span>
              <div class="min-w-0">
                <p class="text-[12px] font-semibold text-slate-800 leading-tight">{{ item.label }}</p>
                <p class="text-[10px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{{ item.blurb }}</p>
              </div>
            </button>
          </div>

          <!-- ══ ITEM SELECTED: content-first layout ═════════════════════ -->
          <!-- (1) Content occupies the full panel — no list pushing it down  -->
          <!-- (2) Slim horizontal pill nav at the bottom for switching        -->
          <template v-else>

            <!-- Content area — PRIMARY, top of panel, no max-height clip    -->
            <Transition name="content-fade" mode="out-in">
              <div :key="activeItemId" class="p-4 pb-3">

                <!-- glossaryJoke ─────────────────────────────────────── -->
                <!-- r41 v70 (Tom Gilb 2026-06-16 "clicking on icons does not
                     work here and in other parts of the fun") — the whole
                     card is now a clickable button: tapping anywhere on the
                     joke card (icon, blockquote, white space) rotates to a
                     new joke.  Previously the only way to refresh was the
                     button-strip below the card, which Tom missed; the
                     surrounded icon looks clickable so it should BE. -->
                <div v-if="activeItemId === 'glossaryJoke'">
                  <button
                    type="button"
                    class="w-full text-left flex items-start gap-3 bg-violet-50 border border-violet-200 rounded-xl p-4
                           hover:bg-violet-100 hover:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400
                           transition-colors duration-150 cursor-pointer"
                    title="Click anywhere on this card for a new Glossary Joke"
                    aria-label="Show a new Glossary Joke"
                    @click="handleItemClick('glossaryJoke')"
                  >
                    <span class="text-4xl leading-none shrink-0" aria-hidden="true">🎭</span>
                    <blockquote class="text-sm text-violet-800 leading-relaxed italic">
                      "{{ currentJoke }}"
                    </blockquote>
                  </button>
                  <p class="text-xs text-slate-400 mt-2 text-right">
                    Tap the card 🎭 or the button below for a new joke
                  </p>
                </div>

                <!-- planProgress ──────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'planProgress'">
                  <div class="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <span class="text-3xl leading-none shrink-0" aria-hidden="true">📈</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
                        Plan Progress to Date
                      </p>
                      <p class="text-sm text-emerald-900 leading-relaxed">{{ planProgress }}</p>
                    </div>
                  </div>
                </div>

                <!-- nextStep ──────────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'nextStep'">
                  <div class="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-xl p-4">
                    <span class="text-3xl leading-none shrink-0" aria-hidden="true">➡️</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">
                        What Happens Next
                      </p>
                      <p class="text-sm text-sky-900 leading-relaxed">{{ nextStep }}</p>
                    </div>
                  </div>
                </div>

                <!-- niceThings ────────────────────────────────────────── -->
                <!-- r41 v70 — same clickable-card pattern: tapping the card
                     itself rotates to a new suggestion. -->
                <div v-else-if="activeItemId === 'niceThings'">
                  <button
                    type="button"
                    class="w-full text-left flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4
                           hover:bg-rose-100 hover:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400
                           transition-colors duration-150 cursor-pointer"
                    title="Click anywhere on this card for another nice-thing suggestion"
                    aria-label="Show another nice-thing suggestion"
                    @click="handleItemClick('niceThings')"
                  >
                    <span class="text-3xl leading-none shrink-0" aria-hidden="true">❤️</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-1">
                        Something Nice to Do
                      </p>
                      <p class="text-sm text-rose-900 leading-relaxed">{{ currentNiceThing }}</p>
                    </div>
                  </button>
                  <p class="text-xs text-slate-400 mt-2 text-right">
                    Tap the card ❤️ or the button below for another suggestion
                  </p>
                </div>

                <!-- completionAlert ───────────────────────────────────── -->
                <div v-else-if="activeItemId === 'completionAlert'">
                  <div class="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                    <span class="text-3xl leading-none shrink-0" aria-hidden="true">🔔</span>
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

                <!-- whyThisMatters ────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'whyThisMatters'">
                  <div class="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <span class="text-3xl leading-none shrink-0" aria-hidden="true">🔮</span>
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

                <!-- untilSharing ──────────────────────────────────────── -->
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

                <!-- explainMode ───────────────────────────────────────── -->
                <div v-else-if="activeItemId === 'explainMode'">
                  <div class="flex items-start gap-3 bg-slate-100 border border-slate-300 rounded-xl p-4">
                    <span class="text-3xl leading-none shrink-0" aria-hidden="true">👆</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                        Explain Any Element
                      </p>
                      <ul class="text-sm text-slate-700 leading-relaxed space-y-2">
                        <li><strong>Hover</strong> any button — its HoverHint will explain what it does.</li>
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

                <!-- showPictures ──────────────────────────────────────── -->
                <!-- Full-size image: aspect-video at panel width, no clip -->
                <div v-else-if="activeItemId === 'showPictures'">
                  <!-- Theme selector pills (compact) -->
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

                  <!-- Full-bleed photo — aspect-video, NO max-height clip.
                       r41 v51 (Tom Gilb 2026-06-16 "the pictures in fun while
                       waiting are mostly blank, there is no point in blank at
                       all") — when loremflickr fails to load (CORS / network
                       / rate-limit), fall back to a glossary joke card so the
                       slot is NEVER blank.  Picture and joke are mutually
                       exclusive — picture wins when it loads, joke fills in
                       when it doesn't.
                       r41 v70 (Tom Gilb 2026-06-16 "clicking on icons does
                       not work here") — whole picture container now click-
                       to-refresh so tapping anywhere on the picture loads
                       a new one (same theme).  Cursor-pointer + accessible
                       button semantics. -->
                  <div class="relative rounded-xl overflow-hidden bg-slate-100 aspect-video cursor-pointer"
                       role="button"
                       tabindex="0"
                       title="Click anywhere on the picture for a new photo"
                       aria-label="Show another picture"
                       @click="refreshPicture"
                       @keydown.enter="refreshPicture"
                       @keydown.space.prevent="refreshPicture">
                    <div
                      v-if="pictureLoading && !pictureFailed"
                      class="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse"
                    />
                    <!-- Joke-fallback card (when picture failed to load) -->
                    <div
                      v-if="pictureFailed"
                      class="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 text-center"
                    >
                      <div class="text-3xl mb-3">🎭</div>
                      <p class="text-sm font-semibold text-slate-800 mb-2 leading-snug max-w-sm">{{ fallbackJoke }}</p>
                      <p class="text-[10px] text-slate-500 italic mt-2">Picture service unavailable — Planguage joke instead.</p>
                    </div>
                    <img
                      v-if="!pictureFailed"
                      :key="currentPictureUrl"
                      :src="currentPictureUrl"
                      :alt="`${activeTheme.label} photo — via loremflickr`"
                      class="w-full h-full object-cover transition-opacity duration-500"
                      :class="pictureLoading ? 'opacity-0' : 'opacity-100'"
                      @load="pictureLoading = false; pictureFailed = false"
                      @error="pictureLoading = false; pictureFailed = true"
                    />
                  </div>

                  <!-- Caption + refresh -->
                  <div class="flex items-center justify-between mt-2">
                    <p class="text-[10px] text-slate-400">
                      {{ activeTheme.emoji }} {{ activeTheme.label }} · via loremflickr
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

              </div>
            </Transition>

            <!-- Activity nav row removed (Tom 2026-06-02: "dark bar covering other stuff") -->

          </template>

        </div>
      </Transition>

    </div>
  </Transition>
</template>

<style scoped>
/* Gradient animation for the closed-state trigger button */
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

/* Hover preview HoverHint */
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

/* Content area cross-fade (mode="out-in" so items swap cleanly) */
.content-fade-enter-active,
.content-fade-leave-active {
  transition: opacity 0.18s ease;
}
.content-fade-enter-from,
.content-fade-leave-to {
  opacity: 0;
}
</style>
