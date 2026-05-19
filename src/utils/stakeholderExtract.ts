// UNIT_TYPE=Utility
// Feature #59 — Stakeholder extraction from spec entries
//
// Three detection layers:
//   1. STAKEHOLDER_PATTERNS — keyword matching against known stakeholder groups
//   2. extractStakeholders(text) — applies patterns to any text
//   3. extractContextualStakeholders(text) — contextual "for X" / "help X" phrase extraction
//      that catches novel groups not in the pattern list (e.g. "non-profit leaders",
//      "community volunteers", "teenage athletes")
//   4. extractAllStakeholders(allText) — runs both layers and deduplicates
//
// Consumers should call extractAllStakeholders() for the most complete coverage.

export interface StakeholderMatch {
  name: string
  keywords: string[]
  colour: string
  /** true when detected contextually (preposition phrase), not from fixed patterns */
  contextual?: boolean
}

// ── Fixed pattern list ────────────────────────────────────────────────────────
// Covers the common stakeholder archetypes found in SEM plans.
// Keyword matching uses word-boundary regex (matchesKeyword) so "lead" correctly
// matches "leader" and "leaders" but NOT "upload" or "mislead".

export const STAKEHOLDER_PATTERNS: StakeholderMatch[] = [
  {
    name: 'End User',
    keywords: ['user', 'customer', 'client', 'visitor', 'subscriber', 'consumer', 'member', 'participant', 'attendee', 'buyer', 'shopper', 'passenger', 'rider', 'player', 'guest'],
    colour: '#3b82f6',
  },
  {
    name: 'Engineer',
    keywords: ['engineer', 'developer', 'dev', 'technical', 'api', 'backend', 'frontend', 'programmer', 'architect', 'coder', 'tech team', 'software', 'data scientist', 'analyst'],
    colour: '#8b5cf6',
  },
  {
    name: 'Leader',
    keywords: ['leader', 'manager', 'director', 'head', 'executive', 'cto', 'ceo', 'coo', 'cfo', 'vp', 'president', 'chair', 'principal', 'superintendent', 'commissioner', 'chief'],
    colour: '#f59e0b',
  },
  {
    name: 'Operations',
    keywords: ['ops', 'operations', 'devops', 'support', 'helpdesk', 'sre', 'admin', 'administrator', 'coordinator', 'operator', 'dispatcher', 'logistics', 'facilities'],
    colour: '#10b981',
  },
  {
    name: 'Business',
    keywords: ['business', 'revenue', 'sales', 'marketing', 'growth', 'commercial', 'profit', 'finance', 'shareholder', 'stakeholder', 'board', 'trustee', 'partner', 'vendor', 'supplier'],
    colour: '#ef4444',
  },
  {
    name: 'Compliance',
    keywords: ['compliance', 'legal', 'audit', 'regulator', 'gdpr', 'security', 'risk', 'governance', 'policy', 'law', 'regulatory', 'watchdog', 'inspector', 'accreditor'],
    colour: '#6366f1',
  },
  {
    name: 'Non-Profit',
    keywords: ['non-profit', 'nonprofit', 'charity', 'ngo', 'foundation', 'volunteer', 'beneficiary', 'grant', 'philanthrop', 'mission-driven', 'social enterprise', 'aid', 'relief', 'humanitarian'],
    colour: '#059669',
  },
  {
    name: 'Healthcare',
    keywords: ['patient', 'doctor', 'nurse', 'clinician', 'physician', 'healthcare', 'hospital', 'clinic', 'medical', 'health worker', 'caregiver', 'carer', 'therapist', 'pharmacist', 'paramedic'],
    colour: '#0891b2',
  },
  {
    name: 'Education',
    keywords: ['student', 'teacher', 'educator', 'professor', 'lecturer', 'pupil', 'learner', 'school', 'university', 'college', 'academic', 'faculty', 'curriculum', 'instructor', 'tutor'],
    colour: '#7c3aed',
  },
  {
    name: 'Community',
    keywords: ['community', 'resident', 'citizen', 'public', 'neighbourhood', 'neighborhood', 'local', 'tenant', 'household', 'family', 'parent', 'carer', 'youth', 'young people', 'elderly', 'senior', 'veteran', 'refugee', 'immigrant'],
    colour: '#d97706',
  },
  {
    name: 'Government',
    keywords: ['government', 'council', 'ministry', 'department', 'authority', 'agency', 'official', 'civil servant', 'policy maker', 'politician', 'municipal', 'federal', 'state', 'public sector'],
    colour: '#dc2626',
  },
  {
    name: 'Investor',
    keywords: ['investor', 'funder', 'donor', 'sponsor', 'grant maker', 'philanthropist', 'vc', 'venture', 'angel', 'backer', 'lender', 'creditor'],
    colour: '#b45309',
  },
  {
    name: 'Research',
    keywords: ['researcher', 'scientist', 'investigator', 'lab', 'r&d', 'research', 'innovation', 'trial', 'study', 'experiment', 'academic'],
    colour: '#0369a1',
  },
  {
    name: 'Retail & Hospitality',
    keywords: ['retailer', 'merchant', 'restaurant', 'hotel', 'hospitality', 'franchise', 'store', 'shop', 'outlet', 'branch', 'venue', 'host', 'barista', 'server', 'waiter'],
    colour: '#be185d',
  },
]

// ── Word-boundary keyword matching ────────────────────────────────────────────
// Ensures "lead" matches "leader" and "leaders" but NOT "mislead" or "upload".
// The pattern \b{k} anchors to a word boundary at the start of the keyword.

function matchesKeyword(text: string, keyword: string): boolean {
  // Multi-word keywords (e.g. "non-profit") use substring match — they already
  // carry enough specificity to avoid false positives.
  if (keyword.includes(' ') || keyword.includes('-')) {
    return text.includes(keyword)
  }
  try {
    return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text)
  } catch {
    return text.includes(keyword)
  }
}

/**
 * Returns which fixed-pattern stakeholders are mentioned in a text string.
 * Scans case-insensitively with word-boundary matching.
 */
export function extractStakeholders(text: string): StakeholderMatch[] {
  const lower = text.toLowerCase()
  return STAKEHOLDER_PATTERNS.filter(s =>
    s.keywords.some(k => matchesKeyword(lower, k))
  )
}

// ── Contextual extraction ─────────────────────────────────────────────────────
// Catches stakeholder phrases after prepositions and action verbs that signal
// who the plan is FOR — e.g. "for non-profit leaders", "helping young people",
// "designed to serve rural communities".

/** Stop words that end a contextual stakeholder phrase */
const STOP_WORDS = new Set([
  'to', 'and', 'or', 'but', 'in', 'on', 'at', 'with', 'by', 'from',
  'who', 'that', 'which', 'so', 'when', 'where', 'as', 'if', 'while',
  'their', 'them', 'they', 'it', 'this', 'these', 'those', 'a', 'an', 'the',
  'our', 'your', 'his', 'her', 'its', 'we', 'us', 'you', 'more', 'better',
  'increase', 'improve', 'reduce', 'enable', 'ensure', 'provide', 'achieve',
])

/** Trigger words that introduce a stakeholder noun phrase */
const TRIGGER_PATTERN = /\b(?:for|helping|serving|support(?:ing)?|benefit(?:t?ing)?|empowering|assisting|enabling|reaching|designed\s+for|built\s+for|intended\s+for|aimed\s+at|tailored\s+for|used\s+by|relied\s+on\s+by)\s+/gi

/** Deterministic colour from a string (cycles through a palette) */
const CONTEXTUAL_COLOURS = [
  '#0d9488', '#7c3aed', '#be185d', '#d97706', '#1d4ed8', '#15803d', '#b91c1c', '#6d28d9',
]
function colourForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return CONTEXTUAL_COLOURS[Math.abs(hash) % CONTEXTUAL_COLOURS.length]
}

/**
 * Extracts ad-hoc stakeholder groups from preposition phrases in free text.
 * Returns dynamic StakeholderMatch objects for groups not in the fixed pattern list.
 *
 * Examples:
 *   "do something good for non-profit leaders"  → "non-profit leaders"
 *   "helping young people in rural areas"        → "young people"
 *   "designed for community volunteers"          → "community volunteers"
 */
export function extractContextualStakeholders(text: string): StakeholderMatch[] {
  const results: StakeholderMatch[] = []
  const seen = new Set<string>()
  const re = new RegExp(TRIGGER_PATTERN.source, 'gi')
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    // Collect words following the trigger, stopping at stop words or punctuation
    const rest = text.slice(match.index + match[0].length)
    const words = rest.split(/[\s,;.!?]+/)
    const phraseWords: string[] = []

    for (const w of words) {
      const wl = w.toLowerCase().replace(/[^a-z\-]/g, '')
      if (!wl || STOP_WORDS.has(wl)) break
      phraseWords.push(w.replace(/[^a-zA-Z\-]/g, ''))
      if (phraseWords.length >= 4) break  // cap at 4-word phrases
    }

    if (phraseWords.length === 0) continue

    // ── Noise filters (Bug fix 2026-05-12: Apple-Mail screenshot) ──────────
    // Reject phrases that are clearly spec-ID fragments or content-poor noise.
    //
    // 1. Single capital letter "words" like "V", "S", "F", "G" come from spec
    //    entry IDs ("V.NovelAssetAllocation" splits on the period →
    //    ["V", "NovelAssetAllocation"]). They make the captured stakeholder
    //    look like "Retirement savings V NovelAssetAllocation" — meaningless.
    // 2. Phrases with no word ≥4 characters are usually pure stop-word noise.
    // 3. Phrases that are entirely lowercase function-words (rare after the
    //    STOP_WORDS filter, but belt-and-braces).
    if (phraseWords.some(w => /^[A-Z]$/.test(w))) continue
    if (!phraseWords.some(w => w.length >= 4)) continue

    const phrase = phraseWords.join(' ').trim()
    const key = phrase.toLowerCase()
    if (key.length < 3 || seen.has(key)) continue
    seen.add(key)

    // Capitalise first word
    const name = phrase.charAt(0).toUpperCase() + phrase.slice(1)

    // Bug fix 2026-05-12: also include each individual content word
    // (≥4 chars, not a stop word) as a keyword. Without this, the only
    // keyword is the entire captured phrase — which then almost never
    // matches an individual V. entry's text, so every cell in the
    // stakeholder × value impact matrix renders as "–". Per-word
    // keywords give the impact matrix a chance to fire on content
    // words like "investments", "retirement", "savings".
    const contentWords = phraseWords
      .map(w => w.toLowerCase())
      .filter(w => w.length >= 4 && !STOP_WORDS.has(w))
    const dedupedKeywords = Array.from(new Set([key, ...contentWords]))

    results.push({
      name,
      keywords: dedupedKeywords,
      colour: colourForName(key),
      contextual: true,
    })
  }

  return results
}

/**
 * Main entry point — runs both fixed-pattern and contextual detection, then
 * deduplicates: contextual matches that overlap an existing pattern are dropped
 * (the pattern match takes precedence since it has richer keyword coverage).
 *
 * @param allText  Concatenated text from all spec entries + original input
 */
export function extractAllStakeholders(allText: string): StakeholderMatch[] {
  const fixed       = extractStakeholders(allText)
  const fixedNames  = new Set(fixed.map(s => s.name.toLowerCase()))
  const fixedKeys   = new Set(fixed.flatMap(s => s.keywords))

  const contextual  = extractContextualStakeholders(allText).filter(c => {
    // Drop if the phrase is already covered by a fixed-pattern name
    if (fixedNames.has(c.name.toLowerCase())) return false
    // Drop if every word in the phrase is already a keyword in a detected pattern
    const words = c.name.toLowerCase().split(/\s+/)
    if (words.every(w => fixedKeys.has(w))) return false
    return true
  })

  return [...fixed, ...contextual]
}

/**
 * Returns a 0–3 impact level for a V. entry relative to a stakeholder.
 * 0 = no relation, 1 = low, 2 = medium, 3 = high
 */
export function impactLevel(vEntryText: string, stakeholder: StakeholderMatch): 0 | 1 | 2 | 3 {
  const lower = vEntryText.toLowerCase()
  const hits = stakeholder.keywords.filter(k => matchesKeyword(lower, k)).length
  if (hits === 0) return 0
  if (hits === 1) return 1
  if (hits === 2) return 2
  return 3
}
