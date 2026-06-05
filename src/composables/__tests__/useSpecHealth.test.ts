// UNIT_TYPE=Test
// Tests for usePlanHealth composable (Feature #202 — Plan Health Index).
// Covers: per-aspect evaluators against handcrafted SpecBlocks, computeBreakdown
// aggregation math, planHealthIndex / groupIndex, mutation paths + ReasonEntry
// audit log, addCustomAspect / removeCustomAspect, threshold change, and
// per-plan isolation of the singleton store.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  useSpecHealth,
  ASPECT_GROUPS,
  getDefaultAspects,
  applySpecPatch,
  type PlanHealthContext,
  type SpecPatch,
} from '../useSpecHealth'
import type { SpecBlock, VEntry, FEntry, SEntry } from '../../types/spec'

// ── Stub builders ───────────────────────────────────────────────────────────

function v(id: string, partial: Partial<VEntry> = {}): VEntry {
  return {
    id, type: 'Value', level: 'Stakeholder',
    description: id, scale: '', meter: '',
    status: '', tolerable: '', goal: '', valueOfFunction: '',
    ...partial,
  }
}

function f(id: string, partial: Partial<FEntry> = {}): FEntry {
  return {
    id, type: 'Function', level: 'Business',
    description: id, successCriteria: '', functionOfValue: '',
    ...partial,
  }
}

function s(id: string, partial: Partial<SEntry> = {}): SEntry {
  return {
    id, type: 'Solution', level: 'Solution',
    description: id, impact: '', function: '',
    ...partial,
  }
}

function spec(parts: { functions?: FEntry[]; values?: VEntry[]; solutions?: SEntry[] } = {}): SpecBlock {
  return { functions: parts.functions ?? [], values: parts.values ?? [], solutions: parts.solutions ?? [] }
}

function ctx(overrides: Partial<PlanHealthContext> = {}): PlanHealthContext {
  return {
    spec: overrides.spec ?? spec(),
    specOwnerCount: overrides.specOwnerCount ?? 0,
    hasPlanOwner: overrides.hasPlanOwner ?? false,
    signals: overrides.signals,
  }
}

const MODEL = 'ph-test-model'

beforeEach(() => {
  // Reset the singleton-backed localStorage state between tests.
  try { localStorage.removeItem('sem-plan-health-custom') } catch { /* node env */ }
  // Force re-read so the in-memory singleton resets too.
  // (usePlanHealth's _store is module-level — easiest path is a fresh model id per test
  //  for full isolation; we use unique ids within mutation tests below.)
})

// ── Group meta sanity ────────────────────────────────────────────────────────

describe('ASPECT_GROUPS metadata', () => {
  it('seeds 6 active groups whose default weights sum to ~1.0', () => {
    const seeded = Object.values(ASPECT_GROUPS).filter(g => g.seeded)
    expect(seeded.length).toBe(6)
    const sum = seeded.reduce((a, g) => a + g.defaultWeight, 0)
    expect(sum).toBeGreaterThan(0.99)
    expect(sum).toBeLessThan(1.01)
  })

  it('reserves 5 groups not yet seeded (ai-experts + 4 future)', () => {
    const reserved = Object.values(ASPECT_GROUPS).filter(g => !g.seeded)
    expect(reserved.map(g => g.id).sort()).toEqual(
      ['ai-experts', 'calibration', 'change-stability', 'resource-health', 'stakeholder-alignment'],
    )
  })
})

// ── Default aspect evaluators (per-group spot checks) ───────────────────────

describe('Default aspects — Spec Defects', () => {
  const aspects = getDefaultAspects()
  const get = (id: string) => aspects.find(a => a.id === id)!

  it('sd-missing-scale: perfect score when every V. has a scale', () => {
    const ev = get('sd-missing-scale').evaluate(ctx({
      spec: spec({ values: [v('V.A', { scale: 'visits/day' }), v('V.B', { scale: 'pct' })] }),
    }))
    expect(ev.score).toBe(1)
  })

  it('sd-missing-scale: catastrophic score when no V. has a scale', () => {
    const ev = get('sd-missing-scale').evaluate(ctx({
      spec: spec({ values: [v('V.A'), v('V.B')] }),
    }))
    expect(ev.score).toBe(-1)
    expect(ev.findings).toEqual(['V.A', 'V.B'])
  })

  it('sd-missing-scale: neutral (+1) score when there are no V. at all', () => {
    // countBadFraction returns 1 when total=0 → ratioToScore(1) = 1
    const ev = get('sd-missing-scale').evaluate(ctx({ spec: spec() }))
    expect(ev.score).toBe(1)
  })

  it('sd-duplicate-ids: detects duplicates across F./V./S.', () => {
    const ev = get('sd-duplicate-ids').evaluate(ctx({
      spec: spec({
        functions: [f('X.1')],
        values: [v('X.1'), v('V.B')],
        solutions: [s('V.B')],
      }),
    }))
    expect(ev.findings?.sort()).toEqual(['V.B', 'X.1'])
    expect(ev.score).toBeLessThan(1)
  })
})

describe('Default aspects — Inconsistencies', () => {
  const get = (id: string) => getDefaultAspects().find(a => a.id === id)!

  it('ic-orphan-solutions: flags S. that reference V. that don\'t exist', () => {
    const ev = get('ic-orphan-solutions').evaluate(ctx({
      spec: spec({
        values: [v('V.Real')],
        solutions: [s('S.Good', { impact: 'V.Real ~70%' }), s('S.Bad', { impact: 'V.Ghost ~50%' })],
      }),
    }))
    expect(ev.findings).toEqual(['S.Bad'])
    expect(ev.score).toBe(0) // 1 of 2 bad → score 0
  })

  it('ic-stale-status: flags V. whose Status already exceeds Goal', () => {
    const ev = get('ic-stale-status').evaluate(ctx({
      spec: spec({
        values: [
          v('V.Past',   { status: 'Status [2026-Q2] 120 visits/day', goal: 'Goal [2026] 100 visits/day' }),
          v('V.OnPlan', { status: 'Status [2026-Q2] 80 visits/day',  goal: 'Goal [2026] 100 visits/day' }),
        ],
      }),
    }))
    expect(ev.findings).toEqual(['V.Past'])
  })
})

describe('Default aspects — Rule Violations', () => {
  const get = (id: string) => getDefaultAspects().find(a => a.id === id)!

  it('rv-no-plan-owner: -1 when missing, +1 when present', () => {
    expect(get('rv-no-plan-owner').evaluate(ctx({ hasPlanOwner: false })).score).toBe(-1)
    expect(get('rv-no-plan-owner').evaluate(ctx({ hasPlanOwner: true })).score).toBe(1)
  })

  it('rv-no-spec-owners: scales 0→-1, 1→0, 3+→+1', () => {
    expect(get('rv-no-spec-owners').evaluate(ctx({ specOwnerCount: 0 })).score).toBe(-1)
    expect(get('rv-no-spec-owners').evaluate(ctx({ specOwnerCount: 1 })).score).toBe(0)
    expect(get('rv-no-spec-owners').evaluate(ctx({ specOwnerCount: 3 })).score).toBe(1)
    expect(get('rv-no-spec-owners').evaluate(ctx({ specOwnerCount: 5 })).score).toBe(1)
  })
})

describe('Default aspects — Unknowns', () => {
  const get = (id: string) => getDefaultAspects().find(a => a.id === id)!

  it('uk-tbd-tokens: detects TBD/TODO/??? markers', () => {
    const ev = get('uk-tbd-tokens').evaluate(ctx({
      spec: spec({
        functions: [f('F.A', { description: 'do TBD eventually' })],
        values: [v('V.A', { description: 'fine', goal: 'TODO calibrate' })],
      }),
    }))
    expect(ev.score).toBeLessThan(1)
  })

  it('uk-wish-no-stakeholder: only counts Wish entries that lack stakeholder', () => {
    const ev = get('uk-wish-no-stakeholder').evaluate(ctx({
      spec: spec({
        values: [
          v('V.HasBoth', { wish: 'Best in class', wishStakeholder: 'CEO' }),
          v('V.OrphanWish', { wish: 'Big' }), // no stakeholder
          v('V.NoWish'), // not counted
        ],
      }),
    }))
    expect(ev.findings).toEqual(['V.OrphanWish'])
  })
})

describe('Default aspects — Risks & Coverage', () => {
  const get = (id: string) => getDefaultAspects().find(a => a.id === id)!

  it('rk-solution-monoculture: V. with only 1 S. is a fallback risk', () => {
    const ev = get('rk-solution-monoculture').evaluate(ctx({
      spec: spec({
        values: [v('V.Lonely'), v('V.Covered')],
        solutions: [s('S.A', { impact: 'V.Lonely ~50%' }),
                    s('S.B', { impact: 'V.Covered ~70%' }),
                    s('S.C', { impact: 'V.Covered ~30%' })],
      }),
    }))
    expect(ev.findings).toEqual(['V.Lonely'])
  })

  it('cv-v-with-s: orphan V. with no S. linkage', () => {
    const ev = get('cv-v-with-s').evaluate(ctx({
      spec: spec({
        values: [v('V.Linked'), v('V.Orphan')],
        solutions: [s('S.A', { impact: 'V.Linked ~70%' })],
      }),
    }))
    expect(ev.findings).toEqual(['V.Orphan'])
  })

  it('cv-f-with-v: F. with no V. that references it', () => {
    const ev = get('cv-f-with-v').evaluate(ctx({
      spec: spec({
        functions: [f('F.Used'), f('F.Orphan')],
        values: [v('V.A', { valueOfFunction: 'F.Used' })],
      }),
    }))
    expect(ev.findings).toEqual(['F.Orphan'])
  })
})

// ── computeBreakdown / planHealthIndex / groupIndex aggregation ─────────────

describe('computeBreakdown aggregation', () => {
  it('returns a -100..+100 index for a perfect spec', () => {
    const perfect = ctx({
      hasPlanOwner: true, specOwnerCount: 5,
      spec: spec({
        functions: [f('F.A')],
        values: [v('V.A', {
          scale: 'visits/day', meter: 'GA', goal: 'Goal [2026] 100',
          status: 'Status [2026-Q2] 50', valueOfFunction: 'F.A',
          wish: 'big', wishStakeholder: 'CEO',
        })],
        solutions: [
          s('S.A', { impact: 'V.A ~50%' }),
          s('S.B', { impact: 'V.A ~30%' }),
        ],
      }),
    })
    const ph = useSpecHealth('ph-test-perfect')
    const breakdown = ph.computeBreakdown(perfect)
    expect(breakdown.index).toBeGreaterThanOrEqual(40)
    expect(breakdown.index).toBeLessThanOrEqual(100)
    expect(breakdown.groups.length).toBeGreaterThan(0)
  })

  it('returns a deeply negative index for a catastrophic spec', () => {
    const cata = ctx({
      hasPlanOwner: false, specOwnerCount: 0,
      spec: spec({
        values: [v('V.A'), v('V.B')], // no scale, meter, goal, etc
        solutions: [s('S.X', { impact: 'V.NotReal ~50%' })],
      }),
    })
    const ph = useSpecHealth('ph-test-cata')
    const idx = ph.planHealthIndex(cata)
    expect(idx).toBeLessThan(0)
  })

  it('groupIndex matches the corresponding row in computeBreakdown', () => {
    const c = ctx({ hasPlanOwner: true, specOwnerCount: 2 })
    const ph = useSpecHealth('ph-test-group-index')
    const breakdown = ph.computeBreakdown(c)
    const target = breakdown.groups.find(g => g.groupId === 'rule-violations')!
    expect(ph.groupIndex('rule-violations', c)).toBe(target.groupIndex)
  })
})

// ── Mutations + reason-log audit ────────────────────────────────────────────

describe('Mutations always log a ReasonEntry', () => {
  it('setAspectWeight records before/after and reason', () => {
    const id = `ph-test-mut-w-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setAspectWeight('sd-missing-scale', 0.7, 'kai@example.com', 'rebalancing toward defects')
    const entry = ph.custom.value.reasonLog.at(-1)!
    expect(entry.action).toBe('weight-change')
    expect(entry.target).toBe('sd-missing-scale')
    expect(entry.after).toBe(0.7)
    expect(entry.by).toBe('kai@example.com')
    expect(entry.reason).toMatch(/rebalancing/)
    expect(ph.custom.value.aspectOverrides.find(o => o.aspectId === 'sd-missing-scale')?.weight).toBe(0.7)
  })

  it('setAspectDisabled toggles + logs both directions', () => {
    const id = `ph-test-mut-d-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setAspectDisabled('sd-duplicate-ids', true, 'kai', 'noisy in early plans')
    expect(ph.custom.value.reasonLog.at(-1)?.action).toBe('aspect-disable')
    ph.setAspectDisabled('sd-duplicate-ids', false, 'kai', 're-enable for review')
    expect(ph.custom.value.reasonLog.at(-1)?.action).toBe('aspect-enable')
  })

  it('setGroupWeight + setGroupDisabled both log', () => {
    const id = `ph-test-mut-g-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setGroupWeight('risks', 0.25, 'kai', 'risk-heavy phase')
    expect(ph.custom.value.reasonLog.at(-1)?.action).toBe('group-weight-change')
    ph.setGroupDisabled('coverage', true, 'kai', 'not relevant yet')
    expect(ph.custom.value.reasonLog.at(-1)?.action).toBe('group-disable')
  })

  it('setThreshold updates value + logs', () => {
    const id = `ph-test-mut-t-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setThreshold(35, 'kai', 'tighter alarm')
    expect(ph.custom.value.threshold).toBe(35)
    expect(ph.custom.value.reasonLog.at(-1)?.action).toBe('threshold-change')
    expect(ph.custom.value.reasonLog.at(-1)?.before).toBe(50)
    expect(ph.custom.value.reasonLog.at(-1)?.after).toBe(35)
  })

  it('addCustomAspect + removeCustomAspect log + appear in allAspects', () => {
    const id = `ph-test-mut-c-${Date.now()}`
    const ph = useSpecHealth(id)
    const aspectId = ph.addCustomAspect({
      name: 'Live demo readiness', description: 'Are we demo-ready?',
      group: 'risks', defaultWeight: 0.2,
      manualScore: 0.5, manualDetail: 'Most flows demo cleanly',
      by: 'kai', reason: 'Audience asked',
    })
    expect(aspectId).toMatch(/^custom-/)
    expect(ph.custom.value.reasonLog.at(-1)?.action).toBe('aspect-add')
    expect(ph.allAspects().some(a => a.id === aspectId)).toBe(true)

    ph.removeCustomAspect(aspectId, 'kai', 'Demo over')
    expect(ph.custom.value.reasonLog.at(-1)?.action).toBe('aspect-remove')
    expect(ph.allAspects().some(a => a.id === aspectId)).toBe(false)
  })
})

// ── Per-plan store isolation ────────────────────────────────────────────────

describe('Per-plan store isolation', () => {
  it('weight changes on plan A do not leak into plan B', () => {
    const phA = useSpecHealth('ph-iso-A')
    const phB = useSpecHealth('ph-iso-B')
    phA.setAspectWeight('sd-missing-scale', 0.9, 'kai', 'A only')
    expect(phA.custom.value.aspectOverrides.length).toBe(1)
    expect(phB.custom.value.aspectOverrides.length).toBe(0)
  })
})

// ── Feature #202.b: snapshots, admin spec, notifications ────────────────────

describe('Snapshots — recordSnapshot + history', () => {
  it('appends a snapshot capturing overall PHI + per-group + per-aspect', () => {
    const id = `ph-snap-basic-${Date.now()}`
    const ph = useSpecHealth(id)
    const c = ctx({ hasPlanOwner: true, specOwnerCount: 2 })
    const snap = ph.recordSnapshot(c, { trigger: 'inception', planVersion: 'v0.1', versionLabel: 'Generated' })
    expect(snap.trigger).toBe('inception')
    expect(snap.planVersion).toBe('v0.1')
    expect(typeof snap.index).toBe('number')
    // Group indices captured for every active group
    expect(Object.keys(snap.groupIndices).length).toBeGreaterThan(0)
    // Aspect scores captured
    expect(Object.keys(snap.aspectScores).length).toBeGreaterThan(0)
    expect(ph.custom.value.snapshots.length).toBe(1)
  })

  it('is idempotent for version-bump triggers with the same planVersion', () => {
    const id = `ph-snap-idem-${Date.now()}`
    const ph = useSpecHealth(id)
    const c = ctx({ hasPlanOwner: true, specOwnerCount: 2 })
    ph.recordSnapshot(c, { trigger: 'inception', planVersion: 'v0.1' })
    ph.recordSnapshot(c, { trigger: 'version-bump', planVersion: 'v0.2' })
    ph.recordSnapshot(c, { trigger: 'version-bump', planVersion: 'v0.2' }) // duplicate
    expect(ph.custom.value.snapshots.length).toBe(2)
    // The duplicate replaces in-place so the planVersion is still v0.2 once
    expect(ph.custom.value.snapshots.map(s => s.planVersion)).toEqual(['v0.1', 'v0.2'])
  })

  it('respects maxSnapshots retention cap', () => {
    const id = `ph-snap-cap-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setAdminSpec({ maxSnapshots: 3 }, 'kai', 'tight cap for test')
    const c = ctx({ hasPlanOwner: true, specOwnerCount: 2 })
    for (let i = 0; i < 6; i++) {
      ph.recordSnapshot(c, { trigger: 'manual', planVersion: `v0.${i}` })
    }
    expect(ph.custom.value.snapshots.length).toBe(3)
    // Oldest dropped — newest 3 remain (v0.3, v0.4, v0.5)
    expect(ph.custom.value.snapshots.map(s => s.planVersion)).toEqual(['v0.3', 'v0.4', 'v0.5'])
  })

  it('clearSnapshots wipes history and logs the reason', () => {
    const id = `ph-snap-clear-${Date.now()}`
    const ph = useSpecHealth(id)
    const c = ctx({ hasPlanOwner: true, specOwnerCount: 2 })
    ph.recordSnapshot(c, { trigger: 'manual', planVersion: 'v0.1' })
    ph.recordSnapshot(c, { trigger: 'manual', planVersion: 'v0.2' })
    expect(ph.custom.value.snapshots.length).toBe(2)
    ph.clearSnapshots('kai', 'starting fresh after Replan')
    expect(ph.custom.value.snapshots.length).toBe(0)
    const last = ph.custom.value.reasonLog.at(-1)!
    expect(last.target).toBe('all-snapshots')
    expect(last.before).toBe(2)
    expect(last.after).toBe(0)
  })
})

describe('Drop-detection notifications', () => {
  // Build a "good" and "bad" context to force a clear PHI delta
  const goodCtx = ctx({
    hasPlanOwner: true, specOwnerCount: 5,
    spec: spec({
      values: [v('V.A', { scale: 'visits/day', meter: 'GA', goal: 'Goal [2026] 100', status: 'Status [2026-Q2] 50', wish: 'big', wishStakeholder: 'CEO', valueOfFunction: 'F.A' })],
      functions: [f('F.A')],
      solutions: [s('S.A', { impact: 'V.A ~50%' }), s('S.B', { impact: 'V.A ~30%' })],
    }),
  })
  const badCtx = ctx({
    hasPlanOwner: false, specOwnerCount: 0,
    spec: spec({ values: [v('V.A'), v('V.B')], solutions: [s('S.X', { impact: 'V.NotReal ~10%' })] }),
  })

  it('fires a "drop" notification when PHI falls by ≥ dropThresholdPct', () => {
    const id = `ph-drop-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setAdminSpec({ dropThresholdPct: 5 }, 'kai', 'default 5%')
    const a = ph.recordSnapshot(goodCtx, { trigger: 'version-bump', planVersion: 'v0.1' })
    const b = ph.recordSnapshot(badCtx, { trigger: 'version-bump', planVersion: 'v0.2' })
    expect(b.index).toBeLessThan(a.index)
    const notes = ph.pendingNotifications.value
    expect(notes.length).toBeGreaterThanOrEqual(1)
    const drop = notes.find(n => n.kind === 'drop')!
    expect(drop).toBeDefined()
    expect(drop.fromIndex).toBe(a.index)
    expect(drop.toIndex).toBe(b.index)
    expect(drop.headline).toMatch(/dropped/)
  })

  it('fires no notification when PHI changes by less than the threshold', () => {
    const id = `ph-no-drop-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setAdminSpec({ dropThresholdPct: 50 }, 'kai', 'wide threshold so small wiggles do not fire')
    ph.recordSnapshot(goodCtx, { trigger: 'version-bump', planVersion: 'v0.1' })
    ph.recordSnapshot(goodCtx, { trigger: 'version-bump', planVersion: 'v0.2' })
    expect(ph.pendingNotifications.value.length).toBe(0)
  })

  it('respects notifyOnDrop=false (master mute)', () => {
    const id = `ph-mute-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setAdminSpec({ notifyOnDrop: false, dropThresholdPct: 5 }, 'kai', 'mute everything')
    ph.recordSnapshot(goodCtx, { trigger: 'version-bump', planVersion: 'v0.1' })
    ph.recordSnapshot(badCtx, { trigger: 'version-bump', planVersion: 'v0.2' })
    expect(ph.pendingNotifications.value.length).toBe(0)
  })

  it('respects notifyFrequency=never', () => {
    const id = `ph-never-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setAdminSpec({ notifyFrequency: 'never' }, 'kai', 'mute via frequency')
    ph.recordSnapshot(goodCtx, { trigger: 'version-bump', planVersion: 'v0.1' })
    ph.recordSnapshot(badCtx, { trigger: 'version-bump', planVersion: 'v0.2' })
    expect(ph.pendingNotifications.value.length).toBe(0)
  })

  it('fires an "inception" notification on the very first snapshot', () => {
    const id = `ph-inception-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.recordSnapshot(goodCtx, { trigger: 'inception', planVersion: 'v0.1' })
    const notes = ph.pendingNotifications.value
    expect(notes.length).toBe(1)
    expect(notes[0].kind).toBe('inception')
    expect(notes[0].headline).toMatch(/baseline/)
  })

  it('dismissNotification + dismissAllNotifications work', () => {
    const id = `ph-dismiss-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.recordSnapshot(goodCtx, { trigger: 'inception', planVersion: 'v0.1' })
    ph.recordSnapshot(badCtx, { trigger: 'version-bump', planVersion: 'v0.2' })
    const before = ph.pendingNotifications.value
    expect(before.length).toBeGreaterThanOrEqual(1)
    ph.dismissNotification(before[0].id)
    expect(ph.pendingNotifications.value.length).toBe(before.length - 1)
    ph.dismissAllNotifications()
    expect(ph.pendingNotifications.value.length).toBe(0)
  })
})

describe('Admin spec — defaults + setAdminSpec', () => {
  it('seeds sensible defaults: notifyOnDrop=true, dropThreshold=5, autoSnap=on, retention=200', () => {
    const id = `ph-admin-defaults-${Date.now()}`
    const ph = useSpecHealth(id)
    const a = ph.custom.value.admin
    expect(a.notifyOnDrop).toBe(true)
    expect(a.dropThresholdPct).toBe(5)
    expect(a.notifyFrequency).toBe('realtime')
    expect(a.notifyChannels.inApp).toBe(true)
    expect(a.autoSnapshotOnVersionBump).toBe(true)
    expect(a.maxSnapshots).toBe(200)
    expect(a.notifyOwnerIds).toEqual([])
  })

  it('setAdminSpec patches partially and preserves channels', () => {
    const id = `ph-admin-patch-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setAdminSpec({ dropThresholdPct: 12, notifyChannels: { email: true } }, 'kai', 'wider band + email on')
    const a = ph.custom.value.admin
    expect(a.dropThresholdPct).toBe(12)
    expect(a.notifyChannels.email).toBe(true)
    expect(a.notifyChannels.inApp).toBe(true) // preserved
    // Logged
    const last = ph.custom.value.reasonLog.at(-1)!
    expect(last.target).toBe('admin-spec')
    expect(last.reason).toMatch(/wider band/)
  })

  it('setNotifyOwner toggles owner ids correctly', () => {
    const id = `ph-admin-owners-${Date.now()}`
    const ph = useSpecHealth(id)
    ph.setNotifyOwner('owner-1', true, 'kai', 'opt-in owner-1')
    expect(ph.custom.value.admin.notifyOwnerIds).toEqual(['owner-1'])
    ph.setNotifyOwner('owner-2', true, 'kai', 'add owner-2')
    expect(ph.custom.value.admin.notifyOwnerIds.sort()).toEqual(['owner-1', 'owner-2'])
    ph.setNotifyOwner('owner-1', false, 'kai', 'remove owner-1')
    expect(ph.custom.value.admin.notifyOwnerIds).toEqual(['owner-2'])
  })
})

describe('Backwards-compat — fresh plan id always returns full defaults', () => {
  it('returns admin / snapshots / notifications for a never-touched plan id', () => {
    // The migration helper _normalize() back-fills missing fields. The
    // public-API guarantee is: useSpecHealth(<unknown id>) hands back a
    // record where every documented field is non-undefined.
    const ph = useSpecHealth(`ph-fresh-${Date.now()}`)
    const c = ph.custom.value
    expect(c.admin).toBeDefined()
    expect(c.admin.dropThresholdPct).toBe(5)
    expect(c.admin.notifyOnDrop).toBe(true)
    expect(c.admin.notifyChannels.inApp).toBe(true)
    expect(c.snapshots).toEqual([])
    expect(c.notifications).toEqual([])
    expect(c.aspectOverrides).toEqual([])
    expect(c.threshold).toBe(50)
  })
})

// ── Plan Defects auto-fix taxonomy (Feature: Plan Defects Panel, Step 1+2) ──

describe('AspectFix taxonomy — every built-in aspect declares a fix kind', () => {
  const aspects = getDefaultAspects()
  for (const a of aspects) {
    it(`aspect "${a.id}" declares a fix.kind`, () => {
      expect(a.fix).toBeDefined()
      expect(['deterministic', 'ai', 'manual']).toContain(a.fix!.kind)
      expect(a.fix!.description.length).toBeGreaterThan(0)
    })
  }

  it('deterministic-kind aspects ALSO export applyDeterministic; ai/manual do NOT', () => {
    for (const a of aspects) {
      if (a.fix!.kind === 'deterministic') {
        expect(typeof a.fix!.applyDeterministic).toBe('function')
      } else {
        expect(a.fix!.applyDeterministic).toBeUndefined()
      }
    }
  })

  it('the deterministic bucket contains at least one aspect (sd-duplicate-ids)', () => {
    const det = aspects.filter(a => a.fix?.kind === 'deterministic')
    expect(det.length).toBeGreaterThanOrEqual(1)
    expect(det.map(a => a.id)).toContain('sd-duplicate-ids')
  })
})

describe('sd-duplicate-ids deterministic fix', () => {
  const dupAspect = getDefaultAspects().find(a => a.id === 'sd-duplicate-ids')!

  it('renames second occurrence to "<id> (2)" leaving the first intact', () => {
    const sb = spec({ functions: [f('F.Foo'), f('F.Foo')] })
    const patch = dupAspect.fix!.applyDeterministic!(ctx({ spec: sb }), 'F.Foo')
    expect(patch).toHaveLength(1)
    expect(patch[0]).toMatchObject({
      kind: 'rename-id', entryType: 'F', oldId: 'F.Foo', newId: 'F.Foo (2)',
    })
  })

  it('renames third + fourth occurrences to "(3)" and "(4)"', () => {
    const sb = spec({ values: [v('V.X'), v('V.X'), v('V.X'), v('V.X')] })
    const patch = dupAspect.fix!.applyDeterministic!(ctx({ spec: sb }), 'V.X')
    expect(patch).toHaveLength(3)
    expect(patch[0]).toMatchObject({ entryType: 'V', oldId: 'V.X', newId: 'V.X (2)' })
    expect(patch[1]).toMatchObject({ entryType: 'V', oldId: 'V.X', newId: 'V.X (3)' })
    expect(patch[2]).toMatchObject({ entryType: 'V', oldId: 'V.X', newId: 'V.X (4)' })
  })

  it('returns an empty patch when the finding has no duplicates', () => {
    const sb = spec({ functions: [f('F.Foo')] })
    const patch = dupAspect.fix!.applyDeterministic!(ctx({ spec: sb }), 'F.Foo')
    expect(patch).toEqual([])
  })

  it('handles dup ids across different entry types independently (F.Foo and V.Foo are NOT dupes)', () => {
    const sb = spec({ functions: [f('Foo')], values: [v('Foo')] })
    // The dedup evaluator treats them as a duplicate because it dedups by raw string.
    // applyDeterministic should still only rename within the type bucket where
    // multiple matches exist; in this case there's exactly one of each, so
    // nothing to rename.
    const patch = dupAspect.fix!.applyDeterministic!(ctx({ spec: sb }), 'Foo')
    expect(patch).toEqual([])
  })
})

describe('applySpecPatch helper', () => {
  it('returns the original SpecBlock reference when patch is empty', () => {
    const sb = spec({ values: [v('V.A')] })
    const out = applySpecPatch(sb, [])
    expect(out).toBe(sb)
  })

  it('applies a rename-id op and leaves untouched entries un-cloned', () => {
    const sb = spec({ functions: [f('F.Keep'), f('F.Old')] })
    const patch: SpecPatch = [
      { kind: 'rename-id', entryType: 'F', oldId: 'F.Old', newId: 'F.New' },
    ]
    const out = applySpecPatch(sb, patch)
    expect(out.functions[0].id).toBe('F.Keep')
    expect(out.functions[1].id).toBe('F.New')
    // Identity check on the untouched entry — the patch helper clones the
    // touched entry but should NOT clone unaffected entries.
    expect(out.functions[0]).toBe(sb.functions[0])
  })

  it('applies a set-field op against a V. entry', () => {
    const sb = spec({ values: [v('V.A')] })
    const patch: SpecPatch = [
      { kind: 'set-field', entryType: 'V', entryId: 'V.A', field: 'meter', value: 'Net Promoter Score, monthly' },
    ]
    const out = applySpecPatch(sb, patch)
    expect(out.values[0].meter).toBe('Net Promoter Score, monthly')
    expect(out.values[0].id).toBe('V.A')
  })

  it('silently no-ops when targetId does not exist (bad finding)', () => {
    const sb = spec({ values: [v('V.A')] })
    const patch: SpecPatch = [
      { kind: 'set-field', entryType: 'V', entryId: 'V.Missing', field: 'meter', value: 'x' },
    ]
    const out = applySpecPatch(sb, patch)
    expect(out.values[0].meter).toBe('')
  })

  it('applies a chain of mixed ops in order (rename + set-field on same entry)', () => {
    const sb = spec({ solutions: [s('S.Foo')] })
    const patch: SpecPatch = [
      { kind: 'rename-id',  entryType: 'S', oldId: 'S.Foo', newId: 'S.Bar' },
      { kind: 'set-field',  entryType: 'S', entryId: 'S.Bar', field: 'impact', value: 'V.X ~50%' },
    ]
    const out = applySpecPatch(sb, patch)
    expect(out.solutions[0].id).toBe('S.Bar')
    expect(out.solutions[0].impact).toBe('V.X ~50%')
  })
})
