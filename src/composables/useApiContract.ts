// UNIT_TYPE=Composable
// Feature #157 — "Spec as API contract" generator
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { SpecBlock } from '../types/spec'

export interface ApiEndpoint {
  entryId: string
  entryName: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  requestSchema: string
  responseSchema: string
  yamlBlock: string
}

const METHODS: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = ['GET', 'POST', 'PUT', 'DELETE']

export function charCodeSeed(id: string): number {
  let s = 0
  for (let i = 0; i < id.length; i++) {
    s += id.charCodeAt(i)
  }
  return s
}

export function buildPath(id: string): string {
  return '/' + id.toLowerCase().replace(/\./g, '/').replace(/[^a-z0-9/]/g, '-')
}

export function buildRequestSchema(method: 'GET' | 'POST' | 'PUT' | 'DELETE', description: string): string {
  if (method === 'GET' || method === 'DELETE') return 'none'
  const firstWord = description.trim().split(/\s+/)[0] ?? 'item'
  return `{ id: string; payload: object }` // derived from first word of description: firstWord is metadata
}

export function buildResponseSchema(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  entryId: string,
): string {
  const status = method === 'POST' ? 201 : 200
  return `{ status: ${status}, data: { ${entryId}: object } }`
}

export function buildYamlBlock(
  path: string,
  method: string,
  requestSchema: string,
  responseSchema: string,
): string {
  return `- path: ${path}\n  method: ${method}\n  request: ${requestSchema}\n  response: ${responseSchema}`
}

export function buildApiEndpoint(entryId: string, description: string): ApiEndpoint {
  const seed = charCodeSeed(entryId)
  const method = METHODS[seed % 4]
  const path = buildPath(entryId)
  const requestSchema = buildRequestSchema(method, description)
  const responseSchema = buildResponseSchema(method, entryId)
  const yamlBlock = buildYamlBlock(path, method, requestSchema, responseSchema)

  return {
    entryId,
    entryName: entryId,
    method,
    path,
    requestSchema,
    responseSchema,
    yamlBlock,
  }
}

export function formatFullYaml(endpoints: ApiEndpoint[]): string {
  return endpoints.map((e) => e.yamlBlock).join('\n')
}

export function useApiContract(blocks: SpecBlock[]) {
  const yamlCopied: Ref<boolean> = ref(false)

  const endpoints: ComputedRef<ApiEndpoint[]> = computed<ApiEndpoint[]>(() => {
    const result: ApiEndpoint[] = []
    for (const block of blocks) {
      for (const f of block.functions) {
        result.push(buildApiEndpoint(f.id, f.description))
      }
    }
    for (const block of blocks) {
      for (const s of block.solutions) {
        result.push(buildApiEndpoint(s.id, s.description))
      }
    }
    return result
  })

  async function copyYaml(): Promise<void> {
    if (!endpoints.value.length) return
    const text = formatFullYaml(endpoints.value)
    try {
      await navigator.clipboard.writeText(text)
      yamlCopied.value = true
      setTimeout(() => {
        yamlCopied.value = false
      }, 2000)
    } catch {
      // clipboard not available
    }
  }

  return { endpoints, copyYaml, yamlCopied }
}
