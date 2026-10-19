import { useEffect, useMemo, useState } from 'react'
import { CATEGORY_LABEL } from '../lib/format'
import { SLOTS, type Slot } from '../lib/hours'
import { MOODS, TIER_LABEL, tierOf, type Mood } from '../lib/moods'
import { CATEGORY_COLOR } from '../map/pins'
import { dateRange, japanToday, longDay, shortDay } from '../plan/dates'
import {
  bookAlerts,
  cities,
  cityById,
  cityHop,
  dayEvents,
  defaultGuideFilters,
  fmtHours,
  leg,
  stopPoint,
  suggest,
  type GuideFilters,
  type LatLon,
} from '../plan/guide'
import { planActions, usePlan } from '../plan/store'
import type { Place } from '../types'

type Props = {
  places: Place[]
  byId: Map<string, Place>
  date: string
  onDate: (d: string) => void
  userPos: LatLon | null
  onLocate: () => void
  onShowPlace: (p: Place) => void
  /** Ids of the guide's current suggestions, so the map can show just those. */
  onSuggestions: (ids: string[] | null) => void
}

const fmtKm = (k: number) => (k < 1 ? `${Math.round(k * 100) * 10} m` : `${k.toFixed(1)} km`)

/** The tour guide for one day at a time: where you're based, what's on, and what's near. */
export function PlanSheet(props: Props) {
  const { places, byId, date } = props
  const plan = usePlan()
  const today = japanToday()
  const days = dateRange(plan.start, plan.end)
  const day = plan.days[date] ?? { stops: [] }
  const prevBase = plan.days[days[days.indexOf(date) - 1]]?.base
  const base = day.base ? cityById.get(day.base) : undefined
  const isToday = date === today

  const [mood, setMood] = useState<Mood | null>(null)
  const [slot, setSlot] = useState<Slot>(isToday ? 'now' : 'lunch')
  const [filters, setFilters] = useState<GuideFilters>(defaultGuideFilters)
  const [wider, setWider] = useState(1)
  const [showAlerts, setShowAlerts] = useState(false)

  const alerts = useMemo(() => bookAlerts(plan, today, byId), [plan, today, byId])

  // Reference point for "near": you (today), else your last stop, else the base city.
  const points = day.stops.map((s) => stopPoint(s, byId))
  const lastStop = [...points].reverse().find(Boolean) ?? null
  const ref: (LatLon & { label: string }) | null =
    isToday && props.userPos
      ? { ...props.userPos, label: 'you' }
      : lastStop
        ? { ...lastStop, label: lastStop.name }
        : base
          ? { lat: base.lat, lon: base.lon, label: `central ${base.name}` }
          : null
  const radius = (ref?.label === 'you' ? 3 : (base?.radiusKm ?? 10) * 1.3) * wider

  // Cheap for a few hundred places, so no memo; the map only updates when ids change.
  const results =
    mood && ref
      ? suggest(places, { mood, slot, date, ref, radiusKm: radius, filters }).slice(0, 25)
      : []
  const idsKey = results.map((r) => r.place.id).join('|')
  const { onSuggestions } = props
  useEffect(() => {
    onSuggestions(mood ? idsKey.split('|').filter(Boolean) : null)
  }, [mood, idsKey, onSuggestions])

  // Things happening today: the Series, plus dated places (festivals) in this base.
  const happenings = [
    ...dayEvents(date).map((e) => ({
      title: e.title,
      sub: `${byId.get(e.placeId)?.name ?? ''} · ${e.time}`,
      place: byId.get(e.placeId),
    })),
    ...places
      .filter((p) => p.dates && date >= p.dates.start && date <= p.dates.end && !p.flags?.series)
      .filter((p) => !base || Math.hypot(p.lat - base.lat, p.lon - base.lon) < base.radiusKm / 60)
      .map((p) => ({ title: p.name, sub: CATEGORY_LABEL[p.category], place: p })),
  ]

  const toggleTier = (t: 1 | 2 | 3) =>
    setFilters((f) => {
      const tiers = new Set(f.tiers)
      if (tiers.has(t)) tiers.delete(t)
      else tiers.add(t)
      return { ...f, tiers }
    })

  return (
    <div className="plan">
      {alerts.length > 0 && (
        <div className={`alerts${alerts.some((a) => a.overdue) ? ' alerts--due' : ''}`}>
          <button
            type="button"
            className="alerts__head"
            onClick={() => setShowAlerts((o) => !o)}
            aria-expanded={showAlerts}
          >
            <strong>Book soon</strong> · {alerts.length} {alerts.length === 1 ? 'thing' : 'things'}{' '}
            to book this week
            <span aria-hidden="true">{showAlerts ? '▴' : '▾'}</span>
          </button>
          {showAlerts && (
            <ul className="alerts__list">
              {alerts.map((a) => (
                <li key={a.id}>
                  <strong>{a.title}</strong> for {longDay(a.forDate)}
                  <span className={a.overdue ? 'alerts__due' : ''}>
                    {a.overdue ? ' · book now' : ` · by ${longDay(a.dueBy)}`}
                  </span>
                  <p>{a.note}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="daystrip" role="tablist" aria-label="Trip days">
        {days.map((d) => {
          const b = plan.days[d]?.base
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === date}
              className={`daystrip__day${d === today ? ' daystrip__day--today' : ''}`}
              onClick={() => props.onDate(d)}
            >
              <span className="daystrip__dow">{d === today ? 'Today' : shortDay(d)}</span>
              <span className="daystrip__num">{Number(d.slice(8))}</span>
              <span className="daystrip__city">{b ? cityById.get(b)?.name : '—'}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="daystrip__day daystrip__add"
          onClick={planActions.extendTrip}
        >
          <span className="daystrip__num">+</span>
          <span className="daystrip__city">Add day</span>
        </button>
      </div>

      <div className="dayhead">
        <h2 className="dayhead__title">{longDay(date)}</h2>
        <div className="dayhead__row">
          <label className="dayhead__base">
            <span className="sr-only">Base city</span>
            <select
              value={day.base ?? ''}
              onChange={(e) => planActions.setBase(date, e.target.value || undefined)}
            >
              <option value="">Where are you based?</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {day.base && (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => planActions.stayAnotherNight(date)}
            >
              Stay another night
            </button>
          )}
        </div>
      </div>

      {prevBase && day.base && prevBase !== day.base && <TravelDay from={prevBase} to={day.base} />}

      {happenings.length > 0 && (
        <ul className="happenings">
          {happenings.map((h) => (
            <li key={h.title}>
              <button
                type="button"
                className="happening"
                onClick={() => h.place && props.onShowPlace(h.place)}
              >
                <span className="line-badge" style={{ background: '#C8402F' }}>
                  Today
                </span>
                <span>
                  <strong>{h.title}</strong>
                  <span className="happening__sub">{h.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="stops" aria-label="Your day">
        {day.stops.length === 0 ? (
          <p className="stops__empty">
            Nothing planned yet. Pick a mood below and add what looks good, or just wander.
          </p>
        ) : (
          <ol className="stops__list">
            {day.stops.map((s, i) => {
              const p = s.placeId ? byId.get(s.placeId) : undefined
              const pt = points[i]
              const prev = i > 0 ? points[i - 1] : null
              const l = pt && prev ? leg(prev, pt) : null
              return (
                <li key={s.id}>
                  {l && (
                    <a className="leg" href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.walk ? 'Walk' : 'Train or subway'} ~{l.minutes} min · {fmtKm(l.km)} ·
                      Directions
                    </a>
                  )}
                  <div className="stop">
                    <span className="stop__num">{i + 1}</span>
                    <button
                      type="button"
                      className="stop__name"
                      onClick={() => p && props.onShowPlace(p)}
                    >
                      {s.name ?? p?.name}
                      {p && (
                        <span className="stop__meta">
                          {p.subtype ?? CATEGORY_LABEL[p.category]}
                        </span>
                      )}
                    </button>
                    <div className="stop__tools">
                      <button
                        type="button"
                        aria-label="Move up"
                        onClick={() => planActions.moveStop(date, s.id, -1)}
                        disabled={i === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        onClick={() => planActions.moveStop(date, s.id, 1)}
                        disabled={i === day.stops.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => planActions.removeStop(date, s.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section className="guide" aria-labelledby="guide-title">
        <h3 id="guide-title" className="guide__title">
          What are you in the mood for?
        </h3>
        <div className="chips chips--wrap">
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className="chip"
              aria-pressed={mood === m.id}
              onClick={() => {
                setMood(mood === m.id ? null : m.id)
                setWider(1)
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mood && (
          <>
            <div className="chips">
              {SLOTS.filter((s) => s.id !== 'now' || isToday).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="chip chip--small"
                  aria-pressed={slot === s.id}
                  onClick={() => setSlot(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="chips">
              <button
                type="button"
                className="chip chip--small chip--bourdain"
                aria-pressed={filters.bourdain}
                onClick={() => setFilters((f) => ({ ...f, bourdain: !f.bourdain }))}
              >
                Bourdain
              </button>
              <button
                type="button"
                className="chip chip--small"
                aria-pressed={filters.local}
                onClick={() => setFilters((f) => ({ ...f, local: !f.local }))}
              >
                Local favorites
              </button>
              <button
                type="button"
                className="chip chip--small"
                aria-pressed={filters.noTrap}
                onClick={() => setFilters((f) => ({ ...f, noTrap: !f.noTrap }))}
              >
                Skip tourist traps
              </button>
              {([1, 2, 3] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip chip--small"
                  aria-pressed={filters.tiers.has(t)}
                  onClick={() => toggleTier(t)}
                >
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>

            <p className="guide__near">
              {ref ? (
                <>
                  Near {ref.label}
                  {isToday && !props.userPos && (
                    <>
                      {' · '}
                      <button type="button" className="link" onClick={props.onLocate}>
                        Use my location
                      </button>
                    </>
                  )}
                </>
              ) : (
                'Choose where you’re based to see what’s near.'
              )}
            </p>

            <ul className="results">
              {results.map(({ place: p, km: d, open }) => {
                const added = day.stops.some((s) => s.placeId === p.id)
                const tier = tierOf(p)
                return (
                  <li key={p.id} className="suggestion">
                    <button type="button" className="result" onClick={() => props.onShowPlace(p)}>
                      <span
                        className="result__dot"
                        style={{ background: CATEGORY_COLOR[p.category] }}
                      />
                      <span className="result__text">
                        <span className="result__name">{p.name}</span>
                        <span className="result__meta">
                          {p.subtype ?? CATEGORY_LABEL[p.category]} · {fmtKm(d)}
                          {tier && ` · ${TIER_LABEL[tier]}`}
                          {!open && ' · closed then'}
                        </span>
                        <span className="result__badges">
                          {p.flags?.bourdain && (
                            <span className="badge badge--bourdain">Bourdain</span>
                          )}
                          {p.flags?.local && <span className="badge">Local favorite</span>}
                          {p.flags?.cultural && (
                            <span className="badge">Culturally significant</span>
                          )}
                          {p.flags?.trap && <span className="badge badge--warn">Tourist trap</span>}
                          {p.bookAhead && <span className="badge">Book ahead</span>}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`btn btn--small${added ? '' : ' btn--primary'}`}
                      disabled={added}
                      onClick={() => planActions.addStop(date, { placeId: p.id })}
                    >
                      {added ? 'Added' : 'Add'}
                    </button>
                  </li>
                )
              })}
              {results.length === 0 && ref && (
                <li className="results__empty">
                  Nothing here yet for that mood.{' '}
                  {wider < 4 && (
                    <button type="button" className="link" onClick={() => setWider((w) => w * 2)}>
                      Look farther
                    </button>
                  )}
                </li>
              )}
              {results.length > 0 && wider < 4 && (
                <li className="results__more">
                  <button type="button" className="link" onClick={() => setWider((w) => w * 2)}>
                    Look farther
                  </button>
                </li>
              )}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

function TravelDay({ from, to }: { from: string; to: string }) {
  const a = cityById.get(from)
  const b = cityById.get(to)
  if (!a || !b) return null
  const hop = cityHop(a, b)
  return (
    <div className="travelday">
      <p className="travelday__title">
        Travel day: {a.name} → {b.name}
      </p>
      <p className="travelday__sub">
        {hop.km < 60 ? 'Local train' : 'Shinkansen'} about {fmtHours(hop.trainHours)}
        {hop.suggestFlight && ' · or fly about 2 h (often cheaper booked early)'}
      </p>
      <a className="link" href={hop.href} target="_blank" rel="noopener noreferrer">
        Train times in Google Maps
      </a>
    </div>
  )
}
