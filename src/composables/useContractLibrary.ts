/**
 * useContractLibrary — persistent library of reusable contract source texts.
 *
 * Two tiers:
 *   Built-in — shipped with the app; cannot be deleted; cover common archetypes.
 *   User      — uploaded/titled by the user; stored in localStorage; deletable.
 *
 * Usage in ContractHub: user selects an entry → text + title pre-fill the
 * import form → one click to Analyse Contract.  Adding to the library is
 * separate from analysing — the library stores raw source texts, NOT the
 * analysed ContractModel objects (those live in useContractStore).
 *
 * Twin-portable: ContractLibraryEntry is a plain data record with no Vue /
 * browser API inside the type itself.  The composable is a module-level
 * singleton so library contents persist across ContractHub mount/unmount cycles.
 */

import { ref, computed } from 'vue'
import type { ContractType } from '../types/contractTypes'

// ── Public type ───────────────────────────────────────────────────────────────

export interface ContractLibraryEntry {
  id:           string
  title:        string
  text:         string
  contractType: ContractType
  /** 'built-in' entries cannot be deleted. */
  source:       'built-in' | 'user'
  createdAt:    number
}

// ── Built-in contract texts ───────────────────────────────────────────────────

const MONITOR_CONTRACT = `MONITORING SERVICES AGREEMENT

This Monitoring Services Agreement ("Agreement") is made between the Monitoring Service Provider ("Provider") and the Organisation ("Client").

1. MONITORING SCOPE
The Provider shall deliver continuous performance monitoring covering all production systems, critical business processes, and key performance indicators (KPIs) listed in Schedule A. Coverage includes server uptime, application response time, database query performance, and network latency.

2. MONITORING FREQUENCY
The Provider shall poll all designated endpoints at intervals not exceeding 5 minutes during business hours (08:00–18:00 local time, Monday to Friday). Outside business hours and at weekends, polling intervals shall not exceed 15 minutes. On-demand monitoring may be triggered by the Client at any time at no additional charge.

3. PERFORMANCE THRESHOLDS AND ALERTS
The Provider shall issue an alert when any monitored metric breaches a defined threshold. Default thresholds: system availability below 99.5% in any calendar month; endpoint response time exceeding 2,000 milliseconds for three consecutive polls; database query time exceeding 500 milliseconds average over any 10-minute window. The Client may revise these thresholds in writing with 5 business days notice.

4. INCIDENT NOTIFICATION
Critical incidents (system unavailable): the Provider shall notify the Client's designated contacts within 5 minutes via SMS and email. High severity (significant degradation): notification within 15 minutes. Medium severity (partial issue, workaround available): notification within 60 minutes. Each notification shall state the affected system, the metric value, the threshold breached, and the time of first detection.

5. MONTHLY REPORTING
The Provider shall deliver a written performance report by the 5th business day of the following calendar month. Reports shall include: uptime percentage by system, incident count by severity, mean time to detect (MTTD), mean time to notify (MTTN), mean time to resolve (MTTR), trend versus prior three months, and recommended corrective actions.

6. DATA RETENTION AND ACCESS
The Provider shall retain all monitoring data for a minimum of 24 months. The Client may request a full export in CSV or JSON format at any time during the retention period. Export requests shall be fulfilled within 5 business days at no additional charge.

7. CONFIDENTIALITY
The Provider shall treat all monitoring data, system architecture information, and performance metrics as strictly confidential. No Client data shall be disclosed to third parties without prior written consent. This obligation survives termination for 5 years.

8. FEES AND PAYMENT
The Client shall pay the monthly fee specified in Schedule B. The base fee covers up to 50 monitored endpoints. Additional endpoints are billed at the per-endpoint rate in Schedule B. Invoices are due within 30 days. Late payments attract interest at 2% per month.

9. SERVICE CREDITS
If the Provider fails to meet the notification targets in Clause 4, the Client is entitled to a service credit equal to 5% of the monthly fee per breach, capped at 20% in any calendar month. Credits are applied to the following month's invoice.

10. TERM AND TERMINATION
This Agreement commences on the Effective Date and continues for 12 months, renewing automatically for successive 12-month periods unless either party gives 30 days written notice. Either party may terminate immediately for material breach unremedied within 14 days of written notice.

11. GOVERNING LAW
This Agreement is governed by the laws of England and Wales.`

const NDA_CONTRACT = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is between the Disclosing Party and the Receiving Party.

1. DEFINITION OF CONFIDENTIAL INFORMATION
Confidential Information means any information disclosed by the Disclosing Party to the Receiving Party, directly or indirectly, in any form, that is designated confidential or that reasonably should be understood to be confidential given its nature and the circumstances of disclosure. This includes business plans, technical data, trade secrets, customer lists, financial information, product plans, and proprietary technology.

2. OBLIGATIONS OF RECEIVING PARTY
The Receiving Party shall: (a) hold Confidential Information in strict confidence; (b) not disclose it to any third party without prior written consent; (c) use it solely for the Purpose stated in Schedule A; (d) protect it using at least the same care used to protect its own confidential information, but no less than reasonable care; (e) limit access to employees and contractors who need to know and who are bound by equivalent obligations.

3. EXCLUSIONS
Obligations do not apply to information that: (a) is or becomes publicly available without breach of this Agreement; (b) was rightfully known to the Receiving Party before disclosure; (c) is rightfully received from a third party without restriction; (d) is independently developed by the Receiving Party without use of Confidential Information; (e) is required to be disclosed by law, provided prompt written notice is given to allow the Disclosing Party to seek a protective order.

4. TERM
Confidentiality obligations remain in effect for 5 years from the date of disclosure.

5. RETURN OR DESTRUCTION
On written request, the Receiving Party shall promptly return or certifiably destroy all materials containing Confidential Information.

6. NO LICENCE
Nothing in this Agreement grants any rights in or to Confidential Information other than the limited right to use it for the Purpose.

7. REMEDIES
Any breach may cause irreparable harm for which monetary damages are inadequate. The Disclosing Party is entitled to seek injunctive relief in addition to any other remedy at law.

8. GOVERNING LAW
This Agreement is governed by the laws of England and Wales.`

const SLA_CONTRACT = `SERVICE LEVEL AGREEMENT

This Service Level Agreement ("SLA") is between the Service Provider ("Provider") and the Customer.

1. SERVICE DESCRIPTION
The Provider shall deliver the managed IT services described in Schedule A, including infrastructure hosting, application support, security monitoring, and helpdesk services, to the standards defined in this SLA.

2. AVAILABILITY TARGET
Covered services shall be available 99.9% of the time in any calendar month, calculated as: (Total minutes minus downtime minutes) / Total minutes × 100. Scheduled maintenance windows — maximum 4 hours per month, minimum 48 hours advance notice — are excluded from availability calculations.

3. RESPONSE AND RESOLUTION TIMES
Priority 1 (complete service outage): first response within 15 minutes, resolution target 4 hours.
Priority 2 (significant degradation): first response within 1 hour, resolution target 8 hours.
Priority 3 (partial issue, workaround available): first response within 4 hours, resolution target 3 business days.
Priority 4 (minor, workaround available): first response within 1 business day, resolution target 10 business days.

4. SUPPORT HOURS
Priority 1 and 2 support: 24 hours a day, 7 days a week, 365 days a year.
Priority 3 and 4 support: Monday to Friday, 08:00–18:00 local time, excluding public holidays.

5. SERVICE CREDITS
If the Provider fails to meet the availability target: below 99.9% to 99.5%: credit equal to 5% of monthly fee; below 99.5% to 99.0%: 10% credit; below 99.0%: 25% credit. Credits are the Customer's sole financial remedy for availability failures and do not apply to Force Majeure events.

6. CUSTOMER OBLIGATIONS
The Customer shall: designate a named technical contact; provide timely access to systems needed for resolution; report incidents via the agreed channel; not make changes to covered systems without Provider approval; pay all invoices within 30 days of issue.

7. MONTHLY REPORTING
The Provider shall deliver a monthly SLA report by the 5th business day of the following month, covering: availability statistics, incident log, resolution times versus targets, change log, and capacity trends.

8. ANNUAL REVIEW
SLA targets shall be reviewed annually. Either party may request a review with 30 days notice if business or technical circumstances change materially.

9. GOVERNING LAW
This Agreement is governed by the laws of England and Wales.`

const EMPLOYMENT_CONTRACT = `EMPLOYMENT CONTRACT

This Employment Contract is between the Employer ("Company") and the Employee.

1. POSITION AND DUTIES
The Employee is appointed to the position stated in Schedule 1. The Employee shall perform all duties reasonably assigned, shall devote full working time to the Company's business, and shall comply with all Company policies.

2. START DATE AND PROBATION
Employment commences on the Start Date in Schedule 1. The first 3 months are a probationary period during which either party may terminate with 1 week written notice. Satisfactory completion will be confirmed in writing.

3. WORKING HOURS
Normal hours are Monday to Friday, 09:00–17:30, totalling 37.5 hours per week. Additional hours may be required when reasonably necessary. Overtime is not paid unless separately agreed in writing.

4. REMUNERATION
The Employee shall receive the gross annual salary in Schedule 1, paid monthly in arrears on the last working day of each month. Salary is reviewed annually at the Company's discretion. No automatic increase is guaranteed.

5. ANNUAL LEAVE
The Employee is entitled to 28 days paid annual leave per holiday year, including public holidays. Leave must be pre-approved. Unused leave may not be carried forward beyond 5 days without written approval. Accrued unused leave is paid or deducted in the final salary on termination.

6. SICK PAY
Company Sick Pay at full salary is available for up to 10 working days per rolling 12 months, subject to the absence notification procedure. Thereafter statutory sick pay applies. Medical certificates are required for absences of 7 consecutive days or more.

7. CONFIDENTIALITY
The Employee shall not during or after employment disclose any Confidential Information belonging to the Company, its clients, or its suppliers. This obligation survives termination for 2 years.

8. INTELLECTUAL PROPERTY
All work, inventions, and creative output produced during the course of employment is the property of the Company. The Employee assigns all such rights to the Company.

9. RESTRICTIVE COVENANTS
For 6 months after termination the Employee shall not: (a) solicit any client with whom the Employee had material dealings in the preceding 12 months; (b) engage in any business that directly competes within the Employee's territory.

10. TERMINATION
After probation, either party may terminate by giving the notice period in Schedule 1. The Company may terminate without notice for gross misconduct and may require the Employee to serve notice on garden leave.

11. GOVERNING LAW
This Agreement is governed by the laws of England and Wales.`

// ── Built-in registry ─────────────────────────────────────────────────────────

const BUILT_IN_ENTRIES: ContractLibraryEntry[] = [
  {
    id:           'built-in-monitor',
    title:        'The Monitor Contract',
    text:         MONITOR_CONTRACT,
    contractType: 'service-agreement',
    source:       'built-in',
    createdAt:    0,
  },
  {
    id:           'built-in-nda',
    title:        'Non-Disclosure Agreement (NDA)',
    text:         NDA_CONTRACT,
    contractType: 'nda',
    source:       'built-in',
    createdAt:    0,
  },
  {
    id:           'built-in-sla',
    title:        'IT Service Level Agreement',
    text:         SLA_CONTRACT,
    contractType: 'sla',
    source:       'built-in',
    createdAt:    0,
  },
  {
    id:           'built-in-employment',
    title:        'Employment Contract',
    text:         EMPLOYMENT_CONTRACT,
    contractType: 'employment',
    source:       'built-in',
    createdAt:    0,
  },
]

// ── Module-level singleton state ──────────────────────────────────────────────

const STORAGE_KEY = 'sem-contract-library-v1'

const _userEntries = ref<ContractLibraryEntry[]>([])

function _load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) _userEntries.value = JSON.parse(raw) as ContractLibraryEntry[]
  } catch { _userEntries.value = [] }
}

function _save(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_userEntries.value))
}

_load()

// ── Public composable ─────────────────────────────────────────────────────────

export function useContractLibrary() {
  /** All entries: built-ins first, then user entries newest-first. */
  const allEntries = computed<ContractLibraryEntry[]>(() => [
    ...BUILT_IN_ENTRIES,
    ..._userEntries.value,
  ])

  /**
   * Save a user-uploaded contract text to the library.
   * Returns the created entry so callers can reference it (e.g. to load).
   */
  function addUserEntry(
    title: string,
    text: string,
    contractType: ContractType = 'other',
  ): ContractLibraryEntry {
    const entry: ContractLibraryEntry = {
      id:           `user-${Date.now()}`,
      title:        title.trim() || 'My Contract',
      text,
      contractType,
      source:       'user',
      createdAt:    Date.now(),
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

  return { allEntries, addUserEntry, removeUserEntry, renameUserEntry }
}
