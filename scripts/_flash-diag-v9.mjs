/**
 * Provenance-flash diag v9 — use the CORRECT aria-label prefixes:
 *   stakeholders → "Edit stakeholder:"
 *   values       → "Edit goal:"  (NOT "Edit value:")
 *   means        → "Edit strategy:" (NOT "Edit mean:")
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
page.on('pageerror', e => errors.push('PAGE_ERROR: ' + e.message))

await page.goto('http://localhost:5173/')
await page.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

const ta = page.locator('textarea').first()
const SOURCE = [
  'President of the contractor, Secretary of the Navy, the Crew',
  '|',
  'high quality of construction, low cost of materials, completion by 1931',
  '|',
  'modular construction, standardized components, inventory tracking after every voyage',
].join('\n')
await ta.fill(SOURCE)
await new Promise(r => setTimeout(r, 400))
await page.locator('button:has-text("Parse my input")').first().click()
await new Promise(r => setTimeout(r, 1200))

const groups = await page.evaluate(() => {
  const out = { stakeholder: [], goal: [], strategy: [] }
  for (const b of document.querySelectorAll('button[aria-label]')) {
    const a = b.getAttribute('aria-label') || ''
    const m = /^Edit (stakeholder|goal|strategy): (.+)$/.exec(a)
    if (m) out[m[1]].push(m[2])
  }
  return out
})
console.log('CHIPS:', JSON.stringify(groups, null, 2))

async function clickAndProbe(prefix, item) {
  const aria = `Edit ${prefix}: ${item}`
  const btn = page.locator(`button[aria-label="${aria.replace(/"/g, '\\"')}"]`).first()
  if (await btn.count() === 0) return { err: 'not found' }
  await btn.click({ force: true })
  await new Promise(r => setTimeout(r, 500))
  return await page.evaluate(() => {
    const ys = document.querySelectorAll('.bg-yellow-300')
    return {
      n: ys.length,
      text: ys[0]?.textContent?.substring(0, 60) || null,
    }
  })
}

const seq = [
  ['stakeholder', groups.stakeholder[0]],
  ['goal',        groups.goal[0]],
  ['strategy',    groups.strategy[0]],
  ['stakeholder', groups.stakeholder[1]],
  ['goal',        groups.goal[1]],
  ['strategy',    groups.strategy[1]],
  ['stakeholder', groups.stakeholder[2]],
  ['goal',        groups.goal[2]],
  ['strategy',    groups.strategy[2]],
].filter(([_, item]) => item)

for (let i = 0; i < seq.length; i++) {
  const [prefix, item] = seq[i]
  const r = await clickAndProbe(prefix, item)
  const target = item?.substring(0, 50)
  console.log(`[${i}] ${prefix.padEnd(11)} ${target?.padEnd(50)} → ${JSON.stringify(r)}`)
}

if (errors.length) {
  console.log('\n=== ERRORS ===')
  errors.slice(0, 5).forEach(e => console.log('  •', e.substring(0, 250)))
}

await browser.close()
