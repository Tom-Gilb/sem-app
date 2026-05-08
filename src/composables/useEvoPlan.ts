// UNIT_TYPE=Hook
// useEvoPlan — reactive Evo Step Plan composable for SEM App
// Spec: S.Evo7.EvoStepPlannerComposable

import { ref, readonly } from 'vue'
import { useEvoPlannerAPI } from './useEvoPlannerAPI'
import { useWorkspace } from './useWorkspace'
import { getSupabaseClient } from '../config/supabase'
import type { SpecBlock } from '../types/spec'
import type { EvoStepPlan } from '../types/evo-plan'

/**
 * Composable for managing the reactive Evo Step Plan lifecycle.
 *
 * Calls useEvoPlannerAPI with the current SpecBlock, exposes the resulting
 * EvoStepPlan as reactive state, and provides actions to mutate the plan
 * before the user confirms it.
 *
 * confirmPlan() persists the plan to Supabase (evo_plans table) when
 * VITE_MOCK_MODE is not 'true'. In mock mode, logs to console only.
 *
 * @returns {{
 *   plan: Readonly<Ref<EvoStepPlan | null>>,
 *   isConfirmed: Readonly<Ref<boolean>>,
 *   loading: Readonly<Ref<boolean>>,
 *   error: Readonly<Ref<string>>,
 *   fetchPlan(specBlock: SpecBlock): Promise<void>,
 *   reorderSteps(fromIndex: number, toIndex: number): void,
 *   renameStep(index: number, name: string): void,
 *   removeStep(index: number): void,
 *   confirmPlan(): Promise<void>,
 * }}
 *
 * Preconditions: fetchPlan() must be called with a valid SpecBlock before
 *   any mutation actions are meaningful.
 * Errors: exposed via `error` ref; all async functions catch and surface errors.
 *
 * Spec: S.Evo7.EvoStepPlannerComposable
 */
export function useEvoPlan() {
  const plan = ref<EvoStepPlan | null>(null)
  const isConfirmed = ref(false)
  const error = ref('')

  // Delegate loading state to the API composable
  const { loading, error: apiError, planSteps } = useEvoPlannerAPI()
  const { currentWorkspace } = useWorkspace()

  // --- Fetch plan from the LLM API ---

  /**
   * Calls the Evo Planner API with the given SpecBlock and populates plan state.
   * Resets isConfirmed to false — a re-fetch starts a fresh confirmation cycle.
   */
  async function fetchPlan(specBlock: SpecBlock): Promise<void> {
    error.value = ''
    isConfirmed.value = false
    plan.value = null

    const result = await planSteps(specBlock)

    if (apiError.value) {
      // Propagate API error into this composable's error ref for the component
      error.value = apiError.value
      return
    }

    plan.value = result
  }

  // --- Mutation actions ---

  /**
   * Moves a step from fromIndex to toIndex, shifting other steps to fill the gap.
   *
   * @param fromIndex - 0-based index of the step to move
   * @param toIndex   - 0-based target index
   */
  function reorderSteps(fromIndex: number, toIndex: number): void {
    if (!plan.value) return
    const steps = [...plan.value.steps]

    // Guard: silently ignore out-of-bounds indices
    if (
      fromIndex < 0 ||
      fromIndex >= steps.length ||
      toIndex < 0 ||
      toIndex >= steps.length
    ) {
      return
    }

    // Remove from source, insert at destination
    const [moved] = steps.splice(fromIndex, 1)
    steps.splice(toIndex, 0, moved)
    plan.value = { ...plan.value, steps }
  }

  /**
   * Renames the step at the given index.
   *
   * @param index - 0-based index of the step to rename
   * @param name  - New name for the step (non-empty string)
   */
  function renameStep(index: number, name: string): void {
    if (!plan.value) return
    if (index < 0 || index >= plan.value.steps.length) return

    const steps = plan.value.steps.map((step, i) =>
      i === index ? { ...step, name } : step,
    )
    plan.value = { ...plan.value, steps }
  }

  /**
   * Removes the step at the given index from the plan.
   *
   * @param index - 0-based index of the step to remove
   */
  function removeStep(index: number): void {
    if (!plan.value) return
    if (index < 0 || index >= plan.value.steps.length) return

    const steps = plan.value.steps.filter((_, i) => i !== index)
    plan.value = { ...plan.value, steps }
  }

  /**
   * Confirms the current plan and persists it to Supabase (or console in mock mode).
   *
   * Sets isConfirmed = true on success.
   * Throws if plan has no steps — a plan with zero steps cannot be confirmed.
   *
   * Spec: S.Evo7.EvoPlanPersistence
   *
   * @throws {Error} if plan has no steps
   */
  async function confirmPlan(): Promise<void> {
    error.value = ''

    if (!plan.value || plan.value.steps.length === 0) {
      throw new Error('Cannot confirm an empty plan — add at least one step before confirming.')
    }

    // --- Mock mode: log only, no Supabase call ---
    if (import.meta.env.VITE_MOCK_MODE === 'true') {
      console.log('[useEvoPlan] confirmPlan (mock mode):', JSON.stringify(plan.value, null, 2))
      isConfirmed.value = true
      return
    }

    // --- Real mode: upsert to evo_plans table ---
    try {
      const client = getSupabaseClient()
      const workspaceId = currentWorkspace.value?.id

      if (!workspaceId) {
        // No workspace in session — confirm locally without persisting.
        // Plan is still usable for tasks and impact estimation this session.
        console.warn('[useEvoPlan] No workspace selected — plan confirmed locally only (not persisted to Supabase).')
        isConfirmed.value = true
        return
      }

      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user?.id
      if (!userId) {
        throw new Error('Not authenticated — cannot persist the Evo plan.')
      }

      // Upsert based on workspace_id so re-confirming replaces the previous plan
      const { error: dbError } = await client
        .from('evo_plans')
        .upsert(
          {
            workspace_id: workspaceId,
            plan: plan.value,
            confirmed_at: new Date().toISOString(),
            confirmed_by: userId,
          },
          { onConflict: 'workspace_id' },
        )

      if (dbError) {
        throw new Error(dbError.message)
      }

      isConfirmed.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    }
  }

  return {
    plan: readonly(plan),
    isConfirmed: readonly(isConfirmed),
    loading,
    error: readonly(error),
    fetchPlan,
    reorderSteps,
    renameStep,
    removeStep,
    confirmPlan,
  }
}
