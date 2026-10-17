export type EntryKind = 'visit' | 'checkin' | 'note' | 'stay'

export type MediaItem = {
  id: string
  type: 'image' | 'video'
  /** Path in the Supabase "journal" bucket once uploaded. */
  path?: string
}

export type Entry = {
  id: string
  /** ISO time it happened. */
  at: string
  kind: EntryKind
  placeId?: string
  title?: string
  body?: string
  lat?: number
  lon?: number
  media: MediaItem[]
}

/** What's kept on the phone: the entry plus whether it has reached the cloud. */
export type LocalEntry = Entry & { synced: boolean; deleted?: boolean }
