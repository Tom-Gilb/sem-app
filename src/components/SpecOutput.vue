<!-- UNIT_TYPE=Widget -->
<!-- SpecOutput — displays the generated Planguage spec as formatted cards -->
<!-- Supports Before/After toggle: "Before" shows raw SEM input; "After" shows generated spec -->
<!-- Spec: S.EvoStep2.PipelineHandler / V.EvoStep2.TranslationExitGate / S.EvoStep3.SerialiserComposable -->
<template>
  <section
    v-if="loading || error || spec"
    aria-label="Generated Planguage Specification"
    class="w-full mt-6"
  >
    <!-- Loading state -->
    <div
      v-if="loading"
      role="status"
      aria-live="polite"
      aria-label="Generating specification"
      class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <!-- Feature #1 — Streaming text display -->
      <template v-if="streamingText">
        <pre class="font-mono text-xs text-slate-700 bg-slate-50 rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap">{{ streamingText }}<span class="animate-pulse">▋</span></pre>
      </template>
      <template v-else>
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <span
              class="inline-block h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
              aria-hidden="true"
            />
            <span class="text-sm text-slate-600">Generating specification…</span>
          </div>
          <div class="space-y-1.5">
            <div class="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                class="h-full rounded-full bg-slate-600 transition-[width] duration-1000 ease-linear"
                :style="{ width: loadingEstPct + '%' }"
                role="progressbar"
                :aria-valuenow="loadingEstPct"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="`Building spec — approximately ${loadingEstPct}% complete`"
              />
            </div>
            <p class="text-[11px] text-slate-400">
              ~{{ loadingEstPct }}% · {{ loadingElapsed }}s elapsed
              <span v-if="loadingElapsed > 20"> — can take up to 90s on slow networks</span>
            </p>
          </div>
        </div>
      </template>
    </div>

    <!-- Error state -->
    <div
      v-else-if="error && !errorDismissed"
      role="alert"
      aria-live="assertive"
      class="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-red-700">Could not generate spec</p>
          <p class="mt-1 text-sm text-red-600 break-words">{{ errorDisplay }}</p>
          <a
            v-if="errorLink"
            :href="errorLink"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700 underline hover:text-red-900"
          >Add credits →</a>
        </div>
        <!-- CloseDot rule: panel-level error banner dismiss -->
        <CloseDot
          variant="on-light"
          aria-label="Dismiss error"
          title="Dismiss this error"
          @click="errorDismissed = true"
        />
      </div>
    </div>

    <!-- Spec area with toggle -->
    <div v-else-if="spec" class="space-y-3">

      <!-- Sharpening summary strip — single line showing total changes + timestamp -->
      <div
        v-if="sharpenSummary"
        class="flex items-center gap-1.5 px-1"
        aria-label="Sharpening applied to this spec"
      >
        <span aria-hidden="true" class="text-amber-500 text-[11px] leading-none">✂️</span>
        <span class="text-[11px] font-medium text-amber-700">
          <template v-if="sharpenSummary.totalChanges > 0">
            {{ sharpenSummary.totalChanges }} new change{{ sharpenSummary.totalChanges === 1 ? '' : 's' }}
          </template>
          <template v-else>Sharpened — no changes made</template>
          <span v-if="sharpenSummary.at" class="text-amber-500 font-normal"> · {{ _formatTimestamp(sharpenSummary.at) }}</span>
        </span>
      </div>

      <!-- Header bar with toggle + action buttons -->
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex flex-col gap-0.5">
            <h2 class="text-sm font-semibold text-slate-700">Generated Spec</h2>
            <!-- Feature #177 — Generated-at timestamp -->
            <time
              v-if="generatedAt"
              :datetime="generatedAt.toISOString()"
              class="text-[10px] text-slate-400 leading-tight"
              :title="`Spec generated at ${generatedAt.toLocaleString()}`"
            >{{ _formatTimestamp(generatedAt) }}</time>
          </div>
          <!-- Feature #20 — Domain Auto-Detect Badge -->
          <span
            :class="domainBadgeClass"
            class="rounded-full px-2.5 py-0.5 text-xs font-medium"
            aria-label="Detected planning domain"
          >
            <span :class="domainDotClass" aria-hidden="true">●</span>
            {{ domainResult.domain }}
          </span>

          <!-- Feature #22 — Spec Quality Ring Gauge -->
          <div
            v-if="qualityResult"
            class="relative inline-flex items-center justify-center"
            :title="qualityTooltip"
            :aria-label="`Spec quality score: ${qualityResult.score}, grade ${qualityResult.grade}`"
          >
            <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
              <!-- Background circle -->
              <circle
                cx="20" cy="20" r="16"
                fill="none"
                stroke="#e5e7eb"
                stroke-width="4"
              />
              <!-- Progress arc -->
              <circle
                cx="20" cy="20" r="16"
                fill="none"
                :stroke="arcStrokeColor"
                stroke-width="4"
                stroke-linecap="round"
                :stroke-dasharray="`${RING_CIRCUMFERENCE}`"
                :stroke-dashoffset="`${RING_CIRCUMFERENCE - arcLength}`"
                transform="rotate(-90 20 20)"
                class="quality-arc"
              />
              <!-- Centre score text -->
              <text
                x="20" y="20"
                text-anchor="middle"
                dominant-baseline="central"
                font-size="9"
                font-weight="bold"
                fill="#374151"
              >{{ qualityResult.score }}</text>
            </svg>
          </div>

        </div>
        <div class="flex flex-col items-end gap-3 pt-0.5">

          <!-- ── Controls (always visible) ── -->
          <div class="flex flex-wrap items-center justify-end gap-1.5">

            <!-- Evo Step 13 — 🧭 Plan Advisor button (visible when spec exists) -->
            <button
              v-if="spec"
              type="button"
              aria-label="Open Plan Advisor"
              title="Plan Advisor — chat with AI about your spec: ask questions, challenge entries, get suggested rewrites"
              class="flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors
                     bg-violet-100 text-violet-700 hover:bg-violet-200
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-violet-600"
              @click="emit('open-collaborator')"
            >
              <span aria-hidden="true">🧭</span> Plan Advisor
            </button>

            <!-- Before/After toggle — only visible once spec is generated -->
            <button
              type="button"
              :aria-label="showBefore ? 'Switch to spec view' : 'Switch to raw input view'"
              :aria-pressed="showBefore"
              class="flex h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-blue-600"
              :class="showBefore
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'"
              @click="toggleView"
            >
              <span v-if="showBefore">Spec →</span>
              <span v-else>← Raw input</span>
            </button>

          <!-- Speaker button — reads spec aloud (only in After view) -->
            <button
              v-if="ttsSupported && !showBefore"
              type="button"
              :aria-label="isSpeaking ? 'Stop reading aloud' : 'Read spec aloud'"
              :title="isSpeaking ? 'Stop reading aloud' : 'Read spec aloud'"
              class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400
                     hover:bg-slate-100 hover:text-slate-700
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-blue-600 transition-colors"
              :class="isSpeaking ? 'text-blue-600 bg-blue-50' : ''"
              @click="toggleSpeak"
            >
              <!-- Speaking: animated waves icon -->
              <svg v-if="isSpeaking" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <!-- Not speaking: silent speaker icon -->
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <!-- Copy and Download only in After view -->
            <template v-if="!showBefore">
              <!-- [*]=[*] Copy — Planguage keyed glyph (Tom 2026-05-29 rule) -->
              <button
                type="button"
                :aria-label="copied ? 'Copied to clipboard' : 'Copy spec to clipboard as colored HTML table'"
                :title="copied ? 'Copied!' : '[*]=[*] Copy spec — colored HTML table · paste with ⌘V in Mail, Keynote, or Notes'"
                class="flex h-11 w-11 items-center justify-center rounded-lg transition-colors
                       hover:bg-teal-50 focus-visible:outline focus-visible:outline-2
                       focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                :class="copied ? 'text-emerald-600' : 'text-teal-600/70 hover:text-teal-700'"
                @click="copyToClipboard"
              >
                <span v-if="copied" class="text-lg font-bold text-emerald-600">✓</span>
                <CopyGlyph v-else size="compact" class="h-4 w-auto" aria-label="" />
              </button>
              <!-- [*]→@ Email — Planguage keyed glyph (Tom 2026-05-29 rule) -->
              <button
                type="button"
                :aria-label="emailed ? 'Mail draft opening…' : 'Email spec — opens Mail.app with colored table pre-filled'"
                :title="emailed ? 'Mail draft opening…' : '[*]→@ Email spec — opens Mail.app with the colored spec already in the body'"
                class="flex h-11 w-11 items-center justify-center rounded-lg transition-colors
                       hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2
                       focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                :class="emailed ? 'text-emerald-600' : 'text-indigo-600/70 hover:text-indigo-700'"
                @click="emailSpec"
              >
                <span v-if="emailed" class="text-lg font-bold text-emerald-600">✓</span>
                <EmailGlyph v-else size="compact" class="h-4 w-auto" aria-label="" />
              </button>
              <a
                :href="downloadHref"
                download="spec.md"
                aria-label="Download spec as Markdown file"
                title="Download spec as Markdown"
                class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400
                       hover:bg-slate-100 hover:text-slate-700
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-blue-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </a>
            </template>

            <!-- Feature #49 — Merge button (shown when fork is open) -->
            <button
              v-show="activeProfile === 'All'"
              v-if="forkOpen && forkedSpec"
              type="button"
              title="Merge forked spec back"
              aria-label="Merge original and forked specs"
              class="h-11 px-3 text-xs font-medium rounded-lg bg-teal-200 text-teal-800 hover:bg-teal-300
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-teal-700 transition-colors"
              @click="handleMerge"
            >
              ⇌ Merge
            </button>

            <!-- Feature #49 — Close Fork button -->
            <button
              v-show="activeProfile === 'All'"
              v-if="forkOpen"
              type="button"
              title="Close the fork panel"
              aria-label="Close fork panel"
              class="h-11 px-3 text-xs font-medium rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-slate-500 transition-colors"
              @click="handleCloseFork"
            >
              ✕ Close Fork
            </button>

          </div>

          <!-- ── Profile + Palette row ─────────────────────────────────────────────── -->
          <div class="relative flex items-center gap-2 px-1 pt-1">
            <!-- Single profile pill — shows active filter, click opens picker -->
            <button
              type="button"
              :aria-label="`Active profile: ${activeProfile}. Change profile`"
              class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
              :class="activeProfile !== 'All'
                ? 'border-slate-500 bg-slate-50 text-slate-700'
                : 'border-slate-200 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-600'"
              @click="profilePickerOpen = !profilePickerOpen"
            >
              <span aria-hidden="true">{{ PROFILE_EMOJIS[activeProfile] }}</span>
              {{ activeProfile }}
              <svg class="h-2.5 w-2.5 opacity-40 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" />
              </svg>
            </button>
            <!-- Profile picker popover -->
            <div
              v-if="profilePickerOpen"
              class="absolute bottom-full left-0 mb-1 z-50 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl min-w-[8rem]"
            >
              <button
                v-for="p in PROFILE_NAMES"
                :key="p"
                type="button"
                class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
                :class="activeProfile === p ? 'text-slate-800 font-semibold bg-slate-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'"
                @click="activeProfile = p; profilePickerOpen = false"
              >
                <span aria-hidden="true">{{ PROFILE_EMOJIS[p] }}</span>
                {{ p }}
              </button>
            </div>
            <!-- Backdrop for profile picker -->
            <div v-if="profilePickerOpen" class="fixed inset-0 z-40" aria-hidden="true" @click="profilePickerOpen = false" />
            <!-- 📖 Glossary — visible shortcut to the spec-tailored glossary panel
                 Amber-themed with term count badge so it's easy to find. -->
            <button
              type="button"
              title="Spec glossary — all terms extracted from your spec with definitions and cross-references"
              aria-label="Open spec glossary"
              :aria-pressed="glossaryOpen"
              class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5
                     text-xs font-semibold transition-colors
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1
                     focus-visible:outline-amber-600"
              :class="glossaryOpen
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400'"
              @click="handleGlossary"
            >
              <span aria-hidden="true" class="leading-none">📖</span>
              <span>Glossary</span>
              <!-- Show count once terms have been extracted -->
              <span
                v-if="glossary.length > 0"
                class="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                :class="glossaryOpen ? 'bg-white/30 text-white' : 'bg-amber-200 text-amber-800'"
              >{{ glossary.length }}</span>
            </button>

            <!-- ⌘F Find shortcut pill (renamed from ⌘K Search 2026-05-12) -->
            <button
              type="button"
              title="Find features (⌘F / Ctrl+F)"
              aria-label="Find features (command palette)"
              class="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
              @click="palette.open()"
            >
              <span aria-hidden="true" class="text-xs leading-none">🔍</span>
              <span>Find</span>
              <kbd class="font-mono text-[9px] leading-none border border-slate-200 rounded px-1 py-0.5 text-slate-300">⌘F</kbd>
            </button>
          </div>


          <!-- ── Feature Dropdown Menu Bar — only when spec exists ── -->
          <template v-if="spec">
            <!-- Backdrop: dismisses any open dropdown on outside click -->
            <div
              v-if="activeMenu !== null"
              class="fixed inset-0 z-30"
              aria-hidden="true"
              @click="activeMenu = null"
            />

            <div class="flex items-center gap-0.5">
              <div
                v-for="group in MENU_GROUPS"
                :key="group.id"
                class="relative"
              >
                <!-- Group trigger: emoji + label always visible, no hover-reveal -->
                <button
                  type="button"
                  :aria-haspopup="true"
                  :aria-expanded="activeMenu === group.id"
                  :aria-label="group.label"
                  class="inline-flex items-center rounded-lg px-2 py-1.5 transition-colors duration-100"
                  :class="activeMenu === group.id
                    ? 'text-slate-700 bg-slate-100'
                    : 'text-slate-300 hover:text-slate-600 hover:bg-slate-50'"
                  @click="activeMenu = activeMenu === group.id ? null : group.id"
                >
                  <span class="text-sm leading-none select-none">{{ group.emoji }}</span>
                  <span class="text-[10px] font-semibold tracking-wide ml-1 whitespace-nowrap">{{ group.label }}</span>
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
                    style="height:0.6rem;width:0.6rem;flex-shrink:0;opacity:0.4;margin-left:0.1rem"
                  ><path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z" /></svg>
                </button>

                <!-- Dropdown panel -->
                <div
                  v-if="activeMenu === group.id"
                  class="absolute right-0 top-full z-40 mt-1 min-w-[11rem] rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
                >
                  <template v-for="key in group.keys" :key="key">
                    <button
                      v-show="fp(key)"
                      type="button"
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                      @click="() => { const entry = paletteRegistry.find(e => e.key === key); entry?.action(); activeMenu = null; showToast((entry?.label ?? '') + ' · see below ↓') }"
                    >
                      <span class="shrink-0 w-5 text-center" aria-hidden="true">{{ paletteRegistry.find(e => e.key === key)?.emoji }}</span>
                      {{ paletteRegistry.find(e => e.key === key)?.label }}
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </template>

        </div>
      </div>

      <!-- Feature #38 — Spec Accessibility Checker panel -->
      <div
        v-show="a11yOpen"
        class="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3"
        aria-label="Spec accessibility check results"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-rose-700">
            ♿ Spec Check — {{ a11yIssues.length }} issue{{ a11yIssues.length === 1 ? '' : 's' }} found
          </p>
          <CloseDot
        aria-label="Close spec check panel"
        @click="a11yOpen = false"
      />
        </div>

        <!-- No issues state -->
        <div
          v-if="a11yIssues.length === 0"
          class="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-xs font-medium text-green-700"
        >
          ✓ No issues found — spec looks great!
        </div>

        <!-- Issue list -->
        <div v-else class="space-y-0">
          <div
            v-for="(issue, i) in a11yIssues"
            :key="`${issue.entryId}-${issue.field}-${i}`"
            class="py-2 border-b border-gray-100 last:border-0 flex items-start gap-2"
          >
            <!-- Severity icon -->
            <span class="shrink-0 text-sm" aria-hidden="true">
              <template v-if="issue.severity === 'error'">🔴</template>
              <template v-else-if="issue.severity === 'warning'">🟡</template>
              <template v-else>🔵</template>
            </span>
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
                <!-- Entry ID pill -->
                <span class="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-xs font-mono font-medium">
                  {{ issue.entryId }}
                </span>
                <!-- Field badge -->
                <span class="rounded bg-gray-100 text-gray-600 px-1.5 py-0.5 text-xs">
                  {{ issue.field }}
                </span>
              </div>
              <p class="text-xs font-semibold text-gray-800">{{ issue.message }}</p>
              <p class="text-xs text-gray-500 mt-0.5">{{ issue.suggestion }}</p>
            </div>
          </div>
        </div>

        <!-- Summary line -->
        <p v-if="a11yIssues.length > 0" class="text-xs text-gray-500 pt-1">
          {{ a11yErrorCount }} error{{ a11yErrorCount === 1 ? '' : 's' }}
          · {{ a11yWarningCount }} warning{{ a11yWarningCount === 1 ? '' : 's' }}
          · {{ a11yInfoCount }} info
        </p>
      </div>


      <!-- Feature #97 — Team Energy panel -->
      <div
        v-show="energyPanelOpen"
        class="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"
        aria-label="Team energy tracker panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-amber-700">⚡ Team Energy</p>
          <CloseDot
        aria-label="Close energy tracker panel"
        @click="energyPanelOpen = false"
      />
        </div>
        <div class="flex items-center gap-3">
          <button
            v-for="lvl in (['😴', '😐', '🔥'] as EnergyLevel[])"
            :key="lvl"
            type="button"
            :aria-label="`Record energy level ${lvl}`"
            class="h-12 w-12 rounded-full text-xl flex items-center justify-center transition-colors"
            :class="latestEnergyRecord?.level === lvl
              ? 'ring-2 ring-amber-400 bg-amber-100'
              : 'bg-white border border-amber-200 hover:bg-amber-50'"
            @click="recordEnergy(lvl); energyPanelOpen = false"
          >{{ lvl }}</button>
          <span
            v-if="energyRecords.length > 0"
            class="text-xs text-amber-700 ml-2"
          >{{ energySummary.dominant }} · 🔥 {{ energySummary['🔥'] }} · 😐 {{ energySummary['😐'] }} · 😴 {{ energySummary['😴'] }}</span>
          <span v-else class="text-xs text-amber-600 ml-2 italic">How does the team feel about this spec?</span>
        </div>
      </div>

      <!-- Feature #43 — Peer Review panel -->
      <div
        v-show="peerReviewOpen"
        class="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3"
        aria-label="Peer review adversarial critique results"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-red-700">🔍 Peer Review — adversarial critique</p>
          <CloseDot
        aria-label="Close peer review panel"
        @click="peerReviewOpen = false"
      />
        </div>

        <!-- Loading -->
        <div v-if="peerReviewLoading" class="flex items-center gap-2">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" aria-hidden="true"/>
          <span class="text-xs text-red-700">Stress-testing your spec…</span>
        </div>

        <!-- Error -->
        <div v-else-if="peerReviewError" role="alert" class="rounded-lg bg-red-100 border border-red-300 px-3 py-2">
          <p class="text-xs text-red-700">{{ peerReviewError }}</p>
        </div>

        <!-- Comments grouped by severity: high first -->
        <div v-else-if="peerReviewComments.length" class="space-y-2">
          <template v-for="sev in ['high', 'medium', 'low'] as const" :key="sev">
            <div
              v-for="(c, i) in peerReviewComments.filter(x => x.severity === sev)"
              :key="`${sev}-${i}`"
              class="py-2 border-b border-red-100 last:border-0 flex items-start gap-2"
            >
              <!-- Severity dot -->
              <span class="shrink-0 text-sm" aria-hidden="true">
                <template v-if="c.severity === 'high'">🔴</template>
                <template v-else-if="c.severity === 'medium'">🟡</template>
                <template v-else>🟢</template>
              </span>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <!-- Type badge -->
                  <span
                    class="rounded-full px-2 text-[10px] font-medium"
                    :class="{
                      'bg-purple-100 text-purple-700': c.type === 'assumption',
                      'bg-amber-100 text-amber-700': c.type === 'ambiguity',
                      'bg-red-200 text-red-800': c.type === 'risk',
                      'bg-orange-100 text-orange-700': c.type === 'contradiction',
                    }"
                  >{{ c.type }}</span>
                  <!-- Target in mono -->
                  <span class="font-mono text-xs text-gray-500">{{ c.target }}</span>
                </div>
                <p class="text-xs text-gray-700">{{ c.comment }}</p>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Feature #44 — Executive Summary panel -->
      <div
        v-show="summaryOpen"
        class="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3"
        aria-label="Executive summary panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-sky-700">📄 Executive Summary</p>
          <CloseDot
        aria-label="Close executive summary panel"
        @click="summaryOpen = false"
      />
        </div>

        <!-- Loading -->
        <div v-if="execSummaryLoading" class="flex items-center gap-2">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-600" aria-hidden="true"/>
          <span class="text-xs text-sky-700">Generating plain-English summary…</span>
        </div>

        <!-- Error -->
        <div v-else-if="execSummaryError" role="alert" class="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p class="text-xs text-red-700">{{ execSummaryError }}</p>
        </div>

        <!-- Result -->
        <div v-else-if="execSummaryText">
          <blockquote class="border-l-4 border-sky-400 pl-4 py-2 text-sm text-gray-700 bg-sky-50 rounded-r-lg italic">
            {{ execSummaryText }}
          </blockquote>
          <button
            type="button"
            aria-label="Copy executive summary to clipboard"
            class="mt-3 min-h-[44px] px-4 text-xs font-medium rounded-lg bg-sky-200 text-sky-800 hover:bg-sky-300 transition-colors"
            @click="copyExecSummary"
          >
            {{ summaryCopied ? '✓ Copied!' : 'Copy Summary' }}
          </button>
        </div>
      </div>

      <!-- Feature #48 — Kai Critique panel -->
      <div
        v-show="kaiOpen"
        class="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3"
        aria-label="What would Gilb do? Planguage critique panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-indigo-700">🧠 What would Gilb do?</p>
          <CloseDot
        aria-label="Close Gilb critique panel"
        @click="kaiOpen = false"
      />
        </div>

        <!-- Loading -->
        <div v-if="kaiLoading" class="flex items-center gap-2">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" aria-hidden="true"/>
          <span class="text-xs text-indigo-700">Channelling Gilb…</span>
        </div>

        <!-- Error -->
        <div v-else-if="kaiError" role="alert" class="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p class="text-xs text-red-700">{{ kaiError }}</p>
        </div>

        <!-- Critiques grouped by severity: high → medium → low -->
        <div v-else-if="kaiCritiques.length" class="space-y-2">
          <template v-for="sev in ['high', 'medium', 'low'] as const" :key="sev">
            <div
              v-for="(c, i) in kaiCritiques.filter(x => x.severity === sev)"
              :key="`${sev}-${i}`"
              class="py-2 border-b border-indigo-100 last:border-0 flex items-start gap-2"
              :class="{
                'border-l-4 border-l-red-400 pl-3': c.severity === 'high',
                'border-l-4 border-l-amber-400 pl-3': c.severity === 'medium',
                'border-l-4 border-l-slate-300 pl-3': c.severity === 'low',
              }"
            >
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <!-- Principle badge -->
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    :class="{
                      'bg-blue-100 text-blue-700': c.principle === 'measurability',
                      'bg-purple-100 text-purple-700': c.principle === 'specificity',
                      'bg-green-100 text-green-700': c.principle === 'traceability',
                      'bg-emerald-100 text-emerald-700': c.principle === 'ambition',
                      'bg-orange-100 text-orange-700': c.principle === 'clarity',
                    }"
                  >{{ c.principle }}</span>
                  <!-- Entry ID in mono -->
                  <span class="font-mono text-xs text-slate-500">{{ c.entryId }}</span>
                </div>
                <!-- Issue -->
                <p class="text-xs text-slate-700">{{ c.issue }}</p>
                <!-- Suggestion -->
                <p class="text-xs italic text-indigo-700 mt-1">{{ c.suggestion }}</p>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Feature #49 — Fork/Merge panel -->
      <div
        v-show="forkOpen"
        class="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3"
        aria-label="Spec fork and merge panel"
      >
        <!-- Panel header with chevron toggle -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-teal-700">⑂ Fork Comparison</p>
          <button
            type="button"
            :aria-label="forkExpanded ? 'Collapse fork panel' : 'Expand fork panel'"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-teal-500 hover:bg-teal-100 hover:text-teal-700 transition-colors"
            @click="forkExpanded = !forkExpanded"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 transition-transform"
              :class="forkExpanded ? '' : 'rotate-180'"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <div v-show="forkExpanded" class="space-y-3">
          <!-- Two-column grid: Original vs Fork -->
          <div class="grid grid-cols-2 gap-3">
            <!-- Original column -->
            <div>
              <p class="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Original</p>
              <div class="space-y-1">
                <div
                  v-for="f in spec!.functions"
                  :key="`orig-f-${f.id}`"
                  class="rounded bg-white border border-blue-100 px-2 py-1"
                >
                  <p class="text-[10px] font-mono text-blue-600 truncate">{{ f.id }}</p>
                  <p class="text-xs text-slate-600 truncate">{{ f.description }}</p>
                </div>
                <div
                  v-for="v in spec!.values"
                  :key="`orig-v-${v.id}`"
                  class="rounded bg-white border border-emerald-100 px-2 py-1"
                >
                  <p class="text-[10px] font-mono text-emerald-600 truncate">{{ v.id }}</p>
                  <p class="text-xs text-slate-600 truncate">{{ v.description }}</p>
                </div>
                <div
                  v-for="s in spec!.solutions"
                  :key="`orig-s-${s.id}`"
                  class="rounded bg-white border border-violet-100 px-2 py-1"
                >
                  <p class="text-[10px] font-mono text-violet-600 truncate">{{ s.id }}</p>
                  <p class="text-xs text-slate-600 truncate">{{ s.description }}</p>
                </div>
              </div>
            </div>

            <!-- Fork column -->
            <div>
              <p class="text-xs font-semibold text-teal-600 mb-2 uppercase tracking-wide">Fork</p>
              <div v-if="forkedSpec" class="space-y-1">
                <div
                  v-for="f in forkedSpec.functions"
                  :key="`fork-f-${f.id}`"
                  class="rounded bg-white border border-blue-100 px-2 py-1"
                >
                  <p class="text-[10px] font-mono text-blue-600 truncate">{{ f.id }}</p>
                  <p class="text-xs text-slate-600 truncate">{{ f.description }}</p>
                </div>
                <div
                  v-for="v in forkedSpec.values"
                  :key="`fork-v-${v.id}`"
                  class="rounded bg-white border border-emerald-100 px-2 py-1"
                >
                  <p class="text-[10px] font-mono text-emerald-600 truncate">{{ v.id }}</p>
                  <p class="text-xs text-slate-600 truncate">{{ v.description }}</p>
                </div>
                <div
                  v-for="s in forkedSpec.solutions"
                  :key="`fork-s-${s.id}`"
                  class="rounded bg-white border border-violet-100 px-2 py-1"
                >
                  <p class="text-[10px] font-mono text-violet-600 truncate">{{ s.id }}</p>
                  <p class="text-xs text-slate-600 truncate">{{ s.description }}</p>
                </div>
              </div>
              <p v-else class="text-xs text-teal-500 italic">
                Generate a new spec to populate the fork
              </p>
            </div>
          </div>

          <!-- Merge result section -->
          <div v-if="mergeResult" class="pt-3 border-t border-teal-200 space-y-2">
            <!-- Conflicts badge -->
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-slate-600">Conflicts:</span>
              <span
                :class="mergeResult.conflicts.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'"
                class="rounded-full px-2 py-0.5 text-xs font-bold"
              >
                {{ mergeResult.conflicts.length }}
              </span>
            </div>

            <!-- No conflicts -->
            <p
              v-if="mergeResult.conflicts.length === 0"
              class="text-xs font-medium text-emerald-700"
            >
              ✅ No conflicts — specs are compatible
            </p>

            <!-- Conflict list -->
            <div v-else class="space-y-1.5">
              <div
                v-for="(conflict, i) in mergeResult.conflicts"
                :key="`conflict-${i}`"
                class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 space-y-1"
              >
                <div class="flex items-center gap-1.5">
                  <span class="font-mono text-xs text-slate-600 font-semibold">{{ conflict.entryId }}</span>
                  <span class="text-slate-400">·</span>
                  <span class="font-mono text-xs text-slate-500">{{ conflict.field }}</span>
                </div>
                <p class="text-xs line-through text-red-600">{{ conflict.original }}</p>
                <p class="text-xs text-emerald-700">{{ conflict.forked }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature #7 — Share panel -->
      <div
        v-show="shareOpen"
        class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3"
        aria-label="Share plan"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-emerald-700">Share this plan</p>
          <CloseDot
        aria-label="Close share panel"
        @click="shareOpen = false"
      />
        </div>
        <div class="flex items-center gap-2">
          <input
            :value="planUrl"
            readonly
            aria-label="Share URL"
            class="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none"
          />
          <button
            type="button"
            aria-label="Copy Share Link"
            class="h-9 px-3 text-xs font-medium rounded-lg bg-emerald-200 text-emerald-800 hover:bg-emerald-300 transition-colors"
            @click="copyShareUrl"
          >
            {{ shareCopied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <img
          :src="qrCodeUrl"
          alt="QR code for plan"
          class="mt-3 w-[150px] h-[150px] rounded-lg"
        />
      </div>

      <!-- Feature #13 — Challenge panel -->
      <div
        v-show="challengeOpen"
        class="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"
        aria-label="AI spec challenge results"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-amber-700">⚡ Spec Challenges</p>
          <CloseDot
        aria-label="Close challenge panel"
        @click="challengeOpen = false"
      />
        </div>

        <!-- Loading -->
        <div v-if="challengeLoading" class="flex items-center gap-2">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" aria-hidden="true"/>
          <span class="text-xs text-amber-700">Analysing spec…</span>
        </div>

        <!-- Error -->
        <div v-else-if="challengeError" role="alert" class="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p class="text-xs text-red-700">{{ challengeError }}</p>
        </div>

        <!-- Results -->
        <ol v-else-if="challengeList.length" class="space-y-2">
          <li
            v-for="(item, i) in challengeList"
            :key="i"
            class="flex gap-3 border-l-2 border-amber-400 pl-3 py-1"
          >
            <span class="text-xs font-bold text-amber-600 shrink-0">{{ i + 1 }}.</span>
            <span class="text-xs text-slate-700">{{ item }}</span>
          </li>
        </ol>
      </div>

      <!-- Feature #19 — Ambitious error -->
      <div
        v-if="ambitiousError"
        role="alert"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3"
      >
        <p class="text-xs text-red-700">{{ ambitiousError }}</p>
      </div>

      <!-- Feature #23 — OKR Export panel -->
      <div
        v-show="okrOpen"
        class="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3"
        aria-label="OKR export panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-teal-700">📋 OKR Export</p>
          <CloseDot
        aria-label="Close OKR panel"
        @click="okrOpen = false"
      />
        </div>
        <pre class="font-mono text-xs text-slate-700 bg-slate-50 rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap">{{ okrText }}</pre>
        <button
          type="button"
          aria-label="Copy OKR"
          class="h-9 px-3 text-xs font-medium rounded-lg bg-teal-200 text-teal-800 hover:bg-teal-300 transition-colors"
          @click="copyOkrText"
        >
          {{ okrCopied ? 'Copied!' : 'Copy OKR' }}
        </button>
      </div>

      <!-- Feature #52 — Regulation Map panel -->
      <div
        v-show="regsOpen"
        class="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3"
        aria-label="Regulatory traceability panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-teal-700">📋 Regulatory Traceability</p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              aria-label="Copy regulatory traceability table as Markdown"
              class="min-h-[44px] px-3 text-xs font-medium rounded-lg bg-teal-200 text-teal-800 hover:bg-teal-300 transition-colors"
              @click="copyRegMarkdown(props.spec!)"
            >
              {{ regCopied ? '✓ Copied!' : 'Copy Table' }}
            </button>
            <CloseDot
        aria-label="Close regulatory traceability panel"
        @click="regsOpen = false"
      />
          </div>
        </div>

        <!-- Framework filter pills -->
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter by framework">
          <button
            v-for="pill in (['All', 'GDPR', 'ISO 9001', 'SOC 2', 'OKR'] as const)"
            :key="pill"
            type="button"
            :aria-pressed="regsFilter === pill"
            class="min-h-[44px] px-3 text-xs font-medium rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            :class="regsFilter === pill
              ? 'bg-teal-600 text-white'
              : 'bg-teal-100 text-teal-700 hover:bg-teal-200'"
            @click="regsFilter = pill"
          >
            {{ pill }}
          </button>
        </div>

        <!-- Mapping rows -->
        <div
          v-if="filteredRegMappings.length > 0"
          class="space-y-0 divide-y divide-teal-100"
        >
          <div
            v-for="m in filteredRegMappings"
            :key="`${m.entryId}-${m.framework}`"
            class="flex items-start gap-2 py-2"
          >
            <!-- Relevance dot -->
            <span
              class="mt-0.5 shrink-0 h-2 w-2 rounded-full"
              :class="{
                'bg-green-500': m.relevance === 'high',
                'bg-amber-400': m.relevance === 'medium',
                'bg-slate-300': m.relevance === 'low',
              }"
              :aria-label="`Relevance: ${m.relevance}`"
            />
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
                <!-- Entry ID -->
                <span
                  class="font-mono text-xs font-medium"
                  :class="{
                    'text-green-600': m.entryType === 'F',
                    'text-violet-600': m.entryType === 'V',
                    'text-orange-600': m.entryType === 'S',
                  }"
                >{{ m.entryId }}</span>
                <!-- Framework badge -->
                <span class="rounded-full bg-teal-100 text-teal-800 px-2 py-0.5 text-[10px] font-medium">
                  {{ m.framework }}
                </span>
              </div>
              <p class="text-xs text-slate-700">{{ m.clause }}</p>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <p
          v-else
          class="text-xs text-teal-600 italic"
        >
          No mappings — spec entries don't contain regulatory keywords
        </p>
      </div>

      <!-- Feature #54 — Time Capsule panel -->
      <div
        v-show="capsuleOpen"
        class="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3"
        aria-label="Time capsule review checklist panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-rose-700">📅 Review in {{ horizonDays }} days</p>
          <CloseDot
        aria-label="Close time capsule panel"
        @click="capsuleOpen = false"
      />
        </div>

        <!-- Horizon selector -->
        <div class="flex gap-2" role="group" aria-label="Review horizon">
          <button
            v-for="days in ([30, 60, 90] as const)"
            :key="days"
            type="button"
            :aria-pressed="horizonDays === days"
            class="min-h-[44px] px-3 text-xs font-medium rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            :class="horizonDays === days
              ? 'bg-rose-600 text-white'
              : 'bg-rose-100 text-rose-700 hover:bg-rose-200'"
            @click="horizonDays = days"
          >
            {{ days }}d
          </button>
        </div>

        <!-- Review date display -->
        <p
          v-if="capsuleReport"
          class="text-xs text-slate-600"
        >
          Review due: {{ capsuleReport.reviewDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
        </p>

        <!-- Item list or empty state -->
        <div
          v-if="capsuleReport && capsuleReport.items.length > 0"
          class="space-y-3"
        >
          <div
            v-for="item in capsuleReport.items"
            :key="item.entryId"
            class="rounded-lg bg-white border border-rose-100 px-3 py-2 space-y-1"
          >
            <p class="font-mono text-xs font-semibold text-emerald-700">{{ item.entryId }}</p>
            <p class="text-xs text-slate-600">Goal: {{ item.currentGoal }}</p>
            <!-- Visual checkbox (not a functional input) -->
            <label class="flex items-start gap-2 text-xs text-slate-700 cursor-default select-none">
              <span class="mt-0.5 shrink-0 h-4 w-4 rounded border border-slate-300 bg-white inline-block" aria-hidden="true"/>
              {{ item.question }}
            </label>
          </div>
        </div>
        <p
          v-else-if="capsuleReport && capsuleReport.items.length === 0"
          class="text-xs text-rose-600 italic"
        >
          Add V. entries to generate a review checklist
        </p>

        <!-- Copy button -->
        <button
          v-if="capsuleReport"
          type="button"
          aria-label="Copy review checklist to clipboard"
          class="min-h-[44px] px-4 text-xs font-medium rounded-lg bg-rose-200 text-rose-800 hover:bg-rose-300 transition-colors"
          @click="copyCapsule"
        >
          {{ capsuleCopied ? '✓ Copied!' : '📋 Copy Checklist' }}
        </button>
      </div>

      <!-- Feature #57 — Simplify panel -->
      <div
        v-show="simplifyOpen"
        class="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3"
        aria-label="Plain language version of spec"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-violet-700">✏️ Rewrite Spec</p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              aria-label="Copy simplified spec to clipboard"
              class="min-h-[44px] px-3 text-xs font-medium rounded-lg bg-violet-200 text-violet-800 hover:bg-violet-300 transition-colors"
              @click="copySimplified"
            >
              {{ simplifyCopied ? '✓ Copied!' : '📋 Copy All' }}
            </button>
            <button
              type="button"
              title="Close"
              aria-label="Close simplify panel"
              class="group h-3.5 w-3.5 flex items-center justify-center rounded-full bg-[#ff5f57] hover:bg-[#ff3b30] ring-1 ring-rose-900/20 transition-all duration-150 hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
              @click="simplifyOpen = false"
            ><span class="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-[#5c0000] text-[7px] font-black leading-none select-none">⊖</span></button>
          </div>
        </div>

        <!-- ── Rewrite mode selector ── -->
        <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Rewrite style">
          <button
            v-for="m in SIMPLIFY_MODES"
            :key="m.key"
            type="button"
            :role="'radio'"
            :aria-checked="simplifyActiveMode === m.key"
            :title="m.hint"
            :class="[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              simplifyActiveMode === m.key
                ? 'bg-violet-600 text-white shadow'
                : 'bg-white border border-violet-200 text-violet-700 hover:border-violet-400 hover:bg-violet-100',
              simplifyLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ]"
            :disabled="simplifyLoading"
            @click="handleSimplifyMode(m.key)"
          >
            <span aria-hidden="true">{{ m.emoji }}</span>
            {{ m.label }}
          </button>
        </div>

        <!-- ── Apply scope selector ── -->
        <div class="flex items-center gap-2 flex-wrap pt-0.5 border-t border-violet-100">
          <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Apply as:</span>
          <div class="flex gap-1.5 flex-wrap" role="radiogroup" aria-label="Apply scope">
            <button
              v-for="scope in SIMPLIFY_SCOPES"
              :key="scope.key"
              type="button"
              :role="'radio'"
              :aria-checked="simplifyScope === scope.key"
              :title="scope.hint"
              :class="[
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                simplifyScope === scope.key
                  ? 'bg-violet-600 text-white shadow'
                  : 'bg-white border border-violet-200 text-violet-600 hover:border-violet-400 hover:bg-violet-100',
              ]"
              @click="simplifyScope = scope.key"
            >
              <span aria-hidden="true">{{ scope.emoji }}</span>
              {{ scope.label }}
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="simplifyLoading" class="flex items-center gap-2">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" aria-hidden="true"/>
          <span class="text-xs text-violet-700">Simplifying spec…</span>
        </div>

        <!-- Error -->
        <div v-else-if="simplifyError" role="alert" class="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p class="text-xs text-red-700">{{ simplifyError }}</p>
        </div>

        <!-- Entry list -->
        <div v-else-if="simplified.length" class="space-y-0 divide-y divide-violet-100">
          <div
            v-for="entry in simplified"
            :key="entry.id"
            class="flex items-start gap-2 py-2.5"
          >
            <!-- Entry ID in mono, coloured by type -->
            <span
              class="shrink-0 font-mono text-xs font-semibold"
              :class="{
                'text-green-600': entry.type === 'F',
                'text-violet-600': entry.type === 'V',
                'text-orange-600': entry.type === 'S',
              }"
            >{{ entry.id }}</span>
            <!-- Original (truncated) -->
            <span class="shrink-0 text-xs italic text-slate-400 max-w-[140px] truncate" :title="entry.original">
              {{ entry.original.slice(0, 100) }}{{ entry.original.length > 100 ? '…' : '' }}
            </span>
            <!-- Arrow -->
            <span class="shrink-0 text-slate-400 text-xs" aria-hidden="true">→</span>
            <!-- Simplified text -->
            <span class="flex-1 text-xs text-slate-800">{{ entry.simplified }}</span>
          </div>
        </div>

        <!-- Empty state -->
        <p v-else class="text-xs text-violet-500 italic">
          Choose a style above then click a mode button to rewrite the spec
        </p>

        <!-- ── Apply footer ── -->
        <div v-if="simplified.length && !simplifyLoading" class="flex items-center justify-between pt-2 border-t border-violet-100">
          <p class="text-[10px] text-slate-400 leading-tight max-w-[200px]">
            <span v-if="simplifyScope === 'preview'">Preview only — spec unchanged</span>
            <span v-else-if="simplifyScope === 'copy'">Saves rewrite as a new version you can restore</span>
            <span v-else>Replaces master; original saved to history first</span>
          </p>
          <button
            type="button"
            :disabled="simplifyScope === 'preview'"
            class="min-h-[36px] px-4 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :class="simplifyScope === 'preview'
              ? 'bg-slate-100 text-slate-400'
              : 'bg-violet-600 text-white hover:bg-violet-700'"
            @click="handleApplyRewrite"
          >
            <span v-if="simplifyScope === 'copy'" class="inline-flex items-center gap-1.5">
              <SaveGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
              <span>Save as Copy</span>
            </span>
            <span v-else-if="simplifyScope === 'replace'">✅ Replace Master</span>
            <span v-else>👁 Preview only</span>
          </button>
        </div>
      </div>

      <!-- Feature #60 — Gaps panel -->
      <div
        v-show="gapsOpen"
        class="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3"
        aria-label="Spec gap analysis panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <p class="text-xs font-semibold text-indigo-700">🔍 What's Missing?</p>
            <!-- Detected domain badge -->
            <span
              v-if="gapDomain"
              class="rounded-full bg-indigo-200 text-indigo-800 px-2 py-0.5 text-[10px] font-medium"
            >
              {{ gapDomain }} (auto-detected)
            </span>
          </div>
          <CloseDot
        aria-label="Close gaps panel"
        @click="gapsOpen = false"
      />
        </div>

        <!-- Template selector pills -->
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Select gap template">
          <button
            v-for="tpl in (['Auto', 'Product', 'Engineering', 'Business', 'Research', 'Personal', 'General'] as const)"
            :key="tpl"
            type="button"
            :aria-pressed="gapTemplate === tpl"
            class="min-h-[44px] px-3 text-xs font-medium rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            :class="gapTemplate === tpl
              ? 'bg-indigo-600 text-white'
              : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'"
            @click="gapTemplate = tpl; if (props.spec) analyseGaps(props.spec)"
          >
            {{ tpl }}
          </button>
        </div>

        <!-- Gap list grouped by severity -->
        <template v-if="gaps.length > 0">
          <!-- Critical gaps -->
          <template v-for="sev in (['critical', 'recommended', 'optional'] as const)" :key="sev">
            <div
              v-for="gap in gaps.filter(g => g.severity === sev)"
              :key="gap.id"
              class="rounded-lg px-3 py-2.5 space-y-1"
              :class="{
                'bg-red-50 border border-red-200': sev === 'critical',
                'bg-amber-50 border border-amber-200': sev === 'recommended',
                'bg-slate-50 border border-slate-200': sev === 'optional',
              }"
            >
              <div class="flex items-center gap-1.5">
                <!-- Category badge -->
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  :class="{
                    'bg-red-200 text-red-800': sev === 'critical',
                    'bg-amber-200 text-amber-800': sev === 'recommended',
                    'bg-slate-200 text-slate-700': sev === 'optional',
                  }"
                >{{ gap.category }}</span>
              </div>
              <!-- Description -->
              <p class="text-xs text-slate-700">{{ gap.description }}</p>
              <!-- Example entry -->
              <p class="text-xs italic text-green-700">→ Try: {{ gap.exampleEntry }}</p>
            </div>
          </template>
        </template>

        <!-- Summary line -->
        <p
          v-if="gaps.length > 0"
          class="text-xs font-medium text-indigo-700"
        >
          {{ gaps.length }} gap{{ gaps.length === 1 ? '' : 's' }} found
        </p>
        <p
          v-else-if="gapDomain"
          class="text-xs font-medium text-emerald-700"
        >
          ✅ No gaps detected — spec covers all key areas
        </p>
      </div>

      <!-- Feature #62 — Ship Check panel -->
      <div
        v-show="shipOpen"
        class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3"
        aria-label="Before-we-ship checklist panel"
      >
        <!-- Panel header with overall status banner -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span
              class="rounded-lg px-3 py-1 text-xs font-semibold"
              :class="{
                'bg-emerald-600 text-white': shipOverallStatus === 'ready',
                'bg-amber-100 text-amber-800': shipOverallStatus === 'caution',
                'bg-red-100 text-red-800': shipOverallStatus === 'not-ready',
              }"
            >
              <template v-if="shipOverallStatus === 'ready'">🚀 Ready to ship!</template>
              <template v-else-if="shipOverallStatus === 'caution'">⚠ Caution</template>
              <template v-else>🛑 Not ready</template>
            </span>
          </div>
          <div class="flex items-center gap-2">
            <!-- Copy checklist button -->
            <button
              type="button"
              aria-label="Copy ship checklist to clipboard"
              class="min-h-[44px] px-3 text-xs font-medium rounded-lg bg-emerald-200 text-emerald-800 hover:bg-emerald-300 transition-colors"
              @click="copyChecklist"
            >
              {{ shipChecklistCopied ? '✓ Copied!' : '📋 Copy' }}
            </button>
            <!-- Close button -->
            <CloseDot
        aria-label="Close ship check panel"
        @click="shipOpen = false"
      />
          </div>
        </div>

        <!-- Progress summary -->
        <p class="text-xs text-emerald-700 font-medium">
          {{ shipChecklist.filter(i => i.checkStatus === 'pass').length }} of {{ shipChecklist.length }} goals met
        </p>

        <!-- Checklist items -->
        <div v-if="shipChecklist.length > 0" class="space-y-0 divide-y divide-emerald-100">
          <div
            v-for="item in shipChecklist"
            :key="item.entryId"
            class="flex items-start gap-2 py-2.5"
          >
            <!-- Status emoji -->
            <span class="shrink-0 text-base" aria-hidden="true">
              <template v-if="item.checkStatus === 'pass'">✅</template>
              <template v-else-if="item.checkStatus === 'warn'">⚠️</template>
              <template v-else-if="item.checkStatus === 'fail'">❌</template>
              <template v-else>❓</template>
            </span>
            <div class="flex-1 min-w-0">
              <!-- Entry ID in mono -->
              <span class="font-mono text-xs font-semibold text-slate-700">{{ item.entryId }}</span>
              <!-- Goal in slate-400 -->
              <p class="text-xs text-slate-400 mt-0.5">Goal: {{ item.goal }}</p>
              <!-- Status in slate-800 -->
              <p class="text-xs text-slate-800">Status: {{ item.status }}</p>
              <!-- Notes in italic slate-500 -->
              <p class="text-xs italic text-slate-500 mt-0.5">{{ item.notes }}</p>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <p v-else class="text-xs text-emerald-600 italic">
          No V. entries found — add Value entries with Goals to generate a checklist
        </p>

        <!-- Ship CTA when all pass -->
        <div
          v-if="shipOverallStatus === 'ready' && shipChecklist.length > 0"
          class="rounded-lg bg-emerald-100 border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-800 text-center"
          role="status"
        >
          🎉 All goals met — ready to ship!
        </div>
      </div>

      <!-- Feature #61 — Glossary panel -->
      <div
        v-show="glossaryOpen"
        class="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"
        aria-label="Auto glossary panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <p class="text-xs font-semibold text-amber-700">📖 Auto Glossary</p>
            <span class="rounded-full bg-amber-200 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
              {{ glossary.length }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              :aria-label="glossaryCopied ? 'Glossary copied' : 'Copy glossary as Markdown'"
              class="h-8 px-2 text-xs font-medium rounded-lg text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors"
              @click="copyGlossary"
            >
              {{ glossaryCopied ? '✓ Copied!' : '📋 Copy' }}
            </button>
            <CloseDot
        aria-label="Close glossary panel"
        @click="glossaryOpen = false"
      />
          </div>
        </div>

        <!-- Type filter tabs -->
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter glossary by type">
          <button
            v-for="tab in (['All', 'Acronyms', 'Domain Terms', 'Metrics'] as const)"
            :key="tab"
            type="button"
            :aria-pressed="glossaryTypeFilter === tab"
            class="min-h-[44px] px-3 text-xs font-medium rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            :class="glossaryTypeFilter === tab
              ? 'bg-amber-600 text-white'
              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'"
            @click="glossaryTypeFilter = tab"
          >
            {{ tab }}
          </button>
        </div>

        <!-- Entry list -->
        <div v-if="filteredGlossary.length > 0" class="space-y-2">
          <div
            v-for="entry in filteredGlossary"
            :key="entry.term"
            class="rounded-lg bg-white border border-amber-100 px-3 py-2.5 space-y-1"
          >
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-mono font-bold text-xs text-amber-900">{{ entry.term }}</span>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                :class="{
                  'bg-blue-100 text-blue-700': entry.type === 'acronym',
                  'bg-purple-100 text-purple-700': entry.type === 'domain-term',
                  'bg-green-100 text-green-700': entry.type === 'metric',
                }"
              >{{ entry.type }}</span>
              <span class="text-[10px] text-slate-400">used in: {{ entry.usedIn.join(', ') }}</span>
            </div>
            <p class="text-xs text-slate-700">{{ entry.definition }}</p>
          </div>
        </div>

        <!-- Empty state -->
        <p v-else class="text-xs text-amber-500 italic">
          No terms extracted
        </p>
      </div>

      <!-- Feature #63 — Story panel -->
      <div
        v-show="narrativeOpen"
        class="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3"
        aria-label="Spec story narrative panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-rose-700">📝 Spec Story</p>
          <div class="flex items-center gap-1">
            <button
              type="button"
              :aria-label="narrativeCopied ? 'Story copied' : 'Copy narrative to clipboard'"
              class="h-8 px-2 text-xs font-medium rounded-lg text-rose-700 bg-rose-100 hover:bg-rose-200 transition-colors"
              @click="copyNarrative"
            >
              {{ narrativeCopied ? '✓ Copied!' : '📋 Copy' }}
            </button>
            <CloseDot
        aria-label="Close story panel"
        @click="narrativeOpen = false"
      />
          </div>
        </div>

        <!-- Loading spinner -->
        <div v-if="narrativeLoading" class="flex items-center gap-2">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-rose-300 border-t-rose-600" aria-hidden="true"/>
          <span class="text-xs text-rose-700">Generating narrative…</span>
        </div>

        <!-- Error alert -->
        <div v-else-if="narrativeError" role="alert" class="rounded-lg bg-red-100 border border-red-300 px-3 py-2">
          <p class="text-xs text-red-700">{{ narrativeError }}</p>
        </div>

        <!-- Narrative text -->
        <p
          v-else-if="narrative"
          class="text-sm text-slate-700 leading-relaxed italic bg-slate-50 rounded-xl p-4"
        >
          {{ narrative }}
        </p>

        <!-- Regenerate button -->
        <button
          v-if="!narrativeLoading && props.spec"
          type="button"
          aria-label="Regenerate narrative"
          class="min-h-[44px] px-3 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          @click="generateNarrative(props.spec!)"
        >
          ↺ Regenerate
        </button>
      </div>

      <!-- Feature #25 — Stakeholder Sign-Off panel -->
      <div v-show="signOffOpen">
        <StakeholderSignOff :spec="props.spec" />
      </div>

      <!-- Feature #69 — Changelog panel -->
      <div
        v-if="changelogOpen"
        class="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
        aria-label="Spec change log panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-slate-700">📋 Spec Changelog</p>
          <div class="flex items-center gap-1">
            <button
              type="button"
              aria-label="Copy changelog to clipboard"
              class="h-8 px-2 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              @click="copyChangelog"
            >
              📋 Copy
            </button>
            <button
              type="button"
              aria-label="Clear changelog"
              class="h-8 px-2 text-xs font-medium rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
              @click="clearChangelog"
            >
              Clear
            </button>
            <CloseDot
        aria-label="Close changelog panel"
        @click="changelogOpen = false"
      />
          </div>
        </div>
        <!-- Empty state -->
        <p v-if="changelog.length === 0" class="text-xs text-slate-400 italic">No entries yet.</p>
        <!-- Timeline -->
        <div v-else class="space-y-2">
          <div
            v-for="entry in changelog"
            :key="entry.id"
            class="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2"
          >
            <span class="font-mono text-xs text-slate-400 shrink-0 pt-0.5">{{ entry.timestamp }}</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-slate-700">{{ entry.summary }}</p>
              <div class="mt-1 flex items-center gap-1 flex-wrap">
                <span class="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 font-medium">
                  +{{ entry.entriesAdded }} added
                </span>
                <span class="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5 font-medium">
                  ~{{ entry.entriesChanged }} changed
                </span>
                <span class="inline-flex items-center rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5 font-medium">
                  -{{ entry.entriesRemoved }} removed
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature #70 — Translate panel -->
      <div
        v-if="translateOpen"
        class="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3"
        aria-label="Spec translation panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-blue-700">🌐 Translate Spec</p>
          <CloseDot
        aria-label="Close translate panel"
        @click="translateOpen = false"
      />
        </div>
        <!-- Language toggle pills -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            aria-label="Translate to French"
            class="h-9 px-3 text-sm rounded-full border-2 transition-colors"
            :class="targetLanguage === 'fr' ? 'border-blue-500 bg-blue-100 text-blue-800 ring-2 ring-blue-400' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
            @click="targetLanguage = 'fr'"
          >
            🇫🇷 French
          </button>
          <button
            type="button"
            aria-label="Translate to German"
            class="h-9 px-3 text-sm rounded-full border-2 transition-colors"
            :class="targetLanguage === 'de' ? 'border-blue-500 bg-blue-100 text-blue-800 ring-2 ring-blue-400' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
            @click="targetLanguage = 'de'"
          >
            🇩🇪 German
          </button>
          <button
            type="button"
            aria-label="Translate to Japanese"
            class="h-9 px-3 text-sm rounded-full border-2 transition-colors"
            :class="targetLanguage === 'ja' ? 'border-blue-500 bg-blue-100 text-blue-800 ring-2 ring-blue-400' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
            @click="targetLanguage = 'ja'"
          >
            🇯🇵 Japanese
          </button>
          <button
            type="button"
            aria-label="Run translation"
            class="h-11 px-4 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            :disabled="translateLoading"
            @click="translateSpec"
          >
            <span v-if="translateLoading" class="flex items-center gap-1.5">
              <span class="inline-block h-3 w-3 animate-spin rounded-full border border-white border-t-blue-300" aria-hidden="true"/>
              Translating…
            </span>
            <span v-else>Translate</span>
          </button>
        </div>
        <!-- Error -->
        <div v-if="translateError" role="alert" class="rounded-lg bg-red-100 border border-red-300 px-3 py-2">
          <p class="text-xs text-red-700">{{ translateError }}</p>
        </div>
        <!-- Empty state -->
        <p v-else-if="translatedEntries.length === 0 && !translateLoading" class="text-xs text-slate-400 italic">
          Submit a spec first, then click Translate.
        </p>
        <!-- Entry list -->
        <div v-else class="space-y-2">
          <div
            v-for="entry in translatedEntries"
            :key="entry.id"
            class="flex items-start gap-3 rounded-lg bg-white border border-blue-100 px-3 py-2"
          >
            <span class="font-mono text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 shrink-0">{{ entry.id }}</span>
            <div class="flex-1 min-w-0 space-y-1">
              <p class="text-xs text-slate-400 italic">{{ entry.originalDescription }}</p>
              <p class="text-xs text-slate-700">→ {{ entry.translatedDescription }}</p>
            </div>
          </div>
        </div>
        <!-- Copy button (only when entries exist) -->
        <button
          v-if="translatedEntries.length > 0"
          type="button"
          aria-label="Copy translation to clipboard"
          class="h-9 px-3 text-xs font-medium rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          @click="copyTranslation"
        >
          📋 Copy Markdown
        </button>
      </div>

      <!-- Feature #72 — RICE Score panel -->
      <div
        v-if="riceOpen"
        class="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3"
        aria-label="RICE score prioritiser panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-orange-700">🍚 RICE Prioritiser</p>
          <div class="flex items-center gap-1">
            <button
              type="button"
              aria-label="Copy RICE table to clipboard"
              class="h-8 px-2 text-xs font-medium rounded-lg text-orange-700 bg-orange-100 hover:bg-orange-200 transition-colors"
              @click="copyRiceTable"
            >
              📋 Copy Table
            </button>
            <CloseDot
        aria-label="Close RICE panel"
        @click="riceOpen = false"
      />
          </div>
        </div>
        <!-- Empty state -->
        <p v-if="riceEntries.length === 0" class="text-xs text-slate-400 italic">Add a spec first to see RICE scores.</p>
        <!-- Table -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr class="sticky top-0 bg-orange-100 text-orange-800 text-left">
                <th class="px-2 py-1.5 font-semibold">ID</th>
                <th class="px-2 py-1.5 font-semibold">Scale</th>
                <th class="px-2 py-1.5 font-semibold">Reach</th>
                <th class="px-2 py-1.5 font-semibold">Impact</th>
                <th class="px-2 py-1.5 font-semibold">Conf%</th>
                <th class="px-2 py-1.5 font-semibold">Effort</th>
                <th class="px-2 py-1.5 font-semibold">RICE</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in riceEntries"
                :key="entry.id"
                class="border-t border-orange-100 bg-white hover:bg-orange-50"
              >
                <td class="px-2 py-1.5">
                  <span class="font-mono text-xs bg-orange-100 text-orange-800 rounded px-1.5 py-0.5 w-24 inline-block truncate">{{ entry.id }}</span>
                </td>
                <td class="px-2 py-1.5 text-sm truncate max-w-[160px]">{{ entry.scale }}</td>
                <td class="px-2 py-1.5">
                  <input
                    type="number"
                    :value="entry.reach"
                    min="1"
                    aria-label="Reach"
                    class="h-8 w-16 text-right border border-slate-200 rounded text-sm px-1 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    @change="updateRiceField(entry.id, 'reach', Number(($event.target as HTMLInputElement).value))"
                  />
                </td>
                <td class="px-2 py-1.5">
                  <input
                    type="number"
                    :value="entry.impact"
                    min="1"
                    max="4"
                    aria-label="Impact"
                    class="h-8 w-16 text-right border border-slate-200 rounded text-sm px-1 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    @change="updateRiceField(entry.id, 'impact', Number(($event.target as HTMLInputElement).value))"
                  />
                </td>
                <td class="px-2 py-1.5">
                  <input
                    type="number"
                    :value="entry.confidence"
                    min="0"
                    max="100"
                    aria-label="Confidence percent"
                    class="h-8 w-16 text-right border border-slate-200 rounded text-sm px-1 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    @change="updateRiceField(entry.id, 'confidence', Number(($event.target as HTMLInputElement).value))"
                  />
                </td>
                <td class="px-2 py-1.5">
                  <input
                    type="number"
                    :value="entry.effort"
                    min="0.5"
                    step="0.5"
                    aria-label="Effort in person-weeks"
                    class="h-8 w-16 text-right border border-slate-200 rounded text-sm px-1 focus:outline-none focus:ring-1 focus:ring-orange-400"
                    @change="updateRiceField(entry.id, 'effort', Number(($event.target as HTMLInputElement).value))"
                  />
                </td>
                <td class="px-2 py-1.5 font-bold text-right">
                  <span
                    :class="entry.score >= 500 ? 'text-emerald-600' : entry.score >= 200 ? 'text-amber-600' : 'text-red-600'"
                  >{{ entry.score }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Feature #75 — AI Stakeholder Interview Guide panel -->
      <div
        v-if="guideOpen"
        class="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3"
        aria-label="AI Stakeholder Interview Guide panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-teal-700">🎤 AI Stakeholder Interview Guide</p>
          <div class="flex items-center gap-1">
            <button
              v-if="guideGroups.length > 0"
              type="button"
              aria-label="Copy interview guide to clipboard"
              class="h-8 px-2 text-xs font-medium rounded-lg text-teal-700 bg-teal-100 hover:bg-teal-200 transition-colors"
              @click="copyGuide"
            >
              📋 Copy
            </button>
            <CloseDot
        aria-label="Close interview guide panel"
        @click="guideOpen = false; clearGuide()"
      />
          </div>
        </div>
        <!-- Loading -->
        <div v-if="guideGenerating" class="flex items-center gap-2">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-teal-300 border-t-teal-700" aria-hidden="true"/>
          <span class="text-xs text-teal-600">Generating interview questions…</span>
        </div>
        <!-- Error -->
        <div v-else-if="guideError" role="alert" class="rounded-lg border border-red-200 bg-red-50 p-3">
          <p class="text-xs text-red-700">{{ guideError }}</p>
        </div>
        <!-- Empty state -->
        <p v-else-if="guideGroups.length === 0" class="text-xs text-slate-400 italic">Submit a spec first to generate interview questions.</p>
        <!-- Guide groups -->
        <div v-else class="space-y-4">
          <div
            v-for="group in guideGroups"
            :key="group.stakeholder"
            class="space-y-1"
          >
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-teal-800">{{ group.stakeholder }}</span>
              <span class="inline-flex items-center justify-center rounded-full bg-teal-200 text-teal-800 text-xs px-1.5 py-0.5 font-bold">
                {{ group.questions.length }}
              </span>
            </div>
            <ol class="list-decimal list-inside space-y-1 pl-1">
              <li
                v-for="(q, qi) in group.questions"
                :key="qi"
                class="text-xs text-slate-700 leading-snug"
              >
                {{ q.question }}
              </li>
            </ol>
          </div>
        </div>
      </div>

      <!-- Feature #76 — Spec Compliance Heatmap panel -->
      <div
        v-if="heatmapOpen"
        class="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3"
        aria-label="Spec compliance heatmap panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-red-700">🔥 Planguage Compliance Heatmap</p>
          <div class="flex items-center gap-1">
            <button
              v-if="heatmapRows.length > 0"
              type="button"
              aria-label="Copy heatmap to clipboard"
              class="h-8 px-2 text-xs font-medium rounded-lg text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
              @click="copyHeatmap"
            >
              📋 Copy
            </button>
            <CloseDot
        aria-label="Close heatmap panel"
        @click="heatmapOpen = false"
      />
          </div>
        </div>
        <!-- Summary bar -->
        <div v-if="heatmapRows.length > 0">
          <p
            :class="heatmapTotalViolations > 0 ? 'text-red-700' : 'text-emerald-700'"
            class="text-xs font-medium"
          >
            {{ heatmapTotalViolations > 0
              ? `${heatmapTotalViolations} violation${heatmapTotalViolations === 1 ? '' : 's'} across ${heatmapRows.length} entr${heatmapRows.length === 1 ? 'y' : 'ies'}`
              : `All checks pass across ${heatmapRows.length} entr${heatmapRows.length === 1 ? 'y' : 'ies'}` }}
          </p>
        </div>
        <!-- Empty state -->
        <p v-if="heatmapRows.length === 0" class="text-xs text-slate-400 italic">No spec loaded.</p>
        <!-- Scrollable table -->
        <ScrollContainer v-else outer-class="relative" inner-class="overflow-x-auto" inner-style="max-height: 24rem" :no-pill="true">
          <table class="text-xs border-collapse w-full">
            <thead>
              <tr class="sticky top-0 bg-red-100 text-red-800">
                <th class="px-2 py-1.5 font-semibold text-left w-24">ID</th>
                <th class="px-1.5 py-1.5 font-semibold text-left w-16">Type</th>
                <th
                  v-for="rule in heatmapRules"
                  :key="rule.id"
                  class="px-1 py-1.5 font-semibold text-center w-8"
                  :title="rule.label"
                >
                  <span style="writing-mode: vertical-lr; transform: rotate(180deg); display: inline-block; font-size: 10px;">{{ rule.id }}</span>
                </th>
                <th class="px-2 py-1.5 font-semibold text-right">Pass</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in heatmapRows"
                :key="row.id"
                class="border-t border-red-100 bg-white hover:bg-red-50"
              >
                <td class="px-2 py-1">
                  <span class="font-mono text-xs bg-red-100 text-red-800 rounded px-1.5 py-0.5 block w-24 truncate">{{ row.id }}</span>
                </td>
                <td class="px-1.5 py-1">
                  <span class="inline-flex items-center rounded px-1 py-0.5 text-xs font-medium"
                    :class="row.type === 'Value' ? 'bg-violet-100 text-violet-700' : row.type === 'Function' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'"
                  >{{ row.type[0] }}</span>
                </td>
                <td
                  v-for="(pass, ci) in row.checks"
                  :key="ci"
                  class="p-0.5 text-center"
                >
                  <span
                    :class="pass ? 'bg-emerald-400 text-emerald-900' : 'bg-red-400 text-red-900'"
                    class="inline-flex items-center justify-center rounded text-xs font-bold"
                    style="min-width:28px; min-height:28px; display:inline-flex;"
                    :title="heatmapRules[ci]?.label"
                  >{{ pass ? '✓' : '✗' }}</span>
                </td>
                <td class="px-2 py-1 text-right font-semibold"
                  :class="row.failCount === 0 ? 'text-emerald-600' : 'text-red-600'"
                >
                  {{ row.passCount }}/{{ heatmapRules.length }}
                </td>
              </tr>
            </tbody>
          </table>
        </ScrollContainer>
        <!-- Rule legend -->
        <div v-if="heatmapRows.length > 0" class="flex flex-wrap gap-x-3 gap-y-1">
          <span
            v-for="rule in heatmapRules"
            :key="rule.id"
            class="text-xs text-slate-500"
          >
            <span class="font-mono font-semibold text-red-600">{{ rule.id }}</span> {{ rule.label }}
          </span>
        </div>
      </div>

      <!-- Feature #78 — Spec Confidence Overlay panel -->
      <div
        v-if="confidenceOpen"
        class="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3"
        aria-label="Spec confidence overlay panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-purple-700">🎯 Spec Confidence</p>
          <div class="flex items-center gap-1">
            <button
              v-if="confidenceVEntries.length > 0"
              type="button"
              aria-label="Copy confidence summary to clipboard"
              class="h-8 px-2 text-xs font-medium rounded-lg text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors"
              @click="copyConfidenceSummary"
            >
              📋 Copy
            </button>
            <CloseDot
        aria-label="Close confidence panel"
        @click="confidenceOpen = false"
      />
          </div>
        </div>
        <!-- Aggregate summary banner -->
        <div v-if="confidenceVEntries.length > 0">
          <p
            :class="avgConfidence >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : avgConfidence >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200'"
            class="rounded-lg border px-3 py-2 text-xs font-medium"
          >
            Average confidence: {{ avgConfidence }}%
          </p>
          <!-- Low confidence warning -->
          <p
            v-if="lowConfidenceEntries.length > 0"
            class="mt-1 text-xs text-amber-700"
          >
            ⚠ {{ lowConfidenceEntries.length }} entr{{ lowConfidenceEntries.length === 1 ? 'y' : 'ies' }} below 60%
          </p>
        </div>
        <!-- Empty state -->
        <p v-if="confidenceVEntries.length === 0" class="text-xs text-slate-400 italic">No V. entries in spec.</p>
        <!-- Per-entry rows -->
        <div v-else class="space-y-2">
          <div
            v-for="v in confidenceVEntries"
            :key="v.id"
            class="flex items-center gap-3"
          >
            <span class="font-mono text-xs bg-purple-100 text-purple-800 rounded px-1.5 py-0.5 w-32 truncate flex-shrink-0">{{ v.id }}</span>
            <span class="text-xs text-slate-600 truncate flex-1">{{ v.scale }}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              :value="confidenceScores[v.id] ?? 75"
              class="w-24 flex-shrink-0 accent-purple-600"
              :aria-label="`Confidence for ${v.id}`"
              @input="setConfidence(v.id, Number(($event.target as HTMLInputElement).value))"
            />
            <span
              class="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold flex-shrink-0 min-w-[2.5rem]"
              :class="(confidenceScores[v.id] ?? 75) >= 80 ? 'bg-emerald-100 text-emerald-700' : (confidenceScores[v.id] ?? 75) >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'"
            >
              {{ confidenceScores[v.id] ?? 75 }}%
            </span>
          </div>
        </div>
      </div>

      <!-- Feature #79 — Spec Health Report (download only — no panel needed) -->

      <!-- Feature #80 — V. Entry Dependency Graph panel -->
      <div
        v-if="graphOpen"
        class="rounded-xl border border-cyan-200 bg-cyan-50 p-4 space-y-3"
        aria-label="V. entry dependency graph panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-cyan-700">
            🔗 V. Entry Dependency Graph
            <span class="ml-2 inline-flex items-center rounded-full bg-cyan-200 text-cyan-800 text-xs px-1.5 py-0.5 font-bold">
              {{ graph.edges.length }} edge{{ graph.edges.length !== 1 ? 's' : '' }}
            </span>
          </p>
          <CloseDot
        aria-label="Close dependency graph panel"
        @click="graphOpen = false"
      />
        </div>
        <!-- Empty state -->
        <p v-if="graph.nodes.length === 0" class="text-xs text-slate-400 italic">No V. entries in spec.</p>
        <!-- Graph -->
        <SpecDepGraph
          v-else
          :graph="graph"
          :selected-id="selectedNode"
          @select-node="selectNode"
        />
      </div>

      <!-- Feature #81 — AI Spec Debate Mode panel -->
      <div
        v-if="debateOpen"
        class="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3"
        aria-label="Spec debate mode panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-rose-700">⚔️ Spec Debate</p>
          <div class="flex items-center gap-1">
            <button
              v-if="debateTurns.length > 0"
              type="button"
              aria-label="Copy debate transcript to clipboard"
              class="h-8 px-2 text-xs font-medium rounded-lg text-rose-700 bg-rose-100 hover:bg-rose-200 transition-colors"
              @click="copyTranscript()"
            >
              📋 Copy
            </button>
            <button
              v-if="debateTurns.length > 0"
              type="button"
              aria-label="Clear debate"
              class="h-8 px-2 text-xs font-medium rounded-lg text-rose-700 bg-rose-100 hover:bg-rose-200 transition-colors"
              @click="clearDebate()"
            >
              🗑 Clear
            </button>
            <CloseDot
        aria-label="Close debate panel"
        @click="debateOpen = false"
      />
          </div>
        </div>
        <!-- Empty state -->
        <p v-if="!spec" class="text-xs text-slate-400 italic">Add a spec first.</p>
        <!-- Spinner -->
        <div v-else-if="debating" class="flex items-center gap-2 text-xs text-rose-600">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-rose-300 border-t-rose-600" aria-hidden="true" />
          Generating debate…
        </div>
        <!-- Error -->
        <p v-else-if="debateError" class="text-xs text-red-600">{{ debateError }}</p>
        <!-- Rounds -->
        <div v-else-if="debateTurns.length > 0" class="space-y-4">
          <div
            v-for="round in [1, 2, 3]"
            :key="round"
          >
            <p class="text-xs font-semibold text-slate-600 mb-1">Round {{ round }}</p>
            <div class="space-y-2">
              <div
                v-for="(turn, ti) in debateTurns.filter(t => t.round === round)"
                :key="ti"
                class="flex gap-2 items-start"
              >
                <span
                  :class="turn.persona === 'Optimist' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'"
                  class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold flex-shrink-0"
                >
                  {{ turn.persona }}
                </span>
                <p class="text-xs text-slate-700 leading-relaxed">{{ turn.argument }}</p>
                <span
                  v-if="turn.persona === 'Critic'"
                  :class="turn.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'"
                  class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium flex-shrink-0"
                >
                  {{ turn.severity }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature #83 — Elevator Pitch panel -->
      <div
        v-if="pitchOpen"
        class="rounded-xl border border-lime-200 bg-lime-50 p-4 space-y-3"
        aria-label="Elevator pitch panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-lime-700">
            🎙️ Elevator Pitch
            <span v-if="pitch" class="ml-2 text-xs font-normal text-slate-500">~{{ pitchWordCount }} words · ~{{ pitchSeconds }}s</span>
          </p>
          <div class="flex items-center gap-1">
            <button
              v-if="pitch"
              type="button"
              aria-label="Copy pitch to clipboard"
              class="h-8 px-2 text-xs font-medium rounded-lg text-lime-700 bg-lime-100 hover:bg-lime-200 transition-colors"
              @click="copyPitch()"
            >
              📋 Copy
            </button>
            <button
              v-if="pitch && 'speechSynthesis' in window"
              type="button"
              :aria-label="pitchSpeaking ? 'Stop reading aloud' : 'Read pitch aloud'"
              class="h-8 px-2 text-xs font-medium rounded-lg transition-colors"
              :class="pitchSpeaking ? 'bg-lime-300 text-lime-800' : 'text-lime-700 bg-lime-100 hover:bg-lime-200'"
              @click="pitchSpeaking ? stopSpeakingPitch() : speakPitch()"
            >
              {{ pitchSpeaking ? '⏹ Stop' : '🔊 Read Aloud' }}
            </button>
            <button
              v-if="pitch"
              type="button"
              aria-label="Regenerate elevator pitch"
              class="h-8 px-2 text-xs font-medium rounded-lg text-lime-700 bg-lime-100 hover:bg-lime-200 transition-colors"
              @click="generatePitch()"
            >
              ↺ Regenerate
            </button>
            <CloseDot
        aria-label="Close pitch panel"
        @click="pitchOpen = false"
      />
          </div>
        </div>
        <!-- Empty state -->
        <p v-if="!spec" class="text-xs text-slate-400 italic">Add a spec first.</p>
        <!-- Spinner -->
        <div v-else-if="generating" class="flex items-center gap-2 text-xs text-lime-600">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-lime-300 border-t-lime-600" aria-hidden="true" />
          Generating pitch…
        </div>
        <!-- Error -->
        <p v-else-if="pitchError" class="text-xs text-red-600">{{ pitchError }}</p>
        <!-- Pitch text -->
        <blockquote
          v-else-if="pitch"
          class="italic text-slate-700 bg-lime-50 border-l-4 border-lime-400 pl-4 py-2 text-sm leading-relaxed"
        >
          {{ pitch }}
        </blockquote>
      </div>

      <!-- Feature #85 — Persona Challenge panel -->
      <div
        v-if="personaOpen"
        class="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3"
        aria-label="Persona challenge panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-indigo-700">👤 Persona Challenge</p>
          <CloseDot
        aria-label="Close persona challenge panel"
        @click="personaOpen = false"
      />
        </div>
        <!-- Empty state -->
        <p v-if="!spec" class="text-xs text-slate-400 italic">Add a spec first.</p>
        <template v-else>
          <!-- Persona selector pills -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="p in (['CTO', 'ProductManager', 'EndUser', 'Regulator'] as const)"
              :key="p"
              type="button"
              :aria-label="`Select ${p} persona`"
              :aria-pressed="selectedPersona === p"
              class="h-9 px-3 text-xs font-medium rounded-full transition-colors"
              :class="selectedPersona === p
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'"
              @click="selectedPersona = p"
            >
              <span aria-hidden="true">{{ p === 'CTO' ? '🏗️' : p === 'ProductManager' ? '📦' : p === 'EndUser' ? '👤' : '⚖️' }}</span>
              {{ p === 'CTO' ? 'CTO' : p === 'ProductManager' ? 'Product Manager' : p === 'EndUser' ? 'End User' : 'Regulator' }}
            </button>
          </div>
          <!-- Generate button -->
          <button
            type="button"
            aria-label="Generate persona challenge"
            class="h-11 px-4 text-sm font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-50"
            :disabled="personaChallenging"
            @click="generateChallenge()"
          >
            <span v-if="personaChallenging" class="flex items-center gap-1.5">
              <span class="inline-block h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-emerald-700" aria-hidden="true" />
              Generating…
            </span>
            <span v-else>Generate Challenge</span>
          </button>
          <!-- Error -->
          <p v-if="personaChallengeError" class="text-xs text-red-600">{{ personaChallengeError }}</p>
          <!-- Result -->
          <div v-if="personaChallengeResult && !personaChallenging" class="space-y-2">
            <p class="text-sm font-semibold text-indigo-800">
              {{ personaChallengeResult.emoji }} {{ personaChallengeResult.displayName }}
            </p>
            <ol class="space-y-1.5 list-decimal list-inside">
              <li
                v-for="(challenge, i) in personaChallengeResult.challenges"
                :key="i"
                class="text-sm text-slate-700 leading-relaxed"
              >{{ challenge }}</li>
            </ol>
            <button
              type="button"
              aria-label="Copy persona challenge to clipboard"
              class="h-8 px-3 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
              @click="copyChallenge()"
            >
              📋 Copy
            </button>
          </div>
        </template>
      </div>

      <!-- Feature #87 — Assumptions Register panel -->
      <div
        v-if="assumptionsOpen"
        class="rounded-xl border border-yellow-200 bg-yellow-50 p-4 space-y-3"
        aria-label="Assumptions register panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-yellow-800">
            📌 Assumptions Register
            <span v-if="assumptions.length > 0" class="ml-1 text-yellow-600">— {{ assumptions.length }} assumption{{ assumptions.length === 1 ? '' : 's' }} found</span>
          </p>
          <div class="flex items-center gap-1">
            <button
              v-if="assumptions.length > 0"
              type="button"
              aria-label="Copy assumptions register as Markdown table"
              class="h-8 px-2 text-xs font-medium rounded-lg text-yellow-700 bg-yellow-100 hover:bg-yellow-200 transition-colors"
              @click="copyRegister()"
            >
              📋 Copy Table
            </button>
            <CloseDot
        aria-label="Close assumptions register panel"
        @click="assumptionsOpen = false"
      />
          </div>
        </div>
        <!-- Empty state -->
        <p v-if="!spec" class="text-xs text-slate-400 italic">Add a spec first.</p>
        <!-- Assumptions list -->
        <template v-else>
          <p
            v-if="assumptions.length === 1 && assumptions[0].source === 'general'"
            class="text-xs text-slate-500 italic"
          >No trigger phrases detected — showing synthetic fallback assumption.</p>
          <div class="space-y-2">
            <div
              v-for="a in assumptions"
              :key="a.id"
              class="rounded-lg bg-white border border-yellow-100 px-3 py-2.5 space-y-1"
            >
              <div class="flex flex-wrap items-center gap-1.5">
                <!-- ID badge -->
                <span class="rounded font-mono bg-yellow-200 text-yellow-900 px-1.5 py-0.5 text-xs font-bold">{{ a.id }}</span>
                <!-- Source -->
                <span class="text-xs text-slate-400">{{ a.source }}</span>
                <!-- Risk badge -->
                <span
                  class="ml-auto rounded-full px-2 py-0.5 text-xs font-bold"
                  :class="{
                    'bg-red-100 text-red-700': a.risk === 'H',
                    'bg-amber-100 text-amber-700': a.risk === 'M',
                    'bg-emerald-100 text-emerald-700': a.risk === 'L',
                  }"
                >{{ a.risk }}</span>
              </div>
              <p class="text-sm text-slate-800">{{ a.text }}</p>
              <p class="text-xs text-slate-500 italic">{{ a.validation }}</p>
            </div>
          </div>
        </template>
      </div>

      <!-- Feature #88 — Auto-Improve panel -->
      <div
        v-if="autoImproveOpen"
        class="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50 p-4 space-y-3"
        aria-label="Auto-improve panel"
      >
        <!-- Panel header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-emerald-700">✨ Auto-Improve</p>
          <CloseDot
        aria-label="Close auto-improve panel"
        @click="autoImproveOpen = false"
      />
        </div>
        <!-- Empty state -->
        <p v-if="!spec" class="text-xs text-slate-400 italic">Add a spec first.</p>
        <template v-else>
          <!-- Error -->
          <p v-if="improveError" class="text-xs text-red-600">{{ improveError }}</p>
          <!-- Processing / steps -->
          <div class="space-y-2">
            <div
              v-for="source in (['Accessibility', 'PeerReview', 'Gaps'] as const)"
              :key="source"
              class="flex items-start gap-2 text-xs"
            >
              <!-- Status icon -->
              <span class="shrink-0 mt-0.5" aria-hidden="true">
                <template v-if="improveSteps.find(s => s.source === source)?.applied">✅</template>
                <template v-else-if="improving">
                  <span class="inline-block h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-emerald-700" aria-hidden="true" />
                </template>
                <template v-else>⬜</template>
              </span>
              <div class="flex-1 min-w-0">
                <span class="font-medium text-slate-700">{{ source }}</span>
                <p v-if="improveSteps.find(s => s.source === source)" class="text-slate-500 mt-0.5 leading-relaxed">
                  {{ improveSteps.find(s => s.source === source)?.suggestion }}
                </p>
                <p v-else-if="improving" class="text-slate-400 italic">Processing…</p>
              </div>
            </div>
          </div>
          <!-- Diff view -->
          <div v-if="showDiff && improvedSpec" class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold text-emerald-700">Improved Spec Preview</p>
              <button
                type="button"
                aria-label="Copy improved spec to clipboard"
                class="h-8 px-3 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                @click="copyImprovedSpec()"
              >
                📋 Copy Improved Spec
              </button>
            </div>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p class="font-semibold text-slate-500 mb-1">Before</p>
                <p class="text-slate-600 bg-white rounded p-2 border border-slate-100">
                  {{ spec!.functions.length + spec!.values.length + spec!.solutions.length }} entries
                </p>
              </div>
              <div>
                <p class="font-semibold text-emerald-600 mb-1">After</p>
                <p class="text-slate-700 bg-white rounded p-2 border border-emerald-100 font-mono text-[10px] leading-relaxed break-all">
                  {{ improvedSpec.slice(0, 200) }}…
                </p>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Feature #90 — Tweet Thread panel -->
      <div
        v-if="tweetOpen"
        class="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3"
        aria-label="Tweet thread panel"
      >
        <!-- Header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-sky-700">
            🐦 Tweet Thread — {{ tweets.length }} tweet{{ tweets.length === 1 ? '' : 's' }}
          </p>
          <CloseDot
        aria-label="Close tweet thread panel"
        @click="tweetOpen = false"
      />
        </div>

        <!-- Empty state -->
        <p v-if="tweets.length === 0" class="text-xs text-slate-400 italic">
          No spec entries yet.
        </p>

        <!-- Tweet cards -->
        <div v-else class="space-y-2">
          <div
            v-for="(t, i) in tweets"
            :key="t.id"
            class="rounded-lg border-l-4 border-indigo-300 bg-white px-4 py-3 shadow-sm"
          >
            <!-- Entry type badge + ID -->
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-xs font-semibold text-slate-500">{{ i + 1 }}</span>
              <!-- DD-010: colour glyph + spelled-out label (universal label rule) -->
              <PlTypeBadge :entry-type="t.type" show-label />
              <span class="font-mono text-xs text-slate-600">{{ t.id }}</span>
            </div>
            <!-- Tweet text -->
            <p class="font-mono text-sm text-slate-800 leading-relaxed break-words">{{ t.tweet }}</p>
            <!-- Character counter -->
            <p
              class="mt-1 text-right text-xs font-medium"
              :class="t.overLimit ? 'text-red-600' : 'text-emerald-600'"
            >[{{ t.charCount }}/280]</p>
          </div>
        </div>

        <!-- Copy Thread button -->
        <button
          v-if="tweets.length > 0"
          type="button"
          aria-label="Copy tweet thread to clipboard"
          class="h-11 w-full rounded-lg bg-sky-200 text-sky-800 text-sm font-medium hover:bg-sky-300 transition-colors"
          @click="copyThread()"
        >
          📋 Copy Thread
        </button>
      </div>

      <!-- Feature #92 — Anti-Pattern panel -->
      <div
        v-if="antiPatternsOpen"
        class="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"
        aria-label="Anti-pattern detector panel"
      >
        <!-- Header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-amber-800">
            ⚠️ Anti-Pattern Detector
          </p>
          <CloseDot
        aria-label="Close anti-pattern panel"
        @click="antiPatternsOpen = false"
      />
        </div>

        <!-- Clean state -->
        <div
          v-if="violationCount === 0"
          class="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-medium text-emerald-700"
        >
          No violations detected ✅
        </div>

        <!-- Summary + grouped violations -->
        <template v-else>
          <!-- Summary -->
          <p
            class="text-xs font-semibold"
            :class="{
              'text-red-700': violationCount > 5,
              'text-amber-700': violationCount > 0 && violationCount <= 5,
              'text-emerald-700': violationCount === 0,
            }"
          >
            {{ violationCount }} violation{{ violationCount === 1 ? '' : 's' }} across {{ new Set(violations.map(v => v.blockId)).size }} entr{{ new Set(violations.map(v => v.blockId)).size === 1 ? 'y' : 'ies' }}
          </p>

          <!-- Grouped by pattern -->
          <div class="space-y-3">
            <template v-for="patternId in ['AP1','AP2','AP3','AP4','AP5','AP6','AP7','AP8']" :key="patternId">
              <div
                v-if="violations.filter(v => v.patternId === patternId).length > 0"
                class="rounded-lg border border-amber-100 bg-white p-3"
              >
                <!-- Pattern header -->
                <div class="flex items-center gap-2 mb-2">
                  <span class="rounded bg-amber-200 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold">{{ patternId }}</span>
                  <span class="text-xs font-semibold text-slate-700">
                    {{ violations.find(v => v.patternId === patternId)?.patternName }}
                  </span>
                  <span class="ml-auto rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5">
                    {{ violations.filter(v => v.patternId === patternId).length }}
                  </span>
                </div>
                <!-- Offending entry IDs -->
                <div class="space-y-1">
                  <div
                    v-for="viol in violations.filter(v => v.patternId === patternId)"
                    :key="`${viol.patternId}-${viol.blockId}`"
                    class="flex items-start gap-2 text-xs"
                  >
                    <span class="font-mono rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 shrink-0">{{ viol.blockId }}</span>
                    <span class="text-slate-500 leading-relaxed">{{ viol.description }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Copy Report button -->
          <button
            type="button"
            aria-label="Copy anti-pattern report to clipboard"
            class="h-11 w-full rounded-lg bg-amber-200 text-amber-900 text-sm font-medium hover:bg-amber-300 transition-colors"
            @click="copyAntiPatternReport()"
          >
            📋 Copy Report
          </button>
        </template>
      </div>

      <!-- Feature #94 — Contract Mode panel -->
      <div
        v-if="contractOpen"
        class="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3"
        aria-label="Value delivery contract panel"
      >
        <!-- Header -->
        <div class="flex items-center justify-between">
          <input
            v-model="contractTitle"
            type="text"
            class="text-lg font-bold bg-transparent border-none outline-none text-slate-800 w-full"
            aria-label="Contract title"
          />
          <CloseDot
        aria-label="Close contract panel"
        @click="contractOpen = false"
      />
        </div>

        <!-- Empty state -->
        <div
          v-if="clauses.length === 0"
          class="text-xs text-slate-500 italic py-2"
        >No V. entries found</div>

        <!-- Clause cards -->
        <div
          v-for="(clause, i) in clauses"
          :key="clause.id"
          class="rounded-lg border-l-4 border-indigo-400 bg-white p-3 space-y-2 shadow-sm"
        >
          <p class="text-sm font-semibold text-indigo-700">Clause {{ i + 1 }} — {{ clause.id }}</p>
          <div class="space-y-1 text-xs">
            <div><span class="text-slate-500 font-medium">Obligation: </span>{{ clause.obligation }}</div>
            <div><span class="text-slate-500 font-medium">Metric: </span>{{ clause.metric }}</div>
            <div><span class="text-slate-500 font-medium">Threshold: </span>{{ clause.threshold }}</div>
          </div>
          <div class="flex items-center gap-2 pt-1">
            <input
              :value="clause.signOff"
              type="text"
              placeholder="Signatory name"
              class="flex-1 rounded border border-stone-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
              @input="updateSignOff(clause.id, ($event.target as HTMLInputElement).value, clause.signedDate)"
            />
            <input
              :value="clause.signedDate"
              type="date"
              class="rounded border border-stone-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
              @input="updateSignOff(clause.id, clause.signOff, ($event.target as HTMLInputElement).value)"
            />
            <span
              v-if="clause.signOff"
              class="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium"
            >✓ Signed</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 pt-1">
          <button
            type="button"
            aria-label="Copy contract as markdown"
            class="h-11 flex-1 rounded-lg bg-stone-200 text-stone-800 text-sm font-medium hover:bg-stone-300 transition-colors"
            @click="copyContract()"
          >📋 Copy Contract</button>
          <button
            type="button"
            aria-label="Export contract as PDF — `*→[*]` save to file"
            title="Export contract as PDF — `*→[*]` save to file"
            class="h-11 flex-1 rounded-lg bg-indigo-100 text-indigo-800 text-sm font-medium hover:bg-indigo-200 transition-colors inline-flex items-center justify-center gap-1.5"
            @click="exportContractPDF()"
          >
            <SaveGlyph size="compact" class="h-3 w-auto" aria-hidden="true" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      <!-- Feature #96 — Story Map panel -->
      <div
        v-if="storyMapOpen"
        class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3"
        aria-label="Spec story map panel"
      >
        <!-- Header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-emerald-800">
            🗺️ User Story Map
            <span class="ml-1 inline-flex items-center justify-center rounded-full bg-emerald-200 text-emerald-800 text-xs px-1.5 py-0.5 font-bold">
              {{ lanes.length }} lane{{ lanes.length === 1 ? '' : 's' }}
            </span>
          </p>
          <CloseDot
        aria-label="Close story map panel"
        @click="storyMapOpen = false"
      />
        </div>

        <!-- Empty state -->
        <div
          v-if="lanes.length === 0"
          class="text-xs text-slate-500 italic py-2"
        >No F. entries found</div>

        <!-- SVG story map -->
        <div v-else class="overflow-x-auto rounded-lg bg-white border border-emerald-100">
          <SpecStoryMap
            :lanes="lanes"
            :selected-lane="selectedLane"
            @select-lane="selectedLane = $event"
          />
        </div>
      </div>

      <!-- Feature #99 — Battle Card panel -->
      <div
        v-if="battleOpen"
        class="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4 space-y-3"
        aria-label="Spec battle card panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-fuchsia-800">⚔️ Battle Card</p>
          <CloseDot
        aria-label="Close battle card panel"
        @click="battleOpen = false"
      />
        </div>

        <!-- Two-column strengths / weaknesses -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Strengths -->
          <div class="space-y-2">
            <p class="text-xs font-semibold text-emerald-700">✅ Strengths</p>
            <div
              v-for="(s, i) in strengths"
              :key="`strength-${i}`"
              class="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800"
            >{{ s }}</div>
          </div>
          <!-- Weaknesses -->
          <div class="space-y-2">
            <p class="text-xs font-semibold text-amber-700">⚠️ Weaknesses</p>
            <div
              v-for="(w, i) in weaknesses"
              :key="`weakness-${i}`"
              class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800"
            >{{ w }}</div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Copy battle card to clipboard"
          class="h-11 px-4 text-sm rounded bg-fuchsia-200 hover:bg-fuchsia-300 text-fuchsia-800 transition-colors"
          @click="copyBattleCard()"
        >
          Copy Battle Card
        </button>
      </div>

      <!-- Feature #100 — Market Size panel -->
      <div
        v-if="marketOpen"
        class="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3"
        aria-label="Market size estimate panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-violet-800">📊 Market Size Estimate</p>
          <CloseDot
        aria-label="Close market size panel"
        @click="marketOpen = false"
      />
        </div>

        <!-- Empty state -->
        <p v-if="!estimate" class="text-xs text-slate-500 italic">Submit a spec first</p>

        <template v-else>
          <!-- Concentric circles SVG -->
          <div class="flex justify-center">
            <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
              <!-- TAM — outer slate-200 -->
              <circle cx="100" cy="100" r="90" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
              <text x="100" y="30" text-anchor="middle" font-size="10" fill="#475569">TAM</text>
              <!-- SAM — middle violet-200 -->
              <circle cx="100" cy="100" r="60" fill="#ddd6fe" stroke="#c4b5fd" stroke-width="1.5"/>
              <text x="100" y="55" text-anchor="middle" font-size="10" fill="#5b21b6">SAM</text>
              <!-- SOM — inner violet-400 -->
              <circle cx="100" cy="100" r="30" fill="#a78bfa" stroke="#7c3aed" stroke-width="1.5"/>
              <text x="100" y="96" text-anchor="middle" font-size="9" font-weight="bold" fill="#ffffff">SOM</text>
              <text x="100" y="108" text-anchor="middle" font-size="8" fill="#ede9fe">${{ estimate.som }}M</text>
            </svg>
          </div>

          <!-- Values -->
          <p class="text-sm text-center text-slate-700">
            TAM ${{ estimate.tam }}M / SAM ${{ estimate.sam }}M / SOM ${{ estimate.som }}M
          </p>

          <!-- Rationale -->
          <p class="text-xs italic text-slate-500 text-center">{{ estimate.rationale }}</p>

          <button
            type="button"
            aria-label="Copy market summary to clipboard"
            class="h-11 px-4 text-sm rounded bg-violet-200 hover:bg-violet-300 text-violet-800 transition-colors"
            @click="copyMarketSummary()"
          >
            Copy Summary
          </button>
        </template>
      </div>

      <!-- Feature #102 — OKR Crosswalk panel -->
      <div
        v-if="okrCrosswalkOpen"
        class="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3"
        aria-label="OKR crosswalk panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-teal-800">🎯 OKR Crosswalk Map</p>
          <CloseDot
        aria-label="Close OKR crosswalk panel"
        @click="okrCrosswalkOpen = false"
      />
        </div>

        <!-- Objectives list -->
        <div
          v-for="(obj, oi) in crosswalkObjectives"
          :key="obj.id"
          class="rounded-lg bg-white border border-teal-100 p-3 space-y-2"
        >
          <!-- Objective header (expandable) -->
          <button
            type="button"
            :aria-label="`Toggle objective ${oi + 1}`"
            class="w-full flex items-center justify-between text-left text-xs font-semibold text-teal-800 hover:text-teal-600"
            @click="toggleCrosswalkObjective(oi)"
          >
            <span>{{ obj.objective }}</span>
            <span class="text-teal-400">{{ expandedCrosswalkObjectives.has(oi) ? '▲' : '▼' }}</span>
          </button>

          <!-- Key Results -->
          <div v-if="expandedCrosswalkObjectives.has(oi)" class="space-y-1.5 pl-2">
            <div
              v-for="kr in obj.keyResults"
              :key="kr.id"
              class="text-xs space-y-0.5"
            >
              <div class="flex items-start gap-1.5">
                <span class="font-mono bg-teal-100 text-teal-800 rounded px-1 py-0.5 shrink-0">{{ kr.id }}</span>
                <span class="text-slate-700">{{ kr.keyResult }}</span>
              </div>
              <p class="text-slate-500 pl-1">Current: {{ kr.current }} → Target: {{ kr.target }}</p>
            </div>
            <p v-if="obj.keyResults.length === 0" class="text-slate-400 italic">No V. entries mapped to this objective</p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Copy OKR crosswalk table to clipboard"
          class="h-11 px-4 text-sm rounded bg-teal-200 hover:bg-teal-300 text-teal-800 transition-colors"
          @click="copyOkrTable()"
        >
          Copy OKR Table
        </button>
      </div>

      <!-- Feature #103 — Resilience Checker panel -->
      <div
        v-if="resilienceOpen"
        class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
        aria-label="Resilience checker panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-slate-700">
            🛡️ Resilience Report
          </p>
          <CloseDot
        aria-label="Close resilience panel"
        @click="resilienceOpen = false"
      />
        </div>

        <!-- Summary badges -->
        <div class="flex items-center gap-2 text-xs font-semibold">
          <span class="rounded-full px-2.5 py-0.5 bg-red-100 text-red-700">H: {{ highCount }}</span>
          <span class="rounded-full px-2.5 py-0.5 bg-amber-100 text-amber-700">M: {{ mediumCount }}</span>
          <span class="rounded-full px-2.5 py-0.5 bg-emerald-100 text-emerald-700">L: {{ resilienceIssues.filter(i => i.risk === 'L').length }}</span>
        </div>

        <!-- Clean state -->
        <p
          v-if="resilienceIssues.length === 0"
          class="text-xs text-emerald-700 font-medium"
        >No resilience risks detected ✅</p>

        <!-- Issue list -->
        <div
          v-for="(issue, idx) in resilienceIssues"
          :key="`${issue.blockId}-${idx}`"
          class="flex items-start gap-2 text-xs py-1 border-b border-slate-100 last:border-0"
        >
          <span class="font-mono bg-slate-200 text-slate-700 rounded px-1 py-0.5 shrink-0">{{ issue.blockId }}</span>
          <span
            class="rounded-full px-1.5 py-0.5 font-bold shrink-0"
            :class="{
              'bg-red-100 text-red-700': issue.risk === 'H',
              'bg-amber-100 text-amber-700': issue.risk === 'M',
              'bg-emerald-100 text-emerald-700': issue.risk === 'L',
            }"
          >{{ issue.risk }}</span>
          <span class="text-slate-700 font-medium shrink-0">{{ issue.label }}</span>
          <span class="italic text-slate-500 truncate">{{ issue.excerpt }}</span>
        </div>

        <button
          type="button"
          aria-label="Copy resilience report to clipboard"
          class="h-11 px-4 text-sm rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
          @click="copyReport()"
        >
          Copy Report
        </button>
      </div>

      <!-- Feature #104 — Goal Ladder panel -->
      <div
        v-if="ladderOpen"
        class="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"
        aria-label="Goal ladder visualiser panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-amber-800">🪜 Goal Ladder</p>
          <CloseDot
        aria-label="Close goal ladder panel"
        @click="ladderOpen = false"
      />
        </div>

        <!-- Empty state -->
        <p
          v-if="ladderEntries.length === 0 || ladderEntries.every(e => e.rungs.length === 0)"
          class="text-xs text-amber-700"
        >No V. entries with numeric values</p>

        <!-- SVG chart -->
        <template v-else>
          <svg
            :viewBox="`0 0 ${Math.max(ladderEntries.length * 70, 500)} 270`"
            :width="Math.max(ladderEntries.length * 70, 500)"
            height="270"
            class="overflow-visible"
            aria-hidden="true"
          >
            <!-- Legend — moved down 5px to give breathing room at top -->
            <g transform="translate(10, 8)">
              <rect x="0" y="0" width="10" height="10" fill="#f59e0b" rx="2"/>
              <text x="14" y="9" font-size="9" fill="#78350f">Tolerable</text>
              <rect x="74" y="0" width="10" height="10" fill="#10b981" rx="2"/>
              <text x="88" y="9" font-size="9" fill="#064e3b">Goal</text>
              <rect x="124" y="0" width="10" height="10" fill="#7c3aed" rx="2"/>
              <text x="138" y="9" font-size="9" fill="#2e1065">Wish</text>
            </g>
            <!-- Columns -->
            <g transform="translate(0, 25)">
              <template v-for="(entry, idx) in ladderEntries" :key="entry.id">
                <g :transform="`translate(${idx * 70 + 10}, 0)`">
                  <!-- Rungs as stacked rects from bottom -->
                  <template v-for="rung in entry.rungs" :key="rung.label">
                    <rect
                      :x="5"
                      :y="entry.maxNumeric > 0 ? 180 - (rung.numericValue / entry.maxNumeric) * 180 : 160"
                      :width="50"
                      :height="entry.maxNumeric > 0 ? (rung.numericValue / entry.maxNumeric) * 180 : 10"
                      :fill="rung.colour === 'amber' ? '#fde68a' : rung.colour === 'emerald' ? '#6ee7b7' : '#c4b5fd'"
                      :stroke="rung.colour === 'amber' ? '#f59e0b' : rung.colour === 'emerald' ? '#10b981' : '#7c3aed'"
                      stroke-width="1"
                      rx="2"
                      opacity="0.85"
                    />
                  </template>
                  <!-- Entry ID label — rotated -45° so long names never overlap neighbours -->
                  <text
                    x="30"
                    y="190"
                    text-anchor="end"
                    font-size="8"
                    fill="#78716c"
                    :transform="`rotate(-45, 30, 190)`"
                  >{{ entry.id.replace(/^.*\.([^.]+)$/, '$1').slice(0, 18) }}</text>
                </g>
              </template>
            </g>
          </svg>
        </template>
      </div>

      <!-- Feature #105 — Benchmark Comparison panel -->
      <div
        v-if="benchmarkOpen"
        class="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3"
        aria-label="Benchmark comparison panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-blue-800">📏 Benchmark Comparison</p>
          <CloseDot
        aria-label="Close benchmark panel"
        @click="benchmarkOpen = false"
      />
        </div>

        <!-- Empty state -->
        <p
          v-if="comparisonRows.length === 0"
          class="text-xs text-blue-700"
        >No V. entries</p>

        <!-- Comparison table -->
        <template v-else>
          <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
              <thead>
                <tr class="text-left text-slate-600 border-b border-blue-200">
                  <th class="py-1 pr-2 font-semibold">ID</th>
                  <th class="py-1 pr-2 font-semibold">Scale</th>
                  <th class="py-1 pr-2 font-semibold">Goal</th>
                  <th class="py-1 pr-2 font-semibold">Benchmark</th>
                  <th class="py-1 font-semibold">Gap</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in comparisonRows"
                  :key="row.id"
                  class="border-b border-blue-100 last:border-0"
                >
                  <td class="py-1 pr-2 font-mono text-slate-700">{{ row.id }}</td>
                  <td class="py-1 pr-2 text-slate-600 truncate max-w-[120px]">{{ row.scale }}</td>
                  <td class="py-1 pr-2 text-slate-700">{{ row.goal }}</td>
                  <td class="py-1 pr-2">
                    <input
                      :value="row.benchmark"
                      type="text"
                      placeholder="Enter benchmark…"
                      class="w-24 rounded border border-blue-200 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      @input="setBenchmark(row.id, ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                  <td
                    class="py-1 font-medium rounded px-1.5"
                    :class="{
                      'text-emerald-700 bg-emerald-50': row.gap !== null && row.gapPositive,
                      'text-red-700 bg-red-50': row.gap !== null && !row.gapPositive && row.gap !== 0,
                      'text-slate-500': row.gap === null || row.gap === 0,
                    }"
                  >{{ row.gapLabel || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button
            type="button"
            aria-label="Copy benchmark comparison to clipboard"
            class="h-11 px-4 text-sm rounded bg-blue-200 hover:bg-blue-300 text-blue-800 transition-colors"
            @click="copyComparison()"
          >
            Copy Comparison
          </button>
        </template>
      </div>

      <!-- Feature #108 — Decision Log panel -->
      <div
        v-if="decisionsOpen"
        class="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3"
        aria-label="Decision log panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-gray-700">📓 Decision Log</p>
          <CloseDot
        aria-label="Close decision log panel"
        @click="decisionsOpen = false"
      />
        </div>

        <!-- Add decision form -->
        <div class="space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <div class="col-span-2">
              <label class="block text-xs font-medium text-gray-600 mb-0.5">What (required)</label>
              <input
                v-model="newWhat"
                type="text"
                placeholder="What was decided…"
                class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">Why</label>
              <input
                v-model="newWhy"
                type="text"
                placeholder="Rationale…"
                class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">Who</label>
              <input
                v-model="newWho"
                type="text"
                placeholder="Decision maker…"
                class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-0.5">When</label>
              <input
                v-model="newWhen"
                type="date"
                class="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>
          </div>
          <button
            type="button"
            aria-label="Add decision to log"
            class="h-11 px-4 text-sm rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
            @click="addDecision(`${domainResult.domain}, ${totalEntryCount} entries`)"
          >
            Add Decision
          </button>
        </div>

        <!-- Empty state -->
        <p
          v-if="decisions.length === 0"
          class="text-xs text-gray-500"
        >No decisions logged yet</p>

        <!-- Timeline list (newest first) -->
        <div v-else class="space-y-2">
          <div
            v-for="d in decisions"
            :key="d.id"
            class="flex items-start justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2"
          >
            <div class="flex-1 min-w-0">
              <span class="text-xs text-slate-400">{{ d.when }}</span>
              <p class="text-xs font-semibold text-slate-700 mt-0.5">{{ d.what }}</p>
              <p
                v-if="d.why || d.who"
                class="text-xs text-slate-500 mt-0.5"
              >{{ [d.why, d.who ? `— ${d.who}` : ''].filter(Boolean).join(' ') }}</p>
            </div>
            <button
              type="button"
              :aria-label="`Remove decision: ${d.what}`"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              @click="removeDecision(d.id)"
            >×</button>
          </div>
        </div>

        <!-- Copy Log button -->
        <button
          v-if="decisions.length > 0"
          type="button"
          aria-label="Copy decision log to clipboard"
          class="h-11 px-4 text-sm rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
          @click="copyLog()"
        >
          Copy Decision Log
        </button>
      </div>

      <!-- Feature #109 — Impact Map panel -->
      <div
        v-if="impactMapOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Impact map panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-purple-700">🗺️ Impact Map</p>
          <CloseDot
        aria-label="Close impact map panel"
        @click="impactMapOpen = false"
      />
        </div>
        <SpecImpactMap v-if="spec" :blocks="[spec]" />
        <p v-else class="text-xs text-slate-400 italic">Add a spec first to see the impact map.</p>
      </div>

      <!-- Feature #110 — Feature Flags panel -->
      <div
        v-if="flagsOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Feature flags panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-yellow-700">🚩 Feature Flags</p>
          <CloseDot
        aria-label="Close feature flags panel"
        @click="flagsOpen = false"
      />
        </div>
        <p v-if="flags.length === 0" class="text-xs text-slate-400 italic">Add a spec first to see feature flags.</p>
        <template v-else>
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="border-b border-gray-200">
                  <th class="px-2 py-1.5 font-semibold text-gray-600">Flag ID</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">Label</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">On/Off</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="f in flags"
                  :key="f.id"
                  class="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td class="px-2 py-1.5 font-mono text-slate-700">{{ f.id }}</td>
                  <td class="px-2 py-1.5 text-slate-700">{{ f.label }}</td>
                  <td class="px-2 py-1.5">
                    <button
                      type="button"
                      :aria-label="`Toggle ${f.label} flag`"
                      :class="f.enabled ? 'bg-green-500' : 'bg-gray-300'"
                      class="w-11 h-6 rounded-full transition-colors relative"
                      @click="toggleFlag(f.id)"
                    >
                      <span
                        :class="f.enabled ? 'translate-x-5' : 'translate-x-1'"
                        class="absolute top-0.5 left-0 inline-block w-5 h-5 rounded-full bg-white shadow transform transition-transform"
                      />
                    </button>
                  </td>
                  <td class="px-2 py-1.5 text-slate-500">{{ f.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button
            type="button"
            aria-label="Copy feature flags as JSON"
            class="mt-3 h-11 px-4 text-sm rounded bg-yellow-100 hover:bg-yellow-200 text-yellow-800 transition-colors"
            @click="copyFlagsJson()"
          >{{ flagsCopied ? '✅ Copied!' : '📋 Copy JSON' }}</button>
        </template>
      </div>

      <!-- Feature #111 — INVEST Checker panel -->
      <div
        v-if="investOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="INVEST checker panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-teal-700">✅ INVEST Checker</p>
          <CloseDot
        aria-label="Close INVEST checker panel"
        @click="investOpen = false"
      />
        </div>
        <div class="flex gap-2 mb-3">
          <button
            type="button"
            aria-label="Run INVEST check"
            :disabled="investChecking"
            class="h-11 px-4 text-sm rounded bg-teal-600 hover:bg-teal-700 text-white transition-colors disabled:opacity-50"
            @click="investCheck()"
          >{{ investChecking ? 'Checking…' : 'Check INVEST' }}</button>
          <button
            v-if="investResults.length > 0"
            type="button"
            aria-label="Copy INVEST results as markdown"
            class="h-11 px-4 text-sm rounded bg-teal-100 hover:bg-teal-200 text-teal-800 transition-colors"
            @click="investCopyMarkdown()"
          >📋 Copy</button>
        </div>
        <p v-if="investResults.length === 0 && !investChecking" class="text-xs text-slate-400 italic">Click "Check INVEST" to evaluate your spec entries.</p>
        <div v-else class="space-y-2">
          <div
            v-for="(result, i) in investResults"
            :key="i"
            class="rounded-lg border border-teal-100 bg-teal-50 px-3 py-2"
          >
            <p class="text-xs font-semibold text-teal-800 mb-1.5">
              {{ result.block.values[0]?.id || result.block.functions[0]?.id || 'Block ' + (i + 1) }}
              <span class="ml-2 text-teal-600 font-normal">{{ result.total }}/6</span>
            </p>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="(criterion, ci) in ['Independent','Negotiable','Valuable','Estimable','Small','Testable']"
                :key="ci"
                :class="result.scores[criterion] ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'"
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
              >{{ criterion }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature #112 — ROI Calculator panel -->
      <div
        v-if="roiOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="ROI calculator panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-orange-700">💰 ROI Calculator</p>
          <CloseDot
        aria-label="Close ROI calculator panel"
        @click="roiOpen = false"
      />
        </div>
        <p v-if="roiEntries.length === 0" class="text-xs text-slate-400 italic">Add a spec first to see ROI calculations.</p>
        <template v-else>
          <!-- Editable entry table -->
          <div class="overflow-x-auto mb-4">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="border-b border-gray-200">
                  <th class="px-2 py-1.5 font-semibold text-gray-600">V. Entry</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">EV ($)</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">Cost ($)</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">ROI</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">Breakeven</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in roiEntries"
                  :key="entry.id"
                  class="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td class="px-2 py-1.5 text-slate-700">{{ entry.name }}</td>
                  <td class="px-2 py-1.5 text-slate-600">${{ entry.expectedValue.toLocaleString() }}</td>
                  <td class="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      :value="entry.cost"
                      :aria-label="`Cost for ${entry.name}`"
                      class="w-24 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      @change="roiUpdateCost(entry.id, Number(($event.target as HTMLInputElement).value))"
                    />
                  </td>
                  <td class="px-2 py-1.5 font-mono text-slate-700">{{ entry.roi === Infinity ? '∞' : entry.roi.toFixed(2) }}</td>
                  <td class="px-2 py-1.5 text-slate-600">{{ entry.breakeven }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Ranked ROI table (sorted descending, Infinity last) -->
          <div class="mb-3">
            <p class="text-xs font-semibold text-gray-600 mb-1.5">Ranked by ROI</p>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left border-collapse">
                <thead>
                  <tr class="border-b border-gray-200">
                    <th class="px-2 py-1.5 font-semibold text-gray-500">#</th>
                    <th class="px-2 py-1.5 font-semibold text-gray-500">V. Entry</th>
                    <th class="px-2 py-1.5 font-semibold text-gray-500">ROI</th>
                    <th class="px-2 py-1.5 font-semibold text-gray-500">Breakeven</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(entry, i) in sortedByRoi"
                    :key="entry.id"
                    class="border-b border-gray-100"
                    :class="i === 0 ? 'bg-orange-50' : ''"
                  >
                    <td class="px-2 py-1.5 text-slate-400">{{ i + 1 }}</td>
                    <td class="px-2 py-1.5 text-slate-700">{{ entry.name }}</td>
                    <td class="px-2 py-1.5 font-mono font-semibold text-orange-700">{{ entry.roi === Infinity ? '∞' : entry.roi.toFixed(2) }}</td>
                    <td class="px-2 py-1.5 text-slate-600">{{ entry.breakeven }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            aria-label="Copy ROI table as markdown"
            class="h-11 px-4 text-sm rounded bg-orange-100 hover:bg-orange-200 text-orange-800 transition-colors"
            @click="copyRoiMarkdown()"
          >{{ roiCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
        </template>
      </div>

      <!-- Feature #114 — Velocity Tracker panel -->
      <div
        v-if="velocityOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Velocity tracker panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-cyan-700">⚡ Velocity Tracker</p>
          <CloseDot
        aria-label="Close velocity tracker panel"
        @click="velocityOpen = false"
      />
        </div>
        <!-- Overall score badge -->
        <div class="flex items-center gap-3 mb-4">
          <span class="inline-flex items-center rounded-full bg-cyan-100 px-3 py-1 text-sm font-semibold text-cyan-800">
            Score: {{ velocityScore }}%
          </span>
          <span
            class="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold"
            :class="velocityOverallTrend === '↑' ? 'bg-emerald-100 text-emerald-800' : velocityOverallTrend === '↓' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'"
          >Overall {{ velocityOverallTrend }}</span>
        </div>
        <!-- Per-entry rows -->
        <div v-if="velocityEntries.length === 0" class="text-xs text-slate-400 italic">No V. entries found.</div>
        <div v-else class="space-y-2">
          <div
            v-for="e in velocityEntries"
            :key="e.id"
            class="flex items-center gap-3 rounded border border-cyan-100 bg-cyan-50 px-3 py-2"
          >
            <span class="flex-1 text-xs text-slate-700 font-medium">{{ e.name }}</span>
            <svg width="40" height="20" viewBox="0 0 40 20" class="shrink-0" aria-hidden="true">
              <polyline
                v-if="e.sparklinePoints"
                :points="e.sparklinePoints"
                fill="none"
                stroke="#059669"
                stroke-width="1.5"
              />
            </svg>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="e.trend === '↑' ? 'bg-emerald-100 text-emerald-800' : e.trend === '↓' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'"
            >{{ e.trend }}</span>
            <span class="text-xs text-slate-400">{{ e.history.length }} snap</span>
          </div>
        </div>
        <!-- Actions -->
        <div class="flex gap-2 mt-4">
          <button
            type="button"
            aria-label="Copy velocity table as markdown"
            class="h-11 px-3 text-sm rounded bg-cyan-100 hover:bg-cyan-200 text-cyan-800 transition-colors"
            @click="velocityCopyMarkdown()"
          >{{ velocityCopied ? '✅ Copied!' : '📋 Copy' }}</button>
          <button
            type="button"
            aria-label="Clear velocity history"
            class="h-11 px-3 text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            @click="velocityClearHistory()"
          >🗑️ Clear History</button>
        </div>
      </div>

      <!-- Feature #115 — TOGAF View panel -->
      <div
        v-if="togafOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="TOGAF architecture view panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-slate-700">🏗️ TOGAF Architecture View</p>
          <CloseDot
        aria-label="Close TOGAF panel"
        @click="togafOpen = false"
      />
        </div>
        <SpecTogafView v-if="spec" :blocks="[spec]" />
        <p v-else class="text-xs text-slate-400 italic">Add a spec first to see the TOGAF view.</p>
      </div>

      <!-- Feature #117 — Cost of Quality panel -->
      <div
        v-if="coqOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Cost of quality panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-red-700">💸 Cost of Quality</p>
          <CloseDot
        aria-label="Close cost of quality panel"
        @click="coqOpen = false"
      />
        </div>
        <p v-if="coqEntries.length === 0" class="text-xs text-slate-400 italic">Add a spec with V. entries to see CoQ calculations.</p>
        <template v-else>
          <div class="overflow-x-auto mb-4">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="border-b border-gray-200">
                  <th class="px-2 py-1.5 font-semibold text-gray-600">V. Entry</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">Prevention $</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">Appraisal $</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">Failure $ (auto)</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">Total $</th>
                  <th class="px-2 py-1.5 font-semibold text-gray-600">Decision</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="entry in coqEntries"
                  :key="entry.id"
                  class="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td class="px-2 py-1.5 text-slate-700">{{ entry.name }}</td>
                  <td class="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      :value="entry.prevention"
                      :aria-label="`Prevention cost for ${entry.name}`"
                      class="w-24 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-400"
                      @change="coqUpdateCost(entry.id, 'prevention', Number(($event.target as HTMLInputElement).value))"
                    />
                  </td>
                  <td class="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      :value="entry.appraisal"
                      :aria-label="`Appraisal cost for ${entry.name}`"
                      class="w-24 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-400"
                      @change="coqUpdateCost(entry.id, 'appraisal', Number(($event.target as HTMLInputElement).value))"
                    />
                  </td>
                  <td class="px-2 py-1.5 font-mono text-slate-500 bg-slate-50">{{ entry.failureCost }}</td>
                  <td class="px-2 py-1.5 font-mono font-semibold text-red-700">{{ entry.total }}</td>
                  <td class="px-2 py-1.5">
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                      :class="entry.decision === 'invest-more' ? 'bg-red-100 text-red-700' : entry.decision === 'good-enough' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'"
                    >{{ entry.decision }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Footer -->
          <div class="flex items-center justify-between">
            <div class="rounded-lg bg-red-50 border border-red-200 px-4 py-2">
              <span class="text-xs font-semibold text-red-700">Total CoQ: ${{ totalCoQ.toLocaleString() }}</span>
              <span class="ml-3 text-xs text-slate-500">Dominant: {{ coqDominantDecision }}</span>
            </div>
            <button
              type="button"
              aria-label="Copy cost of quality table as markdown"
              class="h-11 px-3 text-sm rounded bg-red-100 hover:bg-red-200 text-red-800 transition-colors"
              @click="coqCopyMarkdown()"
            >{{ coqCopied ? '✅ Copied!' : '📋 Copy' }}</button>
          </div>
        </template>
      </div>

      <!-- Feature #118 — Sentiment Analyser panel -->
      <div
        v-if="sentimentOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Sentiment analyser panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-pink-700">💬 Sentiment Analyser</p>
          <CloseDot
        aria-label="Close sentiment analyser panel"
        @click="sentimentOpen = false"
      />
        </div>
        <!-- Distribution bar -->
        <div class="mb-4">
          <p class="text-xs font-semibold text-gray-600 mb-2">Distribution</p>
          <div class="flex gap-1 h-6 rounded overflow-hidden">
            <div
              v-if="sentimentDistribution.positive > 0"
              :style="{ flex: sentimentDistribution.positive }"
              class="bg-emerald-500"
              :title="`Positive: ${sentimentDistribution.positive}`"
            />
            <div
              v-if="sentimentDistribution.neutral > 0"
              :style="{ flex: sentimentDistribution.neutral }"
              class="bg-slate-400"
              :title="`Neutral: ${sentimentDistribution.neutral}`"
            />
            <div
              v-if="sentimentDistribution.negative > 0"
              :style="{ flex: sentimentDistribution.negative }"
              class="bg-red-500"
              :title="`Negative: ${sentimentDistribution.negative}`"
            />
            <div
              v-if="sentimentDistribution.urgent > 0"
              :style="{ flex: sentimentDistribution.urgent }"
              class="bg-orange-400"
              :title="`Urgent: ${sentimentDistribution.urgent}`"
            />
          </div>
          <div class="flex gap-4 mt-1.5">
            <span class="text-xs text-emerald-700">Positive {{ sentimentDistribution.positive }}</span>
            <span class="text-xs text-slate-500">Neutral {{ sentimentDistribution.neutral }}</span>
            <span class="text-xs text-red-600">Negative {{ sentimentDistribution.negative }}</span>
            <span class="text-xs text-orange-600">Urgent {{ sentimentDistribution.urgent }}</span>
          </div>
        </div>
        <!-- Dominant tone badge -->
        <div class="mb-4">
          <span
            class="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold"
            :class="sentimentDominantLabel === 'positive' ? 'bg-emerald-100 text-emerald-800' : sentimentDominantLabel === 'negative' ? 'bg-red-100 text-red-800' : sentimentDominantLabel === 'urgent' ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-700'"
          >Dominant: {{ sentimentDominantLabel }}</span>
        </div>
        <!-- Entry list -->
        <div v-if="sentimentResults.length === 0" class="text-xs text-slate-400 italic">No entries to analyse.</div>
        <ScrollContainer v-else outer-class="mb-4 relative" inner-class="space-y-1" inner-style="max-height: 14rem" :no-pill="true">
          <div
            v-for="r in sentimentResults"
            :key="r.entryId"
            class="flex flex-wrap items-center gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-1.5"
          >
            <span class="text-xs font-medium text-slate-700">{{ r.entryId }}</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
              :class="r.label === 'positive' ? 'bg-emerald-100 text-emerald-700' : r.label === 'negative' ? 'bg-red-100 text-red-700' : r.label === 'urgent' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'"
            >{{ r.label }}</span>
            <span class="text-xs text-slate-500 font-mono">{{ r.score >= 0 ? '+' : '' }}{{ r.score }}</span>
            <span
              v-for="kw in r.keywords"
              :key="kw"
              class="inline-flex items-center rounded bg-gray-200 px-1.5 py-0.5 text-xs text-slate-600"
            >{{ kw }}</span>
          </div>
        </ScrollContainer>
        <!-- Urgent entries callout -->
        <div
          v-if="sentimentUrgentEntries.length > 0"
          class="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3"
        >
          <p class="text-xs font-semibold text-amber-700 mb-2">⚠️ Urgent Entries ({{ sentimentUrgentEntries.length }})</p>
          <ul class="space-y-1">
            <li
              v-for="r in sentimentUrgentEntries"
              :key="r.entryId"
              class="text-xs text-amber-800"
            >{{ r.entryId }}: {{ r.keywords.join(', ') }}</li>
          </ul>
        </div>
        <!-- Copy button -->
        <button
          type="button"
          aria-label="Copy sentiment analysis as markdown"
          class="h-11 px-3 text-sm rounded bg-pink-100 hover:bg-pink-200 text-pink-800 transition-colors"
          @click="sentimentCopyMarkdown()"
        >{{ sentimentCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #119 — Critical Path panel -->
      <div
        v-if="criticalPathOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Critical path panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-red-700">🔴 Critical Path</p>
          <CloseDot
        aria-label="Close critical path panel"
        @click="criticalPathOpen = false"
      />
        </div>
        <!-- Chain display -->
        <div v-if="criticalPath.stepChain.length === 0" class="text-xs text-slate-400 italic">No dependency chain detected.</div>
        <div v-else class="flex flex-wrap items-center gap-2 mb-3">
          <template v-for="(step, idx) in criticalPath.stepChain" :key="step">
            <span
              class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium"
              :class="criticalHighlightedIds.has(step) ? 'bg-red-100 border-red-600 text-red-800' : 'bg-slate-100 border-slate-300 text-slate-700'"
            >{{ step }}</span>
            <span v-if="idx < criticalPath.stepChain.length - 1" class="text-slate-400 text-sm" aria-hidden="true">→</span>
          </template>
        </div>
        <!-- Total step count badge -->
        <div v-if="criticalPath.totalSteps > 0" class="mb-2">
          <span class="inline-flex items-center rounded-full bg-red-100 text-red-700 text-xs font-bold px-2.5 py-0.5">
            {{ criticalPath.totalSteps }} steps
          </span>
        </div>
        <!-- Explanation -->
        <p v-if="criticalPath.explanation" class="text-xs text-slate-600 mb-3">{{ criticalPath.explanation }}</p>
        <!-- Copy button -->
        <button
          type="button"
          aria-label="Copy critical path as markdown"
          class="h-11 px-3 text-sm rounded bg-red-100 hover:bg-red-200 text-red-800 transition-colors"
          @click="criticalPathCopyMarkdown()"
        >{{ criticalPathCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #120 — Press Release panel -->
      <div
        v-if="pressReleaseOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Press release panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-indigo-700">📰 Press Release</p>
          <CloseDot
        aria-label="Close press release panel"
        @click="pressReleaseOpen = false"
      />
        </div>
        <!-- Generating state -->
        <div v-if="pressReleaseGenerating" class="flex items-center gap-2 text-sm text-slate-500">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" aria-hidden="true" />
          Generating press release…
        </div>
        <!-- Release content -->
        <template v-else-if="pressRelease">
          <!-- Dateline -->
          <p class="text-xs text-gray-500 tracking-widest uppercase mb-2">{{ pressRelease.dateline }}</p>
          <!-- Headline -->
          <h3 class="text-xl font-bold text-gray-900 mb-3">{{ pressRelease.headline }}</h3>
          <!-- Body -->
          <p class="text-sm text-gray-700 leading-relaxed mb-4">{{ pressRelease.body }}</p>
          <!-- Quote -->
          <blockquote class="border-l-4 border-indigo-300 pl-4 italic text-sm text-gray-600 mb-4">{{ pressRelease.quote }}</blockquote>
          <!-- Action buttons -->
          <div class="flex gap-2">
            <button
              type="button"
              aria-label="Regenerate press release"
              class="h-11 px-3 text-sm rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 transition-colors"
              @click="generatePressRelease()"
            >🔄 Regenerate</button>
            <button
              type="button"
              aria-label="Copy press release as markdown"
              class="h-11 px-3 text-sm rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 transition-colors"
              @click="pressReleaseCopyMarkdown()"
            >{{ pressReleaseCopied ? '✅ Copied!' : '📋 Copy' }}</button>
          </div>
        </template>
        <div v-else class="text-xs text-slate-400 italic">No press release generated yet.</div>
      </div>

      <!-- Feature #122 — Constraints panel -->
      <div
        v-if="constraintsOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Constraints panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-gray-700">🔒 Constraint Mapper</p>
          <CloseDot
        aria-label="Close constraints panel"
        @click="constraintsOpen = false"
      />
        </div>
        <!-- Summary bar -->
        <div class="flex items-center gap-3 mb-4">
          <span class="text-xs text-slate-600">{{ constraintTotal }} total constraints</span>
          <span v-if="constraintHighCount > 0" class="text-xs font-semibold text-red-600">{{ constraintHighCount }} high-severity</span>
        </div>
        <!-- No constraints message -->
        <div v-if="constraintEntries.length === 0" class="text-xs text-slate-400 italic">No constraints detected. Add Tolerable fields to V. entries.</div>
        <!-- Category sections -->
        <div v-else class="space-y-3">
          <div
            v-for="cat in ['time', 'cost', 'quality', 'scope'] as const"
            :key="cat"
          >
            <button
              type="button"
              :aria-label="`Toggle ${cat} constraints`"
              class="flex items-center gap-2 w-full text-left text-xs font-semibold text-gray-700 hover:text-gray-900 mb-1"
              @click="toggleConstraintCategory(cat)"
            >
              <span>{{ expandedConstraintCategories.has(cat) ? '▼' : '▶' }}</span>
              <span class="capitalize">{{ cat }}</span>
              <span class="ml-auto text-gray-400">({{ constraintsGrouped[cat].length }})</span>
            </button>
            <div v-if="expandedConstraintCategories.has(cat) && constraintsGrouped[cat].length > 0" class="space-y-1 ml-4">
              <div
                v-for="entry in constraintsGrouped[cat]"
                :key="entry.blockId"
                class="flex flex-wrap items-start gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <span class="text-xs font-medium text-slate-700">{{ entry.blockName }}</span>
                <span class="text-xs text-slate-500">{{ entry.rawTolerable }}</span>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="entry.severity === 'high' ? 'bg-red-100 text-red-700' : entry.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'"
                >{{ entry.severity }}</span>
                <span class="text-xs text-slate-500 italic">{{ entry.interpretation }}</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Copy button -->
        <button
          type="button"
          aria-label="Copy constraints as markdown table"
          class="mt-4 h-11 px-3 text-sm rounded bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
          @click="constraintsCopyMarkdown()"
        >{{ constraintsCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #123 — Value Stream panel -->
      <div
        v-if="valueStreamOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Value stream map panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-teal-700">🌊 Value Stream Map</p>
          <CloseDot
        aria-label="Close value stream map panel"
        @click="valueStreamOpen = false"
      />
        </div>
        <SpecValueStream :blocks="valueStreamBlocks" />
      </div>

      <!-- Feature #124 — Hypothesis Cards panel -->
      <div
        v-if="hypothesisOpen"
        class="mt-4 border border-lime-200 rounded-lg p-4 bg-lime-50"
        aria-label="Hypothesis cards panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-lime-800">🧪 Lean Hypothesis Cards</p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              aria-label="Generate hypothesis cards"
              class="h-11 px-3 text-xs font-medium rounded-lg bg-lime-200 text-lime-800 hover:bg-lime-300 transition-colors"
              :disabled="hypGenerating"
              @click="generateHyp()"
            >
              <span v-if="hypGenerating" class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 animate-spin rounded-full border border-lime-500 border-t-lime-800" aria-hidden="true"/>
                Generating…
              </span>
              <span v-else>Generate</span>
            </button>
            <button
              v-if="hypCards.length > 0"
              type="button"
              aria-label="Copy hypothesis cards as markdown"
              class="h-11 px-3 text-xs font-medium rounded-lg bg-lime-200 text-lime-800 hover:bg-lime-300 transition-colors"
              @click="copyHyp()"
            >{{ hypCopied ? '✅ Copied!' : '📋 Copy' }}</button>
            <CloseDot
        aria-label="Close hypothesis cards panel"
        @click="hypothesisOpen = false"
      />
          </div>
        </div>
        <div v-if="hypCards.length === 0 && !hypGenerating" class="text-xs text-lime-600 italic">No V. entries found. Add values to your spec to generate hypothesis cards.</div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="card in hypCards"
            :key="card.blockId"
            class="rounded border border-lime-200 bg-white p-3 space-y-2"
          >
            <p class="text-xs font-semibold text-lime-800">{{ card.blockName }}</p>
            <div>
              <span class="text-xs font-medium text-slate-600">We Believe: </span>
              <span class="text-xs text-slate-700">{{ card.weBelieve }}</span>
            </div>
            <div>
              <span class="text-xs font-medium text-slate-600">We Will: </span>
              <span class="text-xs text-slate-700">{{ card.weWill }}</span>
            </div>
            <div>
              <span class="text-xs font-medium text-slate-600">We'll Know It Worked When: </span>
              <span class="text-xs text-slate-700">{{ card.weKnow }}</span>
            </div>
            <div>
              <span class="text-xs font-medium text-slate-600">Evidence Threshold: </span>
              <span class="text-xs font-semibold text-lime-700">{{ card.evidenceThreshold }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature #126 — Regulatory Scanner panel -->
      <div
        v-if="regScanOpen"
        class="mt-4 border border-indigo-200 rounded-lg p-4 bg-white"
        aria-label="Regulatory compliance scan panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-indigo-800">🏛️ Regulatory Impact Scanner</p>
          <div class="flex items-center gap-2">
            <span v-if="regScanning" class="text-xs text-indigo-500 flex items-center gap-1">
              <span class="inline-block h-3 w-3 animate-spin rounded-full border border-indigo-300 border-t-indigo-600" aria-hidden="true"/>
              Scanning…
            </span>
            <button
              v-if="!regResult.clean"
              type="button"
              aria-label="Copy regulatory scan as markdown table"
              class="h-11 px-3 text-xs font-medium rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors"
              @click="regCopyMarkdown()"
            >{{ regScanCopied ? '✅ Copied!' : '📋 Copy' }}</button>
            <CloseDot
        aria-label="Close regulatory scan panel"
        @click="regScanOpen = false"
      />
          </div>
        </div>
        <div v-if="regResult.clean" class="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
          <span class="text-emerald-600 text-sm">✅</span>
          <span class="text-xs text-emerald-700 font-medium">No regulatory triggers detected.</span>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr class="bg-indigo-50">
                <th class="border border-indigo-200 px-3 py-2 text-left text-indigo-800">Regulation</th>
                <th class="border border-indigo-200 px-3 py-2 text-left text-indigo-800">Keywords</th>
                <th class="border border-indigo-200 px-3 py-2 text-left text-indigo-800">Impact</th>
                <th class="border border-indigo-200 px-3 py-2 text-left text-indigo-800">Implication</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="hit in regResult.hits"
                :key="hit.regulation"
                class="hover:bg-indigo-50"
              >
                <td class="border border-indigo-100 px-3 py-2 font-semibold text-indigo-700">{{ hit.regulation }}</td>
                <td class="border border-indigo-100 px-3 py-2 text-slate-600">{{ hit.triggerKeywords.join(', ') }}</td>
                <td class="border border-indigo-100 px-3 py-2">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="hit.impactLevel === 'high' ? 'bg-red-100 text-red-700' : hit.impactLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'"
                  >{{ hit.impactLevel }}</span>
                </td>
                <td class="border border-indigo-100 px-3 py-2 text-slate-600">{{ hit.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Feature #127 — Job Description panel -->
      <div
        v-if="jdOpen"
        class="mt-4 border border-slate-200 rounded-lg p-4 bg-white"
        aria-label="Job description panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-slate-700">💼 Job Description</p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              aria-label="Generate job description"
              class="h-11 px-3 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              :disabled="jdGenerating"
              @click="generateJd()"
            >
              <span v-if="jdGenerating" class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-slate-700" aria-hidden="true"/>
                Generating…
              </span>
              <span v-else>Generate</span>
            </button>
            <button
              v-if="jobDesc"
              type="button"
              aria-label="Copy job description as markdown"
              class="h-11 px-3 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              @click="copyJd()"
            >{{ jdCopied ? '✅ Copied!' : '📋 Copy' }}</button>
            <CloseDot
        aria-label="Close job description panel"
        @click="jdOpen = false"
      />
          </div>
        </div>
        <div v-if="!jobDesc && !jdGenerating" class="text-xs text-slate-400 italic">Click Generate to create a hire-ready job description from this spec.</div>
        <div v-else-if="jobDesc" class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-800">{{ jobDesc.roleSummary }}</h3>
          <div v-if="jobDesc.responsibilities.length > 0">
            <p class="text-xs font-semibold text-slate-600 mb-1">Responsibilities</p>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="(r, i) in jobDesc.responsibilities" :key="i" class="text-xs text-slate-700">{{ r }}</li>
            </ul>
          </div>
          <div v-if="jobDesc.successMetrics.length > 0">
            <p class="text-xs font-semibold text-slate-600 mb-1">Success Metrics</p>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="(m, i) in jobDesc.successMetrics" :key="i" class="text-xs text-slate-700">{{ m }}</li>
            </ul>
          </div>
          <div v-if="jobDesc.qualifications.length > 0">
            <p class="text-xs font-semibold text-slate-600 mb-1">Required Skills</p>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="(s, i) in jobDesc.qualifications"
                :key="i"
                class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
              >{{ s }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature #124 — Hypothesis Cards panel -->
      <div
        v-if="hypothesisOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Hypothesis cards panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-lime-700">🧪 Hypothesis Cards</p>
          <CloseDot
        aria-label="Close hypothesis cards panel"
        @click="hypothesisOpen = false"
      />
        </div>
        <template v-if="hypothesisCards.length === 0">
          <p class="text-sm text-slate-400">No V. entries found</p>
        </template>
        <template v-else>
          <!-- Card grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div
              v-for="card in hypothesisCards"
              :key="card.blockId"
              class="rounded border p-3 cursor-pointer transition-all"
              :class="hypothesisSelectedCard?.blockId === card.blockId ? 'ring-2 ring-lime-500 border-lime-300' : 'border-slate-200 hover:border-lime-300'"
              @click="hypothesisSelectCard(card)"
            >
              <p class="text-sm font-semibold text-slate-700">{{ card.blockName }}</p>
              <p class="text-xs text-slate-500 mt-1 line-clamp-2">{{ card.weBelieve }}</p>
            </div>
          </div>
          <!-- Selected card detail -->
          <div v-if="hypothesisSelectedCard" class="rounded-lg border border-lime-200 bg-lime-50 p-4 space-y-2 mb-3">
            <p class="text-sm"><span class="font-semibold">We believe:</span> {{ hypothesisSelectedCard.weBelieve }}</p>
            <p class="text-sm"><span class="font-semibold">We will:</span> {{ hypothesisSelectedCard.weWill }}</p>
            <p class="text-sm"><span class="font-semibold">We'll know it worked when:</span> {{ hypothesisSelectedCard.weKnow }}</p>
            <p class="text-sm"><span class="font-semibold">Evidence threshold:</span> {{ hypothesisSelectedCard.evidenceThreshold }}</p>
          </div>
          <!-- Copy buttons -->
          <div class="flex gap-2">
            <button
              v-if="hypothesisSelectedCard"
              type="button"
              aria-label="Copy selected hypothesis card"
              class="h-11 px-3 text-sm rounded bg-lime-100 hover:bg-lime-200 text-lime-800 transition-colors"
              @click="hypothesisCopyCard(hypothesisSelectedCard)"
            >{{ hypothesisCopied ? '✅ Copied!' : '📋 Copy Card' }}</button>
            <button
              type="button"
              aria-label="Copy all hypothesis cards"
              class="h-11 px-3 text-sm rounded bg-lime-100 hover:bg-lime-200 text-lime-800 transition-colors"
              @click="hypothesisCopyAll()"
            >{{ hypothesisCopied ? '✅ Copied!' : '📋 Copy All' }}</button>
          </div>
        </template>
      </div>

      <!-- Feature #126 — Regulatory Impact panel -->
      <div
        v-if="regulatoryOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Regulatory impact panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-amber-700">⚖️ Regulatory Impact</p>
          <CloseDot
        aria-label="Close regulatory impact panel"
        @click="regulatoryOpen = false"
      />
        </div>
        <!-- High-impact banner -->
        <div
          v-if="regulatoryHighCount > 0"
          class="mb-3 rounded bg-red-100 border border-red-300 px-3 py-2 text-sm font-semibold text-red-700"
          role="alert"
        >
          ⚠️ {{ regulatoryHighCount }} high-impact regulatory finding{{ regulatoryHighCount !== 1 ? 's' : '' }} detected
        </div>
        <!-- Regulation filter pills + summary chips -->
        <div class="flex flex-wrap gap-2 mb-3">
          <button
            v-for="reg in (['All', 'GDPR', 'HIPAA', 'SOX', 'PCI-DSS'] as const)"
            :key="reg"
            type="button"
            :aria-label="`Filter by ${reg}`"
            class="h-8 px-3 text-xs rounded-full transition-colors"
            :class="regulatoryFilter === reg
              ? 'bg-amber-700 text-white'
              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'"
            @click="regulatorySetFilter(reg)"
          >
            {{ reg }}
            <span v-if="reg !== 'All' && regulatorySummary[reg] > 0" class="ml-1 font-bold">
              {{ regulatorySummary[reg] }}
            </span>
          </button>
        </div>
        <!-- Impact list -->
        <template v-if="regulatoryFilteredImpacts.length === 0">
          <p class="text-sm text-slate-400">No regulatory impacts found for current filter.</p>
        </template>
        <div v-else class="space-y-2">
          <div
            v-for="(impact, idx) in regulatoryFilteredImpacts"
            :key="`${impact.regulation}-${impact.blockId}-${idx}`"
            class="flex flex-wrap items-start gap-2 text-xs border-b border-slate-100 pb-2"
          >
            <span class="font-medium text-slate-700">{{ impact.blockName }}</span>
            <span class="rounded-full px-2 py-0.5 bg-amber-100 text-amber-800 font-semibold">{{ impact.regulation }}</span>
            <span
              class="rounded-full px-2 py-0.5 font-semibold"
              :class="{
                'bg-red-100 text-red-800': impact.impactLevel === 'high',
                'bg-yellow-100 text-yellow-800': impact.impactLevel === 'medium',
                'bg-green-100 text-green-800': impact.impactLevel === 'low',
              }"
            >{{ impact.impactLevel }}</span>
            <span class="text-slate-500">Keywords: {{ impact.triggeredBy.join(', ') }}</span>
            <span class="text-slate-600 w-full mt-0.5">{{ impact.note }}</span>
          </div>
        </div>
        <!-- Copy button -->
        <button
          type="button"
          aria-label="Copy regulatory impact brief"
          class="mt-4 h-11 px-3 text-sm rounded bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors"
          @click="regulatoryCopyBrief()"
        >{{ regulatoryCopied ? '✅ Copied!' : '📋 Copy Brief' }}</button>
      </div>

      <!-- Feature #127 — Job Description panel -->
      <div
        v-if="jdOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Job description panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-violet-700">💼 Job Description</p>
          <CloseDot
        aria-label="Close job description panel"
        @click="jdOpen = false"
      />
        </div>
        <div v-if="jdGenerating" class="flex items-center gap-2 text-sm text-slate-500">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" aria-hidden="true" />
          Generating job description…
        </div>
        <template v-else-if="jdValue">
          <!-- Role Summary -->
          <div class="mb-4">
            <p class="text-xs font-semibold text-violet-700 uppercase tracking-widest mb-1">Role Summary</p>
            <p class="text-sm text-slate-700">{{ jdValue.roleSummary }}</p>
          </div>
          <!-- Responsibilities -->
          <div class="mb-4">
            <p class="text-xs font-semibold text-violet-700 uppercase tracking-widest mb-1">Responsibilities</p>
            <ul class="space-y-1">
              <li v-for="(r, i) in jdValue.responsibilities" :key="i" class="text-sm text-slate-700">{{ r }}</li>
            </ul>
          </div>
          <!-- Success Metrics -->
          <div class="mb-4">
            <p class="text-xs font-semibold text-violet-700 uppercase tracking-widest mb-1">Success Metrics</p>
            <ul class="space-y-1">
              <li v-for="(m, i) in jdValue.successMetrics" :key="i" class="text-sm text-slate-700">
                <span class="text-emerald-600 font-bold mr-1">✓</span>{{ m }}
              </li>
            </ul>
          </div>
          <!-- Qualifications -->
          <div class="mb-4">
            <p class="text-xs font-semibold text-violet-700 uppercase tracking-widest mb-1">Qualifications</p>
            <ul class="space-y-1">
              <li v-for="(q, i) in jdValue.qualifications" :key="i" class="text-sm text-slate-700">{{ q }}</li>
            </ul>
          </div>
          <!-- Copy button -->
          <div class="flex gap-2">
            <button
              type="button"
              aria-label="Copy job description as markdown"
              class="h-11 px-3 text-sm rounded bg-violet-100 hover:bg-violet-200 text-violet-800 transition-colors"
              @click="jdCopyMarkdown()"
            >{{ jdCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
          </div>
        </template>
        <template v-else>
          <button
            type="button"
            aria-label="Generate job description"
            class="h-11 px-3 text-sm rounded bg-violet-600 hover:bg-violet-700 text-white transition-colors"
            @click="jdGenerate()"
          >Generate JD</button>
        </template>
      </div>

      <!-- Feature #129 — Innovation Score panel -->
      <div
        v-if="innovationOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Innovation score panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-yellow-700">💡 Innovation Score</p>
          <CloseDot
        aria-label="Close innovation score panel"
        @click="innovationOpen = false"
      />
        </div>
        <!-- Score display -->
        <div class="flex items-center gap-3 mb-4">
          <span class="text-3xl font-bold text-slate-800">{{ innovationScore.score }}/100</span>
          <span
            class="rounded-full px-3 py-1 text-sm font-bold"
            :class="{
              'bg-emerald-100 text-emerald-800': innovationScore.grade === 'A',
              'bg-lime-100 text-lime-800': innovationScore.grade === 'B',
              'bg-amber-100 text-amber-800': innovationScore.grade === 'C',
              'bg-orange-100 text-orange-800': innovationScore.grade === 'D',
              'bg-red-100 text-red-800': innovationScore.grade === 'F',
            }"
          >Grade {{ innovationScore.grade }}</span>
        </div>
        <!-- Breakdown table -->
        <div class="mb-4">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Breakdown</p>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-400">
                <th class="pb-1 pr-4">Category</th>
                <th class="pb-1 pr-4">Matched</th>
                <th class="pb-1">Weight</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in innovationScore.breakdown" :key="row.category" class="border-t border-slate-100">
                <td class="py-1 pr-4 text-slate-700">{{ row.category }}</td>
                <td class="py-1 pr-4 text-slate-700">{{ row.matched }}</td>
                <td class="py-1 text-slate-700">{{ row.weight }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Top terms -->
        <div v-if="innovationScore.topTerms.length > 0" class="mb-4">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Top Terms</p>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="term in innovationScore.topTerms"
              :key="term"
              class="rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs"
            >{{ term }}</span>
          </div>
        </div>
        <!-- Copy button -->
        <button
          type="button"
          aria-label="Copy innovation score as markdown"
          class="h-11 px-3 text-sm rounded bg-yellow-100 hover:bg-yellow-200 text-yellow-800 transition-colors"
          @click="innovationCopyMarkdown()"
        >{{ innovationCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #131 — Competitor Matrix panel -->
      <div
        v-if="competitorOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Competitor matrix panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-rose-700">🥊 Competitor Matrix</p>
          <CloseDot
        aria-label="Close competitor matrix panel"
        @click="competitorOpen = false"
      />
        </div>
        <!-- Competitor table -->
        <div class="overflow-x-auto mb-4">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="text-left text-xs text-slate-400 bg-slate-50">
                <th class="py-2 px-3 sticky left-0 bg-slate-50 min-w-[140px]">Feature</th>
                <th class="py-2 px-3 text-center">Us</th>
                <th
                  v-for="comp in competitorMatrix.competitors"
                  :key="comp.name"
                  class="py-2 px-3 text-center"
                >{{ comp.name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(fid, idx) in competitorMatrix.featureIds"
                :key="fid"
                :class="competitorMatrix.ourDifferentiators.includes(fid) ? 'bg-emerald-50' : ''"
                class="border-t border-slate-100"
              >
                <td class="py-2 px-3 sticky left-0 text-slate-700 font-medium" :class="competitorMatrix.ourDifferentiators.includes(fid) ? 'bg-emerald-50' : 'bg-white'">
                  {{ competitorMatrix.featureNames[idx] }}
                  <span v-if="competitorMatrix.ourDifferentiators.includes(fid)" class="ml-1 text-xs rounded-full bg-emerald-200 text-emerald-800 px-1.5 py-0.5">⭐ Differentiator</span>
                </td>
                <td class="py-2 px-3 text-center bg-green-50">✅</td>
                <td
                  v-for="comp in competitorMatrix.competitors"
                  :key="comp.name"
                  class="py-2 px-3 text-center"
                  :class="comp.features[fid] ? 'bg-green-50' : 'bg-red-50'"
                >{{ comp.features[fid] ? '✅' : '❌' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Copy button -->
        <button
          type="button"
          aria-label="Copy competitor matrix as markdown"
          class="h-11 px-3 text-sm rounded bg-rose-100 hover:bg-rose-200 text-rose-800 transition-colors"
          @click="competitorCopyMarkdown()"
        >{{ competitorCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #144 — Feature Flag Rollout panel -->
      <div
        v-if="rolloutOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Feature flag rollout planner panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-orange-700">🚩 Feature Flag Rollout Planner</p>
          <CloseDot
        aria-label="Close rollout panel"
        @click="rolloutOpen = false"
      />
        </div>
        <div v-if="rolloutEntries.length === 0" class="text-xs text-slate-400">No F. entries found.</div>
        <div v-else class="space-y-4">
          <div v-for="entry in rolloutEntries" :key="entry.fEntryId" class="border rounded-lg p-3">
            <p class="text-xs font-semibold text-slate-700 mb-2">{{ entry.fEntryId }}</p>
            <div class="flex gap-2 mb-2">
              <div
                v-for="(phase, idx) in entry.phases"
                :key="phase.label"
                class="flex-1 rounded p-2 text-xs text-center"
                :class="{
                  'bg-green-100 text-green-800': phase.status === 'done',
                  'bg-blue-100 text-blue-800': phase.status === 'active',
                  'bg-slate-100 text-slate-400': phase.status === 'pending',
                }"
              >
                <div class="font-semibold">{{ phase.label }} ({{ phase.percent }}%)</div>
                <div class="mt-0.5 text-[10px] leading-tight">{{ phase.criteria }}</div>
                <div class="mt-1 capitalize">{{ phase.status }}</div>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                :disabled="entry.currentPhaseIdx >= entry.phases.length - 1"
                :aria-label="`Advance ${entry.fEntryId}`"
                class="h-8 px-2 text-xs rounded bg-orange-100 text-orange-800 hover:bg-orange-200 disabled:opacity-40 transition-colors"
                @click="rolloutAdvance(entry.fEntryId)"
              >Advance</button>
              <button
                type="button"
                :aria-label="`Reset ${entry.fEntryId}`"
                class="h-8 px-2 text-xs rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                @click="rolloutReset(entry.fEntryId)"
              >Reset</button>
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Copy rollout plan as markdown"
          class="mt-3 h-11 px-3 text-sm rounded bg-orange-100 hover:bg-orange-200 text-orange-800 transition-colors"
          @click="rolloutCopyMarkdown()"
        >{{ rolloutCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #146 — Chaos Engineering panel -->
      <div
        v-if="chaosOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Chaos engineering scenarios panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-red-700">💥 Chaos Engineering Scenarios</p>
          <CloseDot
        aria-label="Close chaos engineering panel"
        @click="chaosOpen = false"
      />
        </div>
        <div v-if="chaosScenarios.length === 0" class="text-xs text-slate-400">No S. entries found.</div>
        <div v-else class="space-y-4">
          <div v-for="scenario in chaosScenarios" :key="scenario.sEntryId" class="border rounded-lg p-3">
            <p class="text-xs font-semibold text-slate-700 mb-2">{{ scenario.sEntryId }}</p>
            <table class="w-full text-xs border-collapse">
              <thead>
                <tr class="text-left bg-slate-50">
                  <th class="py-1.5 px-2">Title</th>
                  <th class="py-1.5 px-2">Injection</th>
                  <th class="py-1.5 px-2">Impact</th>
                  <th class="py-1.5 px-2">Severity</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(c, i) in scenario.scenarios"
                  :key="i"
                  class="border-t border-slate-100"
                  :class="{
                    'bg-red-50': c.severity === 'high',
                    'bg-yellow-50': c.severity === 'medium',
                    'bg-slate-50': c.severity === 'low',
                  }"
                >
                  <td class="py-1.5 px-2">{{ c.title }}</td>
                  <td class="py-1.5 px-2">{{ c.injection }}</td>
                  <td class="py-1.5 px-2">{{ c.impact }}</td>
                  <td class="py-1.5 px-2 capitalize font-medium">{{ c.severity }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <button
          type="button"
          aria-label="Copy chaos scenarios as markdown"
          class="mt-3 h-11 px-3 text-sm rounded bg-red-100 hover:bg-red-200 text-red-800 transition-colors"
          @click="chaosCopyMarkdown()"
        >{{ chaosCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #147 — SWOT Analysis panel -->
      <div
        v-if="swotOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="SWOT analysis panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-lime-700">⚔️ SWOT Analysis</p>
          <CloseDot
        aria-label="Close SWOT analysis panel"
        @click="swotOpen = false"
      />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-lg border p-3 bg-green-50">
            <p class="text-xs font-bold text-green-700 mb-2">Strengths</p>
            <ul class="space-y-1 text-xs text-slate-700">
              <li v-if="swot.strengths.length === 0" class="text-slate-400">(none)</li>
              <li v-for="item in swot.strengths" :key="item">• {{ item }}</li>
            </ul>
          </div>
          <div class="rounded-lg border p-3 bg-red-50">
            <p class="text-xs font-bold text-red-700 mb-2">Weaknesses</p>
            <ul class="space-y-1 text-xs text-slate-700">
              <li v-if="swot.weaknesses.length === 0" class="text-slate-400">(none)</li>
              <li v-for="item in swot.weaknesses" :key="item">• {{ item }}</li>
            </ul>
          </div>
          <div class="rounded-lg border p-3 bg-blue-50">
            <p class="text-xs font-bold text-blue-700 mb-2">Opportunities</p>
            <ul class="space-y-1 text-xs text-slate-700">
              <li v-if="swot.opportunities.length === 0" class="text-slate-400">(none)</li>
              <li v-for="item in swot.opportunities" :key="item">• {{ item }}</li>
            </ul>
          </div>
          <div class="rounded-lg border p-3 bg-amber-50">
            <p class="text-xs font-bold text-amber-700 mb-2">Threats</p>
            <ul class="space-y-1 text-xs text-slate-700">
              <li v-if="swot.threats.length === 0" class="text-slate-400">(none)</li>
              <li v-for="item in swot.threats" :key="item">• {{ item }}</li>
            </ul>
          </div>
        </div>
        <button
          type="button"
          aria-label="Copy SWOT analysis as markdown"
          class="mt-3 h-11 px-3 text-sm rounded bg-lime-100 hover:bg-lime-200 text-lime-800 transition-colors"
          @click="swotCopyMarkdown()"
        >{{ swotCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #149 — Empathy Map panel -->
      <div
        v-if="empathyOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Customer empathy map panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-violet-700">🧠 Customer Empathy Map</p>
          <CloseDot
        aria-label="Close empathy map panel"
        @click="empathyOpen = false"
      />
        </div>
        <p v-if="empathyCards.length === 0" class="text-xs text-slate-400 italic">No V. entries found. Generate a spec first.</p>
        <div v-else class="grid grid-cols-2 gap-2">
          <div
            v-for="card in empathyCards"
            :key="card.vEntryId"
            class="rounded-lg border p-3 cursor-pointer transition-all"
            :class="empathySelectedId === card.vEntryId ? 'ring-2 ring-blue-400 border-blue-300 bg-blue-50' : 'bg-slate-50 hover:bg-white'"
            @click="empathySelectCard(card.vEntryId)"
          >
            <p class="text-xs font-bold text-slate-700 mb-2 truncate">{{ card.vEntryName }}</p>
            <div class="space-y-1 text-xs text-slate-600">
              <p><span class="font-semibold text-violet-700">Think:</span> {{ card.think }}</p>
              <p><span class="font-semibold text-pink-700">Feel:</span> {{ card.feel }}</p>
              <p><span class="font-semibold text-sky-700">Say:</span> {{ card.say }}</p>
              <p><span class="font-semibold text-emerald-700">Do:</span> {{ card.doText }}</p>
            </div>
          </div>
        </div>
        <button
          v-if="empathyCards.length > 0"
          type="button"
          aria-label="Copy empathy map as markdown"
          class="mt-3 h-11 px-3 text-sm rounded bg-violet-100 hover:bg-violet-200 text-violet-800 transition-colors"
          @click="empathyCopyMarkdown()"
        >{{ empathyCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
      </div>

      <!-- Feature #151 — NPS Predictor panel -->
      <div
        v-if="npsOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="NPS predictor panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-emerald-700">📊 NPS Predictor</p>
          <CloseDot
        aria-label="Close NPS predictor panel"
        @click="npsOpen = false"
      />
        </div>
        <p v-if="npsEntries.length === 0" class="text-xs text-slate-400 italic">No V. entries found. Generate a spec first.</p>
        <template v-else>
          <!-- Summary banner -->
          <div class="rounded-lg p-3 mb-3 flex items-center gap-3"
            :class="aggregateNps >= 50 ? 'bg-emerald-50 border border-emerald-200' : aggregateNps >= 0 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'"
          >
            <span class="text-2xl font-bold"
              :class="aggregateNps >= 50 ? 'text-emerald-700' : aggregateNps >= 0 ? 'text-amber-700' : 'text-red-700'"
            >{{ aggregateNps }}</span>
            <div>
              <p class="text-xs font-semibold"
                :class="aggregateNps >= 50 ? 'text-emerald-700' : aggregateNps >= 0 ? 'text-amber-700' : 'text-red-700'"
              >{{ npsGrade }}</p>
              <p class="text-xs text-slate-500">Aggregate NPS</p>
            </div>
          </div>
          <!-- Per-entry table -->
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-slate-700">
              <thead>
                <tr class="border-b text-left">
                  <th class="py-1 pr-2 font-semibold">V. Entry</th>
                  <th class="py-1 pr-2 font-semibold text-emerald-700">Promoters</th>
                  <th class="py-1 pr-2 font-semibold text-slate-500">Passives</th>
                  <th class="py-1 pr-2 font-semibold text-red-600">Detractors</th>
                  <th class="py-1 font-semibold">NPS</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in npsEntries" :key="entry.vEntryId" class="border-b last:border-0">
                  <td class="py-1.5 pr-2 font-medium truncate max-w-[120px]">{{ entry.vEntryName }}</td>
                  <td class="py-1.5 pr-2 text-emerald-700">{{ entry.promoterPct }}%</td>
                  <td class="py-1.5 pr-2 text-slate-500">{{ entry.passivePct }}%</td>
                  <td class="py-1.5 pr-2 text-red-600">{{ entry.detractorPct }}%</td>
                  <td class="py-1.5">
                    <span
                      class="inline-block rounded-full px-2 py-0.5 text-xs font-bold"
                      :class="entry.nps >= 50 ? 'bg-emerald-100 text-emerald-700' : entry.nps >= 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'"
                    >{{ entry.nps }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <button
            type="button"
            aria-label="Copy NPS table as markdown"
            class="mt-3 h-11 px-3 text-sm rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 transition-colors"
            @click="npsCopyMarkdown()"
          >{{ npsCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
        </template>
      </div>

      <!-- Feature #152 — Changelog Entry panel -->
      <div
        v-if="changelogEntryOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Changelog entry generator panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-slate-700">📝 Changelog Entry</p>
          <CloseDot
        aria-label="Close changelog entry panel"
        @click="changelogEntryOpen = false"
      />
        </div>
        <p v-if="changelogEntries.length === 0" class="text-xs text-slate-400 italic">No F. entries found. Generate a spec first.</p>
        <template v-else>
          <!-- Version bump badge -->
          <div class="mb-3 flex items-center gap-2">
            <span class="text-xs text-slate-500">Suggested bump:</span>
            <span
              class="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold"
              :class="versionBump === 'minor' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'"
            >{{ versionBump }}</span>
          </div>
          <!-- Per-entry rows -->
          <div class="space-y-2 mb-3">
            <div
              v-for="entry in changelogEntries"
              :key="entry.fEntryId"
              class="flex items-start gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs"
            >
              <span
                class="shrink-0 rounded px-1.5 py-0.5 font-bold text-xs"
                :class="{
                  'bg-emerald-100 text-emerald-700': entry.type === 'feat',
                  'bg-amber-100 text-amber-700': entry.type === 'fix',
                  'bg-blue-100 text-blue-700': entry.type === 'perf',
                  'bg-slate-200 text-slate-700': entry.type === 'docs',
                  'bg-violet-100 text-violet-700': entry.type === 'refactor',
                }"
              >{{ entry.type }}</span>
              <span class="text-slate-700 break-all">{{ entry.fullEntry }}</span>
            </div>
          </div>
          <!-- Copy All button -->
          <button
            type="button"
            aria-label="Copy all changelog entries"
            class="h-11 px-3 text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            @click="changelogEntryCopyAll()"
          >{{ changelogEntryAllCopied ? '✅ Copied!' : '📋 Copy All' }}</button>
        </template>
      </div>

      <!-- Feature #154 — Impact-Complexity Scatter panel -->
      <div
        v-if="scatterOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Impact vs complexity scatter plot panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-indigo-700">🎯 Impact-Complexity</p>
          <CloseDot
        aria-label="Close impact-complexity panel"
        @click="scatterOpen = false"
      />
        </div>
        <p v-if="scatterPoints.length === 0" class="text-xs text-slate-400 italic">No entries found. Generate a spec first.</p>
        <template v-else>
          <!-- SVG 480×320, quadrant backgrounds, axes, dots -->
          <svg viewBox="0 0 480 320" width="480" height="320" class="w-full max-w-xl" aria-label="Impact vs complexity scatter chart">
            <!-- Quadrant backgrounds: quick-win=emerald, major-project=blue, fill-in=slate, thankless=red -->
            <rect x="40" y="20" width="200" height="140" fill="#ecfdf5" opacity="0.6" />
            <rect x="240" y="20" width="200" height="140" fill="#eff6ff" opacity="0.6" />
            <rect x="40" y="160" width="200" height="140" fill="#f8fafc" opacity="0.6" />
            <rect x="240" y="160" width="200" height="140" fill="#fef2f2" opacity="0.6" />
            <!-- Quadrant labels at corners (10px, muted) -->
            <text x="44" y="34" font-size="10" fill="#86efac">quick-win</text>
            <text x="244" y="34" font-size="10" fill="#93c5fd">major-project</text>
            <text x="44" y="170" font-size="10" fill="#94a3b8">fill-in</text>
            <text x="244" y="170" font-size="10" fill="#fca5a5">thankless</text>
            <!-- Median crosshairs -->
            <line x1="240" y1="20" x2="240" y2="300" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3" />
            <line x1="40" y1="160" x2="440" y2="160" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3" />
            <!-- Axis labels -->
            <text x="240" y="318" text-anchor="middle" font-size="10" fill="#64748b">Complexity (words)</text>
            <text x="10" y="160" text-anchor="middle" font-size="10" fill="#64748b" transform="rotate(-90 10 160)">Impact</text>
            <!-- Dots -->
            <circle
              v-for="p in scatterPoints"
              :key="p.id"
              :cx="40 + Math.min(400, Math.max(0, (p.complexity / Math.max(...scatterPoints.map(sp => sp.complexity), 1)) * 400))"
              :cy="300 - Math.min(280, Math.max(0, ((p.impact - 1) / 99) * 280))"
              :r="p.selected ? 8 : 5"
              :fill="p.type === 'Function' ? '#6366f1' : p.type === 'Value' ? '#10b981' : '#f59e0b'"
              :stroke="p.selected ? '#1e1b4b' : 'none'"
              :stroke-width="p.selected ? 2 : 0"
              class="cursor-pointer"
              :aria-label="`${p.name}`"
              @click="scatterSelectPoint(p.id)"
            >
              <title>{{ p.name }} ({{ p.type }}) — complexity: {{ p.complexity }}, impact: {{ p.impact }} — {{ scatterQuadrantOf(p) }}</title>
            </circle>
          </svg>
          <!-- Legend -->
          <div class="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
            <span><span class="inline-block w-3 h-3 rounded-full bg-indigo-500 mr-1 align-middle"></span>Function</span>
            <span><span class="inline-block w-3 h-3 rounded-full bg-emerald-500 mr-1 align-middle"></span>Value</span>
            <span><span class="inline-block w-3 h-3 rounded-full bg-amber-400 mr-1 align-middle"></span>Solution</span>
          </div>
          <!-- Selected info -->
          <div v-if="scatterSelectedId && scatterPoints.find(p => p.id === scatterSelectedId)" class="mt-2 text-xs text-slate-600">
            Selected: <strong>{{ scatterPoints.find(p => p.id === scatterSelectedId)!.name }}</strong>
            — type: {{ scatterPoints.find(p => p.id === scatterSelectedId)!.type }}
            — quadrant: <em>{{ scatterQuadrantOf(scatterPoints.find(p => p.id === scatterSelectedId)!) }}</em>
          </div>
          <!-- Copy button -->
          <button
            type="button"
            aria-label="Copy impact-complexity table as markdown"
            class="mt-3 h-11 px-3 text-sm rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 transition-colors"
            @click="scatterCopyMarkdown()"
          >{{ scatterCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
        </template>
      </div>

      <!-- Feature #156 — JTBD Canvas panel -->
      <div
        v-if="jtbdOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Jobs to be done canvas panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-lime-700">💼 Jobs to be Done</p>
          <CloseDot
        aria-label="Close JTBD canvas panel"
        @click="jtbdOpen = false"
      />
        </div>
        <p v-if="jtbdCards.length === 0" class="text-xs text-slate-400 italic">No F. entries found. Generate a spec first.</p>
        <div v-else class="space-y-2">
          <div
            v-for="card in jtbdCards"
            :key="card.fEntryId"
            class="rounded border bg-white p-3 cursor-pointer"
            @click="jtbdSelectCard(card.fEntryId)"
          >
            <div class="flex items-center justify-between">
              <span class="rounded px-1.5 py-0.5 text-xs font-bold bg-slate-700 text-white">{{ card.fEntryId }}</span>
              <span class="text-slate-400 text-xs">{{ jtbdSelectedCard === card.fEntryId ? '▼' : '▶' }}</span>
            </div>
            <p v-if="jtbdSelectedCard !== card.fEntryId" class="mt-1 text-xs text-slate-500 truncate">When {{ card.when }}…</p>
            <div v-else class="mt-2 space-y-1 text-xs text-slate-700">
              <p>🕐 <strong>When</strong> {{ card.when }},</p>
              <p>🎯 <strong>I want to</strong> {{ card.iWantTo }},</p>
              <p>✅ <strong>So I can</strong> {{ card.soICan }}</p>
            </div>
          </div>
        </div>
        <button
          v-if="jtbdCards.length > 0"
          type="button"
          aria-label="Copy JTBD canvas as markdown"
          class="mt-3 h-11 px-3 text-sm rounded bg-lime-100 hover:bg-lime-200 text-lime-800 transition-colors"
          @click="copyJtbd()"
        >{{ jtbdCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
      </div>

      <!-- Feature #157 — API Contract panel -->
      <div
        v-if="apiContractOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="API contract generator panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-cyan-700">🔌 Spec as API Contract</p>
          <CloseDot
        aria-label="Close API contract panel"
        @click="apiContractOpen = false"
      />
        </div>
        <p v-if="apiEndpoints.length === 0" class="text-xs text-slate-400 italic">No F. or S. entries found. Generate a spec first.</p>
        <div v-else class="space-y-2">
          <details
            v-for="ep in apiEndpoints"
            :key="ep.entryId"
            class="rounded border"
          >
            <summary class="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs hover:bg-slate-50">
              <span
                class="shrink-0 rounded px-1.5 py-0.5 font-bold text-xs"
                :class="{
                  'bg-emerald-100 text-emerald-700': ep.method === 'GET',
                  'bg-blue-100 text-blue-700': ep.method === 'POST',
                  'bg-amber-100 text-amber-700': ep.method === 'PUT',
                  'bg-red-100 text-red-700': ep.method === 'DELETE',
                }"
              >{{ ep.method }}</span>
              <code class="font-mono text-slate-700">{{ ep.path }}</code>
              <span class="text-slate-400 truncate">{{ ep.entryName }}</span>
            </summary>
            <div class="px-3 pb-3 space-y-2">
              <div>
                <p class="text-xs font-semibold text-slate-500 mb-1">Request</p>
                <pre class="font-mono text-xs bg-slate-800 text-slate-100 p-2 rounded overflow-x-auto">{{ ep.requestSchema }}</pre>
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-500 mb-1">Response</p>
                <pre class="font-mono text-xs bg-slate-800 text-slate-100 p-2 rounded overflow-x-auto">{{ ep.responseSchema }}</pre>
              </div>
            </div>
          </details>
        </div>
        <button
          v-if="apiEndpoints.length > 0"
          type="button"
          aria-label="Copy API contract as YAML"
          class="mt-3 h-11 px-3 text-sm rounded bg-cyan-100 hover:bg-cyan-200 text-cyan-800 transition-colors"
          @click="copyApiYaml()"
        >{{ apiYamlCopied ? '✅ Copied!' : '📋 Copy YAML' }}</button>
      </div>

      <!-- Feature #159 — Experiment Mapper panel -->
      <div v-if="experimentOpen" class="mt-4 border rounded-lg p-4 bg-white" aria-label="Experiment mapper panel">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-purple-700">🧬 Lean Experiments</p>
          <CloseDot
        aria-label="Close experiments panel"
        @click="experimentOpen = false"
      />
        </div>
        <p v-if="experimentCards.length === 0" class="text-xs text-slate-400 italic">No V. entries found. Generate a spec first.</p>
        <div v-else class="space-y-3">
          <div v-for="card in experimentCards" :key="card.entryId" class="rounded-lg border p-3 bg-slate-50">
            <p class="text-xs font-bold text-slate-700 mb-2">{{ card.entryId }}</p>
            <p class="text-xs text-slate-600 italic mb-1">{{ card.hypothesis }}</p>
            <div class="flex gap-2 flex-wrap mb-2">
              <span class="text-xs bg-blue-100 text-blue-800 rounded px-2 py-0.5">📊 {{ card.metric }}</span>
              <span class="text-xs bg-emerald-100 text-emerald-800 rounded px-2 py-0.5">🎯 {{ card.threshold }}</span>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="text"
                :placeholder="'Enter result…'"
                :value="card.result"
                class="flex-1 h-8 border rounded px-2 text-xs text-slate-700"
                @input="setExperimentResult(card.entryId, ($event.target as HTMLInputElement).value)"
              />
              <span v-if="card.result" class="text-xs text-emerald-600 font-medium">✅</span>
            </div>
          </div>
        </div>
        <button v-if="experimentCards.length > 0" type="button" aria-label="Copy Experiments" class="mt-3 h-11 px-3 text-sm rounded bg-purple-100 hover:bg-purple-200 text-purple-800 transition-colors" @click="copyExperiments()">{{ experimentCopied ? '✅ Copied!' : '📋 Copy All' }}</button>
      </div>

      <!-- Feature #161 — Value Decay panel -->
      <div v-if="decayOpen" class="mt-4 border rounded-lg p-4 bg-white" aria-label="Value decay panel">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-red-700">📉 Value Decay Estimator</p>
          <CloseDot
        aria-label="Close value decay panel"
        @click="decayOpen = false"
      />
        </div>
        <p v-if="decayEntries.length === 0" class="text-xs text-slate-400 italic">No V. entries found. Generate a spec first.</p>
        <template v-else>
          <div class="mb-2 text-xs text-red-700 font-medium">
            {{ decaySorted.filter(e => e.urgencyLevel === 'critical').length }} critical /
            {{ decaySorted.filter(e => e.urgencyLevel === 'high').length }} high urgency
          </div>
          <div class="space-y-2">
            <div v-for="e in decayEntries" :key="e.vEntryId" class="flex items-center gap-3 text-xs">
              <span class="font-medium text-slate-700 truncate flex-1">{{ e.vEntryId }}</span>
              <span
                class="text-xs rounded px-2 py-0.5 font-medium flex-none"
                :class="{
                  'bg-red-100 text-red-800': e.urgencyLevel === 'critical',
                  'bg-amber-100 text-amber-800': e.urgencyLevel === 'high',
                  'bg-yellow-100 text-yellow-800': e.urgencyLevel === 'medium',
                  'bg-slate-100 text-slate-600': e.urgencyLevel === 'low',
                }"
              >{{ e.urgencyLevel }}</span>
              <span class="text-slate-500 flex-none">{{ e.decayRatePerWeek }}%/wk</span>
              <span class="text-slate-400 flex-none text-[10px]">{{ e.weeksUntilZero }}w until 0</span>
            </div>
          </div>
          <button type="button" aria-label="Copy Decay" class="mt-3 h-11 px-3 text-sm rounded bg-red-100 hover:bg-red-200 text-red-800 transition-colors" @click="copyDecay()">{{ decayCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
        </template>
      </div>

      <!-- Feature #162 — Press Kit panel -->
      <div v-if="pressKitOpen" class="mt-4 border rounded-lg p-4 bg-white" aria-label="Press kit panel">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-slate-700">📰 Press Kit</p>
          <CloseDot
        aria-label="Close press kit panel"
        @click="pressKitOpen = false"
      />
        </div>
        <template v-if="pressKit">
          <h3 class="text-base font-bold text-slate-800 mb-1">{{ pressKit.headline }}</h3>
          <p class="text-sm italic text-slate-600 mb-3">{{ pressKit.subheadline }}</p>
          <div class="mb-3">
            <p class="text-xs font-semibold text-slate-600 mb-1">Key Facts</p>
            <ul class="space-y-1">
              <li v-for="(fact, i) in pressKit.keyFacts" :key="i" class="flex items-start gap-2 text-xs text-slate-700">
                <span class="text-emerald-600 mt-0.5">✓</span>
                <span>{{ fact }}</span>
              </li>
            </ul>
          </div>
          <div class="mb-3">
            <p class="text-xs font-semibold text-slate-600 mb-1">Quotes</p>
            <div v-for="(quote, i) in pressKit.quotes" :key="i" class="border-l-2 border-slate-300 pl-3 mb-2 text-xs text-slate-600 italic">
              {{ quote }}
            </div>
          </div>
          <p class="text-xs text-slate-500 border-t pt-2">{{ pressKit.boilerplate }}</p>
          <button type="button" aria-label="Copy Press Kit" class="mt-3 h-11 px-3 text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors" @click="copyPressKit()">{{ pressKitCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
        </template>
      </div>

      <!-- Feature #164 — Risk-Adjusted Value panel -->
      <div v-if="riskValueOpen" class="mt-4 border rounded-lg p-4 bg-white" aria-label="Risk-adjusted value panel">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-orange-700">⚠️ Risk-Adjusted Value</p>
          <CloseDot
        aria-label="Close risk value panel"
        @click="riskValueOpen = false"
      />
        </div>
        <p v-if="riskValueEntries.length === 0" class="text-xs text-slate-400 italic">No V. entries found. Generate a spec first.</p>
        <template v-else>
          <div class="space-y-3 mb-3">
            <div v-for="e in riskValueEntries" :key="e.vId" class="rounded border border-slate-100 p-3 bg-slate-50">
              <div class="flex items-start justify-between gap-2 mb-1">
                <div>
                  <span class="text-xs font-mono font-semibold text-slate-700">{{ e.vId }}</span>
                  <span class="ml-1 text-xs text-slate-400 truncate">— {{ e.vDescription }}</span>
                </div>
                <span
                  class="text-xs font-medium flex-none px-1.5 py-0.5 rounded"
                  :class="e.adjustedValue > e.goalNumeric * 0.8 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                >adj: {{ e.adjustedValue }}</span>
              </div>
              <div class="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <span>Goal: {{ e.rawGoal }}</span>
                <span class="text-slate-300">|</span>
                <span>Raw: {{ e.goalNumeric }}</span>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  :value="e.probability"
                  class="flex-1 accent-orange-600"
                  :aria-label="`Probability for ${e.vId}`"
                  @input="setRiskProb(e.vId, Number(($event.target as HTMLInputElement).value))"
                />
                <span class="text-xs font-medium text-orange-700 w-10 text-right">{{ e.probability }}%</span>
              </div>
            </div>
          </div>
          <p class="text-xs font-medium text-slate-600 mb-2">
            Total raw: <span class="font-bold">{{ riskRaw }}</span> | Risk-adjusted: <span class="font-bold text-orange-700">{{ riskAdjusted }}</span>
          </p>
          <button type="button" aria-label="Copy Risk Value" class="h-11 px-3 text-sm rounded bg-orange-100 hover:bg-orange-200 text-orange-800 transition-colors" @click="copyRiskValue()">{{ riskCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
        </template>
      </div>

      <!-- Feature #166 — Personas Gallery panel -->
      <div v-if="personasOpen" class="mt-4 border rounded-lg p-4 bg-white" aria-label="Personas gallery panel">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-pink-700">👤 User Personas</p>
          <CloseDot
        aria-label="Close personas panel"
        @click="personasOpen = false"
      />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div v-for="p in personaCards" :key="p.name" class="bg-white rounded border border-slate-200 p-3">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-2xl" aria-hidden="true">{{ p.emoji }}</span>
              <div>
                <p class="text-sm font-bold text-slate-800">{{ p.name }}</p>
                <span class="inline-block rounded bg-slate-100 text-slate-600 text-xs px-2 py-0.5">{{ p.role }}</span>
              </div>
            </div>
            <p class="text-xs italic text-slate-600 mb-2">{{ p.quote }}</p>
            <ul class="space-y-1">
              <li v-for="pain in p.painPoints" :key="pain" class="flex items-start gap-1.5 text-xs text-slate-600">
                <span class="text-red-500 mt-0.5 shrink-0">●</span>
                <span>{{ pain }}</span>
              </li>
            </ul>
          </div>
        </div>
        <button
          type="button"
          aria-label="Copy Personas"
          class="h-11 px-3 text-sm rounded bg-pink-100 hover:bg-pink-200 text-pink-800 transition-colors"
          @click="navigator.clipboard.writeText(copyPersonas())"
        >📋 Copy Markdown</button>
      </div>

      <!-- Feature #167 — Sprint Backlog panel -->
      <div v-if="backlogOpen" class="mt-4 border rounded-lg p-4 bg-white" aria-label="Sprint backlog panel">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-indigo-700">📋 Sprint Backlog</p>
          <CloseDot
        aria-label="Close sprint backlog panel"
        @click="backlogOpen = false"
      />
        </div>
        <p v-if="backlogStories.length === 0" class="text-xs text-slate-400 italic">No F. entries found. Generate a spec first.</p>
        <template v-else>
          <ScrollContainer outer-class="mb-3 relative" inner-class="space-y-2" inner-style="max-height: 24rem" :no-pill="true">
            <template v-for="story in backlogStories" :key="story.storyId">
              <div class="rounded border border-slate-100 p-3 bg-slate-50">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <span class="text-xs font-mono text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">{{ story.storyId }}</span>
                  <span
                    class="text-xs font-bold px-1.5 py-0.5 rounded"
                    :class="{
                      'bg-slate-200 text-slate-700': story.storyPoints <= 2,
                      'bg-amber-100 text-amber-800': story.storyPoints === 3,
                      'bg-orange-100 text-orange-800': story.storyPoints === 5,
                      'bg-red-100 text-red-800': story.storyPoints === 8,
                    }"
                  >{{ story.storyPoints }}pt</span>
                  <span class="text-xs text-slate-500 flex-1">{{ story.parentFId }}</span>
                </div>
                <p class="text-xs text-slate-700 mb-1">{{ story.title }}</p>
                <details class="text-xs text-slate-500">
                  <summary class="cursor-pointer text-indigo-600 hover:text-indigo-800">Acceptance Criteria</summary>
                  <ul class="mt-1 space-y-1 pl-2">
                    <li v-for="ac in story.acceptanceCriteria" :key="ac" class="before:content-['–'] before:mr-1">{{ ac }}</li>
                  </ul>
                </details>
              </div>
            </template>
          </ScrollContainer>
          <div class="flex items-center gap-2">
            <div class="flex rounded overflow-hidden border border-slate-200 text-xs">
              <button
                type="button"
                aria-label="Backlog Markdown"
                class="px-2 py-1 transition-colors"
                :class="backlogCopyMode === 'markdown' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
                @click="backlogCopyMode = 'markdown'"
              >Markdown</button>
              <button
                type="button"
                aria-label="Backlog JSON"
                class="px-2 py-1 transition-colors"
                :class="backlogCopyMode === 'json' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
                @click="backlogCopyMode = 'json'"
              >JSON</button>
            </div>
            <button type="button" aria-label="Copy Backlog" class="h-11 px-3 text-sm rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-800 transition-colors" @click="copyBacklog()">{{ backlogCopied ? '✅ Copied!' : '📋 Copy' }}</button>
          </div>
        </template>
      </div>

      <!-- Feature #132 — RFC Formatter panel -->
      <div
        v-if="rfcOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="RFC document panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-stone-700">📄 Spec as RFC</p>
          <CloseDot
        aria-label="Close RFC panel"
        @click="rfcOpen = false"
      />
        </div>
        <h3 class="text-sm font-bold text-slate-800 mb-4">{{ rfcDocument.title }}</h3>
        <!-- RFC sections as collapsible details -->
        <details class="mb-2 border rounded">
          <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Abstract</summary>
          <p class="px-3 pb-3 text-sm text-slate-600 whitespace-pre-wrap">{{ rfcDocument.abstract }}</p>
        </details>
        <details class="mb-2 border rounded">
          <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Motivation</summary>
          <p class="px-3 pb-3 text-sm text-slate-600 whitespace-pre-wrap">{{ rfcDocument.motivation }}</p>
        </details>
        <details class="mb-2 border rounded">
          <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Detailed Design</summary>
          <p class="px-3 pb-3 text-sm text-slate-600 whitespace-pre-wrap">{{ rfcDocument.detailedDesign }}</p>
        </details>
        <details class="mb-2 border rounded">
          <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Drawbacks</summary>
          <p class="px-3 pb-3 text-sm text-slate-600 whitespace-pre-wrap">{{ rfcDocument.drawbacks }}</p>
        </details>
        <details class="mb-2 border rounded">
          <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Alternatives</summary>
          <p class="px-3 pb-3 text-sm text-slate-600 whitespace-pre-wrap">{{ rfcDocument.alternatives }}</p>
        </details>
        <details class="mb-4 border rounded">
          <summary class="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Unresolved Questions</summary>
          <p class="px-3 pb-3 text-sm text-slate-600 whitespace-pre-wrap">{{ rfcDocument.unresolved }}</p>
        </details>
        <!-- Copy button -->
        <button
          type="button"
          aria-label="Copy full RFC as markdown"
          class="h-11 px-3 text-sm rounded bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors"
          @click="rfcCopyMarkdown()"
        >{{ rfcCopied ? '✅ Copied!' : '📋 Copy Full RFC' }}</button>
      </div>

      <!-- Feature #134 — Tech Radar panel -->
      <div
        v-if="techRadarOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Tech radar panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-blue-800">📡 Tech Radar</p>
          <CloseDot
        aria-label="Close tech radar panel"
        @click="techRadarOpen = false"
      />
        </div>
        <SpecTechRadar :blocks="techRadarBlocks" />
        <!-- Ring count summary -->
        <div class="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
          <span
            v-for="ring in ['Adopt', 'Trial', 'Assess', 'Hold']"
            :key="ring"
            class="font-medium"
          >{{ ring }}: {{ techRadarRingCounts[ring as 'Adopt' | 'Trial' | 'Assess' | 'Hold'] }}</span>
        </div>
        <!-- Copy button -->
        <button
          type="button"
          aria-label="Copy tech radar as markdown table"
          class="mt-3 h-11 px-3 text-sm rounded bg-blue-50 hover:bg-blue-100 text-blue-800 transition-colors"
          @click="techRadarCopyMarkdown()"
        >{{ techRadarCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #136 — SLA Generator panel -->
      <div
        v-if="slaOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="SLA generator panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-emerald-800">📋 SLA Generator</p>
          <CloseDot
        aria-label="Close SLA panel"
        @click="slaOpen = false"
      />
        </div>
        <div v-if="slaClauses.length === 0" class="text-sm text-slate-500 italic">No V. entries in spec.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50">
                <th class="border px-2 py-1 text-left text-slate-700">V. Entry</th>
                <th class="border px-2 py-1 text-left text-slate-700">Service Name</th>
                <th class="border px-2 py-1 text-left text-slate-700">Metric</th>
                <th class="border px-2 py-1 text-left text-slate-700">Target</th>
                <th class="border px-2 py-1 text-left text-slate-700">Period</th>
                <th class="border px-2 py-1 text-left text-slate-700">Penalty</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="clause in slaClauses" :key="clause.blockId" class="hover:bg-slate-50">
                <td class="border px-2 py-1 text-slate-600">{{ clause.blockId }}</td>
                <td class="border px-2 py-1">
                  <input
                    type="text"
                    :value="clause.serviceName"
                    class="w-full border rounded px-1 py-0.5 text-sm"
                    @input="slaUpdateClause(clause.blockId, 'serviceName', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td class="border px-2 py-1 text-slate-600">{{ clause.metric }}</td>
                <td class="border px-2 py-1">
                  <input
                    type="text"
                    :value="clause.target"
                    class="w-full border rounded px-1 py-0.5 text-sm"
                    @input="slaUpdateClause(clause.blockId, 'target', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td class="border px-2 py-1">
                  <input
                    type="text"
                    :value="clause.measurementPeriod"
                    class="w-full border rounded px-1 py-0.5 text-sm"
                    @input="slaUpdateClause(clause.blockId, 'measurementPeriod', ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td class="border px-2 py-1">
                  <input
                    type="text"
                    :value="clause.penalty"
                    class="w-full border rounded px-1 py-0.5 text-sm"
                    @input="slaUpdateClause(clause.blockId, 'penalty', ($event.target as HTMLInputElement).value)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Copy SLA Document button -->
        <button
          type="button"
          aria-label="Copy SLA document as markdown"
          class="mt-3 h-11 px-3 text-sm rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors"
          @click="slaCopyMarkdown()"
        >{{ slaCopied ? '✅ Copied!' : '📋 Copy SLA Document' }}</button>
      </div>

      <!-- Feature #137 — Pitch Deck panel -->
      <div
        v-if="pitchDeckOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Pitch deck panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-fuchsia-700">💰 Investor Pitch Deck</p>
          <CloseDot
        aria-label="Close pitch deck panel"
        @click="pitchDeckOpen = false"
      />
        </div>
        <div class="space-y-3">
          <div
            v-for="slide in pitchSlides"
            :key="slide.number"
            class="border rounded-lg p-3 bg-slate-50"
          >
            <div class="flex items-center gap-2 mb-2">
              <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-fuchsia-700 text-white text-xs font-bold">{{ slide.number }}</span>
              <span class="text-sm font-semibold text-slate-800">{{ slide.title }}</span>
            </div>
            <ul class="space-y-1">
              <li
                v-for="(bullet, idx) in slide.bullets"
                :key="idx"
                class="text-xs text-slate-600 flex items-start gap-1.5"
              >
                <span class="text-fuchsia-500 mt-0.5">•</span>
                <span>{{ bullet }}</span>
              </li>
            </ul>
          </div>
        </div>
        <!-- Copy All Slides button -->
        <button
          type="button"
          aria-label="Copy all pitch deck slides as markdown"
          class="mt-4 h-11 px-3 text-sm rounded bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-800 transition-colors"
          @click="pitchDeckCopyMarkdown()"
        >{{ pitchDeckCopied ? '✅ Copied!' : '📋 Copy All Slides' }}</button>
      </div>

      <!-- Feature #139 — User Journey panel -->
      <div
        v-if="journeyOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="User journey panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-teal-700">🗺️ User Journey Map</p>
          <CloseDot
        aria-label="Close user journey panel"
        @click="journeyOpen = false"
      />
        </div>
        <SpecUserJourney :blocks="journeyBlocks" />
        <button
          type="button"
          aria-label="Copy user journey as markdown"
          class="mt-4 h-11 px-3 text-sm rounded bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors"
          @click="copyJourney()"
        >{{ journeyCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #141 — Delphi Estimation panel -->
      <div
        v-if="delphiOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Delphi estimation panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-purple-700">🎯 Delphi Estimation</p>
          <CloseDot
        aria-label="Close delphi estimation panel"
        @click="delphiOpen = false"
      />
        </div>
        <div class="space-y-3">
          <p class="text-xs text-purple-600">Current round: <strong>{{ delphiCurrentRound }}</strong></p>
          <div
            v-for="entry in delphiEntries"
            :key="entry.id"
            class="border rounded-lg overflow-hidden"
          >
            <!-- Entry header -->
            <div class="flex items-center justify-between px-3 py-2 bg-purple-50">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs text-purple-800 font-semibold">{{ entry.name }}</span>
                <span class="text-xs text-purple-700">Consensus: {{ entry.consensus ?? '—' }} {{ entry.unit }}</span>
              </div>
              <span
                :class="entry.consensus !== null
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'"
                class="rounded-full px-2 py-0.5 text-[10px] font-medium"
              >{{ entry.consensus !== null ? '✓ Converged' : '→ In progress' }}</span>
            </div>
            <!-- Rounds -->
            <div class="px-3 py-2 space-y-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[10px] font-semibold text-slate-500 w-16 shrink-0">Round 1</span>
                <input
                  type="number"
                  :value="entry.round1 ?? 0"
                  class="w-16 h-8 text-xs border rounded px-2 text-center"
                  :aria-label="`Round 1 estimate for ${entry.name}`"
                  @input="delphiUpdateEstimate(entry.id, 1, 0, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                />
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[10px] font-semibold text-slate-500 w-16 shrink-0">Round 2</span>
                <input
                  type="number"
                  :value="entry.round2 ?? 0"
                  class="w-16 h-8 text-xs border rounded px-2 text-center"
                  :aria-label="`Round 2 estimate for ${entry.name}`"
                  @input="delphiUpdateEstimate(entry.id, 2, 0, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                />
                <button
                  type="button"
                  class="h-8 px-2 text-[10px] rounded bg-purple-100 hover:bg-purple-200 text-purple-700 transition-colors"
                  :aria-label="`Open round 2 for ${entry.name}`"
                  @click="delphiOpenRound(entry.id, 2)"
                >→ Open Round 2</button>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[10px] font-semibold text-slate-500 w-16 shrink-0">Round 3</span>
                <input
                  type="number"
                  :value="entry.round3 ?? 0"
                  class="w-16 h-8 text-xs border rounded px-2 text-center"
                  :aria-label="`Round 3 estimate for ${entry.name}`"
                  @input="delphiSubmitRound(entry.id, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                />
                <button
                  type="button"
                  class="h-8 px-2 text-[10px] rounded bg-purple-100 hover:bg-purple-200 text-purple-700 transition-colors"
                  :aria-label="`Open round 3 for ${entry.name}`"
                  @click="delphiOpenRound(entry.id, 3)"
                >→ Open Round 3</button>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="h-11 px-3 text-sm rounded bg-purple-200 hover:bg-purple-300 text-purple-800 transition-colors"
            aria-label="Advance to next delphi round"
            @click="delphiAdvanceRound()"
          >→ Advance Round</button>
        </div>
        <button
          type="button"
          aria-label="Copy delphi estimation as markdown"
          class="mt-4 h-11 px-3 text-sm rounded bg-purple-50 hover:bg-purple-100 text-purple-800 transition-colors"
          @click="delphiCopyMarkdown()"
        >{{ delphiCopied ? '✅ Copied!' : '📋 Copy' }}</button>
      </div>

      <!-- Feature #142 — Marketing One-Pager panel -->
      <div
        v-if="onePagerOpen"
        class="mt-4 border rounded-lg p-4 bg-white"
        aria-label="Marketing one-pager panel"
      >
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs font-semibold text-pink-700">📣 Marketing One-Pager</p>
          <CloseDot
        aria-label="Close one-pager panel"
        @click="onePagerOpen = false"
      />
        </div>
        <!-- One-pager card -->
        <div class="rounded-lg border border-pink-100 bg-pink-50 p-5 space-y-4">
          <!-- Headline -->
          <p class="text-xl font-bold text-slate-900">{{ onePager.headline }}</p>
          <!-- Subheadline -->
          <p class="text-sm text-gray-500">{{ onePager.subheadline }}</p>
          <hr class="border-pink-200" />
          <!-- Benefits -->
          <ul class="space-y-1">
            <li
              v-for="(benefit, idx) in onePager.benefits"
              :key="idx"
              class="text-sm text-slate-700"
            >{{ benefit }}</li>
          </ul>
          <!-- Proof points -->
          <ul class="space-y-1">
            <li
              v-for="(proof, idx) in onePager.proofPoints"
              :key="idx"
              class="text-sm font-medium text-emerald-700"
            >{{ proof }}</li>
          </ul>
          <hr class="border-pink-200" />
          <!-- CTA -->
          <div class="bg-indigo-600 text-white rounded py-2 text-center text-sm font-medium">
            {{ onePager.cta }}
          </div>
          <!-- Footer -->
          <p class="text-xs text-gray-400 text-center">{{ onePager.footer }}</p>
        </div>
        <button
          type="button"
          aria-label="Copy one-pager as markdown"
          class="mt-4 h-11 px-3 text-sm rounded bg-pink-50 hover:bg-pink-100 text-pink-800 transition-colors"
          @click="copyOnePager()"
        >{{ onePagerCopied ? '✅ Copied!' : '📋 Copy Markdown' }}</button>
      </div>

      <!-- Feature #26 — Spec Diff banner (only in After view, only when previousSpec set and changes exist) -->
      <div
        v-if="!showBefore && previousSpec && diffChanges.length > 0"
        class="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-2"
        aria-label="What changed in this spec"
      >
        <!-- Banner header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-indigo-700">
            🔀 What changed
            <span class="ml-1 inline-flex items-center justify-center rounded-full bg-indigo-200 text-indigo-800 text-xs px-1.5 py-0.5 font-bold">
              {{ diffChanges.length }}
            </span>
          </p>
          <button
            type="button"
            :aria-label="diffOpen ? 'Collapse diff panel' : 'Expand diff panel'"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
            @click="diffOpen = !diffOpen"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 transition-transform"
              :class="diffOpen ? '' : 'rotate-180'"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- Change rows -->
        <div v-show="diffOpen" class="space-y-1.5">
          <div
            v-for="(change, i) in visibleDiffChanges"
            :key="`${change.entryId}-${change.field}-${i}`"
            class="flex flex-wrap items-center gap-1.5 text-xs"
          >
            <!-- Entry ID pill -->
            <span class="rounded-full bg-indigo-200 text-indigo-800 px-2 py-0.5 text-xs font-mono font-medium">
              {{ change.entryId }}
            </span>
            <!-- Field name -->
            <span class="text-gray-500 text-xs">{{ change.field }}</span>
            <!-- Old value -->
            <span class="line-through text-red-700 bg-red-50 rounded px-1">{{ change.oldValue }}</span>
            <!-- Arrow -->
            <span class="text-slate-400" aria-hidden="true">→</span>
            <!-- New value -->
            <span class="text-emerald-800 bg-emerald-50 rounded px-1">{{ change.newValue }}</span>
          </div>

          <!-- Show more button -->
          <button
            v-if="!diffShowAll && diffChanges.length > DIFF_MAX_ROWS"
            type="button"
            class="mt-1 text-xs text-indigo-600 hover:text-indigo-800 underline"
            @click="diffShowAll = true"
          >
            Show {{ diffChanges.length - DIFF_MAX_ROWS }} more…
          </button>
        </div>
      </div>

      <!-- Feature #28 — Lean Plan panel -->
      <div
        v-if="leanOpen"
        class="rounded-xl border border-cyan-200 bg-cyan-50 p-4 space-y-3"
        aria-label="Lean plan panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-cyan-700">🔬 Lean Plan</p>
          <CloseDot
        aria-label="Close lean plan panel"
        @click="leanOpen = false"
      />
        </div>

        <!-- Loading -->
        <div v-if="leanLoading" class="flex items-center gap-2">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-cyan-600" aria-hidden="true"/>
          <span class="text-xs text-cyan-700">Identifying minimum viable scope…</span>
        </div>

        <!-- Error -->
        <div v-else-if="leanError" role="alert" class="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p class="text-xs text-red-700">{{ leanError }}</p>
        </div>

        <!-- Lean spec result -->
        <div v-else-if="leanSpec" class="space-y-3">
          <!-- F. entries -->
          <div
            v-for="f in leanSpec.functions"
            :key="f.id"
            class="rounded-lg border border-blue-100 bg-cyan-100 px-3 py-2.5"
          >
            <p class="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">Function · <span class="font-mono">{{ f.id }}</span></p>
            <p class="text-xs text-slate-700">{{ f.description }}</p>
          </div>
          <!-- V. entries -->
          <div
            v-for="v in leanSpec.values"
            :key="v.id"
            class="rounded-lg border border-emerald-100 bg-cyan-100 px-3 py-2.5"
          >
            <p class="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Value · <span class="font-mono">{{ v.id }}</span></p>
            <p class="text-xs text-slate-700">{{ v.description }}</p>
            <p v-if="v.goal" class="text-xs text-green-700 mt-1"><span class="font-semibold">Goal:</span> {{ v.goal }}</p>
          </div>
          <!-- S. entries -->
          <div
            v-for="s in leanSpec.solutions"
            :key="s.id"
            class="rounded-lg border border-violet-100 bg-cyan-100 px-3 py-2.5"
          >
            <p class="text-xs font-bold text-orange-600 uppercase tracking-wide mb-1">Solution · <span class="font-mono">{{ s.id }}</span></p>
            <p class="text-xs text-slate-700">{{ s.description }}</p>
          </div>

          <!-- Use Lean Plan action -->
          <button
            type="button"
            aria-label="Use Lean Plan"
            class="min-h-[44px] w-full rounded-lg bg-cyan-600 text-white text-sm font-medium
                   hover:bg-cyan-700 focus-visible:outline focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-cyan-600 transition-colors px-4 py-2"
            @click="handleUseLeanPlan"
          >
            Use Lean Plan
          </button>
        </div>
      </div>

      <!-- Feature #42 — Goal Sensitivity panel -->
      <div v-show="sensitivityOpen" class="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-orange-700">🎯 Goal Sensitivity</p>
          <CloseDot
        aria-label="Close sensitivity panel"
        @click="sensitivityOpen = false"
      />
        </div>

        <!-- Slider -->
        <div class="flex items-center gap-3">
          <label class="text-xs text-orange-700 shrink-0">
            Goal sensitivity: <span class="font-semibold">{{ sensitivity.multiplier.value }}×</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            :value="sensitivity.multiplier.value"
            class="flex-1 h-2 accent-orange-500"
            aria-label="Goal sensitivity multiplier"
            @input="sensitivity.multiplier.value = parseFloat(($event.target as HTMLInputElement).value)"
          />
        </div>

        <!-- Warning banner when not at 1× -->
        <div
          v-if="sensitivity.multiplier.value !== 1.0"
          class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
          role="status"
        >
          ⚠ Goals adjusted to {{ sensitivity.multiplier.value }}× — this is a sensitivity preview, not the real spec
        </div>

        <!-- Reset button -->
        <button
          type="button"
          aria-label="Reset sensitivity to 1×"
          class="min-h-[44px] px-4 py-2 text-xs font-medium rounded-lg bg-orange-200 text-orange-800 hover:bg-orange-300 transition-colors"
          @click="sensitivity.multiplier.value = 1.0"
        >
          Reset to 1×
        </button>
      </div>

      <!-- Animated transition between Before and After views -->
      <div class="relative overflow-hidden">
        <Transition :name="transitionName" mode="out-in">

          <!-- ── BEFORE view — raw SEM input ── -->
          <div
            v-if="showBefore"
            key="before"
            class="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4"
            aria-label="Raw SEM input"
          >
            <!-- Contrast badge -->
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-400 tracking-wide">What you wrote</span>
              <span
                class="inline-flex items-center gap-1.5 rounded-full border border-slate-200
                       bg-white px-2.5 py-1 text-xs font-medium text-slate-500 shadow-sm"
                aria-label="Plain language converted to structured spec"
              >
                Plain language → structured spec
              </span>
            </div>

            <!-- Stakes section -->
            <div class="space-y-1">
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stakes</p>
              <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {{ rawInput?.stakes || '—' }}
              </p>
            </div>

            <!-- Ends section -->
            <div class="space-y-1">
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ends</p>
              <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {{ rawInput?.ends || '—' }}
              </p>
            </div>

            <!-- Means section -->
            <div class="space-y-1">
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Means</p>
              <p class="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {{ rawInput?.means || '—' }}
              </p>
            </div>
          </div>

          <!-- ── AFTER view — generated spec cards ── -->
          <!-- Feature #10: animationKey as wrapper key forces re-animation on each new spec -->
          <div v-else key="after" class="space-y-3">

            <!-- Feature #198 — Edit in Spec Editor shortcut bar -->
            <div class="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                class="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-amber-300
                       bg-amber-50 text-amber-700 text-xs font-semibold
                       hover:bg-amber-100 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-300"
                title="Open the Spec Editor for all entries"
                @click="emit('open-editor', {})"
              ><EditGlyph size="compact" class="h-3.5 w-auto shrink-0" aria-hidden="true" /> Edit Spec</button>
              <!-- About the Edit Glyph info affordance -->
              <button
                type="button"
                class="flex items-center gap-1 h-8 px-2 rounded-lg border border-slate-200
                       bg-slate-50 text-slate-500 text-[10px] font-semibold
                       hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300"
                title="About the Edit Glyph — what [*]→[**] means"
                @click="emit('open-edit-info')"
              ><EditGlyph size="compact" class="h-2.5 w-auto shrink-0" aria-hidden="true" /><span class="ml-1">?</span></button>
              <button
                type="button"
                class="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-200
                       bg-blue-50 text-blue-700 text-xs font-semibold
                       hover:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
                title="Open Spec Editor on the Functions tab"
                @click="emit('open-editor', { tab: 'functions' })"
              ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /> Functions</button>
              <button
                type="button"
                class="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-200
                       bg-emerald-50 text-emerald-700 text-xs font-semibold
                       hover:bg-emerald-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300"
                title="Open Spec Editor on the Values tab"
                @click="emit('open-editor', { tab: 'values' })"
              ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /> Values</button>
              <button
                type="button"
                class="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-violet-200
                       bg-violet-50 text-violet-700 text-xs font-semibold
                       hover:bg-violet-100 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-300"
                title="Open Spec Editor on the Solutions tab"
                @click="emit('open-editor', { tab: 'solutions' })"
              ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /> Solutions</button>
              <button
                v-if="(displaySpec?.constraints ?? []).length > 0"
                type="button"
                class="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200
                       bg-red-50 text-red-700 text-xs font-semibold
                       hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
                title="Open Spec Editor on the Constraints tab"
                @click="emit('open-editor', { tab: 'constraints' })"
              ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-hidden="true" /> Constraints</button>
            </div>

            <!-- Feature #31 — Natural Language Filter -->
            <div class="relative">
              <input
                v-model="filterQuery"
                type="search"
                placeholder="Filter: goal > 80 · scale % · onboarding…"
                aria-label="Filter spec entries"
                class="w-full h-11 rounded-lg border border-gray-200 px-4 pr-10 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
              />
              <button
                v-if="filterQuery"
                type="button"
                aria-label="Clear filter"
                class="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:text-gray-700 transition-colors"
                @click="filterQuery = ''"
              >
                ×
              </button>
            </div>

            <!-- Filter count badge -->
            <p
              v-if="filterQuery.trim() && filteredEntryCount < totalEntryCount"
              class="px-1 text-xs text-gray-500"
              aria-live="polite"
            >
              Showing {{ filteredEntryCount }} of {{ totalEntryCount }} entries
            </p>

            <!-- Subtle label -->
            <p class="px-1 text-xs text-slate-400">What Planguage gives you</p>

            <!-- Copy+Email — whole spec — TOP (Tom: "at both top and bottom of the listing") -->
            <div class="flex items-center gap-1.5 px-1">
              <span class="text-[10px] text-slate-400 font-medium mr-1">Copy whole spec:</span>
              <button
                type="button"
                :title="copied ? 'Copied!' : 'Copy whole spec as colored HTML table'"
                :aria-label="copied ? 'Copied!' : 'Copy whole spec'"
                class="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors
                       border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300"
                :class="copied ? 'text-emerald-600' : 'text-teal-600/70 hover:text-teal-700'"
                @click="copyToClipboard"
              >
                <span v-if="copied" class="font-bold text-xs">✓</span>
                <CopyGlyph v-else size="compact" class="h-4 w-auto" aria-label="" />
              </button>
              <button
                type="button"
                :title="emailed ? 'Opening Mail…' : 'Email whole spec — opens Mail.app with spec pre-filled'"
                :aria-label="emailed ? 'Opening Mail…' : 'Email whole spec'"
                class="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors
                       border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300"
                :class="emailed ? 'text-emerald-600' : 'text-indigo-600/70 hover:text-indigo-700'"
                @click="emailSpec"
              >
                <span v-if="emailed" class="font-bold text-xs">✓</span>
                <EmailGlyph v-else size="compact" class="h-4 w-auto" aria-label="" />
              </button>
            </div>

            <!-- Feature #178 (enhanced) — Stakeholders Section Card
                 Tom 2026-05-15 SUPREME: "THE SPECS DO NOT SHOW STAKEHOLDERS (AND
                 THEIR NEEDS) AT LATER STAGES, this is important to understand and
                 check the plans. Top priority."
                 Sources: V.wishStakeholder (named wish-givers) + rawInput.stakes
                 text (who benefits). For each stakeholder, shows their linked
                 Values (needs) and applicable Constraints (rules).
                 DD-006 / SUPREME inanimate-stakeholder rule: regulatory bodies
                 (GDPR, HIPAA) appear here too, via Constraints. -->
            <div
              v-if="specStakeholderCards.length > 0 || rawInput?.stakes"
              class="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden shadow-sm"
              aria-label="Stakeholders and their needs"
            >
              <!-- Header -->
              <div class="flex items-center gap-2 bg-amber-100 px-4 py-2.5 border-b border-amber-200">
                <span class="text-xs font-bold text-amber-800 uppercase tracking-wide">👤§</span>
                <span class="text-xs font-bold text-amber-800 uppercase tracking-wide">Stakeholders</span>
                <span class="text-[10px] text-amber-600 ml-auto">{{ specStakeholderCards.length }} identified</span>
                <button type="button"
                  :title="copiedSection === 'stakeholders' ? 'Copied!' : 'Copy Stakeholders section as colored HTML table'"
                  :aria-label="copiedSection === 'stakeholders' ? 'Copied!' : 'Copy Stakeholders'"
                  class="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold transition-colors
                         border border-amber-300 bg-white/70 text-amber-700 hover:bg-white hover:border-amber-500"
                  @click="copySection('stakeholders')"
                >
                  <span v-if="copiedSection === 'stakeholders'" class="font-bold text-xs">✓</span>
                  <CopyGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
                </button>
                <button type="button"
                  :title="emailedSection === 'stakeholders' ? 'Opening Mail…' : 'Email Stakeholders section — opens Mail.app pre-filled'"
                  :aria-label="emailedSection === 'stakeholders' ? 'Opening Mail…' : 'Email Stakeholders'"
                  class="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold transition-colors
                         border border-amber-300 bg-white/70 text-amber-700 hover:bg-white hover:border-amber-500"
                  @click="emailSection('stakeholders')"
                >
                  <span v-if="emailedSection === 'stakeholders'" class="font-bold text-xs">✓</span>
                  <EmailGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
                </button>
              </div>
              <div class="px-4 py-3 space-y-2.5">
                <!-- Raw stakes text for context -->
                <p
                  v-if="rawInput?.stakes"
                  class="text-xs text-amber-700 italic border-b border-amber-100 pb-2"
                >
                  Stakes: "{{ rawInput.stakes }}"
                </p>
                <!-- Per-stakeholder rows -->
                <div
                  v-for="sh in specStakeholderCards"
                  :key="sh.name"
                  class="flex flex-col gap-1"
                >
                  <div class="flex items-center gap-2 flex-wrap">
                    <span
                      class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                      :class="[sh.palette.bg, sh.palette.text, sh.palette.border]"
                    >{{ sh.name }}</span>
                    <!-- Linked value descriptions (their needs) -->
                    <span
                      v-if="sh.linkedValues.length > 0"
                      class="text-xs text-amber-800"
                    >
                      needs: <span class="font-medium">{{ sh.linkedValues.map(v => v.description).join(' · ') }}</span>
                    </span>
                    <!-- Wish text -->
                    <span
                      v-if="sh.wish"
                      class="text-xs text-amber-600 italic"
                    >wishes: "{{ sh.wish }}"</span>
                    <!-- No linked values fallback -->
                    <span
                      v-else-if="sh.linkedValues.length === 0 && !sh.wish"
                      class="text-xs text-amber-500 italic"
                    >needs defined in Ends</span>
                  </div>
                  <!-- Applicable constraints -->
                  <div
                    v-if="sh.linkedConstraints.length > 0"
                    class="flex flex-wrap gap-1 ml-2"
                  >
                    <span
                      v-for="c in sh.linkedConstraints"
                      :key="c.id"
                      class="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-px font-mono"
                      :title="c.description"
                    >{{ c.id }}</span>
                  </div>
                </div>
                <!-- Empty: just show stakes text hint -->
                <p
                  v-if="specStakeholderCards.length === 0"
                  class="text-xs text-amber-600 italic"
                >
                  Use the Stakes field to name who benefits — they'll appear here with their needs.
                </p>
              </div>
            </div>

            <!-- Feature #10 — Animated entry wrapper: keyed by animationKey to re-trigger on new spec -->
            <div :key="animationKey" class="space-y-3">

              <!-- Function cards — group header with copy+email -->
              <div
                v-if="displaySpec!.functions.length > 0"
                class="flex items-center gap-2 rounded-t-xl bg-blue-600 px-4 py-2 -mb-3"
              >
                <span class="text-[11px] font-bold text-white uppercase tracking-wide">F. Functions</span>
                <span class="text-[10px] text-blue-200 ml-auto">{{ displaySpec!.functions.length }} entries</span>
                <button type="button"
                  :title="copiedSection === 'functions' ? 'Copied!' : 'Copy Functions section as colored HTML table'"
                  :aria-label="copiedSection === 'functions' ? 'Copied!' : 'Copy Functions'"
                  class="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold transition-colors
                         border border-blue-400 bg-white/20 text-white hover:bg-white/40"
                  @click="copySection('functions')"
                >
                  <span v-if="copiedSection === 'functions'" class="font-bold text-xs">✓</span>
                  <CopyGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
                </button>
                <button type="button"
                  :title="emailedSection === 'functions' ? 'Opening Mail…' : 'Email Functions section — opens Mail.app pre-filled'"
                  :aria-label="emailedSection === 'functions' ? 'Opening Mail…' : 'Email Functions'"
                  class="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold transition-colors
                         border border-blue-400 bg-white/20 text-white hover:bg-white/40"
                  @click="emailSection('functions')"
                >
                  <span v-if="emailedSection === 'functions'" class="font-bold text-xs">✓</span>
                  <EmailGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
                </button>
              </div>
              <article
                v-for="(f, index) in displaySpec!.functions"
                :key="f.id"
                class="spec-entry-card rounded-xl border border-blue-100 bg-white shadow-sm overflow-hidden"
                :style="{ animationDelay: `${index * 80}ms` }"
                :aria-label="`Function: ${f.id}`"
              >
                <div class="flex items-center gap-2 bg-blue-50 px-4 py-2.5 border-b border-blue-100">
                  <!-- Feature #11: PlanguageTerm tooltip for section header -->
                  <PlanguageTerm term="Function" class="text-xs font-bold tracking-wide text-blue-600 uppercase" />
                  <span class="text-xs text-blue-400">·</span>
                  <span class="text-xs font-mono text-blue-700">{{ f.id }}</span>
                  <!-- Sharpening badge — entry was added/refined by a sharpening round -->
                  <span
                    v-if="sharpenedEntryIds.includes(f.id)"
                    class="text-xs leading-none"
                    aria-label="Sharpened entry"
                    title="This entry was added or refined by a sharpening round"
                  >🔪</span>
                  <!-- Feature #57b — per-entry rewrite pin -->
                  <button
                    type="button"
                    :aria-label="entryState(f.id).open ? 'Close rewrite panel' : 'Rewrite this entry'"
                    title="Rewrite this entry"
                    class="ml-auto h-7 w-7 flex items-center justify-center rounded-full text-sm transition-colors hover:bg-blue-100"
                    :class="entryState(f.id).open ? 'text-blue-500 bg-blue-100' : 'text-slate-300 hover:text-blue-400'"
                    @click.stop="toggleEntryPin(f.id)"
                  ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-label="Edit this entry" /></button>
                </div>
                <div class="px-4 py-4 space-y-3">
                  <!-- Inline description: click to edit directly (Tom 2026-05-18) -->
                  <div v-if="entryState(f.id).editingDesc" class="space-y-1.5">
                    <textarea
                      :id="`desc-edit-${f.id}`"
                      v-model="entryState(f.id).editDescText"
                      rows="3"
                      class="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-slate-800 leading-relaxed
                             focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                      @keydown="onDescEditKeydown($event, f.id, 'F')"
                      @blur="saveDescEdit(f.id, 'F')"
                    />
                    <p class="text-[10px] text-slate-400">⌘↵ save · Esc cancel · click outside to save</p>
                  </div>
                  <p
                    v-else
                    class="text-sm text-slate-800 leading-relaxed cursor-text hover:bg-blue-50/60 rounded px-1 -mx-1 transition-colors"
                    title="Click to edit"
                    @click="startDescEdit(f.id, f.description)"
                  >{{ f.description }}</p>
                  <!-- Feature #57b — inline entry rewrite panel -->
                  <div v-if="entryState(f.id).open" class="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <div class="flex flex-wrap gap-1" role="group" aria-label="Rewrite style for this entry">
                      <button
                        v-for="m in SIMPLIFY_MODES"
                        :key="m.key"
                        type="button"
                        :title="m.hint"
                        :disabled="entryState(f.id).loading"
                        :class="[
                          'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all',
                          entryState(f.id).mode === m.key
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white border border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-100',
                          entryState(f.id).loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                        ]"
                        @click="handleEntrySimplify(f.id, f.description, m.key)"
                      ><span>{{ m.emoji }}</span>{{ m.label }}</button>
                    </div>
                    <div v-if="entryState(f.id).loading" class="flex items-center gap-1.5">
                      <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600"/>
                      <span class="text-[10px] text-blue-600">Rewriting…</span>
                    </div>
                    <div v-else-if="entryState(f.id).result" class="space-y-2">
                      <p class="text-xs text-slate-700 italic bg-white border border-blue-100 rounded-md px-3 py-2 leading-relaxed">{{ entryState(f.id).result }}</p>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="min-h-[32px] px-3 text-[10px] font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          @click="acceptEntryRewrite(f.id, 'F')"
                        >✅ Accept</button>
                        <button
                          type="button"
                          class="min-h-[32px] px-3 text-[10px] font-medium rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
                          @click="entryState(f.id).result = ''; entryState(f.id).accepted = false"
                        >↩ Change Back</button>
                        <button
                          v-if="entryState(f.id).accepted"
                          type="button"
                          class="min-h-[32px] px-3 text-[10px] font-medium rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                          @click="emit('rewrite-entry-fix', { id: f.id, type: 'F', description: entryState(f.id).result })"
                        >🔧 Fix in Spec</button>
                      </div>
                    </div>
                  </div>
                  <!-- Feature #65 — Complexity bar -->
                  <div
                    class="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden"
                    :title="`Complexity: ${scoreSentenceComplexity(f.description)}/100`"
                    aria-hidden="true"
                  >
                    <div
                      class="h-full rounded-full transition-all duration-300"
                      :style="{
                        width: complexityBarWidth(scoreSentenceComplexity(f.description)),
                        backgroundColor: complexityColour(scoreSentenceComplexity(f.description)),
                      }"
                    />
                  </div>
                  <!--
                    DD-004 (Tom 2026-05-14): "REPURPOSE: NOT AS SUCCESS. AS PRESENCE OR
                    ABSENCE OF THE DEFINED FUNCTION." Field renamed successCriteria →
                    presenceTest. We read presenceTest first, fall back to legacy
                    successCriteria so old saved specs still render until they are
                    migrated.
                  -->
                  <div v-if="f.presenceTest || f.successCriteria" class="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p class="text-xs font-semibold text-slate-500 mb-1">Presence Test</p>
                    <p class="text-sm text-slate-700 leading-relaxed">{{ f.presenceTest || f.successCriteria }}</p>
                  </div>
                </div>
              </article>

              <!-- Value cards — group header with copy+email -->
              <div
                v-if="displaySpec!.values.length > 0"
                class="flex items-center gap-2 rounded-t-xl bg-violet-700 px-4 py-2 -mb-3 mt-1"
              >
                <span class="text-[11px] font-bold text-white uppercase tracking-wide">V. Values</span>
                <span class="text-[10px] text-violet-200 ml-auto">{{ displaySpec!.values.length }} entries</span>
                <button type="button"
                  :title="copiedSection === 'values' ? 'Copied!' : 'Copy Values section as colored HTML table'"
                  :aria-label="copiedSection === 'values' ? 'Copied!' : 'Copy Values'"
                  class="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold transition-colors
                         border border-violet-400 bg-white/20 text-white hover:bg-white/40"
                  @click="copySection('values')"
                >
                  <span v-if="copiedSection === 'values'" class="font-bold text-xs">✓</span>
                  <CopyGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
                </button>
                <button type="button"
                  :title="emailedSection === 'values' ? 'Opening Mail…' : 'Email Values section — opens Mail.app pre-filled'"
                  :aria-label="emailedSection === 'values' ? 'Opening Mail…' : 'Email Values'"
                  class="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold transition-colors
                         border border-violet-400 bg-white/20 text-white hover:bg-white/40"
                  @click="emailSection('values')"
                >
                  <span v-if="emailedSection === 'values'" class="font-bold text-xs">✓</span>
                  <EmailGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
                </button>
              </div>
              <!-- Value cards — Change 1: modular blocks + icons + progress bar -->
              <!-- Change 2: Ambition Level chips; Change 3: Wish field -->
              <article
                v-for="(v, index) in displaySpec!.values"
                :key="v.id"
                class="spec-entry-card rounded-xl border bg-white shadow-sm overflow-hidden"
                :class="pinnedId === v.id ? 'border-amber-400 ring-2 ring-amber-400' : 'border-emerald-100'"
                :style="{ animationDelay: `${(displaySpec!.functions.length + index) * 80}ms` }"
                :aria-label="`Value: ${v.id}`"
              >
                <!-- Card header — Feature #84: pin button + relevance badge -->
                <div class="flex items-center gap-2 bg-emerald-50 px-4 py-2.5 border-b border-emerald-100">
                  <!-- Feature #11: PlanguageTerm tooltip for section header -->
                  <PlanguageTerm term="Value" class="text-xs font-bold tracking-wide text-emerald-600 uppercase" />
                  <span class="text-xs text-emerald-400">·</span>
                  <span class="text-xs font-mono text-emerald-700">{{ v.id }}</span>
                  <!-- Sharpening badge -->
                  <span
                    v-if="sharpenedEntryIds.includes(v.id)"
                    class="text-xs leading-none"
                    aria-label="Sharpened entry"
                    title="This entry was added or refined by a sharpening round"
                  >🔪</span>
                  <!-- Feature #178 — Stakeholder chip -->
                  <span
                    v-if="v.wishStakeholder"
                    class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none"
                    :class="[stakeholderPalette(v.wishStakeholder).bg, stakeholderPalette(v.wishStakeholder).text, stakeholderPalette(v.wishStakeholder).border]"
                    :aria-label="`Stakeholder: ${v.wishStakeholder}`"
                    :title="`Stakeholder: ${v.wishStakeholder}`"
                  >
                    <span aria-hidden="true" class="text-[8px]">●</span>
                    {{ v.wishStakeholder }}
                  </span>
                  <!-- Feature #84 — Relevance badge (shown when another entry is pinned) -->
                  <span
                    v-if="pinnedId && pinnedId !== v.id && relevanceMap[v.id] !== undefined"
                    class="ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="{
                      'bg-emerald-100 text-emerald-700': relevanceMap[v.id] >= 60,
                      'bg-amber-100 text-amber-700': relevanceMap[v.id] >= 30 && relevanceMap[v.id] < 60,
                      'bg-slate-100 text-slate-500': relevanceMap[v.id] < 30,
                    }"
                    :aria-label="`Relevance to pinned entry: ${relevanceMap[v.id]}%`"
                  >{{ relevanceMap[v.id] }}%</span>
                  <!-- Feature #84 — Pin button -->
                  <button
                    v-show="activeProfile === 'All'"
                    type="button"
                    :aria-label="pinnedId === v.id ? 'Unpin this entry' : 'Pin as north star metric'"
                    class="ml-auto h-8 w-8 flex items-center justify-center rounded-full text-sm transition-colors hover:bg-amber-100"
                    :class="pinnedId === v.id ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'"
                    @click.stop="pinEntry(v.id)"
                  >
                    <span aria-hidden="true">{{ pinnedId === v.id ? '⭐' : '☆' }}</span>
                  </button>
                  <!-- Feature #57b — per-entry rewrite pin -->
                  <button
                    type="button"
                    :aria-label="entryState(v.id).open ? 'Close rewrite panel' : 'Rewrite this entry'"
                    title="Rewrite this entry"
                    class="h-7 w-7 flex items-center justify-center rounded-full text-sm transition-colors hover:bg-emerald-100"
                    :class="entryState(v.id).open ? 'text-emerald-500 bg-emerald-100' : 'text-slate-300 hover:text-emerald-400'"
                    @click.stop="toggleEntryPin(v.id)"
                  ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-label="Edit this entry" /></button>
                </div>
                <div class="px-4 py-4 space-y-3">

                  <!-- Description — click to edit inline (Tom 2026-05-18) -->
                  <div v-if="entryState(v.id).editingDesc" class="space-y-1.5">
                    <textarea
                      :id="`desc-edit-${v.id}`"
                      v-model="entryState(v.id).editDescText"
                      rows="3"
                      class="w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-800 leading-relaxed
                             focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                      @keydown="onDescEditKeydown($event, v.id, 'V')"
                      @blur="saveDescEdit(v.id, 'V')"
                    />
                    <p class="text-[10px] text-slate-400">⌘↵ save · Esc cancel · click outside to save</p>
                  </div>
                  <p
                    v-else-if="v.description"
                    class="text-sm text-slate-800 leading-relaxed cursor-text hover:bg-emerald-50/60 rounded px-1 -mx-1 transition-colors"
                    title="Click to edit"
                    @click="startDescEdit(v.id, v.description)"
                  >{{ v.description }}</p>
                  <!-- Feature #57b — inline entry rewrite panel -->
                  <div v-if="entryState(v.id).open" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                    <div class="flex flex-wrap gap-1" role="group" aria-label="Rewrite style for this entry">
                      <button
                        v-for="m in SIMPLIFY_MODES"
                        :key="m.key"
                        type="button"
                        :title="m.hint"
                        :disabled="entryState(v.id).loading"
                        :class="[
                          'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all',
                          entryState(v.id).mode === m.key
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white border border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100',
                          entryState(v.id).loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                        ]"
                        @click="handleEntrySimplify(v.id, v.description ?? '', m.key)"
                      ><span>{{ m.emoji }}</span>{{ m.label }}</button>
                    </div>
                    <div v-if="entryState(v.id).loading" class="flex items-center gap-1.5">
                      <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600"/>
                      <span class="text-[10px] text-emerald-600">Rewriting…</span>
                    </div>
                    <div v-else-if="entryState(v.id).result" class="space-y-2">
                      <p class="text-xs text-slate-700 italic bg-white border border-emerald-100 rounded-md px-3 py-2 leading-relaxed">{{ entryState(v.id).result }}</p>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="min-h-[32px] px-3 text-[10px] font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          @click="acceptEntryRewrite(v.id, 'V')"
                        >✅ Accept</button>
                        <button
                          type="button"
                          class="min-h-[32px] px-3 text-[10px] font-medium rounded-lg bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                          @click="entryState(v.id).result = ''; entryState(v.id).accepted = false"
                        >↩ Change Back</button>
                        <button
                          v-if="entryState(v.id).accepted"
                          type="button"
                          class="min-h-[32px] px-3 text-[10px] font-medium rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                          @click="emit('rewrite-entry-fix', { id: v.id, type: 'V', description: entryState(v.id).result })"
                        >🔧 Fix in Spec</button>
                      </div>
                    </div>
                  </div>
                  <!-- Feature #65 — Complexity bar -->
                  <div
                    v-if="v.description"
                    class="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden"
                    :title="`Complexity: ${scoreSentenceComplexity(v.description)}/100`"
                    aria-hidden="true"
                  >
                    <div
                      class="h-full rounded-full transition-all duration-300"
                      :style="{
                        width: complexityBarWidth(scoreSentenceComplexity(v.description)),
                        backgroundColor: complexityColour(scoreSentenceComplexity(v.description)),
                      }"
                    />
                  </div>

                  <!-- Change 2 — Ambition Level chips (after description, before Scale) -->
                  <div
                    v-if="v.ambitionLevel && v.ambitionLevel.length > 0"
                    class="space-y-1"
                    aria-label="Ambition Level"
                  >
                    <p class="text-xs font-semibold text-slate-500">Ambition Level</p>
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="(al, ai) in v.ambitionLevel"
                        :key="ai"
                        class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                        :class="al.source === 'app'
                          ? 'bg-pink-100 text-pink-800 border border-pink-200'
                          : 'bg-violet-100 text-violet-800 border border-violet-200'"
                      >
                        <template v-if="al.source === 'app'">
                          <span aria-hidden="true">🚀</span>
                          {{ al.label }}
                        </template>
                        <template v-else>
                          <span aria-hidden="true">💬</span>
                          <span class="italic">"{{ al.text }}"</span>
                          <a
                            v-if="al.url"
                            :href="al.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="ml-1 underline text-violet-600 hover:text-violet-800"
                            :aria-label="`Source document for ambition level`"
                          >🔗</a>
                        </template>
                      </span>
                    </div>
                  </div>

                  <!-- Scale block — icon: 📐 -->
                  <div
                    v-if="v.scale"
                    class="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5"
                    :class="pulseStructured ? 'animate-pulse-once' : ''"
                  >
                    <div class="flex items-center gap-1.5 mb-1">
                      <span aria-hidden="true" class="text-sm">📐</span>
                      <!-- Feature #11: tooltip on Scale label -->
                      <PlanguageTerm term="Scale" class="text-xs font-semibold text-slate-600" />
                    </div>
                    <p class="text-sm text-slate-700">{{ v.scale }}</p>
                  </div>

                  <!-- Meter block — icon: 🔬 -->
                  <div
                    v-if="v.meter"
                    class="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5"
                    :class="pulseStructured ? 'animate-pulse-once' : ''"
                  >
                    <div class="flex items-center gap-1.5 mb-1">
                      <span aria-hidden="true" class="text-sm">🔬</span>
                      <!-- Feature #11: tooltip on Meter label -->
                      <PlanguageTerm term="Meter" class="text-xs font-semibold text-slate-600" />
                    </div>
                    <p class="text-sm text-slate-700">{{ v.meter }}</p>
                  </div>

                  <!-- Benchmark levels: Status 📍 / Tolerable 🟡 / Wish ⭐ -->
                  <!-- Wish = stakeholder's unconstrained aspiration (Planguage *244).       -->
                  <!-- It becomes a committed Goal only after feasibility/budget approval.   -->
                  <div
                    class="grid gap-2"
                    :class="[v.status && v.tolerable && v.goal ? 'grid-cols-3' : (v.status && v.goal ? 'grid-cols-2' : 'grid-cols-1')]"
                  >
                    <div
                      v-if="v.status"
                      class="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5"
                      :class="pulseStructured ? 'animate-pulse-once' : ''"
                    >
                      <div class="flex items-center gap-1.5 mb-1">
                        <span aria-hidden="true" class="text-sm">📍</span>
                        <PlanguageTerm term="Status" class="text-xs font-semibold text-red-700" />
                      </div>
                      <p class="text-sm text-red-800">{{ v.status }}</p>
                    </div>
                    <div
                      v-if="v.tolerable"
                      class="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5"
                      :class="pulseStructured ? 'animate-pulse-once' : ''"
                    >
                      <div class="flex items-center gap-1.5 mb-1">
                        <span aria-hidden="true" class="text-sm">🟡</span>
                        <PlanguageTerm term="Tolerable" class="text-xs font-semibold text-amber-700" />
                      </div>
                      <p class="text-sm text-amber-800">{{ v.tolerable }}</p>
                    </div>
                    <div
                      v-if="v.goal"
                      class="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2.5"
                      :class="pulseStructured ? 'animate-pulse-once' : ''"
                    >
                      <div class="flex items-center gap-1.5 mb-1">
                        <span aria-hidden="true" class="text-sm">⭐</span>
                        <PlanguageTerm term="Wish" class="text-xs font-semibold text-violet-700" />
                      </div>
                      <p class="text-sm text-violet-800">{{ v.goal }}</p>
                      <span class="inline-block mt-1 rounded-full bg-violet-100 text-violet-500 text-xs px-2 py-0.5">
                        not yet a committed Goal
                      </span>
                    </div>
                  </div>

                  <!-- Inline progress bar: Status → Tolerable → Wish -->
                  <ValueProgressBar
                    v-if="v.status && v.goal"
                    :status="v.status"
                    :tolerable="v.tolerable || ''"
                    :goal="v.goal"
                    class="mt-1"
                  />

                </div>
              </article>

              <!-- Solution cards — group header with copy+email -->
              <div
                v-if="displaySpec!.solutions.length > 0"
                class="flex items-center gap-2 rounded-t-xl bg-orange-600 px-4 py-2 -mb-3 mt-1"
              >
                <span class="text-[11px] font-bold text-white uppercase tracking-wide">S. Solutions</span>
                <span class="text-[10px] text-orange-200 ml-auto">{{ displaySpec!.solutions.length }} entries</span>
                <button type="button"
                  :title="copiedSection === 'solutions' ? 'Copied!' : 'Copy Solutions section as colored HTML table'"
                  :aria-label="copiedSection === 'solutions' ? 'Copied!' : 'Copy Solutions'"
                  class="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold transition-colors
                         border border-orange-400 bg-white/20 text-white hover:bg-white/40"
                  @click="copySection('solutions')"
                >
                  <span v-if="copiedSection === 'solutions'" class="font-bold text-xs">✓</span>
                  <CopyGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
                </button>
                <button type="button"
                  :title="emailedSection === 'solutions' ? 'Opening Mail…' : 'Email Solutions section — opens Mail.app pre-filled'"
                  :aria-label="emailedSection === 'solutions' ? 'Opening Mail…' : 'Email Solutions'"
                  class="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold transition-colors
                         border border-orange-400 bg-white/20 text-white hover:bg-white/40"
                  @click="emailSection('solutions')"
                >
                  <span v-if="emailedSection === 'solutions'" class="font-bold text-xs">✓</span>
                  <EmailGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
                </button>
              </div>
              <!-- Solution cards -->
              <article
                v-for="(s, index) in displaySpec!.solutions"
                :key="s.id"
                class="spec-entry-card rounded-xl border border-violet-100 bg-white shadow-sm overflow-hidden"
                :style="{ animationDelay: `${(displaySpec!.functions.length + displaySpec!.values.length + index) * 80}ms` }"
                :aria-label="`Solution: ${s.id}`"
              >
                <div class="flex items-center gap-2 bg-violet-50 px-4 py-2.5 border-b border-violet-100">
                  <!-- Feature #11: PlanguageTerm tooltip for section header -->
                  <PlanguageTerm term="Solution" class="text-xs font-bold tracking-wide text-violet-600 uppercase" />
                  <span class="text-xs text-violet-400">·</span>
                  <span class="text-xs font-mono text-violet-700">{{ s.id }}</span>
                  <!-- Sharpening badge -->
                  <span
                    v-if="sharpenedEntryIds.includes(s.id)"
                    class="text-xs leading-none"
                    aria-label="Sharpened entry"
                    title="This entry was added or refined by a sharpening round"
                  >🔪</span>
                  <!-- Feature #57b — per-entry rewrite pin -->
                  <button
                    type="button"
                    :aria-label="entryState(s.id).open ? 'Close rewrite panel' : 'Rewrite this entry'"
                    title="Rewrite this entry"
                    class="ml-auto h-7 w-7 flex items-center justify-center rounded-full text-sm transition-colors hover:bg-violet-100"
                    :class="entryState(s.id).open ? 'text-violet-500 bg-violet-100' : 'text-slate-300 hover:text-violet-400'"
                    @click.stop="toggleEntryPin(s.id)"
                  ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-label="Edit this entry" /></button>
                </div>
                <div class="px-4 py-4 space-y-3">
                  <!-- Description — click to edit inline (Tom 2026-05-18) -->
                  <div v-if="entryState(s.id).editingDesc" class="space-y-1.5">
                    <textarea
                      :id="`desc-edit-${s.id}`"
                      v-model="entryState(s.id).editDescText"
                      rows="3"
                      class="w-full rounded-md border border-violet-300 bg-white px-3 py-2 text-sm text-slate-800 leading-relaxed
                             focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                      @keydown="onDescEditKeydown($event, s.id, 'S')"
                      @blur="saveDescEdit(s.id, 'S')"
                    />
                    <p class="text-[10px] text-slate-400">⌘↵ save · Esc cancel · click outside to save</p>
                  </div>
                  <p
                    v-else
                    class="text-sm text-slate-800 leading-relaxed cursor-text hover:bg-violet-50/60 rounded px-1 -mx-1 transition-colors"
                    title="Click to edit"
                    @click="startDescEdit(s.id, s.description)"
                  >{{ s.description }}</p>
                  <!-- Feature #57b — inline entry rewrite panel -->
                  <div v-if="entryState(s.id).open" class="rounded-lg border border-violet-200 bg-violet-50 p-3 space-y-2">
                    <div class="flex flex-wrap gap-1" role="group" aria-label="Rewrite style for this entry">
                      <button
                        v-for="m in SIMPLIFY_MODES"
                        :key="m.key"
                        type="button"
                        :title="m.hint"
                        :disabled="entryState(s.id).loading"
                        :class="[
                          'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all',
                          entryState(s.id).mode === m.key
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-white border border-violet-200 text-violet-700 hover:border-violet-400 hover:bg-violet-100',
                          entryState(s.id).loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                        ]"
                        @click="handleEntrySimplify(s.id, s.description, m.key)"
                      ><span>{{ m.emoji }}</span>{{ m.label }}</button>
                    </div>
                    <div v-if="entryState(s.id).loading" class="flex items-center gap-1.5">
                      <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600"/>
                      <span class="text-[10px] text-violet-600">Rewriting…</span>
                    </div>
                    <div v-else-if="entryState(s.id).result" class="space-y-2">
                      <p class="text-xs text-slate-700 italic bg-white border border-violet-100 rounded-md px-3 py-2 leading-relaxed">{{ entryState(s.id).result }}</p>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="min-h-[32px] px-3 text-[10px] font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                          @click="acceptEntryRewrite(s.id, 'S')"
                        >✅ Accept</button>
                        <button
                          type="button"
                          class="min-h-[32px] px-3 text-[10px] font-medium rounded-lg bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors"
                          @click="entryState(s.id).result = ''; entryState(s.id).accepted = false"
                        >↩ Change Back</button>
                        <button
                          v-if="entryState(s.id).accepted"
                          type="button"
                          class="min-h-[32px] px-3 text-[10px] font-medium rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                          @click="emit('rewrite-entry-fix', { id: s.id, type: 'S', description: entryState(s.id).result })"
                        >🔧 Fix in Spec</button>
                      </div>
                    </div>
                  </div>
                  <!-- Feature #65 — Complexity bar -->
                  <div
                    class="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden"
                    :title="`Complexity: ${scoreSentenceComplexity(s.description)}/100`"
                    aria-hidden="true"
                  >
                    <div
                      class="h-full rounded-full transition-all duration-300"
                      :style="{
                        width: complexityBarWidth(scoreSentenceComplexity(s.description)),
                        backgroundColor: complexityColour(scoreSentenceComplexity(s.description)),
                      }"
                    />
                  </div>
                  <div v-if="s.impact" class="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p class="text-xs font-semibold text-slate-500 mb-1">Impact</p>
                    <p class="text-sm text-slate-700">{{ s.impact }}</p>
                  </div>
                </div>
              </article>

            <!-- DD-006: Binary Constraint cards — group header with copy+email -->
            <div
              v-if="(displaySpec!.constraints ?? []).length > 0"
              class="flex items-center gap-2 rounded-t-xl bg-red-700 px-4 py-2 -mb-3 mt-1"
            >
              <span class="text-[11px] font-bold text-white uppercase tracking-wide">C. Constraints</span>
              <span class="text-[10px] text-red-200 ml-auto">{{ (displaySpec!.constraints ?? []).length }} entries</span>
              <button type="button"
                :title="copiedSection === 'constraints' ? 'Copied!' : 'Copy Constraints section as colored HTML table'"
                :aria-label="copiedSection === 'constraints' ? 'Copied!' : 'Copy Constraints'"
                class="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold transition-colors
                       border border-red-400 bg-white/20 text-white hover:bg-white/40"
                @click="copySection('constraints')"
              >
                <span v-if="copiedSection === 'constraints'" class="font-bold text-xs">✓</span>
                <CopyGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
              </button>
              <button type="button"
                :title="emailedSection === 'constraints' ? 'Opening Mail…' : 'Email Constraints section — opens Mail.app pre-filled'"
                :aria-label="emailedSection === 'constraints' ? 'Opening Mail…' : 'Email Constraints'"
                class="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-semibold transition-colors
                       border border-red-400 bg-white/20 text-white hover:bg-white/40"
                @click="emailSection('constraints')"
              >
                <span v-if="emailedSection === 'constraints'" class="font-bold text-xs">✓</span>
                <EmailGlyph v-else size="compact" class="h-3.5 w-auto" aria-label="" />
              </button>
            </div>
            <!-- DD-006: Binary Constraint cards (C.) -->
            <article
              v-for="(c, index) in (displaySpec!.constraints ?? [])"
              :key="c.id"
              class="spec-entry-card rounded-xl border border-red-200 bg-white shadow-sm overflow-hidden"
              :style="{ animationDelay: `${(displaySpec!.functions.length + displaySpec!.values.length + displaySpec!.solutions.length + index) * 80}ms` }"
              :aria-label="`Constraint: ${c.id}`"
            >
              <div class="flex items-center gap-2 bg-red-50 px-4 py-2.5 border-b border-red-100">
                <PlanguageTerm term="Constraint" class="text-xs font-bold tracking-wide text-red-700 uppercase" />
                <span class="text-xs text-red-300">·</span>
                <span class="text-xs font-mono text-red-700">{{ c.id }}</span>
                <button
                  type="button"
                  title="Edit this constraint"
                  class="ml-auto h-7 w-7 flex items-center justify-center rounded-full text-sm transition-colors text-red-200 hover:text-red-500 hover:bg-red-100"
                  @click.stop="emit('open-editor', { tab: 'constraints', entryId: c.id })"
                ><EditGlyph size="compact" class="h-3 w-auto shrink-0" aria-label="Edit this entry" /></button>
              </div>
              <div class="px-4 py-4 space-y-3">
                <!-- Description IS the binary rule (Template_Write_Constraint.md standard) -->
                <div class="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
                  <p class="text-xs font-semibold text-red-600 mb-1 uppercase tracking-wide">Binary Rule</p>
                  <p class="text-sm text-red-900 font-medium leading-relaxed">{{ c.description }}</p>
                </div>
                <!-- Scope + Rationale shown when present -->
                <div v-if="c.scope" class="space-y-0.5">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Scope</p>
                  <p class="text-xs text-slate-600 leading-relaxed">{{ c.scope }}</p>
                </div>
                <div v-if="c.rationale" class="space-y-0.5">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Rationale</p>
                  <p class="text-xs text-slate-600 leading-relaxed italic">{{ c.rationale }}</p>
                </div>
                <div v-if="c.source" class="space-y-0.5">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Source</p>
                  <p class="text-xs text-slate-500 font-mono">{{ c.source }}</p>
                </div>
              </div>
            </article>

            </div><!-- end animationKey wrapper -->

            <!-- Copy+Email — whole spec — BOTTOM (Tom: "at both top and bottom of the listing") -->
            <div class="flex items-center gap-1.5 px-1 pt-1">
              <span class="text-[10px] text-slate-400 font-medium mr-1">Copy whole spec:</span>
              <button
                type="button"
                :title="copied ? 'Copied!' : 'Copy whole spec as colored HTML table'"
                :aria-label="copied ? 'Copied!' : 'Copy whole spec'"
                class="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors
                       border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300"
                :class="copied ? 'text-emerald-600' : 'text-teal-600/70 hover:text-teal-700'"
                @click="copyToClipboard"
              >
                <span v-if="copied" class="font-bold text-xs">✓</span>
                <CopyGlyph v-else size="compact" class="h-4 w-auto" aria-label="" />
              </button>
              <button
                type="button"
                :title="emailed ? 'Opening Mail…' : 'Email whole spec — opens Mail.app with spec pre-filled'"
                :aria-label="emailed ? 'Opening Mail…' : 'Email whole spec'"
                class="flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold transition-colors
                       border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300"
                :class="emailed ? 'text-emerald-600' : 'text-indigo-600/70 hover:text-indigo-700'"
                @click="emailSpec"
              >
                <span v-if="emailed" class="font-bold text-xs">✓</span>
                <EmailGlyph v-else size="compact" class="h-4 w-auto" aria-label="" />
              </button>
            </div>

            <!-- Feature #41 / #45 — Spec Quality Footer (redesigned)
                 Flesch Readability dropped — that metric was designed for journalism/fiction
                 and always scores 0 ("Very Hard") for technical specification language, which
                 is correct behaviour for Planguage but misleading to users.
                 Replaced with Planguage-native signals: F/V/S entry breakdown + measurability. -->
            <div
              class="flex items-center flex-wrap gap-x-3 gap-y-1 py-2 px-3
                     bg-gray-50 border-t border-gray-100 rounded-b-xl text-xs text-gray-500"
              aria-label="Spec quality stats"
            >
              <!-- F / V / S / C entry breakdown — replaces meaningless "N entries" -->
              <span class="font-medium text-gray-600 shrink-0">
                {{ specStats.fCount }}F · {{ specStats.vCount }}V · {{ specStats.sCount }}S<template v-if="(displaySpec?.constraints ?? []).length > 0"> · <span class="text-red-600">{{ (displaySpec?.constraints ?? []).length }}C</span></template>
              </span>

              <!-- Completeness % — fields filled vs expected -->
              <span
                class="shrink-0"
                :class="{
                  'text-emerald-600': specStats.completenessPercent >= 80,
                  'text-amber-600':   specStats.completenessPercent >= 60 && specStats.completenessPercent < 80,
                  'text-red-600':     specStats.completenessPercent < 60,
                }"
              >· {{ specStats.completenessPercent }}% complete</span>

              <!-- Measurability — V. entries with Scale + Meter + Goal all set.
                   This is the core Planguage quality signal: without all three
                   fields a Value cannot drive acceptance testing. -->
              <span
                v-if="specStats.vCount > 0"
                class="shrink-0"
                :class="{
                  'text-emerald-600': specStats.measurableValues === specStats.vCount,
                  'text-amber-600':   specStats.measurableValues > 0 && specStats.measurableValues < specStats.vCount,
                  'text-red-600':     specStats.measurableValues === 0,
                }"
                :title="`${specStats.measurableValues} of ${specStats.vCount} Value entries have Scale, Meter and Goal defined — these are testable`"
              >· 🎯 {{ specStats.measurableValues }}/{{ specStats.vCount }} measurable</span>

              <!-- Total word count -->
              <span class="shrink-0">· {{ totalWordCount }} words</span>

              <!-- Level badge — simplified: just badge + name, no XP bar or numbers -->
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ml-1"
                :class="{
                  'bg-slate-200 text-slate-700':   level.colour === 'slate',
                  'bg-amber-200 text-amber-800':   level.colour === 'amber',
                  'bg-emerald-200 text-emerald-800': level.colour === 'emerald',
                }"
                :title="`XP: ${xp} / ${maxXp}`"
              >{{ level.badge }} {{ level.name }}</span>

              <!-- Feature #92 — Anti-pattern violation badge -->
              <button
                v-show="fp('92')"
                type="button"
                aria-label="Open anti-pattern detector"
                class="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors shrink-0"
                :class="violationCount > 0
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'"
                @click="antiPatternsOpen = true; scanAntiPatterns()"
              >
                ⚠️ {{ violationCount }}
              </button>
            </div>

          </div>
        </Transition>
      </div>

      <!-- Feature #169 — MLP Identifier panel -->
      <div
        v-if="mlpOpen"
        class="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3"
        aria-label="Minimum lovable product identifier panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-teal-800">💎 Minimum Lovable Product</p>
          <CloseDot
        aria-label="Close MLP panel"
        @click="mlpOpen = false"
      />
        </div>

        <p v-if="mlpEntries.length === 0" class="text-xs text-teal-700 italic">No entries found. Generate a spec first.</p>

        <template v-else>
          <!-- Entry table -->
          <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
              <thead>
                <tr class="text-left text-slate-600 border-b border-teal-200">
                  <th class="py-1 pr-2 font-semibold">Entry</th>
                  <th class="py-1 pr-2 font-semibold">Type</th>
                  <th class="py-1 pr-2 font-semibold">Essentialness</th>
                  <th class="py-1 pr-2 font-semibold">Delight</th>
                  <th class="py-1 pr-2 font-semibold">Feasibility</th>
                  <th class="py-1 font-semibold">MLP Score</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="e in mlpEntries"
                  :key="e.id"
                  class="border-b border-teal-100 last:border-0"
                  :class="e.isTop ? 'bg-teal-50 border-l-4 border-teal-400' : ''"
                >
                  <td class="py-1.5 pr-2 font-mono text-slate-700">{{ e.label }}</td>
                  <td class="py-1.5 pr-2 text-slate-500">{{ e.type }}</td>
                  <td class="py-1.5 pr-2 text-slate-600">{{ e.essentialness }}</td>
                  <td class="py-1.5 pr-2 text-slate-600">{{ e.userDelight }}</td>
                  <td class="py-1.5 pr-2 text-slate-600">{{ e.feasibility }}</td>
                  <td class="py-1.5 font-semibold text-teal-800">{{ e.mlpScore }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Build This First banner -->
          <div
            v-if="mlpTopThree.length > 0"
            class="rounded-lg bg-emerald-100 border border-emerald-300 px-4 py-3"
          >
            <p class="text-xs font-semibold text-emerald-800 mb-1">🏆 Build This First</p>
            <p class="text-xs text-emerald-700">{{ mlpTopThree.map(e => e.id).join(' · ') }}</p>
          </div>

          <button
            type="button"
            aria-label="Copy MLP table to clipboard"
            class="h-11 px-4 text-sm rounded bg-teal-200 hover:bg-teal-300 text-teal-800 transition-colors"
            @click="mlpCopyMarkdown()"
          >{{ mlpCopied ? '✅ Copied!' : '📋 Copy Table' }}</button>
        </template>
      </div>

      <!-- Feature #170 — Value Chain panel -->
      <div
        v-if="vcOpen"
        class="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3"
        aria-label="Value chain visualiser panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-orange-800">⛓️ Value Chain</p>
          <CloseDot
        aria-label="Close value chain panel"
        @click="vcOpen = false"
      />
        </div>

        <!-- Placeholder when no functions defined -->
        <template v-if="vcPrimary.length === 0 && vcSupport.length === 0">
          <svg viewBox="0 0 580 240" width="580" height="240" aria-label="Value chain placeholder" class="overflow-visible">
            <rect x="10" y="10" width="560" height="220" rx="8" fill="#fff7ed" stroke="#fed7aa" stroke-width="1"/>
            <text x="290" y="125" text-anchor="middle" font-size="13" fill="#9a3412">Define Functions to generate value chain</text>
          </svg>
        </template>

        <!-- Porter-style SVG -->
        <template v-else>
          <svg viewBox="0 0 580 240" width="580" height="240" aria-label="Porter-style value chain diagram" class="overflow-visible max-w-full">
            <!-- Support activities — top half (blue-100 rects) -->
            <g>
              <template v-for="(act, i) in vcSupport" :key="act.id">
                <rect
                  :x="10 + i * 140"
                  y="10"
                  width="130"
                  height="100"
                  rx="6"
                  :fill="vcSelectedId === act.id ? '#bfdbfe' : '#dbeafe'"
                  :stroke="vcSelectedId === act.id ? '#f59e0b' : '#93c5fd'"
                  :stroke-width="vcSelectedId === act.id ? '2' : '1'"
                  class="cursor-pointer"
                  @click="vcSelect(act.id)"
                />
                <text :x="10 + i * 140 + 65" y="55" text-anchor="middle" font-size="9" fill="#1e3a8a" font-weight="600">{{ act.id.replace(/^.*\.([^.]+)$/, '$1').slice(0, 16) }}</text>
                <text :x="10 + i * 140 + 65" y="70" text-anchor="middle" font-size="8" fill="#3b82f6">{{ act.description.slice(0, 30) }}</text>
              </template>
            </g>
            <!-- Primary activities — bottom half (amber-100 chevron rects) -->
            <g>
              <template v-for="(act, i) in vcPrimary" :key="act.id">
                <rect
                  :x="10 + i * 93"
                  y="125"
                  width="87"
                  height="100"
                  rx="6"
                  :fill="vcSelectedId === act.id ? '#fde68a' : '#fef3c7'"
                  :stroke="vcSelectedId === act.id ? '#f59e0b' : '#fcd34d'"
                  :stroke-width="vcSelectedId === act.id ? '2' : '1'"
                  class="cursor-pointer"
                  @click="vcSelect(act.id)"
                />
                <text :x="10 + i * 93 + 43" y="173" text-anchor="middle" font-size="9" fill="#78350f" font-weight="600">{{ act.id.replace(/^.*\.([^.]+)$/, '$1').slice(0, 12) }}</text>
                <text :x="10 + i * 93 + 43" y="188" text-anchor="middle" font-size="7" fill="#92400e">{{ act.description.slice(0, 18) }}</text>
              </template>
            </g>
          </svg>

          <!-- Selected detail -->
          <p v-if="vcSelectedId" class="text-xs text-orange-700">
            <span class="font-semibold font-mono">{{ vcSelectedId }}</span>
            — {{ [...vcPrimary, ...vcSupport].find(a => a.id === vcSelectedId)?.description }}
          </p>

          <button
            type="button"
            aria-label="Copy value chain table to clipboard"
            class="h-11 px-4 text-sm rounded bg-orange-200 hover:bg-orange-300 text-orange-800 transition-colors"
            @click="vcCopyMarkdown()"
          >{{ vcCopied ? '✅ Copied!' : '📋 Copy Table' }}</button>
        </template>
      </div>

      <!-- Feature #171 — Investor FAQ panel -->
      <div
        v-if="faqOpen"
        class="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3"
        aria-label="Investor FAQ panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-violet-800">💼 Investor FAQ</p>
          <CloseDot
        aria-label="Close investor FAQ panel"
        @click="faqOpen = false"
      />
        </div>

        <!-- FAQ numbered card list -->
        <div class="space-y-3">
          <div
            v-for="(item, idx) in investorFaqs"
            :key="item.question"
            class="rounded-lg border-l-4 border-amber-400 bg-white px-4 py-3 shadow-sm"
          >
            <p class="text-xs font-semibold text-slate-800">{{ idx + 1 }}. {{ item.question }}</p>
            <p class="mt-1 text-xs text-gray-700">{{ item.answer }}</p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Copy investor FAQ to clipboard"
          class="h-11 px-4 text-sm rounded bg-violet-200 hover:bg-violet-300 text-violet-800 transition-colors"
          @click="faqCopyMarkdown()"
        >{{ faqCopied ? '✅ Copied!' : '📋 Copy FAQ' }}</button>
      </div>

      <!-- Feature #172 — WBS panel -->
      <div
        v-if="wbsOpen"
        class="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3"
        aria-label="Work breakdown structure panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-stone-700">📂 Work Breakdown Structure</p>
          <CloseDot
        aria-label="Close WBS panel"
        @click="wbsOpen = false"
      />
        </div>

        <p v-if="wbsNodes.length === 0" class="text-xs text-stone-500 italic">No F. entries found. Generate a spec first.</p>

        <!-- Per-F.-entry expandable cards -->
        <div
          v-for="node in wbsNodes"
          :key="node.fId"
          class="rounded-lg border border-stone-200 bg-white overflow-hidden"
        >
          <button
            type="button"
            :aria-label="`Toggle WBS for ${node.fId}`"
            class="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-stone-50 transition-colors"
            @click="wbsToggleExpand(node.fId)"
          >
            <span class="text-xs font-mono font-semibold text-stone-800">{{ node.fId }}</span>
            <span class="text-xs text-stone-400">{{ wbsExpandedIds.has(node.fId) ? '▲' : '▼' }}</span>
          </button>
          <div v-if="wbsExpandedIds.has(node.fId)" class="px-4 pb-3 space-y-1.5">
            <p class="text-xs text-stone-500 italic mb-2">{{ node.fLabel }}</p>
            <template v-for="sub in node.subTasks" :key="sub.label">
              <div class="text-xs pl-2">
                <span class="text-stone-700 font-medium">– {{ sub.label }}</span>
                <div class="pl-4 space-y-0.5 mt-0.5">
                  <p v-for="micro in sub.microTasks" :key="micro" class="text-stone-500">· {{ micro }}</p>
                </div>
              </div>
            </template>
          </div>
        </div>

        <button
          type="button"
          aria-label="Copy WBS to clipboard"
          class="h-11 px-4 text-sm rounded bg-stone-200 hover:bg-stone-300 text-stone-800 transition-colors"
          @click="wbsCopyMarkdown()"
        >{{ wbsCopied ? '✅ Copied!' : '📋 Copy WBS' }}</button>
      </div>

      <!-- Feature #174 — OKR Health Score panel -->
      <div
        v-if="okrHealthOpen"
        class="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 space-y-3"
        aria-label="OKR health score panel"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <p class="text-xs font-semibold text-cyan-800">🏥 OKR Health Score</p>
            <!-- Overall grade badge -->
            <span
              class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold"
              :class="{
                'bg-emerald-100 text-emerald-800': okrHealthOverallGrade === 'A',
                'bg-green-100 text-green-800': okrHealthOverallGrade === 'B',
                'bg-amber-100 text-amber-800': okrHealthOverallGrade === 'C',
                'bg-orange-100 text-orange-800': okrHealthOverallGrade === 'D',
                'bg-red-100 text-red-800': okrHealthOverallGrade === 'F',
              }"
            >{{ okrHealthOverallGrade }} — {{ okrHealthOverallScore }}</span>
          </div>
          <CloseDot
        aria-label="Close OKR health score panel"
        @click="okrHealthOpen = false"
      />
        </div>

        <p v-if="okrHealthEntries.length === 0" class="text-xs text-cyan-700 italic">No V. entries found. Generate a spec first.</p>

        <template v-else>
          <div class="space-y-2">
            <div
              v-for="e in okrHealthEntries"
              :key="e.id"
              class="rounded-lg border border-cyan-200 bg-white px-4 py-3 space-y-1.5"
            >
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-xs font-mono font-semibold text-slate-700">{{ e.id }}</span>
                <span
                  class="text-xs font-bold px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-emerald-100 text-emerald-800': e.grade === 'A',
                    'bg-green-100 text-green-800': e.grade === 'B',
                    'bg-amber-100 text-amber-800': e.grade === 'C',
                    'bg-orange-100 text-orange-800': e.grade === 'D',
                    'bg-red-100 text-red-800': e.grade === 'F',
                  }"
                >{{ e.grade }} {{ e.score }}</span>
              </div>
              <p class="text-xs text-slate-500 italic">{{ e.objective }}</p>
              <p class="text-xs text-slate-600"><span class="font-semibold">Key Result:</span> {{ e.keyResult }}</p>
              <div class="flex flex-wrap gap-1.5 mt-1">
                <span
                  class="text-xs px-2 py-0.5 rounded-full"
                  :class="e.measurability ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                >{{ e.measurability ? '✅' : '❌' }} Measurable</span>
                <span
                  class="text-xs px-2 py-0.5 rounded-full"
                  :class="e.ambition ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                >{{ e.ambition ? '✅' : '❌' }} Ambitious</span>
                <span
                  class="text-xs px-2 py-0.5 rounded-full"
                  :class="e.coverage ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                >{{ e.coverage ? '✅' : '❌' }} Covered</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Copy OKR health table to clipboard"
            class="h-11 px-4 text-sm rounded bg-cyan-200 hover:bg-cyan-300 text-cyan-800 transition-colors"
            @click="okrHealthCopyMarkdown()"
          >{{ okrHealthCopied ? '✅ Copied!' : '📋 Copy Table' }}</button>
        </template>
      </div>

      <!-- Feature #175 — Podcast Outline panel -->
      <div
        v-if="podcastOpen"
        class="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3"
        aria-label="Podcast episode outline panel"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <p class="text-xs font-semibold text-rose-800">🎙️ Podcast Episode Outline</p>
            <span class="text-xs bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full font-medium">~{{ podcastOutline.totalMins }} mins total</span>
          </div>
          <CloseDot
        aria-label="Close podcast outline panel"
        @click="podcastOpen = false"
      />
        </div>

        <p class="text-xs text-slate-600 italic">{{ podcastOutline.episodeTitle }}</p>

        <div class="space-y-2">
          <div
            v-for="(seg, idx) in podcastOutline.segments"
            :key="seg.act"
            class="rounded-lg border px-4 py-3 space-y-1.5"
            :class="{
              'border-sky-200 bg-sky-50': seg.act === 'Hook',
              'border-indigo-200 bg-indigo-50': seg.act === 'Body',
              'border-emerald-200 bg-emerald-50': seg.act === 'CTA',
            }"
          >
            <div class="flex items-center justify-between">
              <p
                class="text-xs font-semibold"
                :class="{
                  'text-sky-700': seg.act === 'Hook',
                  'text-indigo-700': seg.act === 'Body',
                  'text-emerald-700': seg.act === 'CTA',
                }"
              >Act {{ idx + 1 }}: {{ seg.act }} — {{ seg.title }}</p>
              <span class="text-xs text-slate-400">{{ seg.durationMins }} min</span>
            </div>
            <ul class="space-y-0.5">
              <li
                v-for="bullet in seg.bullets"
                :key="bullet"
                class="text-xs text-slate-600"
              >• {{ bullet }}</li>
            </ul>
          </div>
        </div>

        <button
          type="button"
          aria-label="Copy podcast outline to clipboard"
          class="h-11 px-4 text-sm rounded bg-rose-200 hover:bg-rose-300 text-rose-800 transition-colors"
          @click="podcastCopyMarkdown()"
        >{{ podcastCopied ? '✅ Copied!' : '📋 Copy Outline' }}</button>
      </div>

      <!-- Feature #177 — Accessibility Scorecard panel -->
      <div
        v-if="scorecardOpen"
        class="mt-4 rounded-xl border border-lime-200 bg-lime-50 p-4 space-y-3"
        aria-label="Accessibility scorecard panel"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <p class="text-xs font-semibold text-lime-800">♿ Accessibility Scorecard</p>
            <span
              class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold"
              :class="{
                'bg-emerald-100 text-emerald-800': scorecardOverallGrade === 'A',
                'bg-green-100 text-green-800': scorecardOverallGrade === 'B',
                'bg-amber-100 text-amber-800': scorecardOverallGrade === 'C',
                'bg-orange-100 text-orange-800': scorecardOverallGrade === 'D',
                'bg-red-100 text-red-800': scorecardOverallGrade === 'F',
              }"
            >{{ scorecardOverallGrade }} — {{ scorecardOverallScore }}/6</span>
          </div>
          <CloseDot
        aria-label="Close accessibility scorecard panel"
        @click="scorecardOpen = false"
      />
        </div>

        <p v-if="scorecardEntries.length === 0" class="text-xs text-lime-700 italic">No entries found. Generate a spec first.</p>

        <template v-else>
          <!-- Summary criterion pills -->
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="c in scorecardCriteria"
              :key="c.key"
              class="text-xs px-2 py-0.5 rounded-full font-medium"
              :class="{
                'bg-green-100 text-green-800': c.passRate >= 80,
                'bg-amber-100 text-amber-800': c.passRate >= 50 && c.passRate < 80,
                'bg-red-100 text-red-700': c.passRate < 50,
              }"
              :title="c.description"
            >{{ c.label }} {{ c.passRate }}%</span>
          </div>

          <!-- Entry list -->
          <div class="space-y-1.5">
            <div
              v-for="e in scorecardEntries"
              :key="e.id"
              class="rounded-lg border border-lime-200 bg-white px-4 py-2.5 space-y-1"
            >
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-mono font-semibold text-slate-700">{{ e.id }}</span>
                  <span class="text-xs text-slate-400">{{ e.entryType }}</span>
                </div>
                <span
                  class="text-xs font-bold px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-emerald-100 text-emerald-800': e.grade === 'A',
                    'bg-green-100 text-green-800': e.grade === 'B',
                    'bg-amber-100 text-amber-800': e.grade === 'C',
                    'bg-orange-100 text-orange-800': e.grade === 'D',
                    'bg-red-100 text-red-800': e.grade === 'F',
                  }"
                >{{ e.grade }} {{ e.totalScore }}/6</span>
              </div>
              <div class="flex flex-wrap gap-1">
                <span class="text-xs" :class="e.criteria.plainLanguage ? 'text-emerald-600' : 'text-red-500'">{{ e.criteria.plainLanguage ? '✅' : '❌' }} Plain</span>
                <span class="text-xs" :class="e.criteria.numericGoal ? 'text-emerald-600' : 'text-red-500'">{{ e.criteria.numericGoal ? '✅' : '❌' }} Numeric</span>
                <span class="text-xs" :class="e.criteria.stakeholderCoverage ? 'text-emerald-600' : 'text-red-500'">{{ e.criteria.stakeholderCoverage ? '✅' : '❌' }} Stakeholder</span>
                <span class="text-xs" :class="e.criteria.noPassiveVoice ? 'text-emerald-600' : 'text-red-500'">{{ e.criteria.noPassiveVoice ? '✅' : '❌' }} Active</span>
                <span class="text-xs" :class="e.criteria.unitsPresent ? 'text-emerald-600' : 'text-red-500'">{{ e.criteria.unitsPresent ? '✅' : '❌' }} Units</span>
                <span class="text-xs" :class="e.criteria.descLength ? 'text-emerald-600' : 'text-red-500'">{{ e.criteria.descLength ? '✅' : '❌' }} Length</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Copy accessibility scorecard to clipboard"
            class="h-11 px-4 text-sm rounded bg-lime-200 hover:bg-lime-300 text-lime-800 transition-colors"
            @click="scorecardCopyMarkdown()"
          >{{ scorecardCopied ? '✅ Copied!' : '📋 Copy Scorecard' }}</button>
        </template>
      </div>

      <!-- Feature #179 — Feature Readiness Level panel -->
      <div
        v-if="readinessOpen"
        class="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3"
        aria-label="Feature readiness level panel"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <p class="text-xs font-semibold text-purple-800">🚀 Feature Readiness Level</p>
            <span
              class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold"
              :class="{
                'bg-red-100 text-red-800': readinessStatus === 'Early',
                'bg-amber-100 text-amber-800': readinessStatus === 'Mid',
                'bg-emerald-100 text-emerald-800': readinessStatus === 'Advanced',
              }"
            >{{ readinessStatus }} — avg FRL {{ readinessAvgLevel }}</span>
          </div>
          <CloseDot
        aria-label="Close feature readiness level panel"
        @click="readinessOpen = false"
      />
        </div>

        <p v-if="readinessEntries.length === 0" class="text-xs text-purple-700 italic">No entries found. Generate a spec first.</p>

        <template v-else>
          <div class="space-y-1.5">
            <div
              v-for="e in readinessEntries"
              :key="e.id"
              class="rounded-lg border border-purple-200 bg-white px-4 py-2.5 space-y-1"
              :class="e.bgClass"
            >
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-mono font-semibold text-slate-700">{{ e.label }}</span>
                  <span
                    class="inline-flex items-center justify-center rounded-full w-6 h-6 text-xs font-bold ring-2 ring-current"
                    :class="e.colorClass"
                  >{{ e.level }}</span>
                </div>
              </div>
              <p class="text-xs text-slate-600">{{ e.description }}</p>
              <p class="text-xs italic" :class="e.colorClass">{{ e.levelDescription }}</p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Copy feature readiness level to clipboard"
            class="h-11 px-4 text-sm rounded bg-purple-200 hover:bg-purple-300 text-purple-800 transition-colors"
            @click="copyReadiness()"
          >{{ readinessCopied ? '✅ Copied!' : '📋 Copy Readiness' }}</button>
        </template>
      </div>

      <!-- Feature #181 — Outcome-Assumption Map panel -->
      <div
        v-if="outcomeOpen"
        class="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3"
        aria-label="Outcome-assumption map panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-indigo-800">🗺️ Outcome-Assumption Map</p>
          <CloseDot
        aria-label="Close outcome-assumption map panel"
        @click="outcomeOpen = false"
      />
        </div>

        <p v-if="outcomeEntries.length === 0" class="text-xs text-indigo-700 italic">No value entries found. Generate a spec first.</p>

        <template v-else>
          <!-- Category filter pills -->
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="cat in (['All', 'Functional', 'Emotional', 'Social'] as const)"
              :key="cat"
              type="button"
              class="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
              :class="outcomeCategory === cat
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'"
              @click="outcomeCategory = cat"
            >{{ cat }}</button>
          </div>

          <div class="space-y-1.5">
            <div
              v-for="e in outcomeFiltered"
              :key="e.id"
              class="rounded-lg border border-indigo-200 bg-white px-4 py-2.5 space-y-1"
            >
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-xs font-mono font-semibold text-slate-700">{{ e.id }}</span>
                <div class="flex items-center gap-1.5">
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700">{{ e.category }}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                    :class="{
                      'bg-emerald-100 text-emerald-700': e.validity === 'Validated',
                      'bg-amber-100 text-amber-700': e.validity === 'Assumed',
                      'bg-slate-100 text-slate-600': e.validity === 'Unknown',
                    }"
                  >{{ e.validity }}</span>
                  <span class="text-xs text-slate-500">imp. {{ e.importance }}/5</span>
                </div>
              </div>
              <p class="text-xs text-slate-600">{{ e.description }}</p>
              <div class="flex flex-col gap-0.5">
                <p class="text-xs text-indigo-600">↳ {{ e.assumptions[0] }}</p>
                <p class="text-xs text-indigo-600">↳ {{ e.assumptions[1] }}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Copy outcome-assumption map to clipboard"
            class="h-11 px-4 text-sm rounded bg-indigo-200 hover:bg-indigo-300 text-indigo-800 transition-colors"
            @click="copyOutcome()"
          >{{ outcomeCopied ? '✅ Copied!' : '📋 Copy Outcome Map' }}</button>
        </template>
      </div>

      <!-- Feature #182 — Tech Debt Register panel -->
      <div
        v-if="debtOpen"
        class="mt-4 rounded-xl border border-zinc-300 bg-zinc-50 p-4 space-y-3"
        aria-label="Tech debt register panel"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <p class="text-xs font-semibold text-zinc-800">💸 Tech Debt Register</p>
            <span
              class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold"
              :class="{
                'bg-red-100 text-red-800': debtHighCount > 0,
                'bg-amber-100 text-amber-800': debtHighCount === 0 && totalDebtScore > 0,
                'bg-emerald-100 text-emerald-800': totalDebtScore === 0,
              }"
            >Total {{ totalDebtScore }} — {{ debtHighCount }} High</span>
          </div>
          <CloseDot
        aria-label="Close tech debt register panel"
        @click="debtOpen = false"
      />
        </div>

        <p v-if="debtEntries.length === 0" class="text-xs text-zinc-600 italic">No solution entries found. Generate a spec first.</p>

        <template v-else>
          <div class="space-y-1.5">
            <div
              v-for="e in debtEntries"
              :key="e.id"
              class="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 space-y-1.5"
            >
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-xs font-mono font-semibold text-slate-700">{{ e.id }}</span>
                <div class="flex items-center gap-1.5">
                  <span
                    class="text-xs px-2 py-0.5 rounded-full font-bold"
                    :class="{
                      'bg-red-100 text-red-700': e.severity === 'High',
                      'bg-amber-100 text-amber-700': e.severity === 'Medium',
                      'bg-slate-100 text-slate-600': e.severity === 'Low',
                    }"
                  >{{ e.severity }}</span>
                  <span class="text-xs text-zinc-500 font-medium">{{ e.debtScore }} pts</span>
                </div>
              </div>
              <p class="text-xs text-slate-600">{{ e.description }}</p>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="pattern in e.detectedPatterns"
                  :key="pattern"
                  class="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700"
                >{{ pattern }}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Copy tech debt register to clipboard"
            class="h-11 px-4 text-sm rounded bg-zinc-200 hover:bg-zinc-300 text-zinc-800 transition-colors"
            @click="copyDebt()"
          >{{ debtCopied ? '✅ Copied!' : '📋 Copy Debt Register' }}</button>
        </template>
      </div>

      <!-- Feature #184 — Spec Drift Detector panel -->
      <div
        v-if="driftOpen"
        class="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3"
        aria-label="Specification drift detector panel"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <p class="text-xs font-semibold text-sky-800">📡 Specification Drift Detector</p>
            <span
              class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold"
              :class="{
                'bg-rose-100 text-rose-800': driftScore > 0,
                'bg-emerald-100 text-emerald-800': driftScore === 0,
              }"
            >📡 {{ driftScore }}% drift detected — {{ driftCount }} of {{ driftEntries.length }} V. entries need attention</span>
          </div>
          <CloseDot
        aria-label="Close specification drift detector panel"
        @click="driftOpen = false"
      />
        </div>

        <p v-if="driftEntries.length === 0" class="text-xs text-sky-600 italic">No value entries found. Generate a spec first.</p>

        <template v-else>
          <div class="space-y-1.5">
            <div
              v-for="e in driftEntries"
              :key="e.id"
              class="rounded-lg border border-sky-200 bg-white px-4 py-2.5 space-y-1.5"
            >
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-xs font-mono font-semibold text-slate-700">{{ e.id }}</span>
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-bold"
                  :class="{
                    'bg-rose-100 text-rose-700': e.severity === 'Critical',
                    'bg-amber-100 text-amber-700': e.severity === 'Warning',
                    'bg-emerald-100 text-emerald-700': e.severity === 'OK',
                  }"
                >{{ e.severity }}</span>
              </div>
              <p class="text-xs text-slate-600 italic">{{ e.driftType }}</p>
              <div class="flex gap-4 text-xs text-slate-500">
                <span>Goal: <strong>{{ e.goal || '—' }}</strong></span>
                <span>Tolerable: <strong>{{ e.tolerable || '—' }}</strong></span>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Copy drift report to clipboard"
            class="h-11 px-4 text-sm rounded bg-sky-200 hover:bg-sky-300 text-sky-900 transition-colors"
            @click="copyDrift()"
          >{{ driftCopied ? '✅ Copied!' : '📋 Copy Drift Report' }}</button>
        </template>
      </div>

      <!-- Feature #186 — User Story Priority Matrix panel -->
      <div
        v-if="priorityOpen"
        class="mt-4 rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4 space-y-3"
        aria-label="User story priority matrix panel"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-fuchsia-800">🎯 User Story Priority Matrix</p>
          <CloseDot
        aria-label="Close user story priority matrix panel"
        @click="priorityOpen = false"
      />
        </div>

        <p v-if="priorityEntries.length === 0" class="text-xs text-fuchsia-600 italic">No value entries found. Generate a spec first.</p>

        <template v-else>
          <!-- SVG 2×2 matrix -->
          <svg viewBox="0 0 400 300" class="w-full max-w-sm rounded border border-fuchsia-200 bg-white" aria-label="Priority matrix chart">
            <!-- Quadrant backgrounds -->
            <rect x="0" y="0" width="200" height="150" fill="#dbeafe" />
            <rect x="200" y="0" width="200" height="150" fill="#d1fae5" />
            <rect x="0" y="150" width="200" height="150" fill="#f3f4f6" />
            <rect x="200" y="150" width="200" height="150" fill="#fef3c7" />
            <!-- Dividers -->
            <line x1="200" y1="0" x2="200" y2="300" stroke="#e5e7eb" stroke-width="1" />
            <line x1="0" y1="150" x2="400" y2="150" stroke="#e5e7eb" stroke-width="1" />
            <!-- Quadrant labels -->
            <text x="100" y="24" text-anchor="middle" class="text-xs" font-size="13" fill="#1d4ed8" style="cursor:pointer" @click="priorityQuadrant = 'Plan'">📅 Plan</text>
            <text x="300" y="24" text-anchor="middle" class="text-xs" font-size="13" fill="#065f46" style="cursor:pointer" @click="priorityQuadrant = 'Do Now'">🚀 Do Now</text>
            <text x="100" y="174" text-anchor="middle" class="text-xs" font-size="13" fill="#6b7280" style="cursor:pointer" @click="priorityQuadrant = 'Drop'">🗑️ Drop</text>
            <text x="300" y="174" text-anchor="middle" class="text-xs" font-size="13" fill="#92400e" style="cursor:pointer" @click="priorityQuadrant = 'Maybe'">⚠️ Maybe</text>
            <!-- Axis labels -->
            <text x="200" y="294" text-anchor="middle" font-size="10" fill="#6b7280">Urgency →</text>
            <text x="10" y="150" text-anchor="middle" font-size="10" fill="#6b7280" transform="rotate(-90,10,150)">Impact →</text>
            <!-- Entry dots -->
            <circle
              v-for="e in priorityEntries"
              :key="e.id"
              :cx="e.urgency * 60"
              :cy="300 - e.impact * 60"
              r="8"
              :fill="e.quadrant === 'Do Now' ? '#10b981' : e.quadrant === 'Plan' ? '#3b82f6' : e.quadrant === 'Maybe' ? '#f59e0b' : '#9ca3af'"
              opacity="0.8"
            >
              <title>{{ e.id }}</title>
            </circle>
          </svg>

          <!-- Quadrant filter pills -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="q in (['All', 'Do Now', 'Plan', 'Maybe', 'Drop'] as const)"
              :key="q"
              type="button"
              class="h-8 px-3 text-xs rounded-full font-medium transition-colors"
              :class="{
                'bg-fuchsia-600 text-white': priorityQuadrant === q,
                'bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-200': priorityQuadrant !== q,
              }"
              @click="priorityQuadrant = q"
            >{{ q }}</button>
          </div>

          <!-- Filtered entry list -->
          <div class="space-y-1.5">
            <div
              v-for="e in priorityFiltered"
              :key="e.id"
              class="rounded-lg border border-fuchsia-200 bg-white px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap"
            >
              <span class="text-xs font-mono font-semibold text-slate-700">{{ e.id }}</span>
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <span>Urgency: <strong>{{ e.urgency }}</strong></span>
                <span>Impact: <strong>{{ e.impact }}</strong></span>
                <span
                  class="px-2 py-0.5 rounded-full font-bold"
                  :class="{
                    'bg-emerald-100 text-emerald-700': e.quadrant === 'Do Now',
                    'bg-blue-100 text-blue-700': e.quadrant === 'Plan',
                    'bg-amber-100 text-amber-700': e.quadrant === 'Maybe',
                    'bg-gray-100 text-gray-600': e.quadrant === 'Drop',
                  }"
                >{{ e.quadrant }}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Copy priority matrix to clipboard"
            class="h-11 px-4 text-sm rounded bg-fuchsia-200 hover:bg-fuchsia-300 text-fuchsia-900 transition-colors"
            @click="copyPriority()"
          >{{ priorityCopied ? '✅ Copied!' : '📋 Copy Priority Matrix' }}</button>
        </template>
      </div>

      <!-- Feature #187 — Feature Deprecation Radar panel -->
      <div
        v-if="deprecationOpen"
        class="mt-4 rounded-xl border border-gray-300 bg-gray-50 p-4 space-y-3"
        aria-label="Feature deprecation radar panel"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <p class="text-xs font-semibold text-gray-800">⚰️ Feature Deprecation Radar</p>
            <span
              class="inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold"
              :class="{
                'bg-red-100 text-red-800': deprecationHighRiskCount > 0,
                'bg-emerald-100 text-emerald-800': deprecationHighRiskCount === 0,
              }"
            >{{ deprecationHighRiskCount }} High Risk</span>
          </div>
          <CloseDot
        aria-label="Close feature deprecation radar panel"
        @click="deprecationOpen = false"
      />
        </div>

        <p v-if="deprecationEntries.length === 0" class="text-xs text-gray-600 italic">No function or solution entries found. Generate a spec first.</p>

        <template v-else>
          <div class="grid grid-cols-2 gap-3">
            <div
              v-for="e in deprecationEntries"
              :key="e.id"
              class="rounded-lg border border-gray-200 bg-white p-3 space-y-2"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-mono font-semibold text-slate-700">{{ e.id }}</span>
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-bold"
                  :class="{
                    'bg-red-100 text-red-700': e.riskLevel === 'High',
                    'bg-amber-100 text-amber-700': e.riskLevel === 'Medium',
                    'bg-slate-100 text-slate-600': e.riskLevel === 'Low',
                  }"
                >{{ e.riskLevel }}</span>
              </div>
              <p class="text-xs text-slate-500">{{ e.description }}</p>
              <!-- Mini radar SVG (80×80) -->
              <svg viewBox="-10 -10 100 100" width="80" height="80" aria-label="Mini deprecation radar" class="mx-auto">
                <polygon
                  :points="[0,1,2,3,4].map((i) => {
                    const angle = (i / 5) * 2 * Math.PI - Math.PI / 2
                    const val = [e.axes.age, e.axes.keywordRisk, e.axes.complexity, e.axes.coupling, e.axes.coverage][i]
                    const r = val * 0.01 * 40
                    return `${40 + r * Math.cos(angle)},${40 + r * Math.sin(angle)}`
                  }).join(' ')"
                  fill="rgba(239,68,68,0.25)"
                  stroke="#ef4444"
                  stroke-width="1.5"
                />
                <circle v-for="i in 5" :key="i" cx="40" cy="40" :r="i * 8" fill="none" stroke="#e5e7eb" stroke-width="0.5" />
              </svg>
              <!-- Axis scores -->
              <div class="text-xs text-slate-500 space-y-0.5">
                <div class="flex justify-between"><span>Age</span><strong>{{ e.axes.age }}</strong></div>
                <div class="flex justify-between"><span>KW Risk</span><strong>{{ e.axes.keywordRisk }}</strong></div>
                <div class="flex justify-between"><span>Complexity</span><strong>{{ e.axes.complexity }}</strong></div>
                <div class="flex justify-between"><span>Coupling</span><strong>{{ e.axes.coupling }}</strong></div>
                <div class="flex justify-between"><span>Coverage</span><strong>{{ e.axes.coverage }}</strong></div>
                <div class="flex justify-between border-t border-gray-200 pt-0.5"><span>Risk Score</span><strong>{{ e.riskScore }}</strong></div>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="Copy deprecation radar to clipboard"
            class="h-11 px-4 text-sm rounded bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors"
            @click="copyDeprecation()"
          >{{ deprecationCopied ? '✅ Copied!' : '📋 Copy Deprecation Radar' }}</button>
        </template>
      </div>

      <!-- Feature #189 — Learning Curve Estimator panel -->
      <div
        v-show="learningOpen"
        class="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3"
        aria-label="Learning curve estimator results"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-violet-800">📚 Learning Curve Estimator</p>
        </div>
        <template v-if="learningEntries.length === 0">
          <p class="text-sm text-violet-600">No function entries to analyse.</p>
        </template>
        <template v-else>
          <div class="rounded-lg bg-violet-100 px-4 py-2 text-sm font-medium text-violet-900">
            Average estimated learning time: <strong>{{ learningAvgHours }} hrs</strong>
          </div>
          <div class="space-y-2">
            <div
              v-for="e in learningEntries"
              :key="e.id"
              class="flex items-center gap-2 text-sm"
            >
              <span class="text-base">{{ e.stageEmoji }}</span>
              <span class="w-36 truncate font-mono text-xs text-violet-900">{{ e.id }}</span>
              <div class="flex-1 bg-violet-200 rounded h-2 overflow-hidden">
                <div
                  class="h-2 bg-violet-600 rounded"
                  :style="{ width: e.complexityScore + '%' }"
                />
              </div>
              <span
                class="text-xs px-1.5 py-0.5 rounded font-medium"
                :class="{
                  'bg-green-100 text-green-800': e.stage === 'Novice',
                  'bg-yellow-100 text-yellow-800': e.stage === 'Practitioner',
                  'bg-red-100 text-red-800': e.stage === 'Expert',
                }"
              >{{ e.stage }}</span>
              <span class="text-xs text-violet-700 w-14 text-right">{{ e.estimatedHours }} hrs</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Copy learning curve to clipboard"
            class="h-11 px-4 text-sm rounded bg-violet-200 hover:bg-violet-300 text-violet-900 transition-colors"
            @click="copyLearning()"
          >{{ learningCopied ? '✅ Copied!' : '📋 Copy Learning Curve' }}</button>
        </template>
      </div>

      <!-- Feature #191 — Value-Add Ratio Analyser panel -->
      <div
        v-show="vaRatioOpen"
        class="rounded-xl border border-lime-200 bg-lime-50 p-4 space-y-3"
        aria-label="Value-add ratio analyser results"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-lime-800">♻️ Value-Add Ratio Analyser</p>
        </div>
        <template v-if="vaEntries.length === 0">
          <p class="text-sm text-lime-600">No value entries to analyse.</p>
        </template>
        <template v-else>
          <div
            class="rounded-lg px-4 py-2 text-sm font-medium"
            :class="{
              'bg-emerald-100 text-emerald-900': overallVaRatio >= 70,
              'bg-amber-100 text-amber-900': overallVaRatio >= 50 && overallVaRatio < 70,
              'bg-rose-100 text-rose-900': overallVaRatio < 50,
            }"
          >
            Overall VA Ratio: <strong>{{ overallVaRatio }}%</strong>
          </div>
          <div class="space-y-2">
            <div
              v-for="e in vaEntries"
              :key="e.id"
              class="space-y-1"
            >
              <div class="flex items-center gap-2 text-sm">
                <span class="w-36 truncate font-mono text-xs text-lime-900">{{ e.id }}</span>
                <div class="flex-1 bg-lime-200 rounded h-2 overflow-hidden">
                  <div
                    class="h-2 bg-emerald-500 rounded"
                    :style="{ width: Math.min(100, Math.max(0, e.vaRatio)) + '%' }"
                  />
                </div>
                <span class="text-xs text-lime-700 w-10 text-right">{{ e.vaRatio }}%</span>
              </div>
              <div v-if="e.wasteCount > 0" class="flex flex-wrap gap-1 pl-38">
                <span
                  v-for="w in e.wasteSignals"
                  :key="w"
                  class="text-xs bg-amber-100 text-amber-800 rounded px-1.5 py-0.5"
                >{{ w }}</span>
              </div>
            </div>
          </div>
          <div v-if="topWastes.length > 0" class="text-xs text-lime-700">
            Top waste signals: <span class="font-medium">{{ topWastes.join(', ') }}</span>
          </div>
          <button
            type="button"
            aria-label="Copy value-add ratio to clipboard"
            class="h-11 px-4 text-sm rounded bg-lime-200 hover:bg-lime-300 text-lime-900 transition-colors"
            @click="copyVaRatio()"
          >{{ vaRatioCopied ? '✅ Copied!' : '📋 Copy VA Ratio Report' }}</button>
        </template>
      </div>

      <!-- Feature #192 — Impact-Gap Analyser panel -->
      <div
        v-show="gapOpen"
        class="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3"
        aria-label="Impact-gap analyser results"
      >
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-teal-800">📊 Impact-Gap Analyser</p>
        </div>
        <template v-if="gapEntries.length === 0">
          <p class="text-sm text-teal-600">No value entries to analyse.</p>
        </template>
        <template v-else>
          <div class="rounded-lg bg-teal-100 px-4 py-2 text-sm font-medium text-teal-900">
            📊 <strong>{{ gapLargeGapCount }}</strong> large gaps detected (&gt;50%)
          </div>
          <!-- SVG bar chart -->
          <svg
            :width="480"
            :height="Math.max(gapEntries.length * 28 + 60, 100)"
            class="w-full overflow-visible"
          >
            <text x="4" y="16" class="text-xs fill-teal-700" font-size="11">Gap Analysis — Goal vs Status</text>
            <g
              v-for="(e, i) in gapEntries"
              :key="e.id"
              :transform="`translate(0, ${i * 28 + 28})`"
            >
              <text x="4" y="14" font-size="10" :fill="e.isLargeGap ? '#f87171' : '#5eead4'">
                {{ e.id.slice(0, 15) }}
              </text>
              <rect
                x="120"
                y="4"
                :width="e.gapPct !== null ? Math.round(e.gapPct / 100 * 340) : 200"
                height="14"
                rx="3"
                :fill="e.isLargeGap ? '#f87171' : e.gapPct === null ? '#fde68a' : '#34d399'"
              />
              <text
                :x="120 + (e.gapPct !== null ? Math.round(e.gapPct / 100 * 340) : 200) + 6"
                y="14"
                font-size="10"
                fill="#0f766e"
              >
                {{ e.gapPct !== null ? e.gapPct + '%' : '?' }}
              </text>
            </g>
          </svg>
          <button
            type="button"
            aria-label="Copy gap analysis to clipboard"
            class="h-11 px-4 text-sm rounded bg-teal-200 hover:bg-teal-300 text-teal-900 transition-colors"
            @click="copyGap()"
          >{{ gapCopied ? '✅ Copied!' : '📋 Copy Gap Analysis' }}</button>
        </template>
      </div>

    </div>

    <!-- Feature Organisation Design — Command Palette (⌘F, alias ⌘K) -->
    <Teleport to="body">
      <Transition name="palette-fade">
        <div
          v-if="palette.isOpen.value"
          class="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          @click.self="palette.close()"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

          <!-- Panel -->
          <div class="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <!-- Search input -->
            <div class="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <span class="text-lg text-slate-400" aria-hidden="true">⌘</span>
              <input
                ref="paletteInput"
                v-model="palette.query.value"
                type="text"
                placeholder="Search features…"
                class="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                autocomplete="off"
                spellcheck="false"
                @keydown="palette.handleKey"
              />
              <kbd class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">Esc</kbd>
            </div>

            <!-- Results -->
            <ScrollContainer outer-class="relative" inner-style="max-height: 18rem" :no-pill="true">
            <ul class="py-2" role="listbox">
              <li
                v-for="(entry, idx) in palette.filtered.value"
                :key="entry.key"
                role="option"
                :aria-selected="idx === palette.selectedIndex.value"
                class="mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
                :class="idx === palette.selectedIndex.value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'"
                @click="entry.action(); palette.close()"
                @mouseenter="palette.selectedIndex.value = idx"
              >
                <span class="w-6 text-center text-base" aria-hidden="true">{{ entry.emoji }}</span>
                <span class="flex-1 font-medium">{{ entry.label }}</span>
                <span
                  v-for="prof in entry.profiles.slice(0,1)"
                  :key="prof"
                  class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  :class="idx === palette.selectedIndex.value
                    ? 'bg-blue-500 text-blue-100'
                    : 'bg-slate-100 text-slate-400'"
                >{{ prof }}</span>
              </li>
              <li
                v-if="palette.filtered.value.length === 0"
                class="px-5 py-4 text-sm text-slate-400 text-center"
              >
                No features match "{{ palette.query.value }}"
              </li>
            </ul>
            </ScrollContainer>

            <!-- Footer -->
            <div class="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              <span><kbd class="rounded border border-slate-200 px-1 py-0.5">↑↓</kbd> navigate</span>
              <span><kbd class="rounded border border-slate-200 px-1 py-0.5">↵</kbd> activate</span>
              <span><kbd class="rounded border border-slate-200 px-1 py-0.5">Esc</kbd> close</span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Feature #46 — Heat Lane overlay -->
    <SpecHeatLane
      v-if="heatLaneOpen"
      :spec="props.spec"
      :confirmed-steps="props.confirmedSteps"
      :on-close="() => { heatLaneOpen = false }"
    />
  <!-- Toast notification -->
  <Transition name="spec-toast">
    <div
      v-if="specToast"
      :key="specToast.id"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] rounded-full bg-slate-800 text-white text-xs px-4 py-2 shadow-lg pointer-events-none select-none"
      aria-live="polite"
    >{{ specToast.message }}</div>
  </Transition>
  </section>
</template>

<script setup lang="ts">
/**
 * SpecOutput — renders the generated Planguage spec as formatted cards.
 *
 * Accepts a SpecBlock object and renders Function (blue), Value (green),
 * and Solution (purple) cards with clean field labels.
 * Copy and Download actions export the serialised Markdown string.
 *
 * Before/After toggle: when a spec is generated, a toggle button appears at the
 * top-right. "← Raw input" shows the user's original Stakes/Ends/Means text in a
 * muted panel. "Spec →" returns to the structured spec view. Switching from Before
 * to After triggers a brief pulse animation on Scale, Meter, and Goal fields to
 * draw the eye to the added structure. Toggle resets to After on each new generation.
 *
 * Feature #1  — Live Streaming: shows streaming text + blinking cursor in loading state.
 * Feature #7  — Share Plan Link + QR Code: share button opens inline panel.
 * Feature #10 — Animated Spec Entry Build: each card slides up + fades in sequentially.
 * Feature #11 — "Explain This" Hover Tooltips: Planguage terms have plain-language tooltips.
 * Feature #13 — AI "Challenge This": challenge button analyses spec and returns improvements.
 * Feature #14 — Export to PDF: exports spec + evo steps to a jsPDF document.
 * Feature #19 — Make Ambitious: rewrites Goal levels to be ~2× more ambitious.
 * Feature #20 — Domain Auto-Detect Badge: detects planning domain from spec content.
 *
 * Preconditions: parent passes exactly one truthy state (loading / error / spec).
 * rawInput should be passed alongside spec once generation succeeds.
 */
import { ref, computed, watch, watchEffect, onMounted, onUnmounted, nextTick, reactive } from 'vue'
import { openEml } from '../composables/useEmlExport'
import CopyGlyph    from './icons/CopyGlyph.vue'
import PlTypeBadge  from './icons/PlTypeBadge.vue'
import EmailGlyph from './icons/EmailGlyph.vue'
// DD-001 (2026-05-13) — SaveGlyph (`*→[*]`) replaces 💾 for save-to-copy
// and save-to-file actions; GetGlyph (`[*]→*`) replaces 📥/📂 for input-side
// affordances (export-to-PDF is treated as save-out — outbound to user disk).
import SaveGlyph from './icons/SaveGlyph.vue'
import EditGlyph from './icons/EditGlyph.vue'
import type { SpecBlock } from '../types/spec'
import type { EvoStep } from '../types/evo-plan'
import { useSpecExport } from '../composables/useSpecExport'
import { useVoice } from '../composables/useVoice'
import { useDomainDetect } from '../composables/useDomainDetect'
import { useSharePlan } from '../composables/useSharePlan'
import { useChallenge } from '../composables/useChallenge'
import { usePdfExport } from '../composables/usePdfExport'
import { useAmbitious } from '../composables/useAmbitious'
import { useSpecQuality } from '../composables/useSpecQuality'
import { useOKRExport } from '../composables/useOKRExport'
import { useSpecDiff } from '../composables/useSpecDiff'
import type { FieldChange } from '../composables/useSpecDiff'
import { useLeanPlan } from '../composables/useLeanPlan'
import { useSpecFilter } from '../composables/useSpecFilter'
import { useNotionExport } from '../composables/useNotionExport'
import { useSpecAccessibility } from '../composables/useSpecAccessibility'
import type { AccessibilityIssue } from '../composables/useSpecAccessibility'
import { usePeerReview } from '../composables/usePeerReview'
import type { PeerReviewComment } from '../composables/usePeerReview'
import { useExecSummary } from '../composables/useExecSummary'
import { useSpecStats } from '../composables/useSpecStats'
import { useReadability } from '../composables/useReadability'
import { useGoalSensitivity } from '../composables/useGoalSensitivity'
import { useKaiCritique } from '../composables/useKaiCritique'
import { useSpecFork } from '../composables/useSpecFork'
import type { MergeConflict } from '../composables/useSpecFork'
import { useRegulationMap } from '../composables/useRegulationMap'
import type { RegMapping } from '../composables/useRegulationMap'
import { useTimeCapsule } from '../composables/useTimeCapsule'
import { useSpecSimplify, applySimplifiedToSpec, SIMPLIFY_MODES } from '../composables/useSpecSimplify'
import type { SimplifyMode } from '../composables/useSpecSimplify'
import { useSpecGapAnalyser } from '../composables/useSpecGapAnalyser'
import { useSpecGlossary } from '../composables/useSpecGlossary'
import { useSpecNarrative } from '../composables/useSpecNarrative'
import { useShipChecklist } from '../composables/useShipChecklist'
import { useSpecChangelog } from '../composables/useSpecChangelog'
import { useSpecTranslate } from '../composables/useSpecTranslate'
import { useRiceScore } from '../composables/useRiceScore'
import { useInterviewGuide } from '../composables/useInterviewGuide'
import { useComplianceHeatmap } from '../composables/useComplianceHeatmap'
import { useSpecConfidence } from '../composables/useSpecConfidence'
import { useSpecHealthReport } from '../composables/useSpecHealthReport'
import { useDepGraph } from '../composables/useDepGraph'
import { useDebateMode } from '../composables/useDebateMode'
import { useElevatorPitch } from '../composables/useElevatorPitch'
import { useNorthStar } from '../composables/useNorthStar'
import { usePersonaChallenge } from '../composables/usePersonaChallenge'
import { useAssumptionsRegister } from '../composables/useAssumptionsRegister'
import { useAutoImprove } from '../composables/useAutoImprove'
import { useSpecTweet } from '../composables/useSpecTweet'
import { useAntiPatterns } from '../composables/useAntiPatterns'
import { scoreSentenceComplexity, complexityColour, complexityBarWidth, countSpecWords } from '../utils/sentenceComplexity'
import ScrollContainer from './ScrollContainer.vue'
import CloseDot from './CloseDot.vue'
import PlanguageTerm from './PlanguageTerm.vue'
import StakeholderSignOff from './StakeholderSignOff.vue'
import SpecHeatLane from './SpecHeatLane.vue'
import ValueProgressBar from './ValueProgressBar.vue'
import SpecDepGraph from './SpecDepGraph.vue'
// ── Feature #94 — Spec Contract Mode ─────────────────────────────────────────
import { useSpecContract } from '../composables/useSpecContract'
// ── Feature #96 — Spec Story Map ─────────────────────────────────────────────
import { useStoryMap } from '../composables/useStoryMap'
import SpecStoryMap from './SpecStoryMap.vue'
// ── Feature #97 — Spec Energy Tracker ────────────────────────────────────────
import { useEnergyTracker } from '../composables/useEnergyTracker'
import { useToast } from '../composables/useToast'
import type { EnergyLevel } from '../composables/useEnergyTracker'
// ── Feature #99 — Spec Battle Card ───────────────────────────────────────────
import { useSpecBattleCard } from '../composables/useSpecBattleCard'
// ── Feature #100 — Market Size ───────────────────────────────────────────────
import { useMarketSize } from '../composables/useMarketSize'
// ── Feature #102 — OKR Crosswalk ─────────────────────────────────────────────
import { useOkrCrosswalk } from '../composables/useOkrCrosswalk'
// ── Feature #103 — Resilience Checker ────────────────────────────────────────
import { useResilienceChecker } from '../composables/useResilienceChecker'
// ── Feature #104 — Goal Ladder ───────────────────────────────────────────────
import { useGoalLadder } from '../composables/useGoalLadder'
// ── Feature #105 — Spec Benchmark ────────────────────────────────────────────
import { useSpecBenchmark } from '../composables/useSpecBenchmark'
// ── Feature #107 — Spec Gamification ─────────────────────────────────────────
import { useSpecGamification } from '../composables/useSpecGamification'
// ── Feature #108 — Decision Log ──────────────────────────────────────────────
import { useDecisionLog } from '../composables/useDecisionLog'
// ── Feature #109 — Impact Map ────────────────────────────────────────────────
import SpecImpactMap from './SpecImpactMap.vue'
// ── Feature #110 — Feature Flags ─────────────────────────────────────────────
import { useFeatureFlags } from '../composables/useFeatureFlags'
// ── Feature #111 — INVEST Checker ────────────────────────────────────────────
import { useInvestChecker } from '../composables/useInvestChecker'
// ── Feature #112 — ROI Calculator ────────────────────────────────────────────
import { useRoiCalculator } from '../composables/useRoiCalculator'
// ── Feature #114 — Velocity Tracker ──────────────────────────────────────────
import { useVelocityTracker } from '../composables/useVelocityTracker'
// ── Feature #115 — TOGAF View ─────────────────────────────────────────────────
import SpecTogafView from './SpecTogafView.vue'
// ── Feature #117 — Cost of Quality ───────────────────────────────────────────
import { useCostOfQuality } from '../composables/useCostOfQuality'
// ── Feature #118 — Spec Sentiment ────────────────────────────────────────────
import { useSpecSentiment } from '../composables/useSpecSentiment'
// ── Feature #119 — Critical Path ─────────────────────────────────────────────
import { useCriticalPath } from '../composables/useCriticalPath'
// ── Feature #120 — Press Release ─────────────────────────────────────────────
import { usePressRelease } from '../composables/usePressRelease'
// ── Feature #122 — Constraint Mapper ─────────────────────────────────────────
import { useConstraintMapper } from '../composables/useConstraintMapper'
// ── Feature #123 — Value Stream ───────────────────────────────────────────────
import { useValueStream } from '../composables/useValueStream'
import SpecValueStream from './SpecValueStream.vue'
// ── Feature #124 — Hypothesis Cards ──────────────────────────────────────────
import { useHypothesisCards } from '../composables/useHypothesisCards'
// ── Feature #126 — Regulatory Impact ─────────────────────────────────────────
import { useRegulatoryImpact } from '../composables/useRegulatoryImpact'
import type { Regulation } from '../composables/useRegulatoryImpact'
// ── Feature #126b — Regulatory Scanner ────────────────────────────────────────
import { useRegulatoryScanner } from '../composables/useRegulatoryScanner'
// ── Feature #127 — Job Description ───────────────────────────────────────────
import { useJobDescription } from '../composables/useJobDescription'
// ── Feature #129 — Innovation Score ──────────────────────────────────────────
import { useInnovationScore } from '../composables/useInnovationScore'
// ── Feature #131 — Competitor Matrix ─────────────────────────────────────────
import { useCompetitorMatrix } from '../composables/useCompetitorMatrix'
// ── Feature #132 — RFC Formatter ─────────────────────────────────────────────
import { useRfcFormatter } from '../composables/useRfcFormatter'
// ── Feature #134 — Tech Radar ─────────────────────────────────────────────────
import { useTechRadar } from '../composables/useTechRadar'
import type { RadarRing } from '../composables/useTechRadar'
import SpecTechRadar from './SpecTechRadar.vue'
// ── Feature #136 — SLA Generator ──────────────────────────────────────────────
import { useSlaGenerator } from '../composables/useSlaGenerator'
import type { SlaClause } from '../composables/useSlaGenerator'
// ── Feature #137 — Pitch Deck ─────────────────────────────────────────────────
import { usePitchDeck } from '../composables/usePitchDeck'
// ── Feature #139 — User Journey Mapper ───────────────────────────────────────
import { useUserJourney } from '../composables/useUserJourney'
import SpecUserJourney from './SpecUserJourney.vue'
// ── Feature #141 — Delphi Estimation ─────────────────────────────────────────
import { useDelphiEstimation } from '../composables/useDelphiEstimation'
// ── Feature #142 — Marketing One-Pager ───────────────────────────────────────
import { useMarketingOnePager } from '../composables/useMarketingOnePager'
// ── Feature #144 — Feature Flag Rollout ──────────────────────────────────────
import { useFeatureFlagRollout } from '../composables/useFeatureFlagRollout'
// ── Feature #146 — Chaos Engineering ─────────────────────────────────────────
import { useChaosEngineering } from '../composables/useChaosEngineering'
// ── Feature #147 — SWOT Analysis ─────────────────────────────────────────────
import { useSwotAnalysis } from '../composables/useSwotAnalysis'
// ── Feature #149 — Empathy Map ────────────────────────────────────────────────
import { useEmpathyMap } from '../composables/useEmpathyMap'
// ── Feature #151 — NPS Predictor ─────────────────────────────────────────────
import { useNpsPredictor } from '../composables/useNpsPredictor'
// ── Feature #152 — Changelog Entry ───────────────────────────────────────────
import { useChangelogEntry } from '../composables/useChangelogEntry'
// ── Feature #154 — Impact-Complexity Scatter ─────────────────────────────────
import { useImpactComplexity } from '../composables/useImpactComplexity'
// ── Feature #156 — Jobs to be Done Canvas ─────────────────────────────────────
import { useJtbd } from '../composables/useJtbd'
// ── Feature #157 — Spec as API Contract ───────────────────────────────────────
import { useApiContract } from '../composables/useApiContract'
import { useExperimentMapper } from '../composables/useExperimentMapper'
import { useValueDecay } from '../composables/useValueDecay'
import { usePressKit } from '../composables/usePressKit'
// ── Feature #164 — Risk-Adjusted Value ────────────────────────────────────────
import { useRiskValue } from '../composables/useRiskValue'
// ── Feature #166 — Personas Gallery ──────────────────────────────────────────
import { usePersonasGallery } from '../composables/usePersonasGallery'
// ── Feature #167 — Sprint Backlog ─────────────────────────────────────────────
import { useSprintBacklog } from '../composables/useSprintBacklog'

// ── Feature #169 — MLP Identifier ─────────────────────────────────────────────
import { useMinLovable } from '../composables/useMinLovable'

// ── Feature #170 — Value Chain ─────────────────────────────────────────────────
import { useValueChain } from '../composables/useValueChain'

// ── Feature #171 — Investor FAQ ────────────────────────────────────────────────
import { useInvestorFaq } from '../composables/useInvestorFaq'

// ── Feature #172 — WBS ────────────────────────────────────────────────────────
import { useWbs } from '../composables/useWbs'

// ── Feature #174 — OKR Health Score ───────────────────────────────────────────
import { useOkrHealthScore } from '../composables/useOkrHealthScore'

// ── Feature #175 — Podcast Outline ────────────────────────────────────────────
import { usePodcastOutline } from '../composables/usePodcastOutline'

// ── Feature #177 — Accessibility Scorecard ────────────────────────────────────
import { useAccessibilityScorecard } from '../composables/useAccessibilityScorecard'
// ── Feature #179 — Feature Readiness Level ────────────────────────────────────
import { useFeatureReadiness } from '../composables/useFeatureReadiness'
// ── Feature #181 — Outcome-Assumption Map ─────────────────────────────────────
import { useOutcomeMap } from '../composables/useOutcomeMap'
// ── Feature #182 — Tech Debt Register ─────────────────────────────────────────
import { useTechDebt } from '../composables/useTechDebt'
// ── Feature #184 — Spec Drift Detector ────────────────────────────────────────
import { useSpecDrift } from '../composables/useSpecDrift'
// ── Feature #186 — User Story Priority Matrix ─────────────────────────────────
import { usePriorityMatrix } from '../composables/usePriorityMatrix'
// ── Feature #187 — Feature Deprecation Radar ──────────────────────────────────
import { useDeprecationRadar } from '../composables/useDeprecationRadar'
// ── Feature #189 — Learning Curve Estimator ───────────────────────────────────
import { useLearningCurve } from '../composables/useLearningCurve'
// ── Feature #191 — Value-Add Ratio Analyser ───────────────────────────────────
import { useValueAddRatio } from '../composables/useValueAddRatio'
// ── Feature #192 — Impact-Gap Analyser ────────────────────────────────────────
import { useGapAnalysis } from '../composables/useGapAnalysis'
// ── Feature Organisation Design — Profile Pills + Suggestions + Palette ───────
import { useFeatureSuggestions } from '../composables/useFeatureSuggestions'
import { useCommandPalette } from '../composables/useCommandPalette'

const emit = defineEmits<{
  /** Feature #28 — emitted when the user clicks "Use Lean Plan" */
  (e: 'lean-spec-selected', spec: SpecBlock): void
  /** Evo Step 13 — emitted when the user clicks the 🤝 Collaborator button */
  (e: 'open-collaborator'): void
  /** Feature #57b — whole-spec rewrite saved as a new copy version (original untouched) */
  (e: 'rewrite-copy', spec: SpecBlock): void
  /** Feature #57b — whole-spec rewrite replaces the master (App saves old first) */
  (e: 'rewrite-replace', spec: SpecBlock): void
  /** Feature #57b — single entry rewrite accepted */
  (e: 'rewrite-entry', payload: { id: string; type: 'F' | 'V' | 'S'; description: string }): void
  /** Feature #57b — single entry accepted, user wants to also fix it in the underlying spec */
  (e: 'rewrite-entry-fix', payload: { id: string; type: 'F' | 'V' | 'S'; description: string }): void
  /** Feature #198 — open the Spec Editor at a given tab / entry */
  (e: 'open-editor', payload: { tab?: 'functions' | 'values' | 'solutions' | 'constraints'; entryId?: string }): void
  /** Open the "About the Edit Glyph" info modal */
  (e: 'open-edit-info'): void
}>()

const props = withDefaults(defineProps<{
  spec: SpecBlock | null
  loading?: boolean
  error?: string
  markdown?: string
  /** Raw SEM input captured at submission time — shown in the Before view */
  rawInput?: { stakes: string; ends: string; means: string } | null
  /** Feature #1 — streaming text accumulator from translateStream */
  streamingText?: string
  /** Feature #7 #14 — confirmed Evo steps for sharing and PDF export */
  confirmedSteps?: EvoStep[]
  /** Feature #13 — API key for challenge call (omit to use mock mode) */
  apiKey?: string
  /** Feature #19 — callback when a new ambitious spec is generated */
  onAmbitiousSpec?: (s: SpecBlock) => void
  /** Feature #26 — previous spec snapshot for diff view */
  previousSpec?: SpecBlock | null
  /** Sharpening Cycles — IDs of entries added/modified by sharpening rounds; shows 🔪 badge */
  sharpenedEntryIds?: string[]
  /**
   * Sharpening summary — single object shown as one line above the spec header.
   * totalChanges = sum of all entry changes across all sharpen rounds.
   * at = Date the last sharpen completed (null if not yet known).
   * Pass null when no sharpening has been applied.
   */
  sharpenSummary?: { totalChanges: number; at: Date | null } | null
  /** Feature #177 — When the spec was generated; shown as a timestamp in the header */
  generatedAt?: Date | null
}>(), {
  loading: false,
  error: '',
  markdown: '',
  streamingText: '',
  confirmedSteps: () => [],
  previousSpec: null,
  sharpenedEntryIds: () => [],
  sharpenSummary: null,
  generatedAt: null,
})

const { serialise } = useSpecExport()

// ── Feature #177 — Generated-at timestamp ─────────────────────────────────────
/** Format a Date as "7 May 2026 · 14:32" for the spec header. */
function _formatTimestamp(d: Date): string {
  const day   = d.getDate()
  const month = d.toLocaleString('en', { month: 'short' })
  const year  = d.getFullYear()
  const hh    = String(d.getHours()).padStart(2, '0')
  const mm    = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${year} · ${hh}:${mm}`
}
const copied  = ref(false)
const emailed = ref(false)   // Universal copy/email rule — 2026-05-29

// Per-section copy/email state — tracks which section was most recently copied/emailed
const copiedSection  = ref<string | null>(null)
const emailedSection = ref<string | null>(null)

// ── Error display helpers ─────────────────────────────────────────────────────
// Reset dismiss flag whenever a new error arrives so it surfaces again.
const errorDismissed = ref(false)
watch(() => props.error, () => { errorDismissed.value = false })

// Extract the billing URL if present in the error string so we can render it
// as a proper clickable link rather than raw text.
const BILLING_URL = 'https://console.anthropic.com/settings/billing'
const errorDisplay = computed(() => props.error.replace(BILLING_URL, '').trim().replace(/\s*\(?\s*$/, ''))
const errorLink    = computed(() => props.error.includes(BILLING_URL) ? BILLING_URL : null)

// ── Loading elapsed timer + estimated progress ────────────────────────────────
// Spec generation baseline: ~45s. Bar caps at 88% until the call resolves.
const loadingElapsed = ref(0)
let _loadingTimer: ReturnType<typeof setInterval> | null = null
watch(() => props.loading, (isLoading) => {
  if (isLoading) {
    loadingElapsed.value = 0
    _loadingTimer = setInterval(() => { loadingElapsed.value++ }, 1000)
  } else {
    if (_loadingTimer !== null) { clearInterval(_loadingTimer); _loadingTimer = null }
    loadingElapsed.value = 0
  }
})
const loadingEstPct = computed(() => Math.min(88, Math.round((loadingElapsed.value / 45) * 88)))

onUnmounted(() => {
  if (_loadingTimer !== null) clearInterval(_loadingTimer)
})

// ── Feature Organisation Design — Profile Pills ───────────────────────────────
/** Profile membership: feature-number string → profile name(s) */
const PROFILE_MAP: Record<string, string[]> = {
  '19': ['Tuning'],       '28': ['Tuning'],        '42': ['Tuning'],
  '57': ['Tuning'],       '72': ['Tuning','Finance'],'78': ['Tuning'],
  '88': ['Tuning'],       '105':['Tuning'],         '111':['Tuning','Quality'],
  '112':['Finance','Tuning'],'151':['Tuning'],      '161':['Tuning'],
  '191':['Tuning'],       '192':['Tuning'],
  '46': ['Visualizing'],  '80': ['Visualizing'],    '96': ['Visualizing'],
  '104':['Visualizing'],  '109':['Visualizing'],    '115':['Visualizing'],
  '123':['Visualizing'],  '134':['Visualizing'],    '139':['Visualizing'],
  '147':['Visualizing'],  '149':['Visualizing'],    '154':['Visualizing'],
  '170':['Visualizing'],  '181':['Visualizing'],
  '100':['Finance'],      '117':['Finance'],        '136':['Finance'],
  '137':['Finance'],      '164':['Finance'],        '171':['Finance'],
  '119':['Timing'],       '141':['Timing'],         '167':['Timing'],
  '172':['Timing'],       '179':['Timing'],
  '38': ['Quality'],      '43': ['Quality'],        '48': ['Quality'],
  '60': ['Quality'],      '62': ['Quality'],        '76': ['Quality'],
  '79': ['Quality'],      '87': ['Quality'],        '92': ['Quality'],
  '103':['Quality'],      '118':['Quality'],        '126':['Quality'],
  '129':['Quality'],      '169':['Quality','Tuning'],'174':['Quality'],
  '177':['Quality'],      '182':['Quality','Timing'],'184':['Quality'],
  '186':['Quality'],      '187':['Quality'],        '189':['Quality'],
}

const PROFILE_NAMES = ['All', 'Tuning', 'Visualizing', 'Finance', 'Timing', 'Quality'] as const
type ProfileName = (typeof PROFILE_NAMES)[number]

const PROFILE_EMOJIS: Record<ProfileName, string> = {
  All: '⚡', Tuning: '🎯', Visualizing: '👁️', Finance: '💰', Timing: '⏱️', Quality: '🛡️',
}

const activeProfile = ref<ProfileName>(
  (localStorage.getItem('sem-active-profile') as ProfileName) ?? 'All',
)

watch(activeProfile, v => localStorage.setItem('sem-active-profile', v))

/** Used in template as `fp('42')` — returns true when button should be visible.
 *  Features not in PROFILE_MAP have no profile restriction and are always visible. */
function fp(featureKey: string): boolean {
  if (activeProfile.value === 'All') return true
  const profileList = PROFILE_MAP[featureKey]
  if (!profileList) return true   // not profile-restricted → show for all profiles
  return profileList.includes(activeProfile.value)
}

const { isSpeaking, ttsSupported, speak, stopSpeaking } = useVoice()
const { detectDomain } = useDomainDetect()

// ── Feature #7 — Share plan ──────────────────────────────────────────────────
const { encodeState, qrUrl } = useSharePlan()
const shareOpen = ref(false)
const shareCopied = ref(false)

const planUrl = computed(() => {
  if (!props.spec) return ''
  return encodeState(props.spec, props.confirmedSteps)
})

const qrCodeUrl = computed(() => qrUrl(planUrl.value))

function toggleShare(): void {
  shareOpen.value = !shareOpen.value
}

async function copyShareUrl(): Promise<void> {
  try {
    await navigator.clipboard.writeText(planUrl.value)
    shareCopied.value = true
    setTimeout(() => { shareCopied.value = false }, 2000)
  } catch {
    // clipboard not available
  }
}

// ── Feature #13 — Challenge ──────────────────────────────────────────────────
const {
  loading: challengeLoading,
  challenges: challengeList,
  error: challengeError,
  challengeSpec,
} = useChallenge(props.apiKey)

const challengeOpen = ref(false)

async function handleChallenge(): Promise<void> {
  if (!props.spec) return
  challengeOpen.value = true
  await challengeSpec(props.spec)
}

// ── Feature #14 — PDF export ─────────────────────────────────────────────────
const { exportToPdf } = usePdfExport()

function handleExportPdf(): void {
  if (!props.spec) return
  exportToPdf(props.spec, props.confirmedSteps)
}

// ── Feature #19 — Make Ambitious ─────────────────────────────────────────────
const {
  loading: ambitiousLoading,
  error: ambitiousError,
  makeAmbitious,
} = useAmbitious(props.apiKey)

async function handleMakeAmbitious(): Promise<void> {
  if (!props.spec) return
  const newSpec = await makeAmbitious(props.spec)
  if (newSpec && props.onAmbitiousSpec) {
    props.onAmbitiousSpec(newSpec)
  }
}

// ── Feature #20 — Domain detection ──────────────────────────────────────────

const domainResult = computed(() => {
  if (!props.spec) return { domain: 'General', confidence: 'low' as const }
  return detectDomain(props.spec)
})

const DOMAIN_BADGE_CLASSES: Record<string, string> = {
  Engineering: 'bg-blue-100 text-blue-800',
  Product: 'bg-purple-100 text-purple-800',
  Personal: 'bg-green-100 text-green-800',
  Business: 'bg-amber-100 text-amber-800',
  Research: 'bg-cyan-100 text-cyan-800',
  General: 'bg-gray-100 text-gray-700',
}

const domainBadgeClass = computed(() => DOMAIN_BADGE_CLASSES[domainResult.value.domain] ?? 'bg-gray-100 text-gray-700')

const DOMAIN_DOT_CLASSES: Record<string, string> = {
  Engineering: 'text-blue-300',
  Product: 'text-purple-300',
  Personal: 'text-green-300',
  Business: 'text-amber-300',
  Research: 'text-cyan-300',
  General: 'text-gray-400',
}

/** Low confidence = lighter dot; high confidence = same colour as text */
const domainDotClass = computed(() => {
  if (domainResult.value.confidence === 'high') return ''
  return DOMAIN_DOT_CLASSES[domainResult.value.domain] ?? 'text-gray-400'
})

// ── Feature #10 — Animation key ──────────────────────────────────────────────

/**
 * Increments each time props.spec changes to a new value (null → spec, or spec → spec).
 * Used as the :key on the animated cards wrapper to force CSS animation to replay.
 */
const animationKey = ref(0)

// ── Before/After toggle state ───────────────────────────────────────────────

/**
 * true = showing Before (raw input); false = showing After (generated spec).
 * Defaults to false (After/spec view). Resets to false each time a new spec arrives.
 */
const showBefore = ref(false)

/**
 * Direction for slide transition: 'slide-left' when going to Before,
 * 'slide-right' when returning to After.
 */
const transitionName = ref<'slide-left' | 'slide-right'>('slide-left')

/**
 * Controls the one-shot pulse animation on structured fields.
 * Set to true when the user switches from Before → After; cleared after 700 ms
 * so the animation class is removed and does not re-fire on re-render.
 */
const pulseStructured = ref(false)

/** Reset toggle to After whenever a new spec is generated; increment animationKey */
watch(() => props.spec, (newSpec) => {
  if (newSpec) {
    animationKey.value++
  }
  showBefore.value = false
  pulseStructured.value = false
})

function toggleView(): void {
  if (showBefore.value) {
    // Switching Before → After: slide right, trigger pulse on structured fields
    transitionName.value = 'slide-right'
    showBefore.value = false
    pulseStructured.value = true
    setTimeout(() => { pulseStructured.value = false }, 700)
  } else {
    // Switching After → Before: slide left
    transitionName.value = 'slide-left'
    showBefore.value = true
  }
}

// ── TTS ─────────────────────────────────────────────────────────────────────

/** Builds a human-readable summary of the spec for TTS */
function buildSpecSummary(): string {
  if (!props.spec) return ''
  const parts: string[] = []
  if (props.spec.functions.length) {
    parts.push(`${props.spec.functions.length} function${props.spec.functions.length > 1 ? 's' : ''}: `)
    parts.push(...props.spec.functions.map(f => f.description))
  }
  if (props.spec.values.length) {
    parts.push(`${props.spec.values.length} value${props.spec.values.length > 1 ? 's' : ''}: `)
    parts.push(...props.spec.values.map(v => `${v.id}: ${v.description}. Goal: ${v.goal}`))
  }
  if (props.spec.solutions.length) {
    parts.push(`${props.spec.solutions.length} solution${props.spec.solutions.length > 1 ? 's' : ''}: `)
    parts.push(...props.spec.solutions.map(s => s.description))
  }
  return parts.join('. ')
}

function toggleSpeak(): void {
  if (isSpeaking.value) {
    stopSpeaking()
  } else {
    speak(buildSpecSummary())
  }
}

// ── Feature #22 — Spec Quality Score ─────────────────────────────────────────

const { scoreSpec } = useSpecQuality()

const qualityResult = computed(() => {
  if (!props.spec) return null
  return scoreSpec(props.spec)
})

/** SVG ring gauge: arc length for the progress stroke */
const RING_CIRCUMFERENCE = 2 * Math.PI * 16 // radius = 16, circumference ≈ 100.53

/** Animated arc length — starts at 0 and grows to final value on mount */
const arcLength = ref(0)

watch(qualityResult, (qr) => {
  if (!qr) { arcLength.value = 0; return }
  arcLength.value = (qr.score / 100) * RING_CIRCUMFERENCE
}, { immediate: true })

// Animate arc on mount
onMounted(() => {
  if (qualityResult.value) {
    arcLength.value = (qualityResult.value.score / 100) * RING_CIRCUMFERENCE
  }
})

const arcStrokeColor = computed(() => {
  const grade = qualityResult.value?.grade ?? 'F'
  if (grade === 'A' || grade === 'B') return '#22c55e' // green-500
  if (grade === 'C') return '#fbbf24' // amber-400
  return '#ef4444' // red-500
})

const qualityTooltip = computed(() => {
  const qr = qualityResult.value
  if (!qr) return ''
  const issueLines = qr.issues.slice(0, 3).join('\n')
  return `Grade: ${qr.grade}\n${issueLines}`
})

// ── Feature Organisation Design — Contextual Suggestions ─────────────────────
const { suggestions: featureSuggestions } = useFeatureSuggestions(
  () => props.spec,
  () => qualityResult.value?.score ?? null,
)

const { toast: specToast, showToast } = useToast()

// ── Feature Organisation Design — Command Palette (⌘F, alias ⌘K) ─────────────
// Registry is built lazily after all handler refs are declared — see bottom of
// script where `paletteRegistry` is assembled and `palette` is wired.
const paletteRegistry: import('../composables/useCommandPalette').PaletteEntry[] = []
const palette = useCommandPalette(paletteRegistry)

// Mount ⌘F (alias ⌘K) global listener
const paletteInput = ref<HTMLInputElement | null>(null)
onMounted(() => {
  window.addEventListener('keydown', palette.handleKey)
})
// Auto-focus search input when palette opens
watch(palette.isOpen, (v) => {
  if (v) nextTick(() => paletteInput.value?.focus())
})
// (cleanup is omitted intentionally — component lives for the app lifetime)

// ── Feature #23 — OKR Export ──────────────────────────────────────────────────

const { convertToOKR } = useOKRExport()

const okrOpen = ref(false)
const okrCopied = ref(false)

const okrText = computed(() => {
  if (!props.spec) return ''
  return convertToOKR(props.spec)
})

async function copyOkrText(): Promise<void> {
  try {
    await navigator.clipboard.writeText(okrText.value)
    okrCopied.value = true
    setTimeout(() => { okrCopied.value = false }, 2000)
  } catch {
    // clipboard not available
  }
}

// ── Feature #25 — Stakeholder Sign-Off ───────────────────────────────────────

const signOffOpen = ref(false)

// ── Feature #26 — Spec Diff View ─────────────────────────────────────────────

const { diffSpecs } = useSpecDiff()

/** Computed diff between previousSpec and the current spec */
const diffChanges = computed<FieldChange[]>(() => {
  if (!props.previousSpec || !props.spec) return []
  return diffSpecs(props.previousSpec, props.spec)
})

/** Whether the diff banner is expanded */
const diffOpen = ref(true)

/** Number of diff rows visible before "Show more" */
const DIFF_MAX_ROWS = 8
const diffShowAll = ref(false)

const visibleDiffChanges = computed(() =>
  diffShowAll.value ? diffChanges.value : diffChanges.value.slice(0, DIFF_MAX_ROWS),
)

/** Reset diff open state and show-all when a new spec arrives */
watch(() => props.spec, () => {
  diffOpen.value = true
  diffShowAll.value = false
})

// ── Feature #28 — Lean Plan ───────────────────────────────────────────────────

const {
  loading: leanLoading,
  leanSpec,
  error: leanError,
  reduceScopeToLean,
} = useLeanPlan(props.apiKey)

const leanOpen = ref(false)

async function handleLean(): Promise<void> {
  if (!props.spec) return
  leanOpen.value = true
  await reduceScopeToLean(props.spec)
}

function handleUseLeanPlan(): void {
  if (leanSpec.value) {
    emit('lean-spec-selected', leanSpec.value)
    leanOpen.value = false
  }
}

// ── Feature #31 — Spec Filter ────────────────────────────────────────────────

const { filterSpec } = useSpecFilter()
const filterQuery = ref('')

const filteredSpec = computed(() => {
  if (!props.spec) return props.spec
  return filterSpec(props.spec, filterQuery.value)
})

/** Total entries in the full spec (F + V + S + C) */
const totalEntryCount = computed(() => {
  if (!props.spec) return 0
  return props.spec.functions.length + props.spec.values.length + props.spec.solutions.length + (props.spec.constraints?.length ?? 0)
})

/** Total entries in the filtered spec */
const filteredEntryCount = computed(() => {
  if (!filteredSpec.value) return 0
  return filteredSpec.value.functions.length + filteredSpec.value.values.length + filteredSpec.value.solutions.length
})

// ── Feature #38 — Spec Accessibility Checker ─────────────────────────────────

const { checkSpec } = useSpecAccessibility()

const a11yOpen = ref(false)
const a11yIssues = ref<AccessibilityIssue[]>([])

function handleA11yCheck(): void {
  if (!props.spec) return
  a11yOpen.value = !a11yOpen.value
  if (a11yOpen.value) {
    a11yIssues.value = checkSpec(props.spec)
  }
}

const a11yErrorCount = computed(() => a11yIssues.value.filter(i => i.severity === 'error').length)
const a11yWarningCount = computed(() => a11yIssues.value.filter(i => i.severity === 'warning').length)
const a11yInfoCount = computed(() => a11yIssues.value.filter(i => i.severity === 'info').length)

// ── Feature #33 — Notion Export ──────────────────────────────────────────────

const { convertToNotionMarkdown } = useNotionExport()
const notionCopied = ref(false)

async function handleNotionExport(): Promise<void> {
  if (!props.spec) return
  const text = convertToNotionMarkdown(props.spec, props.confirmedSteps)
  try {
    await navigator.clipboard.writeText(text)
    notionCopied.value = true
    setTimeout(() => { notionCopied.value = false }, 2000)
  } catch {
    // clipboard not available
  }
}

// ── Feature #52 — Regulation Map ─────────────────────────────────────────────

const {
  mappings: regMappings,
  copied: regCopied,
  generateMappings,
  copyMarkdown: copyRegMarkdown,
} = useRegulationMap()

const regsOpen = ref(false)
const regsFilter = ref<'All' | 'GDPR' | 'ISO 9001' | 'SOC 2' | 'OKR'>('All')

const filteredRegMappings = computed<RegMapping[]>(() => {
  if (regsFilter.value === 'All') return regMappings.value
  return regMappings.value.filter(m => m.framework === regsFilter.value)
})

function handleRegs(): void {
  if (!props.spec) return
  regsOpen.value = !regsOpen.value
  if (regsOpen.value && regMappings.value.length === 0) generateMappings(props.spec)
}

// ── Feature #54 — Time Capsule ────────────────────────────────────────────────

const {
  report: capsuleReport,
  horizonDays,
  capsuleCopied,
  generateReport: generateCapsule,
  copyReport: copyCapsule,
} = useTimeCapsule()

const capsuleOpen = ref(false)

function handleTimeCapsule(): void {
  if (!props.spec) return
  capsuleOpen.value = !capsuleOpen.value
  if (capsuleOpen.value) generateCapsule(props.spec)
}

watch(horizonDays, () => {
  if (props.spec && capsuleOpen.value) generateCapsule(props.spec)
})

// ── Feature #43 — Peer Review ────────────────────────────────────────────────

const {
  loading: peerReviewLoading,
  comments: peerReviewComments,
  error: peerReviewError,
  reviewSpec,
} = usePeerReview(props.apiKey)

const peerReviewOpen = ref(false)

async function handlePeerReview(): Promise<void> {
  if (!props.spec) return
  peerReviewOpen.value = true
  await reviewSpec(props.spec)
}

// ── Feature #44 — Executive Summary ──────────────────────────────────────────

const {
  loading: execSummaryLoading,
  summary: execSummaryText,
  error: execSummaryError,
  generateSummary,
} = useExecSummary(props.apiKey)

const summaryOpen = ref(false)
const summaryCopied = ref(false)

async function handleExecSummary(): Promise<void> {
  if (!props.spec) return
  summaryOpen.value = true
  await generateSummary(props.spec)
}

async function copyExecSummary(): Promise<void> {
  try {
    await navigator.clipboard.writeText(execSummaryText.value)
    summaryCopied.value = true
    setTimeout(() => { summaryCopied.value = false }, 2000)
  } catch {
    // clipboard not available
  }
}

// ── Feature #46 — Heat Lane ───────────────────────────────────────────────────

const heatLaneOpen = ref(false)

// ── Feature #48 — Kai Critique ────────────────────────────────────────────────

const {
  critiques: kaiCritiques,
  loading: kaiLoading,
  error: kaiError,
  generateCritique,
} = useKaiCritique(props.apiKey)

const kaiOpen = ref(false)

async function handleKaiCritique(): Promise<void> {
  if (!props.spec) return
  kaiOpen.value = !kaiOpen.value
  if (kaiOpen.value && kaiCritiques.value.length === 0) {
    await generateCritique(props.spec)
  }
}

// ── Feature #49 — Spec Fork & Merge ──────────────────────────────────────────

const { forkedSpec, mergeResult, forkSpec, clearFork, mergeSpecs } = useSpecFork()

const forkOpen = ref(false)
const forkExpanded = ref(true)

function handleFork(): void {
  if (!props.spec) return
  forkSpec(props.spec)
  forkOpen.value = true
  forkExpanded.value = true
}

function handleMerge(): void {
  if (!props.spec || !forkedSpec.value) return
  mergeSpecs(props.spec, forkedSpec.value)
}

function handleCloseFork(): void {
  forkOpen.value = false
  clearFork()
}

// ── Feature #45 — Spec Stats & Readability Footer ────────────────────────────

const { computeStats } = useSpecStats()
const { scoreSpec: scoreReadability } = useReadability()

const specStats = computed(() => {
  if (!props.spec) return computeStats({ functions: [], values: [], solutions: [] })
  return computeStats(props.spec)
})

const readabilityResult = computed(() => {
  if (!props.spec) return null
  return scoreReadability(props.spec)
})

/** Feature #41 — 3 lowest-scoring entries for the tooltip */
const readabilityLowest3 = computed(() => {
  if (!readabilityResult.value) return []
  return [...readabilityResult.value.perEntryScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
})

/** Tooltip text fallback for title attribute (accessibility) */
const readabilityLowestTooltip = computed(() => {
  if (readabilityLowest3.value.length === 0) return ''
  return 'Lowest readability:\n' + readabilityLowest3.value
    .map(e => `${e.entryId}: ${Math.round(e.score)}`)
    .join('\n')
})

// ── Feature #42 — Goal Sensitivity ───────────────────────────────────────────

const sensitivity = useGoalSensitivity()
const sensitivityOpen = ref(false)

/**
 * The spec rendered in the After view cards.
 * When sensitivityOpen=true, Goal/Tolerable fields are scaled by the multiplier.
 * Otherwise, falls back to the filtered spec.
 */
const displaySpec = computed(() => {
  if (!filteredSpec.value) return filteredSpec.value
  if (sensitivityOpen.value && sensitivity.multiplier.value !== 1.0) {
    return sensitivity.applyMultiplier(filteredSpec.value, sensitivity.multiplier.value)
  }
  return filteredSpec.value
})

// ── Feature #178 — Stakeholder Summary ───────────────────────────────────────
// Derives unique named stakeholders from:
//   1. V.wishStakeholder fields (explicit wish-source tagging)
//   2. rawInput.stakes text (the user's own description of who benefits)
// Used for chip display in V. card headers, the summary banner, and the new
// full Stakeholders section card (DD-006 / SUPREME inanimate-stakeholder rule).
const STAKEHOLDER_PALETTES = [
  { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-200'   },
  { bg: 'bg-sky-100',    text: 'text-sky-800',     border: 'border-sky-200'    },
  { bg: 'bg-indigo-100', text: 'text-indigo-800',  border: 'border-indigo-200' },
  { bg: 'bg-rose-100',   text: 'text-rose-800',    border: 'border-rose-200'   },
  { bg: 'bg-amber-100',  text: 'text-amber-800',   border: 'border-amber-200'  },
  { bg: 'bg-fuchsia-100',text: 'text-fuchsia-800', border: 'border-fuchsia-200'},
]

/** Parse stakeholder-looking names from a stakes free-text string.
 *  Splits on commas, semicolons, "and", "or". Keeps fragments ≤5 words and
 *  not obviously a verb clause. Returns lowercased–then-title-cased names. */
function _parseStakesNames(stakes: string): string[] {
  return stakes
    .split(/[,;]|\band\b|\bor\b/i)
    .map(s => s.trim())
    .filter(s => {
      if (!s || s.length < 2) return false
      const words = s.split(/\s+/)
      // Skip long phrases — they're sentences, not names
      if (words.length > 5) return false
      // Skip purely functional clauses (starts with verb)
      if (/^(provide|ensure|improve|increase|reduce|enable|allow|support|deliver|create|build|use|make|give|help|let|get|set)/i.test(s)) return false
      return true
    })
    .map(s => {
      // Title-case if all lowercase/uppercase; otherwise preserve
      return s === s.toLowerCase() || s === s.toUpperCase()
        ? s.replace(/\b\w/g, c => c.toUpperCase())
        : s
    })
}

const uniqueStakeholders = computed<{ name: string; palette: typeof STAKEHOLDER_PALETTES[0] }[]>(() => {
  const spec = displaySpec.value
  if (!spec) return []
  const seen = new Map<string, number>()
  // Primary source: V.wishStakeholder
  for (const v of spec.values) {
    const s = v.wishStakeholder?.trim()
    if (s && !seen.has(s)) seen.set(s, seen.size)
  }
  // Secondary source: rawInput.stakes text
  if (props.rawInput?.stakes) {
    for (const name of _parseStakesNames(props.rawInput.stakes)) {
      if (!seen.has(name)) seen.set(name, seen.size)
    }
  }
  return Array.from(seen.entries()).map(([name, idx]) => ({
    name,
    palette: STAKEHOLDER_PALETTES[idx % STAKEHOLDER_PALETTES.length],
  }))
})

/**
 * Full stakeholder records for the section card — each stakeholder enriched
 * with their linked Values (via wishStakeholder) and applied Constraints
 * (via c.scope containing their name, or all C. entries when scope is blank).
 */
interface StakeholderCard {
  name: string
  palette: typeof STAKEHOLDER_PALETTES[0]
  /** V. entries where this stakeholder is the wishStakeholder */
  linkedValues: { id: string; description: string; goal: string }[]
  /** C. entries whose scope mentions this stakeholder (or all if scope is empty) */
  linkedConstraints: { id: string; description: string }[]
  /** The Wish text, if any */
  wish: string
}

const specStakeholderCards = computed<StakeholderCard[]>(() => {
  const spec = displaySpec.value
  if (!spec) return []
  return uniqueStakeholders.value.map(sh => {
    const nameLower = sh.name.toLowerCase()
    const linkedValues = spec.values
      .filter(v => v.wishStakeholder?.trim().toLowerCase() === nameLower)
      .map(v => ({ id: v.id, description: v.description, goal: v.goal }))
    const wish = spec.values.find(v => v.wishStakeholder?.trim().toLowerCase() === nameLower)?.wish ?? ''
    const linkedConstraints = (spec.constraints ?? [])
      .filter(c => !c.scope || c.scope.toLowerCase().includes(nameLower))
      .map(c => ({ id: c.id, description: c.description }))
    return { ...sh, linkedValues, linkedConstraints, wish }
  })
})

function stakeholderPalette(name: string | undefined): typeof STAKEHOLDER_PALETTES[0] {
  if (!name) return STAKEHOLDER_PALETTES[0]
  const idx = uniqueStakeholders.value.findIndex(s => s.name === name.trim())
  return STAKEHOLDER_PALETTES[Math.max(idx, 0) % STAKEHOLDER_PALETTES.length]
}

// ── Feature #57 — Spec Simplify ──────────────────────────────────────────────
// ── Feature #57b — Extended modes + per-entry rewrite + scope apply ──────────

const {
  simplified,
  loading: simplifyLoading,
  error: simplifyError,
  copied: simplifyCopied,
  activeMode: simplifyActiveMode,
  simplifySpec,
  simplifyEntry: simplifyEntryFn,
  copySimplified,
} = useSpecSimplify()

const simplifyOpen = ref(false)

async function handleSimplify(): Promise<void> {
  if (!props.spec) return
  simplifyOpen.value = !simplifyOpen.value
  if (simplifyOpen.value && simplified.value.length === 0) await simplifySpec(props.spec)
}

async function handleSimplifyMode(mode: SimplifyMode): Promise<void> {
  if (!props.spec) return
  simplifyOpen.value = true
  await simplifySpec(props.spec, mode)
}

// ── Feature #57b — Scope selector ────────────────────────────────────────────

type SimplifyScope = 'preview' | 'copy' | 'replace'

interface SimplifyScopeOption {
  key: SimplifyScope
  label: string
  emoji: string
  hint: string
}

const SIMPLIFY_SCOPES: SimplifyScopeOption[] = [
  { key: 'preview',  label: 'Preview',        emoji: '👁',  hint: 'Show rewrites without changing anything' },
  { key: 'copy',     label: 'Save Copy',       emoji: '✱',  hint: 'Save rewrite as a new version — original untouched (`*→[*]`)' },
  { key: 'replace',  label: 'Replace Master',  emoji: '✅',  hint: 'Apply rewrites to the master spec — old saved to history first' },
]

const simplifyScope = ref<SimplifyScope>('preview')

function handleApplyRewrite(): void {
  if (!props.spec || !simplified.value.length) return
  const rewritten = applySimplifiedToSpec(props.spec, simplified.value)
  if (simplifyScope.value === 'copy')    emit('rewrite-copy', rewritten)
  if (simplifyScope.value === 'replace') emit('rewrite-replace', rewritten)
}

// ── Feature #57b — Per-entry rewrite state ────────────────────────────────────

interface EntryState {
  open: boolean
  mode: SimplifyMode
  result: string
  loading: boolean
  accepted: boolean
  /** Inline description editing — Tom 2026-05-18: "we need to be able to edit the text here" */
  editingDesc: boolean
  editDescText: string
}

const entryStateMap = reactive<Record<string, EntryState>>({})

/** Blank fallback used when a render happens before the watchEffect has run. Never mutates during render. */
const _entryStateFallback: EntryState = { open: false, mode: 'plain', result: '', loading: false, accepted: false, editingDesc: false, editDescText: '' }

/** Pre-populate entryStateMap outside of the render cycle so reading it in templates never triggers a mutation. */
watchEffect(() => {
  const spec = props.spec
  if (!spec) return
  const ids = [
    ...spec.functions.map(f => f.id),
    ...spec.values.map(v => v.id),
    ...spec.solutions.map(s => s.id),
  ]
  for (const id of ids) {
    if (!entryStateMap[id]) {
      entryStateMap[id] = { open: false, mode: 'plain', result: '', loading: false, accepted: false, editingDesc: false, editDescText: '' }
    }
  }
})

function entryState(id: string): EntryState {
  return entryStateMap[id] ?? _entryStateFallback
}

function toggleEntryPin(id: string): void {
  entryState(id).open = !entryState(id).open
}

async function handleEntrySimplify(id: string, description: string, mode: SimplifyMode): Promise<void> {
  const s = entryState(id)
  s.mode    = mode
  s.loading = true
  s.result  = ''
  s.accepted = false
  s.result  = await simplifyEntryFn(id, description, mode)
  s.loading = false
}

function acceptEntryRewrite(id: string, type: 'F' | 'V' | 'S'): void {
  const s = entryState(id)
  if (!s.result) return
  emit('rewrite-entry', { id, type, description: s.result })
  s.accepted = true
}

// ── Inline description editing — Tom 2026-05-18 ──────────────────────────────
// Click any entry description to edit it directly, no AI call needed.

function startDescEdit(id: string, currentText: string): void {
  const s = entryState(id)
  s.editDescText = currentText
  s.editingDesc = true
  // Auto-focus the textarea after Vue renders it
  nextTick(() => {
    const el = document.getElementById(`desc-edit-${id}`) as HTMLTextAreaElement | null
    el?.focus()
    el?.select()
  })
}

function saveDescEdit(id: string, type: 'F' | 'V' | 'S'): void {
  const s = entryState(id)
  // Guard: blur fires after Escape (textarea removed from DOM triggers a final blur).
  // If editingDesc is already false the edit was cancelled — skip saving.
  if (!s.editingDesc) return
  const text = s.editDescText.trim()
  if (text) emit('rewrite-entry', { id, type, description: text })
  s.editingDesc = false
}

function cancelDescEdit(id: string): void {
  // Set false BEFORE the textarea is removed so the blur guard above catches the
  // spurious blur event that fires when the element leaves the DOM.
  entryState(id).editingDesc = false
}

function onDescEditKeydown(e: KeyboardEvent, id: string, type: 'F' | 'V' | 'S'): void {
  if (e.key === 'Escape') { e.preventDefault(); cancelDescEdit(id) }
  // Cmd+Enter or Ctrl+Enter saves; plain Enter adds a newline (multi-line support)
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveDescEdit(id, type) }
}

// ── Feature #60 — Spec Gap Analyser ──────────────────────────────────────────

const {
  gaps,
  detectedDomain: gapDomain,
  selectedTemplate: gapTemplate,
  analyseGaps,
} = useSpecGapAnalyser()

const gapsOpen = ref(false)

function handleGaps(): void {
  if (!props.spec) return
  gapsOpen.value = !gapsOpen.value
  if (gapsOpen.value) analyseGaps(props.spec)
}

// ── Feature #62 — Ship Checklist ─────────────────────────────────────────────

const {
  checklist: shipChecklist,
  overallStatus: shipOverallStatus,
  copied: shipChecklistCopied,
  generateChecklist,
  copyChecklist,
} = useShipChecklist()

const shipOpen = ref(false)

function handleShipCheck(): void {
  if (!props.spec) return
  shipOpen.value = !shipOpen.value
  if (shipOpen.value) generateChecklist(props.spec)
}

// ── Feature #65 — Word count ──────────────────────────────────────────────────

const totalWordCount = computed(() => props.spec ? countSpecWords(props.spec) : 0)

// ── Feature #61 — Spec Glossary ──────────────────────────────────────────────

const {
  glossary,
  copied: glossaryCopied,
  extractTerms,
  copyGlossary,
} = useSpecGlossary()

const glossaryOpen = ref(false)
const glossaryTypeFilter = ref<'All' | 'Acronyms' | 'Domain Terms' | 'Metrics'>('All')

function handleGlossary(): void {
  if (!props.spec) return
  glossaryOpen.value = !glossaryOpen.value
  if (glossaryOpen.value && glossary.value.length === 0) extractTerms(props.spec)
}

const filteredGlossary = computed(() => {
  if (glossaryTypeFilter.value === 'All') return glossary.value
  if (glossaryTypeFilter.value === 'Acronyms') return glossary.value.filter(e => e.type === 'acronym')
  if (glossaryTypeFilter.value === 'Domain Terms') return glossary.value.filter(e => e.type === 'domain-term')
  if (glossaryTypeFilter.value === 'Metrics') return glossary.value.filter(e => e.type === 'metric')
  return glossary.value
})

// ── Feature #63 — Spec Narrative ─────────────────────────────────────────────

const {
  narrative,
  loading: narrativeLoading,
  error: narrativeError,
  copied: narrativeCopied,
  generateNarrative,
  copyNarrative,
} = useSpecNarrative(props.apiKey)

const narrativeOpen = ref(false)

async function handleNarrative(): Promise<void> {
  if (!props.spec) return
  narrativeOpen.value = !narrativeOpen.value
  if (narrativeOpen.value && !narrative.value) await generateNarrative(props.spec)
}

// ── Feature #69 — Spec Changelog ─────────────────────────────────────────────

const {
  changelog,
  changelogOpen,
  recordChange,
  copyChangelog,
  clearChangelog,
} = useSpecChangelog()

// ── Feature #70 — Multi-language Spec Export ──────────────────────────────────

const specRef = computed(() => props.spec)

const {
  targetLanguage,
  translating: translateLoading,
  translateError,
  translatedEntries,
  translateOpen,
  translateSpec,
  copyTranslation,
  clearTranslation,
} = useSpecTranslate(specRef, props.apiKey ?? '')

// ── Feature #72 — RICE Score Prioritiser ─────────────────────────────────────

const {
  riceOpen,
  riceEntries,
  computeRiceScores,
  updateField: updateRiceField,
  copyRiceTable,
} = useRiceScore(specRef)

function handleRice(): void {
  riceOpen.value = true
  computeRiceScores()
}

// ── Feature #75 — AI Stakeholder Interview Guide ──────────────────────────────

const {
  guideOpen,
  generating: guideGenerating,
  guideError,
  guideGroups,
  generateGuide,
  copyGuide,
  clearGuide,
} = useInterviewGuide(computed(() => props.spec), props.apiKey ?? '')

// ── Feature #76 — Spec Compliance Heatmap ────────────────────────────────────

const {
  heatmapOpen,
  heatmapRows,
  rules: heatmapRules,
  overallPass: heatmapOverallPass,
  totalViolations: heatmapTotalViolations,
  computeHeatmap,
  copyHeatmap,
} = useComplianceHeatmap(computed(() => props.spec))

// ── Feature #78 — Spec Confidence Overlay ────────────────────────────────────

const {
  confidenceOpen,
  confidenceScores,
  vEntries: confidenceVEntries,
  avgConfidence,
  lowConfidenceEntries,
  setConfidence,
  copyConfidenceSummary,
} = useSpecConfidence(computed(() => props.spec))

// ── Feature #79 — Spec Health Report PDF ─────────────────────────────────────

const { healthPdfOpen, exportHealthPDF } = useSpecHealthReport(computed(() => props.spec))

// ── Feature #80 — V. Entry Dependency Graph ───────────────────────────────────

const { graphOpen, graph, selectedNode, selectNode } = useDepGraph(computed(() => props.spec))

// ── Feature #81 — AI Spec Debate Mode ────────────────────────────────────────

const {
  debateOpen,
  debating,
  debateError,
  turns: debateTurns,
  generateDebate,
  copyTranscript,
  clearDebate,
} = useDebateMode(computed(() => props.spec), props.apiKey ?? '')

// ── Feature #83 — Elevator Pitch ─────────────────────────────────────────────

const {
  pitchOpen,
  generating,
  pitchError,
  pitch,
  wordCount: pitchWordCount,
  estimatedSeconds: pitchSeconds,
  isSpeaking: pitchSpeaking,
  generatePitch,
  speak: speakPitch,
  stopSpeaking: stopSpeakingPitch,
  copyPitch,
} = useElevatorPitch(computed(() => props.spec), props.apiKey ?? '')

// ── Feature #84 — North Star Metric Pin ──────────────────────────────────────

const {
  pinnedId,
  pinnedEntry,
  relevanceMap,
  pinEntry,
} = useNorthStar(computed(() => props.spec))

// ── Feature #85 — Persona Challenge ──────────────────────────────────────────

const {
  personaOpen,
  selectedPersona,
  challenging: personaChallenging,
  challengeError: personaChallengeError,
  result: personaChallengeResult,
  generateChallenge,
  copyChallenge,
} = usePersonaChallenge(computed(() => props.spec), props.apiKey ?? '')

// ── Feature #87 — Assumptions Register ───────────────────────────────────────

const {
  assumptionsOpen,
  assumptions,
  extractAssumptions,
  copyRegister,
} = useAssumptionsRegister(computed(() => props.spec))

// ── Feature #88 — Auto-Improver ───────────────────────────────────────────────

const {
  autoImproveOpen,
  improving,
  improveError,
  steps: improveSteps,
  improvedSpec,
  showDiff,
  runAutoImprove,
  copyImprovedSpec,
} = useAutoImprove(computed(() => props.spec), props.apiKey ?? '')

// ── Feature #90 — Spec Tweet Thread ─────────────────────────────────────────

const {
  tweetOpen,
  tweets,
  generateTweets,
  copyThread,
} = useSpecTweet(computed(() => props.spec))

// ── Feature #92 — Anti-Pattern Detector ──────────────────────────────────────

const {
  antiPatternsOpen,
  violations,
  violationCount,
  scanAntiPatterns,
  copyReport: copyAntiPatternReport,
} = useAntiPatterns(computed(() => props.spec))

// ── Feature #94 — Spec Contract Mode ─────────────────────────────────────────

const {
  contractOpen,
  clauses,
  contractTitle,
  generateClauses,
  updateSignOff,
  copyContract,
  exportContractPDF,
} = useSpecContract(computed(() => props.spec))

// ── Feature #96 — Spec Story Map ─────────────────────────────────────────────

const {
  storyMapOpen,
  lanes,
  selectedLane,
} = useStoryMap(computed(() => props.spec))

// ── Feature #97 — Spec Energy Tracker ────────────────────────────────────────

const {
  records: energyRecords,
  setSpecKey,
  recordEnergy,
  latestRecord: latestEnergyRecord,
  aggregateSummary: energySummary,
} = useEnergyTracker()
const energyPanelOpen = ref(false)

watch(() => props.spec, (newSpec) => {
  if (newSpec) {
    const key = `${(newSpec.functions.length + newSpec.values.length + newSpec.solutions.length)}-${(newSpec as SpecBlock & { domain?: string }).domain ?? 'general'}`
    setSpecKey(key)
  }
})

// ── Feature #99 — Spec Battle Card ───────────────────────────────────────────

const {
  battleOpen,
  strengths,
  weaknesses,
  analyseSpec,
  copyBattleCard,
} = useSpecBattleCard(computed(() => props.spec))

// ── Feature #100 — Market Size ───────────────────────────────────────────────

const {
  marketOpen,
  estimate,
  estimateMarket,
  copyMarketSummary,
} = useMarketSize(computed(() => props.spec))

// ── Feature #102 — OKR Crosswalk ─────────────────────────────────────────────

const {
  okrOpen: okrCrosswalkOpen,
  objectives: crosswalkObjectives,
  buildOkrCrosswalk,
  copyOkrTable,
} = useOkrCrosswalk(computed(() => props.spec))

const expandedCrosswalkObjectives = ref<Set<number>>(new Set([0]))
function toggleCrosswalkObjective(index: number): void {
  if (expandedCrosswalkObjectives.value.has(index)) {
    expandedCrosswalkObjectives.value.delete(index)
  } else {
    expandedCrosswalkObjectives.value.add(index)
  }
  // trigger reactivity
  expandedCrosswalkObjectives.value = new Set(expandedCrosswalkObjectives.value)
}

// ── Feature #103 — Resilience Checker ────────────────────────────────────────

const {
  resilienceOpen,
  issues: resilienceIssues,
  highCount,
  mediumCount,
  scanResilience,
  copyReport,
} = useResilienceChecker(computed(() => props.spec))

// ── Feature #104 — Goal Ladder ───────────────────────────────────────────────

const {
  ladderOpen,
  ladderEntries,
} = useGoalLadder(computed(() => props.spec))

// ── Feature #105 — Spec Benchmark ────────────────────────────────────────────

const {
  benchmarkOpen,
  comparisonRows,
  setBenchmark,
  copyComparison,
} = useSpecBenchmark(computed(() => props.spec))

// ── Feature #107 — Spec Gamification ─────────────────────────────────────────

const {
  xp,
  level,
  xpBarWidth,
  maxXp,
} = useSpecGamification(computed(() => props.spec))

// ── Feature #108 — Decision Log ──────────────────────────────────────────────

const {
  decisionsOpen,
  decisions,
  newWhat,
  newWhy,
  newWho,
  newWhen,
  addDecision,
  removeDecision,
  copyLog,
} = useDecisionLog()

// ── Feature #109 — Impact Map ────────────────────────────────────────────────
const impactMapOpen = ref(false)
// Impact map is rendered inside SpecImpactMap component; no top-level composable needed.

// ── Feature #110 — Feature Flags ─────────────────────────────────────────────
const flagsOpen = ref(false)
const {
  flags,
  toggleFlag,
  exportJson: exportFlagsJson,
  copyJson: copyFlagsJson,
  copied: flagsCopied,
} = useFeatureFlags(computed(() => props.spec))

// ── Feature #111 — INVEST Checker ────────────────────────────────────────────
const investOpen = ref(false)
const {
  results: investResults,
  checking: investChecking,
  check: investCheck,
  copyMarkdown: investCopyMarkdown,
} = useInvestChecker(computed(() => props.spec), props.apiKey || '')

// ── Feature #112 — ROI Calculator ────────────────────────────────────────────
const roiOpen = ref(false)
const {
  entries: roiEntries,
  updateCost: roiUpdateCost,
  sortedByRoi,
  exportMarkdown: exportRoiMarkdown,
  copyMarkdown: copyRoiMarkdown,
  copied: roiCopied,
} = useRoiCalculator(computed(() => props.spec))

// ── Feature #114 — Velocity Tracker ──────────────────────────────────────────
const velocityOpen = ref(false)
const velocityBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { velocityBlocks.splice(0, velocityBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  entries: velocityEntries,
  velocityScore,
  overallTrend: velocityOverallTrend,
  recordSnapshot: velocityRecordSnapshot,
  clearHistory: velocityClearHistory,
  copyMarkdown: velocityCopyMarkdown,
  copied: velocityCopied,
} = useVelocityTracker(velocityBlocks)

// ── Feature #115 — TOGAF View ─────────────────────────────────────────────────
const togafOpen = ref(false)

// ── Feature #117 — Cost of Quality ───────────────────────────────────────────
const coqOpen = ref(false)
const {
  entries: coqEntries,
  updateCost: coqUpdateCost,
  totalCoQ,
  dominantDecision: coqDominantDecision,
  copyMarkdown: coqCopyMarkdown,
  copied: coqCopied,
} = useCostOfQuality(computed(() => props.spec))

// ── Feature #118 — Spec Sentiment ────────────────────────────────────────────
const sentimentOpen = ref(false)
const sentimentBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { sentimentBlocks.splice(0, sentimentBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  results: sentimentResults,
  distribution: sentimentDistribution,
  dominantLabel: sentimentDominantLabel,
  urgentEntries: sentimentUrgentEntries,
  copyMarkdown: sentimentCopyMarkdown,
  copied: sentimentCopied,
} = useSpecSentiment(sentimentBlocks)

// ── Feature #119 — Critical Path ─────────────────────────────────────────────
const criticalPathOpen = ref(false)

// ── Dropdown Menu Bar ─────────────────────────────────────────────────────────
const activeMenu = ref<string | null>(null)
const profilePickerOpen = ref(false)  // drives single-pill profile picker
const MENU_GROUPS = [
  // Six action-intent categories — designed by Claudian, requested by Tom
  // Keys '7','13','14','49' moved here from top bar (Tom asked for cleaner top bar)
  { id: 'analyse',   emoji: '🔍', label: 'Analyse',   keys: ['13','43','48','60','38','92','97','76','103','111','62','126','129','87','131','147','177','184','186','187','191','192'] },
  { id: 'visualize', emoji: '🗺️', label: 'Visualize', keys: ['109','96','80','46','123','139','134','104','102','154','149','170','181','122'] },
  { id: 'predict',   emoji: '🔮', label: 'Predict',   keys: ['72','78','105','112','151','164','161','146','141','189','179','100'] },
  { id: 'present',   emoji: '📢', label: 'Present',   keys: ['7','44','83','63','90','81','94','99','52','124','127','130','156','120','137','142','175','75','85','166','171','162'] },
  { id: 'simplify',  emoji: '✂️', label: 'Simplify',  keys: ['49','19','28','57','88','42','70','110','54'] },
  { id: 'optimise',  emoji: '⚡', label: 'Optimise',  keys: ['14','23','144','172','167','169','182','152','157','159','25','61','69','108','33','79','136','119','174'] },
]
const criticalPathBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { criticalPathBlocks.splice(0, criticalPathBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  criticalPath,
  highlightedIds: criticalHighlightedIds,
  copyMarkdown: criticalPathCopyMarkdown,
  copied: criticalPathCopied,
} = useCriticalPath(criticalPathBlocks)

// ── Feature #120 — Press Release ─────────────────────────────────────────────
const pressReleaseOpen = ref(false)
const pressReleaseBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { pressReleaseBlocks.splice(0, pressReleaseBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  release: pressRelease,
  generating: pressReleaseGenerating,
  generate: generatePressRelease,
  copyMarkdown: pressReleaseCopyMarkdown,
  copied: pressReleaseCopied,
} = usePressRelease(pressReleaseBlocks, props.apiKey || '')

async function openPressRelease(): Promise<void> {
  pressReleaseOpen.value = !pressReleaseOpen.value
  if (pressReleaseOpen.value && pressRelease.value === null) {
    await generatePressRelease()
  }
}

// ── Feature #122 — Constraint Mapper ─────────────────────────────────────────
const constraintsOpen = ref(false)
const constraintBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { constraintBlocks.splice(0, constraintBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  constraints: constraintEntries,
  grouped: constraintsGrouped,
  totalCount: constraintTotal,
  highSeverityCount: constraintHighCount,
  copyMarkdown: constraintsCopyMarkdown,
  copied: constraintsCopied,
} = useConstraintMapper(constraintBlocks)

const expandedConstraintCategories = ref<Set<string>>(new Set(['time', 'cost', 'quality', 'scope']))
function toggleConstraintCategory(cat: string): void {
  if (expandedConstraintCategories.value.has(cat)) {
    expandedConstraintCategories.value.delete(cat)
  } else {
    expandedConstraintCategories.value.add(cat)
  }
  expandedConstraintCategories.value = new Set(expandedConstraintCategories.value)
}

// ── Feature #123 — Value Stream ───────────────────────────────────────────────
const valueStreamOpen = ref(false)
// Value stream is rendered inside SpecValueStream component; useValueStream called inside component.
// Expose bottleneckCount for button badge via a local ref if needed
const valueStreamBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { valueStreamBlocks.splice(0, valueStreamBlocks.length, ...(props.spec ? [props.spec] : [])) })
const { bottleneckCount: valueStreamBottleneckCount } = useValueStream(valueStreamBlocks)

// ── Feature #124 — Hypothesis Cards ──────────────────────────────────────────
const hypothesisOpen = ref(false)
const hypothesisBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { hypothesisBlocks.splice(0, hypothesisBlocks.length, ...(props.spec ? [props.spec] : [])) })
// New-style composable (computed cards, no generate call)
const {
  cards: hypothesisCards,
  selectedCard: hypothesisSelectedCard,
  selectCard: hypothesisSelectCard,
  copyCard: hypothesisCopyCard,
  copyAll: hypothesisCopyAll,
  copied: hypothesisCopied,
} = useHypothesisCards(hypothesisBlocks)
// Legacy aliases used by existing stub panel
const hypCards = hypothesisCards
const hypGenerating = ref(false)
const hypCopied = hypothesisCopied
function generateHyp(): void { /* no-op: cards are computed reactively */ }
function copyHyp(): void { hypothesisCopyAll() }

// ── Feature #126 — Regulatory Impact (new) ───────────────────────────────────
const {
  impacts: regulatoryImpacts,
  activeFilter: regulatoryFilter,
  setFilter: regulatorySetFilter,
  filteredImpacts: regulatoryFilteredImpacts,
  highCount: regulatoryHighCount,
  regulationSummary: regulatorySummary,
  copyBrief: regulatoryCopyBrief,
  copied: regulatoryCopied,
} = useRegulatoryImpact(hypothesisBlocks)

// ── Feature #126 — Regulatory Scanner (legacy stub) ──────────────────────────
const regScanOpen = ref(false)
const regScanBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { regScanBlocks.splice(0, regScanBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  result: regResult,
  scanning: regScanning,
  scan: runRegScan,
  copyMarkdown: regCopyMarkdown,
  copied: regScanCopied,
} = useRegulatoryScanner(regScanBlocks)

// New panel toggle aliases
const regulatoryOpen = regScanOpen

// ── Feature #127 — Job Description ───────────────────────────────────────────
const jdOpen = ref(false)
const jdBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { jdBlocks.splice(0, jdBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  jd: jobDesc,
  generating: jdGenerating,
  generate: generateJd,
  copyMarkdown: copyJd,
  copied: jdCopied,
} = useJobDescription(jdBlocks, props.apiKey ?? '')
// New panel aliases
const jdValue = jobDesc
async function jdGenerate(): Promise<void> { await generateJd() }
function jdCopyMarkdown(): void { copyJd() }

async function openJobDescription(): Promise<void> {
  jdOpen.value = !jdOpen.value
  if (jdOpen.value && jobDesc.value === null) {
    await generateJd()
  }
}

// ── Feature #129 — Innovation Score ──────────────────────────────────────────
const innovationOpen = ref(false)
const innovationBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { innovationBlocks.splice(0, innovationBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  innovationScore,
  copyMarkdown: innovationCopyMarkdown,
  copied: innovationCopied,
} = useInnovationScore(innovationBlocks)

// ── Feature #131 — Competitor Matrix ─────────────────────────────────────────
const competitorOpen = ref(false)
const competitorBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { competitorBlocks.splice(0, competitorBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  matrix: competitorMatrix,
  copyMarkdown: competitorCopyMarkdown,
  copied: competitorCopied,
} = useCompetitorMatrix(competitorBlocks)

// ── Feature #132 — RFC Formatter ─────────────────────────────────────────────
const rfcOpen = ref(false)
const rfcBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { rfcBlocks.splice(0, rfcBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  rfc: rfcDocument,
  copyMarkdown: rfcCopyMarkdown,
  copied: rfcCopied,
} = useRfcFormatter(rfcBlocks)

// ── Feature #134 — Tech Radar ─────────────────────────────────────────────────
const techRadarOpen = ref(false)
const techRadarBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { techRadarBlocks.splice(0, techRadarBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  entries: techRadarEntries,
  ringCounts: techRadarRingCounts,
  copyMarkdown: techRadarCopyMarkdown,
  copied: techRadarCopied,
} = useTechRadar(techRadarBlocks)

// ── Feature #136 — SLA Generator ──────────────────────────────────────────────
const slaOpen = ref(false)
const slaBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { slaBlocks.splice(0, slaBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  clauses: slaClauses,
  updateClause: slaUpdateClause,
  copyMarkdown: slaCopyMarkdown,
  copied: slaCopied,
} = useSlaGenerator(slaBlocks)

// ── Feature #137 — Pitch Deck ─────────────────────────────────────────────────
const pitchDeckOpen = ref(false)
const pitchDeckBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { pitchDeckBlocks.splice(0, pitchDeckBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  slides: pitchSlides,
  copyMarkdown: pitchDeckCopyMarkdown,
  copied: pitchDeckCopied,
} = usePitchDeck(pitchDeckBlocks)

// ── Feature #139 — User Journey Mapper ────────────────────────────────────────
const journeyOpen = ref(false)
const journeyBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { journeyBlocks.splice(0, journeyBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  copyMarkdown: copyJourney,
  copied: journeyCopied,
} = useUserJourney(journeyBlocks)

// ── Feature #141 — Delphi Estimation ──────────────────────────────────────────
const delphiOpen = ref(false)
const delphiBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { delphiBlocks.splice(0, delphiBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  entries: delphiEntries,
  currentRound: delphiCurrentRound,
  submitRound: delphiSubmitRound,
  advanceRound: delphiAdvanceRound,
  updateEstimate: delphiUpdateEstimate,
  openRound: delphiOpenRound,
  copyMarkdown: delphiCopyMarkdown,
  copied: delphiCopied,
} = useDelphiEstimation(delphiBlocks)

// ── Feature #142 — Marketing One-Pager ────────────────────────────────────────
const onePagerOpen = ref(false)
const onePagerBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { onePagerBlocks.splice(0, onePagerBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  onePager,
  copyMarkdown: copyOnePager,
  copied: onePagerCopied,
} = useMarketingOnePager(onePagerBlocks)

// ── Feature #144 — Feature Flag Rollout ──────────────────────────────────────
const rolloutOpen = ref(false)
const rolloutBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { rolloutBlocks.splice(0, rolloutBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  rolloutEntries,
  advancePhase: rolloutAdvance,
  resetPhase: rolloutReset,
  copyMarkdown: rolloutCopyMarkdown,
  copied: rolloutCopied,
} = useFeatureFlagRollout(rolloutBlocks)

// ── Feature #146 — Chaos Engineering ─────────────────────────────────────────
const chaosOpen = ref(false)
const chaosBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { chaosBlocks.splice(0, chaosBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  chaosScenarios,
  copyMarkdown: chaosCopyMarkdown,
  copied: chaosCopied,
} = useChaosEngineering(chaosBlocks)

// ── Feature #147 — SWOT Analysis ─────────────────────────────────────────────
const swotOpen = ref(false)
const swotBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { swotBlocks.splice(0, swotBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  swot,
  copyMarkdown: swotCopyMarkdown,
  copied: swotCopied,
} = useSwotAnalysis(swotBlocks)

// ── Feature #149 — Empathy Map ────────────────────────────────────────────────
const empathyOpen = ref(false)
const empathyBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { empathyBlocks.splice(0, empathyBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  cards: empathyCards,
  selectedId: empathySelectedId,
  selectCard: empathySelectCard,
  copyMarkdown: empathyCopyMarkdown,
  copied: empathyCopied,
} = useEmpathyMap(empathyBlocks)

// ── Feature #151 — NPS Predictor ─────────────────────────────────────────────
const npsOpen = ref(false)
const npsBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { npsBlocks.splice(0, npsBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  entries: npsEntries,
  aggregateNps,
  npsGrade,
  copyMarkdown: npsCopyMarkdown,
  copied: npsCopied,
} = useNpsPredictor(npsBlocks)

// ── Feature #152 — Changelog Entry ───────────────────────────────────────────
const changelogEntryOpen = ref(false)
const changelogEntryBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { changelogEntryBlocks.splice(0, changelogEntryBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  entries: changelogEntries,
  versionBump,
  copyAll: changelogEntryCopyAll,
  allCopied: changelogEntryAllCopied,
} = useChangelogEntry(changelogEntryBlocks)

// ── Feature #154 — Impact-Complexity Scatter ─────────────────────────────────
const scatterOpen = ref(false)
const scatterBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { scatterBlocks.splice(0, scatterBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  points: scatterPoints,
  selectedId: scatterSelectedId,
  selectPoint: scatterSelectPoint,
  quadrantOf: scatterQuadrantOf,
  copyMarkdown: scatterCopyMarkdown,
  copied: scatterCopied,
} = useImpactComplexity(scatterBlocks)

// ── Feature #156 — Jobs to be Done Canvas ─────────────────────────────────────
const jtbdBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { jtbdBlocks.splice(0, jtbdBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  cards: jtbdCards,
  selectedCard: jtbdSelectedCard,
  selectCard: jtbdSelectCard,
  copyAll: copyJtbd,
  allCopied: jtbdCopied,
} = useJtbd(jtbdBlocks)
const jtbdOpen = ref(false)

// ── Feature #157 — Spec as API Contract ───────────────────────────────────────
const apiContractOpen = ref(false)
const apiBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { apiBlocks.splice(0, apiBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  endpoints: apiEndpoints,
  copyYaml: copyApiYaml,
  yamlCopied: apiYamlCopied,
} = useApiContract(apiBlocks)

// ── Feature #159 — Experiment Mapper ─────────────────────────────────────────
const experimentBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { experimentBlocks.splice(0, experimentBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: experimentOpen,
  cards: experimentCards,
  results: experimentResults,
  setResult: setExperimentResult,
  copied: experimentCopied,
  copyAll: copyExperiments,
} = useExperimentMapper(experimentBlocks)

// ── Feature #161 — Value Decay ────────────────────────────────────────────────
const decayOpen = ref(false)
const decayBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { decayBlocks.splice(0, decayBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  entries: decayEntries,
  sortedByUrgency: decaySorted,
  copyMarkdown: copyDecay,
  copied: decayCopied,
} = useValueDecay(decayBlocks)

// ── Feature #162 — Press Kit ──────────────────────────────────────────────────
const pressKitOpen = ref(false)
const pressKitBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { pressKitBlocks.splice(0, pressKitBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  pressKit,
  copyMarkdown: copyPressKit,
  copied: pressKitCopied,
} = usePressKit(pressKitBlocks)

// ── Feature #164 — Risk-Adjusted Value ────────────────────────────────────────
const riskValueBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { riskValueBlocks.splice(0, riskValueBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: riskValueOpen,
  entries: riskValueEntries,
  setProbability: setRiskProb,
  totalAdjusted: riskAdjusted,
  totalRaw: riskRaw,
  copied: riskCopied,
  copyMarkdown: copyRiskValue,
} = useRiskValue(riskValueBlocks)

// ── Feature #166 — Personas Gallery ──────────────────────────────────────────
const personasBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { personasBlocks.splice(0, personasBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: personasOpen,
  personas: personaCards,
  copyMarkdown: copyPersonas,
} = usePersonasGallery(personasBlocks)

// ── Feature #167 — Sprint Backlog ─────────────────────────────────────────────
const backlogBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { backlogBlocks.splice(0, backlogBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: backlogOpen,
  stories: backlogStories,
  copyMode: backlogCopyMode,
  copied: backlogCopied,
  copyToClipboard: copyBacklog,
} = useSprintBacklog(backlogBlocks)

// ── Feature #169 — MLP Identifier ─────────────────────────────────────────────
const mlpBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { mlpBlocks.splice(0, mlpBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: mlpOpen,
  entries: mlpEntries,
  topThree: mlpTopThree,
  copyMarkdown: mlpCopyMarkdown,
  copied: mlpCopied,
} = useMinLovable(mlpBlocks)

// ── Feature #170 — Value Chain ─────────────────────────────────────────────────
const vcBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { vcBlocks.splice(0, vcBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: vcOpen,
  primaryActivities: vcPrimary,
  supportActivities: vcSupport,
  selectedId: vcSelectedId,
  select: vcSelect,
  copyMarkdown: vcCopyMarkdown,
  copied: vcCopied,
} = useValueChain(vcBlocks)

// ── Feature #171 — Investor FAQ ────────────────────────────────────────────────
const faqBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { faqBlocks.splice(0, faqBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: faqOpen,
  faqs: investorFaqs,
  copyMarkdown: faqCopyMarkdown,
  copied: faqCopied,
} = useInvestorFaq(faqBlocks)

// ── Feature #172 — WBS ────────────────────────────────────────────────────────
const wbsBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { wbsBlocks.splice(0, wbsBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: wbsOpen,
  nodes: wbsNodes,
  expandedIds: wbsExpandedIds,
  toggleExpand: wbsToggleExpand,
  copyMarkdown: wbsCopyMarkdown,
  copied: wbsCopied,
} = useWbs(wbsBlocks)

// ── Feature #174 — OKR Health Score ───────────────────────────────────────────
const okrHealthBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { okrHealthBlocks.splice(0, okrHealthBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: okrHealthOpen,
  entries: okrHealthEntries,
  overallScore: okrHealthOverallScore,
  overallGrade: okrHealthOverallGrade,
  copyMarkdown: okrHealthCopyMarkdown,
  copied: okrHealthCopied,
} = useOkrHealthScore(okrHealthBlocks)

// ── Feature #175 — Podcast Outline ────────────────────────────────────────────
const podcastBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { podcastBlocks.splice(0, podcastBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: podcastOpen,
  outline: podcastOutline,
  copyMarkdown: podcastCopyMarkdown,
  copied: podcastCopied,
} = usePodcastOutline(podcastBlocks)

// ── Feature #177 — Accessibility Scorecard ────────────────────────────────────
const scorecardBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { scorecardBlocks.splice(0, scorecardBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: scorecardOpen,
  entries: scorecardEntries,
  criteria: scorecardCriteria,
  overallGrade: scorecardOverallGrade,
  overallScore: scorecardOverallScore,
  copyMarkdown: scorecardCopyMarkdown,
  copied: scorecardCopied,
} = useAccessibilityScorecard(scorecardBlocks)

// ── Feature #179 — Feature Readiness Level ───────────────────────────────────
const readinessBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { readinessBlocks.splice(0, readinessBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: readinessOpen,
  entries: readinessEntries,
  avgLevel: readinessAvgLevel,
  overallStatus: readinessStatus,
  copyMarkdown: copyReadiness,
  copied: readinessCopied,
} = useFeatureReadiness(readinessBlocks)

// ── Feature #181 — Outcome-Assumption Map ────────────────────────────────────
const outcomeBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { outcomeBlocks.splice(0, outcomeBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: outcomeOpen,
  entries: outcomeEntries,
  selectedCategory: outcomeCategory,
  filteredEntries: outcomeFiltered,
  copyMarkdown: copyOutcome,
  copied: outcomeCopied,
} = useOutcomeMap(outcomeBlocks)

// ── Feature #182 — Tech Debt Register ───────────────────────────────────────
const debtBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { debtBlocks.splice(0, debtBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: debtOpen,
  entries: debtEntries,
  totalDebtScore,
  highCount: debtHighCount,
  copyMarkdown: copyDebt,
  copied: debtCopied,
} = useTechDebt(debtBlocks)

// ── Feature #184 — Spec Drift Detector ───────────────────────────────────────
const driftBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { driftBlocks.splice(0, driftBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: driftOpen,
  entries: driftEntries,
  driftCount,
  driftScore,
  copyMarkdown: copyDrift,
  copied: driftCopied,
} = useSpecDrift(driftBlocks)

// ── Feature #186 — User Story Priority Matrix ─────────────────────────────────
const priorityBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => { priorityBlocks.splice(0, priorityBlocks.length, ...(props.spec ? [props.spec] : [])) })
const {
  open: priorityOpen,
  entries: priorityEntries,
  selectedQuadrant: priorityQuadrant,
  filteredEntries: priorityFiltered,
  copyMarkdown: copyPriority,
  copied: priorityCopied,
} = usePriorityMatrix(priorityBlocks)

// ── Feature #187 — Feature Deprecation Radar ─────────────────────────────────
// reactive array so the composable's internal computed() re-runs when spec changes
const deprecationBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => {
  deprecationBlocks.splice(0, deprecationBlocks.length, ...(props.spec ? [props.spec] : []))
})
const {
  open: deprecationOpen,
  entries: deprecationEntries,
  highRiskCount: deprecationHighRiskCount,
  copyMarkdown: copyDeprecation,
  copied: deprecationCopied,
} = useDeprecationRadar(deprecationBlocks)

// ── Feature #189 — Learning Curve Estimator ──────────────────────────────────
const learningBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => {
  learningBlocks.splice(0, learningBlocks.length, ...(props.spec ? [props.spec] : []))
})
const {
  open: learningOpen,
  entries: learningEntries,
  avgHours: learningAvgHours,
  copyMarkdown: copyLearning,
  copied: learningCopied,
} = useLearningCurve(learningBlocks)

// ── Feature #191 — Value-Add Ratio Analyser ──────────────────────────────────
const vaRatioBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => {
  vaRatioBlocks.splice(0, vaRatioBlocks.length, ...(props.spec ? [props.spec] : []))
})
const {
  open: vaRatioOpen,
  entries: vaEntries,          // template uses vaEntries
  overallVaRatio,
  topWastes,
  copyMarkdown: copyVaRatio,
  copied: vaRatioCopied,
} = useValueAddRatio(vaRatioBlocks)

// ── Feature #192 — Impact-Gap Analyser ───────────────────────────────────────
const gapBlocks = reactive<import('../types/spec').SpecBlock[]>([])
watchEffect(() => {
  gapBlocks.splice(0, gapBlocks.length, ...(props.spec ? [props.spec] : []))
})
const {
  open: gapOpen,
  entries: gapEntries,
  largeGapCount: gapLargeGapCount,   // template uses gapLargeGapCount
  avgGapPct,
  copyMarkdown: copyGap,
  copied: gapCopied,
} = useGapAnalysis(gapBlocks)

// ── Copy / Download ──────────────────────────────────────────────────────────

const downloadHref = computed(() => {
  if (!props.markdown) return '#'
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(props.markdown)}`
})

/**
 * Builds an inline-styled HTML table for the spec — safe to paste into
 * Keynote, Numbers, Apple Notes, Pages.  Follows the table-copy standard:
 * white-space:normal on all cells, solid opaque colours, no border-radius.
 * Includes a Stakeholders section at the top, then F./V./S. tables.
 * V. entries include a "Stakeholder" column so attributions are visible.
 */
function _buildSpecHtml(spec: NonNullable<typeof props.spec>): string {
  const TD = 'padding:6px 10px;border:1px solid #e2e8f0;vertical-align:top;white-space:normal;font-size:13px;'
  const TH = TD + 'font-weight:600;'

  // ── header colour palettes (match STAKEHOLDER_PALETTES indices) ──────────
  const SH_BG  = ['#99f6e4','#bae6fd','#c7d2fe','#fecdd3','#fde68a','#f5d0fe']
  const SH_TXT = ['#115e59','#075985','#3730a3','#9f1239','#92400e','#701a75']

  function shRow(name: string, idx: number): string {
    const bg  = SH_BG[idx  % SH_BG.length]
    const txt = SH_TXT[idx % SH_TXT.length]
    return `<tr><td style="${TD}background:${bg};color:${txt};font-weight:600;">● ${name}</td></tr>`
  }

  // Collect unique stakeholders
  const shMap = new Map<string, number>()
  for (const v of spec.values) {
    const s = v.wishStakeholder?.trim()
    if (s && !shMap.has(s)) shMap.set(s, shMap.size)
  }

  let html = '<table style="border-collapse:collapse;font-family:system-ui,sans-serif;width:100%;">'

  // ── Stakeholders section ─────────────────────────────────────────────────
  if (shMap.size > 0) {
    html += `<tr><td colspan="6" style="${TH}background:#0f766e;color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase;">Stakeholders</td></tr>`
    html += `<tr><th style="${TH}background:#f0fdf4;">Who</th></tr>`
    for (const [name, idx] of shMap) html += shRow(name, idx)
  }

  // ── Functions section ────────────────────────────────────────────────────
  if (spec.functions.length) {
    html += `<tr><td colspan="6" style="${TH}background:#16a34a;color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase;">Functions</td></tr>`
    html += `<tr>
      <th style="${TH}background:#eff6ff;">ID</th>
      <th style="${TH}background:#eff6ff;">Description</th>
      <th style="${TH}background:#eff6ff;">Presence Test</th>
    </tr>`
    for (const f of spec.functions) {
      // DD-004 (2026-05-14): successCriteria → presenceTest; legacy fallback retained.
      html += `<tr>
        <td style="${TD}font-family:monospace;white-space:nowrap;">${f.id}</td>
        <td style="${TD}">${f.description ?? ''}</td>
        <td style="${TD}color:#374151;">${(f.presenceTest || f.successCriteria) ?? ''}</td>
      </tr>`
    }
  }

  // ── Values section ───────────────────────────────────────────────────────
  if (spec.values.length) {
    html += `<tr><td colspan="6" style="${TH}background:#5b21b6;color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase;">Values</td></tr>`
    html += `<tr>
      <th style="${TH}background:#f5f3ff;">Stakeholder</th>
      <th style="${TH}background:#f0fdf4;">ID</th>
      <th style="${TH}background:#f0fdf4;">Description</th>
      <th style="${TH}background:#f0fdf4;">Scale</th>
      <th style="${TH}background:#f0fdf4;">Tolerable</th>
      <th style="${TH}background:#f0fdf4;">Goal (Wish)</th>
    </tr>`
    for (const v of spec.values) {
      const shIdx = v.wishStakeholder ? (shMap.get(v.wishStakeholder.trim()) ?? 0) : -1
      const shBg  = shIdx >= 0 ? SH_BG[shIdx % SH_BG.length]  : '#f8fafc'
      const shTxt = shIdx >= 0 ? SH_TXT[shIdx % SH_TXT.length] : '#1e293b'
      html += `<tr>
        <td style="${TD}background:${shBg};color:${shTxt};font-weight:600;">${v.wishStakeholder ?? ''}</td>
        <td style="${TD}font-family:monospace;white-space:nowrap;">${v.id}</td>
        <td style="${TD}">${v.description ?? ''}</td>
        <td style="${TD}color:#374151;">${v.scale ?? ''}</td>
        <td style="${TD}background:#fffbeb;color:#92400e;">${v.tolerable ?? ''}</td>
        <td style="${TD}background:#f5f3ff;color:#4c1d95;">${v.goal ?? ''}</td>
      </tr>`
    }
  }

  // ── Solutions section ────────────────────────────────────────────────────
  if (spec.solutions.length) {
    html += `<tr><td colspan="6" style="${TH}background:#ea580c;color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase;">Solutions</td></tr>`
    html += `<tr>
      <th style="${TH}background:#faf5ff;">ID</th>
      <th style="${TH}background:#faf5ff;">Description</th>
      <th style="${TH}background:#faf5ff;">Impact</th>
    </tr>`
    for (const s of spec.solutions) {
      html += `<tr>
        <td style="${TD}font-family:monospace;white-space:nowrap;">${s.id}</td>
        <td style="${TD}">${s.description ?? ''}</td>
        <td style="${TD}color:#374151;">${s.impact ?? ''}</td>
      </tr>`
    }
  }

  html += '</table>'
  return html
}

async function copyToClipboard() {
  if (!props.spec) return
  const html  = _buildSpecHtml(props.spec)
  const plain = props.markdown || serialise(props.spec)
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html':  new Blob([html],  { type: 'text/html'  }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ])
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // ClipboardItem not available — fall back to plain text
    try {
      await navigator.clipboard.writeText(plain)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
    } catch { /* no-op */ }
  }
}

// Universal email rule (Tom 2026-05-29): email opens with HTML ALREADY in body —
// no manual paste required. Downloads a .eml file that Mail.app opens as a
// compose-draft with the coloured spec table pre-filled.
async function emailSpec(): Promise<void> {
  if (!props.spec) return
  const now = new Date()
  const ts  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const fC  = props.spec.functions.length
  const vC  = props.spec.values.length
  const sC  = props.spec.solutions.length
  const sub = `SEM Spec — ${fC}F ${vC}V ${sC}S · ${ts}`
  openEml(_buildSpecHtml(props.spec), sub)
  emailed.value = true
  setTimeout(() => { emailed.value = false }, 4000)
}

// ── Per-section export helpers ────────────────────────────────────────────────
// Builds a colored HTML table for a single Planguage section only.
// Shares the same palette and style constants as _buildSpecHtml.
function _buildSectionHtml(section: 'stakeholders' | 'functions' | 'values' | 'solutions' | 'constraints'): string {
  const spec = props.spec
  if (!spec) return ''
  const TD = 'padding:6px 10px;border:1px solid #e2e8f0;vertical-align:top;white-space:normal;font-size:13px;'
  const TH = TD + 'font-weight:600;'
  const SH_BG  = ['#99f6e4','#bae6fd','#c7d2fe','#fecdd3','#fde68a','#f5d0fe']
  const SH_TXT = ['#115e59','#075985','#3730a3','#9f1239','#92400e','#701a75']
  // Build shMap from values for the non-stakeholder sections (needed for value row colouring).
  const shMap = new Map<string, number>()
  for (const v of spec.values) {
    const s = v.wishStakeholder?.trim()
    if (s && !shMap.has(s)) shMap.set(s, shMap.size)
  }
  let html = '<table style="border-collapse:collapse;font-family:system-ui,sans-serif;width:100%;">'
  if (section === 'stakeholders') {
    // Bug fix 2026-05-29: use specStakeholderCards (which combines wishStakeholder fields
    // AND rawInput.stakes parsed names) so the full list is preserved — not just the
    // stakeholders who happen to have a wishStakeholder field on a V. entry.
    const cards = specStakeholderCards.value
    html += `<tr><td colspan="4" style="${TH}background:#0f766e;color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase;">Stakeholders (${cards.length})</td></tr>`
    html += `<tr><th style="${TH}background:#f0fdf4;">Who</th><th style="${TH}background:#f0fdf4;">Values</th><th style="${TH}background:#f0fdf4;">Wish</th><th style="${TH}background:#f0fdf4;">Constraints</th></tr>`
    for (const [idx, sh] of cards.entries()) {
      const bg  = SH_BG[idx % SH_BG.length]
      const txt = SH_TXT[idx % SH_TXT.length]
      const valueList = sh.linkedValues.length
        ? sh.linkedValues.map(v => `${v.id}: ${v.description}`).join('<br>')
        : '—'
      const constraintList = sh.linkedConstraints.length
        ? sh.linkedConstraints.map(c => `${c.id}`).join(', ')
        : '—'
      html += `<tr>`
      html += `<td style="${TD}background:${bg};color:${txt};font-weight:600;">● ${sh.name}</td>`
      html += `<td style="${TD}font-size:12px;">${valueList}</td>`
      html += `<td style="${TD}color:#92400e;font-style:italic;font-size:12px;">${sh.wish ? `"${sh.wish}"` : '—'}</td>`
      html += `<td style="${TD}font-family:monospace;font-size:11px;color:#dc2626;">${constraintList}</td>`
      html += `</tr>`
    }
  } else if (section === 'functions') {
    html += `<tr><td colspan="3" style="${TH}background:#16a34a;color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase;">Functions</td></tr>`
    html += `<tr><th style="${TH}background:#eff6ff;">ID</th><th style="${TH}background:#eff6ff;">Description</th><th style="${TH}background:#eff6ff;">Presence Test</th></tr>`
    for (const f of spec.functions) {
      html += `<tr><td style="${TD}font-family:monospace;white-space:nowrap;">${f.id}</td><td style="${TD}">${f.description ?? ''}</td><td style="${TD}color:#374151;">${(f.presenceTest || (f as any).successCriteria) ?? ''}</td></tr>`
    }
  } else if (section === 'values') {
    html += `<tr><td colspan="6" style="${TH}background:#5b21b6;color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase;">Values</td></tr>`
    html += `<tr><th style="${TH}background:#f5f3ff;">Stakeholder</th><th style="${TH}background:#f0fdf4;">ID</th><th style="${TH}background:#f0fdf4;">Description</th><th style="${TH}background:#f0fdf4;">Scale</th><th style="${TH}background:#f0fdf4;">Tolerable</th><th style="${TH}background:#f0fdf4;">Goal</th></tr>`
    for (const v of spec.values) {
      const shIdx = v.wishStakeholder ? (shMap.get(v.wishStakeholder.trim()) ?? 0) : -1
      const shBg = shIdx >= 0 ? SH_BG[shIdx % SH_BG.length] : '#f8fafc'
      const shTxt = shIdx >= 0 ? SH_TXT[shIdx % SH_TXT.length] : '#1e293b'
      html += `<tr><td style="${TD}background:${shBg};color:${shTxt};font-weight:600;">${v.wishStakeholder ?? ''}</td><td style="${TD}font-family:monospace;white-space:nowrap;">${v.id}</td><td style="${TD}">${v.description ?? ''}</td><td style="${TD}color:#374151;">${v.scale ?? ''}</td><td style="${TD}background:#fffbeb;color:#92400e;">${v.tolerable ?? ''}</td><td style="${TD}background:#f5f3ff;color:#4c1d95;">${v.goal ?? ''}</td></tr>`
    }
  } else if (section === 'solutions') {
    html += `<tr><td colspan="3" style="${TH}background:#ea580c;color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase;">Solutions</td></tr>`
    html += `<tr><th style="${TH}background:#faf5ff;">ID</th><th style="${TH}background:#faf5ff;">Description</th><th style="${TH}background:#faf5ff;">Impact</th></tr>`
    for (const s of spec.solutions) {
      html += `<tr><td style="${TD}font-family:monospace;white-space:nowrap;">${s.id}</td><td style="${TD}">${s.description ?? ''}</td><td style="${TD}color:#374151;">${(s as any).impact ?? ''}</td></tr>`
    }
  } else if (section === 'constraints') {
    html += `<tr><td colspan="2" style="${TH}background:#dc2626;color:#fff;font-size:11px;letter-spacing:.06em;text-transform:uppercase;">Constraints</td></tr>`
    html += `<tr><th style="${TH}background:#fff1f2;">ID</th><th style="${TH}background:#fff1f2;">Binary Rule</th></tr>`
    for (const c of (spec.constraints ?? [])) {
      html += `<tr><td style="${TD}font-family:monospace;white-space:nowrap;color:#dc2626;">${c.id}</td><td style="${TD}">${c.description ?? ''}</td></tr>`
    }
  }
  html += '</table>'
  return html
}

async function copySection(section: string): Promise<void> {
  if (!props.spec) return
  const html  = _buildSectionHtml(section as Parameters<typeof _buildSectionHtml>[0])
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html':  new Blob([html],  { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    })])
  } catch {
    await navigator.clipboard.writeText(plain)
  }
  copiedSection.value = section
  setTimeout(() => { copiedSection.value = null }, 2000)
}

async function emailSection(section: string): Promise<void> {
  if (!props.spec) return
  const sectionName = section.charAt(0).toUpperCase() + section.slice(1)
  const now = new Date()
  const ts  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const sub = `SEM Spec — ${sectionName} · ${ts}`
  openEml(_buildSectionHtml(section as Parameters<typeof _buildSectionHtml>[0]), sub)
  emailedSection.value = section
  setTimeout(() => { emailedSection.value = null }, 4000)
}

// ── Feature Organisation Design — Command Palette Registry ───────────────────
// Populated after all handlers are declared so references are valid.
;(function buildRegistry() {
  const entries: typeof paletteRegistry = [
    // REVIEW
    { key:'43',  emoji:'🔍', label:'Peer Review',          profiles:['Quality'],     action:() => handlePeerReview() },
    { key:'48',  emoji:'🧠', label:'Gilb Suggestion',      profiles:['Quality'],     action:() => handleKaiCritique() },
    { key:'60',  emoji:'🔍', label:'Gaps',                 profiles:['Quality'],     action:() => handleGaps() },
    { key:'38',  emoji:'♿', label:'Accessibility Check',  profiles:['Quality'],     action:() => handleA11yCheck() },
    { key:'92',  emoji:'⚠️', label:'Anti-patterns',        profiles:['Quality'],     action:() => { antiPatternsOpen.value = !antiPatternsOpen.value; if (antiPatternsOpen.value) scanAntiPatterns() } },
    { key:'76',  emoji:'🔥', label:'Compliance Heatmap',   profiles:['Quality'],     action:() => { heatmapOpen.value = true; computeHeatmap() } },
    { key:'103', emoji:'🛡️', label:'Resilience Checker',  profiles:['Quality'],     action:() => { resilienceOpen.value = !resilienceOpen.value; scanResilience() } },
    { key:'129', emoji:'💡', label:'Innovation Score',      profiles:['Quality'],     action:() => { innovationOpen.value = !innovationOpen.value } },
    { key:'111', emoji:'✅', label:'INVEST Checker',        profiles:['Quality','Tuning'], action:() => { investOpen.value = !investOpen.value } },
    { key:'62',  emoji:'🚢', label:'Ship Check',            profiles:['Quality'],     action:() => handleShipCheck() },
    { key:'126', emoji:'🔎', label:'Regulatory Scanner',    profiles:['Quality'],     action:() => { regScanOpen.value = !regScanOpen.value; if (regScanOpen.value) runRegScan() } },
    // TRANSFORM
    { key:'19',  emoji:'🚀', label:'Make Ambitious',        profiles:['Tuning'],      action:() => handleMakeAmbitious() },
    { key:'28',  emoji:'🌿', label:'Lean Plan',             profiles:['Tuning'],      action:() => handleLean() },
    { key:'57',  emoji:'✂️', label:'Simplify',             profiles:['Tuning'],      action:() => handleSimplify() },
    { key:'88',  emoji:'✨', label:'Auto-Improve',          profiles:['Tuning'],      action:() => { autoImproveOpen.value = true; runAutoImprove() } },
    { key:'42',  emoji:'📊', label:'Goal Sensitivity',      profiles:['Tuning'],      action:() => { sensitivityOpen.value = !sensitivityOpen.value } },
    { key:'70',  emoji:'🌐', label:'Translate',             profiles:['All'],         action:() => { translateOpen.value = !translateOpen.value } },
    { key:'110', emoji:'🚩', label:'Feature Flags',         profiles:['All'],         action:() => { flagsOpen.value = !flagsOpen.value } },
    // METRICS
    { key:'72',  emoji:'🌾', label:'RICE Score',            profiles:['Tuning','Finance'], action:() => handleRice() },
    { key:'78',  emoji:'🎯', label:'Confidence Overlay',    profiles:['Tuning'],      action:() => { confidenceOpen.value = !confidenceOpen.value } },
    { key:'104', emoji:'🪜', label:'Goal Ladder',           profiles:['Visualizing'], action:() => { ladderOpen.value = !ladderOpen.value } },
    { key:'105', emoji:'📏', label:'Benchmark',             profiles:['Tuning'],      action:() => { benchmarkOpen.value = !benchmarkOpen.value } },
    { key:'112', emoji:'💰', label:'ROI Calculator',        profiles:['Finance','Tuning'], action:() => { roiOpen.value = !roiOpen.value } },
    { key:'23',  emoji:'🎯', label:'OKR Export',            profiles:['All'],         action:() => { okrOpen.value = !okrOpen.value } },
    { key:'102', emoji:'🔗', label:'OKR Crosswalk',         profiles:['All'],         action:() => { okrCrosswalkOpen.value = !okrCrosswalkOpen.value; buildOkrCrosswalk() } },
    { key:'151', emoji:'⭐', label:'NPS Predictor',         profiles:['Tuning'],      action:() => { npsOpen.value = !npsOpen.value } },
    { key:'154', emoji:'⚡', label:'Impact vs Complexity',  profiles:['Visualizing'], action:() => { scatterOpen.value = !scatterOpen.value } },
    // COMMUNICATE
    { key:'44',  emoji:'📄', label:'Executive Summary',     profiles:['All'],         action:() => handleExecSummary() },
    { key:'83',  emoji:'🎤', label:'Elevator Pitch',        profiles:['All'],         action:() => { pitchOpen.value = true; generatePitch() } },
    { key:'63',  emoji:'📖', label:'Story',                 profiles:['All'],         action:() => handleNarrative() },
    { key:'90',  emoji:'🐦', label:'Tweet Thread',          profiles:['All'],         action:() => { tweetOpen.value = !tweetOpen.value; generateTweets() } },
    { key:'81',  emoji:'⚔️', label:'Debate Mode',          profiles:['All'],         action:() => { debateOpen.value = true; generateDebate() } },
    { key:'94',  emoji:'📝', label:'Contract',              profiles:['All'],         action:() => { contractOpen.value = !contractOpen.value; generateClauses() } },
    { key:'99',  emoji:'🥊', label:'Battle Card',           profiles:['All'],         action:() => { battleOpen.value = !battleOpen.value; analyseSpec() } },
    { key:'52',  emoji:'📋', label:'Regulation Map',        profiles:['Quality'],     action:() => handleRegs() },
    { key:'124', emoji:'🧪', label:'Hypothesis Cards',      profiles:['All'],         action:() => { hypothesisOpen.value = !hypothesisOpen.value; if (hypothesisOpen.value) generateHyp() } },
    { key:'127', emoji:'👔', label:'Job Description',       profiles:['All'],         action:() => { jdOpen.value = !jdOpen.value; if (jdOpen.value) generateJd() } },
    { key:'130', emoji:'📄', label:'RFC Formatter',         profiles:['All'],         action:() => { rfcOpen.value = !rfcOpen.value } },
    { key:'149', emoji:'💬', label:'Empathy Map',           profiles:['Visualizing'], action:() => { empathyOpen.value = !empathyOpen.value } },
    { key:'156', emoji:'🎯', label:'JTBD Canvas',           profiles:['All'],         action:() => { jtbdOpen.value = !jtbdOpen.value } },
    // DIAGRAMS
    { key:'109', emoji:'🗺️', label:'Impact Map',           profiles:['Visualizing'], action:() => { impactMapOpen.value = !impactMapOpen.value } },
    { key:'96',  emoji:'🗂️', label:'Story Map',            profiles:['Visualizing'], action:() => { storyMapOpen.value = !storyMapOpen.value } },
    { key:'80',  emoji:'🔗', label:'Dep Graph',             profiles:['Visualizing'], action:() => { graphOpen.value = !graphOpen.value } },
    { key:'46',  emoji:'🏊', label:'Heat Lane',             profiles:['Visualizing'], action:() => { heatLaneOpen.value = true } },
    { key:'100', emoji:'📊', label:'Market Size',           profiles:['Finance'],     action:() => { marketOpen.value = !marketOpen.value; estimateMarket() } },
    // STRATEGY
    { key:'75',  emoji:'🎤', label:'Interview Guide',       profiles:['All'],         action:() => { guideOpen.value = true; generateGuide() } },
    { key:'85',  emoji:'👤', label:'Persona Challenge',     profiles:['All'],         action:() => { personaOpen.value = !personaOpen.value } },
    { key:'87',  emoji:'📌', label:'Assumptions',           profiles:['Quality'],     action:() => { assumptionsOpen.value = !assumptionsOpen.value; if (assumptionsOpen.value) extractAssumptions() } },
    { key:'54',  emoji:'📅', label:'Time Capsule',          profiles:['All'],         action:() => handleTimeCapsule() },
    { key:'131', emoji:'🥊', label:'Competitor Matrix',     profiles:['All'],         action:() => { competitorOpen.value = !competitorOpen.value } },
    { key:'144', emoji:'🚩', label:'Feature Rollout',       profiles:['All'],         action:() => { rolloutOpen.value = !rolloutOpen.value } },
    { key:'146', emoji:'💥', label:'Chaos Engineering',     profiles:['All'],         action:() => { chaosOpen.value = !chaosOpen.value } },
    { key:'147', emoji:'⚔️', label:'SWOT Analysis',        profiles:['Visualizing'], action:() => { swotOpen.value = !swotOpen.value } },
    // RECORDS
    { key:'61',  emoji:'📖', label:'Glossary',              profiles:['All'],         action:() => handleGlossary() },
    { key:'69',  emoji:'📋', label:'Changelog',             profiles:['All'],         action:() => { changelogOpen.value = !changelogOpen.value } },
    { key:'108', emoji:'📓', label:'Decisions',             profiles:['All'],         action:() => { decisionsOpen.value = !decisionsOpen.value } },
    { key:'25',  emoji:'✓',  label:'Sign Off',              profiles:['All'],         action:() => { signOffOpen.value = !signOffOpen.value } },
    { key:'79',  emoji:'🏥', label:'Health PDF',            profiles:['Quality'],     action:() => exportHealthPDF() },
    { key:'33',  emoji:'📝', label:'Notion Export',         profiles:['All'],         action:() => handleNotionExport() },
    { key:'152', emoji:'📝', label:'Changelog Entry',       profiles:['All'],         action:() => { changelogEntryOpen.value = !changelogEntryOpen.value } },
    { key:'157', emoji:'🔌', label:'API Contract',          profiles:['All'],         action:() => { apiContractOpen.value = !apiContractOpen.value } },
    { key:'159', emoji:'🧬', label:'Experiments',           profiles:['All'],         action:() => { experimentOpen.value = !experimentOpen.value } },
    { key:'161', emoji:'📉', label:'Value Decay',           profiles:['Tuning'],      action:() => { decayOpen.value = !decayOpen.value } },
    { key:'162', emoji:'📰', label:'Press Kit',             profiles:['All'],         action:() => { pressKitOpen.value = !pressKitOpen.value } },
    { key:'164', emoji:'⚠️', label:'Risk-Adjusted Value',  profiles:['Finance'],     action:() => { riskValueOpen.value = !riskValueOpen.value } },
    { key:'166', emoji:'👤', label:'Personas Gallery',      profiles:['All'],         action:() => { personasOpen.value = !personasOpen.value } },
    { key:'167', emoji:'📋', label:'Sprint Backlog',        profiles:['Timing'],      action:() => { backlogOpen.value = !backlogOpen.value } },
    { key:'169', emoji:'💎', label:'MLP Identifier',        profiles:['Quality','Tuning'], action:() => { mlpOpen.value = !mlpOpen.value } },
    { key:'170', emoji:'⛓️', label:'Value Chain',          profiles:['Visualizing'], action:() => { vcOpen.value = !vcOpen.value } },
    { key:'171', emoji:'💼', label:'Investor FAQ',          profiles:['Finance'],     action:() => { faqOpen.value = !faqOpen.value } },
    { key:'172', emoji:'📂', label:'WBS',                   profiles:['Timing'],      action:() => { wbsOpen.value = !wbsOpen.value } },
    { key:'174', emoji:'🏥', label:'OKR Health',            profiles:['Quality'],     action:() => { okrHealthOpen.value = !okrHealthOpen.value } },
    { key:'175', emoji:'🎙️', label:'Podcast Outline',      profiles:['All'],         action:() => { podcastOpen.value = !podcastOpen.value } },
    { key:'177', emoji:'♿', label:'Accessibility Scorecard',profiles:['Quality'],    action:() => { scorecardOpen.value = !scorecardOpen.value } },
    { key:'179', emoji:'🚀', label:'Feature Readiness',     profiles:['Timing'],      action:() => { readinessOpen.value = !readinessOpen.value } },
    { key:'181', emoji:'🗺️', label:'Outcome Map',          profiles:['Visualizing'], action:() => { outcomeOpen.value = !outcomeOpen.value } },
    { key:'182', emoji:'💸', label:'Tech Debt',             profiles:['Quality','Timing'], action:() => { debtOpen.value = !debtOpen.value } },
    { key:'184', emoji:'📡', label:'Spec Drift',            profiles:['Quality'],     action:() => { driftOpen.value = !driftOpen.value } },
    { key:'186', emoji:'⭐', label:'Priority Matrix',       profiles:['Quality'],     action:() => { priorityOpen.value = !priorityOpen.value } },
    { key:'187', emoji:'⚰️', label:'Deprecation Radar',    profiles:['Quality'],     action:() => { deprecationOpen.value = !deprecationOpen.value } },
    { key:'189', emoji:'📚', label:'Learning Curve',        profiles:['Quality'],     action:() => { learningOpen.value = !learningOpen.value } },
    { key:'191', emoji:'♻️', label:'VA Ratio Analyser',    profiles:['Tuning'],      action:() => { vaRatioOpen.value = !vaRatioOpen.value } },
    { key:'192', emoji:'📊', label:'Impact-Gap Analyser',   profiles:['Tuning'],      action:() => { gapOpen.value = !gapOpen.value } },
    // top-bar extras
    { key:'119', emoji:'🔴', label:'Critical Path',         profiles:['Timing'],      action:() => { criticalPathOpen.value = !criticalPathOpen.value } },
    { key:'120', emoji:'📰', label:'Press Release',         profiles:['All'],         action:() => openPressRelease() },
    { key:'122', emoji:'🧱', label:'Constraints',           profiles:['All'],         action:() => { constraintsOpen.value = !constraintsOpen.value } },
    { key:'123', emoji:'🌊', label:'Value Stream',          profiles:['Visualizing'], action:() => { valueStreamOpen.value = !valueStreamOpen.value } },
    { key:'115', emoji:'🏛️', label:'TOGAF View',           profiles:['Visualizing'], action:() => { togafOpen.value = !togafOpen.value } },
    { key:'117', emoji:'💵', label:'Cost of Quality',       profiles:['Finance'],     action:() => { coqOpen.value = !coqOpen.value } },
    { key:'118', emoji:'💬', label:'Sentiment Analyser',    profiles:['Quality'],     action:() => { sentimentOpen.value = !sentimentOpen.value } },
    { key:'136', emoji:'📋', label:'SLA Generator',         profiles:['Finance'],     action:() => { slaOpen.value = !slaOpen.value } },
    { key:'137', emoji:'📊', label:'Pitch Deck',            profiles:['Finance'],     action:() => { pitchDeckOpen.value = !pitchDeckOpen.value } },
    { key:'139', emoji:'🗺️', label:'User Journey',         profiles:['Visualizing'], action:() => { journeyOpen.value = !journeyOpen.value } },
    { key:'141', emoji:'🎲', label:'Delphi Estimation',     profiles:['Timing'],      action:() => { delphiOpen.value = !delphiOpen.value } },
    { key:'142', emoji:'📄', label:'Marketing One-Pager',   profiles:['All'],         action:() => { onePagerOpen.value = !onePagerOpen.value } },
    { key:'134', emoji:'📡', label:'Tech Radar',            profiles:['Visualizing'], action:() => { techRadarOpen.value = !techRadarOpen.value } },
    // former top-bar utilities — moved into menus for a cleaner header
    { key:'97',  emoji:'⚡', label:'Team Energy',          profiles:['All'],         action:() => { energyPanelOpen.value = !energyPanelOpen.value } },
    { key:'7',   emoji:'🔗', label:'Share Link',            profiles:['All'],         action:() => toggleShare() },
    { key:'13',  emoji:'⚡', label:'Challenge',             profiles:['All'],         action:() => handleChallenge() },
    { key:'14',  emoji:'✱', label:'Export PDF',            profiles:['All'],         action:() => handleExportPdf() },
    { key:'49',  emoji:'⑂',  label:'Fork',                  profiles:['All'],         action:() => handleFork() },
  ]
  paletteRegistry.push(...entries)
})()
</script>

<style scoped>
/* Toast slide-up + bounce */
.spec-toast-enter-active { animation: spec-toast-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.spec-toast-leave-active  { transition: opacity 180ms ease, transform 180ms ease; }
.spec-toast-leave-to      { opacity: 0; transform: translateX(-50%) translateY(-4px); }
@keyframes spec-toast-in {
  0%   { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.92); }
  60%  { opacity: 1; transform: translateX(-50%) translateY(-3px) scale(1.04); }
  80%  { transform: translateX(-50%) translateY(1px) scale(0.99); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

/*
 * Slide transitions for Before/After toggle.
 * slide-left: Before slides in from the right, After exits to the left.
 * slide-right: After slides in from the left, Before exits to the right.
 */

/* slide-left — entering from right, leaving to left */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform 300ms ease, opacity 300ms ease;
}
.slide-left-enter-from {
  transform: translateX(32px);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(-32px);
  opacity: 0;
}

/* slide-right — entering from left, leaving to right */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 300ms ease, opacity 300ms ease;
}
.slide-right-enter-from {
  transform: translateX(-32px);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(32px);
  opacity: 0;
}

/*
 * One-shot pulse animation for structured fields when switching Back → After.
 * Uses a brief background-colour flash rather than the Tailwind animate-pulse
 * (which loops); this fires once and fades naturally.
 */
@keyframes pulse-once {
  0%   { background-color: inherit; }
  30%  { background-color: rgb(219 234 254); } /* blue-100 */
  100% { background-color: inherit; }
}

.animate-pulse-once {
  animation: pulse-once 600ms ease-out forwards;
}

/*
 * Feature Organisation Design — Command Palette fade transition
 */
.palette-fade-enter-active,
.palette-fade-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.palette-fade-enter-from,
.palette-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/*
 * Feature #10 — Animated Spec Entry Build
 * Each spec card slides up and fades in sequentially.
 * animation-delay is set inline per card: 80ms × index.
 * opacity starts at 0 so cards are hidden until animation fires.
 */
@keyframes spec-entry-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.spec-entry-card {
  opacity: 0;
  animation: spec-entry-in 350ms ease-out forwards;
}

/*
 * Feature #22 — Quality ring arc: animate from 0 to final length over 800ms on mount.
 * The stroke-dashoffset is controlled reactively; the transition smooths the change.
 */
.quality-arc {
  transition: stroke-dashoffset 800ms ease-out;
}
</style>
