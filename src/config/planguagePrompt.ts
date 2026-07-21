// UNIT_TYPE=Config
// Canonical Planguage extractor primer — single source of truth for every
// SEM App AI extraction site that produces Planguage entries.
//
// Tom Gilb 2026-06-21 verbatim (SUPREME-tier trust-rebuild trigger):
//   "I am not happy with that. It smells short term patch. … perfectly good
//    Planguage generation has disappeared for unknown reasons. … Find and
//    resurrect it to former glory? and find out why good design disappears
//    at all (shocking and disturbing, I cannot trust you)."
//
// ROOT CAUSE diagnosed: SYSTEM_PROMPT in llm.ts grew to ~900 lines with
// 20+ SUPREME-tier Planguage discipline rules (r93jjj Qualifiers, r93mmm
// Infinity Trap, r93lll ASPECTS grounding, r41 v236 Solution Parameters,
// r41 v269 V-parameter-rich, F-vs-Meter, Mnemonic-IDs, Spell-out-Type-Names,
// Banned Scrum vocab, etc.) — but FOUR sibling extraction sites carried
// their own thin parallel primers (useContractParser.ts 19-line PLANGUAGE_PRIMER,
// useSpecImporter.ts 1-sentence convertSystem, useSpecInput.ts 53-line
// _PARSE_PROMPT, useSpecInput.ts ~50-line _MERGE_PROMPT) that were authored
// independently and have not received any of the r93-wave SUPREME amendments.
// Indianapolis spec parse went through the 19-line Contracts primer →
// trials misclassified as Functions, V. entries parameter-starved, etc.
// This is the canonical "parallel implementations are guaranteed to drift"
// failure mode banked as Trace-Before-Patch SUPREME 2026-06-17.
//
// THE FIX (this file): one canonical primer string. Every extraction site
// imports + interpolates this string instead of authoring its own. When a
// new SUPREME rule lands (e.g. r41 v270 F-vs-Meter today), edit this file
// ONCE and every extraction site inherits the update. No more drift.
//
// Composes with:
//   • Trace-Before-Patch SUPREME (parallel-impl → guaranteed drift)
//   • Architectural Resilience SUPREME (single source of truth)
//   • No-Silent-Removal SUPREME (additive — every existing rule preserved)
//   • Conjunction-of-Technologies SUPREME (Planguage discipline IS the
//     Conjunction layer; richer primer → richer AI output)
//   • Twin portability (primer is pure string; ports verbatim to Kai's Twin)

/**
 * CANONICAL Planguage discipline primer.
 *
 * Contains every SUPREME-tier Planguage discipline rule that applies to ANY
 * extraction context (contracts, slide decks, business briefs, plain text,
 * SEM-triple inputs, model imports, etc.). Caller is responsible for adding:
 *   (a) opening framing (what kind of input is being parsed)
 *   (b) closing JSON output schema (the exact field shape the caller wants)
 *   (c) caller-specific few-shot examples
 *
 * NEVER author a parallel primer. If a Planguage rule is missing here, add
 * it HERE — never duplicate it in a caller-specific prompt.
 *
 * The feature-smoke invariant `no-parallel-planguage-primer` greps the
 * codebase for primer-style declarations OUTSIDE this file and trips on
 * violations.
 */
export const CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT = `
== BANNED VOCABULARY (HARD RULE — never use these words, in any field, in any context) ==
Tom Gilb 2026-06-03: "sprint is a scrum term and is very inferior to an Evo step and Planguage concepts (incl tasks and solutions). Do not ever use scrum terms (universal rule) use the proper defined Planguage terms."

NEVER use any of these scrum / agile-industry words in ANY output field
(description, presenceTest, scale, meter, impact, tolerable, goal, record,
or any free-text Planguage spec field):
  sprint, sprint plan, sprint backlog, sprint review, sprint retro,
  scrum, scrum master, daily scrum, standup, stand-up, daily stand-up,
  product backlog, backlog grooming, refinement,
  user story, story point, epic, theme,
  velocity, story velocity, burndown, burnup,
  kanban (in the agile-process sense — fine for physical kanban),
  retrospective (in the scrum sense), retro,
  done definition, definition of done (in the scrum sense)

USE the Planguage equivalents instead:
  "sprint" / "iteration"           → "Evo Step" or "Evo Cycle"
  "sprint plan"                    → "Evo Plan" or "Plan"
  "sprint backlog"                 → "Tasks for an Evo Step"
  "user story" / "story"           → "Value entry" or "Function entry"
  "story point" / "velocity"       → "effortPercent" or "hours"
  "epic"                           → "Solution" or "high-level Value"
  "standup"                        → "Step status check"
  "retrospective" (process sense)  → "Study-Act" or "Learn step"
  "definition of done"             → "presenceTest" (Function) or "Goal" (Value)

If you find yourself wanting to write "this sprint" or "the team's velocity",
STOP — rephrase in the Planguage equivalent. This rule is non-negotiable;
scrum vocabulary corrupts the Planguage methodology.

== STAKEHOLDER ANALYSIS — output structured entries AND wire V. entries ==
The input may name multiple distinct stakeholders. Identify all of them, then:
(a) produce a structured 'stakeholderEntries' array (if the caller's output
    schema supports it), AND
(b) express each concern through dedicated V. entries cross-linked via
    wishStakeholder.

• A stakeholder is any person, role, team, group, OR inanimate entity with a
  specific concern about the outcome. Data, systems, laws, and regulations
  are legitimate stakeholders.
• Split by commas, semicolons, "and", or "/" — each named party is likely a
  separate stakeholder.
• Implied stakeholders count: "the business" implies a Finance/growth
  concern; "customers" implies a UX/satisfaction concern; "Ops" implies an
  operational reliability concern.
• "Data" / "all data" / "the data" is a stakeholder — its concerns are
  binary compliance rules (privacy, GDPR, integrity, security). Its needs
  produce C. entries, not V. entries, because they are violated or not
  violated — never traded off.
• Regulatory bodies (GDPR, HIPAA, ISO, local law) are stakeholders — their
  requirements are always C. entries.

━━ SUBJECT vs META Stakeholder rule (Tom Gilb 2026-06-16) ━━
When the input describes a planning project (current, historical, fictional,
proposed, or post-mortem), there are TWO classes of actors:

  • SUBJECT STAKEHOLDERS — the people / roles / institutions WITHIN the
    project being planned. These are the ones whose concerns drive the
    plan's V. / C. / R. entries. Example: for a plan to design the 1635
    Sovereign of the Seas, the SUBJECT stakeholders are Charles I, Phineas
    Pett (master shipwright), the King's Committee, the Royal Shipwrights,
    the Crown Treasury, the Woolwich dockyard workers, the Royal Navy, the
    rival European naval powers.

  • META STAKEHOLDERS — the people / institutions OUTSIDE the project who
    are STUDYING / DOCUMENTING / TEACHING / RESEARCHING it. Example: the
    modern historian, the Navy Records Society (as a publisher), the
    archival researcher, the librarian, the Project Gutenberg editor.

THE RULE: the spec MUST default to SUBJECT stakeholders. META stakeholders
appear in the spec ONLY when the user explicitly says the planning subject
IS the study / documentation / research effort itself.

Recognition heuristics (META — drop unless explicitly the subject):
  • "I want to study X", "researching X", "verbatim access to X" → meta
  • Modern frame words like "classification", "verbatim access", "academic
    citation", "source authenticity" applied to a historical subject → meta

Recognition heuristics (SUBJECT — surface these):
  • Named individuals + roles + institutions WHO WERE INVOLVED in the
    project being planned
  • Stakeholders who would have HAD CONCERNS about the project succeeding
    OR failing on its own terms

When in doubt: ask "would this person have CARED whether the project
itself succeeded?" — if yes → SUBJECT; if their only concern is "I want to
read about it later" → META → drop.
━━ END SUBJECT vs META RULE ━━

Apply these rules:
A. Identify EVERY distinct stakeholder and their specific concern.
B. Create AT LEAST ONE V. entry per distinct stakeholder concern — each
   measuring what THAT stakeholder values in their own terms.
C. Set the wishStakeholder field on each V. entry to the exact name or
   role of the stakeholder (e.g. "Product team", "Engineering", "Customer
   Success", "Tom").
D. Never merge two different stakeholder concerns into a single V. entry —
   keep them separate so each concern is independently measurable.
E. For each distinct stakeholder also produce a StakeholderEntry object
   (if caller's schema supports it).

== STEP 0 — SCAN FOR CONSTRAINTS FIRST (do this before ANY F/V/S classification) ==
Before producing any F., V., or S. entries, scan the ENTIRE input for
constraint language. Extract ALL such items as C. entries first. Then
classify the remaining non-constraint content as F./V./S.

Constraint language — treat these as C., never as F. or S.:
  • Any reference to: GDPR, HIPAA, ISO, regulation, law, legislation,
    compliance, "must comply", "must not", "prohibited", "mandatory",
    "required by law", "regulatory requirement", privacy law, safety rule,
    licensing, policy
  • Any statement that must hold at ALL times regardless of design choices
  • Any rule where the only question is VIOLATED / NOT VIOLATED — no degrees

The fact that a system "does" something to achieve compliance does NOT
make it a Function. "The system complies with GDPR" is not a capability —
it is a constraint that disqualifies any design that violates it.

== FUNDAMENTAL PLANGUAGE PRINCIPLE: FUNCTIONS ARE BINARY ==
A Function (F.) describes WHAT the system does — it is a binary capability.
The system either provides the function or it does not. PRESENT or ABSENT.
YES or NO.

The Function's description is a bare-noun capability statement — what the
system DOES, not how well it does it. Examples:
  CORRECT: "The system authenticates users via email and password."
  CORRECT: "The cabin provides recreation."
  CORRECT: "The platform offers a search endpoint."
  WRONG:   "Authenticate users 99.9% of the time" — that quality target is a VALUE.
  WRONG:   "Provide an excellent recreation experience" — quality is a VALUE.

A Function's presenceTest is the BINARY existence check — the YES/NO
statement that decides whether the defined function is present in the
deployed system. DD-004 (Tom Gilb 2026-05-14): "REPURPOSE: NOT AS SUCCESS.
AS PRESENCE OR ABSENCE OF THE DEFINED FUNCTION." Examples:
  CORRECT: "User authentication endpoint exists and accepts credentials."
  CORRECT: "Recreational facilities exist on premises (YES / NO)."
  CORRECT: "Search API responds to a probe query with a well-formed response."
  WRONG:   "p95 latency ≤200ms" — this is a VALUE, not a presence test.
  WRONG:   "80% of users complete within 2 minutes" — also a VALUE.
  WRONG:   "Stakeholder X confirms metric Y reaches Z%" — VALUE Goal, not presence.

All quantitative thresholds, rates, percentages, speeds, qualities, and
stakeholder confirmations belong EXCLUSIVELY in V. (Value) entries, never
in F. entries or their presenceTest. A Function is the stage; a Value
measures how well the performance plays out on that stage.

Canonical source: Tom Gilb, *Clear Communication: Logical Language Logistics
for Clear Replies and Phrases* (June 2024) — the project glossary definition
of "Function" overrides any dictionary / common-usage / pre-training meaning.

== FUNDAMENTAL PLANGUAGE PRINCIPLE: BINARY CONSTRAINTS ==
A Constraint (C.) is a binary boundary rule — "Must do" or "Must not do".
It is either VIOLATED or NOT VIOLATED. No degrees. No thresholds (those
are V. Tolerable levels).

DD-006 (Tom Gilb): SUCCESS requires ALL Values within ALL Constraints. A
single violated constraint makes the plan unacceptable regardless of how
well Values are met.

When to produce C. entries:
  • Input contains: "must", "required", "mandatory", "prohibited",
    "illegal", "must not", "never", "always", "comply", "regulation",
    "law", "policy", "can't", "cannot", "legal requirement"
  • Any hard rule that has no degrees — just violated / not violated
  • Examples: legal compliance, budget caps, safety rules, licensing,
    privacy law

HARD RULE — named regulations are ALWAYS C., no exceptions:
  GDPR, HIPAA, SOC2, ISO 27001, PCI-DSS, CCPA, FDA, OSHA, any named law
  or regulation → ALWAYS a C. entry. NEVER an F. or S. entry. Period.

ANTI-PATTERN — this mistake is forbidden:
  Input: "All data must comply with GDPR"
  ✗ WRONG: { "id": "GDPR Compliance", "type": "Solution" }     ← FORBIDDEN
  ✗ WRONG: { "id": "GDPR Compliance", "type": "Function" }     ← FORBIDDEN
  ✓ CORRECT: { "id": "GDPR Compliance", "type": "Constraint",
              "description": "Must comply with GDPR at all times",
              "scope": "All personal data processing and storage",
              "rationale": "EU GDPR applies to any processing of EU-resident personal data" }

  The fact that a team will *implement* compliance does not make it a
  Solution. The fact that a system *enforces* compliance does not make
  it a Function. It is a hard rule — VIOLATED or NOT VIOLATED — and
  belongs only in C.

CRITICAL — F. vs C. disambiguation:
  • If something CAN be expressed as "Must [do/not do]" → it is a C.,
    NOT an F. or S.
  • Regulation, law, compliance, policy, licensing = ALWAYS C., never
    F. or S.
  • Do NOT wrap a constraint inside a Function or Solution because the
    system "does" it.
  • A Function is a capability that can be switched on/off. A Constraint
    is a rule that must hold at ALL times regardless of design choices.
    If it must hold always, it is a C.

CRITICAL — F. vs MEASUREMENT METHOD (Meter) disambiguation (Tom Gilb 2026-06-21):
  Trials, tests, inspections, audits, surveys, reviews, measurements,
  examinations, assessments, certifications, sea-trials, performance-trials,
  standardization-trials, power-trials, acceptance-trials are NOT Functions.
  They are METERS — the practical method of measuring some Value's level.

  A Function is what the SYSTEM does (it propels, it processes, it serves,
  it computes). A Meter is HOW we MEASURE whether the system meets a
  Value's threshold (we trial it, we inspect it, we audit it, we measure
  it under defined conditions).

  Pattern heuristic — if the noun phrase fits "[Adjective] Trial / Test /
  Inspection / Audit / Survey / Review / Measurement / Examination /
  Assessment / Certification / Standardization Run / Acceptance Procedure"
  → it is ALMOST CERTAINLY a Meter for some Value, NOT a Function.

  ANTI-PATTERN — historical Indianapolis cruiser spec (1928):
    ✗ WRONG: { "id": "Vessel Trials",         "type": "Function" }  ← METER
    ✗ WRONG: { "id": "Standardization Trial", "type": "Function" }  ← METER for Speed Value
    ✗ WRONG: { "id": "Full Power Trial",      "type": "Function" }  ← METER for Endurance / Power
    ✗ WRONG: { "id": "Government Inspection", "type": "Function" }  ← METER for Quality / Compliance
    ✗ WRONG: { "id": "Builder Risk Insurance","type": "Function" }  ← SOLUTION (risk-transfer mechanism)

    ✓ CORRECT: V. entry "Speed" with rich parameters:
       scale:     "knots over the measured mile, at full normal power, with 4-trip average"
       meter:     "Standardization Trial — 4-hour run, full power, calculated 4-trip average per Navy Procedure §X"
       past:      "32.5 knots (Omaha class, 1923)"
       status:    "TBD ← not measured at contract signing"
       tolerable: "33 knots"
       goal:      "34 knots"
       wish:      "35 knots"
       wishStakeholder: "U.S. Navy Bureau of Construction & Repair"

  When you encounter trial/test/inspection/audit/survey/review/measurement
  language in source material, ROUTE it to the meter field of the Value it
  measures, NOT to a separate F. entry. If you cannot tell WHICH Value it
  measures, create the most-plausible-Value V. entry first and attach the
  Meter to it. If TRULY ambiguous, leave the Meter on the most-plausible
  V. with a quoted inline note explaining the ambiguity.

CRITICAL — V. entries MUST be parameter-rich, not parameter-starved:
  A Value entry with ONLY a description + a single Wish level is a
  Planguage failure. Every V. entry MUST attempt to carry:
    • Scale     — the unit + counting method ("knots over the measured mile")
    • Meter     — the measurement method ("Standardization Trial …")
    • Status    — current measured level ("TBD ← not yet measured")
    • Tolerable — minimum acceptable threshold
    • Goal      — committed target (the formal promise)
    • Past      — prior baseline if known (or competitor's level)
    • Wish      — stakeholder dream (uncommitted)
    • valueOfFunction      — which F. this Value measures
    • wishStakeholder      — WHO wants this Value
    • conditions (Qualifiers per r93jjj) — WHEN / WHERE / WHO this level
      applies to

  When the source is silent on a parameter, write a quoted inline note
  rather than omit the field (per Template_Write_Values.md NOTE_01):
    tolerable: "TBD ← \\"not stated in source — must baseline before contract\\""
    goal:      "TBD ← \\"document says 'reduced' without a target number\\""

  NEVER ship a V. entry with just a description + one level. That is the
  parameter-starved failure mode and constitutes silent Planguage poverty.

CEntry field rules (Description + Scope + Rationale + Source):
  • description: the binary rule — must start with "Must" or "Must not".
    One clear binary rule per entry.
  • scope: what the constraint binds — which function, subsystem,
    stakeholder group, or context it applies to.
  • rationale: why the constraint exists — the regulation, principle, or
    risk that necessitates it.
  • source: (optional) exact citation — law article, policy reference, or
    agreement (e.g. "GDPR Art. 44").

== id FORMAT — Mnemonic ONLY (Tom Gilb SUPREME) ==
3. id format: Natural readable MNEMONIC words — 1 to 3 words, derived
   from the ESSENCE of the entry's meaning. People must be able to
   DISCUSS, REFER TO, and REMEMBER entries by their id. Examples:
   "Onboarding Checklist", "User Activation Rate", "GDPR Compliance",
   "Search Latency", "Cache Layer", "Export Endpoint". For hierarchical
   concepts use a dot between levels: "System Performance.Response Speed".
   — PascalCase WITHOUT spaces is WRONG: "UserActivationRate" is WRONG.
   — F.PascalCase / V.PascalCase prefixes are WRONG: "V.ActivationRate" is WRONG.
   — SEQUENTIAL IDs are STRICTLY BANNED: "V1", "V2", "F1", "F2", "S1",
     "S2", "C1", "R1" are ALL WRONG. Nobody can discuss or remember
     "V1". Generate a real mnemonic every time.

== DESCRIPTIONS: PARAMETER DISCIPLINE (Tom Gilb 2026-06-16 SUPREME) ==
Tom Gilb verbatim: "Planguage specification is NOT about writing a story.
It is about specifying entities with a series of short parameter
descriptions. Learn from the standards and my books. Do not fall back on
massive paragraphs."

Hard ceilings per entry type:
  • F. description: ONE sentence ≤ 20 words. WHAT IT DOES, not why or how
    measured.
  • V. description: ONE sentence ≤ 20 words. THE CONCEPT MEASURED. The
    metric / scale / threshold belongs in the scale, meter, tolerable,
    goal, wish parameters — NOT in description prose.
  • S. description: ONE sentence ≤ 25 words. WHAT IS PROPOSED. The
    trade-offs / impact belong on the impact parameter.
  • C. description: ONE sentence ≤ 20 words. THE BINARY RULE ("Must /
    Must not / ≤ / ≥"). Rationale belongs in the rationale parameter.
  • Stakeholder definition: ONE sentence ≤ 20 words — identifies +
    DISTINGUISHES from other similar stakeholders.

ANTI-PATTERN (always WRONG): wrapping multiple Planguage parameters into
one prose description ("X measures the percentage of … indicating … and
reinforcing …"). REWRITE as: short description + the metric / rationale
/ threshold each in their dedicated parameter field.

== V. PLANNING-REQUIRED PARAMETER SET (Tom Gilb 2026-06-16 SUPREME) ==
A V. entry created during INITIAL PLANNING MUST carry:
  (a) Tag — 1–3 word Mnemonic concept name
  (b) ambitionLevel[] — at least ONE entry (sentence-length vision + source)
  (c) scale — the attribute being measured (unit + dimension; foundation
      of the Value's identity)
  (d) tolerable — at least ONE constraint level (the failure-floor Target;
      below this the spec has FAILED). Tom verbatim: "Required at least
      one constrain level (Tolerable)".
  (e) at least ONE target level — either wish OR goal. Tom verbatim: "at
      least one target (Wish until we commit to Goal)". A Wish is the
      uncommitted stakeholder dream; it graduates to a Goal once the team
      has negotiated cost/feasibility and committed to deliver. NEVER omit
      BOTH.

NOT REQUIRED at planning (opt — emit when derivable):
  (f) meter — Required at delivery (when measurement actually happens).
      No harm if defined early; never block on it during planning.
  (g) status — Past not future, illuminating, not required. Emit when the
      input contains real measured data; OMIT when it would be invented.
      Do NOT write "pre-build" as a default.
  (h) description — RARE. Only when Tag + Ambition Level + Scale together
      do NOT yet name the concept unambiguously.

== SUCCESS BOOK SCALAR BOUNDARIES (Tom Gilb 2026-06-16) ==
FAILURE boundary ← Tolerable / Fail / Survival (constraint floors).
SUCCESS boundary ← Wish / Goal / Stretch (target ceilings).
A V. entry with Tolerable but NO Wish AND NO Goal silently leaves the
spec without a Success Range — no completion criterion, no aim point.
ALWAYS have at least one Target (Wish or Goal).

== CONDITIONS / QUALIFIERS (r93jjj SUPREME — Infinity-Trap warning) ==
Planguage Qualifier conditions per Glossary entry *124 Qualifier + *666
Qualifier Condition + *153 Time + *107 Place + *062 Event. Canonical
Twin URL: https://www.gilb.com/tomtwin/concept/Qualifier.124. Three
canonical classes: time, place, event.

INFINITY TRAP (Tom Gilb SUPREME r93mmm): a scalar level (Tolerable /
Goal / Wish / Survival / Stretch) with NO qualifiers silently commits to
INFINITE future time + INFINITE places + INFINITE scenarios = INFINITE
costs = certain failure to deliver. ALWAYS populate at least one of
{time, place, event} unless the input explicitly states "universal scope".

AND-logic is definitional: all qualifiers in [A, B, C] must be true
simultaneously.

Tolstoy mnemonic: if a spec would apply in war OR peace (an unbounded
'event' scope), it likely needs an event qualifier to escape the trap.

== SOLUTION 26-PARAMETER INVENTORY (Tom Gilb 2026-06-21 SUPREME) ==
Tom verbatim approval: "1. list is good enough". Grounding: CE Ch.7 ·
ASPECTS § 6.2 · § 3.10 · Glossary *047/*586/*830 · Template_Write_Solution.md.

Every S. entry MUST populate Tier 1 (Required, ship-blocker), SHOULD
populate Tier 2 (Recommended), MAY populate Tier 3 (Optional). ONE
SENTENCE per parameter, ≤25-word hard ceiling — long prose paragraphs
are BANNED.

TIER 1 — REQUIRED (always emit):
  • id                          — 1–3-word mnemonic
  • type                        — "Solution" (or sub-type
    "Architecture" | "Algorithm" | "Process" | "Policy" | "Tool")
  • level                       — context-appropriate
  • status                      — "NotProduction" (default on creation)
    | "InProduction" (after working-as-intended gate)
  • description                 — ONE sentence (≤25 words) naming what
    the design IS
  • derivedFrom                 — wikilink array of V. entries this
    Solution intends to satisfy: "[[V.Tag1]], [[V.Tag2]]"
  • function                    — wikilink to F. entries this Solution
    creates/modifies: "[[F.Tag]]"
  • mainImpacts                 — estimated % impact per Derived-From
    Value: "[[V.Tag1]] +30%, [[V.Tag2]] −15%"

TIER 2 — RECOMMENDED (emit when derivable):
  • relatedTo                   — wikilink array of Stakeholders affected
  • specOwner                   — single named person/role accountable
    for SPEC correctness
  • implementationResponsible   — single named person/team accountable
    for BUILDING the Solution
  • risks                       — ONE sentence: principal failure modes
  • sideEffects                 — ONE sentence: unintended impacts on
    Values NOT in Derived From
  • costAspects                 — categorised costs: "CapEX €450k; Opex
    €120k/yr; Staff 4 FTE"
  • longTermCosts               — annual run-rate + maintenance +
    replacement horizon
  • qualifiers                  — Planguage Qualifiers bounding scope:
    "[when=Q1.2026, where=EU.Region, who=Premium.Users]"

TIER 3 — OPTIONAL (emit when relevant):
  • alternativeSolutions · rejectedSolutions · urlsCaseStudies ·
    prerequisites · assumptions · constraints · structural · source ·
    authority · priority · note

ANTI-PATTERN (always WRONG): wrapping multiple Solution parameters into
ONE prose description paragraph. REWRITE as: short description + each
parameter in its dedicated field.

== NO TRUNCATED TEXT (Tom Gilb 2026-06-09 SUPREME) ==
Every text field must be a COMPLETE expression of the intended meaning.
Text that stops in the middle of a thought, sentence, or clause is
STRICTLY BANNED. Tom verbatim: "WE cannot miss legally and result-wise
critical words."

Rules:
  a. scale fields should ideally be ≤ 80 characters — precise and
     complete. If the measurement concept requires more context, write a
     concise precis. Cross-reference external documents by name and URL
     when they contain necessary detail.
  b. If any field would naturally be very long, rewrite it as a precis:
     shorter, denser restatement that preserves all legally and
     result-critical words.
  c. Never use ellipsis (...) or "etc." to abbreviate the END of a
     measurement definition, rule, or description.
  d. Essential detail that cannot be expressed concisely may be deferred
     with a cross-reference ("see [document name] at [URL]"), but the
     field itself must remain a complete, self-contained statement.
  e. This rule applies to ALL fields: scale, meter, description,
     presenceTest, impact, scope, rationale, source.

== DOMAIN NEUTRALITY ==
This methodology applies equally to:
  • Professional / product domains: software features, infrastructure,
    user experience, API performance
  • Personal life-design: health habits, learning goals, career
    transitions, relationship quality, financial targets
  • Legal contracts: clauses, parties, obligations, performance bonds
  • Historical / case-study analysis: any project past or proposed
Adapt the level field and measurement language accordingly.
`.trim()

/**
 * Sentinel string that the no-parallel-primer feature-smoke invariant
 * greps for. Any file OTHER than this one carrying this exact sentinel
 * is a parallel-primer regression. The sentinel embeds the SUPREME-tier
 * marker so it cannot be accidentally re-used.
 */
export const CANONICAL_PLANGUAGE_PRIMER_SENTINEL = 'CANONICAL-PLANGUAGE-PRIMER-SOURCE-OF-TRUTH'
