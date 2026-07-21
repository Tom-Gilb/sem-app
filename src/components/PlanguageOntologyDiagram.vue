<script setup lang="ts">
/**
 * PlanguageOntologyDiagram — Tom Gilb 2026-06-13:
 *   "In general I want all diagrams clickable. But I was only referring
 *    to the diagram with ontologies in almost all glossary terms, the 700."
 *
 * Renders the 663-concept Planguage Glossary as a collapsible hierarchical
 * tree.  Sourced from `/planguage-ontology-tree.json` built by
 * `10.Standard/2.Glossary/PlanguageGlossary/_build-ontology-tree.py`.
 *
 * Every concept node is clickable → opens the Twin Consultant URL
 * (gilb.com/tomtwin/concept/<Name>.<Number>) in a new tab.  Every category
 * node is collapsible.  Live search box filters the tree by concept name
 * or number (auto-expands path to matching nodes).
 *
 * Composes with:
 *   - Conjunction-of-Technologies SUPREME (Glossary materialises the (b) Gilb-corpus layer)
 *   - r93ppp Twin-as-Destination (every concept click drives funding-loop traffic)
 *   - SEM-Teaches-Incrementally SUPREME (the planner discovers the ontology by browsing)
 *   - DD-009 Interaction Disclosure (every node has a HoverHint explaining its role)
 *   - Universal Undo (not applicable — read-only)
 *   - Single-Surface Rule (registered via useExclusiveSurfaces by App.vue)
 *   - CloseDot rule (backdrop + Escape + CloseDot)
 *   - American English Standard
 *   - HoverHint (not "tooltip")
 */

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import OntologyNodeRow from './OntologyNodeRow.vue'
import {
  renderOntologyTreeHtml,
  renderOntologyTreePlain,
  type OntologyTreeExportState,
  type OntologyExportCategory,
  type OntologyExportConcept,
} from '../composables/useOntologyTreeExport'
import { useToast } from '../composables/useToast'
const { showToast } = useToast()

interface OntologyNode {
  id:             string
  kind:           'class' | 'concept'
  name:           string
  /** Concept-only fields */
  conceptNumber?: string
  type?:          string
  keyedIcon?:     string
  twinUrl?:       string
  definition?:    string
  /** Category-only field */
  slug?:          string
  children:       OntologyNode[]
}

interface OntologyTree {
  version:         number
  generated:       string
  totalConcepts:   number
  totalCategories: number
  tree:            OntologyNode
}

const props = defineProps<{ open: boolean }>()
const emit  = defineEmits<{ (e: 'close'): void }>()

const _tree   = ref<OntologyTree | null>(null)
const _loading = ref(false)
const _error  = ref<string | null>(null)

const queryText  = ref('')
const expandedIds = ref<Set<string>>(new Set())

async function ensureLoaded(): Promise<void> {
  if (_tree.value || _loading.value) return
  _loading.value = true
  _error.value   = null
  try {
    const res = await fetch(`/planguage-ontology-tree.json?v=${Date.now() % 100000}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    _tree.value = await res.json()
    // Default-expand root only (so user sees the top level on open)
    expandedIds.value = new Set([_tree.value!.tree.id])
  } catch (e) {
    _error.value = `Could not load ontology tree: ${(e as Error).message}`
    console.warn('[PlanguageOntologyDiagram]', _error.value)
  } finally {
    _loading.value = false
  }
}

watch(() => props.open, (open) => {
  if (open) {
    ensureLoaded()
    queryText.value = ''
  }
})

// Build a Set of all node-ids that match the current query — and auto-expand
// every ancestor of every match so matches are visible.
const matchedIds = computed<Set<string>>(() => {
  const q = queryText.value.trim().toLowerCase()
  if (!q) return new Set()
  const out = new Set<string>()
  function walk(n: OntologyNode, ancestors: string[]): void {
    const hay = `${n.name} *${n.conceptNumber ?? ''} ${n.type ?? ''} ${n.definition ?? ''}`.toLowerCase()
    const isMatch = hay.includes(q)
    if (isMatch) {
      out.add(n.id)
      // Mark ancestors as match-path so they stay expanded
      for (const a of ancestors) out.add(a)
    }
    for (const child of n.children) {
      walk(child, [...ancestors, n.id])
    }
  }
  if (_tree.value) walk(_tree.value.tree, [])
  return out
})

// When the user types, auto-expand every node on a match path.
watch(matchedIds, (ids) => {
  for (const id of ids) expandedIds.value.add(id)
})

function toggle(id: string): void {
  if (expandedIds.value.has(id)) expandedIds.value.delete(id)
  else                            expandedIds.value.add(id)
  // Force reactivity
  expandedIds.value = new Set(expandedIds.value)
}

function expandAll(): void {
  if (!_tree.value) return
  const all = new Set<string>()
  function walk(n: OntologyNode): void {
    all.add(n.id)
    for (const c of n.children) walk(c)
  }
  walk(_tree.value.tree)
  expandedIds.value = all
}

function collapseAll(): void {
  if (!_tree.value) return
  expandedIds.value = new Set([_tree.value.tree.id])
}

function onKey(e: KeyboardEvent): void {
  if (!props.open) return
  if (e.key === 'Escape') {
    const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea') return
    emit('close')
  }
}

function onBackdrop(e: MouseEvent): void {
  if (e.target === e.currentTarget) emit('close')
}

onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

// Quick stats for the header
const total       = computed(() => _tree.value?.totalConcepts ?? 0)
const categories  = computed(() => _tree.value?.totalCategories ?? 0)
const matchCount  = computed(() => {
  let n = 0
  for (const id of matchedIds.value) if (id.startsWith('concept:')) n++
  return n
})

// ── Export — Universal Export-button-on-all-windows rule (r93ppp Twin promo) ──
// Builds a full-model colourful HTML document of the 663-concept ontology,
// opens a preview window, copies HTML + plain to the clipboard, and auto-opens
// Mail to Tom@Gilb.com per the SEM Email Body Standard.
async function exportOntologyTree(): Promise<void> {
  if (!_tree.value) {
    showToast('Ontology tree not loaded yet — try again in a moment.', 4000)
    return
  }
  try {
    // Flatten the tree into a per-category list of concepts.  Walk every node;
    // any concept node is bucketed under the nearest enclosing category name.
    const buckets = new Map<string, OntologyExportCategory>()
    function walk(n: OntologyNode, currentCategory: string): void {
      if (n.kind === 'class') {
        // Categories become buckets; nested categories use their own name
        const catName = n.name || currentCategory
        if (!buckets.has(catName)) {
          buckets.set(catName, { name: catName, slug: n.slug, concepts: [] })
        }
        for (const child of n.children) walk(child, catName)
      } else {
        const concept: OntologyExportConcept = {
          name:          n.name,
          conceptNumber: n.conceptNumber ?? '',
          type:          n.type,
          keyedIcon:     n.keyedIcon,
          definition:    n.definition,
          twinUrl:       n.twinUrl,
        }
        const cat = currentCategory || 'Uncategorized'
        if (!buckets.has(cat)) {
          buckets.set(cat, { name: cat, concepts: [] })
        }
        buckets.get(cat)!.concepts.push(concept)
      }
    }
    walk(_tree.value.tree, '')

    // Drop empty categories; sort concepts within each by *Number ascending
    const cats: OntologyExportCategory[] = Array.from(buckets.values())
      .filter(c => c.concepts.length > 0)
      .map(c => ({
        ...c,
        concepts: [...c.concepts].sort((a, b) => {
          const an = parseInt(a.conceptNumber || '0', 10)
          const bn = parseInt(b.conceptNumber || '0', 10)
          return an - bn
        }),
      }))

    const exportState: OntologyTreeExportState = {
      query:      queryText.value || '',
      matchCount: matchCount.value,
      total:      total.value,
      categories: cats,
    }

    const isoDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    const htmlText  = renderOntologyTreeHtml(exportState, isoDate)
    const plainText = renderOntologyTreePlain(exportState, isoDate)
    const subject = `🌳 Planguage Ontology · ${total.value} concepts · ${isoDate}`
    const separator = '─'.repeat(56)
    const mailtoBody = [
      'PASTE ⌘V (CMD+V) HERE FOR COLOR VERSION',
      `Exported: ${isoDate}`,
      separator,
      '',
      '[Add a brief note here if you like — or just ⌘V to paste the colour version above the line.]',
    ].join('\n')

    // Step 2 — preview window (100% of the model)
    try {
      const w = window.open('', '_blank', 'width=1100,height=820,scrollbars=yes')
      if (w) { w.document.open(); w.document.write(htmlText); w.document.close() }
    } catch (err) {
      console.warn('[PlanguageOntologyDiagram export] preview window failed', err)
    }

    // Step 3 — clipboard (HTML + plain)
    let clipboardOK = false
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html':  new Blob([htmlText],  { type: 'text/html'  }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        })])
        clipboardOK = true
      } catch (err) {
        console.warn('[PlanguageOntologyDiagram export] clipboard.write failed', err)
      }
    }
    if (!clipboardOK) {
      try { await navigator.clipboard.writeText(plainText); clipboardOK = true } catch { /* continue */ }
    }

    // Step 4 — auto-open Mail to Tom@Gilb.com per SEM Email Body Standard
    const href = `mailto:Tom@Gilb.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailtoBody)}`
    window.location.href = href

    // Step 6 — confirmation toast
    showToast(
      '📧 Mail opening — press ⌘V in the body to paste the colourful ontology · preview window also open'
      + (clipboardOK ? '' : ' · clipboard write failed, paste-back unavailable'),
      6500,
    )
  } catch (err) {
    console.error('[PlanguageOntologyDiagram export] unexpected failure', err)
    showToast(`Export failed: ${String(err).slice(0, 90)}`, 5000)
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[800] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    @click="onBackdrop"
  >
    <div
      class="gilb-ontology-scroll bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
      @click.stop
    >
      <!-- HEADER -->
      <header class="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-violet-50 via-amber-50 to-emerald-50 shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-2xl">🌳</span>
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-slate-800 leading-tight">
              Planguage Ontology — Clickable Concept Tree
            </h2>
            <p class="text-xs text-slate-600 leading-tight mt-0.5">
              <strong>{{ total }}</strong> concepts in <strong>{{ categories }}</strong> categories ·
              click any concept to open it on Tom Gilb Consultant Twin (free) ·
              source: <code class="text-[10px] bg-white px-1 rounded">10.Standard/2.Glossary/PlanguageGlossary/</code>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            class="px-2 py-1 text-xs rounded-md bg-white border border-slate-300 hover:bg-slate-100"
            title="Expand every category"
            @click="expandAll"
          >Expand all</button>
          <button
            type="button"
            class="px-2 py-1 text-xs rounded-md bg-white border border-slate-300 hover:bg-slate-100"
            title="Collapse to root"
            @click="collapseAll"
          >Collapse</button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs rounded-md bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 font-semibold"
            title="📧 Export — opens a preview window with the full 663-concept ontology, copies the colorful HTML + plain text to your clipboard, and opens a new Mail to Tom@Gilb.com. Press ⌘V in the mail body to paste the colourful version."
            @click="exportOntologyTree()"
          >📧 Export</button>
          <CloseDot size="lg" aria-label="Close Ontology Tree" @click="emit('close')" />
        </div>
      </header>

      <!-- SEARCH ROW -->
      <div class="flex items-center gap-3 px-5 py-3 border-b border-slate-200 shrink-0 bg-slate-50">
        <input
          v-model="queryText"
          type="text"
          placeholder="Filter by concept name, number (e.g. 233), type, or definition…"
          class="flex-1 px-3 py-2 text-sm border-2 border-violet-300 rounded-lg focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-200 bg-white"
          title="Filters the tree in real time — auto-expands the path to every matching concept"
        />
        <span
          v-if="queryText"
          class="text-xs px-2 py-1 rounded-md font-bold shrink-0"
          :class="matchCount > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'"
        >{{ matchCount }} match{{ matchCount === 1 ? '' : 'es' }}</span>
      </div>

      <!-- BODY -->
      <ScrollContainer class="flex-1 min-h-0 px-4 py-3">
        <div v-if="_loading" class="flex flex-col items-center justify-center py-16 gap-3">
          <div class="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p class="text-sm text-slate-600">Loading 663-concept ontology…</p>
        </div>
        <div v-else-if="_error" class="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-4">
          <p class="font-semibold mb-1">Could not load the ontology.</p>
          <p>{{ _error }}</p>
          <p class="text-xs mt-2 text-rose-600">
            Run <code class="bg-rose-100 px-1 rounded">python3 "/Users/Tomgilbs/Documents/MyVault/10.Standard/2.Glossary/PlanguageGlossary/_build-ontology-tree.py"</code>
            to regenerate, then refresh.
          </p>
        </div>
        <div v-else-if="_tree">
          <OntologyNodeRow
            :node="_tree.tree"
            :depth="0"
            :expanded-ids="expandedIds"
            :matched-ids="matchedIds"
            :query-active="!!queryText"
            @toggle="toggle"
          />
        </div>
      </ScrollContainer>

      <!-- FOOTER -->
      <footer class="px-5 py-2.5 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600 shrink-0">
        🌳 Every concept opens in the <strong>Tom Gilb Consultant Twin</strong> (free, no login).
        Categories (📂) collapse · concepts (🔹) link.
        <a href="https://www.gilb.com/tomtwin" target="_blank" rel="noopener" class="text-violet-700 font-bold ml-2 hover:underline">Open Twin home ↗</a>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* r02 — Visible 10 px violet scrollbar.  ScrollContainer's auto-hide CSS makes
 * the scroll affordance invisible to the user; a real native webkit scrollbar
 * matches the GilbIllustrationPicker (r36) pattern.  Tom Gilb 2026-06-14:
 *   "ontology tree, nice but no scrolling not export, RULE all large windoes
 *    SCROLLING AND EXPORT".
 * Selector targets the inner overflow-y-auto div inside .gilb-ontology-scroll
 * via :deep() — Vue scoped-styles otherwise wouldn't reach ScrollContainer.
 */
.gilb-ontology-scroll :deep(.overflow-y-auto)::-webkit-scrollbar {
  width: 10px;
}
.gilb-ontology-scroll :deep(.overflow-y-auto)::-webkit-scrollbar-track {
  background: #ede9fe;
}
.gilb-ontology-scroll :deep(.overflow-y-auto)::-webkit-scrollbar-thumb {
  background: #a78bfa;
  border-radius: 5px;
}
.gilb-ontology-scroll :deep(.overflow-y-auto)::-webkit-scrollbar-thumb:hover {
  background: #8b5cf6;
}
</style>
