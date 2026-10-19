export type City = {
  id: string
  name: string
  lat: number
  lon: number
  radiusKm: number
  station: string
}

export type PlanStop = {
  id: string
  placeId?: string
  /** Free-form stop (e.g. "Hotel", "Meet Ken") when not a known place. */
  name?: string
  lat?: number
  lon?: number
  time?: string
  note?: string
}

export type PlanDay = { base?: string; stops: PlanStop[] }

export type Plan = {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD, extendable: it's a one-way ticket
  days: Record<string, PlanDay>
}

export type BookRule = {
  id: string
  title: string
  leadDays: number
  when: 'event' | 'base' | 'travel' | 'place'
  match?: { flag?: string; cities?: string[]; places?: string[] }
  note: string
}
