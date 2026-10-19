import cityList from '../../content/japan/cities.json'
import events from '../../content/japan/events.json'
import rules from '../../content/japan/book-ahead.json'
import { km } from '../lib/geo'
import { isOpenAt, japanNow, type Slot, SLOTS } from '../lib/hours'
import { MOODS, tierOf, type Mood } from '../lib/moods'
import type { Place } from '../types'
import { addDays, dateRange, daysBetween, weekdayOf } from './dates'
import type { BookRule, City, Plan, PlanStop } from './types'

export const cities = cityList as City[]
export const cityById = new Map(cities.map((c) => [c.id, c]))
export type DayEvent = { date: string; title: string; placeId: string; time: string }
export const dayEvents = (d: string) => (events as DayEvent[]).filter((e) => e.date === d)

export type LatLon = { lat: number; lon: number }

export type GuideFilters = {
  bourdain: boolean
  local: boolean
  noTrap: boolean
  tiers: Set<1 | 2 | 3>
}

export const defaultGuideFilters = (): GuideFilters => ({
  bourdain: false,
  local: false,
  noTrap: false,
  tiers: new Set(),
})

/**
 * The tour guide: places matching a mood, open at the chosen time, near the
 * reference point (you, your last stop, or the day's base). Italia's rules
 * decide what qualifies; distance decides the order. Tourist traps sink.
 */
export function suggest(
  places: Place[],
  opts: {
    mood: Mood
    slot: Slot
    date: string
    ref: LatLon
    radiusKm: number
    filters: GuideFilters
  },
): { place: Place; km: number; open: boolean }[] {
  const mood = MOODS.find((m) => m.id === opts.mood)!
  const { minute, weekday } =
    opts.slot === 'now'
      ? japanNow()
      : { minute: SLOTS.find((s) => s.id === opts.slot)!.minute!, weekday: weekdayOf(opts.date) }
  const f = opts.filters
  return places
    .filter((p) => mood.categories.includes(p.category))
    .filter((p) => !f.bourdain || p.flags?.bourdain)
    .filter((p) => !f.local || p.flags?.local)
    .filter((p) => !f.noTrap || !p.flags?.trap)
    .filter((p) => {
      const t = tierOf(p)
      return f.tiers.size === 0 || t === null || f.tiers.has(t)
    })
    .filter((p) => !p.dates || (opts.date >= p.dates.start && opts.date <= p.dates.end))
    .map((p) => ({
      place: p,
      km: km(opts.ref.lat, opts.ref.lon, p.lat, p.lon),
      open: isOpenAt(p, minute, weekday),
    }))
    .filter((r) => r.km <= opts.radiusKm)
    .sort((a, b) => Number(b.open) - Number(a.open) || score(a) - score(b))
}

const score = (r: { place: Place; km: number }) =>
  r.km +
  (r.place.flags?.trap ? 2 : 0) -
  (r.place.flags?.local ? 0.3 : 0) -
  (r.place.flags?.bourdain ? 0.3 : 0)

/** Leg between two stops: walk under ~1 km, otherwise transit (rough Tokyo-style estimate). */
export function leg(a: LatLon, b: LatLon) {
  const d = km(a.lat, a.lon, b.lat, b.lon)
  const walk = d < 1.1
  const minutes = walk ? Math.max(2, Math.round(d * 13)) : Math.round(8 + d * 2.6)
  const mode = walk ? 'walking' : 'transit'
  return {
    km: d,
    walk,
    minutes,
    href: `https://www.google.com/maps/dir/?api=1&travelmode=${mode}&origin=${a.lat},${a.lon}&destination=${b.lat},${b.lon}`,
  }
}

/** Moving base cities: train estimate, and a nudge to fly on long hops. */
export function cityHop(from: City, to: City) {
  const d = km(from.lat, from.lon, to.lat, to.lon)
  const trainHours = d < 60 ? d / 70 + 0.2 : d / 210 + 0.4
  return {
    km: d,
    trainHours,
    suggestFlight: d > 700,
    href: `https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=${encodeURIComponent(from.station + ' Station')}&destination=${encodeURIComponent(to.station + ' Station')}`,
  }
}

export const fmtHours = (h: number) => {
  const total = Math.round((h * 60) / 5) * 5
  const hh = Math.floor(total / 60)
  const mm = total % 60
  return hh ? `${hh} h${mm ? ` ${mm} min` : ''}` : `${mm} min`
}

export const stopPoint = (
  s: PlanStop,
  byId: Map<string, Place>,
): (LatLon & { name: string }) | null => {
  const p = s.placeId ? byId.get(s.placeId) : undefined
  const lat = s.lat ?? p?.lat
  const lon = s.lon ?? p?.lon
  if (lat == null || lon == null) return null
  return { lat, lon, name: s.name ?? p?.name ?? 'Stop' }
}

export type BookAlert = {
  id: string
  title: string
  note: string
  forDate: string
  dueBy: string
  overdue: boolean
}

/** Things to book ~a week out, based on what's in the plan (and the Series). */
export function bookAlerts(plan: Plan, today: string, byId: Map<string, Place>): BookAlert[] {
  const out: BookAlert[] = []
  const seen = new Set<string>()
  const add = (r: BookRule, forDate: string, subject?: string) => {
    if (forDate < today) return
    const key = `${r.id}:${subject ?? ''}`
    if (seen.has(key)) return
    const dueBy = addDays(forDate, -r.leadDays)
    if (daysBetween(today, dueBy) > 5) return // not yet worth nagging
    seen.add(key)
    out.push({
      id: key,
      title: subject ? `${r.title}: ${subject}` : r.title,
      note: r.note,
      forDate,
      dueBy,
      overdue: dueBy <= today,
    })
  }
  const days = dateRange(plan.start, plan.end)
  for (const r of rules as BookRule[]) {
    if (r.when === 'event') {
      for (const e of events as DayEvent[]) add(r, e.date)
    }
    for (let i = 0; i < days.length; i++) {
      const d = days[i]
      const day = plan.days[d]
      if (!day) continue
      if (r.when === 'base' && day.base && r.match?.cities?.includes(day.base))
        add(r, d, cityById.get(day.base)?.name)
      if (
        r.when === 'travel' &&
        i > 0 &&
        day.base &&
        plan.days[days[i - 1]]?.base &&
        plan.days[days[i - 1]]!.base !== day.base
      )
        add(
          r,
          d,
          `${cityById.get(plan.days[days[i - 1]]!.base!)?.name} → ${cityById.get(day.base)?.name}`,
        )
      if (r.when === 'place')
        for (const s of day.stops)
          if (s.placeId && r.match?.places?.includes(s.placeId))
            add(r, d, byId.get(s.placeId)?.name)
      for (const s of day.stops) {
        const p = s.placeId ? byId.get(s.placeId) : undefined
        if (p?.bookAhead && r.id === 'counter-sushi' && !r.match?.places?.includes(p.id))
          add({ ...r, leadDays: p.bookAhead, title: 'Book ahead' }, d, p.name)
      }
    }
  }
  return out.sort((a, b) => a.dueBy.localeCompare(b.dueBy))
}

/** Which base city a point is in (nearest within its radius), for "near me". */
export function cityAt(p: LatLon): City | null {
  let best: { c: City; d: number } | null = null
  for (const c of cities) {
    const d = km(p.lat, p.lon, c.lat, c.lon)
    if (d <= c.radiusKm * 1.5 && (!best || d < best.d)) best = { c, d }
  }
  return best?.c ?? null
}
