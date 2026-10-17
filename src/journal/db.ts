import type { LocalEntry } from './types'

// Tiny IndexedDB wrapper: entries and media blobs live on the phone first,
// so the journal works with no signal and syncs later.
const DB_NAME = 'travel-earth'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('entries'))
        db.createObjectStore('entries', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(store, mode).objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const db = {
  allEntries: () => run<LocalEntry[]>('entries', 'readonly', (s) => s.getAll()),
  putEntry: (e: LocalEntry) => run('entries', 'readwrite', (s) => s.put(e)),
  deleteEntry: (id: string) => run('entries', 'readwrite', (s) => s.delete(id)),
  getBlob: (id: string) => run<Blob | undefined>('blobs', 'readonly', (s) => s.get(id)),
  putBlob: (id: string, blob: Blob) => run('blobs', 'readwrite', (s) => s.put(blob, id)),
  deleteBlob: (id: string) => run('blobs', 'readwrite', (s) => s.delete(id)),
}
