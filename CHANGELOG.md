# SEM App — Design & Change Log

Retrospective log of all design decisions, feature additions, and UX changes.

**Attribution format (mandatory on every entry):**
> Suggested by: [name] · Designed by: [name]

**Sourcing codes:**
- **[Spec]** — decision recorded in Planguage solution register
- **[VACoder]** — implemented by VACoder agent per spec
- **[Tom]** — explicit request from Tom Gilb in session
- **[Code]** — reconstructed from source comments (exact session date unknown)
- **[Git]** — from git commit message

**Tag taxonomy:**
`#architecture` `#composable-pattern` `#mobile-first` `#api-integration` `#auth`
`#voice-ux` `#speaker-ux` `#navigation` `#form-ux` `#confirm-pattern` `#always-visible`
`#mobile-safety` `#tool-ui` `#discoverability` `#session-restore` `#bug-fix` `#async-fix`
`#evo-planning` `#spec-output` `#export` `#analytics` `#collaboration` `#visualisation`
`#demo` `#mock` `#pattern` `#exportable` `#sharpening` `#spec-refinement`

**Export:** `npm run export-tag -- <tag>` · Add `--sem` for Stakes/Ends/Means triples.

---

## Session 2026-05-07 ~14:00 (continued)

### Feature #181 — Model Comparison: Differences + VDT
*2026-05-07 [Tom]*
`#evo-planning` `#spec-refinement` `#visualisation` `#exportable` `#api-integration`
**Suggested by:** Tom Gilb · **Designed by:** Claude

Full-screen model comparison modal accessible via the **📊 Compare** button in PlanModelBar. Supports ≥2 Plan Models input by recall (tag+version datalist) or file import (.json).

**Two comparison modes:**

*Mode 1 — Differences (8 selectable criteria):*
Each criterion has an icon+text button (multi-select). Criteria: 🔢 Types, 📝 Text, 📊 Value Levels, 💥 Impact Levels, 🔗 Sequences, 💰 Financials, 📅 Project Duration, ⚡ Effort. Tables render only rows that differ between models (amber-highlighted). Financials/Duration/Effort use keyword filtering (no API call).

*Mode 2 — VDT (Value Decision Table):*
A nominated Plan Model's V. entries become the criteria rows; all loaded models become the candidate columns. Scores (0–10) and rationale are editable inline (click any cell). **AI Auto-score** fires a single Anthropic API call returning a JSON matrix of `{score, rationale}` per criterion × model — populates the whole table at once. Winner per row shown with 🏆; win-count footer row; score colour-coded (green ≥7, yellow ≥4, red <4). Criteria model slot is separately tagged with `Set as Criteria` chip.

**Architecture:**
- `useModelComparison.ts` — module-level state: `_slots: ref<ComparisonSlot[]>`, `_mode`, `_activeCriteria: ref<DiffCriterion[]>` (array, not Set, for Vue reactivity). 8 pure diff functions (`computeTypesDiff`, `computeTextDiff`, etc.) usable in `computed()`. `createEmptyVDT` / `updateVDTScore` return new objects for reactivity. `runAutoScore()` single API call → fills `_vdtResult`. `clearComparison()` called in `startFresh()`.
- `ModelComparisonView.vue` — Teleport to `<body>`, `z-[600]`. Sticky header + close. Models section: chips with × remove. Add Model panel: recall by tag+version (datalist autocomplete from `allPlanTags`/`planVersionsForTag`) or file import. Inline cell editing: `editingCell` ref, Enter/blur commits via `updateVDTCell()`.

**SEM:**
Stakes: Planners choosing between strategic plans, architectures, or solution variants
Ends: Any plan can be compared to others on both factual differences and value criteria
Means: `useModelComparison.ts` + `ModelComparisonView.vue` + Compare button in PlanModelBar

---

### Enhancement #180a — Sharpen Plan buttons in EvoPlanView
*2026-05-07 [Tom]*
`#sharpening` `#spec-refinement` `#evo-planning` `#discoverability`
**Suggested by:** Tom Gilb · **Designed by:** Claude

Two amber call-to-action strips added to EvoPlanView's Plan tab — one above the tab bar ("Want a sharper spec before confirming?") and one below the Confirm Plan button ("Not quite right?"). Each contains a `🔪 Sharpen this plan` button that emits `sharpen-plan` to App.vue, opening the SharpenPanel modal.

**SEM:**
Stakes: Planners reviewing the Evo plan who notice spec quality issues
Ends: The option to sharpen is always visible at the plan review stage, top and bottom
Means: Two `@click="emit('sharpen-plan')"` amber strips in EvoPlanView

---

### Feature #179 — Plan Model: named, versioned spec snapshots
*2026-05-07 [Tom]*
`#evo-planning` `#exportable` `#session-restore` `#architecture` `#composable-pattern`
**Suggested by:** Tom Gilb · **Designed by:** Claude

Every generated or sharpened spec is automatically wrapped in a **Plan Model** — a named, versioned, tagged, persistable snapshot. Version starts at `0.1` and bumps by `0.1` on each sharpen round (`0.9 → 1.0`). Name is auto-derived from the first F. entry's description (first 5 words) or set by the user inline.

**PlanModelBar** (dark slate strip above EvoPlanView): inline name editing (click-to-rename), inline version editing (click-to-set), 🔪 rounds badge, `#tag` display, 💾 Export (.json download), 📂 Load panel, 📊 Compare button.

Load panel supports two input modes:
1. **Import from file** — drag `.json` → `importPlanModel()` validates shape, restores spec
2. **Recall by tag + version** (latest if blank) or **by date** — datalist autocomplete from `allPlanTags()` / `planVersionsForTag()`

**Architecture:**
- `usePlanModel.ts` — module-level singleton. `_history: PlanModel[]` in `localStorage` (`sem-plan-models`). `initPlanModel(spec)` on `doTranslate`. `bumpPlanVersion(refined)` on `onSpecSharpened`. `clearPlanModel()` on `startFresh`. Key composable exports: `loadPlanByTag`, `loadPlanByDate`, `exportPlanModel`, `importPlanModel`, `allPlanTags`, `planVersionsForTag`.
- `PlanModelBar.vue` — emits `load(PlanModel)` and `compare()`.

**SEM:**
Stakes: Planners iterating over multiple plan versions or importing shared models
Ends: Every plan is identifiable, recoverable, and comparable by name, version, or date
Means: `usePlanModel.ts` singleton + `PlanModelBar.vue` identity strip

---

### Enhancement #174a — Sharpen suggestion chips
*2026-05-07 [Tom]*
`#sharpening` `#spec-refinement` `#form-ux` `#discoverability`
**Suggested by:** Tom Gilb · **Designed by:** Claude

Each sharpening question now ships with 3–4 concrete answer suggestions rendered as amber pill buttons. Clicking a chip pre-fills the answer textarea — the user can accept as-is, edit, or type their own. `SharpenQuestion` interface extended: `{ text: string; suggestions: string[] }`. AI prompt updated to return `{ text, suggestions }[]` with `max_tokens: 1024`. Graceful fallback: bare strings normalised to `SharpenQuestion`. Mock returns 4 suggestions per question.

**SEM:**
Stakes: Planners who are unsure how to answer sharpening questions
Ends: Every question has 3–4 actionable answer options ready to tap
Means: `suggestions: string[]` on `SharpenQuestion` + amber chip buttons in `SharpenPanel.vue`

---

### Feature #177 — Generated spec timestamp
*2026-05-07 ~15:30 [Tom]*
`#spec-output` `#discoverability` `#exportable`
**Suggested by:** Tom Gilb · **Designed by:** Claude

Each generated spec now shows its creation date and time in the header, directly below the "Generated Spec" heading. Format: `7 May 2026 · 14:32`. The timestamp is cleared when the user starts a fresh spec.

**Architecture:** `specGeneratedAt: ref<Date | null>` in `App.vue`, set immediately after `currentSpec.value` is populated in `doTranslate()`, cleared in `startFresh()`. Passed to `SpecOutput` via new `generatedAt?: Date | null` prop. `_formatTimestamp()` helper produces the display string without locale dependencies. Rendered as an HTML `<time>` element with `datetime` ISO attribute for accessibility and machine-readability.

**SEM:**
Stakes: Planners reviewing or sharing a generated spec
Ends: Every spec view shows exactly when it was generated
Means: `generatedAt` prop + `<time>` element in SpecOutput header

---

### Feature #178 — Glossary button redesigned for discoverability
*2026-05-07 ~15:30 [Tom]*
`#discoverability` `#tool-ui` `#spec-output`
**Suggested by:** Tom Gilb · **Designed by:** Claude

The `📖 Glossary` button (Feature #61 / #175) was a small `text-[10px]` neutral pill — easy to overlook. Redesigned to amber theme (matching the glossary panel's amber colour), larger `text-xs` padding, and a live term-count badge that appears once terms are extracted. Active state: solid amber-500. Inactive state: amber-50 bg with amber-300 border — visually distinctive from the grey toolbar pills flanking it.

**SEM:**
Stakes: Users who have generated a spec and want to explore its terminology
Ends: The Glossary button is immediately identifiable and invites interaction
Means: Amber theming + count badge + increased button size

---

### Feature #175 — Glossary button made prominent in SpecOutput toolbar
*2026-05-07 ~14:00 [Tom]*
`#discoverability` `#tool-ui` `#spec-output`
**Suggested by:** Tom Gilb · **Designed by:** Claude

Added a visible `📖 Glossary` button to SpecOutput's profile/palette toolbar row, sitting left of the `🔍 Search features` button. Previously the Glossary (Feature #61) was only accessible by opening the command palette and searching. The button uses active/inactive styling (`glossaryOpen` toggle) and calls the existing `handleGlossary()` function — no new API or composable needed. Voice command `"Glossary"` also added to dictation map.

---

### Feature #176 — SelectionDefiner: define any text by selecting it, voice, or Cmd+D
*2026-05-07 [Tom]*
`#discoverability` `#tool-ui` `#voice-ux` `#api-integration` `#exportable`
**Suggested by:** Tom Gilb · **Designed by:** Claude

Three-way interaction for looking up any term's definition + source attribution:

1. **Select any text** in the app → a floating `📖 Define` pill appears above the selection → click it
2. **Say "Define"** (with text selected) → voice command triggers definition of selected text
3. **Press ⌘D / Ctrl+D** → keyboard shortcut triggers definition of selected text

Result slides up as a bottom panel showing:
- The term being defined
- AI-generated definition tailored to this project's spec context
- 📚 Source attribution (citing Gilb's CE literature, ISO standards, technical standards, or domain)
- Type badge: Planguage term · CE concept · Domain term · Technical standard · General business

**Architecture:** `useDefine.ts` (module-level singleton: `defineTerm()`, `defineCurrentSelection()`, `closeDefine()`) · `SelectionDefiner.vue` (globally mounted; listens to `selectionchange` + `mouseup`, debounced 220ms; Teleport for pill + panel; auto-hides pill inside input/textarea elements) · Mounted in App.vue alongside SpeakerButton + DictateButton

**Context-awareness:** When a spec is loaded, the AI receives the full spec (functions, values, solutions) as context so definitions are tailored to the project's domain and terminology.

**SEM:**
Stakes: Planners and developers using SEM App who encounter unfamiliar terms in specs or tool output
Ends: Any term can be defined with source attribution in <3 seconds without leaving the app
Means: Global text selection listener + AI definition API + floating pill UI + keyboard/voice shortcuts

---

### Feature #174 — Sharpening Cycles
*2026-05-07 [Tom]*
`#sharpening` `#spec-refinement` `#tool-ui` `#form-ux` `#api-integration` `#exportable`
**Suggested by:** Tom Gilb · **Designed by:** Claude

After the initial 5 basic SEM questions produce a spec, a **Sharpening Cycles** panel appears before "Plan Evo Steps". The planner can iteratively sharpen the spec across 10 dimensions until clicking "✅ Sharp Enough", which reveals the Plan Evo Steps button.

**Dimensions:** 💰 Finance · 🚧 Constraints · ⏳ Time Horizons · 🧩 Aspects (Where/Who/What/If/How) · 🏗️ Systems Level · 💡 Innovative · ⚔️ Competitive · 👥 Stakeholders · ⚠️ Risks · 📊 Metrics

**Flow:**
1. Spec generated → SharpenPanel appears inline (replaces Plan button until "Sharp Enough")
2. Planner picks a dimension → AI generates 3–5 specific questions
3. Planner answers → AI refines the SpecBlock → spec updates in place
4. Repeat any number of times, across any dimensions
5. Click ✅ Sharp Enough → panel collapses → Plan Evo Steps revealed

**Nav bar integration:** A "🔪 Sharpen ▾" dropdown button appears in both nav bars (Supabase + mock mode) whenever a spec is loaded. Clicking any dimension opens the same SharpenPanel as a modal overlay — available from all stages (2, 3, 4, 5).

**Architecture:** `useSharpen.ts` (module-level singleton state, two AI calls: question generation + spec refinement) · `SharpenPanel.vue` (dual inline/modal via `modal` prop + Teleport) · `SharpenDropdown.vue` (compact nav button)

**State gating:** `sharpeningDone` ref gates "Plan Evo Steps". Reset on every new spec generation (`handleSubmit`). `resetSharpen()` clears round history for fresh start.

**SEM:**
Stakes: Planners using SEM App to produce a Planguage spec from initial SEM input
Ends: Increase spec depth and measurability before Evo planning begins
Means: Iterative AI-guided sharpening across Finance, Constraints, Risks, and 7 other dimensions

---

## Architecture & Evo Step Deliveries

### Evo Step 1 — Vue 3 composable architecture + SEM entry form
*~pre-2026-05-01 [Git / Spec]*
`#architecture` `#composable-pattern` `#mobile-first` `#form-ux` `#exportable`
**Suggested by:** Tom Gilb (via Planguage spec) · **Designed by:** VACoder

- Vue 3 SPA with Vite + TypeScript strict mode + Tailwind CSS v3
- `composable-first` pattern: all logic in `useXxx` hooks; components are thin shells
- `SEMEntryForm.vue` — mobile-first Stakes / Ends / Means textarea, 375px base, 44×44px touch targets
- `useEntryForm.ts`, `useValidation.ts`, `useSpecExport.ts` composables
- `SpecBlock` TypeScript interface — `FEntry`, `VEntry`, `SEntry`
- Stage machine: stage 1 (form + spec) → 2 (evo plan) → 3 (tasks) → 4 (impact) → 5 (export)
- `formResetKey` pattern for forced `SEMEntryForm` remount

### Evo Step 2 — Anthropic SDK pipeline + CE system prompt
*~pre-2026-05-01 [Git / Spec]*
`#api-integration` `#architecture` `#mock` `#exportable`
**Suggested by:** Tom Gilb (via Planguage spec) · **Designed by:** VACoder

- `useSDK.ts` — Anthropic SDK pinned, singleton client, `dangerouslyAllowBrowser: true`, 90s timeout
- CE system prompt with 3 few-shot examples (2 professional, 1 personal); pure JSON output
- `cache_control: { type: "ephemeral" }` on system prompt block; `betas: ["prompt-caching-2024-07-31"]`
- `parseSpecBlock()` — validates LLM response structure; rejects missing arrays, empty sets, missing V fields
- `buildMockSpec()` — initial version (placeholder IDs; replaced 2026-05-06)
- `VITE_MOCK_MODE` env flag to bypass all API calls
- `VITE_ANTHROPIC_API_KEY` env var; hard error if missing (not silent)
- `max_tokens: 8192`; truncation detection before JSON parse

### Evo Step 2a — Precision Mode: Clarifying Questions before spec generation
*~pre-2026-05-01 [Spec / VACoder]*
`#form-ux` `#api-integration` `#discoverability` `#exportable`
**Suggested by:** Tom Gilb (via Planguage spec) · **Designed by:** VACoder

An optional "Ask for precision" analysis mode. When selected before submitting a SEM entry:
1. `useClarifyingQuestions.ts` sends the SEM payload to the AI, which returns 3–5 targeted clarifying questions about ambiguities in the Stakes/Ends/Means.
2. `ClarifyView.vue` presents the questions as an interstitial Q&A form.
3. The planner's answers are bundled as `clarifications` and passed to `doTranslate()` alongside the original SEM — producing a more precise spec.

This is a branch of `Evo Step 2 PipelineHandler` (`S.EvoStep2.PipelineHandler — precision mode branch`). Features complementary to the default "Just do it" (`quick`) mode.

**Architecture:** `analysisMode: 'quick' | 'precise'` ref in `App.vue`; `stage1Sub: 'input' | 'questions' | 'answering'` sub-stage machine; `useClarifyingQuestions.ts` composable; `ClarifyView.vue` component.

**SEM:**
Stakes: Planners with complex or ambiguous SEM inputs
Ends: Spec reflects clarified intent by incorporating answers before generation
Means: Two-phase pipeline — clarify first, then generate with answers as additional context

---

### Evo Step 3 — Markdown export + SpecOutput
*~pre-2026-05-01 [Spec / VACoder]*
`#spec-output` `#export`
**Suggested by:** Tom Gilb (via Planguage spec) · **Designed by:** VACoder

- `useSpecExport.ts` — serialises `SpecBlock` → Planguage Markdown
- `SpecOutput.vue` — loading spinner, error display, rendered markdown, Copy button

### Evo Step 4 — Supabase auth + multi-user team capability
*~pre-2026-05-01 [Spec / VACoder]*
`#auth` `#collaboration` `#architecture`
**Suggested by:** Tom Gilb (via Planguage spec) · **Designed by:** VACoder

- Supabase Auth + RLS + RBAC via `workspace_members` table
- `useAuth.ts` — `signUp`, `signIn`, `signOut`, `acceptInvite`
- `useWorkspace.ts` — workspace CRUD, invitation dispatch, collision resolution
- Auto-suffix collision resolution: incoming IDs that collide suffixed `_2`…`_99`
- Invitation deep link: 48h token → URL hash → `InviteAcceptView.vue` → `verifyOtp()`
- `SignInView.vue`, `SignUpView.vue`, `InviteAcceptView.vue`, `CollisionLog.vue`
- DB schema: `workspaces`, `workspace_members`, `sem_entries`, `spec_collisions` + RLS policies

### Evo Steps 5–9 — EvoPlanView features, visualisations, task decomposition, impact estimation
*~pre-2026-05-01 [Code / VACoder]*
**Suggested by:** Tom Gilb (via Planguage spec) · **Designed by:** VACoder

Features reconstructed from source comments (exact order/dates unknown within this range):

| Feature # | Description | Tags |
|---|---|---|
| #2 | Value Delivery Timeline SVG (Timeline tab in EvoPlanView) | `#evo-planning` `#visualisation` |
| #3 | Stakeholder Coverage Radial SVG (Coverage tab) | `#evo-planning` `#visualisation` |
| #5 | "What If" resource slider — adjustable hours/week | `#evo-planning` `#form-ux` |
| #8 | Demo mode — fills form with demo SEM, shows progress bar | `#demo` `#discoverability` |
| #12 | Celebration confetti overlay on reaching stage 5 | `#navigation` `#form-ux` |
| #15 | Value counter strip (stages 2+) | `#evo-planning` `#discoverability` |
| #16 | Real-time collaboration cursors (Supabase presence) | `#collaboration` |
| #17 | Comparison mode — two independent form+spec pairs side by side | `#spec-output` `#form-ux` |
| #21 | Dependency visualiser in EvoPlanView | `#evo-planning` `#visualisation` |
| #27 | Risk Radar chart | `#evo-planning` `#visualisation` |
| #29 | Spec version history drawer with badge count | `#spec-output` `#navigation` |
| #32 | Gantt SVG computations | `#evo-planning` `#visualisation` |
| #35 | AI Spec Coach — floating chat bubble when spec is loaded | `#spec-output` `#api-integration` `#always-visible` |
| #36 | Effort Breakdown Doughnut (EffortRing component) | `#evo-planning` `#visualisation` |
| #40 | Animated Value Delivery Replay overlay | `#evo-planning` `#visualisation` |
| #47 | Emoji progress tracker per step | `#evo-planning` `#form-ux` |
| #50 | Multi-project Dashboard slide-in panel | `#navigation` `#spec-output` |
| #51 | Collaboration conflict detector + banner | `#collaboration` `#always-visible` |
| #53 | Progressive spec wizard ("Start with your goal") | `#form-ux` `#discoverability` `#exportable` |
| #55 | Goals radar overlay | `#evo-planning` `#visualisation` |
| #58 | Skills matrix per step | `#evo-planning` `#form-ux` |
| #64 | Step cost estimator panel | `#evo-planning` `#form-ux` |
| #71 | Spec Presentation Mode (full-screen slideshow) | `#spec-output` `#export` |
| #73 | Sprint planner panel | `#evo-planning` |
| #77 | Animated onboarding tour | `#discoverability` `#form-ux` |
| #82 | Confidence vote per step | `#evo-planning` `#form-ux` |
| #86 | WSJF scorer panel | `#evo-planning` |
| #89 | Bubble chart visualisation | `#evo-planning` `#visualisation` |
| #91 | Definition of Done per step | `#evo-planning` |
| #95 | Learning Outcomes per step | `#evo-planning` `#exportable` |
| #101 | Capacity planner panel | `#evo-planning` |
| #106 | Risk Mitigation Plan | `#evo-planning` `#exportable` |
| #113 | Evo Step Retrospective Generator | `#evo-planning` `#exportable` |
| #116 | Definition of Ready | `#evo-planning` |
| #121 | Pair Programming Prompt | `#evo-planning` |
| #125 | Spike summary line | `#evo-planning` |
| #128 | WIP Limit panel | `#evo-planning` |
| #130 | Energy Forecast panel | `#evo-planning` `#visualisation` |
| #133 | Knowledge Graph panel | `#evo-planning` `#visualisation` |
| #135 | Mob Programming Planner | `#evo-planning` |
| #138 | Blocker Log | `#evo-planning` |
| #140 | Acceptance Test Generator | `#evo-planning` `#exportable` |
| #143 | Timeboxing Planner | `#evo-planning` |
| #145 | Daily Standup Generator | `#evo-planning` `#exportable` |
| #148 | Meeting Agenda Generator | `#evo-planning` `#exportable` |
| #150 | Burn-Down Estimator panel | `#evo-planning` `#visualisation` |
| #153 | Retro Themes panel | `#evo-planning` `#exportable` |
| #155 | T-Skills toggle per step | `#evo-planning` |
| #158 | Team Mood Summary / Mood badge per step | `#evo-planning` |
| #160 | Pair Rotation panel | `#evo-planning` |
| #163 | Cognitive Load indicator | `#evo-planning` `#exportable` |
| #165 | Flow Efficiency panel | `#evo-planning` `#visualisation` |
| #168 | Uncertainty Cone panel | `#evo-planning` `#visualisation` |
| #173 | Mood × Velocity Correlation panel | `#evo-planning` `#visualisation` |

### Evo Step 9 — Impact Estimation VDT UI
*2026-05-01 [VACoder — confirmed in spec register]*
`#spec-output` `#evo-planning` `#exportable`
**Suggested by:** Tom Gilb (via Planguage spec) · **Designed by:** VACoder

- `ImpactEstimationView.vue` — editable V×S impact grid, V/C footer, ranked sidebar, Regenerate button
- `useImpactSuggestions.ts` — mock/AI suggestions, updateCell, vcRatios, rankedSolutions
- `ImpactMatrix` TypeScript type in `src/types/impact.ts`
- Snapshot via `getSnapshot()` — captured synchronously before stage 5 unmounts the component

### Evo Step 10 — Analytics + Survey Gate
*~2026-05-01 [VACoder / Spec]*
`#analytics` `#always-visible`
**Suggested by:** Tom Gilb (via Planguage spec) · **Designed by:** VACoder

- `useAnalyticsEvents.ts` — `logMobileSession`, `logSpecGenerated`, `logEvoPlanConfirmed`,
  `logImpactEstimated`, `logStageComplete`, `logSessionRestored`, `logLlmCall`
- `useSurveyGate.ts` — post-generation and post-planning confidence survey triggers
- `SurveyGateModal.vue` — in-app rating modal (2S.V.PlannerConfidence / PlannerPlanningTrust)
- `_mountMs` captured before async work for accurate `EntryFluency` elapsed timing

---

## Session Changes — 2026-05-06 ~19:00 (evening)

### Voice command false-positive fix
*`useDictation.ts`*
`#voice-ux` `#bug-fix` `#mobile-safety` `#pattern` `#exportable`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Problem:** Short commands like `'Go'` (2 chars) matched any phrase containing "go" — "goal", "going", etc. — causing unintended stage advances mid-speech.
- **Fix:** Added `commandPhraseMatches()` helper — for phrases ≤5 chars, applies word-boundary regex `(?:^|\s)phrase(?:\s|$)` before firing action. Longer phrases use plain substring match.
- **SEM:** Stakes: voice users on mobile. Ends: commands fire only on exact phrase match, not substring. Means: word-boundary regex guard for short phrases.

### Wizard flow async gap fix
*`App.vue`*
`#async-fix` `#bug-fix` `#navigation` `#form-ux`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Problem:** `handleWizardSubmit` was synchronous — called `handleSubmit` but did not await it. Spec generated but stage stayed at 1; user dropped back at a blank form.
- **Fix:** Made `handleWizardSubmit` `async`; now `await handleSubmit(...)`, then `if (currentSpec.value) stage.value = 2`.
- **SEM:** Stakes: wizard users. Ends: land on Evo Plan stage after wizard completes, not back at blank form. Means: async/await + explicit stage advance after generation.

### Start Over — double-confirm guard
*`App.vue`*
`#confirm-pattern` `#mobile-safety` `#voice-ux` `#pattern` `#exportable`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Problem:** Start Over called `startFresh()` directly — one tap or misfired voice command cleared everything.
- **Fix:** `requestStartOver()` two-tap guard: first tap arms 3-second window (pulses red, "Confirm?"); second tap confirms; timeout resets silently. Voice commands route through the same guard.
- **SEM:** Stakes: mobile users, voice users. Ends: zero accidental data loss from single tap. Means: armed-state ref + 3s timeout + same guard for button and voice command.

### Session restore — blank form bug fix
*`App.vue`*
`#session-restore` `#bug-fix` `#navigation` `#form-ux`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Problem:** Sessions saved at stage 1 restored showing a blank form alongside the spec and a "Plan Evo Steps" button.
- **Fix:** `_tryRestoreSession` auto-advances to stage 2 when `restoredStage === 1 && savedCurrentSpec`.
- **SEM:** Stakes: returning users. Ends: restore lands on Evo Plan stage when a spec exists, not blank form. Means: stage override logic in restore function.

### `buildMockSpec()` complete rewrite
*`useSDK.ts`*
`#mock` `#spec-output` `#bug-fix`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Problem:** Mock produced generic placeholder IDs (`F.MockFunction`, `V.MockValue`, `S.MockSolution`) with hardcoded values regardless of input.
- **Fix:** Full rewrite — derives CamelCase IDs from actual input, extracts numeric ranges for realistic goal/tolerable values, extracts metric phrase and timeframe.
- **SEM:** Stakes: developers testing without API key. Ends: mock output reflects actual input so the full UI flow is testable with realistic data. Means: toCamel() + regex extraction pipeline in buildMockSpec().

### LAN exposure removed
*`vite.config.ts`*
`#architecture` `#mobile-safety`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Problem:** `host: true` exposed the dev server to all network interfaces.
- **Fix:** Removed `host: true`; server binds to localhost only.

### API key — live account
*`.env.local`*
`#api-integration`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- Swapped to Tom's Claudian (local Claude Code) API key. `VITE_MOCK_MODE=false` confirmed.

---

## Session Changes — 2026-05-07 ~07:00 (early morning)

### Stage 1 — entry/spec-review split
*`App.vue`*
`#navigation` `#form-ux` `#bug-fix` `#pattern` `#exportable`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Problem (recurring):** Blank entry form appeared alongside a ready spec — after "Back to spec", wizard flow, or session restore.
- **Fix:** Stage 1 split into two `v-if` sub-views: Entry mode (no spec) and Spec-review mode (spec exists, form hidden, "↺ Start new spec" link).
- **SEM:** Stakes: all users. Ends: the entry form is never shown alongside a ready spec. Means: v-if="currentSpec" split with a secondary "Start new spec" link to return to form.

### "Tools" label added to input toolbar
*`SEMEntryForm.vue`*
`#tool-ui` `#discoverability` `#form-ux`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Request:** Label the three tool buttons so the row has an identity.
- **Change:** `Tools` label prepended in the flex row, same muted-grey style as the existing `Mode:` label.
- **SEM:** Stakes: first-time users. Ends: toolbar row is immediately identifiable as a tool set. Means: text label left of buttons, matching existing label pattern.

### Templates panel — colored title bar + 🗑️ dismiss
*`SEMEntryForm.vue`*
`#tool-ui` `#discoverability` `#pattern` `#exportable`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Request:** Tool output panels need a colored name bar and a non-X dismiss button.
- **Change:** Indigo-600 header bar with `📋 Templates`; 🗑️ dismiss (Mac trash icon — no X).
- **SEM:** Stakes: users opening tool panels. Ends: every tool output panel is identifiable by name and dismissable without an X. Means: colored header bar + 🗑️ button pattern; indigo matches tool button colour.

### 🎤 Mic and 🔊 Loudspeaker — two independent always-visible controls
*`DictateButton.vue`, `SpeakerButton.vue`, `useSpeaker.ts`, `App.vue`*
`#voice-ux` `#speaker-ux` `#always-visible` `#pattern` `#exportable`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Request:** Mic (input) and loudspeaker (output) as two separate, always-visible, always-present controls on every screen.
- **Change:**
  - 🎤 `DictateButton.vue` (fixed bottom-right): removed `v-if="supported"` — always renders; greyed + disabled when Speech Recognition unavailable.
  - 🔊 `SpeakerButton.vue` (fixed bottom-left): new component; reads stage-appropriate content aloud using `SpeechSynthesis`. Greyed when unavailable.
  - `useSpeaker.ts`: new composable — `speak()`, `stopSpeaking()`, `togglePause()`; strips Markdown before synthesis.
  - Spatial metaphor: 🔊 left = output, 🎤 right = input.
- **SEM:** Stakes: all users, especially accessibility and mobile. Ends: voice input and voice output are always reachable on every screen regardless of browser support state. Means: two fixed-position buttons, always rendered, independently operable.

### Design export — tag system + export script
*`CHANGELOG.md`, `scripts/export-tag.js`, `package.json`*
`#export` `#architecture` `#exportable`
**Suggested by:** Tom Gilb · **Designed by:** Claude

- **Request:** Tag design entries so they can be filtered and exported — especially to Tom Gilb Consultant Twin app.
- **Change:** Tags added to all CHANGELOG entries; `npm run export-tag -- <tag>` script filters by tag; `--sem` flag outputs Stakes/Ends/Means triples ready to paste into SEM App; `--list` lists all tags.
- **SEM:** Stakes: Tom Gilb as consultant. Ends: any design pattern can be extracted by tag and re-entered into SEM App as a SEM triple for further specification. Means: inline tags + Node.js filter script + embedded SEM: lines on exportable entries.

---

## Pending / Not Yet Logged

- Changes to `OnboardingTour.vue` referencing "Start with your goal" — not yet updated to match toolbar label
- Title bars for "Surprise me" and "Start with your goal" tool outputs — pending
- Earlier sessions before 2026-05-06 — no session memory; reconstructed from code only
- **SpecOutput features #18–#174 gap:** Features with these numbers are SpecOutput panel features (Share #7, Challenge #13, Ambitious #19, Domain Badge #20, Spec Quality Ring #22 … Glossary #61 … etc.) reconstructed from source comments. They exist in `SpecOutput.vue` but were not individually logged here. A full retrospective log pass would add ~100+ entries. The Evo Steps 5-9 table covers only `EvoPlanView`-related features.
- **Session times (backfilled):** All times marked with `~` are approximate, inferred from session descriptions ("evening", "early morning") and session-note order. Exact wall-clock times were not recorded before 2026-05-07 ~14:00.

---

*Every entry must have: date · tags · **Suggested by** · **Designed by** · SEM triple (if exportable).*
