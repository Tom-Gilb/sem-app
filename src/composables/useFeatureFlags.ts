// UNIT_TYPE=Composable
// Feature #110 — Feature Flag mapper
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface FeatureFlag {
  id: string       // kebab-case derived from F. entry name
  label: string    // original F. entry name
  enabled: boolean
  description: string  // first 60 chars of F. entry body, or empty
}

export function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')    // camelCase → kebab (legacy compat)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase()
}

export function useFeatureFlags(spec: Ref<SpecBlock | null>) {
  const flags = ref<FeatureFlag[]>([])

  function buildFlags(block: SpecBlock): FeatureFlag[] {
    return block.functions.map(f => ({
      id: toKebab(f.id),
      label: f.id,
      enabled: true,
      description: (f.description || '').slice(0, 60),
    }))
  }

  // Rebuild when spec changes
  watch(spec, (newSpec) => {
    if (newSpec) {
      // Only rebuild if flags is empty (preserve toggle state)
      if (flags.value.length === 0) {
        flags.value = buildFlags(newSpec)
      } else {
        // Sync: add new flags, remove stale ones
        const newIds = new Set(newSpec.functions.map(f => toKebab(f.id)))
        const existing = new Set(flags.value.map(f => f.id))
        // Add new
        for (const f of newSpec.functions) {
          const kid = toKebab(f.id)
          if (!existing.has(kid)) {
            flags.value.push({
              id: kid,
              label: f.id,
              enabled: true,
              description: (f.description || '').slice(0, 60),
            })
          }
        }
        // Remove stale
        flags.value = flags.value.filter(f => newIds.has(f.id))
      }
    } else {
      flags.value = []
    }
  }, { immediate: true })

  function toggleFlag(id: string): void {
    const flag = flags.value.find(f => f.id === id)
    if (flag) {
      flag.enabled = !flag.enabled
    }
  }

  function exportJson(): string {
    return JSON.stringify({ featureFlags: flags.value }, null, 2)
  }

  const copied = ref(false)

  async function copyJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(exportJson())
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return { flags, toggleFlag, exportJson, copyJson, copied }
}
