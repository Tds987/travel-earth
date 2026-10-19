import { useEffect, useRef } from 'react'
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  defined,
  DistanceDisplayCondition,
  Entity,
  HeadingPitchRange,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  Matrix4,
  Math as CesiumMath,
  NearFarScalar,
  PolylineDashMaterialProperty,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  type GroundPolylinePrimitive,
  type Viewer,
} from 'cesium'
import type { Entry } from '../journal/types'
import type { Place, Region } from '../types'
import { pinImage, stayImage, stopImage } from './pins'
import {
  isRailPick,
  loadRail,
  RAIL_KINDS,
  railHighlight,
  railPrimitive,
  type RailKind,
  type RailPick,
} from './rail'
import {
  applyQuality,
  createViewer,
  loadBestImagery,
  type MapQuality,
  type MapSource,
} from './viewer'

const ST_LOUIS = Cartesian3.fromDegrees(-90.199, 38.627, 14_000_000)
const PIN_SIZE = 26
const PIN_SIZE_SELECTED = 34

export type MapApi = {
  /** Tilt between straight-down and a 45° 3D view around the screen center. */
  toggleTilt: () => void
  flyToPlace: (place: Place) => void
  showUser: (lon: number, lat: number) => void
  flyToPoint: (lon: number, lat: number) => void
  /** Ground point under the screen center, for "pick on map". */
  centerLonLat: () => { lon: number; lat: number } | null
  flyToBounds: (b: { w: number; s: number; e: number; n: number }) => void
  /** Rotate back to north-up around the screen center. */
  northUp: () => void
}

type Props = {
  places: Place[]
  region: Region
  selectedId: string | null
  /** Journal entries drawn on the map: stays, check-ins and the travel path. */
  journal: Entry[]
  visited: Set<string>
  /** Pins shown under the current search filter (selected pin always shows). */
  visibleIds: Set<string>
  trainsOn: boolean
  quality: MapQuality
  onSelect: (id: string | null) => void
  onSelectRail: (pick: RailPick | null) => void
  onTrainsError: () => void
  /** The selected plan day's stops, drawn numbered with a route line. */
  dayStops: { lat: number; lon: number; name: string }[]
  /** Line to emphasise (the one whose card is open). */
  highlight: RailPick | null
  /** Map heading in degrees (0 = north up), for the compass. */
  onHeading: (deg: number) => void
  onReady: (api: MapApi) => void
  onSource: (source: MapSource) => void
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function MapView({
  places,
  region,
  selectedId,
  journal,
  visited,
  visibleIds,
  trainsOn,
  quality,
  onSelect,
  onSelectRail,
  onTrainsError,
  highlight,
  onHeading,
  dayStops,
  onReady,
  onSource,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const creditsRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const sourceRef = useRef<MapSource>('offline')
  const entitiesRef = useRef(new Map<string, Entity>())
  const journalRef = useRef<CustomDataSource | null>(null)
  const planRef = useRef<CustomDataSource | null>(null)
  const railRef = useRef<{
    prims: Map<RailKind, GroundPolylinePrimitive>
    stations: CustomDataSource
  } | null>(null)
  // Latest props for the viewer's event handlers, without re-creating the viewer.
  const latest = useRef({
    region,
    onSelect,
    onSelectRail,
    onReady,
    onSource,
    onTrainsError,
    onHeading,
  })
  useEffect(() => {
    latest.current = { region, onSelect, onSelectRail, onReady, onSource, onTrainsError, onHeading }
  })

  // Create the viewer once.
  useEffect(() => {
    const { region, onReady, onSource } = latest.current
    const entities = entitiesRef.current
    const viewer = createViewer(containerRef.current!, creditsRef.current!)
    viewerRef.current = viewer
    const { camera, scene } = viewer
    const journalLayer = new CustomDataSource('journal')
    void viewer.dataSources.add(journalLayer)
    journalRef.current = journalLayer
    const planLayer = new CustomDataSource('plan')
    void viewer.dataSources.add(planLayer)
    planRef.current = planLayer
    const railStations = new CustomDataSource('rail-stations')
    railStations.show = false
    void viewer.dataSources.add(railStations)
    railRef.current = { prims: new Map(), stations: railStations }

    // Globe intro: start over St. Louis, fly to the region, framed so the whole
    // country fits (a tall phone screen needs to sit further back than a wide one).
    const home = new BoundingSphere(Cartesian3.fromDegrees(region.home.lon, region.home.lat), 0)
    const portrait = scene.canvas.clientHeight > scene.canvas.clientWidth
    const homeOffset = new HeadingPitchRange(
      0,
      CesiumMath.toRadians(-88),
      portrait ? region.home.height * 1.35 : region.home.height,
    )
    if (prefersReducedMotion()) {
      camera.viewBoundingSphere(home, homeOffset)
      camera.lookAtTransform(Matrix4.IDENTITY)
    } else {
      camera.setView({ destination: ST_LOUIS })
      setTimeout(() => {
        if (viewer.isDestroyed()) return
        camera.flyToBoundingSphere(home, { offset: homeOffset, duration: 5 })
      }, 600)
    }

    loadBestImagery(viewer).then((source) => {
      sourceRef.current = source
      onSource(source)
      scene.requestRender()
    })

    // Report heading so the compass can appear when the map is rotated.
    camera.percentageChanged = 0.01
    let lastHeading = 0
    const removeHeading = camera.changed.addEventListener(() => {
      const deg = Math.round(CesiumMath.toDegrees(camera.heading)) % 360
      if (Math.abs(deg - lastHeading) >= 2) {
        lastHeading = deg
        latest.current.onHeading(deg)
      }
    })

    // Tap a pin to select it; tap empty map to clear.
    const handler = new ScreenSpaceEventHandler(scene.canvas)
    handler.setInputAction((e: { position: Cartesian2 }) => {
      const picked = scene.pick(e.position)
      if (defined(picked) && isRailPick(picked.id)) {
        latest.current.onSelect(null)
        latest.current.onSelectRail(picked.id)
        return
      }
      const id = defined(picked) && picked.id instanceof Entity ? picked.id.id : null
      latest.current.onSelectRail(null)
      latest.current.onSelect(id && entities.has(id) ? id : null)
    }, ScreenSpaceEventType.LEFT_CLICK)

    const centerTarget = (): Cartesian3 | undefined => {
      const center = new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2)
      const onTiles = scene.pickPositionSupported ? scene.pickPosition(center) : undefined
      return onTiles ?? camera.pickEllipsoid(center, scene.globe.ellipsoid)
    }

    const duration = () => (prefersReducedMotion() ? 0 : 1.2)

    const flyClose = (lon: number, lat: number, pitch = -45) => {
      const range = sourceRef.current === 'google-3d' ? 2500 : 40_000
      camera.flyToBoundingSphere(new BoundingSphere(Cartesian3.fromDegrees(lon, lat), 0), {
        offset: new HeadingPitchRange(camera.heading, CesiumMath.toRadians(pitch), range),
        duration: prefersReducedMotion() ? 0 : 2,
      })
    }

    onReady({
      flyToPoint: (lon, lat) => flyClose(lon, lat),
      northUp() {
        const target = centerTarget()
        if (!target) return
        camera.flyToBoundingSphere(new BoundingSphere(target, 0), {
          offset: new HeadingPitchRange(
            0,
            camera.pitch,
            Cartesian3.distance(camera.position, target),
          ),
          duration: duration() * 0.6,
        })
      },
      flyToBounds({ w, s, e, n }) {
        const pad = Math.max(e - w, n - s) * 0.15 + 0.05
        camera.flyTo({
          destination: Rectangle.fromDegrees(w - pad, s - pad, e + pad, n + pad),
          duration: duration() * 1.5,
        })
      },
      centerLonLat() {
        const target = centerTarget()
        if (!target) return null
        const c = Cartographic.fromCartesian(target)
        return { lon: CesiumMath.toDegrees(c.longitude), lat: CesiumMath.toDegrees(c.latitude) }
      },
      toggleTilt() {
        const target = centerTarget()
        if (!target) return
        const range = Cartesian3.distance(camera.position, target)
        const flat = camera.pitch < CesiumMath.toRadians(-70)
        camera.flyToBoundingSphere(new BoundingSphere(target, 0), {
          offset: new HeadingPitchRange(
            camera.heading,
            CesiumMath.toRadians(flat ? -40 : -90),
            range,
          ),
          duration: duration(),
        })
      },
      flyToPlace(place) {
        const target = Cartesian3.fromDegrees(place.lon, place.lat)
        // Photoreal tiles reward getting close; the basic globe gets blurry, so stay higher.
        const range = sourceRef.current === 'google-3d' ? 1800 : 40_000
        camera.flyToBoundingSphere(new BoundingSphere(target, 0), {
          offset: new HeadingPitchRange(camera.heading, CesiumMath.toRadians(-40), range),
          duration: prefersReducedMotion() ? 0 : 2.2,
        })
      },
      showUser(lon, lat) {
        const position = Cartesian3.fromDegrees(lon, lat)
        const existing = viewer.entities.getById('you-are-here')
        if (existing) existing.position = position as never
        else
          viewer.entities.add({
            id: 'you-are-here',
            position,
            point: {
              pixelSize: 14,
              color: Color.fromCssColorString('#165E83'),
              outlineColor: Color.WHITE,
              outlineWidth: 3,
              heightReference: HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          })
        camera.flyToBoundingSphere(new BoundingSphere(position, 0), {
          offset: new HeadingPitchRange(camera.heading, CesiumMath.toRadians(-50), 3000),
          duration: duration(),
        })
      },
    })

    return () => {
      handler.destroy()
      removeHeading()
      viewer.destroy()
      viewerRef.current = null
      journalRef.current = null
      planRef.current = null
      railRef.current = null
      entities.clear()
    }
  }, [])

  // Pins
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const map = entitiesRef.current
    for (const place of places) {
      if (map.has(place.id)) continue
      const entity = viewer.entities.add({
        id: place.id,
        name: place.name,
        position: Cartesian3.fromDegrees(place.lon, place.lat),
        billboard: {
          image: pinImage(place.category, false, PIN_SIZE),
          width: PIN_SIZE,
          height: PIN_SIZE,
          verticalOrigin: VerticalOrigin.CENTER,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new NearFarScalar(2e5, 1, 8e6, 0.7),
        },
        label: {
          text: place.name,
          font: '600 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          fillColor: Color.fromCssColorString('#2B2B28'),
          outlineColor: Color.fromCssColorString('#F7F3E9'),
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.TOP,
          pixelOffset: new Cartesian2(0, PIN_SIZE / 2 + 4),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          // Decluttering: names appear only at street level (cities are dense now).
          distanceDisplayCondition: new DistanceDisplayCondition(0, 5_000),
        },
      })
      map.set(place.id, entity)
    }
    viewer.scene.requestRender()
  }, [places])

  // Selected pin styling
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    for (const place of places) {
      const e = entitiesRef.current.get(place.id)
      if (!e?.billboard || !e.label) continue
      const sel = place.id === selectedId
      const size = sel ? PIN_SIZE_SELECTED : PIN_SIZE
      e.show = sel || visibleIds.has(place.id)
      e.billboard.image = pinImage(place.category, sel, size, visited.has(place.id)) as never
      e.billboard.width = size as never
      e.billboard.height = size as never
      e.label.distanceDisplayCondition = new DistanceDisplayCondition(
        0,
        sel ? Infinity : 5_000,
      ) as never
      e.label.pixelOffset = new Cartesian2(0, size / 2 + 4) as never
    }
    viewer.scene.requestRender()
  }, [selectedId, places, visited, visibleIds])

  // Trains layer: fetched the first time it's switched on, then just shown/hidden.
  useEffect(() => {
    const viewer = viewerRef.current
    const rail = railRef.current
    if (!viewer || !rail) return
    rail.stations.show = trainsOn
    for (const prim of rail.prims.values()) prim.show = trainsOn
    viewer.scene.requestRender()
    if (!trainsOn || rail.prims.size) return

    let cancelled = false
    Promise.allSettled(RAIL_KINDS.map(loadRail)).then((results) => {
      if (cancelled || viewer.isDestroyed()) return
      if (results.some((r) => r.status === 'rejected')) latest.current.onTrainsError()
      // Draw order: other, JR, then Shinkansen on top.
      for (const kind of ['other', 'jr', 'shinkansen'] as RailKind[]) {
        const res = results[RAIL_KINDS.indexOf(kind)]
        if (res.status !== 'fulfilled' || rail.prims.has(kind)) continue
        const prim = viewer.scene.groundPrimitives.add(railPrimitive(res.value, kind))
        rail.prims.set(kind, prim)
        for (const st of res.value.stations ?? []) {
          rail.stations.entities.add({
            position: Cartesian3.fromDegrees(st.lon, st.lat),
            point: {
              pixelSize: 7,
              color: Color.fromCssColorString('#F7F3E9'),
              outlineColor: Color.fromCssColorString('#C8402F'),
              outlineWidth: 2.5,
              heightReference: HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              distanceDisplayCondition: new DistanceDisplayCondition(0, 900_000),
            },
            label: {
              text: st.nameEn ?? st.name,
              font: '600 12px system-ui, -apple-system, sans-serif',
              fillColor: Color.fromCssColorString('#2B2B28'),
              outlineColor: Color.fromCssColorString('#F7F3E9'),
              outlineWidth: 4,
              style: LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: VerticalOrigin.TOP,
              pixelOffset: new Cartesian2(0, 8),
              heightReference: HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              distanceDisplayCondition: new DistanceDisplayCondition(0, 300_000),
            },
          })
        }
      }
      viewer.scene.requestRender()
    })
    return () => {
      cancelled = true
    }
  }, [trainsOn])

  // Day plan overlay: numbered stops joined by a dashed ink line.
  useEffect(() => {
    const layer = planRef.current
    if (!layer) return
    layer.entities.removeAll()
    dayStops.forEach((s, i) =>
      layer.entities.add({
        position: Cartesian3.fromDegrees(s.lon, s.lat),
        billboard: {
          image: stopImage(i + 1, 30),
          width: 30,
          height: 30,
          pixelOffset: new Cartesian2(0, -22),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      }),
    )
    if (dayStops.length > 1)
      layer.entities.add({
        polyline: {
          positions: dayStops.map((s) => Cartesian3.fromDegrees(s.lon, s.lat)),
          width: 3,
          material: new PolylineDashMaterialProperty({
            color: Color.fromCssColorString('#2B2B28').withAlpha(0.85),
            dashLength: 14,
          }),
          clampToGround: true,
        },
      })
    viewerRef.current?.scene.requestRender()
  }, [dayStops])

  // Emphasise the tapped line: a light halo with the line color on top.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !highlight) return
    const prims = railHighlight(highlight).map((p) => viewer.scene.groundPrimitives.add(p))
    viewer.scene.requestRender()
    return () => {
      if (viewer.isDestroyed()) return
      prims.forEach((p) => viewer.scene.groundPrimitives.remove(p))
      viewer.scene.requestRender()
    }
  }, [highlight])

  // Journal overlay
  useEffect(() => {
    const layer = journalRef.current
    if (!layer) return
    layer.entities.removeAll()
    const placeById = new Map(places.map((p) => [p.id, p]))
    const path: Cartesian3[] = []
    const checkins = journal.filter((e) => e.kind === 'checkin' && e.lat != null)
    const last = checkins[checkins.length - 1]
    const ground = {
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    }

    for (const e of journal) {
      const place = e.placeId ? placeById.get(e.placeId) : undefined
      const lon = e.lon ?? place?.lon
      const lat = e.lat ?? place?.lat
      if (lon == null || lat == null) continue
      const position = Cartesian3.fromDegrees(lon, lat)
      if (e.kind !== 'stay') path.push(position)

      if (e.kind === 'stay') {
        layer.entities.add({
          id: `j:${e.id}`,
          position,
          billboard: { image: stayImage(28), width: 28, height: 28, ...ground },
          label: {
            text: e.title ?? 'My stay',
            font: '600 13px system-ui, -apple-system, sans-serif',
            fillColor: Color.fromCssColorString('#2B2B28'),
            outlineColor: Color.fromCssColorString('#F7F3E9'),
            outlineWidth: 4,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.TOP,
            pixelOffset: new Cartesian2(0, 18),
            distanceDisplayCondition: new DistanceDisplayCondition(0, 150_000),
            ...ground,
          },
        })
      } else if (e.kind === 'checkin') {
        const isLast = e === last
        const when = new Date(e.at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
        layer.entities.add({
          id: `j:${e.id}`,
          position,
          point: {
            pixelSize: isLast ? 16 : 9,
            color: Color.fromCssColorString('#165E83'),
            outlineColor: Color.fromCssColorString('#F7F3E9'),
            outlineWidth: isLast ? 4 : 2,
            ...ground,
          },
          label: isLast
            ? {
                text: `Last check-in · ${when}`,
                font: '600 13px system-ui, -apple-system, sans-serif',
                fillColor: Color.fromCssColorString('#F7F3E9'),
                showBackground: true,
                backgroundColor: Color.fromCssColorString('#165E83'),
                backgroundPadding: new Cartesian2(8, 5),
                verticalOrigin: VerticalOrigin.BOTTOM,
                pixelOffset: new Cartesian2(0, -14),
                // keep the country view calm; the Journal tab has "See on map"
                distanceDisplayCondition: new DistanceDisplayCondition(0, 1_500_000),
                ...ground,
              }
            : undefined,
        })
      }
    }

    // The trail of where you've been, in order.
    if (path.length > 1) {
      layer.entities.add({
        polyline: {
          positions: path,
          width: 3,
          material: Color.fromCssColorString('#C8402F').withAlpha(0.8),
          clampToGround: true,
        },
      })
    }
    viewerRef.current?.scene.requestRender()
  }, [journal, places])

  useEffect(() => {
    if (viewerRef.current) applyQuality(viewerRef.current, quality)
  }, [quality])

  return (
    <div className="map">
      <div
        ref={containerRef}
        className="map__canvas"
        aria-label="3D map of Japan"
        role="application"
      />
      <div ref={creditsRef} />
    </div>
  )
}
