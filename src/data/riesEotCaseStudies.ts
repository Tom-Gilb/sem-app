// UNIT_TYPE=Data
// riesEotCaseStudies.ts — Real-world Employee Ownership Trust (EOT) case
// studies from Common Trust (commontrust.com), added by Tom Gilb 2026-06-30.
//
// Source: 5 - Project/SEM App/assets/INCORRUPTIBLE AGENTS INPUTS/
//         Case Studies: Exiting with Employee Ownership & EOTs • Common Trust.pdf
//
// v414 (Tom Gilb 2026-07-01 verbatim "please integrate them into the
// incorruptible agent"): every finding the Incorruptible Agent emits about
// "your plan lacks a governance fortress" / "no mission-lock vehicle" / "no
// structural mission protection" can now cite these real, dated,
// industry-diverse implementations as EXISTENCE PROOF that structural mission
// protection is not theoretical — it's what these companies chose in the last
// 12 months.  EOTs are one specific realisation of the Glossary's
// "governance-fortress" / "mission-lock-vehicle" / "steward-ownership"
// / "aligned-cap-tables" principles.
//
// Composes with:
//   - riesGlossary.ts — the terms these case studies illustrate
//   - Conjunction-of-Technologies SUPREME — (b) Gilb/Ries corpus + (d) Internet
//     evidence, materialised as one artefact the agent can cite
//   - AI-Max SUPREME — every "you have no mission-lock vehicle" finding now
//     carries an actionable next step (visit commontrust.com; look at
//     Text-Em-All if you're SaaS-shaped)
//   - Twin portability — pure TS module; ports verbatim to Kai's Twin

/** A single Common-Trust-published EOT transition case study. */
export interface EotCaseStudy {
  /** Slug — kebab-case, unique per company.  Used as React-key / URL fragment. */
  slug:         string
  /** Trading name of the company at transition. */
  company:      string
  /** Month + year the transition (or the case-study publication) is dated. */
  month:        string
  /** Machine-readable date (first-of-month approximation). */
  isoMonth:     string   // 'YYYY-MM'
  /** Industry / sector — used by the agent to match against a spec's stakeholders + values. */
  industry:     string
  /** Ries Glossary slugs this case study illustrates (from riesGlossary.ts).
   *  Enables the agent to surface a case study whenever a finding invokes any
   *  of these terms as evidence-anchor / positive example. */
  illustrates:  readonly string[]
  /** Short headline (verbatim / near-verbatim from the case-study index page). */
  headline:     string
  /** One-line "why this matters" summary — what the transition unlocked. */
  outcome:      string
}

/** The 6 canonical case studies (the "Page 1 of 1" cohort at publication time). */
export const EOT_CASE_STUDIES: readonly EotCaseStudy[] = [
  {
    slug: 'guidon',
    company: 'Guidon',
    month: 'February 2026',
    isoMonth: '2026-02',
    industry: 'Consulting (Indiana)',
    illustrates: ['governance-fortress', 'mission-lock-vehicle', 'steward-ownership', 'structural-integrity'],
    headline: "Becoming Indiana's First Employee Ownership Trust (EOT)",
    outcome:  "Protected independence, broadened financial benefit to employees, and carried forward a founder's vision for a long-term legacy in a consolidating industry.",
  },
  {
    slug: 'cypress-valley',
    company: 'Cypress Valley Meat Company',
    month: 'December 2025',
    isoMonth: '2025-12',
    industry: 'Meat processing (essential industry)',
    illustrates: ['culture-bank', 'coherence', 'aligned-cap-tables', 'steward-ownership'],
    headline: 'Building Employee Ownership in an Essential Industry',
    outcome:  'Strengthened culture, improved stability, and shared success across the workforce.',
  },
  {
    slug: 'the-ready',
    company: 'The Ready',
    month: 'November 2025',
    isoMonth: '2025-11',
    industry: 'Organizational design consultancy',
    illustrates: ['coherence', 'aligned-cap-tables', 'mission-lock-vehicle', 'alignment-method'],
    headline: 'Turning Operating Principles into Ownership',
    outcome:  'Aligned ownership structure with how it already operated — protecting independence, sharing profits, strengthening employee ownership.',
  },
  {
    slug: 'text-em-all',
    company: 'Text-Em-All',
    month: 'August 2025',
    isoMonth: '2025-08',
    industry: 'SaaS (first EOT SaaS in the U.S.)',
    illustrates: ['governance-fortress', 'mission-lock-vehicle', 'perpetual-purpose-trust', 'steward-ownership'],
    headline: 'Becoming the First EOT SaaS Company in the U.S.',
    outcome:  'Chose an EOT over other exit paths — became the first SaaS company in the U.S. to transition to 100% employee ownership through an EOT.',
  },
  {
    slug: 'codeweavers',
    company: 'CodeWeavers',
    month: 'July 2025',
    isoMonth: '2025-07',
    industry: 'Open-source software',
    illustrates: ['mission-controlled-company', 'coherence', 'harder-is-easier-mission', 'ethos'],
    headline: 'Preserving Open-Source Values with an Employee Ownership Trust',
    outcome:  "Exited on their terms — preserving values, empowering employees, and building a future-ready business.",
  },
  {
    slug: 'clegg-auto',
    company: 'Clegg Auto',
    month: 'June 2025',
    isoMonth: '2025-06',
    industry: 'Auto services',
    illustrates: ['steward-ownership', 'human-flourishing', 'virtuous-performance-cycle', 'coherence'],
    headline: 'Driving Growth with Employee Ownership',
    outcome:  'Doubled profits, increased pay, and ensured a future of success.',
  },
] as const

/** Publisher metadata for the case-study cohort. */
export const EOT_CASE_STUDIES_META = Object.freeze({
  publisher:    'Common Trust',
  publisherOrg: 'Good Ancestor Technologies, Inc.',
  url:          'https://commontrust.com/',
  bookletTitle: 'Case Studies · Exiting with Employee Ownership & EOTs',
  publishedYear: 2026,
  address:      '548 Market St, San Francisco, CA 94104',
})

/**
 * Return the case studies whose `illustrates` intersect the requested slugs.
 * Used by the agent: given a finding invoking `governance-fortress`, surface
 * Guidon + Text-Em-All as evidence-anchor positive examples.
 */
export function eotCasesFor(termSlugs: readonly string[]): EotCaseStudy[] {
  const wanted = new Set(termSlugs)
  return EOT_CASE_STUDIES.filter(c => c.illustrates.some(s => wanted.has(s)))
}
