// vizThumbs.ts — Mini SVG thumbnails for every VisualisePanelModal tab.
// Shared between VisualisePanelModal (gallery cards) and EvoPlanView (strip pills).
// All viewBox="0 0 80 44". No marker IDs — arrowheads are manual polygons.

export type VisualisTab =
  | 'flow'
  | 'efficiency'
  | 'radar'
  | 'arch'
  | 'deps'
  | 'risk'
  | 'finance'
  | 'swimlane'

export const VIZ_THUMBS: Record<VisualisTab, string> = {
  // Value Flow: 6 indigo columns (Tasks→Evo→Solutions→Values→Functions→Stakeholders) + arrows
  flow: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="1"  y="6"  width="9" height="32" rx="2" fill="#ddd6fe"/>
    <rect x="14" y="10" width="9" height="24" rx="2" fill="#a5b4fc"/>
    <rect x="27" y="14" width="9" height="16" rx="2" fill="#818cf8"/>
    <rect x="40" y="10" width="9" height="24" rx="2" fill="#6366f1"/>
    <rect x="53" y="6"  width="9" height="32" rx="2" fill="#4338ca"/>
    <rect x="66" y="8"  width="9" height="28" rx="2" fill="#3730a3"/>
    <line x1="10" y1="22" x2="13" y2="22" stroke="#a5b4fc" stroke-width="1.2"/>
    <polygon points="11,20.5 14,22 11,23.5" fill="#a5b4fc"/>
    <line x1="23" y1="22" x2="26" y2="22" stroke="#818cf8" stroke-width="1.2"/>
    <polygon points="24,20.5 27,22 24,23.5" fill="#818cf8"/>
    <line x1="36" y1="22" x2="39" y2="22" stroke="#6366f1" stroke-width="1.2"/>
    <polygon points="37,20.5 40,22 37,23.5" fill="#6366f1"/>
    <line x1="49" y1="22" x2="52" y2="22" stroke="#4338ca" stroke-width="1.2"/>
    <polygon points="50,20.5 53,22 50,23.5" fill="#4338ca"/>
    <line x1="62" y1="22" x2="65" y2="22" stroke="#3730a3" stroke-width="1.2"/>
    <polygon points="63,20.5 66,22 63,23.5" fill="#3730a3"/>
  </svg>`,

  // Radar: concentric rings + 6 axes + filled data polygon with dots
  radar: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <circle cx="40" cy="22" r="18" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
    <circle cx="40" cy="22" r="12" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
    <circle cx="40" cy="22" r="6"  fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="40"   y2="4"  stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="55.6" y2="13" stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="55.6" y2="31" stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="40"   y2="40" stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="24.4" y2="31" stroke="#cbd5e1" stroke-width="0.8"/>
    <line x1="40" y1="22" x2="24.4" y2="13" stroke="#cbd5e1" stroke-width="0.8"/>
    <polygon points="40,9 52,14 53,32 40,38 26,30 29,12"
      fill="#6366f1" fill-opacity="0.25" stroke="#6366f1" stroke-width="1.5"/>
    <circle cx="40"  cy="9"  r="2" fill="#6366f1"/>
    <circle cx="52"  cy="14" r="2" fill="#6366f1"/>
    <circle cx="53"  cy="32" r="2" fill="#6366f1"/>
    <circle cx="40"  cy="38" r="2" fill="#6366f1"/>
    <circle cx="26"  cy="30" r="2" fill="#6366f1"/>
    <circle cx="29"  cy="12" r="2" fill="#6366f1"/>
  </svg>`,

  // Architecture (TOGAF): 4 coloured horizontal bands
  arch: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="2" y="2"  width="76" height="9" rx="2" fill="#fde68a"/>
    <rect x="2" y="13" width="76" height="9" rx="2" fill="#bbf7d0"/>
    <rect x="2" y="24" width="76" height="9" rx="2" fill="#bfdbfe"/>
    <rect x="2" y="35" width="76" height="8" rx="2" fill="#e9d5ff"/>
    <text x="6" y="9"  font-size="5" font-family="system-ui,sans-serif" fill="#92400e" font-weight="600">Business</text>
    <text x="6" y="20" font-size="5" font-family="system-ui,sans-serif" fill="#065f46" font-weight="600">Application</text>
    <text x="6" y="31" font-size="5" font-family="system-ui,sans-serif" fill="#1e40af" font-weight="600">Data</text>
    <text x="6" y="41" font-size="5" font-family="system-ui,sans-serif" fill="#6b21a8" font-weight="600">Technology</text>
  </svg>`,

  // Dependencies: 3 columns of entry cards (V · F · S) with horizontal links
  deps: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="1"  y="4"  width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
    <rect x="1"  y="14" width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
    <rect x="1"  y="24" width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
    <rect x="1"  y="34" width="19" height="8" rx="2" fill="#eef2ff" stroke="#a5b4fc" stroke-width="0.8"/>
    <rect x="30" y="4"  width="19" height="8" rx="2" fill="#fffbeb" stroke="#fcd34d" stroke-width="0.8"/>
    <rect x="30" y="14" width="19" height="8" rx="2" fill="#fffbeb" stroke="#fcd34d" stroke-width="0.8"/>
    <rect x="30" y="24" width="19" height="8" rx="2" fill="#fffbeb" stroke="#fcd34d" stroke-width="0.8"/>
    <rect x="60" y="4"  width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
    <rect x="60" y="14" width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
    <rect x="60" y="24" width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
    <rect x="60" y="34" width="19" height="8" rx="2" fill="#ecfdf5" stroke="#6ee7b7" stroke-width="0.8"/>
    <line x1="20" y1="8"  x2="30" y2="8"  stroke="#c7d2fe" stroke-width="0.8"/>
    <line x1="20" y1="18" x2="30" y2="18" stroke="#c7d2fe" stroke-width="0.8"/>
    <line x1="20" y1="28" x2="30" y2="28" stroke="#c7d2fe" stroke-width="0.8"/>
    <line x1="49" y1="8"  x2="60" y2="8"  stroke="#a7f3d0" stroke-width="0.8"/>
    <line x1="49" y1="18" x2="60" y2="18" stroke="#a7f3d0" stroke-width="0.8"/>
    <line x1="49" y1="28" x2="60" y2="28" stroke="#a7f3d0" stroke-width="0.8"/>
  </svg>`,

  // Risk Matrix: 3×3 grid coloured green→red on diagonal
  risk: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="14" y="2"  width="19" height="12" rx="2" fill="#d1fae5"/>
    <rect x="35" y="2"  width="19" height="12" rx="2" fill="#fef3c7"/>
    <rect x="56" y="2"  width="19" height="12" rx="2" fill="#fed7aa"/>
    <rect x="14" y="16" width="19" height="12" rx="2" fill="#fef3c7"/>
    <rect x="35" y="16" width="19" height="12" rx="2" fill="#fed7aa"/>
    <rect x="56" y="16" width="19" height="12" rx="2" fill="#fecaca"/>
    <rect x="14" y="30" width="19" height="12" rx="2" fill="#fed7aa"/>
    <rect x="35" y="30" width="19" height="12" rx="2" fill="#fecaca"/>
    <rect x="56" y="30" width="19" height="12" rx="2" fill="#f87171"/>
    <text x="0" y="10"  font-size="4" font-family="system-ui,sans-serif" fill="#059669" font-weight="600">Lo↕</text>
    <text x="0" y="24"  font-size="4" font-family="system-ui,sans-serif" fill="#d97706" font-weight="600">Md</text>
    <text x="0" y="38"  font-size="4" font-family="system-ui,sans-serif" fill="#dc2626" font-weight="600">Hi</text>
  </svg>`,

  // Finance: paired horizontal bar chart (tolerable faded + goal solid, 3 values)
  finance: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="12" y="2"  width="64" height="4" rx="2" fill="#e0e7ff"/>
    <rect x="12" y="2"  width="44" height="4" rx="2" fill="#6366f1" opacity="0.4"/>
    <rect x="12" y="7"  width="64" height="6" rx="3" fill="#e0e7ff"/>
    <rect x="12" y="7"  width="50" height="6" rx="3" fill="#6366f1"/>
    <rect x="12" y="18" width="64" height="4" rx="2" fill="#fce7f3"/>
    <rect x="12" y="18" width="30" height="4" rx="2" fill="#ec4899" opacity="0.4"/>
    <rect x="12" y="23" width="64" height="6" rx="3" fill="#fce7f3"/>
    <rect x="12" y="23" width="36" height="6" rx="3" fill="#ec4899"/>
    <rect x="12" y="34" width="64" height="4" rx="2" fill="#fef3c7"/>
    <rect x="12" y="34" width="52" height="4" rx="2" fill="#f59e0b" opacity="0.4"/>
    <rect x="12" y="39" width="64" height="4" rx="2" fill="#fef3c7"/>
    <rect x="12" y="39" width="56" height="4" rx="2" fill="#f59e0b"/>
    <text x="0" y="8"  font-size="4.5" font-family="system-ui,sans-serif" fill="#6366f1" font-weight="600">V1</text>
    <text x="0" y="27" font-size="4.5" font-family="system-ui,sans-serif" fill="#ec4899" font-weight="600">V2</text>
    <text x="0" y="42" font-size="4.5" font-family="system-ui,sans-serif" fill="#f59e0b" font-weight="600">V3</text>
  </svg>`,

  // Swimlane / HeatLane: 4 horizontal lanes × 4 Evo-step columns, colour-coded by intensity
  swimlane: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <text x="1" y="9"  font-size="4" font-family="system-ui,sans-serif" fill="#92400e">S1</text>
    <text x="1" y="20" font-size="4" font-family="system-ui,sans-serif" fill="#065f46">S2</text>
    <text x="1" y="31" font-size="4" font-family="system-ui,sans-serif" fill="#1e40af">S3</text>
    <text x="1" y="42" font-size="4" font-family="system-ui,sans-serif" fill="#6b21a8">S4</text>
    <rect x="12" y="2"  width="15" height="10" rx="1.5" fill="#fde68a"/>
    <rect x="29" y="2"  width="15" height="10" rx="1.5" fill="#fcd34d"/>
    <rect x="46" y="2"  width="15" height="10" rx="1.5" fill="#f59e0b"/>
    <rect x="63" y="2"  width="15" height="10" rx="1.5" fill="#fde68a" opacity="0.5"/>
    <rect x="12" y="14" width="15" height="10" rx="1.5" fill="#bbf7d0"/>
    <rect x="29" y="14" width="15" height="10" rx="1.5" fill="#6ee7b7"/>
    <rect x="46" y="14" width="15" height="10" rx="1.5" fill="#34d399"/>
    <rect x="63" y="14" width="15" height="10" rx="1.5" fill="#6ee7b7"/>
    <rect x="12" y="26" width="15" height="10" rx="1.5" fill="#bfdbfe"/>
    <rect x="29" y="26" width="15" height="10" rx="1.5" fill="#93c5fd"/>
    <rect x="46" y="26" width="15" height="10" rx="1.5" fill="#60a5fa"/>
    <rect x="63" y="26" width="15" height="10" rx="1.5" fill="#93c5fd"/>
    <rect x="12" y="38" width="15" height="6"  rx="1.5" fill="#e9d5ff"/>
    <rect x="29" y="38" width="15" height="6"  rx="1.5" fill="#d8b4fe"/>
    <rect x="46" y="38" width="15" height="6"  rx="1.5" fill="#c084fc"/>
    <rect x="63" y="38" width="15" height="6"  rx="1.5" fill="#d8b4fe"/>
  </svg>`,

  // Efficiency: 3 zones (green cost cards | orange solution cards | violet value nodes) + bezier edges
  efficiency: `<svg viewBox="0 0 80 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect x="1"  y="4"  width="13" height="10" rx="2" fill="#f0fdf4" stroke="#4ade80" stroke-width="0.8"/>
    <rect x="1"  y="17" width="13" height="10" rx="2" fill="#f0fdf4" stroke="#86efac" stroke-width="0.8"/>
    <rect x="1"  y="30" width="13" height="10" rx="2" fill="#fef2f2" stroke="#fca5a5" stroke-width="0.8"/>
    <rect x="25" y="1"  width="26" height="13" rx="3" fill="#f0fdf4" stroke="#86efac" stroke-width="1.2"/>
    <rect x="25" y="17" width="26" height="12" rx="3" fill="#fffbeb" stroke="#fcd34d" stroke-width="1.2"/>
    <rect x="25" y="32" width="26" height="11" rx="3" fill="#fef2f2" stroke="#fca5a5" stroke-width="1.2"/>
    <rect x="61" y="5"  width="18" height="8"  rx="4" fill="#f5f3ff" stroke="#a78bfa" stroke-width="0.8"/>
    <rect x="61" y="18" width="18" height="8"  rx="4" fill="#f5f3ff" stroke="#a78bfa" stroke-width="0.8"/>
    <rect x="61" y="31" width="18" height="8"  rx="4" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="0.8"/>
    <line x1="14" y1="9"  x2="25" y2="7.5" stroke="#166534" stroke-width="1.2" stroke-dasharray="2 1.5"/>
    <line x1="14" y1="22" x2="25" y2="23"   stroke="#166534" stroke-width="1.8" stroke-dasharray="2 1.5"/>
    <line x1="14" y1="35" x2="25" y2="37.5" stroke="#166534" stroke-width="0.9" stroke-dasharray="2 1.5"/>
    <path d="M51 7.5 C56 7.5 56 9 61 9"   stroke="#7c3aed" stroke-width="3"   fill="none" opacity="0.85"/>
    <path d="M51 7.5 C56 7.5 56 22 61 22" stroke="#7c3aed" stroke-width="1"   fill="none" opacity="0.5"/>
    <path d="M51 23  C56 23  56 22 61 22" stroke="#7c3aed" stroke-width="4.5" fill="none" opacity="0.9"/>
    <path d="M51 23  C56 23  56 35 61 35" stroke="#7c3aed" stroke-width="1.5" fill="none" opacity="0.55"/>
    <path d="M51 37.5 C56 37.5 56 35 61 35" stroke="#7c3aed" stroke-width="1" fill="none" opacity="0.4"/>
    <text x="26" y="11"  font-size="4.5" fill="#15803d"  font-weight="700" font-family="system-ui">5.1</text>
    <text x="26" y="27"  font-size="4.5" fill="#b45309"  font-weight="700" font-family="system-ui">2.7</text>
    <text x="26" y="41"  font-size="4.5" fill="#b91c1c"  font-weight="700" font-family="system-ui">1.3</text>
  </svg>`,
}

/** Items shown in the EvoPlanView visualise strip (the 6 Tom specified). */
export const VIZ_STRIP_ITEMS: { tab: VisualisTab; label: string }[] = [
  { tab: 'flow',     label: 'Value Flow'   },
  { tab: 'radar',    label: 'Radar'        },
  { tab: 'arch',     label: 'Architecture' },
  { tab: 'risk',     label: 'Risk'         },
  { tab: 'finance',  label: 'Finance'      },
  { tab: 'swimlane', label: 'Swimlane'     },
]
