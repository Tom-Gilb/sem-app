// useAboutEditGlyph.ts — Source-of-truth content for the "About the Edit
// Glyph" panel that opens when the user clicks the `?` info affordance
// attached to the Edit keyed icon `[*]→[**]`.
//
// Mirrors verbatim:
//   /Users/Tomgilbs/Documents/MyVault/5 - Project/SEM App/03Execution/Edit-Icon-About.md
//
// The vault doc is the canonical record (so the text survives a code reset).
// This file ships the same content to the bundle so the panel can render
// offline and so Copy + Email actions work without a fetch.

export interface EditAboutSection {
  /** Short heading shown as a card title in the panel. */
  heading: string
  /** Body paragraphs. Each entry is one paragraph. */
  paragraphs: string[]
  /** Optional bullet list rendered under the paragraphs. */
  bullets?: Array<{ term?: string; text: string }>
}

/** Title shown in the panel header and used for Email subject + Copy preamble. */
export const EDIT_GLYPH_TITLE = '[*] → [**]'

/** One-line subtitle / dek shown under the title. */
export const EDIT_GLYPH_SUBTITLE = 'The Edit glyph — transform vessel contents'

/** Authoritative content, section-by-section. */
export const EDIT_GLYPH_SECTIONS: EditAboutSection[] = [
  {
    heading: 'What [*] → [**] means',
    paragraphs: [
      'The vessel on the left [*] already holds content — the asterisk. Editing does not empty it or replace it. The vessel on the right [**] shows two asterisks: the original plus the edit mark. The old content remains; it is augmented.',
      'The destination bracket is intentionally wider than the source. Editing adds mark — the container must grow to reflect what has been added. This is the visual tell that distinguishes Edit from every other action in the family.',
    ],
  },
  {
    heading: 'Why not a pencil ✏️',
    paragraphs: [
      'A pencil describes a physical tool. It says nothing about the nature of the act. [*]→[**] describes the semantic act itself: you already have something (the filled vessel), and you are making it more (the augmented vessel). The old content is preserved, not erased.',
      'Pencils are also anachronisms — like the floppy disk for Save. They name the instrument of a bygone era. The keyed icon names the concept, not the tool.',
    ],
  },
  {
    heading: 'The Bliss-Gilb keyed-icon family',
    paragraphs: [
      'The [*]→[**] Edit glyph slots into a family of five keyed icons, all using the same vessel [ ] and wildcard * notation:',
    ],
    bullets: [
      { term: '*→[*] Save',        text: 'Push something into a vessel — it was outside, now it is inside.' },
      { term: '[*]→* Get',         text: 'Pull something out of a vessel — it was inside, now it is outside.' },
      { term: '[*]→[ ] Cancel',    text: 'Empty the vessel — the content is discarded.' },
      { term: '[A>B>C] Priority',  text: 'A bounded-system ordering of competing options inside constraint brackets.' },
      { term: '[*]→[**] Edit',     text: 'The vessel stays full; its contents are augmented. More is added, nothing is lost.' },
    ],
  },
  {
    heading: 'The bracket and asterisk notation',
    paragraphs: [
      'The [ ] brackets come from Charles K. Bliss (Vienna 1942, Semantography 1949) and were adopted into Planguage by Tom Gilb. They denote a vessel or bounded container.',
      'The asterisk * is the universal wildcard from computing — meaning "anything." Together [*] means: a container holding anything. The arrow → is transformation. So [*]→[**] reads: a full vessel becomes a fuller vessel.',
      'This notation is used throughout Planguage: [A>B>C] bounds a priority claim within its envelope of Assumptions and Constraints; [*]→[ ] signals a safe cancel that leaves nothing behind. Every bracket is load-bearing semantics, not decoration.',
    ],
  },
]

/** Flat-string builder for clipboard + mailto body. */
export function getAboutEditGlyphText(): string {
  const lines: string[] = []
  lines.push(EDIT_GLYPH_TITLE)
  lines.push(EDIT_GLYPH_SUBTITLE)
  lines.push('')
  for (const section of EDIT_GLYPH_SECTIONS) {
    lines.push(section.heading)
    lines.push('')
    for (const p of section.paragraphs) {
      lines.push(p)
      lines.push('')
    }
    if (section.bullets) {
      for (const b of section.bullets) {
        lines.push(b.term ? `  • ${b.term} — ${b.text}` : `  • ${b.text}`)
      }
      lines.push('')
    }
  }
  return lines.join('\n').trim() + '\n'
}

/** URI-encoded mailto URL with subject + body pre-filled. */
export function buildAboutEditGlyphMailto(): string {
  const subject = encodeURIComponent('The SEM App Edit Glyph — [*]→[**]')
  const body = encodeURIComponent(getAboutEditGlyphText())
  return `mailto:?subject=${subject}&body=${body}`
}
