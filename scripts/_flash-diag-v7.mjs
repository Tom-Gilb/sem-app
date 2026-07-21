/**
 * Provenance-flash diag v7 — use pipe-shorthand "S | V | M" to force all 3
 * chip groups, then test chip click → yellow highlight per group.
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
// Pipe shorthand triggers 3-group parse.  Each item is verbatim in source so
// substring match should fire instantly.  Source spans multiple lines so the
// container has multiple data-line-idx entries.
const SOURCE = [
  'President of the contractor, Secretary of the Navy, the Crew',
  '|',
  'high quality of construction, low cost of materials, completion by 1931',
  '|',
  'modular construction, standardized components, inventory tracking after every voyage',
].join('\n')
await ta.fill(SOURCE)
await new Promise(r => setTimeout(r, 400))

const parse = page.locator('button:has-text("Parse my input")').first()
await parse.click()
await new Promise(r => setTimeout(r, 1200))

const post = await page.evaluate(() => {
  const groups = { stakeholder: [], value: [], mean: [] }
  for (const b of document.querySelectorAll('button[aria-label]')) {
    const a = b.getAttribute('aria-label') || ''
    const m = /^Edit (stakeholder|value|mean): (.+)$/.exec(a)
    if (m) groups[m[1]].push(m[2])
  }
  return groups
})
console.log('CHIPS:', JSON.stringify(post, null, 2))

async function clickChipAndProbe(label) {
  const btn = page.locator(`button[aria-label="${label.replace(/"/g, '\\"')}"]`).first()
  if (await btn.count() === 0) return { error: 'not found' }
  await btn.click({ force: true })
  await new Promise(r => setTimeout(r, 400))
  return await page.evaluate(() => {
    const ys = document.querySelectorAll('.bg-yellow-300')
    return {
      yellows: ys.length,
      text: ys[0]?.textContent?.substring(0, 60) || null,
    }
  })
}

// Click 1st of each group, then 2nd of each, to test sequence + cross-group
const tests = []
if (post.stakeholder[0]) tests.push(`Edit stakeholder: ${post.stakeholder[0]}`)
if (post.value[0])       tests.push(`Edit value: ${post.value[0]}`)
if (post.mean[0])        tests.push(`Edit mean: ${post.mean[0]}`)
if (post.stakeholder[1]) tests.push(`Edit stakeholder: ${post.stakeholder[1]}`)
if (post.value[1])       tests.push(`Edit value: ${post.value[1]}`)
if (post.mean[1])        tests.push(`Edit mean: ${post.mean[1]}`)
if (post.mean[2])        tests.push(`Edit mean: ${post.mean[2]}`)

for (let i = 0; i < tests.length; i++) {
  const r = await clickChipAndProbe(tests[i])
  console.log(`[${i}] ${tests[i].substring(0, 70).padEnd(70)} → ${JSON.stringify(r)}`)
}

await page.screenshot({ path: '/tmp/flash-diag-7.png', fullPage: true })

if (errors.length) {
  console.log('\n=== ERRORS ===')
  errors.slice(0, 5).forEach(e => console.log('  •', e.substring(0, 250)))
}

await browser.close()
