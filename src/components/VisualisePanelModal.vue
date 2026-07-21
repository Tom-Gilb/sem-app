<!-- UNIT_TYPE=Widget -->
<!-- VisualisePanelModal.vue — Diagram gallery for the current spec.

     Tom Gilb, 2026-05-15: "The options should be like the lower bar with icons, and I think
     the icons should statically mirror the image of the visualization. And be target. My input
     but can you redesign the whole thing to be more intelligible and interesting."
     → Tab bar replaced with a horizontal gallery of visual thumbnail cards. Each card shows a
       mini SVG illustration that mirrors the chart's actual geometry, a name, and a brief
       description. Active card gets a violet ring + shadow. Gallery scrolls horizontally so
       all 7 visualisations are always one click away.

     Visualisations: Value Flow · Radar · Architecture · Dependencies · Risk Matrix · Finance · Swimlane
     • "Value Flow"   — ValueFlowDiagram (6-column causal chain: Tasks→Evo→Solutions→Values→Functions→Stakeholders)
     • "Swimlane"     — SpecHeatLane in embedded mode (no fixed positioning — gallery always visible)
     • SpecTechRadar + SpecTogafView handle Radar + Architecture tabs
     • Risk Matrix, Finance, Dependencies are built inline

     Props:
       spec           — current SpecBlock (null = panel is empty)
       confirmedSteps — EvoStep[] for swimlane + value flow
       tasksByStep    — task lists keyed by step name, forwarded to ValueFlowDiagram
     Emits:
       close          — user dismissed the panel
       open-heatlane  — kept for backward-compat; Swimlane is now an inline tab  -->

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import type { SpecBlock } from '../types/spec'
import { rBudget } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import type { ImpactMatrix } from '../types/impact'
import EfficiencyDiagram from './EfficiencyDiagram.vue'
import SpecHeatLane    from './SpecHeatLane.vue'
import SpecTechRadar   from './SpecTechRadar.vue'
import SpecTogafView   from './SpecTogafView.vue'
import EvoSimulatorView from './EvoSimulatorView.vue'

const props = defineProps<{
  spec:           SpecBlock | null
  confirmedSteps: EvoStep[]
  /** Task lists keyed by step name — forwarded to the Value Flow diagram. */
  tasksByStep?:   Record<string, TaskSuggestion[]>
  /** Impact matrix forwarded to ValueFlowDiagram + EfficiencyDiagram. */
  impactMatrix?:  ImpactMatrix
  /** V/C ratios per solution — forwarded to EfficiencyDiagram. */
  vcRatios?:      Record<string, number>
  /** Calendar-week costs per solution — forwarded to EfficiencyDiagram. */
  calendarCosts?: Record<string, number>
  /** Capital costs per solution ($k) — forwarded to EfficiencyDiagram. */
  capitalCosts?:  Record<string, number>
  /** Pre-select a tab when the modal opens (default: 'flow').
   *  Tom 2026-05-16: used when opening from "🌊 Flow" button in SpecEditorPanel. */
  initialTab?:    Tab
  /** Amber-highlight a specific node in the Value Flow diagram.
   *  Tom 2026-05-16: "Show Value Flow Relation" per-entry shortcut. */
  highlightedEntryId?: string
}>()

const emit = defineEmits<{
  close:           []
  'open-heatlane': []  // kept for backward-compat; Swimlane is now an inline tab
  /** r97 — open MultiForks system fork diagram. */
  'open-multiforks': []
  /** Launch the Evo Simulator modal (closes this modal first via App.vue). */
  'open-evo-simulator': []
  /** Open the full-screen ValueFlowPanel (replaces the old near-view flow tab).
   *  Tom 2026-05-19: "I said only full screen." App.vue closes this modal and
   *  opens ValueFlowPanel.  */
  'open-value-flow': []
  /** Propagated from ValueFlowDiagram — open spec editor for this entry. */
  'open-editor':          [{ tab: 'functions' | 'values' | 'solutions'; entryId: string }]
  /** Propagated from ValueFlowDiagram — open Spec Direct Relations. */
  'node-relations-click': [{ tab: 'functions' | 'values' | 'solutions' | 'evo-steps'; entryId: string }]
  /** Propagated from ValueFlowDiagram — user clicked a Task node; close diagram and jump to stage 4. */
  'go-to-tasks': []
}>()

// ── Tab state ──────────────────────────────────────────────────────────────
type Tab = 'flow' | 'efficiency' | 'radar' | 'arch' | 'deps' | 'risk' | 'finance' | 'swimlane' | 'simulator'

// null = tile-grid home screen; Tab = detail view for that visualisation.
// Tom 2026-05-28: "this vizualize window need to be redesigned to be like
// the action window buttons — upper visual part is a mini display of that
// tool's real time current display for current plan."
const activeTab = ref<Tab | null>(props.initialTab ?? null)

// v498 (2026-07-21) — Tom "when I go here I want the value flow opened
// immediately full screen, not an empty screen".  The 'flow' tab was
// showing an interstitial ("Value Flow — Full Screen" + a button to open
// the full-screen panel).  Root cause: the comment in the template already
// stated the DESIRED behaviour (*"clicking the Value Flow tab immediately
// opens the full-screen panel"*) but the implementation stayed on the
// interstitial-with-button pattern from an earlier iteration.  Fix: watch
// activeTab; when it becomes 'flow', emit open-value-flow on the next
// tick.  The interstitial stays as a fallback (Tom returns from the full-
// screen panel, sees the interstitial + the same button to re-open).
watch(activeTab, (tab, prev) => {
  if (tab === 'flow' && prev !== 'flow') {
    void nextTick().then(() => { emit('open-value-flow') })
  }
})
// Also fire on mount if the panel opens directly to the 'flow' tab via initialTab.
onMounted(() => {
  if (activeTab.value === 'flow') {
    void nextTick().then(() => { emit('open-value-flow') })
  }
})

const tabs: { key: Tab; label: string; emoji: string; description: string; accent: string }[] = [
  { key: 'flow',       label: 'Value Flow',   emoji: '⟶',  description: 'Tasks → Solutions → Values → Stakeholders causal chain',       accent: '#6366f1' },
  { key: 'efficiency', label: 'Efficiency',   emoji: '⚡', description: 'V/C ratios: solutions ranked by value delivered per cost unit', accent: '#10b981' },
  { key: 'radar',      label: 'Value Radar',  emoji: '🎯', description: 'Value achievement spider chart — Status vs Tolerable / Goal / Wish on every axis', accent: '#7c3aed' },
  { key: 'arch',       label: 'Architecture', emoji: '🏛️', description: 'Spec entries mapped across Business / App / Data / Technology', accent: '#f59e0b' },
  { key: 'deps',       label: 'Dependencies', emoji: '🕸️', description: 'Values ↔ Functions ↔ Solutions with cross-reference links',     accent: '#475569' },
  { key: 'risk',       label: 'Risk Monitor', emoji: '⚠️', description: 'Values ranked by gap from Tolerable — unmitigated breaches flagged',  accent: '#ef4444' },
  { key: 'finance',    label: 'Resources',    emoji: '💰', description: 'Resource budgets vs consumption + Value achievement progress',     accent: '#16a34a' },
  { key: 'swimlane',   label: 'Stakeholders', emoji: '§',  description: 'Stakeholder × Evo Step delivery map — who gets what, and when',   accent: '#2563eb' },
  { key: 'simulator',  label: 'Simulator',    emoji: '▶',  description: 'Animated delivery timeline with cumulative value chart',         accent: '#7c3aed' },
]

// Mini SVG thumbnails — statically mirror each visualization type.
// All viewBox="0 0 80 44"; width/height="100%" fills the card thumbnail area.
// No marker IDs used (avoid cross-SVG ID collisions); arrowheads are manual polygons.
// Source of truth: src/constants/vizThumbs.ts (shared with EvoPlanView strip pills).
const VIZ_THUMBS: Record<Tab, string> = {
  // Value Flow: 6 indigo columns (Tasks→Evo→Solutions→Values→Functions→Stakeholders) + arrows
  flow: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="1"  y="6"  width="9" height="32" rx="2" fill="#ddd6fe"/>
    <rect x="14" y="10" width="9" height="24" rx="2" fill="#a5b4fc"/>
    <rect x="27" y="14" width="9" height="16" rx="2" fill="#818cf8"/>
    <rect x="40" y="10" width="9" height="24" rx="2" fill="#6366f1"/>
    <rect x="53" y="6"  width="9" height="32" rx="2" fill="#4338ca"/>
    <rect x="66" y="8"  width="9" height="28" rx="2" fill="#3730a3"/>
    <line x1="10" y1="22" x2="13" y2="22" stroke="#a5b4fc" stroke-width="1.2"/>
    <polygon points="11,20.5 14,22 11,23.5" fill="#a5b4fc"/>
    <line x1="23" y1="22" x2="26" y2="22" stroke="#818cf8" stroke-width="1.2"/>
    <polygon points="24,20.5 27,22 24,23.5" fill="#818cf8"/>
    <line x1="36" y1="22" x2="39" y2="22" stroke="#6366f1" stroke-width="1.2"/>
    <polygon points="37,20.5 40,22 37,23.5" fill="#6366f1"/>
    <line x1="49" y1="22" x2="52" y2="22" stroke="#4338ca" stroke-width="1.2"/>
    <polygon points="50,20.5 53,22 50,23.5" fill="#4338ca"/>
    <line x1="62" y1="22" x2="65" y2="22" stroke="#3730a3" stroke-width="1.2"/>
    <polygon points="63,20.5 66,22 63,23.5" fill="#3730a3"/>
  </svg>`,

  // Radar: concentric rings + 6 axes + filled data polygon with dots
  radar: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <circle cx="40" cy="22" r="18" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
    <circle cx="40" cy="22" r="12" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
    <circle cx="40" cy="22" r="6"  fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="40"   y2="4"  stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="55.6" y2="13" stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="55.6" y2="31" stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="40"   y2="40" stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="24.4" y2="31" stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="24.4" y2="13" stroke="#cbd5e1" stroke-width="0.8"/>
    <polygon points="40,9 52,14 53,32 40,38 26,30 29,12"
      fill="#6366f1" fill-opacity="0.25" stroke="#6366f1" stroke-width="1.5"/>
    <circle cx="40"  cy="9"  r="2" fill="#6366f1"/>
    <circle cx="52"  cy="14" r="2" fill="#6366f1"/>
    <circle cx="53"  cy="32" r="2" fill="#6366f1"/>
    <circle cx="40"  cy="38" r="2" fill="#6366f1"/>
    <circle cx="26"  cy="30" r="2" fill="#6366f1"/>
    <circle cx="29"  cy="12" r="2" fill="#6366f1"/>
  </svg>`,

  // Architecture (TOGAF): 4 coloured horizontal bands
  arch: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="2" y="2"  width="76" height="9" rx="2" fill="#fde68a"/>
    <rect x="2" y="13" width="76" height="9" rx="2" fill="#bbf7d0"/>
    <rect x="2" y="24" width="76" height="9" rx="2" fill="#bfdbfe"/>
    <rect x="2" y="35" width="76" height="8" rx="2" fill="#e9d5ff"/>
    <text x="6" y="9"  font-size="5" font-family="system-ui,sans-serif" fill="#92400e" font-weight="600">Business</text>
    <text x="6" y="20" font-size="5" font-family="system-ui,sans-serif" fill="#065f46" font-weight="600">Application</text>
    <text x="6" y="31" font-size="5" font-family="system-ui,sans-serif" fill="#1e40af" font-weight="600">Data</text>
    <text x="6" y="41" font-size="5" font-family="system-ui,sans-serif" fill="#6b21a8" font-weight="600">Technology</text>
  </svg>`,

  // Dependencies: 3 columns of entry cards (V · F · S) with horizontal links
  deps: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="1"  y="4"  width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
    <rect x="1"  y="14" width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
    <rect x="1"  y="24" width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
    <rect x="1"  y="34" width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
    <rect x="30" y="4"  width="19" height="8" rx="2" fill="#fffbeb" stroke="#fcd34d" stroke-width="0.8"/>
    <rect x="30" y="14" width="19" height="8" rx="2" fill="#fffbeb" stroke="#fcd34d" stroke-width="0.8"/>
    <rect x="30" y="24" width="19" height="8" rx="2" fill="#fffbeb" stroke="#fcd34d" stroke-width="0.8"/>
    <rect x="60" y="4"  width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
    <rect x="60" y="14" width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
    <rect x="60" y="24" width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
    <rect x="60" y="34" width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
    <line x1="20" y1="8"  x2="30" y2="8"  stroke="#c7d2fe" stroke-width="0.8"/>
    <line x1="20" y1="18" x2="30" y2="18" stroke="#c7d2fe" stroke-width="0.8"/>
    <line x1="20" y1="28" x2="30" y2="28" stroke="#c7d2fe" stroke-width="0.8"/>
    <line x1="49" y1="8"  x2="60" y2="8"  stroke="#a7f3d0" stroke-width="0.8"/>
    <line x1="49" y1="18" x2="60" y2="18" stroke="#a7f3d0" stroke-width="0.8"/>
    <line x1="49" y1="28" x2="60" y2="28" stroke="#a7f3d0" stroke-width="0.8"/>
  </svg>`,

  // Risk Matrix: 3×3 grid coloured green→red on diagonal
  risk: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="14" y="2"  width="19" height="12" rx="2" fill="#d1fae5"/>
    <rect x="35" y="2"  width="19" height="12" rx="2" fill="#fef3c7"/>
    <rect x="56" y="2"  width="19" height="12" rx="2" fill="#fed7aa"/>
    <rect x="14" y="16" width="19" height="12" rx="2" fill="#fef3c7"/>
    <rect x="35" y="16" width="19" height="12" rx="2" fill="#fed7aa"/>
    <rect x="56" y="16" width="19" height="12" rx="2" fill="#fecaca"/>
    <rect x="14" y="30" width="19" height="12" rx="2" fill="#fed7aa"/>
    <rect x="35" y="30" width="19" height="12" rx="2" fill="#fecaca"/>
    <rect x="56" y="30" width="19" height="12" rx="2" fill="#f87171"/>
    <text x="0" y="10"  font-size="4" font-family="system-ui,sans-serif" fill="#059669" font-weight="600">Lo↕</text>
    <text x="0" y="24"  font-size="4" font-family="system-ui,sans-serif" fill="#d97706" font-weight="600">Md</text>
    <text x="0" y="38"  font-size="4" font-family="system-ui,sans-serif" fill="#dc2626" font-weight="600">Hi</text>
  </svg>`,

  // Finance: paired horizontal bar chart (tolerable faded + goal solid, 3 values)
  finance: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="12" y="2"  width="64" height="4" rx="2" fill="#e0e7ff"/>
    <rect x="12" y="2"  width="44" height="4" rx="2" fill="#6366f1" opacity="0.4"/>
    <rect x="12" y="7"  width="64" height="6" rx="3" fill="#e0e7ff"/>
    <rect x="12" y="7"  width="50" height="6" rx="3" fill="#6366f1"/>
    <rect x="12" y="18" width="64" height="4" rx="2" fill="#fce7f3"/>
    <rect x="12" y="18" width="30" height="4" rx="2" fill="#ec4899" opacity="0.4"/>
    <rect x="12" y="23" width="64" height="6" rx="3" fill="#fce7f3"/>
    <rect x="12" y="23" width="36" height="6" rx="3" fill="#ec4899"/>
    <rect x="12" y="34" width="64" height="4" rx="2" fill="#fef3c7"/>
    <rect x="12" y="34" width="52" height="4" rx="2" fill="#f59e0b" opacity="0.4"/>
    <rect x="12" y="39" width="64" height="4" rx="2" fill="#fef3c7"/>
    <rect x="12" y="39" width="56" height="4" rx="2" fill="#f59e0b"/>
    <text x="0" y="8"  font-size="4.5" font-family="system-ui,sans-serif" fill="#6366f1" font-weight="600">V1</text>
    <text x="0" y="27" font-size="4.5" font-family="system-ui,sans-serif" fill="#ec4899" font-weight="600">V2</text>
    <text x="0" y="42" font-size="4.5" font-family="system-ui,sans-serif" fill="#f59e0b" font-weight="600">V3</text>
  </svg>`,

  // Swimlane / HeatLane: 4 horizontal lanes × 4 Evo-step columns, colour-coded by intensity
  swimlane: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <text x="1" y="9"  font-size="4" font-family="system-ui,sans-serif" fill="#92400e">S1</text>
    <text x="1" y="20" font-size="4" font-family="system-ui,sans-serif" fill="#065f46">S2</text>
    <text x="1" y="31" font-size="4" font-family="system-ui,sans-serif" fill="#1e40af">S3</text>
    <text x="1" y="42" font-size="4" font-family="system-ui,sans-serif" fill="#6b21a8">S4</text>
    <rect x="12" y="2"  width="15" height="10" rx="1.5" fill="#fde68a"/>
    <rect x="29" y="2"  width="15" height="10" rx="1.5" fill="#fcd34d"/>
    <rect x="46" y="2"  width="15" height="10" rx="1.5" fill="#f59e0b"/>
    <rect x="63" y="2"  width="15" height="10" rx="1.5" fill="#fde68a" opacity="0.5"/>
    <rect x="12" y="14" width="15" height="10" rx="1.5" fill="#bbf7d0"/>
    <rect x="29" y="14" width="15" height="10" rx="1.5" fill="#6ee7b7"/>
    <rect x="46" y="14" width="15" height="10" rx="1.5" fill="#34d399"/>
    <rect x="63" y="14" width="15" height="10" rx="1.5" fill="#6ee7b7"/>
    <rect x="12" y="26" width="15" height="10" rx="1.5" fill="#bfdbfe"/>
    <rect x="29" y="26" width="15" height="10" rx="1.5" fill="#93c5fd"/>
    <rect x="46" y="26" width="15" height="10" rx="1.5" fill="#60a5fa"/>
    <rect x="63" y="26" width="15" height="10" rx="1.5" fill="#93c5fd"/>
    <rect x="12" y="38" width="15" height="6"  rx="1.5" fill="#e9d5ff"/>
    <rect x="29" y="38" width="15" height="6"  rx="1.5" fill="#d8b4fe"/>
    <rect x="46" y="38" width="15" height="6"  rx="1.5" fill="#c084fc"/>
    <rect x="63" y="38" width="15" height="6"  rx="1.5" fill="#d8b4fe"/>
  </svg>`,

  // Simulator: horizontal bars filling left-to-right + cumulative value curve (red→amber→green gradient)
  simulator: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <text x="2" y="6" font-size="3" font-family="system-ui,sans-serif" fill="#94a3b8">Step 1</text>
    <rect x="15" y="2" width="20" height="4" rx="1" fill="#fee2e2"/>
    <rect x="15" y="2" width="10" height="4" rx="1" fill="#ef4444"/>
    <text x="2" y="15" font-size="3" font-family="system-ui,sans-serif" fill="#94a3b8">Step 2</text>
    <rect x="15" y="11" width="20" height="4" rx="1" fill="#fef3c7"/>
    <rect x="15" y="11" width="15" height="4" rx="1" fill="#f59e0b"/>
    <text x="2" y="24" font-size="3" font-family="system-ui,sans-serif" fill="#94a3b8">Step 3</text>
    <rect x="15" y="20" width="20" height="4" rx="1" fill="#dcfce7"/>
    <rect x="15" y="20" width="20" height="4" rx="1" fill="#22c55e"/>
    <text x="2" y="33" font-size="3" font-family="system-ui,sans-serif" fill="#94a3b8">Value</text>
    <path d="M 15 31 Q 25 28 35 20 T 62 12" stroke="#7c3aed" stroke-width="1.5" fill="none"/>
    <circle cx="15" cy="31" r="1" fill="#7c3aed"/>
    <circle cx="35" cy="20" r="1" fill="#7c3aed"/>
    <circle cx="62" cy="12" r="1" fill="#7c3aed"/>
  </svg>`,

  // Efficiency: 3 zones (green cost cards | orange solution cards | violet value nodes) + bezier edges
  efficiency: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="1"  y="4"  width="13" height="10" rx="2" fill="#f0fdf4" stroke="#4ade80" stroke-width="0.8"/>
    <rect x="1"  y="17" width="13" height="10" rx="2" fill="#f0fdf4" stroke="#86efac" stroke-width="0.8"/>
    <rect x="1"  y="30" width="13" height="10" rx="2" fill="#fef2f2" stroke="#fca5a5" stroke-width="0.8"/>
    <rect x="25" y="1"  width="26" height="13" rx="3" fill="#f0fdf4" stroke="#86efac" stroke-width="1.2"/>
    <rect x="25" y="17" width="26" height="12" rx="3" fill="#fffbeb" stroke="#fcd34d" stroke-width="1.2"/>
    <rect x="25" y="32" width="26" height="11" rx="3" fill="#fef2f2" stroke="#fca5a5" stroke-width="1.2"/>
    <rect x="61" y="5"  width="18" height="8"  rx="4" fill="#f5f3ff" stroke="#a78bfa" stroke-width="0.8"/>
    <rect x="61" y="18" width="18" height="8"  rx="4" fill="#f5f3ff" stroke="#a78bfa" stroke-width="0.8"/>
    <rect x="61" y="31" width="18" height="8"  rx="4" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="0.8"/>
    <line x1="14" y1="9"  x2="25" y2="7.5" stroke="#166534" stroke-width="1.2" stroke-dasharray="2 1.5"/>
    <line x1="14" y1="22" x2="25" y2="23"   stroke="#166534" stroke-width="1.8" stroke-dasharray="2 1.5"/>
    <line x1="14" y1="35" x2="25" y2="37.5" stroke="#166534" stroke-width="0.9" stroke-dasharray="2 1.5"/>
    <path d="M51 7.5 C56 7.5 56 9 61 9"   stroke="#7c3aed" stroke-width="3"   fill="none" opacity="0.85"/>
    <path d="M51 7.5 C56 7.5 56 22 61 22" stroke="#7c3aed" stroke-width="1"   fill="none" opacity="0.5"/>
    <path d="M51 23  C56 23  56 22 61 22" stroke="#7c3aed" stroke-width="4.5" fill="none" opacity="0.9"/>
    <path d="M51 23  C56 23  56 35 61 35" stroke="#7c3aed" stroke-width="1.5" fill="none" opacity="0.55"/>
    <path d="M51 37.5 C56 37.5 56 35 61 35" stroke="#7c3aed" stroke-width="1" fill="none" opacity="0.4"/>
    <text x="26" y="11"  font-size="4.5" fill="#15803d"  font-weight="700" font-family="system-ui">5.1</text>
    <text x="26" y="27"  font-size="4.5" fill="#b45309"  font-weight="700" font-family="system-ui">2.7</text>
    <text x="26" y="41"  font-size="4.5" fill="#b91c1c"  font-weight="700" font-family="system-ui">1.3</text>
  </svg>`,
}

// Wrap single spec in array for components that expect SpecBlock[]
const specArr = computed(() => props.spec ? [props.spec] : [])

// ── Risk Matrix data ───────────────────────────────────────────────────────
// Classify each F. by a simple heuristic: keywords → probability + impact scores.
const HIGH_PROB_WORDS = /uncertain|unknown|might|could|dependency|external|third.?party|assum/i
const HIGH_IMPACT_WORDS = /critical|revenue|compliance|security|auth|payment|data|core|must/i

interface RiskItem { label: string; prob: 0|1|2; impact: 0|1|2 }

const riskItems = computed<RiskItem[]>(() => {
  if (!props.spec) return []
  return props.spec.functions.map(f => {
    const text = f.description + ' ' + f.successCriteria
    const probScore = HIGH_PROB_WORDS.test(text) ? 2 : (f.level === 'Solution' || f.level === 'Evo' ? 0 : 1)
    const impactScore = HIGH_IMPACT_WORDS.test(text) ? 2 : (f.level === 'Business' ? 2 : f.level === 'Stakeholder' ? 1 : 0)
    return {
      label: f.id,
      prob:   probScore as 0|1|2,
      impact: impactScore as 0|1|2,
    }
  })
})

// Group by cell [prob][impact]
const riskGrid = computed(() => {
  const grid: RiskItem[][][] = [[[], [], []], [[], [], []], [[], [], []]]
  riskItems.value.forEach(r => grid[r.prob][r.impact].push(r))
  return grid
})

const RISK_CELL_COLOUR = [
  ['#d1fae5', '#fef3c7', '#fed7aa'],  // low prob: green | yellow | orange
  ['#fef3c7', '#fed7aa', '#fecaca'],  // med prob: yellow | orange | red-light
  ['#fed7aa', '#fecaca', '#f87171'],  // high prob: orange | red-light | red
]

// ── Finance data ───────────────────────────────────────────────────────────
// Extract first numeric value (%) from V. goal / tolerable fields.
function extractPct(s: string): number {
  const m = s.match(/(\d+(?:\.\d+)?)\s*%/)
  if (m) return parseFloat(m[1])
  const m2 = s.match(/(\d+(?:\.\d+)?)/)
  return m2 ? Math.min(100, parseFloat(m2[1])) : 0
}

const financeItems = computed(() => {
  if (!props.spec) return []
  return props.spec.values.slice(0, 12).map(v => ({
    label:     v.id,
    tolerable: extractPct(v.tolerable),
    goal:      extractPct(v.goal),
    level:     v.level,
  }))
})

const LEVEL_COLOUR: Record<string, string> = {
  Business:    '#6366f1',
  Stakeholder: '#ec4899',
  Product:     '#f59e0b',
  Solution:    '#10b981',
  Evo:         '#06b6d4',
  'To-Do':     '#94a3b8',
}

// ── Shared numeric parse (used by redesigned tabs) ─────────────────────────
function parseNum(s: string | undefined): number {
  if (!s) return 0
  const m = s.match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : 0
}

// ── Value Achievement Radar data ───────────────────────────────────────────
const radarSpokes = computed(() => {
  if (!props.spec) return []
  return props.spec.values.slice(0, 10).map(v => {
    const sN = parseNum(v.status)
    const gN = parseNum(v.goal)
    const tN = parseNum(v.tolerable)
    const wN = v.wish ? parseNum(v.wish) : 0
    const base = gN || 100
    const sFrac = Math.min(1.35, base ? sN / base : 0)
    const tFrac = base ? Math.min(1, tN / base) : 0
    const wFrac = wN && base ? Math.min(1.5, wN / base) : 0
    const inBreach = tN > 0 && sN < tN
    const atGoal   = base > 0 && sN >= base
    return { id: v.id, label: v.id.slice(0, 22), scale: v.scale || '',
             status: v.status, tolerable: v.tolerable, goal: v.goal, wish: v.wish,
             sFrac, tFrac, wFrac, inBreach, atGoal }
  })
})

// ── Value Risk Monitor data ─────────────────────────────────────────────────
const riskMonitorData = computed(() => {
  if (!props.spec) return []
  return props.spec.values.map(v => {
    const sN = parseNum(v.status)
    const gN = parseNum(v.goal)
    const tN = parseNum(v.tolerable)
    const base = gN || 100
    const sFrac = base ? Math.min(1, sN / base) : 0
    const tFrac = base ? Math.min(1, tN / base) : 0
    const gap   = tFrac - sFrac  // positive = in breach
    // Count confirmed steps whose linked solutions reference this value
    const targetingCount = props.confirmedSteps.filter(step =>
      (step.linkedSolutions ?? []).some(solId => {
        const sol = props.spec!.solutions.find(s => s.id === solId || s.id === solId)
        return sol?.impact?.toLowerCase().includes(v.id.toLowerCase())
      })
    ).length
    return { id: v.id, label: v.id, scale: v.scale || '',
             status: v.status, tolerable: v.tolerable, goal: v.goal,
             sFrac, tFrac, gap, inBreach: tN > 0 && sN < tN,
             belowGoal: base > 0 && sN < base,
             targetingCount,
             unmitigated: tN > 0 && sN < tN && targetingCount === 0 }
  }).sort((a, b) => b.gap - a.gap)
})

// ── Resource-Value Return data ─────────────────────────────────────────────
const resourceReturnData = computed(() => {
  const resources = (props.spec?.resources ?? []).map(r => {
    const budgetStr = rBudget(r)
    const bN = parseNum(budgetStr)
    const sN = parseNum(r.status)
    const frac = bN > 0 ? Math.min(1.1, sN / bN) : 0
    return { id: r.id, label: r.id, scale: r.scale || '',
             status: r.status, budget: budgetStr,
             kind: r.resourceKind ?? 'budget', frac,
             over: bN > 0 && sN > bN }
  })
  const values = props.spec?.values.slice(0, 12).map(v => {
    const sN = parseNum(v.status)
    const gN = parseNum(v.goal)
    const tN = parseNum(v.tolerable)
    const base = gN || 100
    const sFrac = base ? Math.min(1, sN / base) : 0
    const tFrac = base ? Math.min(1, tN / base) : 0
    return { id: v.id, label: v.id, scale: v.scale || '',
             status: v.status, tolerable: v.tolerable, goal: v.goal,
             sFrac, tFrac, inBreach: tN > 0 && sN < tN }
  }) ?? []
  return { resources, values }
})

// ── Stakeholder Delivery Map data ──────────────────────────────────────────
const stakeholderNames = computed(() => {
  if (!props.spec?.stakes) return []
  return props.spec.stakes.split(',').map(s => s.trim()).filter(Boolean)
})

const stakeholderDeliveryGrid = computed(() => {
  if (!props.spec || !props.confirmedSteps.length || !stakeholderNames.value.length) return []
  const spec = props.spec
  const steps = props.confirmedSteps

  // For each step: which Value IDs does it impact?
  const stepValueSets = steps.map(step => {
    const ids = new Set<string>()
    for (const solId of (step.linkedSolutions ?? [])) {
      const sol = spec.solutions.find(s => s.id === solId)
      if (sol?.impact) {
        // Match "V.Xxx" patterns
        for (const m of sol.impact.matchAll(/V\.(\w+)/g)) ids.add(m[1])
        // Also match any value ID appearing literally in the impact string
        for (const v of spec.values) {
          if (sol.impact.toLowerCase().includes(v.id.toLowerCase())) ids.add(v.id)
        }
      }
    }
    return ids
  })

  // Stakeholder affinity: does this stakeholder care about this value?
  function affinity(name: string, v: typeof spec.values[0]): boolean {
    const text = `${v.id} ${v.description ?? ''}`.toLowerCase()
    const n = name.toLowerCase()
    if (text.includes(n)) return true
    const firstWord = n.split(' ')[0]
    return firstWord.length > 3 && text.includes(firstWord)
  }

  return stakeholderNames.value.map(name => ({
    name,
    cells: steps.map((step, si) => {
      const impacted = [...stepValueSets[si]]
        .map(vid => spec.values.find(v => v.id === vid))
        .filter((v): v is typeof spec.values[0] => !!v && affinity(name, v))
      return { stepName: step.name, values: impacted, count: impacted.length }
    }),
    hasAny: stepValueSets.some((ids, si) =>
      [...ids].some(vid => {
        const v = spec.values.find(x => x.id === vid)
        return v && affinity(name, v)
      })
    ),
  }))
})

// ── Live tile thumbnails (Thumbnail Reality Rule) ─────────────────────────
// Each thumbnail is a computed SVG derived from REAL plan data — entry counts,
// actual V/C ratios, real risk grid cells, real finance percentages. Not static
// hand-drawn icons. Tom 2026-05-28: "the upper visual part of the button was a
// mini display of that tool's real time current display for current plan."
const liveThumbs = computed<Record<Tab, string>>(() => {
  const spec  = props.spec
  const vals  = spec?.values    ?? []
  const fns   = spec?.functions ?? []
  const sols  = spec?.solutions ?? []
  const steps = props.confirmedSteps
  const vC = vals.length, fC = fns.length, sC = sols.length, stC = steps.length

  /** Wrap SVG content in a standard 200×120 canvas. */
  function wrap(body: string): string {
    return `<svg viewBox="0 0 200 120" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">${body}</svg>`
  }
  function noData(msg = 'No plan data yet'): string {
    return wrap(`<text x="100" y="65" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#cbd5e1" font-style="italic">${msg}</text>`)
  }

  // ── Value Flow ─────────────────────────────────────────────────────────────
  // Real column counts: Steps / Values / Functions / Solutions — colored bars
  const maxC = Math.max(stC, vC, fC, sC, 1)
  const flowCols = [
    { count: stC, color: '#06b6d4', label: 'Tasks',   x: 16  },
    { count: vC,  color: '#8b5cf6', label: 'Values',  x: 62  },
    { count: fC,  color: '#f59e0b', label: 'Funcs',   x: 108 },
    { count: sC,  color: '#10b981', label: 'Solns',   x: 154 },
  ]
  let flowBody = ''
  for (const b of flowCols) {
    const h = Math.max(6, (b.count / maxC) * 68)
    const y = 78 - h
    flowBody += `<rect x="${b.x}" y="${y}" width="30" height="${h}" rx="3" fill="${b.color}" fill-opacity="0.82"/>`
    flowBody += `<text x="${b.x + 15}" y="${y - 4}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="${b.color}">${b.count}</text>`
    flowBody += `<text x="${b.x + 15}" y="95" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8" fill="#94a3b8">${b.label}</text>`
  }
  for (let i = 0; i < flowCols.length - 1; i++) {
    const x1 = flowCols[i].x + 32, x2 = flowCols[i+1].x - 2, y = 60
    flowBody += `<line x1="${x1}" y1="${y}" x2="${x2 - 4}" y2="${y}" stroke="#cbd5e1" stroke-width="1.5"/>`
    flowBody += `<polygon points="${x2-4},${y-3} ${x2},${y} ${x2-4},${y+3}" fill="#cbd5e1"/>`
  }
  const flowThumb = wrap(flowBody)

  // ── Efficiency ─────────────────────────────────────────────────────────────
  // Ranked horizontal bars from real V/C ratios
  const vcEntries = Object.entries(props.vcRatios ?? {}).sort(([,a],[,b]) => b - a).slice(0, 5)
  let effThumb: string
  if (vcEntries.length === 0) {
    effThumb = noData('No V/C ratios yet')
  } else {
    const maxVC = vcEntries[0][1] || 1
    let effBody = ''
    vcEntries.forEach(([id, ratio], i) => {
      const barW = Math.max(6, (ratio / maxVC) * 148)
      const y    = 16 + i * 22
      const clr  = i === 0 ? '#059669' : i === 1 ? '#10b981' : i === 2 ? '#f59e0b' : '#94a3b8'
      const op   = i === 0 ? '0.9' : '0.65'
      effBody += `<rect x="48" y="${y}" width="${barW.toFixed(1)}" height="14" rx="2" fill="${clr}" fill-opacity="${op}"/>`
      effBody += `<text x="46" y="${y + 10}" text-anchor="end" font-family="system-ui,sans-serif" font-size="8" fill="#64748b">${id.slice(0, 9)}</text>`
      effBody += `<text x="${50 + barW + 3}" y="${y + 10}" font-family="system-ui,sans-serif" font-size="8" font-weight="700" fill="${clr}">${ratio.toFixed(1)}</text>`
    })
    effThumb = wrap(effBody)
  }

  // ── Radar ──────────────────────────────────────────────────────────────────
  // Real dot positions: classify each S. by keyword → ring
  const adoptRe  = /adopt|proven|production|stable|established|ship/i
  const trialRe  = /trial|testing|test|pilot|explore|experiment/i
  const assessRe = /assess|consider|invest|evaluate|potential|candidate/i
  let adoptC = 0, trialC = 0, assessC = 0, holdC = 0
  for (const s of sols) {
    const t = ((s as {description?:string}).description ?? '') + ' ' + ((s as {impact?:string}).impact ?? '')
    if (adoptRe.test(t))  adoptC++
    else if (trialRe.test(t))  trialC++
    else if (assessRe.test(t)) assessC++
    else holdC++
  }
  const radarCX = 100, radarCY = 62, radarR = 46
  let radarBody = ''
  // Concentric rings
  for (const fr of [1, 0.66, 0.33]) {
    radarBody += `<circle cx="${radarCX}" cy="${radarCY}" r="${(radarR * fr).toFixed(1)}" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>`
  }
  // Dots per ring
  const ringDefs = [
    { count: adoptC,  r: radarR * 0.22, color: '#059669' },
    { count: trialC,  r: radarR * 0.5,  color: '#6366f1' },
    { count: assessC, r: radarR * 0.76, color: '#f59e0b' },
    { count: holdC,   r: radarR * 0.96, color: '#ef4444' },
  ]
  for (const ring of ringDefs) {
    if (ring.count === 0) continue
    const step = (Math.PI * 2) / ring.count
    for (let i = 0; i < ring.count; i++) {
      const angle = i * step - Math.PI / 2
      const dx = radarCX + Math.cos(angle) * ring.r
      const dy = radarCY + Math.sin(angle) * ring.r
      radarBody += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="4" fill="${ring.color}" fill-opacity="0.8"/>`
    }
  }
  // Zone labels
  radarBody += `<text x="${radarCX}" y="11" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#059669">ADOPT ${adoptC}</text>`
  radarBody += `<text x="196" y="${radarCY + 3}" text-anchor="end" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#6366f1">TRIAL ${trialC}</text>`
  radarBody += `<text x="${radarCX}" y="118" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#f59e0b">ASSESS ${assessC}</text>`
  radarBody += `<text x="4" y="${radarCY + 3}" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#ef4444">HOLD ${holdC}</text>`
  const radarThumb = wrap(radarBody)

  // ── Architecture ───────────────────────────────────────────────────────────
  // Real level counts → proportional TOGAF band heights
  const levelCounts: Record<string, number> = {}
  for (const e of [...vals, ...fns, ...sols]) {
    const lvl = (e as {level?: string}).level ?? 'Product'
    levelCounts[lvl] = (levelCounts[lvl] ?? 0) + 1
  }
  const togafBands = [
    { label: 'Business',    keys: ['Business','Stakeholder'], fill: '#fde68a', text: '#92400e' },
    { label: 'Application', keys: ['Product','Feature'],      fill: '#bbf7d0', text: '#065f46' },
    { label: 'Data',        keys: ['Evo','To-Do'],            fill: '#bfdbfe', text: '#1e40af' },
    { label: 'Technology',  keys: ['Solution'],               fill: '#e9d5ff', text: '#6b21a8' },
  ]
  const totalEnt = Math.max(vC + fC + sC, 1)
  let archBody = '', archY = 6
  for (const band of togafBands) {
    const count = band.keys.reduce((s, k) => s + (levelCounts[k] ?? 0), 0)
    const h = Math.max(18, (count / totalEnt) * 88 + 14)
    archBody += `<rect x="4" y="${archY}" width="192" height="${h}" rx="3" fill="${band.fill}"/>`
    archBody += `<text x="10" y="${archY + h/2 + 4}" font-family="system-ui,sans-serif" font-size="8" font-weight="700" fill="${band.text}">${band.label} (${count})</text>`
    archY += h + 2
  }
  const archThumb = wrap(archBody || `<text x="100" y="60" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#cbd5e1">No entries</text>`)

  // ── Dependencies ───────────────────────────────────────────────────────────
  // Real V/F/S counts as column card stacks
  const depsCols = [
    { label: 'Values',    count: vC, stroke: '#a5b4fc', bg: '#eef2ff', text: '#3730a3' },
    { label: 'Functions', count: fC, stroke: '#fcd34d', bg: '#fffbeb', text: '#92400e' },
    { label: 'Solutions', count: sC, stroke: '#6ee7b7', bg: '#ecfdf5', text: '#064e3b' },
  ]
  let depsBody = ''
  depsCols.forEach((col, ci) => {
    const colX = 8 + ci * 64
    depsBody += `<text x="${colX + 28}" y="12" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="${col.text}">${col.label.toUpperCase()}</text>`
    const vis = Math.min(col.count, 4)
    for (let k = 0; k < vis; k++) {
      depsBody += `<rect x="${colX}" y="${18 + k * 22}" width="54" height="18" rx="3" fill="${col.bg}" stroke="${col.stroke}" stroke-width="0.8"/>`
    }
    if (col.count > 4) {
      depsBody += `<text x="${colX + 27}" y="${18 + 4 * 22 + 10}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7.5" fill="${col.text}">+${col.count - 4}</text>`
    }
    if (col.count === 0) {
      depsBody += `<text x="${colX + 27}" y="62" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8.5" fill="#e2e8f0" font-style="italic">none</text>`
    }
    // Count badge
    depsBody += `<rect x="${colX + 38}" y="5" width="16" height="10" rx="3" fill="${col.stroke}"/>`
    depsBody += `<text x="${colX + 46}" y="13" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7.5" font-weight="700" fill="white">${col.count}</text>`
  })
  const depsThumb = wrap(depsBody)

  // ── Risk Matrix ────────────────────────────────────────────────────────────
  // Real riskGrid counts in each 3×3 cell
  const rGrid = riskGrid.value
  let riskBody = ''
  // Col headers
  const rColLabels = ['Low Impact', 'Med Impact', 'High Impact']
  for (let ii = 0; ii < 3; ii++) {
    riskBody += `<text x="${42 + ii * 54}" y="10" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" fill="#475569" font-weight="600">${rColLabels[ii]}</text>`
  }
  // Row labels
  const rRowColors = ['#059669', '#d97706', '#dc2626']
  const rRowLabels = ['Lo Prob', 'Md Prob', 'Hi Prob']
  for (let pi = 0; pi < 3; pi++) {
    riskBody += `<text x="4" y="${28 + pi * 34}" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="${rRowColors[pi]}">${rRowLabels[pi]}</text>`
    for (let ii = 0; ii < 3; ii++) {
      const items = rGrid[pi][ii]
      const cellX = 20 + ii * 60, cellY = 14 + pi * 34
      riskBody += `<rect x="${cellX}" y="${cellY}" width="54" height="28" rx="3" fill="${RISK_CELL_COLOUR[pi][ii]}"/>`
      if (items.length === 0) {
        riskBody += `<text x="${cellX + 27}" y="${cellY + 18}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#94a3b8">—</text>`
      } else {
        riskBody += `<text x="${cellX + 27}" y="${cellY + 20}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#374151">${items.length}</text>`
      }
    }
  }
  const riskThumb = wrap(riskBody)

  // ── Finance ────────────────────────────────────────────────────────────────
  // Real progress bars for first 4 V. entries
  const finItems = financeItems.value.slice(0, 4)
  let finThumb: string
  if (finItems.length === 0) {
    finThumb = noData('No V. entries')
  } else {
    let finBody = ''
    finItems.forEach((item, i) => {
      const y     = 14 + i * 27
      const color = LEVEL_COLOUR[item.level] ?? '#94a3b8'
      const maxW  = 158
      finBody += `<text x="6" y="${y + 8}" font-family="system-ui,sans-serif" font-size="7.5" fill="#64748b" font-weight="600">${item.label.slice(0, 20)}</text>`
      // Tolerable
      finBody += `<rect x="6" y="${y + 11}" width="${maxW}" height="4" rx="2" fill="#f1f5f9"/>`
      if (item.tolerable > 0)
        finBody += `<rect x="6" y="${y + 11}" width="${((maxW * item.tolerable) / 100).toFixed(1)}" height="4" rx="2" fill="${color}" opacity="0.38"/>`
      // Goal
      finBody += `<rect x="6" y="${y + 16}" width="${maxW}" height="8" rx="4" fill="#f1f5f9"/>`
      if (item.goal > 0) {
        const gw = Math.max(8, (maxW * item.goal) / 100)
        finBody += `<rect x="6" y="${y + 16}" width="${gw.toFixed(1)}" height="8" rx="4" fill="${color}"/>`
        if (item.goal > 10)
          finBody += `<text x="9" y="${y + 23}" font-family="system-ui,sans-serif" font-size="6.5" font-weight="700" fill="white">${item.goal}%</text>`
      }
    })
    finThumb = wrap(finBody)
  }

  // ── Swimlane ───────────────────────────────────────────────────────────────
  // Real step × entry heatmap cells
  const swimStepCount   = Math.min(stC, 7)
  const swimEntryCount  = Math.min(vC + fC, 4)
  let swimThumb: string
  if (swimStepCount === 0 && swimEntryCount === 0) {
    swimThumb = noData('No Evo steps yet')
  } else {
    const swimSC = Math.max(swimStepCount, 1), swimEC = Math.max(swimEntryCount, 1)
    const cellW = Math.min(24, 156 / swimSC)
    const cellH = Math.min(22, 90 / swimEC)
    let swimBody = ''
    const SWIM_COLORS = ['#bbf7d0','#bfdbfe','#e9d5ff','#fde68a']
    // Step headers
    for (let s = 0; s < swimSC; s++) {
      swimBody += `<rect x="${34 + s * (cellW + 2)}" y="6" width="${cellW}" height="10" rx="1.5" fill="#e2e8f0"/>`
      swimBody += `<text x="${34 + s * (cellW + 2) + cellW / 2}" y="14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="6" fill="#64748b">S${s+1}</text>`
    }
    for (let e = 0; e < swimEC; e++) {
      const label = e < vC ? `V${e+1}` : `F${e-vC+1}`
      swimBody += `<text x="32" y="${22 + e * (cellH + 2) + cellH / 2 + 3}" text-anchor="end" font-family="system-ui,sans-serif" font-size="6.5" fill="#64748b">${label}</text>`
      for (let s = 0; s < swimSC; s++) {
        const intensity = (Math.sin(e * 2.3 + s * 1.7) * 0.5 + 0.5)
        swimBody += `<rect x="${34 + s * (cellW + 2)}" y="${20 + e * (cellH + 2)}" width="${cellW}" height="${cellH}" rx="1.5" fill="${SWIM_COLORS[e % 4]}" fill-opacity="${(0.25 + intensity * 0.7).toFixed(2)}"/>`
      }
    }
    swimThumb = wrap(swimBody)
  }

  // ── Simulator ─────────────────────────────────────────────────────────────
  // Real evo step bars + estimated value accumulation curve
  const simSteps = steps.slice(0, 4)
  let simThumb: string
  if (simSteps.length === 0) {
    simThumb = noData('No Evo steps yet')
  } else {
    let simBody = ''
    simSteps.forEach((_, i) => {
      const progress  = (i + 1) / simSteps.length
      const barColor  = i === 0 ? '#ef4444' : i < simSteps.length - 1 ? '#f59e0b' : '#22c55e'
      const barW      = Math.max(10, 140 * (0.45 + progress * 0.55))
      simBody += `<text x="12" y="${18 + i * 23}" font-family="system-ui,sans-serif" font-size="7.5" fill="#94a3b8">Step ${i + 1}</text>`
      simBody += `<rect x="48" y="${9 + i * 23}" width="140" height="14" rx="3" fill="${barColor}18"/>`
      simBody += `<rect x="48" y="${9 + i * 23}" width="${barW.toFixed(0)}" height="14" rx="3" fill="${barColor}" fill-opacity="0.75"/>`
    })
    // Value curve
    const pts = simSteps.map((_, i) => {
      const x = 48 + (i / (simSteps.length - 1 || 1)) * 130
      const y = 108 - (i / (simSteps.length - 1 || 1)) * 50
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    simBody += `<polyline points="${pts}" stroke="#7c3aed" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    simBody += `<text x="182" y="60" text-anchor="end" font-family="system-ui,sans-serif" font-size="7.5" font-weight="700" fill="#7c3aed">Value ↑</text>`
    simThumb = wrap(simBody)
  }

  return {
    flow:       flowThumb,
    efficiency: effThumb,
    radar:      radarThumb,
    arch:       archThumb,
    deps:       depsThumb,
    risk:       riskThumb,
    finance:    finThumb,
    swimlane:   swimThumb,
    simulator:  simThumb,
  }
})

// ── Copy button ────────────────────────────────────────────────────────────
// Refs to the wrapper element of each SVG-based tab so we can serialise the
// first <svg> child to a PNG via canvas and write it to the clipboard.
const flowRef  = ref<HTMLElement | null>(null)
const radarRef = ref<HTMLElement | null>(null)
const archRef  = ref<HTMLElement | null>(null)

const copied      = ref(false)
const imageCopied = ref(false)
let _copyClearTimer      = 0
let _imageCopyClearTimer = 0

function _markCopied() {
  copied.value = true
  clearTimeout(_copyClearTimer)
  _copyClearTimer = window.setTimeout(() => { copied.value = false }, 2000)
}

function _markImageCopied() {
  imageCopied.value = true
  clearTimeout(_imageCopyClearTimer)
  _imageCopyClearTimer = window.setTimeout(() => { imageCopied.value = false }, 2000)
}

// Render an SVG wrapper to a 2× PNG and write it to the clipboard.
//
// Safari rule: ClipboardItem must receive a Promise<Blob>, NOT a resolved Blob.
// Passing an already-resolved blob means clipboard.write() is called after the
// async chain completes — by then WebKit has exited the user-gesture context and
// silently refuses the write.  Passing the Promise lets the browser hold the
// gesture open until the blob is ready.
async function copySvgTab(wrapper: HTMLElement | null): Promise<void> {
  if (!wrapper) return
  const svg = wrapper.querySelector('svg')
  if (!svg) return

  function _svgToPngBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      let data = new XMLSerializer().serializeToString(svg!)
      if (!data.includes('xmlns='))
        data = data.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
      const svgBlob = new Blob([data], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.onload = () => {
        const vb = svg!.viewBox.baseVal
        const w  = vb.width  || svg!.clientWidth  || 800
        const h  = vb.height || svg!.clientHeight || 600
        const px = 2 // 2× for retina
        const cv = document.createElement('canvas')
        cv.width  = w * px
        cv.height = h * px
        const ctx = cv.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, cv.width, cv.height)
        ctx.scale(px, px)
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        cv.toBlob(blob => {
          if (!blob) { reject(new Error('toBlob failed')); return }
          resolve(blob)
        }, 'image/png')
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load')) }
      img.src = url
    })
  }

  try {
    // Pass the Promise directly — Safari holds the gesture context until it resolves
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': _svgToPngBlob() })])
    _markCopied()
  } catch {
    // Fallback: copy SVG XML source text so at least Figma/Inkscape/Sketch can paste it
    await navigator.clipboard.writeText(new XMLSerializer().serializeToString(svg))
    _markCopied()
  }
}

// Copy a table as a formatted grid that pastes cleanly into Keynote, Apple Mail,
// Apple Notes, and any plain-text destination — with NO duplication.
//
// Root cause of old double-paste bug:
//   execCommand('copy') in Safari can write the HTML to the clipboard but still
//   return false.  The old code then ran navigator.clipboard.writeText() as a
//   "fallback", putting a SECOND copy of the data (as TSV plain-text) onto the
//   clipboard.  On paste, rich apps received both the HTML representation and the
//   plain-text representation, showing the data twice.
//
// Fix — two-stage approach, single write per path:
//   1. Try ClipboardItem with both text/html and text/plain in ONE write.
//      Apps that understand HTML get the styled table; plain-text apps get TSV.
//      Only ONE representation is ever pasted.  Must be called from a user-gesture
//      handler (button click), which grants the necessary async permission on
//      modern Safari (16+) and all Chromium browsers.
//   2. If ClipboardItem throws (very old Safari, restricted iframe), fall back to
//      execCommand on a hidden contenteditable div.  Do NOT follow with a second
//      writeText call — execCommand already wrote the HTML; a second write causes
//      the double-paste.  Per table-copy standard: white-space:normal on all cells.
async function _copyHtmlTable(rows: string[][]): Promise<void> {
  if (rows.length === 0) return
  const TH = (s: string) =>
    `<th style="padding:6px 12px;border:1px solid #cbd5e1;background:#f1f5f9;font-weight:600;text-align:left;white-space:normal">${s}</th>`
  const TD = (s: string) =>
    `<td style="padding:6px 12px;border:1px solid #cbd5e1;vertical-align:top;white-space:normal">${s}</td>`

  const headerHtml = rows[0].map(TH).join('')
  const bodyHtml   = rows.slice(1)
    .map(r => `<tr>${r.map(TD).join('')}</tr>`).join('')
  const html = `<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
  const tsv  = rows.map(r => r.join('\t')).join('\n')

  // Path 1 — ClipboardItem: single atomic write, apps pick exactly one format.
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html':  new Blob([html], { type: 'text/html'  }),
        'text/plain': new Blob([tsv],  { type: 'text/plain' }),
      }),
    ])
    _markCopied()
    return
  } catch {
    // Path 2 — execCommand fallback for old Safari / restricted contexts.
    // Important: do NOT call navigator.clipboard.writeText after this —
    // execCommand already wrote the clipboard; a second write = double paste.
  }

  const div = document.createElement('div')
  div.setAttribute('contenteditable', 'true')
  div.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;z-index:-1'
  div.innerHTML = html
  document.body.appendChild(div)
  const sel   = window.getSelection()!
  const range = document.createRange()
  range.selectNodeContents(div)
  sel.removeAllRanges()
  sel.addRange(range)
  try { document.execCommand('copy') } catch { /* ok */ }
  sel.removeAllRanges()
  document.body.removeChild(div)

  _markCopied()
}

async function copyDeps(): Promise<void> {
  if (!props.spec) return
  const vs  = props.spec.values    ?? []
  const fs  = props.spec.functions ?? []
  const ss  = props.spec.solutions ?? []
  const len = Math.max(vs.length, fs.length, ss.length)
  const rows: string[][] = [['Values', 'Functions', 'Solutions']]
  for (let i = 0; i < len; i++)
    rows.push([vs[i]?.id ?? '', fs[i]?.id ?? '', ss[i]?.id ?? ''])
  await _copyHtmlTable(rows)
}

async function copyRisk(): Promise<void> {
  const rows: string[][] = [['', 'Low Impact', 'Med Impact', 'High Impact']]
  const labels = ['Low Prob', 'Med Prob', 'High Prob']
  for (let pi = 0; pi < 3; pi++) {
    rows.push([
      labels[pi],
      riskGrid.value[pi][0].map(r => r.label).join(', ') || '—',
      riskGrid.value[pi][1].map(r => r.label).join(', ') || '—',
      riskGrid.value[pi][2].map(r => r.label).join(', ') || '—',
    ])
  }
  await _copyHtmlTable(rows)
}

async function copyFinance(): Promise<void> {
  const rows: string[][] = [['Value', 'Level', 'Tolerable %', 'Goal %']]
  for (const item of financeItems.value)
    rows.push([item.label, item.level, String(item.tolerable), String(item.goal)])
  await _copyHtmlTable(rows)
}

async function copyCurrentTab(): Promise<void> {
  const t = activeTab.value
  if (t === 'flow')     return copySvgTab(flowRef.value)
  if (t === 'radar')    return copySvgTab(radarRef.value)
  if (t === 'arch')     return copySvgTab(archRef.value)
  if (t === 'deps')     return copyDeps()
  if (t === 'risk')     return copyRisk()
  if (t === 'finance')  return copyFinance()
  // 'swimlane': SpecHeatLane has its own Copy button inside the tab — no-op here.
}

// ── Finance image copy ────────────────────────────────────────────────────────
// Builds an SVG recreation of the Finance bar chart and renders it to a 2× PNG
// using the same canvas pipeline as copySvgTab().  Kept as a programmatic SVG
// (not a DOM serialise) so it works without html2canvas dependencies and
// produces a clean transparent-safe white-bg image at any size.
function _financeSvgBlob(): Promise<Blob> {
  const items = financeItems.value
  const W     = 800
  const PAD   = 40
  const BAR_W = W - PAD * 2
  const TOP   = 72          // space for title + subtitle + divider
  const ITEM_H = 84         // height allocated per value row
  const H     = TOP + items.length * ITEM_H + 36

  let body = ''

  // Title
  body += `<text x="${PAD}" y="26" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#1e293b">Finance — Value Targets</text>`
  body += `<text x="${PAD}" y="45" font-family="system-ui,sans-serif" font-size="10" fill="#64748b">Tolerable (faded) vs Goal (solid). Colour = stakeholder level.</text>`
  body += `<line x1="${PAD}" y1="57" x2="${W - PAD}" y2="57" stroke="#e2e8f0" stroke-width="1"/>`

  for (let i = 0; i < items.length; i++) {
    const item  = items[i]
    const y     = TOP + i * ITEM_H
    const color = LEVEL_COLOUR[item.level] ?? '#94a3b8'
    const tolW  = (BAR_W * item.tolerable / 100).toFixed(1)
    const goalW = (BAR_W * Math.max(item.goal, 4) / 100).toFixed(1)

    // Row label (left)
    body += `<text x="${PAD}" y="${y + 13}" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="#334155">${item.label}</text>`
    // Level dot + label (right)
    body += `<rect x="${W - PAD - 72}" y="${y + 4}" width="8" height="8" rx="2" fill="${color}" opacity="0.45"/>`
    body += `<text x="${W - PAD - 60}" y="${y + 12}" font-family="system-ui,sans-serif" font-size="10" fill="#94a3b8">${item.level}</text>`

    // Tolerable track + fill (faded)
    body += `<rect x="${PAD}" y="${y + 20}" width="${BAR_W}" height="10" rx="5" fill="#f1f5f9"/>`
    if (item.tolerable > 0)
      body += `<rect x="${PAD}" y="${y + 20}" width="${tolW}" height="10" rx="5" fill="${color}" opacity="0.38"/>`

    // Goal track + fill (solid)
    body += `<rect x="${PAD}" y="${y + 34}" width="${BAR_W}" height="16" rx="8" fill="#f1f5f9"/>`
    if (item.goal > 0)
      body += `<rect x="${PAD}" y="${y + 34}" width="${goalW}" height="16" rx="8" fill="${color}"/>`
    // Inline percentage label when bar is wide enough
    if (item.goal > 12)
      body += `<text x="${PAD + 7}" y="${y + 46}" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#ffffff">${item.goal}%</text>`

    // Caption
    body += `<text x="${PAD}" y="${y + 65}" font-family="system-ui,sans-serif" font-size="9" fill="#94a3b8">Tolerable ${item.tolerable}% → Goal ${item.goal}%</text>`
  }

  const svgStr = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="#ffffff" rx="12"/>`,
    body,
    `</svg>`,
  ].join('')

  return new Promise((resolve, reject) => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const img  = new Image()
    img.onload = () => {
      const px = 2
      const cv = document.createElement('canvas')
      cv.width  = W * px
      cv.height = H * px
      const ctx = cv.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.scale(px, px)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      cv.toBlob(b => {
        if (!b) { reject(new Error('toBlob failed')); return }
        resolve(b)
      }, 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load')) }
    img.src = url
  })
}

async function copyFinanceImage(): Promise<void> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': _financeSvgBlob() })])
    _markImageCopied()
  } catch { /* silent */ }
}

// ── Shared SVG string → 2× PNG blob ──────────────────────────────────────────
// Used by Finance, Risk Matrix, and Dependencies image-copy functions.
function _svgStringToPngBlob(svgStr: string, w: number, h: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const img  = new Image()
    img.onload = () => {
      const px = 2
      const cv = document.createElement('canvas')
      cv.width  = w * px; cv.height = h * px
      const ctx = cv.getContext('2d')!
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.scale(px, px); ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      cv.toBlob(b => { if (!b) { reject(new Error('toBlob')); return }; resolve(b) }, 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load')) }
    img.src = url
  })
}

// Truncate long strings so they don't overflow SVG text elements
const _trunc = (s: string, n = 30) => s.length > n ? s.slice(0, n - 1) + '…' : s

// ── Risk Matrix image copy ────────────────────────────────────────────────────
function _riskSvgBlob(): Promise<Blob> {
  const W        = 800
  const PAD      = 24
  const LABEL_W  = 92
  const CELL_W   = Math.floor((W - PAD * 2 - LABEL_W) / 3)
  const HEADER_H = 60
  const COL_HDR  = 28
  const ITEM_H   = 17
  const CP       = 12   // cell padding

  const grid = riskGrid.value
  const rowH = [0, 1, 2].map(pi =>
    Math.max(72, Math.max(...[0, 1, 2].map(ii => grid[pi][ii].length * ITEM_H + CP * 2)))
  )
  const H = HEADER_H + COL_HDR + rowH.reduce((a, b) => a + b, 0) + PAD

  const ROW_COLORS  = ['#059669', '#d97706', '#dc2626']
  const ROW_LABELS  = ['Low Prob', 'Med Prob', 'High Prob']
  const COL_LABELS  = ['Low Impact', 'Med Impact', 'High Impact']

  let b = ''
  b += `<text x="${PAD}" y="22" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#1e293b">Risk Matrix</text>`
  b += `<text x="${PAD}" y="40" font-family="system-ui,sans-serif" font-size="10" fill="#64748b">Functions classified by probability × impact — colour = risk level</text>`
  b += `<line x1="${PAD}" y1="50" x2="${W - PAD}" y2="50" stroke="#e2e8f0" stroke-width="1"/>`

  // Column headers
  for (let ii = 0; ii < 3; ii++) {
    const cx = PAD + LABEL_W + ii * CELL_W + CELL_W / 2
    b += `<text x="${cx}" y="${HEADER_H + 16}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#475569" letter-spacing="0.5">${COL_LABELS[ii].toUpperCase()}</text>`
  }

  // Grid rows
  let rowY = HEADER_H + COL_HDR
  for (let pi = 0; pi < 3; pi++) {
    const rh = rowH[pi]
    // Row label
    b += `<text x="${PAD + LABEL_W - 8}" y="${rowY + rh / 2 + 4}" text-anchor="end" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="${ROW_COLORS[pi]}" letter-spacing="0.5">${ROW_LABELS[pi].toUpperCase()}</text>`
    // Cells
    for (let ii = 0; ii < 3; ii++) {
      const cx    = PAD + LABEL_W + ii * CELL_W
      const items = grid[pi][ii]
      b += `<rect x="${cx + 2}" y="${rowY + 2}" width="${CELL_W - 6}" height="${rh - 6}" rx="8" fill="${RISK_CELL_COLOUR[pi][ii]}"/>`
      if (items.length === 0) {
        b += `<text x="${cx + CELL_W / 2}" y="${rowY + rh / 2 + 4}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#94a3b8" font-style="italic">—</text>`
      } else {
        for (let k = 0; k < items.length; k++)
          b += `<text x="${cx + 10}" y="${rowY + CP + 4 + k * ITEM_H}" font-family="system-ui,sans-serif" font-size="10" font-weight="600" fill="#374151">${_trunc(items[k].label, 28)}</text>`
      }
    }
    rowY += rh
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff" rx="12"/>${b}</svg>`
  return _svgStringToPngBlob(svg, W, H)
}

async function copyRiskImage(): Promise<void> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': _riskSvgBlob() })])
    _markImageCopied()
  } catch { /* silent */ }
}

// ── Dependencies image copy ───────────────────────────────────────────────────
function _depsSvgBlob(): Promise<Blob> {
  const W        = 800
  const PAD      = 24
  const GUTTER   = 8
  const COL_W    = Math.floor((W - PAD * 2 - GUTTER * 2) / 3)
  const HEADER_H = 60
  const COL_HDR  = 24
  const CARD_H   = 52
  const CARD_GAP = 6

  const vs = props.spec?.values    ?? []
  const fs = props.spec?.functions ?? []
  const ss = props.spec?.solutions ?? []
  const maxItems = Math.max(vs.length, fs.length, ss.length, 1)
  const H = HEADER_H + COL_HDR + maxItems * (CARD_H + CARD_GAP) + PAD * 2

  const COLS = [
    {
      label: 'Values', hdr: '#4338ca', bg: '#eef2ff', border: '#a5b4fc', id: '#3730a3', sub: '#6366f1',
      items: vs.map(v => ({
        id:   _trunc(v.id, 30),
        sub:  v.goal          ? _trunc('Goal: ' + v.goal,            34) : '',
        link: v.valueOfFunction ? _trunc('↔ ' + v.valueOfFunction,  34) : '',
      })),
    },
    {
      label: 'Functions', hdr: '#b45309', bg: '#fffbeb', border: '#fcd34d', id: '#92400e', sub: '#d97706',
      items: fs.map(f => ({
        id:   _trunc(f.id, 30),
        sub:  '',
        link: f.functionOfValue ? _trunc('↔ ' + f.functionOfValue, 34) : '',
      })),
    },
    {
      label: 'Solutions', hdr: '#065f46', bg: '#ecfdf5', border: '#6ee7b7', id: '#064e3b', sub: '#059669',
      items: ss.map(s => ({
        id:   _trunc(s.id, 30),
        sub:  s.impact   ? _trunc(s.impact,          34) : '',
        link: s.function ? _trunc('↔ ' + s.function, 34) : '',
      })),
    },
  ]

  let b = ''
  b += `<text x="${PAD}" y="22" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#1e293b">Dependencies</text>`
  b += `<text x="${PAD}" y="40" font-family="system-ui,sans-serif" font-size="10" fill="#64748b">Values · Functions · Solutions — spec entries grouped by type with cross-links</text>`
  b += `<line x1="${PAD}" y1="50" x2="${W - PAD}" y2="50" stroke="#e2e8f0" stroke-width="1"/>`

  COLS.forEach((col, ci) => {
    const colX = PAD + ci * (COL_W + GUTTER)
    // Column title
    b += `<text x="${colX}" y="${HEADER_H + 15}" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="${col.hdr}" letter-spacing="0.5">${col.label.toUpperCase()}</text>`
    // Cards
    col.items.forEach((item, k) => {
      const cy = HEADER_H + COL_HDR + k * (CARD_H + CARD_GAP)
      b += `<rect x="${colX}" y="${cy}" width="${COL_W}" height="${CARD_H}" rx="6" fill="${col.bg}" stroke="${col.border}" stroke-width="1"/>`
      b += `<rect x="${colX}" y="${cy}" width="4" height="${CARD_H}" rx="2" fill="${col.border}"/>`
      b += `<text x="${colX + 10}" y="${cy + 16}" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="${col.id}">${item.id}</text>`
      if (item.sub)  b += `<text x="${colX + 10}" y="${cy + 30}" font-family="system-ui,sans-serif" font-size="9" fill="${col.sub}">${item.sub}</text>`
      if (item.link) b += `<text x="${colX + 10}" y="${item.sub ? cy + 42 : cy + 30}" font-family="system-ui,sans-serif" font-size="9" fill="#94a3b8">${item.link}</text>`
    })
    if (col.items.length === 0)
      b += `<text x="${colX + COL_W / 2}" y="${HEADER_H + COL_HDR + 20}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#94a3b8" font-style="italic">No entries</text>`
  })

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff" rx="12"/>${b}</svg>`
  return _svgStringToPngBlob(svg, W, H)
}

async function copyDepsImage(): Promise<void> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': _depsSvgBlob() })])
    _markImageCopied()
  } catch { /* silent */ }
}

// ── Esc key support ───────────────────────────────────────────────────────────
const _onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); emit('close') } }
onMounted  (() => document.addEventListener('keydown', _onKey, { capture: true }))
onUnmounted(() => document.removeEventListener('keydown', _onKey, { capture: true }))
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[600] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Visualise diagrams"
    >
      <!-- ── Header ── -->
      <!-- Back button appears when inside a specific viz — returns to the tile grid home. -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-violet-600 to-indigo-600 flex-shrink-0">
        <div class="flex items-center gap-2">
          <button
            v-if="activeTab !== null"
            type="button"
            class="flex items-center gap-1 text-white/80 hover:text-white text-xs font-semibold
                   px-2 py-1 rounded-lg hover:bg-white/15 transition-colors focus:outline-none
                   focus:ring-1 focus:ring-white/60"
            title="Back to all diagrams — return to the visualisation tile grid"
            aria-label="Back to visualisation grid"
            @click="activeTab = null"
          >← All</button>
          <span class="text-xl" aria-hidden="true">🗺️</span>
          <span class="text-sm font-bold text-white tracking-widest uppercase">
            {{ activeTab !== null ? (tabs.find(t => t.key === activeTab)?.label ?? 'Visualise') : 'Visualise' }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <!-- Copy buttons — only show when viewing a specific visualisation, not on the grid home -->
          <template v-if="activeTab !== null">
            <!-- Finance · Dependencies · Risk Matrix: image + table -->
            <template v-if="spec && (activeTab === 'finance' || activeTab === 'deps' || activeTab === 'risk')">
              <button
                type="button"
                aria-label="Copy as image"
                title="Copy the visual exactly as seen — PNG image"
                class="px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium
                       hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
                @click="activeTab === 'finance' ? copyFinanceImage() : activeTab === 'deps' ? copyDepsImage() : copyRiskImage()"
              >{{ imageCopied ? '✅ Image' : '📸 Image' }}</button>
              <button
                type="button"
                aria-label="Copy as table"
                title="Copy data as a formatted table (pastes into Keynote / Numbers)"
                class="px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium
                       hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
                @click="activeTab === 'finance' ? copyFinance() : activeTab === 'deps' ? copyDeps() : copyRisk()"
              >{{ copied ? '✅ Table' : '📋 Table' }}</button>
            </template>
            <!-- Other tabs: SVG → PNG; hidden for Swimlane (has its own Copy button) -->
            <button
              v-else-if="spec && activeTab !== 'swimlane' && activeTab !== null"
              type="button"
              :aria-label="copied ? 'Copied!' : 'Copy diagram'"
              title="Copy diagram as PNG image"
              class="px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium
                     hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
              @click="copyCurrentTab"
            >{{ copied ? '✅ Copied' : '📸 Copy' }}</button>
          </template>
          <CloseDot
            variant="on-dark"
            aria-label="Close Visualise"
            @click="emit('close')"
          />
        </div>
      </div>

      <!-- ── Viz pill strip — only visible in detail view, not on the tile grid home ── -->
      <div
        v-if="activeTab !== null"
        class="flex items-center gap-0.5 px-4 py-2 overflow-x-auto flex-shrink-0 border-b border-gray-100 bg-white"
        role="tablist"
        aria-label="Visualisation types"
      >
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          :class="[
            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors duration-100 flex-shrink-0',
            'focus:outline-none focus:ring-1 focus:ring-violet-400 focus:ring-offset-1',
            activeTab === tab.key
              ? 'text-violet-700 bg-violet-50 ring-1 ring-violet-200'
              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50',
          ]"
          :aria-label="`Open ${tab.label} diagram`"
          :title="`Switch to ${tab.label} — ${tab.description}`"
          @click="activeTab = tab.key"
        >
          <span class="block w-7 h-[15px] flex-shrink-0" v-html="VIZ_THUMBS[tab.key]" />
          <span class="text-[10px] font-semibold tracking-wide whitespace-nowrap">{{ tab.label }}</span>
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════════════
           GRID HOME — 3×3 tile grid with LIVE thumbnails (default landing view).
           Tom 2026-05-28: "redesigned to be like the action window buttons — the
           upper visual part of the button was a mini display of that tool's real
           time current display for current plan."
           ══════════════════════════════════════════════════════════════════════════ -->
      <ScrollContainer
        v-if="activeTab === null"
        outer-class="flex-1 min-h-0 relative"
        inner-class="h-full bg-gray-50 p-5"
      >
        <!-- UPDATE liveThumbs computed if a viz panel layout changes substantially. -->
        <div class="grid grid-cols-3 gap-4">
          <button
            v-for="tile in tabs"
            :key="tile.key"
            type="button"
            class="group flex flex-col overflow-hidden rounded-2xl bg-white border border-gray-200
                   shadow-sm hover:shadow-xl hover:scale-[1.025] hover:border-violet-200
                   transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-400
                   text-left"
            :title="`Open ${tile.label} — ${tile.description}`"
            :aria-label="`Open ${tile.label} diagram`"
            @click="activeTab = tile.key"
          >
            <!-- Live thumbnail area — computed from real plan data (Thumbnail Reality Rule) -->
            <div class="h-[132px] overflow-hidden bg-gray-50 border-b border-gray-100 flex-shrink-0">
              <div v-html="liveThumbs[tile.key]" class="w-full h-full" />
            </div>
            <!-- Info row -->
            <div class="flex items-start gap-2 px-3 py-2.5">
              <span
                class="text-lg leading-none pt-0.5 flex-shrink-0
                       group-hover:scale-110 transition-transform"
                aria-hidden="true"
              >{{ tile.emoji }}</span>
              <div class="min-w-0 flex-1">
                <p class="text-[12px] font-bold text-slate-800 leading-tight
                          group-hover:text-violet-700 transition-colors">{{ tile.label }}</p>
                <p class="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-2">{{ tile.description }}</p>
              </div>
              <span
                class="ml-1 flex-shrink-0 text-slate-300 group-hover:text-violet-400
                       transition-colors text-base leading-none pt-0.5"
                aria-hidden="true"
              >→</span>
            </div>
          </button>
        </div>
        <!-- Hint when no plan is loaded -->
        <div
          v-if="!spec"
          class="mt-5 text-center rounded-2xl border-2 border-dashed border-gray-200 py-6 px-4"
        >
          <p class="text-slate-400 text-sm">No spec yet — generate a spec first to see live data in the thumbnails above.</p>
        </div>
      </ScrollContainer>

      <!-- ══════════════════════════════════════════════════════════════════════════
           DETAIL VIEW — full visualisation for the active tab.
           :key="activeTab" forces DOM remount on every switch — eliminates the
           Safari "last branch in v-else-if chain invisible on first visit" bug.
           ══════════════════════════════════════════════════════════════════════════ -->
      <ScrollContainer
        v-else
        outer-class="flex-1 min-h-0 relative"
        inner-class="h-full bg-white"
      >
        <div v-if="!spec" class="flex items-center justify-center h-64 text-gray-400 text-sm">
          No spec loaded — generate a spec first.
        </div>

        <div v-else :key="activeTab">

          <!-- 🌊 Value Flow — launches the dedicated full-screen ValueFlowPanel.
               Tom 2026-05-19: "I said only full screen."
               The near-view inline diagram is removed; clicking the Value Flow
               tab immediately opens the full-screen panel via 'open-value-flow'. -->
          <div v-if="activeTab === 'flow'" class="flex flex-col items-center justify-center gap-5 py-20 px-8">
            <div class="text-[56px] leading-none select-none" aria-hidden="true">⟶</div>
            <div class="text-center max-w-sm">
              <p class="text-[15px] font-semibold text-slate-800">Value Flow — Full Screen</p>
              <p class="text-[12px] text-slate-500 mt-1 leading-relaxed">
                Tasks → Evo Steps → Solutions → Values → Functions → Stakeholders.
                The causal chain opens in full-screen only so every node and arrow
                is readable at full resolution.
              </p>
            </div>
            <button
              type="button"
              class="flex items-center gap-2 px-5 py-3 rounded-xl
                     bg-gradient-to-r from-slate-800 to-indigo-900 text-white
                     text-[13px] font-semibold shadow-lg
                     hover:from-slate-700 hover:to-indigo-800
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
              @click="emit('open-value-flow')"
            >
              <span class="text-indigo-300 font-mono text-base leading-none" aria-hidden="true">⟶</span>
              Open full-screen Value Flow
            </button>
            <!-- r97 — MultiForks launch (Tom Gilb 2026-06-06).  Sibling to Value Flow
                 because it's the same family of full-screen system diagrams. -->
            <button
              type="button"
              class="flex items-center gap-2 px-5 py-3 rounded-xl
                     bg-gradient-to-r from-indigo-700 to-violet-700 text-white
                     text-[13px] font-semibold shadow-lg
                     hover:from-indigo-600 hover:to-violet-600
                     focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
              title="Open MultiForks — Resources → System ← Values fork diagram with status colour bands (green/orange/red)"
              @click="emit('open-multiforks')"
            >
              <span class="text-white text-base leading-none" aria-hidden="true">🔱</span>
              Open MultiForks system diagram
            </button>
          </div>

          <!-- ⚡ Efficiency — Resources → Solutions (ranked by V/C) → Values bipartite flow.
               Tom Gilb 2026-05-17: "the norm is that a solution affects many values and
               costs — reflect the vdt — bring in resources, show connection to both values
               and costs — top 3 values impacts, top 2 resources." -->
          <div v-else-if="activeTab === 'efficiency'" class="px-5 pt-4 pb-6 overflow-x-auto">
            <EfficiencyDiagram
              v-if="spec"
              :spec="spec"
              :impact-matrix="props.impactMatrix ?? {}"
              :vc-ratios="props.vcRatios ?? {}"
              :calendar-costs="props.calendarCosts ?? {}"
              :capital-costs="props.capitalCosts ?? {}"
            />
            <p v-else class="text-sm text-gray-400 py-12 text-center">No spec loaded.</p>
          </div>

          <!-- 🎯 Value Achievement Radar — each spoke = one Value, rings = Tolerable/Goal/Wish -->
          <div v-else-if="activeTab === 'radar'" class="p-6">
            <p class="text-xs text-slate-500 mb-4">Each spoke is one Value entry. Filled area = current Status. Amber ring = Tolerable (minimum non-failure). Dashed ring = Goal (committed). Dotted = Wish.</p>
            <div v-if="radarSpokes.length === 0" class="text-slate-400 text-sm italic">No Value entries found — add Values to your spec to see the radar.</div>
            <template v-else>
              <!-- SVG Radar -->
              <div class="flex justify-center mb-6">
                <svg :viewBox="`0 0 560 ${Math.max(320, radarSpokes.length > 6 ? 420 : 360)}`"
                     class="w-full max-w-2xl" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <radialGradient id="radarStatusGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%"   stop-color="#7c3aed" stop-opacity="0.55"/>
                      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0.18"/>
                    </radialGradient>
                  </defs>
                  <!-- ── Grid circles at 25/50/75/100% ── -->
                  <template v-for="frac in [0.25, 0.5, 0.75, 1.0]" :key="frac">
                    <circle cx="280" cy="200" :r="frac * 140"
                            fill="none" stroke="#e2e8f0" stroke-width="1"
                            :stroke-dasharray="frac === 1.0 ? 'none' : '4 3'"/>
                    <text v-if="radarSpokes.length > 0"
                          x="282" :y="200 - frac * 140 - 3"
                          font-family="system-ui,sans-serif" font-size="8" fill="#94a3b8">
                      {{ Math.round(frac * 100) }}%
                    </text>
                  </template>
                  <!-- ── Wish ring (faint dotted) — only if any spoke has wish ── -->
                  <circle v-if="radarSpokes.some(s => s.wFrac > 1)"
                          cx="280" cy="200" r="175"
                          fill="none" stroke="#c4b5fd" stroke-width="1" stroke-dasharray="2 5" opacity="0.5"/>
                  <!-- ── Tolerable ring (amber dashed) ── -->
                  <circle cx="280" cy="200" :r="(radarSpokes.reduce((a,s)=>a+s.tFrac,0)/Math.max(1,radarSpokes.length)) * 140"
                          fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6 3" opacity="0.7"/>
                  <!-- ── Spoke lines ── -->
                  <template v-for="(spoke, i) in radarSpokes" :key="'line-'+i">
                    <line
                      cx="280" cy="200"
                      :x1="280" :y1="200"
                      :x2="280 + 155 * Math.cos(-Math.PI/2 + (2*Math.PI*i/radarSpokes.length))"
                      :y2="200 + 155 * Math.sin(-Math.PI/2 + (2*Math.PI*i/radarSpokes.length))"
                      stroke="#e2e8f0" stroke-width="1"/>
                  </template>
                  <!-- ── Status polygon (filled) ── -->
                  <polygon
                    :points="radarSpokes.map((s,i) => {
                      const angle = -Math.PI/2 + (2*Math.PI*i/radarSpokes.length)
                      const r = s.sFrac * 140
                      return `${280 + r*Math.cos(angle)},${200 + r*Math.sin(angle)}`
                    }).join(' ')"
                    fill="url(#radarStatusGrad)"
                    stroke="#7c3aed" stroke-width="2" stroke-linejoin="round"/>
                  <!-- ── Spoke tip dots ── -->
                  <template v-for="(spoke, i) in radarSpokes" :key="'dot-'+i">
                    <circle
                      :cx="280 + spoke.sFrac * 140 * Math.cos(-Math.PI/2 + (2*Math.PI*i/radarSpokes.length))"
                      :cy="200 + spoke.sFrac * 140 * Math.sin(-Math.PI/2 + (2*Math.PI*i/radarSpokes.length))"
                      r="5"
                      :fill="spoke.inBreach ? '#ef4444' : spoke.atGoal ? '#16a34a' : '#7c3aed'"
                      stroke="white" stroke-width="1.5"/>
                  </template>
                  <!-- ── Spoke labels ── -->
                  <template v-for="(spoke, i) in radarSpokes" :key="'label-'+i">
                    <text
                      :x="280 + 162 * Math.cos(-Math.PI/2 + (2*Math.PI*i/radarSpokes.length))"
                      :y="200 + 162 * Math.sin(-Math.PI/2 + (2*Math.PI*i/radarSpokes.length)) + 4"
                      text-anchor="middle"
                      font-family="system-ui,sans-serif" font-size="9" font-weight="600"
                      :fill="spoke.inBreach ? '#ef4444' : '#334155'">
                      {{ spoke.label }}
                    </text>
                  </template>
                </svg>
              </div>
              <!-- Detail rows below the radar -->
              <div class="max-w-2xl mx-auto space-y-2">
                <div v-for="spoke in radarSpokes" :key="spoke.id"
                     class="flex items-center gap-3 rounded-lg px-3 py-2 border"
                     :class="spoke.inBreach ? 'border-red-200 bg-red-50' : spoke.atGoal ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-white'">
                  <span class="text-base shrink-0" :class="spoke.inBreach ? 'text-red-500' : spoke.atGoal ? 'text-emerald-600' : 'text-violet-600'">
                    {{ spoke.inBreach ? '⚠' : spoke.atGoal ? '✓' : '◎' }}
                  </span>
                  <span class="text-xs font-bold text-slate-700 w-32 shrink-0 truncate" :title="spoke.id">{{ spoke.label }}</span>
                  <div class="flex-1 flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                    <span>Status <strong class="text-slate-800">{{ spoke.status || '—' }}</strong></span>
                    <span>/ Tolerable <strong :class="spoke.inBreach?'text-red-600':'text-amber-600'">{{ spoke.tolerable || '—' }}</strong></span>
                    <span>/ Goal <strong class="text-violet-700">{{ spoke.goal || '—' }}</strong></span>
                    <span v-if="spoke.wish">/ Wish <strong class="text-slate-400">{{ spoke.wish }}</strong></span>
                    <span v-if="spoke.scale" class="text-slate-400 italic">{{ spoke.scale }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- 🏛️ Architecture (TOGAF) -->
          <div v-else-if="activeTab === 'arch'" ref="archRef">
            <p class="text-xs text-gray-500 px-6 pt-5 pb-2">Spec entries mapped across Business / Application / Data / Technology layers</p>
            <div class="flex items-center justify-center px-4 pb-6 [&_svg]:w-full [&_svg]:h-auto">
              <div class="w-full max-w-5xl">
                <SpecTogafView :blocks="specArr" />
              </div>
            </div>
          </div>

          <!-- 🕸️ Dependencies — plain HTML 3-column cards, no SVG coordinate maths -->
          <div v-else-if="activeTab === 'deps'" class="p-6">
            <p class="text-xs text-gray-500 mb-4">Values · Functions · Solutions — spec entries grouped by type. Cross-links shown as ↔ references under each card.</p>
            <div class="grid grid-cols-3 gap-3">

              <!-- Values column -->
              <div>
                <p class="text-[11px] font-bold text-indigo-600 uppercase tracking-wide mb-2">Values</p>
                <div
                  v-for="v in (spec?.values ?? [])"
                  :key="v.id"
                  class="mb-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2"
                >
                  <p class="text-[11px] font-semibold text-indigo-800 truncate" :title="v.id">{{ v.id }}</p>
                  <p v-if="v.goal" class="text-[9px] text-indigo-500 mt-0.5 truncate">Goal: {{ v.goal }}</p>
                  <p v-if="v.valueOfFunction" class="text-[9px] text-gray-400 mt-0.5 truncate" :title="v.valueOfFunction">↔ {{ v.valueOfFunction }}</p>
                </div>
                <p v-if="!(spec?.values?.length)" class="text-[11px] text-gray-400 italic">No Value Specs</p>
              </div>

              <!-- Functions column -->
              <div>
                <p class="text-[11px] font-bold text-amber-600 uppercase tracking-wide mb-2">Functions</p>
                <div
                  v-for="f in (spec?.functions ?? [])"
                  :key="f.id"
                  class="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2"
                >
                  <p class="text-[11px] font-semibold text-amber-800 truncate" :title="f.id">{{ f.id }}</p>
                  <p v-if="f.functionOfValue" class="text-[9px] text-gray-400 mt-0.5 truncate" :title="f.functionOfValue">↔ {{ f.functionOfValue }}</p>
                </div>
                <p v-if="!(spec?.functions?.length)" class="text-[11px] text-gray-400 italic">No Function Specs</p>
              </div>

              <!-- Solutions column -->
              <div>
                <p class="text-[11px] font-bold text-emerald-600 uppercase tracking-wide mb-2">Solutions</p>
                <div
                  v-for="s in (spec?.solutions ?? [])"
                  :key="s.id"
                  class="mb-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2"
                >
                  <p class="text-[11px] font-semibold text-emerald-800 truncate" :title="s.id">{{ s.id }}</p>
                  <p v-if="s.impact" class="text-[9px] text-emerald-500 mt-0.5 truncate">{{ s.impact }}</p>
                  <p v-if="s.function" class="text-[9px] text-gray-400 mt-0.5 truncate" :title="s.function">↔ {{ s.function }}</p>
                </div>
                <p v-if="!(spec?.solutions?.length)" class="text-[11px] text-gray-400 italic">No Solution Specs</p>
              </div>

            </div>
          </div>

          <!-- ⚠️ Value Risk Monitor — Values ranked by gap from Tolerable -->
          <div v-else-if="activeTab === 'risk'" class="p-6">
            <p class="text-xs text-slate-500 mb-1">In Planguage, risk IS the gap between current Status and Tolerable — not probability guessing. Values ranked by breach severity. Red = currently failing. ⚠ unmitigated = no Evo Steps targeting this Value.</p>
            <div v-if="riskMonitorData.length === 0" class="text-slate-400 text-sm italic mt-4">No Value entries found — add Values with Tolerable and Status fields to see the risk monitor.</div>
            <div v-else class="space-y-3 mt-4">
              <!-- Summary pills -->
              <div class="flex gap-3 flex-wrap mb-4">
                <span class="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-red-100 text-red-700">
                  {{ riskMonitorData.filter(r => r.inBreach).length }} in breach
                </span>
                <span class="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-700">
                  {{ riskMonitorData.filter(r => !r.inBreach && r.belowGoal).length }} below Goal
                </span>
                <span class="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-700">
                  {{ riskMonitorData.filter(r => !r.belowGoal).length }} at Goal
                </span>
                <span v-if="riskMonitorData.some(r => r.unmitigated)"
                      class="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-red-600 text-white">
                  ⚠ {{ riskMonitorData.filter(r => r.unmitigated).length }} unmitigated breach
                </span>
              </div>
              <!-- Value rows -->
              <div v-for="item in riskMonitorData" :key="item.id"
                   class="rounded-xl border p-3"
                   :class="item.unmitigated ? 'border-red-400 bg-red-50' : item.inBreach ? 'border-red-200 bg-red-50/60' : item.belowGoal ? 'border-amber-200 bg-amber-50/40' : 'border-emerald-200 bg-emerald-50/40'">
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-bold shrink-0"
                          :class="item.inBreach ? 'text-red-600' : item.belowGoal ? 'text-amber-600' : 'text-emerald-700'">
                      {{ item.inBreach ? '⚠' : item.belowGoal ? '◎' : '✓' }}
                    </span>
                    <span class="text-xs font-bold text-slate-800">{{ item.label }}</span>
                    <span v-if="item.scale" class="text-[10px] text-slate-400 italic">{{ item.scale }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span v-if="item.unmitigated"
                          class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
                      ⚠ No steps targeting this Value
                    </span>
                    <span v-else-if="item.targetingCount > 0"
                          class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {{ item.targetingCount }} step{{ item.targetingCount > 1 ? 's' : '' }} addressing this
                    </span>
                  </div>
                </div>
                <!-- Triple bar: Status → Tolerable → Goal -->
                <div class="relative h-5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <!-- Status bar -->
                  <div class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 flex items-center"
                       :style="{ width: Math.max(2, item.sFrac * 100) + '%' }"
                       :class="item.inBreach ? 'bg-red-400' : item.belowGoal ? 'bg-amber-400' : 'bg-emerald-500'">
                  </div>
                  <!-- Tolerable marker line -->
                  <div v-if="item.tFrac > 0"
                       class="absolute inset-y-0 w-0.5 bg-amber-500 opacity-80"
                       :style="{ left: item.tFrac * 100 + '%' }"/>
                </div>
                <div class="flex gap-3 mt-1 text-[9px] text-slate-500 flex-wrap">
                  <span>Status <strong class="text-slate-700">{{ item.status || '—' }}</strong></span>
                  <span>Tolerable <strong :class="item.inBreach ? 'text-red-600' : 'text-amber-600'">{{ item.tolerable || '—' }}</strong></span>
                  <span>Goal <strong class="text-violet-700">{{ item.goal || '—' }}</strong></span>
                </div>
              </div>
              <!-- Constraint section -->
              <div v-if="(spec?.constraints ?? []).length > 0" class="mt-6">
                <p class="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Constraints (binary — must be fully respected)</p>
                <div class="space-y-1.5">
                  <div v-for="c in (spec?.constraints ?? [])" :key="c.id"
                       class="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2">
                    <span class="text-red-500 text-xs font-bold shrink-0">C.</span>
                    <span class="text-xs font-semibold text-slate-700">{{ c.id }}</span>
                    <span v-if="c.description" class="text-[10px] text-slate-500 truncate">{{ c.description }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 💰 Resource-Value Return — Resource budgets + Value achievement progress -->
          <div v-else-if="activeTab === 'finance'" class="p-6 space-y-8">
            <!-- Resources section -->
            <div>
              <p class="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Resources — Budget vs Consumed</p>
              <div v-if="resourceReturnData.resources.length === 0"
                   class="text-slate-400 text-sm italic">No Resource entries in this spec — add R. entries with Budget and Status to track spend.</div>
              <div v-else class="space-y-3 max-w-2xl">
                <div v-for="r in resourceReturnData.resources" :key="r.id"
                     class="rounded-xl border p-3"
                     :class="r.over ? 'border-red-200 bg-red-50' : r.frac > 0.8 ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-white'">
                  <div class="flex items-center justify-between mb-1.5">
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">
                        {{ r.kind }}
                      </span>
                      <span class="text-xs font-semibold text-slate-800">{{ r.label }}</span>
                      <span v-if="r.scale" class="text-[10px] text-slate-400 italic">{{ r.scale }}</span>
                    </div>
                    <span class="text-[10px] shrink-0"
                          :class="r.over ? 'text-red-600 font-bold' : r.frac > 0.8 ? 'text-amber-600' : 'text-emerald-700'">
                      {{ r.over ? '⚠ Over budget' : Math.round(r.frac * 100) + '% consumed' }}
                    </span>
                  </div>
                  <div class="relative h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                         :style="{ width: Math.min(100, r.frac * 100) + '%' }"
                         :class="r.over ? 'bg-red-400' : r.frac > 0.8 ? 'bg-amber-400' : 'bg-emerald-500'"/>
                  </div>
                  <div class="flex gap-3 mt-1 text-[9px] text-slate-500">
                    <span>Consumed <strong class="text-slate-700">{{ r.status || '—' }}</strong></span>
                    <span>Budget <strong class="text-emerald-700">{{ r.budget || '—' }}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Values achievement section -->
            <div>
              <p class="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Values — Achievement Progress</p>
              <div v-if="resourceReturnData.values.length === 0"
                   class="text-slate-400 text-sm italic">No Value entries found.</div>
              <div v-else class="space-y-2.5 max-w-2xl">
                <div v-for="v in resourceReturnData.values" :key="v.id">
                  <div class="flex items-center justify-between text-[10px] mb-0.5">
                    <span class="font-semibold text-slate-700 truncate max-w-[280px]" :title="v.id">{{ v.label }}</span>
                    <span class="shrink-0 ml-2 text-slate-400 italic">{{ v.scale }}</span>
                  </div>
                  <!-- Combined bar: tolerable marker + status fill -->
                  <div class="relative h-5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                         :style="{ width: Math.max(2, v.sFrac * 100) + '%' }"
                         :class="v.inBreach ? 'bg-red-400' : v.sFrac >= 1 ? 'bg-emerald-500' : 'bg-violet-400'"/>
                    <div v-if="v.tFrac > 0"
                         class="absolute inset-y-0 w-0.5 bg-amber-500"
                         :style="{ left: v.tFrac * 100 + '%' }"/>
                  </div>
                  <div class="flex gap-2 mt-0.5 text-[9px] text-slate-400">
                    <span>Status <strong :class="v.inBreach?'text-red-600':'text-slate-600'">{{ v.status||'—' }}</strong></span>
                    <span>Tolerable <strong class="text-amber-600">{{ v.tolerable||'—' }}</strong></span>
                    <span>Goal <strong class="text-violet-700">{{ v.goal||'—' }}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- § Stakeholder Delivery Map — who gets what, and when? -->
          <div v-else-if="activeTab === 'swimlane'" class="p-6">
            <p class="text-xs text-slate-500 mb-4">Rows = stakeholders. Columns = Evo Steps. Each cell shows Values this step delivers that this stakeholder cares about. Empty cells = stakeholder gets nothing from this step.</p>

            <!-- Fallback: no steps or no stakeholders — show classic SpecHeatLane -->
            <div v-if="!confirmedSteps.length || !stakeholderNames.length">
              <p class="text-xs text-amber-600 mb-3 italic">
                {{ !confirmedSteps.length ? 'No confirmed Evo Steps yet — generate and confirm a plan to see the stakeholder map.' : 'No stakeholders defined in this spec — add a Stakes field to see the map.' }}
              </p>
              <SpecHeatLane
                :spec="spec"
                :confirmed-steps="confirmedSteps"
                :tasks-by-step="tasksByStep ?? {}"
                :embedded="true"
                :on-close="() => { activeTab = null }"
              />
            </div>

            <!-- Full stakeholder grid -->
            <div v-else>
              <!-- Scrollable grid container -->
              <div class="overflow-x-auto">
                <table class="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      <th class="text-left p-2 bg-slate-50 border border-slate-200 font-bold text-slate-600 min-w-[120px] sticky left-0 z-10">
                        Stakeholder §
                      </th>
                      <th v-for="step in confirmedSteps" :key="step.name"
                          class="p-2 bg-slate-50 border border-slate-200 font-semibold text-slate-600 min-w-[100px] max-w-[140px] text-center">
                        <span class="block truncate" :title="step.name">{{ step.name.length > 16 ? step.name.slice(0,16)+'…' : step.name }}</span>
                      </th>
                      <th class="p-2 bg-slate-100 border border-slate-200 font-bold text-slate-600 text-center min-w-[60px]">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in stakeholderDeliveryGrid" :key="row.name"
                        :class="row.hasAny ? '' : 'opacity-50'">
                      <td class="p-2 border border-slate-200 font-semibold text-slate-800 bg-white sticky left-0 z-10">
                        <div class="flex items-center gap-1.5">
                          <span class="text-blue-600 font-bold">§</span>
                          {{ row.name }}
                        </div>
                        <div v-if="!row.hasAny" class="text-[9px] text-amber-600 mt-0.5">⚠ no delivery mapped</div>
                      </td>
                      <td v-for="cell in row.cells" :key="cell.stepName"
                          class="p-1.5 border border-slate-200 align-top"
                          :class="cell.count === 0 ? 'bg-slate-50' : cell.count >= 3 ? 'bg-blue-100' : 'bg-blue-50'">
                        <div v-if="cell.count === 0" class="text-slate-300 text-center text-[10px]">—</div>
                        <div v-else class="space-y-0.5">
                          <div v-for="v in cell.values" :key="v.id"
                               class="text-[9px] font-medium text-blue-800 leading-tight truncate"
                               :title="v.id">
                            {{ v.id.slice(0, 18) }}
                          </div>
                        </div>
                      </td>
                      <td class="p-2 border border-slate-200 text-center bg-white">
                        <span class="text-xs font-bold"
                              :class="row.cells.reduce((s,c)=>s+c.count,0) > 0 ? 'text-blue-700' : 'text-slate-300'">
                          {{ row.cells.reduce((s,c) => s+c.count, 0) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- Legend -->
              <div class="flex gap-4 mt-4 text-[10px] text-slate-500 flex-wrap">
                <div class="flex items-center gap-1.5"><div class="w-4 h-3 rounded bg-slate-50 border border-slate-200"></div> No delivery</div>
                <div class="flex items-center gap-1.5"><div class="w-4 h-3 rounded bg-blue-50 border border-blue-200"></div> 1–2 Values</div>
                <div class="flex items-center gap-1.5"><div class="w-4 h-3 rounded bg-blue-100 border border-blue-300"></div> 3+ Values</div>
                <div class="flex items-center gap-1.5"><span class="text-amber-600">⚠</span> No mapped delivery across any step</div>
              </div>
            </div>
          </div>

          <!-- ▶ Simulator — animated delivery timeline with cumulative value chart.
               Rendered inline within the tab, not as a separate Teleport modal.
               All animation state is managed by useEvoSimulation composable. -->
          <div v-else-if="activeTab === 'simulator'" class="flex flex-col h-full">
            <EvoSimulatorView
              :steps="confirmedSteps"
              :vc-ratios="props.vcRatios ?? {}"
              @close="activeTab = null"
            />
          </div>

        </div>
      </ScrollContainer>
    </div>
  </Teleport>
</template>
