import { useSyncExternalStore } from 'react'
import { addDays } from './dates'
import type { Plan, PlanDay, PlanStop } from './types'

// The trip plan is personal, so it lives only on this phone (and later in
// private Supabase sync), never in the public repo.
const KEY = 'travel-earth:plan'

/**
 * Starting skeleton built around the Japan Series (public schedule):
 * G1–2 Yokohama, G3–5 Fukuoka, G6–7 Yokohama. Everything after is open.
 * Tyler edits bases freely; "stay another night" just extends a base.
 */
function suggested(): Plan {
  const base: Record<string, string> = {
    '2026-10-22': 'tokyo',
    '2026-10-23': 'tokyo',
    '2026-10-24': 'yokohama',
    '2026-10-25': 'yokohama',
    '2026-10-26': 'fukuoka',
    '2026-10-27': 'fukuoka',
    '2026-10-28': 'fukuoka',
    '2026-10-29': 'fukuoka',
    '2026-10-30': 'tokyo',
    '2026-10-31': 'yokohama',
    '2026-11-01': 'yokohama',
  }
  const days: Record<string, PlanDay> = {}
  for (const [d, b] of Object.entries(base)) days[d] = { base: b, stops: [] }
  return { start: '2026-10-22', end: '2026-11-14', days }
}

function load(): Plan {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Plan
  } catch {
    /* fall through */
  }
  return suggested()
}

let plan = load()
const listeners = new Set<() => void>()

function commit(next: Plan) {
  plan = next
  try {
    localStorage.setItem(KEY, JSON.stringify(plan))
  } catch {
    /* storage full or blocked: keep in memory */
  }
  listeners.forEach((l) => l())
}

const day = (d: string): PlanDay => plan.days[d] ?? { stops: [] }
const setDay = (d: string, next: PlanDay) => commit({ ...plan, days: { ...plan.days, [d]: next } })

export const planActions = {
  setBase(d: string, base: string | undefined) {
    setDay(d, { ...day(d), base })
  },
  /** Love it here: keep the same base tomorrow too (and extend the trip if needed). */
  stayAnotherNight(d: string) {
    const next = addDays(d, 1)
    const base = day(d).base
    commit({
      ...plan,
      end: next > plan.end ? next : plan.end,
      days: { ...plan.days, [next]: { ...day(next), base } },
    })
  },
  addStop(d: string, stop: Omit<PlanStop, 'id'>) {
    const cur = day(d)
    if (stop.placeId && cur.stops.some((s) => s.placeId === stop.placeId)) return
    setDay(d, { ...cur, stops: [...cur.stops, { ...stop, id: crypto.randomUUID() }] })
  },
  removeStop(d: string, id: string) {
    const cur = day(d)
    setDay(d, { ...cur, stops: cur.stops.filter((s) => s.id !== id) })
  },
  moveStop(d: string, id: string, by: -1 | 1) {
    const stops = [...day(d).stops]
    const i = stops.findIndex((s) => s.id === id)
    const j = i + by
    if (i < 0 || j < 0 || j >= stops.length) return
    ;[stops[i], stops[j]] = [stops[j], stops[i]]
    setDay(d, { ...day(d), stops })
  },
  extendTrip() {
    commit({ ...plan, end: addDays(plan.end, 1) })
  },
}

export function usePlan(): Plan {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => plan,
  )
}
