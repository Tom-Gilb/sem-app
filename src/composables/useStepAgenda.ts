// UNIT_TYPE=Composable
// Feature #148 — Evo step meeting agenda generator
import { ref } from 'vue'

export interface AgendaSection {
  title: string
  content: string
  durationMinutes: number
}

export interface MeetingAgenda {
  stepId: string
  stepName: string
  totalMinutes: number
  sections: AgendaSection[]
  open: boolean
}

const contextBank: string[] = [
  'Review the current spec state and recent changes',
  'Align the team on objectives for this Evo step',
  'Recap blockers resolved since last meeting',
  'Present updated timeline and dependencies',
  'Share metrics from the previous delivery cycle',
  'Discuss stakeholder feedback received',
  'Confirm scope and boundaries for this step',
  'Review relevant acceptance criteria',
]

const goalBank: string[] = [
  'Agree on the definition of done for this step',
  'Confirm delivery date and ownership',
  'Validate the approach before implementation starts',
  'Align on quality gate criteria',
  'Finalise prioritisation for the next 24 hours',
  'Sign off the current implementation plan',
]

const decisionBank: string[] = [
  'What is the correct implementation approach for the core logic?',
  'Who owns the delivery and testing of this step?',
  'Are there any unresolved dependency risks to address?',
  'Do we proceed or pause pending stakeholder confirmation?',
  'What is the fallback plan if the primary approach fails?',
  'Should we break this step into smaller sub-tasks?',
]

const tasksBank: string[] = [
  'Assign owners for all open action items before end of meeting',
  'Update the task checklist in the Evo Plan view',
  'Ensure blockers are logged in the blocker log',
  'Confirm acceptance test scenarios are documented',
  'Update the timebox for this step if needed',
  'Schedule a follow-up check-in within 24 hours',
]

const nextBank: string[] = [
  'Begin implementation — driver leads with navigator support',
  'Post a summary of decisions to the shared channel',
  'Run the first acceptance test within 2 hours',
  'Update the Definition of Done checklist',
  'Notify stakeholders of any scope or timeline changes',
  'Review progress at next standup',
]

const SECTION_TITLES = ['Context', 'Goal', 'Decisions Needed', 'Assigned Tasks', 'Next Steps'] as const
const SECTION_DURATIONS = [5, 10, 15, 10, 5] as const

export function useStepAgenda() {
  const agendaMap = ref<Record<string, MeetingAgenda>>({})

  function generateAgenda(step: { id: string; name: string }): void {
    const seed = step.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

    const sections: AgendaSection[] = [
      { title: SECTION_TITLES[0], content: contextBank[seed % 8],            durationMinutes: SECTION_DURATIONS[0] },
      { title: SECTION_TITLES[1], content: goalBank[(seed + 1) % 6],         durationMinutes: SECTION_DURATIONS[1] },
      { title: SECTION_TITLES[2], content: decisionBank[(seed + 2) % 6],     durationMinutes: SECTION_DURATIONS[2] },
      { title: SECTION_TITLES[3], content: tasksBank[(seed + 3) % 6],        durationMinutes: SECTION_DURATIONS[3] },
      { title: SECTION_TITLES[4], content: nextBank[(seed + 4) % 6],         durationMinutes: SECTION_DURATIONS[4] },
    ]

    const totalMinutes = sections.reduce((sum, s) => sum + s.durationMinutes, 0)

    agendaMap.value[step.id] = {
      stepId: step.id,
      stepName: step.name,
      totalMinutes,
      sections,
      open: agendaMap.value[step.id]?.open ?? false,
    }
  }

  function toggleOpen(stepId: string): void {
    const entry = agendaMap.value[stepId]
    if (!entry) return
    entry.open = !entry.open
  }

  function copyAgenda(stepId: string): void {
    const entry = agendaMap.value[stepId]
    if (!entry) return

    const lines: string[] = [`## Meeting Agenda — ${entry.stepName} (${entry.totalMinutes} min)`, '']

    for (const s of entry.sections) {
      lines.push(`**${s.title}** (${s.durationMinutes} min)`)
      lines.push(s.content)
      lines.push('')
    }

    const text = lines.join('\n').trimEnd()

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {/* silent */})
    }
  }

  return { agendaMap, generateAgenda, toggleOpen, copyAgenda }
}
