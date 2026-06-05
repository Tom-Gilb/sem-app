// UNIT_TYPE=Test
/**
 * usePlanModel.test.ts
 *
 * Unit tests for the Plan Model composable — the core persistence and
 * lifecycle layer for all saved planning sessions.
 *
 * Coverage:
 *   initPlanModel      — creation, naming, version, tag, storage
 *   bumpPlanVersion    — version arithmetic, sharpenRounds
 *   savePlanSnapshot   — spec update without version bump
 *   renamePlanModel    — name + tag + current sync
 *   deletePlanModel    — removal + current clear
 *   importPlanModel    — single-model import validation
 *   importPlanModelsBackup — bulk restore with merge/skip logic
 *   getAllPlanModels    — reactive all-models list
 *   latestPlanModel    — most-recent accessor
 *   clearPlanModel     — current-model reset
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { SpecBlock } from '../../types/spec'
import {
  initPlanModel,
  bumpPlanVersion,
  savePlanSnapshot,
  renamePlanModel,
  deletePlanModel,
  importPlanModel,
  importPlanModelsBackup,
  clearPlanModel,
  getAllPlanModels,
  latestPlanModel,
  useSpecModel,
} from '../useSpecModel'

// ── Fixture factory ──────────────────────────────────────────────────────────

function makeSpec(label = 'Test'): SpecBlock {
  return {
    functions: [{
      id: `f-${label}`, type: 'Function', level: 'Product',
      description: `${label} function`, successCriteria: 'Works',
      functionOfValue: '[[V.TestValue]]',
    }],
    values: [{
      id: `v-${label}`, type: 'Value', level: 'Product',
      description: `${label} value`,
      scale: 'count', meter: 'automated count', status: '7',
      tolerable: '5', goal: '10', valueOfFunction: '[[F.TestFunction]]',
    }],
    solutions: [{
      id: `s-${label}`, type: 'Solution', level: 'Product',
      description: `${label} solution`, impact: 'V.TestValue ~80%',
      function: '[[F.TestFunction]]',
    }],
  }
}

// ── State reset ──────────────────────────────────────────────────────────────
// usePlanModel uses module-level refs that persist across tests.
// We reset by deleting every saved model (each delete syncs _allModels)
// and clearing the current model reference, then wiping localStorage.

function resetState(): void {
  const all = [...getAllPlanModels()]
  for (const m of all) deletePlanModel(m.id)
  clearPlanModel()
  localStorage.clear()
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSpecModel', () => {
  beforeEach(resetState)

  // ── initPlanModel ──────────────────────────────────────────────────────────

  describe('initPlanModel', () => {
    it('starts at version 0.1', () => {
      const m = initPlanModel(makeSpec())
      expect(m.version).toBe('0.1')
    })

    it('sets sharpenRounds to 0', () => {
      const m = initPlanModel(makeSpec())
      expect(m.sharpenRounds).toBe(0)
    })

    it('uses provided name when given', () => {
      const m = initPlanModel(makeSpec(), 'My Plan')
      expect(m.name).toBe('My Plan')
    })

    it('auto-derives a non-empty name from spec values', () => {
      const spec = makeSpec('Entry Fluency')
      const m = initPlanModel(spec)
      expect(m.name.length).toBeGreaterThan(0)
    })

    it('falls back to function description when no values', () => {
      const spec: SpecBlock = {
        functions: [{
          id: 'f1', type: 'Function', level: 'Product',
          description: 'Handle user onboarding flow',
          successCriteria: '', functionOfValue: '',
        }],
        values: [],
        solutions: [],
      }
      const m = initPlanModel(spec)
      expect(m.name.length).toBeGreaterThan(0)
    })

    it('slugifies the name into a tag', () => {
      const m = initPlanModel(makeSpec(), 'Hello World 2026')
      expect(m.tag).toBe('hello-world-2026')
    })

    it('strips leading/trailing hyphens from tag', () => {
      const m = initPlanModel(makeSpec(), '  Plan Name  ')
      expect(m.tag).not.toMatch(/^-|-$/)
    })

    it('sets createdAt and updatedAt to ISO timestamps', () => {
      const before = new Date().toISOString()
      const m = initPlanModel(makeSpec())
      const after = new Date().toISOString()
      expect(m.createdAt >= before).toBe(true)
      expect(m.createdAt <= after).toBe(true)
      expect(m.updatedAt >= before).toBe(true)
    })

    it('persists to localStorage', () => {
      initPlanModel(makeSpec(), 'Persist Test')
      expect(localStorage.getItem('sem-plan-models')).not.toBeNull()
    })

    it('sets the current model', () => {
      const m = initPlanModel(makeSpec(), 'Current Test')
      expect(useSpecModel().currentModel.value?.id).toBe(m.id)
    })

    it('appears in getAllPlanModels', () => {
      const m = initPlanModel(makeSpec(), 'Listed')
      expect(getAllPlanModels().some(x => x.id === m.id)).toBe(true)
    })

    it('assigns a unique id each time', () => {
      const a = initPlanModel(makeSpec(), 'A')
      const b = initPlanModel(makeSpec(), 'B')
      expect(a.id).not.toBe(b.id)
    })
  })

  // ── bumpPlanVersion ────────────────────────────────────────────────────────

  describe('bumpPlanVersion', () => {
    it('increments minor: 0.1 → 0.2', () => {
      initPlanModel(makeSpec(), 'V Test')
      bumpPlanVersion()
      expect(useSpecModel().currentModel.value?.version).toBe('0.2')
    })

    it('rolls over at 0.9 → 1.0', () => {
      initPlanModel(makeSpec(), 'Roll')
      for (let i = 0; i < 8; i++) bumpPlanVersion() // 0.1→0.9
      bumpPlanVersion()                               // 0.9→1.0
      expect(useSpecModel().currentModel.value?.version).toBe('1.0')
    })

    it('continues past 1.0: 1.0 → 1.1', () => {
      initPlanModel(makeSpec(), 'Post 1.0')
      for (let i = 0; i < 9; i++) bumpPlanVersion() // 0.1→1.0
      bumpPlanVersion()                               // 1.0→1.1
      expect(useSpecModel().currentModel.value?.version).toBe('1.1')
    })

    it('increments sharpenRounds each time', () => {
      initPlanModel(makeSpec(), 'Sharpen')
      bumpPlanVersion()
      bumpPlanVersion()
      expect(useSpecModel().currentModel.value?.sharpenRounds).toBe(2)
    })

    it('updates the spec snapshot when provided', () => {
      initPlanModel(makeSpec('Original'), 'With Spec')
      const updated = makeSpec('Updated')
      bumpPlanVersion(updated)
      expect(useSpecModel().currentModel.value?.spec.functions[0].description)
        .toContain('Updated')
    })

    it('does not throw when no current model', () => {
      clearPlanModel()
      expect(() => bumpPlanVersion()).not.toThrow()
    })
  })

  // ── savePlanSnapshot ───────────────────────────────────────────────────────

  describe('savePlanSnapshot', () => {
    it('updates the spec without bumping the version', () => {
      initPlanModel(makeSpec('Original'), 'Snapshot')
      savePlanSnapshot(makeSpec('Revised'))
      const cur = useSpecModel().currentModel.value!
      expect(cur.version).toBe('0.1')
      expect(cur.spec.functions[0].description).toContain('Revised')
    })

    it('does not increment sharpenRounds', () => {
      initPlanModel(makeSpec(), 'No Bump')
      savePlanSnapshot(makeSpec('New'))
      expect(useSpecModel().currentModel.value?.sharpenRounds).toBe(0)
    })

    it('updates updatedAt', async () => {
      const m = initPlanModel(makeSpec(), 'Timestamp')
      await new Promise(r => setTimeout(r, 10))
      savePlanSnapshot(makeSpec('Later'))
      expect(useSpecModel().currentModel.value!.updatedAt > m.updatedAt).toBe(true)
    })

    it('does not throw when no current model', () => {
      clearPlanModel()
      expect(() => savePlanSnapshot(makeSpec())).not.toThrow()
    })
  })

  // ── renamePlanModel ────────────────────────────────────────────────────────

  describe('renamePlanModel', () => {
    it('updates name in storage', () => {
      const m = initPlanModel(makeSpec(), 'Old')
      renamePlanModel(m.id, 'New')
      expect(getAllPlanModels().find(x => x.id === m.id)?.name).toBe('New')
    })

    it('re-slugifies the tag from the new name', () => {
      const m = initPlanModel(makeSpec(), 'Old Name')
      renamePlanModel(m.id, 'Brand New Plan')
      expect(getAllPlanModels().find(x => x.id === m.id)?.tag).toBe('brand-new-plan')
    })

    it('syncs currentModel when the renamed model is active', () => {
      const m = initPlanModel(makeSpec(), 'Active')
      renamePlanModel(m.id, 'Renamed Active')
      expect(useSpecModel().currentModel.value?.name).toBe('Renamed Active')
    })

    it('does NOT change currentModel when a different model is renamed', () => {
      const m1 = initPlanModel(makeSpec(), 'First')
      initPlanModel(makeSpec(), 'Second') // becomes current
      renamePlanModel(m1.id, 'First Renamed')
      expect(useSpecModel().currentModel.value?.name).toBe('Second')
    })

    it('silently ignores an unknown id', () => {
      expect(() => renamePlanModel('no-such-id', 'Anything')).not.toThrow()
    })
  })

  // ── deletePlanModel ────────────────────────────────────────────────────────

  describe('deletePlanModel', () => {
    it('removes the model from getAllPlanModels', () => {
      const m = initPlanModel(makeSpec(), 'Gone')
      deletePlanModel(m.id)
      expect(getAllPlanModels().some(x => x.id === m.id)).toBe(false)
    })

    it('clears currentModel when the active model is deleted', () => {
      const m = initPlanModel(makeSpec(), 'Active')
      deletePlanModel(m.id)
      expect(useSpecModel().currentModel.value).toBeNull()
    })

    it('leaves currentModel intact when a different model is deleted', () => {
      const m1 = initPlanModel(makeSpec(), 'Other')
      const m2 = initPlanModel(makeSpec(), 'Keep') // becomes current
      deletePlanModel(m1.id)
      expect(useSpecModel().currentModel.value?.id).toBe(m2.id)
    })

    it('silently handles deleting a non-existent id', () => {
      expect(() => deletePlanModel('ghost-id')).not.toThrow()
    })
  })

  // ── importPlanModel ────────────────────────────────────────────────────────

  describe('importPlanModel', () => {
    it('returns a model when all required fields are present', () => {
      const result = importPlanModel({ name: 'Import', version: '2.0', spec: makeSpec() })
      expect(result).not.toBeNull()
      expect(result!.name).toBe('Import')
      expect(result!.version).toBe('2.0')
    })

    it('returns null when name is missing', () => {
      expect(importPlanModel({ version: '1.0', spec: makeSpec() })).toBeNull()
    })

    it('returns null when version is missing', () => {
      expect(importPlanModel({ name: 'Test', spec: makeSpec() })).toBeNull()
    })

    it('returns null when spec is missing', () => {
      expect(importPlanModel({ name: 'Test', version: '1.0' })).toBeNull()
    })

    it('generates a new UUID when id is absent', () => {
      const result = importPlanModel({ name: 'NoId', version: '1.0', spec: makeSpec() })
      expect(result!.id).toBeTruthy()
    })

    it('preserves the id when provided', () => {
      const result = importPlanModel({ id: 'my-fixed-id', name: 'Has Id', version: '1.0', spec: makeSpec() })
      expect(result!.id).toBe('my-fixed-id')
    })

    it('derives tag from name when tag is absent', () => {
      const result = importPlanModel({ name: 'No Tag Here', version: '1.0', spec: makeSpec() })
      expect(result!.tag).toBe('no-tag-here')
    })

    it('sets the imported model as current', () => {
      const result = importPlanModel({ name: 'Imported', version: '1.0', spec: makeSpec() })
      expect(useSpecModel().currentModel.value?.id).toBe(result!.id)
    })

    it('adds the model to getAllPlanModels', () => {
      const result = importPlanModel({ name: 'Listed', version: '1.0', spec: makeSpec() })
      expect(getAllPlanModels().some(m => m.id === result!.id)).toBe(true)
    })
  })

  // ── importPlanModelsBackup ─────────────────────────────────────────────────

  describe('importPlanModelsBackup', () => {
    it('returns 0 for non-backup objects', () => {
      expect(importPlanModelsBackup({ other: true })).toBe(0)
    })

    it('returns 0 for null input', () => {
      expect(importPlanModelsBackup(null)).toBe(0)
    })

    it('returns 0 when models array is missing', () => {
      expect(importPlanModelsBackup({ semAppBackup: true })).toBe(0)
    })

    it('imports all valid new models and returns the count', () => {
      const backup = {
        semAppBackup: true,
        models: [
          { id: 'id-a', name: 'Plan A', version: '0.1', spec: makeSpec() },
          { id: 'id-b', name: 'Plan B', version: '0.2', spec: makeSpec() },
        ],
      }
      expect(importPlanModelsBackup(backup)).toBe(2)
      expect(getAllPlanModels()).toHaveLength(2)
    })

    it('skips models whose id already exists', () => {
      const m = initPlanModel(makeSpec(), 'Existing')
      const backup = {
        semAppBackup: true,
        models: [
          { id: m.id, name: 'Duplicate', version: '0.1', spec: makeSpec() },
          { id: 'brand-new', name: 'New', version: '0.1', spec: makeSpec() },
        ],
      }
      expect(importPlanModelsBackup(backup)).toBe(1)
      expect(getAllPlanModels()).toHaveLength(2) // original + 1 new
    })

    it('skips entries missing name', () => {
      const backup = {
        semAppBackup: true,
        models: [{ id: 'x1', version: '0.1', spec: makeSpec() }],
      }
      expect(importPlanModelsBackup(backup)).toBe(0)
    })

    it('skips entries missing spec', () => {
      const backup = {
        semAppBackup: true,
        models: [{ id: 'x2', name: 'No Spec', version: '0.1' }],
      }
      expect(importPlanModelsBackup(backup)).toBe(0)
    })

    it('returns 0 and does not modify storage when nothing is new', () => {
      const m = initPlanModel(makeSpec(), 'Solo')
      const countBefore = getAllPlanModels().length
      const backup = {
        semAppBackup: true,
        models: [{ id: m.id, name: 'Dupe', version: '0.1', spec: makeSpec() }],
      }
      expect(importPlanModelsBackup(backup)).toBe(0)
      expect(getAllPlanModels()).toHaveLength(countBefore)
    })
  })

  // ── getAllPlanModels / latestPlanModel ──────────────────────────────────────

  describe('getAllPlanModels', () => {
    it('returns empty array when nothing is saved', () => {
      expect(getAllPlanModels()).toHaveLength(0)
    })

    it('returns all saved models', () => {
      initPlanModel(makeSpec(), 'A')
      initPlanModel(makeSpec(), 'B')
      initPlanModel(makeSpec(), 'C')
      expect(getAllPlanModels()).toHaveLength(3)
    })

    it('orders models newest-first by updatedAt', async () => {
      initPlanModel(makeSpec(), 'Older')
      await new Promise(r => setTimeout(r, 10))
      initPlanModel(makeSpec(), 'Newer')
      const all = getAllPlanModels()
      expect(all[0].name).toBe('Newer')
      expect(all[1].name).toBe('Older')
    })
  })

  describe('latestPlanModel', () => {
    it('returns null when no models exist', () => {
      expect(latestPlanModel()).toBeNull()
    })

    it('returns the most recently updated model', async () => {
      initPlanModel(makeSpec(), 'First')
      await new Promise(r => setTimeout(r, 10))
      initPlanModel(makeSpec(), 'Second')
      expect(latestPlanModel()?.name).toBe('Second')
    })
  })

  // ── clearPlanModel ─────────────────────────────────────────────────────────

  describe('clearPlanModel', () => {
    it('sets currentModel to null', () => {
      initPlanModel(makeSpec(), 'Will Clear')
      clearPlanModel()
      expect(useSpecModel().currentModel.value).toBeNull()
    })

    it('does not affect saved models list', () => {
      initPlanModel(makeSpec(), 'Saved')
      clearPlanModel()
      expect(getAllPlanModels()).toHaveLength(1)
    })

    it('does not throw when already null', () => {
      expect(() => clearPlanModel()).not.toThrow()
    })
  })
})
