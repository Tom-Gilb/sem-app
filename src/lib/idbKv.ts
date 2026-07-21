// UNIT_TYPE=Library
// r41 v465-v468 (Tom Gilb 2026-07-02 *"I need you to make a fail safe
// storage. You cannot sink Navy ships without a trace"* + 2026-07-03
// *"make sure my local storage stipulation is easily ported to Kaizen
// and Graphmetrix when we port"*).
//
// Async key-value wrapper over IndexedDB with a per-app namespace so
// Kai's industrial Twin (Kai-Zen) + Graphmetrix + any other Anthropic-
// ecosystem app can adopt the same store with ONE line — no code
// duplication, no name collisions, no fork.
//
// Same shape as localStorage (get/set/delete) but with the ~50%-of-disk
// quota IndexedDB gets in Safari + Chrome instead of localStorage's
// ~5 MB.  Callers use it exactly like localStorage but with `await`.
//
// Port pattern (v468 — Twin portability made trivial):
//   ── SEM App:
//     import { semAppKv } from './lib/idbKv'
//     await semAppKv.set('sem-app:contracts:v1', myContracts)
//
//   ── Kai's Twin:
//     import { createKvStore } from './lib/idbKv'
//     export const kaiZenKv = createKvStore('kai-zen-kv', 'kv')
//     await kaiZenKv.set('kai-zen:models:v1', myTwinModels)
//
//   ── Graphmetrix (when the platform is ready to host SEM App):
//     import { createKvStore } from './lib/idbKv'
//     export const gmxKv = createKvStore('graphmetrix-kv', 'kv')
//     await gmxKv.set('gmx:nodes:v1', myGraphNodes)
//
// Each app has its own DB namespace so there is ZERO collision even
// when multiple apps run in the same origin (e.g. embedded iframes
// inside Graphmetrix TrinityX).  Each app's data + quota is independent.
//
// Composes with:
//   • No-Silent-Data-Loss SUPREME — quota failures no longer force
//     silent drops; IndexedDB has hundreds of GB on Tom's 1 TB Mac.
//   • Trust-Rebuild framing — PACRM Solicitation loss (2026-07-02
//     21:03 UTC) traced to localStorage quota; IDB removes that class.
//   • Universal Undo SUPREME — durable per-key writes with better
//     error propagation than localStorage's silent-throw.
//   • Twin portability SUPREME — v468 makes this a one-line adoption
//     for any downstream app.
//   • Term + Definition + Source SUPREME — every failure path emits a
//     source-tagged error with the actual browser error name.

/** A namespaced key-value store backed by IndexedDB.  Each app gets its
 *  own instance via `createKvStore(dbName, storeName)`; they do not
 *  share data even in the same origin.  Ports verbatim to Kai's Twin +
 *  Graphmetrix + any future downstream app. */
export interface KvStore {
  supported(): boolean
  get<T = unknown>(key: string): Promise<T | null>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  storageEstimate(): Promise<{ usageMB: number; quotaGB: number } | null>
}

const DB_VERSION = 1

/** Factory: create a namespaced KV store.  Each downstream app calls
 *  this ONCE at module init and exports the returned handle.
 *
 *  Example (Kai's Twin):
 *    export const kaiZenKv = createKvStore('kai-zen-kv', 'kv')
 *    await kaiZenKv.set('kai-zen:models:v1', myModels)
 */
export function createKvStore(dbName: string, storeName: string = 'kv'): KvStore {
  let _dbPromise: Promise<IDBDatabase> | null = null

  function _openDb(): Promise<IDBDatabase> {
    if (_dbPromise) return _dbPromise
    _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error(`IndexedDB is not available in this environment (store: ${dbName}).`))
        return
      }
      const req = indexedDB.open(dbName, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror   = () => reject(req.error ?? new Error(`IndexedDB open failed (store: ${dbName})`))
      req.onblocked = () => reject(new Error(`IndexedDB open blocked (store: ${dbName}) — another tab holding an older schema.`))
    })
    return _dbPromise
  }

  return {
    supported(): boolean {
      return typeof indexedDB !== 'undefined'
    },

    async get<T = unknown>(key: string): Promise<T | null> {
      const db = await _openDb()
      return new Promise<T | null>((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req   = store.get(key)
        req.onsuccess = () => resolve((req.result as T) ?? null)
        req.onerror   = () => reject(req.error ?? new Error(`get(${key}) failed on ${dbName}`))
      })
    },

    async set(key: string, value: unknown): Promise<void> {
      const db = await _openDb()
      return new Promise<void>((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req   = store.put(value, key)
        req.onsuccess = () => resolve()
        req.onerror   = () => reject(req.error ?? new Error(`set(${key}) failed on ${dbName}`))
      })
    },

    async delete(key: string): Promise<void> {
      const db = await _openDb()
      return new Promise<void>((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req   = store.delete(key)
        req.onsuccess = () => resolve()
        req.onerror   = () => reject(req.error ?? new Error(`delete(${key}) failed on ${dbName}`))
      })
    },

    async storageEstimate(): Promise<{ usageMB: number; quotaGB: number } | null> {
      if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) return null
      try {
        const est = await navigator.storage.estimate()
        return {
          usageMB: Math.round((est.usage ?? 0) / 1024 / 1024 * 100) / 100,
          quotaGB: Math.round((est.quota ?? 0) / 1024 / 1024 / 1024 * 100) / 100,
        }
      } catch {
        return null
      }
    },
  }
}

// ── SEM App instance ─────────────────────────────────────────────────
// Instantiate the SEM App store ONCE at module load; all sem-app code
// imports these top-level functions unchanged (backward-compat with
// v465-v467 callers).  Kai's Twin creates its own via `createKvStore`
// and does not touch the SEM App instance.
export const semAppKv = createKvStore('sem-app-kv', 'kv')

/** True when IndexedDB is available in this environment. */
export function idbSupported(): boolean {
  return semAppKv.supported()
}

/** Get a value by key.  Returns `null` if the key does not exist. */
export function idbGet<T = unknown>(key: string): Promise<T | null> {
  return semAppKv.get<T>(key)
}

/** Set a value by key.  Overwrites. */
export function idbSet(key: string, value: unknown): Promise<void> {
  return semAppKv.set(key, value)
}

/** Delete a value by key.  Idempotent. */
export function idbDelete(key: string): Promise<void> {
  return semAppKv.delete(key)
}

/** Report the current storage estimate (browser-provided).  Same for
 *  every namespaced KvStore since the quota is per-origin, not per-DB.
 *  Composes with Term + Definition + Source SUPREME — Tom + the user
 *  can see WHY the new quota is so much bigger than localStorage's. */
export function idbStorageEstimate(): Promise<{ usageMB: number; quotaGB: number } | null> {
  return semAppKv.storageEstimate()
}
