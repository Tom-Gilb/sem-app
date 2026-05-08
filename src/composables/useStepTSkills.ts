// UNIT_TYPE=Composable
// Feature #155 — Evo step "T-shaped skills" visualiser
// Per step: infer T-shaped skill profile (1 deep skill + breadth across 4 domains)
// 5-spoke SVG mini radar per step card; depth vs breadth badge
import { ref } from 'vue'

export type TSkillDomain = 'frontend' | 'backend' | 'data' | 'devops' | 'product'

export interface TSkillProfile {
  stepId: string
  deepSkill: TSkillDomain
  scores: Record<TSkillDomain, number>   // 0–100 per domain
  depthScore: number                      // max domain score
  breadthScore: number                    // avg of non-deep domains
  badge: 'T-shaped' | 'I-shaped' | 'π-shaped'
}

const DOMAIN_KEYWORDS: Record<TSkillDomain, string[]> = {
  frontend: ['ui', 'ux', 'component', 'css', 'vue', 'react', 'interface', 'template', 'design', 'mobile'],
  backend: ['api', 'server', 'database', 'auth', 'endpoint', 'service', 'rest', 'graphql', 'sql', 'cache'],
  data: ['metric', 'analytics', 'report', 'dashboard', 'chart', 'score', 'measurement', 'insight', 'trend'],
  devops: ['deploy', 'ci', 'pipeline', 'docker', 'test', 'build', 'release', 'monitor', 'infra', 'automation'],
  product: ['feature', 'user', 'stakeholder', 'value', 'plan', 'spec', 'requirement', 'story', 'roadmap', 'okr'],
}

export function useStepTSkills() {
  const openSteps = ref<Set<string>>(new Set())

  function seed(s: string): number {
    return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  }

  function toggleOpen(stepId: string) {
    if (openSteps.value.has(stepId)) openSteps.value.delete(stepId)
    else openSteps.value.add(stepId)
  }

  function isOpen(stepId: string): boolean {
    return openSteps.value.has(stepId)
  }

  function getProfile(stepId: string, stepTitle: string): TSkillProfile {
    const text = (stepTitle + ' ' + stepId).toLowerCase()
    const s = seed(stepId)
    const scores: Record<TSkillDomain, number> = {
      frontend: 0, backend: 0, data: 0, devops: 0, product: 0,
    }
    const domains: TSkillDomain[] = ['frontend', 'backend', 'data', 'devops', 'product']

    // Keyword scoring
    for (const domain of domains) {
      for (const kw of DOMAIN_KEYWORDS[domain]) {
        if (text.includes(kw)) scores[domain] += 20
      }
    }

    // Add seeded base scores (20–60) so no domain is zero
    for (let i = 0; i < domains.length; i++) {
      scores[domains[i]] = Math.min(100, scores[domains[i]] + 20 + ((s + i * 17) % 40))
    }

    // Deep skill = highest score domain
    const deepSkill = domains.reduce((a, b) => scores[a] >= scores[b] ? a : b)
    const depthScore = scores[deepSkill]
    const breadthScore = Math.round(
      domains.filter(d => d !== deepSkill).reduce((a, d) => a + scores[d], 0) / 4
    )

    // Badge: T-shaped if depth>>breadth, I-shaped if very narrow, π-shaped if two high peaks
    const highDomains = domains.filter(d => scores[d] >= 70)
    let badge: TSkillProfile['badge'] = 'T-shaped'
    if (highDomains.length >= 2) badge = 'π-shaped'
    else if (breadthScore < 35) badge = 'I-shaped'

    return { stepId, deepSkill, scores, depthScore, breadthScore, badge }
  }

  function spokePoint(cx: number, cy: number, r: number, index: number, total: number, value: number): string {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2
    const dist = (value / 100) * r
    return `${cx + dist * Math.cos(angle)},${cy + dist * Math.sin(angle)}`
  }

  function buildPolygon(stepId: string, stepTitle: string): string {
    const profile = getProfile(stepId, stepTitle)
    const domains: TSkillDomain[] = ['frontend', 'backend', 'data', 'devops', 'product']
    const cx = 50, cy = 50, r = 40
    return domains.map((d, i) => spokePoint(cx, cy, r, i, 5, profile.scores[d])).join(' ')
  }

  function copyMarkdown(steps: Array<{ id: string; title: string }>): string {
    const lines = ['# T-Shaped Skills per Step\n']
    for (const s of steps) {
      const profile = getProfile(s.id, s.title)
      lines.push(`## ${s.title}`)
      lines.push(`- Deep skill: **${profile.deepSkill}** (${profile.depthScore}%)`)
      lines.push(`- Breadth avg: ${profile.breadthScore}%`)
      lines.push(`- Badge: ${profile.badge}\n`)
    }
    return lines.join('\n')
  }

  return { openSteps, toggleOpen, isOpen, getProfile, buildPolygon, copyMarkdown }
}
