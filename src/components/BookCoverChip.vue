<!-- UNIT_TYPE=Widget -->
<!-- BookCoverChip.vue — Miniature book-cover chip for referencing Gilb books in the UI.
     Renders a pure-CSS simulated book spine + title + author + download links.
     NO external images — entirely CSS-driven.

     Two modes:
       Standard (default): horizontal card — mini cover left, text + links right.
       Compact (prop compact=true): inline chip — tiny cover + title + first link.

     Download links render only when the URL prop is non-empty.
     All links open in a new tab (target="_blank" rel="noopener noreferrer").

     TwinPod-URI Access Policy: this component ONLY receives user-facing distribution
     URLs (ResearchGate, Leanpub, Dropbox, etc.) — never TwinPod pdfUri/mdUri.
     Those are AI-internal only and must NOT appear in any rendered UI.

     Usage (standard):
       <BookCoverChip
         title="Competitive Engineering"
         short-title="CE"
         year="2005"
         cover-color="#1e3a5f"
         research-gate-url="https://www.researchgate.net/publication/237129623"
       />

     Usage (compact):
       <BookCoverChip
         title="Cost Engineering"
         short-title="Cost Eng"
         compact
         research-gate-url="https://www.researchgate.net/profile/Tom-Gilb"
       />
-->

<script setup lang="ts">
import { computed } from 'vue'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  /** Full book title, e.g. "Competitive Engineering" */
  title: string
  /** 1-3 word short title for the mini cover spine, e.g. "CE" */
  shortTitle: string
  /** Author name — defaults to "Tom Gilb" */
  author?: string
  /** Publication year, e.g. "2005" */
  year?: string
  /** CSS colour for the cover background (hex, rgb, or named) — defaults to deep navy */
  coverColor?: string
  /** Tailwind text-color class for cover text — default 'text-white' */
  coverTextColor?: string
  /** Real book cover image URL — when provided, renders <img> instead of the CSS block.
   *  Source must be a public distribution channel (Leanpub CDN, ResearchGate, etc.).
   *  TwinPod pdfUri / mdUri are AI-internal only and must NEVER be passed here. */
  coverImageUrl?: string
  /** Cover display width in px (standard mode only) — default 72 when using a real image, 56 for CSS cover */
  coverWidth?: number
  /** Cover display height in px (standard mode only) — default 108 when using a real image, 84 for CSS cover */
  coverHeight?: number
  /** ResearchGate / free PDF URL */
  researchGateUrl?: string
  /** Leanpub purchase URL */
  leanpubUrl?: string
  /** Dropbox / direct download URL */
  dropboxUrl?: string
  /** Compact inline chip mode */
  compact?: boolean
}>(), {
  author: 'Tom Gilb',
  coverColor: '#1e3a5f',
  coverTextColor: 'text-white',
  compact: false,
})

// ── Computed helpers ─────────────────────────────────────────────────────────

/** First available download URL for compact mode "↗ free PDF" link */
const primaryUrl = computed(
  () => props.researchGateUrl || props.leanpubUrl || props.dropboxUrl || null
)

/** Truncate short title to ~10 chars to avoid overflow in the mini cover */
const coverLabel = computed(() =>
  props.shortTitle.length > 10 ? props.shortTitle.slice(0, 9) + '…' : props.shortTitle
)

/** Resolved cover dimensions — real image gets a larger default than the CSS block */
const resolvedWidth  = computed(() => props.coverWidth  ?? (props.coverImageUrl ? 120 : 56))
const resolvedHeight = computed(() => props.coverHeight ?? (props.coverImageUrl ? 180 : 84))

/** Inline style for the cover div — uses coverColor + 3D spine shadow */
const coverStyle = computed(() => ({
  backgroundColor: props.coverColor,
  boxShadow: `inset 2px 0 0 rgba(0,0,0,0.3), inset -1px 0 0 rgba(255,255,255,0.07), 2px 2px 4px rgba(0,0,0,0.35)`,
}))

/** Left-edge darker stripe to reinforce the 3D book spine illusion */
const spineStyle = computed(() => ({
  backgroundColor: shadeColor(props.coverColor ?? '#1e3a5f', -30),
}))

/** Author label — truncated to "Gilb" in compact/small renders */
const authorShort = computed(() =>
  props.author === 'Tom Gilb' ? 'Gilb' : props.author?.split(' ').pop() ?? props.author
)

// ── Utility ───────────────────────────────────────────────────────────────────

/** Darken or lighten a hex/named colour by `amount` (negative = darker) */
function shadeColor(color: string, amount: number): string {
  // Parse hex; fall back to a safe default for named colours
  let hex = color.replace('#', '')
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  if (hex.length !== 6) return amount < 0 ? '#0f1f30' : '#4a6a8f'
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
</script>

<template>
  <!-- ═══════════════════════════════════════════════════════════════
       COMPACT MODE — inline chip
       ═══════════════════════════════════════════════════════════════ -->
  <span
    v-if="compact"
    class="inline-flex items-center gap-1.5 align-middle"
  >
    <!-- Tiny book cover: 20×28px -->
    <span
      class="relative flex-shrink-0 rounded-[2px] overflow-hidden flex flex-col items-end"
      :style="{ ...coverStyle, width: '20px', height: '28px' }"
      aria-hidden="true"
    >
      <!-- Spine stripe -->
      <span
        class="absolute left-0 top-0 bottom-0"
        :style="{ ...spineStyle, width: '3px' }"
      />
      <!-- Cover title text -->
      <span
        class="relative z-10 w-full px-0.5 mt-1 text-center leading-none font-bold text-white"
        :style="{ fontSize: '5px', lineHeight: '1.1' }"
      >{{ coverLabel }}</span>
      <!-- Author label at bottom -->
      <span
        class="relative z-10 w-full px-0.5 mb-0.5 text-center text-white/60"
        :style="{ fontSize: '4px' }"
      >{{ authorShort }}</span>
    </span>

    <!-- Title inline -->
    <span class="text-[11px] font-semibold text-slate-700">{{ title }}</span>
    <span v-if="year" class="text-[10px] text-slate-400">({{ year }})</span>

    <!-- First available link -->
    <a
      v-if="primaryUrl"
      :href="primaryUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
    >↗ free PDF</a>
  </span>

  <!-- ═══════════════════════════════════════════════════════════════
       STANDARD MODE — flex-shrink-0 chip (auto-width, never w-full)
       Cover: 56×84 px ≈ 1 inch tall on a typical Mac screen.
       ═══════════════════════════════════════════════════════════════ -->
  <div
    v-else
    class="inline-flex flex-shrink-0 gap-3"
    :class="coverImageUrl ? 'items-center' : 'items-start'"
  >
    <!-- Book cover block — real image if coverImageUrl provided, CSS fallback otherwise -->
    <div
      class="relative flex-shrink-0 rounded-[4px] overflow-hidden shadow-md"
      :style="{
        width:  resolvedWidth  + 'px',
        height: resolvedHeight + 'px',
        boxShadow: '2px 3px 8px rgba(0,0,0,0.35), -1px 0 0 rgba(0,0,0,0.2)',
      }"
      :aria-label="`Book cover: ${title}`"
    >
      <!-- ── Real cover image ── -->
      <img
        v-if="coverImageUrl"
        :src="coverImageUrl"
        :alt="`${title} book cover`"
        class="absolute inset-0 w-full h-full object-contain object-center"
        loading="lazy"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />

      <!-- ── CSS cover fallback (shown when no image or image fails to load) ── -->
      <div
        class="absolute inset-0 flex flex-col"
        :style="coverStyle"
        :class="coverImageUrl ? 'opacity-0 pointer-events-none' : ''"
        aria-hidden="true"
      >
        <!-- Spine stripe (darker left edge) -->
        <span
          class="absolute left-0 top-0 bottom-0"
          :style="{ ...spineStyle, width: '6px' }"
        />
        <!-- Cover title text -->
        <span
          class="relative z-10 w-full px-1 mt-2 text-center leading-snug font-bold text-white"
          :style="{ fontSize: '9px', lineHeight: '1.2' }"
        >{{ coverLabel }}</span>
        <!-- Spacer -->
        <span class="flex-1" />
        <!-- Author at bottom -->
        <span
          class="relative z-10 w-full px-1 mb-1.5 text-center text-white/70"
          :style="{ fontSize: '7px' }"
        >{{ authorShort }}</span>
        <!-- Year strip at very bottom -->
        <span
          class="relative z-10 w-full text-center text-white/50 pb-1"
          :style="{ fontSize: '6px' }"
        >{{ year }}</span>
      </div>
    </div>

    <!-- Text block: title + author/year + download links -->
    <div class="flex flex-col gap-0.5 min-w-0">
      <!-- Title -->
      <span class="text-[13px] font-bold text-slate-800 leading-snug">{{ title }}</span>

      <!-- Author · Year -->
      <span class="text-[11px] text-slate-500">
        {{ author }}<template v-if="year"> · {{ year }}</template>
      </span>

      <!-- Download links row — only render links with non-empty URLs -->
      <div
        v-if="researchGateUrl || leanpubUrl || dropboxUrl"
        class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1"
      >
        <a
          v-if="researchGateUrl"
          :href="researchGateUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
        >Free PDF →</a>
        <a
          v-if="leanpubUrl"
          :href="leanpubUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
        >Leanpub →</a>
        <a
          v-if="dropboxUrl"
          :href="dropboxUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[11px] font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
        >Dropbox →</a>
      </div>
    </div>
  </div>
</template>
