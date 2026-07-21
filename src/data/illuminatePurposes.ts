/**
 * illuminatePurposes — Phase 4 of the Illumination AI design.
 *
 * Tom Gilb 2026-06-15 verbatim (Phase 4 mandate):
 *   *"5. A 'Your Purposes' menu, asks for their reasons for this inquiry
 *    (giving some options and a place to key or say), then based on that,
 *    the Tool guides them through useful material, until their Illumination
 *    is 'Sharp Enough'."*
 *
 * Each purpose:
 *   - has a unique ID
 *   - has a HUMAN label
 *   - has a recommended SEQUENCE through the 6 ⌘I picker tabs
 *     (different purposes → different starting tabs and different ordering)
 *   - has a HoverHint blurb explaining who would pick this purpose
 *
 * The sequencing is intentionally short (3-4 stops) — the planner is free to
 * deviate at any time.  The Tool "guides them through useful material" by
 * highlighting the NEXT recommended tab in the strip; clicking acts as a
 * confirmation that drives the sequence forward.  Reaching the end of the
 * sequence + clicking ✓ Sharp Enough completes the Illumination per Tom's
 * verbatim "until their Illumination is 'Sharp Enough'".
 *
 * Composes with:
 *   - r41 v27 6-tab IA (sequences address the 6 tabs by ID)
 *   - r41 v28 glance card (purpose entry point lives there)
 *   - r41 v33 Phase 5 session log (purpose recorded as session metadata)
 *   - SEM-teaches-incrementally SUPREME (purpose-driven flow IS the teaching)
 *   - AI-Max (every purpose surfaces AI-suggested tab + Twin search)
 *   - Twin portability (pure data, no Vue dependencies)
 *   - American English Standard
 *   - HoverHint (not "tooltip")
 */

export type IlluminateTab = 'define' | 'diagram' | 'pictures' | 'universe' | 'books' | 'twin'

export interface IlluminatePurpose {
  /** Stable ID — persisted in session metadata + sent in emails. */
  id:           string
  /** Visible label on the menu + chip. */
  label:        string
  /** Short HoverHint blurb explaining who picks this purpose. */
  blurb:        string
  /** Emoji glyph. */
  emoji:        string
  /** Recommended sequence of tabs.  First entry = starting tab.
   *  Sequence ends at the last entry; planner then clicks ✓ Sharp Enough. */
  sequence:     IlluminateTab[]
  /** Optional: a one-line "what to look for" tip surfaced when the user
   *  reaches each tab in the sequence. */
  perTabTip?:   Partial<Record<IlluminateTab, string>>
}

export const ILLUMINATE_PURPOSES: IlluminatePurpose[] = [
  {
    id:     'reviewing-spec',
    label:  'Reviewing this spec',
    emoji:  '🔍',
    blurb:  'You are auditing an existing spec entry.  Start with the canonical definition + ontology relationships, then verify against the original book illustrations.',
    sequence: ['define', 'diagram', 'pictures'],
    perTabTip: {
      define:   'Confirm the spec text matches the canonical Glossary definition.',
      diagram:  'Check the ontology relationships — does the spec entry connect properly to its parent + child concepts?',
      pictures: 'Spot-check Tom Gilb book illustrations of how this concept appears in real plans.',
    },
  },
  {
    id:     'writing-new-spec',
    label:  'Writing a new spec entry',
    emoji:  '✍',
    blurb:  'You are drafting a fresh spec entry and want to ground it in Tom Gilb\'s authored corpus.',
    sequence: ['define', 'twin', 'pictures', 'diagram'],
    perTabTip: {
      define:   'Start from the canonical short definition — copy the shape, adapt the meaning.',
      twin:     'Ask Twin Consultant for adjacent concepts you may need to reference.',
      pictures: 'Borrow language and structure from existing Tom Gilb book illustrations.',
      diagram:  'Verify your draft connects to the right parent + child concepts in the ontology.',
    },
  },
  {
    id:     'teaching-concept',
    label:  'Teaching this concept to someone',
    emoji:  '🎓',
    blurb:  'You will present this concept to a colleague, student, or audience.  Prioritise visuals + memorable examples.',
    sequence: ['diagram', 'pictures', 'define', 'books'],
    perTabTip: {
      diagram:  'Use the ontology diagram as the lead visual — shows relationships at a glance.',
      pictures: 'Pick 2-3 striking book illustrations to anchor your teaching narrative.',
      define:   'Have the canonical short definition ready for the question-and-answer phase.',
      books:    'Cite the original source book — gives credibility + a path for the curious to dig deeper.',
    },
  },
  {
    id:     'preparing-presentation',
    label:  'Preparing a presentation or talk',
    emoji:  '🎤',
    blurb:  'You will export to Keynote / slides.  Focus on visuals that survive paste-into-Keynote.',
    sequence: ['pictures', 'diagram', 'books', 'define'],
    perTabTip: {
      pictures: 'Pictures export cleanly to Keynote via the 📥 download per illustration.',
      diagram:  'Open the ontology diagram fullscreen + screenshot for the slide deck.',
      books:    'Book covers carry visual identity for a "based on Tom Gilb\'s work" slide.',
      define:   'Pull the short definition for a "key concepts" slide.',
    },
  },
  {
    id:     'debugging-regulation',
    label:  'Debugging a regulatory question',
    emoji:  '⚖',
    blurb:  'You are checking a Constraint or Compliance question — sources matter, citations matter.',
    sequence: ['twin', 'define', 'books'],
    perTabTip: {
      twin:     'Twin Consultant excels at cross-referencing Tom Gilb\'s work for compliance language.',
      define:   'Confirm the canonical definition — it carries the authoritative interpretation.',
      books:    'Cite the source book + page when you commit the answer to writing.',
    },
  },
  {
    id:     'comparing-plans',
    label:  'Comparing this with another plan',
    emoji:  '⚖️',
    blurb:  'You are evaluating how this concept appears in multiple plans / contexts.',
    sequence: ['define', 'universe', 'diagram'],
    perTabTip: {
      define:   'Establish the canonical baseline for comparison.',
      universe: 'See where the concept sits among 663 related concepts — discover comparison axes.',
      diagram:  'Map ontology relationships to see what is structurally adjacent.',
    },
  },
  {
    id:     'quick-recall',
    label:  'Just need a quick reminder',
    emoji:  '⚡',
    blurb:  'You half-remember the concept and just need a one-sentence reminder.',
    sequence: ['define'],
    perTabTip: {
      define:   'Glance at the short definition + ✓ Sharp Enough.',
    },
  },
  {
    id:     'curious-explore',
    label:  'Just exploring / browsing',
    emoji:  '🌌',
    blurb:  'No specific objective — you are curious and want to wander Tom Gilb\'s corpus.',
    sequence: ['universe', 'books', 'pictures', 'twin'],
    perTabTip: {
      universe: 'Start with the 663-concept constellation map — pick whatever catches your eye.',
      books:    'Browse the 48-book kaleidoscope — covers + sample illustrations.',
      pictures: 'Drift through illustrations carousel — auto-rotates if you let it.',
      twin:     'Ask Twin Consultant a curiosity-driven open question.',
    },
  },
  {
    id:     'finding-quote',
    label:  'Looking for a Tom Gilb quote',
    emoji:  '💬',
    blurb:  'You want a citable verbatim Tom Gilb statement to reference.',
    sequence: ['twin', 'books', 'pictures'],
    perTabTip: {
      twin:     'Twin Consultant returns ontology-backed quotes with cite-back URLs.',
      books:    'Browse covers to triangulate which book the quote is most likely from.',
      pictures: 'Illustration captions often carry verbatim Tom Gilb language.',
    },
  },
  {
    id:     'other',
    label:  'Other (let me say)',
    emoji:  '💭',
    blurb:  'None of the above fits.  Type your own purpose.  The sequence defaults to Define → Diagram for general grounding.',
    sequence: ['define', 'diagram'],
    perTabTip: {
      define:  'Start from canonical definition.',
      diagram: 'See ontology relationships.',
    },
  },
]

/** Look up a purpose by ID. */
export function purposeById(id: string | null | undefined): IlluminatePurpose | null {
  if (!id) return null
  return ILLUMINATE_PURPOSES.find(p => p.id === id) ?? null
}
