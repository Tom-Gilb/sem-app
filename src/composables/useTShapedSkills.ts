// UNIT_TYPE=Composable
// Feature #155 — Evo Step T-Shaped Skills Visualiser
import { computed, ref, type Ref, type ComputedRef } from 'vue'

export interface TSkillEntry {
  stepId: string
  stepName: string
  depthDomain: string
  breadthDomains: string[]
  depthScore: number
  broadScore: number
}

export interface TSkillsStep {
  id: string
  name: string
}

const DOMAINS = ['Frontend', 'Backend', 'Data', 'DevOps', 'QA'] as const

// ── charCode-sum seed helper ─────────────────────────────────────────────────

export function charCodeSeed(step: TSkillsStep): number {
  const str = step.id + step.name
  return Array.from(str).reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

// ── Detection logic ─────────────────────────────────────────────────────────

export function buildTSkillEntry(step: TSkillsStep): TSkillEntry {
  const seed = charCodeSeed(step)
  const depthIndex = seed % 5
  const depthDomain = DOMAINS[depthIndex]
  const depthScore = 70 + (seed % 31)

  // breadthDomains: first 3 domains (in domain order) that are NOT the depth domain
  const breadthDomains: string[] = []
  for (const d of DOMAINS) {
    if (d !== depthDomain) {
      breadthDomains.push(d)
      if (breadthDomains.length === 3) break
    }
  }

  const broadScore = 20 + (seed % 41)

  return {
    stepId: step.id,
    stepName: step.name,
    depthDomain,
    breadthDomains,
    depthScore,
    broadScore,
  }
}

// ── SVG spider data helper ───────────────────────────────────────────────────

/**
 * Returns polygon points string for a 5-spoke spider chart at centre (cx, cy) with radius r.
 * Each spoke corresponds to a domain in DOMAINS order.
 * The depth spoke uses depthScore/100 * r; breadth spokes use broadScore/100 * r; others 0.
 */
export function spiderPolygonPoints(entry: TSkillEntry, cx: number, cy: number, r: number): string {
  const n = DOMAINS.length
  const pts = DOMAINS.map((domain, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    let frac: number
    if (domain === entry.depthDomain) {
      frac = entry.depthScore / 100
    } else if (entry.breadthDomains.includes(domain)) {
      frac = entry.broadScore / 100
    } else {
      frac = 0
    }
    const radius = frac * r
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })
  return pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
}

/**
 * Returns spoke tip points for axis lines (full r).
 */
export function spiderSpokes(cx: number, cy: number, r: number): Array<{ x1: number; y1: number; x2: number; y2: number; label: string }> {
  const n = DOMAINS.length
  return DOMAINS.map((domain, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    return {
      x1: cx,
      y1: cy,
      x2: cx + r * Math.cos(angle),
      y2: cy + r * Math.sin(angle),
      label: domain,
    }
  })
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useTShapedSkills(steps: Ref<TSkillsStep[]>) {
  const copied = ref(false)

  const entries: ComputedRef<TSkillEntry[]> = computed(() =>
    steps.value.map(buildTSkillEntry)
  )

  // Per-step open state
  const openSteps = ref<Set<string>>(new Set())

  function toggleOpen(stepId: string): void {
    const next = new Set(openSteps.value)
    if (next.has(stepId)) {
      next.delete(stepId)
    } else {
      next.add(stepId)
    }
    openSteps.value = next
  }

  function isOpen(stepId: string): boolean {
    return openSteps.value.has(stepId)
  }

  // ── Markdown copy ──────────────────────────────────────────────────────────

  function copyMarkdown(): void {
    const header = '| Step | Depth Domain | Depth % | Breadth Domains | Broad % |'
    const sep = '|---|---|---|---|---|'
    const rows = entries.value.map(e =>
      `| ${e.stepName} | ${e.depthDomain} | ${e.depthScore}% | ${e.breadthDomains.join(', ')} | ${e.broadScore}% |`
    )
    const md = [header, sep, ...rows].join('\n')
    navigator.clipboard?.writeText(md).catch(() => {})
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }

  return {
    entries,
    openSteps,
    toggleOpen,
    isOpen,
    copyMarkdown,
    copied,
    spiderPolygonPoints,
    spiderSpokes,
    DOMAINS,
  }
}
