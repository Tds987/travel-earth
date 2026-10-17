import {
  Cartesian3,
  ClassificationType,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  GroundPolylineGeometry,
  GroundPolylinePrimitive,
  PolylineColorAppearance,
} from 'cesium'

export type RailKind = 'shinkansen' | 'jr' | 'other'

export type RailLine = {
  id: string
  name: string
  nameEn?: string
  operator: string
  operatorEn?: string
  /** Flattened [lon, lat, lon, lat, …] per path. */
  paths: number[][]
}

export type RailStation = { name: string; nameEn?: string; lon: number; lat: number }

export type RailData = { credit: string; lines: RailLine[]; stations?: RailStation[] }

/** What a picked rail primitive carries, so taps can open the line card. */
export type RailPick = { rail: RailLine; kind: RailKind }

export const RAIL_KINDS: RailKind[] = ['shinkansen', 'jr', 'other']

export const RAIL_STYLE: Record<RailKind, { color: string; width: number; label: string }> = {
  shinkansen: { color: '#C8402F', width: 4.5, label: 'Shinkansen' }, // shu vermilion
  jr: { color: '#2E9B4F', width: 2.5, label: 'JR lines' }, // JR green
  other: { color: '#4A7FB5', width: 2, label: 'Subway & private' }, // light ai indigo
}

const cache = new Map<RailKind, Promise<RailData>>()

/** Loaded on demand (only when Trains is switched on) and cached by the browser. */
export function loadRail(kind: RailKind): Promise<RailData> {
  if (!cache.has(kind)) {
    const p = fetch(`/rail/${kind}.json`).then((r) => {
      if (!r.ok) throw new Error(`rail ${kind}: ${r.status}`)
      return r.json() as Promise<RailData>
    })
    p.catch(() => cache.delete(kind)) // allow a retry when back online
    cache.set(kind, p)
  }
  return cache.get(kind)!
}

/** One batched primitive per layer, draped on terrain and photoreal 3D tiles. */
export function railPrimitive(data: RailData, kind: RailKind): GroundPolylinePrimitive {
  const style = RAIL_STYLE[kind]
  const color = ColorGeometryInstanceAttribute.fromColor(
    Color.fromCssColorString(style.color).withAlpha(kind === 'shinkansen' ? 0.95 : 0.8),
  )
  const instances: GeometryInstance[] = []
  for (const line of data.lines) {
    const pick: RailPick = { rail: line, kind }
    for (const path of line.paths) {
      if (path.length < 4) continue
      instances.push(
        new GeometryInstance({
          geometry: new GroundPolylineGeometry({
            positions: Cartesian3.fromDegreesArray(path),
            width: style.width,
          }),
          attributes: { color },
          id: pick,
        }),
      )
    }
  }
  return new GroundPolylinePrimitive({
    geometryInstances: instances,
    appearance: new PolylineColorAppearance(),
    classificationType: ClassificationType.BOTH,
    asynchronous: true,
  })
}

/** Halo + bright line for the selected rail line (drawn above everything else). */
export function railHighlight({ rail, kind }: RailPick): GroundPolylinePrimitive[] {
  const width = RAIL_STYLE[kind].width
  const make = (css: string, w: number) =>
    new GroundPolylinePrimitive({
      geometryInstances: rail.paths
        .filter((p) => p.length >= 4)
        .map(
          (path) =>
            new GeometryInstance({
              geometry: new GroundPolylineGeometry({
                positions: Cartesian3.fromDegreesArray(path),
                width: w,
              }),
              attributes: {
                color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString(css)),
              },
              id: { rail, kind } satisfies RailPick,
            }),
        ),
      appearance: new PolylineColorAppearance(),
      classificationType: ClassificationType.BOTH,
    })
  return [make('#F7F3E9', width + 7), make(RAIL_STYLE[kind].color, width + 2.5)]
}

export const isRailPick = (x: unknown): x is RailPick =>
  typeof x === 'object' && x !== null && 'rail' in x && 'kind' in x

export const lineLabel = (l: RailLine) => l.nameEn ?? l.name
export const operatorLabel = (l: RailLine) => l.operatorEn ?? l.operator

/** Bounding box of a line, for flying to it. */
export function lineBounds(l: RailLine) {
  let w = 180
  let s = 90
  let e = -180
  let n = -90
  for (const p of l.paths)
    for (let i = 0; i < p.length; i += 2) {
      w = Math.min(w, p[i])
      e = Math.max(e, p[i])
      s = Math.min(s, p[i + 1])
      n = Math.max(n, p[i + 1])
    }
  return { w, s, e, n }
}
