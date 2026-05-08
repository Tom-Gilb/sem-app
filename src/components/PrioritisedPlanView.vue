<!-- UNIT_TYPE=Widget -->
<!--
/**
 * Renders the full Prioritised Plan export in a clean, white-background layout.
 *
 * Sections:
 *  1. Original Input — the raw Stakes / Ends / Means the user entered
 *  2. Generated Spec — F. / V. / S. cards (mirrors SpecOutput card style)
 *  3. Impact Matrix — HTML table with V/C ratios, ranked solutions highlighted
 *  4. Evo Plan — ordered steps with linked values, effort, and tasks
 *  5. Actions — Start Over button + download as Markdown
 *
 * Spec: S.Evo9.PrioritisedPlanExport
 */
-->
<script setup lang="ts">
// UNIT_TYPE=Widget
import { computed, onMounted } from 'vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import type { ImpactMatrix } from '../types/impact'

// ── Props + Emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  spec: SpecBlock
  originalInput: { stakes: string; ends: string; means: string } | null
  evoSteps: EvoStep[]
  tasksByStep: Record<string, TaskSuggestion[]>
  impactMatrix: ImpactMatrix
  vcRatios: Record<string, number>
  calendarCosts: Record<string, number>
  capitalCosts: Record<string, number>
  planName?: string
  planVersion?: string
  planSavedAt?: string   // ISO timestamp from PlanModel.updatedAt
}>()

const emit = defineEmits<{
  'start-over': []
}>()

// ── Identity stamp — model name + version + date/time ────────────────────────
// Shown in the prominent color bar at the top of the view and in the HTML export.

const identityTitle = computed<string>(() =>
  props.planName ?? 'Prioritised Plan'
)

const identityStamp = computed<string>(() => {
  const ts = props.planSavedAt ?? new Date().toISOString()
  const d  = new Date(ts)
  const date = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const hh   = d.getHours().toString().padStart(2, '0')
  const mm   = d.getMinutes().toString().padStart(2, '0')
  return `${date}  ${hh}:${mm}`
})

// ── Ranked solutions (descending V/C) ────────────────────────────────────────

const rankedSolutions = computed<string[]>(() =>
  [...props.spec.solutions.map((s) => s.id)].sort((a, b) => {
    const ra = props.vcRatios[a] ?? 0
    const rb = props.vcRatios[b] ?? 0
    return rb - ra
  }),
)

/** Format V/C ratio for display */
function formatVC(solutionId: string): string {
  const ratio = props.vcRatios[solutionId]
  if (ratio === undefined || ratio === null) return '–'
  return Number.isFinite(ratio) ? ratio.toFixed(2) : '∞'
}

/** Rank badge position (1-based) for a solution */
function rankOf(solutionId: string): number {
  return rankedSolutions.value.indexOf(solutionId) + 1
}

/** Total impact sum for a solution (sum of all V×S cells) */
function totalImpact(solutionId: string): number {
  return props.spec.values.reduce((sum, v) => {
    return sum + ((props.impactMatrix[v.id]?.[solutionId]) ?? 0)
  }, 0)
}

// ── Download as HTML (Mac Notes / Pages / Word compatible) ───────────────────
//
// Generates a self-contained HTML document with inline styles — no external CSS.
// Workflow for Mac Notes:
//   Option A  Open the file in Safari → Share (toolbar) → Notes → Save
//   Option B  Open in any browser → ⌘A → ⌘C → paste into a Notes note
//
// The impact matrix uses the same 5-tier colour spec as the IET live table.

function cellBg(v: number): string {
  if (v <= -50) return 'background:#7f1d1d;color:#ffffff'
  if (v < 0)    return 'background:#fecaca;color:#7f1d1d'
  if (v === 0)  return 'background:#f9fafb;color:#9ca3af'
  if (v < 70)   return 'background:#d6d3d1;color:#292524'
  return 'background:#bbf7d0;color:#14532d;font-weight:700'
}

function buildHTMLExport(): string {
  const solIds = props.spec.solutions.map((s) => s.id)

  // ── shared style tokens ──────────────────────────────────────────────────
  const FONT  = 'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif'
  const CARD  = `${FONT};border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:20px`
  const HDR   = (bg: string) => `background:${bg};color:#ffffff;padding:10px 16px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase`
  const BODY  = 'padding:14px 16px'
  const LABEL = 'font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em'
  const VAL   = 'font-size:14px;color:#111827;margin:2px 0 10px'
  const TH    = 'background:#1f2937;color:#fff;padding:8px 12px;font-size:12px;text-align:left;white-space:nowrap'
  const THC   = 'background:#1f2937;color:#fff;padding:8px 12px;font-size:12px;text-align:center;white-space:nowrap'
  const TD    = 'padding:7px 12px;font-size:13px;border:1px solid #e5e7eb;text-align:center'
  const TDL   = 'padding:7px 12px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;white-space:nowrap'

  const displayTitle = identityTitle.value
  const vBadge = props.planVersion
    ? `<span style="display:inline-block;background:rgba(255,255,255,0.18);border-radius:999px;padding:2px 12px;font-size:12px;font-weight:700;color:#fff;letter-spacing:.04em;margin-right:10px">v${props.planVersion}</span>`
    : ''
  let body = `<div style="background:linear-gradient(135deg,#312e81 0%,#4338ca 60%,#6d28d9 100%);border-radius:14px;padding:22px 28px 20px;margin-bottom:28px">
  <p style="${FONT};font-size:10px;font-weight:700;color:#a5b4fc;letter-spacing:.12em;text-transform:uppercase;margin:0 0 6px">Plan</p>
  <h1 style="${FONT};font-size:24px;font-weight:800;color:#ffffff;margin:0 0 12px;line-height:1.2">${displayTitle}</h1>
  <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">${vBadge}<span style="${FONT};font-size:13px;color:#c7d2fe">${identityStamp.value}</span></div>
</div>`

  // ── 1. Original input ────────────────────────────────────────────────────
  if (props.originalInput) {
    body += `<div style="${CARD}">`
    body += `<div style="${HDR('#374151')}">Original Input</div>`
    body += `<div style="${BODY}">`
    for (const [label, text] of [
      ['Stakes', props.originalInput.stakes],
      ['Ends',   props.originalInput.ends],
      ['Means',  props.originalInput.means],
    ] as [string, string][]) {
      body += `<p style="${LABEL}">${label}</p><p style="${VAL}">${text}</p>`
    }
    body += `</div></div>`
  }

  // ── 2. F. entries ────────────────────────────────────────────────────────
  for (const f of props.spec.functions) {
    body += `<div style="${CARD}">`
    body += `<div style="${HDR('#2563eb')}">F. ${f.id}</div>`
    body += `<div style="${BODY}"><p style="font-size:14px;color:#111827;margin:0 0 8px">${f.description}</p>`
    if (f.successCriteria) body += `<p style="font-size:12px;color:#6b7280;border-left:3px solid #bfdbfe;padding-left:10px;margin:0"><strong>Success:</strong> ${f.successCriteria}</p>`
    body += `</div></div>`
  }

  // ── 3. V. entries ────────────────────────────────────────────────────────
  for (const v of props.spec.values) {
    body += `<div style="${CARD}">`
    body += `<div style="${HDR('#16a34a')}">V. ${v.id}</div>`
    body += `<div style="${BODY}"><p style="font-size:14px;color:#111827;margin:0 0 10px">${v.description}</p>`
    body += `<table style="border-collapse:collapse;width:100%;font-size:12px">`
    for (const [k, val] of [['Scale', v.scale], ['Meter', v.meter], ['Status', v.status], ['Tolerable', v.tolerable], ['Goal', v.goal]] as [string,string][]) {
      if (val) body += `<tr><td style="padding:3px 8px;color:#6b7280;font-weight:600;white-space:nowrap;width:80px">${k}</td><td style="padding:3px 8px;color:#374151">${val}</td></tr>`
    }
    body += `</table></div></div>`
  }

  // ── 4. S. entries ────────────────────────────────────────────────────────
  for (const s of props.spec.solutions) {
    body += `<div style="${CARD}">`
    body += `<div style="${HDR('#7c3aed')}">S. ${s.id}</div>`
    body += `<div style="${BODY}"><p style="font-size:14px;color:#111827;margin:0 0 6px">${s.description}</p>`
    if (s.impact) body += `<p style="font-size:12px;color:#6b7280;margin:0"><strong>Impact:</strong> ${s.impact}</p>`
    body += `</div></div>`
  }

  // ── 5. Impact matrix ─────────────────────────────────────────────────────
  if (solIds.length && props.spec.values.length) {
    body += `<div style="${CARD}">`
    body += `<div style="${HDR('#374151')}">Impact Matrix &amp; Means Efficiency</div>`
    body += `<div style="overflow-x:auto;padding:0"><table style="border-collapse:collapse;${FONT};font-size:13px;width:100%">`

    // Header row
    body += `<thead><tr><th style="${TH}">Value / Solution</th>`
    for (const sid of solIds) body += `<th style="${THC}">${sid}<br><span style="font-size:10px;font-weight:400;color:#9ca3af">#${rankOf(sid)}</span></th>`
    body += `</tr></thead><tbody>`

    // Data rows
    for (const v of props.spec.values) {
      body += `<tr><th style="${TDL}">${v.id}</th>`
      for (const sid of solIds) {
        const vv = props.impactMatrix[v.id]?.[sid] ?? 0
        body += `<td style="${TD};${cellBg(vv)}">${vv}%</td>`
      }
      body += `</tr>`
    }

    body += `</tbody><tfoot>`

    // Calendar
    body += `<tr><th style="${TDL};color:#1d4ed8">⏱ Calendar (wks)</th>`
    for (const sid of solIds) body += `<td style="${TD};background:#eff6ff;color:#1e40af">${props.calendarCosts[sid] ?? 0}</td>`
    body += `</tr>`

    // Capital
    body += `<tr><th style="${TDL};color:#7c3aed">💰 Capital ($k)</th>`
    for (const sid of solIds) body += `<td style="${TD};background:#f5f3ff;color:#6d28d9">${props.capitalCosts[sid] ?? 0}</td>`
    body += `</tr>`

    // Total impact
    body += `<tr><th style="${TDL}">Σ Impact</th>`
    for (const sid of solIds) body += `<td style="${TD};background:#f9fafb;font-weight:600">${totalImpact(sid)}</td>`
    body += `</tr>`

    // Means Efficiency
    body += `<tr style="border-top:2px solid #6b7280"><th style="${TDL};font-weight:700">Means Efficiency</th>`
    for (const sid of solIds) {
      const top = rankOf(sid) === 1
      body += `<td style="${TD};font-weight:700;background:${top ? '#f0fdf4' : '#f9fafb'};color:${top ? '#15803d' : '#111827'}">`
      body += `${formatVC(sid)}<br><span style="font-size:10px;color:${top ? '#16a34a' : '#9ca3af'}">#${rankOf(sid)}</span></td>`
    }
    body += `</tr></tfoot></table></div></div>`
  }

  // ── 6. Evo plan ──────────────────────────────────────────────────────────
  if (props.evoSteps.length) {
    body += `<div style="${CARD}">`
    body += `<div style="${HDR('#374151')}">Evo Plan</div>`
    body += `<div style="${BODY}">`
    for (const [idx, step] of props.evoSteps.entries()) {
      body += `<div style="display:flex;gap:12px;margin-bottom:16px">`
      body += `<div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:#4f46e5;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center">${idx + 1}</div>`
      body += `<div>`
      body += `<div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:2px">${step.name}</div>`
      body += `<div style="font-size:13px;color:#374151;margin-bottom:6px">${step.description}</div>`
      body += `<div style="font-size:11px;color:#6b7280">Linked values: ${step.linkedValues.join(', ')} &nbsp;·&nbsp; Effort: ${step.effortPercent}%</div>`
      const tasks = props.tasksByStep[step.name] ?? []
      if (tasks.length) {
        body += `<ul style="margin:8px 0 0;padding-left:18px">`
        for (const t of tasks) {
          body += `<li style="font-size:12px;color:${t.completed ? '#9ca3af' : '#374151'};${t.completed ? 'text-decoration:line-through' : ''};margin-bottom:2px">`
          body += `${t.description}${t.effortHours !== null ? ` <span style="color:#9ca3af">(${t.effortHours}h)</span>` : ''}</li>`
        }
        body += `</ul>`
      }
      body += `</div></div>`
    }
    body += `</div></div>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${displayTitle}</title>
<style>*{box-sizing:border-box}body{margin:0;padding:32px 24px;background:#f9fafb;max-width:860px;margin-inline:auto}</style>
</head>
<body>${body}</body>
</html>`
}

function downloadHTML(): void {
  const html = buildHTMLExport()
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const now  = new Date()
  const date = now.toISOString().slice(0, 10)
  const hh   = now.getHours().toString().padStart(2, '0')
  const mm   = now.getMinutes().toString().padStart(2, '0')
  const safeName = (props.planName ?? 'prioritised-plan')
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
  const vSuffix = props.planVersion ? `-v${props.planVersion}` : ''
  a.href     = url
  a.download = `${safeName}${vSuffix}-${date}-${hh}${mm}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Auto-download as soon as the export view mounts — the user clicked
// "Export Prioritised Plan" so the intent is clear; no extra click needed.
onMounted(() => downloadHTML())
</script>

<template>
  <div class="w-full max-w-3xl space-y-8 pb-16">

    <!-- ── Model identity banner ── -->
    <div
      class="w-full rounded-2xl overflow-hidden shadow-lg"
      style="background: linear-gradient(135deg, #312e81 0%, #4338ca 60%, #6d28d9 100%)"
      aria-label="Plan identity"
    >
      <div class="px-7 py-5">
        <p class="text-[10px] font-bold text-indigo-300 uppercase tracking-[.14em] mb-1.5">Plan</p>
        <h1 class="text-2xl font-extrabold text-white leading-tight mb-3">{{ identityTitle }}</h1>
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-if="planVersion"
            class="inline-flex items-center rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold text-white tracking-wide"
          >
            v{{ planVersion }}
          </span>
          <span class="text-sm text-indigo-200">{{ identityStamp }}</span>
        </div>
      </div>
    </div>

    <!-- ── 1. Original Input ── -->
    <section
      v-if="originalInput"
      class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      aria-label="Original input"
    >
      <div class="bg-gray-800 px-5 py-3">
        <h2 class="text-sm font-semibold text-white tracking-wide uppercase">Original Input</h2>
      </div>
      <div class="divide-y divide-gray-100">
        <div class="px-5 py-4 grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3">
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">Stakes</span>
          <p class="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{{ originalInput.stakes }}</p>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">Ends</span>
          <p class="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{{ originalInput.ends }}</p>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">Means</span>
          <p class="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{{ originalInput.means }}</p>
        </div>
      </div>
    </section>

    <!-- ── 2. Spec cards ── -->
    <section class="space-y-4" aria-label="Planguage spec">
      <h2 class="text-base font-semibold text-gray-800 px-1">Spec</h2>

      <!-- F. entries — blue -->
      <div
        v-for="f in spec.functions"
        :key="f.id"
        class="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden"
      >
        <div class="bg-blue-600 px-4 py-2.5 flex items-center gap-2">
          <span class="text-xs font-bold text-blue-100 bg-blue-700 rounded px-1.5 py-0.5">F.</span>
          <span class="text-sm font-semibold text-white truncate">{{ f.id }}</span>
          <span class="ml-auto text-xs text-blue-200">{{ f.level }}</span>
        </div>
        <div class="px-4 py-3 space-y-2">
          <p class="text-sm text-gray-800">{{ f.description }}</p>
          <p v-if="f.successCriteria" class="text-xs text-gray-500 border-l-2 border-blue-200 pl-3">
            <span class="font-semibold">Success:</span> {{ f.successCriteria }}
          </p>
        </div>
      </div>

      <!-- V. entries — green -->
      <div
        v-for="v in spec.values"
        :key="v.id"
        class="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden"
      >
        <div class="bg-green-600 px-4 py-2.5 flex items-center gap-2">
          <span class="text-xs font-bold text-green-100 bg-green-700 rounded px-1.5 py-0.5">V.</span>
          <span class="text-sm font-semibold text-white truncate">{{ v.id }}</span>
          <span class="ml-auto text-xs text-green-200">{{ v.level }}</span>
        </div>
        <div class="px-4 py-3 space-y-2">
          <p class="text-sm text-gray-800">{{ v.description }}</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
            <div><span class="font-semibold text-gray-700">Scale: </span>{{ v.scale }}</div>
            <div><span class="font-semibold text-gray-700">Meter: </span>{{ v.meter }}</div>
          </div>
          <div class="flex flex-wrap gap-2 pt-1">
            <span
              v-if="v.status"
              class="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs text-amber-700"
            >
              <span class="font-semibold">Now</span> {{ v.status.replace(/^Status\s*/i, '') }}
            </span>
            <span
              v-if="v.tolerable"
              class="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs text-blue-700"
            >
              <span class="font-semibold">Min</span> {{ v.tolerable.replace(/^Tolerable\s*/i, '') }}
            </span>
            <span
              v-if="v.goal"
              class="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs text-green-700"
            >
              <span class="font-semibold">Goal</span> {{ v.goal.replace(/^Goal\s*/i, '') }}
            </span>
          </div>
        </div>
      </div>

      <!-- S. entries — purple -->
      <div
        v-for="s in spec.solutions"
        :key="s.id"
        class="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden"
      >
        <div class="bg-purple-600 px-4 py-2.5 flex items-center gap-2">
          <span class="text-xs font-bold text-purple-100 bg-purple-700 rounded px-1.5 py-0.5">S.</span>
          <span class="text-sm font-semibold text-white truncate">{{ s.id }}</span>
          <span class="ml-auto text-xs text-purple-200">{{ s.level }}</span>
        </div>
        <div class="px-4 py-3 space-y-2">
          <p class="text-sm text-gray-800">{{ s.description }}</p>
          <p v-if="s.impact" class="text-xs text-gray-500">
            <span class="font-semibold">Impact:</span> {{ s.impact }}
          </p>
        </div>
      </div>
    </section>

    <!-- ── 3. Impact Matrix ── -->
    <section
      v-if="spec.values.length && spec.solutions.length"
      class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      aria-label="Impact estimation matrix"
    >
      <div class="bg-gray-800 px-5 py-3">
        <h2 class="text-sm font-semibold text-white tracking-wide uppercase">Impact Matrix &amp; V/C Ratios</h2>
      </div>

      <!-- Ranked summary chips — top solutions -->
      <div class="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-100">
        <div
          v-for="(solutionId, idx) in rankedSolutions"
          :key="solutionId"
          class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          :class="idx === 0
            ? 'bg-green-100 text-green-800 border border-green-200'
            : idx === 1
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'"
        >
          <span
            class="flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold"
            :class="idx === 0 ? 'bg-green-500' : idx === 1 ? 'bg-blue-500' : 'bg-gray-400'"
          >#{{ idx + 1 }}</span>
          {{ solutionId }}
          <span class="font-normal opacity-75">V/C {{ formatVC(solutionId) }}</span>
        </div>
      </div>

      <!-- Scrollable table -->
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm border-collapse" aria-label="Impact matrix">
          <thead>
            <tr>
              <th
                class="sticky left-0 bg-gray-50 border-b border-r border-gray-200 px-4 py-2.5 text-left text-xs font-semibold text-gray-600 min-w-[140px]"
              >
                Value / Solution
              </th>
              <th
                v-for="sol in spec.solutions"
                :key="sol.id"
                class="border-b border-gray-200 px-3 py-2.5 text-center text-xs font-semibold text-gray-600 min-w-[90px] whitespace-nowrap"
                :class="rankOf(sol.id) === 1 ? 'bg-green-50' : rankOf(sol.id) === 2 ? 'bg-blue-50' : 'bg-gray-50'"
              >
                <div>{{ sol.id }}</div>
                <div
                  class="text-[10px] font-normal mt-0.5"
                  :class="rankOf(sol.id) === 1 ? 'text-green-600' : 'text-gray-400'"
                >
                  #{{ rankOf(sol.id) }}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(val, rowIdx) in spec.values"
              :key="val.id"
              :class="rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'"
            >
              <td
                class="sticky left-0 bg-inherit border-r border-gray-100 px-4 py-2.5 text-xs font-medium text-gray-800 whitespace-nowrap"
              >
                {{ val.id }}
              </td>
              <td
                v-for="sol in spec.solutions"
                :key="sol.id"
                class="px-3 py-2.5 text-center text-sm font-medium"
                :class="[
                  rankOf(sol.id) === 1 ? 'text-green-700' : 'text-gray-700',
                  (impactMatrix[val.id]?.[sol.id] ?? 0) >= 70
                    ? 'font-semibold'
                    : ''
                ]"
              >
                {{ impactMatrix[val.id]?.[sol.id] ?? 0 }}%
              </td>
            </tr>
          </tbody>
          <tfoot>
            <!-- Total impact row -->
            <tr class="border-t border-gray-200 bg-gray-50">
              <td class="sticky left-0 bg-gray-50 border-r border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600">
                Total Impact
              </td>
              <td
                v-for="sol in spec.solutions"
                :key="sol.id"
                class="px-3 py-2.5 text-center text-sm font-semibold"
                :class="rankOf(sol.id) === 1 ? 'text-green-700' : 'text-gray-700'"
              >
                {{ totalImpact(sol.id) }}
              </td>
            </tr>
            <!-- Calendar / capital cost row -->
            <tr
              v-if="Object.keys(calendarCosts).length || Object.keys(capitalCosts).length"
              class="border-t border-gray-100 bg-gray-50"
            >
              <td class="sticky left-0 bg-gray-50 border-r border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600">
                Costs (time / $k)
              </td>
              <td
                v-for="sol in spec.solutions"
                :key="sol.id"
                class="px-3 py-2.5 text-center text-xs text-gray-600"
              >
                {{ calendarCosts[sol.id] ?? 0 }}w / ${{ capitalCosts[sol.id] ?? 0 }}k
              </td>
            </tr>
            <!-- Means Efficiency row -->
            <tr class="border-t-2 border-gray-300 bg-white">
              <td class="sticky left-0 bg-white border-r border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-800">
                Means Efficiency
              </td>
              <td
                v-for="sol in spec.solutions"
                :key="sol.id"
                class="px-3 py-2.5 text-center"
              >
                <div
                  class="text-sm font-bold"
                  :class="rankOf(sol.id) === 1 ? 'text-green-700' : 'text-gray-800'"
                >
                  {{ formatVC(sol.id) }}
                </div>
                <div
                  class="text-xs mt-0.5"
                  :class="rankOf(sol.id) === 1 ? 'text-green-500 font-semibold' : 'text-gray-400'"
                >
                  #{{ rankOf(sol.id) }}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <!-- ── 4. Evo Plan with tasks ── -->
    <section
      v-if="evoSteps.length"
      class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      aria-label="Evo plan"
    >
      <div class="bg-gray-800 px-5 py-3">
        <h2 class="text-sm font-semibold text-white tracking-wide uppercase">Evo Plan</h2>
      </div>
      <ol class="divide-y divide-gray-100 list-none m-0 p-0">
        <li
          v-for="(step, idx) in evoSteps"
          :key="step.name"
          class="px-5 py-4"
        >
          <!-- Step header -->
          <div class="flex items-start gap-3">
            <!-- Step number badge -->
            <span
              class="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold mt-0.5"
            >
              {{ idx + 1 }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-gray-900">{{ step.name }}</div>
              <p class="text-sm text-gray-600 mt-0.5 leading-relaxed">{{ step.description }}</p>

              <!-- Linked values + effort -->
              <div class="flex flex-wrap items-center gap-2 mt-2">
                <span
                  v-for="vid in step.linkedValues"
                  :key="vid"
                  class="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700 font-medium"
                >
                  {{ vid }}
                </span>
                <span class="text-xs text-gray-400">·</span>
                <span class="text-xs text-gray-500 font-medium">
                  {{ step.effortPercent }}% effort
                </span>
              </div>

              <!-- Tasks -->
              <ul
                v-if="(tasksByStep[step.name] ?? []).length"
                class="mt-3 space-y-1 list-none m-0 p-0"
              >
                <li
                  v-for="task in tasksByStep[step.name]"
                  :key="task.id"
                  class="flex items-start gap-2"
                >
                  <!-- Checkbox indicator (read-only display) -->
                  <span
                    class="mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center"
                    :class="task.completed
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 bg-white'"
                    aria-hidden="true"
                  >
                    <svg
                      v-if="task.completed"
                      class="w-2.5 h-2.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span
                    class="text-xs leading-relaxed"
                    :class="task.completed ? 'line-through text-gray-400' : 'text-gray-700'"
                  >
                    {{ task.description }}
                    <span
                      v-if="task.effortHours !== null"
                      class="ml-1 text-gray-400"
                    >({{ task.effortHours }}h)</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </li>
      </ol>
    </section>

    <!-- ── 5. Actions ── -->
    <div class="flex flex-col sm:flex-row gap-3 px-1">
      <button
        type="button"
        class="flex-1 flex items-center justify-center min-h-[44px] rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-150"
        aria-label="Download HTML"
        title="Open in Safari → Share → Notes, or select-all → ⌘C → paste into a Notes note"
        @click="downloadHTML"
      >
        📄 Download HTML (Notes / Pages)
      </button>
      <button
        type="button"
        class="flex-1 flex items-center justify-center min-h-[44px] rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-150"
        aria-label="Start Over"
        @click="emit('start-over')"
      >
        Start Over
      </button>
    </div>

  </div>
</template>
