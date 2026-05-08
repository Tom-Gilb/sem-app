// UNIT_TYPE=Composable
// Feature #148 — Evo step meeting agenda generator

import { ref } from 'vue'
import type { Ref } from 'vue'

export interface AgendaSection {
  title: string
  duration: number
  content: string
}

export interface AgendaEntry {
  stepId: string
  stepName: string
  sections: AgendaSection[]
  isOpen: boolean
}

const SECTION_TITLES = [
  'Context & Goals',
  'Progress Review',
  'Decisions Needed',
  'Task Assignments',
  'Next Steps & Actions',
] as const

const SECTION_DURATIONS = [5, 10, 10, 10, 5] as const

const DECISIONS_BANK: string[] = [
  'API contract',
  'Tech stack choice',
  'Scope boundary',
  'Release criteria',
  'Resource allocation',
  'Risk acceptance',
]

function charCodeSum(s: string): number {
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    sum += s.charCodeAt(i)
  }
  return sum
}

function buildSections(step: { id: string; name: string; effort?: number }): AgendaSection[] {
  const seed = charCodeSum(step.id)

  // Context & Goals
  const firstSentence = step.name.split('.')[0].trim()
  const contextContent = `${firstSentence} — aligning team on current sprint goals`

  // Progress Review
  const progressContent = `Review completed tasks for ${step.name}`

  // Decisions Needed
  const decisionContent = DECISIONS_BANK[seed % DECISIONS_BANK.length]

  // Task Assignments
  const effort = step.effort ?? 4
  const assignContent = `Assign remaining ${effort}h of work across team members`

  // Next Steps
  const nextContent = 'Define action items and owners before next standup'

  return [
    { title: SECTION_TITLES[0], duration: SECTION_DURATIONS[0], content: contextContent },
    { title: SECTION_TITLES[1], duration: SECTION_DURATIONS[1], content: progressContent },
    { title: SECTION_TITLES[2], duration: SECTION_DURATIONS[2], content: decisionContent },
    { title: SECTION_TITLES[3], duration: SECTION_DURATIONS[3], content: assignContent },
    { title: SECTION_TITLES[4], duration: SECTION_DURATIONS[4], content: nextContent },
  ]
}

export function useMeetingAgenda(steps: Ref<{ id: string; name: string; effort?: number }[]>) {
  const agendaMap = ref<Record<string, AgendaEntry>>({})
  const agendaCopied = ref<string | null>(null)

  function buildEntry(stepId: string): void {
    const step = steps.value.find((s) => s.id === stepId)
    if (!step) return

    agendaMap.value[stepId] = {
      stepId,
      stepName: step.name,
      sections: buildSections(step),
      isOpen: agendaMap.value[stepId]?.isOpen ?? false,
    }
  }

  function toggleOpen(stepId: string): void {
    if (!agendaMap.value[stepId]) {
      buildEntry(stepId)
    }
    // Guard: if step wasn't found in the list, buildEntry does nothing
    if (!agendaMap.value[stepId]) return
    agendaMap.value[stepId].isOpen = !agendaMap.value[stepId].isOpen
  }

  function copyAgenda(stepId: string): void {
    const entry = agendaMap.value[stepId]
    if (!entry) return

    const header = `## Meeting Agenda — ${entry.stepName}`
    const tableHeader = `| # | Topic | Duration |`
    const tableSep = `|---|---|---|`
    const tableRows = entry.sections
      .map((s, i) => `| ${i + 1} | ${s.title} | ${s.duration} min |`)
      .join('\n')
    const contentLines = entry.sections
      .map((s, i) => `\n**${i + 1}. ${s.title}**\n${s.content}`)
      .join('\n')

    const markdown = [header, '', tableHeader, tableSep, tableRows, contentLines].join('\n')

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(markdown).catch(() => {/* silent */})
    }

    agendaCopied.value = stepId
    setTimeout(() => {
      agendaCopied.value = null
    }, 2000)
  }

  return {
    agendaMap,
    agendaCopied,
    toggleOpen,
    copyAgenda,
  }
}
