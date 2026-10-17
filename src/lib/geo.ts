import { places } from '../content'

const R = 6371
const rad = (d: number) => (d * Math.PI) / 180

export function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** "near Kyoto" for family check-ins, using the nearest known place's city. */
export function nearestCity(lat: number, lon: number): string | null {
  let best: { city: string; d: number } | null = null
  for (const p of places) {
    const d = km(lat, lon, p.lat, p.lon)
    if (!best || d < best.d) best = { city: p.city, d }
  }
  return best && best.d < 40 ? best.city : null
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}
