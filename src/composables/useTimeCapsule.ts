// UNIT_TYPE=Composable
// Feature #54 — Spec "time capsule" review checklist
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface TimeCapsuleItem {
  entryId: string
  question: string    // review question
  currentGoal: string
  currentStatus: string
}

export interface TimeCapsuleReport {
  reviewDate: Date
  items: TimeCapsuleItem[]
  markdown: string
}

export function useTimeCapsule() {
  const report = ref<TimeCapsuleReport | null>(null)
  const horizonDays = ref<30 | 60 | 90>(30)
  const capsuleCopied = ref(false)

  function generateReport(spec: SpecBlock): void {
    const reviewDate = new Date()
    reviewDate.setDate(reviewDate.getDate() + horizonDays.value)

    const items: TimeCapsuleItem[] = spec.values.map(v => ({
      entryId: v.id,
      question: `Has "${v.id}" reached its Goal of ${v.goal ?? '(not set)'}?`,
      currentGoal: v.goal ?? '(not set)',
      currentStatus: v.status ?? '(not measured)',
    }))

    const dateStr = reviewDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const lines = [
      `# Spec Review Checklist — ${dateStr}`,
      `*Generated ${new Date().toLocaleDateString()} · ${horizonDays.value}-day horizon*`,
      '',
      '## Value Goals to Verify',
      '',
      ...items.map(item => [
        `### ${item.entryId}`,
        `- **Goal set today:** ${item.currentGoal}`,
        `- **Status today:** ${item.currentStatus}`,
        `- [ ] ${item.question}`,
        `- [ ] Has the Scale/Meter changed since spec was written?`,
        `- [ ] Are the stakeholders still the same?`,
        '',
      ].join('\n')),
      '## Spec Health',
      '- [ ] Quality score still ≥ 80?',
      '- [ ] Any new requirements that should be added?',
      '- [ ] Any entries that should be retired or updated?',
    ]

    report.value = {
      reviewDate,
      items,
      markdown: lines.join('\n'),
    }
  }

  async function copyReport(): Promise<void> {
    if (!report.value) return
    try {
      await navigator.clipboard.writeText(report.value.markdown)
      capsuleCopied.value = true
      setTimeout(() => { capsuleCopied.value = false }, 2000)
    } catch { /* ignore */ }
  }

  return { report, horizonDays, capsuleCopied, generateReport, copyReport }
}
