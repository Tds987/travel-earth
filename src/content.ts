import japanBourdain from '../content/japan/places-bourdain.json'
import japanPlaces from '../content/japan/places.json'
import japanRegion from '../content/japan/region.json'
import type { Place, Region } from './types'

// Regions are data: adding one means adding a folder under /content, not new code paths.
export const region = japanRegion as Region
export const places = [...japanPlaces, ...japanBourdain] as Place[]
