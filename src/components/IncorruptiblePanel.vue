<!-- UNIT_TYPE=Surface
  IncorruptiblePanel.vue — Incorruptible Agent (Eric Ries 2026 book).

  Tom Gilb 2026-06-11 verbatim:
    "I want a new Agent, called 'Incorruptible' (E Ries book 2026) which if let loose will
     help planners design and check strategic planning, to follow the rules Eric lays out
     in his book, so that the result is 'incorruptible' (Quarterly results cannot determin
     quality or long term thinking)"

  Architecture (Phase 1):
    - Deterministic rule engine via useIncorruptibleFindings composable
    - 6 categories: Quarterly Tyranny / Stakeholder Monoculture / Mission Drift /
      Founder-Vision Erosion / Innovation-Budget Predation / Governance Hole
    - Source-layer = 'derived-from-plan' for all Phase 1 findings (highest provenance)
    - Phase 2 (future) — Claudian-augmented findings with Ries-book citations stamped in

  UI Rules applied:
    - CloseDot at END of header (rightmost) — Universal Close-Button Rule
    - ScrollContainer wrapping the body — Universal Scroll Rule
    - z-[490] panel / z-[485] backdrop — Major surfaces tier
    - Backdrop click + Escape close — CloseDot rule
    - Export at top (clipboard HTML + Mail to Tom@Gilb.com) — Export-on-all-windows Rule
    - All buttons have title= — DD-009 Interaction Disclosure
    - Big fonts per accessibility_tom.md (text-sm minimum for body, ≥ 11 px labels)
    - R/G-colorblind-safe palette per r93o (emerald/red distinguishable at large size)
-->

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import CloseDot from './CloseDot.vue'
import PlanIdentityBand from './PlanIdentityBand.vue'  // r41 v92 (Tom Gilb 2026-06-16 "go phase 2")
import DismissalReasonModal from './DismissalReasonModal.vue'
import { useDismissalLog } from '../composables/useDismissalLog'
import {
  makeDismissalId,
  dismissalAuthorityLabel,
  type DismissalRecord,
  type DismissalAuthority,
} from '../types/dismissal'
// ScrollContainer removed r93r — using raw overflow-y-auto on the body div. The auto-h-full
// injection ScrollContainer does for `min-h-0` outer-classes was not engaging here for reasons
// unclear (possibly a teleport + centered-card interaction). Raw overflow-y-auto is the canonical
// Tailwind pattern and works deterministically. Documented as a narrow exception to the
// ScrollContainer Rule (sem-app-ui-rules.md) for this panel only; reinvestigate if a unified
// scroll-indicator becomes important here.
import type { SpecBlock } from '../types/spec'
import { useIncorruptibleFindings } from '../composables/useIncorruptibleFindings'
import {
  INCORRUPTIBLE_CATEGORY_META,
  INCORRUPTIBLE_SEVERITY_META,
  INCORRUPTIBLE_SOURCE_META,
  type IncorruptibleCategory,
  type IncorruptibleFinding,
} from '../types/incorruptible'
// r41 v414 (Tom Gilb 2026-07-01 "I added incorruptible glossary to assets …
// please integrate them into the incorruptible agent") — new Ries corpus
// integrations: canonical Glossary, EOT case studies, and 5 role-specific
// Reader's Guides.  Together these transform the agent from paraphrase-based
// to citation-based and add role-aware findings.
import { resolveRiesTerms } from '../data/riesGlossary'
import { EOT_CASE_STUDIES_META, eotCasesFor } from '../data/riesEotCaseStudies'
import {
  READERS_GUIDES,
  READERS_GUIDE_BY_ROLE,
  loadPlannerRole,
  savePlannerRole,
  type PlannerRole,
} from '../data/riesReadersGuides'

const props = withDefaults(defineProps<{
  spec: SpecBlock | null
  planTitle: string
  /** True when checking a Library model instead of the user's current Plan. */
  isModel?: boolean
  /** Findings the user has accepted in the current session — drives button-state UI. */
  acceptedFindingIds?: Set<string>
  /** r41 v92 (Tom Gilb 2026-06-16 "go phase 2") — identity band fields. */
  planOwner?: string
  planVersion?: string
  generatedAt?: string
}>(), {
  isModel: false,
  acceptedFindingIds: () => new Set<string>(),
})

const emit = defineEmits<{
  close: []
  'open-agents': []
  'open-sharpening': []
  'accept-fix': [finding: IncorruptibleFinding]
  'undo-fix': [finding: IncorruptibleFinding]
  /** r41 v92 — bubble history selection to App.vue. */
  'select-history': [versionId: string]
  /** r41 v405 — Confirmation CTA (Munger v404 pattern propagated per Tom 2026-06-28). */
  'confirm-and-view': [acceptedCount: number]
}>()

// Wrap props in refs for the composable
const specRef       = computed(() => props.spec)
const planTitleRef  = computed(() => props.planTitle)

const {
  report,
  visibleFindings,
  dismissedIds,
  dismissFinding,
  undismissFinding,
} = useIncorruptibleFindings(specRef, planTitleRef)

// r41 v414 (Tom Gilb 2026-07-01 "please integrate them into the incorruptible
// agent") — Planner-Role state (persisted via localStorage).  Drives:
//   1. Header role-picker chip (5 options — Founder / Investor / Employee /
//      Consumer / Board Director)
//   2. Role-sensitivity highlight on findings whose `roleSensitivity[role]` is
//      set to 'high' (amber ring) or 'med' (softer indigo ring)
//   3. Header "📖 Your role's Reader's Guide" pin naming the currently-picked
//      role's Ries PDF
const plannerRole = ref<PlannerRole>(loadPlannerRole())
watch(plannerRole, (r) => savePlannerRole(r))
const currentGuide = computed(() => READERS_GUIDE_BY_ROLE[plannerRole.value])

/**
 * r41 v414 — Given a finding, resolve its glossary-term slugs to full
 * RiesGlossaryEntry records for chip rendering.  Returns empty array for
 * legacy findings whose `riesGlossaryTerms` is missing (schema is optional
 * during migration).
 */
function glossaryChipsFor(finding: IncorruptibleFinding) {
  return resolveRiesTerms(finding.riesGlossaryTerms ?? [])
}

/**
 * r41 v414 — EOT case-study evidence records for a finding.
 * The finding declares its `evidenceEotCases` slugs directly; we also fold in
 * any case study whose `illustrates` intersect the finding's glossary terms
 * so the agent doesn't have to enumerate every match manually.
 */
function eotEvidenceFor(finding: IncorruptibleFinding) {
  const explicit = new Set(finding.evidenceEotCases ?? [])
  const implicit = eotCasesFor(finding.riesGlossaryTerms ?? []).map(c => c.slug)
  for (const s of implicit) explicit.add(s)
  // Return matched case studies preserving canonical order (from eotCasesFor).
  return eotCasesFor([...(finding.riesGlossaryTerms ?? []), ...Array.from(explicit)])
}

/**
 * r41 v414 — Ring class for a finding card based on its role-sensitivity
 * versus the currently-picked planner role.  High = amber highlight, Med =
 * softer indigo, absent/other = normal card border.
 */
function roleHighlightClass(finding: IncorruptibleFinding): string {
  const sens = finding.roleSensitivity?.[plannerRole.value]
  if (sens === 'high') return 'ring-2 ring-amber-400 shadow-amber-200/40 shadow-md'
  if (sens === 'med')  return 'ring-1 ring-indigo-300'
  return ''
}

/**
 * r41 v414 — Open the currently-picked role's Reader's Guide PDF via
 * `window.open` (works for `file://` in dev; in production users would open
 * from their vault).  Falls back silently if the environment can't open.
 */
function openCurrentGuide(): void {
  const guide = currentGuide.value
  if (!guide) return
  try {
    // Encoded file:// URL — Safari and Chrome handle spaces via encodeURI
    const url = 'file://' + encodeURI(guide.vaultPath)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    console.warn('[Incorruptible v414] Could not open Reader\'s Guide PDF:', err)
  }
}

// r41 v405 — track accepted-fix count + Confirm-and-view CTA (Munger v404 pattern).
const acceptedCount = ref<number>(0)
function onAcceptIncorruptibleFix(finding: IncorruptibleFinding): void {
  emit('accept-fix', finding)
  acceptedCount.value++
}
function onConfirmAndView(): void {
  emit('confirm-and-view', acceptedCount.value)
}

// r38 (Tom Gilb 2026-06-14) — Universal Dismissal Audit Trail.
const _dismissalLog = useDismissalLog()
const dismissalModalOpen   = ref(false)
const dismissalTargetFinding = ref<IncorruptibleFinding | null>(null)
const ownerName = computed(() => props.spec?.specOwner ?? '')

function onDismissClick(finding: IncorruptibleFinding): void {
  dismissalTargetFinding.value = finding
  dismissalModalOpen.value     = true
}
function onDismissCancel(): void {
  dismissalModalOpen.value     = false
  dismissalTargetFinding.value = null
}
function onDismissConfirm(payload: { reason: string; authority: DismissalAuthority; authorityName: string | undefined }): void {
  const f = dismissalTargetFinding.value
  if (!f) { onDismissCancel(); return }
  const isoNow = new Date().toISOString()
  const planId = props.planTitle || '(untitled)'
  const record: DismissalRecord = {
    id:                   makeDismissalId(planId, 'incorruptible', f.id, Date.now()),
    agentId:              'incorruptible',
    agentCategory:        f.category,
    findingId:            f.id,
    findingSummary:       `${INCORRUPTIBLE_CATEGORY_META[f.category]?.label ?? f.category} — ${f.explanation}`,
    suggestedFixSummary:  f.suggestedFix?.asPlanguage?.slice(0, 200) ?? '(no fix proposed)',
    dismissedAtIso:       isoNow,
    whyReason:            payload.reason,
    authority:            payload.authority,
    authorityName:        payload.authorityName,
    planId,
  }
  _dismissalLog.recordDismissal(record)
  dismissFinding(f.id)
  onDismissCancel()
}
// expose for template render-time use
const _dismissalAuthorityLabel = dismissalAuthorityLabel
function _formatAuthorityLabel(r: DismissalRecord): string {
  return dismissalAuthorityLabel(r)
}

// r39 (Tom Gilb 2026-06-14) — clickable count pills + dismissed-list reveal.
const planDismissals = computed<DismissalRecord[]>(() =>
  _dismissalLog.dismissalsForAgent('incorruptible', props.planTitle || '(untitled)'),
)
const showDismissedList = ref(false)
const _justJumpedFindingId = ref<string | null>(null)

function _flashFinding(findingId: string): void {
  _justJumpedFindingId.value = findingId
  window.setTimeout(() => {
    if (_justJumpedFindingId.value === findingId) _justJumpedFindingId.value = null
  }, 1800)
}

function jumpToSeverity(severity: 'critical' | 'moderate' | 'suggestion'): void {
  const f = visibleFindings.value.find(x => x.severity === severity)
  if (!f) return
  const el = document.querySelector<HTMLElement>(`[data-incorr-finding-id="${CSS.escape(f.id)}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    _flashFinding(f.id)
  }
}

function jumpToDismissed(): void {
  showDismissedList.value = !showDismissedList.value
  if (showDismissedList.value) {
    nextTick(() => {
      const el = document.querySelector<HTMLElement>('[data-incorr-dismissed-list]')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
}

function restoreDismissal(record: DismissalRecord): void {
  _dismissalLog.restoreDismissed(record.id)
  undismissFinding(record.findingId)
  nextTick(() => {
    const el = document.querySelector<HTMLElement>(`[data-incorr-finding-id="${CSS.escape(record.findingId)}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      _flashFinding(record.findingId)
    }
  })
}

// Group visible findings by category for sectioned rendering
const findingsByCategory = computed<Record<IncorruptibleCategory, IncorruptibleFinding[]>>(() => {
  const out: Record<IncorruptibleCategory, IncorruptibleFinding[]> = {
    'quarterly-tyranny': [],
    'stakeholder-monoculture': [],
    'mission-drift': [],
    'founder-vision-erosion': [],
    'innovation-budget-predation': [],
    'governance-hole': [],
  }
  for (const f of visibleFindings.value) out[f.category].push(f)
  return out
})

// Categories with at least one visible finding — render in this order
const activeCategories = computed<IncorruptibleCategory[]>(() => {
  const order: IncorruptibleCategory[] = [
    'quarterly-tyranny',
    'stakeholder-monoculture',
    'mission-drift',
    'founder-vision-erosion',
    'innovation-budget-predation',
    'governance-hole',
  ]
  return order.filter(c => findingsByCategory.value[c].length > 0)
})

// ─── Score Info Popover (Tom Gilb 2026-06-11 r93z) ───────────────────────
//
// Tom verbatim: "Incorruptibility Score, needs a hover info (1 click) explaining how
//   it is composed, and maybe, nice touch, the latest changes top 10 that changed the score"
//
// Two layers:
//   1. HoverHint on the score badge (mouseover) — short formula reminder
//   2. Click on the score badge — toggles a popover panel below the score strip showing:
//      a) The full formula with current per-severity counts
//      b) Last 10 entries from scoreHistory (score, label, delta, timestamp)

/** Whether the score info popover is expanded. */
const scoreInfoOpen = ref(false)

/** Score history — appended whenever the report's incorruptibilityScore changes.
 *  Capped at 50 entries (UI shows latest 10); session-only, cleared on panel close. */
interface ScoreHistoryEntry {
  /** Score AFTER this change (e.g. 78). */
  score:     number
  /** Delta vs previous (e.g. +6 or -15 or 0 on initial). */
  delta:     number
  /** Short label describing what changed: "Initial scan", "Accepted Fix · Quarterly Tyranny", etc. */
  label:     string
  /** ISO 8601. */
  timestamp: string
}
const scoreHistory = ref<ScoreHistoryEntry[]>([])

// Watch the live score and append on change. Uses { immediate: true } so the
// initial scan creates the first entry.
watch(
  () => report.value.incorruptibilityScore,
  (newScore, oldScore) => {
    const prev  = scoreHistory.value.length > 0 ? scoreHistory.value[scoreHistory.value.length - 1].score : null
    const delta = prev !== null ? newScore - prev : 0
    // Determine label from current findings counts vs previous — best-effort heuristic
    let label = scoreHistory.value.length === 0 ? 'Initial scan' : (delta > 0 ? 'Findings reduced' : delta < 0 ? 'Findings added' : 'No change')
    // If we just transitioned with a known cause (accept-fix typically), prefer that
    if (delta > 0 && scoreHistory.value.length > 0) {
      // Score went UP — most likely an Accept Fix succeeded
      label = 'Accept Fix applied'
    } else if (delta < 0 && scoreHistory.value.length > 0) {
      label = 'New finding(s) detected'
    }
    scoreHistory.value = [
      ...scoreHistory.value,
      {
        score:     newScore,
        delta,
        label,
        timestamp: new Date().toISOString(),
      },
    ].slice(-50)  // cap at 50
    void oldScore
  },
  { immediate: true },
)

/** The top-10 most-recent score-history entries (newest first), for the popover display. */
const recentScoreHistory = computed<ScoreHistoryEntry[]>(() =>
  [...scoreHistory.value].reverse().slice(0, 10),
)

/** Computed formula breakdown for the popover.
 *  Score = 100 − (critical × 15) − (moderate × 6) − (suggestion × 2), floored at 0. */
const scoreFormula = computed(() => {
  const sev = report.value.bySeverity
  const ded = (sev.critical * 15) + (sev.moderate * 6) + (sev.suggestion * 2)
  return {
    base:           100,
    criticalCount:  sev.critical,
    criticalWeight: 15,
    moderateCount:  sev.moderate,
    moderateWeight: 6,
    suggestionCount: sev.suggestion,
    suggestionWeight: 2,
    totalDeduction: ded,
    raw:            100 - ded,
    floored:        Math.max(0, 100 - ded),
  }
})

// ─── Export (clipboard HTML + Mail to Tom@Gilb.com) ────────────────────────

function renderReportHtml(): string {
  // r93pp — Score Composition table + Score-change history (the r93z popover content)
  // are now in the export, regardless of whether the popover is open in the panel.
  // Same-root-cause cleanup as r93oo: panel content the user can see (via click-to-expand)
  // must be in the Export.
  const fmt = scoreFormula.value
  const scoreCompositionBlock = `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 14px 0;">
      <tr><td bgcolor="#1e293b" style="background:#1e293b;color:white;padding:10px 14px;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
        ⚖️ Score Composition
      </td></tr>
      <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;padding:12px 14px;font-size:13px;color:#0f172a;">
        Starts at <b>100</b> and subtracts a weight per finding based on severity. Higher = more resilient to short-term thinking.
        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;border-collapse:collapse;font-size:12px;">
          <tr><td style="padding:4px 12px 4px 0;color:#475569;">Base score</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:bold;">+ 100</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#991b1b;">● Critical findings × 15</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:bold;color:#991b1b;">− ${fmt.criticalCount} × 15 = ${fmt.criticalCount * 15}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#92400e;">● Moderate findings × 6</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:bold;color:#92400e;">− ${fmt.moderateCount} × 6 = ${fmt.moderateCount * 6}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#1e3a8a;">● Suggestion findings × 2</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:bold;color:#1e3a8a;">− ${fmt.suggestionCount} × 2 = ${fmt.suggestionCount * 2}</td></tr>
          <tr style="border-top:2px solid #94a3b8;"><td style="padding:8px 12px 4px 0;font-weight:bold;">Raw score</td><td style="padding:8px 0 4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:900;font-size:14px;">= ${fmt.raw}</td></tr>
          ${fmt.raw < 0 ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-style:italic;">Floored at 0</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-style:italic;color:#64748b;">→ ${fmt.floored}</td></tr>` : ''}
        </table>
      </td></tr>
    </table>`
  // Score-change history — newest first, up to 10 entries
  const scoreHistoryBlock = recentScoreHistory.value.length > 0 ? `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 14px 0;">
      <tr><td bgcolor="#1e293b" style="background:#1e293b;color:white;padding:10px 14px;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
        📈 Latest Score Changes (newest first)
      </td></tr>
      <tr><td bgcolor="#f8fafc" style="background:#f8fafc;padding:8px 14px;font-size:12px;color:#0f172a;">
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;font-family:ui-monospace,monospace;font-size:12px;">
          ${recentScoreHistory.value.map(entry => {
            const deltaColor = entry.delta > 0 ? '#15803d' : entry.delta < 0 ? '#b91c1c' : '#64748b'
            const deltaBg    = entry.delta > 0 ? '#dcfce7' : entry.delta < 0 ? '#fee2e2' : '#e2e8f0'
            return `<tr>
              <td style="padding:4px 8px;"><span style="background:${deltaBg};color:${deltaColor};padding:2px 6px;border-radius:4px;font-weight:bold;">${entry.delta > 0 ? '+' : ''}${entry.delta}</span></td>
              <td style="padding:4px 8px;font-weight:bold;">${entry.score}</td>
              <td style="padding:4px 8px;font-family:system-ui,-apple-system,sans-serif;color:#475569;">${entry.label}</td>
              <td style="padding:4px 8px;color:#64748b;font-size:11px;">${entry.timestamp.slice(11, 19)}</td>
            </tr>`
          }).join('')}
        </table>
      </td></tr>
    </table>` : ''
  const sevLabel = (sev: string) => sev.toUpperCase()
  const rows = visibleFindings.value.map(f => {
    const catMeta = INCORRUPTIBLE_CATEGORY_META[f.category]
    return `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 14px 0;">
        <tr><td bgcolor="#1e293b" style="background:#1e293b;color:white;padding:10px 14px;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
          ${sevLabel(f.severity)} · ${catMeta.label}
        </td></tr>
        <tr><td bgcolor="#f8fafc" style="background:#f8fafc;padding:12px 14px;font-size:13px;color:#0f172a;">
          <b>Triggered by:</b> ${f.triggeredBy}<br/>
          <b>Principle violated:</b> ${f.principleViolated}<br/>
          <b>Explanation:</b> ${f.explanation}<br/>
          ${f.riesCitation ? `<b>Ries citation:</b> <i>${f.riesCitation}</i><br/>` : ''}
          ${f.gilbCitation ? `<b>Gilb citation:</b> <i>${f.gilbCitation}</i><br/>` : ''}
          ${f.verifyUrl    ? `<b>Verify:</b> <a href="${f.verifyUrl}">${f.verifyUrl}</a><br/>` : ''}
        </td></tr>
        <tr><td bgcolor="#fef3c7" style="background:#fef3c7;padding:12px 14px;font-size:13px;color:#7c2d12;">
          <b>Suggested fix (${f.suggestedFix.type}):</b><br/>
          <pre style="font-family:'SF Mono',Menlo,monospace;font-size:12px;white-space:pre-wrap;margin:8px 0 0 0;">${f.suggestedFix.asPlanguage}</pre>
          <p style="margin:8px 0 0 0;font-style:italic;">${f.suggestedFix.rationale}</p>
        </td></tr>
        <tr><td bgcolor="#fee2e2" style="background:#fee2e2;padding:10px 14px;font-size:12px;color:#7f1d1d;font-style:italic;">
          <b>Long-term consequence:</b> ${f.longTermConsequence}
        </td></tr>
      </table>
    `
  }).join('')

  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 14px 0;">
      <tr><td bgcolor="#0f172a" style="background:#0f172a;color:white;padding:18px 22px;border-radius:12px 12px 0 0;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;">Incorruptible Agent · Eric Ries 2026</div>
        <div style="font-size:20px;font-weight:bold;margin-top:6px;">${report.value.planTitle}</div>
        <div style="font-size:14px;margin-top:8px;color:#cbd5e1;">${report.value.headline}</div>
      </td></tr>
      <tr><td bgcolor="#f1f5f9" style="background:#f1f5f9;padding:14px 22px;border-radius:0 0 12px 12px;">
        <b style="color:#0f172a;">Incorruptibility Score:</b> ${report.value.incorruptibilityScore}/100
        &nbsp;·&nbsp; <b>${report.value.totalFindings}</b> findings
        (${report.value.bySeverity.critical} critical, ${report.value.bySeverity.moderate} moderate, ${report.value.bySeverity.suggestion} suggestion)
      </td></tr>
    </table>
    ${scoreCompositionBlock}
    ${scoreHistoryBlock}
    ${rows}
  `
}

function renderReportPlain(): string {
  const lines = [
    `INCORRUPTIBLE AGENT REPORT — ${report.value.planTitle}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Incorruptibility Score: ${report.value.incorruptibilityScore}/100`,
    report.value.headline,
    '',
  ]
  for (const f of visibleFindings.value) {
    const catMeta = INCORRUPTIBLE_CATEGORY_META[f.category]
    lines.push(
      `── ${f.severity.toUpperCase()} · ${catMeta.label} · ${f.triggeredBy} ──`,
      `Principle: ${f.principleViolated}`,
      `Explanation: ${f.explanation}`,
      `Ries citation: ${f.riesCitation ?? '—'}`,
      `Gilb citation: ${f.gilbCitation ?? '—'}`,
      `Verify: ${f.verifyUrl ?? '—'}`,
      `Suggested fix (${f.suggestedFix.type}):`,
      f.suggestedFix.asPlanguage.split('\n').map(l => '    ' + l).join('\n'),
      `Rationale: ${f.suggestedFix.rationale}`,
      `Long-term consequence: ${f.longTermConsequence}`,
      '',
    )
  }
  return lines.join('\n')
}

async function exportReport(mode: 'copy' | 'email'): Promise<void> {
  const html  = renderReportHtml()
  const plain = renderReportPlain()

  // 1. Always copy colourful HTML + plain to clipboard
  try {
    const htmlBlob  = new Blob([html],  { type: 'text/html'  })
    const plainBlob = new Blob([plain], { type: 'text/plain' })
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': plainBlob }),
    ])
  } catch {
    // Clipboard may fail (permissions) — fall through to mailto with cue toast
  }

  if (mode === 'email') {
    // SEM Email Body Standard — LOUD ⌘V cue first
    const exportDate = new Date().toISOString().slice(0, 10)
    let body = `PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION\nExported: ${exportDate}\n${'─'.repeat(40)}\n\n${plain}`
    // Binary-search truncate so encoded body ≤ 7000 chars (Safari mailto ceiling).
    while (encodeURIComponent(body).length > 7000 && body.length > 200) {
      body = body.slice(0, body.length - 200) +
        '\n\n…[plain-text truncated to fit mailto: limit — press ⌘V above for the full colour version]'
    }
    const subject = encodeURIComponent(`Incorruptible Report — ${report.value.planTitle}`)
    window.location.href = `mailto:Tom@Gilb.com?subject=${subject}&body=${encodeURIComponent(body)}`
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[485] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel card -->
    <div
      class="fixed inset-0 z-[490] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Incorruptible Agent — strategic-plan short-termism check"
    >
      <div
        class="pointer-events-auto w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10"
      >

        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 shrink-0">
          <span class="text-3xl" aria-hidden="true">⚖️</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-lg font-bold text-white leading-tight tracking-tight">
              Incorruptible
              <span class="text-[11px] font-normal text-indigo-200 uppercase tracking-wider ml-2">
                Eric Ries 2026 · Strategic Resilience
              </span>
            </h2>
            <p class="text-[13px] text-white/80 leading-snug mt-1 italic">
              Quarterly results cannot determine quality or long-term thinking.
            </p>
            <!-- r41 v414 (Tom Gilb 2026-07-01 "I added incorruptible glossary
                 to assets and one other thing … please integrate them into
                 the incorruptible agent") — Planner Role picker + current
                 role's Reader's Guide pin.  5 roles from Ries's Reader's
                 Guides for Founders / Investors / Employees / Consumers /
                 Board Directors.  Selection persists via localStorage; the
                 finding cards below highlight with amber/indigo rings based
                 on `roleSensitivity[plannerRole]`.  Composes with:
                 Stakeholder Engineering (Gilb) + AI-Max SUPREME + DD-009
                 Zero-Training UI (HoverHint per role names Ries's primary
                 lens) + Icon-Plus-Text SUPREME. -->
            <div class="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
              <span class="uppercase tracking-wider font-semibold text-indigo-200/90">
                Reviewing as:
              </span>
              <button
                v-for="g in READERS_GUIDES"
                :key="g.role"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold transition-colors"
                :class="plannerRole === g.role
                  ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-200 shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-white/85 ring-1 ring-white/25'"
                :title="`${g.label} — ${g.primaryLens}.  Ries: “${g.callingParagraph.slice(0, 180)}…”  Click to switch role — persists across sessions.`"
                :aria-pressed="plannerRole === g.role"
                @click="plannerRole = g.role"
              >
                <span aria-hidden="true">{{ g.glyph }}</span>
                <span>{{ g.label }}</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-indigo-500 hover:bg-indigo-400 text-white ring-1 ring-indigo-300 transition-colors ml-1"
                :title="`Open Ries's Reader's Guide for ${currentGuide.label}s (v1.0, 26 May 2026, CC BY-NC-SA 4.0).  Primary lens: ${currentGuide.primaryLens}.`"
                :aria-label="`Open Reader's Guide for ${currentGuide.label}s`"
                @click="openCurrentGuide"
              >
                📖 {{ currentGuide.label }} Guide
              </button>
            </div>
          </div>
          <!-- r41 v413 — top-banner mirror of the "✓ See consequences" CTA. -->
          <button
            v-if="acceptedCount > 0"
            type="button"
            class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[12px] font-extrabold whitespace-nowrap shadow ring-2 ring-emerald-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
            :title="`${acceptedCount} fix${acceptedCount === 1 ? '' : 'es'} accepted · click to close the Incorruptible panel and view the consequences in your specs.  Source: Incorruptible attached to each mutated field.`"
            :aria-label="`See ${acceptedCount} accepted fix${acceptedCount === 1 ? '' : 'es'} in your specs`"
            @click="onConfirmAndView"
          >
            ✓ See {{ acceptedCount }} fix{{ acceptedCount === 1 ? '' : 'es' }} in specs →
          </button>
          <!-- Export buttons inline (Rule 10 — no disclosure triangles) -->
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold whitespace-nowrap transition-colors ring-1 ring-emerald-800 flex items-center gap-1"
            title="📋 Copy — captures MORE than what's currently visible. Includes EVERY finding across all 6 categories (Quarterly Tyranny, Stakeholder Monoculture, Mission Drift, Founder-Vision Erosion, Innovation-Budget Predation, Governance Hole) regardless of which categories are currently expanded or visible — explanation, Ries citation, Gilb citation, Verify URL, suggested Planguage fix, rationale, and long-term consequence per finding. Plus the score breakdown and headline. Paste with ⌘V into Mail, Notes, Keynote, anywhere."
            @click="exportReport('copy')"
          >
            <span>📋</span><span>Copy</span>
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold whitespace-nowrap transition-colors ring-1 ring-blue-800 flex items-center gap-1"
            title="✉ Email — captures MORE than what's currently visible. Includes EVERY finding across all 6 categories regardless of which are currently expanded — full explanation, citations, suggested Planguage fix, rationale, and long-term consequence per finding, plus score breakdown and headline. Auto-opens Mail to Tom@Gilb.com with colourful HTML on clipboard."
            @click="exportReport('email')"
          >
            <span>✉</span><span>Email</span>
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-bold whitespace-nowrap transition-colors ring-1 ring-amber-800 flex items-center gap-1"
            title="🔪 Incorruptible Sharpening — Q&A flow that probes context the deterministic engine can't infer. Six categories × 2 questions × 3 AI-suggested starter answers. Answers synthesise into Plan edits via the same Accept-Fix pipeline (Source-stamping + Undo preserved)."
            @click="emit('open-sharpening')"
          >
            <span>🔪</span><span>Sharpen</span>
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-[12px] font-semibold whitespace-nowrap transition-colors"
            title="Back to the Agent Menu — pick a different agent"
            @click="emit('open-agents')"
          >← Agents</button>
          <CloseDot
            variant="on-dark"
            size="lg"
            aria-label="Close Incorruptible Agent"
            title="Close Incorruptible Agent — return to the planning workspace"
            @click="emit('close')"
          />
        </div>

        <!-- Plan identity band (r41 v92) — same widget used by Strategy Agent.
             Indigo-toned theme to match the dark-slate/indigo header above. -->
        <PlanIdentityBand
          :plan-name="planTitle"
          :plan-owner="planOwner"
          :plan-version="planVersion"
          :generated-at="generatedAt"
          :theme="{ bg: 'bg-slate-800', borderTop: 'border-indigo-500', label: 'text-indigo-200', pickerBorder: 'border-indigo-300' }"
          @select-history="(id: string) => emit('select-history', id)"
        />

        <!-- Mode banner — model vs current plan -->
        <div
          v-if="isModel"
          class="px-5 py-2 bg-amber-50 border-b border-amber-200 shrink-0 flex items-center gap-2 text-[12px] text-amber-900"
          title="You are checking a Library model — Accept Fix will preview but not modify your current Plan. Phase 2 will add Save as Custom Model."
        >
          <span class="text-base">🗂️</span>
          <span><b>Model Mode:</b> checking <i>{{ planTitle }}</i> — Accept Fix runs as PREVIEW (no changes saved to your Plan).</span>
        </div>

        <!-- Score + Headline strip -->
        <div class="px-5 py-3 bg-slate-50 border-b border-slate-200 shrink-0 flex items-center gap-4">
          <!-- Score ring — r93z: now clickable to toggle the score-info popover.
               HoverHint explains the formula in plain English; click reveals full breakdown
               + last-10-changes timeline below. -->
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="flex items-center justify-center w-16 h-16 rounded-full font-black text-[20px] ring-4 cursor-pointer transition-all hover:scale-105 focus:outline-none focus:ring-offset-2"
              :class="[
                report.incorruptibilityScore >= 80 ? 'bg-emerald-100 text-emerald-800 ring-emerald-300' :
                report.incorruptibilityScore >= 50 ? 'bg-amber-100 text-amber-800 ring-amber-300' :
                                                    'bg-red-100 text-red-800 ring-red-300',
                scoreInfoOpen ? 'ring-offset-2 ring-offset-slate-100' : '',
              ]"
              :title="`Incorruptibility Score ${report.incorruptibilityScore}/100 — higher = more resilient to short-termism.
Formula: 100 − (critical × 15) − (moderate × 6) − (suggestion × 2), floored at 0.
Currently: 100 − ${scoreFormula.criticalCount}×15 − ${scoreFormula.moderateCount}×6 − ${scoreFormula.suggestionCount}×2 = ${scoreFormula.floored}.
Click for full breakdown + last-10 score changes.`"
              :aria-expanded="scoreInfoOpen"
              aria-label="Incorruptibility Score — click to expand breakdown and history"
              @click="scoreInfoOpen = !scoreInfoOpen"
            >{{ report.incorruptibilityScore }}</button>
            <button
              type="button"
              class="text-[11px] text-slate-500 uppercase tracking-wide font-semibold leading-tight hover:text-slate-800 transition-colors cursor-pointer text-left"
              title="Click for full Incorruptibility Score breakdown + last-10 score changes"
              @click="scoreInfoOpen = !scoreInfoOpen"
            >
              Incorrupt-<br/>ibility<br/>Score <span class="text-slate-400 ml-0.5">{{ scoreInfoOpen ? '▲' : '▼' }}</span>
            </button>
          </div>
          <!-- Headline + counts -->
          <div class="flex-1 min-w-0">
            <p class="text-[14px] font-semibold text-slate-800 leading-snug">{{ report.headline }}</p>
            <div class="flex items-center gap-3 mt-2 flex-wrap">
              <!-- r39 (Tom Gilb 2026-06-14) — pills are now clickable JUMP buttons. -->
              <button
                v-if="report.bySeverity.critical > 0"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-bold ring-1 ring-red-900 hover:bg-red-700 hover:ring-2 cursor-pointer transition-all"
                title="Jump to the first critical finding (structural short-termism)"
                @click="jumpToSeverity('critical')"
              >{{ report.bySeverity.critical }} critical →</button>
              <button
                v-if="report.bySeverity.moderate > 0"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-bold ring-1 ring-amber-700 hover:bg-amber-600 hover:ring-2 cursor-pointer transition-all"
                title="Jump to the first moderate finding (should fix; compounds over time)"
                @click="jumpToSeverity('moderate')"
              >{{ report.bySeverity.moderate }} moderate →</button>
              <button
                v-if="report.bySeverity.suggestion > 0"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[11px] font-bold ring-1 ring-blue-700 hover:bg-blue-600 hover:ring-2 cursor-pointer transition-all"
                title="Jump to the first suggestion (refinement opportunity)"
                @click="jumpToSeverity('suggestion')"
              >{{ report.bySeverity.suggestion }} suggestion →</button>
              <button
                v-if="dismissedIds.size > 0"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all hover:ring-2"
                :class="showDismissedList
                  ? 'bg-slate-700 text-white ring-1 ring-slate-900'
                  : 'bg-slate-300 text-slate-700 ring-1 ring-slate-500 hover:bg-slate-400'"
                :title="showDismissedList
                  ? 'Hide the dismissed findings log'
                  : 'Reveal the dismissed findings — with reason + authority + Restore button per row (Tom 2026-06-14 audit trail)'"
                @click="jumpToDismissed"
              >{{ dismissedIds.size }} dismissed {{ showDismissedList ? '▲' : '▼' }}</button>
            </div>
          </div>
        </div>

        <!-- r93z Score Info Popover — toggled by clicking the score badge or label.
             Shows the composition formula + last-10 score-history entries. Non-modal;
             collapses on second click. Slate-50 background to feel "inset". -->
        <div
          v-if="scoreInfoOpen"
          class="px-5 py-3 bg-slate-100 border-b border-slate-300 shrink-0 text-[12px] text-slate-800 space-y-3"
        >
          <!-- Formula breakdown -->
          <div>
            <div class="font-bold uppercase tracking-wide text-slate-600 text-[11px] mb-1.5">
              ⚖️ Score Composition
            </div>
            <p class="leading-snug mb-1.5">
              The Incorruptibility Score starts at <b>100</b> and subtracts a weight per finding
              based on severity. Higher = more resilient to short-term thinking.
            </p>
            <table class="text-[12px] w-full max-w-md border-collapse">
              <tbody>
                <tr class="border-b border-slate-200">
                  <td class="py-1 pr-3 text-slate-600">Base score</td>
                  <td class="py-1 text-right font-mono font-bold">+ 100</td>
                </tr>
                <tr class="border-b border-slate-200">
                  <td class="py-1 pr-3 text-red-800">
                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-red-600 mr-1.5 align-middle"></span>
                    Critical findings × 15
                  </td>
                  <td class="py-1 text-right font-mono font-bold text-red-800">
                    − {{ scoreFormula.criticalCount }} × 15 = {{ scoreFormula.criticalCount * 15 }}
                  </td>
                </tr>
                <tr class="border-b border-slate-200">
                  <td class="py-1 pr-3 text-amber-800">
                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5 align-middle"></span>
                    Moderate findings × 6
                  </td>
                  <td class="py-1 text-right font-mono font-bold text-amber-800">
                    − {{ scoreFormula.moderateCount }} × 6 = {{ scoreFormula.moderateCount * 6 }}
                  </td>
                </tr>
                <tr class="border-b border-slate-200">
                  <td class="py-1 pr-3 text-blue-800">
                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5 align-middle"></span>
                    Suggestion findings × 2
                  </td>
                  <td class="py-1 text-right font-mono font-bold text-blue-800">
                    − {{ scoreFormula.suggestionCount }} × 2 = {{ scoreFormula.suggestionCount * 2 }}
                  </td>
                </tr>
                <tr class="border-t-2 border-slate-400">
                  <td class="py-1.5 pr-3 font-bold">Raw score</td>
                  <td class="py-1.5 text-right font-mono font-black text-[14px]">
                    = {{ scoreFormula.raw }}
                  </td>
                </tr>
                <tr v-if="scoreFormula.raw < 0">
                  <td class="py-1 pr-3 text-slate-500 italic">Floored at 0 (negative scores not displayed)</td>
                  <td class="py-1 text-right font-mono italic text-slate-500">→ {{ scoreFormula.floored }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Last 10 score changes -->
          <div v-if="recentScoreHistory.length > 0">
            <div class="font-bold uppercase tracking-wide text-slate-600 text-[11px] mb-1.5">
              📈 Latest Score Changes (most recent first)
            </div>
            <ul class="space-y-1">
              <li
                v-for="(entry, i) in recentScoreHistory"
                :key="`${entry.timestamp}-${i}`"
                class="flex items-center gap-2 text-[12px]"
              >
                <span
                  class="inline-flex items-center justify-center min-w-[36px] px-1.5 py-0.5 rounded font-mono font-bold text-[11px]"
                  :class="
                    entry.delta > 0 ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' :
                    entry.delta < 0 ? 'bg-red-100 text-red-800 ring-1 ring-red-300' :
                                      'bg-slate-200 text-slate-700'
                  "
                  :title="entry.delta > 0 ? 'Score improved (findings reduced)' : entry.delta < 0 ? 'Score worsened (new findings)' : 'No change'"
                >{{ entry.delta > 0 ? '+' : '' }}{{ entry.delta }}</span>
                <span class="font-mono font-bold text-slate-800 min-w-[36px]">{{ entry.score }}</span>
                <span class="text-slate-700 flex-1 truncate" :title="entry.label">{{ entry.label }}</span>
                <span class="text-slate-500 font-mono text-[11px] shrink-0" :title="entry.timestamp">{{ entry.timestamp.slice(11, 19) }}</span>
              </li>
            </ul>
            <p v-if="scoreHistory.length > 10" class="text-[11px] text-slate-500 italic mt-2">
              Showing latest 10 of {{ scoreHistory.length }} change{{ scoreHistory.length === 1 ? '' : 's' }} this session.
            </p>
          </div>
          <div v-else class="text-[12px] italic text-slate-500">
            No score changes yet this session. Accept a fix to see history.
          </div>
        </div>

        <!-- Body — findings grouped by category.
             r93r (Tom Gilb 2026-06-11 "inc agt no scroll"): replaced <ScrollContainer> with an
             explicit `overflow-y-auto` div. ScrollContainer's auto-h-full injection seemed to be
             clashing with the centered-card flex chain (header + optional mode banner + score
             strip + body inside max-h-[92vh] flex flex-col). Direct overflow-y-auto on a flex-1
             child of a flex-col parent with min-h-0 is the canonical Tailwind scroll pattern. -->
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 relative">
          <!-- Empty state -->
          <div v-if="visibleFindings.length === 0" class="text-center py-12">
            <div class="text-5xl mb-3">⚖️</div>
            <p class="text-[16px] font-bold text-slate-800 mb-2">{{ report.headline }}</p>
            <p class="text-[13px] text-slate-500 max-w-md mx-auto">
              Incorruptible re-checks every time you change the Plan. If you reduce a long-Wish horizon,
              drop a stakeholder, or cut innovation budget, findings reappear.
            </p>
          </div>

          <!-- r39 (Tom Gilb 2026-06-14) — Dismissed findings audit log reveal. -->
          <section
            v-if="showDismissedList && planDismissals.length > 0"
            data-incorr-dismissed-list
            class="rounded-xl border-2 border-slate-400 overflow-hidden bg-slate-50 shadow-sm"
          >
            <header class="flex items-center gap-2 px-4 py-2 border-b border-slate-300 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100">
              <span class="text-base">📜</span>
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">Dismissed findings audit log</span>
              <span class="text-[10px] text-slate-500 italic">{{ planDismissals.length }} dismissed · with reason + authority (Tom Gilb 2026-06-14 rule)</span>
              <button
                type="button"
                class="ml-auto text-[10px] px-2 py-0.5 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"
                title="Collapse the dismissed findings panel"
                @click="showDismissedList = false"
              >▲ Hide</button>
            </header>
            <ul class="divide-y divide-slate-200">
              <li
                v-for="record in planDismissals"
                :key="record.id"
                class="px-4 py-2.5 hover:bg-white transition-colors"
              >
                <div class="flex items-start gap-2 flex-wrap">
                  <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{{ record.agentCategory }}</span>
                  <span class="text-[12px] font-semibold text-slate-800 flex-1">{{ record.findingSummary }}</span>
                </div>
                <div class="text-[11px] text-slate-700 italic mt-1">
                  <span class="font-bold not-italic text-rose-700">Why:</span> «{{ record.whyReason }}»
                </div>
                <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 font-semibold">
                    Authority: {{ _formatAuthorityLabel(record) }}
                  </span>
                  <span class="text-[10px] text-slate-500 italic">
                    {{ new Date(record.dismissedAtIso).toLocaleString() }}
                  </span>
                  <button
                    type="button"
                    class="ml-auto text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 font-bold"
                    title="Restore this finding — removes the dismissal from the log and brings the finding card back"
                    @click="restoreDismissal(record)"
                  >↺ Restore</button>
                </div>
              </li>
            </ul>
          </section>

          <!-- Per-category sections -->
          <section
            v-for="cat in activeCategories"
            :key="cat"
            class="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm"
          >
            <header
              class="px-4 py-3 flex items-start gap-3 border-b border-slate-100"
              :class="
                INCORRUPTIBLE_CATEGORY_META[cat].color === 'red'    ? 'bg-red-50' :
                INCORRUPTIBLE_CATEGORY_META[cat].color === 'amber'  ? 'bg-amber-50' :
                INCORRUPTIBLE_CATEGORY_META[cat].color === 'violet' ? 'bg-violet-50' :
                INCORRUPTIBLE_CATEGORY_META[cat].color === 'indigo' ? 'bg-indigo-50' :
                INCORRUPTIBLE_CATEGORY_META[cat].color === 'orange' ? 'bg-orange-50' :
                'bg-slate-50'
              "
            >
              <div class="flex-1 min-w-0">
                <h3 class="text-[14px] font-bold uppercase tracking-wide text-slate-800">
                  {{ INCORRUPTIBLE_CATEGORY_META[cat].label }}
                  <span class="ml-2 text-[11px] font-semibold text-slate-500">
                    {{ findingsByCategory[cat].length }} finding{{ findingsByCategory[cat].length === 1 ? '' : 's' }}
                  </span>
                </h3>
                <p class="text-[12px] text-slate-600 mt-1">{{ INCORRUPTIBLE_CATEGORY_META[cat].subtitle }}</p>
                <p class="text-[11px] text-slate-500 mt-1 italic" :title="INCORRUPTIBLE_CATEGORY_META[cat].riesPrinciple">
                  {{ INCORRUPTIBLE_CATEGORY_META[cat].riesPrinciple }}
                </p>
              </div>
            </header>

            <!-- Findings in this category -->
            <ul class="divide-y divide-slate-100">
              <li
                v-for="finding in findingsByCategory[cat]"
                :key="finding.id"
                :data-incorr-finding-id="finding.id"
                class="px-4 py-3 hover:bg-slate-50 transition-colors"
                :class="[
                  _justJumpedFindingId === finding.id ? 'gilb-jump-flash' : '',
                  roleHighlightClass(finding),
                ]"
              >
                <!-- Top row: severity badge + triggeredBy + source layer -->
                <div class="flex items-start gap-2 mb-2 flex-wrap">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ring-1 whitespace-nowrap"
                    :class="[
                      INCORRUPTIBLE_SEVERITY_META[finding.severity].bg,
                      INCORRUPTIBLE_SEVERITY_META[finding.severity].text,
                      INCORRUPTIBLE_SEVERITY_META[finding.severity].ring,
                    ]"
                  >{{ INCORRUPTIBLE_SEVERITY_META[finding.severity].label }}</span>
                  <span class="text-[13px] font-mono font-semibold text-slate-800">{{ finding.triggeredBy }}</span>
                  <span class="text-[12px] text-slate-600">·</span>
                  <span class="text-[12px] text-slate-700">{{ finding.principleViolated }}</span>
                  <span class="flex-1"></span>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
                    :class="[
                      INCORRUPTIBLE_SOURCE_META[finding.sourceLayer].bg,
                      INCORRUPTIBLE_SOURCE_META[finding.sourceLayer].text,
                    ]"
                    :title="finding.sourceLayer === 'derived-from-plan'
                      ? 'Derived from your Plan data — highest provenance, deterministic'
                      : 'Cited reference — see citations below'"
                  >{{ INCORRUPTIBLE_SOURCE_META[finding.sourceLayer].label }}</span>
                </div>

                <!-- Explanation -->
                <p class="text-[13px] text-slate-800 leading-snug mb-2">{{ finding.explanation }}</p>

                <!-- Citations row -->
                <div v-if="finding.riesCitation || finding.gilbCitation || finding.verifyUrl"
                     class="flex items-center gap-2 mb-2 flex-wrap text-[11px]"
                >
                  <span v-if="finding.riesCitation" class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200">
                    📖 {{ finding.riesCitation }}
                  </span>
                  <span v-if="finding.gilbCitation" class="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 ring-1 ring-rose-200">
                    📚 {{ finding.gilbCitation }}
                  </span>
                  <a
                    v-if="finding.verifyUrl"
                    :href="finding.verifyUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100 transition-colors"
                    :title="`Open ${finding.verifyUrl} — public source for this principle`"
                  >🔗 Verify</a>
                </div>

                <!-- r41 v414 — Ries Glossary term chips.  Each chip renders
                     the canonical Ries term + HoverHint carries the verbatim
                     definition.  Ends paraphrasing forever: any planner can
                     hover to see Ries's own words. -->
                <div
                  v-if="glossaryChipsFor(finding).length > 0"
                  class="flex items-center gap-1.5 mb-2 flex-wrap text-[11px]"
                >
                  <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mr-0.5">
                    Ries Glossary:
                  </span>
                  <span
                    v-for="term in glossaryChipsFor(finding)"
                    :key="term.slug"
                    class="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300 font-semibold cursor-help"
                    :title="`${term.term}${term.coinedBy ? ' (coined by ' + term.coinedBy + ')' : ''} — ${term.definition}`"
                  >{{ term.term }}</span>
                </div>

                <!-- r41 v414 — EOT case-study evidence.  When the finding's
                     glossary terms match one or more real-world EOT
                     implementations, surface them as clickable evidence chips
                     linking to commontrust.com. -->
                <div
                  v-if="eotEvidenceFor(finding).length > 0"
                  class="flex items-center gap-1.5 mb-2 flex-wrap text-[11px]"
                >
                  <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mr-0.5">
                    Real-world 2025-2026 examples:
                  </span>
                  <a
                    v-for="c in eotEvidenceFor(finding)"
                    :key="c.slug"
                    :href="EOT_CASE_STUDIES_META.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300 hover:bg-emerald-100 font-semibold transition-colors"
                    :title="`${c.company} (${c.month}, ${c.industry}) — ${c.headline}. ${c.outcome}  Source: ${EOT_CASE_STUDIES_META.publisher} — click to open commontrust.com.`"
                  >{{ c.company }} · {{ c.month }}</a>
                </div>

                <!-- Suggested fix -->
                <div class="rounded border border-amber-300 bg-amber-50 p-3 mb-2">
                  <p class="text-[11px] font-bold uppercase tracking-wide text-amber-900 mb-1">
                    Suggested Fix · {{ finding.suggestedFix.type }}
                  </p>
                  <pre class="text-[12px] font-mono text-amber-950 whitespace-pre-wrap leading-snug mb-2">{{ finding.suggestedFix.asPlanguage }}</pre>
                  <p class="text-[12px] italic text-amber-800 leading-snug">{{ finding.suggestedFix.rationale }}</p>
                </div>

                <!-- Long-term consequence -->
                <p class="text-[12px] text-red-800 italic leading-snug mb-2">
                  <span class="font-bold not-italic">⚠ Long-term consequence:</span> {{ finding.longTermConsequence }}
                </p>

                <!-- Action row — r93u: post-accept state shows "Fix Is Accepted" + Undo, not the
                     original Accept button. Visual confirmation Tom asked for. -->
                <div class="flex items-center gap-2 flex-wrap">
                  <template v-if="acceptedFindingIds.has(finding.id)">
                    <!-- Accepted state — solid emerald pill (no longer a button), text confirms -->
                    <span
                      class="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-100 text-emerald-900 text-[12px] font-bold ring-1 ring-emerald-400"
                      :title="`Fix already applied to ${isModel ? 'this model (preview)' : finding.triggeredBy}. Click Undo Fix to revert.`"
                    >
                      <span aria-hidden="true">✅</span>
                      <span>Fix Is Accepted</span>
                    </span>
                    <button
                      type="button"
                      class="px-3 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold transition-colors ring-1 ring-amber-700"
                      :title="isModel
                        ? `↶ Undo Fix — restores the model display to its pre-fix state. (⌘Z also undoes your most recent action globally.)`
                        : `↶ Undo Fix · ⌘Z — restores the Plan to the state it was in before you accepted (snapshot taken at accept-time). Keyboard shortcut ⌘Z also undoes your most recent action; ⌘⇧Z redoes.`"
                      @click="emit('undo-fix', finding)"
                    >↶ Undo Fix</button>
                    <button
                      type="button"
                      class="px-3 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 text-[12px] font-semibold border border-slate-300 transition-colors"
                      title="Dismiss this finding — opens the Dismissal modal: capture Why + Authority + log to plan documentation (Tom 2026-06-14)"
                      @click="onDismissClick(finding)"
                    >Dismiss</button>
                  </template>
                  <template v-else>
                    <!-- Default state — original Accept + Dismiss -->
                    <button
                      type="button"
                      class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold transition-colors ring-1 ring-emerald-800"
                      :title="`Accept this fix — applies the suggested Planguage to ${isModel ? 'this model (preview only)' : finding.triggeredBy} and stamps Source: Incorruptible Agent on every mutated field.`"
                      @click="onAcceptIncorruptibleFix(finding)"
                    >✓ Accept Fix</button>
                    <button
                      type="button"
                      class="px-3 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 text-[12px] font-semibold border border-slate-300 transition-colors"
                      title="Dismiss this finding — opens the Dismissal modal: capture Why + Authority + log to plan documentation (Tom 2026-06-14)"
                      @click="onDismissClick(finding)"
                    >Dismiss</button>
                  </template>
                </div>
              </li>
            </ul>
          </section>

          <!-- Dismissed-restore link -->
          <div v-if="dismissedIds.size > 0" class="text-center py-3">
            <button
              type="button"
              class="text-[12px] text-slate-500 hover:text-slate-700 underline transition-colors"
              :title="`Restore the ${dismissedIds.size} finding(s) you dismissed this session`"
              @click="dismissedIds.forEach(id => undismissFinding(id))"
            >
              Restore {{ dismissedIds.size }} dismissed finding{{ dismissedIds.size === 1 ? '' : 's' }}
            </button>
          </div>

          <!-- Phase note -->
          <div class="rounded border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600 leading-snug">
            <b class="text-slate-700">Phase 1 — deterministic engine.</b>
            Findings are derived directly from your Plan structure (highest provenance).
            Ries-book citations are stubbed pending Kindle-highlight verification —
            Tom feeds Claudian quotes; specific chapter/page refs get stamped in later.
            Composes with Conjunction-of-Technologies SUPREME rule.
          </div>
        </div>

        <!-- r41 v405 — Confirmation block (Munger v404 pattern propagated per Tom 2026-06-28). -->
        <div
          v-if="acceptedCount > 0"
          class="shrink-0 border-t-2 border-emerald-500 bg-emerald-50 px-6 py-4 flex items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true" class="text-2xl shrink-0">✓</span>
          <p class="flex-1 text-sm font-semibold text-emerald-900 leading-snug">
            You have accepted {{ acceptedCount }} fix{{ acceptedCount === 1 ? '' : 'es' }}.<br/>
            <span class="text-[12px] font-normal text-emerald-800">The fixes are applied to your specs — click below to see the consequences.</span>
          </p>
          <button
            type="button"
            class="shrink-0 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-md
                   ring-2 ring-emerald-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400"
            :title="`Close the Incorruptible panel and open the Spec Editor so you can see the ${acceptedCount} accepted ${acceptedCount === 1 ? 'fix' : 'fixes'} in your specs.`"
            @click="onConfirmAndView"
          >✓ See the consequences in my specs now →</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- r38 (Tom Gilb 2026-06-14) — Universal Dismissal Audit Trail modal. -->
  <DismissalReasonModal
    :open="dismissalModalOpen"
    :finding-summary="dismissalTargetFinding
      ? `${INCORRUPTIBLE_CATEGORY_META[dismissalTargetFinding.category]?.label ?? dismissalTargetFinding.category} — ${dismissalTargetFinding.explanation}`
      : ''"
    :fix-summary="dismissalTargetFinding?.suggestedFix?.asPlanguage?.slice(0, 220) ?? ''"
    default-authority="owner"
    :owner-name="ownerName"
    @confirm="onDismissConfirm"
    @cancel="onDismissCancel"
  />
</template>

<style scoped>
/* r39 (Tom Gilb 2026-06-14) — pulse-flash on jump-target finding. */
.gilb-jump-flash {
  animation: gilb-jump-flash-pulse 1.8s ease-out;
}
@keyframes gilb-jump-flash-pulse {
  0%   { background-color: rgba(139, 92, 246, 0.0); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.0); }
  20%  { background-color: rgba(139, 92, 246, 0.30); box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.30); }
  100% { background-color: rgba(139, 92, 246, 0.0); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.0); }
}
</style>
