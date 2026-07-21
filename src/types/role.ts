// UNIT_TYPE=Types
// role.ts — types for the Role Agent (Tom Gilb 2026-06-23 MAJOR REDESIGN
// "PLEASE DO A MAJOR REDESIGN TO FOCUS ON ROLES AND RESPONSIBILITY").
//
// Architectural constraints (Tom's 14 numbered directives):
//   #1   Make an Agent 'Roles'
//   #2   Checks all stakeholders + other elements for explicit AND implicit
//        roles + responsibilities
//   #3   Adds parameters to specs using Planguage Glossary parameters
//        (Owner, Responsible For, …); may invent new Roles + add to Glossary;
//        Stewards (Owner/Planner/Scribe) included
//   #4   A person or entity can have any useful number of Roles (many-to-many)
//   #5   Role Agent tracks all Roles associated with any Plan Spec
//   #6   Each Role has minimum: Name OR Position (e.g. CTO)
//   #7   Ideally also: Email · Telephone · Location · OrgDivision ·
//        SupplierName · EmployeeId · DateBegin · DateEnd · extensible
//   #8   Role IS a Stakeholder by definition — recorded as a Stakeholder Spec
//   #9   Roles are a SUBSET of all Stakeholder logic and rules
//   #13  Rules to enforce:
//          - Every Value has at least one Stakeholder (needs / delivers)
//          - Every Value has Roles responsible for delivery (minimum) +
//            Design / Testing / Spec-Level-Setting (additional)
//   #14  Maximum automation + defaults + placeholders + Musk's
//        "always name a specific individual" principle (flag vague
//        "team / we / they")
//
// ARCHITECTURAL ALIGNMENT: mirrors `src/types/heilmeier.ts` precisely.
// 13 detector categories, same Finding/Report/Fix shape, same Accept-Fix
// pipeline. Role is a Stakeholder (Tom #8/9) — fixes mutate the existing
// StakeholderEntry record using the new role fields banked in spec.ts.
//
// Conjunction-of-Technologies SUPREME compliance — sources cited per finding:
//   1. The current Plan (deterministic) — what triggered each finding
//   2. Tom Gilb — Stakeholder Engineering (2025)
//   3. Elon Musk's responsibility principle — "always name a specific
//      individual" (Tom #14)
//   4. Tom Gilb — 10-point Roles framework (2026-06-23, Tom's own work)

/** The 13 Role-Agent categories — one per detector. Order = severity/criticality
 *  for default sort; the Accept-Fix routing reads `category` directly. */
export type RoleCategory =
  | 'stakeholder-required'        // Every V. has ≥1 Stakeholder (Tom #13.1)
  | 'role-responsible-delivery'   // Every V. has a Role responsible for delivery (Tom #13.2 min)
  | 'role-responsible-design'     // Every V. has a Design role (Tom #13.2)
  | 'role-responsible-testing'    // Every V. has a Testing role (Tom #13.2)
  | 'role-responsible-targets'    // Every V. has a Spec-Level-Setting role (Tom #13.2)
  | 'role-identity-minimum'       // Every Role has Name OR Position (Tom #6)
  | 'role-identity-contact'       // Suggestion: add contact fields (Tom #7)
  | 'role-implicit-detected'      // Implicit role in text — "the team approves" (Tom #2)
  | 'role-musk-principle'         // Vague "team/we/they" — flag for naming (Tom #14)
  | 'role-stewards-missing'       // Owner/Planner/Scribe not assigned (Tom #3)
  | 'role-time-span-undefined'    // Role has no DateBegin / DateEnd
  | 'role-no-spec-binding'        // Stakeholder/Role with no Spec reference (Tom #5)
  | 'role-placeholder-named'      // Placeholder Role flagged — needs real name
  // r41 v306 integration patch — three additional framework points that the
  // v305 13-detector inventory deferred but properly belong in Phase 1 per
  // Tom's "PLEASE integrate the second roles request, which belongs with the
  // first one as one request, my accident" (2026-06-23).  Originals:
  // Tom 10-point Roles framework #3, #4, #10.
  | 'team-responsibilities-defined'        // framework #3 — Team Stakeholder has aggregated team-level responsibilities
  | 'role-entry-exit-conditions-defined'   // framework #4 — Role has explicit Entry + Exit conditions
  | 'role-rag-defaults-set'                // framework #10 — Role has RAG defaults for the work it oversees

/** Per-finding severity (mirrors HeilmeierSeverity). */
export type RoleSeverity = 'critical' | 'moderate' | 'suggestion'

/** Source-layer badge per Conjunction-of-Technologies. */
export type RoleSourceLayer =
  | 'derived-from-plan'                    // Deterministic from spec data — highest confidence
  | 'cited-gilb-stakeholder-engineering'   // Tom Gilb — Stakeholder Engineering 2025
  | 'cited-musk-responsibility-principle'  // Musk — "always name a specific individual"
  | 'tom-roles-framework'                   // Tom Gilb's 10-point Roles framework (2026-06-23)
  | 'llm-training'                         // General knowledge
  | 'generic-template'                     // Fallback — lowest provenance

/** Shape of a single suggested edit attached to a Role finding. */
export interface RoleFix {
  /** What KIND of edit the user would apply. Used for routing the Apply button. */
  type:
    | 'add-stakeholder-for-value'           // Add a new Stakeholder linked to V. (Tom #13.1)
    | 'add-delivery-role'                   // Add a Role responsible for delivery (Tom #13.2 min)
    | 'add-design-role'                     // Add a Design Role (Tom #13.2)
    | 'add-testing-role'                    // Add a Testing Role (Tom #13.2)
    | 'add-targets-role'                    // Add a Spec-Level-Setting Role (Tom #13.2)
    | 'add-role-name-or-position'           // Annotate Stakeholder with Name OR Position (Tom #6)
    | 'add-role-contact'                    // Annotate Stakeholder with contact fields (Tom #7)
    | 'name-implicit-actor'                 // Replace implicit "team approves" with named Role (Tom #2)
    | 'name-specific-individual'            // Musk principle — name a specific individual (Tom #14)
    | 'add-stewards'                        // Add Owner / Planner / Scribe (Tom #3)
    | 'add-role-time-span'                  // Annotate Role with DateBegin / DateEnd (Tom #7)
    | 'add-spec-binding'                    // Link a Stakeholder to a spec entry (Tom #5)
    | 'promote-placeholder-to-named'        // Replace placeholder with a real named individual
    // r41 v306 integration patch — three additional framework fix types
    | 'add-team-responsibilities'           // Annotate a team Stakeholder with aggregated responsibilities (framework #3)
    | 'add-role-entry-exit-conditions'      // Annotate Role with entry + exit conditions (framework #4)
    | 'add-role-rag-defaults'               // Annotate Role with RAG defaults for the work it oversees (framework #10)
  /** The proposed edit expressed as Planguage text. Shown to user for review. */
  asPlanguage: string
  /** Target entry id (Stakeholder tag / V.tag / 'plan-level'). */
  targetItemId: string
  /** Human-readable rationale shown in the Accept/Dismiss card. */
  rationale: string
}

/** A single Role finding. */
export interface RoleFinding {
  /** Deterministic id — stable across re-runs of the same logical inputs. */
  id: string
  category: RoleCategory
  severity: RoleSeverity
  sourceLayer: RoleSourceLayer
  /** Tom Gilb — Stakeholder Engineering citation. */
  gilbCitation: string | null
  /** Musk's responsibility principle citation (when applicable). */
  muskCitation: string | null
  /** Citation for Tom Gilb's 10-point Roles framework (2026-06-23, Tom's own work). */
  monicaCitation: string | null
  /** Optional public-URL anchor for verification. */
  verifyUrl: string | null
  /** Which entry triggered this finding ('Stakeholder.Owner', 'V.OnboardingSpeed', 'plan-level'). */
  triggeredBy: string
  /** Short label of the principle being violated. */
  principleViolated: string
  /** One-sentence explanation in plain English. */
  explanation: string
  /** Suggested edit the user can Accept / Dismiss. */
  suggestedFix: RoleFix
  /** One-sentence consequence framing — "what happens if you don't fix this". */
  longTermConsequence: string
  /** Computed at generation time so the UI can sort newest-first if needed. */
  generatedAtIso: string
}

/** Output of a single Role-Agent run on a Plan. */
export interface RoleReport {
  generatedAtIso: string
  planTitle: string
  totalFindings: number
  byCategory: Record<RoleCategory, RoleFinding[]>
  bySeverity: Record<RoleSeverity, number>
  /** Aggregate "Role Compliance Score" 0-100 — higher = more roles + responsibilities filled.
   *  Critical findings weight 3× moderate; moderate weight 2× suggestion; suggestions 1×. */
  complianceScore: number
  /** One-line headline summary the user reads first. */
  headline: string
}

/** Vague-actor phrases the Musk-principle detector scans for (Tom #14).
 *  Each match in spec text fires a finding asking for a specific named individual. */
export const ROLE_VAGUE_ACTOR_PHRASES: ReadonlySet<string> = new Set([
  'the team',
  'our team',
  'we will',
  'we should',
  'we need',
  'they will',
  'they should',
  'someone',
  'somebody',
  'engineering',
  'product team',
  'design team',
  'leadership',
  'management',
  'the company',
  'stakeholders agree',
  'tbd',
  'to be determined',
])

/** Stewards expected per plan (Tom #3). */
export const ROLE_STEWARDS: readonly string[] = ['Owner', 'Planner', 'Scribe'] as const

/** Category metadata for UI rendering — label, color, principle one-liner.
 *
 *  Color palette (R/G-colorblind-safe; indigo/cyan family — Role IS Stakeholder
 *  per Tom #8, so we use the Stakeholder indigo lineage with cyan variants).
 *    stakeholder-required=red · role-responsible-*=indigo · role-identity-*=cyan
 *    role-implicit/musk/stewards=amber · role-time-span/no-spec-binding/placeholder=slate */
export const ROLE_CATEGORY_META: Record<
  RoleCategory,
  { label: string; subtitle: string; color: string; principle: string }
> = {
  'stakeholder-required': {
    label: 'Every Value needs a Stakeholder',
    subtitle: 'Tom #13.1 — Stakeholder Engineering baseline',
    color: 'red',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #13.1: "Every Value has at least one ' +
      'Stakeholder (needs / delivers)." A Value with no Stakeholder is an ' +
      'orphan — no constituency wants it, nobody is hurt if it ships late. ' +
      'Gilb Stakeholder Engineering (2025) treats Stakeholder identity as the ' +
      'first parameter of every Value, not a decoration.',
  },
  'role-responsible-delivery': {
    label: 'Every Value needs a Delivery Role',
    subtitle: 'Tom #13.2 minimum — who SHIPS this Value',
    color: 'indigo',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #13.2 minimum: "Every Value has Roles ' +
      'responsible for delivery." Without a named delivery Role, the Value is ' +
      'a wish — Musk\'s responsibility principle says every commitment needs a ' +
      'specific accountable individual or it slips silently.',
  },
  'role-responsible-design': {
    label: 'Every Value needs a Design Role',
    subtitle: 'Tom #13.2 — who DESIGNS this Value',
    color: 'indigo',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #13.2: "Every Value has Roles responsible ' +
      'for … Design …" A Value without a Design role is solutioned ad-hoc by ' +
      'whoever happens to pick it up — the design intent is then lost.',
  },
  'role-responsible-testing': {
    label: 'Every Value needs a Testing Role',
    subtitle: 'Tom #13.2 — who VERIFIES this Value',
    color: 'indigo',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #13.2: "Every Value has Roles responsible ' +
      'for … Testing …" Without a named Testing role the Goal level is asserted, ' +
      'never independently verified — Heilmeier Q8 midterm-exam structurally fails.',
  },
  'role-responsible-targets': {
    label: 'Every Value needs a Spec-Level-Setting Role',
    subtitle: 'Tom #13.2 — who SETS Tolerable / Goal / Wish',
    color: 'indigo',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #13.2: "Every Value has Roles responsible ' +
      'for … Spec-Level-Setting." Without a named Targets role the threshold ' +
      'values drift each meeting; CE Ch.4 demands a single accountable owner.',
  },
  'role-identity-minimum': {
    label: 'Every Role needs Name OR Position',
    subtitle: 'Tom #6 — minimum Role identity',
    color: 'cyan',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #6: "Each Role has minimum: Name OR ' +
      'Position (e.g. CTO)." A Role with neither is an empty seat — work ' +
      'attached to it has no accountable identity.',
  },
  'role-identity-contact': {
    label: 'Role contact fields strengthen accountability',
    subtitle: 'Tom #7 — Email / Phone / Location / Org / Supplier / EmployeeId',
    color: 'cyan',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #7: "Ideally also: Email · Telephone · ' +
      'Location · OrgDivision · SupplierName · EmployeeId · DateBegin · DateEnd." ' +
      'Contact fields convert a name into a reachable individual — without them ' +
      'accountability is theoretical.',
  },
  'role-implicit-detected': {
    label: 'Implicit role detected in spec text',
    subtitle: 'Tom #2 — explicit AND implicit roles',
    color: 'amber',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #2: "checks all stakeholders + other ' +
      'elements for explicit AND implicit roles + responsibilities." Phrases ' +
      'like "the team approves" or "we will deliver" hide unnamed actors — ' +
      'surface them as candidate Role entries before they evaporate.',
  },
  'role-musk-principle': {
    label: 'Musk principle — name a specific individual',
    subtitle: 'Tom #14 — flag vague "team / we / they"',
    color: 'amber',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #14: "Musk\'s \'always name a specific ' +
      'individual\' principle (flag vague \'team / we / they\')." Every vague ' +
      'collective noun in a spec is a responsibility hole — assignable but ' +
      'unassigned. Elon Musk\'s management rule: an unattributed task is an ' +
      'unowned task, and unowned tasks slip.',
  },
  'role-stewards-missing': {
    label: 'Stewards missing (Owner · Planner · Scribe)',
    subtitle: 'Tom #3 — canonical Planguage stewards',
    color: 'amber',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #3: "Stewards (Owner/Planner/Scribe) ' +
      'included." Every Planguage plan needs an Owner (accountable), a Planner ' +
      '(author), and a Scribe (record-keeper). Missing stewards → unclear ' +
      'authority + lost institutional memory.',
  },
  'role-time-span-undefined': {
    label: 'Role time-span undefined',
    subtitle: 'Tom #7 — DateBegin / DateEnd',
    color: 'slate',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #7: "DateBegin · DateEnd." A Role with ' +
      'no time-span is implicitly forever — even successors will inherit ' +
      'liability they did not sign up for.',
  },
  'role-no-spec-binding': {
    label: 'Role not referenced by any Spec entry',
    subtitle: 'Tom #5 — Role Agent tracks all Roles per Plan',
    color: 'slate',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #5: "Role Agent tracks all Roles ' +
      'associated with any Plan Spec." A Stakeholder/Role not referenced by ' +
      'specOwner / implementationResponsible / authority / wishStakeholder / ' +
      'needs anywhere is a floating identity — either bind it or retire it.',
  },
  'role-placeholder-named': {
    label: 'Placeholder Role needs a real individual',
    subtitle: 'Tom #14 — replace placeholders',
    color: 'slate',
    principle:
      'Tom Gilb 2026-06-23 verbatim Rule #14: "placeholders + Musk\'s \'always ' +
      'name a specific individual\' principle." Placeholders are an explicit ' +
      'staging area — they must be replaced with real individuals before the ' +
      'plan ships.',
  },
  // r41 v306 integration patch — three framework points
  'team-responsibilities-defined': {
    label: 'Team Stakeholder needs aggregated responsibilities',
    subtitle: 'framework #3 — team-level responsibilities',
    color: 'amber',
    principle:
      'Tom Gilb 10-point Roles framework #3: "Team Responsibilities". Every Stakeholder ' +
      'that represents a TEAM (not a single named individual) must declare its ' +
      'aggregated team-level responsibilities — what the team owns collectively, ' +
      'distinct from any one member\'s personal role. Without this, the team ' +
      'becomes a vague "they" that Musk\'s responsibility principle (Tom #14) ' +
      'explicitly bans.',
  },
  'role-entry-exit-conditions-defined': {
    label: 'Role needs Entry + Exit conditions',
    subtitle: 'framework #4 — Role time-boundaries',
    color: 'cyan',
    principle:
      'Tom Gilb 10-point Roles framework #4: "Entry/Exit conditions for Roles". ' +
      'Every Role with a Position (CTO, Reviewer, Approver, etc.) must declare ' +
      'what qualifies someone to ENTER the Role and what triggers EXIT (handover, ' +
      'term limit, succession event). Without explicit conditions, role transitions ' +
      'happen implicitly — and silent handovers are silent ownership loss.',
  },
  'role-rag-defaults-set': {
    label: 'Role needs RAG defaults for the work it oversees',
    subtitle: 'framework #10 — RAG thresholds per Role',
    color: 'emerald',
    principle:
      'Tom Gilb 10-point Roles framework #10: "RAG settings and defaults for types of ' +
      'work". Every Role with oversight responsibilities must declare its default ' +
      'Red / Amber / Green thresholds — what counts as "in trouble", "at risk", ' +
      '"on track" for the work this Role oversees. Defaults make the Role Efficiency ' +
      'measure (framework #9, Phase 3) deterministic instead of subjective.',
  },
}

/** Severity metadata for UI rendering (mirrors HEILMEIER_SEVERITY_META verbatim). */
export const ROLE_SEVERITY_META: Record<
  RoleSeverity,
  { label: string; bg: string; text: string; ring: string; sortOrder: number }
> = {
  critical: {
    label: 'CRITICAL',
    bg: 'bg-red-600',
    text: 'text-white',
    ring: 'ring-red-900',
    sortOrder: 0,
  },
  moderate: {
    label: 'MODERATE',
    bg: 'bg-amber-500',
    text: 'text-white',
    ring: 'ring-amber-700',
    sortOrder: 1,
  },
  suggestion: {
    label: 'SUGGESTION',
    bg: 'bg-blue-500',
    text: 'text-white',
    ring: 'ring-blue-700',
    sortOrder: 2,
  },
}

/** Source-layer metadata for UI rendering. */
export const ROLE_SOURCE_META: Record<
  RoleSourceLayer,
  { label: string; bg: string; text: string }
> = {
  'derived-from-plan':                   { label: 'Derived from plan',           bg: 'bg-emerald-100', text: 'text-emerald-900' },
  'cited-gilb-stakeholder-engineering':  { label: 'Cited · Gilb Stakeholder Eng', bg: 'bg-indigo-100',  text: 'text-indigo-900' },
  'cited-musk-responsibility-principle': { label: 'Cited · Musk Responsibility',  bg: 'bg-amber-100',   text: 'text-amber-900' },
  'tom-roles-framework':                  { label: 'Tom Roles framework',          bg: 'bg-cyan-100',    text: 'text-cyan-900' },
  'llm-training':                        { label: 'LLM training',                 bg: 'bg-slate-100',   text: 'text-slate-700' },
  'generic-template':                    { label: 'Template fallback',            bg: 'bg-slate-100',   text: 'text-slate-500' },
}
