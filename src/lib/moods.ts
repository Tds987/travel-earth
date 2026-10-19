import type { Category, Place } from '../types'

// How Tyler actually decides: by mood. Each mood is a set of categories (and
// sometimes subtypes) — the Italia category tabs, turned into one question.
export type Mood =
  'hungry' | 'sweet' | 'coffee' | 'drink' | 'see' | 'market' | 'outdoors' | 'onsen' | 'baseball'

export const MOODS: { id: Mood; label: string; categories: Category[] }[] = [
  { id: 'hungry', label: 'Hungry', categories: ['food'] },
  { id: 'sweet', label: 'Something sweet', categories: ['sweet'] },
  { id: 'coffee', label: 'Coffee', categories: ['coffee'] },
  { id: 'drink', label: 'A drink', categories: ['drink'] },
  { id: 'see', label: 'See something', categories: ['sight', 'event'] },
  { id: 'market', label: 'Market', categories: ['market'] },
  { id: 'outdoors', label: 'Outdoors', categories: ['nature', 'season', 'fishing'] },
  { id: 'onsen', label: 'Onsen', categories: ['onsen'] },
  { id: 'baseball', label: 'Baseball', categories: ['baseball'] },
]

export const moodOf = (p: Place): Mood | null =>
  MOODS.find((m) => m.categories.includes(p.category))?.id ?? null

/** Italia price tiers, in yen: ¥ < 1,500 ≤ ¥¥ ≤ 5,000 < ¥¥¥ */
export function tierOf(p: Place): 1 | 2 | 3 | null {
  if (p.tier) return p.tier
  if (!p.price) return null
  const mid = (p.price.min + p.price.max) / 2
  return mid < 1500 ? 1 : mid <= 5000 ? 2 : 3
}

export const TIER_LABEL = { 1: '¥', 2: '¥¥', 3: '¥¥¥' } as const
