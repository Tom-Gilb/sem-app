/**
 * Provenance-flash diag v8 — instrument the page with a manual console.log
 * inside startEdit + flashSourceForChip to see WHAT actually runs on each
 * chip click.  Uses Vue DevTools-like introspection via the global instance.
 *
 * Strategy: monkey-patch `console.log` to capture, then wrap a click in
 * specific timing checks.
 */
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()
const logs = []
page.on('console', msg => {
  if (msg.type() === 'log') logs.push('LOG: ' + msg.text())
  if (msg.type() === 'error') logs.push('ERR: ' + msg.text())
})
page.on('pageerror', e => logs.push('PAGEERR: ' + e.message))

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

// Probe: BEFORE clicking any chip, check container + flash state
const before = await page.evaluate(() => {
  const c = document.querySelector('div.overflow-y-auto.leading-relaxed')
  return {
    containerExists: !!c,
    chipCount: document.querySelectorAll('button[aria-label^="Edit stakeholder: "]').length,
    yellows: document.querySelectorAll('.bg-yellow-300').length,
  }
})
console.log('BEFORE:', JSON.stringify(before))

// Use exact click coordinates via the chip button.  Use mouse.click instead of
// element.click in case there are event-handling differences.
async function clickByText(t) {
  const btn = page.locator(`button[aria-label="Edit stakeholder: ${t}"]`).first()
  const box = await btn.boundingBox()
  if (!box) return null
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  return box
}

console.log('\n--- click 1: President of the contractor ---')
const b1 = await clickByText('President of the contractor')
await new Promise(r => setTimeout(r, 600))
const after1 = await page.evaluate(() => {
  const ys = document.querySelectorAll('.bg-yellow-300')
  const editingInput = document.querySelector('input[aria-label="Edit stakeholder"]')
  return {
    yellows: ys.length,
    yellowText: ys[0]?.textContent?.substring(0, 60),
    editingInputPresent: !!editingInput,
    editingInputValue: editingInput?.value,
  }
})
console.log('  after click 1:', JSON.stringify(after1))

console.log('\n--- click 2: Secretary of the Navy ---')
// click outside first to commit/blur the edit input?
const b2 = await clickByText('Secretary of the Navy')
await new Promise(r => setTimeout(r, 600))
const after2 = await page.evaluate(() => {
  const ys = document.querySelectorAll('.bg-yellow-300')
  const editingInput = document.querySelector('input[aria-label="Edit stakeholder"]')
  return {
    yellows: ys.length,
    yellowText: ys[0]?.textContent?.substring(0, 60),
    editingInputPresent: !!editingInput,
    editingInputValue: editingInput?.value,
  }
})
console.log('  after click 2:', JSON.stringify(after2))

console.log('\n--- click 3: Crew ---')
const b3 = await clickByText('Crew')
await new Promise(r => setTimeout(r, 600))
const after3 = await page.evaluate(() => {
  const ys = document.querySelectorAll('.bg-yellow-300')
  const editingInput = document.querySelector('input[aria-label="Edit stakeholder"]')
  return {
    yellows: ys.length,
    yellowText: ys[0]?.textContent?.substring(0, 60),
    editingInputPresent: !!editingInput,
    editingInputValue: editingInput?.value,
  }
})
console.log('  after click 3:', JSON.stringify(after3))

if (logs.length) {
  console.log('\n=== BROWSER LOGS ===')
  logs.slice(0, 10).forEach(l => console.log('  ' + l.substring(0, 200)))
}

await browser.close()
