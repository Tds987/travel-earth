import { useEffect, useRef } from 'react'
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Color,
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
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import type { Place, Region } from '../types'
import { pinImage } from './pins'
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
}

type Props = {
  places: Place[]
  region: Region
  selectedId: string | null
  quality: MapQuality
  onSelect: (id: string | null) => void
  onReady: (api: MapApi) => void
  onSource: (source: MapSource) => void
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function MapView({
  places,
  region,
  selectedId,
  quality,
  onSelect,
  onReady,
  onSource,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const creditsRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const sourceRef = useRef<MapSource>('offline')
  const entitiesRef = useRef(new Map<string, Entity>())
  // Latest props for the viewer's event handlers, without re-creating the viewer.
  const latest = useRef({ region, onSelect, onReady, onSource })
  useEffect(() => {
    latest.current = { region, onSelect, onReady, onSource }
  })

  // Create the viewer once.
  useEffect(() => {
    const { region, onReady, onSource } = latest.current
    const entities = entitiesRef.current
    const viewer = createViewer(containerRef.current!, creditsRef.current!)
    viewerRef.current = viewer
    const { camera, scene } = viewer

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

    // Tap a pin to select it; tap empty map to clear.
    const handler = new ScreenSpaceEventHandler(scene.canvas)
    handler.setInputAction((e: { position: Cartesian2 }) => {
      const picked = scene.pick(e.position)
      const id = defined(picked) && picked.id instanceof Entity ? picked.id.id : null
      latest.current.onSelect(id && entities.has(id) ? id : null)
    }, ScreenSpaceEventType.LEFT_CLICK)

    const centerTarget = (): Cartesian3 | undefined => {
      const center = new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2)
      const onTiles = scene.pickPositionSupported ? scene.pickPosition(center) : undefined
      return onTiles ?? camera.pickEllipsoid(center, scene.globe.ellipsoid)
    }

    const duration = () => (prefersReducedMotion() ? 0 : 1.2)

    onReady({
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
      viewer.destroy()
      viewerRef.current = null
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
          // Decluttering: names appear only once you're zoomed in to a city.
          distanceDisplayCondition: new DistanceDisplayCondition(0, 120_000),
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
      e.billboard.image = pinImage(place.category, sel, size) as never
      e.billboard.width = size as never
      e.billboard.height = size as never
      e.label.distanceDisplayCondition = new DistanceDisplayCondition(
        0,
        sel ? Infinity : 120_000,
      ) as never
      e.label.pixelOffset = new Cartesian2(0, size / 2 + 4) as never
    }
    viewer.scene.requestRender()
  }, [selectedId, places])

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
