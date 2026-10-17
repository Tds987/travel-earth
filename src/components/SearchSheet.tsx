import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_LABEL } from '../lib/format'
import { search, type SearchResult } from '../lib/search'
import { CATEGORY_COLOR } from '../map/pins'
import {
  lineLabel,
  loadRail,
  operatorLabel,
  RAIL_KINDS,
  RAIL_STYLE,
  type RailKind,
  type RailLine,
  type RailStation,
} from '../map/rail'
import { FILTERS, matchesFilters, type Filter } from '../lib/filters'
import type { Place } from '../types'

type Rail = { lines: { line: RailLine; kind: RailKind }[]; stations: RailStation[] }

type Props = {
  places: Place[]
  filters: Set<Filter>
  onToggleFilter: (f: Filter) => void
  onClearFilters: () => void
  onPickPlace: (p: Place) => void
  onPickStation: (s: RailStation) => void
  onPickLine: (line: RailLine, kind: RailKind) => void
  onClose: () => void
}

/** One sheet for everything: text search + simple filter chips. */
export function SearchSheet(props: Props) {
  const { places, filters } = props
  const [query, setQuery] = useState('')
  const [rail, setRail] = useState<Rail>({ lines: [], stations: [] })
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    // Train lines and stations become searchable once loaded (small, cached).
    Promise.allSettled(RAIL_KINDS.map(loadRail)).then((res) => {
      const next: Rail = { lines: [], stations: [] }
      res.forEach((r, i) => {
        if (r.status !== 'fulfilled') return
        next.lines.push(...r.value.lines.map((line) => ({ line, kind: RAIL_KINDS[i] })))
        next.stations.push(...(r.value.stations ?? []))
      })
      setRail(next)
    })
  }, [])

  const filtered = useMemo(
    () => places.filter((p) => matchesFilters(p, filters)),
    [places, filters],
  )
  const results: SearchResult[] = useMemo(() => {
    if (query.trim())
      return search(query, filtered, filters.size ? { lines: [], stations: [] } : rail)
    if (!filters.size) return []
    return filtered.map((place) => ({ type: 'place' as const, place, score: 0 }))
  }, [query, filtered, filters, rail])

  return (
    <div className="search" role="dialog" aria-modal="true" aria-label="Search">
      <div className="search__bar">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          ref={input}
          className="search__input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Places, food, stations, train lines"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
        />
        <button type="button" className="btn btn--quiet" onClick={props.onClose}>
          Done
        </button>
      </div>

      <div className="chips" role="group" aria-label="Filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip${f.id === 'bourdain' ? ' chip--bourdain' : ''}`}
            aria-pressed={filters.has(f.id)}
            onClick={() => props.onToggleFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        {filters.size > 0 && (
          <button type="button" className="chip chip--clear" onClick={props.onClearFilters}>
            Clear
          </button>
        )}
      </div>

      {filters.size > 0 && (
        <p className="search__summary">
          {filtered.length} {filtered.length === 1 ? 'place' : 'places'} on the map
          {filters.has('bourdain') && ' where Bourdain ate, drank or filmed'}
        </p>
      )}

      <ul className="results">
        {results.map((r) => {
          if (r.type === 'place') {
            const p = r.place
            return (
              <li key={`p:${p.id}`}>
                <button type="button" className="result" onClick={() => props.onPickPlace(p)}>
                  <span
                    className="result__dot"
                    style={{ background: CATEGORY_COLOR[p.category] }}
                  />
                  <span className="result__text">
                    <span className="result__name">{p.name}</span>
                    <span className="result__meta">
                      {CATEGORY_LABEL[p.category]} · {p.city}
                      {p.flags?.bourdain && ' · Bourdain'}
                    </span>
                  </span>
                </button>
              </li>
            )
          }
          if (r.type === 'station') {
            const s = r.station
            return (
              <li key={`s:${s.name}`}>
                <button type="button" className="result" onClick={() => props.onPickStation(s)}>
                  <span className="result__dot result__dot--station" />
                  <span className="result__text">
                    <span className="result__name">{s.nameEn ?? s.name} Station</span>
                    <span className="result__meta">
                      Shinkansen stop · <span lang="ja">{s.name}</span>
                    </span>
                  </span>
                </button>
              </li>
            )
          }
          const l = r.line
          return (
            <li key={`l:${l.id}`}>
              <button type="button" className="result" onClick={() => props.onPickLine(l, r.kind)}>
                <span className="result__line" style={{ background: RAIL_STYLE[r.kind].color }} />
                <span className="result__text">
                  <span className="result__name">{lineLabel(l)}</span>
                  <span className="result__meta">
                    {RAIL_STYLE[r.kind].label} · {operatorLabel(l)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        {query.trim() && results.length === 0 && (
          <li className="results__empty">No matches{filters.size ? ' with these filters' : ''}.</li>
        )}
      </ul>
    </div>
  )
}
