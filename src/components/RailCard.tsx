import { useState } from 'react'
import { lineLabel, operatorLabel, RAIL_STYLE, type RailPick } from '../map/rail'
import { SHINKANSEN, transitLink } from '../map/railInfo'

type Props = { pick: RailPick; onClose: () => void }

/** Card for a tapped train line: what it is, how fast, where to book. */
export function RailCard({ pick, onClose }: Props) {
  const { rail, kind } = pick
  const info = kind === 'shinkansen' ? SHINKANSEN[rail.name] : undefined
  const style = RAIL_STYLE[kind]
  const [open, setOpen] = useState(false)

  return (
    <article className="card" aria-label={lineLabel(rail)}>
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
        <span className="line-badge" style={{ background: style.color }}>
          {style.label}
        </span>
        {operatorLabel(rail)}
      </p>
      <h2 className="card__title">{lineLabel(rail)}</h2>
      {rail.nameEn && (
        <p className="card__local" lang="ja">
          {rail.name}
        </p>
      )}

      {info && <p className="card__price">{info.fastest}</p>}
      {open && info && (
        <>
          <p className="card__route">{info.route}</p>
          {info.note && <p className="card__why">{info.note}</p>}
        </>
      )}
      {open && (
        <p className="card__links">
          {info?.booking.slice(1).map((b) => (
            <a key={b.href} href={b.href} target="_blank" rel="noopener noreferrer">
              {b.label}
            </a>
          ))}
          <a
            href={transitLink(`${lineLabel(rail)} Japan`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Times in Google Maps
          </a>
        </p>
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
        {info ? (
          <a
            className="btn btn--primary"
            href={info.booking[0].href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Book tickets
          </a>
        ) : (
          <a
            className="btn btn--primary"
            href={transitLink(`${lineLabel(rail)} Japan`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Times
          </a>
        )}
      </div>
    </article>
  )
}
