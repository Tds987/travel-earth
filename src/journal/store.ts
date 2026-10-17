import { useEffect, useState, useSyncExternalStore } from 'react'
import { db } from './db'
import { checkVideo, compressImage } from './media'
import { cloud, cloudConfigured, mediaUrl, signedInEmail } from './supabase'
import type { Entry, LocalEntry, MediaItem } from './types'

export type SyncStatus =
  | 'local' // no cloud configured: journal stays on this phone
  | 'signed-out'
  | 'offline'
  | 'syncing'
  | 'synced'
  | 'error'

type State = { entries: LocalEntry[]; status: SyncStatus; error?: string; loaded: boolean }

let state: State = { entries: [], status: 'local', loaded: false }
const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const byTime = (a: Entry, b: Entry) => a.at.localeCompare(b.at)

async function reload() {
  const all = await db.allEntries()
  set({ entries: all.filter((e) => !e.deleted).sort(byTime), loaded: true })
}

function baseStatus(): SyncStatus {
  if (!cloudConfigured) return 'local'
  if (!signedInEmail()) return 'signed-out'
  if (!navigator.onLine) return 'offline'
  return 'synced'
}

const ext = (blob: Blob, type: MediaItem['type']) =>
  blob.type.includes('png')
    ? 'png'
    : blob.type.includes('quicktime')
      ? 'mov'
      : blob.type.includes('webm')
        ? 'webm'
        : type === 'video'
          ? 'mp4'
          : 'jpg'

let syncing: Promise<void> | null = null

/** Push anything not yet in the cloud. Safe to call often. */
export function sync(): Promise<void> {
  if (baseStatus() !== 'synced') {
    set({ status: baseStatus() })
    return Promise.resolve()
  }
  syncing ??= (async () => {
    set({ status: 'syncing', error: undefined })
    try {
      for (const e of await db.allEntries()) {
        if (e.synced) continue
        if (e.deleted) {
          await cloud.remove(e.id)
          await db.deleteEntry(e.id)
          await Promise.all(e.media.map((m) => db.deleteBlob(m.id)))
          continue
        }
        for (const m of e.media) {
          if (m.path) continue
          const blob = await db.getBlob(m.id)
          if (!blob) continue
          const path = `${e.id}/${m.id}.${ext(blob, m.type)}`
          await cloud.upload(path, blob)
          m.path = path
          await db.putEntry(e) // remember progress if a later upload fails
        }
        await cloud.upsert(e)
        await db.putEntry({ ...e, synced: true })
      }
      await reload()
      set({ status: 'synced' })
    } catch (err) {
      set({ status: navigator.onLine ? 'error' : 'offline', error: String(err) })
    } finally {
      syncing = null
    }
  })()
  return syncing
}

/** After signing in on a new phone: bring down entries that only exist in the cloud. */
export async function pullFromCloud() {
  if (baseStatus() !== 'synced') return
  const local = new Set((await db.allEntries()).map((e) => e.id))
  for (const e of await cloud.list())
    if (!local.has(e.id)) await db.putEntry({ ...e, synced: true })
  await reload()
  await sync()
}

export type NewEntry = Omit<Entry, 'id' | 'at' | 'media'> & { at?: string }

/** Save an entry (with photos/clips) on the phone, then sync in the background. */
export async function addEntry(input: NewEntry, files: File[] = []): Promise<string | null> {
  const media: MediaItem[] = []
  for (const file of files) {
    const id = crypto.randomUUID()
    if (file.type.startsWith('video/')) {
      const problem = await checkVideo(file)
      if (problem) return problem
      await db.putBlob(id, file)
      media.push({ id, type: 'video' })
    } else {
      await db.putBlob(id, await compressImage(file))
      media.push({ id, type: 'image' })
    }
  }
  const entry: LocalEntry = {
    ...input,
    id: crypto.randomUUID(),
    at: input.at ?? new Date().toISOString(),
    media,
    synced: false,
  }
  await db.putEntry(entry)
  await reload()
  void sync()
  return null
}

export async function updateEntry(entry: LocalEntry) {
  await db.putEntry({ ...entry, synced: false })
  await reload()
  void sync()
}

export async function removeEntry(entry: LocalEntry) {
  await db.putEntry({ ...entry, deleted: true, synced: false })
  await reload()
  void sync()
}

/** Re-check status after signing in/out. */
export async function refreshStatus() {
  set({ status: baseStatus() })
  await pullFromCloud().catch((err) => set({ status: 'error', error: String(err) }))
}

let started = false
function start() {
  if (started) return
  started = true
  set({ status: baseStatus() })
  void reload().then(() => pullFromCloud().catch(() => sync()))
  window.addEventListener('online', () => void sync())
  window.addEventListener('offline', () => set({ status: 'offline' }))
}

export function useJournal() {
  start()
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/** Object URL for a local blob, or the cloud URL once uploaded. */
export function useMediaSrc(item: MediaItem): string | null {
  const [local, setLocal] = useState<string | null>(null)
  useEffect(() => {
    let url: string | null = null
    let alive = true
    db.getBlob(item.id).then((blob) => {
      if (!alive || !blob) return
      url = URL.createObjectURL(blob)
      setLocal(url)
    })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [item.id])
  return local ?? (item.path ? mediaUrl(item.path) : null)
}
