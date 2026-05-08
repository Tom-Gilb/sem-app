// UNIT_TYPE=Composable
// Feature #189 — Spec "learning curve estimator"
// Estimates learning complexity and hours for each F. entry using keyword banks.
import { ref, computed } from 'vue'
import type { SpecBlock } from '../types/spec'

export type LearningStage = 'Novice' | 'Practitioner' | 'Expert'

export interface LearningEntry {
  id: string
  description: string     // truncated 60 chars
  complexityScore: number // 0–100
  estimatedHours: number  // Math.round(complexityScore * 0.4 + seed(id+'hrs',8) + 2)
  stage: LearningStage    // complexityScore < 34 → 'Novice'; < 67 → 'Practitioner'; else → 'Expert'
  stageEmoji: string      // Novice='🌱', Practitioner='🌿', Expert='🌳'
}

const TECHNICAL_KEYWORDS = [
  'api', 'integration', 'async', 'algorithm', 'distributed', 'concurrent',
  'latency', 'throughput', 'schema', 'pipeline', 'encryption', 'inference',
]
const DOMAIN_KEYWORDS = [
  'compliance', 'regulation', 'stakeholder', 'governance', 'portfolio',
  'enterprise', 'cross-functional', 'dependency', 'orchestration',
]
const ABSTRACTION_KEYWORDS = [
  'model', 'framework', 'pattern', 'interface', 'contract', 'service',
  'module', 'layer', 'abstraction',
]
const SIMPLE_KEYWORDS = [
  'button', 'label', 'text', 'colour', 'display', 'show', 'hide', 'toggle',
]

export function seed(s: string, mod: number): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % mod
}

export function computeComplexityScore(description: string): number {
  const words = description.toLowerCase().split(/\s+/)
  let raw = 0
  for (const word of words) {
    const clean = word.replace(/[^a-z-]/g, '')
    if (TECHNICAL_KEYWORDS.includes(clean)) raw += 8
    else if (DOMAIN_KEYWORDS.includes(clean)) raw += 6
    else if (ABSTRACTION_KEYWORDS.includes(clean)) raw += 4
    else if (SIMPLE_KEYWORDS.includes(clean)) raw -= 4
  }
  return Math.min(100, Math.max(0, raw))
}

export function stageFromScore(score: number): LearningStage {
  if (score < 34) return 'Novice'
  if (score < 67) return 'Practitioner'
  return 'Expert'
}

export function stageEmojiFromStage(stage: LearningStage): string {
  if (stage === 'Novice') return '🌱'
  if (stage === 'Practitioner') return '🌿'
  return '🌳'
}

export function buildLearningEntry(id: string, description: string): LearningEntry {
  const complexityScore = computeComplexityScore(description)
  const estimatedHours = Math.round(complexityScore * 0.4 + seed(id + 'hrs', 8) + 2)
  const stage = stageFromScore(complexityScore)
  const stageEmoji = stageEmojiFromStage(stage)
  return {
    id,
    description: description.slice(0, 60),
    complexityScore,
    estimatedHours,
    stage,
    stageEmoji,
  }
}

export function useLearningCurve(blocks: SpecBlock[]) {
  const open = ref(false)
  const copied = ref(false)

  const entries = computed((): LearningEntry[] => {
    if (blocks.length === 0) return []
    const functions = blocks.flatMap(b => b.functions)
    const built = functions.map(f => buildLearningEntry(f.id, f.description))
    return [...built].sort((a, b) => b.complexityScore - a.complexityScore)
  })

  const avgHours = computed((): number => {
    if (entries.value.length === 0) return 0
    const sum = entries.value.reduce((a, e) => a + e.estimatedHours, 0)
    return Math.round(sum / entries.value.length)
  })

  async function copyMarkdown(): Promise<void> {
    const lines: string[] = [
      '| ID | Complexity Score | Est. Hours | Stage |',
      '|---|---|---|---|',
    ]
    for (const e of entries.value) {
      lines.push(`| ${e.id} | ${e.complexityScore} | ${e.estimatedHours} | ${e.stage} |`)
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return { open, entries, avgHours, copyMarkdown, copied }
}
