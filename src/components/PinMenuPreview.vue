<!--
  PinMenuPreview.vue — Phase 2 hover-preview for pin-menu group buttons.

  Rule 7 Phase 2 (Pin-Menu Rule Part C):
    Each item in the hover preview has its own 40×30 mini-picture thumbnail
    showing what that tool produces when activated.

  Props:
    group      — the step action group {id, emoji, label, items[]}
    direction  — 'down' (default, preview below button) | 'up' (preview above)

  Usage in EvoPlanView.vue:
    <PinMenuPreview
      v-if="hoveredStepGroup === `step-${index}-${group.id}` && !isStepMenuOpen(index, group.id)"
      :group="group"
      class="absolute left-0 top-full mt-1 z-40"
    />

  Thumbnail Reality Rule: every 40×30 SVG must be a recognisable mini-render
  of what that tool looks like when activated — not a cartoon icon.
  UPDATE THUMBNAILS if any tool's primary display changes substantially.
-->

<script setup lang="ts">
// UNIT_TYPE=Component

interface StepActionItem {
  label: string
  emoji: string
  isActive: () => boolean
  badge?: () => number
}

interface StepActionGroup {
  id: string
  emoji: string
  label: string
  items: StepActionItem[]
}

withDefaults(defineProps<{
  group: StepActionGroup
  direction?: 'up' | 'down'
}>(), {
  direction: 'down',
})

/** Accent colour per group — header strip colour. */
const GROUP_HEADER_BG: Record<string, string> = {
  analyze:      'bg-indigo-700',
  presentation: 'bg-slate-700',
  visualize:    'bg-sky-800',
  simplify:     'bg-emerald-800',
  criticize:    'bg-rose-800',
}
</script>

<template>
  <!-- pointer-events-none: preview is a peek — not navigable -->
  <div
    class="pointer-events-none absolute left-0 z-40"
    :class="direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-1'"
    aria-hidden="true"
  >
    <div
      class="rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/8 overflow-hidden"
      style="min-width: 220px"
    >
      <!-- Group header strip -->
      <div
        class="flex items-center justify-between px-3 py-2 text-xs font-bold text-white"
        :class="GROUP_HEADER_BG[group.id] ?? 'bg-slate-700'"
      >
        <span>{{ group.emoji }} {{ group.label }}</span>
        <span class="text-[9px] opacity-70 font-normal">{{ group.items.length }} actions</span>
      </div>

      <!-- Item rows with sub-item thumbnails -->
      <div class="py-1 divide-y divide-slate-50">
        <div
          v-for="item in group.items"
          :key="item.label"
          class="flex items-center gap-2 px-2 py-1.5"
        >
          <!-- 40×30 thumbnail — UPDATE THIS if tool display changes -->
          <div
            class="shrink-0 rounded overflow-hidden ring-1 ring-slate-200 bg-slate-50"
            style="width:40px;height:30px"
          >

            <!-- ── ANALYZE GROUP ─────────────────────────────────────────── -->

            <!-- Definition of Done — checklist mini -->
            <svg v-if="item.label === 'Definition of Done'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#eef2ff"/>
              <rect x="4" y="5" width="32" height="5" rx="1" fill="white" stroke="#6366f1" stroke-width="0.75"/>
              <path d="M6.5 7.5 L8 9 L10.5 6" stroke="#6366f1" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="13" y="7" width="18" height="1.5" rx="0.5" fill="#4338ca"/>
              <rect x="4" y="13" width="32" height="5" rx="1" fill="white" stroke="#6366f1" stroke-width="0.75"/>
              <path d="M6.5 15.5 L8 17 L10.5 14" stroke="#6366f1" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="13" y="15" width="14" height="1.5" rx="0.5" fill="#4338ca"/>
              <rect x="4" y="21" width="32" height="5" rx="1" fill="white" stroke="#a5b4fc" stroke-width="0.75"/>
              <rect x="6.5" y="22.5" width="3" height="3" rx="0.5" fill="none" stroke="#a5b4fc" stroke-width="0.75"/>
              <rect x="13" y="23" width="16" height="1.5" rx="0.5" fill="#a5b4fc"/>
            </svg>

            <!-- Definition of Ready — readiness traffic light -->
            <svg v-else-if="item.label === 'Definition of Ready'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#f0fdf4"/>
              <rect x="14" y="3" width="12" height="24" rx="3" fill="#1e293b"/>
              <circle cx="20" cy="9"  r="3.5" fill="#ef4444"/>
              <circle cx="20" cy="15" r="3.5" fill="#f59e0b"/>
              <circle cx="20" cy="21" r="3.5" fill="#22c55e"/>
              <rect x="3"  y="13.5" width="8" height="1.5" rx="0.5" fill="#22c55e"/>
              <rect x="29" y="13.5" width="8" height="1.5" rx="0.5" fill="#22c55e"/>
            </svg>

            <!-- Acceptance Tests — pass/fail test table -->
            <svg v-else-if="item.label === 'Acceptance Tests'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#faf5ff"/>
              <rect x="3" y="4" width="34" height="5" rx="1" fill="#7c3aed" opacity="0.15"/>
              <rect x="3" y="4" width="34" height="5" rx="1" fill="none" stroke="#7c3aed" stroke-width="0.75"/>
              <text x="6" y="8" font-size="3.5" fill="#5b21b6" font-weight="bold">Test</text>
              <text x="28" y="8" font-size="3.5" fill="#5b21b6" font-weight="bold">Result</text>
              <rect x="3" y="11" width="34" height="4" rx="0.5" fill="white" stroke="#e9d5ff" stroke-width="0.5"/>
              <text x="6"  y="14" font-size="3" fill="#374151">Login flow</text>
              <rect x="29" y="12" width="6" height="2.5" rx="0.5" fill="#16a34a"/>
              <text x="32" y="14" font-size="3" text-anchor="middle" fill="white" font-weight="bold">✓</text>
              <rect x="3" y="17" width="34" height="4" rx="0.5" fill="white" stroke="#e9d5ff" stroke-width="0.5"/>
              <text x="6"  y="20" font-size="3" fill="#374151">Data export</text>
              <rect x="29" y="18" width="6" height="2.5" rx="0.5" fill="#16a34a"/>
              <text x="32" y="20" font-size="3" text-anchor="middle" fill="white" font-weight="bold">✓</text>
              <rect x="3" y="23" width="34" height="4" rx="0.5" fill="white" stroke="#e9d5ff" stroke-width="0.5"/>
              <text x="6"  y="26" font-size="3" fill="#374151">API rate…</text>
              <rect x="29" y="24" width="6" height="2.5" rx="0.5" fill="#f59e0b"/>
              <text x="32" y="26" font-size="3" text-anchor="middle" fill="white" font-weight="bold">?</text>
            </svg>

            <!-- Learning Outcomes — numbered outcome list -->
            <svg v-else-if="item.label === 'Learning Outcomes'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#fffbeb"/>
              <circle cx="7" cy="8" r="3" fill="#d97706"/>
              <text x="7" y="10" font-size="4" text-anchor="middle" fill="white" font-weight="bold">1</text>
              <rect x="13" y="6.5" width="22" height="2" rx="0.5" fill="#92400e"/>
              <rect x="13" y="10" width="16" height="1.5" rx="0.5" fill="#d97706" opacity="0.5"/>
              <circle cx="7" cy="17" r="3" fill="#d97706"/>
              <text x="7" y="19" font-size="4" text-anchor="middle" fill="white" font-weight="bold">2</text>
              <rect x="13" y="15.5" width="20" height="2" rx="0.5" fill="#92400e"/>
              <rect x="13" y="19"   width="13" height="1.5" rx="0.5" fill="#d97706" opacity="0.5"/>
              <circle cx="7" cy="26" r="3" fill="#f5d27a"/>
              <text x="7" y="28" font-size="4" text-anchor="middle" fill="#92400e" font-weight="bold">3</text>
              <rect x="13" y="24.5" width="18" height="2" rx="0.5" fill="#d97706" opacity="0.5"/>
            </svg>

            <!-- T-Shaped Skills — T-shape bar diagram -->
            <svg v-else-if="item.label === 'T-Shaped Skills'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#f0f9ff"/>
              <!-- Horizontal bar (breadth) -->
              <rect x="3" y="6" width="34" height="6" rx="1.5" fill="#0284c7" opacity="0.8"/>
              <!-- Vertical bar (depth) -->
              <rect x="16" y="6" width="8" height="20" rx="1.5" fill="#0369a1"/>
              <text x="20" y="5" font-size="3" text-anchor="middle" fill="#0c4a6e">Breadth</text>
              <text x="32" y="28" font-size="3" fill="#0c4a6e">Depth</text>
            </svg>

            <!-- Cognitive Load — load meter bars -->
            <svg v-else-if="item.label === 'Cognitive Load'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#fef2f2"/>
              <text x="20" y="8" font-size="4" text-anchor="middle" fill="#7f1d1d" font-weight="600">Load Meter</text>
              <rect x="4" y="11" width="32" height="6" rx="2" fill="#fecaca"/>
              <rect x="4" y="11" width="22" height="6" rx="2" fill="#ef4444" opacity="0.75"/>
              <text x="20" y="15.5" font-size="3.5" text-anchor="middle" fill="#7f1d1d" font-weight="bold">68%</text>
              <text x="4" y="24" font-size="3" fill="#991b1b">Low</text>
              <text x="30" y="24" font-size="3" fill="#991b1b">High</text>
              <rect x="4"  y="26" width="3" height="1.5" rx="0.5" fill="#22c55e"/>
              <rect x="10" y="26" width="3" height="1.5" rx="0.5" fill="#f59e0b"/>
              <rect x="16" y="26" width="3" height="1.5" rx="0.5" fill="#f59e0b"/>
              <rect x="22" y="26" width="3" height="1.5" rx="0.5" fill="#ef4444"/>
              <rect x="28" y="26" width="3" height="1.5" rx="0.5" fill="#dc2626"/>
              <rect x="34" y="26" width="3" height="1.5" rx="0.5" fill="#991b1b"/>
            </svg>

            <!-- ── PRESENTATION GROUP ────────────────────────────────────── -->

            <!-- Daily Standup — Yesterday / Today / Blockers columns -->
            <svg v-else-if="item.label === 'Daily Standup'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#f8fafc"/>
              <rect x="2"  y="2"  width="11" height="26" rx="1.5" fill="#0f172a" opacity="0.06"/>
              <rect x="15" y="2"  width="11" height="26" rx="1.5" fill="#0f172a" opacity="0.06"/>
              <rect x="28" y="2"  width="11" height="26" rx="1.5" fill="#0f172a" opacity="0.06"/>
              <text x="7"  y="7" font-size="2.8" text-anchor="middle" fill="#475569" font-weight="bold">YDA</text>
              <text x="20" y="7" font-size="2.8" text-anchor="middle" fill="#475569" font-weight="bold">TODAY</text>
              <text x="33" y="7" font-size="2.8" text-anchor="middle" fill="#b91c1c" font-weight="bold">BLK</text>
              <rect x="3"  y="9"  width="9" height="2" rx="0.5" fill="#64748b" opacity="0.5"/>
              <rect x="3"  y="13" width="7" height="2" rx="0.5" fill="#64748b" opacity="0.4"/>
              <rect x="16" y="9"  width="9" height="2" rx="0.5" fill="#3b82f6" opacity="0.7"/>
              <rect x="16" y="13" width="6" height="2" rx="0.5" fill="#3b82f6" opacity="0.5"/>
              <rect x="16" y="17" width="8" height="2" rx="0.5" fill="#3b82f6" opacity="0.4"/>
              <rect x="29" y="9"  width="8" height="2" rx="0.5" fill="#ef4444" opacity="0.6"/>
            </svg>

            <!-- Meeting Agenda — time-slotted agenda list -->
            <svg v-else-if="item.label === 'Meeting Agenda'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#f8fafc"/>
              <rect x="2" y="2" width="36" height="5" rx="1" fill="#0f172a" opacity="0.75"/>
              <text x="20" y="5.8" font-size="3.2" text-anchor="middle" fill="white" font-weight="bold">Meeting Agenda</text>
              <rect x="2" y="9" width="7" height="4" rx="0.75" fill="#e0f2fe"/>
              <text x="5.5" y="12" font-size="3" text-anchor="middle" fill="#0369a1" font-weight="bold">9:00</text>
              <rect x="11" y="9" width="27" height="4" rx="0.75" fill="none" stroke="#e2e8f0" stroke-width="0.75"/>
              <rect x="13" y="10.5" width="18" height="1.5" rx="0.5" fill="#334155"/>
              <rect x="2"  y="15" width="7"  height="4" rx="0.75" fill="#e0f2fe"/>
              <text x="5.5" y="18" font-size="3" text-anchor="middle" fill="#0369a1" font-weight="bold">9:20</text>
              <rect x="11" y="15" width="27" height="4" rx="0.75" fill="none" stroke="#e2e8f0" stroke-width="0.75"/>
              <rect x="13" y="16.5" width="22" height="1.5" rx="0.5" fill="#334155"/>
              <rect x="2"  y="21" width="7"  height="4" rx="0.75" fill="#e0f2fe"/>
              <text x="5.5" y="24" font-size="3" text-anchor="middle" fill="#0369a1" font-weight="bold">9:40</text>
              <rect x="11" y="21" width="27" height="4" rx="0.75" fill="none" stroke="#e2e8f0" stroke-width="0.75"/>
              <rect x="13" y="22.5" width="15" height="1.5" rx="0.5" fill="#334155"/>
            </svg>

            <!-- Step Review — review checklist -->
            <svg v-else-if="item.label === 'Step Review'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#f0fdf4"/>
              <rect x="3" y="3" width="34" height="4" rx="1" fill="#15803d" opacity="0.15"/>
              <text x="20" y="6.5" font-size="3.2" text-anchor="middle" fill="#166534" font-weight="bold">Step Review</text>
              <path d="M5 13 L7.5 15.5 L11 10" stroke="#16a34a" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="14" y="11.5" width="22" height="2" rx="0.5" fill="#166534"/>
              <path d="M5 20 L7.5 22.5 L11 17" stroke="#16a34a" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="14" y="18.5" width="18" height="2" rx="0.5" fill="#166534"/>
              <rect x="5"  y="24"   width="5"  height="3"  rx="0.5" fill="none" stroke="#86efac" stroke-width="0.75"/>
              <rect x="14" y="25"   width="16" height="1.5" rx="0.5" fill="#86efac"/>
            </svg>

            <!-- Team Mood — mood scale with dot positions -->
            <svg v-else-if="item.label === 'Team Mood'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#fef9c3"/>
              <text x="20" y="8" font-size="3.5" text-anchor="middle" fill="#713f12" font-weight="600">Team Mood</text>
              <!-- Mood scale bar -->
              <rect x="4" y="12" width="32" height="5" rx="2.5" fill="url(#moodGrad)"/>
              <defs>
                <linearGradient id="moodGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stop-color="#ef4444"/>
                  <stop offset="50%"  stop-color="#f59e0b"/>
                  <stop offset="100%" stop-color="#22c55e"/>
                </linearGradient>
              </defs>
              <!-- Current team position dot -->
              <circle cx="28" cy="14.5" r="3" fill="white" stroke="#713f12" stroke-width="1"/>
              <circle cx="28" cy="14.5" r="1.5" fill="#16a34a"/>
              <text x="4"  y="24" font-size="3" fill="#991b1b">😟</text>
              <text x="17" y="24" font-size="3" fill="#92400e">😐</text>
              <text x="31" y="24" font-size="3" fill="#166534">😊</text>
            </svg>

            <!-- ── VISUALIZE GROUP ───────────────────────────────────────── -->

            <!-- Diagrams & Visuals — mini value flow diagram -->
            <svg v-else-if="item.label === 'Diagrams &amp; Visuals' || item.label === 'Diagrams & Visuals'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#f0f9ff"/>
              <!-- Flow nodes -->
              <rect x="2"  y="12" width="8" height="6" rx="1.5" fill="#0369a1"/>
              <rect x="16" y="8"  width="8" height="6" rx="1.5" fill="#0369a1" opacity="0.85"/>
              <rect x="16" y="16" width="8" height="6" rx="1.5" fill="#0369a1" opacity="0.7"/>
              <rect x="30" y="12" width="8" height="6" rx="1.5" fill="#0369a1" opacity="0.9"/>
              <!-- Arrows -->
              <path d="M10 15 L16 11" stroke="#0369a1" stroke-width="1" fill="none" marker-end="url(#arrowB)"/>
              <path d="M10 15 L16 19" stroke="#0369a1" stroke-width="1" fill="none"/>
              <path d="M24 11 L30 15" stroke="#0369a1" stroke-width="1" fill="none"/>
              <path d="M24 19 L30 15" stroke="#0369a1" stroke-width="1" fill="none"/>
            </svg>

            <!-- Swimlane View — horizontal swim lanes -->
            <svg v-else-if="item.label === 'Swimlane View'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#f8fafc"/>
              <!-- Lane separators -->
              <rect x="0" y="0"  width="8"  height="30" fill="#0f172a" opacity="0.08"/>
              <line x1="0" y1="10" x2="40" y2="10" stroke="#cbd5e1" stroke-width="0.75"/>
              <line x1="0" y1="20" x2="40" y2="20" stroke="#cbd5e1" stroke-width="0.75"/>
              <text x="4"  y="6"  font-size="2.5" text-anchor="middle" fill="#334155" font-weight="bold">A</text>
              <text x="4"  y="16" font-size="2.5" text-anchor="middle" fill="#334155" font-weight="bold">B</text>
              <text x="4"  y="26" font-size="2.5" text-anchor="middle" fill="#334155" font-weight="bold">C</text>
              <!-- Tasks -->
              <rect x="10" y="2"  width="10" height="6" rx="1" fill="#3b82f6" opacity="0.7"/>
              <rect x="23" y="2"  width="8"  height="6" rx="1" fill="#3b82f6" opacity="0.5"/>
              <rect x="10" y="12" width="14" height="6" rx="1" fill="#8b5cf6" opacity="0.7"/>
              <rect x="10" y="22" width="8"  height="6" rx="1" fill="#f59e0b" opacity="0.7"/>
              <rect x="22" y="22" width="12" height="6" rx="1" fill="#f59e0b" opacity="0.5"/>
            </svg>

            <!-- Evo Simulator — step progress track -->
            <svg v-else-if="item.label === 'Evo Simulator'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#0f172a"/>
              <text x="20" y="8" font-size="3.2" text-anchor="middle" fill="#7dd3fc" font-weight="bold">EVO SIMULATOR</text>
              <!-- Step track -->
              <circle cx="7"  cy="16" r="3.5" fill="#22c55e"/>
              <line x1="10.5" y1="16" x2="16.5" y2="16" stroke="#22c55e" stroke-width="1.5"/>
              <circle cx="20" cy="16" r="3.5" fill="#22c55e"/>
              <line x1="23.5" y1="16" x2="29.5" y2="16" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="2,1"/>
              <circle cx="33" cy="16" r="3.5" fill="#334155" stroke="#64748b" stroke-width="1"/>
              <text x="7"  y="18.5" font-size="3.5" text-anchor="middle" fill="white">1</text>
              <text x="20" y="18.5" font-size="3.5" text-anchor="middle" fill="white">2</text>
              <text x="33" y="18.5" font-size="3.5" text-anchor="middle" fill="#64748b">3</text>
              <text x="20" y="27" font-size="3" text-anchor="middle" fill="#7dd3fc">▶ Running</text>
            </svg>

            <!-- ── SIMPLIFY GROUP ────────────────────────────────────────── -->

            <!-- Pair Programming — two code columns -->
            <svg v-else-if="item.label === 'Pair Programming'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#0f172a"/>
              <!-- Left dev panel -->
              <rect x="1" y="3" width="18" height="24" rx="1.5" fill="#1e293b"/>
              <rect x="3" y="6" width="7"  height="1.5" rx="0.5" fill="#7dd3fc" opacity="0.8"/>
              <rect x="3" y="9" width="12" height="1" rx="0.5" fill="#64748b"/>
              <rect x="3" y="12" width="9"  height="1" rx="0.5" fill="#64748b"/>
              <rect x="3" y="15" width="13" height="1" rx="0.5" fill="#a78bfa"/>
              <rect x="3" y="18" width="8"  height="1" rx="0.5" fill="#64748b"/>
              <!-- Divider -->
              <line x1="20" y1="0" x2="20" y2="30" stroke="#0f172a" stroke-width="1.5"/>
              <!-- Right dev panel -->
              <rect x="21" y="3" width="18" height="24" rx="1.5" fill="#1e293b"/>
              <rect x="23" y="6" width="5"  height="1.5" rx="0.5" fill="#34d399" opacity="0.8"/>
              <rect x="23" y="9" width="10" height="1" rx="0.5" fill="#64748b"/>
              <rect x="23" y="12" width="13" height="1" rx="0.5" fill="#64748b"/>
              <rect x="23" y="15" width="7"  height="1" rx="0.5" fill="#fbbf24"/>
              <rect x="23" y="18" width="11" height="1" rx="0.5" fill="#64748b"/>
            </svg>

            <!-- Mob Programming — shared screen with group -->
            <svg v-else-if="item.label === 'Mob Programming'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#1e293b"/>
              <!-- Screen -->
              <rect x="4" y="2" width="32" height="18" rx="2" fill="#0f172a" stroke="#3b82f6" stroke-width="0.75"/>
              <rect x="6" y="4" width="5"  height="1.5" rx="0.5" fill="#7dd3fc"/>
              <rect x="6" y="7" width="24" height="1" rx="0.5" fill="#475569"/>
              <rect x="6" y="10" width="18" height="1" rx="0.5" fill="#475569"/>
              <rect x="6" y="13" width="22" height="1" rx="0.5" fill="#a78bfa"/>
              <!-- Stand (monitor base) -->
              <rect x="18" y="20" width="4" height="3" rx="0.5" fill="#334155"/>
              <rect x="13" y="23" width="14" height="2" rx="0.5" fill="#334155"/>
              <!-- Group members below -->
              <circle cx="10" cy="27" r="2" fill="#3b82f6"/>
              <circle cx="20" cy="27" r="2" fill="#6366f1"/>
              <circle cx="30" cy="27" r="2" fill="#0ea5e9"/>
            </svg>

            <!-- ── CRITICIZE GROUP ───────────────────────────────────────── -->

            <!-- Risk Mitigation — 2×2 risk matrix -->
            <svg v-else-if="item.label === 'Risk Mitigation'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#fff7ed"/>
              <text x="20" y="6" font-size="3" text-anchor="middle" fill="#7c2d12" font-weight="bold">Risk Matrix</text>
              <!-- 2x2 grid -->
              <rect x="4"  y="8"  width="15" height="10" rx="1" fill="#fecdd3"/>
              <rect x="21" y="8"  width="15" height="10" rx="1" fill="#fee2e2"/>
              <rect x="4"  y="20" width="15" height="8"  rx="1" fill="#fef9c3"/>
              <rect x="21" y="20" width="15" height="8"  rx="1" fill="#dcfce7"/>
              <text x="11.5" y="13" font-size="3" text-anchor="middle" fill="#9f1239" font-weight="bold">HIGH</text>
              <text x="28.5" y="13" font-size="3" text-anchor="middle" fill="#b91c1c">MED</text>
              <text x="11.5" y="24" font-size="3" text-anchor="middle" fill="#713f12">LOW</text>
              <text x="28.5" y="24" font-size="3" text-anchor="middle" fill="#166534">MIN</text>
              <!-- Probability / Impact labels -->
              <text x="20" y="7.5" font-size="2" text-anchor="middle" fill="#9a3412" opacity="0.5">← Impact →</text>
            </svg>

            <!-- Blockers — blocked card list -->
            <svg v-else-if="item.label === 'Blockers'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#fff1f2"/>
              <rect x="3" y="3" width="34" height="7" rx="1.5" fill="#fecdd3" stroke="#fda4af" stroke-width="0.75"/>
              <circle cx="8"  cy="6.5" r="2.5" fill="#ef4444"/>
              <line x1="6.5" y1="6.5" x2="9.5" y2="6.5" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
              <rect x="13" y="5"   width="20" height="1.5" rx="0.5" fill="#9f1239"/>
              <rect x="13" y="7.5" width="14" height="1"   rx="0.5" fill="#fb7185" opacity="0.7"/>
              <rect x="3" y="13" width="34" height="7" rx="1.5" fill="#fecdd3" stroke="#fda4af" stroke-width="0.75"/>
              <circle cx="8"  cy="16.5" r="2.5" fill="#ef4444"/>
              <line x1="6.5" y1="16.5" x2="9.5" y2="16.5" stroke="white" stroke-width="1.2" stroke-linecap="round"/>
              <rect x="13" y="15"   width="16" height="1.5" rx="0.5" fill="#9f1239"/>
              <rect x="13" y="17.5" width="10" height="1"   rx="0.5" fill="#fb7185" opacity="0.7"/>
              <text x="20" y="28" font-size="3" text-anchor="middle" fill="#e11d48" font-weight="bold">2 active blockers</text>
            </svg>

            <!-- Retrospective — 4-column retro board -->
            <svg v-else-if="item.label === 'Retrospective'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#f8fafc"/>
              <!-- Column headers -->
              <rect x="1"  y="2" width="8.5" height="4" rx="0.75" fill="#22c55e" opacity="0.8"/>
              <rect x="11" y="2" width="8.5" height="4" rx="0.75" fill="#ef4444" opacity="0.8"/>
              <rect x="21" y="2" width="8.5" height="4" rx="0.75" fill="#3b82f6" opacity="0.8"/>
              <rect x="31" y="2" width="8.5" height="4" rx="0.75" fill="#f59e0b" opacity="0.8"/>
              <text x="5.25"  y="5.5" font-size="2.2" text-anchor="middle" fill="white" font-weight="bold">START</text>
              <text x="15.25" y="5.5" font-size="2.2" text-anchor="middle" fill="white" font-weight="bold">STOP</text>
              <text x="25.25" y="5.5" font-size="2.2" text-anchor="middle" fill="white" font-weight="bold">CONT</text>
              <text x="35.25" y="5.5" font-size="2.2" text-anchor="middle" fill="white" font-weight="bold">EXP</text>
              <!-- Cards -->
              <rect x="1"  y="8"  width="8.5" height="5" rx="0.75" fill="#dcfce7" stroke="#86efac" stroke-width="0.5"/>
              <rect x="1"  y="15" width="8.5" height="5" rx="0.75" fill="#dcfce7" stroke="#86efac" stroke-width="0.5"/>
              <rect x="11" y="8"  width="8.5" height="5" rx="0.75" fill="#fee2e2" stroke="#fca5a5" stroke-width="0.5"/>
              <rect x="21" y="8"  width="8.5" height="5" rx="0.75" fill="#dbeafe" stroke="#93c5fd" stroke-width="0.5"/>
              <rect x="21" y="15" width="8.5" height="5" rx="0.75" fill="#dbeafe" stroke="#93c5fd" stroke-width="0.5"/>
              <rect x="31" y="8"  width="8.5" height="5" rx="0.75" fill="#fef9c3" stroke="#fde68a" stroke-width="0.5"/>
            </svg>

            <!-- Technical Spike — spike analysis card -->
            <svg v-else-if="item.label === 'Technical Spike'" viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#fefce8"/>
              <rect x="3" y="2" width="34" height="6" rx="1.5" fill="#ca8a04"/>
              <text x="20" y="6.5" font-size="3.5" text-anchor="middle" fill="white" font-weight="bold">⚡ Tech Spike</text>
              <text x="5" y="14" font-size="3" fill="#713f12" font-weight="600">Question:</text>
              <rect x="5" y="15" width="30" height="2" rx="0.5" fill="#d97706" opacity="0.4"/>
              <rect x="5" y="18.5" width="22" height="2" rx="0.5" fill="#d97706" opacity="0.3"/>
              <text x="5" y="26" font-size="3" fill="#713f12" font-weight="600">Timebox: </text>
              <rect x="22" y="24" width="14" height="3" rx="1" fill="#fbbf24" opacity="0.5"/>
              <text x="29" y="26.5" font-size="3" text-anchor="middle" fill="#92400e">2 days</text>
            </svg>

            <!-- Fallback — generic mini label for unknown item labels -->
            <svg v-else viewBox="0 0 40 30" class="w-full h-full">
              <rect width="40" height="30" fill="#f1f5f9"/>
              <text x="20" y="17" font-size="12" text-anchor="middle" dominant-baseline="middle" aria-hidden="true">{{ item.emoji }}</text>
            </svg>

          </div>

          <!-- Label row -->
          <span class="text-xs text-slate-700 flex-1 leading-tight truncate">{{ item.label }}</span>

          <!-- Active dot -->
          <span
            v-if="item.isActive()"
            class="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"
            aria-hidden="true"
          />

          <!-- Count badge (Blockers / Spike) -->
          <span
            v-if="item.badge && item.badge() > 0"
            class="h-4 min-w-[1rem] px-1 flex items-center justify-center text-[9px] bg-red-500 text-white rounded-full shrink-0"
            aria-hidden="true"
          >{{ item.badge() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
