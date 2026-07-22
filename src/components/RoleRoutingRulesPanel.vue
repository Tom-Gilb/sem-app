<!-- UNIT_TYPE=Component
  RoleRoutingRulesPanel.vue — Phase 4 FINAL of Roles redesign
  (Tom Gilb 2026-06-23 standing greenlight "then of course on with phase 2
  and on").

  Tom Gilb 14-point directive #14:
    "The creation of Roles will be as automatic as possible, with defaults
     used, and placeholders when none is nominated, or is within the Role
     Time Span Dates, or is generic, but with specific named individuals
     (Musks responsibility principle 1)."

  Tom 10-point Roles framework #5 + #8 — Default Responsibility for defined
  Roles + maximum automation of the role management.

  Three sections:
    1. Routing Rules table — view / add / edit / delete rules
    2. Preview + Apply — dry-run a routing pass, then Apply via Universal
       Undo SUPREME
    3. Placeholder Resolver — suggested named individuals per placeholder
       Stakeholder; Promote candidate via Universal Undo SUPREME

  Architecture mirrors RoleHealthDashboard.vue / RoleFlowDiagram.vue:
    • Teleport modal with TOP-aligned outer container
      (items-start ... pt-3 sm:pt-6 — v311 lesson: never items-center,
      it creates a white bar sliver above the panel header).
    • Backdrop click + Escape + CloseDot (SUPREME CloseDot rule).
    • Export pin → useAgentReportExport → to: '' (Mailto-No-Self-To SUPREME).
    • ScrollContainer wrapping body (ScrollContainer SUPREME rule).
    • Indigo→cyan→indigo gradient header.

  Composing rules:
    • Universal Undo SUPREME — every mutation routed through emit('apply-
      routing' / 'promote-placeholder') so App.vue can record() BEFORE.
    • No-Silent-Data-Loss SUPREME — fieldSources stamped by composable.
    • Conjunction-of-Technologies SUPREME — source-layer labels on
      every placeholder candidate.
    • Banned word `toast` → notification.
    • Banned word `complaint` → report / observation / issue.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { SpecBlock } from '../types/spec'
import {
  loadRoutingRulesFromStorage,
  saveRoutingRulesToStorage,
  loadDefaultRoutingRules,
  previewRoutingRules,
  type RoutingRule,
  type RoutingTargetField,
  type RoutingEntryType,
  type RoutingApplyResult,
} from '../composables/useRoleRoutingRules'
import {
  suggestPlaceholderResolutions,
  type PlaceholderSuggestion,
  type PlaceholderCandidate,
} from '../composables/useRolePlaceholderResolver'
import {
  exportAgentReport, type AgentExportCategoryGroup,
} from '../composables/useAgentReportExport'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'

const props = defineProps<{
  spec: SpecBlock | null
  planTitle: string
}>()

const emit = defineEmits<{
  close: []
  'apply-routing': [payload: { rules: RoutingRule[]; result: RoutingApplyResult }]
  'promote-placeholder': [payload: { stakeholderId: string; candidate: PlaceholderCandidate }]
}>()

// ── Persistent routing rules ────────────────────────────────────────────────
const rules = ref<RoutingRule[]>(loadRoutingRulesFromStorage())

function _persist(): void {
  saveRoutingRulesToStorage(rules.value)
}

// ── Add-rule editor state ───────────────────────────────────────────────────
const editorOpen = ref(false)
const editingRuleId = ref<string | null>(null)
const editLabel = ref('')
const editWhenTags = ref('')
const editEntryTypes = ref<RoutingEntryType[]>(['S'])
const editSetField = ref<RoutingTargetField>('specOwner')
const editSetToRoleTag = ref('')
const editPriority = ref(50)

const ENTRY_TYPE_OPTIONS: Array<{ value: RoutingEntryType; label: string }> = [
  { value: 'F', label: 'Function' },
  { value: 'V', label: 'Value' },
  { value: 'S', label: 'Solution' },
  { value: 'C', label: 'Constraint' },
  { value: 'R', label: 'Resource' },
]

const TARGET_FIELD_OPTIONS: Array<{ value: RoutingTargetField; label: string }> = [
  { value: 'specOwner',                 label: 'Spec Owner' },
  { value: 'implementationResponsible', label: 'Implementation Responsible' },
  { value: 'authority',                 label: 'Authority' },
]

function openEditorForNew(): void {
  editingRuleId.value = null
  editLabel.value = ''
  editWhenTags.value = ''
  editEntryTypes.value = ['S']
  editSetField.value = 'specOwner'
  editSetToRoleTag.value = ''
  editPriority.value = 50
  editorOpen.value = true
}

function openEditorForExisting(r: RoutingRule): void {
  editingRuleId.value = r.id
  editLabel.value = r.label
  editWhenTags.value = r.whenTags.join(', ')
  editEntryTypes.value = r.whenEntryTypes.slice()
  editSetField.value = r.setField
  editSetToRoleTag.value = r.setToRoleTag
  editPriority.value = r.priority
  editorOpen.value = true
}

function saveEditor(): void {
  const tagList = editWhenTags.value.split(',').map(s => s.trim()).filter(Boolean)
  if (!editLabel.value.trim() || !editSetToRoleTag.value.trim() || tagList.length === 0 || editEntryTypes.value.length === 0) {
    return
  }
  const nowIso = new Date().toISOString()
  if (editingRuleId.value) {
    const idx = rules.value.findIndex(r => r.id === editingRuleId.value)
    if (idx >= 0) {
      rules.value[idx] = {
        ...rules.value[idx],
        label:          editLabel.value.trim(),
        whenTags:       tagList,
        whenEntryTypes: editEntryTypes.value.slice(),
        setField:       editSetField.value,
        setToRoleTag:   editSetToRoleTag.value.trim(),
        priority:       editPriority.value,
      }
    }
  } else {
    const slug = editLabel.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'rule'
    const id = `${slug}-${Date.now().toString(36)}`
    rules.value.push({
      id,
      label:          editLabel.value.trim(),
      whenTags:       tagList,
      whenEntryTypes: editEntryTypes.value.slice(),
      whenScope:      'all',
      setField:       editSetField.value,
      setToRoleTag:   editSetToRoleTag.value.trim(),
      priority:       editPriority.value,
      source: {
        source:     'Planner-added Routing Rule',
        sourceType: 'human',
        timestamp:  nowIso,
        tool:       'RoleRoutingRulesPanel',
      },
      createdAt: nowIso,
      createdBy: '',
    })
  }
  _persist()
  editorOpen.value = false
}

function deleteRule(r: RoutingRule): void {
  rules.value = rules.value.filter(x => x.id !== r.id)
  _persist()
}

function resetToDefaults(): void {
  rules.value = loadDefaultRoutingRules()
  _persist()
}

function toggleEntryType(t: RoutingEntryType): void {
  if (editEntryTypes.value.includes(t)) {
    editEntryTypes.value = editEntryTypes.value.filter(x => x !== t)
  } else {
    editEntryTypes.value = [...editEntryTypes.value, t]
  }
}

// ── Preview + Apply ────────────────────────────────────────────────────────
const previewResult = ref<RoutingApplyResult | null>(null)

function runPreview(): void {
  if (!props.spec) {
    previewResult.value = { matchedEntries: [], skippedExisting: 0, totalScanned: 0 }
    return
  }
  previewResult.value = previewRoutingRules(props.spec, rules.value)
}

function applyRouting(): void {
  if (!props.spec) return
  // App.vue handler will run Universal Undo + mutate currentSpec.
  emit('apply-routing', { rules: rules.value, result: previewResult.value ?? { matchedEntries: [], skippedExisting: 0, totalScanned: 0 } })
  previewResult.value = null
}

// ── Placeholder Resolver ───────────────────────────────────────────────────
const placeholderSuggestions = computed<PlaceholderSuggestion[]>(() =>
  suggestPlaceholderResolutions(props.spec)
)

function promoteCandidate(stakeholderId: string, candidate: PlaceholderCandidate): void {
  emit('promote-placeholder', { stakeholderId, candidate })
}

// ── Reactivity ─────────────────────────────────────────────────────────────
watch(() => props.spec, () => { previewResult.value = null }, { deep: true })

// ── Escape-key + body-overflow lock ─────────────────────────────────────────
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (editorOpen.value) editorOpen.value = false
    else emit('close')
  }
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})

// ── Export handler — Export-Button-on-All-Windows SUPREME ───────────────────
// Mailto-No-Self-To SUPREME via useAgentReportExport (to: '' at line 226).
async function exportRoleRouting(): Promise<void> {
  const ruleFindings = rules.value.slice().sort((a, b) => a.priority - b.priority).map(r => ({
    id: `rule-${r.id}`,
    categoryLabel: 'Routing Rule',
    principleViolated: `${r.label}`,
    explanation: `When entry of type ${r.whenEntryTypes.join('/')} contains any of: ${r.whenTags.join(' · ')} — set ${r.setField} → ${r.setToRoleTag}.`,
    severityLabel: 'RULE',
    severityBgHex: '#0e7490',
    sourceLayerLabel: r.source.sourceType === 'system' ? 'Seeded default' : 'Planner-added',
    sourceLayerBgHex: r.source.sourceType === 'system' ? '#d1fae5' : '#fef3c7',
    triggeredBy: `priority ${r.priority}`,
    fixPlanguage: `Apply this rule to fill ${r.setField} on matching entries.`,
    fixRationale: 'Tom 10-point Roles framework #5 — default responsibility for defined Roles.',
    longTermConsequence: 'Roles auto-assigned by routing rules cut planning friction and prevent missing-owner gaps.',
    citations: [
      'Tom Gilb 14-point Roles directive #14 (Musk responsibility principle 1)',
      'Tom Gilb 10-point Roles framework #5 + #8 (2026-06-23)',
      'Solution Parameters SUPREME (v270)',
    ],
  }))

  const phFindings = placeholderSuggestions.value.map(ps => {
    const top = ps.candidates[0]
    return {
      id: `placeholder-${ps.stakeholderId}`,
      categoryLabel: 'Placeholder',
      principleViolated: `${ps.stakeholderId}${ps.position ? ' · ' + ps.position : ''} — needs a specific named individual`,
      explanation: ps.candidates.map(c => `${c.personName} (${c.source}, ${c.confidence}): ${c.rationale}`).join(' · '),
      severityLabel: top?.confidence === 'high' ? 'HIGH' : (top?.confidence === 'medium' ? 'MEDIUM' : 'LOW'),
      severityBgHex: top?.confidence === 'high' ? '#10b981' : (top?.confidence === 'medium' ? '#f59e0b' : '#94a3b8'),
      sourceLayerLabel: top?.source ?? 'generic-template',
      sourceLayerBgHex: top?.source === 'derived-from-existing-stakeholder' ? '#d1fae5'
                       : (top?.source === 'derived-from-plan' ? '#dbeafe' : '#f1f5f9'),
      triggeredBy: ps.stakeholderId,
      fixPlanguage: top ? `personName: "${top.personName}"` : '(no candidate)',
      fixRationale: 'Musk Responsibility Principle 1 — specific named individuals replace placeholders.',
      longTermConsequence: 'Unresolved placeholders mean accountability is undefined when the Role is invoked.',
      citations: [
        'Tom Gilb 14-point Roles directive #14',
        'Musk Responsibility Principle 1',
      ],
    }
  })

  const groups: AgentExportCategoryGroup[] = []
  if (ruleFindings.length > 0) {
    groups.push({
      categoryLabel: 'Routing Rules',
      categorySubtitle: `${ruleFindings.length} active rules; lower priority number = higher precedence`,
      findings: ruleFindings,
    })
  }
  if (phFindings.length > 0) {
    groups.push({
      categoryLabel: 'Placeholder Resolver suggestions',
      categorySubtitle: `${phFindings.length} placeholder Stakeholder${phFindings.length === 1 ? '' : 's'} awaiting a specific named individual`,
      findings: phFindings,
    })
  }

  const headline = `Role Routing · ${rules.value.length} rule${rules.value.length === 1 ? '' : 's'} active · ${placeholderSuggestions.value.length} placeholder${placeholderSuggestions.value.length === 1 ? '' : 's'} awaiting promotion.`

  await exportAgentReport({
    agentName:        '🎯 Role Routing & Placeholder Resolver',
    agentSubtitle:    'Default responsibility routing + Musk Principle 1 placeholder promotion',
    agentHeaderBgHex: '#0e7490',
    planTitle:        props.planTitle,
    totalFindings:    ruleFindings.length + phFindings.length,
    severityTally: [
      { label: 'Active Rules',  count: ruleFindings.length, bgHex: '#0e7490' },
      { label: 'Placeholders',  count: phFindings.length,   bgHex: '#f59e0b' },
    ],
    headline,
    groups,
    sourcesFooterHtml:
      '<b>Sources:</b> Tom Gilb 14-point Roles directive #14 (Musk responsibility principle 1) + ' +
      'Tom Gilb 10-point Roles framework #5 + #8 (2026-06-23) + Solution Parameters SUPREME (v270) + ' +
      'Stakeholder Engineering (Gilb 2025). Role IS Stakeholder (Tom #8/9).',
    subject:          `Role Routing & Placeholder Resolver · ${props.planTitle || '(Untitled Plan)'}`,
    artefactName:     'Role Routing & Placeholder Resolver',
  })
}

// Sort displayed rules by priority ascending.
const sortedRules = computed(() => rules.value.slice().sort((a, b) => a.priority - b.priority))
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[491] flex items-start justify-center pt-3 sm:pt-6"
      role="dialog"
      aria-modal="true"
      aria-label="Role Routing and Placeholder Resolver"
    >
      <!-- Backdrop click-to-close (SUPREME CloseDot rule) -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

      <!-- Panel surface -->
      <div
        class="relative w-[min(96vw,1280px)] h-[min(92vh,920px)] rounded-2xl bg-white shadow-2xl
               ring-2 ring-cyan-200/60 flex flex-col overflow-hidden"
      >
        <!-- Header band -->
        <div
          class="bg-gradient-to-r from-indigo-700 via-cyan-700 to-indigo-700 text-white px-6 py-4
                 flex items-center gap-4 shadow-lg"
        >
          <div class="h-14 w-14 rounded-full ring-2 ring-cyan-200 bg-white/15 flex items-center justify-center text-3xl shrink-0">🎯</div>
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-extrabold leading-tight">Role Routing &amp; Placeholder Resolver</h1>
            <p class="text-xs text-cyan-100/90 leading-snug">
              Default responsibility for defined Roles · Musk Principle 1 placeholder promotion · {{ planTitle || '(Untitled Plan)' }}
            </p>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-white text-cyan-900 text-xs font-bold shadow ring-1 ring-cyan-200 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 shrink-0"
            title="📤 Export · open preview + copy colourful HTML to clipboard + auto-open Mail (Copy / Mail / Preview in one action)"
            @click="exportRoleRouting"
          >📤 Export</button>
          <!-- v530 — Unrelated-Actions-Get-Visual-Space SUPREME (Tom Gilb 2026-07-22) -->
          <div class="w-px h-6 bg-slate-300 mx-2" aria-hidden="true" />
          <CloseDot size="lg" @click="emit('close')" />
        </div>

        <!-- Summary band -->
        <div class="bg-cyan-50 border-b border-cyan-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
          <p class="flex-1 min-w-0 text-sm font-semibold text-cyan-950">
            {{ rules.length }} routing rule{{ rules.length === 1 ? '' : 's' }} active ·
            {{ placeholderSuggestions.length }} placeholder{{ placeholderSuggestions.length === 1 ? '' : 's' }} awaiting a specific named individual
          </p>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-cyan-700 text-white shadow hover:bg-cyan-800 shrink-0"
            title="Add a new routing rule"
            @click="openEditorForNew"
          >＋ Add Rule</button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-200 text-slate-800 hover:bg-slate-300 shrink-0"
            title="Reset all routing rules to seeded defaults (your custom rules will be discarded)"
            @click="resetToDefaults"
          >Reset to defaults</button>
        </div>

        <!-- Body (scrollable) -->
        <ScrollContainer class="flex-1 min-h-0" outer-class="bg-slate-50">
          <div class="px-6 py-5 space-y-6">

            <!-- ── Section 1: Routing Rules ─────────────────────────────── -->
            <section class="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                <h2 class="text-sm font-extrabold text-slate-800">Routing Rules</h2>
                <span class="text-[11px] text-slate-500 leading-snug truncate">
                  When entry tag/description matches → auto-fill target field with Role tag (priority asc)
                </span>
                <span class="ml-auto shrink-0 text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                  {{ rules.length }} rule{{ rules.length === 1 ? '' : 's' }}
                </span>
              </div>

              <ul v-if="sortedRules.length > 0" class="divide-y divide-slate-200">
                <li
                  v-for="r in sortedRules"
                  :key="r.id"
                  class="px-4 py-3 flex items-start gap-3 flex-wrap hover:bg-slate-50"
                >
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-700 text-white shrink-0 tabular-nums"
                    title="Priority — lower number wins when multiple rules match the same entry+field"
                  >P{{ r.priority }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-slate-900">{{ r.label }}</p>
                    <p class="text-[11px] text-slate-600 leading-snug">
                      When <span class="font-mono font-bold">{{ r.whenEntryTypes.join('/') }}</span>
                      contains: <span class="font-mono">{{ r.whenTags.join(' · ') }}</span>
                      → set <span class="font-bold">{{ r.setField }}</span>
                      = <span class="font-bold text-cyan-800">{{ r.setToRoleTag }}</span>
                    </p>
                    <p class="text-[10px] text-slate-500 leading-snug">
                      <span
                        :class="r.source.sourceType === 'system'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-100 text-amber-900'"
                        class="px-1.5 py-0.5 rounded font-bold"
                      >{{ r.source.sourceType === 'system' ? 'Seeded default' : 'Planner-added' }}</span>
                      <span class="ml-1">{{ r.createdAt.slice(0, 10) }}</span>
                    </p>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      class="px-2 py-1 rounded text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-800"
                      title="Edit this routing rule"
                      @click="openEditorForExisting(r)"
                    >Edit</button>
                    <button
                      type="button"
                      class="px-2 py-1 rounded text-[10px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800"
                      title="Delete this routing rule"
                      @click="deleteRule(r)"
                    >Delete</button>
                  </div>
                </li>
              </ul>
              <div v-else class="px-6 py-8 text-center text-slate-500 text-sm">
                No routing rules. Press <b>＋ Add Rule</b> or <b>Reset to defaults</b> to seed.
              </div>
            </section>

            <!-- ── Section 1b: Inline Add/Edit editor ────────────────────── -->
            <section
              v-if="editorOpen"
              class="rounded-xl bg-indigo-50 ring-1 ring-indigo-200 px-4 py-4 space-y-3"
            >
              <h3 class="text-sm font-extrabold text-indigo-900">
                {{ editingRuleId ? 'Edit routing rule' : 'Add routing rule' }}
              </h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="block">
                  <span class="block text-[11px] font-bold text-indigo-900">Label</span>
                  <input
                    v-model="editLabel"
                    type="text"
                    class="mt-1 w-full text-sm px-2 py-1.5 rounded border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="e.g. Security / privacy → CISO"
                  />
                </label>
                <label class="block">
                  <span class="block text-[11px] font-bold text-indigo-900">Role tag to assign</span>
                  <input
                    v-model="editSetToRoleTag"
                    type="text"
                    class="mt-1 w-full text-sm px-2 py-1.5 rounded border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="e.g. CISO · QA Lead"
                  />
                </label>
                <label class="block sm:col-span-2">
                  <span class="block text-[11px] font-bold text-indigo-900">
                    Trigger tags (comma-separated, case-insensitive)
                  </span>
                  <input
                    v-model="editWhenTags"
                    type="text"
                    class="mt-1 w-full text-sm px-2 py-1.5 rounded border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="e.g. security, privacy, encryption"
                  />
                </label>
                <div class="block">
                  <span class="block text-[11px] font-bold text-indigo-900">Applies to entry types</span>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <button
                      v-for="opt in ENTRY_TYPE_OPTIONS"
                      :key="opt.value"
                      type="button"
                      :class="editEntryTypes.includes(opt.value)
                        ? 'bg-indigo-700 text-white'
                        : 'bg-white text-indigo-700 ring-1 ring-indigo-300'"
                      class="px-2 py-1 rounded text-[10px] font-bold"
                      @click="toggleEntryType(opt.value)"
                    >{{ opt.label }}</button>
                  </div>
                </div>
                <label class="block">
                  <span class="block text-[11px] font-bold text-indigo-900">Set field</span>
                  <select
                    v-model="editSetField"
                    class="mt-1 w-full text-sm px-2 py-1.5 rounded border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option v-for="opt in TARGET_FIELD_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </label>
                <label class="block">
                  <span class="block text-[11px] font-bold text-indigo-900">Priority (lower = wins ties)</span>
                  <input
                    v-model.number="editPriority"
                    type="number"
                    min="1"
                    max="9999"
                    class="mt-1 w-full text-sm px-2 py-1.5 rounded border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </label>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800"
                  title="Save this rule"
                  @click="saveEditor"
                >Save rule</button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-xs font-bold bg-slate-200 text-slate-800 hover:bg-slate-300"
                  title="Discard changes and close the editor"
                  @click="editorOpen = false"
                >Cancel</button>
              </div>
            </section>

            <!-- ── Section 2: Preview + Apply ───────────────────────────── -->
            <section class="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                <h2 class="text-sm font-extrabold text-slate-800">Apply Routing</h2>
                <span class="text-[11px] text-slate-500 leading-snug truncate">
                  Preview the changes (dry-run); Apply mutates the spec via Universal Undo
                </span>
                <span class="ml-auto shrink-0 flex items-center gap-1.5">
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-200 text-slate-800 hover:bg-slate-300"
                    title="Run a dry-run preview — no mutation, just a list of proposed changes"
                    @click="runPreview"
                  >Preview</button>
                  <button
                    type="button"
                    :disabled="!previewResult || previewResult.matchedEntries.length === 0"
                    class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
                    title="Apply the previewed changes — recorded by Universal Undo (⌘Z reverts)"
                    @click="applyRouting"
                  >Apply</button>
                </span>
              </div>

              <div v-if="!previewResult" class="px-6 py-8 text-center text-slate-500 text-sm">
                Press <b>Preview</b> to see which entries would be auto-filled by the active rules.
              </div>
              <div v-else-if="previewResult.matchedEntries.length === 0" class="px-6 py-8 text-center text-slate-500 text-sm">
                Preview found <b>0</b> matching entries — every potential target already has a value, or no entry text matches the active rules.
                <span class="block mt-1 text-[11px]">{{ previewResult.totalScanned }} entries scanned · {{ previewResult.skippedExisting }} skipped (already populated)</span>
              </div>
              <div v-else>
                <p class="px-4 py-2 text-[11px] font-semibold text-slate-700 bg-emerald-50 border-b border-emerald-200">
                  {{ previewResult.matchedEntries.length }} change{{ previewResult.matchedEntries.length === 1 ? '' : 's' }} proposed ·
                  {{ previewResult.skippedExisting }} skipped (already populated) ·
                  {{ previewResult.totalScanned }} entries scanned
                </p>
                <ul class="divide-y divide-slate-200">
                  <li
                    v-for="c in previewResult.matchedEntries"
                    :key="c.entryId + '-' + c.field + '-' + c.ruleId"
                    class="px-4 py-2 text-[12px] flex items-center gap-2 flex-wrap"
                  >
                    <span class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 font-mono font-bold text-[10px]">{{ c.entryType }}</span>
                    <span class="font-mono font-bold text-slate-900">{{ c.entryId }}</span>
                    <span class="text-slate-500">·</span>
                    <span class="font-semibold text-slate-700">{{ c.field }}</span>
                    <span class="text-slate-500">→</span>
                    <span class="font-bold text-cyan-800">{{ c.newValue }}</span>
                    <span class="ml-auto text-[10px] text-slate-500 italic">via {{ c.ruleLabel }}</span>
                  </li>
                </ul>
              </div>
            </section>

            <!-- ── Section 3: Placeholder Resolver ──────────────────────── -->
            <section class="rounded-xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                <h2 class="text-sm font-extrabold text-slate-800">Placeholder Resolver</h2>
                <span class="text-[11px] text-slate-500 leading-snug truncate">
                  Musk Principle 1 — every Role gets a specific named individual
                </span>
                <span class="ml-auto shrink-0 text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                  {{ placeholderSuggestions.length }} placeholder{{ placeholderSuggestions.length === 1 ? '' : 's' }}
                </span>
              </div>

              <div v-if="placeholderSuggestions.length === 0" class="px-6 py-8 text-center text-emerald-700 text-sm font-semibold">
                ✓ No placeholders — every Stakeholder has a specific named individual.
              </div>

              <ul v-else class="divide-y divide-slate-200">
                <li
                  v-for="ps in placeholderSuggestions"
                  :key="ps.stakeholderId"
                  class="px-4 py-3"
                >
                  <p class="text-sm font-bold text-slate-900">
                    {{ ps.stakeholderId }}
                    <span v-if="ps.position" class="text-xs font-medium text-slate-600">· {{ ps.position }}</span>
                    <span class="ml-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-900 ring-1 ring-amber-300 px-1.5 py-0.5 rounded">placeholder</span>
                  </p>
                  <ul class="mt-1.5 space-y-1.5">
                    <li
                      v-for="c in ps.candidates"
                      :key="ps.stakeholderId + '|' + c.personName"
                      class="flex items-center gap-2 flex-wrap text-[12px]"
                    >
                      <span
                        :class="c.confidence === 'high' ? 'bg-emerald-100 text-emerald-900'
                              : c.confidence === 'medium' ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-200 text-slate-700'"
                        class="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                      >{{ c.confidence.toUpperCase() }}</span>
                      <span class="font-bold text-slate-900">{{ c.personName }}</span>
                      <span class="text-[10px] text-slate-500 italic">{{ c.source }}</span>
                      <span class="text-[11px] text-slate-600 truncate">— {{ c.rationale }}</span>
                      <button
                        type="button"
                        :disabled="c.source === 'generic-template'"
                        class="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-700 text-white hover:bg-cyan-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shrink-0"
                        title="Promote this candidate — recorded by Universal Undo (⌘Z reverts)"
                        @click="promoteCandidate(ps.stakeholderId, c)"
                      >Promote</button>
                    </li>
                  </ul>
                </li>
              </ul>
            </section>

          </div>
        </ScrollContainer>

        <!-- Footer -->
        <div class="border-t border-slate-200 bg-white px-6 py-3 flex items-center gap-3 shrink-0">
          <p class="text-[11px] text-slate-500 leading-snug flex-1">
            Source:
            <span class="font-semibold">Tom Gilb 14-point Roles directive #14</span> (Musk responsibility principle 1) +
            <span class="font-semibold">Tom 10-point Roles framework #5 + #8</span> (2026-06-23) +
            <span class="font-semibold">Solution Parameters SUPREME (v270)</span> +
            <span class="font-semibold">Stakeholder Engineering (Gilb 2025)</span>.
          </p>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-900 text-xs font-semibold"
            title="Close the Role Routing &amp; Placeholder Resolver"
            @click="emit('close')"
          >Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
