<!-- UNIT_TYPE=Widget -->
<!-- SEMEntryForm — single-input voice-first entry.
     Stage 1 (input): one textarea. Say or type anything — stakeholders, goals,
     strategies, in any order, any combination. Voice fills it automatically
     when the mic is on.
     Stage 2 (review): parsed Who / What / How chip lists, all editable by voice
     or keyboard. Say "done" or press Enter on any chip field to commit.
     Spec: S.EvoStep1.TailwindMobileFirstForm -->

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useEntryForm } from '../composables/useEntryForm'
import { SEM_TEMPLATES } from '../data/semTemplates'
import { SURPRISE_SEEDS } from '../data/surpriseSeeds'
import { useDocumentImport } from '../composables/useDocumentImport'

const emit = defineEmits<{
  submit: [payload: { stakes: string; ends: string; means: string; wish?: string; wishStakeholder?: string }]
  wizard: []
  /** Fired whenever the form's internal sub-stage changes so App.vue can update the Next Step label. */
  'stage-change': [stage: 'input' | 'review']
}>()

const { setSubmitting, setHasSubmitted } = useEntryForm()

// Auto-focus the main textarea on mount so voice goes straight in.
onMounted(() => {
  nextTick(() => {
    (document.getElementById('sem-raw-input') as HTMLTextAreaElement | null)?.focus()
  })
})

// ── Stage ────────────────────────────────────────────────────────────────────

type Stage = 'input' | 'review'
const stage = ref<Stage>('input')
// Tell App.vue whenever the sub-stage changes so it can update the Next Step label.
watch(stage, (s) => emit('stage-change', s))

// ── Input stage state ─────────────────────────────────────────────────────────

const rawInput    = ref('')
const parseError  = ref('')
const templatesOpen = ref(false)

// ── Document import ───────────────────────────────────────────────────────────
const { importFromUrl, importFromFile, importLoading, importError, clearImport } = useDocumentImport()
const importPanelOpen = ref(false)
const importUrl = ref('')
const importSource = ref('') // label shown after a successful import

async function handleUrlImport(): Promise<void> {
  const url = importUrl.value.trim()
  if (!url) return
  const text = await importFromUrl(url)
  if (text) {
    rawInput.value = text
    importSource.value = url
    importPanelOpen.value = false
    importUrl.value = ''
  }
}

async function handleFileImportDoc(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const text = await importFromFile(file)
  if (text) {
    rawInput.value = text
    importSource.value = file.name
    importPanelOpen.value = false
  }
  input.value = ''
}

function closeImportPanel(): void {
  importPanelOpen.value = false
  clearImport()
  importUrl.value = ''
}

// ── Review stage state ────────────────────────────────────────────────────────

const parsedStakeholders = ref<string[]>([])
const parsedValues       = ref<string[]>([])
const parsedMeans        = ref<string[]>([])
const submitError        = ref('')

// Chip editing
const editingChip = ref<{ group: Group; index: number } | null>(null)
const editingText = ref('')

// Chip adding
const addingTo   = ref<Group | null>(null)
const addingText = ref('')

type Group = 'stakeholders' | 'values' | 'means'

// ── Parser ────────────────────────────────────────────────────────────────────

/** Split a text fragment into individual list items. */
function splitItems(text: string): string[] {
  return text
    .split(/\s*,\s*|\s+and\s+|\s*;\s*/i)
    .map(s =>
      s
        .replace(/^(?:to\s+|that\s+|which\s+)/i, '')
        .replace(/[.!?]$/, '')
        .trim()
    )
    // First-person pronouns (I, we) are valid stakeholder identifiers — keep them
    // even though they are single/short words. Everything else needs length > 1.
    .filter(s => /^(?:i|we)$/i.test(s) || (s.length > 1 && !/^(a|an|the|me|us)$/i.test(s)))
}

interface MultiParsed {
  stakeholders: string[]
  values: string[]
  means: string[]
}

// ── SEM fragment classifier ───────────────────────────────────────────────────
//
// Three SEM categories identified by linguistic structure:
//
//   Stakeholders  — WHO is affected: role nouns (engineer, customer, team…)
//   Ends/Values   — HOW WELL: desired performance levels (productivity rate, retention %, speed…)
//   Means         — HOW it's delivered: action phrases, tools, methodologies
//
// Classification is recursive: "use AI for engineer productivity"
//   step 1 → Means: "use AI"   +   recurse("engineer productivity")
//   step 6 → Stakeholder: "engineer"  +  Value: "productivity"
//
// The review stage is the intentional correction layer — imperfect parses are
// expected and fixable. These rules target the most common speech patterns.

// ── Vocabulary ────────────────────────────────────────────────────────────────

/**
 * Role nouns that identify Stakeholders when used as modifiers or standalone.
 * Grounded in the Planguage definition: "any person, group or object which has
 * some direct or indirect interest in a defined system" (ISO/IEC 15288).
 * Includes non-person entities: regulatory bodies, markets, communities.
 */
const ROLE_WORDS = new Set([
  // Core organisational roles
  'engineer','engineers','developer','developers','designer','designers',
  'manager','managers','director','directors','employee','employees',
  'customer','customers','user','users','client','clients',
  'patient','patients','student','students','teacher','teachers',
  'team','teams','staff','family','families','parent','parents','child','children',
  'colleague','colleagues','executive','executives','partner','partners',
  'investor','investors','vendor','vendors','analyst','analysts',
  'operator','operators','leader','leaders','owner','owners',
  'ceo','cfo','cto','coo','vp','founder','founders',
  // Planguage-specific (ISO/IEC 15288 stakeholder list)
  'maintainer','maintainers','acquirer','acquirers','supplier','suppliers',
  'trainer','trainers','disposer','disposers','producer','producers',
  // Regulatory / compliance entities (objects per Planguage definition)
  'regulator','regulators','auditor','auditors','inspector','inspectors',
  'authority','authorities','board','boards','committee','committees',
  // Community / market stakeholders
  'community','communities','market','markets','resident','residents',
  'citizen','citizens','taxpayer','taxpayers','beneficiary','beneficiaries',
  // Additional worker / role types
  'farmer','farmers','worker','workers','consumer','consumers',
  'buyer','buyers','seller','sellers','supervisor','supervisors',
  'coordinator','coordinators','administrator','administrators',
  'researcher','researchers','scientist','scientists','clinician','clinicians',
  'driver','drivers','pilot','pilots','technician','technicians',
  'consultant','consultants','contractor','contractors','freelancer','freelancers',
  'stakeholder','stakeholders',
  // Academic roles
  'professor','professors','lecturer','lecturers','tutor','tutors',
  'dean','deans','principal','principals','instructor','instructors',
  // Leadership / seniority markers and role suffixes
  'head','heads','lead','leads','officer','officers','president','presidents',
])

/** Action verbs that introduce a Means/Solution rather than a Value/End. */
const INSTRUMENTAL_RE =
  /^(?:use|leverage|apply|adopt|implement|deploy|integrate|automate|build|create|develop|introduce|launch|hire|add|run|set\s+up|setup|roll(?:\s+out)?|invest(?:\s+in)?|enable|establish|migrate|refactor|redesign|streamline|consolidate|install|switch(?:\s+to)?|transition(?:\s+to)?|convert(?:\s+to)?|replace|upgrade|pilot|purchase|procure|buy|train|partner(?:\s+with)?|outsource|onboard|negotiate|renegotiate|sign(?:\s+up)?|move(?:\s+to)?|shift(?:\s+to)?|source|contract(?:\s+with)?|commission|engage(?:\s+with)?)\b/i

/** Technology / methodology terms that are unambiguously Means when standalone. */
const STANDALONE_MEANS_RE =
  /^(?:AI|A\.I\.|artificial\s+intelligence|machine\s+learning|deep\s+learning|NLP|natural\s+language\s+processing|OKR|OKRs|agile|scrum|kanban|lean\s+(?:methodology|approach|startup)?|DevOps|CI\/?CD|CRM|ERP|chatbot|automation|algorithm|blockchain|microservices|kubernetes|docker|data\s+(?:warehouse|pipeline|lake)|analytics\s+platform)\b/i

/** Goal verbs that separate a Means clause from its Value ("to improve/increase/…"). */
const TO_GOAL_RE =
  /^(.+?)\s+to\s+((?:improve|increase|reduce|boost|achieve|enable|deliver|grow|enhance|maximize|minimize|optimize|ensure|accelerate|drive|raise|lower|increase|decrease)\s+.+)$/i

/** Frequency-led process phrases → Means ("weekly reviews", "daily standups"). */
const FREQUENCY_MEANS_RE =
  /^(?:weekly|daily|monthly|bi-?weekly|quarterly|recurring|regular)\s+\w+/i

// ── Structural splitters ──────────────────────────────────────────────────────

/**
 * If text starts with an instrumental verb, split into { means, value|null }.
 *   "use AI for engineer productivity" → { means:"use AI", value:"engineer productivity" }
 *   "implement OKRs to increase alignment" → { means:"implement OKRs", value:"increase alignment" }
 *   "use AI"                               → { means:"use AI", value:null }
 */
function splitInstrumental(text: string): { means: string; value: string | null } | null {
  if (!INSTRUMENTAL_RE.test(text)) return null
  const forM = text.match(/^(.+?)\s+for\s+(.+)$/i)
  if (forM) return { means: forM[1].trim(), value: forM[2].trim() }
  const toM  = text.match(TO_GOAL_RE)
  if (toM)  return { means: toM[1].trim(),  value: toM[2].trim() }
  return { means: text, value: null }
}

/**
 * If text is a known-tool noun + "for Y", split into means + value.
 *   "OKRs for team alignment" → { means:"OKRs", value:"team alignment" }
 */
function splitToolFor(text: string): { means: string; value: string } | null {
  const m = text.match(/^(.+?)\s+for\s+(.+)$/i)
  if (!m) return null
  return STANDALONE_MEANS_RE.test(m[1].trim())
    ? { means: m[1].trim(), value: m[2].trim() }
    : null
}

/**
 * If text is "[role-word] [outcome]", split into stakeholder + value phrase.
 *   "engineer productivity" → { role:"engineer", value:"productivity" }
 *   "customer satisfaction" → { role:"customer", value:"satisfaction" }
 * Also handles compound titles where the role word is the 2nd word:
 *   "sustainability director"  → { role:"sustainability director", value:… }
 *   "senior engineer"          → { role:"senior engineer", value:… }
 * Skips splits where the "value" is a lone gerund (likely an activity → means).
 */
function splitRoleValue(text: string): { role: string; value: string } | null {
  const words = text.trim().split(/\s+/)
  if (words.length < 2) return null

  // Find where the role word sits — first word, or second word for compound titles.
  // Do NOT check words[1] when words[0] is an action/goal verb, because phrases like
  // "improve customer satisfaction" should stay as Values, not split incorrectly.
  let roleIdx = -1
  if (ROLE_WORDS.has(words[0].toLowerCase())) {
    roleIdx = 0
  } else if (
    words.length > 1 &&
    ROLE_WORDS.has(words[1].toLowerCase()) &&
    !INSTRUMENTAL_RE.test(words[0]) &&
    !/^(?:improve|increase|reduce|decrease|boost|achieve|ensure|deliver|grow|enhance|maximize|minimize|optimize|accelerate|raise|lower|expand|strengthen|maintain|sustain)\b/i.test(words[0])
  ) {
    roleIdx = 1
  }
  if (roleIdx < 0) return null

  const role  = words.slice(0, roleIdx + 1).join(' ')
  const value = words.slice(roleIdx + 1).join(' ')

  if (!value) return null
  // If the remainder starts with a location/org preposition the whole phrase is a
  // pure stakeholder descriptor ("sustainability director at a manufacturing firm").
  // Return null so classifyFragment's rule 6a can push the full text as stakeholder.
  if (/^(?:at|from|in|of|within)\b/i.test(value.trim())) return null
  // Single gerund after a role ("team building") is likely a Means, not a Value
  if (words.length === roleIdx + 2 && value.endsWith('ing')) return null
  return { role, value }
}

/**
 * Detect "[qualifier] ROLE_WORD at/from/in [org]" — a full stakeholder description
 * where the role word is preceded by a qualifying adjective/noun.
 *   "Sustainability director at a manufacturing firm" → whole text = Stakeholder
 *   "Senior engineer from the ops team"              → whole text = Stakeholder
 * Returns the full text if it matches, null otherwise.
 */
function extractCompoundStakeholder(text: string): string | null {
  const words = text.trim().split(/\s+/)
  if (words.length < 2) return null
  // Don't fire when the phrase starts with an action verb (those go through INSTRUMENTAL)
  if (INSTRUMENTAL_RE.test(words[0])) return null
  // Search the first 4 words for a role word (covers e.g. "Mobile game studio lead")
  for (let i = 0; i < Math.min(4, words.length); i++) {
    if (ROLE_WORDS.has(words[i].toLowerCase())) {
      const rest = words.slice(i + 1).join(' ').trim()
      // No remainder — if the role word was preceded by qualifiers (i > 0), the
      // whole phrase is a multi-word role title: "University course director",
      // "senior engineer", "lead developer", etc.  Return it as a stakeholder.
      // If i === 0 the phrase is a bare role word; let rule 7 handle it.
      if (!rest) return i > 0 ? text : null
      // Remainder is a location/org preposition → entire phrase is the stakeholder
      // e.g. "Sustainability director at a manufacturing firm"
      if (/^(?:at|from|in|of|within)\b/i.test(rest)) return text
      // Remainder is a scope/context participial → entire phrase is the stakeholder
      // e.g. "Farm operations director managing 5,000 acres"
      if (/^(?:managing|running|overseeing|supervising|leading|heading|responsible|handling|controlling|operating|covering|serving|supporting)\b/i.test(rest)) return text
      // Remainder starts with something else → role+value split, let splitRoleValue handle it
      return null
    }
  }
  return null
}

/**
 * If text ends with "for [role-word(s)]", extract the role as a stakeholder.
 *   "productivity for engineers"  → { value:"productivity", stakeholder:"engineers" }
 *   "better UX for the team"     → { value:"better UX",    stakeholder:"the team"  }
 */
function splitValueForRole(text: string): { value: string; stakeholder: string } | null {
  const m = text.match(/^(.+?)\s+for\s+((?:(?:the|our|my|all)\s+)?\w+(?:\s+(?:team|group|department|staff))?)\s*$/i)
  if (!m) return null
  const roleCore = m[2].trim().replace(/^(?:the|our|my|all)\s+/i, '').split(/\s+/)[0]
  if (!ROLE_WORDS.has(roleCore.toLowerCase())) return null
  return { value: m[1].trim(), stakeholder: m[2].trim() }
}

/**
 * Detect "[X] needs/wants/requires/expects [Y]" — the clearest "source of needs"
 * signal in Planguage. X is the stakeholder; Y is the value they need.
 *   "farmers need better yield tracking"  → { stakeholder:"farmers", value:"better yield tracking" }
 *   "patients expect faster results"      → { stakeholder:"patients", value:"faster results" }
 *   "the team requires clear priorities"  → { stakeholder:"the team", value:"clear priorities" }
 */
const NEEDS_VERB_RE =
  /^(.+?)\s+(?:needs?|wants?|requires?|expects?|demands?|seeks?|desires?)\s+(.+)$/i

function splitNeedsVerb(text: string): { stakeholder: string; value: string } | null {
  const m = text.match(NEEDS_VERB_RE)
  if (!m) return null
  return { stakeholder: m[1].trim(), value: m[2].trim() }
}

/**
 * Detect "[X]'s [Y]" — the possessive implies X has a need or interest in Y.
 *   "farmer's yield"         → { stakeholder:"farmer",   value:"yield" }
 *   "patient's recovery time"→ { stakeholder:"patient",  value:"recovery time" }
 *   "team's performance"     → { stakeholder:"team",     value:"performance" }
 */
function splitPossessive(text: string): { stakeholder: string; value: string } | null {
  const m = text.match(/^(.+?)'s\s+(.+)$/i)
  if (!m) return null
  const owner = m[1].trim()
  const thing = m[2].trim()
  if (!owner || !thing) return null
  return { stakeholder: owner, value: thing }
}

// ── Core recursive classifier ─────────────────────────────────────────────────

/**
 * Classify one text fragment into the right SEM bucket(s).
 * Rules fire in priority order; sub-fragments recurse so a single phrase
 * can produce entries in multiple categories.
 *
 * 0.  "as a/an [role]"           → Stakeholder  (+ recurse on rest)
 * 0.5 "[X]'s [Y]"                → Stakeholder X  + recurse on Y
 * 1.  Instrumental verb          → Means  (+ recurse on purpose clause)
 * 2.  Known-tool "for Y"         → Means  (+ recurse on Y)
 * 3.  Standalone tool            → Means
 * 4.  Frequency-process          → Means
 * 4.5 "[X] needs/wants/requires [Y]" → Stakeholder X  + recurse on Y
 * 5.  "X for [role]"             → Value X  + Stakeholder
 * 6a. "[qualifier] role at/in [org]" → Stakeholder (whole phrase)
 * 6.  "[role] [outcome]"         → Stakeholder  + recurse on outcome
 * 7.  Standalone role            → Stakeholder
 * 8.  Default                    → Value
 */
function classifyFragment(text: string, acc: MultiParsed): void {
  const t = text.trim()
  if (t.length < 2) return

  // 0. "as a/an [role(s)][, rest]" — strips the persona prefix, classifies rest
  //    "as a farmer"                   → Stakeholder: "farmer"
  //    "as a parent, improve wellbeing"→ Stakeholder: "parent" + Value: "improve wellbeing"
  const asAM = t.match(/^as\s+an?\s+(.+?)(?:,\s*(.+))?$/i)
  if (asAM) {
    splitItems(asAM[1]).forEach(r => acc.stakeholders.push(r))
    if (asAM[2]) classifyFragment(asAM[2].trim(), acc)
    return
  }

  // 0.5. "[X]'s [Y]" — possessive implies X has a need or interest in Y
  //    "farmer's yield"          → Stakeholder: "farmer"   + Value: "yield"
  //    "patient's recovery time" → Stakeholder: "patient"  + Value: "recovery time"
  const poss = splitPossessive(t)
  if (poss) {
    acc.stakeholders.push(poss.stakeholder)
    classifyFragment(poss.value, acc)
    return
  }

  // 1. Instrumental verb phrase
  const instr = splitInstrumental(t)
  if (instr) {
    splitItems(instr.means).forEach(m => acc.means.push(m))
    if (instr.value) splitItems(instr.value).forEach(v => classifyFragment(v, acc))
    return
  }

  // 2. Known-tool "for Y"
  const toolFor = splitToolFor(t)
  if (toolFor) {
    acc.means.push(toolFor.means)
    classifyFragment(toolFor.value, acc)
    return
  }

  // 3. Standalone known tool
  if (STANDALONE_MEANS_RE.test(t)) {
    acc.means.push(t)
    return
  }

  // 4. Frequency-process phrase ("weekly reviews", "daily standups")
  //    Split "weekly reviews for better coordination" → means + classify value
  if (FREQUENCY_MEANS_RE.test(t)) {
    const freqFor = t.match(/^(.+?)\s+for\s+(.+)$/i)
    if (freqFor) {
      acc.means.push(freqFor[1].trim())
      classifyFragment(freqFor[2].trim(), acc)
    } else {
      acc.means.push(t)
    }
    return
  }

  // 4.5. "[X] needs/wants/requires/expects [Y]" — explicit "source of needs" signal
  //    "farmers need better yield tracking"  → Stakeholder: "farmers" + Value: "better yield tracking"
  //    "students want faster feedback"       → Stakeholder: "students" + Value: "faster feedback"
  //    "the team requires clear priorities"  → Stakeholder: "the team" + Value: "clear priorities"
  const needsV = splitNeedsVerb(t)
  if (needsV) {
    acc.stakeholders.push(needsV.stakeholder)
    classifyFragment(needsV.value, acc)
    return
  }

  // 5. "value for [role]"
  const valForRole = splitValueForRole(t)
  if (valForRole) {
    classifyFragment(valForRole.value, acc)
    splitItems(valForRole.stakeholder).forEach(s => acc.stakeholders.push(s))
    return
  }

  // 6a. "[qualifier] ROLE_WORD at/from/in [org]" → whole phrase is a Stakeholder
  //     "Sustainability director at a manufacturing firm" → Stakeholder
  const compoundSH = extractCompoundStakeholder(t)
  if (compoundSH) {
    acc.stakeholders.push(compoundSH)
    return
  }

  // 6. "[role] [outcome]" compound (including compound titles like "senior engineer")
  const roleVal = splitRoleValue(t)
  if (roleVal) {
    acc.stakeholders.push(roleVal.role)
    classifyFragment(roleVal.value, acc)
    return
  }

  // 7. Standalone role word (with optional article) OR first-person pronoun
  //    "I" and "we" are always the user / operator stakeholder.
  const bare = t.replace(/^(?:the|our|my|all)\s+/i, '')
  if (ROLE_WORDS.has(bare.toLowerCase()) || /^(?:i|we|me|us)$/i.test(bare)) {
    acc.stakeholders.push(t)
    return
  }

  // 7.5. "[X] by [gerund phrase]" — "by doing/working/spending/…" is a means clause.
  //   "earn a living by working hard"    → value:"earn a living",   means:"working hard"
  //   "reduce costs by automating tasks" → value:"reduce costs",    means:"automating tasks"
  // Safety net for fragments not already split at the sentence-parsing level.
  const byGerundM = t.match(/^(.+?)\s+by\s+(\w+ing\b(?:\s+.+)?)$/i)
  if (byGerundM) {
    const valueClause = byGerundM[1].trim()
    const meansClause = byGerundM[2].trim()
    if (valueClause.length > 1) classifyFragment(valueClause, acc)
    acc.means.push(meansClause)
    return
  }

  // 8. Default: it's a Value
  acc.values.push(t)
}

/**
 * Split text on commas / "and" / semicolons then classify each item.
 * Use this anywhere a text fragment might contain multiple SEM entities.
 */
function pushClassified(text: string, acc: MultiParsed): void {
  splitItems(text).filter(v => v.length > 1).forEach(item => classifyFragment(item, acc))
}

/**
 * Parse free-form natural language into stakeholders / values / means.
 * Handles multiple entities in each category, any order, multiple sentences.
 *
 * Recognised patterns (non-exhaustive):
 *   "As a parent and CEO, I want family happiness to improve, using weekly reviews"
 *   "Parent needs better coordination. CEO wants 15% revenue growth."
 *   "Improve family health and revenue, using OKRs and monthly reviews"
 *   "use AI for engineer productivity"   → means: AI,  ends: productivity
 *   "parent | family happiness | weekly reviews"  (pipe shorthand)
 */
function parseMultiEntry(text: string): MultiParsed {
  const acc: MultiParsed = { stakeholders: [], values: [], means: [] }
  const input = text.trim()
  if (!input) return acc

  // Pipe shorthand: "X | Y | Z" → treat as [stakeholder|value|means] (order guessed)
  const pipeParts = input.split('|').map(p => p.trim()).filter(Boolean)
  if (pipeParts.length >= 2) {
    // Heuristic: first = who, last = how, middle = what
    acc.stakeholders.push(...splitItems(pipeParts[0]))
    if (pipeParts.length === 3) {
      acc.values.push(...splitItems(pipeParts[1]))
      acc.means.push(...splitItems(pipeParts[2]))
    } else {
      acc.values.push(...splitItems(pipeParts[1]))
    }
    return clean(acc)
  }

  // Split into sentences
  const sentences = input
    .split(/[.!?](?:\s|$)/)
    .flatMap(s => s.split(/(?<=\w)\s*;\s*(?=\S)/))
    .map(s => s.trim())
    .filter(Boolean)

  for (const sentence of sentences) {
    const s = sentence

    // ── Means zone (everything after using/through/via/by [gerund]…) ──────
    // "by [gerund]" is now a first-class link word: "earn money by doing X"
    // matches on "by doing", "by spending", "by working", etc.
    const meansIdx = s.search(
      /\b(?:using|through|via|by\s+\w+ing|implementing|building|creating|developing|deploying|adopting|introducing)\b/i
    )
    const meansStr = meansIdx >= 0 ? s.slice(meansIdx).replace(/^[^a-zA-Z]+/, '') : ''
    if (meansStr) {
      // For "by [gerund]", strip only "by " so the gerund is kept in the means phrase
      // ("by doing nothing" → "doing nothing", not "nothing").
      // For all other link words (using/through/via/implementing…) use the original
      // two-word strip logic which handles "by using", "by building" etc.
      const byGerundLead = meansStr.match(/^by\s+(\w+ing\b)/i)
      const keywordLen = byGerundLead
        ? 'by '.length
        : (meansStr.match(/^\w+(?:\s+\w+)?\s+/)?.[0].length ?? 0)
      splitItems(meansStr.slice(keywordLen)).forEach(m => acc.means.push(m))
    }

    // Text before means zone
    const preStr = meansIdx >= 0 ? s.slice(0, meansIdx) : s

    // ── Stakeholder markers ───────────────────────────────────────────────
    // "as a/an/the [role(s)]" or "i as [role]"
    const asAMatch  = preStr.match(/\bas\s+(?:a|an|the)\s+(.+?)(?=\s*,|\s+i\b|\s+want|\s+need|\s+wish|\s+aim|$)/i)
    const iAsMatch  = preStr.match(/\bi\s+as\s+(?:a\s+|an\s+|the\s+)?(.+?)(?=\s*,|\s+want|\s+need|\s+wish|$)/i)
    // "[role] want(s)/need(s)/wishes" at sentence start — including "I want/need/wish"
    const roleWants = preStr.match(/^(.+?)\s+(?:wants?|needs?|wishes?)\s+/i)

    if (asAMatch)  splitItems(asAMatch[1]).forEach(r  => acc.stakeholders.push(r))
    if (iAsMatch)  splitItems(iAsMatch[1]).forEach(r  => acc.stakeholders.push(r))
    if (roleWants && !asAMatch && !iAsMatch) acc.stakeholders.push(roleWants[1].trim())

    // ── Value markers ─────────────────────────────────────────────────────
    const valueKw = preStr.match(
      /\b(?:want(?:s?)(?:\s+to)?|need(?:s?)(?:\s+to)?|wish(?:es?)(?:\s+to)?|aim(?:s?)(?:\s+to)?|goals?\s+(?:is|are|to)|objectives?\s+(?:is|are|to))\b/i
    )
    // "improve/increase/reduce [thing]" at sentence start
    const bareImprove = preStr.match(
      /^(improve|increase|reduce|achieve|ensure|deliver|grow|boost|maximize|minimize|optimize|enhance)\s+(.+)$/i
    )

    if (valueKw) {
      // Everything after the value keyword goes through the full classifier:
      // "I want to use AI for engineer productivity"
      //   → means: "use AI" · stakeholder: "engineer" · value: "productivity"
      const valStart = (valueKw.index ?? 0) + valueKw[0].length
      pushClassified(preStr.slice(valStart).trim(), acc)
    } else if (bareImprove && !asAMatch && !iAsMatch && !roleWants) {
      // "improve / increase / reduce X" — keep the verb, but split out any
      // role modifier: "improve engineer productivity"
      //   → stakeholder: "engineer" · value: "improve productivity"
      const verb = bareImprove[1]
      splitItems(bareImprove[2]).forEach(v => {
        const rv = splitRoleValue(v)
        if (rv) {
          acc.stakeholders.push(rv.role)
          acc.values.push(`${verb} ${rv.value}`)
        } else {
          acc.values.push(`${verb} ${v}`)
        }
      })
    } else if (!valueKw && !bareImprove) {
      // No explicit keyword — run the full recursive classifier.
      // "use AI for engineer productivity" → means · stakeholder · value
      // "weekly reviews"                   → means
      // "customer satisfaction"            → stakeholder · value
      // "family happiness"                 → value
      const trimmed = preStr.trim()
      if (trimmed && !asAMatch && !iAsMatch && !roleWants && trimmed.length > 3) {
        pushClassified(trimmed, acc)
      }
    }
  }

  return clean(acc)
}

function clean(acc: MultiParsed): MultiParsed {
  const dedup = (arr: string[]) =>
    [...new Set(
      arr
        .map(s => s.replace(/^(?:a|an|the)\s+/i, '').replace(/[.!?,;]$/, '').trim())
        // "I" and "we" are valid single-/short-word stakeholders — let them through.
        .filter(s => /^(?:i|we)$/i.test(s) || (s.length > 1 && !/^(?:a|an|the|to|of|in|for|with|by|on|it|its|this|that)$/i.test(s)))
    )]
  return {
    stakeholders: dedup(acc.stakeholders),
    values:       dedup(acc.values),
    means:        dedup(acc.means),
  }
}

// ── Input stage actions ───────────────────────────────────────────────────────

function parseInput(): void {
  parseError.value = ''
  const result = parseMultiEntry(rawInput.value)
  parsedStakeholders.value = result.stakeholders
  parsedValues.value       = result.values
  parsedMeans.value        = result.means
  if (!rawInput.value.trim()) {
    parseError.value = 'Say or type your project idea first.'
    return
  }
  stage.value   = 'review'
  submitError.value = ''
  // Scroll to top so the review chips are immediately visible without scrolling.
  nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

function templatesOpen_toggle(): void {
  templatesOpen.value = !templatesOpen.value
}

function applyTemplate(id: string): void {
  const tpl = SEM_TEMPLATES.find(t => t.id === id)
  if (!tpl) return
  rawInput.value = [tpl.stakes, tpl.ends, tpl.means].filter(Boolean).join('. ')
  templatesOpen.value = false
  parseInput()
}

function handleSurprise(): void {
  const seed = SURPRISE_SEEDS[Math.floor(Math.random() * SURPRISE_SEEDS.length)]
  rawInput.value = [seed.stakes, seed.ends, seed.means].filter(Boolean).join('. ')
  parseInput()
}

// ── Review stage: chip editing ────────────────────────────────────────────────

function listFor(group: Group): string[] {
  if (group === 'stakeholders') return parsedStakeholders.value
  if (group === 'values')       return parsedValues.value
  return parsedMeans.value
}

function startEdit(group: Group, index: number): void {
  editingChip.value = { group, index }
  editingText.value  = listFor(group)[index]
  nextTick(() => {
    const el = document.getElementById(`chip-edit-${group}-${index}`) as HTMLInputElement | null
    el?.focus()
    el?.select()
  })
}

function commitEdit(): void {
  if (!editingChip.value) return
  const { group, index } = editingChip.value
  const text = editingText.value.trim()
  if (text) {
    listFor(group)[index] = text
  } else {
    listFor(group).splice(index, 1)
  }
  editingChip.value = null
  editingText.value  = ''
}

function cancelEdit(): void {
  editingChip.value = null
  editingText.value  = ''
}

function removeChip(group: Group, index: number): void {
  listFor(group).splice(index, 1)
}

// ── Review stage: adding ──────────────────────────────────────────────────────

function startAdd(group: Group): void {
  addingTo.value   = group
  addingText.value = ''
  nextTick(() => {
    const el = document.getElementById(`chip-add-${group}`) as HTMLInputElement | null
    el?.focus()
  })
}

function commitAdd(): void {
  const text = addingText.value.trim()
  if (text && addingTo.value) {
    listFor(addingTo.value).push(text)
  }
  addingTo.value   = null
  addingText.value = ''
}

function cancelAdd(): void {
  addingTo.value   = null
  addingText.value = ''
}

// ── Submit ────────────────────────────────────────────────────────────────────

function handleSubmit(): void {
  submitError.value = ''

  if (parsedValues.value.length === 0) {
    submitError.value = 'Add at least one goal or value before generating.'
    return
  }

  const stakes = parsedStakeholders.value.join(', ')
  const ends   = parsedValues.value.join(', ')
  const means  = parsedMeans.value.join(', ')

  setSubmitting(true)
  setHasSubmitted(true)
  emit('submit', { stakes: stakes || ends, ends, means: means || ends })
  setSubmitting(false)
}
</script>

<template>
  <div class="w-full max-w-2xl mx-auto px-4 py-6 space-y-6">

    <!-- ══════════════════════════════════════════════════════════════════════
         STAGE 1 — Input
         ══════════════════════════════════════════════════════════════════════ -->
    <template v-if="stage === 'input'">

      <!-- Toolbar -->
      <div class="space-y-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-gray-400 font-medium shrink-0">Tools</span>
          <button
            type="button"
            class="h-11 rounded-full px-4 text-xs font-medium bg-gray-100 text-gray-600
                   hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500
                   transition-colors duration-150"
            :aria-expanded="templatesOpen"
            aria-label="Templates"
            @click="templatesOpen_toggle"
          >
            <span aria-hidden="true">📋</span> Templates
          </button>

          <button
            type="button"
            class="h-11 px-4 rounded-full bg-violet-100 text-violet-700 text-xs font-medium
                   hover:bg-violet-200 border border-violet-200
                   focus:outline-none focus:ring-2 focus:ring-violet-400 transition-colors duration-150"
            aria-label="Surprise me"
            @click="handleSurprise"
          >
            <span aria-hidden="true">🎲</span> Surprise me
          </button>

          <button
            type="button"
            class="h-11 px-4 rounded-full border border-gray-200 text-gray-500 text-xs font-medium
                   hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50
                   focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors duration-150"
            aria-label="Start with your goal"
            @click="emit('wizard')"
          >
            <span aria-hidden="true">🎯</span> Start with your goal
          </button>

          <!-- Import button -->
          <button
            type="button"
            class="h-11 px-4 rounded-full border text-xs font-medium transition-colors duration-150
                   focus:outline-none focus:ring-2 focus:ring-emerald-500"
            :class="importPanelOpen
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50'"
            :aria-expanded="importPanelOpen"
            aria-label="Import planning data"
            @click="importPanelOpen = !importPanelOpen"
          >
            <span aria-hidden="true">📎</span> Import planning data
          </button>
        </div>

        <!-- Import panel -->
        <div
          v-if="importPanelOpen"
          class="-mx-4 rounded-xl border border-emerald-200 overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-2 bg-emerald-600">
            <span class="text-xs font-semibold text-white tracking-wide select-none">
              📎 Import planning data from URL or file
            </span>
            <button
              type="button"
              class="text-base leading-none text-emerald-200 hover:text-white
                     focus:outline-none focus:ring-2 focus:ring-white rounded transition-colors"
              aria-label="Close import panel"
              @click="closeImportPanel"
            >✕</button>
          </div>

          <div class="px-4 py-4 bg-emerald-50 space-y-4">

            <!-- URL row -->
            <div>
              <p class="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">
                Paste a URL
              </p>
              <p class="text-[11px] text-emerald-700 mb-2">
                Google Sheets, Google Docs, Google Slides — or any public plain-text URL.
                The document must be set to <strong>"Anyone with the link can view"</strong>.
              </p>
              <div class="flex gap-2">
                <input
                  v-model="importUrl"
                  type="url"
                  class="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  :disabled="importLoading"
                  @keydown.enter="handleUrlImport"
                />
                <button
                  type="button"
                  class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold
                         hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500
                         disabled:opacity-50 transition-colors whitespace-nowrap"
                  :disabled="importLoading || !importUrl.trim()"
                  @click="handleUrlImport"
                >
                  <span v-if="importLoading" class="animate-spin">⏳</span>
                  <span v-else>Import</span>
                </button>
              </div>
            </div>

            <!-- Divider -->
            <div class="flex items-center gap-3">
              <div class="flex-1 border-t border-emerald-200" />
              <span class="text-[11px] text-emerald-500 font-medium">or upload a file</span>
              <div class="flex-1 border-t border-emerald-200" />
            </div>

            <!-- File row -->
            <div class="space-y-2">
              <!-- Format grid — reflects this panel's actual capabilities -->
              <div class="grid grid-cols-2 gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2.5">
                <div>
                  <p class="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">✅ Supported here</p>
                  <ul class="space-y-px text-[11px] text-slate-600 leading-relaxed">
                    <li>Text / Markdown <span class="text-slate-400">(.txt · .md)</span></li>
                    <li>CSV <span class="text-slate-400">(.csv)</span></li>
                    <li>Public web URLs</li>
                    <li>Google Docs <span class="text-slate-400">"anyone with link"</span></li>
                    <li>Google Sheets <span class="text-slate-400">"anyone with link"</span></li>
                    <li>Google Slides <span class="text-slate-400">"anyone with link"</span></li>
                  </ul>
                </div>
                <div>
                  <p class="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1">❌ Use 📥 Import instead</p>
                  <ul class="space-y-px text-[11px] text-slate-600 leading-relaxed">
                    <li>PDF <span class="text-slate-400">(.pdf)</span></li>
                    <li>Word <span class="text-slate-400">(.docx)</span></li>
                    <li>PowerPoint <span class="text-slate-400">→ export as PDF</span></li>
                    <li>Excel <span class="text-slate-400">→ save as CSV</span></li>
                    <li>Keynote / Pages <span class="text-slate-400">→ export as PDF</span></li>
                    <li>Private / login-protected URLs</li>
                  </ul>
                </div>
              </div>

              <label
                class="flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-emerald-300
                       cursor-pointer hover:border-emerald-500 hover:bg-emerald-100 transition-colors text-sm text-emerald-700"
              >
                <span aria-hidden="true">📁</span>
                <span>Choose a .txt, .md, or .csv file</span>
                <span class="text-[11px] text-emerald-500 ml-auto">for PDF/Word use 📥</span>
                <input
                  type="file"
                  accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
                  class="sr-only"
                  :disabled="importLoading"
                  @change="handleFileImportDoc"
                />
              </label>
            </div>

            <!-- Error -->
            <p v-if="importError" class="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {{ importError }}
            </p>
          </div>
        </div>

        <!-- Template pills — tool output panel -->
        <div
          v-if="templatesOpen"
          class="-mx-4 rounded-xl border border-indigo-200 overflow-hidden"
        >
          <!-- Colored title bar -->
          <div class="flex items-center justify-between px-4 py-2 bg-indigo-600">
            <span class="text-xs font-semibold text-white tracking-wide select-none">
              <span aria-hidden="true">📋</span> Templates
            </span>
            <button
              type="button"
              class="text-base leading-none text-indigo-200 hover:text-white
                     focus:outline-none focus:ring-2 focus:ring-white rounded
                     transition-colors duration-150"
              aria-label="Close Templates"
              title="Close Templates"
              @click="templatesOpen = false"
            >🗑️</button>
          </div>
          <!-- Pills -->
          <div
            class="px-4 overflow-x-auto flex gap-2 py-3 bg-indigo-50"
            role="list"
            aria-label="Spec templates"
          >
            <button
              v-for="tpl in SEM_TEMPLATES"
              :key="tpl.id"
              type="button"
              class="flex items-center gap-1.5 h-11 px-4 rounded-full border border-indigo-200 text-sm bg-white
                     hover:border-indigo-400 hover:text-indigo-700 whitespace-nowrap
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-150"
              :aria-label="`Apply ${tpl.label} template`"
              @click="applyTemplate(tpl.id)"
            >
              <span aria-hidden="true">{{ tpl.icon }}</span>
              <span>{{ tpl.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Logo + heading -->
      <div class="flex items-center gap-3">
        <img
          src="/icon-sem-app.svg"
          alt="SEM App logo"
          aria-hidden="true"
          class="h-10 w-10 shrink-0 rounded-xl shadow-sm"
        />
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">What's your project about?</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Say or type anything — who cares, what you want, how you'll do it.
            Multiple stakeholders, goals, and strategies are all fine.
          </p>
        </div>
      </div>

      <!-- Main input -->
      <div class="space-y-2">

        <!-- Imported-document badge -->
        <div
          v-if="importSource && rawInput"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-700"
        >
          <span aria-hidden="true">📎</span>
          <span class="truncate flex-1">Imported: <strong>{{ importSource }}</strong></span>
          <button
            type="button"
            class="text-emerald-400 hover:text-emerald-700 focus:outline-none"
            aria-label="Clear imported document"
            title="Clear"
            @click="importSource = ''; rawInput = ''"
          >✕</button>
        </div>

        <textarea
          id="sem-raw-input"
          v-model="rawInput"
          rows="7"
          class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm
                 text-gray-900 placeholder-gray-400 shadow-sm resize-none
                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                 transition-colors duration-150"
          placeholder="Talk (when mic on) or type here now — who cares, what you want, how you'll do it. Any order, any mix of stakeholders, goals and strategies."
          aria-label="Project description"
          @keydown.enter.ctrl="parseInput"
          @keydown.enter.meta="parseInput"
        />

        <p v-if="parseError" class="text-xs text-red-600" role="alert">{{ parseError }}</p>

        <p class="text-xs text-gray-400">
          <span aria-hidden="true">💡</span>
          Tip: turn on mic → talk freely, say "done" when finished. Or just type and press Ctrl+Enter.
        </p>
      </div>

      <!-- Parse button -->
      <button
        id="sem-parse-btn"
        type="button"
        class="w-full min-h-[44px] rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold
               text-white shadow-sm hover:bg-indigo-700
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
               focus-visible:outline-indigo-600 transition-colors duration-150"
        aria-label="Parse my input"
        @click="parseInput"
      >
        Parse my input
        <span aria-hidden="true"> →</span>
      </button>

    </template>

    <!-- ══════════════════════════════════════════════════════════════════════
         STAGE 2 — Review & Edit
         ══════════════════════════════════════════════════════════════════════ -->
    <template v-else>

      <!-- Header -->
      <div class="flex items-center gap-3">
        <img
          src="/icon-sem-app.svg"
          alt="SEM App logo"
          aria-hidden="true"
          class="h-10 w-10 shrink-0 rounded-xl shadow-sm"
        />
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">Does this look right?</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Edit any item by clicking it, remove with <span aria-hidden="true">×</span>,
            or add more. Say item names or "add" to a section.
          </p>
        </div>
      </div>

      <!-- ── Original input — always accessible after parse ──────────────────── -->
      <details class="rounded-xl border border-gray-200 bg-gray-50 text-sm">
        <summary
          class="flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer
                 select-none list-none text-gray-500 hover:text-gray-700
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-xl"
          aria-label="Toggle original input"
        >
          <span class="flex items-center gap-1.5 font-medium">
            <span aria-hidden="true">📝</span> Your original words
          </span>
          <span class="flex items-center gap-3">
            <button
              type="button"
              class="text-xs text-indigo-600 hover:underline focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
              aria-label="Edit original input"
              @click.stop="stage = 'input'"
            >Edit ✏️</button>
            <span aria-hidden="true" class="text-gray-400 text-xs">▾</span>
          </span>
        </summary>
        <div class="px-4 pb-4 pt-1">
          <p class="text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{{ rawInput }}</p>
        </div>
      </details>

      <!-- ── Who (Stakeholders) ────────────────────────────────────────────── -->
      <section aria-labelledby="section-who">
        <h2 id="section-who" class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          <span aria-hidden="true">👤</span> Who and What 'Needs results' — Stakeholders
        </h2>

        <div class="flex flex-wrap gap-2">
          <template v-for="(item, i) in parsedStakeholders" :key="`who-${i}`">
            <!-- Editing chip -->
            <div v-if="editingChip?.group === 'stakeholders' && editingChip.index === i"
                 class="flex items-center gap-1">
              <input
                :id="`chip-edit-stakeholders-${i}`"
                v-model="editingText"
                type="text"
                class="h-9 rounded-full border border-indigo-400 px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Edit stakeholder"
                @keydown.enter.prevent="commitEdit"
                @keydown.escape="cancelEdit"
                @blur="commitEdit"
              />
            </div>
            <!-- Static chip -->
            <div
              v-else
              class="flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bg-indigo-50
                     border border-indigo-200 text-indigo-800 text-sm"
            >
              <button
                type="button"
                class="focus:outline-none hover:text-indigo-600"
                :aria-label="`Edit stakeholder: ${item}`"
                @click="startEdit('stakeholders', i)"
              >{{ item }}</button>
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-full
                       hover:bg-indigo-200 text-indigo-500 focus:outline-none"
                :aria-label="`Remove stakeholder: ${item}`"
                @click="removeChip('stakeholders', i)"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </template>

          <!-- Add chip input -->
          <div v-if="addingTo === 'stakeholders'" class="flex items-center gap-1">
            <input
              id="chip-add-stakeholders"
              v-model="addingText"
              type="text"
              class="h-9 rounded-full border border-indigo-400 px-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Say it or type…"
              aria-label="New stakeholder"
              @keydown.enter.prevent="commitAdd"
              @keydown.escape="cancelAdd"
              @blur="commitAdd"
            />
          </div>

          <!-- Add button -->
          <button
            v-else
            type="button"
            class="h-9 px-3 rounded-full border border-dashed border-indigo-300
                   text-indigo-500 text-sm hover:bg-indigo-50
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Add stakeholder"
            @click="startAdd('stakeholders')"
          >
            <span aria-hidden="true">+</span> Add
          </button>
        </div>

        <p v-if="parsedStakeholders.length === 0 && addingTo !== 'stakeholders'"
           class="text-xs text-gray-400 mt-1 italic">
          None detected — optional, but useful.
        </p>
      </section>

      <!-- ── How Well (Values / Goals) ───────────────────────────────────────── -->
      <section aria-labelledby="section-what">
        <h2 id="section-what" class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          <span aria-hidden="true">📊</span> How Well — Goals &amp; Values
        </h2>

        <div class="flex flex-wrap gap-2">
          <template v-for="(item, i) in parsedValues" :key="`what-${i}`">
            <div v-if="editingChip?.group === 'values' && editingChip.index === i"
                 class="flex items-center gap-1">
              <input
                :id="`chip-edit-values-${i}`"
                v-model="editingText"
                type="text"
                class="h-9 rounded-full border border-emerald-400 px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Edit goal"
                @keydown.enter.prevent="commitEdit"
                @keydown.escape="cancelEdit"
                @blur="commitEdit"
              />
            </div>
            <div
              v-else
              class="flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bg-emerald-50
                     border border-emerald-200 text-emerald-800 text-sm"
            >
              <button
                type="button"
                class="focus:outline-none hover:text-emerald-600"
                :aria-label="`Edit goal: ${item}`"
                @click="startEdit('values', i)"
              >{{ item }}</button>
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-full
                       hover:bg-emerald-200 text-emerald-500 focus:outline-none"
                :aria-label="`Remove goal: ${item}`"
                @click="removeChip('values', i)"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </template>

          <div v-if="addingTo === 'values'" class="flex items-center gap-1">
            <input
              id="chip-add-values"
              v-model="addingText"
              type="text"
              class="h-9 rounded-full border border-emerald-400 px-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Say it or type…"
              aria-label="New goal"
              @keydown.enter.prevent="commitAdd"
              @keydown.escape="cancelAdd"
              @blur="commitAdd"
            />
          </div>

          <button
            v-else
            type="button"
            class="h-9 px-3 rounded-full border border-dashed border-emerald-300
                   text-emerald-500 text-sm hover:bg-emerald-50
                   focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Add goal"
            @click="startAdd('values')"
          >
            <span aria-hidden="true">+</span> Add
          </button>
        </div>

        <p v-if="parsedValues.length === 0 && addingTo !== 'values'"
           class="text-xs text-red-500 mt-1 italic">
          At least one goal is required to generate a spec.
        </p>
      </section>

      <!-- ── How (Means / Strategies) ──────────────────────────────────────── -->
      <section aria-labelledby="section-how">
        <h2 id="section-how" class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          <span aria-hidden="true">⚙️</span> How — Strategies &amp; Means
        </h2>

        <div class="flex flex-wrap gap-2">
          <template v-for="(item, i) in parsedMeans" :key="`how-${i}`">
            <div v-if="editingChip?.group === 'means' && editingChip.index === i"
                 class="flex items-center gap-1">
              <input
                :id="`chip-edit-means-${i}`"
                v-model="editingText"
                type="text"
                class="h-9 rounded-full border border-amber-400 px-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-label="Edit strategy"
                @keydown.enter.prevent="commitEdit"
                @keydown.escape="cancelEdit"
                @blur="commitEdit"
              />
            </div>
            <div
              v-else
              class="flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bg-amber-50
                     border border-amber-200 text-amber-800 text-sm"
            >
              <button
                type="button"
                class="focus:outline-none hover:text-amber-600"
                :aria-label="`Edit strategy: ${item}`"
                @click="startEdit('means', i)"
              >{{ item }}</button>
              <button
                type="button"
                class="w-6 h-6 flex items-center justify-center rounded-full
                       hover:bg-amber-200 text-amber-500 focus:outline-none"
                :aria-label="`Remove strategy: ${item}`"
                @click="removeChip('means', i)"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </template>

          <div v-if="addingTo === 'means'" class="flex items-center gap-1">
            <input
              id="chip-add-means"
              v-model="addingText"
              type="text"
              class="h-9 rounded-full border border-amber-400 px-3 text-sm
                     focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Say it or type…"
              aria-label="New strategy"
              @keydown.enter.prevent="commitAdd"
              @keydown.escape="cancelAdd"
              @blur="commitAdd"
            />
          </div>

          <button
            v-else
            type="button"
            class="h-9 px-3 rounded-full border border-dashed border-amber-300
                   text-amber-500 text-sm hover:bg-amber-50
                   focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="Add strategy"
            @click="startAdd('means')"
          >
            <span aria-hidden="true">+</span> Add
          </button>
        </div>

        <p v-if="parsedMeans.length === 0 && addingTo !== 'means'"
           class="text-xs text-gray-400 mt-1 italic">
          None detected — optional.
        </p>
      </section>

      <!-- Error -->
      <p v-if="submitError" class="text-sm text-red-600" role="alert">{{ submitError }}</p>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          class="min-h-[44px] px-4 rounded-lg border border-gray-200 text-sm text-gray-600
                 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400
                 transition-colors duration-150"
          aria-label="Say it again"
          @click="stage = 'input'; nextTick(() => (document.getElementById('sem-raw-input') as HTMLTextAreaElement | null)?.focus())"
        >
          <span aria-hidden="true">←</span> Say it again
        </button>

        <button
          type="button"
          id="sem-generate-btn"
          class="flex-1 min-h-[44px] rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold
                 text-white shadow-sm hover:bg-blue-700
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-blue-600 transition-colors duration-150"
          aria-label="Generate Spec"
          @click="handleSubmit"
        >
          Generate Spec
          <span aria-hidden="true"> →</span>
        </button>
      </div>

    </template>
  </div>
</template>
