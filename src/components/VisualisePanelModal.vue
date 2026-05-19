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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import type { ImpactMatrix } from '../types/impact'
import EfficiencyDiagram from './EfficiencyDiagram.vue'
import SpecHeatLane    from './SpecHeatLane.vue'
import SpecTechRadar   from './SpecTechRadar.vue'
import SpecTogafView   from './SpecTogafView.vue'

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
type Tab = 'flow' | 'efficiency' | 'radar' | 'arch' | 'deps' | 'risk' | 'finance' | 'swimlane'
const activeTab = ref<Tab>(props.initialTab ?? 'flow')

const tabs: { key: Tab; label: string; description: string }[] = [
  { key: 'flow',       label: 'Value Flow',  description: 'Causal chain: Tasks → Solutions → Values → Stakeholders' },
  { key: 'efficiency', label: '⚡ Efficiency', description: 'Resources → Solutions (ranked by V/C) → Values — edge width = impact %' },
  { key: 'radar',      label: 'Radar',       description: 'Solutions on Adopt / Trial / Assess / Hold rings'        },
  { key: 'arch',       label: 'Architecture',description: 'Business / Application / Data / Technology layers'       },
  { key: 'deps',       label: 'Dependencies',description: 'Values · Functions · Solutions with cross-links'         },
  { key: 'risk',       label: 'Risk Matrix', description: 'Functions by probability × impact heuristic'             },
  { key: 'finance',    label: 'Finance',     description: 'Value targets: tolerable vs goal as progress bars'       },
  { key: 'swimlane',   label: 'Swimlane',    description: 'Evo steps × spec entries heat-map stage map'            },
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
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-violet-600 to-indigo-600 flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-xl" aria-hidden="true">🗺️</span>
          <span class="text-sm font-bold text-white tracking-widest uppercase">Visualise</span>
        </div>
        <div class="flex items-center gap-2">
          <!-- Finance · Dependencies · Risk Matrix: image + table (HTML tabs, not SVG) -->
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
          <!-- Value Flow · Radar · Architecture: SVG → PNG (single copy button)
               Hidden for Swimlane — SpecHeatLane has its own Copy button. -->
          <button
            v-else-if="spec && activeTab !== 'swimlane'"
            type="button"
            :aria-label="copied ? 'Copied!' : 'Copy diagram'"
            title="Copy diagram as PNG image"
            class="px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium
                   hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
            @click="copyCurrentTab"
          >
            {{ copied ? '✅ Copied' : '📸 Copy' }}
          </button>
          <CloseDot
            variant="on-dark"
            aria-label="Close Visualise"
            @click="emit('close')"
          />
        </div>
      </div>

      <!-- ── Viz pill strip — same style as EvoPlanView row 1, one pill per diagram ── -->
      <div
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
          @click="activeTab = tab.key"
        >
          <span class="block w-7 h-[15px] flex-shrink-0" v-html="VIZ_THUMBS[tab.key]" />
          <span class="text-[10px] font-semibold tracking-wide whitespace-nowrap">{{ tab.label }}</span>
        </button>
        <span class="w-px h-4 bg-slate-200 mx-1 flex-shrink-0" aria-hidden="true" />
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 flex-shrink-0
                 text-slate-400 hover:text-violet-700 hover:bg-violet-50 transition-colors duration-100
                 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:ring-offset-1"
          aria-label="Open Evo Simulator — animated delivery timeline"
          @click="emit('open-evo-simulator')"
        >
          <span class="text-sm leading-none">▶</span>
          <span class="text-[10px] font-semibold tracking-wide whitespace-nowrap">Simulate</span>
        </button>
      </div>

      <!-- ── Tab content ── -->
      <!-- :key="activeTab" on the v-else wrapper forces a full DOM remount on every tab
           switch — eliminating Safari's "last branch in v-else-if chain invisible on first
           visit" bug.  All 8 tabs are in the single chain; Finance is no longer a standalone
           v-if.  Swimlane is last but the :key remount makes that safe. -->
      <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full bg-white">

        <!-- Empty state -->
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

          <!-- 🎯 Tech Radar -->
          <div v-else-if="activeTab === 'radar'" ref="radarRef">
            <p class="text-xs text-gray-500 px-6 pt-5 pb-2">Solution entries classified Adopt / Trial / Assess / Hold</p>
            <div class="flex items-center justify-center px-4 pb-6 [&_svg]:w-full [&_svg]:h-auto">
              <div class="w-full max-w-3xl">
                <SpecTechRadar :blocks="specArr" />
              </div>
            </div>
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
                <p v-if="!(spec?.values?.length)" class="text-[11px] text-gray-400 italic">No V. entries</p>
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
                <p v-if="!(spec?.functions?.length)" class="text-[11px] text-gray-400 italic">No F. entries</p>
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
                <p v-if="!(spec?.solutions?.length)" class="text-[11px] text-gray-400 italic">No S. entries</p>
              </div>

            </div>
          </div>

          <!-- ⚠️ Risk Matrix -->
          <div v-else-if="activeTab === 'risk'" class="p-6">
            <p class="text-xs text-gray-500 mb-3">Functions classified by estimated probability × impact — based on level and keyword heuristics</p>
            <div class="w-full space-y-1.5">
              <!-- Column header row -->
              <div class="grid grid-cols-[96px_1fr_1fr_1fr] gap-2 items-center mb-2">
                <span></span>
                <span class="text-xs text-center font-bold text-gray-500 uppercase tracking-wide">Low Impact</span>
                <span class="text-xs text-center font-bold text-gray-500 uppercase tracking-wide">Med Impact</span>
                <span class="text-xs text-center font-bold text-gray-500 uppercase tracking-wide">High Impact</span>
              </div>
              <!-- Data rows -->
              <div
                v-for="(probLabel, pi) in ['Low Prob', 'Med Prob', 'High Prob']"
                :key="pi"
                class="grid grid-cols-[96px_1fr_1fr_1fr] gap-2 items-stretch"
              >
                <span
                  class="text-xs font-bold uppercase text-right pt-3 pr-2"
                  :class="pi === 2 ? 'text-red-500' : pi === 1 ? 'text-amber-500' : 'text-emerald-600'"
                >{{ probLabel }}</span>
                <div
                  v-for="ii in [0, 1, 2]"
                  :key="ii"
                  class="min-h-[96px] rounded-xl p-3 text-[11px] leading-snug"
                  :style="{ backgroundColor: RISK_CELL_COLOUR[pi][ii] }"
                >
                  <div v-if="riskGrid[pi][ii].length === 0" class="text-gray-400 italic">—</div>
                  <div
                    v-for="item in riskGrid[pi][ii]"
                    :key="item.label"
                    class="mb-1 font-semibold text-gray-700"
                    :title="item.label"
                  >{{ item.label }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 💰 Finance — Value targets as progress bars (tolerable faded / goal solid).
               Moved back into the chain (was standalone v-if to work around a Safari last-branch
               bug).  The :key on the wrapper div now remounts the entire block on every tab
               switch, so the last-branch bug cannot occur regardless of chain position. -->
          <div v-else-if="activeTab === 'finance'" class="p-6">
            <p class="text-xs text-gray-500 mb-4">Value entries — tolerable (lighter) vs goal (solid) targets extracted from scale/meter definitions. Colour = level.</p>
            <div v-if="financeItems.length === 0" class="text-gray-400 text-sm">No V. entries with numeric goals found.</div>
            <div class="space-y-3 w-full max-w-2xl">
              <div v-for="item in financeItems" :key="item.label" class="space-y-0.5">
                <div class="flex items-center justify-between text-[10px] text-gray-600">
                  <span class="font-medium truncate max-w-[260px]" :title="item.label">{{ item.label }}</span>
                  <span class="flex items-center gap-1 flex-shrink-0 ml-2">
                    <span class="w-2 h-2 rounded-sm opacity-40" :style="{ backgroundColor: LEVEL_COLOUR[item.level] ?? '#94a3b8' }"></span>
                    <span class="text-gray-400">{{ item.level }}</span>
                  </span>
                </div>
                <!-- Tolerable bar (faded) -->
                <div class="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full opacity-40 transition-[width] duration-700"
                    :style="{ width: item.tolerable + '%', backgroundColor: LEVEL_COLOUR[item.level] ?? '#94a3b8' }"
                  />
                </div>
                <!-- Goal bar (solid) -->
                <div class="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-[width] duration-700 flex items-center pl-2"
                    :style="{ width: Math.max(item.goal, 4) + '%', backgroundColor: LEVEL_COLOUR[item.level] ?? '#94a3b8' }"
                  >
                    <span v-if="item.goal > 12" class="text-white text-[9px] font-bold">{{ item.goal }}%</span>
                  </div>
                </div>
                <div class="text-[9px] text-gray-400">
                  Tolerable {{ item.tolerable }}% → Goal {{ item.goal }}%
                </div>
              </div>
            </div>
          </div>

          <!-- 🏊 Swimlane / Value Stage Map — last in chain; :key on wrapper makes this safe.
               Embedded mode: no fixed positioning so the pill strip stays visible at all times. -->
          <div v-else-if="activeTab === 'swimlane'" class="flex flex-col h-full">
            <SpecHeatLane
              :spec="spec"
              :confirmed-steps="confirmedSteps"
              :tasks-by-step="tasksByStep ?? {}"
              :embedded="true"
              :on-close="() => { activeTab = 'flow' }"
            />
          </div>

        </div>
      </ScrollContainer>
    </div>
  </Teleport>
</template>
