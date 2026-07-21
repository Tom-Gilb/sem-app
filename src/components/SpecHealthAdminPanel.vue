<!-- UNIT_TYPE=Widget -->
<!-- PlanHealthAdminPanel.vue — Feature #202.b: Plan Health Record
     Administration Specification.

     The "Admin" half of Plan Health (Status is the read-only sister panel
     PlanHealthStatusPanel.vue). This is where Plan Owner / responsible
     Instance configures the *automatic* Plan Health loop:
       • Aspect & group weights (editable, audited — original Factors UI)
       • Custom aspects (add / remove)
       • Vibrate-below threshold
       • Notification preferences (on/off, frequency, channels, dropThreshold)
       • Auto-snapshot policy (on version bump, periodic interval, retention)
       • Per-Owner notification subset
       • Full reason / audit log

     Every change requires a Reason and is appended to reasonLog. The header
     carries a "📊 Status" link to switch over to the Status panel.
-->
<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import {
  useSpecHealth,
  ASPECT_GROUPS,
  type AspectGroupId,
  type IndexBreakdown,
  type SpecHealthContext,
  type PlanHealthContext,
  type AIExpert,
} from '../composables/useSpecHealth'
import { BUILT_IN_RULES } from '../composables/useAIExpertReview'
import type { SpecBlock } from '../types/spec'
import RightPanel from './RightPanel.vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
// DD-001 (2026-05-13).
import SaveGlyph from './icons/SaveGlyph.vue'
import SpecHealthBadge from './SpecHealthBadge.vue'
import { copyPlanHealthReport, emailPlanHealthReport } from '../composables/useSpecHealthExport'

const props = defineProps<{
  planModelId: string
  spec: SpecBlock
  specOwnerCount: number
  hasSpecOwner: boolean
  hasPlanOwner?: boolean  // @deprecated: use hasSpecOwner
  /** Spec Owner records — used to render per-Owner notification subset toggles
   *  AND pre-fill mailto: recipients when the user clicks ✉️ Email. */
  planOwners?: Array<{ id: string; name: string; email?: string }>
  /** Current plan version label (e.g. "v0.7") — passed to expert reviews so
   *  every review is anchored to a known version in the audit log. */
  planVersion?: string
  /** Who is making the change — used in reason log */
  by: string
  /** Plan display name — included in copy/email subject line */
  planName?: string
}>()

const emit = defineEmits<{ close: []; 'open-status': [] }>()

const ph = useSpecHealth(props.planModelId)

const ctx = computed<SpecHealthContext>(() => ({
  spec: props.spec,
  specOwnerCount: props.specOwnerCount,
  hasSpecOwner: props.hasSpecOwner ?? props.hasPlanOwner ?? false,
}))

const breakdown = computed<IndexBreakdown>(() => ph.computeBreakdown(ctx.value))

// ── Reason capture (one inline draft per pending action) ────────────────────

const pendingReason = reactive<{ kind: string; target: string; payload: any; reasonText: string } | null>(null as any)
const pendingReasonRef = ref<typeof pendingReason | null>(null)

function startEdit(kind: string, target: string, payload: any): void {
  pendingReasonRef.value = { kind, target, payload, reasonText: '' }
}
function cancelEdit(): void { pendingReasonRef.value = null }

// ── Live weight adjustments (no overlay) ──────────────────────────────────
//
// Tom 2026-05-13: "Plan Heath; the weight and adjustment do not work, and
// are all set to 0.1". Two-part fix.
//
// (1) The old `:value`-bound number input + reason-overlay gate made weight
//     changes silently fail: if the user didn't see/fill the overlay (which
//     anchors to the panel footer, often below the fold), the typed value
//     reverted on the next reactive update — looking like the input "doesn't
//     work". Weight adjustments are the highest-frequency operation here, so
//     they get their own commit path that fires IMMEDIATELY with an auto-
//     reason. Audit log still records every change.
//
// (2) Stale localStorage overrides (e.g. an old session that wrote 0.1 to
//     every aspect) are cleared via the new "↺ Reset all weights" button.
//
// Add / remove / disable / threshold still flow through the reason overlay
// because they're less frequent and more impactful.
function commitGroupWeight(groupId: AspectGroupId, value: number): void {
  ph.setGroupWeight(groupId, value, props.by, 'Adjusted group weight via slider')
}
function commitAspectWeight(aspectId: string, value: number): void {
  ph.setAspectWeight(aspectId, value, props.by, 'Adjusted aspect weight via slider')
}
function resetAllWeights(): void {
  if (!window.confirm('Reset every aspect + group weight to its built-in default? This clears all your overrides (audited).')) return
  ph.resetAllWeights(props.by, 'Reset all weights to built-in defaults')
}
function commitEdit(): void {
  const p = pendingReasonRef.value
  if (!p || !p.reasonText.trim()) return
  const reason = p.reasonText.trim()
  switch (p.kind) {
    case 'aspect-weight':   ph.setAspectWeight(p.target, p.payload as number, props.by, reason); break
    case 'aspect-disable':  ph.setAspectDisabled(p.target, p.payload as boolean, props.by, reason); break
    case 'group-weight':    ph.setGroupWeight(p.target as AspectGroupId, p.payload as number, props.by, reason); break
    case 'group-disable':   ph.setGroupDisabled(p.target as AspectGroupId, p.payload as boolean, props.by, reason); break
    case 'threshold':       ph.setThreshold(p.payload as number, props.by, reason); break
    case 'aspect-add':      ph.addCustomAspect({ ...(p.payload as any), by: props.by, reason }); break
    case 'aspect-remove':   ph.removeCustomAspect(p.target, props.by, reason); break
    case 'admin-spec':      ph.setAdminSpec(p.payload as any, props.by, reason); break
    case 'clear-snapshots': ph.clearSnapshots(props.by, reason); break
    case 'expert-add':      ph.addExpert({ ...(p.payload as any), by: props.by, reason }); break
    case 'expert-update':   ph.updateExpert(p.target, p.payload as Partial<AIExpert>, props.by, reason); break
    case 'expert-remove':   ph.removeExpert(p.target, props.by, reason); break
    case 'expert-run':      void ph.runExpertReview(p.target, props.spec, props.planVersion ?? '', props.by, reason); break
    case 'expert-run-all':  void ph.runAllExperts(props.spec, props.planVersion ?? '', props.by, reason); break
  }
  pendingReasonRef.value = null
}

// ── Group sum diagnostic (each group should sum to 1.0 within rounding) ────

function aspectSumIn(groupId: AspectGroupId): number {
  const g = breakdown.value.groups.find(x => x.groupId === groupId)
  if (!g) return 0
  const enabled = g.aspects.filter(a => !a.disabled)
  return enabled.reduce((n, a) => n + a.weight, 0)
}

const groupSum = computed(() => breakdown.value.groups.reduce((n, g) => n + g.groupWeight, 0))

// ── Custom aspect creator ──────────────────────────────────────────────────

const newAspect = reactive({
  name: '', description: '', group: 'risks' as AspectGroupId,
  defaultWeight: 0.1, manualScore: 0, manualDetail: '',
})
const showCreator = ref(false)
function submitNewAspect(): void {
  if (!newAspect.name.trim()) return
  startEdit('aspect-add', '<new>', { ...newAspect })
}

// ── Reason log toggle ──────────────────────────────────────────────────────

const showReasonLog = ref(false)
const recentReasons = computed(() => ph.custom.value.reasonLog.slice().reverse().slice(0, 50))

// ── Plan Health Record Administration Specification (auto-loop knobs) ──────
//
// Every change here flows through `startEdit('admin-spec', '<key>', patch)`
// so the existing reason-required overlay is reused. The commit handler
// dispatches to `ph.setAdminSpec(...)`.

const adminSpec = computed(() => ph.custom.value.admin)
function patchAdmin(patch: Record<string, unknown>, target: string): void {
  startEdit('admin-spec', target, patch)
}

const showAdminSpec = ref(true)
const showOwnerNotify = ref(false)
const showSnapshots = ref(false)

function isOwnerNotified(ownerId: string): boolean {
  const subset = adminSpec.value.notifyOwnerIds
  return subset.length === 0 || subset.includes(ownerId)
}

// ── AI Expert Reviewers ────────────────────────────────────────────────────
//
// Tom's directive: "an AI expert, in special or overall areas (Security,
// usability, ROI, Risks, Quality, anything named and defined by the planners
// and Owners) — analyze the plan, according to its rules, a selection of
// relevant rules, a typed in special set of rules, and come up with a Score
// (-10 to +10 perfect) with a short Paragraph Explaining Why?"
//
// The Experts panel below is the "design easy to modify" half: CRUD on the
// persona list. The Status panel renders the current verdict + Run button.

const showExperts = ref(true)
const expandedExpertId = ref<string | null>(null)

const experts = computed<AIExpert[]>(() => ph.custom.value.experts)
const enabledExpertCount = computed(() => experts.value.filter(e => e.enabled).length)

const newExpert = reactive({
  name: '', domain: 'Security', description: '',
  ruleMode: 'custom' as 'all' | 'select' | 'custom',
  customRules: '', selectedRuleIds: [] as string[],
  weight: 0.20, enabled: true,
})
const showExpertCreator = ref(false)
function submitNewExpert(): void {
  if (!newExpert.name.trim()) return
  startEdit('expert-add', '<new-expert>', { ...newExpert })
}
function patchExpert(expertId: string, patch: Partial<AIExpert>): void {
  startEdit('expert-update', expertId, patch)
}
function toggleExpertEnabled(expertId: string, on: boolean): void {
  // Enable/disable is a frequent, low-friction toggle — commit directly with
  // auto-reason (like the weight sliders). No reason overlay needed.
  ph.updateExpert(expertId, { enabled: on }, props.by, on ? 'Expert enabled' : 'Expert disabled')
  if (on) void undefined // auto-activates ai-experts group in useSpecHealth
}
function runExpert(expertId: string): void {
  startEdit('expert-run', expertId, null)
}
function removeExpert(expertId: string): void {
  startEdit('expert-remove', expertId, null)
}
function runAllExperts(): void {
  startEdit('expert-run-all', '<all>', null)
}
function toggleSelectedRule(expertId: string, ruleId: string, on: boolean): void {
  const e = experts.value.find(x => x.id === expertId); if (!e) return
  const cur = e.selectedRuleIds ?? []
  const next = on ? (cur.includes(ruleId) ? cur : [...cur, ruleId]) : cur.filter(r => r !== ruleId)
  patchExpert(expertId, { selectedRuleIds: next })
}

// ── Copy + Email PHI report ────────────────────────────────────────────────
//
// Tom: "Plan Health (Index and Admin) add button to Copy and to Email."
// Same helpers as the Status panel, so the format stays identical between
// the two surfaces.

const copyState = ref<'idle' | 'ok' | 'fail'>('idle')

function makeExportInput() {
  return {
    planName: props.planName ?? props.planModelId,
    planVersion: props.planVersion ?? '',
    breakdown: breakdown.value,
    custom: ph.custom.value,
    by: props.by,
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

function toggleOwnerNotify(ownerId: string, on: boolean): void {
  // If subset is empty (= all) and the user wants to *exclude* one owner,
  // we must materialise the list to "all owners except this one".
  const allIds = (props.planOwners ?? []).map(o => o.id)
  const cur = adminSpec.value.notifyOwnerIds
  let next: string[]
  if (on) {
    next = cur.length === 0 ? allIds : (cur.includes(ownerId) ? cur : [...cur, ownerId])
  } else {
    if (cur.length === 0) next = allIds.filter(id => id !== ownerId)
    else next = cur.filter(id => id !== ownerId)
  }
  patchAdmin({ notifyOwnerIds: next }, `owner:${ownerId}`)
}
</script>

<template>
  <RightPanel
    class="z-[491] w-[clamp(560px,44vw,760px)] flex flex-col bg-white shadow-2xl border-l border-slate-200"
    :aria-label="`Spec Health Factors — ${breakdown.index >= 0 ? '+' : ''}${breakdown.index}%`"
  >
    <!-- ── Header ────────────────────────────────────────────────────────── -->
    <div class="px-5 py-3 flex items-center gap-3 shrink-0
                bg-gradient-to-r from-slate-700 to-cyan-700 text-white">
      <SpecHealthBadge
        :index="breakdown.index"
        :threshold="ph.custom.value.threshold"
        :size="48"
      />
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-bold tracking-wide">⚙️ Spec Health Administration</h2>
        <p class="text-[11px] text-white/80 mt-0.5">
          Aspects · weights · notifications · auto-snapshots — every change audited
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
          ? `Open mailto: pre-filled to ${(props.planOwners ?? []).filter(o => o.email).length} Spec Owner${(props.planOwners ?? []).filter(o => o.email).length === 1 ? '' : 's'}`
          : 'Open mailto: with the PHI report pre-filled (no Spec Owner emails on file — pick recipient in mail client)'"
        @click="emailReport"
      >✉️ Email</button>
      <button
        type="button"
        class="text-[11px] px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors"
        title="Open the read-only Spec Health Status window (PHI breakdown + history graph)"
        @click="emit('open-status')"
      >📊 Status</button>
      <CloseDot variant="on-dark" aria-label="Close Spec Health Administration" @click="emit('close')" />
    </div>

    <!-- ── Body ──────────────────────────────────────────────────────────── -->
    <ScrollContainer outer-class="flex-1 min-h-0 relative" inner-class="h-full px-5 py-4 space-y-4">

      <!-- Group weight sum diagnostic + Reset-to-defaults escape hatch.
           Tom 2026-05-13: "the weight and adjustment do not work, and are all
           set to 0.1" — stale localStorage overrides from earlier sessions
           can leave every weight pinned at an unusable value. This button
           clears them in one click (one audited entry). -->
      <div class="flex items-center gap-2">
        <div
          v-if="Math.abs(groupSum - 1) > 0.01"
          class="flex-1 text-[11px] rounded-lg border border-amber-200 bg-amber-50 text-amber-800 p-2.5"
        >
          ⚠️ Active group weights sum to {{ Math.round(groupSum * 100) }}% — should sum to 100%. Drag the group sliders below to rebalance.
        </div>
        <button
          type="button"
          class="text-[11px] px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors shrink-0"
          title="Wipe every aspect + group weight override and restore the built-in defaults (one audit-log entry)"
          @click="resetAllWeights"
        >↺ Reset all weights</button>
      </div>

      <!-- ── Per-group cards ── -->
      <div
        v-for="g in breakdown.groups"
        :key="g.groupId"
        class="rounded-lg border border-slate-200 overflow-hidden"
      >
        <!-- Group header -->
        <div class="px-3 py-2 flex items-center gap-2 bg-slate-50 border-b border-slate-200">
          <span aria-hidden="true">{{ g.groupIcon }}</span>
          <span class="text-[12px] font-bold text-slate-800 flex-1 truncate">{{ g.groupLabel }}</span>
          <!-- Group sub-index pill -->
          <span
            class="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            :class="g.groupIndex < 0 ? 'bg-red-100 text-red-700'
                  : g.groupIndex < 50 ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'"
          >{{ g.groupIndex >= 0 ? '+' : '' }}{{ g.groupIndex }}%</span>
          <!-- Group weight editor — slider + number, both live-commit.
               (Was a single number input behind a reason-gate overlay that
               anchored to the panel footer below the fold, so adjustments
               silently failed. Now: drag = save, type = save, audit auto-logs
               'Adjusted group weight via slider'.) -->
          <label class="flex items-center gap-2 text-[10px] text-slate-500" :title="`${g.groupLabel} weight (group sum should be 100%)`">
            <span>weight</span>
            <input
              type="range" min="0" max="1" step="0.01"
              :value="g.groupWeight"
              class="w-24 accent-teal-500 cursor-pointer"
              :aria-label="`${g.groupLabel} group weight — slide 0 to 1`"
              @input="(e: any) => commitGroupWeight(g.groupId, Number(e.target.value))"
            />
            <input
              type="number" min="0" max="1" step="0.01"
              :value="g.groupWeight"
              class="w-14 h-6 px-1.5 rounded border border-slate-200 text-right text-[11px] focus:border-teal-500 focus:outline-none"
              @change="(e: any) => commitGroupWeight(g.groupId, Number(e.target.value))"
            />
          </label>
        </div>

        <!-- Aspect rows -->
        <ul class="divide-y divide-slate-100">
          <li
            v-for="a in g.aspects"
            :key="a.aspectId"
            class="px-3 py-2 grid grid-cols-12 gap-2 items-center text-[11px]"
            :class="a.disabled ? 'opacity-50 bg-slate-50' : ''"
          >
            <span class="col-span-4 font-semibold text-slate-700 truncate" :title="a.name">{{ a.name }}</span>
            <!-- Score bar with sign-aware fill -->
            <div class="col-span-4 h-2 bg-slate-100 rounded-full overflow-hidden relative">
              <!-- Center line at 0 -->
              <div class="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300"></div>
              <div
                class="absolute top-0 bottom-0 transition-all"
                :class="a.score < 0 ? 'bg-red-500' : a.score < 0.5 ? 'bg-amber-400' : 'bg-emerald-500'"
                :style="a.score >= 0
                  ? { left: '50%',  width: `${Math.round(a.score * 50)}%` }
                  : { right: '50%', width: `${Math.round(-a.score * 50)}%` }"
              ></div>
            </div>
            <span class="col-span-1 text-right tabular-nums" :class="a.score < 0 ? 'text-red-600' : 'text-emerald-700'">
              {{ a.score >= 0 ? '+' : '' }}{{ Math.round(a.score * 100) }}
            </span>
            <div class="col-span-2 flex items-center gap-1" :title="`Aspect weight within ${g.groupLabel} (sum should be 1.0)`">
              <input
                type="range" min="0" max="1" step="0.01"
                :value="a.weight"
                :disabled="a.disabled"
                class="flex-1 accent-teal-500 cursor-pointer disabled:opacity-40"
                :aria-label="`${a.name} weight — slide 0 to 1`"
                @input="(e: any) => commitAspectWeight(a.aspectId, Number(e.target.value))"
              />
              <input
                type="number" min="0" max="1" step="0.01"
                :value="a.weight"
                :disabled="a.disabled"
                class="w-12 h-6 px-1 rounded border border-slate-200 text-right text-[10px] focus:border-teal-500 focus:outline-none disabled:opacity-50"
                @change="(e: any) => commitAspectWeight(a.aspectId, Number(e.target.value))"
              />
            </div>
            <button
              type="button"
              class="col-span-1 text-[10px] text-slate-400 hover:text-rose-600 transition-colors"
              :title="a.disabled ? 'Re-enable this aspect' : 'Disable this aspect'"
              @click="startEdit('aspect-disable', a.aspectId, !a.disabled)"
            >{{ a.disabled ? '↑' : '∅' }}</button>

            <!-- Detail row + findings drilldown -->
            <p class="col-span-12 text-[10px] text-slate-500 -mt-1 truncate" :title="a.detail">
              {{ a.detail }}<template v-if="a.findings && a.findings.length"> — <span class="font-mono text-slate-400">{{ a.findings.slice(0, 5).join(', ') }}{{ a.findings.length > 5 ? `, +${a.findings.length - 5} more` : '' }}</span></template>
            </p>
          </li>
        </ul>

        <!-- Aspect-sum diagnostic per group -->
        <p
          v-if="Math.abs(aspectSumIn(g.groupId) - 1) > 0.01"
          class="text-[10px] text-amber-700 px-3 py-1.5 bg-amber-50 border-t border-amber-100"
        >Aspect weights sum to {{ Math.round(aspectSumIn(g.groupId) * 100) }}% — should be 100%</p>
      </div>

      <!-- Threshold editor -->
      <div class="rounded-lg border border-slate-200 p-3 space-y-1.5">
        <label class="text-[12px] font-bold text-slate-700 flex items-center gap-2">
          <span>🚨 Vibrate-below threshold</span>
          <span class="text-[11px] font-normal text-slate-500">— badge vibrates while PHI is under this</span>
        </label>
        <div class="flex items-center gap-2">
          <input
            type="range" min="-100" max="100" step="5"
            :value="ph.custom.value.threshold"
            class="flex-1"
            @change="(e: any) => startEdit('threshold', 'threshold', Number(e.target.value))"
          />
          <span class="w-12 text-right text-[12px] font-mono tabular-nums">{{ ph.custom.value.threshold }}%</span>
        </div>
      </div>

      <!-- ── Plan Health Record Administration Specification ── -->
      <!--
        Tom: "as automatic as possible, requiring no human intervention unless
        Planners and Owners want to use it."  This section is the entire
        automatic-loop control panel: when to snapshot, when to notify, who to
        notify, and how loud to be about it.
      -->
      <div class="rounded-lg border border-cyan-200 bg-cyan-50/40 overflow-hidden">
        <button
          type="button"
          class="w-full px-3 py-2 flex items-center gap-2 text-[12px] font-bold text-cyan-900 hover:bg-cyan-50 transition-colors"
          @click="showAdminSpec = !showAdminSpec"
        >
          <span>{{ showAdminSpec ? '▾' : '▸' }}</span>
          <span>📜 Spec Health Record Administration</span>
          <span class="ml-auto text-[10px] font-normal text-cyan-700">
            {{ adminSpec.notifyOnDrop ? 'auto-notify ON' : 'auto-notify OFF' }} · drop ≥ {{ adminSpec.dropThresholdPct }}%
          </span>
        </button>

        <div v-if="showAdminSpec" class="px-3 pb-3 pt-1 space-y-3">

          <!-- Significant-drop threshold (Tom's quoted 5%) -->
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-700">
              "Significant" drop threshold
              <span class="font-normal text-slate-500">— notify Spec Owner(s) when PHI drops by this many percentage points (default 5%)</span>
            </label>
            <div class="flex items-center gap-2">
              <input
                type="range" min="1" max="50" step="1"
                :value="adminSpec.dropThresholdPct"
                class="flex-1"
                @change="(e: any) => patchAdmin({ dropThresholdPct: Number(e.target.value) }, 'dropThresholdPct')"
              />
              <span class="w-12 text-right text-[12px] font-mono tabular-nums">{{ adminSpec.dropThresholdPct }}%</span>
            </div>
          </div>

          <!-- Master notify switch + frequency -->
          <div class="grid grid-cols-2 gap-3 text-[11px]">
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                :checked="adminSpec.notifyOnDrop"
                @change="(e: any) => patchAdmin({ notifyOnDrop: !!e.target.checked }, 'notifyOnDrop')"
              />
              <span class="font-semibold text-slate-700">Auto-notify Spec Owner(s)</span>
            </label>
            <label class="flex items-center gap-2">
              <span class="font-semibold text-slate-700">Frequency:</span>
              <select
                class="h-6 px-1 rounded border border-slate-300 text-[11px]"
                :value="adminSpec.notifyFrequency"
                @change="(e: any) => patchAdmin({ notifyFrequency: e.target.value }, 'notifyFrequency')"
              >
                <option value="realtime">Real-time</option>
                <option value="daily">Daily digest</option>
                <option value="weekly">Weekly digest</option>
                <option value="never">Never (mute)</option>
              </select>
            </label>
          </div>

          <!-- Channels -->
          <div class="grid grid-cols-2 gap-3 text-[11px]">
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                :checked="adminSpec.notifyChannels.inApp"
                @change="(e: any) => patchAdmin({ notifyChannels: { inApp: !!e.target.checked } }, 'channel:inApp')"
              />
              <span class="text-slate-700">In-app dot + banner</span>
            </label>
            <label class="flex items-center gap-2 opacity-60" title="Server delivery — placeholder for a future hook">
              <input
                type="checkbox"
                :checked="adminSpec.notifyChannels.email"
                @change="(e: any) => patchAdmin({ notifyChannels: { email: !!e.target.checked } }, 'channel:email')"
              />
              <span class="text-slate-700">Email (server hook)</span>
            </label>
          </div>

          <!-- Snapshot policy -->
          <div class="grid grid-cols-2 gap-3 text-[11px] pt-1 border-t border-cyan-100">
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                :checked="adminSpec.autoSnapshotOnVersionBump"
                @change="(e: any) => patchAdmin({ autoSnapshotOnVersionBump: !!e.target.checked }, 'autoSnapshotOnVersionBump')"
              />
              <span class="font-semibold text-slate-700">Auto-snapshot on every version bump</span>
            </label>
            <label class="flex items-center gap-2">
              <span class="font-semibold text-slate-700">Periodic snapshot:</span>
              <input
                type="number" min="0" max="168" step="1"
                :value="adminSpec.autoSnapshotIntervalHours"
                class="w-14 h-6 px-1 rounded border border-slate-300 text-right text-[11px]"
                @change="(e: any) => patchAdmin({ autoSnapshotIntervalHours: Number(e.target.value) }, 'autoSnapshotIntervalHours')"
              />
              <span class="text-slate-500">h (0 = off)</span>
            </label>
          </div>

          <!-- Auto-run AI Experts on every version bump -->
          <label class="flex items-center gap-2 text-[11px] pt-1 border-t border-cyan-100">
            <input
              type="checkbox"
              :checked="adminSpec.autoRunExpertsOnVersionBump"
              @change="(e: any) => patchAdmin({ autoRunExpertsOnVersionBump: !!e.target.checked }, 'autoRunExpertsOnVersionBump')"
            />
            <span class="font-semibold text-slate-700">Auto-run AI Expert reviewers on every version bump</span>
            <span class="text-slate-500">— costs 1 LLM call per enabled Expert ({{ enabledExpertCount }})</span>
          </label>

          <!-- Retention -->
          <label class="flex items-center gap-2 text-[11px] pt-1 border-t border-cyan-100">
            <span class="font-semibold text-slate-700">Snapshot retention:</span>
            <input
              type="number" min="20" max="2000" step="10"
              :value="adminSpec.maxSnapshots"
              class="w-20 h-6 px-1 rounded border border-slate-300 text-right text-[11px]"
              @change="(e: any) => patchAdmin({ maxSnapshots: Number(e.target.value) }, 'maxSnapshots')"
            />
            <span class="text-slate-500">most recent</span>
            <button
              type="button"
              class="ml-auto text-[10px] text-rose-600 hover:underline"
              :title="`Wipe all ${ph.custom.value.snapshots.length} snapshots — requires reason`"
              :disabled="!ph.custom.value.snapshots.length"
              @click="startEdit('clear-snapshots', 'all-snapshots', null)"
            >Clear past versions…</button>
          </label>

          <!-- Per-Owner notification subset (only when there are Owner records) -->
          <div v-if="(props.planOwners ?? []).length" class="pt-1 border-t border-cyan-100">
            <button
              type="button"
              class="w-full text-left text-[11px] font-bold text-slate-700 hover:underline"
              @click="showOwnerNotify = !showOwnerNotify"
            >{{ showOwnerNotify ? '▾' : '▸' }} Notify these Spec Owners ({{ adminSpec.notifyOwnerIds.length === 0 ? 'all' : adminSpec.notifyOwnerIds.length }})</button>
            <ul v-if="showOwnerNotify" class="space-y-1 mt-1.5">
              <li v-for="o in props.planOwners" :key="o.id" class="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  :checked="isOwnerNotified(o.id)"
                  @change="(e: any) => toggleOwnerNotify(o.id, !!e.target.checked)"
                />
                <span class="font-semibold text-slate-700">{{ o.name }}</span>
                <span v-if="o.email" class="text-slate-500">— {{ o.email }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ── AI Expert Reviewers ── -->
      <!--
        Tom's directive: "an AI expert, in special or overall areas (Security,
        usability, ROI, Risks, Quality, anything named and defined by the
        planners and Owners) — analyze the plan, according to its rules, a
        selection of relevant rules, a typed-in special set of rules, and come
        up with a Score (-10 to +10 perfect) with a short Paragraph Explaining
        Why?  This is then integrated into the Plan Health Index."

        Five seed personas ship disabled (zero LLM cost). When the Owner
        enables one, addExpert() auto-activates the 'ai-experts' group at
        weight 0.15 — no manual group-weight juggling required.
      -->
      <div class="rounded-lg border border-violet-200 bg-violet-50/40 overflow-hidden">
        <button
          type="button"
          class="w-full px-3 py-2 flex items-center gap-2 text-[12px] font-bold text-violet-900 hover:bg-violet-50 transition-colors"
          @click="showExperts = !showExperts"
        >
          <span>{{ showExperts ? '▾' : '▸' }}</span>
          <span>🧠 AI Expert Reviewers</span>
          <span class="ml-auto text-[10px] font-normal text-violet-700">
            {{ enabledExpertCount }} / {{ experts.length }} enabled
          </span>
        </button>

        <div v-if="showExperts" class="px-3 pb-3 pt-1 space-y-2.5">
          <p class="text-[10px] text-slate-500 italic">
            Each Expert is a named AI persona that scores the plan from −10 (catastrophe)
            to +10 (perfect) for its domain. Scores feed into the PHI inside the
            "AI Expert Reviews" group.
          </p>

          <!-- Bulk run -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-[11px] px-2 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-50"
              :disabled="enabledExpertCount === 0"
              :title="`Re-run all ${enabledExpertCount} enabled experts (one LLM call each)`"
              @click="runAllExperts"
            >🔁 Run all enabled ({{ enabledExpertCount }})</button>
            <button
              type="button"
              class="text-[11px] px-2 py-1 rounded border border-violet-300 text-violet-700 hover:bg-violet-100"
              @click="showExpertCreator = !showExpertCreator"
            >{{ showExpertCreator ? '▾' : '＋' }} Add Expert</button>
          </div>

          <!-- New-Expert creator -->
          <div v-if="showExpertCreator" class="rounded border border-violet-200 bg-white p-2.5 space-y-2 text-[11px]">
            <div class="grid grid-cols-12 gap-2">
              <input v-model="newExpert.name" type="text" placeholder="Expert name (e.g. 'Compliance Auditor')"
                     class="col-span-7 h-7 px-2 rounded border border-slate-200" />
              <input v-model="newExpert.domain" type="text" placeholder="Domain (Security / ROI / …)"
                     class="col-span-5 h-7 px-2 rounded border border-slate-200" />
              <input v-model="newExpert.description" type="text" placeholder="What does this expert focus on?"
                     class="col-span-12 h-7 px-2 rounded border border-slate-200" />
            </div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-slate-700">Rules:</span>
              <label class="flex items-center gap-1"><input type="radio" :checked="newExpert.ruleMode === 'all'" @change="newExpert.ruleMode = 'all'" /> All built-in</label>
              <label class="flex items-center gap-1"><input type="radio" :checked="newExpert.ruleMode === 'select'" @change="newExpert.ruleMode = 'select'" /> Select subset</label>
              <label class="flex items-center gap-1"><input type="radio" :checked="newExpert.ruleMode === 'custom'" @change="newExpert.ruleMode = 'custom'" /> Custom text</label>
            </div>
            <textarea
              v-if="newExpert.ruleMode === 'custom'"
              v-model="newExpert.customRules"
              rows="3"
              placeholder="Type one rule per line. Example: 'Penalise plans without a documented rollback path.'"
              class="w-full px-2 py-1 rounded border border-slate-200 text-[11px] font-mono leading-snug"
            ></textarea>
            <ScrollContainer
              v-if="newExpert.ruleMode === 'select'"
              outer-class="relative rounded border border-slate-200 bg-slate-50"
              inner-class="grid grid-cols-2 gap-x-3 gap-y-1 p-2"
              inner-style="max-height: 8rem"
              :no-pill="true"
            >
              <label v-for="r in BUILT_IN_RULES" :key="r.id" class="flex items-start gap-1 text-[10px]">
                <input
                  type="checkbox"
                  :checked="newExpert.selectedRuleIds.includes(r.id)"
                  @change="(e: any) => { if (e.target.checked) newExpert.selectedRuleIds.push(r.id); else newExpert.selectedRuleIds = newExpert.selectedRuleIds.filter(x => x !== r.id) }"
                />
                <span><span class="font-mono text-slate-400">[{{ r.id }}]</span> {{ r.text }}</span>
              </label>
            </ScrollContainer>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1">
                <span class="font-semibold text-slate-700">Weight:</span>
                <input v-model.number="newExpert.weight" type="number" min="0" max="1" step="0.05"
                       class="w-16 h-6 px-1 rounded border border-slate-200 text-right" />
              </label>
              <label class="flex items-center gap-1">
                <input type="checkbox" v-model="newExpert.enabled" />
                <span>Enabled</span>
              </label>
              <button
                type="button"
                class="ml-auto text-[11px] px-3 h-7 rounded bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-50"
                :disabled="!newExpert.name.trim()"
                @click="submitNewExpert"
              >Add Expert</button>
            </div>
          </div>

          <!-- Expert list -->
          <ul class="space-y-1.5">
            <li
              v-for="e in experts"
              :key="e.id"
              class="rounded border border-slate-200 bg-white overflow-hidden"
            >
              <div class="px-2.5 py-1.5 flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  :checked="e.enabled"
                  :title="e.enabled ? 'Disable this expert (its score stops contributing)' : 'Enable this expert'"
                  @change="(ev: any) => toggleExpertEnabled(e.id, !!ev.target.checked)"
                />
                <span class="text-base" aria-hidden="true">🧠</span>
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-slate-800 truncate">
                    {{ e.name }}
                    <span class="font-normal text-violet-700">— {{ e.domain }}</span>
                  </p>
                  <p class="text-[10px] text-slate-500 truncate" :title="e.description">{{ e.description }}</p>
                </div>
                <!-- Score pill -->
                <span
                  v-if="e.lastReview"
                  class="font-bold tabular-nums text-[11px] px-1.5 py-0.5 rounded-full"
                  :class="e.lastReview.score < 0 ? 'bg-rose-100 text-rose-700' : e.lastReview.score < 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'"
                  :title="e.lastReview.why"
                >{{ e.lastReview.score >= 0 ? '+' : '' }}{{ e.lastReview.score }}/10</span>
                <span v-else class="text-[10px] italic text-slate-400">no review</span>
                <!-- Weight -->
                <input
                  type="number" min="0" max="1" step="0.05"
                  :value="e.weight"
                  class="w-14 h-6 px-1 rounded border border-slate-200 text-right text-[11px]"
                  title="Weight within the AI Experts group (0..1)"
                  @change="(ev: any) => patchExpert(e.id, { weight: Number(ev.target.value) })"
                />
                <!-- Run -->
                <button
                  type="button"
                  class="text-[10px] px-1.5 py-0.5 rounded bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-50"
                  :disabled="e.running || !e.enabled"
                  :title="e.running ? 'Review in flight…' : 'Run this expert against the current plan'"
                  @click="runExpert(e.id)"
                >{{ e.running ? '⏳' : '🔁' }}</button>
                <!-- Edit -->
                <button
                  type="button"
                  class="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                  @click="expandedExpertId = expandedExpertId === e.id ? null : e.id"
                  :title="expandedExpertId === e.id ? 'Collapse' : 'Edit rules / persona'"
                >{{ expandedExpertId === e.id ? '▴' : '✎' }}</button>
                <!-- Remove -->
                <button
                  type="button"
                  class="text-[10px] text-rose-500 hover:text-rose-700"
                  title="Remove this expert (audited)"
                  @click="removeExpert(e.id)"
                >✕</button>
              </div>

              <!-- Last review summary -->
              <div v-if="e.lastReview" class="px-2.5 pb-1.5 border-t border-slate-100 pt-1 space-y-0.5">
                <p class="text-[10px] text-slate-600 italic">
                  "{{ e.lastReview.why }}"
                  <span class="text-[9px] text-slate-400 not-italic"> — v{{ e.lastReview.planVersion || '?' }} · {{ e.lastReview.model }} · {{ e.lastReview.ruleCount }} rule{{ e.lastReview.ruleCount === 1 ? '' : 's' }}</span>
                </p>
                <p v-if="(e.lastReview.references?.length ?? 0)" class="text-[10px] text-slate-600">
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
              </div>
              <p v-if="e.lastError" class="px-2.5 pb-1.5 text-[10px] text-rose-600 border-t border-rose-100 pt-1">⚠️ {{ e.lastError }}</p>

              <!-- Expanded editor -->
              <div v-if="expandedExpertId === e.id" class="px-2.5 pb-2 pt-1.5 space-y-2 border-t border-slate-100 bg-slate-50/60 text-[11px]">
                <div class="grid grid-cols-2 gap-2">
                  <label class="flex items-center gap-1">
                    <span class="font-semibold text-slate-700 w-12">Name:</span>
                    <input
                      type="text" :value="e.name"
                      class="flex-1 h-6 px-1.5 rounded border border-slate-200"
                      @change="(ev: any) => patchExpert(e.id, { name: ev.target.value })"
                    />
                  </label>
                  <label class="flex items-center gap-1">
                    <span class="font-semibold text-slate-700 w-14">Domain:</span>
                    <input
                      type="text" :value="e.domain"
                      class="flex-1 h-6 px-1.5 rounded border border-slate-200"
                      @change="(ev: any) => patchExpert(e.id, { domain: ev.target.value })"
                    />
                  </label>
                </div>
                <label class="block">
                  <span class="font-semibold text-slate-700">Description:</span>
                  <input
                    type="text" :value="e.description"
                    class="w-full h-6 px-1.5 mt-0.5 rounded border border-slate-200"
                    @change="(ev: any) => patchExpert(e.id, { description: ev.target.value })"
                  />
                </label>
                <div class="flex items-center gap-3">
                  <span class="font-semibold text-slate-700">Rules:</span>
                  <label class="flex items-center gap-1"><input type="radio" :checked="e.ruleMode === 'all'" @change="patchExpert(e.id, { ruleMode: 'all' })" /> All built-in ({{ BUILT_IN_RULES.length }})</label>
                  <label class="flex items-center gap-1"><input type="radio" :checked="e.ruleMode === 'select'" @change="patchExpert(e.id, { ruleMode: 'select' })" /> Subset</label>
                  <label class="flex items-center gap-1"><input type="radio" :checked="e.ruleMode === 'custom'" @change="patchExpert(e.id, { ruleMode: 'custom' })" /> Custom</label>
                </div>
                <textarea
                  v-if="e.ruleMode === 'custom'"
                  :value="e.customRules"
                  rows="4"
                  placeholder="Type one rule per line."
                  class="w-full px-2 py-1 rounded border border-slate-200 text-[11px] font-mono leading-snug"
                  @change="(ev: any) => patchExpert(e.id, { customRules: ev.target.value })"
                ></textarea>
                <ScrollContainer
                  v-if="e.ruleMode === 'select'"
                  outer-class="relative rounded border border-slate-200 bg-white"
                  inner-class="grid grid-cols-2 gap-x-3 gap-y-1 p-2"
                  inner-style="max-height: 8rem"
                  :no-pill="true"
                >
                  <label v-for="r in BUILT_IN_RULES" :key="r.id" class="flex items-start gap-1 text-[10px]">
                    <input
                      type="checkbox"
                      :checked="(e.selectedRuleIds ?? []).includes(r.id)"
                      @change="(ev: any) => toggleSelectedRule(e.id, r.id, !!ev.target.checked)"
                    />
                    <span><span class="font-mono text-slate-400">[{{ r.id }}]</span> {{ r.text }}</span>
                  </label>
                </ScrollContainer>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Snapshot history mini-summary (full graph lives in Status panel) -->
      <div class="rounded-lg border border-slate-200 p-3 space-y-1.5">
        <button
          type="button"
          class="w-full flex items-center gap-2 text-[12px] font-bold text-slate-700 hover:underline"
          @click="showSnapshots = !showSnapshots"
        >
          <span>{{ showSnapshots ? '▾' : '▸' }}</span>
          <span>📈 Past snapshots ({{ ph.custom.value.snapshots.length }})</span>
          <span class="ml-auto text-[10px] font-normal text-slate-500">full graph in 📊 Status →</span>
        </button>
        <ScrollContainer
          v-if="showSnapshots && ph.custom.value.snapshots.length"
          outer-class="relative"
          inner-class="space-y-0.5 text-[10px]"
          inner-style="max-height: 10rem"
          :no-pill="true"
        >
          <ul class="space-y-0.5">
            <li
              v-for="s in ph.custom.value.snapshots.slice().reverse()"
              :key="s.id"
              class="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50"
            >
              <span class="font-mono text-slate-400">{{ s.at.slice(0, 10) }}</span>
              <span class="text-slate-500">{{ s.planVersion || '—' }}</span>
              <span
                class="ml-auto font-bold tabular-nums"
                :class="s.index < 0 ? 'text-rose-600' : s.index < 50 ? 'text-amber-600' : 'text-emerald-700'"
              >{{ s.index >= 0 ? '+' : '' }}{{ s.index }}%</span>
              <span class="text-slate-400 text-[9px]">{{ s.trigger }}</span>
            </li>
          </ul>
        </ScrollContainer>
        <p v-else-if="showSnapshots" class="text-[10px] italic text-slate-400">No snapshots yet — they appear automatically on each spec version bump.</p>
      </div>

      <!-- Custom aspect creator -->
      <div class="rounded-lg border border-slate-200 p-3 space-y-2">
        <button
          type="button"
          class="text-[12px] font-bold text-teal-700 hover:underline"
          @click="showCreator = !showCreator"
        >{{ showCreator ? '▾' : '▸' }} Add a custom aspect</button>
        <div v-if="showCreator" class="grid grid-cols-12 gap-2 text-[11px]">
          <input v-model="newAspect.name" type="text" placeholder="Aspect name"
                 class="col-span-6 h-7 px-2 rounded border border-slate-200" />
          <select v-model="newAspect.group" class="col-span-3 h-7 px-1 rounded border border-slate-200">
            <option v-for="g in (Object.keys(ASPECT_GROUPS) as AspectGroupId[])" :key="g" :value="g">{{ ASPECT_GROUPS[g].label }}</option>
          </select>
          <input v-model.number="newAspect.defaultWeight" type="number" min="0" max="1" step="0.05" placeholder="weight"
                 class="col-span-3 h-7 px-1.5 rounded border border-slate-200 text-right" />
          <input v-model="newAspect.description" type="text" placeholder="What does it measure?"
                 class="col-span-12 h-7 px-2 rounded border border-slate-200" />
          <input v-model.number="newAspect.manualScore" type="number" min="-1" max="1" step="0.1" placeholder="manual score (-1..+1)"
                 class="col-span-4 h-7 px-1.5 rounded border border-slate-200 text-right" />
          <input v-model="newAspect.manualDetail" type="text" placeholder="Why this score?"
                 class="col-span-6 h-7 px-2 rounded border border-slate-200" />
          <button
            type="button"
            class="col-span-2 h-7 rounded bg-teal-500 hover:bg-teal-600 text-white text-[11px] font-semibold disabled:opacity-50"
            :disabled="!newAspect.name.trim()"
            @click="submitNewAspect"
          >Add</button>
        </div>
      </div>

      <!-- Reason log -->
      <div class="rounded-lg border border-slate-200 p-3 space-y-1.5">
        <button
          type="button"
          class="text-[12px] font-bold text-slate-700 hover:underline w-full text-left"
          @click="showReasonLog = !showReasonLog"
        >{{ showReasonLog ? '▾' : '▸' }} Reason log ({{ ph.custom.value.reasonLog.length }})</button>
        <ScrollContainer
          v-if="showReasonLog && recentReasons.length"
          outer-class="relative"
          inner-class="space-y-1 text-[10px]"
          inner-style="max-height: 12rem"
          :no-pill="true"
        >
          <ul class="space-y-1">
            <li v-for="(r, i) in recentReasons" :key="i" class="rounded bg-slate-50 px-2 py-1 text-slate-700">
              <span class="font-mono text-slate-400">{{ r.at.slice(0, 10) }}</span>
              <span class="font-semibold ml-1">{{ r.action }}</span>
              <span class="ml-1">{{ r.target }}</span>
              <template v-if="r.before !== undefined && r.after !== undefined">
                : <span class="text-slate-400">{{ r.before }}</span> → <span class="text-emerald-700 font-bold">{{ r.after }}</span>
              </template>
              <p class="italic text-slate-500 mt-0.5">{{ r.reason }}</p>
              <p class="text-[9px] text-slate-400">by {{ r.by }}</p>
            </li>
          </ul>
        </ScrollContainer>
        <p v-else-if="showReasonLog" class="text-[10px] italic text-slate-400">No changes recorded yet.</p>
      </div>
    </ScrollContainer>

    <!-- ── Inline reason-required overlay (anchored to footer) ── -->
    <div
      v-if="pendingReasonRef"
      class="border-t border-amber-300 bg-amber-50 p-3 space-y-2 shrink-0"
    >
      <p class="text-[11px] font-bold text-amber-900">
        Reason required for {{ pendingReasonRef.kind }} on {{ pendingReasonRef.target }}
      </p>
      <input
        v-model="pendingReasonRef.reasonText"
        type="text"
        placeholder="Why this change? (audited)"
        class="w-full h-8 px-2 text-[12px] rounded border border-amber-300 focus:border-amber-500 focus:outline-none"
        @keyup.enter="commitEdit"
      />
      <div class="flex gap-2 justify-end">
        <button type="button" class="text-[11px] px-2.5 py-1 rounded text-slate-600 hover:bg-slate-100" @click="cancelEdit">Cancel</button>
        <button
          type="button"
          class="text-[11px] px-3 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50"
          :disabled="!pendingReasonRef.reasonText.trim()"
          @click="commitEdit"
        >
          <span class="inline-flex items-center gap-1.5">
            <SaveGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
            <span>Save with reason</span>
          </span>
        </button>
      </div>
    </div>

    <div class="px-5 py-2 border-t border-slate-100 bg-slate-50 shrink-0">
      <p class="text-[10px] text-slate-400 italic">
        Aspects, groups and weights are visible and editable. Weight slides commit on release with an auto-reason; add / remove / disable / threshold still require a reason. All changes audited.
      </p>
    </div>
  </RightPanel>
</template>
