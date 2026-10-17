type Props = {
  onTilt: () => void
  onLocate: () => void
  onInfo: () => void
  locating: boolean
}

/** The one small control cluster allowed on the map at rest. */
export function MapControls({ onTilt, onLocate, onInfo, locating }: Props) {
  return (
    <div className="controls" role="group" aria-label="Map controls">
      <button type="button" className="controls__btn" onClick={onTilt}>
        3D
      </button>
      <button
        type="button"
        className="controls__btn"
        onClick={onLocate}
        aria-label="Show my location"
        aria-busy={locating}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" fill="currentColor" />
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      </button>
      <button
        type="button"
        className="controls__btn"
        onClick={onInfo}
        aria-label="Map settings and data"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="7.6" r="1.1" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
