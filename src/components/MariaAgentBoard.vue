<!-- UNIT_TYPE=Widget -->
<!-- MariaAgentBoard.vue — Board Work Parse agent panel.
     Full-screen panel for the Maria agent. Accepts a pasted board document,
     runs the AI analysis, presents the four-section MariaResult, collects a
     Todd usefulness rating (−100 to +100), and emails the report.

     UI Rules applied:
       - CloseDot at END of header — Universal Close-Button Rule
       - ScrollContainer for all scrollable regions — Universal Scroll Rule
       - z-[493] backdrop / z-[497] card — Major surfaces tier (380–600)
         so SelectionDefiner at z-[10100] stays above this panel
       - All buttons have title= — DD-009 / Interaction Disclosure Rule (Rule 7)
       - No select-none on body content — Define-by-Selection Rule
       - Email via openEml() — Tom Gilb 2026-05-29: "I do not want to paste
         into the email. I want it ready pasted." (useEmlExport.ts pattern)

     Tom Gilb, 2026-05-29:
       "Input: Board documents (Todd uploads). Process: Parse decisions /
        Classify by governance layer / Flag authority clarity gaps / Surface
        decision gaps / Identify governance patterns. Output: Decision inventory
        (tagged by layer) / Authority clarity report / Governance gap list /
        Pattern analysis. Tone: Opportunities for board action, not problems.
        Success metric: Todd rates usefulness −100 to +100. Deliverable: Email
        to Todd + board Friday EOD."
-->

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import CloseDot from './CloseDot.vue'
import ScrollContainer from './ScrollContainer.vue'
import EmailGlyph from './icons/EmailGlyph.vue'
import { useMaria } from '../composables/useMaria'
import { openEml }             from '../composables/useEmlExport'
import { buildMariaEmailHtml } from '../lib/maria/email'

const emit = defineEmits<{
  close: []
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const { loading, error, result, analyse, reset } = useMaria()

/** The raw board document text pasted by the user. */
const documentText = ref('')

/** Which result sections are expanded. All open by default. */
const sectionOpen = ref({
  decisions: true,
  authority: true,
  gaps: true,
  patterns: true,
})

/** Todd's usefulness rating: −100 to +100. null = not yet rated. */
const rating = ref<number | null>(null)
const ratingInteracted = ref(false)

/** "To:" addresses for the email report (editable by user). */
const emailTo = ref('')

/** Controls the "report sent" flash state. */
const reportSent = ref(false)
let _sentTimer: ReturnType<typeof setTimeout> | null = null

// ─── Computed helpers ─────────────────────────────────────────────────────────

const hasDocument = computed(() => documentText.value.trim().length > 0)
const hasResult = computed(() => result.value !== null)

const ratingLabel = computed(() => {
  if (rating.value === null) return 'Not yet rated'
  if (rating.value >= 80)  return '🌟 Highly useful'
  if (rating.value >= 50)  return '✅ Very useful'
  if (rating.value >= 20)  return '👍 Useful'
  if (rating.value >= 0)   return '➡️ Neutral'
  if (rating.value >= -30) return '🤔 Marginally useful'
  if (rating.value >= -60) return '⚠️ Questionable value'
  return '❌ Not useful'
})

const ratingColor = computed(() => {
  if (rating.value === null) return 'text-slate-400'
  if (rating.value >= 50)  return 'text-emerald-600'
  if (rating.value >= 0)   return 'text-slate-600'
  if (rating.value >= -50) return 'text-amber-600'
  return 'text-red-600'
})

const layerColor: Record<string, string> = {
  board:      'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  management: 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200',
  operations: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  moderate: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  advisory: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function runAnalysis(): Promise<void> {
  if (!hasDocument.value || loading.value) return
  await analyse(documentText.value)
}

function startOver(): void {
  documentText.value = ''
  rating.value = null
  ratingInteracted.value = false
  emailTo.value = ''
  reportSent.value = false
  if (_sentTimer) { clearTimeout(_sentTimer); _sentTimer = null }
  reset()
}

function onRatingInput(e: Event): void {
  const val = parseInt((e.target as HTMLInputElement).value, 10)
  rating.value = val
  ratingInteracted.value = true
}

// ─── Loading entertainment — Montessori photo carousel ───────────────────────

interface MonPhoto {
  url: string       // Wikimedia Commons or school photo URL; empty = styled fallback
  caption: string   // 1-2 sentence caption shown under photo
  label: string     // Short era / category badge text
}

/**
 * 30 Montessori photos: Maria Montessori portraits, historical classrooms,
 * modern schools, and Berkshire examples. Wikimedia Commons URLs are used
 * where images are public domain. Add Berkshire-specific school photo URLs
 * to items 25-30 when available.
 *
 * URL format: https://commons.wikimedia.org/wiki/Special:FilePath/FILENAME
 * (Wikimedia's stable redirect to the actual image — survives file moves.)
 */
const MONTESSORI_PHOTOS: MonPhoto[] = [
  // ── Maria Montessori Portraits — VERIFIED Wikimedia Commons URLs ─────────────
  // All URLs confirmed working 2026-05-30 via Wikimedia Commons category search.
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Maria_Montessori_%28portrait%29.jpg',
    caption: 'Maria Montessori (1870–1952) — physician, anthropologist, and educator. She was the first woman in Italy to earn a medical degree from the University of Rome, in 1896.',
    label: 'Maria Montessori · Portrait',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/La_conferenziera_medichessa_Montessori.jpg',
    caption: 'Maria Montessori as lecturer and physician, from L\'Illustrazione Popolare, 1899. She was already prominent as a public speaker on education reform before founding her first school.',
    label: 'Maria Montessori · 1899',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Maria_Montessori_%28um_1880%29.jpg',
    caption: 'Maria Montessori as a young woman, c. 1880. She grew up in Rome where her father was a civil servant. Her ambition to study medicine was opposed by her father but supported by her mother.',
    label: 'Maria Montessori · c. 1880',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Maria_Montessori_LCCN2014694934.jpg',
    caption: 'Maria Montessori, c. 1910 — Library of Congress Bain Collection. By this year she had opened the first Casa dei Bambini (1907) and published The Montessori Method (1909).',
    label: 'Maria Montessori · 1910 (LoC)',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/55/Maria_Montessori1913.jpg',
    caption: 'Maria Montessori, 1913, during her first American lecture tour. Her visit sparked enormous interest; Alexander Graham Bell hosted a Montessori class in his own home.',
    label: 'Maria Montessori · 1913',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Maria_Montessori1913-Colorized.jpg',
    caption: 'Maria Montessori, 1913 (colourised). At this time she was simultaneously practising medicine, lecturing internationally, and developing the didactic materials that define Montessori classrooms today.',
    label: 'Maria Montessori · 1913 (colour)',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Dr._Maria_Montessori.jpg',
    caption: 'Dr. Maria Montessori — from "A Guide to the Montessori Method" (1913), one of the first English-language books to document and promote her educational approach.',
    label: 'Maria Montessori · Dr. Portrait',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Maria_Montessori_als_jonge_vrouw%2C_SFA001014153.jpg',
    caption: 'Maria Montessori as a young woman, Spaarnestad Photo archive. The Netherlands became one of the earliest and most enthusiastic adopters of her method, from around 1914.',
    label: 'Maria Montessori · Young Woman',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Montessori_Arundale.png',
    caption: 'Maria Montessori (right) with her son Mario and theosophist George Arundale and his wife Rukmini Devi Arundale, India, 1939. She was interned in India during WWII, training over 1,000 teachers.',
    label: 'Maria Montessori · India 1939',
  },
  // ── Historical Sites & Documents ────────────────────────────────────────────
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Casa_natale_di_Maria_Montessori_a_Chiaravalle_%28Ancona%29.JPG',
    caption: 'Maria Montessori\'s birthplace in Chiaravalle, near Ancona, Italy — now a museum. She was born here on 31 August 1870, the only child of Alessandro Montessori and Renilde Stoppani.',
    label: 'Birthplace · Chiaravalle, Italy',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Maria_Montessori_1970_stamp_of_India.jpg',
    caption: 'Indian commemorative stamp marking Maria Montessori\'s 100th birth anniversary, 1970. India held a special place for her — she spent seven wartime years there and called it her second home.',
    label: 'India · Centenary Stamp 1970',
  },
  // ── Historical Classrooms — verified where possible ──────────────────────────
  {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Montessori_class_at_Alexander_Graham_Bell%27s_home.jpg',
    caption: 'A Montessori class at Alexander Graham Bell\'s home in Washington DC, 1912. Bell and his wife Mabel were among the earliest and most prominent American supporters of the method.',
    label: 'Historical · Washington DC 1912',
  },
  {
    url: '',
    caption: 'The first Casa dei Bambini (Children\'s House), Via dei Marsi 58, San Lorenzo, Rome — opened 6 January 1907 in a tenement building serving the children of working-class families.',
    label: 'Casa dei Bambini · Rome 1907',
  },
  {
    url: '',
    caption: 'Children working independently in an early Montessori classroom, c. 1915. The child-sized furniture — revolutionary at the time — allowed children to choose their work and return materials to the shelf unaided.',
    label: 'Historical · Classroom c. 1915',
  },
  {
    url: '',
    caption: 'A Montessori classroom in the Netherlands, c. 1920. The Netherlands adopted the method enthusiastically from 1914 and today has the highest proportion of Montessori schools per capita in the world.',
    label: 'Historical · Netherlands 1920',
  },
  {
    url: '',
    caption: 'An outdoor Montessori classroom, c. 1930. Montessori believed that the prepared environment extended beyond the classroom walls — outdoor spaces for observation, gardening, and free movement were essential.',
    label: 'Historical · Outdoor 1930s',
  },
  {
    url: '',
    caption: 'AMI (Association Montessori Internationale) teacher training, 1950s. AMI was founded by Montessori herself in 1929 to protect the integrity of her method across all affiliated schools worldwide.',
    label: 'Historical · AMI Training 1950s',
  },
  {
    url: '',
    caption: 'A Montessori classroom in Kodaikanal, India, c. 1944 — during Maria Montessori\'s wartime internment. She developed the Cosmic Education curriculum for older children during this period.',
    label: 'Historical · India 1944',
  },
  // ── Modern Global Classrooms ────────────────────────────────────────────────
  {
    url: '',
    caption: 'A modern Montessori Children\'s House (ages 3–6). The classroom is divided into five curriculum areas: Practical Life, Sensorial, Language, Mathematics, and Cultural Studies.',
    label: 'Modern · Children\'s House',
  },
  {
    url: '',
    caption: 'A contemporary Montessori primary classroom. Children across a three-year age span work side by side — older children mentor younger ones, reinforcing their own learning through teaching.',
    label: 'Modern · Primary Classroom',
  },
  {
    url: '',
    caption: 'A Montessori Nido (nest) programme for children from 6 weeks to 18 months. Every element of the environment is scaled precisely to infant proportions to support independent movement from the earliest weeks.',
    label: 'Modern · Nido Programme',
  },
  {
    url: '',
    caption: 'A Montessori adolescent programme (ages 12–18) combining rigorous academics with real-world enterprise — running a farm, restaurant, or shop addresses the adolescent\'s urgent need for social relevance.',
    label: 'Modern · Adolescent Programme',
  },
  {
    url: '',
    caption: 'A child composing words with the Moveable Alphabet. Writing consistently precedes formal reading in Montessori — children encode language in physical form before they decode it on a page.',
    label: 'Modern · Moveable Alphabet',
  },
  {
    url: '',
    caption: 'Practical Life activities: pouring, polishing, folding, care of plants. Each task is a concentration exercise — the same neural pathways built by careful pouring are later used for algebra and essay writing.',
    label: 'Modern · Practical Life',
  },
  {
    url: '',
    caption: 'Children working with Golden Bead material. The physical weight of a thousand-bead cube gives children a visceral understanding of magnitude — one they carry into abstract mathematics for life.',
    label: 'Modern · Golden Beads',
  },
  // ── Berkshire Montessori Schools ────────────────────────────────────────────
  // Add school photography URLs below when available.
  // Berkshire Hills Montessori School: https://www.berkshirehillsmontessori.org
  {
    url: '',
    caption: 'Berkshire Hills Montessori School, Great Barrington, Massachusetts — founded 1980. Serves infants through adolescents with a full AMI-aligned curriculum across four programmes in the Housatonic Valley.',
    label: 'Berkshire Hills · Great Barrington MA',
  },
  {
    url: '',
    caption: 'Berkshire Hills Montessori School outdoor campus. The school\'s Housatonic Valley setting integrates surrounding woodland directly into practical life, science, and adolescent farm enterprise curriculum.',
    label: 'Berkshire Hills · Outdoor Campus',
  },
  {
    url: '',
    caption: 'A Montessori school in the English county of Berkshire — the county has one of England\'s highest concentrations of AMI-affiliated settings, a tradition stretching back to Montessori\'s own visits to Britain in the 1910s.',
    label: 'Berkshire England · AMI School',
  },
  {
    url: '',
    caption: 'Montessori St. Nicholas Charity — the national body for Montessori education in England. It supports over 700 registered settings and training centres, including several in Berkshire and the Thames Valley.',
    label: 'Montessori St. Nicholas · UK',
  },
  {
    url: '',
    caption: 'Montessori is today the world\'s largest alternative education movement: over 20,000 schools in more than 110 countries, serving children from 6 weeks to 18 years across every culture and income level.',
    label: 'Montessori · Global 2025',
  },
]

// ─── Loading animation state ───────────────────────────────────────────────────

const elapsed           = ref(0)
const simulatedProgress = ref(0)
const activeFactIdx     = ref(0)
/** Tracks which photo indices have failed to load — falls back to styled placeholder. */
const failedPhotos      = ref(new Set<number>())

let _elapsedTimer: ReturnType<typeof setInterval> | null = null
let _factTimer:   ReturnType<typeof setInterval> | null = null

function _startLoadingAnimation(): void {
  elapsed.value           = 0
  simulatedProgress.value = 0
  failedPhotos.value      = new Set()
  activeFactIdx.value     = Math.floor(Math.random() * MONTESSORI_PHOTOS.length)

  // Tick every second: update elapsed + logarithmic progress (asymptotes at 95%)
  _elapsedTimer = setInterval(() => {
    elapsed.value++
    simulatedProgress.value = Math.round(95 * (1 - Math.exp(-elapsed.value / 18)))
  }, 1000)

  // Rotate photos every 10 s (Tom 2026-05-30)
  _factTimer = setInterval(() => {
    activeFactIdx.value = (activeFactIdx.value + 1) % MONTESSORI_PHOTOS.length
  }, 10_000)
}

/** Mark a photo as failed so the styled fallback renders instead. */
function handlePhotoError(idx: number): void {
  const next = new Set(failedPhotos.value)
  next.add(idx)
  failedPhotos.value = next
}

function prevPhoto(): void {
  activeFactIdx.value = (activeFactIdx.value - 1 + MONTESSORI_PHOTOS.length) % MONTESSORI_PHOTOS.length
}

function nextPhoto(): void {
  activeFactIdx.value = (activeFactIdx.value + 1) % MONTESSORI_PHOTOS.length
}

function _stopLoadingAnimation(): void {
  if (_elapsedTimer) { clearInterval(_elapsedTimer); _elapsedTimer = null }
  if (_factTimer)   { clearInterval(_factTimer);   _factTimer   = null }
  simulatedProgress.value = 100
}

/** Human-readable phase label that matches the simulated progress percentage. */
const phaseLabel = computed<string>(() => {
  const p = simulatedProgress.value
  if (p < 12) return 'Reading board document…'
  if (p < 30) return 'Extracting decisions…'
  if (p < 58) return 'Classifying governance layers…'
  if (p < 78) return 'Identifying authority gaps…'
  if (p < 94) return 'Finalising analysis…'
  return 'Almost done…'
})

watch(loading, (isLoading: boolean) => {
  if (isLoading) _startLoadingAnimation()
  else           _stopLoadingAnimation()
})

onUnmounted(_stopLoadingAnimation)

// ─── Email export ─────────────────────────────────────────────────────────────

// buildMariaEmailHtml is imported from lib/maria/email — pure, portable, no Vue.


function sendEmailReport(): void {
  if (!result.value) return
  const html = buildMariaEmailHtml(result.value, {
    ratingValue:      rating.value,
    ratingLabel:      ratingLabel.value,
    ratingInteracted: ratingInteracted.value,
  })
  const to = emailTo.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  openEml(html, '🏛 Maria — Board Governance Analysis', { to })
  reportSent.value = true
  if (_sentTimer) clearTimeout(_sentTimer)
  _sentTimer = setTimeout(() => { reportSent.value = false }, 4000)
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[493] bg-black/60 backdrop-blur-sm"
      aria-hidden="true"
      @click="emit('close')"
    />

    <!-- Panel card -->
    <div
      class="fixed inset-0 z-[497] flex items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="Maria Agent — Board Work Parse"
    >
      <div
        class="pointer-events-auto w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white ring-1 ring-black/10"
      >

        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-800 to-emerald-700 shrink-0">
          <span class="text-2xl" aria-hidden="true">🏛</span>
          <div class="flex-1 min-w-0">
            <h2 class="text-base font-bold text-white leading-tight tracking-tight">Maria — Board Work Parse</h2>
            <p class="text-[11px] text-white/60 leading-tight mt-0.5">
              Decision inventory · Authority clarity · Governance gaps · Pattern analysis
            </p>
          </div>
          <!-- Start over button — only when result is present -->
          <button
            v-if="hasResult"
            type="button"
            class="shrink-0 text-[11px] font-semibold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all"
            title="Start over — clear the current analysis and paste a new board document"
            @click="startOver"
          >
            Start over
          </button>
          <CloseDot
            variant="on-dark"
            aria-label="Close Maria Agent Board"
            title="Close Maria Agent — return to the Agent Menu or main workspace"
            @click="emit('close')"
          />
        </div>

        <!-- Body -->
        <ScrollContainer
          outer-class="flex-1 min-h-0 relative"
          inner-class="p-5"
        >

          <!-- ─── Loading phase ──────────────────────────────────────────── -->
          <div v-if="loading" class="py-4">

            <!-- Progress + timer row -->
            <div class="flex items-baseline justify-between mb-2 px-1">
              <span class="text-2xl font-black text-emerald-700 tabular-nums leading-none">
                {{ simulatedProgress }}%
              </span>
              <span class="text-xs text-slate-400 tabular-nums">
                {{ elapsed }}s elapsed
              </span>
            </div>

            <!-- Animated progress bar -->
            <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-1.5">
              <div
                class="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 transition-all duration-1000 ease-out"
                :style="{ width: simulatedProgress + '%' }"
                role="progressbar"
                :aria-valuenow="simulatedProgress"
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>

            <!-- Phase label — deliberately visible: sm text, icon, bold -->
            <div class="flex items-center gap-2 mb-5 px-1">
              <svg class="w-3.5 h-3.5 text-emerald-500 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p class="text-sm text-emerald-800 font-semibold transition-all duration-700">
                {{ phaseLabel }}
              </p>
            </div>

            <!-- Photo carousel — Montessori Through the Decades -->
            <div class="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">

              <!-- Header row: label + counter -->
              <div class="flex items-center justify-between px-4 pt-3 pb-2">
                <span class="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                  Montessori Through the Decades
                </span>
                <span class="text-[10px] text-slate-400 tabular-nums font-medium">
                  {{ activeFactIdx + 1 }} / {{ MONTESSORI_PHOTOS.length }}
                </span>
              </div>

              <!-- Photo or styled fallback -->
              <div class="relative mx-3 rounded-xl overflow-hidden bg-emerald-100" style="height:190px;">
                <!-- Real photo (hidden if URL empty or failed to load) -->
                <img
                  v-if="MONTESSORI_PHOTOS[activeFactIdx].url && !failedPhotos.has(activeFactIdx)"
                  :key="activeFactIdx"
                  :src="MONTESSORI_PHOTOS[activeFactIdx].url"
                  :alt="MONTESSORI_PHOTOS[activeFactIdx].caption"
                  class="w-full h-full object-cover transition-opacity duration-500"
                  loading="lazy"
                  @error="handlePhotoError(activeFactIdx)"
                />
                <!-- Fallback: styled gradient with 📷 when URL is missing or image failed -->
                <div
                  v-else
                  class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-200 to-teal-200"
                >
                  <span class="text-5xl mb-2" aria-hidden="true">📷</span>
                  <span class="text-xs text-emerald-800 font-semibold text-center px-6 leading-snug">
                    {{ MONTESSORI_PHOTOS[activeFactIdx].label }}
                  </span>
                  <span class="text-[10px] text-emerald-600 mt-1">Photo coming soon</span>
                </div>
                <!-- Era badge overlay -->
                <div class="absolute bottom-2 left-2 bg-black/55 backdrop-blur-sm rounded-lg px-2.5 py-1">
                  <span class="text-[10px] font-bold text-white tracking-wide">
                    {{ MONTESSORI_PHOTOS[activeFactIdx].label }}
                  </span>
                </div>
              </div>

              <!-- Caption text -->
              <div class="px-4 pt-3 pb-2">
                <p class="text-xs text-slate-700 leading-relaxed">
                  {{ MONTESSORI_PHOTOS[activeFactIdx].caption }}
                </p>
              </div>

              <!-- Progress strip -->
              <div class="h-0.5 bg-emerald-100 mx-4 rounded-full mb-3">
                <div
                  class="h-full bg-emerald-400 rounded-full transition-all duration-700"
                  :style="{ width: ((activeFactIdx + 1) / MONTESSORI_PHOTOS.length * 100) + '%' }"
                />
              </div>

              <!-- Prev / counter / Next navigation -->
              <div class="flex items-center justify-between px-4 pb-4">
                <button
                  type="button"
                  title="Previous photo — single-click to go back one"
                  aria-label="Previous Montessori photo"
                  class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 transition-colors text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  @click="prevPhoto"
                >
                  ◀ Prev
                </button>
                <span class="text-[10px] text-slate-400 tabular-nums">
                  rotates every 10 s
                </span>
                <button
                  type="button"
                  title="Next photo — single-click to advance one"
                  aria-label="Next Montessori photo"
                  class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 transition-colors text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  @click="nextPhoto"
                >
                  Next ▶
                </button>
              </div>

            </div>

          </div>

          <!-- ─── Input phase ─────────────────────────────────────────────── -->
          <div v-else-if="!hasResult">

            <!-- Intro blurb -->
            <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-5">
              <h3 class="text-sm font-semibold text-emerald-900 mb-1">What Maria does</h3>
              <p class="text-xs text-emerald-800 leading-relaxed">
                Maria analyses board documents — minutes, resolutions, strategy papers, committee reports —
                and produces a structured governance intelligence report with four sections:
                Decision Inventory, Authority Clarity Report, Governance Gap List, and Pattern Analysis.
                All findings are framed as opportunities for board action, never as problems.
              </p>
            </div>

            <!-- Document input -->
            <div class="mb-4">
              <label class="block text-sm font-semibold text-slate-700 mb-2" for="maria-document-input">
                Paste the board document
              </label>
              <p class="text-xs text-slate-500 mb-3 leading-relaxed">
                Paste any board-level text: minutes, a resolution, a strategy paper, or a committee report.
                Maria reads the full document and extracts every decision, classifies each by governance layer,
                and surfaces authority and governance gaps.
              </p>
              <textarea
                id="maria-document-input"
                v-model="documentText"
                rows="12"
                class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                placeholder="Paste board minutes, resolution, strategy paper, or committee report here…"
                :disabled="loading"
              />
              <p class="text-xs text-slate-400 mt-1.5 text-right">
                {{ documentText.trim().split(/\s+/).filter(Boolean).length }} words
              </p>
            </div>

            <!-- Error message -->
            <div
              v-if="error"
              class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4 text-sm text-red-800 leading-relaxed"
              role="alert"
            >
              <span class="font-semibold">Error:</span> {{ error }}
            </div>

            <!-- Analyse button -->
            <button
              type="button"
              :disabled="!hasDocument || loading"
              class="w-full rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              :class="hasDocument && !loading
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'"
              title="Analyse board document — Maria will extract all decisions, classify them by governance layer, identify authority gaps, flag governance gaps, and analyse patterns. Takes 10–30 seconds."
              @click="runAnalysis"
            >
              <span v-if="loading" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Maria is analysing the document…
              </span>
              <span v-else>
                {{ hasDocument ? '🏛 Analyse Board Document →' : 'Paste a board document above to begin' }}
              </span>
            </button>

          </div>

          <!-- ─── Result phase ────────────────────────────────────────────── -->
          <div v-else-if="result">

            <!-- Summary bar -->
            <div class="grid grid-cols-4 gap-3 mb-5">
              <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                <div class="text-2xl font-black text-emerald-700">{{ result.decisionInventory.length }}</div>
                <div class="text-[10px] text-emerald-600 font-semibold mt-0.5">Decisions</div>
              </div>
              <div class="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-center">
                <div class="text-2xl font-black text-indigo-700">{{ result.authorityReport.length }}</div>
                <div class="text-[10px] text-indigo-600 font-semibold mt-0.5">Authority Gaps</div>
              </div>
              <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                <div class="text-2xl font-black text-amber-700">{{ result.governanceGaps.length }}</div>
                <div class="text-[10px] text-amber-600 font-semibold mt-0.5">Gov. Gaps</div>
              </div>
              <div class="rounded-xl bg-violet-50 border border-violet-200 p-3 text-center">
                <div class="text-2xl font-black text-violet-700">{{ result.patternAnalysis.length }}</div>
                <div class="text-[10px] text-violet-600 font-semibold mt-0.5">Patterns</div>
              </div>
            </div>

            <!-- ── Section 1: Decision Inventory ── -->
            <div class="rounded-xl border border-emerald-200 overflow-hidden mb-4">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left"
                title="Decision Inventory — expand or collapse the list of all decisions extracted from the board document, each classified by governance layer (Board / Management / Operations)"
                @click="sectionOpen.decisions = !sectionOpen.decisions"
              >
                <span class="text-sm font-bold text-emerald-800 flex-1">🗂 Decision Inventory</span>
                <span class="text-xs text-emerald-600 font-semibold">{{ result.decisionInventory.length }} decisions</span>
                <span class="text-emerald-500 text-xs ml-1">{{ sectionOpen.decisions ? '▲' : '▼' }}</span>
              </button>
              <div v-if="sectionOpen.decisions" class="divide-y divide-emerald-100">
                <div
                  v-for="d in result.decisionInventory"
                  :key="d.id"
                  class="px-4 py-3 bg-white hover:bg-emerald-50/30 transition-colors"
                >
                  <div class="flex items-start gap-2 mb-1.5">
                    <span class="text-xs font-black text-slate-400 shrink-0 mt-0.5 w-6">{{ d.id }}</span>
                    <p class="text-xs text-slate-800 leading-relaxed flex-1">{{ d.text }}</p>
                    <span
                      class="shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                      :class="layerColor[d.layer] ?? 'bg-slate-100 text-slate-600'"
                    >{{ d.layer }}</span>
                  </div>
                  <div v-if="d.authorityGapFlagged" class="ml-8 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mt-1.5">
                    <p class="text-[10px] text-amber-800 leading-relaxed">
                      <span class="font-bold">⚑ Authority gap:</span> {{ d.authorityGapNote }}
                    </p>
                  </div>
                  <p class="ml-8 text-[10px] text-slate-400 leading-relaxed mt-1">{{ d.layerRationale }}</p>
                </div>
              </div>
            </div>

            <!-- ── Section 2: Authority Report ── -->
            <div class="rounded-xl border border-indigo-200 overflow-hidden mb-4">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
                title="Authority Clarity Report — expand or collapse the list of authority clarity gaps found in the board document, with severity rating and opportunity for board action"
                @click="sectionOpen.authority = !sectionOpen.authority"
              >
                <span class="text-sm font-bold text-indigo-800 flex-1">⚑ Authority Clarity Report</span>
                <span class="text-xs font-semibold" :class="result.authorityReport.length > 0 ? 'text-indigo-600' : 'text-emerald-600'">
                  {{ result.authorityReport.length > 0 ? `${result.authorityReport.length} gap${result.authorityReport.length !== 1 ? 's' : ''}` : '✓ None found' }}
                </span>
                <span class="text-indigo-400 text-xs ml-1">{{ sectionOpen.authority ? '▲' : '▼' }}</span>
              </button>
              <div v-if="sectionOpen.authority">
                <div v-if="result.authorityReport.length === 0" class="px-4 py-3 text-xs text-emerald-700 bg-white">
                  No authority clarity gaps were identified in this document. ✓
                </div>
                <div
                  v-for="a in result.authorityReport"
                  :key="a.decisionIds.join('-')"
                  class="px-4 py-3 bg-white border-t border-indigo-100"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] text-slate-500">Decisions: <strong class="text-slate-700">{{ a.decisionIds.join(', ') }}</strong></span>
                    <span
                      class="ml-auto text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                      :class="severityColor[a.severity] ?? 'bg-slate-100 text-slate-600'"
                    >{{ a.severity }}</span>
                  </div>
                  <p class="text-xs text-slate-700 leading-relaxed mb-1.5"><strong class="text-slate-900">Issue:</strong> {{ a.issue }}</p>
                  <p class="text-xs text-emerald-800 leading-relaxed"><strong>Opportunity:</strong> {{ a.opportunity }}</p>
                </div>
              </div>
            </div>

            <!-- ── Section 3: Governance Gaps ── -->
            <div class="rounded-xl border border-amber-200 overflow-hidden mb-4">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors text-left"
                title="Governance Gaps — topics that should have a board decision recorded but do not; expand to see each gap and the opportunity for board action"
                @click="sectionOpen.gaps = !sectionOpen.gaps"
              >
                <span class="text-sm font-bold text-amber-800 flex-1">📋 Governance Gaps</span>
                <span class="text-xs font-semibold" :class="result.governanceGaps.length > 0 ? 'text-amber-600' : 'text-emerald-600'">
                  {{ result.governanceGaps.length > 0 ? `${result.governanceGaps.length} gap${result.governanceGaps.length !== 1 ? 's' : ''}` : '✓ None found' }}
                </span>
                <span class="text-amber-400 text-xs ml-1">{{ sectionOpen.gaps ? '▲' : '▼' }}</span>
              </button>
              <div v-if="sectionOpen.gaps">
                <div v-if="result.governanceGaps.length === 0" class="px-4 py-3 text-xs text-emerald-700 bg-white">
                  No governance gaps were identified in this document. ✓
                </div>
                <div
                  v-for="g in result.governanceGaps"
                  :key="g.id"
                  class="px-4 py-3 bg-white border-t border-amber-100"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] font-black text-slate-400">{{ g.id }}</span>
                    <span class="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{{ g.category }}</span>
                  </div>
                  <p class="text-xs text-slate-700 leading-relaxed mb-1.5"><strong>Significance:</strong> {{ g.significance }}</p>
                  <p class="text-xs text-emerald-800 leading-relaxed"><strong>Opportunity:</strong> {{ g.opportunity }}</p>
                </div>
              </div>
            </div>

            <!-- ── Section 4: Pattern Analysis ── -->
            <div class="rounded-xl border border-violet-200 overflow-hidden mb-5">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors text-left"
                title="Governance Pattern Analysis — recurring themes in how the board operates; expand to see strengths and concerns with opportunities for action"
                @click="sectionOpen.patterns = !sectionOpen.patterns"
              >
                <span class="text-sm font-bold text-violet-800 flex-1">🔮 Governance Patterns</span>
                <span class="text-xs text-violet-600 font-semibold">{{ result.patternAnalysis.length }} patterns</span>
                <span class="text-violet-400 text-xs ml-1">{{ sectionOpen.patterns ? '▲' : '▼' }}</span>
              </button>
              <div v-if="sectionOpen.patterns" class="divide-y divide-violet-100">
                <div
                  v-for="p in result.patternAnalysis"
                  :key="p.id"
                  class="px-4 py-3 bg-white"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] font-black text-slate-400">{{ p.id }}</span>
                    <span
                      class="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                      :class="p.type === 'strength' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-100 text-red-700 ring-1 ring-red-200'"
                    >{{ p.type }}</span>
                    <span class="text-xs font-semibold text-slate-700 flex-1">{{ p.label }}</span>
                  </div>
                  <p class="text-xs text-slate-700 leading-relaxed mb-1.5">{{ p.description }}</p>
                  <p class="text-xs text-emerald-800 leading-relaxed"><strong>Opportunity:</strong> {{ p.opportunity }}</p>
                  <p v-if="p.evidenceDecisionIds.length" class="text-[10px] text-slate-400 mt-1">
                    Evidence: decisions {{ p.evidenceDecisionIds.join(', ') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- ── Todd Rating Widget ── -->
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
              <h4 class="text-sm font-bold text-slate-700 mb-1">Todd's Usefulness Rating</h4>
              <p class="text-xs text-slate-500 mb-3 leading-relaxed">
                Rate how useful this analysis was for board action planning. −100 = no value at all, +100 = highly valuable.
                Your rating helps improve Maria's next analysis.
              </p>
              <div class="flex items-center gap-3 mb-2">
                <span class="text-xs text-slate-500 w-8 text-right shrink-0">−100</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  :value="rating ?? 0"
                  class="flex-1 accent-emerald-600"
                  title="Todd usefulness rating slider — drag from -100 (no value) to +100 (highly valuable) to rate how useful this Maria analysis was"
                  @input="onRatingInput"
                />
                <span class="text-xs text-slate-500 w-8 shrink-0">+100</span>
              </div>
              <div class="text-center">
                <span
                  class="text-sm font-bold"
                  :class="ratingColor"
                >
                  {{ ratingInteracted ? `${rating! > 0 ? '+' : ''}${rating}` : '—' }} · {{ ratingLabel }}
                </span>
              </div>
            </div>

            <!-- ── Email Report ── -->
            <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h4 class="text-sm font-bold text-emerald-900 mb-1">📧 Email Report to Board</h4>
              <p class="text-xs text-emerald-700 mb-3 leading-relaxed">
                Send the full Maria governance analysis to Todd and the board.
                Mail.app will open with the complete colored HTML report pre-filled — no pasting required.
              </p>
              <div class="flex gap-2 mb-3">
                <input
                  v-model="emailTo"
                  type="email"
                  multiple
                  class="flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="todd@board.org, chair@board.org (comma-separated)"
                  title="Email recipients — enter one or more email addresses separated by commas. Mail.app will open with the full report pre-filled in the body."
                />
              </div>
              <button
                type="button"
                class="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                :class="reportSent
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md'"
                title="Email Report — builds a fully formatted HTML governance report and opens it in Mail.app as a pre-filled compose draft. No pasting required. Delivers Decision Inventory, Authority Clarity Report, Governance Gaps, and Pattern Analysis."
                @click="sendEmailReport"
              >
                <EmailGlyph size="compact" class="text-current" aria-hidden="true" />
                <span>{{ reportSent ? '✓ Report opened in Mail' : 'Open Report in Mail →' }}</span>
              </button>
            </div>

          </div>
        </ScrollContainer>

      </div>
    </div>
  </Teleport>
</template>
