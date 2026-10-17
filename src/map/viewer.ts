import {
  buildModuleUrl,
  createGooglePhotorealistic3DTileset,
  ImageryLayer,
  Ion,
  IonImageryProvider,
  Terrain,
  TileMapServiceImageryProvider,
  Viewer,
  type Cesium3DTileset,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

export type MapQuality = 'sharp' | 'saver'

/** Which imagery is actually showing, so the UI can be honest about it. */
export type MapSource = 'google-3d' | 'world-terrain' | 'offline'

const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined

/**
 * Render at real device pixels (capped at 2x) instead of CSS pixels.
 * v2 looked pixelly because Cesium defaults to CSS-pixel resolution.
 * With useBrowserRecommendedResolution=false the effective ratio is
 * devicePixelRatio * resolutionScale, so we scale down only above 2x.
 */
export function applyQuality(viewer: Viewer, quality: MapQuality) {
  const dpr = window.devicePixelRatio || 1
  viewer.useBrowserRecommendedResolution = false
  const target = quality === 'saver' ? 1 : Math.min(dpr, 2)
  viewer.resolutionScale = target / dpr
  viewer.scene.requestRender()
}

export function createViewer(container: HTMLElement, creditContainer: HTMLElement): Viewer {
  // Offline base layer that ships inside Cesium itself: always works, even with no signal.
  const offline = ImageryLayer.fromProviderAsync(
    TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII')),
  )

  const viewer = new Viewer(container, {
    baseLayer: offline,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    creditContainer,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    msaaSamples: 4,
  })

  const { scene } = viewer
  scene.globe.enableLighting = false
  scene.globe.baseColor.alpha = 1
  scene.screenSpaceCameraController.enableCollisionDetection = true
  viewer.cesiumWidget.creditContainer.classList.add('map-credits')

  return viewer
}

/**
 * Try photoreal Google 3D tiles (free Cesium ion plan, ~1,000 loads/month).
 * If there's no token, the quota is used up, or the URL isn't allowed,
 * fall back to Cesium World Terrain + Bing imagery, then to the offline globe.
 * The free plan stops serving instead of billing, so nothing here can cost money.
 */
export async function loadBestImagery(viewer: Viewer): Promise<MapSource> {
  if (!token) return 'offline'
  Ion.defaultAccessToken = token

  try {
    const tileset: Cesium3DTileset = await createGooglePhotorealistic3DTileset(
      { onlyUsingWithGoogleGeocoder: true },
      { maximumScreenSpaceError: 16 },
    )
    if (viewer.isDestroyed()) return 'offline'
    viewer.scene.primitives.add(tileset)
    // Google tiles cover the whole planet; hiding the globe avoids z-fighting.
    viewer.scene.globe.show = false
    return 'google-3d'
  } catch (err) {
    console.warn('Google 3D tiles unavailable, falling back', err)
  }

  try {
    const bing = await IonImageryProvider.fromAssetId(2)
    if (viewer.isDestroyed()) return 'offline'
    viewer.imageryLayers.addImageryProvider(bing)
    viewer.scene.setTerrain(Terrain.fromWorldTerrain())
    return 'world-terrain'
  } catch (err) {
    console.warn('Cesium ion imagery unavailable, staying offline', err)
    return 'offline'
  }
}
