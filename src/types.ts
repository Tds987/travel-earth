export type Category =
  'food' | 'sight' | 'nature' | 'stay' | 'event' | 'baseball' | 'fishing' | 'season'

export type DateRange = { start: string; end: string }

export type Region = {
  id: string
  name: string
  currency: string
  currencySymbol: string
  /** Local currency units per 1 USD (approximate, for display only). */
  usdRate: number
  pack: string
  bounds: [west: number, south: number, east: number, north: number]
  /** Where the intro flight lands. */
  home: { lon: number; lat: number; height: number }
}

export type Place = {
  id: string
  region: string
  name: string
  localName?: string
  lat: number
  lon: number
  city: string
  category: Category
  /** 2–4 sentences: why it matters for this traveler. */
  why: string
  tips?: string[]
  /** Local currency. */
  price?: { min: number; max: number; estimate?: boolean }
  dates?: DateRange
  seasonPeak?: DateRange
  /** Free-text timing when exact dates aren't known (e.g. projected games). */
  when?: string
  status?: string
  flags?: { bourdain?: boolean; series?: boolean; tickets?: boolean }
  sources?: string[]
  /** Search text for directions when the pin is approximate. */
  mapsQuery?: string
  updated: string
}
