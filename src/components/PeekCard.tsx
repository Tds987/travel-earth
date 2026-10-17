import { useState } from 'react'
import { region } from '../content'
import { CATEGORY_LABEL, firstSentence, formatPrice } from '../lib/format'
import { CATEGORY_COLOR } from '../map/pins'
import type { Place } from '../types'

type Props = { place: Place; onClose: () => void }

/** Place card: peek (name, one line, price) → full (story, tips, directions). */
export function PeekCard({ place, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`

  return (
    <article className={`card${open ? ' card--open' : ''}`} aria-label={place.name}>
      <button type="button" className="card__close" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6 6 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <p className="card__eyebrow">
        <span className="card__dot" style={{ background: CATEGORY_COLOR[place.category] }} />
        {CATEGORY_LABEL[place.category]} · {place.city}
        {place.flags?.bourdain && <span className="card__flag">Bourdain was here</span>}
      </p>
      <h2 className="card__title">{place.name}</h2>
      {place.localName && (
        <p className="card__local" lang="ja">
          {place.localName}
        </p>
      )}

      {(place.when || place.status) && (
        <p className="card__when">{[place.when, place.status].filter(Boolean).join(' · ')}</p>
      )}
      {place.price && (
        <p className="card__price">
          {formatPrice(place.price, region)}
          {place.price.estimate && <span className="card__est"> estimate, verify</span>}
        </p>
      )}

      <p className="card__why">{open ? place.why : firstSentence(place.why)}</p>

      {open && place.tips && (
        <ul className="card__tips">
          {place.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <div className="card__actions">
        <button
          type="button"
          className="btn"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? 'Less' : 'More'}
        </button>
        <a className="btn btn--primary" href={directions} target="_blank" rel="noopener noreferrer">
          Directions
        </a>
      </div>
    </article>
  )
}
