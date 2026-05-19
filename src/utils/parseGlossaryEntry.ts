// UNIT_TYPE=Utility
// parseGlossaryEntry — Parses a Planguage glossary markdown file into structured sections.
//
// Input:  raw markdown string from the vault's PlanguageGlossary/*.md file
// Output: GlossaryEntry with pre-extracted sections ready for display
//
// Section extraction strategy:
//   Split on H2 headings (## …) and collect content per section.
//   Mermaid code fences are extracted from any section that contains them.
//   YAML frontmatter (lines before the first #) is extracted separately for concept metadata.

export interface GlossaryEntry {
  /** Raw term name as it appears in the heading, e.g. "Wish" */
  term: string
  /** Concept number string, e.g. "*244" */
  conceptNumber: string
  /** Planguage keyed icon, e.g. ">?" */
  keyedIcon: string
  /** One-sentence "at a glance" summary (from the > [!abstract] callout) */
  atAGlanceSummary: string
  /** Raw markdown for the At-a-glance card table section */
  atAGlanceCard: string
  /** Array of raw Mermaid diagram sources found in the document */
  diagrams: string[]
  /** Raw markdown for the ## Notes section */
  notes: string
  /** Raw markdown for the ## Examples section */
  examples: string
  /** Raw markdown for the ## Common mistakes section */
  commonMistakes: string
  /** Raw markdown for the ## Synonyms section */
  synonyms: string
  /** Raw markdown for the ## Related concepts section */
  relatedConcepts: string
  /** Optional joke / "fun" section if present */
  joke: string
}

/** Split a markdown document into labelled H2 sections. */
function splitH2Sections(md: string): Map<string, string> {
  const sections = new Map<string, string>()
  const h2re = /^## (.+)$/m

  let remaining = md
  // Consume everything before the first H2 as "preamble"
  const firstH2 = remaining.search(h2re)
  if (firstH2 < 0) {
    sections.set('__preamble', remaining)
    return sections
  }
  sections.set('__preamble', remaining.slice(0, firstH2))
  remaining = remaining.slice(firstH2)

  // Split on H2 boundaries
  const parts = remaining.split(/(?=^## )/m)
  for (const part of parts) {
    const m = part.match(/^## (.+)\n([\s\S]*)/)
    if (m) {
      // Normalise heading key: lowercase, collapse spaces
      const key = m[1].trim().toLowerCase().replace(/\s+/g, ' ')
      sections.set(key, m[2].trim())
    }
  }
  return sections
}

/** Extract all ```mermaid ... ``` blocks from a string. Returns just the diagram source (no fences). */
function extractMermaidBlocks(text: string): string[] {
  const diagrams: string[] = []
  const re = /```mermaid\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    diagrams.push(m[1].trim())
  }
  return diagrams
}

/** Extract the content of the first > [!abstract] callout block. */
function extractAbstractCallout(text: string): string {
  const m = text.match(/^>\s*\[!abstract\].*?\n((?:>.*\n?)*)/m)
  if (!m) return ''
  // Strip leading "> " from each callout line
  return m[1]
    .split('\n')
    .map(l => l.replace(/^>\s?/, ''))
    .join('\n')
    .trim()
}

/** Extract the concept number from YAML frontmatter or the H1 heading. */
function extractConceptNumber(md: string): string {
  // YAML frontmatter
  const fmMatch = md.match(/^---[\s\S]*?concept_number:\s*["']?(\*?\d+[a-z]?)["']?/m)
  if (fmMatch) return fmMatch[1]
  // H1 heading fallback: "# *244 — Wish"
  const h1 = md.match(/^# (\*\d+[a-z]?)\s*[—–-]/m)
  if (h1) return h1[1]
  return ''
}

/** Extract the keyed_icon from YAML frontmatter. */
function extractKeyedIcon(md: string): string {
  const m = md.match(/^---[\s\S]*?keyed_icon:\s*["']?([^"'\n]+)["']?/m)
  return m ? m[1].trim() : ''
}

/** Extract the term name from H1 heading or YAML english_name. */
function extractTermName(md: string, fallback: string): string {
  const fmMatch = md.match(/^---[\s\S]*?english_name:\s*["']?([^"'\n]+)["']?/m)
  if (fmMatch) return fmMatch[1].trim()
  const h1 = md.match(/^# \*?\d+[a-z]?\s*[—–-]\s*(.+)$/m)
  if (h1) return h1[1].trim()
  return fallback
}

/**
 * Parse a raw Planguage glossary markdown file into a GlossaryEntry.
 * @param markdown  Raw file contents
 * @param termFallback  The term name used to request the file (used as fallback)
 */
export function parseGlossaryEntry(markdown: string, termFallback: string): GlossaryEntry {
  const sections = splitH2Sections(markdown)

  // Extract all Mermaid diagrams from the entire document (they can be in any section)
  const diagrams = extractMermaidBlocks(markdown)

  // At-a-glance card: look for a section whose heading contains "at-a-glance" or "at a glance"
  const cardKey = [...sections.keys()].find(k => k.includes('at-a-glance') || k.includes('at a glance'))
  const atAGlanceCard = cardKey ? sections.get(cardKey)! : ''

  return {
    term:            extractTermName(markdown, termFallback),
    conceptNumber:   extractConceptNumber(markdown),
    keyedIcon:       extractKeyedIcon(markdown),
    atAGlanceSummary: extractAbstractCallout(markdown),
    atAGlanceCard,
    diagrams,
    notes:           sections.get('notes') ?? '',
    examples:        sections.get('examples') ?? '',
    commonMistakes:  sections.get('common mistakes') ?? '',
    synonyms:        sections.get('synonyms') ?? '',
    relatedConcepts: sections.get('related concepts') ?? '',
    joke:            sections.get('joke') ?? '',
  }
}
