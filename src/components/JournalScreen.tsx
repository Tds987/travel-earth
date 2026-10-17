import { useState } from 'react'
import { places } from '../content'
import { nearestCity, timeAgo } from '../lib/geo'
import { removeEntry, refreshStatus, useMediaSrc, type SyncStatus } from '../journal/store'
import { cloud, cloudConfigured, signedInEmail, signIn, signOut, signUp } from '../journal/supabase'
import type { Entry, LocalEntry, MediaItem } from '../journal/types'

type Props = {
  mode: 'owner' | 'family'
  entries: Entry[]
  familyName?: string
  status?: SyncStatus
  onCheckIn?: () => void
  onWrite?: () => void
  onAddStay?: () => void
  onShowOnMap: (entry: Entry) => void
  checkingIn?: boolean
}

const placeById = new Map(places.map((p) => [p.id, p]))

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export function JournalScreen(props: Props) {
  const { mode, entries } = props
  const owner = mode === 'owner'
  const stamps = entries.filter((e) => e.kind === 'visit').length
  const lastCheckIn = [...entries].reverse().find((e) => e.kind === 'checkin' && e.lat != null)

  // Newest day first; within a day, newest first.
  const days = new Map<string, Entry[]>()
  for (const e of [...entries].reverse()) {
    const key = new Date(e.at).toDateString()
    days.set(key, [...(days.get(key) ?? []), e])
  }

  return (
    <section className="journal" aria-labelledby="journal-title">
      <header className="journal__head">
        <h1 id="journal-title" className="journal__title">
          {owner ? 'Journal' : `${props.familyName ?? 'Traveler'}’s travels`}
        </h1>
        <p className="journal__stats">
          {stamps} {stamps === 1 ? 'place' : 'places'} stamped · {entries.length}{' '}
          {entries.length === 1 ? 'entry' : 'entries'}
        </p>
      </header>

      {lastCheckIn && (
        <button type="button" className="lastseen" onClick={() => props.onShowOnMap(lastCheckIn)}>
          <span className="lastseen__dot" aria-hidden="true" />
          <span>
            <strong>Last check-in</strong>
            {nearestCity(lastCheckIn.lat!, lastCheckIn.lon!) &&
              ` near ${nearestCity(lastCheckIn.lat!, lastCheckIn.lon!)}`}
            , {timeAgo(lastCheckIn.at)}
          </span>
          <span className="lastseen__go">See on map</span>
        </button>
      )}

      {owner && (
        <div className="journal__actions">
          <button
            type="button"
            className="btn btn--primary btn--wide"
            onClick={props.onCheckIn}
            disabled={props.checkingIn}
          >
            {props.checkingIn ? 'Finding you…' : 'Check in here'}
          </button>
          <div className="journal__actions-row">
            <button type="button" className="btn" onClick={props.onWrite}>
              Write entry
            </button>
            <button type="button" className="btn" onClick={props.onAddStay}>
              Add my stay
            </button>
          </div>
        </div>
      )}

      {owner && <SharingCard status={props.status ?? 'local'} />}

      {entries.length === 0 ? (
        <div className="journal__empty">
          <div className="journal__seal" aria-hidden="true">
            旅
          </div>
          <p>
            {owner
              ? 'Like a temple seal book: tap “I’ve been here” on any place and it gets a red stamp here, with your notes and photos.'
              : 'Nothing posted yet. Check back soon.'}
          </p>
        </div>
      ) : (
        [...days.entries()].map(([key, list]) => (
          <section key={key} className="day">
            <h2 className="day__title">{dayLabel(list[0].at)}</h2>
            {list.map((e) => (
              <EntryCard key={e.id} entry={e} owner={owner} onShowOnMap={props.onShowOnMap} />
            ))}
          </section>
        ))
      )}
    </section>
  )
}

function EntryCard({
  entry,
  owner,
  onShowOnMap,
}: {
  entry: Entry
  owner: boolean
  onShowOnMap: (e: Entry) => void
}) {
  const place = entry.placeId ? placeById.get(entry.placeId) : undefined
  const near = entry.lat != null && entry.lon != null ? nearestCity(entry.lat, entry.lon) : null
  const label =
    entry.kind === 'visit'
      ? `Visited${place ? ` · ${place.city}` : ''}`
      : entry.kind === 'checkin'
        ? `Checked in${near ? ` near ${near}` : ''}`
        : entry.kind === 'stay'
          ? 'Staying'
          : 'Note'
  const title = entry.title ?? place?.name

  return (
    <article className={`entry entry--${entry.kind}`}>
      {entry.kind === 'visit' && (
        <div className="seal" aria-hidden="true">
          {(place?.localName ?? title ?? '印').slice(0, 2)}
        </div>
      )}
      <div className="entry__main">
        <p className="entry__meta">
          {label} · {timeLabel(entry.at)}
        </p>
        {title && <h3 className="entry__title">{title}</h3>}
        {entry.body && <p className="entry__body">{entry.body}</p>}
        {entry.media.length > 0 && (
          <ul className="thumbs thumbs--entry">
            {entry.media.map((m) => (
              <MediaThumb key={m.id} item={m} />
            ))}
          </ul>
        )}
        <div className="entry__actions">
          {(entry.lat != null || place) && (
            <button type="button" className="link" onClick={() => onShowOnMap(entry)}>
              Show on map
            </button>
          )}
          {owner && (
            <button
              type="button"
              className="link link--danger"
              onClick={() => {
                if (confirm('Delete this entry?')) void removeEntry(entry as LocalEntry)
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function MediaThumb({ item }: { item: MediaItem }) {
  const src = useMediaSrc(item)
  if (!src) return <li className="thumbs__item thumbs__item--loading" />
  return (
    <li className="thumbs__item">
      {item.type === 'video' ? (
        <video src={src} controls playsInline preload="metadata" />
      ) : (
        <a href={src} target="_blank" rel="noopener noreferrer">
          <img src={src} alt="" loading="lazy" />
        </a>
      )}
    </li>
  )
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  local: 'Saved on this phone. Family sharing isn’t set up yet.',
  'signed-out': 'Saved on this phone. Sign in once to share with family.',
  offline: 'No signal. Saved on this phone; it will sync when you’re back online.',
  syncing: 'Syncing…',
  synced: 'Shared. Family sees new entries within a couple of minutes.',
  error: 'Couldn’t sync yet. Everything is safe on this phone; it will retry.',
}

function SharingCard({ status }: { status: SyncStatus }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const go = async (fn: typeof signIn) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn(email.trim(), password)
      await refreshStatus()
      setOpen(false)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  const copyLink = async () => {
    try {
      const token = await cloud.shareToken()
      if (!token) throw new Error('No share link yet. Was the setup SQL run?')
      const url = `${location.origin}/?family=${token}`
      if (navigator.share) await navigator.share({ title: 'Follow my travels', url })
      else {
        await navigator.clipboard.writeText(url)
        setMsg('Link copied. Text it to family.')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setMsg((err as Error).message)
    }
  }

  return (
    <div className="sharing">
      <p className="sharing__status">
        <span className={`sharing__dot sharing__dot--${status}`} aria-hidden="true" />
        {STATUS_TEXT[status]}
      </p>

      {cloudConfigured && signedInEmail() && (
        <div className="sharing__row">
          <button type="button" className="btn" onClick={copyLink}>
            Share family link
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              signOut()
              void refreshStatus()
            }}
          >
            Sign out
          </button>
        </div>
      )}

      {cloudConfigured && !signedInEmail() && !open && (
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Sign in to share
        </button>
      )}

      {open && (
        <form
          className="sharing__form"
          onSubmit={(e) => {
            e.preventDefault()
            void go(signIn)
          }}
        >
          <input
            className="field__input"
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="field__input"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <div className="sharing__row">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              Sign in
            </button>
            <button type="button" className="link" disabled={busy} onClick={() => void go(signUp)}>
              First time? Create account
            </button>
          </div>
        </form>
      )}

      {msg && <p className="sharing__msg">{msg}</p>}
    </div>
  )
}
