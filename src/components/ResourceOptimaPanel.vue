<!--
  ResourceOptimaPanel.vue — OPTIMA: Potential Resource Optimization Tool

  Realization of Optima book principles (Tom Gilb 2024: "Balancing Critical Values").

  DESIGN PRINCIPLES (from the Optima book cover):
  - "A system of values and resources (dots) in reasonable balance"
  - Threshold hierarchy: Stretch (aspiration) > Goal (target) > Tolerable (hard floor)
  - Green dots = at or above Goal (meeting target)
  - Orange/yellow = between Tolerable and Goal (at risk but not violated)
  - Red + rapid vibration = below Tolerable (CONSTRAINT VIOLATION)

  KEY INTERACTIONS (Tom's spec):
  1. Resource sliders — adjust Resource (Means Attributes) up/down
  2. Impact propagation — adjusting one resource recalculates all value estimates
  3. Top-3 most impacted values VIBRATE for 2 seconds after each slider change
  4. Violations (below Tolerable) RAPIDLY VIBRATE IN RED, "Tolerable Constraint Violation"
  5. "Adjust values to avoid Constraint Violation" button auto-restores violating entries
  6. Color coding: green (at/above Goal), orange (Tolerable < x < Goal), red (violation)

  DEEP PLANGUAGE THEORY (from DEEP book + Optima book):
  Resources can be INCREASED while others decrease — "buy" more value by investing.
  One resource trade-off can unlock Goal achievement on multiple other values.
  The optimal point (OPTIMA) is NOT the cheapest, fastest, or simplest — it's the
  combination that reaches the maximum number of Value Goals within all Constraints.

  Spec: ResourceOptimaPanel 2026-06-05.
-->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { SpecBlock } from '../types/spec'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import OptimaGlyph from './icons/OptimaGlyph.vue'
import ResourceArtsyGlyph from './icons/ResourceArtsyGlyph.vue'
import {
  exportArtefact,
  htmlEsc,
  softWrap,
  htmlDocumentShell,
  sectionHeaderHtml,
} from '../composables/useExportShared'

// UNIT_TYPE=Panel

const props = defineProps<{
  spec: SpecBlock | null
  /** V×R impact ratios from Stage 7. Key: `${valueId}__${resourceId}` */
  vcRatios?: Record<string, number>
}>()

const emit = defineEmits<{
  close: []
}>()

// ── Keyboard close ──────────────────────────────────────────────────────────
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close') }
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  if (vibrateTimer)    clearTimeout(vibrateTimer)
  if (consequenceTimer) clearTimeout(consequenceTimer)
  if (rebalanceTimer)  clearTimeout(rebalanceTimer)
})

// ── Data model ───────────────────────────────────────────────────────────────

interface OptimaEntry {
  id: string
  type: 'value' | 'resource'
  label: string
  /** 0–150 slider range. 100 = at Goal. 50 = at Tolerable. 150 = at Wish/Stretch. */
  current: number
  /** Tolerable threshold as slider position (default 50). */
  tolerablePos: number
  /** Goal threshold as slider position (default 100). */
  goalPos: number
  /** Wish/Stretch as slider position (default 130). */
  wishPos: number
  unit: string
}

function makeEntries(): OptimaEntry[] {
  if (!props.spec) return demoEntries()
  const entries: OptimaEntry[] = []

  // Value entries
  for (const v of (props.spec.values ?? [])) {
    entries.push({
      id: v.id,
      type: 'value',
      label: v.description || v.id,
      current: 85,      // start between Tolerable and Goal — room to improve
      tolerablePos: 50,
      goalPos: 100,
      wishPos: 130,
      unit: v.scale?.split(/\s+/).slice(-1)[0] ?? '',
    })
  }

  // Resource entries
  for (const r of (props.spec.resources ?? [])) {
    entries.push({
      id: r.id,
      type: 'resource',
      label: r.description || r.id,
      current: 100,     // start at Goal (allocated budget)
      tolerablePos: 30,
      goalPos: 100,
      wishPos: 140,
      unit: r.scale?.split(/\s+/).slice(-1)[0] ?? '',
    })
  }

  // If no spec data, return demo entries
  if (entries.length === 0) return demoEntries()
  return entries
}

function demoEntries(): OptimaEntry[] {
  return [
    { id: 'demo-v1', type: 'value', label: 'System Performance Speed',    current: 88, tolerablePos: 50, goalPos: 100, wishPos: 130, unit: 'ms' },
    { id: 'demo-v2', type: 'value', label: 'User Satisfaction Score',      current: 72, tolerablePos: 50, goalPos: 100, wishPos: 130, unit: '/10' },
    { id: 'demo-v3', type: 'value', label: 'Data Accuracy Rate',           current: 95, tolerablePos: 50, goalPos: 100, wishPos: 130, unit: '%' },
    { id: 'demo-v4', type: 'value', label: 'Stakeholder Value Delivery',   current: 55, tolerablePos: 50, goalPos: 100, wishPos: 130, unit: 'pts' },
    { id: 'demo-r1', type: 'resource', label: 'Calendar Budget (weeks)',   current: 100, tolerablePos: 30, goalPos: 100, wishPos: 140, unit: 'wks' },
    { id: 'demo-r2', type: 'resource', label: 'Team Hours per Evo Step',   current: 100, tolerablePos: 30, goalPos: 100, wishPos: 140, unit: 'hrs' },
    { id: 'demo-r3', type: 'resource', label: 'Capital Budget',            current: 100, tolerablePos: 30, goalPos: 100, wishPos: 140, unit: '$k' },
    { id: 'demo-r4', type: 'resource', label: 'Specialist Consultants',    current: 85,  tolerablePos: 30, goalPos: 100, wishPos: 140, unit: 'days' },
  ]
}

const entries = ref<OptimaEntry[]>(makeEntries())
watch(() => props.spec, () => { entries.value = makeEntries() }, { deep: true })

// ── Animation state ──────────────────────────────────────────────────────────
const vibrating = ref<Set<string>>(new Set())  // top-3 impacted — vibrate 2s then stop
const violating = ref<Set<string>>(new Set())  // below Tolerable — shake continuously
let vibrateTimer: ReturnType<typeof setTimeout> | null = null

// ── Rebalancing feedback — brief confirmation after each action ───────────────
const lastRebalanceAction = ref<string | null>(null)
let rebalanceTimer: ReturnType<typeof setTimeout> | null = null

function showRebalanceFeedback(msg: string) {
  lastRebalanceAction.value = msg
  if (rebalanceTimer) clearTimeout(rebalanceTimer)
  rebalanceTimer = setTimeout(() => { lastRebalanceAction.value = null }, 3000)
}

// ── Consequence log — shows what changed after each slider move ───────────────
interface ConsequenceEntry {
  entryId: string
  label: string
  oldVal: number
  newVal: number
  direction: 'up' | 'down' | 'stable'
}
const lastConsequences = ref<ConsequenceEntry[]>([])
const lastMovedResource = ref<string | null>(null)
let consequenceTimer: ReturnType<typeof setTimeout> | null = null

function updateViolations() {
  const v = new Set<string>()
  for (const e of entries.value) {
    if (e.current < e.tolerablePos) v.add(e.id)
  }
  violating.value = v
}

// ── Slider interaction ───────────────────────────────────────────────────────

function onResourceSlider(resourceId: string, newVal: number) {
  const resource = entries.value.find(e => e.id === resourceId)
  if (!resource) return
  const delta = newVal - resource.current

  // Propagate impact to value entries + build consequence log
  const valueEntriesArr = entries.value.filter(e => e.type === 'value')
  const impacts: Array<{ id: string; delta: number }> = []
  const consequences: ConsequenceEntry[] = []

  for (const ve of valueEntriesArr) {
    const key = `${ve.id}__${resourceId}`
    const ratio = props.vcRatios?.[key] ?? (1 / Math.max(1, valueEntriesArr.length))
    const change = delta * ratio * 0.4
    const oldVal = ve.current
    ve.current = Math.max(0, Math.min(150, ve.current + change))
    const actualChange = ve.current - oldVal
    impacts.push({ id: ve.id, delta: Math.abs(actualChange) })
    if (Math.abs(actualChange) >= 0.5) {
      consequences.push({
        entryId: ve.id,
        label: ve.label,
        oldVal: Math.round(oldVal),
        newVal: Math.round(ve.current),
        direction: actualChange > 0 ? 'up' : 'down',
      })
    }
  }

  resource.current = newVal
  lastMovedResource.value = resource.label
  // Sort by magnitude of change, show top 5
  consequences.sort((a, b) => Math.abs(b.newVal - b.oldVal) - Math.abs(a.newVal - a.oldVal))
  lastConsequences.value = consequences.slice(0, 5)

  // Top-3 most impacted → vibrate
  impacts.sort((a, b) => b.delta - a.delta)
  const top3 = new Set(impacts.slice(0, 3).map(i => i.id))
  vibrating.value = top3
  if (vibrateTimer) clearTimeout(vibrateTimer)
  vibrateTimer = setTimeout(() => { vibrating.value = new Set() }, 2000)

  // Clear consequence panel after 5 seconds
  if (consequenceTimer) clearTimeout(consequenceTimer)
  consequenceTimer = setTimeout(() => { lastConsequences.value = [] }, 5000)

  updateViolations()
}

// ── Fix violations ───────────────────────────────────────────────────────────

function fixViolations() {
  for (const e of entries.value) {
    if (e.current < e.tolerablePos) {
      e.current = e.tolerablePos + 5  // restore to just above Tolerable
    }
  }
  // Cascade: increase the resource sliders proportionally to fund the fix
  for (const r of entries.value.filter(e => e.type === 'resource')) {
    if (r.current < r.goalPos * 0.8) r.current = Math.min(r.current * 1.15, r.goalPos)
  }
  updateViolations()
}

// ── Rebalancing actions ───────────────────────────────────────────────────────

/**
 * Lifts every resource currently below its Goal threshold up to the Goal position,
 * cascading value updates live. This is what the "↑ Lift lowest resources to Goal"
 * button does — it is NOT the same as fixViolations (which only restores to Tolerable).
 */
function liftToGoal() {
  const belowGoal = resourceEntries.value.filter(r => r.current < r.goalPos)
  if (belowGoal.length === 0) {
    showRebalanceFeedback('✓ All resources already at or above Goal — no change needed')
    return
  }
  for (const r of belowGoal) onResourceSlider(r.id, r.goalPos)
  showRebalanceFeedback(`↑ ${belowGoal.length} resource${belowGoal.length !== 1 ? 's' : ''} lifted to Goal — values updated`)
}

/**
 * Reduces every resource slider by 20%, flooring at tolerablePos + 5.
 * Lets the planner explore whether Values hold at lower cost (DEEP theory).
 */
function reduceAllResources() {
  const resources = resourceEntries.value
  for (const r of resources)
    onResourceSlider(r.id, Math.max(r.tolerablePos + 5, Math.round(r.current * 0.8)))
  showRebalanceFeedback(`↓ All ${resources.length} resources reduced 20% — check values for Tolerable violations`)
}

// ── Reset ────────────────────────────────────────────────────────────────────

function reset() {
  entries.value = makeEntries()
  vibrating.value = new Set()
  violating.value = new Set()
  showRebalanceFeedback('↺ All entries reset to starting Goal positions')
}

// ── Status helpers ───────────────────────────────────────────────────────────

function statusColor(e: OptimaEntry): string {
  if (e.current >= e.goalPos)      return '#16a34a'  // green — at or above Goal
  if (e.current >= e.tolerablePos) return '#f59e0b'  // orange — between Tolerable and Goal
  return '#dc2626'                                    // red — VIOLATION
}

function statusLabel(e: OptimaEntry): string {
  if (e.current >= e.wishPos)      return 'Wish ✦'
  if (e.current >= e.goalPos)      return 'Goal ✓'
  if (e.current >= e.tolerablePos) return 'Tolerable'
  return 'VIOLATION'
}

// ── Computed ─────────────────────────────────────────────────────────────────

const valueEntries    = computed(() => entries.value.filter(e => e.type === 'value'))
const resourceEntries = computed(() => entries.value.filter(e => e.type === 'resource'))
const hasViolations   = computed(() => violating.value.size > 0)
const violationCount  = computed(() => violating.value.size)

// ── Export ───────────────────────────────────────────────────────────────────
// Tom Gilb 2026-06-06: Export button on every substantial window. OPTIMA's
// state at export = current slider positions, status colour bands, violation
// count, V×R ratios (if supplied). One HTML doc, 100% of the model visible.

function statusBgHex(e: OptimaEntry): { bg: string; fg: string; name: string } {
  if (e.current >= e.wishPos)      return { bg: '#ede9fe', fg: '#5b21b6', name: 'Wish ✦ (beyond commitment)' }
  if (e.current >= e.goalPos)      return { bg: '#d1fae5', fg: '#065f46', name: 'Goal ✓ (at commitment)' }
  if (e.current >= e.tolerablePos) return { bg: '#fef3c7', fg: '#78350f', name: 'Tolerable (Constraint MET)' }
  return                                  { bg: '#fee2e2', fg: '#991b1b', name: 'VIOLATION (Constraint NOT met)' }
}

function _renderOptimaEntryRow(e: OptimaEntry, accentBg: string): string {
  const status = statusBgHex(e)
  const labelLines = softWrap(e.label, 60)
  const labelRows = labelLines.map((line, i) =>
    `<tr><td bgcolor="${status.bg}" style="background:${status.bg};color:${status.fg};padding:${i === 0 ? '4' : '1'}px 18px;font:${i === 0 ? '700' : '400'} 12px/1.5 'Helvetica Neue',Arial,sans-serif;">${i === 0 ? `<b>${htmlEsc(e.id)}</b> · ` : ''}${htmlEsc(line)}</td></tr>`
  ).join('')
  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 4px 0;border-collapse:collapse;border:1px solid #cbd5e1;">
  <tr><td bgcolor="${accentBg}" style="background:${accentBg};color:#ffffff;padding:3px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.1em;text-transform:uppercase;">${e.type === 'value' ? 'VALUE' : 'RESOURCE'}</td></tr>
  ${labelRows}
  <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:4px 18px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1f2937;">Current: <b>${e.current}</b>${e.unit ? ' ' + htmlEsc(e.unit) : ''} · Tolerable @ ${e.tolerablePos} · Goal @ ${e.goalPos} · Wish @ ${e.wishPos}</td></tr>
  <tr><td bgcolor="${status.bg}" style="background:${status.bg};color:${status.fg};padding:4px 18px;font:700 11px/1.4 'Helvetica Neue',Arial,sans-serif;">Status: ${status.name}</td></tr>
</table>`
}

function _renderOptimaHtml(): string {
  const vRows = valueEntries.value.map(e => _renderOptimaEntryRow(e, '#7c3aed')).join('')
  const rRows = resourceEntries.value.map(e => _renderOptimaEntryRow(e, '#c2410c')).join('')
  const violationHeader = hasViolations.value
    ? `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;"><tr><td bgcolor="#dc2626" style="background:#dc2626;color:#ffffff;padding:8px 18px;font:700 12px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">⚠ ${violationCount.value} Constraint Violation${violationCount.value !== 1 ? 's' : ''} — entry below Tolerable</td></tr></table>`
    : `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px 0;border-collapse:collapse;"><tr><td bgcolor="#16a34a" style="background:#16a34a;color:#ffffff;padding:8px 18px;font:700 12px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">✓ No Constraint violations — every entry MEETS its Tolerable threshold</td></tr></table>`

  const headerBlock = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  <tr><td bgcolor="#c2410c" style="background:#c2410c;color:#ffffff;padding:8px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">OPTIMA · Potential Resource Optimization</td></tr>
  <tr><td bgcolor="#ea580c" style="background:#ea580c;color:#fff7ed;padding:4px 22px 10px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">Balancing Critical Values — DEEP theory (Tom Gilb, OPTIMA book 2024)</td></tr>
</table>`

  return htmlDocumentShell({
    title: 'OPTIMA Resource Optimization',
    bodyHtml: headerBlock + violationHeader +
      sectionHeaderHtml(`VALUES · ${valueEntries.value.length} entries`, '#5b21b6') + vRows +
      sectionHeaderHtml(`RESOURCES · ${resourceEntries.value.length} entries`, '#c2410c') + rRows,
  })
}

function _renderOptimaPlainText(): string {
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  lines.push(HR)
  lines.push('OPTIMA · Potential Resource Optimization')
  lines.push('DEEP theory — Tom Gilb, OPTIMA book 2024')
  lines.push(HR)
  lines.push('')
  if (hasViolations.value) {
    lines.push(`⚠ ${violationCount.value} Constraint Violation${violationCount.value !== 1 ? 's' : ''} — at least one entry sits below its Tolerable threshold`)
  } else {
    lines.push('✓ No Constraint violations — every entry MEETS its Tolerable threshold')
  }
  lines.push('')
  lines.push(`VALUES · ${valueEntries.value.length} entries`)
  lines.push(SR)
  for (const e of valueEntries.value) {
    const s = statusBgHex(e)
    lines.push(`${e.id}: ${e.label}`)
    lines.push(`  Current: ${e.current}${e.unit ? ' ' + e.unit : ''}   Tolerable @ ${e.tolerablePos}   Goal @ ${e.goalPos}   Wish @ ${e.wishPos}`)
    lines.push(`  Status:  ${s.name}`)
    lines.push('')
  }
  lines.push(`RESOURCES · ${resourceEntries.value.length} entries`)
  lines.push(SR)
  for (const e of resourceEntries.value) {
    const s = statusBgHex(e)
    lines.push(`${e.id}: ${e.label}`)
    lines.push(`  Current: ${e.current}${e.unit ? ' ' + e.unit : ''}   Tolerable @ ${e.tolerablePos}   Goal @ ${e.goalPos}   Wish @ ${e.wishPos}`)
    lines.push(`  Status:  ${s.name}`)
    lines.push('')
  }
  return lines.join('\n')
}

async function exportOptima(): Promise<void> {
  await exportArtefact({
    htmlText:     _renderOptimaHtml(),
    plainText:    _renderOptimaPlainText(),
    subject:      `OPTIMA · ${new Date().toLocaleDateString('en-AU')}`,
    artefactName: 'OPTIMA',
  })
}
</script>

<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/60 z-[90]"
    aria-hidden="true"
    @click="emit('close')"
  />

  <!-- Panel -->
  <div
    class="fixed inset-4 z-[100] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
    role="dialog"
    aria-modal="true"
    aria-label="OPTIMA — Potential Resource Optimization"
  >
    <!-- ── Header — dark dramatic ───────────────────────────────────────── -->
    <div class="bg-gradient-to-r from-slate-950 via-amber-950 to-orange-950 px-6 py-4 flex items-center gap-4 shrink-0 border-b-2 border-amber-500">
      <OptimaGlyph size="xl" />
      <div class="flex-1 min-w-0">
        <h2 class="text-xl font-extrabold text-amber-300 tracking-tight">OPTIMA</h2>
        <p class="text-[12px] text-amber-200/80 font-medium">Potential Resource Optimization · Balancing Critical Values (Gilb 2024)</p>
        <p class="text-[11px] text-white/60 mt-0.5">
          <span class="text-emerald-300 font-semibold">{{ valueEntries.length }} Values</span>
          <span class="mx-1.5 opacity-50">·</span>
          <span class="text-cyan-300 font-semibold">{{ resourceEntries.length }} Resources</span>
          <span class="mx-1.5 opacity-50">·</span>
          <span class="text-white/50">{{ valueEntries.length + resourceEntries.length }} entries total</span>
          <span class="mx-1.5 opacity-50">·</span>
          <span class="text-amber-200/70 italic">drag resource sliders ↕ — values update live</span>
        </p>
      </div>
      <CloseDot size="lg" @click="emit('close')" variant="on-dark"
        title="Close OPTIMA · Escape key also closes" />
    </div>

    <!-- ── Instructions strip — dark, punchy ────────────────────────────── -->
    <div class="bg-slate-900 border-b border-slate-700 px-6 py-3 shrink-0">
      <div class="flex items-start gap-5 flex-wrap">
        <!-- Mini diagram — dark background version -->
        <svg viewBox="0 0 220 68" width="180" height="55" fill="none"
             class="shrink-0 rounded-lg bg-slate-800 border border-slate-600 p-1"
             aria-label="Optima diagram: dots around threshold lines">
          <line x1="8" y1="12" x2="170" y2="12" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="5 2" />
          <text x="174" y="15" font-size="8" fill="#60a5fa" font-weight="600">Stretch</text>
          <line x1="8" y1="26" x2="170" y2="26" stroke="#fbbf24" stroke-width="2" />
          <text x="174" y="29" font-size="8" fill="#fbbf24" font-weight="600">Goal</text>
          <line x1="8" y1="46" x2="170" y2="46" stroke="#f97316" stroke-width="2.5" />
          <text x="174" y="50" font-size="8" fill="#f97316" font-weight="700">Tolerable</text>
          <circle cx="20" cy="19" r="4" fill="#4ade80" />
          <circle cx="36" cy="16" r="4" fill="#4ade80" />
          <circle cx="52" cy="20" r="4" fill="#4ade80" />
          <circle cx="70" cy="17" r="4" fill="#4ade80" />
          <circle cx="86" cy="21" r="4" fill="#4ade80" />
          <circle cx="100" cy="34" r="4" fill="#fbbf24" />
          <circle cx="118" cy="36" r="4" fill="#fbbf24" />
          <circle cx="136" cy="40" r="7" fill="#facc15" />
          <polygon points="136,48 131,58 141,58" fill="#ef4444" />
          <circle cx="152" cy="54" r="4" fill="#ef4444" />
          <circle cx="166" cy="57" r="4" fill="#ef4444" />
        </svg>
        <div class="text-[11px] leading-relaxed flex-1 min-w-0">
          <div class="flex flex-wrap gap-4 mb-1.5">
            <span><span class="font-black text-amber-400">↕ DRAG</span> <span class="text-white/80">resource sliders — values cascade in real time</span></span>
            <span><span class="font-black text-emerald-400">Green</span> <span class="text-white/70">= at/above Goal</span></span>
            <span><span class="font-black text-amber-400">Orange</span> <span class="text-white/70">= Tolerable risk</span></span>
            <span><span class="font-black text-red-400">Red shake</span> <span class="text-white/70">= Violation</span></span>
          </div>
          <p class="text-[10px] text-slate-400 italic">
            DEEP theory (Gilb): a resource can be <em class="text-amber-300">increased</em> to buy more value while others decrease —
            OPTIMA = the combination that maximises all Goals within all Constraints.
          </p>
        </div>
      </div>
    </div>

    <!-- ── Consequence panel — shows cascading value changes after slider move -->
    <Transition name="slide-down">
      <div v-if="lastConsequences.length > 0"
        class="bg-slate-800 border-b border-slate-600 px-6 py-2.5 flex items-start gap-3 shrink-0">
        <span class="text-amber-300 text-sm shrink-0 mt-0.5">⚡</span>
        <div class="flex-1 min-w-0">
          <span class="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
            Moving "{{ lastMovedResource }}" cascaded:
          </span>
          <div class="flex flex-wrap gap-2 mt-1">
            <span
              v-for="c in lastConsequences"
              :key="c.entryId"
              class="inline-flex items-center gap-1 text-[11px] font-semibold rounded px-2 py-0.5"
              :class="c.direction === 'up'
                ? 'bg-emerald-900/60 text-emerald-300'
                : 'bg-red-900/60 text-red-300'"
            >
              <span>{{ c.direction === 'up' ? '↑' : '↓' }}</span>
              <span class="truncate max-w-[150px]">{{ c.label }}</span>
              <span class="opacity-70">{{ c.oldVal }}→{{ c.newVal }}</span>
            </span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Violation banner ───────────────────────────────────────────────── -->
    <Transition name="slide-down">
      <div v-if="hasViolations"
        class="bg-red-600 text-white px-6 py-2.5 flex items-center gap-3 shrink-0">
        <span class="text-lg animate-bounce">&#9888;&#65039;</span>
        <span class="font-bold text-sm flex-1">
          Tolerable Constraint Violation &#8212; {{ violationCount }} {{ violationCount === 1 ? 'entry' : 'entries' }} below Tolerable threshold
        </span>
        <button
          type="button"
          class="bg-white text-red-700 font-bold text-[12px] px-3 py-1.5 rounded-lg
                 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-white"
          title="Automatically restore violating entries to just above Tolerable and increase relevant resources"
          @click="fixViolations"
        >
          Adjust values to avoid Constraint Violation &#8594;
        </button>
      </div>
    </Transition>

    <!-- ── Scrollable content ─────────────────────────────────────────────── -->
    <ScrollContainer class="flex-1 min-h-0 bg-slate-950 relative">
      <div class="p-6 space-y-8">

        <!-- ── Values (Fundamental + Strategic Attributes) ─────────────────── -->
        <section>
          <div class="flex items-center gap-3 mb-4">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">Fundamental &amp; Strategic Attributes</span>
            <span class="text-[10px] bg-blue-900 text-blue-200 px-2 py-0.5 rounded-full font-semibold">{{ valueEntries.length }} Values</span>
            <span class="text-[10px] text-slate-500 italic">read-only — move resource sliders below to affect these</span>
          </div>

          <div class="space-y-3">
            <div
              v-for="entry in valueEntries"
              :key="entry.id"
              :class="[
                'rounded-xl border-2 px-4 py-3 transition-all duration-150',
                violating.has(entry.id)
                  ? 'border-red-500 bg-red-950 violation-shake'
                  : vibrating.has(entry.id)
                    ? 'border-amber-400 bg-amber-950 vibrate-impact'
                    : entry.current >= entry.goalPos
                      ? 'border-emerald-700 bg-emerald-950'
                      : entry.current >= entry.tolerablePos
                        ? 'border-amber-700 bg-amber-950'
                        : 'border-red-600 bg-red-950'
              ]"
            >
              <!-- Entry header row -->
              <div class="flex items-center gap-2 mb-2">
                <div class="flex-1 min-w-0">
                  <span class="text-[13px] font-semibold text-white truncate block">{{ entry.label }}</span>
                </div>
                <!-- Status badge -->
                <span
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  :style="{ backgroundColor: statusColor(entry) + '22', color: statusColor(entry) }"
                >
                  {{ statusLabel(entry) }}
                </span>
                <!-- Violation alert icon -->
                <span v-if="violating.has(entry.id)"
                  class="text-red-600 text-base font-black shrink-0 animate-pulse"
                  title="Tolerable Constraint Violation — below minimum acceptable threshold">&#9888;</span>
              </div>

              <!-- Threshold-track slider (read-only for values — they respond to resources) -->
              <div class="relative h-10">
                <!-- Colored zone track -->
                <div class="absolute inset-y-3.5 left-0 right-0 h-2.5 rounded-full overflow-hidden">
                  <!-- Red zone: 0 → tolerablePos% of 150 range -->
                  <div class="absolute left-0 top-0 h-full bg-red-200"
                    :style="{ width: `${(entry.tolerablePos/150)*100}%` }" />
                  <!-- Orange zone: tolerablePos → goalPos -->
                  <div class="absolute top-0 h-full bg-amber-200"
                    :style="{ left: `${(entry.tolerablePos/150)*100}%`,
                              width: `${((entry.goalPos - entry.tolerablePos)/150)*100}%` }" />
                  <!-- Green zone: goalPos → wishPos -->
                  <div class="absolute top-0 h-full bg-emerald-200"
                    :style="{ left: `${(entry.goalPos/150)*100}%`,
                              width: `${((entry.wishPos - entry.goalPos)/150)*100}%` }" />
                  <!-- Teal zone: wishPos → 150 (stretch) -->
                  <div class="absolute top-0 h-full bg-teal-200"
                    :style="{ left: `${(entry.wishPos/150)*100}%`,
                              width: `${((150 - entry.wishPos)/150)*100}%` }" />
                </div>
                <!-- Threshold tick marks -->
                <div class="absolute top-2 h-6 w-0.5 rounded bg-amber-600 z-10"
                  :style="{ left: `${(entry.tolerablePos/150)*100}%` }"
                  title="Tolerable threshold" />
                <div class="absolute top-2 h-6 w-0.5 rounded bg-emerald-600 z-10"
                  :style="{ left: `${(entry.goalPos/150)*100}%` }"
                  title="Goal threshold" />
                <!-- Progress bar (current value) — display only, not a slider -->
                <div
                  class="absolute top-3 h-4 rounded-full transition-all duration-300 opacity-70"
                  :style="{
                    width: `${Math.min(100, (entry.current/150)*100)}%`,
                    backgroundColor: statusColor(entry)
                  }" />
                <!-- Current position thumb (visual only) -->
                <div
                  class="absolute top-2.5 w-4 h-5 rounded-md border-2 border-white shadow-md transition-all duration-300 -translate-x-1/2"
                  :style="{
                    left: `${Math.min(99, (entry.current/150)*100)}%`,
                    backgroundColor: statusColor(entry)
                  }" />
              </div>

              <!-- Labels -->
              <div class="flex justify-between text-[9px] text-slate-400 mt-0.5 px-0.5">
                <span>0</span>
                <span class="text-amber-400 font-bold">Tolerable</span>
                <span class="text-emerald-400 font-bold">Goal</span>
                <span class="text-teal-400">Stretch</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Resources (Means Attributes — the sliders) ───────────────────── -->
        <section>
          <div class="flex items-center gap-3 mb-4">
            <ResourceArtsyGlyph size="md" />
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-300">Means Attributes</span>
            <span class="text-[10px] bg-emerald-900 text-emerald-200 px-2 py-0.5 rounded-full font-semibold">{{ resourceEntries.length }} Resources</span>
            <span class="text-[10px] text-amber-400 font-semibold">&#8597; DRAG SLIDERS to explore tradeoffs</span>
          </div>

          <div class="space-y-3">
            <div
              v-for="entry in resourceEntries"
              :key="entry.id"
              class="rounded-xl border-2 border-emerald-700 bg-slate-900 px-4 py-3"
            >
              <!-- Entry header -->
              <div class="flex items-center gap-2 mb-2">
                <div class="flex-1 min-w-0">
                  <span class="text-[13px] font-semibold text-white truncate block">{{ entry.label }}</span>
                </div>
                <span class="text-[11px] font-bold text-white shrink-0">{{ Math.round(entry.current) }}%</span>
                <span
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  :style="{ backgroundColor: statusColor(entry) + '22', color: statusColor(entry) }"
                >
                  {{ statusLabel(entry) }}
                </span>
              </div>

              <!-- Resource SLIDER (user-adjustable) -->
              <div class="relative h-10">
                <!-- Colored zone track -->
                <div class="absolute inset-y-3.5 left-0 right-0 h-2.5 rounded-full overflow-hidden">
                  <div class="absolute left-0 top-0 h-full bg-red-200"
                    :style="{ width: `${(entry.tolerablePos/150)*100}%` }" />
                  <div class="absolute top-0 h-full bg-amber-200"
                    :style="{ left: `${(entry.tolerablePos/150)*100}%`,
                              width: `${((entry.goalPos - entry.tolerablePos)/150)*100}%` }" />
                  <div class="absolute top-0 h-full bg-emerald-200"
                    :style="{ left: `${(entry.goalPos/150)*100}%`,
                              width: `${((entry.wishPos - entry.goalPos)/150)*100}%` }" />
                  <div class="absolute top-0 h-full bg-teal-200"
                    :style="{ left: `${(entry.wishPos/150)*100}%`, width: '100%' }" />
                </div>
                <!-- Threshold ticks -->
                <div class="absolute top-2 h-6 w-0.5 rounded bg-amber-600 z-10"
                  :style="{ left: `${(entry.tolerablePos/150)*100}%` }" />
                <div class="absolute top-2 h-6 w-0.5 rounded bg-emerald-600 z-10"
                  :style="{ left: `${(entry.goalPos/150)*100}%` }" />
                <!-- INTERACTIVE range input -->
                <input
                  type="range"
                  min="0" max="150" step="1"
                  :value="entry.current"
                  :title="`${entry.label} — drag to adjust budget. Current: ${Math.round(entry.current)}% of Goal. Moving this slider recalculates all Value estimates and shows tradeoffs.`"
                  class="absolute inset-0 w-full opacity-[0.001] cursor-pointer z-20"
                  @input="onResourceSlider(entry.id, +($event.target as HTMLInputElement).value)"
                />
                <!-- Visual progress bar -->
                <div
                  class="absolute top-3 h-4 rounded-full transition-all duration-150 opacity-70"
                  :style="{ width: `${Math.min(100,(entry.current/150)*100)}%`, backgroundColor: statusColor(entry) }"
                />
                <!-- Thumb -->
                <div
                  class="absolute top-2.5 w-5 h-5 rounded-full border-2 border-white shadow-lg transition-all duration-150 -translate-x-1/2"
                  :style="{ left: `${Math.min(99,(entry.current/150)*100)}%`, backgroundColor: statusColor(entry) }"
                />
              </div>

              <div class="flex justify-between text-[9px] text-slate-400 mt-0.5 px-0.5">
                <span>0%</span>
                <span class="text-amber-400 font-bold">Tolerable</span>
                <span class="text-emerald-400 font-bold">Goal (100%)</span>
                <span class="text-teal-400">+50% stretch</span>
              </div>

              <!-- DEEP insight: increase a resource to unlock value -->
              <p v-if="entry.current > 110"
                class="mt-2 text-[10px] text-teal-300 bg-teal-950 rounded-lg px-2 py-1 italic">
                &#128161; OPTIMA insight: increasing this resource beyond Goal may unlock higher Value Goals
                (DEEP Planguage theory &#8212; one resource increase can buy multiple value improvements)
              </p>
            </div>
          </div>

          <!-- Empty state if no resources yet -->
          <div v-if="resourceEntries.length === 0"
            class="rounded-xl border-2 border-dashed border-amber-600 bg-amber-950 p-6 text-center">
            <OptimaGlyph size="lg" class="mx-auto mb-3" />
            <p class="text-[12px] text-amber-300 font-semibold">No Resource entries yet</p>
            <p class="text-[11px] text-amber-400/80 mt-1">
              Use the Improve Resources tool (Pin 1) to add R. entries via Claudian,<br>
              then return here to optimize the balance.
            </p>
          </div>
        </section>

      </div>
    </ScrollContainer>

    <!-- ── Rebalancing suggestions strip ────────────────────────────────── -->
    <div class="border-t border-slate-800 bg-slate-900 px-6 py-3 shrink-0">
      <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Rebalancing suggestions</div>
      <div class="flex flex-wrap gap-2">
        <button type="button"
          class="text-[11px] font-semibold bg-emerald-900 text-emerald-300 border border-emerald-700
                 rounded-lg px-3 py-1.5 hover:bg-emerald-800 focus:outline-none focus:ring-2
                 focus:ring-emerald-400 transition-colors"
          title="Find any resource currently below Goal and lift it to the Goal position — values cascade live"
          @click="liftToGoal">
          ↑ Lift lowest resources to Goal
        </button>
        <button type="button"
          class="text-[11px] font-semibold bg-amber-900 text-amber-300 border border-amber-700
                 rounded-lg px-3 py-1.5 hover:bg-amber-800 focus:outline-none focus:ring-2
                 focus:ring-amber-400 transition-colors"
          title="Reduce all resource sliders by 20% — explore whether Values hold at lower cost (DEEP theory: find the minimum resource set that still meets all Goals)"
          @click="reduceAllResources">
          ↓ −20% all resources (test Goals hold)
        </button>
        <button type="button"
          class="text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-600
                 rounded-lg px-3 py-1.5 hover:bg-slate-700 focus:outline-none focus:ring-2
                 focus:ring-slate-400 transition-colors"
          title="Reset all sliders to starting (Goal) positions"
          @click="reset">
          ↺ Reset all to Goal
        </button>
      </div>
      <!-- Action feedback — brief confirmation after any rebalance button -->
      <Transition name="slide-down">
        <p v-if="lastRebalanceAction"
          class="mt-2 text-[11px] font-semibold text-emerald-300">
          {{ lastRebalanceAction }}
        </p>
      </Transition>
    </div>

    <!-- ── Bottom action bar ──────────────────────────────────────────────── -->
    <div class="border-t border-slate-700 bg-slate-950 px-6 py-3 flex items-center gap-3 shrink-0">
      <div class="flex-1" />
      <button v-if="hasViolations" type="button"
        class="text-[12px] font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2
               rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
        @click="fixViolations">
        Fix {{ violationCount }} Constraint Violation{{ violationCount !== 1 ? 's' : '' }} &#8594;
      </button>
      <!-- ⬇ Export · Tom Gilb 2026-06-06 universal Export-on-all-windows rule.
           See useExportShared.ts + rule_export_button_on_all_windows.md. -->
      <button type="button"
        class="text-[12px] font-semibold text-emerald-100 bg-emerald-700 hover:bg-emerald-600 px-4 py-2
               rounded-lg border border-emerald-500
               focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors"
        title="⬇ Export OPTIMA · opens preview window with 100% of the model · clipboard ready · Mail to Tom@Gilb.com with paste cue · includes Glossary footnote"
        @click="exportOptima">
        ⬇ Export · Full Model
      </button>
      <button type="button"
        class="text-[12px] font-semibold text-white bg-slate-700 hover:bg-slate-600 px-4 py-2
               rounded-lg border border-slate-500
               focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors"
        @click="emit('close')">
        Done
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Vibration animation — top-N most impacted values bounce briefly */
@keyframes vibrate-impact {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-3px); }
  40%       { transform: translateX(3px); }
  60%       { transform: translateX(-2px); }
  80%       { transform: translateX(2px); }
}
/* Constraint violation — rapid red shake, continuous until resolved */
@keyframes violation-shake {
  0%, 100% { transform: translateX(0) scale(1.005); }
  15%, 45%, 75% { transform: translateX(-5px) scale(1.01); }
  30%, 60%, 90% { transform: translateX(5px) scale(1.01); }
}
.vibrate-impact {
  animation: vibrate-impact 0.4s ease-in-out 3;
}
.violation-shake {
  animation: violation-shake 0.25s ease-in-out infinite;
}
/* Transition for violation banner slide-in */
.slide-down-enter-active, .slide-down-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
  max-height: 80px;
  overflow: hidden;
}
.slide-down-enter-from, .slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
