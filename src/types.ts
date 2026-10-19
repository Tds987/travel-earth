export type Category =
  | 'food'
  | 'sweet'
  | 'coffee'
  | 'drink'
  | 'market'
  | 'sight'
  | 'nature'
  | 'onsen'
  | 'stay'
  | 'event'
  | 'baseball'
  | 'fishing'
  | 'season'

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
  flags?: {
    bourdain?: boolean
    series?: boolean
    tickets?: boolean
    /** Italia rules: where locals actually go */
    local?: boolean
    /** Italia rules: culturally significant */
    cultural?: boolean
    /** Italia rules: famous but overpriced/crowded; shown with a warning */
    trap?: boolean
    unesco?: boolean
  }
  /** e.g. ramen, sushi, izakaya, kissaten, wagashi, sake, temple, shrine, castle */
  subtype?: string
  /** 1 = ¥ (under ¥1,500), 2 = ¥¥ (¥1,500–5,000), 3 = ¥¥¥ (over ¥5,000). Derived from price if absent. */
  tier?: 1 | 2 | 3
  /** Typical hours, e.g. "11:00–15:00, 17:30–23:00". Defaults by category when absent. */
  hours?: string
  /** Weekly closing days, e.g. ["Mon"] */
  closed?: string[]
  /** Book this many days ahead (game tickets, temple stays, famous counters). */
  bookAhead?: number
  /** Sights: historical period, Italia-style */
  era?: 'ancient' | 'heian' | 'kamakura' | 'edo' | 'meiji' | 'modern'
  sources?: string[]
  /** Search text for directions when the pin is approximate. */
  mapsQuery?: string
  updated: string
}
