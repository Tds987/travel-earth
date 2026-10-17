// One-off migration: legacy/places.js (japan-earth v2) -> content/japan/places.json.
// Run with `node scripts/migrate-legacy.mjs`. Kept in the repo as a record of how the data was mapped.
import { readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'

const src = readFileSync(new URL('../legacy/places.js', import.meta.url), 'utf8')
const ctx = {}
vm.runInNewContext(`${src};this.PLACES=PLACES`, ctx)

// v2 "layers" -> new categories (see CLAUDE.md data model)
const CATEGORY = {
  series: 'baseball',
  baseball: 'baseball',
  food: 'food',
  history: 'sight',
  outdoors: 'nature',
  fishing: 'fishing',
  stay: 'stay',
  festival: 'event',
  autumn: 'season',
}

const places = ctx.PLACES.map((p) => {
  const category = CATEGORY[p.layer]
  if (!category) throw new Error(`Unknown layer "${p.layer}" on ${p.id}`)
  return {
    id: p.id,
    region: 'japan',
    name: p.name,
    ...(p.jp && { localName: p.jp }),
    lat: p.lat,
    lon: p.lon,
    city: p.city,
    category,
    why: p.why,
    ...(p.tips?.length && { tips: p.tips }),
    ...(p.yen && { price: { min: p.yen[0], max: p.yen[1], ...(p.est && { estimate: true }) } }),
    ...(p.start && { dates: { start: p.start, end: p.end ?? p.start } }),
    ...(p.peak && { seasonPeak: { start: p.peak[0], end: p.peak[1] } }),
    ...(p.dates && { when: p.dates }),
    ...(p.status && { status: p.status }),
    ...((p.bourdain || p.layer === 'series' || p.ticket) && {
      flags: {
        ...(p.bourdain && { bourdain: true }),
        ...(p.layer === 'series' && { series: true }),
        ...(p.ticket && { tickets: true }),
      },
    }),
    updated: '2026-10-12',
  }
})

writeFileSync(
  new URL('../content/japan/places.json', import.meta.url),
  JSON.stringify(places, null, 2) + '\n',
)
console.log(`Wrote ${places.length} places`)
