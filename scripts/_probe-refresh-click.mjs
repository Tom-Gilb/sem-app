import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(2000)

// Find the Refresh button via aria-label
const probe = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /^Refresh —/.test(b.getAttribute('aria-label') || ''))
  if (!btn) return { found: false }
  const r = btn.getBoundingClientRect()
  // What's at the centre of the button?
  const cx = Math.round(r.left + r.width / 2)
  const cy = Math.round(r.top + r.height / 2)
  const topEl = document.elementFromPoint(cx, cy)
  const isBlocked = topEl !== btn && !btn.contains(topEl)
  // Style check
  const cs = getComputedStyle(btn)
  return {
    found: true,
    btnText: (btn.textContent || '').trim().slice(0, 40),
    rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
    pointerEvents: cs.pointerEvents,
    disabled: btn.disabled,
    topElAtCentre: topEl ? `${topEl.tagName.toLowerCase()}.${(topEl.className || '').toString().slice(0, 80)}` : null,
    blockedByOverlap: isBlocked,
  }
})
console.log(JSON.stringify(probe, null, 2))
console.log('--- console errors ---')
console.log(errs.length ? errs.slice(0, 10).join('\n') : '(none)')
await browser.close()
