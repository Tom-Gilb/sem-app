/**
 * useCommandPalette — Feature Organisation Design (spec §3)
 *
 * Manages open/close state, search query, fuzzy filtering, and keyboard
 * navigation for the Cmd/Ctrl+K command palette overlay.
 *
 * The caller passes the full featureRegistry and wires @keydown handlers.
 */
import { ref, computed, watch } from 'vue'

export interface PaletteEntry {
  /** Unique identifier — matches feature number string, e.g. '43' */
  key: string
  label: string
  emoji: string
  profiles: string[]
  /** Called when the user selects this entry */
  action: () => void
}

export function useCommandPalette(registry: PaletteEntry[]) {
  const isOpen = ref(false)
  const query = ref('')
  const selectedIndex = ref(0)

  /** Reset selection when query changes */
  watch(query, () => { selectedIndex.value = 0 })

  const filtered = computed<PaletteEntry[]>(() => {
    const q = query.value.toLowerCase().trim()
    if (!q) return registry.slice(0, 10)
    return registry.filter(f =>
      f.label.toLowerCase().includes(q) ||
      f.emoji.includes(q) ||
      f.profiles.some(p => p.toLowerCase().includes(q)),
    ).slice(0, 10)
  })

  function open() {
    isOpen.value = true
    query.value = ''
    selectedIndex.value = 0
  }

  function close() {
    isOpen.value = false
    query.value = ''
  }

  function moveDown() {
    const len = filtered.value.length
    if (!len) return
    selectedIndex.value = (selectedIndex.value + 1) % len
  }

  function moveUp() {
    const len = filtered.value.length
    if (!len) return
    selectedIndex.value = (selectedIndex.value - 1 + len) % len
  }

  function confirm() {
    const item = filtered.value[selectedIndex.value]
    if (item) {
      item.action()
      close()
    }
  }

  /** Wire this to a root keydown listener */
  function handleKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      isOpen.value ? close() : open()
      return
    }
    if (!isOpen.value) return
    if (e.key === 'Escape') { close(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveDown(); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveUp(); return }
    if (e.key === 'Enter') { e.preventDefault(); confirm(); return }
  }

  return {
    isOpen,
    query,
    filtered,
    selectedIndex,
    open,
    close,
    moveDown,
    moveUp,
    confirm,
    handleKey,
  }
}
