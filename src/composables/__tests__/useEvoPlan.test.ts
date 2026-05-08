// Spec: S.Evo7.EvoStepPlannerComposable
// Tests that useEvoPlan correctly manages reactive EvoStepPlan state and
// that all mutation actions (reorderSteps, renameStep, removeStep, confirmPlan)
// update state as specified.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEvoPlan } from '../useEvoPlan'
import type { EvoStepPlan } from '../../types/evo-plan'
import type { SpecBlock } from '../../types/spec'

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock useEvoPlannerAPI so tests control what plan is returned.
// mockApiError is a persistent ref-like object shared across test calls.
// Tests mutate mockApiError.value to simulate API errors propagating into the composable.
const mockPlanSteps = vi.fn()
const mockApiError = { value: '' }
vi.mock('../useEvoPlannerAPI', () => ({
  useEvoPlannerAPI: () => ({
    loading: { value: false },
    error: mockApiError,
    planSteps: mockPlanSteps,
  }),
}))

// Mock useWorkspace to provide a workspace id.
// workspaceOverride allows individual tests to inject null to test missing-workspace path.
let workspaceOverride: { id: string; name: string } | null = { id: 'ws-test-123', name: 'Test WS' }
vi.mock('../useWorkspace', () => ({
  useWorkspace: () => ({
    get currentWorkspace() { return { value: workspaceOverride } },
  }),
}))

// Mock the Supabase client
const mockUpsert = vi.fn()
const mockGetSession = vi.fn()
vi.mock('../../config/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({ upsert: mockUpsert }),
    auth: { getSession: mockGetSession },
  }),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SPEC_BLOCK: SpecBlock = {
  functions: [{ id: 'F.Test', type: 'Function', level: 'Product', description: 'd', successCriteria: 'sc', functionOfValue: 'V.Test' }],
  values: [{ id: 'V.Test', type: 'Value', level: 'Product', description: 'd', scale: 's', meter: 'm', status: 'st', tolerable: 't', goal: 'g', valueOfFunction: 'F.Test' }],
  solutions: [{ id: 'S.Test', type: 'Solution', level: 'Product', description: 'd', impact: 'V.Test ~50%', function: 'F.Test' }],
}

const THREE_STEP_PLAN: EvoStepPlan = {
  steps: [
    { name: 'S.Evo1.Alpha', description: 'First step', linkedValues: ['V.Test'], linkedSolution: 'S.Test', effortPercent: 30 },
    { name: 'S.Evo2.Beta',  description: 'Second step', linkedValues: ['V.Test'], linkedSolution: 'S.Test', effortPercent: 40 },
    { name: 'S.Evo3.Gamma', description: 'Third step',  linkedValues: ['V.Test'], linkedSolution: 'S.Test', effortPercent: 30 },
  ],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useEvoPlan', () => {
  beforeEach(() => {
    mockPlanSteps.mockReset()
    mockUpsert.mockReset()
    mockGetSession.mockReset()
    vi.stubEnv('VITE_MOCK_MODE', '')
    // Reset shared mutable state before each test
    mockApiError.value = ''
    workspaceOverride = { id: 'ws-test-123', name: 'Test WS' }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── fetchPlan ─────────────────────────────────────────────────────────────────

  describe('fetchPlan', () => {
    it('populates plan state after a successful API response', async () => {
      // Spec: S.Evo7.EvoStepPlannerComposable — plan ref is populated from API
      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)

      const { plan, fetchPlan } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      expect(plan.value).not.toBeNull()
      expect(plan.value!.steps).toHaveLength(3)
      expect(plan.value!.steps[0].name).toBe('S.Evo1.Alpha')
    })

    it('resets isConfirmed to false when fetchPlan is called again', async () => {
      // A re-fetch must reset confirmation — the new plan is unconfirmed
      mockPlanSteps.mockResolvedValue(THREE_STEP_PLAN)

      const { isConfirmed, confirmPlan, fetchPlan } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      // Confirm in mock mode for simplicity
      vi.stubEnv('VITE_MOCK_MODE', 'true')
      await confirmPlan()
      expect(isConfirmed.value).toBe(true)

      vi.stubEnv('VITE_MOCK_MODE', '')
      await fetchPlan(SPEC_BLOCK)
      expect(isConfirmed.value).toBe(false)
    })

    it('propagates API error into error ref when planSteps fails', async () => {
      // Spec: S.Evo7.EvoStepPlannerComposable — exposes reactive error state
      // When planSteps returns null and the shared API error ref is set, useEvoPlan
      // must surface the error in its own error ref.
      mockPlanSteps.mockImplementationOnce(async () => {
        // Mutate the shared error object so the composable reads it via apiError.value
        mockApiError.value = 'LLM call failed — network error'
        return null
      })

      const { plan, error, fetchPlan } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      // plan should remain null; error should be populated from the API error
      expect(plan.value).toBeNull()
      expect(error.value).toBe('LLM call failed — network error')
    })
  })

  // ── reorderSteps ──────────────────────────────────────────────────────────────

  describe('reorderSteps', () => {
    it('moves a step from one index to another', async () => {
      // Spec: S.Evo7.EvoStepPlannerComposable — reorderSteps updates plan correctly
      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { plan, fetchPlan, reorderSteps } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      // Move 'Alpha' (index 0) to index 2
      reorderSteps(0, 2)

      expect(plan.value!.steps[0].name).toBe('S.Evo2.Beta')
      expect(plan.value!.steps[1].name).toBe('S.Evo3.Gamma')
      expect(plan.value!.steps[2].name).toBe('S.Evo1.Alpha')
    })

    it('does nothing when fromIndex equals toIndex', async () => {
      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { plan, fetchPlan, reorderSteps } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      reorderSteps(1, 1)

      // Order unchanged
      expect(plan.value!.steps[0].name).toBe('S.Evo1.Alpha')
      expect(plan.value!.steps[1].name).toBe('S.Evo2.Beta')
    })

    it('does nothing when plan is null', () => {
      const { reorderSteps, plan } = useEvoPlan()
      expect(() => reorderSteps(0, 1)).not.toThrow()
      expect(plan.value).toBeNull()
    })

    it('does nothing when indices are out of bounds', async () => {
      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { plan, fetchPlan, reorderSteps } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      reorderSteps(0, 99)

      // Plan unchanged — out-of-bounds target silently ignored
      expect(plan.value!.steps[0].name).toBe('S.Evo1.Alpha')
    })
  })

  // ── renameStep ────────────────────────────────────────────────────────────────

  describe('renameStep', () => {
    it('renames the step at the given index', async () => {
      // Spec: S.Evo7.EvoStepPlannerComposable — renameStep updates step name
      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { plan, fetchPlan, renameStep } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      renameStep(1, 'S.Evo2.BetaRenamed')

      expect(plan.value!.steps[1].name).toBe('S.Evo2.BetaRenamed')
      // Other steps unchanged
      expect(plan.value!.steps[0].name).toBe('S.Evo1.Alpha')
      expect(plan.value!.steps[2].name).toBe('S.Evo3.Gamma')
    })

    it('does nothing when plan is null', () => {
      const { renameStep, plan } = useEvoPlan()
      expect(() => renameStep(0, 'NewName')).not.toThrow()
      expect(plan.value).toBeNull()
    })

    it('does nothing when index is out of bounds', async () => {
      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { plan, fetchPlan, renameStep } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      renameStep(99, 'Ghost')

      // Plan unchanged
      expect(plan.value!.steps[0].name).toBe('S.Evo1.Alpha')
    })
  })

  // ── removeStep ────────────────────────────────────────────────────────────────

  describe('removeStep', () => {
    it('removes the step at the given index', async () => {
      // Spec: S.Evo7.EvoStepPlannerComposable — removeStep deletes one step
      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { plan, fetchPlan, removeStep } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      removeStep(1)

      expect(plan.value!.steps).toHaveLength(2)
      expect(plan.value!.steps[0].name).toBe('S.Evo1.Alpha')
      expect(plan.value!.steps[1].name).toBe('S.Evo3.Gamma')
    })

    it('does nothing when plan is null', () => {
      const { removeStep, plan } = useEvoPlan()
      expect(() => removeStep(0)).not.toThrow()
      expect(plan.value).toBeNull()
    })

    it('does nothing when index is out of bounds', async () => {
      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { plan, fetchPlan, removeStep } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      removeStep(99)

      expect(plan.value!.steps).toHaveLength(3)
    })
  })

  // ── confirmPlan ───────────────────────────────────────────────────────────────

  describe('confirmPlan', () => {
    it('mock mode: sets isConfirmed=true and logs without calling Supabase', async () => {
      // Spec: S.Evo7.EvoPlanPersistence — mock mode logs and sets isConfirmed, no DB call
      vi.stubEnv('VITE_MOCK_MODE', 'true')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { plan, fetchPlan, confirmPlan, isConfirmed } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      await confirmPlan()

      expect(isConfirmed.value).toBe(true)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useEvoPlan]'),
        expect.any(String),
      )
      // No Supabase upsert called in mock mode
      expect(mockUpsert).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
      // Suppress unused-variable warning — plan is used implicitly via fetchPlan
      void plan
    })

    it('real mode: calls Supabase upsert and sets isConfirmed=true on success', async () => {
      // Spec: S.Evo7.EvoPlanPersistence — real mode upserts plan to evo_plans table
      mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-abc' } } } })
      mockUpsert.mockResolvedValueOnce({ error: null })

      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { fetchPlan, confirmPlan, isConfirmed } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      await confirmPlan()

      expect(isConfirmed.value).toBe(true)
      expect(mockUpsert).toHaveBeenCalledOnce()
    })

    it('throws an error and does not set isConfirmed when plan has no steps', async () => {
      // Spec: S.Evo7.EvoStepPlannerComposable — confirmPlan with no steps must throw
      const emptyPlan: EvoStepPlan = { steps: [] }
      mockPlanSteps.mockResolvedValueOnce(emptyPlan)
      const { fetchPlan, confirmPlan, isConfirmed } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      await expect(confirmPlan()).rejects.toThrow(/empty plan/)
      expect(isConfirmed.value).toBe(false)
    })

    it('throws an error and does not set isConfirmed when plan is null', async () => {
      // confirmPlan before fetchPlan completes — plan.value is null
      const { confirmPlan, isConfirmed } = useEvoPlan()

      await expect(confirmPlan()).rejects.toThrow(/empty plan/)
      expect(isConfirmed.value).toBe(false)
    })

    it('real mode: sets error and throws when Supabase upsert returns an error', async () => {
      // Spec: S.Evo7.EvoPlanPersistence — Supabase error must propagate to error ref and throw
      mockGetSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-abc' } } } })
      mockUpsert.mockResolvedValueOnce({ error: { message: 'DB connection refused' } })

      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { fetchPlan, confirmPlan, isConfirmed, error } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      await expect(confirmPlan()).rejects.toThrow(/DB connection refused/)
      expect(isConfirmed.value).toBe(false)
      expect(error.value).toContain('DB connection refused')
    })

    it('real mode: confirms locally (does not throw) when no workspace is selected', async () => {
      // Spec: S.Evo7.EvoPlanPersistence — missing workspace allows local-only confirmation
      // so solo users can still proceed without Supabase persistence.
      workspaceOverride = null

      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { fetchPlan, confirmPlan, isConfirmed } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      await expect(confirmPlan()).resolves.toBeUndefined()
      expect(isConfirmed.value).toBe(true)
    })

    it('real mode: throws and sets error when user is not authenticated', async () => {
      // Spec: S.Evo7.EvoPlanPersistence — unauthenticated user must get clear error
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })

      mockPlanSteps.mockResolvedValueOnce(THREE_STEP_PLAN)
      const { fetchPlan, confirmPlan, isConfirmed, error } = useEvoPlan()
      await fetchPlan(SPEC_BLOCK)

      await expect(confirmPlan()).rejects.toThrow(/Not authenticated/)
      expect(isConfirmed.value).toBe(false)
      expect(error.value).toContain('Not authenticated')
    })
  })
})
