<!-- UNIT_TYPE=Icon -->
<!--
  PentaGlyph.vue — Color Artsy Icon (DD-016) for the Penta Model pinwheel.

  Penta is a sharpening framework (symbol: Sword / SVERD).
  SVERD: Stakeholders · Values · Efficiency · Resources · Design.
  Co-invented by Tom Gilb & Al Shalloway (2022).

  Keyed form: 5 radiating sectors = 5 forces in dynamic balance.
  Five sectors, each 72°, radiating from center like a 5-petal flower.

  DD-015: No English letter abbreviations in SVG paths.
  DD-016: Color Artsy Icon — artistic interpretation of 5-sector balance symbol.
          Shape = 5-petal flower / pinwheel. Colors enlivened per Tom's rule.
          Each sector uses its canonical Penta color.

  Colors:
    Stakeholders = red    (#dc2626)
    Values       = green  (#16a34a)
    Efficiency   = blue   (#2563eb)
    Resources    = violet (#a855f7)
    Design       = orange (#ea580c)

  Size: 60×60. Center: small white circle. Thin white dividing lines between sectors.
  Intrinsic HoverHint via SVG <title> child (Tom Gilb 2026-06-10 r84: "we need
  hover over icons themselves too"). The icon explains itself even when used
  without a wrapping <button title=""> — hovering anywhere on the pinwheel
  shows a brief Planguage definition of the Penta Model.
-->
<template>
  <svg
    viewBox="0 0 60 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Penta Model pinwheel"
  >
    <!-- Intrinsic HoverHint — fires when hovering any part of the icon -->
    <title>Penta Model · SVERD (sword): Scope · Values · Efficiency · Resources · Designs — Tom Gilb &amp; Al Shalloway 2022 sharpening framework</title>

    <!-- ── Sector 1: Scope (top, red) ─────────────────────────────────────── -->
    <!-- Arc from -90° to -18° (top centre, clockwise) -->
    <path
      d="M30 30
         L30 4
         A26 26 0 0 1 54.7 21.4
         Z"
      fill="#dc2626"
      opacity="0.85"
    />
    <!-- ── Sector 2: Values (upper-right, green) ──────────────────────────── -->
    <!-- Arc from -18° to 54° -->
    <path
      d="M30 30
         L54.7 21.4
         A26 26 0 0 1 46.1 52.6
         Z"
      fill="#16a34a"
      opacity="0.85"
    />
    <!-- ── Sector 3: Efficiency (lower-right, blue) ───────────────────────── -->
    <!-- Arc from 54° to 126° -->
    <path
      d="M30 30
         L46.1 52.6
         A26 26 0 0 1 13.9 52.6
         Z"
      fill="#2563eb"
      opacity="0.85"
    />
    <!-- ── Sector 4: Resources (lower-left, violet) ───────────────────────── -->
    <!-- Arc from 126° to 198° -->
    <path
      d="M30 30
         L13.9 52.6
         A26 26 0 0 1 5.3 21.4
         Z"
      fill="#a855f7"
      opacity="0.85"
    />
    <!-- ── Sector 5: Designs (upper-left, orange) ─────────────────────────── -->
    <!-- Arc from 198° to 270° (= -90°) -->
    <path
      d="M30 30
         L5.3 21.4
         A26 26 0 0 1 30 4
         Z"
      fill="#ea580c"
      opacity="0.85"
    />

    <!-- ── White dividing lines between sectors ──────────────────────────── -->
    <!-- Scope | Values boundary (at -18° = 72°) -->
    <line x1="30" y1="30" x2="54.7" y2="21.4" stroke="white" stroke-width="1.2" />
    <!-- Values | Efficiency boundary (at 54° = 144°) -->
    <line x1="30" y1="30" x2="46.1" y2="52.6" stroke="white" stroke-width="1.2" />
    <!-- Efficiency | Resources boundary (at 126° = 216°) -->
    <line x1="30" y1="30" x2="13.9" y2="52.6" stroke="white" stroke-width="1.2" />
    <!-- Resources | Designs boundary (at 198° = 288°) -->
    <line x1="30" y1="30" x2="5.3" y2="21.4" stroke="white" stroke-width="1.2" />
    <!-- Designs | Scope boundary (at 270° = -90°) -->
    <line x1="30" y1="30" x2="30" y2="4" stroke="white" stroke-width="1.2" />

    <!-- ── Center white circle (hub) ─────────────────────────────────────── -->
    <circle cx="30" cy="30" r="7" fill="white" />
    <!-- Center dot -->
    <circle cx="30" cy="30" r="3" fill="#94a3b8" />
  </svg>
</template>
