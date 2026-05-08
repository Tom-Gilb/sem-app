// UNIT_TYPE=Composable
// Feature #69 — Spec change log
import { ref } from 'vue'
import type { SpecBlock } from '../types/spec'

interface ChangelogEntry {
  id: string
  timestamp: string
  summary: string
  entriesAdded: number
  entriesChanged: number
  entriesRemoved: number
}

function totalEntries(spec: SpecBlock): number {
  return spec.functions.length + spec.values.length + spec.solutions.length
}

function entryIds(spec: SpecBlock): Set<string> {
  const ids = new Set<string>()
  for (const f of spec.functions) ids.add(f.id)
  for (const v of spec.values) ids.add(v.id)
  for (const s of spec.solutions) ids.add(s.id)
  return ids
}

function entryDescriptions(spec: SpecBlock): Map<string, string> {
  const map = new Map<string, string>()
  for (const f of spec.functions) map.set(f.id, f.description)
  for (const v of spec.values) map.set(v.id, v.description)
  for (const s of spec.solutions) map.set(s.id, s.description)
  return map
}

export function useSpecChangelog() {
  const changelog = ref<ChangelogEntry[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      summary: 'Spec regenerated — 3 added, 1 changed, 0 removed',
      entriesAdded: 3,
      entriesChanged: 1,
      entriesRemoved: 0,
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      summary: 'Spec regenerated — 5 added, 0 changed, 2 removed',
      entriesAdded: 5,
      entriesChanged: 0,
      entriesRemoved: 2,
    },
  ])
  const changelogOpen = ref(false)

  function recordChange(oldSpec: SpecBlock | null, newSpec: SpecBlock): void {
    let added = 0
    let changed = 0
    let removed = 0

    if (oldSpec === null) {
      added = totalEntries(newSpec)
    } else {
      const oldIds = entryIds(oldSpec)
      const newIds = entryIds(newSpec)
      const oldDescs = entryDescriptions(oldSpec)
      const newDescs = entryDescriptions(newSpec)

      for (const id of newIds) {
        if (!oldIds.has(id)) {
          added++
        } else if (oldDescs.get(id) !== newDescs.get(id)) {
          changed++
        }
      }
      for (const id of oldIds) {
        if (!newIds.has(id)) removed++
      }
    }

    const entry: ChangelogEntry = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(),
      timestamp: new Date().toISOString(),
      summary: `Spec regenerated — ${added} added, ${changed} changed, ${removed} removed`,
      entriesAdded: added,
      entriesChanged: changed,
      entriesRemoved: removed,
    }

    changelog.value = [entry, ...changelog.value]
  }

  function copyChangelog(): void {
    const lines = ['## Changelog', '']
    for (const entry of changelog.value) {
      lines.push(`### ${entry.timestamp}`)
      lines.push(`- Added: ${entry.entriesAdded}, Changed: ${entry.entriesChanged}, Removed: ${entry.entriesRemoved}`)
      lines.push(`- ${entry.summary}`)
      lines.push('')
    }
    const text = lines.join('\n')
    try {
      navigator.clipboard.writeText(text)
    } catch {
      // clipboard not available
    }
  }

  function clearChangelog(): void {
    changelog.value = []
  }

  return { changelog, changelogOpen, recordChange, copyChangelog, clearChangelog }
}
