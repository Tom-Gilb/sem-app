#!/usr/bin/env node
/**
 * scripts/trace-white-bar.mjs
 *
 * Tom Gilb 2026-06-23: "uppermost there is a white bar obscuring the top text,
 * maybe associated with scroll?"  Resume-the-trace investigation.
 *
 * Opens the SEM App in headless Chromium, seeds a Tom-shaped session, opens
 * the Role Agent, then dumps:
 *   1. Bounding boxes of every fixed/absolute element with z-index >= 100
 *   2. Computed style + bounding box of the Role Agent panel outer container
 *   3. Computed style + bounding box of the panel's header band
 *   4. Bounding box of any element at coordinates (panel-center-x, panel-top-y - 8)
 *      — i.e. what's painting at the very top of the modal
 *   5. Screenshot of the top 200px of the modal area
 */

import { chromium } from 'playwright'

const APP = 'http://localhost:5173'

const tomShapedSession = {
  version: 2,
  savedAt: new Date().toISOString(),
  stage: 1,
  planningStage: 1,
  currentSpec: {
    plan: { name: 'API Reliability Hardening', version: '0.1' },
    values: [
      { id: 'API Latency', description: 'API p99 latency under load', scale: 'milliseconds', goal: '50', wishStakeholder: 'Engineering Team' },
      { id: 'Defect Rate', description: 'Production defects per month', scale: 'defects/month', goal: '<5', wishStakeholder: 'Engineering Team Lead' },
    ],
    functions: [],
    solutions: [],
    constraints: [],
    resources: [],
    stakeholderEntries: [],
  },
  markdown: '',
  originalInput: null,
  confirmedSteps: [],
  evoPlanConfirmed: false,
  tasksByStep: {},
  capturedImpactMatrix: {},
  capturedVCRatios: {},
  capturedCalendarCosts: {},
  capturedCapitalCosts: {},
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

console.log('— Seeding Tom-shaped session...')
await page.goto(APP, { waitUntil: 'domcontentloaded' })
await page.evaluate((session) => {
  localStorage.setItem('sem-app-session-v2', JSON.stringify(session))
}, tomShapedSession)

console.log('— Reloading with seeded session...')
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

console.log('— Triggering Role Agent open (Step 1: click AgentsStrip Roles pin)...')
const step1 = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  const roles = btns.find(b =>
    (b.textContent || '').toLowerCase().includes('roles') ||
    (b.getAttribute('aria-label') || '').toLowerCase().includes('role'))
  if (!roles) return { ok: false, reason: 'no Roles pin found' }
  roles.click()
  return { ok: true, label: roles.textContent?.trim().slice(0, 50) }
})
console.log('  step1 result:', step1)
await page.waitForTimeout(500)

console.log('— DUMP all visible buttons after Roles pin click...')
const allBtns = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button'))
    .filter(b => {
      const r = b.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    .map(b => ({
      label: (b.textContent || '').trim().slice(0, 100),
      ariaLabel: b.getAttribute('aria-label')?.slice(0, 100) || '',
    }))
    .filter(b => b.label.length > 0 || b.ariaLabel.length > 0)
})
console.log('  Visible buttons (' + allBtns.length + ' total):')
for (const b of allBtns) console.log(`    "${b.label}" aria="${b.ariaLabel}"`)

console.log('\n— Step 2: try to find a button that opens the Role Agent panel directly...')
const step2 = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  // Find the tile with "principles" / "open" / "analysis" in label OR aria-label
  // (NOT "Q&A" / "Sharpening" / "Answer Questions" which open different panels)
  const tile = btns.find(b => {
    const t = (b.textContent || '').toLowerCase()
    const a = (b.getAttribute('aria-label') || '').toLowerCase()
    if (t.includes('answer') || t.includes('q&a') || t.includes('sharpening') || t.includes('questions')) return false
    if (a.includes('answer') || a.includes('q&a') || a.includes('sharpening') || a.includes('questions')) return false
    return (
      t.includes('analysis') ||
      t.includes('principles') ||
      t.includes('open role') ||
      a.includes('open role')
    )
  })
  if (!tile) return { ok: false, reason: 'no Open-Role-Agent tile found' }
  tile.click()
  return { ok: true, label: tile.textContent?.trim().slice(0, 80) }
})
console.log('  step2 result:', step2)
await page.waitForTimeout(800)

// Fallback: if no picker, set roleAgentOpen directly via the Vue instance
if (!step2.ok) {
  console.log('— Fallback: force-set roleAgentOpen.value = true via Vue inspection...')
  await page.evaluate(() => {
    // Try to find the Vue root and trigger the ref
    const root = document.querySelector('#app')?.__vue_app__
    if (!root) return false
    // Walk to find roleAgentOpen — this is best-effort; if it fails the next dump will show the actual state
    return true
  })
  await page.waitForTimeout(300)
}

console.log('\n=== 1. ALL FIXED / ABSOLUTE ELEMENTS WITH z-index >= 100 ===')
const fixed = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('*')) {
    const cs = window.getComputedStyle(el)
    if (cs.position !== 'fixed' && cs.position !== 'absolute') continue
    const z = parseInt(cs.zIndex, 10)
    if (isNaN(z) || z < 100) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 90),
      z,
      pos: cs.position,
      bg: cs.backgroundColor,
      x: Math.round(r.x), y: Math.round(r.y),
      w: Math.round(r.width), h: Math.round(r.height),
      ariaLabel: el.getAttribute('aria-label') || '',
    })
  }
  return out.sort((a, b) => b.z - a.z)
})
for (const f of fixed) {
  console.log(`  z=${f.z} ${f.pos} ${f.tag}.[${f.cls.slice(0,40)}...] at (${f.x},${f.y}) ${f.w}×${f.h} bg=${f.bg} aria="${f.ariaLabel}"`)
}

console.log('\n=== 2. ROLE AGENT PANEL OUTER + HEADER BOXES ===')
const panel = await page.evaluate(() => {
  const dlg = document.querySelector('[aria-label="Role Agent — analysis output"]')
  if (!dlg) return { ok: false, reason: 'Role Agent dialog not in DOM' }
  // Outer container
  const dlgRect = dlg.getBoundingClientRect()
  // Backdrop (sibling absolute)
  const backdrop = dlg.querySelector('.absolute.inset-0')
  // Panel surface (the white rounded card)
  const surface = dlg.querySelector('.relative.bg-white') ||
                   dlg.querySelector('[class*="rounded-2xl"][class*="bg-white"]')
  const surfaceRect = surface ? surface.getBoundingClientRect() : null
  // Header band (cyan gradient)
  const header = surface
    ? surface.querySelector('[class*="from-indigo-700"], [class*="bg-gradient-to-r"]')
    : null
  const headerRect = header ? header.getBoundingClientRect() : null
  return {
    ok: true,
    dialog: { x: Math.round(dlgRect.x), y: Math.round(dlgRect.y), w: Math.round(dlgRect.width), h: Math.round(dlgRect.height) },
    surface: surfaceRect ? { x: Math.round(surfaceRect.x), y: Math.round(surfaceRect.y), w: Math.round(surfaceRect.width), h: Math.round(surfaceRect.height) } : null,
    header: headerRect ? { x: Math.round(headerRect.x), y: Math.round(headerRect.y), w: Math.round(headerRect.width), h: Math.round(headerRect.height) } : null,
    surfaceClass: surface ? surface.className.toString().slice(0, 200) : null,
    headerClass: header ? header.className.toString().slice(0, 200) : null,
  }
})
console.log(JSON.stringify(panel, null, 2))

console.log('\n=== 3. WHAT IS AT panel-top-y - 8px ? ===')
if (panel.ok && panel.surface) {
  const probeX = panel.surface.x + Math.round(panel.surface.w / 2)
  const probeY = Math.max(0, panel.surface.y - 8)
  console.log(`  Probing (${probeX}, ${probeY}) — 8px above panel-surface top edge:`)
  const hit = await page.evaluate(({ x, y }) => {
    const stack = document.elementsFromPoint(x, y).slice(0, 8)
    return stack.map(el => {
      const cs = window.getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 80),
        bg: cs.backgroundColor,
        z: cs.zIndex,
        pos: cs.position,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      }
    })
  }, { x: probeX, y: probeY })
  for (let i = 0; i < hit.length; i++) {
    console.log(`    ${i}: ${hit[i].tag}.[${hit[i].cls}] bg=${hit[i].bg} z=${hit[i].z} pos=${hit[i].pos} (${hit[i].x},${hit[i].y}) ${hit[i].w}×${hit[i].h}`)
  }
}

console.log('\n=== 4. PROBE AT panel-surface-top-y + 4px (INSIDE the panel) ===')
if (panel.ok && panel.surface) {
  const probeX = panel.surface.x + Math.round(panel.surface.w / 2)
  const probeY = panel.surface.y + 4
  console.log(`  Probing (${probeX}, ${probeY}) — 4px inside panel-surface top edge:`)
  const hit = await page.evaluate(({ x, y }) => {
    const stack = document.elementsFromPoint(x, y).slice(0, 8)
    return stack.map(el => {
      const cs = window.getComputedStyle(el)
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 80),
        bg: cs.backgroundColor,
        z: cs.zIndex,
        pos: cs.position,
      }
    })
  }, { x: probeX, y: probeY })
  for (let i = 0; i < hit.length; i++) {
    console.log(`    ${i}: ${hit[i].tag}.[${hit[i].cls}] bg=${hit[i].bg} z=${hit[i].z} pos=${hit[i].pos}`)
  }
}

console.log('\n=== 5. SPEC TITLE ANCHOR PRESENCE + BOX ===')
const sta = await page.evaluate(() => {
  const candidates = document.querySelectorAll('[class*="top-2 left-3"], [class*="top-2 left-1/2"]')
  const out = []
  for (const el of candidates) {
    const r = el.getBoundingClientRect()
    const cs = window.getComputedStyle(el)
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 120),
      z: cs.zIndex,
      pos: cs.position,
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      text: (el.textContent || '').trim().slice(0, 60),
    })
  }
  return out
})
console.log(JSON.stringify(sta, null, 2))

console.log('\n=== 6. SCREENSHOT TOP 240px OF PANEL ===')
if (panel.ok && panel.surface) {
  await page.screenshot({
    path: '/tmp/role-agent-top.png',
    clip: {
      x: Math.max(0, panel.surface.x - 4),
      y: Math.max(0, panel.surface.y - 24),
      width: Math.min(panel.surface.w + 8, 1440),
      height: 240,
    },
  })
  console.log('  → /tmp/role-agent-top.png')
}

await browser.close()
console.log('\n✓ Trace complete.')
