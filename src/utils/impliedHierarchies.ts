/**
 * impliedHierarchies.ts — Rule-based "implied entries" lookup table.
 *
 * PURPOSE
 * ───────
 * After the parser classifies a user's raw text into stakeholders / values /
 * means, this module inspects those chips and proposes ADDITIONAL entries the
 * user did not explicitly type but which are strongly implied by domain
 * knowledge. This is "Tier 1" of Advanced Parsing (table-derived). A future
 * Tier 2 will use an LLM for open-ended suggestions.
 *
 * STRUCTURE
 * ─────────
 * Each ImpliedRule has:
 *   triggers  — patterns (RegExp) matched against chips in a given group.
 *               A rule fires when AT LEAST ONE trigger matches (OR logic).
 *               Multiple triggers in the same rule share the same suggestions.
 *   suggest   — entries to propose when the rule fires. Already-present chips
 *               are filtered out by computeImpliedEntries() before display.
 *
 * DESIGN PRINCIPLE
 * ────────────────
 * Rules are ADDITIVE: they never remove user entries, only propose extras.
 * The suggestions are displayed in the ImpliedEntriesPanel with a clear
 * "this is a suggestion, not a fact" framing. Users accept with [+] or ignore.
 *
 * All field names are lowercase / natural-language to match SEM App chip format.
 *
 * Tom 2026-05-17: "How is it going with my request earlier today for advanced
 * parsing?" — this is the implementation of that request.
 */

export type SugGroup = 'stakeholders' | 'values' | 'means'

export interface ImpliedSuggestion {
  group: SugGroup
  text: string
  /** Brief reason shown as a HoverHint / sub-label in the panel. */
  why: string
}

export interface ImpliedRule {
  id: string
  triggers: { group: SugGroup; pattern: RegExp }[]
  suggest: ImpliedSuggestion[]
}

// ── Helper to build regex from an array of keywords ──────────────────────────
function kw(...words: string[]): RegExp {
  return new RegExp(`\\b(?:${words.join('|')})\\b`, 'i')
}

// ─────────────────────────────────────────────────────────────────────────────
// RULES
// Grouped by domain / theme. Each rule.id is globally unique.
// ─────────────────────────────────────────────────────────────────────────────
export const IMPLIED_RULES: ImpliedRule[] = [

  // ── AI / Machine Learning ─────────────────────────────────────────────────
  {
    id: 'ai-means-to-values',
    triggers: [
      { group: 'means', pattern: kw('ai', 'artificial intelligence', 'machine learning', 'ml', 'llm', 'nlp', 'chatbot', 'automation', 'algorithm') },
    ],
    suggest: [
      { group: 'values',       text: 'time saved per task',         why: 'AI-driven automation reduces manual effort' },
      { group: 'values',       text: 'accuracy rate',               why: 'AI quality must be measurable' },
      { group: 'values',       text: 'false positive rate',         why: 'AI errors are a critical constraint' },
      { group: 'stakeholders', text: 'data',                        why: 'data is a stakeholder in every AI system (GDPR, quality)' },
      { group: 'stakeholders', text: 'regulator',                   why: 'AI regulation (EU AI Act, GDPR) is a stakeholder' },
      { group: 'means',        text: 'training data pipeline',      why: 'AI systems require data preparation' },
    ],
  },

  // ── Engineering / Developer productivity ─────────────────────────────────
  {
    id: 'engineer-stakeholder',
    triggers: [
      { group: 'stakeholders', pattern: kw('engineer', 'engineers', 'developer', 'developers', 'dev', 'devs', 'programmer', 'programmers', 'coder', 'coders', 'sde', 'sdes') },
    ],
    suggest: [
      { group: 'values',       text: 'deployment frequency',        why: 'core DORA metric for engineering performance' },
      { group: 'values',       text: 'lead time for changes',       why: 'DORA metric — time from commit to production' },
      { group: 'values',       text: 'developer experience score',  why: 'measures how productive and satisfied engineers are' },
      { group: 'values',       text: 'mean time to recover',        why: 'DORA metric — resilience of the engineering org' },
      { group: 'stakeholders', text: 'codebase',                    why: 'the codebase has fitness requirements (inanimate stakeholder)' },
    ],
  },

  // ── Customer / User experience ────────────────────────────────────────────
  {
    id: 'customer-stakeholder',
    triggers: [
      { group: 'stakeholders', pattern: kw('customer', 'customers', 'user', 'users', 'client', 'clients', 'buyer', 'buyers', 'shopper', 'shoppers') },
    ],
    suggest: [
      { group: 'values',       text: 'net promoter score',          why: 'canonical measure of customer loyalty' },
      { group: 'values',       text: 'churn rate',                  why: 'customer retention is a key value' },
      { group: 'values',       text: 'support ticket volume',       why: 'indicates friction in the customer journey' },
      { group: 'values',       text: 'onboarding completion rate',  why: 'first-use success drives long-term retention' },
    ],
  },

  // ── Revenue / Business growth ─────────────────────────────────────────────
  {
    id: 'revenue-values',
    triggers: [
      { group: 'values', pattern: kw('revenue', 'profit', 'growth', 'sales', 'mrr', 'arr', 'income', 'earnings') },
    ],
    suggest: [
      { group: 'values',       text: 'conversion rate',             why: 'revenue depends on prospect-to-customer conversion' },
      { group: 'values',       text: 'average order value',         why: 'unit economics driver for revenue' },
      { group: 'values',       text: 'customer lifetime value',     why: 'long-run revenue metric — LTV' },
      { group: 'stakeholders', text: 'investor',                    why: 'investors have direct interest in revenue metrics' },
      { group: 'stakeholders', text: 'shareholder',                 why: 'shareholders measure revenue performance' },
    ],
  },

  // ── Healthcare / Patient care ──────────────────────────────────────────────
  {
    id: 'patient-stakeholder',
    triggers: [
      { group: 'stakeholders', pattern: kw('patient', 'patients', 'clinician', 'clinicians', 'doctor', 'doctors', 'nurse', 'nurses', 'hospital', 'hospitals') },
    ],
    suggest: [
      { group: 'values',       text: 'patient safety rate',         why: 'primary outcome in healthcare — harm avoidance' },
      { group: 'values',       text: 'wait time',                   why: 'key quality measure in clinical settings' },
      { group: 'values',       text: 'care quality score',          why: 'aggregate measure of clinical effectiveness' },
      { group: 'stakeholders', text: 'regulator',                   why: 'healthcare is heavily regulated (CQC, FDA, NHS)' },
      { group: 'stakeholders', text: 'insurance',                   why: 'insurance is a stakeholder in every clinical pathway' },
      { group: 'means',        text: 'clinical protocol',           why: 'standardised protocols reduce variance in care' },
    ],
  },

  // ── Education / Learning ─────────────────────────────────────────────────
  {
    id: 'student-stakeholder',
    triggers: [
      { group: 'stakeholders', pattern: kw('student', 'students', 'learner', 'learners', 'pupil', 'pupils', 'teacher', 'teachers') },
    ],
    suggest: [
      { group: 'values',       text: 'learning outcome rate',       why: 'primary measure of educational effectiveness' },
      { group: 'values',       text: 'course completion rate',      why: 'retention and engagement metric in education' },
      { group: 'values',       text: 'assessment pass rate',        why: 'formal success criterion in learning programmes' },
      { group: 'stakeholders', text: 'parent',                      why: 'parents are key stakeholders in education' },
      { group: 'stakeholders', text: 'curriculum',                  why: 'curriculum has fitness requirements (inanimate stakeholder)' },
    ],
  },

  // ── Environment / Sustainability ─────────────────────────────────────────
  {
    id: 'environment-stakeholder',
    triggers: [
      { group: 'stakeholders', pattern: kw('world', 'environment', 'ecosystem', 'nature', 'planet', 'earth', 'climate', 'biosphere') },
      { group: 'values',       pattern: kw('sustainability', 'carbon', 'emissions', 'footprint', 'green', 'renewable', 'world') },
    ],
    suggest: [
      { group: 'values',       text: 'carbon emissions per unit',   why: 'quantifiable environmental impact metric' },
      { group: 'values',       text: 'energy consumption rate',     why: 'upstream driver of environmental impact' },
      { group: 'values',       text: 'waste reduction rate',        why: 'circular economy performance metric' },
      { group: 'stakeholders', text: 'regulator',                   why: 'environmental regulations are a primary stakeholder' },
      { group: 'stakeholders', text: 'future generations',          why: 'climate decisions bind future stakeholders' },
    ],
  },

  // ── Finance / FinTech ────────────────────────────────────────────────────
  {
    id: 'finance-values',
    triggers: [
      { group: 'values',       pattern: kw('cost', 'expense', 'budget', 'spend', 'investment', 'roi', 'payback') },
      { group: 'stakeholders', pattern: kw('investor', 'investors', 'lender', 'lenders', 'banker', 'bankers') },
    ],
    suggest: [
      { group: 'values',       text: 'return on investment',        why: 'primary financial decision metric' },
      { group: 'values',       text: 'cost per unit',               why: 'unit economics measure efficiency' },
      { group: 'values',       text: 'payback period',              why: 'time to recover investment' },
      { group: 'stakeholders', text: 'auditor',                     why: 'auditors review financial decisions' },
      { group: 'stakeholders', text: 'regulator',                   why: 'financial regulation is a primary compliance stake' },
    ],
  },

  // ── Security / Compliance ────────────────────────────────────────────────
  {
    id: 'security-means',
    triggers: [
      { group: 'means',        pattern: kw('security', 'encryption', 'auth', 'authentication', 'gdpr', 'compliance', 'audit') },
      { group: 'values',       pattern: kw('security', 'compliance', 'privacy', 'confidentiality', 'integrity') },
    ],
    suggest: [
      { group: 'values',       text: 'breach rate',                 why: 'core security success metric' },
      { group: 'values',       text: 'mean time to detect',         why: 'security incident detection speed' },
      { group: 'values',       text: 'compliance audit pass rate',  why: 'regulatory compliance is binary per period' },
      { group: 'stakeholders', text: 'data',                        why: 'data is a stakeholder in every security system' },
      { group: 'stakeholders', text: 'regulator',                   why: 'GDPR / HIPAA / ISO regulators are stakeholders' },
    ],
  },

  // ── OKR / agile methodology as means ────────────────────────────────────
  {
    id: 'okr-means',
    triggers: [
      { group: 'means', pattern: kw('okr', 'okrs', 'agile', 'scrum', 'kanban', 'lean', 'sprint', 'retrospective') },
    ],
    suggest: [
      { group: 'values',       text: 'goal achievement rate',       why: 'OKRs only work if outcomes are measured' },
      { group: 'values',       text: 'team alignment score',        why: 'shared OKRs require aligned understanding' },
      { group: 'stakeholders', text: 'team',                        why: 'the team owns the OKR execution' },
      { group: 'stakeholders', text: 'manager',                     why: 'managers set and review OKR targets' },
    ],
  },

  // ── Product / UX ─────────────────────────────────────────────────────────
  {
    id: 'product-means',
    triggers: [
      { group: 'means',        pattern: kw('product', 'feature', 'roadmap', 'mvp', 'prototype', 'design', 'ux', 'ui') },
      { group: 'stakeholders', pattern: kw('designer', 'designers', 'product manager', 'pm', 'pms') },
    ],
    suggest: [
      { group: 'values',       text: 'feature adoption rate',       why: 'measures whether the product delivers value' },
      { group: 'values',       text: 'time-to-market',              why: 'speed of delivering the product to users' },
      { group: 'values',       text: 'usability score',             why: 'UX quality affects adoption and retention' },
      { group: 'stakeholders', text: 'user',                        why: 'users are always a stakeholder in product decisions' },
    ],
  },

  // ── Infrastructure / Systems ──────────────────────────────────────────────
  {
    id: 'infra-means',
    triggers: [
      { group: 'means',        pattern: kw('infrastructure', 'cloud', 'server', 'database', 'platform', 'kubernetes', 'docker', 'devops', 'ci/cd', 'pipeline') },
      { group: 'stakeholders', pattern: kw('sre', 'sres', 'sysadmin', 'sysadmins', 'devops') },
    ],
    suggest: [
      { group: 'values',       text: 'system uptime',               why: 'availability is a foundational SRE SLO' },
      { group: 'values',       text: 'latency p95',                 why: 'percentile latency measures real user experience' },
      { group: 'values',       text: 'error rate',                  why: 'failure frequency is a core reliability metric' },
      { group: 'stakeholders', text: 'system',                      why: 'the system has fitness and reliability requirements' },
    ],
  },

  // ── Family / personal wellbeing ──────────────────────────────────────────
  {
    id: 'family-stakeholder',
    triggers: [
      { group: 'stakeholders', pattern: kw('family', 'families', 'parent', 'parents', 'child', 'children', 'spouse', 'spouses') },
    ],
    suggest: [
      { group: 'values',       text: 'family time per week',        why: 'quality time is a measurable wellbeing outcome' },
      { group: 'values',       text: 'stress level',                why: 'health and wellbeing have physical indicators' },
      { group: 'values',       text: 'work-life balance score',     why: 'balance is a compound wellbeing Value' },
    ],
  },

  // ── Data / database as stakeholder ────────────────────────────────────────
  {
    id: 'data-stakeholder',
    triggers: [
      { group: 'stakeholders', pattern: kw('data', 'database', 'databases') },
    ],
    suggest: [
      { group: 'values',       text: 'data accuracy rate',          why: 'data quality is a primary fitness requirement' },
      { group: 'values',       text: 'data availability',           why: 'data must be accessible when needed' },
      { group: 'values',       text: 'GDPR compliance rate',        why: 'data compliance is a binary Constraint' },
      { group: 'stakeholders', text: 'regulator',                   why: 'GDPR / data protection regulators are stakeholders' },
    ],
  },

  // ── Operational efficiency / speed ───────────────────────────────────────
  {
    id: 'efficiency-values',
    triggers: [
      { group: 'values', pattern: kw('efficiency', 'speed', 'fast', 'faster', 'quick', 'rapid', 'throughput', 'productivity') },
    ],
    suggest: [
      { group: 'values',       text: 'cycle time',                  why: 'elapsed time from start to finish of a unit of work' },
      { group: 'values',       text: 'throughput per day',          why: 'volume of work completed in a time period' },
      { group: 'values',       text: 'utilisation rate',            why: 'proportion of capacity actively used' },
    ],
  },

  // ── Quality / reliability ─────────────────────────────────────────────────
  {
    id: 'quality-values',
    triggers: [
      { group: 'values', pattern: kw('quality', 'reliable', 'reliability', 'defect', 'bug', 'error', 'rework', 'accuracy') },
    ],
    suggest: [
      { group: 'values',       text: 'defect rate per release',     why: 'direct measure of output quality' },
      { group: 'values',       text: 'test coverage rate',          why: 'proxy for code quality robustness' },
      { group: 'values',       text: 'customer complaints per 1000', why: 'market-facing quality signal' },
    ],
  },

  // ── World / global as stakeholder ────────────────────────────────────────
  // Tom 2026-05-17: "train the parser to find at least one implied or explicit
  // (to the world) and put it in the stakeholder category."
  // This rule fires on BOTH the stakeholder group (when the parser already
  // extracted "world" / "humanity" as a chip) AND the value group (when
  // universal-scope language ends up in a value chip, e.g. "joy to the world"
  // → value:"joy", stakeholder:"world" — but also if the whole phrase "joy to
  // the world" landed in values, the values trigger still fires).
  {
    id: 'world-stakeholder',
    triggers: [
      { group: 'stakeholders', pattern: kw('world', 'globe', 'global', 'society', 'humanity', 'humankind', 'mankind', 'public', 'population', 'everyone', 'everybody', 'people', 'civilization', 'civilisation') },
      // Also fire when universal-scope words appear inside value chips.
      { group: 'values',       pattern: kw('world', 'everyone', 'everybody', 'humanity', 'global', 'universal', 'society', 'civilization', 'civilisation', 'mankind', 'humankind') },
    ],
    suggest: [
      { group: 'stakeholders', text: 'All people / Humanity',       why: 'Universal/world-scope language implies the widest stakeholder group' },
      { group: 'stakeholders', text: 'future generations',          why: 'Decisions at world scope bind future stakeholders' },
      { group: 'values',       text: 'societal impact score',       why: 'Broad stakeholders need broad impact metrics' },
      { group: 'stakeholders', text: 'regulator',                   why: 'World-scope decisions are regulated globally' },
      { group: 'values',       text: 'accessibility rate',          why: 'Global stakeholders require universal access' },
    ],
  },

  // ── Universal quality-of-life values → implied human stakeholders ─────────
  // When values contain words like "joy", "happiness", "wellbeing",
  // "peace", "freedom" — quality-of-life language that inherently implies
  // a human (or even all-human) beneficiary — suggest the broadest
  // stakeholder group and a measurement approach.
  // Tom 2026-05-17: "joy to the world" — the universal beneficiary is implied
  // even when not stated.  CE: "if you do not say who, assume everyone."
  {
    id: 'universal-beneficiary',
    triggers: [
      { group: 'values', pattern: kw('joy', 'happiness', 'wellbeing', 'well-being', 'flourishing', 'prosperity', 'peace', 'freedom', 'liberation', 'dignity', 'welfare', 'love', 'harmony', 'fulfilment', 'fulfillment', 'thriving') },
    ],
    suggest: [
      { group: 'stakeholders', text: 'All people / Humanity',       why: 'Universal quality-of-life values imply the widest beneficiary group' },
      { group: 'stakeholders', text: 'future generations',          why: 'These values matter across time — not just today\'s generation' },
      { group: 'values',       text: 'wellbeing score',             why: 'Measure overall human flourishing (e.g. Cantril ladder, WHO-5)' },
      { group: 'values',       text: 'equitable access rate',       why: 'Universal goals require equitable distribution' },
    ],
  },

]

// ─────────────────────────────────────────────────────────────────────────────
// computeImpliedEntries
// ─────────────────────────────────────────────────────────────────────────────

export interface ImpliedEntry extends ImpliedSuggestion {
  /** Which rule produced this suggestion (for debugging). */
  ruleId: string
}

/**
 * Given the current parsed chips, return all suggested additional entries.
 * Filters out suggestions whose text is already in the chips (case-insensitive).
 * Deduplicates by (group, lower-cased text) — same suggestion from multiple rules
 * appears only once (first rule's `why` is used).
 *
 * @param chips   The current chips from the review stage.
 * @returns       Deduplicated list of implied entries, not yet in the chips.
 */
export function computeImpliedEntries(chips: {
  stakeholders: string[]
  values: string[]
  means: string[]
}): ImpliedEntry[] {
  const existing = {
    stakeholders: new Set(chips.stakeholders.map(s => s.toLowerCase())),
    values:       new Set(chips.values.map(s => s.toLowerCase())),
    means:        new Set(chips.means.map(s => s.toLowerCase())),
  }

  const seen = new Map<string, ImpliedEntry>()  // dedup key → first entry

  for (const rule of IMPLIED_RULES) {
    // Check if any trigger fires
    const fired = rule.triggers.some(trigger => {
      const list = chips[trigger.group]
      return list.some(chip => trigger.pattern.test(chip))
    })
    if (!fired) continue

    for (const sug of rule.suggest) {
      const key = `${sug.group}:${sug.text.toLowerCase()}`
      // Skip if already in chips
      if (existing[sug.group].has(sug.text.toLowerCase())) continue
      // Skip if we already have this suggestion from another rule
      if (seen.has(key)) continue
      seen.set(key, { ...sug, ruleId: rule.id })
    }
  }

  return [...seen.values()]
}
