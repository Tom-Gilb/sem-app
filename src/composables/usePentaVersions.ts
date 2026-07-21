// UNIT_TYPE=Composable
// usePentaVersions.ts — Version Governance + Consequence Cascade for the Penta panel.
//
// Tom Gilb requirement (2026-06-08):
//   "Save the Version, Get Approval, Decide to Update the Master, Or Not...
//    We also need to deal with Cascading Changes: if a Value Changes, then Solutions
//    (usually, not always) need to Change to deliver the New Value or New Value Levels."
//
// Per Claude-Code-as-AI-Layer rule: cascade detection is DETERMINISTIC (no API calls).
// AI-assisted cascade analysis is Phase 2 (clipboard prompt + paste-back pattern).

import { ref, watch, type Ref } from 'vue'
import type { SpecBlock } from '../types/spec'
import type {
  PentaFieldChange,
  PentaVersion,
  CascadeImpact,
} from '../types/pentaGovernance'

const VER_STORAGE_KEY = (planId: string) => `penta-versions:${planId || 'default'}`

export function usePentaVersions(planId: Ref<string>) {

  // ── Pending changes (tracked since last saved version) ──────────────────────
  const pendingChanges = ref<PentaFieldChange[]>([])

  // ── Version history ─────────────────────────────────────────────────────────
  const versions = ref<PentaVersion[]>(loadVersions(planId.value))

  watch(() => planId.value, (id) => { versions.value = loadVersions(id) })
  watch(versions, (v) => persist(planId.value, v), { deep: true })

  function loadVersions(id: string): PentaVersion[] {
    try {
      const raw = localStorage.getItem(VER_STORAGE_KEY(id))
      return raw ? (JSON.parse(raw) as PentaVersion[]) : []
    } catch {
      return []
    }
  }

  function persist(id: string, v: PentaVersion[]): void {
    try {
      localStorage.setItem(VER_STORAGE_KEY(id), JSON.stringify(v))
    } catch {
      // localStorage unavailable — silently degrade
    }
  }

  // ── Track a field change (called BEFORE emitting update-spec) ───────────────
  function trackChange(change: Omit<PentaFieldChange, 'id' | 'changedAt'>): void {
    pendingChanges.value.push({
      ...change,
      id: crypto.randomUUID(),
      changedAt: new Date().toISOString(),
    })
  }

  // ── Cascade impact detection (deterministic, no AI) ─────────────────────────
  //
  // Cascade logic (Planguage semantics, Tom Gilb 2026-06-08):
  //   Direct:    Value Goal/Tolerable changes → ALL Solutions potentially need redesign
  //              (Solutions exist to deliver Values; if the Value target moves,
  //               the design may need to adapt)
  //   2nd-order: If Solutions need redesign → Resource costs change
  //              (Different design approach = different time/money/people)
  //   nth-order: If Resources change → other Values' delivery may be affected
  //              (Resource constraints ripple across all Values)
  //
  // Confidence: HIGH if Solution description contains Value keywords; MEDIUM otherwise
  // (all Solutions flagged as potentially impacted — Planguage: declare uncertainty explicitly).
  function detectCascadeImpacts(changes: PentaFieldChange[], spec: SpecBlock): CascadeImpact[] {
    const impacts: CascadeImpact[] = []

    // r93l (Tom Gilb 2026-06-11 "i got kicked out prematurely from changing the budget by one
    // digit"). Deterministic impact IDs — every keystroke previously regenerated the impacts
    // array with `crypto.randomUUID()` for each row, so Vue's `:key="impact.id"` saw all-new
    // keys and unmounted+remounted every CascadeImpactTable row. The DOM mutation kicked
    // Safari's focus off the Budget input mid-typing. Deterministic key from cause + field +
    // effect + order means re-running detectCascadeImpacts on the same inputs returns IDENTICAL
    // ids, so Vue patches existing rows in place. Input keeps focus. No keystroke loss.
    const stableId = (
      causeId: string, field: string, effectId: string, order: string,
    ): string => `cascade|${causeId}|${field}|${effectId}|${order}`

    for (const change of changes) {
      if (
        change.itemType === 'value' &&
        (
          change.field === 'goal'      ||
          change.field === 'tolerable' ||
          change.field === 'status'    ||
          // Tom Gilb 2026-06-10: "when I change a wish or a resource or a deadline, it has
          //   consequences in other specs" — Wish is the aspirational ceiling; solutions aiming
          //   for wish-level delivery must re-evaluate when the target moves.
          change.field === 'wish'      ||
          // Scale change is the most severe cascade: the measurement UNIT has changed,
          // which means ALL numeric levels (Tolerable/Goal/Wish/Status) now mean something
          // fundamentally different. Every solution delivering this value needs re-evaluation.
          change.field === 'scale'     ||
          // Meter change alters how Status is measured; historical Status records may be
          // incompatible with the new meter definition.
          change.field === 'meter'
        )
      ) {
        const valueKeywords = change.itemLabel
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3)
        const solutions = spec.solutions ?? []

        // Scale-change severity label — scale/meter are unit-system changes, not just level shifts
        const isUnitChange = change.field === 'scale' || change.field === 'meter'

        // Direct: Value commitment-level or unit change → Solutions
        for (const s of solutions) {
          const descLower = (s.description ?? '').toLowerCase()
          const mentionsValue = valueKeywords.some((kw) => descLower.includes(kw))
          const wishNote = change.field === 'wish'
            ? `Wish is the aspirational ceiling — solutions aiming for wish-level delivery of "${change.itemLabel}" must check the new aspiration (${change.before || '—'} → ${change.after}).`
            : ''
          const scaleNote = isUnitChange
            ? `UNIT CHANGE — ${change.field} for "${change.itemLabel}" changed from "${change.before || '—'}" to "${change.after}". ALL numeric levels (Tolerable/Goal/Wish/Status) now mean something different. This solution must be re-evaluated against the new measurement system.`
            : ''
          impacts.push({
            id: stableId(change.itemId, change.field, s.id, 'direct'),
            order: 'direct',
            causeItemId: change.itemId,
            causeItemLabel: change.itemLabel,  // r41 v234 — Tag fix
            causeField: change.field,
            effectItemId: s.id,
            effectItemType: 'Solution',
            effectItemLabel: s.description ?? s.id,
            relationship: 'delivers',
            impactDescription: scaleNote || wishNote || (mentionsValue
              ? `Solution "${s.id}" appears to directly deliver "${change.itemLabel}" — the new ${change.field} (${change.before} → ${change.after}) may require this solution to be redesigned.`
              : `Solution "${s.id}" may need to be re-evaluated: its delivery approach may not achieve the new ${change.field} level (${change.before} → ${change.after}) for "${change.itemLabel}".`),
            status: 'unanalyzed',
          })
        }

        // 2nd-order: Value → Solutions → Resources (cost cascade)
        const resources = spec.resources ?? []
        if (solutions.length > 0 && resources.length > 0) {
          for (const r of resources) {
            impacts.push({
              id: stableId(change.itemId, change.field, r.id, '2nd-order'),
              order: '2nd-order',
              causeItemId: change.itemId,
              causeItemLabel: change.itemLabel,  // r41 v234 — Tag fix
              causeField: change.field,
              effectItemId: r.id,
              effectItemType: 'Resource',
              effectItemLabel: r.description ?? r.id,
              relationship: 'costs',
              impactDescription: `2nd-order effect: if Solutions change to deliver the new "${change.itemLabel}" ${change.field}, the cost of Resource "${r.id}" (${r.description ?? ''}) may change. Current budget: ${r.budget ?? r.goal ?? '—'}.`,
              status: 'unanalyzed',
            })
          }
        }
      }

      if (change.itemType === 'resource' && change.field === 'budget') {
        // Resource Budget changed → Solutions depending on it may be constrained
        const solutions = spec.solutions ?? []
        const resKeywords = change.itemLabel
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3)
        for (const s of solutions) {
          const descLower = (s.description ?? '').toLowerCase()
          const mentionsResource = resKeywords.some((kw) => descLower.includes(kw))
          if (mentionsResource) {
            impacts.push({
              id: stableId(change.itemId, change.field, s.id, 'direct'),
              order: 'direct',
              causeItemId: change.itemId,
              causeField: change.field,
              effectItemId: s.id,
              effectItemType: 'Solution',
              effectItemLabel: s.description ?? s.id,
              relationship: 'constrained-by',
              impactDescription: `Solution "${s.id}" references resource "${change.itemLabel}" — the budget change (${change.before} → ${change.after}) may affect whether this solution is still feasible.`,
              status: 'unanalyzed',
            })
          }
        }

        // nth-order: resource budget change → Values may become undeliverable
        const values = spec.values ?? []
        for (const v of values) {
          impacts.push({
            id: stableId(change.itemId, change.field, v.id, 'nth-order'),
            order: 'nth-order',
            causeItemId: change.itemId,
            causeItemLabel: change.itemLabel,  // r41 v234 — Tag fix
            causeField: change.field,
            effectItemId: v.id,
            effectItemType: 'Value',
            effectItemLabel: v.description ?? v.id,
            relationship: 'may-constrain-delivery',
            impactDescription: `nth-order: Budget change to "${change.itemLabel}" (${change.before} → ${change.after}) may propagate to affect delivery of Value "${v.id}" if Solutions need to be descoped to meet the new resource constraint.`,
            status: 'unanalyzed',
          })
        }
      }
    }

    return impacts
  }

  // ── Save a named version ────────────────────────────────────────────────────
  function saveVersion(label: string, notes: string, spec: SpecBlock): PentaVersion {
    const impacts = detectCascadeImpacts(pendingChanges.value, spec)
    const version: PentaVersion = {
      id: crypto.randomUUID(),
      label: label.trim() || `Version ${versions.value.length + 1}`,
      notes: notes.trim(),
      savedAt: new Date().toISOString(),
      changes: [...pendingChanges.value],
      cascadeStatus: impacts.length === 0 ? 'complete' : 'not-analyzed',
      cascadeImpacts: impacts,
      specSnapshot: JSON.parse(JSON.stringify(spec)) as object,
      status: 'draft',
    }
    versions.value = [version, ...versions.value]
    pendingChanges.value = []
    return version
  }

  // ── Declare cascade not yet calculated ──────────────────────────────────────
  // Tom Gilb: "Declare that a Consequence Cascade has not yet been calculated.
  //  It could then at least list the probably or potentially impacted items."
  function declareCascadeNotCalculated(versionId: string): void {
    const v = versions.value.find((v) => v.id === versionId)
    if (!v) return
    v.cascadeStatus = 'declared-not-calculated'
    v.cascadeImpacts = v.cascadeImpacts.map((i) => ({
      ...i,
      status: i.status === 'unanalyzed' ? 'declared-not-calculated' : i.status,
    }))
  }

  // ── Approve a version ───────────────────────────────────────────────────────
  function approveVersion(versionId: string, approvedBy = 'Tom Gilb'): void {
    const v = versions.value.find((v) => v.id === versionId)
    if (!v) return
    v.status = 'approved'
    v.approvedBy = approvedBy
    v.approvedAt = new Date().toISOString()
  }

  // ── Reject a version ────────────────────────────────────────────────────────
  function rejectVersion(versionId: string): void {
    const v = versions.value.find((v) => v.id === versionId)
    if (!v) return
    v.status = 'rejected'
  }

  // ── Mark a version as integrated into the master plan ──────────────────────
  function integrateVersion(versionId: string): void {
    const v = versions.value.find((v) => v.id === versionId)
    if (!v) return
    v.status = 'integrated'
    v.integratedAt = new Date().toISOString()
  }

  // ── Delete a version ────────────────────────────────────────────────────────
  function deleteVersion(versionId: string): void {
    versions.value = versions.value.filter((v) => v.id !== versionId)
  }

  // ── Clear pending changes (discard) ────────────────────────────────────────
  function clearPending(): void {
    pendingChanges.value = []
  }

  // ── Update a cascade impact note ────────────────────────────────────────────
  function updateImpactNote(versionId: string, impactId: string, notes: string): void {
    const v = versions.value.find((v) => v.id === versionId)
    if (!v) return
    const impact = v.cascadeImpacts.find((i) => i.id === impactId)
    if (impact) impact.notes = notes
  }

  // ── Mark an individual cascade impact status ────────────────────────────────
  function setImpactStatus(
    versionId: string,
    impactId: string,
    status: CascadeImpact['status'],
  ): void {
    const v = versions.value.find((v) => v.id === versionId)
    if (!v) return
    const impact = v.cascadeImpacts.find((i) => i.id === impactId)
    if (!impact) return
    impact.status = status
    // Recalculate overall cascade status from all impact statuses
    const allStatuses = v.cascadeImpacts.map((i) => i.status)
    if (allStatuses.every((s) => s === 'no-impact' || s === 'change-applied')) {
      v.cascadeStatus = 'complete'
    } else if (allStatuses.some((s) => s !== 'unanalyzed')) {
      v.cascadeStatus = 'partial'
    }
  }

  return {
    pendingChanges,
    versions,
    trackChange,
    saveVersion,
    detectCascadeImpacts,
    declareCascadeNotCalculated,
    approveVersion,
    rejectVersion,
    integrateVersion,
    deleteVersion,
    clearPending,
    updateImpactNote,
    setImpactStatus,
  }
}
