// useCopyright.ts — Copyright & Attribution information
// Singleton store; persisted in localStorage.
// Provides both the short footer notice (Stage 1) and all fields
// for the full CopyrightPanel (intent, permission, credit format).

import { ref, computed } from 'vue'

// ── Data model ────────────────────────────────────────────────────────────────

export interface CopyrightInfo {
  /** Legal owner name shown in the © line */
  ownerName: string
  /** Copyright year — string so owner can write "2025–2026" */
  year: string
  /** Product name */
  appName: string
  /** One-line tagline shown below the © notice */
  tagline: string
  /** Statement of intent — purpose and permitted use */
  intent: string
  /** Email address or URL for permission requests */
  permissionContact: string
  /** What to include in a permission request (sent alongside the contact) */
  permissionInstructions: string
  /** The exact attribution string users should paste into their documents */
  creditFormat: string
  /** Any additional notes the owner wants to add (blank by default) */
  additionalNotes: string
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS: CopyrightInfo = {
  ownerName:               'Gilb International',
  year:                    new Date().getFullYear().toString(),
  appName:                 'SEM App',
  tagline:                 'Planguage-based value planning',
  intent:
    'SEM App is a proprietary planning and specification tool built on Planguage principles ' +
    'developed by Tom Gilb. It is provided for individual and organisational use to support ' +
    'value-driven software and systems planning. Reproduction, distribution, or commercial ' +
    'adaptation of this software or its generated outputs — in whole or in part — requires ' +
    'written permission from the copyright holder.',
  permissionContact:       'Tom@Gilb.com or Kai@Gilb.com',
  permissionInstructions:
    'Please include your name or organisation, a brief description of your intended use, ' +
    'and the context in which SEM App or its outputs would appear. We aim to respond within ' +
    '5 business days.',
  creditFormat:
    'Produced using SEM App by Gilb International (gilb.com). ' +
    'Based on Planguage principles by Tom Gilb (gilb.com). ' +
    '© ' + new Date().getFullYear().toString() + ' Gilb International.',
  additionalNotes:         '',
}

// ── Singleton ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sem-copyright-info'

/**
 * Migration scrub (2026-05-12): the original DEFAULTS shipped with a
 * hallucinated owner name "Simons Carelton" and a fake email
 * "contact@simonscarelton.com". Any user who saved their copyright info
 * before this fix has those strings persisted in localStorage. This sweep
 * replaces them with the real owner ("Gilb International") and the real
 * permission contacts ("Tom@Gilb.com or Kai@Gilb.com") on next load.
 */
function _scrubHallucinations(info: CopyrightInfo): CopyrightInfo {
  const out = { ...info }
  const re = /Simons?\s*Carelton|Simons?\s*Carleton/gi
  if (re.test(out.ownerName))   out.ownerName   = DEFAULTS.ownerName
  if (re.test(out.creditFormat)) out.creditFormat = out.creditFormat
    .replace(re, 'Gilb International')
    .replace(/semapp\.io/gi, 'gilb.com')
  if (/simons?carelton\.com|simons?carleton\.com/i.test(out.permissionContact)) {
    out.permissionContact = DEFAULTS.permissionContact
  }
  return out
}

function _load(): CopyrightInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    // Spread over DEFAULTS so any new fields added later get their default values
    const merged = { ...DEFAULTS, ...JSON.parse(raw) }
    return _scrubHallucinations(merged)
  } catch {
    return { ...DEFAULTS }
  }
}

const _info = ref<CopyrightInfo>(_load())

function _persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(_info.value))
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useCopyright() {
  const info = computed(() => _info.value)

  /** Compact one-line notice for the Stage 1 footer */
  const shortNotice = computed(
    () => `© ${_info.value.year} ${_info.value.ownerName} · ${_info.value.appName}`,
  )

  /** Plain-text rendering of the full notice (for clipboard copy) */
  const fullNoticeText = computed(() => {
    const i = _info.value
    const lines: string[] = [
      `© ${i.year} ${i.ownerName}  —  ${i.appName}`,
      i.tagline,
      '',
      '── Intent ─────────────────────────────────────',
      i.intent,
      '',
      '── How to ask permission ───────────────────────',
      `Contact: ${i.permissionContact}`,
      i.permissionInstructions,
      '',
      '── How to give credit ──────────────────────────',
      i.creditFormat,
    ]
    if (i.additionalNotes.trim()) {
      lines.push('', '── Additional notes ────────────────────────────', i.additionalNotes)
    }
    return lines.join('\n').trim()
  })

  function updateInfo(patch: Partial<CopyrightInfo>): void {
    _info.value = { ..._info.value, ...patch }
    _persist()
  }

  function resetToDefaults(): void {
    _info.value = { ...DEFAULTS }
    _persist()
  }

  return {
    info,
    shortNotice,
    fullNoticeText,
    updateInfo,
    resetToDefaults,
    DEFAULTS,
  }
}
