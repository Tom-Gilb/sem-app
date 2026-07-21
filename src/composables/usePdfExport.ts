// UNIT_TYPE=Hook
// usePdfExport — export spec to PDF (Feature #14)

import jsPDF from 'jspdf'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'

/**
 * Composable for exporting a SpecBlock (and optional Evo steps) to a PDF file.
 *
 * Creates an A4 portrait document with 20mm margins, structured sections for
 * Functions, Values, Solutions, and an optional Evo Plan section.
 */
export function usePdfExport() {
  function exportToPdf(spec: SpecBlock, steps?: EvoStep[]): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const margin = 20
    const pageWidth = 210
    const contentWidth = pageWidth - margin * 2
    let y = margin

    // ── Helper: add text with auto page break ──────────────────────────────
    function addText(
      text: string,
      x: number,
      fontSize: number,
      color: [number, number, number] = [0, 0, 0],
      bold = false,
    ): void {
      doc.setFontSize(fontSize)
      doc.setTextColor(...color)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      const lines = doc.splitTextToSize(text, contentWidth) as string[]
      for (const line of lines) {
        if (y > 277) {
          doc.addPage()
          y = margin
        }
        doc.text(line, x, y)
        y += fontSize * 0.4 + 1
      }
    }

    function addSpacing(mm: number): void {
      y += mm
    }

    function addDivider(): void {
      if (y > 277) { doc.addPage(); y = margin }
      doc.setDrawColor(180, 180, 180)
      doc.line(margin, y, margin + contentWidth, y)
      addSpacing(4)
    }

    // ── Title ──────────────────────────────────────────────────────────────
    addText('Planguage Specification', margin, 18, [30, 30, 30], true)
    addSpacing(2)

    const today = new Date().toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    addText(`Generated: ${today}`, margin, 10, [120, 120, 120])
    addSpacing(4)
    addDivider()

    // ── Functions ─────────────────────────────────────────────────────────
    addText('Functions', margin, 14, [30, 80, 160], true)
    addSpacing(3)

    for (const f of spec.functions) {
      addText(f.id, margin, 10, [30, 30, 30], true)
      addSpacing(1)
      addText(f.description, margin + 4, 8)
      if (f.presenceTest || f.successCriteria) {
        addSpacing(1)
        addText(`Presence Test: ${f.presenceTest || f.successCriteria}`, margin + 4, 8, [80, 80, 80])
      }
      addSpacing(4)
    }

    addDivider()

    // ── Values ────────────────────────────────────────────────────────────
    addText('Values', margin, 14, [30, 130, 80], true)
    addSpacing(3)

    for (const v of spec.values) {
      addText(v.id, margin, 10, [30, 30, 30], true)
      addSpacing(1)
      if (v.description) addText(v.description, margin + 4, 8)
      addSpacing(1)
      addText(`Scale: ${v.scale}`, margin + 4, 8, [60, 60, 60])
      addText(`Meter: ${v.meter}`, margin + 4, 8, [60, 60, 60])
      addText(`Status: ${v.status}  |  Tolerable: ${v.tolerable}  |  Goal: ${v.goal}`, margin + 4, 8, [60, 60, 60])
      addSpacing(4)
    }

    addDivider()

    // ── Solutions ─────────────────────────────────────────────────────────
    addText('Solutions', margin, 14, [100, 50, 160], true)
    addSpacing(3)

    for (const s of spec.solutions) {
      addText(s.id, margin, 10, [30, 30, 30], true)
      addSpacing(1)
      addText(s.description, margin + 4, 8)
      if (s.impact) {
        addSpacing(1)
        addText(`Impact: ${s.impact}`, margin + 4, 8, [80, 80, 80])
      }
      addSpacing(4)
    }

    // ── Evo Plan (optional) ───────────────────────────────────────────────
    if (steps && steps.length > 0) {
      addDivider()
      addText('Evo Plan', margin, 14, [160, 80, 30], true)
      addSpacing(3)

      for (const step of steps) {
        addText(`${step.name}  (effort: ${step.effortPercent}%)`, margin, 10, [30, 30, 30], true)
        addSpacing(1)
        addText(step.description, margin + 4, 8)
        addSpacing(4)
      }
    }

    doc.save(`planguage-spec-${Date.now()}.pdf`)
  }

  return { exportToPdf }
}
