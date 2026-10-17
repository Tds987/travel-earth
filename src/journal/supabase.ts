import type { Entry, MediaItem } from './types'

// Minimal Supabase client over REST (auth, rows, storage, one RPC).
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const SESSION_KEY = 'travel-earth:session'

export const cloudConfigured = Boolean(URL_ && KEY)

type Session = { access_token: string; refresh_token: string; expires_at: number; email?: string }

function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}
function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable */
  }
}

let session = loadSession()

export const signedInEmail = () => session?.email ?? null

async function authRequest(path: string, body: object): Promise<Session> {
  const res = await fetch(`${URL_}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok)
    throw new Error(data.error_description || data.msg || data.message || 'Sign-in failed')
  if (!data.access_token) throw new Error('Check your email to confirm the account, then sign in.')
  const s: Session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    email: data.user?.email,
  }
  session = s
  saveSession(s)
  return s
}

export const signIn = (email: string, password: string) =>
  authRequest('token?grant_type=password', { email, password })

/** First-time only: creates the owner account (turn sign-ups off afterwards). */
export const signUp = (email: string, password: string) =>
  authRequest('signup', { email, password })

export function signOut() {
  session = null
  saveSession(null)
}

async function token(): Promise<string> {
  if (!session) throw new Error('Not signed in')
  if (Date.now() > session.expires_at - 60_000) {
    const email = session.email
    const s = await authRequest('token?grant_type=refresh_token', {
      refresh_token: session.refresh_token,
    })
    s.email ??= email
    saveSession(s)
  }
  return session.access_token
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${URL_}${path}`, {
    ...init,
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${await token()}`,
      ...init.headers,
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res
}

type Row = {
  id: string
  at: string
  kind: Entry['kind']
  place_id: string | null
  title: string | null
  body: string | null
  lat: number | null
  lon: number | null
  media: { path: string; type: MediaItem['type'] }[]
}

const toRow = (e: Entry): Row => ({
  id: e.id,
  at: e.at,
  kind: e.kind,
  place_id: e.placeId ?? null,
  title: e.title ?? null,
  body: e.body ?? null,
  lat: e.lat ?? null,
  lon: e.lon ?? null,
  media: e.media.filter((m) => m.path).map((m) => ({ path: m.path!, type: m.type })),
})

export const fromRow = (r: Row): Entry => ({
  id: r.id,
  at: r.at,
  kind: r.kind,
  placeId: r.place_id ?? undefined,
  title: r.title ?? undefined,
  body: r.body ?? undefined,
  lat: r.lat ?? undefined,
  lon: r.lon ?? undefined,
  media: (r.media ?? []).map((m) => ({ id: m.path, path: m.path, type: m.type })),
})

export const cloud = {
  async upsert(e: Entry) {
    await api('/rest/v1/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(toRow(e)),
    })
  },
  async remove(id: string) {
    await api(`/rest/v1/entries?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  async list(): Promise<Entry[]> {
    const res = await api('/rest/v1/entries?select=*&order=at.asc')
    return ((await res.json()) as Row[]).map(fromRow)
  },
  async upload(path: string, blob: Blob) {
    await api(`/storage/v1/object/journal/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true' },
      body: blob,
    })
  },
  async shareToken(): Promise<string | null> {
    const res = await api('/rest/v1/settings?select=share_token&id=eq.1')
    const rows = (await res.json()) as { share_token: string }[]
    return rows[0]?.share_token ?? null
  },
}

export const mediaUrl = (path: string) => `${URL_}/storage/v1/object/public/journal/${path}`

/** Family view: read-only, no sign-in, keyed by the share token. */
export async function familyJournal(
  token: string,
): Promise<{ name: string; entries: Entry[] } | null> {
  if (!cloudConfigured) return null
  const res = await fetch(`${URL_}/rest/v1/rpc/family_journal`, {
    method: 'POST',
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { name: string; entries: Row[] } | null
  return data ? { name: data.name, entries: data.entries.map(fromRow) } : null
}
