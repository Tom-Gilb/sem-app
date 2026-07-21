// Teaching Poster v3 — 4K widescreen (3840 × 2160) matching Keynote 16:9 slide.
// Tom flagged v2 was leaving whitespace in Keynote — this fills edge-to-edge with
// much bigger fonts.  Per SUPREME rule "Exploit Screen Size Fully" (2026-07-08).
//
// Run: cd /Users/Tomgilbs/Developer/sem-app && node scripts/build-teaching-poster-v3.mjs
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const OUT = '/Users/Tomgilbs/Documents/MyVault/5 - Project/Planguage Logic book';
const W = 3840, H = 2160;                       // 4K widescreen, matches Keynote 16:9
const SCALE = 2;                                // 2× retina for the PNG output

// Card layout constants
const HEADER_H = 130;
const TIER_H   = (H - HEADER_H - 15) / 6;       // ~338 per tier band
const CARD_H   = TIER_H - 25;                   // ~313 tall cards
const HEAD_BAR = 65;                            // colored top band inside card
const FORM_BAR = 90;                            // formula band

// tier palette
const T = {
  T1: { d:'#1e3a8a', l:'#dbeafe', bg:'#eff6ff', name:'FOUNDATIONS' },
  T2: { d:'#6b21a8', l:'#ede9fe', bg:'#f5f3ff', name:'TYPES &amp; DEFINITIONS' },
  T3: { d:'#9a3412', l:'#ffedd5', bg:'#fff7ed', name:'IMPACTS &amp; ESTIMATION' },
  T4: { d:'#155e75', l:'#cffafe', bg:'#ecfeff', name:'FEEDBACK &amp; MEASUREMENT' },
  T5: { d:'#065f46', l:'#d1fae5', bg:'#ecfdf5', name:'BALANCE · PRIORITY · TRADE-OFF' },
  T6: { d:'#5b21b6', l:'#ede9fe', bg:'#f5f3ff', name:'LEARNING &amp; EVOLUTION' },
};

// ============ 30 CARDS ============
// gloss is an array of tspan-lines; use HTML <b> for bold within a line
const CARDS = {
  // T6 · Learning & Evolution (6 cards)
  13: { tier:'T6', color:'#065f46', bg:'#d1fae5', title:'Improvement Delta',
        f1:'Δ = Future Level − Past', f2:'Δ = FL − Past, at Confidence',
        gloss:['<b>Improvement</b> is the measured delta between',
               'the planned Future Level and the Past baseline.',
               'No Past = no Improvement, only a starting Level.',
               'Inherits Confidence from Eq.9 &amp; Eq.10.'] },
  26: { tier:'T6', color:'#3730a3', bg:'#e0e7ff', title:'Learning Monotonicity',
        f1:'Spec(t+1) ⊇ Spec(t)', f2:'Qualifiers(t+1) ⊇ Qualifiers(t)',
        gloss:['Across Evo Steps the Spec grows <b>richer</b>: more',
               'Qualifiers, tighter σ, more Values named. Learning',
               'ADDS precision — silent Spec loss violates Eq.20',
               'and No-Silent-Data-Loss.'] },
  16: { tier:'T6', color:'#0f766e', bg:'#ccfbf1', title:'MVP Decomposition',
        f1:'∀ Sol ∃ MVP ⊂ Sol : E(MVP) > E(Sol)', f2:'the earliest Evo Step is the highest-E slice',
        gloss:['For every Solution there is a smaller subset (MVP)',
               'with <b>higher Efficiency</b> — it drops the low-Value /',
               'high-Cost tail. Ship the MVP first; Eq.4 decides',
               'the next slice.'] },
  27: { tier:'T6', color:'#92400e', bg:'#fef3c7', title:'Reversibility of Evo',
        f1:'∀ Evo : Rev(Evo)', f2:'rollback if Meter reads &lt; Threshold',
        gloss:['Every Evo Step must be designed <b>reversible</b>.',
               'Un-reversible steps are <b>gambles</b>, not experiments —',
               'one bad move locks the plan. A Hypothesis you',
               'cannot retract is a superstition.'] },
  17: { tier:'T6', color:'#991b1b', bg:'#fee2e2', title:'Cumulative Risk',
        f1:'Accept(Evo_n) ⇏ Accept(Σ Evos)', f2:'RiskΣ = 1 − ∏(1 − Riskᵢ)',
        gloss:['Per-step safety does NOT imply cumulative safety.',
               'Ten steps each <b>90% safe</b> = only <b>35% safe</b> overall.',
               'Test cumulative Risk at every step, not just',
               'per-step Risk.'] },
  20: { tier:'T6', color:'#86198f', bg:'#fae8ff', title:'System Evolution',
        f1:'Sys(t+1) = Sys(t) + L(Evo)', f2:'L = Learning gained from one Evo cycle',
        gloss:['System at t+1 = System at t plus what one Evo cycle',
               'taught (or un-taught). Recursive across the',
               '<b>lifetime of the System of Concern</b>. Export is an',
               'entry to Evo, not an end of Evo.'] },

  // T5 · Balance · Priority · Trade-off (7 cards)
  8:  { tier:'T5', color:'#b45309', bg:'#fef3c7', title:'Constraint Boundaries',
        f1:'Solution ⊆ Constraints', f2:'Sol ⊆ K',
        gloss:['Every Solution lives inside every',
               'Constraint. Break one → plan is',
               '<b>invalid</b>, no matter how good the',
               'Values look. Constraints are boundaries,',
               'not preferences.'] },
  3:  { tier:'T5', color:'#065f46', bg:'#d1fae5', title:'Balanced Efficiency',
        f1:'Efficiency = Values ÷ Costs', f2:'E = {V} ÷ {C}',
        gloss:['Set of Values ÷ Set of Costs.',
               'Plural on both sides — real systems',
               'have many of each. Best design',
               'maximises <b>E across the whole set</b>',
               'at once.'] },
  30: { tier:'T5', color:'#86198f', bg:'#fae8ff', title:'Cost of Delay',
        f1:'V(t) = V₀ × decay(t)', f2:'CoD = |dV/dt|',
        gloss:['Value delivered <b>now</b> beats same',
               'Value delivered <b>later</b>. The window',
               'closes, competitors arrive. High-CoD',
               'Values earn Priority (Eq.14) and',
               'pull MVP order (Eq.16).'] },
  14: { tier:'T5', color:'#1e3a8a', bg:'#dbeafe', title:'Priority from Power',
        f1:'P(V) = Σₛ Pw(S) × W(V,S)', f2:'Stakeholder Power × Value Importance',
        gloss:['Priority is not a gut feel — it is',
               '<b>who has Power</b> (budget · veto ·',
               'authority) times <b>how much they</b>',
               '<b>care</b>, summed over Stakeholders.',
               'Feeds the P in Eq.10.'] },
  9:  { tier:'T5', color:'#065f46', bg:'#d1fae5', title:'Reasonable Balance',
        f1:'((V±σᵥ) ≥ G) ∧ ((C±σ𝒸) ≤ Bud)', f2:'at Confidence Conf',
        gloss:['Values (with σ) reach Goals AND',
               'Costs (with σ) stay in Budgets, at',
               'chosen Confidence. Conservative:',
               'even <b>V − σ</b> ≥ Goal AND <b>C + σ</b> ≤ Bud.',
               'Only actual Evo delivery proves it.'] },
  10: { tier:'T5', color:'#831843', bg:'#fce7f3', title:'Priority-Weighted T-off',
        f1:'T = max(P × V ÷ C × Conf)', f2:'V=μ±σᵥ · C=μ±σ𝒸 · Conf=1−Risk',
        gloss:['When Values conflict, winner is',
               'highest <b>P × V ÷ C</b>, honestly discounted',
               'by <b>σ</b> (wider = less trustworthy) and',
               '<b>Risk</b>. Never pick the flashy',
               'point-estimate winner.'] },
  21: { tier:'T5', color:'#e11d48', bg:'#ffe4e6', title:'Stakeholder Conflict',
        f1:'V(S₁) ⊥ V(S₂) → Trade-off', f2:'conflict resolved by Eq.10',
        gloss:['Different Stakeholders want',
               'incompatible Values (User: speed ·',
               'Ops: stability · Finance: low cost).',
               'Conflict is <b>normal</b>. Denying =',
               'plan that betrays a Stakeholder.'] },

  // T4 · Feedback & Measurement (4 cards)
  25: { tier:'T4', color:'#155e75', bg:'#cffafe', title:'No Value without Meter',
        f1:'Real(V) ↔ ∃ Meter that reads its Scale', f2:'Real(V) ↔ Meas(V)',
        gloss:['A Value is <b>real</b> if and only if a Meter exists that',
               'reads its Scale. No Meter → no feedback → no Eq.4',
               '(Velocity of Learning) → no Eq.18 (Termination).',
               'Un-measurable "Values" are Wishes wearing a Value mask.'] },
  11: { tier:'T4', color:'#334155', bg:'#f1f5f9', title:'Meter Honesty',
        f1:'Meter → Reading = Level ± ε', f2:'ε = measurement error inherent in the Meter (≠ σ)',
        gloss:['Every Meter reading is Level ± ε where ε is the Meter\'s',
               'own <b>measurement error</b> (calibration drift, sampling',
               'noise, observer variance). A Meter that claims zero error',
               'is lying. ε (measurement) is distinct from σ (estimation).'] },
  4:  { tier:'T4', color:'#155e75', bg:'#cffafe', title:'Velocity of Learning · Evo Cycle',
        f1:'Ship → Measure via Meter → Study → Act', f2:'Deming PDSA · M reads the Level',
        gloss:['Every Evo Step is one turn of the PDSA cycle. Measure',
               'uses the Meter defined for each Value. <b>Learning</b>',
               '<b>frequency beats planning cleverness</b> — Musk\'s Velocity',
               'of Learning.  Beating heart of the whole algebra.'] },
  18: { tier:'T4', color:'#5b21b6', bg:'#ede9fe', title:'Termination Criteria',
        f1:'Complete ↔ ∀ V : Meter(V) ≥ Goal(V)', f2:'every Value verified against its Goal',
        gloss:['Complete iff every Value\'s Meter reads at or above its',
               'Goal. <b>Not code shipped. Not tickets closed. Not budget</b>',
               '<b>spent</b>. Only Meter-verified Value delivery. Eq.9 says',
               '"plausible"; Eq.18 says "verified".'] },

  // T3 · Impacts & Estimation (5 cards)
  15: { tier:'T3', color:'#3730a3', bg:'#e0e7ff', title:'Design-as-Hypothesis',
        f1:'Sol ≡ Hypothesis, until Meter verifies', f2:'promoted from H when M(Reading) ≥ Goal',
        gloss:['Before shipping, every Solution is a <b>Hypothesis</b> —',
               'a testable guess about what will deliver the Values.',
               'It becomes a Solution (small-s) only after the Meter',
               'confirms. Naming pre-shipped work "Solution" smuggles',
               'unproven confidence into the plan.'] },
  5:  { tier:'T3', color:'#9a3412', bg:'#ffedd5', title:'Impact Estimation',
        f1:'Impact = Estimate ± Deviation', f2:'I = μ ± σ, with Evidence · Source · Credibility',
        gloss:['Every Impact is <b>Estimate ± Deviation</b> backed by',
               '<b>Evidence</b> (facts), a <b>Source</b> (URL, book+page,',
               'in-app-derived), and a <b>Credibility</b> rating (0.0-1.0).',
               '<b>Point-estimates lie</b>; backed ranges tell the truth.',
               'σ travels into Eq.9 &amp; Eq.10.'] },
  6:  { tier:'T3', color:'#7f1d1d', bg:'#fee2e2', title:'Multi-Attribute Reality',
        f1:'Solution → many Attributes (potentially every)', f2:'A = {Values, Costs, Functions, side-effects}',
        gloss:['A Solution touches <b>many</b> Attributes — Values, Costs,',
               'Functions, side-effects. <b>Potentially every</b> Attribute;',
               'usually many. The scan must cover every one even if the',
               'impact is zero for some. Estimating just one is',
               'knowingly incomplete.'] },
  12: { tier:'T3', color:'#9f1239', bg:'#ffe4e6', title:'Side Effects Reality',
        f1:'Impacts = Intended + Unintended', f2:'I = I_intended + U · U is never zero',
        gloss:['A Solution\'s total Impact = what it was designed to do',
               '(Intended) PLUS what it also does that nobody planned',
               '(Unintended <b>U</b> — the "side effects"). <b>U is never zero</b>.',
               'Estimating Intended only is knowingly incomplete.'] },
  29: { tier:'T3', color:'#115e59', bg:'#ccfbf1', title:'Sharpening reduces σ',
        f1:'σ(Sharpen(Spec)) &lt; σ(Spec)', f2:'Conf ↑ · add Qualifier · add Meter · add Source',
        gloss:['<b>Sharpening</b> a Spec — adding Qualifiers (Eq.7), naming',
               'a Meter (Eq.25), attaching E·S·Cr (Eq.5), pinning Owner',
               '(Eq.23) — shrinks σ and raises Confidence. The mechanism',
               'that makes Eq.9 &amp; Eq.10 trustworthy across Evo Steps.'] },

  // T2 · Types & Definitions (6 cards)
  22: { tier:'T2', color:'#075985', bg:'#e0f2fe', title:'F vs V: Binary vs Scalar',
        f1:'F ∈ {Present, Absent}', f2:'V ∈ ℝ (on Scale)',
        gloss:['A <b>Function</b> is BINARY — passes its Presence',
               'Test or does not. A <b>Value</b> is SCALAR — a',
               'Level on a Scale. "Fast search" is not a Function;',
               '"Search exists" is not a Value. The type',
               'distinction shapes every downstream algebra.'] },
  2:  { tier:'T2', color:'#4c1d95', bg:'#ede9fe', title:'Quantification',
        f1:'Value = Scale + Levels', f2:'{Past · Status · Tol · Goal · Wish · Stretch · Fail}',
        gloss:['A Value is a <b>Scale of measure</b> plus its',
               'numeric Levels. Nothing less counts as',
               'quantification. Meter is separate — belongs',
               'with Measurement (Eq.4), not with defining',
               'the Value.'] },
  7:  { tier:'T2', color:'#4c1d95', bg:'#ede9fe', title:'Qualifier Finiteness',
        f1:'Future Level = Level [Q]', f2:'Q = [when, where, who]',
        gloss:['Every Future Level is a Level under stated',
               'Qualifiers — <b>never bare</b>. Applies to Goal,',
               'Wish, Stretch, Must, Tolerable, Fail. No',
               'Qualifiers → infinite scope → infinite cost',
               '→ certain failure. The Infinity Trap.'] },
  24: { tier:'T2', color:'#6b21a8', bg:'#ede9fe', title:'Ambition Ladder',
        f1:'Amb ≥ Wish ≥ Stretch', f2:'≥ Goal ≥ Tolerable ≥ Fail',
        gloss:['On the same Scale, Future Levels form an',
               '<b>ordered ladder</b>: Ambition (vision) → Wish',
               '(dream) → Stretch → Goal (commitment) →',
               'Tolerable (floor) → Fail (project dead). Order',
               'is semantic, never rearrange.'] },
  28: { tier:'T2', color:'#991b1b', bg:'#fee2e2', title:'AND-Logic of Reqs',
        f1:'Valid ↔ ∧ᵣ Met(r)', f2:'Conjunction, never Average',
        gloss:['A plan is valid iff <b>EVERY</b> Requirement is',
               'met — AND-logic, not average. "8 of 10',
               'Goals hit" is NOT 80%; it is a plan with 2',
               'unmet Requirements = <b>INVALID</b>. Same for',
               'every Qualifier bracket.'] },
  19: { tier:'T2', color:'#92400e', bg:'#fef3c7', title:'Tag as Pure Pointer',
        f1:'Tag stable · Spec mutable', f2:'Tag(t₁) ≡ Tag(t₂); Spec(t₁) ≠ Spec(t₂)',
        gloss:['A Tag\'s job is to <b>POINT</b> to a spec that will',
               'change — including its Scale. Tags that mirror',
               'Scale or bake in the metric silently lie the',
               'moment the Spec evolves. Cross-cutting',
               'protection for every tier.'] },

  // T1 · Foundations (2 cards, wider)
  1:  { tier:'T1', color:'#1e3a8a', bg:'#dbeafe', title:'Stakeholder-Source',
        f1:'Requirement ← Stakeholder    ·    R ← S',
        f2:'every Requirement traces back to at least one Stakeholder',
        gloss:['Every Requirement is <b>sourced from</b> at least one Stakeholder. A requirement',
               'with no Stakeholder does not exist — it is a Wish looking for an owner.',
               'Bedrock of the whole algebra: everything above depends on this equation.'] },
  23: { tier:'T1', color:'#065f46', bg:'#d1fae5', title:'Value Ownership',
        f1:'∀ V : ∃ Owner ∈ Stakeholders    ·    ∀ V ∃ Own(V)',
        f2:'every Value has an accountable Owner — a named Stakeholder-Representative',
        gloss:['Every Value must name an <b>Owner</b> — a specific Stakeholder-Representative',
               'accountable for delivery. Without an Owner: no Commitment, so the Value is',
               'at best a Wish, not a Goal. Refines Eq.1 with named accountability.'] },
};

// tier ordering (from top of poster to bottom, layout order)
const LAYOUT = [
  { tier:'T6', ids:[13, 26, 16, 27, 17, 20],   yOff:0 },
  { tier:'T5', ids:[8, 3, 30, 14, 9, 10, 21],  yOff:1 },
  { tier:'T4', ids:[25, 11, 4, 18],            yOff:2 },
  { tier:'T3', ids:[15, 5, 6, 12, 29],         yOff:3 },
  { tier:'T2', ids:[22, 2, 7, 24, 28, 19],     yOff:4 },
  { tier:'T1', ids:[1, 23],                    yOff:5 },
];

// build the SVG
function buildSvg() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>
  .name  { font-family: -apple-system,SF Pro Text,Helvetica,Arial,sans-serif; font-size: 30px; font-weight: 800; fill: #ffffff; }
  .num   { font-family: SF Mono, Menlo, monospace; font-size: 34px; font-weight: 800; fill: #ffffff; text-anchor: middle; }
  .f1    { font-family: SF Mono, Menlo, monospace; font-size: 26px; font-weight: 700; }
  .f2    { font-family: SF Mono, Menlo, monospace; font-size: 20px; fill: #475569; }
  .g     { font-family: -apple-system,SF Pro Text,Helvetica,Arial,sans-serif; font-size: 23px; fill: #1e293b; }
  .g b   { font-weight: 800; }
  .h1    { font-family: -apple-system,SF Pro Text,Helvetica,Arial,sans-serif; font-size: 50px; font-weight: 800; fill: #ffffff; }
  .h2    { font-family: -apple-system,SF Pro Text,Helvetica,Arial,sans-serif; font-size: 24px; font-style: italic; fill: #cbd5e1; }
  .tier  { font-family: -apple-system,SF Pro Text,Helvetica,Arial,sans-serif; font-size: 24px; font-weight: 800; letter-spacing: 0.05em; }
</style>
`;
  // header
  s += `<rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="#0f172a"/>`;
  s += `<text x="${W/2}" y="60" text-anchor="middle" class="h1">Planguage Equations 1-30 — Teaching Poster</text>`;
  s += `<text x="${W/2}" y="100" text-anchor="middle" class="h2">Six tiers · foundations at bottom, learning at top · every card carries formula, letter form, and 2-3 sentences of teaching · Tom Gilb, Planguage Logic · 8 July 2026</text>`;
  // tier band backgrounds
  LAYOUT.forEach(row => {
    const y = HEADER_H + 15 + row.yOff * TIER_H;
    s += `<rect x="0" y="${y}" width="${W}" height="${TIER_H}" fill="${T[row.tier].bg}"/>`;
    s += `<text x="30" y="${y + 32}" class="tier" fill="${T[row.tier].d}">${row.tier} · ${T[row.tier].name}</text>`;
  });
  // cards
  LAYOUT.forEach(row => {
    const y = HEADER_H + 15 + row.yOff * TIER_H + 45;    // 45 offset so tier label sits above
    const cardCount = row.ids.length;
    // pick card width by tier
    let cardW, gap;
    if (row.tier === 'T1') { cardW = 1650; gap = 100; }
    else if (row.tier === 'T4') { cardW = 900; gap = 40; }
    else if (row.tier === 'T5') { cardW = 522; gap = 12; }
    else if (row.tier === 'T3') { cardW = 720; gap = 25; }
    else { cardW = 610; gap = 12; }              // T2, T6
    const totalW = cardCount * cardW + (cardCount - 1) * gap;
    const startX = (W - totalW) / 2;
    row.ids.forEach((id, i) => {
      const x = startX + i * (cardW + gap);
      const c = CARDS[id];
      const cardH = row.tier === 'T1' ? 220 : CARD_H - 45;
      s += cardSvg(x, y, cardW, cardH, id, c);
    });
  });
  s += `</svg>`;
  return s;
}

function cardSvg(x, y, w, h, id, c) {
  const glossY = HEAD_BAR + FORM_BAR + 45;
  const lineH = 32;
  let out = `<g transform="translate(${x},${y})">`;
  // outer white card with border
  out += `<rect width="${w}" height="${h}" rx="12" fill="#ffffff" stroke="${c.color}" stroke-width="2.5"/>`;
  // colored header band (rounded top corners)
  out += `<path d="M0,12 A12,12 0 0,1 12,0 L${w-12},0 A12,12 0 0,1 ${w},12 L${w},${HEAD_BAR} L0,${HEAD_BAR} Z" fill="${c.color}"/>`;
  // number in white circle
  out += `<circle cx="42" cy="${HEAD_BAR/2}" r="24" fill="#ffffff"/>`;
  out += `<text x="42" y="${HEAD_BAR/2 + 12}" class="num" fill="${c.color}">${id}</text>`;
  // title
  out += `<text x="80" y="${HEAD_BAR/2 + 10}" class="name">${c.title}</text>`;
  // formula band (light tint)
  out += `<rect x="0" y="${HEAD_BAR}" width="${w}" height="${FORM_BAR}" fill="${c.bg}"/>`;
  out += `<text x="20" y="${HEAD_BAR + 40}" class="f1" fill="${c.color}">${c.f1}</text>`;
  out += `<text x="20" y="${HEAD_BAR + 70}" class="f2">${c.f2}</text>`;
  // gloss (multi-line) — convert inline <b>…</b> to <tspan font-weight="800">…</tspan> for valid SVG
  c.gloss.forEach((ln, i) => {
    const svgLine = ln.replace(/<b>([^<]+)<\/b>/g, '<tspan font-weight="800">$1</tspan>');
    out += `<text x="20" y="${glossY + i * lineH}" class="g">${svgLine}</text>`;
  });
  out += `</g>`;
  return out;
}

const HTML_STYLE = `
  @page { size: 40in 22.5in; margin: 0; }
  @media print { body { padding: 0; } .no-print { display: none !important; } }
  body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', Helvetica, Arial, sans-serif; background: #ffffff; color: #1e293b; padding: 10px; line-height: 1.32; margin: 0; }
  .btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; font-size: 12px; font-weight: 700; color: #ffffff; background: #1e293b; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.15); }
  .btn:hover { background: #334155; }
  .btn.secondary { background: #64748b; }
  .btn.secondary:hover { background: #475569; }
  .btn.primary { background: #2563eb; }
  .btn.primary:hover { background: #1d4ed8; }
  .toolbar { margin: 0 auto 8px auto; padding: 7px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #334155; }
  .svg-wrap { background: #ffffff; border: 1px solid #e2e8f0; padding: 6px; overflow-x: auto; border-radius: 6px; }
  svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
`;
const HTML_SCRIPT = `
function svgToPngBlob(scale){scale=scale||2;const svg=document.querySelector('#diagram-block svg');const vb=svg.viewBox.baseVal;const w=vb.width,h=vb.height;const c=svg.cloneNode(true);c.setAttribute('xmlns','http://www.w3.org/2000/svg');c.setAttribute('width',w);c.setAttribute('height',h);const str=new XMLSerializer().serializeToString(c);const blob=new Blob([str],{type:'image/svg+xml;charset=utf-8'});const url=URL.createObjectURL(blob);return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const cv=document.createElement('canvas');cv.width=w*scale;cv.height=h*scale;const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(scale,scale);ctx.drawImage(img,0,0);URL.revokeObjectURL(url);cv.toBlob(resolve,'image/png');};img.onerror=reject;img.src=url;});}
function copyDiagramAsPNG(){const s=document.getElementById('copy-status');try{const p=svgToPngBlob(2);navigator.clipboard.write([new ClipboardItem({'image/png':p})]).then(()=>{s.textContent='✓ Copied as PNG — ⌘V in Keynote';s.style.color='#065f46';setTimeout(()=>{s.textContent='';},6000);}).catch(()=>{s.textContent='⚠ Blocked — use 💾 Download PNG';s.style.color='#991b1b';setTimeout(()=>{s.textContent='';},8000);});}catch(e){s.textContent='⚠ Build failed';s.style.color='#991b1b';}}
async function downloadDiagramAsPNG(){const b=await svgToPngBlob(2);const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download='Planguage-Teaching-Poster-v3-4K.png';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);document.getElementById('copy-status').textContent='✓ Downloaded — drag from Downloads into Keynote';document.getElementById('copy-status').style.color='#065f46';}
`;

const svg = buildSvg();
const svgPath  = path.join(OUT, 'Planguage-Equations-Teaching-Poster-v3-4K.svg');
const htmlPath = path.join(OUT, 'Planguage-Equations-Teaching-Poster-v3-4K.html');
const pngPath  = path.join(OUT, 'Planguage-Equations-Teaching-Poster-v3-4K.png');
fs.writeFileSync(svgPath, '<?xml version="1.0" encoding="UTF-8"?>\n' + svg);
fs.writeFileSync(htmlPath, `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Teaching Poster v3 · 4K widescreen</title><style>${HTML_STYLE}</style></head><body><div class="toolbar no-print"><b style="color:#0f172a;">Teaching Poster v3 · 4K widescreen (3840×2160)</b><span style="color:#052e16;background:#dcfce7;padding:3px 8px;border-radius:3px;font-size:11px;">Fits Keynote 16:9 slide edge-to-edge · body 23pt · title 50pt</span><div style="flex:1;"></div><button class="btn primary" onclick="copyDiagramAsPNG()" title="Rasterize the SVG to a 2× PNG and put it on the clipboard. Then ⌘V into Keynote / Slides / Pages / Word.">📋&nbsp;Copy&nbsp;as&nbsp;PNG</button><button class="btn secondary" onclick="downloadDiagramAsPNG()" title="Save PNG to Downloads.  Drag into Keynote if clipboard blocked.">💾&nbsp;Download&nbsp;PNG</button><button class="btn secondary" onclick="window.print()" title="Print or ⌘P.  Toolbar auto-hides in print.">🖨️&nbsp;Print</button><span id="copy-status" style="font-size:12px;color:#065f46;font-weight:700;"></span></div><div id="diagram-block"><div class="svg-wrap">${svg}</div></div><script>${HTML_SCRIPT}</script></body></html>`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
await page.setContent(`<html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;background:white;}</style></head><body>${svg}</body></html>`);
const buf = await page.screenshot({ omitBackground: false, clip: { x: 0, y: 0, width: W, height: H } });
fs.writeFileSync(pngPath, buf);
await browser.close();
console.log(`✓ Teaching Poster v3 (4K widescreen ${W}×${H}, ${SCALE}× PNG = ${W*SCALE}×${H*SCALE}, ${(buf.length/1024).toFixed(0)}kb)`);
