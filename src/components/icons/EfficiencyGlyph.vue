<!-- UNIT_TYPE=Glyph
  EfficiencyGlyph.vue — Yin-Yang Value/Cost balance glyph (Color Artsy Icon).

  Tom Gilb 2026-06-10 (verbatim selection of Candidate C):
    "C great international timeless yin yan balance symbol …
     I do not like scale because it is old technology …
     speedometer is still somewhat dated (FSD auto control, I drive tesla)
     OK but yin yan appeals to my optima feelings …
     c is not any more static than the other 2 static pictures, it can vary,
     I'll be you could vary it with the efficiency!"

  Visual concept: two interlocking teardrop forms (Yin and Yang) inside a circle.
    LEFT side (violet) = Values delivered
    RIGHT side (amber) = Resources consumed
    Upper small head (violet bulge): when ENLARGED, Values dominate → surplus
    Lower small head (amber bulge): when ENLARGED, Resources dominate → deficit
    Balanced (50/50 classical Yin-Yang) = 0% balance

  Family:  Color Artsy Icon (DD-016 — artistic interpretation).
  International (DD-015): Yin-Yang is timeless, universal, no English letters.

  Dynamic: the S-curve shifts based on `balancePercent` prop —
    +balance% (surplus) → upper head grows / lower head shrinks → violet dominates
    -balance% (deficit) → upper head shrinks / lower head grows → amber dominates
     0% balance       → r1 = r2 = R/2 → classical Yin-Yang
-->
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    :aria-label="ariaLabel"
  >
    <title>{{ titleText }}</title>

    <!-- Background: outer circle filled AMBER (the "light"/yang side).
         Then we draw the violet "yin" shape ON TOP — no gaps because the amber
         fill covers everything beneath. Classical Yin-Yang construction technique. -->
    <circle cx="32" cy="32" r="28" :fill="amberFill" :stroke="frameStroke" stroke-width="1.5"/>

    <!-- VIOLET yin shape (LEFT half + S-curve through the small heads) -->
    <path :d="violetPath" :fill="violetFill"/>

    <!-- Amber dot inside the upper (violet) head — classical Yin-Yang spot -->
    <circle :cx="32" :cy="upperHeadCenterY" :r="dotR" :fill="amberDotFill"/>

    <!-- Violet dot inside the lower (amber) head -->
    <circle :cx="32" :cy="lowerHeadCenterY" :r="dotR" :fill="violetDotFill"/>

    <!-- ── Symbol labels (Tom Gilb 2026-06-11): remind viewer what each side represents.
         [*] = Planguage Value keyed icon (Σ Values lives on the dark side).
         €   = currency symbol (Σ Resources / cost lives on the gold side).
         Placed at fixed mid-side positions so they always sit ON the correct colour
         for any moderate balance state. At extreme states they may partially overlap
         the opposite colour — acceptable because the pulsing ring already signals extreme.
         "of course explained by President Hoover" — Tom Gilb 2026-06-11 verbatim. -->
    <!-- Layout r93g (Tom Gilb 2026-06-11 "the [*] and the € are both outside partially and thus
         partly illegible they need adjustment inside"). Pulled both symbols WELL INSIDE the
         circle radius, and added a paint-order white halo so they read on any colour state.
         Circle is r=28 centered at (32,32); previous positions (14,18) and (50,46) sat at
         distance ~22.8 from center — close to the r=28 edge and (worse) the text width extended
         further out, clipping at the circle border at small render sizes. New positions (19,21)
         and (45,43) sit at distance ~17 from center — well inside on any balance state. -->
    <text x="19" y="21"
          text-anchor="middle"
          font-family="ui-monospace, 'SF Mono', Menlo, monospace"
          font-size="10"
          font-weight="900"
          letter-spacing="-1"
          :fill="amberFill"
          stroke="#1e293b"
          stroke-width="0.6"
          paint-order="stroke"
          class="select-none"
    >[*]</text>

    <text x="45" y="43"
          text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="14"
          font-weight="900"
          :fill="violetFill"
          stroke="#fef3c7"
          stroke-width="0.6"
          paint-order="stroke"
          class="select-none"
    >€</text>

    <!-- Per-side magnitude overlays — V:N% sits BELOW [*] in the upper-left, R:N% sits ABOVE €
         in the lower-right. Both pulled inward to stay within the circle for 3-digit values. -->
    <text v-if="valueAchievementPercent !== null"
          x="22" y="32"
          text-anchor="middle"
          font-family="ui-monospace, 'SF Mono', Menlo, monospace"
          font-size="8"
          font-weight="700"
          :fill="amberFill"
          stroke="#1e293b"
          stroke-width="0.5"
          paint-order="stroke"
          opacity="0.95"
          class="select-none"
    >V:{{ Math.round(valueAchievementPercent) }}%</text>

    <text v-if="resourceUtilizationPercent !== null"
          x="42" y="32"
          text-anchor="middle"
          font-family="ui-monospace, 'SF Mono', Menlo, monospace"
          font-size="8"
          font-weight="700"
          :fill="violetFill"
          stroke="#fef3c7"
          stroke-width="0.5"
          paint-order="stroke"
          opacity="0.95"
          class="select-none"
    >R:{{ Math.round(resourceUtilizationPercent) }}%</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** Pixel size — width AND height equal. Default 28 (header chip context). */
  size?:           number | string
  /** Variant: 'standard' for white-on-light backgrounds, 'on-dark' for inverted contexts. */
  variant?:        'standard' | 'on-dark'
  /** Signed balance percent — drives the dynamic S-curve shift.
   *  0 = classical balanced Yin-Yang. Positive = violet (Value) head grows (surplus).
   *  Negative = amber (Resource) head grows (deficit). Clamped to [-100, +100]. */
  balancePercent?: number
  /** Optional: Value Achievement percent (avg Status/Goal × 100 across V. entries).
   *  When provided, rendered as a small numeric overlay under the [*] symbol.
   *  Makes the "degree of change" visible even when the Yin-Yang asymmetry saturates
   *  at ±100% but the balancePercent goes much further (e.g., +500%).
   *  Tom Gilb 2026-06-11: "the visuals do not clearly reflect the numbers. Maybe
   *  another overlay on each side can represent the degree of change?" */
  valueAchievementPercent?: number | null
  /** Optional: Resource Utilization percent (avg Status/Budget × 100 across R. entries).
   *  Rendered as a small numeric overlay under the € symbol. Same purpose. */
  resourceUtilizationPercent?: number | null
}>(), {
  size: 28,
  variant: 'standard',
  balancePercent: 0,
  valueAchievementPercent:    null,
  resourceUtilizationPercent: null,
})

// ── Color regime r89b (Tom Gilb 2026-06-10: "I do not like the colors (Im red green) ·
//    The glyph above right does not distinguish itself from the dark background")
// Switched from violet+amber to slate-950+gold. Three reasons:
//   1. RG-COLORBLIND SAFE: slate-near-black and gold are both unambiguous for RG-deficient
//      vision. The old violet+amber pair, while not literally red/green, sat in a colour
//      space that read as muddy to Tom.
//   2. DISTINCT FROM PENTA SECTORS: none of the 5 sector colours (red/green/blue/violet/orange)
//      conflict with slate or gold. Resources sector violet/purple no longer merges with
//      the glyph's Value side.
//   3. CLASSICAL YIN-YANG aesthetic Tom approved — dark + light + dots is the universal form.
// Naming kept as violetFill/amberFill for stable code references (Code Identifier Exemption).
const violetFill    = computed(() => props.variant === 'on-dark' ? '#f8fafc' : '#1e293b')   // Value side: slate-800 (or near-white on dark bg)
const amberFill     = computed(() => props.variant === 'on-dark' ? '#fde047' : '#eab308')   // Resource side: gold-500 (yellow-400 on dark)
const violetDotFill = computed(() => props.variant === 'on-dark' ? '#1e293b' : '#fef3c7')   // amber dot inside dark side
const amberDotFill  = computed(() => props.variant === 'on-dark' ? '#1e293b' : '#1e293b')   // dark dot inside gold side
const frameStroke   = computed(() => props.variant === 'on-dark' ? '#cbd5e1' : '#0f172a')

// ── Dynamic geometry: shift the S-curve via head radii ───────────────────────
// Constraint: r1 + r2 = R = 28 (so each head stays tangent to the outer circle)
// Balanced (t=0): r1 = r2 = 14 → classical Yin-Yang
// Surplus (t>0): r1 grows (upper violet bulge bigger), r2 shrinks → violet area dominates
// Deficit (t<0): r1 shrinks, r2 grows (lower amber bulge bigger) → amber area dominates
// Max shift kept at ±30% so the symbol remains recognizable at extreme values.
const t = computed(() => Math.max(-1, Math.min(props.balancePercent / 100, 1)))

// r88b (Tom Gilb 2026-06-10: "no, those are not right there is almost no visual difference")
// — bumped shift multiplier 0.30 → 0.42 for stronger visual drama at extreme values.
// At t = ±1: r1/r2 swap between 0.08R and 0.92R (was 0.20R/0.80R). The 4 → 11× asymmetry
// makes the surplus/deficit state instantly readable.
const r1 = computed(() => 28 * (0.5 + t.value * 0.42))
const r2 = computed(() => 28 * (0.5 - t.value * 0.42))

// Heads are tangent to the outer circle at top/bottom respectively
const upperHeadCenterY = computed(() => 32 - r1.value)
const lowerHeadCenterY = computed(() => 32 + r2.value)

// Dot scales gently with head size so it stays proportional + readable
const dotR = computed(() => Math.max(2, Math.min(r1.value, r2.value) * 0.25))

// ── Path geometry — verified classical Yin-Yang formula ──────────────────────
// Reference (works): M T  a R R 0 1 1 0 D  a r1 r1 0 0 1 0 -d1  a r2 r2 0 0 0 0 -d2  Z
// where T=top, D=full diameter, d1=upper head diameter, d2=lower head diameter.
//
// We trace ONE yin teardrop and let the OTHER half of the outer circle be filled by
// the second color via a second path. Sweep flags +1 / 0 / 0 produce a yin shape that
// COVERS the RIGHT half of the outer plus carves the proper S-curve through the heads.
// Then we mirror sweep flags to get the LEFT-half yang.
//
// VIOLET = "yin" side (LEFT half) — mirrored classical formula
// Classical (dark on right): M T A R R 0 1 1 T B  A r2 r2 0 0 1 T center  A r1 r1 0 0 0 T top  Z
// Mirrored for LEFT-dark: flip all sweep flags
const violetPath = computed(() => {
  const _r1 = r1.value
  const _r2 = r2.value
  return `M 32 4 A 28 28 0 1 0 32 60 A ${_r2} ${_r2} 0 0 0 32 32 A ${_r1} ${_r1} 0 0 1 32 4 Z`
})

// ── Accessibility / HoverHint ────────────────────────────────────────────────
// Always names what the symbols mean — [*] = Planguage Value icon (Σ Values),
// € = cost / Σ Resources. Then reports the current balance state. Uses ratio× notation
// when |balance| ≥ 1000% (per r92c — "417 is 417, not +41567%").
const fmtBalanceText = (n: number): string => {
  const r = Math.round(n)
  if (Math.abs(r) >= 1000) {
    const ratio = n / 100 + 1
    const sign  = n > 0 ? '+' : '−'
    return `${sign}${Math.round(Math.abs(ratio))}×`
  }
  if (r > 0) return `+${r}%`
  if (r < 0) return `${r}%`
  return '0%'
}
const titleText = computed(() => {
  const legend = 'Efficiency = Σ Values [*] / Σ Resources € · Yin-Yang of Value vs Cost'
  const formatted = fmtBalanceText(props.balancePercent)
  if (props.balancePercent > 5)  return `${legend} — Values dominate (${formatted} surplus)`
  if (props.balancePercent < -5) return `${legend} — Resources dominate (${formatted} deficit)`
  return `${legend} — Values and Resources in balance (~0%)`
})
const ariaLabel = computed(() => `Efficiency Yin-Yang glyph: Σ Values [star] over Σ Resources [euro] at ${Math.round(props.balancePercent)}% balance`)
</script>
