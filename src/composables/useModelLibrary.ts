/**
 * useModelLibrary — persistent library of reusable Planguage domain models.
 *
 * Two tiers:
 *   Built-in — shipped with the app; 3 per category × 6 categories = 18 total.
 *              Cannot be deleted. Cover common archetypes across organizational,
 *              project, product, national, international, and software domains.
 *   User      — brought in by the user via "Bring in Models" flow; stored in
 *              localStorage; deletable; can be AI-analysed into structured entries.
 *
 * Category system:
 *   Top-level categories (ModelCategoryDef):
 *     'examples'   — built-in examples, not renameable, sub-categorised by ExampleSubCategory
 *     'my-models'  — user's own models, renameable
 *     'our-models' — team models, renameable
 *     <UUID>       — user-created categories, renameable and deletable
 *   Sub-categories of 'examples' (ExampleSubCategory):
 *     organizational, project, product, national, international, software
 *
 * Twin-portable: ModelLibraryEntry is a plain data record with no Vue /
 * browser API inside the type itself.  The composable is a module-level
 * singleton so library contents persist across panel mount/unmount cycles.
 */

import Anthropic from '@anthropic-ai/sdk'
import { ref, computed } from 'vue'
import { MODEL_ID } from '../config/llm'

// ── Public types ──────────────────────────────────────────────────────────────

/** Boundary scope levels for system boundary analysis. Inner-to-outer. */
export type BoundaryType = 'our-org' | 'product-line' | 'national' | 'international' | 'universe'

export interface BoundaryTypeMeta {
  id: BoundaryType
  label: string
  emoji: string
  color: string  // Tailwind color token
  description: string
}

export const BOUNDARY_TYPES: BoundaryTypeMeta[] = [
  { id: 'our-org',        label: 'Our Organisation', emoji: '🏢', color: 'emerald', description: 'Scope limited to our own organisation\'s systems, people, and processes' },
  { id: 'product-line',   label: 'Product Line',     emoji: '📦', color: 'amber',   description: 'Scope covers our product line and its direct supply/distribution chain' },
  { id: 'national',       label: 'National',          emoji: '🌍', color: 'blue',    description: 'Scope extends to national-level systems, regulations, and institutions' },
  { id: 'international',  label: 'International',     emoji: '🌐', color: 'indigo',  description: 'Scope extends to international bodies, frameworks, and cross-border systems' },
  { id: 'universe',       label: 'Universe',           emoji: '🌌', color: 'violet',  description: 'No explicit boundary — all possible stakeholders and systems in scope' },
]

export interface ModelDefect {
  id: string
  severity: 'critical' | 'major' | 'minor' | 'info'
  category: 'inconsistency' | 'missing' | 'out-of-boundary' | 'duplicate' | 'vague' | 'unmeasurable'
  entryRef?: { index: number; type: string }
  title: string
  description: string
  suggestion: string
  suggestedBoundary?: BoundaryType
}

export interface DefectAnalysisResult {
  modelId: string
  boundaryType: BoundaryType
  runAt: number
  overallScore: number          // 0–100 where 100 = no defects found
  defects: ModelDefect[]
  inBoundaryIndices: number[]   // entry indices that are in-boundary
  outOfBoundaryIndices: number[] // entry indices that violate the boundary
  summary: string
}

export interface ImprovementSuggestion {
  id: string
  rank: number
  title: string
  rationale: string
  newEntries: ModelEntry[]
  newStakeholders: string[]
  impactSummary: string
  tradeOffs: string
}

export interface ImprovementResult {
  modelId: string
  dimension: 'stakeholder' | 'value' | 'constraint'
  specification: string
  suggestions: ImprovementSuggestion[]
  runAt: number
}

export interface ModelVersion {
  id: string
  versionNumber: number
  name: string
  entries: ModelEntry[]
  stakeholders: string[]
  description: string
  createdAt: number
  source: 'original' | 'user-edit' | 'ai-improve' | 'batch-change' | 'find-replace' | 'sharpen'
  improvementContext?: string
}

/** Sub-categories within the built-in 'examples' top-level category. */
export type ExampleSubCategory =
  | 'organizational'
  | 'project'
  | 'product'
  | 'national'
  | 'international'
  | 'software'

/**
 * Backwards-compat alias — code that imported ModelCategory can keep using it.
 * It now refers to ExampleSubCategory (same union, same values).
 */
export type ModelCategory = ExampleSubCategory

/** Top-level category definition (user-editable except 'examples'). */
export interface ModelCategoryDef {
  /** 'examples' | 'my-models' | 'our-models' | UUID */
  id: string
  /** User-visible label (e.g. "My Models"). */
  label: string
  emoji: string
  /** true only for the built-in 'examples' category. */
  isBuiltin: boolean
  /** false for 'examples'; true for all others. */
  isRenameable: boolean
  createdAt: number
}

export interface ModelEntry {
  type: 'F' | 'V' | 'C' | 'R' | 'S'
  description: string
  /** For V: "Scale: X · Goal: Y · Tolerable: Z · Wish: W"; for C: constraint statement */
  details?: string
}

export interface ModelLibraryEntry {
  id: string
  title: string
  /**
   * Backwards-compat: sub-category string for built-in examples OR 'user' for
   * user entries. New code should use categoryId + exampleSubCategory instead.
   */
  category: ModelCategory | 'user'
  /** Primary top-level category id ('examples' | 'my-models' | 'our-models' | UUID). */
  categoryId: string
  /** Only present for built-in examples (categoryId === 'examples'). */
  exampleSubCategory?: ExampleSubCategory
  /** 1-2 sentence summary shown on the card. */
  description: string
  stakeholders: string[]
  entries: ModelEntry[]
  source: 'built-in' | 'user'
  /** For user-added models: raw input text (before AI analysis). */
  userText?: string
  /** AI analysis state. 'idle' = not yet run, 'analysing' = in progress, 'done' = success, 'error' = failed. */
  analysisStatus?: 'idle' | 'analysing' | 'done' | 'error'
  analysisError?: string
  createdAt: number
  /** Version history — created by edit tools and AI improvement. */
  versions?: ModelVersion[]
}

// ── Category metadata (also exported for panel sub-category sidebar) ───────────

export interface CategoryMeta {
  id: ModelCategory
  label: string
  emoji: string
  /** Tailwind color token: 'slate' | 'amber' | 'orange' | 'blue' | 'indigo' | 'violet' */
  color: string
}

/** Sub-category metadata for the 'examples' built-in category. Exported for panel. */
export const CATEGORIES_META: CategoryMeta[] = [
  { id: 'organizational', label: 'Organizational', emoji: '🏢', color: 'slate'  },
  { id: 'project',        label: 'Project',        emoji: '📁', color: 'amber'  },
  { id: 'product',        label: 'Product',        emoji: '📦', color: 'orange' },
  { id: 'national',       label: 'National',       emoji: '🌍', color: 'blue'   },
  { id: 'international',  label: 'International',  emoji: '🌐', color: 'indigo' },
  { id: 'software',       label: 'Software',       emoji: '💻', color: 'violet' },
]

// ── Default top-level categories ──────────────────────────────────────────────

const DEFAULT_CATEGORY_DEFS: ModelCategoryDef[] = [
  { id: 'examples',   label: 'Examples of Models', emoji: '📚', isBuiltin: true,  isRenameable: false, createdAt: 0 },
  { id: 'my-models',  label: 'My Models',           emoji: '👤', isBuiltin: false, isRenameable: true,  createdAt: 0 },
  { id: 'our-models', label: 'Our Models',           emoji: '🏢', isBuiltin: false, isRenameable: true,  createdAt: 0 },
]

// ── Built-in model definitions ────────────────────────────────────────────────

const BUILT_IN_ENTRIES: ModelLibraryEntry[] = [

  // ── Organizational ──────────────────────────────────────────────────────────

  {
    id: 'org-university-governance',
    title: 'University Governance',
    category: 'organizational',
    categoryId: 'examples',
    exampleSubCategory: 'organizational',
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
    categoryId: 'examples',
    exampleSubCategory: 'organizational',
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
    categoryId: 'examples',
    exampleSubCategory: 'organizational',
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
    categoryId: 'examples',
    exampleSubCategory: 'project',
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
    categoryId: 'examples',
    exampleSubCategory: 'project',
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
    categoryId: 'examples',
    exampleSubCategory: 'project',
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
    categoryId: 'examples',
    exampleSubCategory: 'product',
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
    categoryId: 'examples',
    exampleSubCategory: 'product',
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
    categoryId: 'examples',
    exampleSubCategory: 'product',
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
    categoryId: 'examples',
    exampleSubCategory: 'national',
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
    categoryId: 'examples',
    exampleSubCategory: 'national',
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
    categoryId: 'examples',
    exampleSubCategory: 'national',
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
    categoryId: 'examples',
    exampleSubCategory: 'international',
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
    categoryId: 'examples',
    exampleSubCategory: 'international',
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
    categoryId: 'examples',
    exampleSubCategory: 'international',
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
    categoryId: 'examples',
    exampleSubCategory: 'software',
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
    categoryId: 'examples',
    exampleSubCategory: 'software',
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
    categoryId: 'examples',
    exampleSubCategory: 'software',
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

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY      = 'sem-model-library-v1'       // user entries (backwards compat)
const CATEGORIES_KEY   = 'sem-model-categories-v1'    // category defs

// ── Module-level singleton state ──────────────────────────────────────────────

const _userEntries  = ref<ModelLibraryEntry[]>([])
const categoryDefs  = ref<ModelCategoryDef[]>([...DEFAULT_CATEGORY_DEFS])

/**
 * The currently "active" model — the one selected by the user as the implied
 * analysis target for cross-agent operations (Stakeholder Mapper, Evo Critiquer,
 * Plan Agent, etc.).  Module-level so it persists across panel open/close cycles.
 */
const activeModelId = ref<string | null>(null)

/** Last defect analysis result per model id. Module-level = persists across panel mounts. */
const _defectResults = ref(new Map<string, DefectAnalysisResult>())
/** Last improvement result per model id. Module-level = persists across panel mounts. */
const _improvementResults = ref(new Map<string, ImprovementResult>())

/** Set the active model.  Pass null to clear.  Twin-portable: pure state mutation. */
function setActiveModel(id: string | null): void {
  activeModelId.value = id
}

function _loadEntries(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) _userEntries.value = JSON.parse(raw) as ModelLibraryEntry[]
  } catch {
    _userEntries.value = []
  }
}

function _saveEntries(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_userEntries.value))
}

function _loadCategories(): void {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ModelCategoryDef[]
      // Always ensure the three built-in defs are present (merge strategy: user
      // overrides labels for 'my-models'/'our-models', built-in always stays locked).
      const builtinIds = new Set(['examples', 'my-models', 'our-models'])
      const userCats   = parsed.filter(c => !builtinIds.has(c.id))
      const overrides  = new Map(parsed.filter(c => builtinIds.has(c.id)).map(c => [c.id, c]))
      categoryDefs.value = DEFAULT_CATEGORY_DEFS.map(def => ({
        ...def,
        ...overrides.get(def.id),
        // Hard-lock immutable fields for safety
        isBuiltin:    def.isBuiltin,
        isRenameable: def.isRenameable,
      })).concat(userCats)
    }
  } catch {
    categoryDefs.value = [...DEFAULT_CATEGORY_DEFS]
  }
}

function _saveCategories(): void {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categoryDefs.value))
}

_loadEntries()
_loadCategories()

// ── LLM client (same pattern as useEvoCritiquer) ──────────────────────────────

function _getClient(): Anthropic {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  return new Anthropic({ apiKey: apiKey ?? '', dangerouslyAllowBrowser: true, timeout: 120_000 })
}

// ── JSON extraction helper (same pattern as useEvoCritiquer) ──────────────────

function _extractJson<T>(text: string): T {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(stripped) as T } catch { /* */ }
  try { return JSON.parse(text.trim()) as T } catch { /* */ }
  const objMatch = stripped.match(/\{[\s\S]*\}/)
  if (objMatch) { try { return JSON.parse(objMatch[0]) as T } catch { /* */ } }
  throw new Error('Could not extract valid JSON from AI response')
}

// ── UUID helper ───────────────────────────────────────────────────────────────

function _uuid(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Formatter ─────────────────────────────────────────────────────────────────

/**
 * Format a ModelLibraryEntry as clean Planguage text for clipboard / display.
 * Built-in entries emit structured F./V./C./R./S. entries.
 * User-added entries emit the raw userText preserved as-is (if no analysed entries).
 */
export function formatModelAsPlanguage(entry: ModelLibraryEntry): string {
  const lines: string[] = []

  lines.push(`Title: ${entry.title}`)
  lines.push(`Category: ${entry.exampleSubCategory ?? entry.categoryId}`)
  lines.push(`Description: ${entry.description}`)
  lines.push('')

  if (entry.stakeholders.length > 0) {
    for (const s of entry.stakeholders) {
      lines.push(`Stakeholder: ${s}`)
    }
    lines.push('')
  }

  // User model with no structured entries: emit raw text
  if (entry.source === 'user' && entry.entries.length === 0 && entry.userText) {
    lines.push(entry.userText)
    return lines.join('\n')
  }

  // Group entries by type in canonical order
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

  /** Reactive filtered list for a specific ExampleSubCategory (legacy helper). */
  function entriesByCategory(cat: ModelCategory) {
    return computed<ModelLibraryEntry[]>(() =>
      allEntries.value.filter(e => e.exampleSubCategory === cat),
    )
  }

  // ── Category management ───────────────────────────────────────────────────

  /** Add a new user-created category. Returns the created def. */
  function addCategory(label: string, emoji?: string): ModelCategoryDef {
    const def: ModelCategoryDef = {
      id:           _uuid(),
      label:        label.trim() || 'New Category',
      emoji:        emoji ?? '📂',
      isBuiltin:    false,
      isRenameable: true,
      createdAt:    Date.now(),
    }
    categoryDefs.value = [...categoryDefs.value, def]
    _saveCategories()
    return def
  }

  /** Remove a user-created category. Only non-builtin, non-'examples' categories. */
  function removeCategory(id: string): void {
    if (id === 'examples' || id === 'my-models' || id === 'our-models') return
    categoryDefs.value = categoryDefs.value.filter(c => c.id !== id)
    _saveCategories()
  }

  /** Rename a category (only renameable ones). */
  function renameCategory(id: string, newLabel: string): void {
    const def = categoryDefs.value.find(c => c.id === id)
    if (!def || !def.isRenameable) return
    categoryDefs.value = categoryDefs.value.map(c =>
      c.id === id ? { ...c, label: newLabel.trim() || c.label } : c,
    )
    _saveCategories()
  }

  // ── Entry management ──────────────────────────────────────────────────────

  /**
   * Add a user-supplied model text to the library.
   * categoryId: the top-level category to place this model in.
   * Returns the created entry (with analysisStatus='idle').
   */
  function addUserEntry(
    title: string,
    categoryId: string,
    userText: string,
  ): ModelLibraryEntry {
    const entry: ModelLibraryEntry = {
      id:             `user-${Date.now()}`,
      title:          title.trim() || 'My Model',
      category:       'user' as ModelCategory,
      categoryId,
      description:    'User-added model.',
      stakeholders:   [],
      entries:        [],
      source:         'user',
      userText,
      analysisStatus: 'idle',
      createdAt:      Date.now(),
    }
    _userEntries.value = [entry, ..._userEntries.value]
    _saveEntries()
    return entry
  }

  /** Remove a user entry by id. Built-in entries are silently ignored. */
  function removeUserEntry(id: string): void {
    if (!id.startsWith('user-')) return
    _userEntries.value = _userEntries.value.filter(e => e.id !== id)
    _saveEntries()
  }

  /** Rename a user entry title in place. */
  function renameUserEntry(id: string, newTitle: string): void {
    const entry = _userEntries.value.find(e => e.id === id)
    if (!entry) return
    entry.title = newTitle.trim() || entry.title
    _saveEntries()
  }

  /** Replace all entries of a user model. Used by Edit Model tools. Only works on user models. */
  function replaceModelEntries(modelId: string, newEntries: ModelEntry[]): void {
    const idx = _userEntries.value.findIndex(e => e.id === modelId)
    if (idx === -1) return
    _userEntries.value[idx].entries = [...newEntries]
    _saveEntries()
  }

  // ── AI: Analyse model text → Planguage entries ────────────────────────────

  /**
   * Analyse the userText of the given model entry using Claude.
   * Sets analysisStatus='analysing' while running, then 'done' or 'error'.
   * On success: populates entries, optionally updates title/description.
   */
  async function analyseModelText(modelId: string, signal?: AbortSignal): Promise<void> {
    const entry = _userEntries.value.find(e => e.id === modelId)
    if (!entry || !entry.userText) return

    entry.analysisStatus = 'analysing'
    entry.analysisError  = undefined
    _saveEntries()

    const systemPrompt =
      'You are a Planguage expert. Convert the input text into structured Planguage ' +
      'F./V./C./R./S. entries. ' +
      'F.=binary function (present/absent — what the system DOES, no quantities inside F.), ' +
      'V.=measurable value (needs Scale/Meter/Goal/Tolerable), ' +
      'C.=hard constraint (Must…), ' +
      'R.=resource/budget, ' +
      'S.=stakeholder-specific solution or means. ' +
      'Return ONLY valid JSON: ' +
      '{ "title": "string or null", "description": "string or null", ' +
      '"stakeholders": ["string"], ' +
      '"entries": [{"type":"F"|"V"|"C"|"R"|"S", "description":"string", "details":"string or null"}] }'

    type AnalysisResult = {
      title?: string | null
      description?: string | null
      stakeholders?: string[]
      entries?: Array<{ type: 'F' | 'V' | 'C' | 'R' | 'S'; description: string; details?: string | null }>
    }

    try {
      const client   = _getClient()
      const response = await client.messages.create(
        {
          model:      MODEL_ID,
          max_tokens: 4096,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: entry.userText }],
        },
        { signal },
      )

      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('')

      const parsed = _extractJson<AnalysisResult>(text)

      // Update entry in place — find the mutable ref
      const idx = _userEntries.value.findIndex(e => e.id === modelId)
      if (idx === -1) return

      const target = _userEntries.value[idx]
      if (parsed.title)       target.title       = parsed.title
      if (parsed.description) target.description = parsed.description
      if (Array.isArray(parsed.stakeholders)) target.stakeholders = parsed.stakeholders
      if (Array.isArray(parsed.entries)) {
        target.entries = parsed.entries.map(e => ({
          type:        e.type,
          description: e.description,
          details:     e.details ?? undefined,
        }))
      }
      target.analysisStatus = 'done'
      _saveEntries()
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') {
        const idx = _userEntries.value.findIndex(e => e.id === modelId)
        if (idx !== -1) {
          _userEntries.value[idx].analysisStatus = 'idle'
          _saveEntries()
        }
        return
      }
      const idx = _userEntries.value.findIndex(e => e.id === modelId)
      if (idx !== -1) {
        _userEntries.value[idx].analysisStatus = 'error'
        _userEntries.value[idx].analysisError  = err instanceof Error ? err.message : 'AI analysis failed'
        _saveEntries()
      }
    }
  }

  // ── AI: Sharpen model entries ─────────────────────────────────────────────

  /**
   * Apply an improvement command to the model's existing entries using Claude.
   * Updates entries in place on success.
   */
  async function sharpenModel(modelId: string, command: string, signal?: AbortSignal): Promise<void> {
    const entry = _userEntries.value.find(e => e.id === modelId)
    if (!entry) return

    const currentEntries = entry.entries.map(e =>
      `${e.type}. ${e.description}${e.details ? ' — ' + e.details : ''}`,
    ).join('\n')

    const systemPrompt =
      'You are a Planguage improver. Apply the improvement command to the model entries. ' +
      'Keep F. entries binary (present/absent), V. entries measurable, C. entries as hard Must constraints. ' +
      'Return ONLY valid JSON: ' +
      '{ "entries": [{"type":"F"|"V"|"C"|"R"|"S", "description":"string", "details":"string or null"}] }'

    const userPrompt =
      `Improvement command: ${command}\n\nCurrent entries:\n${currentEntries}`

    type SharpenResult = {
      entries?: Array<{ type: 'F' | 'V' | 'C' | 'R' | 'S'; description: string; details?: string | null }>
    }

    try {
      const client   = _getClient()
      const response = await client.messages.create(
        {
          model:      MODEL_ID,
          max_tokens: 4096,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        },
        { signal },
      )

      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('')

      const parsed = _extractJson<SharpenResult>(text)

      const idx = _userEntries.value.findIndex(e => e.id === modelId)
      if (idx === -1) return

      if (Array.isArray(parsed.entries)) {
        _userEntries.value[idx].entries = parsed.entries.map(e => ({
          type:        e.type,
          description: e.description,
          details:     e.details ?? undefined,
        }))
        _saveEntries()
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return
      throw err
    }
  }

  // ── AI: Defect Analysis ────────────────────────────────────────────────────

  async function runDefectAnalysis(
    modelId: string,
    boundaryType: BoundaryType,
    signal?: AbortSignal,
  ): Promise<void> {
    const entry = allEntries.value.find(e => e.id === modelId)
    if (!entry) return

    const entryList = entry.entries.map((e, i) =>
      `[${i}] ${e.type}. ${e.description}${e.details ? ' — ' + e.details : ''}`,
    ).join('\n')

    const systemPrompt =
      'You are a Planguage model auditor. Analyse the model for defects. ' +
      'The model\'s declared boundary is: ' + boundaryType + '. ' +
      'Boundary meaning: our-org = only our own systems/people/processes; ' +
      'product-line = our product line and its direct chain; ' +
      'national = national-level systems and regulations; ' +
      'international = international bodies and cross-border systems; ' +
      'universe = no limit. ' +
      'Find: (1) inconsistencies (V. with no F. to deliver it, C. that contradicts V., etc.), ' +
      '(2) missing elements (no stakeholders listed, V. without Scale/Goal, F. with no linked V., R. without budget figure), ' +
      '(3) out-of-boundary entries (entries whose scope exceeds the declared boundary level), ' +
      '(4) vague descriptions (non-specific, unmeasurable V. entries), ' +
      '(5) duplicates. ' +
      'For each defect assign severity: critical (model is incomplete/wrong), major (significant gap), minor (quality issue), info (suggestion). ' +
      'Return ONLY valid JSON: ' +
      '{ "overallScore": number_0_to_100, "summary": "string", ' +
      '"defects": [{"id":"d1","severity":"critical"|"major"|"minor"|"info","category":"inconsistency"|"missing"|"out-of-boundary"|"duplicate"|"vague"|"unmeasurable","entryRef":{"index":number,"type":"F"|"V"|"C"|"R"|"S"}|null,"title":"string","description":"string","suggestion":"string","suggestedBoundary":"our-org"|"product-line"|"national"|"international"|"universe"|null}], ' +
      '"inBoundaryIndices": [numbers], "outOfBoundaryIndices": [numbers] }'

    const userPrompt =
      `Model: ${entry.title}\nDeclared boundary: ${boundaryType}\n` +
      `Stakeholders: ${entry.stakeholders.join(', ') || 'none'}\n\nEntries:\n${entryList}`

    type AnalysisJson = {
      overallScore?: number
      summary?: string
      defects?: Array<{
        id?: string; severity?: string; category?: string
        entryRef?: { index: number; type: string } | null
        title?: string; description?: string; suggestion?: string
        suggestedBoundary?: string | null
      }>
      inBoundaryIndices?: number[]
      outOfBoundaryIndices?: number[]
    }

    try {
      const client = _getClient()
      const response = await client.messages.create(
        { model: MODEL_ID, max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] },
        { signal },
      )
      const text = response.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
      const parsed = _extractJson<AnalysisJson>(text)

      const result: DefectAnalysisResult = {
        modelId,
        boundaryType,
        runAt: Date.now(),
        overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 70,
        summary: parsed.summary ?? 'Analysis complete.',
        defects: (parsed.defects ?? []).map((d, i) => ({
          id: d.id ?? `d${i}`,
          severity: (['critical','major','minor','info'].includes(d.severity ?? '') ? d.severity : 'minor') as ModelDefect['severity'],
          category: (['inconsistency','missing','out-of-boundary','duplicate','vague','unmeasurable'].includes(d.category ?? '') ? d.category : 'missing') as ModelDefect['category'],
          entryRef: d.entryRef ?? undefined,
          title: d.title ?? 'Defect',
          description: d.description ?? '',
          suggestion: d.suggestion ?? '',
          suggestedBoundary: (d.suggestedBoundary ?? undefined) as BoundaryType | undefined,
        })),
        inBoundaryIndices: Array.isArray(parsed.inBoundaryIndices) ? parsed.inBoundaryIndices : [],
        outOfBoundaryIndices: Array.isArray(parsed.outOfBoundaryIndices) ? parsed.outOfBoundaryIndices : [],
      }

      _defectResults.value = new Map(_defectResults.value).set(modelId, result)
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return
      throw err
    }
  }

  // ── AI: Improvement Analysis ───────────────────────────────────────────────

  async function runImprovementAnalysis(
    modelId: string,
    dimension: 'stakeholder' | 'value' | 'constraint',
    specification: string,
    count: 1 | 3 | 10,
    signal?: AbortSignal,
  ): Promise<void> {
    const entry = allEntries.value.find(e => e.id === modelId)
    if (!entry) return

    const entryList = entry.entries.map(e =>
      `${e.type}. ${e.description}${e.details ? ' — ' + e.details : ''}`,
    ).join('\n')

    const dimensionDesc = {
      stakeholder: `stakeholder dimension — for the stakeholder/group: "${specification}"`,
      value:       `value dimension — for the improvement goal: "${specification}"`,
      constraint:  `constraint dimension — for the constraint: "${specification}"`,
    }[dimension]

    const systemPrompt =
      'You are a Planguage model improvement expert. ' +
      `Generate exactly ${count} distinct improvement suggestion${count > 1 ? 's' : ''} for the ${dimensionDesc}. ` +
      'Each suggestion adds new Planguage entries (do NOT remove existing ones). ' +
      'F. entries must be binary (present/absent). V. entries must have Scale: and Goal:. C. entries must start with Must. ' +
      'Return ONLY valid JSON: ' +
      '{ "suggestions": [{ "id":"s1","rank":1,"title":"string","rationale":"string",' +
      '"newEntries":[{"type":"F"|"V"|"C"|"R"|"S","description":"string","details":"string|null"}],' +
      '"newStakeholders":["string"],"impactSummary":"string","tradeOffs":"string" }] }'

    const userPrompt =
      `Model: ${entry.title}\nStakeholders: ${entry.stakeholders.join(', ') || 'none'}\n\nCurrent entries:\n${entryList}`

    type ImproveJson = {
      suggestions?: Array<{
        id?: string; rank?: number; title?: string; rationale?: string
        newEntries?: Array<{ type?: string; description?: string; details?: string | null }>
        newStakeholders?: string[]
        impactSummary?: string; tradeOffs?: string
      }>
    }

    try {
      const client = _getClient()
      const response = await client.messages.create(
        { model: MODEL_ID, max_tokens: 6000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] },
        { signal },
      )
      const text = response.content.filter(b => b.type === 'text').map(b => (b as { type: 'text'; text: string }).text).join('')
      const parsed = _extractJson<ImproveJson>(text)

      const result: ImprovementResult = {
        modelId,
        dimension,
        specification,
        runAt: Date.now(),
        suggestions: (parsed.suggestions ?? []).map((s, i) => ({
          id: s.id ?? `s${i}`,
          rank: s.rank ?? i + 1,
          title: s.title ?? `Suggestion ${i + 1}`,
          rationale: s.rationale ?? '',
          newEntries: (s.newEntries ?? []).map(e => ({
            type: (['F','V','C','R','S'].includes(e.type ?? '') ? e.type : 'F') as ModelEntry['type'],
            description: e.description ?? '',
            details: e.details ?? undefined,
          })),
          newStakeholders: s.newStakeholders ?? [],
          impactSummary: s.impactSummary ?? '',
          tradeOffs: s.tradeOffs ?? '',
        })),
      }
      _improvementResults.value = new Map(_improvementResults.value).set(modelId, result)
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return
      throw err
    }
  }

  // ── Model versioning ───────────────────────────────────────────────────────

  /** Create a snapshot of the current model state as a named version. */
  function createModelVersion(
    modelId: string,
    name: string,
    source: ModelVersion['source'],
    improvementContext?: string,
  ): void {
    const idx = _userEntries.value.findIndex(e => e.id === modelId)
    if (idx === -1) return
    const entry = _userEntries.value[idx]
    const versions: ModelVersion[] = entry.versions ?? []
    const nextNum = versions.length + 1
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 16).replace('T', ' ')
    const newVersion: ModelVersion = {
      id: `ver-${Date.now()}`,
      versionNumber: nextNum,
      name: name || `v${nextNum}`,
      entries: [...entry.entries],
      stakeholders: [...entry.stakeholders],
      description: entry.description,
      createdAt: Date.now(),
      source,
      improvementContext,
    }
    // Label format: "v1 — 2026-05-31 14:23"
    newVersion.name = newVersion.name + ` — ${dateStr}`
    entry.versions = [...versions, newVersion]
    _saveEntries()
  }

  /** Apply an improvement suggestion to a user model, adding new entries and stakeholders. */
  function applyImprovementSuggestion(
    modelId: string,
    suggestion: ImprovementSuggestion,
  ): void {
    const idx = _userEntries.value.findIndex(e => e.id === modelId)
    if (idx === -1) return
    const entry = _userEntries.value[idx]
    // Snapshot current state as a version first
    createModelVersion(
      modelId,
      `Pre-improvement v${(entry.versions?.length ?? 0) + 1}`,
      'user-edit',
    )
    // Apply the suggestion
    const updatedEntry = _userEntries.value[idx]  // re-fetch after createModelVersion mutated it
    updatedEntry.entries = [...updatedEntry.entries, ...suggestion.newEntries]
    updatedEntry.stakeholders = Array.from(new Set([...updatedEntry.stakeholders, ...suggestion.newStakeholders]))
    _saveEntries()
  }

  /** Restore a model to a specific version. */
  function restoreModelVersion(modelId: string, versionId: string): void {
    const idx = _userEntries.value.findIndex(e => e.id === modelId)
    if (idx === -1) return
    const entry = _userEntries.value[idx]
    const version = entry.versions?.find(v => v.id === versionId)
    if (!version) return
    // Snapshot current as a version before restoring
    createModelVersion(modelId, `Pre-restore snapshot`, 'user-edit')
    // Restore
    const updatedEntry = _userEntries.value[idx]
    updatedEntry.entries = [...version.entries]
    updatedEntry.stakeholders = [...version.stakeholders]
    updatedEntry.description = version.description
    _saveEntries()
  }

  return {
    allEntries,
    categoryDefs,
    activeModelId,
    setActiveModel,
    entriesByCategory,
    addUserEntry,
    removeUserEntry,
    renameUserEntry,
    addCategory,
    removeCategory,
    renameCategory,
    analyseModelText,
    sharpenModel,
    replaceModelEntries,
    runDefectAnalysis,
    runImprovementAnalysis,
    applyImprovementSuggestion,
    createModelVersion,
    restoreModelVersion,
    defectResults: _defectResults,
    improvementResults: _improvementResults,
  }
}
