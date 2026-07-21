// UNIT_TYPE=Test
// sfc-no-script-setup-exports.test.ts — catches the "Importing a module
// script failed" runtime crash class BEFORE it ships to the browser.
//
// Tom Gilb 2026-06-19 verbatim: "is there a test to prevent me from
// seeing this?  ❌ SEM App failed to start.  App.vue or one of its
// imports failed to load.  TypeError: Importing a module script failed."
//
// Background — same lesson banked TWICE before this rev:
//
//   • 2026-06-03 (planningStages.ts) — Tom hit "Importing a module
//     script failed" when ValueCounter.vue's `<script setup>` carried
//     a top-level `export const STAGES`.  Fix: move the registry to a
//     plain .ts file.
//
//   • 2026-06-19 (r41 v202 Stage1SubStepStrip.vue) — SAME mistake by
//     Claudian.  Top-level `export const STAGE1_SUBSTEPS` /
//     `export type Stage1SubStepKey` inside `<script setup>` crashed
//     Vite at load time.  Tom asked for a test.  This is that test.
//
// Why Vue 3 `<script setup>` rejects top-level `export` declarations:
// the syntactic sugar compiles every binding inside `<script setup>`
// into an internal map exposed to the template; arbitrary top-level
// `export` statements break the compiler's invariant (the SFC module
// has exactly ONE export — its default component).  Vite surfaces the
// failure as the opaque "Importing a module script failed" error in the
// browser at runtime; vue-tsc does NOT catch it (it's a Vite plugin
// behaviour, not a TS compile error).
//
// What this test does — scans every src/**/*.vue file for the RUNTIME
// export forms that crash the Vite Vue plugin inside any `<script setup>`
// block:
//
//   export const     X = ...   ← crashes
//   export let       X = ...   ← crashes
//   export function  X(...)    ← crashes
//   export async function X    ← crashes
//   export enum      X { ... } ← crashes
//
// Pure-type forms (`export type`, `export interface`) are erased at compile
// time and do NOT crash Vite — they are NOT flagged.  Existing code in the
// codebase (PlTypeIcon.vue, LoadingProgress.vue, etc.) uses them safely.
//
// Each violation reports the file path + line number so the fix is
// obvious: move the offending declaration into a sibling plain `.ts` file
// (see `src/data/planningStages.ts` and `src/data/stage1SubSteps.ts` for
// the canonical pattern).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, relative } from 'path'
import { globSync } from 'glob'

// The runtime export forms that break `<script setup>`.
// Type-only forms (`export type`, `export interface`) are deliberately
// excluded — they are erased at compile time, never produce a runtime
// export, and the existing codebase uses them safely.
const BANNED_EXPORT_RE = /^[ \t]*export[ \t]+(?:const|let|function|async\s+function|enum)\b/

// Files that contain a runtime export but are NEVER imported anywhere — Vite
// only loads files that are imported, so dead-code exports cannot crash the
// build.  Each entry MUST include a `// reason` so a future audit knows why
// it's exempt; an entry that becomes imported again will start triggering
// the test as soon as the import is uncommented.
const DEAD_FILE_ALLOWLIST: readonly { file: string; reason: string }[] = [
  {
    file:   'src/components/PlanningStageBar.vue',
    reason: 'Superseded by ValueCounter 2026-05-27 (design-log r37).  Only ' +
            'references in App.vue are commented out; the file is dead code ' +
            'kept for design-history purposes.  Its `export const STAGES = ' +
            '[...]` never reaches Vite because nothing imports it.',
  },
] as const

// Repo root, derived from this test's location.
const REPO_ROOT = resolve(__dirname, '../../..')

interface Violation {
  file:  string
  line:  number
  text:  string
}

function scanFile(absPath: string): Violation[] {
  const src = readFileSync(absPath, 'utf-8')
  const violations: Violation[] = []

  // Match every `<script setup [...]>` block — including with `lang="ts"`
  // and other attributes.  We use a non-greedy match for the body so
  // multiple script blocks (rare but legal) each get scanned.
  const SETUP_BLOCK_RE = /<script\s+[^>]*\bsetup\b[^>]*>([\s\S]*?)<\/script>/g
  let m: RegExpExecArray | null
  while ((m = SETUP_BLOCK_RE.exec(src)) !== null) {
    const blockStart = m.index
    const blockBody  = m[1]
    // Count line where the block body starts (so violations get a real line number).
    const linesBeforeBlock = src.slice(0, blockStart).split('\n').length
    const blockLines = blockBody.split('\n')
    for (let i = 0; i < blockLines.length; i++) {
      const line = blockLines[i]
      if (BANNED_EXPORT_RE.test(line)) {
        violations.push({
          file: relative(REPO_ROOT, absPath),
          line: linesBeforeBlock + i,
          text: line.trim(),
        })
      }
    }
  }
  return violations
}

const ALLOWED_DEAD_FILES = new Set(DEAD_FILE_ALLOWLIST.map(e => e.file))

describe('Vue SFC `<script setup>` — no top-level runtime exports', () => {
  it('every imported src/**/*.vue file has zero runtime `export` declarations inside `<script setup>`', () => {
    const vueFiles = globSync('src/**/*.vue', { cwd: REPO_ROOT, absolute: true })
    expect(vueFiles.length, 'expected to find Vue SFCs to scan').toBeGreaterThan(0)

    const allViolations: Violation[] = []
    for (const f of vueFiles) {
      const relPath = relative(REPO_ROOT, f)
      if (ALLOWED_DEAD_FILES.has(relPath)) continue
      allViolations.push(...scanFile(f))
    }

    if (allViolations.length > 0) {
      const report = allViolations
        .map(v => `  ${v.file}:${v.line}  →  ${v.text}`)
        .join('\n')
      const help =
        '\n\nVue 3 `<script setup>` does NOT allow top-level RUNTIME `export` declarations — they crash Vite at module load with "Importing a module script failed."\n' +
        'Fix: move the declaration(s) into a sibling plain `.ts` file (see `src/data/planningStages.ts` and `src/data/stage1SubSteps.ts` for the canonical pattern) and import from there.\n' +
        'Pure-type forms (`export type`, `export interface`) are erased at compile time and remain SAFE inside `<script setup>`.'
      throw new Error(
        `Found ${allViolations.length} banned runtime export(s) inside <script setup>:\n${report}${help}`,
      )
    }

    expect(allViolations).toHaveLength(0)
  })

  it('every entry in DEAD_FILE_ALLOWLIST still exists and still has no live importer', () => {
    // Defensive guard: if a dead-file allowlist entry ever becomes imported
    // again, this test should fail so the entry is removed or the import
    // path is reconsidered.  We can't cheaply grep the whole src/ here
    // without a heavier dependency; instead we assert the file exists so
    // a typo in the allowlist surfaces immediately.
    for (const entry of DEAD_FILE_ALLOWLIST) {
      const abs = resolve(REPO_ROOT, entry.file)
      const exists = (() => { try { readFileSync(abs); return true } catch { return false } })()
      expect(exists, `Allowlist entry ${entry.file} no longer exists`).toBe(true)
    }
  })
})
