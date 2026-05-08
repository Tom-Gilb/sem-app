// UNIT_TYPE=Composable
// Feature #133 — Evo step knowledge graph
import { computed } from 'vue'

export interface KgNode {
  id: string
  label: string       // truncated to 14 chars
  type: 'step' | 'value'
  x: number
  y: number
  radius: number      // step nodes: 18 + (linkedCount * 3) clamped 18–36; value nodes: 12
  linkedCount: number
}

export interface KgEdge {
  from: string
  to: string
}

const CENTRE_X = 260
const CENTRE_Y = 160
const STEP_RING_RADIUS = 120
const VALUE_RING_RADIUS = 220

/** Extract words of 3+ chars from a string for keyword matching */
function extractKeywords(text: string): Set<string> {
  const words = (text ?? '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 3)
  return new Set(words)
}

/** Check if two keyword sets share at least one common word */
function sharesKeywords(a: Set<string>, b: Set<string>): boolean {
  for (const word of a) {
    if (b.has(word)) return true
  }
  return false
}

function truncate(s: string, maxLen = 14): string {
  return s.length > maxLen ? s.slice(0, maxLen) : s
}

export function useStepKnowledgeGraph(
  steps: { name: string; description?: string }[],
  valueBlocks: { id: string; name: string; description?: string }[],
) {
  const edges = computed<KgEdge[]>(() => {
    const result: KgEdge[] = []

    for (let si = 0; si < steps.length; si++) {
      const step = steps[si]
      const stepText = `${step.name} ${step.description ?? ''}`
      const stepKw = extractKeywords(stepText)

      for (const vb of valueBlocks) {
        const vbText = `${vb.name} ${vb.description ?? ''}`
        const vbKw = extractKeywords(vbText)

        if (sharesKeywords(stepKw, vbKw)) {
          result.push({ from: `step-${si}`, to: `value-${vb.id}` })
        }
      }
    }

    return result
  })

  const nodes = computed<KgNode[]>(() => {
    const result: KgNode[] = []
    const n = steps.length

    // Step nodes — circle at STEP_RING_RADIUS
    for (let i = 0; i < n; i++) {
      const angle = n > 1 ? (2 * Math.PI / n) * i - Math.PI / 2 : -Math.PI / 2
      const x = CENTRE_X + STEP_RING_RADIUS * Math.cos(angle)
      const y = CENTRE_Y + STEP_RING_RADIUS * Math.sin(angle)
      const stepId = `step-${i}`
      const linkedCount = edges.value.filter((e) => e.from === stepId).length
      const rawRadius = 18 + linkedCount * 3
      const radius = Math.min(36, Math.max(18, rawRadius))

      result.push({
        id: stepId,
        label: truncate(steps[i].name),
        type: 'step',
        x,
        y,
        radius,
        linkedCount,
      })
    }

    // Value nodes — placed at VALUE_RING_RADIUS in direction of most-connected step
    for (const vb of valueBlocks) {
      const vbId = `value-${vb.id}`
      // Collect connected step indices
      const connectedStepIds = edges.value
        .filter((e) => e.to === vbId)
        .map((e) => e.from)

      if (connectedStepIds.length === 0) continue

      // Find angles of connected steps
      const connectedAngles = connectedStepIds.map((sid) => {
        const idx = parseInt(sid.replace('step-', ''), 10)
        return n > 1 ? (2 * Math.PI / n) * idx - Math.PI / 2 : -Math.PI / 2
      })

      // Average angle (circular mean)
      const sinSum = connectedAngles.reduce((s, a) => s + Math.sin(a), 0)
      const cosSum = connectedAngles.reduce((s, a) => s + Math.cos(a), 0)
      const avgAngle = Math.atan2(sinSum / connectedAngles.length, cosSum / connectedAngles.length)

      const x = CENTRE_X + VALUE_RING_RADIUS * Math.cos(avgAngle)
      const y = CENTRE_Y + VALUE_RING_RADIUS * Math.sin(avgAngle)

      result.push({
        id: vbId,
        label: truncate(vb.name),
        type: 'value',
        x,
        y,
        radius: 12,
        linkedCount: connectedStepIds.length,
      })
    }

    return result
  })

  return { nodes, edges }
}
