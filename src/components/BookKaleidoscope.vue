<script setup lang="ts">
/**
 * BookKaleidoscope — Tom Gilb 2026-06-14 verbatim:
 *   "I do not want that mckinney page all the time. I suggest the neutral page
 *    is a kalidescope of my book covers, and every other cover is an illustration
 *    from the book on left. These can be one time build."
 *
 * Replaces the Keeney 3-level icon as the visual identity of the SEM App's
 * welcome / neutral page. Renders an alternating grid of:
 *   - typographic book-cover tile (book title in a coloured panel)
 *   - sample illustration from the same book
 *
 * Reads /book-kaleidoscope.json — built by /MyVault/0 - TOMS BOOKS/
 * twinpod-illustrations/build-kaleidoscope.py (one-time build per Tom's spec).
 *
 * Composes with:
 *   - r93ppp Twin-as-Destination (click any cover → open the book on Tom Gilb
 *     Consultant Twin in a new tab, drive funding-loop traffic)
 *   - Blow-Minds World-Firsts mandate (no other planning app fronts itself with
 *     the author's own published corpus as a kaleidoscope)
 *   - American English Standard
 *   - HoverHint (not "tooltip")
 *   - DD-009 Interaction Disclosure (every tile has a title attribute)
 *   - DD-017 Color-on-Background (all coloured covers on white background)
 */

import { ref, computed, onMounted } from 'vue'

interface KaleidoscopeBook {
  title:                string
  bookId?:              string
  subdomain?:           string
  illustrationUrl:      string
  illustrationCaption?: string
  illustrationPage?:    number | null
  coverColor:           string   // hex
  totalIllustrations:   number
  tilt:                 number   // -3..+3 degrees
}

interface KaleidoscopeManifest {
  version:        number
  generated:      string
  totalBooks:     number
  books:          KaleidoscopeBook[]
}

const props = withDefaults(defineProps<{
  /** Max number of tiles to render. 0 = all. */
  limit?: number
  /** Tile width in px (drives the masonry grid). */
  tileSize?: number
  /** Compact mode — smaller text, tighter padding, used on small surfaces. */
  compact?: boolean
}>(), {
  limit: 0,
  tileSize: 140,
  compact: false,
})

// r41 v222 (Tom Gilb 2026-06-19 "I clicke a picture from my book, not the
// cover, it jumped out of the entire window") — illustration-tile click now
// emits `illustration-click` instead of being a raw-image link.  The parent
// (GilbIllustrationPicker) opens the SEM-native lightbox so the user
// stays inside SEM with a CloseDot + Export, instead of dead-ending on a
// bare raw-image URL in a new Safari tab with no SEM UI.  Cover tiles
// still navigate to the Twin book page (real HTML, r93ppp funding-loop).
// Same dead-end pattern banked under r41 v31 for the Export Pic button —
// missed for the kaleidoscope tile click until Tom flagged this turn.
const emit = defineEmits<{
  /** Fired when an illustration tile is clicked — parent opens the lightbox. */
  'illustration-click': [book: KaleidoscopeBook]
}>()

const _manifest = ref<KaleidoscopeManifest | null>(null)
const _error = ref<string | null>(null)

onMounted(async () => {
  try {
    const res = await fetch(`/book-kaleidoscope.json?v=${Date.now() % 100000}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    _manifest.value = await res.json()
  } catch (e) {
    _error.value = `Could not load book-kaleidoscope.json: ${(e as Error).message}`
    console.warn('[BookKaleidoscope]', _error.value)
  }
})

/** Interleave: cover₁, illustration₁, cover₂, illustration₂… */
const tiles = computed<Array<{ kind: 'cover' | 'illustration'; book: KaleidoscopeBook }>>(() => {
  const books = _manifest.value?.books ?? []
  const out: Array<{ kind: 'cover' | 'illustration'; book: KaleidoscopeBook }> = []
  for (const b of books) {
    out.push({ kind: 'cover',        book: b })
    out.push({ kind: 'illustration', book: b })
  }
  return props.limit > 0 ? out.slice(0, props.limit) : out
})

function twinBookUrl(b: KaleidoscopeBook): string {
  // r41 v26 (Tom Gilb 2026-06-15 verbatim: "one click on a book cover leads to
  // this above" — pasted the raw Turtle LDP manifest from the pod root) —
  // `https://<subdomain>.gilb.com` resolves to the Solid Pod's LDP basic
  // container, which content-negotiates to text/turtle, not HTML.  Users land
  // on a raw RDF dump.  Fix: route cover tiles to the Tom Gilb Consultant Twin
  // book page (r93ppp Twin-as-Destination), which is a real HTML page AND
  // drives the funding-loop traffic.  Slug = kebab-cased title (same pattern
  // already in GilbIllustrationPicker.twinBookUrl).
  const slug = b.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (slug) return `https://www.gilb.com/tomtwin/book/${slug}`
  return 'https://www.gilb.com/tomtwin'
}
// r41 v3 (Tom Gilb 2026-06-14: "the blue text on ill go to tom twin goes to
// the cover only, it needs to go to the exact page where the ill it") —
// illustration tiles now link to the illustration's DIRECT URL on the book
// subdomain.  That lands the reader on the exact image at full resolution,
// not the book's cover.  Cover tiles still go to the book's home page so
// the two click paths surface distinct destinations.
function tileLinkUrl(tile: { kind: 'cover' | 'illustration'; book: KaleidoscopeBook }): string {
  if (tile.kind === 'illustration' && tile.book.illustrationUrl) {
    return tile.book.illustrationUrl
  }
  return twinBookUrl(tile.book)
}

function tileTitle(tile: { kind: 'cover' | 'illustration'; book: KaleidoscopeBook }): string {
  const b = tile.book
  if (tile.kind === 'cover') {
    return `${b.title} — Tom Gilb · ${b.totalIllustrations} illustrations · click to open on Tom Gilb Consultant Twin (free, no login)`
  }
  const page = b.illustrationPage ? ` p.${b.illustrationPage}` : ''
  const caption = b.illustrationCaption ? ` · ${b.illustrationCaption}` : ''
  return `Illustration from "${b.title}"${page}${caption} — click to open the exact image at full resolution`
}
</script>

<template>
  <div
    class="gilb-book-kaleidoscope"
    :class="compact ? 'gilb-kaleidoscope--compact' : ''"
    :style="{ '--tile-size': tileSize + 'px' }"
  >
    <div
      v-if="_error"
      class="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-3 italic"
    >
      <strong>Kaleidoscope unavailable:</strong> {{ _error }}
      <div class="text-[10px] mt-1 text-rose-600">
        Run <code class="bg-white px-1 rounded">python3 "/Users/Tomgilbs/Documents/MyVault/0 - TOMS BOOKS/twinpod-illustrations/build-kaleidoscope.py"</code> to rebuild.
      </div>
    </div>

    <div v-else-if="!_manifest" class="text-xs text-slate-500 italic p-4">
      Loading the Tom Gilb book corpus…
    </div>

    <div
      v-else
      class="gilb-kaleidoscope-grid"
    >
      <a
        v-for="(tile, idx) in tiles"
        :key="`${tile.book.title}-${tile.kind}-${idx}`"
        :href="tile.kind === 'cover' ? tileLinkUrl(tile) : '#'"
        :target="tile.kind === 'cover' ? '_blank' : undefined"
        rel="noopener"
        class="gilb-kaleidoscope-tile"
        :style="{
          transform: `rotate(${tile.book.tilt}deg)`,
        }"
        :title="tileTitle(tile)"
        @click="(e) => {
          if (tile.kind === 'illustration') {
            // r41 v222 — prevent the href='#' from scrolling and emit instead.
            e.preventDefault()
            emit('illustration-click', tile.book)
          }
          // Cover tiles fall through to the normal target='_blank' nav.
        }"
      >
        <!-- COVER tile: typographic, coloured background, title centred -->
        <template v-if="tile.kind === 'cover'">
          <div
            class="gilb-tile-cover"
            :style="{ background: tile.book.coverColor }"
          >
            <div class="gilb-tile-cover-title">{{ tile.book.title }}</div>
            <div class="gilb-tile-cover-author">Tom Gilb</div>
            <div class="gilb-tile-cover-spine"></div>
          </div>
        </template>

        <!-- ILLUSTRATION tile: real image from the book -->
        <template v-else>
          <div class="gilb-tile-ill">
            <img
              :src="tile.book.illustrationUrl"
              :alt="tile.book.illustrationCaption || tile.book.title"
              loading="lazy"
              class="gilb-tile-ill-img"
            />
            <div class="gilb-tile-ill-overlay">
              <span class="gilb-tile-ill-book">{{ tile.book.title }}</span>
              <span
                v-if="tile.book.illustrationPage"
                class="gilb-tile-ill-page"
              >p.{{ tile.book.illustrationPage }}</span>
            </div>
          </div>
        </template>
      </a>
    </div>
  </div>
</template>

<style scoped>
/* r41 (Tom Gilb 2026-06-14) — book-cover kaleidoscope replaces Keeney icon
   on the welcome / neutral page. */
.gilb-book-kaleidoscope {
  width: 100%;
}
.gilb-kaleidoscope-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--tile-size), 1fr));
  gap: 12px;
  padding: 4px;
}
.gilb-kaleidoscope-tile {
  display: block;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);
  transition: transform 0.35s ease, box-shadow 0.35s ease, z-index 0s linear 0.35s;
  cursor: pointer;
  position: relative;
  background: #ffffff;
}
.gilb-kaleidoscope-tile:hover {
  transform: rotate(0deg) scale(1.08) !important;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.25);
  z-index: 10;
  transition: transform 0.25s ease, box-shadow 0.25s ease, z-index 0s linear;
}

/* ── COVER TILE ─────────────────────────────────────────────────────────── */
.gilb-tile-cover {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 12px 10px 12px;
  position: relative;
  color: #ffffff;
}
.gilb-tile-cover-title {
  font-family: 'Times New Roman', Georgia, serif;
  font-weight: 700;
  font-size: 15px;
  line-height: 1.18;
  letter-spacing: 0.2px;
  text-align: center;
  color: #ffffff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  word-break: break-word;
  hyphens: auto;
  margin-top: 18px;
}
.gilb-tile-cover-author {
  font-family: 'Times New Roman', Georgia, serif;
  font-style: italic;
  font-size: 10px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  text-align: center;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 4px;
}
.gilb-tile-cover-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: rgba(255, 255, 255, 0.18);
}

/* Compact-mode cover sizing */
.gilb-kaleidoscope--compact .gilb-tile-cover-title { font-size: 12px; margin-top: 8px; }
.gilb-kaleidoscope--compact .gilb-tile-cover-author { font-size: 8px; }

/* ── ILLUSTRATION TILE ──────────────────────────────────────────────────── */
.gilb-tile-ill {
  width: 100%;
  height: 100%;
  position: relative;
  background: #f1f5f9;
}
.gilb-tile-ill-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.gilb-tile-ill-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 5px 8px 6px 8px;
  background: linear-gradient(to top, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0) 100%);
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 4px;
  font-size: 9px;
  line-height: 1.2;
}
.gilb-tile-ill-book {
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gilb-tile-ill-page {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 9px;
  opacity: 0.85;
  flex-shrink: 0;
}
</style>
