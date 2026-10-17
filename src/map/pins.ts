import type { Category } from '../types'

/** Traditional Japanese colors per category (nipponcolors.com). */
export const CATEGORY_COLOR: Record<Category, string> = {
  baseball: '#C8402F', // shu (vermilion)
  food: '#D9A62E', // yamabuki
  sight: '#165E83', // ai (indigo)
  nature: '#7B8D42', // matcha
  fishing: '#33A6B8', // asagi
  stay: '#8B6F47', // kuri
  event: '#D05A6E', // nadeshiko
  season: '#ED784A', // kaki (persimmon)
}

const cache = new Map<string, HTMLCanvasElement>()

/**
 * A round pin drawn on a canvas at device pixel ratio, so it stays crisp on
 * phones. The billboard is then displayed at `size` CSS pixels.
 */
export function pinImage(category: Category, selected: boolean, size: number): HTMLCanvasElement {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const key = `${category}:${selected}:${size}:${dpr}`
  const hit = cache.get(key)
  if (hit) return hit

  const px = Math.round(size * dpr)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = px
  const ctx = canvas.getContext('2d')!
  const c = px / 2
  const ring = Math.max(2, px * 0.12)

  // soft shadow for legibility over photoreal imagery
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = px * 0.12
  ctx.beginPath()
  ctx.arc(c, c, c - ring, 0, Math.PI * 2)
  ctx.fillStyle = '#F7F3E9' // kinari ring
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.beginPath()
  ctx.arc(c, c, c - ring * 1.9, 0, Math.PI * 2)
  ctx.fillStyle = CATEGORY_COLOR[category]
  ctx.fill()

  if (selected) {
    ctx.beginPath()
    ctx.arc(c, c, (c - ring * 1.9) * 0.38, 0, Math.PI * 2)
    ctx.fillStyle = '#F7F3E9'
    ctx.fill()
  }

  cache.set(key, canvas)
  return canvas
}
