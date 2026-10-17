import type { Category, Place } from '../types'

export type Filter = 'bourdain' | Category

export const FILTERS: { id: Filter; label: string }[] = [
  { id: 'bourdain', label: 'Bourdain' },
  { id: 'food', label: 'Food' },
  { id: 'sight', label: 'Sights' },
  { id: 'nature', label: 'Nature' },
  { id: 'baseball', label: 'Baseball' },
  { id: 'event', label: 'Festivals' },
  { id: 'season', label: 'Autumn color' },
]

/** Bourdain narrows; categories widen (any of them). */
export function matchesFilters(place: Place, filters: Set<Filter>): boolean {
  if (filters.has('bourdain') && !place.flags?.bourdain) return false
  const cats = [...filters].filter((f) => f !== 'bourdain')
  return cats.length === 0 || cats.includes(place.category)
}
