// UNIT_TYPE=Hook
// useDocumentImport — extract text from a remote URL or a local file.
//
// URL path: calls the Supabase Edge Function `fetch-document` which handles
//   CORS and rewrites Google Sheets / Docs / Slides viewer URLs to export URLs.
// File path:
//   • Plain text (.txt / .md / .csv / .rtf / .html / .htm) — FileReader.readAsText
//   • DOCX (.docx) — `mammoth` local extraction (already a dependency)
//   • PDF  (.pdf)  — pdfjs-dist v3 in no-worker (main-thread) mode
//                    Tom 2026-05-14: "surely pdf is bare minimum"
//                    Note: pdfjs-dist v5 dropped reliable no-worker support
//                    (ReadableStream error in internal message pump). Pinned to
//                    v3.11.174 which has 3+ years of proven Vite browser usage.
//
// DD-006: every authoring surface must ingest stakeholder documents.
//
// Usage:
//   const { importFromUrl, importFromFile, importLoading, importError, clearImport } = useDocumentImport()

import { ref } from 'vue'
import { getSupabaseClient } from '../config/supabase'
// pdfjs-dist v3 is loaded as a plain <script> from /public/pdf.js (the UMD/IIFE
// build copied from node_modules). Same technique as mermaid — the UMD bundle
// sets globalThis.pdfjsLib and crashes esbuild when pre-bundled, so we keep it
// entirely outside Vite's module pipeline. pdf.worker.js is also in /public/.
// The script is injected lazily on first PDF import and cached in _pdfjsLib.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfjsLib = { GlobalWorkerOptions: { workerSrc: string }; getDocument(src: { data: ArrayBuffer }): { promise: Promise<any> } }
let _pdfjsLib: PdfjsLib | null = null

function _loadPdfJs(): Promise<PdfjsLib> {
  if (_pdfjsLib) return Promise.resolve(_pdfjsLib)
  // globalThis.pdfjsLib may already exist if the script was injected in a
  // previous call (e.g. HMR resets _pdfjsLib but the global persists).
  // Always set workerSrc regardless of which path we take.
  const existing = (globalThis as Record<string, unknown>).pdfjsLib as PdfjsLib | undefined
  if (existing) {
    existing.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'
    _pdfjsLib = existing
    return Promise.resolve(existing)
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/pdf.js'
    script.onload = () => {
      const lib = (globalThis as Record<string, unknown>).pdfjsLib as PdfjsLib | undefined
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js'
        _pdfjsLib = lib
        resolve(lib)
      } else {
        reject(new Error('pdfjsLib global not found after /pdf.js loaded'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load /pdf.js — check public/ folder'))
    document.head.appendChild(script)
  })
}

export function useDocumentImport() {
  const importLoading = ref(false)
  const importError = ref('')

  /**
   * Fetch a URL via the `fetch-document` Supabase Edge Function.
   */
  async function importFromUrl(url: string): Promise<string | null> {
    importLoading.value = true
    importError.value = ''
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.functions.invoke<{ text: string; error?: string }>(
        'fetch-document',
        { body: { url } },
      )
      if (error) { importError.value = error.message ?? 'Failed to reach the import service.'; return null }
      if (data?.error) { importError.value = data.error; return null }
      return data?.text ?? null
    } catch (e) {
      importError.value = e instanceof Error ? e.message : 'Unknown error while fetching the document.'
      return null
    } finally {
      importLoading.value = false
    }
  }

  /**
   * Read a local file and return extracted text.
   * Supported: PDF, DOCX, plain text (txt/md/csv/rtf/html).
   */
  async function importFromFile(file: File): Promise<string | null> {
    importLoading.value = true
    importError.value = ''

    const name = (file.name || '').toLowerCase()
    const type = (file.type || '').toLowerCase()
    const isPdf  = name.endsWith('.pdf')  || type === 'application/pdf'
    const isDocx = name.endsWith('.docx') ||
      type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    try {
      if (isPdf)  return await readPdf(file)
      if (isDocx) return await readDocx(file)
      return await readAsText(file)
    } catch (e) {
      importError.value = e instanceof Error
        ? `Could not read the file: ${e.message}`
        : 'Could not read the file.'
      return null
    } finally {
      importLoading.value = false
    }
  }

  // ── PDF (pdfjs-dist v3, script-tag loader) ───────────────────────────────
  async function readPdf(file: File): Promise<string | null> {
    const pdfjsLib = await _loadPdfJs()
    const buf = await file.arrayBuffer()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loadingTask = pdfjsLib.getDocument({ data: buf })
    const doc = await loadingTask.promise

    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const pageText = (content.items as Array<{ str?: string }>)
        .map((it) => it.str ?? '')
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim()
      if (pageText) pages.push(pageText)
    }

    const text = pages.join('\n\n').trim()
    if (!text) {
      importError.value = 'The PDF has no extractable text (scanned image? try OCR first).'
      return null
    }
    return text
  }

  // ── DOCX (mammoth) ───────────────────────────────────────────────────────
  async function readDocx(file: File): Promise<string | null> {
    const mammoth = await import('mammoth/mammoth.browser')
    const buf = await file.arrayBuffer()
    const result = await (mammoth as unknown as {
      extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
    }).extractRawText({ arrayBuffer: buf })
    const text = (result.value || '').trim()
    if (!text) { importError.value = 'The Word document appears to be empty.'; return null }
    return text
  }

  // ── Plain text (FileReader) ──────────────────────────────────────────────
  function readAsText(file: File): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        if (!text?.trim()) { importError.value = 'The file appears to be empty.'; resolve(null); return }
        resolve(text)
      }
      reader.onerror = () => {
        importError.value = 'Could not read the file.'
        resolve(null)
      }
      reader.readAsText(file, 'utf-8')
    })
  }

  function clearImport(): void { importError.value = '' }

  return { importFromUrl, importFromFile, importLoading, importError, clearImport }
}
