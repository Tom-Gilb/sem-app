<!--
  SymbolFamilyPanel.vue — "The Gilb Symbol Family"
  A unified museum exhibit for all five keyed icons in the Planguage symbol
  language invented by Tom Gilb during the SEM App design sessions.

  Tom 2026-05-15: "hope the history of the symbols is put in, people like that."

  Family members (in invention order):
    *→[*]     Save     — push wildcard INTO the vessel         2026-05-13
    [*]→*     Get      — pull a copy OUT of the vessel         2026-05-13
    [A>B>C]   Priority — bounded-system ordering               2026-05-13
    [*]→[ ]   Cancel   — empty the vessel entirely             2026-05-14
    [*]→[**]  Edit     — augment the vessel's contents         2026-05-15

  Follows every universal UI rule:
    • CloseDot at the END of the dark header
    • ScrollContainer wraps the body
    • Backdrop + Teleport-to-body modal pattern
    • Registered as exclusive surface from App.vue (z-[484/485])
-->
<script setup lang="ts">
import { ref } from 'vue'
import { openEml, textToEmailHtml } from '../composables/useEmlExport'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import SaveGlyph from './icons/SaveGlyph.vue'
import GetGlyph from './icons/GetGlyph.vue'
import CancelEmptyGlyph from './icons/CancelEmptyGlyph.vue'
import EditGlyph from './icons/EditGlyph.vue'
import PriorityTripleGlyph from './icons/PriorityTripleGlyph.vue'

defineEmits<{ close: [] }>()

// ── Plain-text copy / email ───────────────────────────────────────────────────

const PLAIN_TEXT = `THE GILB SYMBOL FAMILY
Planguage keyed icons — invented by Tom Gilb, 2026, SEM App
═══════════════════════════════════════════════════════════

The same design vocabulary underlies every symbol:

  *      The wildcard — raw, uncommitted, not yet inside a structure.
  [ ]    The vessel   — bounded, committed, held inside brackets.
  →      Action arrow (with shaft) — something moves between states.
  >      Comparator   (no shaft)   — a static rank, not a movement.

────────────────────────────────────────────────────────────

1. SAVE   *→[*]   (invented 2026-05-13)
   "Push the wildcard into the vessel."
   Before saving, your work is the asterisk — raw, live, uncommitted.
   Saving puts it inside the brackets: it is now held, bounded, committed.
   The floppy disc was retired. It belongs to a storage technology that
   most users have never touched. *→[*] is the act itself, technology-free.

2. GET   [*]→*   (invented 2026-05-13)
   "Pull a copy out of the vessel back to live use."
   The inverse of Save. The vessel releases its contents; the asterisk
   is now live again, outside, ready to be worked on. The vessel stays —
   Get is non-destructive. This is Load / Open / Retrieve.

3. PRIORITY   [A>B>C]   (invented 2026-05-13)
   "Ordered ranking within a bounded envelope."
   The brackets hold the bounded system — the set of things being ranked.
   The chevron > has NO shaft: this is a static relation ("A outranks B"),
   not an action. This is the visual tell that distinguishes priority
   (a state) from Save/Get (a movement). Three slots A, B, C represent
   any ordered chain; real use replaces them with stakeholder IDs,
   Value names, or Solution labels.

4. CANCEL / EMPTY   [*]→[ ]   (invented 2026-05-14)
   "Take the wildcard out; leave the vessel empty."
   The source vessel is full (*); the destination vessel is void ([ ]).
   This is NOT Get — Get keeps the asterisk live. Cancel discards it.
   The empty brackets are load-bearing: they say "the container exists
   but is now empty," which is the exact semantic of Cancel Recent Changes.

5. EDIT / AUGMENT   [*]→[**]   (invented 2026-05-15)
   "The vessel already holds content; edit augments it."
   The source vessel has one asterisk (*). The destination has two (**),
   and the destination brackets are visibly WIDER than the source brackets —
   the container must expand because it now holds more.
   Edit is additive, not subtractive. The original is still there; the
   edit mark is added alongside it. This is the visual rule: if Cancel
   empties the vessel, Edit fills it further.

────────────────────────────────────────────────────────────

The family reads as a coherent grammar:
  • Brackets always = "bounded, committed, held"
  • Asterisk always = "the thing — raw or committed"
  • Arrow with shaft = movement / action
  • Chevron without shaft = static ordering
  • Two asterisks = augmented / more-than-before

Tom Gilb · SEM App · Gilb International · 2026
Licensed under the same open-use terms as the Planguage standard.
`

const _copied = ref(false)
const _copyError = ref('')

// ── Colour palette — 20 named hues for the Colour Gallery section ─────────────
// Tom 2026-05-17: "I asked a few hours ago to see all the lovely color versions
// of the glyph and none seen yet." — Shows every glyph rendered across the full
// colour spectrum. Inline hex avoids Tailwind's JIT purge for dynamic classes.
const COLOR_PALETTE = [
  { name: 'Red',     hex: '#dc2626' },
  { name: 'Orange',  hex: '#ea580c' },
  { name: 'Amber',   hex: '#d97706' },
  { name: 'Yellow',  hex: '#ca8a04' },
  { name: 'Lime',    hex: '#65a30d' },
  { name: 'Green',   hex: '#16a34a' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Teal',    hex: '#0d9488' },
  { name: 'Cyan',    hex: '#0891b2' },
  { name: 'Sky',     hex: '#0284c7' },
  { name: 'Blue',    hex: '#2563eb' },
  { name: 'Indigo',  hex: '#4f46e5' },
  { name: 'Violet',  hex: '#7c3aed' },
  { name: 'Purple',  hex: '#9333ea' },
  { name: 'Fuchsia', hex: '#c026d3' },
  { name: 'Pink',    hex: '#db2777' },
  { name: 'Rose',    hex: '#e11d48' },
  { name: 'Slate',   hex: '#475569' },
  { name: 'Stone',   hex: '#78716c' },
  { name: 'Ink',     hex: '#1e293b' },
] as const

async function copyAll(): Promise<void> {
  _copyError.value = ''
  try {
    await navigator.clipboard.writeText(PLAIN_TEXT)
    _copied.value = true
    setTimeout(() => { _copied.value = false }, 2200)
  } catch (err) {
    _copyError.value = err instanceof Error ? err.message : 'Clipboard unavailable'
  }
}

function emailAll(): void {
  const subject = 'The Gilb Symbol Family — Planguage keyed icons'
  openEml(textToEmailHtml(PLAIN_TEXT, subject), subject, { plainBody: PLAIN_TEXT })
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[484] bg-black/40"
      aria-hidden="true"
      @click="$emit('close')"
    />

    <!-- Modal card -->
    <div
      class="fixed inset-0 z-[485] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="The Gilb Symbol Family"
    >
      <!-- Plain block layout — NOT flex-col. Same fix as PriorityInfoPanel
           (2026-05-14): flex height-resolution doesn't reliably engage
           overflow-y-auto in all configurations; explicit max-height on the
           ScrollContainer inner bypasses the issue entirely. -->
      <div
        class="pointer-events-auto w-full max-w-2xl max-h-[90vh]
               overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
      >

        <!-- ── Header ────────────────────────────────────────────────────── -->
        <div
          class="flex items-center gap-3 px-5 py-3.5
                 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white"
        >
          <!-- Mini family row in the header -->
          <span class="flex items-center gap-2 text-white/80" aria-hidden="true">
            <SaveGlyph           size="compact" class="h-4 w-auto opacity-90" />
            <GetGlyph            size="compact" class="h-4 w-auto opacity-90" />
            <PriorityTripleGlyph size="compact" class="h-4 w-auto opacity-90" />
            <CancelEmptyGlyph    size="compact" class="h-4 w-auto opacity-90" />
            <EditGlyph           size="compact" class="h-4 w-auto opacity-90" />
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-semibold leading-tight">The Gilb Symbol Family</p>
            <p class="text-[10px] text-white/50 leading-tight">
              Five keyed icons · one shared design grammar · Tom Gilb, 2026
            </p>
          </div>
          <!-- Header Copy — always visible regardless of scroll state (PriorityInfoPanel pattern) -->
          <button
            type="button"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold
                   transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
            :class="_copied ? 'bg-emerald-400/30 text-white' : 'bg-white/15 text-white hover:bg-white/25'"
            :title="_copied ? 'Copied' : 'Copy full text to clipboard'"
            :aria-label="_copied ? 'Copied' : 'Copy symbol family text'"
            @click="copyAll"
          >
            <span>{{ _copied ? '✓' : '📋' }}</span>
            <span class="hidden sm:inline">{{ _copied ? 'Copied' : 'Copy' }}</span>
          </button>
          <CloseDot
            variant="on-dark"
            aria-label="Close Symbol Family panel"
            @click="$emit('close')"
          />
        </div>

        <!-- ── Body (scrollable) ─────────────────────────────────────────── -->
        <!-- inner-style max-height = 90vh minus ~130px (header + footer heights).
             Explicit calc avoids flex height-resolution edge case (same fix
             applied to PriorityInfoPanel 2026-05-14). -->
        <ScrollContainer
          outer-class="relative bg-slate-50"
          inner-class="px-5 py-6 space-y-5"
          inner-style="max-height: calc(90vh - 130px)"
          fade-from="rgb(248, 250, 252)"
        >

          <!-- Intro -->
          <header class="text-center">
            <p class="text-xl font-bold text-slate-900">The Gilb Symbol Family</p>
            <p class="mt-1.5 text-[13px] text-slate-500 leading-relaxed max-w-lg mx-auto">
              Five minimal stroke ideograms invented by Tom Gilb during the
              SEM&nbsp;App design sessions, 2026. They share a single visual
              grammar — learn the vocabulary once and every symbol is readable.
            </p>
          </header>

          <!-- ── Design vocabulary card ─────────────────────────────── -->
          <section class="rounded-xl bg-amber-50 ring-1 ring-amber-200 px-5 py-4 shadow-sm">
            <h3 class="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-3">
              Design vocabulary — learn this once
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <div class="flex items-start gap-2.5">
                <code class="shrink-0 font-mono text-sm font-bold text-slate-800 bg-white ring-1 ring-slate-200 rounded px-1.5 py-0.5 mt-0.5">*</code>
                <span class="text-[13px] text-slate-700 leading-snug">The <strong>wildcard</strong> — raw, uncommitted, not yet inside a structure</span>
              </div>
              <div class="flex items-start gap-2.5">
                <code class="shrink-0 font-mono text-sm font-bold text-slate-800 bg-white ring-1 ring-slate-200 rounded px-1.5 py-0.5 mt-0.5">[ ]</code>
                <span class="text-[13px] text-slate-700 leading-snug">The <strong>vessel</strong> — bounded, committed, held inside brackets</span>
              </div>
              <div class="flex items-start gap-2.5">
                <code class="shrink-0 font-mono text-sm font-bold text-slate-800 bg-white ring-1 ring-slate-200 rounded px-1.5 py-0.5 mt-0.5">→</code>
                <span class="text-[13px] text-slate-700 leading-snug"><strong>Action arrow</strong> (with shaft) — something moves between states</span>
              </div>
              <div class="flex items-start gap-2.5">
                <code class="shrink-0 font-mono text-sm font-bold text-slate-800 bg-white ring-1 ring-slate-200 rounded px-1.5 py-0.5 mt-0.5">&gt;</code>
                <span class="text-[13px] text-slate-700 leading-snug"><strong>Comparator</strong> (no shaft) — a static rank, not a movement</span>
              </div>
            </div>
          </section>

          <!-- ── Glyph 1 — Save ─────────────────────────────────────── -->
          <section class="rounded-xl bg-white ring-1 ring-slate-200 px-5 py-4 shadow-sm">
            <div class="flex items-start gap-4">
              <div class="shrink-0 flex flex-col items-center gap-1.5 pt-1">
                <SaveGlyph size="large" class="h-8 w-auto text-emerald-700" />
                <code class="font-mono text-[11px] text-emerald-700 font-semibold">*→[*]</code>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <h3 class="text-[15px] font-bold text-slate-900">Save</h3>
                  <span class="text-[11px] uppercase tracking-wider text-emerald-600 font-semibold">2026-05-13</span>
                </div>
                <p class="mt-1 text-[13px] font-semibold text-slate-700 italic">"Push the wildcard into the vessel."</p>
                <p class="mt-2 text-[13px] text-slate-600 leading-relaxed">
                  Before saving, your work is the asterisk — raw, live, uncommitted.
                  Saving puts it inside the brackets: it is now held, bounded, committed.
                  The floppy disc was retired. It belongs to a storage technology most users
                  have never touched. <code class="font-mono text-[12px] bg-slate-100 text-slate-800 rounded px-1">*→[*]</code> is the act itself, technology-free.
                </p>
              </div>
            </div>
          </section>

          <!-- ── Glyph 2 — Get ──────────────────────────────────────── -->
          <section class="rounded-xl bg-white ring-1 ring-slate-200 px-5 py-4 shadow-sm">
            <div class="flex items-start gap-4">
              <div class="shrink-0 flex flex-col items-center gap-1.5 pt-1">
                <GetGlyph size="large" class="h-8 w-auto text-indigo-700" />
                <code class="font-mono text-[11px] text-indigo-700 font-semibold">[*]→*</code>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <h3 class="text-[15px] font-bold text-slate-900">Get</h3>
                  <span class="text-[11px] uppercase tracking-wider text-indigo-600 font-semibold">2026-05-13</span>
                </div>
                <p class="mt-1 text-[13px] font-semibold text-slate-700 italic">"Pull a copy out of the vessel back to live use."</p>
                <p class="mt-2 text-[13px] text-slate-600 leading-relaxed">
                  The inverse of Save. The vessel releases its contents; the asterisk is now
                  live again, outside, ready to be worked on. The vessel stays — Get is
                  non-destructive. This is Load, Open, Retrieve: whatever you call it,
                  the direction of travel is the same.
                </p>
              </div>
            </div>
          </section>

          <!-- ── Glyph 3 — Priority ─────────────────────────────────── -->
          <section class="rounded-xl bg-white ring-1 ring-slate-200 px-5 py-4 shadow-sm">
            <div class="flex items-start gap-4">
              <div class="shrink-0 flex flex-col items-center gap-1.5 pt-1">
                <PriorityTripleGlyph size="large" class="h-8 w-auto text-amber-700" />
                <code class="font-mono text-[11px] text-amber-700 font-semibold">[A&gt;B&gt;C]</code>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <h3 class="text-[15px] font-bold text-slate-900">Priority</h3>
                  <span class="text-[11px] uppercase tracking-wider text-amber-600 font-semibold">2026-05-13</span>
                </div>
                <p class="mt-1 text-[13px] font-semibold text-slate-700 italic">"Ordered ranking within a bounded envelope."</p>
                <p class="mt-2 text-[13px] text-slate-600 leading-relaxed">
                  The brackets hold the bounded system — the set of things being ranked.
                  The chevron <code class="font-mono text-[12px] bg-slate-100 text-slate-800 rounded px-1">&gt;</code> has no shaft:
                  this is a <em>static relation</em> ("A outranks B"), not an action.
                  That is the visual tell distinguishing priority (a state) from
                  Save/Get (a movement). A, B, C stand for any ordered chain —
                  stakeholders, Value names, Solution labels.
                </p>
              </div>
            </div>
          </section>

          <!-- ── Glyph 4 — Cancel / Empty ───────────────────────────── -->
          <section class="rounded-xl bg-white ring-1 ring-slate-200 px-5 py-4 shadow-sm">
            <div class="flex items-start gap-4">
              <div class="shrink-0 flex flex-col items-center gap-1.5 pt-1">
                <CancelEmptyGlyph size="large" class="h-8 w-auto text-rose-700" />
                <code class="font-mono text-[11px] text-rose-700 font-semibold">[*]→[ ]</code>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <h3 class="text-[15px] font-bold text-slate-900">Cancel / Empty</h3>
                  <span class="text-[11px] uppercase tracking-wider text-rose-600 font-semibold">2026-05-14</span>
                </div>
                <p class="mt-1 text-[13px] font-semibold text-slate-700 italic">"Take the wildcard out; leave the vessel empty."</p>
                <p class="mt-2 text-[13px] text-slate-600 leading-relaxed">
                  The source vessel is full; the destination is void.
                  This is not Get — Get keeps the asterisk live.
                  Cancel discards it. The empty brackets
                  <code class="font-mono text-[12px] bg-slate-100 text-slate-800 rounded px-1">[ ]</code>
                  are load-bearing: the container exists but is now empty,
                  which is the exact semantic of "Cancel Recent Changes" — discard,
                  leave empty, no replacement.
                </p>
              </div>
            </div>
          </section>

          <!-- ── Glyph 5 — Edit / Augment ───────────────────────────── -->
          <section class="rounded-xl bg-white ring-1 ring-slate-200 px-5 py-4 shadow-sm">
            <div class="flex items-start gap-4">
              <div class="shrink-0 flex flex-col items-center gap-1.5 pt-1">
                <EditGlyph size="large" class="h-8 w-auto text-violet-700" />
                <code class="font-mono text-[11px] text-violet-700 font-semibold">[*]→[**]</code>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 flex-wrap">
                  <h3 class="text-[15px] font-bold text-slate-900">Edit / Augment</h3>
                  <span class="text-[11px] uppercase tracking-wider text-violet-600 font-semibold">2026-05-15</span>
                </div>
                <p class="mt-1 text-[13px] font-semibold text-slate-700 italic">"The vessel already holds content; edit augments it."</p>
                <p class="mt-2 text-[13px] text-slate-600 leading-relaxed">
                  The source vessel holds one asterisk. The destination holds two,
                  and the destination brackets are visibly wider — the container must
                  expand because it now holds more. Edit is <em>additive, not subtractive</em>:
                  the original is still there; the edit mark joins it alongside.
                  If Cancel empties the vessel, Edit fills it further.
                  Tom's notation: <code class="font-mono text-[12px] bg-slate-100 text-slate-800 rounded px-1">[*]→[**]</code>.
                </p>
              </div>
            </div>
          </section>

          <!-- ── Colour Gallery ────────────────────────────────────── -->
          <!-- Tom 2026-05-17: "see all the lovely color versions of the glyph."
               Shows all 5 symbols × 20 named hues side by side. -->
          <section class="rounded-xl bg-white ring-1 ring-slate-200 px-5 py-4 shadow-sm">
            <h3 class="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">
              Colour Variations — one grammar, every palette
            </h3>
            <div class="space-y-4">

              <!-- Save *→[*] -->
              <div>
                <p class="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <code class="font-mono bg-slate-100 text-slate-700 rounded px-1 py-0.5 text-[10px]">*→[*]</code>
                  <span class="font-semibold text-slate-600">Save</span>
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <SaveGlyph
                    v-for="c in COLOR_PALETTE"
                    :key="c.hex"
                    size="standard"
                    class="h-5 w-auto shrink-0"
                    :style="{ color: c.hex }"
                    :aria-label="`Save glyph in ${c.name}`"
                    :title="c.name"
                  />
                </div>
              </div>

              <!-- Get [*]→* -->
              <div>
                <p class="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <code class="font-mono bg-slate-100 text-slate-700 rounded px-1 py-0.5 text-[10px]">[*]→*</code>
                  <span class="font-semibold text-slate-600">Get</span>
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <GetGlyph
                    v-for="c in COLOR_PALETTE"
                    :key="c.hex"
                    size="standard"
                    class="h-5 w-auto shrink-0"
                    :style="{ color: c.hex }"
                    :aria-label="`Get glyph in ${c.name}`"
                    :title="c.name"
                  />
                </div>
              </div>

              <!-- Priority [A>B>C] -->
              <div>
                <p class="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <code class="font-mono bg-slate-100 text-slate-700 rounded px-1 py-0.5 text-[10px]">[A&gt;B&gt;C]</code>
                  <span class="font-semibold text-slate-600">Priority</span>
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <PriorityTripleGlyph
                    v-for="c in COLOR_PALETTE"
                    :key="c.hex"
                    size="standard"
                    class="h-5 w-auto shrink-0"
                    :style="{ color: c.hex }"
                    :aria-label="`Priority glyph in ${c.name}`"
                    :title="c.name"
                  />
                </div>
              </div>

              <!-- Cancel [*]→[ ] -->
              <div>
                <p class="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <code class="font-mono bg-slate-100 text-slate-700 rounded px-1 py-0.5 text-[10px]">[*]→[ ]</code>
                  <span class="font-semibold text-slate-600">Cancel</span>
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <CancelEmptyGlyph
                    v-for="c in COLOR_PALETTE"
                    :key="c.hex"
                    size="standard"
                    class="h-5 w-auto shrink-0"
                    :style="{ color: c.hex }"
                    :aria-label="`Cancel glyph in ${c.name}`"
                    :title="c.name"
                  />
                </div>
              </div>

              <!-- Edit [*]→[**] -->
              <div>
                <p class="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <code class="font-mono bg-slate-100 text-slate-700 rounded px-1 py-0.5 text-[10px]">[*]→[**]</code>
                  <span class="font-semibold text-slate-600">Edit</span>
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <EditGlyph
                    v-for="c in COLOR_PALETTE"
                    :key="c.hex"
                    size="standard"
                    class="h-5 w-auto shrink-0"
                    :style="{ color: c.hex }"
                    :aria-label="`Edit glyph in ${c.name}`"
                    :title="c.name"
                  />
                </div>
              </div>

            </div>
          </section>

          <!-- ── Reading the family as a grammar ───────────────────── -->
          <section class="rounded-xl bg-slate-800 text-white px-5 py-4 shadow-sm">
            <h3 class="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
              Reading the family as a grammar
            </h3>
            <ul class="space-y-1.5 text-[13px] text-white/80 leading-snug">
              <li><span class="text-white font-semibold">Brackets</span> always = "bounded, committed, held"</li>
              <li><span class="text-white font-semibold">Asterisk</span> always = "the thing — raw or live"</li>
              <li><span class="text-white font-semibold">Arrow with shaft</span> = movement / action between states</li>
              <li><span class="text-white font-semibold">Chevron without shaft</span> = static ordering / rank</li>
              <li><span class="text-white font-semibold">Two asterisks</span> = augmented — more than before</li>
              <li><span class="text-white font-semibold">Empty brackets</span> = the container is void — cancelled</li>
            </ul>
          </section>

          <!-- Attribution -->
          <p class="text-center text-[11px] text-slate-400 italic pb-1">
            Tom Gilb · Gilb International · SEM App · 2026
            <br>Licensed under the same open-use terms as the Planguage standard.
          </p>

        </ScrollContainer>

        <!-- ── Footer actions ────────────────────────────────────────────── -->
        <div
          class="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-slate-200 bg-white"
        >
          <p class="text-[11px] text-slate-400 italic flex-1 leading-snug">
            Copy or email the full family story to anyone who asks
          </p>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold
                   transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
            :class="_copied
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
            @click="copyAll"
          >{{ _copied ? '✓ Copied' : '📋 Copy' }}</button>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold
                   bg-indigo-600 text-white hover:bg-indigo-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
            @click="emailAll"
          >✉ Email</button>
        </div>

        <p v-if="_copyError" class="px-5 pb-2 text-[11px] text-red-500 italic">
          ⚠ {{ _copyError }}
        </p>

      </div>
    </div>
  </Teleport>
</template>
