<!-- UNIT_TYPE=Widget -->
<!-- PlanHealthStatusPanel.vue — Feature #202.c: Plan Health Status window.
     The read-only sister of PlanHealthAdminPanel.vue. Tom: "A separate PHI
     Window (to the Admin window) is the 'PlanHealthStatus' window. The
     PlanHealthStatus should include the option to draw a Graph of the history
     of any Aspects Indicators, incl overall from Plan Inception, Along an
     axis of Version and Date."

     This panel shows:
       • Headline PHI badge + threshold + active group count
       • Pending notifications (drop / recovery / inception alerts) — the user
         can dismiss them here; same list drives the badge dot in App.vue
       • Per-group sub-index summary (read-only — editing happens in Admin)
       • History graph: an SVG line plot. The Y axis is −100..+100 PHI; the
         X axis is the snapshot sequence (with both Version and Date labels).
         A series picker lets you switch between "Overall PHI", any one
         Aspect Group sub-index, or any individual aspect.
       • Snapshot list (newest-first) with click-to-highlight on the graph.

     The "⚙️ Administer" header link opens the Admin panel.

     Single-Surface Rule: this panel registers via App.vue's
     `registerExclusiveSurface('planHealthStatus', ...)`.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  useSpecHealth,
  ASPECT_GROUPS,
  type AspectGroupId,
  type IndexBreakdown,
  type PlanHealthContext,
  type PlanHealthSnapshot,
} from '../composables/useSpecHealth'
import type { SpecBlock } from '../types/spec'
import RightPanel from './RightPanel.vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import SpecHealthBadge from './SpecHealthBadge.vue'
import { copyPlanHealthReport, emailPlanHealthReport } from '../composables/useSpecHealthExport'

const props = defineProps<{
  planModelId: string
  spec: SpecBlock
  specOwnerCount: number
  hasPlanOwner: boolean
  /** Plan version label for Expert reviews (e.g. "v0.7"). When omitted, '' is used. */
  planVersion?: string
  /** Who is invoking — used in audit log for expert runs */
  by?: string
  /** Plan display name — included in copy/email subject and header */
  planName?: string
  /** Plan Owner records — used to pre-fill mailto: recipients */
  planOwners?: Array<{ id: string; name: string; email?: string }>
}>()

const emit = defineEmits<{ close: []; 'open-admin': [] }>()

const ph = useSpecHealth(props.planModelId)

const ctx = computed<PlanHealthContext>(() => ({
  spec: props.spec,
  specOwnerCount: props.specOwnerCount,
  hasPlanOwner: props.hasPlanOwner,
}))

const breakdown = computed<IndexBreakdown>(() => ph.computeBreakdown(ctx.value))

const snapshots = computed<PlanHealthSnapshot[]>(() => ph.custom.value.snapshots)

// ── Series picker ──────────────────────────────────────────────────────────
//
// The user can graph one of:
//   • 'overall'             — the headline PHI (default)
//   • `group:<groupId>`     — that group's sub-index across history
//   • `aspect:<aspectId>`   — that single aspect's score across history
//
// Series options are derived live from the breakdown so newly-added aspects
// appear automatically.

type SeriesKey = 'overall' | `group:${string}` | `aspect:${string}`
const selectedSeries = ref<SeriesKey>('overall')

const seriesOptions = computed(() => {
  const opts: Array<{ key: SeriesKey; label: string; group?: string }> = [
    { key: 'overall', label: '⚪ Overall PHI' },
  ]
  for (const g of breakdown.value.groups) {
    opts.push({ key: `group:${g.groupId}`, label: `${g.groupIcon} ${g.groupLabel} (group)` })
    for (const a of g.aspects) {
      opts.push({ key: `aspect:${a.aspectId}`, label: `   ↳ ${a.name}`, group: g.groupLabel })
    }
  }
  return opts
})

/** Pull the y-value (-100..+100) for the selected series from a snapshot. */
function valueAt(s: PlanHealthSnapshot): number | null {
  if (selectedSeries.value === 'overall') return s.index
  if (selectedSeries.value.startsWith('group:')) {
    const gid = selectedSeries.value.slice('group:'.length) as AspectGroupId
    const v = s.groupIndices[gid]
    return v == null ? null : v
  }
  if (selectedSeries.value.startsWith('aspect:')) {
    const aid = selectedSeries.value.slice('aspect:'.length)
    const v = s.aspectScores[aid]
    return v == null ? null : v
  }
  return null
}

// ── SVG line chart geometry ────────────────────────────────────────────────
//
// Fixed viewBox; we map snapshot index → x and value(-100..+100) → y. Even
// without snapshots we render the 0 baseline + threshold bands so the user
// sees the empty chart waiting to be populated.

const W = 520
const H = 200
const PAD_L = 36
const PAD_R = 12
const PAD_T = 12
const PAD_B = 36
const innerW = W - PAD_L - PAD_R
const innerH = H - PAD_T - PAD_B

function xAt(i: number, n: number): number {
  if (n <= 1) return PAD_L + innerW / 2
  return PAD_L + (i / (n - 1)) * innerW
}
function yAt(v: number): number {
  // v in -100..+100 → top/bottom of inner area (inverted Y)
  const clamped = Math.max(-100, Math.min(100, v))
  return PAD_T + ((100 - clamped) / 200) * innerH
}

const path = computed(() => {
  const pts = snapshots.value.map((s, i) => {
    const v = valueAt(s)
    if (v == null) return null
    return { x: xAt(i, snapshots.value.length), y: yAt(v) }
  }).filter((p): p is { x: number; y: number } => p != null)
  if (pts.length === 0) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
})

const dots = computed(() =>
  snapshots.value.map((s, i) => {
    const v = valueAt(s)
    if (v == null) return null
    return {
      id: s.id,
      x: xAt(i, snapshots.value.length),
      y: yAt(v),
      v, label: s.planVersion || s.at.slice(5, 10),
      date: s.at.slice(0, 10),
      trigger: s.trigger,
    }
  }).filter(Boolean) as Array<{ id: string; x: number; y: number; v: number; label: string; date: string; trigger: string }>,
)

const yTicks = [-100, -50, 0, 50, 100]
const thresholdY = computed(() => yAt(ph.custom.value.threshold))

const hoveredId = ref<string | null>(null)

// ── Notifications surfaced inside the panel ────────────────────────────────

const pending = computed(() => ph.pendingNotifications.value)

function dismiss(id: string): void { ph.dismissNotification(id) }
function dismissAll(): void { ph.dismissAllNotifications() }

// ── AI Expert Reviewers (read view + Run) ─────────────────────────────────
//
// Status panel is read-mostly. The Run buttons here are an exception: they
// don't change weights, they just refresh a verdict — so we skip the
// reason-required overlay. The audit row written by runExpertReview()
// already records who ran it and what changed.

const experts = computed(() => ph.custom.value.experts)
const enabledExperts = computed(() => experts.value.filter(e => e.enabled))

async function runExpert(expertId: string): Promise<void> {
  await ph.runExpertReview(
    expertId,
    props.spec,
    props.planVersion ?? '',
    props.by ?? 'status-panel',
    'Manual run from Status panel',
  )
}
async function runAllExperts(): Promise<void> {
  await ph.runAllExperts(
    props.spec,
    props.planVersion ?? '',
    props.by ?? 'status-panel',
    'Manual run-all from Status panel',
  )
}

// ── Copy + Email PHI report ───────────────────────────────────────────────
//
// Tom: "Plan Health (Index and Admin) add button to Copy and to Email."
// Both helpers live in useSpecHealthExport.ts so the format stays identical
// across panels (and a future PDF export can reuse the same renderer).

const copyState = ref<'idle' | 'ok' | 'fail'>('idle')

function makeExportInput(): {
  planName: string
  planVersion: string
  breakdown: IndexBreakdown
  custom: ReturnType<typeof useSpecHealth>['custom']['value']
  by: string
} {
  return {
    planName: props.planName ?? props.planModelId,
    planVersion: props.planVersion ?? '',
    breakdown: breakdown.value,
    custom: ph.custom.value,
    by: props.by ?? 'unknown',
  }
}

async function copyReport(): Promise<void> {
  const ok = await copyPlanHealthReport(makeExportInput())
  copyState.value = ok ? 'ok' : 'fail'
  setTimeout(() => { copyState.value = 'idle' }, 1800)
}

function emailReport(): void {
  const owners = props.planOwners ?? []
  const to = owners.map(o => o.email).filter((e): e is string => !!e)
  emailPlanHealthReport(makeExportInput(), to, [])
}

/** Compact display label for a long URL — host + first path segment max. */
function shortLinkLabel(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.replace(/^\/+/, '').split('/')[0]
    return path ? `${u.host}/${path}` : u.host
  } catch {
    return url.length > 40 ? url.slice(0, 37) + '…' : url
  }
}
</script>

<template>
  <RightPanel
    class="z-[491] w-[clamp(560px,46vw,800px)] flex flex-col bg-white shadow-2xl border-l border-slate-200"
    :aria-label="`Plan Health Status — ${breakdown.index >= 0 ? '+' : ''}${breakdown.index}%`"
  >
    <!-- ── Header ────────────────────────────────────────────────────────── -->
    <div class="px-5 py-3 flex items-center gap-3 shrink-0
                bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-500 text-white">
      <SpecHealthBadge
        :index="breakdown.index"
        :threshold="ph.custom.value.threshold"
        :size="48"
        :has-alert="pending.length > 0"
        :alert-count="pending.length"
      />
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-bold tracking-wide">📊 Plan Health Status</h2>
        <p class="text-[11px] text-white/85 mt-0.5">
          {{ breakdown.groups.length }} active group{{ breakdown.groups.length === 1 ? '' : 's' }} ·
          {{ snapshots.length }} snapshot{{ snapshots.length === 1 ? '' : 's' }} ·
          threshold {{ ph.custom.value.threshold }}%
        </p>
      </div>
      <button
        type="button"
        class="text-[11px] px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors"
        :title="copyState === 'ok' ? 'Copied! Paste into Keynote / Numbers / Mail' : copyState === 'fail' ? 'Copy failed — clipboard blocked?' : 'Copy a rich-formatted PHI report (HTML + plain-text) to the clipboard'"
        @click="copyReport"
      >{{ copyState === 'ok' ? '✓ Copied' : copyState === 'fail' ? '⚠️ Copy' : '📋 Copy' }}</button>
      <button
        type="button"
        class="text-[11px] px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors"
        :title="(props.planOwners ?? []).filter(o => o.email).length
          ? `Open mailto: pre-filled to ${(props.planOwners ?? []).filter(o => o.email).length} Plan Owner${(props.planOwners ?? []).filter(o => o.email).length === 1 ? '' : 's'}`
          : 'Open mailto: with the PHI report pre-filled (no Plan Owner emails on file — pick recipient in mail client)'"
        @click="emailReport"
      >✉️ Email</button>
      <button
        type="button"
        class="text-[11px] px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors"
        title="Open the Spec Health Record Administration (weights, notifications, snapshots)"
        @click="emit('open-admin')"
      >⚙️ Administer</button>
      <CloseDot variant="on-dark" aria-label="Close Plan Health Status" @click="emit('close')" />
    </div>

    <!-- ── Body ──────────────────────────────────────────────────────────── -->
    <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-5 py-4 space-y-4">

      <!-- ── Pending notifications ── -->
      <div v-if="pending.length" class="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="text-[12px] font-bold text-rose-800">🔔 {{ pending.length }} Plan Health alert{{ pending.length === 1 ? '' : 's' }}</span>
          <button
            type="button"
            class="ml-auto text-[10px] text-rose-700 hover:underline"
            @click="dismissAll"
          >Dismiss all</button>
        </div>
        <ul class="space-y-1">
          <li
            v-for="n in pending"
            :key="n.id"
            class="flex items-start gap-2 text-[11px] text-rose-900"
          >
            <span class="mt-0.5">{{ n.kind === 'drop' ? '🔻' : n.kind === 'recovery' ? '🟢' : '⭐' }}</span>
            <div class="flex-1 min-w-0">
              <p class="font-semibold">{{ n.headline }}</p>
              <p class="text-[10px] text-rose-700/80 font-mono">{{ n.at.slice(0, 19).replace('T', ' ') }}</p>
            </div>
            <button
              type="button"
              class="text-[10px] text-rose-700 hover:underline"
              @click="dismiss(n.id)"
            >Dismiss</button>
          </li>
        </ul>
      </div>

      <!-- ── History graph ── -->
      <div class="rounded-lg border border-slate-200 p-3 space-y-2">
        <div class="flex items-center gap-2">
          <h3 class="text-[12px] font-bold text-slate-700">📈 History — Plan Inception → now</h3>
          <span class="ml-auto text-[10px] text-slate-500">Y axis: PHI (−100…+100). X axis: Version + Date.</span>
        </div>

        <!-- Series picker -->
        <label class="flex items-center gap-2 text-[11px]">
          <span class="font-semibold text-slate-600">Plot:</span>
          <select
            v-model="selectedSeries"
            class="flex-1 h-7 px-1 rounded border border-slate-300 text-[11px]"
          >
            <option v-for="o in seriesOptions" :key="o.key" :value="o.key">{{ o.label }}</option>
          </select>
        </label>

        <!-- Chart -->
        <div class="bg-slate-50 rounded border border-slate-200 overflow-hidden">
          <svg
            :viewBox="`0 0 ${W} ${H}`"
            class="w-full h-auto block"
            role="img"
            :aria-label="`Plan Health history graph — ${snapshots.length} snapshots`"
          >
            <!-- Y gridlines + labels -->
            <g>
              <line
                v-for="t in yTicks" :key="`g${t}`"
                :x1="PAD_L" :x2="W - PAD_R" :y1="yAt(t)" :y2="yAt(t)"
                :stroke="t === 0 ? '#94a3b8' : '#e2e8f0'" :stroke-width="t === 0 ? 1 : 0.6"
              />
              <text
                v-for="t in yTicks" :key="`yl${t}`"
                :x="PAD_L - 4" :y="yAt(t) + 3"
                text-anchor="end" font-size="9" fill="#64748b"
              >{{ t > 0 ? `+${t}` : t }}</text>
            </g>

            <!-- Threshold band -->
            <line
              :x1="PAD_L" :x2="W - PAD_R" :y1="thresholdY" :y2="thresholdY"
              stroke="#f59e0b" stroke-width="1" stroke-dasharray="3 3"
            />
            <text
              :x="W - PAD_R - 2" :y="thresholdY - 2"
              text-anchor="end" font-size="8" fill="#b45309"
            >threshold {{ ph.custom.value.threshold }}%</text>

            <!-- Series line -->
            <path
              v-if="path"
              :d="path"
              fill="none"
              stroke="#0d9488"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <!-- Dots + X labels -->
            <g v-for="d in dots" :key="d.id">
              <circle
                :cx="d.x" :cy="d.y" :r="hoveredId === d.id ? 5 : 3"
                :fill="d.v < 0 ? '#dc2626' : d.v < 50 ? '#f59e0b' : '#10b981'"
                stroke="white" stroke-width="1"
                @mouseenter="hoveredId = d.id"
                @mouseleave="hoveredId = null"
                style="cursor: pointer;"
              >
                <title>{{ d.label }} · {{ d.date }} · {{ d.v >= 0 ? '+' : '' }}{{ d.v }}% · {{ d.trigger }}</title>
              </circle>
            </g>

            <!-- X-axis labels — version on top line, date on bottom line.
                 Only render every Nth label when many snapshots, to avoid overlap. -->
            <g v-if="dots.length">
              <template v-for="(d, i) in dots" :key="`xl${d.id}`">
                <g v-if="dots.length <= 12 || i % Math.ceil(dots.length / 12) === 0 || i === dots.length - 1">
                  <text
                    :x="d.x" :y="H - PAD_B + 12"
                    text-anchor="middle" font-size="8" fill="#475569" font-weight="bold"
                  >{{ d.label }}</text>
                  <text
                    :x="d.x" :y="H - PAD_B + 22"
                    text-anchor="middle" font-size="7" fill="#94a3b8"
                  >{{ d.date.slice(5) }}</text>
                </g>
              </template>
            </g>

            <!-- Empty-state -->
            <g v-if="!dots.length">
              <text
                :x="W / 2" :y="H / 2"
                text-anchor="middle" font-size="11" fill="#94a3b8"
              >No snapshots yet — they appear automatically on each spec version bump.</text>
            </g>
          </svg>
        </div>
      </div>

      <!-- ── AI Expert Reviews ── -->
      <!--
        One card per enabled Expert. Each shows the latest -10..+10 score, the
        "why" paragraph, and a 🔁 button to re-run the review against the
        current plan. Empty state nudges the user to either enable a seeded
        Expert or open the Admin panel to define their own.
      -->
      <div class="rounded-lg border border-violet-200 bg-violet-50/30 overflow-hidden">
        <div class="px-3 py-2 bg-violet-100/60 border-b border-violet-200 flex items-center gap-2">
          <span class="text-[12px] font-bold text-violet-900">🧠 AI Expert Reviews</span>
          <span class="ml-auto text-[10px] text-violet-700">
            {{ enabledExperts.length }} enabled · contributes to PHI inside the AI Experts group
          </span>
          <button
            v-if="enabledExperts.length"
            type="button"
            class="text-[10px] px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-700 text-white font-semibold"
            :title="`Re-run all ${enabledExperts.length} enabled experts`"
            @click="runAllExperts"
          >🔁 Run all</button>
        </div>

        <ul v-if="enabledExperts.length" class="divide-y divide-violet-100">
          <li
            v-for="e in enabledExperts"
            :key="e.id"
            class="px-3 py-2 space-y-1"
          >
            <div class="flex items-center gap-2">
              <span aria-hidden="true">🧠</span>
              <p class="text-[12px] font-bold text-slate-800 flex-1 min-w-0 truncate">
                {{ e.name }} <span class="font-normal text-violet-700">— {{ e.domain }}</span>
              </p>
              <span
                v-if="e.lastReview"
                class="font-bold tabular-nums text-[11px] px-1.5 py-0.5 rounded-full"
                :class="e.lastReview.score < 0 ? 'bg-rose-100 text-rose-700' : e.lastReview.score < 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'"
              >{{ e.lastReview.score >= 0 ? '+' : '' }}{{ e.lastReview.score }}/10</span>
              <span v-else class="text-[10px] italic text-slate-400">awaiting first review</span>
              <button
                type="button"
                class="text-[10px] px-2 py-0.5 rounded bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-50"
                :disabled="e.running"
                :title="e.running ? 'Review in flight…' : 'Re-run this expert'"
                @click="runExpert(e.id)"
              >{{ e.running ? '⏳' : '🔁' }}</button>
            </div>
            <p v-if="e.lastReview" class="text-[11px] text-slate-700 leading-snug">
              "{{ e.lastReview.why }}"
            </p>
            <!-- References — every Expert review must cite at least one URL
                 the reader can open for justification (Tom's directive). -->
            <p v-if="e.lastReview && (e.lastReview.references?.length ?? 0)" class="text-[10px] text-slate-600 leading-snug">
              <span class="font-semibold text-slate-500">More:</span>
              <a
                v-for="(u, i) in e.lastReview.references"
                :key="u + i"
                :href="u"
                target="_blank"
                rel="noopener noreferrer"
                class="ml-1 text-violet-700 hover:text-violet-900 underline break-all"
                :title="u"
              >🔗 {{ shortLinkLabel(u) }}</a>
            </p>
            <p v-if="e.lastReview" class="text-[9px] text-slate-400 font-mono">
              v{{ e.lastReview.planVersion || '?' }} · {{ e.lastReview.model }} ·
              {{ e.lastReview.ruleCount }} rule{{ e.lastReview.ruleCount === 1 ? '' : 's' }} ·
              {{ new Date(e.lastReview.ranAt).toLocaleString() }}
            </p>
            <p v-if="e.lastError" class="text-[10px] text-rose-600">⚠️ {{ e.lastError }}</p>
          </li>
        </ul>
        <p v-else class="px-3 py-3 text-[11px] italic text-slate-500">
          No AI Experts enabled.
          <button type="button" class="text-violet-700 hover:underline font-semibold" @click="emit('open-admin')">⚙️ Open Administration →</button>
          to enable seeded personas (Security Sage, ROI Auditor, Risk Inspector, Quality Hawk, Usability Critic) or define your own.
        </p>
      </div>

      <!-- ── Live group sub-index summary (read-only) ── -->
      <div class="rounded-lg border border-slate-200 overflow-hidden">
        <div class="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <span class="text-[12px] font-bold text-slate-700">Current PHI breakdown</span>
          <span class="ml-auto text-[10px] text-slate-500">Edit weights in ⚙️ Administer →</span>
        </div>
        <ul class="divide-y divide-slate-100">
          <li
            v-for="g in breakdown.groups"
            :key="g.groupId"
            class="px-3 py-1.5 grid grid-cols-12 gap-2 items-center text-[11px]"
          >
            <span class="col-span-5 text-slate-700 truncate">{{ g.groupIcon }} {{ g.groupLabel }}</span>
            <div class="col-span-5 h-2 bg-slate-100 rounded-full overflow-hidden relative">
              <div class="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300"></div>
              <div
                class="absolute top-0 bottom-0"
                :class="g.groupIndex < 0 ? 'bg-red-500' : g.groupIndex < 50 ? 'bg-amber-400' : 'bg-emerald-500'"
                :style="g.groupIndex >= 0
                  ? { left: '50%',  width: `${Math.round(g.groupIndex / 2)}%` }
                  : { right: '50%', width: `${Math.round(-g.groupIndex / 2)}%` }"
              ></div>
            </div>
            <span
              class="col-span-2 text-right tabular-nums font-bold"
              :class="g.groupIndex < 0 ? 'text-red-600' : g.groupIndex < 50 ? 'text-amber-700' : 'text-emerald-700'"
            >{{ g.groupIndex >= 0 ? '+' : '' }}{{ g.groupIndex }}%</span>
          </li>
        </ul>
      </div>

      <!-- ── Snapshot list ── -->
      <div v-if="snapshots.length" class="rounded-lg border border-slate-200 overflow-hidden">
        <div class="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[12px] font-bold text-slate-700">
          🗂 All snapshots ({{ snapshots.length }})
        </div>
        <ScrollContainer
          outer-class="relative"
          inner-class="text-[11px]"
          inner-style="max-height: 14rem"
          :no-pill="true"
        >
          <ul class="divide-y divide-slate-100">
            <li
              v-for="s in snapshots.slice().reverse()"
              :key="s.id"
              class="px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50"
              @mouseenter="hoveredId = s.id"
              @mouseleave="hoveredId = null"
            >
              <span class="font-mono text-slate-400 text-[10px]">{{ s.at.slice(0, 10) }}</span>
              <span class="text-slate-600">{{ s.planVersion || '—' }}</span>
              <span v-if="s.versionLabel" class="text-slate-400 text-[10px]">({{ s.versionLabel }})</span>
              <span
                class="ml-auto font-bold tabular-nums"
                :class="s.index < 0 ? 'text-rose-600' : s.index < 50 ? 'text-amber-600' : 'text-emerald-700'"
              >{{ s.index >= 0 ? '+' : '' }}{{ s.index }}%</span>
              <span class="text-[9px] text-slate-400 italic">{{ s.trigger }}</span>
            </li>
          </ul>
        </ScrollContainer>
      </div>
    </ScrollContainer>

    <div class="px-5 py-2 border-t border-slate-100 bg-slate-50 shrink-0">
      <p class="text-[10px] text-slate-400 italic">
        Snapshots are taken automatically on every spec version bump. Plan Owner(s) are notified when PHI drops by ≥ {{ ph.custom.value.admin.dropThresholdPct }}%.
      </p>
    </div>
  </RightPanel>
</template>
