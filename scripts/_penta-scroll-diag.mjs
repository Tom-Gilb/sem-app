import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1700, height: 1000 } })
const p = await ctx.newPage()
await p.goto('http://localhost:5173/')
await p.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

// Inject a fake spec into localStorage so PentaPanel has content
await p.evaluate(() => {
  // PentaPanel needs an active spec — set the canonical key
  const fakeSpec = {
    name: 'Test', plannerName: '', scribeName: '', stakes: '', ends: '', means: '',
    functions: Array.from({length: 10}).map((_, i) => ({ id: `F.Test${i}`, type: 'Function', level: 'Solution', status: 'NotProduction', description: `Function ${i}`, presenceTest: '', successCriteria: '' })),
    values:    Array.from({length: 10}).map((_, i) => ({ id: `V.Test${i}`, type: 'Value', level: 'Solution', status: 'NotProduction', description: `Value ${i}`, scale: 's', meter: 'm', tolerable: 't', goal: 'g' })),
    solutions: Array.from({length: 10}).map((_, i) => ({ id: `S.Test${i}`, type: 'Solution', level: 'Solution', status: 'NotProduction', description: `Solution ${i}`, derivedFrom: '', function: '', impact: '' })),
    constraints: [], resources: [], stakeholderEntries: [],
  }
  localStorage.setItem('sem-app:current-spec', JSON.stringify(fakeSpec))
})
await p.reload()
await p.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

// Find + click any Penta-opening button
const candidates = ['button:has-text("Penta")', 'button[aria-label*="Penta"]', 'button[title*="Penta"]']
let opened = false
for (const sel of candidates) {
  const btn = p.locator(sel).first()
  if (await btn.count() > 0 && await btn.isVisible()) {
    await btn.click({ force: true })
    opened = true
    console.log('opened via', sel)
    break
  }
}
if (!opened) console.log('No Penta button visible; trying ⚡Actions menu')
await new Promise(r => setTimeout(r, 1500))

// Find the right pane (the v316 r93t-fallback element)
const probe = await p.evaluate(() => {
  // The r93t fallback element: flex-1 min-h-0 overflow-y-auto border-l border-slate-200 p-5 space-y-4
  const candidates = document.querySelectorAll('.flex-1.min-h-0.overflow-y-auto')
  const results = []
  for (const el of candidates) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    results.push({
      tag: el.tagName,
      cls: el.className.substring(0, 80),
      w: Math.round(r.width),
      h: Math.round(r.height),
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      scrollable: el.scrollHeight > el.clientHeight + 2,
    })
  }
  return results
})
console.log('overflow-y-auto candidates:', JSON.stringify(probe, null, 2))
await p.screenshot({ path: '/tmp/penta-scroll.png', fullPage: false })
await b.close()
