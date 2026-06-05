<!-- UNIT_TYPE=Widget -->
<!-- SpecHistory — Feature #29 (redesign 2026-05-13).

     2026-05-13 — RESTORE GOOD-RESTORE DESIGN.  Tom: "many instances of new
     version, instead of the latest, and option to look at older. The good
     restore we had is destroyed." The 2026-05-12 group-by-plan-name pass
     created one LATEST per auto-named plan; because the demo + LLM rename
     plans every generation, the panel filled with multiple LATEST cards
     instead of "the" latest. We are back to the original flat-timeline
     design with two layers:

       •  ONE LATEST card on top = the single most-recent version overall,
          across every plan name. This is "the latest" Tom expects.
       •  ONE collapsible "▶ Show N older versions" disclosure below it,
          containing every other version newest-first — including older
          plans like "Improve overall" that were previously hidden under
          their own group bucket.

     Search still applies (sticky input on top, AND-token match across
     plan title, owners, label, topic, timestamp). When a search is active
     the LATEST slot becomes the latest *match* and the disclosure holds
     the rest of the matches. -->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSpecHistory, type SpecVersion } from '../composables/useSpecHistory'
import { useSpecExport } from '../composables/useSpecExport'
// 2026-05-14: surface the OTHER saved Plan Models too. Tom flagged that the
// history panel showed "1 plan · Show 49 older versions" with NO other plans
// visible — but `sem-plan-models` storage held additional named plans that
// were never surfaced here. Plans-vs-Versions distinction: the history panel
// must show BOTH layers so nothing the user has saved is hidden.
import {
  useSpecModel,
  type PlanModel,
  exportAllPlanModelsBackup,
  importPlanModelsBackup,
} from '../composables/useSpecModel'
import type { SpecBlock } from '../types/spec'
import type { EvoStepPlan } from '../types/evo-plan'
import ScrollContainer from './ScrollContainer.vue'
// DD-001 (2026-05-13) — Restore is a "get from vessel" action: `[*] → *`.
// The bracketed asterisk (saved snapshot) flows back out to live spec.
// Save (export) is the opposite: `* → [*]`. The two glyphs together are the
// app's standing vocabulary for every Save/Get pair — no obsolete
// floppy-disk 💾 or paper-tray 📥, no bandage 🩹.
import GetGlyph from './icons/GetGlyph.vue'
import SaveGlyph from './icons/SaveGlyph.vue'
// 2026-05-14 — Tom's standing instruction (split-button hover-`?` pattern
// proven on Priority, now applied to all Save/Get affordances).
import SaveGetActionButton from './SaveGetActionButton.vue'

// Tom 2026-06-03: "Owner with Plan Title (and all other Model, Contract,
// other restore areas too) in the Restore headings, important info."
// Pass the CURRENT plan's owner names so version cards can fall back to
// them when the snapshot didn't record any owners (most snapshots before
// 2026-05-13 lack owner data — they should still display owner info from
// the currently-active plan when the snapshot's planName matches).
const props = defineProps<{
  /** Owner names from the currently-active PlanModel. Used as fallback when
   *  a snapshot has no recorded owners. */
  currentPlanOwners?: string[]
  /** Current PlanModel name — for matching snapshots to the active plan
   *  before applying the fallback. */
  currentPlanName?: string
}>()

const emit = defineEmits<{
  /**
   * 2026-05-13: signature extended to carry `planName` + `planOwners` from
   * the restored snapshot so the parent can switch the active PlanModel
   * identity to match the restored spec (previously the parent kept whatever
   * model was already active, leaving the bar showing the wrong plan name —
   * which Tom reported as "could not restore Improve overall").
   */
  restore: [
    spec: SpecBlock,
    plan: EvoStepPlan | null,
    planName: string,
    planOwners: string[],
  ]
  /**
   * User clicked the glyph half of any Restore split-button.
   * Parent should open the SaveGlyphHistoryPanel essay modal.
   */
  'open-save-glyph-history': []
  /**
   * 2026-05-14: user clicked one of the OTHER saved plans listed at the top
   * of the panel. Parent reuses its existing handleRestoreModel(model) path
   * (same path the Actions-menu "Start with a Previous Plan" uses).
   */
  'load-plan': [model: PlanModel]
}>()

const { history, restoreVersion, recoverFromStorage } = useSpecHistory()

// ── Recovery state (Tom 2026-05-14: "history: can you reinstate any old
// files, none there now") — in-app replacement for the 2026-05-13
// DevTools-paste recovery snippet. Scans every localStorage key that could
// hold a plan or a history backup and reinstates orphaned entries.
const recoveryRunning = ref(false)
const recoveryMessage = ref<string | null>(null)
let _recoveryMsgTimer: ReturnType<typeof setTimeout> | null = null

function _flashRecoveryMessage(msg: string, ms: number = 8_000): void {
  recoveryMessage.value = msg
  if (_recoveryMsgTimer) clearTimeout(_recoveryMsgTimer)
  _recoveryMsgTimer = setTimeout(() => { recoveryMessage.value = null }, ms)
}

function handleReinstateLostPlans(): void {
  if (recoveryRunning.value) return
  recoveryRunning.value = true
  try {
    const report = recoverFromStorage()
    if (report.recovered === 0) {
      _flashRecoveryMessage(
        report.scanned === 0
          ? 'Nothing to scan in THIS browser. If your plans were saved in a different browser, tab, or device, use Load Plans File (below) with a .json file you saved from there — or click Save Plans File over there first.'
          : `Nothing new — every plan in storage (${report.scanned} source${report.scanned === 1 ? '' : 's'}) is already in history.`,
        12_000,
      )
    } else {
      const where = report.sources.length > 0 ? ` from ${report.sources.join(', ')}` : ''
      _flashRecoveryMessage(`Reinstated ${report.recovered} plan${report.recovered === 1 ? '' : 's'}${where}.`)
    }
  } catch (err) {
    console.error('[SpecHistory] recoverFromStorage threw:', err)
    _flashRecoveryMessage('⚠️ Recovery failed — see console for details.')
  } finally {
    recoveryRunning.value = false
  }
}

// ── Cross-browser recovery (Tom 2026-05-14: "Nothing to scan... in ultra") ──
// localStorage is partitioned per origin: plans saved at localhost:5173 are
// invisible at localhost:4173 or any preview/production origin. The fix is a
// portable backup file — already implemented by `exportAllPlanModelsBackup`
// + `importPlanModelsBackup` in useSpecModel. We expose both right here next
// to the 🩹 Reinstate button so the user never needs to leave the History
// panel to recover from another browser.

const importFileInput = ref<HTMLInputElement | null>(null)

function handleExportBackup(): void {
  try {
    exportAllPlanModelsBackup()
    _flashRecoveryMessage('Plans file downloaded. Open it in another browser via Load Plans File to recover those plans there.')
  } catch (err) {
    console.error('[SpecHistory] exportAllPlanModelsBackup threw:', err)
    _flashRecoveryMessage('Save failed — see console for details.')
  }
}

function handleImportBackupClick(): void {
  importFileInput.value?.click()
}

function handleImportBackupFile(e: Event): void {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (): void => {
    try {
      const text = String(reader.result ?? '')
      const data = JSON.parse(text) as unknown
      const count = importPlanModelsBackup(data)
      if (count === 0) {
        _flashRecoveryMessage('Loaded, but every plan in the file was already present (no new plans added).')
      } else {
        // After import, run recovery so the just-imported plans also appear
        // as SpecVersion entries in the history list — not just in the
        // "Your other plans" surface above.
        const report = recoverFromStorage()
        const histAdded = report.recovered
        _flashRecoveryMessage(
          `Loaded ${count} plan${count === 1 ? '' : 's'} from file` +
          (histAdded > 0 ? ` (${histAdded} surfaced into history).` : '.'),
          12_000,
        )
      }
    } catch (err) {
      console.error('[SpecHistory] importPlanModelsBackup threw:', err)
      _flashRecoveryMessage('Load failed — file is not a valid SEM App plans file. See console.')
    } finally {
      // Reset so picking the same file twice still triggers a change event.
      target.value = ''
    }
  }
  reader.onerror = (): void => {
    _flashRecoveryMessage('Could not read the file.')
    target.value = ''
  }
  reader.readAsText(file)
}
const { serialise } = useSpecExport()
const { currentModel, allModels } = useSpecModel()

// ── Copy-MD side-channel ──────────────────────────────────────────────────
// Tracks the id whose Copy MD button was just clicked so we can flip its
// label to "Copied!" for ~1.6 s. Added 2026-05-13 as a data-recovery path
// that bypasses the still-buggy Restore body for snapshots where Restore
// silently fails — Copy MD reads the snapshot's spec directly from
// localStorage and serialises it without touching the broken restore.
const exportedId = ref<string | null>(null)
let _exportFlashTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Copy the saved spec markdown to clipboard. Critical detail for Safari + PWA:
 * the copy MUST happen synchronously inside the click handler — any `await`
 * before the clipboard call breaks the user-gesture chain and Safari silently
 * rejects the write. So we use `document.execCommand('copy')` on a hidden
 * textarea FIRST (sync, gesture-safe everywhere), and only fall back to
 * `navigator.clipboard.writeText` (async) if execCommand reports failure.
 */
function handleExportMarkdown(id: string): void {
  const result = restoreVersion(id)
  if (!result) return
  const md = serialise(result.spec)

  // Sync path — hidden textarea + execCommand('copy'). Works in Safari PWA,
  // regular Safari, Chrome, Firefox, Edge; stays inside the user-gesture
  // window because there's no await.
  let copied = false
  try {
    const ta = document.createElement('textarea')
    ta.value = md
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, md.length)
    copied = document.execCommand('copy')
    document.body.removeChild(ta)
  } catch {
    copied = false
  }

  // Async fallback only if the sync path failed. Some hardened PWA contexts
  // disable execCommand; in that case the gesture may still be valid for
  // the modern Clipboard API.
  if (!copied && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(md).catch(() => { /* give up silently */ })
  }

  exportedId.value = id
  if (_exportFlashTimer) clearTimeout(_exportFlashTimer)
  _exportFlashTimer = setTimeout(() => {
    if (exportedId.value === id) exportedId.value = null
  }, 1600)
}

// ── Search state ───────────────────────────────────────────────────────────
const searchQuery = ref('')

/** Lowercase, whitespace-tokenised query. AND-match across tokens. */
const searchTokens = computed<string[]>(() =>
  searchQuery.value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 0),
)

// ── Disclosure state ───────────────────────────────────────────────────────
/**
 * Single disclosure: are the older versions currently shown?
 * 2026-05-14: Tom reported "1 plan · Show 49 older versions" looked like data
 * loss because the older versions were hidden by default — defeating the
 * whole point of a history panel ("The whole point of this feature is not to
 * lose!!!"). Default is now EXPANDED so the full chronological list is
 * always visible the moment the panel opens. The disclosure stays as a
 * cosmetic collapse, but no user starts at "they're hidden."
 */
const showOlder = ref(true)
function toggleOlder(): void { showOlder.value = !showOlder.value }

// ── Other Plans surface (Plans-vs-Versions fix) ─────────────────────────────
/**
 * The OTHER saved Plan Models (top-level distinct plans), excluding the
 * currently-active model. Each row is click-to-load so the user can switch
 * to any other plan without leaving the history panel. This is the fix for
 * Tom 2026-05-14: "no other plans were there either" — previously these
 * plans existed in `sem-plan-models` localStorage but were never surfaced
 * by the History panel, which only read `sem-spec-history-v1`.
 */
const otherPlans = computed(() => {
  const currentId = currentModel.value?.id ?? null
  return allModels.value.filter(m => m.id !== currentId)
})

function handleLoadPlan(model: unknown): void {
  // Cast from DeepReadonly<PlanModel> (returned by allModels reactive) back to
  // PlanModel so the parent's existing handleRestoreModel path can accept it.
  emit('load-plan', model as PlanModel)
}

/** "today / 3d ago / 2w ago" — short relative time for the Other-Plans rows. */
function relativeTime(ts: number | undefined): string {
  if (!ts) return ''
  const diffMs = Date.now() - ts
  const m = Math.round(diffMs / 60_000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  if (d < 7)  return `${d} day${d === 1 ? '' : 's'} ago`
  const w = Math.round(d / 7)
  if (w < 8)  return `${w} week${w === 1 ? '' : 's'} ago`
  const mo = Math.round(d / 30)
  return `${mo} month${mo === 1 ? '' : 's'} ago`
}

// ── Label colour palette ──────────────────────────────────────────────────
const labelColours: Record<string, { dot: string; badge: string }> = {
  Generated:        { dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700' },
  Sharpened:        { dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700' },
  'Make Ambitious': { dot: 'bg-pink-500',   badge: 'bg-pink-100 text-pink-700' },
  'Lean Plan':      { dot: 'bg-cyan-500',   badge: 'bg-cyan-100 text-cyan-700' },
  Restored:         { dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600' },
  Imported:         { dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700' },
}
function colours(label: string) {
  // Heuristic: any label containing "Rewrite" → orange; "Resumed"/"Loaded" → emerald
  if (/Rewrite/i.test(label)) return { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' }
  if (/Resumed|Loaded/i.test(label)) return { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' }
  return labelColours[label] ?? { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' }
}

// ── Format helpers ─────────────────────────────────────────────────────────

/** Format timestamp: "HH:MM" for today, "DD/MM HH:MM" for older. */
function formatTs(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const time = `${hh}:${mm}`
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) return `Today ${time}`
  const dd = String(d.getDate()).padStart(2, '0')
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mo} ${time}`
}

function readableCounts(summary: string): string {
  const raw = summary.includes(' — ') ? summary.split(' — ')[0] : summary
  const m = raw.match(/^(\d+)F\s*·\s*(\d+)V\s*·\s*(\d+)S/)
  if (!m) return raw
  return `${m[1]} fn · ${m[2]} val · ${m[3]} sol`
}

function summaryTopic(summary: string): string {
  if (!summary.includes(' — ')) return ''
  return summary.split(' — ').slice(1).join(' — ')
}

// ── Search match ───────────────────────────────────────────────────────────

/** Concatenate every searchable field of a version into one lowercase blob. */
function _searchBlob(v: SpecVersion): string {
  return [
    v.specName ?? v.planName ?? '',
    (v.specOwners ?? v.planOwners ?? []).join(' '),
    v.label,
    v.summary,
    formatTs(v.timestamp),
  ].join(' ').toLowerCase()
}

function matchesSearch(v: SpecVersion): boolean {
  if (searchTokens.value.length === 0) return true
  const blob = _searchBlob(v)
  return searchTokens.value.every(t => blob.includes(t))
}

// ── Flat filtered list (newest first) ──────────────────────────────────────
// 2026-05-13: restored "good restore" design. Single chronological list, no
// per-plan-name buckets. The first entry IS the latest; everything else is
// older. Plan name + owners still render on each card so users can tell
// "Improve overall" apart from "Improve User Retention" at a glance.

const filteredVersions = computed<SpecVersion[]>(() =>
  history.value
    .filter(matchesSearch)
    // history is already newest-first per useSpecHistory.addVersion(), but
    // we re-sort defensively in case a future code path inserts out of order
    // (e.g. a recovery merge from the legacy plan-models bucket).
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp),
)

const latestVersion = computed<SpecVersion | null>(() =>
  filteredVersions.value[0] ?? null,
)
const olderVersions = computed<SpecVersion[]>(() =>
  filteredVersions.value.slice(1),
)

const totalVisibleVersions = computed<number>(() => filteredVersions.value.length)

// ── People Finder ──────────────────────────────────────────────────────────
// Scans ALL history entries AND all plan models for owner/planner/scribe names.
// Shows them as clickable pills that populate the search box — so Tom can find
// "Simon" and "Susan" even if the LATEST history entry has no owner data.
// (Bug: onHistoryRestore used to discard _planOwners; now fixed in App.vue.
//  But for data already in localStorage this finder is the recovery path.)

type FoundPerson = { name: string; role: 'owner' | 'planner' | 'scribe' }

const peopleFound = computed<FoundPerson[]>(() => {
  const seen  = new Set<string>()
  const out: FoundPerson[] = []

  function push(name: string, role: FoundPerson['role']) {
    const n = name.trim()
    if (!n || seen.has(n)) return
    seen.add(n)
    out.push({ name: n, role })
  }

  // Scan every saved plan model (owners, planners, scribes)
  for (const m of allModels.value) {
    for (const o of (m.owners  ?? [])) push(o.name, 'owner')
    for (const p of (m.planners ?? [])) push(p.name, 'planner')
    for (const s of (m.scribes  ?? [])) {
      // Skip the default device-user scribe (it's a placeholder, not a real name)
      if (!s.isDefault) push(s.name, 'scribe')
    }
  }

  // Scan every history snapshot for owner names saved at snapshot time
  for (const v of history.value) {
    for (const name of (v.specOwners ?? v.planOwners ?? [])) push(name, 'owner')
  }

  return out
})

/** Owner label (e.g. "by Tom Gilb, Kai Gilb") for a single version. */
// Tom 2026-06-03: Owner with Plan Title in Restore headings (important info).
// 3-tier fallback so a version card ALWAYS shows ownership context:
//   1. Snapshot recorded owners → use those (most accurate)
//   2. No snapshot owners BUT snapshot planName matches current plan → fall
//      back to the active PlanModel's owner names (likely the same people)
//   3. Otherwise → return '' and the template renders an explicit placeholder
//      ("🔑 owner not recorded") rather than hiding the line.
function ownerLabel(v: SpecVersion): string {
  const owners = v.specOwners ?? v.planOwners
  if (owners && owners.length > 0) {
    return `🔑 ${owners.join(', ')}`
  }
  // Fallback to current spec owners when snapshot has no data AND the names
  // match (so we don't mis-attribute someone else's spec to current owner).
  const snapName = (v.specName ?? v.planName ?? '').trim()
  if (
    props.currentPlanOwners
    && props.currentPlanOwners.length > 0
    && props.currentPlanName
    && snapName === props.currentPlanName.trim()
  ) {
    return `🔑 ${props.currentPlanOwners.join(', ')}  (from current plan)`
  }
  return ''
}

/** Spec name to display (or "Untitled" when none was attached). */
function planLabel(v: SpecVersion): string {
  const n = (v.specName ?? v.planName ?? '').trim()
  return n.length > 0 ? n : 'Untitled'
}

// ── Restore ────────────────────────────────────────────────────────────────
function handleRestore(id: string): void {
  const result = restoreVersion(id)
  if (!result) return
  // Pull the SpecVersion alongside so we can pass planName + planOwners back
  // up — the parent needs both to switch the active PlanModel identity to
  // match the restored snapshot, not just swap the spec underneath.
  const ver = history.value.find((v) => v.id === id)
  emit(
    'restore',
    result.spec,
    result.plan,
    ver?.specName ?? ver?.planName ?? '',
    ver?.specOwners ?? ver?.planOwners ?? [],
  )
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- ── Sticky search header ──────────────────────────────────────────── -->
    <div class="shrink-0 px-3 py-2.5 border-b border-gray-100 bg-white">
      <label class="relative block">
        <span class="sr-only">Search history by title, owner, label, topic or date</span>
        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" aria-hidden="true">🔍</span>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search title · owner · label · topic · date…"
          class="w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-7 py-1.5 text-[12px] text-gray-700
                 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white
                 transition-all"
          aria-label="Search version history"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 text-xs
                 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
          aria-label="Clear search"
          title="Clear"
          @click="searchQuery = ''"
        >✕</button>
      </label>
      <p
        v-if="searchQuery"
        class="mt-1 text-[10px] text-gray-400"
        aria-live="polite"
      >
        {{ totalVisibleVersions }} match{{ totalVisibleVersions === 1 ? '' : 'es' }}
      </p>

      <!-- ── People Finder — scan all plans + history for known names ───────
           Shows every owner/planner/scribe name found anywhere in storage.
           Clicking a pill searches for that person across all history entries.
           This recovers names (e.g. "Simon", "Susan") even when the LATEST
           snapshot has no owner data — and after the onHistoryRestore bug
           fix owners are now carried through restores going forward.
           Color code: indigo = owner · emerald = planner · amber = scribe -->
      <div v-if="peopleFound.length > 0" class="mt-2">
        <p class="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
          👥 People in your data
        </p>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="p in peopleFound"
            :key="p.name"
            type="button"
            class="inline-flex items-center text-[11px] font-medium rounded-full px-2.5 py-0.5
                   transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400
                   hover:scale-105 active:scale-95"
            :class="{
              'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 ring-1 ring-indigo-200': p.role === 'owner',
              'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 ring-1 ring-emerald-200': p.role === 'planner',
              'bg-amber-100 text-amber-700 hover:bg-amber-200 ring-1 ring-amber-200': p.role === 'scribe',
            }"
            :title="`${p.role === 'owner' ? '🔑 Owner' : p.role === 'planner' ? '🧑 Planner' : '📝 Scribe'}: ${p.name} — click to search history for this person`"
            @click="searchQuery = p.name"
          >{{ p.name }}</button>
        </div>
      </div>
    </div>

    <!-- ── Scrollable group list ─────────────────────────────────────────── -->
    <ScrollContainer outer-class="relative flex-1 min-h-0" inner-class="h-full">
      <div class="px-3 py-2.5 space-y-3">

        <!-- ── Empty-state copy (BOTH lists empty) ─────────────────────────
             Inline so it sits in normal flow above any subsequent surfaces.
             The "No versions match" search variant appears immediately
             below — when search is active and yields nothing.

             ORDER NOTE (Tom 2026-05-14 v2): the canonical structure of this
             panel is now —
                 1. Latest version of CURRENT plan       (primary)
                 2. ▶ Show N older versions disclosure   (primary)
                 3. 📁 Your other plans                  (switch surface)
                 4. Recovery footer (🩹 / 💾 / 📥)
             …so the panel "organizes as before with Latest version top and
             option of older versions just below." -->
        <p
          v-if="history.length === 0 && otherPlans.length === 0"
          class="px-2 py-4 text-sm text-gray-400 text-center"
        >
          No previous versions yet
        </p>
        <p
          v-else-if="history.length > 0 && filteredVersions.length === 0 && searchQuery"
          class="px-2 py-4 text-sm text-gray-400 text-center"
        >
          No versions match
          <span class="font-mono text-gray-500">"{{ searchQuery }}"</span>
        </p>

        <!-- ── Latest card (when at least one version exists) ─────────── -->
        <div
          v-if="latestVersion"
          class="flex items-start gap-2.5 px-2.5 py-2 rounded-lg bg-indigo-50/40 border border-indigo-100"
        >
          <span
            class="mt-1 h-2 w-2 rounded-full shrink-0"
            :class="colours(latestVersion.label).dot"
            aria-hidden="true"
          />
          <div class="flex-1 min-w-0 space-y-1">
            <!-- Title — primary identity anchor, largest element in the card -->
            <p
              class="text-[14px] font-extrabold text-gray-900 leading-tight"
              :title="planLabel(latestVersion)"
            >
              {{ planLabel(latestVersion) }}
            </p>
            <!-- Owner — second most important, clearly coloured.
                 Tom 2026-06-03: Owner with Plan Title in Restore headings.
                 Always rendered (no v-if) so absence is explicit, not silent. -->
            <p
              class="text-[12px] font-semibold truncate leading-snug"
              :class="ownerLabel(latestVersion) ? 'text-indigo-700' : 'text-slate-400 italic'"
              :title="ownerLabel(latestVersion) || 'No owner recorded in this snapshot. Use the 🔑 chip on the Plan Title to add owners — future snapshots will inherit them.'"
            >
              {{ ownerLabel(latestVersion) || '🔑 owner not recorded' }}
            </p>
            <!-- Metadata row: badge · timestamp -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Latest</span>
              <span class="text-[10px] text-gray-400">{{ formatTs(latestVersion.timestamp) }}</span>
              <span
                class="text-[10px] rounded-full px-1.5 py-0.5 font-medium"
                :class="colours(latestVersion.label).badge"
              >{{ latestVersion.label }}</span>
            </div>
            <!-- Counts + topic -->
            <p class="text-[11px] text-indigo-700 leading-snug">
              {{ readableCounts(latestVersion.summary) }}
            </p>
            <p
              v-if="summaryTopic(latestVersion.summary)"
              class="text-[11px] text-gray-500 truncate leading-snug"
              :title="summaryTopic(latestVersion.summary)"
            >
              {{ summaryTopic(latestVersion.summary) }}
            </p>
            <p class="text-[10px] leading-snug">
              <span v-if="latestVersion.plan" class="text-emerald-600 font-medium">
                ✦ {{ latestVersion.plan.steps.length }}-step plan saved
              </span>
              <span v-else class="text-amber-600">
                No plan saved (will regenerate)
              </span>
            </p>
          </div>
          <div class="shrink-0 flex flex-col gap-1.5">
            <!-- 2026-05-14: split-button — glyph half opens "About the Get
                 Glyph" essay; action half restores the latest version. -->
            <SaveGetActionButton
              kind="get"
              label="Restore"
              :action-aria-label="`Restore latest version (${planLabel(latestVersion)})`"
              :action-title="`Restore latest version (${planLabel(latestVersion)}) — \`[*]→*\` get from vessel back to live spec`"
              chrome-class="bg-indigo-600 text-white shadow-sm"
              rounded-class="rounded-lg"
              height-class="h-10"
              text-size-class="text-xs font-bold"
              glyph-size-class="h-3.5"
              @info="emit('open-save-glyph-history')"
              @action="handleRestore(latestVersion.id)"
            />
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1 min-h-[32px] px-2.5 text-[11px] font-semibold
                     text-emerald-700 bg-white border border-emerald-300
                     hover:bg-emerald-600 hover:text-white hover:border-emerald-600 active:bg-emerald-700
                     rounded-md shadow-sm transition-all cursor-pointer
                     focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1"
              :aria-label="`Copy spec markdown of latest version to clipboard`"
              :title="`Copy the saved spec as Markdown to the clipboard — works even when Restore doesn't`"
              @click="handleExportMarkdown(latestVersion.id)"
            >
              <span aria-hidden="true">📋</span>
              <span>{{ exportedId === latestVersion.id ? 'Copied!' : 'Copy MD' }}</span>
            </button>
          </div>
        </div>

        <!-- ── Single "Show N older versions" disclosure ──────────────── -->
        <div v-if="olderVersions.length > 0">
          <button
            type="button"
            class="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600
                   hover:text-indigo-600 px-2 py-1.5 rounded
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            :aria-expanded="showOlder"
            aria-controls="older-versions"
            @click="toggleOlder"
          >
            <span
              class="transition-transform duration-150"
              :class="showOlder ? 'rotate-90' : ''"
              aria-hidden="true"
            >▶</span>
            {{ showOlder ? 'Hide' : 'Show' }}
            {{ olderVersions.length }} older version{{ olderVersions.length === 1 ? '' : 's' }}
          </button>

          <ul
            v-if="showOlder"
            id="older-versions"
            class="mt-1 ml-2 pl-3 border-l-2 border-gray-200 space-y-1.5"
            role="list"
          >
            <li
              v-for="v in olderVersions"
              :key="v.id"
              class="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
            >
              <span
                class="mt-1 h-1.5 w-1.5 rounded-full shrink-0"
                :class="colours(v.label).dot"
                aria-hidden="true"
              />
              <div class="flex-1 min-w-0">
                <!-- Title — primary identity -->
                <p
                  class="text-[12px] font-bold text-gray-800 truncate leading-snug"
                  :title="planLabel(v)"
                >
                  {{ planLabel(v) }}
                </p>
                <!-- Owner — second anchor.  Tom 2026-06-03: always render
                     (no v-if) so absence is explicit, not silent. -->
                <p
                  class="text-[10px] font-semibold truncate leading-snug"
                  :class="ownerLabel(v) ? 'text-indigo-600' : 'text-slate-400 italic'"
                  :title="ownerLabel(v) || 'No owner recorded in this snapshot.'"
                >
                  {{ ownerLabel(v) || '🔑 owner not recorded' }}
                </p>
                <!-- Metadata row -->
                <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span class="text-[9px] text-gray-400">{{ formatTs(v.timestamp) }}</span>
                  <span
                    class="text-[9px] rounded-full px-1.5 py-0.5 font-medium"
                    :class="colours(v.label).badge"
                  >{{ v.label }}</span>
                  <span class="text-[9px] text-gray-400">{{ readableCounts(v.summary) }}</span>
                </div>
                <p
                  v-if="summaryTopic(v.summary)"
                  class="text-[10px] text-gray-500 truncate leading-snug"
                  :title="summaryTopic(v.summary)"
                >
                  {{ summaryTopic(v.summary) }}
                </p>
              </div>
              <div class="shrink-0 flex flex-col gap-1">
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-1 min-h-[32px] px-2.5 text-[11px] font-bold
                         text-indigo-700 bg-white border border-indigo-300
                         hover:bg-indigo-600 hover:text-white hover:border-indigo-600 active:bg-indigo-700
                         rounded-md shadow-sm transition-all cursor-pointer
                         focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
                  :aria-label="`Restore version from ${formatTs(v.timestamp)}`"
                  :title="`Restore version from ${formatTs(v.timestamp)} — \`[*]→*\` get from vessel back to live spec`"
                  @click="handleRestore(v.id)"
                >
                  <GetGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
                  <span>Restore</span>
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-1 min-h-[28px] px-2 text-[10px] font-semibold
                         text-emerald-700 bg-white border border-emerald-300
                         hover:bg-emerald-600 hover:text-white hover:border-emerald-600 active:bg-emerald-700
                         rounded-md shadow-sm transition-all cursor-pointer
                         focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1"
                  :aria-label="`Copy spec markdown from ${formatTs(v.timestamp)} to clipboard`"
                  :title="`Copy the saved spec as Markdown — works even when Restore doesn't`"
                  @click="handleExportMarkdown(v.id)"
                >
                  <span aria-hidden="true">📋</span>
                  <span>{{ exportedId === v.id ? 'Copied!' : 'Copy MD' }}</span>
                </button>
              </div>
            </li>
          </ul>
        </div>

        <!-- ── Your Other Plans (Plans-vs-Versions surface, 2026-05-14 v2)
             Reordered to sit BELOW the Latest+Older block, not above it.
             Tom: *"looks like a list of plans but does not seem ... to
             organize as before with Latest version top and option of older
             versions just below."* The Latest card + ▶ Show N older
             disclosure are the PRIMARY surfaces; this amber section is the
             secondary affordance to SWITCH to a different plan. Distinct
             plans saved in `sem-plan-models` localStorage, excluding the
             currently-active model. Always rendered when there are other
             plans — even if `history` is empty — so a wiped
             sem-spec-history-v1 never hides legitimate plans from view. -->
        <div
          v-if="otherPlans.length > 0 && !searchQuery"
          class="rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-2"
        >
          <div class="flex items-center justify-between mb-1.5">
            <p class="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              📁 Your other plans · {{ otherPlans.length }}
            </p>
            <span class="text-[10px] text-amber-700/70">click to load</span>
          </div>
          <!-- 2026-05-15: upgraded to match the older-versions card format.
               Each plan now shows version badge + relative time, entry counts
               computed from p.spec, and owner line — same visual weight as
               the history timeline rows. Load → button right-aligned. -->
          <ul role="list" class="space-y-1.5">
            <li
              v-for="p in otherPlans"
              :key="p.id"
              class="flex items-start gap-2 px-2 py-2 rounded-md bg-white border border-amber-200
                     hover:bg-amber-50 hover:border-amber-400 transition-colors cursor-pointer"
              :title="`Load &quot;${p.name || 'Untitled'}&quot; — switches the active plan and loads its latest saved spec`"
              @click="handleLoadPlan(p)"
            >
              <!-- Amber dot — mirrors the colored dot of history timeline rows -->
              <span class="mt-1 h-1.5 w-1.5 rounded-full shrink-0 bg-amber-400" aria-hidden="true" />

              <div class="flex-1 min-w-0 space-y-0.5">
                <!-- Row 1: version badge + relative time -->
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[9px] rounded-full px-1.5 py-0.5 font-medium bg-amber-100 text-amber-700">
                    v{{ p.version }}
                  </span>
                  <span v-if="p.updatedAt" class="text-[10px] text-gray-500">
                    {{ relativeTime(new Date(p.updatedAt).getTime()) }}
                  </span>
                  <!-- Entry counts from the stored spec -->
                  <span class="text-[9px] text-gray-400">
                    {{ p.spec.functions?.length ?? 0 }} fn
                    · {{ p.spec.values?.length ?? 0 }} val
                    · {{ p.spec.solutions?.length ?? 0 }} sol
                    <template v-if="(p.spec.constraints?.length ?? 0) > 0">
                      · {{ p.spec.constraints!.length }} c
                    </template>
                  </span>
                </div>

                <!-- Row 2: plan name -->
                <p class="text-[12px] font-bold text-gray-800 truncate" :title="p.name || 'Untitled'">
                  📁 {{ p.name || 'Untitled' }}
                </p>

                <!-- Row 3: owners -->
                <p
                  v-if="p.owners?.some(o => o.name)"
                  class="text-[9px] text-gray-400 truncate leading-snug"
                >
                  by {{ p.owners.map(o => o.name).filter(Boolean).join(', ') }}
                </p>

                <!-- Row 4: sharpen indicator -->
                <p v-if="p.sharpenRounds > 0" class="text-[9px] text-violet-500 leading-snug">
                  ✦ sharpened {{ p.sharpenRounds }}×
                </p>
              </div>

              <!-- Load action -->
              <button
                type="button"
                class="shrink-0 self-center inline-flex items-center justify-center gap-1
                       min-h-[32px] px-2.5 text-[11px] font-bold
                       text-amber-700 bg-white border border-amber-300
                       hover:bg-amber-600 hover:text-white hover:border-amber-600
                       active:bg-amber-700 rounded-md shadow-sm transition-all cursor-pointer
                       focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1"
                :aria-label="`Load plan ${p.name || 'Untitled'}`"
                @click.stop="handleLoadPlan(p)"
              >
                Load →
              </button>
            </li>
          </ul>
        </div>

        <!-- ── Recovery footer — Reinstate / Save Plans File / Load Plans File
             Tom 2026-05-14: "ok 🩹 / 💾 / 📥 Recovery footer why do I see
             these obsolete icons" — replaced floppy disk 💾, paper tray 📥,
             and bandage 🩹 with the app's standing Save/Get glyph vocabulary
             (DD-001 2026-05-13) and plain-English verb labels:
               Find Lost Plans     — scans THIS browser's localStorage
                                     (sem-plan-models + *__backup-* keys),
                                     reactivated via GetGlyph (get from vessel)
               Save Plans File     — dumps every plan in THIS browser as a
                                     portable .json, via SaveGlyph (* → [*])
               Load Plans File     — loads a .json saved elsewhere into THIS
                                     browser, via GetGlyph ([*] → *)

             Use the Save / Load pair when "Nothing to scan in THIS browser"
             — the plans live in another origin (different port, preview
             build, different device) and need to travel via a plans file. -->
        <div class="pt-3 mt-3 border-t border-gray-100 space-y-2">
          <button
            type="button"
            class="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md
                   bg-amber-50 border border-amber-200 text-[12px] font-semibold text-amber-800
                   hover:bg-amber-100 hover:border-amber-300 active:bg-amber-200
                   focus:outline-none focus:ring-2 focus:ring-amber-400
                   transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            :disabled="recoveryRunning"
            aria-label="Scan local storage for lost plans and reinstate them into the history list"
            title="Scan every saved plan-model snapshot in this browser and reinstate any plans missing from the list above."
            @click="handleReinstateLostPlans"
          >
            <GetGlyph size="compact" class="h-3.5 w-auto" aria-hidden="true" />
            <span>{{ recoveryRunning ? 'Scanning…' : 'Find Lost Plans (this browser)' }}</span>
          </button>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 px-2 py-2 rounded-md
                     bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800
                     hover:bg-emerald-100 hover:border-emerald-300 active:bg-emerald-200
                     focus:outline-none focus:ring-2 focus:ring-emerald-400
                     transition-colors cursor-pointer"
              aria-label="Save every plan in this browser to a portable plans file"
              title="Save every plan in this browser as a portable .json plans file. Keep it in iCloud Drive or email it to yourself, then Load it in another browser to carry plans across devices or origins."
              @click="handleExportBackup"
            >
              <SaveGlyph size="compact" class="h-3.5 w-auto" aria-hidden="true" />
              <span>Save Plans File</span>
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 px-2 py-2 rounded-md
                     bg-sky-50 border border-sky-200 text-[11px] font-semibold text-sky-800
                     hover:bg-sky-100 hover:border-sky-300 active:bg-sky-200
                     focus:outline-none focus:ring-2 focus:ring-sky-400
                     transition-colors cursor-pointer"
              aria-label="Load a plans file saved from another browser"
              title="Pick a .json plans file you saved from another browser or device. Plans from the file are merged into this browser (existing IDs are NOT overwritten). Use this when Find Lost Plans shows 'Nothing to scan'."
              @click="handleImportBackupClick"
            >
              <GetGlyph size="compact" class="h-3.5 w-auto" aria-hidden="true" />
              <span>Load Plans File</span>
            </button>
          </div>

          <!-- Hidden file input driven by the Import button -->
          <input
            ref="importFileInput"
            type="file"
            accept="application/json,.json"
            class="hidden"
            aria-hidden="true"
            tabindex="-1"
            @change="handleImportBackupFile"
          />

          <p
            v-if="recoveryMessage"
            class="text-[11px] leading-snug px-1 text-amber-800"
            aria-live="polite"
          >
            {{ recoveryMessage }}
          </p>
          <p
            v-else
            class="text-[10px] leading-snug px-1 text-gray-400"
          >
            Find scans this browser. Save + Load carry plans between browsers, devices, and preview builds (different origins don't share storage). All operations are reversible — a safety snapshot is taken before each merge.
          </p>
        </div>
      </div>
    </ScrollContainer>
  </div>
</template>
