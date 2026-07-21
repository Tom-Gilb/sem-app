import { chromium } from 'playwright'
const b = await chromium.launch({ headless: true })
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } })
const p = await ctx.newPage()
p.on('pageerror', e => console.log('PAGEERR:', e.message))
p.on('console', m => { if (m.type() === 'error') console.log('ERR:', m.text().substring(0,200)) })

// Inject a real spec — match the canonical storage shape
await p.addInitScript(() => {
  const spec = {
    name: 'Diag', plannerName: '', scribeName: '', stakes: '', ends: '', means: '',
    functions:   Array.from({length: 10}).map((_, i) => ({ id: `F.Func${i}`, type: 'Function', level: 'Solution', status: 'NotProduction', description: `Function ${i}`, presenceTest: '', successCriteria: '' })),
    values:      Array.from({length: 10}).map((_, i) => ({ id: `V.Val${i}`, type: 'Value', level: 'Solution', status: 'NotProduction', description: `Value ${i}`, scale: 'units', meter: 'count', tolerable: '1', goal: '5', wish: '10' })),
    solutions:   Array.from({length: 10}).map((_, i) => ({ id: `S.Sol${i}`, type: 'Solution', level: 'Solution', status: 'NotProduction', description: `Solution ${i}`, derivedFrom: `[[V.Val${i}]]`, function: `[[F.Func${i}]]`, impact: '' })),
    constraints: [], resources: [], stakeholderEntries: [],
    sharpenRounds: 0, manualEditCount: 0,
  }
  // Try several canonical storage keys
  localStorage.setItem('sem-app:current-spec', JSON.stringify(spec))
  localStorage.setItem('currentSpec', JSON.stringify(spec))
  // SpecModel canonical storage
  const model = { name:'Diag', id:'diag-1', spec, plannerName:'', scribeName:'', sharpenRounds:0, manualEditCount:0, createdAt:Date.now(), updatedAt:Date.now() }
  localStorage.setItem('sem-app:active-spec-id', 'diag-1')
  localStorage.setItem('sem-app:specs:v1', JSON.stringify([model]))
})

await p.goto('http://localhost:5173/')
await p.waitForLoadState('networkidle')
await new Promise(r => setTimeout(r, 1500))

// Find Penta Model button
const pentaBtn = p.locator('button:has-text("Penta Model")').first()
console.log('Penta Model button count:', await pentaBtn.count())
if (await pentaBtn.count() > 0) {
  await pentaBtn.click({ force: true })
  await new Promise(r => setTimeout(r, 1500))
} else {
  // Try Actions menu
  const actions = p.locator('button:has-text("Actions")').first()
  if (await actions.count() > 0) {
    await actions.click({ force: true })
    await new Promise(r => setTimeout(r, 500))
    const pentaInMenu = p.locator('button:has-text("Penta")').first()
    if (await pentaInMenu.count() > 0) await pentaInMenu.click({ force: true })
    await new Promise(r => setTimeout(r, 1500))
  }
}

await p.screenshot({ path: '/tmp/penta1.png', fullPage: false })

const probe = await p.evaluate(() => {
  // Look for the fixed inset-0 z-[595] container (PentaPanel root)
  const root = document.querySelector('.fixed.inset-0.z-\\[595\\]')
  if (!root) return { rootFound: false }
  // Find all overflow-y-auto descendants
  const overflowEls = root.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"]')
  const results = []
  for (const el of overflowEls) {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    results.push({
      tag: el.tagName,
      cls: el.className.substring(0, 100),
      w: Math.round(r.width),
      h: Math.round(r.height),
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      computedOverflowY: cs.overflowY,
      computedHeight: cs.height,
      scrollable: el.scrollHeight > el.clientHeight + 2,
    })
  }
  return { rootFound: true, candidates: results }
})
console.log('PROBE:', JSON.stringify(probe, null, 2))

if (probe.rootFound && probe.candidates.length > 0) {
  const target = probe.candidates.find(c => /border-l/.test(c.cls)) || probe.candidates[0]
  console.log('TARGET:', target.cls.substring(0, 60))
  // Try scrolling
  const scrollResult = await p.evaluate(() => {
    const el = document.querySelector('.fixed.inset-0.z-\\[595\\] .flex-1.min-h-0.overflow-y-auto.border-l') ||
               document.querySelector('.fixed.inset-0.z-\\[595\\] [class*="overflow-y-auto"]')
    if (!el) return { error: 'target not found' }
    const before = el.scrollTop
    el.scrollTop = 200
    return { before, after: el.scrollTop, scrollH: el.scrollHeight, clientH: el.clientHeight }
  })
  console.log('SCROLL TEST:', JSON.stringify(scrollResult))
}

await b.close()
