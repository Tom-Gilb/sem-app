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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import CloseDot from './CloseDot.vue'
import EmailGlyph from './icons/EmailGlyph.vue'
import { useMaria, cancelCurrentMaria, mariaStreamedText, debugLogs } from '../composables/useMaria'
import { openEml }             from '../composables/useEmlExport'
import { buildMariaEmailHtml } from '../lib/maria/email'
import type { MariaResult }    from '../types/maria'
import { matchMembersToItem }  from '../lib/maria/boardMatcher'
import { lastMariaResult }     from '../lib/maria/mariaResultStore'
import { useBoardMembers }     from '../composables/useBoardMembers'
import type { MemberMatch }    from '../lib/maria/boardMatcher'

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

/** Controls Board Members collapsible panel (collapsed by default). */
const boardOpen = ref(false)

/** Controls debug logs collapsible panel (collapsed by default). */
const debugOpen = ref(false)

/** Template ref for debug logs container — auto-scrolls to bottom when logs update. */
const debugLogsContainer = ref<HTMLDivElement | null>(null)

// ── Live board member roster (localStorage-backed, same data as MariaBoardHub) ──
const { members: boardMembersLive } = useBoardMembers()

// ── Write each successful analysis to the module-level result store so
//    MariaBoardHub's "Import from last analysis" button can access it. ──────────
watch(result, (r) => { if (r) lastMariaResult.value = r })

// Auto-scroll debug logs to bottom when new messages arrive
watch(debugLogs, () => {
  nextTick(() => {
    if (debugLogsContainer.value) {
      debugLogsContainer.value.scrollTop = debugLogsContainer.value.scrollHeight
    }
  })
}, { deep: true })

// ─── Computed helpers ─────────────────────────────────────────────────────────

const hasDocument   = computed(() => documentText.value.trim().length > 0)
const hasResult     = computed(() => result.value !== null)
const shouldShowResult = computed(() => result.value !== null && typeof result.value === 'object')
/** Live char count of streaming response — non-zero once API starts sending tokens back. */
const streamedChars = computed(() => mariaStreamedText.value.length)

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

/**
 * Auto-start handler — fires when the user pastes into the document textarea.
 * Waits 150 ms for the paste to populate documentText, then starts analysis
 * automatically. No button click needed.
 *
 * Guard: skips if already loading (prevents duplicate calls when the user
 * pastes while a previous analysis is still running).
 */
function onDocumentPaste(): void {
  setTimeout(() => {
    if (hasDocument.value && !loading.value) {
      runAnalysis()
    }
  }, 150)
}

function runAnalysis(): void {
  try {
    if (!hasDocument.value) {
      console.log('[Maria] No document, returning')
      return
    }

    console.log('[Maria] Starting analysis, calling analyse()...')

    // Auto-open the debug panel so Tom can see live log entries during analysis
    debugOpen.value = true

    // Start background analysis with a callback that opens the email when done
    analyse(documentText.value, (mariaResult: MariaResult | null) => {
      console.log('[Maria] Analysis complete callback fired, result:', !!mariaResult)

      if (!mariaResult) {
        // Analysis failed — show error toast, keep panel open
        console.error('[Maria] Analysis failed, keeping panel open')
        return
      }

      try {
        // Analysis succeeded — build email and open it
        console.log('[Maria] Building email HTML...')
        const emailHtml = buildMariaEmailHtml(mariaResult, {})
        const subject = `Maria Analysis Report — ${new Date().toLocaleDateString()}`

        console.log('[Maria] Opening email...')
        // Open the email with results pre-filled
        openEml(emailHtml, subject)

        console.log('[Maria] Closing panel...')
        // Close the panel (user now has the email open with results)
        emit('close')
      } catch (callbackErr) {
        console.error('[Maria] Error in completion callback:', callbackErr)
      }
    })

    console.log('[Maria] Analysis submitted — running in background')
  } catch (err) {
    console.error('[Maria] Error in runAnalysis:', err)
  }
}

function startOver(): void {
  documentText.value = ''
  rating.value = null
  ratingInteracted.value = false
  emailTo.value = ''
  reportSent.value = false
  if (_sentTimer) { clearTimeout(_sentTimer); _sentTimer = null }
  lastMariaResult.value = null   // clear the store so reopening the panel is clean
  reset()
}

/**
 * Cancel an in-flight analysis and return to the input phase.
 * The abort causes a rejection in useMaria → catch → loading=false.
 * error.value is set to "Cancelled" so the input phase shows without a red error.
 */
function cancelAnalysis(): void {
  cancelCurrentMaria()
  // useMaria's finally block sets loading=false; the catch sets error.value.
  // Override to a friendly message after a tick so the loading phase disappears.
  setTimeout(() => {
    error.value = ''   // suppress the AbortError — user chose to cancel, not an error
  }, 50)
}

function onRatingInput(e: Event): void {
  const val = parseInt((e.target as HTMLInputElement).value, 10)
  rating.value = val
  ratingInteracted.value = true
}

// ─── Sample document — short realistic board minutes for first-run testing ────

const SAMPLE_DOCUMENT = `Berkshire Hills Montessori School — Board of Trustees
Regular Meeting Minutes — 28 May 2026

Present: Sarah Chen (Chair), Michael Torres (Secretary), Patricia Williams (Treasurer),
         James Okafor (Education Committee), Linda Bergström (Community Relations)
Apologies: None. Meeting called to order at 7:04 PM.

1. MINUTES
The minutes of the April meeting were reviewed and approved without amendment.

2. FINANCIAL REPORT
The Treasurer presented the Q2 report. Operating expenses are running 3.2% under budget.
The board voted unanimously to approve a $15,000 transfer from the reserve fund to cover
unexpected HVAC repairs to the Elementary building.

3. ENROLLMENT
The Head of School reported 124 students, up from 112 a year ago. The Children's House
waitlist now stands at 37 families. No formal decision was taken on waitlist management policy.

4. CURRICULUM REVIEW
The board discussed the outdoor mathematics pilot in the Adolescent programme. Teacher
reports indicate strong engagement. The board expressed support for continuing the pilot
through June. No formal board resolution was recorded.

5. GOVERNANCE AND COMPLIANCE
The three-year policy review cycle has not been completed for the safeguarding and
complaints policies, last reviewed in 2023. The Chair undertook to confirm whether the
Head of School or the board holds authority to approve policy amendments below board
resolution level. No decision was recorded.

6. FUNDRAISING
Patricia Williams reported the annual gala raised $47,800 against a $45,000 target.
The board agreed in principle to retain the same event format next year but made no
resolution on budget, date, or responsible committee.

7. STRATEGIC PLANNING
The Chair raised the need to update the school's five-year strategic plan, last approved
in 2022. The board agreed to form a working group. Membership of the working group was
not decided and no timeline was set.

Meeting closed at 8:51 PM. Next meeting: 25 June 2026 at 7:00 PM.`

/**
 * Load the built-in sample board minutes and immediately start the analysis.
 * One-click test experience: cancels any in-flight call, clears prior result,
 * fills the textarea, then auto-runs runAnalysis() after a 100 ms tick.
 *
 * The 100 ms delay lets any previous analyse() abort propagate through the
 * catch block (which sets error.value to the AbortError message). We then
 * clear error.value before calling runAnalysis() so there is no confusing
 * error banner when the new call starts.
 */
function useSampleDocument(): void {
  cancelCurrentMaria()                 // stop any in-flight call
  lastMariaResult.value = null         // clear store so onMounted restore won't fire on next open
  reset()                              // result=null, error='' → input phase shows
  documentText.value = SAMPLE_DOCUMENT // fill textarea
  // Auto-start after 100 ms so the previous AbortError has time to propagate
  // through useMaria's catch block before we call runAnalysis().
  setTimeout(() => {
    error.value = ''   // suppress AbortError from the cancelled previous call
    runAnalysis()      // one-click test: load + analyse in a single button press
  }, 100)
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
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Martha_M._Simpson_classroom.jpg',
    caption: 'Montessori classroom, c. 1914 — photographed for Martha M. Simpson\'s landmark report documenting the method in practice. Child-sized tables, open shelving of didactic materials, and children choosing their own work were radical departures from the rigid rows of traditional schoolrooms.',
    label: 'Historical · Classroom c. 1914',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Martha_M._Simpson_report_children.jpg',
    caption: 'Children at work in a Montessori classroom, c. 1914 — from Martha M. Simpson\'s educational report. The concentration and purposeful self-direction visible in each child is what Montessori called "normalization" — the natural state of a child absorbed in meaningful, self-chosen work.',
    label: 'Historical · Classroom c. 1914',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Les_in_schoenen_poetsen_en_handen_wassen_-_Lesson_in_washing_hands_and_polishing_shoes_%283916314384%29.jpg',
    caption: 'Children at Eindhoven Montessori School practising shoe-polishing, Netherlands, 1933. Care for personal appearance and belongings is a core Montessori Practical Life activity — building fine-motor precision, concentration, and the pride of self-sufficiency.',
    label: 'Historical · Netherlands 1933',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/De_Lairessestraat_met_de_Amsterdamse_Montessorischool._Uitgave_de_Amsterdamse_Montessorischool%2C_Afb_PRKBB00491000003.jpg',
    caption: 'The Amsterdam Montessori School on De Lairessestraat — historic postcard, c. 1937. The Netherlands adopted the Montessori method from 1914 and became the country with the highest proportion of Montessori schools per capita in the world.',
    label: 'Historical · Amsterdam 1937',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Vijftig_jaar_Montessori-onderwijs._Tijdens_de_bijeenkomst_vlnr_pater_Nico_van_He%2C_Bestanddeelnr_920-7452.jpg',
    caption: 'Dutch Montessori Association commemorating fifty years of Montessori education in the Netherlands, 1967. Founded in 1914, the Dutch association grew to oversee hundreds of schools — making the Netherlands an internationally recognised model for Montessori practice.',
    label: 'Historical · 50 Years 1967',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/31/Huiskamer_wordt_Montessori_lokaal_in_Oktober_1939.jpg',
    caption: 'A living room being converted into a Montessori classroom, Hilversum, Netherlands, October 1939. The outbreak of World War II did not stop Montessori education — families and communities improvised prepared environments wherever children needed to learn.',
    label: 'Historical · Netherlands 1939',
  },
  // ── Berkshire Montessori School — live photography (berkshiremontessori.org) ─
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/10-29Overview_CH-09af6a2a-1920w.jpg',
    caption: 'Children\'s House at Berkshire Montessori (ages 3–6). Five curriculum areas — Practical Life, Sensorial, Language, Mathematics, and Cultural Studies — are woven together across a full three-year cycle with the same guide.',
    label: 'Berkshire · Children\'s House',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/10-29Overview_Toddler-1920w.jpg',
    caption: 'Toddler programme outdoors at Berkshire Montessori (18 months–3 years). Children develop independence, language, and gross-motor coordination through purposeful outdoor activity — exploring terrain, weather, and natural materials.',
    label: 'Berkshire · Toddler Outdoors',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/10-29Overview_Elem-1920w.jpg',
    caption: 'Elementary class with a guide at Berkshire Montessori (ages 6–9). The Cosmic Education curriculum connects everything — from the Big Bang to grammar — through the Great Stories, giving children a sense of their place in a unified universe.',
    label: 'Berkshire · Elementary',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/10-29Overview_AE-1920w.jpg',
    caption: 'Adolescent Erdkinder programme outdoors at Berkshire Montessori. The Erdkinder (\'children of the earth\') model places adolescents in a campus environment where farm enterprise, cooking, and building address the adolescent\'s need for real-world dignity.',
    label: 'Berkshire · Adolescent Erdkinder',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/Map-d49ddc0e-1920w.jpg',
    caption: 'A child works with a large puzzle map at Berkshire Montessori. Geography in the Montessori classroom is always tactile — children build land-and-water forms in clay and handle physical continent puzzles long before reading a flat map.',
    label: 'Berkshire · Puzzle Map',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/IMG_7144-9e89274c-1920w.jpeg',
    caption: 'Watercolour painting at Berkshire Montessori. Art is woven through the curriculum as expression of Sensorial work and cultural study — not a separate subject but a natural extension of the child\'s observed and imagined world.',
    label: 'Berkshire · Watercolour',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/image-f55df9e7-1920w.jpg',
    caption: 'Woodworking with safety goggles at Berkshire Montessori. Hand-tool carpentry refines fine-motor precision and builds the concentration, sequential thinking, and self-correction that are central to the Montessori method at every level.',
    label: 'Berkshire · Woodworking',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/Programs-CH-6-eb38d9cd-1920w.png',
    caption: 'Children in rain gear exploring rocks outdoors at Berkshire Montessori. Outdoor learning is fundamental — nature observation, weather resilience, and physical engagement with real terrain are core Practical Life experiences in all seasons.',
    label: 'Berkshire · Outdoor Exploration',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/Kabir-bees-1920w.jpg',
    caption: 'A student working with the school beehives at Berkshire Montessori. Beekeeping is part of the Adolescent farm enterprise — harvesting, processing, and selling honey integrates science, ecology, and economics into a single real-world cycle.',
    label: 'Berkshire · Beekeeping',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/Programs-AE-03-18492091-5d38ef45-1920w.png',
    caption: 'Garden work at Berkshire Montessori. Weeding, planting, and harvesting connect adolescents to ecological cycles while building patience, physical stamina, and a direct understanding of food systems from soil to table.',
    label: 'Berkshire · Garden & Farm',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/Maddie-flying-1920w.jpg',
    caption: 'A student on the high ropes course at Berkshire Montessori. The Erdkinder physical challenge programme builds trust, courage, and collaborative problem-solving — core capacities for adult civic and professional life.',
    label: 'Berkshire · Ropes Course',
  },
  {
    url: 'https://lirp.cdn-website.com/53d04bb3/dms3rep/multi/opt/Programs-Elem-01-a067adef-1920w.png',
    caption: 'A child works with bead chains at Berkshire Montessori. Counting physically to 1,000 or 10,000 builds the muscle memory and sensory magnitude-sense that underpin mental arithmetic, place value, and later algebraic thinking.',
    label: 'Berkshire · Bead Chains',
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
/** Wall-clock start time for elapsed computation — immune to setInterval throttling. */
let _animStart: number = 0

function _startLoadingAnimation(): void {
  _animStart              = Date.now()
  elapsed.value           = 0
  simulatedProgress.value = 0
  // Pre-mark photos with empty URLs as failed so they don't show "coming soon" placeholders
  const emptyUrlPhotos = new Set<number>()
  for (let i = 0; i < MONTESSORI_PHOTOS.length; i++) {
    if (!MONTESSORI_PHOTOS[i].url || MONTESSORI_PHOTOS[i].url.trim() === '') {
      emptyUrlPhotos.add(i)
    }
  }
  failedPhotos.value = emptyUrlPhotos
  // Find first photo with a valid URL to start with, otherwise just start at 0
  let startIdx = 0
  for (let i = 0; i < MONTESSORI_PHOTOS.length; i++) {
    if (!emptyUrlPhotos.has(i)) {
      startIdx = i
      break
    }
  }
  activeFactIdx.value = startIdx

  // Poll every 250 ms using Date.now() delta — immune to Electron/browser setInterval
  // throttling when the window loses focus. If the OS suspends the tab for 30 s and
  // then resumes it, the counter catches up immediately to the true elapsed time
  // instead of appearing frozen.
  // Phase 1 (0–80 s): logarithmic (time-constant 35 s) → ~90% at 80 s, visibly moves.
  // Phase 2 (80 s+): linear +0.08%/s toward 99% cap — never appears frozen.
  _elapsedTimer = setInterval(() => {
    const e = Math.round((Date.now() - _animStart) / 1000)
    elapsed.value = e
    if (e <= 80) {
      simulatedProgress.value = Math.round(98 * (1 - Math.exp(-e / 35)))
    } else {
      simulatedProgress.value = Math.min(99, Math.round(90 + (e - 80) * 0.08))
    }
  }, 250)

  // Rotate photos every 10 s (Tom 2026-05-30)
  _factTimer = setInterval(() => {
    activeFactIdx.value = _findNextValidPhotoIdx(activeFactIdx.value, 1)
  }, 10_000)
}

/** Find the next valid photo index, skipping empty URLs and failed loads. */
function _findNextValidPhotoIdx(currentIdx: number, direction: 1 | -1): number {
  const emptyUrlIndices = new Set<number>()
  for (let i = 0; i < MONTESSORI_PHOTOS.length; i++) {
    if (!MONTESSORI_PHOTOS[i].url || MONTESSORI_PHOTOS[i].url.trim() === '') {
      emptyUrlIndices.add(i)
    }
  }

  let idx = currentIdx
  for (let attempts = 0; attempts < MONTESSORI_PHOTOS.length; attempts++) {
    idx = (idx + direction + MONTESSORI_PHOTOS.length) % MONTESSORI_PHOTOS.length
    // Skip if URL is empty or photo has failed to load
    if (!emptyUrlIndices.has(idx) && !failedPhotos.value.has(idx)) {
      return idx
    }
  }
  // Fallback: no valid photos found, stay at current
  return currentIdx
}

/** Mark a photo as failed so the styled fallback renders instead. */
function handlePhotoError(idx: number): void {
  const next = new Set(failedPhotos.value)
  next.add(idx)
  failedPhotos.value = next
}

function prevPhoto(): void {
  activeFactIdx.value = _findNextValidPhotoIdx(activeFactIdx.value, -1)
}

function nextPhoto(): void {
  activeFactIdx.value = _findNextValidPhotoIdx(activeFactIdx.value, 1)
}

function _stopLoadingAnimation(): void {
  if (_elapsedTimer) { clearInterval(_elapsedTimer); _elapsedTimer = null }
  if (_factTimer)   { clearInterval(_factTimer);   _factTimer   = null }
  simulatedProgress.value = 100
}

/** Human-readable phase label that matches the simulated progress percentage. */
const phaseLabel = computed<string>(() => {
  const p = simulatedProgress.value
  const e = elapsed.value
  if (p < 12) return 'Reading board document…'
  if (p < 30) return 'Extracting decisions…'
  if (p < 58) return 'Classifying governance layers…'
  if (p < 78) return 'Identifying authority gaps…'
  // After 80 s in the slow linear tail: be honest about expected wait time
  if (e <= 120) return 'Finalising analysis… (1–2 min typical)'
  if (e <= 180) return 'Generating detailed report… (complex documents take 2–3 min)'
  return 'Generating final report — almost there…'
})

watch(loading, (isLoading: boolean) => {
  if (isLoading) _startLoadingAnimation()
  else           _stopLoadingAnimation()
})

onUnmounted(_stopLoadingAnimation)

// ─── Restore last result when panel reopens ────────────────────────────────────
// If the user ran an analysis, closed the panel, then reopened it, result.value
// is null (component remounted) but lastMariaResult still holds the prior run.
// Restoring it means the panel reopens showing the results, not a blank input.
onMounted(() => {
  if (!result.value && lastMariaResult.value) {
    result.value = lastMariaResult.value
  }
})

// ─── Board member helpers ──────────────────────────────────────────────────────

/** Stable colour palette for member avatar circles — assigned by id hash. */
const _AVATAR_PALETTE = [
  'bg-emerald-600', 'bg-blue-600', 'bg-violet-600', 'bg-rose-600',
  'bg-amber-600',   'bg-teal-600', 'bg-indigo-600', 'bg-pink-600',
]

function _memberAvatarColor(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return _AVATAR_PALETTE[h % _AVATAR_PALETTE.length]
}

/** First-letter initials of up to the first two words of a name. */
function _memberInitials(name: string): string {
  return name
    .replace(/\[.*?\]/g, '?')      // placeholder [text] → ?
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

/**
 * For each governance gap, returns the top-2 board member suggestions.
 * Keys are gap.id values. Only populated when result is present.
 */
const gapSuggestions = computed((): Record<string, MemberMatch[]> => {
  if (!result.value) return {}
  const out: Record<string, MemberMatch[]> = {}
  for (const g of result.value.governanceGaps) {
    const text = [g.significance ?? '', g.opportunity ?? '', g.category ?? ''].join(' ')
    const matches = matchMembersToItem(text, boardMembersLive.value)
    if (matches.length) out[g.id] = matches
  }
  return out
})

/**
 * For each authority report entry, returns the top-2 board member suggestions.
 * Keys are a.decisionIds.join('-') values. Only populated when result is present.
 * Uses live localStorage roster (boardMembersLive) so edits in MariaBoardHub
 * are immediately reflected here without a page refresh.
 */
const authoritySuggestions = computed((): Record<string, MemberMatch[]> => {
  if (!result.value) return {}
  const out: Record<string, MemberMatch[]> = {}
  for (const a of result.value.authorityReport) {
    const key  = a.decisionIds.join('-')
    const text = [a.issue ?? '', a.opportunity ?? ''].join(' ')
    const matches = matchMembersToItem(text, boardMembersLive.value)
    if (matches.length) out[key] = matches
  }
  return out
})

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
          <!-- Sample doc — ALWAYS visible so Tom can always get to a working test -->
          <button
            type="button"
            class="shrink-0 text-[11px] font-semibold text-emerald-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all"
            title="Sample doc — single-click to load the Berkshire Hills board minutes and immediately start analysis. Cancels any current run first. No second click needed."
            @click="useSampleDocument"
          >
            ↓ Sample doc
          </button>
          <!-- Start over — when result is present -->
          <button
            v-if="hasResult"
            type="button"
            class="shrink-0 text-[11px] font-semibold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all"
            title="Start over — single-click to clear the analysis and return to the input screen to paste a new document"
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
        <div class="flex-1 min-h-0 overflow-y-auto p-5">

          <!-- ─── Loading phase ──────────────────────────────────────────── -->
          <div v-if="loading && !result" class="py-4">

            <!-- Progress + timer row -->
            <div class="flex items-baseline justify-between mb-2 px-1">
              <span class="text-2xl font-black text-emerald-700 tabular-nums leading-none">
                {{ simulatedProgress }}%
              </span>
              <span class="text-xs text-slate-400 tabular-nums">
                {{ elapsed }}s elapsed
              </span>
            </div>

            <!-- Animated progress bar — pulses when elapsed > 60 s to show it's still alive -->
            <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-1.5">
              <div
                :class="[
                  'h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 transition-all duration-1000 ease-out',
                  elapsed > 60 ? 'animate-pulse' : ''
                ]"
                :style="{ width: simulatedProgress + '%' }"
                role="progressbar"
                :aria-valuenow="simulatedProgress"
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>
            <!-- Long-running warnings — three tiers so the user always knows what to do -->
            <!-- Tier 1: 75–120 s — reassurance -->
            <div v-if="elapsed > 75 && elapsed <= 120" class="flex items-center justify-center gap-1.5 mb-1">
              <p class="text-[11px] text-amber-600 font-medium">
                ⏳ Large document — still working, please wait…
              </p>
            </div>
            <!-- Tier 2: 120 s+ — prominent cancel option -->
            <div v-if="elapsed > 120" class="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              <p class="text-[11px] text-amber-800 font-medium leading-snug">
                ⚠️ Taking longer than expected ({{ elapsed }}s). The document may be very large.
                Try the <strong>sample document</strong> for a fast first test.
              </p>
              <button
                type="button"
                title="Cancel analysis — single-click to stop the current analysis and return to the input screen so you can paste a shorter document or use the sample"
                class="shrink-0 text-[10px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-300 rounded-lg px-2.5 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
                @click="cancelAnalysis"
              >✕ Cancel</button>
            </div>

            <!-- Phase label — deliberately visible: sm text, icon, bold -->
            <div class="flex items-center gap-2 mb-2 px-1">
              <svg class="w-3.5 h-3.5 text-emerald-500 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p class="text-sm text-emerald-800 font-semibold transition-all duration-700">
                {{ phaseLabel }}
              </p>
            </div>

            <!-- Streaming indicator — appears as soon as the API starts sending tokens back.
                 Gives immediate confidence that the API is actively responding (not stuck),
                 even when the full JSON takes 100–150 s to complete. -->
            <div
              v-if="streamedChars > 0"
              class="flex items-center gap-2 mb-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg"
            >
              <span class="text-emerald-500 shrink-0 animate-pulse text-sm" aria-hidden="true">📡</span>
              <span class="text-[11px] text-emerald-700 font-medium">
                Response streaming — {{ streamedChars.toLocaleString() }} chars received
              </span>
            </div>
            <!-- Waiting for API response (non-streaming: single payload arrives after full generation) -->
            <div
              v-else
              class="flex items-center gap-2 mb-4 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <span class="text-slate-400 shrink-0 text-sm animate-pulse" aria-hidden="true">🔗</span>
              <span class="text-[11px] text-slate-500 leading-snug">
                <template v-if="elapsed < 15">Sending document to analysis API…</template>
                <template v-else-if="elapsed < 60">API processing — response arrives as a single package after generation completes</template>
                <template v-else>API still generating — complex board analysis typically takes 1.5–3 min with this model</template>
              </span>
            </div>

            <!-- Debug panel — visible logs so Tom can see what's happening without Safari console -->
            <div class="rounded-xl border border-slate-200 overflow-hidden mb-4 bg-slate-50">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-slate-400"
                title="Debug logs — expand to see real-time diagnostic messages from the analysis. Single-click to show/hide the log output."
                @click.stop="debugOpen = !debugOpen"
              >
                <span class="text-xs font-bold text-slate-600 flex-1">🔧 Analysis Logs ({{ debugLogs.length }} events)</span>
                <span class="text-slate-400 text-xs">{{ debugOpen ? '▲' : '▼' }}</span>
              </button>
              <div v-if="debugOpen" ref="debugLogsContainer" class="max-h-80 overflow-y-auto bg-slate-900 text-slate-100 font-mono text-[10px] p-3 space-y-1">
                <div v-if="debugLogs.length === 0" class="text-slate-500">
                  (waiting for logs…)
                </div>
                <div v-for="(log, idx) in debugLogs" :key="idx" class="text-slate-300">
                  {{ log }}
                </div>
              </div>
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

              <!-- Photo or styled fallback — contain (no cropping) with emerald-50 bg for letterboxing -->
              <div class="relative mx-3 rounded-xl overflow-hidden bg-emerald-50 flex items-center justify-center" style="height:520px;">
                <!-- Real photo (hidden if URL empty or failed to load) -->
                <img
                  v-if="MONTESSORI_PHOTOS[activeFactIdx].url && !failedPhotos.has(activeFactIdx)"
                  :key="activeFactIdx"
                  :src="MONTESSORI_PHOTOS[activeFactIdx].url"
                  :alt="MONTESSORI_PHOTOS[activeFactIdx].caption"
                  class="max-w-full max-h-full object-contain transition-opacity duration-500"
                  loading="lazy"
                  @error="handlePhotoError(activeFactIdx)"
                />
                <!-- Fallback: empty space for photos with no URL (don't show "coming soon") -->
                <div
                  v-else
                  class="w-full h-full bg-emerald-50"
                />
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
          <div v-else-if="!shouldShowResult && !loading">

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

            <!-- Error message — shown ABOVE the textarea so it is always visible after failure -->
            <div
              v-if="error"
              class="rounded-xl bg-red-50 border border-red-300 px-4 py-3 mb-4 text-sm text-red-800 leading-relaxed"
              role="alert"
            >
              <p class="font-bold text-red-900 mb-1">⚠️ Analysis failed</p>
              <p>{{ error }}</p>
              <p class="mt-2 text-[11px] text-red-600">
                Tip: Try the <strong>"↓ Use sample document"</strong> link below to test Maria with a short 350-word example document that completes in ~20 seconds.
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
                title="Paste board document here — paste to auto-start analysis, or press ⌘ Return to analyse manually"
                @paste="onDocumentPaste"
                @keydown.meta.enter.prevent="runAnalysis"
                @keydown.ctrl.enter.prevent="runAnalysis"
              />
              <div class="flex items-center justify-between mt-1.5">
                <button
                  type="button"
                  title="Use sample document — single-click to load the Berkshire Hills board minutes and immediately start analysis. No second click needed."
                  class="text-[10px] font-semibold text-teal-600 hover:text-teal-800 hover:underline transition-colors focus:outline-none"
                  @click="useSampleDocument"
                >↓ Use sample document to test</button>
                <p class="text-xs text-slate-400 tabular-nums">
                  {{ documentText.trim().split(/\s+/).filter(Boolean).length }} words
                </p>
              </div>
            </div>

            <!-- Analyse button -->
            <button
              type="button"
              :disabled="!hasDocument || loading"
              class="w-full rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              :class="hasDocument && !loading
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'"
              title="Analyse board document — Maria will extract all decisions, classify them by governance layer, identify authority gaps, flag governance gaps, and analyse patterns. Analysis also auto-starts when you paste a document."
              @pointerup.stop="runAnalysis"
            >
              <span v-if="loading" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Maria is analysing the document…
              </span>
              <span v-else>
                {{ hasDocument ? '🏛 Analyse Board Document — paste to auto-start, or press ⌘ Return' : 'Paste a board document above to begin' }}
              </span>
            </button>

          </div>

          <!-- ─── Result phase ────────────────────────────────────────────── -->
          <!-- Display results immediately when available, regardless of loading state -->
          <div v-if="shouldShowResult">

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
                  <!-- Auto-suggested board members for this authority gap -->
                  <div v-if="authoritySuggestions[a.decisionIds.join('-')]?.length" class="flex items-center flex-wrap gap-1.5 mt-2">
                    <span class="text-[9px] text-slate-400 font-semibold shrink-0">👤 Suggested:</span>
                    <span
                      v-for="m in authoritySuggestions[a.decisionIds.join('-')]"
                      :key="m.member.id"
                      class="text-[9px] bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full px-2.5 py-0.5 font-semibold cursor-default"
                      :title="`${m.member.name} (${m.member.role}) — matched on: ${m.reasons.join(', ')}`"
                    >{{ m.member.name }}</span>
                  </div>
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
                  <!-- Auto-suggested board members for this governance gap -->
                  <div v-if="gapSuggestions[g.id]?.length" class="flex items-center flex-wrap gap-1.5 mt-2">
                    <span class="text-[9px] text-slate-400 font-semibold shrink-0">👤 Suggested:</span>
                    <span
                      v-for="m in gapSuggestions[g.id]"
                      :key="m.member.id"
                      class="text-[9px] bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-2.5 py-0.5 font-semibold cursor-default"
                      :title="`${m.member.name} (${m.member.role}) — matched on: ${m.reasons.join(', ')}`"
                    >{{ m.member.name }}</span>
                  </div>
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

            <!-- ── Section 5: Board Members ── -->
            <div class="rounded-xl border border-slate-200 overflow-hidden mb-4">
              <button
                type="button"
                class="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                title="Board Members — single-click to expand member profiles showing contact details, interests, abilities, and task preferences. Auto-suggest chips above use this data."
                @click="boardOpen = !boardOpen"
              >
                <span class="text-sm font-bold text-slate-700 flex-1">👥 Board Members</span>
                <span class="text-xs text-slate-500 font-semibold">{{ boardMembers.length }} members</span>
                <span class="text-slate-400 text-xs ml-1">{{ boardOpen ? '▲' : '▼' }}</span>
              </button>
              <div v-if="boardOpen" class="bg-white p-4">
                <!-- 2-column card grid -->
                <div class="grid grid-cols-2 gap-3">
                  <div
                    v-for="member in boardMembers"
                    :key="member.id"
                    class="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <!-- Avatar + name row -->
                    <div class="flex items-center gap-2 mb-2">
                      <div
                        class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-black text-white"
                        :class="_memberAvatarColor(member.id)"
                        aria-hidden="true"
                      >{{ _memberInitials(member.name) }}</div>
                      <div class="min-w-0">
                        <p class="text-xs font-bold text-slate-800 leading-tight truncate">{{ member.name }}</p>
                        <p class="text-[10px] text-slate-500 leading-tight">{{ member.role }}</p>
                      </div>
                    </div>
                    <!-- Contact info -->
                    <div v-if="member.email || member.phone || member.address" class="mb-2 space-y-0.5">
                      <p v-if="member.email" class="text-[10px] text-slate-500 truncate">
                        <span aria-label="email">✉</span> {{ member.email }}
                      </p>
                      <p v-if="member.phone" class="text-[10px] text-slate-500">
                        <span aria-label="phone">📞</span> {{ member.phone }}
                      </p>
                      <p v-if="member.address" class="text-[10px] text-slate-400 leading-snug">
                        <span aria-label="address">📍</span> {{ member.address }}
                      </p>
                    </div>
                    <!-- Interests -->
                    <div v-if="member.specialInterests.length" class="mb-1.5">
                      <span class="text-[9px] font-bold uppercase tracking-wide text-blue-500 block mb-1">Interests</span>
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="item in member.specialInterests"
                          :key="item"
                          class="text-[9px] bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2 py-0.5 font-medium"
                        >{{ item }}</span>
                      </div>
                    </div>
                    <!-- Abilities -->
                    <div v-if="member.specialAbilities.length" class="mb-1.5">
                      <span class="text-[9px] font-bold uppercase tracking-wide text-emerald-500 block mb-1">Abilities</span>
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="item in member.specialAbilities"
                          :key="item"
                          class="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-2 py-0.5 font-medium"
                        >{{ item }}</span>
                      </div>
                    </div>
                    <!-- Volunteers for -->
                    <div v-if="member.volunteersFor.length" class="mb-1.5">
                      <span class="text-[9px] font-bold uppercase tracking-wide text-teal-500 block mb-1">Volunteers for</span>
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="item in member.volunteersFor"
                          :key="item"
                          class="text-[9px] bg-teal-50 border border-teal-200 text-teal-700 rounded-full px-2 py-0.5 font-medium"
                        >{{ item }}</span>
                      </div>
                    </div>
                    <!-- Dislikes tasks -->
                    <div v-if="member.dislikesTasks.length">
                      <span class="text-[9px] font-bold uppercase tracking-wide text-rose-400 block mb-1">Dislikes</span>
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="item in member.dislikesTasks"
                          :key="item"
                          class="text-[9px] bg-rose-50 border border-rose-200 text-rose-700 rounded-full px-2 py-0.5 font-medium"
                        >{{ item }}</span>
                      </div>
                    </div>
                    <!-- Availability / notes -->
                    <p
                      v-if="member.availability || member.notes"
                      class="text-[9px] text-slate-400 mt-2 italic leading-snug"
                    >{{ [member.availability, member.notes].filter(Boolean).join(' · ') }}</p>
                  </div>
                </div>
                <!-- Footer: data-source note -->
                <p class="text-[9px] text-slate-400 mt-3 text-center leading-snug">
                  Profiles loaded from <code class="font-mono">src/data/boardMembers.ts</code> — edit that file to add real names, contact details, and preferences.
                </p>
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
        </div>

      </div>
    </div>
  </Teleport>
</template>
