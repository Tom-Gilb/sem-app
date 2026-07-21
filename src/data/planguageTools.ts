// UNIT_TYPE=Data
//
// planguageTools.ts — Registry of Planguage Design Tools
//
// Tom Gilb 2026-06-07: "This is all 'Pre-Evo step derivation, and will ignore
// Evo steps and tasks planned. So it belongs to the more general class of
// Planguage Tools (see Design Chapter in CE book). Sharpening is in that category
// because it generates Designs."
//
// Planguage Tools operate on the Spec itself — Functions, Values, Solutions,
// Constraints, Resources — BEFORE any Evo Step is derived. These are the
// design and analysis tools: you use them to arrive at a good Planguage spec.
// Evo Tools then take that spec and work with the derived Evo Steps and tasks.
//
// Source: Competitive Engineering (CE) book, Design chapter; Tom Gilb 2026-06-07.
//
// ARCHITECTURE (mirrors evoTools.ts pattern exactly):
//   1. DATA-DRIVEN — pure data, no Vue coupling.
//   2. EVENT-BASED ACTIVATION — each tool fires a named emitEvent.
//   3. TWIN-PORTABLE — PlanguageTool is a plain interface, no framework deps.
//   4. PLANGUAGE-CLEAN VOCABULARY — Banned-Scrum-Vocabulary rule.

export type PlanguageToolCategory =
  | 'design'      // Tools for creating and exploring design alternatives
  | 'sharpen'     // Tools for refining and improving the spec
  | 'analyse'     // Tools for analysing quality, standards compliance, conflicts
  | 'edit'        // Tools for directly editing spec entries

export const PLANGUAGE_TOOL_CATEGORY_META: Record<PlanguageToolCategory, {
  label: string
  tagline: string
  accent: string    // Tailwind gradient class
}> = {
  design: {
    label: 'Design Tools',
    tagline: 'Explore Solution alternatives, balance Values vs Resources, find the best design before committing',
    accent: 'from-orange-500 to-amber-500',
  },
  sharpen: {
    label: 'Sharpening Tools',
    tagline: 'Refine and improve the spec — precision, scale, meter, constraints, cost reduction',
    accent: 'from-amber-500 to-yellow-500',
  },
  analyse: {
    label: 'Analysis Tools',
    tagline: 'Audit quality, check standards compliance, detect conflicts, fetch external context',
    accent: 'from-violet-500 to-purple-600',
  },
  edit: {
    label: 'Edit Tools',
    tagline: 'Directly edit spec entries — Functions, Values, Solutions, Constraints, Resources',
    accent: 'from-slate-500 to-slate-700',
  },
}

export const PLANGUAGE_TOOL_CATEGORIES_IN_ORDER: PlanguageToolCategory[] = [
  'design',
  'sharpen',
  'analyse',
  'edit',
]

export type PlanguageToolStatus = 'ready' | 'wip' | 'planned'

export const PLANGUAGE_TOOL_STATUS_META: Record<PlanguageToolStatus, {
  label: string
  badge: string
  clickable: boolean
}> = {
  ready:   { label: 'Ready',   badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', clickable: true },
  wip:     { label: 'Partial', badge: 'bg-amber-100 text-amber-700 border-amber-200',       clickable: false },
  planned: { label: 'Planned', badge: 'bg-slate-100 text-slate-500 border-slate-200',       clickable: false },
}

export interface PlanguageTool {
  id:           string
  name:         string
  category:     PlanguageToolCategory
  description:  string
  /** CE / Gilb source for this tool's methodology */
  gilbSource?:  string
  emitEvent?:   string
  emitPayload?: Record<string, unknown>
  status:       PlanguageToolStatus
  source?:      string
}

export const PLANGUAGE_TOOLS: PlanguageTool[] = [

  // ── Design Tools ─────────────────────────────────────────────────────────────

  {
    id: 'auto-dbo',
    // Tom Gilb 2026-06-07: "Auto-DBO: Design BY Objectives. I want to create a new
    // tool, which is specialised in Design, finding Solutions. The designs will not
    // immediately be adopted in the Master Planguage specs. They must be approved."
    // Named after Lech Krzanik's Apple II Forth tool, circa 1978.
    name: 'Auto-DBO',
    category: 'design',
    description: 'Design By Objectives — create named Solution Versions as spec snapshots, edit speculatively without changing the master, sharpen with 9 design dimensions (quality, cost, effort, time, risk, competitiveness, innovation, security, usability), compare versions via IET matrix, approve to master when ready',
    gilbSource: 'CE Design chapter; Lech Krzanik / Tom Gilb, Apple II Forth, 1978',
    emitEvent: 'open-auto-dbo',
    status: 'ready',
    source: 'components/AutoDboPanel.vue · composables/useAutoDbo.ts · types/autoDbo.ts',
  },
  {
    id: 'optima',
    // Tom Gilb 2024: "Balancing Critical Values" (Optima book)
    name: 'OPTIMA — Balance',
    category: 'design',
    description: 'Value × Resource balance — drag resource sliders and see live impact on all Values; top-3 impacted vibrate; violations shake red; rebalancing suggestions strip. Based on Optima book.',
    gilbSource: 'Tom Gilb, Optima (2024): "Balancing Critical Values"',
    emitEvent: 'open-optima',
    status: 'ready',
    source: 'components/ResourceOptimaPanel.vue',
  },
  {
    id: 'multi-vision',
    name: 'MultiVision',
    category: 'design',
    description: 'Visualise all Values and Resources together — Wish/Goal/Tolerable bars, resource cost arcs, constraint rings. Slide ambition levels and see consequence before committing.',
    gilbSource: 'CE Value chapter; VDT (Value Delivery Table) methodology',
    emitEvent: 'open-multi-vision',
    status: 'ready',
    source: 'components/MultiVisionPanel.vue',
  },
  {
    id: 'penta',
    // Tom Gilb & Al Shalloway (2022): "The Penta Model" — SVERD (sword): Stakeholders, Values, Efficiency, Resources, Design.
    // Penta is a sharpening framework. Interactive 5-sector pinwheel with PentaOptima natural-language command engine.
    name: 'Penta Model',
    category: 'design',
    description: 'Penta sharpening framework (SVERD — sword): Stakeholders · Values · Efficiency · Resources · Design. 5-sector pinwheel shows live plan balance. PentaOptima command engine builds Claudian prompts for natural-language rebalancing (Reduce Capex 50%, Increase all Values 10%, etc.).',
    gilbSource: 'Gilb-Shalloway 2022 Penta Paper; Simple book Ch.4; CE Design chapter',
    emitEvent: 'open-penta',
    status: 'ready',
    source: 'components/PentaPanel.vue · composables/usePenta.ts · types/penta.ts',
  },
  {
    id: 'multi-forks',
    name: 'MultiForks — System View',
    category: 'design',
    description: 'System diagram: Resources fund Solutions → Solutions deliver Values. See the whole design model at once — hover any level label for Planguage definition, click for commitment checklist.',
    gilbSource: 'CE Chapter on System Model; Planguage [*] notation',
    emitEvent: 'open-multi-forks',
    status: 'ready',
    source: 'components/MultiForksPanel.vue',
  },

  // ── Sharpening Tools ─────────────────────────────────────────────────────────

  {
    id: 'sharpen',
    // Tom Gilb 2026-06-07: "Sharpening is in that category because it generates Designs"
    name: 'Sharpen Plan',
    category: 'sharpen',
    description: 'AI-assisted sharpening across multiple dimensions — Value precision, scale/meter, Function clarity, Constraint tightening, Solution detail. Each cycle produces a refined spec version. Generates design decisions, not just edits.',
    gilbSource: 'CE Sharpening chapter; Planguage Sharpening Rules',
    emitEvent: 'open-sharpen',
    status: 'ready',
    source: 'components/SharpenPanel.vue',
  },
  {
    id: 'kiss',
    name: 'KISS — Keep Improvement Super Surprising',
    category: 'sharpen',
    description: '5 most cost-effective spec improvements: constraint relaxation, solution-add, value-goal relax, resource reallocation, stakeholder power. Each with VDT-ranked Change Differential Diagram and 4 alternative approaches.',
    gilbSource: 'CE Design chapter; Kai-Zen continuous improvement methodology',
    emitEvent: 'open-kiss',
    status: 'ready',
    source: 'components/ResourcesKissPanel.vue',
  },
  {
    id: 'resources-sharpen',
    name: 'Resources Sharpen',
    category: 'sharpen',
    description: 'Sharpen Resource entries specifically — 9 guided dimensions for Budget precision, Tolerable limits, Deadline clarity, Headcount scaling. Suggested Planguage-syntax answers per question.',
    gilbSource: 'CE Resource chapter; Template_Write_Resource.md',
    emitEvent: 'open-resources-sharpen',
    status: 'ready',
    source: 'components/ResourcesSharpenPanel.vue',
  },

  // ── Analysis Tools ────────────────────────────────────────────────────────────

  {
    id: 'standards-auditor',
    name: 'Standards Auditor',
    category: 'analyse',
    description: 'Check the spec against 10.Standard/Standard.Kai-Zen/ — per-entry defect detection with specific Planguage Standard citations. Conjunction-of-Technologies: Gilb corpus + structured spec + AI reasoning.',
    gilbSource: 'Template_Write_*.md + Rule_Write_*.md (Kai-Zen standard set)',
    emitEvent: 'open-standards-auditor',
    status: 'ready',
    source: 'components/StandardsAuditorPanel.vue',
  },
  {
    id: 'planguage-analyzer',
    name: 'Planguage Analyser',
    category: 'analyse',
    description: 'Unified analysis panel — all 4 knowledge sources (plan data, Gilb corpus, LLM training, internet) applied to the spec. Per-finding source-layer badge: Derived / Cited from Gilb / LLM / Internet.',
    gilbSource: 'Conjunction-of-Technologies SUPREME principle; CE analysis methods',
    emitEvent: 'open-planguage-analyzer',
    status: 'ready',
    source: 'components/PlanguageAnalyzerPanel.vue',
  },
  {
    id: 'conflicts',
    name: 'Conflict Detector',
    category: 'analyse',
    description: 'Detect hidden stakeholder tensions and contradictions in the spec — Values pulling in opposite directions, Constraints that may block Solutions, stakeholder conflicts.',
    gilbSource: 'CE Stakeholder chapter; conflict-of-interest detection methodology',
    emitEvent: 'open-conflicts',
    status: 'ready',
    source: 'components/ConflictAnalysisPanel.vue',
  },
  {
    id: 'internet-context',
    name: 'Internet Context',
    category: 'analyse',
    description: 'Fetch current external context for stakeholders, regulations, and industry benchmarks — grounds AI suggestions in verifiable external data rather than LLM training alone.',
    gilbSource: 'Conjunction-of-Technologies #3+#4 (Stakeholder Context + Industry Benchmark)',
    emitEvent: 'open-internet-context',
    status: 'ready',
    source: 'components/InternetContextPanel.vue',
  },
  {
    id: 'plan-health',
    name: 'Plan Health (PHI)',
    category: 'analyse',
    description: 'Planguage Health Index — weighted score across Quality, Completeness, Consistency and Constraint-compliance dimensions. Expert Why? paragraph with Gilb URL citation per dimension.',
    gilbSource: 'CE Quality chapter; PHI methodology (Tom Gilb 2026)',
    emitEvent: 'open-plan-health',
    status: 'ready',
    source: 'components/SpecHealthStatusPanel.vue + SpecHealthTargetPanel.vue',
  },

  // ── Edit Tools ────────────────────────────────────────────────────────────────

  {
    id: 'spec-editor',
    name: 'Spec Editor',
    category: 'edit',
    description: 'Direct entry-level editing — Functions, Values, Solutions, Constraints, Resources. Full field editor per entry type. Filter, search, reorder.',
    gilbSource: 'Template_Write_*.md — all entry type schemas',
    emitEvent: 'open-spec-editor',
    status: 'ready',
    source: 'components/SpecEditorPanel.vue',
  },
  {
    id: 'feed-me',
    name: 'Feed Me',
    category: 'edit',
    description: 'Paste prose → AI parses into Planguage F./V./S./C./R. entries. The fastest way to get natural-language requirements into a structured Planguage spec.',
    gilbSource: 'CE parsing methodology; Planguage entry type classification',
    emitEvent: 'open-feed-me-planguage',
    status: 'ready',
    source: 'composables/useFeedMe.ts',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getPlanguageToolsByCategory(cat: PlanguageToolCategory): PlanguageTool[] {
  return PLANGUAGE_TOOLS.filter(t => t.category === cat)
}

export function readyPlanguageToolCount(): number {
  return PLANGUAGE_TOOLS.filter(t => t.status === 'ready').length
}
