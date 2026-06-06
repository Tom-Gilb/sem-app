<!-- UNIT_TYPE=Widget -->
<!-- CloseDot.vue — universal close-button widget.
     macOS-style red traffic-light dot. The ONE close affordance used across
     every closable surface (modals, drawers, panels, dialogs, popovers).
     Per vault CLAUDE.md "Universal Close-Button Rule" — never use X / × / ✕
     glyphs as close buttons.

     Hover indicator: ExitGlyph `[->` (Blissymbolics exit, Tom Gilb 2026-06-02).
     The `[` is the surface you are inside; `->` is the exit direction.
     Replaces the previous ⊖ character — now semantically precise via the
     Planguage Keyed Action Glyph family.

     Usage:
       <CloseDot @click="close" aria-label="Close Settings" />
       <CloseDot variant="on-dark" @click="close" aria-label="Close Modal" />

     Props:
       ariaLabel — required, screen-reader label (e.g. "Close Settings")
       title     — tooltip text (default: "Close [->")
       variant   — 'on-light' (default — red dot on light background)
                 | 'on-dark'  (white-tinted dot on dark/coloured header background)
                 | 'subtle'   (gray traffic-light variant for secondary contexts)
-->

<script setup lang="ts">
import ExitGlyph from './icons/ExitGlyph.vue'

withDefaults(defineProps<{
  ariaLabel: string
  title?: string
  variant?: 'on-light' | 'on-dark' | 'subtle'
  /** size — 'md' = 20×20px (default); 'lg' = 32×32px (use when cursor blocks the icon) */
  size?: 'md' | 'lg'
}>(), {
  title: 'Close [->',
  variant: 'on-light',
  size: 'md',
})

defineEmits<{ click: [MouseEvent] }>()
</script>

<template>
  <!--
    Universal Close affordance.

    Sizing (2026-05-12): bumped from h-3.5 w-3.5 (14px) to h-5 w-5 (20px)
    plus a stronger ring + shadow so the close pin is comfortably
    findable across the app — per Tom's "I would not mind if close
    button were larger and redder" directive.

    Colour (2026-05-12): on-light variant moved from Apple's pastel
    `#ff5f57` to a deeper saturated red (`bg-red-500` with
    `hover:bg-red-600`) so it reads as "destructive close" at a glance.
    on-dark variant gets a tinted-red background (`bg-rose-500/30`
    with `hover:bg-rose-500/90`) instead of the previous white-tinted
    glass — the close pin should always look red, even on dark headers.
    subtle variant turns reddish on hover only.

    The ⊖ glyph stays the visible "click me" cue (no x/× ever — see
    Universal Close-Button Rule) and bumps to text-[11px].
  -->
  <!--
    size='md' = h-5 w-5 (20px, original).
    size='lg' = h-8 w-8 (32px) — use when cursor physically covers the icon,
    e.g. ContractHub header where the 20px dot is obscured by the mouse pointer.
    ExitGlyph scales proportionally: md=18×8px, lg=26×11px.
  -->
  <!-- Tom 2026-06-06: "for close button please put the circle line, around
       the red dot, when cursor is not there".  The previous `ring-1` at 40 %
       opacity was so subtle the circle line read as a smudge.  Bumped to a
       visible outline circle at rest (ring-2 + full-opacity colour +
       ring-offset-1 with white offset) so the dot reads as ⊙ — clearly a
       red dot inside a circle.  On hover the outline persists, the dot
       grows (hover:scale-125), and the ExitGlyph fades in. -->
  <button
    type="button"
    :class="[
      'group relative flex items-center justify-center rounded-full shadow-sm',
      'transition-all hover:scale-125 shrink-0',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
      'ring-offset-1',
      size === 'lg' ? 'h-8 w-8' : 'h-5 w-5',
      variant === 'on-light' && [
        'bg-red-500 ring-2 ring-red-700 ring-offset-white',
        'hover:bg-red-600 hover:shadow-md hover:ring-red-800',
        'focus-visible:outline-red-500',
      ],
      variant === 'on-dark' && [
        'bg-red-500/90 ring-2 ring-white/85 ring-offset-transparent',
        'hover:bg-red-500 hover:ring-white',
        'focus-visible:outline-white/80',
      ],
      variant === 'subtle' && [
        'bg-slate-400/70 ring-2 ring-slate-700/70 ring-offset-white',
        'hover:bg-red-500 hover:ring-red-700',
        'focus-visible:outline-slate-500',
      ],
    ]"
    :title="title"
    :aria-label="ariaLabel"
    @click="$emit('click', $event)"
  >
    <!-- ExitGlyph `[->` — Blissymbolics exit (Tom Gilb 2026-06-02).
         Hidden at rest, appears on group-hover — matching macOS traffic-light UX.
         The bracket IS the door; the arrow exits through it.
         md: 18×8px (fits 20px dot). lg: 26×11px (fits 32px dot, visible past cursor). -->
    <span
      :class="[
        'opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center',
        variant === 'subtle' && 'group-hover:text-white',
      ]"
      :style="{ color: 'white' }"
      aria-hidden="true"
    >
      <ExitGlyph
        size="compact"
        :style="size === 'lg' ? { width: '26px', height: '11px' } : { width: '18px', height: '8px' }"
        aria-hidden="true"
      />
    </span>
  </button>
</template>
