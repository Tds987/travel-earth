import type { Place } from '../types'
import type { RailKind, RailLine, RailStation } from '../map/rail'

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** Edit distance, capped: we only care whether it's 0, 1 or 2. */
function lev(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      rowMin = Math.min(rowMin, cur[j])
    }
    if (rowMin > cap) return cap + 1
    prev = cur
  }
  return prev[b.length]
}

/**
 * Typo-tolerant match: every query word must match a word in the text
 * (prefix, substring, or 1–2 typos for longer words). Higher is better; 0 = no match.
 */
export function score(query: string, primary: string, secondary = ''): number {
  const q = normalize(query).split(' ').filter(Boolean)
  if (!q.length) return 0
  const pWords = normalize(primary).split(' ')
  const sWords = normalize(secondary).split(' ')
  const raw = primary + ' ' + secondary // keep Japanese text for kanji queries
  let total = 0
  for (const token of q) {
    let best = 0
    for (const [words, weight] of [
      [pWords, 3],
      [sWords, 1],
    ] as const) {
      for (const w of words) {
        if (w === token) best = Math.max(best, 4 * weight)
        else if (w.startsWith(token)) best = Math.max(best, 3 * weight)
        else if (token.length >= 3 && w.includes(token)) best = Math.max(best, 2 * weight)
        else if (
          token.length >= 4 &&
          lev(token, w.slice(0, token.length + 1)) <= (token.length >= 7 ? 2 : 1)
        )
          best = Math.max(best, 1 * weight)
      }
    }
    if (!best && raw.includes(token)) best = 2
    if (!best) return 0
    total += best
  }
  return total
}

export type SearchResult =
  | { type: 'place'; place: Place; score: number }
  | { type: 'station'; station: RailStation; score: number }
  | { type: 'line'; line: RailLine; kind: RailKind; score: number }

export function search(
  query: string,
  places: Place[],
  rail: { lines: { line: RailLine; kind: RailKind }[]; stations: RailStation[] },
): SearchResult[] {
  const out: SearchResult[] = []
  for (const place of places) {
    const s = score(
      query,
      `${place.name} ${place.localName ?? ''}`,
      `${place.city} ${place.category} ${place.flags?.bourdain ? 'bourdain' : ''} ${place.why}`,
    )
    if (s) out.push({ type: 'place', place, score: s + 1 })
  }
  for (const station of rail.stations) {
    const s = score(query, `${station.nameEn ?? ''} ${station.name}`, 'station shinkansen')
    if (s) out.push({ type: 'station', station, score: s })
  }
  for (const { line, kind } of rail.lines) {
    const s = score(
      query,
      `${line.nameEn ?? ''} ${line.name}`,
      `${line.operatorEn ?? ''} ${line.operator} train`,
    )
    if (s) out.push({ type: 'line', line, kind, score: s - (kind === 'other' ? 1 : 0) })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 30)
}
