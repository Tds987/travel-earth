// Fails the build on content mistakes that would break the app at runtime:
// duplicate place ids (Cesium refuses duplicate entity ids), missing fields,
// coordinates outside the region, unknown categories.
import { readdirSync, readFileSync } from 'node:fs'

const CATEGORIES = new Set([
  'food',
  'sweet',
  'coffee',
  'drink',
  'market',
  'sight',
  'nature',
  'onsen',
  'stay',
  'event',
  'baseball',
  'fishing',
  'season',
])
const dir = new URL('../content/japan/', import.meta.url)
const region = JSON.parse(readFileSync(new URL('region.json', dir), 'utf8'))
const [w, s, e, n] = region.bounds
const errors = []
const seen = new Map()

for (const file of readdirSync(dir).filter((f) => f.startsWith('places') && f.endsWith('.json'))) {
  for (const p of JSON.parse(readFileSync(new URL(file, dir), 'utf8'))) {
    const at = `${file}:${p.id}`
    if (seen.has(p.id)) errors.push(`duplicate id "${p.id}" in ${file} and ${seen.get(p.id)}`)
    seen.set(p.id, file)
    for (const k of ['id', 'name', 'city', 'category', 'why'])
      if (!p[k]) errors.push(`${at} missing ${k}`)
    if (!CATEGORIES.has(p.category)) errors.push(`${at} unknown category ${p.category}`)
    if (!(p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n))
      errors.push(`${at} outside region bounds`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`content ok: ${seen.size} places`)
