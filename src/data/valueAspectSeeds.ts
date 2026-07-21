// UNIT_TYPE=Data
// valueAspectSeeds.ts — Seed Aspect templates per category for the Value Aspects
// Articulation Tool (Tom Gilb 2026-06-11 22:45 CET).
//
// Each seed produces a list of 8-12 candidate Aspect specs the planner can accept,
// edit, or delete. The categories Tom explicitly named — Usability, Quality,
// Maintainability, Resilience — get the deepest seed sets. Other ISO 25010 / Gilb
// categories get reasonable starting sets.

import type { ValueAspectCategory, ValueAspectSpec } from '../types/valueAspects'

/** A seed entry — minimal Aspect template the AI suggests; planner edits + commits. */
export interface AspectSeed {
  name:      string
  scale:     string
  meter:     string
  tolerable: string
  goal:      string
  wish:      string
  rationale: string
}

export const VALUE_ASPECT_SEEDS: Record<ValueAspectCategory, AspectSeed[]> = {

  // ── Usability (Tom-named, deep set) ─────────────────────────────────────
  usability: [
    {
      name:      'Discoverability',
      scale:     '% of first-time users who locate the primary feature without help within 60s',
      meter:     'Moderated study with N≥30 users matching the primary stakeholder persona',
      tolerable: '60%',
      goal:      '85%',
      wish:      '95%',
      rationale: 'Discovery friction is the #1 driver of trial-stage churn (Nielsen Norman Group 2024 industry data).',
    },
    {
      name:      'Learnability',
      scale:     'Seconds from first launch to delivered primary value (per stakeholder persona)',
      meter:     'Instrumented event timestamp diff: first-launch → first-completed-value-task',
      tolerable: '120 s',
      goal:      '45 s',
      wish:      '15 s',
      rationale: 'Tom Gilb verbatim: "users did not have to learn 2 different visual shapes" (accessibility_tom.md). Same principle generalises: less to learn = more delivered value per unit time.',
    },
    {
      name:      'Memorability',
      scale:     '% of returning users (gap ≥ 7 days) who complete primary task without re-learning',
      meter:     'Cohort study comparing first-week task completion vs week-2 first-task completion',
      tolerable: '70%',
      goal:      '90%',
      wish:      '98%',
      rationale: 'Memorability separates "designed for daily use" from "designed for one-shot demo".',
    },
    {
      name:      'Error Recovery',
      scale:     '% of user-initiated errors that the system explains AND offers a recovery path for',
      meter:     'Audit of error states in instrumented user sessions; classify each as (explained AND recoverable) | (one-only) | (silent failure)',
      tolerable: '80%',
      goal:      '95%',
      wish:      '100%',
      rationale: 'Per Universal Undo Rule (CLAUDE.md SUPREME): every action should be reversible. Errors are a subset.',
    },
    {
      name:      'Efficiency',
      scale:     'Minimum number of UI steps from launch to completion of primary task',
      meter:     'Event-trace analysis of all completed task sessions; report 50th + 90th percentile step counts',
      tolerable: '7 steps',
      goal:      '4 steps',
      wish:      '2 steps',
      rationale: 'Each step is a friction point. MOVE Principle: make options visible, minimise hunt.',
    },
    {
      name:      'Satisfaction',
      scale:     'NPS score from primary stakeholder survey',
      meter:     'Standard NPS survey post-task or post-session',
      tolerable: '+20',
      goal:      '+50',
      wish:      '+70',
      rationale: 'Industry benchmark — software ≥ +40 is "very good"; ≥ +70 is world-class.',
    },
    {
      name:      'Cognitive Load',
      scale:     'Subjective NASA-TLX score (0-100, lower = lower cognitive load)',
      meter:     'NASA-TLX subjective rating post-task with N≥20 representative users',
      tolerable: '< 60',
      goal:      '< 40',
      wish:      '< 25',
      rationale: 'Tom Gilb (CE Ch.5): subjective workload is a measurable Value, not a feeling. NASA-TLX is the industry standard.',
    },
    {
      name:      'Accessibility',
      scale:     '% of audited user-facing surfaces passing WCAG 2.2 AA criteria',
      meter:     'Automated axe-core scan + manual screen-reader audit by accessibility specialist',
      tolerable: '90%',
      goal:      '100% (AA)',
      wish:      '100% (AAA)',
      rationale: 'Composes with accessibility_tom.md (Tom 85, R-G colourblind) — accessibility is a usability sub-Aspect, not a separate concern.',
    },
  ],

  // ── Quality (Tom-named, deep set) ───────────────────────────────────────
  quality: [
    {
      name:      'Defects',
      scale:     'Customer-reported defects per 1000 active users per quarter',
      meter:     'Customer support ticket categorisation: defects vs questions vs feature requests',
      tolerable: '< 50',
      goal:      '< 10',
      wish:      '< 2',
      rationale: 'Gilb 1976 Software Metrics — defect rate is the canonical Quality scale.',
    },
    {
      name:      'Repair Speed',
      scale:     'Mean time from defect report to verified fix in production (hours)',
      meter:     'Issue tracker: ticket-create timestamp → ticket-closed-as-verified timestamp',
      tolerable: '< 96 h',
      goal:      '< 24 h',
      wish:      '< 4 h',
      rationale: 'MTTR is the quality-of-response metric (vs MTBF = quality-of-design).',
    },
    {
      name:      'Tests',
      scale:     'Branch coverage % across production code paths',
      meter:     'Automated coverage tool (istanbul / v8 / etc.) run in CI on every PR',
      tolerable: '60%',
      goal:      '85%',
      wish:      '95%',
      rationale: 'Tom Gilb CE: coverage alone is insufficient but is a necessary minimum.',
    },
    {
      name:      'Spec-Conformance',
      scale:     '% of declared Planguage spec entries with verified passing acceptance tests',
      meter:     'Per-spec automated acceptance test result; aggregate pass rate across all V/F entries',
      tolerable: '85%',
      goal:      '98%',
      wish:      '100%',
      rationale: 'A spec without acceptance tests is aspiration, not commitment (Tom Gilb).',
    },
    {
      name:      'Satisfaction',
      scale:     '% of named stakeholders rating delivered Value ≥ 4/5 on quarterly survey',
      meter:     'Quarterly structured stakeholder review with rating + free-text rationale',
      tolerable: '70%',
      goal:      '90%',
      wish:      '98%',
      rationale: 'Quality is what stakeholders say it is, not what the team says it is.',
    },
    {
      name:      'Regressions',
      scale:     '% of fixed defects that recur within 6 months',
      meter:     'Issue tracker: cross-reference closed defects against re-opened with same signature',
      tolerable: '< 15%',
      goal:      '< 5%',
      wish:      '< 1%',
      rationale: 'Regressions are the canonical sign that fixes are symptomatic, not root-cause.',
    },
  ],

  // ── Maintainability (Tom-named, deep set) ───────────────────────────────
  maintainability: [
    {
      name:      'Onboarding',
      scale:     'Days from new engineer first commit to first merged production PR',
      meter:     'Git log: first-commit date → first-merged-PR date per engineer',
      tolerable: '14 days',
      goal:      '5 days',
      wish:      '1 day',
      rationale: 'Tom Gilb 1988 PoSEM — maintainability cost is dominated by ramp-up time for new contributors.',
    },
    {
      name:      'Complexity',
      scale:     'Cyclomatic complexity at the 90th percentile of all functions',
      meter:     'Automated static analysis (ESLint complexity rule / SonarQube)',
      tolerable: '< 20',
      goal:      '< 10',
      wish:      '< 6',
      rationale: 'Complexity above 10 correlates with defect density and onboarding cost.',
    },
    {
      name:      'Test Investment',
      scale:     'Lines of test code per line of production code',
      meter:     'CLOC analysis distinguishing test/ from src/ directories',
      tolerable: '0.5×',
      goal:      '1×',
      wish:      '2×',
      rationale: 'Higher test:code ratio strongly correlates with safe refactor velocity.',
    },
    {
      name:      'Dependency Freshness',
      scale:     '% of dependencies at most 2 minor versions behind latest stable',
      meter:     'Automated audit (Dependabot / Renovate / etc.) reporting per-dep age',
      tolerable: '70%',
      goal:      '90%',
      wish:      '99%',
      rationale: 'Stale deps accumulate security + compatibility debt that explodes on next upgrade.',
    },
    {
      name:      'Documentation',
      scale:     '% of public API surfaces with up-to-date docstring + usage example',
      meter:     'Static analysis: ratio of documented vs undocumented exported symbols',
      tolerable: '70%',
      goal:      '95%',
      wish:      '100%',
      rationale: 'Undocumented API = oral tradition. Oral tradition does not scale to new engineers.',
    },
    {
      name:      'Refactoring',
      scale:     'Median PR lead time for refactor-only PRs (hours)',
      meter:     'Issue tracker: refactor-tagged PRs, time-to-merge median',
      tolerable: '< 72 h',
      goal:      '< 24 h',
      wish:      '< 8 h',
      rationale: 'When refactors are slow, accumulated complexity becomes permanent.',
    },
  ],

  // ── Resilience (Tom-named, Tom's Resilience book references) ───────────
  resilience: [
    {
      name:      'Failure Interval',
      scale:     'Hours of operation between unscheduled production incidents',
      meter:     'Incident tracker: time-to-next-incident from each resolved incident',
      tolerable: '> 720 h (30 days)',
      goal:      '> 4380 h (6 months)',
      wish:      '> 8760 h (1 year)',
      rationale: 'Gilb Resilience: MTBF is the classical Reliability scale; baseline for any Resilience Aspect.',
    },
    {
      name:      'Recovery Time',
      scale:     'Minutes from incident detection to verified service restoration',
      meter:     'Incident report timeline: detection → mitigation → verified-recovery timestamps',
      tolerable: '< 60 min',
      goal:      '< 15 min',
      wish:      '< 2 min',
      rationale: 'Gilb Resilience: recovery speed is as important as failure rate.',
    },
    {
      name:      'Recovery Point',
      scale:     'Maximum data-loss window from failure to last verified backup (minutes)',
      meter:     'Backup verification cadence × time-since-last-verified-backup',
      tolerable: '< 60 min',
      goal:      '< 5 min',
      wish:      '0 (synchronous replication)',
      rationale: 'RPO captures what the business is willing to lose; this is a stakeholder negotiation, not a tech choice.',
    },
    {
      name:      'Failure Scope',
      scale:     '% of system that becomes unavailable when one critical component fails',
      meter:     'Chaos engineering test: terminate one component at a time, measure cascade',
      tolerable: '< 30%',
      goal:      '< 5%',
      wish:      '< 1%',
      rationale: 'Gilb Resilience: blast radius captures architectural decoupling. The smaller the radius, the more resilient.',
    },
    {
      name:      'Adaptability',
      scale:     'Hours from 5× workload spike onset to stable normal-latency operation',
      meter:     'Load test simulating 5× sustained traffic; measure stabilisation time',
      tolerable: '< 4 h',
      goal:      '< 30 min',
      wish:      '< 2 min',
      rationale: 'Hollnagel Engineering Resilience: adaptability under load is the under-measured Resilience dimension.',
    },
    {
      name:      'Graceful Degradation',
      scale:     '% of system features that have a defined degraded-mode behaviour',
      meter:     'Architecture audit: per-feature classification (full-only / degraded-defined / unknown)',
      tolerable: '60%',
      goal:      '90%',
      wish:      '100%',
      rationale: 'Hollnagel: resilience = staying functional under stress, not just recovering from failure.',
    },
    {
      name:      'Detection',
      scale:     'Mean minutes from anomaly onset to alert delivered to on-call engineer',
      meter:     'Incident tracker: anomaly-onset timestamp → first-page timestamp',
      tolerable: '< 15 min',
      goal:      '< 3 min',
      wish:      '< 30 s',
      rationale: 'You cannot recover from what you have not detected.',
    },
  ],

  // ── Security (canonical CIA triad + ISO 27001) ─────────────────────────
  security: [
    {
      name:      'Authentication Strength',
      scale:     '% of accounts using multi-factor authentication (MFA)',
      meter:     'Auth provider report: MFA-enabled accounts vs all active accounts',
      tolerable: '60%',
      goal:      '95%',
      wish:      '100%',
      rationale: 'NIST 800-63: MFA blocks > 99% of automated credential attacks.',
    },
    {
      name:      'Data-at-Rest Encryption',
      scale:     '% of stored personal/confidential data encrypted at rest',
      meter:     'Data inventory audit: encrypted-storage classification per data class',
      tolerable: '95%',
      goal:      '100% (PII + PHI)',
      wish:      '100% (all stored data)',
      rationale: 'ISO 27001 A.10.1 + GDPR Art.32. Necessary baseline.',
    },
    {
      name:      'Patching',
      scale:     'Hours from public CVE disclosure to patched-in-production',
      meter:     'Vulnerability tracker: CVE disclosure date → deployment-with-patch date',
      tolerable: '< 168 h (1 week)',
      goal:      '< 24 h',
      wish:      '< 4 h',
      rationale: 'Verizon DBIR: most exploits happen within 14 days of CVE publication.',
    },
    {
      name:      'Audit Log Integrity',
      scale:     '% of security-relevant events with tamper-evident audit trail',
      meter:     'Audit log architecture review: per-event-class write-only/append-only/tamper-evident classification',
      tolerable: '90%',
      goal:      '100%',
      wish:      '100% + cryptographic chain-of-custody',
      rationale: 'NIST Audit Trail standard: tamper-evident logs are the forensic foundation.',
    },
    {
      name:      'Penetration-Test Resolution',
      scale:     '% of high-severity pentest findings remediated within 30 days',
      meter:     'Pentest report + remediation tracker',
      tolerable: '80%',
      goal:      '95%',
      wish:      '100% (within 7 days)',
      rationale: 'A finding without remediation is a known vulnerability. Knowing is not securing.',
    },
  ],

  // ── Performance (ISO 25010) ────────────────────────────────────────────
  performance: [
    {
      name:      'Latency',
      scale:     '99th percentile end-to-end latency on the primary API endpoint (ms)',
      meter:     'Production telemetry: 99p over rolling 7-day window',
      tolerable: '< 500 ms',
      goal:      '< 200 ms',
      wish:      '< 50 ms',
      rationale: 'Google research: 100ms latency = ~1% conversion loss; user perception threshold ~200ms.',
    },
    {
      name:      'Throughput',
      scale:     'Requests per second sustainable for ≥ 1 hour without latency degradation',
      meter:     'Load test: ramp until p99 latency exceeds tolerable; report sustained rate',
      tolerable: '1000 rps',
      goal:      '10 000 rps',
      wish:      '100 000 rps',
      rationale: 'Throughput-at-acceptable-latency is the real capacity, not theoretical max.',
    },
    {
      name:      'Cold Start',
      scale:     'P99 latency on first request after scale-out / warm-up (ms)',
      meter:     'Synthetic test: cold instance → first request → measure',
      tolerable: '< 5000 ms',
      goal:      '< 1000 ms',
      wish:      '< 200 ms',
      rationale: 'Cold-start is invisible until traffic spikes hit autoscaling. Then it dominates user experience.',
    },
    {
      name:      'Resource Efficiency',
      scale:     'CPU-milliseconds consumed per primary endpoint request',
      meter:     'Production telemetry: per-request CPU sampling',
      tolerable: '< 100 ms-CPU',
      goal:      '< 30 ms-CPU',
      wish:      '< 10 ms-CPU',
      rationale: 'CPU per request × throughput = capacity per server. Compounds into operating cost.',
    },
  ],

  reliability: [
    {
      name:      'Availability',
      scale:     '% uptime over 30-day rolling window',
      meter:     'Synthetic ping + customer-facing API endpoint healthcheck (3 geo-distributed probes)',
      tolerable: '99.5% (≈ 3.6 h/month downtime)',
      goal:      '99.95% (≈ 22 min/month)',
      wish:      '99.99% (≈ 4 min/month)',
      rationale: 'Industry SLA bands. 4 nines is non-trivial; 5 nines requires geo-redundant active-active.',
    },
    {
      name:      'Maturity',
      scale:     '% of releases that ship without subsequent hotfix within 7 days',
      meter:     'Release tracker: per-release post-deploy hotfix count within 7 days',
      tolerable: '70%',
      goal:      '90%',
      wish:      '99%',
      rationale: 'Hotfix rate is the lagging indicator of pre-release quality.',
    },
    {
      name:      'Fault Tolerance',
      scale:     'Service continues at acceptable performance after losing any single node',
      meter:     'Chaos engineering: random node termination during normal load',
      tolerable: 'Yes (with degradation)',
      goal:      'Yes (no measurable degradation)',
      wish:      'Yes + auto-replacement < 1 min',
      rationale: 'Single-node loss is the canonical failure scenario. If it breaks service, the system is fragile.',
    },
  ],

  accessibility: [
    {
      name:      'WCAG',
      scale:     '% of user-facing surfaces passing automated + manual WCAG 2.2 AA audit',
      meter:     'axe-core automated + accessibility specialist manual screen-reader audit',
      tolerable: '90%',
      goal:      '100% (AA)',
      wish:      '100% (AAA)',
      rationale: 'WCAG 2.2 is the global accessibility standard. AA is the legal floor in most jurisdictions.',
    },
    {
      name:      'Keyboard Navigation',
      scale:     '% of features fully operable without a pointing device',
      meter:     'Manual keyboard-only walkthrough by accessibility specialist',
      tolerable: '85%',
      goal:      '100%',
      wish:      '100% + visible focus indicator everywhere',
      rationale: 'Motor-impaired users + power users both benefit from full keyboard operation.',
    },
    {
      name:      'Color Contrast',
      scale:     '% of foreground/background pairs meeting WCAG AA contrast ratio',
      meter:     'Automated contrast audit (axe-core / Stark) on rendered surfaces',
      tolerable: '95%',
      goal:      '100% (AA, 4.5:1 normal, 3:1 large)',
      wish:      '100% (AAA, 7:1 normal, 4.5:1 large)',
      rationale: 'Tom Gilb: per accessibility_tom.md, age-related vision changes make this universal not niche.',
    },
    {
      name:      'Screen-Reader Compatibility',
      scale:     '% of features producing semantically correct screen-reader output',
      meter:     'NVDA + VoiceOver + JAWS test pass rate across primary user flows',
      tolerable: '85%',
      goal:      '95%',
      wish:      '100%',
      rationale: 'Screen-reader users represent the most demanding accessibility case; if it works here it works everywhere.',
    },
  ],

  portability: [
    {
      name:      'Platforms',
      scale:     'Number of target platforms with full feature parity',
      meter:     'Per-platform feature matrix: full / partial / unavailable',
      tolerable: '2 platforms',
      goal:      '4 platforms',
      wish:      'Universal (web + native iOS + Android + desktop)',
      rationale: 'Each additional platform multiplies addressable users but costs maintenance.',
    },
    {
      name:      'Install/Setup',
      scale:     'Minutes from download to first usable state on a target platform',
      meter:     'Cold install benchmark on representative hardware per platform',
      tolerable: '< 15 min',
      goal:      '< 3 min',
      wish:      '< 30 s',
      rationale: 'Install time is the conversion gate. Every extra minute halves conversion.',
    },
    {
      name:      'Migration',
      scale:     'Hours for an existing user to migrate full account/data to/from a competitor',
      meter:     'User-shadowing study: measure end-to-end migration time',
      tolerable: '< 8 h',
      goal:      '< 1 h',
      wish:      '< 5 min (automated)',
      rationale: 'Low migration cost = user trust. High migration cost = lock-in (anti-Incorruptible).',
    },
  ],

  efficiency: [
    {
      name:      'Value Efficiency',
      scale:     'Penta efficiency ratio (V achievement ÷ R utilisation)',
      meter:     'Penta Model deterministic computation from V. Status/Goal + R. Status/Budget',
      tolerable: '> 1.0',
      goal:      '> 1.5',
      wish:      '> 3.0',
      rationale: 'Gilb-Shalloway 2022 Penta Model. Ratio ≥ 1.5 is "excellent" per panel grade thresholds.',
    },
    {
      name:      'Cost Efficiency',
      scale:     'Total Resource cost ÷ units of Value delivered to stakeholders',
      meter:     'Resource budget consumed ÷ V. Status quantities aggregated',
      tolerable: '< $X per unit',
      goal:      '< $Y per unit',
      wish:      '< $Z per unit (set per stakeholder negotiation)',
      rationale: 'Per-unit cost is the lagging indicator that compounds across scale.',
    },
  ],
}

/** Tom's category labels and seeds for the four he explicitly named — these get default prominence in the picker. */
export const TOM_PRIORITY_CATEGORIES: ValueAspectCategory[] = ['usability', 'quality', 'maintainability', 'resilience']
