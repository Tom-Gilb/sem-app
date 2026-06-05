// UNIT_TYPE=Data
//
// settings.ts — SEM App user-settings schema + defaults + storage key.
//
// SOURCE (Tom Gilb 2026-06-03 verbatim):
//   *"I long ago requested and never saw a SEM settings Panel. Can you draft
//     one and put all the useful ideas in you can think about, and ten let me
//     list some: Setting: Ultra Light, or Pro SEM, Default Pro Sem.
//     Settings: collect maximum feedback data from use of this app, Do not
//     collect any feedback data"*
//
//   *"This is a universal design from me and for SEM: Maximize AI assistance
//     everywhere... WE want impressive help, not simplified ai access."*
//
// Architecture:
//   - Pure-data schema (twin-portable, no Vue coupling)
//   - All settings have safe defaults; missing fields backfilled on read
//   - localStorage persistence (single JSON blob keyed by SETTINGS_STORAGE_KEY)
//   - useSettings.ts composable reads/writes; SettingsPanel.vue renders
//   - Components opt-in to consume settings as they are wired (incremental rollout)
//
// v1 ships: the schema + the panel UI + persistence.  Consumption by other
// components is incremental — each setting becomes "live" as the relevant
// component is updated to read it.  This avoids a massive risky cross-file
// change in one commit.

// ── Setting value types ──────────────────────────────────────────────────────

/** Tom's flagship mode: Ultra Light (minimal UI, fewer options) vs Pro SEM
 *  (full toolkit, every panel + every Evo Tool + every audit trail).
 *  Default Pro SEM per Tom's 2026-06-03 directive. */
export type AppMode = 'ultra-light' | 'pro-sem'

/** AI Max principle level.  Default Maximum.  Off and Standard are for users
 *  who explicitly want to dial AI down (rare; included for completeness). */
export type AIAssistanceLevel = 'off' | 'standard' | 'maximum'

/** Telemetry: how much usage data to collect for product improvement.
 *  Tom's two named options: max collect / none.  Standard is the middle ground. */
export type TelemetryLevel = 'none' | 'standard' | 'maximum'

/** Default Evo cycle length applied to new plans.  Overridable per-plan
 *  via EvoCycleLengthPicker. */
export type DefaultCycleLength = 'day' | 'week' | 'month' | 'quarter'

/** Default selection mode for Sharp Interview answers (per question).
 *  Matches the SelectionMode in useEvoSharpAnswers but exported here as the
 *  default-per-new-question. */
export type DefaultSharpSelectionMode = 'mixed' | 'all' | 'typed-only' | 'ticked-only'

/** Theme — light / dark / auto-follow-system. */
export type Theme = 'light' | 'dark' | 'auto'

/** Visual density — for tables / lists / panels. */
export type Density = 'compact' | 'comfortable' | 'spacious'

/** Animation level — full / reduced (respects prefers-reduced-motion) / none. */
export type AnimationLevel = 'full' | 'reduced' | 'none'

/** Export format default. */
export type ExportFormat = 'html' | 'markdown' | 'json' | 'tsv'

// ── The whole settings schema ────────────────────────────────────────────────

export interface Settings {
  // ── Mode (Tom's first explicit setting) ────────────────────────────────────
  /** Ultra Light or Pro SEM.  Default Pro SEM. */
  mode: AppMode

  // ── AI Max (universal SUPREME principle) ───────────────────────────────────
  /** Offline / Local-Only mode — Tom 2026-06-03: *"I would like to be about to
   *  run my app successfully even when you claudian lock me out. Is there a way
   *  to anable that, maybe with less ai, maybe in settings"*.
   *  When true: ALL AI / Claudian / external-API calls disabled.  Components
   *  fall back to deterministic logic, manual entry, and previously-cached data.
   *  Settings UI flips aiAssistanceLevel to 'off' automatically when this is true. */
  offlineMode: boolean
  /** AI assistance level — Off / Standard / Maximum.  Default Maximum.
   *  Forced to 'off' when offlineMode is true. */
  aiAssistanceLevel: AIAssistanceLevel
  /** Show AI rationale text inline below every AI-derived suggestion. */
  showAIRationales: boolean
  /** When opening Sharp Interview, auto-derive plan-aware suggestions (v2). */
  autoDerivePlanAwareSuggestions: boolean
  /** Number of AI suggestions per Sharp Interview question (3 default; 2 / 3 / 5 / 10). */
  sharpSuggestionCount: 2 | 3 | 5 | 10
  /** Default selection mode for new Sharp Interview questions. */
  defaultSharpSelectionMode: DefaultSharpSelectionMode

  // ── Telemetry (Tom's second explicit setting) ──────────────────────────────
  /** None / Standard / Maximum.  Default None — privacy by default. */
  telemetryLevel: TelemetryLevel
  /** Allow anonymous error reports (separate from telemetry). */
  allowErrorReports: boolean
  /** Share session recordings for debugging (very intrusive — opt-in only). */
  allowSessionRecordings: boolean

  // ── Sharpening Processes (Tom 2026-06-03: "Sharpening Processes (SEM and
  //    EVO separately).  Options 1. Collect Project Data on all Answers,
  //    2. Apply Feedback data to next sharpening (to make it smarter and
  //    more tailored to the Plan and Planner preferences)").
  //
  //    Two contexts (SEM Sharpening = the spec-sharpening stage; Evo
  //    Sharpening = the Sharpen Next Step interview), each with two booleans. */
  /** SEM Sharpening: collect project data on all answers (for later analysis). */
  semSharpeningCollectData: boolean
  /** SEM Sharpening: apply collected feedback to make future sharpening smarter. */
  semSharpeningApplyFeedback: boolean
  /** Evo Sharpening (Sharpen Next Step): collect project data on all answers. */
  evoSharpeningCollectData: boolean
  /** Evo Sharpening (Sharpen Next Step): apply collected feedback to tailor next sharpening. */
  evoSharpeningApplyFeedback: boolean

  // ── Evo defaults ───────────────────────────────────────────────────────────
  /** Default cycle length for new plans. */
  defaultCycleLength: DefaultCycleLength
  /** Default reviewer name stamped on FEED ME! action approvals. */
  defaultReviewerName: string
  /** Default lagging-measurement window in days (after step delivery). */
  defaultLaggingWindowDays: number
  /** Auto-add Sharpen Next Step questions to new steps as they are generated. */
  autoOpenSharpOnNewStep: boolean
  /** Default risk tolerance for Skunkworks ideas (low / medium / high). */
  defaultRiskTolerance: 'low' | 'medium' | 'high'

  // ── Visualization ──────────────────────────────────────────────────────────
  theme: Theme
  density: Density
  animationLevel: AnimationLevel
  /** Font scale — 90 / 100 / 110 / 125 (percent). */
  fontScalePercent: 90 | 100 | 110 | 125
  /** Colour-blindness filter — for users with deuteranopia / protanopia / tritanopia. */
  colorBlindMode: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia'

  // ── Workflow ───────────────────────────────────────────────────────────────
  /** Auto-save frequency in seconds.  0 = manual save only. */
  autoSaveIntervalSeconds: number
  /** Confirm before destructive operations (Start Fresh, Clear All, etc.). */
  confirmBeforeDestructive: boolean
  /** Show toast notifications. */
  showToasts: boolean
  /** Remind me to capture lagging measures (cron-style nudge per FEED ME!). */
  enableLaggingMeasureReminders: boolean

  // ── Export ─────────────────────────────────────────────────────────────────
  defaultExportFormat: ExportFormat
  /** Always include audit trail (Source + Reason) in exports. */
  includeAuditTrailInExports: boolean
  /** Default email sender address (overrides per-export). */
  defaultEmailFrom: string

  // ── Collaboration ──────────────────────────────────────────────────────────
  /** Default plan owner name for new plans. */
  defaultPlanOwner: string
  /** Share plan with Twin (Kai's industrial app) — auto / manual / off. */
  twinShareMode: 'auto' | 'manual' | 'off'

  // ── Diagnostics (Tom power-user mode) ──────────────────────────────────────
  /** Show developer hints in tooltips (e.g., "this calls useEvoPlan composable"). */
  showDevHints: boolean
  /** Log AI-suggestion resolution failures to console (helps debug LLM drift). */
  logAIResolutionFailures: boolean
}

// ── Defaults ─────────────────────────────────────────────────────────────────
// Per Tom 2026-06-03: Default Pro SEM, Maximum AI, telemetry None (privacy
// default), Week cycle length (most common in software teams), Mixed Sharp
// mode (matches the per-question default), Auto theme (respects system).

export const DEFAULT_SETTINGS: Settings = {
  // Mode
  mode: 'pro-sem',

  // AI Max
  offlineMode: false,
  aiAssistanceLevel: 'maximum',
  showAIRationales: true,
  autoDerivePlanAwareSuggestions: true,
  sharpSuggestionCount: 3,
  defaultSharpSelectionMode: 'mixed',

  // Telemetry
  telemetryLevel: 'none',
  allowErrorReports: false,
  allowSessionRecordings: false,

  // Sharpening Processes (Tom 2026-06-03) — defaults ON for both collect +
  // apply, per the AI-Max principle (default to maximum helpfulness; user
  // can opt-out).  These compose with the global aiAssistanceLevel.
  semSharpeningCollectData: true,
  semSharpeningApplyFeedback: true,
  evoSharpeningCollectData: true,
  evoSharpeningApplyFeedback: true,

  // Evo defaults
  defaultCycleLength: 'week',
  defaultReviewerName: 'Tom',
  defaultLaggingWindowDays: 7,
  autoOpenSharpOnNewStep: false,
  defaultRiskTolerance: 'medium',

  // Visualization
  theme: 'auto',
  density: 'comfortable',
  animationLevel: 'full',
  fontScalePercent: 100,
  colorBlindMode: 'none',

  // Workflow
  autoSaveIntervalSeconds: 5,
  confirmBeforeDestructive: true,
  showToasts: true,
  enableLaggingMeasureReminders: true,

  // Export
  defaultExportFormat: 'html',
  includeAuditTrailInExports: true,
  defaultEmailFrom: 'Tom@Gilb.com',

  // Collaboration
  defaultPlanOwner: 'Tom Gilb',
  twinShareMode: 'manual',

  // Diagnostics
  showDevHints: false,
  logAIResolutionFailures: true,
}

// ── Storage key ──────────────────────────────────────────────────────────────

export const SETTINGS_STORAGE_KEY = 'semSettings:v1'

// ── Section metadata for the panel UI ────────────────────────────────────────

export interface SettingsSection {
  id: string
  label: string
  description: string
  /** Tailwind accent class for the section header strip. */
  accent: string
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'mode',         label: 'Mode',                description: 'Ultra Light vs Pro SEM — controls how much of the toolkit is exposed', accent: 'from-violet-500 to-indigo-500' },
  { id: 'ai',           label: 'AI Assistance',       description: 'AI-Max principle (Tom 2026-06-03) — impressive help across every input surface', accent: 'from-fuchsia-500 to-purple-500' },
  { id: 'sharpening',   label: 'Sharpening Processes', description: 'SEM and Evo sharpening: collect project data + apply feedback to next sharpening', accent: 'from-amber-500 to-rose-500' },
  { id: 'telemetry',    label: 'Privacy & Telemetry', description: 'What usage data the app collects.  Default: none.', accent: 'from-slate-500 to-slate-700' },
  { id: 'evo',          label: 'Evo Defaults',        description: 'Defaults applied to new plans, steps, reviews, and measurements', accent: 'from-amber-500 to-orange-500' },
  { id: 'visual',       label: 'Visualization',       description: 'Theme, density, font scale, accessibility', accent: 'from-emerald-500 to-teal-500' },
  { id: 'workflow',     label: 'Workflow',            description: 'Auto-save, confirmations, toasts, reminders', accent: 'from-sky-500 to-blue-500' },
  { id: 'export',       label: 'Export',              description: 'Default format, audit-trail inclusion, email sender', accent: 'from-pink-500 to-rose-500' },
  { id: 'collab',       label: 'Collaboration',       description: 'Plan ownership defaults + Twin sharing', accent: 'from-cyan-500 to-blue-500' },
  { id: 'diagnostics',  label: 'Diagnostics',         description: 'Developer hints, debug logging.  Tom power-user mode.', accent: 'from-slate-500 to-zinc-700' },
]
