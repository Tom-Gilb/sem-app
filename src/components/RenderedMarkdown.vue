<!--
  RenderedMarkdown.vue — UNIVERSAL beautiful Markdown / AI-output renderer
  (Tom Gilb r93www 2026-06-13).

  Tom verbatim 2026-06-13: *"I want beauthy html color standard, make it
  enticing to read, build an edit logic for it everywhere"*.

  Single source of truth for rendering Markdown / AI-output content across
  every SEM App surface. Mount in:
    - SelectionDefiner (Twin Consultant response — primary, shipped this turn)
    - Maria report panel (planned sweep)
    - EvoCritiquer response panel (planned sweep)
    - FEED ME! response card (planned sweep)
    - Sharpen Plan AI suggestions
    - Stakeholder Mapper AI insights
    - Any future panel that displays AI / Twin Markdown content

  Visual treatment (the "beauthy html color standard"):
    - H1 → 22 px black violet→indigo gradient text, soft underline (published heading style)
    - H2 → 16 px extrabold violet-800, left-edge violet-500 bar (section heading)
    - H3 → 13 px bold uppercase tracking violet-700 (subsection)
    - Bold → extrabold slate-900 (stronger than default)
    - Italic → slate-700 with subtle italicism
    - Tables → rounded card, gradient violet→indigo header with white text, alternating
              row bands, hover-highlight, shadow-sm, overflow-x-auto
    - HR → soft violet-300 gradient hairline (not a hard line)
    - Bullet lists → violet-styled markers
    - `code` → violet-100 chip with violet ring
    - "Key: value" pattern (e.g. `**Definition:** …`) → gradient pill rows that
      read as a definition list
    - URLs → clickable violet underline, target=_blank, opens new tab
    - `*NNN` Planguage concept numbers → clickable chip-style violet anchors that
      open the canonical Twin concept page (passwordless, free at-a-click,
      drives r93ppp funding-loop discipline)

  Props:
    :source            — the Markdown source string to render
    :compact           — when true, removes outer padding (for tight contexts)
    :no-trap-warning   — when true, suppresses the "*NNN clickable" legend
                         (callers that have their own legend below the bar)

  XSS safety: input is HTML-entity-escaped BEFORE any tag construction; only
  this component's own renderer adds `<a>` / `<strong>` / `<table>` etc.
  URL regex restricted to `https?://` so `javascript:` injection is impossible.
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed } from 'vue'
import { renderTwinMarkdown } from '../composables/useTwinMarkdownRender'

const props = withDefaults(defineProps<{
  source?: string
  compact?: boolean
  noTrapWarning?: boolean
}>(), { source: '', compact: false, noTrapWarning: false })

const emit = defineEmits<{
  /** r93zzz — fired when the user clicks a Related-Concepts table row that has
   *  drill-into attributes (data-concept-name + data-concept-number). Parent
   *  uses this to trigger a Twin re-query for that concept inside the
   *  same panel (with navigation history). */
  (e: 'drilldown', payload: { name: string; number: string }): void
  /** r93d7 — fired when the user clicks the 💡 Illuminate icon on a row.
   *  Parent invokes the full Illuminate flow (local Planguage Glossary tier 1
   *  + Twin fallback) for that concept — same as ⌥I keyboard shortcut. */
  (e: 'illuminate-concept', payload: { name: string; number: string }): void
}>()

const html = computed<string>(() => renderTwinMarkdown(props.source))

/** Event-delegated click handler — three precedence tiers (r93a4):
 *    1. Anchor clicks (`<a>`) — let the anchor own the click; the inline `*NNN`
 *       chips inside the body open new tabs naturally with target="_blank".
 *    2. The 📚 Sources button (`[data-action="open-twin-window"]`) — open the
 *       Twin Consultant concept page in a NEW WINDOW with sizing features so
 *       the user gets a separate workspace for browsing book passages + figures.
 *       (Tom Gilb 2026-06-13: "could use twin to find sources of info and
 *        especially any figures from my books !! (in separate window???".)
 *    3. Row body click — emit `drilldown` so the parent re-cites the Twin for
 *       that concept inside the same panel with back-navigation history. */
function _onContainerClick(e: MouseEvent): void {
  const target = e.target as HTMLElement | null
  if (!target) return
  // 1. Anchors own their clicks.
  if (target.closest('a')) return
  // 2a. The 💡 Illuminate button: emit `illuminate-concept` so the parent
  //     runs the full Illuminate (⌘I) flow for this concept.
  const illuminateBtn = target.closest('[data-action="illuminate-concept"]') as HTMLElement | null
  if (illuminateBtn) {
    e.stopPropagation()
    e.preventDefault()
    const name = illuminateBtn.getAttribute('data-concept-name') ?? ''
    const number = illuminateBtn.getAttribute('data-concept-number') ?? ''
    if (name && number) emit('illuminate-concept', { name, number })
    return
  }
  // 2b. The 📚 Sources & Figures button (real <button>): open in new window.
  const sourcesBtn = target.closest('[data-action="open-twin-window"]') as HTMLElement | null
  if (sourcesBtn) {
    e.stopPropagation()
    e.preventDefault()
    const url = sourcesBtn.getAttribute('data-twin-url')
    const name = sourcesBtn.getAttribute('data-concept-name') ?? 'concept'
    if (url) {
      // Force a SEPARATE WINDOW (not just a new tab). Most modern browsers
      // honour width/height feature strings when the window is not the same
      // origin as the opener — Safari and Firefox always open as a popup
      // window; Chrome opens as a new tab but respects the unique window name
      // so subsequent clicks on the SAME concept reuse the same window.
      const winName = `twin-${name.replace(/\s+/g, '-')}`
      const features = 'width=1100,height=850,left=200,top=100,toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes'
      window.open(url, winName, features)
    }
    return
  }
  // 3. Row body click → drill within panel.
  const row = target.closest('[data-concept-name]') as HTMLElement | null
  if (!row) return
  const name = row.getAttribute('data-concept-name') ?? ''
  const number = row.getAttribute('data-concept-number') ?? ''
  if (name && number) {
    emit('drilldown', { name, number })
  }
}
</script>

<template>
  <div
    class="rendered-markdown text-[12.5px] text-slate-800 leading-relaxed"
    :class="compact ? 'p-0' : 'px-1'"
    v-html="html"
    @click="_onContainerClick"
  ></div>
</template>

<!--
  Scoped styles for v-html'd content. Tailwind classes work inside v-html
  because they are globally generated; these scoped overrides catch the
  generic tag styling that has no class binding (defensive backstop).
-->
<style scoped>
.rendered-markdown :deep(p:first-child) { margin-top: 0; }
.rendered-markdown :deep(h2:first-child),
.rendered-markdown :deep(h3:first-child),
.rendered-markdown :deep(h4:first-child) { margin-top: 0; }
.rendered-markdown :deep(a) { text-decoration: underline; text-underline-offset: 2px; }
.rendered-markdown :deep(table) { font-size: 12.5px; }
</style>
