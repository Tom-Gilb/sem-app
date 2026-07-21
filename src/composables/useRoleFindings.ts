// UNIT_TYPE=Composable
// useRoleFindings.ts — Role Agent finding engine (Tom Gilb 2026-06-23 MAJOR
// REDESIGN: "PLEASE DO A MAJOR REDESIGN TO FOCUS ON ROLES AND RESPONSIBILITY").
//
// Architecture mirrors useHeilmeierFindings.ts:
//   - Deterministic rule engine scans a SpecBlock + plan title and emits
//     RoleFinding[]
//   - 13 detectors — one per RoleCategory, covering Tom's 14 numbered points
//   - Source-layer 'derived-from-plan' on every detector; citations stamped
//   - Stable IDs across re-runs (id = `role-${category}-${triggerId}`)
//
// Role IS Stakeholder (Tom #8/9) — Accept-Fix routes mutate the existing
// StakeholderEntry record using the role fields banked in spec.ts in v305.
//
// Composes with:
//   - Conjunction-of-Technologies SUPREME (Plan + Gilb Stakeholder Engineering
//     + Musk's responsibility principle + Tom's 10-point Roles framework + LLM)
//   - AI-Max (suggestions surface immediately)
//   - Claude-Code-as-AI-Layer (no embedded API)
//   - Architectural Resilience (deterministic IDs)
//   - Universal Undo (Accept-Fix routes through useUndoHistory in App.vue)

import { computed, ref, type Ref } from 'vue'
import type { SpecBlock, StakeholderEntry, FieldSource } from '../types/spec'
import type {
  RoleFinding,
  RoleReport,
  RoleCategory,
  RoleSeverity,
  RoleFix,
} from '../types/role'
import {
  ROLE_CATEGORY_META,
  ROLE_VAGUE_ACTOR_PHRASES,
  ROLE_STEWARDS,
} from '../types/role'

// ── Module-level state ──────────────────────────────────────────────────────
const _currentReport = ref<RoleReport | null>(null)
const _dismissedIds  = ref<Set<string>>(new Set())

// ── Citations (shared constants) ────────────────────────────────────────────
const GILB_STAKEHOLDER_ENG_CITATION =
  'Gilb — Stakeholder Engineering (2025). Stakeholder identity is the first ' +
  'parameter of every Value; CE Ch.3 Stakeholder taxonomy.'

const MUSK_CITATION =
  'Musk\'s Responsibility Principle — "always name a specific individual; ' +
  'an unattributed task is an unowned task, and unowned tasks slip."'

// r41 v315 attribution rebalance (Tom Gilb 2026-06-23: "the 10 points are not
// from Monica's talk. They were written by me independent of her talk. She
// emphasized roles. You make way too much of that. One mention is enough").
// The 10-point Roles framework is Tom Gilb's own work, written independently.
// The constant name MONICA_CITATION is kept (code-internal) to avoid renaming
// the field across 16 detector call sites; the VALUE attributes correctly.
const MONICA_CITATION =
  'Tom Gilb — 10-point Roles framework (2026-06-23): Role identity, contact, ' +
  'time-span, responsibilities, authority scope, entry/exit conditions, RAG ' +
  'defaults, many-to-many Role-holding, placeholder discipline, spec-binding.'

// ── Helpers ─────────────────────────────────────────────────────────────────

function _emptyByCategory(): Record<RoleCategory, RoleFinding[]> {
  return {
    'stakeholder-required':      [],
    'role-responsible-delivery': [],
    'role-responsible-design':   [],
    'role-responsible-testing':  [],
    'role-responsible-targets':  [],
    'role-identity-minimum':     [],
    'role-identity-contact':     [],
    'role-implicit-detected':    [],
    'role-musk-principle':       [],
    'role-stewards-missing':     [],
    'role-time-span-undefined':  [],
    'role-no-spec-binding':      [],
    'role-placeholder-named':    [],
    // r41 v306 integration patch — three framework points
    'team-responsibilities-defined':      [],
    'role-entry-exit-conditions-defined': [],
    'role-rag-defaults-set':              [],
  }
}

function _now(): string {
  return new Date().toISOString()
}

function _stableId(category: RoleCategory, triggerId: string): string {
  return `role-${category}-${triggerId.replace(/[^A-Za-z0-9-]/g, '_')}`
}

function _buildRoleSource(category: RoleCategory): FieldSource {
  return {
    source:     'Role Agent',
    sourceType: 'ai',
    tool:       `Role Agent · ${ROLE_CATEGORY_META[category].label}`,
    timestamp:  _now(),
  }
}

/** Detect whether a Stakeholder/Role mentions a given responsibility kind. */
function _roleHasResponsibility(s: StakeholderEntry, keywords: RegExp): boolean {
  const blob = [
    (s.defaultResponsibilities ?? []).join(' '),
    s.position ?? '',
    s.definition ?? '',
    s.description ?? '',
    s.authorityScope ?? '',
    (s.heldRoles ?? []).join(' '),
  ].join(' ')
  return keywords.test(blob)
}

/** Detect implicit vague-actor phrases in a free-text blob. */
function _findVagueActors(text: string): string[] {
  const lower = (text ?? '').toLowerCase()
  const hits: string[] = []
  for (const phrase of ROLE_VAGUE_ACTOR_PHRASES) {
    const re = new RegExp(`\\b${phrase.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i')
    if (re.test(lower)) hits.push(phrase)
  }
  return hits
}

// ── Detectors ───────────────────────────────────────────────────────────────

interface DetectorContext {
  spec: SpecBlock
  planTitle: string
}

/** D1 — Every Value has at least one Stakeholder (Tom #13.1). */
function detectStakeholderRequired(ctx: DetectorContext): RoleFinding[] {
  const findings: RoleFinding[] = []
  const values = ctx.spec.values ?? []
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  if (values.length === 0) return []
  // Build a set of stakeholder IDs referenced by V. entries
  for (const v of values) {
    const ref = (v.wishStakeholder ?? '').trim()
    const linked = stakeholders.some(s =>
      s.id === ref ||
      s.id === v.id ||
      (s.needs ?? []).includes(v.id),
    )
    if (linked || ref.length > 0) continue
    findings.push({
      id: _stableId('stakeholder-required', v.id),
      category: 'stakeholder-required',
      severity: 'critical',
      sourceLayer: 'derived-from-plan',
      gilbCitation: GILB_STAKEHOLDER_ENG_CITATION,
      muskCitation: null,
      monicaCitation: null,
      verifyUrl: null,
      triggeredBy: v.id,
      principleViolated: 'Value has no linked Stakeholder',
      explanation:
        `${v.id} has no linked Stakeholder (no wishStakeholder, no Stakeholder ` +
        'whose needs list it). Tom #13.1: every Value needs at least one ' +
        'Stakeholder who needs or delivers it.',
      suggestedFix: {
        type: 'add-stakeholder-for-value',
        asPlanguage:
          `Stakeholder.${v.id} Beneficiary: [who needs this Value] · ` +
          'Type: Direct · Needs: [' + v.id + '] · Source: Role Agent — Tom #13.1.',
        targetItemId: v.id,
        rationale:
          'A linked Stakeholder gives the Value a constituency. Without one, ' +
          'no-one advocates for it when budgets get cut.',
      },
      longTermConsequence:
        'Orphan Values get descoped first when the plan runs over budget — no ' +
        'stakeholder speaks up because none is named.',
      generatedAtIso: _now(),
    })
  }
  return findings.slice(0, 5)
}

/** D2 — Every Value has a Role responsible for delivery (Tom #13.2 minimum). */
function detectRoleResponsibleDelivery(ctx: DetectorContext): RoleFinding[] {
  const findings: RoleFinding[] = []
  const values = ctx.spec.values ?? []
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const DELIVERY_RE = /\b(deliver|delivery|ship|implement|build|own(s|er)?)\b/i
  const hasDeliveryRole = stakeholders.some(s => _roleHasResponsibility(s, DELIVERY_RE))
  if (values.length === 0) return []
  if (hasDeliveryRole) return []
  findings.push({
    id: _stableId('role-responsible-delivery', 'plan-level'),
    category: 'role-responsible-delivery',
    severity: 'critical',
    sourceLayer: 'derived-from-plan',
    gilbCitation: GILB_STAKEHOLDER_ENG_CITATION,
    muskCitation: MUSK_CITATION,
    monicaCitation: MONICA_CITATION,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'No Stakeholder is responsible for delivery',
    explanation:
      'No Stakeholder names "deliver / ship / implement / own" in their ' +
      'defaultResponsibilities or Position. Tom #13.2 minimum: every Value ' +
      'needs a Role responsible for delivery.',
    suggestedFix: {
      type: 'add-delivery-role',
      asPlanguage:
        'Stakeholder.Delivery Role: Position [Implementation Lead] · ' +
        'defaultResponsibilities [Deliver, Ship, Build] · ' +
        'isPlaceholder true · Source: Role Agent — Tom #13.2.',
      targetItemId: 'plan-level',
      rationale:
        'A named delivery Role converts every Value Goal into a tracked ' +
        'commitment with a specific accountable individual.',
    },
    longTermConsequence:
      'Without a delivery Role, Goal levels become aspirational. The plan ' +
      'slips silently because nobody owns the ship date.',
    generatedAtIso: _now(),
  })
  return findings
}

/** D3 — Every Value has a Design role (Tom #13.2). */
function detectRoleResponsibleDesign(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const values = ctx.spec.values ?? []
  if (values.length === 0) return []
  const DESIGN_RE = /\b(design|architect|specify)\b/i
  if (stakeholders.some(s => _roleHasResponsibility(s, DESIGN_RE))) return []
  return [{
    id: _stableId('role-responsible-design', 'plan-level'),
    category: 'role-responsible-design',
    severity: 'moderate',
    sourceLayer: 'derived-from-plan',
    gilbCitation: GILB_STAKEHOLDER_ENG_CITATION,
    muskCitation: null,
    monicaCitation: MONICA_CITATION,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'No Stakeholder is responsible for design',
    explanation:
      'No Stakeholder mentions "design / architect / specify" in their ' +
      'defaultResponsibilities or Position. Tom #13.2: every Value should ' +
      'have a Design role.',
    suggestedFix: {
      type: 'add-design-role',
      asPlanguage:
        'Stakeholder.Design Role: Position [Lead Architect] · ' +
        'defaultResponsibilities [Design, Architect, Specify] · ' +
        'isPlaceholder true · Source: Role Agent — Tom #13.2.',
      targetItemId: 'plan-level',
      rationale:
        'A named Design Role keeps design intent coherent — without one, ' +
        'each Value is solutioned ad-hoc by whoever picks it up first.',
    },
    longTermConsequence:
      'Without a Design Role, the plan accumulates micro-decisions made by ' +
      'people lacking architectural context. Re-work compounds.',
    generatedAtIso: _now(),
  }]
}

/** D4 — Every Value has a Testing role (Tom #13.2). */
function detectRoleResponsibleTesting(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const values = ctx.spec.values ?? []
  if (values.length === 0) return []
  const TEST_RE = /\b(test|verify|validate|quality|qa\b)/i
  if (stakeholders.some(s => _roleHasResponsibility(s, TEST_RE))) return []
  return [{
    id: _stableId('role-responsible-testing', 'plan-level'),
    category: 'role-responsible-testing',
    severity: 'moderate',
    sourceLayer: 'derived-from-plan',
    gilbCitation: GILB_STAKEHOLDER_ENG_CITATION,
    muskCitation: null,
    monicaCitation: MONICA_CITATION,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'No Stakeholder is responsible for testing',
    explanation:
      'No Stakeholder mentions "test / verify / validate / QA" in their ' +
      'defaultResponsibilities or Position. Tom #13.2: every Value should ' +
      'have a Testing role.',
    suggestedFix: {
      type: 'add-testing-role',
      asPlanguage:
        'Stakeholder.Testing Role: Position [QA Lead] · ' +
        'defaultResponsibilities [Test, Verify, Validate] · ' +
        'isPlaceholder true · Source: Role Agent — Tom #13.2.',
      targetItemId: 'plan-level',
      rationale:
        'A named Testing Role independently verifies that Goal levels are ' +
        'actually met (not just asserted) — Heilmeier Q8 midterm-exam structure.',
    },
    longTermConsequence:
      'Without a Testing Role, every Goal level is self-reported. Confidence ' +
      'in the spec erodes the moment external review happens.',
    generatedAtIso: _now(),
  }]
}

/** D5 — Every Value has a Spec-Level-Setting role (Tom #13.2). */
function detectRoleResponsibleTargets(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const values = ctx.spec.values ?? []
  if (values.length === 0) return []
  const TARGETS_RE = /\b(target|goal[- ]?setting|spec[- ]?level|threshold|authority|negotiate)/i
  if (stakeholders.some(s => _roleHasResponsibility(s, TARGETS_RE))) return []
  return [{
    id: _stableId('role-responsible-targets', 'plan-level'),
    category: 'role-responsible-targets',
    severity: 'moderate',
    sourceLayer: 'derived-from-plan',
    gilbCitation: GILB_STAKEHOLDER_ENG_CITATION,
    muskCitation: null,
    monicaCitation: MONICA_CITATION,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: 'No Stakeholder owns Spec-Level-Setting (Tolerable/Goal/Wish)',
    explanation:
      'No Stakeholder mentions "target / goal-setting / threshold / negotiate" ' +
      'in their defaultResponsibilities or authorityScope. Tom #13.2: every ' +
      'Value should have a Role responsible for setting Tolerable / Goal / Wish.',
    suggestedFix: {
      type: 'add-targets-role',
      asPlanguage:
        'Stakeholder.Targets Role: Position [Product Owner] · ' +
        'defaultResponsibilities [Set Targets, Negotiate Goals, Approve Tolerable] · ' +
        'authorityScope [Approve Goal-level changes] · ' +
        'isPlaceholder true · Source: Role Agent — Tom #13.2.',
      targetItemId: 'plan-level',
      rationale:
        'A named Targets Role keeps threshold values stable — without one, ' +
        'Tolerable/Goal/Wish drift each meeting.',
    },
    longTermConsequence:
      'Without a Targets Role, the plan re-litigates every level each cycle. ' +
      'CE Ch.4 demands a single accountable owner for spec levels.',
    generatedAtIso: _now(),
  }]
}

/** D6 — Every Role has Name OR Position (Tom #6). */
function detectRoleIdentityMinimum(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: RoleFinding[] = []
  for (const s of stakeholders) {
    const hasName = !!s.personName && s.personName.trim().length > 0
    const hasPos  = !!s.position && s.position.trim().length > 0
    if (hasName || hasPos) continue
    findings.push({
      id: _stableId('role-identity-minimum', s.id),
      category: 'role-identity-minimum',
      severity: 'critical',
      sourceLayer: 'tom-roles-framework',
      gilbCitation: GILB_STAKEHOLDER_ENG_CITATION,
      muskCitation: MUSK_CITATION,
      monicaCitation: MONICA_CITATION,
      verifyUrl: null,
      triggeredBy: s.id,
      principleViolated: 'Stakeholder has neither personName nor position',
      explanation:
        `${s.id} has neither a personName nor a position. Tom #6: each ` +
        'Role has minimum: Name OR Position (e.g. CTO).',
      suggestedFix: {
        type: 'add-role-name-or-position',
        asPlanguage:
          `${s.id}: position [e.g. CTO] OR personName [specific individual] · ` +
          'Source: Role Agent — Tom #6.',
        targetItemId: s.id,
        rationale:
          'A Role with neither name nor position is an empty seat. Identifying ' +
          'one of the two converts theoretical accountability into actual.',
      },
      longTermConsequence:
        'Unnamed Roles cannot be held to commitments. They are review-bait ' +
        'and silently slow the plan.',
      generatedAtIso: _now(),
    })
    if (findings.length >= 5) break
  }
  return findings
}

/** D7 — Suggestion: add contact fields (Tom #7). */
function detectRoleIdentityContact(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: RoleFinding[] = []
  for (const s of stakeholders) {
    const hasPos = !!s.position && s.position.trim().length > 0
    if (!hasPos) continue
    const hasContact =
      !!s.contact &&
      Object.values(s.contact).some(v => !!v && String(v).trim().length > 0)
    if (hasContact) continue
    findings.push({
      id: _stableId('role-identity-contact', s.id),
      category: 'role-identity-contact',
      severity: 'suggestion',
      sourceLayer: 'tom-roles-framework',
      gilbCitation: null,
      muskCitation: null,
      monicaCitation: MONICA_CITATION,
      verifyUrl: null,
      triggeredBy: s.id,
      principleViolated: 'Role has position but no contact fields',
      explanation:
        `${s.id} has position "${s.position}" but no contact details ` +
        '(email/phone/location/orgDivision/supplierName/employeeId). Tom #7 ' +
        'lists these as the ideal contact set per Role.',
      suggestedFix: {
        type: 'add-role-contact',
        asPlanguage:
          `${s.id}.contact: email [example@org] · phone [+1…] · ` +
          'location [city or system] · orgDivision [department] · ' +
          'Source: Role Agent — Tom #7.',
        targetItemId: s.id,
        rationale:
          'Contact fields convert a position into a reachable individual — ' +
          'without them accountability is theoretical.',
      },
      longTermConsequence:
        'When a question comes up, no-one knows who to ask. The Role becomes ' +
        'a bottleneck that nobody can route around.',
      generatedAtIso: _now(),
    })
    if (findings.length >= 4) break
  }
  return findings
}

/** D8 — Implicit role detected in text (Tom #2). */
function detectRoleImplicitDetected(ctx: DetectorContext): RoleFinding[] {
  const findings: RoleFinding[] = []
  const allTextItems: Array<{ id: string; text: string }> = []
  for (const v of ctx.spec.values ?? [])      allTextItems.push({ id: v.id, text: String(v.description ?? '') })
  for (const s of ctx.spec.solutions ?? [])   allTextItems.push({ id: s.id, text: [s.description ?? '', s.impact ?? ''].join(' ') })
  for (const c of ctx.spec.constraints ?? []) allTextItems.push({ id: c.id, text: [c.description ?? '', c.rationale ?? ''].join(' ') })
  for (const f of ctx.spec.functions ?? [])   allTextItems.push({ id: f.id, text: f.description ?? '' })
  let n = 0
  for (const item of allTextItems) {
    if (n >= 4) break
    const hits = _findVagueActors(item.text)
    if (hits.length === 0) continue
    n++
    findings.push({
      id: _stableId('role-implicit-detected', item.id),
      category: 'role-implicit-detected',
      severity: 'moderate',
      sourceLayer: 'derived-from-plan',
      gilbCitation: GILB_STAKEHOLDER_ENG_CITATION,
      muskCitation: MUSK_CITATION,
      monicaCitation: null,
      verifyUrl: null,
      triggeredBy: item.id,
      principleViolated: 'Implicit actor in spec text',
      explanation:
        `${item.id} text contains vague actors: ${hits.slice(0, 3).join(', ')}. ` +
        'Tom #2: implicit roles must be surfaced as candidate Role entries.',
      suggestedFix: {
        type: 'name-implicit-actor',
        asPlanguage:
          `${item.id}: replace "${hits[0]}" with a specific named Stakeholder ` +
          '(e.g. Stakeholder.Implementation Lead). Source: Role Agent — Tom #2.',
        targetItemId: item.id,
        rationale:
          'Implicit actors evaporate. Surfacing them as named Roles turns ' +
          'hidden responsibility holes into trackable commitments.',
      },
      longTermConsequence:
        'Each implicit "the team will" hides a missing Role. The plan looks ' +
        'staffed when it is actually unowned.',
      generatedAtIso: _now(),
    })
  }
  return findings
}

/** D9 — Musk principle: flag vague "team / we / they" without a named individual (Tom #14). */
function detectRoleMuskPrinciple(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: RoleFinding[] = []
  const VAGUE_IDS_RE = /\b(team|leadership|management|engineering|product|design|company|stakeholders)\b/i
  for (const s of stakeholders) {
    const blob = [s.id, s.position ?? '', s.personName ?? '', s.definition ?? ''].join(' ')
    const isVague = VAGUE_IDS_RE.test(blob) || s.isPlaceholder === true
    const hasNamedPerson = !!s.personName && s.personName.trim().length > 0 &&
                          !/team|tbd|to be determined|placeholder/i.test(s.personName)
    if (!isVague || hasNamedPerson) continue
    findings.push({
      id: _stableId('role-musk-principle', s.id),
      category: 'role-musk-principle',
      severity: 'critical',
      sourceLayer: 'cited-musk-responsibility-principle',
      gilbCitation: null,
      muskCitation: MUSK_CITATION,
      monicaCitation: MONICA_CITATION,
      verifyUrl: null,
      triggeredBy: s.id,
      principleViolated: 'Role is a vague collective — not a specific individual',
      explanation:
        `${s.id} resolves to a vague collective ("${s.id}" / position ` +
        `"${s.position ?? ''}" / placeholder=${s.isPlaceholder === true}). ` +
        'Tom #14 + Musk principle: always name a specific individual.',
      suggestedFix: {
        type: 'name-specific-individual',
        asPlanguage:
          `${s.id}: personName [specific individual e.g. "Jane Smith"] · ` +
          'isPlaceholder false · Source: Role Agent — Tom #14 (Musk principle).',
        targetItemId: s.id,
        rationale:
          'A specific named individual converts diffuse accountability into ' +
          'concrete ownership. Unattributed tasks slip silently.',
      },
      longTermConsequence:
        'Collective Roles get pointed at, never assigned. Work attached to ' +
        'them stalls until someone proactively names a person.',
      generatedAtIso: _now(),
    })
    if (findings.length >= 5) break
  }
  return findings
}

/** D10 — Stewards missing: Owner / Planner / Scribe (Tom #3). */
function detectRoleStewardsMissing(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: RoleFinding[] = []
  const stewardHeld = new Set<string>()
  for (const s of stakeholders) {
    for (const r of s.heldRoles ?? []) stewardHeld.add(r)
    // Also accept Position match
    for (const steward of ROLE_STEWARDS) {
      const re = new RegExp(`\\b${steward}\\b`, 'i')
      if (re.test(s.position ?? '') || re.test(s.id)) stewardHeld.add(steward)
    }
  }
  const missing = ROLE_STEWARDS.filter(st => !stewardHeld.has(st))
  if (missing.length === 0) return []
  findings.push({
    id: _stableId('role-stewards-missing', missing.join('-')),
    category: 'role-stewards-missing',
    severity: 'critical',
    sourceLayer: 'cited-gilb-stakeholder-engineering',
    gilbCitation: GILB_STAKEHOLDER_ENG_CITATION,
    muskCitation: null,
    monicaCitation: MONICA_CITATION,
    verifyUrl: null,
    triggeredBy: 'plan-level',
    principleViolated: `Missing stewards: ${missing.join(', ')}`,
    explanation:
      `The plan lacks ${missing.join(' / ')} stewards. Tom #3: Stewards ` +
      '(Owner / Planner / Scribe) must be present on every Planguage plan.',
    suggestedFix: {
      type: 'add-stewards',
      asPlanguage:
        missing.map(st =>
          `Stakeholder.${st}: position [${st}] · ` +
          `heldRoles [${st}] · isPlaceholder true · Source: Role Agent — Tom #3.`
        ).join('\n'),
      targetItemId: 'plan-level',
      rationale:
        'Stewards establish authority + author + record-keeper. Without them ' +
        'the plan has no recognised governance.',
    },
    longTermConsequence:
      'Stewardless plans accumulate edits without authority. Conflict resolution ' +
      'collapses into the loudest voice in the room.',
    generatedAtIso: _now(),
  })
  return findings
}

/** D11 — Role time-span undefined (Tom #7). */
function detectRoleTimeSpanUndefined(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: RoleFinding[] = []
  for (const s of stakeholders) {
    const hasPos = !!s.position && s.position.trim().length > 0
    if (!hasPos) continue
    const hasBegin = !!s.dateBegin && s.dateBegin.trim().length > 0
    if (hasBegin) continue
    findings.push({
      id: _stableId('role-time-span-undefined', s.id),
      category: 'role-time-span-undefined',
      severity: 'suggestion',
      sourceLayer: 'tom-roles-framework',
      gilbCitation: null,
      muskCitation: null,
      monicaCitation: MONICA_CITATION,
      verifyUrl: null,
      triggeredBy: s.id,
      principleViolated: 'Role has no DateBegin',
      explanation:
        `${s.id} (position "${s.position}") has no DateBegin. Tom #7 lists ` +
        'DateBegin / DateEnd as part of the ideal Role identity set.',
      suggestedFix: {
        type: 'add-role-time-span',
        asPlanguage:
          `${s.id}.dateBegin: [YYYY-MM-DD] · dateEnd: [YYYY-MM-DD or open] · ` +
          'Source: Role Agent — Tom #7.',
        targetItemId: s.id,
        rationale:
          'A Role with no time-span is implicitly forever. Time-bounding the ' +
          'Role enables clean handover.',
      },
      longTermConsequence:
        'Unbounded Roles silently transfer to successors who never agreed to ' +
        'inherit the liability.',
      generatedAtIso: _now(),
    })
    if (findings.length >= 3) break
  }
  return findings
}

/** D12 — Role/Stakeholder not referenced by any spec entry (Tom #5). */
function detectRoleNoSpecBinding(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: RoleFinding[] = []
  if (stakeholders.length === 0) return []

  // Collect every referenced stakeholder tag from spec
  const referenced = new Set<string>()
  for (const v of ctx.spec.values ?? []) {
    if (v.wishStakeholder) referenced.add(v.wishStakeholder.trim())
    if ((v as { specOwner?: string }).specOwner)               referenced.add(String((v as { specOwner?: string }).specOwner).trim())
    if ((v as { implementationResponsible?: string }).implementationResponsible) referenced.add(String((v as { implementationResponsible?: string }).implementationResponsible).trim())
    if ((v as { authority?: string }).authority)               referenced.add(String((v as { authority?: string }).authority).trim())
  }
  for (const s of ctx.spec.solutions ?? []) {
    if ((s as { specOwner?: string }).specOwner)               referenced.add(String((s as { specOwner?: string }).specOwner).trim())
    if ((s as { implementationResponsible?: string }).implementationResponsible) referenced.add(String((s as { implementationResponsible?: string }).implementationResponsible).trim())
    if ((s as { authority?: string }).authority)               referenced.add(String((s as { authority?: string }).authority).trim())
  }
  for (const sh of stakeholders) {
    for (const need of sh.needs ?? []) referenced.add(need.trim())
    for (const role of sh.heldRoles ?? []) referenced.add(role.trim())
  }

  for (const s of stakeholders) {
    if (referenced.has(s.id)) continue
    // Skip steward stakeholders — they are plan-level not spec-bound
    const isSteward = ROLE_STEWARDS.some(st =>
      new RegExp(`\\b${st}\\b`, 'i').test(s.id) ||
      new RegExp(`\\b${st}\\b`, 'i').test(s.position ?? '') ||
      (s.heldRoles ?? []).includes(st),
    )
    if (isSteward) continue
    findings.push({
      id: _stableId('role-no-spec-binding', s.id),
      category: 'role-no-spec-binding',
      severity: 'suggestion',
      sourceLayer: 'derived-from-plan',
      gilbCitation: GILB_STAKEHOLDER_ENG_CITATION,
      muskCitation: null,
      monicaCitation: MONICA_CITATION,
      verifyUrl: null,
      triggeredBy: s.id,
      principleViolated: 'Stakeholder not referenced by any spec entry',
      explanation:
        `${s.id} is not referenced as wishStakeholder, specOwner, ` +
        'implementationResponsible, authority, or needs target anywhere. ' +
        'Tom #5: every Role should be bound to spec entries it relates to.',
      suggestedFix: {
        type: 'add-spec-binding',
        asPlanguage:
          `Link ${s.id} to one or more spec entries: add to V.wishStakeholder ` +
          'or list V.id in this Stakeholder.needs. Source: Role Agent — Tom #5.',
        targetItemId: s.id,
        rationale:
          'A floating Stakeholder is institutional debt — either bind it ' +
          'to spec entries or retire it.',
      },
      longTermConsequence:
        'Unbound Stakeholders proliferate. Stakeholder lists become catalogues ' +
        'rather than instruments of accountability.',
      generatedAtIso: _now(),
    })
    if (findings.length >= 4) break
  }
  return findings
}

/** D13 — Placeholder Role flagged — needs a real individual (Tom #14). */
function detectRolePlaceholderNamed(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: RoleFinding[] = []
  for (const s of stakeholders) {
    if (s.isPlaceholder !== true) continue
    findings.push({
      id: _stableId('role-placeholder-named', s.id),
      category: 'role-placeholder-named',
      severity: 'moderate',
      sourceLayer: 'cited-musk-responsibility-principle',
      gilbCitation: null,
      muskCitation: MUSK_CITATION,
      monicaCitation: MONICA_CITATION,
      verifyUrl: null,
      triggeredBy: s.id,
      principleViolated: 'Placeholder Role needs a real named individual',
      explanation:
        `${s.id} is flagged isPlaceholder=true. Tom #14 + Musk: placeholders ` +
        'must be replaced with a specific named individual before the plan ships.',
      suggestedFix: {
        type: 'promote-placeholder-to-named',
        asPlanguage:
          `${s.id}: personName [specific individual] · ` +
          'isPlaceholder false · Source: Role Agent — Tom #14.',
        targetItemId: s.id,
        rationale:
          'Placeholders are an explicit staging area. Promoting to a named ' +
          'individual converts intent into commitment.',
      },
      longTermConsequence:
        'Placeholders that linger past planning become permanent — the Role ' +
        'silently stays unowned.',
      generatedAtIso: _now(),
    })
    if (findings.length >= 5) break
  }
  return findings
}

// r41 v306 integration patch + r41 v307 attribution correction — three
// detectors covering Tom Gilb's notes #3 + #4 + #10 that round out Phase 1.
// Tom Gilb 2026-06-23 directive: "Please integrate the second roles request,
// which belongs with the first one as one request, my accident".  These three
// detectors complete Phase 1's coverage of Tom's 10-point Roles framework.

/** D14 — Team Stakeholder needs aggregated team-level responsibilities (framework #3). */
function detectTeamResponsibilitiesDefined(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: RoleFinding[] = []
  // Team heuristic: stakeholder ID/name contains "Team", "Group", "Squad",
  // "Department", "Committee", or position contains the same words AND no
  // personName is set (i.e. genuinely a team rather than a named individual).
  const TEAM_PATTERN = /\b(team|group|squad|department|committee|guild|council|board)\b/i
  for (const s of stakeholders) {
    const looksLikeTeam =
      TEAM_PATTERN.test(s.id) ||
      (s.position ? TEAM_PATTERN.test(s.position) : false) ||
      (s.description ? TEAM_PATTERN.test(s.description) : false)
    if (!looksLikeTeam) continue
    // Already a single named individual? Not a team — skip.
    if (s.personName && s.personName.trim().length > 0) continue
    // Already has aggregated responsibilities? Done.
    const respCount = s.defaultResponsibilities?.length ?? 0
    if (respCount > 0) continue
    findings.push({
      id: _stableId('team-responsibilities-defined', s.id),
      category: 'team-responsibilities-defined',
      severity: 'moderate',
      sourceLayer: 'tom-roles-framework',
      gilbCitation: null,
      muskCitation: MUSK_CITATION,
      monicaCitation: MONICA_CITATION,
      verifyUrl: null,
      triggeredBy: s.id,
      principleViolated: 'Team Stakeholder has no aggregated team-level responsibilities',
      explanation:
        `${s.id} reads as a TEAM (not a single named individual) but has no ` +
        'defaultResponsibilities array. framework #3: every team-typed Stakeholder ' +
        'must declare its aggregated team-level responsibilities — what the team ' +
        'owns COLLECTIVELY, distinct from any one member.',
      suggestedFix: {
        type: 'add-team-responsibilities',
        asPlanguage:
          `${s.id}.defaultResponsibilities: [ "Deliver X", "Review Y", "Approve Z" ] · ` +
          'Source: Role Agent — framework #3.',
        targetItemId: s.id,
        rationale:
          'Naming what the team OWNS collectively is the antidote to the vague ' +
          '"they" Musk\'s responsibility principle (Tom #14) rejects.',
      },
      longTermConsequence:
        'Teams without aggregated responsibilities silently devolve into one ' +
        'individual\'s personal commitment — usually the one who says yes loudest.',
      generatedAtIso: _now(),
    })
    if (findings.length >= 5) break
  }
  return findings
}

/** D15 — Role with Position needs Entry + Exit conditions (framework #4). */
function detectRoleEntryExitConditionsDefined(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: RoleFinding[] = []
  for (const s of stakeholders) {
    const hasPosition = !!s.position && s.position.trim().length > 0
    if (!hasPosition) continue
    const hasEntry = !!s.roleEntryConditions && s.roleEntryConditions.trim().length > 0
    const hasExit  = !!s.roleExitConditions  && s.roleExitConditions.trim().length > 0
    if (hasEntry && hasExit) continue
    const missing: string[] = []
    if (!hasEntry) missing.push('roleEntryConditions')
    if (!hasExit)  missing.push('roleExitConditions')
    findings.push({
      id: _stableId('role-entry-exit-conditions-defined', s.id),
      category: 'role-entry-exit-conditions-defined',
      severity: 'suggestion',
      sourceLayer: 'tom-roles-framework',
      gilbCitation: null,
      muskCitation: null,
      monicaCitation: MONICA_CITATION,
      verifyUrl: null,
      triggeredBy: s.id,
      principleViolated: `Role missing ${missing.join(' + ')}`,
      explanation:
        `${s.id} (position "${s.position}") has no ${missing.join(' / ')}. ` +
        'framework #4: every Role with a Position must declare what qualifies someone ' +
        'to ENTER the Role and what triggers EXIT (handover, term limit, succession ' +
        'event). Silent transitions are silent ownership loss.',
      suggestedFix: {
        type: 'add-role-entry-exit-conditions',
        asPlanguage:
          `${s.id}.roleEntryConditions: [qualification gate, e.g. "10 years' ` +
          `domain experience"] · ${s.id}.roleExitConditions: [handover trigger, ` +
          'e.g. "appointed successor passes 90-day shadow period"] · ' +
          'Source: Role Agent — framework #4.',
        targetItemId: s.id,
        rationale:
          'Time-bounding the Role with explicit gates lets succession be planned ' +
          'rather than improvised.',
      },
      longTermConsequence:
        'Roles without entry/exit conditions create silent succession crises — ' +
        'no one knows who replaces whom OR when.',
      generatedAtIso: _now(),
    })
    if (findings.length >= 5) break
  }
  return findings
}

/** D16 — Role with oversight needs RAG defaults for the work it oversees (framework #10). */
function detectRoleRagDefaultsSet(ctx: DetectorContext): RoleFinding[] {
  const stakeholders = ctx.spec.stakeholderEntries ?? []
  const findings: RoleFinding[] = []
  for (const s of stakeholders) {
    // Apply to Stakeholders that look like oversight Roles: have a Position OR
    // have defaultResponsibilities that mention review / approve / oversee /
    // audit / govern / sign-off.
    const OVERSIGHT_PATTERN = /\b(review|approve|oversee|audit|govern|sign[\s-]?off|chair|lead)\b/i
    const hasPosition = !!s.position && s.position.trim().length > 0
    const oversightResp = (s.defaultResponsibilities ?? []).some(r => OVERSIGHT_PATTERN.test(r))
    const isOversight = hasPosition || oversightResp
    if (!isOversight) continue
    // Already has RAG defaults?
    const rag = s.ragDefaults
    const hasRag =
      !!rag &&
      ((rag.red    && rag.red.trim().length > 0)    ||
       (rag.amber  && rag.amber.trim().length > 0)  ||
       (rag.green  && rag.green.trim().length > 0))
    if (hasRag) continue
    findings.push({
      id: _stableId('role-rag-defaults-set', s.id),
      category: 'role-rag-defaults-set',
      severity: 'suggestion',
      sourceLayer: 'tom-roles-framework',
      gilbCitation: null,
      muskCitation: null,
      monicaCitation: MONICA_CITATION,
      verifyUrl: null,
      triggeredBy: s.id,
      principleViolated: 'Oversight Role missing RAG defaults',
      explanation:
        `${s.id} appears to hold an oversight Role (position "${s.position ?? '—'}" / ` +
        'responsibilities include review-or-approve actions) but has no ragDefaults. ' +
        'framework #10: every oversight Role must declare Red / Amber / Green thresholds ' +
        'for the work it oversees. Defaults make Role-Efficiency measurement (Phase 3) ' +
        'deterministic instead of subjective.',
      suggestedFix: {
        type: 'add-role-rag-defaults',
        asPlanguage:
          `${s.id}.ragDefaults: { red: "<in-trouble threshold>", amber: "<at-risk ` +
          'threshold>", green: "<on-track threshold>" } · Source: Role Agent — framework #10.',
        targetItemId: s.id,
        rationale:
          'RAG defaults turn "is this work on track?" from opinion into measurement.',
      },
      longTermConsequence:
        'Without RAG defaults the oversight Role rates work by gut feel — and ' +
        'gut feel drifts into "everything is fine" right up until something is not.',
      generatedAtIso: _now(),
    })
    if (findings.length >= 5) break
  }
  return findings
}

// ── Compliance Score ───────────────────────────────────────────────────────

function _complianceScore(byCategory: Record<RoleCategory, RoleFinding[]>): number {
  const SEVERITY_WEIGHT: Record<RoleSeverity, number> = {
    critical: 3, moderate: 2, suggestion: 1,
  }
  let totalDeduction = 0
  for (const findings of Object.values(byCategory)) {
    for (const f of findings) totalDeduction += SEVERITY_WEIGHT[f.severity] * 3
  }
  // r41 v306: 16 categories × critical-tier × full weight = 144 (was 13×3×3=117).
  const MAX_POSSIBLE = 16 * 3 * 3
  const score = Math.max(0, Math.min(100, 100 - Math.round((totalDeduction / MAX_POSSIBLE) * 100)))
  return score
}

function _headline(report: Omit<RoleReport, 'headline'>): string {
  const counts = report.bySeverity
  if (report.totalFindings === 0) {
    return `🎭 Role Agent · ${report.planTitle} — Roles + Responsibilities complete (${report.complianceScore}/100). No findings.`
  }
  const parts: string[] = []
  if (counts.critical > 0)   parts.push(`${counts.critical} CRITICAL`)
  if (counts.moderate > 0)   parts.push(`${counts.moderate} moderate`)
  if (counts.suggestion > 0) parts.push(`${counts.suggestion} suggestion`)
  return `🎭 Role Agent · ${report.planTitle} — ${parts.join(' · ')} · Compliance ${report.complianceScore}/100`
}

// ── Public API ─────────────────────────────────────────────────────────────

export function runRoleAnalysis(spec: SpecBlock | null, planTitle: string): RoleReport {
  const safeSpec: SpecBlock = spec ?? { functions: [], values: [], solutions: [], constraints: [], resources: [] }
  const ctx: DetectorContext = { spec: safeSpec, planTitle }
  const byCategory = _emptyByCategory()
  byCategory['stakeholder-required']      = detectStakeholderRequired(ctx)
  byCategory['role-responsible-delivery'] = detectRoleResponsibleDelivery(ctx)
  byCategory['role-responsible-design']   = detectRoleResponsibleDesign(ctx)
  byCategory['role-responsible-testing']  = detectRoleResponsibleTesting(ctx)
  byCategory['role-responsible-targets']  = detectRoleResponsibleTargets(ctx)
  byCategory['role-identity-minimum']     = detectRoleIdentityMinimum(ctx)
  byCategory['role-identity-contact']     = detectRoleIdentityContact(ctx)
  byCategory['role-implicit-detected']    = detectRoleImplicitDetected(ctx)
  byCategory['role-musk-principle']       = detectRoleMuskPrinciple(ctx)
  byCategory['role-stewards-missing']     = detectRoleStewardsMissing(ctx)
  byCategory['role-time-span-undefined']  = detectRoleTimeSpanUndefined(ctx)
  byCategory['role-no-spec-binding']      = detectRoleNoSpecBinding(ctx)
  byCategory['role-placeholder-named']    = detectRolePlaceholderNamed(ctx)
  // r41 v306 integration patch — three framework points
  byCategory['team-responsibilities-defined']      = detectTeamResponsibilitiesDefined(ctx)
  byCategory['role-entry-exit-conditions-defined'] = detectRoleEntryExitConditionsDefined(ctx)
  byCategory['role-rag-defaults-set']              = detectRoleRagDefaultsSet(ctx)

  let total = 0
  const bySeverity: Record<RoleSeverity, number> = { critical: 0, moderate: 0, suggestion: 0 }
  for (const findings of Object.values(byCategory)) {
    for (const f of findings) {
      total++
      bySeverity[f.severity]++
    }
  }
  const complianceScore = _complianceScore(byCategory)
  const partial: Omit<RoleReport, 'headline'> = {
    generatedAtIso: _now(),
    planTitle,
    totalFindings: total,
    byCategory,
    bySeverity,
    complianceScore,
  }
  return { ...partial, headline: _headline(partial) }
}

// ── Reactive composable ────────────────────────────────────────────────────

export function useRoleFindings(): {
  report: Ref<RoleReport | null>
  visibleFindings: ReturnType<typeof computed>
  dismissedIds: Ref<Set<string>>
  setReport: (r: RoleReport | null) => void
  dismissFinding: (id: string) => void
  undismissFinding: (id: string) => void
  applyRoleFix: (finding: RoleFinding, spec: SpecBlock) => ApplyFixResult | null
} {
  const visibleFindings = computed<RoleFinding[]>(() => {
    if (!_currentReport.value) return []
    const all: RoleFinding[] = []
    for (const arr of Object.values(_currentReport.value.byCategory)) {
      for (const f of arr) {
        if (!_dismissedIds.value.has(f.id)) all.push(f)
      }
    }
    return all.sort((a, b) => {
      const sevOrder = { critical: 0, moderate: 1, suggestion: 2 }
      return sevOrder[a.severity] - sevOrder[b.severity]
    })
  })

  return {
    report: _currentReport,
    visibleFindings,
    dismissedIds: _dismissedIds,
    setReport(r) { _currentReport.value = r },
    dismissFinding(id) { _dismissedIds.value = new Set(_dismissedIds.value).add(id) },
    undismissFinding(id) {
      const next = new Set(_dismissedIds.value)
      next.delete(id)
      _dismissedIds.value = next
    },
    applyRoleFix(finding, spec) {
      return applyRoleFix(finding, spec)
    },
  }
}

// ── Apply-Fix routes ───────────────────────────────────────────────────────

export interface ApplyFixResult {
  newSpec: SpecBlock
  affectedItemId: string
  affectedItemType: 'stakeholder' | 'plan-level'
  summary: string
}

function _cloneSpec(spec: SpecBlock): SpecBlock {
  return JSON.parse(JSON.stringify(spec)) as SpecBlock
}

function _uniqueMnemonic(base: string, existing: string[]): string {
  let candidate = base
  let n = 2
  while (existing.includes(candidate)) {
    candidate = `${base} ${n}`
    n++
  }
  return candidate
}

/** Apply a Role fix to the given spec, returning a new spec.
 *  Role IS Stakeholder (Tom #8/9) — fixes mutate StakeholderEntry records
 *  using the role fields banked in spec.ts v305. */
export function applyRoleFix(finding: RoleFinding, spec: SpecBlock): ApplyFixResult | null {
  const next = _cloneSpec(spec)
  const fix = finding.suggestedFix
  const src = _buildRoleSource(finding.category)
  const stamp = `Role Agent · ${ROLE_CATEGORY_META[finding.category].label} · ${src.timestamp.slice(0, 10)}`
  const existing = (next.stakeholderEntries ?? []).map(s => s.id)

  // Adds a fresh placeholder Stakeholder/Role record
  function _addNewStakeholder(
    idBase: string,
    extra: Partial<StakeholderEntry>,
    fieldSourceKeys: string[],
  ): ApplyFixResult {
    const newId = _uniqueMnemonic(idBase, existing)
    const fieldSources: Record<string, FieldSource> = {}
    for (const k of fieldSourceKeys) fieldSources[k] = src
    const entry: StakeholderEntry = {
      id:              newId,
      type:            'Stakeholder',
      stakeholderType: 'Direct',
      isPlaceholder:   true,
      source:          stamp,
      sourceType:      'ai',
      fieldSources,
      ...extra,
    }
    next.stakeholderEntries = [...(next.stakeholderEntries ?? []), entry]
    return {
      newSpec: next,
      affectedItemId: newId,
      affectedItemType: 'stakeholder',
      summary: `${idBase} added — ${ROLE_CATEGORY_META[finding.category].label}`,
    }
  }

  // Beneficiary Stakeholder for an orphan Value (Tom #13.1)
  if (fix.type === 'add-stakeholder-for-value') {
    return _addNewStakeholder(
      'Beneficiary',
      {
        definition: `Stakeholder who needs ${finding.triggeredBy}`,
        needs: [finding.triggeredBy],
      },
      ['definition', 'needs'],
    )
  }

  // Add a delivery/design/testing/targets/stewards Role
  if (fix.type === 'add-delivery-role') {
    return _addNewStakeholder(
      'Delivery Role',
      { position: 'Implementation Lead', defaultResponsibilities: ['Deliver', 'Ship', 'Build'] },
      ['position', 'defaultResponsibilities'],
    )
  }
  if (fix.type === 'add-design-role') {
    return _addNewStakeholder(
      'Design Role',
      { position: 'Lead Architect', defaultResponsibilities: ['Design', 'Architect', 'Specify'] },
      ['position', 'defaultResponsibilities'],
    )
  }
  if (fix.type === 'add-testing-role') {
    return _addNewStakeholder(
      'Testing Role',
      { position: 'QA Lead', defaultResponsibilities: ['Test', 'Verify', 'Validate'] },
      ['position', 'defaultResponsibilities'],
    )
  }
  if (fix.type === 'add-targets-role') {
    return _addNewStakeholder(
      'Targets Role',
      {
        position: 'Product Owner',
        defaultResponsibilities: ['Set Targets', 'Negotiate Goals', 'Approve Tolerable'],
        authorityScope: 'Approves Goal-level changes',
      },
      ['position', 'defaultResponsibilities', 'authorityScope'],
    )
  }

  // Stewards: add any missing Owner / Planner / Scribe
  if (fix.type === 'add-stewards') {
    // Determine which stewards are missing right now (re-scan after potential earlier fixes)
    const held = new Set<string>()
    for (const s of next.stakeholderEntries ?? []) {
      for (const r of s.heldRoles ?? []) held.add(r)
      for (const steward of ROLE_STEWARDS) {
        const re = new RegExp(`\\b${steward}\\b`, 'i')
        if (re.test(s.position ?? '') || re.test(s.id)) held.add(steward)
      }
    }
    const missing = ROLE_STEWARDS.filter(st => !held.has(st))
    if (missing.length === 0) return null
    const addedIds: string[] = []
    for (const steward of missing) {
      const newId = _uniqueMnemonic(steward, existing.concat(addedIds))
      addedIds.push(newId)
      const entry: StakeholderEntry = {
        id:                       newId,
        type:                     'Stakeholder',
        stakeholderType:          'Direct',
        position:                 steward,
        heldRoles:                [steward],
        isPlaceholder:            true,
        source:                   stamp,
        sourceType:               'ai',
        fieldSources:             { position: src, heldRoles: src },
      }
      next.stakeholderEntries = [...(next.stakeholderEntries ?? []), entry]
    }
    return {
      newSpec: next,
      affectedItemId: addedIds.join(', '),
      affectedItemType: 'stakeholder',
      summary: `Stewards added: ${missing.join(' / ')} — Role Agent · Tom #3`,
    }
  }

  // Existing-Stakeholder annotations (Name OR Position, contact, time-span,
  // promote placeholder, spec-binding TODO, vague-individual TODO).
  if (fix.type === 'add-role-name-or-position'
   || fix.type === 'add-role-contact'
   || fix.type === 'add-role-time-span'
   || fix.type === 'name-specific-individual'
   || fix.type === 'add-spec-binding'
   || fix.type === 'promote-placeholder-to-named'
   // r41 v306 integration patch — three framework fix types
   || fix.type === 'add-team-responsibilities'
   || fix.type === 'add-role-entry-exit-conditions'
   || fix.type === 'add-role-rag-defaults') {
    const s = (next.stakeholderEntries ?? []).find(x => x.id === finding.triggeredBy)
    if (!s) return null
    const fs = { ...(s.fieldSources ?? {}) }
    let summary = ''

    if (fix.type === 'add-role-name-or-position') {
      if (!s.position) s.position = '[TODO Tom #6 — Position e.g. CTO]'
      fs.position = src
      summary = `Position TODO added to ${s.id} — Role Agent · Tom #6`
    } else if (fix.type === 'add-role-contact') {
      s.contact = {
        ...(s.contact ?? {}),
        email:    s.contact?.email    || '[TODO Tom #7 — email]',
        phone:    s.contact?.phone    || '[TODO Tom #7 — phone]',
        location: s.contact?.location || '[TODO Tom #7 — location]',
      }
      fs.contact = src
      summary = `Contact TODO added to ${s.id} — Role Agent · Tom #7`
    } else if (fix.type === 'add-role-time-span') {
      if (!s.dateBegin) s.dateBegin = '[TODO Tom #7 — YYYY-MM-DD]'
      if (!s.dateEnd)   s.dateEnd   = '[TODO Tom #7 — YYYY-MM-DD or open]'
      fs.dateBegin = src
      fs.dateEnd   = src
      summary = `Time-span TODO added to ${s.id} — Role Agent · Tom #7`
    } else if (fix.type === 'name-specific-individual' || fix.type === 'promote-placeholder-to-named') {
      if (!s.personName) s.personName = '[TODO Tom #14 — specific named individual]'
      s.isPlaceholder = false
      fs.personName = src
      fs.isPlaceholder = src
      summary = `Specific-individual TODO added to ${s.id} — Role Agent · Tom #14`
    } else if (fix.type === 'add-spec-binding') {
      const note = '[TODO Tom #5 — link to a Value/Solution via wishStakeholder/needs]'
      s.description = s.description ? `${note} ${s.description}` : note
      fs.description = src
      summary = `Spec-binding TODO added to ${s.id} — Role Agent · Tom #5`
    } else if (fix.type === 'add-team-responsibilities') {
      // r41 v306 — framework #3: aggregate team-level responsibilities.
      const existing = s.defaultResponsibilities ?? []
      s.defaultResponsibilities = existing.length > 0
        ? existing
        : ['[TODO framework #3 — team-owned: deliver X]', '[TODO framework #3 — team-owned: review Y]', '[TODO framework #3 — team-owned: approve Z]']
      fs.defaultResponsibilities = src
      summary = `Team-responsibilities TODO added to ${s.id} — Role Agent · framework #3`
    } else if (fix.type === 'add-role-entry-exit-conditions') {
      // r41 v306 — framework #4: Role entry + exit gates.
      if (!s.roleEntryConditions) s.roleEntryConditions = '[TODO framework #4 — qualification gate]'
      if (!s.roleExitConditions)  s.roleExitConditions  = '[TODO framework #4 — handover trigger]'
      fs.roleEntryConditions = src
      fs.roleExitConditions  = src
      summary = `Role entry+exit conditions TODO added to ${s.id} — Role Agent · framework #4`
    } else if (fix.type === 'add-role-rag-defaults') {
      // r41 v306 — framework #10: RAG thresholds for oversight Roles.
      s.ragDefaults = {
        red:   s.ragDefaults?.red   || '[TODO framework #10 — in-trouble threshold]',
        amber: s.ragDefaults?.amber || '[TODO framework #10 — at-risk threshold]',
        green: s.ragDefaults?.green || '[TODO framework #10 — on-track threshold]',
      }
      fs.ragDefaults = src
      summary = `RAG defaults TODO added to ${s.id} — Role Agent · framework #10`
    }

    s.fieldSources = fs
    return {
      newSpec: next,
      affectedItemId: s.id,
      affectedItemType: 'stakeholder',
      summary,
    }
  }

  // Implicit actor — annotate the triggering item with a TODO comment in description
  if (fix.type === 'name-implicit-actor') {
    const id = finding.triggeredBy
    const note = `[TODO Tom #2 — replace vague actor with named Stakeholder]`
    let touched = false
    const annotate = (items?: Array<{ id: string; description?: string; fieldSources?: Record<string, FieldSource> }>) => {
      if (!items) return
      const it = items.find(x => x.id === id)
      if (!it) return
      it.description = it.description ? `${note} ${it.description}` : note
      it.fieldSources = { ...(it.fieldSources ?? {}), description: src }
      touched = true
    }
    annotate(next.values as unknown as Array<{ id: string; description?: string; fieldSources?: Record<string, FieldSource> }>)
    annotate(next.solutions as unknown as Array<{ id: string; description?: string; fieldSources?: Record<string, FieldSource> }>)
    annotate(next.constraints as unknown as Array<{ id: string; description?: string; fieldSources?: Record<string, FieldSource> }>)
    annotate(next.functions as unknown as Array<{ id: string; description?: string; fieldSources?: Record<string, FieldSource> }>)
    if (!touched) return null
    return {
      newSpec: next,
      affectedItemId: id,
      affectedItemType: 'plan-level',
      summary: `Implicit-actor TODO added to ${id} — Role Agent · Tom #2`,
    }
  }

  return null
}
