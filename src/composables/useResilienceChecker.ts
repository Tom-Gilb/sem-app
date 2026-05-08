// UNIT_TYPE=Composable
// useResilienceChecker — Spec resilience / SPOF scanner
// Feature #103 — Resilience Checker

import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

const SINGLE_POINT_OF_FAILURE_SIGNALS = [
  {
    pattern: /\b(only|sole|single|one)\s+(source|point|path|system|service|provider|database|server)\b/i,
    risk: 'H' as const,
    label: 'Single source dependency',
  },
  {
    pattern: /\bnot?\s+(redundan|backup|failover|alternative|replica)/i,
    risk: 'H' as const,
    label: 'No redundancy',
  },
  {
    pattern: /\b(no|without)\s+(fallback|alternative|backup|failover|recovery|mitigation)\b/i,
    risk: 'H' as const,
    label: 'No fallback mechanism',
  },
  {
    pattern: /\b(manual|human)\s+(only|intervention|process|review)\b/i,
    risk: 'M' as const,
    label: 'Manual process dependency',
  },
  {
    pattern: /\b(single|one)\s+(team|person|developer|engineer|owner)\b/i,
    risk: 'M' as const,
    label: 'Single person dependency',
  },
  {
    pattern: /\bexternal\s+(api|service|system|provider|vendor)\b/i,
    risk: 'L' as const,
    label: 'External dependency',
  },
]

interface ResilienceIssue {
  blockId: string
  blockType: string
  risk: 'H' | 'M' | 'L'
  label: string
  excerpt: string // up to 60 chars from the matched description
}

const RISK_ORDER: Record<'H' | 'M' | 'L', number> = { H: 0, M: 1, L: 2 }

export function useResilienceChecker(spec: Ref<SpecBlock | null>) {
  const resilienceOpen = ref(false)
  const issues = ref<ResilienceIssue[]>([])

  function scanResilience(): void {
    if (!spec.value) {
      issues.value = []
      return
    }

    const found: ResilienceIssue[] = []

    const allEntries: { id: string; type: string; description: string }[] = [
      ...spec.value.functions.map(f => ({ id: f.id, type: 'F.', description: f.description })),
      ...spec.value.values.map(v => ({
        id: v.id,
        type: 'V.',
        description: `${v.description} ${v.scale} ${v.goal}`,
      })),
      ...spec.value.solutions.map(s => ({ id: s.id, type: 'S.', description: s.description })),
    ]

    for (const entry of allEntries) {
      for (const signal of SINGLE_POINT_OF_FAILURE_SIGNALS) {
        if (signal.pattern.test(entry.description)) {
          found.push({
            blockId: entry.id,
            blockType: entry.type,
            risk: signal.risk,
            label: signal.label,
            excerpt: entry.description.slice(0, 60),
          })
          break // one signal per entry to avoid duplicates
        }
      }
    }

    // Sort H first, then M, then L
    found.sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk])

    issues.value = found
  }

  const highCount = computed(() => issues.value.filter(i => i.risk === 'H').length)
  const mediumCount = computed(() => issues.value.filter(i => i.risk === 'M').length)

  async function copyReport(): Promise<void> {
    const h = highCount.value
    const m = mediumCount.value
    const l = issues.value.filter(i => i.risk === 'L').length

    const lines: string[] = [
      '## Resilience Report',
      '',
      `High Risk: ${h} | Medium: ${m} | Low: ${l}`,
      '',
      '| Entry | Risk | Issue | Excerpt |',
      '|-------|------|-------|---------|',
      ...issues.value.map(
        i => `| ${i.blockId} | ${i.risk} | ${i.label} | ${i.excerpt} |`,
      ),
    ]

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch {
      // clipboard not available in test / SSR environment
    }
  }

  return { resilienceOpen, issues, highCount, mediumCount, scanResilience, copyReport }
}
