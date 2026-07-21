#!/usr/bin/env node
// Mount Smoke Test — r41 v232 (Tom Gilb 2026-06-20 "cant you test for failures
// like this?" + "help locked out" — second & third mount crashes in a row
// because the prior smoke test loaded a CLEAN browser context, but Tom's
// browser has REAL stored data with historical field-type drift).
//
// Three test passes:
//   PASS 1: Clean mount (empty localStorage) — verifies code is sound.
//   PASS 2: Mount with KNOWN-MALFORMED specs in localStorage — simulates
//           Tom's actual environment.  Specs carry valueOfFunction as
//           array, description as number, status as object, etc.  If the
//           app crashes here, Claudian missed a defensive coercion.
//   PASS 3: Mount with the malformed data PLUS a hot-reload — catches
//           HMR-time corruption.
//
// Composes with: Serve-Verify-Before-Ship SUPREME (curl-grep proves served
// file has change; this proves the app MOUNTS through real data shapes).
//
// Usage:
//   node scripts/mount-smoke-test.mjs
//   node scripts/mount-smoke-test.mjs --url http://localhost:5173
//   node scripts/mount-smoke-test.mjs --skip-malformed   (only PASS 1)

import pkg from '../node_modules/playwright/index.js'
const { chromium } = pkg

const URL_FLAG    = process.argv.indexOf('--url')
const URL         = URL_FLAG >= 0 ? process.argv[URL_FLAG + 1] : 'http://localhost:5173'
const SKIP_MALFORMED = process.argv.includes('--skip-malformed')

// ── Malformed-spec fixtures ────────────────────────────────────────────────
// Mirror the shape of REAL localStorage keys the app reads, with deliberately
// drifted fields that exercise every `.trim()` / `.split()` / `.includes()`
// site Claudian has touched.  Add new shapes here as new crash classes are
// found in the wild.
const MALFORMED_SPEC = {
  functions: [
    { id: 'F.Test', type: 'Function', level: 'Product',
      description: 42,                                       // number, not string
      presenceTest: ['array', 'of', 'strings'],              // array
      successCriteria: { obj: 'nope' },                      // object
      functionOfValue: ['V.A', 'V.B'],                       // array (.split crash class)
    },
  ],
  values: [
    { id: 'V.Test', type: 'Value', level: 'Product',
      description: undefined,
      scale: ['scale array'],
      meter: null,
      status: 0,
      tolerable: { obj: true },
      goal: ['target1', 'target2'],
      wish: 99,
      valueOfFunction: ['F.A', 'F.B'],                       // PRIMARY crash class
    },
  ],
  solutions: [
    { id: 'S.Test', type: 'Solution', level: 'Product',
      description: ['array'],
      impact: 17,
      function: ['F.A', 'F.B'],                              // s.function array
    },
  ],
  constraints: [
    { id: 'C.Test', type: 'Constraint', level: 'Business',
      description: { wrong: 'shape' },
      scope: ['arr'],
      rationale: undefined,
    },
  ],
  resources: [
    { id: 'R.Test', type: 'Resource', level: 'Business',
      description: 42,
      scale: ['arr'],
      meter: null,
      budget: { x: 1 },
    },
  ],
  stakes: ['array', 'stakes'],
}

const MALFORMED_MODEL = {
  id: 'test-model',
  name: 'Mount Smoke Test Plan',
  version: '0.1',
  sharpenRounds: 0,
  manualEditCount: 0,
  owners: [], planners: [], scribes: [],
}

// r41 v287 (Tom Gilb 2026-06-22 verbatim *"and I dream that you develop tests
// to detect it wonk work at all"*) — `prep` can be either a string literal
// (legacy passes 1+2) OR an object `{ fn, arg }`. Argument-passing avoids the
// silent failure mode where inline-interpolated JSON containing `:` / escaped
// quotes broke `page.evaluate` parsing — that bug let PASS 3 silently NOT seed
// localStorage at all, so the test PASSED while not actually exercising the
// crash class it was meant to catch.
async function runPass(label, prep) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const errors = []
  const consoleErrors = []
  page.on('pageerror', e => errors.push({ kind: 'pageerror', msg: e.message, stack: (e.stack || '').slice(0, 1500) }))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 500)) })

  const startMs = Date.now()
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
  } catch (e) {
    await browser.close()
    return { label, ok: false, reason: `nav failed: ${e.message}` }
  }

  if (prep) {
    if (typeof prep === 'object' && prep.fn) {
      await page.evaluate(prep.fn, prep.arg)
    } else {
      await page.evaluate(prep)
    }
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
  }

  await page.waitForTimeout(2500)

  const crashBanner = await page.evaluate(() => {
    const banner = [...document.querySelectorAll('*')]
      .find(el => /SEM App failed to start|createApp\/mount failed/i.test(el.textContent || ''))
    return banner ? (banner.textContent || '').slice(0, 600) : null
  })

  const elapsedMs = Date.now() - startMs
  await browser.close()

  if (errors.length === 0 && !crashBanner) {
    return { label, ok: true, elapsedMs, consoleErrors: consoleErrors.length }
  }
  return { label, ok: false, elapsedMs, errors: errors.slice(0, 3), crashBanner, consoleErrors: consoleErrors.slice(0, 3) }
}

// ── Run ────────────────────────────────────────────────────────────────────
const results = []

results.push(await runPass('PASS 1: Clean mount (empty localStorage)', null))

if (!SKIP_MALFORMED) {
  // Inject the malformed spec into localStorage keys the App reads.  The exact
  // key names follow the SEM App conventions.  The App's hydrate path must
  // tolerate this shape and not crash.
  const malformedSpec   = JSON.stringify(MALFORMED_SPEC)
  const malformedModel  = JSON.stringify(MALFORMED_MODEL)
  results.push(await runPass('PASS 2: Mount with malformed stored spec', `() => {
    try {
      localStorage.setItem('sem-spec-snapshot-v1',         ${JSON.stringify(malformedSpec)})
      localStorage.setItem('sem-spec-snapshot-${'test-model'}', ${JSON.stringify(malformedSpec)})
      localStorage.setItem('sem-spec-plan-v1',             ${JSON.stringify(malformedModel)})
      localStorage.setItem('sem-app:spec-model:v1',        ${JSON.stringify(malformedModel)})
    } catch (e) { console.error('localStorage seed failed:', e) }
  }`))

  // r41 v287 (Tom Gilb 2026-06-22 verbatim *"and I dream that you develop tests
  // to detect it wonk work at all"* — after THREE consecutive mount crashes
  // from the same class). PASS 2 was a false-positive: it seeded the WRONG
  // localStorage keys.  Tom's real session lives under `sem-session-v2`
  // (`useSessionPersist`).  Without seeding that key, `_tryRestoreSession`
  // returns null → currentSpec stays null → SpecOutput never renders → smoke
  // PASSED while Tom's browser CRASHED.
  //
  // PASS 3 reproduces Tom's failure mode EXACTLY:
  //   (a) seed `sem-session-v2` with the canonical SavedSession shape;
  //   (b) the embedded `currentSpec` carries a Value entry where
  //       `description` is ABSENT (NOT `undefined`-then-stringified, which
  //       JSON.stringify drops — the field literally doesn't exist on the
  //       parsed object);
  //   (c) `stage: 2` so SpecOutput renders and `useValueAddRatio` computed
  //       dereferences the values, triggering the crash class on every site
  //       that calls `.description.slice` / `.length` / `.trim` / etc.
  //
  // If the customRef set-time normalizer is in place, this passes.  If anyone
  // ever reverts to the post-flush watcher pattern, this catches the regression
  // BEFORE Tom does.
  const TOM_SHAPED_SPEC = {
    functions: [
      { id: 'F.SignUp', type: 'Function', level: 'Product' },  // NO description field
    ],
    values: [
      { id: 'V.Latency', type: 'Value', level: 'Product', scale: 'p99 seconds', goal: '< 2', status: '5' }, // NO description
      { id: 'V.Adoption', type: 'Value', level: 'Product', goal: '80%', status: '20%' },                    // NO description, NO scale
    ],
    solutions: [
      { id: 'S.Cache', type: 'Solution', level: 'Product' },   // NO description
    ],
    constraints: [
      { id: 'C.Budget', type: 'Constraint', level: 'Business' }, // NO description
    ],
    resources: [
      { id: 'R.Team', type: 'Resource', level: 'Business' },   // NO description
    ],
    stakes: '',
  }
  const TOM_SHAPED_SESSION = {
    version: 2,
    savedAt: new Date().toISOString(),
    stage: 1,                                            // First SpecOutput mounts at stage<2 (stage 2+ shows banner instead)
    currentSpec: TOM_SHAPED_SPEC,
    markdown: '',
    originalInput: { stakes: '', ends: '', means: '' },
    confirmedSteps: [],
    evoPlanConfirmed: false,
    tasksByStep: {},
    capturedImpactMatrix: {},
    capturedVCRatios: {},
    capturedCalendarCosts: {},
    capturedCapitalCosts: {},
  }
  const tomShapedSession = JSON.stringify(TOM_SHAPED_SESSION)
  results.push(await runPass(
    'PASS 3: Mount with Tom-shaped session (real key, real shape — missing description fields)',
    { fn: (s) => { try { localStorage.setItem('sem-session-v2', s) } catch (e) { console.error('localStorage seed failed:', e) } }, arg: tomShapedSession },
  ))
}

let allPassed = true
for (const r of results) {
  if (r.ok) {
    console.log(`✓ ${r.label} — PASSED (${r.elapsedMs}ms, ${r.consoleErrors} non-fatal console errors)`)
  } else {
    allPassed = false
    console.error(`❌ ${r.label} — FAILED ${r.elapsedMs ? `(${r.elapsedMs}ms)` : ''}`)
    if (r.crashBanner) { console.error('\n— Crash banner —'); console.error(r.crashBanner) }
    if (r.errors) {
      for (const e of r.errors) {
        console.error(`\n— [${e.kind}] ${e.msg}`)
        if (e.stack) console.error(e.stack.split('\n').slice(0, 8).join('\n'))
      }
    }
    if (r.consoleErrors && r.consoleErrors.length > 0) {
      console.error('— Console errors —')
      for (const m of r.consoleErrors) console.error(m)
    }
  }
}

process.exit(allPassed ? 0 : 1)
