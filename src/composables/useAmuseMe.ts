// UNIT_TYPE=Hook
// useAmuseMe — "Fun While Waiting?" composable (Amuse Me feature)
// Singleton composable providing menu items, jokes, nice-thing suggestions,
// and plan-progress helpers for the AmuseMeButton component.
//
// Design principle (Architectural Resilience Rule, 2026-05-27):
//   All static data is module-level (no reactivity overhead).
//   The composable itself is thin — state only, no side effects at module level.
//   Content helpers are pure functions — easy to unit-test and Twin-portable.

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmuseItem {
  id: string
  emoji: string
  label: string
  /** One-line description shown in the hover preview and menu rows */
  blurb: string
  /**
   * How the item gets its content:
   *   static   — instant, hardcoded text
   *   dynamic  — derived from spec data at render time
   *   external — would need API / AI (placeholder content shown)
   */
  action: 'static' | 'dynamic' | 'external'
}

// ─── Static data — jokes ──────────────────────────────────────────────────────

export const GLOSSARY_JOKES: string[] = [
  "A Value entry walked into a bar. The barman asked 'What's your Goal?' The Value said '≥95%'. The barman said 'And your Tolerable?' The Value said '≥50%'. The barman said 'You're hired — most entries can't even define their Scale.'",

  "Why did the Function fail its presence test? Because it was absent. That's the whole point.",

  "A Stakeholder said 'I want better performance.' The engineer asked 'On what Scale?' Silence. 'With what Meter?' More silence. 'By what Goal date?' The Stakeholder said 'You know — better.' The engineer wrote: V.BetterPerformance. Scale: [vague]. That spec never shipped.",

  "An Evo Step said 'I'll deliver all the value in one big bang.' Tom Gilb replied: 'That's called a waterfall. And we know how that ends.'",

  "How many Planguage engineers does it take to change a lightbulb? Define 'change'. Define 'lightbulb'. Define 'done'. Specify the lumen Goal and Tolerable levels. Then ask: is a working lightbulb a Function or a Value? (It's both. Function: provides light. Value: lumen output ≥800.)",

  "A manager said 'Make it fast.' The Planguage engineer said 'Fast on what Scale — milliseconds, seconds, minutes? Measured how — wall clock, CPU time, user perception? Goal: faster than what Baseline?' The manager said 'Just... fast.' The engineer added: Scale: TBD. Meter: TBD. Goal: TBD. Shipped: never.",

  "What's the difference between a Wish and a Goal? About three arguments with your Product Manager and a missed deadline.",

  "An Evo step said to a Waterfall: 'You plan everything upfront and measure nothing until the end.' The Waterfall said: 'Yes, and?' The Evo step said: 'Tom Gilb called. He wants his 1960s back.'",

  "A Constraint walked into a Sprint planning meeting. The team said 'We'll get to you later.' The Constraint said: 'No. I am binary. I am either respected — or everything else is irrelevant.'",

  "Why do Planguage specs have a Baseline? So you know exactly how bad things are before you pretend to improve them.",
]

// ─── Static data — nice things ────────────────────────────────────────────────

export const NICE_THINGS: string[] = [
  "Send a short message to someone you haven't spoken to in months — not asking for anything, just saying you thought of them.",
  "Write down one thing you genuinely appreciate about a colleague and tell them. Not in a group chat. Directly.",
  "Make tea or coffee for whoever is nearest to you right now, without being asked.",
  "Find one task someone on your team dreads and volunteer to take it off their plate this week.",
  "Leave a thoughtful review for a small local business you genuinely like. It takes 3 minutes and can change their month.",
  "Ask someone how they are — and then actually listen to the answer before speaking.",
  "Thank someone who did something useful for you that you never got around to acknowledging.",
  "Pay the toll or parking for the car behind you if you can. No explanation needed.",
  "Put your phone down for the next hour and be fully present with whoever you're with.",
  "Send a book, article, or video to someone because you thought 'they would love this' — not because it's useful to you.",
]

// ─── Static data — menu items ─────────────────────────────────────────────────

export const AMUSE_ITEMS: AmuseItem[] = [
  {
    id: 'glossaryJoke',
    emoji: '🎭',
    label: 'Glossary Joke',
    blurb: 'A Planguage-themed joke while the AI thinks',
    action: 'static',
  },
  {
    id: 'planProgress',
    emoji: '📈',
    label: 'Plan Progress',
    blurb: 'Summary of V./F./S. counts and next recommended action',
    action: 'dynamic',
  },
  {
    id: 'nextStep',
    emoji: '➡️',
    label: 'What Happens Next',
    blurb: 'The next planning stage description',
    action: 'dynamic',
  },
  {
    id: 'niceThings',
    emoji: '💝',
    label: 'Do Something Nice',
    blurb: 'A genuine suggestion for a kind act while you wait',
    action: 'static',
  },
  {
    id: 'completionAlert',
    emoji: '🔔',
    label: 'Completion Alert',
    blurb: 'How you will be told when this process finishes',
    action: 'static',
  },
  {
    id: 'whyThisMatters',
    emoji: '🔮',
    label: 'Why This Process Matters',
    blurb: 'What the current AI generation is doing for your plan',
    action: 'static',
  },
  {
    id: 'untilSharing',
    emoji: '📅',
    label: 'Steps Until Sharing',
    blurb: 'How many stages remain before your plan can be shared',
    action: 'dynamic',
  },
  {
    id: 'explainMode',
    emoji: '👆',
    label: 'Explain Any Element',
    blurb: 'Hover any button or glyph to read what it does',
    action: 'static',
  },
]

// ─── Planning stage names (9-step Evo cycle, Tom Gilb canonical) ──────────────

const STAGE_NAMES: Record<number, string> = {
  1: 'Stakeholders — who benefits and who pays',
  2: 'Values — what outcomes matter and how to measure them',
  3: 'Solutions — what capabilities deliver those values',
  4: 'Decompose — break solutions into workable pieces',
  5: 'Prioritize — rank by value delivered within all constraints',
  6: 'Develop — build the prioritized solution increments',
  7: 'Deliver — deploy increments to real stakeholders',
  8: 'Measure — collect actual Value entry Status data',
  9: 'Learn — interpret data and update the spec',
  10: 'Review — share results and validate with stakeholders',
  11: 'Export — share the plan externally',
}

// ─── Pure content helpers ─────────────────────────────────────────────────────

/** Picks a uniformly random item from an array. */
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Returns a random Planguage joke string. */
export function randomJoke(): string {
  return pickRandom(GLOSSARY_JOKES)
}

/** Returns a random nice-thing suggestion. */
export function randomNiceThing(): string {
  return pickRandom(NICE_THINGS)
}

/**
 * Builds a 2-3 sentence plan progress summary from spec data.
 * Pure function — no reactivity, no side effects.
 */
export function planProgressText(spec: SpecBlock | null | undefined): string {
  if (!spec) {
    return 'No spec loaded yet. Add some entries in the spec panel and the plan will populate here.'
  }
  const vCount = spec.values.length
  const fCount = spec.functions.length
  const sCount = spec.solutions.length
  const cCount = spec.constraints?.length ?? 0

  const totalEntries = vCount + fCount + sCount + cCount
  if (totalEntries === 0) {
    return 'Your spec is empty. Start by adding a Function (what the system does) or a Value (how to measure success). Evo steps are generated once you have at least one Value and one Solution.'
  }

  const parts: string[] = []
  parts.push(
    `Your spec currently has ${vCount} Value${vCount !== 1 ? 's' : ''}, ${fCount} Function${fCount !== 1 ? 's' : ''}, ${sCount} Solution${sCount !== 1 ? 's' : ''}${cCount > 0 ? `, and ${cCount} Constraint${cCount !== 1 ? 's' : ''}` : ''}.`
  )

  if (vCount === 0) {
    parts.push('Add at least one Value entry with a Scale and Goal so the system can measure success.')
  } else if (sCount === 0) {
    parts.push('Add Solution entries to describe the capabilities that will deliver your Values — then Evo steps can be generated.')
  } else {
    parts.push('The AI is now generating Evo Value Delivery Steps — incremental deliveries that each move at least one Value closer to its Goal.')
  }

  if (vCount > 0 && sCount > 0) {
    parts.push('Estimated wait: up to 60 seconds on slow networks. A completion sound will play when done.')
  }

  return parts.join(' ')
}

/**
 * Returns a description of the next planning stage given the current stage number.
 * Pure function — no reactivity, no side effects.
 */
export function nextStepText(planningStage: number): string {
  const currentName = STAGE_NAMES[planningStage] ?? `Stage ${planningStage}`
  const nextStage = planningStage + 1
  const nextName = STAGE_NAMES[nextStage]

  if (!nextName) {
    return `You are at Stage ${planningStage}: ${currentName}. This is the final planning stage — once Evo steps are generated, your plan is ready to share with stakeholders.`
  }

  return `You are currently at Stage ${planningStage}: ${currentName}. When this completes, the natural next step is Stage ${nextStage}: ${nextName}. In Evo, stages are views into one living plan — you can always jump forward or circle back.`
}

/**
 * Returns how many stages remain until the plan can be shared (Stage 11: Export).
 */
export function stagesUntilSharing(currentStage: number): Array<{ stage: number; name: string }> {
  const result: Array<{ stage: number; name: string }> = []
  for (let s = currentStage + 1; s <= 11; s++) {
    result.push({ stage: s, name: STAGE_NAMES[s] ?? `Stage ${s}` })
  }
  return result
}

// ─── Composable ───────────────────────────────────────────────────────────────

export interface AmuseMeState {
  /** Whether the full panel is open */
  isOpen: Ref<boolean>
  /** Which menu item is currently selected / showing content */
  activeItemId: Ref<string | null>
  /** Open or close the panel */
  toggle(): void
  /** Select a menu item by id */
  selectItem(id: string): void
  /** Close the panel and reset selected item */
  close(): void
}

/**
 * Thin reactive state composable for the AmuseMeButton.
 * All content generation lives in the pure helpers above — the composable
 * only manages open/close and active-item state so the component stays simple.
 *
 * Not a true singleton (each call gets its own state), which is appropriate
 * since multiple loading contexts could theoretically show AmuseMeButton.
 */
export function useAmuseMe(): AmuseMeState {
  const isOpen = ref(false)
  const activeItemId = ref<string | null>(null)

  function toggle(): void {
    isOpen.value = !isOpen.value
    if (!isOpen.value) {
      activeItemId.value = null
    }
  }

  function selectItem(id: string): void {
    activeItemId.value = id
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
    activeItemId.value = null
  }

  return { isOpen, activeItemId, toggle, selectItem, close }
}
