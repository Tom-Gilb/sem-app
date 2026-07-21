<!-- UNIT_TYPE=Icon -->
<!--
  PentaModelGlyph.vue — Color Artsy Icon (DD-016) for the Penta Model tool tile
  in PlanguageToolsPanel. Mirrors the Penta app display in miniature.

  Design: 5-sector pinwheel (same layout as the Penta panel SVG) with item-presence
  dots in each sector — shows "each sector has data entries."

  SVERD canonical colours (Gilb-Shalloway 2022):
    Stakeholders = red    (#dc2626)  — top sector
    Values       = green  (#16a34a)  — upper-right
    Efficiency   = blue   (#2563eb)  — lower-right
    Resources    = violet (#a855f7)  — lower-left
    Design       = orange (#ea580c)  — upper-left

  Geometry (viewBox 0 0 48 48, center 24 24, sector radius r=21):
    Boundary points at r=21 (SVG convention: 0°=right, -90°=top):
      -90° (top):    (24,  3)
      -18°:          (44,  17.5)
       54°:          (36.3, 41)
      126°:          (11.7, 41)
      198°:          (4,  17.5)

  Item dots (white circles, r=1.4) placed at sector mid-angles at two radii
  (r=12 inner, r=17 outer) — no English letters (DD-015 compliant).

  Responds to `size` prop (sm=20/md=32/lg=44/xl=56 px), matching all other tool glyphs.
  Tile in PlanguageToolsPanel overrides to 120×120 via inline CSS.
-->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), { size: 'md' })

const px = computed(() =>
  props.size === 'xl' ? 56 : props.size === 'lg' ? 44 : props.size === 'md' ? 32 : 20,
)
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    :width="px"
    :height="px"
    fill="none"
    aria-label="Penta Model — 5-sector SVERD sharpening framework"
    role="img"
  >
    <!-- ── Background card ──────────────────────────────────────────────── -->
    <rect x="0.5" y="0.5" width="47" height="47" rx="3.5"
          fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.6"/>

    <!-- ──────────────────────────────────────────────────────────────────
         Five pie sectors. Each uses M24 24 (center) → line to arc start →
         arc sweep (A21 21 0 0 1) to arc end → Z back to center.
         SVG large-arc flag = 0 (each sector is 72° < 180°).
         ────────────────────────────────────────────────────────────────── -->

    <!-- Sector 1 — Stakeholders (top, red) ── -90° to -18° ───────────── -->
    <path d="M24 24 L24 3 A21 21 0 0 1 44 17.5 Z" fill="#dc2626" opacity="0.88"/>

    <!-- Sector 2 — Values (upper-right, green) ── -18° to 54° ──────────── -->
    <path d="M24 24 L44 17.5 A21 21 0 0 1 36.3 41 Z" fill="#16a34a" opacity="0.88"/>

    <!-- Sector 3 — Efficiency (lower-right, blue) ── 54° to 126° ──────── -->
    <path d="M24 24 L36.3 41 A21 21 0 0 1 11.7 41 Z" fill="#2563eb" opacity="0.88"/>

    <!-- Sector 4 — Resources (lower-left, violet) ── 126° to 198° ──────── -->
    <path d="M24 24 L11.7 41 A21 21 0 0 1 4 17.5 Z" fill="#a855f7" opacity="0.88"/>

    <!-- Sector 5 — Design (upper-left, orange) ── 198° to 270° ──────────── -->
    <path d="M24 24 L4 17.5 A21 21 0 0 1 24 3 Z" fill="#ea580c" opacity="0.88"/>

    <!-- ── White dividing lines (sector boundaries) ──────────────────── -->
    <line x1="24" y1="24" x2="24"   y2="3"    stroke="white" stroke-width="0.9"/>
    <line x1="24" y1="24" x2="44"   y2="17.5" stroke="white" stroke-width="0.9"/>
    <line x1="24" y1="24" x2="36.3" y2="41"   stroke="white" stroke-width="0.9"/>
    <line x1="24" y1="24" x2="11.7" y2="41"   stroke="white" stroke-width="0.9"/>
    <line x1="24" y1="24" x2="4"    y2="17.5" stroke="white" stroke-width="0.9"/>

    <!-- ──────────────────────────────────────────────────────────────────
         Item-presence dots (white) — two dots per sector at radii 12 and 17.
         Positions computed from sector mid-angles:
           Stakeholders mid = -54°  → r12=(31.1,14.3), r17=(34.0,10.2)
           Values       mid =  18°  → r12=(35.4,27.7), r17=(40.2,29.3)
           Efficiency   mid =  90°  → r12=(24,  36  ), r17=(24,  41  )
           Resources    mid = 162°  → r12=(12.6,27.7), r17=( 7.8,29.3)
           Design       mid = 234°  → r12=(16.9,14.3), r17=(14.0,10.2)
         ────────────────────────────────────────────────────────────────── -->
    <!-- Stakeholders -->
    <circle cx="31.1" cy="14.3" r="1.4" fill="white" opacity="0.85"/>
    <circle cx="34.0" cy="10.2" r="1.4" fill="white" opacity="0.60"/>
    <!-- Values -->
    <circle cx="35.4" cy="27.7" r="1.4" fill="white" opacity="0.85"/>
    <circle cx="40.2" cy="29.3" r="1.4" fill="white" opacity="0.60"/>
    <!-- Efficiency -->
    <circle cx="24"   cy="36"   r="1.4" fill="white" opacity="0.85"/>
    <circle cx="24"   cy="41"   r="1.4" fill="white" opacity="0.60"/>
    <!-- Resources -->
    <circle cx="12.6" cy="27.7" r="1.4" fill="white" opacity="0.85"/>
    <circle cx="7.8"  cy="29.3" r="1.4" fill="white" opacity="0.60"/>
    <!-- Design -->
    <circle cx="16.9" cy="14.3" r="1.4" fill="white" opacity="0.85"/>
    <circle cx="14.0" cy="10.2" r="1.4" fill="white" opacity="0.60"/>

    <!-- ── Center hub — white ring + slate core ───────────────────────── -->
    <circle cx="24" cy="24" r="6.5" fill="white"/>
    <circle cx="24" cy="24" r="2.5" fill="#94a3b8"/>
  </svg>
</template>
