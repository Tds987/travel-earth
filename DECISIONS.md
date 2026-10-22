# DECISIONS.md

Running log of product and build decisions. Newest at the bottom. Format: date — decision — why.
Trip planning and personal context live in the "Travel Japan" Claude Project, not in this repo.

## History before this repo (2026-10-10 → 10-12)
- 2026-10-10 — v1 built as a claude.ai artifact (stylized three.js globe, hand-drawn terrain) — artifacts can't load outside map tiles, so it could never be photoreal.
- 2026-10-12 — v2 built on CesiumJS + Google Photorealistic 3D Tiles via Cesium ion free Community plan, hosted on GitHub Pages (github.com/Tds987/japan-earth) — proved photoreal 3D works for free.
- 2026-10-12 — Google Maps Platform direct billing rejected — wanted no card on file; Cesium ion free plan stops at the quota instead of billing.
- 2026-10-12 — Rebuild from scratch — v2 looked archaic/pixelly; earlier Italy app (italia-travel.vercel.app) was too dense and hard for others to use.

## Carried-forward decisions
- Phone-first; must pass the stranger test (understood in 10 seconds).
- Google Earth feel: globe intro, fly-to, tilt into photoreal 3D.
- Bottom bar = sections (working: Map · Plan · Journal), NOT category filters. Final set: Tyler decides.
- Categories/filters live inside search as one sheet.
- Prices shown in local currency AND USD; estimates labeled.
- "Bourdain was here" flag on places he visited.
- Journal is private and stays in the app.
- Multi-region from day one: regions are data + a region pack (palette, type, motifs, currency).
- Free services only unless Tyler approves otherwise.
- Must work on weak signal (eSIM traveler).

## Known config
- Cesium ion token is URL-restricted in the Cesium dashboard; add each new domain (Vercel URL, localhost) to its allowed list.
- Free plan limits: ~1,000 Google 3D loads/month (≈1 per app open), 1,000 imagery sessions.

## Log
<!-- Claude Code: append new entries below -->
- 2026-10-16 — Moved `places.js` into `legacy/` — CLAUDE.md expects reference data at `legacy/places.js`; it stays untouched until migrated into the new schema.
- 2026-10-16 — Phase 0 scaffold: Vite + React + TypeScript — fast, standard, Vercel's built-in preset; types catch content mistakes early.
- 2026-10-16 — Linter is oxlint (current Vite template default) instead of ESLint — same job, much faster, zero extra config; Prettier handles formatting.
- 2026-10-16 — No Tailwind for now; plain CSS variables as design tokens — region packs swap a small set of variables, keeping the look per region simple.
- 2026-10-16 — No installs on Tyler's own or borrowed devices — builds run in the cloud session and on Vercel; Tyler only uses the browser.
- 2026-10-17 — Live on Vercel at https://travel-earth-ivory.vercel.app (Hobby plan, auto-deploys from `main`) — free, already in use, GitHub-linked; `vercel.json` pins the Vite build so dashboard presets can't break it.
- 2026-10-17 — Cesium ion token "Japan Earth web app" allowlist now includes the Vercel URL and http://localhost:5173 — Phase 0 complete.
- 2026-10-17 — Bottom tabs for now: **Map · Journal** (Tyler's call) — keep it minimal before the trip; Plan can return later.
- 2026-10-17 — Map engine: **Cesium from the start**, strictly on the free Cesium ion Community plan (~1,000 Google 3D loads/month, stops instead of billing; no card ever) — photoreal look was the goal; Italia (MapLibre) is a reference for features only, ported piece by piece after Tyler ticks a checklist.
- 2026-10-17 — Phase 1 map shell: Cesium (`cesium` package, no `resium`) + `vite-plugin-static-copy` for Cesium's runtime files — a thin wrapper of our own is easier to control than a React binding.
- 2026-10-17 — Sharpness: `useBrowserRecommendedResolution=false` with `resolutionScale = min(dpr, 2) / dpr` — Cesium multiplies resolutionScale by devicePixelRatio when the flag is off, so setting resolutionScale to dpr (as first sketched in CLAUDE.md) would over-render. Data saver = 1x.
- 2026-10-17 — Imagery ladder: Google Photorealistic 3D (free ion plan) → Cesium World Terrain + Bing (ion) → offline Natural Earth globe bundled with Cesium — the app never shows a blank map and nothing can bill.
- 2026-10-17 — Content migrated from `legacy/places.js` to typed `content/japan/places.json` (40 places) via `scripts/migrate-legacy.mjs`; added `when`, `status`, `flags.series`, `flags.tickets` for projected Series games.
- 2026-10-17 — Map is lazy-loaded so the shell appears instantly; the Cesium chunk (~1.1 MB gzipped) loads after.
- 2026-10-17 — Italia features to port (Tyler's picks): quick links (2), Bourdain video link (3, Rick Steves dropped: no Japan coverage), badges (4), hours (5), fuzzy search (8), trains (13, all of Japan), home-base pins (16, as "Add my stay"). Buses dropped. Everything lives inside the card/search sheet to keep the map sparse.
- 2026-10-17 — Journal: local-first on the phone (IndexedDB), synced to Supabase free tier so family can follow via a private link (no family logins). Location = "Check in here" button (a web app can't track in the background; recommend Find My for live safety). Photos + clips ≤30 s. Family sees every entry. Tyler is on iPhone.
- 2026-10-17 — No Supabase SDK or Dexie: the journal talks to Supabase's REST endpoints and IndexedDB directly — fewer dependencies, and the surface we use is small.
- 2026-10-17 — Privacy model: Tyler signs in once (email + password, sign-ups then disabled). Family reads through a `family_journal(token)` database function keyed by a random share token; media live under unguessable paths. Nothing personal is committed to the repo.
- 2026-10-17 — Bourdain research: 28 more places from A Cook's Tour, No Reservations (Tokyo, Osaka, Kyoto, Hokkaido, Cook It Raw) and Parts Unknown (Tokyo 2013, Okinawa 2015, Japan with Masa 2016), kept in `content/japan/places-bourdain.json` with sources. Closed spots left out (Nibiki, Toriki Honten, Sushi Bar Yasuda, Pizza Ball House, Robot Restaurant, Nishimachi Soba). Pins for less-certain spots are approximate, so their Directions search by name (`mapsQuery`) instead of coordinates.
- 2026-10-17 — Place card "More" now shows quick links (Website, Reviews, Menu or Wikipedia, Bourdain video on YouTube).
- 2026-10-17 — Search: one top search bar (the "Search Japan" pill replaces the brand pill) opening a sheet with typo-tolerant search over places, Shinkansen stations and every train line, plus filter chips (Bourdain first, then Food, Sights, Nature, Baseball, Festivals, Autumn color). Active filters also filter the map pins and show as removable chips; Bourdain narrows, categories widen. No Fuse.js: a ~60-line scorer is enough for this size.
- 2026-10-17 — Trains: every railway in Japan from MLIT N02 (2024) via the processed JSON at github.com/braylon-jamon-dunn/mlit-json, built by `scripts/build-rail.mjs` into `public/rail/{shinkansen,jr,other}.json` (24 MB → ~255 KB gzipped: Douglas–Peucker + chaining). Loaded only when the Trains button is on; drawn as ground-clamped polylines (vermilion Shinkansen, JR green, indigo subway/private) that drape over the photoreal tiles. English names for all 103 Shinkansen stations and the major lines/operators. Tapping a line opens a compact card: fastest time, route, Rail Pass note, official booking links. Credit to MLIT shown in the legend and map info sheet, as their terms require.
- 2026-10-17 — Installable app (PWA) without a plugin: `manifest.webmanifest`, 旅 seal icons (generated, incl. maskable + Apple touch icon), iOS standalone meta, and a hand-written `public/sw.js`. Pages are network-first with the cached shell as fallback; app code, Cesium workers, the bundled offline globe, train data, fonts and icons are cache-first. A small Vite plugin stamps the service worker with a content hash and the exact precache list at build time, so each deploy replaces the old offline copy (~3 MB once). Google/ion map tiles are never cached (terms + size).
- 2026-10-17 — iPhone note surfaced in the app: the home-screen app has its own storage, separate from Safari, so the Journal and map info sheet tell you to install first and log from the installed app.
- 2026-10-19 — App reshaped around planning: tabs are **Plan · Journal**, the map stays on screen in both, and each tab is a three-height panel (peek / half / full) over it.
- 2026-10-19 — Plan = a day-at-a-time tour guide. Day strip from Oct 22 (extendable: one-way ticket), a base city per day with "Stay another night", travel-day cards when the base changes (Shinkansen estimate, flight nudge over 700 km), the day's events (Japan Series, dated festivals), ordered stops with walk/transit legs and per-leg Google Maps directions, and "What are you in the mood for?" (Hungry, Something sweet, Coffee, A drink, See something, Market, Outdoors, Onsen, Baseball).
- 2026-10-19 — Italia's rules ported, not its UI: categories become moods; per-place `subtype`, price tier (¥ <1,500, ¥¥ ≤5,000, ¥¥¥ above), flags local / cultural / tourist trap / UNESCO / Bourdain, `bookAhead` days, typical hours with closing days, era for sights. Open-at slots (now / morning / lunch / afternoon / evening / late) use Japan time. Ranking = open first, then distance, with traps sinking and local/Bourdain picks nudged up. No invented star ratings.
- 2026-10-19 — "Book soon" alerts from `content/japan/book-ahead.json`: Series tickets and hotels, Shinkansen seats on travel days, temple stays, ryokan in onsen towns, famous counters; shown when within ~5 days of the book-by date.
- 2026-10-19 — Series confirmed DeNA vs SoftBank: G1–2 Yokohama (Oct 24–25), G3–5 Fukuoka (Oct 27–29), G6–7 Yokohama (Oct 31–Nov 1). Suggested skeleton seeds the plan (Tokyo → Yokohama → Fukuoka → back via Tokyo → Yokohama); everything after Nov 1 open. The plan itself is stored only on the phone (private) until Supabase.
- 2026-10-19 — New content: Tokyo (48), Yokohama + Kamakura (26), Fukuoka + Karatsu (40), many attractions plus ~5 per mood. Written from research knowledge; hours are "usually", pins approximate, so directions search by name. `scripts/check-content.mjs` now runs before every build (duplicate ids, bounds, categories).
- 2026-10-22 — Tyler's rule, now in CLAUDE.md: guide with options (hours, time needed, cost, travel), never hour-by-hour schedules. The Plan tab already works this way; keep it so.
- 2026-10-22 — Added Kamata as a base (where Tyler is staying), plus Kamata Onsen, Kamata hanetsuki gyoza and the 24-hour Haneda T3 deck.
