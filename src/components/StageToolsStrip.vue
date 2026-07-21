<!-- UNIT_TYPE=Widget -->
<!--
 * StageToolsStrip.vue — r41 v116 (Tom Gilb 2026-06-17 "I want all pins or
 * buttons to be organized into clear groups. 1. The permanent, always
 * there pins., 2. Tools for use at this stage (likePenta) and 3. Specific
 * Pins for this particular stage").
 *
 * GROUP 2 · STAGE TOOLS — a reactive cluster of tool launchers whose
 * contents change based on the active planningStage.  Replaces the
 * floating EvoTools + SpecTools + Agents + Penta + Sharpen buttons that
 * used to live wherever was convenient.  Now they appear ONLY when the
 * stage they're useful for is active, and they share the same uniform
 * visual pattern (h-10 rounded-lg, slate accents, glyph + text label per
 * Icon-Plus-Text SUPREME).
 *
 * Stage map (each entry's tools surface only when planningStage matches):
 *
 *   Stage 1 (Stakes)        → Penta · Get A Plan · Compare · Templates
 *   Stage 2 (Solutions)     → Penta · ToolBox · Compare
 *   Stage 3 (Sharpen)       → Sharpening · Standards Auditor · Spec Health
 *   Stage 4 (Impacts)       → IET · MultiVision · Impact Estimator
 *   Stage 5 (Refine)        → Refine Solutions · Penta
 *   Stage 6 (Evo Steps)     → EvoPlan · EvoCritiquer · EvoTools
 *   Stage 7 (Evo Impact)    → IET · EvoTools
 *   Stage 8 (Tasks)         → Tasks · EvoTools
 *   Stage 9 (Study-Act)     → Study-Act Loop · EvoCritiquer
 *   Stage 10 (Resources)    → Resources Sharpening · OPTIMA
 *   Stage 11 (Export)       → Export Plan · Email · Download
 *
 * Plus 🦾 Agents always available (it's stage-relevant in a different
 * sense — anywhere can benefit from an agent).
 *
 * Each tool emits an event upward; the parent (App.vue) owns the
 * surface-registry routing.
 -->
<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
// r41 v159 — wire existing mini-render Glyph SVG components per
// Tom Gilb 2026-06-17 SUPREME rule "Tool Icon = Miniature of Its Display".
// Tools whose glyph component exists get the canonical mini-render;
// others continue with emoji until their Glyph SVG is built.
import PentaGlyph        from './icons/PentaGlyph.vue'
import MultiVisionGlyph  from './icons/MultiVisionGlyph.vue'
import OptimaGlyph       from './icons/OptimaGlyph.vue'
import SharpenKnifeGlyph from './icons/SharpenKnifeGlyph.vue'
import PlanHealthGlyph   from './icons/PlanHealthGlyph.vue'
import AnalyzerGlyph     from './icons/AnalyzerGlyph.vue'
import EditGlyph         from './icons/EditGlyph.vue'
import GetGlyph          from './icons/GetGlyph.vue'
import ComparatorGlyph   from './icons/ComparatorGlyph.vue'
// r41 v161 — category-level Planguage/SEM glyphs per Tom Gilb 2026-06-17
// detailed icon direction: Visualize=Eye (NOT camera), Analyze=mini VDT,
// Deep AI=Claudian Star, Edit=EditGlyph, Swiss Army=multi-tool knife,
// Import=GetGlyph (Planguage canonical).
import ClaudianStarGlyph   from './icons/ClaudianStarGlyph.vue'
import SwissArmyKnifeGlyph from './icons/SwissArmyKnifeGlyph.vue'
import VdtMatrixGlyph      from './icons/VdtMatrixGlyph.vue'
import EvoCycleMiniGlyph   from './icons/EvoCycleMiniGlyph.vue'
import MeasureLearnGlyph   from './icons/MeasureLearnGlyph.vue'
import SaveGlyph           from './icons/SaveGlyph.vue'
import PlTaskIcon          from './icons/PlTaskIcon.vue'
// r41 v163 — Templates mini-render glyph per Tom Gilb 2026-06-17 verbatim
// "design model thumbs glyph (I love them, so do others who see them)".
// Stack of 3 fan-offset model thumb cards in canonical Planguage colours.
import ModelThumbsStackGlyph from './icons/ModelThumbsStackGlyph.vue'
// r41 v205 — light-touch click telemetry per Tom Gilb 2026-06-19.
import { recordToolClick } from '../composables/useToolUsage'

const props = defineProps<{
  /** Active planning stage (1–11) */
  planningStage: number
  /** True when a spec exists; some tools are spec-required */
  hasSpec: boolean
  /** r41 v153 — live spec-artefact presence map; drives per-tool
   *  availability gating per the Planguage dependency rule
   *  (rule_stage_tools_dependency_logic.md).  App.vue computes this from
   *  currentSpec and passes it down.  Defaults to all-false so a missing
   *  prop fails-safe to disabled. */
  specPresence?: Partial<Record<PlanguageRequirement, boolean>>
}>()

const emit = defineEmits<{
  (e: 'open-penta'): void
  (e: 'open-get-a-plan'): void
  (e: 'open-compare'): void
  (e: 'open-templates'): void
  (e: 'open-initial-input'): void
  (e: 'open-sharpen-tools'): void
  (e: 'open-sharpen-spec'): void
  (e: 'open-standards-auditor'): void
  (e: 'open-phi-dashboard'): void
  (e: 'open-iet'): void
  (e: 'open-multivision'): void
  (e: 'open-impact-estimator'): void
  (e: 'open-refine-solutions'): void
  (e: 'open-evo-plan'): void
  (e: 'open-evo-critiquer'): void
  (e: 'open-evo-tools'): void
  (e: 'open-spec-tools'): void
  (e: 'open-spec-editor'): void
  (e: 'open-tasks'): void
  (e: 'open-study-act'): void
  (e: 'open-resources-sharpening'): void
  (e: 'open-optima'): void
  (e: 'open-export'): void
  // r41 v123 — 'open-agents' moved to AgentsStrip.vue
  /** r41 v153 — fired when the planner clicks a disabled tool.  Parent
   *  surfaces an "Invalid Tool — <reason>" toast per Tom Gilb 2026-06-17
   *  verbatim "clear reaction message ('Invalid Tool' (at this point))". */
  (e: 'tool-invalid', payload: { label: string; reason: string }): void
}>()

/** r41 v154 — `deepAi` category added per Tom Gilb 2026-06-17 verbatim
 *  "Sharpen is not edit only, it is the deep analysis, then auto edit.
 *  The questions and answers are also a non-graphical visualization of
 *  the high level concerns, so let me try for a new category 'Deep AI
 *  Analysis and Specification' (that is what it is, and it is the star
 *  of the show)".  Tools in this category do MULTI-step AI work:
 *  deep analysis → user Q&A → AI suggestions → auto-edit pipeline. */
// r41 v158 — `swissArmy` category added per Tom Gilb 2026-06-17 verbatim
// "Swiss Army (all purpose), like Penta, MultiVision".  Tools in this
// category do MORE THAN ONE of {visualize, analyze, edit}.
type ToolCategory = 'visualize' | 'analyze' | 'edit' | 'deepAi' | 'swissArmy' | 'import' | 'export'

// ─── r41 v173 — Popout menu for categories with 3+ tools (state) ─────────────
// Declared early — Safari (JSC) was throwing ReferenceError when these were
// placed late in the file alongside their helper functions, even though the
// `ref` import was at module-scope.  Hoisting these declarations next to the
// type defs sidesteps the closure-resolution issue.
const INLINE_LIMIT = 2
const openPopout = ref<ToolCategory | null>(null)

interface Tool {
  id: string
  glyph: string
  /** r41 v159 — optional mini-render Vue component per Tom Gilb 2026-06-17
   *  SUPREME rule "Tool Icon = Miniature of Its Display".  When present,
   *  this component renders INSTEAD of the emoji `glyph`.  Composes with
   *  DD-014 Thumbnail Reality + DD-012 No-Generic-Icon-Libraries. */
  glyphComponent?: Component
  label: string
  event: string
  /** Sub-group taxonomy — Tom Gilb 2026-06-17 verbatim "within the 3 big
   *  groups is there any sub group like visualize analyze edit or other?".
   *  Each tool slots into ONE verb-category so the strip can render with
   *  small-caps section labels and consistent palettes per category. */
  category: ToolCategory
  /** Optional palette accent — defaults to slate; OVERRIDDEN by category
   *  palette in the renderer below to keep category families visually
   *  consistent across stages. */
  accent?: 'violet' | 'amber' | 'rose' | 'emerald' | 'teal' | 'indigo'
  /** Legacy spec-only requirement (kept for back-compat).  Prefer `requires`. */
  needsSpec?: boolean
  /** r41 v153 — Planguage-grounded prerequisite list per Tom Gilb 2026-06-17
   *  rule_stage_tools_dependency_logic.md.  Each tool declares which spec
   *  artefacts must exist before it can be opened.  When any item in this
   *  list is unmet, the tool is rendered greyed-out and clicking it
   *  reveals an "Invalid Tool — <reason>" reaction message. */
  requires?: PlanguageRequirement[]
}

/** Planguage spec artefacts a tool can depend on.  Order roughly matches
 *  the natural Planguage planning chain (Stakeholders → Values + Functions →
 *  Solutions → Impact Estimates → Evo Steps → Tasks; Resources branches off
 *  Solutions). */
export type PlanguageRequirement =
  | 'spec'             // at least one Planguage entry of any type
  | 'stakeholders'     // at least one Stakeholder
  | 'values'           // at least one Value entry
  | 'functions'        // at least one Function entry
  | 'solutions'        // at least one Solution entry
  | 'impactEstimates'  // at least one Impact Estimate on a Solution × Value cell
  | 'evoSteps'         // at least one Evo Step
  | 'tasks'            // at least one Task
  | 'resources'        // at least one Resource entry OR Solution with cost data

/** Friendly user-facing message when a requirement is unmet. */
const REQUIREMENT_REASON: Record<PlanguageRequirement, string> = {
  spec:            'no Planguage entries yet — load a spec via Get A Plan or Templates first',
  stakeholders:    'no Stakeholders yet — add at least one Stakeholder at Stage 1 Stakes',
  values:          'no Values yet — generate Values at Stage 1-2 (Stakes / Solutions)',
  functions:       'no Functions yet — generate Functions at Stage 1-2',
  solutions:       'no Solutions yet — generate Solutions at Stage 2',
  impactEstimates: 'no Impact Estimates yet — fill the Impact Estimation Table at Stage 4',
  evoSteps:        'no Evo Steps yet — generate Evo Steps at Stage 6 (Evo Plan)',
  tasks:           'no Tasks yet — break Evo Steps into Tasks at Stage 8',
  resources:       'no Resources yet — add Resource entries or generate at Stage 10',
}

/** r41 v161 — Category metadata extended with `glyphComponent`.  Tom Gilb
 *  2026-06-17 verbatim icon direction:
 *   - Visualize: NO camera (1930s), use Eye glyph (emoji 👁 is the simplest
 *     abstract eye; if we later build EyeGlyph.vue we wire it here)
 *   - Analyze: mini VDT (Value Decision Table) — VdtMatrixGlyph
 *   - Deep AI: Claudian Star (sparkle) — ClaudianStarGlyph
 *   - Edit: NOT pencil — Planguage canonical EditGlyph `[*]→[**]`
 *   - Swiss Army: real drawing of multi-tool knife — SwissArmyKnifeGlyph
 *   - Import: Planguage canonical GetGlyph `[*]→*`
 *   - Export: temporarily 📤 emoji (Tom said "Planguage Icon" — we'll wire
 *     EmailGlyph or SaveGlyph next pass since "export" semantically =
 *     pushing OUT of vessel; SaveGlyph `*→[*]` is the closest canonical) */
const CATEGORY_META: Record<ToolCategory, { glyph: string; label: string; accentClass: string; glyphComponent?: Component }> = {
  visualize: { glyph: '👁', label: 'Visualize', accentClass: 'bg-indigo-600/80 hover:bg-indigo-500 ring-1 ring-indigo-300/40' },
  analyze:   { glyph: '🔬', label: 'Analyze',   accentClass: 'bg-emerald-600/80 hover:bg-emerald-500 ring-1 ring-emerald-300/40', glyphComponent: VdtMatrixGlyph },
  edit:      { glyph: '✏',  label: 'Edit',      accentClass: 'bg-amber-500/90 hover:bg-amber-400 text-amber-950 ring-1 ring-amber-200/60', glyphComponent: EditGlyph },
  // ★ Star of the show — fuchsia/pink gradient for visual prominence per Tom Gilb 2026-06-17.
  deepAi:    { glyph: '🪄', label: 'Deep AI',   accentClass: 'bg-gradient-to-br from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 text-white ring-1 ring-fuchsia-300/60', glyphComponent: ClaudianStarGlyph },
  // r41 v158 — Swiss Army (multi-purpose tools per Tom 2026-06-17 "Swiss Army (all purpose), like Penta, MultiVision").
  swissArmy: { glyph: '🛠', label: 'Swiss Army', accentClass: 'bg-slate-600/80 hover:bg-slate-500 text-white ring-1 ring-slate-300/60', glyphComponent: SwissArmyKnifeGlyph },
  import:    { glyph: '📥', label: 'Import',    accentClass: 'bg-violet-600/80 hover:bg-violet-500 ring-1 ring-violet-300/40', glyphComponent: GetGlyph },
  export:    { glyph: '📤', label: 'Export',    accentClass: 'bg-rose-600/80 hover:bg-rose-500 ring-1 ring-rose-300/40' },
}

/** Canonical sub-group order — same across all stages so muscle memory works. */
// r41 v158 — canonical category order: visualize → analyze → DEEP AI (star)
// → edit → swissArmy (multi-tool) → import → export.
const CATEGORY_ORDER: ToolCategory[] = ['visualize', 'analyze', 'deepAi', 'edit', 'swissArmy', 'import', 'export']

const TOOLS_BY_STAGE: Record<number, Tool[]> = {
  // r41 v173 — Tom Gilb 2026-06-18 verbatim "please beef up each stage with
  // appropriate tools, if there are many I guess a pop out menu is good?".
  // Each stage now carries a curated toolkit across all 5 + 2 categories.
  // Categories with 3+ tools render the first 2 inline + a "+N more" popout
  // pin per the new POPOUT_THRESHOLD logic below.
  1: [
    // Stage 1 · STAKES — Stakeholders + initial F./V./C. capture, no Solutions yet
    { id: 'phi-dashboard',     glyph: '📊', glyphComponent: PlanHealthGlyph, label: 'Spec Health',     event: 'open-phi-dashboard',     category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'standards-auditor', glyph: '✓',  glyphComponent: AnalyzerGlyph,   label: 'Standards Auditor', event: 'open-standards-auditor', category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-tools',     glyph: '🧰', glyphComponent: SharpenKnifeGlyph,label: 'ToolBox',    event: 'open-sharpen-tools',     category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-spec',      glyph: '🔪', glyphComponent: SharpenKnifeGlyph,label: 'Sharpening',     event: 'open-sharpen-spec',      category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'spec-editor',       glyph: '[*]→[**]', glyphComponent: EditGlyph, label: 'Spec Editor',      event: 'open-spec-editor',       category: 'edit',      needsSpec: true, requires: ['spec'] },
    { id: 'penta',             glyph: '⬠',  glyphComponent: PentaGlyph,      label: 'Penta',            event: 'open-penta',             category: 'swissArmy', needsSpec: true, requires: ['spec'] },
    { id: 'get-a-plan',        glyph: '⤵', glyphComponent: GetGlyph,         label: 'Get A Plan',       event: 'open-get-a-plan',        category: 'import',    requires: [] },
    { id: 'templates',         glyph: '📚', glyphComponent: ModelThumbsStackGlyph, label: 'Templates',  event: 'open-templates',         category: 'import',    requires: [] },
    { id: 'initial-input',     glyph: '📄', glyphComponent: GetGlyph,         label: 'Initial Input',    event: 'open-initial-input',     category: 'import',    needsSpec: true, requires: ['spec'] },
  ],
  // r41 v171 — Tom Gilb 2026-06-18 verbatim "something wrong here, starting
  // with noting in edit and analyze, and only 1 tool in the others".  Stage 2
  // Solutions previously had only 3 tools (Compare / Sharpen Tools / Penta) —
  // Analyze and Edit were empty.  Now beefed up with the full per-category
  // toolkit appropriate to building + refining Solutions.  Each tool keeps
  // its requires[] gate so unmet prereqs render greyed-out + fire the
  // Invalid-Tool toast on click per rule_stage_tools_dependency_logic.md.
  2: [
    // VISUALIZE — see Solutions in context
    { id: 'compare',       glyph: '⇄', glyphComponent: ComparatorGlyph,  label: 'Compare',       event: 'open-compare',       category: 'visualize', requires: ['solutions'] },
    { id: 'multivision',   glyph: '🔭', glyphComponent: MultiVisionGlyph, label: 'MultiVision',   event: 'open-multivision',   category: 'visualize', needsSpec: true, requires: ['values'] },
    // ANALYZE — measure Solution quality + impact
    { id: 'phi-dashboard',      glyph: '📊', glyphComponent: PlanHealthGlyph, label: 'Spec Health',     event: 'open-phi-dashboard',      category: 'analyze', needsSpec: true, requires: ['spec'] },
    { id: 'standards-auditor',  glyph: '✓',  glyphComponent: AnalyzerGlyph,   label: 'Standards Auditor', event: 'open-standards-auditor', category: 'analyze', needsSpec: true, requires: ['spec'] },
    { id: 'impact-estimator',   glyph: '🎯', glyphComponent: VdtMatrixGlyph,  label: 'Impact Estimator',  event: 'open-impact-estimator',  category: 'analyze', needsSpec: true, requires: ['solutions'] },
    // DEEP AI — the star of the show: sharpen + critique
    { id: 'sharpen-tools', glyph: '🧰', glyphComponent: SharpenKnifeGlyph, label: 'ToolBox', event: 'open-sharpen-tools', category: 'deepAi', needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-spec',  glyph: '🔪', glyphComponent: SharpenKnifeGlyph, label: 'Sharpening',  event: 'open-sharpen-spec',  category: 'deepAi', needsSpec: true, requires: ['spec'] },
    // EDIT — modify Solutions in place
    { id: 'spec-editor',       glyph: '[*]→[**]', glyphComponent: EditGlyph, label: 'Spec Editor',       event: 'open-spec-editor',       category: 'edit', needsSpec: true, requires: ['spec'] },
    { id: 'refine-solutions',  glyph: '⚙',        glyphComponent: EditGlyph, label: 'Refine Solutions',  event: 'open-refine-solutions',  category: 'edit', needsSpec: true, requires: ['solutions'] },
    // SWISS ARMY — multi-purpose
    { id: 'penta',         glyph: '⬠', glyphComponent: PentaGlyph,   label: 'Penta',         event: 'open-penta',         category: 'swissArmy', needsSpec: true, requires: ['spec'] },
    { id: 'iet',           glyph: '📈', glyphComponent: OptimaGlyph, label: 'IET',           event: 'open-iet',           category: 'swissArmy', needsSpec: true, requires: ['solutions'] },
    // IMPORT — bring Solutions in from outside
    { id: 'get-a-plan',    glyph: '⤵', glyphComponent: GetGlyph,                 label: 'Get A Plan',  event: 'open-get-a-plan',  category: 'import', requires: [] },
    { id: 'templates',     glyph: '📚', glyphComponent: ModelThumbsStackGlyph,   label: 'Templates',   event: 'open-templates',   category: 'import', requires: [] },
    { id: 'initial-input', glyph: '📄', glyphComponent: GetGlyph,                 label: 'Initial Input', event: 'open-initial-input', category: 'import', needsSpec: true, requires: ['spec'] },
  ],
  3: [
    // Stage 3 · SHARPEN — deep AI pass + finding/fix application
    { id: 'phi-dashboard',     glyph: '📊', glyphComponent: PlanHealthGlyph,  label: 'Spec Health',     event: 'open-phi-dashboard',     category: 'visualize', needsSpec: true, requires: ['spec'] },
    { id: 'multivision',       glyph: '🔭', glyphComponent: MultiVisionGlyph, label: 'MultiVision',       event: 'open-multivision',       category: 'visualize', needsSpec: true, requires: ['values'] },
    { id: 'standards-auditor', glyph: '✓',  glyphComponent: AnalyzerGlyph,    label: 'Standards Auditor', event: 'open-standards-auditor', category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'impact-estimator',  glyph: '🎯', glyphComponent: VdtMatrixGlyph,   label: 'Impact Estimator',  event: 'open-impact-estimator',  category: 'analyze',   needsSpec: true, requires: ['solutions'] },
    { id: 'sharpen-spec',      glyph: '🔪', glyphComponent: SharpenKnifeGlyph,label: 'Sharpening',      event: 'open-sharpen-spec',      category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-tools',     glyph: '🧰', glyphComponent: SharpenKnifeGlyph,label: 'ToolBox',     event: 'open-sharpen-tools',     category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'spec-editor',       glyph: '[*]→[**]', glyphComponent: EditGlyph,  label: 'Spec Editor',       event: 'open-spec-editor',       category: 'edit',      needsSpec: true, requires: ['spec'] },
    { id: 'refine-solutions',  glyph: '⚙',  glyphComponent: EditGlyph,        label: 'Refine Solutions',  event: 'open-refine-solutions',  category: 'edit',      needsSpec: true, requires: ['solutions'] },
    { id: 'penta',             glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'swissArmy', needsSpec: true, requires: ['spec'] },
    { id: 'iet',               glyph: '📈', glyphComponent: OptimaGlyph,      label: 'IET',               event: 'open-iet',               category: 'swissArmy', needsSpec: true, requires: ['solutions'] },
  ],
  4: [
    // Stage 4 · IMPACTS — IET fill, see consequences across Values
    { id: 'multivision',       glyph: '🔭', glyphComponent: MultiVisionGlyph, label: 'MultiVision',       event: 'open-multivision',       category: 'visualize', needsSpec: true, requires: ['values'] },
    { id: 'compare',           glyph: '⇄',  glyphComponent: ComparatorGlyph,  label: 'Compare',           event: 'open-compare',           category: 'visualize', requires: ['solutions'] },
    { id: 'impact-estimator',  glyph: '🎯', glyphComponent: VdtMatrixGlyph,   label: 'Impact Estimator',  event: 'open-impact-estimator',  category: 'analyze',   needsSpec: true, requires: ['solutions'] },
    { id: 'phi-dashboard',     glyph: '📊', glyphComponent: PlanHealthGlyph,  label: 'Spec Health',     event: 'open-phi-dashboard',     category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'standards-auditor', glyph: '✓',  glyphComponent: AnalyzerGlyph,    label: 'Standards Auditor', event: 'open-standards-auditor', category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-spec',      glyph: '🔪', glyphComponent: SharpenKnifeGlyph,label: 'Sharpening',      event: 'open-sharpen-spec',      category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-tools',     glyph: '🧰', glyphComponent: SharpenKnifeGlyph,label: 'ToolBox',     event: 'open-sharpen-tools',     category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'spec-editor',       glyph: '[*]→[**]', glyphComponent: EditGlyph,  label: 'Spec Editor',       event: 'open-spec-editor',       category: 'edit',      needsSpec: true, requires: ['spec'] },
    { id: 'iet',               glyph: '📈', glyphComponent: OptimaGlyph,      label: 'IET',               event: 'open-iet',               category: 'swissArmy', needsSpec: true, requires: ['solutions'] },
    { id: 'penta',             glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'swissArmy', needsSpec: true, requires: ['spec'] },
  ],
  5: [
    // Stage 5 · REFINE — cut/sharpen Solutions based on impact results
    { id: 'compare',           glyph: '⇄',  glyphComponent: ComparatorGlyph,  label: 'Compare',           event: 'open-compare',           category: 'visualize', requires: ['solutions'] },
    { id: 'multivision',       glyph: '🔭', glyphComponent: MultiVisionGlyph, label: 'MultiVision',       event: 'open-multivision',       category: 'visualize', needsSpec: true, requires: ['values'] },
    { id: 'impact-estimator',  glyph: '🎯', glyphComponent: VdtMatrixGlyph,   label: 'Impact Estimator',  event: 'open-impact-estimator',  category: 'analyze',   needsSpec: true, requires: ['solutions'] },
    { id: 'phi-dashboard',     glyph: '📊', glyphComponent: PlanHealthGlyph,  label: 'Spec Health',     event: 'open-phi-dashboard',     category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-spec',      glyph: '🔪', glyphComponent: SharpenKnifeGlyph,label: 'Sharpening',      event: 'open-sharpen-spec',      category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-tools',     glyph: '🧰', glyphComponent: SharpenKnifeGlyph,label: 'ToolBox',     event: 'open-sharpen-tools',     category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'refine-solutions',  glyph: '⚙',  glyphComponent: EditGlyph,        label: 'Refine Solutions',  event: 'open-refine-solutions',  category: 'edit',      needsSpec: true, requires: ['solutions'] },
    { id: 'spec-editor',       glyph: '[*]→[**]', glyphComponent: EditGlyph,  label: 'Spec Editor',       event: 'open-spec-editor',       category: 'edit',      needsSpec: true, requires: ['spec'] },
    { id: 'penta',             glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'swissArmy', needsSpec: true, requires: ['spec'] },
    { id: 'iet',               glyph: '📈', glyphComponent: OptimaGlyph,      label: 'IET',               event: 'open-iet',               category: 'swissArmy', needsSpec: true, requires: ['solutions'] },
  ],
  6: [
    // Stage 6 · EVO STEPS — slice Solutions into Evo increments
    { id: 'penta',             glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'visualize', needsSpec: true, requires: ['spec'] },
    { id: 'compare',           glyph: '⇄',  glyphComponent: ComparatorGlyph,  label: 'Compare',           event: 'open-compare',           category: 'visualize', requires: ['solutions'] },
    { id: 'evo-critiquer',     glyph: '🔍', glyphComponent: EvoCycleMiniGlyph,label: 'Evo Critiquer',     event: 'open-evo-critiquer',     category: 'analyze',   needsSpec: true, requires: ['evoSteps'] },
    { id: 'phi-dashboard',     glyph: '📊', glyphComponent: PlanHealthGlyph,  label: 'Spec Health',     event: 'open-phi-dashboard',     category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'standards-auditor', glyph: '✓',  glyphComponent: AnalyzerGlyph,    label: 'Standards Auditor', event: 'open-standards-auditor', category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-spec',      glyph: '🔪', glyphComponent: SharpenKnifeGlyph,label: 'Sharpening',      event: 'open-sharpen-spec',      category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-tools',     glyph: '🧰', glyphComponent: SharpenKnifeGlyph,label: 'ToolBox',     event: 'open-sharpen-tools',     category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'evo-plan',          glyph: '🧬', glyphComponent: EvoCycleMiniGlyph,label: 'Evo Plan',          event: 'open-evo-plan',          category: 'edit',      needsSpec: true, requires: ['solutions', 'impactEstimates'] },
    { id: 'evo-tools',         glyph: '🛠', glyphComponent: EvoCycleMiniGlyph,label: 'Evo Tools',         event: 'open-evo-tools',         category: 'edit',      needsSpec: true, requires: ['evoSteps'] },
    { id: 'spec-editor',       glyph: '[*]→[**]', glyphComponent: EditGlyph,  label: 'Spec Editor',       event: 'open-spec-editor',       category: 'edit',      needsSpec: true, requires: ['spec'] },
    { id: 'iet',               glyph: '📈', glyphComponent: OptimaGlyph,      label: 'IET',               event: 'open-iet',               category: 'swissArmy', needsSpec: true, requires: ['solutions'] },
  ],
  7: [
    // Stage 7 · EVO IMPACT — per-Evo-Step impact projection
    { id: 'multivision',       glyph: '🔭', glyphComponent: MultiVisionGlyph, label: 'MultiVision',       event: 'open-multivision',       category: 'visualize', needsSpec: true, requires: ['values'] },
    { id: 'penta',             glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'visualize', needsSpec: true, requires: ['spec'] },
    { id: 'impact-estimator',  glyph: '🎯', glyphComponent: VdtMatrixGlyph,   label: 'Impact Estimator',  event: 'open-impact-estimator',  category: 'analyze',   needsSpec: true, requires: ['solutions'] },
    { id: 'evo-critiquer',     glyph: '🔍', glyphComponent: EvoCycleMiniGlyph,label: 'Evo Critiquer',     event: 'open-evo-critiquer',     category: 'analyze',   needsSpec: true, requires: ['evoSteps'] },
    { id: 'phi-dashboard',     glyph: '📊', glyphComponent: PlanHealthGlyph,  label: 'Spec Health',     event: 'open-phi-dashboard',     category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-tools',     glyph: '🧰', glyphComponent: SharpenKnifeGlyph,label: 'ToolBox',     event: 'open-sharpen-tools',     category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'evo-tools',         glyph: '🛠', glyphComponent: EvoCycleMiniGlyph,label: 'Evo Tools',         event: 'open-evo-tools',         category: 'edit',      needsSpec: true, requires: ['evoSteps'] },
    { id: 'spec-editor',       glyph: '[*]→[**]', glyphComponent: EditGlyph,  label: 'Spec Editor',       event: 'open-spec-editor',       category: 'edit',      needsSpec: true, requires: ['spec'] },
    { id: 'iet',               glyph: '📈', glyphComponent: OptimaGlyph,      label: 'IET',               event: 'open-iet',               category: 'swissArmy', needsSpec: true, requires: ['solutions'] },
    { id: 'penta-sa',          glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'swissArmy', needsSpec: true, requires: ['spec'] },
  ],
  8: [
    // Stage 8 · TASKS — break Evo Steps into Tasks
    { id: 'penta',             glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'visualize', needsSpec: true, requires: ['spec'] },
    { id: 'multivision',       glyph: '🔭', glyphComponent: MultiVisionGlyph, label: 'MultiVision',       event: 'open-multivision',       category: 'visualize', needsSpec: true, requires: ['values'] },
    { id: 'standards-auditor', glyph: '✓',  glyphComponent: AnalyzerGlyph,    label: 'Standards Auditor', event: 'open-standards-auditor', category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'phi-dashboard',     glyph: '📊', glyphComponent: PlanHealthGlyph,  label: 'Spec Health',     event: 'open-phi-dashboard',     category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-tools',     glyph: '🧰', glyphComponent: SharpenKnifeGlyph,label: 'ToolBox',     event: 'open-sharpen-tools',     category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'tasks',             glyph: '☑', glyphComponent: PlTaskIcon,        label: 'Tasks',             event: 'open-tasks',             category: 'edit',      needsSpec: true, requires: ['evoSteps'] },
    { id: 'evo-tools',         glyph: '🛠', glyphComponent: EvoCycleMiniGlyph,label: 'Evo Tools',         event: 'open-evo-tools',         category: 'edit',      needsSpec: true, requires: ['evoSteps'] },
    { id: 'spec-editor',       glyph: '[*]→[**]', glyphComponent: EditGlyph,  label: 'Spec Editor',       event: 'open-spec-editor',       category: 'edit',      needsSpec: true, requires: ['spec'] },
    { id: 'penta-sa',          glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'swissArmy', needsSpec: true, requires: ['spec'] },
  ],
  9: [
    // Stage 9 · STUDY-ACT — Measure → Learn loop after each delivered increment
    { id: 'phi-dashboard',     glyph: '📊', glyphComponent: PlanHealthGlyph,  label: 'Spec Health',     event: 'open-phi-dashboard',     category: 'visualize', needsSpec: true, requires: ['spec'] },
    { id: 'multivision',       glyph: '🔭', glyphComponent: MultiVisionGlyph, label: 'MultiVision',       event: 'open-multivision',       category: 'visualize', needsSpec: true, requires: ['values'] },
    { id: 'evo-critiquer',     glyph: '🔍', glyphComponent: EvoCycleMiniGlyph,label: 'Evo Critiquer',     event: 'open-evo-critiquer',     category: 'analyze',   needsSpec: true, requires: ['evoSteps'] },
    { id: 'standards-auditor', glyph: '✓',  glyphComponent: AnalyzerGlyph,    label: 'Standards Auditor', event: 'open-standards-auditor', category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-spec',      glyph: '🔪', glyphComponent: SharpenKnifeGlyph,label: 'Sharpening',      event: 'open-sharpen-spec',      category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-tools',     glyph: '🧰', glyphComponent: SharpenKnifeGlyph,label: 'ToolBox',     event: 'open-sharpen-tools',     category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'study-act',         glyph: '🔁', glyphComponent: MeasureLearnGlyph,label: 'Study-Act Loop',    event: 'open-study-act',         category: 'edit',      needsSpec: true, requires: ['tasks'] },
    { id: 'spec-editor',       glyph: '[*]→[**]', glyphComponent: EditGlyph,  label: 'Spec Editor',       event: 'open-spec-editor',       category: 'edit',      needsSpec: true, requires: ['spec'] },
    { id: 'penta',             glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'swissArmy', needsSpec: true, requires: ['spec'] },
    { id: 'iet',               glyph: '📈', glyphComponent: OptimaGlyph,      label: 'IET',               event: 'open-iet',               category: 'swissArmy', needsSpec: true, requires: ['solutions'] },
  ],
  10: [
    // Stage 10 · RESOURCES — Resource entry sharpening + OPTIMA tradeoff
    { id: 'multivision',          glyph: '🔭', glyphComponent: MultiVisionGlyph, label: 'MultiVision',          event: 'open-multivision',          category: 'visualize', needsSpec: true, requires: ['values'] },
    { id: 'phi-dashboard',        glyph: '📊', glyphComponent: PlanHealthGlyph,  label: 'Spec Health',        event: 'open-phi-dashboard',        category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'standards-auditor',    glyph: '✓',  glyphComponent: AnalyzerGlyph,    label: 'Standards Auditor',    event: 'open-standards-auditor',    category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'resources-sharpening', glyph: '💼', glyphComponent: SharpenKnifeGlyph,label: 'Resources Sharpening', event: 'open-resources-sharpening', category: 'deepAi',    needsSpec: true, requires: ['solutions'] },
    { id: 'sharpen-tools',        glyph: '🧰', glyphComponent: SharpenKnifeGlyph,label: 'ToolBox',        event: 'open-sharpen-tools',        category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-spec',         glyph: '🔪', glyphComponent: SharpenKnifeGlyph,label: 'Sharpening',         event: 'open-sharpen-spec',         category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'spec-editor',          glyph: '[*]→[**]', glyphComponent: EditGlyph,  label: 'Spec Editor',          event: 'open-spec-editor',          category: 'edit',      needsSpec: true, requires: ['spec'] },
    { id: 'optima',               glyph: '⚖', glyphComponent: OptimaGlyph,       label: 'OPTIMA',               event: 'open-optima',               category: 'swissArmy', needsSpec: true, requires: ['solutions', 'resources'] },
    { id: 'penta',                glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',                event: 'open-penta',                category: 'swissArmy', needsSpec: true, requires: ['spec'] },
    { id: 'iet',                  glyph: '📈', glyphComponent: OptimaGlyph,      label: 'IET',                  event: 'open-iet',                  category: 'swissArmy', needsSpec: true, requires: ['solutions'] },
  ],
  11: [
    // Stage 11 · EXPORT — final preview + share the Pl plan
    { id: 'penta',             glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'visualize', needsSpec: true, requires: ['spec'] },
    { id: 'multivision',       glyph: '🔭', glyphComponent: MultiVisionGlyph, label: 'MultiVision',       event: 'open-multivision',       category: 'visualize', needsSpec: true, requires: ['values'] },
    { id: 'phi-dashboard',     glyph: '📊', glyphComponent: PlanHealthGlyph,  label: 'Spec Health',     event: 'open-phi-dashboard',     category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'standards-auditor', glyph: '✓',  glyphComponent: AnalyzerGlyph,    label: 'Standards Auditor', event: 'open-standards-auditor', category: 'analyze',   needsSpec: true, requires: ['spec'] },
    { id: 'sharpen-tools',     glyph: '🧰', glyphComponent: SharpenKnifeGlyph,label: 'ToolBox',     event: 'open-sharpen-tools',     category: 'deepAi',    needsSpec: true, requires: ['spec'] },
    { id: 'spec-editor',       glyph: '[*]→[**]', glyphComponent: EditGlyph,  label: 'Spec Editor',       event: 'open-spec-editor',       category: 'edit',      needsSpec: true, requires: ['spec'] },
    { id: 'penta-sa',          glyph: '⬠',  glyphComponent: PentaGlyph,       label: 'Penta',             event: 'open-penta',             category: 'swissArmy', needsSpec: true, requires: ['spec'] },
    { id: 'iet',               glyph: '📈', glyphComponent: OptimaGlyph,      label: 'IET',               event: 'open-iet',               category: 'swissArmy', needsSpec: true, requires: ['solutions'] },
    { id: 'export',            glyph: '📨', glyphComponent: SaveGlyph,        label: 'Export Plan',       event: 'open-export',            category: 'export',    needsSpec: true, requires: ['spec'] },
  ],
}

// r41 v379 (Tom Gilb 2026-06-25) — Stage 5 'Refine' → 'Refine Attributes'.
// FUTURE: replace this whole map with `PLANNING_STAGES.map(s => [s.stage, s.label])`
// to eliminate the parallel-implementation drift Trace-Before-Patch SUPREME guards
// against.  Banked as pending refactor in the design history.
const stageLabel: Record<number, string> = {
  1: 'Stakes', 2: 'Solutions', 3: 'Sharpen', 4: 'Impacts', 5: 'Refine Attributes',
  6: 'Evo Steps', 7: 'Evo Impact', 8: 'Tasks', 9: 'Study-Act',
  10: 'Resources', 11: 'Export',
}

// r41 v156 — Tom Gilb 2026-06-17 verbatim "I cannot see any of the pins for
// the vis edit analys ai set?" — root cause: the legacy `needsSpec` filter
// was DROPPING tools whose prereqs were unmet, so empty sub-pills
// disappeared.  Per the v153+ gating model, tools must STAY VISIBLE but
// render greyed-out; the user sees the full toolkit at each stage and the
// gating teaches the order.  Filter removed; per-tool availability check
// in the template handles the greyed visual state.
const currentTools = computed<Tool[]>(() => {
  const stage = props.planningStage
  return TOOLS_BY_STAGE[stage] ?? []
})

/** Tools grouped by category, in canonical order.  Empty categories drop. */
// r41 v158 — Tom Gilb 2026-06-17 verbatim "no canot see the 4 new categories
// yet" — root cause: empty categories were being SKIPPED via the
// `if (toolsInCat.length > 0)` guard.  Per Tom's intent the 4 canonical
// category buttons (Visualize / Analyze / Edit / Swiss Army) PLUS the
// Deep AI star MUST always be visible so the planner sees the full
// toolkit structure at every stage.  Empty categories now render with
// a tiny "—" placeholder showing the category exists but is empty here.
const toolsByCategory = computed<Array<{ category: ToolCategory; tools: Tool[] }>>(() => {
  const grouped: Array<{ category: ToolCategory; tools: Tool[] }> = []
  for (const cat of CATEGORY_ORDER) {
    const toolsInCat = currentTools.value.filter(t => t.category === cat)
    // Skip ONLY import + export (those are stage-specific by nature; they
    // shouldn't render an empty button at every stage).
    if (cat === 'import' || cat === 'export') {
      if (toolsInCat.length > 0) grouped.push({ category: cat, tools: toolsInCat })
    } else {
      // The 4 canonical categories + Deep AI: always render.
      grouped.push({ category: cat, tools: toolsInCat })
    }
  }
  return grouped
})

function fire(eventName: string): void {
  emit(eventName as Parameters<typeof emit>[0])
}

/** r41 v165 — Tom Gilb 2026-06-17 verbatim "these 4 are dead, at least info
 *  hover needs activating".  For each (empty-here) category, list the
 *  stages where the category DOES have tools, so the placeholder pill can
 *  teach the planner where to find them. */
function stagesWithCategory(cat: ToolCategory): { stage: number; label: string; tools: string[] }[] {
  const out: { stage: number; label: string; tools: string[] }[] = []
  for (const [stageStr, toolsList] of Object.entries(TOOLS_BY_STAGE)) {
    const stage = Number(stageStr)
    const tools = toolsList.filter(t => t.category === cat).map(t => t.label)
    if (tools.length > 0) out.push({ stage, label: stageLabel[stage] ?? `Stage ${stage}`, tools })
  }
  return out
}

/** r41 v165 — placeholder HoverHint text: category description + where to find tools. */
function placeholderTitle(cat: ToolCategory): string {
  const meta = CATEGORY_META[cat]
  const elsewhere = stagesWithCategory(cat)
  const here = stageLabel[props.planningStage] ?? 'this stage'
  const head = `${meta.glyph} ${meta.label} — no ${meta.label} tools at ${here}`
  if (elsewhere.length === 0) {
    return `${head}.\n\nThis category has no tools wired at any stage yet.`
  }
  const where = elsewhere.map(e => `Stage ${e.stage} ${e.label}: ${e.tools.join(' · ')}`).join('\n')
  return `${head}.\n\n${meta.label} tools live at:\n${where}\n\nClick to jump to the first stage that has them.`
}

/** r41 v165 — placeholder click handler: jump to the first stage where the
 *  category has tools, or emit a no-tools toast. */
function handlePlaceholderClick(cat: ToolCategory): void {
  const elsewhere = stagesWithCategory(cat)
  const here = stageLabel[props.planningStage] ?? 'this stage'
  if (elsewhere.length > 0) {
    emit('tool-invalid', {
      label: CATEGORY_META[cat].label,
      reason: `no ${CATEGORY_META[cat].label} tools at ${here}.  Try Stage ${elsewhere[0].stage} (${elsewhere[0].label}) where you'll find: ${elsewhere[0].tools.join(', ')}.`,
    })
  } else {
    emit('tool-invalid', {
      label: CATEGORY_META[cat].label,
      reason: `the ${CATEGORY_META[cat].label} category has no tools wired at any stage yet — coming soon.`,
    })
  }
}

/** r41 v153 — Check tool availability against the current spec-presence
 *  map.  Returns { ok: true } when all `requires` are met; otherwise
 *  { ok: false, reason: "..." } with the FIRST unmet requirement's
 *  user-friendly reason.  Tools without a `requires` field are always ok. */
function checkToolAvailability(tool: Tool): { ok: true } | { ok: false; reason: string } {
  // Legacy `needsSpec` fallback (back-compat for tools not yet migrated to `requires`).
  if (tool.needsSpec && !props.hasSpec) {
    return { ok: false, reason: REQUIREMENT_REASON.spec }
  }
  if (!tool.requires || tool.requires.length === 0) return { ok: true }
  const presence = props.specPresence ?? {}
  for (const req of tool.requires) {
    if (!presence[req]) {
      return { ok: false, reason: REQUIREMENT_REASON[req] }
    }
  }
  return { ok: true }
}

/** Click handler — routes to the tool's normal emit OR the `tool-invalid`
 *  emit when the tool is greyed out.  Per Tom Gilb 2026-06-17 verbatim
 *  "clear reaction message ('Invalid Tool')". */
function handleToolClick(tool: Tool): void {
  // r41 v205 (Tom Gilb 2026-06-19 verbatim "Not sure about Planguage Tools,
  // keep for now, little harm, interesting if you can track my usage").
  // Record the click for BOTH valid and invalid attempts — the invalid-tool
  // hits are themselves a signal (the planner tried to use it; the prereq
  // gating got in the way).  Counter persists to localStorage; inspect via
  // `window.semToolUsage()` in Safari DevTools.
  recordToolClick(tool.id)
  const avail = checkToolAvailability(tool)
  if (avail.ok) {
    fire(tool.event)
  } else {
    emit('tool-invalid', { label: tool.label, reason: avail.reason })
  }
  // r41 v173 — close the popout once any tool inside it is clicked
  openPopout.value = null
}

function togglePopout(cat: ToolCategory): void {
  openPopout.value = openPopout.value === cat ? null : cat
}
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-3 px-3 py-2 bg-slate-800/40 border-y border-white/10 text-white"
    :aria-label="`Stage Tools — ${stageLabel[planningStage] ?? 'stage'} tools`"
  >
    <!-- Group title — r41 v120: dropped "Group 2" framing per Tom Gilb
         2026-06-17 verbatim "each of these 3 groups needs a good name…
         2. Stage Tools".  The name IS the identity; no Group-N numbering. -->
    <!-- r41 v150 — "Level 2 ·" framing dropped per Tom Gilb 2026-06-17.
         The current stage name (Stakes / Solutions / Sharpen / etc.) is
         kept as the eyebrow since it changes by stage and is informative. -->
    <!-- r41 v172 — Tom Gilb 2026-06-18 verbatim "add the stage number also
         to the name of it at left".  The eyebrow now reads "5 · REFINE"
         instead of just "REFINE" so the planner anchors on stage NUMBER
         (the navigation axis) AND stage NAME (the methodology axis) in
         a single glance.  Composes with the stage tiles + STAGE NOW pill
         which both already lead with the number. -->
    <div class="shrink-0 flex flex-col gap-0.5 mr-1 self-end">
      <span class="text-[9px] font-bold text-white/50 uppercase tracking-widest leading-none">
        <span v-if="stageLabel[planningStage]" class="text-amber-300">{{ planningStage }}&nbsp;·&nbsp;</span>{{ stageLabel[planningStage] ?? '' }}
      </span>
      <span class="text-[12px] font-extrabold text-white/85 uppercase tracking-wider leading-none whitespace-nowrap">
        Stage Tools
      </span>
    </div>

    <!-- Tool buttons — sub-grouped by category (visualize / analyze / edit /
         import / export).  Each sub-group renders inside its own rounded
         container with a small-caps `👁 VISUALIZE` / `🔬 ANALYZE` / etc. label
         above so the planner sees WHY each tool exists (verb-grouped, not
         just stage-grouped).  Tom Gilb 2026-06-17 verbatim: "within the 3
         big groups is there any sub group like visualize analyze edit or
         other?" — YES, this taxonomy. -->
    <template v-if="toolsByCategory.length > 0">
      <div
        v-for="group in toolsByCategory"
        :key="group.category"
        class="shrink-0 flex flex-col gap-0.5"
      >
        <!-- Sub-group caption — r41 v161 renders category glyphComponent
             when set (mini-render SVG) per Tom Gilb 2026-06-17 detailed
             icon direction; falls back to emoji glyph otherwise. -->
        <span
          class="shrink-0 text-[9px] font-bold uppercase tracking-widest leading-none text-white/60 px-1.5 flex items-center gap-1"
          :aria-label="`${CATEGORY_META[group.category].label} tools`"
        >
          <span v-if="CATEGORY_META[group.category].glyphComponent" class="h-3.5 w-auto flex items-center" aria-hidden="true">
            <component :is="CATEGORY_META[group.category].glyphComponent" class="h-full w-auto" />
          </span>
          <span v-else aria-hidden="true">{{ CATEGORY_META[group.category].glyph }}</span>
          {{ CATEGORY_META[group.category].label }}
        </span>
        <!-- Sub-group pill -->
        <div
          class="shrink-0 flex items-center gap-1 rounded-2xl bg-slate-900/40 ring-1 ring-white/15 px-1.5 py-1 relative"
        >
          <!-- r41 v153 — per Tom Gilb 2026-06-17 + rule_stage_tools_dependency
               _logic.md: each tool is gated by its Planguage prerequisites
               (Solutions need Values, Evo Critiquer needs Evo Steps, etc.).
               Greyed-out when prereqs unmet; click triggers a clear
               "Invalid Tool — <reason>" reaction message instead of firing
               the normal open event.
               r41 v173 — INLINE_LIMIT cap: only the first 2 tools render
               inline; any 3rd+ live in the popout to the right. -->
          <template v-for="(tool, idx) in group.tools" :key="tool.id">
            <button
              v-if="idx < INLINE_LIMIT"
              type="button"
              class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg text-white
                     focus:outline-none focus:ring-2 focus:ring-white/60 transition-all"
              :class="[
                CATEGORY_META[group.category].accentClass,
                checkToolAvailability(tool).ok ? '' : 'opacity-40 saturate-50 cursor-not-allowed hover:opacity-50',
              ]"
              :aria-label="checkToolAvailability(tool).ok
                ? `Open ${tool.label} — ${CATEGORY_META[group.category].label} tool for ${stageLabel[planningStage] ?? 'this stage'}`
                : `Invalid: ${tool.label} cannot be used yet — click for explanation`"
              :title="checkToolAvailability(tool).ok
                ? `${tool.glyph} ${tool.label} — ${CATEGORY_META[group.category].label} (${stageLabel[planningStage] ?? 'stage'})`
                : `⚠ INVALID TOOL — ${tool.label} cannot be used yet.\n\nReason: ${(checkToolAvailability(tool) as {reason:string}).reason}\n\nClick anyway to see the reaction message.`"
              @click="handleToolClick(tool)"
            >
              <!-- r41 v159 — render mini-render Glyph component when available
                   (Tom Gilb 2026-06-17 SUPREME rule "Tool Icon = Miniature of
                   Its Display").  Falls back to emoji glyph when no component
                   set.  The Glyph is constrained to h-4 via the wrapping span
                   so it sits cleanly in the h-10 button. -->
              <span v-if="tool.glyphComponent" class="h-4 w-auto flex items-center justify-center" aria-hidden="true">
                <component :is="tool.glyphComponent" class="h-full w-auto" />
              </span>
              <span v-else class="text-base leading-none" aria-hidden="true">{{ tool.glyph }}</span>
              <span class="text-[10px] font-bold leading-none tracking-wide">{{ tool.label }}</span>
            </button>
          </template>

          <!-- r41 v173 — "+N more" popout pin: renders when the category has
               more tools than INLINE_LIMIT.  Click opens a small absolute-
               positioned card below this pill listing the overflow tools. -->
          <button
            v-if="group.tools.length > INLINE_LIMIT"
            type="button"
            class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg text-white
                   focus:outline-none focus:ring-2 focus:ring-white/60 transition-all
                   bg-slate-700/80 hover:bg-slate-600 ring-1 ring-white/20"
            :class="openPopout === group.category ? 'bg-slate-500 ring-white/60' : ''"
            :aria-expanded="openPopout === group.category"
            :aria-label="`Show ${group.tools.length - INLINE_LIMIT} more ${CATEGORY_META[group.category].label} tools`"
            :title="`+${group.tools.length - INLINE_LIMIT} more ${CATEGORY_META[group.category].label} tools — click to expand:\n${group.tools.slice(INLINE_LIMIT).map(t => '• ' + t.label).join('\n')}`"
            @click="togglePopout(group.category)"
          >
            <span class="text-base leading-none" aria-hidden="true">⋯</span>
            <span class="text-[10px] font-bold leading-none tracking-wide whitespace-nowrap">+{{ group.tools.length - INLINE_LIMIT }} more</span>
          </button>

          <!-- Popout card — absolutely positioned below the pill, opens
               downward.  Click any tool to fire + auto-close.  Click the
               backdrop to dismiss without firing. -->
          <Teleport to="body">
            <div
              v-if="openPopout === group.category"
              class="fixed inset-0 z-[600]"
              aria-hidden="true"
              @click="openPopout = null"
            />
          </Teleport>
          <div
            v-if="openPopout === group.category"
            class="absolute top-full left-0 mt-1.5 z-[610]
                   flex flex-wrap items-stretch gap-1
                   rounded-xl bg-slate-900/95 ring-1 ring-white/25 shadow-2xl px-2 py-2
                   min-w-[12rem] max-w-[24rem]"
            role="menu"
            :aria-label="`${CATEGORY_META[group.category].label} — overflow tools`"
          >
            <button
              v-for="tool in group.tools.slice(INLINE_LIMIT)"
              :key="tool.id + '-popout'"
              type="button"
              role="menuitem"
              class="h-10 flex flex-col items-center justify-center gap-0.5 px-2 rounded-lg text-white
                     focus:outline-none focus:ring-2 focus:ring-white/60 transition-all"
              :class="[
                CATEGORY_META[group.category].accentClass,
                checkToolAvailability(tool).ok ? '' : 'opacity-40 saturate-50 cursor-not-allowed hover:opacity-50',
              ]"
              :aria-label="checkToolAvailability(tool).ok
                ? `Open ${tool.label} — ${CATEGORY_META[group.category].label} tool`
                : `Invalid: ${tool.label} cannot be used yet — click for explanation`"
              :title="checkToolAvailability(tool).ok
                ? `${tool.glyph} ${tool.label} — ${CATEGORY_META[group.category].label}`
                : `⚠ INVALID TOOL — ${tool.label} cannot be used yet.\n\nReason: ${(checkToolAvailability(tool) as {reason:string}).reason}`"
              @click="handleToolClick(tool)"
            >
              <span v-if="tool.glyphComponent" class="h-4 w-auto flex items-center justify-center" aria-hidden="true">
                <component :is="tool.glyphComponent" class="h-full w-auto" />
              </span>
              <span v-else class="text-base leading-none" aria-hidden="true">{{ tool.glyph }}</span>
              <span class="text-[10px] font-bold leading-none tracking-wide whitespace-nowrap">{{ tool.label }}</span>
            </button>
          </div>
          <!-- r41 v158 + v165 — empty-category placeholder.  Was a dead
               <span>; per Tom Gilb 2026-06-17 verbatim "these 4 are dead,
               at least info hover needs activating" it is now a real
               clickable <button> with rich HoverHint (lists which stages
               have tools in this category) + click handler that fires a
               teaching toast pointing to the first stage that does. -->
          <button
            v-if="group.tools.length === 0"
            type="button"
            class="h-10 flex items-center justify-center px-2 text-[10px] italic text-white/40 hover:text-white/70 whitespace-nowrap rounded-lg
                   bg-slate-900/30 hover:bg-slate-800/60 ring-1 ring-white/10 hover:ring-white/30
                   focus:outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-help"
            :aria-label="`No ${CATEGORY_META[group.category].label} tools at ${stageLabel[planningStage] ?? 'this stage'} — click for help`"
            :title="placeholderTitle(group.category)"
            @click="handlePlaceholderClick(group.category)"
          >—</button>
        </div>
      </div>
    </template>
    <span v-else class="text-[10px] italic text-white/40 px-2">
      No stage-specific tools — use ⚡ Actions for everything else.
    </span>

    <!-- r41 v123: Level 3 · Agents EXTRACTED to its own AgentsStrip.vue
         component for architectural separation matching its conceptual
         rank on the autonomy axis (Tom Gilb 2026-06-17 verbatim "ship
         phase 2 — I want all 3 new groups asap"). -->
  </div>
</template>
