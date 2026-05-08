// UNIT_TYPE=Composable
// Feature #152 — Spec as Changelog Entry Generator
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface ChangelogEntry {
  fEntryId: string
  fEntryName: string
  type: 'feat' | 'fix' | 'perf' | 'docs' | 'refactor'
  scope: string
  message: string
  fullEntry: string
}

const TYPE_MAP: Array<'feat' | 'fix' | 'perf' | 'docs' | 'refactor'> = [
  'feat',
  'fix',
  'perf',
  'docs',
  'refactor',
]

function charCodeSeed(id: string): number {
  let s = 0
  for (let i = 0; i < id.length; i++) {
    s += id.charCodeAt(i)
  }
  return s
}

function deriveScope(id: string): string {
  return id
    .replace(/\s+/g, '')
    .slice(0, 12)
    .toLowerCase()
    .replace(/\./g, '-')
}

function sentenceCase(text: string): string {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function buildChangelogEntry(fEntryId: string, fEntryName: string, description: string): ChangelogEntry {
  const seed = charCodeSeed(fEntryId)
  const type = TYPE_MAP[seed % 5]
  const scope = deriveScope(fEntryId)
  const message = sentenceCase(description.slice(0, 60).trim())
  const fullEntry = `${type}(${scope}): ${message}`

  return {
    fEntryId,
    fEntryName,
    type,
    scope,
    message,
    fullEntry,
  }
}

export function formatChangelogBlock(entries: ChangelogEntry[], todayIso: string): string {
  const lines = entries.map((e) => e.fullEntry)
  return [`## [Unreleased] — ${todayIso}`, '', ...lines].join('\n')
}

export function useChangelogEntry(blocks: SpecBlock[]) {
  const allCopied: Ref<boolean> = ref(false)

  const entries: ComputedRef<ChangelogEntry[]> = computed<ChangelogEntry[]>(() => {
    const result: ChangelogEntry[] = []
    for (const block of blocks) {
      for (const f of block.functions) {
        result.push(buildChangelogEntry(f.id, f.id, f.description))
      }
    }
    return result
  })

  const versionBump: ComputedRef<string> = computed<string>(() => {
    const types = entries.value.map((e) => e.type)
    if (types.includes('feat')) return 'minor'
    if (types.includes('fix') || types.includes('perf')) return 'patch'
    return 'patch'
  })

  async function copyAll(): Promise<void> {
    if (!entries.value.length) return
    const today = new Date().toISOString().slice(0, 10)
    const text = formatChangelogBlock(entries.value, today)
    try {
      await navigator.clipboard.writeText(text)
      allCopied.value = true
      setTimeout(() => {
        allCopied.value = false
      }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return { entries, versionBump, copyAll, allCopied }
}
