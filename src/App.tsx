import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import './App.css'
import { InfoSheet } from './components/InfoSheet'
import { JournalScreen } from './components/JournalScreen'
import { MapControls } from './components/MapControls'
import { PeekCard } from './components/PeekCard'
import { TabBar, type Tab } from './components/TabBar'
import { places, region } from './content'
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

function App() {
  const [tab, setTab] = useState<Tab>('map')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [source, setSource] = useState<MapSource | null>(null)
  const [quality, setQuality] = useState<MapQuality>(readQuality)
  const [infoOpen, setInfoOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const api = useRef<MapApi | null>(null)

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

  const locate = () => {
    if (!navigator.geolocation) return flash('Location isn’t available on this device.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        api.current?.showUser(pos.coords.longitude, pos.coords.latitude)
      },
      () => {
        setLocating(false)
        flash('Couldn’t get your location. Check location permission.')
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div className="app">
      <div className="app__map" hidden={tab !== 'map'}>
        <Suspense fallback={<div className="map map--loading">Loading the globe…</div>}>
          <MapView
            places={places}
            region={region}
            selectedId={selectedId}
            quality={quality}
            onSelect={select}
            onReady={(a) => (api.current = a)}
            onSource={setSource}
          />
        </Suspense>

        <header className="topbar">
          <p className="topbar__brand">
            Travel Earth <span className="topbar__region">{region.name}</span>
          </p>
          {source && source !== 'google-3d' && (
            <button type="button" className="topbar__chip" onClick={() => setInfoOpen(true)}>
              {source === 'offline' ? 'Offline map' : 'Basic map'}
            </button>
          )}
        </header>

        <MapControls
          onTilt={() => api.current?.toggleTilt()}
          onLocate={locate}
          onInfo={() => setInfoOpen((o) => !o)}
          locating={locating}
        />

        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}

        {infoOpen && source && (
          <InfoSheet
            source={source}
            quality={quality}
            onQuality={changeQuality}
            onClose={() => setInfoOpen(false)}
          />
        )}
        {selected && !infoOpen && (
          <PeekCard key={selected.id} place={selected} onClose={() => select(null)} />
        )}
      </div>

      {tab === 'journal' && <JournalScreen />}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}

export default App
