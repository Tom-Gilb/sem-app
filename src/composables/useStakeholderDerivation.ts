// UNIT_TYPE=Composable
// useStakeholderDerivation — derives Stakeholder Source and Impact links for a PentaItem.
//
// For every spec entry in the Penta panel, this composable answers two questions:
//   [§→] Sources  — which stakeholders REQUIRED or DROVE this entry
//   [§←] Impacted — which stakeholders are AFFECTED by this entry
//
// Derivation order: explicit first (name appears in entry text), then implied by entry type.
// No external API calls — pure deterministic function (Claude-Code-as-AI-Layer rule).
//
// Stakeholder names come from spec.stakes (comma-separated string, e.g. "Patient, Nurse, Admin").

import type { PentaItem } from '../types/penta'
import type { SpecBlock } from '../types/spec'

// ── Public types ──────────────────────────────────────────────────────────────

export interface StakeholderLink {
  name:       string
  confidence: 'explicit' | 'implied'
  reason:     string
  /**
   * For Value-entry Impacted stakeholders only.
   * true  → the Value's current Status is below Goal — this stakeholder's need is NOT YET MET.
   * false → Status ≥ Goal — need is currently met.
   * undefined → not a Value entry, or no numeric Status/Goal available to compare.
   */
  satisfactionGap?: boolean
}

export interface EntryStakeholderLinks {
  sources:  StakeholderLink[]
  impacted: StakeholderLink[]
  /** For Value items: the gap between Status and Goal as a plain string, e.g. "72% / Goal 95%". Empty string if not applicable. */
  valueStatusNote: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse spec.stakes (comma-separated string) into an array of trimmed names. */
function parseStakeholderNames(stakes: string | undefined): string[] {
  if (!stakes || stakes.trim() === '') return []
  return stakes.split(',').map(s => s.trim()).filter(Boolean)
}

/** Check whether a stakeholder name matches any of the given keyword patterns (case-insensitive substring). */
function nameMatchesAny(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase()
  return keywords.some(kw => lower.includes(kw.toLowerCase()))
}

/**
 * Add a StakeholderLink to a list, avoiding duplicates by name (case-insensitive).
 * If the same name is already present with 'explicit', the new implied entry is silently skipped.
 * If it is present with 'implied', the new explicit entry replaces it.
 */
function addLink(list: StakeholderLink[], link: StakeholderLink): void {
  const existingIdx = list.findIndex(
    l => l.name.toLowerCase() === link.name.toLowerCase(),
  )
  if (existingIdx === -1) {
    list.push(link)
    return
  }
  // Explicit beats implied
  if (link.confidence === 'explicit' && list[existingIdx].confidence === 'implied') {
    list[existingIdx] = link
  }
  // Otherwise keep the existing entry (explicit stays explicit; implied doesn't overwrite explicit)
}

/** Add all stakeholders (capped at maxVisible + summary if needed). */
function addAllStakeholders(
  list: StakeholderLink[],
  names: string[],
  confidence: 'explicit' | 'implied',
  reason: string,
  maxVisible = 5,
): void {
  const overflow = names.length > maxVisible
  const visible  = overflow ? names.slice(0, maxVisible - 1) : names  // leave 1 slot for summary
  for (const name of visible) {
    addLink(list, { name, confidence, reason })
  }
  if (overflow) {
    const remaining = names.length - visible.length
    addLink(list, {
      name:       `(and ${remaining} more)`,
      confidence: 'implied',
      reason:     '(summary — see full stakeholder list)',
    })
  }
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Derive [§→] Sources and [§←] Impacted stakeholder links for a single PentaItem.
 *
 * @param item  The PentaItem being analysed (from any Penta sector).
 * @param spec  The full SpecBlock — used to get stakeholder names and context.
 * @returns     EntryStakeholderLinks with sources and impacted arrays.
 *              Returns empty arrays if no stakeholders are derivable.
 */
export function deriveStakeholderLinks(
  item: PentaItem,
  spec: SpecBlock | null,
): EntryStakeholderLinks {
  const sources:  StakeholderLink[] = []
  const impacted: StakeholderLink[] = []

  if (!spec) return { sources, impacted, valueStatusNote: '' }

  const allNames = parseStakeholderNames(spec.stakes)
  const itemText = `${item.label ?? ''} ${item.description ?? ''}`.toLowerCase()

  // ── Value Status note — only for Value items with numeric Status + Goal ───────
  // Captures the core Planguage insight: the Impacted stakeholders either ARE or
  // ARE NOT currently getting what they required from this Value entry.
  let valueStatusNote = ''
  let hasGap          = false
  if (item.type === 'value' && item.status !== undefined && item.goal !== undefined) {
    const statusPct = Math.round(item.status)
    const goalPct   = Math.round(item.goal)
    hasGap          = item.status < item.goal * 0.98   // 2% tolerance for rounding
    const met       = hasGap ? '⚠ NOT YET MET' : '✓ Met'
    valueStatusNote = `${met} — Status ${statusPct}${item.scale ? ' ' + item.scale : '%'} / Goal ${goalPct}${item.scale ? ' ' + item.scale : '%'}`
  }

  // ── 1. Explicit matching — name appears in entry text ────────────────────────
  for (const name of allNames) {
    if (itemText.includes(name.toLowerCase())) {
      addLink(sources,  { name, confidence: 'explicit', reason: 'Name appears in entry description' })
      addLink(impacted, { name, confidence: 'explicit', reason: 'Name appears in entry description', satisfactionGap: hasGap || undefined })
    }
  }

  // ── 2. Implied by entry type ─────────────────────────────────────────────────

  if (item.type === 'function') {
    // Sources: decision-makers + users
    for (const name of allNames) {
      const lower = name.toLowerCase()
      if (nameMatchesAny(lower, ['owner', 'sponsor', 'manager', 'director', 'executive', 'chief', 'head of'])) {
        addLink(sources, { name, confidence: 'implied', reason: 'Decision-makers typically drive function scope' })
      }
      if (nameMatchesAny(lower, ['user', 'customer', 'client'])) {
        addLink(sources, { name, confidence: 'implied', reason: 'Users are primary sources of functional requirements' })
      }
    }
    // Impacted: users and operators
    for (const name of allNames) {
      const lower = name.toLowerCase()
      if (nameMatchesAny(lower, ['user', 'customer', 'client', 'operator', 'team'])) {
        addLink(impacted, { name, confidence: 'implied', reason: 'Users and operators are directly impacted by what the system does' })
      }
    }
  }

  else if (item.type === 'constraint') {
    // Sources: regulatory, compliance, finance
    for (const name of allNames) {
      const lower = name.toLowerCase()
      if (nameMatchesAny(lower, ['legal', 'regulatory', 'compliance', 'audit', 'governance', 'gdpr', 'law', 'regulator'])) {
        addLink(sources, { name, confidence: 'implied', reason: 'Constraints are typically imposed by regulatory or governance stakeholders' })
      }
      if (nameMatchesAny(lower, ['finance', 'budget', 'sponsor'])) {
        addLink(sources, { name, confidence: 'implied', reason: 'Financial constraints come from budget owners' })
      }
    }
    // Impacted: everyone — binary constraints bind all parties in the plan
    addAllStakeholders(impacted, allNames, 'implied', 'Constraints apply to all parties in the plan', 5)
  }

  else if (item.type === 'value') {
    // Sources: all stakeholders (capped) — every stakeholder is a potential source of value requirements
    addAllStakeholders(sources, allNames, 'implied', 'Values represent stakeholder interests; every stakeholder is a potential source', 4)

    // Impacted: keyword matching on item text — with satisfactionGap signal on each
    const descLower = itemText
    for (const name of allNames) {
      const lower = name.toLowerCase()
      const makeReason = (base: string) =>
        hasGap ? `${base} · ⚠ Value currently BELOW Goal — this stakeholder's need is not yet met` : base

      if (/usability|ease|experience|\bux\b/.test(descLower)) {
        if (nameMatchesAny(lower, ['user', 'customer', 'client'])) {
          addLink(impacted, { name, confidence: 'implied', reason: makeReason('Usability/experience values primarily impact end-users'), satisfactionGap: hasGap || undefined })
        }
      }
      if (/security|privacy|data protection/.test(descLower)) {
        if (nameMatchesAny(lower, ['user', 'data', 'compliance'])) {
          addLink(impacted, { name, confidence: 'implied', reason: makeReason('Security/privacy values impact users and data compliance roles'), satisfactionGap: hasGap || undefined })
        }
      }
      if (/cost|revenue|profit|budget/.test(descLower)) {
        if (nameMatchesAny(lower, ['finance', 'investor', 'sponsor', 'executive'])) {
          addLink(impacted, { name, confidence: 'implied', reason: makeReason('Financial values impact budget and investment stakeholders'), satisfactionGap: hasGap || undefined })
        }
      }
      if (/performance|speed|latency|reliability/.test(descLower)) {
        if (nameMatchesAny(lower, ['user', 'operator', 'team'])) {
          addLink(impacted, { name, confidence: 'implied', reason: makeReason('Performance values impact users, operators, and delivery teams'), satisfactionGap: hasGap || undefined })
        }
      }
    }
    // Fallback: if no keyword match found any impacted, add ALL stakeholders with the gap signal
    // (every Value entry impacts someone — don't leave the Impacted list empty for a Value)
    if (impacted.length === 0 && allNames.length > 0) {
      addAllStakeholders(
        impacted,
        allNames,
        'implied',
        hasGap
          ? 'All stakeholders are impacted by this Value · ⚠ currently BELOW Goal'
          : 'All stakeholders are impacted by this Value',
        4,
      )
      if (hasGap) {
        // Mark the gap on each
        for (const link of impacted) { link.satisfactionGap = true }
      }
    }
  }

  else if (item.type === 'solution') {
    // Sources: technical stakeholders
    for (const name of allNames) {
      const lower = name.toLowerCase()
      if (nameMatchesAny(lower, ['architect', 'engineer', 'developer', 'technical', 'team', 'lead', 'tech'])) {
        addLink(sources, { name, confidence: 'implied', reason: 'Solutions are proposed by technical stakeholders' })
      }
    }
    // Impacted: users and operators; also deploy/security keywords
    const descLower = itemText
    for (const name of allNames) {
      const lower = name.toLowerCase()
      if (nameMatchesAny(lower, ['user', 'customer', 'client', 'operator'])) {
        addLink(impacted, { name, confidence: 'implied', reason: 'Solutions are ultimately felt by end-users and operators' })
      }
      if (/deploy|ci\/cd|\bci\b|\bcd\b/.test(descLower) && nameMatchesAny(lower, ['team', 'engineer'])) {
        addLink(impacted, { name, confidence: 'implied', reason: 'Deployment solutions directly constrain engineering teams' })
      }
      if (/security/.test(descLower) && nameMatchesAny(lower, ['user', 'compliance'])) {
        addLink(impacted, { name, confidence: 'implied', reason: 'Security solutions impact users and compliance roles' })
      }
    }
  }

  else if (item.type === 'resource') {
    // Sources: budget/executive stakeholders
    for (const name of allNames) {
      const lower = name.toLowerCase()
      if (nameMatchesAny(lower, ['sponsor', 'finance', 'budget', 'executive', 'cfo', 'director'])) {
        addLink(sources, { name, confidence: 'implied', reason: 'Resources are approved/owned by budget stakeholders' })
      }
    }
    // Impacted: delivery teams
    for (const name of allNames) {
      const lower = name.toLowerCase()
      if (nameMatchesAny(lower, ['team', 'developer', 'engineer', 'planner'])) {
        addLink(impacted, { name, confidence: 'implied', reason: 'Resource constraints directly constrain delivery teams' })
      }
    }
  }

  // ── 3. Return — empty arrays mean no derivable links (no fabrication) ──────────
  return { sources, impacted, valueStatusNote }
}
