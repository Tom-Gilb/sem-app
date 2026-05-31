<!-- UNIT_TYPE=Widget -->
<!-- CloseDot.vue — universal close-button widget.
     macOS-style red traffic-light dot. The ONE close affordance used across
     every closable surface (modals, drawers, panels, dialogs, popovers).
     Per vault CLAUDE.md "Universal Close-Button Rule" — never use X / × / ✕
     glyphs as close buttons.

     Usage:
       <CloseDot @click="close" aria-label="Close Settings" />
       <CloseDot variant="on-dark" @click="close" aria-label="Close Modal" />

     Props:
       ariaLabel — required, screen-reader label (e.g. "Close Settings")
       title     — tooltip text (default: "Close")
       variant   — 'on-light' (default — red dot on light background)
                 | 'on-dark'  (white-tinted dot on dark/coloured header background)
                 | 'subtle'   (gray traffic-light variant for secondary contexts)
-->

<script setup lang="ts">
withDefaults(defineProps<{
  ariaLabel: string
  title?: string
  variant?: 'on-light' | 'on-dark' | 'subtle'
}>(), {
  title: 'Close',
  variant: 'on-light',
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
  <button
    type="button"
    :class="[
      'group relative flex h-5 w-5 items-center justify-center rounded-full shadow-sm',
      'transition-all hover:scale-125 shrink-0',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
      variant === 'on-light' && [
        'bg-red-500 ring-1 ring-red-700/40',
        'hover:bg-red-600 hover:shadow-md hover:ring-red-800/60',
        'focus-visible:outline-red-500',
      ],
      variant === 'on-dark' && [
        'bg-red-500/80 ring-1 ring-white/30',
        'hover:bg-red-500 hover:ring-white/70',
        'focus-visible:outline-white/70',
      ],
      variant === 'subtle' && [
        'bg-slate-400/60 ring-1 ring-black/15',
        'hover:bg-red-500 hover:ring-red-700/50',
        'focus-visible:outline-slate-500',
      ],
    ]"
    :title="title"
    :aria-label="ariaLabel"
    @click="$emit('click', $event)"
  >
    <!-- macOS traffic-light: glyph hidden at rest, appears on hover only.
         Tom 2026-05-31: "the close dot is visually big and you see the - in middle."
         Fix: opacity-0 at rest → opacity-100 on group-hover, matching macOS. -->
    <span
      :class="[
        'opacity-0 group-hover:opacity-100 transition-opacity',
        'text-[11px] font-black leading-none select-none',
        variant === 'on-light' && 'text-white',
        variant === 'on-dark'  && 'text-white',
        variant === 'subtle'   && 'text-slate-800 group-hover:text-white',
      ]"
      aria-hidden="true"
    >⊖</span>
  </button>
</template>
