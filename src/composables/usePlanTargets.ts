// Feature #195 — Plan Targets
// Defines stakeholder audiences for targeted plan delivery.
// Each Target specifies WHO receives the plan, WHAT sections they see,
// and HOW the content is framed. Default "Any Instance" is always present.

import { ref, computed } from 'vue'

// ── Types ──────────────────────────────────────────────────────────────────────

export type TargetCategory =
  | 'any'          // Default — general audience
  | 'individual'   // Named person
  | 'position'     // Role (CEO, CTO, Regulator…)
  | 'ai-bot'       // AI system / LLM
  | 'public'       // General public
  | 'investor'     // Investor / board
  | 'regulator'    // Compliance / regulatory
  | 'team'         // Technical team or department
  | 'media'        // Press / media
  | 'partner'      // Business partner / vendor
  | 'procurement'  // Procurement committee
  | 'academic'     // Academic / research

export type ContentFormat =
  | 'full'         // Everything — all sections
  | 'executive'    // Key decisions: functions + values + top solutions
  | 'technical'    // Solutions + Evo Steps emphasis
  | 'narrative'    // Plain English, accessible
  | 'investor'     // ROI / value emphasis, cost-benefit framing
  | 'compliance'   // Structured, formal, complete
  | 'custom'       // User has manually overridden everything

export interface TargetSections {
  functions:    boolean
  values:       boolean
  solutions:    boolean
  evoSteps:     boolean
  stakeholders: boolean
  vdt:          boolean
}

export interface PlanTarget {
  id: string
  name: string
  category: TargetCategory
  description: string        // Context: who they are / their relationship to this plan
  contactInfo: string        // Email, Slack handle, role title, etc.
  sections: TargetSections
  format: ContentFormat
  toneNotes: string          // Custom tone / emphasis notes (shown to AI when generating)
  customIntro: string        // Personalised opening paragraph
  isDefault: boolean         // True for the built-in "Any Instance" target
}

// ── Category display metadata ─────────────────────────────────────────────────

export interface CategoryMeta {
  label: string
  icon: string
  examples: string
  defaultFormat: ContentFormat
  defaultSections: TargetSections
  toneHint: string
}

const ALL_SECTIONS: TargetSections = {
  functions: true, values: true, solutions: true,
  evoSteps: true, stakeholders: true, vdt: true,
}

const EXEC_SECTIONS: TargetSections = {
  functions: true, values: true, solutions: true,
  evoSteps: false, stakeholders: true, vdt: false,
}

const PUBLIC_SECTIONS: TargetSections = {
  functions: true, values: true, solutions: true,
  evoSteps: false, stakeholders: false, vdt: false,
}

const INVESTOR_SECTIONS: TargetSections = {
  functions: true, values: true, solutions: true,
  evoSteps: false, stakeholders: true, vdt: true,
}

const TECH_SECTIONS: TargetSections = {
  functions: true, values: true, solutions: true,
  evoSteps: true, stakeholders: false, vdt: true,
}

export const CATEGORY_META: Record<TargetCategory, CategoryMeta> = {
  any: {
    label: 'Any Instance',
    icon: '🌐',
    examples: 'General audience — no tailoring applied',
    defaultFormat: 'full',
    defaultSections: ALL_SECTIONS,
    toneHint: 'Balanced and complete. No audience-specific framing.',
  },
  individual: {
    label: 'Individual',
    icon: '👤',
    examples: 'Named person (e.g. Sarah Chen, Dr. Patel)',
    defaultFormat: 'full',
    defaultSections: ALL_SECTIONS,
    toneHint: 'Direct and personal. Address by name in the intro where possible.',
  },
  position: {
    label: 'Position / Role',
    icon: '💼',
    examples: 'CEO, CTO, Head of Product, Regulator, Department Head',
    defaultFormat: 'executive',
    defaultSections: EXEC_SECTIONS,
    toneHint: 'Strategic and decision-oriented. Lead with outcomes and value, not implementation detail.',
  },
  'ai-bot': {
    label: 'AI Bot / LLM',
    icon: '🤖',
    examples: 'GPT-4, Claude, LLM audit system, compliance bot',
    defaultFormat: 'full',
    defaultSections: ALL_SECTIONS,
    toneHint: 'Structured and machine-readable. Include all IDs, scales, and metrics explicitly.',
  },
  public: {
    label: 'General Public',
    icon: '🌍',
    examples: 'Community members, citizens, customers, social media followers',
    defaultFormat: 'narrative',
    defaultSections: PUBLIC_SECTIONS,
    toneHint: 'Plain English. No jargon. Lead with impact and benefits, not process.',
  },
  investor: {
    label: 'Investor / Board',
    icon: '💰',
    examples: 'VC, angel investor, board member, shareholder',
    defaultFormat: 'investor',
    defaultSections: INVESTOR_SECTIONS,
    toneHint: 'Lead with ROI and strategic value. Show the V/C score and top-ranked solutions prominently.',
  },
  regulator: {
    label: 'Regulator / Compliance',
    icon: '⚖️',
    examples: 'FCA, FDA, auditor, compliance officer, legal team',
    defaultFormat: 'compliance',
    defaultSections: ALL_SECTIONS,
    toneHint: 'Formal and structured. Cite constraints, tolerables, and measurable goals. Completeness first.',
  },
  team: {
    label: 'Technical Team',
    icon: '👩‍💻',
    examples: 'Engineering squad, product team, designers, QA',
    defaultFormat: 'technical',
    defaultSections: TECH_SECTIONS,
    toneHint: 'Practical and implementation-focused. Emphasise solutions and evo steps. Include acceptance criteria.',
  },
  media: {
    label: 'Media / Press',
    icon: '📰',
    examples: 'Journalist, blogger, podcast host, analyst',
    defaultFormat: 'narrative',
    defaultSections: PUBLIC_SECTIONS,
    toneHint: 'Story-driven. Lead with the problem being solved and why it matters. Quotable phrases help.',
  },
  partner: {
    label: 'Business Partner / Vendor',
    icon: '🤝',
    examples: 'Integration partner, supplier, co-development partner',
    defaultFormat: 'executive',
    defaultSections: { ...EXEC_SECTIONS, evoSteps: true },
    toneHint: 'Collaborative tone. Highlight where their involvement fits in the evo steps and solutions.',
  },
  procurement: {
    label: 'Procurement Committee',
    icon: '🏢',
    examples: 'Tender board, purchasing committee, budget approval committee',
    defaultFormat: 'compliance',
    defaultSections: { ...ALL_SECTIONS, stakeholders: false },
    toneHint: 'Formal and evidence-based. Lead with measurable goals, tolerables, and cost-benefit framing.',
  },
  academic: {
    label: 'Academic / Research',
    icon: '🎓',
    examples: 'Researcher, professor, student, conference committee',
    defaultFormat: 'full',
    defaultSections: ALL_SECTIONS,
    toneHint: 'Precise and methodological. Include scales, meters, and the Planguage methodology framing explicitly.',
  },
}

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  full:        'Full Spec — every section',
  executive:   'Executive Summary — outcomes & key decisions',
  technical:   'Technical Brief — solutions & evo steps',
  narrative:   'Plain English — accessible narrative',
  investor:    'Investor View — ROI & value framing',
  compliance:  'Compliance Report — formal & complete',
  custom:      'Custom — manually configured',
}

// ── Default target ────────────────────────────────────────────────────────────

function makeDefaultTarget(): PlanTarget {
  return {
    id: 'default-any-instance',
    name: 'Any Instance',
    category: 'any',
    description: 'General audience — full plan with no tailoring.',
    contactInfo: '',
    sections: { ...ALL_SECTIONS },
    format: 'full',
    toneNotes: '',
    customIntro: '',
    isDefault: true,
  }
}

// ── Module-level singletons (same pattern as usePlanModel) ───────────────────

const STORAGE_KEY = 'sem-plan-targets'

function _load(): PlanTarget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [makeDefaultTarget()]
    const parsed: PlanTarget[] = JSON.parse(raw)
    // Ensure the default target is always present as first entry
    if (!parsed.some(t => t.isDefault)) {
      parsed.unshift(makeDefaultTarget())
    }
    return parsed
  } catch {
    return [makeDefaultTarget()]
  }
}

function _save(targets: PlanTarget[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(targets)) } catch { /* quota */ }
}

const _targets = ref<PlanTarget[]>(_load())
const _editingId = ref<string | null>(null)
const _addingNew = ref(false)

// ── Composable ────────────────────────────────────────────────────────────────

export function usePlanTargets() {
  const targets = computed(() => _targets.value)
  const editingId = computed(() => _editingId.value)
  const addingNew = computed(() => _addingNew.value)

  const editingTarget = computed<PlanTarget | null>(() =>
    _editingId.value ? (_targets.value.find(t => t.id === _editingId.value) ?? null) : null
  )

  function addTarget(category: TargetCategory = 'individual'): PlanTarget {
    const meta = CATEGORY_META[category]
    const target: PlanTarget = {
      id: `target-${Date.now()}`,
      name: meta.label,
      category,
      description: '',
      contactInfo: '',
      sections: { ...meta.defaultSections },
      format: meta.defaultFormat,
      toneNotes: meta.toneHint,
      customIntro: '',
      isDefault: false,
    }
    _targets.value = [..._targets.value, target]
    _save(_targets.value)
    _editingId.value = target.id
    _addingNew.value = true
    return target
  }

  function updateTarget(id: string, patch: Partial<Omit<PlanTarget, 'id' | 'isDefault'>>): void {
    _targets.value = _targets.value.map(t =>
      t.id === id ? { ...t, ...patch } : t
    )
    _save(_targets.value)
  }

  function applyDefaults(id: string): void {
    const target = _targets.value.find(t => t.id === id)
    if (!target || target.isDefault) return
    const meta = CATEGORY_META[target.category]
    updateTarget(id, {
      format: meta.defaultFormat,
      sections: { ...meta.defaultSections },
      toneNotes: meta.toneHint,
    })
  }

  function removeTarget(id: string): void {
    const t = _targets.value.find(t => t.id === id)
    if (!t || t.isDefault) return
    _targets.value = _targets.value.filter(t => t.id !== id)
    _save(_targets.value)
    if (_editingId.value === id) _editingId.value = null
  }

  function startEdit(id: string): void {
    _editingId.value = id
    _addingNew.value = false
  }

  function cancelEdit(): void {
    // If the user cancels while adding a brand-new target (never saved a name),
    // remove that target.
    if (_addingNew.value && _editingId.value) {
      const t = _targets.value.find(t => t.id === _editingId.value)
      if (t && !t.isDefault && t.name === CATEGORY_META[t.category].label && !t.description) {
        removeTarget(_editingId.value)
      }
    }
    _editingId.value = null
    _addingNew.value = false
  }

  function commitEdit(): void {
    _editingId.value = null
    _addingNew.value = false
  }

  /** Build a plain-text summary of what sections this target will receive */
  function describeSections(target: PlanTarget): string {
    const active = Object.entries(target.sections)
      .filter(([, v]) => v)
      .map(([k]) => ({
        functions: 'Functions',
        values: 'Values',
        solutions: 'Solutions',
        evoSteps: 'Evo Steps',
        stakeholders: 'Stakeholders',
        vdt: 'VDT',
      }[k]))
    return active.join(' · ') || 'No sections selected'
  }

  return {
    targets,
    editingId,
    editingTarget,
    addingNew,
    addTarget,
    updateTarget,
    applyDefaults,
    removeTarget,
    startEdit,
    cancelEdit,
    commitEdit,
    describeSections,
  }
}
