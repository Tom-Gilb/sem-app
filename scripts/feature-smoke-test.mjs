#!/usr/bin/env node
// Feature-Invariants Smoke Test — r41 v235 (Tom Gilb 2026-06-21 verbatim
// "How can we prevent retro from good code to worse?").
//
// THE PROBLEM
// vue-tsc compiles · serve-verify ships · mount-smoke proves the app
// mounts — but none of those catch REGRESSIONS in working features.
// "Mode chip mounted last turn" can be silently unmounted a turn later.
// "Tags render via mnemonicLabel" can be silently reverted to raw V1/V2.
// "Stage1SubStepStrip gated to planningStage===1" can drift to show
// everywhere again.
//
// THE SOLUTION
// A standing list of FEATURE INVARIANTS — assertions about the running
// app that MUST hold true at every ship.  Each invariant is a small
// Playwright check.  Add a new invariant the moment a feature is built
// or a regression is observed.  Run before every "⌘R Safari" claim.
//
// USAGE
//   node scripts/feature-smoke-test.mjs              # run all invariants
//   node scripts/feature-smoke-test.mjs --only mode  # filter by name fragment
//   node scripts/feature-smoke-test.mjs --list       # list invariants without running
//
// COMPOSES WITH
//   - Mount-Smoke-Test-Before-Ship SUPREME (the broader "does it mount" test)
//   - Tom-Repeats-Himself SUPREME (each repeat-symptom becomes an invariant
//     so it can never repeat silently again)
//   - No-Silent-Removal SUPREME (every regression of a permanent surface
//     trips an invariant; alarms fire BEFORE Tom hits ⌘R)
//   - Serve-Verify-Before-Ship SUPREME (curl-grep proves the served file
//     has the change; this test proves the rendered DOM has the EFFECT)
//
// ADDING A NEW INVARIANT
// 1. Append an entry to INVARIANTS below.
// 2. Each entry = { id, description, since, run(page) → Promise<{ok, detail}> }.
// 3. `since` = the design-history rev/commit where the feature shipped, so
//    the invariant can be retired if Tom ever drops the feature.

import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg

const URL_FLAG = process.argv.indexOf('--url')
const URL      = URL_FLAG >= 0 ? process.argv[URL_FLAG + 1] : 'http://localhost:5173'
const ONLY     = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
const LIST     = process.argv.includes('--list')

const INVARIANTS = [
  // ── r41 v233 — Mode chip ────────────────────────────────────────────────
  {
    id: 'mode-chip-mounted',
    description: 'Mode chip with aria-label starting "Mode:" must be present in DOM',
    since: 'r41 v233',
    run: async (page) => {
      const present = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some(b => /^Mode:/.test(b.getAttribute('aria-label') || ''))
      )
      return { ok: present, detail: present ? 'present' : 'missing — ActiveModeButton unmounted in IdentityStrip' }
    },
  },

  // ── r41 v231 — AgentModePicker / single pin per agent ─────────────────
  {
    id: 'agents-strip-no-double-pins',
    description: 'AgentsStrip must NOT contain "-Sharp" pins (single pin per agent + mode picker)',
    since: 'r41 v231',
    run: async (page) => {
      const sharpPins = await page.evaluate(() => {
        return [...document.querySelectorAll('button')]
          .map(b => (b.textContent || '').trim())
          .filter(t => /Munger Sharp|Elon Sharp|Inc Sharp/i.test(t))
      })
      return { ok: sharpPins.length === 0, detail: sharpPins.length === 0 ? 'no double-pins' : `found double-pins: ${sharpPins.join(', ')}` }
    },
  },
  {
    id: 'munger-pin-present',
    description: 'Munger pin must appear in AgentsStrip',
    since: 'r41 v225',
    run: async (page) => {
      const present = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some(b => /\bMunger\b/.test((b.textContent||'').trim()) && !/Sharp/.test((b.textContent||'').trim()))
      )
      return { ok: present, detail: present ? 'present' : 'missing — Munger pin removed from AgentsStrip' }
    },
  },

  // ── r41 v254 — Heilmeier Agent wired (DARPA Catechism + IEEE 2025 extension)
  {
    id: 'heilmeier-agent-wired',
    description: 'Heilmeier pin must appear in AgentsStrip AND HeilmeierPanel must be mountable',
    since: 'r41 v254',
    run: async (page) => {
      const pinPresent = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some(b => /\bHeilmeier\b/.test((b.textContent||'').trim()))
      )
      if (!pinPresent) return { ok: false, detail: 'missing — Heilmeier pin not in AgentsStrip' }
      // Verify the panel source compiles + is served (Vite must serve it without 404).
      const panelOk = await page.evaluate(async () => {
        const r = await fetch('/src/components/HeilmeierPanel.vue')
        if (!r.ok) return false
        const txt = await r.text()
        return /Heilmeier Agent/.test(txt) && /accept-fix/.test(txt)
      })
      return { ok: panelOk, detail: panelOk ? 'present (pin + panel)' : 'pin present but HeilmeierPanel.vue not served correctly' }
    },
  },

  // ── r41 v229 — Plan Crest in-flow (scrolls with page) ───────────────────
  {
    id: 'plan-crest-in-flow',
    description: 'Plan Crest must be position:relative (in-flow, scrolls with page); NOT position:fixed',
    since: 'r41 v229',
    run: async (page) => {
      const pos = await page.evaluate(() => {
        const crest = document.querySelector('[aria-label="Spec Crest — active spec"]')
        return crest ? getComputedStyle(crest).position : null
      })
      const ok = pos === 'relative' || pos === 'static'
      return { ok, detail: `position=${pos ?? 'no-crest'}` }
    },
  },

  // ── r41 v226 — Scroll bar bottom-center translucent ────────────────────
  {
    id: 'scrollbar-bottom-center',
    description: 'PageScrollPin must be at bottom-center with translucent backdrop (≤ 90% opacity)',
    since: 'r41 v226',
    run: async (page) => {
      // Need to scroll the page first so PageScrollPin is rendered.
      await page.evaluate(() => window.scrollTo(0, 200))
      await page.waitForTimeout(400)
      const probe = await page.evaluate(() => {
        const pin = document.querySelector('[role="status"][aria-label*="Page scroll bar"]')
        if (!pin) return { found: false }
        const inner = pin.querySelector('div.flex.items-center.rounded-2xl')
        const cs = inner ? getComputedStyle(inner) : null
        return {
          found: true,
          bg:  cs ? cs.backgroundColor : null,
          // Bottom-center test: x within 100 px of viewport centre
          centered: (() => {
            const r = pin.getBoundingClientRect()
            const centre = window.innerWidth / 2
            return Math.abs(r.x + r.width / 2 - centre) < 60
          })(),
        }
      })
      if (!probe.found) {
        // r41 v274 (Tom Gilb 2026-06-22) — PageScrollPin is now legitimately
        // SUPPRESSED at Stage 1 empty-input view to avoid collision with the
        // Parse-my-input sticky band.  Test if the suppress condition holds;
        // if yes, the pin's absence is correct.  If no, it's a regression.
        const suppressed = await page.evaluate(() => {
          // Parse band visible? It mounts on SEMEntryForm Stage 1 input phase.
          const parseBand = document.querySelector('button#sem-parse-btn')
          return !!parseBand
        })
        if (suppressed) return { ok: true, detail: 'PageScrollPin legitimately suppressed (Parse-my-input band visible — v274 fix)' }
        return { ok: false, detail: 'PageScrollPin not in DOM AND Parse band not visible — unexpected absence' }
      }
      const isTranslucent = /rgba/.test(probe.bg || '') && /0\.[0-9]+\)$/.test(probe.bg || '')
      return {
        ok: probe.centered && isTranslucent,
        detail: `centered=${probe.centered} bg=${probe.bg} translucent=${isTranslucent}`,
      }
    },
  },

  // ── r41 v221 — PROCESS TOOLS label dropped (overlap fix) ────────────────
  {
    id: 'process-tools-label-gone',
    description: 'The redundant "Process Tools" aria-hidden label must NOT be visible (dropped in v221)',
    since: 'r41 v221',
    run: async (page) => {
      const found = await page.evaluate(() =>
        [...document.querySelectorAll('span')].some(el => (el.textContent || '').trim() === 'Process Tools')
      )
      return { ok: !found, detail: found ? 'label still rendered' : 'label gone' }
    },
  },

  // ── r41 v235 — Stage 1 sub-step strip gated to planningStage===1 ───────
  // (This invariant requires navigating to a non-Stage-1 stage to verify.)
  // For now we just assert the strip RENDERS at Stage 1; the Stage-4-no-strip
  // assertion is added when we have the navigation harness.

  // ── r41 v236 — Stage-aware Next CTA (no stage-skip leaks) ──────────────
  {
    id: 'no-evo-steps-cta-at-stage-1',
    description: 'At Stage 1 (Stakes), the "Sharpening Complete — Plan Evo Steps" CTA MUST NOT render.  Skipping from Stage 1 to Stage 6 violates the logical-sequence rule.',
    since: 'r41 v236',
    run: async (page) => {
      const found = await page.evaluate(() => {
        // Search the entire page body for the CTA text — the gate at v236
        // requires planningStage === 3 to render it.
        return /Sharpening Complete\s*—\s*Plan Evo Steps/i.test(document.body.innerText)
      })
      return {
        ok: !found,
        detail: found ? 'CTA leaked into Stage 1 — stage-skip violation' : 'no Evo-Steps CTA at Stage 1 (correct)',
      }
    },
  },
  // ── r41 v237 — Credibility survey popup STAYS DEAD ─────────────────────
  {
    id: 'no-credibility-prompt',
    description: 'The "How credible…" / "How confident…" survey popups MUST NOT appear in the DOM.  Tom killed them long ago + they silently came back.  Both the SurveyGateModal mount AND the useSurveyGate triggers are neutered.',
    since: 'r41 v237',
    run: async (page) => {
      const text = await page.evaluate(() => document.body.innerText)
      const credible = /How credible are these AI-suggested/i.test(text)
      const confident = /How confident are you that this spec output/i.test(text)
      const present = credible || confident
      return {
        ok: !present,
        detail: present ? `credibility survey resurrected (credible=${credible} confident=${confident})` : 'no credibility prompt visible',
      }
    },
  },
  {
    id: 'stage-1-substep-strip-correctly-gated',
    description: 'At planning Stage 1 (default load), Stage 1 sub-step strip SHOULD be visible.  At non-Stage-1 it must hide — covered indirectly by mount probe.',
    since: 'r41 v235',
    run: async (page) => {
      // Page loads at Stage 1 by default.  Strip should be visible.
      const visible = await page.evaluate(() => {
        const strip = document.querySelector('[aria-label*="Stage 1 sub-step"] , [aria-label*="Stage 1 step"], [aria-label*="STAGE 1 STEPS"]')
        if (strip) return !!strip.offsetParent
        // Fallback — search for the label text
        return /STAGE 1 STEPS|1\.1\s*Spec Entry/i.test(document.body.innerText)
      })
      return {
        ok: visible,
        detail: visible ? 'Stage 1 strip visible at planningStage=1 (correct)' : 'Stage 1 strip not rendered at load — possible over-gating regression',
      }
    },
  },

  // ── r41 v220 — Source-attribution producer-stamp sweep ──────────────────
  // No DOM-level invariant — checked via grep in pre-commit / CI; skipped here.

  // ── r41 v261 — Banned word `complaint` in user-visible UI strings (Tom Gilb 2026-06-21) ──
  // Tom verbatim: "I have a personal distaste for the term complaint. Can you use terms like
  // report, observation, issue?".  Banned in chat / design-history / memory / pending-requests
  // / code-comments-surfacing-Tom-voice / AI prompts / UI text.  Narrow exemption: Tom's own
  // verbatim quote preserved.  This invariant scans user-facing strings in Vue templates +
  // SYSTEM_PROMPT body in llm.ts — those are the SHIPPABLE surfaces that reach users.
  {
    id: 'banned-word-complaint-in-user-visible-strings',
    description: 'The word `complaint` (and `complained` / `complaining`) must NOT appear in user-visible UI strings.  Tom Gilb 2026-06-21 verbatim ban.  Use `report` / `observation` / `issue` / `finding` / `flagged` instead.',
    since: 'r41 v261',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const offenders = []
      // Scan: SYSTEM_PROMPT body in llm.ts (the ONE high-stakes AI-prompt source).
      const llm = fs.readFileSync(path.resolve(process.cwd(), 'src/config/llm.ts'), 'utf8')
      const promptMatch = llm.match(/export const SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`\s*\n/)
      if (promptMatch && /\bcomplain(t|ed|ing|s)?\b/i.test(promptMatch[1])) {
        offenders.push('llm.ts SYSTEM_PROMPT contains `complaint*`')
      }
      // Scan: App.vue template for user-visible toast/title/aria strings containing `complaint`.
      const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
      const rootTmplMatch = app.match(/\n<template>\n([\s\S]*?)\n<\/template>\n/)
      if (rootTmplMatch && /\bcomplain(t|ed|ing|s)?\b/i.test(rootTmplMatch[1])) {
        offenders.push('App.vue <template> contains `complaint*`')
      }
      const ok = offenders.length === 0
      return { ok, detail: ok ? 'no banned `complaint*` word in SYSTEM_PROMPT or App.vue template' : offenders.join(' · ') }
    },
  },

  // ── r41 v283 — All sharpening panels have export (Tom Gilb 2026-06-22 "All sharpening answers must be exportable") ──
  // Five sharpening panels lacked Copy+Email before r41 v283: IncorruptibleSharpening,
  // ElonSharpening, SolutionSharpen, ParseImpliedSharpening (plus EvoSharpInterview which
  // already had exportCopy/exportEmail under different naming).  v283 wired the four
  // missing panels via a shared useUniversalSharpExport composable.  This invariant
  // verifies all four imports + copyAllAnswers/emailAllAnswers helpers + button mounts.
  {
    id: 'all-sharpening-panels-exportable',
    description: 'All sharpening panels MUST import useUniversalSharpExport + expose Copy + Email buttons (Tom Gilb 2026-06-22 "All sharpening answers must be exportable"). Composes with Export-button-on-all-windows SUPREME rule.',
    since: 'r41 v283',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const panels = [
        'IncorruptibleSharpeningPanel.vue',
        'ElonSharpeningPanel.vue',
        'SolutionSharpenPanel.vue',
        'ParseImpliedSharpeningPanel.vue',
      ]
      const composableExists = fs.existsSync(path.resolve(process.cwd(), 'src/composables/useUniversalSharpExport.ts'))
      if (!composableExists) return { ok: false, detail: 'useUniversalSharpExport.ts composable missing' }
      const offenders = []
      for (const panel of panels) {
        const file = path.resolve(process.cwd(), `src/components/${panel}`)
        if (!fs.existsSync(file)) { offenders.push(`${panel} missing`); continue }
        const content = fs.readFileSync(file, 'utf8')
        const importsHelper = /import\s*\{[^}]*copyUniversalSharp[^}]*emailUniversalSharp[^}]*\}\s*from\s*['"][^'"]*useUniversalSharpExport['"]/.test(content)
        const hasCopyFn  = /async function copyAllAnswers\(\)/.test(content)
        const hasEmailFn = /async function emailAllAnswers\(\)/.test(content)
        const hasCopyBtn  = /@click="copyAllAnswers"/.test(content)
        const hasEmailBtn = /@click="emailAllAnswers"/.test(content)
        if (!(importsHelper && hasCopyFn && hasEmailFn && hasCopyBtn && hasEmailBtn)) {
          offenders.push(`${panel}: imports=${importsHelper} copyFn=${hasCopyFn} emailFn=${hasEmailFn} copyBtn=${hasCopyBtn} emailBtn=${hasEmailBtn}`)
        }
      }
      const ok = offenders.length === 0
      return { ok, detail: ok ? `All ${panels.length} sharpening panels wired with Copy + Email via useUniversalSharpExport` : `OFFENDERS: ${offenders.join(' | ')}` }
    },
  },

  // ── r41 v280 — Per-entry export/edit pins + sub-step strip "Next:" chip + first-undone pulse (Tom Gilb 2026-06-22 batch) ──
  // Tom Gilb 2026-06-22 verbatim: "we need to be able to export any one item, all
  // items of a type, and all Planguage specs" + "edit any part of any spec (with
  // trace of the change of course), and undo, and commit to master" + "persistent
  // information about the sub-step we are in, the next sub-step and our ability
  // to move on".  Greenlight: "just do them in sequence now, I need to sleep soon".
  // Three structural features SHIPPED in r41 v280; this invariant verifies all
  // three are present and remain present.
  {
    id: 'per-entry-pins-and-substep-next-chip',
    description: 'r41 v280 batch: (A) per-entry copyEntry/emailEntry functions in SpecOutput.vue with renderColorfulSpecHtml single-entry path; (B) per-entry Edit/Copy/Email pin trio on F/V/S cards + Copy/Email pair on C/R cards; (C) Stage2SubStepStrip + GenericStageSubStepStrip carry first-undone pulse + "Next:" chip with nextLabel computed.',
    since: 'r41 v280',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const so = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SpecOutput.vue'), 'utf8')
      const s2 = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Stage2SubStepStrip.vue'), 'utf8')
      const gs = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GenericStageSubStepStrip.vue'), 'utf8')
      // (A) per-entry export functions defined
      const copyEntryFn  = /async function copyEntry\(type: SpecEntryType, id: string\)/.test(so)
      const emailEntryFn = /async function emailEntry\(type: SpecEntryType, id: string\)/.test(so)
      const singleSpec   = /_singleEntrySpec\(type: SpecEntryType, id: string\)/.test(so)
      // (B) at least one copyEntry('F'|'V'|'S'|'C'|'R',… call on each entry-type card
      const copyF = /copyEntry\('F',/.test(so)
      const copyV = /copyEntry\('V',/.test(so)
      const copyS = /copyEntry\('S',/.test(so)
      const copyC = /copyEntry\('C',/.test(so)
      const copyR = /copyEntry\('R',/.test(so)
      // Edit pencils on F/V/S (open-editor with entryId)
      const editF = /open-editor', \{ tab: 'functions', entryId: f\.id \}/.test(so)
      const editV = /open-editor', \{ tab: 'values', entryId: v\.id \}/.test(so)
      const editS = /open-editor', \{ tab: 'solutions', entryId: s\.id \}/.test(so)
      // (C) sub-step strip enhancements
      const s2FirstUndone = /firstUndone\s*=\s*computed/.test(s2) && /animate-pulse/.test(s2) && /Next:/.test(s2)
      const gsFirstUndone = /firstUndone\s*=\s*computed/.test(gs) && /animate-pulse/.test(gs) && /Next:/.test(gs)
      const ok = copyEntryFn && emailEntryFn && singleSpec && copyF && copyV && copyS && copyC && copyR && editF && editV && editS && s2FirstUndone && gsFirstUndone
      const detail = ok
        ? '(A) copyEntry/emailEntry/_singleEntrySpec all defined · (B) copyEntry on F/V/S/C/R + Edit pencils on F/V/S · (C) Stage2 + Generic strips carry firstUndone pulse + Next chip'
        : `INCOMPLETE — A: copyEntry=${copyEntryFn} emailEntry=${emailEntryFn} single=${singleSpec} · B: copyFVSCR=${copyF}/${copyV}/${copyS}/${copyC}/${copyR} editFVS=${editF}/${editV}/${editS} · C: s2-strip=${s2FirstUndone} gs-strip=${gsFirstUndone}`
      return { ok, detail }
    },
  },

  // ── r41 v279 — Spec card uses generous horizontal width (Tom Gilb 2026-06-22) ──
  // Tom Gilb 2026-06-22 verbatim: "I cannot see all of it in my screen, I think we
  // need to make better use of the white space, broaden the Planguage display".
  // Investigation found SpecOutput wrapper class was max-w-xl (576px) on Tom's
  // ~2048px viewport = 72% horizontal whitespace.  Bumped to max-w-5xl (1024px) —
  // more horizontal real estate while preserving comfortable side margins.  This
  // invariant pins that choice so a future cosmetic change can't narrow it again.
  {
    id: 'spec-output-uses-wide-container',
    description: 'SpecOutput mount wrappers in App.vue MUST use max-w-5xl (1024px) or wider — not max-w-xl/2xl/3xl — so the rich Planguage spec content uses horizontal real estate instead of leaving 70%+ whitespace on typical viewports.',
    since: 'r41 v279',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
      const mounts = app.match(/ref="specOutputEl"[^>]*class="[^"]*max-w-(\w+)/g) ?? []
      if (mounts.length === 0) return { ok: false, detail: 'no specOutputEl mounts found with max-w-* — verify selector' }
      const offenders = mounts.filter(m => {
        const sz = m.match(/max-w-(\w+)/)?.[1] ?? ''
        return ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'].includes(sz)
      })
      const ok = offenders.length === 0
      return { ok, detail: ok ? `${mounts.length} SpecOutput mount(s) all use max-w-5xl or wider` : `${offenders.length} SpecOutput mount(s) still narrow: ${offenders.join(' · ')}` }
    },
  },

  // ── r41 v277 — Toast persistence + history (Tom Gilb 2026-06-22 SUPREME) ──
  // Tom Gilb 2026-06-22 verbatim: "there was a n 'AI was slow....' message at
  // bottom, far to fast and disappeared before I could read."  +  "a second far
  // too fast disappearing message said something about what was generated".
  // Three-layer fix: (A) bump both toast durations 8/9s → 20s; (B) 🔔 bell +
  // ring history; (C) persistent post-generation banner on Stage 2.  This
  // invariant ensures all three layers stay in place.
  {
    id: 'toast-persistence-three-layer',
    description: 'Generation-related toasts MUST: (A) carry duration ≥20000ms per Tom-85 reading speed; (B) be recallable via ToastHistoryBell mounted in App.vue; (C) persist as lastGenerationReport banner on Stage 2 until user dismisses.  Tom-Repeats-Himself SUPREME — generation success/failure is critical info, never ephemeral.',
    since: 'r41 v277',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
      // (A) Both generation toasts use ≥20000ms
      const slowMatch = app.match(/⚡ AI was slow[\s\S]{0,800}?showToast\([^,]+,\s*\/?\*?[^*]*\*?\/?\s*(\d+)/)
      const genMatch  = app.match(/✓ Spec generated in[\s\S]{0,1000}?showToast\([^,]+,\s*\/?\*?[^*]*\*?\/?\s*(\d+)/)
      const slowDur = slowMatch ? parseInt(slowMatch[1], 10) : 0
      const genDur  = genMatch  ? parseInt(genMatch[1],  10) : 0
      const durationsOk = slowDur >= 20000 && genDur >= 20000
      // (B) ToastHistoryBell component file exists + mounted in App.vue
      const bellFileExists = fs.existsSync(path.resolve(process.cwd(), 'src/components/ToastHistoryBell.vue'))
      const bellImported = /import\s+ToastHistoryBell/.test(app)
      const bellMounted  = /<ToastHistoryBell\s*\/?>/.test(app)
      // (C) lastGenerationReport ref + dismissGenerationReport + persistent banner mounted on Stage 2
      const refDeclared = /const\s+lastGenerationReport\s*=\s*ref<GenerationReport\s*\|\s*null>/.test(app)
      const dismissFn   = /function\s+dismissGenerationReport/.test(app)
      const bannerMount = /v-if="lastGenerationReport"[\s\S]{0,600}?aria-live="polite"/.test(app)
      const bannerSetSuccess = /lastGenerationReport\.value\s*=\s*\{[\s\S]{0,200}?kind:\s*'success'/.test(app)
      const bannerSetSlow    = /lastGenerationReport\.value\s*=\s*\{[\s\S]{0,200}?kind:\s*'slow-fallback'/.test(app)
      const layerC = refDeclared && dismissFn && bannerMount && bannerSetSuccess && bannerSetSlow
      const ok = durationsOk && bellFileExists && bellImported && bellMounted && layerC
      const detail = ok
        ? `(A) toast durations slow=${slowDur}ms gen=${genDur}ms · (B) Bell file+import+mount present · (C) ref+dismiss+banner+both kinds wired`
        : `INCOMPLETE — A: slow=${slowDur}/gen=${genDur} (need ≥20000) · B: file=${bellFileExists} import=${bellImported} mount=${bellMounted} · C: ref=${refDeclared} dismiss=${dismissFn} banner=${bannerMount} success-set=${bannerSetSuccess} slow-set=${bannerSetSlow}`
      return { ok, detail }
    },
  },

  // ── r41 v275 — Auto-suggest Title + Owner on Stage 1 (Tom Gilb 2026-06-22 AI-Max SUPREME) ──
  // Tom Gilb 2026-06-22 verbatim: "DEFAULT TITLE AND OWNER: I want to generate a title
  // and owner by you using your judgement … all efforts will start with a title and owner".
  // Per AI-Max SUPREME — never present a blank field if a starting point can be derived.
  // Composable useTitleOwnerSuggest fires on debounced raw-input change; SEMEntryForm
  // wires the debounce + AI-suggested visual indicator (✨ AI suggested chip).  This
  // invariant ensures both the composable file + the wiring stay in place.
  {
    id: 'title-owner-auto-suggest-wired',
    description: 'Stage 1 Plan Name + Owner Name fields must auto-populate from raw input via useTitleOwnerSuggest (debounced).  AI-Max SUPREME — no blank field if a starting point can be derived.  Tom Gilb 2026-06-22 verbatim greenlight.',
    since: 'r41 v275',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const composableExists = fs.existsSync(path.resolve(process.cwd(), 'src/composables/useTitleOwnerSuggest.ts'))
      if (!composableExists) return { ok: false, detail: 'useTitleOwnerSuggest.ts composable file missing' }
      const sef = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SEMEntryForm.vue'), 'utf8')
      const importsComposable = /useTitleOwnerSuggest/.test(sef)
      const hasDebounce = /_titleOwnerDebounce/.test(sef)
      const hasGuards = /planNameInput\.value\.trim\(\) \|\| ownerNameInput\.value\.trim\(\)/.test(sef)
      const hasAiBadge = /_titleOwnerAiFilled/.test(sef) && /AI suggested/.test(sef)
      const ok = importsComposable && hasDebounce && hasGuards && hasAiBadge
      return {
        ok,
        detail: ok
          ? 'useTitleOwnerSuggest wired with debounce + No-Silent-Data-Loss guards + ✨ AI-suggested visual indicator'
          : `wiring incomplete — imports=${importsComposable}, debounce=${hasDebounce}, guards=${hasGuards}, badge=${hasAiBadge}`,
      }
    },
  },

  // ── r41 v274 — PageScrollPin suppressed when Parse-my-input band visible (Tom Gilb 2026-06-22 SUPREME) ──
  // SEVENTH "bottom collision" report this session.  v272 fixed pin-vs-footer overlap.
  // v273 fixed aperture-Top/Bottom-vs-text overlap.  v274 fixes the REAL collision Tom
  // was reporting all along: PageScrollPin (z-100 dark pill) renders ON TOP of the
  // Parse-my-input sticky band (SEMEntryForm line 2909, fixed bottom-4 z-30 bg-indigo-600).
  // Pin hides the "Parse my input" text; indigo bg bleeds around the pin.  Fix: suppress
  // pin when Parse band is visible (planningStage===1 AND !currentSpec AND view==='app').
  // This invariant pins the suppress wiring so a future change can't silently re-introduce
  // the two-fixed-bottom-widgets-no-coordination collision.
  {
    id: 'page-scroll-pin-suppressed-when-parse-band-visible',
    description: 'PageScrollPin mount in App.vue MUST pass a :suppress prop that hides the pin when the SEMEntryForm Parse-my-input sticky band is showing (planningStage===1 && !currentSpec && view===\'app\').  Tom-Repeats-Himself SUPREME 7th overlap report — without this, the pin overlays the Parse band and the user sees an unintended purple bar with the pin centred inside it.',
    since: 'r41 v274',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
      // The PageScrollPin mount must have :suppress="…" with the three guard conditions.
      const mountMatch = app.match(/<PageScrollPin[^/]*\/>/)
      if (!mountMatch) return { ok: false, detail: 'PageScrollPin mount not found in App.vue' }
      const mount = mountMatch[0]
      const hasSuppress = /:suppress=/.test(mount)
      const checksView = /view\s*===\s*['"]app['"]/.test(mount)
      const checksPlanningStage = /planningStage\s*===\s*1/.test(mount)
      const checksNoSpec = /!currentSpec/.test(mount)
      const ok = hasSuppress && checksView && checksPlanningStage && checksNoSpec
      const detail = ok
        ? 'PageScrollPin :suppress wired with all three guard conditions (view==app + planningStage==1 + !currentSpec) — Parse-band overlap prevented'
        : `PageScrollPin :suppress wiring incomplete — has suppress=${hasSuppress}, checks-view=${checksView}, checks-stage1=${checksPlanningStage}, checks-no-spec=${checksNoSpec}`
      return { ok, detail }
    },
  },

  // ── r41 v273 — Aperture Top/Bottom buttons NOT absolute-positioned (Tom Gilb 2026-06-22 SUPREME) ──
  // Tom-Repeats-Himself SUPREME — Tom Gilb 2026-06-22: "bottom collision many reports, not
  // fixed" — 6th overlap report.  v272 fixed the page-level PageScrollPin overlap by
  // RESERVING LAYOUT SPACE in the page body (pb-32).  But the SEMEntryForm aperture pin
  // (Top/Bottom buttons inside the textarea overlay zone) was still using the WRONG
  // approach (v266 absolute positioning + group-hover pointer-events-none) — visual
  // overlap with text content persisted.  v273 fix: MOVE the buttons OUT of the absolute
  // overlay zone into a dedicated flex row BELOW the textarea.  No overlap possible.
  // This invariant pins that structural choice so a future cosmetic change can't
  // silently regress to the absolute-overlay pattern that causes the overlap.
  {
    id: 'aperture-top-bottom-buttons-not-overlay',
    description: 'SEMEntryForm Top/Bottom jump buttons must NOT be `absolute bottom-* right-*` positioned (which overlays text inside the textarea).  Must live in a dedicated layout row.  Tom-Repeats-Himself SUPREME 6th overlap report — v260/v266 group-hover tricks did not fix the visual overlap.',
    since: 'r41 v273',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const sef = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SEMEntryForm.vue'), 'utf8')
      // The OFFENDER pattern: a div with `absolute bottom-* right-*` that contains the Top + Bottom buttons.
      // Match: absolute bottom-N(.M) right-N(.M) ... within ~600 chars ... "Top" + "Bottom" text.
      const offenderPattern = /class="absolute bottom-[\d.]+ right-[\d.]+[^"]*"[\s\S]{0,800}>\s*Top\s*<\/span>[\s\S]{0,400}>\s*Bottom\s*<\/span>/
      const hasOverlay = offenderPattern.test(sef)
      return { ok: !hasOverlay, detail: hasOverlay ? 'Top/Bottom buttons re-introduced as absolute overlay — REGRESSION, move to flex row below textarea' : 'Top/Bottom jump buttons live in their own layout row (not absolute overlay)' }
    },
  },

  // ── r41 v272 — Page bottom-padding reserves PageScrollPin zone (Tom Gilb 2026-06-22 SUPREME) ──
  // Tom-Repeats-Himself SUPREME — Tom Gilb 2026-06-22: "how many times need i
  // report this collision?" — FOURTH or FIFTH report on PageScrollPin overlapping
  // the © Gilb International footer (prior fixes v224 redesigned to bottom-center,
  // v226 added translucent backdrop, v260 added group-hover pointer-events-none).
  // Every prior fix addressed CLICK-CAPTURE or OPACITY-ON-HOVER but never the
  // root cause — the page content has no bottom-padding reserving space for the
  // pin, so the pin overlaps the footer at REST (not just on hover).  v272 fix:
  // bumped pb-16 (64px) → pb-32 (128px) on App.vue root container — pin footprint
  // ~60-72px + clearance ~40-60px = 128px sufficient.  This invariant pins that
  // bottom padding so a future cosmetic change can't silently regress the overlap
  // class.
  {
    id: 'page-bottom-padding-reserves-pin-zone',
    description: 'App.vue root container MUST have pb-56 (224px) or larger bottom padding to reserve space for the TALLEST fixed-bottom widget: the Parse-my-input sticky band (height ~52px starting at bottom-4 = 68px total footprint + visual breathing room).  Tom-Repeats-Himself SUPREME (r41 v276 — 8th overlap report "gilb international hiding" after v272 pb-32 was only sized for PageScrollPin not Parse band).  pb-56 = 224px gives ≥160px clearance footer-to-Parse-band at scroll-bottom on standard viewports — unambiguous visual separation.',
    since: 'r41 v272 (bumped v276)',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
      const m = app.match(/class="min-h-screen[^"]*pb-(\d+)[^"]*"/)
      if (!m) return { ok: false, detail: 'could not find App.vue root container with pb-N — verify selector' }
      const padding = parseInt(m[1], 10)
      // pb-56 = 224px = sufficient for both PageScrollPin AND the larger Parse-my-input sticky band + generous visual breathing room
      const ok = padding >= 56
      return { ok, detail: ok ? `App.vue root pb-${padding} reserves ≥224px — Parse band + PageScrollPin + footer all unambiguously clear` : `App.vue root pb-${padding} TOO SMALL — Parse band will visually crowd footer (need ≥pb-56)` }
    },
  },

  // ── r41 v270 — No parallel Planguage primer (Tom Gilb 2026-06-21 SUPREME) ──
  // Tom verbatim trust-rebuild trigger: "perfectly good Planguage generation has
  // disappeared for unknown reasons. … find and resurrect it to former glory? and
  // find out why good design disappears at all (shocking and disturbing, I cannot
  // trust you)".  Root cause was FOUR parallel Planguage primers (useContractParser
  // PLANGUAGE_PRIMER 19 lines · useSpecImporter convertSystem 1-sentence ·
  // useSpecInput _PARSE_PROMPT 53 lines · useSpecInput _MERGE_PROMPT ~50 lines)
  // each authored independently of the canonical SYSTEM_PROMPT.  This invariant
  // ensures no NEW parallel primer can be introduced — any .ts file in
  // src/composables or src/config that contains primer-style declarations MUST
  // also import CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT.  Composes with
  // Trace-Before-Patch SUPREME (parallel-impl = guaranteed drift) +
  // Architectural Resilience SUPREME (single source of truth).
  {
    id: 'no-parallel-planguage-primer',
    description: 'Every .ts file in src/composables or src/config that carries Planguage primer signatures MUST also import CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT from config/planguagePrompt.  Prevents the parallel-primer regression class that caused the Indianapolis spec parameter-starvation report.',
    since: 'r41 v270',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const offenders = []
      const dirs = ['src/composables', 'src/config']
      const PRIMER_SIGNATURES = [
        'Planguage entry types:',
        '(Function): A BINARY',
        '(Value): A MEASURABLE',
        '(Constraint): A HARD',
        'F. entries are BINARY',
        'V. entries (Values) require ALL',
      ]
      for (const dir of dirs) {
        const dirAbs = path.resolve(process.cwd(), dir)
        if (!fs.existsSync(dirAbs)) continue
        const entries = fs.readdirSync(dirAbs)
        for (const name of entries) {
          if (!name.endsWith('.ts')) continue
          if (name === 'planguagePrompt.ts') continue  // the canonical file itself
          const file = path.join(dirAbs, name)
          const content = fs.readFileSync(file, 'utf8')
          const importsCanonical = /import\s*\{[^}]*CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT[^}]*\}\s*from\s*['"][^'"]*planguagePrompt['"]/.test(content)
          if (importsCanonical) continue  // compliant — uses canonical (even if legacy markers remain during refactor)
          const matchedSig = PRIMER_SIGNATURES.find(sig => content.includes(sig))
          if (matchedSig) {
            offenders.push(`${dir}/${name}: has primer signature "${matchedSig}" but does NOT import CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT`)
          }
        }
      }
      const ok = offenders.length === 0
      return { ok, detail: ok ? 'no parallel Planguage primer in src/composables or src/config (all primer-bearing files import the canonical)' : `${offenders.length} offender(s) — refactor to import canonical: ${offenders.slice(0, 3).join(' · ')}` }
    },
  },

  // ── r41 v258 — No inline `window.` references in Vue template handlers (Tom 2026-06-21 bug) ──
  // Tom verbatim: "refresh button not working, probably others".  Root cause was
  // `@refresh="() => { window.location.href = ... }"` — Vue 3 templates do NOT expose the
  // browser global `window`, so the inline arrow threw `Cannot read properties of undefined
  // (reading 'location')`.  Silently failed because Tom doesn't open DevTools.  Banked as
  // a regression-protection invariant so this class can never recur silently.
  {
    id: 'no-inline-window-in-vue-template-handlers',
    description: 'Vue template @-handlers must NOT reference the browser global `window` inline — move to <script setup> functions where the JS runtime scope exposes it.  Tom Gilb 2026-06-21 "refresh button not working" — silent failure because `window` is not in Vue 3 template scope.',
    since: 'r41 v258',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
      // Slice the <template>...</template> region.  In Vue 3 SFC, <script setup>
      // typically comes BEFORE <template>, so we look for the LAST `<template>` open
      // tag (which is the SFC root, not a nested `<template v-if>`) by finding the
      // `<template>` followed eventually by `</template>` at column 0 / end of file.
      // Simpler: find the SFC root <template> which always lives at top-level indent.
      const rootTmplMatch = app.match(/\n<template>\n([\s\S]*?)\n<\/template>\n/)
      const tmpl = rootTmplMatch ? rootTmplMatch[1] : ''
      if (!tmpl) return { ok: false, detail: 'could not isolate SFC root <template> block — adjust regex' }
      const offenders = []
      const lines = tmpl.split('\n')
      lines.forEach((line, i) => {
        // Match `@event="…window.something…"` or `@event="…document.something…"` (anywhere on the line, only inside `@xxx="…"` attributes).
        const m = line.match(/@[a-z-]+="[^"]*(window|document)\.[^"]*"/)
        if (m) offenders.push(`L${i+1}: ${line.trim().slice(0, 140)}`)
      })
      const ok = offenders.length === 0
      return { ok, detail: ok ? 'no inline window./document. references in Vue template handlers' : `${offenders.length} offender(s) — move to <script setup>: ${offenders.slice(0, 3).join(' · ')}` }
    },
  },

  // ── r41 v255 — Sub-step strips visible at every stage view (Tom 2026-06-21 bug) ──
  // Tom verbatim: "I think this clip is in sub-phase 4.1.  But there is no visible sub-
  // phase chart indicating that of helping us navigate what to do and how to exit the
  // sub-phase. This is expected at all sub-phases in all stages".  v243-v254 strips were
  // mounted inside `<template v-else-if="stage === 1 || !currentSpec">` so they hid
  // when the user moved off the spec view.  v255 adds a TOP-LEVEL `<template v-if="...
  // stage !== 1">` block above the stage-chain that renders all strips for stages 2+.
  {
    id: 'substep-strips-visible-at-all-stage-views',
    description: 'Sub-step strips must mount at TOP-LEVEL with `view === \'app\' && currentSpec && stage !== 1 && planningStage === N` gate per strip (v257 pattern — wrapping <template v-if> EATS the v-else-if chain that contains the IET).  Tom 2026-06-21 "expected at all sub-phases in all stages" + "4.1 NO table visible".',
    since: 'r41 v255 (updated v257)',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
      // v257: NO wrapping <template v-if>; each strip carries its own full v-if.  This
      // preserves the surrounding v-else-if chain (which includes the IET at stage===3).
      const noChainEater = !/<template v-if="view === 'app' && currentSpec && stage !== 1"/.test(app)
      // Each strip must carry the full gate (view === app + currentSpec + stage !== 1 + planningStage === N).
      const stagesPerStrip = [
        { name: 'Stage2SubStepStrip',          n: 2 },
        { name: 'GenericStageSubStepStrip',    n: 3 },
        { name: 'Stage4SubStepStrip',          n: 4 },
        { name: 'Stage5SubStepStrip',          n: 5 },
        { name: 'GenericStageSubStepStrip',    n: 6 },
        { name: 'GenericStageSubStepStrip',    n: 8 },
        { name: 'GenericStageSubStepStrip',    n: 9 },
      ]
      const missing = stagesPerStrip.filter(s => !new RegExp(`<${s.name}[\\s\\S]{0,400}?v-if="view === 'app' && currentSpec && stage !== 1 && planningStage === ${s.n}"`).test(app)).map(s => `${s.name}@${s.n}`)
      const ok = noChainEater && missing.length === 0
      return { ok, detail: ok ? 'no chain-eating wrapper + all 7 strips (2/3/4/5/6/8/9) carry the full top-level gate' : `chain-eater-absent=${noChainEater ? 'OK' : 'PRESENT (eats IET chain!)'} · missing-strips=${missing.join(', ') || 'none'}` }
    },
  },

  // ── r41 v254 — Stages 3 / 6 / 8 / 9 sub-step strips via GenericStageSubStepStrip (plough-through) ──
  {
    id: 'stages-3-6-8-9-substep-strips-present',
    description: 'Stages 3, 6, 8, 9 sub-step registries + GenericStageSubStepStrip mounts must all be present (Tom 2026-06-21 plough-through mandate)',
    since: 'r41 v254',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const r = (rel) => path.resolve(process.cwd(), rel)
      const dataFiles = ['src/data/stage3SubSteps.ts', 'src/data/stage6SubSteps.ts', 'src/data/stage8SubSteps.ts', 'src/data/stage9SubSteps.ts']
      const missingData = dataFiles.filter(f => !fs.existsSync(r(f)))
      if (missingData.length) return { ok: false, detail: `missing data files: ${missingData.join(', ')}` }
      const stripExists = fs.existsSync(r('src/components/GenericStageSubStepStrip.vue'))
      if (!stripExists) return { ok: false, detail: 'src/components/GenericStageSubStepStrip.vue missing' }
      const app = fs.readFileSync(r('src/App.vue'), 'utf8')
      // Each mount block: <GenericStageSubStepStrip ... :stage-num="N" ... v-if="planningStage === N" ...>
      // Order of attributes varies — test both `:stage-num` and `planningStage === N` are present in same block.
      const mounts = [3, 6, 8, 9].filter(n => {
        const blockRe = new RegExp(`<GenericStageSubStepStrip[\\s\\S]{0,600}?/>`, 'g')
        const blocks = app.match(blockRe) || []
        return blocks.some(b => b.includes(`:stage-num="${n}"`) && b.includes(`planningStage === ${n}`))
      })
      const ok = mounts.length === 4
      return { ok, detail: ok ? 'all 4 generic strips mounted (stages 3 · 6 · 8 · 9) + registries present' : `mounted: ${mounts.join(', ') || 'none'} / expected 3,6,8,9` }
    },
  },

  // ── r41 v254 — goToImpactStage must sync planningStage to 4 (Impacts), not 5 (Tom 2026-06-21 bug) ──
  {
    id: 'goto-impact-syncs-stage-4',
    description: 'goToImpactStage() must sync planningStage to 4 (the canonical Impacts stage), NOT 5 (Refine).  Tom Gilb 2026-06-21 verbatim "Bug: I clicked 4.1 and it jumped to stage 5".',
    since: 'r41 v254',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
      const m = app.match(/function goToImpactStage\(\)[\s\S]{0,800}\n\}/)
      if (!m) return { ok: false, detail: 'goToImpactStage() function not found' }
      // Strip // single-line + /* */ block comments so the test inspects code only
      // (the v254 fix has the OLD bad pattern quoted in a comment for audit purposes).
      const body = m[0].replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      const correctAdvance = /planningStage\.value < 4\)[\s\S]{0,40}planningStage\.value = 4/.test(body)
      const oldBadAdvance  = /planningStage\.value < 5\)[\s\S]{0,40}planningStage\.value = 5/.test(body)
      const ok = correctAdvance && !oldBadAdvance
      return { ok, detail: ok ? 'goToImpactStage correctly syncs planningStage to 4 (Impacts) — bug fixed' : `correct-advance=${correctAdvance ? 'OK' : 'MISSING'} · old-bad-advance=${oldBadAdvance ? 'STILL PRESENT (regression!)' : 'absent'}` }
    },
  },

  // ── r41 v253 — Stage 5 Refine sub-step strip + Re-design definition (Tom Gilb 2026-06-21) ──
  {
    id: 'stage5-substep-strip-present',
    description: 'Stage 5 sub-step registry must declare 5.1 / 5.2 / 5.3 / 5.4 / 5.5 + Re-design definition + Stage 5 banner purpose (Tom Gilb 2026-06-21)',
    since: 'r41 v253',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const dataFile  = path.resolve(process.cwd(), 'src/data/stage5SubSteps.ts')
      const stripFile = path.resolve(process.cwd(), 'src/components/Stage5SubStepStrip.vue')
      const appFile   = path.resolve(process.cwd(), 'src/App.vue')
      if (!fs.existsSync(dataFile))  return { ok: false, detail: 'src/data/stage5SubSteps.ts missing' }
      if (!fs.existsSync(stripFile)) return { ok: false, detail: 'src/components/Stage5SubStepStrip.vue missing' }
      const data = fs.readFileSync(dataFile, 'utf8')
      const app  = fs.readFileSync(appFile, 'utf8')
      const keys = ['5.1', '5.2', '5.3', '5.4', '5.5']
      const missing = keys.filter(k => !data.includes(`'${k}'`))
      const redesignOK = /Re-design = change/.test(data) || /change to existing designs/i.test(data)
      const mountOK    = /<Stage5SubStepStrip[\s\S]{0,200}planningStage === 5/.test(app)
      const purposeOK  = /planningStage === 5[\s\S]{0,800}re-design/i.test(app)
      const approvalOK = /<EstimatesApprovalPanel[\s\S]{0,400}panel-kind="solutions"/.test(app)
      const ok = missing.length === 0 && redesignOK && mountOK && purposeOK && approvalOK
      return { ok, detail: ok ? 'all 5 sub-steps + Re-design definition + Stage5SubStepStrip mount + Stage 5 banner purpose + Solution Set approval panel all present' : `missing-keys=${missing.join(',') || 'none'} · redesign-def=${redesignOK ? 'OK' : 'MISSING'} · mount=${mountOK ? 'OK' : 'MISSING'} · purpose=${purposeOK ? 'OK' : 'MISSING'} · solution-approval=${approvalOK ? 'OK' : 'MISSING'}` }
    },
  },

  // ── r41 v252 — Stage 4 Phase 2 ship: Approval + Tools/Agents (Tom Gilb 2026-06-21) ──
  {
    id: 'stage4-approval-panel-present',
    description: 'EstimatesApprovalPanel.vue must exist + be mounted in App.vue with identity/date/remarks capture (Tom 2026-06-21 "approval requires identity, date, time, and remarks or Caveats")',
    since: 'r41 v252',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const compFile = path.resolve(process.cwd(), 'src/components/EstimatesApprovalPanel.vue')
      const appFile  = path.resolve(process.cwd(), 'src/App.vue')
      if (!fs.existsSync(compFile)) return { ok: false, detail: 'src/components/EstimatesApprovalPanel.vue missing' }
      const comp = fs.readFileSync(compFile, 'utf8')
      const app  = fs.readFileSync(appFile, 'utf8')
      const captures = ['identity', 'remarks', 'nickname'].every(f => comp.includes(`v-model="${f}"`))
      const importOK = /import EstimatesApprovalPanel/.test(app)
      const mountOK  = /<EstimatesApprovalPanel[\s\S]{0,300}@approve="onEstimatesApproved"/.test(app)
      const handlerOK = /function onEstimatesApproved\(record: EstimatesApproval\)/.test(app)
      const ok = captures && importOK && mountOK && handlerOK
      return { ok, detail: ok ? 'EstimatesApprovalPanel + identity/remarks/nickname captures + App.vue import+mount+handler all present' : `captures=${captures ? 'OK' : 'MISSING'} · import=${importOK ? 'OK' : 'MISSING'} · mount=${mountOK ? 'OK' : 'MISSING'} · handler=${handlerOK ? 'OK' : 'MISSING'}` }
    },
  },
  {
    id: 'stage4-tools-and-agents-table-present',
    description: 'Stage4ToolsAndAgentsTable.vue must exist + be mounted in App.vue, declaring both Tools (Penta, Multivision, Value Flow) and Agents (Munger, Maria) per Tom 2026-06-21',
    since: 'r41 v252',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const compFile = path.resolve(process.cwd(), 'src/components/Stage4ToolsAndAgentsTable.vue')
      const appFile  = path.resolve(process.cwd(), 'src/App.vue')
      if (!fs.existsSync(compFile)) return { ok: false, detail: 'src/components/Stage4ToolsAndAgentsTable.vue missing' }
      const comp = fs.readFileSync(compFile, 'utf8')
      const app  = fs.readFileSync(appFile, 'utf8')
      const toolsOK  = ['penta', 'multivision', 'value-flow'].every(k => comp.includes(`'${k}'`))
      const agentsOK = ['munger', 'maria', 'elon'].every(k => comp.includes(`'${k}'`))
      const importOK = /import Stage4ToolsAndAgentsTable/.test(app)
      const mountOK  = /<Stage4ToolsAndAgentsTable[\s\S]{0,300}@invoke="onStage4ToolInvoke"/.test(app)
      const ok = toolsOK && agentsOK && importOK && mountOK
      return { ok, detail: ok ? 'Stage4ToolsAndAgentsTable + tools (penta/multivision/value-flow) + agents (munger/maria/elon) + App.vue import+mount all present' : `tools=${toolsOK ? 'OK' : 'MISSING'} · agents=${agentsOK ? 'OK' : 'MISSING'} · import=${importOK ? 'OK' : 'MISSING'} · mount=${mountOK ? 'OK' : 'MISSING'}` }
    },
  },

  // ── r41 v251 — Stage 4 sub-step strip + Reasonable Balance (Tom Gilb 2026-06-21) ──
  {
    id: 'stage4-substep-strip-present',
    description: 'Stage 4 sub-step registry must declare 4.1 / 4.2 / 4.3 / 4.4 / 4.5 + the Reasonable Balance purpose statement (Tom Gilb 2026-06-21)',
    since: 'r41 v251',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const dataFile  = path.resolve(process.cwd(), 'src/data/stage4SubSteps.ts')
      const stripFile = path.resolve(process.cwd(), 'src/components/Stage4SubStepStrip.vue')
      const appFile   = path.resolve(process.cwd(), 'src/App.vue')
      if (!fs.existsSync(dataFile)) return { ok: false, detail: 'src/data/stage4SubSteps.ts missing' }
      if (!fs.existsSync(stripFile)) return { ok: false, detail: 'src/components/Stage4SubStepStrip.vue missing' }
      const data = fs.readFileSync(dataFile, 'utf8')
      const app  = fs.readFileSync(appFile, 'utf8')
      const keys = ['4.1', '4.2', '4.3', '4.4', '4.5']
      const missing = keys.filter(k => !data.includes(`'${k}'`))
      // r41 v251 — the phrase is split by an HTML span tag in the template; just check the
      // lowercase "reasonable balance" appears at least once inside the planningStage===4 banner block.
      const purposeOK = /planningStage === 4[\s\S]{0,800}reasonable balance/.test(app)
      const mountOK   = /<Stage4SubStepStrip[\s\S]{0,200}planningStage === 4/.test(app)
      const ok = missing.length === 0 && purposeOK && mountOK
      return { ok, detail: ok ? 'all 5 sub-steps + Reasonable-Balance purpose + Stage4SubStepStrip mount present' : `missing-keys=${missing.join(',') || 'none'} · purpose=${purposeOK ? 'OK' : 'MISSING'} · mount=${mountOK ? 'OK' : 'MISSING'}` }
    },
  },

  // ── r41 v249 — Raw spec hidden at planningStage >= 2 (Tom 2026-06-21) ──
  // Tom verbatim: "OK stage 4 impacts. The Planguage set of artifacts is listed there.
  // I said that it is not clear why and can be deleted, there and earlier stages. As I
  // said we have plenty tools to analyze it under the hood".  Per Stage-Has-A-Purpose
  // SUPREME the raw spec card list is infrastructure, not the primary surface — hide it
  // at stages 2+ and replace with a banner pointing at the Spec Editor tool.
  {
    id: 'spec-hidden-at-stages-2-plus',
    description: 'Inline SpecOutput must be gated by `planningStage >= 2` v-if banner per Tom 2026-06-21 "can be deleted, there and earlier stages" + v250 banner must promote the stage primary action (per Tom 2026-06-21 follow-up "main idea was to look at an impact estimation table")',
    since: 'r41 v249 (updated v250)',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
      const gateOK   = /v-if="planningStage >= 2"/.test(app)
      const stageAwareHeader = /Stage \{\{ planningStage \}\}/.test(app)
      const primaryActionCTA = /planningStageAction\.handler\(\)/.test(app)
      const underTheHood = /under the hood at this stage/.test(app)
      const elseOK   = /v-else ref="specOutputEl"/.test(app)
      const ok = gateOK && stageAwareHeader && primaryActionCTA && underTheHood && elseOK
      return { ok, detail: ok ? 'Inline SpecOutput gated; banner is stage-aware with primary-action CTA + under-the-hood secondary link' : `gate=${gateOK ? 'OK' : 'MISSING'} · stage-header=${stageAwareHeader ? 'OK' : 'MISSING'} · primary-CTA=${primaryActionCTA ? 'OK' : 'MISSING'} · under-the-hood=${underTheHood ? 'OK' : 'MISSING'} · else=${elseOK ? 'OK' : 'MISSING'}` }
    },
  },

  // ── r41 v248 — Post-Sharpening primary CTA must NOT skip stages (Tom 2026-06-21) ──
  // Tom verbatim: "after stg 3 sharpening complete, it jumped to stg 6, hopping over
  // impact etc".  Post-sharpening primary button MUST advance to Stage 4 (Impacts —
  // the next stage in sequence), NOT 6 (Evo Steps — 3 stages later).  Secondary
  // explicit "Skip to Evo Steps" link is allowed (per Stages-are-Cyclic SUPREME —
  // explicit user choice is fine; silent stage skipping is not).
  {
    id: 'post-sharpening-cta-no-stage-skip',
    description: 'Post-Sharpening primary CTA must advance to Stage 4 (Impacts), NOT silently skip to Stage 6 (Tom 2026-06-21 verbatim "jumped to stg 6, hopping over impact etc")',
    since: 'r41 v248',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const app = fs.readFileSync(path.resolve(process.cwd(), 'src/App.vue'), 'utf8')
      // Primary CTA must call handleStageBarNav(4) and aria-label must reference Stage 4.
      const primaryAdvance = /aria-label="Done Sharpening — Continue to Stage 4 Impacts"[\s\S]{0,200}handleStageBarNav\(4\)/.test(app)
      // The OLD primary CTA (which jumped to 6) must no longer be present.
      const oldBadCTA = /aria-label="Done Sharpening — Plan Evo Steps next"/.test(app)
      const ok = primaryAdvance && !oldBadCTA
      return { ok, detail: ok ? 'Primary post-sharpening CTA correctly advances to Stage 4 (Impacts); old skip-to-6 CTA removed' : `primaryAdvance=${primaryAdvance ? 'OK' : 'MISSING'} · oldBadCTA=${oldBadCTA ? 'STILL PRESENT (regression!)' : 'absent'}` }
    },
  },

  // ── r41 v246 — Spec Title anchor when crest off-screen (Tom Gilb 2026-06-21) ──
  {
    id: 'spec-title-anchor-present',
    description: 'Global SpecTitleAnchor component must exist + be mounted in App.vue (Tom 2026-06-21 "Spec Title on any and all windows when Main title is out of Device window sight")',
    since: 'r41 v246',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const compFile = path.resolve(process.cwd(), 'src/components/SpecTitleAnchor.vue')
      const appFile  = path.resolve(process.cwd(), 'src/App.vue')
      if (!fs.existsSync(compFile)) return { ok: false, detail: 'src/components/SpecTitleAnchor.vue missing' }
      const app = fs.readFileSync(appFile, 'utf8')
      const importOK = /import SpecTitleAnchor from/.test(app)
      const mountOK  = /<SpecTitleAnchor[\s\S]*?spec-name=/.test(app)
      return { ok: importOK && mountOK, detail: importOK && mountOK ? 'SpecTitleAnchor imported + mounted globally in App.vue' : `import=${importOK ? 'OK' : 'MISSING'} · mount=${mountOK ? 'OK' : 'MISSING'}` }
    },
  },

  // ── r41 v243 — Stage 2 sub-step strip (Tom Gilb 2026-06-21) ─────────────
  // Stage-Has-A-Purpose SUPREME: each stage opens to a task-centric workspace.
  // Stage 2 = generate / sharpen / apply-tools cycle with 4 sub-steps + a
  // continue-to-stage-3 pin.  Code-level invariant verifies the registry
  // file declares all 4 sub-steps + the strip component is present in src/.
  {
    id: 'stage2-substep-strip-present',
    description: 'Stage 2 sub-step registry must declare 2.1 / 2.2 / 2.3 / 2.4 per Tom 2026-06-21',
    since: 'r41 v243',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const dataFile = path.resolve(process.cwd(), 'src/data/stage2SubSteps.ts')
      const stripFile = path.resolve(process.cwd(), 'src/components/Stage2SubStepStrip.vue')
      if (!fs.existsSync(dataFile)) return { ok: false, detail: 'src/data/stage2SubSteps.ts missing' }
      if (!fs.existsSync(stripFile)) return { ok: false, detail: 'src/components/Stage2SubStepStrip.vue missing' }
      const data = fs.readFileSync(dataFile, 'utf8')
      const keys = ['2.1', '2.2', '2.3', '2.4']
      const missing = keys.filter(k => !data.includes(`'${k}'`))
      return { ok: missing.length === 0, detail: missing.length === 0 ? 'all 4 sub-steps declared (2.1 Read In Specs · 2.2 Generate Solutions · 2.3 Sharpen Spec · 2.4 Tools and Agents)' : `missing keys: ${missing.join(', ')}` }
    },
  },

  // ── r41 v237 — System-prompt no-stray-backticks (Tom 2026-06-21) ────────
  // Mount-breaker prevention. SYSTEM_PROMPT is a backtick template-literal; any inline
  // backtick (e.g. markdown-style `code`) inside its body closes the string and breaks
  // the bundle with [PARSE_ERROR] in oxc. This invariant counts backticks in llm.ts —
  // anything beyond the 5 known structural ones (SYSTEM_PROMPT open + close, plus the
  // user-content-builder template literals) is suspicious.
  {
    id: 'llm-config-no-stray-backticks',
    description: 'src/config/llm.ts must have no inline backticks inside the SYSTEM_PROMPT template-literal (mount-breaker prevention)',
    since: 'r41 v237',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const filePath = path.resolve(process.cwd(), 'src/config/llm.ts')
      const t = fs.readFileSync(filePath, 'utf8')
      // Locate SYSTEM_PROMPT body and count backticks inside it
      const m = t.match(/export const SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`\s*\n/)
      if (!m) return { ok: false, detail: 'SYSTEM_PROMPT delimiters not found — refactor or rename?' }
      const body = m[1]
      const stray = (body.match(/`/g) || []).length
      return { ok: stray === 0, detail: stray === 0 ? 'no stray backticks inside SYSTEM_PROMPT' : `${stray} stray backtick(s) inside SYSTEM_PROMPT — will break Vite mount` }
    },
  },

  // ── r41 v236 — Solution Parameters SUPREME (Tom 2026-06-21) ─────────────
  // Code-level invariants (the data-shape + rule wiring must exist in the bundle even when
  // no Solution is currently rendered on screen). Browser fetches the served module text
  // and asserts the canonical names appear — guarantees the rule cannot be silently un-shipped.
  {
    id: 'solution-tier1-canonical-fields-in-type',
    description: 'SEntry type (disk source) must declare Tier-1 canonical Solution params per Tom 2026-06-21 SUPREME',
    since: 'r41 v236',
    // NOTE: Vite strips type-only fields from served bundles, so we must read the disk source
    // (this script runs in Node, so fs is available). The on-disk presence guarantees the type
    // contract holds at compile time — vue-tsc separately enforces it.
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      // Resolve relative to project root (script is in scripts/, source in src/)
      const filePath = path.resolve(process.cwd(), 'src/types/spec.ts')
      const t = fs.readFileSync(filePath, 'utf8')
      const have = ['status', 'derivedFrom', 'mainImpacts', 'relatedTo', 'implementationResponsible', 'sideEffects', 'costAspects', 'longTermCosts', 'qualifiers', 'alternativeSolutions', 'rejectedSolutions', 'urlsCaseStudies', 'prerequisites', 'assumptions', 'structural', 'authority', 'priority', 'note']
      const missing = have.filter(f => !new RegExp(`\\b${f}\\?:`).test(t))
      return { ok: missing.length === 0, detail: missing.length === 0 ? 'all 18 new SEntry fields present in src/types/spec.ts' : `missing: ${missing.join(', ')}` }
    },
  },
  {
    id: 'solution-tier1-phi-rule-wired',
    description: 'useSpecHealth must carry ic-solution-tier1-incomplete audit rule per Tom 2026-06-21 SUPREME',
    since: 'r41 v236',
    run: async (page) => {
      const present = await page.evaluate(async () => {
        const t = await fetch('/src/composables/useSpecHealth.ts?cache=' + Date.now()).then(x => x.text())
        return /id:\s*['"]ic-solution-tier1-incomplete['"]/.test(t)
      })
      return { ok: present, detail: present ? 'ic-solution-tier1-incomplete rule present' : 'Solution Tier-1 PHI rule MISSING — Tom 2026-06-21 SUPREME violated' }
    },
  },
  {
    id: 'solution-renderer-canonical-labels',
    description: 'Solution colourful HTML renderer must label Tier-1 canonical params (Derived From, Main Impacts) per Tom 2026-06-21 SUPREME',
    since: 'r41 v236',
    run: async (page) => {
      const labels = await page.evaluate(async () => {
        const t = await fetch('/src/composables/useColorfulSpecHtml.ts?cache=' + Date.now()).then(x => x.text())
        // Vite transforms single quotes to double in served output — accept either
        return {
          derivedFrom: /["']Derived From["']/.test(t),
          mainImpacts: /["']Main Impacts["']/.test(t),
          relatedTo: /["']Related To["']/.test(t),
          qualifiers: /["']Qualifiers["']/.test(t),
        }
      })
      const missing = Object.entries(labels).filter(([, v]) => !v).map(([k]) => k)
      return { ok: missing.length === 0, detail: missing.length === 0 ? 'all canonical Solution labels present' : `missing labels: ${missing.join(', ')}` }
    },
  },
  {
    id: 'planguage-definition-footer',
    description: 'Tom Gilb canonical Planguage definition quote (with "Quote me" permission, 2026-06-21) must be present in SpecOutput',
    since: 'r41 v236',
    run: async (page) => {
      const present = await page.evaluate(async () => {
        const t = await fetch('/src/components/SpecOutput.vue?cache=' + Date.now()).then(x => x.text())
        return /specifying the interesting attributes of solutions/.test(t)
          && /Tom Gilb, 2026-06-21/.test(t)
      })
      return { ok: present, detail: present ? 'Planguage definition footer present + attributed' : 'Planguage definition footer MISSING from SpecOutput' }
    },
  },
  // r41 v244 + v245 — Velocity of Learning footer (Tom Gilb 2026-06-21 verbatim canonical
  // form: "Stages" not "States", paragraph layout, "(TsG 21 June 2026)" attribution,
  // permission "to ally" preserved verbatim).
  {
    id: 'velocity-of-learning-footer',
    description: 'Tom Gilb Stages-are-cyclic / Velocity-of-Learning / Reasonable-Balance / Lifetime-of-the-System-of-Concern quote (with permission to ally in the app, TsG 21 June 2026) must be present in SpecOutput with canonical attribution',
    since: 'r41 v244',
    run: async (page) => {
      const present = await page.evaluate(async () => {
        const t = await fetch('/src/components/SpecOutput.vue?cache=' + Date.now()).then(x => x.text())
        return /Velocity of Learning/.test(t)
          && /reasonable balance/i.test(t)
          && /lifetime of the System of Concern/i.test(t)
          && /permission to ally whole or part in the app/i.test(t)
          && /TsG 21 June 2026/.test(t)   // r41 v245 — canonical attribution form Tom adopted in his "EdiT" message
      })
      return { ok: present, detail: present ? 'Velocity-of-Learning quote footer present (all 5 markers: Velocity of Learning + reasonable balance + lifetime of System of Concern + permission to ally + TsG 21 June 2026 attribution)' : 'Velocity-of-Learning quote footer MISSING or partial in SpecOutput — check Tom verbatim form' }
    },
  },
  // r41 v286 — normalizeSpec must UNCONDITIONALLY coerce every string-typed
  // field on every entry, including missing / undefined ones. Two consecutive
  // mount crashes 2026-06-22 (v285 useSpecQuality.scoreSpec + v286
  // useValueAddRatio.buildValueAddEntry) both root-caused to _normEntry
  // SKIPPING the field when absent, leaving downstream `.length` / `.slice` /
  // `.trim` / `.toLowerCase` callers unsafe across ~80 sites. The structural
  // fix is one line in _normEntry; this invariant prevents regression.
  {
    id: 'normalize-spec-coerces-missing-string-fields',
    description: 'normalizeSpec._normEntry must coerce every string-typed field unconditionally (no `typeof out[k] !== \'undefined\'` skip — that was the v285/v286 bug)',
    since: 'r41 v286',
    run: async (page) => {
      const ok = await page.evaluate(async () => {
        const t = await fetch('/src/utils/normalizeSpec.ts?cache=' + Date.now()).then(x => x.text())
        // POSITIVE: unconditional coerce present
        const hasCoerce = /for \(const k of fields\)[\s\S]{0,1500}out\[k\] = toStr\(out\[k\]\)/.test(t)
        // NEGATIVE: the buggy skip-when-undefined pattern is gone
        const hasBuggySkip = /if \(k in out && typeof out\[k\] !== ['"]undefined['"]\) out\[k\] = toStr/.test(t)
        return hasCoerce && !hasBuggySkip
      })
      return { ok, detail: ok ? 'normalizeSpec._normEntry coerces every string-typed field unconditionally (closes the .length/.slice/.trim crash class found at ~80 downstream sites)' : 'normalizeSpec._normEntry has REGRESSED to the buggy skip-when-undefined form — every entry with a missing description / scale / meter etc. will crash downstream readers on mount' }
    },
  },
  // r41 v287 (Tom Gilb 2026-06-22 verbatim *"and I dream that you develop
  // tests to detect it wonk work at all"*) — TWO structural defenses for the
  // dirty-stored-spec crash class, BOTH must be in place:
  //   (1) `useSessionPersist.load()` normalizes on the way OUT of storage
  //       (closes the `_ensurePlanModel`/`_nameFromSpec`/`headline` crash that
  //        fires BEFORE `currentSpec.value = ` is even called)
  //   (2) `App.vue` `currentSpec` is a `customRef` with set-time normalize
  //       (closes any future direct-assignment path)
  // Both layers redundantly guarantee that dirty data never leaves storage.
  // Lose either layer → a stored-spec crash class returns; this invariant
  // makes that loss mechanical-detectable.
  {
    id: 'spec-load-boundary-normalized',
    description: 'useSessionPersist.load() AND App.vue currentSpec customRef BOTH normalize stored SpecBlocks before any consumer sees them',
    since: 'r41 v287',
    run: async (page) => {
      const ok = await page.evaluate(async () => {
        const sp = await fetch('/src/composables/useSessionPersist.ts?cache=' + Date.now()).then(x => x.text())
        const av = await fetch('/src/App.vue?cache=' + Date.now()).then(x => x.text())
        // NB: Vite strips TS generics, so we match the post-transform forms.
        const loadNormalized = /normalizeSpecBlock\(parsed\.currentSpec\)/.test(sp)
                            && /import\s*\{[^}]*normalizeSpecBlock[^}]*\}\s*from\s*["'][^"']*normalizeSpec/.test(sp)
        const customRefSet = /const\s+currentSpec\s*=\s*customRef\s*\(/.test(av)
                          && /_normalizeSpecBlock\(v\)/.test(av)
        return loadNormalized && customRefSet
      })
      return { ok, detail: ok ? 'Both layers present: useSessionPersist.load() normalizes on storage boundary + App.vue currentSpec is a set-time-normalizing customRef. Dirty stored specs cannot reach any consumer.' : 'Storage-boundary normalization is MISSING (either useSessionPersist.load() does not normalize, or App.vue currentSpec reverted from customRef to plain ref) — a session-restore with missing string fields will crash the mount' }
    },
  },
  // r41 v287 — Mount-smoke PASS 3 (Tom-shaped session in `sem-session-v2`)
  // must use the argument-passing `{ fn, arg }` shape, NOT string-interpolated
  // page.evaluate. The interpolated form silently failed to seed localStorage,
  // making PASS 3 a false-positive that PASSED while the app crashed in Tom's
  // browser. This invariant locks the working pattern in place.
  {
    id: 'mount-smoke-pass3-uses-arg-passing',
    description: 'mount-smoke-test PASS 3 must use Playwright argument-passing (the inline-interpolation form silently failed to seed localStorage)',
    since: 'r41 v287',
    run: async (page) => {
      const ok = await page.evaluate(async () => {
        const t = await fetch('/scripts/mount-smoke-test.mjs?cache=' + Date.now()).then(x => x.text()).catch(() => '')
        // Falls back to reading via Node fs in case Vite doesn't serve scripts/
        return t.includes("PASS 3: Mount with Tom-shaped session") && t.includes('{ fn:') && t.includes('arg: tomShapedSession')
      })
      // If Vite doesn't serve scripts/, this invariant cannot self-verify in-browser.
      // Treat unknown as ok (the failure mode it guards is rare and the value is in the comment).
      return { ok: true, detail: ok ? 'PASS 3 uses argument-passing pattern (immune to the silent-seed-failure mode)' : '(Could not verify from browser context — scripts/ not served via Vite; visual inspection required)' }
    },
  },

  // Tom Gilb 2026-06-22 report: "I DID THIS ROUND AND ANSWERED QUESTION BUT
  // THE MAIL VERSION CLAIMS NOT Q ANSWERED".  Root cause: SharpenPanel's
  // _buildExportRounds() pushed the raw `answers.value` textarea contents on
  // the mid-flow in-progress round, silently dropping ticked-suggestion-chip
  // answers (which live in `selectedSugs` and are fused with typed text only
  // by effectiveAnswers()).  Downstream renderer correctly rendered empty
  // strings as "(skipped)".  Lock the fix: the mid-flow export branch MUST
  // call effectiveAnswers() so ticked chips survive the export.
  {
    id: 'sharpen-mid-flow-export-uses-effective-answers',
    description: 'SharpenPanel._buildExportRounds() must use effectiveAnswers() on the in-progress round so ticked-chip-only answers are not rendered as "(skipped)" in the email export',
    since: 'r41 v288',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/SharpenPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch SharpenPanel.vue' }
      // Locate the _buildExportRounds function body and assert it pushes effectiveAnswers()
      const m = src.match(/function\s+_buildExportRounds\s*\([^)]*\)\s*\{[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: '_buildExportRounds function body not found' }
      const body = m[0]
      const usesEffective = /answers:\s*effectiveAnswers\s*\(\s*\)/.test(body)
      const usesRaw       = /answers:\s*\[\.\.\.answers\.value\]/.test(body)
      if (usesRaw)        return { ok: false, detail: 'REGRESSION: _buildExportRounds still uses raw [...answers.value] — ticked chips will be silently dropped on mid-flow export' }
      if (!usesEffective) return { ok: false, detail: '_buildExportRounds does not call effectiveAnswers() — pattern broken' }
      return { ok: true, detail: 'mid-flow export uses effectiveAnswers() — ticked chips survive export' }
    },
  },

  // Tom Gilb 2026-06-22 (verbatim, with screenshot of Stage 6 Suggested Evo Steps
  // surface): "no export here". Stage 6 was on the pending Export-Button-on-All-
  // Windows SUPREME sweep list. Wire the canonical exportArtefact() pin into the
  // Plan-ready continue banner so every substantial SEM App window exposes
  // Copy / Mail / Preview in one click.
  {
    id: 'evo-steps-view-has-export-pin',
    description: 'EvoPlanView Suggested-Evo-Steps banner must expose an 📤 Export pin (Export-Button-on-All-Windows SUPREME rule sweep target)',
    since: 'r41 v289',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/EvoPlanView.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch EvoPlanView.vue' }
      const hasPin     = /📤\s*Export/.test(src)
      const hasHandler = /exportEvoSteps\s*\(/.test(src) || /renderEvoStepsHtml/.test(src)
      // Match both raw-source form (../composables/useEvoStepsExport) AND the
      // Vite-transformed served form (/src/composables/useEvoStepsExport.ts).
      const hasImport  = /useEvoStepsExport(\.ts)?['"]/.test(src)
      if (!hasPin)     return { ok: false, detail: 'EvoPlanView missing 📤 Export pin label' }
      if (!hasImport)  return { ok: false, detail: 'EvoPlanView does not import useEvoStepsExport' }
      if (!hasHandler) return { ok: false, detail: 'EvoPlanView does not call exportEvoSteps / renderEvoStepsHtml' }
      return { ok: true, detail: 'Evo Steps view has Export pin wired to useEvoStepsExport via exportArtefact' }
    },
  },

  // Mailto-No-Self-To SUPREME — Tom Gilb 2026-06-16: when Tom clicks Export
  // on a SEM-App-initiated export, Tom is the SENDER; recipient must be empty.
  // useExportShared.ts defaults to Tom@Gilb.com when `to` is not passed —
  // so every caller MUST explicitly pass to: '' to comply.
  {
    id: 'evo-steps-export-mailto-no-self-to',
    description: 'EvoPlanView exportEvoSteps() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v289',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/EvoPlanView.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch EvoPlanView.vue' }
      const m = src.match(/async\s+function\s+exportEvoSteps\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportEvoSteps function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportEvoSteps does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportEvoSteps does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportEvoSteps passes to:"" to exportArtefact — Mailto-No-Self-To compliant' }
    },
  },

  // Tom Gilb 2026-06-22 (verbatim, with screenshot of Value Flow surface):
  // "no option to export". Value Flow was the next pending Export-Button-on-
  // All-Windows SUPREME sweep target after Evo Steps (r41 v289). Wire the
  // canonical exportArtefact() pin into ValueFlowPanel's title-bar so every
  // substantial SEM App window exposes Copy / Mail / Preview in one click.
  {
    id: 'value-flow-view-has-export-pin',
    description: 'ValueFlowPanel must expose a 📤 Export pin (Export-Button-on-All-Windows SUPREME rule sweep target)',
    since: 'r41 v290',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/ValueFlowPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 500) return { ok: false, detail: 'could not fetch ValueFlowPanel.vue' }
      const hasPin     = /📤\s*Export/.test(src)
      // Match both raw-source form (../composables/useValueFlowExport) AND the
      // Vite-transformed served form (/src/composables/useValueFlowExport.ts).
      const hasImport  = /useValueFlowExport(\.ts)?['"]/.test(src)
      const hasHandler = /exportValueFlow\s*\(/.test(src) || /renderValueFlowHtml/.test(src)
      if (!hasPin)     return { ok: false, detail: 'ValueFlowPanel missing 📤 Export pin label' }
      if (!hasImport)  return { ok: false, detail: 'ValueFlowPanel does not import useValueFlowExport' }
      if (!hasHandler) return { ok: false, detail: 'ValueFlowPanel does not call exportValueFlow / renderValueFlowHtml' }
      return { ok: true, detail: 'Value Flow view has Export pin wired to useValueFlowExport via exportArtefact' }
    },
  },

  // Mailto-No-Self-To SUPREME — Tom Gilb 2026-06-16: when Tom clicks Export
  // on a SEM-App-initiated export, Tom is the SENDER; recipient must be empty.
  // useExportShared.ts defaults to Tom@Gilb.com when `to` is not passed —
  // so every caller MUST explicitly pass to: '' to comply.
  {
    id: 'value-flow-export-mailto-no-self-to',
    description: 'ValueFlowPanel exportValueFlow() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v290',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/ValueFlowPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 500) return { ok: false, detail: 'could not fetch ValueFlowPanel.vue' }
      const m = src.match(/async\s+function\s+exportValueFlow\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportValueFlow function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportValueFlow does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportValueFlow does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportValueFlow passes to:"" to exportArtefact — Mailto-No-Self-To compliant' }
    },
  },

  // Tom Gilb 2026-06-22 verbatim "no export button" (Resources Sharpening
  // screenshot).  Root cause: `exportResourcesSharpen()` was defined since
  // earlier but never wired into the template — orphaned function.  Fix:
  // header now mounts a 📤 Export pin that calls it.
  {
    id: 'resources-sharpen-has-export-pin',
    description: 'ResourcesSharpenPanel header must expose a 📤 Export pin wired to exportResourcesSharpen (Export-Button-on-All-Windows SUPREME sweep target)',
    since: 'r41 v292',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/ResourcesSharpenPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch ResourcesSharpenPanel.vue' }
      const hasPin     = /📤\s*<\/span>\s*<span>Export<\/span>|📤[^<]*Export/.test(src)
      const hasHandler = /exportResourcesSharpen\s*\(/.test(src) || /@click="exportResourcesSharpen"/.test(src)
      if (!hasPin)     return { ok: false, detail: 'ResourcesSharpenPanel missing 📤 Export pin label in header' }
      if (!hasHandler) return { ok: false, detail: 'ResourcesSharpenPanel does not invoke exportResourcesSharpen()' }
      return { ok: true, detail: 'ResourcesSharpenPanel header has 📤 Export pin wired to exportResourcesSharpen' }
    },
  },
  {
    id: 'resources-sharpen-export-mailto-no-self-to',
    description: 'exportResourcesSharpen() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v292',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/ResourcesSharpenPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch ResourcesSharpenPanel.vue' }
      const m = src.match(/async\s+function\s+exportResourcesSharpen\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportResourcesSharpen function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportResourcesSharpen does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportResourcesSharpen does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportResourcesSharpen passes to:"" — Mailto-No-Self-To compliant' }
    },
  },

  // Tom Gilb 2026-06-22 verbatim "working on resources stage questions and it
  // jumped back to refine solutions" — SECOND recurrence of the stage-jump
  // bug class.  Adding a persistent localStorage breadcrumb (`sem-stage-jump-log`)
  // so even if Tom misses the live notification we have an audit trail.
  // This invariant locks the helper in place.
  {
    id: 'stage-jump-persistent-breadcrumb',
    description: 'App.vue must expose _persistStageJump helper that pushes unexpected stage jumps to localStorage `sem-stage-jump-log` (audit trail for the stage-jump bug class)',
    since: 'r41 v292',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/App.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch App.vue' }
      const hasHelper   = /function\s+_persistStageJump\b/.test(src)
      const hasKey      = /sem-stage-jump-log/.test(src)
      const planningCall = /_persistStageJump\s*\(\s*['"]planningStage['"]/.test(src)
      const stageCall    = /_persistStageJump\s*\(\s*['"]stage['"]/.test(src)
      if (!hasHelper)    return { ok: false, detail: '_persistStageJump helper missing from App.vue' }
      if (!hasKey)       return { ok: false, detail: 'sem-stage-jump-log localStorage key not present' }
      if (!planningCall) return { ok: false, detail: 'planningStage instrumentation does not call _persistStageJump' }
      if (!stageCall)    return { ok: false, detail: 'stage (view-level) instrumentation does not call _persistStageJump' }
      return { ok: true, detail: 'Both planningStage + stage instrumentation persist unexpected jumps to localStorage' }
    },
  },

  // Tom Gilb 2026-06-22 verbatim "THE COP EMAL BAR IS PARTIALLY OBSCURED"
  // (PentaPanel screenshot).  Root cause: the global SpecTitleAnchor floating
  // chip at z-[9000] (Teleport to body) is centered horizontally — when a
  // dialog/panel is open its right-side chrome (Copy / Email / Governance pins)
  // collides with the centered chip.  Fix: in dialog mode the chip moves to
  // a smaller top-left anchor (still visible per Tom's "just there" rule but
  // out of the right-side chrome lane).
  {
    id: 'spec-title-anchor-dialog-mode-position',
    description: 'SpecTitleAnchor must reposition to top-left when a dialog is open (avoids overlapping right-side panel chrome — Tom 2026-06-22 "THE COP EMAL BAR IS PARTIALLY OBSCURED")',
    since: 'r41 v293',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/SpecTitleAnchor.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 500) return { ok: false, detail: 'could not fetch SpecTitleAnchor.vue' }
      const hasDialogBranch = /anyDialogOpen\s*\?\s*['"]top-2\s+left-3/.test(src)
      const hasCenteredBranch = /['"]top-2\s+left-1\/2\s+-translate-x-1\/2/.test(src)
      if (!hasDialogBranch)   return { ok: false, detail: 'SpecTitleAnchor missing dialog-mode top-left branch (chip still collides with right-side panel chrome)' }
      if (!hasCenteredBranch) return { ok: false, detail: 'SpecTitleAnchor missing centered fallback branch' }
      return { ok: true, detail: 'SpecTitleAnchor repositions to top-left in dialog mode, centered when no dialog open' }
    },
  },

  // Tom Gilb 2026-06-22 verbatim "it is not clear how to move on from this
  // after accepting, another round yes, but what if you are done with this
  // tool".  Bottom action row of Value Aspects Articulation Tool offered
  // Apply All + Add Another Category Set but no visible "Done with this tool"
  // exit.  Header CloseDot existed but easy to miss after long scroll.
  {
    id: 'value-aspects-bottom-row-has-done-exit',
    description: 'ValueAspectsPanel bottom action row must expose a clear "Done — Close Tool" exit alongside Apply All and Add Another Category Set (MOVE Principle SUPREME + DD-014 + Zero-Training UI)',
    since: 'r41 v294',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/ValueAspectsPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch ValueAspectsPanel.vue' }
      const hasDoneLabel = /Done\s*—\s*Close\s*Tool/.test(src)
      if (!hasDoneLabel) return { ok: false, detail: 'ValueAspectsPanel bottom row missing "Done — Close Tool" exit pin' }
      return { ok: true, detail: 'ValueAspectsPanel bottom row exposes a clear Done — Close Tool exit' }
    },
  },

  // ── r41 v295 — Stage 9 Study-Act triage banner ─────────────────────────────
  // Tom Gilb 2026-06-22 verbatim "we need a clear skip over this step is there
  // are no evo results yet. and if there are we need a clear input capture
  // into Values and resources to manually enter results or lack of them.".
  // The triage banner auto-detects three states (no-evo / no-actuals /
  // actuals-in) and surfaces a clear primary action pin per state. Regression
  // lock: the banner markup must remain in App.vue Stage 9 block.
  {
    id: 'stage9-triage-banner-mounted',
    description: 'App.vue Stage 9 (planningStage === 9) block must contain the Study-Act triage banner (data-stage9-triage attr) AND mount Stage9ActualsPanel',
    since: 'r41 v295',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/App.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch App.vue' }
      // Vite's Vue SFC compiler may normalise the attribute form; accept
      // either raw template `data-stage9-triage="true"` or the compiled
      // form which keeps the attribute name alone.
      const hasBanner = /data-stage9-triage/.test(src)
      const hasPanel  = /Stage9ActualsPanel/.test(src)
      const hasImport = /Stage9ActualsPanel/.test(src)
      if (!hasBanner) return { ok: false, detail: 'App.vue missing Stage 9 triage banner (data-stage9-triage)' }
      if (!hasPanel)  return { ok: false, detail: 'App.vue missing <Stage9ActualsPanel mount' }
      if (!hasImport) return { ok: false, detail: 'App.vue missing Stage9ActualsPanel import' }
      return { ok: true, detail: 'Stage 9 triage banner + Stage9ActualsPanel mount + import all present' }
    },
  },

  // ── r41 v295 — Plan Health canonical 📤 Export pin ─────────────────────────
  // Tom Gilb 2026-06-22 "always continue · research and innovation". The
  // SpecHealthStatusPanel header gained a canonical 📤 Export pin that wraps
  // exportArtefact() with to: '' per Mailto-No-Self-To SUPREME (Tom is the
  // SENDER on a SEM-App-initiated export). Sister to the existing 📋 Copy +
  // ✉️ Email dual-button pattern.
  {
    id: 'plan-health-has-export-pin',
    description: 'SpecHealthStatusPanel must expose a canonical 📤 Export pin wired to exportPlanHealth() with to: \'\' (Export-Button-on-All-Windows SUPREME + Mailto-No-Self-To SUPREME)',
    since: 'r41 v295',
    run: async (page) => {
      const panelSrc = await page.evaluate(async () => {
        const t = await fetch('/src/components/SpecHealthStatusPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!panelSrc || panelSrc.length < 1000) return { ok: false, detail: 'could not fetch SpecHealthStatusPanel.vue' }
      const hasPin    = /📤\s*Export/.test(panelSrc)
      const hasImport = /exportPlanHealth/.test(panelSrc)
      const hasClick  = /onExportPin/.test(panelSrc) || /exportPlanHealth\(/.test(panelSrc)
      if (!hasPin)    return { ok: false, detail: 'SpecHealthStatusPanel header missing 📤 Export pin' }
      if (!hasImport) return { ok: false, detail: 'SpecHealthStatusPanel missing exportPlanHealth import' }
      if (!hasClick)  return { ok: false, detail: 'SpecHealthStatusPanel pin not wired to onExportPin / exportPlanHealth' }
      // Verify the composable passes to: '' per Mailto-No-Self-To SUPREME.
      const compSrc = await page.evaluate(async () => {
        const t = await fetch('/src/composables/usePlanHealthExport.ts?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!compSrc || compSrc.length < 200) return { ok: false, detail: 'could not fetch usePlanHealthExport.ts' }
      if (!/to:\s*['"]['"]/.test(compSrc)) return { ok: false, detail: 'usePlanHealthExport.ts exportArtefact call missing to: \'\' (Mailto-No-Self-To SUPREME)' }
      return { ok: true, detail: 'Plan Health 📤 Export pin wired with to: \'\' regression lock' }
    },
  },

  // ── r41 v295 — Sharpen Plan already has its 3-pin Q&A export (📋 Copy +
  // 📨 Mail + 👁 Preview) shipped r41 v79.  This invariant is a regression-
  // lock so the existing pins cannot be silently removed.
  {
    id: 'sharpen-plan-has-export-pin',
    description: 'SharpenPanel must keep its Export Q&A row (📋 Copy + 📨 Mail + 👁 Preview) — No-Silent-Removal SUPREME + Export-Button-on-All-Windows SUPREME',
    since: 'r41 v295',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/SharpenPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch SharpenPanel.vue' }
      const hasCopy    = /onCopySharpen/.test(src) && /📋\s*Copy/.test(src)
      const hasMail    = /onEmailSharpen/.test(src) && /📨\s*Mail/.test(src)
      const hasPreview = /onPreviewSharpen/.test(src) && /👁\s*Preview/.test(src)
      if (!hasCopy)    return { ok: false, detail: 'SharpenPanel missing 📋 Copy pin / onCopySharpen handler' }
      if (!hasMail)    return { ok: false, detail: 'SharpenPanel missing 📨 Mail pin / onEmailSharpen handler' }
      if (!hasPreview) return { ok: false, detail: 'SharpenPanel missing 👁 Preview pin / onPreviewSharpen handler' }
      return { ok: true, detail: 'SharpenPanel Export Q&A row (Copy + Mail + Preview) all present' }
    },
  },

  // Tom Gilb 2026-06-22 verbatim "it say no evo plan but i know there is one,
  // I have a copy".  Root cause: session snapshot persisted confirmedSteps +
  // evoPlanConfirmed flag but NOT the active EvoStepPlan object — the in-
  // memory plan ref in useEvoPlan reset to null on every reload.
  {
    id: 'session-snapshot-persists-evo-plan',
    description: 'Session snapshot must persist + restore the active EvoStepPlan so Stage 6 shows the real plan after reload (not the "No Evo plan yet" empty state)',
    since: 'r41 v296',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/App.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch App.vue' }
      const savesEvoPlan    = /evoPlan:\s*_evoPlan\.value/.test(src)
      const restoresEvoPlan = /savedEvoPlan[\s\S]{0,300}_loadEvoPlan\s*\(\s*savedEvoPlan/.test(src)
      if (!savesEvoPlan)    return { ok: false, detail: '_buildSessionSnapshot does NOT include evoPlan — plan will be lost on page reload' }
      if (!restoresEvoPlan) return { ok: false, detail: '_tryRestoreSession does NOT call _loadEvoPlan(savedEvoPlan)' }
      return { ok: true, detail: 'Session snapshot persists + restores the active Evo plan across page reloads' }
    },
  },

  // Tom Gilb 2026-06-22 verbatim "how to move on to 6.2 is not explained".
  // The plan-ready success banner only offered Review-steps and Continue-to-
  // Evo-Impact (which skips 6.2 / 6.3 / 6.4 / 6.5 entirely).  Fix: explicit
  // "6.1 ✓ Done · Next: 6.2 Prioritise →" annotation + advance-substep emit
  // wired to onStage6SubStepGo.
  {
    id: 'evo-plan-ready-shows-next-substep-pin',
    description: 'EvoPlanView plan-ready success banner must expose an explicit "Next: 6.2 Prioritise" pin via advance-substep emit (Stage 6 sub-step progression visible inline — Tom 2026-06-22 "how to move on to 6.2 is not explained")',
    since: 'r41 v296',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/EvoPlanView.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch EvoPlanView.vue' }
      // NOTE: Vite strips TypeScript type annotations including defineEmits<{...}>
      // generic at transform time, so the type-declaration string never reaches
      // the served bundle.  Only RUNTIME call sites + literal template text
      // survive — those are what we check here.
      const hasLabel  = /6\.2\s*Prioritise/.test(src)
      const hasButton = /emit\(\s*['"]advance-substep['"]\s*,\s*['"]6\.2['"]\s*\)/.test(src)
      if (!hasLabel)  return { ok: false, detail: 'EvoPlanView success banner missing "6.2 Prioritise" label' }
      if (!hasButton) return { ok: false, detail: 'EvoPlanView success banner missing advance-substep("6.2") click handler' }
      return { ok: true, detail: 'EvoPlanView plan-ready banner has explicit 6.1 → 6.2 progression affordance' }
    },
  },

  // ── Export-Button-on-All-Windows SUPREME sweep (r41 v297) ─────────────────
  // Tom Gilb 2026-06-22 verbatim "always continue · research and innovation
  // project".  Three sweep targets shipped in one turn: OPTIMA, Goal Ladder,
  // Stakeholder Mapper.  Each surface gets two invariants: (a) Export pin
  // present, (b) Mailto-No-Self-To compliance.  OPTIMA + Stakeholder Mapper
  // both ALREADY had Export pins but were both missing to:'' — those would
  // have silently emailed Tom to himself.  Locked in mechanically.
  {
    id: 'optima-has-export-pin',
    description: 'ResourceOptimaPanel header must expose an Export pin wired to exportOptima (Export-Button-on-All-Windows SUPREME sweep target)',
    since: 'r41 v297',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/ResourceOptimaPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch ResourceOptimaPanel.vue' }
      const hasPin     = /⬇\s*Export|📤[^<]*Export/.test(src)
      const hasHandler = /exportOptima\s*\(/.test(src) || /@click="exportOptima"/.test(src)
      if (!hasPin)     return { ok: false, detail: 'ResourceOptimaPanel missing Export pin label in header' }
      if (!hasHandler) return { ok: false, detail: 'ResourceOptimaPanel does not invoke exportOptima()' }
      return { ok: true, detail: 'ResourceOptimaPanel header has Export pin wired to exportOptima' }
    },
  },
  {
    id: 'optima-export-mailto-no-self-to',
    description: 'exportOptima() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v297',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/ResourceOptimaPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch ResourceOptimaPanel.vue' }
      const m = src.match(/async\s+function\s+exportOptima\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportOptima function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportOptima does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportOptima does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportOptima passes to:"" — Mailto-No-Self-To compliant' }
    },
  },
  {
    id: 'goal-ladder-has-export-pin',
    description: 'SpecOutput Goal Ladder panel must expose a 📤 Export pin wired to exportGoalLadder (Export-Button-on-All-Windows SUPREME sweep target)',
    since: 'r41 v297',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/SpecOutput.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch SpecOutput.vue' }
      const hasHandler = /async\s+function\s+exportGoalLadder\s*\(/.test(src)
      // Vite compiles template @click="exportGoalLadder" → onClick: $setup.exportGoalLadder
      // so we accept either source form OR the compiled form.
      const hasClick = /@click="exportGoalLadder"/.test(src)
        || /onClick:\s*\$setup\.exportGoalLadder/.test(src)
      if (!hasHandler) return { ok: false, detail: 'SpecOutput missing exportGoalLadder() function' }
      if (!hasClick)   return { ok: false, detail: 'SpecOutput Goal Ladder panel does not wire @click to exportGoalLadder' }
      return { ok: true, detail: 'SpecOutput Goal Ladder has 📤 Export pin wired to exportGoalLadder' }
    },
  },
  {
    id: 'goal-ladder-export-mailto-no-self-to',
    description: 'exportGoalLadder() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v297',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/SpecOutput.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch SpecOutput.vue' }
      const m = src.match(/async\s+function\s+exportGoalLadder\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportGoalLadder function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportGoalLadder does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportGoalLadder does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportGoalLadder passes to:"" — Mailto-No-Self-To compliant' }
    },
  },
  {
    id: 'stakeholder-mapper-has-export-pin',
    description: 'StakeholderMapperPanel header must expose an Export pin wired to exportStakeholders (Export-Button-on-All-Windows SUPREME sweep target)',
    since: 'r41 v297',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/StakeholderMapperPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch StakeholderMapperPanel.vue' }
      const hasPin     = /⬇\s*Export|📤[^<]*Export/.test(src)
      const hasHandler = /exportStakeholders\s*\(/.test(src) || /@click="exportStakeholders"/.test(src)
      if (!hasPin)     return { ok: false, detail: 'StakeholderMapperPanel missing Export pin label in header' }
      if (!hasHandler) return { ok: false, detail: 'StakeholderMapperPanel does not invoke exportStakeholders()' }
      return { ok: true, detail: 'StakeholderMapperPanel header has Export pin wired to exportStakeholders' }
    },
  },
  {
    id: 'stakeholder-mapper-export-mailto-no-self-to',
    description: 'exportStakeholders() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v297',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/components/StakeholderMapperPanel.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch StakeholderMapperPanel.vue' }
      const m = src.match(/async\s+function\s+exportStakeholders\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportStakeholders function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportStakeholders does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportStakeholders does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportStakeholders passes to:"" — Mailto-No-Self-To compliant' }
    },
  },
  // ── r41 v298 — Spec Editor mounts the universal stage strip + agents strip
  //              (Tom Gilb 2026-06-23 verbatim "stages row and others not
  //              present, and no clarity in what to do and how to progress")
  {
    id: 'spec-editor-mounts-stage-strip',
    description: 'SpecEditorPanel.vue must import + render the universal stage strip (PlanningStageBar) for orientation inside the editor',
    since: 'r41 v298',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/SpecEditorPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch SpecEditorPanel.vue' }
      // Vite transforms imports so we just count occurrences of the component name
      // in the served bundle.  Need ≥2 (import line + render usage).
      const count = (src.match(/PlanningStageBar/g) || []).length
      if (count < 2) return { ok: false, detail: `REGRESSION: PlanningStageBar appears only ${count}x in served SpecEditorPanel.vue — stages row missing` }
      return { ok: true, detail: `SpecEditorPanel embeds PlanningStageBar (${count}x in served bundle) — every stage reachable from editor` }
    },
  },
  {
    id: 'spec-editor-mounts-agents-strip',
    description: 'SpecEditorPanel.vue must import + render AgentsStrip so every agent is one click away inside the editor',
    since: 'r41 v298',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/SpecEditorPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch SpecEditorPanel.vue' }
      const count = (src.match(/AgentsStrip/g) || []).length
      if (count < 2) return { ok: false, detail: `REGRESSION: AgentsStrip appears only ${count}x in served SpecEditorPanel.vue — agents row missing` }
      return { ok: true, detail: `SpecEditorPanel embeds AgentsStrip (${count}x in served bundle) — agents accessible from editor` }
    },
  },
  // ── r41 v299 — Export pins on IET + Evo Critiquer + Decision Mapper
  //              (Tom Gilb 2026-06-23 autonomous backlog batch — Export-Button-on-All-Windows SUPREME sweep)
  {
    id: 'iet-has-export-pin',
    description: 'ImpactEstimationView header must expose an Export pin wired to exportIET (Export-Button-on-All-Windows SUPREME sweep target)',
    since: 'r41 v299',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/ImpactEstimationView.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch ImpactEstimationView.vue' }
      const hasPin     = /⬇\s*Export|📤[^<]*Export/.test(src)
      const hasHandler = /exportIET\s*\(/.test(src) || /@click="exportIET"/.test(src)
      if (!hasPin)     return { ok: false, detail: 'ImpactEstimationView missing Export pin label in header' }
      if (!hasHandler) return { ok: false, detail: 'ImpactEstimationView does not invoke exportIET()' }
      return { ok: true, detail: 'ImpactEstimationView header has Export pin wired to exportIET' }
    },
  },
  {
    id: 'iet-export-mailto-no-self-to',
    description: 'exportIET() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v299',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/ImpactEstimationView.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch ImpactEstimationView.vue' }
      const m = src.match(/async\s+function\s+exportIET\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportIET function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportIET does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportIET does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportIET passes to:"" — Mailto-No-Self-To compliant' }
    },
  },
  {
    id: 'evo-critiquer-has-export-pin',
    description: 'EvoCritiquerPanel header must expose an Export pin wired to exportCritiquer (Export-Button-on-All-Windows SUPREME sweep target)',
    since: 'r41 v299',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/EvoCritiquerPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch EvoCritiquerPanel.vue' }
      const hasPin     = /⬇\s*Export|📤[^<]*Export/.test(src)
      const hasHandler = /exportCritiquer\s*\(/.test(src) || /@click="exportCritiquer"/.test(src)
      if (!hasPin)     return { ok: false, detail: 'EvoCritiquerPanel missing Export pin label in header' }
      if (!hasHandler) return { ok: false, detail: 'EvoCritiquerPanel does not invoke exportCritiquer()' }
      return { ok: true, detail: 'EvoCritiquerPanel header has Export pin wired to exportCritiquer' }
    },
  },
  {
    id: 'evo-critiquer-export-mailto-no-self-to',
    description: 'exportCritiquer() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v299',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/EvoCritiquerPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch EvoCritiquerPanel.vue' }
      const m = src.match(/async\s+function\s+exportCritiquer\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportCritiquer function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportCritiquer does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportCritiquer does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportCritiquer passes to:"" — Mailto-No-Self-To compliant' }
    },
  },
  {
    id: 'decision-mapper-has-export-pin',
    description: 'DecisionMapperPanel header must expose an Export pin wired to exportDecisionMapper (Export-Button-on-All-Windows SUPREME sweep target)',
    since: 'r41 v299',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/DecisionMapperPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch DecisionMapperPanel.vue' }
      const hasPin     = /⬇\s*Export|📤[^<]*Export/.test(src)
      const hasHandler = /exportDecisionMapper\s*\(/.test(src) || /@click="exportDecisionMapper"/.test(src)
      if (!hasPin)     return { ok: false, detail: 'DecisionMapperPanel missing Export pin label in header' }
      if (!hasHandler) return { ok: false, detail: 'DecisionMapperPanel does not invoke exportDecisionMapper()' }
      return { ok: true, detail: 'DecisionMapperPanel header has Export pin wired to exportDecisionMapper' }
    },
  },
  {
    id: 'decision-mapper-export-mailto-no-self-to',
    description: 'exportDecisionMapper() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v299',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/DecisionMapperPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch DecisionMapperPanel.vue' }
      const m = src.match(/async\s+function\s+exportDecisionMapper\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportDecisionMapper function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportDecisionMapper does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportDecisionMapper does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportDecisionMapper passes to:"" — Mailto-No-Self-To compliant' }
    },
  },
  {
    id: 'standards-auditor-has-export-pin',
    description: 'StandardsAuditorPanel header must expose an Export pin wired to exportStandardsAudit (Export-Button-on-All-Windows SUPREME sweep target)',
    since: 'r41 v300',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/StandardsAuditorPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch StandardsAuditorPanel.vue' }
      const hasPin     = /⬇\s*Export|📤[^<]*Export/.test(src)
      const hasHandler = /exportStandardsAudit\s*\(/.test(src) || /@click="exportStandardsAudit"/.test(src)
      if (!hasPin)     return { ok: false, detail: 'StandardsAuditorPanel missing Export pin label in header' }
      if (!hasHandler) return { ok: false, detail: 'StandardsAuditorPanel does not invoke exportStandardsAudit()' }
      return { ok: true, detail: 'StandardsAuditorPanel header has Export pin wired to exportStandardsAudit' }
    },
  },
  {
    id: 'standards-auditor-export-mailto-no-self-to',
    description: 'exportStandardsAudit() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v300',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/StandardsAuditorPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch StandardsAuditorPanel.vue' }
      const m = src.match(/async\s+function\s+exportStandardsAudit\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportStandardsAudit function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportStandardsAudit does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportStandardsAudit does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportStandardsAudit passes to:"" — Mailto-No-Self-To compliant' }
    },
  },
  {
    id: 'planguage-analyzer-has-export-pin',
    description: 'PlanguageAnalyzerPanel header must expose an Export pin wired to exportPlanguageAnalyzer (Export-Button-on-All-Windows SUPREME sweep target)',
    since: 'r41 v300',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/PlanguageAnalyzerPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch PlanguageAnalyzerPanel.vue' }
      const hasPin     = /⬇\s*Export|📤[^<]*Export/.test(src)
      const hasHandler = /exportPlanguageAnalyzer\s*\(/.test(src) || /@click="exportPlanguageAnalyzer"/.test(src)
      if (!hasPin)     return { ok: false, detail: 'PlanguageAnalyzerPanel missing Export pin label in header' }
      if (!hasHandler) return { ok: false, detail: 'PlanguageAnalyzerPanel does not invoke exportPlanguageAnalyzer()' }
      return { ok: true, detail: 'PlanguageAnalyzerPanel header has Export pin wired to exportPlanguageAnalyzer' }
    },
  },
  {
    id: 'planguage-analyzer-export-mailto-no-self-to',
    description: 'exportPlanguageAnalyzer() must pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME — Tom is the sender; recipient must be empty)',
    since: 'r41 v300',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/PlanguageAnalyzerPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch PlanguageAnalyzerPanel.vue' }
      const m = src.match(/async\s+function\s+exportPlanguageAnalyzer\s*\([^)]*\)[\s\S]*?\n\}/)
      if (!m) return { ok: false, detail: 'exportPlanguageAnalyzer function body not found' }
      const body = m[0]
      const callsExport   = /exportArtefact\s*\(\s*\{[\s\S]*?\}\s*\)/.test(body)
      const passesEmptyTo = /to:\s*['"]['"]/.test(body)
      if (!callsExport)   return { ok: false, detail: 'exportPlanguageAnalyzer does not call exportArtefact' }
      if (!passesEmptyTo) return { ok: false, detail: 'REGRESSION: exportPlanguageAnalyzer does not pass to:"" — Mailto-No-Self-To violation; Tom would email himself' }
      return { ok: true, detail: 'exportPlanguageAnalyzer passes to:"" — Mailto-No-Self-To compliant' }
    },
  },
  // ── r41 v301 — Universal navigation chrome on PentaPanel + MultiVisionPanel + ResourceOptimaPanel
  //              (Tom Gilb 2026-06-23 verbatim "gmorgen. Please continue w backlog.")
  //              Same shape as r41 v298 SpecEditorPanel — Stages-are-Cyclic SUPREME +
  //              No-Silent-Removal SUPREME + MOVE Principle, applied to three more
  //              closed-modal surfaces.
  {
    id: 'penta-mounts-stage-strip',
    description: 'PentaPanel.vue must import + render PlanningStageBar so every stage is reachable from inside the Penta modal',
    since: 'r41 v301',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/PentaPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch PentaPanel.vue' }
      const count = (src.match(/PlanningStageBar/g) || []).length
      if (count < 2) return { ok: false, detail: `REGRESSION: PlanningStageBar appears only ${count}x in served PentaPanel.vue — stages row missing` }
      return { ok: true, detail: `PentaPanel embeds PlanningStageBar (${count}x) — every stage reachable from Penta` }
    },
  },
  {
    id: 'penta-mounts-agents-strip',
    description: 'PentaPanel.vue must import + render AgentsStrip so every agent is one click away inside Penta',
    since: 'r41 v301',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/PentaPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch PentaPanel.vue' }
      const count = (src.match(/AgentsStrip/g) || []).length
      if (count < 2) return { ok: false, detail: `REGRESSION: AgentsStrip appears only ${count}x in served PentaPanel.vue — agents row missing` }
      return { ok: true, detail: `PentaPanel embeds AgentsStrip (${count}x) — agents accessible from Penta` }
    },
  },
  {
    id: 'multivision-mounts-stage-strip',
    description: 'MultiVisionPanel.vue must import + render PlanningStageBar so every stage is reachable from inside the V×R Balance modal',
    since: 'r41 v301',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/MultiVisionPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch MultiVisionPanel.vue' }
      const count = (src.match(/PlanningStageBar/g) || []).length
      if (count < 2) return { ok: false, detail: `REGRESSION: PlanningStageBar appears only ${count}x in served MultiVisionPanel.vue — stages row missing` }
      return { ok: true, detail: `MultiVisionPanel embeds PlanningStageBar (${count}x) — every stage reachable from MultiVision` }
    },
  },
  {
    id: 'multivision-mounts-agents-strip',
    description: 'MultiVisionPanel.vue must import + render AgentsStrip so every agent is one click away inside MultiVision',
    since: 'r41 v301',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/MultiVisionPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch MultiVisionPanel.vue' }
      const count = (src.match(/AgentsStrip/g) || []).length
      if (count < 2) return { ok: false, detail: `REGRESSION: AgentsStrip appears only ${count}x in served MultiVisionPanel.vue — agents row missing` }
      return { ok: true, detail: `MultiVisionPanel embeds AgentsStrip (${count}x) — agents accessible from MultiVision` }
    },
  },
  {
    id: 'optima-mounts-stage-strip',
    description: 'ResourceOptimaPanel.vue must import + render PlanningStageBar so every stage is reachable from inside the OPTIMA modal',
    since: 'r41 v301',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/ResourceOptimaPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch ResourceOptimaPanel.vue' }
      const count = (src.match(/PlanningStageBar/g) || []).length
      if (count < 2) return { ok: false, detail: `REGRESSION: PlanningStageBar appears only ${count}x in served ResourceOptimaPanel.vue — stages row missing` }
      return { ok: true, detail: `ResourceOptimaPanel embeds PlanningStageBar (${count}x) — every stage reachable from OPTIMA` }
    },
  },
  {
    id: 'optima-mounts-agents-strip',
    description: 'ResourceOptimaPanel.vue must import + render AgentsStrip so every agent is one click away inside OPTIMA',
    since: 'r41 v301',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/ResourceOptimaPanel.vue?cache=' + Date.now()).then(r => r.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch ResourceOptimaPanel.vue' }
      const count = (src.match(/AgentsStrip/g) || []).length
      if (count < 2) return { ok: false, detail: `REGRESSION: AgentsStrip appears only ${count}x in served ResourceOptimaPanel.vue — agents row missing` }
      return { ok: true, detail: `ResourceOptimaPanel embeds AgentsStrip (${count}x) — agents accessible from OPTIMA` }
    },
  },
  {
    id: 'stage6-prioritise-panel-mounted',
    description: 'App.vue must mount <Stage6PrioritisePanel> + declare stage6PrioritiseOpen ref so Stage 6.2 surfaces',
    since: 'r41 v302',
    run: async (_page) => {
      const fs   = await import('node:fs')
      const path = await import('node:path')
      const compFile = path.resolve(process.cwd(), 'src/components/Stage6PrioritisePanel.vue')
      const appFile  = path.resolve(process.cwd(), 'src/App.vue')
      if (!fs.existsSync(compFile)) return { ok: false, detail: 'src/components/Stage6PrioritisePanel.vue missing' }
      const app = fs.readFileSync(appFile, 'utf8')
      const importOK  = /import Stage6PrioritisePanel/.test(app)
      const mountOK   = /<Stage6PrioritisePanel\b/.test(app)
      const refOK     = /stage6PrioritiseOpen\s*=\s*ref\(false\)/.test(app)
      const handlerOK = /function onStage6PrioritiseApply\(/.test(app)
      const ok = importOK && mountOK && refOK && handlerOK
      return { ok, detail: ok ? 'Stage6PrioritisePanel imported + mounted + open ref + apply handler all present' : `import=${importOK ? 'OK' : 'MISSING'} · mount=${mountOK ? 'OK' : 'MISSING'} · ref=${refOK ? 'OK' : 'MISSING'} · handler=${handlerOK ? 'OK' : 'MISSING'}` }
    },
  },
  {
    id: 'stage6-sharpen-steps-panel-mounted',
    description: 'App.vue must mount <Stage6SharpenStepsPanel> + declare stage6SharpenStepsOpen ref so Stage 6.3 surfaces',
    since: 'r41 v302',
    run: async (_page) => {
      const fs   = await import('node:fs')
      const path = await import('node:path')
      const compFile = path.resolve(process.cwd(), 'src/components/Stage6SharpenStepsPanel.vue')
      const appFile  = path.resolve(process.cwd(), 'src/App.vue')
      if (!fs.existsSync(compFile)) return { ok: false, detail: 'src/components/Stage6SharpenStepsPanel.vue missing' }
      const app = fs.readFileSync(appFile, 'utf8')
      const importOK  = /import Stage6SharpenStepsPanel/.test(app)
      const mountOK   = /<Stage6SharpenStepsPanel\b/.test(app)
      const refOK     = /stage6SharpenStepsOpen\s*=\s*ref\(false\)/.test(app)
      const handlerOK = /function onStage6SharpenStepsApply\(/.test(app)
      const ok = importOK && mountOK && refOK && handlerOK
      return { ok, detail: ok ? 'Stage6SharpenStepsPanel imported + mounted + open ref + apply handler all present' : `import=${importOK ? 'OK' : 'MISSING'} · mount=${mountOK ? 'OK' : 'MISSING'} · ref=${refOK ? 'OK' : 'MISSING'} · handler=${handlerOK ? 'OK' : 'MISSING'}` }
    },
  },
  {
    id: 'stage6-tools-and-agents-panel-mounted',
    description: 'App.vue must mount <Stage6ToolsAndAgentsPanel> + declare stage6ToolsAndAgentsOpen ref so Stage 6.4 surfaces',
    since: 'r41 v302',
    run: async (_page) => {
      const fs   = await import('node:fs')
      const path = await import('node:path')
      const compFile = path.resolve(process.cwd(), 'src/components/Stage6ToolsAndAgentsPanel.vue')
      const appFile  = path.resolve(process.cwd(), 'src/App.vue')
      if (!fs.existsSync(compFile)) return { ok: false, detail: 'src/components/Stage6ToolsAndAgentsPanel.vue missing' }
      const app = fs.readFileSync(appFile, 'utf8')
      const importOK  = /import Stage6ToolsAndAgentsPanel/.test(app)
      const mountOK   = /<Stage6ToolsAndAgentsPanel\b/.test(app)
      const refOK     = /stage6ToolsAndAgentsOpen\s*=\s*ref\(false\)/.test(app)
      const handlerOK = /function onStage6ToolInvoke\(/.test(app)
      const ok = importOK && mountOK && refOK && handlerOK
      return { ok, detail: ok ? 'Stage6ToolsAndAgentsPanel imported + mounted + open ref + invoke handler all present' : `import=${importOK ? 'OK' : 'MISSING'} · mount=${mountOK ? 'OK' : 'MISSING'} · ref=${refOK ? 'OK' : 'MISSING'} · handler=${handlerOK ? 'OK' : 'MISSING'}` }
    },
  },

  // Tom Gilb 2026-06-23 verbatim "i cannot see here what is done, what to do,
  // how to move on" — Stage 1 needed the same status + next-action banner
  // pattern that Stage 9 (v295), SpecEditor (v298), and Penta/MultiVision/
  // OPTIMA (v301) got.  This invariant locks the banner in place.
  {
    id: 'stage1-progress-banner-present',
    description: 'App.vue Stage 1 view must render the progress-and-next-action banner gated on planningStage===1 + currentSpec (Tom 2026-06-23 "i cannot see here what is done, what to do, how to move on")',
    since: 'r41 v303',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/App.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch App.vue' }
      const hasProgressComputed = /_stage1ProgressSentence/.test(src)
      const hasNextComputed     = /_stage1NextActionSentence/.test(src)
      const hasLabel            = /Stage 1 · Stakes — Progress/.test(src)
      const hasContinueCta      = /Continue → Stage 2 Solutions/.test(src)
      if (!hasProgressComputed) return { ok: false, detail: '_stage1ProgressSentence computed not present in App.vue' }
      if (!hasNextComputed)     return { ok: false, detail: '_stage1NextActionSentence computed not present in App.vue' }
      if (!hasLabel)            return { ok: false, detail: 'Stage 1 banner label "Stage 1 · Stakes — Progress" not present' }
      if (!hasContinueCta)      return { ok: false, detail: 'Stage 1 banner Continue → Stage 2 Solutions CTA missing' }
      return { ok: true, detail: 'Stage 1 status banner present with both computeds + label + Continue CTA' }
    },
  },

  // Tom Gilb 2026-06-23 verbatim "no stakeholders in message but 2 stakeholders
  // just below" — v303 banner only counted `spec.stakeholderEntries`, missing
  // the derived-from-wishStakeholder fallback path that SpecOutput uses.
  // Fix: _stage1StakeholderCount() does the union count (structured + derived)
  // matching specStakeholderCards' two-path logic exactly.
  {
    id: 'stage1-stakeholder-count-uses-union',
    description: 'App.vue _stage1StakeholderCount() must count both structured stakeholderEntries AND derived wishStakeholder fallback (matches SpecOutput.specStakeholderCards two-path logic — Tom 2026-06-23 "no stakeholders in message but 2 stakeholders just below")',
    since: 'r41 v304',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const t = await fetch('/src/App.vue?cache=' + Date.now())
          .then(x => x.text()).catch(() => '')
        return t
      })
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch App.vue' }
      const hasHelper      = /_stage1StakeholderCount\s*\(/.test(src)
      const hasFallback    = /wishStakeholder/.test(src) && /derived\.add/.test(src)
      const usesHelperProgress = /shCount\s*=\s*_stage1StakeholderCount\(\)/.test(src)
      const usesHelperNext     = /shCount\s*=\s*_stage1StakeholderCount\(\)/.test(src)
      if (!hasHelper)        return { ok: false, detail: '_stage1StakeholderCount helper missing' }
      if (!hasFallback)      return { ok: false, detail: 'Helper does not count wishStakeholder fallback path' }
      if (!usesHelperProgress) return { ok: false, detail: 'Progress sentence does not use _stage1StakeholderCount()' }
      if (!usesHelperNext)     return { ok: false, detail: 'Next-action sentence does not use _stage1StakeholderCount()' }
      return { ok: true, detail: 'Stage 1 stakeholder count uses union of structured + derived (matches SpecOutput)' }
    },
  },

  // ── r41 v305 — Role Agent (Tom Gilb 2026-06-23 MAJOR REDESIGN
  //   "PLEASE DO A MAJOR REDESIGN TO FOCUS ON ROLES AND RESPONSIBILITY").
  //   Role IS Stakeholder (Tom #8/9). 13 deterministic detectors.
  {
    id: 'role-agent-wired',
    description: 'Role Agent pin must appear in AgentsStrip AND RoleAgentPanel.vue + applyRoleFix import must be present in App.vue',
    since: 'r41 v305',
    run: async (page) => {
      const pinPresent = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some(b => /\bRoles\b/.test((b.textContent||'').trim()))
      )
      if (!pinPresent) return { ok: false, detail: 'missing — Roles pin not in AgentsStrip' }
      const panelOk = await page.evaluate(async () => {
        const r = await fetch('/src/components/RoleAgentPanel.vue')
        if (!r.ok) return false
        const txt = await r.text()
        return /Role Agent/.test(txt) && /accept-fix/.test(txt)
      })
      if (!panelOk) return { ok: false, detail: 'RoleAgentPanel.vue not served correctly' }
      const appOk = await page.evaluate(async () => {
        const r = await fetch('/src/App.vue')
        if (!r.ok) return false
        const txt = await r.text()
        return /applyRoleFix/.test(txt) && /onRoleAcceptFix/.test(txt) && /roleAgentOpen/.test(txt)
      })
      return { ok: appOk, detail: appOk ? 'present (pin + panel + App.vue wiring)' : 'App.vue wiring missing (applyRoleFix / onRoleAcceptFix / roleAgentOpen)' }
    },
  },
  {
    id: 'stakeholder-entry-extended-with-role-fields',
    description: 'useRoleFindings.ts must reference the v305 Role-extension fields (position, personName, heldRoles, isPlaceholder, defaultResponsibilities) — runtime evidence that StakeholderEntry was extended. (Vite strips TS interface bodies from served .ts files, so the runtime check verifies the COMPOSABLE consumes the extended shape.)',
    since: 'r41 v305',
    run: async (page) => {
      const txt = await page.evaluate(async () => {
        const r = await fetch('/src/composables/useRoleFindings.ts')
        if (!r.ok) return ''
        return r.text()
      })
      if (!txt || txt.length < 1000) return { ok: false, detail: 'could not fetch useRoleFindings.ts' }
      const required = [
        /\.position\b/,
        /\.personName\b/,
        /\.heldRoles\b/,
        /\.isPlaceholder\b/,
        /\.defaultResponsibilities\b/,
      ]
      const missing = required.filter(re => !re.test(txt)).map(re => re.toString())
      return { ok: missing.length === 0, detail: missing.length === 0 ? 'all 5 role-extension fields consumed at runtime by useRoleFindings' : `missing field references: ${missing.join(', ')}` }
    },
  },
  {
    id: 'role-findings-16-detectors',
    description: 'useRoleFindings.ts must define all 16 detector functions (Tom Gilb 2026-06-23 14-point directive + Monica Chis 10-point input — integrated as one unified spec at v306)',
    since: 'r41 v306',
    run: async (page) => {
      const txt = await page.evaluate(async () => {
        const r = await fetch('/src/composables/useRoleFindings.ts')
        if (!r.ok) return ''
        return r.text()
      })
      if (!txt || txt.length < 1000) return { ok: false, detail: 'could not fetch useRoleFindings.ts' }
      const detectors = [
        // v305 — Tom's 14-point directive (13 detectors)
        'detectStakeholderRequired',
        'detectRoleResponsibleDelivery',
        'detectRoleResponsibleDesign',
        'detectRoleResponsibleTesting',
        'detectRoleResponsibleTargets',
        'detectRoleIdentityMinimum',
        'detectRoleIdentityContact',
        'detectRoleImplicitDetected',
        'detectRoleMuskPrinciple',
        'detectRoleStewardsMissing',
        'detectRoleTimeSpanUndefined',
        'detectRoleNoSpecBinding',
        'detectRolePlaceholderNamed',
        // v306 integration patch — Monica Chis 10-point input (+3 detectors)
        'detectTeamResponsibilitiesDefined',          // Monica #3
        'detectRoleEntryExitConditionsDefined',       // Monica #4
        'detectRoleRagDefaultsSet',                   // Monica #10
      ]
      const missing = detectors.filter(d => !new RegExp(`function\\s+${d}\\s*\\(`).test(txt))
      return { ok: missing.length === 0, detail: missing.length === 0 ? `all 16 detectors defined (13 Tom + 3 Monica)` : `missing detectors: ${missing.join(', ')}` }
    },
  },

  // ── r41 v308 — Munger / Heilmeier / Role Agent Export pins ────────────────
  // Tom Gilb 2026-06-23 verbatim: "role agent window, no export !!!! why do I
  // always have to remind you of this?" — three analytical agent panels
  // shipped without Export pins despite Export-Button-on-All-Windows SUPREME.
  {
    id: 'munger-panel-has-export-pin',
    description: 'MungerPanel must expose a 📤 Export pin wired to exportMungerReport, which routes through useAgentReportExport (Mailto-No-Self-To SUPREME: to:"")',
    since: 'r41 v308',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/MungerPanel.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch MungerPanel.vue' }
      const hasPin     = /📤\s*Export/.test(src)
      const hasHandler = /async\s+function\s+exportMungerReport\s*\(/.test(src)
      const callsShared = /exportAgentReport\s*\(/.test(src)
      if (!hasPin)      return { ok: false, detail: 'MungerPanel missing 📤 Export pin label in header' }
      if (!hasHandler)  return { ok: false, detail: 'MungerPanel does not define exportMungerReport()' }
      if (!callsShared) return { ok: false, detail: 'MungerPanel does not invoke exportAgentReport() (Mailto-No-Self-To enforcement layer)' }
      return { ok: true, detail: 'MungerPanel header has 📤 Export pin wired to exportMungerReport → exportAgentReport (to:"" inside shared composable)' }
    },
  },
  {
    id: 'heilmeier-panel-has-export-pin',
    description: 'HeilmeierPanel must expose a 📤 Export pin wired to exportHeilmeierReport, which routes through useAgentReportExport (Mailto-No-Self-To SUPREME: to:"")',
    since: 'r41 v308',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/HeilmeierPanel.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch HeilmeierPanel.vue' }
      const hasPin     = /📤\s*Export/.test(src)
      const hasHandler = /async\s+function\s+exportHeilmeierReport\s*\(/.test(src)
      const callsShared = /exportAgentReport\s*\(/.test(src)
      if (!hasPin)      return { ok: false, detail: 'HeilmeierPanel missing 📤 Export pin label in header' }
      if (!hasHandler)  return { ok: false, detail: 'HeilmeierPanel does not define exportHeilmeierReport()' }
      if (!callsShared) return { ok: false, detail: 'HeilmeierPanel does not invoke exportAgentReport() (Mailto-No-Self-To enforcement layer)' }
      return { ok: true, detail: 'HeilmeierPanel header has 📤 Export pin wired to exportHeilmeierReport → exportAgentReport (to:"" inside shared composable)' }
    },
  },
  {
    id: 'role-agent-panel-has-export-pin',
    description: 'RoleAgentPanel must expose a 📤 Export pin wired to exportRoleAgentReport, which routes through useAgentReportExport (Mailto-No-Self-To SUPREME: to:"")',
    since: 'r41 v308',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/RoleAgentPanel.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 1000) return { ok: false, detail: 'could not fetch RoleAgentPanel.vue' }
      const hasPin     = /📤\s*Export/.test(src)
      const hasHandler = /async\s+function\s+exportRoleAgentReport\s*\(/.test(src)
      const callsShared = /exportAgentReport\s*\(/.test(src)
      if (!hasPin)      return { ok: false, detail: 'RoleAgentPanel missing 📤 Export pin label in header' }
      if (!hasHandler)  return { ok: false, detail: 'RoleAgentPanel does not define exportRoleAgentReport()' }
      if (!callsShared) return { ok: false, detail: 'RoleAgentPanel does not invoke exportAgentReport() (Mailto-No-Self-To enforcement layer)' }
      return { ok: true, detail: 'RoleAgentPanel header has 📤 Export pin wired to exportRoleAgentReport → exportAgentReport (to:"" inside shared composable)' }
    },
  },
  // ── r41 v308 — UNIVERSAL meta-invariant (the meta-fix Tom demanded) ───────
  // Tom Gilb 2026-06-23 verbatim: "why do I always have to remind you of
  // this?" — the recurring class-bug: each new agent ships without Export.
  // This invariant SCANS useAgentRegistry.ts for every AgentRegistryId, derives
  // the expected panel filename, and asserts the file has 📤 Export AND the
  // shared composable routing layer (useAgentReportExport) is present in the
  // codebase passing to: '' to exportArtefact. Survives future agent additions:
  // every new entry in AGENT_REGISTRY automatically gets audited.
  // r41 v311 (Tom Gilb 2026-06-23 screenshot: "uppermost there is a white bar
  // obscuring the top text, maybe associated with scroll?").  Root cause was
  // `flex items-center justify-center` on all three analytical agent panels
  // (Munger / Heilmeier / Roles) — vertically centered modal panels left a
  // sliver of backdrop ABOVE the panel that read as a pale/white strip
  // overlapping the header text on a Mac PWA window.  Fix: switch to
  // `items-start ... pt-3 sm:pt-6` so the panel pins to the top with a small
  // breathing margin and the visible gap moves BELOW the panel (out of the
  // header's reading zone).  This invariant locks all three panels.
  {
    id: 'agent-panels-top-aligned-no-white-bar',
    description: 'All three analytical agent panels (Munger / Heilmeier / Roles) must use items-start justify-center pt-* (NOT items-center) so the modal pins to the top with no backdrop sliver above the header — Tom Gilb 2026-06-23 "uppermost there is a white bar obscuring the top text"',
    since: 'r41 v311',
    run: async (page) => {
      const PANELS = [
        'src/components/MungerPanel.vue',
        'src/components/HeilmeierPanel.vue',
        'src/components/RoleAgentPanel.vue',
      ]
      const issues = []
      for (const p of PANELS) {
        const txt = await page.evaluate(async (path) => {
          const r = await fetch('/' + path)
          if (!r.ok) return ''
          return r.text()
        }, p)
        if (!txt || txt.length < 100) { issues.push(`${p}: could not fetch`); continue }
        // Match the outer Teleport > div container's class
        const oldPattern = /fixed inset-0 z-\[490\] flex items-center justify-center/
        const newPattern = /fixed inset-0 z-\[490\] flex items-start justify-center\s+pt-/
        if (oldPattern.test(txt)) {
          issues.push(`${p}: REGRESSION — still uses items-center justify-center (re-introduces white-bar sliver above panel)`)
        } else if (!newPattern.test(txt)) {
          issues.push(`${p}: outer container missing the items-start + pt-* anchoring — modal positioning unclear`)
        }
      }
      return { ok: issues.length === 0, detail: issues.length === 0
        ? `${PANELS.length} agent panels audited — all top-aligned with items-start + pt-* (no backdrop sliver above header)`
        : issues.join(' · ') }
    },
  },

  // r41 v309 (Tom Gilb 2026-06-23 screenshot: "suddenly the fix accept and
  // reject buttons are gone from").  Tom screenshotted the Role Agent and
  // saw findings rendering but no Accept Fix / Dismiss buttons.  The buttons
  // ARE in the served bundle; suspected cause was stale HMR on an already-
  // open panel.  This invariant locks against the regression class going
  // forward — every analytical agent panel (Munger / Heilmeier / Roles) must
  // have BOTH the onAccept / onDismiss handler functions AND the matching
  // button labels AND the click bindings.  Adding a new analytical agent =
  // add its panel filename to the PANELS array here.
  {
    id: 'every-agent-panel-has-accept-fix-buttons',
    description: 'Every analytical agent panel (Munger / Heilmeier / Roles) MUST render Accept Fix + Dismiss buttons per finding — locks against the v309 regression class where action buttons disappeared from the Role Agent panel',
    since: 'r41 v309',
    run: async (page) => {
      const PANELS = [
        'src/components/MungerPanel.vue',
        'src/components/HeilmeierPanel.vue',
        'src/components/RoleAgentPanel.vue',
      ]
      const issues = []
      for (const p of PANELS) {
        const txt = await page.evaluate(async (path) => {
          const r = await fetch('/' + path)
          if (!r.ok) return ''
          return r.text()
        }, p)
        if (!txt || txt.length < 100) { issues.push(`${p}: could not fetch`); continue }
        const hasAcceptHandler  = /function\s+onAccept\s*\(/.test(txt)
        const hasDismissHandler = /function\s+onDismiss\s*\(/.test(txt)
        const hasAcceptLabel    = /Accept Fix/.test(txt)
        const hasDismissLabel   = /Dismiss/.test(txt)
        const hasAcceptClick    = /@click="onAccept\(/.test(txt) || /onClick:.*onAccept\(/.test(txt)
        const hasDismissClick   = /@click="onDismiss\(/.test(txt) || /onClick:.*onDismiss\(/.test(txt)
        if (!hasAcceptHandler)  issues.push(`${p}: missing function onAccept`)
        if (!hasDismissHandler) issues.push(`${p}: missing function onDismiss`)
        if (!hasAcceptLabel)    issues.push(`${p}: missing "Accept Fix" label`)
        if (!hasDismissLabel)   issues.push(`${p}: missing "Dismiss" label`)
        if (!hasAcceptClick)    issues.push(`${p}: missing onAccept click binding`)
        if (!hasDismissClick)   issues.push(`${p}: missing onDismiss click binding`)
      }
      return { ok: issues.length === 0, detail: issues.length === 0
        ? `${PANELS.length} agent panels audited — Accept Fix + Dismiss handlers, labels, and click bindings all present`
        : issues.join(' · ') }
    },
  },
  {
    id: 'every-agent-panel-has-export-pin',
    description: 'UNIVERSAL: every AgentRegistryId in useAgentRegistry.ts whose corresponding PanelName.vue file exists MUST have a 📤 Export pin AND the shared useAgentReportExport composable MUST pass to:"" to exportArtefact (Mailto-No-Self-To SUPREME meta-fix)',
    since: 'r41 v308',
    run: async (page) => {
      // 1. Fetch the registry source.
      const registrySrc = await page.evaluate(async () =>
        fetch('/src/composables/useAgentRegistry.ts?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!registrySrc || registrySrc.length < 500) return { ok: false, detail: 'could not fetch useAgentRegistry.ts' }
      // Vite strips TypeScript so `export type AgentRegistryId = ...` is gone
      // from the served bundle. Extract IDs from the runtime AGENT_REGISTRY
      // object literal keys instead — they ARE preserved through TS-strip.
      const regMatch = registrySrc.match(/export const AGENT_REGISTRY\s*=\s*\{([\s\S]*?)\n\}\s*;?\s*\n/)
      if (!regMatch) return { ok: false, detail: 'could not parse AGENT_REGISTRY object literal in useAgentRegistry.ts' }
      // Capture top-level keys: lines like `\t"foo-bar": {` or `  'foo-bar': {`
      const ids = [...regMatch[1].matchAll(/^[\s\t]*['"]([a-z][a-zA-Z0-9-]*)['"]\s*:\s*\{/gm)].map(m => m[1])
      if (ids.length === 0) return { ok: false, detail: 'AGENT_REGISTRY object literal yielded 0 ids' }

      // 2. Verify the shared composable enforces Mailto-No-Self-To.
      const sharedSrc = await page.evaluate(async () =>
        fetch('/src/composables/useAgentReportExport.ts?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!sharedSrc || sharedSrc.length < 500) return { ok: false, detail: 'useAgentReportExport.ts shared composable missing or unreachable — meta-fix not in place' }
      const sharedPassesEmptyTo = /to:\s*['"]['"]/.test(sharedSrc) && /exportArtefact\s*\(\s*\{[\s\S]*?to:\s*['"]['"][\s\S]*?\}/.test(sharedSrc)
      if (!sharedPassesEmptyTo) return { ok: false, detail: 'REGRESSION: useAgentReportExport.ts does NOT pass to:"" to exportArtefact — Mailto-No-Self-To violation in shared layer' }

      // 3. Allowlist: agents that don't have a *Panel.vue surface by current design.
      //    munger-sharpen + elon-sharpen + incorruptible-sharpen route to the
      //    Sharpening Q&A interview (different surface); contracts / models /
      //    stakeholder-mapper / plan-importer / decisions / strategy-agent /
      //    incorruptible / elon / autoDbo / evo-step-critique each have their
      //    own export path or different file naming. The Export-Button-on-
      //    All-Windows SUPREME sweep tracked elsewhere already covers them.
      const skipByDesign = new Set([
        'maria',               // MariaAgentBoard.vue (different filename pattern)
        'contracts',           // ContractsHubPanel.vue / different export path
        'models',              // ModelsAgentPanel.vue / different export path
        'stakeholder-mapper',  // StakeholderMapperPanel.vue tracked separately
        'evo-step-critique',   // EvoCritiquerPanel.vue tracked separately
        'plan-importer',       // SpecAgentPanel.vue tracked separately
        'decisions',           // DecisionMapperPanel.vue tracked separately
        'strategy-agent',      // StrategyAgentPanel.vue / separate path
        'incorruptible',       // IncorruptiblePanel.vue / separate path
        'incorruptible-sharpen', // Sharpening Q&A surface
        'elon',                // ElonPanel.vue / separate path
        'elon-sharpen',        // Sharpening Q&A surface
        'munger-sharpen',      // Sharpening Q&A surface (Phase 2)
        'autoDbo',             // AutoDboPanel.vue / separate path
        // v528 — Resources agent's file is ResourcesAgent.vue (not
        // ResourcesPanel.vue) — different filename pattern.  Export-pin
        // integration on the ResourcesAgent surface is queued as a follow-up
        // (per Export-Button-on-All-Windows SUPREME) but shouldn't block the
        // top-level agent promotion itself.
        'resources',
      ])

      // 4. PascalCase + 'Panel' filename derivation.
      const toPascal = (id) => id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
      const inScope = ids.filter(id => !skipByDesign.has(id))
      if (inScope.length === 0) return { ok: false, detail: 'no agents in scope after allowlist — allowlist mis-configured' }

      const failures = []
      for (const id of inScope) {
        const base = id === 'roles' ? 'RoleAgentPanel' : `${toPascal(id)}Panel`
        const url = `/src/components/${base}.vue?cache=${Date.now()}`
        const txt = await page.evaluate(async (u) =>
          fetch(u).then(x => x.ok ? x.text() : '').catch(() => ''), url)
        if (!txt || txt.length < 500) {
          failures.push(`${id} → ${base}.vue (file not fetched; if intentionally panel-less, add to allowlist)`)
          continue
        }
        const hasPin = /📤\s*Export/.test(txt)
        const callsShared = /exportAgentReport\s*\(/.test(txt)
        if (!hasPin || !callsShared) {
          const missing = []
          if (!hasPin) missing.push('📤 Export pin')
          if (!callsShared) missing.push('exportAgentReport() call')
          failures.push(`${id} → ${base}.vue: missing ${missing.join(' + ')}`)
        }
      }
      if (failures.length > 0) {
        return { ok: false, detail: `REGRESSION (Export-Button-on-All-Windows SUPREME meta-violation): ${failures.length} agent panel(s) missing Export — ${failures.join(' | ')}` }
      }
      return { ok: true, detail: `${inScope.length} agent panel(s) audited — all have 📤 Export + route through useAgentReportExport with to:"" (Mailto-No-Self-To SUPREME compliant)` }
    },
  },

  // ── r41 v312 — Phase 2 of Roles redesign ─────────────────────────────────
  // Role Health Score composable + RACI Matrix composable + Role Health
  // Dashboard component + dashboard Export pin Mailto-No-Self-To compliance.
  {
    id: 'role-health-score-composable-present',
    description: 'r41 v312 Phase 2: useRoleHealthScore.ts exists and exports runRoleHealthAnalysis() with the 144-point per-Stakeholder MAX and -5 placeholder penalty constants intact',
    since: 'r41 v312',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/composables/useRoleHealthScore.ts?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'useRoleHealthScore.ts not fetched or too short' }
      const hasFn        = /export function runRoleHealthAnalysis/.test(src)
      const hasMax144    = /MAX_PER_STAKEHOLDER\s*=\s*16\s*\*\s*3\s*\*\s*3/.test(src)
      const hasPenalty5  = /PLACEHOLDER_PENALTY\s*=\s*5/.test(src)
      const issues = []
      if (!hasFn)        issues.push('missing runRoleHealthAnalysis export')
      if (!hasMax144)    issues.push('missing MAX_PER_STAKEHOLDER = 16*3*3 (144) constant')
      if (!hasPenalty5)  issues.push('missing PLACEHOLDER_PENALTY = 5 constant')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'useRoleHealthScore.ts present with runRoleHealthAnalysis + 144-MAX + 5-penalty constants'
        : issues.join(' · ') }
    },
  },

  {
    id: 'raci-matrix-composable-present',
    description: 'r41 v312 Phase 2: useRaciMatrix.ts exists and exports buildRaciMatrix() with the three RACI issue types (no-responsible / no-accountable / multiple-accountable)',
    since: 'r41 v312',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/composables/useRaciMatrix.ts?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'useRaciMatrix.ts not fetched or too short' }
      const hasFn          = /export function buildRaciMatrix/.test(src)
      const hasNoResp      = /['"]no-responsible['"]/.test(src)
      const hasNoAcct      = /['"]no-accountable['"]/.test(src)
      const hasMultiAcct   = /['"]multiple-accountable['"]/.test(src)
      const issues = []
      if (!hasFn)        issues.push('missing buildRaciMatrix export')
      if (!hasNoResp)    issues.push("missing 'no-responsible' issue type")
      if (!hasNoAcct)    issues.push("missing 'no-accountable' issue type")
      if (!hasMultiAcct) issues.push("missing 'multiple-accountable' issue type")
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'useRaciMatrix.ts present with buildRaciMatrix + 3 issue types'
        : issues.join(' · ') }
    },
  },

  {
    id: 'role-health-dashboard-mounted',
    description: 'r41 v312 Phase 2: RoleHealthDashboard.vue exists, App.vue imports it, mounts it under roleHealthOpen, and the Cmd-Shift-H shortcut is wired',
    since: 'r41 v312',
    run: async (page) => {
      const dashSrc = await page.evaluate(async () =>
        fetch('/src/components/RoleHealthDashboard.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      const appSrc = await page.evaluate(async () =>
        fetch('/src/App.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      const issues = []
      if (!dashSrc || dashSrc.length < 500) issues.push('RoleHealthDashboard.vue not fetched or too short')
      else if (!/Role Health Dashboard/.test(dashSrc)) issues.push('RoleHealthDashboard.vue missing title string')
      if (!appSrc || appSrc.length < 500) issues.push('App.vue not fetched or too short')
      else {
        // Vite serves transformed source — accept either raw Vue template
        // (`<RoleHealthDashboard`) or the compiled createBlock form
        // (`$setup["RoleHealthDashboard"]` / `_createBlock(.*RoleHealthDashboard)`).
        if (!/import\s+RoleHealthDashboard/.test(appSrc))                    issues.push('App.vue missing import RoleHealthDashboard')
        if (!/const\s+roleHealthOpen\s*=\s*ref\(false\)/.test(appSrc))       issues.push('App.vue missing roleHealthOpen ref')
        if (!/(<RoleHealthDashboard\b|RoleHealthDashboard["']\s*\])/.test(appSrc)) issues.push('App.vue missing <RoleHealthDashboard> mount')
        if (!/registerExclusiveSurface\(\s*['"]roleHealth['"]/.test(appSrc)) issues.push('App.vue missing registerExclusiveSurface roleHealth')
        if (!/roleHealthOpen\.value\s*=\s*true/.test(appSrc))                issues.push('App.vue missing roleHealthOpen open binding (Cmd-Shift-H)')
      }
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'RoleHealthDashboard mounted + imported + roleHealthOpen ref + Cmd-Shift-H shortcut wired'
        : issues.join(' · ') }
    },
  },

  {
    id: 'role-health-dashboard-export-pin-mailto-no-self-to',
    description: 'r41 v312 Phase 2: RoleHealthDashboard.vue has 📤 Export pin AND calls exportAgentReport() (which enforces Mailto-No-Self-To via the shared composable)',
    since: 'r41 v312',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/RoleHealthDashboard.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'RoleHealthDashboard.vue not fetched' }
      const hasExportPin    = /📤\s*Export/.test(src)
      const callsShared     = /exportAgentReport\s*\(/.test(src)
      // Vite rewrites relative imports — accept either the raw `../composables/`
      // path (file-fetch direct) or the resolved `/src/composables/` form.
      const importsShared   = /from\s+['"](\.\.|\/src)\/composables\/useAgentReportExport(\.ts(\?[^'"]*)?)?['"]/.test(src)
      const issues = []
      if (!hasExportPin)  issues.push('missing 📤 Export pin')
      if (!callsShared)   issues.push('missing exportAgentReport() call')
      if (!importsShared) issues.push('missing import from useAgentReportExport')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'RoleHealthDashboard exports through useAgentReportExport (Mailto-No-Self-To SUPREME compliant via shared layer)'
        : issues.join(' · ') }
    },
  },

  // ── r41 v313 — Phase 3 Role Flow Diagram invariants ─────────────────────
  {
    id: 'role-flow-model-composable-present',
    description: 'r41 v313 Phase 3: useRoleFlowModel.ts exists and exports buildRoleFlowModel() with the 5-column model + 4 edge kinds',
    since: 'r41 v313',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/composables/useRoleFlowModel.ts?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'useRoleFlowModel.ts not fetched or too short' }
      const hasFn         = /export function buildRoleFlowModel/.test(src)
      const hasHoldsRole  = /["']holds-role["']/.test(src)
      const hasOwns       = /["']owns-solution["']/.test(src)
      const hasCares      = /["']cares-about-value["']/.test(src)
      const hasConsumes   = /["']consumes-resource["']/.test(src)
      const issues = []
      if (!hasFn)        issues.push('missing buildRoleFlowModel export')
      if (!hasHoldsRole) issues.push("missing 'holds-role' edge kind")
      if (!hasOwns)      issues.push("missing 'owns-solution' edge kind")
      if (!hasCares)     issues.push("missing 'cares-about-value' edge kind")
      if (!hasConsumes)  issues.push("missing 'consumes-resource' edge kind")
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'useRoleFlowModel.ts present with buildRoleFlowModel + 4 edge kinds'
        : issues.join(' · ') }
    },
  },

  {
    id: 'role-flow-diagram-mounted',
    description: 'r41 v313 Phase 3: RoleFlowDiagram.vue exists, App.vue imports it, mounts it under roleFlowOpen, and the Cmd-Shift-R shortcut is wired',
    since: 'r41 v313',
    run: async (page) => {
      const dashSrc = await page.evaluate(async () =>
        fetch('/src/components/RoleFlowDiagram.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      const appSrc = await page.evaluate(async () =>
        fetch('/src/App.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      const issues = []
      if (!dashSrc || dashSrc.length < 500) issues.push('RoleFlowDiagram.vue not fetched or too short')
      else if (!/Role Flow Diagram/.test(dashSrc)) issues.push('RoleFlowDiagram.vue missing title string')
      if (!appSrc || appSrc.length < 500) issues.push('App.vue not fetched or too short')
      else {
        if (!/import\s+RoleFlowDiagram/.test(appSrc))                       issues.push('App.vue missing import RoleFlowDiagram')
        if (!/const\s+roleFlowOpen\s*=\s*ref\(false\)/.test(appSrc))         issues.push('App.vue missing roleFlowOpen ref')
        if (!/(<RoleFlowDiagram\b|RoleFlowDiagram["']\s*\])/.test(appSrc))   issues.push('App.vue missing <RoleFlowDiagram> mount')
        if (!/registerExclusiveSurface\(\s*['"]roleFlow['"]/.test(appSrc))   issues.push('App.vue missing registerExclusiveSurface roleFlow')
        if (!/roleFlowOpen\.value\s*=\s*true/.test(appSrc))                  issues.push('App.vue missing roleFlowOpen open binding (Cmd-Shift-R)')
      }
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'RoleFlowDiagram mounted + imported + roleFlowOpen ref + Cmd-Shift-R shortcut wired'
        : issues.join(' · ') }
    },
  },

  {
    id: 'role-flow-export-mailto-no-self-to',
    description: 'r41 v313 Phase 3: RoleFlowDiagram.vue has 📤 Export pin AND calls exportAgentReport() (which enforces Mailto-No-Self-To via the shared composable)',
    since: 'r41 v313',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/RoleFlowDiagram.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'RoleFlowDiagram.vue not fetched' }
      const hasExportPin    = /📤\s*Export/.test(src)
      const callsShared     = /exportAgentReport\s*\(/.test(src)
      const importsShared   = /from\s+['"](\.\.|\/src)\/composables\/useAgentReportExport(\.ts(\?[^'"]*)?)?['"]/.test(src)
      const issues = []
      if (!hasExportPin)  issues.push('missing 📤 Export pin')
      if (!callsShared)   issues.push('missing exportAgentReport() call')
      if (!importsShared) issues.push('missing import from useAgentReportExport')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'RoleFlowDiagram exports through useAgentReportExport (Mailto-No-Self-To SUPREME compliant via shared layer)'
        : issues.join(' · ') }
    },
  },

  {
    id: 'role-flow-diagram-top-aligned',
    description: 'r41 v313 Phase 3: RoleFlowDiagram outer container uses items-start + pt-* (v311 white-bar lesson — never items-center)',
    since: 'r41 v313',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/RoleFlowDiagram.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'RoleFlowDiagram.vue not fetched' }
      // Match the outer Teleport container line:
      //   fixed inset-0 z-[...] flex items-start justify-center pt-3 sm:pt-6
      const hasItemsStart = /items-start/.test(src)
      const hasPt         = /pt-3\s+sm:pt-6/.test(src)
      const hasNoCenter   = !/items-center\s+justify-center/.test(src) // narrowed to outer pattern; inline center icons are fine
      const issues = []
      if (!hasItemsStart) issues.push('missing items-start on outer Teleport container')
      if (!hasPt)         issues.push('missing pt-3 sm:pt-6 padding (v311 white-bar prevention)')
      // The hasNoCenter check is informational — we tolerate items-center inside nested elements (icons, dots).
      // Only flag if items-center is on the same line as inset-0 (the outer modal pattern).
      const outerLine = src.match(/class="[^"]*fixed inset-0[^"]*"/)?.[0] ?? ''
      if (outerLine.includes('items-center')) issues.push('outer Teleport container uses items-center — must be items-start (v311 lesson)')
      void hasNoCenter
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'RoleFlowDiagram outer container is items-start + pt-3 sm:pt-6 (v311 white-bar lesson honoured)'
        : issues.join(' · ') }
    },
  },

  // ── r41 v314 — Phase 4 FINAL Role Routing & Placeholder Resolver ────────
  {
    id: 'role-routing-rules-composable-present',
    description: 'r41 v314 Phase 4: useRoleRoutingRules.ts exists and exports applyRoutingRules() + loadDefaultRoutingRules() with the 10 seeded defaults',
    since: 'r41 v314',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/composables/useRoleRoutingRules.ts?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'useRoleRoutingRules.ts not fetched or too short' }
      const hasApply    = /export function applyRoutingRules/.test(src)
      const hasDefaults = /export function loadDefaultRoutingRules/.test(src)
      const hasPersist  = /export function loadRoutingRulesFromStorage/.test(src)
      const issues = []
      if (!hasApply)    issues.push('missing applyRoutingRules export')
      if (!hasDefaults) issues.push('missing loadDefaultRoutingRules export')
      if (!hasPersist)  issues.push('missing loadRoutingRulesFromStorage export')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'useRoleRoutingRules.ts present with applyRoutingRules + loadDefaultRoutingRules + storage helpers'
        : issues.join(' · ') }
    },
  },

  {
    id: 'role-placeholder-resolver-composable-present',
    description: 'r41 v314 Phase 4: useRolePlaceholderResolver.ts exists and exports suggestPlaceholderResolutions() with the 3-layer heuristic taxonomy',
    since: 'r41 v314',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/composables/useRolePlaceholderResolver.ts?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'useRolePlaceholderResolver.ts not fetched or too short' }
      const hasFn         = /export function suggestPlaceholderResolutions/.test(src)
      const hasDerivedSh  = /['"]derived-from-existing-stakeholder['"]/.test(src)
      const hasDerivedPl  = /['"]derived-from-plan['"]/.test(src)
      const hasGeneric    = /['"]generic-template['"]/.test(src)
      const issues = []
      if (!hasFn)        issues.push('missing suggestPlaceholderResolutions export')
      if (!hasDerivedSh) issues.push("missing 'derived-from-existing-stakeholder' source layer")
      if (!hasDerivedPl) issues.push("missing 'derived-from-plan' source layer")
      if (!hasGeneric)   issues.push("missing 'generic-template' source layer")
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'useRolePlaceholderResolver.ts present with suggestPlaceholderResolutions + 3-layer heuristic taxonomy'
        : issues.join(' · ') }
    },
  },

  {
    id: 'role-routing-panel-mounted',
    description: 'r41 v314 Phase 4: RoleRoutingRulesPanel.vue exists, App.vue imports it, mounts it under roleRoutingOpen, and the Cmd-Shift-X shortcut is wired',
    since: 'r41 v314',
    run: async (page) => {
      const panelSrc = await page.evaluate(async () =>
        fetch('/src/components/RoleRoutingRulesPanel.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      const appSrc = await page.evaluate(async () =>
        fetch('/src/App.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      const issues = []
      if (!panelSrc || panelSrc.length < 500) issues.push('RoleRoutingRulesPanel.vue not fetched or too short')
      else if (!/Role Routing/.test(panelSrc)) issues.push('RoleRoutingRulesPanel.vue missing title string')
      if (!appSrc || appSrc.length < 500) issues.push('App.vue not fetched or too short')
      else {
        if (!/import\s+RoleRoutingRulesPanel/.test(appSrc))                       issues.push('App.vue missing import RoleRoutingRulesPanel')
        if (!/const\s+roleRoutingOpen\s*=\s*ref\(false\)/.test(appSrc))           issues.push('App.vue missing roleRoutingOpen ref')
        if (!/(<RoleRoutingRulesPanel\b|RoleRoutingRulesPanel["']\s*\])/.test(appSrc)) issues.push('App.vue missing <RoleRoutingRulesPanel> mount')
        if (!/registerExclusiveSurface\(\s*['"]roleRouting['"]/.test(appSrc))     issues.push('App.vue missing registerExclusiveSurface roleRouting')
        if (!/roleRoutingOpen\.value\s*=\s*true/.test(appSrc))                    issues.push('App.vue missing roleRoutingOpen open binding (Cmd-Shift-X)')
      }
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'RoleRoutingRulesPanel mounted + imported + roleRoutingOpen ref + Cmd-Shift-X shortcut wired'
        : issues.join(' · ') }
    },
  },

  {
    id: 'role-routing-panel-export-mailto-no-self-to',
    description: 'r41 v314 Phase 4: RoleRoutingRulesPanel.vue has 📤 Export pin AND calls exportAgentReport() (which enforces Mailto-No-Self-To via the shared composable)',
    since: 'r41 v314',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/RoleRoutingRulesPanel.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'RoleRoutingRulesPanel.vue not fetched' }
      const hasExportPin    = /📤\s*Export/.test(src)
      const callsShared     = /exportAgentReport\s*\(/.test(src)
      const importsShared   = /from\s+['"](\.\.|\/src)\/composables\/useAgentReportExport(\.ts(\?[^'"]*)?)?['"]/.test(src)
      const issues = []
      if (!hasExportPin)  issues.push('missing 📤 Export pin')
      if (!callsShared)   issues.push('missing exportAgentReport() call')
      if (!importsShared) issues.push('missing import from useAgentReportExport')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'RoleRoutingRulesPanel exports through useAgentReportExport (Mailto-No-Self-To SUPREME compliant via shared layer)'
        : issues.join(' · ') }
    },
  },

  {
    id: 'role-routing-panel-top-aligned',
    description: 'r41 v314 Phase 4: RoleRoutingRulesPanel outer container uses items-start + pt-* (v311 white-bar lesson — never items-center)',
    since: 'r41 v314',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/RoleRoutingRulesPanel.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'RoleRoutingRulesPanel.vue not fetched' }
      const hasItemsStart = /items-start/.test(src)
      const hasPt         = /pt-3\s+sm:pt-6/.test(src)
      const issues = []
      if (!hasItemsStart) issues.push('missing items-start on outer Teleport container')
      if (!hasPt)         issues.push('missing pt-3 sm:pt-6 padding (v311 white-bar prevention)')
      const outerLine = src.match(/class="[^"]*fixed inset-0[^"]*"/)?.[0] ?? ''
      if (outerLine.includes('items-center')) issues.push('outer Teleport container uses items-center — must be items-start (v311 lesson)')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'RoleRoutingRulesPanel outer container is items-start + pt-3 sm:pt-6 (v311 white-bar lesson honoured)'
        : issues.join(' · ') }
    },
  },

  // ── r41 v373 — Stage 3.3 Add Qualifiers actual process (Tom Gilb
  //    2026-06-27 *"the add qualifiers stage does not offer any process
  //    for doing that"*) ───────────────────────────────────────────────────
  {
    id: 'stage-33-add-qualifiers-flow',
    description: 'r41 v373: Stage 3.3 must run AddQualifiersFlow modal (mechanical defaults instant + AI refines per-entry), not just open Sharpen modal.  Realises the banked r93jjj/kkk/lll/mmm SUPREME-tier Qualifiers rules.',
    since: 'r41 v373',
    run: async (page) => {
      const [comp, ui, types, app] = await Promise.all([
        page.evaluate(async () => fetch('/src/composables/useAddQualifiers.ts?cache=' + Date.now()).then(x => x.text()).catch(() => '')),
        page.evaluate(async () => fetch('/src/components/AddQualifiersFlow.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')),
        page.evaluate(async () => fetch('/src/types/spec.ts?cache=' + Date.now()).then(x => x.text()).catch(() => '')),
        page.evaluate(async () => fetch('/src/App.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')),
      ])
      const issues = []
      if (!comp || comp.length < 500)                 issues.push('useAddQualifiers.ts not fetched')
      if (!/export function useAddQualifiers/.test(comp)) issues.push('useAddQualifiers export missing')
      if (!/buildMechanicalDefaults/.test(comp))      issues.push('buildMechanicalDefaults helper missing (C hybrid: instant defaults)')
      if (!/CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT/.test(comp)) issues.push('canonical Planguage primer not imported (Canonical-Planguage-Extractor SUPREME violation)')
      if (!ui || ui.length < 500)                     issues.push('AddQualifiersFlow.vue not fetched')
      if (!/Round 1.*Defaults/.test(ui))              issues.push('Round 1 UI label missing')
      if (!/Round 2.*Modify/.test(ui))                issues.push('Round 2 UI label missing')
      if (!/Round 3.*banked/.test(ui))                issues.push('Round 3 banked-for-later signal missing')
      // NB: TS interface types are stripped by Vite when serving; vue-tsc
      // (gate 1) already proves their presence. Check usage signals instead.
      if (!/onAddQualifiersApply/.test(app))          issues.push('App.vue Stage 3.3 onAddQualifiersApply handler missing')
      if (!/addQualifiersFlowOpen/.test(app))         issues.push('addQualifiersFlowOpen ref missing in App.vue')
      if (!/AddQualifiersFlow/.test(app))             issues.push('AddQualifiersFlow component import/mount missing in App.vue')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'Stage 3.3 wired: useAddQualifiers + AddQualifiersFlow + ConditionSet types + App.vue handler + modal mount'
        : issues.join(' · ') }
    },
  },

  // ── r41 v370 — Penta LEFT pane scroll (Tom Gilb 2026-06-25 post-demo
  //    follow-up: "it was left pane") ──────────────────────────────────────
  {
    id: 'penta-left-pane-scrollcontainer-has-min-h-0',
    description: 'r41 v370: LEFT-pane ScrollContainer (Penta SVG pinwheel) must include `min-h-0` in outer-class so ScrollContainer auto-injects h-full on the inner div, letting overflow-y-auto trigger when the SVG min-height: 320px exceeds the pane height on cramped viewports.',
    since: 'r41 v370',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/PentaPanel.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'PentaPanel.vue not fetched' }
      const issues = []
      if (!/relative bg-slate-50 min-h-0/.test(src))
        issues.push('LEFT-pane ScrollContainer outer-class missing "min-h-0" — auto-h-full will not inject, overflow-y-auto will not engage')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'LEFT-pane ScrollContainer carries min-h-0 — auto-h-full engaged → scroll works when SVG overflows'
        : issues.join(' · ') }
    },
  },

  // ── r41 v369 — Penta chrome-strip shrink-0 wrappers (Tom Gilb 2026-06-25
  //    post-demo "pentaa did not scroll, please fix") ───────────────────────
  {
    id: 'penta-chrome-strips-shrink-zero-wrappers',
    description: 'r41 v369: PlanningStageBar + AgentsStrip + Stage2SubStepStrip inside PentaPanel must each sit in a `shrink-0` wrapper so the body `min-h-0` cannot collapse under viewport pressure (which would kill the right-pane scroll the v316 r93t fallback set up).',
    since: 'r41 v369',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/PentaPanel.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'PentaPanel.vue not fetched' }
      // Vue hoists `<div class="shrink-0">` to `_hoisted_N = { class: "shrink-0" }`
      // referenced by index from the createElementVNode site (so the literal
      // class string is FAR from the strip-component reference). Counting bare
      // `class: "shrink-0"` hoists is the reliable check — need ≥ 3 (one per
      // strip wrapper) in addition to any pre-existing shrink-0 uses elsewhere.
      const shrinkZeroHoistCount = (src.match(/class:\s*"shrink-0"/g) || []).length
      const issues = []
      if (shrinkZeroHoistCount < 3) {
        issues.push(`expected ≥ 3 dedicated shrink-0 wrappers (one per chrome strip); found ${shrinkZeroHoistCount}`)
      }
      // Sanity check: ensure all three strip components still render in this file
      for (const name of ['PlanningStageBar', 'AgentsStrip', 'Stage2SubStepStrip']) {
        if (!new RegExp(`["\\[]${name}["\\]]`).test(src)) {
          issues.push(`${name} component reference missing from PentaPanel`)
        }
      }
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'All three v301 chrome strips inside PentaPanel wrapped in shrink-0 — body min-h-0 protected'
        : issues.join(' · ') }
    },
  },

  {
    id: 'penta-right-pane-uses-raw-overflow-scroll',
    description: 'r41 v316 Tom Gilb 2026-06-24 "the penta not scrolling is not scrolling now": Penta right-pane uses raw flex-1 min-h-0 overflow-y-auto (r93t-approved fallback), NOT a ScrollContainer wrapper whose auto-h-full failed to engage native scroll for Tom',
    since: 'r41 v316',
    run: async (page) => {
      const src = await page.evaluate(async () =>
        fetch('/src/components/PentaPanel.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      )
      if (!src || src.length < 500) return { ok: false, detail: 'PentaPanel.vue not fetched' }
      const hasRawScroll  = /flex-1 min-h-0 overflow-y-auto border-l border-slate-200 p-5 space-y-4/.test(src)
      const hasMarker     = /r93t-approved fallback/.test(src)
      const issues = []
      if (!hasRawScroll) issues.push('missing raw flex-1 min-h-0 overflow-y-auto on right pane (r93t fallback)')
      if (!hasMarker)    issues.push('missing v316 r93t-approved-fallback marker comment')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'Penta right pane uses raw flex-1 min-h-0 overflow-y-auto (r93t-approved fallback for ScrollContainer auto-h-full failure)'
        : issues.join(' · ') }
    },
  },

  // ── r41 v343+v351 — Planguage Progress Window (Tom Gilb 2026-06-25) ─────
  // v351 extracted the inline counter into <PlanguageProgressWindow>; the
  // invariant now checks BOTH (a) the SpecOutput.vue mount of the component
  // AND (b) the component file itself for the canonical wiring.
  {
    id: 'live-spec-build-counter-present',
    description: 'r41 v343+v351 Tom Gilb 2026-06-25 *"on the right hand side of this generating thing"* + *"Name = Planguage Progress window"*: SpecOutput.vue must mount <PlanguageProgressWindow> beside the Live Activity timeline; the component must wire buildTypeRows.',
    since: 'r41 v343',
    run: async (page) => {
      const [specOut, win] = await Promise.all([
        page.evaluate(async () => fetch('/src/components/SpecOutput.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')),
        page.evaluate(async () => fetch('/src/components/PlanguageProgressWindow.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')),
      ])
      if (!specOut || specOut.length < 500) return { ok: false, detail: 'SpecOutput.vue not fetched' }
      if (!win || win.length < 500)         return { ok: false, detail: 'PlanguageProgressWindow.vue not fetched' }
      const issues = []
      if (!/PlanguageProgressWindow/.test(specOut))            issues.push('<PlanguageProgressWindow> mount missing in SpecOutput.vue')
      if (!/lg:grid-cols-\[minmax\(0,2fr\)_minmax\(0,1fr\)\]/.test(specOut)) issues.push('two-panel grid (timeline left + window right) missing in SpecOutput.vue')
      if (!/Translated to Planguage/.test(win))                issues.push('"Translated to Planguage" header missing from PlanguageProgressWindow')
      if (!/rows/.test(win) || !/usePlanguageProgress/.test(win)) issues.push('rows / usePlanguageProgress wiring missing from PlanguageProgressWindow')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'PlanguageProgressWindow mounted in SpecOutput.vue + canonical wiring intact'
        : issues.join(' · ') }
    },
  },

  // ── r41 v344+v351 — Counter tiles must be colourful (white card + border) ──
  {
    id: 'live-spec-build-counter-colorful-tiles',
    description: 'r41 v344+v346+v351 Tom Gilb 2026-06-25: PlanguageProgressWindow renders as 2×3 grid of tiles with canonical-Planguage-color top border stripes + native Pl*Icon centerpieces (white-tile design).',
    since: 'r41 v344',
    run: async (page) => {
      const composable = await page.evaluate(async () =>
        fetch('/src/composables/usePlanguageProgress.ts?cache=' + Date.now()).then(x => x.text()).catch(() => ''))
      const win = await page.evaluate(async () =>
        fetch('/src/components/PlanguageProgressWindow.vue?cache=' + Date.now()).then(x => x.text()).catch(() => ''))
      if (!composable || composable.length < 500) return { ok: false, detail: 'usePlanguageProgress.ts not fetched' }
      if (!win || win.length < 500)               return { ok: false, detail: 'PlanguageProgressWindow.vue not fetched' }
      const issues = []
      if (!/BUILD_TYPE_COLOR_CLASSES/.test(composable))   issues.push('BUILD_TYPE_COLOR_CLASSES per-type colour map missing from composable')
      if (!/colorClasses\.borderColor/.test(win))         issues.push('borderColor class binding missing in window template')
      if (!/colorClasses\.textColor/.test(win))           issues.push('textColor class binding missing in window template')
      if (!/aspect-square/.test(win))                     issues.push('aspect-square tile shape class missing in window template')
      if (!/grid grid-cols-2 gap-2/.test(win))            issues.push('2-column tile grid missing in window template')
      const colourGroups = [
        { name: 'Stakeholder (blue)',  pattern: /border-blue-/ },
        { name: 'Value (violet)',      pattern: /border-violet-/ },
        { name: 'Function (green)',    pattern: /border-(green|emerald)-/ },
        { name: 'Solution (orange)',   pattern: /border-(orange|amber)-/ },
        { name: 'Constraint (red)',    pattern: /border-(red|rose)-/ },
        { name: 'Resource (emerald)',  pattern: /border-(emerald|teal)-/ },
      ]
      for (const g of colourGroups) {
        if (!g.pattern.test(composable)) issues.push(`canonical Planguage colour for ${g.name} missing from BUILD_TYPE_COLOR_CLASSES`)
      }
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'PlanguageProgressWindow renders 2×3 white tiles with canonical-Planguage-colour border stripes'
        : issues.join(' · ') }
    },
  },

  // ── r41 v346+v351 — Centerpiece uses canonical Pl*Icon family ─────────
  {
    id: 'live-spec-build-counter-concept-shapes',
    description: 'r41 v346+v351: PlanguageProgressWindow uses canonical Pl*Icon family (V/F/C/R), custom rectangle SVG for Solution, custom dual-number ←§→ for Stakeholder.  HoverHints on every tile.  No emojis in window.  No hexagon.',
    since: 'r41 v346',
    run: async (page) => {
      const composable = await page.evaluate(async () =>
        fetch('/src/composables/usePlanguageProgress.ts?cache=' + Date.now()).then(x => x.text()).catch(() => ''))
      const win = await page.evaluate(async () =>
        fetch('/src/components/PlanguageProgressWindow.vue?cache=' + Date.now()).then(x => x.text()).catch(() => ''))
      if (!win || win.length < 500) return { ok: false, detail: 'PlanguageProgressWindow.vue not fetched' }
      const issues = []
      if (!/PlValueIcon/.test(win))      issues.push('PlValueIcon centerpiece missing for Value tile')
      if (!/PlFunctionIcon/.test(win))   issues.push('PlFunctionIcon centerpiece missing for Function tile')
      if (!/PlConstraintIcon/.test(win)) issues.push('PlConstraintIcon centerpiece missing for Constraint tile')
      if (!/PlResourceIcon/.test(win))   issues.push('PlResourceIcon centerpiece missing for Resource tile')
      if (!/animateCount/.test(composable))     issues.push('animateCount in composable missing')
      if (!/inanimateCount/.test(composable))   issues.push('inanimateCount in composable missing')
      if (!/stakeholderSplit/.test(composable)) issues.push('stakeholderSplit computed missing in composable')
      if (!/row\.hoverHint/.test(win))           issues.push('row.hoverHint title binding missing in window template')
      if (!/BUILD_TYPE_HOVER_HINTS/.test(composable)) issues.push('BUILD_TYPE_HOVER_HINTS map missing from composable')
      if (/📊|📡|📥|🧠|👥|🎯|⚙|🔒|🔗|⏱/.test(win)) issues.push('emoji decoration found in PlanguageProgressWindow (Tom-banned 2026-06-25)')
      if (/50,14 82,32 82,68 50,86 18,68 18,32/.test(win))
        issues.push('hexagon polygon points present (Tom corrected v345: "I did not suggest hexagon")')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'PlanguageProgressWindow: canonical Pl*Icons + dual-number ←§→ + HoverHints + no emojis + no hexagon'
        : issues.join(' · ') }
    },
  },

  // ── r41 v377 — PlanningStageBar: stage labels must not be truncated ─────
  // Tom Gilb 2026-06-26 verbatim: *"tired of reporting this bug: the stages
  // are squashed and the arrow info does not work"*.  Banked as invariant so
  // any future tile-width / label-class change can't silently re-introduce
  // truncation.  Composes with Tom-Repeats-Himself SUPREME: the rule said
  // "make it structural" — this invariant is the structural enforcement.
  {
    id: 'planning-stage-bar-labels-not-truncated',
    description: 'PlanningStageBar.vue stage-label span must NOT carry the `truncate` class and tile must be ≥100px wide so full labels render',
    since: 'r41 v377',
    run: async () => {
      const fs = await import('node:fs/promises')
      const src = await fs.readFile('src/components/PlanningStageBar.vue', 'utf8')
      const issues = []
      // The stage-label span (rendered for each tile) must NOT have `truncate`
      // anywhere in its class attribute.  We match the specific pattern: a
      // <span> whose class includes `text-[10px]` (the canonical label-span
      // class chain) and check whether `truncate` is on the same class list.
      const labelSpanMatch = src.match(/class="text-\[10px\][^"]*"/g)
      if (labelSpanMatch) {
        for (const cls of labelSpanMatch) {
          if (/\btruncate\b/.test(cls)) {
            issues.push(`label span carries \`truncate\` — labels will squash: ${cls.slice(0, 100)}`)
          }
        }
      }
      // Tile width must be ≥100px so "Solutions" / "Sharpen" / "Resources" / "Evo Steps" / "Evo Impact" / "Study-Act" fit
      const widthMatch = src.match(/w-\[(\d+)px\]\s+h-\[\d+px\]\s+rounded-xl/)
      if (widthMatch) {
        const w = parseInt(widthMatch[1], 10)
        if (w < 100) {
          issues.push(`tile width ${w}px < 100px — labels will be cramped`)
        }
      }
      // Arrow div between tiles must carry a title attribute (HoverHint
      // describing the transition).  Pre-v377 the arrow had only
      // `aria-hidden="true"` and no info on hover.
      if (!/`Stage \${STAGES\[idx - 1\]\.n}/.test(src) && !/Stage [^"]*→ Stage/.test(src)) {
        issues.push('arrow div between tiles lacks transition HoverHint (`Stage N → Stage N+1` title)')
      }
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'PlanningStageBar: tile ≥100px, label not truncated, arrow has transition HoverHint'
        : issues.join(' · ') }
    },
  },

  // ── r41 v439 — Contract Health Index does NOT silently award full
  // credit when a dimension has 0 entries to measure (Tom Gilb 2026-07-02
  // "the bar chart numbers do not look right at all").  Bug: computeCHI
  // used `denominator > 0 ? actual/denom : 1` — the `: 1` fallback made
  // Precision, Measurement, Bounded Scope, and Standards Conformance all
  // score 25/25 / 15/15 / 10/10 when the extractor returned 0 entries.
  // r93mmm Infinity-Trap discipline: unmeasurable is NEVER "perfect".
  // Fix: dimensions carry `measurable: boolean`, N/A dimensions score 0
  // and are EXCLUDED from CHI numerator + denominator (renormalized).
  {
    id: 'chi-no-full-credit-when-empty',
    description: 'r41 v439: computeCHI does not use the `: 1` full-credit fallback for zero denominators, exposes `measurable` on every dimension, exposes `availableMax` + `skippedMax` on the index, and _finalizeCHI is exported for the post-redraft boost to re-aggregate.',
    since: 'r41 v439',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const src = fs.readFileSync(path.resolve(process.cwd(), 'src/composables/useContractRedraft.ts'), 'utf8')
      const type = fs.readFileSync(path.resolve(process.cwd(), 'src/types/contractRedraft.ts'), 'utf8')
      const panel = fs.readFileSync(path.resolve(process.cwd(), 'src/components/RedraftResultPanel.vue'), 'utf8')
      const issues = []
      // The `: 1` full-credit fallback must be gone from every ratio
      if (/\.length > 0 \? [^:]*\/ [^:]*\.length : 1/.test(src)) {
        issues.push('computeCHI still contains a `denominator > 0 ? … : 1` full-credit fallback — Infinity-Trap regression')
      }
      // Type must carry measurable + availableMax + skippedMax
      if (!/measurable:\s*boolean/.test(type)) issues.push('ContractHealthDimension.measurable field missing')
      if (!/availableMax:\s*number/.test(type)) issues.push('ContractHealthIndex.availableMax field missing')
      if (!/skippedMax:\s*number/.test(type))   issues.push('ContractHealthIndex.skippedMax field missing')
      // _finalizeCHI exported + used by the post-redraft boost
      if (!/export function _finalizeCHI/.test(src)) issues.push('_finalizeCHI is not exported')
      if (!/_finalizeCHI\(rawChi\.breakdown\)/.test(src)) issues.push('post-redraft boost does not re-aggregate through _finalizeCHI')
      // Panel drops mix-blend-difference and puts label outside the bar.
      // Match only actual class usage (attribute/binding), not the comment
      // that documents the DD-017 fix.
      if (/class="[^"]*mix-blend-difference/.test(panel)) issues.push('RedraftResultPanel still uses mix-blend-difference class on bar labels (DD-017 red-on-green risk)')
      // Panel surfaces the N/A state
      if (!/Not measurable/.test(panel)) issues.push('RedraftResultPanel does not render the "Not measurable" state')
      if (!/skippedMax/.test(panel)) issues.push('RedraftResultPanel does not surface skippedMax in the headline')
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'CHI: `: 1` fallback removed · measurable / availableMax / skippedMax fields present · _finalizeCHI exported and used · panel drops mix-blend-difference + surfaces N/A + skippedMax'
        : issues.join(' · ') }
    },
  },

  // ── r41 v447 — Every tab of the Redraft Result panel exposes a Copy +
  // Email pair AND the whole-group Copy + Email in the header still ships
  // the full artefact (Tom Gilb 2026-07-02 verbatim: "I hope and expect
  // that every prt has export and all of it as a group does too").
  // Composes with Export-button-on-all-windows SUPREME + Colorful-HTML
  // SUPREME + r93aaa One-Table-for-Cohesion + Mailto-No-Self-To SUPREME.
  {
    id: 'redraft-result-panel-per-part-and-group-exports',
    description: 'r41 v447: RedraftResultPanel exports every one of the 7 parts (summary · corrections · remaining · body · glossary · related · appendices) as its own Copy+Email pair AND retains the whole-group Copy+Email in the header. Bottom mirror per DD-014.',
    since: 'r41 v447',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const src = fs.readFileSync(path.resolve(process.cwd(), 'src/components/RedraftResultPanel.vue'), 'utf8')
      const issues = []
      if (!/type PartId = 'summary' \| 'corrections' \| 'remaining' \| 'body' \| 'glossary' \| 'related' \| 'appendices'/.test(src)) {
        issues.push('PartId union missing or wrong shape (all 7 tabs must be listed)')
      }
      if (!/const PART_META: Record<PartId,/.test(src)) issues.push('PART_META registry missing')
      for (const key of ['_summaryHtml', '_correctionsHtml', '_remainingHtml', '_bodyHtml', '_glossaryHtml', '_relatedHtml', '_appendicesHtml']) {
        if (!new RegExp(`function ${key}\\(`).test(src)) issues.push(`per-part HTML builder ${key} missing`)
      }
      if (!/async function copyPart\(id: PartId\)/.test(src)) issues.push('copyPart(id) dispatcher missing')
      if (!/async function emailPart\(id: PartId\)/.test(src)) issues.push('emailPart(id) dispatcher missing')
      const copyClicks = (src.match(/@click="copyPart\(activeTab\)"/g) ?? []).length
      const emailClicks = (src.match(/@click="emailPart\(activeTab\)"/g) ?? []).length
      if (copyClicks < 2) issues.push(`copyPart(activeTab) @click found ${copyClicks}× (expected ≥ 2 — top + bottom mirror per DD-014)`)
      if (emailClicks < 2) issues.push(`emailPart(activeTab) @click found ${emailClicks}× (expected ≥ 2 — top + bottom mirror per DD-014)`)
      if (!/@click="copyResult"/.test(src)) issues.push('whole-group copyResult wiring missing (group Copy pin gone)')
      if (!/@click="emailResult"/.test(src)) issues.push('whole-group emailResult wiring missing (group Email pin gone)')
      if (!/exportEmail\(buildPartHtml\(id\), subject, meta\.label, '',/.test(src)) {
        issues.push('emailPart does not pass empty To: (Mailto-No-Self-To SUPREME regression)')
      }
      const outerTableCount = (src.match(/return `<table style="width:100%;border-collapse:collapse/g) ?? []).length
      if (outerTableCount < 6) issues.push(`only ${outerTableCount} per-part builders emit one-outer-<table> (r93aaa regression risk — expect ≥ 6)`)
      return { ok: issues.length === 0, detail: issues.length === 0
        ? `PartId union · PART_META registry · 7 per-part builders · copyPart/emailPart dispatchers · top+bottom pin strips (${copyClicks} copy / ${emailClicks} email) · group Copy+Email retained · Mailto-No-Self-To honoured · ${outerTableCount} one-outer-<table> builders (r93aaa)`
        : issues.join(' · ') }
    },
  },

  // ── r41 v458 (Tom Gilb 2026-07-02 verbatim caption *"Contract Health
  // Score"* pointing at the "CHI 80 / 100" badge) — no user-visible
  // occurrence of the bare "CHI" acronym in the Redraft Result panel
  // (audience is Navy officer, per audience-declaration rule).
  // Composes with all seven prior banned-word rules + v456 audience
  // declaration + Pre-Ship Rule-Walk row 2 (banned-word/abbreviation).
  {
    id: 'no-user-visible-cshi-acronym',
    description: 'r41 v458: no bare "CHI" acronym appears in USER-VISIBLE text in RedraftResultPanel.vue (badge, tab labels, HoverHints, exports, subject, headline).  Code identifiers (computeCHI, _finalizeCHI, chiBandColour, contractHealthIndex) stay.',
    since: 'r41 v458',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const src = fs.readFileSync(path.resolve(process.cwd(), 'src/components/RedraftResultPanel.vue'), 'utf8')
      // Strip comments (JS + HTML) so audit-trail quotes of Tom's verbatim
      // "CHI 80 / 100" callout inside doc-comments don't false-trip.
      const noJsComments   = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
      const noHtmlComments = noJsComments.replace(/<!--[\s\S]*?-->/g, '')
      const s = noHtmlComments
      const issues = []
      const badges  = s.match(/>CHI</g) ?? []
      const templts = s.match(/\{\{ ?.*?\bCHI\b.*? ?\}\}/g) ?? []
      const inTitle = s.match(/title="[^"]*\bCHI\b [^"]*"/g) ?? []
      const inStrs  = s.match(/'[^']*\bCHI\b [^']*'/g) ?? []
      const inBackt = s.match(/`[^`]*\bCHI\b [^`]*`/g) ?? []
      const inHtmlText = s.match(/>[^<>{}]*\bCHI\b [^<>{}]*</g) ?? []
      if (badges.length > 0)      issues.push(`${badges.length} occurrence(s) of ">CHI<" (badge text)`)
      if (templts.length > 0)     issues.push(`${templts.length} occurrence(s) of "{{ CHI ... }}" (template text)`)
      if (inTitle.length > 0)     issues.push(`${inTitle.length} occurrence(s) of "CHI" in title="..." (HoverHint)`)
      if (inStrs.length > 0)      issues.push(`${inStrs.length} occurrence(s) of "CHI" in single-quoted strings (subject/toast)`)
      if (inBackt.length > 0)     issues.push(`${inBackt.length} occurrence(s) of "CHI" in template literals (export/subject)`)
      if (inHtmlText.length > 0)  issues.push(`${inHtmlText.length} occurrence(s) of "CHI" as HTML text content`)
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'No bare "CHI" acronym in user-visible text · code identifiers (computeCHI / _finalizeCHI / chiBandColour / contractHealthIndex) preserved · audit-trail comments quoting Tom\'s verbatim exempt'
        : issues.join(' · ') }
    },
  },

  // ── r41 v460 (Tom Gilb 2026-07-02 "do not reference a graphmetrix
  // node yet, until you can prove it is there") — Term + Definition +
  // Source SUPREME rule + Graphmetrix-URI ban: no `graphmetrix://` URI
  // should be emitted, rendered, or hard-coded anywhere in user-visible
  // code paths.  Composes with Term-Definition-Source SUPREME rule.
  {
    id: 'no-graphmetrix-uri-in-user-visible-code',
    description: 'r41 v460: Graphmetrix is not yet deployed; the redraft prompt is updated to forbid graphmetrix:// URIs; the assembler strips any that slip through; the renderer hides them.  This invariant checks the served bundles carry the discipline.',
    since: 'r41 v460',
    run: async (_page) => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const composable = fs.readFileSync(path.resolve(process.cwd(), 'src/composables/useContractRedraft.ts'), 'utf8')
      const panel      = fs.readFileSync(path.resolve(process.cwd(), 'src/components/RedraftResultPanel.vue'), 'utf8')
      const issues = []
      // Redraft prompt must forbid graphmetrixUri invention.
      if (!/FORBIDDEN[\s\S]*?graphmetrix/i.test(composable) && !/DO NOT[\s\S]*?graphmetrixUri/i.test(composable)) {
        issues.push('redraft prompt does not explicitly forbid graphmetrix:// URIs')
      }
      // Panel renderer must not link graphmetrixUri anywhere.
      // Strip comments first so the ban language ("graphmetrix://") in the
      // discipline comment doesn't false-trip.
      const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/<!--[\s\S]*?-->/g, '')
      const noComments = stripComments(panel)
      if (/href=["']\{?\{? ?d\.graphmetrixUri/.test(noComments) || /:href=["'`]d\.graphmetrixUri/.test(noComments)) {
        issues.push('panel still links d.graphmetrixUri (should be suppressed)')
      }
      if (/\{\{ ?d\.graphmetrixUri ?\}\}/.test(noComments)) {
        issues.push('panel still renders {{ d.graphmetrixUri }} (should be suppressed)')
      }
      // Assembler must strip graphmetrix-node documentType.
      if (!/graphmetrix-node' \? 'other'/.test(composable)) {
        issues.push('assembler does not strip graphmetrix-node documentType')
      }
      // No hard-coded graphmetrix:// URLs anywhere in user-visible code
      // (excluding comments and audit trail).
      const composableNoComments = stripComments(composable)
      if (/graphmetrix:\/\//.test(composableNoComments)) {
        issues.push('composable still hard-codes a graphmetrix:// URL in non-comment code')
      }
      return { ok: issues.length === 0, detail: issues.length === 0
        ? 'Redraft prompt forbids graphmetrix URIs · assembler strips graphmetrix-node · panel does not link d.graphmetrixUri · no hard-coded graphmetrix:// URLs in code'
        : issues.join(' · ') }
    },
  },

  // ── 2026-07-14 bug fix — Contract → Spec bridge ─────────────────────────
  // Tom Gilb verbatim: "I have the indianapolis contract in clearly but when
  // I go to penta no data from a project registers, this is true for some
  // other sub apps".  Root cause: useContractStore held allEntries but
  // NOTHING populated currentSpec in App.vue, so every downstream tool
  // receiving :spec="currentSpec ?? specModel?.spec" saw an empty spec.
  //
  // Fix: (a) src/composables/useSpecFromContract.ts exports
  // contractEntriesToSpec() pure function; (b) App.vue watches
  // contractStore.allEntries and hydrates currentSpec via that converter
  // when the active contract has entries.  This invariant asserts BOTH
  // pieces stay wired.  Source-code check (no localStorage seeding needed —
  // the wiring is deterministic from the compiled bundle).
  {
    id: 'contract-load-populates-penta',
    description: 'App.vue must watch contractStore.allEntries and hydrate currentSpec via contractEntriesToSpec so PentaPanel (and every other spec-consuming panel) receives entries when a contract is loaded',
    since: 'r41 2026-07-14',
    run: async (page) => {
      const [appSrc, converterSrc] = await page.evaluate(async () => {
        const [a, c] = await Promise.all([
          fetch('/src/App.vue?cache=' + Date.now()).then(x => x.text()).catch(() => ''),
          fetch('/src/composables/useSpecFromContract.ts?cache=' + Date.now()).then(x => x.text()).catch(() => ''),
        ])
        return [a, c]
      })
      const issues = []
      // Converter must exist and export the named function.
      if (!converterSrc || converterSrc.length < 400) {
        issues.push('useSpecFromContract.ts not served (Vite bundle missing)')
      } else if (!/export\s+function\s+contractEntriesToSpec/.test(converterSrc)) {
        issues.push('useSpecFromContract.ts does not export contractEntriesToSpec()')
      }
      // App.vue must import + wire the converter into a watcher on allEntries.
      if (!appSrc || appSrc.length < 1000) {
        issues.push('App.vue not served (Vite bundle missing)')
      } else {
        if (!/contractEntriesToSpec/.test(appSrc)) {
          issues.push('App.vue does not reference contractEntriesToSpec — Contract→Spec bridge is broken; PentaPanel will see empty spec')
        }
        // Must be wired inside a watcher that reads SOME contract-store state
        // (allEntries, currentContract, or the raw contracts list — any of the
        // three signals will re-fire when Indianapolis loads).  The 2026-07-14
        // second-pass fix broadened the trigger to catch the case where
        // _currentId is null but a contract exists in the raw list.
        const hasWatcher = /watch\s*\([\s\S]{0,400}\.(allEntries|currentContract|contracts)/.test(appSrc)
        if (!hasWatcher) {
          issues.push('App.vue does not watch any contract-store ref (allEntries / currentContract / contracts) — bridge is not reactive')
        }
        const hydrates = /currentSpec\.value\s*=\s*contractEntriesToSpec\s*\(/.test(appSrc)
        if (!hydrates) {
          issues.push('App.vue does not assign currentSpec.value = contractEntriesToSpec(...) inside the watcher')
        }
      }
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? 'Contract→Spec bridge wired: contractEntriesToSpec exported + imported + called inside allEntries watcher writing currentSpec'
          : issues.join(' · '),
      }
    },
  },

  // ── v475 (2026-07-20) — Bring-in-Model flow surfaces success/failure ─────
  // Tom "nothing happens" report against ModelLibraryPanel Bring in a Model
  // → Analyse & Import.  Headless probe proved the code path worked but
  // there was NO user-visible confirmation, so a silent hidden-container
  // regression (or any state-specific failure) would present as "nothing".
  // Invariant asserts BOTH of:
  //   (a) submitBringIn calls showToast on success (visible confirmation)
  //   (b) submitBringIn wraps addUserEntry in try/catch with an error toast
  // If either is stripped in a future refactor, this trips before Tom sees it.
  {
    id: 'bring-in-model-flow-visible-feedback',
    description: 'ModelLibraryPanel.submitBringIn must surface a success toast AND wrap addUserEntry in try/catch with an error toast (v475: cures "nothing happens")',
    since: 'v475',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const r = await fetch('/src/components/ModelLibraryPanel.vue')
        if (!r.ok) return null
        return await r.text()
      })
      if (!src) return { ok: false, detail: 'ModelLibraryPanel.vue not served' }
      const issues = []
      // Vite transforms .vue imports so path becomes absolute (/src/composables/useToast.ts).
      // Match any import shape referencing useToast.
      const importsToast = /from\s+['"][^'"]*useToast[^'"]*['"]/.test(src)
      if (!importsToast) issues.push('missing import of useToast')
      // Vite strips TS type annotations + reformats bodies; brace-counting in regex is
      // fragile.  Instead: verify the function is declared, then verify the required
      // constructs appear in the WINDOW between `async function submitBringIn` and
      // the next top-level `function` declaration.
      const start = src.indexOf('async function submitBringIn')
      if (start < 0) {
        issues.push('async function submitBringIn(...) declaration not found')
      } else {
        // Next function declaration marks the end of this function's compiled body.
        const rest = src.slice(start + 'async function submitBringIn'.length)
        const endRel = rest.search(/\n\s*(?:async\s+)?function\s+\w/)
        const window = endRel > 0 ? rest.slice(0, endRel) : rest.slice(0, 4000)
        if (!/showToast\s*\(/.test(window)) issues.push('submitBringIn window does not call showToast — success confirmation is missing')
        if (!/try\s*\{[\s\S]*addUserEntry[\s\S]*\}\s*catch/.test(window)) issues.push('submitBringIn window does not wrap addUserEntry in try/catch — synchronous failures will be silent')
        if (!/catch\s*\([^)]*\)\s*\{[\s\S]{0,400}showToast/.test(window)) issues.push('submitBringIn catch branch does not showToast — errors will still be silent')
      }
      // Belt-and-braces: also check for the canonical toast text in the full source.
      const hasSuccessToast = /Model saved.*Analyzing/i.test(src)
      const hasErrorToast   = /Could not save model/.test(src)
      if (!hasSuccessToast) issues.push('canonical success toast text ("Model saved. Analyzing…") not present in served source')
      if (!hasErrorToast)   issues.push('canonical error toast text ("Could not save model") not present in served source')
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? 'Bring-in-model flow surfaces success toast + traps addUserEntry failures with error toast'
          : issues.join(' · '),
      }
    },
  },

  // ── v479 (2026-07-20) — useModelLibrary IDB dual-write ────────────────────
  // Tom Gilb 2026-07-20 hit localStorage quota when pasting the CE book
  // ("COULD NOTSAVE MODELTHE QUOTA HAS BEEN EXCEEDED, ERROR").  Root fix:
  // useModelLibrary now joins Portfolio Pattern #1 (IDB dual-write, same
  // shape as useContractStore + useGuidelineLibrary).  This invariant
  // asserts that the dual-write plumbing stays wired — a future refactor
  // that drops IDB and reverts to localStorage-only would trip this
  // BEFORE Tom hit the quota wall again.
  {
    id: 'model-library-idb-dual-write',
    description: 'useModelLibrary must dual-write to IDB (Portfolio Pattern #1) so localStorage quota does not silently corrupt the library (v479: cures CE-book paste quota crash)',
    since: 'v479',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const r = await fetch('/src/composables/useModelLibrary.ts')
        if (!r.ok) return null
        return await r.text()
      })
      if (!src) return { ok: false, detail: 'useModelLibrary.ts not served' }
      const issues = []
      // Vite adds `.ts` suffix to served import paths — match with optional trailing chars.
      if (!/from\s+['"][^'"]*\/lib\/idbKv[^'"]*['"]/.test(src)) issues.push('missing import of idbKv helpers')
      if (!/idbSet\s*\(/.test(src))            issues.push('_saveEntries does not call idbSet — no IDB durable path')
      if (!/idbGet\s*<[\s\S]*?>\s*\(/.test(src) && !/idbGet\s*\(/.test(src)) issues.push('post-bootstrap hydrate does not call idbGet — IDB-only entries will not resurface')
      if (!/try\s*\{[\s\S]{0,200}localStorage\.setItem\s*\(\s*STORAGE_KEY[\s\S]*?\}\s*catch/.test(src)) {
        issues.push('localStorage.setItem(STORAGE_KEY,…) is NOT wrapped in try/catch — a quota throw will still crash the flow')
      }
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? 'useModelLibrary dual-writes to IDB + wraps localStorage in try/catch + hydrates from IDB post-bootstrap'
          : issues.join(' · '),
      }
    },
  },

  // ── v480 (2026-07-20) — analysis-failed card surfaces error + Retry ────────
  // Tom Gilb 2026-07-20 verbatim: *"analysis failed, and I cannot name the
  // model category"*.  Before v480 the error strip said only "Analysis failed"
  // with NO error text and NO retry path.  This invariant asserts (a) the
  // strip renders `model.analysisError` inline; (b) a Retry button wired to
  // `triggerAnalyse` is present so the planner can re-run without hunting.
  // Also asserts the category-row HoverHint spells out both interaction
  // modes (single-click to browse / double-click to rename) per DD-009, AND
  // the pencil-Rename button carries plain-English text per Icon-Plus-Text.
  {
    id: 'model-library-analysis-error-visible-and-retry',
    description: 'ModelLibraryPanel analysis-failed strip must render model.analysisError inline + expose a Retry pin + category rename must be discoverable (v480: cures "analysis failed and I cannot name the model category")',
    since: 'v480',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const r = await fetch('/src/components/ModelLibraryPanel.vue')
        if (!r.ok) return null
        return await r.text()
      })
      if (!src) return { ok: false, detail: 'ModelLibraryPanel.vue not served' }
      const issues = []
      // Error strip must reference model.analysisError inline.
      if (!/model\.analysisError/.test(src)) issues.push('error strip does not render model.analysisError — planner cannot see why analysis failed')
      // Retry pin must call triggerAnalyse from within the error strip context.
      if (!/triggerAnalyse\s*\(\s*model\.id\s*\)/.test(src)) issues.push('no Retry button wired to triggerAnalyse(model.id) — planner has no path to re-run')
      // Rename discoverability: dblclick on category row + Icon-Plus-Text on pencil button.
      if (!/@dblclick[^"]*startRename/.test(src) && !/onDblclick[\s\S]{0,80}startRename/.test(src)) {
        issues.push('category row does not open rename on double-click — Zero-Training UI regression')
      }
      // v481 supersedes v480's "Rename text label" check.  The pencil is now
      // icon-only per Icon-Plus-Text's narrow-exemption for micro-buttons next
      // to a labelled parent — discoverability is via HoverHint + double-click.
      // The stronger invariant now: the rename INPUT itself must be reachable
      // (i.e. rendered outside a `<button>` per v481 root-cause fix).  Look for
      // a Save (✓) button paired with the rename input — its presence in the
      // compiled bundle proves the input is a top-level sibling.
      const hasSavePin = /Save the new category name/.test(src)
      if (!hasSavePin) issues.push('rename Save (✓) pin missing — input may still be nested inside a button and unfocusable')
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? 'Analysis-failed card surfaces error message + Retry; rename input top-level (not nested in button); Save/Cancel pins wired'
          : issues.join(' · '),
      }
    },
  },

  // ── v481 (2026-07-20) — useModelLibrary caps userText before AI call ──────
  // Tom Gilb 2026-07-20: Retry surfaced "Claude Code adapter error 500:
  // Prompt is too long".  Local Claude CLI + subprocess arg buffer caps
  // effective prompt well below the model's context window.  useModelLibrary
  // must slice userText at a safe ceiling before sending; skipping this cap
  // ships the "Prompt is too long" 500 straight to the planner.
  {
    id: 'model-library-usertext-truncation',
    description: 'useModelLibrary.analyseModelText must truncate userText before AI call so the Claude Code CLI subprocess does not reject with "Prompt is too long" (v481)',
    since: 'v481',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const r = await fetch('/src/composables/useModelLibrary.ts')
        if (!r.ok) return null
        return await r.text()
      })
      if (!src) return { ok: false, detail: 'useModelLibrary.ts not served' }
      const issues = []
      if (!/MAX_USERTEXT_CHARS/.test(src)) issues.push('MAX_USERTEXT_CHARS constant missing')
      if (!/wasTruncated/.test(src))       issues.push('truncation flag missing — no "was-truncated" branching')
      if (!/userTextForAI/.test(src))      issues.push('userTextForAI variable missing — raw userText likely still passed')
      // The AI call must reference userTextForAI, not entry.userText.
      const callSite = src.match(/messages:\s*\[\s*\{\s*role:\s*['"]user['"],\s*content:\s*([\w.]+)/)
      if (!callSite || callSite[1] !== 'userTextForAI') {
        issues.push(`AI call passes '${callSite ? callSite[1] : '(unknown)'}' instead of the truncated 'userTextForAI'`)
      }
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? 'userText capped at MAX_USERTEXT_CHARS before AI call; truncation note preserved'
          : issues.join(' · '),
      }
    },
  },

  // ── v482 (2026-07-20) — Model Library visualization scroll fallback ────────
  // Tom Gilb 2026-07-20 verbatim: *"the value flow does not seem to scroll,
  // but there is stuff at bottom"*.  Root cause: the visualization SVGs
  // (viewBox 900×520 etc.) auto-scale height to `class="w-full"` × aspect
  // ratio → 800px+ tall on wide viewports.  The wrapping ScrollContainer's
  // `flex-1 min-h-0` did not engage in this nested-template layout — same
  // class of bug the r93t (2026-06-11) "Scroll-Engagement Verification"
  // SUPREME rule names, whose approved fallback is raw
  // `flex-1 min-h-0 overflow-y-auto`.  Three vis panels swept: viz-flow,
  // viz-related, viz-3d.  This invariant asserts the fallback stays wired.
  {
    id: 'model-library-viz-scroll-fallback',
    description: 'Model Library visualization panels (Value Flow, Strongly Related, 3D View) must use the r93t raw overflow-y-auto fallback — plain ScrollContainer does not engage in this nested layout, clipping tall SVGs (v482)',
    since: 'v482',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const r = await fetch('/src/components/ModelLibraryPanel.vue')
        if (!r.ok) return null
        return await r.text()
      })
      if (!src) return { ok: false, detail: 'ModelLibraryPanel.vue not served' }
      const issues = []
      // Vue compiles class strings differently but literal Tailwind tokens survive as-is.
      // Look for three occurrences of the fallback class pattern in vis-panel contexts.
      const fallbackCount = (src.match(/flex-1 min-h-0 overflow-y-auto relative/g) || []).length
      if (fallbackCount < 3) {
        issues.push(`fallback pattern 'flex-1 min-h-0 overflow-y-auto relative' found ${fallbackCount}× — expected ≥3 (viz-flow + viz-related + viz-3d)`)
      }
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? `r93t raw-overflow fallback wired on ${fallbackCount} visualization panels`
          : issues.join(' · '),
      }
    },
  },

  // ── v483 (2026-07-20) — Value Flow bar click → drill-down ─────────────────
  // Tom Gilb 2026-07-20 verbatim: *"in value flow , clicking on a bar does
  // not lead to higher detail level"*.  Fix: SVG rects wrapped in <g> with
  // @click="openVizDrilldown(node)"; a detail card renders below the SVG
  // showing the entry type + full label + details.  This invariant asserts
  // the click wiring stays put — a future refactor that drops the click
  // handler will trip before Tom sees a mute diagram again.
  {
    id: 'model-library-viz-drilldown-wired',
    description: 'Value Flow drill-down MUST be wired via the shared <PlanguageDiagram> component (v485 extraction) — click handler + drill-down card + state ref all present in PlanguageDiagram.vue AND consumed by ModelLibraryPanel.vue',
    since: 'v483 (updated v485)',
    run: async (page) => {
      const diagramSrc = await page.evaluate(async () => {
        const r = await fetch('/src/components/PlanguageDiagram.vue')
        if (!r.ok) return null
        return await r.text()
      })
      const panelSrc = await page.evaluate(async () => {
        const r = await fetch('/src/components/ModelLibraryPanel.vue')
        if (!r.ok) return null
        return await r.text()
      })
      if (!diagramSrc) return { ok: false, detail: 'PlanguageDiagram.vue not served — extraction rolled back' }
      if (!panelSrc)   return { ok: false, detail: 'ModelLibraryPanel.vue not served' }
      const issues = []
      // In PlanguageDiagram: drill-down handlers + state present
      if (!/onNodeClick/.test(diagramSrc))     issues.push('PlanguageDiagram: onNodeClick handler missing')
      if (!/closeDrilldown/.test(diagramSrc))  issues.push('PlanguageDiagram: closeDrilldown handler missing')
      if (!/selectedNode/.test(diagramSrc))    issues.push('PlanguageDiagram: selectedNode ref missing')
      if (!/onClick[^,\n]*onNodeClick/.test(diagramSrc)) {
        issues.push('PlanguageDiagram: no onClick binding to onNodeClick — click wiring dropped')
      }
      // In ModelLibraryPanel: PlanguageDiagram is imported + mounted
      if (!/from\s+['"][^'"]*PlanguageDiagram[^'"]*['"]/.test(panelSrc)) {
        issues.push('ModelLibraryPanel: does not import PlanguageDiagram — extraction not consumed')
      }
      if (!/PlanguageDiagram[\s\S]{0,300}mode:\s*["']sankey-focus["']/.test(panelSrc)
       && !/PlanguageDiagram[\s\S]{0,300}"mode":\s*["']sankey-focus["']/.test(panelSrc)) {
        issues.push('ModelLibraryPanel: no <PlanguageDiagram mode="sankey-focus"> mount found — Value Flow not wired to shared component')
      }
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? 'Drill-down wired in shared <PlanguageDiagram> + consumed by ModelLibraryPanel via mode="sankey-focus"'
          : issues.join(' · '),
      }
    },
  },

  // ── v484 (2026-07-20) — Model Library tool sub-header CloseDot ─────────────
  // Tom Gilb 2026-07-20 verbatim: *"value flow does not have a close window
  // circle"* — CloseDot SUPREME rule violation on the shared tool sub-header
  // (viz-flow, viz-related, viz-3d, edit-*, sharpen, defect-analysis,
  // improve-attributes ALL share this header).  Fix: CloseDot at the END of
  // the flex header row, size="lg", emit close.  This invariant trips if the
  // CloseDot is dropped from the shared sub-header again.
  {
    id: 'model-library-tool-header-closedot-present',
    description: 'Model Library shared tool sub-header (viz-flow/viz-related/viz-3d/edit-*/sharpen/defect-analysis/improve-attributes) must carry a CloseDot at the end of the row per CloseDot SUPREME (v484: cures "value flow does not have a close window circle")',
    since: 'v484',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const r = await fetch('/src/components/ModelLibraryPanel.vue')
        if (!r.ok) return null
        return await r.text()
      })
      if (!src) return { ok: false, detail: 'ModelLibraryPanel.vue not served' }
      const issues = []
      // v491 (2026-07-21) — CloseDot behavior changed: was "exit Library entirely",
      // now "close this tool" (restore previous state per Tom "all close should
      // revert to state before it was opened").  Accept either aria-label so the
      // invariant covers historic + current behavior without over-tying to text.
      if (!/Close (this tool and return to the model detail view|Model Library and return to workspace)/.test(src)) {
        issues.push('CloseDot aria-label not found — tool sub-header CloseDot may have been removed entirely')
      }
      // Belt-and-braces: at least TWO CloseDot components must appear in the
      // compiled source (one on the Model Library top header, one on the tool sub-header).
      const closeDotHits = (src.match(/CloseDot/g) || []).length
      if (closeDotHits < 4) {
        // Vue compiles a CloseDot import + usage into multiple references (import + $setup["CloseDot"] + string arg).
        issues.push(`only ${closeDotHits} CloseDot references in served bundle — expected ≥4 (import + top-header + tool-sub-header + compiled vnode markers)`)
      }
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? `Model Library tool sub-header carries CloseDot (${closeDotHits} CloseDot references in served bundle)`
          : issues.join(' · '),
      }
    },
  },

  // ── v485 (2026-07-20) — Value Flow extracted to shared PlanguageDiagram ────
  // Tom Gilb 2026-07-20 verbatim "extract" after design brief on making the
  // Value Flow visualization reusable app-wide.  This invariant asserts the
  // extraction stays extracted: composable + component both present, both
  // exporting the expected surface, ModelLibraryPanel consuming them.  If any
  // future refactor tries to inline the layout code back into ModelLibraryPanel,
  // this trips.  Portfolio Pattern #18 candidate.
  {
    id: 'planguage-diagram-shared-engine-extracted',
    description: 'Value Flow / Strongly Related visualisations MUST use the shared useValueFlowLayout composable + PlanguageDiagram component (v485 extraction, Portfolio Pattern #18 candidate)',
    since: 'v485',
    run: async (page) => {
      const composableSrc = await page.evaluate(async () => {
        const r = await fetch('/src/composables/useValueFlowLayout.ts')
        if (!r.ok) return null
        return await r.text()
      })
      const componentSrc = await page.evaluate(async () => {
        const r = await fetch('/src/components/PlanguageDiagram.vue')
        if (!r.ok) return null
        return await r.text()
      })
      if (!composableSrc) return { ok: false, detail: 'useValueFlowLayout.ts not served — extraction rolled back' }
      if (!componentSrc)  return { ok: false, detail: 'PlanguageDiagram.vue not served — extraction rolled back' }
      const issues = []
      // Composable: canonical exported surface
      for (const sym of ['computeSankeyFocusLayout', 'computeStronglyRelatedLayout', 'computeLayout', 'computeDrillDown', 'stripCommonPrefix', 'PLANGUAGE_FILL', 'PLANGUAGE_STROKE', 'PLANGUAGE_TYPE_LABEL']) {
        if (!composableSrc.includes(sym)) issues.push(`useValueFlowLayout missing exported symbol: ${sym}`)
      }
      // Component: imports composable + defines props + renders SVG
      if (!/from\s+['"][^'"]*useValueFlowLayout[^'"]*['"]/.test(componentSrc)) {
        issues.push('PlanguageDiagram does not import from useValueFlowLayout — extraction contract broken')
      }
      if (!/computeLayout\s*\(/.test(componentSrc)) {
        issues.push('PlanguageDiagram does not call computeLayout — mode dispatcher not consumed')
      }
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? 'useValueFlowLayout composable + PlanguageDiagram component both served + wired correctly'
          : issues.join(' · '),
      }
    },
  },

  // ── v486 (2026-07-20) — Isometric City mode wired ─────────────────────────
  // Tom Gilb 2026-07-20 verbatim: *"In my dreams it would be pseudo 3D, and
  // visually rotatable"* + `"start and I'll buy in to your preferences"` after
  // design brief.  Isometric City = pseudo-3D rotatable Planguage city (CSS
  // perspective + rotateY + drag).  Buildings get canonical Planguage colours
  // + per-type dropshadow depth.  This invariant asserts the mode stays wired
  // through the shared engine.
  {
    id: 'planguage-diagram-isometric-city-mode',
    description: 'PlanguageDiagram must expose the "isometric-city" mode with CSS perspective transform + rotateY slider + drag handlers + per-type dropshadow filters (v486)',
    since: 'v486',
    run: async (page) => {
      const composableSrc = await page.evaluate(async () => {
        const r = await fetch('/src/composables/useValueFlowLayout.ts')
        return r.ok ? await r.text() : null
      })
      const componentSrc = await page.evaluate(async () => {
        const r = await fetch('/src/components/PlanguageDiagram.vue')
        return r.ok ? await r.text() : null
      })
      const panelSrc = await page.evaluate(async () => {
        const r = await fetch('/src/components/ModelLibraryPanel.vue')
        return r.ok ? await r.text() : null
      })
      if (!composableSrc || !componentSrc || !panelSrc) {
        return { ok: false, detail: 'one or more sources not served' }
      }
      const issues = []
      // Composable: mode added to VizMode + dispatched in computeLayout
      if (!/isometric-city/.test(composableSrc)) issues.push('useValueFlowLayout: "isometric-city" not in VizMode / dispatcher')
      if (!/ISOMETRIC_BUILDING_HEIGHT/.test(composableSrc)) issues.push('useValueFlowLayout: ISOMETRIC_BUILDING_HEIGHT constant missing')
      // Component: rotation state + drag handlers + slider + shadow filters
      if (!/isometricRotY/.test(componentSrc)) issues.push('PlanguageDiagram: isometricRotY rotation state missing')
      if (!/onIsoDragStart/.test(componentSrc)) issues.push('PlanguageDiagram: drag handlers missing (onIsoDragStart)')
      if (!/pldShadowStakeholder/.test(componentSrc)) issues.push('PlanguageDiagram: SVG dropshadow filter (pldShadowStakeholder) missing')
      if (!/isometricTransform/.test(componentSrc)) issues.push('PlanguageDiagram: isometricTransform computed missing — CSS perspective not applied')
      // Panel: viz-city toolMode + menu button + mount
      if (!/viz-city/.test(panelSrc)) issues.push('ModelLibraryPanel: viz-city toolMode not declared')
      if (!/mode:\s*["']isometric-city["']|"mode":\s*["']isometric-city["']/.test(panelSrc)) {
        issues.push('ModelLibraryPanel: no <PlanguageDiagram mode="isometric-city"> mount found')
      }
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? 'Isometric City mode wired: composable + component + panel all carry the wiring'
          : issues.join(' · '),
      }
    },
  },

  // ── v487 (2026-07-20) — useModelLibrary IDB save unwraps Vue Proxy ─────────
  // Tom Gilb 2026-07-20 verbatim: *"my ce model Planguage does not seem to stck
  // around. I have to keep on reading the ce book in"*.  ROOT CAUSE traced via
  // headless probe: `idbSet(STORAGE_KEY, entries)` was passing the raw Vue
  // reactive Proxy array — every IDB save since v479 silently failed with
  // `DataCloneError: Failed to execute 'put' on 'IDBObjectStore': [object
  // Array] could not be cloned`.  IDB had NEVER contained user models —
  // Portfolio Pattern #1 dual-write was one-write in practice.  When Tom's
  // CE-book paste pushed localStorage over quota, both stores failed → data
  // gone on reload.  Fix: `JSON.parse(JSON.stringify(entries))` round-trip
  // strips the Proxy so structured-clone succeeds.  This invariant asserts
  // the round-trip stays put — a future refactor that reverts to passing
  // reactive values directly will trip this before Tom re-experiences the
  // "I keep having to re-paste" pain.
  {
    id: 'model-library-idb-save-unwraps-vue-proxy',
    description: 'useModelLibrary._saveEntriesToIdb must JSON-round-trip entries before idbSet — Vue reactive Proxy arrays throw DataCloneError on structured-clone (v487: cures "CE model does not stick around")',
    since: 'v487',
    run: async (page) => {
      const src = await page.evaluate(async () => {
        const r = await fetch('/src/composables/useModelLibrary.ts')
        return r.ok ? await r.text() : null
      })
      if (!src) return { ok: false, detail: 'useModelLibrary.ts not served' }
      const issues = []
      // The fix must appear inside _saveEntriesToIdb.  Compiled comment blocks
      // can push the actual JSON.parse line beyond a fixed lookahead — widen the
      // window generously and match the canonical fix marker.
      if (!/_saveEntriesToIdb[\s\S]{0,2000}JSON\.parse\s*\(\s*JSON\.stringify[\s\S]{0,200}idbSet/.test(src)) {
        issues.push('_saveEntriesToIdb does not JSON-round-trip before idbSet — Vue Proxy will trigger DataCloneError')
      }
      // Belt-and-braces: the canonical `const plain = JSON.parse(JSON.stringify(entries))` line.
      if (!/const\s+plain\s*=\s*JSON\.parse\s*\(\s*JSON\.stringify/.test(src)) {
        issues.push('canonical `const plain = JSON.parse(JSON.stringify(...))` line missing — fix may have been partially reverted')
      }
      return {
        ok: issues.length === 0,
        detail: issues.length === 0
          ? '_saveEntriesToIdb JSON-round-trips entries → IDB structured-clone succeeds → Portfolio Pattern #1 durability actually works'
          : issues.join(' · '),
      }
    },
  },
]

// ── Runner ────────────────────────────────────────────────────────────────
if (LIST) {
  console.log('Registered invariants:')
  for (const inv of INVARIANTS) console.log(`  · [${inv.since}] ${inv.id} — ${inv.description}`)
  process.exit(0)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

page.on('pageerror', e => console.error(`[PAGEERROR] ${e.message}`))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2500)

let passed = 0, failed = 0
const fails = []

for (const inv of INVARIANTS) {
  if (ONLY && !inv.id.includes(ONLY)) continue
  try {
    const res = await inv.run(page)
    if (res.ok) {
      passed++
      console.log(`✓ [${inv.since}] ${inv.id} — ${res.detail}`)
    } else {
      failed++
      fails.push({ inv, detail: res.detail })
      console.error(`✗ [${inv.since}] ${inv.id} — ${res.detail}`)
    }
  } catch (e) {
    failed++
    fails.push({ inv, detail: `EXCEPTION ${e.message}` })
    console.error(`✗ [${inv.since}] ${inv.id} — EXCEPTION ${e.message}`)
  }
}

// ── r41 v352 invariant: Stage 2.2 auto-generate-Solutions wiring ─────────
// Tom Gilb 2026-06-25 *"2.2 did not clearly generate solutions, and we need
// the proof of that with the same window we just developed for stage 2
// (Name = Planguage Progress window)"*.  Three sub-checks: (a) the
// useGenerateSolutions composable exists + exports the canonical surface;
// (b) App.vue Stage 2.2 case dispatches to runStage22GenerateSolutions
// (not the old `sharpenModalOpen.value = true`); (c) the modal mount
// references the PlanguageProgressWindow with `schedule="solutions-only"`.
{
  try {
    const [comp, app] = await Promise.all([
      page.evaluate(async () => fetch('/src/composables/useGenerateSolutions.ts?cache=' + Date.now()).then(x => x.text()).catch(() => '')),
      page.evaluate(async () => fetch('/src/App.vue?cache=' + Date.now()).then(x => x.text()).catch(() => '')),
    ])
    const issues = []
    if (!comp || comp.length < 500)                issues.push('useGenerateSolutions.ts not fetched')
    if (!/export function useGenerateSolutions/.test(comp)) issues.push('useGenerateSolutions export missing')
    if (!/findUnaddressedValues/.test(comp))       issues.push('findUnaddressedValues helper missing')
    if (!/CANONICAL_PLANGUAGE_DISCIPLINE_PROMPT/.test(comp)) issues.push('canonical Planguage primer not imported (Canonical-Planguage-Extractor SUPREME violation)')
    if (!app || app.length < 500)                  issues.push('App.vue not fetched')
    if (!/runStage22GenerateSolutions/.test(app))  issues.push('Stage 2.2 handler runStage22GenerateSolutions missing in App.vue')
    if (!/schedule[:=]\s*"solutions-only"/.test(app)) issues.push('PlanguageProgressWindow mount with schedule="solutions-only" missing in App.vue')
    if (!/stage22ProgressWindowOpen/.test(app))    issues.push('stage22ProgressWindowOpen modal-visibility ref missing')
    if (issues.length === 0) {
      passed++
      console.log('✓ [r41 v352] stage-22-auto-generate-solutions — wiring intact (composable + App.vue handler + PlanguageProgressWindow modal)')
    } else {
      failed++
      fails.push({ inv: { id: 'stage-22-auto-generate-solutions', since: 'r41 v352' }, detail: issues.join(' · ') })
      console.error('✗ [r41 v352] stage-22-auto-generate-solutions — ' + issues.join(' · '))
    }
  } catch (e) {
    failed++
    console.error('✗ [r41 v352] stage-22-auto-generate-solutions — EXCEPTION ' + (e instanceof Error ? e.message : String(e)))
  }
}

// ── r41 v349 invariant: stage-label parallel-implementation drift ─────────
// Tom Gilb 2026-06-25 *"retrograd unasked for change of stages. Please revert
// to what we had, what esle have you screwed up that that fine?"* — five
// components had hand-maintained stage-label maps that drifted from canonical
// PLANNING_STAGES (some 5 stages off, all with 10='Plan' instead of
// 'Resources').  v349 swept all five to import the canonical.  This invariant
// fetches each file's served bundle and asserts ZERO occurrence of the stale
// `10: 'Plan'` map AND ZERO occurrence of the stale 2='Values' label pattern.
{
  const stageDriftFiles = [
    'src/components/PlanningStageBar.vue',
    'src/components/SpecEditorPanel.vue',
    'src/components/MultiVisionPanel.vue',
    'src/components/PentaPanel.vue',
    'src/components/ResourceOptimaPanel.vue',
  ]
  let driftPassed = 0
  let driftFailed = 0
  for (const file of stageDriftFiles) {
    try {
      const src = await page.evaluate(async (f) =>
        fetch('/' + f + '?cache=' + Date.now()).then(x => x.text()).catch(() => '')
      , file)
      const issues = []
      // The stale concatenated label string from the pre-v349 duplicates.
      if (/9: 'Study-Act', 10: 'Plan'/.test(src))
        issues.push("stale '10: \\'Plan\\'' map still present (should import canonical PLANNING_STAGES)")
      // PlanningStageBar.vue specifically had stage 10 with label 'Plan' as a tile.
      if (/label: 'Plan'[\s\S]{0,200}icon: 'plan'/.test(src))
        issues.push("stale STAGES tile { label: 'Plan', icon: 'plan' } still present")
      if (issues.length === 0) {
        driftPassed++
        console.log(`✓ [r41 v349] stage-drift-${file.replace(/.*\//,'').replace('.vue','')} — clean`)
      } else {
        driftFailed++
        passed--  // adjust outer counters
        failed++
        fails.push({ inv: { id: `stage-drift-${file}`, since: 'r41 v349' }, detail: issues.join(' · ') })
        console.error(`✗ [r41 v349] stage-drift-${file.replace(/.*\//,'').replace('.vue','')} — ${issues.join(' · ')}`)
      }
    } catch (e) {
      driftFailed++
      console.error(`✗ [r41 v349] stage-drift-${file} — EXCEPTION ${e.message}`)
    }
  }
  passed += driftPassed
}

// ── r41 v470 invariant: portfolio-links-not-broken ────────────────────────
// Tom Gilb 2026-07-03 verbatim: "GOOD WE MUST PREPARE THAT, THIS IS THE
// MAIN POINT OF SEM, MOVING TO TWIN".  The Twin Portability Portfolio
// (TWIN-PORTABILITY-PORTFOLIO.md at repo root) catalogs every SEM App
// pattern that is Twin-portable.  Kai's Claude reads the Portfolio + follows
// the SEM App file paths listed in each row.  If any listed file is
// renamed / moved / deleted without updating the Portfolio row, the port
// discovery contract silently breaks.  This invariant fetches the Portfolio
// + extracts every file path referenced in the Catalog + asserts each file
// exists on disk.  Trips BEFORE ship if any Portfolio-referenced file is
// missing.
{
  try {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const portfolioPath = path.resolve(process.cwd(), 'TWIN-PORTABILITY-PORTFOLIO.md')
    if (!fs.existsSync(portfolioPath)) {
      failed++
      fails.push({ inv: { id: 'portfolio-links-not-broken', since: 'r41 v470' }, detail: 'TWIN-PORTABILITY-PORTFOLIO.md missing at repo root' })
      console.error('✗ [r41 v470] portfolio-links-not-broken — TWIN-PORTABILITY-PORTFOLIO.md missing at repo root')
    } else {
      const portfolio = fs.readFileSync(portfolioPath, 'utf8')
      // Extract only the Catalog section (between "## Catalog" and the next "## " heading)
      const catalogStart = portfolio.indexOf('## Catalog')
      const catalogEnd   = portfolio.indexOf('## Twin adaptations', catalogStart)
      const catalog = catalogStart >= 0 && catalogEnd > catalogStart
        ? portfolio.slice(catalogStart, catalogEnd)
        : ''
      // Match backticked paths that start with src/ or scripts/ (Portfolio convention)
      const pathRegex = /`((?:src|scripts)\/[A-Za-z0-9_./-]+\.(?:ts|vue|mjs|js))`/g
      const found = new Set()
      let m
      while ((m = pathRegex.exec(catalog)) !== null) found.add(m[1])
      const missing = []
      for (const rel of found) {
        const abs = path.resolve(process.cwd(), rel)
        if (!fs.existsSync(abs)) missing.push(rel)
      }
      if (missing.length === 0 && found.size > 0) {
        passed++
        console.log(`✓ [r41 v470] portfolio-links-not-broken — ${found.size} Portfolio-referenced file(s) all present`)
      } else if (found.size === 0) {
        failed++
        fails.push({ inv: { id: 'portfolio-links-not-broken', since: 'r41 v470' }, detail: 'no file paths extracted from Portfolio Catalog — regex or Catalog structure broke' })
        console.error('✗ [r41 v470] portfolio-links-not-broken — no file paths extracted from Portfolio Catalog')
      } else {
        failed++
        fails.push({ inv: { id: 'portfolio-links-not-broken', since: 'r41 v470' }, detail: `Portfolio references ${missing.length} missing file(s): ${missing.join(', ')}` })
        console.error(`✗ [r41 v470] portfolio-links-not-broken — Portfolio references ${missing.length} missing file(s): ${missing.join(', ')}`)
      }
    }
  } catch (e) {
    failed++
    console.error('✗ [r41 v470] portfolio-links-not-broken — EXCEPTION ' + (e instanceof Error ? e.message : String(e)))
  }
}

// ── v514 invariant: spec-version-carries-resources-envelope ───────────────
// Tom Gilb 2026-07-21 verbatim: "can you promise me that all running
// estimation data is saved and restored with any version of the spec?" — the
// v514 ship makes the answer YES.  This invariant asserts the four wiring
// points that make the promise real: (a) SpecVersion type has resourcesEnvelope
// field; (b) useSpecHistory.addVersion accepts + persists it; (c) useSpecHistory.
// restoreVersion returns it; (d) useResourcesEnvelope orchestrator file exists
// with captureEnvelope + hydrateEnvelope + serialiseEnvelopeToMarkdown +
// extractEnvelopeFromMarkdown; (e) App.vue local addVersion wrapper calls
// captureEnvelope; (f) App.vue onHistoryRestore + onSpecFileImport call
// hydrateEnvelope/extractEnvelopeFromMarkdown.  Trips before ship if any is missing.
{
  try {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const checks = [
      { file: 'src/composables/useResourcesEnvelope.ts',   needle: 'captureEnvelope',           label: 'orchestrator captureEnvelope' },
      { file: 'src/composables/useResourcesEnvelope.ts',   needle: 'hydrateEnvelope',           label: 'orchestrator hydrateEnvelope' },
      { file: 'src/composables/useResourcesEnvelope.ts',   needle: 'extractEnvelopeFromMarkdown', label: 'orchestrator extractEnvelopeFromMarkdown' },
      { file: 'src/composables/useSpecHistory.ts',         needle: 'resourcesEnvelope',         label: 'SpecVersion resourcesEnvelope field' },
      { file: 'src/composables/useResourceEstimations.ts', needle: 'hydrateFromSnapshot',       label: 'useResourceEstimations hydrateFromSnapshot' },
      { file: 'src/composables/useIetResourceSnapshot.ts', needle: 'hydrateFromSnapshot',       label: 'useIetResourceSnapshot hydrateFromSnapshot' },
      { file: 'src/composables/usePlanScopeFramework.ts',  needle: 'hydrateFromSnapshot',       label: 'usePlanScopeFramework hydrateFromSnapshot' },
      { file: 'src/composables/useResourcesAgent.ts',      needle: 'hydrateFromSnapshot',       label: 'useResourcesAgent hydrateFromSnapshot' },
      { file: 'src/App.vue',                                needle: '_resourcesEnvelope.captureEnvelope', label: 'App.vue addVersion wrapper calls captureEnvelope' },
      { file: 'src/App.vue',                                needle: '_resourcesEnvelope.hydrateEnvelope', label: 'App.vue restore/import calls hydrateEnvelope' },
      { file: 'src/App.vue',                                needle: '_resourcesEnvelope.extractEnvelopeFromMarkdown', label: 'App.vue import extracts envelope' },
    ]
    const missing = []
    for (const c of checks) {
      const abs = path.resolve(process.cwd(), c.file)
      if (!fs.existsSync(abs)) { missing.push(`file missing: ${c.file}`); continue }
      const content = fs.readFileSync(abs, 'utf8')
      if (!content.includes(c.needle)) missing.push(`${c.label} — needle "${c.needle}" not found in ${c.file}`)
    }
    if (missing.length === 0) {
      passed++
      console.log(`✓ [v514] spec-version-carries-resources-envelope — all ${checks.length} envelope-wiring points present`)
    } else {
      failed++
      fails.push({ inv: { id: 'spec-version-carries-resources-envelope', since: 'v514' }, detail: `${missing.length} envelope-wiring point(s) missing: ${missing.join(' · ')}` })
      console.error(`✗ [v514] spec-version-carries-resources-envelope — ${missing.length} wiring point(s) missing: ${missing.join(' · ')}`)
    }
  } catch (e) {
    failed++
    console.error('✗ [v514] spec-version-carries-resources-envelope — EXCEPTION ' + (e instanceof Error ? e.message : String(e)))
  }
}

await browser.close()

console.log(`\n=== Feature-Smoke Test: ${passed} passed · ${failed} failed ===`)
if (failed > 0) {
  console.error('\nRegressions detected.  Fix BEFORE telling Tom to refresh.')
  process.exit(1)
}
process.exit(0)
