// UNIT_TYPE=Data
//
// evoTools.ts — Registry of all Evo-specialised tools accessible via the
// Evo Tools button.
//
// SOURCE: Tom Gilb 2026-06-03: *"OK Evo Tools: I want to put down a marker,
// get started on a set of special Evo Tools (sort of like actions, but very
// specialised on Evo. We already have some starters we can import like the
// Value Flow and the Evo Video, please help me assemble the team behind a
// Evo Tools Button"*
//
// ARCHITECTURE (per Architectural Resilience Rule — SUPREME):
//
//   1. DATA-DRIVEN — this file is pure data, no Vue coupling. Adding a new
//      tool is a single registry-entry append. No code changes elsewhere
//      until activation requires new event handlers in App.vue.
//
//   2. EVENT-BASED ACTIVATION — each tool fires a named event the EvoToolsPanel
//      emits up to App.vue. Reuses existing App.vue handlers wherever possible
//      (open-value-flow, open-evo-simulator, etc.). No duplicate wiring.
//
//   3. TWIN-PORTABLE — Tool is a plain interface, no framework dependencies.
//      Kai's team can port the registry to any UI shell. The status field
//      makes "shipped vs roadmap" visible without code coupling.
//
//   4. PLANGUAGE-CLEAN VOCABULARY — every tool name uses Planguage terms
//      (Banned-Scrum-Vocabulary rule). Legacy scrum-named composables are
//      surfaced under their Planguage-correct UI label (e.g., useStepRetro
//      surfaces as "Study-Act / Reflection"). Rename of the .ts file follows
//      in a future cleanup pass.
//
//   5. STATUS LIFECYCLE — every tool carries a status:
//        - 'ready'    : fully wired, click works, opens the tool
//        - 'wip'      : reachable via another surface (e.g. EvoPlanView step
//                       action menu); the Evo Tools button surfaces it as a
//                       first-class entry but the underlying surface is still
//                       buried in a parent panel
//        - 'planned'  : recognised candidate, no wiring yet
//      The UI shows a small badge for non-'ready' tools so users know what
//      to expect.

/** Categories for the Evo Tools catalogue.
 *
 *  Authority: Tom Gilb 2026-06-03 taxonomy — *"Evo Visualization Tools, Evo
 *  Editing Tools, Evo Sharpening Tools, Evo Feedback Tools, Evo Step
 *  Management Tools"*. Replaces Claudian's earlier (visualise / estimate /
 *  critique / step-detail / cycle-setup) bins which were thing-oriented;
 *  Tom's bins are task-action-oriented (what is the user DOING) and align
 *  with the Evo methodology vocabulary. */
export type EvoToolCategory =
  | 'visualization'
  | 'editing'
  | 'sharpening'
  | 'improvement'      // Tom 2026-06-03 — added when "Evo Step Improvement"
                       // was specified as a SEPARATE section, not under Sharpening
  | 'feedback'
  | 'step-management'

/** Display metadata for each category — shown as section header in panel. */
export const EVO_TOOL_CATEGORY_META: Record<EvoToolCategory, {
  label: string
  tagline: string
  /** Tailwind class for the category accent colour (used in section header). */
  accent: string
}> = {
  visualization: {
    label: 'Evo Visualization Tools',
    tagline: 'See the Evo plan from every angle — flow, simulation, swimlane, graphs',
    accent: 'from-indigo-500 to-violet-500',
  },
  editing: {
    label: 'Evo Editing Tools',
    tagline: 'Modify the plan — cycle length, scope, increment boundaries',
    accent: 'from-slate-500 to-slate-700',
  },
  sharpening: {
    label: 'Evo Sharpening Tools',
    tagline: 'Refine and prioritise — VDTs, cognitive load, WIP, capacity, the Sharp Interview',
    accent: 'from-amber-500 to-orange-500',
  },
  improvement: {
    label: 'Evo Improvement Tools',
    tagline: 'The Evo Planner proposes crazy first shots, critiques them, offers 1–5 better ideas, plus Skunkworks 2×–10× daring shots',
    accent: 'from-fuchsia-500 to-purple-600',
  },
  feedback: {
    label: 'Evo Feedback Tools',
    tagline: 'Critique, learn, Study-Act — measure outcomes against intent',
    accent: 'from-pink-500 to-rose-500',
  },
  'step-management': {
    label: 'Evo Step Management Tools',
    tagline: 'Execute the step — tasks, DoR, DoD, acceptance, pair/mob, mitigation',
    accent: 'from-sky-500 to-blue-500',
  },
}

/** Status lifecycle for each tool. */
export type EvoToolStatus = 'ready' | 'wip' | 'planned'

/** Display metadata for status — used to render badge in tile. */
export const EVO_TOOL_STATUS_META: Record<EvoToolStatus, {
  label: string
  /** Tailwind classes for the badge. */
  badge: string
  /** Whether the tile is clickable (only 'ready' is clickable in v1). */
  clickable: boolean
}> = {
  ready: { label: 'Ready', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', clickable: true },
  wip:   { label: 'In EvoPlanView', badge: 'bg-amber-100 text-amber-700 border-amber-200', clickable: false },
  planned: { label: 'Planned', badge: 'bg-slate-100 text-slate-500 border-slate-200', clickable: false },
}

/** A single Evo tool — pure data, no Vue coupling. */
export interface EvoTool {
  /** Stable id, e.g. 'value-flow'. Used as Vue :key and emit identifier. */
  id: string
  /** Display name (Planguage-clean, no scrum vocabulary). */
  name: string
  /** Category bucket — drives panel section placement. */
  category: EvoToolCategory
  /** One-line description for tile body + button title attribute. */
  description: string
  /** Event the EvoToolsPanel emits when the tile is clicked. App.vue listens
   *  and dispatches to the right surface/handler. Only used when status='ready'. */
  emitEvent?: string
  /** Optional payload for the emit event (e.g., which tab to open). */
  emitPayload?: Record<string, unknown>
  /** Status — determines clickability and badge. */
  status: EvoToolStatus
  /** Underlying file path (for cross-reference; future audit script can verify
   *  the file still exists). Relative to src/. */
  source?: string
}

/** The complete Evo Tools registry. v1 ships 3 ready tools; the remaining 27
 *  are documented as planned/wip targets. Adding wiring later requires:
 *    (1) flip status to 'ready'
 *    (2) ensure emitEvent has an App.vue handler (most already do)
 *    (3) no other change needed
 */
export const EVO_TOOLS: EvoTool[] = [
  // ── Evo Visualization Tools ────────────────────────────────────────────────
  {
    id: 'value-flow',
    name: 'Value Flow',
    category: 'visualization',
    description: 'Tasks → Evo Steps → Solutions → Values → Functions → Stakeholders causal flow',
    emitEvent: 'open-value-flow',
    status: 'ready',
    source: 'components/ValueFlowDiagram.vue',
  },
  {
    id: 'evo-simulator',
    name: 'Evo Simulator',
    category: 'visualization',
    description: 'Animated delivery timeline (the "Evo Video") with cumulative value across the cycle',
    emitEvent: 'open-evo-simulator',
    status: 'ready',
    source: 'components/EvoSimulatorView.vue',
  },
  {
    id: 'visualise-gallery',
    name: 'Diagram Gallery',
    category: 'visualization',
    description: 'Open the 9-tab gallery: Flow, Radar, Architecture, Risk, Finance, Swimlane, Simulator, Deps, Efficiency',
    emitEvent: 'open-visualise',
    emitPayload: { tab: 'flow' },
    status: 'ready',
    source: 'components/VisualisePanelModal.vue',
  },
  {
    id: 'heat-lane',
    name: 'Swimlane (HeatLane)',
    category: 'visualization',
    description: 'Evo Steps × spec entries as a heat-mapped swimlane',
    emitEvent: 'open-heat-lane',
    status: 'ready',
    source: 'components/SpecHeatLane.vue',
  },
  {
    id: 'knowledge-graph',
    name: 'Step ↔ Value Knowledge Graph',
    category: 'visualization',
    description: 'Dependency graph between Evo Steps and Values',
    status: 'wip',
    source: 'composables/useStepKnowledgeGraph.ts',
  },

  // ── Evo Editing Tools ──────────────────────────────────────────────────────
  {
    id: 'cycle-length',
    name: 'Evo Cycle Length',
    category: 'editing',
    description: 'Set Day / Week / Month / Quarter cycle — drives plan generation constraint',
    emitEvent: 'go-to-evo-steps-stage',
    status: 'ready',
    source: 'components/EvoCycleLengthPicker.vue',
  },

  // ── Evo Sharpening Tools ───────────────────────────────────────────────────
  {
    id: 'sharpen-next-step',
    // Tom 2026-06-03: "Evo Tool: 'Next Value Step Focus'... Sub-Tool 'Evo Sharp
    // Interview' (Like the sharpening questions and answers) but very focussed
    // on Evo Value Delivery". v1 ships the Sharp Interview sub-tool.
    name: 'Sharpen Next Step',
    category: 'sharpening',
    description: '12-category Sharp Interview that crystallises the next Evo Step before commit — Tom\'s methodology, Value-Delivery-focused',
    emitEvent: 'open-sharpen-next-step',
    status: 'ready',
    source: 'components/EvoSharpInterview.vue',
  },
  {
    id: 'vstep-vdt',
    name: 'V × Step VDT',
    category: 'sharpening',
    description: 'Impact Estimation Table keyed by Evo Step (the unit of value delivery)',
    emitEvent: 'go-to-evo-impact-stage',
    status: 'ready',
    source: 'components/ImpactEstimationStepView.vue',
  },
  {
    id: 'vs-vdt',
    name: 'V × S VDT',
    category: 'sharpening',
    description: 'Impact Estimation Table keyed by Solution — feeds V × Step aggregation',
    emitEvent: 'go-to-evo-impact-stage',
    status: 'ready',
    source: 'components/ImpactEstimationView.vue',
  },
  {
    id: 'cog-load',
    name: 'Cognitive Load',
    category: 'sharpening',
    description: '5-axis cognitive load score per Evo Step (complexity, integration, team, timeline, risk)',
    status: 'wip',
    source: 'composables/useStepCogLoad.ts',
  },
  {
    id: 'capacity-planner',
    name: 'Capacity Planner',
    category: 'sharpening',
    description: 'Per-step capacity calendar with day-by-day effort allocation',
    status: 'wip',
    source: 'composables/useCapacityPlanner.ts',
  },
  {
    id: 'wip-limiter',
    name: 'WIP Limiter',
    category: 'sharpening',
    description: 'Limits concurrent active steps; suggests pause candidates by WSJF',
    status: 'wip',
    source: 'composables/useWipLimiter.ts',
  },
  {
    id: 'step-cost',
    name: 'Step Cost Estimator',
    category: 'sharpening',
    description: 'Per-step cost from effortPercent × cycle hours × hourly rate',
    status: 'wip',
    source: 'composables/useStepCostEstimator.ts',
  },
  {
    id: 'critical-path',
    name: 'Critical Path',
    category: 'sharpening',
    description: 'Highlights the longest dependency chain across steps',
    status: 'wip',
    source: 'composables/useCriticalPath.ts',
  },
  {
    id: 'timebox-planner',
    name: 'Timebox Planner',
    category: 'sharpening',
    description: 'Per-step timebox selector (1hr / 2hr / 4hr / full-day)',
    status: 'wip',
    source: 'composables/useTimeboxPlanner.ts',
  },
  {
    id: 'spikes-detector',
    name: 'Spike Risk Detector',
    category: 'sharpening',
    description: 'Auto-detects high/medium/low spike risk per step',
    status: 'wip',
    source: 'composables/useSpikesDetector.ts',
  },

  // ── Evo Improvement Tools ──────────────────────────────────────────────────
  // Tom 2026-06-03: "a separate Evo Tool section for (not at bottom of
  // sharpening as in SEM, separate): 'Evo Step Improvement'.  It suggests 1
  // or more strong ideas, the 'Evo Planner' (note the term) suggest their
  // best shot at a 'crazy' possibility.  It analyzes critically.  Offers 1
  // or 5 better ideas.,  Then a separate sub tool 'Daring and Wild Evo Ideas'
  // (designed to improve the result by 2x to 10X, at higher risks and costs),
  // sort of 'Skunkworks' (call it that)."
  {
    id: 'evo-step-improvement',
    name: 'Evo Step Improvement',
    category: 'improvement',
    description: 'The Evo Planner: crazy first shot + critique + 1–5 better ideas, each expressed in VDT/IET terms',
    emitEvent: 'open-evo-step-improvement',
    status: 'ready',
    source: 'components/EvoStepImprovement.vue',
  },
  {
    id: 'skunkworks',
    name: 'SKUNKWORKS: Daring and Wild Evo Ideas',
    category: 'improvement',
    description: 'Radical tradeoff shifts — more risk, more resources, relax known constraints. 2×–10× lift in VDT/IET terms. Iterate.',
    // Opens the same Evo Step Improvement panel — Skunkworks is a sub-section
    // within it, not a separate modal.  Future v2 could deep-link / scroll to
    // the skunkworks section on open.
    emitEvent: 'open-evo-step-improvement',
    status: 'ready',
    source: 'components/EvoStepImprovement.vue (Skunkworks section)',
  },

  // ── Evo Feedback Tools ─────────────────────────────────────────────────────
  {
    id: 'feed-me',
    // Tom 2026-06-03: "FEED ME!" (Audrey II, Little Shop of Horrors).  Feedback
    // (broad, deep, all sources) + Learning (changes to specs / evo / tasks).
    // 3 sources: Feedback Base (older system), Evo Base (history of completed
    // steps), Last Step in Paris (latest + lagging measures + tough Qs).
    // Output: recommended actions with audit trail (Source + Reason required).
    name: 'FEED ME!',
    category: 'feedback',
    description: 'Audrey II for your Evo plan: feedback from all sources → tough questions for DEV → recommended actions with full audit trail (Source + Reason)',
    emitEvent: 'open-feed-me',
    status: 'ready',
    source: 'components/FeedMePanel.vue',
  },
  {
    id: 'evo-critique',
    name: 'Evo Critique',
    category: 'feedback',
    description: '10-dimension AI health check across planning and delivery cycles',
    emitEvent: 'open-evo-critique',
    status: 'ready',
    source: 'components/EvoCritiquerPanel.vue',
  },
  {
    id: 'step-learning',
    name: 'Step Learning Outcomes',
    category: 'feedback',
    description: 'Generates 3 learning outcomes per Evo Step for the Learn phase',
    status: 'wip',
    source: 'composables/useStepLearning.ts',
  },
  {
    id: 'study-act-reflection',
    // Planguage rename — file is still useStepRetro.ts (scrum legacy, flagged for batch rename)
    name: 'Study-Act / Reflection',
    category: 'feedback',
    description: 'Reflection prompts (went well, improve, experiment) per Evo Step',
    status: 'wip',
    source: 'composables/useStepRetro.ts',
  },
  {
    id: 'step-mood',
    name: 'Step Mood Tracker',
    category: 'feedback',
    description: 'Emoji mood tracker per Evo Step (😰 / 😐 / 😊 / 🤩)',
    status: 'wip',
    source: 'composables/useStepMood.ts',
  },

  // ── Evo Step Management Tools ──────────────────────────────────────────────
  {
    id: 'tasks',
    name: 'Tasks for an Evo Step',
    category: 'step-management',
    description: 'AI-suggested concrete tasks per Evo Step',
    emitEvent: 'go-to-tasks-stage',
    status: 'ready',
    source: 'components/TaskList.vue',
  },
  {
    id: 'step-dod',
    name: 'Definition of Done',
    category: 'step-management',
    description: 'DoD checklist per Evo Step (completion criteria)',
    status: 'wip',
    source: 'composables/useStepDoD.ts',
  },
  {
    id: 'step-ready',
    name: 'Definition of Ready',
    category: 'step-management',
    description: 'Pre-delivery readiness gates per Evo Step',
    status: 'wip',
    source: 'composables/useStepReady.ts',
  },
  {
    id: 'step-mitigation',
    name: 'Risk Mitigation Plan',
    category: 'step-management',
    description: 'Preventive + contingent strategies per Evo Step',
    status: 'wip',
    source: 'composables/useStepMitigation.ts',
  },
  {
    id: 'step-acceptance',
    name: 'Acceptance Tests',
    category: 'step-management',
    description: 'BDD Gherkin scenarios per Evo Step',
    status: 'wip',
    source: 'composables/useStepAcceptance.ts',
  },
  {
    id: 'step-pair',
    name: 'Pair Programming Plan',
    category: 'step-management',
    description: '4 Pomodoro blocks with driver/navigator roles per step',
    status: 'wip',
    source: 'composables/useStepPair.ts',
  },
  {
    id: 'step-mob',
    name: 'Mob Programming Plan',
    category: 'step-management',
    description: '4 rotations × 10 min per driver swap, per Evo Step',
    status: 'wip',
    source: 'composables/useStepMob.ts',
  },
  {
    id: 'step-sync',
    // Planguage rename — file is still useStepStandup.ts (scrum legacy)
    name: 'Step Status Check',
    category: 'step-management',
    description: 'Brief status-check script per step (yesterday / today / blockers)',
    status: 'wip',
    source: 'composables/useStepStandup.ts',
  },
  {
    id: 'step-agenda',
    name: 'Step Meeting Agenda',
    category: 'step-management',
    description: 'Time-boxed 4-section meeting agenda per Evo Step',
    status: 'wip',
    source: 'composables/useStepAgenda.ts',
  },
  {
    id: 'step-spike',
    name: 'Spike Plan',
    category: 'step-management',
    description: 'Time-boxed exploratory work plan (reason, severity, duration)',
    status: 'wip',
    source: 'composables/useStepSpike.ts',
  },
]

/** Returns tools filtered by category. Stable order from EVO_TOOLS array. */
export function getEvoToolsByCategory(category: EvoToolCategory): EvoTool[] {
  return EVO_TOOLS.filter(t => t.category === category)
}

/** Returns the count of 'ready' tools — useful for the button's badge. */
export function readyToolCount(): number {
  return EVO_TOOLS.filter(t => t.status === 'ready').length
}

/** Returns all categories in display order (matches Tom's 2026-06-03 taxonomy). */
export const EVO_TOOL_CATEGORIES_IN_ORDER: EvoToolCategory[] = [
  'visualization',
  'editing',
  'sharpening',
  'improvement',
  'feedback',
  'step-management',
]
