// useSaveGlyphHistory.ts — Source-of-truth content for the "About the Save Glyph"
// panel that opens when the user clicks the Save/Get glyph (`*→[*]` / `[*]→*`)
// anywhere in the SEM App.
//
// Mirrors verbatim:
//   /Users/Tomgilbs/Documents/MyVault/5 - Project/SEM App/03Execution/Save-Glyph-History.md
//
// The vault doc is the canonical record (so the history survives a code reset).
// This file ships the same content to the bundle so the panel can render
// offline and so Copy + Email actions work without a fetch.

import { openEml, textToEmailHtml } from './useEmlExport'

export interface HistorySection {
  /** Short heading shown as a card title in the panel. */
  heading: string
  /** Body paragraphs. Each entry is one paragraph. */
  paragraphs: string[]
}

/** Title shown in the panel header and used for Email subject + Copy preamble. */
export const SAVE_GLYPH_TITLE = 'The SEM App Save glyph — `*→[*]` and `[*]→*`'

/** One-line subtitle / dek shown under the title. */
export const SAVE_GLYPH_SUBTITLE
  = 'Why the SEM App uses an asterisk and a Bliss-Gilb vessel instead of a floppy disc.'

/** Authoritative content, section-by-section. */
export const SAVE_GLYPH_SECTIONS: HistorySection[] = [
  {
    heading: 'The glyph',
    paragraphs: [
      'The Save glyph in the SEM App reads `* → [*]`. An asterisk for "any data", an arrow for "into", a bracketed vessel for "the place that holds things like this". Read together: "place this thing into the vault that holds things like this." Get is the inverse: `[*] → *`. Pull this thing out of the vault.',
      'This page is the why. It is longer than a tooltip; it is the kind of thing you might want to read once, copy once, send to a colleague who asks "why doesn\'t your app use the floppy-disc icon?"',
    ],
  },
  {
    heading: 'The vessel',
    paragraphs: [
      'The square brackets come from Charles K. Bliss (Vienna, 1942; Semantography, 1949) and the Bliss-Gilb container/vessel convention later adopted in Planguage. A pair of brackets denotes a holder — an envelope, a glass, a folder. What is inside the brackets is what the holder is currently holding. `[42]` is "the vessel that holds 42." `[*]` is "the vessel that holds anything." When the SEM App writes `[plan]`, it means the plan-shaped vessel: the live, addressable place where the plan lives.',
    ],
  },
  {
    heading: 'The asterisk — recent meaning',
    paragraphs: [
      'The asterisk is the wildcard. In every modern programming language and every Unix shell since the 1960s, `*` means "match anything". `*.txt` is "every file whose name ends in .txt". In a regular expression, `a*` is "zero or more a\'s". The asterisk is the symbol the computer reaches for when it has to say "anything goes here, I don\'t care what it is, fill it in later."',
    ],
  },
  {
    heading: 'The asterisk — older meaning',
    paragraphs: [
      'That meaning is recent. The asterisk\'s older job is older than almost any punctuation we still use. The name comes from the Greek asteriskos — "little star" — diminutive of astēr, the star itself.',
      'Aristarchus of Samothrace, head of the Great Library of Alexandria around 200 BCE, was the first person we know of who used the mark systematically. He drew it in the margins of Homeric manuscripts to flag a line that was probably genuine but might have been duplicated or misplaced — this passage is interesting, look closer. Five hundred years later the Christian scholar Origen borrowed the same mark for his Hexapla and used it to flag Hebrew passages missing from the Greek Septuagint. For its first five hundred years, the asterisk\'s job was textual criticism: pay attention here.',
      'When moveable type arrived in the 15th century, the asterisk became the canonical first footnote mark — the start of the sequence * † ‡ § ‖ ¶. Three asterisks set in a triangle, ⁂, is called an asterism and marked major divisions in a text. In genealogy it still means "born" (a dagger means "died") — a quietly Christian convention. In statistical papers it marks significance — * for p<0.05, ** for p<0.01, *** for p<0.001. In linguistics it does opposite things at the same time: *kwṓn is the reconstructed Proto-Indo-European root of "hound" (i.e. inferred, unrecorded), and *Mary likes herself\'s cat is an ungrammatical sentence (i.e. impossible, forbidden). In casual writing it does censorship (f***), emphasis (*really*), and self-correction in chat (*their, not there).',
      'And in cultural English, "asterisked" — record-with-a-footnote — entered the language in 1961, when Roger Maris broke Babe Ruth\'s single-season home-run record but did it in 162 games rather than Ruth\'s 154. The journalist Dick Young coined the phrase. Barry Bonds and the steroid era revived it in the 2000s.',
      'So the asterisk has been the symbol of "look closer" since 200 BCE and the symbol of "anything at all" since the early Unix era. The SEM App uses both senses at the same time. `* → [*]` reads as "place this — whatever it is, it could be anything — into the vessel" and also as "this is worth looking at: it has been saved, on the record."',
    ],
  },
  {
    heading: 'Forty-two',
    paragraphs: [
      'The asterisk\'s ASCII codepoint is 42. Almost no one needed to know this until 1979, when Douglas Adams wrote The Hitchhiker\'s Guide to the Galaxy and had the supercomputer Deep Thought spend seven and a half million years computing "the Answer to the Ultimate Question of Life, the Universe, and Everything" and produce, after that immense run, just "forty-two." Adams in 1993 on Usenet, when fans would not stop asking him to explain: "It was a joke. It had to be a number, an ordinary, smallish number, and I chose that one. Binary representations, base thirteen, Tibetan monks are all complete nonsense. I sat at my desk, stared into the garden, and thought \'42 will do\'."',
      'Forty-two had form, though. The joke landed harder than Adams maybe intended, because 42 already had a quiet history of turning up in odd places.',
      'In ancient Egyptian funerary religion the deceased faced 42 Assessors in the Hall of Ma\'at and had to recite 42 "negative confessions" — specific denials of wrongdoing — before the heart was weighed against the feather of truth. Roughly four thousand years ago, 42 was already the number that constituted a complete moral accounting.',
      'In Kabbalah there is a 42-letter name of God, embedded in the Ana Bekoach prayer attributed to the 1st-century mystic Nehunya ben HaKanah. The Sutra of 42 Sections, dated around 67 CE, is the first Buddhist text translated into Chinese.',
      'Lewis Carroll — the mathematician Charles Dodgson — was unusually attached to it. Alice\'s Adventures in Wonderland has "Rule Forty-Two: All persons more than a mile high to leave the court." The Hunting of the Snark opens with "He had forty-two boxes, all carefully packed, / With his name painted clearly on each," and the published edition has exactly 42 illustrated panels.',
      'The first printed Bible — Gutenberg, 1455 — is called the 42-line Bible, because most columns were set with 42 lines.',
      'In American baseball, 42 was Jackie Robinson\'s number with the Brooklyn Dodgers; in 1997 Major League Baseball retired it across every team — the only number with that distinction in any major American sport. Every April 15, every player in the league wears 42. The Laws of Cricket have, in most modern editions, 42 numbered laws.',
      'And in pure mathematics, 42 had a small moment in 2019. There is a longstanding open question about which integers can be expressed as the sum of three integer cubes. For numbers under 100, almost everything had been settled — except 42, the very last holdout. Andrew Booker and Andrew Sutherland eventually cracked it using a distributed computing project, finding three integers (two negative, one positive, each about sixteen or seventeen digits long) whose cubes add to 42. In a small, true sense, 42 really was the hardest answer of all.',
      'And in software — the field Adams wrote for, even if he did not know it — the answer to life, the universe, and everything turns out to be literally `*`, the wildcard meaning anything. Adams almost certainly did not know that when he picked the number in 1979; ASCII was a programmers\' detail then, not a cultural reference. But the asterisk has been the symbol of something worth a second look since Aristarchus, and the symbol of anything at all since the early Unix era. It is a remarkably busy little star.',
    ],
  },
  {
    heading: "Tom's reasoning",
    paragraphs: [
      'Three decisions are baked into the glyph.',
      'First, reject the floppy disc. The 💾 icon for Save is an anachronism — most users of the SEM App in 2026 have never used a 3.5-inch floppy disc. The icon survives in software UI as a hand-me-down. A glyph that has to be learned by everyone is no worse than a glyph that pretends to be familiar and is not.',
      'Second, the metaphor is "place into vessel", not "press to commit". A Plan, a Spec, an Owner record, an Edit Version — these are things, and you put them somewhere. The somewhere is a named container with a known shape. `[plan]` is the plan-vessel. `[edit-version-N]` is one named member of the edit-version family. Save is the act of dropping the live `*` into its addressed `[*]`.',
      'Third, the asterisk is close enough to Claudian* — the same little star, the same idea of "this is worth a second look". Choosing the same glyph for Save in the SEM App and for the Claudian assistant whose work lands in the SEM App is not engineered symmetry; it is the kind of unforced rhyme you notice after the fact and decide to keep.',
      'Read aloud, the notation is "any-thing arrow into any-vessel". `* → [*]` is Save. `[*] → *` is Get. The glyph carries the action, not the state, which is why it is wide (≈3.6:1) — the floppy and the down-chevron carry only state, which is why they are square.',
      'That is the why. The next time you press Save in the SEM App, you are pressing four thousand years of "this is worth remembering" into one stylised star and a pair of brackets.',
    ],
  },
]

/** Returns the entire history as a single plain-text string — used by both
 *  the clipboard Copy action and the mailto: Email action. Line breaks are
 *  `\n\n` between paragraphs and `\n\n${'-'.repeat(40)}\n\n` between sections. */
export function getSaveGlyphHistoryText(): string {
  const head = `${SAVE_GLYPH_TITLE}\n${SAVE_GLYPH_SUBTITLE}\n`
  const divider = `\n\n${'—'.repeat(48)}\n\n`
  const body = SAVE_GLYPH_SECTIONS
    .map(s => `${s.heading.toUpperCase()}\n\n${s.paragraphs.join('\n\n')}`)
    .join(divider)
  const tail = `\n\n${'—'.repeat(48)}\n\nTom Gilb · 2026-05-13 · SEM App`
  return `${head}${divider}${body}${tail}`
}

/**
 * Open a .eml draft in Mail.app with the Save Glyph history pre-filled
 * in the body — no manual paste required (Tom Gilb rule 2026-05-29).
 *
 * Replaces the old `buildSaveGlyphMailto()` + `window.location.href` pattern.
 * Named explicitly (not a URL builder) to signal it has a DOM side-effect.
 */
export function openSaveGlyphEmail(): void {
  const subject = SAVE_GLYPH_TITLE
  const text    = getSaveGlyphHistoryText()
  openEml(textToEmailHtml(text, subject), subject, { plainBody: text })
}
