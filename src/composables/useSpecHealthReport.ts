// UNIT_TYPE=Composable
// Feature #79 — Spec Health Report PDF export
import { ref } from 'vue'
import type { Ref } from 'vue'
import jsPDF from 'jspdf'
import type { SpecBlock, VEntry } from '../types/spec'

// ── Domain keyword detection ──────────────────────────────────────────────────
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  Engineering: ['latency', 'throughput', 'uptime', 'api', 'pipeline', 'code', 'deploy', 'build', 'test', 'component'],
  Product: ['user', 'feature', 'onboarding', 'retention', 'conversion', 'journey', 'flow', 'ux', 'ui'],
  Personal: ['habit', 'health', 'sleep', 'exercise', 'goal', 'personal', 'daily', 'routine'],
  Business: ['revenue', 'cost', 'profit', 'customer', 'sales', 'market', 'roi', 'growth'],
  Research: ['hypothesis', 'experiment', 'data', 'analysis', 'study', 'findings', 'evidence'],
}

function detectDomainFromSpec(spec: SpecBlock): string {
  const text = [
    ...spec.functions.map(f => `${f.description} ${f.id}`),
    ...spec.values.map(v => `${v.description} ${v.scale} ${v.id}`),
    ...spec.solutions.map(s => `${s.description} ${s.id}`),
  ].join(' ').toLowerCase()

  let best = 'General'
  let bestCount = 0
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const count = keywords.filter(k => text.includes(k)).length
    if (count > bestCount) {
      bestCount = count
      best = domain
    }
  }
  return best
}

// ── Quality score ─────────────────────────────────────────────────────────────
// Count filled V. fields: scale, meter, status, tolerable, goal, description, valueOfFunction
const V_FIELDS: (keyof VEntry)[] = ['scale', 'meter', 'status', 'tolerable', 'goal', 'description', 'valueOfFunction']

function computeQuality(spec: SpecBlock): { score: number; grade: string } {
  if (spec.values.length === 0) return { score: 0, grade: 'F' }
  let filled = 0
  const max = spec.values.length * V_FIELDS.length
  for (const v of spec.values) {
    for (const field of V_FIELDS) {
      if (String(v[field] ?? '').trim().length > 0) filled++
    }
  }
  const score = Math.round((filled / max) * 100)
  let grade = 'F'
  if (score >= 90) grade = 'A'
  else if (score >= 75) grade = 'B'
  else if (score >= 60) grade = 'C'
  else if (score >= 45) grade = 'D'
  return { score, grade }
}

// ── Readability ───────────────────────────────────────────────────────────────
function computeReadability(spec: SpecBlock): { grade: string; avgWords: number } {
  const descriptions = [
    ...spec.functions.map(f => f.description),
    ...spec.values.map(v => v.description),
    ...spec.solutions.map(s => s.description),
  ].filter(d => d.trim().length > 0)

  if (descriptions.length === 0) return { grade: 'F', avgWords: 0 }

  const avgWords = Math.round(
    descriptions.reduce((sum, d) => sum + d.split(/\s+/).filter(Boolean).length, 0) / descriptions.length,
  )

  // ≤10 = A, ≤15 = B, ≤20 = C, ≤30 = D, >30 = F
  let grade = 'F'
  if (avgWords <= 10) grade = 'A'
  else if (avgWords <= 15) grade = 'B'
  else if (avgWords <= 20) grade = 'C'
  else if (avgWords <= 30) grade = 'D'
  return { grade, avgWords }
}

// ── Compliance (same 8-rule logic as useComplianceHeatmap) ────────────────────
const COMPLIANCE_CHECKS: Array<(v: VEntry) => boolean> = [
  v => !!v.scale?.trim(),
  v => !!v.meter?.trim(),
  v => !!v.goal?.trim(),
  v => !!v.tolerable?.trim(),
  v => !!v.status?.trim(),
  v => !!v.description?.trim(),
  v => /(%|hrs|ms|\/|usd|\$|pts|score|rate|count|num)/i.test(v.scale ?? ''),
  v => /^[A-Za-z0-9._-]+$/.test(v.id ?? ''),
]

function computeCompliance(spec: SpecBlock): { passing: number; total: number } {
  if (spec.values.length === 0) return { passing: 0, total: 8 }
  let passing = 0
  for (const check of COMPLIANCE_CHECKS) {
    const allPass = spec.values.every(v => check(v))
    if (allPass) passing++
  }
  return { passing, total: 8 }
}

// ── Composable ────────────────────────────────────────────────────────────────
export function useSpecHealthReport(spec: Ref<SpecBlock | null>) {
  const healthPdfOpen = ref(false)

  function exportHealthPDF(): void {
    if (!spec.value) return

    const s = spec.value
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
    const pageWidth = 210
    const margin = 20
    const contentWidth = pageWidth - margin * 2

    // ── Header ──────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.setTextColor(15, 23, 42) // slate-900
    doc.text('Spec Health Report', margin, 28)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139) // slate-500
    doc.text(today, margin, 36)

    // ── Section 1 — Overview ─────────────────────────────────────────────────
    const domain = detectDomainFromSpec(s)
    const { score, grade } = computeQuality(s)
    const totalEntries = s.functions.length + s.values.length + s.solutions.length

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(30, 41, 59) // slate-800
    doc.text('1. Overview', margin, 48)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85) // slate-700
    doc.text(`Domain: ${domain}`, margin, 56)
    doc.text(`Quality Score: ${score}/100  Grade: ${grade}`, margin, 63)
    doc.text(`Total Entries: ${totalEntries}  (F: ${s.functions.length}, V: ${s.values.length}, S: ${s.solutions.length})`, margin, 70)

    // ── Section 2 — Readability ──────────────────────────────────────────────
    const { grade: readGrade, avgWords } = computeReadability(s)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(30, 41, 59)
    doc.text('2. Readability', margin, 88)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    doc.text(`Readability Grade: ${readGrade}`, margin, 96)
    doc.text(`Avg description length: ${avgWords} words`, margin, 103)

    // ── Section 3 — Compliance ───────────────────────────────────────────────
    const { passing, total } = computeCompliance(s)
    const proportion = passing / total

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(30, 41, 59)
    doc.text('3. Compliance', margin, 118)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    doc.text(`Compliance: ${passing}/${total} rules passing for all V. entries`, margin, 126)

    // Bar background
    doc.setFillColor(226, 232, 240) // slate-200
    doc.rect(margin, 130, contentWidth, 5, 'F')
    // Bar fill
    doc.setFillColor(99, 102, 241) // indigo-500
    doc.rect(margin, 130, contentWidth * proportion, 5, 'F')

    // ── Section 4 — RICE Top 3 ───────────────────────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(30, 41, 59)
    doc.text('4. Top 3 Value Entries by Estimated Impact', margin, 148)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)

    const top3 = s.values.slice(0, 3)
    if (top3.length === 0) {
      doc.text('No V. entries found.', margin, 156)
    } else {
      top3.forEach((v, i) => {
        const scaleSnippet = v.scale?.slice(0, 40) || 'No scale defined'
        doc.text(`${i + 1}. ${v.id}  —  ${scaleSnippet}  (RICE ~400)`, margin, 156 + i * 8)
      })
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.setDrawColor(148, 163, 184) // slate-400
    doc.line(margin, 275, pageWidth - margin, 275)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text('Generated by SEM App', margin, 280)

    doc.save('spec-health-report.pdf')
  }

  return { healthPdfOpen, exportHealthPDF }
}
