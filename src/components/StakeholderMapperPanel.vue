<!--
  StakeholderMapperPanel.vue — AI-Drafted Stakeholder Attribute Profiles.

  Full-screen indigo panel at z-[600]. Left sidebar lists stakeholders;
  right content shows a 10-attribute profile grid for the selected entity.
  Supports inanimate stakeholders (data, regulations) — uses "entities",
  not "people".

  UI Rules satisfied:
    ScrollContainer rule  — all scrollable areas wrapped in ScrollContainer.
    CloseDot rule         — CloseDot variant="on-dark" at END of header.
    Single-Surface rule   — caller registers 'stakeholderMapper'.
    Define-by-Selection   — no select-none on body content.
    DD-009 Zero-Training  — all buttons have title= attribute.
    z-[600]               — within Major surfaces tier; below z-[700] SelectionDefiner.
    Static Tailwind only  — no runtime class concatenation.
    Inanimate support     — UI says "entities", not "people".
-->
<script setup lang="ts">
// UNIT_TYPE=Panel
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import EditGlyph from './icons/EditGlyph.vue'
import {
  useStakeholderMapper,
  ATTRIBUTE_DEFS,
} from '../composables/useStakeholderMapper'
import type { MappedStakeholder, StakeholderType, AttributeLevel } from '../composables/useStakeholderMapper'
import { useModelLibrary } from '../composables/useModelLibrary'
import type { ModelEntry } from '../composables/useModelLibrary'
import { useAmuseLifecycle } from '../composables/useAmuseLifecycle'
import {
  exportArtefact,
  htmlEsc,
  softWrap,
  htmlDocumentShell,
  sectionHeaderHtml,
} from '../composables/useExportShared'

const emit = defineEmits<{
  close: []
  /** User clicked Agents — App.vue should close this panel and open AgentMenuPanel. */
  'open-agents': []
}>()

// ── Composable ────────────────────────────────────────────────────────────────

const mapper  = useStakeholderMapper()
const library = useModelLibrary()
const {
  generateInitialModel,
  autoGenerateStatus,
  autoGenerateError,
} = library

/** Active model from Model Library (set when opened via → Map Stakeholders). */
const activeModel = computed(() =>
  library.activeModelId.value
    ? library.allEntries.value.find(e => e.id === library.activeModelId.value) ?? null
    : null,
)

// ── Auto-generate: trigger initial Planguage model when entries are empty ─────

/**
 * Per-active-model auto-generate status convenience computed.
 * Tom 2026-05-31: "if there are not [stakeholders], planguage was not generated,
 * then there needs to be automatic generation of a Planguage model, including
 * some stakeholders, which are then displayed."
 */
const autoGenStatus = computed<'idle' | 'generating' | 'done' | 'error'>(() =>
  activeModel.value
    ? (autoGenerateStatus.value.get(activeModel.value.id) ?? 'idle')
    : 'idle',
)

const autoGenErrorMsg = computed<string>(() =>
  activeModel.value
    ? (autoGenerateError.value.get(activeModel.value.id) ?? '')
    : '',
)

/**
 * Trigger auto-generation when a model is active and has no entries yet.
 * immediate:true handles the case where the model was already set when the
 * panel mounted.  Guards prevent re-triggering if already running or done.
 */
watch(
  activeModel,
  (model) => {
    if (!model) return
    if (model.entries.length > 0) return           // already has Planguage content
    if (model.source === 'built-in') return        // built-in models are pre-authored
    const status = autoGenerateStatus.value.get(model.id)
    if (status === 'generating' || status === 'done') return
    void generateInitialModel(model.id)
  },
  { immediate: true },
)

// ── Navigation / form state ───────────────────────────────────────────────────

const searchQuery    = ref('')
const showAddForm    = ref(false)
const newName        = ref('')
const newRole        = ref('')
const newType        = ref<StakeholderType>('organization')
const newDescription = ref('')

// Attribute inline-edit state
const editingAttrId    = ref<string | null>(null)
const editAttrValue    = ref<number>(3)
const editAttrUrl      = ref('')
const editAttrFact     = ref('')

// ── Derived data ──────────────────────────────────────────────────────────────

/**
 * Model S. entries when an active model is set.
 * Tom 2026-05-31: "logic error, we need to look at the stakeholders of
 * the current model only, and those should be listed on left instead."
 * When a model is active, only its S. (Stakeholder) type entries are shown
 * in the sidebar. When no model is active, fall back to the global list.
 */
const modelSEntries = computed<ModelEntry[]>(() =>
  (activeModel.value?.entries ?? []).filter(e => e.type === 'S'),
)

/**
 * Sidebar display list.
 * Priority: if active model set → filter to model's S. entries only
 * (cross-referenced with mapper to show analysis status).
 * If no active model → show entire global mapper list (legacy).
 */
const filteredStakeholders = computed<MappedStakeholder[]>(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (activeModel.value) {
    // When model is set, derive sidebar from model's S. entries
    // Any S. entry that already has a MappedStakeholder record (name match)
    // is shown in full; others appear with a minimal synthesised record so
    // the user can click "Analyze" from the sidebar.
    const mapped = mapper.stakeholders.value
    const candidates: MappedStakeholder[] = modelSEntries.value
      .map(entry => {
        const name = entry.description.trim()
        const existing = mapped.find(s => s.name.toLowerCase() === name.toLowerCase())
        if (existing) return existing
        // Synthesise a lightweight placeholder so the entry shows in the list
        return {
          id:          `model-seed-${entry.id ?? name}`,
          name,
          role:        entry.details?.trim() || 'Stakeholder from model',
          type:        'organization' as StakeholderType,
          description: entry.details?.trim() || '',
          attributes:  {},
        } satisfies MappedStakeholder
      })
    if (!q) return candidates
    return candidates.filter(
      s => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q),
    )
  }
  // No active model — show global store
  if (!q) return mapper.stakeholders.value
  return mapper.stakeholders.value.filter(
    s => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q),
  )
})

const selected = computed<MappedStakeholder | null>(() => {
  const id = mapper.selectedId.value
  if (!id) return null
  return mapper.stakeholders.value.find(s => s.id === id) ?? null
})

// ── Type chip helpers (static class map — no runtime concatenation) ───────────

const TYPE_CHIP_CLASS: Record<StakeholderType, string> = {
  organization: 'bg-blue-100 text-blue-700',
  government:   'bg-purple-100 text-purple-700',
  person:       'bg-sky-100 text-sky-700',
  system:       'bg-amber-100 text-amber-700',
  regulatory:   'bg-fuchsia-100 text-fuchsia-700',
  inanimate:    'bg-slate-100 text-slate-600',
}

const TYPE_LABEL: Record<StakeholderType, string> = {
  organization: 'Org',
  government:   'Gov',
  person:       'Person',
  system:       'System',
  regulatory:   'Regulatory',
  inanimate:    'Inanimate',
}

// ── Confidence badge (static class map) ───────────────────────────────────────

const CONF_CLASS: Record<string, string> = {
  high:   'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-orange-100 text-orange-700',
}

const CONF_LABEL: Record<string, string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
}

// ── Severity dot colours (static) ─────────────────────────────────────────────
// (not used in this panel but kept for completeness)

// ── Actions ───────────────────────────────────────────────────────────────────

function select(id: string): void {
  mapper.selectStakeholder(id)
  showAddForm.value = false
}

function openAdd(): void {
  showAddForm.value  = true
  newName.value      = ''
  newRole.value      = ''
  newType.value      = 'organization'
  newDescription.value = ''
  mapper.selectStakeholder(null)
}

function cancelAdd(): void {
  showAddForm.value = false
}

function submitAdd(): void {
  if (!newName.value.trim()) return
  const sh = mapper.addStakeholder(
    newName.value,
    newRole.value,
    newType.value,
    newDescription.value,
  )
  showAddForm.value = false
  mapper.selectStakeholder(sh.id)
}

function analyze(id: string): void {
  void mapper.draftAttributes(id)
}

function removeSelected(): void {
  if (!selected.value) return
  mapper.removeStakeholder(selected.value.id)
}

// ── Attribute inline edit ─────────────────────────────────────────────────────

function startEdit(attrId: string, attr: AttributeLevel | undefined): void {
  editingAttrId.value = attrId
  editAttrValue.value = attr?.value ?? 3
  editAttrUrl.value   = attr?.sourceUrl ?? ''
  editAttrFact.value  = attr?.sourceFact ?? ''
}

function saveEdit(): void {
  if (!selected.value || !editingAttrId.value) return
  const id     = selected.value.id
  const attrId = editingAttrId.value
  const def    = ATTRIBUTE_DEFS.find(a => a.id === attrId)
  if (!def) return
  const levelDef = def.levels[editAttrValue.value - 1]

  const updated = {
    ...selected.value.attributes,
    [attrId]: {
      value:       editAttrValue.value,
      levelLabel:  levelDef.label,
      confidence:  'high' as const,
      sourceUrl:   editAttrUrl.value.trim(),
      sourceFact:  editAttrFact.value.trim(),
      aiRationale: '',
      lastUpdated: new Date().toISOString(),
    } satisfies AttributeLevel,
  }
  mapper.updateStakeholder(id, { attributes: updated })
  editingAttrId.value = null
}

function cancelEdit(): void {
  editingAttrId.value = null
}

// ── URL display helper ────────────────────────────────────────────────────────

function truncateUrl(url: string, maxLen = 40): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    const display = u.hostname + u.pathname
    return display.length > maxLen ? display.slice(0, maxLen - 1) + '…' : display
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen - 1) + '…' : url
  }
}

// ── Summary score (average of all 10 attributes) ──────────────────────────────

function avgScore(sh: MappedStakeholder): number | null {
  const vals = ATTRIBUTE_DEFS.map(a => sh.attributes[a.id]?.value).filter(v => v != null) as number[]
  if (vals.length === 0) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10
}

// ── Rule 8: Loading-state (4-element: spinner + elapsed + progress + amuse) ──

const STAKEHOLDER_WISDOM = [
  {
    emoji: '👥',
    title: 'Stakeholders Include the Inanimate',
    text: 'In Planguage, any entity whose needs must be respected is a Stakeholder. Data has privacy needs. Laws have compliance requirements. Systems have interface constraints. All are S. entries — not just people and organisations.',
    ref: 'Tom Gilb, 2026-05-15 — "all data is a stakeholder, it has needs like GDPR"',
  },
  {
    emoji: '⚡',
    title: 'Power vs Interest Matrix',
    text: 'High Power + High Interest = manage closely. High Power + Low Interest = keep satisfied. Low Power + High Interest = keep informed. Low Power + Low Interest = monitor. These four quadrants guide engagement strategy without a single meeting.',
    ref: 'Stakeholder Engineering, Gilb 2004 — Attribute: Influence',
  },
  {
    emoji: '🌍',
    title: '10 Attributes Per Entity',
    text: 'Each stakeholder is profiled on: Power, Interest, Influence, Urgency, Legitimacy, Volatility, Proximity, Dependency, Expertise, and Alignment. Together these paint a complete picture of who shapes success — and how.',
    ref: 'SEM StakeholderMapper — useStakeholderMapper.ts ATTRIBUTE_DEFS',
  },
  {
    emoji: '📋',
    title: 'Source Every Claim',
    text: 'An attribute level without a source is an opinion. The AI drafts each level from real knowledge — citing URLs and specific facts. Your job is to verify, correct, and extend. Sourced profiles are defensible in stakeholder reviews.',
    ref: 'gilb.com — Planguage principle: Testability',
  },
  {
    emoji: '🏛️',
    title: 'Regulatory Stakeholders Are Always C. Entries',
    text: 'GDPR, HIPAA, ISO standards, financial regulations — these are stakeholders whose requirements translate directly into Constraint (C.) entries. They cannot be negotiated. Identifying them early prevents costly late-stage compliance rework.',
    ref: 'Tom Gilb — inanimate stakeholders principle; Template_Write_Constraint.md',
  },
  {
    emoji: '🔄',
    title: 'Stakeholders Change Over Time',
    text: 'A stakeholder who was low-power at project start may gain power as the project scales. Re-running the analysis at each Evo step — Measure and Learn — keeps stakeholder intelligence current rather than stale.',
    ref: 'EVO 2024, Gilb — Step 8: Measure; Step 9: Learn',
  },
  {
    emoji: '🎯',
    title: 'S. Entries Feed the Entire Plan',
    text: 'Stakeholder entries (S.) are not isolated — they seed the rest of the Planguage model. Each stakeholder\'s needs become V. or C. entries. Their resources become R. entries. Their required functions become F. entries. Start with stakeholders; the plan follows.',
    ref: 'Proc_v_p_o_SpecifyFunction.md — 10.Standard/Standard.Kai-Zen/',
  },
  {
    emoji: '📊',
    title: 'Alignment Determines Plan Health',
    text: 'A stakeholder with high power and low alignment is the single biggest threat to plan success. Identifying misaligned high-power stakeholders early — before delivery — allows engagement strategies to be built into the plan as explicit actions.',
    ref: 'Competitive Engineering, Gilb 2005 — Stakeholder section',
  },
] as const

const smElapsed           = ref(0)
const smSimulatedProgress = ref(0)
const smActiveWisdomIdx   = ref(0)

let _smElapsedTimer: ReturnType<typeof setInterval> | null = null
let _smWisdomTimer:  ReturnType<typeof setInterval> | null = null
let _smAnimStart = 0

function _startStakeholderLoadingAnim(): void {
  _smAnimStart = Date.now()
  smElapsed.value = 0; smSimulatedProgress.value = 0
  if (_smElapsedTimer) { clearInterval(_smElapsedTimer); _smElapsedTimer = null }
  if (_smWisdomTimer)  { clearInterval(_smWisdomTimer);  _smWisdomTimer  = null }
  _smElapsedTimer = setInterval(() => {
    const secs = Math.round((Date.now() - _smAnimStart) / 1000)
    smElapsed.value = secs
    smSimulatedProgress.value = Math.round(Math.min(95, (1 - Math.exp(-secs / 30)) * 100))
  }, 250)
  _smWisdomTimer = setInterval(() => {
    smActiveWisdomIdx.value = (smActiveWisdomIdx.value + 1) % STAKEHOLDER_WISDOM.length
  }, 8_000)
}

function _stopStakeholderLoadingAnim(): void {
  if (_smElapsedTimer) { clearInterval(_smElapsedTimer); _smElapsedTimer = null }
  if (_smWisdomTimer)  { clearInterval(_smWisdomTimer);  _smWisdomTimer  = null }
  smSimulatedProgress.value = 100
}

watch(
  () => autoGenStatus.value === 'generating',
  (nowGenerating) => {
    if (nowGenerating) { smActiveWisdomIdx.value = 0; _startStakeholderLoadingAnim() }
    else               { _stopStakeholderLoadingAnim() }
  },
  { immediate: true },
)

// ── Continue Amuse Me (useAmuseLifecycle) ──────────────────────────────────
// Keeps the wisdom carousel visible for 10 s after generation completes.
const _smIsGenerating = computed(() => autoGenStatus.value === 'generating')
const {
  amuseActive:    smAmuseActive,
  amuseFinishing: smAmuseFinishing,
  amuseCountdown: smAmuseCountdown,
  extendAmuse:    smExtendAmuse,
} = useAmuseLifecycle(_smIsGenerating)

// ── Per-stakeholder attribute drafting timer (separate from auto-gen timer) ──

const shDraftElapsed           = ref(0)
const shDraftSimulatedProgress = ref(0)

let _shDraftElapsedTimer: ReturnType<typeof setInterval> | null = null
let _shDraftAnimStart = 0

function _startDraftingAnim(): void {
  _shDraftAnimStart = Date.now()
  shDraftElapsed.value = 0; shDraftSimulatedProgress.value = 0
  if (_shDraftElapsedTimer) { clearInterval(_shDraftElapsedTimer); _shDraftElapsedTimer = null }
  _shDraftElapsedTimer = setInterval(() => {
    const secs = Math.round((Date.now() - _shDraftAnimStart) / 1000)
    shDraftElapsed.value = secs
    shDraftSimulatedProgress.value = Math.round(Math.min(95, (1 - Math.exp(-secs / 20)) * 100))
  }, 250)
}

function _stopDraftingAnim(): void {
  if (_shDraftElapsedTimer) { clearInterval(_shDraftElapsedTimer); _shDraftElapsedTimer = null }
  shDraftSimulatedProgress.value = 100
}

watch(
  () => selected.value?.draftStatus === 'drafting',
  (nowDrafting) => {
    if (nowDrafting) _startDraftingAnim()
    else             _stopDraftingAnim()
  },
)

onUnmounted(() => {
  _stopStakeholderLoadingAnim()
  _stopDraftingAnim()
})

// ── Export · Full Model — Tom Gilb 2026-06-06 universal Export rule ──────────

function _renderStakeholdersHtml(): string {
  const sh = filteredStakeholders.value
  const headerHtml = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px 0;border-collapse:collapse;">
  <tr><td bgcolor="#1d4ed8" style="background:#1d4ed8;color:#ffffff;padding:8px 22px;font:700 18px/1.4 'Helvetica Neue',Arial,sans-serif;">Stakeholder Mapper · Attribute Profiles</td></tr>
  <tr><td bgcolor="#2563eb" style="background:#2563eb;color:#dbeafe;padding:4px 22px 10px 22px;font:600 11px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;">${sh.length} stakeholders profiled</td></tr>
</table>`

  let shRows = ''
  for (const s of sh) {
    const nameLines = softWrap(s.name, 60)
    const nameRowsHtml = nameLines.map((line, i) =>
      `<tr><td bgcolor="#dbeafe" style="background:#dbeafe;color:#1e3a8a;padding:${i === 0 ? '4' : '1'}px 18px;font:${i === 0 ? '700' : '400'} 12px/1.5 'Helvetica Neue',Arial,sans-serif;">${htmlEsc(line)}</td></tr>`
    ).join('')
    const attrEntries = Object.entries(s.attributes ?? {})
    const attrRowsHtml = attrEntries.length > 0
      ? attrEntries.map(([attr, level]) =>
          `<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:2px 18px;font:400 11px/1.4 'Helvetica Neue',Arial,sans-serif;color:#1f2937;"><b>${htmlEsc(attr)}:</b> ${htmlEsc(String(level))}</td></tr>`
        ).join('')
      : `<tr><td bgcolor="#fef3c7" style="background:#fef3c7;color:#78350f;padding:3px 18px;font:400 10px/1.4 'Helvetica Neue',Arial,sans-serif;font-style:italic;">No attributes profiled yet.</td></tr>`
    shRows += `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 6px 0;border-collapse:collapse;border:1px solid #93c5fd;">
  <tr><td bgcolor="#1d4ed8" style="background:#1d4ed8;color:#ffffff;padding:3px 18px;font:700 10px/1.4 'Helvetica Neue',Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">${htmlEsc(s.type)} · ${htmlEsc(s.id)}</td></tr>
  ${nameRowsHtml}
  ${attrRowsHtml}
</table>`
  }

  return htmlDocumentShell({
    title: 'Stakeholder Mapper',
    bodyHtml: headerHtml + sectionHeaderHtml(`STAKEHOLDERS · ${sh.length}`, '#1d4ed8') + shRows,
  })
}

function _renderStakeholdersPlainText(): string {
  const sh = filteredStakeholders.value
  const HR = '═'.repeat(56)
  const SR = '─'.repeat(56)
  const lines: string[] = []
  lines.push(HR)
  lines.push('Stakeholder Mapper · Attribute Profiles')
  lines.push(`${sh.length} stakeholders profiled`)
  lines.push(HR)
  lines.push('')
  for (const s of sh) {
    lines.push(`${s.id} (${s.type}): ${s.name}`)
    const attrEntries = Object.entries(s.attributes ?? {})
    if (attrEntries.length > 0) {
      for (const [attr, level] of attrEntries) {
        lines.push(`  ${attr}: ${level}`)
      }
    } else {
      lines.push('  (no attributes profiled yet)')
    }
    lines.push('')
  }
  return lines.join('\n')
}

async function exportStakeholders(): Promise<void> {
  await exportArtefact({
    htmlText:     _renderStakeholdersHtml(),
    plainText:    _renderStakeholdersPlainText(),
    subject:      `Stakeholder Mapper · ${new Date().toLocaleDateString('en-AU')}`,
    artefactName: 'Stakeholder Mapper',
  })
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[598] bg-black/50 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel card -->
    <!-- translateZ(0) forces GPU compositing so this layer correctly sits above
         the Plan Crest shimmer animation in Safari (same fix as ContractHub). -->
    <div
      class="fixed inset-0 z-[600] flex flex-col"
      style="transform: translateZ(0);"
      role="dialog"
      aria-modal="true"
      aria-label="Stakeholder Mapper — AI-drafted attribute profiles"
    >
      <!-- INDIGO HEADER -->
      <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-indigo-800 to-indigo-700 shrink-0 select-none">
        <span class="text-xl" aria-hidden="true">👥</span>
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-bold text-white leading-tight tracking-tight">Stakeholder Mapper</h2>
          <p class="text-[11px] text-white/60 leading-tight mt-0.5">AI-Drafted Attribute Profiles — supports inanimate entities</p>
        </div>
        <!-- Add button -->
        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
          title="Add a new stakeholder entity — opens the add form"
          @click="openAdd"
        >
          + Add Entity
        </button>
        <!-- 🦾 Agents navigation — Tom 2026-05-31: "has no agents button" -->
        <button
          type="button"
          class="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                 bg-white/15 hover:bg-white/30 text-white text-xs font-semibold
                 border border-white/20 hover:border-white/50 transition-colors"
          title="Open Agent Menu — switch to another agent without returning to main screen"
          aria-label="Open Agent Menu"
          @click="emit('open-agents')"
        >
          <span aria-hidden="true">🦾</span> Agents
        </button>
        <!-- ⬇ Export · Tom Gilb 2026-06-06 universal Export-on-all-windows rule -->
        <button
          type="button"
          class="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                 bg-emerald-500/30 hover:bg-emerald-500/50 text-white text-xs font-semibold
                 border border-emerald-300/50 hover:border-emerald-200 transition-colors"
          title="⬇ Export Stakeholder Map — preview window with 100% of the stakeholders + attribute profiles + Glossary footnote · clipboard + Mail to Tom@Gilb.com"
          aria-label="Export Stakeholder Map — preview + clipboard + Mail"
          @click="exportStakeholders"
        >
          ⬇ Export
        </button>
        <CloseDot
          variant="on-dark"
          aria-label="Close Stakeholder Mapper — return to main workspace"
          title="Close Stakeholder Mapper — return to main planning workspace"
          @click="emit('close')"
        />
      </div>

      <!-- BODY: sidebar + content -->
      <div class="flex flex-1 min-h-0 bg-white">

        <!-- LEFT SIDEBAR -->
        <div class="w-72 shrink-0 flex flex-col border-r border-indigo-100 bg-indigo-50/40">
          <!-- Context label + search -->
          <div class="p-3 border-b border-indigo-100 shrink-0 flex flex-col gap-2">
            <!-- Model context label — tells user which source is shown -->
            <p v-if="activeModel" class="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-2 py-1">
              📌 S. entries in <strong>{{ activeModel.title }}</strong>
              <span class="text-indigo-400 font-normal ml-1">({{ modelSEntries.length }} stakeholder{{ modelSEntries.length !== 1 ? 's' : '' }})</span>
            </p>
            <p v-else class="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1">
              Global stakeholder profiles — load a model to see its S. entries
            </p>
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="activeModel ? `Search ${activeModel.title} stakeholders…` : 'Search all stakeholder entities…'"
              class="w-full px-3 py-2 rounded-lg border border-indigo-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400"
              aria-label="Filter stakeholders by name or role"
              title="Search stakeholder entities — filters by name or role"
            />
          </div>

          <!-- Stakeholder list -->
          <ScrollContainer
            outer-class="flex-1 min-h-0 relative"
            inner-class="p-2 space-y-1"
          >
            <!-- Add form (inline) -->
            <div
              v-if="showAddForm"
              class="rounded-xl bg-white ring-2 ring-indigo-400 p-3 mb-2 flex flex-col gap-2"
            >
              <p class="text-xs font-semibold text-indigo-700">New Stakeholder Entity</p>
              <input
                v-model="newName"
                type="text"
                placeholder="Name (e.g. Google LLC, GDPR)"
                class="w-full px-2 py-1.5 rounded-md border border-indigo-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Stakeholder name"
              />
              <input
                v-model="newRole"
                type="text"
                placeholder="Role (e.g. Regulatory Body)"
                class="w-full px-2 py-1.5 rounded-md border border-indigo-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Stakeholder role"
              />
              <select
                v-model="newType"
                class="w-full px-2 py-1.5 rounded-md border border-indigo-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                aria-label="Stakeholder type"
              >
                <option value="person">Person</option>
                <option value="organization">Organization</option>
                <option value="government">Government</option>
                <option value="system">System</option>
                <option value="regulatory">Regulatory</option>
                <option value="inanimate">Inanimate (data, regulation, etc.)</option>
              </select>
              <textarea
                v-model="newDescription"
                placeholder="Brief description (optional)"
                class="w-full px-2 py-1.5 rounded-md border border-indigo-200 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                rows="2"
                aria-label="Stakeholder description"
              />
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex-1 px-2 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                  title="Save new stakeholder and trigger AI attribute analysis"
                  @click="submitAdd"
                >
                  Save &amp; Analyze
                </button>
                <button
                  type="button"
                  class="px-2 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
                  title="Cancel — discard new entity"
                  @click="cancelAdd"
                >
                  Cancel
                </button>
              </div>
            </div>

            <!-- Stakeholder list items -->
            <button
              v-for="sh in filteredStakeholders"
              :key="sh.id"
              type="button"
              :class="[
                'w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-start gap-2',
                mapper.selectedId.value === sh.id
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                  : 'bg-white hover:bg-indigo-50 text-slate-800 ring-1 ring-slate-100',
              ]"
              :title="`Select ${sh.name} — ${sh.role} (${sh.type})`"
              @click="select(sh.id)"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-semibold leading-tight truncate">{{ sh.name }}</span>
                  <span
                    :class="[
                      'shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                      mapper.selectedId.value === sh.id ? 'bg-white/20 text-white' : TYPE_CHIP_CLASS[sh.type],
                    ]"
                  >
                    {{ TYPE_LABEL[sh.type] }}
                  </span>
                </div>
                <p
                  :class="[
                    'text-[10px] leading-tight mt-0.5 truncate',
                    mapper.selectedId.value === sh.id ? 'text-white/70' : 'text-slate-500',
                  ]"
                >
                  {{ sh.role }}
                </p>
                <!-- Draft status indicator -->
                <div class="flex items-center gap-1 mt-1">
                  <span
                    v-if="sh.draftStatus === 'drafting'"
                    :class="['text-[9px]', mapper.selectedId.value === sh.id ? 'text-white/80' : 'text-indigo-500']"
                  >
                    ⟳ Analyzing…
                  </span>
                  <span
                    v-else-if="sh.draftStatus === 'done'"
                    :class="['text-[9px]', mapper.selectedId.value === sh.id ? 'text-white/70' : 'text-blue-600']"
                  >
                    ✓ Analyzed
                  </span>
                  <span
                    v-else-if="sh.draftStatus === 'error'"
                    :class="['text-[9px]', mapper.selectedId.value === sh.id ? 'text-orange-200' : 'text-orange-500']"
                  >
                    ✕ Error
                  </span>
                  <span
                    v-else
                    :class="['text-[9px]', mapper.selectedId.value === sh.id ? 'text-white/50' : 'text-slate-400']"
                  >
                    Not yet analyzed
                  </span>
                </div>
              </div>
            </button>

            <!-- Empty search state -->
            <div
              v-if="filteredStakeholders.length === 0 && searchQuery"
              class="px-3 py-5 flex flex-col gap-3"
            >
              <p class="text-xs text-slate-500 text-center">
                No entities match "{{ searchQuery }}"
                <span v-if="activeModel" class="block text-[10px] text-indigo-400 mt-0.5">
                  Searching in Model: <strong>{{ activeModel.title }}</strong>
                </span>
              </p>
              <!-- Create shortcut -->
              <button
                type="button"
                class="w-full px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs text-indigo-700 font-semibold transition-colors text-left flex items-center gap-2"
                :title="`Create '${searchQuery}' as a new stakeholder entity${activeModel ? ' for model: ' + activeModel.title : ''}`"
                @click="newName = searchQuery; openAdd()"
              >
                <span class="text-base">＋</span>
                <span>Create <em>"{{ searchQuery }}"</em> as new entity<span v-if="activeModel"> for <strong>{{ activeModel.title }}</strong></span></span>
              </button>
            </div>
            <!-- Auto-generating: spinner + status -->
            <div
              v-else-if="filteredStakeholders.length === 0 && !searchQuery && autoGenStatus === 'generating'"
              class="flex flex-col items-center justify-center gap-3 py-8 px-3"
            >
              <svg class="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="text-xs font-semibold text-indigo-600 text-center">
                Generating initial Planguage model…
              </p>
              <p class="text-[10px] text-slate-400 text-center leading-snug">
                AI is creating S./F./V./C./R. entries for<br>
                <strong class="text-slate-600">{{ activeModel?.title }}</strong>
              </p>
            </div>

            <!-- Auto-generate error -->
            <div
              v-else-if="filteredStakeholders.length === 0 && !searchQuery && autoGenStatus === 'error'"
              class="flex flex-col items-center gap-2 py-6 px-3"
            >
              <span class="text-2xl" aria-hidden="true">⚠️</span>
              <p class="text-xs font-semibold text-orange-600 text-center">Auto-generate failed</p>
              <p class="text-[10px] text-slate-400 text-center leading-snug">{{ autoGenErrorMsg || 'Unknown error' }}</p>
              <button
                type="button"
                class="mt-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                title="Retry generating the initial Planguage model for this entity"
                @click="activeModel && generateInitialModel(activeModel.id)"
              >
                Retry
              </button>
            </div>

            <!-- Truly empty (no model active, or model is built-in with no S. entries) -->
            <div
              v-else-if="filteredStakeholders.length === 0 && !searchQuery"
              class="text-center text-xs text-slate-400 py-6"
            >
              No entities yet — add one above
            </div>
          </ScrollContainer>
        </div>

        <!-- RIGHT CONTENT -->
        <div class="flex-1 min-w-0 flex flex-col">
          <!-- Auto-generating: full-panel loading state (Rule 8: spinner + elapsed + progress + wisdom) -->
          <!-- smAmuseActive keeps this block mounted for 10 s post-generation (Continue Amuse Me) -->
          <div
            v-if="!selected && !showAddForm && (autoGenStatus === 'generating' || smAmuseActive)"
            class="flex-1 flex items-center justify-center px-8"
          >
            <div class="max-w-md w-full text-center">
              <!-- Spinner + elapsed + progress: only while actually generating -->
              <template v-if="autoGenStatus === 'generating'">
                <!-- 1. Spinner -->
                <svg class="animate-spin h-10 w-10 text-indigo-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <!-- Heading + elapsed -->
                <p class="text-sm font-semibold text-indigo-700 mb-0.5">Generating Planguage Model…</p>
                <p class="text-xs text-slate-400 mb-4">
                  {{ smElapsed }}s elapsed — AI is building S./F./V./C./R. entries for
                  <strong class="text-slate-600">{{ activeModel?.title }}</strong>
                </p>
                <!-- 2. Progress bar -->
                <div
                  class="w-full bg-indigo-100 rounded-full h-2 mb-6"
                  role="progressbar"
                  :aria-valuenow="smSimulatedProgress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div
                    class="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    :style="{ width: smSimulatedProgress + '%' }"
                  />
                </div>
              </template>
              <!-- 3. Wisdom card (always visible while block is mounted) -->
              <div class="rounded-2xl bg-indigo-50 border border-indigo-200 p-5 text-left shadow-sm min-h-[140px]">
                <div class="flex items-start gap-3">
                  <span class="text-2xl shrink-0 mt-0.5" aria-hidden="true">{{ STAKEHOLDER_WISDOM[smActiveWisdomIdx].emoji }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-indigo-800 mb-1.5">{{ STAKEHOLDER_WISDOM[smActiveWisdomIdx].title }}</p>
                    <p class="text-xs text-slate-600 leading-relaxed">{{ STAKEHOLDER_WISDOM[smActiveWisdomIdx].text }}</p>
                    <p class="text-[10px] text-indigo-400 mt-2 italic">{{ STAKEHOLDER_WISDOM[smActiveWisdomIdx].ref }}</p>
                  </div>
                </div>
                <!-- Continue Amuse Me: blinking button + countdown shown after generation ends -->
                <div v-if="smAmuseFinishing" class="mt-3 pt-3 border-t border-indigo-200/60 flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    class="animate-pulse rounded-full bg-indigo-600/90 hover:bg-indigo-700 px-5 py-1.5 text-xs font-bold text-white shadow-md transition-colors"
                    title="Continue reading — click to keep the wisdom card visible; it will disappear on its own if you don't click"
                    @click="smExtendAmuse"
                  >
                    ✨ Click to Continue Amuse Me
                  </button>
                  <p class="text-[10px] text-slate-400 tabular-nums">
                    Disappearing in {{ smAmuseCountdown }}s if you don't click
                  </p>
                </div>
              </div>
              <!-- 4. Dot navigation -->
              <div class="flex items-center justify-center gap-1.5 mt-3" role="tablist" aria-label="Stakeholder analysis wisdom cards">
                <button
                  v-for="(_, i) in STAKEHOLDER_WISDOM"
                  :key="i"
                  type="button"
                  :class="[
                    'h-1.5 rounded-full transition-all duration-200',
                    i === smActiveWisdomIdx ? 'bg-indigo-500 w-3' : 'bg-indigo-200 hover:bg-indigo-300 w-1.5',
                  ]"
                  :aria-label="`Go to wisdom card ${i + 1} of ${STAKEHOLDER_WISDOM.length}`"
                  :aria-selected="i === smActiveWisdomIdx"
                  role="tab"
                  @click="smActiveWisdomIdx = i"
                />
              </div>
            </div>
          </div>

          <!-- No selection state (normal empty state) -->
          <div
            v-else-if="!selected && !showAddForm"
            class="flex-1 flex items-center justify-center text-center px-8"
          >
            <div>
              <div class="text-5xl mb-4" aria-hidden="true">👥</div>
              <h3 class="text-lg font-semibold text-slate-700 mb-2">Select a Stakeholder Entity</h3>
              <p class="text-sm text-slate-500 max-w-sm leading-relaxed">
                Choose an entity from the left panel to view its 10-attribute profile,
                or add a new entity (person, organisation, government, system, regulation,
                or inanimate subject such as data or a law).
              </p>
              <button
                type="button"
                class="mt-5 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                title="Add a new stakeholder entity — opens the add form in the sidebar"
                @click="openAdd"
              >
                + Add First Entity
              </button>
            </div>
          </div>

          <!-- Selected entity detail -->
          <template v-if="selected">
            <!-- Entity header bar -->
            <div class="shrink-0 px-6 py-4 border-b border-slate-100 bg-white flex items-start gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-lg font-bold text-slate-800">{{ selected.name }}</h3>
                  <span :class="['text-[10px] font-bold uppercase px-2 py-0.5 rounded', TYPE_CHIP_CLASS[selected.type]]">
                    {{ selected.type }}
                  </span>
                </div>
                <p class="text-sm text-indigo-600 font-medium mt-0.5">{{ selected.role }}</p>
                <p class="text-xs text-slate-500 mt-1 leading-relaxed">{{ selected.description }}</p>
                <p v-if="selected.lastAnalyzed" class="text-[10px] text-slate-400 mt-1">
                  Last analyzed: {{ new Date(selected.lastAnalyzed).toLocaleString() }}
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <!-- Analyze button -->
                <button
                  v-if="selected.draftStatus === 'idle' || selected.draftStatus === 'error'"
                  type="button"
                  class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors flex items-center gap-1.5"
                  title="Run AI analysis — drafts all 10 attribute levels with sources"
                  @click="analyze(selected.id)"
                >
                  🤖 Analyze Attributes
                </button>
                <button
                  v-else-if="selected.draftStatus === 'done'"
                  type="button"
                  class="px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-semibold transition-colors"
                  title="Re-run AI analysis — overwrites existing attribute levels"
                  @click="analyze(selected.id)"
                >
                  🔄 Re-analyze
                </button>
                <div
                  v-else-if="selected.draftStatus === 'drafting'"
                  class="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-400 text-xs font-medium flex items-center gap-1.5"
                >
                  <svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing…
                </div>
                <!-- Delete button -->
                <button
                  type="button"
                  class="px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-semibold transition-colors"
                  title="Remove Stakeholder Record — permanently deletes this entity and all its attribute data"
                  @click="removeSelected"
                >
                  Remove Stakeholder Record
                </button>
              </div>
            </div>

            <ScrollContainer
              outer-class="flex-1 min-h-0 relative"
              inner-class="px-6 py-4"
            >
              <!-- Summary grid (when attributes are loaded) -->
              <div
                v-if="selected.draftStatus === 'done' && Object.keys(selected.attributes).length > 0"
                class="mb-6"
              >
                <h4 class="text-sm font-bold text-slate-700 mb-3">Stakeholder Profile Summary</h4>
                <div class="grid grid-cols-5 gap-2">
                  <div
                    v-for="def in ATTRIBUTE_DEFS"
                    :key="def.id"
                    class="rounded-lg bg-indigo-50 border border-indigo-100 p-2 text-center"
                  >
                    <p class="text-[10px] font-semibold text-indigo-700 mb-1">{{ def.name }}</p>
                    <!-- Level dots -->
                    <div class="flex items-center justify-center gap-0.5 mb-1" aria-hidden="true">
                      <span
                        v-for="n in 5"
                        :key="n"
                        :class="[
                          'w-2 h-2 rounded-full inline-block',
                          (selected.attributes[def.id]?.value ?? 0) >= n ? 'bg-indigo-500' : 'bg-indigo-200',
                        ]"
                      />
                    </div>
                    <p class="text-[9px] text-slate-600 leading-tight">
                      {{ selected.attributes[def.id]?.levelLabel ?? '—' }}
                    </p>
                  </div>
                </div>
                <p v-if="avgScore(selected) !== null" class="text-xs text-slate-500 mt-2">
                  Average score: {{ avgScore(selected) }}/5
                </p>
              </div>

              <!-- Drafting state (Rule 8: spinner + elapsed + progress bar + wisdom card) -->
              <div
                v-if="selected.draftStatus === 'drafting'"
                class="flex flex-col items-center justify-center py-12 text-center"
              >
                <!-- 1. Spinner -->
                <svg class="animate-spin h-8 w-8 text-indigo-500 mb-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <!-- Heading + elapsed -->
                <p class="text-sm font-medium text-indigo-600 mb-0.5">Drafting attribute levels for {{ selected.name }}…</p>
                <p class="text-xs text-slate-400 mb-3">{{ shDraftElapsed }}s elapsed — may take 15–30 seconds</p>
                <!-- 2. Progress bar -->
                <div
                  class="w-full max-w-xs bg-indigo-100 rounded-full h-1.5 mb-5"
                  role="progressbar"
                  :aria-valuenow="shDraftSimulatedProgress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div
                    class="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                    :style="{ width: shDraftSimulatedProgress + '%' }"
                  />
                </div>
                <!-- 3. Wisdom card (rotating, same pool as auto-gen state) -->
                <div class="w-full max-w-xs rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-left">
                  <div class="flex items-start gap-2">
                    <span class="text-lg shrink-0 mt-0.5" aria-hidden="true">{{ STAKEHOLDER_WISDOM[smActiveWisdomIdx].emoji }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-bold text-indigo-800 mb-1">{{ STAKEHOLDER_WISDOM[smActiveWisdomIdx].title }}</p>
                      <p class="text-[11px] text-slate-600 leading-relaxed">{{ STAKEHOLDER_WISDOM[smActiveWisdomIdx].text }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Idle state (not yet analyzed) -->
              <div
                v-else-if="selected.draftStatus === 'idle'"
                class="flex flex-col items-center justify-center py-16 text-center"
              >
                <div class="text-4xl mb-4" aria-hidden="true">🤖</div>
                <h4 class="text-base font-semibold text-slate-700 mb-2">Attributes Not Yet Analyzed</h4>
                <p class="text-sm text-slate-500 max-w-sm leading-relaxed mb-5">
                  Click "Analyze Attributes" to have AI draft all 10 attribute levels
                  with source URLs and specific facts for <strong>{{ selected.name }}</strong>.
                </p>
                <button
                  type="button"
                  class="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                  title="Run AI analysis — drafts all 10 attribute levels with sources"
                  @click="analyze(selected.id)"
                >
                  🤖 Analyze Attributes
                </button>
              </div>

              <!-- Error state -->
              <div
                v-else-if="selected.draftStatus === 'error'"
                class="flex flex-col items-center justify-center py-12 text-center"
              >
                <div class="text-4xl mb-3" aria-hidden="true">⚠️</div>
                <h4 class="text-sm font-semibold text-orange-600 mb-1">Analysis Failed</h4>
                <p class="text-xs text-slate-500 max-w-sm mb-4">{{ selected.draftError ?? 'Unknown error' }}</p>
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
                  title="Retry AI attribute analysis"
                  @click="analyze(selected.id)"
                >
                  Retry Analysis
                </button>
              </div>

              <!-- Attribute detail rows -->
              <div
                v-else-if="selected.draftStatus === 'done'"
                class="space-y-4"
              >
                <h4 class="text-sm font-bold text-slate-700">Attribute Detail</h4>

                <div
                  v-for="def in ATTRIBUTE_DEFS"
                  :key="def.id"
                  class="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <!-- Attribute header -->
                  <div class="flex items-start gap-3 mb-2">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-bold text-slate-800">{{ def.name }}</span>
                        <!-- Level dots -->
                        <div class="flex items-center gap-0.5" aria-hidden="true">
                          <span
                            v-for="n in 5"
                            :key="n"
                            :class="[
                              'w-2.5 h-2.5 rounded-full inline-block',
                              (selected.attributes[def.id]?.value ?? 0) >= n ? 'bg-indigo-500' : 'bg-slate-200',
                            ]"
                          />
                        </div>
                        <!-- Level label + value -->
                        <span class="text-xs font-semibold text-indigo-700">
                          {{ selected.attributes[def.id]?.levelLabel ?? '—' }}
                          <span class="text-slate-400 font-normal">
                            — {{ selected.attributes[def.id]?.value ?? '?' }}/5
                          </span>
                        </span>
                        <!-- Confidence badge -->
                        <span
                          v-if="selected.attributes[def.id]"
                          :class="['text-[10px] font-bold px-1.5 py-0.5 rounded', CONF_CLASS[selected.attributes[def.id].confidence] ?? 'bg-slate-100 text-slate-500']"
                        >
                          {{ CONF_LABEL[selected.attributes[def.id].confidence] ?? selected.attributes[def.id].confidence }}
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-400 mt-0.5 leading-tight">{{ def.description }}</p>
                    </div>

                    <!-- Edit button -->
                    <button
                      type="button"
                      class="shrink-0 text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      :title="`Edit ${def.name} attribute level, source URL, and fact manually`"
                      @click="startEdit(def.id, selected.attributes[def.id])"
                    >
                      <EditGlyph size="compact" aria-label="Edit attribute" /> Edit
                    </button>
                  </div>

                  <!-- Source URL + fact + rationale (when not editing) -->
                  <template v-if="editingAttrId !== def.id">
                    <div
                      v-if="selected.attributes[def.id]"
                      class="space-y-1"
                    >
                      <!-- Source URL -->
                      <div class="flex items-center gap-1.5 text-[11px]">
                        <span class="text-slate-400">📎</span>
                        <a
                          v-if="selected.attributes[def.id].sourceUrl"
                          :href="selected.attributes[def.id].sourceUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-indigo-600 hover:underline truncate"
                          :title="`Open source: ${selected.attributes[def.id].sourceUrl}`"
                        >
                          {{ truncateUrl(selected.attributes[def.id].sourceUrl) }}
                        </a>
                        <span v-else class="text-slate-300 italic">No source URL</span>
                      </div>
                      <!-- Source fact -->
                      <p
                        v-if="selected.attributes[def.id].sourceFact"
                        class="text-[11px] text-slate-500 italic leading-snug"
                      >
                        "{{ selected.attributes[def.id].sourceFact }}"
                      </p>
                      <!-- AI rationale -->
                      <p
                        v-if="selected.attributes[def.id].aiRationale"
                        class="text-[11px] text-slate-400 leading-snug"
                      >
                        {{ selected.attributes[def.id].aiRationale }}
                      </p>
                    </div>
                    <div v-else class="text-[11px] text-slate-300 italic">
                      No data for this attribute — re-run analysis or edit manually.
                    </div>
                  </template>

                  <!-- Inline edit form -->
                  <div
                    v-else
                    class="mt-2 space-y-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200"
                  >
                    <div>
                      <label class="text-[11px] font-semibold text-indigo-700 block mb-1">
                        Level (1={{ def.levels[0].label }}, 5={{ def.levels[4].label }})
                      </label>
                      <div class="flex items-center gap-2">
                        <input
                          v-model.number="editAttrValue"
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          class="flex-1"
                          :aria-label="`${def.name} level slider`"
                        />
                        <span class="text-sm font-bold text-indigo-700 w-8 text-center">
                          {{ editAttrValue }}/5
                        </span>
                        <span class="text-xs text-slate-500">{{ def.levels[editAttrValue - 1]?.label }}</span>
                      </div>
                    </div>
                    <div>
                      <label class="text-[11px] font-semibold text-indigo-700 block mb-1">Source URL</label>
                      <input
                        v-model="editAttrUrl"
                        type="url"
                        placeholder="https://..."
                        class="w-full px-2 py-1.5 rounded border border-indigo-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        aria-label="Source URL for this attribute level"
                      />
                    </div>
                    <div>
                      <label class="text-[11px] font-semibold text-indigo-700 block mb-1">Source Fact</label>
                      <input
                        v-model="editAttrFact"
                        type="text"
                        placeholder="Specific fact that justifies this level"
                        class="w-full px-2 py-1.5 rounded border border-indigo-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        aria-label="Specific fact backing this attribute level"
                      />
                    </div>
                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
                        title="Save manual edit — sets confidence to High (user-verified)"
                        @click="saveEdit"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        class="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
                        title="Cancel edit — discard changes"
                        @click="cancelEdit"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </ScrollContainer>
          </template>

        </div>
      </div>
    </div>
  </Teleport>
</template>
