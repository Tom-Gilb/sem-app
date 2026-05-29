// UNIT_TYPE=Composable
// useBoardMembers.ts — reactive board member roster with localStorage persistence.
//
// Architecture: module-level singleton ref. Every call to useBoardMembers()
// returns a view over the SAME reactive array — components share state instantly.
//
// Initialisation: reads localStorage on first module load. Falls back to the
// static boardMembers.ts defaults if storage is empty or corrupt.
//
// Portability: this composable imports Vue reactivity only. All data types are
// in types/board.ts (framework-free). Safe to extract for server-side use
// (omit the localStorage calls in that environment).

import { ref, computed, readonly } from 'vue'
import type { BoardMember } from '../types/board'
import { boardMembers as _staticDefaults } from '../data/boardMembers'

// ── Storage helpers ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-board-members-v1'

function _generateId(): string {
  try { return crypto.randomUUID() } catch { return `mbr-${Date.now()}` }
}

function _loadFromStorage(): BoardMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return _staticDefaults.map(m => ({ ...m }))
    const parsed = JSON.parse(raw) as BoardMember[]
    // Basic sanity check — must be a non-empty array of objects with id strings
    if (!Array.isArray(parsed) || !parsed.every(m => typeof m?.id === 'string')) {
      return _staticDefaults.map(m => ({ ...m }))
    }
    return parsed
  } catch {
    return _staticDefaults.map(m => ({ ...m }))
  }
}

function _saveToStorage(members: BoardMember[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members))
  } catch {
    // localStorage full or unavailable — degrade gracefully, no error thrown
  }
}

// ── Module-level singleton ─────────────────────────────────────────────────────

/** Single reactive source of truth shared by all components. */
const _members = ref<BoardMember[]>(_loadFromStorage())

// ── Public composable ──────────────────────────────────────────────────────────

export function useBoardMembers() {
  /** Add a new blank board member. Returns the new member's id. */
  function addMember(): string {
    const id = _generateId()
    const blank: BoardMember = {
      id,
      name: '',
      role: '',
      phone: '',
      email: '',
      address: '',
      specialInterests:  [],
      specialAbilities:  [],
      volunteersFor:     [],
      dislikesTasks:     [],
      availability:      '',
      notes:             '',
    }
    _members.value = [..._members.value, blank]
    _saveToStorage(_members.value)
    return id
  }

  /**
   * Partially update a member by id.
   * Always creates a new object (no direct mutation) to guarantee Vue reactivity.
   */
  function updateMember(id: string, patch: Partial<Omit<BoardMember, 'id'>>): void {
    _members.value = _members.value.map(m =>
      m.id === id ? { ...m, ...patch } : m,
    )
    _saveToStorage(_members.value)
  }

  /** Remove a member by id. No-op if not found. */
  function removeMember(id: string): void {
    _members.value = _members.value.filter(m => m.id !== id)
    _saveToStorage(_members.value)
  }

  /**
   * Reset the roster to the static boardMembers.ts defaults.
   * Overwrites localStorage — any real data previously entered is lost.
   * Call this only after explicit user confirmation.
   */
  function resetToDefaults(): void {
    _members.value = _staticDefaults.map(m => ({ ...m }))
    _saveToStorage(_members.value)
  }

  return {
    /** Reactive list of all board members. */
    members: readonly(_members),
    /** Count of board members. */
    memberCount: computed(() => _members.value.length),
    addMember,
    updateMember,
    removeMember,
    resetToDefaults,
  }
}
