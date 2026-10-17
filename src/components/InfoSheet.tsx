import { installSteps, isStandalone } from '../lib/install'
import type { MapQuality, MapSource } from '../map/viewer'

const SOURCE_TEXT: Record<MapSource, string> = {
  'google-3d': 'Photoreal 3D (Google, via Cesium ion free plan)',
  'world-terrain':
    'Basic 3D terrain. Photoreal 3D is unavailable right now, possibly the free monthly limit.',
  offline: 'Offline globe. No map service is reachable right now.',
}

type Props = {
  source: MapSource
  quality: MapQuality
  onQuality: (q: MapQuality) => void
  onClose: () => void
}

export function InfoSheet({ source, quality, onQuality, onClose }: Props) {
  return (
    <div className="sheet" role="dialog" aria-modal="false" aria-labelledby="info-title">
      <div className="sheet__head">
        <h2 id="info-title" className="sheet__title">
          Map
        </h2>
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      </div>
      <p className="sheet__row">
        <span className="sheet__label">Showing</span>
        {SOURCE_TEXT[source]}
      </p>
      <label className="sheet__toggle">
        <input
          type="checkbox"
          checked={quality === 'saver'}
          onChange={(e) => onQuality(e.target.checked ? 'saver' : 'sharp')}
        />
        <span>
          <strong>Data saver</strong>
          <br />
          Lower resolution. Uses less data and battery on weak signal.
        </span>
      </label>
      {!isStandalone() && (
        <p className="sheet__row">
          <span className="sheet__label">Use it like an app</span>
          {installSteps()} It then opens full screen and works on weak signal.
        </p>
      )}
      <p className="sheet__note">
        Map data credits are shown at the bottom of the map. Train lines:
        「国土数値情報（鉄道データ）」 国土交通省 (MLIT Japan, 2024).
      </p>
    </div>
  )
}
