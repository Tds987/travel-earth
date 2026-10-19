import type { ReactNode } from 'react'

export type PanelSize = 'peek' | 'half' | 'full'

type Props = {
  size: PanelSize
  onSize: (s: PanelSize) => void
  label: string
  children: ReactNode
}

const NEXT: Record<PanelSize, PanelSize> = { peek: 'half', half: 'full', full: 'peek' }

/** Bottom panel over the map: the map stays visible in both Plan and Journal. */
export function Panel({ size, onSize, label, children }: Props) {
  return (
    <section className={`panel panel--${size}`} aria-label={label}>
      <button
        type="button"
        className="panel__handle"
        onClick={() => onSize(NEXT[size])}
        aria-label={size === 'full' ? 'Show more map' : 'Show more of the panel'}
      >
        <span className="panel__grip" aria-hidden="true" />
      </button>
      <div className="panel__body">{children}</div>
    </section>
  )
}
