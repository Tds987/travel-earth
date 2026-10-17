import type { Category, Place, Region } from '../types'

export const CATEGORY_LABEL: Record<Category, string> = {
  food: 'Food',
  sight: 'Sight',
  nature: 'Nature',
  stay: 'Stay',
  event: 'Festival',
  baseball: 'Baseball',
  fishing: 'Fishing',
  season: 'Autumn color',
}

const num = (n: number) => n.toLocaleString('en-US')
const usd = (n: number, rate: number) => Math.max(1, Math.round(n / rate))

/** "¥1,500–3,000 · ≈ $9–19" */
export function formatPrice(price: NonNullable<Place['price']>, region: Region): string {
  const { min, max } = price
  const s = region.currencySymbol
  const local = min === max ? `${s}${num(min)}` : `${s}${num(min)}–${num(max)}`
  const lo = usd(min, region.usdRate)
  const hi = usd(max, region.usdRate)
  const dollars = lo === hi ? `$${lo}` : `$${lo}–${hi}`
  return `${local} · ≈ ${dollars}`
}

/** First sentence of the "why" copy, for the peek card. */
export function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : text).trim()
}
