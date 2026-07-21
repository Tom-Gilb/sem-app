// Build 8 Planguage-Equations illustrations at 4K widescreen 3840×2160 (fills Keynote 16:9 slide).
// Per Tom's SUPREME rule "Exploit Screen Size Fully" (2026-07-08).
// v2: all arrows / markers / symbols DOUBLED in size for visibility.
// v2: σ Sankey · Radial Mind-Map · Fishbone all redesigned to eliminate overlaps.

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const OUT = '/Users/Tomgilbs/Documents/MyVault/5 - Project/Planguage Logic book';
const W = 3840, H = 2160;
const SCALE = 2;

const STYLE = `
  .h1 { font-family: -apple-system,SF Pro Text,Helvetica,Arial,sans-serif; font-size: 54px; font-weight: 800; fill: #ffffff; }
  .h2 { font-family: -apple-system,SF Pro Text,Helvetica,Arial,sans-serif; font-size: 26px; font-style: italic; fill: #cbd5e1; }
  .n  { font-family: SF Mono, Menlo, monospace; font-size: 32px; font-weight: 800; fill: #ffffff; text-anchor: middle; }
  .nm { font-family: -apple-system,SF Pro Text,Helvetica,Arial,sans-serif; font-size: 24px; font-weight: 800; fill: #0f172a; text-anchor: middle; }
  .f  { font-family: SF Mono, Menlo, monospace; font-size: 22px; font-weight: 700; text-anchor: middle; }
  .g  { font-family: -apple-system,SF Pro Text,Helvetica,Arial,sans-serif; font-size: 24px; fill: #1e293b; }
  .gb { font-weight: 800; }
  .foot { font-family: -apple-system,SF Pro Text,Helvetica,Arial,sans-serif; font-size: 24px; fill: #475569; }
`;

const T = {
  T1: { dark: '#1e3a8a', mid: '#3b82f6', light: '#dbeafe', bg: '#eff6ff', name: 'FOUNDATIONS' },
  T2: { dark: '#6b21a8', mid: '#a855f7', light: '#ede9fe', bg: '#f5f3ff', name: 'TYPES &amp; DEFINITIONS' },
  T3: { dark: '#9a3412', mid: '#f97316', light: '#ffedd5', bg: '#fff7ed', name: 'IMPACTS &amp; ESTIMATION' },
  T4: { dark: '#155e75', mid: '#06b6d4', light: '#cffafe', bg: '#ecfeff', name: 'FEEDBACK &amp; MEASUREMENT' },
  T5: { dark: '#065f46', mid: '#10b981', light: '#d1fae5', bg: '#ecfdf5', name: 'BALANCE · PRIORITY · TRADE-OFF' },
  T6: { dark: '#5b21b6', mid: '#8b5cf6', light: '#ede9fe', bg: '#f5f3ff', name: 'LEARNING &amp; EVOLUTION' },
};

const EQ = {
   1: { tier:'T1', label:'Src ← Stake',        title:'Stakeholder-Source' },
   2: { tier:'T2', label:'V = Scale + Levels', title:'Quantification' },
   3: { tier:'T5', label:'E = {V} ÷ {C}',      title:'Balanced Efficiency' },
   4: { tier:'T4', label:'Evo · PDSA',         title:'Velocity of Learning' },
   5: { tier:'T3', label:'I = μ ± σ + E·S·Cr', title:'Impact Estimation' },
   6: { tier:'T3', label:'Sol → many A',       title:'Multi-Attribute Reality' },
   7: { tier:'T2', label:'FL = Level [Q]',     title:'Qualifier Finiteness' },
   8: { tier:'T5', label:'Sol ⊆ K',            title:'Constraint Boundaries' },
   9: { tier:'T5', label:'B ± σ, at Conf',     title:'Reasonable Balance' },
  10: { tier:'T5', label:'T = max(P·V÷C·Conf)',title:'Priority-Weighted Trade-off' },
  11: { tier:'T4', label:'M → Level ± ε',      title:'Meter Honesty' },
  12: { tier:'T3', label:'I = I_int + U',      title:'Side Effects' },
  13: { tier:'T6', label:'Δ = FL − Past',      title:'Improvement Delta' },
  14: { tier:'T5', label:'P = Σ Pw × W',       title:'Priority from Power' },
  15: { tier:'T3', label:'Sol ≡ H',            title:'Design-as-Hypothesis' },
  16: { tier:'T6', label:'MVP ⊂ Sol',          title:'MVP Decomposition' },
  17: { tier:'T6', label:'RiskΣ',              title:'Cumulative Risk' },
  18: { tier:'T4', label:'Done ↔ ∀V M≥G',      title:'Termination' },
  19: { tier:'T2', label:'Tag stable',         title:'Tag as Pointer' },
  20: { tier:'T6', label:'Sys(t+1)',           title:'System Evolution' },
  21: { tier:'T5', label:'V(S₁) ⊥ V(S₂)',      title:'Stakeholder Conflict' },
  22: { tier:'T2', label:'F ∈ {P,A} · V ∈ ℝ',  title:'F vs V Type' },
  23: { tier:'T1', label:'∀V ∃ Owner',         title:'Value Ownership' },
  24: { tier:'T2', label:'Amb ≥ ... ≥ Fail',   title:'Ambition Ladder' },
  25: { tier:'T4', label:'Real(V) ↔ M',        title:'No V without M' },
  26: { tier:'T6', label:'Spec ⊇ Spec',        title:'Learning Monotonicity' },
  27: { tier:'T6', label:'Rev(Evo)',           title:'Reversibility' },
  28: { tier:'T2', label:'∧ᵣ Met(r)',          title:'AND-Logic' },
  29: { tier:'T3', label:'σ(Sharpen) ↓',       title:'Sharpening reduces σ' },
  30: { tier:'T5', label:'V(t) = V₀·decay',    title:'Cost of Delay' },
};

function header(title, sub) {
  return `
    <rect x="0" y="0" width="${W}" height="130" fill="#0f172a"/>
    <text x="${W/2}" y="70" text-anchor="middle" class="h1">${title}</text>
    <text x="${W/2}" y="110" text-anchor="middle" class="h2">${sub}</text>
  `;
}
function footer(y, txt) {
  return `
    <rect x="0" y="${y}" width="${W}" height="${H - y}" fill="#f8fafc"/>
    <text x="80" y="${y + 55}" class="foot">${txt}</text>
  `;
}
function eqNode(n, cx, cy, r) {
  const t = T[EQ[n].tier];
  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.dark}" stroke="#0f172a" stroke-width="3"/>
      <text x="${cx}" y="${cy + r*0.25}" class="n" font-size="${r*0.9}">${n}</text>
      <text x="${cx}" y="${cy + r + 34}" class="nm">${EQ[n].title}</text>
      <text x="${cx}" y="${cy + r + 62}" class="f" fill="${t.dark}">${EQ[n].label}</text>
    </g>
  `;
}

// wrap helper
function wrapText(s, maxChars) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ================================================================
// 1) EVO WHEEL
// ================================================================
function evoWheel() {
  const cx = W/2, cy = 1180;
  const rInner = 220, rMid = 500, rQuad = 900;
  const quads = [
    { name:'SHIP',    at: -Math.PI/2 - Math.PI/4, color:'#0f766e', tag:'Design the increment',      eqs:[15, 16, 6, 8, 27] },
    { name:'MEASURE', at: -Math.PI/2 + Math.PI/4, color:'#155e75', tag:'Read every Value',         eqs:[25, 11, 5, 22, 2] },
    { name:'STUDY',   at:  Math.PI/2 + Math.PI/4, color:'#065f46', tag:'Balance · Trade-off',      eqs:[9, 10, 3, 14, 21, 30, 17] },
    { name:'ACT',     at:  Math.PI/2 - Math.PI/4, color:'#5b21b6', tag:'Learn · adjust · evolve',  eqs:[13, 26, 20, 24, 7, 19, 23, 1, 28] },
  ];
  let arcs = '';
  quads.forEach((q, i) => {
    const start = q.at - Math.PI/4, end = q.at + Math.PI/4;
    const x1 = cx + rQuad * Math.cos(start), y1 = cy + rQuad * Math.sin(start);
    const x2 = cx + rQuad * Math.cos(end),   y2 = cy + rQuad * Math.sin(end);
    arcs += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${rQuad} ${rQuad} 0 0 1 ${x2} ${y2} Z" fill="${q.color}" fill-opacity="0.08" stroke="${q.color}" stroke-width="3" stroke-opacity="0.4"/>`;
  });
  let labels = '';
  quads.forEach(q => {
    const lx = cx + rMid * Math.cos(q.at), ly = cy + rMid * Math.sin(q.at);
    labels += `<g><rect x="${lx-260}" y="${ly-80}" width="520" height="150" rx="22" fill="${q.color}"/><text x="${lx}" y="${ly-10}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="58" font-weight="800" fill="#ffffff">${q.name}</text><text x="${lx}" y="${ly+40}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="26" fill="#e0f2fe">${q.tag}</text></g>`;
  });
  let sats = '';
  quads.forEach(q => {
    const count = q.eqs.length;
    q.eqs.forEach((eqn, i) => {
      const spread = (Math.PI/2) * 0.78;
      const a = q.at - spread/2 + (i/(count-1||1)) * spread;
      const sx = cx + rQuad * Math.cos(a), sy = cy + rQuad * Math.sin(a);
      sats += eqNode(eqn, sx, sy, 64);
      sats += `<line x1="${cx + rInner*Math.cos(a)}" y1="${cy + rInner*Math.sin(a)}" x2="${sx - 64*Math.cos(a)}" y2="${sy - 64*Math.sin(a)}" stroke="${q.color}" stroke-width="4" stroke-opacity="0.5" stroke-dasharray="9,7"/>`;
    });
  });
  const hub = `
    <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="#155e75" stroke="#0f172a" stroke-width="8"/>
    <text x="${cx}" y="${cy - 30}" text-anchor="middle" font-family="SF Mono, Menlo, monospace" font-size="130" font-weight="800" fill="#ffffff">4</text>
    <text x="${cx}" y="${cy + 50}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="30" font-weight="800" fill="#cffafe">Evo Cycle</text>
    <text x="${cx}" y="${cy + 88}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="22" fill="#a5f3fc">Deming PDSA</text>
    <text x="${cx}" y="${cy + 122}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="22" fill="#a5f3fc">Velocity of Learning</text>
  `;
  const rotR = rInner + 55;
  const rot = `
    <path d="M ${cx + rotR} ${cy} A ${rotR} ${rotR} 0 0 1 ${cx} ${cy + rotR}" stroke="#155e75" stroke-width="7" fill="none" marker-end="url(#arrEvo)"/>
    <path d="M ${cx} ${cy - rotR} A ${rotR} ${rotR} 0 0 1 ${cx + rotR} ${cy}" stroke="#155e75" stroke-width="7" fill="none" marker-end="url(#arrEvo)"/>
    <path d="M ${cx - rotR} ${cy} A ${rotR} ${rotR} 0 0 1 ${cx} ${cy - rotR}" stroke="#155e75" stroke-width="7" fill="none" marker-end="url(#arrEvo)"/>
    <path d="M ${cx} ${cy + rotR} A ${rotR} ${rotR} 0 0 1 ${cx - rotR} ${cy}" stroke="#155e75" stroke-width="7" fill="none" marker-end="url(#arrEvo)"/>
  `;
  return svgWrap(
    'The Evo Wheel — Eq.4 at the centre, PDSA quadrants radiating',
    'Ship · Measure · Study · Act — each of the 30 equations lives in the phase where it does its work',
    `<defs><marker id="arrEvo" markerWidth="20" markerHeight="20" refX="18" refY="6" orient="auto"><path d="M0,0 L0,12 L18,6 z" fill="#155e75"/></marker></defs>${arcs}${rot}${sats}${hub}${labels}`,
    'The Evo Cycle is the beating heart of the algebra. Every plan turn is one revolution: Ship a Hypothesis (Eq.15) as an MVP (Eq.16) inside Constraints (Eq.8) with reversibility (Eq.27); Measure via honest Meters (Eq.11, Eq.5) across every Attribute (Eq.6, Eq.22); Study the balance of Values vs Costs (Eq.9), the priority-weighted trade-off (Eq.10, Eq.14, Eq.30, Eq.21), and cumulative risk (Eq.17); Act by recording the Improvement Delta (Eq.13), monotonically enriching the Spec (Eq.26), evolving the System (Eq.20), keeping Ownership and Stakeholder alignment (Eq.1, Eq.23), verifying the AND-logic (Eq.28), and revising Levels under Qualifiers (Eq.7).  One cycle done, another begins.'
  );
}

// ================================================================
// 2) TRADE-OFF CONFLUENCE
// ================================================================
function tradeoffConfluence() {
  const cx = W/2, cy = 1180;
  const rings = [
    { r: 280, eqs: [3, 8, 9, 14, 21, 30] },
    { r: 540, eqs: [5, 15, 17, 29, 6, 12] },
    { r: 780, eqs: [22, 7, 24, 28, 11, 25, 4, 18] },
    { r: 960, eqs: [1, 23, 19, 2, 26, 20, 27, 13, 16] },
  ];
  let ringElements = '';
  rings.forEach(ring => {
    ringElements += `<circle cx="${cx}" cy="${cy}" r="${ring.r}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="10,10" opacity="0.6"/>`;
  });
  let arrows = '';
  rings.forEach(ring => {
    ring.eqs.forEach((eqn, i) => {
      const a = (i / ring.eqs.length) * 2 * Math.PI - Math.PI/2;
      const sx = cx + ring.r * Math.cos(a), sy = cy + ring.r * Math.sin(a);
      const dx = cx + (ring.r - 140) * Math.cos(a), dy = cy + (ring.r - 140) * Math.sin(a);
      const t = T[EQ[eqn].tier];
      arrows += `<line x1="${sx}" y1="${sy}" x2="${dx}" y2="${dy}" stroke="${t.dark}" stroke-width="3" stroke-opacity="0.5" marker-end="url(#arrConf)"/>`;
    });
  });
  let nodes = '';
  rings.forEach((ring, i) => {
    ring.eqs.forEach((eqn, j) => {
      const a = (j / ring.eqs.length) * 2 * Math.PI - Math.PI/2;
      const sx = cx + ring.r * Math.cos(a), sy = cy + ring.r * Math.sin(a);
      const nodeSize = i === 0 ? 62 : i === 1 ? 52 : i === 2 ? 46 : 40;
      nodes += eqNode(eqn, sx, sy, nodeSize);
    });
  });
  const ringLabels = `
    <text x="${cx}" y="${cy - 280 - 45}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="22" font-weight="800" fill="#831843" letter-spacing="0.05em">DIRECT FEEDERS</text>
    <text x="${cx}" y="${cy - 540 - 45}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="20" font-weight="800" fill="#831843" letter-spacing="0.05em">SECOND-ORDER (σ, hypotheses, side-effects)</text>
    <text x="${cx}" y="${cy - 780 - 45}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="18" font-weight="800" fill="#831843" letter-spacing="0.05em">THIRD-ORDER (type system · feedback discipline)</text>
    <text x="${cx}" y="${cy - 960 - 45}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="17" font-weight="800" fill="#831843" letter-spacing="0.05em">OUTER (foundations · learning)</text>
  `;
  const hub = `
    <circle cx="${cx}" cy="${cy}" r="220" fill="#831843" stroke="#0f172a" stroke-width="6"/>
    <text x="${cx}" y="${cy - 30}" text-anchor="middle" font-family="SF Mono, Menlo, monospace" font-size="130" font-weight="800" fill="#ffffff">10</text>
    <text x="${cx}" y="${cy + 30}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="28" font-weight="800" fill="#fce7f3">Priority-Weighted</text>
    <text x="${cx}" y="${cy + 66}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="28" font-weight="800" fill="#fce7f3">Trade-off</text>
    <text x="${cx}" y="${cy + 110}" text-anchor="middle" font-family="SF Mono, Menlo, monospace" font-size="22" fill="#fbcfe8">T = max(P × V ÷ C × Conf)</text>
  `;
  return svgWrap(
    'The Trade-off Confluence — Eq.10 at the centre',
    'Every equation flows toward the decision.  Inner ring = direct feeders · outer rings = supporting structure',
    `<defs><marker id="arrConf" markerWidth="20" markerHeight="20" refX="18" refY="6" orient="auto"><path d="M0,0 L0,12 L18,6 z" fill="#831843"/></marker></defs>${ringElements}${arrows}${nodes}${ringLabels}${hub}`,
    'Eq.10 is where the whole algebra collapses to a decision.  DIRECT FEEDERS: Efficiency (3) · Constraints (8) · Balance (9) · Priority (14) · Conflict (21) · Cost of Delay (30) — every Trade-off directly weighs these.  SECOND-ORDER: Impact ± σ (5) supplies the uncertainty; Hypotheses (15) supply the candidates; Cumulative Risk (17) qualifies Confidence; Sharpening (29) shrinks σ before the decision; Multi-Attribute (6) and Side Effects (12) name what is at stake.  THIRD-ORDER: the type system (22, 7, 24, 28) and feedback discipline (11, 25, 4, 18) make the decision meaningful.  OUTER: foundations (1, 23) and learning (13, 16, 19, 20, 26, 27, 2) make the decision correct over time.'
  );
}

// ================================================================
// 3) σ SANKEY — REDESIGNED so stream aligns to stations
// ================================================================
function sigmaSankey() {
  // Redesign: stream flows through the equation nodes.  Station labels above, notes below.
  const streamY = 1150;
  const stations = [
    { title:'BIRTH',    x: 480,  eqs:[5],         w: 100,
      note:'σ enters at Impact Estimation — every I = μ ± σ carries an honest range.' },
    { title:'SPLITS',   x: 1180, eqs:[6, 12, 15], w: 220,
      note:'σ spreads: multi-Attribute scans (6), unintended side effects (12), design-as-hypothesis (15).' },
    { title:'SHRUNK',   x: 1900, eqs:[29],        w: 90,
      note:'Sharpening — add Qualifier · add Meter · add Source — pinches the flow: σ shrinks, Confidence rises.' },
    { title:'DECISION', x: 2650, eqs:[9, 10],     w: 190,
      note:'Balance (9) and Trade-off (10) consume σ: the honest range determines whether the plan is balanced at chosen Confidence.' },
    { title:'FUTURE',   x: 3400, eqs:[17],        w: 130,
      note:'Cumulative Risk (17) — σ across the sequence of Evo Steps. Per-step Confidence does not aggregate; the sequence has its own σ.' },
  ];
  // Stream shape — wide at birth (σ born), narrow at SHRUNK, wide again at DECISION, expands to FUTURE
  const path = `M 240 ${streamY - stations[0].w/2}
    L ${stations[0].x - 100} ${streamY - stations[0].w/2}   L ${stations[0].x + 100} ${streamY - stations[0].w/2}
    L ${stations[1].x - 200} ${streamY - stations[1].w/2}   L ${stations[1].x + 200} ${streamY - stations[1].w/2}
    L ${stations[2].x - 130} ${streamY - stations[2].w/2}   L ${stations[2].x + 130} ${streamY - stations[2].w/2}
    L ${stations[3].x - 180} ${streamY - stations[3].w/2}   L ${stations[3].x + 180} ${streamY - stations[3].w/2}
    L ${stations[4].x - 150} ${streamY - stations[4].w/2}   L ${W - 100} ${streamY - stations[4].w/2 - 20}
    L ${W - 100} ${streamY + stations[4].w/2 + 20}
    L ${stations[4].x + 150} ${streamY + stations[4].w/2}   L ${stations[4].x - 150} ${streamY + stations[4].w/2}
    L ${stations[3].x + 180} ${streamY + stations[3].w/2}   L ${stations[3].x - 180} ${streamY + stations[3].w/2}
    L ${stations[2].x + 130} ${streamY + stations[2].w/2}   L ${stations[2].x - 130} ${streamY + stations[2].w/2}
    L ${stations[1].x + 200} ${streamY + stations[1].w/2}   L ${stations[1].x - 200} ${streamY + stations[1].w/2}
    L ${stations[0].x + 100} ${streamY + stations[0].w/2}   L ${stations[0].x - 100} ${streamY + stations[0].w/2}
    L 240 ${streamY + stations[0].w/2} Z`;
  let els = `<path d="${path}" fill="#c2410c" fill-opacity="0.28" stroke="#9a3412" stroke-width="5"/>`;
  els += `<text x="120" y="${streamY + 40}" font-family="SF Mono, Menlo, monospace" font-size="130" font-weight="800" fill="#9a3412">σ</text>`;
  // flow-direction arrows floating in the stream between stations
  for (let i = 0; i < stations.length - 1; i++) {
    const midX = (stations[i].x + stations[i+1].x) / 2;
    els += `<path d="M ${midX-70} ${streamY} L ${midX+70} ${streamY}" stroke="#7c2d12" stroke-width="10" fill="none" marker-end="url(#arrSankey)"/>`;
  }
  // station labels above the stream
  stations.forEach(r => {
    els += `<rect x="${r.x - 200}" y="380" width="400" height="120" rx="18" fill="#0f172a"/>`;
    els += `<text x="${r.x}" y="448" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="42" font-weight="800" fill="#ffffff">${r.title}</text>`;
    els += `<text x="${r.x}" y="484" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="20" fill="#cbd5e1" font-style="italic">of the uncertainty</text>`;
    // equation nodes RIGHT ON the stream
    const count = r.eqs.length;
    r.eqs.forEach((eqn, j) => {
      const nx = r.x + (count === 1 ? 0 : (j - (count-1)/2) * 175);
      els += eqNode(eqn, nx, streamY, 56);
    });
    // notes below the stream
    const noteLines = wrapText(r.note, 34);
    noteLines.forEach((ln, k) => {
      els += `<text x="${r.x}" y="${1620 + k * 36}" text-anchor="middle" class="g">${ln}</text>`;
    });
  });
  return svgWrap(
    'The σ Sankey — How Uncertainty Flows through the Algebra',
    'σ born at Eq.5 · spreads through impact scan · shrunk by Sharpening · consumed at Trade-off · accumulates in Cumulative Risk',
    `<defs><marker id="arrSankey" markerWidth="24" markerHeight="24" refX="22" refY="8" orient="auto"><path d="M0,0 L0,16 L22,8 z" fill="#7c2d12"/></marker></defs>${els}`,
    'σ (honest uncertainty) is born at Impact Estimation (Eq.5) — every impact number is a Range, not a Point.  It SPREADS as we scan every Attribute (Eq.6), hunt side-effects (Eq.12), and admit designs are Hypotheses (Eq.15).  It is SHRUNK by Sharpening (Eq.29): every Qualifier added, every Meter named, every Source cited pinches the flow.  It is CONSUMED at Balance (Eq.9) and Trade-off (Eq.10): those are the equations that actually eat the σ to produce a Confidence-qualified answer.  And it ACCUMULATES over the sequence at Cumulative Risk (Eq.17).'
  );
}

// ================================================================
// 4) METER–VALUE–GOAL LOOP
// ================================================================
function meterValueGoalLoop() {
  const cx = W/2, cy = 1080;
  const r = 620;
  const stations = [
    { at: -Math.PI/2,             label:'MEASURE',  sub:'Meter reads Value',       eqs:[11, 25, 4],  color:'#155e75' },
    { at: -Math.PI/2 + Math.PI/3, label:'ESTIMATE', sub:'Impact ± σ',              eqs:[5, 6, 29],   color:'#9a3412' },
    { at: -Math.PI/2 + 2*Math.PI/3, label:'BALANCE',sub:'Values ≥ Goals?',         eqs:[9, 3, 8],    color:'#065f46' },
    { at:  Math.PI/2,             label:'DECIDE',   sub:'Trade-off · Priority',    eqs:[10, 14, 21, 30], color:'#831843' },
    { at:  Math.PI/2 + Math.PI/3, label:'CHECK',    sub:'Reversible? Cumulative?', eqs:[27, 17],     color:'#92400e' },
    { at:  Math.PI/2 + 2*Math.PI/3, label:'LEARN',  sub:'Δ, Spec grows',           eqs:[13, 26, 20], color:'#5b21b6' },
  ];
  let ring = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#94a3b8" stroke-width="6" stroke-dasharray="18,14"/>`;
  let s = '';
  stations.forEach((st, i) => {
    const sx = cx + r * Math.cos(st.at), sy = cy + r * Math.sin(st.at);
    s += `<circle cx="${sx}" cy="${sy}" r="140" fill="${st.color}" stroke="#0f172a" stroke-width="6"/>`;
    s += `<text x="${sx}" y="${sy - 20}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="38" font-weight="800" fill="#ffffff">${st.label}</text>`;
    s += `<text x="${sx}" y="${sy + 22}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="18" fill="#ffffff">${st.sub}</text>`;
    st.eqs.forEach((eqn, j) => {
      const off = 200 + (j % 2) * 50;
      const angleOff = (j - (st.eqs.length - 1) / 2) * 0.24;
      const ex = cx + (r + off) * Math.cos(st.at + angleOff);
      const ey = cy + (r + off) * Math.sin(st.at + angleOff);
      s += eqNode(eqn, ex, ey, 48);
    });
  });
  let arrows = '';
  const numArrows = 12;
  for (let i = 0; i < numArrows; i++) {
    const a = i * (2*Math.PI/numArrows) - Math.PI/2 + 0.15;
    const ax = cx + r * Math.cos(a), ay = cy + r * Math.sin(a);
    const tx = cx + r * Math.cos(a + 0.06), ty = cy + r * Math.sin(a + 0.06);
    arrows += `<line x1="${ax}" y1="${ay}" x2="${tx}" y2="${ty}" stroke="#0f172a" stroke-width="9" marker-end="url(#arrLoop)"/>`;
  }
  return svgWrap(
    'The Meter–Value–Goal Loop — the feedback circle that keeps plans honest',
    'Measure · Estimate · Balance · Decide · Check · Learn — six stations, one revolution per Evo Step, forever',
    `<defs><marker id="arrLoop" markerWidth="24" markerHeight="24" refX="22" refY="8" orient="auto"><path d="M0,0 L0,16 L22,8 z" fill="#0f172a"/></marker></defs>${ring}${arrows}${s}`,
    'Every Value in a live plan is caught in this loop.  MEASURE: the Meter reads the Value at the current Level (Eq.11, Eq.25, Eq.4).  ESTIMATE: Impact ± σ across every Attribute, Sharpened by adding Qualifiers and Sources (Eq.5, Eq.6, Eq.29).  BALANCE: does the Value (with σ) reach its Goal, do Costs stay in Budget, are Constraints honoured? (Eq.9, Eq.3, Eq.8).  DECIDE: Priority-weighted Trade-off resolves conflict (Eq.10, Eq.14, Eq.21, Eq.30).  CHECK: is the step reversible if the Meter disappoints? Does cumulative Risk stay acceptable? (Eq.27, Eq.17).  LEARN: record Improvement Δ, monotonically enrich the Spec, evolve the System (Eq.13, Eq.26, Eq.20).  Back to MEASURE.'
  );
}

// ================================================================
// 5) METRO MAP
// ================================================================
function metroMap() {
  const tiers = [
    { key:'T1', y: 1900, color: T.T1.dark, name:'Foundations',                  eqs:[1, 23] },
    { key:'T2', y: 1660, color: T.T2.dark, name:'Types &amp; Definitions',      eqs:[22, 2, 7, 24, 28, 19] },
    { key:'T3', y: 1420, color: T.T3.dark, name:'Impacts &amp; Estimation',     eqs:[15, 5, 6, 12, 29] },
    { key:'T4', y: 1180, color: T.T4.dark, name:'Feedback &amp; Measurement',   eqs:[25, 11, 4, 18] },
    { key:'T5', y:  940, color: T.T5.dark, name:'Balance · Priority · Trade',   eqs:[8, 3, 30, 14, 9, 10, 21] },
    { key:'T6', y:  700, color: T.T6.dark, name:'Learning &amp; Evolution',     eqs:[13, 26, 16, 27, 17, 20] },
  ];
  const xStart = 380, xEnd = W - 300;
  let lines = '', stations = '', interchanges = '';
  tiers.forEach(line => {
    lines += `<line x1="${xStart}" y1="${line.y}" x2="${xEnd}" y2="${line.y}" stroke="${line.color}" stroke-width="16" stroke-linecap="round"/>`;
    lines += `<text x="60" y="${line.y - 34}" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="26" font-weight="800" fill="${line.color}">${line.name.toUpperCase()}</text>`;
    lines += `<text x="60" y="${line.y + 34}" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="20" fill="${line.color}">${line.key} · ${line.eqs.length} stops</text>`;
    const spacing = (xEnd - xStart) / (line.eqs.length + 1);
    line.eqs.forEach((eqn, i) => {
      const sx = xStart + (i + 1) * spacing;
      stations += `<circle cx="${sx}" cy="${line.y}" r="32" fill="#ffffff" stroke="${line.color}" stroke-width="8"/>`;
      stations += `<text x="${sx}" y="${line.y + 12}" text-anchor="middle" font-family="SF Mono, Menlo, monospace" font-size="30" font-weight="800" fill="${line.color}">${eqn}</text>`;
      stations += `<text x="${sx}" y="${line.y + 82}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="20" font-weight="700" fill="#334155">${EQ[eqn].title}</text>`;
    });
  });
  const eqLine4 = tiers.find(t => t.eqs.includes(4));
  const eqLine10 = tiers.find(t => t.eqs.includes(10));
  const line4Idx = eqLine4.eqs.indexOf(4);
  const line10Idx = eqLine10.eqs.indexOf(10);
  const sp4 = (xEnd - xStart) / (eqLine4.eqs.length + 1);
  const sp10 = (xEnd - xStart) / (eqLine10.eqs.length + 1);
  const x4 = xStart + (line4Idx + 1) * sp4;
  const x10 = xStart + (line10Idx + 1) * sp10;
  interchanges += `<rect x="${x4-70}" y="${eqLine4.y - 70}" width="140" height="140" rx="14" fill="none" stroke="#0f172a" stroke-width="8"/>`;
  interchanges += `<text x="${x4}" y="${eqLine4.y - 95}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="22" font-weight="800" fill="#0f172a">◆ INTERCHANGE ◆</text>`;
  interchanges += `<rect x="${x10-70}" y="${eqLine10.y - 70}" width="140" height="140" rx="14" fill="none" stroke="#0f172a" stroke-width="8"/>`;
  interchanges += `<text x="${x10}" y="${eqLine10.y - 95}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="22" font-weight="800" fill="#0f172a">◆ INTERCHANGE ◆</text>`;
  return svgWrap(
    "The Planner's Journey — Metro Map",
    'Six tier-lines · 30 stations · two interchanges at the beating heart (Eq.4) and the confluence (Eq.10)',
    lines + stations + interchanges,
    "A planner boards at T1 (Foundations — every Requirement traces to a Stakeholder, every Value to an Owner) and rides the lines: T2 (Types) gives the quantification alphabet; T3 (Impacts) puts honest ranges on estimates; T4 (Feedback) turns those estimates into Meter-verified reality; T5 (Balance) balances Values vs Costs; T6 (Learning) turns each cycle into permanent Spec enrichment.  The two interchange stations — Eq.4 Evo Cycle and Eq.10 Trade-off — are where every line crosses."
  );
}

// ================================================================
// 6) RADIAL MIND-MAP — REDESIGNED: bigger canvas, wider fan, no overlap
// ================================================================
function mindMap() {
  const cx = W/2, cy = 1140;
  const branches = [
    { key:'T1', color: T.T1.dark, angle: -Math.PI/2,                eqs:[1, 23] },
    { key:'T2', color: T.T2.dark, angle: -Math.PI/2 + Math.PI/3,    eqs:[22, 2, 7, 24, 28, 19] },
    { key:'T3', color: T.T3.dark, angle: -Math.PI/2 + 2*Math.PI/3,  eqs:[15, 5, 6, 12, 29] },
    { key:'T4', color: T.T4.dark, angle:  Math.PI/2,                eqs:[25, 11, 4, 18] },
    { key:'T5', color: T.T5.dark, angle:  Math.PI/2 + Math.PI/3,    eqs:[8, 3, 30, 14, 9, 10, 21] },
    { key:'T6', color: T.T6.dark, angle:  Math.PI/2 + 2*Math.PI/3,  eqs:[13, 26, 16, 27, 17, 20] },
  ];
  const rBranch = 460, rLeaf = 950;
  let els = '';
  branches.forEach(br => {
    const bx = cx + rBranch * Math.cos(br.angle), by = cy + rBranch * Math.sin(br.angle);
    els += `<line x1="${cx}" y1="${cy}" x2="${bx}" y2="${by}" stroke="${br.color}" stroke-width="18"/>`;
    els += `<rect x="${bx-130}" y="${by-55}" width="260" height="110" rx="18" fill="${br.color}"/>`;
    els += `<text x="${bx}" y="${by-12}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="38" font-weight="800" fill="#ffffff">${br.key}</text>`;
    els += `<text x="${bx}" y="${by+26}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="16" fill="#ffffff">${T[br.key].name.slice(0,32)}</text>`;
    // fan spread = 0.8 * pi/3 (safely inside the 60° wedge, no cross-branch overlap)
    // AND the last equation in each branch is pushed further out on a second concentric ring
    const spread = (Math.PI/3) * 0.82;
    br.eqs.forEach((eqn, i) => {
      const leafA = br.angle - spread/2 + (i / (br.eqs.length - 1 || 1)) * spread;
      // alternate between two concentric rings so leaves don't crowd each other
      const leafRadius = rLeaf + (i % 2) * 130;
      const lx = cx + leafRadius * Math.cos(leafA), ly = cy + leafRadius * Math.sin(leafA);
      els += `<line x1="${bx + 130*Math.cos(leafA)}" y1="${by + 130*Math.sin(leafA)}" x2="${lx - 64*Math.cos(leafA)}" y2="${ly - 64*Math.sin(leafA)}" stroke="${br.color}" stroke-width="6" stroke-opacity="0.65"/>`;
      els += eqNode(eqn, lx, ly, 60);
    });
  });
  const hub = `
    <circle cx="${cx}" cy="${cy}" r="170" fill="#0f172a" stroke="#94a3b8" stroke-width="6"/>
    <text x="${cx}" y="${cy - 22}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="30" font-weight="800" fill="#ffffff">Planguage</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="28" font-weight="800" fill="#ffffff">Systems</text>
    <text x="${cx}" y="${cy + 58}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="28" font-weight="800" fill="#ffffff">Engineering</text>
  `;
  return svgWrap(
    'Radial Mind-Map — 30 equations as leaves on 6 branches',
    'Central hub · six tiers as branches · 30 equations as leaves · family-tree view · good for the book table-of-contents',
    els + hub,
    'The whole algebra as a mind-map.  The trunk is Planguage Systems Engineering.  The six branches are the tiers (Foundations, Types &amp; Definitions, Impacts &amp; Estimation, Feedback &amp; Measurement, Balance/Priority/Trade-off, Learning &amp; Evolution).  The leaves are the 30 equations, positioned by which tier they belong to.  A pedagogical view: use this for a book table of contents, for a chapter opener, or as a poster hung in a planning room.'
  );
}

// ================================================================
// 7) FISHBONE — REDESIGNED with vertical stagger to prevent overlap
// ================================================================
function fishbone() {
  const y = 1200;
  const xStart = 260, xEnd = W - 700;
  // stagger bones vertically as well as horizontally
  const bones = [
    { key:'T1', color: T.T1.dark, x: 600,  above: true,  eqs:[1, 23] },
    { key:'T2', color: T.T2.dark, x: 1050, above: false, eqs:[22, 2, 7, 24, 28, 19] },
    { key:'T3', color: T.T3.dark, x: 1500, above: true,  eqs:[15, 5, 6, 12, 29] },
    { key:'T4', color: T.T4.dark, x: 1950, above: false, eqs:[25, 11, 4, 18] },
    { key:'T5', color: T.T5.dark, x: 2400, above: true,  eqs:[8, 3, 30, 14, 9, 10, 21] },
    { key:'T6', color: T.T6.dark, x: 2850, above: false, eqs:[13, 26, 16, 27, 17, 20] },
  ];
  let els = '';
  els += `<line x1="${xStart}" y1="${y}" x2="${xEnd}" y2="${y}" stroke="#0f172a" stroke-width="14"/>`;
  els += `<path d="M ${xEnd} ${y-50} L ${xEnd + 100} ${y} L ${xEnd} ${y + 50} Z" fill="#0f172a"/>`;
  els += `<rect x="${xEnd + 120}" y="${y - 140}" width="560" height="280" rx="24" fill="#065f46" stroke="#0f172a" stroke-width="6"/>`;
  els += `<text x="${xEnd + 400}" y="${y - 40}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="52" font-weight="800" fill="#ffffff">DELIVERED</text>`;
  els += `<text x="${xEnd + 400}" y="${y + 20}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="52" font-weight="800" fill="#ffffff">VALUE</text>`;
  els += `<text x="${xEnd + 400}" y="${y + 70}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="22" fill="#d1fae5">real, measured, at Confidence</text>`;
  els += `<text x="${xEnd + 400}" y="${y + 100}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="22" fill="#d1fae5">across the lifetime</text>`;
  // bones: use a shallower angle for above bones and steeper for below to prevent overlap
  bones.forEach((b, bi) => {
    const dy = b.above ? -1 : 1;
    const boneLen = 750;
    const angle = dy * 0.85;
    const bx = b.x + boneLen * Math.sin(angle);
    const by = y + dy * boneLen * Math.cos(angle);
    els += `<line x1="${b.x}" y1="${y}" x2="${bx}" y2="${by}" stroke="${b.color}" stroke-width="12"/>`;
    els += `<rect x="${bx-140}" y="${by + (b.above ? -95 : 30)}" width="280" height="70" rx="14" fill="${b.color}"/>`;
    els += `<text x="${bx}" y="${by + (b.above ? -50 : 75)}" text-anchor="middle" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="34" font-weight="800" fill="#ffffff">${b.key}</text>`;
    // sub-bones — spread FURTHER along the bone with bigger separation
    b.eqs.forEach((eqn, i) => {
      const t = (i + 1) / (b.eqs.length + 1);
      const px = b.x + (bx - b.x) * t;
      const py = y + (by - y) * t;
      // sub-bone angled away from spine
      const subLen = 200;
      const subAngle = angle + (Math.PI/3.5) * (dy > 0 ? 1 : -1);
      const sbx = px + subLen * Math.sin(subAngle);
      const sby = py + dy * subLen * Math.cos(subAngle);
      els += `<line x1="${px}" y1="${py}" x2="${sbx}" y2="${sby}" stroke="${b.color}" stroke-width="4" stroke-opacity="0.8"/>`;
      els += eqNode(eqn, sbx, sby, 44);
    });
  });
  return svgWrap(
    'Constraint Fishbone (Ishikawa) — what determines Delivered Value',
    'Spine points to Delivered Value · 6 tier-bones · each equation is a sub-bone that shapes the outcome',
    els,
    'Ishikawa root-cause analysis, applied forward.  The spine points at DELIVERED VALUE — the thing every plan is trying to produce, at Confidence, across the lifetime of the System of Concern.  Six major bones name the categories of causes.  Each equation is a sub-bone naming a specific mechanism by which the category shapes the outcome.  Use this view to diagnose a plan: walk each bone, ask "which equation is this plan neglecting?"  The neglected sub-bones are where value is being leaked.'
  );
}

// ================================================================
// 8) COMIC STRIP
// ================================================================
function comicStrip() {
  const tiers = [
    { key:'T1', panel:'Foundations',           color: T.T1.dark, bg:'#dbeafe', hero: 1, tag:'Src ← Stake',        story:'Every Requirement points back to a Stakeholder.  No Stakeholder, no Requirement — just a Wish looking for an owner.  Bedrock.' },
    { key:'T2', panel:'Types &amp; Definitions', color: T.T2.dark, bg:'#ede9fe', hero: 7, tag:'FL = Level [Q]',    story:'Every Future Level is a Level under stated Qualifiers.  No Qualifiers = infinite scope = infinite cost = certain failure.  Bound it: when, where, who.' },
    { key:'T3', panel:'Impacts &amp; Estimation',color: T.T3.dark, bg:'#ffedd5', hero: 5, tag:'I = μ ± σ + E·S·Cr',story:'Every Impact is Estimate ± Deviation, backed by Evidence, Source, and Credibility.  Point-estimates lie; backed ranges tell the truth.' },
    { key:'T4', panel:'Feedback &amp; Measurement',color: T.T4.dark, bg:'#cffafe', hero: 4, tag:'Ship→Measure→Study→Act', story:'Every Evo Step is one turn of PDSA.  Learning frequency beats planning cleverness.  Musk\'s Velocity of Learning.  The beating heart of the whole algebra.' },
    { key:'T5', panel:'Balance · Trade-off',   color: T.T5.dark, bg:'#d1fae5', hero:10, tag:'T = max(P·V÷C·Conf)',story:'When Values conflict, the winner is the highest Priority × Value ÷ Cost, honestly discounted by σ and Risk.  Never pick the flashy point-estimate.' },
    { key:'T6', panel:'Learning &amp; Evolution',color: T.T6.dark, bg:'#ede9fe', hero:20, tag:'Sys(t+1) = Sys(t) + L',story:'The System at t+1 is the System at t plus one Evo cycle\'s Learning.  Recursive across the lifetime of the System of Concern.  Export is an entry, not an end.' },
  ];
  const cols = 3, rows = 2;
  const panelW = 1180, panelH = 900;
  const startX = (W - (cols * panelW + (cols-1) * 60)) / 2;
  const startY = 170;
  let els = '';
  tiers.forEach((t, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    const px = startX + col * (panelW + 60);
    const py = startY + row * (panelH + 40);
    els += `<rect x="${px}" y="${py}" width="${panelW}" height="${panelH}" rx="28" fill="${t.bg}" stroke="${t.color}" stroke-width="6"/>`;
    els += `<rect x="${px}" y="${py}" width="${panelW}" height="100" rx="28" fill="${t.color}"/>`;
    els += `<rect x="${px}" y="${py + 72}" width="${panelW}" height="28" fill="${t.color}"/>`;
    els += `<text x="${px + 50}" y="${py + 68}" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="40" font-weight="800" fill="#ffffff">${t.key} · ${t.panel}</text>`;
    els += `<circle cx="${px + 180}" cy="${py + 320}" r="140" fill="${t.color}" stroke="#0f172a" stroke-width="6"/>`;
    els += `<text x="${px + 180}" y="${py + 360}" text-anchor="middle" font-family="SF Mono, Menlo, monospace" font-size="140" font-weight="800" fill="#ffffff">${t.hero}</text>`;
    els += `<text x="${px + 360}" y="${py + 275}" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="42" font-weight="800" fill="${t.color}">${EQ[t.hero].title}</text>`;
    els += `<text x="${px + 360}" y="${py + 335}" font-family="SF Mono, Menlo, monospace" font-size="36" font-weight="700" fill="${t.color}">${t.tag}</text>`;
    const wrapped = wrapText(t.story, 55);
    wrapped.forEach((ln, k) => {
      els += `<text x="${px + 60}" y="${py + 540 + k * 46}" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="30" fill="#0f172a">${ln}</text>`;
    });
    els += `<text x="${px + panelW - 60}" y="${py + panelH - 40}" text-anchor="end" font-family="-apple-system,SF Pro Text,Helvetica,Arial,sans-serif" font-size="20" font-style="italic" fill="${t.color}">panel ${i+1} of 6</text>`;
  });
  return svgWrap(
    'The 30 Equations as a 6-Panel Comic — one hero equation per tier',
    'Approachable teaching format for chapter openers · one big number per panel · one narrative sentence',
    els,
    ''
  );
}

function svgWrap(title, sub, inner, footNote) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>${STYLE}</style>
${header(title, sub)}
${inner}
${footNote ? footer(H - 130, footNote) : ''}
</svg>`;
}

// HTML wrapper with 📋 Copy button per Gilb HTML Table Standard v3 amendment (2026-07-08).
const HTML_STYLE = `@page { size: 40in 22.5in; margin: 0; } @media print { body { padding: 0; } .no-print { display: none !important; } } html,body { margin: 0; padding: 0; background: #ffffff; font-family: -apple-system,BlinkMacSystemFont,'SF Pro Text',Helvetica,Arial,sans-serif; } .btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; font-size: 12px; font-weight: 700; color: #ffffff; background: #1e293b; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.15); } .btn:hover { background: #334155; } .btn.secondary { background: #64748b; } .btn.secondary:hover { background: #475569; } .btn.primary { background: #2563eb; } .btn.primary:hover { background: #1d4ed8; } .toolbar { margin: 0 auto 8px auto; padding: 7px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 12px; color: #334155; } .svg-wrap { background: #ffffff; overflow-x: auto; } svg { display: block; margin: 0 auto; width: 100vw; height: auto; max-width: 100%; }`;
const HTML_SCRIPT = `function svgToPngBlob(scale){scale=scale||2;const svg=document.querySelector('#diagram-block svg');const vb=svg.viewBox.baseVal;const w=vb.width,h=vb.height;const c=svg.cloneNode(true);c.setAttribute('xmlns','http://www.w3.org/2000/svg');c.setAttribute('width',w);c.setAttribute('height',h);const str=new XMLSerializer().serializeToString(c);const blob=new Blob([str],{type:'image/svg+xml;charset=utf-8'});const url=URL.createObjectURL(blob);return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const cv=document.createElement('canvas');cv.width=w*scale;cv.height=h*scale;const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);ctx.scale(scale,scale);ctx.drawImage(img,0,0);URL.revokeObjectURL(url);cv.toBlob(resolve,'image/png');};img.onerror=reject;img.src=url;});} function copyDiagramAsPNG(){const s=document.getElementById('copy-status');try{const p=svgToPngBlob(2);navigator.clipboard.write([new ClipboardItem({'image/png':p})]).then(()=>{s.textContent='✓ Copied as PNG — now ⌘V in Keynote / Slides / Pages / Word';s.style.color='#065f46';setTimeout(()=>{s.textContent='';},6000);}).catch(()=>{s.textContent='⚠ Clipboard blocked — click 💾 Download PNG';s.style.color='#991b1b';setTimeout(()=>{s.textContent='';},8000);});}catch(e){s.textContent='⚠ PNG build failed';s.style.color='#991b1b';setTimeout(()=>{s.textContent='';},8000);}} async function downloadDiagramAsPNG(){try{const b=await svgToPngBlob(2);const url=URL.createObjectURL(b);const a=document.createElement('a');const n=new Date();const st=n.getFullYear()+String(n.getMonth()+1).padStart(2,'0')+String(n.getDate()).padStart(2,'0')+'-'+String(n.getHours()).padStart(2,'0')+String(n.getMinutes()).padStart(2,'0');a.href=url;a.download='illustration-4K-'+st+'.png';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);document.getElementById('copy-status').textContent='✓ Downloaded — drag from Downloads into Keynote';document.getElementById('copy-status').style.color='#065f46';setTimeout(()=>{document.getElementById('copy-status').textContent='';},6000);}catch(e){console.error(e);}}`;
function htmlWrap(title, svg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>${HTML_STYLE}</style></head><body><div class="toolbar no-print"><b style="color:#0f172a;">${title}</b><span style="color:#052e16;background:#dcfce7;padding:3px 8px;border-radius:3px;font-size:11px;">4K widescreen 3840×2160 · 8 July 2026</span><div style="flex:1;"></div><button class="btn primary" onclick="copyDiagramAsPNG()" title="Rasterize the SVG to a 2× PNG and put it on the clipboard.  Then ⌘V into Keynote / Slides / Pages / Word.">📋&nbsp;Copy&nbsp;as&nbsp;PNG&nbsp;(for&nbsp;Keynote)</button><button class="btn secondary" onclick="downloadDiagramAsPNG()" title="Save PNG to Downloads.  Drag into Keynote if clipboard is blocked.">💾&nbsp;Download&nbsp;PNG</button><button class="btn secondary" onclick="window.print()" title="Print or ⌘P.  Toolbar auto-hides in print.">🖨️&nbsp;Print</button><span id="copy-status" style="font-size:12px;color:#065f46;font-weight:700;"></span></div><div id="diagram-block"><div class="svg-wrap">${svg}</div></div><script>${HTML_SCRIPT}</script></body></html>`;
}

const builders = [
  { slug: 'Evo-Wheel',              title: 'Evo Wheel — Eq.4 at the Centre',                       fn: evoWheel },
  { slug: 'Tradeoff-Confluence',    title: 'Trade-off Confluence — Eq.10 at the Centre',           fn: tradeoffConfluence },
  { slug: 'Sigma-Sankey',           title: 'σ Sankey — How Uncertainty Flows',                    fn: sigmaSankey },
  { slug: 'Meter-Value-Goal-Loop',  title: 'Meter–Value–Goal Feedback Loop',                       fn: meterValueGoalLoop },
  { slug: 'Planners-Journey-Metro', title: "Planner's Journey — Metro Map",                        fn: metroMap },
  { slug: 'Radial-Mind-Map',        title: 'Radial Mind-Map — 30 Equations on 6 Branches',         fn: mindMap },
  { slug: 'Constraint-Fishbone',    title: 'Constraint Fishbone — What Determines Delivered Value',fn: fishbone },
  { slug: 'Comic-Strip-6-Panels',   title: '6-Panel Comic — one Hero Equation per Tier',           fn: comicStrip },
];

const browser = await chromium.launch();
for (const b of builders) {
  const svg = b.fn();
  const svgPath  = path.join(OUT, `Planguage-Equations-${b.slug}.svg`);
  const htmlPath = path.join(OUT, `Planguage-Equations-${b.slug}.html`);
  const pngPath  = path.join(OUT, `Planguage-Equations-${b.slug}.png`);
  fs.writeFileSync(svgPath, '<?xml version="1.0" encoding="UTF-8"?>\n' + svg);
  fs.writeFileSync(htmlPath, htmlWrap(b.title, svg));
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  await page.setContent(`<html><head><meta charset="UTF-8"><style>html,body{margin:0;padding:0;background:white;}</style></head><body>${svg}</body></html>`);
  const buf = await page.screenshot({ omitBackground: false, clip: { x: 0, y: 0, width: W, height: H } });
  fs.writeFileSync(pngPath, buf);
  await page.close();
  console.log(`✓ ${b.slug}: ${(buf.length/1024).toFixed(0)}kb`);
}
await browser.close();
console.log('DONE — 8 illustrations at 4K widescreen with bigger arrows/symbols.');
