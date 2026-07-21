// UNIT_TYPE=Composable
// useElonSharpSynthesis.ts — Synthesise ElonFinding-shaped fixes from answered
// Sharpening questions. Phase 2a: deterministic template-based synthesis.
//
// The synthesis output reuses the existing ElonFinding shape so applyElonFix all works
// unchanged. Mirrors the Incorruptible sharpening synthesis pattern exactly.

import type {
  ElonFinding,
  ElonCategory,
} from '../types/elon'
import type { ElonSharpCategory } from '../data/elonSharpInterview'
import type { SpecBlock } from '../types/spec'

/** One answered question — text answer + selected suggestion indexes. */
export interface AnsweredQuestion {
  categoryId: ElonCategory
  questionId: string
  category: ElonSharpCategory
  answer: string
  selectedSuggestionIndexes: number[]
}

type ElonFixType =
  | 'add-cycle-time-goal' | 'name-requirement-asker' | 'mark-for-deletion'
  | 'defer-optimization' | 'add-vertical-integration' | 'add-idiot-index-tracker'
  | 'raise-iteration-cadence' | 'add-constraint'
  | 'add-jurisdiction-redundancy' | 'add-learning-loop' | 'add-safety-goal'
  | 'add-innovation-goal' | 'add-incremental-improvement' | 'add-reusability-goal'
  | 'add-modularization-goal' | 'add-management-automation'
  | 'add-testing-automation' | 'add-governance-clarity'

/**
 * Map each category to its canonical fix-type so the synthesised finding routes through
 * the existing applyElonFix machinery with full source-stamping.
 */
const CATEGORY_FIX_TYPE: Record<ElonCategory, ElonFixType> = {
  'pace-of-innovation':       'add-cycle-time-goal',
  'innovation':               'add-innovation-goal',
  'incremental-improvement':  'add-incremental-improvement',
  'pace-of-learning':         'add-learning-loop',
  'safety':                   'add-safety-goal',
  'destiny-control':          'add-vertical-integration',
  'reusability':              'add-reusability-goal',
  'modularization':           'add-modularization-goal',
  'management-automatedness': 'add-management-automation',
  'testing-automation':       'add-testing-automation',
  'governance':               'add-governance-clarity',
}

/** Per-category principle label inscribed into the synthesised finding. */
const CATEGORY_PRINCIPLE: Record<ElonCategory, string> = {
  'pace-of-innovation':       'Pace of Innovation as DOMINANT Requirement (user-sharpened) — Dove et al. p. 8',
  'innovation':               'Innovation as central driving objective (user-sharpened) — Dove p. 8 + Musk Master Plan',
  'incremental-improvement':  'Continuous incremental refinement (user-sharpened) — Gilb Evo + Tesla 27/wk',
  'pace-of-learning':         'Feedback → spec change velocity (user-sharpened) — Dove DSM p. 6-7',
  'safety':                   'Safety as #1 design requirement (user-sharpened) — Musk\'s Methods p. 99',
  'destiny-control':          'Supplier + jurisdiction redundancy (user-sharpened) — Musk\'s Methods p. 66',
  'reusability':              'Components shared across products (user-sharpened) — Musk\'s Methods p. 98',
  'modularization':           'Adaptable Modular Architectures (user-sharpened) — Dove p. 5',
  'management-automatedness': 'Routine decisions automated (user-sharpened) — Dove p. 6-7',
  'testing-automation':       'Automated test coverage + cycle time (user-sharpened) — Musk Step 5',
  'governance':               'Decision rights + named askers (user-sharpened) — Musk\'s Methods p. 106',
}

// ════════════════════════════════════════════════════════════════════════════
// MUSK_PASSAGES + DOVE_PASSAGES — verbatim ground-truth quotes for LLM synthesis
// ════════════════════════════════════════════════════════════════════════════
//
// Source files:
//   /tmp/musk-methods.txt — Tom Gilb, Musk's Methods MASTER, version 13 April 2026, 166 pp
//   /tmp/dove-pace.txt    — Dove et al., Innovation Engineering at Tesla: Agility as a
//                            Cultural Practice (single paper, 10 pp)
//
// Every passage is a literal quote from the source, with sourceCitation locating it in
// the book / paper, and mappedCategories listing the ElonCategories the passage grounds.
// The LLM synthesis prompt (future Phase 2c) feeds these passages as ground truth.

export interface ElonSourcePassage {
  id: string
  sourceBook: 'Musk\'s Methods' | 'Dove et al. — Innovation Engineering at Tesla'
  sourceCitation: string
  verbatimQuote: string
  mappedCategories: ElonCategory[]
}

export const DOVE_PASSAGES: readonly ElonSourcePassage[] = Object.freeze([
  {
    id: 'dove-pace-dominant',
    sourceBook: 'Dove et al. — Innovation Engineering at Tesla',
    sourceCitation: 'p. 8 (Justice 2022a)',
    verbatimQuote:
      '"Pace of innovation is the only thing that matters – not cost per unit, not management ' +
      'efficiency, no other metric is above pace of innovation."',
    mappedCategories: ['pace-of-innovation'],
  },
  {
    id: 'dove-speed-of-innovation-long-run',
    sourceBook: 'Dove et al. — Innovation Engineering at Tesla',
    sourceCitation: 'p. 8 (Justice 2021d, 12:38)',
    verbatimQuote:
      '"according to Tesla, speed of innovation is the only thing that matters in the long run."',
    mappedCategories: ['pace-of-innovation', 'innovation'],
  },
  {
    id: 'dove-innovation-as-objective',
    sourceBook: 'Dove et al. — Innovation Engineering at Tesla',
    sourceCitation: 'p. 8',
    verbatimQuote:
      '"At Tesla, though, agile engineering isn\'t recognized and doesn\'t appear as a formal ' +
      'objective; the driving objective (so to speak) is innovation. Agility appears as an ' +
      'emergent characteristic from a pursuit of innovation engineering."',
    mappedCategories: ['innovation'],
  },
  {
    id: 'dove-modular-dominant',
    sourceBook: 'Dove et al. — Innovation Engineering at Tesla',
    sourceCitation: 'p. 5 ("Adaptable Modular Architectures")',
    verbatimQuote:
      '"Tesla uses modular architectures that are adaptable with interconnect specifications for ' +
      'everything: product, process, facility, production, tooling, and people. Interconnect specs ' +
      'evolve asynchronously with backward compatible adaptors. Adaptable modular architectures ' +
      'appear to be a dominant mental pattern for all types of systems at Tesla (Flyvbjerg & ' +
      'Gardner 2023 p. 169)."',
    mappedCategories: ['modularization'],
  },
  {
    id: 'dove-60-changes-per-day',
    sourceBook: 'Dove et al. — Innovation Engineering at Tesla',
    sourceCitation: 'p. 6 (Justice 2022)',
    verbatimQuote:
      '"Indicative of their pace of constant improvement, Tesla was making an average of 60 part ' +
      'changes (not a fixed number) a day in the 2021/22 timeframe."',
    mappedCategories: ['incremental-improvement', 'pace-of-innovation'],
  },
  {
    id: 'dove-safety-iteration-speed',
    sourceBook: 'Dove et al. — Innovation Engineering at Tesla',
    sourceCitation: 'p. 6',
    verbatimQuote:
      '"Speed of safety certification dictates iteration speed, so every car drives itself through ' +
      'an in-factory certification test and registers that result with the NHTSA (National Highway ' +
      'Traffic Safety Administration)."',
    mappedCategories: ['safety', 'testing-automation'],
  },
  {
    id: 'dove-feedback-learning',
    sourceBook: 'Dove et al. — Innovation Engineering at Tesla',
    sourceCitation: 'p. 5-6 (Justice 2021d)',
    verbatimQuote:
      '"The building is a repeating set of modular structures. It\'s modular architecture. ... ' +
      'They learn as they go as long as it\'s compatible with the other modules, as long as the ' +
      'connection points stay the same. … They get feedback. They get learning."',
    mappedCategories: ['pace-of-learning', 'modularization'],
  },
  {
    id: 'dove-dsm-no-managers',
    sourceBook: 'Dove et al. — Innovation Engineering at Tesla',
    sourceCitation: 'p. 6-7 (Justice 2023b)',
    verbatimQuote:
      '"Digital Self Management (DSM) means saying \'why would we ever ask a human to decide ' +
      'this?!\' ... Replacing human decision points with apps is the digital backbone of a modern ' +
      'company and fundamentally determines the speed of product development and response." ... ' +
      '"There are no bosses, your manager is data. Any approval that waits for a manager is ' +
      'automated by software."',
    mappedCategories: ['management-automatedness', 'governance'],
  },
  {
    id: 'dove-autobidder-supply',
    sourceBook: 'Dove et al. — Innovation Engineering at Tesla',
    sourceCitation: 'p. 6',
    verbatimQuote:
      '"Tesla-developed software referred to as Autobidder does mass polls on demand to find ' +
      'suppliers with prices, capabilities, and track records if supply reliability becomes an issue."',
    mappedCategories: ['destiny-control'],
  },
  {
    id: 'dove-common-mission-handbook',
    sourceBook: 'Dove et al. — Innovation Engineering at Tesla',
    sourceCitation: 'p. 7 ("Common-Mission Teaming")',
    verbatimQuote:
      '"The 3.5-page employee handbook establishes guardrails and behavior expectations for ' +
      'collaborative opt-in teaming. ... everyone works on the same thing at the same time in the ' +
      'same space, with rotating roles of builders and advisors."',
    mappedCategories: ['governance'],
  },
])

export const MUSK_PASSAGES: readonly ElonSourcePassage[] = Object.freeze([
  {
    id: 'musk-5-step-algorithm',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 2 (5-Step Algorithm)',
    verbatimQuote:
      '"1. Make the requirements less dumb. … 2. Try very hard to delete the part or process. If ' +
      'parts are not being added back into the design at least 10% of the time, not enough parts ' +
      'are being deleted. … each required part and process must come from a name, not a department. ' +
      '… 3. Simplify and optimize the design. … 4. Accelerate cycle time. … 5. Automate."',
    mappedCategories: ['governance', 'testing-automation', 'incremental-improvement'],
  },
  {
    id: 'musk-pace-equation',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 72 (Lex Fridman interview)',
    verbatimQuote:
      '"What matters is the pace of innovation, access to resources, and raw materials."',
    mappedCategories: ['pace-of-innovation', 'innovation'],
  },
  {
    id: 'musk-modularity-stable-interfaces',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 27-28 ("Modularity and Stable Interfaces")',
    verbatimQuote:
      '"If you have stable component interfaces you can radically improve your component models ' +
      'continuously. … If you have a high production rate, you have a high iteration rate. For ' +
      'pretty much any technology whatsoever, the progress is a function of how many iterations ' +
      'do you have, and how much progress do you make between each iteration."',
    mappedCategories: ['modularization', 'incremental-improvement'],
  },
  {
    id: 'musk-plug-and-play-modules',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 28 (Joe Justice SpaceX case)',
    verbatimQuote:
      '"Several Sprints of introducing new upgrades and features, while simplifying the interface, ' +
      'so the modules could be robustly plug-and-play disconnected, and reconnected, in less than ' +
      '5 minutes, without special tools."',
    mappedCategories: ['modularization'],
  },
  {
    id: 'musk-safety-number-one',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 99 (Tesla AI Day)',
    verbatimQuote:
      '"The number one design requirement at Tesla is safety."',
    mappedCategories: ['safety'],
  },
  {
    id: 'musk-safety-continuous-design',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 28-30 (Superior Safety)',
    verbatimQuote:
      '"Safety is consciously designed into the Tesla Cars. First by basic design, then by the ' +
      '27 weekly increments production line changes to software and hardware."',
    mappedCategories: ['safety', 'incremental-improvement'],
  },
  {
    id: 'musk-redundancy-tactic',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 66 ("Redundancy as Design Tactic to Avoid Dependencies")',
    verbatimQuote:
      '"In this case the lab redundancy (Florida Texas) permitted specialization: research in TX ' +
      'and Operations in Florida. … if FAA did not approve Texas for environmental reasons he would ' +
      'need about 6 months to move the launch operations to the Cape. … In other words redundancy ' +
      'is also a tactic to deal with geographical and regulatory problems."',
    mappedCategories: ['destiny-control'],
  },
  {
    id: 'musk-reuse-tesla-brain',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 98 ("Reuse of Tesla Car \'Brains\'")',
    verbatimQuote:
      '"Our structural foundation for the robot is in the vehicle we produce. … We want to leverage ' +
      'both the Autopilot hardware, and the software, for the humanoid platform."',
    mappedCategories: ['reusability'],
  },
  {
    id: 'musk-rocket-reusability',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 67 (Capital Efficiency)',
    verbatimQuote:
      '"his unique technical achievement rocket reusability is a key enabler attribute for this … ' +
      'be 20x more productive, for its capital cost, compared to planes."',
    mappedCategories: ['reusability'],
  },
  {
    id: 'musk-mbo',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 106 ("Management By Objectives")',
    verbatimQuote:
      '"[Musk] focuses on the big picture and strategic decision-making, leaving the details to his ' +
      'talented teams. This approach, known as \'management by objectives,\' is a common strategy used ' +
      'by successful leaders across various industries. It involves setting clear goals and objectives ' +
      'for employees and empowering them to make their own decisions on how to achieve those goals."',
    mappedCategories: ['governance', 'management-automatedness'],
  },
  {
    id: 'musk-feedback-loop',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 67 (Single best piece of advice)',
    verbatimQuote:
      '"I think it\'s very important to have a feedback loop, where you\'re constantly thinking about ' +
      'what you\'ve done and how you could be doing it better. I think that\'s the single best piece ' +
      'of advice: constantly think about how you could be doing things better and questioning yourself."',
    mappedCategories: ['pace-of-learning', 'incremental-improvement'],
  },
  {
    id: 'musk-test-automation',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 99-100 (Testing car-driving software)',
    verbatimQuote:
      '"11 Levels of filters before customer release" — automated test pipeline that allows shipping ' +
      'self-driving software updates continuously.',
    mappedCategories: ['testing-automation'],
  },
  {
    id: 'musk-direct-communication',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 73 (Communication and Meeting Rules)',
    verbatimQuote:
      '"If in order to get something done between departments, an individual contributor has to ' +
      'talk to their manager, who talks to a director, who talks to a VP, who talks to another VP, ' +
      'who talks to a director, who talks to a manager, who talks to someone doing the actual work, ' +
      'then super dumb things will happen."',
    mappedCategories: ['governance', 'management-automatedness'],
  },
  {
    id: 'musk-design-to-cost-incremental',
    sourceBook: 'Musk\'s Methods',
    sourceCitation: 'p. 46 (Design to Cost)',
    verbatimQuote:
      '"Dynamic Design to Cost, where we chip away incrementally at costs, in a series of steps, ' +
      'over time. This is clearly Musk\'s Method. He is very conscious of it. He uses every ' +
      'incremental cycle, for example a week of Tesla production, or a cycle of SpaceX liftoffs, to ' +
      'motivate and support his teams, to both improve qualities, like Safety, and at the same time ' +
      '— reduce costs."',
    mappedCategories: ['incremental-improvement', 'safety'],
  },
])

/** Convenience accessor — returns all passages mapped to a given category. */
export function passagesForCategory(c: ElonCategory): readonly ElonSourcePassage[] {
  const out: ElonSourcePassage[] = []
  for (const p of [...MUSK_PASSAGES, ...DOVE_PASSAGES]) {
    if (p.mappedCategories.includes(c)) out.push(p)
  }
  return Object.freeze(out)
}

function stableSynthId(categoryId: ElonCategory, questionId: string): string {
  return `elon-sharp|${categoryId}|${questionId}`
}

/**
 * Pick a valid target item id for fix types that need a specific entry.
 */
function resolveTargetForFix(
  fixType: ElonFixType,
  spec: SpecBlock | null,
): { resolvedFixType: ElonFixType; targetItemId: string } {
  switch (fixType) {
    case 'add-cycle-time-goal':
    case 'add-idiot-index-tracker':
    case 'add-innovation-goal':
    case 'add-incremental-improvement':
    case 'add-learning-loop':
    case 'add-safety-goal':
    case 'add-reusability-goal':
    case 'add-modularization-goal':
    case 'add-management-automation':
    case 'add-testing-automation':
    case 'add-governance-clarity':
    case 'add-jurisdiction-redundancy':
      return { resolvedFixType: fixType, targetItemId: 'plan-level' }

    case 'add-vertical-integration': {
      const r = (spec?.resources ?? [])[0]
      return { resolvedFixType: fixType, targetItemId: r?.id ?? 'plan-level' }
    }

    case 'name-requirement-asker': {
      const c = (spec?.constraints ?? [])[0]
      if (c) return { resolvedFixType: fixType, targetItemId: c.id }
      const v = (spec?.values ?? [])[0]
      if (v) return { resolvedFixType: fixType, targetItemId: v.id }
      return { resolvedFixType: 'add-constraint', targetItemId: 'plan-level' }
    }

    case 'mark-for-deletion':
    case 'defer-optimization': {
      const s = (spec?.solutions ?? [])[0]
      if (s) return { resolvedFixType: fixType, targetItemId: s.id }
      const f = (spec?.functions ?? [])[0]
      if (f) return { resolvedFixType: fixType, targetItemId: f.id }
      return { resolvedFixType: 'add-constraint', targetItemId: 'plan-level' }
    }

    case 'raise-iteration-cadence': {
      const v = (spec?.values ?? []).find(vv => {
        const tag = `${vv.id} ${vv.scale ?? ''} ${vv.description ?? ''}`.toLowerCase()
        return tag.includes('cycle') || tag.includes('pace') || tag.includes('release')
      })
      if (v) return { resolvedFixType: fixType, targetItemId: v.id }
      return { resolvedFixType: 'add-cycle-time-goal', targetItemId: 'plan-level' }
    }

    case 'add-constraint':
      return { resolvedFixType: fixType, targetItemId: 'plan-level' }
  }
}

/**
 * Convert one answered question into one ElonFinding. The finding's suggestedFix
 * carries the user-authored Planguage text in the asPlanguage field.
 */
function synthesiseFindingFromAnswer(q: AnsweredQuestion, spec: SpecBlock | null): ElonFinding | null {
  const selected = q.selectedSuggestionIndexes
    .map(i => q.category.questions.find(qq => qq.id === q.questionId)?.suggestedAnswers[i])
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
  const userText = q.answer.trim()
  if (selected.length === 0 && !userText) return null
  const asPlanguage = [userText, ...selected].filter(Boolean).join('\n\n')

  const principle    = CATEGORY_PRINCIPLE[q.categoryId]
  const baseFixType  = CATEGORY_FIX_TYPE[q.categoryId]
  const resolved     = resolveTargetForFix(baseFixType, spec)
  const questionText = q.category.questions.find(qq => qq.id === q.questionId)?.text ?? q.questionId

  // Find a passage for this category to seed muskCitation / doveCitation
  const muskPassage = MUSK_PASSAGES.find(p => p.mappedCategories.includes(q.categoryId))
  const dovePassage = DOVE_PASSAGES.find(p => p.mappedCategories.includes(q.categoryId))

  const muskCitation = muskPassage
    ? `Gilb (Musk's Methods) — ${muskPassage.sourceCitation}`
    : null
  const doveCitation = dovePassage
    ? `Dove et al. — Innovation Engineering at Tesla, ${dovePassage.sourceCitation}`
    : null

  // Pace-of-innovation findings ALWAYS critical (Tom's "DOMINANT Requirement" rule)
  // Safety findings also default to critical given irreversibility framing
  const severity =
    q.categoryId === 'pace-of-innovation' ? 'critical' :
    q.categoryId === 'safety'             ? 'critical' :
    'moderate'

  return {
    id:                stableSynthId(q.categoryId, q.questionId),
    category:          q.categoryId,
    severity,
    sourceLayer:       q.categoryId === 'pace-of-innovation' || q.categoryId === 'innovation'
                          ? 'cited-dove-pace-paper'
                          : muskCitation
                            ? 'cited-musk-methods'
                            : 'derived-from-plan',
    muskCitation,
    doveCitation,
    gilbCitation:      'Gilb Sharp Interview pattern + Conjunction-of-Technologies (Musk × Dove × Gilb × user input)',
    verifyUrl:         null,
    triggeredBy:       resolved.targetItemId,
    principleViolated: principle,
    explanation:       `Sharpening question — ${questionText}\n\n${muskPassage?.verbatimQuote ?? dovePassage?.verbatimQuote ?? ''}`,
    suggestedFix: {
      type:           resolved.resolvedFixType,
      targetItemId:   resolved.targetItemId,
      asPlanguage,
      rationale:      `Synthesised from your Sharpening answer to "${questionText}". Selected ${selected.length} suggestion(s) + ${userText.length > 0 ? 'your free-text' : 'no free-text'}.${resolved.resolvedFixType !== baseFixType ? ` Fix downgraded ${baseFixType} → ${resolved.resolvedFixType} (your spec did not have a matching target).` : ''} Applies via the standard Elon Accept Fix machinery — Source stamped, Undo available.`,
    },
    longTermConsequence: `Your sharpened answer encodes context the deterministic engine cannot infer. Applying it makes the Plan more Musk-aligned against this specific failure mode${q.categoryId === 'pace-of-innovation' ? ' — and PACE compounds geometrically (Dove p. 8)' : ''}.`,
    generatedAtIso:    new Date().toISOString(),
  }
}

/**
 * Synthesise an array of ElonFindings from all answered questions.
 */
export function synthesiseElonFindings(
  answers: AnsweredQuestion[],
  spec: SpecBlock | null = null,
): ElonFinding[] {
  const out: ElonFinding[] = []
  for (const a of answers) {
    const f = synthesiseFindingFromAnswer(a, spec)
    if (f) out.push(f)
  }
  return out
}
