import japanBourdain from '../content/japan/places-bourdain.json'
import japanFukuoka from '../content/japan/places-fukuoka.json'
import japanPlaces from '../content/japan/places.json'
import japanTokyo from '../content/japan/places-tokyo.json'
import japanYokohama from '../content/japan/places-yokohama.json'
import japanRegion from '../content/japan/region.json'
import type { Place, Region } from './types'

// Regions are data: adding one means adding a folder under /content, not new code paths.
export const region = japanRegion as Region
export const places = [
  ...japanPlaces,
  ...japanBourdain,
  ...japanTokyo,
  ...japanYokohama,
  ...japanFukuoka,
] as Place[]
