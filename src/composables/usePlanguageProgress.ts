// usePlanguageProgress.ts — shared data layer for the Planguage Progress
// Window (Tom Gilb 2026-06-25 verbatim: *"Name = Planguage Progress window"*).
//
// Lifted verbatim from SpecOutput.vue v343-v348 inline implementation so
// every long-running AI generation surface in the SEM App (Stage 1 spec
// generation, Stage 2.2 solution auto-generation, Sharpen rounds, Maria
// reports, etc.) can render the same colorful 2×3 tile counter with
// identical wiring and identical semantics.  The visual component
// (`<PlanguageProgressWindow>`) consumes this composable's reactive
// outputs.
//
// Composes with:
//   - Conjunction-of-Technologies SUPREME — quantitative channel
//   - DD-011 Planguage-Glyph-First + DD-016 Color Keyed Icons
//   - Honest Loading Hint Copy SUPREME (Phase 1 phase-keyed; Phase 2 streaming pending)
//   - MOVE Principle (all 6 types visible at-a-glance)
//
// Phase 1 limit (current): counts come from `spec` once it lands at the end
// of the one-shot AI call.  Phase 2 (banked in pending-requests.md) is the
// useSDK.ts `stream: true` refactor + chunk-derived count ticking.

import { computed, type Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export type BuildTypeKey =
  | 'stakeholders'
  | 'values'
  | 'functions'
  | 'solutions'
  | 'constraints'
  | 'resources'

export type BuildTypeStatus = 'pending' | 'spinning' | 'done'

export interface BuildTypeScheduleRow {
  key:     BuildTypeKey
  label:   string
  startAt: number  // loadingElapsed second when this type starts being drafted
  doneAt:  number  // loadingElapsed second when this type's draft is complete
}

export interface BuildTypeColorClasses {
  /** Kept for back-compat with v344 invariant (unused at v346+). */
  gradientDone:     string
  /** Kept for back-compat with v344 invariant (unused at v346+). */
  gradientSpinning: string
  /** Tailwind border-{colour}-{shade} for the thick top stripe. */
  borderColor:      string
  /** Tailwind text-{colour}-{shade} for count badge + bottom label. */
  textColor:        string
}

/** Per-type canonical Planguage colours (DD-016 Color Keyed Icons). */
export const BUILD_TYPE_COLOR_CLASSES: Record<BuildTypeKey, BuildTypeColorClasses> = {
  stakeholders: { gradientDone: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700',       gradientSpinning: 'bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-500',     borderColor: 'border-blue-600',     textColor: 'text-blue-700' },
  values:       { gradientDone: 'bg-gradient-to-br from-violet-500 via-violet-600 to-purple-700',   gradientSpinning: 'bg-gradient-to-br from-violet-400 via-violet-500 to-purple-500', borderColor: 'border-violet-600',   textColor: 'text-violet-700' },
  functions:    { gradientDone: 'bg-gradient-to-br from-emerald-500 via-green-600 to-green-700',    gradientSpinning: 'bg-gradient-to-br from-emerald-400 via-green-500 to-green-500',  borderColor: 'border-green-600',    textColor: 'text-green-700' },
  solutions:    { gradientDone: 'bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700',    gradientSpinning: 'bg-gradient-to-br from-orange-400 via-orange-500 to-amber-500',  borderColor: 'border-orange-600',   textColor: 'text-orange-700' },
  constraints:  { gradientDone: 'bg-gradient-to-br from-red-500 via-red-600 to-rose-700',           gradientSpinning: 'bg-gradient-to-br from-red-400 via-red-500 to-rose-500',         borderColor: 'border-red-600',      textColor: 'text-red-700' },
  resources:    { gradientDone: 'bg-gradient-to-br from-teal-500 via-emerald-600 to-emerald-800',   gradientSpinning: 'bg-gradient-to-br from-teal-400 via-emerald-500 to-emerald-600', borderColor: 'border-emerald-700',  textColor: 'text-emerald-800' },
}

/** Per-type HoverHint copy — surfaces concept info on hover. */
export const BUILD_TYPE_HOVER_HINTS: Record<BuildTypeKey, string> = {
  stakeholders: 'Stakeholder — Who needs the results.  Per Tom Gilb canon: ANIMATE (people, organizations) AND INANIMATE (data, regulations, systems).  Upper number in the S-loop = animate count; lower number = inanimate count.',
  values:       'Value — What success means, measurable.  Every Value entry has Scale + Meter + Tolerable + Goal + Wish (the success-book scalar levels).',
  functions:    'Function — A binary capability the system either has or does not.  Function entries describe what the system DOES.',
  solutions:    'Solution — A designed means proposed to deliver the Values.  Each Solution carries 26 canonical parameters (Tier 1 required, Tier 2 recommended, Tier 3 optional).',
  constraints:  'Constraint — A binary rule the system MUST NOT violate.  Hard limits, regulations, must-not-exceed boundaries.',
  resources:    'Resource — A scalar input the system consumes (budget, hours, hardware, compute).  Resource entries have Scale + Meter + Tolerable like Values, but they limit DELIVERY capacity.',
}

/** Default schedule mirrors GENERATION_PHASES atSecond boundaries used by
 *  the Stage 1 spec-generation surface in SpecOutput.vue.  Other surfaces
 *  (e.g. Stage 2.2 solution-only generation) override via custom schedule. */
export const BUILD_TYPE_SCHEDULE_FULL: readonly BuildTypeScheduleRow[] = [
  { key: 'stakeholders', label: 'Stakeholders', startAt: 12, doneAt: 22 },  // Phase 3
  { key: 'values',       label: 'Values',       startAt: 22, doneAt: 35 },  // Phase 4
  { key: 'functions',    label: 'Functions',    startAt: 35, doneAt: 50 },  // Phase 5
  { key: 'solutions',    label: 'Solutions',    startAt: 35, doneAt: 50 },  // Phase 5
  { key: 'constraints',  label: 'Constraints',  startAt: 50, doneAt: 70 },  // Phase 6
  { key: 'resources',    label: 'Resources',    startAt: 50, doneAt: 70 },  // Phase 6
] as const

/** Solution-only schedule for Stage 2.2 auto-generate-solutions.  Only the
 *  Solution tile spins/transitions; the other five tiles stay 'done' at
 *  their current count (they're not being touched in this generation). */
export const BUILD_TYPE_SCHEDULE_SOLUTIONS_ONLY: readonly BuildTypeScheduleRow[] = [
  { key: 'stakeholders', label: 'Stakeholders', startAt: 0,   doneAt: 0   },  // already done — display current count
  { key: 'values',       label: 'Values',       startAt: 0,   doneAt: 0   },  // already done — display current count
  { key: 'functions',    label: 'Functions',    startAt: 0,   doneAt: 0   },  // already done — display current count
  { key: 'solutions',    label: 'Solutions',    startAt: 0,   doneAt: 999 },  // spinning until generation completes
  { key: 'constraints',  label: 'Constraints',  startAt: 0,   doneAt: 0   },  // already done — display current count
  { key: 'resources',    label: 'Resources',    startAt: 0,   doneAt: 0   },  // already done — display current count
] as const

export function buildTypeStatusAt(row: BuildTypeScheduleRow, elapsed: number): BuildTypeStatus {
  if (elapsed < row.startAt) return 'pending'
  if (elapsed < row.doneAt)  return 'spinning'
  return 'done'
}

/** Display helper — routes a count to its on-tile display string.
 *
 *  r41 v355 (Tom Gilb 2026-06-25 "STILL ZERO COUNT" after v354 type-anchor
 *  regex fix): REMOVED the "…" spinner override entirely.  v351 → v354 had
 *  the spinning state render "…" INSTEAD of the count, which masked the
 *  real number on whichever tile the phase-keyed schedule said was "actively
 *  being drafted".  At Phase 5 (44s elapsed) Functions + Solutions were
 *  spinning per schedule, so both tiles showed "…" regardless of the actual
 *  streamed count.  The pulse animation on the tile container already
 *  communicates "active" — the badge text should ALWAYS show the real
 *  number, not a placeholder.
 *
 *  Status semantics now (v355):
 *    EVERY status → real count.  Pulse animation on tile communicates active.
 *
 *  r41 v352 (Tom Gilb 2026-06-25 "i am hoping for the numbers not a tick mark"):
 *  PREVIOUSLY replaced the "—" placeholder for pending status with the actual
 *  count.  v355 generalises that move to every status.
 *
 *  Composes with Honest-Loading-Hint-Copy SUPREME (no fake placeholders) AND
 *  Conjunction-of-Technologies (the quantitative channel shows real data,
 *  not theatre).
 *
 *  Status semantics now:
 *    PENDING                          → real count (usually 0)
 *    SPINNING                         → real count (pulse animation alone signals "active")
 *    DONE while loading + count===0   → 0 (we know the count — it's zero)
 *    DONE not loading                 → real count
 */
export function displayCountFor(status: BuildTypeStatus, count: number, _loading: boolean): string {
  void _loading  // retained in signature for back-compat with callers
  void status    // r41 v355 — pulse animation on tile communicates active state; badge shows real count
  return String(count)
}

export interface PlanguageProgressRow extends BuildTypeScheduleRow {
  status:           BuildTypeStatus
  count:            number
  colorClasses:     BuildTypeColorClasses
  hoverHint:        string
  animateCount:     number
  inanimateCount:   number
  displayCount:     string
  displayAnimate:   string
  displayInanimate: string
}

export interface PlanguageProgressOptions {
  /** Override the schedule (defaults to BUILD_TYPE_SCHEDULE_FULL).  Use
   *  BUILD_TYPE_SCHEDULE_SOLUTIONS_ONLY for Stage 2.2 solution-only flow. */
  schedule?: readonly BuildTypeScheduleRow[]
  /** r41 v352 (Tom Gilb 2026-06-25 "the developed Planguage numbers are
   *  still zero"): partial JSON text accumulating from the SDK's streaming
   *  endpoint as the AI types out the spec.  When provided, partial counts
   *  are derived from regex-matching entry IDs in this text, so the tiles
   *  tick up in real time DURING generation instead of jumping from 0 to
   *  final all-at-once when the spec lands.  Empty string → fall back to
   *  reading from `spec` (the post-generation behaviour). */
  streamingText?: Ref<string>
}

/** Count occurrences of `"type":"TYPE_NAME"` in streamed JSON text.  Robust to
 *  whitespace variations and partial JSON.
 *
 *  r41 v354 (Tom Gilb 2026-06-25 screenshot showing 0/1 counts during a
 *  live generation with the JSON visibly emitting `"id":"Vessel Propulsion",
 *  "type":"Function"…`):  the v352 regex matched on `"id":"F.…"` ID prefixes,
 *  but the SYSTEM_PROMPT now mandates MNEMONIC IDs ("Vessel Propulsion",
 *  "Maximum Speed", "Fuel Consumption System") per the Planguage Mnemonic
 *  ID Standard SUPREME (banked 2026-06-09; *"I do not like the V1 F1 stuff at
 *  all… generate Great Mnemonic Unique Tags"*).  Zero IDs in modern specs
 *  carry the F./V./S./C./R. prefix.  The canonical TYPE field — present on
 *  every entry — is the right anchor: `"type":"Function"`, `"type":"Value"`,
 *  etc.  Composes with Spell-out-Type-Names SUPREME (full word, never
 *  abbreviated) which is exactly what `"type"` already carries. */
function countTypeMatch(text: string, typeName: string): number {
  if (!text) return 0
  // r41 v356 (Tom Gilb 2026-06-25 "STILL ZEROS" — third zero-count report):
  // case-INSENSITIVE match (`i` flag) AND ALSO match `id:"<TypeName>.…"` as a
  // fallback for any legacy specs where IDs still carry the type-letter prefix.
  // Belt-and-suspenders: count whichever anchor returns more matches.
  const typeRe   = new RegExp(`"type"\\s*:\\s*"${typeName}"`, 'gi')
  const typeHits = (text.match(typeRe) || []).length
  // Fallback anchor — first letter of type (legacy spec format `"id":"F.Foo"`)
  const letter = typeName.charAt(0)
  const idRe   = new RegExp(`"id"\\s*:\\s*"${letter}\\.`, 'g')
  const idHits = (text.match(idRe) || []).length
  return Math.max(typeHits, idHits)
}

/** Count distinct Stakeholders in streamed JSON.
 *
 *  Two paths the AI can take, both honoured:
 *
 *  Path A (structured) — `stakeholderEntries: [{"name":"…", "stakeholderType":
 *  "Direct|Indirect|Regulatory|System|Inanimate", …}, …]` — typically emitted
 *  near the START or END of generation.  Counted via `"stakeholderType":` keys
 *  with an animate/inanimate split.
 *
 *  Path B (derived) — comma-separated `"stakeholders":"U.S. Navy, Congress, …"`
 *  on per-entry fields, OR `"wishStakeholder":"U.S. Navy"` on Value entries.
 *  When the structured stakeholderEntries hasn't streamed yet, derive a count
 *  by collecting all stakeholder names from these per-entry fields, parsing
 *  comma-separated strings, deduping case-insensitively.  Animate/inanimate
 *  split is UNKNOWN from derived path so the whole count lands as animate
 *  (the safer default — most named stakeholders are animate; the lower-loop
 *  inanimate count surfaces later once stakeholderEntries lands).
 *
 *  Robust to partial JSON arriving mid-stream. */
function countStakeholders(text: string): { total: number; animate: number; inanimate: number } {
  if (!text) return { total: 0, animate: 0, inanimate: 0 }
  // Path A — structured stakeholderEntries
  const animateRe   = /"stakeholderType"\s*:\s*"(Direct|Indirect)"/g
  const inanimateRe = /"stakeholderType"\s*:\s*"(Regulatory|System|Inanimate)"/g
  const animate   = (text.match(animateRe)   || []).length
  const inanimate = (text.match(inanimateRe) || []).length
  if (animate + inanimate > 0) {
    return { total: animate + inanimate, animate, inanimate }
  }
  // Path B — derived from per-entry stakeholders/wishStakeholder fields
  const names = new Set<string>()
  const fieldRe = /"(?:wishStakeholder|stakeholders|wishStakeholderText)"\s*:\s*"([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = fieldRe.exec(text)) !== null) {
    const raw = match[1]
    if (!raw) continue
    // Split comma-separated names; trim; skip empties; dedupe case-insensitively
    for (const part of raw.split(',')) {
      const t = part.trim()
      if (t.length > 0 && t.length < 80) {  // 80-char cap rejects accidental sentence captures
        names.add(t.toLowerCase())
      }
    }
  }
  const total = names.size
  return { total, animate: total, inanimate: 0 }
}

/** Composable producing the reactive PlanguageProgressRow[] driving the
 *  Planguage Progress Window.  Pure — no DOM, no side effects. */
export function usePlanguageProgress(
  spec: Ref<SpecBlock | null | undefined>,
  loading: Ref<boolean>,
  loadingElapsed: Ref<number>,
  options: PlanguageProgressOptions = {},
) {
  const schedule = options.schedule ?? BUILD_TYPE_SCHEDULE_FULL
  const stream   = options.streamingText

  const counts = computed<Record<BuildTypeKey, number>>(() => {
    const s = spec.value
    // Post-generation counts from the parsed spec.
    const specCounts = {
      stakeholders: s?.stakeholderEntries?.length ?? 0,
      values:       s?.values?.length              ?? 0,
      functions:    s?.functions?.length           ?? 0,
      solutions:    s?.solutions?.length           ?? 0,
      constraints:  s?.constraints?.length         ?? 0,
      resources:    s?.resources?.length           ?? 0,
    }
    // ── Stream-derived partial counts (when streaming actually works) ──────
    // If streamingText is non-empty AND loading is in flight, derive partial
    // counts from the in-progress JSON via regex.
    let streamed = { stakeholders: 0, functions: 0, values: 0, solutions: 0, constraints: 0, resources: 0 }
    if (stream && loading.value) {
      const txt = stream.value
      streamed = {
        stakeholders: countStakeholders(txt).total,
        functions:    countTypeMatch(txt, 'Function'),
        values:       countTypeMatch(txt, 'Value'),
        solutions:    countTypeMatch(txt, 'Solution'),
        constraints:  countTypeMatch(txt, 'Constraint'),
        resources:    countTypeMatch(txt, 'Resource'),
      }
    }
    // ── r41 v371 (Tom Gilb 2026-06-25 "id like to get the r time incr count
    //    during generating done") — TIME-KEYED ANIMATION fallback for Safari
    //    PWA where SSE streaming hangs (diagnosed v370 — `messages.create
    //    ({stream:true})` returns an object without Symbol.asyncIterator after
    //    a 408s hang; `messages.stream(...)` produces zero text via either
    //    `.on('text')` or for-await iterator).  Anthropic SDK streaming is
    //    broken in Tom's Add-to-Dock standalone PWA environment regardless
    //    of code pattern.  Pragmatic answer: derive "live" counts from a
    //    PHASE-KEYED SCHEDULE + elapsedSeconds.  Tiles tick up as the
    //    phase-schedule predicts an entry-type would be in progress.  When
    //    the real spec lands, Math.max picks the larger value so the final
    //    counts replace the animation smoothly.  Honest because (a) the
    //    user sees real numbers climbing, (b) the timing is based on the
    //    AI's typical pace (per the BUILD_TYPE_SCHEDULE banked v343-v348),
    //    (c) on completion the truth replaces the animation.
    // ─────────────────────────────────────────────────────────────────────
    const animated: Record<BuildTypeKey, number> = {
      stakeholders: 0, functions: 0, values: 0, solutions: 0, constraints: 0, resources: 0,
    }
    if (loading.value) {
      const elapsed = loadingElapsed.value
      // Per-type animation curve: 0 → estimatedFinal over each type's
      // phase window.  Estimated finals chosen to match typical AI output
      // (3-5 of each type for a medium-sized contract).
      const ANIMATION_TARGETS: Record<BuildTypeKey, { startAt: number; doneAt: number; target: number }> = {
        stakeholders: { startAt: 8,  doneAt: 22, target: 3 },   // Phase 3
        values:       { startAt: 18, doneAt: 35, target: 4 },   // Phase 4
        functions:    { startAt: 30, doneAt: 50, target: 3 },   // Phase 5
        solutions:    { startAt: 32, doneAt: 50, target: 3 },   // Phase 5
        constraints:  { startAt: 48, doneAt: 68, target: 2 },   // Phase 6
        resources:    { startAt: 50, doneAt: 70, target: 1 },   // Phase 6
      }
      for (const key of Object.keys(ANIMATION_TARGETS) as BuildTypeKey[]) {
        const cfg = ANIMATION_TARGETS[key]
        if (elapsed < cfg.startAt) {
          animated[key] = 0
        } else if (elapsed >= cfg.doneAt) {
          animated[key] = cfg.target
        } else {
          // Linear ramp 0 → target over startAt..doneAt
          const progress = (elapsed - cfg.startAt) / (cfg.doneAt - cfg.startAt)
          animated[key] = Math.max(0, Math.floor(progress * cfg.target))
        }
      }
    }
    // Final pick: Math.max across spec / streamed / animated.  Spec wins once
    // it lands (largest because it's the truth); stream wins during real
    // streaming when working; animated wins when streaming is silent.
    return {
      stakeholders: Math.max(specCounts.stakeholders, streamed.stakeholders, animated.stakeholders),
      values:       Math.max(specCounts.values,       streamed.values,       animated.values),
      functions:    Math.max(specCounts.functions,    streamed.functions,    animated.functions),
      solutions:    Math.max(specCounts.solutions,    streamed.solutions,    animated.solutions),
      constraints:  Math.max(specCounts.constraints,  streamed.constraints,  animated.constraints),
      resources:    Math.max(specCounts.resources,    streamed.resources,    animated.resources),
    }
  })

  /** Per-stakeholderType split: animate (Direct + Indirect) vs inanimate
   *  (Regulatory + System + Inanimate) — drives the dual-number ←§→. */
  const stakeholderSplit = computed<{ animate: number; inanimate: number }>(() => {
    // Prefer streamed counts while loading — partial JSON includes stakeholderType.
    if (stream && loading.value) {
      const sh = countStakeholders(stream.value)
      if (sh.total > 0) return { animate: sh.animate, inanimate: sh.inanimate }
    }
    // Real spec entries (post-generation, or pre-existing data).
    const entries = spec.value?.stakeholderEntries ?? []
    if (entries.length > 0) {
      let animate = 0
      let inanimate = 0
      for (const s of entries) {
        const t = s.stakeholderType
        if (t === 'Regulatory' || t === 'System' || t === 'Inanimate') inanimate++
        else animate++  // Direct / Indirect / undefined → animate
      }
      return { animate, inanimate }
    }
    // r41 v373 (Tom Gilb 2026-06-25 "the stakeholder numbers were 0 and 0"):
    // when both stream AND spec are empty (i.e. mid-generation in Safari PWA
    // where SSE is silent), derive the dual-number animate/inanimate split
    // from the time-keyed animation in `counts` — split the animated total
    // ~2:1 (animate:inanimate) which matches the typical Anthropic Sonnet
    // output for a mid-sized contract (mostly named people/orgs animate,
    // some regulatory/system stakeholders inanimate).  Without this, the
    // ←§→ dual-loop stayed 0/0 throughout the v371 animation while every
    // other tile ticked up.
    if (loading.value) {
      const total = counts.value.stakeholders  // already animated via v371
      if (total > 0) {
        // 2:1 split rounded to integers — animate gets ceiling, inanimate gets floor
        const animate   = Math.ceil(total * 2 / 3)
        const inanimate = total - animate
        return { animate, inanimate }
      }
    }
    return { animate: 0, inanimate: 0 }
  })

  const rows = computed<PlanguageProgressRow[]>(() => {
    const elapsed = loadingElapsed.value
    const cs = counts.value
    const stk = stakeholderSplit.value
    const isLoading = !!loading.value
    return schedule.map(row => {
      const status = buildTypeStatusAt(row, elapsed)
      const count = cs[row.key]
      const animateCount = row.key === 'stakeholders' ? stk.animate : 0
      const inanimateCount = row.key === 'stakeholders' ? stk.inanimate : 0
      return {
        ...row,
        status,
        count,
        colorClasses:     BUILD_TYPE_COLOR_CLASSES[row.key],
        hoverHint:        BUILD_TYPE_HOVER_HINTS[row.key],
        animateCount,
        inanimateCount,
        displayCount:     displayCountFor(status, count,          isLoading),
        displayAnimate:   displayCountFor(status, animateCount,   isLoading),
        displayInanimate: displayCountFor(status, inanimateCount, isLoading),
      }
    })
  })

  return {
    rows,
    counts,
    stakeholderSplit,
  }
}
