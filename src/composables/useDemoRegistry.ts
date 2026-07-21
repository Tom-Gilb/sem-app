// useDemoRegistry.ts — Single source of truth for Demos Menu content.
//
// Tom Gilb 2026-06-18 verbatim "D, great, an Evo process! Go Populate all
// menu entries with at least one clip or snapshot.  I will paste latest copy
// of my SEM app Book now as one source for you" + 2026-06-18 paste at
// `5 - Project/SEM App/assets/SEMappHandbook 18 June.pdf`.
//
// Per `rule_demo_production_evo.md` SUPREME: every Demos Menu entry MUST
// carry at least a Tolerable-tier clip (text) or snapshot (image).  Goal +
// Wish + Stretch tiers add Pl (Planguage) event-script + audio + Claudian authoring
// later, incrementally.
//
// Source for v168: Tom's SEM App Book (147 MB PDF, June 18 2026 version
// 17 June 2026 23:47, "Patent Pending Software" cover) — extracted via
// pdftotext into 9119-line plain text.  Each entry's `source` field cites
// the SEM App Book.

export interface DemoContent {
  /** Markdown-formatted text clip (2-6 sentences from the SEM App Book or other source). */
  clip?: string
  /** Public asset path to a snapshot image (will be added incrementally). */
  snapshotUrl?: string
  /** Citation: where this clip came from. */
  source: string
  /** Tolerable tier shipped → entry is now `available: true` in the menu. */
  available: boolean
}

/** Demo entry IDs mirror DemosMenu.vue.  Single source of truth. */
export type DemoId =
  // End-to-end
  | 'e2e'
  // Stages (1..11)
  | 'stage-1' | 'stage-2' | 'stage-3' | 'stage-4' | 'stage-5' | 'stage-6'
  | 'stage-7' | 'stage-8' | 'stage-9' | 'stage-10' | 'stage-11'
  // Tools
  | 'tool-penta' | 'tool-multivision' | 'tool-iet' | 'tool-optima'
  | 'tool-sharpen-spec' | 'tool-sharpen-tools' | 'tool-phi' | 'tool-standards'
  | 'tool-evo-plan' | 'tool-templates' | 'tool-get-a-plan'
  // Agents
  | 'agent-maria' | 'agent-contracts' | 'agent-stakeholder' | 'agent-evo-sharp'
  | 'agent-spec' | 'agent-decisions' | 'agent-strategy' | 'agent-incorruptible'
  | 'agent-inc-sharp' | 'agent-elon' | 'agent-elon-sharp' | 'agent-auto-dbo'

export const DEMO_REGISTRY: Record<DemoId, DemoContent> = {
  // ─── End-to-End ────────────────────────────────────────────────────────────
  'e2e': {
    clip: `**The SEM App** is a documentation of the experimental design brainstorming for a planning and modeling app, to find designs to port to Tom's Twin Consultant app.  Full planning flow: Stakes → Solutions → Sharpen → Impacts → Refine → Evo Steps → Evo Impact → Tasks → Study-Act → Resources → Export.\n\nThe 11 Planning Stages are simultaneous views into ONE living plan, not sequential gates.  Any stage can be entered at any time — forward, backward, or jumping multiple stages.`,
    source: 'SEM App Book (June 18 2026), front cover + Evo Stage Navigation principle',
    available: true,
  },

  // ─── Stages ────────────────────────────────────────────────────────────────
  'stage-1': {
    clip: `**Stage 1 · Spec Draft** — the Stakes capture.  Stakeholders, Ends, and Means.  Type or paste a brief project description; the AI parses it into Planguage entries: Function, Value, Solution, Constraint, Resource.  Per the Spec Draft Menu pattern, all Stage 1 content lives in ONE labeled container so the planner sees the stage's purpose at-a-glance.`,
    source: 'SEM App Book, Planning Stage 1 (Stakes → Ends → Means)',
    available: true,
  },
  'stage-2': {
    clip: `**Stage 2 · Solutions** — generate Solutions from the captured Values.  Each Solution is a Planguage S. entry that proposes a measurable contribution to one or more Values.  Penta visualization opens here: the 5-sector pinwheel makes the Solution's reach across Values + Functions + Constraints + Resources visible at-a-glance.`,
    source: 'SEM App Book, Planning Stage 2 (Solutions)',
    available: true,
  },
  'stage-3': {
    clip: `**Stage 3 · Sharpening** — the Deep AI heart of SEM App.  Sharpen Spec asks 12 categories × 3 questions = 36 sharpening questions.  Each question carries 3 AI-suggested starter answers with provenance (Plan / Gilb-Standard / Template).  Tick the suggestions you want, type your free-text additions, then click Synthesise & Apply — answers route through the Accept-Fix pipeline with Source-stamping + Undo preserved.`,
    source: 'SEM App Book, Sharpening Cycles (canonical Sharpening process)',
    available: true,
  },
  'stage-4': {
    clip: `**Stage 4 · Impact Estimation** — fill the IET (Impact Estimation Table), a.k.a. VDT (Value Decision Table).  Rows are Solutions, columns are Values; each cell carries an impact estimate (positive emerald, negative rose, neutral slate).  The AI suggests starter values; you sharpen them with your knowledge of the domain.`,
    source: 'SEM App Book, Planning Stage 4 Impacts',
    available: true,
  },
  'stage-5': {
    clip: `**Stage 5 · Refine** — Refine Solutions based on the Impact Estimation results.  Low-impact solutions get cut or sharpened; high-impact solutions get more attention.  The Penta pinwheel re-renders showing the refined balance of sectors.`,
    source: 'SEM App Book, Planning Stage 5 Refine Solutions',
    available: true,
  },
  'stage-6': {
    clip: `**Stage 6 · Evo Steps** — slice the refined Solutions into Evo Steps per Tom Gilb's iterative-delivery method (since 1960).  Each Evo Step is a small, valuable, deliverable increment.  The Evo Plan tool shows the 9-step Evo cycle: Plan → Develop → Deliver → Measure → Learn → re-Plan.`,
    source: 'SEM App Book, Stage 6 Evo Cycles + canonical Evo methodology',
    available: true,
  },
  'stage-7': {
    clip: `**Stage 7 · Evo Impact** — per-step projection of impact on each Value.  Shows the cumulative impact trajectory as each Evo Step delivers.  The IET extends with Evo-Step columns alongside Solution columns.`,
    source: 'SEM App Book, Stage 7 Evo Impact detail',
    available: true,
  },
  'stage-8': {
    clip: `**Stage 8 · Tasks** — break each Evo Step into Tasks.  Tasks are the unit of work assignment; each Task ties back to its parent Evo Step and ultimately to the Values it contributes to.  PlTaskIcon glyph: ⌑ (the canonical Planguage Task notation).`,
    source: 'SEM App Book, Planning Stage 8 Tasks Planning',
    available: true,
  },
  'stage-9': {
    clip: `**Stage 9 · Study-Act** — the Measure → Learn loop after each delivered Evo Step.  Measure the actual impact (Status field on each Value); compare to the planned Goal; learn what worked and what to change.  This is the feedback loop that makes Evo iterative.`,
    source: 'SEM App Book, Stage 9 Detail Study-Act',
    available: true,
  },
  'stage-10': {
    clip: `**Stage 10 · Resources** — Resource entries (R.) get sharpened.  Resources Sharpening tool runs domain-specific dimensions (cost, time, headcount, capacity).  OPTIMA then compares versioned Resource allocations across alternative Solution mixes.`,
    source: 'SEM App Book, Planning Stage 10 Resources',
    available: true,
  },
  'stage-11': {
    clip: `**Stage 11 · Export** — share the full Planguage plan via Email (auto-opens Mail.app per SEM Email Body Standard) or Download (PDF / Markdown / HTML).  Colorful HTML export per the canonical sibling-tables-for-presentation Keynote-compatible format.`,
    source: 'SEM App Book, Stage 11 Export + Colorful HTML Spec Email rule',
    available: true,
  },

  // ─── Tools ─────────────────────────────────────────────────────────────────
  'tool-penta': {
    clip: `**Penta** — Co-invented by Tom Gilb & Al Shalloway (2022).  A 5-sector pinwheel: **S**takeholders / **V**alues / **E**fficiency / **R**esources / **D**esign — SVERD.  Five forces in dynamic balance.\n\n**Cascade-ripple visualisation (most complete):** the pentagon SVG shows **animated rings** on changed entries — **amber pulse** = source of change, **red blink** = target affected, **orange flash** = what-if probe.  The right panel shows the blinking ⚡ banner; expand it for the full impact table.  🎬 Diagram opens the animated cascade flow diagram.\n\n**Governance:** the 📋 PentaGovernancePanel exposes a Pending Changes tab (before/after for every field change) + a Cascade Impacts tab (full analyzed impact list with status: unanalyzed / no-impact / change-required / change-applied / declared-not-calculated).`,
    source: 'SEM App Book p.7451 (cascade-ripple map) + Penta Model Master (Gilb & Shalloway 2022)',
    available: true,
  },
  'tool-multivision': {
    clip: `**MultiVision** — 3-zone Tolerable / Goal / Wish bars with live sliders.  Each Value's scalar levels render as a horizontal bar with three coloured zones: FAILED (red) / TOLERABLE (amber) / SUCCESS (green).  Drag the slider thumbs to set Tolerable / Goal / Wish.  Smiley face thumbs make the at-a-glance reading immediate.`,
    source: 'SEM App Book, MultiVision feature (Value scalar visualisation)',
    available: true,
  },
  'tool-iet': {
    clip: `**IET (Impact Estimation Table)** — a.k.a. VDT (Value Decision Table) per Tom Gilb's classical Planguage notation.  Rows = Solutions, columns = Values.  Each cell shows the estimated impact of that Solution on that Value, with an emerald/rose colour code for polarity.  AI fills starter estimates; planner sharpens with domain knowledge.`,
    source: 'SEM App Book, Planguage tools — Impact Estimation (VIET, CE)',
    available: true,
  },
  'tool-optima': {
    clip: `**OPTIMA** — Alternative comparison tool.  Shows multiple Solution mixes side-by-side with their projected impacts on each Value + their Resource footprints.  Pick the alternative that best balances Value-delivery against Resource-budget.  Composes with Auto-DBO's versioned snapshots.`,
    source: 'SEM App Book, OPTIMA Master (Alternative comparison framework)',
    available: true,
  },
  'tool-sharpen-spec': {
    clip: `**Sharpen Spec** — the Q&A interview.  12 categories × 3 questions × 3 starter answers per question = 108 sharpening prompts.  Each prompt carries provenance (Plan / Gilb-Standard / Template).  Answers route through the Accept-Fix pipeline.  The "star of the show" Deep AI tool.`,
    source: 'SEM App Book, Sharpening Cycles (12-category × 3-question interview)',
    available: true,
  },
  'tool-sharpen-tools': {
    clip: `**Sharpen Tools** — the toolbox of sharpening passes.  Constraints sharpening · Time-horizon sharpening · Stakeholder sharpening · Solution sharpening · Resource sharpening · etc.  Each pass focuses on one dimension of the spec.`,
    source: 'SEM App Book, Sharpening Tools master list',
    available: true,
  },
  'tool-phi': {
    clip: `**PHI (Plan Health Index)** — weighted 0-100 quality score across 7 aspect groups.  Composes with many dozens of criteria per aspect.  Status displays as a circular SVG gauge in the Plan Crest bar; click for the full PHI Dashboard with per-aspect breakdown.`,
    source: 'SEM App Book, Plan Health Index (PHI) + PlanHealthBadge',
    available: true,
  },
  'tool-standards': {
    clip: `**Standards Auditor** — cross-references the live spec against '10.Standard/Standard.Kai-Zen/' Templates + Rules.  Every finding cites the standard violated (file + section + quote).  Deterministic engine + Claudian-driven enrichment.`,
    source: 'SEM App Book, Standards Auditor (10.Standard/ cross-reference)',
    available: true,
  },
  'tool-evo-plan': {
    clip: `**Evo Plan** — slice Solutions into Evo Steps.  Visualizes the 9-step Evo cycle as a violet ring with 9 amber step markers + direction arrow.  Per Tom Gilb 1960: small, valuable, deliverable increments beat big-bang waterfall.`,
    source: 'SEM App Book, Stage 6 Evo Cycles + Evo cycle 9-step methodology',
    available: true,
  },
  'tool-templates': {
    clip: `**Templates** — 18 built-in domain models across 6 categories (Organizational / Project / Product / National / International / Software).  Browse the library, view each model's Planguage entries, copy any model into your spec.  Visualised as a stack of 3 fan-offset model thumb cards.`,
    source: 'SEM App Book, Spec Models library (Templates)',
    available: true,
  },
  'tool-get-a-plan': {
    clip: `**Get A Plan** — unified import / load / merge panel.  Accepts pasted text, file upload (Word/PDF/Markdown), URL fetch.  The Spec Agent processes the input into Planguage entries.  Planguage glyph '[*]→*' — "retrieve from outside the vessel."`,
    source: 'SEM App Book, Get A Plan unified import (GetGlyph DD-001)',
    available: true,
  },

  // ─── Agents ────────────────────────────────────────────────────────────────
  'agent-maria': {
    clip: `**Maria** is a governance intelligence agent for boards.  Paste any board document (minutes, resolutions, strategy papers, committee reports); Maria runs an AI analysis and returns a four-section structured report:\n\n1. **Decision Inventory** — every decision extracted, classified by governance layer (Board / Management / Operations)\n2. **Authority Clarity Report** — decisions where ownership is unclear or contested\n3. **Governance Gap List** — topics that should have a board decision recorded but do not\n4. **Pattern Analysis** — recurring board behaviour patterns\n\n**Board Member Cards + Auto-Suggest:** members carry interests / abilities / preferred-tasks / avoided-tasks arrays.  A pure keyword scorer (+3 ability · +2 interest · +2 preferred · −2 avoided) returns top-2 suggested members per gap with human-readable reasons ("matched on: ability: financial analysis · interest: governance").\n\n**Tone is always opportunities for board action** (baked into the LLM system prompt).  Named after Maria Montessori (1870-1952), Italy's first woman doctor and revolutionary educator.`,
    source: 'SEM App Book F01 (MariaAgentBoard.vue) + F04 (boardMatcher.ts auto-suggest scoring)',
    available: true,
  },
  'agent-contracts': {
    clip: `**Contracts** — Planguage Contract Analysis Agent.  Imports any contract (SLA / NDA / service agreement / employment) and converts clauses to clear, measurable Planguage: Function, Value, Constraint, Resource, Solution, Task entries.  Flags vague language and builds a party-obligation matrix.  Iconography: the § silcrow, medieval European legal section marker since the 12th century.`,
    source: 'SEM App Book, Contracts mode + Contract Analysis',
    available: true,
  },
  'agent-stakeholder': {
    clip: `**Stakeholder Mapper** — name any stakeholder (person / organisation / government / inanimate entity) and AI immediately drafts all 10 attribute levels (Power, Interest, Influence, Support, …) with a source URL and fact for each.  Updates automatically when you refine the stakeholder context.  Icon: the canonical Planguage ←§→ Stakeholder glyph.`,
    source: 'SEM App Book, Stakeholder Mapper (10-attribute AI-drafted profile)',
    available: true,
  },
  'agent-evo-sharp': {
    clip: `**Evo Sharpening** — Evo Health Check + Value Delivery deep-dive + Accept-Fix.  Reviews your plan against all 9 steps of the Evo cycle.  Scores 10 health dimensions (Stakeholder Coverage, Values Completeness, Priority Alignment, …).  Findings route through the Accept-Fix pipeline.  The Evo cycle, Tom Gilb's iterative-delivery method since 1960, predates Agile by 40+ years.`,
    source: 'SEM App Book, Evo Critiquer / Evo Sharpening agent',
    available: true,
  },
  'agent-spec': {
    clip: `**Spec Agent** — Universal Planguage Converter.  Paste any text (business brief, roadmap, strategy doc, rough notes) and AI converts it to full Planguage Function / Value / Constraint / Resource / Solution entries.  Then analyses problems + inconsistencies, suggests improvements, and applies them on your command ("simplify", "innovate", "make measurable").  Full version history with before/after comparison.`,
    source: 'SEM App Book, Spec Agent / Plan Importer (universal converter)',
    available: true,
  },
  'agent-decisions': {
    clip: `**Decisions** — Planguage Decision Analysis Agent.  Describe any decision and its options.  AI builds a scored decision matrix (options × Planguage criteria), models each option as Function / Value / Constraint entries, recommends the best path with rationale, and compares against any other plan you load.  Iconography: fork in the road + question mark — humanity's oldest decision symbol.`,
    source: 'SEM App Book, Decisions Agent',
    available: true,
  },
  'agent-strategy': {
    clip: `**Strategy Sharpening** — 10-Dimension Gilb Strategy Audit.  Instantly audits your spec against 10 Gilb-grounded dimensions: Value Traceability · Impact Quantification · Constraint Compliance · Goal Coverage · Resource Feasibility · Solution Specificity · Redundancy Detection · Dependency Ordering · Past Sharpening Patterns · Strategy Completeness.  Each dimension scored, findings + suggested improvements you can Accept or Dismiss.`,
    source: 'SEM App Book, Strategy Agent + Strategy Mode',
    available: true,
  },
  'agent-incorruptible': {
    clip: `**Incorruptible** — Eric Ries 2026 Strategic Resilience Agent.  Checks your plan against Eric Ries's *Incorruptible* (2026) + LTSE Governance Principles.  Surfaces **six classes of short-term-thinking corruption**:\n\n1. **Quarterly Tyranny** — Goal-When ≤ 12 months AND no Wish-When ≥ 36 months\n2. **Stakeholder Monoculture** — shareholder primacy without multi-stakeholder counterweight\n3. **Mission Drift** — no mission-lock Constraint protecting original intent\n4. **Founder-Vision Erosion** — no founder-mode unchangeable decisions\n5. **Innovation-Budget Predation** — R&D treated as residual after quarterly targets\n6. **Governance Hole** — no review cadence (who reviews what, how often, with what evidence)\n\nEach finding carries \`sourceLayer: Cited from Ries Incorruptible | Cited from LTSE Governance | Cited from Gilb Resilience\` + a Ries chapter+page citation (HoverHint chip) + a Gilb citation chip + a verify URL.  Tagline (Ries verbatim): *"Quarterly results cannot determine quality or long-term thinking."*\n\n**Architecture:** Claudian writes findings as Pl (Planguage) to disk; composable \`useIncorruptibleFindings.ts\` reactively reads → renders.  Zero in-app API calls (Claude-Code-as-AI-Layer rule).`,
    source: 'SEM App Book p.337-475 (Incorruptible Agent design log + 6 categories + Ries/LTSE/Gilb citation chips)',
    available: true,
  },
  'agent-inc-sharp': {
    clip: `**Incorruptible Sharpening** — Q&A companion to the Incorruptible Agent.  Six categories × 2 questions × 3 AI-suggested starter answers, each carrying provenance.  Probes founder-mission text, multi-year measurement design, sanding-event history, explore/exploit splits, and review cadence specifics.`,
    source: 'SEM App Book, Incorruptible Sharpening (Q&A flow)',
    available: true,
  },
  'agent-elon': {
    clip: `**Elon** — Musk's Methods Agent.  Checks your plan against Tom Gilb's *Musk's Methods* + Dove et al. *Pace-of-Innovation* paper.  Nine categories: **Pace of Innovation (DOMINANT** — Dove names it the dominant Requirement, weighted 2×), First-Principles violations, the **five-step Musk algorithm** (Question Requirements → Delete → Simplify → Accelerate → Automate), Vertical-Integration gaps, Idiot-Index blindness, Modularity, Redundancy, Jurisdiction, MBO.\n\n**⚡ Velocity Score composition:** starts at **100**; subtracts **−15 per critical**, **−6 per moderate**, **−2 per suggestion**.  Pace-of-Innovation findings count **2×** per Dove dominant-Requirement rule.  Higher = more Musk-aligned.\n\nEvery finding cites two sources: **Gilb (Musk's Methods)** with page (e.g. p.27 modularity · p.46 dynamic design to cost · p.66 redundancy/jurisdiction · p.73 Cape Kennedy+Texas · p.99 safety as #1 requirement) AND **Dove et al. *Innovation Engineering at Tesla*** with page (e.g. p.5 modular architectures · p.6 60 part changes/day).  Findings produce concrete suggested fixes (Accept-Fix pipeline) with full Planguage entries — Scale + Meter + Tolerable + Goal + Wish.`,
    source: 'SEM App Book p.548 (Velocity Score composition + 9 categories + citation pages)',
    available: true,
  },
  'agent-elon-sharp': {
    clip: `**Elon Sharpening** — Q&A companion to the Elon Agent.  Nine categories × 2 questions × 3 AI-suggested starter answers.  Pace-of-Innovation goes first (DOMINANT per Dove et al.); other categories follow Musk's 5-step algorithm + supporting practices.`,
    source: 'SEM App Book, Elon Sharpening (Q&A flow)',
    available: true,
  },
  'agent-auto-dbo': {
    clip: `**Auto-DBO** — Design BY Objectives.  Explore Solution alternatives as versioned spec snapshots.  Edit any version speculatively (without affecting master), sharpen each with 9 design dimensions, compare via IET matrix, approve the winner to master.\n\n**Origin (Fall 1978):** PhD student **Lech Krzanik** knocked on Tom Gilb's door having read *Software Metrics* (1976).  Tom asked him to program a tool based on Planguage — then called Design By Objectives.  They built the **Aspect Engine** on an **Apple II in Forth**.  Idea: allow **"garbage in"** ("we want exceptional usability") → translate to a quantified Planguage requirement (Scale + Goal level) → search for designs meeting multiple levels.  It worked perfectly in principle but lacked the missing piece: **a digital design library with quantified attributes**.\n\n**The 48-year wait (1978-2026):** the LLM solved the design-library bottleneck.  The internet trained into the model IS the multi-attribute design database they didn't have.  Auto-DBO completes the circuit half a century later.`,
    source: 'SEM App Book p.1689 + p.8296 (Krzanik 1978 origin + Apple II + Aspect Engine lineage)',
    available: true,
  },
}

/** Lookup a demo's content by id (safe — returns null if not found). */
export function getDemoContent(id: string): DemoContent | null {
  return (DEMO_REGISTRY as Record<string, DemoContent>)[id] ?? null
}
