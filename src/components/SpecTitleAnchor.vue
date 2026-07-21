<!-- UNIT_TYPE=Widget -->
<!--
 * SpecTitleAnchor.vue — global context-anchor chip showing the active Spec
 * title whenever the main Spec Crest is out of the viewport.
 *
 * Tom Gilb 2026-06-21 verbatim (woken from sleep): *"The Spec Title should be
 * on any and all windows when the Main title is out of Device window sight.
 * Easy, right?"*
 *
 * Mounts ONCE globally in App.vue (Teleport to body so it sits above any open
 * modal / panel / drawer at every z-index).  Uses IntersectionObserver on the
 * canonical Spec Crest element (`section[aria-label="Spec Crest — active
 * spec"]`) so the chip only renders when the crest is genuinely off-screen —
 * no double-display when the user is at the top, no flicker on micro-scroll.
 *
 * Composes with: MOVE Principle SUPREME (context visible at-a-glance, every
 * window) · DD-014 Top-and-Bottom Navigation Mirror SUPREME (same idea —
 * make orientation cues always reachable) · DD-009 Zero-Training UI · No-
 * Silent-Removal SUPREME (additive; never removes the main Spec Crest) ·
 * accessibility_tom.md (Tom 85, context anchor reduces cognitive load when
 * scrolled deep into a panel) · Twin portability.
 -->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

const props = defineProps<{
  /** The active Spec name. Hidden when null/empty. */
  specName?: string | null
  /** Optional spec version (e.g. "v0.3") rendered as a small subscript. */
  specVersion?: string | null
}>()

const emit = defineEmits<{
  /** Click anywhere on the chip — fires so the parent can scroll-to-top. */
  (e: 'jump-to-top'): void
}>()

/** True when the Spec Crest is OUT of the viewport (chip should show). */
const crestOutOfView = ref(false)
/** r41 v247 (Tom Gilb 2026-06-21 follow-up: "if there were n active windows
 *  below, then all should have the title at top.  It does not have to be
 *  large, just there").  True when any modal / dialog / panel is open — those
 *  cover the main Crest visually even when it's "in" the viewport, so the
 *  context anchor must also show in that case.  Watched via MutationObserver
 *  on body for nodes with role="dialog" OR aria-modal="true". */
const anyDialogOpen = ref(false)
let observer: IntersectionObserver | null = null
let dialogObserver: MutationObserver | null = null

function recomputeDialogs(): void {
  // r41 v247 — count visible dialogs.  display:none / hidden ones don't count.
  const dialogs = document.querySelectorAll('[role="dialog"], [aria-modal="true"]')
  let visibleCount = 0
  for (const d of dialogs) {
    const cs = window.getComputedStyle(d)
    if (cs.display !== 'none' && cs.visibility !== 'hidden') visibleCount++
  }
  anyDialogOpen.value = visibleCount > 0
}

/** Resolve the canonical Spec Crest element by its aria-label so we don't
 *  depend on internal class names that may churn. */
function findCrest(): Element | null {
  return document.querySelector('section[aria-label="Spec Crest — active spec"]')
}

/** Attach IntersectionObserver. If the crest isn't mounted yet (e.g. pre-spec
 *  state), retry once after a tick — never throw. */
function attach(): void {
  const crest = findCrest()
  if (!crest) {
    crestOutOfView.value = false
    return
  }
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      const e = entries[0]
      if (!e) return
      // Out of view = NOT intersecting AND any part of crest is above/below the viewport.
      crestOutOfView.value = !e.isIntersecting
    },
    {
      // Fire at any intersection ratio change ≥ 0 (crest enters / exits the viewport).
      threshold: 0,
      // Bias slightly negative so a 1-pixel sliver doesn't keep the chip visible.
      rootMargin: '-8px 0px 0px 0px',
    },
  )
  observer.observe(crest)
}

onMounted(() => {
  // First attach attempt. If the crest mounts later (e.g. after a spec loads),
  // a second attach fires on the next animation frame to catch it.
  attach()
  requestAnimationFrame(() => { attach() })
  // Re-attach on resize (viewport changes can re-render the crest).
  window.addEventListener('resize', attach)

  // r41 v247 — watch the body subtree for dialog open/close.  Any node added/
  // removed/attribute-changed under body that affects role/aria-modal will
  // recompute the dialog visibility flag.  Cheap — only fires on real DOM
  // structure changes (panel open/close), not every render tick.
  recomputeDialogs()
  dialogObserver = new MutationObserver(() => { recomputeDialogs() })
  dialogObserver.observe(document.body, {
    childList:  true,
    subtree:    true,
    attributes: true,
    attributeFilter: ['role', 'aria-modal', 'style', 'hidden'],
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  dialogObserver?.disconnect()
  dialogObserver = null
  window.removeEventListener('resize', attach)
})

const visible = computed<boolean>(() =>
  Boolean(
    props.specName && props.specName.trim().length > 0
    // Show when the main Crest is off-screen OR any panel / modal / dialog
    // is open (those cover the main Crest visually).  Tom Gilb 2026-06-21
    // verbatim: "if there were n active windows below, then all should have
    // the title at top".
    && (crestOutOfView.value || anyDialogOpen.value),
  ),
)

// r41 v293 (Tom Gilb 2026-06-22 verbatim 'THE COP EMAL BAR IS PARTIALLY
// OBSCURED' — PentaPanel screenshot).  Root cause: when a dialog/modal is
// open the global SpecTitleAnchor chip at z-[9000] (Teleport to body) is
// centered horizontally and overlaps the dialog's right-side chrome (Copy /
// Email / Governance pins in PentaPanel's case).  Per Tom's banked rule 'it
// does not have to be large, just there' — when a dialog is open we move the
// chip to a smaller TOP-LEFT anchor: visibility stays, chrome stays clear.
// In plain (no-dialog) mode it keeps the centered look that survives on the
// main canvas.  The branch lives in the template :class binding using the
// existing reactive `anyDialogOpen` flag.

function jumpToTop(): void {
  emit('jump-to-top')
  // Best-effort scroll on this side too, so the user sees movement immediately
  // even if the parent doesn't handle the emit.
  try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* old browsers */ }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <button
        v-if="visible"
        type="button"
        :class="[
          'fixed z-[9000] inline-flex items-center gap-2 rounded-full',
          'bg-gradient-to-r from-indigo-700/95 to-violet-700/95',
          'text-white font-semibold tracking-wide',
          'shadow-lg ring-1 ring-white/20 backdrop-blur',
          'hover:from-indigo-600 hover:to-violet-600',
          'focus:outline-none focus:ring-2 focus:ring-amber-300/70',
          anyDialogOpen
            ? 'top-2 left-3 h-7 px-2.5 text-[10px]'
            : 'top-2 left-1/2 -translate-x-1/2 h-8 px-3 text-[11px]',
        ]"
        :title="`Active Spec: ${specName}${specVersion ? ' · ' + specVersion : ''} — click to scroll back to the Spec Crest (Tom Gilb 2026-06-21).`"
        :aria-label="`Active Spec: ${specName}${specVersion ? ' version ' + specVersion : ''}. Click to scroll to top.`"
        @click="jumpToTop"
      >
        <span aria-hidden="true" class="text-[10px] leading-none opacity-80">↑</span>
        <span class="truncate" :class="anyDialogOpen ? 'max-w-[180px]' : 'max-w-[280px]'">{{ specName }}</span>
        <span v-if="specVersion" class="text-[9px] font-mono opacity-70 leading-none">{{ specVersion }}</span>
      </button>
    </Transition>
  </Teleport>
</template>
