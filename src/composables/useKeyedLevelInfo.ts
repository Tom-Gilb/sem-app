// UNIT_TYPE=Composable
// useKeyedLevelInfo — canonical HoverHint source for every Planguage keyed
// scalar-level character (`>`, `>>`, `>?`, `>>>`, `<`, `<<`, `~`, etc.).
//
// Tom Gilb 2026-06-17 verbatim "in keyed icons in values there is no info
// for the keyed icons, rule is everywhere, fix everywhere".  The keyed
// characters are canonical Planguage glyphs (Tom Gilb's Competitive
// Engineering Ch.4 + ASPECTS book Apr 2026 + Twin Glossary entries) — each
// one carries specific Planguage semantics that a planner who doesn't
// know Planguage MUST be able to learn at-a-glance via HoverHint per
// DD-009 (Interaction Disclosure / Zero-Training UI) and DD-013 (every
// keyed glyph has its meaning explained).
//
// Single source of truth: every component that renders a keyed level
// character imports the canonical HoverHint string from here so the
// language stays consistent across SpecOutput, PentaPanel, MultiVision,
// SymbolFamilyPanel, exports, and any future surface.  Twin portability:
// the map is a pure Record — ports verbatim to Kai's Twin.

/** Canonical Planguage scalar-level keyed characters. */
export type KeyedLevel =
  | 'past'      // < — historical baseline (older observed value)
  | 'status'    // ~ — current observed level (today's measurement)
  | 'trend'     // ~~ — direction + rate of change
  | 'survival'  // >>! — absolute minimum (life-critical)
  | 'fail'      // << — attribute-unacceptable threshold
  | 'tolerable' // >> — minimum non-failure / project-viability threshold
  | 'goal'      // > — committed promise (negotiated trade-off)
  | 'wish'      // >? — uncommitted stakeholder aspiration
  | 'stretch'   // >>> — ambitious beyond Goal (exceptional aspiration)
  | 'budget'    // == — allocated resource limit (Resource entries)
  | 'monster'   // >>?? — far-reach aspiration (ASPECTS book §2.0)
  | 'trigger'   // !> — event-driven activation level

export interface KeyedLevelMeta {
  /** Canonical keyed character(s). */
  glyph: string
  /** Plain-English name. */
  name: string
  /** Short description (≤ 80 chars — suitable for inline HoverHint). */
  short: string
  /** Long canonical definition (Planguage book + Twin Glossary citation). */
  long: string
  /** Twin Glossary concept ID (e.g. '*539' for Tolerable) — optional. */
  twin?: string
  /** Canonical palette family. */
  family: 'past' | 'measurement' | 'floor' | 'target' | 'ceiling' | 'budget' | 'event'
}

/** Single source of truth for keyed-level HoverHints. */
export const KEYED_LEVEL_INFO: Record<KeyedLevel, KeyedLevelMeta> = {
  past: {
    glyph:  '<',
    name:   'Past',
    short:  'Past — historical baseline (older observed value)',
    long:   'Past — historical performance level used as a starting-point reference. Competitor\'s level or our own measured value before this project started. Motivates the commitment ladder by anchoring the "from" of the journey.',
    family: 'past',
  },
  status: {
    glyph:  '~',
    name:   'Status',
    short:  'Status — current observed level (today\'s measurement)',
    long:   'Status — current measured level for this Value. "Today\'s" reading; the starting point right now. Past not future, illuminating but not required. (Twin Glossary *513.)',
    twin:   '*513',
    family: 'measurement',
  },
  trend: {
    glyph:  '~~',
    name:   'Trend',
    short:  'Trend — direction and rate of change',
    long:   'Trend — direction + rate of change in the Scale over recent time. Illuminating context for the commitment ladder.',
    family: 'measurement',
  },
  survival: {
    glyph:  '>>!',
    name:   'Survival',
    short:  'Survival — absolute minimum for life-critical operation',
    long:   'Survival — absolute minimum level required for the system or stakeholder to survive. Critical for life-critical or mission-critical Values. Below this, the whole project / system fails irrecoverably. (Twin Glossary *440.)',
    twin:   '*440',
    family: 'floor',
  },
  fail: {
    glyph:  '<<',
    name:   'Fail',
    short:  'Fail — attribute-unacceptable threshold',
    long:   'Fail — the boundary at which this attribute becomes unacceptable. The project may still exist below this level, but this Value is failing. Sits inside the Tolerable Range as a finer-grained inner marker. (Twin Glossary *098.)',
    twin:   '*098',
    family: 'floor',
  },
  tolerable: {
    glyph:  '>>',
    name:   'Tolerable',
    short:  'Tolerable — minimum non-failure / project-viability threshold',
    long:   'Tolerable — minimum acceptable level for the project to be viable. The whole project fails below this. Corresponds to "not intolerable" per SUCCESS book §3.3. (Twin Glossary *539. Competitive Engineering Ch.4.)',
    twin:   '*539',
    family: 'floor',
  },
  goal: {
    glyph:  '>',
    name:   'Goal',
    short:  'Goal — committed promise (negotiated trade-off)',
    long:   'Goal — formally committed target level. The "promise" the design + resources + side-effects have been balanced to deliver. Defines SUCCESS. (Twin Glossary *109. Competitive Engineering Ch.4.)',
    twin:   '*109',
    family: 'target',
  },
  wish: {
    glyph:  '>?',
    name:   'Wish',
    short:  'Wish — uncommitted aspiration (independent of cost + physics)',
    long:   'Wish — stakeholder dream / uncommitted target. Independent of cost, physics, or feasibility. Becomes a Goal once cost / feasibility is negotiated and committed.',
    family: 'ceiling',
  },
  stretch: {
    glyph:  '>>>',
    name:   'Stretch',
    short:  'Stretch — ambitious beyond Goal (exceptional aspiration)',
    long:   'Stretch — ambitious target beyond the normal Goal. Relevant after all Goals are reached. Seriously-intended exceptional aspiration.',
    family: 'ceiling',
  },
  budget: {
    glyph:  '==',
    name:   'Budget',
    short:  'Budget — allocated resource limit',
    long:   'Budget — official allocated resource limit (money, time, headcount, capacity). Resources are constrained by Budget, not Goaled. Supersedes the legacy goal field for Resource entries. (Tom Gilb 2026-06-07.)',
    family: 'budget',
  },
  monster: {
    glyph:  '>>??',
    name:   'Monster',
    short:  'Monster — far-reach aspiration',
    long:   'Monster — far-reach aspiration; one of the additional Targets named in ASPECTS book p.1343. Specific Twin definition pending.',
    family: 'ceiling',
  },
  trigger: {
    glyph:  '!>',
    name:   'Trigger',
    short:  'Trigger — event-driven activation level',
    long:   'Trigger — event-driven activation level; one of the additional Targets named in ASPECTS book p.1343. Specific Twin definition pending.',
    family: 'event',
  },
}

/** Resolve a keyed-character string back to its level (best-effort lookup). */
const GLYPH_TO_LEVEL: Record<string, KeyedLevel> = {
  '<':    'past',
  '~':    'status',
  '~~':   'trend',
  '>>!':  'survival',
  '<<':   'fail',
  '>>':   'tolerable',
  '>':    'goal',
  '>?':   'wish',
  '>>>':  'stretch',
  '==':   'budget',
  '>>??': 'monster',
  '!>':   'trigger',
}

/** Look up keyed-level info from a known level name. */
export function getKeyedLevelInfo(level: KeyedLevel): KeyedLevelMeta {
  return KEYED_LEVEL_INFO[level]
}

/** Resolve a raw keyed-character string to its meta (returns null if unknown). */
export function levelFromGlyph(glyph: string): KeyedLevelMeta | null {
  const level = GLYPH_TO_LEVEL[glyph.trim()]
  return level ? KEYED_LEVEL_INFO[level] : null
}

/** Build a canonical HoverHint string for a keyed level (suitable for `:title`). */
export function keyedLevelHoverHint(level: KeyedLevel): string {
  const meta = KEYED_LEVEL_INFO[level]
  const twinPart = meta.twin ? ` (${meta.twin})` : ''
  return `${meta.glyph} ${meta.name}${twinPart} — ${meta.long}`
}

/** Composable wrapper for components that want reactive access. */
export function useKeyedLevelInfo() {
  return {
    KEYED_LEVEL_INFO,
    getKeyedLevelInfo,
    levelFromGlyph,
    keyedLevelHoverHint,
  }
}
