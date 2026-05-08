// UNIT_TYPE=Composable
// Feature #115 — Spec as TOGAF Architecture View
import { ref, computed } from 'vue'
import type { SpecBlock, FEntry, VEntry, SEntry } from '../types/spec'

export interface TogafLayer {
  name: 'Business' | 'Application' | 'Data' | 'Technology'
  colour: string // Tailwind bg class
  entries: (FEntry | VEntry | SEntry)[]
}

const BUSINESS_KW = /process|workflow|capability|goal|stakeholder|policy|strategy/i
const APPLICATION_KW = /service|api|component|interface|module|app|system/i
const DATA_KW = /data|store|model|schema|database|record|cache/i
const TECHNOLOGY_KW = /uptime|latency|throughput|availability/i

function textOf(entry: FEntry | VEntry | SEntry): string {
  return [entry.id, entry.description].join(' ')
}

function scaleOf(entry: FEntry | VEntry | SEntry): string {
  return 'scale' in entry ? (entry as VEntry).scale ?? '' : ''
}

export function useTogafView(blocks: SpecBlock[]) {
  const highlightedLayer = ref<string | null>(null)

  const layers = computed<TogafLayer[]>(() => {
    const business: (FEntry | VEntry | SEntry)[] = []
    const application: (FEntry | VEntry | SEntry)[] = []
    const data: (FEntry | VEntry | SEntry)[] = []
    const technology: (FEntry | VEntry | SEntry)[] = []

    const businessSet = new Set<string>()
    const applicationSet = new Set<string>()
    const dataSet = new Set<string>()

    // Pass 1: classify F. entries for Business
    for (const block of blocks) {
      for (const f of block.functions) {
        const t = textOf(f)
        if (BUSINESS_KW.test(t)) {
          business.push(f)
          businessSet.add(f.id)
        }
      }
    }

    // Pass 2: classify S. entries for Application and Data
    for (const block of blocks) {
      for (const s of block.solutions) {
        const t = textOf(s)
        if (DATA_KW.test(t)) {
          data.push(s)
          dataSet.add(s.id)
        } else if (APPLICATION_KW.test(t)) {
          application.push(s)
          applicationSet.add(s.id)
        }
      }
    }

    // Pass 3: F. entries NOT in Business → Application
    for (const block of blocks) {
      for (const f of block.functions) {
        if (!businessSet.has(f.id)) {
          application.push(f)
          applicationSet.add(f.id)
        }
      }
    }

    // Pass 4: V. entries with Technology KW → Technology; rest → Business fallback
    const technologySet = new Set<string>()
    for (const block of blocks) {
      for (const v of block.values) {
        const scale = scaleOf(v)
        if (TECHNOLOGY_KW.test(scale)) {
          technology.push(v)
          technologySet.add(v.id)
        }
      }
    }

    // Pass 5: S. entries NOT already in Application/Data → Technology
    for (const block of blocks) {
      for (const s of block.solutions) {
        if (!applicationSet.has(s.id) && !dataSet.has(s.id)) {
          technology.push(s)
        }
      }
    }

    // Pass 6: Uncategorised V. entries → Business fallback
    for (const block of blocks) {
      for (const v of block.values) {
        if (!technologySet.has(v.id)) {
          business.push(v)
        }
      }
    }

    return [
      { name: 'Business', colour: 'bg-blue-100', entries: business },
      { name: 'Application', colour: 'bg-green-100', entries: application },
      { name: 'Data', colour: 'bg-yellow-100', entries: data },
      { name: 'Technology', colour: 'bg-purple-100', entries: technology },
    ]
  })

  function setHighlight(name: string): void {
    highlightedLayer.value = highlightedLayer.value === name ? null : name
  }

  return { layers, highlightedLayer, setHighlight }
}
