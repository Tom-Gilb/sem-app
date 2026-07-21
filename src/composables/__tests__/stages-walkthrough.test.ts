// UNIT_TYPE=Test
// stages-walkthrough.test.ts — end-to-end smoke test of the 11-stage SEM cycle.
//
// Tom Gilb 2026-06-18 verbatim: "I am tired of several times a week having
// to push an example through the stages that skip ahead and do not function.
// Is it not possible you can develop a stages test to check if it moves as
// intended for the simplest of trial cases."
//
// This test answers Tom's pain: a small, fast vitest that walks a known
// Planguage-tagged fixture through the parse pipeline and asserts every
// stage's exit gate (`useStageGates`) passes.  If any stage silently
// produces empty / broken data, the test fails with a clear message
// naming the broken stage — BEFORE the bug ships to Tom.
//
// Fixture design:
//   • The fixture text uses canonical entry-type marker lines (e.g.
//     "F.Search Engine:" / "V.Search Latency:") so the local
//     deterministic parser handles it without an AI call.  This keeps the
//     test deterministic, free, fast, and CI-friendly (no API key
//     required, no LLM availability flake).
//   • Each entry type is represented at least once → exercises every
//     stage gate.
//   • Every mnemonic tag is a real-word name per the Planguage Mnemonic
//     Tag standard (Tom 2026-06-09) — never placeholder forms.
//
// What this test DOES catch:
//   • Parser regressions (the v189 `parseAsPlanguage` import bug would
//     have been caught here — the parse would have thrown a ReferenceError
//     before the test even reached the postcondition).
//   • Empty-spec advance bugs (a parse that silently produces 0 entries).
//   • Gate-definition drift (if a stage's postcondition changes, the
//     fixture's content needs to keep up — explicit failure surfaces it).
//
// What this test does NOT catch (logged for follow-up):
//   • UI rendering bugs (template wired to wrong data field).
//   • Async race conditions (LLM streaming, autosave timing).
//   • PDF / DOCX extraction failures (filesystem-level mocking needed).
//   • The AI-generation path for prose input (deliberately out of scope —
//     the test stays deterministic).

import { describe, it, expect } from 'vitest'
import { parseAsPlanguage } from '../useSpecInput'
import { STAGE_GATES, checkStageExit, checkStageEntry } from '../useStageGates'

// ── Fixture — the "simplest trial case" Tom asked for ──────────────────────
//
// A tiny plan with one Function, one Value, one Solution, one Constraint,
// and one Resource — enough to exercise every stage gate.  Real-world
// mnemonic tags (no V1/F1) per the Mnemonic Tag standard.

const SIMPLEST_TRIAL_FIXTURE = `
F.SearchEngine: presence test = user can submit a query and receive results
V.SearchLatency: scale = seconds from query submission to first result displayed
  tolerable = 5
  goal = 2
  wish = 0.5
S.IndexedCache: maintain an in-memory inverted index of the last 24 hours
  impact = V.SearchLatency goal
C.GDPRCompliance: all user queries must be processed within the EU
  scope = data residency
  rationale = European GDPR Article 44 cross-border transfer rules
R.MonthlyBudget: monthly engineering spend cap for the search team
  scale = USD per month
  tolerable = 200000
  goal = 150000
`.trim()

// ── The walk-through ──────────────────────────────────────────────────────

describe('SEM 11-stage walk-through — simplest trial case', () => {

  it('Stage 1 parser produces a non-null SpecBlock from the fixture', async () => {
    const spec = await parseAsPlanguage(SIMPLEST_TRIAL_FIXTURE)
    expect(spec).not.toBeNull()
    // The parse-import regression (v189 fix) would crash here with a
    // ReferenceError if `parseAsPlanguage` were not exported / imported.
    // If THIS expect fails, the entire planning workflow is broken.
  })

  it('Stage 1 spec carries one of each canonical entry type', async () => {
    const spec = await parseAsPlanguage(SIMPLEST_TRIAL_FIXTURE)
    expect(spec).not.toBeNull()
    if (!spec) return
    // The fixture has 1 of each — if ANY of these is zero, the parser
    // silently dropped that entry type.
    expect(spec.functions.length,   'spec.functions (F. entries) missing').toBeGreaterThanOrEqual(1)
    expect(spec.values.length,      'spec.values (V. entries) missing').toBeGreaterThanOrEqual(1)
    expect(spec.solutions.length,   'spec.solutions (S. entries) missing').toBeGreaterThanOrEqual(1)
    expect(spec.constraints?.length ?? 0, 'spec.constraints (C. entries) missing').toBeGreaterThanOrEqual(1)
    expect(spec.resources?.length ?? 0,   'spec.resources (R. entries) missing').toBeGreaterThanOrEqual(1)
  })

  it('Mnemonic Tags are real-world names (no V1/F1 placeholder leak)', async () => {
    const spec = await parseAsPlanguage(SIMPLEST_TRIAL_FIXTURE)
    if (!spec) throw new Error('spec is null')
    const allIds = [
      ...spec.functions.map(f => f.id),
      ...spec.values.map(v => v.id),
      ...spec.solutions.map(s => s.id),
      ...(spec.constraints ?? []).map(c => c.id),
      ...(spec.resources ?? []).map(r => r.id),
    ]
    for (const id of allIds) {
      // Banned formats from the Planguage Mnemonic ID Standard (Tom Gilb
      // 2026-06-09): no sequential numeric placeholders (V1, F1, S2, etc.),
      // no pure numbers, no dot-number forms (V.1, F.2).
      expect(id, `id "${id}" violates Mnemonic Tag standard (no sequential numbers)`).not.toMatch(/^[FVSCR]\.\d+$/)
      expect(id, `id "${id}" violates Mnemonic Tag standard (no letter+number)`).not.toMatch(/^[FVSCR]\d+$/)
    }
  })

  // One test per stage gate — clear failure message names the broken stage.
  for (const gate of STAGE_GATES) {
    it(`Stage ${gate.stage} (${gate.label}) gate passes for the simplest trial case`, async () => {
      const spec = await parseAsPlanguage(SIMPLEST_TRIAL_FIXTURE)
      const entryReason = checkStageEntry(gate.stage, spec)
      const exitReason  = checkStageExit (gate.stage, spec)
      // Bundle both reasons into the failure message so the test name
      // alone is enough to diagnose the broken stage.
      expect(
        entryReason,
        `Stage ${gate.stage} (${gate.label}) entry FAILED: ${entryReason ?? ''}`,
      ).toBeNull()
      expect(
        exitReason,
        `Stage ${gate.stage} (${gate.label}) exit FAILED: ${exitReason ?? ''}`,
      ).toBeNull()
    })
  }

  it('checkStageExit catches the empty-spec bug class', () => {
    // Sanity: an empty spec MUST fail Stage 2's gate (a primary
    // skip-ahead trigger Tom keeps hitting).
    const emptySpec = { functions: [], values: [], solutions: [], constraints: [], resources: [] }
    expect(checkStageExit(2, emptySpec)).not.toBeNull()
    expect(checkStageExit(3, emptySpec)).not.toBeNull()
    expect(checkStageExit(4, emptySpec)).not.toBeNull()
  })

  it('checkStageExit catches the null-spec bug class', () => {
    // Sanity: a null spec (parse crashed / returned null) MUST fail
    // every stage's gate — never silently advance.
    expect(checkStageExit(1, null)).not.toBeNull()
    expect(checkStageExit(2, null)).not.toBeNull()
    expect(checkStageExit(11, null)).not.toBeNull()
  })
})
