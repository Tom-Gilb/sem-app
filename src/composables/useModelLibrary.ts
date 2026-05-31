/**
 * useModelLibrary — persistent library of reusable Planguage domain models.
 *
 * Two tiers:
 *   Built-in — shipped with the app; 3 per category × 6 categories = 18 total.
 *              Cannot be deleted. Cover common archetypes across organizational,
 *              project, product, national, international, and software domains.
 *   User      — uploaded/titled by the user; stored in localStorage; deletable.
 *
 * Usage in ModelLibraryPanel: user browses by category, views Planguage entries,
 * copies the Planguage text, or uploads their own model text.
 *
 * Twin-portable: ModelLibraryEntry is a plain data record with no Vue /
 * browser API inside the type itself.  The composable is a module-level
 * singleton so library contents persist across panel mount/unmount cycles.
 */

import { ref, computed } from 'vue'

// ── Public types ──────────────────────────────────────────────────────────────

export type ModelCategory =
  | 'organizational'
  | 'project'
  | 'product'
  | 'national'
  | 'international'
  | 'software'

export interface ModelEntry {
  type: 'F' | 'V' | 'C' | 'R' | 'S'
  description: string
  /** For V: "Scale: X · Goal: Y · Tolerable: Z · Wish: W"; for C: constraint statement */
  details?: string
}

export interface ModelLibraryEntry {
  id: string
  title: string
  category: ModelCategory
  /** 1-2 sentence summary shown on the card. */
  description: string
  stakeholders: string[]
  entries: ModelEntry[]
  source: 'built-in' | 'user'
  /** For user-uploaded models: raw text (no structured entries). */
  userText?: string
  createdAt: number
}

// ── Category metadata (also exported for use in the panel) ────────────────────

export interface CategoryMeta {
  id: ModelCategory
  label: string
  emoji: string
  /** Tailwind color token: 'slate' | 'amber' | 'orange' | 'blue' | 'indigo' | 'violet' */
  color: string
}

export const CATEGORIES_META: CategoryMeta[] = [
  { id: 'organizational', label: 'Organizational', emoji: '🏢', color: 'slate'  },
  { id: 'project',        label: 'Project',        emoji: '📁', color: 'amber'  },
  { id: 'product',        label: 'Product',        emoji: '📦', color: 'orange' },
  { id: 'national',       label: 'National',       emoji: '🌍', color: 'blue'   },
  { id: 'international',  label: 'International',  emoji: '🌐', color: 'indigo' },
  { id: 'software',       label: 'Software',       emoji: '💻', color: 'violet' },
]

// ── Built-in model definitions ────────────────────────────────────────────────

const BUILT_IN_ENTRIES: ModelLibraryEntry[] = [

  // ── Organizational ──────────────────────────────────────────────────────────

  {
    id: 'org-university-governance',
    title: 'University Governance',
    category: 'organizational',
    description: 'A model of university governance covering teaching, research, and community engagement with measurable performance targets.',
    stakeholders: ['Students', 'Faculty', 'Administration', 'Board of Trustees', 'Government', 'Industry Partners'],
    entries: [
      { type: 'F', description: 'Teaching' },
      { type: 'F', description: 'Research' },
      { type: 'F', description: 'Community Engagement' },
      { type: 'V', description: 'Student Satisfaction',            details: 'Scale: 0–100 satisfaction index · Goal: 80/100' },
      { type: 'V', description: 'Graduation Rate',                 details: 'Scale: % cohort graduating · Goal: 85%' },
      { type: 'V', description: 'Research Publications per Academic', details: 'Scale: count per academic per year · Goal: 2/yr' },
      { type: 'C', description: 'Must maintain national accreditation' },
      { type: 'R', description: 'Annual Operating Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'org-healthcare-provider',
    title: 'Healthcare Provider',
    category: 'organizational',
    description: 'Organisational model for a healthcare provider spanning patient care, diagnostics, and administration with outcome and efficiency metrics.',
    stakeholders: ['Patients', 'Clinicians', 'Administrators', 'Regulators', 'Insurers'],
    entries: [
      { type: 'F', description: 'Patient Care' },
      { type: 'F', description: 'Diagnostics' },
      { type: 'F', description: 'Administration' },
      { type: 'V', description: 'Patient Outcome Score',      details: 'Scale: 0–100 clinical outcome index · Goal: 90/100' },
      { type: 'V', description: 'Bed Occupancy',              details: 'Scale: % beds occupied · Goal: 80%' },
      { type: 'V', description: 'Wait Time for Urgent Care',  details: 'Scale: hours from arrival to treatment · Goal: ≤4h' },
      { type: 'C', description: 'Must meet all regulatory standards' },
      { type: 'R', description: 'Annual Clinical Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'org-corporate-governance',
    title: 'Corporate Governance',
    category: 'organizational',
    description: 'Corporate governance model covering strategic direction, risk management, and financial reporting with shareholder and employee value targets.',
    stakeholders: ['Shareholders', 'Board', 'Management', 'Employees', 'Customers', 'Regulators'],
    entries: [
      { type: 'F', description: 'Strategic Direction' },
      { type: 'F', description: 'Risk Management' },
      { type: 'F', description: 'Financial Reporting' },
      { type: 'V', description: 'Return on Equity',    details: 'Scale: % annual return · Goal: 15%' },
      { type: 'V', description: 'Employee Retention',  details: 'Scale: % staff retained annually · Goal: 90%' },
      { type: 'V', description: 'Customer NPS',        details: 'Scale: −100 to +100 Net Promoter Score · Goal: 50' },
      { type: 'C', description: 'Must comply with all listing requirements' },
      { type: 'R', description: 'Board Governance Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  // ── Project ─────────────────────────────────────────────────────────────────

  {
    id: 'proj-software-development',
    title: 'Software Development Project',
    category: 'project',
    description: 'Planguage model for a software development project covering the full lifecycle from requirements definition through deployment.',
    stakeholders: ['Product Owner', 'Dev Team', 'QA', 'End Users', 'Sponsor'],
    entries: [
      { type: 'F', description: 'Requirements Definition' },
      { type: 'F', description: 'Development' },
      { type: 'F', description: 'Testing' },
      { type: 'F', description: 'Deployment' },
      { type: 'V', description: 'Delivery on Time',  details: 'Scale: % sprints delivered on schedule · Goal: 95%' },
      { type: 'V', description: 'Defect Rate',       details: 'Scale: defects per 1,000 lines of code · Goal: <2' },
      { type: 'V', description: 'User Acceptance',   details: 'Scale: % UAT test cases passing · Goal: 85%' },
      { type: 'C', description: 'Must not exceed approved budget' },
      { type: 'R', description: 'Development Budget and Timeline' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'proj-digital-transformation',
    title: 'Digital Transformation Programme',
    category: 'project',
    description: 'Programme model for enterprise-wide digital transformation covering process redesign, technology deployment, and change management.',
    stakeholders: ['C-Suite', 'IT Department', 'Business Units', 'Employees', 'Vendors'],
    entries: [
      { type: 'F', description: 'Process Redesign' },
      { type: 'F', description: 'Technology Deployment' },
      { type: 'F', description: 'Change Management' },
      { type: 'F', description: 'Training' },
      { type: 'V', description: 'Process Efficiency Gain',  details: 'Scale: % reduction in process cycle time · Goal: 30%' },
      { type: 'V', description: 'Adoption Rate',            details: 'Scale: % workforce using new digital tools · Goal: 80% within 6 months' },
      { type: 'V', description: 'Cost Reduction',           details: 'Scale: % operational cost saving · Goal: 20%' },
      { type: 'C', description: 'No disruption to critical business operations exceeding 2 hours' },
      { type: 'R', description: 'Transformation Programme Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'proj-infrastructure-delivery',
    title: 'Infrastructure Delivery Project',
    category: 'project',
    description: 'Capital infrastructure delivery model spanning design, construction, commissioning, and handover with safety and schedule targets.',
    stakeholders: ['Client', 'Contractor', 'Subcontractors', 'Regulators', 'Community'],
    entries: [
      { type: 'F', description: 'Design' },
      { type: 'F', description: 'Construction' },
      { type: 'F', description: 'Commissioning' },
      { type: 'F', description: 'Handover' },
      { type: 'V', description: 'Completion on Schedule',     details: 'Scale: % milestones achieved on target date · Goal: 95%' },
      { type: 'V', description: 'Safety Incident Rate',       details: 'Scale: Lost Time Injuries per year · Goal: 0 LTIs' },
      { type: 'V', description: 'Cost Variance',              details: 'Scale: % deviation from approved budget · Goal: ±5%' },
      { type: 'C', description: 'Must satisfy all building regulations' },
      { type: 'R', description: 'Capital Budget and Contingency' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  // ── Product ─────────────────────────────────────────────────────────────────

  {
    id: 'prod-mobile-application',
    title: 'Mobile Application',
    category: 'product',
    description: 'Product model for a consumer mobile application covering core features, onboarding, notifications, and analytics with growth and rating targets.',
    stakeholders: ['End Users', 'Product Team', 'Marketing', 'App Stores', 'Advertisers'],
    entries: [
      { type: 'F', description: 'Core Feature Set' },
      { type: 'F', description: 'User Onboarding' },
      { type: 'F', description: 'Notifications' },
      { type: 'F', description: 'Analytics' },
      { type: 'V', description: 'Daily Active Users Growth',  details: 'Scale: % month-on-month DAU growth · Goal: 10%/month' },
      { type: 'V', description: 'App Store Rating',           details: 'Scale: 1–5 star rating · Goal: 4.5★' },
      { type: 'V', description: 'Session Length',             details: 'Scale: average session duration in minutes · Goal: >5 min' },
      { type: 'C', description: 'Must comply with App Store guidelines and GDPR' },
      { type: 'R', description: 'Development and Marketing Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'prod-b2b-saas-platform',
    title: 'B2B SaaS Platform',
    category: 'product',
    description: 'Platform model for an enterprise B2B SaaS product with uptime, retention, NPS, and onboarding speed as primary value targets.',
    stakeholders: ['Enterprise Customers', 'Sales', 'Support', 'Engineering', 'Regulators'],
    entries: [
      { type: 'F', description: 'Core Platform' },
      { type: 'F', description: 'Integrations' },
      { type: 'F', description: 'Admin Portal' },
      { type: 'F', description: 'Reporting' },
      { type: 'V', description: 'System Uptime',       details: 'Scale: % availability in any calendar month · Goal: 99.9%' },
      { type: 'V', description: 'Customer Retention',  details: 'Scale: % customers renewing annually · Goal: 95%' },
      { type: 'V', description: 'NPS',                 details: 'Scale: −100 to +100 Net Promoter Score · Goal: 40' },
      { type: 'V', description: 'Onboarding Time',     details: 'Scale: business days from contract to first productive use · Goal: <1 week' },
      { type: 'C', description: 'Must meet SOC 2 Type II and GDPR requirements' },
      { type: 'R', description: 'Engineering and Support Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'prod-physical-consumer-product',
    title: 'Physical Consumer Product',
    category: 'product',
    description: 'Product model for a physical consumer good covering manufacturing, distribution, after-sales support, and consumer satisfaction.',
    stakeholders: ['Consumers', 'Retailers', 'Manufacturing', 'Supply Chain', 'Regulators'],
    entries: [
      { type: 'F', description: 'Core Product Function' },
      { type: 'F', description: 'Packaging' },
      { type: 'F', description: 'Distribution' },
      { type: 'F', description: 'After-Sales Support' },
      { type: 'V', description: 'Manufacturing Defect Rate',  details: 'Scale: % units failing QC inspection · Goal: <0.1%' },
      { type: 'V', description: 'Retail Sell-Through',        details: 'Scale: % of shipped units sold at retail · Goal: 85%' },
      { type: 'V', description: 'Consumer Satisfaction',      details: 'Scale: 1–5 star post-purchase survey · Goal: 4.2/5' },
      { type: 'C', description: 'Must meet all applicable safety certification standards' },
      { type: 'R', description: 'Manufacturing and Distribution Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  // ── National ─────────────────────────────────────────────────────────────────

  {
    id: 'nat-education-system',
    title: 'National Education System',
    category: 'national',
    description: 'National-scale education model spanning primary, secondary, tertiary, and vocational pathways with literacy, attainment, and employment outcomes.',
    stakeholders: ['Students', 'Teachers', 'Schools', 'Government', 'Parents', 'Employers'],
    entries: [
      { type: 'F', description: 'Primary Education' },
      { type: 'F', description: 'Secondary Education' },
      { type: 'F', description: 'Tertiary Education' },
      { type: 'F', description: 'Vocational Training' },
      { type: 'V', description: 'Literacy Rate',                    details: 'Scale: % adults reading at functional level · Goal: 98%' },
      { type: 'V', description: 'PISA Score',                       details: 'Scale: OECD PISA ranking · Goal: top 20 OECD' },
      { type: 'V', description: 'Graduation Rate',                  details: 'Scale: % completing secondary education · Goal: 90%' },
      { type: 'V', description: 'Employment Rate of Graduates',     details: 'Scale: % employed within 12 months of graduation · Goal: 85%' },
      { type: 'C', description: 'Primary education must be universally accessible and free' },
      { type: 'R', description: 'Annual Education Budget (% of GDP)' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'nat-healthcare-system',
    title: 'National Healthcare System',
    category: 'national',
    description: 'National healthcare model covering primary, emergency, specialist, and public health services with life expectancy and cost-efficiency targets.',
    stakeholders: ['Citizens', 'Healthcare Professionals', 'Hospitals', 'Government', 'Insurers', 'Pharmaceutical Companies'],
    entries: [
      { type: 'F', description: 'Primary Care' },
      { type: 'F', description: 'Emergency Services' },
      { type: 'F', description: 'Specialist Services' },
      { type: 'F', description: 'Public Health' },
      { type: 'V', description: 'Life Expectancy',              details: 'Scale: years at birth · Goal: >80 years' },
      { type: 'V', description: 'Healthcare Satisfaction',      details: 'Scale: 0–100 patient satisfaction index · Goal: 75/100' },
      { type: 'V', description: 'Wait Time for Non-Emergency',  details: 'Scale: weeks from referral to specialist · Goal: <13 weeks' },
      { type: 'V', description: 'Cost per Capita',              details: 'Scale: USD per person per year · Goal: below OECD median' },
      { type: 'C', description: 'Emergency care must be universally accessible regardless of ability to pay' },
      { type: 'R', description: 'Annual Healthcare Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'nat-digital-economy-strategy',
    title: 'National Digital Economy Strategy',
    category: 'national',
    description: 'National strategy model for digital economy development covering infrastructure, skills, e-government, and innovation ecosystem targets.',
    stakeholders: ['Government', 'Businesses', 'Citizens', 'Educational Institutions', 'International Partners'],
    entries: [
      { type: 'F', description: 'Digital Infrastructure' },
      { type: 'F', description: 'Digital Skills Development' },
      { type: 'F', description: 'E-Government Services' },
      { type: 'F', description: 'Innovation Ecosystem' },
      { type: 'V', description: 'Broadband Coverage',             details: 'Scale: % households with high-speed broadband · Goal: 99%' },
      { type: 'V', description: 'Digital Skills Adoption',        details: 'Scale: % workforce with certified digital skills · Goal: 80%' },
      { type: 'V', description: 'E-Government Uptake',            details: 'Scale: % eligible transactions completed online · Goal: 75%' },
      { type: 'V', description: 'Tech Sector GDP Contribution',   details: 'Scale: % of national GDP from tech sector · Goal: 10%' },
      { type: 'C', description: 'All government digital services must meet accessibility standards' },
      { type: 'R', description: 'Digital Strategy Investment Fund' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  // ── International ────────────────────────────────────────────────────────────

  {
    id: 'intl-bilateral-trade',
    title: 'Bilateral Trade Partnership',
    category: 'international',
    description: 'International trade partnership model covering tariff reduction, standards harmonisation, dispute resolution, and trade facilitation goals.',
    stakeholders: ['Exporting Nation', 'Importing Nation', 'Businesses', 'Customs Authorities', 'Dispute Resolution Bodies'],
    entries: [
      { type: 'F', description: 'Tariff Reduction' },
      { type: 'F', description: 'Standards Harmonisation' },
      { type: 'F', description: 'Dispute Resolution' },
      { type: 'F', description: 'Trade Facilitation' },
      { type: 'V', description: 'Trade Volume Growth',    details: 'Scale: % growth in bilateral trade value · Goal: 20% over 5 years' },
      { type: 'V', description: 'Customs Clearance Time', details: 'Scale: hours from declaration to release · Goal: <24h' },
      { type: 'V', description: 'Tariff Reduction',       details: 'Scale: % of tariff lines reduced to zero · Goal: 80%' },
      { type: 'C', description: 'All trade must comply with WTO rules' },
      { type: 'R', description: 'Trade Facilitation Fund' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'intl-climate-framework',
    title: 'International Climate Framework',
    category: 'international',
    description: 'International climate cooperation model covering emissions commitments, climate finance, technology transfer, and adaptation support.',
    stakeholders: ['Signatory Nations', 'UNFCCC', 'Businesses', 'Civil Society', 'Vulnerable Communities'],
    entries: [
      { type: 'F', description: 'Emissions Reduction Commitments' },
      { type: 'F', description: 'Climate Finance' },
      { type: 'F', description: 'Technology Transfer' },
      { type: 'F', description: 'Adaptation Support' },
      { type: 'V', description: 'Global Temperature Rise',   details: 'Scale: °C above pre-industrial average · Goal: <1.5°C' },
      { type: 'V', description: 'Climate Finance',           details: 'Scale: USD billion per year to developing nations · Goal: $100B/yr' },
      { type: 'V', description: 'Renewable Energy Share',    details: 'Scale: % of global electricity from renewables · Goal: 60% by 2035' },
      { type: 'C', description: 'Commitments must be legally binding and verifiable' },
      { type: 'R', description: 'Climate Finance Mechanism' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'intl-development-cooperation',
    title: 'International Development Cooperation',
    category: 'international',
    description: 'Development cooperation model covering aid disbursement, capacity building, monitoring, and knowledge transfer with effectiveness and sovereignty constraints.',
    stakeholders: ['Donor Nations', 'Recipient Nations', 'NGOs', 'Beneficiary Communities', 'UN Agencies'],
    entries: [
      { type: 'F', description: 'Aid Disbursement' },
      { type: 'F', description: 'Capacity Building' },
      { type: 'F', description: 'Monitoring and Evaluation' },
      { type: 'F', description: 'Knowledge Transfer' },
      { type: 'V', description: 'Aid Effectiveness',       details: 'Scale: % of disbursed aid reaching intended beneficiaries · Goal: 80%' },
      { type: 'V', description: 'Local Capacity Growth',   details: 'Scale: measurable institutional capability index · Goal: measurable improvement within 3 years' },
      { type: 'V', description: 'Poverty Reduction',       details: 'Scale: % reduction in extreme poverty in target areas · Goal: 20%' },
      { type: 'C', description: 'All programmes must respect recipient nation sovereignty' },
      { type: 'R', description: 'Official Development Assistance Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  // ── Software ─────────────────────────────────────────────────────────────────

  {
    id: 'sw-sem-app',
    title: 'SEM App — Stakes Ends Means',
    category: 'software',
    description: 'Self-referential Planguage model of the SEM App itself — a design sandbox for Planguage spec generation, Evo planning, and AI-assisted analysis.',
    stakeholders: ['Planners', 'Tom Gilb', 'Kai Gilb (Twin)', 'AI (Claude)', 'Organisation Leadership'],
    entries: [
      { type: 'F', description: 'Spec Generation' },
      { type: 'F', description: 'Evo Plan Creation' },
      { type: 'F', description: 'Impact Estimation' },
      { type: 'F', description: 'Contract Analysis' },
      { type: 'F', description: 'Governance Analysis' },
      { type: 'F', description: 'Model Library' },
      { type: 'V', description: 'Spec Quality Score',       details: 'Scale: 0–100 PHI (Plan Health Index) · Goal: 80/100' },
      { type: 'V', description: 'User Session Depth',       details: 'Scale: number of distinct Evo stages visited per session · Goal: >3 stages' },
      { type: 'V', description: 'AI Response Accuracy',     details: 'Scale: % of AI-generated entries accepted without correction · Goal: 95%' },
      { type: 'V', description: 'Twin Portability',         details: 'Scale: % of features portable to Tom\'s Twin in principle · Goal: 100%' },
      { type: 'C', description: 'All designs must be architecturally resilient and Twin-portable' },
      { type: 'R', description: 'Development Time and API Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'sw-enterprise-web-platform',
    title: 'Enterprise Web Platform',
    category: 'software',
    description: 'Software model for an enterprise web platform covering authentication, core business logic, reporting, integrations, and admin tooling.',
    stakeholders: ['End Users', 'Admins', 'IT Operations', 'Security Team', 'Business Owners'],
    entries: [
      { type: 'F', description: 'User Authentication' },
      { type: 'F', description: 'Core Business Logic' },
      { type: 'F', description: 'Reporting and Analytics' },
      { type: 'F', description: 'Integrations' },
      { type: 'F', description: 'Admin Tools' },
      { type: 'V', description: 'Page Load Time',        details: 'Scale: milliseconds at P95 · Goal: <2,000 ms' },
      { type: 'V', description: 'System Uptime',         details: 'Scale: % availability per calendar month · Goal: 99.9%' },
      { type: 'V', description: 'Security Audit Score',  details: 'Scale: A–F OWASP audit grade · Goal: A grade' },
      { type: 'V', description: 'User Satisfaction',     details: 'Scale: 0–100 CSAT index · Goal: 80/100' },
      { type: 'C', description: 'Must meet WCAG 2.1 AA accessibility standard' },
      { type: 'R', description: 'Infrastructure and Development Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },

  {
    id: 'sw-ai-ml-system',
    title: 'AI/ML System',
    category: 'software',
    description: 'Software model for an AI/ML system covering data ingestion, training, inference, monitoring, and explainability with accuracy, fairness, and latency targets.',
    stakeholders: ['End Users', 'Data Scientists', 'Model Owners', 'Regulators', 'Affected Parties'],
    entries: [
      { type: 'F', description: 'Data Ingestion' },
      { type: 'F', description: 'Model Training' },
      { type: 'F', description: 'Inference' },
      { type: 'F', description: 'Monitoring' },
      { type: 'F', description: 'Explainability' },
      { type: 'V', description: 'Model Accuracy',        details: 'Scale: % correct predictions on held-out test set · Goal: >92%' },
      { type: 'V', description: 'False Positive Rate',   details: 'Scale: % of positive predictions that are incorrect · Goal: <3%' },
      { type: 'V', description: 'Inference Latency',     details: 'Scale: milliseconds at P99 · Goal: <200 ms' },
      { type: 'V', description: 'Bias Metrics',          details: 'Scale: max demographic group deviation from mean accuracy · Goal: no group deviates >5%' },
      { type: 'C', description: 'Must comply with applicable AI regulation and maintain full audit trail' },
      { type: 'R', description: 'Compute and Data Infrastructure Budget' },
    ],
    source: 'built-in',
    createdAt: 0,
  },
]

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-model-library-v1'

// ── Module-level singleton state ──────────────────────────────────────────────

const _userEntries = ref<ModelLibraryEntry[]>([])

function _load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) _userEntries.value = JSON.parse(raw) as ModelLibraryEntry[]
  } catch {
    _userEntries.value = []
  }
}

function _save(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_userEntries.value))
}

_load()

// ── Formatter ─────────────────────────────────────────────────────────────────

/**
 * Format a ModelLibraryEntry as clean Planguage text for clipboard / display.
 * Built-in entries emit structured F./V./C./R./S. entries.
 * User-uploaded entries emit the raw userText preserved as-is.
 */
export function formatModelAsPlanguage(entry: ModelLibraryEntry): string {
  const lines: string[] = []

  lines.push(`Title: ${entry.title}`)
  lines.push(`Category: ${entry.category}`)
  lines.push(`Description: ${entry.description}`)
  lines.push('')

  if (entry.stakeholders.length > 0) {
    for (const s of entry.stakeholders) {
      lines.push(`Stakeholder: ${s}`)
    }
    lines.push('')
  }

  if (entry.source === 'user' && entry.userText) {
    lines.push(entry.userText)
    return lines.join('\n')
  }

  // Group built-in entries by type in canonical order
  const typeOrder: ModelEntry['type'][] = ['F', 'V', 'C', 'R', 'S']
  for (const t of typeOrder) {
    const group = entry.entries.filter(e => e.type === t)
    for (const e of group) {
      if (e.details) {
        lines.push(`${e.type}. ${e.description}`)
        lines.push(`   ${e.details}`)
      } else {
        lines.push(`${e.type}. ${e.description}`)
      }
    }
    if (group.length > 0) lines.push('')
  }

  // Remove trailing blank line
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

  return lines.join('\n')
}

// ── Public composable ─────────────────────────────────────────────────────────

export function useModelLibrary() {
  /** All entries: built-ins first, then user entries newest-first. */
  const allEntries = computed<ModelLibraryEntry[]>(() => [
    ...BUILT_IN_ENTRIES,
    ..._userEntries.value,
  ])

  /** Reactive filtered list for a specific category. */
  function entriesByCategory(cat: ModelCategory) {
    return computed<ModelLibraryEntry[]>(() =>
      allEntries.value.filter(e => e.category === cat),
    )
  }

  /**
   * Save a user-uploaded model text to the library.
   * Returns the created entry.
   */
  function addUserEntry(
    title: string,
    category: ModelCategory,
    userText: string,
  ): ModelLibraryEntry {
    const entry: ModelLibraryEntry = {
      id:          `user-${Date.now()}`,
      title:       title.trim() || 'My Model',
      category,
      description: 'User-uploaded model.',
      stakeholders: [],
      entries:     [],
      source:      'user',
      userText,
      createdAt:   Date.now(),
    }
    _userEntries.value = [entry, ..._userEntries.value]
    _save()
    return entry
  }

  /** Remove a user entry by id. Built-in entries are silently ignored. */
  function removeUserEntry(id: string): void {
    if (!id.startsWith('user-')) return
    _userEntries.value = _userEntries.value.filter(e => e.id !== id)
    _save()
  }

  /** Rename a user entry title in place. */
  function renameUserEntry(id: string, newTitle: string): void {
    const entry = _userEntries.value.find(e => e.id === id)
    if (!entry) return
    entry.title = newTitle.trim() || entry.title
    _save()
  }

  return { allEntries, entriesByCategory, addUserEntry, removeUserEntry, renameUserEntry }
}
