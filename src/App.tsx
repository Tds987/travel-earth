import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { EntryComposer } from './components/EntryComposer'
import { InfoSheet } from './components/InfoSheet'
import { JournalScreen } from './components/JournalScreen'
import { MapControls } from './components/MapControls'
import { PeekCard } from './components/PeekCard'
import { TabBar, type Tab } from './components/TabBar'
import { places, region } from './content'
import { addEntry, useJournal, type NewEntry } from './journal/store'
import { familyJournal } from './journal/supabase'
import type { Entry } from './journal/types'
import { nearestCity } from './lib/geo'
import type { MapApi } from './map/MapView'
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

  const [tab, setTab] = useState<Tab>('map')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [source, setSource] = useState<MapSource | null>(null)
  const [quality, setQuality] = useState<MapQuality>(readQuality)
  const [infoOpen, setInfoOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [composer, setComposer] = useState<Composer | null>(null)
  const [pickingStay, setPickingStay] = useState(false)
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

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    setInfoOpen(false)
    const place = id ? places.find((p) => p.id === id) : null
    if (place) api.current?.flyToPlace(place)
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
    setTab('map')
    const place = e.placeId ? places.find((p) => p.id === e.placeId) : undefined
    // Let the map tab become visible before flying.
    setTimeout(() => {
      if (e.lat != null && e.lon != null) api.current?.flyToPoint(e.lon, e.lat)
      else if (place) select(place.id)
    }, 50)
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
      setTab('map')
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
    <div className="app">
      <div className="app__map" hidden={tab !== 'map'}>
        <Suspense fallback={<div className="map map--loading">Loading the globe…</div>}>
          <MapView
            places={places}
            region={region}
            selectedId={selectedId}
            journal={entries}
            visited={visited}
            quality={quality}
            onSelect={select}
            onReady={(a) => (api.current = a)}
            onSource={setSource}
          />
        </Suspense>

        <header className="topbar">
          <p className="topbar__brand">
            {owner ? 'Travel Earth' : `${family?.name ?? 'Traveler'}’s travels`}{' '}
            <span className="topbar__region">{region.name}</span>
          </p>
          {source && source !== 'google-3d' && (
            <button type="button" className="topbar__chip" onClick={() => setInfoOpen(true)}>
              {source === 'offline' ? 'Offline map' : 'Basic map'}
            </button>
          )}
        </header>

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
            locating={locating}
          />
        )}

        {infoOpen && source && (
          <InfoSheet
            source={source}
            quality={quality}
            onQuality={changeQuality}
            onClose={() => setInfoOpen(false)}
          />
        )}
        {selected && !infoOpen && !pickingStay && (
          <PeekCard
            key={selected.id}
            place={selected}
            onClose={() => select(null)}
            visitedAt={visitedAt.get(selected.id)}
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

      {tab === 'journal' && (
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
