// UNIT_TYPE=Data
// stage1SubSteps.ts — canonical Stage 1 sub-step registry.
//
// Tom Gilb 2026-06-19 verbatim: "Stage 1:Steps: As you did well at a
// later stage, lets divide into clear steps call them 1.1 Spec Entry,
// 1.2 Spec Parsing, Step 1.3 Parse Implied Sharpening, 1.4 Planguage
// Generation, 1.5 Planguage Edit".
//
// IMPORTANT — why this lives in a plain .ts file and NOT inside the
// `<script setup>` of Stage1SubStepStrip.vue: Vue 3 `<script setup>` does
// NOT allow arbitrary top-level `export const` / `export type` / `export
// interface` declarations.  An attempt to do so crashes the Vite Vue
// plugin at module-load time with "Importing a module script failed."
// (Same constraint that drove planningStages.ts out of ValueCounter.vue
// in 2026-06-03.)  This data module sidesteps the limitation and is
// also more discoverable: future stage-aware navigators / agents /
// breadcrumbs MUST import from here.
//
// Composes with: Architectural Resilience SUPREME (registry + plain data,
// no Vue reactivity) + Twin portability (port verbatim to Kai's app).

/** Stable key for each Stage 1 sub-step.  Keep in sync with App.vue's
 *  `stage1SubStep` ref. */
export type Stage1SubStepKey = '1.1' | '1.2' | '1.3' | '1.4' | '1.5'

export interface Stage1SubStepDef {
  key:       Stage1SubStepKey
  label:     string
  shortHint: string
  longHint:  string
}

/** The five canonical Stage 1 sub-steps Tom defined 2026-06-19.
 *  r41 v323 (Tom Gilb 2026-06-24): verb-led action labels to match Stage 4
 *  (Look / Adjust / Approve / Tools / Move Ahead) and Stage 5 shape.
 *  Tom verbatim: "we now need to organize stage 1 like other stages. Suggestion
 *  1.1 Capture Spec Input". The other four labels follow the same verb-led
 *  shape: Capture → Parse → Add → Generate → Edit. */
export const STAGE1_SUBSTEPS: readonly Stage1SubStepDef[] = [
  { key: '1.1', label: 'Capture Spec Input',
    shortHint: 'Paste, fetch a URL, or upload a file.',
    longHint:  'Bring the raw source content INTO the SEM App.  Three input modes: paste text directly, paste a URL (fetched automatically), or upload a file (PDF / DOCX / MD / TXT).  This step ends when the input has been accepted.' },
  { key: '1.2', label: 'Parse to S·E·M',
    shortHint: 'Detect existing Planguage tags or fall through to AI extraction.',
    longHint:  'The deterministic local parser scans the input for canonical entry-type markers (Function. / Value. / Solution. / Constraint. / Resource.).  When markers are present, the local parser runs — instant, free.  When no markers are present (the common case for prose), AI extraction takes over.' },
  { key: '1.3', label: 'Add Implied Optional',
    shortHint: 'Review what the parser inferred; refine before commit.',
    longHint:  'The parse may have implied entries from ambiguous prose.  This step surfaces what the parser THINKS the spec is, lets the planner accept / reject / merge inferred entries, and asks targeted follow-up questions before committing to the full Planguage generation.' },
  { key: '1.4', label: 'Generate Planguage Spec',
    shortHint: 'Produce structured Function / Value / Solution / Constraint / Resource entries with full fields.',
    longHint:  'Final structured generation: every entry carries Mnemonic Tag + description; Values carry Scale + Meter + Tolerable + Goal + Wish; Resources carry Scale + Meter + Tolerable + Goal; Functions carry presence test; Constraints carry rationale.  Output is canonical Planguage ready for the Spec Editor.' },
  { key: '1.5', label: 'Edit & Refine',
    shortHint: 'Refine entries one-by-one in the Spec Editor.',
    longHint:  'The Spec Editor lets the planner refine each entry individually — rename Mnemonic Tags, tighten descriptions to the parameter-discipline ≤20-word rule, fill in any missing Tolerable/Goal/Wish levels, add Qualifier Conditions, link Solutions to Values.' },
] as const
