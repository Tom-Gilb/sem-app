<!-- UNIT_TYPE=Widget -->
<!-- Feature #46 — "Evo Value Step Components" — spec components per delivery step.

     Tom 2026-05-16: "The headline can include an explanation, and a new title:
     Evo Value Step Components: Purpose - to inform about specific spec components
     at each Evo Step. Each step is composed of Tasks, Evo Step (Parts of 1 or more
     solutions), Multiple Values impacts (main ones top 3 is good), Main Stakeholders
     (top 3), Main Functions Involved (top 3). Each spec type in a cluster (a spec
     type cluster board, within an Evo Step Board). Nice colors please. They should
     be sequences in Value flow (Tasks, (for evo step completion work process),
     Step (a Solutions set), Values, Functions, Stakeholders). Some great icons
     for all concepts. Stakeholder icon: person paragraph."

     Previous design (rows = lanes, columns = evo steps) replaced with:
       — Horizontal scroll of Evo Step Boards (one card per step)
       — Each board contains vertically-stacked spec-type Clusters:
           ⚡ Tasks → 🔩 Solutions → 📈 Values → ⚙️ Functions → 👤¶ Stakeholders
       — Suggested tasks (effortHours & assignee null) shown with ◌ badge + dashed border
       — Step header: indigo/violet gradient, step name, description, effort%
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import type { TaskSuggestion } from '../types/task'
import { extractAllStakeholders } from '../utils/stakeholderExtract'

const props = defineProps<{
  spec:           SpecBlock | null
  confirmedSteps: EvoStep[]
  /** Task lists keyed by step name — used to populate the Tasks cluster.
   *  Tom 2026-05-16: "suggested tasks should still be put on the diagram." */
  tasksByStep?:   Record<string, TaskSuggestion[]>
  onClose:        () => void
  /** When true, renders inline inside a parent container (no fixed positioning,
   *  no CloseDot). Used by VisualisePanelModal's Swimlane tab. */
  embedded?:      boolean
}>()

// ── Cluster style definitions (in value-flow sequence order) ─────────────────
// icon, label, bg, border, hdr, badge, text, accent
// Canonical spec-type colours — agreed 2026-05-16, Kai swap ratified same day.
// Source of truth: src/constants/specTypeColors.ts
// Value=Violet · Function=Green · Solution=Orange · Evo Step=Amber · Task=Slate · Stakeholder=Blue
const CLUSTER_DEFS = [
  { key: 'tasks',        icon: '⚡',   label: 'Tasks',        bg: '#f9fafb', border: '#d1d5db', hdr: '#374151', badge: '#374151', text: '#111827', accent: '#6b7280' },
  { key: 'solutions',    icon: '🔩',   label: 'Solutions',    bg: '#fff7ed', border: '#fdba74', hdr: '#ea580c', badge: '#ea580c', text: '#9a3412', accent: '#fb923c' },
  { key: 'values',       icon: '📈',   label: 'Values',       bg: '#f5f3ff', border: '#c4b5fd', hdr: '#7c3aed', badge: '#7c3aed', text: '#5b21b6', accent: '#a78bfa' },
  { key: 'functions',    icon: '⚙️',  label: 'Functions',    bg: '#f0fdf4', border: '#86efac', hdr: '#16a34a', badge: '#16a34a', text: '#166534', accent: '#4ade80' },
  { key: 'stakeholders', icon: '👤¶', label: 'Stakeholders', bg: '#eff6ff', border: '#93c5fd', hdr: '#2563eb', badge: '#2563eb', text: '#1e40af', accent: '#60a5fa' },
] as const

// ── Global stakeholders from full spec text (top 3) ───────────────────────────
const allStakeholders = computed(() => {
  if (!props.spec) return []
  const text = [
    ...props.spec.functions.map(f => `${f.description} ${f.presenceTest ?? f.successCriteria ?? ''} ${f.functionOfValue}`),
    ...props.spec.values.map(v => `${v.description} ${v.scale} ${v.valueOfFunction}`),
    ...props.spec.solutions.map(s => `${s.description} ${s.impact} ${s.function}`),
  ].join(' ')
  return extractAllStakeholders(text).slice(0, 3)
})

// ── Per-step board data ───────────────────────────────────────────────────────
interface TaskItem {
  id:          string
  description: string
  effortHours: number | null
  assignee:    string | null
  suggested:   boolean  // effortHours & assignee null → AI-suggested, not yet planned
}

interface StepBoard {
  name:          string
  description:   string
  effortPercent: number
  tasks:         TaskItem[]
  solutions:     { id: string; description: string }[]
  values:        { id: string; description: string }[]
  functions:     { id: string; description: string }[]
  stakeholders:  { name: string; colour: string }[]
}

/** Extract all F.xxx IDs from a text string */
function parseFnIds(text: string | null | undefined): string[] {
  return [...new Set((text ?? '').split(/[,;]+/).map(s => s.trim()).filter(Boolean))]
}

function truncate(text: string | null | undefined, max = 60): string {
  if (!text) return ''
  return text.length <= max ? text : text.slice(0, max) + '…'
}

const stepBoards = computed<StepBoard[]>(() => {
  if (!props.spec || !props.confirmedSteps.length) return []

  const solMap = new Map(props.spec.solutions.map(s => [s.id, s]))
  const valMap = new Map(props.spec.values.map(v => [v.id, v]))
  const fnMap  = new Map(props.spec.functions.map(f => [f.id, f]))
  const globalShs = allStakeholders.value

  return props.confirmedSteps.map(step => {
    // Tasks — from tasksByStep prop
    const rawTasks = props.tasksByStep?.[step.name] ?? []
    const tasks: TaskItem[] = rawTasks.map(t => ({
      id:          t.id,
      description: t.description,
      effortHours: t.effortHours,
      assignee:    t.assignee,
      suggested:   t.effortHours === null && t.assignee === null,
    }))

    // Solutions linked to this step
    const solutions = (step.linkedSolutions ?? [])
      .map(sid => solMap.get(sid))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map(s => ({ id: s.id, description: s.description }))

    // Values linked to this step (top 3)
    const values = step.linkedValues
      .slice(0, 3)
      .map(vid => valMap.get(vid))
      .filter((v): v is NonNullable<typeof v> => !!v)
      .map(v => ({ id: v.id, description: v.description }))

    // Functions inferred via linked values' valueOfFunction links (top 3)
    const fnIds = new Set<string>()
    step.linkedValues.forEach(vid => {
      const v = valMap.get(vid)
      if (v) parseFnIds(v.valueOfFunction).forEach(id => fnIds.add(id))
    })
    const functions = [...fnIds]
      .slice(0, 3)
      .map(fid => fnMap.get(fid))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .map(f => ({ id: f.id, description: f.description }))

    return {
      name:          step.name,
      description:   step.description,
      effortPercent: step.effortPercent,
      tasks,
      solutions,
      values,
      functions,
      stakeholders: globalShs.map(s => ({ name: s.name, colour: s.colour })),
    }
  })
})

// ── Copy as HTML table ────────────────────────────────────────────────────────
const copied = ref(false)
let _copyTimer = 0

async function copyTable(): Promise<void> {
  const boards = stepBoards.value
  if (!boards.length) return

  const TH = (s: string) =>
    `<th style="padding:8px 14px;border:1px solid #cbd5e1;background:#f1f5f9;font-weight:600;text-align:left;white-space:normal">${s}</th>`
  const TD = (s: string, bg = '#ffffff') =>
    `<td style="padding:8px 14px;border:1px solid #cbd5e1;vertical-align:top;white-space:normal;background:${bg}">${s}</td>`

  const header = ['Component', ...boards.map(b => truncate(b.name, 40))]

  type RowDef = { label: string; bg: string; items: (b: StepBoard) => string[] }
  const rows: RowDef[] = [
    { label: '⚡ Tasks',        bg: '#f8fafc', items: b => b.tasks.map(t => (t.suggested ? '◌ ' : '✓ ') + truncate(t.description, 50)) },
    { label: '🔩 Solutions',    bg: '#f5f3ff', items: b => b.solutions.map(s => s.id + ' — ' + truncate(s.description, 40)) },
    { label: '📈 Values',       bg: '#ecfdf5', items: b => b.values.map(v => v.id + ' — ' + truncate(v.description, 40)) },
    { label: '⚙️ Functions',   bg: '#eff6ff', items: b => b.functions.map(f => f.id + ' — ' + truncate(f.description, 40)) },
    { label: '👤 Stakeholders', bg: '#fffbeb', items: b => b.stakeholders.map(s => s.name) },
  ]

  const headerHtml = header.map(TH).join('')
  const bodyHtml   = rows.map(({ label, bg, items }) =>
    `<tr>${TD(label, bg)}${boards.map(b => { const its = items(b); return TD(its.length ? its.join('<br>') : '—') }).join('')}</tr>`
  ).join('')
  const html = `<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
  const tsv  = [header, ...rows.map(({ label, items }) => [label, ...boards.map(b => items(b).join(' | ') || '—')])].map(r => r.join('\t')).join('\n')

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html':  new Blob([html], { type: 'text/html'  }),
        'text/plain': new Blob([tsv],  { type: 'text/plain' }),
      }),
    ])
  } catch {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    div.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;z-index:-1'
    div.innerHTML = html
    document.body.appendChild(div)
    const sel = window.getSelection()!; const range = document.createRange()
    range.selectNodeContents(div); sel.removeAllRanges(); sel.addRange(range)
    try { document.execCommand('copy') } catch { /* ok */ }
    sel.removeAllRanges(); document.body.removeChild(div)
  }

  copied.value = true
  clearTimeout(_copyTimer)
  _copyTimer = window.setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div
    :class="embedded
      ? 'flex flex-col h-full bg-white'
      : 'fixed inset-0 z-[500] bg-white flex flex-col overflow-hidden'"
    :role="embedded ? undefined : 'dialog'"
    :aria-modal="embedded ? undefined : 'true'"
    aria-label="Evo Value Step Components"
  >
    <!-- ── Header ────────────────────────────────────────────────────────────── -->
    <div class="shrink-0 flex items-start justify-between bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
      <div class="flex items-start gap-3 min-w-0">
        <span class="text-xl mt-0.5 shrink-0" aria-hidden="true">🗺️</span>
        <div class="min-w-0">
          <h2 class="text-sm font-bold text-slate-800 leading-tight">Evo Value Step Components</h2>
          <p class="text-[10px] text-slate-400 mt-0.5 leading-snug">
            Purpose — inform about specific spec components at each Evo Step &nbsp;·&nbsp;
            Sequence: <span class="font-semibold text-slate-500">Tasks → Solutions → Values → Functions → Stakeholders</span>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0 ml-3 mt-0.5">
        <button
          type="button"
          :aria-label="copied ? 'Copied!' : 'Copy as table'"
          class="h-7 px-2.5 text-[10px] font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-slate-400 transition-colors whitespace-nowrap"
          @click="copyTable"
        >{{ copied ? '✅ Copied' : '📋 Copy' }}</button>
        <CloseDot
          v-if="!embedded"
          aria-label="Close Evo Value Step Components"
          @click="props.onClose()"
        />
      </div>
    </div>

    <!-- ── Legend / flow sequence bar ────────────────────────────────────────── -->
    <div class="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-slate-50 border-b border-slate-100 overflow-x-auto">
      <template v-for="(c, i) in CLUSTER_DEFS" :key="c.key">
        <span
          class="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-semibold border"
          :style="{ backgroundColor: c.bg, borderColor: c.border, color: c.hdr }"
        >
          <span aria-hidden="true">{{ c.icon }}</span>
          {{ c.label }}
        </span>
        <span v-if="i < CLUSTER_DEFS.length - 1" class="text-slate-300 text-[10px] font-bold shrink-0">→</span>
      </template>
    </div>

    <!-- ── Step boards (horizontal scroll) ───────────────────────────────────── -->
    <ScrollContainer outer-class="flex-1 min-h-0" inner-class="flex gap-3 p-3 h-full">

      <!-- Empty state -->
      <div v-if="!stepBoards.length" class="flex items-center justify-center w-full py-16">
        <div class="text-center text-slate-400">
          <p class="text-4xl mb-3" aria-hidden="true">🗺️</p>
          <p class="font-semibold text-slate-500 text-sm mb-1">No Evo Steps yet</p>
          <p class="text-xs">Generate and confirm a plan to see the step breakdown here.</p>
        </div>
      </div>

      <!-- One board per Evo Step -->
      <div
        v-for="board in stepBoards"
        :key="board.name"
        class="flex-shrink-0 w-[252px] flex flex-col rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white"
      >
        <!-- Step header: gradient + name + effort% + description -->
        <div class="shrink-0 bg-gradient-to-br from-indigo-600 to-violet-600 px-3 pt-3 pb-2.5">
          <div class="flex items-start gap-1.5">
            <p class="text-[10px] font-mono font-bold text-white leading-tight truncate flex-1 min-w-0">
              {{ board.name }}
            </p>
            <span class="shrink-0 text-[9px] font-bold bg-white/25 text-white rounded-full px-1.5 py-0.5 leading-tight">
              {{ board.effortPercent }}%
            </span>
          </div>
          <p class="text-[9px] text-white/70 leading-snug mt-1.5 line-clamp-3">{{ board.description }}</p>
        </div>

        <!-- Clusters (vertically stacked, scrollable) -->
        <ScrollContainer outer-class="flex-1 min-h-0" inner-class="p-2 space-y-2">

          <!-- ⚡ Tasks cluster ──────────────────────────────────── -->
          <div class="rounded-xl border overflow-hidden" style="border-color: #cbd5e1; background: #f8fafc">
            <div class="flex items-center gap-1 px-2 py-1.5 border-b" style="border-color: #cbd5e1">
              <span class="text-[11px]" aria-hidden="true">⚡</span>
              <span class="text-[9px] font-bold flex-1" style="color: #475569">Tasks</span>
              <span
                v-if="board.tasks.length"
                class="text-[8px] rounded-full px-1.5 py-0.5 font-semibold"
                style="background: #94a3b820; color: #64748b"
              >{{ board.tasks.length }}</span>
            </div>
            <div class="p-1.5 space-y-1">
              <p v-if="!board.tasks.length" class="text-[9px] italic px-1" style="color: #94a3b8">No tasks yet</p>
              <div
                v-for="task in board.tasks"
                :key="task.id"
                class="rounded-lg px-2 py-1.5 text-[9px] leading-snug"
                :class="task.suggested ? 'border border-dashed' : 'border'"
                style="border-color: #cbd5e1; color: #334155"
              >
                <span
                  v-if="task.suggested"
                  class="inline-block text-[7.5px] font-bold rounded px-1 py-0.5 mr-1 mb-0.5 leading-tight"
                  style="background: #94a3b825; color: #64748b; border: 1px dashed #cbd5e1"
                >◌ suggested</span>
                {{ truncate(task.description, 55) }}
                <span
                  v-if="task.effortHours"
                  class="block text-[8px] mt-0.5"
                  style="color: #94a3b8"
                >{{ task.effortHours }}h{{ task.assignee ? ' · ' + task.assignee : '' }}</span>
              </div>
            </div>
          </div>

          <!-- 🔩 Solutions cluster ─────────────────────────────── -->
          <div class="rounded-xl border overflow-hidden" style="border-color: #c4b5fd; background: #f5f3ff">
            <div class="flex items-center gap-1 px-2 py-1.5 border-b" style="border-color: #c4b5fd">
              <span class="text-[11px]" aria-hidden="true">🔩</span>
              <span class="text-[9px] font-bold flex-1" style="color: #6d28d9">Solutions</span>
              <span
                v-if="board.solutions.length"
                class="text-[8px] rounded-full px-1.5 py-0.5 font-semibold"
                style="background: #a78bfa20; color: #7c3aed"
              >{{ board.solutions.length }}</span>
            </div>
            <div class="p-1.5 space-y-1">
              <p v-if="!board.solutions.length" class="text-[9px] italic px-1" style="color: #a78bfa">—</p>
              <div
                v-for="sol in board.solutions"
                :key="sol.id"
                class="rounded-lg border px-2 py-1.5"
                style="border-color: #c4b5fd"
              >
                <p class="text-[9px] font-mono font-bold leading-tight" style="color: #6d28d9">{{ sol.id }}</p>
                <p class="text-[9px] leading-snug mt-0.5" style="color: #4c1d95">{{ truncate(sol.description, 52) }}</p>
              </div>
            </div>
          </div>

          <!-- 📈 Values cluster ────────────────────────────────── -->
          <div class="rounded-xl border overflow-hidden" style="border-color: #6ee7b7; background: #ecfdf5">
            <div class="flex items-center gap-1 px-2 py-1.5 border-b" style="border-color: #6ee7b7">
              <span class="text-[11px]" aria-hidden="true">📈</span>
              <span class="text-[9px] font-bold flex-1" style="color: #059669">Values</span>
              <span class="text-[8px]" style="color: #34d399">top 3</span>
              <span
                v-if="board.values.length"
                class="text-[8px] rounded-full px-1.5 py-0.5 font-semibold ml-1"
                style="background: #34d39920; color: #059669"
              >{{ board.values.length }}</span>
            </div>
            <div class="p-1.5 space-y-1">
              <p v-if="!board.values.length" class="text-[9px] italic px-1" style="color: #34d399">—</p>
              <div
                v-for="val in board.values"
                :key="val.id"
                class="rounded-lg border px-2 py-1.5"
                style="border-color: #6ee7b7"
              >
                <p class="text-[9px] font-mono font-bold leading-tight" style="color: #059669">{{ val.id }}</p>
                <p class="text-[9px] leading-snug mt-0.5" style="color: #065f46">{{ truncate(val.description, 52) }}</p>
              </div>
            </div>
          </div>

          <!-- ⚙️ Functions cluster ─────────────────────────────── -->
          <div class="rounded-xl border overflow-hidden" style="border-color: #93c5fd; background: #eff6ff">
            <div class="flex items-center gap-1 px-2 py-1.5 border-b" style="border-color: #93c5fd">
              <span class="text-[11px]" aria-hidden="true">⚙️</span>
              <span class="text-[9px] font-bold flex-1" style="color: #1d4ed8">Functions</span>
              <span class="text-[8px]" style="color: #60a5fa">top 3</span>
              <span
                v-if="board.functions.length"
                class="text-[8px] rounded-full px-1.5 py-0.5 font-semibold ml-1"
                style="background: #60a5fa20; color: #2563eb"
              >{{ board.functions.length }}</span>
            </div>
            <div class="p-1.5 space-y-1">
              <p v-if="!board.functions.length" class="text-[9px] italic px-1" style="color: #60a5fa">—</p>
              <div
                v-for="fn in board.functions"
                :key="fn.id"
                class="rounded-lg border px-2 py-1.5"
                style="border-color: #93c5fd"
              >
                <p class="text-[9px] font-mono font-bold leading-tight" style="color: #1d4ed8">{{ fn.id }}</p>
                <p class="text-[9px] leading-snug mt-0.5" style="color: #1e40af">{{ truncate(fn.description, 52) }}</p>
              </div>
            </div>
          </div>

          <!-- 👤¶ Stakeholders cluster ──────────────────────────── -->
          <div class="rounded-xl border overflow-hidden" style="border-color: #fcd34d; background: #fffbeb">
            <div class="flex items-center gap-1 px-2 py-1.5 border-b" style="border-color: #fcd34d">
              <span class="text-[11px]" aria-hidden="true">👤¶</span>
              <span class="text-[9px] font-bold flex-1" style="color: #b45309">Stakeholders</span>
              <span class="text-[8px]" style="color: #f59e0b">top 3</span>
            </div>
            <div class="p-1.5 flex flex-wrap gap-1">
              <p v-if="!board.stakeholders.length" class="text-[9px] italic px-1 w-full" style="color: #f59e0b">—</p>
              <span
                v-for="sh in board.stakeholders"
                :key="sh.name"
                class="inline-flex items-center gap-1 text-[9px] font-semibold rounded-full px-2 py-1 border"
                :style="{ borderColor: sh.colour + '70', backgroundColor: sh.colour + '18', color: sh.colour }"
              >
                <span aria-hidden="true">👤</span>
                {{ sh.name }}
              </span>
            </div>
          </div>

        </ScrollContainer><!-- end inner clusters scroll -->
      </div><!-- end step board -->

    </ScrollContainer>
  </div>
</template>
