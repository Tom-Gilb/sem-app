// UNIT_TYPE=Composable
// useElonFindings.ts — Elon Agent finding engine (Musk's Methods + Dove Pace-of-Innovation).
//
// Tom Gilb 2026-06-13 verbatim:
//   "YES ELON IS A NEW AGENT WE CAN DEPLOY TO EVALUATE AND SHARPEN ANY PLAN: I look forward
//    to your sharpening areas, which should include: Innovation, Incremental Improvement,
//    Pace of Learning, Pace of Innovation, Safety, Destiny Control (like suppliers, alternative
//    sources, legal framework (thing Deleware/Texas), Reusability, Modularization, Management
//    Automatedness, Testing Automation, Governance"
//
// ─── Why PACE-OF-INNOVATION is the DOMINANT category ───────────────────────
//
// Dove et al. — *Innovation Engineering at Tesla: Agility as a Cultural Practice*, p. 8,
// citing Justice 2022a verbatim:
//
//   "Pace of innovation is the only thing that matters – not cost per unit, not management
//    efficiency, no other metric is above pace of innovation."
//
// And again p. 8 (Justice 2021d 12:38): "according to Tesla, speed of innovation is the only
// thing that matters in the long run." Musk's Methods p. 72 (Lex Fridman interview): "What
// matters is the pace of innovation, access to resources, and raw materials."
//
// This thesis structurally rules the Elon agent:
//   - pace-of-innovation findings sort FIRST regardless of severity
//   - they NEVER carry severity 'suggestion' — minimum 'moderate'
//   - they weight 2× in the Velocity Score
//   - the headline always leads with pace count if any pace findings exist
//
// Architecture (Phase 1):
//   - Deterministic rule engine that scans a SpecBlock and emits ElonFinding[]
//   - Source-layer = 'derived-from-plan' for the trigger; verified citations stamped
//     in muskCitation / doveCitation when source confirmed in /tmp/musk-methods.txt or
//     /tmp/dove-pace.txt
//   - 11 detectors mirror Tom's 2026-06-13 category list verbatim
//
// Composes with:
//   - Conjunction-of-Technologies (Plan + Musk's Methods + Dove + Gilb + LLM)
//   - AI-Max (suggestions surface immediately, not waiting for user query)
//   - Claude-Code-as-AI-Layer (no embedded API; future LLM-cited findings come from Claudian)
//   - Architectural Resilience (deterministic IDs — stable across re-runs)

import { computed, ref, type Ref } from 'vue'
import type {
  SpecBlock, VEntry, REntry, FEntry, SEntry, CEntry, FieldSource,
} from '../types/spec'
import type {
  ElonFinding,
  ElonReport,
  ElonCategory,
  ElonSeverity,
} from '../types/elon'

/** Default "fast cycle time" threshold in days — anything slower flags pace-of-innovation. */
const FAST_CYCLE_DAYS_THRESHOLD = 90  // a quarter is the slowest acceptable iteration

/** Keywords that suggest the plan touches life-safety / high-irreversibility domains.
 *  When present, safety-category findings escalate to CRITICAL automatically. */
const SAFETY_CRITICAL_DOMAIN_KEYWORDS = [
  'vehicle', 'car', 'driving', 'medical', 'patient', 'health',
  'machinery', 'machine', 'industrial', 'aircraft', 'rocket',
  'human', 'lives', 'life-critical', 'safety-critical',
  'financial', 'banking', 'payment', 'transaction',
]

/** Keywords identifying critical-path external dependencies (destiny-control). */
const EXTERNAL_DEPENDENCY_KEYWORDS = [
  'supplier', 'vendor', 'third-party', 'third party', 'outsourced',
  'contractor', 'external', 'licensed', 'aws', 'gcp', 'azure',
]

/** Jurisdictions named explicitly in the plan signal awareness of destiny-control.
 *  Their ABSENCE in any C. or R. entry is a moderate finding. */
const JURISDICTION_KEYWORDS = [
  'delaware', 'texas', 'florida', 'california', 'ireland', 'singapore',
  'eu', 'european union', 'gdpr', 'jurisdiction', 'incorporated',
]

/** Keywords showing modular / interface awareness (modularization). */
const MODULARIZATION_KEYWORDS = [
  'modular', 'module', 'interface', 'plug-and-play', 'plug and play',
  'swappable', 'pluggable', 'decoupled',
]

/** Keywords showing reusability awareness. */
const REUSABILITY_KEYWORDS = [
  'reuse', 'reusable', 'reusability', 'shared component', 'common platform',
  'leverage existing', 'same brain',
]

/** Keywords showing innovation cadence awareness (genuinely new vs incremental). */
const INNOVATION_KEYWORDS = [
  'innovation', 'novel', 'new capability', 'breakthrough', 'transformational',
  'first-of-kind', 'first of kind', 'never before',
]

/** Keywords showing pace-of-learning instrumentation. */
const LEARNING_LOOP_KEYWORDS = [
  'feedback loop', 'learning loop', 'instrumented', 'telemetry',
  'dsm', 'digital self-management', 'observation', 'a/b test',
]

/** Keywords showing management automation. */
const MGMT_AUTOMATION_KEYWORDS = [
  'manager is data', 'automated approval', 'no human approver',
  'self-serve approval', 'rule-based decision', 'policy-as-code',
]

/** Keywords showing testing automation. */
const TESTING_AUTOMATION_KEYWORDS = [
  'automated test', 'ci', 'continuous integration', 'regression test',
  'self-certify', 'self-cert', 'in-factory cert', 'auto cert',
]

/** Keywords showing governance / decision rights. */
const GOVERNANCE_KEYWORDS = [
  'charter', 'decision rights', 'accountable', 'mbo',
  'management by objective', 'governance', 'okr', 'ownership',
]

/**
 * Deterministic ID — stable tuple across re-runs of the same logical inputs.
 * Pattern: elon|<category>|<triggeredBy>|<principle>
 */
function stableFindingId(
  category: ElonCategory,
  triggeredBy: string,
  principleKey: string,
): string {
  return `elon|${category}|${triggeredBy}|${principleKey}`
}

/**
 * Parse a "Goal-When" / "Wish-When" string into approximate days-from-now.
 * Pace-of-Innovation cares about days, not months — short cycles matter.
 */
function whenInDaysFromNow(whenStr: string | undefined): number | null {
  if (!whenStr) return null
  const s = whenStr.trim()
  if (!s) return null

  const isoMatch = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (isoMatch) {
    const year  = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const day   = isoMatch[3] ? parseInt(isoMatch[3], 10) : 1
    const target = new Date(year, month - 1, day)
    const now    = new Date()
    return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  const qMatch = s.match(/^(\d{4})-?Q([1-4])$/i)
  if (qMatch) {
    const year    = parseInt(qMatch[1], 10)
    const quarter = parseInt(qMatch[2], 10)
    const month   = (quarter - 1) * 3
    const target  = new Date(year, month, 1)
    const now     = new Date()
    return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  return null
}

/** Parse a numeric Goal / Wish string. Strips currency / formatting. */
function parseNumericLevel(s: string | undefined): number | null {
  if (!s) return null
  const cleaned = s.replace(/[^0-9.\-eE]/g, '')
  if (!cleaned) return null
  const n = parseFloat(cleaned)
  return isFinite(n) ? n : null
}

/** Does any string in the haystack contain any of the given keywords? */
function containsAnyKeyword(haystack: string, keywords: string[]): boolean {
  const lower = haystack.toLowerCase()
  return keywords.some(k => lower.includes(k))
}

/** Concatenate every readable field of a spec into one searchable corpus. */
function specCorpus(spec: SpecBlock): string {
  const out: string[] = []
  for (const v of spec.values ?? [])      out.push(v.id, v.description ?? '', v.scale ?? '', v.rationale ?? '')
  for (const f of spec.functions ?? [])   out.push(f.id, f.description ?? '', f.rationale ?? '')
  for (const s of spec.solutions ?? [])   out.push(s.id, s.description ?? '', s.rationale ?? '')
  for (const c of spec.constraints ?? []) out.push(c.id, c.description ?? '', c.rationale ?? '')
  for (const r of spec.resources ?? [])   out.push(r.id, r.description ?? '', (r as REntry).rationale ?? '')
  return out.join(' ').toLowerCase()
}

// ════════════════════════════════════════════════════════════════════════════
// CATEGORY DETECTORS — one per Tom's 11 categories (2026-06-13)
// ════════════════════════════════════════════════════════════════════════════

// ─── 1. Pace of Innovation (DOMINANT) ───────────────────────────────────────

function detectPaceOfInnovation(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()
  const values = spec.values ?? []

  const paceValues = values.filter(v => {
    const scaleStr = (v.scale ?? '').toLowerCase()
    const idStr    = v.id.toLowerCase()
    const descStr  = (v.description ?? '').toLowerCase()
    return (
      scaleStr.includes('cycle') || scaleStr.includes('iteration') ||
      scaleStr.includes('release') || scaleStr.includes('cadence') ||
      scaleStr.includes('per quarter') || scaleStr.includes('per week') ||
      scaleStr.includes('per day') || scaleStr.includes('time to ship') ||
      idStr.includes('cycle') || idStr.includes('pace') || idStr.includes('velocity') ||
      descStr.includes('pace of innovation') || descStr.includes('cycle time')
    )
  })

  if (paceValues.length === 0) {
    findings.push({
      id: stableFindingId('pace-of-innovation', 'plan-level', 'no-cycle-time-value'),
      category: 'pace-of-innovation',
      severity: 'critical',
      sourceLayer: 'cited-dove-pace-paper',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 72 "What matters is the pace of innovation, access to resources, and raw materials"',
      doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 8 ("Pace of innovation is the only thing that matters – not cost per unit, not management efficiency, no other metric is above pace of innovation" – Justice 2022a)',
      gilbCitation: 'Gilb EVO 2024 ch.2 p.19 — iteration cycle as the primary delivery rhythm',
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'Pace of Innovation as dominant Requirement',
      explanation:
        'No Value entry measures cycle time, iteration cadence, or releases-per-period. ' +
        'Dove et al. (citing Justice 2022a) names Pace of Innovation the DOMINANT competitive ' +
        'Requirement — "no other metric is above pace of innovation". Without an explicit ' +
        'cycle-time Value, the plan has no rhythm target, only outcome targets. Outcome targets ' +
        'at slow cycles lose to inferior outcome targets at fast cycles.',
      suggestedFix: {
        type: 'add-cycle-time-goal',
        targetItemId: 'plan-level',
        asPlanguage:
          'V. Cycle Time\n' +
          'Description: Pace of Innovation — Dove et al. p. 8 dominant Requirement.\n' +
          'Scale: days between user-facing releases.\n' +
          'Meter: timestamp of each shipped release; rolling 90-day mean.\n' +
          'Tolerable: 30 days.\n' +
          'Goal: 14 days.\n' +
          'Wish: 1 day (continuous delivery).\n' +
          'Source: Dove et al. Innovation Engineering at Tesla, p. 8.',
        rationale:
          'Add an explicit Pace-of-Innovation Value. Once cycle time is a measured Value, every ' +
          'other Goal trade-off can be evaluated against its impact on pace. Without it, pace is ' +
          'silently sacrificed to outcome.',
      },
      longTermConsequence:
        'Without an explicit Pace-of-Innovation Value, the plan optimises quality of each release ' +
        'instead of rate of releases. Competitors who measure pace outpace you cumulatively (Tesla ' +
        'averages 60 part changes per day — Dove p. 6).',
      generatedAtIso: nowIso,
    })
  } else {
    for (const v of paceValues) {
      const goalN = parseNumericLevel(v.goal)
      void whenInDaysFromNow(v.goalWhen)
      const tooSlow = (goalN !== null && goalN >= FAST_CYCLE_DAYS_THRESHOLD)
      if (tooSlow) {
        findings.push({
          id: stableFindingId('pace-of-innovation', v.id, 'pace-too-slow'),
          category: 'pace-of-innovation',
          severity: 'moderate',
          sourceLayer: 'cited-dove-pace-paper',
          muskCitation: 'Gilb (Musk\'s Methods) — p. 28 "If you have a high production rate, you have a high iteration rate… progress is a function of how many iterations do you have"',
          doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 6 (Tesla averaged 60 part changes per day in 2021/22 — Justice 2022)',
          gilbCitation: null,
          verifyUrl: null,
          triggeredBy: v.id,
          principleViolated: 'Cycle time slower than competitive pace',
          explanation:
            `${v.id} has Goal ${v.goal} which exceeds the ${FAST_CYCLE_DAYS_THRESHOLD}-day threshold. ` +
            'Quarterly-or-slower cadence is now the floor at which industry competition operates; ' +
            'the dominant Requirement (per Dove p. 8) demands shorter.',
          suggestedFix: {
            type: 'raise-iteration-cadence',
            targetItemId: v.id,
            asPlanguage:
              `${v.id}\n` +
              'Goal: 14 days (down from current).\n' +
              'Wish: 1 day (continuous delivery).\n' +
              'Rationale: Pace-of-Innovation as dominant Requirement (Dove et al. p. 8).',
            rationale:
              'Reduce cycle-time Goal to ≤ 14 days. At this cadence, the plan can absorb 10× more ' +
              'learning per quarter — the compounding advantage Musk + Dove name explicitly.',
          },
          longTermConsequence:
            `At ${v.goal} cycle time, the plan accumulates 1/${Math.round((goalN ?? 90) / 14)}th the ` +
            'learning loops of a 14-day competitor. Pace gap compounds geometrically.',
          generatedAtIso: nowIso,
        })
      }
      if (!v.wish && !v.wishWhen) {
        findings.push({
          id: stableFindingId('pace-of-innovation', v.id, 'no-transformational-wish'),
          category: 'pace-of-innovation',
          severity: 'moderate',
          sourceLayer: 'cited-dove-pace-paper',
          muskCitation: 'Gilb (Musk\'s Methods) — p. 67 "constantly think about how you could be doing things better"',
          doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 8 (continual innovation engineering as central mission)',
          gilbCitation: 'Gilb CE — Wish is the stakeholder DREAM, independent of cost+physics',
          verifyUrl: null,
          triggeredBy: v.id,
          principleViolated: 'No transformational pace Wish',
          explanation:
            `${v.id} has a Goal but no Wish. Pace as the dominant Requirement demands a Wish that ` +
            'names the asymptote — continuous delivery, daily release, hourly hotfix.',
          suggestedFix: {
            type: 'raise-iteration-cadence',
            targetItemId: v.id,
            asPlanguage:
              `${v.id}\n` +
              'Wish: 1 day (continuous delivery — daily user-facing release).\n' +
              'Rationale: pace Wish names the long-run target; without it, current Goal becomes the ceiling.',
            rationale:
              'Add a transformational pace Wish (1 day / continuous delivery). Without it, the Goal ' +
              'becomes the planning ceiling and pace stops improving.',
          },
          longTermConsequence:
            'A pace Value without a Wish stops improving the moment Goal is hit. Continuous-delivery ' +
            'competitors keep compounding while your pace plateaus.',
          generatedAtIso: nowIso,
        })
      }
    }
  }

  return findings
}

// ─── 2. Innovation (genuinely new capability) ───────────────────────────────

function detectInnovation(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()
  const corpus = specCorpus(spec)
  const hasInnovationLanguage = containsAnyKeyword(corpus, INNOVATION_KEYWORDS)

  if (!hasInnovationLanguage && (spec.values ?? []).length > 0) {
    findings.push({
      id: stableFindingId('innovation', 'plan-level', 'no-innovation-target'),
      category: 'innovation',
      severity: 'moderate',
      sourceLayer: 'cited-dove-pace-paper',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 34 (Master Plan Part Deux) — "self-driving 10× safer than manual via massive fleet learning" as a genuinely-new capability target',
      doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 8 ("the driving objective… is innovation. Agility appears as an emergent characteristic from a pursuit of innovation engineering")',
      gilbCitation: null,
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'No explicit innovation target — only refinement targets',
      explanation:
        'No Value, Function, or Solution names a genuinely-new capability ("innovation", "novel", ' +
        '"breakthrough", "transformational"). Dove p. 8: Tesla\'s central engineering mission is ' +
        '"continual innovation engineering — and all the rest comes as pulled natural emergent ' +
        'means of the moment". If every plan entry is a refinement of yesterday, the plan ships ' +
        'a faster horse, not a car.',
      suggestedFix: {
        type: 'add-innovation-goal',
        targetItemId: 'plan-level',
        asPlanguage:
          'V. Innovation Rate\n' +
          'Description: Rate at which genuinely-new capability is brought online (not refinements of existing).\n' +
          'Scale: new-capability releases per quarter (capability the product did NOT have last quarter).\n' +
          'Meter: human-reviewed quarterly count of net-new capability flags.\n' +
          'Tolerable: 1 new capability per quarter.\n' +
          'Goal: 3 new capabilities per quarter.\n' +
          'Wish: 1 new capability per month.\n' +
          'Source: Dove et al. p. 8 — innovation as central driving objective.',
        rationale:
          'Add an explicit Innovation Value distinguishing new capability from refinement. ' +
          'Without this distinction, the plan blurs the two and ships only refinements.',
      },
      longTermConsequence:
        'Plans without an innovation target ship only refinement. The product stops surprising ' +
        'the market and competitors leapfrog with genuinely-new capability.',
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ─── 3. Incremental Improvement ─────────────────────────────────────────────

function detectIncrementalImprovement(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()

  // Look for any V. that measures improvement rate (changes per period)
  const hasIncrementalMeasure = (spec.values ?? []).some(v => {
    const tag = `${v.id} ${v.scale ?? ''} ${v.description ?? ''}`.toLowerCase()
    return tag.includes('per week') || tag.includes('per day') || tag.includes('per sprint') ||
           tag.includes('changes per') || tag.includes('improvements per')
  })

  if (!hasIncrementalMeasure && (spec.values ?? []).length > 0) {
    findings.push({
      id: stableFindingId('incremental-improvement', 'plan-level', 'no-improvement-rate'),
      category: 'incremental-improvement',
      severity: 'moderate',
      sourceLayer: 'cited-musk-methods',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 28 "Modularity and Stable Interfaces" + p. 46 "Dynamic Design to Cost — chip away incrementally at costs, in a series of steps, over time… every incremental cycle"',
      doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 6 ("Indicative of their pace of constant improvement, Tesla was making an average of 60 part changes a day" – Justice 2022)',
      gilbCitation: 'Gilb Software Metrics (1976) p. 214 — "A complex system will be most successful if it is implemented in small steps and if each step has a clear measure of successful achievement"',
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'No incremental-improvement rate Value',
      explanation:
        'No Value tracks improvements per period (Tesla averaged 60 part changes per day — Dove p. 6). ' +
        'Without a measured improvement rate, "continuous improvement" becomes a slogan, not a number. ' +
        'Gilb Evo (1976): each Evo step must have a "clear measure of successful achievement".',
      suggestedFix: {
        type: 'add-incremental-improvement',
        targetItemId: 'plan-level',
        asPlanguage:
          'V. Improvement Rate\n' +
          'Description: Measured rate of evolutionary refinement per Evo Step.\n' +
          'Scale: number of measured-impact production changes per week.\n' +
          'Meter: change-log entries tagged with quantified impact, weekly aggregate.\n' +
          'Tolerable: 1 per week.\n' +
          'Goal: 5 per week.\n' +
          'Wish: 27 per week (Tesla benchmark — Musk\'s Methods p. 46).\n' +
          'Source: Gilb Evo (1976) + Musk\'s Methods p. 46.',
        rationale:
          'Add an explicit Improvement Rate Value. Tesla\'s 27-changes-per-week benchmark gives ' +
          'a concrete Wish target; tracking improvements per period turns "continuous improvement" ' +
          'into a measurable rhythm.',
      },
      longTermConsequence:
        'Plans without measured improvement rate go slack — improvements happen when they happen ' +
        'instead of at a sustained cadence. Cumulative refinement compounds; lack of cadence does not.',
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ─── 4. Pace of Learning ────────────────────────────────────────────────────

function detectPaceOfLearning(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()
  const corpus = specCorpus(spec)
  const hasLearningLoop = containsAnyKeyword(corpus, LEARNING_LOOP_KEYWORDS)

  if (!hasLearningLoop && (spec.values ?? []).length > 0) {
    findings.push({
      id: stableFindingId('pace-of-learning', 'plan-level', 'no-learning-loop'),
      category: 'pace-of-learning',
      severity: 'moderate',
      sourceLayer: 'cited-dove-pace-paper',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 67 "the single best piece of advice: constantly think about how you could be doing things better and questioning yourself"',
      doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 6-7 (DSM — "Digital Self-Management" — "creates a real-time instant feedback loop for skill and station performance")',
      gilbCitation: 'Gilb EVO 2024 ch.2 — Learn step (step 9 of canonical 9-step Evo cycle): interpret Measured data, update spec',
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'No measured learning loop (feedback → spec change)',
      explanation:
        'No entry names a feedback loop, learning loop, telemetry, DSM, or A/B test mechanism. ' +
        'Tesla DSM (Dove p. 6-7) is the entire learning-velocity backbone — "hundreds of AI/ML ' +
        'software applications that learn, evolve, and provide data for personal decision making". ' +
        'Without instrumented learning, observations do not become spec changes; learning velocity = 0.',
      suggestedFix: {
        type: 'add-learning-loop',
        targetItemId: 'plan-level',
        asPlanguage:
          'V. Learning Cycle Time\n' +
          'Description: Days from in-production observation to a spec-change reflecting that learning.\n' +
          'Scale: days from telemetry signal to corresponding spec edit.\n' +
          'Meter: timestamp of each spec change linked to its triggering observation; rolling 30-day mean.\n' +
          'Tolerable: 14 days.\n' +
          'Goal: 3 days.\n' +
          'Wish: same-day (observation → spec change in 24 hours).\n' +
          'Source: Dove et al. p. 6-7 — DSM as instant feedback loop.',
        rationale:
          'Add a Learning Cycle Time Value. This closes the loop from observation back to spec. ' +
          'Without it, the team sees signals but does not encode them into the design.',
      },
      longTermConsequence:
        'Slow learning loops mean the spec drifts from reality. Observations accumulate as tribal ' +
        'knowledge instead of design changes; new team members inherit the gap.',
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ─── 5. Safety ──────────────────────────────────────────────────────────────

function detectSafety(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()
  const corpus = specCorpus(spec)
  const isSafetyCriticalDomain = containsAnyKeyword(corpus, SAFETY_CRITICAL_DOMAIN_KEYWORDS)
  const hasSafetyValue = (spec.values ?? []).some(v => {
    const tag = `${v.id} ${v.description ?? ''} ${v.scale ?? ''}`.toLowerCase()
    return tag.includes('safety') || tag.includes('safe') || tag.includes('fail-safe') ||
           tag.includes('safeguard') || tag.includes('blast radius')
  })

  if (!hasSafetyValue) {
    findings.push({
      id: stableFindingId('safety', 'plan-level', 'no-safety-value'),
      category: 'safety',
      severity: isSafetyCriticalDomain ? 'critical' : 'moderate',
      sourceLayer: 'cited-musk-methods',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 99 (AI Day) "The number one design requirement at Tesla is safety"; p. 28-30 "Safety is consciously designed into the Tesla Cars. First by basic design, then by the 27 weekly increments production line changes"',
      doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 6 ("Speed of safety certification dictates iteration speed, so every car drives itself through an in-factory certification test")',
      gilbCitation: 'Gilb Resilience (2023) — safety + degraded-mode behaviour as planning Aspects',
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'Safety not encoded as a measured Value',
      explanation:
        'No Value tracks safety, safeguards, fail-safe behaviour, or blast radius. ' +
        'Musk (Tesla AI Day, p. 99): "The number one design requirement at Tesla is safety." ' +
        (isSafetyCriticalDomain
          ? 'Plan keywords indicate a safety-critical domain (humans / vehicles / machinery / ' +
            'medical / financial). Without a safety Value the plan cannot trade off pace against safety ' +
            'consciously — and irreversible failures become inevitable.'
          : 'Even in non-life-critical domains, safety is the floor below which no other Value matters.'),
      suggestedFix: {
        type: 'add-safety-goal',
        targetItemId: 'plan-level',
        asPlanguage:
          'V. Safety\n' +
          'Description: Safeguarded behaviour under failure conditions — failure modes, blast radius, irreversibility.\n' +
          'Scale: incidents per million user-actions with a quantified blast-radius (users / dollars / hours-lost).\n' +
          'Meter: incident log + blast-radius dollar-equivalent, monthly aggregate.\n' +
          'Tolerable: 100 incidents per million actions.\n' +
          'Goal: 10 incidents per million actions.\n' +
          'Wish: 1 incident per million actions, all reversible within 1 minute.\n' +
          'Source: Musk\'s Methods p. 99 — "number one design requirement at Tesla is safety".',
        rationale:
          'Add a Safety Value with quantified incident rate AND blast radius. Both axes matter — ' +
          'rare-but-catastrophic and frequent-but-trivial both deserve measurement.',
      },
      longTermConsequence:
        'Plans without a safety Value silently trade safety for pace under pressure. ' +
        (isSafetyCriticalDomain
          ? 'In safety-critical domains this trade is the root cause of every recall, every regulatory action, every life lost.'
          : 'Eventually a foreseeable incident exposes the gap.'),
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ─── 6. Destiny Control ─────────────────────────────────────────────────────

function detectDestinyControl(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()

  // 6a — external-dependency Resources with no in-house alternative
  for (const r of (spec.resources ?? [])) {
    const corpus = `${r.description ?? ''} ${(r as REntry).rationale ?? ''}`
    if (containsAnyKeyword(corpus, EXTERNAL_DEPENDENCY_KEYWORDS)) {
      findings.push({
        id: stableFindingId('destiny-control', r.id, 'supplier-no-alternative'),
        category: 'destiny-control',
        severity: 'moderate',
        sourceLayer: 'cited-musk-methods',
        muskCitation: 'Gilb (Musk\'s Methods) — p. 66 "Redundancy as Design Tactic to Avoid Dependencies" ("redundancy… reduces dependencies… lab redundancy (Florida Texas) permitted specialization")',
        doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 6 (Tesla Autobidder "does mass polls on demand to find suppliers with prices, capabilities, and track records if supply reliability becomes an issue")',
        gilbCitation: 'Gilb Resilience (2023) — supply-chain robustness as a planning Aspect',
        verifyUrl: null,
        triggeredBy: r.id,
        principleViolated: 'Critical-path supplier dependency with no in-house / alternate-source alternative',
        explanation:
          `${r.id} depends on an external supplier / vendor / contractor. Musk (Tesla / SpaceX): ` +
          'critical-path components must have an in-house OR alternative-source roadmap. External-only ' +
          'dependencies cap your cycle time at the supplier\'s cadence. Destiny is delegated.',
        suggestedFix: {
          type: 'add-vertical-integration',
          targetItemId: r.id,
          asPlanguage:
            `R. ${r.id} (In-House / Alternative Source)\n` +
            `Description: in-house OR second-supplier alternative to ${r.id} — on roadmap, not yet operational.\n` +
            'Scale: months until parity with primary external supplier.\n' +
            'Goal: 12 months.\n' +
            'Rationale: destiny control on critical-path components per Musk practice (Musk\'s Methods p. 66).',
          rationale:
            'Add an in-house OR alternative-source Resource. You do not need to build immediately, ' +
            'but naming it on the roadmap makes the dependency visible + time-bounded.',
        },
        longTermConsequence:
          'External-only critical-path dependencies cap your pace at the supplier\'s pace. ' +
          'The supplier becomes your de-facto product strategy.',
        generatedAtIso: nowIso,
      })
      break
    }
  }

  // 6b — no explicit jurisdiction choice anywhere in the spec
  const corpus = specCorpus(spec)
  const namesAJurisdiction = containsAnyKeyword(corpus, JURISDICTION_KEYWORDS)
  if (!namesAJurisdiction && ((spec.constraints ?? []).length > 0 || (spec.resources ?? []).length > 0)) {
    findings.push({
      id: stableFindingId('destiny-control', 'plan-level', 'no-jurisdiction-named'),
      category: 'destiny-control',
      severity: 'moderate',
      sourceLayer: 'cited-musk-methods',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 66 "Redundancy as Design Tactic" ("lab redundancy (Florida Texas) permitted specialization… redundancy is also a tactic to deal with geographical and regulatory problems"); p. 73 (jurisdictional reality: SpaceX runs both Cape Kennedy FL and Texas)',
      doveCitation: null,
      gilbCitation: null,
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'No legal-jurisdiction choice named in the spec',
      explanation:
        'The plan does not name a legal jurisdiction (Delaware / Texas / California / EU / Singapore / etc.) ' +
        'in any Constraint or Resource. Musk\'s Methods p. 66: redundancy is "a tactic to deal with ' +
        'geographical and regulatory problems" — Tesla incorporated in Delaware then moved to Texas; ' +
        'SpaceX runs Florida AND Texas. Single-jurisdiction risk is silently inherited unless ' +
        'explicitly chosen and dual-sourced.',
      suggestedFix: {
        type: 'add-jurisdiction-redundancy',
        targetItemId: 'plan-level',
        asPlanguage:
          'C. Legal Jurisdiction\n' +
          'Description: Name the primary jurisdiction AND an explicit alternative-jurisdiction roadmap.\n' +
          'Primary: [Delaware / Texas / California / EU / your choice — name it].\n' +
          'Alternative: [name a second jurisdiction the plan can move to if the primary regulator becomes hostile].\n' +
          'Trigger to activate alternative: [regulatory change / tax change / political risk threshold].\n' +
          'Source: Musk\'s Methods p. 66 — redundancy as regulatory-risk tactic.',
        rationale:
          'Name the jurisdiction AND a fallback. Even if you never use the fallback, naming it ' +
          'forces conscious choice and surfaces the regulatory-risk axis to the planner.',
      },
      longTermConsequence:
        'Silent single-jurisdiction commitment means the local regulator becomes the de-facto ' +
        'product strategy. Tesla and SpaceX both relocated under regulatory pressure; plans without ' +
        'a named alternative have no relocation path.',
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ─── 7. Reusability ─────────────────────────────────────────────────────────

function detectReusability(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()
  const corpus = specCorpus(spec)
  const hasReusability = containsAnyKeyword(corpus, REUSABILITY_KEYWORDS)
  const hasSolutions   = (spec.solutions ?? []).length > 1

  if (!hasReusability && hasSolutions) {
    findings.push({
      id: stableFindingId('reusability', 'plan-level', 'no-reusability-target'),
      category: 'reusability',
      severity: 'moderate',
      sourceLayer: 'cited-musk-methods',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 98 "Reuse of Tesla Car \'Brains\'" ("Our structural foundation for the robot is in the vehicle we produce… leverage both the Autopilot hardware, and the software, for the humanoid platform"); p. 67 "rocket reusability is a key enabler attribute… 20x more productive, for its capital cost, compared to planes"',
      doveCitation: null,
      gilbCitation: null,
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'No reusability target — components not shared across products',
      explanation:
        'No Value, Solution, or Resource names reusability — components shared across products. ' +
        'Musk\'s Methods p. 98: Tesla\'s Optimus uses the same FSD computer hardware + software as ' +
        'the cars. SpaceX rocket reusability gave 20× capital efficiency (Musk\'s Methods p. 67). ' +
        'Reusability is the third axis of Musk\'s capital-efficiency equation.',
      suggestedFix: {
        type: 'add-reusability-goal',
        targetItemId: 'plan-level',
        asPlanguage:
          'V. Reusability\n' +
          'Description: Fraction of solutions reused across products / contexts vs built bespoke per product.\n' +
          'Scale: components shared across ≥ 2 product lines / total components.\n' +
          'Meter: component registry tagged with consuming-product list, quarterly review.\n' +
          'Tolerable: 30%.\n' +
          'Goal: 60%.\n' +
          'Wish: 80% — bespoke is the exception, not the rule.\n' +
          'Source: Musk\'s Methods p. 98 — Tesla brain reused in Optimus.',
        rationale:
          'Add a Reusability Value. Without it, teams default to bespoke builds; capital efficiency ' +
          'leaks invisibly. Tracking shared-component fraction makes leverage visible.',
      },
      longTermConsequence:
        'Plans without reusability tracking ship N bespoke implementations of the same capability. ' +
        'Maintenance cost is N×; learning gains in one product line do not propagate.',
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ─── 8. Modularization ──────────────────────────────────────────────────────

function detectModularization(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()
  const corpus = specCorpus(spec)
  const hasModularity = containsAnyKeyword(corpus, MODULARIZATION_KEYWORDS)

  if (!hasModularity && (spec.solutions ?? []).length > 1) {
    findings.push({
      id: stableFindingId('modularization', 'plan-level', 'no-modularization-target'),
      category: 'modularization',
      severity: 'moderate',
      sourceLayer: 'cited-dove-pace-paper',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 27 "Modularity and Stable Interfaces" ("If you have stable component interfaces you can radically improve your component models continuously"); p. 28 (Joe Justice SpaceX case: missile redesign for plug-and-play modules in <5 minutes without special tools)',
      doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 5 ("Tesla uses modular architectures that are adaptable with interconnect specifications for everything: product, process, facility, production, tooling, and people… a dominant mental pattern for all types of systems at Tesla")',
      gilbCitation: null,
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'No explicit modularization target',
      explanation:
        'No Value, Solution, or Constraint names modularization, module-swap, interface stability, ' +
        'or pluggability. Dove p. 5 names this "a dominant mental pattern for all types of systems at ' +
        'Tesla". Without modular architecture, every change requires touching every adjacent system, ' +
        'which caps cycle time and reusability simultaneously.',
      suggestedFix: {
        type: 'add-modularization-goal',
        targetItemId: 'plan-level',
        asPlanguage:
          'V. Modularization\n' +
          'Description: Stable-interface count + module-swap mean time.\n' +
          'Scale: documented stable interfaces with semver guarantees / total cross-module connections.\n' +
          'Meter: API-version-stability log + module-swap time-trial (mean seconds to replace one module).\n' +
          'Tolerable: 50% of connections behind stable interfaces; module-swap ≤ 1 hour.\n' +
          'Goal: 90% behind stable interfaces; module-swap ≤ 5 minutes (Tesla benchmark — Musk\'s Methods p. 28).\n' +
          'Wish: 100% behind stable interfaces; module-swap ≤ 30 seconds.\n' +
          'Source: Dove et al. p. 5 + Musk\'s Methods p. 27-28.',
        rationale:
          'Add a Modularization Value with two axes — interface stability AND swap time. ' +
          'Both are necessary for parallel evolution: stable interfaces let modules evolve independently; ' +
          'swap time defines failure-recovery and experimentation speed.',
      },
      longTermConsequence:
        'Monolithic architectures cap pace of innovation at the slowest module. Each release becomes a ' +
        'coordination event; experimentation requires shipping the whole stack. Modular competitors evolve ' +
        'each subsystem independently and outpace cumulatively.',
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ─── 9. Management Automatedness ────────────────────────────────────────────

function detectManagementAutomatedness(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()
  const corpus = specCorpus(spec)
  const hasMgmtAutomation = containsAnyKeyword(corpus, MGMT_AUTOMATION_KEYWORDS)

  // Heuristic: are there approval-related Constraints that don't mention automation?
  const manualApprovalConstraints = (spec.constraints ?? []).filter(c => {
    const corpusC = `${c.description ?? ''} ${c.rationale ?? ''}`.toLowerCase()
    return (corpusC.includes('approval') || corpusC.includes('sign-off') || corpusC.includes('signoff')) &&
           !corpusC.includes('automat') && !corpusC.includes('rule-based')
  })

  if (!hasMgmtAutomation && manualApprovalConstraints.length > 0) {
    const c = manualApprovalConstraints[0]
    findings.push({
      id: stableFindingId('management-automatedness', c.id, 'manual-approval'),
      category: 'management-automatedness',
      severity: 'moderate',
      sourceLayer: 'cited-dove-pace-paper',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 73 "If in order to get something done between departments, an individual contributor has to talk to their manager, who talks to a director, who talks to a VP… super dumb things will happen"; p. 113 "Middle managers, gone. The Mobs organize around an objective"',
      doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 6-7 ("Digital Self Management (DSM) means saying \'why would we ever ask a human to decide this?!\'… There are no bosses, your manager is data. Any approval that waits for a manager is automated by software" – Justice 2023b)',
      gilbCitation: null,
      verifyUrl: null,
      triggeredBy: c.id,
      principleViolated: 'Routine management decision waiting on human approval',
      explanation:
        `${c.id} requires manual approval / sign-off but does not mention automated routing or ` +
        'rule-based decisions. Dove p. 6-7 (Justice 2023b): "why would we ever ask a human to ' +
        'decide this?!" — at Tesla, "any approval that waits for a manager is automated by software". ' +
        'If the decision is routine, automate it; humans handle the exceptional only.',
      suggestedFix: {
        type: 'add-management-automation',
        targetItemId: c.id,
        asPlanguage:
          'V. Management Automation\n' +
          'Description: Fraction of routine management decisions automated vs handled by humans.\n' +
          'Scale: automated decisions / total decisions of this class per week.\n' +
          'Meter: decision-routing log, weekly aggregate.\n' +
          'Tolerable: 50% automated.\n' +
          'Goal: 90% automated — humans only handle exceptions.\n' +
          'Wish: 99% automated — exceptions only when the rule is itself in question.\n' +
          'Source: Dove et al. p. 6-7 — DSM as instant automated decision-making.',
        rationale:
          'Add a Management Automation Value. Without it, "approvals" silently expand back to ' +
          'human attention even after automation work. Track the fraction; defend it explicitly.',
      },
      longTermConsequence:
        'Routine decisions that wait for human approval compound into the dominant cycle-time ' +
        'bottleneck. Tesla replaced "nearly 100%" of middle management with software (Dove p. 7) — ' +
        'plans that don\'t do this carry the burden as overhead forever.',
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ─── 10. Testing Automation ─────────────────────────────────────────────────

function detectTestingAutomation(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()
  const corpus = specCorpus(spec)
  const hasTestingAutomation = containsAnyKeyword(corpus, TESTING_AUTOMATION_KEYWORDS)

  if (!hasTestingAutomation && ((spec.values ?? []).length > 0 || (spec.functions ?? []).length > 0)) {
    findings.push({
      id: stableFindingId('testing-automation', 'plan-level', 'no-testing-automation'),
      category: 'testing-automation',
      severity: 'moderate',
      sourceLayer: 'cited-musk-methods',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 2 (5-Step Algorithm, Step 5) "Automate. An important part of this is to remove in-process testing after the problems have been diagnosed; if a product is reaching the end of a production line with a high acceptance rate, there is no need for in-process testing"; p. 99-100 (Tesla 11 Levels of automated test filters before customer release)',
      doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 6 ("every car drives itself through an in-factory certification test and registers that result with the NHTSA (National Highway Traffic Safety Administration)")',
      gilbCitation: null,
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: 'No testing-automation target',
      explanation:
        'No entry names automated testing, CI, regression testing, or self-certification. Tesla cars ' +
        'self-certify against NHTSA in-factory (Dove p. 6). Musk\'s Methods p. 99-100: 11 levels of ' +
        'automated test filters before customer release. Without automated testing, every cycle-time ' +
        'reduction risks quality regression that humans cannot catch fast enough.',
      suggestedFix: {
        type: 'add-testing-automation',
        targetItemId: 'plan-level',
        asPlanguage:
          'V. Testing Automation\n' +
          'Description: Fraction of validation cycles fully automated end-to-end.\n' +
          'Scale: automated test-coverage % + automated-test mean cycle time.\n' +
          'Meter: CI report + per-release test-cycle duration.\n' +
          'Tolerable: 70% coverage; ≤ 1 hour cycle.\n' +
          'Goal: 95% coverage; ≤ 10 minutes cycle.\n' +
          'Wish: 100% coverage; ≤ 1 minute cycle (Tesla in-factory self-cert benchmark).\n' +
          'Source: Musk\'s Methods p. 2 + Dove et al. p. 6.',
        rationale:
          'Add a Testing Automation Value with two axes — coverage AND cycle time. Both are needed; ' +
          'high coverage with slow cycle time still caps pace, and fast cycle with low coverage ' +
          'shifts risk to production.',
      },
      longTermConsequence:
        'Manual testing is the silent governor on cycle time. As pace accelerates, manual testing ' +
        'either becomes the bottleneck or gets skipped — either way the plan loses (speed or quality).',
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ─── 11. Governance ─────────────────────────────────────────────────────────

function detectGovernance(spec: SpecBlock): ElonFinding[] {
  const findings: ElonFinding[] = []
  const nowIso = new Date().toISOString()
  const corpus = specCorpus(spec)
  const hasGovernance = containsAnyKeyword(corpus, GOVERNANCE_KEYWORDS)
  const hasUnnamedConstraints = (spec.constraints ?? []).some(c => {
    const corpusC = `${c.description ?? ''} ${c.rationale ?? ''}`
    return !/source\s*:|named by|requested by|asked by|owner\s*:/i.test(corpusC)
  })

  if (!hasGovernance || hasUnnamedConstraints) {
    findings.push({
      id: stableFindingId('governance', 'plan-level', 'no-governance-charter'),
      category: 'governance',
      severity: 'moderate',
      sourceLayer: 'cited-musk-methods',
      muskCitation: 'Gilb (Musk\'s Methods) — p. 106 "Management By Objectives" ("[Musk] focuses on the big picture and strategic decision-making, leaving the details to his talented teams… setting clear goals and objectives for employees and empowering them to make their own decisions"); p. 2 Step 1 "each required part and process must come from a name, not a department"',
      doveCitation: 'Dove et al. — Innovation Engineering at Tesla, p. 7 ("Common-Mission Teaming — Mission-oriented teaming opportunities… 3.5-page employee handbook establishes guardrails and behavior expectations for collaborative opt-in teaming")',
      gilbCitation: 'Gilb Stakeholder Engineering — every requirement names its source stakeholder (composes with Musk Step 1)',
      verifyUrl: null,
      triggeredBy: 'plan-level',
      principleViolated: hasUnnamedConstraints
        ? 'Constraints without named owners (governance integrity)'
        : 'No governance charter / decision-rights cadence named',
      explanation:
        hasUnnamedConstraints
          ? 'Constraints exist without named owners or askers. Governance integrity requires every ' +
            'Constraint name a specific person (Musk Step 1 + Gilb Stakeholder Engineering). Department ' +
            'names are not owners — they cannot be questioned, refined, or held accountable.'
          : 'No entry names governance, decision rights, charter, MBO, or OKRs. Musk\'s MBO ' +
            '(Musk\'s Methods p. 106): clear goals + empowered teams. Without explicit governance, ' +
            'decisions either pile up at the top OR drift without accountability.',
      suggestedFix: {
        type: 'add-governance-clarity',
        targetItemId: 'plan-level',
        asPlanguage:
          'C. Governance Charter\n' +
          'Description: Decision rights mapped to roles + accountability cadences.\n' +
          'Decision Rights: [decision class] → [role authorised to decide unilaterally] → [escalation trigger].\n' +
          'Accountability Cadence: [weekly / monthly / quarterly objective review by named role].\n' +
          'Charter Integrity: every Constraint MUST name its Source (specific person, not department).\n' +
          'Source: Musk\'s Methods p. 106 (MBO) + p. 2 (Step 1 named asker).',
        rationale:
          'Add a Governance Charter Constraint. Without it, decisions drift to whoever is loudest. ' +
          'Tesla\'s 3.5-page employee handbook (Dove p. 7) shows even minimal explicit governance ' +
          'is dramatically clarifying.',
      },
      longTermConsequence:
        'Plans without explicit governance accumulate unaccountable decisions and unowned ' +
        'constraints. Each year the plan inherits more unowned rules; eventually no one can change ' +
        'anything because no one knows what would break.',
      generatedAtIso: nowIso,
    })
  }
  return findings
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════════════

/**
 * Run all Phase-1 deterministic detectors against the supplied spec.
 * Returns a grouped ElonReport ready to render in the panel.
 */
export function generateElonReport(
  spec: SpecBlock | null | undefined,
  planTitle: string,
): ElonReport {
  const nowIso = new Date().toISOString()

  const emptyByCategory = (): Record<ElonCategory, ElonFinding[]> => ({
    'pace-of-innovation': [],
    'innovation': [],
    'incremental-improvement': [],
    'pace-of-learning': [],
    'safety': [],
    'destiny-control': [],
    'reusability': [],
    'modularization': [],
    'management-automatedness': [],
    'testing-automation': [],
    'governance': [],
  })

  if (!spec) {
    return {
      generatedAtIso: nowIso,
      planTitle,
      totalFindings: 0,
      byCategory: emptyByCategory(),
      bySeverity: { critical: 0, moderate: 0, suggestion: 0 },
      velocityScore: 0,
      headline: 'No plan loaded — Elon needs a Plan to analyse.',
    }
  }

  const allFindings: ElonFinding[] = [
    ...detectPaceOfInnovation(spec),
    ...detectInnovation(spec),
    ...detectIncrementalImprovement(spec),
    ...detectPaceOfLearning(spec),
    ...detectSafety(spec),
    ...detectDestinyControl(spec),
    ...detectReusability(spec),
    ...detectModularization(spec),
    ...detectManagementAutomatedness(spec),
    ...detectTestingAutomation(spec),
    ...detectGovernance(spec),
  ]

  const byCategory = emptyByCategory()
  for (const f of allFindings) byCategory[f.category].push(f)

  const bySeverity: Record<ElonSeverity, number> = {
    critical:   allFindings.filter(f => f.severity === 'critical').length,
    moderate:   allFindings.filter(f => f.severity === 'moderate').length,
    suggestion: allFindings.filter(f => f.severity === 'suggestion').length,
  }

  // Velocity Score: 100 - (critical × 15) - (moderate × 6) - (suggestion × 2)
  // PLUS pace-of-innovation findings weight 2× per Tom's "dominant Requirement" rule.
  let deduction = (bySeverity.critical * 15) + (bySeverity.moderate * 6) + (bySeverity.suggestion * 2)
  for (const f of byCategory['pace-of-innovation']) {
    const w = f.severity === 'critical' ? 15 : f.severity === 'moderate' ? 6 : 2
    deduction += w  // extra deduction = same weight again → effective 2× weighting
  }
  const score = Math.max(0, 100 - deduction)

  let headline: string
  const paceCount = byCategory['pace-of-innovation'].length
  if (allFindings.length === 0) {
    headline = 'ELON CLEAR — no Musk\'s-Methods violations detected. Re-run after any major Plan change.'
  } else if (paceCount > 0) {
    headline =
      `${paceCount} PACE-of-INNOVATION finding${paceCount === 1 ? '' : 's'} (DOMINANT requirement per Dove) · ` +
      `${bySeverity.critical} critical · ${bySeverity.moderate} moderate · ${bySeverity.suggestion} suggestion. ` +
      'Address Pace findings first — they compound geometrically.'
  } else if (bySeverity.critical > 0) {
    headline = `${bySeverity.critical} CRITICAL · ${bySeverity.moderate} moderate — Musk\'s Methods violations. Address critical first.`
  } else if (bySeverity.moderate > 0) {
    headline = `${bySeverity.moderate} moderate findings — Musk\'s Methods can sharpen further.`
  } else {
    headline = `${bySeverity.suggestion} suggestion(s) — Plan is Musk-aligned. Optional refinements available.`
  }

  return {
    generatedAtIso: nowIso,
    planTitle,
    totalFindings: allFindings.length,
    byCategory,
    bySeverity,
    velocityScore: score,
    headline,
  }
}

/**
 * Reactive composable wrapper — recomputes findings whenever the spec ref changes.
 */
export function useElonFindings(
  spec: Ref<SpecBlock | null | undefined>,
  planTitle: Ref<string>,
) {
  const dismissedIds = ref<Set<string>>(new Set())

  const report = computed<ElonReport>(() => {
    return generateElonReport(spec.value ?? null, planTitle.value)
  })

  const visibleFindings = computed<ElonFinding[]>(() => {
    const all: ElonFinding[] = []
    for (const cat of Object.keys(report.value.byCategory) as ElonCategory[]) {
      for (const f of report.value.byCategory[cat]) {
        if (!dismissedIds.value.has(f.id)) all.push(f)
      }
    }
    const severityOrder: Record<ElonSeverity, number> = {
      critical: 0, moderate: 1, suggestion: 2,
    }
    return all.sort((a, b) => {
      if (a.category === 'pace-of-innovation' && b.category !== 'pace-of-innovation') return -1
      if (b.category === 'pace-of-innovation' && a.category !== 'pace-of-innovation') return 1
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  })

  function dismissFinding(id: string): void {
    const next = new Set(dismissedIds.value)
    next.add(id)
    dismissedIds.value = next
  }

  function undismissFinding(id: string): void {
    const next = new Set(dismissedIds.value)
    next.delete(id)
    dismissedIds.value = next
  }

  function resetDismissals(): void {
    dismissedIds.value = new Set()
  }

  return {
    report,
    visibleFindings,
    dismissedIds,
    dismissFinding,
    undismissFinding,
    resetDismissals,
  }
}

// ─── Apply (Sharpen) ────────────────────────────────────────────────────────

function buildElonSource(principleViolated: string): FieldSource {
  return {
    source:     'Elon Agent',
    sourceType: 'ai',
    tool:       `Elon · ${principleViolated}`,
    timestamp:  new Date().toISOString(),
  }
}

function cloneSpec(spec: SpecBlock): SpecBlock {
  return JSON.parse(JSON.stringify(spec)) as SpecBlock
}

function uniqueMnemonic(base: string, existing: string[]): string {
  const cleanBase = base.replace(/[^A-Za-z0-9 ]/g, '').trim() || 'Generated'
  if (!existing.includes(cleanBase)) return cleanBase
  let n = 2
  while (existing.includes(`${cleanBase} ${n}`)) n++
  return `${cleanBase} ${n}`
}

export interface ApplyFixResult {
  newSpec: SpecBlock
  affectedItemId: string
  affectedItemType: 'value' | 'constraint' | 'stakeholder' | 'resource' | 'solution' | 'function' | 'plan-level'
  summary: string
}

/** Shared helper: create a new V. with the given fields. */
function buildValueEntry(
  next: SpecBlock,
  src: FieldSource,
  fields: {
    baseId: string; description: string; scale: string; meter: string;
    tolerable: string; goal: string; wish: string;
  },
): { id: string; entry: VEntry } {
  const existing = (next.values ?? []).map(v => v.id)
  const id = uniqueMnemonic(fields.baseId, existing)
  const entry: VEntry = {
    id,
    type:         'Value',
    level:        'Business',
    description:  fields.description,
    scale:        fields.scale,
    meter:        fields.meter,
    status:       '',
    tolerable:    fields.tolerable,
    goal:         fields.goal,
    wish:         fields.wish,
    valueOfFunction: '',
    fieldSources: { description: src, scale: src, meter: src, tolerable: src, goal: src, wish: src },
  } as VEntry
  next.values = [...((next.values ?? []) as VEntry[]), entry]
  return { id, entry }
}

/** Returns null if the fix type is not yet implementable. */
export function applyElonFix(
  finding: ElonFinding,
  spec: SpecBlock,
): ApplyFixResult | null {
  const next = cloneSpec(spec)
  const fix  = finding.suggestedFix
  const src  = buildElonSource(finding.principleViolated)

  switch (fix.type) {

    case 'add-cycle-time-goal': {
      const { id } = buildValueEntry(next, src, {
        baseId: 'Cycle Time',
        description: 'Pace of Innovation — Dove et al. p. 8 dominant Requirement. Days between user-facing releases.',
        scale: 'days between user-facing releases',
        meter: 'timestamp of each shipped release; rolling 90-day mean',
        tolerable: '30', goal: '14', wish: '1',
      })
      return {
        newSpec: next, affectedItemId: id, affectedItemType: 'value',
        summary: `Cycle Time Value added — Pace of Innovation now tracked. Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-innovation-goal': {
      const { id } = buildValueEntry(next, src, {
        baseId: 'Innovation Rate',
        description: 'Rate of genuinely-new capability brought online (not refinements of existing).',
        scale: 'new-capability releases per quarter',
        meter: 'human-reviewed quarterly count of net-new capability flags',
        tolerable: '1', goal: '3', wish: '12',
      })
      return {
        newSpec: next, affectedItemId: id, affectedItemType: 'value',
        summary: `Innovation Rate Value added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-incremental-improvement': {
      const { id } = buildValueEntry(next, src, {
        baseId: 'Improvement Rate',
        description: 'Measured rate of evolutionary refinement per Evo Step (Gilb 1976 + Tesla 27 changes/wk).',
        scale: 'measured-impact production changes per week',
        meter: 'change-log entries tagged with quantified impact, weekly aggregate',
        tolerable: '1', goal: '5', wish: '27',
      })
      return {
        newSpec: next, affectedItemId: id, affectedItemType: 'value',
        summary: `Improvement Rate Value added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-learning-loop': {
      const { id } = buildValueEntry(next, src, {
        baseId: 'Learning Cycle Time',
        description: 'Days from in-production observation to a spec-change reflecting that learning.',
        scale: 'days from telemetry signal to corresponding spec edit',
        meter: 'timestamp of each spec change linked to its triggering observation; rolling 30-day mean',
        tolerable: '14', goal: '3', wish: '1',
      })
      return {
        newSpec: next, affectedItemId: id, affectedItemType: 'value',
        summary: `Learning Cycle Time Value added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-safety-goal': {
      const { id } = buildValueEntry(next, src, {
        baseId: 'Safety',
        description: 'Safeguarded behaviour under failure conditions — failure modes, blast radius, irreversibility.',
        scale: 'incidents per million user-actions with quantified blast-radius',
        meter: 'incident log + blast-radius dollar-equivalent, monthly aggregate',
        tolerable: '100', goal: '10', wish: '1',
      })
      return {
        newSpec: next, affectedItemId: id, affectedItemType: 'value',
        summary: `Safety Value added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-reusability-goal': {
      const { id } = buildValueEntry(next, src, {
        baseId: 'Reusability',
        description: 'Fraction of solutions reused across products (Musk\'s Methods p. 98 — Tesla brain in Optimus).',
        scale: 'components shared across ≥ 2 product lines / total components',
        meter: 'component registry tagged with consuming-product list, quarterly review',
        tolerable: '30%', goal: '60%', wish: '80%',
      })
      return {
        newSpec: next, affectedItemId: id, affectedItemType: 'value',
        summary: `Reusability Value added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-modularization-goal': {
      const { id } = buildValueEntry(next, src, {
        baseId: 'Modularization',
        description: 'Stable-interface fraction + module-swap mean time (Dove p. 5 + Musk\'s Methods p. 27-28).',
        scale: 'fraction of connections behind stable interfaces; module-swap mean seconds',
        meter: 'API-version-stability log + module-swap time-trial',
        tolerable: '50%', goal: '90%', wish: '100%',
      })
      return {
        newSpec: next, affectedItemId: id, affectedItemType: 'value',
        summary: `Modularization Value added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-management-automation': {
      const { id } = buildValueEntry(next, src, {
        baseId: 'Management Automation',
        description: 'Fraction of routine management decisions automated (Dove p. 6-7 — DSM "why would we ever ask a human").',
        scale: 'automated decisions / total decisions of this class per week',
        meter: 'decision-routing log, weekly aggregate',
        tolerable: '50%', goal: '90%', wish: '99%',
      })
      return {
        newSpec: next, affectedItemId: id, affectedItemType: 'value',
        summary: `Management Automation Value added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-testing-automation': {
      const { id } = buildValueEntry(next, src, {
        baseId: 'Testing Automation',
        description: 'Automated test coverage + test cycle time (Musk\'s Methods p. 2 + Dove p. 6 NHTSA self-cert).',
        scale: 'automated-test coverage % AND automated-test mean cycle time (minutes)',
        meter: 'CI report + per-release test-cycle duration',
        tolerable: '70%', goal: '95%', wish: '100%',
      })
      return {
        newSpec: next, affectedItemId: id, affectedItemType: 'value',
        summary: `Testing Automation Value added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-governance-clarity': {
      const existing  = (next.constraints ?? []).map(c => c.id)
      const newC: CEntry = {
        id:           uniqueMnemonic('Governance Charter', existing),
        type:         'Constraint',
        level:        'Business',
        description:  'Decision rights mapped to roles + accountability cadences. Every Constraint MUST name its Source (specific person, not department).',
        scope:        'plan-level',
        rationale:    'Musk\'s Methods p. 106 (MBO) + p. 2 (Step 1 named asker) + Dove et al. p. 7 (3.5-page handbook).',
        fieldSources: { description: src, scope: src, rationale: src },
      } as CEntry
      next.constraints = [...(next.constraints ?? []), newC]
      return {
        newSpec: next, affectedItemId: newC.id, affectedItemType: 'constraint',
        summary: `Governance Charter Constraint added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-jurisdiction-redundancy': {
      const existing  = (next.constraints ?? []).map(c => c.id)
      const newC: CEntry = {
        id:           uniqueMnemonic('Legal Jurisdiction', existing),
        type:         'Constraint',
        level:        'Business',
        description:  'Primary jurisdiction + explicit alternative-jurisdiction roadmap (Delaware/Texas/Florida/EU/Singapore/etc.). Trigger to activate alternative must be named.',
        scope:        'plan-level',
        rationale:    'Musk\'s Methods p. 66 — redundancy is "a tactic to deal with geographical and regulatory problems". SpaceX runs Cape Kennedy + Texas; Tesla DE → TX.',
        fieldSources: { description: src, scope: src, rationale: src },
      } as CEntry
      next.constraints = [...(next.constraints ?? []), newC]
      return {
        newSpec: next, affectedItemId: newC.id, affectedItemType: 'constraint',
        summary: `Legal Jurisdiction Constraint added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'raise-iteration-cadence': {
      const target = (next.values ?? []).find(v => v.id === finding.triggeredBy)
      if (target) {
        target.goal = '14'
        target.wish = '1'
        target.fieldSources = { ...(target.fieldSources ?? {}), goal: src, wish: src }
        return {
          newSpec: next, affectedItemId: target.id, affectedItemType: 'value',
          summary: `Cycle-time Goal tightened to 14 days on ${target.id} — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
        }
      }
      return applyAsConstraint(next, finding, src,
        'Iteration cadence must compress over time per Pace-of-Innovation dominant Requirement (Dove et al. p. 8).')
    }

    case 'name-requirement-asker': {
      const cTarget = (next.constraints ?? []).find(c => c.id === finding.triggeredBy)
      if (cTarget) {
        cTarget.rationale = (cTarget.rationale ?? '') +
          `\n\nSource (Musk Step 1, Musk's Methods p. 2): [Name the specific person or role who requested this Constraint.] ` +
          `Stamped ${src.timestamp.slice(0, 19)}Z by Elon Agent.`
        cTarget.fieldSources = { ...(cTarget.fieldSources ?? {}), rationale: src }
        return {
          newSpec: next, affectedItemId: cTarget.id, affectedItemType: 'constraint',
          summary: `Source-asker prompt added to ${cTarget.id} — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
        }
      }
      const vTarget = (next.values ?? []).find(v => v.id === finding.triggeredBy)
      if (vTarget) {
        vTarget.fieldSources = { ...(vTarget.fieldSources ?? {}), description: src }
        return {
          newSpec: next, affectedItemId: vTarget.id, affectedItemType: 'value',
          summary: `Asker-name prompt stamped on ${vTarget.id} — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
        }
      }
      return null
    }

    case 'mark-for-deletion':
    case 'defer-optimization': {
      const sTarget = (next.solutions ?? []).find(s => s.id === finding.triggeredBy)
      if (sTarget) {
        const tagPrefix = fix.type === 'mark-for-deletion'
          ? '[DELETION-CANDIDATE · Musk Step 2 — Musk\'s Methods p. 2]'
          : '[OPTIMIZATION-HOLD · Musk Step 3 — Musk\'s Methods p. 2]'
        sTarget.description = `${tagPrefix} ${sTarget.description ?? ''}`
        sTarget.fieldSources = { ...((sTarget as SEntry).fieldSources ?? {}), description: src }
        return {
          newSpec: next, affectedItemId: sTarget.id, affectedItemType: 'solution',
          summary: `${sTarget.id} tagged ${tagPrefix} — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
        }
      }
      const fTarget = (next.functions ?? []).find(f => f.id === finding.triggeredBy)
      if (fTarget) {
        const tagPrefix = fix.type === 'mark-for-deletion'
          ? '[DELETION-CANDIDATE · Musk Step 2 — Musk\'s Methods p. 2]'
          : '[OPTIMIZATION-HOLD · Musk Step 3 — Musk\'s Methods p. 2]'
        fTarget.description = `${tagPrefix} ${fTarget.description ?? ''}`
        fTarget.fieldSources = { ...((fTarget as FEntry).fieldSources ?? {}), description: src }
        return {
          newSpec: next, affectedItemId: fTarget.id, affectedItemType: 'function',
          summary: `${fTarget.id} tagged ${tagPrefix} — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
        }
      }
      return null
    }

    case 'add-deletion-target': {
      return applyAsConstraint(next, finding, src,
        'Delete ≥ 10% of plan complexity per Musk Step 2 (Musk\'s Methods p. 2). If you\'re not adding back ≥ 10%, you didn\'t delete enough.')
    }

    case 'add-vertical-integration': {
      const existing = ((next.resources ?? []) as REntry[]).map(r => r.id)
      const newR = {
        id:           uniqueMnemonic(`${finding.triggeredBy} In-House`, existing),
        type:         'Resource',
        level:        'Business',
        description:  `In-house OR alternative-source for externally-sourced ${finding.triggeredBy}. On roadmap; not yet operational. Musk's Methods p. 66 — destiny-control practice.`,
        scale:        'months until parity with primary external supplier',
        meter:        'monthly milestone review',
        budget:       '',
        status:       '',
        tolerable:    '24',
        goal:         '12',
        fieldSources: { description: src, scale: src, meter: src, tolerable: src, goal: src },
      } as unknown as REntry
      next.resources = [...((next.resources ?? []) as REntry[]), newR]
      return {
        newSpec: next, affectedItemId: newR.id, affectedItemType: 'resource',
        summary: `In-house alternative R. added for ${finding.triggeredBy} — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-idiot-index-tracker': {
      const { id } = buildValueEntry(next, src, {
        baseId: 'Idiot Index',
        description: 'Musk\'s Idiot Index — ratio of finished-component cost to raw-material cost. High ratio = process is the deletion target.',
        scale: 'ratio (finished cost / raw material cost)',
        meter: 'per-component finished cost divided by sum of raw-material input costs',
        tolerable: '5', goal: '2', wish: '1.2',
      })
      return {
        newSpec: next, affectedItemId: id, affectedItemType: 'value',
        summary: `Idiot-Index Value added — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
      }
    }

    case 'add-constraint': {
      return applyAsConstraint(next, finding, src,
        finding.suggestedFix.rationale ?? `Elon Agent (${finding.principleViolated})`)
    }

    default:
      return null
  }
}

function applyAsConstraint(
  next: SpecBlock,
  finding: ElonFinding,
  src: FieldSource,
  rationaleText: string,
): ApplyFixResult {
  const existing  = (next.constraints ?? []).map(c => c.id)
  const firstLine = finding.suggestedFix.asPlanguage.split('\n')[0]
    .replace(/^[CRVSF]\.\s*/, '').trim()
  const newC: CEntry = {
    id:           uniqueMnemonic(firstLine || `${finding.category}-lock`, existing),
    type:         'Constraint',
    level:        'Business',
    description:  `Must not violate ${firstLine || finding.principleViolated.toLowerCase()}.`,
    scope:        'plan-level',
    rationale:    rationaleText,
    fieldSources: { description: src, scope: src, rationale: src },
  } as CEntry
  next.constraints = [...(next.constraints ?? []), newC]
  return {
    newSpec: next, affectedItemId: newC.id, affectedItemType: 'constraint',
    summary: `Constraint added: ${newC.id} — Source: Elon Agent @ ${src.timestamp.slice(0, 19)}Z`,
  }
}

export const _internal = { whenInDaysFromNow, parseNumericLevel, stableFindingId }
export type _VEntryRef = VEntry
export type _REntryRef = REntry
