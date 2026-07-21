<script setup lang="ts">
/**
 * OntologyNodeRow — recursive tree-row for PlanguageOntologyDiagram.
 * Each row is either a category (📂, collapsible) or a concept (🔹, clickable link).
 */
import { computed } from 'vue'

interface OntologyNode {
  id:             string
  kind:           'class' | 'concept'
  name:           string
  conceptNumber?: string
  type?:          string
  keyedIcon?:     string
  twinUrl?:       string
  definition?:    string
  slug?:          string
  children:       OntologyNode[]
}

const props = defineProps<{
  node:          OntologyNode
  depth:         number
  expandedIds:   Set<string>
  matchedIds:    Set<string>
  queryActive:   boolean
}>()

const emit = defineEmits<{ (e: 'toggle', id: string): void }>()

const isExpanded = computed(() => props.expandedIds.has(props.node.id))
const isMatch    = computed(() => props.matchedIds.has(props.node.id))
const hasChildren = computed(() => props.node.children.length > 0)

// When a search is active, only render rows that are on a match path —
// dramatically simplifies the rendered tree.
const visibleChildren = computed(() => {
  if (!props.queryActive) return props.node.children
  return props.node.children.filter(c => props.matchedIds.has(c.id))
})

const indentPx = computed(() => `${props.depth * 16}px`)
</script>

<template>
  <div>
    <!-- Row -->
    <div
      class="flex items-center gap-1 py-0.5 px-1 rounded hover:bg-violet-50 transition-colors"
      :class="{ 'bg-amber-50/60 ring-1 ring-amber-300': queryActive && isMatch && node.kind === 'concept' }"
      :style="{ paddingLeft: indentPx }"
    >
      <!-- Expand/collapse chevron — only for categories with children -->
      <button
        v-if="hasChildren"
        type="button"
        class="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-800 shrink-0"
        :title="isExpanded ? 'Collapse' : 'Expand'"
        @click="emit('toggle', node.id)"
      >
        <span class="text-[10px]" aria-hidden="true">{{ isExpanded ? '▼' : '▶' }}</span>
      </button>
      <span v-else class="w-5 shrink-0" aria-hidden="true"></span>

      <!-- Icon + label -->
      <template v-if="node.kind === 'class'">
        <!-- Category — clickable to expand/collapse -->
        <button
          type="button"
          class="flex items-center gap-1 text-left flex-1 min-w-0 text-[12px] font-semibold text-violet-800 hover:text-violet-900"
          :title="`Category: ${node.name}${node.slug ? ' · ' + node.slug : ''} · ${node.children.length} child${node.children.length === 1 ? '' : 'ren'}`"
          @click="emit('toggle', node.id)"
        >
          <span aria-hidden="true">📂</span>
          <span class="truncate">{{ node.name }}</span>
          <span class="text-[10px] text-slate-400 font-normal">({{ node.children.length }})</span>
        </button>
      </template>
      <template v-else>
        <!-- Concept — clickable link opens Twin Consultant -->
        <a
          :href="node.twinUrl"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1.5 flex-1 min-w-0 text-[12px] text-emerald-800 hover:text-emerald-900 hover:underline"
          :title="`${node.name} *${node.conceptNumber}${node.type ? ' (' + node.type + ')' : ''}${node.definition ? ' — ' + node.definition : ''} — click to open on Tom Gilb Consultant Twin (free, no login)`"
        >
          <span aria-hidden="true">🔹</span>
          <span class="font-semibold truncate">{{ node.name }}</span>
          <span class="text-[10px] text-violet-600 font-mono shrink-0">*{{ node.conceptNumber }}</span>
          <span v-if="node.type" class="text-[10px] text-slate-500 italic truncate">{{ node.type }}</span>
          <span v-if="node.keyedIcon" class="text-[10px] text-slate-400 font-mono shrink-0" :title="`Keyed icon: ${node.keyedIcon}`">{{ node.keyedIcon.split(' ')[0].slice(0, 5) }}</span>
          <span aria-hidden="true" class="text-[10px] text-violet-400 shrink-0">↗</span>
        </a>
      </template>
    </div>

    <!-- Children -->
    <div v-if="isExpanded && visibleChildren.length">
      <OntologyNodeRow
        v-for="child in visibleChildren"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :expanded-ids="expandedIds"
        :matched-ids="matchedIds"
        :query-active="queryActive"
        @toggle="(id) => emit('toggle', id)"
      />
    </div>
  </div>
</template>
