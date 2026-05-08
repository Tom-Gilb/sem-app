// UNIT_TYPE=Composable
// Feature #94 — Spec "Contract Mode"
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

interface ContractClause {
  id: string
  obligation: string
  metric: string
  threshold: string
  signOff: string
  signedDate: string
}

export function useSpecContract(spec: Ref<SpecBlock | null>) {
  const contractOpen = ref(false)
  const clauses = ref<ContractClause[]>([])
  const contractTitle = ref('Value Delivery Contract')

  function generateClauses(): void {
    if (!spec.value) {
      clauses.value = []
      return
    }
    clauses.value = spec.value.values.map((v): ContractClause => {
      const descSnippet = v.description
        ? v.description.slice(0, 80)
        : 'a measurable outcome'
      return {
        id: v.id,
        obligation: `The system shall deliver: ${descSnippet}`,
        metric: v.scale || 'To be defined',
        threshold: v.goal || 'To be defined',
        signOff: '',
        signedDate: '',
      }
    })
  }

  function updateSignOff(id: string, name: string, date: string): void {
    const clause = clauses.value.find(c => c.id === id)
    if (clause) {
      clause.signOff = name
      clause.signedDate = date
    }
  }

  function copyContract(): void {
    const lines: string[] = [`# ${contractTitle.value}`, '']
    clauses.value.forEach((clause, i) => {
      lines.push(`## Clause ${i + 1}: ${clause.id}`, '')
      lines.push(`**Obligation:** ${clause.obligation}`)
      lines.push(`**Metric:** ${clause.metric}`)
      lines.push(`**Threshold:** ${clause.threshold}`)
      const signLine = clause.signOff
        ? `${clause.signOff} — ${clause.signedDate || 'Pending'}`
        : 'Pending'
      lines.push(`**Sign-off:** ${signLine}`)
      lines.push('')
    })
    const text = lines.join('\n')
    try {
      navigator.clipboard.writeText(text)
    } catch { /* no-op */ }
  }

  async function exportContractPDF(): Promise<void> {
    const jsPDF = (await import('jspdf')).default
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const today = new Date().toISOString().slice(0, 10)
    const pageWidth = 210
    const margin = 14
    const maxLineWidth = pageWidth - margin * 2
    let y = 20

    // Title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(contractTitle.value, margin, y)
    y += 8

    // Date
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(today, margin, y)
    y += 10

    for (let i = 0; i < clauses.value.length; i++) {
      const clause = clauses.value[i]

      // Page overflow guard
      if (y > 260) {
        doc.addPage()
        y = 20
      }

      // Clause header
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`Clause ${i + 1} — ${clause.id}`, margin, y)
      y += 6

      // Fields
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const fields = [
        `Obligation: ${clause.obligation}`,
        `Metric: ${clause.metric}`,
        `Threshold: ${clause.threshold}`,
      ]
      for (const field of fields) {
        const lines = doc.splitTextToSize(field, maxLineWidth)
        for (const line of lines) {
          if (y > 270) { doc.addPage(); y = 20 }
          doc.text(line, margin, y)
          y += 5
        }
      }

      // Signature line
      if (y > 265) { doc.addPage(); y = 20 }
      doc.text('Signed by: _____________________  Date: _______________', margin, y)
      y += 10
    }

    doc.save('spec-contract.pdf')
  }

  return {
    contractOpen,
    clauses,
    contractTitle,
    generateClauses,
    updateSignOff,
    copyContract,
    exportContractPDF,
  }
}
