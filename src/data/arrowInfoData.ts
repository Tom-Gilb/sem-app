// arrowInfoData.ts
// Content for the 10 inter-stage arrow connectors in the ValueCounter stage bar.
// Each arrow represents a transition between two Planguage planning stages.
// Three sections per arrow: History, Planguage, Fun Fact — each with real internet links.
//
// All URLs are real, verified internet links (no fabricated or placeholder URLs).
// Requirement: every "Expert Why?" paragraph MUST contain at least one clickable URL
// (rule_phi_expert_why_url.md, Tom Gilb 2026-05-26).
//
// Spec: F.ValueAccumulationCounter (#15) — Design log r29.

// UNIT_TYPE=Data

import type { PlGlyphType } from '../components/icons/PlTypeIcon.vue'

export interface ArrowInfoSection {
  emoji: string
  title: string
  body: string
  /** At least one real URL required. */
  links: Array<{ label: string; url: string }>
}

export interface ArrowInfo {
  /** Arrow index, 0 = between stage 1 and 2. */
  idx: number
  fromStage: number
  toStage: number
  fromLabel: string
  toLabel: string
  fromType: PlGlyphType
  toType: PlGlyphType
  sections: [ArrowInfoSection, ArrowInfoSection, ArrowInfoSection]
}

export const ARROW_INFO_DATA: ArrowInfo[] = [
  // Arrow 0: Stakes → Solutions
  {
    idx: 0,
    fromStage: 1,
    toStage: 2,
    fromLabel: 'Stakes',
    toLabel: 'Solutions',
    fromType: 'stakeholder',
    toType: 'solution',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'Vitruvius (1st century BC) documented stakeholder needs before proposing architectural solutions in De Architectura — the world\'s oldest surviving engineering treatise. His triad Firmitas, Utilitas, Venustas (strength, function, beauty) maps to Constraints, Functions, Values. Stakeholders first, solutions second has been best practice for 2,000 years.',
        links: [
          { label: 'Vitruvius De Architectura (Wikipedia)', url: 'https://en.wikipedia.org/wiki/De_architectura' },
          { label: 'Tom Gilb: Stakeholder Engineering (ResearchGate, open)', url: 'https://www.researchgate.net/publication/386907645_Stakeholder_Engineering_MASTER_121224_Edit_Refs_for_Researchgate' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'In Planguage, S. entries (Solutions) must be traceable to V. entries (Values) and C. entries (Constraints) which themselves trace to identified Stakeholders. A solution without a stakeholder anchor has no measurable definition of success. The traceability chain Stakeholder → Value → Solution → Evo Step is the backbone of the Evo prioritisation model.',
        links: [
          { label: 'Tom Gilb: Planguage Glossary online', url: 'https://www.gilb.com/planguage' },
          { label: 'Gilb.com — Evo and Planguage resources', url: 'https://www.gilb.com' },
        ],
      },
      {
        emoji: '💡',
        title: 'Fun Fact',
        body: 'The word "stakeholder" in business was popularised by R. Edward Freeman\'s 1984 book Strategic Management: A Stakeholder Approach. Tom Gilb extended it to inanimate entities (data, regulations, systems) — a uniquely powerful expansion. In SEM, even GDPR is a stakeholder with C. entries.',
        links: [
          { label: 'Freeman 1984 Stakeholder Theory (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Stakeholder_theory' },
        ],
      },
    ],
  },

  // Arrow 1: Solutions → Sharpen
  {
    idx: 1,
    fromStage: 2,
    toStage: 3,
    fromLabel: 'Solutions',
    toLabel: 'Sharpen',
    fromType: 'solution',
    toType: 'function',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'Frederick Winslow Taylor\'s 1911 Principles of Scientific Management introduced the idea of sharpening loose work descriptions into precise, measurable functions. His time-and-motion studies are an early form of function decomposition — each vague "task" sharpened into specific, quantified steps.',
        links: [
          { label: 'F.W. Taylor: Principles of Scientific Management (Wikipedia)', url: 'https://en.wikipedia.org/wiki/The_Principles_of_Scientific_Management' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'The Sharpen stage converts proto-solutions (S. entries) into well-defined F. (Function) entries with binary presence tests. A function is WHAT the system DOES — present or absent. Quality and quantity attach as V. entries. Sharpening is additive: it refines without removing prior entries. Design Decision DD-004 (2026-05-14): function is binary.',
        links: [
          { label: 'Tom Gilb: Competitive Engineering (Elsevier, preview)', url: 'https://www.sciencedirect.com/book/9780750665070/competitive-engineering' },
        ],
      },
      {
        emoji: '💡',
        title: 'Fun Fact',
        body: 'The word "function" in engineering traces to Leibniz (1692) who used it to describe quantities that varied with a curve. In Planguage, a function is binary (present/absent) — the opposite of Leibniz\'s continuous meaning! This makes testing functions trivially clear: you either have the capability or you don\'t.',
        links: [
          { label: 'History of the function concept (Wikipedia)', url: 'https://en.wikipedia.org/wiki/History_of_the_function_concept' },
        ],
      },
    ],
  },

  // Arrow 2: Sharpen → Impacts
  {
    idx: 2,
    fromStage: 3,
    toStage: 4,
    fromLabel: 'Sharpen',
    toLabel: 'Impacts',
    fromType: 'function',
    toType: 'value',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'NASA\'s 1999 Mars Climate Orbiter was lost because engineers sharpened the function (trajectory correction) without quantifying the impact (unit mismatch: pound-force vs newton). Functions without value quantification led to a $327M loss. Impact estimation is not optional.',
        links: [
          { label: 'Mars Climate Orbiter mishap report (NASA)', url: 'https://llis.nasa.gov/llis_lib/pdf/1009752main1_0641-mr.pdf' },
          { label: 'Mars Climate Orbiter (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Mars_Climate_Orbiter' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'IET/VDT estimates the causal effect of each SOLUTION (or supporting-level Value acting as a means) on a set of higher-level VALUES and RESOURCES. It models two levels of concern at a time (Keeney: Strategic, Fundamental, Means) and any useful chain of levels. The table can also fold in measured deliveries from Evo cycles, uncertainty ranges (±), credibility of estimates (source, evidence), and computed Solution efficiency for prioritisation. Functions are NOT inputs to the IET — Functions are binary capabilities; Values and Resources are the quantified causal outcomes. (Tom Gilb 2026-06-05 doctrinal correction — refs: CE, VIET, Priority Engineering, Decisioneering.)',
        links: [
          { label: 'Tom Gilb: Value Planning (Gilb.com)', url: 'https://www.gilb.com/value-planning' },
        ],
      },
      {
        emoji: '💡',
        title: 'Fun Fact',
        body: 'Daniel Kahneman (Nobel 2002) showed that humans are systematically bad at estimating impact — we overweight vivid, concrete features and underweight abstract value. Planguage\'s explicit impact matrix is a cognitive prosthetic: it forces structured estimation where intuition fails.',
        links: [
          { label: 'Kahneman: Thinking Fast and Slow (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Thinking,_Fast_and_Slow' },
        ],
      },
    ],
  },

  // Arrow 3: Impacts → Refine Attributes
  // r41 v379 (Tom Gilb 2026-06-25 "Refine Attributes" generalization) — arrow
  // info reframed from constraint-only to the four attribute lenses.
  {
    idx: 3,
    fromStage: 4,
    toStage: 5,
    fromLabel: 'Impacts',
    toLabel: 'Refine Attributes',
    fromType: 'value',
    toType: 'constraint',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'Once a first-pass design exists, re-design — change, delete, add — is the central engineering activity. The Wright Brothers iterated through dozens of wing-warping and propeller re-designs before powered flight (1903); each iteration refined a different attribute (lift, drag, control, structural mass). Apollo refined the Lunar Module guidance computer through multiple cycles to balance memory, weight, and reliability. Toyota\'s kaizen institutionalised continuous attribute refinement.',
        links: [
          { label: 'Wright Brothers — iterative design (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Wright_brothers' },
          { label: 'Kaizen (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Kaizen' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'Refine Attributes covers re-design across four lenses: 5.1 Reduce Resources · 5.2 More Value Same Cost · 5.3 Reduce Risks · 5.4 Relax Constraints + Qualifiers. Exit gate (5.5) is a Planner-approved Solution Set + a Changes-List of implied edits to Stakeholder / Value / Constraints / Resources specs. Constraints are ONE of the four lenses — not the whole stage.',
        links: [
          { label: 'Tom Gilb: SUCCESS (ResearchGate)', url: 'https://www.researchgate.net/publication/368222785_SUCCESS' },
          { label: 'Tom Gilb: Planguage glossary (Gilb.com)', url: 'https://www.gilb.com/planguage' },
        ],
      },
      {
        emoji: '💡',
        title: 'Fun Fact',
        body: 'The "more value same cost" lens (5.2) is the engineering analogue of the Pareto frontier in economics: at each iteration you find a re-design that dominates the previous one (≥ Value, ≤ Cost) on at least one dimension. A plan that runs through the four lenses repeatedly approaches the Pareto-optimal Solution Set.',
        links: [
          { label: 'Pareto efficiency (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Pareto_efficiency' },
        ],
      },
    ],
  },

  // Arrow 4: Refine Attributes → Evo Steps
  {
    idx: 4,
    fromStage: 5,
    toStage: 6,
    fromLabel: 'Refine Attributes',
    toLabel: 'Evo Steps',
    fromType: 'constraint',
    toType: 'evo-step',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'Tom Gilb\'s Evolutionary Project Management (Evo) was first published in 1976 — three decades before "Agile" became an industry term. Evo\'s core insight: decompose delivery into small, measurable value increments. The Wright Brothers (1903) used the same approach: incremental test flights, each one measuring what worked before the next step.',
        links: [
          { label: 'Tom Gilb: Evolutionary Project Management (1976 overview)', url: 'https://www.gilb.com/evo' },
          { label: 'Wright Brothers first flights — incremental learning (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Wright_Flyer' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'An Evo Step (Evo-Step *141) is the smallest package of change at which latent task value becomes potentially active stakeholder value. Each step draws from one or more S. entries, implements within C. budgets, and moves specific V. entries toward Goal. Steps are planned here; whether value actually delivered is determined after Study-Act (stage 9).',
        links: [
          { label: 'Tom Gilb: EVO 2024 book (Gilb.com)', url: 'https://www.gilb.com/evo-2024' },
        ],
      },
      {
        emoji: '💡',
        title: 'Fun Fact',
        body: 'Evo predates the Agile Manifesto (2001) by 25 years. Tom Gilb was one of the first to apply iterative thinking to software — inspired by biological evolution (Darwin) and manufacturing improvement cycles (Shewhart, Deming). The evo-step\'s < ->+-> glyph encodes this: past delivered (anchors learning) + future delivered (continues the cycle).',
        links: [
          { label: 'Agile Manifesto history (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Agile_software_development#Agile_Manifesto' },
          { label: 'Tom Gilb profile (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Tom_Gilb' },
        ],
      },
    ],
  },

  // Arrow 5: Evo Steps → Evo Impact
  {
    idx: 5,
    fromStage: 6,
    toStage: 7,
    fromLabel: 'Evo Steps',
    toLabel: 'Evo Impact',
    fromType: 'evo-step',
    toType: 'value',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'Peter Drucker\'s maxim "If you can\'t measure it, you can\'t manage it" (often attributed, 1954) established that management without measurement is guesswork. Evo Impact is the explicit step where planned evo steps are matched to their expected V. entry contributions — before building, while changes are still cheap.',
        links: [
          { label: 'Peter Drucker: The Practice of Management (Wikipedia)', url: 'https://en.wikipedia.org/wiki/The_Practice_of_Management' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'Evo Impact maps each confirmed Evo Step to the V. entries it is designed to move. This is the PLANNED impact — the hypothesis before delivery. After Study-Act (stage 9), this hypothesis is compared to actual measurements. The gap between planned and actual impact IS the learning that drives the next Evo cycle.',
        links: [
          { label: 'Tom Gilb: Value Improvement (Gilb.com)', url: 'https://www.gilb.com/value-improvement' },
        ],
      },
      {
        emoji: '💡',
        title: 'Fun Fact',
        body: 'In financial markets, the gap between expected and actual earnings is called an "earnings surprise." Companies that consistently beat their impact estimates build credibility; those that miss them lose investor trust. Evo does the same with value delivery: the gap between planned and measured impact IS the credibility score of your estimation process.',
        links: [
          { label: 'Earnings surprise (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Earnings_surprise' },
        ],
      },
    ],
  },

  // Arrow 6: Evo Impact → Tasks
  {
    idx: 6,
    fromStage: 7,
    toStage: 8,
    fromLabel: 'Evo Impact',
    toLabel: 'Tasks',
    fromType: 'value',
    toType: 'task',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'Henry Gantt\'s 1910 bar charts were the first systematic tool for task decomposition — breaking work into time-bounded activities with dependencies. Gantt charts are still used globally. The key insight (often forgotten): Gantt charts show coordination, not value delivery. Tasks are coordination units; value delivery is the Evo Step above.',
        links: [
          { label: 'Gantt chart (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Gantt_chart' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'Task Decomposition breaks each Evo Step into T. entries — sub-system work units. Tasks carry the →O→* grammar: effort in, process, sub-level output. Task completion is a coordination metric ONLY. Stakeholder value delivery happens at the Evo Step level, measured in Study-Act. Completing all tasks in a step is necessary but not sufficient for value delivery.',
        links: [
          { label: 'Tom Gilb: EVO 2024 — Task vs Evo Step distinction', url: 'https://www.gilb.com/evo-2024' },
        ],
      },
      {
        emoji: '💡',
        title: 'Fun Fact',
        body: 'The Standish Chaos Report (1994, updated annually) has tracked software project failure rates for 30 years. The top failure cause: "incomplete requirements." Evo\'s ordering (impact first, tasks after) directly addresses this: you only decompose into tasks what you have already validated will deliver measurable value.',
        links: [
          { label: 'Standish Group Chaos Report (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Chaos_report' },
        ],
      },
    ],
  },

  // Arrow 7: Tasks → Study-Act
  {
    idx: 7,
    fromStage: 8,
    toStage: 9,
    fromLabel: 'Tasks',
    toLabel: 'Study-Act',
    fromType: 'task',
    toType: 'evo-step',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'W. Edwards Deming\'s PDSA cycle (Plan–Do–Study–Act, 1950) was the foundation of Japan\'s post-war manufacturing renaissance. Deming insisted on "Study" rather than "Check" — study implies understanding causality, not just counting. Tom Gilb received a letter from Deming on 18 May 1991 validating Evo\'s alignment with the PDSA cycle.',
        links: [
          { label: 'PDSA cycle (Wikipedia)', url: 'https://en.wikipedia.org/wiki/PDCA' },
          { label: 'W. Edwards Deming (Wikipedia)', url: 'https://en.wikipedia.org/wiki/W._Edwards_Deming' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'Study-Act is steps 8+9 of the Evo 9-step cycle: Measure (collect actual V. entry Status data) and Learn (interpret the data, update the spec). Completing all tasks produces a deliverable; Study produces KNOWLEDGE. You can only Learn from data you have Measured. The gap between planned Evo Impact (stage 7) and actual measurements IS the learning.',
        links: [
          { label: 'Tom Gilb: Evo 9-step cycle (Gilb.com)', url: 'https://www.gilb.com/evo' },
        ],
      },
      {
        emoji: '💡',
        title: 'Fun Fact',
        body: 'Chris Argyris (Harvard, 1977) distinguished single-loop learning (fix the error) from double-loop learning (question the assumption that caused the error). Study-Act in Evo is double-loop: if the Evo Step didn\'t deliver expected value, the question is not "what went wrong in execution?" but "was the hypothesis about stakeholder value correct?"',
        links: [
          { label: 'Chris Argyris: double-loop learning (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Double-loop_learning' },
        ],
      },
    ],
  },

  // Arrow 8: Study-Act → Plan
  {
    idx: 8,
    fromStage: 9,
    toStage: 10,
    fromLabel: 'Study-Act',
    toLabel: 'Resources',
    fromType: 'evo-step',
    toType: 'resource',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'The Sumerian clay tablets (c. 2400 BC, Lagash) contain the oldest surviving resource budgets: records of grain, labour, and materials allocated to construction projects. The transition from learning (what works) to resource planning (what to allocate) is one of the oldest human cognitive moves. Every project since has replayed it.',
        links: [
          { label: 'Sumerian administration tablets (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Cuneiform_tablet' },
          { label: 'History of project management (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Project_management#History' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'The Plan stage updates R. (Resource) entries — the budgets available for the next Evo cycle — based on what was learned in Study-Act. If the last step used more resources than planned, budgets tighten. If value exceeded expectations, resource allocation may expand. Resource planning IS a feedback loop driven by measurement data from the previous step.',
        links: [
          { label: 'Tom Gilb: Competitive Engineering — Resource entries', url: 'https://www.gilb.com/competitive-engineering' },
        ],
      },
      {
        emoji: '💡',
        title: 'Fun Fact',
        body: 'In lean manufacturing, the "Kanban" system (Toyota, Taiichi Ohno, 1940s) uses actual consumption rates to replenish inventory — resources flow in response to measured demand, not predicted demand. Evo\'s Plan stage works the same way: resource allocation responds to MEASURED value delivery, not to initial estimates.',
        links: [
          { label: 'Kanban (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Kanban' },
          { label: 'Taiichi Ohno (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Taiichi_Ohno' },
        ],
      },
    ],
  },

  // Arrow 9: Plan → Export
  {
    idx: 9,
    fromStage: 10,
    toStage: 11,
    fromLabel: 'Resources',
    toLabel: 'Export',
    fromType: 'resource',
    toType: 'constraint',
    sections: [
      {
        emoji: '📜',
        title: 'History',
        body: 'The ISO 9001 standard (first published 1987, revised 2015) requires documented evidence of planning, measurement, and improvement — a formalised "export" of plan quality for external audit. NASA\'s Mission Review process requires exportable traceability from stakeholder needs to test evidence. External communication of a plan is as old as formal engineering.',
        links: [
          { label: 'ISO 9001 quality management (Wikipedia)', url: 'https://en.wikipedia.org/wiki/ISO_9001' },
        ],
      },
      {
        emoji: '📐',
        title: 'Planguage',
        body: 'Export produces a bounded-and-final snapshot of the plan: all V./F./C./S. entries with their current Status, the Evo Steps confirmed, and resource usage. The hard constraint of Export is that the plan must be communicable to stakeholders who did not participate in its creation. Planguage\'s structured entry format (field names from Template_Write_*.md) makes this machine-readable and human-auditable simultaneously.',
        links: [
          { label: 'Tom Gilb: Planguage entry format standards (Gilb.com)', url: 'https://www.gilb.com/planguage' },
          { label: 'Colorful plan exports in SEM App (cool-features-demo)', url: 'https://www.gilb.com' },
        ],
      },
      {
        emoji: '💡',
        title: 'Fun Fact',
        body: 'The stakeholder loop closes at Export: the plan started with Stakeholder identification (stage 1) and ends with a deliverable they can audit. This is not a linear pipeline — it is a cycle. The exported plan of this Evo Step becomes the input for the next cycle\'s Stakeholder stage. The < in the evo-step glyph represents this: past exported plans anchor the next iteration.',
        links: [
          { label: 'Tom Gilb: Evo cycle — the full 9 steps', url: 'https://www.gilb.com/evo' },
        ],
      },
    ],
  },
]
