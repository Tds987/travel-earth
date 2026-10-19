import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { EntryComposer } from './components/EntryComposer'
import { InfoSheet } from './components/InfoSheet'
import { JournalScreen } from './components/JournalScreen'
import { MapControls } from './components/MapControls'
import { Panel, type PanelSize } from './components/Panel'
import { PlanSheet } from './components/PlanSheet'
import { PeekCard } from './components/PeekCard'
import { RailCard } from './components/RailCard'
import { SearchSheet } from './components/SearchSheet'
import { FILTERS, matchesFilters, type Filter } from './lib/filters'
import { TabBar, type Tab } from './components/TabBar'
import { places, region } from './content'
import { addEntry, useJournal, type NewEntry } from './journal/store'
import { familyJournal } from './journal/supabase'
import type { Entry } from './journal/types'
import { nearestCity } from './lib/geo'
import type { MapApi } from './map/MapView'
import { japanToday, shortDay } from './plan/dates'
import { cityById, stopPoint, type LatLon } from './plan/guide'
import { planActions, usePlan } from './plan/store'
import { lineBounds, RAIL_KINDS, RAIL_STYLE, type RailPick } from './map/rail'
import type { MapQuality, MapSource } from './map/viewer'

// Cesium is large; load it after the shell so the app appears instantly on weak signal.
const MapView = lazy(() => import('./map/MapView'))

const QUALITY_KEY = 'travel-earth:quality'
const readQuality = (): MapQuality => {
  try {
    return localStorage.getItem(QUALITY_KEY) === 'saver' ? 'saver' : 'sharp'
  } catch {
    return 'sharp'
  }
}

// Family view: opened from the private link (?family=<token>), read-only.
const familyToken = new URLSearchParams(location.search).get('family')
const FAMILY_REFRESH_MS = 2 * 60 * 1000

type Composer = { draft: NewEntry; heading: string }

const getPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'))
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
    })
  })

function App() {
  const owner = !familyToken
  const journal = useJournal()
  const [family, setFamily] = useState<{ name: string; entries: Entry[] } | null>(null)
  const [familyError, setFamilyError] = useState(false)

  const [tab, setTab] = useState<Tab>(familyToken ? 'journal' : 'plan')
  const [panel, setPanel] = useState<PanelSize>('half')
  const plan = usePlan()
  const [planDate, setPlanDate] = useState(() => {
    const t = japanToday()
    return t >= plan.start && t <= plan.end ? t : plan.start
  })
  const [userPos, setUserPos] = useState<LatLon | null>(null)
  const [suggestionIds, setSuggestionIds] = useState<string[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [source, setSource] = useState<MapSource | null>(null)
  const [quality, setQuality] = useState<MapQuality>(readQuality)
  const [infoOpen, setInfoOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [composer, setComposer] = useState<Composer | null>(null)
  const [pickingStay, setPickingStay] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [filters, setFilters] = useState<Set<Filter>>(new Set())
  const [trainsOn, setTrainsOn] = useState(false)
  const [railPick, setRailPick] = useState<RailPick | null>(null)
  const [heading, setHeading] = useState(0)
  // -180..180, 0 = north up
  const rotated = Math.abs((((heading % 360) + 540) % 360) - 180) > 4
  const api = useRef<MapApi | null>(null)

  useEffect(() => {
    if (!familyToken) return
    const load = () =>
      familyJournal(familyToken).then((data) => {
        if (data) setFamily(data)
        else setFamilyError(true)
      })
    void load()
    const t = setInterval(load, FAMILY_REFRESH_MS)
    return () => clearInterval(t)
  }, [])

  const entries: Entry[] = useMemo(
    () => (owner ? journal.entries : (family?.entries ?? [])),
    [owner, journal.entries, family],
  )
  const visitedAt = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of entries)
      if (e.kind === 'visit' && e.placeId && !m.has(e.placeId)) m.set(e.placeId, e.at)
    return m
  }, [entries])
  const visited = useMemo(() => new Set(visitedAt.keys()), [visitedAt])

  const selected = places.find((p) => p.id === selectedId) ?? null
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [])
  const planDay = useMemo(() => plan.days[planDate] ?? { stops: [] }, [plan, planDate])
  const dayStops = useMemo(
    () =>
      tab === 'plan'
        ? planDay.stops
            .map((s) => stopPoint(s, byId))
            .filter((x): x is NonNullable<typeof x> => !!x)
        : [],
    [tab, planDay, byId],
  )
  // Map pins: search filters always apply; in Plan, an active mood narrows to its suggestions
  // (plus whatever is already in the day).
  const visibleIds = useMemo(() => {
    const base = places.filter((p) => matchesFilters(p, filters)).map((p) => p.id)
    if (tab !== 'plan' || !suggestionIds) return new Set(base)
    const keep = new Set([...suggestionIds, ...planDay.stops.map((s) => s.placeId ?? '')])
    return new Set(base.filter((id) => keep.has(id)))
  }, [filters, tab, suggestionIds, planDay])
  const onSuggestions = useCallback((ids: string[] | null) => setSuggestionIds(ids), [])

  // Picking a day (or changing its base) frames the map on that day: its stops, else its city.
  const dayKey = `${planDate}|${planDay.base ?? ''}|${dayStops.length}`
  useEffect(() => {
    if (tab !== 'plan') return
    const pts = dayStops.length ? dayStops : []
    const city = planDay.base ? cityById.get(planDay.base) : undefined
    if (pts.length) {
      const lats = pts.map((p) => p.lat)
      const lons = pts.map((p) => p.lon)
      api.current?.flyToBounds({
        w: Math.min(...lons) - 0.01,
        e: Math.max(...lons) + 0.01,
        s: Math.min(...lats) - 0.01,
        n: Math.max(...lats) + 0.01,
      })
    } else if (city) {
      const d = city.radiusKm / 111
      api.current?.flyToBounds({
        w: city.lon - d,
        e: city.lon + d,
        s: city.lat - d,
        n: city.lat + d,
      })
    }
    // Only re-frame when the day, its base, or its number of stops changes.
  }, [dayKey, tab]) // oxlint-disable-line react-hooks/exhaustive-deps
  const toggleFilter = (f: Filter) =>
    setFilters((cur) => {
      const next = new Set(cur)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    if (id) setRailPick(null)
    setInfoOpen(false)
    const place = id ? places.find((p) => p.id === id) : null
    if (place) {
      api.current?.flyToPlace(place)
      setPanel('peek') // make room for the card
    }
  }, [])

  const changeQuality = (q: MapQuality) => {
    setQuality(q)
    try {
      localStorage.setItem(QUALITY_KEY, q)
    } catch {
      /* private mode: setting just won't persist */
    }
  }

  const flash = (text: string) => {
    setNotice(text)
    setTimeout(() => setNotice(null), 4000)
  }

  const locate = async () => {
    setLocating(true)
    try {
      const pos = await getPosition()
      setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      api.current?.showUser(pos.coords.longitude, pos.coords.latitude)
    } catch {
      flash('Couldn’t get your location. Check location permission.')
    }
    setLocating(false)
  }

  const checkIn = async () => {
    setCheckingIn(true)
    try {
      const { coords } = await getPosition()
      await addEntry({ kind: 'checkin', lat: coords.latitude, lon: coords.longitude })
      const near = nearestCity(coords.latitude, coords.longitude)
      flash(near ? `Checked in near ${near}.` : 'Checked in.')
    } catch {
      flash('Couldn’t get your location. Check location permission.')
    }
    setCheckingIn(false)
  }

  const showOnMap = (e: Entry) => {
    const place = e.placeId ? places.find((p) => p.id === e.placeId) : undefined
    setPanel('peek')
    if (e.lat != null && e.lon != null) api.current?.flyToPoint(e.lon, e.lat)
    else if (place) select(place.id)
  }

  const startStay = async () => {
    // Prefer where you are; if location is off, pick the spot on the map.
    try {
      const { coords } = await getPosition()
      setComposer({
        heading: 'My stay',
        draft: { kind: 'stay', lat: coords.latitude, lon: coords.longitude },
      })
    } catch {
      setPanel('peek')
      setPickingStay(true)
    }
  }

  const confirmStayPick = () => {
    const c = api.current?.centerLonLat()
    setPickingStay(false)
    if (!c) return flash('Couldn’t read that spot. Try zooming in a little.')
    setComposer({ heading: 'My stay', draft: { kind: 'stay', lat: c.lat, lon: c.lon } })
  }

  return (
    <div className={`app app--panel-${panel}`}>
      <div className="app__map">
        <Suspense fallback={<div className="map map--loading">Loading the globe…</div>}>
          <MapView
            places={places}
            region={region}
            selectedId={selectedId}
            journal={entries}
            visited={visited}
            visibleIds={visibleIds}
            trainsOn={trainsOn}
            quality={quality}
            onSelect={select}
            onSelectRail={setRailPick}
            highlight={railPick}
            onHeading={setHeading}
            dayStops={dayStops}
            onTrainsError={() => flash('Couldn’t load train lines. Try again with signal.')}
            onReady={(a) => (api.current = a)}
            onSource={setSource}
          />
        </Suspense>

        <header className="topbar">
          {owner ? (
            <button type="button" className="topbar__search" onClick={() => setSearchOpen(true)}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle
                  cx="11"
                  cy="11"
                  r="6.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="m16 16 4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Search {region.name}
            </button>
          ) : (
            <p className="topbar__brand">
              {`${family?.name ?? 'Traveler'}’s travels`}{' '}
              <span className="topbar__region">{region.name}</span>
            </p>
          )}
          {[...filters].map((f) => (
            <button
              key={f}
              type="button"
              className={`topbar__chip topbar__chip--on${f === 'bourdain' ? ' chip--bourdain' : ''}`}
              onClick={() => toggleFilter(f)}
              aria-label={`Remove filter ${FILTERS.find((x) => x.id === f)?.label}`}
            >
              {FILTERS.find((x) => x.id === f)?.label} ×
            </button>
          ))}
          {source && source !== 'google-3d' && (
            <button type="button" className="topbar__chip" onClick={() => setInfoOpen(true)}>
              {source === 'offline' ? 'Offline map' : 'Basic map'}
            </button>
          )}
        </header>

        {trainsOn && (
          <p className="legend" aria-label="Train map key">
            {RAIL_KINDS.map((k) => (
              <span key={k} className="legend__item">
                <span className="legend__swatch" style={{ background: RAIL_STYLE[k].color }} />
                {RAIL_STYLE[k].label}
              </span>
            ))}
            <span className="legend__credit">Rail data: MLIT 国土数値情報</span>
          </p>
        )}

        {pickingStay ? (
          <>
            <div className="crosshair" aria-hidden="true" />
            <div className="pickbar" role="dialog" aria-label="Pick your stay on the map">
              <p>Move the map so the cross is on your stay.</p>
              <div className="pickbar__row">
                <button type="button" className="btn" onClick={() => setPickingStay(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn--primary" onClick={confirmStayPick}>
                  Set stay here
                </button>
              </div>
            </div>
          </>
        ) : (
          <MapControls
            onTilt={() => api.current?.toggleTilt()}
            onLocate={locate}
            onInfo={() => setInfoOpen((o) => !o)}
            onTrains={() => {
              setTrainsOn((t) => !t)
              setRailPick(null)
            }}
            locating={locating}
            trainsOn={trainsOn}
          />
        )}

        {!pickingStay && rotated && (
          <button
            type="button"
            className="compass"
            onClick={() => api.current?.northUp()}
            aria-label="Turn map north up"
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              aria-hidden="true"
              style={{ transform: `rotate(${-heading}deg)` }}
            >
              <path d="M12 3 16 12h-8z" fill="#C8402F" />
              <path d="M12 21 8 12h8z" fill="currentColor" opacity="0.45" />
            </svg>
          </button>
        )}

        {infoOpen && source && (
          <InfoSheet
            source={source}
            quality={quality}
            onQuality={changeQuality}
            onClose={() => setInfoOpen(false)}
          />
        )}
        {railPick && !selected && !infoOpen && !pickingStay && (
          <RailCard pick={railPick} onClose={() => setRailPick(null)} />
        )}
        {selected && !infoOpen && !pickingStay && (
          <PeekCard
            key={selected.id}
            place={selected}
            onClose={() => select(null)}
            visitedAt={visitedAt.get(selected.id)}
            planLabel={`${shortDay(planDate)} ${Number(planDate.slice(8))}`}
            inPlan={planDay.stops.some((s) => s.placeId === selected.id)}
            onAddToPlan={
              owner ? () => planActions.addStop(planDate, { placeId: selected.id }) : undefined
            }
            onStamp={
              owner
                ? () =>
                    setComposer({
                      heading: visitedAt.has(selected.id) ? 'Add to journal' : 'Stamp this place',
                      draft: { kind: 'visit', placeId: selected.id, title: selected.name },
                    })
                : undefined
            }
          />
        )}
      </div>

      {tab === 'plan' && owner && !pickingStay && (
        <Panel size={panel} onSize={setPanel} label="Plan">
          <PlanSheet
            places={places}
            byId={byId}
            date={planDate}
            onDate={setPlanDate}
            userPos={userPos}
            onLocate={locate}
            onShowPlace={(p) => select(p.id)}
            onSuggestions={onSuggestions}
          />
        </Panel>
      )}

      {tab === 'journal' && !pickingStay && (
        <Panel size={panel} onSize={setPanel} label="Journal">
          <JournalScreen
            mode={owner ? 'owner' : 'family'}
            entries={entries}
            familyName={family?.name}
            status={journal.status}
            onCheckIn={checkIn}
            checkingIn={checkingIn}
            onWrite={() => setComposer({ heading: 'New entry', draft: { kind: 'note' } })}
            onAddStay={startStay}
            onShowOnMap={showOnMap}
          />
        </Panel>
      )}

      {familyError && (
        <p className="notice" role="alert">
          This family link isn’t working. Ask for a fresh one.
        </p>
      )}

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      {searchOpen && (
        <SearchSheet
          places={places}
          filters={filters}
          onToggleFilter={toggleFilter}
          onClearFilters={() => setFilters(new Set())}
          onClose={() => setSearchOpen(false)}
          onPickPlace={(p) => {
            setSearchOpen(false)
            select(p.id)
          }}
          onPickStation={(st) => {
            setSearchOpen(false)
            setTrainsOn(true)
            select(null)
            setPanel('peek')
            api.current?.flyToPoint(st.lon, st.lat)
          }}
          onPickLine={(line, kind) => {
            setSearchOpen(false)
            setTrainsOn(true)
            select(null)
            setPanel('peek')
            setRailPick({ rail: line, kind })
            api.current?.flyToBounds(lineBounds(line))
          }}
        />
      )}

      {composer && (
        <EntryComposer
          draft={composer.draft}
          heading={composer.heading}
          onClose={() => setComposer(null)}
          onSaved={() => {
            if (composer.draft.kind === 'visit') flash('Stamped in your journal.')
            if (composer.draft.kind === 'stay') flash('Stay added to the map.')
          }}
        />
      )}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}

export default App
