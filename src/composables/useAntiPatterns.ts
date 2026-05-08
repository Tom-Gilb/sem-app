// UNIT_TYPE=Composable
// Feature #92 — Spec Anti-Pattern Detector
// Scans all F./V./S. entries for common Planguage spec anti-patterns.

import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../types/spec'

// ── Unified block type for checking ─────────────────────────────────────────

type AnyEntry = FEntry | VEntry | SEntry

interface CheckableBlock {
  id: string
  type: string
  description?: string
  scale?: string
  goal?: string
}

function toCheckable(entry: AnyEntry): CheckableBlock {
  return {
    id: entry.id,
    type: entry.type,
    description: 'description' in entry ? (entry as FEntry | VEntry | SEntry).description : undefined,
    scale: 'scale' in entry ? (entry as VEntry).scale : undefined,
    goal: 'goal' in entry ? (entry as VEntry).goal : undefined,
  }
}

// ── Anti-pattern definitions ─────────────────────────────────────────────────

interface AntiPattern {
  id: string
  name: string
  description: string
  check: (block: CheckableBlock) => boolean
}

const ANTI_PATTERNS: AntiPattern[] = [
  {
    id: 'AP1',
    name: 'No units in Scale',
    description: 'Scale field contains no measurement units (%, hrs, ms, /, $, pts, score, rate, count, num)',
    check: (block) =>
      block.type === 'Value' &&
      !!block.scale &&
      !/(%|hrs|ms|\/|usd|\$|pts|score|rate|count|num|days|weeks|min|sec)/i.test(block.scale),
  },
  {
    id: 'AP2',
    name: 'Passive voice in description',
    description: 'Description uses passive voice (is done, was implemented, will be provided)',
    check: (block) =>
      /\b(is done|was |were |will be |has been |have been |had been |been |passive)\b/i.test(
        block.description ?? ''
      ),
  },
  {
    id: 'AP3',
    name: 'Description over 100 words',
    description: 'Description exceeds 100 words — suggests the entry is not atomic enough',
    check: (block) =>
      (block.description?.split(/\s+/).filter(Boolean).length ?? 0) > 100,
  },
  {
    id: 'AP4',
    name: 'Bare percentage goal',
    description: 'Goal is just "X%" with no context of what is being measured',
    check: (block) =>
      block.type === 'Value' && /^\d+%$/.test((block.goal ?? '').trim()),
  },
  {
    id: 'AP5',
    name: 'Vague improvement verb',
    description:
      'Description contains vague improvement verbs: improve, enhance, better, optimize without a measured target',
    check: (block) =>
      /\b(improve|enhance|better|optimise|optimize|boost|increase|decrease)\b/i.test(
        block.description ?? ''
      ) && !/\d/.test(block.description ?? ''),
  },
  {
    id: 'AP6',
    name: 'Missing Scale (V. entry)',
    description: 'Value entry has no Scale field defined',
    check: (block) => block.type === 'Value' && !block.scale?.trim(),
  },
  {
    id: 'AP7',
    name: 'Subjective language in description',
    description:
      'Description uses subjective qualifiers: good, great, excellent, poor, fast, slow, easy, hard',
    check: (block) =>
      /\b(good|great|excellent|poor|fast|slow|easy|hard|simple|complex|robust|intuitive)\b/i.test(
        block.description ?? ''
      ),
  },
  {
    id: 'AP8',
    name: 'ID not following naming convention',
    description: 'Entry ID does not follow [Type].[Name] or [Prefix].[Type].[Name] pattern (e.g. F.CheckerTool or 3P.F.CheckerTool)',
    // Accept both 2-part (F.Name) and 3-part (Prefix.F.Name) forms.
    // The optional project prefix is alphanumeric; the type must be a single letter; the name must start with a letter.
    check: (block) => !/^([A-Za-z0-9]+\.)?[A-Za-z]\.[A-Za-z]/.test(block.id ?? ''),
  },
]

// ── Public interface ─────────────────────────────────────────────────────────

export interface AntiPatternViolation {
  blockId: string
  blockType: string
  patternId: string
  patternName: string
  description: string
}

export function useAntiPatterns(spec: Ref<SpecBlock | null>) {
  const antiPatternsOpen = ref(false)
  const violations = ref<AntiPatternViolation[]>([])

  function scanAntiPatterns(): void {
    const s = spec.value
    if (!s) {
      violations.value = []
      return
    }

    const allEntries: AnyEntry[] = [
      ...s.functions,
      ...s.values,
      ...s.solutions,
    ]

    const found: AntiPatternViolation[] = []

    for (const entry of allEntries) {
      const block = toCheckable(entry)
      for (const pattern of ANTI_PATTERNS) {
        if (pattern.check(block)) {
          found.push({
            blockId: entry.id,
            blockType: entry.type,
            patternId: pattern.id,
            patternName: pattern.name,
            description: pattern.description,
          })
        }
      }
    }

    violations.value = found
  }

  const violationCount = computed(() => violations.value.length)

  async function copyReport(): Promise<void> {
    const vCount = violations.value.length

    const uniqueEntries = new Set(violations.value.map(v => v.blockId)).size
    const header = `## Anti-Pattern Report\n\n${vCount} violation${vCount === 1 ? '' : 's'} found across ${uniqueEntries} entr${uniqueEntries === 1 ? 'y' : 'ies'}.\n`

    const tableHeader = '\n| Entry | Type | Pattern | Issue |\n|---|---|---|---|'
    const rows = violations.value
      .map(v => `| ${v.blockId} | ${v.blockType} | ${v.patternId}: ${v.patternName} | ${v.description} |`)
      .join('\n')

    const report = [header, tableHeader, rows].join('\n')

    try {
      await navigator.clipboard.writeText(report)
    } catch {
      // clipboard not available in test / SSR
    }
  }

  return { antiPatternsOpen, violations, violationCount, scanAntiPatterns, copyReport }
}
