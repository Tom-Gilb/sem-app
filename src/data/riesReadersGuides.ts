// UNIT_TYPE=Data
// riesReadersGuides.ts — 5 role-specific Reader's Guides to Ries's
// *Incorruptible*, added by Tom Gilb 2026-07-01.
//
// Source folder: 5 - Project/SEM App/assets/INCORRUPTIBLE AGENTS INPUTS/
//                Guides Incorruptible/
// Author:        Eric Ries, in consultation with Virgil PBC (tryvirgil.com)
// Version:       v1.0 · 26 May 2026
// License:       CC BY-NC-SA 4.0
//
// v414 (Tom Gilb 2026-07-01 verbatim "please integrate them into the
// incorruptible agent"): the guides transform the Incorruptible Agent from a
// single-lens analyzer into a ROLE-AWARE analyzer.  A Founder reviewing a plan
// wants different guidance than a Board Director reviewing the same plan;
// this module makes that first-class.
//
// Composes with:
//   - riesGlossary.ts        — the shared dictionary all guides use
//   - riesEotCaseStudies.ts  — the guides cite real-world implementations
//   - Stakeholder Engineering (Gilb) — role-role-role framing pairs with Gilb's
//     Stakeholder discipline
//   - AI-Max SUPREME — role-specific action items are the highest-leverage AI
//     assistance surface
//   - Twin portability — role picker + guide URLs port cleanly to Kai's Twin

/** The 5 planner-roles for which Ries authored a dedicated Reader's Guide. */
export type PlannerRole =
  | 'founder'
  | 'investor'
  | 'employee'
  | 'consumer'
  | 'board-director'

/** Metadata for one role's Reader's Guide. */
export interface ReadersGuide {
  role:            PlannerRole
  /** Display label. */
  label:           string
  /** Emoji or short glyph string, canonical Icon-Plus-Text SUPREME compliance. */
  glyph:           string
  /** Filename inside the `Guides Incorruptible/` folder. */
  filename:        string
  /** Absolute vault path — for `open` invocations from an outer shell. */
  vaultPath:       string
  /** The primary lens Ries writes through for this role. */
  primaryLens:     string
  /** Top glossary slugs this role's guide leans on most heavily. */
  keyGlossaryTerms: readonly string[]
  /** One-paragraph flavor / calling from Ries's own text. */
  callingParagraph: string
}

const GUIDES_FOLDER =
  '/Users/Tomgilbs/Documents/MyVault/5 - Project/SEM App/assets/INCORRUPTIBLE AGENTS INPUTS/Guides Incorruptible'

export const READERS_GUIDES: readonly ReadersGuide[] = [
  {
    role: 'founder',
    label: 'Founder',
    glyph: '🌱',
    filename: 'Incorruptible Readers Guide for Founders v1.0 26MAY2026.pdf',
    vaultPath: `${GUIDES_FOLDER}/Incorruptible Readers Guide for Founders v1.0 26MAY2026.pdf`,
    primaryLens: 'The window (open at incorporation, closing at first outside capital) + the ripple (your choices change other founders\' term sheets)',
    keyGlossaryTerms: ['governance-fortress', 'mission-lock-vehicle', 'perpetual-purpose-trust', 'coherence', 'harder-is-easier-mission', 'dual-class-shares'],
    callingParagraph: 'You have something almost no one else in the economy has: a window. Inside that window, the structural decisions you make are an order of magnitude cheaper than they will ever be again. Ripple: when you build an incorruptible company, you change what is possible for the founder you will inspire two years from now.',
  },
  {
    role: 'investor',
    label: 'Investor',
    glyph: '💼',
    filename: 'Incorruptible Readers Guide for Investors v1.0 - 26MAY2026.pdf',
    vaultPath: `${GUIDES_FOLDER}/Incorruptible Readers Guide for Investors v1.0 - 26MAY2026.pdf`,
    primaryLens: 'Career equity vs mission alignment · Term-sheet architecture · The governance class',
    keyGlossaryTerms: ['career-equity', 'governance-class', 'shareholder-primacy', 'fiduciary-duty', 'activist-investor', 'sunset-provision'],
    callingParagraph: 'The interlocking network of investors and the bankers, lawyers, directors, advisors, and academics who serve them — that is the governance class you are already inside. The question is whether your career equity aligns with the mission of the companies you fund, or opposes it.',
  },
  {
    role: 'employee',
    label: 'Employee',
    glyph: '🔥',
    filename: 'Incorruptible Readers Guide for Employees v1.0 - 26MAY2026.pdf',
    vaultPath: `${GUIDES_FOLDER}/Incorruptible Readers Guide for Employees v1.0 - 26MAY2026.pdf`,
    primaryLens: 'Torchbearer discipline · Moral injury · Culture bank (only-deposits rule)',
    keyGlossaryTerms: ['torchbearer', 'moral-injury', 'culture-bank', 'ethos', 'invisible-leader', 'coherence'],
    callingParagraph: 'A torchbearer is the unheralded employee who relentlessly upholds the organization\'s mission even when no one is watching. Todd Park\'s "only deposits" culture bank rule gives institutional backing to torchbearers by empowering push-back against trust-damaging shortcuts.',
  },
  {
    role: 'consumer',
    label: 'Consumer',
    glyph: '🛒',
    filename: 'Incorruptible Readers Guide for Consumers v1.0 - 26MAY2026.pdf',
    vaultPath: `${GUIDES_FOLDER}/Incorruptible Readers Guide for Consumers v1.0 - 26MAY2026.pdf`,
    primaryLens: 'Enshittification detection · Buying power as mission-transmission · Citizens of the republic',
    keyGlossaryTerms: ['enshittification', 'citizens-of-the-republic', 'mission-transmission', 'transmission-multipliers', 'vanity-metrics', 'false-proxies'],
    callingParagraph: 'Enshittification (Cory Doctorow): the slow, deliberate degradation of a product or service once the company owning it has captured enough customers to extract more from them than it delivers. As a consumer, you are one of the citizens of the republic — your buying decisions are transmission multipliers.',
  },
  {
    role: 'board-director',
    label: 'Board Director',
    glyph: '⚖️',
    filename: 'Incorruptible Readers Guide for Board Directors v1.0 - 26MAY2026.pdf',
    vaultPath: `${GUIDES_FOLDER}/Incorruptible Readers Guide for Board Directors v1.0 - 26MAY2026.pdf`,
    primaryLens: 'Trustee framing · Director\'s oath · Fiduciary duty in mission-controlled companies',
    keyGlossaryTerms: ['trustee', 'directors-oath', 'fiduciary-duty', 'mission-guardian', 'constitutional-governance', 'holistic-metrics'],
    callingParagraph: 'In the older legal conception, the party charged with protecting and preserving property for the benefit of beneficiaries. The board was seen as a trustee of the corporation itself, obligated to pursue the corporation\'s long-term prosperity and survival, avoiding self-dealing or conflicts of interest.',
  },
] as const

/** O(1) lookup by role. */
export const READERS_GUIDE_BY_ROLE: Record<PlannerRole, ReadersGuide> =
  Object.freeze(Object.fromEntries(READERS_GUIDES.map(g => [g.role, g]))) as Record<PlannerRole, ReadersGuide>

/** localStorage key for the planner-role selection.  Persists across sessions. */
export const PLANNER_ROLE_STORAGE_KEY = 'incorruptible-planner-role'

/** Default role when the planner has not yet chosen — Founder matches the SEM App
 *  typical user (someone building/planning, not reviewing from a board seat). */
export const DEFAULT_PLANNER_ROLE: PlannerRole = 'founder'

/**
 * Load the persisted planner role, returning DEFAULT_PLANNER_ROLE on miss / any
 * localStorage error (SSR safety + private-mode safety).
 */
export function loadPlannerRole(): PlannerRole {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PLANNER_ROLE_STORAGE_KEY) : null
    if (!raw) return DEFAULT_PLANNER_ROLE
    return (READERS_GUIDE_BY_ROLE[raw as PlannerRole] ? (raw as PlannerRole) : DEFAULT_PLANNER_ROLE)
  } catch {
    return DEFAULT_PLANNER_ROLE
  }
}

/** Persist the planner role.  No-op on localStorage error. */
export function savePlannerRole(role: PlannerRole): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PLANNER_ROLE_STORAGE_KEY, role)
  } catch {
    // ignore
  }
}
