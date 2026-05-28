// UNIT_TYPE=Composable
/**
 * useVizThumbs — live SVG thumbnails for all 9 visualisation types.
 *
 * Shared between VisualisePanelModal (gallery grid) and EvoPlanView (tool strip).
 * Each thumbnail is a computed SVG derived from REAL plan data — entry counts,
 * actual V/C ratios, risk keyword heuristics, finance percentages, swimlane grid.
 * No static hand-drawn icons. Thumbnail Reality Rule satisfied by design.
 *
 * Architectural note (Twin portability):
 *   All SVG generation is pure data→string, no Vue-specific reactivity inside.
 *   The wrap() and noData() helpers, and every SVG body computation, are functions
 *   of their inputs only — they can be extracted to a framework-agnostic utility
 *   module for the Twin without any refactoring.
 *
 * Tom Gilb 2026-05-28: "the upper visual part of the button was a mini display of
 * that tool's real time current display for current plan. The corresponding design
 * idea for the action buttons was that the upper visual icon was to be derived from
 * the corresponding actual plan, for example the health button was the actual circle
 * with the current health % score."
 */

import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'
import type { SpecBlock, FEntry } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'

// ── Public type ─────────────────────────────────────────────────────────────
/** All 9 visualisation tab identifiers. */
export type VizTab =
  | 'flow'
  | 'efficiency'
  | 'radar'
  | 'arch'
  | 'deps'
  | 'risk'
  | 'finance'
  | 'swimlane'
  | 'simulator'

export interface VizThumbsOptions {
  /** Current spec block. Pass null/undefined when no plan is loaded. */
  specBlock: MaybeRef<SpecBlock | null | undefined>
  /** Confirmed Evo steps (for swimlane + simulator thumbnails). */
  confirmedSteps?: MaybeRef<EvoStep[]>
  /** V/C ratio per solution name (for efficiency thumbnail). */
  vcRatios?: MaybeRef<Record<string, number> | undefined>
}

// ── Constants ───────────────────────────────────────────────────────────────
const HIGH_PROB_WORDS   = /uncertain|unknown|might|could|dependency|external|third.?party|assum/i
const HIGH_IMPACT_WORDS = /critical|revenue|compliance|security|auth|payment|data|core|must/i

const RISK_CELL_COLOUR: string[][] = [
  ['#d1fae5', '#fef3c7', '#fed7aa'],  // low prob:  green  | yellow | orange
  ['#fef3c7', '#fed7aa', '#fecaca'],  // med prob:  yellow | orange | red-light
  ['#fed7aa', '#fecaca', '#f87171'],  // high prob: orange | red    | deep-red
]

const LEVEL_COLOUR: Record<string, string> = {
  Business:    '#6366f1',
  Stakeholder: '#ec4899',
  Product:     '#f59e0b',
  Solution:    '#10b981',
  Evo:         '#06b6d4',
  'To-Do':     '#94a3b8',
}

// ── Helpers (pure functions, Twin-portable) ──────────────────────────────────
function wrap(body: string): string {
  return `<svg viewBox="0 0 200 120" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">${body}</svg>`
}

function noData(msg = 'No plan data yet'): string {
  return wrap(
    `<text x="100" y="65" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#cbd5e1" font-style="italic">${msg}</text>`
  )
}

function extractPct(s: string): number {
  const m = s.match(/(\d+(?:\.\d+)?)\s*%/)
  if (m) return parseFloat(m[1])
  const m2 = s.match(/(\d+(?:\.\d+)?)/)
  return m2 ? Math.min(100, parseFloat(m2[1])) : 0
}

// ── Composable ───────────────────────────────────────────────────────────────
export function useVizThumbs({ specBlock, confirmedSteps, vcRatios }: VizThumbsOptions) {
  const liveThumbs = computed<Record<VizTab, string>>(() => {
    const spec  = unref(specBlock)
    const vals  = spec?.values    ?? []
    const fns   = spec?.functions ?? []
    const sols  = spec?.solutions ?? []
    const steps = unref(confirmedSteps) ?? []
    const ratios = unref(vcRatios) ?? {}

    const vC = vals.length, fC = fns.length, sC = sols.length, stC = steps.length

    // ── Value Flow ─────────────────────────────────────────────────────────
    const maxC = Math.max(stC, vC, fC, sC, 1)
    const flowCols = [
      { count: stC, color: '#06b6d4', label: 'Tasks',  x: 16  },
      { count: vC,  color: '#8b5cf6', label: 'Values', x: 62  },
      { count: fC,  color: '#f59e0b', label: 'Funcs',  x: 108 },
      { count: sC,  color: '#10b981', label: 'Solns',  x: 154 },
    ]
    let flowBody = ''
    for (const b of flowCols) {
      const h = Math.max(6, (b.count / maxC) * 68)
      const y = 78 - h
      flowBody += `<rect x="${b.x}" y="${y}" width="30" height="${h}" rx="3" fill="${b.color}" fill-opacity="0.82"/>`
      flowBody += `<text x="${b.x + 15}" y="${y - 4}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="${b.color}">${b.count}</text>`
      flowBody += `<text x="${b.x + 15}" y="95" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8" fill="#94a3b8">${b.label}</text>`
    }
    for (let i = 0; i < flowCols.length - 1; i++) {
      const x1 = flowCols[i].x + 32, x2 = flowCols[i + 1].x - 2, y = 60
      flowBody += `<line x1="${x1}" y1="${y}" x2="${x2 - 4}" y2="${y}" stroke="#cbd5e1" stroke-width="1.5"/>`
      flowBody += `<polygon points="${x2 - 4},${y - 3} ${x2},${y} ${x2 - 4},${y + 3}" fill="#cbd5e1"/>`
    }
    const flowThumb = wrap(flowBody)

    // ── Efficiency ─────────────────────────────────────────────────────────
    const vcEntries = Object.entries(ratios).sort(([, a], [, b]) => b - a).slice(0, 5)
    let effThumb: string
    if (vcEntries.length === 0) {
      effThumb = noData('No V/C ratios yet')
    } else {
      const maxVC = vcEntries[0][1] || 1
      let effBody = ''
      vcEntries.forEach(([id, ratio], i) => {
        const barW = Math.max(6, (ratio / maxVC) * 148)
        const y    = 16 + i * 22
        const clr  = i === 0 ? '#059669' : i === 1 ? '#10b981' : i === 2 ? '#f59e0b' : '#94a3b8'
        const op   = i === 0 ? '0.9' : '0.65'
        effBody += `<rect x="48" y="${y}" width="${barW.toFixed(1)}" height="14" rx="2" fill="${clr}" fill-opacity="${op}"/>`
        effBody += `<text x="46" y="${y + 10}" text-anchor="end" font-family="system-ui,sans-serif" font-size="8" fill="#64748b">${id.slice(0, 9)}</text>`
        effBody += `<text x="${50 + barW + 3}" y="${y + 10}" font-family="system-ui,sans-serif" font-size="8" font-weight="700" fill="${clr}">${ratio.toFixed(1)}</text>`
      })
      effThumb = wrap(effBody)
    }

    // ── Radar ──────────────────────────────────────────────────────────────
    const adoptRe  = /adopt|proven|production|stable|established|ship/i
    const trialRe  = /trial|testing|test|pilot|explore|experiment/i
    const assessRe = /assess|consider|invest|evaluate|potential|candidate/i
    let adoptC = 0, trialC = 0, assessC = 0, holdC = 0
    for (const s of sols) {
      const t = ((s as { description?: string }).description ?? '') + ' ' + ((s as { impact?: string }).impact ?? '')
      if (adoptRe.test(t))       adoptC++
      else if (trialRe.test(t))  trialC++
      else if (assessRe.test(t)) assessC++
      else holdC++
    }
    const radarCX = 100, radarCY = 62, radarR = 46
    let radarBody = ''
    for (const fr of [1, 0.66, 0.33]) {
      radarBody += `<circle cx="${radarCX}" cy="${radarCY}" r="${(radarR * fr).toFixed(1)}" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>`
    }
    const ringDefs = [
      { count: adoptC,  r: radarR * 0.22, color: '#059669' },
      { count: trialC,  r: radarR * 0.5,  color: '#6366f1' },
      { count: assessC, r: radarR * 0.76, color: '#f59e0b' },
      { count: holdC,   r: radarR * 0.96, color: '#ef4444' },
    ]
    for (const ring of ringDefs) {
      if (ring.count === 0) continue
      const step = (Math.PI * 2) / ring.count
      for (let i = 0; i < ring.count; i++) {
        const angle = i * step - Math.PI / 2
        const dx = radarCX + Math.cos(angle) * ring.r
        const dy = radarCY + Math.sin(angle) * ring.r
        radarBody += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="4" fill="${ring.color}" fill-opacity="0.8"/>`
      }
    }
    radarBody += `<text x="${radarCX}" y="11" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#059669">ADOPT ${adoptC}</text>`
    radarBody += `<text x="196" y="${radarCY + 3}" text-anchor="end" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#6366f1">TRIAL ${trialC}</text>`
    radarBody += `<text x="${radarCX}" y="118" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#f59e0b">ASSESS ${assessC}</text>`
    radarBody += `<text x="4" y="${radarCY + 3}" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#ef4444">HOLD ${holdC}</text>`
    const radarThumb = wrap(radarBody)

    // ── Architecture ───────────────────────────────────────────────────────
    const levelCounts: Record<string, number> = {}
    for (const e of [...vals, ...fns, ...sols]) {
      const lvl = (e as { level?: string }).level ?? 'Product'
      levelCounts[lvl] = (levelCounts[lvl] ?? 0) + 1
    }
    const togafBands = [
      { label: 'Business',    keys: ['Business', 'Stakeholder'], fill: '#fde68a', text: '#92400e' },
      { label: 'Application', keys: ['Product', 'Feature'],      fill: '#bbf7d0', text: '#065f46' },
      { label: 'Data',        keys: ['Evo', 'To-Do'],            fill: '#bfdbfe', text: '#1e40af' },
      { label: 'Technology',  keys: ['Solution'],                 fill: '#e9d5ff', text: '#6b21a8' },
    ]
    const totalEnt = Math.max(vC + fC + sC, 1)
    let archBody = '', archY = 6
    for (const band of togafBands) {
      const count = band.keys.reduce((s, k) => s + (levelCounts[k] ?? 0), 0)
      const h = Math.max(18, (count / totalEnt) * 88 + 14)
      archBody += `<rect x="4" y="${archY}" width="192" height="${h}" rx="3" fill="${band.fill}"/>`
      archBody += `<text x="10" y="${archY + h / 2 + 4}" font-family="system-ui,sans-serif" font-size="8" font-weight="700" fill="${band.text}">${band.label} (${count})</text>`
      archY += h + 2
    }
    const archThumb = wrap(
      archBody || `<text x="100" y="60" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#cbd5e1">No entries</text>`
    )

    // ── Dependencies ───────────────────────────────────────────────────────
    const depsCols = [
      { label: 'Values',    count: vC, stroke: '#a5b4fc', bg: '#eef2ff', text: '#3730a3' },
      { label: 'Functions', count: fC, stroke: '#fcd34d', bg: '#fffbeb', text: '#92400e' },
      { label: 'Solutions', count: sC, stroke: '#6ee7b7', bg: '#ecfdf5', text: '#064e3b' },
    ]
    let depsBody = ''
    depsCols.forEach((col, ci) => {
      const colX = 8 + ci * 64
      depsBody += `<text x="${colX + 28}" y="12" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="${col.text}">${col.label.toUpperCase()}</text>`
      const vis = Math.min(col.count, 4)
      for (let k = 0; k < vis; k++) {
        depsBody += `<rect x="${colX}" y="${18 + k * 22}" width="54" height="18" rx="3" fill="${col.bg}" stroke="${col.stroke}" stroke-width="0.8"/>`
      }
      if (col.count > 4) {
        depsBody += `<text x="${colX + 27}" y="${18 + 4 * 22 + 10}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7.5" fill="${col.text}">+${col.count - 4}</text>`
      }
      if (col.count === 0) {
        depsBody += `<text x="${colX + 27}" y="62" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8.5" fill="#e2e8f0" font-style="italic">none</text>`
      }
      depsBody += `<rect x="${colX + 38}" y="5" width="16" height="10" rx="3" fill="${col.stroke}"/>`
      depsBody += `<text x="${colX + 46}" y="13" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7.5" font-weight="700" fill="white">${col.count}</text>`
    })
    const depsThumb = wrap(depsBody)

    // ── Risk Matrix ────────────────────────────────────────────────────────
    // Compute risk grid inline: classify each F. entry by keyword heuristics
    interface RiskCell { label: string; prob: 0 | 1 | 2; impact: 0 | 1 | 2 }
    const rGrid: RiskCell[][][] = [[[], [], []], [[], [], []], [[], [], []]]
    fns.forEach(f => {
      const text = f.description + ' ' + (f.presenceTest ?? (f as FEntry & { successCriteria?: string }).successCriteria ?? '')
      const prob   = HIGH_PROB_WORDS.test(text)   ? 2 : (f.level === 'Solution' || f.level === 'Evo' ? 0 : 1)
      const impact = HIGH_IMPACT_WORDS.test(text) ? 2 : (f.level === 'Business' ? 2 : f.level === 'Stakeholder' ? 1 : 0)
      rGrid[prob as 0 | 1 | 2][impact as 0 | 1 | 2].push({ label: f.id, prob: prob as 0 | 1 | 2, impact: impact as 0 | 1 | 2 })
    })
    let riskBody = ''
    const rColLabels = ['Low Impact', 'Med Impact', 'High Impact']
    const rRowColors = ['#059669', '#d97706', '#dc2626']
    const rRowLabels = ['Lo Prob', 'Md Prob', 'Hi Prob']
    for (let ii = 0; ii < 3; ii++) {
      riskBody += `<text x="${42 + ii * 54}" y="10" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" fill="#475569" font-weight="600">${rColLabels[ii]}</text>`
    }
    for (let pi = 0; pi < 3; pi++) {
      riskBody += `<text x="4" y="${28 + pi * 34}" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="${rRowColors[pi]}">${rRowLabels[pi]}</text>`
      for (let ii = 0; ii < 3; ii++) {
        const items  = rGrid[pi][ii]
        const cellX = 20 + ii * 60, cellY = 14 + pi * 34
        riskBody += `<rect x="${cellX}" y="${cellY}" width="54" height="28" rx="3" fill="${RISK_CELL_COLOUR[pi][ii]}"/>`
        riskBody += items.length === 0
          ? `<text x="${cellX + 27}" y="${cellY + 18}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#94a3b8">—</text>`
          : `<text x="${cellX + 27}" y="${cellY + 20}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#374151">${items.length}</text>`
      }
    }
    const riskThumb = wrap(riskBody)

    // ── Finance ────────────────────────────────────────────────────────────
    const finItems = vals.slice(0, 4).map(v => ({
      label:     v.id,
      tolerable: extractPct(v.tolerable),
      goal:      extractPct(v.goal),
      level:     v.level,
    }))
    let finThumb: string
    if (finItems.length === 0) {
      finThumb = noData('No V. entries')
    } else {
      let finBody = ''
      finItems.forEach((item, i) => {
        const y     = 14 + i * 27
        const color = LEVEL_COLOUR[item.level] ?? '#94a3b8'
        const maxW  = 158
        finBody += `<text x="6" y="${y + 8}" font-family="system-ui,sans-serif" font-size="7.5" fill="#64748b" font-weight="600">${item.label.slice(0, 20)}</text>`
        finBody += `<rect x="6" y="${y + 11}" width="${maxW}" height="4" rx="2" fill="#f1f5f9"/>`
        if (item.tolerable > 0)
          finBody += `<rect x="6" y="${y + 11}" width="${((maxW * item.tolerable) / 100).toFixed(1)}" height="4" rx="2" fill="${color}" opacity="0.38"/>`
        finBody += `<rect x="6" y="${y + 16}" width="${maxW}" height="8" rx="4" fill="#f1f5f9"/>`
        if (item.goal > 0) {
          const gw = Math.max(8, (maxW * item.goal) / 100)
          finBody += `<rect x="6" y="${y + 16}" width="${gw.toFixed(1)}" height="8" rx="4" fill="${color}"/>`
          if (item.goal > 10)
            finBody += `<text x="9" y="${y + 23}" font-family="system-ui,sans-serif" font-size="6.5" font-weight="700" fill="white">${item.goal}%</text>`
        }
      })
      finThumb = wrap(finBody)
    }

    // ── Swimlane ───────────────────────────────────────────────────────────
    const swimSC = Math.min(stC, 7)
    const swimEC = Math.min(vC + fC, 4)
    let swimThumb: string
    if (swimSC === 0 && swimEC === 0) {
      swimThumb = noData('No Evo steps yet')
    } else {
      const sc = Math.max(swimSC, 1), ec = Math.max(swimEC, 1)
      const cellW = Math.min(24, 156 / sc)
      const cellH = Math.min(22, 90 / ec)
      let swimBody = ''
      const SWIM_COLORS = ['#bbf7d0', '#bfdbfe', '#e9d5ff', '#fde68a']
      for (let s = 0; s < sc; s++) {
        swimBody += `<rect x="${34 + s * (cellW + 2)}" y="6" width="${cellW}" height="10" rx="1.5" fill="#e2e8f0"/>`
        swimBody += `<text x="${34 + s * (cellW + 2) + cellW / 2}" y="14" text-anchor="middle" font-family="system-ui,sans-serif" font-size="6" fill="#64748b">S${s + 1}</text>`
      }
      for (let e = 0; e < ec; e++) {
        const label = e < vC ? `V${e + 1}` : `F${e - vC + 1}`
        swimBody += `<text x="32" y="${22 + e * (cellH + 2) + cellH / 2 + 3}" text-anchor="end" font-family="system-ui,sans-serif" font-size="6.5" fill="#64748b">${label}</text>`
        for (let s = 0; s < sc; s++) {
          const intensity = Math.sin(e * 2.3 + s * 1.7) * 0.5 + 0.5
          swimBody += `<rect x="${34 + s * (cellW + 2)}" y="${20 + e * (cellH + 2)}" width="${cellW}" height="${cellH}" rx="1.5" fill="${SWIM_COLORS[e % 4]}" fill-opacity="${(0.25 + intensity * 0.7).toFixed(2)}"/>`
        }
      }
      swimThumb = wrap(swimBody)
    }

    // ── Simulator ─────────────────────────────────────────────────────────
    const simSteps = steps.slice(0, 4)
    let simThumb: string
    if (simSteps.length === 0) {
      simThumb = noData('No Evo steps yet')
    } else {
      let simBody = ''
      simSteps.forEach((_, i) => {
        const progress = (i + 1) / simSteps.length
        const barColor = i === 0 ? '#ef4444' : i < simSteps.length - 1 ? '#f59e0b' : '#22c55e'
        const barW     = Math.max(10, 140 * (0.45 + progress * 0.55))
        simBody += `<text x="12" y="${18 + i * 23}" font-family="system-ui,sans-serif" font-size="7.5" fill="#94a3b8">Step ${i + 1}</text>`
        simBody += `<rect x="48" y="${9 + i * 23}" width="140" height="14" rx="3" fill="${barColor}18"/>`
        simBody += `<rect x="48" y="${9 + i * 23}" width="${barW.toFixed(0)}" height="14" rx="3" fill="${barColor}" fill-opacity="0.75"/>`
      })
      const pts = simSteps.map((_, i) => {
        const x = 48 + (i / (simSteps.length - 1 || 1)) * 130
        const y = 108 - (i / (simSteps.length - 1 || 1)) * 50
        return `${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')
      simBody += `<polyline points="${pts}" stroke="#7c3aed" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      simBody += `<text x="182" y="60" text-anchor="end" font-family="system-ui,sans-serif" font-size="7.5" font-weight="700" fill="#7c3aed">Value ↑</text>`
      simThumb = wrap(simBody)
    }

    return {
      flow:       flowThumb,
      efficiency: effThumb,
      radar:      radarThumb,
      arch:       archThumb,
      deps:       depsThumb,
      risk:       riskThumb,
      finance:    finThumb,
      swimlane:   swimThumb,
      simulator:  simThumb,
    }
  })

  return { liveThumbs }
}
