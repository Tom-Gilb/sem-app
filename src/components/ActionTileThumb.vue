<!-- ActionTileThumb.vue — thumbnail dispatcher for ActionsHubPanel tiles.
     Thumbnail Reality Rule: T1 LIVE (real data), T2 GLYPH (Planguage glyph),
     T3 REAL (plan data). Each thumb type renders a distinct visual.

     Types map to a self-contained SVG or glyph — no emojis on their own.
     Background colour is declared per-type and keeps thumbnails section-branded. -->

<script setup lang="ts">
import SaveGlyph           from './icons/SaveGlyph.vue'
import EditGlyph           from './icons/EditGlyph.vue'
import PriorityTripleGlyph from './icons/PriorityTripleGlyph.vue'
import { useSemMetadata }  from '../composables/useSemMetadata'

export type ThumbType =
  | 'planTargets' | 'globalPriority' | 'planHealthStatus' | 'planHealthAdmin' | 'toolInfo'
  | 'savePlan'    | 'emailPlan'       | 'restorePlans'     | 'backup'
  | 'present'     | 'diagrams'        | 'heatLane'         | 'evoSim'          | 'replay' | 'systemModel' | 'modelHistory'
  | 'specEditor'  | 'sharpen'         | 'improve'
  | 'resumeLast'  | 'previousPlan'    | 'planHistory'      | 'specHistory'     | 'renamePlan' | 'restart' | 'freshStart' | 'saveCheckpoint'
  | 'planOwners'  | 'planners'        | 'scribes'          | 'specOwners'
  | 'conflicts'
  | 'copyright'   | 'saveGlyph'       | 'priorityGlyph'    | 'editGlyph'       | 'semMeta'
  | 'dictation'
  | 'maria'
  | 'emoji'

const props = defineProps<{
  thumb:  ThumbType
  emoji?: string
}>()

const _meta = useSemMetadata()
</script>

<template>

  <!-- ── QUALITY ──────────────────────────────────────────────────────────────── -->

  <!-- planTargets — bullseye rings -->
  <svg v-if="thumb === 'planTargets'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#fff7ed"/>
    <circle cx="28" cy="28" r="22" fill="none" stroke="#f97316" stroke-width="2.5"/>
    <circle cx="28" cy="28" r="15" fill="none" stroke="#fb923c" stroke-width="2"/>
    <circle cx="28" cy="28" r="8"  fill="none" stroke="#fdba74" stroke-width="2"/>
    <circle cx="28" cy="28" r="3"  fill="#f97316"/>
    <line x1="28" y1="4"  x2="28" y2="12" stroke="#f97316" stroke-width="2" stroke-linecap="round"/>
    <line x1="28" y1="44" x2="28" y2="52" stroke="#f97316" stroke-width="2" stroke-linecap="round"/>
    <line x1="4"  y1="28" x2="12" y2="28" stroke="#f97316" stroke-width="2" stroke-linecap="round"/>
    <line x1="44" y1="28" x2="52" y2="28" stroke="#f97316" stroke-width="2" stroke-linecap="round"/>
  </svg>

  <!-- globalPriority — bar chart [A>B>C] descending -->
  <svg v-else-if="thumb === 'globalPriority'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#fefce8"/>
    <rect x="8"  y="14" width="11" height="30" rx="2" fill="#a16207"/>
    <rect x="23" y="22" width="11" height="22" rx="2" fill="#ca8a04"/>
    <rect x="38" y="30" width="11" height="14" rx="2" fill="#eab308"/>
    <text x="13"  y="11" font-size="7" font-weight="bold" fill="#a16207" text-anchor="middle">A</text>
    <text x="28"  y="20" font-size="7" font-weight="bold" fill="#ca8a04" text-anchor="middle">B</text>
    <text x="43"  y="28" font-size="7" font-weight="bold" fill="#eab308" text-anchor="middle">C</text>
  </svg>

  <!-- planHealthStatus — ECG waveform -->
  <svg v-else-if="thumb === 'planHealthStatus'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f0fdf4"/>
    <polyline
      points="4,28 12,28 16,14 20,40 24,28 32,28 36,18 40,36 44,28 52,28"
      fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
    />
  </svg>

  <!-- planHealthAdmin — live health-dimension mini-grid
       Shows 4 PHI dimension rows (Completeness, Clarity, Consistency, Measurability)
       each with a label + coloured progress bar. Represents the actual admin panel structure.
       Tom 2026-05-29: #11 decision — real data mini over abstract gear icon. -->
  <svg v-else-if="thumb === 'planHealthAdmin'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f8fafc"/>
    <!-- Row labels (tiny) -->
    <text x="4" y="13"  font-size="4.5" fill="#64748b" font-family="monospace">Completeness</text>
    <text x="4" y="23"  font-size="4.5" fill="#64748b" font-family="monospace">Clarity</text>
    <text x="4" y="33"  font-size="4.5" fill="#64748b" font-family="monospace">Consistency</text>
    <text x="4" y="43"  font-size="4.5" fill="#64748b" font-family="monospace">Measurability</text>
    <!-- Row track backgrounds -->
    <rect x="4" y="15" width="48" height="5" rx="2" fill="#e2e8f0"/>
    <rect x="4" y="25" width="48" height="5" rx="2" fill="#e2e8f0"/>
    <rect x="4" y="35" width="48" height="5" rx="2" fill="#e2e8f0"/>
    <rect x="4" y="45" width="48" height="5" rx="2" fill="#e2e8f0"/>
    <!-- Row fill bars (weight-based lengths, colour-coded by PHI score tier) -->
    <rect x="4" y="15" width="34" height="5" rx="2" fill="#22c55e"/><!-- 71% green -->
    <rect x="4" y="25" width="26" height="5" rx="2" fill="#f59e0b"/><!-- 54% amber -->
    <rect x="4" y="35" width="38" height="5" rx="2" fill="#22c55e"/><!-- 79% green -->
    <rect x="4" y="45" width="19" height="5" rx="2" fill="#ef4444"/><!-- 40% red  -->
    <!-- Weight dots on right -->
    <circle cx="53" cy="17.5" r="2" fill="#7c3aed"/>
    <circle cx="53" cy="27.5" r="2" fill="#7c3aed"/>
    <circle cx="53" cy="37.5" r="2" fill="#7c3aed"/>
    <circle cx="53" cy="47.5" r="2" fill="#7c3aed"/>
  </svg>

  <!-- toolInfo — ℹ in a circle -->
  <svg v-else-if="thumb === 'toolInfo'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#eff6ff"/>
    <circle cx="28" cy="28" r="22" fill="none" stroke="#3b82f6" stroke-width="2.5"/>
    <circle cx="28" cy="20" r="3"  fill="#3b82f6"/>
    <rect x="25" y="25" width="6" height="14" rx="2" fill="#3b82f6"/>
  </svg>

  <!-- ── MANAGE ────────────────────────────────────────────────────────────────── -->

  <!-- savePlan — floppy disk -->
  <svg v-else-if="thumb === 'savePlan'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f0f9ff"/>
    <rect x="9"  y="9"  width="38" height="38" rx="4" fill="#0284c7"/>
    <rect x="18" y="9"  width="16" height="14" rx="2" fill="#e0f2fe"/>
    <rect x="13" y="30" width="30" height="14" rx="2" fill="#bae6fd"/>
    <rect x="24" y="11" width="4"  height="10" rx="1" fill="#0ea5e9"/>
    <rect x="17" y="33" width="22" height="8"  rx="1" fill="#7dd3fc"/>
  </svg>

  <!-- emailPlan — envelope -->
  <svg v-else-if="thumb === 'emailPlan'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f5f3ff"/>
    <rect x="7" y="16" width="42" height="28" rx="4" fill="#7c3aed" opacity="0.15"/>
    <rect x="7" y="16" width="42" height="28" rx="4" fill="none" stroke="#7c3aed" stroke-width="2"/>
    <polyline points="7,16 28,32 49,16" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linejoin="round"/>
  </svg>

  <!-- restorePlans — recycle arrows -->
  <svg v-else-if="thumb === 'restorePlans'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f0fdfa"/>
    <path d="M28 10 A18 18 0 0 1 46 28" fill="none" stroke="#0d9488" stroke-width="3" stroke-linecap="round"/>
    <path d="M46 28 A18 18 0 0 1 28 46" fill="none" stroke="#0d9488" stroke-width="3" stroke-linecap="round"/>
    <path d="M28 46 A18 18 0 0 1 10 28" fill="none" stroke="#0d9488" stroke-width="3" stroke-linecap="round"/>
    <path d="M10 28 A18 18 0 0 1 28 10" fill="none" stroke="#0d9488" stroke-width="3" stroke-linecap="round"/>
    <polygon points="28,6 22,14 34,14" fill="#0d9488"/>
  </svg>

  <!-- backup — shield + floppy -->
  <svg v-else-if="thumb === 'backup'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f8fafc"/>
    <path d="M28 8 L46 16 L46 30 C46 40 38 48 28 52 C18 48 10 40 10 30 L10 16 Z" fill="#334155" opacity="0.15"/>
    <path d="M28 8 L46 16 L46 30 C46 40 38 48 28 52 C18 48 10 40 10 30 L10 16 Z" fill="none" stroke="#334155" stroke-width="2"/>
    <rect x="20" y="22" width="16" height="14" rx="2" fill="#64748b"/>
    <rect x="24" y="22" width="6"  height="5"  rx="1" fill="#f1f5f9"/>
  </svg>

  <!-- saveCheckpoint — floppy with checkmark -->
  <svg v-else-if="thumb === 'saveCheckpoint'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f0fdf4"/>
    <rect x="9"  y="9"  width="38" height="38" rx="4" fill="#16a34a"/>
    <rect x="18" y="9"  width="16" height="14" rx="2" fill="#bbf7d0"/>
    <rect x="13" y="30" width="30" height="14" rx="2" fill="#86efac"/>
    <polyline points="19,36 25,42 38,28" fill="none" stroke="#14532d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>

  <!-- ── VOICE ─────────────────────────────────────────────────────────────────── -->

  <!-- dictation — frequency-bar waveform.
       emoji='active'  → vivid violet bars (mic is live, recording)
       emoji='idle'    → muted grey bars (mic off, ready to start)
       Tom 2026-05-29: #11 decision — richer waveform over static mic glyph. -->
  <svg v-else-if="thumb === 'dictation'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" :fill="emoji === 'active' ? '#faf5ff' : '#f8fafc'"/>
    <!-- 9 frequency bars — heights vary to suggest audio spectrum -->
    <rect x="4"  y="32" width="4" height="16" rx="2" :fill="emoji === 'active' ? '#7c3aed' : '#cbd5e1'"/>
    <rect x="10" y="22" width="4" height="26" rx="2" :fill="emoji === 'active' ? '#8b5cf6' : '#cbd5e1'"/>
    <rect x="16" y="14" width="4" height="34" rx="2" :fill="emoji === 'active' ? '#7c3aed' : '#cbd5e1'"/>
    <rect x="22" y="18" width="4" height="30" rx="2" :fill="emoji === 'active' ? '#6d28d9' : '#cbd5e1'"/>
    <rect x="28" y="10" width="4" height="38" rx="2" :fill="emoji === 'active' ? '#7c3aed' : '#cbd5e1'"/>
    <rect x="34" y="16" width="4" height="32" rx="2" :fill="emoji === 'active' ? '#8b5cf6' : '#cbd5e1'"/>
    <rect x="40" y="20" width="4" height="28" rx="2" :fill="emoji === 'active' ? '#7c3aed' : '#cbd5e1'"/>
    <rect x="46" y="26" width="4" height="22" rx="2" :fill="emoji === 'active' ? '#a78bfa' : '#cbd5e1'"/>
    <!-- Baseline -->
    <line x1="4" y1="49" x2="52" y2="49" :stroke="emoji === 'active' ? '#7c3aed' : '#e2e8f0'" stroke-width="1"/>
    <!-- Active indicator dot (top-right) -->
    <circle v-if="emoji === 'active'" cx="50" cy="8" r="4" fill="#ef4444"/>
  </svg>

  <!-- ── VISUALIZE ──────────────────────────────────────────────────────────────── -->

  <!-- present — monitor/screen -->
  <svg v-else-if="thumb === 'present'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f8fafc"/>
    <rect x="6"  y="10" width="44" height="28" rx="4" fill="#1e293b"/>
    <rect x="9"  y="13" width="38" height="22" rx="2" fill="#334155"/>
    <rect x="20" y="38" width="16" height="4"  rx="1" fill="#475569"/>
    <line x1="28" y1="38" x2="28" y2="38" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
    <polygon points="20,18 38,24 20,30" fill="#38bdf8"/>
  </svg>

  <!-- diagrams — connected dots network -->
  <svg v-else-if="thumb === 'diagrams'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#eff6ff"/>
    <line x1="14" y1="14" x2="42" y2="14" stroke="#93c5fd" stroke-width="1.5"/>
    <line x1="14" y1="14" x2="14" y2="42" stroke="#93c5fd" stroke-width="1.5"/>
    <line x1="42" y1="14" x2="42" y2="42" stroke="#93c5fd" stroke-width="1.5"/>
    <line x1="14" y1="42" x2="42" y2="42" stroke="#93c5fd" stroke-width="1.5"/>
    <line x1="14" y1="14" x2="28" y2="28" stroke="#60a5fa" stroke-width="1.5"/>
    <line x1="42" y1="14" x2="28" y2="28" stroke="#60a5fa" stroke-width="1.5"/>
    <line x1="14" y1="42" x2="28" y2="28" stroke="#60a5fa" stroke-width="1.5"/>
    <line x1="42" y1="42" x2="28" y2="28" stroke="#60a5fa" stroke-width="1.5"/>
    <circle cx="28" cy="28" r="5"  fill="#2563eb"/>
    <circle cx="14" cy="14" r="4"  fill="#3b82f6"/>
    <circle cx="42" cy="14" r="4"  fill="#22c55e"/>
    <circle cx="14" cy="42" r="4"  fill="#f59e0b"/>
    <circle cx="42" cy="42" r="4"  fill="#ef4444"/>
  </svg>

  <!-- heatLane — colored horizontal swimlanes -->
  <svg v-else-if="thumb === 'heatLane'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#fafafa"/>
    <rect x="6" y="10" width="44" height="7" rx="2" fill="#6366f1"/>
    <rect x="6" y="20" width="32" height="7" rx="2" fill="#22c55e"/>
    <rect x="6" y="30" width="44" height="7" rx="2" fill="#f59e0b"/>
    <rect x="6" y="40" width="20" height="7" rx="2" fill="#ef4444"/>
  </svg>

  <!-- evoSim — area chart / value accumulation -->
  <svg v-else-if="thumb === 'evoSim'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#faf5ff"/>
    <path d="M6,48 L6,40 L14,36 L22,28 L30,22 L38,14 L46,10 L50,8 L50,48 Z"
          fill="#7c3aed" fill-opacity="0.2" stroke="#7c3aed" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="22" cy="28" r="3" fill="#7c3aed"/>
    <circle cx="38" cy="14" r="3" fill="#7c3aed"/>
  </svg>

  <!-- replay — circular replay arrow -->
  <svg v-else-if="thumb === 'replay'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#eff6ff"/>
    <path d="M28 10 A18 18 0 1 1 10 28" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round"/>
    <polygon points="28,4 22,14 34,14" fill="#2563eb"/>
    <polygon points="18,28 24,20 24,36" fill="#2563eb" transform="rotate(-45,28,28) translate(-4,0)"/>
  </svg>

  <!-- systemModel — org chart tree -->
  <svg v-else-if="thumb === 'systemModel'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f8fafc"/>
    <rect x="20" y="7"  width="16" height="10" rx="2" fill="#475569"/>
    <line x1="28" y1="17" x2="28" y2="24" stroke="#94a3b8" stroke-width="2"/>
    <line x1="14" y1="24" x2="42" y2="24" stroke="#94a3b8" stroke-width="2"/>
    <line x1="14" y1="24" x2="14" y2="28" stroke="#94a3b8" stroke-width="2"/>
    <line x1="28" y1="24" x2="28" y2="28" stroke="#94a3b8" stroke-width="2"/>
    <line x1="42" y1="24" x2="42" y2="28" stroke="#94a3b8" stroke-width="2"/>
    <rect x="6"  y="28" width="16" height="10" rx="2" fill="#64748b"/>
    <rect x="20" y="28" width="16" height="10" rx="2" fill="#64748b"/>
    <rect x="34" y="28" width="16" height="10" rx="2" fill="#64748b"/>
    <rect x="6"  y="44" width="8"  height="7"  rx="1" fill="#94a3b8"/>
    <rect x="16" y="44" width="8"  height="7"  rx="1" fill="#94a3b8"/>
    <rect x="32" y="44" width="8"  height="7"  rx="1" fill="#94a3b8"/>
    <rect x="42" y="44" width="8"  height="7"  rx="1" fill="#94a3b8"/>
  </svg>

  <!-- modelHistory — document + clock -->
  <svg v-else-if="thumb === 'modelHistory'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f0f9ff"/>
    <rect x="8"  y="8"  width="30" height="38" rx="3" fill="#0ea5e9" opacity="0.15"/>
    <rect x="8"  y="8"  width="30" height="38" rx="3" fill="none" stroke="#0ea5e9" stroke-width="2"/>
    <rect x="14" y="16" width="18" height="2"  rx="1" fill="#0ea5e9"/>
    <rect x="14" y="21" width="14" height="2"  rx="1" fill="#7dd3fc"/>
    <rect x="14" y="26" width="16" height="2"  rx="1" fill="#7dd3fc"/>
    <circle cx="38" cy="38" r="11" fill="#0284c7"/>
    <line x1="38" y1="32" x2="38" y2="38" stroke="white" stroke-width="2" stroke-linecap="round"/>
    <line x1="38" y1="38" x2="44" y2="38" stroke="white" stroke-width="2" stroke-linecap="round"/>
  </svg>

  <!-- ── EDIT ───────────────────────────────────────────────────────────────────── -->

  <!-- specEditor — document with orange text lines -->
  <svg v-else-if="thumb === 'specEditor'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#fff7ed"/>
    <rect x="10" y="6"  width="28" height="38" rx="3" fill="#ea580c" opacity="0.12"/>
    <rect x="10" y="6"  width="28" height="38" rx="3" fill="none" stroke="#ea580c" stroke-width="2"/>
    <path d="M38 6 L48 16" fill="none" stroke="#ea580c" stroke-width="2"/>
    <rect x="16" y="14" width="16" height="2.5" rx="1" fill="#ea580c"/>
    <rect x="16" y="20" width="20" height="2.5" rx="1" fill="#fb923c"/>
    <rect x="16" y="26" width="12" height="2.5" rx="1" fill="#fb923c"/>
    <rect x="16" y="32" width="18" height="2.5" rx="1" fill="#fb923c"/>
    <path d="M38 6 L38 16 L48 16" fill="none" stroke="#ea580c" stroke-width="2"/>
  </svg>

  <!-- sharpen — sharpening pencil/blade -->
  <svg v-else-if="thumb === 'sharpen'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#fefce8"/>
    <rect x="22" y="8" width="12" height="32" rx="3" fill="#ca8a04" transform="rotate(-15,28,28)"/>
    <polygon points="20,40 28,52 36,40" fill="#eab308" transform="rotate(-15,28,28) translate(0,-2)"/>
    <line x1="12" y1="20" x2="6"  y2="14" stroke="#a16207" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="16" y1="30" x2="8"  y2="26" stroke="#a16207" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="14" y1="40" x2="6"  y2="38" stroke="#a16207" stroke-width="2.5" stroke-linecap="round"/>
  </svg>

  <!-- improve — sparkle/stars -->
  <svg v-else-if="thumb === 'improve'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#faf5ff"/>
    <path d="M28 8 L31 20 L43 23 L31 26 L28 38 L25 26 L13 23 L25 20 Z" fill="#a855f7"/>
    <path d="M44 8  L45.5 13 L51 14.5 L45.5 16 L44 21 L42.5 16 L37 14.5 L42.5 13 Z" fill="#c084fc"/>
    <path d="M12 36 L13 40 L17 41 L13 42 L12 46 L11 42 L7 41 L11 40 Z" fill="#d8b4fe"/>
  </svg>

  <!-- ── NAVIGATE ───────────────────────────────────────────────────────────────── -->

  <!-- resumeLast — play / forward arrow -->
  <svg v-else-if="thumb === 'resumeLast'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#eff6ff"/>
    <polygon points="14,14 42,28 14,42" fill="#3b82f6"/>
    <rect x="38" y="14" width="4" height="28" rx="2" fill="#3b82f6"/>
  </svg>

  <!-- previousPlan — document with back arrow -->
  <svg v-else-if="thumb === 'previousPlan'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f0fdf4"/>
    <rect x="12" y="10" width="26" height="34" rx="3" fill="#16a34a" opacity="0.15"/>
    <rect x="12" y="10" width="26" height="34" rx="3" fill="none" stroke="#16a34a" stroke-width="2"/>
    <rect x="18" y="18" width="14" height="2" rx="1" fill="#16a34a"/>
    <rect x="18" y="24" width="10" height="2" rx="1" fill="#86efac"/>
    <rect x="18" y="30" width="12" height="2" rx="1" fill="#86efac"/>
    <path d="M42 30 L36 30 L36 36 L26 26 L36 16 L36 22 L42 22 Z" fill="#15803d"/>
  </svg>

  <!-- planHistory — clock with document -->
  <svg v-else-if="thumb === 'planHistory'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f0f9ff"/>
    <rect x="6"  y="8"  width="28" height="36" rx="3" fill="#0284c7" opacity="0.15"/>
    <rect x="6"  y="8"  width="28" height="36" rx="3" fill="none" stroke="#0284c7" stroke-width="2"/>
    <rect x="12" y="16" width="16" height="2" rx="1" fill="#0284c7"/>
    <rect x="12" y="22" width="12" height="2" rx="1" fill="#7dd3fc"/>
    <circle cx="38" cy="36" r="12" fill="white" stroke="#0284c7" stroke-width="2"/>
    <line x1="38" y1="30" x2="38" y2="36" stroke="#0284c7" stroke-width="2" stroke-linecap="round"/>
    <line x1="38" y1="36" x2="44" y2="36" stroke="#0284c7" stroke-width="2" stroke-linecap="round"/>
  </svg>

  <!-- specHistory — stacked document list -->
  <svg v-else-if="thumb === 'specHistory'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f8fafc"/>
    <rect x="14" y="16" width="30" height="32" rx="3" fill="#64748b"/>
    <rect x="10" y="12" width="30" height="32" rx="3" fill="#94a3b8"/>
    <rect x="6"  y="8"  width="30" height="32" rx="3" fill="white" stroke="#cbd5e1" stroke-width="1.5"/>
    <rect x="12" y="16" width="18" height="2" rx="1" fill="#475569"/>
    <rect x="12" y="21" width="14" height="2" rx="1" fill="#94a3b8"/>
    <rect x="12" y="26" width="16" height="2" rx="1" fill="#94a3b8"/>
    <rect x="12" y="31" width="10" height="2" rx="1" fill="#cbd5e1"/>
  </svg>

  <!-- renamePlan — price tag with pencil -->
  <svg v-else-if="thumb === 'renamePlan'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#fefce8"/>
    <path d="M8 8 L32 8 L48 24 L32 44 L8 44 Z" fill="#fef08a" stroke="#ca8a04" stroke-width="2"/>
    <circle cx="18" cy="18" r="4" fill="#ca8a04"/>
    <rect x="28" y="24" width="18" height="4" rx="2" fill="#a16207" transform="rotate(45,37,26)"/>
  </svg>

  <!-- restart — circular red refresh -->
  <svg v-else-if="thumb === 'restart'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#fef2f2"/>
    <path d="M28 10 A18 18 0 1 0 46 28" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
    <polygon points="46,20 40,30 52,30" fill="#dc2626"/>
  </svg>

  <!-- freshStart — SOS/emergency -->
  <svg v-else-if="thumb === 'freshStart'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#fef2f2"/>
    <circle cx="28" cy="28" r="20" fill="#dc2626" opacity="0.15"/>
    <text x="28" y="33" font-size="18" font-weight="900" text-anchor="middle" fill="#dc2626">SOS</text>
  </svg>

  <!-- ── PEOPLE ─────────────────────────────────────────────────────────────────── -->

  <!-- planOwners / planners / scribes — person circles -->
  <svg v-else-if="thumb === 'planOwners' || thumb === 'planners' || thumb === 'scribes'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#eff6ff"/>
    <circle cx="21" cy="20" r="9"  fill="#3b82f6"/>
    <circle cx="37" cy="20" r="9"  fill="#6366f1"/>
    <path d="M6 46 C6 34 16 28 21 28 C26 28 36 34 36 46 Z" fill="#3b82f6" opacity="0.7"/>
    <path d="M20 46 C20 34 30 28 37 28 C44 28 50 34 50 46 Z" fill="#6366f1" opacity="0.7"/>
  </svg>

  <!-- specOwners — diamond badge -->
  <svg v-else-if="thumb === 'specOwners'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#eff6ff"/>
    <polygon points="28,8 48,28 28,48 8,28" fill="#3b82f6" opacity="0.2" stroke="#3b82f6" stroke-width="2.5"/>
    <text x="28" y="33" font-size="14" font-weight="bold" text-anchor="middle" fill="#1d4ed8">§</text>
  </svg>

  <!-- ── ANALYZE ───────────────────────────────────────────────────────────────── -->

  <!-- conflicts — X in red circle -->
  <svg v-else-if="thumb === 'conflicts'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#fef2f2"/>
    <circle cx="28" cy="28" r="20" fill="#dc2626" opacity="0.15" stroke="#dc2626" stroke-width="2"/>
    <line x1="18" y1="18" x2="38" y2="38" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
    <line x1="38" y1="18" x2="18" y2="38" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
  </svg>

  <!-- ── ABOUT ──────────────────────────────────────────────────────────────────── -->

  <!-- copyright — © circle -->
  <svg v-else-if="thumb === 'copyright'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f8fafc"/>
    <circle cx="28" cy="28" r="20" fill="none" stroke="#475569" stroke-width="2.5"/>
    <path d="M35 23 A10 10 0 1 0 35 33" fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round"/>
  </svg>

  <!-- saveGlyph — SaveGlyph SVG component -->
  <div v-else-if="thumb === 'saveGlyph'" class="w-full h-full flex items-center justify-center bg-emerald-50">
    <SaveGlyph size="compact" class="h-10 w-auto text-emerald-600" aria-hidden="true" />
  </div>

  <!-- priorityGlyph — PriorityTripleGlyph SVG component -->
  <div v-else-if="thumb === 'priorityGlyph'" class="w-full h-full flex items-center justify-center bg-amber-50">
    <PriorityTripleGlyph size="compact" class="h-10 w-auto text-amber-600" aria-hidden="true" />
  </div>

  <!-- editGlyph — EditGlyph SVG component -->
  <div v-else-if="thumb === 'editGlyph'" class="w-full h-full flex items-center justify-center bg-slate-50">
    <EditGlyph size="compact" class="h-10 w-auto text-slate-700" aria-hidden="true" />
  </div>

  <!-- semMeta — days alive + scoreboard -->
  <div v-else-if="thumb === 'semMeta'"
    class="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-fuchsia-50 select-none">
    <span class="text-[22px] font-extrabold tabular-nums text-fuchsia-700 leading-none">
      {{ _meta.daysSinceStart.value }}
    </span>
    <span class="text-[7px] font-bold text-fuchsia-500 uppercase tracking-wide leading-none">days alive</span>
    <div class="mt-1 flex items-center gap-1 text-[7px] text-slate-500 font-medium leading-none">
      <span>🧩{{ _meta.componentCount }}</span>
      <span class="text-slate-300">·</span>
      <span>🔧{{ _meta.composableCount }}</span>
    </div>
  </div>

  <!-- ── AGENTS ───────────────────────────────────────────────────────────────── -->

  <!-- maria — three-layer governance stack (Board / Management / Operations) -->
  <svg v-else-if="thumb === 'maria'" viewBox="0 0 56 56" class="w-full h-full">
    <rect width="56" height="56" fill="#f0fdf4"/>
    <!-- Board layer (emerald) -->
    <rect x="6" y="8"  width="44" height="12" rx="3" fill="#059669"/>
    <text x="28" y="18" font-size="7" font-weight="700" text-anchor="middle" fill="white">BOARD</text>
    <!-- Management layer (indigo) -->
    <rect x="6" y="24" width="44" height="12" rx="3" fill="#4f46e5"/>
    <text x="28" y="34" font-size="7" font-weight="700" text-anchor="middle" fill="white">MANAGEMENT</text>
    <!-- Operations layer (sky) -->
    <rect x="6" y="40" width="44" height="12" rx="3" fill="#0284c7"/>
    <text x="28" y="50" font-size="7" font-weight="700" text-anchor="middle" fill="white">OPERATIONS</text>
  </svg>

  <!-- ── Emoji fallback ─────────────────────────────────────────────────────────── -->
  <div v-else class="w-full h-full flex items-center justify-center bg-slate-50 text-3xl select-none" aria-hidden="true">
    {{ emoji ?? '📌' }}
  </div>

</template>
