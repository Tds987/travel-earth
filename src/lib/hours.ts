import type { Category, Place } from '../types'

// Ported from Travel Italia: default hours per category, per-place overrides,
// and the "Open at" filter (now / morning / lunch / evening / late).

const DEFAULT_HOURS: Partial<Record<Category, string>> = {
  food: '11:00–15:00, 17:00–22:00',
  sweet: '10:00–19:00',
  coffee: '8:00–19:00',
  drink: '17:00–24:00',
  market: '8:00–15:00',
  sight: '9:00–17:00',
  onsen: '10:00–22:00',
}

const SUBTYPE_HOURS: Record<string, string> = {
  ramen: '11:00–23:00',
  yakitori: '17:00–23:30',
  izakaya: '17:00–24:00',
  yatai: '18:00–25:00',
  kissaten: '8:00–18:00',
  shrine: '6:00–18:00',
  park: '0:00–24:00',
  viewpoint: '0:00–24:00',
  depachika: '10:00–20:00',
  'morning market': '6:00–12:00',
}

export function hoursFor(p: Place): string | null {
  if (p.hours) return p.hours
  if (p.subtype && SUBTYPE_HOURS[p.subtype]) return SUBTYPE_HOURS[p.subtype]
  return DEFAULT_HOURS[p.category] ?? null
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** "11:00–15:00, 17:30–25:00" → [[660,900],[1050,1500]] (end may pass midnight). */
export function parseHours(h: string): [number, number][] {
  return h
    .split(/,\s*/)
    .map((r) => r.split(/[–-]/))
    .filter((p) => p.length === 2 && /\d/.test(p[0]) && /\d/.test(p[1]))
    .map(([a, b]) => {
      const s = toMin(a.trim())
      let e = toMin(b.trim())
      if (e <= s) e += 24 * 60 // e.g. 18:00–2:00
      return [s, e]
    })
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Open at a given minute of the day (0–1439) on a given weekday? Unknown hours count as open. */
export function isOpenAt(p: Place, minute: number, weekday: number): boolean {
  if (p.closed?.includes(DAYS[weekday])) return false
  const h = hoursFor(p)
  if (!h) return true
  return parseHours(h).some(
    ([s, e]) => (minute >= s && minute < e) || (minute + 1440 >= s && minute + 1440 < e),
  )
}

export type Slot = 'now' | 'morning' | 'lunch' | 'afternoon' | 'evening' | 'late'

export const SLOTS: { id: Slot; label: string; minute?: number }[] = [
  { id: 'now', label: 'Open now' },
  { id: 'morning', label: 'Morning', minute: 9 * 60 + 30 },
  { id: 'lunch', label: 'Lunch', minute: 12 * 60 + 30 },
  { id: 'afternoon', label: 'Afternoon', minute: 15 * 60 },
  { id: 'evening', label: 'Evening', minute: 19 * 60 },
  { id: 'late', label: 'Late night', minute: 23 * 60 + 30 },
]

/** Minute of day in Japan time, wherever the phone thinks it is. */
export function japanNow(): { minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  return {
    minute: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: DAYS.indexOf(get('weekday')),
  }
}
