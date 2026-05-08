// UNIT_TYPE=Hook
// useDocumentImport — extract text from a remote URL or a local file.
//
// URL path: calls the Supabase Edge Function `fetch-document` which handles
//   CORS and rewrites Google Sheets / Docs / Slides viewer URLs to export URLs.
// File path: FileReader for .txt / .md / .csv (no extra packages needed).
//
// Usage:
//   const { importFromUrl, importFromFile, importLoading, importError, clearImport } = useDocumentImport()

import { ref } from 'vue'
import { getSupabaseClient } from '../config/supabase'

export function useDocumentImport() {
  const importLoading = ref(false)
  const importError = ref('')

  /**
   * Fetch a URL via the `fetch-document` Supabase Edge Function.
   * Handles Google Sheets, Google Docs, Google Slides, and generic public URLs.
   * Returns the extracted text, or null on failure (importError is set).
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

      if (error) {
        importError.value = error.message ?? 'Failed to reach the import service.'
        return null
      }

      if (data?.error) {
        importError.value = data.error
        return null
      }

      return data?.text ?? null
    } catch (e) {
      importError.value =
        e instanceof Error ? e.message : 'Unknown error while fetching the document.'
      return null
    } finally {
      importLoading.value = false
    }
  }

  /**
   * Read a local file as plain text.
   * Supported: .txt, .md, .csv (and any other UTF-8 text format).
   * Returns the file content, or null on failure.
   */
  async function importFromFile(file: File): Promise<string | null> {
    importLoading.value = true
    importError.value = ''

    return new Promise<string | null>((resolve) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        importLoading.value = false
        const text = e.target?.result as string
        if (!text?.trim()) {
          importError.value = 'The file appears to be empty.'
          resolve(null)
          return
        }
        resolve(text)
      }

      reader.onerror = () => {
        importLoading.value = false
        importError.value = 'Could not read the file. Make sure it is a plain-text file.'
        resolve(null)
      }

      reader.readAsText(file, 'utf-8')
    })
  }

  function clearImport(): void {
    importError.value = ''
  }

  return { importFromUrl, importFromFile, importLoading, importError, clearImport }
}
