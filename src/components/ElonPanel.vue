<!-- UNIT_TYPE=Surface
  ElonPanel.vue — Elon Agent (Musk's Methods book + Dove et al. Pace-of-Innovation paper).

  Tom Gilb 2026-06-12 verbatim:
    "OK Major new Agent: 'Elon': will be based on my Musks Methods book, and will use it as
     a source of evaluating and sharpening a plan or model. The pattern is Incorruptible
     (based on Ries). Just make it, you have the MM book. One critical detail:
     'Pace of Innovation' is the dominant Requirements (as quoted in Dove et all, Paper,
     Ill put that in assets."

  Architecture (Phase 1):
    - Deterministic rule engine via useElonFindings composable
    - 9 categories — Pace of Innovation (DOMINANT) + Musk 5-step (Question / Delete /
      Simplify / Accelerate / Automate) + First-Principles + Vertical Integration + Idiot Index
    - Source-layer = 'derived-from-plan' for all Phase 1 findings (highest-confidence Source)
    - Phase 2 (future) — Claudian-augmented findings with Musk's Methods + Dove paper citations
      stamped in once Tom adds the asset PDFs to the vault

  UI Rules applied:
    - CloseDot at END of header (rightmost) — Universal Close-Button Rule
    - Raw overflow-y-auto on body — narrow exception per centered Teleport card pattern
    - z-[490] panel / z-[485] backdrop — Major surfaces tier
    - Backdrop click + Escape close — CloseDot rule
    - Export at top (clipboard HTML + Mail to Tom@Gilb.com) — Export-on-all-windows Rule
    - All buttons have title= — DD-009 Interaction Disclosure (HoverHints)
    - American English; spell out type names; no "tooltip" — banned word
    - R/G-colorblind-safe palette: pace-of-innovation uses cyan (electric blue) — distinguishable
-->

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import CloseDot from './CloseDot.vue'
import PlanIdentityBand from './PlanIdentityBand.vue'  // r41 v92 (Tom Gilb 2026-06-16 "go phase 2")
import DismissalReasonModal from './DismissalReasonModal.vue'
import type { SpecBlock } from '../types/spec'
import { useElonFindings } from '../composables/useElonFindings'
import { useDismissalLog } from '../composables/useDismissalLog'
import {
  ELON_CATEGORY_META,
  ELON_SEVERITY_META,
  ELON_SOURCE_META,
  type ElonCategory,
  type ElonFinding,
} from '../types/elon'
import {
  makeDismissalId,
  dismissalAuthorityLabel,
  type DismissalRecord,
  type DismissalAuthority,
} from '../types/dismissal'

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
  'accept-fix': [finding: ElonFinding]
  'undo-fix': [finding: ElonFinding]
  /** r41 v92 — bubble history selection. */
  'select-history': [versionId: string]
  /** r41 v405 — Confirmation CTA (Munger v404 pattern propagated per Tom 2026-06-28). */
  'confirm-and-view': [acceptedCount: number]
}>()

const specRef       = computed(() => props.spec)
const planTitleRef  = computed(() => props.planTitle)

const {
  report,
  visibleFindings,
  dismissedIds,
  dismissFinding,
  undismissFinding,
} = useElonFindings(specRef, planTitleRef)

// r41 v405 (Tom Gilb 2026-06-28 "OF COURSE THE MUNGER LOGIC APPLIES TO ALL
// SUCH CHANGES IN ALL AGENTS") — track accepted-fix count + Confirm-and-view
// CTA.  Mirrors MungerPanel v404 pattern.
const acceptedCount = ref<number>(0)
function onAcceptElonFix(finding: ElonFinding): void {
  emit('accept-fix', finding)
  acceptedCount.value++
}
function onConfirmAndView(): void {
  emit('confirm-and-view', acceptedCount.value)
}

// r38 (Tom Gilb 2026-06-14) — Dismissal Audit Trail.
// Every Dismiss click opens DismissalReasonModal to capture
//   (1) Why?  (2) On whose authority (default Owner)
// — then logs to the plan documentation via useDismissalLog.
const _dismissalLog = useDismissalLog()
const dismissalModalOpen   = ref(false)
const dismissalTargetFinding = ref<ElonFinding | null>(null)
const ownerName = computed(() => props.spec?.specOwner ?? '')

function onDismissClick(finding: ElonFinding): void {
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
    id:                   makeDismissalId(planId, 'elon', f.id, Date.now()),
    agentId:              'elon',
    agentCategory:        f.category,
    findingId:            f.id,
    findingSummary:       `${ELON_CATEGORY_META[f.category]?.label ?? f.category} — ${f.explanation}`,
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

// Plan-scoped dismissal log for the header counter + "N past dismissals" surface
const planDismissals = computed<DismissalRecord[]>(() =>
  _dismissalLog.dismissalsForAgent('elon', props.planTitle || '(untitled)'),
)
function _formatDismissalRow(r: DismissalRecord): string {
  return `${r.findingSummary.slice(0, 60)} · «${r.whyReason.slice(0, 50)}» · ${dismissalAuthorityLabel(r)}`
}
/** Exposed to template — renders "Owner (default)" / "Stakeholder — Alice" / etc. */
function _formatAuthorityLabel(r: DismissalRecord): string {
  return dismissalAuthorityLabel(r)
}

// r39 (Tom Gilb 2026-06-14 verbatim: "a click on any of these 3 buttons should
// take you to the corresponding items") — convert severity + dismissed count
// pills into clickable jumps.
//   - click "N critical" → smooth-scroll to first critical finding, pulse-highlight
//   - click "N moderate" / "N suggestion" / "⚡ N pace" → same pattern
//   - click "N dismissed" → toggle inline panel showing the dismissed log with
//     reason + authority + Restore action (uses useDismissalLog already in place)
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
  const el = document.querySelector<HTMLElement>(`[data-elon-finding-id="${CSS.escape(f.id)}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    _flashFinding(f.id)
  }
}

function jumpToPace(): void {
  const f = findingsByCategory.value['pace-of-innovation'][0]
  if (!f) return
  const el = document.querySelector<HTMLElement>(`[data-elon-finding-id="${CSS.escape(f.id)}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    _flashFinding(f.id)
  }
}

function jumpToDismissed(): void {
  showDismissedList.value = !showDismissedList.value
  // If opening, scroll the inline list into view in the next frame
  if (showDismissedList.value) {
    nextTick(() => {
      const el = document.querySelector<HTMLElement>('[data-elon-dismissed-list]')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
}

function restoreDismissal(record: DismissalRecord): void {
  _dismissalLog.restoreDismissed(record.id)
  undismissFinding(record.findingId)
  // After restore, jump to the now-visible finding so the user sees the result
  nextTick(() => {
    const el = document.querySelector<HTMLElement>(`[data-elon-finding-id="${CSS.escape(record.findingId)}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      _flashFinding(record.findingId)
    }
  })
}

// Group visible findings by category for sectioned rendering
const findingsByCategory = computed<Record<ElonCategory, ElonFinding[]>>(() => {
  const out: Record<ElonCategory, ElonFinding[]> = {
    'pace-of-innovation':       [],
    'innovation':               [],
    'incremental-improvement':  [],
    'pace-of-learning':         [],
    'safety':                   [],
    'destiny-control':          [],
    'reusability':              [],
    'modularization':           [],
    'management-automatedness': [],
    'testing-automation':       [],
    'governance':               [],
  }
  for (const f of visibleFindings.value) out[f.category].push(f)
  return out
})

// Pace-of-innovation always FIRST per Tom's DOMINANT-Requirement rule (Dove p. 8).
const activeCategories = computed<ElonCategory[]>(() => {
  const order: ElonCategory[] = [
    'pace-of-innovation',
    'innovation',
    'incremental-improvement',
    'pace-of-learning',
    'safety',
    'destiny-control',
    'reusability',
    'modularization',
    'management-automatedness',
    'testing-automation',
    'governance',
  ]
  return order.filter(c => findingsByCategory.value[c].length > 0)
})

// ─── Score Info Popover ───────────────────────────────────────────────────

const scoreInfoOpen = ref(false)

interface ScoreHistoryEntry {
  score:     number
  delta:     number
  label:     string
  timestamp: string
}
const scoreHistory = ref<ScoreHistoryEntry[]>([])

watch(
  () => report.value.velocityScore,
  (newScore, oldScore) => {
    const prev  = scoreHistory.value.length > 0 ? scoreHistory.value[scoreHistory.value.length - 1].score : null
    const delta = prev !== null ? newScore - prev : 0
    let label = scoreHistory.value.length === 0 ? 'Initial scan' : (delta > 0 ? 'Findings reduced' : delta < 0 ? 'Findings added' : 'No change')
    if (delta > 0 && scoreHistory.value.length > 0) {
      label = 'Accept Fix applied'
    } else if (delta < 0 && scoreHistory.value.length > 0) {
      label = 'New finding(s) detected'
    }
    scoreHistory.value = [
      ...scoreHistory.value,
      { score: newScore, delta, label, timestamp: new Date().toISOString() },
    ].slice(-50)
    void oldScore
  },
  { immediate: true },
)

const recentScoreHistory = computed<ScoreHistoryEntry[]>(() =>
  [...scoreHistory.value].reverse().slice(0, 10),
)

/** Velocity Score formula: 100 - weighted deductions, with pace-of-innovation 2× weight. */
const scoreFormula = computed(() => {
  const sev = report.value.bySeverity
  const paceCount = findingsByCategory.value['pace-of-innovation'].length
  const baseDed = (sev.critical * 15) + (sev.moderate * 6) + (sev.suggestion * 2)
  // Extra deduction for pace findings (effective 2× weighting)
  let paceExtra = 0
  for (const f of findingsByCategory.value['pace-of-innovation']) {
    paceExtra += f.severity === 'critical' ? 15 : f.severity === 'moderate' ? 6 : 2
  }
  const ded = baseDed + paceExtra
  return {
    base:            100,
    criticalCount:   sev.critical,
    criticalWeight:  15,
    moderateCount:   sev.moderate,
    moderateWeight:  6,
    suggestionCount: sev.suggestion,
    suggestionWeight: 2,
    paceCount,
    paceExtra,
    totalDeduction:  ded,
    raw:             100 - ded,
    floored:         Math.max(0, 100 - ded),
  }
})

// ─── Export ────────────────────────────────────────────────────────────────

function renderReportHtml(): string {
  const fmt = scoreFormula.value
  const scoreCompositionBlock = `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 14px 0;">
      <tr><td bgcolor="#0e7490" style="background:#0e7490;color:white;padding:10px 14px;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
        ⚡ Velocity Score Composition
      </td></tr>
      <tr><td bgcolor="#ecfeff" style="background:#ecfeff;padding:12px 14px;font-size:13px;color:#0f172a;">
        Starts at <b>100</b> and subtracts weight per finding. <b>Pace-of-Innovation findings weight 2×</b> per Dove dominant-Requirement rule. Higher = more Musk-aligned.
        <table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;border-collapse:collapse;font-size:12px;">
          <tr><td style="padding:4px 12px 4px 0;color:#475569;">Base score</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:bold;">+ 100</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#991b1b;">● Critical findings × 15</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:bold;color:#991b1b;">− ${fmt.criticalCount} × 15 = ${fmt.criticalCount * 15}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#92400e;">● Moderate findings × 6</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:bold;color:#92400e;">− ${fmt.moderateCount} × 6 = ${fmt.moderateCount * 6}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#1e3a8a;">● Suggestion findings × 2</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:bold;color:#1e3a8a;">− ${fmt.suggestionCount} × 2 = ${fmt.suggestionCount * 2}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#0e7490;">⚡ Pace-of-Innovation DOMINANT 2× extra</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:bold;color:#0e7490;">− ${fmt.paceExtra}</td></tr>
          <tr style="border-top:2px solid #94a3b8;"><td style="padding:8px 12px 4px 0;font-weight:bold;">Raw score</td><td style="padding:8px 0 4px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:900;font-size:14px;">= ${fmt.raw}</td></tr>
          ${fmt.raw < 0 ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-style:italic;">Floored at 0</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;font-style:italic;color:#64748b;">→ ${fmt.floored}</td></tr>` : ''}
        </table>
      </td></tr>
    </table>`

  const scoreHistoryBlock = recentScoreHistory.value.length > 0 ? `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 14px 0;">
      <tr><td bgcolor="#0e7490" style="background:#0e7490;color:white;padding:10px 14px;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
        📈 Latest Velocity-Score Changes (newest first)
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
    const catMeta = ELON_CATEGORY_META[f.category]
    const dominantBadge = catMeta.dominant ? ' · DOMINANT (Dove)' : ''
    return `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 14px 0;">
        <tr><td bgcolor="${catMeta.dominant ? '#0e7490' : '#1e293b'}" style="background:${catMeta.dominant ? '#0e7490' : '#1e293b'};color:white;padding:10px 14px;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
          ${sevLabel(f.severity)} · ${catMeta.label}${dominantBadge}
        </td></tr>
        <tr><td bgcolor="#f8fafc" style="background:#f8fafc;padding:12px 14px;font-size:13px;color:#0f172a;">
          <b>Triggered by:</b> ${f.triggeredBy}<br/>
          <b>Principle violated:</b> ${f.principleViolated}<br/>
          <b>Explanation:</b> ${f.explanation}<br/>
          ${f.muskCitation ? `<b>Musk's Methods citation:</b> <i>${f.muskCitation}</i><br/>` : ''}
          ${f.doveCitation ? `<b>Dove citation:</b> <i>${f.doveCitation}</i><br/>` : ''}
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
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#67e8f9;">Elon Agent · Musk's Methods · Dove Pace</div>
        <div style="font-size:20px;font-weight:bold;margin-top:6px;">${report.value.planTitle}</div>
        <div style="font-size:14px;margin-top:8px;color:#cbd5e1;">${report.value.headline}</div>
      </td></tr>
      <tr><td bgcolor="#ecfeff" style="background:#ecfeff;padding:14px 22px;border-radius:0 0 12px 12px;">
        <b style="color:#0f172a;">Velocity Score:</b> ${report.value.velocityScore}/100
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
    `ELON AGENT REPORT — ${report.value.planTitle}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Velocity Score: ${report.value.velocityScore}/100`,
    report.value.headline,
    '',
  ]
  for (const f of visibleFindings.value) {
    const catMeta = ELON_CATEGORY_META[f.category]
    const dominantBadge = catMeta.dominant ? ' · DOMINANT (Dove)' : ''
    lines.push(
      `── ${f.severity.toUpperCase()} · ${catMeta.label}${dominantBadge} · ${f.triggeredBy} ──`,
      `Principle: ${f.principleViolated}`,
      `Explanation: ${f.explanation}`,
      `Musk's Methods citation: ${f.muskCitation ?? '—'}`,
      `Dove citation: ${f.doveCitation ?? '—'}`,
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
    const exportDate = new Date().toISOString().slice(0, 10)
    let body = `PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION\nExported: ${exportDate}\n${'─'.repeat(40)}\n\n${plain}`
    while (encodeURIComponent(body).length > 7000 && body.length > 200) {
      body = body.slice(0, body.length - 200) +
        '\n\n…[plain-text truncated to fit mailto: limit — press ⌘V above for the full colour version]'
    }
    const subject = encodeURIComponent(`Elon Report — ${report.value.planTitle}`)
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
      aria-label="Elon Agent — Musk's Methods plan check"
    >
      <div
        class="pointer-events-auto w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10"
      >

        <!-- Header (slate/violet body with cyan/electric-blue accent for pace) -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-900 via-cyan-900 to-slate-900 shrink-0">
          <span class="text-3xl" aria-hidden="true">⚡</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-lg font-bold text-white leading-tight tracking-tight">
              Elon
              <span class="text-[11px] font-normal text-cyan-200 uppercase tracking-wider ml-2">
                Musk's Methods · Pace, First Principles, Delete-then-Optimize
              </span>
            </h2>
            <p class="text-[13px] text-white/80 leading-snug mt-1 italic">
              Pace of Innovation is the DOMINANT Requirement (Dove et al.).
            </p>
          </div>
          <!-- r41 v413 — top-banner mirror of the "✓ See consequences" CTA. -->
          <button
            v-if="acceptedCount > 0"
            type="button"
            class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[12px] font-extrabold whitespace-nowrap shadow ring-2 ring-emerald-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
            :title="`${acceptedCount} fix${acceptedCount === 1 ? '' : 'es'} accepted · click to close the Elon panel and view the consequences in your specs.  Source: Elon attached to each mutated field.`"
            :aria-label="`See ${acceptedCount} accepted fix${acceptedCount === 1 ? '' : 'es'} in your specs`"
            @click="onConfirmAndView"
          >
            ✓ See {{ acceptedCount }} fix{{ acceptedCount === 1 ? '' : 'es' }} in specs →
          </button>
          <!-- Export buttons -->
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold whitespace-nowrap transition-colors ring-1 ring-emerald-800 flex items-center gap-1"
            title="📋 Copy — captures every Elon finding across all 9 categories regardless of which are currently expanded. Includes Pace-of-Innovation (DOMINANT), 5-step Musk algorithm violations, vertical-integration gaps, Idiot-Index findings, and the full Velocity Score breakdown. Paste with ⌘V into Mail, Notes, Keynote."
            @click="exportReport('copy')"
          >
            <span>📋</span><span>Copy</span>
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold whitespace-nowrap transition-colors ring-1 ring-blue-800 flex items-center gap-1"
            title="✉ Email — captures every Elon finding regardless of which are currently expanded. Auto-opens Mail to Tom@Gilb.com with colourful HTML on clipboard."
            @click="exportReport('email')"
          >
            <span>✉</span><span>Email</span>
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-bold whitespace-nowrap transition-colors ring-1 ring-amber-800 flex items-center gap-1"
            title="🔪 Elon Sharpening — Q&A flow that probes context the deterministic engine can't infer. Nine categories with pointed questions and AI-suggested starter answers. Answers synthesise into Plan edits via the same Accept-Fix pipeline (Source-stamping + Undo preserved)."
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
            aria-label="Close Elon Agent"
            title="Close Elon Agent — return to the planning workspace"
            @click="emit('close')"
          />
        </div>

        <!-- Plan identity band (r41 v92) — cyan/electric-blue toned for Elon. -->
        <PlanIdentityBand
          :plan-name="planTitle"
          :plan-owner="planOwner"
          :plan-version="planVersion"
          :generated-at="generatedAt"
          :theme="{ bg: 'bg-slate-800', borderTop: 'border-cyan-500', label: 'text-cyan-200', pickerBorder: 'border-cyan-300' }"
          @select-history="(id: string) => emit('select-history', id)"
        />

        <!-- Mode banner — model vs current plan -->
        <div
          v-if="isModel"
          class="px-5 py-2 bg-amber-50 border-b border-amber-200 shrink-0 flex items-center gap-2 text-[12px] text-amber-900"
          title="You are checking a Library model — Accept Fix will preview but not modify your current Plan."
        >
          <span class="text-base">🗂️</span>
          <span><b>Model Mode:</b> checking <i>{{ planTitle }}</i> — Accept Fix runs as PREVIEW (no changes saved to your Plan).</span>
        </div>

        <!-- Score + Headline strip -->
        <div class="px-5 py-3 bg-slate-50 border-b border-slate-200 shrink-0 flex items-center gap-4">
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="flex items-center justify-center w-16 h-16 rounded-full font-black text-[20px] ring-4 cursor-pointer transition-all hover:scale-105 focus:outline-none focus:ring-offset-2"
              :class="[
                report.velocityScore >= 80 ? 'bg-emerald-100 text-emerald-800 ring-emerald-300' :
                report.velocityScore >= 50 ? 'bg-amber-100 text-amber-800 ring-amber-300' :
                                              'bg-red-100 text-red-800 ring-red-300',
                scoreInfoOpen ? 'ring-offset-2 ring-offset-slate-100' : '',
              ]"
              :title="`Velocity Score ${report.velocityScore}/100 — higher = more Musk-aligned.
Formula: 100 − (critical × 15) − (moderate × 6) − (suggestion × 2) − (pace-of-innovation 2× extra).
Currently: ${scoreFormula.floored} (pace extra deduction: ${scoreFormula.paceExtra}).
Click for full breakdown + last-10 score changes.`"
              :aria-expanded="scoreInfoOpen"
              aria-label="Velocity Score — click to expand breakdown and trend"
              @click="scoreInfoOpen = !scoreInfoOpen"
            >{{ report.velocityScore }}</button>
            <button
              type="button"
              class="text-[11px] text-slate-500 uppercase tracking-wide font-semibold leading-tight hover:text-slate-800 transition-colors cursor-pointer text-left"
              title="Click for full Velocity Score breakdown + last-10 score changes"
              @click="scoreInfoOpen = !scoreInfoOpen"
            >
              Velocity<br/>Score <span class="text-slate-400 ml-0.5">{{ scoreInfoOpen ? '▲' : '▼' }}</span>
            </button>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[14px] font-semibold text-slate-800 leading-snug">{{ report.headline }}</p>
            <div class="flex items-center gap-3 mt-2 flex-wrap">
              <!-- r39 (Tom Gilb 2026-06-14) — pills are now clickable JUMP buttons.
                   Click → smooth-scroll to the first matching finding + pulse-highlight.
                   The "N dismissed" pill toggles the inline dismissed-log panel. -->
              <button
                v-if="findingsByCategory['pace-of-innovation'].length > 0"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-600 text-white text-[11px] font-bold ring-1 ring-cyan-900 hover:bg-cyan-700 hover:ring-2 cursor-pointer transition-all"
                title="Jump to the first Pace-of-Innovation finding (DOMINANT Requirement per Dove et al.)"
                @click="jumpToPace"
              >⚡ {{ findingsByCategory['pace-of-innovation'].length }} pace →</button>
              <button
                v-if="report.bySeverity.critical > 0"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px] font-bold ring-1 ring-red-900 hover:bg-red-700 hover:ring-2 cursor-pointer transition-all"
                title="Jump to the first critical finding (Musk's Methods violation — address first)"
                @click="jumpToSeverity('critical')"
              >{{ report.bySeverity.critical }} critical →</button>
              <button
                v-if="report.bySeverity.moderate > 0"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-bold ring-1 ring-amber-700 hover:bg-amber-600 hover:ring-2 cursor-pointer transition-all"
                title="Jump to the first moderate finding (should fix; not a blocker)"
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

        <!-- Score Info Popover -->
        <div
          v-if="scoreInfoOpen"
          class="px-5 py-3 bg-slate-100 border-b border-slate-300 shrink-0 text-[12px] text-slate-800 space-y-3"
        >
          <div>
            <div class="font-bold uppercase tracking-wide text-slate-600 text-[11px] mb-1.5">
              ⚡ Velocity Score Composition
            </div>
            <p class="leading-snug mb-1.5">
              Starts at <b>100</b> and subtracts a weight per finding. <b>Pace-of-Innovation findings weight 2×</b> per Dove dominant-Requirement rule. Higher = more Musk-aligned.
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
                <tr class="border-b border-slate-200">
                  <td class="py-1 pr-3 text-cyan-800 font-semibold">
                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-cyan-600 mr-1.5 align-middle"></span>
                    Pace-of-Innovation DOMINANT 2× extra
                  </td>
                  <td class="py-1 text-right font-mono font-bold text-cyan-800">
                    − {{ scoreFormula.paceExtra }}
                  </td>
                </tr>
                <tr class="border-t-2 border-slate-400">
                  <td class="py-1.5 pr-3 font-bold">Raw score</td>
                  <td class="py-1.5 text-right font-mono font-black text-[14px]">
                    = {{ scoreFormula.raw }}
                  </td>
                </tr>
                <tr v-if="scoreFormula.raw < 0">
                  <td class="py-1 pr-3 text-slate-500 italic">Floored at 0</td>
                  <td class="py-1 text-right font-mono italic text-slate-500">→ {{ scoreFormula.floored }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="recentScoreHistory.length > 0">
            <div class="font-bold uppercase tracking-wide text-slate-600 text-[11px] mb-1.5">
              📈 Latest Velocity-Score Changes (most recent first)
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
                  :title="entry.delta > 0 ? 'Score improved' : entry.delta < 0 ? 'Score worsened' : 'No change'"
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

        <!-- Body — findings grouped by category. Pace-of-Innovation always FIRST. -->
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 relative">
          <div v-if="visibleFindings.length === 0" class="text-center py-12">
            <div class="text-5xl mb-3">⚡</div>
            <p class="text-[16px] font-bold text-slate-800 mb-2">{{ report.headline }}</p>
            <p class="text-[13px] text-slate-500 max-w-md mx-auto">
              Elon re-checks every time you change the Plan. Pace-of-Innovation findings always sort first because Dove names it the dominant Requirement.
            </p>
          </div>

          <!-- r39 (Tom Gilb 2026-06-14) — Dismissed findings reveal panel.
               Toggles via the "N dismissed" pill in the header.  Lists every
               dismissal for THIS plan + THIS agent with reason + authority +
               Restore. -->
          <section
            v-if="showDismissedList && planDismissals.length > 0"
            data-elon-dismissed-list
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
                    :title="`Restore this finding — removes the dismissal from the log and brings the finding card back into view`"
                    @click="restoreDismissal(record)"
                  >↺ Restore</button>
                </div>
              </li>
            </ul>
          </section>

          <!-- r40 (Tom Gilb 2026-06-14 "blow people's minds, world firsts") —
               Dove "Pace of Innovation" DOMINANCE HERO CARD.
               The full verbatim Dove thesis becomes the panel's centerpiece.
               This is the world-first packaging that no competitor has:
                 - the verbatim quote, large, serif italic, cyan accent
                 - real page citation (Dove p. 8, Justice 2022a)
                 - real Musk's Methods cross-cite (p. 72)
                 - live pace-finding count + jump-to-first CTA
                 - Tom Gilb Consultant Twin link (r93ppp Twin-as-Destination)
               Materialises the Conjunction-of-Technologies SUPREME rule visibly:
               every Planguage planner sees, at first glance, the Gilb-corpus +
               Dove-paper + plan-data layers braided into a single mandate. -->
          <section
            class="rounded-xl overflow-hidden shadow-lg border-l-[6px] border-cyan-500"
            style="background: linear-gradient(135deg, rgb(236 254 255) 0%, rgb(255 255 255) 35%, rgb(207 250 254) 100%);"
            aria-label="Pace of Innovation — Dove dominance thesis"
          >
            <div class="px-5 pt-4 pb-2 flex items-center gap-3 flex-wrap">
              <span class="text-2xl">⚡</span>
              <span class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-cyan-800">Pace of Innovation</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-700 text-white font-extrabold uppercase tracking-wider">Dominant Requirement</span>
              <span class="text-[10px] text-slate-600 italic">— Dove et al., p. 8 (Justice 2022a)</span>
            </div>
            <blockquote class="px-6 py-3 relative">
              <span class="absolute -top-1 left-2 text-6xl text-cyan-200 font-serif leading-none select-none" aria-hidden="true">“</span>
              <p class="font-serif italic text-[20px] sm:text-[22px] leading-snug text-slate-800 pl-8 pr-2">
                Pace of innovation is the only thing that matters – not cost per unit, not management efficiency, no other metric is above pace of innovation.
              </p>
              <span class="absolute -bottom-3 right-3 text-6xl text-cyan-200 font-serif leading-none select-none" aria-hidden="true">”</span>
            </blockquote>
            <div class="px-6 pt-1 pb-3 text-[12px] text-slate-700 leading-relaxed">
              <span class="font-semibold text-slate-800">Sources:</span>
              <a
                href="https://www.gilb.com/tomtwin"
                target="_blank"
                rel="noopener"
                class="text-cyan-800 font-bold hover:underline ml-1"
                title="Open the Tom Gilb Consultant Twin (Kai Gilb's commercial product, free reading tier) — search the full Gilb corpus on demand. r93ppp Twin-as-Destination."
              >Tom Gilb Consultant Twin ↗</a>
              · Dove et al. (Innovation Engineering at Tesla — Agility as a Cultural Practice) <strong>p. 8</strong>
              · Gilb, <em>Musk's Methods</em> MASTER <strong>p. 72</strong> — <em>"What matters is the pace of innovation, access to resources, and raw materials"</em>
            </div>
            <!-- Live pace-finding row -->
            <div class="px-5 py-3 border-t border-cyan-200 bg-white/60 flex items-center gap-3 flex-wrap">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-cyan-700">This plan's pace findings</span>
                <span
                  class="text-[14px] font-extrabold px-2.5 py-0.5 rounded-full"
                  :class="findingsByCategory['pace-of-innovation'].length > 0
                    ? 'bg-cyan-700 text-white ring-2 ring-cyan-900'
                    : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'"
                >{{ findingsByCategory['pace-of-innovation'].length }}</span>
              </div>
              <span class="text-[12px] text-slate-700 italic flex-1 min-w-[12rem]">
                <template v-if="findingsByCategory['pace-of-innovation'].length === 0">
                  ✓ No pace deficiencies detected — every other category is subordinate to this one.
                </template>
                <template v-else-if="findingsByCategory['pace-of-innovation'].length === 1">
                  One deficiency on the dominant axis — address before all others.
                </template>
                <template v-else>
                  {{ findingsByCategory['pace-of-innovation'].length }} deficiencies on the dominant axis — Dove: <em>"no other metric is above"</em>.
                </template>
              </span>
              <button
                v-if="findingsByCategory['pace-of-innovation'].length > 0"
                type="button"
                class="px-3 py-1 rounded-md bg-cyan-700 text-white text-[12px] font-extrabold hover:bg-cyan-800 ring-1 ring-cyan-900 transition-all"
                title="Jump to the first Pace-of-Innovation finding + pulse-highlight"
                @click="jumpToPace"
              >Jump to first pace finding →</button>
            </div>
          </section>

          <!-- Per-category sections -->
          <section
            v-for="cat in activeCategories"
            :key="cat"
            class="rounded-xl border overflow-hidden bg-white shadow-sm"
            :class="ELON_CATEGORY_META[cat].dominant ? 'border-cyan-400 ring-2 ring-cyan-200' : 'border-slate-200'"
          >
            <header
              class="px-4 py-3 flex items-start gap-3 border-b border-slate-100"
              :class="
                ELON_CATEGORY_META[cat].color === 'cyan'    ? 'bg-cyan-50' :
                ELON_CATEGORY_META[cat].color === 'violet'  ? 'bg-violet-50' :
                ELON_CATEGORY_META[cat].color === 'emerald' ? 'bg-emerald-50' :
                ELON_CATEGORY_META[cat].color === 'blue'    ? 'bg-blue-50' :
                ELON_CATEGORY_META[cat].color === 'red'     ? 'bg-red-50' :
                ELON_CATEGORY_META[cat].color === 'amber'   ? 'bg-amber-50' :
                ELON_CATEGORY_META[cat].color === 'indigo'  ? 'bg-indigo-50' :
                ELON_CATEGORY_META[cat].color === 'teal'    ? 'bg-teal-50' :
                ELON_CATEGORY_META[cat].color === 'orange'  ? 'bg-orange-50' :
                ELON_CATEGORY_META[cat].color === 'rose'    ? 'bg-rose-50' :
                'bg-slate-50'
              "
            >
              <div class="flex-1 min-w-0">
                <h3 class="text-[14px] font-bold uppercase tracking-wide text-slate-800 flex items-center gap-2">
                  <span>{{ ELON_CATEGORY_META[cat].label }}</span>
                  <span
                    v-if="ELON_CATEGORY_META[cat].dominant"
                    class="px-2 py-0.5 rounded-full bg-cyan-600 text-white text-[10px] font-bold tracking-wider"
                    title="DOMINANT Requirement per Dove et al. — these findings weight 2× in Velocity Score"
                  >⚡ DOMINANT</span>
                  <span class="ml-2 text-[11px] font-semibold text-slate-500">
                    {{ findingsByCategory[cat].length }} finding{{ findingsByCategory[cat].length === 1 ? '' : 's' }}
                  </span>
                </h3>
                <p class="text-[12px] text-slate-600 mt-1">{{ ELON_CATEGORY_META[cat].subtitle }}</p>
                <p class="text-[11px] text-slate-500 mt-1 italic" :title="ELON_CATEGORY_META[cat].muskPrinciple">
                  {{ ELON_CATEGORY_META[cat].muskPrinciple }}
                </p>
              </div>
            </header>

            <!-- Findings in this category -->
            <ul class="divide-y divide-slate-100">
              <li
                v-for="finding in findingsByCategory[cat]"
                :key="finding.id"
                :data-elon-finding-id="finding.id"
                class="px-4 py-3 hover:bg-slate-50 transition-colors"
                :class="_justJumpedFindingId === finding.id ? 'gilb-jump-flash' : ''"
              >
                <div class="flex items-start gap-2 mb-2 flex-wrap">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ring-1 whitespace-nowrap"
                    :class="[
                      ELON_SEVERITY_META[finding.severity].bg,
                      ELON_SEVERITY_META[finding.severity].text,
                      ELON_SEVERITY_META[finding.severity].ring,
                    ]"
                  >{{ ELON_SEVERITY_META[finding.severity].label }}</span>
                  <span class="text-[13px] font-mono font-semibold text-slate-800">{{ finding.triggeredBy }}</span>
                  <span class="text-[12px] text-slate-600">·</span>
                  <span class="text-[12px] text-slate-700">{{ finding.principleViolated }}</span>
                  <span class="flex-1"></span>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
                    :class="[
                      ELON_SOURCE_META[finding.sourceLayer].bg,
                      ELON_SOURCE_META[finding.sourceLayer].text,
                    ]"
                    :title="finding.sourceLayer === 'derived-from-plan'
                      ? 'Derived from your Plan data — highest-confidence Source, deterministic'
                      : 'Cited reference — see citations below'"
                  >{{ ELON_SOURCE_META[finding.sourceLayer].label }}</span>
                </div>

                <p class="text-[13px] text-slate-800 leading-snug mb-2 whitespace-pre-wrap">{{ finding.explanation }}</p>

                <div v-if="finding.muskCitation || finding.doveCitation || finding.gilbCitation || finding.verifyUrl"
                     class="flex items-center gap-2 mb-2 flex-wrap text-[11px]"
                >
                  <span v-if="finding.muskCitation" class="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200">
                    📖 {{ finding.muskCitation }}
                  </span>
                  <span v-if="finding.doveCitation" class="px-1.5 py-0.5 rounded bg-violet-50 text-violet-800 ring-1 ring-violet-200">
                    ⚡ {{ finding.doveCitation }}
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

                <div class="rounded border border-amber-300 bg-amber-50 p-3 mb-2">
                  <p class="text-[11px] font-bold uppercase tracking-wide text-amber-900 mb-1">
                    Suggested Fix · {{ finding.suggestedFix.type }}
                  </p>
                  <pre class="text-[12px] font-mono text-amber-950 whitespace-pre-wrap leading-snug mb-2">{{ finding.suggestedFix.asPlanguage }}</pre>
                  <p class="text-[12px] italic text-amber-800 leading-snug">{{ finding.suggestedFix.rationale }}</p>
                </div>

                <p class="text-[12px] text-red-800 italic leading-snug mb-2">
                  <span class="font-bold not-italic">⚠ Long-term consequence:</span> {{ finding.longTermConsequence }}
                </p>

                <div class="flex items-center gap-2 flex-wrap">
                  <template v-if="acceptedFindingIds.has(finding.id)">
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
                        : `↶ Undo Fix · ⌘Z — restores the Plan to the state it was in before you accepted. Keyboard shortcut ⌘Z also undoes your most recent action; ⌘⇧Z redoes.`"
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
                    <button
                      type="button"
                      class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold transition-colors ring-1 ring-emerald-800"
                      :title="`Accept this fix — applies the suggested Planguage to ${isModel ? 'this model (preview only)' : finding.triggeredBy} and stamps Source: Elon Agent on every mutated field.`"
                      @click="onAcceptElonFix(finding)"
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

          <div class="rounded border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600 leading-snug">
            <b class="text-slate-700">Phase 1 — deterministic engine.</b>
            Findings derived directly from your Plan structure (highest-confidence Source).
            Musk's Methods citations + Dove paper citations are stubbed pending the asset arrival —
            Tom is adding the source PDFs; specific chapter/page refs get stamped in later.
            Composes with Conjunction-of-Technologies SUPREME rule.
            Pace-of-Innovation is the DOMINANT Requirement (Dove et al.) and weighs 2× in Velocity Score.
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
            :title="`Close the Elon panel and open the Spec Editor so you can see the ${acceptedCount} accepted ${acceptedCount === 1 ? 'fix' : 'fixes'} in your specs.`"
            @click="onConfirmAndView"
          >✓ See the consequences in my specs now →</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- r38 (Tom Gilb 2026-06-14) — Universal Dismissal Audit Trail modal.
       Opens on any Dismiss click; captures Why + Authority; logs to plan doc. -->
  <DismissalReasonModal
    :open="dismissalModalOpen"
    :finding-summary="dismissalTargetFinding
      ? `${ELON_CATEGORY_META[dismissalTargetFinding.category]?.label ?? dismissalTargetFinding.category} — ${dismissalTargetFinding.explanation}`
      : ''"
    :fix-summary="dismissalTargetFinding?.suggestedFix?.asPlanguage?.slice(0, 220) ?? ''"
    default-authority="owner"
    :owner-name="ownerName"
    @confirm="onDismissConfirm"
    @cancel="onDismissCancel"
  />
</template>

<style scoped>
/* r39 (Tom Gilb 2026-06-14) — pulse-flash highlight on jump-target finding.
 * After clicking a header pill, the destination finding briefly pulses violet
 * so the user sees WHERE they were sent.  ~1.8s ring-pulse cycle. */
.gilb-jump-flash {
  animation: gilb-jump-flash-pulse 1.8s ease-out;
}
@keyframes gilb-jump-flash-pulse {
  0%   { background-color: rgba(139, 92, 246, 0.0); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.0); }
  20%  { background-color: rgba(139, 92, 246, 0.30); box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.30); }
  100% { background-color: rgba(139, 92, 246, 0.0); box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.0); }
}
</style>
