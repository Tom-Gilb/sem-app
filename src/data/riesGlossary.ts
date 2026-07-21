// UNIT_TYPE=Data
// riesGlossary.ts — Canonical vocabulary from Eric Ries, *Incorruptible: Why Good
// Companies Go Bad… and How Great Companies Stay Great* (2026).
//
// Source: 5 - Project/SEM App/assets/INCORRUPTIBLE AGENTS INPUTS/Incorruptible
//         Glossary.pdf (added by Tom Gilb 2026-07-01).
//
// v414 (Tom Gilb 2026-07-01 verbatim: "I added incorruptible glossary to assets
// and one other thing, please integrate them into the incorruptible agent"):
// this module is the SINGLE SOURCE OF TRUTH for Ries terminology inside the
// Incorruptible Agent.  Every `riesCitation` field the agent emits, every
// tooltip on a finding chip, every AI prompt vocabulary declaration MUST route
// through here — never paraphrase, never re-word.
//
// The 55 terms are grouped into 6 categories that mirror the Ries Figure 5.1
// four-pillar framework (Purpose / Coherence / Integrity / Compliance) plus
// two operational categories (Metrics-and-measurement + Governance-vehicles):
//   - purpose       — Mission, Ethos, Human flourishing, Purpose, …
//   - coherence     — Coherence, Culture bank, Alignment method, Leader's guide, …
//   - integrity     — Structural integrity, Governance fortress, Magnetic powers, …
//   - compliance    — Crystal clarity, Independent verification, Aligned consequences, …
//   - measurement   — Holistic metrics, Vanity metrics, Surrogation, False proxies, …
//   - governance    — Mission-lock vehicle, Perpetual purpose trust, Steward ownership, …
//   - failure-modes — Corruption, Deferred liabilities, Enshittification, Moral injury, …
//   - external      — Activist investor, Shareholder primacy, Governance class, …
//
// Composes with:
//   - Conjunction-of-Technologies SUPREME — this is the (b) Gilb/Ries-corpus layer
//     materialised as a data module the Incorruptible Agent can lookup + cite verbatim.
//   - Canonical Planguage Extractor pattern (r41 v270 SUPREME) — single primer file,
//     imported by every prompt.  riesGlossary.ts is the Ries equivalent for
//     Incorruptible AI prompts.
//   - Spell-out-Type-Names SUPREME — plain English full terms, never abbreviations.
//   - Twin portability — pure TS module; no Vue reactivity; ports verbatim to Kai's Twin.
//
// Full source MD (with definitions preserved verbatim from the PDF):
//   <user-home>/.claude/projects/-Users-Tomgilbs-Documents-MyVault/memory/
//   ries-incorruptible-rules/05-glossary-2026-07-01.md

/** The 8 Ries categories the Incorruptible Agent maps its findings to. */
export type RiesGlossaryCategory =
  | 'purpose'
  | 'coherence'
  | 'integrity'
  | 'compliance'
  | 'measurement'
  | 'governance'
  | 'failure-modes'
  | 'external'

/** One glossary entry — canonical Ries term + verbatim short definition. */
export interface RiesGlossaryEntry {
  /** Canonical Ries term, exactly as written in the book (Title Case as appropriate). */
  term:        string
  /** Short slug — kebab-case, used for stable lookup + URL fragments. */
  slug:        string
  /** Verbatim definition from the Incorruptible Glossary PDF (Ries's own words, condensed
   *  only where the PDF text carried inline whitespace artefacts). ≤ ~200 words. */
  definition:  string
  /** Which Figure-5.1-anchored category this term primarily lives in. */
  category:    RiesGlossaryCategory
  /** Optional origin attribution when Ries credits another author for the coinage. */
  coinedBy?:   string
}

/** The 55 canonical terms.  Order is roughly alphabetical (matches the PDF layout)
 *  so a future glossary browser can render straight-through. */
export const RIES_GLOSSARY: readonly RiesGlossaryEntry[] = [
  { term: 'Activist investor', slug: 'activist-investor', category: 'external',
    definition: 'A shareholder that acquires a meaningful stake in a company specifically to force strategic or governance changes — typically a sale, a spin-off, a capital return, or the removal of management — usually on a short time horizon.' },

  { term: 'Aligned cap tables', slug: 'aligned-cap-tables', category: 'governance',
    definition: 'A structural condition, used in constellation designs, in which the ownership of related entities is deliberately set up so that no party can profit from pitting one entity against another.' },

  { term: 'Aligned consequences', slug: 'aligned-consequences', category: 'compliance',
    definition: 'The real rewards and penalties attached to a standard that make compliance material rather than optional. Third pillar (alongside crystal clarity + independent verification) of an effective standard.' },

  { term: 'Alignment method', slug: 'alignment-method', category: 'coherence',
    definition: 'The three-part discipline made up of the culture bank, the leader’s guide, and the two-way review through which an organization builds and maintains coherence between its stated values and its lived practice.' },

  { term: 'B Corp', slug: 'b-corp', category: 'governance',
    definition: 'Shorthand for a company that has earned the Certified B Corporation designation from the nonprofit B Lab, based on independently verified performance across workers, community, environment, customers, and governance. Distinct from a Public Benefit Corporation, which is a legal corporate form.' },

  { term: "Builder's intuition", slug: 'builders-intuition', category: 'purpose',
    definition: 'The company builder’s instinctive understanding that the best way to prosper is to create net new value rather than relying on deferred liabilities or other short-term strategies.' },

  { term: 'Build-measure-learn', slug: 'build-measure-learn', category: 'measurement',
    definition: 'The iterative feedback cycle at the heart of the Lean Startup methodology. Build products from ideas, measure how customers respond, then learn from the data whether to pivot or persevere.' },

  { term: 'Career equity', slug: 'career-equity', category: 'external',
    definition: 'The professional reputation and future job opportunities that directors, lawyers, and executives prioritize, often at the expense of a specific company’s long-term mission.' },

  { term: 'Citizens of the republic', slug: 'citizens-of-the-republic', category: 'coherence',
    definition: 'Employees, customers, investors, and other essential partners and community members whose own futures are intertwined with the success of an organization’s mission. They are treated as participants in an organization’s governance and mission rather than as inputs, outputs, or externalities.' },

  { term: 'Civic infrastructure', slug: 'civic-infrastructure', category: 'governance',
    definition: 'Organizations that facilitate the flourishing of other institutions and communities by creating beneficial constraints, building shared trust and connection, and solving collective action problems that enable public goods. Usually tiny relative to what they govern, they possess rule-setting power, and trust as their essential currency.' },

  { term: 'Coherence', slug: 'coherence', category: 'coherence',
    definition: 'The alignment of an organization’s stated values, operating incentives, business model, and daily behavior so that they reinforce rather than contradict one another.' },

  { term: 'Constellation', slug: 'constellation', category: 'governance',
    definition: 'Multiple separate entities orbiting around a common purpose so tightly that they appear to be a single organization. Each entity maintains independence while exerting gravitational pull on the others, creating a coherent whole that customers, employees, and even investors perceive as one company.' },

  { term: 'Constitutional governance', slug: 'constitutional-governance', category: 'integrity',
    definition: 'The overlapping set of governance structures that encode the company’s mission and values into binding legal and ownership architecture, creating structural integrity that protects an organization’s purpose in perpetuity — i.e., a mission-controlled company.' },

  { term: 'Corruption', slug: 'corruption', category: 'failure-modes',
    definition: 'The gradual erosion of a successful organization’s mission through structural pressure that transforms transactions meant to create value into ones that destroy it.' },

  { term: 'Crystal clarity', slug: 'crystal-clarity', category: 'compliance',
    definition: 'The first attribute of an effective standard. The standard must mean something specific, leaving no room for reinterpretation. Works alongside independent verification and aligned consequences.' },

  { term: 'Culture bank', slug: 'culture-bank', category: 'coherence',
    definition: 'A tool that makes the intangible work of culture building visible. It frames every organizational decision as either a deposit (trust-building, coherent with stated values) or a withdrawal (trust-damaging, incoherent). One of the three elements of the alignment method, together with the leader’s guide and the two-way review.' },

  { term: 'Deferred liabilities', slug: 'deferred-liabilities', category: 'failure-modes',
    definition: 'Costs a company incurs today but does not recognize until far in the future, creating the illusion of profit. Value is borrowed from the future, not created in the present. Profit generated by creating deferred liabilities is extraction, not value creation.' },

  { term: 'Department of corporate purpose', slug: 'department-of-corporate-purpose', category: 'coherence',
    definition: 'A dedicated internal function tasked with maintaining coherence across the entire organization. Teaches the culture bank framework, maintains the leader’s guide with stories from the two-way review, surfaces patterns across performance reviews, compensation structures, hiring criteria and promotion decisions to identify drift before it becomes decay.' },

  { term: "Director's oath", slug: 'directors-oath', category: 'integrity',
    definition: 'A formal commitment in which board members commit to using their broad discretion to support the company’s mission and consider it in every decision.' },

  { term: 'Divisibility', slug: 'divisibility', category: 'failure-modes',
    definition: 'The risk that a strong constellation will split into warring factions and abandon or betray the mission.' },

  { term: 'Dual-class shares', slug: 'dual-class-shares', category: 'governance',
    definition: 'A share structure in which one class (usually held by founders or insiders) carries more votes per share than another (usually held by outside investors), allowing long-term control to remain with parties committed to the mission.' },

  { term: 'Emergent intelligence', slug: 'emergent-intelligence', category: 'coherence',
    definition: "A new intelligence generated by the collective behavior of a system that doesn’t exist in any of its individual parts." },

  { term: 'Enshittification', slug: 'enshittification', category: 'failure-modes', coinedBy: 'Cory Doctorow',
    definition: 'The slow, deliberate degradation of a product or service once the company that owns it has captured enough customers or attention to extract more from them than it delivers.' },

  { term: 'Ethos', slug: 'ethos', category: 'purpose',
    definition: "The consistent foundational character or animating spirit of an organization. Aristotle’s term for human character, applied to a superorganism." },

  { term: 'Externalities', slug: 'externalities', category: 'failure-modes',
    definition: 'Costs or benefits of an economic transaction that are borne by parties not directly involved in it. Negative externalities (pollution, social harm) shift costs onto third parties; positive externalities (innovation spillovers, public-health gains) confer benefits on them.' },

  { term: 'False proxies', slug: 'false-proxies', category: 'measurement', coinedBy: 'Seth Godin',
    definition: 'Metrics that appear to measure mission achievement but in fact only measure something correlated or convenient, undermining the goals they purport to serve.' },

  { term: 'Fever indicator', slug: 'fever-indicator', category: 'measurement',
    definition: "An organizational early warning sign that, like a body’s fever, signals an underlying condition. A cue to investigate structural integrity rather than to suppress the symptom." },

  { term: 'Fiduciary duty', slug: 'fiduciary-duty', category: 'external',
    definition: 'A legal obligation to act in the best interest of another party. In modern business, this is often narrowly interpreted as a duty to maximize shareholder value.' },

  { term: 'Financial gravity', slug: 'financial-gravity', category: 'failure-modes',
    definition: 'The psychological and systemic pressure that pulls organizations and individuals toward financial values, fueled by the desire to succeed in future transactions.' },

  { term: 'Founder mode', slug: 'founder-mode', category: 'coherence', coinedBy: 'Paul Graham',
    definition: "A temporary intervention in which a founder reasserts direct operational control, often by dismantling middle-management layers, overriding committee decisions, and orchestrating cultural resets, in an attempt to restore their company’s original ethos." },

  { term: 'General incorporation', slug: 'general-incorporation', category: 'external',
    definition: 'The legal concept, established in the United States starting in the late 19th century, that allows companies to incorporate for any purpose rather than a defined public purpose.' },

  { term: 'Governance class', slug: 'governance-class', category: 'external',
    definition: 'The interlocking network of investors and the bankers, lawyers, directors, advisors, and academics who serve them.' },

  { term: 'Governance fortress', slug: 'governance-fortress', category: 'integrity',
    definition: "A dense, layered set of interlocking structural protections designed to make a company’s mission incorruptible that have the capacity to flex and adapt while still maintaining structural integrity." },

  { term: 'Harder-is-easier mission', slug: 'harder-is-easier-mission', category: 'purpose',
    definition: 'A strategy where an organization chooses a difficult, principled path (like refusing to raise prices during inflation) to unlock “magnetic powers” of trust and loyalty that eventually make execution easier.' },

  { term: 'Holistic metrics', slug: 'holistic-metrics', category: 'measurement',
    definition: 'An approach to measurement that centers mission attainment and human judgment rather than surrogate proxies. Made up of complete value accounting, fiduciary verification, and natural tension between metrics that prevents surrogation.' },

  { term: 'Human flourishing', slug: 'human-flourishing', category: 'purpose',
    definition: 'The conditions under which people can grow into their potential physically, emotionally, and spiritually. The moral foundation of capitalism.' },

  { term: 'Incoherence', slug: 'incoherence', category: 'failure-modes',
    definition: "The state in which an organization’s expressed values conflict with its operating incentives; what it says it stands for is not what it actually does." },

  { term: 'Independent verification', slug: 'independent-verification', category: 'compliance',
    definition: 'The second attribute of an effective standard: the standard must be tested and confirmed by a credible third party rather than self-declared. Works alongside crystal clarity and aligned consequences.' },

  { term: 'Infrastructure thinking', slug: 'infrastructure-thinking', category: 'integrity',
    definition: 'A way of looking not just at the landscape of one industry but at the foundational rules and parameters that determine what industries can exist at all.' },

  { term: 'Integrity', slug: 'integrity', category: 'integrity',
    definition: 'The degree to which an organization is protected from external forces that can compel or tempt it to act in ways counter to its purpose. Encompasses both the sense of being able to keep a promise and the sense of structural integrity designed to resist external pressure.' },

  { term: 'Invisible leader', slug: 'invisible-leader', category: 'coherence', coinedBy: 'Mary Parker Follett (1926)',
    definition: 'The common purpose that guides behavior inside an organization even when no manager is present.' },

  { term: "Leader's guide", slug: 'leaders-guide', category: 'coherence',
    definition: "A living internal document of real stories depicting how ethos-aligned leadership looks in practice. It includes named people, specific decisions, and actual outcomes as illustrations that can be used in every place of the organization where standards or communication are needed. One of the three instruments of the alignment method along with the culture bank and the two-way review." },

  { term: 'Magnetic powers', slug: 'magnetic-powers', category: 'integrity',
    definition: 'The powers of attraction unlocked by coherent alignment, generating trustworthiness. The four powers are: the talent power, the alliance power, the alignment power, and the loyalty power.' },

  { term: 'Maximum ethical salary', slug: 'maximum-ethical-salary', category: 'coherence',
    definition: 'A self-imposed compensation ceiling limiting top pay to a defined multiple of median employee compensation. A structural check on executive pay drift and a signal of coherence between stated values and compensation practice.' },

  { term: 'Minimum viable product (MVP)', slug: 'minimum-viable-product', category: 'measurement',
    definition: 'The earliest version of a product that can generate validated learning from real users. A foundational concept from The Lean Startup.' },

  { term: 'Mission', slug: 'mission', category: 'purpose',
    definition: 'The specific purpose an organization exists to pursue. A mission worth protecting is one aligned with human flourishing, encoded in the charter, and structurally defended against drift.' },

  { term: 'Mission-controlled company', slug: 'mission-controlled-company', category: 'integrity',
    definition: 'A company with an organizational and ownership structure in which the mission, rather than founders, shareholders, or any single constituency, holds ultimate authority.' },

  { term: 'Mission drive', slug: 'mission-drive', category: 'purpose',
    definition: 'The management discipline that ensures an organization only profits via the attainment of its mission.' },

  { term: 'Mission guardian', slug: 'mission-guardian', category: 'integrity',
    definition: 'An individual, committee, or entity with formal authority to protect mission alignment that sits above the conventional board.' },

  { term: 'Mission transmission', slug: 'mission-transmission', category: 'coherence',
    definition: 'The gravitational influence organizations exert beyond their own walls that ensures every transaction and relationship extends its values as mission alignment becomes a condition of doing business with the company. Operationalized through the five transmission multipliers.' },

  { term: 'Mission-hopeful', slug: 'mission-hopeful', category: 'purpose',
    definition: 'The position of founders, investors, and employees who want to build or support mission-driven companies but have not committed to the structural and fiduciary choices required. Distinguished from mission-driven (structurally protected).' },

  { term: 'Mission-lock vehicle', slug: 'mission-lock-vehicle', category: 'governance',
    definition: 'A legal structure that serves as the central entity of a constellation, carrying the main responsibility for ensuring the whole constellation stays true to its mission over time. Includes, but is not limited to, foundation ownership, perpetual purpose trusts, steward trusts, and non-profits. A key tool of the spiritual holding company.' },

  { term: 'Mission-locked constellation', slug: 'mission-locked-constellation', category: 'integrity',
    definition: "A constellation whose component entities are all bound to the same mission by legal and governance design. Each entity reinforces and supports the others, protecting their purpose, ensuring there’s no single point of failure, and delivering permanent mission sovereignty. The constellation’s very existence is a by-product of the mission." },

  { term: 'Moral injury', slug: 'moral-injury', category: 'failure-modes',
    definition: 'The inner damage suffered by a person who knowingly participates in causing harm, typically because organizational pressure overrides their own judgment.' },

  { term: 'Perpetual purpose trust (PPT)', slug: 'perpetual-purpose-trust', category: 'governance',
    definition: 'A legal structure in which a trust exists indefinitely to serve a stated purpose rather than to benefit named individuals. PPTs include a protector or independent enforcer who can hold trustees accountable. One of the structural vehicles available to a spiritual holding company.' },

  { term: 'Prosperity cascade', slug: 'prosperity-cascade', category: 'compliance',
    definition: 'A self-reinforcing pattern in which a well-designed standard becomes so clearly beneficial that each successive participant — manufacturers, ports, insurers, regulators — becomes richer by adopting it than by resisting.' },

  { term: 'Public benefit corporation (PBC)', slug: 'public-benefit-corporation', category: 'governance',
    definition: "A legal corporate form that requires directors to balance the stockholders’ financial interests with a specific “public benefit” stated in the charter." },

  { term: 'Purpose', slug: 'purpose', category: 'purpose',
    definition: "The foundational statement of what an organization is for. In the incorruptible blueprint, purpose is the first layer — mission plus the ethos that instills the determination to pursue it — and must be encoded structurally through the charter, the fiduciary hierarchy, and mission-aligned metrics." },

  { term: 'Shareholder primacy', slug: 'shareholder-primacy', category: 'external',
    definition: 'The dominant theory of corporate governance, which holds that the sole purpose of a corporation is to maximize the wealth of its shareholders.' },

  { term: 'Spiritual holding company (SHC)', slug: 'spiritual-holding-company', category: 'governance',
    definition: "A separate legal entity (like a trust or foundation) that holds governance authority over a company specifically to safeguard its animating “spirit” or purpose in perpetuity." },

  { term: 'Steward ownership', slug: 'steward-ownership', category: 'governance',
    definition: "An ownership structure that “unbundles” power and money, ensuring that control of a company remains with people dedicated to its mission rather than with outside investors." },

  { term: 'Structural integrity', slug: 'structural-integrity', category: 'integrity',
    definition: 'The property of an organization architected in such a way that its ethos is protected and its commitment to the mission is preserved in the face of external pressure through a system of mutually reinforcing, interlocking defenses that flex and adapt without breaking.' },

  { term: 'Structural safeguards', slug: 'structural-safeguards', category: 'integrity',
    definition: 'The concrete legal and governance mechanisms such as audit teams and veto powers that ensure an organization is making ethos-aligned decisions across all divisions and levels.' },

  { term: 'Structured collision points', slug: 'structured-collision-points', category: 'coherence',
    definition: 'Formal venues in which conflicts between competing priorities surfaced through holistic metrics are resolved according to ethos rather than expediency.' },

  { term: 'Sunset provision', slug: 'sunset-provision', category: 'governance',
    definition: 'A clause, often attached to special voting rights or governance protections, that automatically terminates the protection after a set period unless affirmatively renewed.' },

  { term: 'Superorganism', slug: 'superorganism', category: 'purpose',
    definition: 'An organization understood as a living system with its own emergent intelligence, its own will to survive, and a tenacity that can override the preferences of any individual within it — even the nominal leader.' },

  { term: 'Supervoting shares', slug: 'supervoting-shares', category: 'governance',
    definition: 'Share classes carrying disproportionate voting power used to preserve founder or mission-aligned control despite equity dilution. A specific mechanism within dual-class structures.' },

  { term: 'Surrogation', slug: 'surrogation', category: 'measurement',
    definition: 'A psychological phenomenon where people stop seeing a metric as a measure of a goal and start treating the metric as the goal itself.' },

  { term: 'Torchbearer', slug: 'torchbearer', category: 'coherence',
    definition: "An unheralded employee who relentlessly upholds the organization’s mission even when no one is watching. Todd Park’s “only deposits” culture bank rule gives institutional backing to torchbearers by empowering push-back against trust-damaging shortcuts." },

  { term: 'Transmission multipliers', slug: 'transmission-multipliers', category: 'coherence',
    definition: 'The five practices through which an organization extends its mission beyond its walls: (1) consider mission in every transaction; (2) make mission the tiebreaker; (3) clear the path for mission-aligned allies; (4) signal with costly commitment; (5) create mechanisms for recourse.' },

  { term: 'Trustee', slug: 'trustee', category: 'integrity',
    definition: "In the older legal conception, the party charged with protecting and preserving property for the benefit of beneficiaries. The board was seen as a trustee of the corporation itself, obligated to pursue the corporation’s long-term prosperity and survival, avoiding self-dealing or conflicts of interest." },

  { term: 'Two-way review', slug: 'two-way-review', category: 'coherence',
    definition: "A performance-review method in which annual reviews use the leader’s guide criteria as their standard, are analyzed to flag defining moments that exemplify the company ethos in action, and then used to refresh the leader’s guide for the following review cycle. Also a source of data for identifying mission drift or other cultural issues that signal the organization needs to evolve. One of the three instruments of the alignment method along with the culture bank and the leader’s guide." },

  { term: 'Unusual failures', slug: 'unusual-failures', category: 'failure-modes',
    definition: 'Companies that collapse not in the normal failure modes of the marketplace such as losing to competitors, mistiming a market, or running out of capital, but from the inside, through governance-enabled dismantling, value extraction, or mission drift.' },

  { term: 'Vanity metrics', slug: 'vanity-metrics', category: 'measurement',
    definition: "Measurements that look impressive and feel good but don’t predict success because they don’t track actual progress towards value creation. A key concept from The Lean Startup." },

  { term: 'Virtuous performance cycle', slug: 'virtuous-performance-cycle', category: 'measurement',
    definition: "The self-reinforcing loop that emerges when a company’s mission and business model are aligned. Pursuing the mission strengthens the business, which generates the resources to pursue the mission more fully through organizational growth." },
] as const

// Compile-time sanity: unique slugs.
const _seen = new Set<string>()
for (const e of RIES_GLOSSARY) {
  if (_seen.has(e.slug)) throw new Error(`riesGlossary: duplicate slug ${e.slug}`)
  _seen.add(e.slug)
}

/** O(1) lookup by canonical slug. */
export const RIES_GLOSSARY_BY_SLUG: Record<string, RiesGlossaryEntry> =
  Object.freeze(Object.fromEntries(RIES_GLOSSARY.map(e => [e.slug, e])))

/** O(1) lookup by canonical term string (case-sensitive per Ries convention). */
export const RIES_GLOSSARY_BY_TERM: Record<string, RiesGlossaryEntry> =
  Object.freeze(Object.fromEntries(RIES_GLOSSARY.map(e => [e.term, e])))

/**
 * Resolve one or more Ries terms (by term OR by slug) to their canonical
 * entries.  Silently drops unknown terms — the agent-side rendering code
 * treats an empty result as "no glossary chips for this finding".
 *
 * @param termsOrSlugs — free-form list; Ries term case matters.
 */
export function resolveRiesTerms(termsOrSlugs: readonly string[]): RiesGlossaryEntry[] {
  const out: RiesGlossaryEntry[] = []
  const seen = new Set<string>()
  for (const raw of termsOrSlugs) {
    const s = raw.trim()
    if (!s) continue
    const hit = RIES_GLOSSARY_BY_SLUG[s] ?? RIES_GLOSSARY_BY_TERM[s]
    if (hit && !seen.has(hit.slug)) {
      seen.add(hit.slug)
      out.push(hit)
    }
  }
  return out
}

/**
 * All entries in one Figure-5.1-aligned category — used by the future
 * Glossary Browser overlay + AI-prompt-vocabulary-declaration blocks.
 */
export function riesTermsByCategory(category: RiesGlossaryCategory): RiesGlossaryEntry[] {
  return RIES_GLOSSARY.filter(e => e.category === category)
}
