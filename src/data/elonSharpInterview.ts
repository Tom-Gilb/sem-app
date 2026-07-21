// UNIT_TYPE=Data
// elonSharpInterview.ts — Question/answer flow for Elon Sharpening.
//
// Tom Gilb 2026-06-13 verbatim categories:
//   Pace of Innovation (DOMINANT), Innovation, Incremental Improvement, Pace of Learning,
//   Safety, Destiny Control, Reusability, Modularization, Management Automatedness,
//   Testing Automation, Governance
//
// CRITICAL: pace-of-innovation is FIRST and dominant per Dove p. 8 "no other metric is
// above pace of innovation" (Justice 2022a). Its accent (cyan) is the strongest.
//
// 11 categories × 3 questions × 3 suggestions = 99 starter answers.
// All citations point to real pages in /tmp/musk-methods.txt and /tmp/dove-pace.txt.

import type { SourceProvenance } from './aiSource'

/** A single Elon-Sharpening question. */
export interface ElonSharpQuestion {
  id: string
  text: string
  rationale?: string
  placeholder?: string
  suggestedAnswers: string[]
  suggestedAnswerProvenances: SourceProvenance[]
}

/** A category groups related questions — matches ElonCategory in types/elon.ts. */
export interface ElonSharpCategory {
  id:
    | 'pace-of-innovation'
    | 'innovation'
    | 'incremental-improvement'
    | 'pace-of-learning'
    | 'safety'
    | 'destiny-control'
    | 'reusability'
    | 'modularization'
    | 'management-automatedness'
    | 'testing-automation'
    | 'governance'
  label: string
  description: string
  accent: string
  questions: ElonSharpQuestion[]
}

// ── Provenance shortcuts ────────────────────────────────────────────────────

const T = (note?: string): SourceProvenance => ({ source: 'template', note })
const M = (note: string): SourceProvenance => ({ source: 'gilb', note: `Musk's Methods · ${note}` })
const D = (note: string): SourceProvenance => ({ source: 'gilb', note: `Dove et al. · ${note}` })
const G = (note: string): SourceProvenance => ({ source: 'gilb', note: `Gilb · ${note}` })

// ── The eleven categories ───────────────────────────────────────────────────

export const ELON_SHARP_CATEGORIES: ElonSharpCategory[] = [

  // ── 1. Pace of Innovation (DOMINANT) ──────────────────────────────────────
  {
    id: 'pace-of-innovation',
    label: 'Pace of Innovation (DOMINANT)',
    description: 'Dove p. 8: "no other metric is above pace of innovation" — cycle time + iteration cadence',
    accent: 'bg-cyan-500',
    questions: [
      {
        id: 'pace-current-cadence',
        text: 'What is your CURRENT user-facing release cadence in days? How is it measured?',
        rationale: 'Dove et al. p. 8 (Justice 2022a): "Pace of innovation is the only thing that matters." Cycle time is the leading indicator of cumulative learning velocity.',
        placeholder: 'Days between releases + how you measure it (timestamps, deploy counter, etc.)…',
        suggestedAnswers: [
          'Current cadence: 90 days (quarterly release). Measured by timestamp of each production deploy. Gap to competitive pace: aim for ≤ 14 days per Musk\'s practice; ≤ 1 day per the Wish.',
          'Current cadence: 30 days (monthly). Measured by user-facing release-notes publication date. Target: halve to 14 days within next quarter; daily within next year.',
          'Current cadence: continuous (sub-daily). Measured by deploy counter + change-batch size. Risk: deploys are frequent but learning loops may not be — verify each deploy generates a measurable user-behaviour signal.',
        ],
        suggestedAnswerProvenances: [
          D('p. 8 — quarterly cadence too slow vs dominant-requirement'),
          M('p. 28 — high production rate → high iteration rate'),
          T('Continuous-delivery edge case — pace ≠ learning'),
        ],
      },
      {
        id: 'pace-bottleneck',
        text: 'What is the SINGLE bottleneck preventing 10× faster release cadence? Name it specifically.',
        rationale: 'Musk\'s Methods p. 2 Step 4: every process can be accelerated. Apply Steps 1-3 to the bottleneck first.',
        placeholder: 'The specific bottleneck — a process, tool, sign-off, test suite, regulatory step…',
        suggestedAnswers: [
          'Bottleneck: manual QA sign-off cycle (3 days per release). Apply Step 1: who specifically requires this? Step 2: can we replace with automated regression tests? Step 4 accelerates what survives.',
          'Bottleneck: legacy integration test suite (4 hours, blocks parallel deploys). Step 1: which integrations actually break? Step 2: delete tests for integrations no one uses. Step 4: parallelise what remains.',
          'Bottleneck: external review (security / regulatory / partner sign-off — 2 weeks). Step 1: who specifically asked and what failure are they preventing? Step 2: can we negotiate a higher-trust pre-approved scope?',
        ],
        suggestedAnswerProvenances: [
          M('p. 2 5-step applied to QA bottleneck'),
          M('p. 2 5-step applied to legacy tests'),
          M('p. 2 5-step applied to external sign-off'),
        ],
      },
      {
        id: 'pace-compounding',
        text: 'How will you ensure pace gains compound (not plateau)? What is your Wish-level cadence (NOT Goal)?',
        rationale: 'Musk\'s Methods p. 67: "constantly think about how you could be doing things better." Without a Wish, the Goal becomes the ceiling.',
        placeholder: 'Mechanism for sustained compounding + the asymptotic Wish target…',
        suggestedAnswers: [
          'Mechanism: every quarter the cycle-time Goal halves until Wish (continuous delivery) reached. Wish: deploys continuous; every user interaction is a potential learning signal.',
          'Mechanism: 2 dedicated engineering-time slots per Evo Step for pace-reduction work (one for tooling, one for process). Wish: 1-day cycle; same-day rollback if needed.',
          'Mechanism: pace is reviewed at every Evo retrospective alongside outcome. If pace did not improve, retrospective lists named blocker. Wish: hourly hotfix capability for critical paths.',
        ],
        suggestedAnswerProvenances: [
          D('p. 8 — continual innovation engineering'),
          M('p. 67 — constant feedback loop'),
          M('p. 46 — every incremental cycle motivates'),
        ],
      },
    ],
  },

  // ── 2. Innovation ─────────────────────────────────────────────────────────
  {
    id: 'innovation',
    label: 'Innovation',
    description: 'Genuinely new capability — not refinement of yesterday. Dove p. 8 central mission.',
    accent: 'bg-violet-500',
    questions: [
      {
        id: 'innovation-new-capability',
        text: 'Name ONE genuinely-new capability your plan ships this quarter that the product did NOT have last quarter.',
        rationale: 'Dove p. 8: "the driving objective is innovation." Refinements are necessary; innovation is the differentiator.',
        placeholder: 'A specific new capability that did not exist last quarter…',
        suggestedAnswers: [
          'New capability: self-serve onboarding without sales-rep contact (previously required guided demo). Net-new because it eliminates a class of human-touch entirely.',
          'New capability: in-product AI assistant that drafts user content from rough intent (previously only auto-complete on individual fields). Net-new = different category of help.',
          'New capability: cross-product data sync (was siloed per product). Net-new because it unlocks combinatorial use cases the products could not address individually.',
        ],
        suggestedAnswerProvenances: [
          D('p. 8 — innovation as central mission'),
          M('p. 34 Master Plan Part Deux — new capability targets'),
          M('p. 98 — capability composition like Tesla brain → Optimus'),
        ],
      },
      {
        id: 'innovation-rate',
        text: 'What is your innovation-rate Goal (new capabilities per quarter)? How will you measure NEW vs refinement?',
        rationale: 'Without a measure, "innovation" silently becomes "refinement". Per Musk\'s pace equation (p. 72).',
        placeholder: 'Goal new-capabilities-per-quarter + the test that distinguishes new from refinement…',
        suggestedAnswers: [
          'Goal: 3 new capabilities per quarter. Test: a capability is NEW if a user could not perform a task at all before (not faster, not easier — could not at all).',
          'Goal: 1 new capability per month. Test: documented by a NEW user-jobs-to-be-done entry; refinements amend existing jobs.',
          'Goal: 2 net-new per Evo Step + at least 1 transformational per quarter. Test: roadmap categorises every release as REFINE / EXTEND / TRANSFORM at intake.',
        ],
        suggestedAnswerProvenances: [
          D('p. 8 — innovation as objective'),
          M('p. 72 — pace + access + materials = innovation equation'),
          T('JTBD-based new-vs-refinement test'),
        ],
      },
      {
        id: 'innovation-resource-allocation',
        text: 'What fraction of engineering capacity is allocated to innovation vs incremental refinement? How is this enforced?',
        rationale: 'Without an allocation rule, urgent refinement always wins over important innovation.',
        placeholder: 'Allocation % + enforcement mechanism…',
        suggestedAnswers: [
          'Allocation: 70% refinement / 20% innovation / 10% exploration. Enforcement: backlog tags + weekly burn-down report; any week below 20% innovation flags as RED.',
          'Allocation: 50/50 refinement vs innovation. Enforcement: separate Evo Steps — odd weeks are refinement, even weeks innovation; team rotation prevents context-switch loss.',
          'Allocation: 80% refinement + 20% innovation. Enforcement: innovation work happens in a dedicated 2-day "moonshot" sprint Evo Step each month.',
        ],
        suggestedAnswerProvenances: [
          T('70/20/10 (Google-style 20% time)'),
          T('Alternating-Evo-Steps allocation'),
          T('Dedicated-moonshot allocation'),
        ],
      },
    ],
  },

  // ── 3. Incremental Improvement ────────────────────────────────────────────
  {
    id: 'incremental-improvement',
    label: 'Incremental Improvement',
    description: 'Continuous evolutionary refinement — Tesla 27 changes/wk + Gilb Evo small-step law',
    accent: 'bg-emerald-500',
    questions: [
      {
        id: 'ii-current-rate',
        text: 'What is your current measured-impact change rate (changes per week)? Tesla averages 60/day (Dove p. 6).',
        rationale: 'Dove p. 6 (Justice 2022): 60 part changes per day at Tesla. Without a count, "continuous improvement" is rhetoric.',
        placeholder: 'Changes per week + how you measure measured-impact…',
        suggestedAnswers: [
          'Current rate: 5 changes per week. Measured-impact = at least one quantitative success metric moved by ≥ 0.5% post-deploy. Target: 20/wk in 2 quarters.',
          'Current rate: unknown — we ship but do not track impact per change. First step: instrument every release with an impact-tagging mechanism.',
          'Current rate: 30 changes per week with measured impact tracked in a "change-log" table linked to telemetry. Target: 60/wk matching Tesla benchmark.',
        ],
        suggestedAnswerProvenances: [
          M('p. 46 — Dynamic Design to Cost incremental cycles'),
          G('Software Metrics 1976 p.214 — small steps with clear measure'),
          D('p. 6 — Tesla 60 changes/day benchmark'),
        ],
      },
      {
        id: 'ii-evo-step-size',
        text: 'What is your typical Evo Step duration? Does each step have a clear measured success criterion?',
        rationale: 'Gilb Software Metrics 1976 p.214: "implemented in small steps and each step has a clear measure of successful achievement."',
        placeholder: 'Evo Step duration + success-criterion mechanism…',
        suggestedAnswers: [
          'Evo Step duration: 2 weeks. Success criterion: each step targets ONE Value entry; success = Value Status moves toward Goal by a pre-stated delta. Failure = retreat to last good state.',
          'Evo Step duration: 1 week. Success criterion: pre-state a quantitative target on the V. entry; measured post-deploy with A/B comparison; binary pass/fail per Goal threshold.',
          'Evo Step duration: 1 day for refinements, 1 sprint Evo Step (2 wk) for cross-cutting. Success criterion lives in the Step charter and links to the relevant V. or F. entry.',
        ],
        suggestedAnswerProvenances: [
          G('Software Metrics 1976 p.214 — small steps with retreat'),
          G('EVO 2024 ch.2 — 9-step Evo cycle'),
          T('Variable-duration Evo Steps'),
        ],
      },
      {
        id: 'ii-retreat-readiness',
        text: 'Can you retreat (rollback) within ONE Evo Step if a change degrades performance? What\'s your retreat mean time?',
        rationale: 'Gilb 1976: "a retreat possibility to a previous successful step upon failure." Without retreat, increments become commitments.',
        placeholder: 'Retreat mechanism + measured retreat mean time…',
        suggestedAnswers: [
          'Retreat: feature flags with kill-switch ≤ 5 minutes; database changes are reversible via migration-undo scripts. Mean retreat time: 12 minutes (measured Q4).',
          'Retreat: blue-green deploys + automatic rollback on metric regression. Mean retreat time: 2 minutes (instrumented).',
          'Retreat: partial — kill switches exist for new code but database migrations are forward-only. Plan: add reverse migrations within next 2 Evo Steps.',
        ],
        suggestedAnswerProvenances: [
          G('Software Metrics 1976 p.214 — retreat possibility'),
          T('Feature-flag + blue-green pattern'),
          T('Honest gap — partial retreat'),
        ],
      },
    ],
  },

  // ── 4. Pace of Learning ───────────────────────────────────────────────────
  {
    id: 'pace-of-learning',
    label: 'Pace of Learning',
    description: 'Feedback → spec change velocity. Dove p. 6-7 DSM as instant feedback loop.',
    accent: 'bg-blue-500',
    questions: [
      {
        id: 'pol-current-loop-time',
        text: 'How long from in-production observation to a corresponding spec change? (Days from signal to spec edit.)',
        rationale: 'Dove p. 6-7: DSM "creates a real-time instant feedback loop". Tesla closes loops in seconds; most orgs in months.',
        placeholder: 'Mean days from telemetry signal to spec change…',
        suggestedAnswers: [
          'Current loop time: 30 days (we collect data weekly, review monthly, spec edits land in the next planning cycle). Target: 7 days.',
          'Current loop time: unknown — signals exist but are not formally traced to spec changes. First step: tag every spec edit with the triggering observation.',
          'Current loop time: same-day for top metrics (instrumented dashboards trigger spec-change PRs automatically); 14 days for secondary metrics. Target: same-day for all measured metrics.',
        ],
        suggestedAnswerProvenances: [
          D('p. 6-7 — DSM instant feedback'),
          T('No-trace baseline'),
          T('Tiered-loop edge case'),
        ],
      },
      {
        id: 'pol-instrumentation',
        text: 'What instrumentation exists to convert user behaviour into spec-grade observations? (DSM-equivalent.)',
        rationale: 'Dove p. 6: "hundreds of AI/ML software applications that learn, evolve, and provide data for personal decision making."',
        placeholder: 'Instrumentation surfaces + which behaviours they capture…',
        suggestedAnswers: [
          'Instrumentation: event-stream on every user action, aggregated into per-feature dashboards with anomaly alerts. Gaps: no instrumentation on admin features (low traffic, not prioritised).',
          'Instrumentation: ML models per critical workflow predicting expected user-action; deviation flags spec misfit. Gaps: only on consumer-facing surfaces; B2B integration paths uninstrumented.',
          'Instrumentation: basic Google Analytics + Sentry. Gap: no per-action telemetry, no per-feature impact tracking. First step: deploy product analytics with per-feature event tagging.',
        ],
        suggestedAnswerProvenances: [
          D('p. 6 — hundreds of AI/ML DSM apps'),
          T('ML-anomaly-detection instrumentation'),
          T('Baseline instrumentation gap'),
        ],
      },
      {
        id: 'pol-feedback-to-spec',
        text: 'Who is accountable for converting observed signals into spec changes? What is the SLA?',
        rationale: 'Without accountable ownership, signals accumulate without converting.',
        placeholder: 'Owner role + SLA for signal-to-spec conversion…',
        suggestedAnswers: [
          'Owner: PM per feature, with engineering co-signature. SLA: signal acknowledged within 1 week; spec change drafted within 2 weeks; merged within 4 weeks (or explicitly declined with rationale).',
          'Owner: data team triages, then routes to relevant feature owner. SLA: 48hr triage; 5-day spec proposal; 14-day commit.',
          'Owner: every Evo Step has a designated "learning curator" rotating among engineers. SLA: weekly summary; spec proposals batched at Evo Step boundary.',
        ],
        suggestedAnswerProvenances: [
          T('Per-feature PM ownership'),
          T('Data-triage-routing pattern'),
          T('Rotating learning curator'),
        ],
      },
    ],
  },

  // ── 5. Safety ─────────────────────────────────────────────────────────────
  {
    id: 'safety',
    label: 'Safety',
    description: 'Failure modes, blast radius, irreversibility. Musk\'s Methods p. 99 — "#1 design requirement".',
    accent: 'bg-red-500',
    questions: [
      {
        id: 'safety-irreversibility',
        text: 'List the 3 highest-blast-radius failure modes in your plan. For each, name the safeguard.',
        rationale: 'Musk\'s Methods p. 99 (AI Day): "number one design requirement at Tesla is safety." Irreversibility = critical.',
        placeholder: 'Per failure mode: blast-radius estimate + safeguard mechanism…',
        suggestedAnswers: [
          'Failure modes: (1) data corruption (blast = ALL users, irreversible), safeguard = encrypted-at-rest + hourly snapshots + integrity checks. (2) auth breach (blast = customer credentials), safeguard = MFA + per-session keys. (3) cascading outage, safeguard = circuit breakers + per-tenant isolation.',
          'Failure modes: (1) wrong-financial-transaction (blast = $$$ per user, partially reversible), safeguard = pre-execution confirmation + 24hr reversal window. (2) GDPR data-leak (blast = regulatory fines + brand), safeguard = data-egress monitoring + access logging. (3) AI-generated harmful output, safeguard = filter + human-review threshold.',
          'Failure modes: (1) device damage on incorrect command (blast = customer hardware), safeguard = command-validation + local stop button (Musk\'s Methods p. 99). (2) life-safety event in field, safeguard = automatic safe-mode + remote disable. (3) supply-chain compromise, safeguard = signed releases + verified-boot.',
        ],
        suggestedAnswerProvenances: [
          M('p. 99-100 — 11 levels of testing filters'),
          T('Financial / GDPR / AI risk frame'),
          M('p. 99 — local stop button irreversibility safeguard'),
        ],
      },
      {
        id: 'safety-cycle',
        text: 'Does your release cycle include automated safety checks? At what frequency? (Tesla: every release.)',
        rationale: 'Dove p. 6: "Speed of safety certification dictates iteration speed, so every car drives itself through an in-factory certification test."',
        placeholder: 'Safety check frequency + automation level…',
        suggestedAnswers: [
          'Safety checks: pre-merge static analysis (100% auto), post-deploy smoke tests (100% auto), weekly deeper safety scan (semi-auto, human review). Every release passes pre-merge + smoke automatically.',
          'Safety checks: only manual security review before major releases (quarterly). Gap: no per-release safety. First step: automate basic safety check for every deploy.',
          'Safety checks: continuous — every commit runs full safety suite (3-min cycle); production rollback triggers if any safety metric regresses post-deploy. Match Tesla in-factory cert model (Dove p. 6).',
        ],
        suggestedAnswerProvenances: [
          T('Tiered safety checks'),
          T('Honest baseline gap'),
          D('p. 6 — in-factory cert model'),
        ],
      },
      {
        id: 'safety-blast-radius-limit',
        text: 'For each new feature, is the blast radius bounded explicitly? How (canary, percentage rollout, tenant isolation)?',
        rationale: 'Bounded blast-radius is the engineering primitive that lets pace and safety coexist.',
        placeholder: 'Per-feature blast-radius bounding mechanism…',
        suggestedAnswers: [
          'Bounding: every new feature ships behind a feature flag + canary rollout (1% → 10% → 50% → 100% over 1 week). Auto-rollback on metric regression.',
          'Bounding: per-tenant isolation in infra; features can be enabled per-tenant; one tenant\'s failure cannot cascade to others.',
          'Bounding: dark-launch pattern — feature code runs in production but does not affect users until activated; activation = explicit per-cohort opt-in. Maximum potential blast = activated cohort size.',
        ],
        suggestedAnswerProvenances: [
          T('Canary rollout'),
          T('Tenant isolation'),
          T('Dark-launch pattern'),
        ],
      },
    ],
  },

  // ── 6. Destiny Control ────────────────────────────────────────────────────
  {
    id: 'destiny-control',
    label: 'Destiny Control',
    description: 'Supplier + jurisdiction independence. Musk\'s Methods p. 66 — Florida+Texas redundancy.',
    accent: 'bg-amber-500',
    questions: [
      {
        id: 'dc-critical-suppliers',
        text: 'Name your top 5 critical-path external dependencies. Which would HALT your roadmap if removed?',
        rationale: 'Musk\'s Methods p. 66 + Dove p. 6: Tesla\'s Autobidder polls suppliers on demand to avoid single-vendor lock.',
        placeholder: 'Each dependency + impact of losing it + current in-house / alternate-source status…',
        suggestedAnswers: [
          'Top deps: (1) AWS hosting, (2) Stripe payments, (3) Twilio SMS, (4) OpenAI API, (5) third-party SAML. Highest impact: OpenAI (model deprecation + cycle-time risk). In-house alternative: NONE. Recommendation: roadmap self-hosted LLM exploration.',
          'Top deps: (1) cloud CDN, (2) email-delivery vendor, (3) DNS, (4) cert authority, (5) Stripe. Lowest pain to bring in-house: CDN + email. Roadmap them within 12 months for resilience.',
          'Top deps: (1) GitHub, (2) Datadog, (3) Auth0, (4) Snowflake, (5) Salesforce. All external. Discussion: pick ONE to verticalise next year — likely identity (Auth0 → in-house).',
        ],
        suggestedAnswerProvenances: [
          M('p. 66 — redundancy avoids dependencies'),
          G('Gilb Resilience 2023 — supply-chain robustness'),
          M('p. 66 — verticalisation choice'),
        ],
      },
      {
        id: 'dc-jurisdiction',
        text: 'In WHICH legal jurisdiction is your plan operating? What is your alternative-jurisdiction fallback? (Delaware/Texas/EU/Singapore/etc.)',
        rationale: 'Musk\'s Methods p. 66: "redundancy is a tactic to deal with geographical and regulatory problems." Tesla DE → TX; SpaceX runs Cape Kennedy + Texas.',
        placeholder: 'Primary jurisdiction + named alternative + trigger to activate alternative…',
        suggestedAnswers: [
          'Primary: Delaware (US incorporation, mature corporate law). Alternative: Texas (lower regulatory burden, business-friendly). Trigger to relocate: state-level corporate-tax regime change OR adverse regulatory ruling.',
          'Primary: California (talent pool + market access). Alternative: Singapore (international hub + lower regulatory complexity). Trigger: CA regulatory hostility OR market shift to APAC.',
          'Primary: Ireland (EU base post-Brexit + tax). Alternative: Delaware (US fallback). Trigger: EU regulatory change (DSA / AI Act enforcement) OR Irish corporate-tax-regime change.',
        ],
        suggestedAnswerProvenances: [
          M('p. 66 — Florida+Texas geographic redundancy'),
          T('CA+SG bicontinental hedge'),
          T('IE+DE transatlantic hedge'),
        ],
      },
      {
        id: 'dc-cadence-vs-supplier',
        text: 'For each critical-path dependency: what is the supplier\'s release cadence? Does your Plan cycle exceed theirs?',
        rationale: 'If your cadence is faster than the supplier\'s, the supplier becomes the gating factor; you inherit their slowness.',
        placeholder: 'Per-dep cadence comparison + the gap…',
        suggestedAnswers: [
          'OpenAI: model updates every 2-6 months. Our cadence: 14 days. Gap: 4× faster than supplier — we wait for their changes. Mitigation: fine-tune in-house for most-used patterns; supplier becomes fallback.',
          'Stripe: API updates roughly monthly. Our cadence: 30 days. Same speed — Stripe not bottlenecking us. Monitor; verticalise only if our pace accelerates and theirs does not.',
          'Auth0: new features quarterly. Our cadence: 7 days. Auth0 is the dominant pace bottleneck. Verticalise within 12 months OR negotiate priority feature roadmap.',
        ],
        suggestedAnswerProvenances: [
          M('p. 66 — pace-vs-supplier gap'),
          T('Stripe pace comparison'),
          M('p. 66 — pace-vs-Auth0'),
        ],
      },
    ],
  },

  // ── 7. Reusability ────────────────────────────────────────────────────────
  {
    id: 'reusability',
    label: 'Reusability',
    description: 'Components shared across products. Musk\'s Methods p. 98 — Tesla brain in Optimus.',
    accent: 'bg-indigo-500',
    questions: [
      {
        id: 're-shared-components',
        text: 'What fraction of your codebase / components is REUSED across ≥ 2 products? Tesla\'s brain serves both cars + Optimus (p. 98).',
        rationale: 'Musk\'s Methods p. 67: SpaceX rocket reuse gave 20× capital efficiency. Reuse is the third axis of Musk\'s innovation equation.',
        placeholder: 'Reuse fraction + how you measure it…',
        suggestedAnswers: [
          'Reuse fraction: ~30% (auth, billing, telemetry shared; product logic bespoke per product). Measured by tagged shared-library imports. Target: 60%.',
          'Reuse fraction: unknown — no component registry. First step: catalog shared components + their consuming products.',
          'Reuse fraction: 70% — common platform handles auth/billing/data/UI primitives; only product-specific business logic is bespoke. Reach: 85% within 12 months by standardising remaining duplication.',
        ],
        suggestedAnswerProvenances: [
          M('p. 98 — Tesla brain → Optimus'),
          T('No-registry baseline'),
          T('Mature-platform edge case'),
        ],
      },
      {
        id: 're-cross-product-learnings',
        text: 'When a learning happens in Product A, how does it propagate to Product B that uses the same shared component?',
        rationale: 'Reuse without learning propagation is just code-sharing; the real value is compound learning across products.',
        placeholder: 'Cross-product-learning propagation mechanism…',
        suggestedAnswers: [
          'Mechanism: shared-component owners run a weekly cross-product sync; any change with measured impact is documented and propagated. Documented in a shared learnings doc.',
          'Mechanism: telemetry from ALL products feeds into one analytics warehouse; shared-component team queries cross-product anomalies + lands fixes once.',
          'Mechanism: changelog auto-publishes to all consuming products; each consumer team reviews + adopts. Audited at quarterly cross-team retros.',
        ],
        suggestedAnswerProvenances: [
          T('Weekly cross-product sync'),
          T('Unified analytics warehouse'),
          T('Auto-changelog + retro audit'),
        ],
      },
      {
        id: 're-capital-efficiency',
        text: 'How does reuse increase your capital efficiency? Have you measured the multiplier (Musk\'s 20× for rockets, p. 67)?',
        rationale: 'Musk\'s Methods p. 67: "be 20x more productive, for its capital cost, compared to planes." Reusability = capital efficiency = the third axis of Musk\'s innovation equation.',
        placeholder: 'Reuse multiplier + how you measured it…',
        suggestedAnswers: [
          'Multiplier: 3× — building a new product takes 3 months vs 9 months without shared components. Measured by comparing two recent product launches with/without platform reuse.',
          'Multiplier: not measured. Hypothesis: 2-4× based on engineering hours saved. First step: instrument time-to-launch for next 2 products vs reference baseline.',
          'Multiplier: 5-10× depending on product complexity. Measured by FTE-months per product launch over 3 years. Standardised platform investments are the single biggest cost-reduction lever.',
        ],
        suggestedAnswerProvenances: [
          M('p. 67 — 20× capital efficiency from reusability'),
          T('Unmeasured-but-hypothesised baseline'),
          M('p. 67 — FTE-month multiplier'),
        ],
      },
    ],
  },

  // ── 8. Modularization ─────────────────────────────────────────────────────
  {
    id: 'modularization',
    label: 'Modularization',
    description: 'Decoupled swappable subsystems. Dove p. 5 — "dominant mental pattern at Tesla".',
    accent: 'bg-teal-500',
    questions: [
      {
        id: 'mod-interface-stability',
        text: 'How many of your module interfaces are STABLE (versioned, semver-guaranteed, no breaking changes)?',
        rationale: 'Musk\'s Methods p. 27-28: "If you have stable component interfaces you can radically improve your component models continuously."',
        placeholder: 'Interface stability % + the versioning mechanism…',
        suggestedAnswers: [
          'Stable interfaces: 60% — public APIs versioned with semver; internal interfaces still in flux. Target: 90% within 12 months.',
          'Stable interfaces: 100% — every cross-module call goes through a versioned contract; breaking changes require deprecation period. Inspired by Dove\'s "Adaptable Modular Architectures" (p. 5).',
          'Stable interfaces: 20% — most cross-module calls are direct function imports without versioning. First step: identify the top-5 most-changed interfaces and version them.',
        ],
        suggestedAnswerProvenances: [
          M('p. 27 — stable interfaces enable continuous improvement'),
          D('p. 5 — Adaptable Modular Architectures'),
          T('Baseline-coupling gap'),
        ],
      },
      {
        id: 'mod-swap-time',
        text: 'What is your module-swap mean time? Tesla benchmark: ≤ 5 minutes, no special tools (p. 28).',
        rationale: 'Musk\'s Methods p. 28 (Joe Justice SpaceX): missile redesign for "plug-and-play disconnected, and reconnected, in less than 5 minutes."',
        placeholder: 'Module-swap mean time + how it was measured…',
        suggestedAnswers: [
          'Module-swap time: 30 minutes (compile + test + deploy single module). Target: 5 minutes via hot-reload + per-module CI pipelines.',
          'Module-swap time: 2 hours (service deploys are coordinated weekly). Gap: deploys are batched, not per-module. First step: decouple deploy pipelines per module.',
          'Module-swap time: 30 seconds (containerised services with per-module deploy). Match Tesla benchmark; investigate sub-10-second goal.',
        ],
        suggestedAnswerProvenances: [
          M('p. 28 — 5-minute plug-and-play target'),
          T('Batched-deploy gap'),
          T('Containerised edge case'),
        ],
      },
      {
        id: 'mod-parallel-evolution',
        text: 'Can modules evolve INDEPENDENTLY? (Modules can be updated without breaking each other.) How is this enforced?',
        rationale: 'Dove p. 5: "Interconnect specs evolve asynchronously with backward compatible adaptors." Without this, parallel evolution is impossible.',
        placeholder: 'Independent-evolution enforcement mechanism…',
        suggestedAnswers: [
          'Enforcement: contract tests on every module interface; CI blocks merges that break the contract. Modules can independently release; consumers use a "shim" adapter to bridge versions.',
          'Enforcement: each module has its own release train; cross-module dependencies are explicit and versioned. Breaking changes follow a 90-day deprecation cycle.',
          'Enforcement: WEAK — modules are technically separate services but coupled tightly via shared database schemas. First step: introduce schema versioning + per-module read APIs.',
        ],
        suggestedAnswerProvenances: [
          M('p. 27 — radical continuous improvement'),
          D('p. 5 — asynchronous evolution with backward-compat adaptors'),
          T('Honest weak-enforcement baseline'),
        ],
      },
    ],
  },

  // ── 9. Management Automatedness ───────────────────────────────────────────
  {
    id: 'management-automatedness',
    label: 'Management Automatedness',
    description: 'Routine decisions automated; humans handle exceptions. Dove p. 6-7 DSM.',
    accent: 'bg-slate-500',
    questions: [
      {
        id: 'ma-automation-fraction',
        text: 'What fraction of routine management decisions (approvals, sign-offs, prioritisations) is AUTOMATED?',
        rationale: 'Dove p. 6-7 (Justice 2023b): "why would we ever ask a human to decide this?!" At Tesla "your manager is data".',
        placeholder: 'Automated-decision fraction + which decision classes…',
        suggestedAnswers: [
          'Automation: 30% — routine PR approvals + low-risk deployments auto-merge if CI passes; everything else needs human review. Target: 70%.',
          'Automation: 80% — policy-as-code for compliance, automated budget checks, rule-based feature-flag activation. Humans handle escalations + novel cases only.',
          'Automation: 10% — almost everything routes through a human. First step: identify the top-5 most-routine approvals + automate.',
        ],
        suggestedAnswerProvenances: [
          T('Tiered baseline'),
          D('p. 6-7 — DSM extensive automation'),
          T('Honest baseline-low gap'),
        ],
      },
      {
        id: 'ma-exception-handling',
        text: 'When AUTOMATION can\'t decide, how is the exception routed to a human? What\'s the SLA?',
        rationale: 'Without a clear exception path, automation either over-includes (auto-decisions humans should make) OR under-includes (humans bottleneck on edge cases).',
        placeholder: 'Exception-routing mechanism + SLA…',
        suggestedAnswers: [
          'Routing: automated system flags exception with full context to a slack channel watched by on-call manager. SLA: 1hr ack, 4hr resolution. Common exceptions feed back to refine the automation rules.',
          'Routing: queue with priority scoring; human reviewer pulls from top. SLA: 24hr for routine exceptions, 1hr for high-impact (flagged by impact heuristic).',
          'Routing: weekly batch review by management team — exceptions accumulate and are batch-decided. Gap: SLA too slow for urgent decisions. First step: tier exceptions by urgency.',
        ],
        suggestedAnswerProvenances: [
          T('Slack-channel routing'),
          T('Priority-queue routing'),
          T('Honest gap — batch review'),
        ],
      },
      {
        id: 'ma-decision-data-trail',
        text: 'Are automated decisions LOGGED with their data inputs so they can be audited + tuned?',
        rationale: 'Without an audit trail, automated decisions become an opaque black box. Dove p. 6: data drives the decisions.',
        placeholder: 'Decision-log + audit mechanism…',
        suggestedAnswers: [
          'Log: every automated decision records inputs, rule applied, outcome. Stored 90 days; queryable dashboard. Quarterly tuning review based on exception rate.',
          'Log: partial — high-stakes decisions logged; routine decisions not. First step: standardise logging schema across all decision systems.',
          'Log: NONE — automated decisions happen in code without trace. First step: instrument decision points; introduce versioned decision rules.',
        ],
        suggestedAnswerProvenances: [
          T('Mature decision-log pattern'),
          T('Partial-log gap'),
          T('No-log baseline'),
        ],
      },
    ],
  },

  // ── 10. Testing Automation ────────────────────────────────────────────────
  {
    id: 'testing-automation',
    label: 'Testing Automation',
    description: 'Automated test coverage + cycle time. Musk Step 5 + Tesla in-factory NHTSA self-cert.',
    accent: 'bg-orange-500',
    questions: [
      {
        id: 'ta-coverage',
        text: 'What is your automated-test coverage % per release? What is your automated-test cycle time?',
        rationale: 'Musk\'s Methods p. 99-100: "11 Levels of filters before customer release." Dove p. 6: every Tesla car self-certifies vs NHTSA.',
        placeholder: 'Coverage % + cycle time + how they\'re measured…',
        suggestedAnswers: [
          'Coverage: 80% (statement) / 60% (branch). Cycle time: 15 minutes. Target: 95% / 80% coverage + ≤ 10 min cycle.',
          'Coverage: 95%+ across critical paths; 70% overall. Cycle time: 5 minutes (parallel CI). Match Tesla benchmark of every-release-self-cert.',
          'Coverage: 40% — many manual tests. Cycle time: 2 hours (sequential). First step: identify the top-5 most-manual test gates + automate.',
        ],
        suggestedAnswerProvenances: [
          T('Tiered baseline'),
          M('p. 99-100 — 11 testing levels'),
          T('Honest baseline-low gap'),
        ],
      },
      {
        id: 'ta-prod-monitoring',
        text: 'Beyond pre-release tests: how do you AUTOMATICALLY detect quality regression in production?',
        rationale: 'Pre-release testing alone is insufficient at high pace. Production monitoring closes the loop.',
        placeholder: 'Production-monitoring mechanism + auto-rollback trigger…',
        suggestedAnswers: [
          'Monitoring: SLO-based alerts on top-50 KPIs; auto-rollback on threshold breach within 5 minutes. Real-user-monitoring (RUM) for client-side regressions.',
          'Monitoring: synthetic transactions every 1 minute on critical paths; canary metrics compared to baseline + auto-pause new deploys if regression.',
          'Monitoring: error-rate + latency dashboards reviewed manually by on-call. Gap: no auto-rollback. First step: define rollback thresholds + automate trigger.',
        ],
        suggestedAnswerProvenances: [
          T('SLO-alert + auto-rollback'),
          T('Synthetic + canary'),
          T('Manual-review gap'),
        ],
      },
      {
        id: 'ta-musk-step-5',
        text: 'Have Steps 1-4 (question, delete, simplify, accelerate) been applied to your TEST processes themselves? Or did you automate before deleting?',
        rationale: 'Musk\'s Methods p. 2 Step 5: "Automate — LAST. ... if a product is reaching the end of a production line with a high acceptance rate, there is no need for in-process testing."',
        placeholder: 'Step 1-4 audit on your test pipeline…',
        suggestedAnswers: [
          'Audit: Step 1 done (we questioned which tests catch real bugs — 40% don\'t). Step 2 partial — deleted 30% of low-value tests. Step 3 simplifying test scaffolding. Step 4 parallelising. Ready for Step 5 automation expansion.',
          'Audit: NOT done — we automate every test we write and never delete. Result: 4-hour test cycle on flaky suite. STOP automation; apply Steps 1-2 first.',
          'Audit: regular quarterly test pruning + bug-rate review by test. Tests that haven\'t caught a bug in 12 months become candidates for deletion (Musk Step 2 applied to tests themselves).',
        ],
        suggestedAnswerProvenances: [
          M('p. 2 — Steps 1-4 then Step 5'),
          M('p. 2 — automate-before-deleting failure mode'),
          M('p. 2 — Step 2 applied to tests'),
        ],
      },
    ],
  },

  // ── 11. Governance ────────────────────────────────────────────────────────
  {
    id: 'governance',
    label: 'Governance',
    description: 'Decision rights, accountability cadences, charter integrity. Musk\'s Methods p. 106 MBO.',
    accent: 'bg-rose-500',
    questions: [
      {
        id: 'gov-decision-rights',
        text: 'For each major decision class (architecture / hire / spend / launch), WHO has unilateral decision rights? Named, not departmental.',
        rationale: 'Musk\'s Methods p. 2 Step 1: "each required part and process must come from a name, not a department, as a department cannot be asked why a requirement exists, but a person can."',
        placeholder: 'Decision class + named owner + escalation trigger…',
        suggestedAnswers: [
          'Decisions: architecture → CTO; hiring (engineer) → hiring manager + 1 senior peer; spend < $10K → manager; spend > $10K → CFO + named approver; launch → product VP. Escalation = 24hr SLA if unilateral owner unavailable.',
          'Decisions: most decisions consensus-based across team. Gap: slow + diffuse accountability. First step: name unilateral decider per class for the next quarter; review outcomes.',
          'Decisions: code-level → engineer; product-feature → PM + tech-lead pair; cross-product → executive committee. Charter document names each + reviewed quarterly.',
        ],
        suggestedAnswerProvenances: [
          M('p. 2 — named-not-departmental Step 1'),
          T('Honest consensus-baseline gap'),
          M('p. 106 — MBO empowered teams'),
        ],
      },
      {
        id: 'gov-accountability-cadence',
        text: 'At what cadence are objectives reviewed + held accountable? Who runs the review?',
        rationale: 'Musk\'s Methods p. 106: "management by objectives — setting clear goals and objectives for employees and empowering them to make their own decisions on how to achieve those goals."',
        placeholder: 'Review cadence + responsible role + what happens on miss…',
        suggestedAnswers: [
          'Cadence: weekly per-team KPI review (engineering lead); monthly cross-team OKR review (founders); quarterly strategic objective review (board). Misses trigger root-cause analysis within 1 week.',
          'Cadence: quarterly objective review only. Gap: misses surface too late. First step: introduce monthly check-ins; weekly for top-3 critical metrics.',
          'Cadence: monthly OKR check-in + quarterly board OKR. Per-team weekly stand-up tracks progress. Misses surface immediately via dashboards; no separate review needed.',
        ],
        suggestedAnswerProvenances: [
          T('Tiered cadence pattern'),
          T('Honest baseline gap'),
          M('p. 106 — empowered + tracked'),
        ],
      },
      {
        id: 'gov-charter-integrity',
        text: 'Do you have an explicit governance charter? When was it last reviewed? How are constraints documented with named askers?',
        rationale: 'Dove p. 7: Tesla\'s 3.5-page employee handbook is the explicit charter. Without an explicit charter, governance defaults to unwritten norms.',
        placeholder: 'Charter status + last review + asker-naming mechanism…',
        suggestedAnswers: [
          'Charter: written in Notion, last reviewed 6 months ago. Constraints in spec link to the asker (specific person + email/Slack reference). Pending: refresh charter; surface unowned constraints in PHI.',
          'Charter: NONE. First step: write the 1-page charter (decision rights + escalation + accountability cadences) within 1 week. Inspired by Tesla\'s 3.5-page handbook (Dove p. 7).',
          'Charter: comprehensive doc reviewed quarterly. Every Constraint in the spec MUST cite a named Source: <person> or it cannot merge. Plan Health Indicator flags unowned constraints as RED.',
        ],
        suggestedAnswerProvenances: [
          T('Partial charter baseline'),
          D('p. 7 — 3.5-page Tesla handbook'),
          M('p. 2 — Step 1 named-asker enforcement'),
        ],
      },
    ],
  },
]

/** Total question count across all categories. */
export function totalElonSharpQuestions(): number {
  return ELON_SHARP_CATEGORIES.reduce((sum, cat) => sum + cat.questions.length, 0)
}

export function getElonSharpCategory(id: string): ElonSharpCategory | undefined {
  return ELON_SHARP_CATEGORIES.find(c => c.id === id)
}
